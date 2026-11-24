import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  Award, 
  MapPin, 
  User, 
  ArrowRight, 
  ShieldCheck, 
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { isSupabaseConfigured } from '../../services/supabase';
import { Order, CustomerRewards } from '../../types';
import { formatPrice } from '../../config/store';
import { Badge } from '../../components/common/Badge';

export const DashboardPage: React.FC = () => {
  const { user, token, role } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [rewards, setRewards] = useState<CustomerRewards>({ points: 0, tier: 'Silver', lifetime_points: 0 });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setErrorMessage('Supabase project credentials are missing. Please verify your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env.');
        setLoading(false);
        return;
      }

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setErrorMessage(null);
        const [ordersData, rewardsData] = await Promise.all([
          api.getCustomerOrders(token),
          api.getRewards(token).catch(() => ({ points: 0, tier: 'Silver' as const, lifetime_points: 0 })),
        ]);
        setOrders(ordersData);
        setRewards(rewardsData);
      } catch (err: any) {
        console.error('Failed to load dashboard data:', err);
        setErrorMessage(err.message || 'Failed to fetch customer data from server');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Welcome Hero */}
      <div className="bg-plum-900 rounded-3xl p-6 sm:p-10 text-ivory border border-plum-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-coral-400 block mb-1">
            Client Sanctuary
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
            Welcome back, {user?.full_name || 'Customer'}
          </h1>
          <p className="text-xs sm:text-sm text-plum-300 mt-1 max-w-lg">
            Manage your bespoke commissions, address preferences, and loyalty sanctuary privileges.
          </p>
        </div>

        {role === 'admin' && (
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-coral-500 hover:bg-coral-600 text-white text-xs font-semibold uppercase tracking-wider transition-all shadow-md self-start md:self-auto"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Launch Admin Console</span>
          </Link>
        )}
      </div>

      {/* Configuration Error Banner */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3 text-red-300 text-xs">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-red-200 block text-sm">Database Configuration Error</span>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Link
          to="/orders"
          className="p-6 bg-white rounded-2xl border border-plum-100 shadow-card hover:shadow-card-hover transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-plum-400">Total Orders</span>
            <div className="w-10 h-10 rounded-xl bg-coral-50 text-coral-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-display font-bold text-plum-950 mb-1">
            {orders.length}
          </div>
          <div className="flex items-center gap-1 text-xs text-plum-500 group-hover:text-coral-600 font-medium transition-colors">
            <span>View order history</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          to="/rewards"
          className="p-6 bg-white rounded-2xl border border-plum-100 shadow-card hover:shadow-card-hover transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-plum-400">Loyalty Status</span>
            <div className="w-10 h-10 rounded-xl bg-mint-100 text-mint-800 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-display font-bold text-plum-950">{rewards.points}</span>
            <span className="text-xs font-semibold text-plum-500">Points</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="mint">{rewards.tier} Tier</Badge>
            <span className="text-plum-400">• Exclusive perks</span>
          </div>
        </Link>

        <Link
          to="/addresses"
          className="p-6 bg-white rounded-2xl border border-plum-100 shadow-card hover:shadow-card-hover transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-plum-400">Delivery Book</span>
            <div className="w-10 h-10 rounded-xl bg-plum-100 text-plum-700 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-display font-bold text-plum-950 mb-1">
            Addresses
          </div>
          <div className="flex items-center gap-1 text-xs text-plum-500 group-hover:text-coral-600 font-medium transition-colors">
            <span>Manage shipping destinations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </div>

      {/* Recent Orders Preview */}
      <div className="bg-white rounded-3xl border border-plum-100 p-6 sm:p-8 shadow-card">
        <div className="flex items-center justify-between pb-4 border-b border-plum-100 mb-6">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-coral-500" />
            <h3 className="font-display font-bold text-lg text-plum-950">Recent Orders</h3>
          </div>
          <Link
            to="/orders"
            className="text-xs font-semibold uppercase tracking-wider text-plum-600 hover:text-coral-600 transition-colors"
          >
            View All
          </Link>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-plum-400">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="py-8 text-center text-xs text-plum-400">No recent orders located.</div>
        ) : (
          <div className="space-y-4">
            {orders.slice(0, 3).map((order) => (
              <div
                key={order.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-ivory/60 border border-plum-100 gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-sm text-plum-900">
                      {order.order_number}
                    </span>
                    <Badge variant={order.status === 'delivered' ? 'success' : 'plum'}>
                      {order.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-plum-400 mt-0.5 block">
                    Placed on {new Date(order.created_at).toLocaleDateString()} • {order.items_count} items
                  </span>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <span className="font-display font-bold text-base text-plum-950">
                    {formatPrice(order.total_amount)}
                  </span>
                  <Link
                    to="/orders"
                    className="text-xs font-semibold text-coral-600 hover:text-coral-700"
                  >
                    Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
