export interface LocationCoords {
  lat: number;
  lng: number;
}

export interface EnRouteResponder {
  id: string;
  name: string;
  ngo?: string;
  phone?: string;
  dispatchedAt: number;
}

export interface NeedEntity {
  id: string;
  location: { name: string; lat: number; lng: number };
  crisisType: 'food' | 'medical' | 'shelter' | 'water' | 'infrastructure';
  urgencyReasoning: string;
  estimatedScale: number;
  reportCount: number;
  clusterId?: string;
  criticalityScore: number;
  status: 'OPEN' | 'CRITICAL_VELOCITY' | 'EN_ROUTE' | 'RESOLVED';
  reportedAt: number; // timestamp
  resolvedAt?: number; // timestamp
  rawInputs: string[];
  embedding?: number[]; 
  originalLanguage?: string;
  enRouteVolunteers?: EnRouteResponder[];
  dispatchMessage?: string;
}

export interface VolunteerProfile {
  id: string;
  name: string;
  ngo?: string; // NGO / Affiliation (e.g. Red Cross, Goonj, SEEDS, Independent)
  phone?: string;
  email?: string;
  preferredLanguage: string;
  skills: string[];
  locationCoords: LocationCoords;
  locationName?: string;
  reliabilityRate: number; 
  status: 'AVAILABLE' | 'BUSY' | 'OFF_DUTY';
  hoursLast30Days: number;
  lastDispatchedAt?: number;
  pastContributions: string[];
  registeredAt?: number;
}

export interface Prediction {
  city: string;
  predictedCrisisType: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendedPreventiveAction: string;
  lat?: number;
  lng?: number;
  riskScore?: number;
}
