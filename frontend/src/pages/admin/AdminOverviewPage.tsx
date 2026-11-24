import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  ShoppingBag, 
  Users, 
  AlertTriangle, 
  Clock, 
  ArrowRight,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { AdminStats } from '../../types';
import { formatPrice } from '../../config/store';

export const AdminOverviewPage: React.FC = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    total_products: 0,
    total_orders: 0,
    total_customers: 0,
    low_stock: 0,
    pending_orders: 0,
    low_stock_items: [],
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminData = async () => {
      if (!token) return;
      try {
        const [statsData, ordersData] = await Promise.all([
          api.getAdminStats(token),
          api.getAdminOrders(token),
        ]);
        setStats(statsData);
        setRecentOrders(ordersData);
      } catch (err) {
        console.error('Failed to load admin overview data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminData();
  }, [token]);

  const statCards = [
    {
      title: 'Total Orders',
      value: stats.total_orders.toLocaleString(),
      subtext: `${stats.pending_orders} pending fulfillment`,
      icon: ShoppingBag,
      color: 'text-coral-400',
      bg: 'bg-coral-500/10 border-coral-500/20',
      link: '/admin/orders',
    },
    {
      title: 'Total Customers',
      value: stats.total_customers.toLocaleString(),
      subtext: 'Registered store accounts',
      icon: Users,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      link: '/admin/customers',
    },
    {
      title: 'Total Products',
      value: stats.total_products.toString(),
      subtext: 'Active store catalog items',
      icon: Package,
      color: 'text-plum-300',
      bg: 'bg-plum-800/80 border-plum-700',
      link: '/admin/products',
    },
    {
      title: 'Low Stock Alerts',
      value: stats.low_stock.toString(),
      subtext: stats.low_stock > 0 ? 'Requires immediate restock' : 'Inventory well-stocked',
      icon: AlertTriangle,
      color: stats.low_stock > 0 ? 'text-amber-400' : 'text-emerald-400',
      bg: stats.low_stock > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20',
      link: '/admin/inventory',
    },
    {
      title: 'Pending Orders',
      value: stats.pending_orders.toString(),
      subtext: 'Awaiting action / dispatch',
      icon: Clock,
      color: stats.pending_orders > 0 ? 'text-indigo-400' : 'text-plum-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      link: '/admin/orders',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <span className="text-xs uppercase tracking-widest font-bold text-coral-400 block mb-1">
          Store Operations Telemetry
        </span>
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
          Operations Overview
        </h1>
        <p className="text-xs text-plum-300 mt-1">
          Live real-time store metrics, inventory alerts, and order fulfillment tracking.
        </p>
      </div>

      {/* 5 Real-Time Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              to={card.link}
              className="bg-plum-900/60 border border-plum-800/80 rounded-2xl p-5 shadow-card backdrop-blur-sm relative overflow-hidden group hover:border-plum-700 hover:scale-[1.01] transition-all block"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-plum-300">
                  {card.title}
                </span>
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${card.bg} ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-display font-black text-white mb-1">
                {loading ? '...' : card.value}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-plum-400 font-medium">{card.subtext}</span>
                <ArrowRight className="w-3.5 h-3.5 text-plum-500 group-hover:text-coral-400 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Low Stock Alerts Section */}
      <div className="bg-plum-900/60 border border-plum-800/80 rounded-3xl p-6 sm:p-8 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-plum-800 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-white">Low Stock Alerts</h2>
              <p className="text-xs text-plum-400">Products requiring restock or attention (threshold ≤ 5)</p>
            </div>
          </div>
          <Link
            to="/admin/inventory"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline"
          >
            Manage All Inventory <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {stats.low_stock_items && stats.low_stock_items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-plum-800 text-plum-400 uppercase font-semibold tracking-wider text-[11px]">
                  <th className="pb-3 px-3">Product</th>
                  <th className="pb-3 px-3">SKU</th>
                  <th className="pb-3 px-3">Price</th>
                  <th className="pb-3 px-3 text-center">Available Stock</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-plum-800/60">
                {stats.low_stock_items.map((item) => (
                  <tr key={item.id} className="hover:bg-plum-800/30 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-10 h-10 rounded-lg object-cover bg-plum-950 border border-plum-800"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-plum-950 border border-plum-800 flex items-center justify-center text-plum-500">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-white">{item.title}</p>
                          {item.category && (
                            <p className="text-[11px] text-plum-400">{item.category}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-plum-300">
                      {item.sku || 'N/A'}
                    </td>
                    <td className="py-3 px-3 font-medium text-white font-mono">
                      {formatPrice(item.price)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block font-mono font-bold text-sm ${
                        item.stock === 0 ? 'text-rose-400' : 'text-amber-400'
                      }`}>
                        {item.stock}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        item.status === 'OUT OF STOCK'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        to="/admin/inventory"
                        className="inline-flex items-center gap-1 px-3 py-1 bg-plum-800/80 hover:bg-plum-700 text-plum-200 hover:text-white rounded-lg text-[11px] font-semibold transition-colors border border-plum-700/60"
                      >
                        Restock
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300 text-xs">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            <p className="font-medium">All products are sufficiently stocked. No low inventory alerts at this time.</p>
          </div>
        )}
      </div>

      {/* Recent Orders Overview Table */}
      <div className="bg-plum-900/60 border border-plum-800/80 rounded-3xl p-6 sm:p-8 shadow-card">
        <div className="flex items-center justify-between pb-4 border-b border-plum-800 mb-6">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-coral-400" />
            <h2 className="font-display font-bold text-lg text-white">Recent Customer Orders</h2>
          </div>
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-1 text-xs font-bold text-coral-400 hover:text-coral-300 hover:underline"
          >
            View All Orders <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-plum-800 text-plum-400 uppercase font-semibold tracking-wider">
                <th className="pb-3 px-3">Order Number</th>
                <th className="pb-3 px-3">Customer</th>
                <th className="pb-3 px-3">Items</th>
                <th className="pb-3 px-3">Total Amount</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3">Payment</th>
                <th className="pb-3 px-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-plum-800/60">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-plum-400">
                    No orders placed yet.
                  </td>
                </tr>
              ) : (
                recentOrders.slice(0, 8).map((ord) => (
                  <tr key={ord.id} className="hover:bg-plum-800/30 transition-colors">
                    <td className="py-3.5 px-3 font-semibold text-white font-mono">
                      {ord.order_number}
                    </td>
                    <td className="py-3.5 px-3">
                      <p className="font-medium text-white">{ord.customer_name || 'Customer'}</p>
                      <p className="text-[11px] text-plum-400">{ord.customer_email || ord.customer_mobile || ''}</p>
                    </td>
                    <td className="py-3.5 px-3 text-plum-300 font-mono">
                      {ord.items_count || (ord.items ? ord.items.length : 1)} pcs
                    </td>
                    <td className="py-3.5 px-3 font-display font-bold text-white">
                      {formatPrice(ord.total_amount)}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        ord.status === 'DELIVERED' || ord.status === 'COLLECTED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        ord.status === 'OUT_FOR_DELIVERY' || ord.status === 'READY_FOR_DELIVERY' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                        ord.status === 'PACKING' || ord.status === 'PACKED' || ord.status === 'ACCEPTED' ? 'bg-coral-500/10 text-coral-400 border border-coral-500/20' :
                        ord.status === 'CANCELLED' || ord.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`text-[11px] font-medium uppercase font-mono ${
                        ord.payment_status === 'PAID' || ord.payment_status === 'VERIFIED'
                          ? 'text-emerald-400'
                          : ord.payment_status === 'FAILED'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}>
                        {ord.payment_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right text-plum-400 font-mono">
                      {ord.created_at ? new Date(ord.created_at).toLocaleDateString() : 'Recent'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
