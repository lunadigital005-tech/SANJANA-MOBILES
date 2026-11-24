import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, RefreshCw, Smartphone, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { Product, Category } from '../../types';
import { ProductCard } from '../../components/product/ProductCard';
import { ProductFilters, FilterState } from '../../components/product/ProductFilters';
import { EmptyState } from '../../components/common/EmptyState';
import { ProductCardSkeleton } from '../../components/common/LoadingSkeleton';

export const AllProductsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') || '';
  const searchParam = searchParams.get('search') || '';

  const initialFilters: FilterState = {
    category: categoryParam,
    brand: '',
    search: searchParam,
    minPrice: 0,
    maxPrice: 150000,
    sortBy: 'featured',
    inStockOnly: false,
  };

  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCategories()
      .then((data) => {
        if (data && data.length > 0) setCategories(data);
      })
      .catch(() => {});
  }, []);

  // Sync search param changes from URL (e.g. from header search)
  useEffect(() => {
    const s = searchParams.get('search') || '';
    const c = searchParams.get('category') || '';
    setFilters((prev) => ({
      ...prev,
      search: s,
      category: c || prev.category
    }));
  }, [searchParams]);

  const fetchCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      // Map frontend sort format to backend
      let sortBackend = 'featured';
      if (filters.sortBy === 'price-low') sortBackend = 'price_asc';
      else if (filters.sortBy === 'price-high') sortBackend = 'price_desc';
      else if (filters.sortBy === 'rating') sortBackend = 'featured';

      const res = await api.getProducts({
        category_slug: filters.category || undefined,
        search: filters.search || undefined,
        max_price: filters.maxPrice,
        in_stock_only: filters.inStockOnly,
        sort_by: sortBackend,
        limit: 50
      });

      let items = res.items;
      if (filters.brand) {
        items = items.filter((p) => p.brand && p.brand.toLowerCase() === filters.brand.toLowerCase());
      }

      setProducts(items);
      setTotalCount(items.length);
    } catch (err: any) {
      console.error('Failed to load products:', err);
      setError(err?.message || 'Unable to connect to product catalog server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [filters]);

  const handleReset = () => {
    setFilters(initialFilters);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page Header */}
      <div className="mb-8 border-b border-slate-200 pb-6">
        <span className="text-xs uppercase tracking-widest font-extrabold text-primary block mb-1">
          SANJANA MOBILES • Official Store
        </span>
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-slate-900">
          Smartphones & Mobile Accessories
        </h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Browse verified genuine 5G smartphones, GaN high-speed chargers, braided Type-C cables, ANC earbuds, shockproof cases, power banks, and essential gadgets.
        </p>
      </div>

      {/* Mobile Filter Toggle */}
      <div className="lg:hidden mb-6 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">
          Showing {totalCount} mobile items
        </span>
        <button
          onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-xs"
        >
          <Filter className="w-3.5 h-3.5 text-primary" />
          <span>{isMobileFiltersOpen ? 'Hide Filters' : 'Filter & Sort'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Desktop Sidebar Filters */}
        <div className={`lg:block ${isMobileFiltersOpen ? 'block mb-6' : 'hidden'}`}>
          <div className="sticky top-28">
            <ProductFilters
              filters={filters}
              onChange={setFilters}
              onReset={handleReset}
              categories={categories}
            />
          </div>
        </div>

        {/* Product Grid */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 bg-red-50/80 border border-red-200 rounded-2xl text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Unable to Load Products</h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">{error}</p>
              <button
                onClick={() => fetchCatalog()}
                className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connection</span>
              </button>
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              title="No mobile products match your filters"
              description="Try adjusting your brand, category or price range to find matching products."
              actionLabel="Reset All Filters"
              onAction={handleReset}
            />
          ) : (
            <div>
              <div className="hidden lg:flex items-center justify-between mb-6 text-xs text-slate-500 font-medium">
                <span>Showing {products.length} of {totalCount} products</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
