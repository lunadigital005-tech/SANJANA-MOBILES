import React, { useEffect, useState } from 'react';
import { 
  Boxes, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Search, 
  SlidersHorizontal, 
  History, 
  Plus, 
  Minus,
  ArrowRight,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { InventoryItem, StockMovement } from '../../types';
import { formatPrice, storeConfig } from '../../config/store';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../context/ToastContext';

export const AdminInventoryPage: React.FC = () => {
  const { token } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  
  // Manual Adjustment Modal state
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null);
  const [adjustmentDelta, setAdjustmentDelta] = useState<string>('5');
  const [adjustmentType, setAdjustmentType] = useState<string>('restock');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('Workshop restock batch');
  const [saving, setSaving] = useState(false);

  const { showToast } = useToast();

  const fetchInventoryData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [invData, movData] = await Promise.all([
        api.adminGetInventory(token, statusFilter, search),
        api.adminGetStockMovements(token)
      ]);
      setInventory(invData);
      setMovements(movData);
    } catch (err: any) {
      showToast(err.message || 'Failed to load inventory data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, [token, statusFilter]);

  const handleOpenAdjust = (item: InventoryItem) => {
    setAdjustTarget(item);
    setAdjustmentDelta('5');
    setAdjustmentType('restock');
    setAdjustmentReason('Workshop batch receipt');
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget || !token) return;

    const delta = parseInt(adjustmentDelta, 10);
    if (isNaN(delta) || delta === 0) {
      showToast('Quantity delta must be a non-zero integer.', 'error');
      return;
    }

    if (adjustTarget.available_quantity + delta < 0) {
      showToast(`Stock cannot become negative! Maximum deduction allowed: -${adjustTarget.available_quantity}`, 'error');
      return;
    }

    setSaving(true);
    try {
      await api.adminAdjustStock(token, {
        product_id: adjustTarget.product_id,
        quantity_delta: delta,
        movement_type: adjustmentType,
        reason: adjustmentReason,
      });

      showToast(`Stock updated for ${adjustTarget.product_title}`, 'success');
      setAdjustTarget(null);
      await fetchInventoryData();
    } catch (err: any) {
      showToast(err.message || 'Failed to adjust stock', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerCleanup = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${storeConfig.apiBaseUrl}/admin/inventory/reservations/cleanup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      showToast(`Released ${data.released_reservations_count || 0} expired stock holds back to inventory`, 'info');
      await fetchInventoryData();
    } catch {
      showToast('Completed reservation sweep.', 'info');
    }
  };

  // KPI Metrics
  const totalTracked = inventory.length;
  const lowStockCount = inventory.filter((i) => i.status === 'low_stock').length;
  const outOfStockCount = inventory.filter((i) => i.status === 'out_of_stock').length;
  const totalUnits = inventory.reduce((sum, i) => sum + i.available_quantity, 0);

  const filtered = inventory.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (
      search &&
      !item.product_title.toLowerCase().includes(search.toLowerCase()) &&
      !item.sku.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-coral-400 block mb-1">
            Warehouse Logistics & Stock Control (Phase 05)
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
            Inventory & Concurrency Telemetry
          </h1>
          <p className="text-xs text-plum-300 mt-1">
            Enforce non-negative stock invariants, atomic reservations, and audit trail movement logs.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={handleTriggerCleanup}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-plum-900 border border-plum-800 text-xs font-semibold text-plum-300 hover:text-white transition-colors"
            title="Sweep expired reservations"
          >
            <Clock className="w-3.5 h-3.5 text-coral-400" />
            <span>Sweep Expired Holds</span>
          </button>
          <button
            onClick={fetchInventoryData}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-coral-500 hover:bg-coral-600 rounded-xl text-xs font-semibold text-white shadow-md transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Stock</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-plum-900/60 border border-plum-800">
          <span className="text-xs font-bold uppercase tracking-wider text-plum-400 block mb-1">
            Tracked SKUs
          </span>
          <div className="text-2xl font-display font-black text-white">{totalTracked}</div>
          <span className="text-[11px] text-plum-400">Total catalog variants</span>
        </div>

        <div className="p-5 rounded-2xl bg-plum-900/60 border border-plum-800">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
            Total Warehouse Units
          </span>
          <div className="text-2xl font-display font-black text-white">{totalUnits.toLocaleString()}</div>
          <span className="text-[11px] text-plum-400">Available physical stock</span>
        </div>

        <div className="p-5 rounded-2xl bg-plum-900/60 border border-plum-800">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block mb-1">
            Low Stock Alerts
          </span>
          <div className="text-2xl font-display font-black text-amber-300">{lowStockCount}</div>
          <span className="text-[11px] text-plum-400">At or below reorder threshold</span>
        </div>

        <div className="p-5 rounded-2xl bg-plum-900/60 border border-plum-800">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-400 block mb-1">
            Depleted Out-of-Stock
          </span>
          <div className="text-2xl font-display font-black text-rose-400">{outOfStockCount}</div>
          <span className="text-[11px] text-plum-400">Unavailable for purchase</span>
        </div>
      </div>

      {/* Tabs: Inventory Table vs Stock Movement History */}
      <div className="flex border-b border-plum-800 gap-6 text-xs font-semibold uppercase tracking-wider">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-3 flex items-center gap-2 transition-colors ${
            activeTab === 'inventory'
              ? 'border-b-2 border-coral-500 text-coral-400'
              : 'text-plum-400 hover:text-white'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Real-time Stock Levels ({filtered.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 flex items-center gap-2 transition-colors ${
            activeTab === 'history'
              ? 'border-b-2 border-coral-500 text-coral-400'
              : 'text-plum-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Stock Movement Audit Log ({movements.length})</span>
        </button>
      </div>

      {activeTab === 'inventory' ? (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 bg-plum-900/60 border border-plum-800 p-3 rounded-2xl w-full sm:max-w-md">
              <Search className="w-4 h-4 text-plum-400 ml-1" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by piece title or SKU..."
                className="bg-transparent text-xs text-ivory placeholder:text-plum-500 focus:outline-none w-full"
              />
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-plum-900 border border-plum-800 rounded-xl px-3 py-2 text-ivory focus:outline-none"
              >
                <option value="all">All Reserve Healths</option>
                <option value="in_stock">Healthy (In Stock)</option>
                <option value="low_stock">Low Reserve</option>
                <option value="out_of_stock">Depleted (0 units)</option>
              </select>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="bg-plum-900/60 border border-plum-800/80 rounded-3xl p-6 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-plum-800 text-plum-400 uppercase font-semibold tracking-wider">
                    <th className="pb-3 px-3">SKU</th>
                    <th className="pb-3 px-3">Creation Title</th>
                    <th className="pb-3 px-3">Discipline</th>
                    <th className="pb-3 px-3">Unit Price</th>
                    <th className="pb-3 px-3">Available</th>
                    <th className="pb-3 px-3">Held In Checkout</th>
                    <th className="pb-3 px-3">Threshold</th>
                    <th className="pb-3 px-3">Stock Health</th>
                    <th className="pb-3 px-3 text-right">Adjust Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-plum-800/60">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-plum-800/30 transition-colors">
                      <td className="py-4 px-3 font-mono text-[11px] text-plum-400">
                        {item.sku}
                      </td>
                      <td className="py-4 px-3 font-semibold text-white">
                        {item.product_title}
                      </td>
                      <td className="py-4 px-3 text-plum-300">
                        {item.category_name}
                      </td>
                      <td className="py-4 px-3 font-display font-bold text-white">
                        {formatPrice(item.price)}
                      </td>
                      <td className="py-4 px-3 font-mono font-bold text-base text-white">
                        {item.available_quantity}
                      </td>
                      <td className="py-4 px-3 font-mono text-plum-400">
                        {item.reserved_quantity} holds
                      </td>
                      <td className="py-4 px-3 font-mono text-plum-400">
                        {item.low_stock_threshold} units
                      </td>
                      <td className="py-4 px-3">
                        {item.status === 'out_of_stock' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3 h-3" />
                            Depleted
                          </span>
                        ) : item.status === 'low_stock' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3" />
                            Low Reserve
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Healthy
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-3 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenAdjust(item)}
                          className="bg-plum-800 hover:bg-plum-700 text-white"
                          leftIcon={<SlidersHorizontal className="w-3.5 h-3.5 text-coral-400" />}
                        >
                          Adjust
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Stock Movements Audit Log Table */
        <div className="bg-plum-900/60 border border-plum-800/80 rounded-3xl p-6 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-plum-800 text-plum-400 uppercase font-semibold tracking-wider">
                  <th className="pb-3 px-3">Movement ID</th>
                  <th className="pb-3 px-3">Piece Title</th>
                  <th className="pb-3 px-3">Previous</th>
                  <th className="pb-3 px-3">Delta</th>
                  <th className="pb-3 px-3">Resulting Qty</th>
                  <th className="pb-3 px-3">Movement Type</th>
                  <th className="pb-3 px-3">Audit Reason</th>
                  <th className="pb-3 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-plum-800/60">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-plum-800/30 transition-colors">
                    <td className="py-4 px-3 font-mono text-[11px] text-plum-400">
                      {m.id}
                    </td>
                    <td className="py-4 px-3 font-semibold text-white">
                      {m.product_title}
                    </td>
                    <td className="py-4 px-3 font-mono text-plum-400">
                      {m.previous_quantity}
                    </td>
                    <td className="py-4 px-3 font-mono font-bold">
                      <span className={m.quantity_changed > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {m.quantity_changed > 0 ? `+${m.quantity_changed}` : m.quantity_changed}
                      </span>
                    </td>
                    <td className="py-4 px-3 font-mono font-bold text-white">
                      {m.new_quantity}
                    </td>
                    <td className="py-4 px-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        m.movement_type === 'restock' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        m.movement_type === 'reservation_hold' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                        m.movement_type === 'reservation_release' ? 'bg-mint-500/10 text-mint-300 border border-mint-500/20' :
                        'bg-plum-800 text-plum-300 border border-plum-700'
                      }`}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-plum-300 max-w-xs truncate">
                      {m.reason}
                    </td>
                    <td className="py-4 px-3 text-right text-plum-400">
                      {new Date(m.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Stock Adjustment Modal */}
      <Modal
        isOpen={Boolean(adjustTarget)}
        onClose={() => setAdjustTarget(null)}
        title={`Adjust Stock: ${adjustTarget?.product_title}`}
        description="Recorded in permanent audit log. Strict rule: Stock cannot become negative."
      >
        {adjustTarget && (
          <form onSubmit={handleAdjustSubmit} className="space-y-4">
            <div className="p-4 rounded-xl bg-plum-900 border border-plum-800 text-xs space-y-1">
              <div className="flex justify-between text-plum-300">
                <span>SKU:</span>
                <span className="font-mono text-white">{adjustTarget.sku}</span>
              </div>
              <div className="flex justify-between text-plum-300">
                <span>Current Available Stock:</span>
                <span className="font-bold text-base text-coral-400">{adjustTarget.available_quantity} units</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-plum-700 mb-1.5">
                  Adjustment Type
                </label>
                <select
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value)}
                  className="w-full rounded-xl border border-plum-200 bg-white/80 px-3 py-2.5 text-xs text-plum-900 focus:outline-none"
                >
                  <option value="restock">Restock (+)</option>
                  <option value="adjustment">Manual Adjustment (+/-)</option>
                  <option value="return">Customer Return (+)</option>
                </select>
              </div>

              <div>
                <Input
                  label="Units Change Delta (+/-)"
                  type="number"
                  value={adjustmentDelta}
                  onChange={(e) => setAdjustmentDelta(e.target.value)}
                  placeholder="+5 or -2"
                  required
                />
              </div>
            </div>

            {/* Real-time Calculation Preview */}
            <div className="p-3 bg-ivory rounded-xl border border-plum-200 text-xs flex items-center justify-between">
              <span className="text-plum-600 font-medium">Resulting Stock Level:</span>
              <span className={`font-mono font-bold text-sm ${
                adjustTarget.available_quantity + (parseInt(adjustmentDelta, 10) || 0) < 0
                  ? 'text-rose-600'
                  : 'text-plum-950'
              }`}>
                {adjustTarget.available_quantity + (parseInt(adjustmentDelta, 10) || 0)} units
              </span>
            </div>

            <Input
              label="Audit Reason / Purchase Order Reference"
              type="text"
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              placeholder="e.g. Received shipment from Nordic kiln workshop"
              required
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-plum-100">
              <Button variant="ghost" type="button" onClick={() => setAdjustTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                isLoading={saving}
                disabled={adjustTarget.available_quantity + (parseInt(adjustmentDelta, 10) || 0) < 0}
              >
                Commit Stock Adjustment
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
