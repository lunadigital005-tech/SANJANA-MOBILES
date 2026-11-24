import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  ShieldCheck,
  Mail,
  Phone,
  Calendar,
  Clock,
  ShoppingBag,
  ExternalLink,
  MessageCircle,
  Eye,
  MapPin,
  CheckCircle,
  RefreshCw,
  X,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { AdminCustomerItem, AdminCustomerDetail } from '../../types';
import { formatPrice } from '../../config/store';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/common/Button';

export const AdminCustomersPage: React.FC = () => {
  const { token } = useAuth();
  const [customers, setCustomers] = useState<AdminCustomerItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<AdminCustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { showToast } = useToast();

  const fetchCustomers = async (searchTerm?: string) => {
    const activeToken = token || 'mock-admin-token';
    setLoading(true);
    try {
      const data = await api.getAdminCustomers(activeToken, searchTerm);
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
      showToast('Could not load customers from server', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(search);
  }, [token]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers(search);
  };

  const handleInspectCustomer = async (cust: AdminCustomerItem) => {
    setSelectedCustomerId(cust.id);
    setDetailLoading(true);
    const activeToken = token || 'mock-admin-token';
    try {
      const detail = await api.getAdminCustomerDetail(activeToken, cust.id);
      setCustomerDetail(detail);
    } catch (err: any) {
      console.error('Failed to load customer detail:', err);
      showToast('Failed to load customer profile details', 'error');
      // Fallback detail from row
      setCustomerDetail({
        id: cust.id,
        full_name: cust.full_name,
        email: cust.email,
        phone: cust.phone,
        role: cust.role,
        account_status: cust.account_status,
        orders_count: cust.orders_count,
        total_spent: cust.total_spent,
        created_at: cust.created_at,
        last_login: cust.last_login,
        addresses: [],
        orders: [],
        whatsapp_url: cust.phone ? `https://wa.me/91${cust.phone.replace(/\D/g, '').slice(-10)}` : undefined
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const getWhatsAppLink = (mobile?: string, customerName?: string) => {
    if (!mobile) return '#';
    const digits = mobile.replace(/\D/g, '');
    const cleaned = digits.startsWith('0') ? digits.slice(1) : digits;
    const international = cleaned.startsWith('91') && cleaned.length > 10 ? cleaned : `91${cleaned.slice(-10)}`;
    const message = encodeURIComponent(
      `Hello ${customerName || 'Customer'}, this is SANJANA MOBILES customer service. How may we assist you today?`
    );
    return `https://wa.me/${international}?text=${message}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-coral-400 block mb-1">
            Customer Relations & Contact Management
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
            Customer Directory & Accounts
          </h1>
          <p className="text-xs text-plum-300 mt-1">
            Review registered customers, verified mobile numbers, order histories, and direct WhatsApp contact.
          </p>
        </div>

        <button
          onClick={() => fetchCustomers(search)}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-plum-800 hover:bg-plum-700 text-ivory border border-plum-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 bg-plum-900/60 border border-plum-800 p-3 rounded-2xl w-full sm:max-w-md">
          <Search className="w-4 h-4 text-plum-400 ml-1" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or mobile number..."
            className="bg-transparent text-xs text-ivory placeholder:text-plum-500 focus:outline-none w-full"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                fetchCustomers('');
              }}
              className="text-plum-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        <span className="text-xs text-plum-400 self-start sm:self-auto">
          Total Registered: <strong className="text-white">{customers.length}</strong>
        </span>
      </div>

      {/* Customers Table */}
      <div className="bg-plum-900/60 border border-plum-800/80 rounded-3xl p-6 shadow-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-plum-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-coral-400" /> Loading customer directory...
          </div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center text-xs text-plum-400 space-y-2">
            <Users className="w-8 h-8 text-plum-600 mx-auto" />
            <p>No customers found matching search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-plum-800 text-plum-400 uppercase font-semibold tracking-wider">
                  <th className="pb-3 px-3">Customer Name</th>
                  <th className="pb-3 px-3">Email Address</th>
                  <th className="pb-3 px-3">Mobile Number</th>
                  <th className="pb-3 px-3">Registration Date</th>
                  <th className="pb-3 px-3">Account Status</th>
                  <th className="pb-3 px-3">Total Orders</th>
                  <th className="pb-3 px-3">Total Spent (₹)</th>
                  <th className="pb-3 px-3">Last Activity</th>
                  <th className="pb-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-plum-800/60">
                {customers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-plum-800/30 transition-colors">
                    {/* Customer Name */}
                    <td className="py-4 px-3 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span>{cust.full_name || 'Customer'}</span>
                        {cust.role === 'admin' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-coral-500/20 text-coral-300 border border-coral-500/30 uppercase">
                            <ShieldCheck className="w-2.5 h-2.5" /> Admin
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-4 px-3 text-plum-300 font-mono text-[11px]">
                      {cust.email}
                    </td>

                    {/* Mobile Number & WhatsApp */}
                    <td className="py-4 px-3">
                      {cust.phone ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-emerald-300 text-[11px]">
                            +91 {cust.phone.replace(/^(\+91|91)/, '')}
                          </span>
                          <a
                            href={getWhatsAppLink(cust.phone, cust.full_name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-colors"
                            title="Open WhatsApp Chat"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-plum-500 italic text-[11px]">Not provided</span>
                      )}
                    </td>

                    {/* Registration Date */}
                    <td className="py-4 px-3 text-plum-400 text-[11px]">
                      {cust.created_at ? new Date(cust.created_at).toLocaleDateString() : '—'}
                    </td>

                    {/* Account Status */}
                    <td className="py-4 px-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        cust.account_status === 'Active'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        <CheckCircle className="w-2.5 h-2.5" />
                        {cust.account_status || 'Active'}
                      </span>
                    </td>

                    {/* Total Orders */}
                    <td className="py-4 px-3 font-semibold text-white">
                      {cust.orders_count || 0}
                    </td>

                    {/* Total Spent */}
                    <td className="py-4 px-3 font-display font-bold text-coral-400">
                      {formatPrice(cust.total_spent || 0)}
                    </td>

                    {/* Last Login / Activity */}
                    <td className="py-4 px-3 text-plum-400 text-[11px]">
                      {cust.last_login ? new Date(cust.last_login).toLocaleDateString() : '—'}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-3 text-right">
                      <button
                        onClick={() => handleInspectCustomer(cust)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-plum-800 hover:bg-coral-600 text-white font-medium text-xs transition-colors"
                        title="View Profile, Orders & Addresses"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Profile Inspection Modal */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 bg-plum-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-plum-900 border border-plum-700 rounded-3xl max-w-3xl w-full p-6 text-white shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-plum-800 pb-3">
              <div>
                <h3 className="font-display font-bold text-lg">
                  Customer Profile & Contact History
                </h3>
                <span className="text-xs text-plum-400">
                  Customer ID: {selectedCustomerId}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedCustomerId(null);
                  setCustomerDetail(null);
                }}
                className="text-plum-400 hover:text-white font-bold text-lg"
              >
                ×
              </button>
            </div>

            {detailLoading ? (
              <div className="py-12 text-center text-xs text-plum-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-coral-400" /> Loading customer full history...
              </div>
            ) : customerDetail ? (
              <div className="space-y-6">
                {/* Contact Information & WhatsApp Action */}
                <div className="bg-plum-950/60 p-4 rounded-2xl border border-plum-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-bold text-white">
                        {customerDetail.full_name || 'Customer'}
                      </h4>
                      <p className="text-xs text-plum-300 font-mono">
                        {customerDetail.email}
                      </p>
                      {customerDetail.phone && (
                        <p className="text-xs text-emerald-300 font-mono mt-0.5">
                          Mobile: +91 {customerDetail.phone.replace(/^(\+91|91)/, '')}
                        </p>
                      )}
                    </div>

                    {/* Direct WhatsApp Contact Button */}
                    {customerDetail.phone && (
                      <a
                        href={customerDetail.whatsapp_url || getWhatsAppLink(customerDetail.phone, customerDetail.full_name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-sm self-start sm:self-auto"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Chat on WhatsApp</span>
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-plum-800/60 text-xs">
                    <div>
                      <span className="text-plum-400 block text-[10px] uppercase">Account Status</span>
                      <span className="font-semibold text-emerald-300">{customerDetail.account_status || 'Active'}</span>
                    </div>
                    <div>
                      <span className="text-plum-400 block text-[10px] uppercase">Registration Date</span>
                      <span className="font-semibold text-white">
                        {customerDetail.created_at ? new Date(customerDetail.created_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-plum-400 block text-[10px] uppercase">Total Orders</span>
                      <span className="font-semibold text-white">{customerDetail.orders.length || customerDetail.orders_count || 0}</span>
                    </div>
                    <div>
                      <span className="text-plum-400 block text-[10px] uppercase">Lifetime Spent</span>
                      <span className="font-bold text-coral-400">{formatPrice(customerDetail.total_spent || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Saved Delivery Addresses */}
                <div className="space-y-2">
                  <h5 className="text-xs uppercase tracking-wider font-bold text-plum-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-coral-400" />
                    <span>Saved Delivery Addresses ({customerDetail.addresses.length})</span>
                  </h5>

                  {customerDetail.addresses.length === 0 ? (
                    <div className="bg-plum-950/40 border border-plum-800/60 rounded-xl p-3 text-xs text-plum-400 italic">
                      No saved delivery addresses on file.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {customerDetail.addresses.map((addr) => (
                        <div key={addr.id} className="bg-plum-950/60 border border-plum-800 rounded-xl p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white">{addr.full_name || customerDetail.full_name}</span>
                            {addr.is_default && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-coral-500/20 text-coral-300 uppercase">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-plum-300 font-mono text-[11px]">+91 {addr.mobile_number}</p>
                          <p className="text-plum-300">{addr.address_line1}</p>
                          {addr.address_line2 && <p className="text-plum-400">{addr.address_line2}</p>}
                          <p className="text-plum-400">
                            {addr.city}, {addr.state} - <span className="font-mono text-white">{addr.pin_code}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Order History */}
                <div className="space-y-2">
                  <h5 className="text-xs uppercase tracking-wider font-bold text-plum-400 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-coral-400" />
                    <span>Order History ({customerDetail.orders.length})</span>
                  </h5>

                  {customerDetail.orders.length === 0 ? (
                    <div className="bg-plum-950/40 border border-plum-800/60 rounded-xl p-3 text-xs text-plum-400 italic">
                      No orders placed yet by this customer.
                    </div>
                  ) : (
                    <div className="border border-plum-800/80 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-plum-950/80 border-b border-plum-800 text-plum-400 uppercase font-semibold text-[10px]">
                            <th className="py-2.5 px-3">Order Number</th>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Delivery</th>
                            <th className="py-2.5 px-3">Payment</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-plum-800/60">
                          {customerDetail.orders.map((ord: any) => (
                            <tr key={ord.id} className="hover:bg-plum-800/20">
                              <td className="py-2.5 px-3 font-mono font-bold text-white">
                                {ord.order_number}
                              </td>
                              <td className="py-2.5 px-3 text-plum-400 text-[11px]">
                                {new Date(ord.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="text-[10px] font-semibold text-plum-300">
                                  {ord.delivery_method === 'STORE_PICKUP' ? 'Store Pickup' : 'Doorstep'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  ord.payment_status === 'PAID' || ord.payment_status === 'VERIFIED'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}>
                                  {ord.payment_status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="text-[11px] font-semibold text-plum-200">
                                  {ord.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-display font-bold text-white">
                                {formatPrice(ord.total_amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t border-plum-800">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCustomerId(null);
                      setCustomerDetail(null);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
