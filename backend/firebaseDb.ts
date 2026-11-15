import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { NeedEntity, VolunteerProfile } from '../shared/types';
import * as path from 'path';
import * as fs from 'fs';

import { db as mockDb } from './mockFirestore';

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'serviceAccount.json');
let firestore: admin.firestore.Firestore | null = null;
let useMock = process.env.DISABLE_FIRESTORE === 'true';

if (!useMock && fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    firestore = admin.firestore();
    console.log('✅ Firebase Admin initialized (Real Cloud Mode).');
  } catch (error) {
    console.error('⚠️ Firebase init failed, falling back to local Mock:', (error as any).message);
    useMock = true;
  }
} else if (useMock) {
  console.log('🚀 Local Demo Mode: Firestore is explicitly DISABLED.');
} else {
  console.warn('⚠️ No serviceAccount.json found, using local Mock.');
  useMock = true;
}

class FirebaseDb {
  // --- Needs ---
  async addNeed(need: NeedEntity): Promise<void> {
    if (useMock || !firestore) return mockDb.addNeed(need);
    try {
      await firestore.collection('needs').doc(need.id).set(need);
    } catch (e) {
      console.error("Firestore write failed, falling back to mock:", (e as any).message);
      useMock = true;
      return mockDb.addNeed(need);
    }
  }

  async updateNeed(id: string, updates: Partial<NeedEntity>): Promise<void> {
    if (useMock || !firestore) return mockDb.updateNeed(id, updates);
    try {
      await firestore.collection('needs').doc(id).update(updates);
    } catch (e) {
      useMock = true;
      return mockDb.updateNeed(id, updates);
    }
  }

  async getRecentUnresolvedNeeds(): Promise<NeedEntity[]> {
    if (useMock || !firestore) return mockDb.getRecentUnresolvedNeeds();
    try {
      const TWELVE_HOURS = 12 * 60 * 60 * 1000;
      const cutoffNode = Date.now() - TWELVE_HOURS;
      const snapshot = await firestore.collection('needs').get();
      const needs: NeedEntity[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as NeedEntity;
        if (data.status !== 'RESOLVED' && data.reportedAt >= cutoffNode) {
          needs.push(data);
        }
      });
      return needs;
    } catch (e) {
      console.warn("Firestore access denied. Falling back to local demo mode.");
      useMock = true;
      return mockDb.getRecentUnresolvedNeeds();
    }
  }

  async getAllNeeds(): Promise<NeedEntity[]> {
    if (useMock || !firestore) return mockDb.getAllNeeds();
    try {
      const snapshot = await firestore.collection('needs').get();
      const needs: NeedEntity[] = [];
      snapshot.forEach(doc => needs.push(doc.data() as NeedEntity));
      return needs;
    } catch (e) {
      useMock = true;
      return mockDb.getAllNeeds();
    }
  }

  async clearAllNeeds(): Promise<void> {
    if (useMock || !firestore) return mockDb.clearAllNeeds();
    try {
      const snapshot = await firestore.collection('needs').get();
      const batch = firestore.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    } catch (e) {
      useMock = true;
      return mockDb.clearAllNeeds();
    }
  }

  async resolveNeed(id: string): Promise<void> {
    if (useMock || !firestore) return mockDb.resolveNeed(id);
    try {
      await firestore.collection('needs').doc(id).update({ status: 'RESOLVED' });
    } catch (e) {
      useMock = true;
      return mockDb.resolveNeed(id);
    }
  }

  // --- Volunteers ---
  async getVolunteers(): Promise<VolunteerProfile[]> {
    if (useMock || !firestore) return mockDb.getVolunteers();
    try {
      const snapshot = await firestore.collection('volunteers').get();
      const volunteers: VolunteerProfile[] = [];
      snapshot.forEach(doc => volunteers.push(doc.data() as VolunteerProfile));
      
      if (volunteers.length === 0) {
        return [];
      }
      return volunteers;
    } catch (e) {
      useMock = true;
      return mockDb.getVolunteers();
    }
  }

  async addVolunteer(volunteer: VolunteerProfile): Promise<void> {
    if (useMock || !firestore) return mockDb.addVolunteer(volunteer);
    try {
      await firestore.collection('volunteers').doc(volunteer.id).set(volunteer);
    } catch (e) {
      useMock = true;
      return mockDb.addVolunteer(volunteer);
    }
  }

  async updateVolunteer(id: string, updates: Partial<VolunteerProfile>): Promise<VolunteerProfile | null> {
    if (useMock || !firestore) return mockDb.updateVolunteer(id, updates);
    try {
      await firestore.collection('volunteers').doc(id).update(updates);
      const doc = await firestore.collection('volunteers').doc(id).get();
      return (doc.data() as VolunteerProfile) || null;
    } catch (e) {
      useMock = true;
      return mockDb.updateVolunteer(id, updates);
    }
  }

  async getVolunteerById(id: string): Promise<VolunteerProfile | null> {
    if (useMock || !firestore) return mockDb.getVolunteerById(id);
    try {
      const doc = await firestore.collection('volunteers').doc(id).get();
      if (!doc.exists) return null;
      return (doc.data() as VolunteerProfile) || null;
    } catch (e) {
      useMock = true;
      return mockDb.getVolunteerById(id);
    }
  }

  async clearAllVolunteers(): Promise<void> {
    if (useMock || !firestore) return mockDb.clearAllVolunteers();
    try {
      const snapshot = await firestore.collection('volunteers').get();
      const batch = firestore.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    } catch (e) {
      useMock = true;
      return mockDb.clearAllVolunteers();
    }
  }

  async deleteVolunteer(id: string): Promise<boolean> {
    if (useMock || !firestore) return mockDb.deleteVolunteer(id);
    try {
      await firestore.collection('volunteers').doc(id).delete();
      return true;
    } catch (e) {
      useMock = true;
      return mockDb.deleteVolunteer(id);
    }
  }

  seedNgoVolunteers(): void {
    if (useMock || !firestore) return mockDb.seedNgoVolunteers();
  }

  private async seedVolunteers() {
    // No-op: no fake volunteers seeded
  }
}

export const db = new FirebaseDb();
