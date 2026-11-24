import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle2,
  Package,
  Truck,
  Store,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Printer
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Order } from '../../types';
import { formatPrice, storeConfig } from '../../config/store';
import { Button } from '../../components/common/Button';

export const OrderConfirmationPage: React.FC = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const { token } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderNumber) return;
      try {
        const activeToken = token || 'mock-customer-token';
        const data = await api.getCustomerOrderDetail(activeToken, orderNumber);
        setOrder(data);
      } catch (e) {
        console.error('Failed to fetch confirmed order', e);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderNumber, token]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="w-12 h-12 border-3 border-plum-200 border-t-coral-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs text-plum-600 font-medium">Loading your verified order receipt...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Success Hero Header */}
      <div className="bg-white rounded-3xl border border-plum-100 p-8 shadow-card text-center space-y-4">
        <div className="w-16 h-16 bg-mint-100 rounded-full flex items-center justify-center text-mint-700 mx-auto">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <div className="space-y-1">
          <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
            order?.payment_status === 'VERIFIED' || order?.payment_status === 'PAID'
              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
              : order?.payment_status === 'REJECTED'
              ? 'text-red-700 bg-red-50 border border-red-200'
              : order?.delivery_method === 'STORE_PICKUP'
              ? 'text-emerald-800 bg-emerald-50 border border-emerald-300'
              : 'text-blue-700 bg-blue-50 border border-blue-200'
          }`}>
            {order?.payment_status === 'VERIFIED' || order?.payment_status === 'PAID'
              ? 'Payment Verified & Confirmed'
              : order?.payment_status === 'REJECTED'
              ? 'Payment Verification Rejected'
              : order?.delivery_method === 'STORE_PICKUP'
              ? 'Direct Store Pickup • Pay at Store'
              : 'UPI Payment Verification Pending'}
          </span>
          <h1 className="text-3xl font-extrabold font-display text-plum-950 mt-2">
            Thank You for Your Order
          </h1>
          <p className="text-sm text-plum-600 max-w-md mx-auto">
            Order <strong className="text-plum-900 font-mono">{orderNumber}</strong> has been received by SANJANA MOBILES.
            {order?.delivery_method === 'STORE_PICKUP' && order?.payment_status !== 'PAID' && (
              <span className="block mt-2 text-xs text-emerald-900 bg-emerald-50/90 p-3 rounded-2xl border border-emerald-200 font-medium leading-relaxed">
                <strong className="block text-emerald-950 text-sm font-bold mb-1">
                  Pay at Store – Visit SANJANA MOBILES and pay when collecting your order.
                </strong>
                Our team is packing your items. Please bring this Order Number ({orderNumber}) to the shop counter at {storeConfig.contact.address}.
              </span>
            )}
            {order?.delivery_method !== 'STORE_PICKUP' && order?.payment_status === 'VERIFICATION_PENDING' && (
              <span className="block mt-1 text-xs text-blue-800 bg-blue-50 p-2 rounded-xl border border-blue-100">
                Our team is currently verifying your UPI transaction reference against shop bank records. You will receive an SMS/email once verified.
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs">
          {order?.order_number && (
            <Link to={`/orders/${order.order_number}/invoice`}>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Printer className="w-3.5 h-3.5" />}
              >
                View Official Invoice
              </Button>
            </Link>
          )}
          <Link to="/orders">
            <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Track in My Orders
            </Button>
          </Link>
        </div>
      </div>

      {/* Tracking Progression Timeline */}
      <div className="bg-white rounded-3xl border border-plum-100 p-6 shadow-card space-y-4">
        <h3 className="font-display font-bold text-base text-plum-900 border-b border-plum-100 pb-3">
          Order Status Workflow
        </h3>

        <div className="relative flex items-center justify-between px-2 pt-2 pb-4">
          <div className="absolute left-8 right-8 top-6 h-0.5 bg-plum-100 -z-0" />

          {/* Step 1: NEW */}
          <div className="flex flex-col items-center relative z-10 text-center">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-plum-900 mt-2">Confirmed</span>
            <span className="text-[10px] text-plum-400">Order Received</span>
          </div>

          {/* Step 2: ACCEPTED */}
          <div className="flex flex-col items-center relative z-10 text-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              order?.status === 'ACCEPTED' || order?.status === 'PACKING' || order?.status === 'PACKED' || order?.status === 'DELIVERY_PENDING'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-plum-100 text-plum-400'
            }`}>
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-plum-900 mt-2">Accepted</span>
            <span className="text-[10px] text-plum-400">Atelier Approved</span>
          </div>

          {/* Step 3: PACKING */}
          <div className="flex flex-col items-center relative z-10 text-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              order?.status === 'PACKING' || order?.status === 'PACKED' || order?.status === 'DELIVERY_PENDING'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-plum-100 text-plum-400'
            }`}>
              <Package className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-plum-900 mt-2">Packing</span>
            <span className="text-[10px] text-plum-400">Quality Check</span>
          </div>

          {/* Step 4: PACKED */}
          <div className="flex flex-col items-center relative z-10 text-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              order?.status === 'PACKED' || order?.status === 'DELIVERY_PENDING'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-plum-100 text-plum-400'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-plum-900 mt-2">Packed</span>
            <span className="text-[10px] text-plum-400">Sealed for Dispatch</span>
          </div>

          {/* Step 5: DELIVERY_PENDING */}
          <div className="flex flex-col items-center relative z-10 text-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              order?.status === 'DELIVERY_PENDING'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-plum-100 text-plum-400'
            }`}>
              <Truck className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-plum-900 mt-2">Ready</span>
            <span className="text-[10px] text-plum-400">Delivery Handover</span>
          </div>
        </div>
      </div>

      {/* Details & Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Delivery / Pickup Details */}
        <div className="bg-white rounded-3xl border border-plum-100 p-6 shadow-card space-y-4">
          <h3 className="font-display font-bold text-sm text-plum-900 border-b border-plum-100 pb-2 flex items-center gap-2">
            {order?.delivery_method === 'HOME_DELIVERY' ? (
              <>
                <Truck className="w-4 h-4 text-coral-600" /> Doorstep Delivery
              </>
            ) : (
              <>
                <Store className="w-4 h-4 text-mint-700" /> Store Pickup Information
              </>
            )}
          </h3>

          {order?.delivery_method === 'HOME_DELIVERY' ? (
            <div className="text-xs text-plum-700 space-y-1">
              <span className="font-bold text-plum-900 block text-sm">
                {order.delivery_address?.full_name}
              </span>
              <p>{order.delivery_address?.address_line1}</p>
              {order.delivery_address?.address_line2 && <p>{order.delivery_address.address_line2}</p>}
              <p>
                {order.delivery_address?.city}, {order.delivery_address?.state} -{' '}
                <strong>{order.delivery_address?.pin_code || order.delivery_address?.postal_code}</strong>
              </p>
              <p className="font-mono text-plum-500 pt-1">
                Mobile: +91 {order.delivery_address?.mobile_number || order.delivery_address?.phone}
              </p>
            </div>
          ) : (
            <div className="text-xs text-plum-700 space-y-2">
              <div>
                <span className="font-semibold text-plum-900 block">Pickup Contact:</span>
                <p>{order?.pickup_details?.pickup_person_name} (+91 {order?.pickup_details?.pickup_person_phone})</p>
              </div>
              <div>
                <span className="font-semibold text-plum-900 block">Pickup Location:</span>
                <p>{order?.pickup_details?.store_location || 'Sanjana Mobiles Store, Indiranagar, Bengaluru'}</p>
              </div>
              <p className="text-[11px] text-coral-600 bg-coral-50 p-2 rounded-xl">
                {order?.pickup_details?.ready_instructions || 'Please present photo ID at the concierge.'}
              </p>
            </div>
          )}
        </div>

        {/* Payment Summary */}
        <div className="bg-white rounded-3xl border border-plum-100 p-6 shadow-card space-y-3">
          <h3 className="font-display font-bold text-sm text-plum-900 border-b border-plum-100 pb-2 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-plum-700" /> Payment Receipt
          </h3>

          <div className="space-y-2 text-xs text-plum-600">
            <div className="flex justify-between">
              <span>Payment Mode</span>
              <span className="font-semibold text-plum-900">Direct UPI / Google Pay</span>
            </div>
            {order?.upi_utr && (
              <div className="flex justify-between">
                <span>UPI Reference (UTR)</span>
                <span className="font-mono text-[11px] font-bold text-plum-900">{order.upi_utr}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Payment Status</span>
              <span className="font-bold text-xs">
                {order?.payment_status === 'VERIFIED' || order?.payment_status === 'PAID' ? (
                  <span className="text-emerald-700">Verified</span>
                ) : order?.payment_status === 'REJECTED' ? (
                  <span className="text-red-600">Rejected</span>
                ) : (
                  <span className="text-blue-700">Verification Pending</span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-plum-900">{formatPrice(order?.subtotal || 0)}</span>
            </div>
            {order && order.discount_amount > 0 && (
              <div className="flex justify-between text-coral-600 font-semibold">
                <span>Discount</span>
                <span>-{formatPrice(order.discount_amount)}</span>
              </div>
            )}
            {order && order.coins_redeemed && order.coins_redeemed > 0 && (
              <div className="flex justify-between text-coral-600 font-semibold">
                <span>Loyalty Coins Redeemed ({order.coins_redeemed} coins)</span>
                <span>-{formatPrice(order.coin_discount_amount || 0)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Delivery Charges</span>
              <span className="font-semibold text-plum-900">
                {order?.delivery_charge === 0 ? 'Free' : formatPrice(order?.delivery_charge || 0)}
              </span>
            </div>
            <div className="border-t border-plum-100 pt-2 flex justify-between font-bold text-sm text-plum-950">
              <span>Total Paid</span>
              <span className="font-display font-extrabold text-base">{formatPrice(order?.total_amount || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ordered Items List */}
      <div className="bg-white rounded-3xl border border-plum-100 p-6 shadow-card space-y-4">
        <h3 className="font-display font-bold text-base text-plum-900 border-b border-plum-100 pb-3">
          Ordered Pieces ({order?.items?.length || 0})
        </h3>

        <div className="divide-y divide-plum-50">
          {order?.items?.map((item) => (
            <div key={item.id} className="py-3 flex items-center justify-between text-xs gap-4">
              <div className="flex items-center gap-3">
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-12 h-12 rounded-xl object-cover border border-plum-100"
                  />
                )}
                <div>
                  <h4 className="font-bold text-plum-900">{item.title}</h4>
                  <span className="text-plum-400 font-mono text-[11px]">SKU: {item.sku}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="font-bold text-plum-950 font-display block text-sm">
                  {formatPrice(item.subtotal)}
                </span>
                <span className="text-[11px] text-plum-400">
                  {item.quantity} × {formatPrice(item.price_snapshot)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="text-center pt-4">
        <Link to="/products">
          <Button variant="outline" size="md">
            Continue Exploring Creations
          </Button>
        </Link>
      </div>
    </div>
  );
};
