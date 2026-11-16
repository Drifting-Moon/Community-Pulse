import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import type { ReliefSupply } from '../types';

const STORAGE_KEY = 'naturalpulse_admin_supplies';

export default function AdminInventoryPage() {
  const [supplies, setSupplies] = useState<ReliefSupply[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(supplies));
    } catch {}
  }, [supplies]);

  const [selectedDepot, setSelectedDepot] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<'water' | 'food' | 'medical' | 'rescue' | 'shelter'>('water');
  const [newItemQuantity, setNewItemQuantity] = useState(100);
  const [newItemUnit, setNewItemUnit] = useState('Units');
  const [newItemDepot, setNewItemDepot] = useState('');

  const depots = useMemo(() => {
    return Array.from(new Set(supplies.map((s) => s.depotName))).filter(Boolean);
  }, [supplies]);

  const filteredSupplies = useMemo(() => {
    if (selectedDepot === 'ALL') return supplies;
    return supplies.filter((s) => s.depotName === selectedDepot);
  }, [supplies, selectedDepot]);

  const handleRestock = (id: string, amount: number) => {
    setSupplies((prev) =>
      prev.map((s) => (s.id === id ? { ...s, quantity: s.quantity + amount } : s))
    );
  };

  const handleAddSupply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemDepot.trim()) {
      alert('Please enter item name and depot location.');
      return;
    }
    const newSupply: ReliefSupply = {
      id: 'sup-' + Date.now(),
      name: newItemName.trim(),
      category: newItemCategory,
      quantity: Math.max(0, Number(newItemQuantity) || 0),
      unit: newItemUnit.trim() || 'Units',
      depotName: newItemDepot.trim(),
      depotCoords: { lat: 19.076, lng: 72.877 }
    };
    setSupplies((prev) => [newSupply, ...prev]);
    setNewItemName('');
    setNewItemDepot('');
    setShowAddModal(false);
  };

  // 4 summary cells: Clean water, Ready rations, Medical kits, Rescue boats
  const waterTotal = supplies.filter((s) => s.category === 'water').reduce((acc, s) => acc + s.quantity, 0);
  const foodTotal = supplies.filter((s) => s.category === 'food').reduce((acc, s) => acc + s.quantity, 0);
  const medicalTotal = supplies.filter((s) => s.category === 'medical').reduce((acc, s) => acc + s.quantity, 0);
  const rescueTotal = supplies.filter((s) => s.category === 'rescue').reduce((acc, s) => acc + s.quantity, 0);

  const renderStockBadge = (total: number, lowThreshold = 20) => {
    if (total === 0) {
      return (
        <div className="flex items-center gap-1.5 mt-3 text-[13px] text-[#E5383B]">
          <ExclamationCircleIcon className="w-3.5 h-3.5" />
          <span>Depleted (0)</span>
        </div>
      );
    }
    if (total < lowThreshold) {
      return (
        <div className="flex items-center gap-1.5 mt-3 text-[13px] text-[#E8A317]">
          <ExclamationTriangleIcon className="w-3.5 h-3.5" />
          <span>Low stock ({total})</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 mt-3 text-[13px] text-[#2E9E6B]">
        <CheckCircleIcon className="w-3.5 h-3.5" />
        <span>Adequate ({total})</span>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 xl:px-8 py-6 space-y-4 font-sans text-[#F2F2F3]">
      {/* Toolbar row: depot filter select + add button (left) | right: 13px secondary note */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            value={selectedDepot}
            onChange={(e) => setSelectedDepot(e.target.value)}
            className="h-10 bg-[#141416] border border-[#26262A] rounded-[8px] px-3 text-[13px] text-white focus:outline-none"
          >
            <option value="ALL">All relief depots ({depots.length})</option>
            {depots.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="h-10 px-3.5 bg-[#141416] hover:bg-[#1A1A1D] border border-[#26262A] text-white rounded-[8px] text-[13px] font-medium transition-colors flex items-center gap-1.5"
          >
            <PlusIcon className="w-4 h-4 text-white" />
            <span>Add supply</span>
          </button>
        </div>

        <span className="text-[13px] text-[#8B8B94]">
          Stock is allocated automatically on dispatch
        </span>
      </div>

      {/* Summary strip: one bordered container, 4 cells, white value 32, label 13 secondary */}
      <div className="border border-[#26262A] bg-[#141416] rounded-[10px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#26262A]">
        {/* Clean water */}
        <div className="p-4 flex flex-col justify-between">
          <div>
            <span className="text-[13px] text-[#8B8B94]">Clean water</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[32px] font-semibold text-white leading-none tabular-nums">
                {waterTotal.toLocaleString()}
              </span>
              <span className="text-[13px] text-[#8B8B94]">Cans / Units</span>
            </div>
          </div>
          {renderStockBadge(waterTotal, 50)}
        </div>

        {/* Ready rations */}
        <div className="p-4 flex flex-col justify-between">
          <div>
            <span className="text-[13px] text-[#8B8B94]">Ready rations</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[32px] font-semibold text-white leading-none tabular-nums">
                {foodTotal.toLocaleString()}
              </span>
              <span className="text-[13px] text-[#8B8B94]">Family Packs</span>
            </div>
          </div>
          {renderStockBadge(foodTotal, 30)}
        </div>

        {/* Medical kits */}
        <div className="p-4 flex flex-col justify-between">
          <div>
            <span className="text-[13px] text-[#8B8B94]">Medical kits</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[32px] font-semibold text-white leading-none tabular-nums">
                {medicalTotal.toLocaleString()}
              </span>
              <span className="text-[13px] text-[#8B8B94]">Trauma Kits</span>
            </div>
          </div>
          {renderStockBadge(medicalTotal, 20)}
        </div>

        {/* Rescue boats */}
        <div className="p-4 flex flex-col justify-between">
          <div>
            <span className="text-[13px] text-[#8B8B94]">Rescue boats</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[32px] font-semibold text-white leading-none tabular-nums">
                {rescueTotal.toLocaleString()}
              </span>
              <span className="text-[13px] text-[#8B8B94]">Boats</span>
            </div>
          </div>
          {renderStockBadge(rescueTotal, 5)}
        </div>
      </div>

      {/* Ledger Table: Item | Category | Depot | Stock | Status | Restock */}
      <div className="border border-[#26262A] rounded-[10px] overflow-hidden bg-[#141416]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="h-10 border-b border-[#26262A] text-[#8B8B94] font-normal text-[13px]">
                <th className="px-4 font-normal">Supply item</th>
                <th className="px-4 font-normal">Category</th>
                <th className="px-4 font-normal">Depot</th>
                <th className="px-4 font-normal text-right">Stock</th>
                <th className="px-4 font-normal">Status</th>
                <th className="px-4 font-normal text-right">Restock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26262A]">
              {filteredSupplies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#8B8B94]">
                    No inventory recorded yet. Click "+ Add supply" to register emergency stock.
                  </td>
                </tr>
              ) : (
                filteredSupplies.map((item) => {
                const isOut = item.quantity === 0;
                const isLow = item.quantity > 0 && item.quantity <= 100;

                const statusDotColor = isOut ? '#E5383B' : isLow ? '#E8A317' : '#2E9E6B';
                const statusLabel = isOut ? 'Out' : isLow ? 'Low' : 'OK';

                return (
                  <tr key={item.id} className="h-[52px] hover:bg-[#1A1A1D] transition-colors">
                    {/* Item */}
                    <td className="px-4 font-medium text-white">
                      {item.name}
                    </td>

                    {/* Category: plain 13px secondary text (no colored tags) */}
                    <td className="px-4 text-[#8B8B94] capitalize">
                      {item.category}
                    </td>

                    {/* Depot */}
                    <td className="px-4 text-[#8B8B94]">
                      {item.depotName}
                    </td>

                    {/* Stock: right-aligned: "1,450" 15 medium + unit 13 secondary */}
                    <td className="px-4 text-right">
                      <span className="text-[15px] font-medium text-white tabular-nums">
                        {item.quantity.toLocaleString()}
                      </span>{' '}
                      <span className="text-[13px] text-[#8B8B94]">{item.unit}</span>
                    </td>

                    {/* Status chip: OK (green dot), Low (amber dot), Out (red dot) */}
                    <td className="px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: statusDotColor }}
                        />
                        <span className="text-[13px] text-white">{statusLabel}</span>
                      </div>
                    </td>

                    {/* Restock: two ghost buttons "+50" "+250" (1px border, same neutral style, no blue) */}
                    <td className="px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRestock(item.id, 50)}
                          className="h-7 px-2.5 bg-[#141416] hover:bg-[#1A1A1D] border border-[#26262A] text-white text-[13px] rounded-[6px] transition-colors tabular-nums"
                        >
                          +50
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRestock(item.id, 250)}
                          className="h-7 px-2.5 bg-[#141416] hover:bg-[#1A1A1D] border border-[#26262A] text-white text-[13px] rounded-[6px] transition-colors tabular-nums"
                        >
                          +250
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Supply Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[2000] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#26262A] rounded-[10px] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#26262A] pb-3">
              <h3 className="text-[15px] font-semibold text-white">Register Relief Supply</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#8B8B94] hover:text-white p-1"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupply} className="space-y-4 text-[13px]">
              <div>
                <label className="block text-[#8B8B94] font-medium mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Bottled Water, First Aid Kits"
                  className="w-full h-10 bg-[#0E0E10] border border-[#26262A] rounded-[8px] px-3 text-white placeholder-[#8B8B94] focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8B8B94] font-medium mb-1">Category</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value as any)}
                    className="w-full h-10 bg-[#0E0E10] border border-[#26262A] rounded-[8px] px-3 text-white focus:outline-none focus:border-zinc-500"
                  >
                    <option value="water">Water</option>
                    <option value="food">Food</option>
                    <option value="medical">Medical</option>
                    <option value="rescue">Rescue</option>
                    <option value="shelter">Shelter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#8B8B94] font-medium mb-1">Unit</label>
                  <input
                    type="text"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    placeholder="Units / Cans / Kits"
                    className="w-full h-10 bg-[#0E0E10] border border-[#26262A] rounded-[8px] px-3 text-white placeholder-[#8B8B94] focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#8B8B94] font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newItemQuantity}
                  onChange={(e) => setNewItemQuantity(Number(e.target.value))}
                  className="w-full h-10 bg-[#0E0E10] border border-[#26262A] rounded-[8px] px-3 text-white placeholder-[#8B8B94] focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-[#8B8B94] font-medium mb-1">Depot / Warehouse Name</label>
                <input
                  type="text"
                  required
                  value={newItemDepot}
                  onChange={(e) => setNewItemDepot(e.target.value)}
                  placeholder="e.g. Central City Relief Depot"
                  className="w-full h-10 bg-[#0E0E10] border border-[#26262A] rounded-[8px] px-3 text-white placeholder-[#8B8B94] focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#26262A]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="h-9 px-4 border border-[#26262A] text-[#8B8B94] hover:text-white rounded-[8px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 bg-white hover:bg-zinc-200 text-black font-semibold rounded-[8px] transition-colors"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
