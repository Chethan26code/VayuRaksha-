/**
 * Offline Persistent Database Layer for VayuRaksha
 * Zero external database setup needed; fully offline portable JSON store.
 * Seeds realistic military unit rosters, trainee profiles, and historical drills.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_SKILLS } from '../ai/skills.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'vayuraksha_store.json');

class DatabaseStore {
  constructor() {
    this.data = {
      roe: null,
      units: {},
      trainees: {},
      sessions: []
    };
    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        return;
      } catch (e) {
        console.warn('Corrupted database file; reinitializing defaults.');
      }
    }

    this.seedDefaults();
    this.save();
  }

  seedDefaults() {
    // Read default ROE
    const roePath = path.join(__dirname, '../../shared/roe/default.json');
    if (fs.existsSync(roePath)) {
      this.data.roe = JSON.parse(fs.readFileSync(roePath, 'utf-8'));
    }

    // Default military unit
    const unitId = 'unit_15_ad';
    this.data.units[unitId] = {
      id: unitId,
      name: '15 Air Defence Regiment (Airspace Denial Taskforce)',
      location: 'Northern Sector HQ',
      assignedSeed: 4721,
      assignedMissionId: 'urban_night_mixed',
      traineeIds: ['tr_01', 'tr_02', 'tr_03', 'tr_04', 'tr_05']
    };

    // 5 Seeded Trainees
    const seededTrainees = [
      { id: 'tr_01', name: 'Capt. Vikram Rathore', rank: 'Captain', unitId, sessionsCount: 14, avgScore: 88, skills: { ...DEFAULT_SKILLS, night_detection: 1220, decoy_rejection: 1180, roe_compliance: 1250 } },
      { id: 'tr_02', name: 'Lt. Ananya Sharma', rank: 'Lieutenant', unitId, sessionsCount: 11, avgScore: 82, skills: { ...DEFAULT_SKILLS, threat_classification: 1190, swarm_prioritisation: 1110, decoy_rejection: 940 } },
      { id: 'tr_03', name: 'Subedar Major R. Singh', rank: 'Subedar Major', unitId, sessionsCount: 18, avgScore: 91, skills: { ...DEFAULT_SKILLS, night_detection: 1290, degraded_sensors: 1240, roe_compliance: 1310 } },
      { id: 'tr_04', name: 'Havildar K. Rao', rank: 'Havildar', unitId, sessionsCount: 8, avgScore: 71, skills: { ...DEFAULT_SKILLS, decoy_rejection: 820, degraded_sensors: 890, night_detection: 910 } },
      { id: 'tr_05', name: 'Naik M. Sharma', rank: 'Naik', unitId, sessionsCount: 6, avgScore: 68, skills: { ...DEFAULT_SKILLS, swarm_prioritisation: 790, threat_classification: 880 } }
    ];

    for (const t of seededTrainees) {
      this.data.trainees[t.id] = {
        ...t,
        banditArms: {
          tpl_night_decoy_heavy: { a: 2, b: 2 },
          tpl_degraded_sensor_swarm: { a: 2, b: 2 },
          tpl_fast_low_strike: { a: 2, b: 2 },
          tpl_multi_vector_saturation: { a: 2, b: 2 }
        }
      };
    }
  }

  save() {
    fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  getROE() {
    return this.data.roe;
  }

  setROE(newROE) {
    this.data.roe = newROE;
    this.save();
    return this.data.roe;
  }

  getTrainee(id) {
    return this.data.trainees[id] || null;
  }

  getAllTrainees() {
    return Object.values(this.data.trainees);
  }

  getUnit(unitId) {
    return this.data.units[unitId] || null;
  }

  assignUnitDrill(unitId, missionId, seed) {
    const u = this.data.units[unitId];
    if (u) {
      u.assignedMissionId = missionId;
      u.assignedSeed = Number(seed);
      this.save();
    }
    return u;
  }

  saveSessionRecord(session) {
    this.data.sessions.push(session);

    // Update trainee average and count
    const t = this.data.trainees[session.traineeId];
    if (t) {
      t.sessionsCount = (t.sessionsCount || 0) + 1;
      const prevTotal = (t.avgScore || 75) * (t.sessionsCount - 1);
      t.avgScore = Math.round((prevTotal + session.score) / t.sessionsCount);
    }

    this.save();
    return session;
  }

  getTraineeSessions(traineeId) {
    return this.data.sessions.filter(s => s.traineeId === traineeId);
  }
}

export const db = new DatabaseStore();
