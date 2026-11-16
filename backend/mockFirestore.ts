// In-memory Mock Firestore for Demo MVP
import { NeedEntity, VolunteerProfile, AdminAccount } from '../shared/types';
import * as crypto from 'crypto';

class MockFirestore {
  private needs: Map<string, NeedEntity> = new Map();
  private volunteers: Map<string, VolunteerProfile> = new Map();
  private adminAccounts: Map<string, AdminAccount> = new Map();

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

  // --- Requirements for Admin Accounts & 5-letter NGO Codes ---
  generateUnique5LetterCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const existingCodes = new Set(
      Array.from(this.adminAccounts.values())
        .map(a => a.ngoCode)
        .filter(Boolean) as string[]
    );
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (existingCodes.has(code));
    return code;
  }

  async addAdminAccount(account: AdminAccount): Promise<void> {
    this.adminAccounts.set(account.id, account);
  }

  async updateAdminAccount(id: string, updates: Partial<AdminAccount>): Promise<AdminAccount | null> {
    const existing = this.adminAccounts.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.adminAccounts.set(id, updated);
    return updated;
  }

  async getAdminAccounts(): Promise<AdminAccount[]> {
    return Array.from(this.adminAccounts.values());
  }

  async getAdminAccountById(id: string): Promise<AdminAccount | null> {
    return this.adminAccounts.get(id) || null;
  }

  async getAdminAccountByNgoCode(code: string): Promise<AdminAccount | null> {
    const upper = code.trim().toUpperCase();
    for (const acc of this.adminAccounts.values()) {
      if (acc.ngoCode && acc.ngoCode.toUpperCase() === upper) {
        return acc;
      }
    }
    return null;
  }

  async getAdminAccountByEmail(email: string): Promise<AdminAccount | null> {
    const clean = email.trim().toLowerCase();
    for (const acc of this.adminAccounts.values()) {
      if (acc.email && acc.email.toLowerCase() === clean) {
        return acc;
      }
    }
    return null;
  }
}

export const db = new MockFirestore();
