import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  Eye,
  Filter,
  CheckCircle,
  Package,
  Truck,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Clock,
  Store,
  MapPin,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Check,
  X,
  FileText,
  MessageCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Order, OrderStatus } from '../../types';
import { formatPrice } from '../../config/store';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/common/Button';

const SANCTIONED_REJECTION_REASONS = [
  'Product Out of Stock',
  'Unable to Fulfil Order',
  'Incorrect Product Information',
  'Customer Request',
  'Payment Verification Failed',
  'Delivery Address Unserviceable',
  'Damaged / Quality Issue',
  'Other'
];

const COMMON_CANCELLATION_REASONS = [
  'Customer requested cancellation',
  'Duplicate order placed by mistake',
  'Payment issues / unconfirmed',
  'Delivery address unserviceable',
  'Out of stock / unfulfillable',
  'Other'
];

const getWhatsAppUrl = (mobile?: string, orderNumber?: string, customerName?: string) => {
  if (!mobile) return '#';
  const digits = mobile.replace(/\D/g, '');
  const cleaned = digits.startsWith('0') ? digits.slice(1) : digits;
  const international = cleaned.startsWith('91') && cleaned.length > 10 ? cleaned : `91${cleaned.slice(-10)}`;
  const message = encodeURIComponent(
    `Hello ${customerName || 'Customer'}, this is SANJANA MOBILES regarding your order #${orderNumber || ''}. How can we assist you?`
  );
  return `https://wa.me/${international}?text=${message}`;
};

export const AdminOrdersPage: React.FC = () => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'today' | 'all' | 'unverified'>('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [quickFilter, setQuickFilter] = useState<
    'ALL' | 'DOORSTEP' | 'STORE_PICKUP' | 'ADMIN_DELIVERY' | 'PENDING_PAYMENT' | 'PAID' | 'PENDING_ORDERS' | 'DELIVERED'
  >('ALL');
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const { showToast } = useToast();

  // Inspect Modal State
  const [inspectOrder, setInspectOrder] = useState<Order | null>(null);

  // Reject Modal State
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);
  const [rejectionReason, setRejectionReason] = useState(SANCTIONED_REJECTION_REASONS[0]);
  const [customRejectionReason, setCustomRejectionReason] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');

  // Cancel Modal State
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState(COMMON_CANCELLATION_REASONS[0]);
  const [customCancellationReason, setCustomCancellationReason] = useState('');
  const [cancellationNotes, setCancellationNotes] = useState('');

  // Payment Verification Modal State
  const [verifyingOrder, setVerifyingOrder] = useState<Order | null>(null);
  const [verifyAction, setVerifyAction] = useState<'VERIFY' | 'REJECT'>('VERIFY');
  const [adminVerificationNotes, setAdminVerificationNotes] = useState('');

  const fetchOrders = async () => {
    const activeToken = token || 'mock-admin-token';
    setLoading(true);
    try {
      if (activeTab === 'today') {
        const data = await api.getAdminTodaysOrders(activeToken);
        setOrders(data);
      } else {
        const data = await api.getAdminOrders(activeToken, {
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: search || undefined
        });
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to load admin orders:', err);
      showToast('Could not load orders from server', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token, activeTab, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  // 1. Admin Verify or Reject UPI Payment
  const handleConfirmPaymentVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingOrder) return;

    setIsActionLoading(true);
    const activeToken = token || 'mock-admin-token';
    try {
      const res = await api.adminVerifyPayment(activeToken, {
        order_id: verifyingOrder.id,
        action: verifyAction,
        admin_notes: adminVerificationNotes
      });

      if (res.success) {
        showToast(res.message, 'success');
        setVerifyingOrder(null);
        setAdminVerificationNotes('');
        await fetchOrders();
      }
    } catch (err: any) {
      showToast(err.message || 'Payment verification failed', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 2. Accept Order (NEW -> ACCEPTED)
  const handleAcceptOrder = async (ord: Order) => {
    // For store pickup, order can be accepted to begin packing before in-store payment
    if (ord.delivery_method !== 'STORE_PICKUP' && ord.payment_status !== 'VERIFIED' && ord.payment_status !== 'PAID') {
      showToast('Cannot accept doorstep order before payment verification is complete.', 'error');
      setVerifyingOrder(ord);
      setVerifyAction('VERIFY');
      return;
    }

    setIsActionLoading(true);
    const activeToken = token || 'mock-admin-token';
    try {
      const updated = await api.adminAcceptOrder(activeToken, ord.id);
      setOrders((prev) => prev.map((o) => (o.id === ord.id ? updated : o)));
      if (inspectOrder?.id === ord.id) setInspectOrder(updated);
      showToast(`Order ${updated.order_number} approved and accepted for fulfillment`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to accept order', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 3. Store Pickup: Confirm Payment at Shop Counter
  const handleConfirmStorePayment = async (ord: Order) => {
    setIsActionLoading(true);
    const activeToken = token || 'mock-admin-token';
    try {
      const updated = await api.confirmStorePickupPayment(activeToken, ord.id, 'Payment confirmed at store counter');
      setOrders((prev) => prev.map((o) => (o.id === ord.id ? updated : o)));
      if (inspectOrder?.id === ord.id) setInspectOrder(updated);
      showToast(`Payment for ${ord.order_number} confirmed as PAID at store counter!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to confirm store payment', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 4. Store Pickup: Mark Order as Collected
  const handleMarkCollected = async (ord: Order) => {
    if (ord.payment_status !== 'PAID' && ord.payment_status !== 'VERIFIED') {
      showToast('Store pickup order must be marked as PAID before collecting.', 'error');
      return;
    }

    setIsActionLoading(true);
    const activeToken = token || 'mock-admin-token';
    try {
      const updated = await api.markOrderCollected(activeToken, ord.id, 'Handed over to customer at SANJANA MOBILES store');
      setOrders((prev) => prev.map((o) => (o.id === ord.id ? updated : o)));
      if (inspectOrder?.id === ord.id) setInspectOrder(updated);
      showToast(`Order ${ord.order_number} marked as COLLECTED!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to mark collected', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 5. Doorstep Delivery: Assign Admin to Deliver Personally ("Admin Will Deliver")
  const handleAssignAdminDelivery = async (ord: Order) => {
    setIsActionLoading(true);
    const activeToken = token || 'mock-admin-token';
    try {
      const updated = await api.assignAdminDelivery(activeToken, ord.id, 'Assigned to Admin for personal delivery');
      setOrders((prev) => prev.map((o) => (o.id === ord.id ? updated : o)));
      if (inspectOrder?.id === ord.id) setInspectOrder(updated);
      showToast(`Order ${ord.order_number} assigned: Admin will deliver personally!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to assign admin delivery', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 6. Doorstep Delivery: Update Admin Delivery Progress
  const handleUpdateAdminDelivery = async (ord: Order, status: 'OUT_FOR_DELIVERY' | 'DELIVERED') => {
    setIsActionLoading(true);
    const activeToken = token || 'mock-admin-token';
    try {
      const updated = await api.updateAdminDeliveryStatus(activeToken, ord.id, status, `Admin delivery: ${status}`);
      setOrders((prev) => prev.map((o) => (o.id === ord.id ? updated : o)));
      if (inspectOrder?.id === ord.id) setInspectOrder(updated);
      showToast(`Admin Delivery status updated: ${status}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update admin delivery status', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 7. Advance Status (ACCEPTED -> PACKING -> PACKED -> DELIVERY_PENDING)
  const handleAdvanceStatus = async (ord: Order, nextStatus: string, comment?: string) => {
    if (ord.delivery_method !== 'STORE_PICKUP' && ord.payment_status !== 'VERIFIED' && ord.payment_status !== 'PAID') {
      showToast('Cannot dispatch or process doorstep order before payment is verified.', 'error');
      return;
    }

    setIsActionLoading(true);
    const activeToken = token || 'mock-admin-token';
    try {
      const updated = await api.adminUpdateOrderStatus(activeToken, ord.id, nextStatus, comment);
      setOrders((prev) => prev.map((o) => (o.id === ord.id ? updated : o)));
      if (inspectOrder?.id === ord.id) setInspectOrder(updated);
      showToast(`Order status advanced to ${nextStatus}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Status transition rejected', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 8. Reject Order with Sanctioned Reason
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingOrder) return;

    setIsActionLoading(true);
    const activeToken = token || 'mock-admin-token';
    const finalReason = rejectionReason === 'Other' ? (customRejectionReason.trim() || 'Other reason') : rejectionReason;
    try {
      const res = await api.adminRejectOrder(activeToken, rejectingOrder.id, {
        rejection_reason: finalReason,
        rejection_notes: rejectionNotes,
        initiate_refund: false
      });

      if (res) {
        showToast(`Order ${rejectingOrder.order_number} rejected. Reserved stock returned to catalog.`, 'info');
        setRejectingOrder(null);
        setRejectionNotes('');
        setCustomRejectionReason('');
        await fetchOrders();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reject order', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 9. Cancel Order Workflow
  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingOrder) return;

    setIsActionLoading(true);
    const activeToken = token || 'mock-admin-token';
    const finalReason = cancellationReason === 'Other' ? (customCancellationReason.trim() || 'Other reason') : cancellationReason;
    try {
      const res = await api.adminCancelOrder(activeToken, cancellingOrder.id, {
        cancellation_reason: finalReason,
        cancellation_notes: cancellationNotes
      });

      if (res) {
        showToast(`Order ${cancellingOrder.order_number} cancelled. Reserved stock returned to catalog.`, 'info');
        setCancellingOrder(null);
        setCancellationNotes('');
        setCustomCancellationReason('');
        await fetchOrders();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel order', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const pendingVerificationOrders = orders.filter(
    (o) => o.payment_status === 'VERIFICATION_PENDING' || (o.payment_status === 'PENDING' && o.upi_utr)
  );

  // Apply Quick Filters
  let displayedOrders = activeTab === 'unverified' ? pendingVerificationOrders : orders;

  if (quickFilter === 'DOORSTEP') {
    displayedOrders = displayedOrders.filter((o) => o.delivery_method === 'HOME_DELIVERY');
  } else if (quickFilter === 'STORE_PICKUP') {
    displayedOrders = displayedOrders.filter((o) => o.delivery_method === 'STORE_PICKUP');
  } else if (quickFilter === 'ADMIN_DELIVERY') {
    displayedOrders = displayedOrders.filter((o) => o.internal_delivery_assignment === 'ADMIN');
  } else if (quickFilter === 'PENDING_PAYMENT') {
    displayedOrders = displayedOrders.filter((o) => o.payment_status === 'PENDING' || o.payment_status === 'VERIFICATION_PENDING');
  } else if (quickFilter === 'PAID') {
    displayedOrders = displayedOrders.filter((o) => o.payment_status === 'PAID' || o.payment_status === 'VERIFIED');
  } else if (quickFilter === 'PENDING_ORDERS') {
    displayedOrders = displayedOrders.filter((o) => ['NEW', 'ACCEPTED', 'PACKING', 'PACKED', 'DELIVERY_PENDING'].includes(o.status));
  } else if (quickFilter === 'DELIVERED') {
    displayedOrders = displayedOrders.filter((o) => ['DELIVERED', 'COLLECTED'].includes(o.status));
  }

  const pendingNewCount = orders.filter((o) => o.status === 'NEW').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-coral-400 block mb-1">
            Fulfillment & Payment Auditing
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
            Orders & Payment Management
          </h1>
          <p className="text-xs text-plum-300 mt-1">
            Independently audit customer UPI payments, manage dispatch pipelines, and control store fulfillment.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-plum-800 hover:bg-plum-700 text-ivory border border-plum-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Pipeline</span>
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-4 border-b border-plum-800/80 text-xs font-bold uppercase tracking-wider">
        <button
          onClick={() => setActiveTab('today')}
          className={`pb-3 flex items-center gap-2 transition-colors ${
            activeTab === 'today'
              ? 'border-b-2 border-coral-500 text-coral-400 font-extrabold'
              : 'text-plum-400 hover:text-white'
          }`}
        >
          <span>Today's Incoming</span>
          {pendingNewCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-coral-500 text-white text-[10px] flex items-center justify-center font-mono">
              {pendingNewCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('unverified')}
          className={`pb-3 flex items-center gap-2 transition-colors ${
            activeTab === 'unverified'
              ? 'border-b-2 border-blue-500 text-blue-400 font-extrabold'
              : 'text-plum-400 hover:text-white'
          }`}
        >
          <span>UPI Verification Queue</span>
          {pendingVerificationOrders.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-mono">
              {pendingVerificationOrders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 transition-colors ${
            activeTab === 'all'
              ? 'border-b-2 border-coral-500 text-coral-400 font-extrabold'
              : 'text-plum-400 hover:text-white'
          }`}
        >
          All Orders Archive
        </button>
      </div>

      {/* Search and Quick Filters Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 bg-plum-900/60 border border-plum-800 p-3 rounded-2xl w-full sm:max-w-md">
            <Search className="w-4 h-4 text-plum-400 ml-1" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order #, customer name, mobile, UTR..."
              className="bg-transparent text-xs text-ivory placeholder:text-plum-500 focus:outline-none w-full font-sans"
            />
          </form>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Filter className="w-4 h-4 text-plum-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-plum-900 border border-plum-800 rounded-xl px-3 py-2 text-ivory focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">NEW</option>
              <option value="ACCEPTED">ACCEPTED</option>
              <option value="PACKING">PACKING</option>
              <option value="PACKED">PACKED</option>
              <option value="DELIVERY_PENDING">DELIVERY_PENDING</option>
              <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="READY_FOR_PICKUP">READY_FOR_PICKUP</option>
              <option value="COLLECTED">COLLECTED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Badges */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-plum-400 text-[11px] font-semibold whitespace-nowrap mr-1">Quick Filters:</span>
          {[
            { id: 'ALL', label: 'All Orders' },
            { id: 'DOORSTEP', label: 'Doorstep Delivery' },
            { id: 'STORE_PICKUP', label: 'Store Pickup' },
            { id: 'ADMIN_DELIVERY', label: 'Admin Deliveries' },
            { id: 'PENDING_PAYMENT', label: 'Pending Payment' },
            { id: 'PAID', label: 'Paid Orders' },
            { id: 'PENDING_ORDERS', label: 'In-Progress / Pending' },
            { id: 'DELIVERED', label: 'Delivered / Collected' }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setQuickFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all text-[11px] ${
                quickFilter === f.id
                  ? 'bg-coral-500 text-white font-bold shadow-sm'
                  : 'bg-plum-900/80 hover:bg-plum-800 text-plum-300 border border-plum-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-plum-900/60 border border-plum-800/80 rounded-3xl p-6 shadow-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-plum-400 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 animate-spin text-coral-400" /> Loading orders...
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="py-16 text-center text-xs text-plum-400 space-y-2">
            <ShoppingBag className="w-8 h-8 text-plum-600 mx-auto" />
            <p>No orders located for this view or filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-plum-800 text-plum-400 uppercase font-semibold tracking-wider">
                  <th className="pb-3 px-3">Order Number</th>
                  <th className="pb-3 px-3">Customer</th>
                  <th className="pb-3 px-3">Products Ordered</th>
                  <th className="pb-3 px-3">Delivery Method</th>
                  <th className="pb-3 px-3">Total (₹)</th>
                  <th className="pb-3 px-3">Payment Info</th>
                  <th className="pb-3 px-3">Order Status</th>
                  <th className="pb-3 px-3 text-right">Fulfillment & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-plum-800/60">
                {displayedOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-plum-800/30 transition-colors">
                    {/* Order Number */}
                    <td className="py-4 px-3">
                      <span className="font-mono font-bold text-white block">{ord.order_number}</span>
                      <span className="text-[10px] text-plum-400">
                        {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* Customer */}
                    <td className="py-4 px-3">
                      <p className="font-semibold text-white">{ord.customer_name || 'Customer'}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-plum-400 font-mono">
                          {ord.customer_mobile ? `+91 ${ord.customer_mobile}` : ord.customer_email}
                        </span>
                        {ord.customer_mobile && (
                          <a
                            href={getWhatsAppUrl(ord.customer_mobile, ord.order_number, ord.customer_name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 p-0.5"
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Products Ordered */}
                    <td className="py-4 px-3 max-w-[200px]">
                      {ord.items && ord.items.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg bg-plum-950 border border-plum-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {ord.items[0].image_url ? (
                              <img src={ord.items[0].image_url} alt={ord.items[0].title} className="w-full h-full object-cover" />
                            ) : (
                              <Smartphone className="w-4 h-4 text-plum-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate text-xs" title={ord.items[0].title}>
                              {ord.items[0].title}
                            </p>
                            <p className="text-[10px] text-plum-400">
                              Qty: <strong className="text-coral-400">{ord.items[0].quantity}</strong> · {formatPrice(ord.items[0].price_snapshot)}
                              {ord.items.length > 1 && (
                                <span className="ml-1 text-emerald-400 font-bold">(+{ord.items.length - 1} more)</span>
                              )}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-plum-500 italic">
                          {ord.items_count > 0 ? `${ord.items_count} items (legacy)` : 'No items recorded'}
                        </span>
                      )}
                    </td>

                    {/* Delivery Method */}
                    <td className="py-4 px-3">
                      {ord.delivery_method === 'STORE_PICKUP' ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-900/60 text-purple-300 border border-purple-700/60">
                            <Store className="w-3 h-3 text-purple-400" /> Store Pickup
                          </span>
                          <span className="text-[10px] text-amber-300 block font-medium">Pay at Store</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-900/60 text-blue-300 border border-blue-700/60">
                            <MapPin className="w-3 h-3 text-blue-400" /> Doorstep Delivery
                          </span>
                          {ord.internal_delivery_assignment === 'ADMIN' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 block w-fit">
                              <Truck className="w-2.5 h-2.5 text-amber-400" /> Admin Will Deliver
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Total */}
                    <td className="py-4 px-3 font-display font-bold text-white">
                      {formatPrice(ord.total_amount)}
                    </td>

                    {/* Payment Info */}
                    <td className="py-4 px-3">
                      <div className="space-y-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block ${
                          ord.payment_status === 'VERIFIED' || ord.payment_status === 'PAID'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : ord.payment_status === 'VERIFICATION_PENDING'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : ord.payment_status === 'REJECTED'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {ord.payment_status === 'VERIFIED' ? 'PAID (VERIFIED)' : ord.payment_status}
                        </span>
                        {ord.upi_utr && (
                          <span className="font-mono text-[10px] text-amber-300 block truncate max-w-[120px]" title={ord.upi_utr}>
                            UTR: {ord.upi_utr}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Order Status */}
                    <td className="py-4 px-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        ord.status === 'COLLECTED' || ord.status === 'DELIVERED'
                          ? 'text-emerald-400 bg-emerald-950/40'
                          : ord.status === 'OUT_FOR_DELIVERY' || ord.status === 'READY_FOR_PICKUP'
                          ? 'text-cyan-400 bg-cyan-950/40'
                          : 'text-plum-200'
                      }`}>
                        {ord.status}
                      </span>
                    </td>

                    {/* Verification & Workflow Actions */}
                    <td className="py-4 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Store Pickup: Confirm Store Payment */}
                        {ord.delivery_method === 'STORE_PICKUP' && ord.payment_status !== 'PAID' && ord.payment_status !== 'VERIFIED' && (
                          <button
                            onClick={() => handleConfirmStorePayment(ord)}
                            disabled={isActionLoading}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm"
                            title="Confirm cash/UPI payment received at store counter"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Confirm Store Pay
                          </button>
                        )}

                        {/* Store Pickup: Mark Collected */}
                        {ord.delivery_method === 'STORE_PICKUP' && (ord.payment_status === 'PAID' || ord.payment_status === 'VERIFIED') && ord.status !== 'COLLECTED' && (
                          <button
                            onClick={() => handleMarkCollected(ord)}
                            disabled={isActionLoading}
                            className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm"
                            title="Customer has physically collected the parcel"
                          >
                            <Package className="w-3.5 h-3.5" /> Mark Collected
                          </button>
                        )}

                        {/* Doorstep Delivery: Assign Admin to Deliver Personally */}
                        {ord.delivery_method === 'HOME_DELIVERY' && ord.internal_delivery_assignment !== 'ADMIN' && ord.status !== 'DELIVERED' && ord.status !== 'CANCELLED' && (
                          <button
                            onClick={() => handleAssignAdminDelivery(ord)}
                            disabled={isActionLoading}
                            className="px-2 py-1 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm"
                            title="Assign admin to personally deliver this order"
                          >
                            <Truck className="w-3 h-3" /> Admin Deliver
                          </button>
                        )}

                        {/* Doorstep Delivery: Admin Delivery Lifecycle */}
                        {ord.delivery_method === 'HOME_DELIVERY' && ord.internal_delivery_assignment === 'ADMIN' && (
                          <>
                            {(!ord.admin_delivery_status || ord.admin_delivery_status === 'ASSIGNED') && (
                              <button
                                onClick={() => handleUpdateAdminDelivery(ord, 'OUT_FOR_DELIVERY')}
                                disabled={isActionLoading}
                                className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm"
                                title="Mark as out for personal delivery"
                              >
                                <Truck className="w-3 h-3" /> Out for Delivery
                              </button>
                            )}
                            {ord.admin_delivery_status === 'OUT_FOR_DELIVERY' && (
                              <button
                                onClick={() => handleUpdateAdminDelivery(ord, 'DELIVERED')}
                                disabled={isActionLoading}
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm"
                                title="Mark as delivered by admin"
                              >
                                <CheckCircle className="w-3 h-3" /> Mark Delivered
                              </button>
                            )}
                          </>
                        )}

                        {/* UPI Payment Verification buttons */}
                        {ord.payment_status === 'VERIFICATION_PENDING' && (
                          <button
                            onClick={() => {
                              setVerifyingOrder(ord);
                              setVerifyAction('VERIFY');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm"
                            title="Verify bank receipt"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" /> Verify Payment
                          </button>
                        )}

                        {/* Order acceptance */}
                        {ord.status === 'NEW' && (
                          <>
                            <button
                              onClick={() => handleAcceptOrder(ord)}
                              disabled={isActionLoading}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors ${
                                ord.delivery_method === 'STORE_PICKUP' || ord.payment_status === 'VERIFIED' || ord.payment_status === 'PAID'
                                  ? 'bg-teal-600 hover:bg-teal-500 text-white'
                                  : 'bg-plum-800 text-plum-400 cursor-not-allowed opacity-60'
                              }`}
                              title={ord.delivery_method === 'STORE_PICKUP' || ord.payment_status === 'VERIFIED' ? 'Accept Order' : 'Requires Payment Verification'}
                            >
                              <CheckCircle className="w-3 h-3" /> Accept
                            </button>
                            <button
                              onClick={() => setRejectingOrder(ord)}
                              disabled={isActionLoading}
                              className="px-2 py-1 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-200 font-bold text-[11px] flex items-center gap-1 border border-red-700/50"
                            >
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                          </>
                        )}

                        {ord.status === 'ACCEPTED' && (
                          <button
                            onClick={() => handleAdvanceStatus(ord, 'PACKING')}
                            disabled={isActionLoading}
                            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] flex items-center gap-1"
                          >
                            <Package className="w-3 h-3" /> Pack
                          </button>
                        )}

                        {ord.status === 'PACKING' && (
                          <button
                            onClick={() => handleAdvanceStatus(ord, 'PACKED')}
                            disabled={isActionLoading}
                            className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-[11px] flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" /> Packed
                          </button>
                        )}

                        {/* Cancel button for eligible unfulfilled orders */}
                        {ord.status !== 'DELIVERED' && ord.status !== 'COLLECTED' && ord.status !== 'REJECTED' && ord.status !== 'CANCELLED' && (
                          <button
                            onClick={() => setCancellingOrder(ord)}
                            disabled={isActionLoading}
                            className="px-2 py-1 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 font-bold text-[11px] flex items-center gap-1 border border-red-800/50"
                            title="Cancel this order"
                          >
                            <XCircle className="w-3 h-3" /> Cancel
                          </button>
                        )}

                        {/* View & Print Invoice button */}
                        <Link
                          to={`/admin/orders/${ord.order_number}/invoice`}
                          target="_blank"
                          className="p-1.5 rounded-lg bg-plum-800 hover:bg-plum-700 text-coral-400 hover:text-coral-300 transition-colors"
                          title="View & Print Showroom Tax Invoice"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </Link>

                        {/* Inspect detail modal button */}
                        <button
                          onClick={() => setInspectOrder(ord)}
                          className="p-1.5 rounded-lg bg-plum-800 hover:bg-plum-700 text-plum-200 transition-colors"
                          title="View order details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Payment Verification Modal */}
      {verifyingOrder && (
        <div className="fixed inset-0 z-50 bg-plum-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-plum-900 border border-plum-700 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-plum-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-display font-bold text-lg">Verify UPI Payment</h3>
              </div>
              <button
                onClick={() => setVerifyingOrder(null)}
                className="text-plum-400 hover:text-white font-bold text-lg"
              >
                ×
              </button>
            </div>

            <div className="bg-plum-950/70 p-4 rounded-2xl border border-plum-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-plum-400">Order Number:</span>
                <span className="font-mono font-bold text-white">{verifyingOrder.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-plum-400">Customer Name:</span>
                <span className="font-semibold text-white">{verifyingOrder.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-plum-400">Order Amount:</span>
                <span className="font-bold text-emerald-400 text-sm">{formatPrice(verifyingOrder.total_amount)}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-plum-800/60">
                <span className="text-plum-400">Submitted UTR:</span>
                <span className="font-mono font-bold text-amber-300 bg-amber-950 px-2 py-0.5 rounded text-xs">
                  {verifyingOrder.upi_utr || 'Not submitted'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-200">
              <strong>Verification Requirement:</strong> Please check your shop's Google Pay / bank account statement to independently confirm that ₹{verifyingOrder.total_amount.toFixed(2)} was received with UTR: {verifyingOrder.upi_utr}.
            </div>

            <form onSubmit={handleConfirmPaymentVerification} className="space-y-4 text-xs">
              <div>
                <label className="block text-plum-300 font-bold mb-1">Verification Decision</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVerifyAction('VERIFY')}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
                      verifyAction === 'VERIFY'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-plum-950 text-plum-300 border-plum-700'
                    }`}
                  >
                    <Check className="w-4 h-4" /> Verify & Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerifyAction('REJECT')}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
                      verifyAction === 'REJECT'
                        ? 'bg-red-600 text-white border-red-500'
                        : 'bg-plum-950 text-plum-300 border-plum-700'
                    }`}
                  >
                    <X className="w-4 h-4" /> Reject Payment
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-plum-300 font-bold mb-1">Audit Notes / Internal Remark</label>
                <input
                  type="text"
                  value={adminVerificationNotes}
                  onChange={(e) => setAdminVerificationNotes(e.target.value)}
                  placeholder="e.g. Verified in SBI statement ref 408212345678"
                  className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-plum-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVerifyingOrder(null)}
                  disabled={isActionLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isActionLoading}
                  className={verifyAction === 'VERIFY' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}
                >
                  {isActionLoading ? 'Processing...' : `Confirm ${verifyAction === 'VERIFY' ? 'Verification' : 'Rejection'}`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Order Modal */}
      {inspectOrder && (
        <div className="fixed inset-0 z-50 bg-plum-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-plum-900 border border-plum-700 rounded-3xl max-w-2xl w-full p-6 text-white shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-plum-800 pb-3">
              <div>
                <h3 className="font-display font-bold text-lg">
                  Order Details: {inspectOrder.order_number}
                </h3>
                <span className="text-xs text-plum-400">
                  Created at {new Date(inspectOrder.created_at).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setInspectOrder(null)}
                className="text-plum-400 hover:text-white font-bold text-lg"
              >
                ×
              </button>
            </div>

            {/* Rejection / Cancellation Status Alert Banner */}
            {inspectOrder.status === 'REJECTED' && (
              <div className="p-3.5 rounded-2xl bg-red-950/80 border border-red-700/60 text-xs text-red-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-red-300">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span>Order Rejected</span>
                </div>
                <p><strong>Reason:</strong> {inspectOrder.rejection_reason || 'Not specified'}</p>
                {inspectOrder.rejection_notes && <p><strong>Notes:</strong> {inspectOrder.rejection_notes}</p>}
                <p className="text-[11px] text-red-300/80">
                  {inspectOrder.rejected_at && `At: ${new Date(inspectOrder.rejected_at).toLocaleString()}`}
                  {inspectOrder.rejected_by && ` • By: ${inspectOrder.rejected_by}`}
                </p>
              </div>
            )}
            {inspectOrder.status === 'CANCELLED' && (
              <div className="p-3.5 rounded-2xl bg-amber-950/80 border border-amber-700/60 text-xs text-amber-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <XCircle className="w-4 h-4 text-amber-400" />
                  <span>Order Cancelled</span>
                </div>
                <p><strong>Reason:</strong> {inspectOrder.cancellation_reason || 'Not specified'}</p>
                {inspectOrder.cancellation_notes && <p><strong>Notes:</strong> {inspectOrder.cancellation_notes}</p>}
                <p className="text-[11px] text-amber-300/80">
                  {inspectOrder.cancelled_at && `At: ${new Date(inspectOrder.cancelled_at).toLocaleString()}`}
                  {inspectOrder.cancelled_by && ` • By: ${inspectOrder.cancelled_by}`}
                </p>
              </div>
            )}

            {/* Products Ordered Breakdown */}
            <div className="bg-plum-950/60 p-4 rounded-2xl border border-plum-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-plum-400 font-bold block uppercase text-[10px]">
                  Products Ordered ({inspectOrder.items?.length || 0})
                </span>
              </div>
              {inspectOrder.items && inspectOrder.items.length > 0 ? (
                <div className="space-y-2">
                  {inspectOrder.items.map((item, idx) => (
                    <div key={item.id || idx} className="flex items-center gap-3 p-3 rounded-xl bg-plum-900/60 border border-plum-800/70">
                      <div className="w-12 h-12 rounded-lg bg-plum-950 border border-plum-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <Smartphone className="w-5 h-5 text-plum-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-xs">
                        <p className="font-bold text-white truncate">{item.title}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-plum-300 mt-1">
                          {item.sku && <span>SKU: <span className="font-mono text-plum-200">{item.sku}</span></span>}
                          {item.variant && <span>Variant: <span className="text-coral-300 font-medium">{item.variant}</span></span>}
                          <span>Unit Price: <span className="text-white font-medium">{formatPrice(item.price_snapshot)}</span></span>
                          <span>Quantity: <strong className="text-coral-400 font-bold">{item.quantity}</strong></span>
                        </div>
                      </div>
                      <div className="text-right text-xs font-bold text-white flex-shrink-0">
                        {formatPrice(item.subtotal || item.price_snapshot * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-plum-900/40 border border-plum-800/50 text-xs text-plum-400 italic">
                  {inspectOrder.items_count > 0 ? `${inspectOrder.items_count} items (legacy order snapshot not stored)` : 'No items recorded'}
                </div>
              )}
            </div>

            {/* Customer & Delivery Method info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-plum-950/60 p-4 rounded-2xl border border-plum-800 text-xs">
              <div className="space-y-1">
                <span className="text-plum-400 font-bold block uppercase text-[10px]">Customer Details</span>
                <p className="font-semibold text-white">{inspectOrder.customer_name}</p>
                <p className="text-plum-300">{inspectOrder.customer_email}</p>
                {inspectOrder.customer_mobile && (
                  <p className="text-plum-300 font-mono">+91 {inspectOrder.customer_mobile}</p>
                )}
                {inspectOrder.customer_mobile && (
                  <div className="pt-2">
                    <a
                      href={getWhatsAppUrl(inspectOrder.customer_mobile, inspectOrder.order_number, inspectOrder.customer_name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-sm"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Chat on WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-plum-400 font-bold block uppercase text-[10px]">Fulfillment Destination</span>
                {inspectOrder.delivery_method === 'HOME_DELIVERY' ? (
                  <div>
                    <p className="text-plum-200 font-semibold">Home Delivery</p>
                    <p className="text-plum-300">
                      {inspectOrder.delivery_address?.address_line1}, {inspectOrder.delivery_address?.city}
                    </p>
                    <p className="text-plum-300 font-mono">
                      PIN: {inspectOrder.delivery_address?.pin_code || inspectOrder.delivery_address?.postal_code}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-emerald-300 font-semibold">Store Pickup</p>
                    <p className="text-plum-300">
                      Contact: {inspectOrder.pickup_details?.pickup_person_name} (+91 {inspectOrder.pickup_details?.pickup_person_phone})
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Assignment & Fulfillment Controls */}
            <div className="bg-plum-950/60 p-4 rounded-2xl border border-plum-800 space-y-3 text-xs">
              <span className="text-plum-400 font-bold block uppercase text-[10px]">Fulfillment & Internal Delivery Assignment</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-plum-400 block text-[11px]">Delivery Type</span>
                  <span className="font-semibold text-white">
                    {inspectOrder.delivery_method === 'STORE_PICKUP' ? 'Direct Store Pickup' : 'Doorstep Delivery'}
                  </span>
                </div>
                <div>
                  <span className="text-plum-400 block text-[11px]">Internal Assignment</span>
                  <span className="font-semibold text-amber-300">
                    {inspectOrder.internal_delivery_assignment === 'ADMIN' ? 'Admin Will Deliver' : 'Standard Store Fulfillment'}
                  </span>
                </div>
                {inspectOrder.assigned_admin_name && (
                  <div>
                    <span className="text-plum-400 block text-[11px]">Assigned Admin</span>
                    <span className="text-plum-200">{inspectOrder.assigned_admin_name}</span>
                  </div>
                )}
                {inspectOrder.admin_delivery_status && (
                  <div>
                    <span className="text-plum-400 block text-[11px]">Admin Delivery Status</span>
                    <span className="font-bold text-cyan-400 uppercase">{inspectOrder.admin_delivery_status}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons inside Modal */}
              <div className="flex items-center gap-2 pt-2 border-t border-plum-800/60 flex-wrap">
                {inspectOrder.delivery_method === 'STORE_PICKUP' && (
                  <>
                    {inspectOrder.payment_status !== 'PAID' && inspectOrder.payment_status !== 'VERIFIED' && (
                      <button
                        onClick={() => handleConfirmStorePayment(inspectOrder)}
                        disabled={isActionLoading}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                      >
                        <CheckCircle className="w-4 h-4" /> Confirm In-Store Payment
                      </button>
                    )}
                    {(inspectOrder.payment_status === 'PAID' || inspectOrder.payment_status === 'VERIFIED') && inspectOrder.status !== 'COLLECTED' && (
                      <button
                        onClick={() => handleMarkCollected(inspectOrder)}
                        disabled={isActionLoading}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                      >
                        <Package className="w-4 h-4" /> Mark as Collected
                      </button>
                    )}
                  </>
                )}

                {inspectOrder.delivery_method === 'HOME_DELIVERY' && (
                  <>
                    {inspectOrder.internal_delivery_assignment !== 'ADMIN' && inspectOrder.status !== 'DELIVERED' && (
                      <button
                        onClick={() => handleAssignAdminDelivery(inspectOrder)}
                        disabled={isActionLoading}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                      >
                        <Truck className="w-4 h-4" /> Assign: Admin Will Deliver
                      </button>
                    )}
                    {inspectOrder.internal_delivery_assignment === 'ADMIN' && (
                      <>
                        {(!inspectOrder.admin_delivery_status || inspectOrder.admin_delivery_status === 'ASSIGNED') && (
                          <button
                            onClick={() => handleUpdateAdminDelivery(inspectOrder, 'OUT_FOR_DELIVERY')}
                            disabled={isActionLoading}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                          >
                            <Truck className="w-4 h-4" /> Mark Out for Delivery
                          </button>
                        )}
                        {inspectOrder.admin_delivery_status === 'OUT_FOR_DELIVERY' && (
                          <button
                            onClick={() => handleUpdateAdminDelivery(inspectOrder, 'DELIVERED')}
                            disabled={isActionLoading}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle className="w-4 h-4" /> Mark Delivered
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Payment & UTR Audit Box */}
            <div className="bg-plum-950/60 p-4 rounded-2xl border border-plum-800 space-y-2 text-xs">
              <span className="text-plum-400 font-bold block uppercase text-[10px]">Payment Audit Details</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-plum-400 block text-[11px]">Payment Mode</span>
                  <span className="font-semibold text-white">Direct UPI</span>
                </div>
                <div>
                  <span className="text-plum-400 block text-[11px]">Verification Status</span>
                  <span className="font-bold text-emerald-400 uppercase">{inspectOrder.payment_status}</span>
                </div>
                <div>
                  <span className="text-plum-400 block text-[11px]">Submitted UTR</span>
                  <span className="font-mono font-bold text-amber-300">{inspectOrder.upi_utr || 'None'}</span>
                </div>
                <div>
                  <span className="text-plum-400 block text-[11px]">Submission Time</span>
                  <span className="text-plum-300">
                    {inspectOrder.upi_submission_time ? new Date(inspectOrder.upi_submission_time).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>
              {inspectOrder.admin_verification_notes && (
                <div className="pt-2 border-t border-plum-800 text-[11px] text-plum-300">
                  <strong>Verification Notes:</strong> {inspectOrder.admin_verification_notes}
                </div>
              )}
            </div>

            {/* Pricing Summary */}
            <div className="bg-plum-950/60 p-4 rounded-2xl border border-plum-800 space-y-1.5 text-xs text-plum-300">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPrice(inspectOrder.subtotal)}</span>
              </div>
              {inspectOrder.discount_amount > 0 && (
                <div className="flex justify-between text-coral-400">
                  <span>Discount</span>
                  <span>-{formatPrice(inspectOrder.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Delivery Charge</span>
                <span>{inspectOrder.delivery_charge === 0 ? 'Free' : formatPrice(inspectOrder.delivery_charge)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-white pt-2 border-t border-plum-800">
                <span>Total Amount</span>
                <span className="font-display font-extrabold text-base">{formatPrice(inspectOrder.total_amount)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-plum-800">
              <div className="flex items-center gap-2">
                {inspectOrder.status === 'NEW' && (
                  <button
                    onClick={() => {
                      const ord = inspectOrder;
                      setInspectOrder(null);
                      setRejectingOrder(ord);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-red-900/60 hover:bg-red-800 text-red-200 font-bold text-xs flex items-center gap-1.5 border border-red-700/50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject Order
                  </button>
                )}
                {inspectOrder.status !== 'DELIVERED' && inspectOrder.status !== 'COLLECTED' && inspectOrder.status !== 'REJECTED' && inspectOrder.status !== 'CANCELLED' && (
                  <button
                    onClick={() => {
                      const ord = inspectOrder;
                      setInspectOrder(null);
                      setCancellingOrder(ord);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-300 font-bold text-xs flex items-center gap-1.5 border border-red-800/60"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Cancel Order
                  </button>
                )}
                <Link
                  to={`/admin/orders/${inspectOrder.order_number}/invoice`}
                  target="_blank"
                  className="px-3 py-1.5 rounded-xl bg-coral-600 hover:bg-coral-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5" /> View & Print Invoice
                </Link>
              </div>
              <Button variant="outline" size="sm" onClick={() => setInspectOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Order Modal */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 bg-plum-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-plum-900 border border-plum-700 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-red-400 font-bold">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-display text-lg">Reject Order {rejectingOrder.order_number}</h3>
            </div>

            <p className="text-xs text-plum-300">
              Rejecting this order will cancel fulfillment and restore all reserved stock back into active mobile inventory.
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-4 text-xs">
              <div>
                <label className="block text-plum-300 font-bold mb-1">Sanctioned Rejection Reason *</label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none"
                >
                  {SANCTIONED_REJECTION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {rejectionReason === 'Other' && (
                <div>
                  <label className="block text-plum-300 font-bold mb-1">Custom Rejection Reason *</label>
                  <input
                    type="text"
                    required
                    value={customRejectionReason}
                    onChange={(e) => setCustomRejectionReason(e.target.value)}
                    placeholder="Enter specific rejection reason..."
                    className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-plum-300 font-bold mb-1">Administrative Notes</label>
                <textarea
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  placeholder="e.g. Bank statement showed no matching deposit for the entered UTR."
                  rows={3}
                  className="w-full bg-plum-950 border border-plum-700 rounded-xl p-3 text-ivory focus:outline-none placeholder:text-plum-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-plum-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectingOrder(null)}
                  disabled={isActionLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  disabled={isActionLoading}
                >
                  {isActionLoading ? 'Processing...' : 'Confirm Rejection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 bg-plum-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-plum-900 border border-plum-700 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-red-400 font-bold">
              <XCircle className="w-5 h-5" />
              <h3 className="font-display text-lg">Cancel Order {cancellingOrder.order_number}</h3>
            </div>

            <p className="text-xs text-plum-300">
              Cancelling this order will abort fulfillment and return allocated inventory back to the store.
              {cancellingOrder.payment_status === 'PAID' || cancellingOrder.payment_status === 'VERIFIED' ? (
                <span className="block mt-1 text-amber-300 font-medium">
                  Note: This order has verified payment ({formatPrice(cancellingOrder.total_amount)}). Payment record will be preserved for financial refund audit.
                </span>
              ) : null}
            </p>

            <form onSubmit={handleConfirmCancel} className="space-y-4 text-xs">
              <div>
                <label className="block text-plum-300 font-bold mb-1">Cancellation Reason *</label>
                <select
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none"
                >
                  {COMMON_CANCELLATION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {cancellationReason === 'Other' && (
                <div>
                  <label className="block text-plum-300 font-bold mb-1">Custom Cancellation Reason *</label>
                  <input
                    type="text"
                    required
                    value={customCancellationReason}
                    onChange={(e) => setCustomCancellationReason(e.target.value)}
                    placeholder="Enter specific cancellation reason..."
                    className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-plum-300 font-bold mb-1">Administrative Notes</label>
                <textarea
                  value={cancellationNotes}
                  onChange={(e) => setCancellationNotes(e.target.value)}
                  placeholder="e.g. Customer called store requesting cancellation before shipment."
                  rows={3}
                  className="w-full bg-plum-950 border border-plum-700 rounded-xl p-3 text-ivory focus:outline-none placeholder:text-plum-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-plum-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCancellingOrder(null)}
                  disabled={isActionLoading}
                >
                  Close
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  disabled={isActionLoading}
                >
                  {isActionLoading ? 'Processing...' : 'Confirm Cancellation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};