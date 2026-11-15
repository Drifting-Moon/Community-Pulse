import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import type { NeedEntity, VolunteerProfile } from './types';
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet';
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
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { BellIcon } from '@heroicons/react/24/solid';
import { formatDistanceToNow } from 'date-fns';
import ThemeToggle from './components/ThemeToggle';
import { useTheme } from './theme';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const STORAGE_KEY = 'communitypulse_volunteer_profile';

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
  { id: 'medical', label: 'Medical and First Aid', desc: 'Triage, emergency care, wound dressing' },
  { id: 'water', label: 'Water and Flood Rescue', desc: 'Boat rescue, water extraction, drainage' },
  { id: 'fire', label: 'Fire Emergency Response', desc: 'Evacuation assistance, perimeter control' },
  { id: 'food', label: 'Food and Ration Logistics', desc: 'Meal distribution, supply chain, dry ration' },
  { id: 'infrastructure', label: 'Infrastructure and Debris', desc: 'Structural check, clearance, transport' },
  { id: 'shelter', label: 'Shelter and Evacuation', desc: 'Displaced families, camp setup, hygiene' }
];

const LANGUAGES = [
  'English',
  'Hindi',
  'Marathi',
  'Tamil',
  'Bengali',
  'Telugu',
  'Gujarati',
  'Kannada'
];

interface SosAlertEvent {
  need: NeedEntity;
  distanceKm: number;
  receivedAt: number;
  read: boolean;
}

const MapRecenter = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(t);
  }, [map]);

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);

  return null;
};

export default function VolunteerApp() {
  const { theme } = useTheme();
  const [volunteer, setVolunteer] = useState<VolunteerProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
  const [showAccountMenu, setShowAccountMenu] = useState<boolean>(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [maxRadiusKm, setMaxRadiusKm] = useState<number>(15);

  const [regStep, setRegStep] = useState<1 | 2 | 3>(1);
  const [regName, setRegName] = useState<string>('');
  const [regNgo, setRegNgo] = useState<string>('Red Cross Society India');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regLanguage, setRegLanguage] = useState<string>('English');
  const [regSkills, setRegSkills] = useState<string[]>(['medical', 'water']);
  const [regLocationName, setRegLocationName] = useState<string>('Mumbai - Dharavi');
  const [regLat, setRegLat] = useState<number>(19.0422);
  const [regLng, setRegLng] = useState<number>(72.8538);
  const [isGpsLoading, setIsGpsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [needs, setNeeds] = useState<NeedEntity[]>([]);
  const [sosAlerts, setSosAlerts] = useState<SosAlertEvent[]>([]);
  const [activeToastAlert, setActiveToastAlert] = useState<SosAlertEvent | null>(null);
  const [toastCount, setToastCount] = useState<number>(1);
  const [respondingNeedIds, setRespondingNeedIds] = useState<Set<string>>(new Set());
  const [resolvingNeed, setResolvingNeed] = useState<NeedEntity | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionCasualties, setResolutionCasualties] = useState('1');
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [selectedIncidentForMap, setSelectedIncidentForMap] = useState<NeedEntity | null>(null);

  const knownNeedIdsRef = useRef<Map<string, number>>(new Map());
  const isInitialLoadRef = useRef<boolean>(true);

  const playEmergencyChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1174.66, now + 0.12);
      osc.frequency.setValueAtTime(1760, now + 0.24);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }, [soundEnabled]);

  const saveVolunteer = (updated: VolunteerProfile) => {
    setVolunteer(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  useEffect(() => {
    if (!volunteer) {
      setRegStep(1);
      setShowRegisterModal(true);
    }
  }, [volunteer]);

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
      () => {
        setIsGpsLoading(false);
        alert('Could not acquire GPS coordinates. Please select a hub preset.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleRegister = async () => {
    if (!regName.trim()) {
      alert('Please enter your full name.');
      setRegStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: regName.trim(),
        ngo: regNgo.trim(),
        phone: regPhone.trim() || undefined,
        preferredLanguage: regLanguage,
        skills: regSkills.length > 0 ? regSkills : ['medical'],
        locationCoords: { lat: regLat, lng: regLng },
        locationName: regLocationName || 'Custom Station'
      };

      const res = await axios.post(`${API_BASE}/volunteers`, payload);
      const newVol = res.data.volunteer;
      saveVolunteer(newVol);
      setShowRegisterModal(false);
      setIsSubmitting(false);
      playEmergencyChime();
    } catch {
      const fallbackVol: VolunteerProfile = {
        id: crypto.randomUUID(),
        name: regName.trim(),
        ngo: regNgo.trim(),
        phone: regPhone.trim() || undefined,
        preferredLanguage: regLanguage,
        skills: regSkills.length > 0 ? regSkills : ['medical'],
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
    } catch {}
  };

  const handleToggleStatus = async (newStatus: 'AVAILABLE' | 'BUSY' | 'OFF_DUTY') => {
    if (!volunteer) return;
    const updated: VolunteerProfile = { ...volunteer, status: newStatus };
    saveVolunteer(updated);

    try {
      await axios.patch(`${API_BASE}/volunteers/${volunteer.id}`, { status: newStatus });
    } catch {}
  };

  useEffect(() => {
    let isMounted = true;

    const fetchNeeds = async () => {
      try {
        const response = await axios.get(`${API_BASE}/needs`);
        if (!isMounted) return;

        const allNeeds: NeedEntity[] = response.data || [];
        const activeNeeds = allNeeds.filter((n) => n.status !== 'RESOLVED');
        setNeeds(activeNeeds);

        if (volunteer) {
          const myActiveResponding = activeNeeds
            .filter((n) => n.enRouteVolunteers?.some((r) => r.id === volunteer.id))
            .map((n) => n.id);
          if (myActiveResponding.length > 0) {
            setRespondingNeedIds(new Set(myActiveResponding));
          }
        }

        if (volunteer && activeNeeds.length > 0) {
          const volLat = volunteer.locationCoords.lat;
          const volLng = volunteer.locationCoords.lng;

          activeNeeds.forEach((need) => {
            if (!need.location || typeof need.location.lat !== 'number') return;

            const prevReportCount = knownNeedIdsRef.current.get(need.id);
            const isBrandNew = prevReportCount === undefined;
            const hasEscalated = prevReportCount !== undefined && need.reportCount > prevReportCount;

            knownNeedIdsRef.current.set(need.id, need.reportCount);

            if (isInitialLoadRef.current) return;

            if (isBrandNew || hasEscalated) {
              const distanceKm = haversineDistance(volLat, volLng, need.location.lat, need.location.lng);

              if (distanceKm <= maxRadiusKm || (need.criticalityScore || 0) >= 80) {
                const alertEvent: SosAlertEvent = {
                  need,
                  distanceKm,
                  receivedAt: Date.now(),
                  read: false
                };

                setSosAlerts((prev) => [alertEvent, ...prev.slice(0, 24)]);
                setActiveToastAlert((curr) => {
                  if (curr && curr.need.id === need.id) {
                    setToastCount((c) => c + 1);
                    return curr;
                  }
                  setToastCount(1);
                  return alertEvent;
                });

                playEmergencyChime();
              }
            }
          });
        }

        if (isInitialLoadRef.current) isInitialLoadRef.current = false;
      } catch {}
    };

    fetchNeeds();
    const interval = setInterval(fetchNeeds, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [volunteer, maxRadiusKm, playEmergencyChime]);

  const handleAcceptMission = async (id: string) => {
    const isCurrentlyResponding = respondingNeedIds.has(id);
    try {
      if (isCurrentlyResponding) {
        await axios.post(`${API_BASE}/needs/${id}/cancel-respond`, {
          volunteerId: volunteer?.id
        });
        setRespondingNeedIds((prev) => {
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
        setRespondingNeedIds((prev) => new Set(prev).add(id));
      }
      if (activeToastAlert?.need.id === id) setActiveToastAlert(null);
    } catch {
      setRespondingNeedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };

  const handleMarkOnScene = async (needId: string) => {
    try {
      await axios.post(`${API_BASE}/dispatch/on-scene`, {
        needId,
        volunteerId: volunteer?.id,
        volunteerName: volunteer?.name
      });
      setNeeds((prev) => prev.map((n) => (n.id === needId ? { ...n, status: 'ON_SCENE' } : n)));
    } catch (err) {
      console.error('Failed to mark on scene:', err);
    }
  };

  const handleSubmitProofOfWork = async () => {
    if (!resolvingNeed) return;
    setIsSubmittingProof(true);
    try {
      await axios.post(`${API_BASE}/dispatch/resolve`, {
        needId: resolvingNeed.id,
        volunteerName: volunteer?.name || 'Field Responder',
        notes: resolutionNotes || 'Assistance administered on site.',
        casualtiesAssisted: resolutionCasualties ? parseInt(resolutionCasualties) : 1
      });
      setNeeds((prev) => prev.filter((n) => n.id !== resolvingNeed.id));
      setRespondingNeedIds((prev) => {
        const next = new Set(prev);
        next.delete(resolvingNeed.id);
        return next;
      });
      setResolvingNeed(null);
      setResolutionNotes('');
      setResolutionCasualties('1');
    } catch (err) {
      console.error('Failed to submit proof of work:', err);
    } finally {
      setIsSubmittingProof(false);
    }
  };

  const computedNeeds = useMemo(() => {
    if (!volunteer) return [];
    const volLat = volunteer.locationCoords.lat;
    const volLng = volunteer.locationCoords.lng;

    return needs
      .map((n) => {
        const dist =
          n.location && typeof n.location.lat === 'number'
            ? haversineDistance(volLat, volLng, n.location.lat, n.location.lng)
            : 9999;
        return { ...n, distanceKm: dist };
      })
      .filter((n) => n.distanceKm <= maxRadiusKm || (n.criticalityScore || 0) >= 80)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [needs, volunteer, maxRadiusKm]);

  const mapCenterCoords: [number, number] = useMemo(() => {
    if (selectedIncidentForMap?.location?.lat && selectedIncidentForMap?.location?.lng) {
      return [selectedIncidentForMap.location.lat, selectedIncidentForMap.location.lng];
    }
    if (volunteer) {
      return [volunteer.locationCoords.lat, volunteer.locationCoords.lng];
    }
    return [19.0422, 72.8538];
  }, [selectedIncidentForMap, volunteer]);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col justify-start">
      {/* Top Application Bar - Shared container with body */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40 h-16 flex items-center">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <a
              href="/"
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
              title="Return to home"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </a>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#2E9E6B]"></span>
              <h1 className="text-[15px] font-semibold text-gray-900 tracking-tight">
                Volunteer Field Portal
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <ThemeToggle />

            <button
              onClick={() => setSoundEnabled((prev) => !prev)}
              className={`p-1.5 rounded-lg border transition-colors ${
                soundEnabled
                  ? 'bg-gray-100 border-gray-300 text-gray-800'
                  : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600'
              }`}
              title={soundEnabled ? 'Chime on' : 'Chime muted'}
            >
              {soundEnabled ? <SpeakerWaveIcon className="w-4 h-4" /> : <SpeakerXMarkIcon className="w-4 h-4" />}
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotificationDrawer((prev) => !prev);
                  setSosAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
                }}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 transition-colors relative"
                title="Alerts"
              >
                <BellIcon className="w-4 h-4" />
                {sosAlerts.filter((a) => !a.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E5383B] text-[10px] font-semibold text-white rounded-full flex items-center justify-center tabular-nums">
                    {sosAlerts.filter((a) => !a.read).length}
                  </span>
                )}
              </button>

              {showNotificationDrawer && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-[1000]">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                    <span className="text-[13px] font-semibold text-gray-900">
                      Emergency alerts ({sosAlerts.length})
                    </span>
                    <button
                      onClick={() => setSosAlerts([])}
                      className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Clear
                    </button>
                  </div>

                  {sosAlerts.length === 0 ? (
                    <div className="text-center py-6 text-[13px] text-gray-500">
                      No active alerts in your sector.
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {sosAlerts.map((alert, idx) => (
                        <div key={idx} className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg text-[13px]">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#E5383B] capitalize">
                              {alert.need.crisisType}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {formatDistanceToNow(alert.receivedAt)} ago
                            </span>
                          </div>
                          <p className="font-medium text-gray-900 mt-1">{alert.need.location.name}</p>
                          <div className="flex items-center justify-between mt-1 text-[11px] text-gray-500 tabular-nums">
                            <span>{alert.distanceKm.toFixed(1)} km away</span>
                            <span>Score {alert.need.criticalityScore?.toFixed(0) || 75}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile / Account Menu */}
            <div className="relative">
              <button
                onClick={() => setShowAccountMenu((prev) => !prev)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 border border-gray-200 text-[13px] font-medium text-gray-700 transition-colors"
              >
                <UserCircleIcon className="w-4 h-4 text-gray-500" />
                <span className="max-w-[100px] truncate">{volunteer?.name || 'Account'}</span>
              </button>

              {showAccountMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-[1000] text-[13px]">
                  <div className="px-3 py-2 border-b border-gray-100 mb-1">
                    <p className="font-semibold text-gray-900 truncate">{volunteer?.name || 'Responder'}</p>
                    <p className="text-gray-500 text-[11px] truncate">{volunteer?.ngo || 'Independent volunteer'}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      setShowLocationModal(true);
                    }}
                    className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
                  >
                    Change station location
                  </button>
                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      setRegStep(1);
                      setShowRegisterModal(true);
                    }}
                    className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
                  >
                    Edit profile and skills
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container - Shared width with header */}
      <main className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col">
        {/* Radar / Mission Screen - Two panes at >=1024px, stacked on mobile */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">
          {/* LEFT PANE (420px): Controls and Mission List */}
          <div className="space-y-4">
            {/* Duty toggle segmented (Ready / Busy / Off duty) */}
            <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold text-gray-900">{volunteer?.name || 'Responder'}</h2>
                  <p className="text-[13px] text-gray-500 mt-0.5">{volunteer?.locationName || 'Station'}</p>
                </div>

                <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-[13px]">
                  {(['AVAILABLE', 'BUSY', 'OFF_DUTY'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleToggleStatus(st)}
                      className={`px-3 py-1 rounded-md font-medium transition-colors ${
                        volunteer?.status === st
                          ? 'bg-white text-gray-900 shadow-xs'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {st === 'AVAILABLE' ? 'Ready' : st === 'BUSY' ? 'Busy' : 'Off duty'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Radius selector (5/15/35/100 km segmented) */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[13px] text-gray-500 font-medium">Radius</span>
                <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-[13px] tabular-nums">
                  {[5, 15, 35, 100].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setMaxRadiusKm(r)}
                      className={`px-2.5 py-0.5 rounded-md font-medium transition-colors ${
                        maxRadiusKm === r
                          ? 'bg-white text-gray-900 shadow-xs'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {r} km
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Mission Cards List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-semibold text-gray-900">
                  Active distress missions ({computedNeeds.length})
                </span>
              </div>

              {computedNeeds.length === 0 ? (
                <div className="border border-gray-200 rounded-xl p-8 text-center bg-white">
                  <ShieldCheckIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-[15px] font-medium text-gray-800">No active calls in sector</p>
                  <p className="text-[13px] text-gray-500 mt-1">Listening for incoming SOS signals within {maxRadiusKm} km.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                  {computedNeeds.map((need) => {
                    const isResponding = respondingNeedIds.has(need.id);
                    const isCritical = (need.criticalityScore || 0) >= 80;

                    return (
                      <div
                        key={need.id}
                        onClick={() => setSelectedIncidentForMap(need)}
                        className={`border rounded-xl p-4 bg-white transition-colors cursor-pointer ${
                          isResponding
                            ? 'border-[#2E9E6B] ring-1 ring-[#2E9E6B]'
                            : isCritical
                            ? 'border-[#E5383B]'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {/* Type + place (15 semibold) */}
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-[15px] font-semibold text-gray-900 capitalize">
                            {need.crisisType} • {need.location.name}
                          </h4>
                          {isResponding && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-green-50 text-[#2E9E6B] border border-green-200 shrink-0">
                              {need.status === 'ON_SCENE' ? 'On scene' : 'En route'}
                            </span>
                          )}
                        </div>

                        {/* Distance + score on one 13px secondary line */}
                        <p className="text-[13px] text-gray-500 mt-1 tabular-nums">
                          {need.distanceKm.toFixed(1)} km away • Priority score {need.criticalityScore?.toFixed(0) || 75}/100
                        </p>

                        <p className="text-[13px] text-gray-600 mt-2 line-clamp-2">
                          {need.urgencyReasoning}
                        </p>

                        {/* One primary button that changes by state */}
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                          {isResponding ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkOnScene(need.id);
                                }}
                                className={`flex-1 h-9 rounded-lg text-[13px] font-medium transition-colors ${
                                  need.status === 'ON_SCENE'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : 'bg-gray-900 hover:bg-black text-white'
                                }`}
                              >
                                {need.status === 'ON_SCENE' ? 'On scene' : 'Mark on scene'}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setResolvingNeed(need);
                                  setResolutionNotes('');
                                  setResolutionCasualties(`${need.estimatedScale || 1}`);
                                }}
                                className="flex-1 h-9 bg-[#2E9E6B] hover:bg-[#268559] text-white rounded-lg text-[13px] font-medium transition-colors"
                              >
                                Submit proof & resolve
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAcceptMission(need.id);
                                }}
                                className="h-9 px-3 border border-gray-200 text-gray-500 hover:text-gray-900 rounded-lg text-[13px]"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptMission(need.id);
                              }}
                              className="w-full h-9 bg-gray-900 hover:bg-black text-white text-[13px] font-medium rounded-lg transition-colors"
                            >
                              Accept mission
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANE: Map fills remaining width and height (collapses to 200px strip on <1024px) */}
          <div className="w-full h-[200px] lg:h-[calc(100vh-140px)] border border-gray-200 rounded-xl overflow-hidden relative z-0 isolate bg-gray-100">
            <MapContainer
              center={mapCenterCoords}
              zoom={12}
              style={{ width: '100%', height: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                key={`volunteer-tiles-${theme}`}
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                className={theme === 'dark' ? 'dark-tiles' : ''}
                maxZoom={19}
              />
              <MapRecenter center={mapCenterCoords} zoom={12} />

              {/* Station center circle */}
              {volunteer && (
                <Circle
                  center={[volunteer.locationCoords.lat, volunteer.locationCoords.lng]}
                  radius={maxRadiusKm * 1000}
                  pathOptions={{
                    color: '#6B7280',
                    fillColor: '#9CA3AF',
                    fillOpacity: 0.08,
                    weight: 1,
                    dashArray: '4, 4'
                  }}
                />
              )}

              {/* Incidents Circles */}
              {computedNeeds.map((need) => {
                if (!need.location?.lat || !need.location?.lng) return null;
                const isSelected = selectedIncidentForMap?.id === need.id;
                const isCritical = (need.criticalityScore || 0) >= 80;

                return (
                  <Circle
                    key={need.id}
                    center={[need.location.lat, need.location.lng]}
                    radius={isSelected ? 1000 : 600}
                    pathOptions={{
                      color: isCritical ? '#E5383B' : '#E8A317',
                      fillColor: isCritical ? '#E5383B' : '#E8A317',
                      fillOpacity: isSelected ? 0.8 : 0.5,
                      weight: isSelected ? 2 : 1
                    }}
                    eventHandlers={{
                      click: () => setSelectedIncidentForMap(need)
                    }}
                  />
                );
              })}
            </MapContainer>
          </div>
        </div>
      </main>

      {/* SINGLE BOTTOM-RIGHT TOAST NOTIFICATION */}
      {activeToastAlert && (
        <div className="fixed bottom-4 right-4 z-[1500] w-[360px] bg-white border border-[#E5383B] rounded-xl shadow-lg p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#E5383B]" />
                <span className="text-[13px] font-semibold text-[#E5383B] capitalize">
                  {activeToastAlert.need.crisisType} emergency
                </span>
                {toastCount > 1 && (
                  <span className="px-1.5 py-0.2 bg-red-100 text-[#E5383B] text-[10px] font-semibold rounded">
                    +{toastCount}
                  </span>
                )}
              </div>
              <p className="text-[15px] font-semibold text-gray-900 mt-1">
                {activeToastAlert.need.location.name}
              </p>
              <p className="text-[13px] text-gray-500 mt-0.5 tabular-nums">
                {activeToastAlert.distanceKm.toFixed(1)} km away • Priority score {activeToastAlert.need.criticalityScore?.toFixed(0) || 75}
              </p>
            </div>
            <button
              onClick={() => setActiveToastAlert(null)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => handleAcceptMission(activeToastAlert.need.id)}
              className="flex-1 h-9 bg-gray-900 hover:bg-black text-white text-[13px] font-medium rounded-lg transition-colors"
            >
              Accept mission
            </button>
            <button
              onClick={() => setActiveToastAlert(null)}
              className="h-9 px-3 border border-gray-200 text-gray-600 hover:bg-gray-50 text-[13px] font-medium rounded-lg"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 3-STEP REGISTRATION MODAL (max-w-[560px] centered, light theme) */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-[560px] w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-[13px] text-gray-500 font-medium">Step {regStep} of 3</span>
                <h2 className="text-[20px] font-semibold text-gray-900 mt-0.5">
                  {regStep === 1 && 'Personal details'}
                  {regStep === 2 && 'Emergency capabilities'}
                  {regStep === 3 && 'Station location'}
                </h2>
              </div>
              {volunteer && (
                <button
                  onClick={() => setShowRegisterModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              )}
            </div>

            <p className="text-[13px] text-gray-500">
              Join the verified emergency responder network.
            </p>

            {/* STEP 1: You */}
            {regStep === 1 && (
              <div className="space-y-4 text-[13px]">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Full name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter full name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full h-10 bg-white border border-gray-300 rounded-lg px-3 text-gray-900 focus:outline-none focus:border-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-1">Organization *</label>
                  <select
                    value={regNgo}
                    onChange={(e) => setRegNgo(e.target.value)}
                    className="w-full h-10 bg-white border border-gray-300 rounded-lg px-3 text-gray-900 focus:outline-none focus:border-gray-900"
                  >
                    <option value="Red Cross Society India">Red Cross Society India</option>
                    <option value="Goonj Relief Force">Goonj Relief Force</option>
                    <option value="SEEDS India Disaster Response">SEEDS India Disaster Response</option>
                    <option value="NDRF Auxiliary Volunteers">NDRF Auxiliary Volunteers</option>
                    <option value="Doctors Without Borders">Doctors Without Borders</option>
                    <option value="Civil Defense Corps">Civil Defense Corps</option>
                    <option value="Independent Civic Responder">Independent Civic Responder</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-1">Phone number</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full h-10 bg-white border border-gray-300 rounded-lg px-3 text-gray-900 focus:outline-none focus:border-gray-900 tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-1">Preferred language</label>
                  <select
                    value={regLanguage}
                    onChange={(e) => setRegLanguage(e.target.value)}
                    className="w-full h-10 bg-white border border-gray-300 rounded-lg px-3 text-gray-900 focus:outline-none focus:border-gray-900"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!regName.trim()) {
                        alert('Please enter your full name.');
                        return;
                      }
                      setRegStep(2);
                    }}
                    className="h-10 px-5 bg-gray-900 hover:bg-black text-white font-medium rounded-lg text-[13px] transition-colors"
                  >
                    Continue to skills
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Skills */}
            {regStep === 2 && (
              <div className="space-y-4 text-[13px]">
                <p className="text-[13px] text-gray-500">
                  Select your capabilities for mission assignment:
                </p>

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
                        className={`w-full p-3 rounded-xl border text-left transition-colors ${
                          selected
                            ? 'border-gray-900 bg-gray-50 text-gray-900'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-[15px] text-gray-900">{sk.label}</div>
                        {selected && (
                          <div className="text-[13px] text-gray-500 mt-0.5">{sk.desc}</div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRegStep(1)}
                    className="h-10 px-4 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium rounded-lg text-[13px]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegStep(3)}
                    className="h-10 px-5 bg-gray-900 hover:bg-black text-white font-medium rounded-lg text-[13px] transition-colors"
                  >
                    Continue to location
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Location */}
            {regStep === 3 && (
              <div className="space-y-4 text-[13px]">
                <button
                  type="button"
                  onClick={() => handleDetectGPS(true)}
                  disabled={isGpsLoading}
                  className="w-full h-10 border border-gray-300 hover:bg-gray-50 text-gray-800 rounded-lg text-[13px] font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowPathIcon className={`w-4 h-4 ${isGpsLoading ? 'animate-spin' : ''}`} />
                  {isGpsLoading ? 'Detecting coordinates...' : 'Use my location'}
                </button>

                <div>
                  <span className="text-[13px] font-medium text-gray-500 block mb-1.5">
                    Or select an emergency hub:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
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
                          className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                            isSelected
                              ? 'bg-gray-900 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {loc.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-[13px] text-gray-600">
                  <span className="font-semibold text-gray-900 block">{regLocationName}</span>
                  <span className="tabular-nums">Coordinates: {regLat.toFixed(4)}, {regLng.toFixed(4)}</span>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRegStep(2)}
                    className="h-10 px-4 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium rounded-lg text-[13px]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleRegister}
                    disabled={isSubmitting}
                    className="h-10 px-5 bg-gray-900 hover:bg-black text-white font-medium rounded-lg text-[13px] transition-colors"
                  >
                    {isSubmitting ? 'Registering...' : 'Complete registration'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHANGE LOCATION MODAL */}
      {showLocationModal && volunteer && (
        <div className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-[20px] font-semibold text-gray-900">
                Change station location
              </h3>
              <button
                onClick={() => setShowLocationModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[13px] text-gray-500">
              Update your location to receive SOS alerts for incidents around your new position.
            </p>

            <button
              onClick={() => handleDetectGPS(false)}
              disabled={isGpsLoading}
              className="w-full h-10 border border-gray-300 hover:bg-gray-50 text-gray-800 rounded-lg text-[13px] font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isGpsLoading ? 'animate-spin' : ''}`} />
              {isGpsLoading ? 'Detecting coordinates...' : 'Use current location'}
            </button>

            <div className="space-y-1.5 pt-1">
              <span className="text-[13px] font-medium text-gray-500 block">
                Or select an emergency hub:
              </span>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {PRESET_LOCATIONS.map((loc) => (
                  <button
                    key={loc.name}
                    onClick={() => handleUpdateLocation(loc.lat, loc.lng, loc.name)}
                    className="p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-left text-[13px] font-medium text-gray-800 transition-colors"
                  >
                    <div className="font-medium truncate">{loc.name}</div>
                    <div className="text-[11px] text-gray-400 tabular-nums">
                      {loc.lat.toFixed(2)}, {loc.lng.toFixed(2)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowLocationModal(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-[13px] font-medium hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROOF OF WORK RESOLUTION MODAL (modal on desktop, bottom sheet on mobile) */}
      {resolvingNeed && (
        <div className="fixed inset-0 z-[2000] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white border border-gray-200 rounded-t-2xl sm:rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-[20px] font-semibold text-gray-900">
                Submit mission resolution
              </h3>
              <button
                onClick={() => setResolvingNeed(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-[13px]">
              <span className="text-gray-400 block tabular-nums">
                Ticket: {resolvingNeed.ticketCode || resolvingNeed.id.slice(0, 8)}
              </span>
              <span className="font-semibold text-gray-900 capitalize block mt-0.5 text-[15px]">
                {resolvingNeed.crisisType} emergency at {resolvingNeed.location.name}
              </span>
            </div>

            <div className="space-y-3 text-[13px]">
              <div>
                <label className="text-gray-700 font-medium block mb-1">
                  Actions taken and resolution summary *
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Describe relief provided, area secured, or medical assistance administered."
                  rows={3}
                  className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 text-[13px]"
                />
              </div>

              <div>
                <label className="text-gray-700 font-medium block mb-1">
                  Citizens assisted count
                </label>
                <input
                  type="number"
                  min="0"
                  value={resolutionCasualties}
                  onChange={(e) => setResolutionCasualties(e.target.value)}
                  className="w-full h-10 bg-white border border-gray-300 rounded-lg px-3 text-gray-900 focus:outline-none focus:border-gray-900 tabular-nums"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setResolvingNeed(null)}
                className="h-10 px-4 border border-gray-200 text-gray-600 rounded-lg text-[13px] font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitProofOfWork}
                disabled={isSubmittingProof}
                className="h-10 px-4 bg-[#2E9E6B] hover:bg-[#268559] text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
              >
                {isSubmittingProof ? 'Submitting...' : 'Confirm and resolve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
