/**
 * VayuRaksha Local Offline Server (Express REST API)
 * Operates 100% locally with zero external internet dependencies.
 * Handles scoring verification, Elo learner updating, AI adversary generation,
 * and instructor unit command.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { db } from './db/database.js';
import { calculateSessionScore } from '../shared/scoring/score.js';
import { updateSkill } from './ai/skills.js';
import { pickNextAdversaryDrill } from './ai/adversary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve compiled production bundle if available (dist), otherwise fallback to root
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}
app.use(express.static(path.join(__dirname, '../')));

app.get('/', (req, res) => {
  const distIndex = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(distIndex)) {
    return res.sendFile(distIndex);
  }
  res.sendFile(path.join(__dirname, '../index.html'));
});

// 1. Scenarios API
app.get('/api/scenarios', (req, res) => {
  const scenariosDir = path.join(__dirname, '../scenarios');
  const files = fs.readdirSync(scenariosDir).filter(f => f.endsWith('.json'));
  const list = files.map(file => {
    const raw = fs.readFileSync(path.join(scenariosDir, file), 'utf-8');
    return JSON.parse(raw);
  });
  res.json({ scenarios: list });
});

app.get('/api/scenarios/:id', (req, res) => {
  const scenariosDir = path.join(__dirname, '../scenarios');
  const filePath = path.join(scenariosDir, `${req.params.id}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Scenario not found' });
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  res.json(JSON.parse(raw));
});

// 2. Rules of Engagement (ROE) API (Instructor Configurable)
app.get('/api/roe', (req, res) => {
  res.json(db.getROE());
});

app.post('/api/roe', (req, res) => {
  const updated = db.setROE(req.body);
  res.json({ success: true, roe: updated });
});

// 3. Trainees & Instructor API
app.get('/api/trainees', (req, res) => {
  res.json({ trainees: db.getAllTrainees() });
});

app.get('/api/trainees/:id', (req, res) => {
  const trainee = db.getTrainee(req.params.id);
  if (!trainee) return res.status(404).json({ error: 'Trainee not found' });
  const history = db.getTraineeSessions(req.params.id);
  res.json({ trainee, history });
});

// 4. Unit Management & Shared Seed Assignment
app.get('/api/units/:id', (req, res) => {
  const unit = db.getUnit(req.params.id);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });
  const trainees = unit.traineeIds.map(id => db.getTrainee(id)).filter(Boolean);
  res.json({ unit, trainees });
});

app.post('/api/units/:id/assign', (req, res) => {
  const { missionId, seed } = req.body;
  const unit = db.assignUnitDrill(req.params.id, missionId, seed);
  res.json({ success: true, unit });
});

// 5. Session Scoring & AI Adversary Feedback Pipeline
app.post('/api/sessions/score', (req, res) => {
  const { scenario, events, traineeId = 'tr_01' } = req.body;
  const roe = db.getROE();

  // Pure function doctrinal calculation
  const scoreResult = calculateSessionScore(scenario, events, roe);

  // Update Trainee Elo Competency Model
  const trainee = db.getTrainee(traineeId) || { id: traineeId, skills: {} };
  const targetD = 700 + (scenario.difficulty || 5) * 60;

  for (const [skillKey, delta] of Object.entries(scoreResult.skillDeltas)) {
    if (delta.max > 0) {
      const success = (delta.points / delta.max) >= 0.7;
      const currentRating = trainee.skills[skillKey] ?? 1000;
      trainee.skills[skillKey] = updateSkill(currentRating, targetD, success);
    }
  }

  // Update Bandit Arm for scenario template if procedural
  if (scenario.templateId && trainee.banditArms?.[scenario.templateId]) {
    const passed = scoreResult.score >= 70;
    if (passed) {
      trainee.banditArms[scenario.templateId].a += 1;
    } else {
      trainee.banditArms[scenario.templateId].b += 1;
    }
  }

  // Generate next adaptive adversary drill
  const nextAdversaryDrill = pickNextAdversaryDrill(trainee);

  // Save session record
  const sessionRecord = {
    id: `sess_${Date.now()}`,
    traineeId,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    seed: scenario.seed,
    score: scoreResult.score,
    grade: scoreResult.grade,
    timestamp: new Date().toISOString(),
    eventCount: events.length
  };
  db.saveSessionRecord(sessionRecord);

  res.json({
    scoreResult,
    traineeStats: trainee,
    adversaryRecommendation: nextAdversaryDrill
  });
});

// 6. Direct Adversary Generator Endpoint
app.get('/api/adversary/next/:traineeId', (req, res) => {
  const trainee = db.getTrainee(req.params.traineeId) || { id: req.params.traineeId, skills: {} };
  const drill = pickNextAdversaryDrill(trainee);
  res.json(drill);
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🛡️  VAYURAKSHA C-UAS SIMULATOR & TRAINER`);
  console.log(`🏛️  Ministry of Defence (MoD) — Defence Services Staff College`);
  console.log(`🚀  Local Server running at: http://localhost:${PORT}`);
  console.log(`📶  Network Mode: OFFLINE OPERATIONAL`);
  console.log(`=======================================================`);
});
