import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import type { NeedEntity, VolunteerProfile } from './types';
import {
  CheckCircleIcon,
  MapPinIcon,
  BellAlertIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowPathIcon,
  XMarkIcon,
  UserCircleIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  PhoneIcon,
  BoltIcon,
  ArrowLeftIcon,
  FunnelIcon,
  SignalIcon
} from '@heroicons/react/24/outline';
import { BellIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { formatDistanceToNow } from 'date-fns';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const STORAGE_KEY = 'communitypulse_volunteer_profile';

// Haversine distance in kilometers
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

const PRESET_LOCATIONS = [
  { name: 'Mumbai - Andheri', lat: 19.1136, lng: 72.8697 },
  { name: 'Mumbai - Dharavi', lat: 19.0422, lng: 72.8538 },
  { name: 'Mumbai - Bandra', lat: 19.0596, lng: 72.8295 },
  { name: 'Delhi - Connaught Place', lat: 28.6315, lng: 77.2167 },
  { name: 'Delhi - Chandni Chowk', lat: 28.6506, lng: 77.2300 },
  { name: 'Bengaluru - Indiranagar', lat: 12.9784, lng: 77.6408 },
  { name: 'Chennai - T Nagar', lat: 13.0405, lng: 80.2337 },
  { name: 'Kolkata - Park Street', lat: 22.5487, lng: 88.3522 },
  { name: 'Hyderabad - Hitech City', lat: 17.4483, lng: 78.3915 },
  { name: 'Pune - Shivajinagar', lat: 18.5314, lng: 73.8446 },
  { name: 'Jaipur - C Scheme', lat: 26.9124, lng: 75.7873 },
  { name: 'Ahmedabad - SG Highway', lat: 23.0525, lng: 72.5328 },
];

const AVAILABLE_SKILLS = [
  { id: 'medical', label: '🚑 Medical & First Aid', desc: 'Triage, emergency care, wound dressing' },
  { id: 'water', label: '🌊 Water & Flood Rescue', desc: 'Boat rescue, water extraction, drainage' },
  { id: 'fire', label: '🔥 Fire Emergency Response', desc: 'Evacuation assistance, perimeter control' },
  { id: 'food', label: '🍱 Food & Ration Logistics', desc: 'Meal distribution, supply chain, dry ration' },
  { id: 'infrastructure', label: '🏗️ Infrastructure & Debris', desc: 'Structural check, clearance, transport' },
  { id: 'shelter', label: '🤝 Shelter & Evacuation', desc: 'Displaced families, camp setup, hygiene' }
];

const LANGUAGES = [
  'English',
  'Hindi (हिंदी)',
  'Marathi (मराठी)',
  'Tamil (தமிழ்)',
  'Bengali (বাংলা)',
  'Telugu (తెలుగు)',
  'Gujarati (ગુજરાતી)',
  'Kannada (ಕನ್ನಡ)'
];

interface SosAlertEvent {
  need: NeedEntity;
  distanceKm: number;
  receivedAt: number;
  read: boolean;
}

export default function VolunteerApp() {
  // Volunteer state
  const [volunteer, setVolunteer] = useState<VolunteerProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // UI state
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [selectedFilter, setSelectedFilter] = useState<'nearby' | 'critical' | 'all'>('nearby');
  const [maxRadiusKm, setMaxRadiusKm] = useState<number>(15);

  // Registration Form State
  const [regName, setRegName] = useState<string>('');
  const [regNgo, setRegNgo] = useState<string>('Red Cross Society India');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regLanguage, setRegLanguage] = useState<string>('English');
  const [regSkills, setRegSkills] = useState<string[]>(['medical', 'water']);
  const [regLocationName, setRegLocationName] = useState<string>('Mumbai - Dharavi');
  const [regLat, setRegLat] = useState<number>(19.0422);
  const [regLng, setRegLng] = useState<number>(72.8538);
  const [isGpsLoading, setIsGpsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Live Needs & SOS Alerts
  const [needs, setNeeds] = useState<NeedEntity[]>([]);
  const [sosAlerts, setSosAlerts] = useState<SosAlertEvent[]>([]);
  const [activeBannerAlert, setActiveBannerAlert] = useState<SosAlertEvent | null>(null);
  const [respondingNeedIds, setRespondingNeedIds] = useState<Set<string>>(new Set());

  // Track known needs to trigger alerts on fresh/escalated needs
  const knownNeedIdsRef = useRef<Map<string, number>>(new Map()); // id -> reportCount
  const isInitialLoadRef = useRef<boolean>(true);

  // Web Audio Synthesizer for Emergency Chime (zero external audio file dependency)
  const playEmergencyChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Urgent two-tone chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(1174.66, now + 0.12); // D6
      osc.frequency.setValueAtTime(1760, now + 0.24); // A6

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.start(now);
      osc.stop(now + 0.55);
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }, [soundEnabled]);

  // Request HTML5 Desktop Notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Save volunteer profile updates
  const saveVolunteer = (updated: VolunteerProfile) => {
    setVolunteer(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  // Open Registration modal if no profile exists on first load
  useEffect(() => {
    if (!volunteer) {
      setShowRegisterModal(true);
    }
  }, [volunteer]);

  // GPS Auto-detect handler
  const handleDetectGPS = (forRegistration: boolean = true) => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lng = Number(pos.coords.longitude.toFixed(4));
        const locationName = `GPS Location (${lat}, ${lng})`;

        if (forRegistration) {
          setRegLat(lat);
          setRegLng(lng);
          setRegLocationName(locationName);
        } else if (volunteer) {
          handleUpdateLocation(lat, lng, locationName);
        }
        setIsGpsLoading(false);
      },
      (err) => {
        setIsGpsLoading(false);
        console.warn('GPS location error:', err);
        alert('Could not acquire GPS coordinates. Please select a city preset or enter manually.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle Volunteer Registration Submission
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      alert('Please enter your full name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: regName.trim(),
        ngo: regNgo.trim(),
        phone: regPhone.trim() || undefined,
        email: regEmail.trim() || undefined,
        preferredLanguage: regLanguage,
        skills: regSkills.length > 0 ? regSkills : ['general rescue'],
        locationCoords: { lat: regLat, lng: regLng },
        locationName: regLocationName || 'Custom Station'
      };

      const res = await axios.post(`${API_BASE}/volunteers`, payload);
      const newVol = res.data.volunteer;
      saveVolunteer(newVol);
      setShowRegisterModal(false);
      setIsSubmitting(false);

      // Play chime to confirm activation
      playEmergencyChime();
    } catch (err: unknown) {
      console.warn('Backend registration failed, falling back to local storage profile:', err);
      // Fallback local registration if backend is offline
      const fallbackVol: VolunteerProfile = {
        id: crypto.randomUUID(),
        name: regName.trim(),
        ngo: regNgo.trim(),
        phone: regPhone.trim() || undefined,
        email: regEmail.trim() || undefined,
        preferredLanguage: regLanguage,
        skills: regSkills.length > 0 ? regSkills : ['general rescue'],
        locationCoords: { lat: regLat, lng: regLng },
        locationName: regLocationName || 'Custom Station',
        reliabilityRate: 0.98,
        status: 'AVAILABLE',
        hoursLast30Days: 0,
        pastContributions: ['Registered in CommunityPulse Network'],
        registeredAt: Date.now()
      };
      saveVolunteer(fallbackVol);
      setShowRegisterModal(false);
      setIsSubmitting(false);
    }
  };

  // Update existing volunteer location
  const handleUpdateLocation = async (lat: number, lng: number, name: string) => {
    if (!volunteer) return;
    const updated: VolunteerProfile = {
      ...volunteer,
      locationCoords: { lat, lng },
      locationName: name
    };
    saveVolunteer(updated);
    setShowLocationModal(false);

    try {
      await axios.patch(`${API_BASE}/volunteers/${volunteer.id}`, {
        locationCoords: { lat, lng },
        locationName: name
      });
    } catch (err) {
      console.warn('Backend location update skipped (offline/demo mode):', err);
    }
  };

  // Update status (Available / Busy / Off Duty)
  const handleToggleStatus = async (newStatus: 'AVAILABLE' | 'BUSY' | 'OFF_DUTY') => {
    if (!volunteer) return;
    const updated: VolunteerProfile = { ...volunteer, status: newStatus };
    saveVolunteer(updated);

    try {
      await axios.patch(`${API_BASE}/volunteers/${volunteer.id}`, { status: newStatus });
    } catch (err) {
      console.warn('Backend status update skipped:', err);
    }
  };

  // Polling for Needs and SOS detection
  useEffect(() => {
    let isMounted = true;

    const fetchNeeds = async () => {
      try {
        const response = await axios.get(`${API_BASE}/needs`);
        if (!isMounted) return;

        const allNeeds: NeedEntity[] = response.data || [];
        const activeNeeds = allNeeds.filter((n) => n.status !== 'RESOLVED');
        setNeeds(activeNeeds);

        // Sync responding IDs from backend
        if (volunteer) {
          const myActiveResponding = activeNeeds
            .filter(n => n.enRouteVolunteers?.some(r => r.id === volunteer.id))
            .map(n => n.id);
          if (myActiveResponding.length > 0) {
            setRespondingNeedIds(new Set(myActiveResponding));
          }
        }

        // Analyze for new or escalated SOS signals
        if (volunteer && activeNeeds.length > 0) {
          const volLat = volunteer.locationCoords.lat;
          const volLng = volunteer.locationCoords.lng;

          activeNeeds.forEach((need) => {
            if (!need.location || typeof need.location.lat !== 'number') return;

            const prevReportCount = knownNeedIdsRef.current.get(need.id);
            const isBrandNew = prevReportCount === undefined;
            const hasEscalated = prevReportCount !== undefined && need.reportCount > prevReportCount;

            // Update known tracking
            knownNeedIdsRef.current.set(need.id, need.reportCount);

            // Skip alerting during first mount load to avoid blast of old needs
            if (isInitialLoadRef.current) return;

            if (isBrandNew || hasEscalated) {
              const distanceKm = haversineDistance(volLat, volLng, need.location.lat, need.location.lng);

              // Notify if within volunteer range (or if high criticality)
              if (distanceKm <= maxRadiusKm || need.criticalityScore >= 80) {
                const alertEvent: SosAlertEvent = {
                  need,
                  distanceKm,
                  receivedAt: Date.now(),
                  read: false
                };

                // Add to alerts list
                setSosAlerts((prev) => [alertEvent, ...prev.slice(0, 24)]);
                setActiveBannerAlert(alertEvent);

                // Play sound
                playEmergencyChime();

                // Trigger browser notification
                if ('Notification' in window && Notification.permission === 'granted') {
                  try {
                    new Notification(`🚨 SOS Alert: ${need.crisisType.toUpperCase()}`, {
                      body: `${need.location.name} (~${distanceKm.toFixed(1)} km away). Affecting ~${need.estimatedScale} people.`,
                      icon: '/favicon.ico'
                    });
                  } catch {
                    /* ignore */
                  }
                }
              }
            }
          });
        }

        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
        }
      } catch (err) {
        console.warn('Error fetching live needs for volunteer portal:', err);
      }
    };

    fetchNeeds();
    const interval = setInterval(fetchNeeds, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [volunteer, maxRadiusKm, playEmergencyChime]);

  // Mark task resolved
  const handleResolve = async (id: string) => {
    try {
      await axios.post(`${API_BASE}/needs/${id}/resolve`);
      setNeeds((prev) => prev.filter((n) => n.id !== id));
      setRespondingNeedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      // Clear banner if this need was active
      if (activeBannerAlert?.need.id === id) {
        setActiveBannerAlert(null);
      }
    } catch (e) {
      console.warn('Resolving need failed, updating locally:', e);
      setNeeds((prev) => prev.filter((n) => n.id !== id));
    }
  };

  // Toggle Responding Mission
  const handleAcceptMission = async (id: string) => {
    const isCurrentlyResponding = respondingNeedIds.has(id);
    try {
      if (isCurrentlyResponding) {
        await axios.post(`${API_BASE}/needs/${id}/cancel-respond`, {
          volunteerId: volunteer?.id
        });
        setRespondingNeedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        await axios.post(`${API_BASE}/needs/${id}/respond`, {
          volunteerId: volunteer?.id,
          name: volunteer?.name,
          ngo: volunteer?.ngo,
          phone: volunteer?.phone
        });
        setRespondingNeedIds(prev => new Set(prev).add(id));
      }
      if (activeBannerAlert?.need.id === id) {
        setActiveBannerAlert(null);
      }
    } catch (err) {
      console.warn('Backend respond update error, toggling state locally:', err);
      setRespondingNeedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };

  // Calculate distances and filter needs
  const computedNeeds = useMemo(() => {
    if (!volunteer) return [];
    const volLat = volunteer.locationCoords.lat;
    const volLng = volunteer.locationCoords.lng;

    const listWithDistance = needs.map((n) => {
      const dist =
        n.location && typeof n.location.lat === 'number'
          ? haversineDistance(volLat, volLng, n.location.lat, n.location.lng)
          : 9999;
      return { ...n, distanceKm: dist };
    });

    if (selectedFilter === 'nearby') {
      return listWithDistance
        .filter((n) => n.distanceKm <= maxRadiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    if (selectedFilter === 'critical') {
      return listWithDistance
        .filter((n) => n.criticalityScore >= 75)
        .sort((a, b) => b.criticalityScore - a.criticalityScore);
    }

    // 'all'
    return listWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [needs, volunteer, selectedFilter, maxRadiusKm]);

  const unreadAlertsCount = useMemo(() => {
    return sosAlerts.filter((a) => !a.read).length;
  }, [sosAlerts]);

  const markAllAlertsRead = () => {
    setSosAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-100 font-sans flex flex-col justify-start items-center">
      {/* Top Application Bar */}
      <header className="w-full bg-[#161b22] border-b border-gray-800 sticky top-0 z-40 px-4 py-3 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <a
              href="/"
              className="p-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
              title="Back to TONIC Command Center"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </a>
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                  <ShieldCheckIcon className="w-5 h-5 text-indigo-400" />
                  Volunteer Field Portal
                </h1>
              </div>
              <p className="text-[11px] text-gray-400 font-medium">CommunityPulse Crisis Coordination • Live Field Portal</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled((prev) => !prev)}
              className={`p-2 rounded-lg border transition-all ${
                soundEnabled
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
              }`}
              title={soundEnabled ? 'Emergency Chime: ON' : 'Emergency Chime: MUTED'}
            >
              {soundEnabled ? <SpeakerWaveIcon className="w-4 h-4" /> : <SpeakerXMarkIcon className="w-4 h-4" />}
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotificationDrawer((prev) => !prev);
                  markAllAlertsRead();
                }}
                className={`p-2 rounded-lg border relative transition-all ${
                  unreadAlertsCount > 0
                    ? 'bg-rose-600/20 border-rose-500/50 text-rose-400 animate-bounce'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                }`}
                title="SOS Notifications"
              >
                <BellIcon className="w-4 h-4" />
                {unreadAlertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-[10px] font-black text-white rounded-full flex items-center justify-center">
                    {unreadAlertsCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Drawer */}
              {showNotificationDrawer && (
                <div className="absolute right-0 mt-2 w-80 bg-[#161b22] border border-gray-700 rounded-xl shadow-2xl p-3 z-50 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1">
                      <BellAlertIcon className="w-4 h-4 text-rose-400" />
                      SOS Notifications ({sosAlerts.length})
                    </span>
                    <button
                      onClick={() => setSosAlerts([])}
                      className="text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      Clear
                    </button>
                  </div>

                  {sosAlerts.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-500">
                      No SOS alerts received yet. You will be alerted when someone near your station needs help!
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {sosAlerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className="bg-[#0d1117] border border-gray-800 hover:border-gray-700 p-2.5 rounded-lg text-xs transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              {alert.need.crisisType} SOS
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {formatDistanceToNow(alert.receivedAt)} ago
                            </span>
                          </div>
                          <p className="font-semibold text-gray-200 mt-1">{alert.need.location.name}</p>
                          <p className="text-gray-400 text-[11px] mt-0.5 truncate">{alert.need.urgencyReasoning}</p>
                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-800 text-[10px]">
                            <span className="text-emerald-400 font-bold">📍 ~{alert.distanceKm.toFixed(1)} km away</span>
                            <span className="text-amber-400 font-bold">Score: {alert.need.criticalityScore.toFixed(0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile / Account Button */}
            <button
              onClick={() => setShowLocationModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-semibold text-gray-200 transition-all"
            >
              <UserCircleIcon className="w-4 h-4 text-indigo-400" />
              <span className="max-w-[90px] truncate">{volunteer?.name || 'Account'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      {/* 3-Portal Switcher */}
      <div className="w-full max-w-2xl px-4 pt-3 flex items-center justify-between gap-2 text-xs">
        <a
          href="/report"
          className="flex-1 py-1.5 px-2 rounded-xl bg-[#161b22] hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition-all text-center font-bold flex items-center justify-center gap-1"
        >
          <span>📢</span> Citizen Portal
        </a>
        <div className="flex-1 py-1.5 px-2 rounded-xl bg-indigo-600 text-white border border-indigo-500 font-bold text-center flex items-center justify-center gap-1 shadow">
          <span>📱</span> Volunteer Portal
        </div>
        <a
          href="/"
          className="flex-1 py-1.5 px-2 rounded-xl bg-[#161b22] hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition-all text-center font-bold flex items-center justify-center gap-1"
        >
          <span>🖥️</span> Admin Portal
        </a>
      </div>

      <main className="w-full max-w-2xl px-4 py-4 flex-1 space-y-4">
        {/* Real-time SOS Floating Notification Banner */}
        {activeBannerAlert && (
          <div className="bg-gradient-to-r from-rose-950/90 via-red-900/80 to-rose-950/90 border-2 border-rose-500 rounded-2xl p-4 shadow-2xl relative overflow-hidden animate-pulse">
            <button
              onClick={() => setActiveBannerAlert(null)}
              className="absolute top-2.5 right-2.5 text-gray-400 hover:text-white p-1"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>

            <div className="flex items-start space-x-3">
              <div className="p-2.5 bg-rose-600 rounded-xl text-white shadow-lg flex-shrink-0">
                <ExclamationTriangleIcon className="w-6 h-6 animate-spin" />
              </div>

              <div className="flex-1 pr-6">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-black uppercase rounded tracking-wider">
                    🚨 URGENT SOS DETECTED
                  </span>
                  <span className="text-xs font-bold text-rose-300">
                    📍 {activeBannerAlert.distanceKm.toFixed(1)} km away
                  </span>
                </div>

                <h3 className="text-base font-black text-white mt-1">
                  {activeBannerAlert.need.crisisType.toUpperCase()} CRISIS: {activeBannerAlert.need.location.name}
                </h3>
                <p className="text-xs text-rose-100 mt-1 line-clamp-2 leading-relaxed">
                  {activeBannerAlert.need.urgencyReasoning}
                </p>

                <div className="flex items-center space-x-4 mt-3 text-xs text-rose-200">
                  <span>👥 Affecting ~{activeBannerAlert.need.estimatedScale} people</span>
                  <span>⚡ Priority Score: {activeBannerAlert.need.criticalityScore.toFixed(0)}/100</span>
                </div>

                <div className="flex items-center space-x-2 mt-3.5">
                  <button
                    onClick={() => handleAcceptMission(activeBannerAlert.need.id)}
                    className="flex-1 py-2 px-3 bg-white text-rose-900 font-black rounded-lg text-xs hover:bg-rose-50 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5"
                  >
                    <CheckCircleIcon className="w-4 h-4 text-rose-700" />
                    Accept Mission & Respond
                  </button>
                  <button
                    onClick={() => setActiveBannerAlert(null)}
                    className="py-2 px-3 bg-rose-800/80 hover:bg-rose-700 text-rose-100 font-semibold rounded-lg text-xs transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Volunteer Station & Coverage HUD Card */}
        {volunteer && (
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                  Operational Radar
                </span>
                <h2 className="text-lg font-bold text-white flex items-center gap-1.5 flex-wrap">
                  {volunteer.name}
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    🏢 {volunteer.ngo || 'Independent Responder'}
                  </span>
                </h2>
              </div>

              {/* Status Switcher */}
              <div className="flex bg-[#0d1117] p-1 rounded-xl border border-gray-800">
                {(['AVAILABLE', 'BUSY', 'OFF_DUTY'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleToggleStatus(st)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      volunteer.status === st
                        ? st === 'AVAILABLE'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : st === 'BUSY'
                          ? 'bg-amber-600 text-white shadow-md'
                          : 'bg-gray-700 text-white'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {st === 'AVAILABLE' ? '🟢 Ready' : st === 'BUSY' ? '🟡 Busy' : '⚪ Off'}
                  </button>
                ))}
              </div>
            </div>

            {/* Location & Radius Details */}
            <div className="bg-[#0d1117] rounded-xl p-3 border border-gray-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center text-xs font-semibold text-gray-300">
                  <MapPinIcon className="w-4 h-4 text-rose-500 mr-1.5 flex-shrink-0" />
                  <span>{volunteer.locationName || 'Assigned Station'}</span>
                </div>
                <div className="text-[11px] text-gray-500 font-mono pl-5">
                  Lat: {volunteer.locationCoords.lat.toFixed(4)}, Lng: {volunteer.locationCoords.lng.toFixed(4)}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowLocationModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/20 text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <MapPinIcon className="w-3.5 h-3.5" />
                  Change Location
                </button>
                <button
                  onClick={() => handleDetectGPS(false)}
                  disabled={isGpsLoading}
                  className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors flex items-center gap-1"
                  title="Detect live GPS"
                >
                  <ArrowPathIcon className={`w-3.5 h-3.5 ${isGpsLoading ? 'animate-spin' : ''}`} />
                  {isGpsLoading ? 'Pinging...' : 'GPS'}
                </button>
              </div>
            </div>

            {/* Registered Skills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {volunteer.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase rounded-md"
                >
                  {skill}
                </span>
              ))}
              <span className="px-2 py-0.5 bg-gray-800 text-gray-400 text-[10px] font-mono rounded-md">
                ★ {(volunteer.reliabilityRate * 100).toFixed(0)}% Reliability
              </span>
            </div>
          </div>
        )}

        {/* Feed Filter Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <BoltIcon className="w-4 h-4 text-amber-400" />
              Active Distress Signals ({computedNeeds.length})
            </h3>

            {/* Geofence Radius Selector */}
            <div className="flex items-center space-x-1.5 text-xs text-gray-400">
              <span className="text-[11px]">Radius:</span>
              <select
                value={maxRadiusKm}
                onChange={(e) => setMaxRadiusKm(Number(e.target.value))}
                className="bg-[#161b22] border border-gray-700 text-gray-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500"
              >
                <option value={5}>Within 5 km (Immediate)</option>
                <option value={15}>Within 15 km (Standard)</option>
                <option value={35}>Within 35 km (District)</option>
                <option value={100}>Within 100 km (Region)</option>
              </select>
            </div>
          </div>

          <div className="flex bg-[#161b22] p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => setSelectedFilter('nearby')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedFilter === 'nearby'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              🎯 Nearby (&lt;{maxRadiusKm} km)
            </button>
            <button
              onClick={() => setSelectedFilter('critical')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedFilter === 'critical'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              🔥 Critical (&gt;75)
            </button>
            <button
              onClick={() => setSelectedFilter('all')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedFilter === 'all'
                  ? 'bg-gray-700 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              🌐 All Open
            </button>
          </div>
        </div>

        {/* Needs Feed */}
        {computedNeeds.length === 0 ? (
          <div className="bg-[#161b22] border border-gray-800/80 rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <ShieldCheckIcon className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-gray-200">Radar Clear in Your Sector</h4>
            <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
              No active distress calls detected within {maxRadiusKm} km of your station. The portal is actively listening for incoming SOS signals.
            </p>
            <button
              onClick={() => setSelectedFilter('all')}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-indigo-400 rounded-xl text-xs font-bold transition-colors inline-block"
            >
              View All Regional Crises
            </button>
          </div>
        ) : (
          <div className="space-y-3 pb-12">
            {computedNeeds.map((need) => {
              const isResponding = respondingNeedIds.has(need.id);
              const dist = (need as unknown as { distanceKm: number }).distanceKm;

              return (
                <div
                  key={need.id}
                  className={`bg-[#161b22] rounded-2xl border p-4 shadow-lg transition-all ${
                    isResponding
                      ? 'border-emerald-500/60 ring-1 ring-emerald-500/30'
                      : need.criticalityScore >= 80
                      ? 'border-rose-500/40 hover:border-rose-500/70'
                      : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  {/* Top Badges */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                          need.crisisType === 'medical'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : need.crisisType === 'water'
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : need.crisisType === 'food'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : need.crisisType === 'infrastructure'
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        }`}
                      >
                        {need.crisisType}
                      </span>

                      {/* Distance Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          dist <= 5
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black'
                            : dist <= 15
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        📍 ~{dist.toFixed(1)} km away
                      </span>

                      {isResponding && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500 text-white animate-pulse">
                          EN ROUTE
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-gray-500">
                      {formatDistanceToNow(need.reportedAt)} ago
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h4 className="text-base font-bold text-gray-100 flex items-center justify-between">
                    <span>{need.location.name}</span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        need.criticalityScore >= 80 ? 'text-rose-400' : 'text-amber-400'
                      }`}
                    >
                      Priority: {need.criticalityScore.toFixed(0)}/100
                    </span>
                  </h4>

                  <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">
                    {need.urgencyReasoning}
                  </p>

                  {/* Metrics Bar */}
                  <div className="bg-[#0d1117] rounded-xl p-2.5 mt-3 border border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">Impact Scale</span>
                      <span className="font-semibold text-gray-200">~{need.estimatedScale} people</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">Reports Merged</span>
                      <span className="font-semibold text-gray-200">{need.reportCount} signals</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">Status</span>
                      <span
                        className={`font-semibold ${
                          need.status === 'CRITICAL_VELOCITY'
                            ? 'text-rose-400'
                            : 'text-indigo-400'
                        }`}
                      >
                        {need.status}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 mt-4">
                    <button
                      onClick={() => handleAcceptMission(need.id)}
                      className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow ${
                        isResponding
                          ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      {isResponding ? 'En Route (Click to Cancel)' : 'Accept Mission'}
                    </button>

                    <button
                      onClick={() => handleResolve(need.id)}
                      className="py-2.5 px-4 bg-gray-800 hover:bg-emerald-700/60 text-gray-300 hover:text-white rounded-xl text-xs font-bold border border-gray-700 transition-all flex items-center gap-1"
                    >
                      <ShieldCheckIcon className="w-4 h-4 text-emerald-400" />
                      Mark Resolved
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* REGISTRATION MODAL */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-700 rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl space-y-5 custom-scrollbar">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                  CommunityPulse Network
                </span>
                <h2 className="text-xl font-black text-white mt-0.5">
                  Join Volunteer First-Responder Corps
                </h2>
              </div>
              {volunteer && (
                <button
                  onClick={() => setShowRegisterModal(false)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              )}
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Register your responder profile and station location. When an SOS distress signal is submitted in your sector, this portal will sound an immediate notification chime and dispatch briefing.
            </p>

            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              {/* Name */}
              <div>
                <label className="block text-gray-300 font-bold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aarav Sharma"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              {/* NGO Affiliation */}
              <div>
                <label className="block text-gray-300 font-bold mb-1">Affiliated NGO / Organization *</label>
                <select
                  value={regNgo}
                  onChange={(e) => setRegNgo(e.target.value)}
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Red Cross Society India">Red Cross Society India</option>
                  <option value="Goonj Relief Force">Goonj Relief Force</option>
                  <option value="SEEDS India Disaster Response">SEEDS India Disaster Response</option>
                  <option value="NDRF Auxiliary Volunteers">NDRF Auxiliary Volunteers</option>
                  <option value="Doctors Without Borders (MSF)">Doctors Without Borders (MSF)</option>
                  <option value="Robin Hood Army">Robin Hood Army</option>
                  <option value="Civil Defense Corps">Civil Defense Corps</option>
                  <option value="Independent Civic Responder">Independent Civic Responder</option>
                </select>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Contact Phone (SMS/WhatsApp)</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="responder@domain.org"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="block text-gray-300 font-bold mb-1">Preferred Language</label>
                <select
                  value={regLanguage}
                  onChange={(e) => setRegLanguage(e.target.value)}
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              {/* Skills Multi-Select */}
              <div>
                <label className="block text-gray-300 font-bold mb-1.5">
                  Emergency Skills & Capabilities
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          selected
                            ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                            : 'bg-[#0d1117] border-gray-800 text-gray-400 hover:border-gray-700'
                        }`}
                      >
                        <div className="font-bold text-xs">{sk.label}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{sk.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* LOCATION CHOOSER */}
              <div className="bg-[#0d1117] border border-gray-700 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-gray-200 font-bold flex items-center gap-1.5">
                    <MapPinIcon className="w-4 h-4 text-rose-500" />
                    Choose Your Station / Location *
                  </label>

                  {/* GPS Auto Detect */}
                  <button
                    type="button"
                    onClick={() => handleDetectGPS(true)}
                    disabled={isGpsLoading}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <ArrowPathIcon className={`w-3.5 h-3.5 ${isGpsLoading ? 'animate-spin' : ''}`} />
                    {isGpsLoading ? 'Detecting GPS...' : '📍 Use My GPS'}
                  </button>
                </div>

                {/* Preset Hubs */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1.5">
                    Or select a disaster response hub:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                    {PRESET_LOCATIONS.map((loc) => {
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
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                            isSelected
                              ? 'bg-rose-600 text-white shadow'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {loc.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom coordinates */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-800">
                  <div className="col-span-1">
                    <label className="text-[10px] text-gray-400 block mb-0.5">Area Name</label>
                    <input
                      type="text"
                      value={regLocationName}
                      onChange={(e) => setRegLocationName(e.target.value)}
                      className="w-full bg-[#161b22] border border-gray-700 rounded-lg px-2 py-1 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={regLat}
                      onChange={(e) => setRegLat(Number(e.target.value))}
                      className="w-full bg-[#161b22] border border-gray-700 rounded-lg px-2 py-1 text-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={regLng}
                      onChange={(e) => setRegLng(Number(e.target.value))}
                      className="w-full bg-[#161b22] border border-gray-700 rounded-lg px-2 py-1 text-white text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <ShieldCheckIcon className="w-5 h-5" />
                {isSubmitting ? 'Registering...' : 'Complete Registration & Activate Live SOS Radar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE LOCATION MODAL */}
      {showLocationModal && volunteer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MapPinIcon className="w-5 h-5 text-rose-500" />
                Change Station Location
              </h3>
              <button
                onClick={() => setShowLocationModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300">
              Moving to a different sector? Update your location to get SOS alerts for crises happening around your new position.
            </p>

            <button
              onClick={() => handleDetectGPS(false)}
              disabled={isGpsLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isGpsLoading ? 'animate-spin' : ''}`} />
              {isGpsLoading ? 'Pinging GPS Coordinates...' : 'Detect & Use Current GPS Location'}
            </button>

            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">
                Or select an emergency hub:
              </span>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {PRESET_LOCATIONS.map((loc) => (
                  <button
                    key={loc.name}
                    onClick={() => handleUpdateLocation(loc.lat, loc.lng, loc.name)}
                    className="p-2 rounded-lg bg-[#0d1117] hover:bg-gray-800 border border-gray-800 text-left text-xs font-medium text-gray-300 transition-colors"
                  >
                    <div className="font-bold truncate text-white">{loc.name}</div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      {loc.lat.toFixed(2)}, {loc.lng.toFixed(2)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-800 flex justify-between">
              <button
                onClick={() => {
                  setShowLocationModal(false);
                  setShowRegisterModal(true);
                }}
                className="text-xs text-indigo-400 hover:underline"
              >
                Edit Full Profile / Skills
              </button>
              <button
                onClick={() => setShowLocationModal(false)}
                className="px-4 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
