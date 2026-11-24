# LUNA Post-Launch Operational Maintenance & Runbook Guide

---

## 1. System Health Monitoring

### 1.1 Health Check Endpoint
The backend exposes a public health probe at `GET /health`:
```bash
curl -I https://api.luna-store.com/health
```
- **Expected Status**: `200 OK`
- **Expected Body**: `{"status": "healthy", "service": "luna-backend", "version": "1.0.0"}`

### 1.2 Uptime Monitoring Setup
Configure an external uptime monitor (e.g. Better Uptime, UptimeRobot, or Pingdom):
- **Interval**: 60 seconds
- **Alert Threshold**: 2 consecutive failures
- **Notification Channels**: PagerDuty, Slack `#luna-ops`, SMS / Email

---

## 2. Database Maintenance & Backup Runbooks

### 2.1 Backups & Disaster Recovery (Supabase)
- **Automated Daily Backups**: Managed by Supabase with 7-day retention (or 30-day with Point-in-Time Recovery enabled).
- **Manual Snapshot before Migrations**:
  Before applying any future SQL migration, take an immediate logical backup:
  ```bash
  supabase db dump -f luna_backup_$(date +%Y%m%d).sql
  ```

### 2.2 Routine Vacuuming & Index Maintenance
PostgreSQL autovacuum handles standard row cleanup. For high-volume transaction periods, run during off-peak hours:
```sql
VACUUM ANALYZE orders;
VACUUM ANALYZE inventory_movements;
VACUUM ANALYZE reward_transactions;
```

---

## 3. Handling Stuck Orders & Payment Reconciliation

### Scenario A: Customer Paid via Razorpay, but Order Status is `PENDING`
**Root Cause**: Customer network dropped before the browser could call `/api/v1/checkout/verify-payment`, or the webhook was delayed.

**Resolution Steps**:
1. Open the [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Search for the customer's email or payment reference.
3. Verify that the payment status is `Captured`.
4. Copy `razorpay_payment_id` and `razorpay_order_id`.
5. Run the manual reconciliation script or call the admin update API:
   ```bash
   curl -X POST https://api.luna-store.com/api/v1/admin/orders/{order_id}/status \
     -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"status": "CONFIRMED", "notes": "Reconciled against Razorpay payment pay_xxx"}'
   ```

---

## 4. Physical Inventory Audit & Stock Reconciliation

To reconcile physical warehouse stock with digital inventory counts:
1. Navigate to **Admin Console > Inventory Management**.
2. Click **Export Stock CSV** or review the live overview table.
3. Compare warehouse shelf counts against `available_quantity`.
4. If a discrepancy exists (e.g. damaged goods, unrecorded receipt):
   - Click **Adjust Stock**.
   - Select the adjustment type (`Restock`, `Damaged Goods`, `Correction`).
   - Enter the exact delta and a mandatory reason note.
   - The system immediately logs the adjustment in `inventory_movements` with your administrator ID.

---

## 5. Customer Service & Support Runbooks

### 5.1 Issuing a Goodwill Loyalty Coin Credit
When compensating a customer for a delayed delivery:
1. In the Admin Console, open **Rewards & Loyalty > Customer Wallets**.
2. Search for the customer's account by email.
3. Click **Adjust Coins**.
4. Enter the coin amount (e.g. `+100`) and the explanation: `"Compensation for delivery delay on Order #ord-xxx"`.
5. The customer's wallet balance updates immediately and records an auditable entry in `reward_transactions`.

### 5.2 Processing Line Item Damage Partial Refunds
1. Open **Admin Console > Orders**.
2. Select the order and click **Issue Refund**.
3. Enter the partial refund amount (cannot exceed the remaining unrefunded total).
4. Enter the reason (e.g. `"Item arrived with cracked packaging"`).
5. Confirm refund. The backend calls Razorpay's refund API and updates the local order record.

---

## 6. Scheduled Operations & Background Maintenance

| Task | Frequency | Automated / Manual | Description |
| :--- | :--- | :--- | :--- |
| `cleanup_expired_reservations()` | Continuous / On-demand | Automated | Releases stock reservations older than 15 minutes |
| Log Rotation | Daily | Automated (Render / Docker) | Ensures application log files do not exceed container disk quotas |
| Inventory Movement Audit | Weekly | Manual | Reviews high-delta stock adjustments to detect shrinkage |
| Security Patching | Monthly | Manual | Updates Python and npm packages via `pip audit` and `npm audit` |
