import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

export default function PortalGateway() {
  const [showStaffMenu, setShowStaffMenu] = useState(false);
  const staffMenuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowStaffMenu(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (staffMenuRef.current && !staffMenuRef.current.contains(e.target as Node)) {
        setShowStaffMenu(false);
      }
    };

    if (showStaffMenu) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStaffMenu]);

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col font-sans selection:bg-red-100 selection:text-red-900">
      {/* Top Header - Shared container */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40 h-16 flex items-center">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link to="/" className="font-semibold text-[15px] tracking-tight text-gray-900">
            CommunityPulse
          </Link>

          <div className="flex items-center gap-4">
            <ThemeToggle />

            {/* Quiet Staff Sign In */}
            <div className="relative" ref={staffMenuRef}>
            <button
              type="button"
              onClick={() => setShowStaffMenu((prev) => !prev)}
              aria-expanded={showStaffMenu}
              className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors py-1.5 px-2"
            >
              Staff sign in
            </button>

            {showStaffMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-[10px] shadow-sm p-1.5 z-50 text-[13px]">
                <Link
                  to="/admin"
                  className="block px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  onClick={() => {
                    try {
                      sessionStorage.removeItem('command_center_sector_chosen');
                    } catch {}
                    setShowStaffMenu(false);
                  }}
                >
                  Command Center
                </Link>
                <Link
                  to="/volunteer"
                  className="block px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  onClick={() => setShowStaffMenu(false)}
                >
                  Field Responder
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

      {/* Main Hero Action - Centered vertically */}
      <main className="flex-1 flex flex-col items-center justify-center min-h-[calc(100dvh-64px)] px-4 sm:px-6 lg:px-8 text-center mx-auto w-full max-w-[1200px]">
        <div className="flex flex-col items-center max-w-[560px] mx-auto">
          <h1 className="text-[32px] font-semibold tracking-tight text-gray-900 mb-3 leading-tight">
            Need emergency help?
          </h1>
          <p className="text-[15px] text-gray-600 mb-8 leading-normal max-w-[560px]">
            Send your distress signal directly to local responders and verified emergency teams.
          </p>

          <div className="flex flex-col items-center w-full">
            <Link
              to="/citizen/report"
              className="w-full sm:w-auto min-w-[260px] h-12 flex items-center justify-center px-8 bg-[#E5383B] hover:bg-[#D02B2E] text-white text-[15px] font-medium rounded-xl transition-colors shadow-sm text-center"
            >
              Report an emergency
            </Link>

            <Link
              to="/citizen/track"
              className="text-[13px] text-gray-600 hover:text-gray-900 underline underline-offset-4 transition-colors mt-4"
            >
              Track an existing report
            </Link>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-gray-100 py-4 px-4 sm:px-6 lg:px-8 text-center text-[13px] text-gray-500">
        In life-threatening situations, call 112 directly.
      </footer>
    </div>
  );
}
