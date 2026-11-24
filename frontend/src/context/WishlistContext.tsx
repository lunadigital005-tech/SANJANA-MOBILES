import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface WishlistContextType {
  wishlistIds: string[];
  wishlistItems: Product[];
  totalItems: number;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (product: Product) => Promise<boolean>;
  removeFromWishlist: (productId: string) => Promise<void>;
  clearWishlist: () => void;
  isLoading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'sanjana_wishlist_v1';

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(wishlistItems));
    } catch (e) {
      console.warn('Failed to save wishlist to local storage', e);
    }
  }, [wishlistItems]);

  // Load backend wishlist if user is authenticated
  useEffect(() => {
    if (!token || !user) return;
    let isCancelled = false;

    const loadServerWishlist = async () => {
      try {
        setIsLoading(true);
        const data = await api.getWishlist(token);
        if (!isCancelled && data.items) {
          setWishlistItems(data.items);
        }
      } catch (err) {
        console.warn('Could not sync wishlist with server, using local cache', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadServerWishlist();
    return () => {
      isCancelled = true;
    };
  }, [token, user]);

  const wishlistIds = wishlistItems.map((p) => p.id);

  const isInWishlist = useCallback(
    (productId: string) => wishlistItems.some((p) => p.id === productId),
    [wishlistItems]
  );

  const toggleWishlist = useCallback(
    async (product: Product): Promise<boolean> => {
      const exists = wishlistItems.some((p) => p.id === product.id);
      let nextState: Product[];

      if (exists) {
        nextState = wishlistItems.filter((p) => p.id !== product.id);
      } else {
        nextState = [product, ...wishlistItems];
      }
      setWishlistItems(nextState);

      if (token && user) {
        try {
          await api.toggleWishlist(token, product.id);
        } catch (e) {
          console.warn('Server wishlist update failed', e);
        }
      }
      return !exists;
    },
    [wishlistItems, token, user]
  );

  const removeFromWishlist = useCallback(
    async (productId: string) => {
      setWishlistItems((prev) => prev.filter((p) => p.id !== productId));
      if (token && user) {
        try {
          await api.toggleWishlist(token, productId);
        } catch (e) {
          console.warn('Failed to remove from server wishlist', e);
        }
      }
    },
    [token, user]
  );

  const clearWishlist = useCallback(() => {
    setWishlistItems([]);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }, []);

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        wishlistItems,
        totalItems: wishlistItems.length,
        isInWishlist,
        toggleWishlist,
        removeFromWishlist,
        clearWishlist,
        isLoading
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
