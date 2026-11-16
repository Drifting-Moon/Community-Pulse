import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import type { VolunteerProfile, AdminAccount } from '../types';
import {
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  XMarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const DEFAULT_ORGANIZATIONS = [
  'Independent Civic Responder',
  'State Disaster Management Force (SDRF)',
  'National Disaster Response Force (NDRF Auxiliary)',
  'City Fire & Emergency Rescue Service',
  'Red Cross Disaster Relief Team'
];

const ANCHOR_PRESETS = [
  { name: 'Mumbai - Dharavi Hub', lat: 19.0422, lng: 72.8538 },
  { name: 'Mumbai - Andheri Station', lat: 19.1136, lng: 72.8697 },
  { name: 'Delhi - Connaught Place', lat: 28.6315, lng: 77.2167 },
  { name: 'Delhi - Chandni Chowk', lat: 28.6506, lng: 77.2300 },
  { name: 'Bengaluru - Indiranagar', lat: 12.9784, lng: 77.6408 },
  { name: 'Chennai - T Nagar Hub', lat: 13.0405, lng: 80.2337 },
  { name: 'Kolkata - Park Street', lat: 22.5487, lng: 88.3522 },
  { name: 'Hyderabad - Hitech City', lat: 17.4483, lng: 78.3915 }
];

const AVAILABLE_SKILLS = [
  { id: 'medical', label: 'Medical and First Aid' },
  { id: 'water', label: 'Water and Flood Rescue' },
  { id: 'fire', label: 'Fire Emergency Response' },
  { id: 'food', label: 'Food and Ration Logistics' },
  { id: 'infrastructure', label: 'Infrastructure and Debris' },
  { id: 'shelter', label: 'Shelter and Evacuation' }
];

export default function VolunteersPage() {
  const ADMIN_STORAGE_KEY = 'communitypulse_admin_account';
  const [adminAccount] = useState<AdminAccount | null>(() => {
    try {
      const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [search, setSearch] = useState('');
  const [nearAnchor, setNearAnchor] = useState<string>('');
  const [radiusKm, setRadiusKm] = useState<number>(15);
  const [ngoFilter, setNgoFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [orgList, setOrgList] = useState<string[]>(DEFAULT_ORGANIZATIONS);

  // Registration modal state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regStep, setRegStep] = useState<1 | 2 | 3>(1);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regNgo, setRegNgo] = useState('Independent Civic Responder');
  const [regPhone, setRegPhone] = useState('');
  const [regLanguage, setRegLanguage] = useState('English');
  const [regSkills, setRegSkills] = useState<string[]>(['medical']);
  const [regLocationName, setRegLocationName] = useState('');
  const [regLat, setRegLat] = useState(28.6139);
  const [regLng, setRegLng] = useState(77.2090);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Kebab menu state
  const [openKebabId, setOpenKebabId] = useState<string | null>(null);

  const fetchVolunteers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/volunteers`);
      setVolunteers(res.data || []);
    } catch (e) {
      console.error('Error fetching volunteers:', e);
    }
  };

  useEffect(() => {
    fetchVolunteers();
    const fetchOrgs = async () => {
      try {
        let res;
        try {
          res = await axios.get(`${API_BASE}/organizations`);
        } catch {
          res = await axios.get(`${API_BASE}/api/organizations`);
        }
        if (res.data?.organizations && Array.isArray(res.data.organizations)) {
          const names = res.data.organizations.map((o: any) => o.name);
          const merged = Array.from(new Set(['Independent Civic Responder', ...names]));
          setOrgList(merged);
        }
      } catch {}
    };
    fetchOrgs();
  }, []);

  const handleRegisterSubmit = async () => {
    if (!regName.trim()) {
      alert('Please enter volunteer name.');
      setRegStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: regName.trim(),
        email: regEmail.trim() ? regEmail.trim().toLowerCase() : undefined,
        ngo: regNgo.trim(),
        phone: regPhone.trim() || undefined,
        preferredLanguage: regLanguage,
        skills: regSkills,
        locationCoords: { lat: regLat, lng: regLng },
        locationName: regLocationName
      };

      await axios.post(`${API_BASE}/volunteers`, payload);
      setShowRegisterModal(false);
      setRegStep(1);
      setRegName('');
      fetchVolunteers();
    } catch (e) {
      console.error('Registration failed:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveVolunteer = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from active network?`)) return;
    try {
      await axios.delete(`${API_BASE}/volunteers/${id}`);
      fetchVolunteers();
    } catch (e) {
      console.error('Error removing volunteer:', e);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to purge all volunteers from the network database?')) return;
    try {
      await axios.post(`${API_BASE}/volunteers/clear`);
      fetchVolunteers();
    } catch (e) {
      console.error('Error clearing volunteers:', e);
    }
  };

  // Filter calculations
  const filteredVolunteers = useMemo(() => {
    let list = [...volunteers];

    // NGO isolation: NGO admin sees ONLY volunteers who joined their NGO (by 5-letter code or matching name)
    if (adminAccount?.departmentCategory === 'NGO') {
      list = list.filter((v) => {
        if (adminAccount.ngoCode && v.ngoCode) {
          return v.ngoCode.toUpperCase() === adminAccount.ngoCode.toUpperCase();
        }
        if (adminAccount.departmentName && v.ngo) {
          return v.ngo.toLowerCase().includes(adminAccount.departmentName.toLowerCase()) ||
                 adminAccount.departmentName.toLowerCase().includes(v.ngo.toLowerCase());
        }
        return false;
      });
    }

    // Fixed 15 km area filtering for Department / NGO admin
    if (adminAccount?.hqCoords) {
      list = list.filter((v) => {
        if (!v.locationCoords) return false;
        const dist = haversineDistance(
          adminAccount.hqCoords.lat,
          adminAccount.hqCoords.lng,
          v.locationCoords.lat,
          v.locationCoords.lng
        );
        return dist <= (adminAccount.radiusKm || 15);
      });
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v) =>
        v.name.toLowerCase().includes(q) ||
        (v.ngo || '').toLowerCase().includes(q) ||
        (v.ngoCode || '').toLowerCase().includes(q) ||
        (v.locationName || '').toLowerCase().includes(q) ||
        v.skills.some((s) => s.toLowerCase().includes(q))
      );
    }

    // NGO filter
    if (ngoFilter !== 'ALL') {
      list = list.filter((v) => v.ngo === ngoFilter);
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      list = list.filter((v) => v.status === statusFilter);
    }

    // Near anchor radius filter
    if (nearAnchor) {
      const preset = ANCHOR_PRESETS.find((p) => p.name === nearAnchor);
      if (preset) {
        list = list.filter((v) => {
          if (!v.locationCoords) return false;
          const dist = haversineDistance(preset.lat, preset.lng, v.locationCoords.lat, v.locationCoords.lng);
          return dist <= radiusKm;
        });
      }
    }

    return list;
  }, [volunteers, search, ngoFilter, statusFilter, nearAnchor, radiusKm, adminAccount]);

  const sublineText = useMemo(() => {
    if (adminAccount?.departmentCategory === 'NGO') {
      return `${filteredVolunteers.length} verified responders registered to ${adminAccount.departmentName} within 15 km area`;
    }
    if (adminAccount) {
      return `${filteredVolunteers.length} active emergency responders within 15 km radius of ${adminAccount.stationName}`;
    }
    if (nearAnchor) {
      return `${filteredVolunteers.length} volunteers within ${radiusKm} km of ${nearAnchor}`;
    }
    return `${filteredVolunteers.length} volunteers`;
  }, [filteredVolunteers.length, nearAnchor, radiusKm, adminAccount]);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 xl:px-8 py-6 space-y-4 font-sans text-[#F2F2F3]">
      {/* Department Context Banner */}
      {adminAccount?.departmentCategory === 'NGO' && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg shrink-0">
              🤝
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-semibold text-white">{adminAccount.departmentName} Team</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Private NGO Roster
                </span>
              </div>
              <p className="text-[12px] text-emerald-300/80">
                Only volunteers who registered with your unique 5-letter code appear in this roster (15 km operational radius).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-[12px] text-[#8B8B94]">Team Join Code:</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(adminAccount.ngoCode || '');
                alert(`Copied NGO Code: ${adminAccount.ngoCode}`);
              }}
              className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono font-bold tracking-widest text-[14px] rounded-lg border border-emerald-500/40 transition-colors cursor-pointer"
              title="Click to copy 5-letter code"
            >
              {adminAccount.ngoCode}
            </button>
          </div>
        </div>
      )}

      {adminAccount && adminAccount.departmentCategory !== 'NGO' && (
        <div className="bg-[#141416] border border-[#26262A] rounded-xl p-3 px-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xl">
              {adminAccount.departmentCategory === 'FIRE_DEPT' ? '🚒' : adminAccount.departmentCategory === 'POLICE_DEPT' ? '🚓' : adminAccount.departmentCategory === 'MEDICAL_HEALTH' ? '🏥' : '🛡️'}
            </span>
            <div>
              <p className="text-[14px] font-semibold text-white">{adminAccount.departmentName} Jurisdiction</p>
              <p className="text-[12px] text-[#8B8B94]">Active responders within 15 km radius of {adminAccount.stationName} Base HQ.</p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input (flex-1, h-10) */}
        <div className="relative flex-1 min-w-[260px]">
          <MagnifyingGlassIcon className="w-4 h-4 text-[#8B8B94] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, organization, area or skill"
            className="w-full h-10 bg-[#141416] border border-[#26262A] rounded-[8px] pl-9 pr-3 text-[13px] text-white placeholder-[#8B8B94] focus:outline-none focus:border-zinc-500"
          />
        </div>

        {/* Near anchor select */}
        <select
          value={nearAnchor}
          onChange={(e) => setNearAnchor(e.target.value)}
          className="h-10 bg-[#141416] border border-[#26262A] rounded-[8px] px-3 text-[13px] text-white focus:outline-none"
        >
          <option value="">Near all hubs</option>
          {ANCHOR_PRESETS.map((p) => (
            <option key={p.name} value={p.name}>
              Near {p.name}
            </option>
          ))}
        </select>

        {/* Radius segmented 5 / 15 / 30 / 75 / 150 km (disabled until anchor chosen) */}
        <div className={`flex h-10 bg-[#141416] border border-[#26262A] rounded-[8px] p-0.5 text-[13px] ${
          !nearAnchor ? 'opacity-40 pointer-events-none' : ''
        }`}>
          {[5, 15, 30, 75, 150].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRadiusKm(r)}
              className={`px-3 h-full rounded-[6px] font-medium transition-colors tabular-nums ${
                radiusKm === r ? 'bg-[#26262A] text-white' : 'text-[#8B8B94] hover:text-white'
              }`}
            >
              {r} km
            </button>
          ))}
        </div>

        {/* NGO select */}
        <select
          value={ngoFilter}
          onChange={(e) => setNgoFilter(e.target.value)}
          className="h-10 bg-[#141416] border border-[#26262A] rounded-[8px] px-3 text-[13px] text-white focus:outline-none"
        >
          <option value="ALL">All organizations</option>
          {orgList.map((ngo) => (
            <option key={ngo} value={ngo}>
              {ngo}
            </option>
          ))}
        </select>

        {/* Status select */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 bg-[#141416] border border-[#26262A] rounded-[8px] px-3 text-[13px] text-white focus:outline-none"
        >
          <option value="ALL">All statuses</option>
          <option value="AVAILABLE">Ready</option>
          <option value="BUSY">Busy</option>
          <option value="OFF_DUTY">Off duty</option>
        </select>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {volunteers.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="h-10 px-3 bg-[#141416] hover:bg-[#1A1A1D] border border-[#26262A] text-[#8B8B94] hover:text-white rounded-[8px] text-[13px] transition-colors"
            >
              Clear all
            </button>
          )}

          {/* Register volunteer primary button */}
          <button
            type="button"
            onClick={() => {
              setRegStep(1);
              setShowRegisterModal(true);
            }}
            className="h-10 px-4 bg-white hover:bg-zinc-200 text-black font-semibold rounded-[8px] text-[13px] transition-colors"
          >
            Register volunteer
          </button>
        </div>
      </div>

      {/* Subline under toolbar */}
      <div className="text-[13px] text-[#8B8B94]">
        {sublineText}
      </div>

      {/* Volunteers Table (rows 56px, full width stretch) */}
      <div className="border border-[#26262A] rounded-[10px] overflow-hidden bg-[#141416]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="h-10 border-b border-[#26262A] text-[#8B8B94] font-normal text-[13px]">
                <th className="px-4 font-normal">Volunteer</th>
                <th className="px-4 font-normal">Status</th>
                <th className="px-4 font-normal">Station</th>
                <th className="px-4 font-normal">Skills</th>
                <th className="px-4 font-normal">Languages</th>
                <th className="px-4 font-normal">Reliability</th>
                <th className="px-4 font-normal">Load</th>
                <th className="px-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26262A]">
              {filteredVolunteers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#8B8B94]">
                    No volunteers match your criteria.
                  </td>
                </tr>
              ) : (
                filteredVolunteers.map((vol) => {
                  const initials = vol.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  const statusColor =
                    vol.status === 'AVAILABLE'
                      ? '#2E9E6B'
                      : vol.status === 'BUSY'
                      ? '#E8A317'
                      : '#8B8B94';

                  const statusText =
                    vol.status === 'AVAILABLE'
                      ? 'Ready'
                      : vol.status === 'BUSY'
                      ? 'Busy'
                      : 'Off duty';

                  return (
                    <tr key={vol.id} className="h-14 hover:bg-[#1A1A1D] transition-colors">
                      {/* Volunteer (initials circle + name 15 medium + org 13 secondary) */}
                      <td className="px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#26262A] text-white flex items-center justify-center font-semibold text-[13px] shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="text-[15px] font-medium text-white">{vol.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[13px] text-[#8B8B94]">{vol.ngo || 'Independent Responder'}</span>
                              {vol.verificationTier === 'AUTHORITY' ? (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  Authority
                                </span>
                              ) : vol.verificationTier === 'ORG_VERIFIED' ? (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Org Verified
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                                  Civic
                                </span>
                              )}
                              {vol.ngoCode && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 font-mono text-[10px] border border-emerald-500/30 font-bold tracking-wider">
                                  Code: {vol.ngoCode}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status (dot + "Ready / Busy / Off duty") - Read-only (controlled by volunteer) */}
                      <td className="px-4">
                        <div className="flex items-center gap-2 px-2 py-1 text-left">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
                          <span className="text-[13px] text-white font-medium">{statusText}</span>
                        </div>
                      </td>

                      {/* Station (place 15, "Kolkata - Park Street" 13 secondary) */}
                      <td className="px-4">
                        <div className="text-[15px] text-white">{vol.locationName}</div>
                      </td>

                      {/* Skills (max 3 plain gray chips 13px sentence case + "+N") */}
                      <td className="px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {vol.skills.slice(0, 3).map((sk) => {
                            const match = AVAILABLE_SKILLS.find((s) => s.id === sk);
                            return (
                              <span
                                key={sk}
                                className="px-2 py-0.5 rounded-[4px] bg-[#26262A] text-white text-[13px]"
                              >
                                {match?.label || sk}
                              </span>
                            );
                          })}
                          {vol.skills.length > 3 && (
                            <span className="px-1.5 py-0.5 text-[11px] text-[#8B8B94] tabular-nums">
                              +{vol.skills.length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Languages */}
                      <td className="px-4 text-[#8B8B94]">
                        {vol.preferredLanguage || 'English'}
                      </td>

                      {/* Reliability */}
                      <td className="px-4 text-white font-medium tabular-nums">
                        {vol.reliabilityRate !== undefined && vol.reliabilityRate > 0
                          ? `${(vol.reliabilityRate * 100).toFixed(0)}%`
                          : 'New'}
                      </td>

                      {/* Load */}
                      <td className="px-4 text-[#8B8B94] tabular-nums">
                        {vol.hoursLast30Days || 0}/20h
                      </td>

                      {/* Actions: [Dispatch] secondary button + kebab */}
                      <td className="px-4 text-right">
                        <div className="inline-flex items-center gap-2 relative">
                          <button
                            type="button"
                            onClick={() => alert(`Assigned ${vol.name} to dispatch pool.`)}
                            className="h-8 px-3 bg-[#1A1A1D] hover:bg-[#26262A] border border-[#26262A] text-white text-[13px] font-medium rounded-[6px] transition-colors"
                          >
                            Dispatch
                          </button>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenKebabId(openKebabId === vol.id ? null : vol.id)}
                              className="p-1.5 text-[#8B8B94] hover:text-white rounded-[6px] transition-colors"
                            >
                              <EllipsisVerticalIcon className="w-5 h-5" />
                            </button>

                            {openKebabId === vol.id && (
                              <div className="absolute right-0 top-full mt-1 w-36 bg-[#141416] border border-[#26262A] rounded-[8px] shadow-2xl p-1 z-30 text-[13px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenKebabId(null);
                                    alert(`Station coords: ${vol.locationCoords.lat}, ${vol.locationCoords.lng}`);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-[#F2F2F3] hover:bg-[#1A1A1D] rounded-[6px]"
                                >
                                  View on map
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenKebabId(null);
                                    handleRemoveVolunteer(vol.id, vol.name);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-[#E5383B] hover:bg-[#1A1A1D] rounded-[6px]"
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3-STEP REGISTRATION MODAL (560px dark-themed modal using admin tokens) */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-[2000] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#26262A] rounded-[10px] max-w-[560px] w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#26262A] pb-3">
              <div>
                <span className="text-[13px] text-[#8B8B94]">Step {regStep} of 3</span>
                <h3 className="text-[20px] font-semibold text-white mt-0.5">
                  {regStep === 1 && 'Personal details'}
                  {regStep === 2 && 'Emergency capabilities'}
                  {regStep === 3 && 'Station location'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="text-[#8B8B94] hover:text-white p-1"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* STEP 1: You */}
            {regStep === 1 && (
              <div className="space-y-4 text-[13px]">
                <div>
                  <label className="block text-[#8B8B94] font-medium mb-1">Full name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patel"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full h-10 bg-[#0E0E10] border border-[#26262A] rounded-[8px] px-3 text-white focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="block text-[#8B8B94] font-medium mb-1">Organization *</label>
                  <select
                    value={regNgo}
                    onChange={(e) => setRegNgo(e.target.value)}
                    className="w-full h-10 bg-[#0E0E10] border border-[#26262A] rounded-[8px] px-3 text-white focus:outline-none"
                  >
                    {orgList.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#8B8B94] font-medium mb-1">Email ID</label>
                  <input
                    type="email"
                    placeholder="volunteer@agency.org"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full h-10 bg-[#0E0E10] border border-[#26262A] rounded-[8px] px-3 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#8B8B94] font-medium mb-1">Contact phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full h-10 bg-[#0E0E10] border border-[#26262A] rounded-[8px] px-3 text-white focus:outline-none tabular-nums"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!regName.trim()) {
                        alert('Please enter full name.');
                        return;
                      }
                      setRegStep(2);
                    }}
                    className="h-10 px-5 bg-white hover:bg-zinc-200 text-black font-semibold rounded-[8px] text-[13px] transition-colors"
                  >
                    Continue to skills
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Skills */}
            {regStep === 2 && (
              <div className="space-y-4 text-[13px]">
                <p className="text-[#8B8B94]">Select capabilities for incident dispatch:</p>

                <div className="space-y-2">
                  {AVAILABLE_SKILLS.map((sk) => {
                    const selected = regSkills.includes(sk.id);
                    return (
                      <button
                        type="button"
                        key={sk.id}
                        onClick={() => {
                          setRegSkills((prev) =>
                            selected ? prev.filter((s) => s !== sk.id) : [...prev, sk.id]
                          );
                        }}
                        className={`w-full p-3 rounded-[8px] border text-left transition-colors ${
                          selected
                            ? 'border-white bg-[#1A1A1D] text-white'
                            : 'border-[#26262A] bg-[#0E0E10] text-[#8B8B94] hover:border-zinc-600'
                        }`}
                      >
                        <span className="font-medium text-[15px]">{sk.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRegStep(1)}
                    className="h-10 px-4 border border-[#26262A] text-[#8B8B94] hover:text-white rounded-[8px]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegStep(3)}
                    className="h-10 px-5 bg-white hover:bg-zinc-200 text-black font-semibold rounded-[8px] text-[13px] transition-colors"
                  >
                    Continue to location
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Location */}
            {regStep === 3 && (
              <div className="space-y-4 text-[13px]">
                <div>
                  <span className="text-[#8B8B94] block mb-2">Select dispatch station hub:</span>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {ANCHOR_PRESETS.map((loc) => {
                      const isSelected = regLocationName === loc.name;
                      return (
                        <button
                          type="button"
                          key={loc.name}
                          onClick={() => {
                            setRegLocationName(loc.name);
                            setRegLat(loc.lat);
                            setRegLng(loc.lng);
                          }}
                          className={`p-2.5 rounded-[8px] border text-left transition-colors ${
                            isSelected
                              ? 'border-white bg-[#1A1A1D] text-white'
                              : 'border-[#26262A] bg-[#0E0E10] text-[#8B8B94] hover:text-white'
                          }`}
                        >
                          <span className="font-medium text-[13px] block truncate">{loc.name}</span>
                          <span className="text-[11px] text-[#8B8B94] tabular-nums">
                            {loc.lat.toFixed(2)}, {loc.lng.toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#26262A]">
                  <button
                    type="button"
                    onClick={() => setRegStep(2)}
                    className="h-10 px-4 border border-[#26262A] text-[#8B8B94] hover:text-white rounded-[8px]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleRegisterSubmit}
                    disabled={isSubmitting}
                    className="h-10 px-5 bg-white hover:bg-zinc-200 text-black font-semibold rounded-[8px] text-[13px] transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Registering...' : 'Register volunteer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
