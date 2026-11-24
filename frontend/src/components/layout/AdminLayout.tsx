import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Layers, 
  Boxes, 
  ShoppingBag, 
  RotateCcw,
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  ArrowLeft,
  ShieldCheck,
  Bell,
  Truck,
  Coins,
  Megaphone
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { storeConfig } from '../../config/store';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const mainContentRef = useRef<HTMLElement>(null);

  const navItems = [
    { label: 'Overview', path: '/admin', icon: LayoutDashboard },
    { label: 'Advertisements', path: '/admin/advertisements', icon: Megaphone },
    { label: 'Products', path: '/admin/products', icon: Package },
    { label: 'Categories', path: '/admin/categories', icon: Layers },
    { label: 'Inventory', path: '/admin/inventory', icon: Boxes },
    { label: 'Orders', path: '/admin/orders', icon: ShoppingBag },
    { label: 'Deliveries & Shipments', path: '/admin/delivery', icon: Truck },
    { label: 'Loyalty Rewards', path: '/admin/rewards', icon: Coins },
    { label: 'Refunds', path: '/admin/refunds', icon: RotateCcw },
    { label: 'Customers', path: '/admin/customers', icon: Users },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  const currentDate = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    []
  );

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  // Reset scroll position on route navigation
  useEffect(() => {
    mainContentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  return (
    <div className="h-screen h-[100dvh] w-full bg-plum-950 text-ivory flex flex-col md:flex-row overflow-hidden">
      {/* Mobile Top Header (Fixed at top for mobile/tablet) */}
      <div className="md:hidden flex items-center justify-between p-4 bg-plum-900 border-b border-plum-800 flex-shrink-0 z-30">
        <div className="flex items-center gap-2.5">
          <img 
            src={storeConfig.logo.icon} 
            alt={storeConfig.name} 
            className="w-8 h-8 rounded-lg object-contain"
          />
          <span className="font-display font-extrabold text-lg text-white">
            {storeConfig.officialName} <span className="text-coral-400 font-sans text-[10px] tracking-wider uppercase font-bold ml-1">Admin</span>
          </span>
        </div>
        <button
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="p-2 text-plum-300 hover:text-white rounded-lg hover:bg-plum-800/60 transition-colors"
          aria-label="Toggle navigation menu"
        >
          {isMobileSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Fixed Admin Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 md:z-30 w-64 h-screen h-[100dvh] bg-plum-900/95 backdrop-blur-md border-r border-plum-800 flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out ${
          isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand in Sidebar (Fixed at top of sidebar) */}
        <div className="p-5 border-b border-plum-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <img 
              src={storeConfig.logo.icon} 
              alt={storeConfig.name} 
              className="w-10 h-10 rounded-xl object-contain shadow-md"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-extrabold text-base tracking-tight text-white leading-tight">
                  {storeConfig.officialName}
                </span>
              </div>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-coral-500/20 text-coral-400 border border-coral-500/30 text-[9px] font-bold tracking-widest uppercase">
                OPS PORTAL
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden text-plum-400 hover:text-white p-1 rounded-lg hover:bg-plum-800 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items (Scrolls independently only if viewport is very short) */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto min-h-0 admin-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileSidebarOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-coral-500 text-white font-semibold shadow-md'
                    : 'text-plum-300 hover:bg-plum-800 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-plum-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Card & Logout (Pinned to bottom with mt-auto flex-shrink-0) */}
        <div className="mt-auto p-4 border-t border-plum-800 bg-plum-950/60 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-coral-500/20 border border-coral-500/30 flex items-center justify-center text-coral-300 font-bold text-xs uppercase flex-shrink-0">
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user?.full_name || 'Admin User'}</p>
              <div className="flex items-center gap-1 text-[11px] text-coral-400">
                <ShieldCheck className="w-3 h-3 flex-shrink-0" />
                <span className="capitalize truncate">{user?.role || 'admin'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-plum-300 hover:text-white hover:bg-plum-800/60 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Back to Store</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors text-left w-full"
            >
              <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area (Offset by sidebar width on desktop, scrolls independently) */}
      <div className="flex-1 md:pl-64 flex flex-col h-full min-w-0 min-h-0 overflow-hidden">
        {/* Admin Top Header (Fixed at top of content area on desktop) */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-plum-900/60 border-b border-plum-800/80 backdrop-blur-sm flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-plum-400">Environment:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold tracking-wider uppercase">
              Live Architecture
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button 
              className="p-2 text-plum-400 hover:text-white relative rounded-lg hover:bg-plum-800/50 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-coral-500" />
            </button>
            <div className="h-4 w-px bg-plum-800" />
            <span className="text-xs text-plum-300 font-medium">
              {currentDate}
            </span>
          </div>
        </header>

        {/* Content Outlet (Only this container scrolls) */}
        <main 
          ref={mainContentRef}
          className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-h-0 admin-scrollbar focus:outline-none"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};
