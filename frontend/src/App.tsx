import React, { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { Routes, Route, useLocation, useNavigate, Link } from 'react-router-dom';
import type { NeedEntity, VolunteerProfile, Prediction, AdminAccount, AdminDepartmentCategory } from './types';
import { MapContainer, TileLayer, CircleMarker, Circle, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

import VolunteersPage from './pages/VolunteersPage';
import AnalyticsPage from './pages/AnalyticsPage';
import HistoryPage from './pages/HistoryPage';
import AdminInventoryPage from './pages/AdminInventoryPage';

import {
  SquaresFourIcon,
  UsersThreeIcon,
  ChartLineUpIcon,
  ClockCounterClockwiseIcon
} from '@phosphor-icons/react';

import {
  ArchiveBoxIcon,
  PlusIcon,
  XMarkIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  CameraIcon
} from '@heroicons/react/24/outline';
import ThemeToggle from './components/ThemeToggle';
import { useTheme } from './theme';

const API_BASE = import.meta.env.VITE_API_BASE || '';

// Clean base map tiles using OpenStreetMap (No API key required)
const TILE_LAYERS = {
  dark: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    className: 'dark-tiles'
  },
  light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    className: ''
  }
};

function formatShortTimeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export interface SectorZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  isCustom?: boolean;
}

const DEFAULT_SECTORS: SectorZone[] = [
  { id: 'sec-bagru', name: 'Bagru Sector', lat: 26.8143, lng: 75.5447, radiusKm: 15 },
  { id: 'sec-jaipur', name: 'Jaipur Command', lat: 26.9124, lng: 75.7873, radiusKm: 20 },
  { id: 'sec-delhi', name: 'Delhi NCR Command', lat: 28.6139, lng: 77.2090, radiusKm: 30 },
  { id: 'sec-mumbai', name: 'Mumbai Metropolitan', lat: 19.0760, lng: 72.8777, radiusKm: 30 },
  { id: 'sec-bengaluru', name: 'Bengaluru Urban Sector', lat: 12.9716, lng: 77.5946, radiusKm: 25 },
];

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

const PLACE_COORDS: Record<string, [number, number]> = {
  'Jaipur': [26.9124, 75.7873],
  'Bagru': [26.8143, 75.5447],
  'Delhi': [28.6139, 77.2090],
  'Mumbai': [19.0760, 72.8777],
  'Bengaluru': [12.9716, 77.5946],
  'Chennai': [13.0827, 80.2707],
  'Kolkata': [22.5726, 88.3639],
  'Hyderabad': [17.3850, 78.4867]
};

const DEPARTMENT_CATEGORIES: {
  id: AdminDepartmentCategory;
  name: string;
  emoji: string;
  color: string;
  desc: string;
}[] = [
  { id: 'FIRE_DEPT', name: 'Fire & Rescue Department', emoji: '🚒', color: '#EF4444', desc: 'Emergency fire response, entrapment & perimeter control' },
  { id: 'POLICE_DEPT', name: 'Police & Public Safety', emoji: '🚓', color: '#3B82F6', desc: 'Law enforcement, civic safety & incident perimeter' },
  { id: 'NGO', name: 'Non-Governmental Organization (NGO)', emoji: '🤝', color: '#10B981', desc: 'Civilian humanitarian relief, food, water & field responder teams' },
  { id: 'MEDICAL_HEALTH', name: 'Emergency Health & Medical Services', emoji: '🏥', color: '#EC4899', desc: 'Trauma triage, ambulances & emergency hospital dispatch' },
  { id: 'DISASTER_MGMT', name: 'Disaster Management Authority (SDRF / NDRF)', emoji: '🛡️', color: '#F59E0B', desc: 'Integrated multi-hazard emergency coordination' }
];

function getDeptColor(category?: AdminDepartmentCategory): string {
  switch (category) {
    case 'FIRE_DEPT': return '#EF4444';
    case 'POLICE_DEPT': return '#3B82F6';
    case 'NGO': return '#10B981';
    case 'MEDICAL_HEALTH': return '#EC4899';
    case 'DISASTER_MGMT': return '#F59E0B';
    default: return '#4C8DFF';
  }
}

function getDeptEmoji(category?: AdminDepartmentCategory): string {
  switch (category) {
    case 'FIRE_DEPT': return '🚒';
    case 'POLICE_DEPT': return '🚓';
    case 'NGO': return '🤝';
    case 'MEDICAL_HEALTH': return '🏥';
    case 'DISASTER_MGMT': return '🛡️';
    default: return '🛡️';
  }
}

function generate5LetterCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let res = '';
  for (let i = 0; i < 5; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

// Map Controller: handles invalidateSize, initial fitBounds to active points, and flyTo on selected incident
const MapController = ({
  points,
  selectedNeed,
  centerTarget
}: {
  points: [number, number][];
  selectedNeed: NeedEntity | null;
  centerTarget?: [number, number] | null;
}) => {
  const map = useMap();
  const hasFittedRef = useRef(false);

  // Invalidate map size so Leaflet fills full grid/flex container properly
  useEffect(() => {
    map.invalidateSize();
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(t);
  }, [map]);

  // Fit bounds on active points once data is loaded, or fly to selected jurisdiction
  useEffect(() => {
    if (centerTarget) {
      map.flyTo(centerTarget, 12, { animate: true, duration: 0.8 });
    } else if (points.length > 0 && !hasFittedRef.current) {
      try {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 11 });
        hasFittedRef.current = true;
      } catch (e) {
        console.warn('Map fitBounds error:', e);
      }
    }
  }, [points, centerTarget, map]);

  // Fly to selected incident on selection
  useEffect(() => {
    if (selectedNeed?.location?.lat && selectedNeed?.location?.lng) {
      map.flyTo([selectedNeed.location.lat, selectedNeed.location.lng], 13, {
        animate: true,
        duration: 0.8
      });
    }
  }, [selectedNeed, map]);

  return null;
};

// Heatmap Overlay
const HeatmapOverlay = React.memo(({ data, enabled }: { data: { lat: number; lng: number; weight: number }[]; enabled: boolean }) => {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !data || data.length === 0 || !(L as any).heatLayer) return;

    const points = data.map((p) => [p.lat, p.lng, p.weight] as [number, number, number]);
    const heatLayer = (L as any).heatLayer(points, {
      radius: 20,
      blur: 14,
      max: 100,
      gradient: {
        0.3: '#4C8DFF',
        0.6: '#E8A317',
        0.9: '#E5383B'
      }
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [data, enabled, map]);

  return null;
});

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // Core Data
  const [needs, setNeeds] = useState<NeedEntity[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [selectedNeed, setSelectedNeed] = useState<NeedEntity | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [predictionBannerVisible, setPredictionBannerVisible] = useState(true);

  // UI state
  const { theme } = useTheme();
  const SECTORS_STORAGE_KEY = 'naturalpulse_admin_sectors';

  const [sectors, setSectors] = useState<SectorZone[]>(() => {
    try {
      const saved = localStorage.getItem(SECTORS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Auto-purge any duplicate Jaipur sectors so only one single Jaipur is ever kept
          let seenJaipur = false;
          const cleaned = parsed.filter((sec: SectorZone) => {
            const isJaipur =
              sec.name.toLowerCase().includes('jaipur') ||
              sec.id.toLowerCase().includes('jaipur');
            if (isJaipur) {
              if (seenJaipur) return false;
              seenJaipur = true;
              return true;
            }
            return true;
          });
          return cleaned;
        }
      }
    } catch {}
    return DEFAULT_SECTORS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(SECTORS_STORAGE_KEY, JSON.stringify(sectors));
    } catch {}
  }, [sectors]);

  const ADMIN_STORAGE_KEY = 'communitypulse_admin_account';

  const [adminAccount, setAdminAccount] = useState<AdminAccount | null>(() => {
    try {
      const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(ADMIN_STORAGE_KEY);
    } catch {
      return true;
    }
  });

  // Admin authentication state: Sign In vs Register
  const [authTab, setAuthTab] = useState<'signin' | 'register'>('signin');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);

  // Department registration form state
  const [loginDeptCategory, setLoginDeptCategory] = useState<AdminDepartmentCategory>('FIRE_DEPT');
  const [loginDeptName, setLoginDeptName] = useState<string>('City Fire & Rescue Station 1');
  const [loginStationName, setLoginStationName] = useState<string>('Jaipur Central');
  const [loginLat, setLoginLat] = useState<number>(26.9124);
  const [loginLng, setLoginLng] = useState<number>(75.7873);
  const [isNgoSignInMode, setIsNgoSignInMode] = useState<boolean>(false);
  const [loginNgoCodeInput, setLoginNgoCodeInput] = useState<string>('');
  const [generatedNgoCode, setGeneratedNgoCode] = useState<string>(() => generate5LetterCode());
  const [isDetectingAdminGps, setIsDetectingAdminGps] = useState<boolean>(false);

  const handleCategorySelect = (cat: AdminDepartmentCategory) => {
    setLoginDeptCategory(cat);
    if (cat === 'FIRE_DEPT') setLoginDeptName('City Fire & Rescue Station 1');
    else if (cat === 'POLICE_DEPT') setLoginDeptName('Central Police Division');
    else if (cat === 'NGO') {
      setLoginDeptName('Red Cross Emergency Team');
      setGeneratedNgoCode(generate5LetterCode());
    }
    else if (cat === 'MEDICAL_HEALTH') setLoginDeptName('Apex Trauma & Emergency Medical Unit');
    else if (cat === 'DISASTER_MGMT') setLoginDeptName('State Disaster Management Force (SDRF)');
  };

  const handleDetectAdminGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsDetectingAdminGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoginLat(Number(pos.coords.latitude.toFixed(4)));
        setLoginLng(Number(pos.coords.longitude.toFixed(4)));
        setLoginStationName('Custom Station (GPS)');
        setIsDetectingAdminGps(false);
      },
      () => {
        setIsDetectingAdminGps(false);
        alert('Could not acquire GPS position. Please pick a preset.');
      },
      { timeout: 8000 }
    );
  };

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Please enter both Email ID and Password.');
      return;
    }

    setIsAuthLoading(true);
    try {
      let res;
      try {
        res = await axios.post(`${API_BASE}/api/admin/auth/login`, {
          email: authEmail.trim().toLowerCase(),
          password: authPassword.trim()
        });
      } catch (e: any) {
        if (e.response?.status === 404 && !e.response?.data?.error) {
          res = await axios.post(`${API_BASE}/admin/auth/login`, {
            email: authEmail.trim().toLowerCase(),
            password: authPassword.trim()
          });
        } else {
          throw e;
        }
      }

      const account = res.data.account;
      setAdminAccount(account);
      try {
        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(account));
      } catch {}
      setShowAdminLoginModal(false);
      setAuthPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Invalid credentials. Please verify your Email and Password.';
      setAuthError(msg);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleAdminRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail.trim()) {
      setAuthError('Please enter an Email ID.');
      return;
    }
    if (!authPassword.trim() || authPassword.trim().length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    if (!loginDeptName.trim()) {
      setAuthError('Please enter department / organization name.');
      return;
    }

    let finalNgoCode: string | undefined = undefined;
    if (loginDeptCategory === 'NGO') {
      if (isNgoSignInMode) {
        const clean = loginNgoCodeInput.trim().toUpperCase();
        if (!clean || clean.length !== 5) {
          setAuthError('Please enter a valid 5-letter NGO team code.');
          return;
        }
        finalNgoCode = clean;
      } else {
        finalNgoCode = generatedNgoCode.toUpperCase();
      }
    }

    const payload = {
      email: authEmail.trim().toLowerCase(),
      password: authPassword.trim(),
      departmentCategory: loginDeptCategory,
      departmentName: loginDeptName.trim(),
      stationName: loginStationName,
      hqCoords: { lat: loginLat, lng: loginLng },
      radiusKm: 15, // Fixed 15 km area as specified
      ngoCode: finalNgoCode
    };

    setIsAuthLoading(true);
    try {
      let res;
      try {
        res = await axios.post(`${API_BASE}/api/admin/auth/register`, payload);
      } catch (e: any) {
        if (e.response?.status === 404 && !e.response?.data?.error) {
          res = await axios.post(`${API_BASE}/admin/auth/register`, payload);
        } else {
          throw e;
        }
      }

      const account = res.data.account;
      setAdminAccount(account);
      try {
        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(account));
      } catch {}
      setShowAdminLoginModal(false);
      setAuthPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Registration failed. Email may already be in use.';
      setAuthError(msg);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogoutAdmin = () => {
    try {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    } catch {}
    setAdminAccount(null);
    setAuthError('');
    setAuthPassword('');
    setGeneratedNgoCode(generate5LetterCode());
    setShowAdminLoginModal(true);
  };

  const [selectedSectorId, setSelectedSectorId] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('command_center_sector_chosen');
      if (saved) return saved;
    } catch {}
    return 'ALL';
  });
  const [showSectorGate, setShowSectorGate] = useState<boolean>(false);

  const handleSelectGateSector = (sectorId: string) => {
    setSelectedSectorId(sectorId);
    try {
      sessionStorage.setItem('command_center_sector_chosen', sectorId);
    } catch {}
    setShowSectorGate(false);
  };

  const [showSectorModal, setShowSectorModal] = useState<boolean>(false);
  const [newSectorName, setNewSectorName] = useState('');
  const [newSectorLat, setNewSectorLat] = useState<string>('');
  const [newSectorLng, setNewSectorLng] = useState<string>('');
  const [newSectorRadius, setNewSectorRadius] = useState<number>(15);
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  const activeSector = useMemo(() => {
    if (selectedSectorId === 'ALL') return null;
    return sectors.find((s) => s.id === selectedSectorId) || null;
  }, [sectors, selectedSectorId]);

  const handleDetectGpsForSector = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNewSectorLat(pos.coords.latitude.toFixed(4));
        setNewSectorLng(pos.coords.longitude.toFixed(4));
        setIsDetectingGps(false);
      },
      () => {
        setIsDetectingGps(false);
        alert('Could not acquire GPS position. Please enter manually.');
      },
      { timeout: 8000 }
    );
  };

  const handleAddSector = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(newSectorLat);
    const lng = parseFloat(newSectorLng);
    if (!newSectorName.trim() || isNaN(lat) || isNaN(lng)) {
      alert('Please provide a valid sector name and numeric coordinates.');
      return;
    }
    const newSector: SectorZone = {
      id: `sec-${Date.now()}`,
      name: newSectorName.trim(),
      lat,
      lng,
      radiusKm: Number(newSectorRadius) || 15,
      isCustom: true
    };
    setSectors((prev) => [newSector, ...prev]);
    setSelectedSectorId(newSector.id);
    setNewSectorName('');
    setNewSectorLat('');
    setNewSectorLng('');
    setShowSectorModal(false);
  };

  const handleDeleteSector = (id: string) => {
    setSectors((prev) => prev.filter((s) => s.id !== id));
    if (selectedSectorId === id) setSelectedSectorId('ALL');
  };

  const handleResetSectors = () => {
    setSectors(DEFAULT_SECTORS);
    setSelectedSectorId('ALL');
    try {
      localStorage.setItem(SECTORS_STORAGE_KEY, JSON.stringify(DEFAULT_SECTORS));
    } catch {}
  };

  const [sortBy, setSortBy] = useState<'criticality' | 'newest'>('criticality');
  const [showResolvedInList, setShowResolvedInList] = useState(false);
  const [mapLayer, setMapLayer] = useState<'dark' | 'light'>(theme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    setMapLayer(theme === 'dark' ? 'dark' : 'light');
  }, [theme]);

  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showNewReportModal, setShowNewReportModal] = useState(false);
  const [loadingDispatch, setLoadingDispatch] = useState(false);

  // Single deduplicated toast alert
  const [toast, setToast] = useState<{ need: NeedEntity; count: number } | null>(null);

  // New report modal form state
  const [newReportText, setNewReportText] = useState('');
  const [newReportImage, setNewReportImage] = useState<File | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const avatarMenuRef = useRef<HTMLDivElement>(null);

  // Close avatar menu on outside click or Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAvatarMenu(false);
        if (selectedNeed) setSelectedNeed(null);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setShowAvatarMenu(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedNeed]);

  // Polling data
  const fetchNeeds = async () => {
    try {
      const res = await axios.get(`${API_BASE}/needs`);
      setNeeds(res.data || []);
    } catch (e) {
      console.error('Error fetching needs:', e);
    }
  };

  const fetchVolunteers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/volunteers`);
      setVolunteers(res.data || []);
    } catch (e) {
      console.error('Error fetching volunteers:', e);
    }
  };

  useEffect(() => {
    fetchNeeds();
    fetchVolunteers();
    const interval = setInterval(fetchNeeds, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    axios.get(`${API_BASE}/api/predictions`).then((res) => {
      setPredictions(res.data.predictions || []);
    }).catch(() => {});
  }, []);

  // Alert simulation: trigger toast on high-priority needs
  const knownNeedIdsRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (needs.length === 0) return;
    needs.forEach((need) => {
      const prevCount = knownNeedIdsRef.current.get(need.id);
      knownNeedIdsRef.current.set(need.id, need.reportCount);

      if (prevCount !== undefined && need.reportCount > prevCount && (need.criticalityScore || 0) >= 80) {
        setToast((curr) => {
          if (curr && curr.need.id === need.id) {
            return { need, count: curr.count + 1 };
          }
          return { need, count: 1 };
        });
      }
    });
  }, [needs]);

  // Actions: Verify / Reject / Dispatch / Resolve
  const handleVerify = async (id: string, verificationStatus: 'VERIFIED' | 'REJECTED_SPAM') => {
    try {
      await axios.patch(`${API_BASE}/needs/${id}/verify`, { verificationStatus });
      const newStatus = verificationStatus === 'REJECTED_SPAM' ? 'FALSE_ALARM' : 'VERIFIED';
      setNeeds((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: newStatus as any, verificationStatus } : n))
      );
      if (selectedNeed?.id === id) {
        setSelectedNeed((prev) => (prev ? { ...prev, status: newStatus as any, verificationStatus } : null));
      }
    } catch (e) {
      console.error('Error updating triage status:', e);
    }
  };

  const handleDispatch = async (needId: string) => {
    setLoadingDispatch(true);
    try {
      const topAvailable = scopedVolunteers.find((v) => v.status === 'AVAILABLE');
      const deptTag = adminAccount
        ? `${adminAccount.departmentName} (${adminAccount.stationName})`
        : 'Emergency Response Command';
      const payload: any = {
        needId,
        respondingParty: topAvailable
          ? `${topAvailable.name} (${topAvailable.ngo || adminAccount?.departmentName || 'Rescue Unit'})`
          : deptTag,
        departmentName: deptTag
      };
      if (topAvailable) {
        payload.volunteerId = topAvailable.id;
      }
      const res = await axios.post(`${API_BASE}/dispatch`, payload);
      fetchNeeds();
      fetchVolunteers();
      if (selectedNeed?.id === needId) {
        setSelectedNeed(res.data.need);
      }
    } catch (e) {
      console.error('Dispatch failed:', e);
    } finally {
      setLoadingDispatch(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await axios.post(`${API_BASE}/dispatch/resolve`, {
        needId: id,
        notes: 'Resolved by Central Dispatch Command.',
        volunteerName: 'Central Command'
      });
      setNeeds((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'RESOLVED' } : n)));
      if (selectedNeed?.id === id) {
        setSelectedNeed((prev) => (prev ? { ...prev, status: 'RESOLVED' } : null));
      }
    } catch (e) {
      console.error('Error resolving incident:', e);
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReportText.trim() && !newReportImage) return;

    setIsSubmittingReport(true);
    try {
      const formData = new FormData();
      formData.append('text', newReportText);
      if (newReportImage) formData.append('image', newReportImage);

      await axios.post(`${API_BASE}/ingest`, formData);
      setNewReportText('');
      setNewReportImage(null);
      setShowNewReportModal(false);
      fetchNeeds();
    } catch (e) {
      console.error('Failed to ingest report:', e);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Operational Center based on Admin Station & 15km Radius (or activeSector fallback)
  const operationalCenter = useMemo(() => {
    if (adminAccount?.hqCoords) {
      return {
        lat: adminAccount.hqCoords.lat,
        lng: adminAccount.hqCoords.lng,
        name: adminAccount.stationName,
        radiusKm: adminAccount.radiusKm || 15
      };
    }
    if (activeSector) {
      return {
        lat: activeSector.lat,
        lng: activeSector.lng,
        name: activeSector.name,
        radiusKm: activeSector.radiusKm
      };
    }
    return null;
  }, [adminAccount, activeSector]);

  // Scoped Needs based on Operational Center (15 km Radius)
  const scopedNeeds = useMemo(() => {
    if (!operationalCenter) return needs;
    return needs.filter((n) => {
      // 1. Coordinate distance check if lat and lng exist
      if (typeof n.location?.lat === 'number' && typeof n.location?.lng === 'number') {
        const dist = haversineDistance(operationalCenter.lat, operationalCenter.lng, n.location.lat, n.location.lng);
        if (dist <= operationalCenter.radiusKm) return true;
      }
      // 2. Also match by sector/station name keywords
      const sectorKeywords = operationalCenter.name.toLowerCase().split(/[\s,()/-]+/);
      const locName = (n.location?.name || '').toLowerCase();
      if (sectorKeywords.some((kw) => kw.length >= 3 && locName.includes(kw))) return true;

      // 3. Match against known place coordinates if client did not send GPS
      for (const [place, coords] of Object.entries(PLACE_COORDS)) {
        if (locName.includes(place.toLowerCase())) {
          const dist = haversineDistance(operationalCenter.lat, operationalCenter.lng, coords[0], coords[1]);
          if (dist <= operationalCenter.radiusKm) return true;
        }
      }
      return false;
    });
  }, [needs, operationalCenter]);

  // Scoped Volunteers based on 15km operational radius and NGO team isolation
  const scopedVolunteers = useMemo(() => {
    let list = volunteers;

    // NGO Admin: strictly show ONLY volunteers belonging to their NGO (via 5-letter code or matching name)
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

    // Radius filter (15km default)
    if (operationalCenter) {
      list = list.filter((v) => {
        if (!v.locationCoords) return false;
        const dist = haversineDistance(operationalCenter.lat, operationalCenter.lng, v.locationCoords.lat, v.locationCoords.lng);
        return dist <= operationalCenter.radiusKm;
      });
    }

    return list;
  }, [volunteers, adminAccount, operationalCenter]);

  // Active metrics scoped to jurisdiction
  const activeCount = scopedNeeds.filter((n) => n.status !== 'RESOLVED' && n.status !== 'FALSE_ALARM').length;
  const enRouteCount = scopedNeeds.filter((n) => n.status === 'EN_ROUTE' || (n.enRouteVolunteers && n.enRouteVolunteers.length > 0)).length;
  const volunteersReady = scopedVolunteers.filter((v) => v.status === 'AVAILABLE').length;
  const resolvedCount = scopedNeeds.filter((n) => n.status === 'RESOLVED').length;

  // Filter & sort incidents for dashboard list
  const dashboardIncidents = useMemo(() => {
    let list = scopedNeeds.filter((n) => {
      if (showResolvedInList) return true;
      return n.status !== 'RESOLVED' && n.status !== 'FALSE_ALARM';
    });

    if (sortBy === 'criticality') {
      list.sort((a, b) => (b.criticalityScore || 0) - (a.criticalityScore || 0));
    } else {
      list.sort((a, b) => b.reportedAt - a.reportedAt);
    }
    return list;
  }, [scopedNeeds, sortBy, showResolvedInList]);

  const heatmapData = useMemo(() => {
    return scopedNeeds
      .filter((n) => n.location?.lat && n.location?.lng)
      .map((n) => ({
        lat: n.location.lat,
        lng: n.location.lng,
        weight: n.criticalityScore || 20
      }));
  }, [scopedNeeds]);

  const activePoints: [number, number][] = useMemo(() => {
    return scopedNeeds
      .filter((n) => n.location?.lat && n.location?.lng && n.status !== 'RESOLVED' && n.status !== 'FALSE_ALARM')
      .map((n) => [n.location.lat, n.location.lng]);
  }, [scopedNeeds]);

  // Current page title derived from route
  const pageTitle = useMemo(() => {
    const p = location.pathname;
    if (p.includes('/volunteers')) return 'Volunteers';
    if (p.includes('/inventory')) return 'Inventory';
    if (p.includes('/analytics')) return 'Analytics';
    if (p.includes('/history')) return 'History';
    return 'Dashboard';
  }, [location.pathname]);

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: <SquaresFourIcon size={18} /> },
    { path: '/admin/volunteers', label: 'Volunteers', icon: <UsersThreeIcon size={18} /> },
    { path: '/admin/inventory', label: 'Inventory', icon: <ArchiveBoxIcon className="w-[18px] h-[18px]" /> },
    { path: '/admin/analytics', label: 'Analytics', icon: <ChartLineUpIcon size={18} /> },
    { path: '/admin/history', label: 'History', icon: <ClockCounterClockwiseIcon size={18} /> },
  ];

  return (
    <>
      {/* Notice for screens smaller than 1024px */}
      <div className="lg:hidden h-screen w-screen bg-[#0E0E10] text-[#F2F2F3] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-10 h-10 rounded-lg bg-[#26262A] flex items-center justify-center font-semibold text-[15px] mb-4">
          CP
        </div>
        <h2 className="text-[20px] font-semibold mb-2">Open on a larger screen</h2>
        <p className="text-[13px] text-[#8B8B94] max-w-sm">
          The CommunityPulse Admin Command Center is optimized for desktop displays (1024px and wider). Please switch to a laptop or desktop monitor.
        </p>
      </div>

      {/* Main Admin Desktop Shell: h-dvh grid [232px_1fr] at >=1280px, [64px_1fr] at 1024-1279px */}
      <div className="hidden lg:grid h-dvh grid-cols-[64px_1fr] xl:grid-cols-[232px_1fr] bg-[#0E0E10] text-[#F2F2F3] font-sans overflow-hidden">
        {/* Left Sidebar */}
        <aside className="border-r border-[#26262A] bg-[#0E0E10] flex flex-col justify-between py-4 px-2 xl:px-3">
          <div className="space-y-6">
            {/* Logo Mark + Title */}
            <Link
              to="/"
              title="Return to Main Portal Gateway"
              className="flex items-center gap-3 px-2 group cursor-pointer hover:opacity-85 transition-opacity"
            >
              <div className="w-8 h-8 rounded-lg bg-[#26262A] text-white flex items-center justify-center font-semibold text-[13px] shrink-0 group-hover:bg-[#34343A] transition-colors">
                CP
              </div>
              <span className="hidden xl:inline text-[15px] font-semibold tracking-tight text-white truncate">
                CommunityPulse
              </span>
            </Link>

            {/* Nav items: 40px high, 8px radius */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive =
                  item.path === '/admin'
                    ? location.pathname === '/admin' || location.pathname === '/admin/'
                    : location.pathname.startsWith(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={item.label}
                    className={`h-10 rounded-[8px] flex items-center gap-3 px-3 transition-colors text-[15px] ${
                      isActive
                        ? 'bg-[#1A1A1D] text-white font-medium'
                        : 'text-[#8B8B94] hover:text-[#F2F2F3] hover:bg-[#141416]'
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="hidden xl:inline truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Right Shell: Top bar (56px) + Main area */}
        <div className="flex flex-col h-dvh overflow-hidden min-w-0">
          {/* Top Bar (56px) */}
          <header className="h-14 border-b border-[#26262A] bg-[#0E0E10] px-6 flex items-center justify-between shrink-0">
            {/* Page Title & Jurisdiction Selector */}
            <div className="flex items-center gap-3">
              <h1 className="text-[20px] font-semibold text-white tracking-tight">
                {pageTitle}
              </h1>

              {adminAccount && (
                <div className="flex items-center gap-2 px-2.5 py-1 bg-[#141416] border border-[#26262A] rounded-lg text-[12px]">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: getDeptColor(adminAccount.departmentCategory) }}
                  />
                  <span className="font-semibold text-white truncate max-w-[140px] sm:max-w-[200px]">
                    {adminAccount.departmentName}
                  </span>
                  <span className="text-[#8B8B94] hidden md:inline">
                    • 15km ({adminAccount.stationName})
                  </span>
                  {adminAccount.ngoCode && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(adminAccount.ngoCode || '');
                        alert(`Copied NGO Code: ${adminAccount.ngoCode}`);
                      }}
                      className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-mono font-bold tracking-wider hover:bg-emerald-900 transition-colors"
                      title="Click to copy team join code"
                    >
                      Code: {adminAccount.ngoCode}
                    </button>
                  )}
                </div>
              )}

              {pageTitle === 'Dashboard' && !adminAccount && (
                <div className="flex items-center gap-1.5 pl-3 border-l border-[#26262A]">
                  <span className="text-[11px] text-[#8B8B94] font-medium hidden sm:inline">Sector:</span>
                  <select
                    value={selectedSectorId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedSectorId(val);
                      setSelectedNeed(null);
                    }}
                    className="h-8 bg-[#141416] border border-[#26262A] rounded-[6px] px-2.5 text-[12px] text-white focus:outline-none"
                    title="Active Operational Sector"
                  >
                    <option value="ALL">All Sectors (National)</option>
                    {sectors.map((sec) => (
                      <option key={sec.id} value={sec.id}>{sec.name}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowSectorModal(true)}
                    className="h-8 px-2.5 bg-[#141416] hover:bg-[#1A1A1D] border border-[#26262A] text-white text-[11px] font-medium rounded-[6px] flex items-center gap-1 transition-colors"
                    title="Manage Sectors"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Sector</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right Controls: Theme Toggle + New Report button + Avatar menu */}
            <div className="flex items-center gap-3">
              <ThemeToggle />

              <button
                type="button"
                onClick={() => setShowNewReportModal(true)}
                className="h-9 px-3.5 bg-[#141416] hover:bg-[#1A1A1D] border border-[#26262A] text-white rounded-[8px] text-[13px] font-medium transition-colors flex items-center gap-1.5"
              >
                <PlusIcon className="w-4 h-4 text-white" />
                <span>New report</span>
              </button>

              {/* Avatar menu trigger */}
              <div className="relative" ref={avatarMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowAvatarMenu((prev) => !prev)}
                  className="w-8 h-8 rounded-full bg-[#26262A] text-white text-[13px] font-semibold flex items-center justify-center hover:ring-1 hover:ring-[#8B8B94] transition-all"
                  title="Account menu"
                >
                  AD
                </button>

                {showAvatarMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-[#141416] border border-[#26262A] rounded-[10px] shadow-xl p-2 z-[1000] text-[13px]">
                    <div className="px-3 py-2 border-b border-[#26262A] mb-1">
                      <p className="font-semibold text-white truncate">
                        {adminAccount ? adminAccount.departmentName : 'Admin Command'}
                      </p>
                      <p className="text-[11px] text-[#8B8B94]">
                        {adminAccount ? `${adminAccount.stationName} • 15km Radius` : 'Dispatcher'}
                      </p>
                      {adminAccount?.ngoCode && (
                        <p className="text-[11px] text-emerald-400 font-mono mt-1 font-bold">
                          NGO Code: {adminAccount.ngoCode}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAvatarMenu(false);
                        setShowAdminLoginModal(true);
                      }}
                      className="w-full text-left px-3 py-2 text-[#F2F2F3] hover:bg-[#1A1A1D] rounded-[8px] transition-colors"
                    >
                      Switch Department / Station
                    </button>
                    <Link
                      to="/volunteer"
                      onClick={() => setShowAvatarMenu(false)}
                      className="block px-3 py-2 text-[#F2F2F3] hover:bg-[#1A1A1D] rounded-[8px] transition-colors"
                    >
                      Open field portal
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAvatarMenu(false);
                        handleLogoutAdmin();
                      }}
                      className="w-full text-left px-3 py-2 text-[#E5383B] hover:text-red-400 hover:bg-[#1A1A1D] rounded-[8px] transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Area: Render child routes or Dashboard */}
          <main className="flex-1 overflow-y-auto min-h-0 bg-[#0E0E10]">
            <Routes>
              {/* Dashboard */}
              <Route
                index
                element={
                  <div className="h-full flex flex-col min-h-0 p-6 space-y-4 overflow-hidden">
                    {/* Row 1: Stat strip (h-[88px], 1 bordered container divided into 4 equal cells) */}
                    <div className="h-[88px] border border-[#26262A] bg-[#141416] rounded-[10px] grid grid-cols-4 divide-x divide-[#26262A] shrink-0">
                      <div className="flex flex-col justify-center px-6">
                        <span className="text-[13px] text-[#8B8B94]">Active crises</span>
                        <span className="text-[32px] font-semibold text-white leading-none mt-1 tabular-nums">
                          {activeCount}
                        </span>
                      </div>
                      <div className="flex flex-col justify-center px-6">
                        <span className="text-[13px] text-[#8B8B94]">Responders en route</span>
                        <span className="text-[32px] font-semibold text-white leading-none mt-1 tabular-nums">
                          {enRouteCount}
                        </span>
                      </div>
                      <div className="flex flex-col justify-center px-6">
                        <span className="text-[13px] text-[#8B8B94]">Volunteers ready</span>
                        <span className="text-[32px] font-semibold text-white leading-none mt-1 tabular-nums">
                          {volunteersReady}
                        </span>
                      </div>
                      <div className="flex flex-col justify-center px-6">
                        <span className="text-[13px] text-[#8B8B94]">Incidents resolved</span>
                        <span className="text-[32px] font-semibold text-white leading-none mt-1 tabular-nums">
                          {resolvedCount}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: AI prediction line (h-10, amber on #1C1608 with 1px #3A2E0E border) */}
                    {predictionBannerVisible && predictions.length > 0 && (
                      <div className="h-10 px-4 bg-[#1C1608] border border-[#3A2E0E] rounded-[8px] text-[13px] text-[#E8A317] flex items-center justify-between shrink-0">
                        <div className="truncate">
                          <span>{predictions[0].city} · Flood risk predicted. {predictions[0].recommendedPreventiveAction}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPredictionBannerVisible(false)}
                          className="text-[#E8A317] hover:text-white p-1 ml-4"
                          title="Dismiss"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Row 3: Workspace fills the rest, grid [1fr_clamp(380px,28vw,480px)] gap-4 */}
                    <div className="flex-1 grid grid-cols-[1fr_clamp(380px,28vw,480px)] gap-4 min-h-0 h-[calc(100vh-200px)] relative">
                      {/* MAP (Left) */}
                      <div className="w-full h-full border border-[#26262A] rounded-[10px] overflow-hidden relative z-0 isolate bg-[#141416]">
                        <MapContainer
                          center={[20.5937, 78.9629]}
                          zoom={5}
                          style={{ width: '100%', height: '100%', minHeight: '100%' }}
                          zoomControl={false}
                        >
                          <TileLayer
                            key={mapLayer}
                            url={TILE_LAYERS[mapLayer].url}
                            attribution={TILE_LAYERS[mapLayer].attribution}
                            className={TILE_LAYERS[mapLayer].className}
                            maxZoom={19}
                          />
                          <MapController
                            points={activePoints}
                            selectedNeed={selectedNeed}
                            centerTarget={operationalCenter ? [operationalCenter.lat, operationalCenter.lng] : null}
                          />
                          <HeatmapOverlay data={heatmapData} enabled={heatmapEnabled} />

                          {/* 15km Operational visual boundary circle */}
                          {operationalCenter && (
                            <Circle
                              center={[operationalCenter.lat, operationalCenter.lng]}
                              radius={operationalCenter.radiusKm * 1000}
                              pathOptions={{
                                color: getDeptColor(adminAccount?.departmentCategory),
                                weight: 2,
                                dashArray: '6, 6',
                                fillColor: getDeptColor(adminAccount?.departmentCategory),
                                fillOpacity: 0.05
                              }}
                            />
                          )}

                          {/* Station HQ marker */}
                          {adminAccount?.hqCoords && (
                            <CircleMarker
                              center={[adminAccount.hqCoords.lat, adminAccount.hqCoords.lng]}
                              radius={7}
                              pathOptions={{
                                color: '#FFFFFF',
                                weight: 2,
                                fillColor: getDeptColor(adminAccount.departmentCategory),
                                fillOpacity: 1
                              }}
                            >
                              <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                                <span className="text-[12px] font-sans font-semibold">
                                  {getDeptEmoji(adminAccount.departmentCategory)} {adminAccount.departmentName} (HQ) • 15km Area
                                </span>
                              </Tooltip>
                            </CircleMarker>
                          )}

                          {/* Active Responders in 15km Radius (Scoped to NGO team if NGO admin) */}
                          {scopedVolunteers.map((v) => {
                            if (!v.locationCoords?.lat || !v.locationCoords?.lng) return null;
                            return (
                              <CircleMarker
                                key={`map-vol-${v.id}`}
                                center={[v.locationCoords.lat, v.locationCoords.lng]}
                                radius={5}
                                pathOptions={{
                                  color: '#FFFFFF',
                                  weight: 1.5,
                                  fillColor: v.status === 'AVAILABLE' ? '#10B981' : '#F59E0B',
                                  fillOpacity: 0.95
                                }}
                              >
                                <Tooltip direction="top" offset={[0, -5]} opacity={1}>
                                  <span className="text-[12px] font-sans">
                                    🦺 {v.name} ({v.ngo || 'Responder'}) · {v.status}
                                    {v.ngoCode ? ` [Code: ${v.ngoCode}]` : ''}
                                  </span>
                                </Tooltip>
                              </CircleMarker>
                            );
                          })}

                          {/* Pins: 14px circles colored by severity (>=85 red, 65-84 amber, <65 gray) */}
                          {scopedNeeds.map((n) => {
                            if (!n.location?.lat || !n.location?.lng) return null;
                            const isSelected = selectedNeed?.id === n.id;
                            const score = n.criticalityScore || 0;
                            const pinColor = score >= 85 ? '#E5383B' : score >= 65 ? '#E8A317' : '#8B8B94';

                            return (
                              <CircleMarker
                                key={n.id}
                                center={[n.location.lat, n.location.lng]}
                                radius={isSelected ? 10 : 7}
                                pathOptions={{
                                  color: isSelected ? '#FFFFFF' : '#0E0E10',
                                  weight: 2,
                                  fillColor: pinColor,
                                  fillOpacity: 1
                                }}
                                eventHandlers={{
                                  click: () => setSelectedNeed(n)
                                }}
                              >
                                <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                                  <span className="text-[13px] font-sans font-medium">
                                    {n.crisisType} · {n.location.name} · Score {score.toFixed(0)}
                                    {n.respondingParty || (n.enRouteVolunteers && n.enRouteVolunteers.length > 0) || n.responseStatus === 'RESPONDING'
                                      ? ' · 🟢 Responding'
                                      : n.status === 'RESOLVED'
                                      ? ' · ✓ Resolved'
                                      : ' · ⏳ Awaiting Response'}
                                  </span>
                                </Tooltip>
                              </CircleMarker>
                            );
                          })}
                        </MapContainer>

                        {/* Top-left Layer switch: Dark | Light & Heatmap toggle */}
                        <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2">
                          <div className="bg-[#141416] border border-[#26262A] rounded-[8px] p-0.5 flex text-[13px]">
                            <button
                              type="button"
                              onClick={() => setMapLayer('dark')}
                              className={`px-3 py-1 rounded-[6px] font-medium transition-colors ${
                                mapLayer === 'dark' ? 'bg-[#1A1A1D] text-white' : 'text-[#8B8B94] hover:text-white'
                              }`}
                            >
                              Dark
                            </button>
                            <button
                              type="button"
                              onClick={() => setMapLayer('light')}
                              className={`px-3 py-1 rounded-[6px] font-medium transition-colors ${
                                mapLayer === 'light' ? 'bg-[#1A1A1D] text-white' : 'text-[#8B8B94] hover:text-white'
                              }`}
                            >
                              Light
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setHeatmapEnabled((prev) => !prev)}
                            className={`h-8 px-3 rounded-[8px] border text-[13px] font-medium transition-colors ${
                              heatmapEnabled
                                ? 'bg-[#1A1A1D] border-[#8B8B94] text-white'
                                : 'bg-[#141416] border-[#26262A] text-[#8B8B94] hover:text-white'
                            }`}
                          >
                            Heatmap
                          </button>
                        </div>
                      </div>

                      {/* INCIDENTS PANEL (Right) */}
                      <div className="border border-[#26262A] bg-[#141416] rounded-[10px] flex flex-col min-h-0 overflow-hidden relative">
                        {/* Header */}
                        <div className="p-3.5 border-b border-[#26262A] flex items-center justify-between shrink-0 text-[13px]">
                          <div className="flex items-center gap-3">
                            <span className="text-[15px] font-semibold text-white">Incidents</span>
                            <span className="text-[#8B8B94] tabular-nums">
                              {dashboardIncidents.length}
                            </span>
                            <label className="flex items-center gap-1.5 text-[11px] text-[#8B8B94] cursor-pointer ml-1">
                              <input
                                type="checkbox"
                                checked={showResolvedInList}
                                onChange={(e) => setShowResolvedInList(e.target.checked)}
                                className="rounded border-[#26262A] bg-[#0E0E10] text-white focus:ring-0"
                              />
                              <span>Show resolved</span>
                            </label>
                          </div>

                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="bg-[#0E0E10] border border-[#26262A] rounded-[8px] px-2.5 py-1 text-[13px] text-[#F2F2F3] focus:outline-none"
                          >
                            <option value="criticality">Highest criticality</option>
                            <option value="newest">Newest</option>
                          </select>
                        </div>

                        {/* List: scrolls inside panel only */}
                        <div className="flex-1 overflow-y-auto divide-y divide-[#26262A]">
                          {dashboardIncidents.length === 0 ? (
                            <div className="p-8 text-center text-[13px] text-[#8B8B94]">
                              No active incidents in queue.
                            </div>
                          ) : (
                            dashboardIncidents.map((need) => {
                              const isSelected = selectedNeed?.id === need.id;
                              const score = need.criticalityScore || 0;
                              const isCritical = score >= 85;
                              const dotColor = isCritical ? '#E5383B' : score >= 65 ? '#E8A317' : '#8B8B94';

                              return (
                                <div
                                  key={need.id}
                                  onClick={() => setSelectedNeed(need)}
                                  className={`min-h-[68px] px-4 py-3 cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-[#1A1A1D] border-l-2 border-white'
                                      : 'hover:bg-[#1A1A1D]'
                                  }`}
                                >
                                  {/* Line 1: severity dot 8px | "Infrastructure · Delhi (Chandni Chowk)" 15px medium | right: score 15px semibold */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: dotColor }}
                                      />
                                      <span className="text-[15px] font-medium text-white truncate capitalize">
                                        {need.crisisType} · {need.location.name}
                                      </span>
                                    </div>
                                    <span
                                      className={`text-[15px] font-semibold tabular-nums shrink-0 ${
                                        isCritical ? 'text-[#E5383B]' : 'text-[#F2F2F3]'
                                      }`}
                                    >
                                      {score.toFixed(0)}
                                    </span>
                                  </div>

                                  {/* Line 2: one-line description 13px secondary | right: "1h ago" 13px secondary */}
                                  <div className="flex items-center justify-between gap-4 mt-1 text-[13px] text-[#8B8B94]">
                                    <span className="truncate">
                                      {need.urgencyReasoning || 'Citizen distress call recorded.'}
                                    </span>
                                    <span className="shrink-0 tabular-nums">
                                      {formatShortTimeAgo(need.reportedAt)}
                                    </span>
                                  </div>

                                  {/* Line 3: Response status tag */}
                                  <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-[#26262A]/60">
                                    {need.respondingParty || (need.enRouteVolunteers && need.enRouteVolunteers.length > 0) || need.responseStatus === 'RESPONDING' ? (
                                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded truncate max-w-[280px]">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                        <span className="truncate">Responding: {need.respondingParty || need.enRouteVolunteers?.[0]?.name || 'Response Unit Dispatched'}</span>
                                      </span>
                                    ) : need.status === 'RESOLVED' ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 bg-zinc-800/50 px-2 py-0.5 rounded">
                                        ✓ Resolved
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-300 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                        Awaiting Response Unit
                                      </span>
                                    )}
                                    {need.status && (
                                      <span className="text-[11px] text-[#8B8B94] uppercase tracking-wider font-mono shrink-0">
                                        {need.status.replace(/_/g, ' ')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* INCIDENT DRAWER: 440px right slide-over (overlays panel, 150ms slide, Esc closes, scrim none) */}
                        {selectedNeed && (
                          <div className="absolute inset-y-0 right-0 w-[440px] bg-[#141416] border-l border-[#26262A] shadow-2xl z-20 flex flex-col min-h-0 transition-transform duration-150">
                            {/* Drawer Header */}
                            <div className="p-4 border-b border-[#26262A] flex items-center justify-between shrink-0">
                              <h3 className="text-[15px] font-semibold text-white capitalize truncate pr-2">
                                {selectedNeed.crisisType} · {selectedNeed.location.name}
                              </h3>
                              <button
                                type="button"
                                onClick={() => setSelectedNeed(null)}
                                className="p-1 text-[#8B8B94] hover:text-white rounded-[6px]"
                              >
                                <XMarkIcon className="w-5 h-5" />
                              </button>
                            </div>

                            {/* Drawer Content */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[13px]">
                              {/* Chips row (status, "Score 95") */}
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-[6px] font-medium text-[13px] ${
                                  selectedNeed.status === 'RESOLVED'
                                    ? 'bg-[#2E9E6B]/15 text-[#2E9E6B]'
                                    : selectedNeed.status === 'VERIFIED'
                                    ? 'bg-[#E8A317]/15 text-[#E8A317]'
                                    : (selectedNeed.status === 'EN_ROUTE' || selectedNeed.status === 'ON_SCENE')
                                    ? 'bg-[#4C8DFF]/15 text-[#4C8DFF]'
                                    : selectedNeed.status === 'FALSE_ALARM'
                                    ? 'text-[#8B8B94] line-through'
                                    : 'bg-[#26262A] text-[#8B8B94]'
                                }`}>
                                  {selectedNeed.status.replace(/_/g, ' ')}
                                </span>

                                <span className="px-2.5 py-1 rounded-[6px] bg-[#26262A] text-white font-semibold tabular-nums text-[13px]">
                                  Score {selectedNeed.criticalityScore?.toFixed(0) || 75}
                                </span>
                              </div>

                              {/* Response Tracking Status Banner */}
                              <div className={`p-3 rounded-[8px] border text-[13px] ${
                                selectedNeed.respondingParty || (selectedNeed.enRouteVolunteers && selectedNeed.enRouteVolunteers.length > 0) || selectedNeed.responseStatus === 'RESPONDING'
                                  ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                                  : selectedNeed.status === 'RESOLVED'
                                  ? 'bg-zinc-900 border-zinc-700 text-zinc-300'
                                  : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                              }`}>
                                <div className="flex items-center justify-between font-medium">
                                  <span className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full ${
                                      selectedNeed.respondingParty || (selectedNeed.enRouteVolunteers && selectedNeed.enRouteVolunteers.length > 0) || selectedNeed.responseStatus === 'RESPONDING'
                                        ? 'bg-emerald-400 animate-pulse'
                                        : selectedNeed.status === 'RESOLVED'
                                        ? 'bg-zinc-400'
                                        : 'bg-amber-400'
                                    }`} />
                                    {selectedNeed.respondingParty || (selectedNeed.enRouteVolunteers && selectedNeed.enRouteVolunteers.length > 0) || selectedNeed.responseStatus === 'RESPONDING'
                                      ? 'Response Unit Active'
                                      : selectedNeed.status === 'RESOLVED'
                                      ? 'Incident Resolved'
                                      : 'Awaiting Response Unit'}
                                  </span>
                                  <span className="text-[11px] opacity-80 uppercase tracking-wider font-mono">
                                    {selectedNeed.responseStatus || (selectedNeed.enRouteVolunteers && selectedNeed.enRouteVolunteers.length > 0 ? 'RESPONDING' : 'PENDING')}
                                  </span>
                                </div>
                                {(selectedNeed.respondingParty || (selectedNeed.enRouteVolunteers && selectedNeed.enRouteVolunteers.length > 0)) && (
                                  <div className="mt-1.5 text-[12px] text-white/90">
                                    Responding: <span className="font-semibold text-white">{selectedNeed.respondingParty || selectedNeed.enRouteVolunteers?.[0]?.name}</span>
                                    {selectedNeed.enRouteVolunteers?.[0]?.etaMinutes && (
                                      <span className="ml-2 text-[#8B8B94] font-mono">
                                        (ETA ~{selectedNeed.enRouteVolunteers[0].etaMinutes}m)
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Description */}
                              <div>
                                <span className="text-[#8B8B94] text-[11px] block mb-1">Incident Report Details</span>
                                <p className="text-[#F2F2F3] text-[13px] leading-relaxed">
                                  {selectedNeed.urgencyReasoning || 'Citizen distress call recorded.'}
                                </p>
                              </div>

                              {/* Meta List */}
                              <div className="border border-[#26262A] rounded-[8px] p-3 space-y-2 bg-[#0E0E10] text-[13px]">
                                <div className="flex justify-between">
                                  <span className="text-[#8B8B94]">Ticket</span>
                                  <span className="text-white font-semibold tabular-nums">
                                    {selectedNeed.ticketCode || selectedNeed.id.slice(0, 8)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-[#8B8B94]">Reported time</span>
                                  <span className="text-white tabular-nums">
                                    {new Date(selectedNeed.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-[#8B8B94]">Est. affected</span>
                                  <span className="text-white tabular-nums">
                                    ~{selectedNeed.estimatedScale || 30} people
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-[#8B8B94]">Reports merged</span>
                                  <span className="text-white tabular-nums">
                                    {selectedNeed.reportCount || 1}
                                  </span>
                                </div>
                              </div>

                              {/* Photo / Audio if present */}
                              {selectedNeed.mediaUrls && selectedNeed.mediaUrls.length > 0 && (
                                <div>
                                  <span className="text-[#8B8B94] text-[11px] block mb-1.5">Attached media</span>
                                  <div className="flex gap-2">
                                    {selectedNeed.mediaUrls.map((url, i) => (
                                      <img
                                        key={i}
                                        src={url}
                                        alt="Incident"
                                        className="w-20 h-20 rounded-[8px] object-cover border border-[#26262A]"
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Assigned Responder Card + Allocated Supplies */}
                              {selectedNeed.enRouteVolunteers && selectedNeed.enRouteVolunteers.length > 0 && (
                                <div className="border border-[#26262A] rounded-[8px] p-3 bg-[#0E0E10] space-y-2">
                                  <span className="text-[#8B8B94] text-[11px] block">Assigned responder</span>
                                  {selectedNeed.enRouteVolunteers.map((v) => (
                                    <div key={v.id} className="flex items-center justify-between">
                                      <div>
                                        <p className="font-semibold text-white">{v.name}</p>
                                        <p className="text-[11px] text-[#8B8B94]">{v.ngo || 'Rescue unit'}</p>
                                      </div>
                                      {v.etaMinutes && (
                                        <span className="text-[#4C8DFF] tabular-nums font-medium">
                                          ETA {v.etaMinutes}m
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                  {selectedNeed.allocatedSupplies && (
                                    <div className="pt-2 border-t border-[#26262A] text-[11px] text-[#8B8B94]">
                                      <span>Supplies allocated: </span>
                                      <span className="text-white">{selectedNeed.allocatedSupplies.join(', ')}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Updates timeline */}
                              <div>
                                <span className="text-[#8B8B94] text-[11px] block mb-2">Updates</span>
                                <div className="space-y-2 border-l border-[#26262A] pl-3 ml-1">
                                  {(selectedNeed.timeline || [
                                    { timestamp: selectedNeed.reportedAt, description: 'Signal ingested into crisis registry.' }
                                  ]).map((evt, idx) => (
                                    <div key={idx} className="space-y-0.5">
                                      <span className="text-[11px] text-[#8B8B94] tabular-nums block">
                                        {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      <span className="text-white text-[13px]">{evt.description}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Sticky Footer Buttons (depend strictly on status) */}
                            <div className="p-4 border-t border-[#26262A] bg-[#141416] shrink-0">
                              {selectedNeed.status === 'UNVERIFIED' && (
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleVerify(selectedNeed.id, 'VERIFIED')}
                                      className="flex-1 h-10 bg-white hover:bg-zinc-200 text-black font-semibold rounded-[8px] text-[13px] transition-colors cursor-pointer"
                                    >
                                      Verify incident
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleVerify(selectedNeed.id, 'REJECTED_SPAM')}
                                      className="h-10 px-4 bg-[#141416] hover:bg-[#1A1A1D] border border-[#26262A] text-[#8B8B94] hover:text-white rounded-[8px] text-[13px] transition-colors cursor-pointer"
                                    >
                                      Reject as false alarm
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDispatch(selectedNeed.id)}
                                    disabled={loadingDispatch}
                                    className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-[8px] text-[13px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                  >
                                    🚀 {loadingDispatch ? 'Dispatching Support...' : 'Dispatch Support Unit'}
                                  </button>
                                </div>
                              )}

                              {selectedNeed.status === 'VERIFIED' && (
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleDispatch(selectedNeed.id)}
                                      disabled={loadingDispatch}
                                      className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-[8px] text-[13px] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/50"
                                    >
                                      🚀 {loadingDispatch ? 'Dispatching Support...' : 'Dispatch Support Unit'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => navigate('/admin/volunteers')}
                                      className="h-10 px-4 bg-[#141416] hover:bg-[#1A1A1D] border border-[#26262A] text-white rounded-[8px] text-[13px] transition-colors cursor-pointer"
                                    >
                                      Choose volunteer
                                    </button>
                                  </div>
                                </div>
                              )}

                              {(selectedNeed.status === 'EN_ROUTE' || selectedNeed.status === 'ON_SCENE' || selectedNeed.status === 'DISPATCHED') && (
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => navigate('/admin/volunteers')}
                                    className="flex-1 h-10 bg-[#141416] hover:bg-[#1A1A1D] border border-[#26262A] text-white rounded-[8px] text-[13px] transition-colors cursor-pointer"
                                  >
                                    View responder
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleResolve(selectedNeed.id)}
                                    className="h-10 px-4 bg-[#141416] hover:bg-[#1A1A1D] border border-[#26262A] text-white rounded-[8px] text-[13px] transition-colors cursor-pointer"
                                  >
                                    Mark resolved
                                  </button>
                                </div>
                              )}

                              {selectedNeed.status === 'RESOLVED' && (
                                <div className="text-center text-[13px] text-[#2E9E6B] font-medium py-1">
                                  Incident is resolved. Case closed.
                                </div>
                              )}

                              {selectedNeed.status === 'FALSE_ALARM' && (
                                <div className="text-center text-[13px] text-[#8B8B94] font-medium py-1">
                                  Incident rejected as false alarm.
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                }
              />

              {/* Volunteers Page */}
              <Route path="volunteers" element={<VolunteersPage />} />

              {/* Inventory Page */}
              <Route path="inventory" element={<AdminInventoryPage />} />

              {/* Analytics Page */}
              <Route path="analytics" element={<AnalyticsPage />} />

              {/* History Page */}
              <Route path="history" element={<HistoryPage onSelectIncident={(n) => setSelectedNeed(n)} />} />
            </Routes>
          </main>
        </div>
      </div>

      {/* SINGLE TOAST NOTIFICATION: 360px wide, bottom-right */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[1500] w-[360px] bg-[#141416] border border-[#E5383B] rounded-[10px] shadow-2xl p-4 text-[13px]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#E5383B]" />
                <span className="font-semibold text-[#E5383B]">Critical</span>
                {toast.count > 1 && (
                  <span className="px-1.5 py-0.2 bg-red-950/60 border border-red-800 text-[#E5383B] text-[10px] font-semibold rounded tabular-nums">
                    +{toast.count}
                  </span>
                )}
              </div>
              <p className="text-[15px] font-medium text-white mt-1 capitalize">
                {toast.need.crisisType} · {toast.need.location.name}
              </p>
              <p className="text-[13px] text-[#8B8B94] mt-0.5 tabular-nums">
                Score {toast.need.criticalityScore?.toFixed(0) || 90}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-[#8B8B94] hover:text-white p-1"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedNeed(toast.need);
                setToast(null);
              }}
              className="h-8 px-4 bg-white hover:bg-zinc-200 text-black text-[13px] font-medium rounded-[8px] transition-colors"
            >
              Assign
            </button>
          </div>
        </div>
      )}

      {/* NEW REPORT MODAL */}
      {showNewReportModal && (
        <div className="fixed inset-0 z-[2000] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#26262A] rounded-[10px] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#26262A] pb-3">
              <h3 className="text-[15px] font-semibold text-white">Ingest New Incident Report</h3>
              <button
                type="button"
                onClick={() => setShowNewReportModal(false)}
                className="text-[#8B8B94] hover:text-white p-1"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReport} className="space-y-4 text-[13px]">
              <div>
                <label className="block text-[#8B8B94] font-medium mb-1">
                  Incident Signal Text
                </label>
                <textarea
                  value={newReportText}
                  onChange={(e) => setNewReportText(e.target.value)}
                  placeholder="e.g. Flooding reported in Andheri subway, water level 4 feet, 10 vehicles trapped."
                  rows={4}
                  className="w-full bg-[#0E0E10] border border-[#26262A] rounded-[8px] p-3 text-white placeholder-[#8B8B94] focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-[#8B8B94] font-medium mb-1">
                  Attach Photo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewReportImage(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-[13px] text-[#8B8B94] file:mr-3 file:py-1.5 file:px-3 file:rounded-[6px] file:border-0 file:text-[13px] file:font-medium file:bg-[#26262A] file:text-white hover:file:bg-[#3F3F46]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#26262A]">
                <button
                  type="button"
                  onClick={() => setShowNewReportModal(false)}
                  className="h-9 px-4 border border-[#26262A] text-[#8B8B94] hover:text-white rounded-[8px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="h-9 px-4 bg-white hover:bg-zinc-200 text-black font-semibold rounded-[8px] transition-colors disabled:opacity-50"
                >
                  {isSubmittingReport ? 'Ingesting...' : 'Ingest report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MANAGE SECTORS MODAL */}
      {showSectorModal && (
        <div className="fixed inset-0 z-[2000] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#26262A] rounded-[10px] max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#26262A] pb-3">
              <div>
                <h3 className="text-[16px] font-semibold text-white">Manage Operational Sectors</h3>
                <p className="text-[12px] text-[#8B8B94] mt-0.5">Define regional jurisdictions and dispatch radiuses.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSectorModal(false)}
                className="text-[#8B8B94] hover:text-white p-1"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Form: Add new Sector */}
            <form onSubmit={handleAddSector} className="space-y-3 p-3.5 bg-[#0E0E10] border border-[#26262A] rounded-[8px] text-[13px]">
              <span className="font-semibold text-white text-[13px] block">Create New Sector</span>
              <div>
                <label className="block text-[#8B8B94] text-[11px] uppercase tracking-wider mb-1">Sector Name</label>
                <input
                  type="text"
                  required
                  value={newSectorName}
                  onChange={(e) => setNewSectorName(e.target.value)}
                  placeholder="e.g. Bagru Industrial Zone, Amer North"
                  className="w-full h-9 bg-[#141416] border border-[#26262A] rounded-[6px] px-3 text-white placeholder-[#8B8B94] focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#8B8B94] text-[11px] uppercase tracking-wider mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newSectorLat}
                    onChange={(e) => setNewSectorLat(e.target.value)}
                    placeholder="e.g. 26.8143"
                    className="w-full h-9 bg-[#141416] border border-[#26262A] rounded-[6px] px-3 text-white placeholder-[#8B8B94] focus:outline-none focus:border-zinc-500 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[#8B8B94] text-[11px] uppercase tracking-wider mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newSectorLng}
                    onChange={(e) => setNewSectorLng(e.target.value)}
                    placeholder="e.g. 75.5447"
                    className="w-full h-9 bg-[#141416] border border-[#26262A] rounded-[6px] px-3 text-white placeholder-[#8B8B94] focus:outline-none focus:border-zinc-500 tabular-nums"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <label className="text-[#8B8B94] text-[12px]">Radius:</label>
                  <select
                    value={newSectorRadius}
                    onChange={(e) => setNewSectorRadius(Number(e.target.value))}
                    className="h-8 bg-[#141416] border border-[#26262A] rounded-[6px] px-2 text-[12px] text-white"
                  >
                    <option value={5}>5 km</option>
                    <option value={15}>15 km</option>
                    <option value={25}>25 km</option>
                    <option value={50}>50 km</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDetectGpsForSector}
                    disabled={isDetectingGps}
                    className="h-8 px-2.5 bg-[#141416] hover:bg-[#1A1A1D] border border-[#26262A] text-[12px] text-white rounded-[6px] transition-colors"
                  >
                    {isDetectingGps ? 'Detecting...' : '📍 Use Current GPS'}
                  </button>
                  <button
                    type="submit"
                    className="h-8 px-3.5 bg-white hover:bg-zinc-200 text-black font-semibold text-[12px] rounded-[6px] transition-colors"
                  >
                    Add Sector
                  </button>
                </div>
              </div>
            </form>

            {/* List of Defined Sectors */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#8B8B94] uppercase tracking-wider font-semibold block">
                  Configured Sectors ({sectors.length})
                </span>
                <button
                  type="button"
                  onClick={handleResetSectors}
                  className="text-[11px] text-[#8B8B94] hover:text-white underline transition-colors"
                >
                  Reset to default sectors
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {sectors.map((sec) => (
                  <div key={sec.id} className="p-2.5 bg-[#0E0E10] border border-[#26262A] rounded-[6px] flex items-center justify-between text-[13px]">
                    <div>
                      <p className="font-medium text-white">{sec.name}</p>
                      <p className="text-[11px] text-[#8B8B94] tabular-nums mt-0.5">
                        Center: {sec.lat.toFixed(4)}, {sec.lng.toFixed(4)} · Radius: {sec.radiusKm} km
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSectorId(sec.id);
                          setShowSectorModal(false);
                        }}
                        className="h-7 px-2.5 bg-[#141416] hover:bg-[#1A1A1D] border border-[#26262A] text-white text-[11px] rounded-[4px]"
                      >
                        Activate
                      </button>
                      {sectors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSector(sec.id)}
                          className="text-[#8B8B94] hover:text-red-400 p-1"
                          title="Remove sector"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ADMIN DEPARTMENT LOGIN & REGISTRATION GATE */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-[2500] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#26262A] rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="text-center space-y-1.5 pb-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white font-bold text-xl mb-1 shadow-lg shadow-sky-950">
                🛡️
              </div>
              <h2 className="text-[20px] font-semibold text-white tracking-tight">
                Command Center Secure Access
              </h2>
              <p className="text-[13px] text-[#8B8B94] max-w-md mx-auto">
                Official emergency department & NGO team authentication.
              </p>
            </div>

            {/* Auth Mode Tabs */}
            <div className="flex border-b border-[#26262A] text-[13px] font-semibold">
              <button
                type="button"
                onClick={() => { setAuthTab('signin'); setAuthError(''); }}
                className={`flex-1 py-2.5 text-center transition-colors border-b-2 cursor-pointer ${
                  authTab === 'signin' ? 'border-white text-white' : 'border-transparent text-[#8B8B94] hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab('register'); setAuthError(''); }}
                className={`flex-1 py-2.5 text-center transition-colors border-b-2 cursor-pointer ${
                  authTab === 'register' ? 'border-white text-white' : 'border-transparent text-[#8B8B94] hover:text-white'
                }`}
              >
                Register Department / NGO
              </button>
            </div>

            {/* Error Message */}
            {authError && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-[12px] flex items-center gap-2">
                <span>⚠️</span>
                <span>{authError}</span>
              </div>
            )}

            {/* TAB 1: SIGN IN FORM */}
            {authTab === 'signin' ? (
              <form onSubmit={handleAdminSignIn} className="space-y-4 text-[13px] pt-1">
                <div>
                  <label className="block text-[#8B8B94] font-medium mb-1">
                    Email ID *
                  </label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="name@agency.gov.in"
                    className="w-full h-10 bg-[#0E0E10] border border-[#26262A] rounded-xl px-3 text-white text-[14px] focus:outline-none focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-[#8B8B94] font-medium mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 bg-[#0E0E10] border border-[#26262A] rounded-xl px-3 text-white text-[14px] focus:outline-none focus:border-white"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full h-11 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl text-[14px] transition-colors shadow-lg cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isAuthLoading ? 'Authenticating...' : 'Sign In to Command Center →'}
                  </button>
                </div>
              </form>
            ) : (
              /* TAB 2: REGISTER FORM */
              <form onSubmit={handleAdminRegister} className="space-y-4 text-[13px] pt-1">
                {/* Credentials */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#8B8B94] font-medium mb-1">
                      Email ID (Unique) *
                    </label>
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="admin@agency.org"
                      className="w-full h-10 bg-[#0E0E10] border border-[#26262A] rounded-xl px-3 text-white text-[13px] focus:outline-none focus:border-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[#8B8B94] font-medium mb-1">
                      Password (min 6 chars) *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 bg-[#0E0E10] border border-[#26262A] rounded-xl px-3 text-white text-[13px] focus:outline-none focus:border-white"
                    />
                  </div>
                </div>

                {/* Department Category Selection */}
                <div>
                  <label className="block text-[#8B8B94] font-medium mb-1.5">
                    Select Department / Agency Category *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {DEPARTMENT_CATEGORIES.map((cat) => {
                      const isSelected = loginDeptCategory === cat.id;
                      return (
                        <button
                          type="button"
                          key={cat.id}
                          onClick={() => handleCategorySelect(cat.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#1A1A1D] border-white ring-1 ring-white/20'
                              : 'bg-[#0E0E10] border-[#26262A] hover:border-zinc-500'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{cat.emoji}</span>
                            <span className="font-semibold text-white text-[12px]">{cat.name}</span>
                          </div>
                          <p className="text-[10px] text-[#8B8B94] mt-0.5 line-clamp-1">{cat.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Department / Unit Name */}
                <div>
                  <label className="block text-[#8B8B94] font-medium mb-1">
                    Department / Organization Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={loginDeptName}
                    onChange={(e) => setLoginDeptName(e.target.value)}
                    placeholder="e.g. City Fire Station 1, Central Police, Red Cross Society"
                    className="w-full h-10 bg-[#0E0E10] border border-[#26262A] rounded-xl px-3 text-white text-[13px] focus:outline-none focus:border-white"
                  />
                </div>

                {/* Station HQ & 15km Radius */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[#8B8B94] font-medium">Station Base Location *</label>
                    <span className="text-[11px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">
                      15 km Radius Area
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {['Bagru', 'Jaipur', 'Delhi', 'Mumbai', 'Bengaluru'].map((city) => {
                      const coords = PLACE_COORDS[city];
                      const isSelected = loginStationName === city;
                      return (
                        <button
                          key={city}
                          type="button"
                          onClick={() => {
                            setLoginStationName(city);
                            if (coords) {
                              setLoginLat(coords[0]);
                              setLoginLng(coords[1]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-white text-black font-semibold'
                              : 'bg-[#0E0E10] border border-[#26262A] text-[#8B8B94] hover:text-white'
                          }`}
                        >
                          {city}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={handleDetectAdminGps}
                      disabled={isDetectingAdminGps}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#0E0E10] border border-[#26262A] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowPathIcon className={`w-3.5 h-3.5 ${isDetectingAdminGps ? 'animate-spin' : ''}`} />
                      <span>{isDetectingAdminGps ? 'Detecting...' : 'Use My GPS'}</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-[#8B8B94] flex items-center gap-2 pt-1">
                    <span>HQ: <span className="text-white font-mono">{loginLat.toFixed(4)}, {loginLng.toFixed(4)}</span></span>
                    <span>•</span>
                    <span>Operational Area: <span className="text-emerald-400 font-semibold">15 km</span></span>
                  </div>
                </div>

                {/* NGO Specific 5-letter Code Setup */}
                {loginDeptCategory === 'NGO' && (
                  <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/40 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-semibold text-[13px]">NGO Team Code</span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          5 Letters
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setIsNgoSignInMode(false)}
                          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${!isNgoSignInMode ? 'bg-emerald-500/30 text-white font-semibold' : 'text-emerald-300/70'}`}
                        >
                          Register New
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsNgoSignInMode(true)}
                          className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${isNgoSignInMode ? 'bg-emerald-500/30 text-white font-semibold' : 'text-emerald-300/70'}`}
                        >
                          Existing Code
                        </button>
                      </div>
                    </div>

                    {!isNgoSignInMode ? (
                      <div className="space-y-2">
                        <p className="text-[11px] text-emerald-200/80">
                          When your NGO registers, you get a unique 5-letter code. Share this code with your NGO members during volunteer signup so only your team shows in your dashboard:
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="px-3.5 py-1.5 bg-emerald-900/60 border border-emerald-400/50 rounded-xl text-center">
                            <span className="font-mono text-xl font-black text-emerald-300 tracking-[0.25em]">
                              {generatedNgoCode}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setGeneratedNgoCode(generate5LetterCode())}
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowPathIcon className="w-3.5 h-3.5" />
                            <span>Generate another</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-[11px] text-emerald-200/80 block">
                          Enter your existing 5-letter NGO team code:
                        </label>
                        <input
                          type="text"
                          maxLength={5}
                          placeholder="e.g. ASDCG"
                          value={loginNgoCodeInput}
                          onChange={(e) => setLoginNgoCodeInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                          className="w-full h-9 bg-[#0E0E10] border border-emerald-500/50 rounded-xl px-3 text-emerald-300 font-mono tracking-widest text-base font-bold uppercase focus:outline-none focus:border-emerald-300"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Submit */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full h-11 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl text-[14px] transition-colors shadow-lg cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isAuthLoading ? 'Registering Department...' : 'Register Department & Enter →'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
