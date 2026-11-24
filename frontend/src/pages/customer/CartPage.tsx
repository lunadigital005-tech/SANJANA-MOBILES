import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ArrowRight, ShieldCheck, Tag, ShoppingBag } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { formatPrice, storeConfig } from '../../config/store';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';

export const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, clearCart, subtotal, totalCount } = useCart();
  const [promoCode, setPromoCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const { showToast } = useToast();

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;

    if (promoCode.toUpperCase() === 'SANJANA10' || promoCode.toUpperCase() === 'LUNA10' || promoCode.toUpperCase() === 'WELCOME') {
      setDiscountPercent(10);
      showToast('10% Sanjana Mobiles discount applied to your order!', 'success');
    } else {
      showToast('Invalid promotional voucher code.', 'error');
    }
  };

  const discountAmount = (subtotal * discountPercent) / 100;
  const isFreeShipping = subtotal >= storeConfig.features.freeShippingThreshold;
  const shippingAmount = isFreeShipping || items.length === 0 ? 0 : 99;
  const finalTotal = Math.max(0, subtotal - discountAmount + shippingAmount);

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20">
        <EmptyState
          icon={<ShoppingBag className="w-8 h-8 text-coral-500" />}
          title="Your Shopping Bag is Currently Empty"
          description="You have not selected any architectural pieces yet. Explore our curated catalog to discover bespoke items for your sanctuary."
          actionLabel="Explore All Pieces"
          onAction={() => window.location.assign('/products')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="border-b border-plum-100 pb-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-coral-600 block mb-1">
            Order Review
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-plum-950">
            Shopping Bag ({totalCount} items)
          </h1>
        </div>
        <button
          onClick={clearCart}
          className="text-xs font-semibold text-plum-400 hover:text-rose-600 transition-colors self-start sm:self-auto"
        >
          Clear All Items
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(({ product, quantity }) => (
            <div
              key={product.id}
              className="flex flex-col sm:flex-row gap-4 p-4 sm:p-5 bg-white rounded-2xl border border-plum-100 shadow-card"
            >
              <Link to={`/product/${product.id}`} className="shrink-0 aspect-[4/5] sm:aspect-square w-full sm:w-28 rounded-xl overflow-hidden bg-ivory">
                <img
                  src={product.images[0]}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              </Link>

              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-plum-400">
                        {product.category_name}
                      </span>
                      <Link
                        to={`/product/${product.id}`}
                        className="block font-display font-bold text-plum-900 text-base hover:text-coral-600 transition-colors"
                      >
                        {product.title}
                      </Link>
                      <p className="text-xs text-plum-400 mt-0.5">SKU: {product.sku}</p>
                    </div>

                    <button
                      onClick={() => removeItem(product.id)}
                      className="text-plum-300 hover:text-rose-600 p-1 transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-plum-50">
                  {/* Quantity selector */}
                  <div className="flex items-center border border-plum-200 rounded-xl bg-ivory px-2 py-1">
                    <button
                      onClick={() => updateQuantity(product.id, quantity - 1)}
                      className="px-2 py-0.5 text-xs text-plum-600 hover:text-plum-950 font-bold"
                    >
                      -
                    </button>
                    <span className="px-3 text-xs font-bold text-plum-900">{quantity}</span>
                    <button
                      onClick={() => updateQuantity(product.id, quantity + 1)}
                      className="px-2 py-0.5 text-xs text-plum-600 hover:text-plum-950 font-bold"
                    >
                      +
                    </button>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <span className="text-base font-bold font-display text-plum-950">
                      {formatPrice(product.price * quantity)}
                    </span>
                    {quantity > 1 && (
                      <span className="block text-[11px] text-plum-400">
                        ({formatPrice(product.price)} each)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Complimentary Perks Reminder */}
          <div className="p-4 bg-mint-50/70 border border-mint-200 rounded-2xl flex items-center gap-3 text-xs text-mint-900">
            <ShieldCheck className="w-5 h-5 text-mint-600 shrink-0" />
            <span>
              All purchases include white-glove carbon offset delivery and 30-day effortless return guarantee.
            </span>
          </div>
        </div>

        {/* Order Summary Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl border border-plum-100 p-6 shadow-card sticky top-28 space-y-6">
            <h3 className="font-display font-bold text-lg text-plum-900 border-b border-plum-100 pb-3">
              Order Summary
            </h3>

            {/* Voucher Code Form */}
            <form onSubmit={handleApplyPromo} className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 text-plum-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Promo Code (e.g. SANJANA10)"
                  className="w-full text-xs bg-ivory/60 border border-plum-200 rounded-xl py-2 pl-9 pr-3 text-plum-900 focus:outline-none focus:ring-2 focus:ring-plum-200 uppercase"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-2 bg-plum-900 hover:bg-plum-800 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Apply
              </button>
            </form>

            {/* Breakdown */}
            <div className="space-y-2.5 text-xs text-plum-600 border-b border-plum-100 pb-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-plum-900">{formatPrice(subtotal)}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-coral-600 font-medium">
                  <span>Atelier Promo ({discountPercent}%)</span>
                  <span>-{formatPrice(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Estimated Shipping</span>
                <span className="font-semibold text-plum-900">
                  {isFreeShipping ? (
                    <span className="text-emerald-700">Free</span>
                  ) : (
                    formatPrice(shippingAmount)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>GST & Duties</span>
                <span className="font-semibold text-emerald-700">Included in Price</span>
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-baseline pt-1">
              <div>
                <span className="text-sm font-bold text-plum-900 block">Total Due</span>
                <span className="text-[11px] text-plum-400">Includes taxes & duties</span>
              </div>
              <span className="text-2xl font-extrabold font-display text-plum-950">
                {formatPrice(finalTotal)}
              </span>
            </div>

            {/* Checkout CTA */}
            <Button
              variant="primary"
              size="lg"
              className="w-full shadow-md shadow-coral-500/25"
              onClick={() => navigate('/checkout')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Proceed to Checkout
            </Button>

            <div className="text-center">
              <Link
                to="/products"
                className="text-xs font-semibold text-plum-500 hover:text-plum-900 transition-colors"
              >
                ← Continue Browsing Creations
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
