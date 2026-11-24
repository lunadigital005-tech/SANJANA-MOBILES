import { storeConfig } from '../config/store';
import { 
  UserProfile, 
  Address, 
  CustomerRewards, 
  AdminStats,
  Order,
  Product,
  Category,
  InventoryItem,
  StockMovement,
  CartCalculationResult,
  CheckoutInitiateResponse,
  PaymentVerificationResponse,
  RefundRecord,
  RewardSettings,
  CustomerWallet,
  RewardsOverviewStats,
  ManualCoinAdjustmentRequest,
  DeliverySettings,
  DistanceCalculation,
  ShipmentRecord,
  WhatsAppMessage,
  Banner,
  SearchSuggestionsResponse,
  HomepageSectionsResponse,
  WishlistResponse,
  WishlistToggleResponse,
  PaymentSettings,
  StoreSettings,
  Invoice
} from '../types';

const BASE_URL = (storeConfig.apiBaseUrl || (import.meta.env.PROD ? "https://sanjana-mobiles.onrender.com/api/v1" : "http://localhost:8000/api/v1")).replace(/\/+$/, "");

export const api = {
  // ==========================================
  // CUSTOMER / PUBLIC ENDPOINTS
  // ==========================================

  async getProducts(params?: {
    category_slug?: string;
    search?: string;
    min_price?: number;
    max_price?: number;
    in_stock_only?: boolean;
    sort_by?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: Product[]; total: number; page: number; total_pages: number }> {
    const query = new URLSearchParams();
    if (params?.category_slug) query.set('category_slug', params.category_slug);
    if (params?.search) query.set('search', params.search);
    if (params?.min_price !== undefined) query.set('min_price', params.min_price.toString());
    if (params?.max_price !== undefined) query.set('max_price', params.max_price.toString());
    if (params?.in_stock_only) query.set('in_stock_only', 'true');
    if (params?.sort_by) query.set('sort_by', params.sort_by);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());

    const res = await fetch(`${BASE_URL}/products?${query.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch products from server');
    }
    return await res.json();
  },

  async getProduct(idOrSlug: string): Promise<Product> {
    const res = await fetch(`${BASE_URL}/products/${idOrSlug}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Product not found');
    }
    return await res.json();
  },

  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${BASE_URL}/categories`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch categories');
    }
    return await res.json();
  },

  async getCategory(idOrSlug: string): Promise<Category> {
    const res = await fetch(`${BASE_URL}/categories/${idOrSlug}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Category not found');
    }
    return await res.json();
  },

  async getSearchSuggestions(query: string, limit = 8): Promise<SearchSuggestionsResponse> {
    const res = await fetch(`${BASE_URL}/products/search/suggestions?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!res.ok) {
      return { query, products: [], categories: [], total_matches: 0 };
    }
    return await res.json();
  },

  async getHomepageSections(): Promise<HomepageSectionsResponse> {
    const res = await fetch(`${BASE_URL}/products/homepage/sections`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch homepage sections');
    }
    return await res.json();
  },

  async getBanners(): Promise<Banner[]> {
    const res = await fetch(`${BASE_URL}/banners`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch banners');
    }
    return await res.json();
  },

  async getWishlist(token: string): Promise<WishlistResponse> {
    const res = await fetch(`${BASE_URL}/customer/wishlist`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch wishlist');
    return await res.json();
  },

  async toggleWishlist(token: string, productId: string): Promise<WishlistToggleResponse> {
    const res = await fetch(`${BASE_URL}/customer/wishlist/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ product_id: productId })
    });
    if (!res.ok) throw new Error('Failed to update wishlist');
    return await res.json();
  },

  async reserveStock(productId: string, quantity: number, durationMinutes = 15) {
    const res = await fetch(`${BASE_URL}/products/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        quantity,
        duration_minutes: durationMinutes
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Insufficient stock for reservation.');
    }
    return await res.json();
  },

  // ==========================================
  // CUSTOMER ACCOUNT ENDPOINTS
  // ==========================================

  async getProfile(token: string): Promise<UserProfile> {
    const res = await fetch(`${BASE_URL}/customer/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch customer profile');
    }
    return await res.json();
  },

  async updateProfile(token: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const res = await fetch(`${BASE_URL}/customer/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return await res.json();
  },

  async getAddresses(token: string): Promise<Address[]> {
    try {
      const res = await fetch(`${BASE_URL}/customer/addresses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch addresses');
      const data = await res.json();
      if (Array.isArray(data)) {
        try {
          localStorage.setItem('sanjana_addresses_v1', JSON.stringify(data));
        } catch {}
        return data;
      }
      return [];
    } catch {
      // Local persistent fallback for offline / mock testing
      try {
        const local = localStorage.getItem('sanjana_addresses_v1');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}

      const defaultDemoAddress: Address = {
        id: 'addr-demo-01',
        user_id: 'cust-demo',
        full_name: 'Sanjana Patel',
        mobile_number: '9876543210',
        phone: '9876543210',
        address_line1: 'Flat 402, Lotus Residency, 100 Feet Road',
        address_line2: 'Indiranagar',
        city: 'Bengaluru',
        district: 'Bengaluru Urban',
        state: 'Karnataka',
        pin_code: '560038',
        postal_code: '560038',
        country: 'India',
        is_default: true,
        address_type: 'home'
      };
      return [defaultDemoAddress];
    }
  },

  async createAddress(token: string, address: Omit<Address, 'id' | 'user_id'>): Promise<Address> {
    try {
      const res = await fetch(`${BASE_URL}/customer/addresses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(address)
      });
      
      if (!res.ok) {
        let errorMsg = 'Unable to save address. Please try again.';
        try {
          const errorData = await res.json();
          if (errorData.detail) {
            if (typeof errorData.detail === 'string') {
              errorMsg = errorData.detail;
            } else if (Array.isArray(errorData.detail)) {
              errorMsg = errorData.detail.map((e: any) => e.msg || e.message).join('. ');
            }
          }
        } catch {}
        console.error('Create address error from server:', res.status, errorMsg);
        throw new Error(errorMsg);
      }
      const created = await res.json();
      
      // Update local storage cache
      try {
        const existing = await this.getAddresses(token).catch(() => []);
        const updated = [created, ...existing.filter((a) => a.id !== created.id)];
        if (created.is_default) {
          updated.forEach((a) => {
            if (a.id !== created.id) a.is_default = false;
          });
        }
        localStorage.setItem('sanjana_addresses_v1', JSON.stringify(updated));
      } catch {}

      return created;
    } catch (err: any) {
      // In offline or purely simulated local mode, generate and persist locally
      if (err.message && !err.message.includes('valid') && !err.message.includes('required')) {
        const fallbackId = `addr-${Date.now().toString(36)}`;
        const localAddr: Address = {
          ...address,
          id: fallbackId,
          user_id: 'cust-demo',
          country: address.country || 'India',
          is_default: address.is_default ?? true
        };
        try {
          const raw = localStorage.getItem('sanjana_addresses_v1');
          const list: Address[] = raw ? JSON.parse(raw) : [];
          if (localAddr.is_default) {
            list.forEach((a) => { a.is_default = false; });
          }
          list.unshift(localAddr);
          localStorage.setItem('sanjana_addresses_v1', JSON.stringify(list));
          return localAddr;
        } catch {}
      }
      throw err;
    }
  },

  async updateAddress(token: string, addressId: string, address: Partial<Omit<Address, 'id' | 'user_id'>>): Promise<Address> {
    try {
      const res = await fetch(`${BASE_URL}/customer/addresses/${addressId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(address)
      });
      if (!res.ok) {
        let errorMsg = 'Unable to update address. Please try again.';
        try {
          const errorData = await res.json();
          if (errorData.detail) {
            errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
          }
        } catch {}
        throw new Error(errorMsg);
      }
      const updated = await res.json();
      try {
        const raw = localStorage.getItem('sanjana_addresses_v1');
        if (raw) {
          const list: Address[] = JSON.parse(raw);
          const idx = list.findIndex((a) => a.id === addressId);
          if (idx !== -1) {
            if (updated.is_default) {
              list.forEach((a) => { a.is_default = false; });
            }
            list[idx] = updated;
            localStorage.setItem('sanjana_addresses_v1', JSON.stringify(list));
          }
        }
      } catch {}
      return updated;
    } catch (err: any) {
      try {
        const raw = localStorage.getItem('sanjana_addresses_v1');
        if (raw) {
          const list: Address[] = JSON.parse(raw);
          const idx = list.findIndex((a) => a.id === addressId);
          if (idx !== -1) {
            if (address.is_default) {
              list.forEach((a) => { a.is_default = false; });
            }
            list[idx] = { ...list[idx], ...address } as Address;
            localStorage.setItem('sanjana_addresses_v1', JSON.stringify(list));
            return list[idx];
          }
        }
      } catch {}
      throw err;
    }
  },

  async setDefaultAddress(token: string, addressId: string): Promise<Address> {
    try {
      const res = await fetch(`${BASE_URL}/customer/addresses/${addressId}/default`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to set default address');
      const updated = await res.json();
      try {
        const raw = localStorage.getItem('sanjana_addresses_v1');
        if (raw) {
          const list: Address[] = JSON.parse(raw);
          list.forEach((a) => { a.is_default = (a.id === addressId); });
          localStorage.setItem('sanjana_addresses_v1', JSON.stringify(list));
        }
      } catch {}
      return updated;
    } catch {
      return this.updateAddress(token, addressId, { is_default: true });
    }
  },

  async deleteAddress(token: string, addressId: string): Promise<void> {
    try {
      const res = await fetch(`${BASE_URL}/customer/addresses/${addressId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        let errorMsg = 'Failed to delete address';
        try {
          const errorData = await res.json();
          if (errorData.detail) errorMsg = errorData.detail;
        } catch {}
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      console.warn('Backend delete address failed, updating local state:', err.message);
    }
    try {
      const raw = localStorage.getItem('sanjana_addresses_v1');
      if (raw) {
        const list: Address[] = JSON.parse(raw);
        const filtered = list.filter((a) => a.id !== addressId);
        if (filtered.length > 0 && !filtered.some((a) => a.is_default)) {
          filtered[0].is_default = true;
        }
        localStorage.setItem('sanjana_addresses_v1', JSON.stringify(filtered));
      }
    } catch {}
  },

  async getRewards(token: string): Promise<CustomerRewards> {
    try {
      const res = await fetch(`${BASE_URL}/customer/rewards`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch rewards');
      return await res.json();
    } catch {
      return {
        points: 420,
        tier: 'Gold',
        lifetime_points: 750
      };
    }
  },

  async getCustomerOrders(token: string): Promise<Order[]> {
    const res = await fetch(`${BASE_URL}/customer/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch customer orders from server');
    }
    return await res.json();
  },

  // ==========================================
  // ADMIN OPERATIONS (PHASE 04 & 05)
  // ==========================================

  async getAdminStats(token: string): Promise<AdminStats> {
    const res = await fetch(`${BASE_URL}/admin/overview`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch admin stats');
    return await res.json();
  },

  // Admin Categories
  async adminGetCategories(token: string): Promise<Category[]> {
    const res = await fetch(`${BASE_URL}/admin/categories`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch categories');
    return await res.json();
  },

  async adminCreateCategory(token: string, data: Partial<Category>): Promise<Category> {
    const res = await fetch(`${BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create category');
    }
    return await res.json();
  },

  async adminUpdateCategory(token: string, id: string, data: Partial<Category>): Promise<Category> {
    const res = await fetch(`${BASE_URL}/admin/categories/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update category');
    }
    return await res.json();
  },

  async adminDeleteCategory(token: string, id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/admin/categories/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Cannot delete category');
    }
  },

  // Admin Products
  async adminGetProducts(token: string, params?: { search?: string; category_slug?: string; page?: number; limit?: number }) {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.category_slug) q.set('category_slug', params.category_slug);
    if (params?.page) q.set('page', params.page.toString());
    if (params?.limit) q.set('limit', params.limit.toString());

    const res = await fetch(`${BASE_URL}/admin/products?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch admin products');
    return await res.json();
  },

  async adminGetProduct(token: string, id: string): Promise<Product> {
    const res = await fetch(`${BASE_URL}/admin/products/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to get product details');
    return await res.json();
  },

  async adminCreateProduct(token: string, data: Partial<Product>): Promise<Product> {
    const res = await fetch(`${BASE_URL}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create product');
    }
    return await res.json();
  },

  async adminUpdateProduct(token: string, id: string, data: Partial<Product>): Promise<Product> {
    const res = await fetch(`${BASE_URL}/admin/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update product');
    }
    return await res.json();
  },

  async adminToggleProductStatus(token: string, id: string, isActive: boolean): Promise<Product> {
    const res = await fetch(`${BASE_URL}/admin/products/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ is_active: isActive })
    });
    if (!res.ok) throw new Error('Failed to update status');
    return await res.json();
  },

  async adminDeleteProduct(token: string, id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/admin/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to delete product');
  },

  // Image Upload (Supabase Storage)
  async adminUploadImage(token: string, file: File): Promise<{ url: string; storage_path: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${BASE_URL}/admin/upload-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to upload image');
    }
    return await res.json();
  },

  // Admin Inventory
  async adminGetInventory(token: string, statusFilter?: string, search?: string): Promise<InventoryItem[]> {
    const q = new URLSearchParams();
    if (statusFilter && statusFilter !== 'all') q.set('status_filter', statusFilter);
    if (search) q.set('search', search);

    const res = await fetch(`${BASE_URL}/admin/inventory?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch inventory');
    return await res.json();
  },

  async adminAdjustStock(token: string, data: {
    product_id: string;
    quantity_delta: number;
    movement_type: string;
    reason: string;
  }) {
    const res = await fetch(`${BASE_URL}/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to adjust stock');
    }
    return await res.json();
  },

  async adminGetStockMovements(token: string, productId?: string): Promise<StockMovement[]> {
    try {
      const q = productId ? `?product_id=${productId}` : '';
      const res = await fetch(`${BASE_URL}/admin/inventory/movements${q}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch stock movements');
      return await res.json();
    } catch {
      return [];
    }
  },

  async getAdminCustomers(token: string, search?: string): Promise<import('../types').AdminCustomerItem[]> {
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    const res = await fetch(`${BASE_URL}/admin/customers?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch customers');
    return await res.json();
  },

  async getAdminCustomerDetail(token: string, customerId: string): Promise<import('../types').AdminCustomerDetail> {
    const res = await fetch(`${BASE_URL}/admin/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch customer profile details');
    return await res.json();
  },

  // ==========================================
  // SHOPPING CART & PRICE CALCULATION (PHASE 06)
  // ==========================================

  async calculateCart(params: {
    items: { product_id: string; quantity: number }[];
    delivery_method?: 'HOME_DELIVERY' | 'STORE_PICKUP';
    promo_code?: string;
  }): Promise<CartCalculationResult> {
    const res = await fetch(`${BASE_URL}/cart/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: params.items,
        delivery_method: params.delivery_method || 'HOME_DELIVERY',
        promo_code: params.promo_code || null
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail?.message || err.detail || 'Failed to calculate cart');
    }
    return await res.json();
  },

  // Customer Address Management (handled above)
  async getCustomerOrderDetail(token: string, orderIdOrNumber: string): Promise<Order> {
    const res = await fetch(`${BASE_URL}/customer/orders/${orderIdOrNumber}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Order not found');
    return await res.json();
  },

  async getOrderInvoice(token: string, orderIdOrNumber: string): Promise<Invoice> {
    const res = await fetch(`${BASE_URL}/orders/${orderIdOrNumber}/invoice`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('Access denied. You do not have permission to view or print this invoice.');
      }
      if (res.status === 404) {
        throw new Error('Invoice or order not found.');
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to load order invoice');
    }
    return await res.json();
  },

  async getAdminOrderInvoice(token: string, orderIdOrNumber: string): Promise<Invoice> {
    const res = await fetch(`${BASE_URL}/admin/orders/${orderIdOrNumber}/invoice`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('Access denied. Admin authorization required.');
      }
      if (res.status === 404) {
        throw new Error('Invoice or order not found.');
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to load admin order invoice');
    }
    return await res.json();
  },

  // Checkout & Payment Integration
  async initiateCheckout(token: string, payload: {
    items: { product_id: string; quantity: number }[];
    delivery_method: 'HOME_DELIVERY' | 'STORE_PICKUP';
    payment_method?: string;
    address_id?: string;
    pickup_person_name?: string;
    pickup_person_phone?: string;
    promo_code?: string;
    coins_to_redeem?: number;
  }): Promise<CheckoutInitiateResponse> {
    const res = await fetch(`${BASE_URL}/checkout/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = typeof err.detail === 'object' ? err.detail.message || JSON.stringify(err.detail) : err.detail;
      throw new Error(msg || 'Failed to initiate checkout');
    }
    return await res.json();
  },

  async verifyPayment(token: string, payload: {
    order_id: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<PaymentVerificationResponse> {
    const res = await fetch(`${BASE_URL}/checkout/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Payment verification failed');
    }
    return await res.json();
  },

  // ==========================================
  // ADMIN ORDER MANAGEMENT & REFUNDS (PHASE 07)
  // ==========================================

  async getAdminOrdersSummary(token: string): Promise<{
    todays_orders: Order[];
    all_orders: Order[];
    todays_count: number;
    pending_action_count: number;
  }> {
    const res = await fetch(`${BASE_URL}/admin/orders/summary`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch orders summary');
    return await res.json();
  },

  async getAdminTodaysOrders(token: string): Promise<Order[]> {
    const res = await fetch(`${BASE_URL}/admin/orders/today`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch today orders');
    return await res.json();
  },

  async getAdminOrders(token: string, params?: { status?: string; search?: string }): Promise<Order[]> {
    try {
      const q = new URLSearchParams();
      if (params?.status && params.status !== 'ALL') q.set('status', params.status);
      if (params?.search) q.set('search', params.search);

      const res = await fetch(`${BASE_URL}/admin/orders?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch admin orders');
      return await res.json();
    } catch {
      return [];
    }
  },

  async getAdminOrderDetail(token: string, orderId: string): Promise<Order> {
    const res = await fetch(`${BASE_URL}/admin/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch order details');
    return await res.json();
  },

  async adminAcceptOrder(token: string, orderId: string): Promise<Order> {
    const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to accept order');
    }
    return await res.json();
  },

  async adminUpdateOrderStatus(token: string, orderId: string, newStatus: string, comment?: string): Promise<Order> {
    const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ new_status: newStatus, comment })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update order status');
    }
    return await res.json();
  },

  async adminRejectOrder(token: string, orderId: string, data: {
    rejection_reason: string;
    rejection_notes?: string;
    initiate_refund?: boolean;
  }): Promise<Order> {
    const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        rejection_reason: data.rejection_reason,
        rejection_notes: data.rejection_notes || null,
        initiate_refund: data.initiate_refund !== false
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to reject order');
    }
    return await res.json();
  },

  async adminCancelOrder(token: string, orderId: string, data: {
    cancellation_reason: string;
    cancellation_notes?: string;
  }): Promise<Order> {
    const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        cancellation_reason: data.cancellation_reason,
        cancellation_notes: data.cancellation_notes || null
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to cancel order');
    }
    return await res.json();
  },

  async confirmStorePickupPayment(token: string, orderId: string, adminNotes?: string): Promise<Order> {
    const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/confirm-store-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ order_id: orderId, admin_notes: adminNotes || null })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to confirm store payment');
    }
    return await res.json();
  },

  async markOrderCollected(token: string, orderId: string, adminNotes?: string): Promise<Order> {
    const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/mark-collected`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ order_id: orderId, admin_notes: adminNotes || null })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to mark order as collected');
    }
    return await res.json();
  },

  async assignAdminDelivery(token: string, orderId: string, adminNotes?: string): Promise<Order> {
    const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/assign-delivery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ order_id: orderId, admin_notes: adminNotes || null })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to assign admin delivery');
    }
    return await res.json();
  },

  async updateAdminDeliveryStatus(token: string, orderId: string, status: 'OUT_FOR_DELIVERY' | 'DELIVERED', adminNotes?: string): Promise<Order> {
    const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/delivery-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ order_id: orderId, status, admin_notes: adminNotes || null })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update admin delivery status');
    }
    return await res.json();
  },

  // Admin Refunds
  async adminGetRefunds(token: string): Promise<RefundRecord[]> {
    const res = await fetch(`${BASE_URL}/admin/refunds`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch refunds');
    return await res.json();
  },

  async adminInitiateRefund(token: string, data: {
    order_id: string;
    amount?: number;
    reason: string;
  }): Promise<RefundRecord> {
    const res = await fetch(`${BASE_URL}/admin/refunds/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to initiate refund');
    }
    return await res.json();
  },

  // Admin Notifications
  async adminGetNotifications(token: string, unreadOnly = false): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/admin/notifications?unread_only=${unreadOnly}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return [];
    return await res.json();
  },

  async adminMarkNotificationsRead(token: string): Promise<void> {
    await fetch(`${BASE_URL}/admin/notifications/mark-read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  // ==========================================
  // PHASE 08: LOYALTY COINS & REWARDS ENGINE
  // ==========================================

  async getMyWallet(token: string): Promise<CustomerWallet> {
    const res = await fetch(`${BASE_URL}/rewards/wallet`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch rewards wallet');
    }
    return await res.json();
  },

  async getPublicRewardSettings(): Promise<RewardSettings> {
    try {
      const res = await fetch(`${BASE_URL}/rewards/settings`);
      if (!res.ok) throw new Error('Failed to fetch public reward settings');
      return await res.json();
    } catch {
      return {
        is_active: true,
        min_purchase_amount: 100.0,
        earning_ratio: 0.01,
        coin_conversion_rate: 1.0,
        min_redemption_coins: 10,
        max_redemption_per_order: 500,
        allow_full_coin_payment: true,
        allow_mixed_payment: true,
        coin_expiry_days: 365
      };
    }
  },

  async adminGetRewardsOverview(token: string): Promise<RewardsOverviewStats> {
    const res = await fetch(`${BASE_URL}/rewards/admin/overview`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch rewards overview stats');
    return await res.json();
  },

  async adminGetRewardSettings(token: string): Promise<RewardSettings> {
    const res = await fetch(`${BASE_URL}/rewards/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch reward settings');
    return await res.json();
  },

  async adminUpdateRewardSettings(token: string, data: Partial<RewardSettings>): Promise<RewardSettings> {
    const res = await fetch(`${BASE_URL}/rewards/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update reward settings');
    }
    return await res.json();
  },

  async adminListCustomerWallets(token: string): Promise<CustomerWallet[]> {
    const res = await fetch(`${BASE_URL}/rewards/admin/wallets`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch customer wallets');
    return await res.json();
  },

  async adminGetCustomerWallet(token: string, userId: string): Promise<CustomerWallet> {
    const res = await fetch(`${BASE_URL}/rewards/admin/wallets/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch customer wallet');
    return await res.json();
  },

  async adminAdjustCoins(token: string, data: ManualCoinAdjustmentRequest): Promise<CustomerWallet> {
    const res = await fetch(`${BASE_URL}/rewards/admin/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to adjust customer coins');
    }
    return await res.json();
  },

  // ==========================================
  // PHASE 09: DELIVERY & SHIPMENT MANAGEMENT
  // ==========================================

  async adminGetDeliverySettings(token: string): Promise<DeliverySettings> {
    const res = await fetch(`${BASE_URL}/delivery/settings`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch delivery settings');
    return await res.json();
  },

  async adminComputeOrderDistance(token: string, orderId: string): Promise<DistanceCalculation> {
    const res = await fetch(`${BASE_URL}/delivery/orders/${orderId}/distance`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to compute distance');
    }
    return await res.json();
  },

  async adminSelectDeliveryMethod(token: string, orderId: string, data: {
    delivery_type: 'DIRECT_DELIVERY' | 'COURIER';
    assigned_to?: string;
    notes?: string;
  }): Promise<ShipmentRecord> {
    const res = await fetch(`${BASE_URL}/delivery/orders/${orderId}/select-method`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to select delivery method');
    }
    return await res.json();
  },

  async adminUpdateDirectDeliveryStatus(token: string, orderId: string, data: {
    status: string;
    delivery_proof_url?: string;
    customer_acknowledgement?: string;
    notes?: string;
  }): Promise<ShipmentRecord> {
    const res = await fetch(`${BASE_URL}/delivery/orders/${orderId}/direct-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update direct delivery status');
    }
    return await res.json();
  },

  async adminCreateCourierShipment(token: string, orderId: string, data: {
    courier_name: string;
    tracking_number: string;
    shipment_date?: string;
    tracking_url?: string;
    receipt_image_url?: string;
    receipt_storage_path?: string;
    shipment_notes?: string;
    estimated_delivery_date?: string;
  }): Promise<ShipmentRecord> {
    const res = await fetch(`${BASE_URL}/delivery/orders/${orderId}/courier-shipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create courier shipment');
    }
    return await res.json();
  },

  async adminUpdateCourierStatus(token: string, orderId: string, data: {
    status: string;
    location?: string;
    event_description?: string;
  }): Promise<ShipmentRecord> {
    const res = await fetch(`${BASE_URL}/delivery/orders/${orderId}/courier-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update courier tracking status');
    }
    return await res.json();
  },

  async adminUploadCourierReceipt(token: string, file: File): Promise<{
    receipt_image_url: string;
    receipt_storage_path: string;
    filename: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${BASE_URL}/delivery/upload-receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to upload courier receipt');
    }
    return await res.json();
  },

  async adminGetWhatsAppNotification(token: string, orderId: string, event?: string): Promise<WhatsAppMessage> {
    const q = event ? `?event=${encodeURIComponent(event)}` : '';
    const res = await fetch(`${BASE_URL}/delivery/orders/${orderId}/whatsapp${q}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to generate WhatsApp notification');
    return await res.json();
  },

  async getOrderTracking(token: string, orderId: string): Promise<ShipmentRecord> {
    const res = await fetch(`${BASE_URL}/delivery/orders/${orderId}/tracking`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch order tracking');
    return await res.json();
  },

  async adminGetBanners(token: string): Promise<Banner[]> {
    const res = await fetch(`${BASE_URL}/banners/all`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch all banners');
    return await res.json();
  },

  async adminCreateBanner(token: string, banner: Partial<Banner>): Promise<Banner> {
    const res = await fetch(`${BASE_URL}/banners`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(banner)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create banner');
    }
    return await res.json();
  },

  async adminUpdateBanner(token: string, id: string, banner: Partial<Banner>): Promise<Banner> {
    const res = await fetch(`${BASE_URL}/banners/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(banner)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update banner');
    }
    return await res.json();
  },

  async adminDeleteBanner(token: string, id: string): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/banners/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to delete banner');
    }
    return await res.json();
  },

  // UPI Payment & Verification
  async submitUpiPayment(
    token: string,
    data: { order_id: string; upi_utr: string; customer_notes?: string }
  ): Promise<{ success: boolean; message: string; payment_status: string; upi_utr: string }> {
    const res = await fetch(`${BASE_URL}/checkout/submit-upi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to submit UPI payment details');
    }
    return await res.json();
  },

  async getPaymentSettings(): Promise<{
    upi_id: string;
    merchant_name: string;
    qr_code_url: string;
    instructions: string;
    is_upi_enabled: boolean;
    manual_verification_required: boolean;
  }> {
    try {
      const res = await fetch(`${BASE_URL}/checkout/payment-settings`);
      if (!res.ok) throw new Error('Failed to fetch payment settings');
      return await res.json();
    } catch {
      return {
        upi_id: 'REPLACE_WITH_REAL_SHOP_UPI_ID',
        merchant_name: 'SANJANA MOBILES',
        qr_code_url: '',
        instructions: 'Scan the QR code using Google Pay, PhonePe, Paytm, or any UPI app. Complete the payment and enter the 12-digit UTR/UPI Reference Number below to verify your order.',
        is_upi_enabled: true,
        manual_verification_required: true
      };
    }
  },

  async adminVerifyPayment(
    token: string,
    data: { order_id: string; action: 'VERIFY' | 'REJECT'; admin_notes?: string }
  ): Promise<{
    success: boolean;
    order_id: string;
    payment_status: string;
    order_status: string;
    message: string;
  }> {
    const res = await fetch(`${BASE_URL}/admin/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to verify payment');
    }
    return await res.json();
  },

  async adminGetPaymentSettings(token: string): Promise<PaymentSettings> {
    const res = await fetch(`${BASE_URL}/admin/payment-settings`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch admin payment settings');
    return await res.json();
  },

  async adminUpdatePaymentSettings(
    token: string,
    settings: {
      upi_id: string;
      merchant_name: string;
      qr_code_url?: string;
      qr_code_image_url?: string;
      instructions?: string;
      payment_instructions?: string;
      is_upi_enabled?: boolean;
      manual_verification_required?: boolean;
    }
  ): Promise<any> {
    const res = await fetch(`${BASE_URL}/admin/payment-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(settings)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update payment settings');
    }
    return await res.json();
  },

  async adminGetStoreSettings(token: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/admin/settings/store`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch store settings');
    return await res.json();
  },

  async adminUpdateStoreSettings(token: string, settings: any): Promise<any> {
    const res = await fetch(`${BASE_URL}/admin/settings/store`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(settings)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update store settings');
    }
    return await res.json();
  },

  async adminUploadQrCode(token: string, file: File): Promise<{ url: string; qr_code_url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${BASE_URL}/admin/upload-qr`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 404) {
          throw new Error(`Upload endpoint not found (HTTP 404 at ${BASE_URL}/admin/upload-qr). Please verify backend server is running.`);
        }
        if (res.status === 401 || res.status === 403) {
          throw new Error('Administrative session unauthorized or expired. Please re-authenticate.');
        }
        if (res.status === 413) {
          throw new Error('Image file is too large (maximum 5MB allowed).');
        }
        throw new Error(err.detail || `Upload failed (HTTP ${res.status}): ${res.statusText}`);
      }
      return await res.json();
    } catch (networkErr: any) {
      if (networkErr.name === 'TypeError' && networkErr.message.includes('fetch')) {
        throw new Error(`Cannot connect to backend server at ${BASE_URL}. Ensure the FastAPI server is running on port 8000.`);
      }
      throw networkErr;
    }
  },

  async adminPasteQrCode(token: string, imageData: string, filename?: string): Promise<{ url: string; qr_code_url: string; filename: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/paste-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ image_data: imageData, filename })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 404) {
          throw new Error(`Paste endpoint not found (HTTP 404 at ${BASE_URL}/admin/paste-qr). Please verify backend server is running.`);
        }
        if (res.status === 401 || res.status === 403) {
          throw new Error('Administrative session unauthorized or expired. Please re-authenticate.');
        }
        throw new Error(err.detail || `Paste processing failed (HTTP ${res.status}): ${res.statusText}`);
      }
      return await res.json();
    } catch (networkErr: any) {
      if (networkErr.name === 'TypeError' && networkErr.message.includes('fetch')) {
        throw new Error(`Cannot connect to backend server at ${BASE_URL}. Ensure the FastAPI server is running on port 8000.`);
      }
      throw networkErr;
    }
  },

  async adminRemoveQrCode(token: string): Promise<any> {
    try {
      const res = await fetch(`${BASE_URL}/admin/settings/payment/qr`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 404) {
          throw new Error(`Remove QR endpoint not found (HTTP 404). Please verify backend server is running.`);
        }
        throw new Error(err.detail || `Failed to remove QR code (HTTP ${res.status}): ${res.statusText}`);
      }
      return await res.json();
    } catch (networkErr: any) {
      if (networkErr.name === 'TypeError' && networkErr.message.includes('fetch')) {
        throw new Error(`Cannot connect to backend server at ${BASE_URL}. Ensure the FastAPI server is running on port 8000.`);
      }
      throw networkErr;
    }
  },

  async getPublicSettings(): Promise<{ store: any; payment: any }> {
    const res = await fetch(`${BASE_URL}/settings/public`);
    if (!res.ok) throw new Error('Failed to fetch public store settings');
    return await res.json();
  }
};
