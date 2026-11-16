import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import { AIService } from './aiService';
import { processDeduplication, haversineDistance } from './deduplication';
import { db } from './firebaseDb';
import { NeedEntity, VolunteerProfile, EnRouteResponder, AdminAccount, AdminDepartmentCategory } from '../shared/types';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Setup Multer for basic file uploads (in-memory for the demo)
const upload = multer({ storage: multer.memoryStorage() });

// Smart local keyword extractor — used as fallback when Gemini quota is exhausted
function smartLocalExtract(text: string): Partial<any> | null {
  const t = text.toLowerCase();

  // Crisis type detection
  let crisisType = 'medical';
  if (/flood|water|rain|tanker|river|drowning|drain|submerged|बाढ़|पानी|नदी/.test(t)) crisisType = 'water';
  else if (/food|hungry|starv|eat|ration|packet|grocery|meal|भूख|खाना|राशन/.test(t)) crisisType = 'food';
  else if (/shelter|tent|roof|homeless|displaced|house|stay|live|बेघर|छत/.test(t)) crisisType = 'shelter';
  else if (/road|bridge|sinkhole|collapse|building|debris|rubble|infra|crack|falling|तोड|गिर|पुल|सड़क/.test(t)) crisisType = 'infrastructure';
  else if (/fire|medical|doctor|hospital|injured|ambulance|sick|hurt|trapped|blood|patient|emergency|आग|अस्पताल|घायल|दुर्घटना|accident|earthquake|भूकंप|cyclone|तूफान|storm|landslide/.test(t)) crisisType = 'medical';
  else if (/help|need|urgent|crisis|danger|problem|critical|severe|serious|मदद|जरूरी|खतरा|संकट/.test(t)) crisisType = 'medical';
  else if (t.trim().split(/\s+/).length >= 5) crisisType = 'medical';
  else return null;

  const locationMap: Record<string, { lat: number; lng: number }> = {
    'bagru': { lat: 26.8143, lng: 75.5447 },
    'jaipur': { lat: 26.9124, lng: 75.7873 },
    'sanganer': { lat: 26.8288, lng: 75.7885 },
    'mansarovar': { lat: 26.8643, lng: 75.7667 },
    'malviya nagar': { lat: 26.8524, lng: 75.8174 },
    'vaishali nagar': { lat: 26.9066, lng: 75.7423 },
    'c scheme': { lat: 26.9124, lng: 75.7873 },
    'amer': { lat: 26.9855, lng: 75.8513 },
    'jodhpur': { lat: 26.2389, lng: 73.0243 },
    'udaipur': { lat: 24.5854, lng: 73.7125 },
    'gateway of india': { lat: 18.9220, lng: 72.8347 },
    'dharavi': { lat: 19.0422, lng: 72.8538 },
    'juhu': { lat: 19.0990, lng: 72.8267 },
    'bandra': { lat: 19.0596, lng: 72.8295 },
    'andheri': { lat: 19.1136, lng: 72.8697 },
    'marine drive': { lat: 18.9430, lng: 72.8235 },
    'dadar': { lat: 19.0178, lng: 72.8478 },
    'kurla': { lat: 19.0726, lng: 72.8845 },
    'worli': { lat: 19.0168, lng: 72.8171 },
    'colaba': { lat: 18.9068, lng: 72.8148 },
    'borivali': { lat: 19.2307, lng: 72.8567 },
    'thane': { lat: 19.2183, lng: 72.9781 },
    'navi mumbai': { lat: 19.0330, lng: 73.0297 },
    'powai': { lat: 19.1176, lng: 72.9060 },
    'chembur': { lat: 19.0622, lng: 72.8974 },
    'malad': { lat: 19.1874, lng: 72.8484 },
    'ghatkopar': { lat: 19.0884, lng: 72.9125 },
    'sion': { lat: 19.0390, lng: 72.8619 },
    'mumbai': { lat: 19.0760, lng: 72.8777 },
    'india gate': { lat: 28.6129, lng: 77.2295 },
    'connaught place': { lat: 28.6315, lng: 77.2167 },
    'cp': { lat: 28.6315, lng: 77.2167 },
    'delhi': { lat: 28.6139, lng: 77.2090 },
    'bengaluru': { lat: 12.9716, lng: 77.5946 },
    'bangalore': { lat: 12.9716, lng: 77.5946 },
    'chennai': { lat: 13.0827, lng: 80.2707 },
    'kolkata': { lat: 22.5726, lng: 88.3639 },
    'hyderabad': { lat: 17.3850, lng: 78.4867 },
    'pune': { lat: 18.5204, lng: 73.8567 },
    'ahmedabad': { lat: 23.0225, lng: 72.5714 },
    'lucknow': { lat: 26.8467, lng: 80.9462 },
  };

  let locationName = '';
  let coords: { lat: number; lng: number } | undefined = undefined;
  for (const [key, val] of Object.entries(locationMap)) {
    if (t.includes(key)) {
      locationName = key.replace(/\b\w/g, c => c.toUpperCase());
      coords = val;
      break;
    }
  }

  if (!coords) {
    return null; // Do not pretend to know coordinates if not in gazetteer
  }

  const scaleMatch = t.match(/(\d+)\s*(people|person|family|families|victims|residents)/);
  const estimatedScale = scaleMatch ? parseInt(scaleMatch[1]) : 10;

  const urgencyMap: Record<string, string> = {
    water: `Flooding/water shortage at ${locationName} affecting ~${estimatedScale} people. Immediate water distribution required.`,
    food: `Food scarcity reported at ${locationName} for ~${estimatedScale} people. Ration distribution needed.`,
    shelter: `Displacement event at ${locationName}, ~${estimatedScale} people without shelter.`,
    infrastructure: `Structural hazard at ${locationName}. Area evacuation and engineering assessment required.`,
    medical: `Medical emergency at ${locationName} involving ~${estimatedScale} people. Immediate medical response needed.`,
  };

  return {
    crisisType,
    location: { name: locationName, ...coords },
    urgencyReasoning: urgencyMap[crisisType],
    estimatedScale,
    originalLanguage: /[\u0900-\u097F]/.test(text) ? 'Hindi' : 'English',
  };
}

app.post('/needs/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    await db.resolveNeed(id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to resolve need' });
  }
});

app.get('/needs', async (req, res) => {
  const needs = await db.getAllNeeds();
  needs.sort((a, b) => b.criticalityScore - a.criticalityScore);
  res.json(needs);
});

app.get('/needs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cleanQuery = (id || '').replace(/^[#]/, '').trim().toLowerCase();
    const allNeeds = await db.getAllNeeds();
    const need = allNeeds.find(
      n =>
        n.id.toLowerCase() === cleanQuery ||
        (n.ticketCode && n.ticketCode.replace(/^[#]/, '').toLowerCase() === cleanQuery)
    );
    if (!need) return res.status(404).json({ error: 'Need not found' });
    res.json(need);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch need' });
  }
});

app.post('/needs/:id/respond', async (req, res) => {
  try {
    const { id } = req.params;
    const { volunteerId, name, ngo, phone } = req.body;
    const allNeeds = await db.getAllNeeds();
    const need = allNeeds.find(n => n.id === id);
    if (!need) return res.status(404).json({ error: 'Need not found' });

    const responder: EnRouteResponder = {
      id: volunteerId || crypto.randomUUID(),
      name: name || 'Emergency Volunteer',
      ngo: ngo || 'Independent Responder',
      phone: phone || undefined,
      dispatchedAt: Date.now()
    };

    const currentList = Array.isArray(need.enRouteVolunteers) ? need.enRouteVolunteers : [];
    const alreadyInList = currentList.some(r => r.id === responder.id);
    const updatedList = alreadyInList ? currentList : [...currentList, responder];

    const updates: Partial<NeedEntity> = {
      status: 'EN_ROUTE',
      enRouteVolunteers: updatedList
    };

    await db.updateNeed(id, updates);
    if (volunteerId) {
      await db.updateVolunteer(volunteerId, { status: 'BUSY', lastDispatchedAt: Date.now() });
    }

    console.log(`🚗 Volunteer ${responder.name} [${responder.ngo}] is EN ROUTE to need ${id} (${need.location.name})`);
    res.json({ success: true, need: { ...need, ...updates } });
  } catch (e) {
    console.error('Failed to mark responder en route:', e);
    res.status(500).json({ error: 'Failed to record response' });
  }
});

app.post('/needs/:id/cancel-respond', async (req, res) => {
  try {
    const { id } = req.params;
    const { volunteerId } = req.body;
    const allNeeds = await db.getAllNeeds();
    const need = allNeeds.find(n => n.id === id);
    if (!need) return res.status(404).json({ error: 'Need not found' });

    const currentList = Array.isArray(need.enRouteVolunteers) ? need.enRouteVolunteers : [];
    const updatedList = currentList.filter(r => r.id !== volunteerId);

    const updates: Partial<NeedEntity> = {
      enRouteVolunteers: updatedList,
      status: updatedList.length === 0 ? 'OPEN' : 'EN_ROUTE'
    };

    await db.updateNeed(id, updates);
    if (volunteerId) {
      await db.updateVolunteer(volunteerId, { status: 'AVAILABLE' });
    }

    res.json({ success: true, need: { ...need, ...updates } });
  } catch (e) {
    res.status(500).json({ error: 'Failed to cancel response' });
  }
});

app.delete('/needs', async (req, res) => {
  try {
    await db.clearAllNeeds();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to clear needs' });
  }
});

app.get('/volunteers', async (req, res) => {
  const vols = await db.getVolunteers();
  res.json(vols);
});

app.get('/volunteers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const vols = await db.getVolunteers();
    const volunteer = vols.find(v => v.id === id);
    if (!volunteer) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    res.json(volunteer);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/volunteers', async (req, res) => {
  try {
    const { name, ngo, ngoCode, phone, email, preferredLanguage, skills, locationCoords, locationName } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Volunteer name is required' });
    }

    if (!locationCoords || typeof locationCoords.lat !== 'number' || typeof locationCoords.lng !== 'number') {
      return res.status(400).json({ error: 'Valid location coordinates (lat, lng) are required' });
    }

    const cleanNgoCode = ngoCode && typeof ngoCode === 'string' ? ngoCode.trim().toUpperCase() : undefined;

    // Check if volunteer with email already exists to prevent duplication
    if (email && email.trim()) {
      const existing = await db.getVolunteerByEmail(email.trim());
      if (existing) {
        const updated = await db.updateVolunteer(existing.id, {
          name: name.trim(),
          ngo: ngo && ngo.trim() ? ngo.trim() : existing.ngo,
          ngoCode: cleanNgoCode !== undefined ? cleanNgoCode : existing.ngoCode,
          phone: phone ? phone.trim() : existing.phone,
          preferredLanguage: preferredLanguage || existing.preferredLanguage,
          skills: Array.isArray(skills) && skills.length > 0 ? skills : existing.skills,
          locationCoords: {
            lat: Number(locationCoords.lat),
            lng: Number(locationCoords.lng)
          },
          locationName: locationName || existing.locationName
        });
        return res.status(200).json({ success: true, volunteer: updated || existing, message: 'Existing volunteer record updated' });
      }
    }

    const newVolunteer: VolunteerProfile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      ngo: ngo && ngo.trim() ? ngo.trim() : 'Independent Civic Responder',
      ngoCode: cleanNgoCode,
      phone: phone ? phone.trim() : undefined,
      email: email ? email.trim() : undefined,
      preferredLanguage: preferredLanguage || 'English',
      skills: Array.isArray(skills) && skills.length > 0 ? skills : ['general rescue'],
      locationCoords: {
        lat: Number(locationCoords.lat),
        lng: Number(locationCoords.lng)
      },
      locationName: locationName || 'Custom Location',
      reliabilityRate: 0.95,
      status: 'AVAILABLE',
      hoursLast30Days: 0,
      pastContributions: ['Newly registered responder in CommunityPulse network'],
      registeredAt: Date.now()
    };

    await db.addVolunteer(newVolunteer);
    console.log(`🙋 New Volunteer Registered: ${newVolunteer.name} [${newVolunteer.ngo}${cleanNgoCode ? ' Code:' + cleanNgoCode : ''}] at ${newVolunteer.locationName} (${newVolunteer.locationCoords.lat}, ${newVolunteer.locationCoords.lng})`);
    
    res.status(201).json({ success: true, volunteer: newVolunteer });
  } catch (error) {
    console.error('Failed to register volunteer:', error);
    res.status(500).json({ error: 'Failed to register volunteer' });
  }
});

app.patch('/volunteers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ngo, ngoCode, locationCoords, locationName, status, skills, preferredLanguage, phone, email } = req.body;
    
    const updates: Partial<VolunteerProfile> = {};
    if (ngo !== undefined) updates.ngo = ngo.trim();
    if (ngoCode !== undefined) updates.ngoCode = typeof ngoCode === 'string' ? ngoCode.trim().toUpperCase() : undefined;
    if (locationCoords && typeof locationCoords.lat === 'number' && typeof locationCoords.lng === 'number') {
      updates.locationCoords = {
        lat: Number(locationCoords.lat),
        lng: Number(locationCoords.lng)
      };
    }
    if (locationName) updates.locationName = locationName;
    if (status && ['AVAILABLE', 'BUSY', 'OFF_DUTY'].includes(status)) {
      updates.status = status;
    }
    if (skills && Array.isArray(skills)) updates.skills = skills;
    if (preferredLanguage) updates.preferredLanguage = preferredLanguage;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;

    const updated = await db.updateVolunteer(id, updates);
    if (!updated) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }

    console.log(`🔄 Volunteer ${id} updated:`, updates);
    res.json({ success: true, volunteer: updated });
  } catch (error) {
    console.error('Failed to update volunteer:', error);
    res.status(500).json({ error: 'Failed to update volunteer' });
  }
});

app.delete('/volunteers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteVolunteer(id);
    res.json({ success: true, message: `Volunteer ${id} removed` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete volunteer' });
  }
});

app.delete('/volunteers', async (req, res) => {
  try {
    await db.clearAllVolunteers();
    res.json({ success: true, message: 'All volunteers cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear volunteers' });
  }
});

app.post('/volunteers/seed', async (req, res) => {
  try {
    db.seedNgoVolunteers();
    const vols = await db.getVolunteers();
    res.json({ success: true, count: vols.length, volunteers: vols });
  } catch (error) {
    res.status(500).json({ error: 'Failed to seed verified NGO teams' });
  }
});

// --- Admin Department Authentication & NGO Code Management ---
const handleRegisterAdmin = async (req: express.Request, res: express.Response) => {
  try {
    const { email, password, departmentCategory, departmentName, stationName, hqCoords } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    if (!password || password.trim().length < 6) {
      return res.status(400).json({ error: 'Password is required and must be at least 6 characters.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Enforce unique email check
    const existing = await db.getAdminAccountByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'An admin account with this Email ID already exists. Please sign in instead.' });
    }

    if (!departmentCategory || !departmentName || !stationName) {
      return res.status(400).json({ error: 'Department category, department name, and station name are required.' });
    }

    const validCategories: AdminDepartmentCategory[] = [
      'FIRE_DEPT',
      'POLICE_DEPT',
      'NGO',
      'MEDICAL_HEALTH',
      'DISASTER_MGMT'
    ];

    if (!validCategories.includes(departmentCategory)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }

    let ngoCode: string | undefined = undefined;
    if (departmentCategory === 'NGO') {
      const customCode = req.body.ngoCode;
      if (customCode && typeof customCode === 'string' && customCode.trim().length === 5) {
        const clean = customCode.trim().toUpperCase().replace(/[^A-Z]/g, '');
        if (clean.length === 5) {
          const existing = await db.getAdminAccountByNgoCode(clean);
          if (existing) {
            return res.status(409).json({ error: `NGO code "${clean}" is already in use by another department/organization.` });
          }
          ngoCode = clean;
        }
      }
      if (!ngoCode) {
        ngoCode = db.generateUnique5LetterCode();
      }
    }

    const defaultCoords = hqCoords && typeof hqCoords.lat === 'number' && typeof hqCoords.lng === 'number'
      ? { lat: Number(hqCoords.lat), lng: Number(hqCoords.lng) }
      : { lat: 26.9124, lng: 75.7873 }; // Default central command

    const newAccount: AdminAccount = {
      id: crypto.randomUUID(),
      email: cleanEmail,
      password: password.trim(),
      departmentCategory,
      departmentName: departmentName.trim(),
      stationName: stationName.trim(),
      hqCoords: defaultCoords,
      radiusKm: 15, // Fixed 15 km area as specified
      ngoCode,
      createdAt: Date.now()
    };

    await db.addAdminAccount(newAccount);
    console.log(`🛡️ Admin Account Registered: [${newAccount.departmentCategory}] ${newAccount.departmentName} (${cleanEmail}) - 15km Radius${ngoCode ? ' [NGO Code: ' + ngoCode + ']' : ''}`);

    const { password: _, ...safeAccount } = newAccount;
    res.status(201).json({ success: true, account: safeAccount });
  } catch (error) {
    console.error('Failed to register admin account:', error);
    res.status(500).json({ error: 'Failed to register admin account' });
  }
};

const handleLoginAdmin = async (req: express.Request, res: express.Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email ID is required.' });
    }

    if (!password || !password.trim()) {
      return res.status(400).json({ error: 'Password is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const account = await db.getAdminAccountByEmail(cleanEmail);

    if (!account) {
      return res.status(404).json({ error: 'No admin account found with this email. Please register first.' });
    }

    if (account.password && account.password !== password.trim()) {
      return res.status(401).json({ error: 'Invalid password. Please check and try again.' });
    }

    const { password: _, ...safeAccount } = account;
    res.json({ success: true, account: safeAccount });
  } catch (error) {
    console.error('Failed to login admin account:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

app.post('/admin/auth/register', handleRegisterAdmin);
app.post('/api/admin/auth/register', handleRegisterAdmin);
app.post('/admin/auth/login', handleLoginAdmin);
app.post('/api/admin/auth/login', handleLoginAdmin);

// --- Volunteer Authentication & Session Management ---
const handleRegisterVolunteer = async (req: express.Request, res: express.Response) => {
  try {
    const { name, email, password, ngo, ngoCode, phone, preferredLanguage, skills, locationCoords, locationName } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email ID is required for volunteer registration.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!password || password.trim().length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Volunteer name is required.' });
    }

    // Enforce unique email check across volunteers
    const existing = await db.getVolunteerByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'A volunteer account with this Email ID already exists. Please sign in instead.' });
    }

    const cleanNgoCode = ngoCode && typeof ngoCode === 'string' ? ngoCode.trim().toUpperCase() : undefined;
    const coords = locationCoords && typeof locationCoords.lat === 'number' && typeof locationCoords.lng === 'number'
      ? { lat: Number(locationCoords.lat), lng: Number(locationCoords.lng) }
      : { lat: 28.6139, lng: 77.2090 };

    const newVolunteer: VolunteerProfile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: cleanEmail,
      password: password.trim(),
      ngo: ngo && ngo.trim() ? ngo.trim() : 'Independent Civic Responder',
      ngoCode: cleanNgoCode,
      phone: phone ? phone.trim() : undefined,
      preferredLanguage: preferredLanguage || 'English',
      skills: Array.isArray(skills) && skills.length > 0 ? skills : ['medical', 'first_aid'],
      locationCoords: coords,
      locationName: locationName || 'Local Station',
      reliabilityRate: 0.95,
      status: 'AVAILABLE',
      hoursLast30Days: 0,
      pastContributions: ['Registered responder in CommunityPulse verified network'],
      registeredAt: Date.now()
    };

    await db.addVolunteer(newVolunteer);
    console.log(`🛡️ Volunteer Registered: ${newVolunteer.name} (${newVolunteer.email}) [NGO: ${newVolunteer.ngo}${cleanNgoCode ? ' Code:' + cleanNgoCode : ''}]`);

    const { password: _, ...safeProfile } = newVolunteer;
    res.status(201).json({ success: true, volunteer: safeProfile });
  } catch (error) {
    console.error('Failed to register volunteer:', error);
    res.status(500).json({ error: 'Failed to register volunteer' });
  }
};

const handleLoginVolunteer = async (req: express.Request, res: express.Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter both Email ID and Password.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const volunteer = await db.getVolunteerByEmail(cleanEmail);
    if (!volunteer) {
      return res.status(401).json({ error: 'No volunteer found with this Email ID. Please register.' });
    }

    if (volunteer.password && volunteer.password !== password.trim()) {
      return res.status(401).json({ error: 'Invalid password. Please verify your credentials.' });
    }

    console.log(`🔑 Volunteer Signed In: ${volunteer.name} (${volunteer.email})`);
    const { password: _, ...safeProfile } = volunteer;
    res.json({ success: true, volunteer: safeProfile });
  } catch (error) {
    console.error('Failed to authenticate volunteer:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

app.post('/volunteers/auth/register', handleRegisterVolunteer);
app.post('/api/volunteers/auth/register', handleRegisterVolunteer);
app.post('/volunteers/auth/login', handleLoginVolunteer);
app.post('/api/volunteers/auth/login', handleLoginVolunteer);

app.get(['/admin/auth/accounts', '/api/admin/auth/accounts'], async (req, res) => {
  try {
    const accounts = await db.getAdminAccounts();
    const safeAccounts = accounts.map(({ password: _, ...rest }) => rest);
    res.json({ success: true, accounts: safeAccounts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list accounts' });
  }
});

app.get(['/organizations', '/api/organizations'], async (req, res) => {
  try {
    const accounts = await db.getAdminAccounts();
    const organizations = accounts.map(a => ({
      id: a.id,
      name: a.departmentName,
      category: a.departmentCategory,
      stationName: a.stationName,
      hasCode: !!a.ngoCode
    }));
    res.json({ success: true, organizations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve organizations' });
  }
});

app.patch(['/admin/auth/account/:id/code', '/api/admin/auth/account/:id/code'], async (req, res) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : String(rawId);
    const { ngoCode } = req.body;
    if (!ngoCode || typeof ngoCode !== 'string' || ngoCode.trim().length !== 5) {
      return res.status(400).json({ error: 'NGO team code must be exactly 5 letters.' });
    }
    const cleanCode = ngoCode.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (cleanCode.length !== 5) {
      return res.status(400).json({ error: 'NGO team code must contain 5 uppercase letters (A-Z).' });
    }

    const existing = await db.getAdminAccountByNgoCode(cleanCode);
    if (existing && existing.id !== id) {
      return res.status(409).json({ error: `NGO code "${cleanCode}" is already assigned to another organization.` });
    }

    const updated = await db.updateAdminAccount(id, { ngoCode: cleanCode });
    if (!updated) {
      return res.status(404).json({ error: 'Admin account not found.' });
    }

    const { password: _, ...safeAccount } = updated;
    res.json({ success: true, account: safeAccount });
  } catch (error) {
    console.error('Failed to update NGO code:', error);
    res.status(500).json({ error: 'Failed to update NGO code' });
  }
});

app.get('/ngos/validate-code/:code', async (req, res) => {
  try {
    const code = req.params.code ? req.params.code.trim().toUpperCase() : '';
    if (!code || code.length !== 5) {
      return res.status(400).json({ valid: false, error: 'NGO code must be exactly 5 letters.' });
    }

    const account = await db.getAdminAccountByNgoCode(code);
    if (account) {
      return res.json({ valid: true, ngoName: account.departmentName, code });
    }

    // If not found in database memory, validate if it conforms to a 5-letter code format
    const isLetters = /^[A-Z]{5}$/.test(code);
    if (isLetters) {
      return res.json({ valid: true, ngoName: `NGO Affiliated (${code})`, code });
    }

    res.status(404).json({ valid: false, error: 'Invalid or unknown NGO code' });
  } catch (error) {
    res.status(500).json({ error: 'Validation error' });
  }
});

app.post('/ingest', upload.single('image'), async (req, res) => {
  try {
    const rawText = req.body.text || '';
    console.log('📥 Incoming Ingest Request. Text:', rawText.substring(0, 50) + '...');

    let base64Image: string | undefined;
    if (req.file) {
      base64Image = req.file.buffer.toString('base64');
      console.log('📸 Image attached.');
    }

    if (!rawText && !base64Image) {
      console.warn('⚠️ Rejected: No text or image provided.');
      return res.status(400).json({ error: 'Provide text or image' });
    }

    let extractedData;
    try {
      console.log('🤖 Calling Gemini AI for extraction...');
      extractedData = await AIService.extractNeed(rawText, base64Image);

      if (!extractedData || !extractedData.crisisType || !extractedData.location) {
        throw new Error('Incomplete data from AI');
      }
    } catch (e) {
      console.warn('⚠️ Gemini unavailable or network error — trying smart local extraction.');
      extractedData = smartLocalExtract(rawText || 'emergency signal');
      if (extractedData) {
        (extractedData as any).isLocal = true;
      }
    }

    if (!extractedData) {
      console.warn('⚠️ Rejected: Signal unclear — could not extract crisis data.');
      return res.status(422).json({ error: 'Signal unclear — could not extract crisis data. Please add more detail: location, type, or scale.' });
    }

    // Direct GPS Passthrough & Validation
    const clientLat = req.body.lat !== undefined && req.body.lat !== '' ? parseFloat(req.body.lat) : undefined;
    const clientLng = req.body.lng !== undefined && req.body.lng !== '' ? parseFloat(req.body.lng) : undefined;
    const hasClientGps = typeof clientLat === 'number' && !isNaN(clientLat) && typeof clientLng === 'number' && !isNaN(clientLng);

    let finalLat: number | undefined;
    let finalLng: number | undefined;
    let finalLocationName: string = req.body.locationName || extractedData.location?.name || 'Reported Location';

    if (hasClientGps) {
      finalLat = clientLat;
      finalLng = clientLng;
      console.log(`📍 Using exact client GPS coordinates: [${finalLat}, ${finalLng}] for ${finalLocationName}`);
    } else if (typeof extractedData.location?.lat === 'number' && typeof extractedData.location?.lng === 'number' && !isNaN(extractedData.location.lat) && !isNaN(extractedData.location.lng)) {
      finalLat = extractedData.location.lat;
      finalLng = extractedData.location.lng;
      console.log(`🤖 Using AI/geocoded coordinates: [${finalLat}, ${finalLng}] for ${finalLocationName}`);
    }

    // Zero-fallback policy: If coordinates could not be determined, return an explicit error instead of a fake location
    if (typeof finalLat !== 'number' || typeof finalLng !== 'number' || isNaN(finalLat) || isNaN(finalLng)) {
      console.warn(`⚠️ Rejected: Could not determine valid GPS coordinates for location "${finalLocationName}".`);
      return res.status(422).json({
        error: `Could not determine exact coordinates for "${finalLocationName}". Please enable device GPS or specify a recognized town/city name.`
      });
    }

    const locationStr = `${extractedData.crisisType} ${finalLocationName} ${extractedData.urgencyReasoning}`;

    let embedding: number[];
    try {
      embedding = await AIService.getEmbedding(locationStr);
    } catch (e: any) {
      console.warn('⚠️ Embedding quota hit — using zero vector for dedup.');
      embedding = new Array(768).fill(0).map(() => Math.random() * 0.01);
    }

    const ticketCode = `CP-${Math.floor(1000 + Math.random() * 9000)}`;

    // Calibrated Signal Completeness Metric (0 - 100):
    // +35 for verified coordinates, +30 for attached photo proof, +20 for crisis classification, +15 base text
    let signalConfidence = 15;
    if (finalLat && finalLng) signalConfidence += 35;
    if (base64Image) signalConfidence += 30;
    if (extractedData.crisisType && extractedData.crisisType !== 'other') signalConfidence += 20;

    const newNeed: NeedEntity = {
      id: crypto.randomUUID(),
      ticketCode,
      location: {
        name: finalLocationName,
        lat: finalLat,
        lng: finalLng
      },
      crisisType: (extractedData.crisisType || 'medical') as any,
      urgencyReasoning: extractedData.urgencyReasoning || 'Immediate assistance required.',
      estimatedScale: extractedData.estimatedScale || 1,
      reportCount: 1,
      criticalityScore: 0,
      status: 'OPEN',
      verificationStatus: 'PENDING',
      verificationConfidence: signalConfidence,
      reportedAt: Date.now(),
      rawInputs: [rawText],
      embedding,
      originalLanguage: extractedData.originalLanguage,
      isLocal: (extractedData as any).isLocal || false,
      photoUrl: base64Image ? `data:image/jpeg;base64,${base64Image}` : undefined,
      timeline: [
        { timestamp: Date.now(), action: 'Distress Signal Transmitted & Logged in Central Command', actorRole: 'CITIZEN' }
      ]
    };

    const processedNeed = await processDeduplication(newNeed);
    res.json(processedNeed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/ingest-audio', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { base64Audio } = req.body;
    if (!base64Audio) return res.status(400).json({ error: 'Missing base64Audio content' });

    console.log('🎤 Transcribing audio...');
    const transcribedText = await AIService.transcribeAudio(base64Audio);

    if (!transcribedText || transcribedText.trim().length < 5) {
      console.warn('⚠️ Audio transcription returned empty or failed.');
      return res.status(400).json({
        error: 'Could not transcribe audio. Please speak clearly or type your report directly.'
      });
    }

    console.log(`✅ Transcribed: "${transcribedText.substring(0, 80)}..."`);
    res.json({ transcribedText });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error processing audio' });
  }
});

app.post('/dispatch', async (req, res) => {
  try {
    const { needId, volunteerId } = req.body;
    if (!needId) return res.status(400).json({ error: 'needId required' });

    const allNeeds = await db.getAllNeeds();
    const need = allNeeds.find(n => n.id === needId);
    if (!need) return res.status(404).json({ error: 'Need not found' });

    const volunteers = await db.getVolunteers();
    let topVolunteer: VolunteerProfile | null = null;

    if (volunteerId) {
      topVolunteer = volunteers.find(v => v.id === volunteerId) || null;
    }

    if (!topVolunteer) {
      // Find eligible volunteers within 5km, or expand up to 35km if none immediately available
      let eligibleVolunteers = volunteers.filter(v => {
        if (v.status === 'OFF_DUTY') return false;
        const dist = haversineDistance(
          need.location.lat, need.location.lng,
          v.locationCoords.lat, v.locationCoords.lng
        );
        return dist <= 5.0;
      });

      if (eligibleVolunteers.length === 0) {
        eligibleVolunteers = volunteers.filter(v => v.status !== 'OFF_DUTY');
      }

      if (eligibleVolunteers.length === 0) {
        if (req.body.respondingParty || req.body.departmentName) {
          const dept = (req.body.respondingParty || req.body.departmentName).trim();
          const updates: Partial<NeedEntity> = {
            status: 'EN_ROUTE',
            respondingParty: dept,
            responseStatus: 'RESPONDING',
            timeline: [
              ...(need.timeline || []),
              {
                timestamp: Date.now(),
                action: `Official response support dispatched by ${dept}`,
                actorRole: 'ADMIN' as const
              }
            ]
          };
          await db.updateNeed(need.id, updates);
          console.log(`🚀 Department Dispatch Executed: ${dept} dispatched to ${need.location.name}. Need status: EN_ROUTE`);
          return res.json({
            success: true,
            respondingParty: dept,
            need: { ...need, ...updates }
          });
        }
        return res.status(404).json({ error: 'No response units available for dispatch.' });
      }

      const scoredVolunteers = eligibleVolunteers.map(v => {
        const dist = haversineDistance(need.location.lat, need.location.lng, v.locationCoords.lat, v.locationCoords.lng);
        const inverseDistance = Math.max(0, 1 - (dist / 25.0));
        const skillMatch = v.skills.some(s => s.toLowerCase().includes(need.crisisType.toLowerCase())) ? 1.0 : 0.0;
        const matchScore = (v.reliabilityRate * 0.5) + (skillMatch * 0.3) + (inverseDistance * 0.2);
        return { volunteer: v, matchScore, dist };
      });

      scoredVolunteers.sort((a, b) => b.matchScore - a.matchScore);
      topVolunteer = scoredVolunteers[0]?.volunteer || null;
    }

    if (!topVolunteer) {
      return res.status(404).json({ error: 'No suitable volunteers found' });
    }

    const dispatchMessage = await AIService.generateDispatchMessage(topVolunteer, need);

    const dist = haversineDistance(
      need.location.lat, need.location.lng,
      topVolunteer.locationCoords.lat, topVolunteer.locationCoords.lng
    );
    const etaMinutes = Math.max(4, Math.round(dist * 2.2));

    // Attach volunteer to need as EN_ROUTE
    const responder: EnRouteResponder = {
      id: topVolunteer.id,
      name: topVolunteer.name,
      ngo: topVolunteer.ngo,
      phone: topVolunteer.phone,
      dispatchedAt: Date.now(),
      etaMinutes,
      missionStatus: 'EN_ROUTE'
    };

    const currentList = Array.isArray(need.enRouteVolunteers) ? need.enRouteVolunteers : [];
    const alreadyIn = currentList.some(r => r.id === responder.id);
    const updatedList = alreadyIn ? currentList : [...currentList, responder];

    const allocatedSupplies = [
      need.crisisType === 'water' ? { supplyId: 'sup-1', name: 'Packaged Drinking Water (20L Cans)', quantity: Math.max(5, need.estimatedScale * 2), unit: 'Cans' } : null,
      need.crisisType === 'food' ? { supplyId: 'sup-2', name: 'Ready Emergency Rations', quantity: Math.max(10, need.estimatedScale * 3), unit: 'Packs' } : null,
      need.crisisType === 'medical' ? { supplyId: 'sup-3', name: 'Trauma & Emergency First Aid Kits', quantity: Math.max(2, Math.ceil(need.estimatedScale / 4)), unit: 'Kits' } : null,
    ].filter(Boolean) as any;

    const timeline = [
      ...(need.timeline || []),
      {
        timestamp: Date.now(),
        action: `Responder ${topVolunteer.name} (${topVolunteer.ngo || 'Field Unit'}) Dispatched (ETA ~${etaMinutes} mins)`,
        actorRole: 'ADMIN' as const
      }
    ];

    const respondingParty = req.body.respondingParty
      ? req.body.respondingParty.trim()
      : topVolunteer.ngo && topVolunteer.ngo !== 'Independent Civic Responder'
      ? `${topVolunteer.name} (${topVolunteer.ngo})`
      : topVolunteer.name;

    const updates: Partial<NeedEntity> = {
      status: 'EN_ROUTE',
      enRouteVolunteers: updatedList,
      allocatedSupplies,
      timeline,
      dispatchMessage,
      respondingParty,
      responseStatus: 'RESPONDING'
    };

    await db.updateNeed(need.id, updates);
    await db.updateVolunteer(topVolunteer.id, { status: 'BUSY', lastDispatchedAt: Date.now() });

    console.log(`🚀 Dispatch Executed: ${topVolunteer.name} (${topVolunteer.ngo}) dispatched to ${need.location.name}. Need status: EN_ROUTE`);

    res.json({
      success: true,
      volunteer: topVolunteer,
      dispatchMessage,
      need: { ...need, ...updates }
    });
  } catch (error) {
    console.error('Dispatch error:', error);
    res.status(500).json({ error: 'Internal Server Error during dispatch' });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const { messages, contextData } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const reply = await AIService.askAssistant(messages, contextData);
    res.json({ text: reply });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ error: 'Internal Server Error during chat' });
  }
});


// Admin Incident Triage & Verification Endpoint
app.patch('/needs/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus, notes } = req.body; // 'VERIFIED' | 'REJECTED_SPAM'

    const allNeeds = await db.getAllNeeds();
    const need = allNeeds.find(n => n.id === id);
    if (!need) return res.status(404).json({ error: 'Need not found' });

    const newStatus = verificationStatus === 'REJECTED_SPAM' ? 'FALSE_ALARM' : 'VERIFIED';
    const actionDesc = verificationStatus === 'REJECTED_SPAM'
      ? `Incident flagged as False Alarm / Spam by Command${notes ? `: ${notes}` : ''}`
      : `Incident verified by Command Officer${notes ? `: ${notes}` : ''}`;

    const timeline = [
      ...(need.timeline || []),
      { timestamp: Date.now(), action: actionDesc, actorRole: 'ADMIN' as const }
    ];

    const updates = {
      verificationStatus: verificationStatus as any,
      status: newStatus as any,
      timeline
    };

    await db.updateNeed(id, updates);
    console.log(`🛡️ Incident ${need.ticketCode || need.id} Triage: Status set to ${newStatus}`);

    res.json({ success: true, id, status: newStatus, verificationStatus });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Failed to update verification status' });
  }
});

// Admin Incident Escalation to NDRF / 112 Authorities
app.patch('/needs/:id/escalate', async (req, res) => {
  try {
    const { id } = req.params;
    const { authority = 'NDRF & 112 Emergency Dispatch', notes } = req.body;

    const allNeeds = await db.getAllNeeds();
    const need = allNeeds.find(n => n.id === id);
    if (!need) return res.status(404).json({ error: 'Need not found' });

    const timeline = [
      ...(need.timeline || []),
      {
        timestamp: Date.now(),
        action: `🚨 High-Risk Hazard Escalated to ${authority}${notes ? `: ${notes}` : ''}. Restricted from unequipped civilian volunteers.`,
        actorRole: 'ADMIN' as const
      }
    ];

    const updates = {
      status: 'ESCALATED_AUTHORITY' as any,
      timeline
    };

    await db.updateNeed(id, updates);
    console.log(`🚨 Incident ${need.ticketCode || need.id} Escalated to ${authority}`);

    res.json({ success: true, id, status: 'ESCALATED_AUTHORITY' });
  } catch (error) {
    console.error('Escalate error:', error);
    res.status(500).json({ error: 'Failed to escalate incident' });
  }
});

// Volunteer Field Checkpoint: Arrived On Scene
app.post('/dispatch/on-scene', async (req, res) => {
  try {
    const { needId, volunteerId, volunteerName } = req.body;
    if (!needId) return res.status(400).json({ error: 'needId required' });

    const allNeeds = await db.getAllNeeds();
    const need = allNeeds.find(n => n.id === needId);
    if (!need) return res.status(404).json({ error: 'Need not found' });

    const timeline = [
      ...(need.timeline || []),
      {
        timestamp: Date.now(),
        action: `Responders arrived on scene at ${need.location.name}. Active triage commenced.`,
        actorRole: 'VOLUNTEER' as const
      }
    ];

    await db.updateNeed(needId, { status: 'ON_SCENE', responseStatus: 'ON_SCENE', timeline });
    console.log(`📍 Field Update: Responders arrived at ${need.location.name} (${need.ticketCode || need.id})`);

    res.json({ success: true, status: 'ON_SCENE' });
  } catch (error) {
    console.error('On-scene error:', error);
    res.status(500).json({ error: 'Failed to mark on-scene' });
  }
});

// Volunteer / Admin Resolution with Proof-of-Work
app.post('/dispatch/resolve', upload.single('proofPhoto'), async (req, res) => {
  try {
    const { needId, notes, volunteerName, casualtiesAssisted } = req.body;
    if (!needId) return res.status(400).json({ error: 'needId required' });

    const allNeeds = await db.getAllNeeds();
    const need = allNeeds.find(n => n.id === needId);
    if (!need) return res.status(404).json({ error: 'Need not found' });

    let photoUrl: string | undefined;
    if (req.file) {
      photoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const proofOfWork = {
      photoUrl,
      notes: notes || 'Mission accomplished. Relief supplies delivered and site stabilized.',
      resolvedAt: Date.now(),
      volunteerName: volunteerName || 'Emergency Response Unit',
      casualtiesAssisted: casualtiesAssisted ? parseInt(casualtiesAssisted) : need.estimatedScale
    };

    const timeline = [
      ...(need.timeline || []),
      {
        timestamp: Date.now(),
        action: `Mission RESOLVED with Proof of Work by ${volunteerName || 'Field Unit'}. Casualties Assisted: ${proofOfWork.casualtiesAssisted}.`,
        actorRole: 'VOLUNTEER' as const
      }
    ];

    await db.resolveNeed(needId);
    await db.updateNeed(needId, { proofOfWork, responseStatus: 'RESOLVED', timeline });

    console.log(`✅ Incident Closed with Proof: ${need.ticketCode || need.id} at ${need.location.name}`);

    res.json({ success: true, status: 'RESOLVED', proofOfWork });
  } catch (error) {
    console.error('Resolve error:', error);
    res.status(500).json({ error: 'Failed to resolve incident' });
  }
});

const cachedPredictions: any[] = [];

console.log('⚡ Predictive Intelligence service initialized.');

app.get('/api/predictions', (req, res) => {
  res.json({
    predictions: cachedPredictions,
    lastUpdated: Date.now()
  });
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});