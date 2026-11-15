import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import type { VolunteerProfile, NeedEntity } from '../types';
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  FunnelIcon,
  UserPlusIcon,
  ShieldCheckIcon,
  PhoneIcon,
  EnvelopeIcon,
  TrashIcon,
  ArrowPathIcon,
  BuildingOffice2Icon,
  ArrowTopRightOnSquareIcon,
  XMarkIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
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

const NGO_LIST = [
  'Red Cross Society India',
  'Goonj Relief Force',
  'SEEDS India Disaster Response',
  'NDRF Auxiliary Volunteers',
  'Doctors Without Borders (MSF)',
  'Robin Hood Army',
  'Civil Defense Corps',
  'Independent Civic Responder'
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

const AVATAR_COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4"];

export default function VolunteersPage() {
  const navigate = useNavigate();

  // State
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [needs, setNeeds] = useState<NeedEntity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [ngoFilter, setNgoFilter] = useState<string>('ALL');
  const [skillFilter, setSkillFilter] = useState<string>('ALL');

  // Radius Filter State
  const [radiusFilterEnabled, setRadiusFilterEnabled] = useState<boolean>(false);
  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number>(15);
  const [anchorName, setAnchorName] = useState<string>('Mumbai - Dharavi Hub');
  const [anchorLat, setAnchorLat] = useState<number>(19.0422);
  const [anchorLng, setAnchorLng] = useState<number>(72.8538);
  const [isAdminGpsLoading, setIsAdminGpsLoading] = useState<boolean>(false);

  // Admin Registration Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newNgo, setNewNgo] = useState<string>('Red Cross Society India');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newLanguage, setNewLanguage] = useState<string>('Hindi');
  const [newLocationName, setNewLocationName] = useState<string>('Mumbai - Dharavi');
  const [newLat, setNewLat] = useState<number>(19.0422);
  const [newLng, setNewLng] = useState<number>(72.8538);
  const [newSkills, setNewSkills] = useState<string[]>(['medical', 'first aid']);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);

  // Fetch Live Data (no static hardcoded volunteer data!)
  const fetchVolunteersAndNeeds = async () => {
    setIsLoading(true);
    try {
      const [volRes, needsRes] = await Promise.all([
        axios.get(`${API_BASE}/volunteers`),
        axios.get(`${API_BASE}/needs`).catch(() => ({ data: [] }))
      ]);
      setVolunteers(Array.isArray(volRes.data) ? volRes.data : []);
      setNeeds(Array.isArray(needsRes.data) ? needsRes.data : []);
    } catch (err) {
      console.warn('Failed to fetch from backend:', err);
      setVolunteers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVolunteersAndNeeds();
  }, []);

  // Quick Seed Verified NGO Teams
  const handleSeedNgoTeams = async () => {
    try {
      setIsLoading(true);
      await axios.post(`${API_BASE}/volunteers/seed`);
      await fetchVolunteersAndNeeds();
    } catch (err) {
      alert('Failed to load verified NGO responders.');
      setIsLoading(false);
    }
  };

  // Clear All Volunteers
  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all registered volunteers for a fresh test?')) return;
    try {
      setIsLoading(true);
      await axios.delete(`${API_BASE}/volunteers`);
      setVolunteers([]);
    } catch (err) {
      alert('Failed to clear volunteers.');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Individual Volunteer
  const handleDeleteVolunteer = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remove this volunteer from the network?')) return;
    try {
      await axios.delete(`${API_BASE}/volunteers/${id}`);
      setVolunteers(prev => prev.filter(v => v.id !== id));
    } catch (err) {
      alert('Failed to remove volunteer.');
    }
  };

  // Admin GPS auto-detect for radius anchor
  const handleDetectAdminGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsAdminGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lng = Number(pos.coords.longitude.toFixed(4));
        setAnchorLat(lat);
        setAnchorLng(lng);
        setAnchorName(`Admin GPS Center (${lat}, ${lng})`);
        setRadiusFilterEnabled(true);
        setIsAdminGpsLoading(false);
      },
      err => {
        setIsAdminGpsLoading(false);
        alert('Could not acquire GPS coordinates.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Add Volunteer Form Submit
  const handleAddVolunteerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsRegistering(true);
    try {
      const payload = {
        name: newName.trim(),
        ngo: newNgo.trim(),
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
        preferredLanguage: newLanguage,
        skills: newSkills.length > 0 ? newSkills : ['general rescue'],
        locationCoords: { lat: newLat, lng: newLng },
        locationName: newLocationName.trim() || 'Assigned Sector'
      };

      const res = await axios.post(`${API_BASE}/volunteers`, payload);
      setVolunteers(prev => [res.data.volunteer, ...prev]);
      setShowAddModal(false);
      // Reset form
      setNewName('');
      setNewPhone('');
      setNewEmail('');
    } catch (err) {
      alert('Failed to register volunteer.');
    } finally {
      setIsRegistering(false);
    }
  };

  // Compute Filtered and Distance-Scored Volunteers
  const filteredVolunteers = useMemo(() => {
    return volunteers
      .map(v => {
        const distanceKm =
          v.locationCoords && typeof v.locationCoords.lat === 'number'
            ? haversineDistance(anchorLat, anchorLng, v.locationCoords.lat, v.locationCoords.lng)
            : 99999;
        return { ...v, distanceKm };
      })
      .filter(v => {
        // Radius check
        if (radiusFilterEnabled && v.distanceKm > selectedRadiusKm) {
          return false;
        }

        // Status check
        if (statusFilter !== 'ALL') {
          if (v.status.toUpperCase() !== statusFilter) return false;
        }

        // NGO check
        if (ngoFilter !== 'ALL') {
          const ngoName = v.ngo || 'Independent Civic Responder';
          if (!ngoName.toLowerCase().includes(ngoFilter.toLowerCase())) return false;
        }

        // Skill check
        if (skillFilter !== 'ALL') {
          if (!v.skills.some(s => s.toLowerCase().includes(skillFilter.toLowerCase()))) return false;
        }

        // Search text check
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchName = v.name.toLowerCase().includes(q);
          const matchNgo = (v.ngo || '').toLowerCase().includes(q);
          const matchLoc = (v.locationName || '').toLowerCase().includes(q);
          const matchSkills = v.skills.some(s => s.toLowerCase().includes(q));
          if (!matchName && !matchNgo && !matchLoc && !matchSkills) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (radiusFilterEnabled) {
          return a.distanceKm - b.distanceKm;
        }
        return (b.registeredAt || 0) - (a.registeredAt || 0);
      });
  }, [volunteers, radiusFilterEnabled, selectedRadiusKm, anchorLat, anchorLng, statusFilter, ngoFilter, skillFilter, search]);

  const getInitials = (name: string) => {
    const parts = name.replace(/\([^)]*\)/g, '').trim().split(' ');
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="h-full bg-transparent p-6 overflow-y-auto custom-scrollbar space-y-6">
      {/* Top Header & Metrics */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Registered Volunteer Corps</h1>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">
              {volunteers.length} Active in Network
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Verified NGO responders & civic volunteers with exact geolocation telemetry & radius geofencing
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5"
          >
            <UserPlusIcon className="w-4 h-4" />
            ➕ Register Volunteer
          </button>

          <a
            href="/volunteer"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <span>📱</span> Volunteer Portal
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
          </a>

          {volunteers.length === 0 && (
            <button
              onClick={handleSeedNgoTeams}
              className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
            >
              <BuildingOffice2Icon className="w-4 h-4" />
              ⚡ Load Verified NGO Teams
            </button>
          )}

          {volunteers.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-2.5 py-2 bg-gray-800 hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 border border-gray-700 hover:border-rose-500/30 rounded-xl text-xs transition-colors"
              title="Clear all registered volunteers for a clean demo"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={fetchVolunteersAndNeeds}
            disabled={isLoading}
            className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl border border-gray-700 transition-colors"
            title="Refresh roster"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* RADIUS GEOFENCE FILTER HUD */}
      <div className="bg-[#161B22] border border-gray-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800/80 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <MapPinIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Radius Geofence Filter
              </h3>
              <p className="text-[11px] text-gray-400">
                Filter and rank volunteers within specific distance of an emergency incident or city anchor
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setRadiusFilterEnabled(!radiusFilterEnabled)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                radiusFilterEnabled
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                  : 'bg-gray-800/80 text-gray-400 border-gray-700 hover:text-gray-200'
              }`}
            >
              {radiusFilterEnabled ? '✓ Radius Filter ACTIVE' : 'Enable Radius Filter'}
            </button>
            <button
              onClick={handleDetectAdminGps}
              disabled={isAdminGpsLoading}
              className="px-2.5 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-semibold flex items-center gap-1"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${isAdminGpsLoading ? 'animate-spin' : ''}`} />
              {isAdminGpsLoading ? 'Detecting...' : 'Use My GPS'}
            </button>
          </div>
        </div>

        {/* Controls when radius filter is active or configured */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
          {/* Anchor Selector */}
          <div>
            <label className="text-gray-400 font-semibold block mb-1">Anchor Location / Disaster Epicenter</label>
            <select
              value={anchorName}
              onChange={e => {
                const found = ANCHOR_PRESETS.find(p => p.name === e.target.value);
                if (found) {
                  setAnchorName(found.name);
                  setAnchorLat(found.lat);
                  setAnchorLng(found.lng);
                  setRadiusFilterEnabled(true);
                } else {
                  setAnchorName(e.target.value);
                }
              }}
              className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-xs"
            >
              <optgroup label="Active Crisis Incident Locations">
                {needs
                  .filter(n => n.status !== 'RESOLVED' && n.location?.lat)
                  .map(n => (
                    <option key={n.id} value={`Incident: ${n.location.name}`}>
                      🚨 {n.crisisType.toUpperCase()}: {n.location.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Disaster Response Hubs">
                {ANCHOR_PRESETS.map(p => (
                  <option key={p.name} value={p.name}>
                    📍 {p.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Radius Selector */}
          <div>
            <label className="text-gray-400 font-semibold block mb-1">
              Geofence Radius: <span className="text-indigo-400 font-bold font-mono">{selectedRadiusKm} km</span>
            </label>
            <div className="flex bg-[#0d1117] p-1 rounded-xl border border-gray-700">
              {[5, 15, 30, 75, 150].map(r => (
                <button
                  key={r}
                  onClick={() => {
                    setSelectedRadiusKm(r);
                    setRadiusFilterEnabled(true);
                  }}
                  className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedRadiusKm === r && radiusFilterEnabled
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {r}km
                </button>
              ))}
            </div>
          </div>

          {/* Active Status Display */}
          <div className="bg-[#0d1117] rounded-xl p-2.5 border border-gray-800 flex flex-col justify-center">
            <span className="text-[10px] text-gray-400 uppercase font-bold">Filtered Results</span>
            <div className="text-sm font-bold text-gray-200 mt-0.5">
              {radiusFilterEnabled ? (
                <span>
                  <strong className="text-emerald-400">{filteredVolunteers.length}</strong> volunteers within{' '}
                  <strong className="text-indigo-400">{selectedRadiusKm} km</strong> of {anchorName.replace('Incident: ', '')}
                </span>
              ) : (
                <span>Showing all {filteredVolunteers.length} registered volunteers nationwide</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FILTER BAR: Search, NGO, Status, Skills */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by volunteer name, NGO, exact area, or skill..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#161B22] border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* NGO Filter */}
        <div className="flex items-center space-x-1.5 text-xs">
          <span className="text-gray-400 font-semibold text-[11px] whitespace-nowrap">NGO:</span>
          <select
            value={ngoFilter}
            onChange={e => setNgoFilter(e.target.value)}
            className="bg-[#161B22] border border-gray-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All NGOs & Affiliations</option>
            {NGO_LIST.map(ngo => (
              <option key={ngo} value={ngo}>
                {ngo}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-1.5 text-xs">
          <span className="text-gray-400 font-semibold text-[11px] whitespace-nowrap">Status:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#161B22] border border-gray-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="AVAILABLE">🟢 Available Only</option>
            <option value="BUSY">🟡 Busy</option>
            <option value="OFF_DUTY">⚪ Off Duty</option>
          </select>
        </div>
      </div>

      {/* VOLUNTEER LIST */}
      {filteredVolunteers.length === 0 ? (
        <div className="bg-[#161B22] border border-gray-800 rounded-3xl p-12 text-center space-y-4 max-w-xl mx-auto shadow-xl">
          <div className="w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
            <BuildingOffice2Icon className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">No Volunteers Found in This Scope</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              {radiusFilterEnabled
                ? `No registered responders found within ${selectedRadiusKm} km of ${anchorName}. Expand your radius or register volunteers in this sector.`
                : 'No registered volunteers exist in the database yet. You can register volunteers on the portal or load verified NGO emergency response teams.'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              <UserPlusIcon className="w-4 h-4" /> Register New Volunteer
            </button>
            <button
              onClick={handleSeedNgoTeams}
              className="px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all"
            >
              ⚡ Load Verified NGO Teams
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-16">
          {filteredVolunteers.map((v, idx) => {
            const mapsUrl = `https://www.google.com/maps?q=${v.locationCoords.lat},${v.locationCoords.lng}`;
            const ngoName = v.ngo || 'Independent Civic Responder';
            const dist = (v as unknown as { distanceKm: number }).distanceKm;

            return (
              <div
                key={v.id || idx}
                className="bg-[#161B22] border border-gray-800 hover:border-indigo-500/50 rounded-2xl p-5 transition-all shadow-lg flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Avatar, Name, NGO, Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start space-x-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow flex-shrink-0"
                        style={{ backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}
                      >
                        {getInitials(v.name)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm group-hover:text-indigo-400 transition-colors truncate">
                          {v.name}
                        </h3>
                        {/* NGO Badge */}
                        <div className="flex items-center text-[11px] font-semibold text-indigo-300 mt-0.5 truncate">
                          <BuildingOffice2Icon className="w-3.5 h-3.5 mr-1 text-indigo-400 flex-shrink-0" />
                          <span className="truncate">{ngoName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
                        v.status === 'AVAILABLE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : v.status === 'BUSY'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-gray-700/30 text-gray-400 border border-gray-700'
                      }`}
                    >
                      {v.status === 'AVAILABLE' ? '🟢 Ready' : v.status === 'BUSY' ? '🟡 Busy' : '⚪ Off'}
                    </div>
                  </div>

                  {/* EXACT LOCATION CARD */}
                  <div className="bg-[#0d1117] rounded-xl p-3 border border-gray-800/80 mb-3 space-y-1">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-1.5 min-w-0">
                        <MapPinIcon className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-gray-200 leading-tight">
                            {v.locationName || 'Assigned Station'}
                          </p>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                            Lat: {v.locationCoords.lat.toFixed(4)}, Lng: {v.locationCoords.lng.toFixed(4)}
                          </p>
                        </div>
                      </div>

                      {/* External Map Link */}
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 p-1 hover:bg-gray-800 rounded transition-colors"
                        title="View exact coordinates on Google Maps"
                      >
                        Map <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Proximity Distance Badge */}
                    {radiusFilterEnabled && dist < 9999 && (
                      <div className="pt-1.5 border-t border-gray-800/80 flex items-center justify-between text-[11px]">
                        <span className="text-gray-400">Distance from anchor:</span>
                        <span className="font-bold text-emerald-400 font-mono">
                          📍 {dist.toFixed(1)} km away
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Contact Details */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-300 mb-3">
                    {v.phone && (
                      <a
                        href={`tel:${v.phone}`}
                        className="flex items-center gap-1 text-gray-300 hover:text-indigo-400 transition-colors"
                      >
                        <PhoneIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span>{v.phone}</span>
                      </a>
                    )}
                    {v.email && (
                      <a
                        href={`mailto:${v.email}`}
                        className="flex items-center gap-1 text-gray-300 hover:text-indigo-400 transition-colors truncate max-w-[170px]"
                      >
                        <EnvelopeIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{v.email}</span>
                      </a>
                    )}
                  </div>

                  {/* Skills Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {v.skills.map((skill, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[10px] font-bold uppercase tracking-wider"
                      >
                        {skill}
                      </span>
                    ))}
                    {v.preferredLanguage && (
                      <span className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-[10px]">
                        🗣️ {v.preferredLanguage}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Card Footer: Reliability & Dispatch */}
                <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between">
                  <div className="text-[11px] text-gray-400 font-mono">
                    <span className="text-yellow-500 mr-1">★</span>
                    {(v.reliabilityRate * 100).toFixed(0)}% Reliability
                    <span className="text-gray-600 mx-1.5">•</span>
                    {v.hoursLast30Days}/20h
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => navigate('/')}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1"
                    >
                      Dispatch →
                    </button>
                    <button
                      onClick={e => handleDeleteVolunteer(v.id, e)}
                      className="p-1.5 text-gray-500 hover:text-rose-400 rounded-lg hover:bg-gray-800 transition-colors"
                      title="Remove volunteer"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADMIN REGISTRATION MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-gray-700 rounded-3xl max-w-md w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl space-y-4 custom-scrollbar">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlusIcon className="w-5 h-5 text-indigo-400" />
                Register New Volunteer
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddVolunteerSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-gray-300 font-bold block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-gray-300 font-bold block mb-1">Affiliated NGO / Organization *</label>
                <select
                  value={newNgo}
                  onChange={e => setNewNgo(e.target.value)}
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  {NGO_LIST.map(ngo => (
                    <option key={ngo} value={ngo}>
                      {ngo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-300 font-bold block mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-gray-300 font-bold block mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="responder@ngo.org"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Exact Location */}
              <div className="bg-[#0d1117] p-3 rounded-xl border border-gray-700 space-y-2">
                <label className="text-gray-200 font-bold flex items-center gap-1">
                  <MapPinIcon className="w-3.5 h-3.5 text-rose-500" />
                  Exact Station & Coordinates *
                </label>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-0.5">Landmark / Sector Name</label>
                  <input
                    type="text"
                    required
                    value={newLocationName}
                    onChange={e => setNewLocationName(e.target.value)}
                    placeholder="e.g. Mumbai - Dharavi Sector 4"
                    className="w-full bg-[#161B22] border border-gray-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={newLat}
                      onChange={e => setNewLat(Number(e.target.value))}
                      className="w-full bg-[#161B22] border border-gray-700 rounded-lg px-2 py-1 text-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={newLng}
                      onChange={e => setNewLng(Number(e.target.value))}
                      className="w-full bg-[#161B22] border border-gray-700 rounded-lg px-2 py-1 text-white text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow flex items-center justify-center gap-1.5"
              >
                <CheckCircleIcon className="w-4 h-4" />
                {isRegistering ? 'Registering...' : 'Save Volunteer to Network'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
