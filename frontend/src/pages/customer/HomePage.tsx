import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight, 
  ShieldCheck, 
  RotateCcw, 
  Truck, 
  MapPin, 
  Zap, 
  Smartphone, 
  Headphones, 
  Shield, 
  BatteryCharging, 
  HardDrive, 
  Watch, 
  Sparkles,
  Flame,
  Award,
  Layers
} from 'lucide-react';
import { storeConfig } from '../../config/store';
import { api } from '../../services/api';
import { Banner, Category, Product, HomepageSectionsResponse } from '../../types';
import { CategoryCard } from '../../components/product/CategoryCard';
import { ProductCard } from '../../components/product/ProductCard';
import { PromotionalAdvertisementCarousel } from '../../components/promotions/PromotionalAdvertisementCarousel';

export const HomePage: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sections, setSections] = useState<HomepageSectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Load banners, categories, and homepage section products
  useEffect(() => {
    let isCancelled = false;

    const loadHomeData = async () => {
      try {
        const [bannerList, catList, sectionData] = await Promise.all([
          api.getBanners().catch(() => []),
          api.getCategories().catch(() => []),
          api.getHomepageSections().catch(() => null)
        ]);

        if (!isCancelled) {
          setBanners(bannerList);
          setCategories(catList);
          setSections(sectionData);
        }
      } catch (err) {
        console.warn('Error loading homepage data:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadHomeData();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Auto advance banner carousel
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [banners.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % banners.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
  };

  // Category Icon Resolver
  const getCategoryIcon = (slug: string) => {
    switch (slug) {
      case 'smartphones':
        return <Smartphone className="w-6 h-6 text-primary" />;
      case 'charging-accessories':
        return <Zap className="w-6 h-6 text-amber-500" />;
      case 'audio-accessories':
        return <Headphones className="w-6 h-6 text-indigo-500" />;
      case 'mobile-protection':
        return <Shield className="w-6 h-6 text-emerald-500" />;
      case 'stands-holders':
        return <Layers className="w-6 h-6 text-sky-500" />;
      case 'power-accessories':
        return <BatteryCharging className="w-6 h-6 text-rose-500" />;
      case 'storage-accessories':
        return <HardDrive className="w-6 h-6 text-teal-500" />;
      case 'smart-gadgets':
        return <Watch className="w-6 h-6 text-purple-500" />;
      default:
        return <Sparkles className="w-6 h-6 text-coral-500" />;
    }
  };

  return (
    <div className="space-y-12 lg:space-y-16 pb-20">
      {/* =====================================================================
          SECTION 1: AUTOMATIC PROMOTIONAL ADVERTISEMENT SLIDER (AMAZON/MEESHO STYLE)
      ===================================================================== */}
      {banners.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <PromotionalAdvertisementCarousel advertisements={banners} intervalMs={5000} />
        </section>
      )}

      {/* =====================================================================
          SECTION 2: HERO BANNER CAROUSEL
      ===================================================================== */}
      <section className="relative overflow-hidden bg-slate-950 text-white min-h-[460px] lg:min-h-[540px] flex items-center">
        {banners.length === 0 ? (
          <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 space-y-6">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/20 border border-primary/40 text-primary-light text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>{storeConfig.officialName} • Official Store</span>
            </span>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-black tracking-tight text-white leading-tight">
              Genuine Smartphones & High-Speed Mobile Accessories
            </h1>
            <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-xl">
              {storeConfig.description}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                to="/products"
                className="px-8 py-3.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/30 transition-all transform hover:-translate-y-0.5"
              >
                <span>Browse Products</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          banners.map((banner, index) => (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              {/* Background image with overlay */}
              <div className="absolute inset-0">
                <img
                  src={banner.image_url}
                  alt={banner.title}
                  className="w-full h-full object-cover object-center scale-105 transform animate-fade-in"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-slate-950/40" />
              </div>

              {/* Banner text content */}
              <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
                <div className="max-w-2xl py-16 lg:py-24 space-y-6">
                  {banner.badge && (
                    <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/20 border border-primary/40 text-primary-light text-xs font-bold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span>{banner.badge}</span>
                    </span>
                  )}

                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-black tracking-tight text-white leading-tight">
                    {banner.title}
                  </h1>

                  {banner.subtitle && (
                    <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-xl">
                      {banner.subtitle}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 pt-4">
                    <Link
                      to={banner.cta_link || '/products'}
                      className="px-8 py-3.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/30 transition-all transform hover:-translate-y-0.5"
                    >
                      <span>{banner.cta_text || 'Shop Now'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    <Link
                      to="/products"
                      className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold backdrop-blur-sm border border-white/20 transition-all"
                    >
                      All Mobile Accessories
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Carousel Navigation Arrows */}
        {banners.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              aria-label="Previous slide"
              className="absolute left-4 z-30 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md border border-white/20 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextSlide}
              aria-label="Next slide"
              className="absolute right-4 z-30 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md border border-white/20 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Slide Indicator Dots */}
            <div className="absolute bottom-6 inset-x-0 z-30 flex items-center justify-center gap-2">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-2 transition-all rounded-full ${
                    i === currentSlide ? 'w-8 bg-primary' : 'w-2 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* =====================================================================
          SECTION 12: CUSTOMER VALUE PILLARS (Top Highlight)
      ===================================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all flex items-start gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-0.5">100% Genuine Products</h3>
              <p className="text-xs text-slate-500">Direct brand warranty & verified serial numbers</p>
            </div>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all flex items-start gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-0.5">7-Day Replacement</h3>
              <p className="text-xs text-slate-500">Hassle-free replacement for any defects</p>
            </div>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all flex items-start gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-0.5">Free Express Delivery</h3>
              <p className="text-xs text-slate-500">Free courier on orders over {storeConfig.currencySymbol}500</p>
            </div>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all flex items-start gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-0.5">Physical Store Pickup</h3>
              <p className="text-xs text-slate-500">Collect in 2 hours at Indiranagar, Bengaluru</p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: SHOP BY CATEGORIES (9 CORE CATEGORIES)
      ===================================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs uppercase tracking-widest font-extrabold text-primary block mb-1">
              Complete Mobile Ecosystem
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
              Shop by Category
            </h2>
          </div>
          <Link
            to="/products"
            className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-dark flex items-center gap-1 transition-colors"
          >
            <span>View All Products</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 9 Category Grid with custom icons & cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.slug}`}
              className="group bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-slate-50 group-hover:bg-primary/10 transition-colors">
                  {getCategoryIcon(cat.slug)}
                </div>
                <span className="text-[11px] font-bold text-slate-400 group-hover:text-primary transition-colors">
                  {cat.item_count} items
                </span>
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-primary transition-colors line-clamp-1">
                  {cat.name}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                  {cat.description || 'Genuine accessories'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* =====================================================================
          SECTION 9: BEST SELLERS SECTION
      ===================================================================== */}
      {sections?.best_sellers && sections.best_sellers.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="inline-flex items-center gap-1 text-xs uppercase tracking-widest font-extrabold text-rose-600 block mb-1">
                <Flame className="w-3.5 h-3.5" />
                <span>Trending Now</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
                Best Selling Mobiles & Gear
              </h2>
            </div>
            <Link
              to="/products?sort_by=popular"
              className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-dark flex items-center gap-1 transition-colors"
            >
              <span>See More</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {sections.best_sellers.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* =====================================================================
          SECTION 4: FEATURED MOBILE PHONES
      ===================================================================== */}
      {sections?.featured_mobiles && sections.featured_mobiles.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="text-xs uppercase tracking-widest font-extrabold text-primary block mb-1">
                Flagships & 5G Devices
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
                Featured Smartphones
              </h2>
            </div>
            <Link
              to="/category/smartphones"
              className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-dark flex items-center gap-1 transition-colors"
            >
              <span>View All Phones</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {sections.featured_mobiles.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* =====================================================================
          SECTION 11: SPECIAL OFFERS BANNER
      ===================================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-slate-900 via-primary to-slate-900 text-white p-8 sm:p-12 lg:p-16 shadow-xl">
          <div className="relative z-10 max-w-xl space-y-4">
            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-xs font-black uppercase tracking-wider text-white">
              Limited Festive Discount
            </span>
            <h2 className="text-3xl sm:text-4xl font-display font-black leading-tight">
              Get Instant 10% Off on Premium Mobile Accessories
            </h2>
            <p className="text-sm sm:text-base text-slate-200">
              Upgrade to high-power GaN fast chargers, ANC earbuds and rugged shockproof cases. Use official promo coupon at checkout:
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <span className="px-4 py-2.5 bg-white text-slate-950 font-mono font-black text-base rounded-xl tracking-wider select-all">
                SANJANA10
              </span>
              <Link
                to="/products"
                className="px-6 py-2.5 bg-slate-950 hover:bg-black text-white font-bold text-sm rounded-xl transition-all shadow-md"
              >
                Claim Discount
              </Link>
            </div>
          </div>
          {/* Subtle decoration */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/10 to-transparent pointer-events-none" />
        </div>
      </section>

      {/* =====================================================================
          SECTION 5: CHARGING ACCESSORIES
      ===================================================================== */}
      {sections?.charging_accessories && sections.charging_accessories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="text-xs uppercase tracking-widest font-extrabold text-amber-600 block mb-1">
                GaN Fast Chargers • PD Type-C • Wireless
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
                Charging & Power Accessories
              </h2>
            </div>
            <Link
              to="/category/charging-accessories"
              className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-dark flex items-center gap-1 transition-colors"
            >
              <span>View All Chargers</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {sections.charging_accessories.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* =====================================================================
          SECTION 6: AUDIO ACCESSORIES
      ===================================================================== */}
      {sections?.audio_accessories && sections.audio_accessories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="text-xs uppercase tracking-widest font-extrabold text-indigo-600 block mb-1">
                TWS Earbuds • ANC Neckbands • Studio Audio
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
                Premium Audio Gear
              </h2>
            </div>
            <Link
              to="/category/audio-accessories"
              className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-dark flex items-center gap-1 transition-colors"
            >
              <span>View All Audio</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {sections.audio_accessories.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* =====================================================================
          SECTION 7: MOBILE PROTECTION & CASES
      ===================================================================== */}
      {sections?.protection_cases && sections.protection_cases.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="text-xs uppercase tracking-widest font-extrabold text-emerald-600 block mb-1">
                Shockproof Cases • 9H Tempered Glass • Camera Rings
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
                Protection & Cases
              </h2>
            </div>
            <Link
              to="/category/mobile-protection"
              className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-dark flex items-center gap-1 transition-colors"
            >
              <span>View All Protection</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {sections.protection_cases.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* =====================================================================
          SECTION 8: SMART GADGETS & WEARABLES
      ===================================================================== */}
      {sections?.smart_gadgets && sections.smart_gadgets.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="text-xs uppercase tracking-widest font-extrabold text-purple-600 block mb-1">
                Smartwatches • Fitness Trackers • Bluetooth Finders
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
                Smart Gadgets & Wearables
              </h2>
            </div>
            <Link
              to="/category/smart-gadgets"
              className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-dark flex items-center gap-1 transition-colors"
            >
              <span>View All Gadgets</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {sections.smart_gadgets.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* =====================================================================
          SECTION 10: NEW ARRIVALS
      ===================================================================== */}
      {sections?.new_arrivals && sections.new_arrivals.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="text-xs uppercase tracking-widest font-extrabold text-teal-600 block mb-1">
                Fresh Drops
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
                New Arrivals
              </h2>
            </div>
            <Link
              to="/products?sort_by=newest"
              className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-dark flex items-center gap-1 transition-colors"
            >
              <span>View All New</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {sections.new_arrivals.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
