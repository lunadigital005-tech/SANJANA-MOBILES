import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Store,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  XCircle,
  Receipt,
  Coins,
  Sparkles,
  Navigation,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Order } from '../../types';
import { formatPrice } from '../../config/store';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/common/Button';

export const OrdersPage: React.FC = () => {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const fetchOrders = async () => {
    const activeToken = token || 'mock-customer-token';
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCustomerOrders(activeToken);
      setOrders(data);
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      setError(err?.message || 'Unable to connect to order server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token]);

  const filteredOrders = orders.filter((ord) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'active') {
      return ['NEW', 'ACCEPTED', 'PACKING', 'PACKED', 'pending', 'processing'].includes(ord.status);
    }
    if (selectedFilter === 'ready') {
      return [
        'DELIVERY_PENDING',
        'READY_FOR_DELIVERY',
        'OUT_FOR_DELIVERY',
        'COURIER_ASSIGNED',
        'SHIPPED',
        'COURIER_TRACKING',
        'shipped'
      ].includes(ord.status);
    }
    if (selectedFilter === 'delivered') {
      return ['DELIVERED', 'delivered'].includes(ord.status);
    }
    if (selectedFilter === 'rejected') {
      return ['REJECTED', 'CANCELLED'].includes(ord.status);
    }
    return ord.status === selectedFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'NEW':
        return <Badge variant="coral">New Order</Badge>;
      case 'ACCEPTED':
        return <Badge variant="plum">Accepted</Badge>;
      case 'PACKING':
        return <Badge variant="warning">Packing</Badge>;
      case 'PACKED':
        return <Badge variant="mint">Packed & Ready</Badge>;
      case 'DELIVERY_PENDING':
        return <Badge variant="mint">Ready for Handover</Badge>;
      case 'READY_FOR_DELIVERY':
        return <Badge variant="mint">Ready for Delivery</Badge>;
      case 'OUT_FOR_DELIVERY':
        return <Badge variant="coral">Out for Delivery</Badge>;
      case 'COURIER_ASSIGNED':
        return <Badge variant="plum">Courier Assigned</Badge>;
      case 'SHIPPED':
        return <Badge variant="coral">Dispatched with Courier</Badge>;
      case 'COURIER_TRACKING':
        return <Badge variant="warning">In Transit</Badge>;
      case 'DELIVERED':
        return <Badge variant="mint">Delivered</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Order Rejected</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="plum">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PAID':
      case 'VERIFIED':
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            PAYMENT VERIFIED
          </span>
        );
      case 'VERIFICATION_PENDING':
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
            VERIFICATION PENDING
          </span>
        );
      case 'REJECTED':
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
            PAYMENT REJECTED
          </span>
        );
      case 'PENDING':
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            PAYMENT PENDING
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
            REFUNDED
          </span>
        );
      case 'PARTIALLY_REFUNDED':
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
            PARTIALLY REFUNDED
          </span>
        );
      case 'FAILED':
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
            PAYMENT FAILED
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-plum-100 text-plum-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <span className="text-xs uppercase tracking-widest font-bold text-coral-600 block mb-1">
          Commissions & Dispatches
        </span>
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-plum-950">
          My Order Inquiries
        </h1>
        <p className="text-xs sm:text-sm text-plum-500 mt-1">
          Track real-time fulfillment milestones, live shipment dispatches, and loyalty rewards earned.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-plum-200 gap-6 text-xs font-semibold uppercase tracking-wider overflow-x-auto">
        {[
          { key: 'all', label: 'All Orders' },
          { key: 'active', label: 'Processing & Packing' },
          { key: 'ready', label: 'In Transit / Dispatched' },
          { key: 'delivered', label: 'Delivered' },
          { key: 'rejected', label: 'Rejected / Cancelled' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedFilter(tab.key)}
            className={`pb-3 transition-colors shrink-0 ${
              selectedFilter === tab.key
                ? 'border-b-2 border-coral-500 text-coral-600 font-bold'
                : 'text-plum-400 hover:text-plum-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-plum-400 flex items-center justify-center gap-2">
          <Clock className="w-4 h-4 animate-spin text-coral-500" /> Loading your orders...
        </div>
      ) : error ? (
        <div className="p-8 bg-red-50/80 border border-red-200 rounded-3xl text-center space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-plum-950 text-base">Unable to Retrieve Orders</h3>
          <p className="text-xs text-plum-600">{error}</p>
          <button
            onClick={() => fetchOrders()}
            className="px-5 py-2.5 bg-coral-500 hover:bg-coral-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={<Package className="w-8 h-8 text-coral-500" />}
          title="No Orders Located"
          description="You currently have no orders matching this filter."
          actionLabel="Explore Our Creations"
          onAction={() => window.location.assign('/products')}
        />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrderId === order.id;

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-plum-100 p-6 shadow-card space-y-4 transition-all"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-plum-50 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-plum-50 text-plum-700 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-coral-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-bold text-base text-plum-950">
                          {order.order_number}
                        </h3>
                        <span className="text-[11px] font-medium text-plum-400">
                          ({order.delivery_method === 'HOME_DELIVERY' ? 'Doorstep Delivery' : 'Store Pickup'})
                        </span>
                      </div>
                      <p className="text-xs text-plum-400">
                        Placed on {new Date(order.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
                    {getStatusBadge(order.status)}
                    {getPaymentStatusBadge(order.payment_status)}
                    {order.coins_redeemed && order.coins_redeemed > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-coral-700 bg-coral-50 border border-coral-200 px-2.5 py-0.5 rounded-full">
                        <Coins className="w-3 h-3" /> {order.coins_redeemed} Coins Used
                      </span>
                    )}
                    {order.coins_credited && (order.coins_earned ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        <Sparkles className="w-3 h-3" /> +{order.coins_earned} Coins Earned
                      </span>
                    )}
                  </div>
                </div>

                {/* Rejection Notice Banner if REJECTED */}
                {order.status === 'REJECTED' && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-900 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-red-700">
                      <XCircle className="w-4 h-4 shrink-0" />
                      Order Cancelled by Atelier: {order.rejection_reason || 'Product unavailable'}
                    </div>
                    {order.rejection_notes && (
                      <p className="text-red-800 text-[11px]">Note: {order.rejection_notes}</p>
                    )}
                    {order.payment_status === 'REFUNDED' && (
                      <p className="text-emerald-800 font-semibold text-[11px] pt-1">
                        ✓ Full refund of {formatPrice(order.total_amount)} initiated to your original payment method.
                      </p>
                    )}
                  </div>
                )}

                {/* Items & Amount Summary */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 gap-4">
                  <div className="flex items-center gap-6 text-xs text-plum-600">
                    <div>
                      <span className="text-plum-400 block text-[10px] uppercase font-bold">Pieces</span>
                      <span className="font-semibold text-plum-900">{order.items_count} items</span>
                    </div>
                    <div>
                      <span className="text-plum-400 block text-[10px] uppercase font-bold">Fulfillment</span>
                      <span className="font-semibold text-plum-900">
                        {order.delivery_method === 'HOME_DELIVERY' ? 'Home Delivery' : 'Store Pickup'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <span className="text-plum-400 block text-[10px] uppercase font-bold">Total Paid</span>
                      <span className="text-xl font-bold font-display text-plum-950">
                        {formatPrice(order.total_amount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link to={`/orders/${order.order_number}/invoice`}>
                        <Button variant="outline" size="sm" leftIcon={<Receipt className="w-3.5 h-3.5" />}>
                          View Receipt
                        </Button>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="p-2 text-plum-400 hover:text-plum-900 rounded-xl hover:bg-plum-50 text-xs font-semibold"
                      >
                        {isExpanded ? 'Hide Details' : 'View Details'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="pt-4 border-t border-plum-50 space-y-4">
                    {/* Live Shipment Tracking Card (Phase 09) */}
                    {order.shipment && (
                      <div className="bg-plum-50/60 rounded-2xl p-5 border border-plum-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-coral-600" />
                            <h4 className="text-xs font-bold text-plum-900 uppercase tracking-wider">
                              {order.shipment.delivery_type === 'DIRECT_DELIVERY'
                                ? 'Direct Concierge Delivery'
                                : 'Courier Dispatch & Tracking'}
                            </h4>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-plum-200 text-plum-900">
                            {order.shipment.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {order.shipment.delivery_type === 'DIRECT_DELIVERY' ? (
                          <div className="space-y-2 text-xs text-plum-700">
                            <p>
                              Handled by:{' '}
                              <strong className="text-plum-900">
                                {order.shipment.direct_assigned_to || 'Sanjana Mobiles Delivery Team'}
                              </strong>
                            </p>
                            {order.shipment.direct_out_for_delivery_at && (
                              <p className="text-[11px] text-plum-500">
                                Dispatched at:{' '}
                                {new Date(order.shipment.direct_out_for_delivery_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            )}
                            {order.shipment.direct_delivered_at && (
                              <p className="text-[11px] text-emerald-700 font-semibold">
                                ✓ Doorstep delivery completed at{' '}
                                {new Date(order.shipment.direct_delivered_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            )}
                            {order.shipment.direct_delivery_proof_url && (
                              <div className="pt-1">
                                <a
                                  href={order.shipment.direct_delivery_proof_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-coral-600 hover:text-coral-700 font-semibold"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" /> View Delivery Proof
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2.5 text-xs text-plum-700">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <span className="text-plum-400 block text-[10px] uppercase font-bold">Courier</span>
                                <span className="font-semibold text-plum-900">
                                  {order.shipment.courier_name || 'Assigned Courier'}
                                </span>
                              </div>
                              <div>
                                <span className="text-plum-400 block text-[10px] uppercase font-bold">AWB / Tracking #</span>
                                <span className="font-mono font-bold text-coral-600">
                                  {order.shipment.tracking_number || 'Pending'}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 pt-1">
                              {order.shipment.tracking_url && (
                                <a
                                  href={order.shipment.tracking_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-plum-900 text-white rounded-xl text-xs font-semibold hover:bg-plum-950 transition-colors"
                                >
                                  Track Package <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              {order.shipment.receipt_image_url && (
                                <a
                                  href={order.shipment.receipt_image_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-plum-200 text-plum-800 rounded-xl text-xs font-semibold hover:bg-plum-50 transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5 text-plum-500" /> View Courier Receipt
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Items Snapshot */}
                    <div className="bg-ivory/60 rounded-2xl p-4 border border-plum-100/60 divide-y divide-plum-100/40">
                      <h4 className="text-xs font-bold text-plum-900 mb-2 uppercase tracking-wider">
                        Commissioned Items
                      </h4>
                      {order.items?.map((it) => (
                        <div key={it.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                          <div className="flex items-center gap-3">
                            {it.image_url && (
                              <img src={it.image_url} alt={it.title} className="w-10 h-10 object-cover rounded-xl" />
                            )}
                            <div>
                              <span className="font-semibold text-plum-900 block">{it.title}</span>
                              <span className="text-[11px] text-plum-400">SKU: {it.sku}</span>
                            </div>
                          </div>
                          <span className="font-bold text-plum-950 font-display">
                            {formatPrice(it.subtotal)} ({it.quantity} × {formatPrice(it.price_snapshot)})
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Timeline History */}
                    {order.status_history && order.status_history.length > 0 && (
                      <div className="bg-white rounded-2xl p-4 border border-plum-100 space-y-2">
                        <h4 className="text-xs font-bold text-plum-900 uppercase tracking-wider">
                          Timeline History
                        </h4>
                        <div className="space-y-2 text-xs">
                          {order.status_history.map((h) => (
                            <div key={h.id} className="flex items-start gap-2.5 text-plum-700">
                              <span className="w-2 h-2 rounded-full bg-coral-500 mt-1.5 shrink-0" />
                              <div>
                                <span className="font-bold text-plum-900">{h.new_status}: </span>
                                <span>{h.comment || 'Status updated'}</span>
                                <span className="block text-[10px] text-plum-400">
                                  {new Date(h.created_at).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
