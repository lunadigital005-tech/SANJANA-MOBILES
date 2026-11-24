import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Tag, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Clock 
} from 'lucide-react';
import { Advertisement } from '../../types';
import { formatPrice } from '../../config/store';

interface PromotionalCarouselProps {
  advertisements: Advertisement[];
  intervalMs?: number;
}

export const PromotionalAdvertisementCarousel: React.FC<PromotionalCarouselProps> = ({
  advertisements,
  intervalMs = 5000
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const count = advertisements.length;

  const nextSlide = useCallback(() => {
    if (count <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % count);
  }, [count]);

  const prevSlide = useCallback(() => {
    if (count <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + count) % count);
  }, [count]);

  const goToSlide = (idx: number) => {
    setCurrentIndex(idx);
  };

  // Automatic 5-second sliding with pause on hover
  useEffect(() => {
    if (count <= 1 || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      nextSlide();
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [count, isPaused, intervalMs, nextSlide]);

  // Handle Touch/Swipe Gestures for Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;
    const distance = touchStartX - touchEndX;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      // Swiped Left -> Next
      nextSlide();
    } else if (distance < -minSwipeDistance) {
      // Swiped Right -> Previous
      prevSlide();
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  // Behavior: If no advertisements, hide cleanly
  if (count === 0) {
    return null;
  }

  return (
    <div 
      className="relative w-full overflow-hidden bg-slate-900 rounded-2xl md:rounded-3xl shadow-xl border border-slate-800"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-label="Promotional Advertisements Carousel"
    >
      {/* Slides Container - Smooth horizontal slide */}
      <div 
        className="flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {advertisements.map((ad, idx) => {
          const discount = ad.discount_percent || (
            ad.original_price && ad.offer_price && ad.original_price > ad.offer_price
              ? Math.round(((ad.original_price - ad.offer_price) / ad.original_price) * 100)
              : null
          );

          return (
            <div
              key={ad.id || idx}
              className="w-full flex-shrink-0 min-h-[380px] sm:min-h-[420px] md:min-h-[460px] lg:min-h-[500px] flex items-center relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)'
              }}
            >
              {/* Background ambient glow */}
              <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-coral-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 md:px-12 py-8 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-center z-10">
                {/* Left Content Column (Promotional Details) */}
                <div className="md:col-span-7 space-y-3 sm:space-y-4 text-left">
                  {/* Badge & Headline */}
                  <div className="flex flex-wrap items-center gap-2">
                    {ad.badge && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-coral-500 text-white shadow-sm">
                        <Sparkles className="w-3.5 h-3.5" />
                        {ad.badge}
                      </span>
                    )}
                    {discount && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        <Tag className="w-3 h-3" />
                        {discount}% OFF
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest hidden sm:inline-flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-400" /> SANJANA MOBILES EXCLUSIVE
                    </span>
                  </div>

                  {/* Headline Banner */}
                  {ad.headline && (
                    <p className="text-xs sm:text-sm font-bold uppercase tracking-wide text-coral-400 font-sans">
                      {ad.headline}
                    </p>
                  )}

                  {/* Product Title */}
                  <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold font-display text-white tracking-tight leading-tight line-clamp-2">
                    {ad.title}
                  </h2>

                  {/* Short Promotional Description */}
                  {ad.description && (
                    <p className="text-xs sm:text-sm text-slate-300 max-w-xl line-clamp-2 sm:line-clamp-3 leading-relaxed">
                      {ad.description}
                    </p>
                  )}

                  {/* Price Banner (Amazon / Meesho style deal presentation) */}
                  <div className="pt-1 flex flex-wrap items-baseline gap-3">
                    {ad.offer_price != null && (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs sm:text-sm font-semibold text-slate-400">Special Price:</span>
                        <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold font-display text-emerald-400">
                          {formatPrice(ad.offer_price)}
                        </span>
                      </div>
                    )}
                    {ad.original_price != null && ad.original_price > (ad.offer_price || 0) && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm sm:text-base text-slate-400 line-through">
                          M.R.P: {formatPrice(ad.original_price)}
                        </span>
                        {discount && (
                          <span className="text-xs font-bold text-coral-400">
                            (Save {discount}%)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CTA Button */}
                  <div className="pt-2 sm:pt-4 flex items-center gap-3">
                    <Link
                      to={ad.cta_link || '/products'}
                      className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 rounded-xl bg-coral-500 hover:bg-coral-600 text-white font-bold text-sm shadow-lg shadow-coral-500/25 transition-all transform active:scale-95"
                    >
                      <span>{ad.cta_text || 'Shop Now'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <span className="text-[11px] text-slate-400 hidden sm:inline-flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 100% Genuine Mobile Tech
                    </span>
                  </div>
                </div>

                {/* Right Image Column (Large Product Image) */}
                <div className="md:col-span-5 flex items-center justify-center p-2 sm:p-4">
                  <div className="relative group w-full max-w-[320px] sm:max-w-[360px] md:max-w-[400px] aspect-square flex items-center justify-center">
                    {/* Soft glowing backdrop */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-coral-500/20 to-indigo-500/20 rounded-3xl blur-2xl transform group-hover:scale-105 transition-transform duration-500" />
                    <img
                      src={ad.image_url}
                      alt={ad.title}
                      className="relative w-full h-full object-contain drop-shadow-2xl rounded-2xl transform transition-transform duration-500 group-hover:scale-105"
                      loading={idx === 0 ? 'eager' : 'lazy'}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows (Only shown when > 1 ad) */}
      {count > 1 && (
        <>
          <button
            onClick={prevSlide}
            aria-label="Previous advertisement"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur-md border border-slate-700/80 shadow-lg transition-all opacity-80 hover:opacity-100 z-20"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextSlide}
            aria-label="Next advertisement"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur-md border border-slate-700/80 shadow-lg transition-all opacity-80 hover:opacity-100 z-20"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Small Pagination Dots (Only shown when > 1 ad) */}
      {count > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20 bg-slate-950/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800">
          {advertisements.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? 'w-6 bg-coral-500'
                  : 'w-2 bg-slate-600 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
