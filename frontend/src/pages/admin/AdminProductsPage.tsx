import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Upload, 
  Star, 
  Check, 
  X, 
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Product, Category, ProductImageItem } from '../../types';
import { formatPrice } from '../../config/store';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../context/ToastContext';

export const AdminProductsPage: React.FC = () => {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState<{
    title: string;
    slug: string;
    description: string;
    price: string;
    sale_price: string;
    sku: string;
    brand: string;
    model: string;
    warranty: string;
    compatibility: string;
    category_ids: string[];
    images: string[];
    image_details: ProductImageItem[];
    primary_image: string;
    stock_quantity: string;
    low_stock_threshold: string;
    is_active: boolean;
    is_featured: boolean;
    is_best_seller: boolean;
    is_new_arrival: boolean;
    materials: string;
    dimensions: string;
    tags: string;
  }>({
    title: '',
    slug: '',
    description: '',
    price: '',
    sale_price: '',
    sku: '',
    brand: 'Sanjana',
    model: '',
    warranty: '1 Year Brand Warranty',
    compatibility: '',
    category_ids: [],
    images: [],
    image_details: [],
    primary_image: '',
    stock_quantity: '10',
    low_stock_threshold: '5',
    is_active: true,
    is_featured: false,
    is_best_seller: false,
    is_new_arrival: false,
    materials: '',
    dimensions: '',
    tags: '',
  });

  const fetchData = async () => {
    if (!token) return;
    try {
      const [prodsData, catsData] = await Promise.all([
        api.adminGetProducts(token),
        api.adminGetCategories(token)
      ]);
      setProducts(prodsData.items);
      setCategories(catsData);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch catalog data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      title: '',
      slug: '',
      description: '',
      price: '',
      sale_price: '',
      sku: `SNJ-MOB-${Date.now().toString().slice(-4)}`,
      brand: 'Sanjana',
      model: '',
      warranty: '1 Year Brand Warranty',
      compatibility: 'All 5G Devices, iOS & Android',
      category_ids: categories.length > 0 ? [categories[0].id] : [],
      images: [],
      image_details: [],
      primary_image: '',
      stock_quantity: '10',
      low_stock_threshold: '5',
      is_active: true,
      is_featured: false,
      is_best_seller: false,
      is_new_arrival: true,
      materials: '',
      dimensions: '',
      tags: '5G, Fast Charging',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      title: p.title,
      slug: p.slug,
      description: p.description,
      price: p.price.toString(),
      sale_price: p.sale_price !== null && p.sale_price !== undefined ? p.sale_price.toString() : '',
      sku: p.sku,
      brand: p.brand || 'Sanjana',
      model: p.model || '',
      warranty: p.warranty || '1 Year Brand Warranty',
      compatibility: p.compatibility ? p.compatibility.join(', ') : '',
      category_ids: p.category_ids || [],
      images: p.images || [],
      image_details: p.image_details || p.images.map((img, i) => ({
        id: `img-${i}`,
        image_url: img,
        is_primary: img === p.primary_image || (i === 0 && !p.primary_image),
        display_order: i + 1
      })),
      primary_image: p.primary_image || p.images[0] || '',
      stock_quantity: (p.available_stock ?? p.stock_quantity).toString(),
      low_stock_threshold: (p.low_stock_threshold ?? 5).toString(),
      is_active: p.is_active ?? true,
      is_featured: p.is_featured || false,
      is_best_seller: p.is_best_seller || false,
      is_new_arrival: p.is_new_arrival || false,
      materials: p.materials || '',
      dimensions: p.dimensions || '',
      tags: p.tags ? p.tags.join(', ') : '',
    });
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !token) return;

    setUploading(true);
    try {
      const newImages = [...formData.images];
      const newDetails = [...formData.image_details];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await api.adminUploadImage(token, file);
        newImages.push(res.url);
        newDetails.push({
          id: `img-${Date.now()}-${i}`,
          image_url: res.url,
          storage_path: res.storage_path,
          is_primary: newDetails.length === 0,
          display_order: newDetails.length + 1
        });
      }

      setFormData((prev) => ({
        ...prev,
        images: newImages,
        image_details: newDetails,
        primary_image: prev.primary_image || newImages[0]
      }));

      showToast(`Uploaded ${files.length} images to Supabase Storage`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Image upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const setPrimaryImage = (url: string) => {
    setFormData((prev) => ({
      ...prev,
      primary_image: url,
      image_details: prev.image_details.map((item) => ({
        ...item,
        is_primary: item.image_url === url
      }))
    }));
    showToast('Primary product image updated', 'info');
  };

  const removeImage = (url: string) => {
    setFormData((prev) => {
      const remaining = prev.images.filter((img) => img !== url);
      const remainingDetails = prev.image_details.filter((img) => img.image_url !== url);
      return {
        ...prev,
        images: remaining,
        image_details: remainingDetails,
        primary_image: prev.primary_image === url ? (remaining[0] || '') : prev.primary_image
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.price || !formData.sku) {
      showToast('Please provide Title, Price, and SKU.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        title: formData.title,
        slug: formData.slug || formData.title.toLowerCase().replace(/\s+/g, '-'),
        description: formData.description,
        price: parseFloat(formData.price),
        sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
        sku: formData.sku,
        brand: formData.brand || 'Sanjana',
        model: formData.model || null,
        warranty: formData.warranty || '1 Year Brand Warranty',
        compatibility: formData.compatibility ? formData.compatibility.split(',').map((c) => c.trim()).filter(Boolean) : [],
        category_ids: formData.category_ids,
        images: formData.images.length > 0 ? formData.images : ['https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=900'],
        image_details: formData.image_details,
        primary_image: formData.primary_image || formData.images[0] || '',
        stock_quantity: parseInt(formData.stock_quantity, 10) || 0,
        low_stock_threshold: parseInt(formData.low_stock_threshold, 10) || 5,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
        is_best_seller: formData.is_best_seller,
        is_new_arrival: formData.is_new_arrival,
        materials: formData.materials,
        dimensions: formData.dimensions,
        tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
      };

      if (editingProduct) {
        await api.adminUpdateProduct(token!, editingProduct.id, payload);
        showToast(`Product "${formData.title}" updated`, 'success');
      } else {
        await api.adminCreateProduct(token!, payload);
        showToast(`Product "${formData.title}" added to catalog`, 'success');
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to save product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (p: Product) => {
    if (!token) return;
    try {
      const nextStatus = !p.is_active;
      await api.adminToggleProductStatus(token, p.id, nextStatus);
      setProducts((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, is_active: nextStatus } : item))
      );
      showToast(`Piece "${p.title}" set to ${nextStatus ? 'Active' : 'Draft'}`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const confirmDeleteProduct = async () => {
    if (!deleteTarget || !token) return;
    try {
      await api.adminDeleteProduct(token, deleteTarget.id);
      showToast(`Piece "${deleteTarget.title}" deleted from catalog`, 'info');
      setDeleteTarget(null);
      await fetchData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete product', 'error');
    }
  };

  const filtered = products.filter((p) => {
    if (selectedCategory !== 'all' && !(p.category_ids || []).includes(selectedCategory)) return false;
    if (selectedStatus === 'active' && !p.is_active) return false;
    if (selectedStatus === 'inactive' && p.is_active) return false;
    if (
      search &&
      !p.title.toLowerCase().includes(search.toLowerCase()) &&
      !p.sku.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-coral-400 block mb-1">
            Product Management (Phase 04)
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
            Creations & Catalog Governance
          </h1>
          <p className="text-xs text-plum-300 mt-1">
            Curate specifications, multiple image galleries, primary selections, pricing, and multi-category allocations.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenCreate}
          leftIcon={<Plus className="w-4 h-4" />}
          className="self-start sm:self-auto"
        >
          Add New Creation
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 bg-plum-900/60 border border-plum-800 p-3 rounded-2xl w-full md:max-w-md">
          <Search className="w-4 h-4 text-plum-400 ml-1" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search creations by title or SKU..."
            className="bg-transparent text-xs text-ivory placeholder:text-plum-500 focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs bg-plum-900 border border-plum-800 rounded-xl px-3 py-2.5 text-ivory focus:outline-none"
          >
            <option value="all">All Disciplines</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs bg-plum-900 border border-plum-800 rounded-xl px-3 py-2.5 text-ivory focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Draft / Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-plum-900/60 border border-plum-800/80 rounded-3xl p-6 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-plum-800 text-plum-400 uppercase font-semibold tracking-wider">
                <th className="pb-3 px-3">Primary</th>
                <th className="pb-3 px-3">Title & SKU</th>
                <th className="pb-3 px-3">Collections</th>
                <th className="pb-3 px-3">Price / Sale</th>
                <th className="pb-3 px-3">Available Stock</th>
                <th className="pb-3 px-3">Visibility</th>
                <th className="pb-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-plum-800/60">
              {filtered.map((prod) => (
                <tr key={prod.id} className="hover:bg-plum-800/30 transition-colors">
                  <td className="py-3 px-3">
                    <img
                      src={prod.primary_image || prod.images[0]}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover bg-plum-950 border border-plum-800"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-white text-sm line-clamp-1">{prod.title}</p>
                    <p className="text-[11px] font-mono text-plum-400">{prod.sku}</p>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {prod.category_names && prod.category_names.length > 0 ? (
                        prod.category_names.map((name, i) => (
                          <span key={i} className="text-[10px] bg-plum-800 text-plum-300 px-2 py-0.5 rounded-md">
                            {name}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-plum-400">Curated</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display font-bold text-white text-sm">
                        {formatPrice(prod.sale_price || prod.price)}
                      </span>
                      {prod.sale_price && (
                        <span className="text-[11px] text-plum-400 line-through">
                          {formatPrice(prod.price)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      (prod.available_stock ?? prod.stock_quantity) === 0
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : (prod.available_stock ?? prod.stock_quantity) <= 5
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {prod.available_stock ?? prod.stock_quantity} units
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <button
                      onClick={() => handleToggleStatus(prod)}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                        prod.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'bg-plum-800 text-plum-400 border border-plum-700 hover:bg-plum-700'
                      }`}
                    >
                      {prod.is_active ? 'Active' : 'Draft'}
                    </button>
                  </td>
                  <td className="py-3 px-3 text-right space-x-2">
                    <button
                      onClick={() => handleOpenEdit(prod)}
                      className="p-1.5 text-plum-300 hover:text-white rounded-lg hover:bg-plum-800/60 transition-colors"
                      title="Edit Product"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(prod)}
                      className="p-1.5 text-plum-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? `Edit Creation: ${editingProduct.title}` : 'Add New Creation'}
        description="Configure piece dimensions, pricing, gallery images, and warehouse quantities."
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <Input
            label="Creation Title"
            type="text"
            value={formData.title}
            onChange={(e) => {
              const title = e.target.value;
              setFormData((prev) => ({
                ...prev,
                title,
                slug: !editingProduct ? title.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and') : prev.slug
              }));
            }}
            placeholder="e.g. Sculptural Basalt Low Table"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="SKU Identifier"
              type="text"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              placeholder="SNJ-MOB-092"
              required
            />
            <Input
              label="URL Slug"
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="sculptural-basalt-low-table"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-plum-700 mb-1.5">
              Description & Artisan Notes
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-plum-200 bg-white/80 p-3 text-xs text-plum-900 focus:outline-none"
              placeholder="Artisanal provenance, tactile qualities, and finish descriptions..."
              required
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input
              label="Price ($ USD)"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="850.00"
              required
            />
            <Input
              label="Sale Price ($ USD, Opt)"
              type="number"
              step="0.01"
              value={formData.sale_price}
              onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
              placeholder="720.00"
            />
            <Input
              label="Available Stock"
              type="number"
              value={formData.stock_quantity}
              onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
              placeholder="10"
              required
            />
            <Input
              label="Low Stock Alert"
              type="number"
              value={formData.low_stock_threshold}
              onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
              placeholder="5"
              required
            />
          </div>

          {/* Multiple Categories Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-plum-700 mb-1.5">
              Assign Discipline Collections (Multiple supported)
            </label>
            <div className="flex flex-wrap gap-2 p-3 bg-white/80 border border-plum-200 rounded-xl">
              {categories.map((c) => {
                const checked = formData.category_ids.includes(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        category_ids: checked
                          ? prev.category_ids.filter((id) => id !== c.id)
                          : [...prev.category_ids, c.id]
                      }));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      checked
                        ? 'bg-plum-900 text-ivory font-semibold'
                        : 'bg-plum-50 text-plum-700 hover:bg-plum-100'
                    }`}
                  >
                    {checked && <Check className="w-3 h-3 inline mr-1 text-coral-400" />}
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multi-Image Gallery & Primary Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-plum-700">
                Piece Gallery (Supabase Storage)
              </label>
              <span className="text-[11px] text-plum-400">Click star to set Primary image</span>
            </div>

            {/* Gallery Thumbnails */}
            {formData.images.length > 0 && (
              <div className="grid grid-cols-4 gap-3 mb-3">
                {formData.images.map((url, i) => {
                  const isPrimary = url === formData.primary_image;
                  return (
                    <div key={i} className="relative group rounded-xl overflow-hidden border border-plum-200 aspect-square bg-ivory">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-plum-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPrimaryImage(url)}
                          className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
                            isPrimary ? 'bg-coral-500 text-white' : 'bg-white/80 text-plum-900 hover:bg-white'
                          }`}
                          title="Set as Primary"
                        >
                          <Star className={`w-3.5 h-3.5 ${isPrimary ? 'fill-white' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(url)}
                          className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                          title="Remove Image"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {isPrimary && (
                        <div className="absolute bottom-1 left-1 bg-coral-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          Primary
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upload trigger */}
            <label className="block cursor-pointer">
              <div className="border border-dashed border-plum-300 rounded-xl p-4 text-center hover:bg-plum-50 transition-colors">
                <Upload className="w-5 h-5 text-plum-500 mx-auto mb-1" />
                <span className="text-xs font-semibold text-plum-800">
                  {uploading ? 'Uploading to Supabase Storage...' : 'Upload Image Files (JPG, PNG, WEBP)'}
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Brand"
              type="text"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              placeholder="e.g. Apple, Samsung, Anker, boAt"
            />
            <Input
              label="Model Number / Series"
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              placeholder="e.g. iPhone 15 Pro, S24 Ultra, 65W GaN"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Official Warranty"
              type="text"
              value={formData.warranty}
              onChange={(e) => setFormData({ ...formData, warranty: e.target.value })}
              placeholder="e.g. 1 Year Official Brand Warranty"
            />
            <Input
              label="Device Compatibility (Comma-separated)"
              type="text"
              value={formData.compatibility}
              onChange={(e) => setFormData({ ...formData, compatibility: e.target.value })}
              placeholder="iPhone 15, S24 Ultra, OnePlus, MacBooks"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Build Materials"
              type="text"
              value={formData.materials}
              onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
              placeholder="e.g. Aluminum, Tempered Glass, Braided Nylon"
            />
            <Input
              label="Dimensions & Specs"
              type="text"
              value={formData.dimensions}
              onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
              placeholder="e.g. 1.2m Cable, 65W Max Output"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-plum-800">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-plum-300 text-coral-500 focus:ring-coral-400 w-4 h-4"
              />
              <span>Active in Customer Catalog</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-plum-800">
              <input
                type="checkbox"
                checked={formData.is_featured}
                onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                className="rounded border-plum-300 text-coral-500 focus:ring-coral-400 w-4 h-4"
              />
              <span>Featured</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-plum-800">
              <input
                type="checkbox"
                checked={formData.is_best_seller}
                onChange={(e) => setFormData({ ...formData, is_best_seller: e.target.checked })}
                className="rounded border-plum-300 text-coral-500 focus:ring-coral-400 w-4 h-4"
              />
              <span>Best Seller</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-plum-800">
              <input
                type="checkbox"
                checked={formData.is_new_arrival}
                onChange={(e) => setFormData({ ...formData, is_new_arrival: e.target.checked })}
                className="rounded border-plum-300 text-coral-500 focus:ring-coral-400 w-4 h-4"
              />
              <span>New Arrival</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-plum-100">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={saving}>
              {editingProduct ? 'Save Product Changes' : 'Add Product to Catalog'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Piece Deletion"
        description="This will permanently delete this creation and its associated inventory."
      >
        <div className="space-y-4">
          <p className="text-xs text-plum-700">
            Are you sure you want to remove <strong className="text-plum-950">&ldquo;{deleteTarget?.title}&rdquo;</strong> (<code className="font-mono">{deleteTarget?.sku}</code>)?
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-plum-100">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDeleteProduct}>
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
