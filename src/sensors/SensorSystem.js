/**
 * Multi-Modal Sensor Simulation & Track Fusion Engine
 * Simulates Radar, RF Scanner, EO/IR Optical/Thermal, and Acoustic sensors.
 * Implements real-time sensor degradation and multi-sensor track fusion.
 */

export class SensorSystem {
  constructor(degradationConfig = {}) {
    this.degradation = {
      radar: degradationConfig.radar ?? 0.0,
      rf: degradationConfig.rf ?? 0.0,
      eo: degradationConfig.eo ?? 0.0,
      acoustic: degradationConfig.acoustic ?? 0.0
    };

    // Tracks maintained by fusion algorithm (Map: trackId -> Track)
    this.tracks = new Map();
    this.nextTrackNum = 1;
    this.sweepAngle = 0; // Radar sweep azimuth in radians
    this.sweepSpeed = 2.5; // rad/sec (~24 RPM)

    // Clutter false alarm blips
    this.clutterBlips = [];
  }

  setDegradation(type, val) {
    if (this.degradation[type] !== undefined) {
      this.degradation[type] = Math.max(0, Math.min(1.0, val));
    }
  }

  update(dt, simTime, activeThreats, env) {
    this.sweepAngle = (this.sweepAngle + this.sweepSpeed * dt) % (Math.PI * 2);

    // 1. Generate false alarm clutter if radar degraded
    if (this.degradation.radar > 0.2 && Math.random() < this.degradation.radar * 0.1) {
      const angle = Math.random() * Math.PI * 2;
      const r = 400 + Math.random() * 2000;
      this.clutterBlips.push({
        x: Math.sin(angle) * r,
        z: Math.cos(angle) * r,
        lifetime: 1.8
      });
    }

    // Decay clutter blips
    for (let i = this.clutterBlips.length - 1; i >= 0; i--) {
      this.clutterBlips[i].lifetime -= dt;
      if (this.clutterBlips[i].lifetime <= 0) {
        this.clutterBlips.splice(i, 1);
      }
    }

    // 2. Poll each sensor for each active threat
    const currentHits = [];

    for (const threat of activeThreats) {
      if (threat.state === 'UNSPAWNED' || threat.isNeutralized) continue;

      const dist = Math.sqrt(threat.position.x ** 2 + threat.position.z ** 2);
      const bearing = (Math.atan2(threat.position.x, threat.position.z) * 180 / Math.PI + 360) % 360;

      // Radar evaluation
      const radarHit = this.evaluateRadar(threat, dist);
      // RF scanner evaluation
      const rfHit = this.evaluateRF(threat, dist, bearing);
      // Optical / Thermal EO/IR evaluation
      const eoHit = this.evaluateEO(threat, dist, env);
      // Acoustic evaluation
      const acousticHit = this.evaluateAcoustic(threat, dist);

      if (radarHit || rfHit || eoHit || acousticHit) {
        currentHits.push({
          threatId: threat.id,
          actualThreat: threat,
          dist,
          bearing,
          position: threat.position,
          radarHit,
          rfHit,
          eoHit,
          acousticHit
        });
      }
    }

    // 3. Multi-Sensor Track Fusion
    this.fuseSensorData(currentHits, simTime);
  }

  evaluateRadar(threat, dist) {
    if (dist > 3600) return null;
    const baseProb = Math.min(0.98, (threat.spec.rcs / 0.1) * (1 - dist / 4000));
    const effectiveProb = baseProb * (1 - this.degradation.radar * 0.65);
    if (Math.random() > effectiveProb) return null;

    // Add noise based on degradation
    const noise = (Math.random() - 0.5) * 40 * (1 + this.degradation.radar * 3);
    return {
      confidence: Math.round(effectiveProb * 100),
      detectedDist: Math.max(0, dist + noise),
      rcsDetected: threat.spec.rcs
    };
  }

  evaluateRF(threat, dist, bearing) {
    if (!threat.spec.rfSignature) return null; // Biological bird or silent drone
    if (dist > 5000) return null;

    const baseProb = 0.92 * (1 - this.degradation.rf * 0.7);
    if (Math.random() > baseProb) return null;

    const bearingJitter = (Math.random() - 0.5) * 6 * (1 + this.degradation.rf * 4);
    return {
      protocol: threat.spec.rfSignature.protocol,
      frequencies: threat.spec.rfSignature.freqGHz,
      bearingEstimated: (bearing + bearingJitter + 360) % 360,
      rssi: Math.round(-30 - (dist / 80)),
      confidence: Math.round(baseProb * 100)
    };
  }

  evaluateEO(threat, dist, env) {
    if (dist > 2800) return null;
    const isNight = env.timeOfDay >= 19 || env.timeOfDay <= 5;
    let visibility = 1.0;
    if (isNight) visibility *= 0.35;
    if (env.weather === 'fog') visibility *= 0.3;
    if (env.weather === 'dust') visibility *= 0.45;

    const effectiveVis = visibility * (1 - this.degradation.eo * 0.8);
    if (Math.random() > effectiveVis) return null;

    return {
      confidence: Math.round(effectiveVis * 100),
      visualQuality: effectiveVis > 0.6 ? 'HIGH (Clear Silhouette)' : (effectiveVis > 0.3 ? 'MEDIUM (Thermal Contrast)' : 'LOW (Grainy Thermal Blob)')
    };
  }

  evaluateAcoustic(threat, dist) {
    if (dist > 900) return null;
    const baseProb = 0.75 * (1 - this.degradation.acoustic * 0.65);
    if (Math.random() > baseProb) return null;

    return {
      decibels: Math.round(threat.spec.acousticDecibels - (dist / 25)),
      confidence: Math.round(baseProb * 100)
    };
  }

  fuseSensorData(hits, simTime) {
    const matchedTrackIds = new Set();

    for (const hit of hits) {
      // Find existing track for this threat
      let foundTrack = null;
      for (const [tId, track] of this.tracks.entries()) {
        if (track.threatId === hit.threatId) {
          foundTrack = track;
          break;
        }
      }

      if (!foundTrack) {
        // Create new fused track
        const trackId = `TRK-${String(this.nextTrackNum++).padStart(2, '0')}`;
        foundTrack = {
          trackId,
          threatId: hit.threatId,
          firstDetectedT: simTime,
          lastSeenT: simTime,
          userStatus: 'UNACKNOWLEDGED', // UNACKNOWLEDGED, CONFIRMED, CLASSIFIED, ENGAGED
          userClassification: null,
          userEngagement: null,
          history: []
        };
        this.tracks.set(trackId, foundTrack);
      }

      foundTrack.lastSeenT = simTime;
      foundTrack.bearing = Math.round(hit.bearing);
      foundTrack.range = Math.round(hit.dist);
      foundTrack.altitude = Math.round(hit.position.y);
      foundTrack.threatType = hit.actualThreat.type;
      foundTrack.position = hit.position;
      foundTrack.isNeutralized = hit.actualThreat.isNeutralized;

      // Calculate fused confidence score
      let confSum = 0;
      let confCount = 0;
      if (hit.radarHit) { confSum += hit.radarHit.confidence * 1.2; confCount += 1.2; }
      if (hit.rfHit) { confSum += hit.rfHit.confidence * 1.0; confCount += 1.0; }
      if (hit.eoHit) { confSum += hit.eoHit.confidence * 0.9; confCount += 0.9; }
      if (hit.acousticHit) { confSum += hit.acousticHit.confidence * 0.7; confCount += 0.7; }

      foundTrack.confidence = confCount > 0 ? Math.min(99, Math.round(confSum / confCount)) : 30;
      foundTrack.activeSensors = {
        radar: !!hit.radarHit,
        rf: !!hit.rfHit,
        eo: !!hit.eoHit,
        acoustic: !!hit.acousticHit
      };
      foundTrack.sensorDetails = {
        rf: hit.rfHit,
        eo: hit.eoHit,
        radar: hit.radarHit
      };

      matchedTrackIds.add(foundTrack.trackId);
    }

    // Clean up lost tracks (unseen for > 5 seconds)
    for (const [tId, track] of this.tracks.entries()) {
      if (simTime - track.lastSeenT > 5.0 && !track.isNeutralized) {
        track.isLost = true;
      }
    }
  }

  getActiveTracks() {
    return Array.from(this.tracks.values());
  }

  clear() {
    this.tracks.clear();
    this.clutterBlips = [];
    this.nextTrackNum = 1;
  }
}
