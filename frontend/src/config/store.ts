/**
 * Central Store Configuration Module — SANJANA MOBILES
 * 
 * Update store identity, brand colors, contact info, logos, and features
 * centrally without editing individual components.
 */

export interface StoreLogoConfig {
  /** Full horizontal logo for light backgrounds */
  full: string;
  /** Full horizontal logo for dark backgrounds */
  dark: string;
  /** Standalone iconic brand mark (S-symbol) */
  icon: string;
  /** Transparent PNG full logo */
  pngFull: string;
  /** Transparent PNG icon */
  pngIcon: string;
}

export interface StoreConfig {
  /** Official registered shop name */
  officialName: string;
  /** Primary brand display name */
  name: string;
  /** Short logo identifier */
  shortName: string;
  /** Consumer-facing website name */
  websiteName: string;
  /** Browser title for storefront pages */
  browserTitle: string;
  /** Brand logo paths (SVGs and transparent PNGs) */
  logo: StoreLogoConfig;
  tagline: string;
  description: string;
  currency: {
    symbol: string;
    code: string;
    position: 'prefix' | 'suffix';
  };
  currencySymbol: string;
  contact: {
    email: string;
    phone: string;
    address: string;
    supportHours: string;
  };
  social: {
    instagram: string;
    twitter: string;
    facebook: string;
  };
  features: {
    freeShippingThreshold: number;
    rewardsProgram: boolean;
    reviewsEnabled: boolean;
    wishlistEnabled: boolean;
  };
  payment: {
    upiId: string;
    merchantName: string;
    isUpiEnabled: boolean;
    requireManualVerification: boolean;
    qrCodeImageUrl?: string;
    paymentInstructions: string;
  };
  apiBaseUrl: string;
}

export const storeConfig: StoreConfig = {
  officialName: "SANJANA MOBILES",
  name: "SANJANA MOBILES",
  shortName: "S",
  websiteName: "Sanjana Mobiles",
  browserTitle: "Sanjana Mobiles – Online Mobile Shopping",
  logo: {
    full: "/images/sanjana-mobiles-logo.svg",
    dark: "/images/sanjana-mobiles-logo-dark.svg",
    icon: "/images/sanjana-mobiles-icon.svg",
    pngFull: "/images/sanjana-mobiles-logo.png",
    pngIcon: "/images/sanjana-mobiles-icon.png",
  },
  tagline: "Premium Mobile Phones & Genuine Accessories",
  description: "South India's premier destination for genuine smartphones, cutting-edge mobile accessories, smart gadgets, and high-speed chargers.",
  currency: {
    symbol: "₹",
    code: "INR",
    position: "prefix",
  },
  currencySymbol: "₹",
  contact: {
    email: "support@sanjanamobiles.com",
    phone: "+91 98765 43210",
    address: "Sanjana Mobiles, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038",
    supportHours: "Mon - Sat, 9:30 AM - 9:00 PM IST",
  },
  social: {
    instagram: "https://instagram.com/sanjanamobiles",
    twitter: "https://twitter.com/sanjanamobiles",
    facebook: "https://facebook.com/sanjanamobiles",
  },
  features: {
    freeShippingThreshold: 500,
    rewardsProgram: true,
    reviewsEnabled: true,
    wishlistEnabled: true,
  },
  payment: {
    upiId: "REPLACE_WITH_REAL_SHOP_UPI_ID",
    merchantName: "SANJANA MOBILES",
    isUpiEnabled: true,
    requireManualVerification: true,
    qrCodeImageUrl: "",
    paymentInstructions: "1. Scan the QR code using Google Pay, PhonePe, Paytm, or any UPI app on your phone.\n2. Or tap 'Pay with UPI' on supported Android mobile devices.\n3. Complete the payment for the exact order amount.\n4. Enter the 12-digit UPI Transaction Reference Number (UTR) below and submit for verification.",
  },
  apiBaseUrl: (() => {
    const rawEnv = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim();
    if (rawEnv) {
      // In production builds, guard against accidental localhost URLs
      if (import.meta.env.PROD && (rawEnv.includes('localhost') || rawEnv.includes('127.0.0.1'))) {
        return 'https://sanjana-mobiles.onrender.com/api/v1';
      }
      const withoutSlash = rawEnv.replace(/\/+$/, '');
      return withoutSlash.endsWith('/api/v1') ? withoutSlash : `${withoutSlash}/api/v1`;
    }
    return import.meta.env.PROD
      ? 'https://sanjana-mobiles.onrender.com/api/v1'
      : 'http://localhost:8000/api/v1';
  })(),
};

/** Alias for backward compatibility */
export const STORE_CONFIG = storeConfig;

export const formatPrice = (amount: number): string => {
  const formatted = amount.toFixed(2);
  return storeConfig.currency.position === 'prefix'
    ? `${storeConfig.currency.symbol}${formatted}`
    : `${formatted} ${storeConfig.currency.symbol}`;
};
