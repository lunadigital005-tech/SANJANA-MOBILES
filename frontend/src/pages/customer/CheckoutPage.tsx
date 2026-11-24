import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Truck,
  Store,
  MapPin,
  Plus,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Lock,
  Loader2,
  Coins,
  Sparkles,
  Smartphone,
  QrCode,
  Copy,
  ExternalLink,
  Info
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { Address, CartCalculationResult, CustomerWallet } from '../../types';
import { formatPrice, storeConfig } from '../../config/store';
import { paymentConfig, buildUpiPaymentUri } from '../../config/payment';
import { Button } from '../../components/common/Button';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, clearCart } = useCart();
  const { user, token } = useAuth();
  const isAuthenticated = Boolean(user || token);
  const { showToast } = useToast();

  const [deliveryMethod, setDeliveryMethod] = useState<'HOME_DELIVERY' | 'STORE_PICKUP'>('HOME_DELIVERY');
  
  // Addresses state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showNewAddressModal, setShowNewAddressModal] = useState(false);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // New Address Form State
  const [newAddress, setNewAddress] = useState({
    full_name: '',
    mobile_number: '',
    address_line1: '',
    address_line2: '',
    city: '',
    district: '',
    state: '',
    pin_code: '',
    country: 'India',
    is_default: true,
    address_type: 'home' as 'home' | 'work' | 'other'
  });
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});

  // Store Pickup Contact
  const [pickupContact, setPickupContact] = useState({
    name: user?.full_name || '',
    phone: user?.phone || ''
  });
  const [pickupErrors, setPickupErrors] = useState<Record<string, string>>({});

  // Calculations
  const [calcResult, setCalcResult] = useState<CartCalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(true);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

  // Loyalty Rewards Wallet State
  const [wallet, setWallet] = useState<CustomerWallet | null>(null);
  const [coinsToRedeem, setCoinsToRedeem] = useState<number>(0);
  const [useCoins, setUseCoins] = useState<boolean>(false);

  // UPI Payment Modal State
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [activeOrder, setActiveOrder] = useState<{
    order_id: string;
    order_number: string;
    final_amount: number;
    upi_uri: string;
    upi_id: string;
    merchant_name: string;
    qr_code_image_url?: string;
  } | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [useOfficialQr, setUseOfficialQr] = useState<boolean>(true);
  const [customerUtr, setCustomerUtr] = useState<string>('');
  const [utrError, setUtrError] = useState<string>('');
  const [isSubmittingUtr, setIsSubmittingUtr] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Fetch Saved Addresses & Wallet
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const fetchAddresses = async () => {
      setIsLoadingAddresses(true);
      try {
        const res = await api.getAddresses(token);
        setAddresses(res);
        const def = res.find((a) => a.is_default) || res[0];
        if (def) {
          setSelectedAddressId(def.id);
        }
      } catch (e) {
        console.error('Failed to load addresses', e);
      } finally {
        setIsLoadingAddresses(false);
      }
    };

    fetchAddresses();

    api.getMyWallet(token)
      .then((w) => {
        setWallet(w);
        if (w.available_coins >= (w.min_redemption_coins || 10)) {
          setCoinsToRedeem(Math.min(w.available_coins, w.max_redemption_coins || 500));
        }
      })
      .catch((e) => console.error('Failed to load wallet', e));
  }, [isAuthenticated, token]);

  // Recalculate Cart on Server
  useEffect(() => {
    if (items.length === 0) {
      setIsCalculating(false);
      return;
    }

    const runCalculation = async () => {
      setIsCalculating(true);
      try {
        const result = await api.calculateCart({
          items: items.map((it) => ({
            product_id: it.product.id,
            quantity: it.quantity
          })),
          delivery_method: deliveryMethod
        });
        setCalcResult(result);
      } catch (err: any) {
        showToast(err.message || 'Error validating cart availability', 'error');
      } finally {
        setIsCalculating(false);
      }
    };

    runCalculation();
  }, [items, deliveryMethod]);

  // Generate QR Code dynamically when activeOrder changes
  useEffect(() => {
    if (activeOrder && activeOrder.upi_uri) {
      QRCode.toDataURL(activeOrder.upi_uri, {
        width: 280,
        margin: 2,
        color: {
          dark: '#1e1b4b',
          light: '#ffffff'
        }
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('Failed to generate UPI QR Code', err));
    }
  }, [activeOrder]);

  if (items.length === 0 && !showUpiModal) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold font-display text-plum-900 mb-2">Your Bag is Empty</h2>
        <p className="text-sm text-plum-500 mb-6">Select pieces from our catalog before proceeding to checkout.</p>
        <Link to="/products">
          <Button variant="primary">Browse Mobile Catalog</Button>
        </Link>
      </div>
    );
  }

  // Validate Indian Address with specific user messages
  const validateAddress = () => {
    const errors: Record<string, string> = {};
    if (!newAddress.full_name.trim()) errors.full_name = 'Please enter your full name.';
    if (!newAddress.address_line1.trim()) errors.address_line1 = 'Please enter your address.';
    if (!newAddress.city.trim()) errors.city = 'Please enter your city.';
    if (!newAddress.state.trim()) errors.state = 'Please enter your state.';

    // 10-digit Indian Mobile regex
    const mobileRegex = /^[6-9]\d{9}$/;
    const cleanMobile = newAddress.mobile_number.replace(/[\s\-\+]/g, '');
    if (!mobileRegex.test(cleanMobile)) {
      errors.mobile_number = 'Enter a valid 10-digit mobile number.';
    }

    // 6-digit Indian PIN code regex
    const pinRegex = /^[1-9][0-9]{5}$/;
    if (!pinRegex.test(newAddress.pin_code.trim())) {
      errors.pin_code = 'Enter a valid 6-digit PIN code.';
    }

    setAddressErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAddress()) return;

    setIsSavingAddress(true);
    try {
      const activeToken = token || 'mock-customer-token';
      const created = await api.createAddress(activeToken, {
        ...newAddress,
        phone: newAddress.mobile_number,
        postal_code: newAddress.pin_code
      } as any);

      setAddresses((prev) => [created, ...prev]);
      setSelectedAddressId(created.id);
      setShowNewAddressModal(false);
      showToast('Delivery address saved successfully', 'success');
      // Reset form
      setNewAddress({
        full_name: '',
        mobile_number: '',
        address_line1: '',
        address_line2: '',
        city: '',
        district: '',
        state: '',
        pin_code: '',
        country: 'India',
        is_default: false,
        address_type: 'home'
      });
      setAddressErrors({});
    } catch (err: any) {
      showToast(err.message || 'Unable to save address. Please try again.', 'error');
    } finally {
      setIsSavingAddress(false);
    }
  };

  // Handle Checkout & Launch UPI Payment Modal
  const handleProceedToPayment = async () => {
    // 1. Validation checks
    if (deliveryMethod === 'HOME_DELIVERY') {
      if (!selectedAddressId && addresses.length === 0) {
        showToast('Please add a delivery address to continue.', 'error');
        setShowNewAddressModal(true);
        return;
      }
    } else {
      const pErrors: Record<string, string> = {};
      if (!pickupContact.name.trim()) pErrors.name = 'Pickup contact name is required';
      const mobileRegex = /^[6-9]\d{9}$/;
      if (!mobileRegex.test(pickupContact.phone.replace(/[\s\-\+]/g, ''))) {
        pErrors.phone = 'Valid 10-digit mobile number required for pickup';
      }
      if (Object.keys(pErrors).length > 0) {
        setPickupErrors(pErrors);
        showToast('Please fill out the pickup details correctly.', 'error');
        return;
      }
    }

    setIsProcessingOrder(true);
    const activeToken = token || 'mock-customer-token';

    try {
      // 2. Initiate checkout with backend
      const checkoutInit = await api.initiateCheckout(activeToken, {
        items: items.map((it) => ({
          product_id: it.product.id,
          quantity: it.quantity
        })),
        delivery_method: deliveryMethod,
        payment_method: deliveryMethod === 'STORE_PICKUP' ? 'PAY_AT_STORE' : 'UPI',
        address_id: deliveryMethod === 'HOME_DELIVERY' ? selectedAddressId : undefined,
        pickup_person_name: deliveryMethod === 'STORE_PICKUP' ? pickupContact.name : undefined,
        pickup_person_phone: deliveryMethod === 'STORE_PICKUP' ? pickupContact.phone : undefined,
        coins_to_redeem: useCoins && coinsToRedeem > 0 ? coinsToRedeem : undefined
      });

      // 3. If paid in full with loyalty coins, directly confirm
      if (checkoutInit.is_full_coin_payment) {
        clearCart();
        showToast('Order confirmed! Paid in full with Loyalty Coins.', 'success');
        navigate(`/order-confirmation/${checkoutInit.order_number}`);
        return;
      }

      // 4. FEATURE 1: Direct Store Pickup (Pay at Store - no online payment required)
      if (deliveryMethod === 'STORE_PICKUP' || checkoutInit.is_pay_at_store) {
        clearCart();
        showToast('Store Pickup order placed! Visit SANJANA MOBILES to pay and collect your order.', 'success');
        navigate(`/order-confirmation/${checkoutInit.order_number}`);
        return;
      }

      // 5. Doorstep Delivery: Launch UPI payment modal
      const payableAmount = checkoutInit.amount_in_paise / 100;
      const upiUri = checkoutInit.upi_uri || buildUpiPaymentUri({
        upiId: paymentConfig.upiId,
        merchantName: paymentConfig.merchantName,
        amount: payableAmount,
        orderReference: checkoutInit.order_number
      });

      setActiveOrder({
        order_id: checkoutInit.order_id,
        order_number: checkoutInit.order_number,
        final_amount: payableAmount,
        upi_uri: upiUri,
        upi_id: checkoutInit.upi_id || paymentConfig.upiId,
        merchant_name: checkoutInit.merchant_name || paymentConfig.merchantName,
        qr_code_image_url: checkoutInit.qr_code_image_url || (checkoutInit as any).qr_code_url
      });
      setUseOfficialQr(Boolean(checkoutInit.qr_code_image_url || (checkoutInit as any).qr_code_url));

      setShowUpiModal(true);
    } catch (err: any) {
      showToast(err.message || 'Could not initiate checkout session', 'error');
    } finally {
      setIsProcessingOrder(false);
    }
  };

  // Handle UTR Submission
  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;

    const trimmedUtr = customerUtr.trim();
    if (!trimmedUtr) {
      setUtrError('Please enter the 12-digit UPI reference number (UTR).');
      return;
    }

    if (trimmedUtr.length < 6 || trimmedUtr.length > 30) {
      setUtrError('Please enter a valid UPI transaction reference / UTR number.');
      return;
    }

    setIsSubmittingUtr(true);
    setUtrError('');

    try {
      const activeToken = token || 'mock-customer-token';
      const res = await api.submitUpiPayment(activeToken, {
        order_id: activeOrder.order_id,
        upi_utr: trimmedUtr,
        customer_notes: `Customer submitted via Web Checkout`
      });

      if (res.success) {
        clearCart();
        showToast('Payment details submitted! Order is now awaiting verification.', 'success');
        setShowUpiModal(false);
        navigate(`/order-confirmation/${activeOrder.order_number}`);
      }
    } catch (err: any) {
      setUtrError(err.message || 'Failed to submit payment details. Please try again.');
    } finally {
      setIsSubmittingUtr(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-plum-500">
        <Link to="/cart" className="hover:text-plum-900 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Cart
        </Link>
        <span>/</span>
        <span className="text-plum-900 font-semibold">Secure Checkout</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Delivery & Shipping Forms */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Step 1: Delivery Method Toggle */}
          <div className="bg-white rounded-3xl border border-plum-100 p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-display text-plum-900">
                1. Select Delivery Method
              </h2>
              <span className="text-xs bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-full font-semibold">
                Fast Courier Across India
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setDeliveryMethod('HOME_DELIVERY')}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                  deliveryMethod === 'HOME_DELIVERY'
                    ? 'border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-600/20'
                    : 'border-plum-100 hover:border-plum-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
                    <Truck className="w-4 h-4" />
                  </div>
                  {deliveryMethod === 'HOME_DELIVERY' && (
                    <CheckCircle className="w-4 h-4 text-indigo-600" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-plum-900">Doorstep Delivery</h4>
                  <p className="text-xs text-plum-500 mt-0.5">
                    Safe delivery to your address anywhere in India. Free on orders above ₹999.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryMethod('STORE_PICKUP')}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                  deliveryMethod === 'STORE_PICKUP'
                    ? 'border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-600/20'
                    : 'border-plum-100 hover:border-plum-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
                    <Store className="w-4 h-4" />
                  </div>
                  {deliveryMethod === 'STORE_PICKUP' && (
                    <CheckCircle className="w-4 h-4 text-indigo-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-bold text-plum-900">Direct Store Pickup</h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                      Free
                    </span>
                  </div>
                  <p className="text-xs text-plum-500 mt-0.5">
                    Collect directly from SANJANA MOBILES shop. Ready within 2 hours.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Step 2A: Delivery Address Selection (If Home Delivery) */}
          {deliveryMethod === 'HOME_DELIVERY' && (
            <div className="bg-white rounded-3xl border border-plum-100 p-6 shadow-card space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold font-display text-plum-900">
                    2. Delivery Address
                  </h2>
                  <p className="text-xs text-plum-500">
                    Valid Indian address with 6-digit PIN code & 10-digit mobile required.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewAddressModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add New Address
                </button>
              </div>

              {isLoadingAddresses ? (
                <div className="flex items-center justify-center py-6 text-plum-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading saved addresses...
                </div>
              ) : addresses.length === 0 ? (
                <div className="border-2 border-dashed border-plum-200 rounded-2xl p-6 text-center space-y-3">
                  <MapPin className="w-8 h-8 text-plum-300 mx-auto" />
                  <p className="text-xs text-plum-600 font-medium">No saved addresses found.</p>
                  <Button size="sm" variant="outline" onClick={() => setShowNewAddressModal(true)}>
                    Add First Address
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id;
                    return (
                      <div
                        key={addr.id}
                        onClick={() => setSelectedAddressId(addr.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-600/10'
                            : 'border-plum-100 hover:border-plum-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-plum-950">
                              {addr.full_name}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-plum-100 text-plum-800 px-2 py-0.5 rounded-full">
                              {addr.address_type}
                            </span>
                            {addr.is_default && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-plum-700">
                            {addr.address_line1}
                            {addr.address_line2 ? `, ${addr.address_line2}` : ''}
                          </p>
                          <p className="text-xs text-plum-500">
                            {addr.city}, {addr.state} - <strong className="text-plum-900">{addr.pin_code || addr.postal_code}</strong>
                          </p>
                          <p className="text-xs text-plum-600 font-mono">
                            Mobile: +91 {addr.mobile_number || addr.phone}
                          </p>
                        </div>
                        <input
                          type="radio"
                          name="selectedAddress"
                          checked={isSelected}
                          onChange={() => setSelectedAddressId(addr.id)}
                          className="mt-1 text-indigo-600 focus:ring-indigo-600"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 2B: Store Pickup Contact Info (If Store Pickup) */}
          {deliveryMethod === 'STORE_PICKUP' && (
            <div className="bg-white rounded-3xl border border-plum-100 p-6 shadow-card space-y-6">
              <div>
                <h2 className="text-lg font-bold font-display text-plum-900">
                  2. Pickup Information
                </h2>
                <p className="text-xs text-plum-500">
                  Provide contact details for the person collecting the order at our SANJANA MOBILES store.
                </p>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-950 space-y-1">
                <div className="font-bold flex items-center gap-2">
                  <Store className="w-4 h-4 text-emerald-700" />
                  SANJANA MOBILES Store
                </div>
                <p className="text-emerald-800">
                  {storeConfig.contact.address}
                </p>
                <p className="text-[11px] text-emerald-700 mt-2">
                  * Please bring an official Photo ID and your Order Number for collection.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-plum-900 mb-1">
                    Pickup Person Full Name *
                  </label>
                  <input
                    type="text"
                    value={pickupContact.name}
                    onChange={(e) => setPickupContact({ ...pickupContact, name: e.target.value })}
                    placeholder="Full name as on ID"
                    className="w-full text-xs bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2.5 text-plum-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  {pickupErrors.name && (
                    <span className="text-[11px] text-red-600 block mt-1">{pickupErrors.name}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-plum-900 mb-1">
                    Pickup Contact Mobile *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-plum-400 font-medium">+91</span>
                    <input
                      type="tel"
                      value={pickupContact.phone}
                      onChange={(e) => setPickupContact({ ...pickupContact, phone: e.target.value })}
                      placeholder="9876543210"
                      maxLength={10}
                      className="w-full text-xs bg-ivory/60 border border-plum-200 rounded-xl pl-10 pr-3 py-2.5 text-plum-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 font-mono"
                    />
                  </div>
                  {pickupErrors.phone && (
                    <span className="text-[11px] text-red-600 block mt-1">{pickupErrors.phone}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Payment Method Section */}
          {deliveryMethod === 'STORE_PICKUP' ? (
            <div className="bg-white rounded-3xl border border-emerald-200 p-6 shadow-card space-y-4">
              <h2 className="text-lg font-bold font-display text-plum-900 flex items-center justify-between">
                <span>3. Payment Method</span>
                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Pay at Store Enabled
                </span>
              </h2>

              <div className="p-5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/40 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-700 flex items-center justify-center text-white shrink-0 shadow-sm">
                    <Store className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-plum-950">Pay at Store</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        No Online Payment Required
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 font-bold mt-1">
                      Pay at Store – Visit SANJANA MOBILES and pay when collecting your order.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-white/90 rounded-xl border border-emerald-200/80 text-xs text-plum-700 space-y-1.5">
                  <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-emerald-600" /> Physical Store Collection Notice:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-plum-600 text-[11px] leading-relaxed">
                    <li>Your items are reserved immediately. No upfront online payment needed.</li>
                    <li>Pay by <strong>Cash, UPI, or Card</strong> when you inspect and collect your phone/accessories at the store.</li>
                    <li>Address: <strong>{storeConfig.contact.address}</strong></li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-plum-100 p-6 shadow-card space-y-4">
              <h2 className="text-lg font-bold font-display text-plum-900 flex items-center justify-between">
                <span>3. Payment Method</span>
                <span className="text-xs text-plum-500 font-normal flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" /> Direct UPI & Bank Verification
                </span>
              </h2>

              <div className="p-4 rounded-2xl border-2 border-indigo-600 bg-indigo-50/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-700 flex items-center justify-center text-white">
                    <Smartphone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-plum-950">Google Pay & Any UPI App</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                        Zero Fees • Direct Bank
                      </span>
                    </div>
                    <p className="text-xs text-plum-500 mt-0.5">
                      Pay securely using Google Pay, PhonePe, Paytm, BHIM, or any UPI app.
                    </p>
                  </div>
                </div>
                <CheckCircle className="w-5 h-5 text-indigo-600" />
              </div>

              <div className="text-xs text-plum-600 bg-plum-50/50 p-3 rounded-xl space-y-1">
                <p className="font-semibold text-plum-800">How UPI Payment works:</p>
                <ul className="list-disc list-inside space-y-0.5 text-plum-600">
                  <li>Place your order to receive your dynamic order QR code and UPI link.</li>
                  <li>On mobile: Click <strong>"Pay with UPI"</strong> to open Google Pay or your preferred UPI app.</li>
                  <li>On desktop: Scan the dynamic QR code with your phone.</li>
                  <li>Enter the 12-digit UPI reference number (UTR) to confirm your payment.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Order Summary & Pay CTA */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-plum-100 p-6 shadow-card sticky top-28 space-y-6">
            <h3 className="font-display font-bold text-lg text-plum-900 border-b border-plum-100 pb-3">
              Order Review
            </h3>

            {/* Items List */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {items.map((it) => (
                <div key={it.product.id} className="flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={it.product.primary_image || it.product.images?.[0] || ''}
                      alt={it.product.title}
                      className="w-11 h-11 object-cover rounded-xl bg-ivory border border-plum-100"
                    />
                    <div>
                      <h5 className="font-semibold text-plum-900 line-clamp-1">{it.product.title}</h5>
                      <span className="text-plum-400 text-[11px]">Qty: {it.quantity}</span>
                    </div>
                  </div>
                  <span className="font-bold text-plum-950 shrink-0 font-display">
                    {formatPrice((it.product.sale_price || it.product.price) * it.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Loyalty Coins Redemption */}
            {wallet && wallet.available_coins >= (wallet.min_redemption_coins || 10) && (
              <div className="border border-plum-100 bg-ivory/80 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-plum-900 text-amber-400 flex items-center justify-center">
                      <Coins className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-plum-900 flex items-center gap-1.5">
                        Sanjana Loyalty Coins
                        <Sparkles className="w-3 h-3 text-amber-500" />
                      </h4>
                      <p className="text-[11px] text-plum-500">
                        Balance: <strong className="text-plum-900">{wallet.available_coins} coins</strong> (₹{wallet.monetary_value.toFixed(2)})
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCoins}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUseCoins(checked);
                        if (checked && coinsToRedeem === 0) {
                          const maxRedeem = Math.min(
                            wallet.available_coins,
                            wallet.max_redemption_coins || 500,
                            Math.floor(calcResult?.final_total || 0)
                          );
                          setCoinsToRedeem(maxRedeem);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-plum-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-plum-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {useCoins && (
                  <div className="pt-2 border-t border-plum-100/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-plum-600">Coins to apply:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={wallet.min_redemption_coins || 10}
                          max={Math.min(
                            wallet.available_coins,
                            wallet.max_redemption_coins || 500,
                            Math.floor(calcResult?.final_total || 0)
                          )}
                          value={coinsToRedeem}
                          onChange={(e) => {
                            const maxVal = Math.min(
                              wallet.available_coins,
                              wallet.max_redemption_coins || 500,
                              Math.floor(calcResult?.final_total || 0)
                            );
                            const val = parseInt(e.target.value) || 0;
                            setCoinsToRedeem(Math.min(maxVal, Math.max(0, val)));
                          }}
                          className="w-20 text-right px-2 py-1 text-xs border border-plum-200 rounded-lg font-bold text-plum-900 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const maxVal = Math.min(
                              wallet.available_coins,
                              wallet.max_redemption_coins || 500,
                              Math.floor(calcResult?.final_total || 0)
                            );
                            setCoinsToRedeem(maxVal);
                          }}
                          className="text-[10px] uppercase font-bold text-indigo-600 hover:text-indigo-700 underline"
                        >
                          Max
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between text-[11px] text-indigo-700 bg-indigo-50/70 px-2 py-1 rounded-md font-medium">
                      <span>Discount applied:</span>
                      <span>
                        -{formatPrice(
                          Math.min(coinsToRedeem * (wallet.monetary_value / wallet.available_coins || 1.0), calcResult?.final_total || 0)
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Calculations Breakdown */}
            <div className="border-t border-plum-100 pt-4 space-y-2.5 text-xs text-plum-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-plum-900">
                  {isCalculating ? '...' : formatPrice(calcResult?.subtotal || 0)}
                </span>
              </div>

              {calcResult && calcResult.discount_amount > 0 && (
                <div className="flex justify-between text-indigo-600 font-semibold">
                  <span>Voucher Discount</span>
                  <span>-{formatPrice(calcResult.discount_amount)}</span>
                </div>
              )}

              {useCoins && coinsToRedeem > 0 && wallet && (
                <div className="flex justify-between text-indigo-600 font-semibold">
                  <span className="flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" /> Coins Discount ({coinsToRedeem} coins)
                  </span>
                  <span>
                    -{formatPrice(
                      Math.min(coinsToRedeem * (wallet.monetary_value / wallet.available_coins || 1.0), calcResult?.final_total || 0)
                    )}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Delivery Charge</span>
                <span className="font-semibold text-plum-900">
                  {isCalculating ? (
                    '...'
                  ) : calcResult?.delivery_charge === 0 ? (
                    <span className="text-emerald-700 font-bold">Free</span>
                  ) : (
                    formatPrice(calcResult?.delivery_charge || 0)
                  )}
                </span>
              </div>
            </div>

            {/* Final Total */}
            {(() => {
              const discount = useCoins && coinsToRedeem > 0 && wallet
                ? Math.min(coinsToRedeem * (wallet.monetary_value / wallet.available_coins || 1.0), calcResult?.final_total || 0)
                : 0;
              const payable = Math.max(0, (calcResult?.final_total || 0) - discount);
              const isFullCoin = payable === 0 && discount > 0;

              return (
                <>
                  <div className="border-t border-plum-100 pt-4 flex justify-between items-baseline">
                    <div>
                      <span className="text-sm font-bold text-plum-900 block">Payable Total</span>
                      <span className="text-[11px] text-plum-400">
                        {isFullCoin ? 'Fully covered by Loyalty Coins' : 'Indian Rupees (INR)'}
                      </span>
                    </div>
                    <span className={`text-2xl font-extrabold font-display ${isFullCoin ? 'text-emerald-700' : 'text-plum-950'}`}>
                      {isCalculating ? '...' : formatPrice(payable)}
                    </span>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    className={`w-full shadow-lg ${
                      deliveryMethod === 'STORE_PICKUP'
                        ? 'shadow-emerald-600/25 bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'shadow-indigo-600/25 bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                    disabled={isCalculating || isProcessingOrder || (calcResult?.has_unavailable_items ?? false)}
                    onClick={handleProceedToPayment}
                    rightIcon={
                      isProcessingOrder ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )
                    }
                  >
                    {isProcessingOrder
                      ? (deliveryMethod === 'STORE_PICKUP' ? 'Placing Store Pickup Order...' : 'Generating UPI Payment...')
                      : isFullCoin
                      ? `Confirm with ${coinsToRedeem} Coins (${formatPrice(0)})`
                      : deliveryMethod === 'STORE_PICKUP'
                      ? `Place Order (Pay at Store) • ${formatPrice(payable)}`
                      : `Proceed to UPI Payment • ${formatPrice(payable)}`}
                  </Button>
                </>
              );
            })()}

            <div className="p-3 bg-plum-50/50 rounded-2xl flex items-center gap-2.5 text-[11px] text-plum-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Stock is dynamically reserved for 30 minutes during checkout.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Address Modal with Specific User Friendly Validations */}
      {showNewAddressModal && (
        <div className="fixed inset-0 z-50 bg-plum-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-plum-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-plum-100 pb-3">
              <h3 className="font-display font-bold text-lg text-plum-900">
                Add New Delivery Address
              </h3>
              <button
                type="button"
                onClick={() => setShowNewAddressModal(false)}
                className="text-plum-400 hover:text-plum-900 font-bold text-lg"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveAddress} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-plum-900 mb-1">Recipient Full Name *</label>
                <input
                  type="text"
                  value={newAddress.full_name}
                  onChange={(e) => {
                    setNewAddress({ ...newAddress, full_name: e.target.value });
                    if (addressErrors.full_name) setAddressErrors({ ...addressErrors, full_name: '' });
                  }}
                  placeholder="e.g. Sanjana Patel"
                  className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                {addressErrors.full_name && (
                  <span className="text-red-600 text-[11px] block mt-0.5">{addressErrors.full_name}</span>
                )}
              </div>

              <div>
                <label className="block font-bold text-plum-900 mb-1">
                  10-Digit Indian Mobile Number *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-plum-400 font-medium">+91</span>
                  <input
                    type="tel"
                    value={newAddress.mobile_number}
                    onChange={(e) => {
                      setNewAddress({ ...newAddress, mobile_number: e.target.value });
                      if (addressErrors.mobile_number) setAddressErrors({ ...addressErrors, mobile_number: '' });
                    }}
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full bg-ivory/60 border border-plum-200 rounded-xl pl-10 pr-3 py-2 text-plum-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                {addressErrors.mobile_number && (
                  <span className="text-red-600 text-[11px] block mt-0.5">{addressErrors.mobile_number}</span>
                )}
              </div>

              <div>
                <label className="block font-bold text-plum-900 mb-1">Address Line 1 (Flat/House/Street) *</label>
                <input
                  type="text"
                  value={newAddress.address_line1}
                  onChange={(e) => {
                    setNewAddress({ ...newAddress, address_line1: e.target.value });
                    if (addressErrors.address_line1) setAddressErrors({ ...addressErrors, address_line1: '' });
                  }}
                  placeholder="e.g. Shop No. 5, Gandhi Road"
                  className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                {addressErrors.address_line1 && (
                  <span className="text-red-600 text-[11px] block mt-0.5">{addressErrors.address_line1}</span>
                )}
              </div>

              <div>
                <label className="block font-bold text-plum-900 mb-1">Address Line 2 (Area/Landmark)</label>
                <input
                  type="text"
                  value={newAddress.address_line2}
                  onChange={(e) => setNewAddress({ ...newAddress, address_line2: e.target.value })}
                  placeholder="e.g. Near Bus Stand"
                  className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-plum-900 mb-1">City *</label>
                  <input
                    type="text"
                    value={newAddress.city}
                    onChange={(e) => {
                      setNewAddress({ ...newAddress, city: e.target.value });
                      if (addressErrors.city) setAddressErrors({ ...addressErrors, city: '' });
                    }}
                    placeholder="e.g. Bengaluru"
                    className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  {addressErrors.city && (
                    <span className="text-red-600 text-[11px] block mt-0.5">{addressErrors.city}</span>
                  )}
                </div>
                <div>
                  <label className="block font-bold text-plum-900 mb-1">State *</label>
                  <input
                    type="text"
                    value={newAddress.state}
                    onChange={(e) => {
                      setNewAddress({ ...newAddress, state: e.target.value });
                      if (addressErrors.state) setAddressErrors({ ...addressErrors, state: '' });
                    }}
                    placeholder="e.g. Karnataka"
                    className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  {addressErrors.state && (
                    <span className="text-red-600 text-[11px] block mt-0.5">{addressErrors.state}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-plum-900 mb-1">6-Digit PIN Code *</label>
                  <input
                    type="text"
                    value={newAddress.pin_code}
                    onChange={(e) => {
                      setNewAddress({ ...newAddress, pin_code: e.target.value });
                      if (addressErrors.pin_code) setAddressErrors({ ...addressErrors, pin_code: '' });
                    }}
                    placeholder="560001"
                    maxLength={6}
                    className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  {addressErrors.pin_code && (
                    <span className="text-red-600 text-[11px] block mt-0.5">{addressErrors.pin_code}</span>
                  )}
                </div>
                <div>
                  <label className="block font-bold text-plum-900 mb-1">Address Type</label>
                  <select
                    value={newAddress.address_type}
                    onChange={(e) => setNewAddress({ ...newAddress, address_type: e.target.value as any })}
                    className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900"
                  >
                    <option value="home">Home</option>
                    <option value="work">Work</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="defAddrCheck"
                  checked={newAddress.is_default}
                  onChange={(e) => setNewAddress({ ...newAddress, is_default: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-600"
                />
                <label htmlFor="defAddrCheck" className="text-xs text-plum-700 cursor-pointer">
                  Set as default delivery address
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-plum-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowNewAddressModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSavingAddress}>
                  {isSavingAddress ? 'Saving...' : 'Save Address'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPI Payment Modal (Google Pay & UPI Apps with Dynamic QR & UTR Submission) */}
      {showUpiModal && activeOrder && (
        <div className="fixed inset-0 z-50 bg-plum-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-plum-100 space-y-5 max-h-[95vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-plum-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-plum-900">
                    Pay via UPI / Google Pay
                  </h3>
                  <span className="text-[11px] text-plum-500">
                    Order Ref: <strong className="text-plum-800">{activeOrder.order_number}</strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUpiModal(false)}
                className="text-plum-400 hover:text-plum-900 font-bold text-xl px-2"
              >
                ×
              </button>
            </div>

            {/* Payable Amount Highlight */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-4 text-center">
              <span className="text-xs text-indigo-700 font-medium block">Total Payable Amount</span>
              <span className="text-3xl font-extrabold font-display text-indigo-950 block mt-0.5">
                {formatPrice(activeOrder.final_amount)}
              </span>
              <span className="text-[11px] text-indigo-600 mt-1 inline-block">
                Merchant: <strong>{activeOrder.merchant_name}</strong>
              </span>
            </div>

            {/* QR Code Section (Supports Official Shop QR and Dynamic Order QR) */}
            <div className="border border-plum-100 rounded-2xl p-4 bg-white text-center space-y-3">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-plum-900">
                  <QrCode className="w-4 h-4 text-indigo-600" />
                  <span>
                    {activeOrder.qr_code_image_url && useOfficialQr 
                      ? 'Official Shop Google Pay / UPI QR' 
                      : 'Dynamic Order Payment QR'}
                  </span>
                </div>
                {activeOrder.qr_code_image_url && (
                  <button
                    type="button"
                    onClick={() => setUseOfficialQr(!useOfficialQr)}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 underline font-semibold"
                  >
                    {useOfficialQr ? 'Switch to Dynamic QR' : 'Switch to Shop QR'}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-plum-500">
                Open Google Pay, PhonePe, Paytm, or BHIM on your phone and scan:
              </p>

              <div className="inline-block p-3 bg-white border-2 border-indigo-100 rounded-2xl shadow-sm">
                {activeOrder.qr_code_image_url && useOfficialQr ? (
                  <img
                    src={activeOrder.qr_code_image_url}
                    alt="Official SANJANA MOBILES UPI QR Code"
                    className="w-48 h-48 mx-auto object-contain"
                  />
                ) : qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="UPI Payment QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-plum-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </div>

              {/* Shop UPI ID with Copy button */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="text-xs text-plum-500 font-medium">UPI ID:</span>
                <span className="text-xs font-mono font-bold text-plum-900 bg-plum-50 px-2 py-1 rounded-lg border border-plum-200">
                  {activeOrder.upi_id}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(activeOrder.upi_id)}
                  className="p-1 rounded-md text-plum-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Copy UPI ID"
                >
                  {copiedUpi ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Pay with UPI Button (Mobile Intent) */}
            <div className="space-y-2">
              <a
                href={activeOrder.upi_uri}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.99]"
              >
                <Smartphone className="w-4 h-4" />
                <span>Pay with UPI App (Google Pay / PhonePe)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <p className="text-[10px] text-plum-500 text-center">
                * Note: On Android mobile devices, this button opens your installed UPI apps. If scanning on desktop, use the QR code above.
              </p>
            </div>

            {/* UTR / Transaction Reference Submission Form */}
            <form onSubmit={handleSubmitUtr} className="border-t border-plum-100 pt-4 space-y-3">
              <div className="flex items-start gap-2 bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  After completing payment in your UPI app, enter the <strong>12-digit UTR / UPI Reference Number</strong> below to confirm your order.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-plum-900 mb-1">
                  UPI Transaction Reference / UTR Number *
                </label>
                <input
                  type="text"
                  value={customerUtr}
                  onChange={(e) => {
                    setCustomerUtr(e.target.value);
                    if (utrError) setUtrError('');
                  }}
                  placeholder="e.g. 408212345678"
                  className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2.5 text-xs text-plum-900 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                {utrError && (
                  <span className="text-red-600 text-[11px] block mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {utrError}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUpiModal(false)}
                >
                  Pay Later
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingUtr}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isSubmittingUtr ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
                    </span>
                  ) : (
                    'Submit Payment Details'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};