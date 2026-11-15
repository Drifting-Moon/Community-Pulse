// In-memory Mock Firestore for Demo MVP
import { NeedEntity, VolunteerProfile } from '../shared/types';
import * as crypto from 'crypto';

class MockFirestore {
  private needs: Map<string, NeedEntity> = new Map();
  private volunteers: Map<string, VolunteerProfile> = new Map();

  // Seed some dummy volunteers for the 5km raidus search
  constructor() {
    this.seedNgoVolunteers();
    this.seedNeeds();
  }

  private seedNeeds() {
    const now = Date.now();
    const initialNeeds: NeedEntity[] = [
      {
        id: crypto.randomUUID(),
        ticketCode: 'CP-8011',
        location: { name: 'Mumbai (Andheri)', lat: 19.1136, lng: 72.8697 },
        crisisType: 'medical',
        urgencyReasoning: 'Emergency medical ping near International Airport. Multi-vehicle incident.',
        estimatedScale: 5,
        reportCount: 4,
        criticalityScore: 92,
        status: 'OPEN',
        verificationStatus: 'VERIFIED',
        verificationConfidence: 96,
        reportedAt: now - 1000 * 60 * 12, // 12m ago
        rawInputs: ['Highway accident, need ambulances.'],
        timeline: [
          { timestamp: now - 1000 * 60 * 12, action: 'Distress Signal Logged by Citizen', actorRole: 'CITIZEN' },
          { timestamp: now - 1000 * 60 * 9, action: 'Incident Verified & Priority Set to CRITICAL', actorRole: 'ADMIN' }
        ]
      },
      {
        id: crypto.randomUUID(),
        ticketCode: 'CP-8012',
        location: { name: 'Delhi (Chandni Chowk)', lat: 28.6506, lng: 77.2300 },
        crisisType: 'infrastructure',
        urgencyReasoning: 'Fire signal in old commercial block. Risk of rapid spread.',
        estimatedScale: 30,
        reportCount: 12,
        criticalityScore: 95,
        status: 'OPEN',
        verificationStatus: 'VERIFIED',
        verificationConfidence: 98,
        reportedAt: now - 1000 * 60 * 35, // 35m ago
        rawInputs: ['Major fire breaking out in narrow lanes.'],
        timeline: [
          { timestamp: now - 1000 * 60 * 35, action: 'Distress Signal Logged by Citizen', actorRole: 'CITIZEN' },
          { timestamp: now - 1000 * 60 * 30, action: 'Verified & Alert Broadcast to Fire Teams', actorRole: 'ADMIN' }
        ]
      },
      {
        id: crypto.randomUUID(),
        ticketCode: 'CP-8013',
        location: { name: 'Chennai (T Nagar)', lat: 13.0405, lng: 80.2337 },
        crisisType: 'water',
        urgencyReasoning: 'Deep waterlogging. Residential ground floors submerged.',
        estimatedScale: 150,
        reportCount: 45,
        criticalityScore: 88,
        status: 'OPEN',
        verificationStatus: 'VERIFIED',
        verificationConfidence: 92,
        reportedAt: now - 1000 * 60 * 75, // 1h 15m ago
        rawInputs: ['Water entering houses, elderly people stuck.'],
        timeline: [
          { timestamp: now - 1000 * 60 * 75, action: 'Flood Distress Signal Received', actorRole: 'CITIZEN' },
          { timestamp: now - 1000 * 60 * 70, action: 'Cluster Merged (45 Citizen Reports)', actorRole: 'SYSTEM' }
        ]
      },
      {
        id: crypto.randomUUID(),
        ticketCode: 'CP-8014',
        location: { name: 'Kolkata (Park Street)', lat: 22.5487, lng: 88.3522 },
        crisisType: 'infrastructure',
        urgencyReasoning: 'Structural crack detected in flyover pillar. Traffic priority: HIGH.',
        estimatedScale: 0,
        reportCount: 3,
        criticalityScore: 68,
        status: 'RESOLVED',
        verificationStatus: 'VERIFIED',
        verificationConfidence: 94,
        reportedAt: now - 1000 * 60 * 180, // 3h ago
        resolvedAt: now - 1000 * 60 * 45, // Resolved 45m ago (took 135m)
        rawInputs: ['Flyover support looks unstable.'],
        proofOfWork: {
          notes: 'Civil engineering team inspected pillar. Traffic redirected and structural braces erected.',
          resolvedAt: now - 1000 * 60 * 45,
          volunteerName: 'SEEDS Technical Rescue Unit'
        },
        timeline: [
          { timestamp: now - 1000 * 60 * 180, action: 'Citizen Report Logged', actorRole: 'CITIZEN' },
          { timestamp: now - 1000 * 60 * 160, action: 'Engineering Dispatch Authorized', actorRole: 'ADMIN' },
          { timestamp: now - 1000 * 60 * 45, action: 'Structural Bracing Secured & Marked RESOLVED', actorRole: 'VOLUNTEER' }
        ]
      },
      {
        id: crypto.randomUUID(),
        ticketCode: 'CP-8015',
        location: { name: 'Hyderabad (Hitech City)', lat: 17.4483, lng: 78.3915 },
        crisisType: 'medical',
        urgencyReasoning: 'Heatstroke cluster reported at construction site. ~15 individuals affected.',
        estimatedScale: 15,
        reportCount: 2,
        criticalityScore: 72,
        status: 'RESOLVED',
        verificationStatus: 'VERIFIED',
        verificationConfidence: 90,
        reportedAt: now - 1000 * 60 * 240, // 4h ago
        resolvedAt: now - 1000 * 60 * 120, // Resolved 2h ago (took 120m)
        rawInputs: ['Labourers fainting due to heat.'],
        proofOfWork: {
          notes: 'Provided IV fluids, oral rehydration salts, and shaded recovery camp.',
          resolvedAt: now - 1000 * 60 * 120,
          volunteerName: 'Red Cross Paramedic Unit',
          casualtiesAssisted: 15
        },
        timeline: [
          { timestamp: now - 1000 * 60 * 240, action: 'Distress Reported via Voice Call', actorRole: 'CITIZEN' },
          { timestamp: now - 1000 * 60 * 220, action: 'Paramedic Team Dispatched', actorRole: 'ADMIN' },
          { timestamp: now - 1000 * 60 * 120, action: 'All 15 workers stabilized & hydrated. Resolved.', actorRole: 'VOLUNTEER' }
        ]
      },
      {
        id: crypto.randomUUID(),
        ticketCode: 'CP-8016',
        location: { name: 'Jaipur (Amber Road)', lat: 26.9855, lng: 75.8513 },
        crisisType: 'water',
        urgencyReasoning: 'Main supply pipe burst. Severe water wastage and road collapse risk.',
        estimatedScale: 500,
        reportCount: 8,
        criticalityScore: 61,
        status: 'OPEN',
        verificationStatus: 'VERIFIED',
        verificationConfidence: 89,
        reportedAt: now - 1000 * 60 * 180, // 3h ago
        rawInputs: ['Pipeline exploded, road is eroding.']
      },
      {
        id: crypto.randomUUID(),
        ticketCode: 'CP-8017',
        location: { name: 'Bangalore (Indiranagar)', lat: 12.9784, lng: 77.6408 },
        crisisType: 'food',
        urgencyReasoning: 'Ration distribution mismatch for displaced families. Immediate food needed.',
        estimatedScale: 80,
        reportCount: 1,
        criticalityScore: 56,
        status: 'RESOLVED',
        verificationStatus: 'VERIFIED',
        verificationConfidence: 93,
        reportedAt: now - 1000 * 60 * 300, // 5h ago
        resolvedAt: now - 1000 * 60 * 210, // Resolved 3.5h ago (took 90m)
        rawInputs: ['Displaced families haven’t eaten in 10 hours.'],
        proofOfWork: {
          notes: 'Distributed 80 dry ration kits and bottled water from Central Depot.',
          resolvedAt: now - 1000 * 60 * 210,
          volunteerName: 'Goonj Relief Force',
          casualtiesAssisted: 80
        }
      },
      {
        id: crypto.randomUUID(),
        ticketCode: 'CP-8018',
        location: { name: 'Lucknow (Gomti Nagar)', lat: 26.8496, lng: 80.9992 },
        crisisType: 'infrastructure',
        urgencyReasoning: 'Overhanging high-tension wire across pedestrian crossing.',
        estimatedScale: 10,
        reportCount: 1,
        criticalityScore: 79,
        status: 'OPEN',
        verificationStatus: 'VERIFIED',
        verificationConfidence: 91,
        reportedAt: now - 1000 * 60 * 25, // 25m ago
        rawInputs: ['Live wire hanging dangerously low.']
      }
    ];

    initialNeeds.forEach(need => this.needs.set(need.id, need));
    console.log(`✅ Seeded ${initialNeeds.length} initial crisis reports.`);
  }

  public seedNgoVolunteers() {
    this.volunteers.clear();
    const now = Date.now();
    const ngoVolunteers: VolunteerProfile[] = [
      {
        id: crypto.randomUUID(),
        name: 'Dr. Aarav Mehra',
        ngo: 'Doctors Without Borders (MSF)',
        phone: '+91 98201 12345',
        email: 'aarav.mehra@msf.ngo.in',
        preferredLanguage: 'Hindi',
        skills: ['medical', 'emergency triage', 'first aid'],
        locationCoords: { lat: 19.0422, lng: 72.8538 },
        locationName: 'Mumbai - Dharavi Health Post',
        reliabilityRate: 0.98,
        status: 'AVAILABLE',
        hoursLast30Days: 12,
        pastContributions: ['Flood medical relief 2024'],
        registeredAt: now - 86400000 * 3
      },
      {
        id: crypto.randomUUID(),
        name: 'Sunita Rao',
        ngo: 'Red Cross Society India',
        phone: '+91 98110 54321',
        email: 'sunita.rao@indianredcross.org',
        preferredLanguage: 'English',
        skills: ['water', 'shelter', 'first aid'],
        locationCoords: { lat: 19.0760, lng: 72.8777 },
        locationName: 'Mumbai - Central Logistics Hub',
        reliabilityRate: 0.95,
        status: 'AVAILABLE',
        hoursLast30Days: 15,
        pastContributions: ['Clean water tanker deployment'],
        registeredAt: now - 86400000 * 5
      },
      {
        id: crypto.randomUUID(),
        name: 'Vikram Joshi',
        ngo: 'Goonj Relief Force',
        phone: '+91 97171 99887',
        email: 'vikram.j@goonj.ngo',
        preferredLanguage: 'Hindi',
        skills: ['food', 'logistics', 'shelter'],
        locationCoords: { lat: 28.6315, lng: 77.2167 },
        locationName: 'Delhi - Connaught Place Center',
        reliabilityRate: 0.92,
        status: 'AVAILABLE',
        hoursLast30Days: 10,
        pastContributions: ['Dry ration distribution drive'],
        registeredAt: now - 86400000 * 7
      },
      {
        id: crypto.randomUUID(),
        name: 'Kavita Nair',
        ngo: 'SEEDS India Disaster Response',
        phone: '+91 94440 23456',
        email: 'kavita.nair@seedsindia.org',
        preferredLanguage: 'Tamil',
        skills: ['infrastructure', 'water', 'rescue'],
        locationCoords: { lat: 13.0405, lng: 80.2337 },
        locationName: 'Chennai - T Nagar Response Hub',
        reliabilityRate: 0.96,
        status: 'AVAILABLE',
        hoursLast30Days: 8,
        pastContributions: ['Urban cyclone barrier support'],
        registeredAt: now - 86400000 * 2
      },
      {
        id: crypto.randomUUID(),
        name: 'Rohan Sen',
        ngo: 'NDRF Auxiliary Volunteers',
        phone: '+91 98300 76543',
        email: 'rohan.sen@ndrf-aux.gov.in',
        preferredLanguage: 'Bengali',
        skills: ['rescue', 'infrastructure', 'flood evacuation'],
        locationCoords: { lat: 22.5487, lng: 88.3522 },
        locationName: 'Kolkata - Park Street Emergency Staging',
        reliabilityRate: 0.97,
        status: 'AVAILABLE',
        hoursLast30Days: 14,
        pastContributions: ['Search & rescue operations'],
        registeredAt: now - 86400000 * 1
      }
    ];

    ngoVolunteers.forEach(v => this.volunteers.set(v.id, v));
    console.log(`✅ Seeded ${ngoVolunteers.length} verified NGO emergency response teams.`);
  }

  async clearAllVolunteers(): Promise<void> {
    this.volunteers.clear();
  }

  async deleteVolunteer(id: string): Promise<boolean> {
    return this.volunteers.delete(id);
  }

  // --- Requirements for Needs ---
  async addNeed(need: NeedEntity): Promise<void> {
    this.needs.set(need.id, need);
  }

  async updateNeed(id: string, updates: Partial<NeedEntity>): Promise<void> {
    const existing = this.needs.get(id);
    if (existing) {
      this.needs.set(id, { ...existing, ...updates });
    }
  }

  async getRecentUnresolvedNeeds(): Promise<NeedEntity[]> {
    const now = Date.now();
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    
    return Array.from(this.needs.values()).filter(
      n => n.status !== 'RESOLVED' && (now - n.reportedAt) <= TWELVE_HOURS
    );
  }

  async getAllNeeds(): Promise<NeedEntity[]> {
    return Array.from(this.needs.values());
  }

  async clearAllNeeds(): Promise<void> {
    this.needs.clear();
  }

  // --- Requirements for Volunteers ---
  async resolveNeed(id: string): Promise<void> {
    const existing = this.needs.get(id);
    if (existing) {
      this.needs.set(id, { ...existing, status: 'RESOLVED', resolvedAt: Date.now() });
      if (existing.enRouteVolunteers && Array.isArray(existing.enRouteVolunteers)) {
        for (const responder of existing.enRouteVolunteers) {
          const v = this.volunteers.get(responder.id);
          if (v) {
            this.volunteers.set(responder.id, {
              ...v,
              status: 'AVAILABLE',
              hoursLast30Days: (v.hoursLast30Days || 0) + 1
            });
          }
        }
      }
    }
  }

  async getVolunteers(): Promise<VolunteerProfile[]> {
    return Array.from(this.volunteers.values());
  }

  async addVolunteer(volunteer: VolunteerProfile): Promise<void> {
    this.volunteers.set(volunteer.id, volunteer);
  }

  async updateVolunteer(id: string, updates: Partial<VolunteerProfile>): Promise<VolunteerProfile | null> {
    const existing = this.volunteers.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.volunteers.set(id, updated);
    return updated;
  }

  async getVolunteerById(id: string): Promise<VolunteerProfile | null> {
    return this.volunteers.get(id) || null;
  }
}

export const db = new MockFirestore();
