import React, { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  UserGroupIcon,
  RadioIcon,
  MapPinIcon,
  UserCircleIcon,
  ArrowUturnLeftIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

export default function VolunteerLayout() {
  const [isOnDuty, setIsOnDuty] = useState(true);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Field Status Bar */}
      <div className="bg-emerald-950/70 border-b border-emerald-900/50 px-4 py-1.5 text-xs flex items-center justify-between text-emerald-200">
        <div className="flex items-center gap-2">
          <span className={`flex h-2 w-2 rounded-full ${isOnDuty ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          <span className="font-semibold tracking-wide">FIELD RESPONDER STATUS:</span>
          <span className={isOnDuty ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
            {isOnDuty ? 'ACTIVE ON DUTY' : 'OFF DUTY'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Duty Switcher */}
          <button
            onClick={() => setIsOnDuty(!isOnDuty)}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
              isOnDuty 
                ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {isOnDuty ? 'Go Off Duty' : 'Go On Duty'}
          </button>

          <Link
            to="/"
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
            title="Switch Portal"
          >
            <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
            <span>Switch</span>
          </Link>
        </div>
      </div>

      {/* Main Volunteer Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-950">
              <UserGroupIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Link to="/" title="Return to Main Portal Gateway" className="font-bold text-lg text-white hover:text-emerald-400 transition-colors">
                  NaturalPulse
                </Link>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Field Responder
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Mission Dispatch & Field Operations</p>
            </div>
          </div>

          {/* Volunteer Navigation */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <NavLink
              to="/volunteer/dashboard"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <RadioIcon className="h-4 w-4" />
              <span>Missions</span>
            </NavLink>

            <NavLink
              to="/volunteer/profile"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <UserCircleIcon className="h-4 w-4" />
              <span>Profile</span>
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        <Outlet />
      </main>

      {/* Volunteer Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-3 px-6 text-center text-xs text-slate-500">
        Emergency Responder Network • Stay safe and maintain contact with Central Dispatch.
      </footer>
    </div>
  );
}

