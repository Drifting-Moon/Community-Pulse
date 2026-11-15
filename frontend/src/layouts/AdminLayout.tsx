import React from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  ShieldCheckIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  ArchiveBoxIcon,
  ChartBarIcon,
  ArrowUturnLeftIcon,
  SignalIcon
} from '@heroicons/react/24/outline';

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Tactical Status Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-1.5 text-xs flex items-center justify-between text-slate-400">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-slate-300 font-semibold tracking-wider uppercase">
            COMMAND CENTER SECURE SHELL
          </span>
          <span className="hidden md:inline text-slate-500">•</span>
          <span className="hidden md:inline text-slate-400">TONIC Predictive Engine v2.0</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
            title="Switch Portal"
          >
            <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
            <span>Switch Role</span>
          </Link>
        </div>
      </div>

      {/* Main Admin Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-950">
              <ShieldCheckIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Link to="/" title="Return to Main Portal Gateway" className="font-bold text-lg text-white hover:text-sky-400 transition-colors">
                  CommunityPulse
                </Link>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Tactical Command
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Incident Triage, Inventory & Autonomous Dispatch</p>
            </div>
          </div>

          {/* Admin Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-900/40'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <MapPinIcon className="h-4 w-4" />
              <span>Tactical Map</span>
            </NavLink>

            <NavLink
              to="/admin/dispatch"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-900/40'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <PaperAirplaneIcon className="h-4 w-4" />
              <span>Dispatch Board</span>
            </NavLink>

            <NavLink
              to="/admin/inventory"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-900/40'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <ArchiveBoxIcon className="h-4 w-4" />
              <span>Relief Inventory</span>
            </NavLink>

            <NavLink
              to="/admin/analytics"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-900/40'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <ChartBarIcon className="h-4 w-4" />
              <span>Analytics & AAR</span>
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}

