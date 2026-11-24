import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, Trash2, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { storeConfig } from '../../config/store';

export const WishlistPage: React.FC = () => {
  const { wishlistItems, removeFromWishlist, clearWishlist } = useWishlist();
  const { addItem } = useCart();
  const { showToast } = useToast();

  const handleMoveToCart = (product: any) => {
    addItem(product, 1);
    removeFromWishlist(product.id);
    showToast(`Added ${product.title} to cart!`, 'success');
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2 text-sm text-slate-500 mb-2">
              <Link to="/" className="hover:text-primary transition-colors">Home</Link>
              <span>/</span>
              <span className="text-slate-800 font-medium">My Wishlist</span>
            </div>
            <h1 className="text-3xl font-display font-bold text-slate-900 flex items-center space-x-3">
              <span>Saved Items</span>
              <span className="text-sm font-sans font-medium px-3 py-1 bg-primary/10 text-primary rounded-full">
                {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'}
              </span>
            </h1>
          </div>

          {wishlistItems.length > 0 && (
            <button
              onClick={clearWishlist}
              className="mt-4 md:mt-0 text-sm text-rose-600 hover:text-rose-700 font-medium flex items-center space-x-1.5 transition-colors self-start md:self-auto"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Wishlist</span>
            </button>
          )}
        </div>

        {/* Content */}
        {wishlistItems.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto px-6">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Your Wishlist is Empty</h2>
            <p className="text-slate-500 text-sm mb-8 max-w-md mx-auto">
              Save your favourite smartphones, high-speed GaN chargers, ANC earbuds and cases here to purchase them later.
            </p>
            <Link
              to="/products"
              className="inline-flex items-center space-x-2 px-8 py-3.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-all shadow-md hover:shadow-lg"
            >
              <span>Explore Sanjana Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {wishlistItems.map((product) => {
              const displayPrice = product.sale_price || product.price;
              const hasDiscount = product.original_price && product.original_price > displayPrice;
              const isOutOfStock = product.stock_quantity <= 0 || product.is_out_of_stock;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group"
                >
                  {/* Image & Badges */}
                  <div className="relative aspect-square bg-slate-100 overflow-hidden">
                    <img
                      src={product.primary_image || product.images?.[0] || 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=600'}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Remove button */}
                    <button
                      onClick={() => removeFromWishlist(product.id)}
                      title="Remove from wishlist"
                      className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-md rounded-full text-slate-400 hover:text-rose-600 hover:bg-white shadow-sm transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Brand Pill */}
                    {product.brand && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-slate-900/80 text-white rounded-md backdrop-blur-sm">
                        {product.brand}
                      </span>
                    )}

                    {/* Stock status overlay */}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="px-4 py-1.5 bg-rose-600 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
                        <span>{product.category_name || 'Accessories'}</span>
                        {product.model && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{product.model}</span>
                          </>
                        )}
                      </div>

                      <Link
                        to={`/product/${product.slug || product.id}`}
                        className="font-bold text-slate-900 hover:text-primary transition-colors line-clamp-2 text-base leading-snug mb-3"
                      >
                        {product.title}
                      </Link>

                      {/* Pricing */}
                      <div className="flex items-baseline space-x-2 mb-4">
                        <span className="text-xl font-bold text-slate-900">
                          {storeConfig.currencySymbol}{displayPrice.toLocaleString('en-IN')}
                        </span>
                        {hasDiscount && (
                          <>
                            <span className="text-sm text-slate-400 line-through">
                              {storeConfig.currencySymbol}{product.original_price?.toLocaleString('en-IN')}
                            </span>
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                              Save {product.discount_percent || Math.round(((product.original_price! - displayPrice) / product.original_price!) * 100)}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => handleMoveToCart(product)}
                        disabled={isOutOfStock}
                        className={`w-full py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center space-x-2 transition-all ${
                          isOutOfStock
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-primary text-white hover:bg-primary-dark shadow-sm hover:shadow'
                        }`}
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>Move to Cart</span>
                      </button>

                      <div className="flex items-center justify-center space-x-1 text-[11px] text-slate-500">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{product.warranty || '1 Year Brand Warranty'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
