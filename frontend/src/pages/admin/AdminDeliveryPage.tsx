import React, { useState, useEffect } from 'react';
import {
  Truck,
  MapPin,
  Package,
  Navigation,
  FileText,
  Upload,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Image as ImageIcon,
  X,
  Phone
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  Order,
  DeliverySettings,
  DistanceCalculation,
  ShipmentRecord
} from '../../types';
import { formatPrice } from '../../config/store';
import { Button } from '../../components/common/Button';

export const AdminDeliveryPage: React.FC = () => {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<DeliverySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Distance & Method Selection Modal
  const [showDistanceModal, setShowDistanceModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [distanceInfo, setDistanceInfo] = useState<DistanceCalculation | null>(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [assignedConcierge, setAssignedConcierge] = useState('Concierge Vikram');
  const [methodNotes, setMethodNotes] = useState('');

  // Courier Shipment Modal
  const [showCourierModal, setShowCourierModal] = useState(false);
  const [courierForm, setCourierForm] = useState({
    courier_name: 'Delhivery',
    tracking_number: '',
    shipment_date: new Date().toISOString().split('T')[0],
    receipt_image_url: '',
    receipt_storage_path: '',
    shipment_notes: 'Dispatched via express air logistics',
    estimated_delivery_date: ''
  });
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isSubmittingShipment, setIsSubmittingShipment] = useState(false);

  // Direct Delivery Modal
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [directForm, setDirectForm] = useState({
    status: 'OUT_FOR_DELIVERY',
    delivery_proof_url: '',
    customer_acknowledgement: ''
  });

  // Courier Tracking Progression Modal
  const [showTrackingUpdateModal, setShowTrackingUpdateModal] = useState(false);
  const [trackingUpdateForm, setTrackingUpdateForm] = useState({
    status: 'COURIER_TRACKING',
    location: '',
    event_description: ''
  });

  const loadAllData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [ordersSummary, dlvSettings] = await Promise.all([
        api.getAdminOrdersSummary(token),
        api.adminGetDeliverySettings(token)
      ]);
      setOrders(ordersSummary.all_orders);
      setSettings(dlvSettings);
    } catch (err: any) {
      showToast(err.message || 'Failed to load delivery and orders data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [token]);

  // Open Distance Calculator & Method Suggester
  const handleOpenDistance = async (order: Order) => {
    setSelectedOrder(order);
    setShowDistanceModal(true);
    setIsCalculatingDistance(true);
    setMethodNotes('');
    try {
      if (token) {
        const dist = await api.adminComputeOrderDistance(token, order.id);
        setDistanceInfo(dist);
      }
    } catch (err: any) {
      showToast(err.message || 'Could not compute distance', 'error');
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  // Admin Chooses Method (Direct Delivery vs Courier)
  const handleSelectMethod = async (deliveryType: 'DIRECT_DELIVERY' | 'COURIER') => {
    if (!token || !selectedOrder) return;
    try {
      await api.adminSelectDeliveryMethod(token, selectedOrder.id, {
        delivery_type: deliveryType,
        assigned_to: deliveryType === 'DIRECT_DELIVERY' ? assignedConcierge : undefined,
        notes: methodNotes || undefined
      });
      showToast(
        `Order ${selectedOrder.order_number} assigned to ${deliveryType === 'DIRECT_DELIVERY' ? 'Direct Delivery' : 'Courier Logistics'}`,
        'success'
      );
      setShowDistanceModal(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to select delivery method', 'error');
    }
  };

  // Upload Courier Receipt
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setIsUploadingReceipt(true);
    try {
      const res = await api.adminUploadCourierReceipt(token, file);
      setCourierForm((prev) => ({
        ...prev,
        receipt_image_url: res.receipt_image_url,
        receipt_storage_path: res.receipt_storage_path
      }));
      showToast('Courier receipt uploaded successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to upload receipt', 'error');
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  // Submit Courier Shipment
  const handleSubmitCourierShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedOrder) return;

    if (!courierForm.tracking_number.trim()) {
      showToast('AWB / Consignment tracking number is required', 'error');
      return;
    }

    setIsSubmittingShipment(true);
    try {
      await api.adminCreateCourierShipment(token, selectedOrder.id, {
        courier_name: courierForm.courier_name,
        tracking_number: courierForm.tracking_number.trim(),
        shipment_date: courierForm.shipment_date,
        receipt_image_url: courierForm.receipt_image_url || undefined,
        receipt_storage_path: courierForm.receipt_storage_path || undefined,
        shipment_notes: courierForm.shipment_notes || undefined,
        estimated_delivery_date: courierForm.estimated_delivery_date || undefined
      });
      showToast(`Shipment recorded for order ${selectedOrder.order_number}`, 'success');
      setShowCourierModal(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create shipment', 'error');
    } finally {
      setIsSubmittingShipment(false);
    }
  };

  // Submit Direct Delivery Update
  const handleUpdateDirectDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedOrder) return;

    try {
      await api.adminUpdateDirectDeliveryStatus(token, selectedOrder.id, {
        status: directForm.status,
        delivery_proof_url: directForm.delivery_proof_url || undefined,
        customer_acknowledgement: directForm.customer_acknowledgement || undefined
      });
      showToast(`Direct delivery updated to ${directForm.status}`, 'success');
      setShowDirectModal(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update direct delivery', 'error');
    }
  };

  // Submit Courier Status Update
  const handleUpdateCourierTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedOrder) return;

    try {
      await api.adminUpdateCourierStatus(token, selectedOrder.id, {
        status: trackingUpdateForm.status,
        location: trackingUpdateForm.location || undefined,
        event_description: trackingUpdateForm.event_description || undefined
      });
      showToast(`Courier tracking updated to ${trackingUpdateForm.status}`, 'success');
      setShowTrackingUpdateModal(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update tracking', 'error');
    }
  };

  // Generate WhatsApp Notification Link
  const handleSendWhatsApp = async (order: Order, eventType = 'SHIPPED_COURIER') => {
    if (!token) return;
    try {
      const msg = await api.adminGetWhatsAppNotification(token, order.id, eventType);
      window.open(msg.whatsapp_share_url, '_blank', 'noopener,noreferrer');
      showToast('Opening WhatsApp with pre-filled customer dispatch update', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate WhatsApp notification', 'error');
    }
  };

  // Filtering orders
  const filteredOrders = orders.filter((o) => {
    // Only show home delivery orders in delivery panel
    if (o.delivery_method !== 'HOME_DELIVERY') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        o.order_number.toLowerCase().includes(q) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.customer_mobile && o.customer_mobile.includes(q));
      if (!match) return false;
    }

    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'ready_dispatch') {
      return ['PACKED', 'DELIVERY_PENDING'].includes(o.status);
    }
    if (selectedFilter === 'direct') {
      return ['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'].includes(o.status);
    }
    if (selectedFilter === 'courier') {
      return ['COURIER_ASSIGNED', 'SHIPPED', 'COURIER_TRACKING'].includes(o.status);
    }
    if (selectedFilter === 'delivered') {
      return o.status === 'DELIVERED';
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-coral-600 block mb-1">
            Phase 09 Administration
          </span>
          <h1 className="text-2xl font-bold font-display text-plum-900">
            Delivery & Shipment Management
          </h1>
          <p className="text-xs text-plum-500 mt-1">
            Haversine distance calculation, Direct Concierge Handover vs Courier Dispatch, AWB tracking and 1-click WhatsApp customer alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllData}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Store Dispatch Center Card */}
      <div className="bg-plum-900 rounded-3xl p-6 sm:p-7 text-ivory border border-plum-800 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-widest font-bold text-coral-300 block">
              Central Logistics & Dispatch Hub
            </span>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-white">
              {settings?.store_name || 'Sanjana Mobiles Store, Bengaluru'}
            </h2>
            <p className="text-xs text-plum-300">
              {settings?.store_address || '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038'}
            </p>
            <div className="flex items-center gap-4 text-xs font-mono text-mint-300 pt-1">
              <span>Lat: {settings?.store_latitude || 12.9716}</span>
              <span>•</span>
              <span>Lng: {settings?.store_longitude || 77.5946}</span>
            </div>
          </div>

          <div className="bg-plum-950/70 p-4 rounded-2xl border border-plum-800 text-xs space-y-1.5 shrink-0">
            <span className="font-bold text-coral-300 block">Decision Thresholds</span>
            <p className="text-plum-300">
              • Direct Concierge Radius: <strong className="text-white">≤ {settings?.direct_delivery_max_distance_km || 3} km</strong>
            </p>
            <p className="text-plum-300">
              • External Courier Threshold: <strong className="text-white">&gt; {settings?.courier_suggested_min_distance_km || 10} km</strong>
            </p>
            <span className="text-[10px] text-plum-400 block pt-1">
              * Suggestion is non-binding; Admin maintains full decision control.
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white rounded-3xl border border-plum-100 p-6 shadow-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-plum-100 pb-4">
          <div className="flex items-center gap-4 overflow-x-auto text-xs font-semibold uppercase tracking-wider">
            {[
              { key: 'all', label: 'All Home Deliveries' },
              { key: 'ready_dispatch', label: 'Packed & Ready for Dispatch' },
              { key: 'direct', label: 'Direct Concierge' },
              { key: 'courier', label: 'Courier In-Transit' },
              { key: 'delivered', label: 'Delivered' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedFilter(tab.key)}
                className={`pb-2 transition-colors shrink-0 ${
                  selectedFilter === tab.key
                    ? 'border-b-2 border-coral-500 text-coral-600 font-bold'
                    : 'text-plum-400 hover:text-plum-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-plum-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search order #, customer, mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-ivory/60 border border-plum-200 rounded-xl text-plum-900 focus:outline-none focus:ring-1 focus:ring-plum-900"
            />
          </div>
        </div>

        {/* Orders Table */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-xs text-plum-400">
            No orders match the selected delivery filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-plum-100 text-plum-400 uppercase tracking-wider text-[10px]">
                  <th className="pb-3 font-semibold">Order Details</th>
                  <th className="pb-3 font-semibold">Customer & Destination</th>
                  <th className="pb-3 font-semibold">Fulfillment Branch</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-plum-50">
                {filteredOrders.map((ord) => {
                  const addr = ord.delivery_address || {};
                  const isDirect = ['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'].includes(ord.status);
                  const isCourier = ['COURIER_ASSIGNED', 'SHIPPED', 'COURIER_TRACKING'].includes(ord.status);
                  const isDelivered = ord.status === 'DELIVERED';
                  const needsMethodSelection = ['PACKED', 'DELIVERY_PENDING'].includes(ord.status);

                  return (
                    <tr key={ord.id} className="hover:bg-ivory/40 transition-colors">
                      {/* Order Details */}
                      <td className="py-4">
                        <div className="space-y-0.5">
                          <span className="font-bold text-plum-950 block font-mono">
                            {ord.order_number}
                          </span>
                          <span className="text-[11px] text-plum-500">
                            {ord.items_count} pieces • {formatPrice(ord.total_amount)}
                          </span>
                          <span className="text-[10px] text-plum-400 block font-mono">
                            {new Date(ord.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </td>

                      {/* Customer & Destination */}
                      <td className="py-4 max-w-xs">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-plum-900 block">
                            {ord.customer_name || 'Customer'}
                          </span>
                          <p className="text-[11px] text-plum-600 truncate">
                            {addr.address_line1 || 'Address'}, {addr.city} {addr.pin_code || addr.postal_code}
                          </p>
                          <span className="text-[10px] text-plum-500 font-mono">
                            +91 {ord.customer_mobile || addr.mobile_number || addr.phone || ''}
                          </span>
                        </div>
                      </td>

                      {/* Fulfillment Branch */}
                      <td className="py-4">
                        {isDirect ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <Navigation className="w-3 h-3 text-emerald-600" /> Direct Concierge
                          </span>
                        ) : isCourier ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-plum-900 bg-plum-100 border border-plum-200 px-2 py-0.5 rounded-full">
                            <Truck className="w-3 h-3 text-coral-600" /> Courier Dispatch
                          </span>
                        ) : isDelivered ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Handover Complete
                          </span>
                        ) : (
                          <span className="text-[11px] text-plum-400 font-medium">
                            Pending Method Selection
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-plum-100 text-plum-800">
                          {ord.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* 1. Distance Calculation & Suggestion */}
                          {needsMethodSelection && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleOpenDistance(ord)}
                              leftIcon={<MapPin className="w-3.5 h-3.5" />}
                            >
                              Dispatch Decision
                            </Button>
                          )}

                          {/* 2. Direct Delivery Actions */}
                          {isDirect && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedOrder(ord);
                                  setDirectForm({
                                    status: ord.status === 'READY_FOR_DELIVERY' ? 'OUT_FOR_DELIVERY' : 'DELIVERED',
                                    delivery_proof_url: '',
                                    customer_acknowledgement: ''
                                  });
                                  setShowDirectModal(true);
                                }}
                              >
                                {ord.status === 'READY_FOR_DELIVERY' ? 'Send Out' : 'Mark Delivered'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSendWhatsApp(ord, ord.status === 'READY_FOR_DELIVERY' ? 'READY_FOR_DELIVERY' : 'OUT_FOR_DELIVERY')}
                                title="Send WhatsApp Update to Recipient"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              </Button>
                            </>
                          )}

                          {/* 3. Courier Actions */}
                          {ord.status === 'COURIER_ASSIGNED' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                setSelectedOrder(ord);
                                setCourierForm({
                                  courier_name: 'Delhivery',
                                  tracking_number: '',
                                  shipment_date: new Date().toISOString().split('T')[0],
                                  receipt_image_url: '',
                                  receipt_storage_path: '',
                                  shipment_notes: 'Dispatched via express logistics',
                                  estimated_delivery_date: ''
                                });
                                setShowCourierModal(true);
                              }}
                              leftIcon={<Package className="w-3.5 h-3.5" />}
                            >
                              Dispatch Courier
                            </Button>
                          )}

                          {['SHIPPED', 'COURIER_TRACKING'].includes(ord.status) && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedOrder(ord);
                                  setTrackingUpdateForm({
                                    status: ord.status === 'SHIPPED' ? 'COURIER_TRACKING' : 'DELIVERED',
                                    location: 'Hub Checkpoint',
                                    event_description: ''
                                  });
                                  setShowTrackingUpdateModal(true);
                                }}
                              >
                                Advance Tracking
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSendWhatsApp(ord, 'SHIPPED_COURIER')}
                                title="Send WhatsApp Dispatch Notice"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 1. Distance Calculation & Method Suggestion Modal */}
      {showDistanceModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-plum-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-plum-100 space-y-5">
            <div className="flex items-center justify-between border-b border-plum-100 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-coral-600" />
                <h3 className="font-display font-bold text-base text-plum-900">
                  Haversine Distance & Route Analysis
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDistanceModal(false)}
                className="text-plum-400 hover:text-plum-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isCalculatingDistance ? (
              <div className="py-8 text-center text-xs text-plum-400 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 animate-spin text-coral-500" /> Calculating Great-Circle distance...
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Distance & Suggestion Banner */}
                <div className="p-4 bg-plum-50 rounded-2xl border border-plum-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-plum-500">Calculated Distance:</span>
                    <span className="font-mono font-bold text-base text-plum-950">
                      {distanceInfo?.distance_km !== null ? `${distanceInfo?.distance_km} km` : 'Coordinates unmapped'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-plum-200/50">
                    <span className="text-plum-500">System Suggestion:</span>
                    <span
                      className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wider ${
                        distanceInfo?.suggested_method === 'DIRECT_DELIVERY'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : distanceInfo?.suggested_method === 'COURIER'
                          ? 'bg-plum-200 text-plum-900'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {distanceInfo?.suggested_method.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <p className="text-[11px] text-plum-600 pt-1 leading-relaxed">
                    {distanceInfo?.explanation}
                  </p>
                </div>

                {/* Recipient Details */}
                <div className="p-3 bg-ivory/60 rounded-xl border border-plum-100 text-plum-700 space-y-1">
                  <span className="font-bold text-plum-900 block">Recipient Destination:</span>
                  <p>{selectedOrder.delivery_address?.address_line1}, {selectedOrder.delivery_address?.city}</p>
                  <p>PIN: {selectedOrder.delivery_address?.pin_code || selectedOrder.delivery_address?.postal_code}</p>
                </div>

                {/* Optional Concierge Assignment */}
                <div>
                  <label className="block font-bold text-plum-900 mb-1">
                    Assign Concierge Person (for Direct Delivery)
                  </label>
                  <input
                    type="text"
                    value={assignedConcierge}
                    onChange={(e) => setAssignedConcierge(e.target.value)}
                    className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 text-xs"
                  />
                </div>

                {/* Admin Non-Binding Choice CTA Buttons */}
                <div className="pt-3 border-t border-plum-100 space-y-2">
                  <span className="text-[11px] font-bold text-plum-500 block uppercase tracking-wider">
                    Select Fulfillment Mode:
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => handleSelectMethod('DIRECT_DELIVERY')}
                      leftIcon={<Navigation className="w-4 h-4 text-emerald-600" />}
                    >
                      Direct Concierge
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => handleSelectMethod('COURIER')}
                      leftIcon={<Truck className="w-4 h-4" />}
                    >
                      Assign to Courier
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Courier Shipment Form Modal (AWB + Receipt Photo) */}
      {showCourierModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-plum-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-plum-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-plum-100 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-coral-600" />
                <h3 className="font-display font-bold text-base text-plum-900">
                  Record Courier Consignment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCourierModal(false)}
                className="text-plum-400 hover:text-plum-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCourierShipment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-plum-900 mb-1">Courier Company *</label>
                <select
                  value={courierForm.courier_name}
                  onChange={(e) => setCourierForm({ ...courierForm, courier_name: e.target.value })}
                  className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 font-bold"
                >
                  <option value="Delhivery">Delhivery</option>
                  <option value="BlueDart">BlueDart</option>
                  <option value="Shiprocket">Shiprocket</option>
                  <option value="DTDC">DTDC</option>
                  <option value="India Post">India Post Speed Post</option>
                  <option value="EKart">EKart Logistics</option>
                  <option value="Custom Courier">Other / Private Logistics</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-plum-900 mb-1">
                  AWB / Consignment Tracking Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DEL9876543210"
                  value={courierForm.tracking_number}
                  onChange={(e) => setCourierForm({ ...courierForm, tracking_number: e.target.value })}
                  className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 font-mono font-bold"
                />
              </div>

              {/* Receipt Image Upload */}
              <div>
                <label className="block font-bold text-plum-900 mb-1">
                  Courier Consignment Receipt Photo (Supabase Storage)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptUpload}
                    className="text-xs text-plum-500 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-coral-50 file:text-coral-700 hover:file:bg-coral-100"
                  />
                  {isUploadingReceipt && <span className="text-plum-400">Uploading...</span>}
                </div>
                {courierForm.receipt_image_url && (
                  <div className="mt-2 flex items-center gap-2 p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Receipt uploaded and linked.
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-plum-900 mb-1">Shipment Notes</label>
                <textarea
                  rows={2}
                  value={courierForm.shipment_notes}
                  onChange={(e) => setCourierForm({ ...courierForm, shipment_notes: e.target.value })}
                  className="w-full bg-ivory/60 border border-plum-200 rounded-xl p-2.5 text-plum-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-plum-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCourierModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingShipment}
                >
                  {isSubmittingShipment ? 'Saving Shipment...' : 'Confirm Dispatch (SHIPPED)'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Direct Delivery Progression Modal */}
      {showDirectModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-plum-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-plum-100 space-y-4">
            <div className="flex items-center justify-between border-b border-plum-100 pb-3">
              <div className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-emerald-600" />
                <h3 className="font-display font-bold text-base text-plum-900">
                  Update Direct Concierge Status
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectModal(false)}
                className="text-plum-400 hover:text-plum-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateDirectDelivery} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-plum-900 mb-1">Target Status *</label>
                <select
                  value={directForm.status}
                  onChange={(e) => setDirectForm({ ...directForm, status: e.target.value })}
                  className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 font-bold"
                >
                  <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY (Concierge en route)</option>
                  <option value="DELIVERED">DELIVERED (Doorstep Handover Complete)</option>
                </select>
              </div>

              {directForm.status === 'DELIVERED' && (
                <>
                  <div>
                    <label className="block font-bold text-plum-900 mb-1">Delivery Proof Image URL</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={directForm.delivery_proof_url}
                      onChange={(e) => setDirectForm({ ...directForm, delivery_proof_url: e.target.value })}
                      className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-plum-900 mb-1">Customer Acknowledgement</label>
                    <input
                      type="text"
                      placeholder="e.g. Received by Sanjana Patel"
                      value={directForm.customer_acknowledgement}
                      onChange={(e) => setDirectForm({ ...directForm, customer_acknowledgement: e.target.value })}
                      className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-plum-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDirectModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Update Status
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Courier Tracking Progression Modal */}
      {showTrackingUpdateModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-plum-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-plum-100 space-y-4">
            <div className="flex items-center justify-between border-b border-plum-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-coral-600" />
                <h3 className="font-display font-bold text-base text-plum-900">
                  Advance Courier Checkpoint
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTrackingUpdateModal(false)}
                className="text-plum-400 hover:text-plum-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateCourierTracking} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-plum-900 mb-1">Checkpoint Status *</label>
                <select
                  value={trackingUpdateForm.status}
                  onChange={(e) => setTrackingUpdateForm({ ...trackingUpdateForm, status: e.target.value })}
                  className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 font-bold"
                >
                  <option value="COURIER_TRACKING">COURIER_TRACKING (In Transit Checkpoint)</option>
                  <option value="DELIVERED">DELIVERED (Final Destination Delivery)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-plum-900 mb-1">Location Checkpoint</label>
                <input
                  type="text"
                  placeholder="e.g. Sorting Center Bengaluru or Out for Delivery"
                  value={trackingUpdateForm.location}
                  onChange={(e) => setTrackingUpdateForm({ ...trackingUpdateForm, location: e.target.value })}
                  className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900"
                />
              </div>

              <div>
                <label className="block font-bold text-plum-900 mb-1">Event Description</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Package arrived at local sorting facility..."
                  value={trackingUpdateForm.event_description}
                  onChange={(e) => setTrackingUpdateForm({ ...trackingUpdateForm, event_description: e.target.value })}
                  className="w-full bg-ivory/60 border border-plum-200 rounded-xl p-2.5 text-plum-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-plum-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTrackingUpdateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Record Checkpoint
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
