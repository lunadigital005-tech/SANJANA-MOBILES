import React, { useState, useEffect } from 'react';
import {
  Coins,
  Save,
  Users,
  TrendingUp,
  CreditCard,
  PlusCircle,
  Search,
  RefreshCw,
  Sliders,
  ShieldAlert,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  RewardSettings,
  CustomerWallet,
  RewardsOverviewStats
} from '../../types';
import { formatPrice } from '../../config/store';
import { Button } from '../../components/common/Button';

export const AdminRewardsPage: React.FC = () => {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [stats, setStats] = useState<RewardsOverviewStats | null>(null);
  const [settings, setSettings] = useState<RewardSettings | null>(null);
  const [wallets, setWallets] = useState<CustomerWallet[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Manual Adjustment Modal State
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<CustomerWallet | null>(null);
  const [adjustData, setAdjustData] = useState({
    user_id: '',
    coins_delta: 50,
    reason: ''
  });
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Inspection Ledger Modal State
  const [inspectWallet, setInspectWallet] = useState<CustomerWallet | null>(null);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [overviewData, settingsData, walletsData] = await Promise.all([
        api.adminGetRewardsOverview(token),
        api.adminGetRewardSettings(token),
        api.adminListCustomerWallets(token)
      ]);
      setStats(overviewData);
      setSettings(settingsData);
      setWallets(walletsData);
    } catch (err: any) {
      showToast(err.message || 'Failed to load rewards administration data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !settings) return;

    setIsSavingSettings(true);
    try {
      const updated = await api.adminUpdateRewardSettings(token, settings);
      setSettings(updated);
      showToast('Loyalty rewards configuration saved successfully', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update reward settings', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleOpenAdjust = (wallet?: CustomerWallet) => {
    if (wallet) {
      setSelectedWallet(wallet);
      setAdjustData({
        user_id: wallet.user_id,
        coins_delta: 50,
        reason: ''
      });
    } else {
      setSelectedWallet(null);
      setAdjustData({
        user_id: '',
        coins_delta: 50,
        reason: ''
      });
    }
    setShowAdjustModal(true);
  };

  const handleExecuteAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!adjustData.user_id.trim()) {
      showToast('Please specify a valid Customer ID', 'error');
      return;
    }
    if (adjustData.coins_delta === 0) {
      showToast('Adjustment coins cannot be zero', 'error');
      return;
    }
    if (!adjustData.reason.trim() || adjustData.reason.trim().length < 5) {
      showToast('Mandatory administrative justification (minimum 5 characters) is required', 'error');
      return;
    }

    setIsAdjusting(true);
    try {
      await api.adminAdjustCoins(token, {
        user_id: adjustData.user_id,
        coins_delta: Number(adjustData.coins_delta),
        reason: adjustData.reason.trim()
      });
      showToast(
        `Coins adjusted successfully for user ${adjustData.user_id} (${adjustData.coins_delta > 0 ? '+' : ''}${adjustData.coins_delta} coins)`,
        'success'
      );
      setShowAdjustModal(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to adjust customer coins', 'error');
    } finally {
      setIsAdjusting(false);
    }
  };

  const filteredWallets = wallets.filter((w) =>
    w.user_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-amber-400 block mb-1">
            Loyalty Rewards Administration
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-white">
            Loyalty Rewards & Coins Engine
          </h1>
          <p className="text-xs text-plum-300 mt-1">
            Configure automatic coin rewards per ₹100 purchase, redemption caps, conversion rates, and audit customer ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            className="border-plum-700 text-plum-200 hover:text-white hover:bg-plum-800"
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenAdjust()}
            leftIcon={<PlusCircle className="w-4 h-4 text-plum-950" />}
            className="bg-amber-400 hover:bg-amber-500 text-plum-950 font-bold border-amber-400"
          >
            Exceptional Adjustment
          </Button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-plum-900/60 rounded-2xl p-5 border border-plum-800/80 shadow-card space-y-1">
          <div className="flex items-center justify-between text-xs text-plum-300 font-semibold">
            <span>Total Coins Issued</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold font-display text-amber-400 font-mono">
            {stats?.total_coins_issued.toLocaleString() || 0}
          </p>
          <span className="text-[11px] text-plum-400 font-medium">Cumulative lifetime credit</span>
        </div>

        <div className="bg-plum-900/60 rounded-2xl p-5 border border-plum-800/80 shadow-card space-y-1">
          <div className="flex items-center justify-between text-xs text-plum-300 font-semibold">
            <span>Total Coins Redeemed</span>
            <TrendingUp className="w-4 h-4 text-coral-400" />
          </div>
          <p className="text-2xl font-bold font-display text-coral-400 font-mono">
            {stats?.total_coins_redeemed.toLocaleString() || 0}
          </p>
          <span className="text-[11px] text-plum-400 font-medium">Applied at checkout</span>
        </div>

        <div className="bg-plum-900/60 rounded-2xl p-5 border border-plum-800/80 shadow-card space-y-1">
          <div className="flex items-center justify-between text-xs text-plum-300 font-semibold">
            <span>Active Participants</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold font-display text-emerald-400 font-mono">
            {stats?.active_reward_customers || 0}
          </p>
          <span className="text-[11px] text-plum-400 font-medium">Customer wallets created</span>
        </div>

        <div className="bg-plum-900/60 rounded-2xl p-5 border border-plum-800/80 shadow-card space-y-1">
          <div className="flex items-center justify-between text-xs text-plum-300 font-semibold">
            <span>Circulating Liability</span>
            <CreditCard className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold font-display text-indigo-300 font-mono">
            {formatPrice(stats?.total_wallet_balance_value || 0)}
          </p>
          <span className="text-[11px] text-plum-400 font-medium">Outstanding wallet rupee value</span>
        </div>
      </div>

      {/* Main Two-Column Layout: Settings & Customer Wallets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Configurable Store Rules Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-plum-900/60 rounded-3xl border border-plum-800/80 p-6 shadow-card space-y-6">
            <div className="flex items-center justify-between border-b border-plum-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                <h3 className="font-display font-bold text-base text-white">
                  Loyalty Reward Policy
                </h3>
              </div>
              <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                settings?.is_active
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {settings?.is_active ? 'Active' : 'Disabled'}
              </span>
            </div>

            {settings && (
              <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                {/* System Active Toggle */}
                <div className="flex items-center justify-between p-3.5 bg-plum-950/70 rounded-2xl border border-plum-800">
                  <div>
                    <span className="font-bold text-white block">Rewards Engine Status</span>
                    <span className="text-[11px] text-plum-400">Allow customers to automatically earn & redeem coins</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.is_active}
                      onChange={(e) => setSettings({ ...settings, is_active: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-plum-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-plum-950 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-plum-900 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-400"></div>
                  </label>
                </div>

                {/* Reward per ₹100 Spent */}
                <div>
                  <label className="block font-bold text-amber-300 mb-1">
                    Reward Value per ₹100 Spent (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-amber-400">₹</span>
                    <input
                      type="number"
                      step="0.25"
                      min="0.0"
                      value={settings.reward_per_100 ?? (settings.earning_ratio ? settings.earning_ratio * 100 : 1.0)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0.0;
                        setSettings({
                          ...settings,
                          reward_per_100: val,
                          earning_ratio: val / 100.0
                        });
                      }}
                      className="w-full pl-8 pr-3 py-2 bg-plum-950/80 border border-plum-700/80 rounded-xl text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                    />
                  </div>
                  <span className="text-[11px] text-plum-400 mt-1 block">
                    Default: ₹1.00 reward per ₹100 purchase (1 coin credited automatically upon order completion).
                  </span>
                </div>

                {/* Monetary Conversion Rate */}
                <div>
                  <label className="block font-bold text-plum-200 mb-1">
                    Coin Redemption Value (₹ per 1 coin)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-plum-400">₹</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.01"
                      value={settings.coin_conversion_rate}
                      onChange={(e) => setSettings({ ...settings, coin_conversion_rate: parseFloat(e.target.value) || 1.0 })}
                      className="w-full pl-8 pr-3 py-2 bg-plum-950/80 border border-plum-700/80 rounded-xl text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                    />
                  </div>
                  <span className="text-[11px] text-plum-400 mt-1 block">
                    1 Coin provides ₹{settings.coin_conversion_rate.toFixed(2)} discount at checkout
                  </span>
                </div>

                {/* Min Purchase to Earn */}
                <div>
                  <label className="block font-bold text-plum-200 mb-1">
                    Minimum Purchase Amount to Earn (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.min_purchase_amount}
                    onChange={(e) => setSettings({ ...settings, min_purchase_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-plum-950/80 border border-plum-700/80 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                  />
                  <span className="text-[11px] text-plum-400 mt-1 block">
                    Orders below this threshold will not generate loyalty coins.
                  </span>
                </div>

                {/* Min & Max Redemption */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-plum-200 mb-1">
                      Min Redemption
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.min_redemption_coins}
                      onChange={(e) => setSettings({ ...settings, min_redemption_coins: parseInt(e.target.value) || 10 })}
                      className="w-full px-3 py-2 bg-plum-950/80 border border-plum-700/80 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                    />
                    <span className="text-[10px] text-plum-400 mt-0.5 block">Coins to redeem</span>
                  </div>
                  <div>
                    <label className="block font-bold text-plum-200 mb-1">
                      Max Per Order
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.max_redemption_per_order}
                      onChange={(e) => setSettings({ ...settings, max_redemption_per_order: parseInt(e.target.value) || 500 })}
                      className="w-full px-3 py-2 bg-plum-950/80 border border-plum-700/80 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                    />
                    <span className="text-[10px] text-plum-400 mt-0.5 block">Max cap / order</span>
                  </div>
                </div>

                {/* Toggles for Full / Mixed payment */}
                <div className="space-y-2.5 pt-3 border-t border-plum-800">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-medium text-plum-300">Allow 100% Full Coin Payment</span>
                    <input
                      type="checkbox"
                      checked={settings.allow_full_coin_payment}
                      onChange={(e) => setSettings({ ...settings, allow_full_coin_payment: e.target.checked })}
                      className="rounded bg-plum-950 border-plum-700 text-amber-400 focus:ring-amber-400"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-medium text-plum-300">Allow Mixed (Coins + Razorpay)</span>
                    <input
                      type="checkbox"
                      checked={settings.allow_mixed_payment}
                      onChange={(e) => setSettings({ ...settings, allow_mixed_payment: e.target.checked })}
                      className="rounded bg-plum-950 border-plum-700 text-amber-400 focus:ring-amber-400"
                    />
                  </label>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full mt-4 bg-amber-400 hover:bg-amber-500 text-plum-950 font-bold border-amber-400"
                  disabled={isSavingSettings}
                  leftIcon={<Save className="w-4 h-4 text-plum-950" />}
                >
                  {isSavingSettings ? 'Saving Configuration...' : 'Save Loyalty Policy'}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Customer Wallets Directory & Search */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-plum-900/60 rounded-3xl border border-plum-800/80 p-6 shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-plum-800 pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-white">
                  Customer Wallets Directory
                </h3>
                <p className="text-xs text-plum-400">
                  Inspect live customer balances and audit full transaction records.
                </p>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-plum-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter customer ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-plum-950/80 border border-plum-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
              </div>
            </div>

            {filteredWallets.length === 0 ? (
              <div className="text-center py-10 text-xs text-plum-400">
                No customer wallets matching search query.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-plum-800 text-plum-400 uppercase tracking-wider text-[10px]">
                      <th className="pb-2.5 font-semibold">Customer ID</th>
                      <th className="pb-2.5 font-semibold text-right">Available</th>
                      <th className="pb-2.5 font-semibold text-right">Value (₹)</th>
                      <th className="pb-2.5 font-semibold text-right">Earned</th>
                      <th className="pb-2.5 font-semibold text-right">Redeemed</th>
                      <th className="pb-2.5 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-plum-800/60">
                    {filteredWallets.map((w) => (
                      <tr key={w.user_id} className="hover:bg-plum-800/30 transition-colors">
                        <td className="py-3 font-mono font-bold text-white">
                          {w.user_id}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-amber-400">
                          {w.available_coins}
                        </td>
                        <td className="py-3 text-right font-mono text-plum-200">
                          {formatPrice(w.monetary_value)}
                        </td>
                        <td className="py-3 text-right font-mono text-emerald-400">
                          +{w.total_earned_coins}
                        </td>
                        <td className="py-3 text-right font-mono text-coral-400">
                          -{w.total_redeemed_coins}
                        </td>
                        <td className="py-3 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectWallet(w)}
                              className="px-2.5 py-1 bg-plum-800 hover:bg-plum-700 text-plum-200 hover:text-white rounded-lg text-[11px] font-semibold transition-colors border border-plum-700/60"
                            >
                              Ledger ({w.transactions.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenAdjust(w)}
                              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-lg text-[11px] font-semibold transition-colors border border-amber-500/20"
                            >
                              Adjust
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual Coin Adjustment Modal (Exceptional Tool) */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 bg-plum-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-plum-900 border border-plum-700 rounded-3xl max-w-md w-full p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-plum-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="font-display font-bold text-base text-white">
                  Audited Exceptional Coin Adjustment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="text-plum-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
              <p className="font-medium">
                Note: Coins are normally awarded automatically when customer orders are completed. This modal is strictly for exceptional manual customer adjustments and is logged in the permanent audit ledger.
              </p>
            </div>

            <form onSubmit={handleExecuteAdjustment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-plum-200 mb-1">Customer User ID *</label>
                <input
                  type="text"
                  value={adjustData.user_id}
                  onChange={(e) => setAdjustData({ ...adjustData, user_id: e.target.value })}
                  placeholder="e.g. customer-user-id-001"
                  required
                  className="w-full bg-plum-950/80 border border-plum-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
              </div>

              <div>
                <label className="block font-bold text-plum-200 mb-1">
                  Adjustment Amount (Coins Delta) *
                </label>
                <input
                  type="number"
                  value={adjustData.coins_delta}
                  onChange={(e) => setAdjustData({ ...adjustData, coins_delta: parseInt(e.target.value) || 0 })}
                  required
                  className="w-full bg-plum-950/80 border border-plum-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
                <span className="text-[11px] text-plum-400 mt-1 block">
                  Positive integer (e.g. +50) credits coins; negative integer (e.g. -20) debits coins.
                </span>
              </div>

              <div>
                <label className="block font-bold text-plum-200 mb-1">
                  Mandatory Administrative Justification *
                </label>
                <textarea
                  rows={3}
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  placeholder="Detailed justification for audit trail (e.g. customer compensation, promotional waiver, dispute settlement)..."
                  required
                  minLength={5}
                  className="w-full bg-plum-950/80 border border-plum-700 rounded-xl p-3 text-white placeholder-plum-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-plum-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdjustModal(false)}
                  className="border-plum-700 text-plum-300 hover:text-white hover:bg-plum-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isAdjusting}
                  className="bg-amber-400 hover:bg-amber-500 text-plum-950 font-bold border-amber-400"
                >
                  {isAdjusting ? 'Executing...' : 'Confirm Adjustment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspection Ledger Modal */}
      {inspectWallet && (
        <div className="fixed inset-0 z-50 bg-plum-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-plum-900 border border-plum-700 rounded-3xl max-w-2xl w-full p-6 shadow-2xl text-white space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-plum-800 pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-white">
                  Transaction Ledger: {inspectWallet.user_id}
                </h3>
                <span className="text-xs text-plum-300">
                  Current Balance: <strong className="text-amber-400">{inspectWallet.available_coins} coins</strong> ({formatPrice(inspectWallet.monetary_value)})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectWallet(null)}
                className="text-plum-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto pr-1 flex-1">
              {inspectWallet.transactions.length === 0 ? (
                <p className="text-center py-8 text-xs text-plum-400">No transaction records logged.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-plum-800 text-plum-400 uppercase text-[10px]">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2 text-right">Coins</th>
                      <th className="pb-2 text-right">Balance After</th>
                      <th className="pb-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-plum-800/60 font-mono">
                    {inspectWallet.transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-plum-800/30">
                        <td className="py-2.5 text-plum-400 text-[11px]">
                          {new Date(t.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            t.transaction_type.includes('CREDIT') || t.transaction_type.includes('RESTORE')
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : t.transaction_type.includes('REVERSAL')
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          }`}>
                            {t.transaction_type}
                          </span>
                        </td>
                        <td className={`py-2.5 text-right font-bold ${t.coins > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.coins > 0 ? `+${t.coins}` : t.coins}
                        </td>
                        <td className="py-2.5 text-right text-white">
                          {t.balance_after}
                        </td>
                        <td className="py-2.5 text-plum-300 font-sans text-[11px] max-w-xs truncate">
                          {t.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-3 border-t border-plum-800 text-right">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInspectWallet(null)}
                className="border-plum-700 text-plum-300 hover:text-white hover:bg-plum-800"
              >
                Close Ledger
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
