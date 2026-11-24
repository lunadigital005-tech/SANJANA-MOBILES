import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ShoppingBag, 
  Search, 
  User, 
  Menu, 
  X, 
  LogOut, 
  LayoutDashboard, 
  Package, 
  Award, 
  MapPin, 
  ShieldCheck,
  Heart
} from 'lucide-react';
import { storeConfig } from '../../config/store';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Category } from '../../types';

export interface HeaderProps {
  onOpenSearch: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch }) => {
  const { totalCount, setIsCartOpen } = useCart();
  const { totalItems: wishlistCount } = useWishlist();
  const { user, role, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const location = useLocation();

  useEffect(() => {
    let active = true;
    api.getCategories()
      .then((data) => {
        if (active && data && data.length > 0) {
          setCategories(data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const navLinks = [
    { label: 'All Mobiles', href: '/products' },
    { label: 'Collections', href: '/products' },
    { label: 'Rewards Sanctuary', href: '/rewards' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-ivory/90 backdrop-blur-md border-b border-plum-100/80 transition-all">
      {/* Top Announcement Bar */}
      <div className="bg-plum-950 text-ivory text-[11px] font-medium tracking-wider uppercase py-1.5 px-4 text-center">
        <span>Complimentary express delivery on orders over {storeConfig.currency.symbol}{storeConfig.features.freeShippingThreshold} • Genuine Mobile Warranty</span>
      </div>

      {/* Main Header Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Mobile menu trigger */}
          <div className="flex items-center lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 -ml-2 text-plum-800 hover:text-plum-950"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Brand Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img 
                src={storeConfig.logo.full} 
                alt={storeConfig.name} 
                className="h-10 sm:h-12 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8">
            <Link
              to="/products"
              className={`text-xs font-semibold uppercase tracking-widest transition-colors hover:text-coral-500 ${
                location.pathname === '/products' ? 'text-coral-600' : 'text-plum-800'
              }`}
            >
              Smartphones & Accessories
            </Link>

            {/* Collections Dropdown */}
            <div className="relative group">
              <Link 
                to="/products"
                className="text-xs font-semibold uppercase tracking-widest text-plum-800 group-hover:text-coral-500 transition-colors py-2 flex items-center gap-1"
              >
                Collections
              </Link>
              <div className="absolute top-full left-0 w-72 pt-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200">
                <div className="bg-white rounded-2xl shadow-xl border border-plum-100 p-2 space-y-0.5 max-h-96 overflow-y-auto">
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/category/${cat.slug}`}
                      className="block px-3 py-2 text-xs font-medium text-plum-700 hover:text-coral-600 hover:bg-plum-50 rounded-lg transition-colors"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <Link
              to="/rewards"
              className="text-xs font-semibold uppercase tracking-widest text-plum-800 hover:text-coral-500 transition-colors"
            >
              Rewards
            </Link>
          </nav>

          {/* Action Icons: Search, Account, Cart */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Search Button */}
            <button
              onClick={onOpenSearch}
              className="p-2 text-plum-700 hover:text-plum-950 hover:bg-plum-100/60 rounded-xl transition-colors"
              aria-label="Search products"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* User Account Menu */}
            <div className="relative">
              {user ? (
                <div>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 p-1.5 pl-2 pr-3 rounded-full bg-white border border-plum-200 hover:border-plum-300 transition-all text-xs font-medium text-plum-800 shadow-sm"
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.full_name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-plum-900 text-ivory text-[10px] font-bold flex items-center justify-center uppercase">
                        {user.full_name.charAt(0)}
                      </div>
                    )}
                    <span className="hidden sm:inline max-w-[100px] truncate">{user.full_name}</span>
                  </button>

                  {/* Dropdown Menu */}
                  {isUserMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-plum-100 py-2 z-40 animate-fade-in">
                        <div className="px-4 py-2 border-b border-plum-100">
                          <p className="text-xs font-bold text-plum-900 truncate">{user.full_name}</p>
                          <p className="text-[11px] text-plum-400 truncate">{user.email}</p>
                          <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-coral-50 text-coral-600 font-semibold uppercase tracking-wider">
                            {user.role}
                          </span>
                        </div>

                        <div className="py-1">
                          <Link
                            to="/dashboard"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-plum-700 hover:bg-plum-50 hover:text-plum-950 transition-colors"
                          >
                            <LayoutDashboard className="w-4 h-4 text-plum-400" />
                            Dashboard
                          </Link>
                          <Link
                            to="/orders"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-plum-700 hover:bg-plum-50 hover:text-plum-950 transition-colors"
                          >
                            <Package className="w-4 h-4 text-plum-400" />
                            My Orders
                          </Link>
                          <Link
                            to="/rewards"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-plum-700 hover:bg-plum-50 hover:text-plum-950 transition-colors"
                          >
                            <Award className="w-4 h-4 text-plum-400" />
                            My Rewards
                          </Link>
                          <Link
                            to="/addresses"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-plum-700 hover:bg-plum-50 hover:text-plum-950 transition-colors"
                          >
                            <MapPin className="w-4 h-4 text-plum-400" />
                            Addresses
                          </Link>

                          {role === 'admin' && (
                            <Link
                              to="/admin"
                              onClick={() => setIsUserMenuOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-coral-600 bg-coral-50/70 hover:bg-coral-100/60 transition-colors"
                            >
                              <ShieldCheck className="w-4 h-4 text-coral-500" />
                              Admin Console
                            </Link>
                          )}
                        </div>

                        <div className="border-t border-plum-100 pt-1 mt-1">
                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              logout();
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors text-left"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 p-2 text-plum-700 hover:text-plum-950 rounded-xl hover:bg-plum-100/60 text-xs font-semibold uppercase tracking-wider transition-colors"
                  aria-label="Account sign in"
                >
                  <User className="w-5 h-5" />
                  <span className="hidden sm:inline">Sign In</span>
                </Link>
              )}
            </div>

            {/* Wishlist Link */}
            <Link
              to="/wishlist"
              className="relative p-2 text-plum-700 hover:text-plum-950 hover:bg-plum-100/60 rounded-xl transition-colors"
              aria-label="View Wishlist"
            >
              <Heart className="w-5 h-5 text-plum-700 hover:text-rose-600 transition-colors" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Shopping Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 bg-plum-900 text-ivory rounded-xl hover:bg-plum-800 transition-all shadow-sm flex items-center justify-center active:scale-95"
              aria-label="View Shopping Bag"
            >
              <ShoppingBag className="w-4 h-4 text-coral-300" />
              {totalCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-coral-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-md animate-scale-in">
                  {totalCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-plum-100 bg-ivory px-4 pt-3 pb-6 space-y-3">
          <div className="space-y-1">
            <Link
              to="/products"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-semibold text-plum-900 hover:bg-plum-100 rounded-lg"
            >
              All Mobiles & Accessories
            </Link>
            <div className="pl-3 py-1 space-y-1 max-h-60 overflow-y-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-plum-400">Collections</span>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/category/${cat.slug}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-1.5 text-xs text-plum-700 hover:text-coral-600 rounded-lg"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
            <Link
              to="/wishlist"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-plum-900 hover:bg-plum-100 rounded-lg"
            >
              <span>Saved Wishlist</span>
              {wishlistCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold bg-rose-500 text-white rounded-full">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <Link
              to="/rewards"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-semibold text-plum-900 hover:bg-plum-100 rounded-lg"
            >
              Rewards Program
            </Link>
            {role === 'admin' && (
              <Link
                to="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 text-sm font-bold text-coral-600 bg-coral-50 rounded-lg"
              >
                Admin Console
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
