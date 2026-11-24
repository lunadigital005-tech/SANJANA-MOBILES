import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Plus, 
  Edit, 
  Trash2, 
  Upload, 
  Calendar, 
  Tag, 
  Link as LinkIcon, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  Eye,
  Loader2,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { Advertisement, Product } from '../../types';
import { formatPrice } from '../../config/store';
import { Button } from '../../components/common/Button';

export const AdminAdvertisementsPage: React.FC = () => {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [ads, setAds] = useState<Advertisement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);

  // Form State
  const [form, setForm] = useState({
    title: '',
    headline: '',
    description: '',
    original_price: '',
    offer_price: '',
    discount_percent: '',
    image_url: '',
    product_id: '',
    cta_text: 'Shop Now',
    cta_link: '/products',
    badge: 'SPECIAL OFFER',
    start_date: '',
    end_date: '',
    display_order: 0,
    is_active: true
  });

  const fetchAds = async () => {
    setLoading(true);
    try {
      const activeToken = token || 'mock-admin-token';
      const [allAds, prodsRes] = await Promise.all([
        api.adminGetBanners(activeToken).catch(() => []),
        api.getProducts({ limit: 100 }).catch(() => ({ items: [] }))
      ]);
      setAds(allAds);
      setProducts(prodsRes.items || []);
    } catch (err) {
      console.error('Failed to load advertisements:', err);
      showToast('Failed to load advertisements', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, [token]);

  const openCreateModal = () => {
    setEditingAd(null);
    setForm({
      title: '',
      headline: '',
      description: '',
      original_price: '',
      offer_price: '',
      discount_percent: '',
      image_url: '',
      product_id: '',
      cta_text: 'Shop Now',
      cta_link: '/products',
      badge: 'SPECIAL OFFER',
      start_date: '',
      end_date: '',
      display_order: ads.length + 1,
      is_active: true
    });
    setShowModal(true);
  };

  const openEditModal = (ad: Advertisement) => {
    setEditingAd(ad);
    setForm({
      title: ad.title || '',
      headline: ad.headline || '',
      description: ad.description || '',
      original_price: ad.original_price != null ? ad.original_price.toString() : '',
      offer_price: ad.offer_price != null ? ad.offer_price.toString() : '',
      discount_percent: ad.discount_percent != null ? ad.discount_percent.toString() : '',
      image_url: ad.image_url || '',
      product_id: ad.product_id || '',
      cta_text: ad.cta_text || 'Shop Now',
      cta_link: ad.cta_link || '/products',
      badge: ad.badge || 'SPECIAL OFFER',
      start_date: ad.start_date ? ad.start_date.substring(0, 16) : '',
      end_date: ad.end_date ? ad.end_date.substring(0, 16) : '',
      display_order: ad.display_order ?? 0,
      is_active: ad.is_active ?? true
    });
    setShowModal(true);
  };

  // When a product is selected, auto-fill title, image, price, and cta_link
  const handleProductSelect = (productId: string) => {
    setForm((prev) => {
      const selected = products.find((p) => p.id === productId);
      if (!selected) return { ...prev, product_id: productId };

      const origPrice = selected.original_price || selected.price;
      const offPrice = selected.sale_price || selected.price;
      const calcDiscount = origPrice > offPrice ? Math.round(((origPrice - offPrice) / origPrice) * 100) : '';

      return {
        ...prev,
        product_id: productId,
        title: prev.title || selected.title,
        image_url: prev.image_url || selected.primary_image || selected.images?.[0] || '',
        original_price: prev.original_price || origPrice.toString(),
        offer_price: prev.offer_price || offPrice.toString(),
        discount_percent: prev.discount_percent || (calcDiscount ? calcDiscount.toString() : ''),
        cta_link: `/product/${selected.slug}`
      };
    });
  };

  // Upload ad image to Supabase Storage
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const activeToken = token || 'mock-admin-token';
      const uploaded = await api.adminUploadImage(activeToken, file);
      setForm((prev) => ({ ...prev, image_url: uploaded.url }));
      showToast('Promotional image uploaded successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Image upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Save advertisement (Create or Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.image_url.trim()) {
      showToast('Title and Image URL are required', 'error');
      return;
    }

    setIsSaving(true);
    const activeToken = token || 'mock-admin-token';

    const origPrice = form.original_price ? parseFloat(form.original_price) : undefined;
    const offPrice = form.offer_price ? parseFloat(form.offer_price) : undefined;
    const discPercent = form.discount_percent ? parseInt(form.discount_percent) : (
      origPrice && offPrice && origPrice > offPrice ? Math.round(((origPrice - offPrice) / origPrice) * 100) : undefined
    );

    const payload: Partial<Advertisement> = {
      title: form.title.trim(),
      headline: form.headline.trim() || undefined,
      description: form.description.trim() || undefined,
      original_price: origPrice,
      offer_price: offPrice,
      discount_percent: discPercent,
      image_url: form.image_url.trim(),
      product_id: form.product_id || undefined,
      cta_text: form.cta_text.trim() || 'Shop Now',
      cta_link: form.cta_link.trim() || '/products',
      badge: form.badge.trim() || undefined,
      start_date: form.start_date ? new Date(form.start_date).toISOString() : undefined,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : undefined,
      display_order: Number(form.display_order) || 0,
      is_active: form.is_active
    };

    try {
      if (editingAd) {
        await api.adminUpdateBanner(activeToken, editingAd.id, payload);
        showToast('Advertisement updated successfully', 'success');
      } else {
        await api.adminCreateBanner(activeToken, payload);
        showToast('Advertisement created successfully', 'success');
      }
      setShowModal(false);
      await fetchAds();
    } catch (err: any) {
      showToast(err.message || 'Failed to save advertisement', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle active state
  const handleToggleActive = async (ad: Advertisement) => {
    const activeToken = token || 'mock-admin-token';
    try {
      await api.adminUpdateBanner(activeToken, ad.id, { is_active: !ad.is_active });
      setAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, is_active: !a.is_active } : a)));
      showToast(`Advertisement ${!ad.is_active ? 'activated' : 'deactivated'}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  // Delete advertisement
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this promotional advertisement?')) return;

    const activeToken = token || 'mock-admin-token';
    try {
      await api.adminDeleteBanner(activeToken, id);
      setAds((prev) => prev.filter((a) => a.id !== id));
      showToast('Advertisement deleted successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete advertisement', 'error');
    }
  };

  // Change display order
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ads.length) return;

    const newAds = [...ads];
    const temp = newAds[index];
    newAds[index] = newAds[targetIndex];
    newAds[targetIndex] = temp;

    // Update orders
    const activeToken = token || 'mock-admin-token';
    setAds(newAds);

    try {
      await Promise.all([
        api.adminUpdateBanner(activeToken, newAds[index].id, { display_order: index + 1 }),
        api.adminUpdateBanner(activeToken, newAds[targetIndex].id, { display_order: targetIndex + 1 })
      ]);
    } catch {
      fetchAds();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-coral-400 block mb-1">
            Marketing & Homepage Promotions
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
            Promotional Advertisement Slider
          </h1>
          <p className="text-xs text-plum-300 mt-1">
            Create, schedule, and curate Amazon/Meesho-inspired product deals for the SANJANA MOBILES homepage.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={openCreateModal}
          leftIcon={<Plus className="w-4 h-4" />}
          className="self-start sm:self-auto bg-coral-500 hover:bg-coral-600 shadow-md shadow-coral-500/20"
        >
          Create Advertisement
        </Button>
      </div>

      {/* Advertisements Grid */}
      <div className="bg-plum-900/60 border border-plum-800/80 rounded-3xl p-6 shadow-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-plum-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-coral-400" /> Loading advertisements...
          </div>
        ) : ads.length === 0 ? (
          <div className="py-16 text-center text-xs text-plum-400 space-y-3">
            <Megaphone className="w-8 h-8 text-plum-600 mx-auto" />
            <p>No promotional advertisements created yet.</p>
            <Button size="sm" variant="outline" onClick={openCreateModal}>
              Create First Advertisement
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-plum-800 text-plum-400 uppercase font-semibold tracking-wider">
                  <th className="pb-3 px-3">Order</th>
                  <th className="pb-3 px-3">Ad Creative</th>
                  <th className="pb-3 px-3">Title & Headline</th>
                  <th className="pb-3 px-3">Price & Deal</th>
                  <th className="pb-3 px-3">Schedule Window</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-plum-800/60">
                {ads.map((ad, idx) => {
                  const now = new Date();
                  const isScheduledFuture = ad.start_date && new Date(ad.start_date) > now;
                  const isExpired = ad.end_date && new Date(ad.end_date) < now;

                  return (
                    <tr key={ad.id} className="hover:bg-plum-800/30 transition-colors">
                      {/* Reorder Buttons */}
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-plum-400 w-4">{idx + 1}</span>
                          <div className="flex flex-col">
                            <button
                              onClick={() => handleMoveOrder(idx, 'up')}
                              disabled={idx === 0}
                              className="text-plum-400 hover:text-white disabled:opacity-30 p-0.5"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleMoveOrder(idx, 'down')}
                              disabled={idx === ads.length - 1}
                              className="text-plum-400 hover:text-white disabled:opacity-30 p-0.5"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Creative Image */}
                      <td className="py-4 px-3">
                        <div className="w-16 h-16 rounded-xl bg-slate-950 border border-plum-700/80 p-1 flex items-center justify-center overflow-hidden">
                          <img
                            src={ad.image_url}
                            alt={ad.title}
                            className="w-full h-full object-contain rounded-lg"
                          />
                        </div>
                      </td>

                      {/* Title & Headline */}
                      <td className="py-4 px-3 max-w-xs">
                        {ad.badge && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-coral-500/20 text-coral-400 border border-coral-500/30 px-1.5 py-0.5 rounded">
                            {ad.badge}
                          </span>
                        )}
                        <h4 className="font-bold text-white text-xs line-clamp-1 mt-1">{ad.title}</h4>
                        {ad.headline && (
                          <p className="text-[11px] text-plum-300 line-clamp-1">{ad.headline}</p>
                        )}
                        <span className="text-[10px] text-plum-500 font-mono mt-0.5 block">
                          Link: {ad.cta_link}
                        </span>
                      </td>

                      {/* Pricing */}
                      <td className="py-4 px-3">
                        {ad.offer_price != null ? (
                          <div className="space-y-0.5">
                            <span className="font-display font-bold text-emerald-400 text-sm block">
                              {formatPrice(ad.offer_price)}
                            </span>
                            {ad.original_price != null && ad.original_price > ad.offer_price && (
                              <span className="text-[10px] text-plum-400 line-through">
                                M.R.P: {formatPrice(ad.original_price)}
                              </span>
                            )}
                            {ad.discount_percent && (
                              <span className="text-[10px] font-bold text-coral-400 block">
                                {ad.discount_percent}% OFF
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-plum-400 italic text-[11px]">No pricing</span>
                        )}
                      </td>

                      {/* Scheduling Window */}
                      <td className="py-4 px-3 text-[11px]">
                        {ad.start_date || ad.end_date ? (
                          <div className="space-y-0.5">
                            {ad.start_date && (
                              <span className="text-plum-300 block">
                                From: {new Date(ad.start_date).toLocaleDateString()}
                              </span>
                            )}
                            {ad.end_date && (
                              <span className="text-plum-300 block">
                                Till: {new Date(ad.end_date).toLocaleDateString()}
                              </span>
                            )}
                            {isScheduledFuture && (
                              <span className="text-[9px] font-bold uppercase text-amber-400 bg-amber-950 px-1 py-0.5 rounded">
                                Scheduled
                              </span>
                            )}
                            {isExpired && (
                              <span className="text-[9px] font-bold uppercase text-red-400 bg-red-950 px-1 py-0.5 rounded">
                                Expired
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-plum-400 text-[11px]">Always active</span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-4 px-3">
                        <button
                          onClick={() => handleToggleActive(ad)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                            ad.is_active && !isExpired
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}
                        >
                          {ad.is_active && !isExpired ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-emerald-400" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-red-400" /> Inactive
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(ad)}
                            className="p-1.5 rounded-lg bg-plum-800 hover:bg-plum-700 text-plum-200 transition-colors"
                            title="Edit Advertisement"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(ad.id)}
                            className="p-1.5 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-200 transition-colors"
                            title="Delete Advertisement"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Create / Edit Advertisement Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-plum-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-plum-900 border border-plum-700 rounded-3xl max-w-2xl w-full p-6 text-white shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-plum-800 pb-3">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-coral-400" />
                <h3 className="font-display font-bold text-lg">
                  {editingAd ? 'Edit Promotional Advertisement' : 'Create New Promotional Advertisement'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-plum-400 hover:text-white font-bold text-xl px-2"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Optional: Link an Existing Catalog Product */}
              <div className="p-3 bg-plum-950/70 border border-plum-800 rounded-2xl space-y-1.5">
                <label className="block text-plum-300 font-bold uppercase text-[10px] tracking-wider">
                  Link an Existing Catalog Product (Optional Auto-Fill)
                </label>
                <select
                  value={form.product_id}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full bg-plum-900 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none"
                >
                  <option value="">-- Choose Product to Auto-Fill Data --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} (₹{p.sale_price || p.price})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-plum-400">
                  Selecting a product automatically loads its title, image, prices, and direct store link.
                </p>
              </div>

              {/* Title & Headline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-plum-300 font-bold mb-1">
                    Product / Advertisement Title *
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. 64W Fast Charger"
                    className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none focus:border-coral-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-plum-300 font-bold mb-1">
                    Promotional Headline (Top Banner)
                  </label>
                  <input
                    type="text"
                    value={form.headline}
                    onChange={(e) => setForm({ ...form, headline: e.target.value })}
                    placeholder="e.g. Flash Deal of the Day"
                    className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-plum-300 font-bold mb-1">
                    Badge Label
                  </label>
                  <input
                    type="text"
                    value={form.badge}
                    onChange={(e) => setForm({ ...form, badge: e.target.value })}
                    placeholder="e.g. SPECIAL OFFER, HOT DEAL"
                    className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-plum-300 font-bold mb-1">
                  Short Promotional Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="e.g. Dual Port Type-C & USB-A Fast Charger. Fast power delivery for iPhone, Samsung & OnePlus."
                  className="w-full bg-plum-950 border border-plum-700 rounded-xl p-3 text-ivory focus:outline-none placeholder:text-plum-600"
                />
              </div>

              {/* Pricing & Deals */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-plum-300 font-bold mb-1">Original Price (₹ MRP)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.original_price}
                    onChange={(e) => setForm({ ...form, original_price: e.target.value })}
                    placeholder="e.g. 1499"
                    className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-plum-300 font-bold mb-1">Special Offer Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.offer_price}
                    onChange={(e) => setForm({ ...form, offer_price: e.target.value })}
                    placeholder="e.g. 70"
                    className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none focus:border-emerald-400 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-plum-300 font-bold mb-1">Discount % (Optional)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.discount_percent}
                    onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                    placeholder="Auto-calculated if blank"
                    className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none"
                  />
                </div>
              </div>

              {/* Image URL & Upload */}
              <div>
                <label className="block text-plum-300 font-bold mb-1">Product Image URL *</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://... or upload below"
                    className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none"
                    required
                  />
                  <label className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-plum-800 hover:bg-plum-700 text-ivory cursor-pointer border border-plum-700 shrink-0 font-medium">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploading ? 'Uploading...' : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                </div>
                {form.image_url && (
                  <div className="mt-2 w-16 h-16 rounded-xl bg-slate-950 border border-plum-800 p-1">
                    <img src={form.image_url} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                  </div>
                )}
              </div>

              {/* CTA & Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-plum-300 font-bold mb-1">Button Text</label>
                  <input
                    type="text"
                    value={form.cta_text}
                    onChange={(e) => setForm({ ...form, cta_text: e.target.value })}
                    placeholder="Shop Now"
                    className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-plum-300 font-bold mb-1">Destination Link</label>
                  <input
                    type="text"
                    value={form.cta_link}
                    onChange={(e) => setForm({ ...form, cta_link: e.target.value })}
                    placeholder="/products or /product/slug"
                    className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Schedule Dates & Order */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-plum-300 font-bold mb-1">Start Date (Optional)</label>
                  <input
                    type="datetime-local"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-plum-300 font-bold mb-1">End Date (Optional)</label>
                  <input
                    type="datetime-local"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-plum-300 font-bold mb-1">Display Order</label>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                    className="w-full bg-plum-950 border border-plum-700 rounded-xl px-3 py-2 text-ivory focus:outline-none"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="adActiveCheck"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded text-coral-500 focus:ring-coral-500"
                />
                <label htmlFor="adActiveCheck" className="text-xs text-plum-200 cursor-pointer font-bold">
                  Activate this advertisement on homepage immediately
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-plum-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSaving}
                  className="bg-coral-500 hover:bg-coral-600"
                >
                  {isSaving ? 'Saving...' : editingAd ? 'Update Advertisement' : 'Publish Advertisement'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
