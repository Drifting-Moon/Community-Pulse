import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PortalGateway from './pages/PortalGateway';
import CitizenLayout from './layouts/CitizenLayout';
import ReportPage from './pages/ReportPage';
import CitizenTrackerPage from './pages/CitizenTrackerPage';
import CitizenSafetyPage from './pages/CitizenSafetyPage';
import VolunteerApp from './VolunteerApp';
import App from './App';

export default function RootRouter() {
  return (
    <Routes>
      {/* 🧭 1. Home Role Gateway */}
      <Route path="/" element={<PortalGateway />} />

      {/* 🚨 2. Citizen Dedicated Portal */}
      <Route path="/citizen" element={<CitizenLayout />}>
        <Route index element={<Navigate to="/citizen/report" replace />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="track" element={<CitizenTrackerPage />} />
        <Route path="track/:ticketId" element={<CitizenTrackerPage />} />
        <Route path="safety" element={<CitizenSafetyPage />} />
      </Route>

      {/* 🦺 3. Volunteer Dedicated Field Portal */}
      <Route path="/volunteer/*" element={<VolunteerApp />} />

      {/* 🛡️ 4. Admin Dedicated Command Center */}
      <Route path="/admin/*" element={<App />} />

      {/* 🔗 Backward Compatibility & Direct Aliases */}
      <Route path="/report" element={<Navigate to="/citizen/report" replace />} />
      <Route path="/track" element={<Navigate to="/citizen/track" replace />} />
      <Route path="/track/:ticketId" element={<CitizenTrackerPage />} />
      <Route path="/safety" element={<Navigate to="/citizen/safety" replace />} />
      <Route path="/dashboard" element={<Navigate to="/admin" replace />} />

      {/* Fallback to Portal Gateway */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

