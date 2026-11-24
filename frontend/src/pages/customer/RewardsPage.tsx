import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Coins,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  ShoppingBag,
  Info,
  Calendar,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { CustomerWallet, RewardSettings } from '../../types';
import { formatPrice } from '../../config/store';
import { Button } from '../../components/common/Button';

export const RewardsPage: React.FC = () => {
  const { token } = useAuth();
  const [wallet, setWallet] = useState<CustomerWallet | null>(null);
  const [settings, setSettings] = useState<RewardSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWallet = async () => {
    setLoading(true);
    const activeToken = token || 'mock-customer-token';
    try {
      const [walletData, settingsData] = await Promise.all([
        api.getMyWallet(activeToken),
        api.getPublicRewardSettings()
      ]);
      setWallet(walletData);
      setSettings(settingsData);
    } catch (err) {
      console.error('Failed to load rewards wallet:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [token]);

  const spendForOneCoin = settings?.earning_ratio ? Math.round(1 / settings.earning_ratio) : 100;
  const coinRupeeValue = settings?.coin_conversion_rate || 1.0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-coral-600 block mb-1">
            Loyalty & Member Sanctuary
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-plum-950">
            Sanjana Rewards Wallet
          </h1>
          <p className="text-xs sm:text-sm text-plum-500 mt-1">
            Earn coins automatically on every completed purchase. Redeem instantly at checkout for direct rupee discounts.
          </p>
        </div>
        <Link to="/products">
          <Button variant="primary" size="sm" rightIcon={<ShoppingBag className="w-4 h-4" />}>
            Redeem on Purchases
          </Button>
        </Link>
      </div>

      {/* Primary Wallet Hero Card */}
      <div className="bg-plum-900 rounded-3xl p-8 sm:p-10 text-ivory border border-plum-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-coral-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          {/* Main Coin Balance */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase tracking-widest font-bold text-coral-300">
                Available Coins Balance
              </span>
              <Sparkles className="w-3.5 h-3.5 text-coral-400" />
            </div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-4xl sm:text-5xl font-display font-extrabold text-white">
                {loading ? '...' : wallet?.available_coins || 0}
              </h2>
              <span className="text-sm font-semibold text-coral-300">Coins</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-xs text-mint-300 font-medium border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Direct Value: <strong>{formatPrice(wallet?.monetary_value || 0)}</strong>
            </div>
          </div>

          {/* Lifetime Earned vs Redeemed */}
          <div className="space-y-4 border-y md:border-y-0 md:border-x border-plum-800/80 py-4 md:py-0 md:px-8">
            <div className="flex items-center justify-between">
              <span className="text-xs text-plum-300">Total Coins Earned</span>
              <span className="text-sm font-bold text-white font-mono flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                {wallet?.total_earned_coins || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-plum-300">Total Coins Redeemed</span>
              <span className="text-sm font-bold text-white font-mono flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5 text-coral-400" />
                {wallet?.total_redeemed_coins || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-plum-300">Redemption Status</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${wallet?.can_redeem ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-plum-800 text-plum-300'}`}>
                {wallet?.can_redeem ? 'Eligible to Redeem' : `Min ${wallet?.min_redemption_coins || 10} coins`}
              </span>
            </div>
          </div>

          {/* Quick Rules Snapshot */}
          <div className="bg-plum-950/70 p-5 rounded-2xl border border-plum-800 space-y-2.5 text-xs">
            <div className="flex items-center gap-2 text-coral-300 font-bold">
              <Coins className="w-4 h-4 text-coral-400" />
              <span>Conversion Rules</span>
            </div>
            <p className="text-plum-300 leading-relaxed">
              • Spend <strong className="text-white">₹{spendForOneCoin}</strong> = Earn <strong className="text-coral-400">1 Coin</strong>
            </p>
            <p className="text-plum-300 leading-relaxed">
              • <strong className="text-coral-400">1 Coin</strong> = <strong className="text-white">₹{coinRupeeValue.toFixed(2)}</strong> direct order discount
            </p>
            <p className="text-plum-300 leading-relaxed">
              • Up to <strong className="text-white">{wallet?.max_redemption_coins || 500} coins</strong> allowed per order
            </p>
          </div>
        </div>
      </div>

      {/* Features & Trust Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-plum-100 p-6 shadow-card space-y-2">
          <div className="w-10 h-10 rounded-xl bg-coral-50 text-coral-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <h4 className="font-display font-bold text-base text-plum-950">
            Automatic Post-Delivery Credit
          </h4>
          <p className="text-xs text-plum-500 leading-relaxed">
            Coins are credited immediately upon verified order delivery. Failed payments or cancelled orders never award unearned coins.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-plum-100 p-6 shadow-card space-y-2">
          <div className="w-10 h-10 rounded-xl bg-mint-50 text-emerald-700 flex items-center justify-center">
            <Coins className="w-5 h-5" />
          </div>
          <h4 className="font-display font-bold text-base text-plum-950">
            Full or Mixed Payment
          </h4>
          <p className="text-xs text-plum-500 leading-relaxed">
            Use coins to cover 100% of eligible orders without touching a credit card, or combine coins with Razorpay for partial payment.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-plum-100 p-6 shadow-card space-y-2">
          <div className="w-10 h-10 rounded-xl bg-plum-50 text-plum-700 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="font-display font-bold text-base text-plum-950">
            Atomic Ledger & Privacy
          </h4>
          <p className="text-xs text-plum-500 leading-relaxed">
            Your rewards wallet is private and secured by strict database row-level security. Every credit and debit is permanently logged.
          </p>
        </div>
      </div>

      {/* Transaction History Ledger */}
      <div className="bg-white rounded-3xl border border-plum-100 p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex items-center justify-between border-b border-plum-100 pb-4">
          <div>
            <h3 className="font-display font-bold text-lg text-plum-950">
              Rewards Transaction Ledger
            </h3>
            <p className="text-xs text-plum-500">
              Immutable history of all coin accruals, redemptions, reversals, and restorations.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchWallet}
            className="inline-flex items-center gap-1.5 text-xs text-plum-600 hover:text-plum-950 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {(!wallet?.transactions || wallet.transactions.length === 0) ? (
          <div className="text-center py-12 space-y-3">
            <Coins className="w-10 h-10 text-plum-300 mx-auto" />
            <h5 className="font-bold text-sm text-plum-900">No Transactions Yet</h5>
            <p className="text-xs text-plum-500 max-w-sm mx-auto">
              Your coins ledger is empty. Complete your first order to begin accumulating Sanjana loyalty coins.
            </p>
            <Link to="/products">
              <Button size="sm" variant="outline" className="mt-2">
                Explore The Collection
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-plum-100 text-plum-400 uppercase tracking-wider text-[10px]">
                  <th className="pb-3 font-semibold">Date & Time</th>
                  <th className="pb-3 font-semibold">Activity</th>
                  <th className="pb-3 font-semibold">Reference</th>
                  <th className="pb-3 font-semibold text-right">Coins</th>
                  <th className="pb-3 font-semibold text-right">Value (₹)</th>
                  <th className="pb-3 font-semibold text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-plum-50">
                {wallet.transactions.map((tx) => {
                  const isCredit = tx.coins > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-ivory/40 transition-colors">
                      <td className="py-3.5 text-plum-600 font-mono">
                        {new Date(tx.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5">
                        <div className="space-y-0.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                              tx.transaction_type === 'CREDIT_EARNED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : tx.transaction_type === 'DEBIT_REDEEMED'
                                ? 'bg-plum-100 text-plum-900 border border-plum-200'
                                : tx.transaction_type === 'REVERSAL_REFUND'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : tx.transaction_type === 'RESTORE_FAILED_PAYMENT'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {tx.transaction_type.replace(/_/g, ' ')}
                          </span>
                          <p className="text-[11px] text-plum-600 line-clamp-1">{tx.reason}</p>
                        </div>
                      </td>
                      <td className="py-3.5 text-plum-700 font-mono">
                        {tx.order_number ? (
                          <Link
                            to={`/orders`}
                            className="font-bold text-coral-600 hover:text-coral-700 hover:underline"
                          >
                            {tx.order_number}
                          </Link>
                        ) : (
                          <span className="text-plum-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 text-right font-bold font-mono">
                        <span className={isCredit ? 'text-emerald-700' : 'text-plum-900'}>
                          {isCredit ? `+${tx.coins}` : tx.coins}
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-mono text-plum-600">
                        {formatPrice(tx.monetary_value)}
                      </td>
                      <td className="py-3.5 text-right font-bold font-mono text-plum-950">
                        {tx.balance_after}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
