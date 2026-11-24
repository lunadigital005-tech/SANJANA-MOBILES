import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Star, Heart, ShieldCheck } from 'lucide-react';
import { Product } from '../../types';
import { formatPrice } from '../../config/store';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { Badge } from '../common/Badge';

export interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const isFavorited = isInWishlist(product.id);
  const currentPrice = product.sale_price !== null && product.sale_price !== undefined ? product.sale_price : product.price;
  const originalPrice = product.original_price || product.price;
  const hasSale = (product.sale_price !== null && product.sale_price !== undefined && product.sale_price < originalPrice) || (product.original_price && product.original_price > currentPrice);

  const discountPercent = product.discount_percent || (hasSale && originalPrice > 0
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : 0);

  const stock = product.available_stock !== undefined ? product.available_stock : product.stock_quantity;
  const isOutOfStock = stock <= 0 || product.is_out_of_stock;
  const isLowStock = stock > 0 && stock <= (product.low_stock_threshold || 5);

  const displayImage = product.primary_image || (product.images && product.images[0]) || 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=900';
  const productLink = `/product/${product.slug || product.id}`;

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  };

  return (
    <div className={`group relative flex flex-col bg-white rounded-2xl border transition-all duration-300 overflow-hidden shadow-card hover:shadow-card-hover ${
      isOutOfStock ? 'border-plum-200/60 opacity-90' : 'border-plum-100 hover:border-coral-200'
    }`}>
      {/* Product Image & Badges */}
      <Link to={productLink} className="relative block aspect-[4/5] overflow-hidden bg-slate-50">
        <img
          src={displayImage}
          alt={product.title}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
          loading="lazy"
        />

        {/* Badges Overlay (Top-Left) */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 pointer-events-none">
          {product.brand && (
            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-slate-900/85 text-white rounded-md backdrop-blur-sm shadow-sm w-fit">
              {product.brand}
            </span>
          )}
          {product.is_best_seller && (
            <Badge variant="coral">Best Seller</Badge>
          )}
          {(product.is_new_arrival || product.is_new) && (
            <Badge variant="mint">New Arrival</Badge>
          )}
          {discountPercent > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-extrabold bg-rose-600 text-white rounded-md shadow-sm w-fit">
              Save {discountPercent}%
            </span>
          )}
          {isOutOfStock ? (
            <Badge variant="danger">Sold Out</Badge>
          ) : isLowStock ? (
            <Badge variant="warning">Only {stock} Left</Badge>
          ) : null}
        </div>

        {/* Wishlist Heart Toggle (Top-Right) */}
        <button
          onClick={handleWishlistToggle}
          title={isFavorited ? 'Remove from Wishlist' : 'Save to Wishlist'}
          className={`absolute top-3 right-3 p-2 rounded-full z-20 backdrop-blur-md transition-all shadow-sm ${
            isFavorited
              ? 'bg-rose-50 text-rose-500 shadow-rose-200'
              : 'bg-white/80 text-slate-500 hover:text-rose-500 hover:bg-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorited ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>

        {/* Quick Add Overlay on hover (Desktop) */}
        {!isOutOfStock && (
          <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:block z-20">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addItem(product);
              }}
              className="w-full py-2.5 px-4 bg-slate-900/90 hover:bg-slate-900 backdrop-blur text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-coral-400" />
              Quick Add
            </button>
          </div>
        )}
      </Link>

      {/* Product Details */}
      <div className="flex flex-col flex-1 p-4 sm:p-5">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span className="uppercase tracking-wider font-semibold text-[11px] text-slate-500">
            {product.category_name || 'Accessories'}
          </span>
          <div className="flex items-center gap-1 text-slate-700">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-xs">{product.rating || 4.8}</span>
            <span className="text-slate-400 text-[11px]">({product.reviews_count || 12})</span>
          </div>
        </div>

        <Link to={productLink} className="group-hover:text-primary transition-colors">
          <h3 className="font-sans font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-1 mb-1">
            {product.title}
          </h3>
        </Link>

        {/* Subtitle / Key Spec Highlight */}
        {product.model ? (
          <p className="text-xs text-slate-500 font-mono mb-2">Model: {product.model}</p>
        ) : (
          <p className="text-xs text-slate-500 line-clamp-1 mb-2 leading-relaxed">
            {product.description}
          </p>
        )}

        {/* Pricing & Mobile Quick Action */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold font-display text-slate-900">
              {formatPrice(currentPrice)}
            </span>
            {hasSale && (
              <span className="text-xs text-slate-400 line-through">
                {formatPrice(originalPrice)}
              </span>
            )}
          </div>

          {!isOutOfStock ? (
            <button
              onClick={() => addItem(product)}
              className="sm:hidden p-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg active:scale-95 transition-all"
              aria-label="Add to Cart"
            >
              <ShoppingBag className="w-4 h-4" />
            </button>
          ) : (
            <span className="text-[10px] font-semibold uppercase text-rose-500 tracking-wider">
              Out of Stock
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
