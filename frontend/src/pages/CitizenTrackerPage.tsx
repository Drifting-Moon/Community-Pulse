import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  CheckCircleIcon,
  ClockIcon,
  PhoneIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import type { NeedEntity } from '../types';

export default function CitizenTrackerPage() {
  const { ticketId } = useParams<{ ticketId?: string }>();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState(ticketId || '');
  const [loading, setLoading] = useState(false);
  const [incident, setIncident] = useState<NeedEntity | null>(null);

  const fetchTicket = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    try {
      const res = await axios.get(`/needs/${id.trim()}`);
      if (res.data && !res.data.error) {
        setIncident(res.data);
      }
    } catch {
      // Fallback: search in list
      try {
        const listRes = await axios.get('/needs');
        const found = (listRes.data || []).find(
          (n: NeedEntity) =>
            n.id.toLowerCase() === id.toLowerCase() ||
            (n.ticketCode && n.ticketCode.toLowerCase() === id.toLowerCase())
        );
        if (found) setIncident(found);
      } catch (e) {
        console.error('Ticket fetch error:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      setSearchInput(ticketId);
      fetchTicket(ticketId);
    } else {
      // Load most recent active report if none specified
      axios.get('/needs').then((res) => {
        if (res.data && res.data.length > 0) {
          const first = res.data[0];
          setIncident(first);
          setSearchInput(first.ticketCode || first.id);
        }
      }).catch(() => {});
    }
  }, [ticketId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    navigate(`/citizen/track/${searchInput.trim()}`);
    fetchTicket(searchInput.trim());
  };

  const steps = [
    { label: 'Submitted', done: true },
    { label: 'Verified', done: incident?.status !== 'UNVERIFIED' && incident?.status !== 'FALSE_ALARM' },
    { 
      label: 'Dispatched', 
      done: ['DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'RESOLVED'].includes(incident?.status || '') 
    },
    { 
      label: 'On Scene', 
      done: ['ON_SCENE', 'RESOLVED'].includes(incident?.status || '') 
    },
    { label: 'Resolved', done: incident?.status === 'RESOLVED' },
  ];

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'RESOLVED': return 'Resolved';
      case 'ON_SCENE': return 'On scene';
      case 'EN_ROUTE': return 'En route';
      case 'DISPATCHED': return 'Dispatched';
      case 'VERIFIED': return 'Verified';
      case 'FALSE_ALARM': return 'False alarm';
      default: return 'Submitted';
    }
  };

  return (
    <div className="max-w-[960px] mx-auto space-y-8 py-2">
      {/* Search Header */}
      <div className="space-y-3">
        <h1 className="text-[20px] font-semibold text-gray-900">Track an emergency report</h1>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Enter ticket code (e.g. CP-8012)"
            className="flex-1 h-11 px-3.5 border border-gray-200 rounded-xl text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 tabular-nums transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="h-11 px-6 bg-gray-900 hover:bg-black text-white text-[15px] font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : 'Track'}
          </button>
        </form>
      </div>

      {incident && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* LEFT COLUMN: Ticket info & Stepper */}
          <div className="border border-gray-200 rounded-[12px] p-6 bg-white space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[13px] font-semibold text-gray-500 tabular-nums block">
                  {incident.ticketCode || incident.id.slice(0, 8)}
                </span>
                <h2 className="text-[20px] font-semibold text-gray-900 capitalize mt-1">
                  {incident.crisisType} emergency at {incident.location?.name || 'Reported Location'}
                </h2>
                <p className="text-[13px] text-gray-500 mt-1 tabular-nums">
                  Priority {incident.criticalityScore?.toFixed(0) || 75}/100
                </p>
              </div>

              <span className={`text-[13px] font-medium px-2.5 py-1 rounded-md border shrink-0 ${
                incident.status === 'RESOLVED'
                  ? 'bg-green-50 text-[#2E9E6B] border-green-200'
                  : 'bg-red-50 text-[#E5383B] border-red-200'
              }`}>
                {getStatusLabel(incident.status)}
              </span>
            </div>

            {/* 5-step stepper (horizontal on desktop, vertical on <640px) */}
            <div className="py-4 border-y border-gray-100">
              {/* Desktop horizontal view */}
              <div className="hidden sm:flex items-center justify-between relative">
                <div className="absolute left-4 right-4 top-3.5 h-[2px] bg-gray-100 -z-0" />

                {steps.map((s, idx) => (
                  <div key={idx} className="relative z-10 flex flex-col items-center bg-white px-2">
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-[13px] font-medium border ${
                        s.done
                          ? 'bg-gray-900 border-gray-900 text-white'
                          : 'bg-white border-gray-300 text-gray-400'
                      }`}
                    >
                      {s.done ? <CheckCircleIcon className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className={`text-[13px] mt-2 ${s.done ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Mobile vertical view */}
              <div className="sm:hidden space-y-4">
                {steps.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-[13px] font-medium border shrink-0 ${
                        s.done
                          ? 'bg-gray-900 border-gray-900 text-white'
                          : 'bg-white border-gray-300 text-gray-400'
                      }`}
                    >
                      {s.done ? <CheckCircleIcon className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className={`text-[13px] ${s.done ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Status message line */}
            <div className="text-[15px] text-gray-700 leading-relaxed">
              {incident.status === 'RESOLVED' && 'Incident has been resolved by on-scene responders. Relief verified.'}
              {incident.status === 'ON_SCENE' && 'Emergency personnel have arrived on site and are actively rendering assistance.'}
              {incident.status === 'EN_ROUTE' && 'Responders have been dispatched and are currently en route to your location.'}
              {incident.status === 'VERIFIED' && 'Incident has been verified by dispatch officers. Mobilizing nearest response unit.'}
              {incident.status === 'UNVERIFIED' && 'Your signal has been received and is currently in queue for dispatcher triage.'}
              {incident.status === 'FALSE_ALARM' && 'Report was inspected and closed as a duplicate or false alarm.'}
            </div>

            {/* Proof of work if resolved */}
            {incident.proofOfWork && (
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2 text-[13px]">
                <span className="font-semibold text-gray-900 block">Resolution Confirmation</span>
                <p className="text-gray-600">{incident.proofOfWork.notes}</p>
                <div className="flex items-center gap-4 text-gray-500 pt-1 border-t border-gray-200">
                  <span>Assisted: {incident.proofOfWork.casualtiesAssisted} people</span>
                  <span>By: {incident.proofOfWork.submittedByName}</span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Responder Card & Updates Timeline */}
          <div className="space-y-6">
            {/* Responder Card */}
            {incident.enRouteVolunteers && incident.enRouteVolunteers.length > 0 && (
              <div className="border border-gray-200 rounded-[12px] p-5 bg-white space-y-3">
                <span className="text-[13px] font-semibold text-gray-900 block">
                  Assigned Responder
                </span>

                {incident.enRouteVolunteers.map((vol) => (
                  <div key={vol.id} className="space-y-2 text-[13px]">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900 text-[15px]">{vol.name}</div>
                        <div className="text-gray-500 text-[13px]">{vol.ngo || 'Official Rescue Unit'}</div>
                      </div>
                      {vol.etaMinutes && (
                        <div className="flex items-center gap-1 text-gray-600 font-medium tabular-nums text-[13px]">
                          <ClockIcon className="w-4 h-4 text-gray-400" />
                          <span>ETA {vol.etaMinutes}m</span>
                        </div>
                      )}
                    </div>

                    {vol.phone && (
                      <div className="pt-2">
                        <a
                          href={`tel:${vol.phone}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-800 rounded-lg text-[13px] font-medium transition-colors"
                        >
                          <PhoneIcon className="w-3.5 h-3.5" />
                          Call responder
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Updates Audit Timeline */}
            <div className="border border-gray-200 rounded-[12px] p-5 bg-white space-y-3">
              <span className="text-[13px] font-semibold text-gray-900 block">
                Updates
              </span>

              {incident.timeline && incident.timeline.length > 0 ? (
                <div className="space-y-3 text-[13px]">
                  {incident.timeline.map((event, idx) => (
                    <div key={idx} className="pb-2 border-b border-gray-100 last:border-0 last:pb-0">
                      <div className="text-gray-500 text-[11px] tabular-nums">
                        {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="font-medium text-gray-800 mt-0.5">{event.description}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[13px] text-gray-500">
                  <div className="text-[11px] text-gray-400 tabular-nums">
                    {new Date(incident.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="font-medium text-gray-800 mt-0.5">Report submitted by citizen</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
