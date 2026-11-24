# LUNA Loyalty Rewards Engine & Coin Wallet Documentation

---

## 1. Overview & Business Objectives

The LUNA Loyalty Rewards Engine increases customer lifetime value and retention by awarding digital "Luna Coins" on qualified orders. Customers can redeem their accumulated balance directly at checkout as an instant monetary discount.

---

## 2. Configurable Reward Parameters

All reward parameters are managed dynamically by administrators without requiring code deployments (`/api/v1/admin/rewards/settings`):

| Setting | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `is_active` | Boolean | `true` | Master switch to enable or pause the loyalty program |
| `min_purchase_amount` | Decimal | `₹500.00` | Minimum order subtotal required to qualify for earning coins |
| `earning_ratio` | Integer | `100` | Rupee spend needed to earn 1 coin (e.g. ₹100 = 1 coin) |
| `conversion_rate` | Decimal | `₹1.00` | Monetary discount value per redeemed coin (e.g. 1 coin = ₹1 off) |
| `min_redemption_coins` | Integer | `50` | Minimum coin balance required before redemption is unlocked |
| `max_redemption_percent`| Decimal | `100.0%` | Maximum percentage of the order subtotal payable using coins |
| `allow_partial_redemption`| Boolean| `true` | Allows combining coins with Razorpay for remaining balance |

---

## 3. Customer Rewards Wallet & Transaction Ledger

Each customer account has an isolated wallet record (`reward_wallets`):
- `balance`: Current spendable coins.
- `total_earned`: Lifetime accumulated coins.
- `total_redeemed`: Lifetime spent coins.

### Immutable Transaction Log (`reward_transactions`)
No coin balance is ever altered without a corresponding transaction entry:

```sql
CREATE TABLE reward_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES reward_wallets(id) ON DELETE CASCADE,
    order_id UUID NULL REFERENCES orders(id),
    transaction_type VARCHAR(50) NOT NULL, -- 'order_earned', 'order_redeemed', 'order_refunded', 'manual_adjustment'
    coins INT NOT NULL, -- Positive for credits, negative for debits
    balance_after INT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4. Coin Earning & Anti-Abuse Rules

1. **Earn on Delivery Only**: Coins are not credited immediately upon payment. They are awarded strictly when the order transitions to `DELIVERED`. This prevents shoppers from earning rewards on orders that are subsequently cancelled or returned.
2. **Idempotency Guarantee**: The backend checks `order_id` in `reward_transactions` before awarding coins, guaranteeing that an order cannot credit coins more than once.
3. **Eligible Purchase Amount**: Coins are computed strictly on the paid goods subtotal after applying coupon discounts, excluding delivery fees and coin discounts.
4. **Automatic Reversal on Return/Rejection**: If an order is rejected or returned post-delivery, previously awarded coins are clawed back from the customer's wallet.

---

## 5. Checkout Coin Redemption Mathematics

During checkout calculation:
```python
# 1. Check if rewards are active
if not settings.is_active or coins_to_redeem <= 0:
    return 0.0

# 2. Check customer balance
if coins_to_redeem > customer_wallet.balance:
    raise HTTPException(400, "Insufficient coin balance")

# 3. Check minimum threshold
if coins_to_redeem < settings.min_redemption_coins:
    raise HTTPException(400, f"Minimum redemption is {settings.min_redemption_coins} coins")

# 4. Calculate discount value
potential_discount = coins_to_redeem * settings.conversion_rate

# 5. Apply maximum percentage cap
max_allowed_discount = subtotal * (settings.max_redemption_percent / 100.0)
final_discount = min(potential_discount, max_allowed_discount)
final_coins_used = int(final_discount / settings.conversion_rate)
```

---

## 6. Admin Manual Adjustments

Administrators can manually credit or debit coins (e.g. for customer support goodwill or compensation) via `POST /api/v1/admin/rewards/adjust`:
- Requires `user_id`, `coins` (+ or -), and mandatory `reason` text.
- Debits cannot reduce a customer's wallet balance below 0.
- All manual adjustments record the administrator's ID in the transaction ledger.
