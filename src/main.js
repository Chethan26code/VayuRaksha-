/**
 * VayuRaksha — Main Application Orchestrator
 * Coordinates Three.js 3D scene, deterministic 60Hz physics, multi-sensor fusion,
 * OODA trainee interactions, and after-action debriefing.
 */

import { SceneManager } from './sim/SceneManager.js';
import { DroneRenderer } from './sim/DroneRenderer.js';
import { ThreatInstance } from './threats/DroneAI.js';
import { SensorSystem } from './sensors/SensorSystem.js';
import { SimulationLoop } from './sim/loop.js';
import { HUD } from './ui/HUD.js';
import { AARDashboard } from './aar/Dashboard.js';
import { InstructorPortal } from './ui/InstructorPortal.js';
import { SeededRandom } from '../shared/rng.js';
import { generateProceduralScenario } from './threats/generator.js';

class VayuRakshaApp {
  constructor() {
    this.viewportContainer = document.getElementById('viewport-container');
    this.hudRoot = document.getElementById('hud-root');
    this.modalRoot = document.getElementById('modal-root');

    // Modules
    this.sceneManager = new SceneManager(this.viewportContainer);
    this.droneRenderer = new DroneRenderer(this.sceneManager.threatsGroup, this.sceneManager.fxGroup);
    this.sensorSystem = new SensorSystem();
    this.hud = null;
    this.aar = null;
    this.instructorPortal = null;
    this.loop = null;

    // State
    this.currentScenario = null;
    this.activeThreats = [];
    this.eventLog = [];
    this.selectedTraineeId = 'tr_01'; // Default: Capt. Vikram Rathore
    this.activeTrackId = null;
    this.isSessionActive = false;

    this.init();
  }

  async init() {
    // 1. Initialize HUD
    this.hud = new HUD(this.hudRoot, {
      onDetect: (trackId) => this.handleDetect(trackId),
      onClassify: (trackId, type) => this.handleClassify(trackId, type),
      onEngage: (trackId, method) => this.handleEngage(trackId, method),
      onCameraChange: (mode) => this.handleCameraChange(mode),
      onEndSession: () => this.endSession()
    });

    // 2. Initialize AAR Dashboard & Instructor Portal
    this.aar = new AARDashboard(
      this.modalRoot,
      (scenarioId, seed) => this.restartMission(scenarioId, seed),
      () => this.openMissionSelect()
    );

    this.instructorPortal = new InstructorPortal(this.modalRoot, () => {
      // Returned from instructor view
    });

    // 3. Initialize Fixed 60Hz Simulation Loop
    this.loop = new SimulationLoop(
      (dt, simTime) => this.update(dt, simTime),
      (alpha, simTime) => this.render(alpha, simTime)
    );

    // 4. Bind Global Navigation Buttons
    const navBar = document.getElementById('global-nav');
    if (navBar) {
      document.getElementById('nav-mission-select').onclick = () => this.openMissionSelect();
      document.getElementById('nav-adversary-drill').onclick = () => this.startAdversaryDrill();
      document.getElementById('nav-instructor-portal').onclick = () => this.instructorPortal.loadAndRender();
    }

    // 5. Load Initial Scripted Mission: Urban Night Mixed (#4721)
    await this.loadScenarioById('urban_night_mixed');
    this.startSession();
  }

  async loadScenarioById(scenarioId) {
    try {
      const res = await fetch(`/api/scenarios/${scenarioId}`);
      if (!res.ok) throw new Error('Failed to fetch scenario');
      const scenario = await res.json();
      this.setupScenario(scenario);
    } catch (e) {
      console.warn('Using local fallback scenario', e);
      // Fallback if offline standalone
      const fallback = {
        id: 'urban_night_mixed',
        name: 'Phase 2: Urban Night Multi-Vector Threat',
        seed: 4721,
        difficulty: 6,
        env: { terrain: 'urban', timeOfDay: 22, weather: 'fog' },
        sensors: { radar: 0.35, rf: 0.1, eo: 0.65, acoustic: 0.25 },
        threats: [
          { id: 'decoy-bird-01', type: 'bird', bearing: 75, distance: 1400, altitude: 80, spawnT: 3.0, speed: 12 },
          { id: 'th-recon-02', type: 'recon_quad', bearing: 315, distance: 2200, altitude: 160, spawnT: 7.0, speed: 16 },
          { id: 'th-strike-01', type: 'strike_quad', bearing: 160, distance: 2000, altitude: 90, spawnT: 14.0, speed: 34 }
        ]
      };
      this.setupScenario(fallback);
    }
  }

  setupScenario(scenario) {
    this.currentScenario = scenario;
    const rng = new SeededRandom(scenario.seed);

    // Reset 3D Environment
    this.sceneManager.buildEnvironment(
      scenario.env.terrain,
      scenario.env.timeOfDay,
      scenario.env.weather
    );

    // Clear previous entities
    this.droneRenderer.clear();
    this.sensorSystem.clear();
    this.eventLog = [];

    // Set Sensor Degradation
    for (const [k, v] of Object.entries(scenario.sensors || {})) {
      this.sensorSystem.setDegradation(k, v);
    }

    // Instantiate Threat AI objects
    this.activeThreats = scenario.threats.map(tDef => new ThreatInstance(tDef, rng));

    // Log scenario start event
    this.eventLog.push({
      t: 0,
      type: 'session_start',
      scenarioId: scenario.id,
      seed: scenario.seed
    });
  }

  startSession() {
    this.loop.reset();
    this.isSessionActive = true;
    this.loop.start();
  }

  update(dt, simTime) {
    if (!this.isSessionActive) return;

    // 1. Update Threat AI & Swarm Flocking
    for (const threat of this.activeThreats) {
      threat.update(dt, simTime, this.activeThreats);

      // Check breach event
      if (threat.state === 'BREACHED' && !threat.breachLogged) {
        threat.breachLogged = true;
        this.eventLog.push({
          t: Number(simTime.toFixed(2)),
          type: 'breach',
          threatId: threat.id
        });
        this.hud.showAlert(`⚠️ CRITICAL BREACH: ${threat.spec.name} PENETRATED PERIMETER!`, 'danger');
      }
    }

    // 2. Update Multi-Modal Sensor Fusion
    this.sensorSystem.update(dt, simTime, this.activeThreats, this.currentScenario.env);

    // 3. Update 3D Scene dynamics
    this.sceneManager.update(dt, simTime);

    // 4. Update 3D Threat Mesh representations
    const tracks = this.sensorSystem.getActiveTracks();
    for (const threat of this.activeThreats) {
      if (threat.state === 'UNSPAWNED') continue;

      if (threat.isNeutralized) {
        this.droneRenderer.removeThreatMesh(threat.id, true);
      } else {
        const isSelected = tracks.some(t => t.threatId === threat.id && t.trackId === this.hud.selectedTrackId);
        this.droneRenderer.updateThreatPosition(threat, isSelected);
      }
    }

    this.droneRenderer.update(dt, simTime);

    // 5. Update HUD Displays
    this.hud.update(
      simTime,
      tracks,
      this.currentScenario,
      this.sensorSystem.clutterBlips,
      this.sensorSystem.sweepAngle
    );

    // 6. Check mission conclusion condition
    const allConcluded = this.activeThreats.every(t => t.isNeutralized || t.state === 'BREACHED');
    if (allConcluded && this.activeThreats.length > 0 && simTime > 10.0) {
      this.endSession();
    }
  }

  render(alpha, simTime) {
    this.sceneManager.render();
  }

  // --- OODA Loop Trainee Action Handlers ---

  handleDetect(trackId) {
    const track = this.sensorSystem.tracks.get(trackId);
    if (!track) return;

    track.userStatus = 'CONFIRMED';
    this.eventLog.push({
      t: Number(this.loop.simTime.toFixed(2)),
      type: 'detect',
      trackId,
      threatId: track.threatId
    });
  }

  handleClassify(trackId, selectedType) {
    const track = this.sensorSystem.tracks.get(trackId);
    if (!track) return;

    track.userStatus = 'CLASSIFIED';
    track.userClassification = selectedType;

    this.eventLog.push({
      t: Number(this.loop.simTime.toFixed(2)),
      type: 'classify',
      trackId,
      threatId: track.threatId,
      data: { classification: selectedType }
    });
  }

  handleEngage(trackId, method) {
    const track = this.sensorSystem.tracks.get(trackId);
    if (!track) return;

    track.userStatus = 'ENGAGED';
    track.userEngagement = method;

    const threat = this.activeThreats.find(t => t.id === track.threatId);
    if (threat) {
      const outcome = threat.applyCountermeasure(method);
      this.hud.showAlert(`ENGAGEMENT: ${outcome.text}`, outcome.success ? 'success' : 'danger');
    }

    this.eventLog.push({
      t: Number(this.loop.simTime.toFixed(2)),
      type: 'engage',
      trackId,
      threatId: track.threatId,
      data: { method }
    });
  }

  handleCameraChange(mode) {
    let targetMesh = null;
    if (this.hud.selectedTrackId) {
      const track = this.sensorSystem.tracks.get(this.hud.selectedTrackId);
      if (track) {
        const item = this.droneRenderer.meshes.get(track.threatId);
        if (item) targetMesh = item.group;
      }
    }
    this.sceneManager.setCameraMode(mode, targetMesh);
  }

  async endSession() {
    if (!this.isSessionActive) return;
    this.isSessionActive = false;
    this.loop.stop();

    this.eventLog.push({
      t: Number(this.loop.simTime.toFixed(2)),
      type: 'session_end'
    });

    try {
      // Submit session log to backend for explainable scoring & Elo update
      const res = await fetch('/api/sessions/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: this.currentScenario,
          events: this.eventLog,
          traineeId: this.selectedTraineeId
        })
      });

      const data = await res.json();
      this.aar.render(data.scoreResult, this.currentScenario, data.traineeStats, data.adversaryRecommendation);
    } catch (e) {
      console.warn('Backend unavailable, running client-side fallback scorer', e);
      import('../shared/scoring/score.js').then(({ calculateSessionScore }) => {
        import('../shared/roe/default.json').then((roeMod) => {
          const scoreResult = calculateSessionScore(this.currentScenario, this.eventLog, roeMod.default || roeMod);
          this.aar.render(scoreResult, this.currentScenario, null, null);
        });
      });
    }
  }

  restartMission(scenarioId, seed) {
    if (scenarioId === 'procedural_next') {
      this.startAdversaryDrill();
      return;
    }
    const newSeed = seed || (this.currentScenario.seed + 1);
    this.currentScenario.seed = newSeed;
    this.setupScenario(this.currentScenario);
    this.startSession();
  }

  async startAdversaryDrill() {
    try {
      const res = await fetch(`/api/adversary/next/${this.selectedTraineeId}`);
      const drill = await res.json();
      this.setupScenario(drill.scenario);
      this.startSession();
      this.hud.showAlert(`⚡ ENGAGING ADVERSARY DRILL: ${drill.templateName} (Seed #${drill.seed})`, 'warning');
    } catch (e) {
      // Fallback client procedural drill
      const proc = generateProceduralScenario('tpl_night_decoy_heavy', 6, Date.now() % 100000);
      this.setupScenario(proc);
      this.startSession();
    }
  }

  openMissionSelect() {
    const list = [
      { id: 'tutorial_basic', name: 'Phase 1: Basic Airspace Intrusion (Daylight)' },
      { id: 'urban_night_mixed', name: 'Phase 2: Urban Night Complex Multi-Vector Threat' },
      { id: 'rural_swarm', name: 'Phase 3: Border Outpost Coordinated Swarm Assault' }
    ];

    this.modalRoot.innerHTML = `
      <div class="aar-modal-backdrop">
        <div class="mission-select-window">
          <h2>TACTICAL MISSION DEPLOYMENT SELECTION</h2>
          <p>Choose an operational Counter-UAS training scenario:</p>
          <div class="mission-grid">
            ${list.map(m => `
              <div class="mission-card" data-id="${m.id}">
                <h3>${m.name}</h3>
                <button class="hud-btn btn-primary" style="margin-top: 10px;">Deploy Mission</button>
              </div>
            `).join('')}
          </div>
          <button id="btn-close-select" class="hud-btn" style="margin-top: 20px;">Cancel</button>
        </div>
      </div>
    `;

    this.modalRoot.querySelectorAll('.mission-card').forEach(c => {
      c.onclick = async () => {
        const id = c.getAttribute('data-id');
        this.modalRoot.innerHTML = '';
        await this.loadScenarioById(id);
        this.startSession();
      };
    });

    document.getElementById('btn-close-select').onclick = () => {
      this.modalRoot.innerHTML = '';
    };
  }
}

// Bootstrap on page load
window.addEventListener('DOMContentLoaded', () => {
  new VayuRakshaApp();
});
