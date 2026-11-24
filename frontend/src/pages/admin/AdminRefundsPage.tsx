import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RotateCcw,
  Search,
  Plus,
  ShieldCheck,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { RefundRecord, Order } from '../../types';
import { formatPrice } from '../../config/store';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/common/Button';

export const AdminRefundsPage: React.FC = () => {
  const { token } = useAuth();
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  // Initiate Refund Form
  const [formOrderId, setFormOrderId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formReason, setFormReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    const activeToken = token || 'mock-admin-token';
    try {
      const [refList, ordList] = await Promise.all([
        api.adminGetRefunds(activeToken).catch(() => []),
        api.getAdminOrders(activeToken).catch(() => [])
      ]);
      setRefunds(refList);
      setOrders(ordList);
      if (ordList.length > 0 && !formOrderId) {
        setFormOrderId(ordList[0].id);
      }
    } catch (e) {
      console.error('Failed to load refund data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleInitiateRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOrderId) {
      showToast('Please select an order to refund', 'error');
      return;
    }
    if (!formReason.trim()) {
      showToast('Please provide a reason for the refund', 'error');
      return;
    }

    setSubmitting(true);
    const activeToken = token || 'mock-admin-token';

    try {
      const amountVal = formAmount.trim() ? parseFloat(formAmount) : undefined;
      const result = await api.adminInitiateRefund(activeToken, {
        order_id: formOrderId,
        amount: amountVal,
        reason: formReason
      });

      showToast(`Refund of ${formatPrice(result.amount)} successfully processed via Razorpay`, 'success');
      setShowModal(false);
      setFormAmount('');
      setFormReason('');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Refund processing failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRefunds = refunds.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.order_number?.toLowerCase().includes(q) ||
      r.razorpay_payment_id?.toLowerCase().includes(q) ||
      (r.razorpay_refund_id && r.razorpay_refund_id.toLowerCase().includes(q)) ||
      r.reason.toLowerCase().includes(q)
    );
  });

  const selectedOrder = orders.find((o) => o.id === formOrderId);
  const orderRefundableRemaining = selectedOrder
    ? Math.max(0, (selectedOrder.total_amount || 0) - (selectedOrder.refunded_amount || 0))
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-plum-400 mb-1">
            <Link to="/admin/orders" className="hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Orders
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
            Refund Management & Razorpay Audit
          </h1>
          <p className="text-xs text-plum-300 mt-1">
            Initiate full or partial refunds, prevent duplicate disbursements, and inspect Razorpay payout IDs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowModal(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Initiate Refund
          </Button>
          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-plum-800 hover:bg-plum-700 text-plum-200 transition-colors border border-plum-700"
            title="Reload registry"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-plum-900/60 border border-plum-800 p-3 rounded-2xl w-full sm:max-w-md">
        <Search className="w-4 h-4 text-plum-400 ml-1" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order #, payment ID, refund ID, or reason..."
          className="bg-transparent text-xs text-ivory placeholder:text-plum-500 focus:outline-none w-full"
        />
      </div>

      {/* Refunds Table */}
      <div className="bg-plum-900/60 border border-plum-800/80 rounded-3xl p-6 shadow-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-plum-400 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 animate-spin text-coral-400" /> Loading refund audit records...
          </div>
        ) : filteredRefunds.length === 0 ? (
          <div className="py-16 text-center text-xs text-plum-400 space-y-2">
            <RotateCcw className="w-8 h-8 text-plum-600 mx-auto" />
            <p>No refund transactions recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-plum-800 text-plum-400 uppercase font-semibold tracking-wider">
                  <th className="pb-3 px-3">Order Number</th>
                  <th className="pb-3 px-3">Refund Amount (₹)</th>
                  <th className="pb-3 px-3">Razorpay References</th>
                  <th className="pb-3 px-3">Reason</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-plum-800/60">
                {filteredRefunds.map((ref) => (
                  <tr key={ref.id} className="hover:bg-plum-800/30 transition-colors">
                    <td className="py-4 px-3 font-semibold text-white font-mono">
                      {ref.order_number}
                    </td>

                    <td className="py-4 px-3 font-display font-bold text-white text-sm">
                      {formatPrice(ref.amount)}
                    </td>

                    <td className="py-4 px-3 font-mono text-[11px] text-plum-300">
                      <div>Pay ID: {ref.razorpay_payment_id}</div>
                      {ref.razorpay_refund_id && (
                        <div className="text-coral-400">Ref ID: {ref.razorpay_refund_id}</div>
                      )}
                    </td>

                    <td className="py-4 px-3 text-plum-200 max-w-xs">
                      {ref.reason}
                    </td>

                    <td className="py-4 px-3">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {ref.status}
                      </span>
                    </td>

                    <td className="py-4 px-3 text-right text-plum-400 text-[11px]">
                      {new Date(ref.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Initiate Refund Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-plum-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-plum-900 border border-plum-700 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-plum-800 pb-3">
              <h3 className="font-display font-bold text-lg">Initiate Order Refund</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-plum-400 hover:text-white font-bold text-lg"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleInitiateRefund} className="space-y-4 text-xs">
              <div>
                <label className="block text-plum-300 font-bold mb-1">Select Paid Order *</label>
                <select
                  value={formOrderId}
                  onChange={(e) => setFormOrderId(e.target.value)}
                  className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none"
                >
                  <option value="">-- Choose an order --</option>
                  {orders
                    .filter((o) => o.payment_status === 'PAID' || o.payment_status === 'PARTIALLY_REFUNDED')
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.order_number} — {formatPrice(o.total_amount)} ({o.customer_name})
                      </option>
                    ))}
                </select>
              </div>

              {selectedOrder && (
                <div className="bg-plum-950/70 p-3 rounded-2xl border border-plum-800 space-y-1 text-[11px]">
                  <div className="flex justify-between text-plum-300">
                    <span>Order Total:</span>
                    <span className="font-bold text-white">{formatPrice(selectedOrder.total_amount)}</span>
                  </div>
                  <div className="flex justify-between text-plum-300">
                    <span>Already Refunded:</span>
                    <span className="text-coral-400">{formatPrice(selectedOrder.refunded_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-plum-300 font-bold border-t border-plum-800 pt-1">
                    <span>Remaining Refundable:</span>
                    <span className="text-emerald-400">{formatPrice(orderRefundableRemaining)}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-plum-300 font-bold mb-1">
                  Refund Amount in INR (Leave empty for full balance)
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={orderRefundableRemaining || undefined}
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder={orderRefundableRemaining ? `Max: ₹${orderRefundableRemaining}` : 'Full balance'}
                  className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-plum-300 font-bold mb-1">Reason for Refund *</label>
                <textarea
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="e.g. Client requested cancellation before dispatch; or defective item return."
                  rows={3}
                  className="w-full bg-plum-950 border border-plum-700 rounded-xl p-3 text-ivory focus:outline-none placeholder:text-plum-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-plum-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting || (orderRefundableRemaining <= 0 && Boolean(selectedOrder))}
                >
                  {submitting ? 'Processing Gateway Refund...' : 'Confirm Refund'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
