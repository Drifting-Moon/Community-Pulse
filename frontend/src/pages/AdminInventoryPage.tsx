import React, { useState, useMemo } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import type { ReliefSupply } from '../types';

export default function AdminInventoryPage() {
  const [supplies, setSupplies] = useState<ReliefSupply[]>([
    {
      id: 'sup-1',
      name: 'Packaged Drinking Water (20L Cans)',
      category: 'water',
      quantity: 1450,
      unit: 'Cans',
      depotName: 'Bandra West Central Relief Warehouse',
      depotCoords: { lat: 19.0596, lng: 72.8295 }
    },
    {
      id: 'sup-2',
      name: 'Ready-to-Eat Emergency Food Rations',
      category: 'food',
      quantity: 2800,
      unit: 'Family Packs',
      depotName: 'Dadar Municipal Supply Depot',
      depotCoords: { lat: 19.0178, lng: 72.8478 }
    },
    {
      id: 'sup-3',
      name: 'Trauma & Emergency First Aid Kits',
      category: 'medical',
      quantity: 320,
      unit: 'Kits',
      depotName: 'KEM Hospital Disaster Stockroom',
      depotCoords: { lat: 19.002, lng: 72.842 }
    },
    {
      id: 'sup-4',
      name: 'Motorized Inflatable Rescue Boats',
      category: 'rescue',
      quantity: 18,
      unit: 'Boats',
      depotName: 'Colaba Coastal Rescue Station',
      depotCoords: { lat: 18.9068, lng: 72.8148 }
    },
    {
      id: 'sup-5',
      name: 'Waterproof Temporary Shelter Tents',
      category: 'shelter',
      quantity: 450,
      unit: 'Tents',
      depotName: 'Andheri Civil Defense Reserve',
      depotCoords: { lat: 19.1136, lng: 72.8697 }
    },
    {
      id: 'sup-6',
      name: 'Portable Water Purification Units',
      category: 'water',
      quantity: 85,
      unit: 'Units',
      depotName: 'Kurla Emergency Mobilization Hub',
      depotCoords: { lat: 19.0726, lng: 72.8845 }
    }
  ]);

  const [selectedDepot, setSelectedDepot] = useState<string>('ALL');

  const depots = useMemo(() => {
    return Array.from(new Set(supplies.map((s) => s.depotName)));
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

  // 4 summary cells: Clean water, Ready rations, Medical kits, Rescue boats
  const waterTotal = supplies.filter((s) => s.category === 'water').reduce((acc, s) => acc + s.quantity, 0);
  const foodTotal = supplies.filter((s) => s.category === 'food').reduce((acc, s) => acc + s.quantity, 0);
  const medicalTotal = supplies.filter((s) => s.category === 'medical').reduce((acc, s) => acc + s.quantity, 0);
  const rescueTotal = supplies.filter((s) => s.category === 'rescue').reduce((acc, s) => acc + s.quantity, 0);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 xl:px-8 py-6 space-y-4 font-sans text-[#F2F2F3]">
      {/* Toolbar row: depot filter select (left) | right: 13px secondary note */}
      <div className="flex items-center justify-between">
        <select
          value={selectedDepot}
          onChange={(e) => setSelectedDepot(e.target.value)}
          className="h-10 bg-[#141416] border border-[#26262A] rounded-[8px] px-3 text-[13px] text-white focus:outline-none"
        >
          <option value="ALL">All relief depots</option>
          {depots.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

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
          <div className="flex items-center gap-1.5 mt-3 text-[13px] text-[#2E9E6B]">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            <span>OK</span>
          </div>
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
          <div className="flex items-center gap-1.5 mt-3 text-[13px] text-[#2E9E6B]">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            <span>OK</span>
          </div>
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
          <div className="flex items-center gap-1.5 mt-3 text-[13px] text-[#2E9E6B]">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            <span>OK</span>
          </div>
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
          <div className="flex items-center gap-1.5 mt-3 text-[13px] text-[#E8A317]">
            <ExclamationTriangleIcon className="w-3.5 h-3.5" />
            <span>Moderate</span>
          </div>
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
              {filteredSupplies.map((item) => {
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
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
