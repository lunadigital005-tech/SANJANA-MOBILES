import React, { useState, useEffect } from 'react';
import { Search, X, ArrowRight, Zap, Smartphone, Headphones, Shield, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { storeConfig } from '../../config/store';
import { SearchSuggestionsResponse } from '../../types';

export interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TRENDING_SEARCHES = [
  'iPhone 15 Pro Case',
  '65W GaN Fast Charger',
  'boAt ANC Earbuds',
  'Type-C Braided Cable',
  '20000mAh Power Bank',
  'Samsung S24 Ultra Glass',
  'Smartwatch AMOLED',
  'Magnetic Car Mount'
];

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSuggestions(null);
      return;
    }
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setSuggestions(null);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.getSearchSuggestions(query.trim(), 8);
        setSuggestions(res);
      } catch (err) {
        console.warn('Search suggestions error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleFullSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    onClose();
    navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleFullSearch(query);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Search Container */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden z-10 animate-fade-in flex flex-col max-h-[85vh]">
        {/* Search Input Bar */}
        <div className="flex items-center px-6 py-4 border-b border-slate-100 bg-white">
          <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search phones, chargers, earbuds, cases, power banks..."
            className="w-full text-base bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
            autoFocus
          />
          {loading && <Loader2 className="w-4 h-4 text-primary animate-spin mr-2 shrink-0" />}
          {query && !loading && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-900 mr-2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs uppercase font-bold text-slate-400 hover:text-slate-900 tracking-wider pl-2"
          >
            Esc
          </button>
        </div>

        {/* Results Area */}
        <div className="p-6 overflow-y-auto space-y-6">
          {query.trim().length < 2 ? (
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-3">
                Trending Mobile Searches
              </p>
              <div className="flex flex-wrap gap-2">
                {TRENDING_SEARCHES.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setQuery(tag);
                      handleFullSearch(tag);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* Quick Category Badges */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-3">
                  Quick Mobile Categories
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <Link
                    to="/category/smartphones"
                    onClick={onClose}
                    className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-50 hover:bg-primary/10 hover:text-primary text-slate-700 text-xs font-medium transition-all"
                  >
                    <Smartphone className="w-4 h-4 text-primary" />
                    <span>Smartphones</span>
                  </Link>
                  <Link
                    to="/category/charging-accessories"
                    onClick={onClose}
                    className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-50 hover:bg-primary/10 hover:text-primary text-slate-700 text-xs font-medium transition-all"
                  >
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>Chargers & Cables</span>
                  </Link>
                  <Link
                    to="/category/audio-accessories"
                    onClick={onClose}
                    className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-50 hover:bg-primary/10 hover:text-primary text-slate-700 text-xs font-medium transition-all"
                  >
                    <Headphones className="w-4 h-4 text-indigo-500" />
                    <span>Earbuds & Audio</span>
                  </Link>
                  <Link
                    to="/category/mobile-protection"
                    onClick={onClose}
                    className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-50 hover:bg-primary/10 hover:text-primary text-slate-700 text-xs font-medium transition-all"
                  >
                    <Shield className="w-4 h-4 text-emerald-500" />
                    <span>Cases & Glass</span>
                  </Link>
                </div>
              </div>
            </div>
          ) : suggestions && suggestions.total_matches > 0 ? (
            <div className="space-y-4">
              {/* Matching Categories */}
              {suggestions.categories && suggestions.categories.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">
                    Matching Categories
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.categories.map((cat) => (
                      <Link
                        key={cat.id}
                        to={`/category/${cat.slug}`}
                        onClick={onClose}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white text-xs font-semibold transition-colors"
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Products */}
              {suggestions.products && suggestions.products.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                      Products ({suggestions.products.length})
                    </p>
                    <button
                      onClick={() => handleFullSearch(query)}
                      className="text-xs text-primary font-semibold hover:underline flex items-center space-x-1"
                    >
                      <span>View all results</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {suggestions.products.map((product) => {
                      const displayPrice = product.sale_price || product.price;
                      return (
                        <Link
                          key={product.id}
                          to={`/product/${product.slug || product.id}`}
                          onClick={onClose}
                          className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-primary/5 hover:border-primary/20 border border-slate-100 transition-all group"
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <img
                              src={product.primary_image || 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=200'}
                              alt={product.title}
                              className="w-12 h-12 object-cover rounded-xl bg-white border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center space-x-1.5">
                                {product.brand && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {product.brand}
                                  </span>
                                )}
                                {product.category_name && (
                                  <>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-[10px] text-slate-400">{product.category_name}</span>
                                  </>
                                )}
                              </div>
                              <h4 className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors truncate">
                                {product.title}
                              </h4>
                            </div>
                          </div>
                          <div className="text-right shrink-0 pl-3">
                            <span className="text-sm font-bold text-slate-900">
                              {storeConfig.currencySymbol}{displayPrice.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-sm text-slate-500 mb-4">
                No mobile products found matching &ldquo;{query}&rdquo;
              </p>
              <button
                onClick={() => handleFullSearch(query)}
                className="px-5 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-dark transition-all"
              >
                Search all catalog for &ldquo;{query}&rdquo;
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
