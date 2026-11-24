import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Settings, 
  Save, 
  Shield, 
  Store, 
  Mail, 
  Phone, 
  MapPin, 
  Smartphone, 
  QrCode, 
  CheckCircle, 
  Upload, 
  Clipboard, 
  Trash2, 
  RefreshCw, 
  AlertTriangle, 
  Clock, 
  ExternalLink,
  Info
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { StoreSettings, PaymentSettings } from '../../types';

export const AdminSettingsPage: React.FC = () => {
  const { showToast } = useToast();
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteZoneRef = useRef<HTMLDivElement>(null);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingStore, setIsSavingStore] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const [isRemovingQr, setIsRemovingQr] = useState(false);
  const [showRemoveQrModal, setShowRemoveQrModal] = useState(false);

  // Store Settings Form State
  const [storeName, setStoreName] = useState('SANJANA MOBILES');
  const [tagline, setTagline] = useState('Your Trusted Destination for Genuine Mobiles & Accessories');
  const [addressLine1, setAddressLine1] = useState('100 Feet Road');
  const [addressLine2, setAddressLine2] = useState('Near Metro Pillar 42, Indiranagar');
  const [city, setCity] = useState('Bengaluru');
  const [district, setDistrict] = useState('Bengaluru Urban');
  const [state, setState] = useState('Karnataka');
  const [pinCode, setPinCode] = useState('560038');
  const [country, setCountry] = useState('India');
  const [storeMobile, setStoreMobile] = useState('9876543210');
  const [storeEmail, setStoreEmail] = useState('contact@sanjanamobiles.com');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('https://maps.google.com/?q=12.9716,77.5946');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('999');
  const [businessHours, setBusinessHours] = useState('Mon - Sat: 10:00 AM - 9:00 PM | Sun: 11:00 AM - 8:00 PM');
  const [storeUpdatedAt, setStoreUpdatedAt] = useState<string | null>(null);

  // Payment Settings Form State
  const [upiId, setUpiId] = useState('REPLACE_WITH_REAL_SHOP_UPI_ID');
  const [merchantName, setMerchantName] = useState('SANJANA MOBILES');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [instructions, setInstructions] = useState(
    '1. Scan the QR code using Google Pay, PhonePe, Paytm, or any UPI app.\n' +
    '2. Or click Pay with UPI on mobile.\n' +
    '3. Complete the transfer for the exact order amount.\n' +
    '4. Enter the 12-digit UPI Reference Number / UTR below and submit for verification.'
  );
  const [isUpiEnabled, setIsUpiEnabled] = useState(true);
  const [manualVerificationRequired, setManualVerificationRequired] = useState(true);
  const [paymentUpdatedAt, setPaymentUpdatedAt] = useState<string | null>(null);

  // QR Paste & Drag Preview State
  const [pastedImagePreview, setPastedImagePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // 1. Fetch All Settings on Mount
  const loadAllSettings = useCallback(async () => {
    setIsLoading(true);
    const activeToken = token || 'mock-admin-token';
    try {
      // Fetch both Store Settings and Payment Settings in parallel
      const [paymentData, storeData] = await Promise.allSettled([
        api.adminGetPaymentSettings(activeToken),
        api.adminGetStoreSettings(activeToken)
      ]);

      if (paymentData.status === 'fulfilled' && paymentData.value) {
        const p = paymentData.value;
        setUpiId(p.upi_id || 'REPLACE_WITH_REAL_SHOP_UPI_ID');
        setMerchantName(p.merchant_name || 'SANJANA MOBILES');
        setQrCodeUrl(p.qr_code_url || p.qr_code_image_url || '');
        setInstructions(p.instructions || p.payment_instructions || '');
        setIsUpiEnabled(p.is_upi_enabled ?? true);
        setManualVerificationRequired(p.manual_verification_required ?? true);
        setPaymentUpdatedAt(p.updated_at || null);
      }

      if (storeData.status === 'fulfilled' && storeData.value) {
        const s = storeData.value;
        setStoreName(s.store_name || s.name || 'SANJANA MOBILES');
        setTagline(s.tagline || '');
        setAddressLine1(s.address_line1 || '');
        setAddressLine2(s.address_line2 || '');
        setCity(s.city || '');
        setDistrict(s.district || '');
        setState(s.state || '');
        setPinCode(s.pin_code || '');
        setCountry(s.country || 'India');
        setStoreMobile(s.store_mobile || s.phone || '');
        setStoreEmail(s.store_email || s.email || '');
        setGoogleMapsUrl(s.google_maps_url || '');
        setFreeShippingThreshold(s.free_shipping_threshold ? s.free_shipping_threshold.toString() : '999');
        setBusinessHours(s.business_hours || '');
        setStoreUpdatedAt(s.updated_at || null);
      }
    } catch (err: any) {
      console.error('Failed to load settings', err);
      showToast('Error loading saved settings from database.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    loadAllSettings();
  }, [loadAllSettings]);

  // 2. Handle Clipboard Paste (Ctrl+V) for Official Shop QR Code
  const handlePasteEvent = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          e.preventDefault();
          setIsUploadingQr(true);
          const reader = new FileReader();
          reader.onload = async (event) => {
            try {
              const base64Data = event.target?.result as string;
              setPastedImagePreview(base64Data);

              const activeToken = token || 'mock-admin-token';
              const result = await api.adminPasteQrCode(activeToken, base64Data, `pasted-qr-${Date.now()}.png`);
              if (result && result.url) {
                setQrCodeUrl(result.url);
                showToast('Official QR Code pasted from clipboard and saved to Supabase Storage!', 'success');
              }
            } catch (err: any) {
              showToast(`Unable to save pasted QR code: ${err.message || 'Processing error'}`, 'error');
            } finally {
              setIsUploadingQr(false);
            }
          };
          reader.onerror = () => {
            setIsUploadingQr(false);
            showToast('Failed to read image from clipboard.', 'error');
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    }
  }, [token, showToast]);

  useEffect(() => {
    window.addEventListener('paste', handlePasteEvent);
    return () => {
      window.removeEventListener('paste', handlePasteEvent);
    };
  }, [handlePasteEvent]);

  // 3. Handle File Upload for Official Shop QR Code
  const handleQrFileUpload = async (file: File) => {
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showToast('Unsupported image format. Please upload PNG, JPG, or WEBP.', 'error');
      return;
    }

    // Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size exceeds 5MB limit. Please compress the image.', 'error');
      return;
    }

    setIsUploadingQr(true);
    try {
      const activeToken = token || 'mock-admin-token';
      const result = await api.adminUploadQrCode(activeToken, file);
      if (result && result.url) {
        setQrCodeUrl(result.url);
        showToast('Official Shop QR Code uploaded and saved to Supabase Storage!', 'success');
      }
    } catch (err: any) {
      showToast(`Unable to save QR code: ${err.message || 'Upload error'}`, 'error');
    } finally {
      setIsUploadingQr(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 4. Handle Drag & Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleQrFileUpload(e.dataTransfer.files[0]);
    }
  };

  // 5. Handle Remove Official QR Code
  const handleConfirmRemoveQr = async () => {
    setIsRemovingQr(true);
    try {
      const activeToken = token || 'mock-admin-token';
      await api.adminRemoveQrCode(activeToken);
      setQrCodeUrl('');
      setPastedImagePreview(null);
      setShowRemoveQrModal(false);
      showToast('Official QR Code removed. Checkout will use dynamic order QR codes.', 'info');
    } catch (err: any) {
      showToast(`Unable to remove QR code: ${err.message || 'Error'}`, 'error');
    } finally {
      setIsRemovingQr(false);
    }
  };

  // 6. Save Store Address & Branding Settings
  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingStore(true);
    try {
      // Validate Indian PIN Code
      const cleanPin = pinCode.trim();
      if (!/^\d{6}$/.test(cleanPin)) {
        throw new Error('Please enter a valid 6-digit Indian PIN Code.');
      }

      // Validate 10-digit mobile
      const cleanMobile = storeMobile.replace(/\D/g, '');
      if (cleanMobile.length !== 10) {
        throw new Error('Store mobile number must be exactly 10 digits.');
      }

      const activeToken = token || 'mock-admin-token';
      const updated = await api.adminUpdateStoreSettings(activeToken, {
        store_name: storeName.trim(),
        tagline: tagline.trim(),
        address_line1: addressLine1.trim(),
        address_line2: addressLine2.trim(),
        city: city.trim(),
        district: district.trim(),
        state: state.trim(),
        pin_code: cleanPin,
        country: country.trim() || 'India',
        store_mobile: cleanMobile,
        store_email: storeEmail.trim(),
        google_maps_url: googleMapsUrl.trim(),
        free_shipping_threshold: parseFloat(freeShippingThreshold) || 999.00,
        business_hours: businessHours.trim()
      });

      if (updated) {
        setStoreUpdatedAt(updated.updated_at || new Date().toISOString());
        showToast('Settings saved successfully. Official store address updated.', 'success');
      }
    } catch (err: any) {
      showToast(`Unable to save settings: ${err.message || 'Database error'}`, 'error');
    } finally {
      setIsSavingStore(false);
    }
  };

  // 7. Save UPI Payment Settings
  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPayment(true);
    try {
      const cleanUpi = upiId.trim();
      if (!cleanUpi) {
        throw new Error('UPI ID cannot be blank.');
      }

      if (cleanUpi !== 'REPLACE_WITH_REAL_SHOP_UPI_ID') {
        if (!cleanUpi.includes('@') || cleanUpi.split('@').length !== 2) {
          throw new Error('Invalid UPI ID format. Expected format: username@bank (e.g. sanjanamobiles@oksbi)');
        }
      }

      const activeToken = token || 'mock-admin-token';
      const updated = await api.adminUpdatePaymentSettings(activeToken, {
        upi_id: cleanUpi,
        merchant_name: merchantName.trim(),
        qr_code_url: qrCodeUrl,
        qr_code_image_url: qrCodeUrl,
        instructions: instructions.trim(),
        payment_instructions: instructions.trim(),
        is_upi_enabled: isUpiEnabled,
        manual_verification_required: manualVerificationRequired
      });

      if (updated) {
        setPaymentUpdatedAt(updated.updated_at || new Date().toISOString());
        showToast('Settings saved successfully. Official shop UPI configuration updated.', 'success');
      }
    } catch (err: any) {
      showToast(`Unable to save settings: ${err.message || 'Database error'}`, 'error');
    } finally {
      setIsSavingPayment(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-coral-400 block mb-1">
            Platform Architecture & Central Persistence
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
            Store & Payment Settings
          </h1>
          <p className="text-xs text-plum-300 mt-1">
            Manage SANJANA MOBILES official UPI payment gateway, shop QR code, and business address.
          </p>
        </div>

        <button
          onClick={loadAllSettings}
          disabled={isLoading}
          className="self-start sm:self-auto inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-plum-800 hover:bg-plum-700 text-ivory border border-plum-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Reload From Database</span>
        </button>
      </div>

      {/* Information Banner: Data Isolation Notice */}
      <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-800/80 text-xs text-indigo-200 flex items-start gap-3 shadow-sm">
        <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-white">Verified Database Persistence & Data Isolation</p>
          <p className="text-indigo-300/90 leading-relaxed">
            All updates are saved directly to Supabase tables (<code className="text-coral-300">payment_settings</code> and <code className="text-coral-300">store_settings</code>). 
            Store address updates here define your business pickup counter and brand metadata, and will <strong>never modify customer delivery addresses</strong>.
          </p>
        </div>
      </div>

      {/* SECTION 1: OFFICIAL UPI PAYMENT & QR CODE SETTINGS */}
      <div className="bg-plum-900/60 border border-plum-800/80 rounded-3xl p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-plum-800">
          <div className="flex items-center gap-2 text-white font-display font-bold">
            <Smartphone className="w-5 h-5 text-indigo-400" />
            <span className="text-base sm:text-lg">Official Shop UPI & QR Code Settings</span>
          </div>
          {paymentUpdatedAt && (
            <span className="text-[10px] text-plum-400 font-mono">
              Last saved: {new Date(paymentUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSavePaymentSettings} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
                Official Shop UPI ID (VPA) *
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. sanjanamobiles@oksbi"
                className="w-full rounded-xl border border-plum-700 bg-plum-950 px-4 py-2.5 text-sm text-ivory placeholder:text-plum-600 focus:outline-none focus:border-indigo-400 font-mono"
                required
              />
              <p className="text-[11px] text-plum-400 mt-1">
                Your shop bank UPI VPA where customer Google Pay / PhonePe payments will be directly credited.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
                Merchant Display Name *
              </label>
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="SANJANA MOBILES"
                className="w-full rounded-xl border border-plum-700 bg-plum-950 px-4 py-2.5 text-sm text-ivory placeholder:text-plum-600 focus:outline-none focus:border-indigo-400"
                required
              />
              <p className="text-[11px] text-plum-400 mt-1">
                Name displayed to customers inside their UPI payment apps (Google Pay, PhonePe, Paytm).
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
              Customer Payment Instructions
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder="Instructions displayed to customers during checkout..."
              className="w-full rounded-xl border border-plum-700 bg-plum-950 p-3 text-xs text-ivory placeholder:text-plum-600 focus:outline-none focus:border-indigo-400"
            />
          </div>

          {/* OFFICIAL UPI QR CODE UPLOAD & CLIPBOARD PASTE DROP ZONE */}
          <div className="p-5 rounded-2xl bg-plum-950/80 border border-plum-800 space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-coral-400 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-coral-400" />
                <span>Official Shop Google Pay / UPI QR Code</span>
              </label>
              <span className="text-[10px] text-plum-400 font-medium">PNG, JPG, WEBP (Max 5MB)</span>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* QR Image Preview Card */}
              <div className="flex-shrink-0 text-center">
                {qrCodeUrl ? (
                  <div className="space-y-2">
                    <div className="p-3 bg-white rounded-2xl border-2 border-emerald-500/80 shadow-lg inline-block">
                      <img 
                        src={qrCodeUrl} 
                        alt="Official Shop QR Code" 
                        className="w-32 h-32 object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] text-plum-300 hover:text-white underline font-semibold"
                      >
                        Replace QR
                      </button>
                      <span className="text-plum-600">•</span>
                      <button
                        type="button"
                        onClick={() => setShowRemoveQrModal(true)}
                        className="text-[11px] text-red-400 hover:text-red-300 underline font-semibold flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-plum-700 bg-plum-900/40 flex flex-col items-center justify-center text-plum-500 text-[11px] text-center p-3">
                    <QrCode className="w-8 h-8 mb-1.5 text-plum-400" />
                    <span className="font-semibold text-plum-300">No Image Uploaded</span>
                    <span className="text-[9px] text-plum-500 mt-1">Dynamic QR will be generated</span>
                  </div>
                )}
              </div>

              {/* Paste / Drag & Drop Interactive Zone */}
              <div 
                ref={pasteZoneRef}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                tabIndex={0}
                className={`flex-1 w-full p-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                  isDragOver 
                    ? 'border-coral-500 bg-coral-500/10' 
                    : 'border-plum-700 bg-plum-900/30 hover:border-plum-600 hover:bg-plum-900/50'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleQrFileUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <div className="w-10 h-10 rounded-full bg-plum-800 text-coral-400 flex items-center justify-center mb-2 shadow-sm">
                  {isUploadingQr ? (
                    <RefreshCw className="w-5 h-5 animate-spin text-coral-400" />
                  ) : (
                    <Clipboard className="w-5 h-5" />
                  )}
                </div>

                <p className="text-xs font-bold text-white mb-0.5">
                  {isUploadingQr ? 'Uploading & Saving to Supabase...' : 'Click to Upload or Paste Image (Ctrl+V)'}
                </p>
                <p className="text-[11px] text-plum-400 max-w-sm">
                  Copy any QR screenshot to your clipboard and press <kbd className="px-1.5 py-0.5 bg-plum-800 text-coral-300 rounded font-mono text-[10px]">Ctrl+V</kbd> anywhere on this page, or drag & drop a file here.
                </p>
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="flex items-center gap-3 p-3 bg-plum-950/60 rounded-xl border border-plum-800">
              <input
                type="checkbox"
                id="enableUpiCheck"
                checked={isUpiEnabled}
                onChange={(e) => setIsUpiEnabled(e.target.checked)}
                className="rounded text-indigo-500 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="enableUpiCheck" className="text-xs text-plum-200 cursor-pointer">
                <strong>Enable Direct UPI Payments:</strong> Display Google Pay & QR option at checkout
              </label>
            </div>

            <div className="flex items-center gap-3 p-3 bg-plum-950/60 rounded-xl border border-plum-800">
              <input
                type="checkbox"
                id="manualVerifyCheck"
                checked={manualVerificationRequired}
                onChange={(e) => setManualVerificationRequired(e.target.checked)}
                className="rounded text-indigo-500 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="manualVerifyCheck" className="text-xs text-plum-200 cursor-pointer">
                <strong>Require Manual Payment Verification:</strong> Admin independently audits UTR in bank records
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-plum-800">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSavingPayment}
              className="bg-indigo-600 hover:bg-indigo-500 shadow-md"
              leftIcon={<Save className="w-4 h-4" />}
            >
              {isSavingPayment ? 'Saving...' : 'Save UPI Payment Settings'}
            </Button>
          </div>
        </form>
      </div>

      {/* SECTION 2: STORE PHYSICAL ADDRESS & BUSINESS BRANDING */}
      <div className="bg-plum-900/60 border border-plum-800/80 rounded-3xl p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-plum-800">
          <div className="flex items-center gap-2 text-white font-display font-bold">
            <Store className="w-5 h-5 text-coral-400" />
            <span className="text-base sm:text-lg">Store Identity & Physical Business Address</span>
          </div>
          {storeUpdatedAt && (
            <span className="text-[10px] text-plum-400 font-mono">
              Last saved: {new Date(storeUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <form onSubmit={handleSaveStoreSettings} className="space-y-6">
          {/* Brand Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
                Official Store Name *
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="SANJANA MOBILES"
                className="w-full rounded-xl border border-plum-700 bg-plum-950 px-4 py-2.5 text-sm text-ivory placeholder:text-plum-500 focus:outline-none focus:border-coral-400 font-sans"
                required
              />
              <p className="text-[11px] text-plum-400 mt-1">
                Updates brand name across headers, invoices, store pickup receipts, and confirmation emails.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
                Brand Tagline
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Your Trusted Destination for Genuine Mobiles"
                className="w-full rounded-xl border border-plum-700 bg-plum-950 px-4 py-2.5 text-sm text-ivory placeholder:text-plum-500 focus:outline-none focus:border-coral-400"
              />
            </div>
          </div>

          {/* Official Contact Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
                Store Mobile Number *
              </label>
              <div className="flex rounded-xl border border-plum-700 bg-plum-950 overflow-hidden focus-within:border-coral-400">
                <span className="px-3 py-2.5 text-xs text-plum-400 bg-plum-900/60 font-mono border-r border-plum-700 flex items-center">
                  +91
                </span>
                <input
                  type="tel"
                  value={storeMobile}
                  onChange={(e) => setStoreMobile(e.target.value)}
                  placeholder="9876543210"
                  maxLength={10}
                  className="w-full bg-transparent px-3 py-2.5 text-sm text-ivory focus:outline-none font-mono"
                  required
                />
              </div>
              <p className="text-[11px] text-plum-400 mt-1">
                Used for customer support, WhatsApp inquiries, and Store Pickup SMS notifications.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
                Store Official Email *
              </label>
              <input
                type="email"
                value={storeEmail}
                onChange={(e) => setStoreEmail(e.target.value)}
                placeholder="contact@sanjanamobiles.com"
                className="w-full rounded-xl border border-plum-700 bg-plum-950 px-4 py-2.5 text-sm text-ivory focus:outline-none focus:border-coral-400"
                required
              />
            </div>
          </div>

          {/* Structured Physical Address */}
          <div className="pt-2 border-t border-plum-800/80 space-y-4">
            <div className="flex items-center gap-1.5 text-coral-400 font-bold text-xs uppercase tracking-wider">
              <MapPin className="w-4 h-4" />
              <span>Physical Store Location (Direct Store Pickup Destination)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
                  Address Line 1 (Shop No, Street, Building) *
                </label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="e.g. Shop #14, Ground Floor, 100 Feet Road"
                  className="w-full rounded-xl border border-plum-700 bg-plum-950 px-4 py-2.5 text-sm text-ivory focus:outline-none focus:border-coral-400"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
                  Address Line 2 (Area, Landmark)
                </label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="e.g. Opposite Metro Pillar 42, Near Indiranagar Signal"
                  className="w-full rounded-xl border border-plum-700 bg-plum-950 px-4 py-2.5 text-sm text-ivory focus:outline-none focus:border-coral-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
                  City *
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Bengaluru"
                  className="w-full rounded-xl border border-plum-700 bg-plum-950 px-4 py-2.5 text-sm text-ivory focus:outline-none focus:border-coral-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
                  District
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Bengaluru Urban"
                  className="w-full rounded-xl border border-plum-700 bg-plum-950 px-4 py-2.5 text-sm text-ivory focus:outline-none focus:border-coral-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
                  State *
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Karnataka"
                  className="w-full rounded-xl border border-plum-700 bg-plum-950 px-4 py-2.5 text-sm text-ivory focus:outline-none focus:border-coral-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
                  PIN Code (Postal Code) *
                </label>
                <input
                  type="text"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="560038"
                  maxLength={6}
                  className="w-full rounded-xl border border-plum-700 bg-plum-950 px-4 py-2.5 text-sm text-ivory focus:outline-none focus:border-coral-400 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
                  Country *
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="India"
                  className="w-full rounded-xl border border-plum-700 bg-plum-950 px-4 py-2.5 text-sm text-ivory focus:outline-none focus:border-coral-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
                  Google Maps URL (Optional)
                </label>
                <div className="flex rounded-xl border border-plum-700 bg-plum-950 overflow-hidden focus-within:border-coral-400">
                  <input
                    type="url"
                    value={googleMapsUrl}
                    onChange={(e) => setGoogleMapsUrl(e.target.value)}
                    placeholder="https://maps.google.com/?q=..."
                    className="w-full bg-transparent px-4 py-2.5 text-sm text-ivory focus:outline-none"
                  />
                  {googleMapsUrl && (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2.5 text-plum-400 hover:text-white bg-plum-900/60 border-l border-plum-700 flex items-center"
                      title="Open Google Maps link"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Operational Parameters */}
          <div className="pt-2 border-t border-plum-800/80 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
                  Free Shipping Minimum Order (₹ INR) *
                </label>
                <input
                  type="number"
                  value={freeShippingThreshold}
                  onChange={(e) => setFreeShippingThreshold(e.target.value)}
                  placeholder="999"
                  min="0"
                  step="1"
                  className="w-full rounded-xl border border-plum-700 bg-plum-950 px-4 py-2.5 text-sm text-ivory focus:outline-none focus:border-coral-400 font-mono"
                  required
                />
                <p className="text-[11px] text-plum-400 mt-1">
                  Orders equal to or above this amount qualify for ₹0 doorstep delivery.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum-300 mb-1.5">
                  Store Business Hours
                </label>
                <input
                  type="text"
                  value={businessHours}
                  onChange={(e) => setBusinessHours(e.target.value)}
                  placeholder="Mon - Sat: 10:00 AM - 9:00 PM"
                  className="w-full rounded-xl border border-plum-700 bg-plum-950 px-4 py-2.5 text-sm text-ivory focus:outline-none focus:border-coral-400"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-plum-800">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSavingStore}
              className="bg-coral-600 hover:bg-coral-500 shadow-md"
              leftIcon={<Save className="w-4 h-4" />}
            >
              {isSavingStore ? 'Saving...' : 'Save Store Details'}
            </Button>
          </div>
        </form>
      </div>

      {/* CONFIRM REMOVE QR MODAL */}
      {showRemoveQrModal && (
        <div className="fixed inset-0 z-50 bg-plum-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-plum-900 border border-plum-700 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-red-400 font-bold">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-display text-lg">Remove Official Shop QR Code?</h3>
            </div>

            <p className="text-xs text-plum-300 leading-relaxed">
              Removing the official static QR code will cause the checkout page to generate dynamic UPI QR codes per order based on your official UPI ID (<code className="text-coral-300">{upiId}</code>).
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-plum-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowRemoveQrModal(false)}
                disabled={isRemovingQr}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleConfirmRemoveQr}
                disabled={isRemovingQr}
              >
                {isRemovingQr ? 'Removing...' : 'Confirm Remove'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
