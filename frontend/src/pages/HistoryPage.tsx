import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { NeedEntity } from '../types';

function formatReportedDate(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today ${timeStr}`;
  const monthStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${monthStr}, ${timeStr}`;
}

export default function HistoryPage({ onSelectIncident }: { onSelectIncident?: (incident: NeedEntity) => void }) {
  const [needs, setNeeds] = useState<NeedEntity[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Open' | 'Resolved'>('All');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    axios.get('/needs')
      .then((res) => setNeeds(res.data || []))
      .catch((err) => console.error(err));
  }, []);

  const filtered = useMemo(() => {
    return needs.filter((n) => {
      const q = search.toLowerCase();
      const locMatch = (n.location?.name || '').toLowerCase().includes(q);
      const typeMatch = (n.crisisType || '').toLowerCase().includes(q);
      const ticketMatch = (n.ticketCode || '').toLowerCase().includes(q);
      const matchesSearch = locMatch || typeMatch || ticketMatch;

      if (!matchesSearch) return false;

      if (filter === 'Open') return n.status !== 'RESOLVED' && n.status !== 'FALSE_ALARM';
      if (filter === 'Resolved') return n.status === 'RESOLVED';
      return true;
    });
  }, [needs, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedNeeds = filtered.slice(startIndex, startIndex + pageSize);

  const startDisplay = filtered.length > 0 ? startIndex + 1 : 0;
  const endDisplay = Math.min(startIndex + pageSize, filtered.length);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 xl:px-8 py-6 space-y-4 font-sans text-[#F2F2F3]">
      {/* Toolbar: one search input + segmented All | Open | Resolved */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="w-4 h-4 text-[#8B8B94] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by type or place"
            className="w-full h-10 bg-[#141416] border border-[#26262A] rounded-[8px] pl-9 pr-3 text-[13px] text-white placeholder-[#8B8B94] focus:outline-none focus:border-zinc-500"
          />
        </div>

        {/* Segmented All | Open | Resolved */}
        <div className="flex h-10 bg-[#141416] border border-[#26262A] rounded-[8px] p-0.5 text-[13px]">
          {(['All', 'Open', 'Resolved'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setFilter(tab);
                setPage(1);
              }}
              className={`px-4 h-full rounded-[6px] font-medium transition-colors ${
                filter === tab ? 'bg-[#26262A] text-white' : 'text-[#8B8B94] hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Table full width: Type | Location | Score | Affected | Reported | Status chip */}
      <div className="border border-[#26262A] rounded-[10px] overflow-hidden bg-[#141416]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="h-10 border-b border-[#26262A] text-[#8B8B94] font-normal text-[13px]">
                <th className="px-4 font-normal">Type</th>
                <th className="px-4 font-normal">Location</th>
                <th className="px-4 font-normal">Score</th>
                <th className="px-4 font-normal">Affected</th>
                <th className="px-4 font-normal">Reported</th>
                <th className="px-4 font-normal text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26262A]">
              {paginatedNeeds.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#8B8B94]">
                    No signals found.
                  </td>
                </tr>
              ) : (
                paginatedNeeds.map((need) => {
                  const isResolved = need.status === 'RESOLVED';
                  const isFalseAlarm = need.status === 'FALSE_ALARM';
                  const isOpen = !isResolved && !isFalseAlarm;
                  const score = need.criticalityScore || 0;
                  const isCritical = score >= 85;

                  return (
                    <tr
                      key={need.id}
                      onClick={() => onSelectIncident?.(need)}
                      className="h-14 hover:bg-[#1A1A1D] transition-colors cursor-pointer"
                    >
                      {/* Type (capitalised "Infrastructure", no colored dot) */}
                      <td className={`px-4 font-medium capitalize ${isResolved ? 'text-[#8B8B94]' : 'text-white'}`}>
                        {need.crisisType}
                      </td>

                      {/* Location (no pin emoji) */}
                      <td className={`px-4 ${isResolved ? 'text-[#8B8B94]' : 'text-[#F2F2F3]'}`}>
                        {need.location?.name || 'Unknown Site'}
                      </td>

                      {/* Score (red only if >=85) */}
                      <td className={`px-4 font-semibold tabular-nums ${isCritical ? 'text-[#E5383B]' : 'text-[#8B8B94]'}`}>
                        {score.toFixed(0)}
                      </td>

                      {/* Affected ("~30 people") */}
                      <td className="px-4 text-[#8B8B94] tabular-nums">
                        ~{need.estimatedScale || 30} people
                      </td>

                      {/* Reported ("Today 3:33 PM" / "Nov 14, 11:08 AM") */}
                      <td className="px-4 text-[#8B8B94] tabular-nums">
                        {formatReportedDate(need.reportedAt)}
                      </td>

                      {/* Status chip (Open amber, Resolved green, Unverified gray, False alarm gray strikethrough) */}
                      <td className="px-4 text-right">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-[4px] text-[13px] font-medium ${
                            isResolved
                              ? 'bg-[#2E9E6B]/15 text-[#2E9E6B]'
                              : isFalseAlarm
                              ? 'text-[#8B8B94] line-through'
                              : need.status === 'UNVERIFIED'
                              ? 'bg-[#26262A] text-[#8B8B94]'
                              : 'bg-[#E8A317]/15 text-[#E8A317]'
                          }`}
                        >
                          {need.status.toLowerCase().replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer pagination: "1-25 of 48", Prev / Next ghost buttons */}
        <div className="h-12 border-t border-[#26262A] px-4 flex items-center justify-between text-[13px] text-[#8B8B94]">
          <span className="tabular-nums">
            {startDisplay}-{endDisplay} of {filtered.length}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 px-3 border border-[#26262A] hover:bg-[#1A1A1D] text-white rounded-[6px] transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 px-3 border border-[#26262A] hover:bg-[#1A1A1D] text-white rounded-[6px] transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
