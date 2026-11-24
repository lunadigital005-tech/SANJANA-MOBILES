import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ShoppingBag, 
  Star, 
  ArrowLeft, 
  Truck, 
  ShieldCheck, 
  RotateCcw, 
  CheckCircle2,
  XCircle,
  Heart,
  Check,
  Zap,
  Cpu,
  Layers,
  MapPin,
  Clock
} from 'lucide-react';
import { api } from '../../services/api';
import { Product } from '../../types';
import { formatPrice, storeConfig } from '../../config/store';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';
import { ProductCard } from '../../components/product/ProductCard';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

export const ProductDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'specs' | 'compatibility' | 'warranty' | 'shipping'>('specs');

  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { showToast } = useToast();

  useEffect(() => {
    const fetchProductData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const prod = await api.getProduct(id);
        setProduct(prod);

        // Fetch related mobile products
        const catalog = await api.getProducts({ 
          category_slug: prod.category_slug, 
          limit: 5 
        });
        setRelatedProducts(catalog.items.filter((p) => p.id !== prod.id).slice(0, 4));
      } catch (err) {
        console.error('Failed to load product details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProductData();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-widest">
            Loading Mobile Specifications...
          </span>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold font-display text-slate-900 mb-2">Product Not Found</h2>
        <p className="text-sm text-slate-500 mb-6">The requested mobile phone or accessory is currently unavailable.</p>
        <Link to="/products">
          <Button variant="secondary">Browse All Mobile Products</Button>
        </Link>
      </div>
    );
  }

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

  const images = product.images && product.images.length > 0 ? product.images : [product.primary_image || 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=900'];

  const handleAddToCart = () => {
    addItem(product, quantity);
    showToast(`Added ${quantity} x ${product.title} to cart!`, 'success');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/products" className="hover:text-primary flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Mobile Store</span>
        </Link>
        <span>/</span>
        {product.category_slug && (
          <>
            <Link to={`/category/${product.category_slug}`} className="hover:text-primary transition-colors">
              {product.category_name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="font-semibold text-slate-900 truncate max-w-xs">{product.title}</span>
      </div>

      {/* Main Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
        {/* Images Gallery */}
        <div className="space-y-4">
          <div className="relative aspect-square sm:aspect-[4/3] lg:aspect-square rounded-3xl overflow-hidden bg-slate-50 border border-slate-200 shadow-md">
            <img
              src={images[activeImageIndex] || images[0]}
              alt={product.title}
              className="w-full h-full object-cover object-center"
            />
            {/* Badges Overlay */}
            <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10">
              {product.brand && (
                <span className="px-3 py-1 text-xs font-black uppercase tracking-wider bg-slate-900/90 text-white rounded-lg backdrop-blur-sm shadow">
                  {product.brand}
                </span>
              )}
              {product.is_best_seller && (
                <Badge variant="coral" size="md">Best Seller</Badge>
              )}
              {(product.is_new_arrival || product.is_new) && (
                <Badge variant="mint" size="md">New Arrival</Badge>
              )}
              {discountPercent > 0 && (
                <span className="px-2.5 py-1 text-xs font-extrabold bg-rose-600 text-white rounded-lg shadow">
                  Save {discountPercent}%
                </span>
              )}
            </div>

            {/* Wishlist Button */}
            <button
              onClick={() => toggleWishlist(product)}
              className={`absolute top-4 right-4 p-3 rounded-full backdrop-blur-md shadow-md transition-all ${
                isFavorited
                  ? 'bg-rose-50 text-rose-500 shadow-rose-200'
                  : 'bg-white/90 text-slate-600 hover:text-rose-500 hover:bg-white'
              }`}
              title={isFavorited ? 'Remove from wishlist' : 'Save to wishlist'}
            >
              <Heart className={`w-5 h-5 ${isFavorited ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative w-20 h-20 rounded-2xl overflow-hidden border-2 shrink-0 transition-all ${
                    activeImageIndex === idx ? 'border-primary shadow-md scale-95' : 'border-slate-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info & Actions */}
        <div className="flex flex-col justify-start space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                {product.category_name || 'Accessories'}
              </span>
              {product.model && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    Model: {product.model}
                  </span>
                </>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-extrabold text-slate-900 mb-3">
              {product.title}
            </h1>

            {/* Rating and Reviews */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < Math.floor(product.rating || 5) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-slate-800">{product.rating || 4.8} / 5.0</span>
              <span className="text-xs text-slate-400">({product.reviews_count || 24} customer ratings)</span>
            </div>
          </div>

          {/* Pricing & Stock Status */}
          <div className="flex items-baseline gap-3 pb-6 border-b border-slate-100 flex-wrap">
            <span className="text-3xl lg:text-4xl font-display font-black text-slate-900">
              {formatPrice(currentPrice)}
            </span>
            {hasSale && (
              <span className="text-base text-slate-400 line-through">
                {formatPrice(originalPrice)}
              </span>
            )}
            
            {/* Live Stock Indicators */}
            {isOutOfStock ? (
              <Badge variant="danger" size="md">
                Out of Stock
              </Badge>
            ) : isLowStock ? (
              <Badge variant="warning" size="md">
                Only {stock} Left in Stock
              </Badge>
            ) : (
              <Badge variant="success" size="md">
                In Stock • Ready to Ship
              </Badge>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-slate-600 leading-relaxed font-normal">
            {product.description}
          </p>

          {/* Key Compatibility Pill Highlights */}
          {product.compatibility && product.compatibility.length > 0 && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Verified Compatibility</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {product.compatibility.map((device, i) => (
                  <span key={i} className="text-xs font-medium bg-white text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                    {device}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Purchase Actions */}
          <div className="space-y-4 pt-2">
            {!isOutOfStock ? (
              <div className="flex items-center gap-4">
                {/* Quantity Selector */}
                <div className="flex items-center border border-slate-200 rounded-xl bg-white px-3 py-2 shadow-sm">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-2 text-sm font-bold text-slate-600 hover:text-slate-950"
                    disabled={quantity <= 1}
                  >
                    -
                  </button>
                  <span className="px-4 text-sm font-bold text-slate-900">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(stock, quantity + 1))}
                    className="px-2 text-sm font-bold text-slate-600 hover:text-slate-950"
                    disabled={quantity >= stock}
                  >
                    +
                  </button>
                </div>

                {/* Add to Cart Button */}
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1 shadow-md shadow-primary/20"
                  onClick={handleAddToCart}
                  leftIcon={<ShoppingBag className="w-5 h-5" />}
                >
                  Add to Shopping Cart
                </Button>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-800 text-xs">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>
                  This item is currently sold out. Restock shipment is in transit to Sanjana Mobiles.
                </span>
              </div>
            )}
          </div>

          {/* Sanjana Value Props */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary shrink-0" />
              <span>Express Delivery ({storeConfig.currencySymbol}500+ free)</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{product.warranty || '1 Year Official Warranty'}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Same-Day Store Pickup</span>
            </div>
          </div>

          {/* Tabs: Specs / Compatibility / Warranty / Shipping */}
          <div className="pt-6">
            <div className="flex border-b border-slate-200 gap-4 sm:gap-6 text-xs uppercase font-bold tracking-wider mb-4 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveTab('specs')}
                className={`pb-2.5 transition-colors whitespace-nowrap ${
                  activeTab === 'specs'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-slate-400 hover:text-slate-900'
                }`}
              >
                Specifications
              </button>
              <button
                onClick={() => setActiveTab('compatibility')}
                className={`pb-2.5 transition-colors whitespace-nowrap ${
                  activeTab === 'compatibility'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-slate-400 hover:text-slate-900'
                }`}
              >
                Compatibility
              </button>
              <button
                onClick={() => setActiveTab('warranty')}
                className={`pb-2.5 transition-colors whitespace-nowrap ${
                  activeTab === 'warranty'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-slate-400 hover:text-slate-900'
                }`}
              >
                Brand Warranty
              </button>
              <button
                onClick={() => setActiveTab('shipping')}
                className={`pb-2.5 transition-colors whitespace-nowrap ${
                  activeTab === 'shipping'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-slate-400 hover:text-slate-900'
                }`}
              >
                Shipping & Pickup
              </button>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed">
              {activeTab === 'specs' && (
                <div className="space-y-2">
                  {product.specifications && Object.keys(product.specifications).length > 0 ? (
                    <div className="divide-y divide-slate-100 bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
                      {Object.entries(product.specifications).map(([key, val]) => (
                        <div key={key} className="py-2 flex justify-between gap-4">
                          <span className="font-semibold text-slate-700">{key}</span>
                          <span className="text-slate-900 text-right font-medium">{val}</span>
                        </div>
                      ))}
                      <div className="py-2 flex justify-between gap-4">
                        <span className="font-semibold text-slate-700">SKU</span>
                        <code className="text-primary font-mono font-bold">{product.sku}</code>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p>SKU: <code className="bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-mono">{product.sku}</code></p>
                      <p>Brand: <strong className="text-slate-900">{product.brand || 'Sanjana Mobiles'}</strong></p>
                      {product.dimensions && <p>Dimensions: <strong className="text-slate-900">{product.dimensions}</strong></p>}
                      {product.materials && <p>Build Material: <strong className="text-slate-900">{product.materials}</strong></p>}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'compatibility' && (
                <div className="space-y-3">
                  <p className="text-slate-700">
                    Engineered and verified for complete electrical and dimensional compatibility across:
                  </p>
                  {product.compatibility && product.compatibility.length > 0 ? (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {product.compatibility.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-medium text-slate-800">{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500 italic">Universal compatibility with all standard smartphones and mobile devices.</p>
                  )}
                </div>
              )}

              {activeTab === 'warranty' && (
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <span>{product.warranty || '1 Year Official Brand Warranty'}</span>
                  </div>
                  <p className="text-emerald-800 text-xs">
                    Every product sold by <strong>SANJANA MOBILES</strong> is 100% genuine with verifiable serial numbers. In case of manufacturing defects, claim direct brand service or 7-day replacement at our store.
                  </p>
                </div>
              )}

              {activeTab === 'shipping' && (
                <div className="space-y-2">
                  <p>• <strong>Doorstep Courier:</strong> Dispatched via premium express logistics partners within 24 business hours.</p>
                  <p>• <strong>Complimentary Shipping:</strong> Free express delivery on orders totaling {storeConfig.currencySymbol}500 or more.</p>
                  <p>• <strong>Store Pickup:</strong> Ready for instant physical pickup at Sanjana Mobiles Store, Indiranagar, Bengaluru.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Products */}
      {relatedProducts.length > 0 && (
        <section className="pt-12 border-t border-slate-100">
          <div className="mb-8">
            <span className="text-xs uppercase tracking-widest font-bold text-primary block mb-1">
              Matching Gear
            </span>
            <h2 className="text-2xl font-display font-bold text-slate-900">
              Recommended Mobile Accessories
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
