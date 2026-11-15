import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import { AIService } from './aiService';
import { processDeduplication, haversineDistance } from './deduplication';
import { db } from './firebaseDb';
import { NeedEntity, VolunteerProfile, EnRouteResponder } from '../shared/types';

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
    'india': { lat: 20.5937, lng: 78.9629 },
  };

  let locationName = 'Reported Area';
  let coords = { lat: 20.5937, lng: 78.9629 };
  for (const [key, val] of Object.entries(locationMap)) {
    if (t.includes(key)) {
      locationName = key.replace(/\b\w/g, c => c.toUpperCase());
      coords = val;
      break;
    }
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
    const allNeeds = await db.getAllNeeds();
    const need = allNeeds.find(n => n.id === id);
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
    const { name, ngo, phone, email, preferredLanguage, skills, locationCoords, locationName } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Volunteer name is required' });
    }

    if (!locationCoords || typeof locationCoords.lat !== 'number' || typeof locationCoords.lng !== 'number') {
      return res.status(400).json({ error: 'Valid location coordinates (lat, lng) are required' });
    }

    const newVolunteer: VolunteerProfile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      ngo: ngo && ngo.trim() ? ngo.trim() : 'Independent Civic Responder',
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
    console.log(`🙋 New Volunteer Registered: ${newVolunteer.name} [${newVolunteer.ngo}] at ${newVolunteer.locationName} (${newVolunteer.locationCoords.lat}, ${newVolunteer.locationCoords.lng})`);
    
    res.status(201).json({ success: true, volunteer: newVolunteer });
  } catch (error) {
    console.error('Failed to register volunteer:', error);
    res.status(500).json({ error: 'Failed to register volunteer' });
  }
});

app.patch('/volunteers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ngo, locationCoords, locationName, status, skills, preferredLanguage, phone, email } = req.body;
    
    const updates: Partial<VolunteerProfile> = {};
    if (ngo !== undefined) updates.ngo = ngo.trim();
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

    const locationStr = `${extractedData.crisisType} ${extractedData.location?.name || 'Unknown'} ${extractedData.urgencyReasoning}`;

    let embedding: number[];
    try {
      embedding = await AIService.getEmbedding(locationStr);
    } catch (e: any) {
      console.warn('⚠️ Embedding quota hit — using zero vector for dedup.');
      embedding = new Array(768).fill(0).map(() => Math.random() * 0.01);
    }

    const newNeed: NeedEntity = {
      id: crypto.randomUUID(),
      location: {
        name: extractedData.location?.name || 'Unknown Location',
        lat: extractedData.location?.lat || 19.0760,
        lng: extractedData.location?.lng || 72.8777
      },
      crisisType: (extractedData.crisisType || 'medical') as any,
      urgencyReasoning: extractedData.urgencyReasoning || 'Immediate assistance required.',
      estimatedScale: extractedData.estimatedScale || 1,
      reportCount: 1,
      criticalityScore: 0,
      status: 'OPEN',
      reportedAt: Date.now(),
      rawInputs: [rawText],
      embedding,
      originalLanguage: extractedData.originalLanguage,
      isLocal: (extractedData as any).isLocal || false
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
        return res.status(404).json({ error: 'No volunteers available for dispatch.' });
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

    // Attach volunteer to need as EN_ROUTE
    const responder: EnRouteResponder = {
      id: topVolunteer.id,
      name: topVolunteer.name,
      ngo: topVolunteer.ngo,
      phone: topVolunteer.phone,
      dispatchedAt: Date.now()
    };

    const currentList = Array.isArray(need.enRouteVolunteers) ? need.enRouteVolunteers : [];
    const alreadyIn = currentList.some(r => r.id === responder.id);
    const updatedList = alreadyIn ? currentList : [...currentList, responder];

    const updates: Partial<NeedEntity> = {
      status: 'EN_ROUTE',
      enRouteVolunteers: updatedList,
      dispatchMessage
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

const cachedPredictions = [
  {
    city: 'Mumbai',
    predictedCrisisType: 'flood',
    riskLevel: 'HIGH',
    confidenceScore: 88,
    reasoning: 'Early monsoon surge detected in satellite imagery.',
    recommendedPreventiveAction: 'Stage rescue boats in low-lying Kurla.'
  },
  {
    city: 'Delhi',
    predictedCrisisType: 'fire',
    riskLevel: 'CRITICAL',
    confidenceScore: 92,
    reasoning: 'Heatwave escalation paired with power grid load.',
    recommendedPreventiveAction: 'Mobilize fire tankers to industrial clusters.'
  },
  {
    city: 'Bengaluru',
    predictedCrisisType: 'medical',
    riskLevel: 'MEDIUM',
    confidenceScore: 64,
    reasoning: 'Localized water reports indicate gastroenteritis spike.',
    recommendedPreventiveAction: 'Distribute hygiene kits to local clinics.'
  }
];

console.log('⚡ Predictive Intelligence loaded (static mode — saving API quota).');

app.get('/api/predictions', (req, res) => {
  res.json({
    predictions: cachedPredictions,
    lastUpdated: Date.now()
  });
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});