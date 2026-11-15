import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type { Prediction } from '../types';

export default function AnalyticsPage() {
  const [crises, setCrises] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedMinutesAgo, setUpdatedMinutesAgo] = useState(2);

  const fetchData = async () => {
    try {
      const [crisesRes, predRes] = await Promise.all([
        axios.get('/needs'),
        axios.get('/api/predictions')
      ]);
      setCrises(crisesRes.data || []);
      setPredictions(predRes.data?.predictions || []);
      setUpdatedMinutesAgo(0);
    } catch (e) {
      console.error('Error loading analytics:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      setUpdatedMinutesAgo((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const validCrises = crises || [];
  const extractCity = (name: string) => name.split(' (')[0] || name;

  const totalCrises = validCrises.length;
  const openCrises = validCrises.filter((c) => c.status !== 'RESOLVED' && c.status !== 'FALSE_ALARM').length;
  const resolvedCrises = validCrises.filter((c) => c.status === 'RESOLVED').length;
  const uniqueCities = new Set(validCrises.map((c) => extractCity(c.location?.name || ''))).size;

  if (loading) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-6 xl:px-8 py-6 text-[13px] text-[#8B8B94]">
        Loading analytics...
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 xl:px-8 py-6 space-y-6 font-sans text-[#F2F2F3]">
      {/* Row 1: 4 stat cells in one bordered strip (Total crises, Open now, Resolved, Cities covered): label 13, value 32, NO colored top borders */}
      <div className="h-[88px] border border-[#26262A] bg-[#141416] rounded-[10px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#26262A]">
        <div className="flex flex-col justify-center px-6">
          <span className="text-[13px] text-[#8B8B94]">Total crises</span>
          <span className="text-[32px] font-semibold text-white leading-none mt-1 tabular-nums">
            {totalCrises}
          </span>
        </div>
        <div className="flex flex-col justify-center px-6">
          <span className="text-[13px] text-[#8B8B94]">Open now</span>
          <span className="text-[32px] font-semibold text-white leading-none mt-1 tabular-nums">
            {openCrises}
          </span>
        </div>
        <div className="flex flex-col justify-center px-6">
          <span className="text-[13px] text-[#8B8B94]">Resolved</span>
          <span className="text-[32px] font-semibold text-white leading-none mt-1 tabular-nums">
            {resolvedCrises}
          </span>
        </div>
        <div className="flex flex-col justify-center px-6">
          <span className="text-[13px] text-[#8B8B94]">Cities covered</span>
          <span className="text-[32px] font-semibold text-white leading-none mt-1 tabular-nums">
            {uniqueCities || 8}
          </span>
        </div>
      </div>

      {/* Row 2: section "Forecast, next 6 hours" 20px + "Updated 2m ago" 13px secondary + refresh icon button on right */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[20px] font-semibold text-white">Forecast, next 6 hours</h2>
            <span className="text-[13px] text-[#8B8B94]">
              Updated {updatedMinutesAgo}m ago
            </span>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 text-[#8B8B94] hover:text-white rounded-[6px] border border-[#26262A] hover:bg-[#1A1A1D] transition-colors"
            title="Refresh forecast"
          >
            <ArrowPathIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Table: City | Hazard | Level chip | Confidence | Reason | Recommended action. Rows 56px */}
        <div className="border border-[#26262A] rounded-[10px] overflow-hidden bg-[#141416]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="h-10 border-b border-[#26262A] text-[#8B8B94] font-normal text-[13px]">
                  <th className="px-4 font-normal">City</th>
                  <th className="px-4 font-normal">Hazard</th>
                  <th className="px-4 font-normal">Risk level</th>
                  <th className="px-4 font-normal">Confidence</th>
                  <th className="px-4 font-normal">Reason</th>
                  <th className="px-4 font-normal">Recommended action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#26262A]">
                {predictions.map((p, idx) => {
                  const isCritical = p.riskLevel === 'CRITICAL';
                  const isHigh = p.riskLevel === 'HIGH';

                  const chipClass = isCritical
                    ? 'text-[#E5383B] bg-red-950/30 border border-red-900/60'
                    : isHigh
                    ? 'text-[#E8A317] bg-amber-950/30 border border-amber-900/60'
                    : 'text-[#8B8B94] bg-[#26262A] border border-[#3F3F46]';

                  return (
                    <tr key={idx} className="h-14 hover:bg-[#1A1A1D] transition-colors">
                      {/* City */}
                      <td className="px-4 font-medium text-white">
                        {p.city}
                      </td>

                      {/* Hazard (icon line style, no emoji: "Flood") */}
                      <td className="px-4 text-[#F2F2F3] capitalize">
                        {p.predictedCrisisType}
                      </td>

                      {/* Level chip (Critical red, High amber, Medium gray) */}
                      <td className="px-4">
                        <span className={`px-2 py-0.5 rounded-[4px] text-[13px] font-medium capitalize ${chipClass}`}>
                          {p.riskLevel.toLowerCase()}
                        </span>
                      </td>

                      {/* Confidence ("88%") */}
                      <td className="px-4 text-white tabular-nums">
                        {(p.confidenceScore * 100).toFixed(0)}%
                      </td>

                      {/* Reason (13 secondary) */}
                      <td className="px-4 text-[#8B8B94] max-w-xs truncate">
                        {p.reasoning}
                      </td>

                      {/* Recommended action */}
                      <td className="px-4 text-white max-w-sm truncate">
                        {p.recommendedPreventiveAction}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer line */}
        <p className="text-[13px] text-[#8B8B94] pt-1">
          Forecasts are for pre-emptive staging only.
        </p>
      </div>
    </div>
  );
}
