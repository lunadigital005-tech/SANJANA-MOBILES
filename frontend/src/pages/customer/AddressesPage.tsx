import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Edit2, CheckCircle2, Home, Briefcase, Phone, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Address } from '../../types';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../context/ToastContext';

export const AddressesPage: React.FC = () => {
  const { token, user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    mobile_number: user?.phone || '',
    address_line1: '',
    address_line2: '',
    city: '',
    district: '',
    state: '',
    pin_code: '',
    country: 'India',
    is_default: false,
    address_type: 'home' as 'home' | 'work' | 'other',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchAddresses = async () => {
    const activeToken = token || 'mock-customer-token';
    try {
      const data = await api.getAddresses(activeToken);
      setAddresses(data);
    } catch (err) {
      console.error('Failed to fetch addresses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, [token]);

  const openAddModal = () => {
    setEditingAddressId(null);
    setFormData({
      full_name: user?.full_name || '',
      mobile_number: user?.phone || '',
      address_line1: '',
      address_line2: '',
      city: '',
      district: '',
      state: '',
      pin_code: '',
      country: 'India',
      is_default: addresses.length === 0,
      address_type: 'home',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (addr: Address) => {
    setEditingAddressId(addr.id);
    setFormData({
      full_name: addr.full_name || '',
      mobile_number: addr.mobile_number || addr.phone || '',
      address_line1: addr.address_line1 || '',
      address_line2: addr.address_line2 || '',
      city: addr.city || '',
      district: addr.district || addr.city || '',
      state: addr.state || '',
      pin_code: addr.pin_code || addr.postal_code || '',
      country: addr.country || 'India',
      is_default: addr.is_default || false,
      address_type: addr.address_type || 'home',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.full_name.trim()) {
      errors.full_name = 'Please enter your full name.';
    }

    const cleanMobile = formData.mobile_number.replace(/[\s\-\+]/g, '');
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!cleanMobile || !mobileRegex.test(cleanMobile.startsWith('91') && cleanMobile.length === 12 ? cleanMobile.slice(2) : cleanMobile)) {
      errors.mobile_number = 'Enter a valid 10-digit mobile number.';
    }

    if (!formData.address_line1.trim()) {
      errors.address_line1 = 'Please enter your address.';
    }

    if (!formData.city.trim()) {
      errors.city = 'Please enter your city.';
    }

    if (!formData.state.trim()) {
      errors.state = 'Please enter your state.';
    }

    const cleanPin = formData.pin_code.trim();
    const pinRegex = /^[1-9][0-9]{5}$/;
    if (!cleanPin || !pinRegex.test(cleanPin)) {
      errors.pin_code = 'Enter a valid 6-digit PIN code.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    const activeToken = token || 'mock-customer-token';

    const cleanMobile = formData.mobile_number.replace(/[\s\-\+]/g, '');
    const normalizedMobile = cleanMobile.startsWith('91') && cleanMobile.length === 12 ? cleanMobile.slice(2) : cleanMobile;

    const payload = {
      ...formData,
      mobile_number: normalizedMobile,
      phone: normalizedMobile,
      pin_code: formData.pin_code.trim(),
      postal_code: formData.pin_code.trim(),
      district: formData.district.trim() || formData.city.trim()
    };

    try {
      if (editingAddressId) {
        await api.updateAddress(activeToken, editingAddressId, payload);
        showToast('Address updated successfully.', 'success');
      } else {
        await api.createAddress(activeToken, payload);
        showToast('Delivery address saved successfully.', 'success');
      }
      await fetchAddresses();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Save address error:', err);
      showToast(err.message || 'Unable to save address. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    const activeToken = token || 'mock-customer-token';
    try {
      await api.deleteAddress(activeToken, id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      showToast('Address removed successfully.', 'info');
      await fetchAddresses();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete address.', 'error');
    }
  };

  const handleSetDefault = async (id: string) => {
    const activeToken = token || 'mock-customer-token';
    try {
      await api.setDefaultAddress(activeToken, id);
      showToast('Default delivery address updated.', 'success');
      await fetchAddresses();
    } catch (err: any) {
      showToast(err.message || 'Failed to set default address.', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-plum-100 pb-6">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-coral-600 block mb-1">
            SANJANA MOBILES • Customer Account
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-plum-950">
            Saved Delivery Addresses
          </h1>
          <p className="text-xs sm:text-sm text-plum-500 mt-1">
            Manage your delivery addresses with verified Indian 6-digit PIN codes and mobile numbers.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={openAddModal}
          leftIcon={<Plus className="w-4 h-4" />}
          className="self-start sm:self-auto"
        >
          Add New Address
        </Button>
      </div>

      {/* Address Cards Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-plum-400">Loading delivery addresses...</div>
      ) : addresses.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-plum-200">
          <MapPin className="w-8 h-8 text-plum-300 mx-auto mb-3" />
          <h3 className="font-display font-bold text-base text-plum-900 mb-1">No Addresses Saved Yet</h3>
          <p className="text-xs text-plum-400 max-w-sm mx-auto mb-4">
            Add your primary residence or workplace delivery address to quickly checkout with genuine mobile accessories.
          </p>
          <Button variant="secondary" size="sm" onClick={openAddModal}>
            Add Delivery Address
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={`p-6 rounded-2xl bg-white border transition-all relative flex flex-col justify-between ${
                address.is_default
                  ? 'border-coral-400 shadow-md ring-1 ring-coral-400/30'
                  : 'border-plum-100 shadow-card hover:border-plum-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {address.address_type === 'home' ? (
                      <Home className="w-4 h-4 text-plum-600" />
                    ) : (
                      <Briefcase className="w-4 h-4 text-plum-600" />
                    )}
                    <span className="text-xs font-bold uppercase tracking-wider text-plum-800">
                      {address.address_type}
                    </span>
                  </div>
                  {address.is_default ? (
                    <Badge variant="coral">Default Address</Badge>
                  ) : (
                    <button
                      onClick={() => handleSetDefault(address.id)}
                      className="text-[11px] font-semibold text-coral-600 hover:text-coral-700 underline transition-colors"
                    >
                      Set as Default
                    </button>
                  )}
                </div>

                <h4 className="font-display font-bold text-base text-plum-950 mb-1">
                  {address.full_name}
                </h4>
                <div className="text-xs text-plum-600 space-y-1 leading-relaxed">
                  <p className="font-medium text-plum-900">{address.address_line1}</p>
                  {address.address_line2 && <p>{address.address_line2}</p>}
                  <p>
                    {address.city}, {address.state} — <span className="font-mono font-semibold">{address.pin_code || address.postal_code}</span>
                  </p>
                  <p className="text-plum-400">{address.country || 'India'}</p>
                  <div className="flex items-center gap-1.5 text-plum-700 font-mono pt-2">
                    <Phone className="w-3.5 h-3.5 text-coral-500" />
                    <span>+91 {address.mobile_number || address.phone}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 mt-6 border-t border-plum-50">
                <button
                  onClick={() => openEditModal(address)}
                  className="text-xs text-plum-600 hover:text-plum-950 flex items-center gap-1.5 transition-colors font-medium"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDelete(address.id)}
                  className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1.5 transition-colors font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Address Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAddressId ? 'Edit Delivery Address' : 'Add New Delivery Address'}
        description="Provide accurate 6-digit Indian PIN code and 10-digit mobile number."
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-plum-900 mb-1">Recipient Full Name *</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="e.g. Sanjana Patel"
              className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 focus:outline-none focus:border-coral-500"
            />
            {formErrors.full_name && (
              <p className="text-rose-600 text-[11px] mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {formErrors.full_name}
              </p>
            )}
          </div>

          <div>
            <label className="block font-bold text-plum-900 mb-1">10-Digit Indian Mobile Number *</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-plum-400 font-medium">+91</span>
              <input
                type="tel"
                value={formData.mobile_number}
                onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                placeholder="9876543210"
                maxLength={10}
                className="w-full bg-ivory/60 border border-plum-200 rounded-xl pl-11 pr-3 py-2 text-plum-900 font-mono focus:outline-none focus:border-coral-500"
              />
            </div>
            {formErrors.mobile_number && (
              <p className="text-rose-600 text-[11px] mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {formErrors.mobile_number}
              </p>
            )}
          </div>

          <div>
            <label className="block font-bold text-plum-900 mb-1">Address Line 1 (Flat/House No., Building, Street) *</label>
            <input
              type="text"
              value={formData.address_line1}
              onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
              placeholder="e.g. Flat 402, Lotus Residency, 100 Feet Road"
              className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 focus:outline-none focus:border-coral-500"
            />
            {formErrors.address_line1 && (
              <p className="text-rose-600 text-[11px] mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {formErrors.address_line1}
              </p>
            )}
          </div>

          <div>
            <label className="block font-bold text-plum-900 mb-1">Address Line 2 (Area, Landmark)</label>
            <input
              type="text"
              value={formData.address_line2}
              onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
              placeholder="e.g. Near Indiranagar Metro Station"
              className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 focus:outline-none focus:border-coral-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-plum-900 mb-1">City *</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. Bengaluru"
                className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 focus:outline-none focus:border-coral-500"
              />
              {formErrors.city && (
                <p className="text-rose-600 text-[11px] mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {formErrors.city}
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-plum-900 mb-1">State *</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="e.g. Karnataka"
                className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 focus:outline-none focus:border-coral-500"
              />
              {formErrors.state && (
                <p className="text-rose-600 text-[11px] mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {formErrors.state}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-plum-900 mb-1">6-Digit PIN Code *</label>
              <input
                type="text"
                value={formData.pin_code}
                onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })}
                placeholder="e.g. 560038"
                maxLength={6}
                className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 font-mono focus:outline-none focus:border-coral-500"
              />
              {formErrors.pin_code && (
                <p className="text-rose-600 text-[11px] mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {formErrors.pin_code}
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-plum-900 mb-1">Address Type</label>
              <select
                value={formData.address_type}
                onChange={(e) => setFormData({ ...formData, address_type: e.target.value as any })}
                className="w-full bg-ivory/60 border border-plum-200 rounded-xl px-3 py-2 text-plum-900 focus:outline-none focus:border-coral-500"
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
              id="isDefaultAddr"
              checked={formData.is_default}
              onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              className="rounded text-coral-600 focus:ring-coral-500"
            />
            <label htmlFor="isDefaultAddr" className="text-xs text-plum-800 cursor-pointer">
              Set as primary default delivery address
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-plum-100">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={saving}>
              {editingAddressId ? 'Update Address' : 'Save Address'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
