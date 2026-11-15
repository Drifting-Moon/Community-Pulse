import React from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

export default function CitizenLayout() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col font-sans selection:bg-red-100 selection:text-red-900">
      {/* Single Clean Header - Shared container with body */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40 h-16 flex items-center">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link
            to="/"
            title="Return to Main Portal Gateway"
            className="font-semibold text-[15px] tracking-tight text-gray-900 hover:text-red-600 transition-colors"
          >
            CommunityPulse
          </Link>

          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-6 text-[13px]">
              <NavLink
                to="/citizen/report"
                className={({ isActive }) =>
                  isActive ? 'text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900 transition-colors'
                }
              >
                Report
              </NavLink>
              <NavLink
                to="/citizen/track"
                className={({ isActive }) =>
                  isActive ? 'text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900 transition-colors'
                }
              >
                Track
              </NavLink>
              <NavLink
                to="/citizen/safety"
                className={({ isActive }) =>
                  isActive ? 'text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900 transition-colors'
                }
              >
                Safety
              </NavLink>
            </nav>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area - Shared container with header */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Thin Neutral Footer with Lifeline Numbers */}
      <footer className="border-t border-gray-100 py-4 px-4 sm:px-6 lg:px-8 text-center text-[13px] text-gray-500">
        Emergency lifelines: Police / Disaster <strong>112</strong> • Ambulance <strong>108</strong> • NDRF <strong>1078</strong>
      </footer>
    </div>
  );
}
