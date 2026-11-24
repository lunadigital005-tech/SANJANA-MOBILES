# LUNA Inventory Concurrency & Stock Governance Documentation

---

## 1. Concurrency Model & Anti-Overselling Guarantee

During high-traffic events (e.g. flash sales, limited stock drops), multiple shoppers may attempt to purchase the same inventory simultaneously. Without strict concurrency controls, this leads to race conditions, double-allocation, and negative inventory.

LUNA eliminates overselling through a **Two-Phase Reservation Pattern**:

```
[Phase 1: Reserve Stock]
Customer clicks "Proceed to Checkout"
       |
  Acquire Lock
       |
Check: available_quantity >= requested_quantity
       |
  [Yes] -> Decrement available_quantity
        -> Increment reserved_quantity
        -> Create reservation with 15-min TTL
        -> Release Lock
  [No]  -> HTTP 409 Conflict: "Insufficient stock available"

       |
[Phase 2: Payment Outcome]
       +-----------------------+-----------------------+
       |                                               |
[Payment Verified]                            [Payment Fails / TTL Expires]
       |                                               |
Acquire Lock                                    Acquire Lock
       |                                               |
Decrement reserved_quantity                     Decrement reserved_quantity
Permanently close reservation                   Increment available_quantity
Log 'order_deduction' movement                  Log 'reservation_release' movement
Release Lock                                    Release Lock
```

---

## 2. Stock States & Thresholds

Each product's inventory record maintains:
- `available_quantity`: Stock currently available for new purchases.
- `reserved_quantity`: Stock locked in active checkout sessions.
- `low_stock_threshold`: Configurable per-product warning limit (default: 5 units).

### Computed Stock Status
```python
if available_quantity == 0:
    stock_status = "out_of_stock"
elif available_quantity <= low_stock_threshold:
    stock_status = "low_stock"
else:
    stock_status = "in_stock"
```

The frontend uses these status codes to display:
- **`out_of_stock`**: Disables the "Add to Cart" and "Buy Now" buttons.
- **`low_stock`**: Displays an urgent badge: `"Only X units left in stock!"`
- **`in_stock`**: Standard purchasing state.

---

## 3. Stock Movements Audit Ledger

Every stock level change is immutable and permanently recorded in `inventory_movements`:

| Column | Description |
| :--- | :--- |
| `id` | Unique movement identifier (`mov-uuid`) |
| `product_id` | Foreign key referencing the product |
| `previous_quantity` | Quantity before this action took place |
| `quantity_changed` | Delta amount (+ for increase, - for reduction) |
| `new_quantity` | Final resulting available stock |
| `movement_type` | `restock`, `order_deduction`, `reservation_release`, `damage`, `inventory_correction` |
| `reason` | Human-readable explanation or order ID |
| `admin_id` | User ID of the administrator (if manual adjustment) |
| `created_at` | High-precision UTC timestamp |

---

## 4. Automatic Reservation Cleanup Engine

If a user abandons checkout, closes their browser tab, or experiences a payment decline, their reserved inventory must not remain locked indefinitely.

The backend provides an automated background task and lifecycle check `cleanup_expired_reservations()`:
```python
async def cleanup_expired_reservations(self) -> int:
    async with self._lock:
        now = datetime.now(timezone.utc)
        released_count = 0
        for res_id, res in list(self.reservations.items()):
            if res["status"] == "active" and res["expires_at"] < now:
                p_id = res["product_id"]
                qty = res["quantity"]
                
                # Restore available stock
                self.inventory[p_id]["available_quantity"] += qty
                self.inventory[p_id]["reserved_quantity"] = max(0, self.inventory[p_id]["reserved_quantity"] - qty)
                
                # Record audit trail
                self.movements.append({
                    "id": f"mov-{uuid.uuid4().hex[:8]}",
                    "product_id": p_id,
                    "previous_quantity": prev_avail,
                    "quantity_changed": qty,
                    "new_quantity": self.inventory[p_id]["available_quantity"],
                    "movement_type": "reservation_release",
                    "reason": f"Automatic release of expired reservation {res_id}"
                })
                res["status"] = "expired"
                released_count += 1
        return released_count
```

This method is automatically triggered whenever an inventory query or checkout operation is initiated, guaranteeing that no stock is stranded.
