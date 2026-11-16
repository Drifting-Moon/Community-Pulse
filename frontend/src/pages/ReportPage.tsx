import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  CameraIcon,
  MicrophoneIcon,
  StopCircleIcon,
  MapPinIcon,
  CheckCircleIcon,
  HeartIcon,
  BuildingOffice2Icon,
  CubeIcon,
  FireIcon,
  ShieldExclamationIcon,
  EllipsisHorizontalCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { saveOfflineReport } from '../offlineSync';

const API_BASE = import.meta.env.VITE_API_BASE || '';

type CrisisType = 'medical' | 'flood' | 'fire' | 'food' | 'infrastructure' | 'other';

interface CrisisOption {
  type: CrisisType;
  label: string;
  icon: React.ReactNode;
}

export default function ReportPage() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<CrisisType | null>(null);
  const [description, setDescription] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [detectedLocation, setDetectedLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [manualAddress, setManualAddress] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Online / offline detector
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

  // Function to pull high-accuracy current GPS location
  const pullCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setIsDetectingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let displayName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const place =
              addr.suburb ||
              addr.neighbourhood ||
              addr.city ||
              addr.town ||
              addr.village ||
              addr.county ||
              data.display_name?.split(',')[0];
            if (place) {
              displayName = `${place} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
            }
          }
        } catch {
          // Keep coords as displayName
        }

        setDetectedLocation({
          lat,
          lng,
          name: displayName
        });
        setIsDetectingLocation(false);
      },
      (err) => {
        setIsDetectingLocation(false);
        let msg = 'Unable to acquire location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission denied. Please allow GPS access in your browser or enter address manually.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out. Please try again or enter address manually.';
        }
        setLocationError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Attempt initial GPS lock on mount
  useEffect(() => {
    pullCurrentLocation();
  }, []);

  // Speech Recognition
  const toggleRecording = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your message.');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => setIsRecording(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.start();
    } catch {
      setIsRecording(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType && !description.trim()) {
      alert('Please select an emergency type or describe the situation.');
      return;
    }

    setIsIngesting(true);
    const hasManualAddress = Boolean(manualAddress.trim());
    const locText = hasManualAddress ? manualAddress.trim() : (detectedLocation?.name || 'GPS Auto-Detected');
    const fullText = `[CRISIS: ${selectedType || 'Emergency'}] ${description} (Location: ${locText})`;

    try {
      if (!isOnline) {
        await saveOfflineReport({ text: fullText });
        const mockCode = `CP-${Math.floor(1000 + Math.random() * 9000)}`;
        setReportId(mockCode);
        setIsSuccess(true);
      } else {
        const formData = new FormData();
        formData.append('text', fullText);
        formData.append('locationName', locText);

        // Direct GPS Passthrough: send exact lat/lng when GPS is detected and no override address typed
        if (!hasManualAddress && detectedLocation && typeof detectedLocation.lat === 'number' && typeof detectedLocation.lng === 'number') {
          formData.append('lat', detectedLocation.lat.toString());
          formData.append('lng', detectedLocation.lng.toString());
        }

        if (selectedImage) formData.append('image', selectedImage);

        const res = await axios.post(`${API_BASE}/ingest`, formData);
        const code = res.data.ticketCode || `CP-${(res.data.id || '').slice(0, 4).toUpperCase()}`;
        setReportId(code);
        setIsSuccess(true);
      }
    } catch (err: any) {
      console.error('Submission error:', err);
      const serverErrMsg = err.response?.data?.error;
      if (serverErrMsg) {
        alert(`Emergency Report Error: ${serverErrMsg}`);
      } else {
        alert('Could not submit emergency report. Please ensure network is connected or provide clear location details.');
      }
    } finally {
      setIsIngesting(false);
    }
  };

  const crisisOptions: CrisisOption[] = [
    { type: 'medical', label: 'Medical', icon: <HeartIcon className="w-6 h-6" /> },
    { type: 'flood', label: 'Flood', icon: <MapPinIcon className="w-6 h-6" /> },
    { type: 'fire', label: 'Fire', icon: <FireIcon className="w-6 h-6" /> },
    { type: 'food', label: 'Food', icon: <CubeIcon className="w-6 h-6" /> },
    { type: 'infrastructure', label: 'Infrastructure', icon: <BuildingOffice2Icon className="w-6 h-6" /> },
    { type: 'other', label: 'Other', icon: <EllipsisHorizontalCircleIcon className="w-6 h-6" /> },
  ];

  // Success Confirmation Screen
  if (isSuccess) {
    return (
      <div className="py-12 max-w-[640px] mx-auto text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-green-50 border border-green-200 flex items-center justify-center text-[#2E9E6B]">
          <CheckCircleIcon className="w-9 h-9" />
        </div>

        <div>
          <h1 className="text-[32px] font-semibold text-gray-900 tracking-tight">Report received</h1>
          <p className="text-[15px] text-gray-600 mt-2">
            Your distress signal has been forwarded to emergency responders.
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <span className="text-[13px] text-gray-500 block">Ticket Reference Code</span>
          <span className="text-[20px] font-semibold text-gray-900 mt-1 block tracking-normal tabular-nums">
            {reportId}
          </span>
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={() => {
              const cleanCode = (reportId || '').replace('#', '');
              navigate(`/citizen/track/${cleanCode}`);
            }}
            className="w-full h-12 bg-[#E5383B] hover:bg-[#D02B2E] text-white text-[15px] font-medium rounded-xl transition-colors shadow-sm"
          >
            Track this report
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSuccess(false);
              setSelectedType(null);
              setDescription('');
              setSelectedImage(null);
              setImagePreview(null);
            }}
            className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors"
          >
            Send another report
          </button>
        </div>
      </div>
    );
  }

  // Active Report Form
  return (
    <div className="max-w-[640px] mx-auto pt-8 pb-16">
      {/* Page Title & Subline */}
      <div className="mb-8">
        <h1 className="text-[32px] font-semibold tracking-tight text-gray-900">
          Report an emergency
        </h1>
        <p className="text-[15px] text-gray-600 mt-1">
          Provide key details so dispatchers can send the right relief response.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: What's happening? */}
        <section className="space-y-3">
          <h2 className="text-[20px] font-semibold text-gray-900">What's happening?</h2>
          <div className="grid grid-cols-3 gap-3">
            {crisisOptions.map((opt) => {
              const isSelected = selectedType === opt.type;
              return (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setSelectedType(isSelected ? null : opt.type)}
                  className={`h-[88px] sm:h-[104px] rounded-xl border flex flex-col items-center justify-center gap-2 transition-colors ${
                    isSelected
                      ? 'border-2 border-[#E5383B] bg-[#FEF2F2] text-[#E5383B]'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className={isSelected ? 'text-[#E5383B]' : 'text-gray-500'}>
                    {opt.icon}
                  </span>
                  <span className="text-[15px] font-medium leading-none">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 2: Describe it */}
        <section className="space-y-3">
          <h2 className="text-[20px] font-semibold text-gray-900">Describe it</h2>
          <div className="relative border border-gray-200 rounded-xl bg-white focus-within:border-gray-400 transition-colors">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is needed? How many people are affected?"
              className="w-full min-h-[140px] p-4 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none resize-none rounded-xl pb-14"
            />

            {/* Embedded 40x40 Mic & Camera buttons in bottom-left */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                title="Attach photo"
              >
                <CameraIcon className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={toggleRecording}
                className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${
                  isRecording
                    ? 'border-red-300 text-red-600 bg-red-50'
                    : 'border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title={isRecording ? 'Stop recording' : 'Record voice'}
              >
                {isRecording ? <StopCircleIcon className="w-5 h-5" /> : <MicrophoneIcon className="w-5 h-5" />}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageChange}
                className="hidden"
              />

              {selectedImage && (
                <span className="text-[13px] text-gray-600 truncate max-w-[200px] ml-2">
                  Photo attached
                </span>
              )}
            </div>
          </div>

          {imagePreview && (
            <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
              <img src={imagePreview} alt="Incident preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  setSelectedImage(null);
                  setImagePreview(null);
                }}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                title="Remove photo"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </section>

        {/* Step 3: Location */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-semibold text-gray-900">Location</h2>
            <button
              type="button"
              onClick={() => setIsEditingLocation((prev) => !prev)}
              className="text-[13px] text-gray-600 hover:text-gray-900 font-medium"
            >
              {isEditingLocation ? 'Done' : manualAddress ? 'Change manual address' : 'Enter address manually'}
            </button>
          </div>

          <div className="border border-gray-200 rounded-xl bg-white p-3.5 flex items-center justify-between text-[15px]">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <MapPinIcon className={`w-5 h-5 shrink-0 ${detectedLocation || manualAddress ? 'text-[#E5383B]' : 'text-gray-400'}`} />
              <span className={`truncate ${manualAddress || detectedLocation ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                {manualAddress
                  ? manualAddress
                  : isDetectingLocation
                  ? 'Acquiring GPS location...'
                  : detectedLocation?.name || 'No location set'}
              </span>
            </div>

            {detectedLocation && !manualAddress && (
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                GPS Locked
              </span>
            )}
          </div>

          {/* Action Row: Pull GPS directly */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={pullCurrentLocation}
              disabled={isDetectingLocation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200 disabled:opacity-50"
            >
              <MapPinIcon className="w-4 h-4 text-[#E5383B]" />
              <span>{isDetectingLocation ? 'Acquiring GPS...' : '📍 Pull current GPS location'}</span>
            </button>

            {detectedLocation && (
              <button
                type="button"
                onClick={() => {
                  setDetectedLocation(null);
                  setManualAddress('');
                }}
                className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {locationError && (
            <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
              {locationError}
            </p>
          )}

          {isEditingLocation && (
            <div className="space-y-1">
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="Enter street address, building or landmark"
                className="w-full h-11 px-3.5 border border-gray-200 rounded-xl text-[15px] text-gray-900 focus:outline-none focus:border-gray-400"
              />
              <p className="text-[11px] text-gray-500">
                Typed address overrides GPS coordinates for this dispatch.
              </p>
            </div>
          )}
        </section>

        {/* Submit Button - Sticky to bottom of viewport on mobile only */}
        <div className="sticky bottom-4 sm:static pt-2">
          <button
            type="submit"
            disabled={isIngesting}
            className="w-full h-12 bg-[#E5383B] hover:bg-[#D02B2E] text-white text-[15px] font-medium rounded-xl transition-colors shadow-sm flex items-center justify-center disabled:opacity-50"
          >
            {isIngesting ? 'Sending distress signal...' : 'Send report'}
          </button>
        </div>
      </form>
    </div>
  );
}
