import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Upload, 
  Eye, 
  EyeOff, 
  AlertTriangle,
  ArrowUpDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Category } from '../../types';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../context/ToastContext';

export const AdminCategoriesPage: React.FC = () => {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState<{
    name: string;
    slug: string;
    description: string;
    image_url: string;
    storage_path: string;
    parent_id: string | null;
    display_order: number;
    is_active: boolean;
  }>({
    name: '',
    slug: '',
    description: '',
    image_url: '',
    storage_path: '',
    parent_id: null,
    display_order: 0,
    is_active: true,
  });

  const fetchCategories = async () => {
    if (!token) return;
    try {
      const data = await api.adminGetCategories(token);
      setCategories(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [token]);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      image_url: '',
      storage_path: '',
      parent_id: null,
      display_order: (categories.length + 1) * 10,
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      image_url: cat.image_url || '',
      storage_path: cat.storage_path || '',
      parent_id: cat.parent_id || null,
      display_order: cat.display_order ?? 0,
      is_active: cat.is_active ?? true,
    });
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setUploading(true);
    try {
      const result = await api.adminUploadImage(token, file);
      setFormData((prev) => ({
        ...prev,
        image_url: result.url,
        storage_path: result.storage_path
      }));
      showToast('Cover image successfully uploaded to Supabase Storage', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to upload image', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Collection name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingCategory) {
        await api.adminUpdateCategory(token!, editingCategory.id, formData);
        showToast(`Collection "${formData.name}" updated`, 'success');
      } else {
        await api.adminCreateCategory(token!, formData);
        showToast(`Collection "${formData.name}" created`, 'success');
      }
      await fetchCategories();
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to save collection', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deleteTarget || !token) return;
    try {
      await api.adminDeleteCategory(token, deleteTarget.id);
      showToast(`Collection "${deleteTarget.name}" deleted`, 'info');
      setDeleteTarget(null);
      await fetchCategories();
    } catch (err: any) {
      showToast(err.message || 'Cannot delete category', 'error');
    }
  };

  const filtered = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-coral-400 block mb-1">
            Category Architecture (Phase 04)
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
            Curated Categories & Disciplines
          </h1>
          <p className="text-xs text-plum-300 mt-1">
            Create and edit product taxonomies, upload Supabase Storage covers, and manage display sequencing.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenCreate}
          leftIcon={<Plus className="w-4 h-4" />}
          className="self-start sm:self-auto"
        >
          Add New Collection
        </Button>
      </div>

      {/* Filter and Search */}
      <div className="flex items-center gap-3 bg-plum-900/60 border border-plum-800 p-3 rounded-2xl max-w-md">
        <Search className="w-4 h-4 text-plum-400 ml-1" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search collections by name or slug..."
          className="bg-transparent text-xs text-ivory placeholder:text-plum-500 focus:outline-none w-full"
        />
      </div>

      {/* Table */}
      <div className="bg-plum-900/60 border border-plum-800/80 rounded-3xl p-6 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-plum-800 text-plum-400 uppercase font-semibold tracking-wider">
                <th className="pb-3 px-3">Cover</th>
                <th className="pb-3 px-3">Collection Name</th>
                <th className="pb-3 px-3">Slug</th>
                <th className="pb-3 px-3">Assigned Pieces</th>
                <th className="pb-3 px-3">Display Order</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-plum-800/60">
              {filtered.map((cat) => (
                <tr key={cat.id} className="hover:bg-plum-800/30 transition-colors">
                  <td className="py-3 px-3">
                    <img
                      src={cat.image_url || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=200'}
                      alt={cat.name}
                      className="w-12 h-12 rounded-xl object-cover bg-plum-950 border border-plum-800"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-white text-sm">{cat.name}</p>
                    <p className="text-[11px] text-plum-400 line-clamp-1">{cat.description}</p>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-coral-400">
                    /{cat.slug}
                  </td>
                  <td className="py-3 px-3 font-semibold text-white">
                    {cat.item_count} items
                  </td>
                  <td className="py-3 px-3 text-plum-300 font-mono">
                    #{cat.display_order ?? 0}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      cat.is_active !== false
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-plum-800 text-plum-400 border border-plum-700'
                    }`}>
                      {cat.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right space-x-2">
                    <button
                      onClick={() => handleOpenEdit(cat)}
                      className="p-1.5 text-plum-300 hover:text-white rounded-lg hover:bg-plum-800/60 transition-colors"
                      title="Edit Category"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(cat)}
                      className="p-1.5 text-plum-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="Delete Category"
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

      {/* Category Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? `Edit Collection: ${editingCategory.name}` : 'Create New Collection'}
        description="Define discipline taxonomies, display sequencing, and atmospheric banner artwork."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Collection Name"
            type="text"
            value={formData.name}
            onChange={(e) => {
              const name = e.target.value;
              setFormData((prev) => ({
                ...prev,
                name,
                slug: !editingCategory ? name.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and') : prev.slug
              }));
            }}
            placeholder="e.g. Sculptural Lighting"
            required
          />

          <Input
            label="URL Slug (Unique)"
            type="text"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            placeholder="e.g. charging-accessories or fast-cables"
            required
          />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-plum-700 mb-1.5">
              Parent Category (Optional - select to create a Subcategory)
            </label>
            <select
              value={formData.parent_id || ''}
              onChange={(e) => setFormData({ ...formData, parent_id: e.target.value || null })}
              className="w-full text-xs font-medium bg-white border border-plum-200 rounded-xl px-3 py-2.5 text-plum-900 focus:outline-none"
            >
              <option value="">None (Top-Level Primary Category)</option>
              {categories
                .filter((c) => !editingCategory || c.id !== editingCategory.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-plum-700 mb-1.5">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-plum-200 bg-white/80 p-3 text-xs text-plum-900 focus:outline-none"
              placeholder="Atmospheric summary describing the aesthetic..."
            />
          </div>

          {/* Image Upload Area */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-plum-700 mb-1.5">
              Cover Artwork (Supabase Storage)
            </label>
            <div className="flex items-center gap-3">
              {formData.image_url && (
                <img
                  src={formData.image_url}
                  alt="Preview"
                  className="w-14 h-14 rounded-xl object-cover border border-plum-200 bg-ivory"
                />
              )}
              <label className="flex-1 cursor-pointer">
                <div className="border border-dashed border-plum-300 rounded-xl p-3 text-center hover:bg-plum-50 transition-colors">
                  <Upload className="w-4 h-4 text-plum-500 mx-auto mb-1" />
                  <span className="text-xs font-semibold text-plum-700">
                    {uploading ? 'Uploading to Supabase Storage...' : 'Upload Image File (JPG, PNG, WEBP)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Input
              label="Display Order Priority"
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value, 10) || 0 })}
            />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-plum-700 mb-2">
                Visibility Status
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-2 text-xs font-semibold text-plum-800">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-plum-300 text-coral-500 focus:ring-coral-400 w-4 h-4"
                />
                <span>Active in Storefront</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-plum-100">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={saving}>
              {editingCategory ? 'Update Collection' : 'Create Collection'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Safe Deletion Confirmation Dialog */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Collection Deletion"
        description="Verify safety constraints before removing this category."
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Safety Rule Enforced:</p>
              <p>
                Categories containing assigned products cannot be deleted. You must reassign or remove all {deleteTarget?.item_count || 0} pieces first.
              </p>
            </div>
          </div>

          <p className="text-xs text-plum-700">
            Are you certain you want to remove <strong className="text-plum-950">&ldquo;{deleteTarget?.name}&rdquo;</strong>?
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-plum-100">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDeleteCategory}>
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
