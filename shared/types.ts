export interface LocationCoords {
  lat: number;
  lng: number;
}

export type IncidentStatus = 
  | 'UNVERIFIED'
  | 'OPEN'
  | 'VERIFIED'
  | 'CRITICAL_VELOCITY'
  | 'DISPATCHED'
  | 'EN_ROUTE'
  | 'ON_SCENE'
  | 'RESOLVED'
  | 'FALSE_ALARM'
  | 'ESCALATED_AUTHORITY';

export interface EnRouteResponder {
  id: string;
  name: string;
  ngo?: string;
  phone?: string;
  dispatchedAt: number;
  etaMinutes?: number;
  missionStatus?: 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'EN_ROUTE' | 'ON_SCENE' | 'COMPLETED';
}

export interface TimelineEntry {
  timestamp: number;
  action: string;
  actorRole: 'CITIZEN' | 'ADMIN' | 'VOLUNTEER' | 'SYSTEM';
  notes?: string;
}

export interface ProofOfWork {
  photoUrl?: string;
  notes: string;
  resolvedAt: number;
  volunteerName: string;
  casualtiesAssisted?: number;
}

export interface AllocatedSupply {
  supplyId: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface ReliefSupply {
  id: string;
  name: string;
  category: 'water' | 'food' | 'medical' | 'shelter' | 'rescue';
  quantity: number;
  unit: string;
  depotName: string;
  depotCoords: LocationCoords;
}

export interface CitizenContact {
  name?: string;
  phone?: string;
  address?: string;
}

export interface NeedEntity {
  id: string;
  ticketCode?: string; // e.g. "CP-8041"
  location: { name: string; lat: number; lng: number };
  crisisType: 'food' | 'medical' | 'shelter' | 'water' | 'infrastructure';
  urgencyReasoning: string;
  estimatedScale: number;
  reportCount: number;
  clusterId?: string;
  criticalityScore: number;
  status: IncidentStatus;
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED_SPAM';
  verificationConfidence?: number; // 0 - 100
  reportedAt: number; // timestamp
  resolvedAt?: number; // timestamp
  rawInputs: string[];
  photoUrl?: string;
  citizenContact?: CitizenContact;
  embedding?: number[]; 
  originalLanguage?: string;
  isLocal?: boolean;
  enRouteVolunteers?: EnRouteResponder[];
  allocatedSupplies?: AllocatedSupply[];
  proofOfWork?: ProofOfWork;
  timeline?: TimelineEntry[];
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
  reliabilityRate: number; // 0.0 to 1.0
  status: 'AVAILABLE' | 'BUSY' | 'OFF_DUTY';
  activeMissionId?: string;
  currentMissionStatus?: 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'EN_ROUTE' | 'ON_SCENE' | 'COMPLETED';
  assignedSupplies?: AllocatedSupply[];
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
