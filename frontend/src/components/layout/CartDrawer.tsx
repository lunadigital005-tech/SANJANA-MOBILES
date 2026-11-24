import React from 'react';
import { X, Trash2, ArrowRight, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { storeConfig, formatPrice } from '../../config/store';
import { Button } from '../common/Button';

export const CartDrawer: React.FC = () => {
  const { isCartOpen, setIsCartOpen, items, removeItem, updateQuantity, subtotal, totalCount } = useCart();

  if (!isCartOpen) return null;

  const freeShippingLeft = Math.max(0, storeConfig.features.freeShippingThreshold - subtotal);
  const freeShippingProgress = Math.min(100, (subtotal / storeConfig.features.freeShippingThreshold) * 100);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-plum-950/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      {/* Slide-out Drawer */}
      <div className="relative w-full max-w-md bg-ivory h-full shadow-2xl flex flex-col z-10 animate-slide-left">
        {/* Drawer Header */}
        <div className="p-5 border-b border-plum-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-coral-500" />
            <h3 className="font-display font-bold text-lg text-plum-900">
              Shopping Bag ({totalCount})
            </h3>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="p-1.5 text-plum-400 hover:text-plum-900 rounded-lg hover:bg-plum-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Progress Bar */}
        <div className="px-5 py-3 bg-plum-50/70 border-b border-plum-100">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="font-medium text-plum-700">
              {freeShippingLeft === 0 ? (
                <span className="text-emerald-700 font-semibold">✨ You have unlocked complimentary express shipping!</span>
              ) : (
                <span>Add <strong>{formatPrice(freeShippingLeft)}</strong> more for free shipping</span>
              )}
            </span>
          </div>
          <div className="w-full bg-plum-200/60 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-coral-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${freeShippingProgress}%` }}
            />
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-full bg-plum-100 flex items-center justify-center text-plum-400 mb-4">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <p className="font-display font-semibold text-plum-900 text-lg">Your bag is empty</p>
              <p className="text-xs text-plum-400 mt-1 max-w-xs mb-6">
                Explore our curated catalog to bring architectural craftsmanship into your living space.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsCartOpen(false)}
              >
                Start Exploring
              </Button>
            </div>
          ) : (
            items.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="flex gap-4 p-3 bg-white rounded-xl border border-plum-100 shadow-sm"
              >
                <img
                  src={product.images[0]}
                  alt={product.title}
                  className="w-20 h-20 object-cover rounded-lg bg-ivory shrink-0"
                />
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <Link
                      to={`/product/${product.id}`}
                      onClick={() => setIsCartOpen(false)}
                      className="font-medium text-xs text-plum-900 hover:text-coral-600 line-clamp-1 transition-colors"
                    >
                      {product.title}
                    </Link>
                    <button
                      onClick={() => removeItem(product.id)}
                      className="text-plum-300 hover:text-rose-600 p-0.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="text-xs font-bold font-display text-plum-950">
                    {formatPrice(product.price)}
                  </span>

                  {/* Quantity selector */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center border border-plum-200 rounded-lg bg-ivory">
                      <button
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        className="px-2 py-0.5 text-xs text-plum-600 hover:bg-plum-100 rounded-l-lg transition-colors"
                      >
                        -
                      </button>
                      <span className="px-2 text-xs font-semibold text-plum-900">{quantity}</span>
                      <button
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        className="px-2 py-0.5 text-xs text-plum-600 hover:bg-plum-100 rounded-r-lg transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-[11px] text-plum-400">
                      Total: {formatPrice(product.price * quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        {items.length > 0 && (
          <div className="p-5 border-t border-plum-100 bg-white">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium text-plum-500">Subtotal</span>
              <span className="text-xl font-bold font-display text-plum-950">
                {formatPrice(subtotal)}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              <Link
                to="/cart"
                onClick={() => setIsCartOpen(false)}
                className="w-full py-3 bg-coral-500 hover:bg-coral-600 text-white rounded-xl text-center text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/products"
                onClick={() => setIsCartOpen(false)}
                className="w-full py-2.5 text-center text-xs font-medium text-plum-600 hover:text-plum-900 transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
