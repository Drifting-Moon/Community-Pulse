// In-memory Mock Firestore for Demo MVP
import { NeedEntity, VolunteerProfile } from '../shared/types';
import * as crypto from 'crypto';

class MockFirestore {
  private needs: Map<string, NeedEntity> = new Map();
  private volunteers: Map<string, VolunteerProfile> = new Map();

  constructor() {
    // Clean initial state - no fake or dummy data seeded on startup
  }

  private seedNeeds() {
    // Empty - no fake data
  }

  public seedNgoVolunteers() {
    this.volunteers.clear();
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
