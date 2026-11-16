import { NeedEntity } from '../shared/types';
import { db } from './firebaseDb';

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const SEVERITY_WEIGHTS: Record<string, number> = {
  medical: 100,
  fire: 95,
  water: 90,
  food: 80,
  shelter: 70,
  infrastructure: 50,
  other: 50
};

function distToString(distKm: number): string {
  if (!isFinite(distKm)) return '';
  return distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(2)}km`;
}

export async function processDeduplication(newNeed: NeedEntity): Promise<NeedEntity> {
  const recentNeeds = await db.getRecentUnresolvedNeeds();
  
  let bestMatch: NeedEntity | null = null;
  let highestSim = 0;
  let shortestDist = Infinity;

  for (const existing of recentNeeds) {
    // 1. Strict Hazard Category Isolation: Different disaster types (e.g. Fire vs Flood) must NEVER merge!
    if (existing.crisisType !== newNeed.crisisType) {
      continue;
    }

    const dist = haversineDistance(
      newNeed.location.lat, newNeed.location.lng,
      existing.location.lat, existing.location.lng
    );

    // Precise urban clustering radius: 200m (0.2km)
    if (dist <= 0.2) {
      let isMatch = true;

      // If embeddings exist, verify semantic consistency
      if (
        existing.embedding &&
        newNeed.embedding &&
        existing.embedding.length > 0 &&
        newNeed.embedding.length > 0
      ) {
        const sim = cosineSimilarity(newNeed.embedding, existing.embedding);
        if (sim < 0.65) {
          isMatch = false;
        }
      }

      if (isMatch && dist < shortestDist) {
        shortestDist = dist;
        bestMatch = existing;
      }
    }
  }

  // Helper to compute exact Priority Score 0-100
  const computeScore = (reportCount: number, firstReportedAt: number, crisisType: string, estimatedScale: number) => {
    // 1. report_velocity: log-dampened to prevent artificial spam inflation, capped at 80
    const hours = Math.max((Date.now() - firstReportedAt) / (1000 * 60 * 60), 0.1);
    const velocityRaw = reportCount / hours;
    const report_velocity = Math.min(80, Math.round(Math.log2(velocityRaw + 1) * 20));
    
    // 2. severity_weight: 0-100 from dictionary (Medical=100, Fire=95, Water=90, etc.)
    const severity_weight = SEVERITY_WEIGHTS[crisisType.toLowerCase()] || 50;
    
    // 3. vulnerability_index: 0-100 based on scale
    const vulnerability_index = Math.min(100, estimatedScale * 5); 

    // 4. Multi-reporter confirmation bonus: adds priority as independent citizens verify the disaster
    const volumeBonus = Math.min(15, (reportCount - 1) * 4);

    // Score = (report_velocity × 0.35) + (severity_weight × 0.35) + (vulnerability_index × 0.15) + volumeBonus
    const rawScore = (report_velocity * 0.35) + (severity_weight * 0.35) + (vulnerability_index * 0.15) + volumeBonus;
    return Math.min(100, Math.max(0, Math.round(rawScore)));
  };

  if (bestMatch) {
    const mergedReportCount = bestMatch.reportCount + 1;
    const newCriticalityScore = computeScore(
      mergedReportCount,
      bestMatch.reportedAt,
      bestMatch.crisisType,
      Math.max(bestMatch.estimatedScale, newNeed.estimatedScale)
    );
    const isCriticalVelocity = newCriticalityScore >= 80;

    const clusterAction = `Additional distress signal clustered (${distToString(shortestDist)} away). Total reports: ${mergedReportCount}. Urgency elevated to ${newCriticalityScore}/100.`;

    const updatedNeed: NeedEntity = {
      ...bestMatch,
      reportCount: mergedReportCount,
      criticalityScore: newCriticalityScore,
      estimatedScale: Math.max(bestMatch.estimatedScale, newNeed.estimatedScale),
      status: isCriticalVelocity && bestMatch.status === 'OPEN' ? 'CRITICAL_VELOCITY' : bestMatch.status,
      rawInputs: [...bestMatch.rawInputs, ...newNeed.rawInputs],
      timeline: [
        ...(bestMatch.timeline || []),
        {
          timestamp: Date.now(),
          action: clusterAction,
          actorRole: 'SYSTEM'
        }
      ]
    };

    await db.updateNeed(updatedNeed.id, updatedNeed);
    console.log(`📍 Clustered Incident: Merged report into ticket #${updatedNeed.id.slice(0, 8)}. Total reports: ${mergedReportCount}, Score: ${newCriticalityScore}`);
    return updatedNeed;
  } else {
    // Brand new cluster
    newNeed.criticalityScore = computeScore(1, Date.now(), newNeed.crisisType, newNeed.estimatedScale);
    await db.addNeed(newNeed);
    return newNeed;
  }
}
