import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { storeConfig } from '../../config/store';

import { Category } from '../../types';

export const POPULAR_BRANDS = [
  'Apple',
  'Samsung',
  'OnePlus',
  'Xiaomi',
  'boAt',
  'Anker',
  'SanDisk',
  'Portronics',
  'Noise',
  'Spigen'
];

export interface FilterState {
  category: string;
  brand: string;
  search: string;
  minPrice: number;
  maxPrice: number;
  sortBy: 'featured' | 'price-low' | 'price-high' | 'rating';
  inStockOnly: boolean;
}

export interface ProductFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
  categories?: Category[];
}

export const ProductFilters: React.FC<ProductFiltersProps> = ({
  filters,
  onChange,
  onReset,
  categories = []
}) => {
  const handleCategoryChange = (slug: string) => {
    onChange({ ...filters, category: slug });
  };

  const handleBrandChange = (brand: string) => {
    onChange({ ...filters, brand: filters.brand === brand ? '' : brand });
  };

  const handleSortChange = (sortBy: FilterState['sortBy']) => {
    onChange({ ...filters, sortBy });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-900 font-display font-bold">
          <Filter className="w-4 h-4 text-primary" />
          <span>Filters</span>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-slate-400 hover:text-slate-900 flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      {/* Sort By */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
          Sort By
        </label>
        <select
          value={filters.sortBy}
          onChange={(e) => handleSortChange(e.target.value as FilterState['sortBy'])}
          className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="featured">Featured & Recommended</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
          <option value="rating">Highest Rated</option>
        </select>
      </div>

      {/* Categories */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
          Mobile Categories
        </label>
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          <button
            onClick={() => handleCategoryChange('')}
            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filters.category === ''
                ? 'bg-slate-900 text-white font-bold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.slug)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                filters.category === cat.slug
                  ? 'bg-slate-900 text-white font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="truncate pr-2">{cat.name}</span>
              <span className={`text-[10px] shrink-0 ${filters.category === cat.slug ? 'text-primary-light' : 'text-slate-400'}`}>
                {cat.item_count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Brands Filter */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
          Brands
        </label>
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_BRANDS.map((b) => {
            const isSelected = filters.brand === b;
            return (
              <button
                key={b}
                onClick={() => handleBrandChange(b)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                  isSelected
                    ? 'bg-primary text-white font-bold shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                {b}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price Max Slider */}
      <div>
        <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-2">
          <span className="uppercase tracking-wider">Max Price</span>
          <span className="text-primary font-display font-bold">
            {storeConfig.currencySymbol}{filters.maxPrice.toLocaleString('en-IN')}
          </span>
        </div>
        <input
          type="range"
          min="100"
          max="150000"
          step="500"
          value={filters.maxPrice}
          onChange={(e) => onChange({ ...filters, maxPrice: Number(e.target.value) })}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[11px] text-slate-400 mt-1">
          <span>{storeConfig.currencySymbol}100</span>
          <span>{storeConfig.currencySymbol}1,50,000+</span>
        </div>
      </div>

      {/* In-Stock Only Toggle */}
      <div className="pt-2 border-t border-slate-100">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={(e) => onChange({ ...filters, inStockOnly: e.target.checked })}
            className="rounded border-slate-300 text-primary focus:ring-primary/30 w-4 h-4 accent-primary"
          />
          <span className="text-xs font-medium text-slate-700">In-Stock Only</span>
        </label>
      </div>
    </div>
  );
};
