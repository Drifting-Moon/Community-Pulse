import React from 'react';

export default function CitizenSafetyPage() {
  const emergencyContacts = [
    { name: 'National Emergency', number: '112', desc: 'Police, Fire, Disaster' },
    { name: 'Ambulance & Trauma', number: '108', desc: 'Medical emergency dispatch' },
    { name: 'NDRF Disaster Response', number: '1078', desc: 'Disaster management force' },
    { name: 'State Disaster Authority', number: '1070', desc: 'Flood & weather response' },
    { name: 'Women Helpline', number: '1091', desc: '24/7 dedicated support' },
    { name: 'Child Emergency', number: '1098', desc: 'Emergency care for children' },
  ];

  const safeZones = [
    { name: 'Bagru Municipal Relief & Safe Camp', type: 'Designated Shelter', capacity: '500 beds', address: 'Bagru' },
    { name: 'SMS Medical Disaster Center', type: 'Medical First-Line', capacity: '24/7 Triage', address: 'Jaipur' },
  ];

  return (
    <div className="max-w-[960px] mx-auto space-y-8 py-2">
      <div>
        <h1 className="text-[20px] font-semibold text-gray-900">Safety and emergency resources</h1>
        <p className="text-[15px] text-gray-600 mt-1">
          Direct emergency hotlines and verified relief shelters.
        </p>
      </div>

      {/* Emergency Hotlines as 3-col row of plain tiles */}
      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold text-gray-900">Emergency hotlines</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {emergencyContacts.map((contact, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white flex flex-col justify-between">
              <div>
                <h3 className="font-medium text-[15px] text-gray-900">{contact.name}</h3>
                <p className="text-[13px] text-gray-500 mt-0.5">{contact.desc}</p>
              </div>
              <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[15px] font-semibold text-gray-900 tabular-nums">
                  {contact.number}
                </span>
                <a
                  href={`tel:${contact.number}`}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg text-[13px] transition-colors"
                >
                  Call
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Verified Safe Shelters as a List */}
      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold text-gray-900">Verified relief shelters</h2>
        <div className="space-y-2.5">
          {safeZones.map((zone, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white flex items-center justify-between">
              <div>
                <h3 className="font-medium text-[15px] text-gray-900">{zone.name}</h3>
                <p className="text-[13px] text-gray-500 mt-0.5">{zone.address} • {zone.type}</p>
              </div>
              <span className="text-[13px] text-gray-700 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200 shrink-0 ml-4">
                {zone.capacity}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
