import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  CameraIcon, 
  MicrophoneIcon, 
  StopCircleIcon,
  MapPinIcon,
  BoltIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';
import type { NeedEntity } from '../types';
import { saveOfflineReport } from '../offlineSync';
import VoiceAssistant from '../components/VoiceAssistant';
import { PhoneIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import VoiceCallModal from '../components/VoiceCallModal';

const API_BASE = import.meta.env.VITE_API_BASE || '';

type CrisisType = 'medical' | 'flood' | 'fire' | 'food' | 'infrastructure' | 'other';

interface CrisisOption {
  type: CrisisType;
  emoji: string;
  label: string;
  color: string;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    [key: number]: {
      [key: number]: { transcript: string };
      isFinal: boolean;
    };
    length: number;
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

const crisisOptions: CrisisOption[] = [
  { type: 'medical', emoji: '🚑', label: 'Medical', color: 'bg-red-500' },
  { type: 'flood', emoji: '🌊', label: 'Flood', color: 'bg-red-500' },
  { type: 'fire', emoji: '🔥', label: 'Fire', color: 'bg-orange-500' },
  { type: 'food', emoji: '🍱', label: 'Food', color: 'bg-green-500' },
  { type: 'infrastructure', emoji: '🏗️', label: 'Infrastructure', color: 'bg-zinc-500' },
  { type: 'other', emoji: '🚨', label: 'Other', color: 'bg-purple-500' },
];

export default function ReportPage() {
  const navigate = useNavigate();
  const [bgTheme, setBgTheme] = useState<'white' | 'black' | 'space'>(() => {
    return (localStorage.getItem('user-bgTheme') as 'white' | 'black' | 'space') || 'black';
  });

  useEffect(() => {
    localStorage.setItem('user-bgTheme', bgTheme);
  }, [bgTheme]);

  const isDark = bgTheme !== 'white';
  const isSpace = bgTheme === 'space';

  const theme = {
    bg: isSpace ? 'nasa-bg' : (isDark ? 'bg-[#0f1117]' : 'bg-[#F0EEE8]'),
    surface: isSpace ? 'bg-black/40 backdrop-blur-md' : (isDark ? 'bg-zinc-900' : 'bg-white'),
    surfaceSoft: isSpace ? 'bg-white/10' : (isDark ? 'bg-zinc-800/50' : 'bg-[#EEEcE6]'),
    border: isSpace ? 'border-white/10' : (isDark ? 'border-white/5' : 'border-black/8'),
    text: isDark ? 'text-zinc-100' : 'text-zinc-900',
    textMuted: isDark ? 'text-zinc-400' : 'text-zinc-600',
    accent: isDark ? 'text-sky-400' : 'text-sky-600',
  };

  const [selectedType, setSelectedType] = useState<CrisisType | null>(null);
  const [description, setDescription] = useState('');
  const [landmark, setLandmark] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [myReports, setMyReports] = useState<Array<{
    id: string;
    type: string;
    emoji: string;
    location: string;
    status: string;
    timestamp: number;
  }>>(() => {
    try {
      return JSON.parse(localStorage.getItem('my-reports') || '[]');
    } catch {
      return [];
    }
  });
  const [reportStatus, setReportStatus] = useState<string>('OPEN');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [enRouteResponders, setEnRouteResponders] = useState<Array<{ name: string; ngo?: string; phone?: string; dispatchedAt: number }>>([]);

  // Fast polling (every 3s) for active report status and en-route responders
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await axios.get(`${API_BASE}/needs`);
        const allNeeds: NeedEntity[] = res.data || [];
        
        // Find matching report either from current reportId or latest from myReports
        const targetRealId = reportId ? reportId.replace('#CP-', '').toLowerCase() : (myReports[0] as any)?.realId?.toLowerCase();
        
        let found = targetRealId ? allNeeds.find((n: NeedEntity) => n.id.toLowerCase().startsWith(targetRealId) || (n.id.toLowerCase() === targetRealId)) : null;
        if (!found && myReports.length > 0) {
          // Fallback matching by landmark/location
          found = allNeeds.find((n: NeedEntity) => n.location?.name && myReports[0]?.location && n.location.name.includes(myReports[0].location));
        }

        if (found) {
          setReportStatus(found.status);
          const responders = found.enRouteVolunteers || [];
          setEnRouteResponders(responders);

          // Update myReports local state
          setMyReports(prev => prev.map((r, i) => {
            if (i === 0) {
              return { ...r, status: found!.status, enRouteVolunteers: responders };
            }
            return r;
          }));
        }
      } catch {
        // silent
      }
    };

    const interval = setInterval(checkStatus, 3000);
    checkStatus();
    return () => clearInterval(interval);
  }, [isSuccess, reportId, myReports]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startRecording = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return alert("Voice not supported");
    
    const recognition = new SpeechRec();
    recognition.lang = 'en-IN';
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      setDescription(event.results[0][0].transcript);
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const handleUseGPS = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLandmark(`Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}`);
      },
      () => alert("Location access denied — please type your area above")
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !description) return;
    setIsIngesting(true);

    const fullText = `Type: ${selectedType}. Description: ${description}. Location: ${landmark}`;

    try {
      if (!isOnline) {
        await saveOfflineReport({ text: fullText });
        const mockId = Math.random().toString(36).substring(2, 6).toUpperCase();
        setReportId(`#CP-${mockId}`);
        setIsSuccess(true);
      } else {
        const formData = new FormData();
        formData.append('text', fullText);
        if (selectedImage) formData.append('image', selectedImage);

        const res = await axios.post(`${API_BASE}/ingest`, formData);
        const realId = res.data.id;
        const shortId = realId.substring(0, 4).toUpperCase();
        const displayId = `#CP-${shortId}`;
        setReportId(displayId);
        setIsSuccess(true);

        // Update localStorage with realId for live tracking
        const newReport = {
          id: displayId,
          realId: realId,
          type: selectedType,
          emoji: crisisOptions.find(o => o.type === selectedType)?.emoji,
          location: landmark || 'Current Location',
          status: 'OPEN',
          timestamp: Date.now(),
          enRouteVolunteers: []
        };
        const updated = [newReport, ...myReports].slice(0, 5);
        setMyReports(updated);
        localStorage.setItem('my-reports', JSON.stringify(updated));
      }
    } catch {
      alert("Submission failed. Check connection.");
    } finally {
      setIsIngesting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className={`min-h-screen h-screen overflow-y-auto ${theme.bg} ${theme.text} flex flex-col items-center justify-center p-6 transition-all duration-300`}>
        <div className="max-w-[480px] w-full text-center space-y-8 animate-fade-in">
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 border border-green-500/30">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl font-light tracking-tight">Report Received</h1>
            <p className="font-mono text-xl text-green-500 font-bold">{reportId}</p>
          </div>

          {/* LIVE EN ROUTE ALERT CARD */}
          {(reportStatus === 'EN_ROUTE' || enRouteResponders.length > 0) ? (
            <div className="bg-emerald-950/90 border-2 border-emerald-500 p-6 rounded-[2rem] space-y-3 shadow-2xl text-left animate-pulse">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-xs font-black uppercase tracking-widest text-emerald-300">
                  🚗 RESCUE TEAM EN ROUTE!
                </span>
              </div>
              <h2 className="text-xl font-black text-white">Help is Coming to Your Location</h2>
              <p className="text-xs text-emerald-200 leading-relaxed">
                {enRouteResponders.length > 0
                  ? `${enRouteResponders.length} responder(s) are en route to your location. Please stay in a safe, visible position.`
                  : "A first responder is currently en route to your emergency site. Stand by."}
              </p>

              {enRouteResponders.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-emerald-800/80">
                  {enRouteResponders.map((resp, i) => (
                    <div key={i} className="bg-[#0d1117] p-3 rounded-xl border border-emerald-500/40 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white text-sm">{resp.name}</div>
                        <div className="text-emerald-400 text-[11px] font-semibold">{resp.ngo || 'First Responder'}</div>
                      </div>
                      {resp.phone && (
                        <a
                          href={`tel:${resp.phone}`}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow"
                        >
                          📞 Call
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={`${theme.surface} p-6 rounded-[2rem] border ${theme.border} space-y-4 shadow-xl`}>
              <p className="text-sm leading-relaxed">Trained volunteers and Command Center have been alerted. Help is on the way.</p>
              <div className="py-2 px-4 bg-green-500/10 rounded-full inline-block">
                <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">
                  Live Dispatch Pending • Standing by for nearby responders
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className={`p-4 rounded-xl border ${theme.border} ${theme.surface} flex justify-between items-center`}>
              <span className="text-xs font-bold uppercase tracking-widest opacity-60">Live Status</span>
              <span className={`text-xs font-black uppercase tracking-tighter px-2 py-1 rounded ${reportStatus === 'RESOLVED' ? 'bg-zinc-500/20 text-zinc-500' : 'bg-green-500/20 text-green-500 animate-pulse'}`}>
                {reportStatus}
              </span>
            </div>
            <button 
              onClick={() => { setIsSuccess(false); setSelectedType(null); setDescription(''); setLandmark(''); setSelectedImage(null); }}
              className="text-indigo-500 font-bold text-sm hover:underline"
            >
              Report another emergency
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen h-screen overflow-y-auto ${theme.bg} ${theme.text} transition-all duration-300 font-sans`}>
      {/* 3-Portal Switcher */}
      <div className="max-w-2xl mx-auto px-6 pt-4 flex items-center justify-between gap-2 text-xs">
        <div className="flex-1 py-1.5 px-2 rounded-xl bg-rose-600 text-white font-bold text-center flex items-center justify-center gap-1 shadow">
          <span>📢</span> Citizen SOS Portal
        </div>
        <a
          href="/volunteer"
          className="flex-1 py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all text-center font-bold flex items-center justify-center gap-1"
        >
          <span>📱</span> Volunteer Portal
        </a>
        <a
          href="/"
          className="flex-1 py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all text-center font-bold flex items-center justify-center gap-1"
        >
          <span>🖥️</span> Admin Command
        </a>
      </div>

      {/* Active En Route Mission Tracker for Reporter */}
      {myReports.length > 0 && (myReports[0].status === 'EN_ROUTE' || enRouteResponders.length > 0) && (
        <div className="max-w-[480px] mx-auto px-6 mt-4">
          <div className="bg-emerald-950/90 border-2 border-emerald-500 rounded-2xl p-4 shadow-xl space-y-1.5 animate-pulse text-left">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                🚗 HELP IS EN ROUTE!
              </span>
            </div>
            <p className="text-xs text-white font-bold">
              Responders dispatched to your location ({myReports[0].location}).
            </p>
            {enRouteResponders.length > 0 && (
              <div className="text-[11px] text-emerald-200 font-medium">
                Active team: {enRouteResponders.map(r => `${r.name} [${r.ngo || 'Responder'}]`).join(', ')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="py-6 px-10 flex justify-between items-center w-full">
        <button
          onClick={() => navigate('/')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full border ${theme.border} ${theme.surfaceSoft} ${theme.text} hover:bg-white/10 transition-all text-[11px] font-bold shadow-lg active:scale-95 group`}
        >
          <ArrowLeftIcon className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Admin Portal
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-xl">
            <BoltIcon className="w-7 h-7" />
          </div>
          <span className="font-light text-3xl tracking-tight">CommunityPulse</span>
        </div>

        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-1.5 ${theme.surfaceSoft} p-1 rounded-full border ${theme.border}`}>
            <button
              onClick={() => setBgTheme('white')}
              className={`w-3.5 h-3.5 rounded-full bg-white border transition-all hover:scale-110 ${bgTheme === 'white' ? 'border-gray-500 ring-2 ring-offset-1 ring-gray-400' : 'border-gray-300'}`}
              title="Light"
            />
            <button
              onClick={() => setBgTheme('black')}
              className={`w-3.5 h-3.5 rounded-full bg-black border transition-all hover:scale-110 ${bgTheme === 'black' ? 'border-gray-500 ring-2 ring-offset-1 ring-gray-400' : 'border-gray-300'}`}
              title="Dark"
            />
            <button
              onClick={() => setBgTheme('space')}
              className={`w-3.5 h-3.5 rounded-full bg-indigo-600 border transition-all hover:scale-110 ${bgTheme === 'space' ? 'border-indigo-400 ring-2 ring-offset-1 ring-indigo-500' : 'border-indigo-900'}`}
              title="Space"
            />
          </div>

          <button
            onClick={() => setIsVoiceOpen(true)}
            className="bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/30 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-lg group relative"
            title="Emergency AI Call"
          >
            <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20 group-hover:opacity-40"></div>
            <PhoneIcon className="w-4 h-4 z-10" />
          </button>
          <div className="bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1 flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 animate-pulse"></span>
            <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Active</span>
          </div>
        </div>
      </header>

      {!isOnline && (
        <div className="bg-amber-500 text-black text-[11px] font-bold py-2 px-6 text-center animate-pulse">
          ⚠️ You're offline — report will be sent automatically when connection returns
        </div>
      )}

      <main className="max-w-[800px] mx-auto px-10 pt-6 pb-20 space-y-10">
        <div className="space-y-2">
          <h1 className="text-4xl font-light tracking-tight leading-tight">Report an Emergency</h1>
          <p className={`${theme.textMuted} text-[0.95rem] font-medium`}>Your report reaches trained volunteers instantly.</p>
        </div>

        <form onSubmit={handleSubmit} className={`${theme.surface} rounded-[2rem] border ${theme.border} p-8 shadow-2xl space-y-8`}>
          {/* Step 1: Type */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">1. What's happening?</label>
            <div className="grid grid-cols-3 gap-3">
              {crisisOptions.map(opt => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setSelectedType(opt.type)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                    selectedType === opt.type 
                      ? `${opt.color} border-transparent text-white shadow-lg scale-105` 
                      : `${theme.surfaceSoft} ${theme.border} ${theme.textMuted} hover:border-zinc-500`
                  }`}
                >
                  <span className="text-2xl mb-1">{opt.emoji}</span>
                  <span className="text-[9px] font-bold uppercase tracking-tighter">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Description */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">2. Describe it</label>
            <div className="relative">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what you see — location, how many people, what's needed..."
                className={`w-full min-h-[120px] ${theme.surfaceSoft} ${theme.text} rounded-2xl p-4 text-sm border ${theme.border} focus:ring-2 focus:ring-blue-500/20 outline-none resize-none placeholder-zinc-500`}
              />
              <div className="absolute bottom-3 left-3 flex gap-2">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 rounded-xl border ${theme.border} ${theme.surface} hover:bg-zinc-800 transition-all ${selectedImage ? 'text-blue-500 border-blue-500/30' : ''}`}
                >
                  <CameraIcon className="w-5 h-5" />
                </button>
                <button 
                  type="button"
                  onClick={startRecording}
                  className={`p-2 rounded-xl border ${theme.border} ${theme.surface} hover:bg-zinc-800 transition-all ${isRecording ? 'text-red-500 animate-pulse' : ''}`}
                >
                  {isRecording ? <StopCircleIcon className="w-5 h-5" /> : <MicrophoneIcon className="w-5 h-5" />}
                </button>
                <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
              </div>
            </div>
            {imagePreview && (
              <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-blue-500/30 shadow-lg">
                <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                <button onClick={() => { setSelectedImage(null); setImagePreview(null); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5">✕</button>
              </div>
            )}
          </div>

          {/* Step 3: Location */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">3. Your Location (Optional)</label>
            <div className="space-y-3">
              <input
                type="text"
                value={landmark}
                onChange={e => setLandmark(e.target.value)}
                placeholder="Nearest landmark or area name"
                className={`w-full ${theme.surfaceSoft} ${theme.text} rounded-xl px-4 py-3 text-sm border ${theme.border} focus:ring-2 focus:ring-blue-500/20 outline-none`}
              />
              <button 
                type="button"
                onClick={handleUseGPS}
                className="flex items-center text-[10px] font-bold text-blue-500 hover:underline px-1"
              >
                <MapPinIcon className="w-3.5 h-3.5 mr-1" />
                Use My GPS Location
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isIngesting || !selectedType || !description}
            className={`w-full py-5 rounded-2xl font-black text-white text-sm uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${
              isIngesting ? 'bg-zinc-800 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
            }`}
          >
            {!isIngesting && <PaperAirplaneIcon className="w-5 h-5 text-white fill-white" />}
            {isIngesting ? 'Sending to response team...' : 'Send Emergency Report'}
          </button>
        </form>

        {/* My Reports */}
        <div className="space-y-6 mt-8">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Previous reports from this device</h3>
          <div className="space-y-3">
            {myReports.length === 0 ? (
              <p className="text-xs italic opacity-40 py-4">No previous reports found.</p>
            ) : (
              myReports.map(report => (
                <div key={report.id} className={`${theme.surface} border ${theme.border} rounded-2xl p-4 flex justify-between items-center shadow-sm`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{report.emoji}</span>
                    <div>
                      <p className="text-xs font-bold leading-none mb-1">{report.id}</p>
                      <p className="text-[10px] opacity-60 truncate max-w-[140px]">{report.location}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${report.status === 'RESOLVED' ? 'bg-zinc-500/10 text-zinc-500' : 'bg-green-500/10 text-green-500 animate-pulse'}`}>
                    {report.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <VoiceAssistant 
        isOpen={isVoiceOpen} 
        onClose={() => setIsVoiceOpen(false)} 
        apiBase={API_BASE} 
      />
    </div>
  );
}
