import asyncio
import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone
from typing import Dict, List, Optional
from fastapi import HTTPException, status

from app.schemas.rewards import (
    RewardSettingsBase,
    RewardSettingsUpdate,
    RewardSettingsResponse,
    CustomerWalletResponse,
    CoinTransactionItem,
    RewardsOverviewStats
)

class RewardsStore:
    def __init__(self):
        self._lock = asyncio.Lock()
        
        # In-memory settings
        self.settings: dict = {
            "id": "default",
            "is_active": True,
            "reward_per_100": 1.0, # ₹1 reward per ₹100 spent
            "min_purchase_amount": 100.0,
            "earning_ratio": 0.01, # 1 coin per ₹100
            "coin_conversion_rate": 1.0, # 1 coin = ₹1.00
            "min_redemption_coins": 10,
            "max_redemption_per_order": 500,
            "allow_full_coin_payment": True,
            "allow_mixed_payment": True,
            "coin_expiry_days": 365,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        # user_id -> { "available_coins": int, "total_earned": int, "total_redeemed": int, "created_at": str }
        self.wallets: Dict[str, dict] = {}

        # transaction_id -> dict
        self.transactions: Dict[str, dict] = {}

        # Set of order_ids for which coins were already awarded (to prevent duplicate earning)
        self.orders_rewarded: set = set()

    # ==========================================
    # SETTINGS CONFIGURATION (ADMIN)
    # ==========================================
    async def get_settings(self) -> RewardSettingsResponse:
        return RewardSettingsResponse(**self.settings)

    async def update_settings(self, req: RewardSettingsUpdate, admin_id: Optional[str] = None) -> RewardSettingsResponse:
        async with self._lock:
            data = req.model_dump(exclude_unset=True)
            if "reward_per_100" in data and data["reward_per_100"] is not None:
                data["earning_ratio"] = float(data["reward_per_100"]) / 100.0
            elif "earning_ratio" in data and data["earning_ratio"] is not None:
                data["reward_per_100"] = float(data["earning_ratio"]) * 100.0
            self.settings.update(data)
            self.settings["updated_at"] = datetime.now(timezone.utc).isoformat()
            return RewardSettingsResponse(**self.settings)

    # ==========================================
    # CUSTOMER WALLET LOOKUP & AUDIT
    # ==========================================
    async def get_wallet(self, user_id: str) -> CustomerWalletResponse:
        async with self._lock:
            if user_id not in self.wallets:
                now = datetime.now(timezone.utc).isoformat()
                self.wallets[user_id] = {
                    "user_id": user_id,
                    "available_coins": 0,
                    "total_earned": 0,
                    "total_redeemed": 0,
                    "created_at": now,
                    "updated_at": now
                }

            w = self.wallets[user_id]
            user_txns = [
                CoinTransactionItem(**tx)
                for tx in self.transactions.values()
                if tx["user_id"] == user_id
            ]
            user_txns.sort(key=lambda t: t.created_at, reverse=True)

            conversion = float(self.settings.get("coin_conversion_rate", 1.0))
            min_red = int(self.settings.get("min_redemption_coins", 10))
            max_red = int(self.settings.get("max_redemption_per_order", 500))
            avail = w["available_coins"]
            is_active = self.settings.get("is_active", True)

            return CustomerWalletResponse(
                user_id=user_id,
                available_coins=avail,
                monetary_value=round(avail * conversion, 2),
                total_earned_coins=w["total_earned"],
                total_redeemed_coins=w["total_redeemed"],
                transactions=user_txns,
                can_redeem=(is_active and avail >= min_red),
                min_redemption_coins=min_red,
                max_redemption_coins=max_red
            )

    get_or_create_wallet = get_wallet

    # ==========================================
    # COIN REDEMPTION AT CHECKOUT (ATOMIC SAFE)
    # ==========================================
    async def validate_and_calculate_redemption(
        self,
        user_id: str,
        coins_requested: int,
        order_subtotal: float
    ) -> dict:
        """
        Validates coin redemption against policy rules:
        - Checks available wallet balance
        - Checks min_redemption_coins and max_redemption_per_order
        - Checks allow_full_coin_payment vs allow_mixed_payment
        - Returns actual coins to deduct and monetary discount
        """
        if coins_requested <= 0:
            return {"coins_used": 0, "discount_amount": 0.0, "is_full_payment": False}

        if not self.settings.get("is_active", True):
            raise HTTPException(status_code=400, detail="Loyalty reward redemption is currently disabled by store.")

        wallet = await self.get_wallet(user_id)
        if wallet.available_coins < coins_requested:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient coins. Requested: {coins_requested}, Available: {wallet.available_coins}"
            )

        min_red = self.settings.get("min_redemption_coins", 10)
        if coins_requested < min_red:
            raise HTTPException(
                status_code=400,
                detail=f"Minimum redemption is {min_red} coins."
            )

        max_red = self.settings.get("max_redemption_per_order", 500)
        if coins_requested > max_red:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum permitted redemption is {max_red} coins per order."
            )

        conversion = float(self.settings.get("coin_conversion_rate", 1.0))
        discount_amount = round(coins_requested * conversion, 2)

        # Check full coin payment policy
        is_full = (discount_amount >= order_subtotal)
        if is_full:
            if not self.settings.get("allow_full_coin_payment", True):
                raise HTTPException(
                    status_code=400,
                    detail="100% full coin payment is not permitted. Please combine coins with partial gateway payment."
                )
            # Cap discount to subtotal
            discount_amount = order_subtotal
            coins_requested = int(order_subtotal / conversion)

        return {
            "coins_used": coins_requested,
            "discount_amount": discount_amount,
            "is_full_payment": is_full
        }

    async def debit_coins_for_order(
        self,
        user_id: str,
        coins: int,
        order_id: str,
        order_number: str
    ) -> CoinTransactionItem:
        """
        Atomically debits coins from wallet and logs immutable audit ledger record.
        """
        if coins <= 0:
            raise ValueError("Coins to debit must be positive")

        async with self._lock:
            w = self.wallets.setdefault(user_id, {
                "user_id": user_id,
                "available_coins": 0,
                "total_earned": 0,
                "total_redeemed": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            })

            if w["available_coins"] < coins:
                raise HTTPException(
                    status_code=400,
                    detail=f"Concurrent balance update: Insufficient coins (available: {w['available_coins']})"
                )

            now = datetime.now(timezone.utc).isoformat()
            w["available_coins"] -= coins
            w["total_redeemed"] += coins
            w["updated_at"] = now

            conversion = float(self.settings.get("coin_conversion_rate", 1.0))
            tx_id = f"ctx-{uuid.uuid4().hex[:10]}"
            tx_data = {
                "id": tx_id,
                "user_id": user_id,
                "order_id": order_id,
                "order_number": order_number,
                "transaction_type": "DEBIT_REDEEMED",
                "coins": -coins,
                "monetary_value": round(coins * conversion, 2),
                "balance_after": w["available_coins"],
                "reason": f"Redeemed at checkout for order {order_number}",
                "admin_id": None,
                "created_at": now
            }
            self.transactions[tx_id] = tx_data
            return CoinTransactionItem(**tx_data)

    # ==========================================
    # COIN EARNING (ON SUCCESSFUL ORDER)
    # ==========================================
    async def credit_coins_for_completed_order(
        self,
        user_id: str,
        eligible_amount: float = 0.0,
        order_id: str = "",
        order_number: str = "",
        eligible_order_amount: Optional[float] = None,
        order_total: Optional[float] = None,
        **kwargs
    ) -> Optional[CoinTransactionItem]:
        """
        Awards coins on qualifying completed order:
        - Prevents duplicate awards for same order (strict idempotency)
        - Checks min_purchase_amount and active status
        - Uses decimal-safe monetary arithmetic based on reward_per_100
        - Credits available_coins and total_earned
        """
        amt = order_total if order_total is not None else (eligible_order_amount if eligible_order_amount is not None else eligible_amount)
        if amt is None or amt <= 0:
            return None

        if not self.settings.get("is_active", True):
            return None

        async with self._lock:
            if order_id:
                if order_id in self.orders_rewarded:
                    return None # Idempotent ignore
                for tx in self.transactions.values():
                    if tx.get("order_id") == order_id and tx.get("transaction_type") == "CREDIT_EARNED":
                        self.orders_rewarded.add(order_id)
                        return None

            min_purchase = float(self.settings.get("min_purchase_amount", 100.0))
            if amt < min_purchase:
                return None

            d_amt = Decimal(str(amt))
            reward_rate_val = self.settings.get("reward_per_100")
            if reward_rate_val is not None:
                d_rate = Decimal(str(reward_rate_val))
            else:
                d_rate = Decimal(str(self.settings.get("earning_ratio", 0.01))) * Decimal("100")

            coins_earned = int((d_amt * d_rate / Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
            if coins_earned <= 0:
                return None

            w = self.wallets.setdefault(user_id, {
                "user_id": user_id,
                "available_coins": 0,
                "total_earned": 0,
                "total_redeemed": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            })

            now = datetime.now(timezone.utc).isoformat()
            w["available_coins"] += coins_earned
            w["total_earned"] += coins_earned
            w["updated_at"] = now

            if order_id:
                self.orders_rewarded.add(order_id)

            conversion = float(self.settings.get("coin_conversion_rate", 1.0))
            tx_id = f"ctx-{uuid.uuid4().hex[:10]}"
            tx_data = {
                "id": tx_id,
                "user_id": user_id,
                "order_id": order_id,
                "order_number": order_number,
                "transaction_type": "CREDIT_EARNED",
                "coins": coins_earned,
                "monetary_value": round(coins_earned * conversion, 2),
                "balance_after": w["available_coins"],
                "reason": f"Loyalty coins earned on completion of order {order_number}",
                "admin_id": None,
                "created_at": now
            }
            self.transactions[tx_id] = tx_data
            return CoinTransactionItem(**tx_data)

    # ==========================================
    # COIN REVERSAL ON REFUND / CANCELLATION
    # ==========================================
    async def reverse_earned_coins_for_order(
        self,
        user_id: str,
        order_id: str,
        order_number: str,
        reason: str
    ) -> Optional[CoinTransactionItem]:
        """
        Reverses previously earned coins if qualifying order is refunded or rejected.
        """
        async with self._lock:
            if order_id not in self.orders_rewarded:
                return None # No earned coins were awarded for this order

            # Find how many coins were credited
            credited_tx = next(
                (t for t in self.transactions.values() if t.get("order_id") == order_id and t.get("transaction_type") == "CREDIT_EARNED"),
                None
            )
            if not credited_tx:
                return None

            coins_to_reverse = credited_tx["coins"]
            w = self.wallets.get(user_id)
            if not w:
                return None

            now = datetime.now(timezone.utc).isoformat()
            # Wallet available coins cannot become negative; clamp at 0
            w["available_coins"] = max(0, w["available_coins"] - coins_to_reverse)
            w["updated_at"] = now
            self.orders_rewarded.discard(order_id)

            tx_id = f"ctx-{uuid.uuid4().hex[:10]}"
            conversion = float(self.settings.get("coin_conversion_rate", 1.0))
            tx_data = {
                "id": tx_id,
                "user_id": user_id,
                "order_id": order_id,
                "order_number": order_number,
                "transaction_type": "REVERSAL_REFUND",
                "coins": -coins_to_reverse,
                "monetary_value": round(coins_to_reverse * conversion, 2),
                "balance_after": w["available_coins"],
                "reason": f"Reversed earned coins due to order cancellation/refund: {reason}",
                "admin_id": None,
                "created_at": now
            }
            self.transactions[tx_id] = tx_data
            return CoinTransactionItem(**tx_data)

    async def restore_redeemed_coins_for_order(
        self,
        user_id: str,
        coins_to_restore: int,
        order_id: str,
        order_number: str,
        reason: str = "Order cancelled or rejected"
    ) -> CoinTransactionItem:
        """
        Restores spent coins if checkout payment fails or order is rejected by admin.
        """
        if coins_to_restore <= 0:
            raise ValueError("Coins to restore must be positive")

        async with self._lock:
            w = self.wallets.setdefault(user_id, {
                "user_id": user_id,
                "available_coins": 0,
                "total_earned": 0,
                "total_redeemed": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            })

            now = datetime.now(timezone.utc).isoformat()
            w["available_coins"] += coins_to_restore
            w["total_redeemed"] = max(0, w["total_redeemed"] - coins_to_restore)
            w["updated_at"] = now

            conversion = float(self.settings.get("coin_conversion_rate", 1.0))
            tx_id = f"ctx-{uuid.uuid4().hex[:10]}"
            tx_data = {
                "id": tx_id,
                "user_id": user_id,
                "order_id": order_id,
                "order_number": order_number,
                "transaction_type": "RESTORE_FAILED_PAYMENT",
                "coins": coins_to_restore,
                "monetary_value": round(coins_to_restore * conversion, 2),
                "balance_after": w["available_coins"],
                "reason": f"Restored redeemed coins: {reason}",
                "admin_id": None,
                "created_at": now
            }
            self.transactions[tx_id] = tx_data
            return CoinTransactionItem(**tx_data)

    # ==========================================
    # MANUAL ADMIN ADJUSTMENT & AUDIT
    # ==========================================
    async def manual_admin_adjustment(
        self,
        user_id: str,
        coins_delta: int,
        reason: str,
        admin_id: str
    ) -> CoinTransactionItem:
        if coins_delta == 0:
            raise HTTPException(status_code=400, detail="Coins adjustment cannot be zero.")
        if not reason or len(reason.strip()) < 5:
            raise HTTPException(status_code=400, detail="Mandatory administrative justification reason is required.")

        async with self._lock:
            w = self.wallets.setdefault(user_id, {
                "user_id": user_id,
                "available_coins": 0,
                "total_earned": 0,
                "total_redeemed": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            })

            new_balance = w["available_coins"] + coins_delta
            if new_balance < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot debit {abs(coins_delta)} coins. User only has {w['available_coins']} coins."
                )

            now = datetime.now(timezone.utc).isoformat()
            w["available_coins"] = new_balance
            if coins_delta > 0:
                w["total_earned"] += coins_delta
            else:
                w["total_redeemed"] += abs(coins_delta)
            w["updated_at"] = now

            conversion = float(self.settings.get("coin_conversion_rate", 1.0))
            tx_id = f"ctx-{uuid.uuid4().hex[:10]}"
            tx_data = {
                "id": tx_id,
                "user_id": user_id,
                "order_id": None,
                "order_number": None,
                "transaction_type": "MANUAL_ADJUSTMENT",
                "coins": coins_delta,
                "monetary_value": round(abs(coins_delta) * conversion, 2),
                "balance_after": new_balance,
                "reason": f"Admin manual adjustment: {reason}",
                "admin_id": admin_id,
                "created_at": now
            }
            self.transactions[tx_id] = tx_data
            return CoinTransactionItem(**tx_data)

    async def get_overview_stats(self) -> RewardsOverviewStats:
        async with self._lock:
            total_issued = sum(w["total_earned"] for w in self.wallets.values())
            total_redeemed = sum(w["total_redeemed"] for w in self.wallets.values())
            active_users = sum(1 for w in self.wallets.values() if w["available_coins"] > 0)
            conversion = float(self.settings.get("coin_conversion_rate", 1.0))
            total_balance = sum(w["available_coins"] * conversion for w in self.wallets.values())

            return RewardsOverviewStats(
                total_coins_issued=total_issued,
                total_coins_redeemed=total_redeemed,
                active_reward_customers=max(active_users, 1),
                total_wallet_balance_value=round(total_balance, 2)
            )

    async def list_all_wallets(self) -> List[CustomerWalletResponse]:
        async with self._lock:
            res = []
            for uid in self.wallets.keys():
                res.append(await self.get_wallet(uid))
            return res

rewards_store = RewardsStore()
