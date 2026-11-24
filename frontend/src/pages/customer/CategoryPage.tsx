import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { Category, Product } from '../../types';
import { ProductCard } from '../../components/product/ProductCard';
import { EmptyState } from '../../components/common/EmptyState';
import { ProductCardSkeleton } from '../../components/common/LoadingSkeleton';

export const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategoryCatalog = async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const [catData, prodsData] = await Promise.all([
        api.getCategory(slug),
        api.getProducts({ category_slug: slug })
      ]);
      setCategory(catData);
      setProducts(prodsData.items);
    } catch (err: any) {
      console.error('Failed to fetch category page data:', err);
      setError(err?.message || 'Unable to connect to category catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategoryCatalog();
  }, [slug]);

  if (!loading && error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-slate-900 text-xl">Unable to Load Category</h3>
        <p className="text-sm text-slate-600">{error}</p>
        <button
          onClick={() => fetchCategoryCatalog()}
          className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  if (!loading && !category) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <EmptyState
          title="Category Not Found"
          description="The requested mobile category does not exist or has been relocated."
          actionLabel="View All Products"
          onAction={() => window.location.assign('/products')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/products" className="hover:text-primary flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Mobile Store</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">{category?.name || 'Category'}</span>
      </div>

      {/* Collection Hero Banner */}
      {category && (
        <div className="relative rounded-3xl overflow-hidden aspect-[21/9] min-h-[200px] max-h-[300px] bg-slate-900 shadow-xl flex items-center">
          <img
            src={category.image_url || 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=800'}
            alt={category.name}
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/50 to-transparent" />
          <div className="relative z-10 p-6 sm:p-10 max-w-xl text-white">
            <span className="text-xs uppercase tracking-widest font-extrabold text-primary-light block mb-2">
              SANJANA MOBILES • {products.length} Products
            </span>
            <h1 className="text-2xl sm:text-4xl font-display font-black text-white mb-3">
              {category.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {category.description}
            </p>
          </div>
        </div>
      )}

      {/* Category Products Grid */}
      <div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            title="No products in this category currently"
            description="Our inventory team is currently restocking new shipments for this category. Please check back shortly."
            actionLabel="Explore All Mobile Gear"
            onAction={() => window.location.assign('/products')}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
