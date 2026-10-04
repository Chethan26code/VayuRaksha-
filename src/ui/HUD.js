/**
 * Tactical Counter-UAS Heads-Up Display (HUD) Controller
 * Orchestrates operator inputs, keyboard rapid shortcuts, track management,
 * sensor readouts, and the full OODA decision-action cycle.
 */

import { RadarDisplay } from './RadarDisplay.js';
import { THREAT_TYPES, COUNTERMEASURES } from '../../shared/threatTypes.js';

export class HUD {
  constructor(domRoot, callbacks = {}) {
    this.root = domRoot;
    this.callbacks = callbacks; // onDetect, onClassify, onEngage, onCameraChange, onEndSession

    this.selectedTrackId = null;
    this.activeTracks = [];
    this.radarDisplay = null;

    this.initDOM();
    this.setupKeyboardShortcuts();
  }

  initDOM() {
    this.root.innerHTML = `
      <div class="hud-container">
        <!-- TOP STATUS STRIP -->
        <header class="hud-top-bar">
          <div class="brand">
            <span class="shield-icon">🛡️</span>
            <span class="brand-title">VAYURAKSHA</span>
            <span class="badge-mod">MoD DSSC C-UAS</span>
          </div>
          <div class="scenario-telemetry">
            <span class="label">MISSION:</span>
            <strong id="hud-mission-name">Loading...</strong>
            <span class="divider">|</span>
            <span class="label">SEED:</span>
            <strong id="hud-seed">#----</strong>
            <span class="divider">|</span>
            <span class="label">TIME:</span>
            <strong id="hud-timer" class="neon-text">00:00.0</strong>
          </div>
          <div class="hud-top-actions">
            <button id="btn-cam-op" class="hud-btn active">Operator Cam [C]</button>
            <button id="btn-cam-tactical" class="hud-btn">Tactical Overhead [V]</button>
            <button id="btn-finish-drill" class="hud-btn btn-danger">Conclude Drill [Esc]</button>
          </div>
        </header>

        <!-- MAIN WORKSPACE -->
        <div class="hud-main-workspace">
          <!-- LEFT PANEL: SENSOR FUSION & RADAR PPI -->
          <div class="hud-panel left-panel">
            <div class="panel-header">
              <span>RADAR PPI & SPECTRUM</span>
              <span class="live-indicator">● LIVE 60Hz</span>
            </div>
            <div class="radar-wrapper">
              <canvas id="radar-canvas"></canvas>
            </div>

            <!-- SENSOR INTEGRITY / DEGRADATION GAUGES -->
            <div class="sensor-gauges">
              <div class="gauge-title">SENSOR MODALITY STATUS</div>
              <div class="gauge-item">
                <span class="g-name">3D RADAR:</span>
                <div class="gauge-bar"><div id="gauge-radar" class="gauge-fill" style="width: 100%"></div></div>
                <span id="label-radar-deg" class="g-val">NOMINAL</span>
              </div>
              <div class="gauge-item">
                <span class="g-name">RF INTERCEPT:</span>
                <div class="gauge-bar"><div id="gauge-rf" class="gauge-fill" style="width: 100%"></div></div>
                <span id="label-rf-deg" class="g-val">NOMINAL</span>
              </div>
              <div class="gauge-item">
                <span class="g-name">EO/IR THERMAL:</span>
                <div class="gauge-bar"><div id="gauge-eo" class="gauge-fill" style="width: 100%"></div></div>
                <span id="label-eo-deg" class="g-val">NOMINAL</span>
              </div>
            </div>
          </div>

          <!-- CENTER OVERLAY: RETICLE & COMBAT ALERTS -->
          <div class="hud-center-overlay">
            <div id="combat-alert" class="combat-alert hidden"></div>
            <div class="crosshair"></div>
          </div>

          <!-- RIGHT PANEL: TRACK BOARD & OODA DECISION CONTROLS -->
          <div class="hud-panel right-panel">
            <div class="panel-header">
              <span>FUSED TRACK BOARD</span>
              <span id="track-count-badge" class="badge">0 TRACKS</span>
            </div>

            <div id="track-list" class="track-list">
              <div class="empty-state">SCANNING AIRSPACE FOR EMISSIONS...</div>
            </div>

            <!-- OODA DECISION & ACTION PANEL -->
            <div class="ooda-terminal">
              <div class="ooda-header">
                <span>OODA ENGAGEMENT TERMINAL</span>
                <span id="active-track-label" class="selected-target-tag">SELECT TARGET</span>
              </div>

              <!-- STEP 1: DETECT -->
              <div class="ooda-step">
                <span class="step-num">1. DETECT</span>
                <button id="btn-detect-action" class="action-btn btn-detect" disabled>
                  [D] ACKNOWLEDGE & LOCK TRACK
                </button>
              </div>

              <!-- STEP 2: CLASSIFY -->
              <div class="ooda-step">
                <span class="step-num">2. CLASSIFY</span>
                <div class="classify-grid">
                  <button class="classify-btn" data-type="bird" disabled>[1] Biological Bird</button>
                  <button class="classify-btn" data-type="civilian_quad" disabled>[2] Civilian Drone</button>
                  <button class="classify-btn" data-type="recon_quad" disabled>[3] Recon ISR Quad</button>
                  <button class="classify-btn" data-type="strike_quad" disabled>[4] Kamikaze FPV</button>
                  <button class="classify-btn" data-type="fixed_wing" disabled>[5] Fixed-Wing</button>
                </div>
              </div>

              <!-- STEP 3: ENGAGE -->
              <div class="ooda-step">
                <span class="step-num">3. ENGAGE</span>
                <div class="engage-grid">
                  <button class="engage-btn btn-jam" data-method="jam" disabled>[J] RF Jammer</button>
                  <button class="engage-btn btn-kinetic" data-method="kinetic" disabled>[K] CIWS Cannon</button>
                  <button class="engage-btn btn-capture" data-method="capture" disabled>[C] Net Intercept</button>
                  <button class="engage-btn btn-escalate" data-method="escalate" disabled>[E] Escalate</button>
                  <button class="engage-btn btn-ignore" data-method="ignore" disabled>[I] Ignore</button>
                </div>
              </div>

              <!-- SENSOR TELEMETRY INSPECTOR -->
              <div id="sensor-inspector" class="sensor-inspector">
                <div class="inspector-title">TRACK TELEMETRY INSPECTOR</div>
                <div id="inspector-content" class="inspector-data">No track currently designated.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Initialize Radar Canvas & Click Designation
    const canvas = document.getElementById('radar-canvas');
    this.radarDisplay = new RadarDisplay(canvas);
    this.radarDisplay.resize();
    window.addEventListener('resize', () => this.radarDisplay.resize());

    // Click on Radar Canvas designates nearest target
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = Math.min(cx, cy) - 18;

      let closest = null;
      let closestDist = Infinity;
      for (const trk of this.activeTracks) {
        if (trk.isNeutralized || !trk.position) continue;
        const px = cx + (trk.position.x / 3000) * radius;
        const py = cy - (trk.position.z / 3000) * radius;
        const d = Math.hypot(px - x, py - y);
        if (d < 35 && d < closestDist) {
          closestDist = d;
          closest = trk;
        }
      }
      if (closest) {
        this.selectTrack(closest.trackId);
      }
    });

    this.bindDOMEvents();
  }

  bindDOMEvents() {
    // Top Bar Buttons
    document.getElementById('btn-cam-op').onclick = () => {
      this.setActiveCamBtn('btn-cam-op');
      this.callbacks.onCameraChange?.('operator');
    };
    document.getElementById('btn-cam-tactical').onclick = () => {
      this.setActiveCamBtn('btn-cam-tactical');
      this.callbacks.onCameraChange?.('tactical_overhead');
    };
    document.getElementById('btn-finish-drill').onclick = () => {
      this.callbacks.onEndSession?.();
    };

    // Detect Button
    document.getElementById('btn-detect-action').onclick = () => {
      this.executeDetect();
    };

    // Classify Buttons
    document.querySelectorAll('.classify-btn').forEach(btn => {
      btn.onclick = () => {
        const type = btn.getAttribute('data-type');
        this.executeClassify(type);
      };
    });

    // Engage Buttons
    document.querySelectorAll('.engage-btn').forEach(btn => {
      btn.onclick = () => {
        const method = btn.getAttribute('data-method');
        this.executeEngage(method);
      };
    });

    // Event delegation on track list container so clicks never drop
    const trackListContainer = document.getElementById('track-list');
    trackListContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.track-card');
      if (card) {
        const id = card.getAttribute('data-id');
        this.selectTrack(id);
      }
    });
  }

  setActiveCamBtn(activeId) {
    document.getElementById('btn-cam-op').classList.toggle('active', activeId === 'btn-cam-op');
    document.getElementById('btn-cam-tactical').classList.toggle('active', activeId === 'btn-cam-tactical');
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key.toUpperCase();

      if (key === 'ESCAPE') {
        this.callbacks.onEndSession?.();
      } else if (key === 'TAB') {
        e.preventDefault();
        this.cycleNextTarget();
      } else if (key === 'C') {
        this.setActiveCamBtn('btn-cam-op');
        this.callbacks.onCameraChange?.('operator');
      } else if (key === 'V') {
        this.setActiveCamBtn('btn-cam-tactical');
        this.callbacks.onCameraChange?.('tactical_overhead');
      } else if (key === 'D') {
        this.executeDetect();
      } else if (key === '1') {
        this.executeClassify('bird');
      } else if (key === '2') {
        this.executeClassify('civilian_quad');
      } else if (key === '3') {
        this.executeClassify('recon_quad');
      } else if (key === '4') {
        this.executeClassify('strike_quad');
      } else if (key === '5') {
        this.executeClassify('fixed_wing');
      } else if (key === 'J') {
        this.executeEngage('jam');
      } else if (key === 'K') {
        this.executeEngage('kinetic');
      } else if (key === 'C') {
        this.executeEngage('capture');
      } else if (key === 'E') {
        this.executeEngage('escalate');
      } else if (key === 'I') {
        this.executeEngage('ignore');
      }
    });
  }

  ensureTargetSelected() {
    if (this.selectedTrackId) {
      const current = this.activeTracks.find(t => t.trackId === this.selectedTrackId);
      if (current && !current.isNeutralized) return this.selectedTrackId;
    }
    const candidate = this.activeTracks.find(t => !t.isNeutralized);
    if (candidate) {
      this.selectTrack(candidate.trackId);
      return candidate.trackId;
    }
    return null;
  }

  cycleNextTarget() {
    const aliveTracks = this.activeTracks.filter(t => !t.isNeutralized);
    if (aliveTracks.length === 0) return;

    const currIdx = aliveTracks.findIndex(t => t.trackId === this.selectedTrackId);
    const nextIdx = (currIdx + 1) % aliveTracks.length;
    this.selectTrack(aliveTracks[nextIdx].trackId);
    this.showAlert(`DESIGNATED ${aliveTracks[nextIdx].trackId}`, 'info');
  }

  executeDetect() {
    const trackId = this.ensureTargetSelected();
    if (!trackId) {
      this.showAlert('NO ACTIVE TARGETS ON SENSORS', 'warning');
      return;
    }
    this.callbacks.onDetect?.(trackId);
    this.showAlert(`TRACK ${trackId} CONFIRMED & DESIGNATED ON SENSORS`, 'info');
  }

  executeClassify(type) {
    const trackId = this.ensureTargetSelected();
    if (!trackId) {
      this.showAlert('NO ACTIVE TARGETS ON SENSORS', 'warning');
      return;
    }
    this.callbacks.onClassify?.(trackId, type);
    this.showAlert(`TRACK ${trackId} CLASSIFIED AS [${type.toUpperCase()}]`, 'success');
  }

  executeEngage(method) {
    const trackId = this.ensureTargetSelected();
    if (!trackId) {
      this.showAlert('NO ACTIVE TARGETS ON SENSORS', 'warning');
      return;
    }
    this.callbacks.onEngage?.(trackId, method);
    this.showAlert(`DEPLOYING COUNTERMEASURE: ${method.toUpperCase()} AGAINST ${trackId}`, 'warning');
    // Auto cycle to next incoming hostile target after engaging
    setTimeout(() => this.cycleNextTarget(), 800);
  }

  showAlert(text, tone = 'info') {
    const el = document.getElementById('combat-alert');
    if (!el) return;
    el.textContent = text;
    el.className = `combat-alert combat-alert-${tone}`;
    el.classList.remove('hidden');

    clearTimeout(this.alertTimeout);
    this.alertTimeout = setTimeout(() => {
      el.classList.add('hidden');
    }, 2800);
  }

  update(simTime, tracks, scenario, clutterBlips, sweepAngle) {
    this.activeTracks = tracks;

    // Auto-designate first target if none selected or if previous target neutralized
    if (!this.selectedTrackId && tracks.length > 0) {
      const firstActive = tracks.find(t => !t.isNeutralized);
      if (firstActive) {
        this.selectTrack(firstActive.trackId);
      }
    } else if (this.selectedTrackId) {
      const current = tracks.find(t => t.trackId === this.selectedTrackId);
      if (current && current.isNeutralized) {
        const next = tracks.find(t => !t.isNeutralized);
        if (next) this.selectTrack(next.trackId);
      }
    }

    // Update Telemetry Header
    const min = Math.floor(simTime / 60);
    const sec = (simTime % 60).toFixed(1);
    document.getElementById('hud-timer').textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(4, '0')}`;
    document.getElementById('hud-mission-name').textContent = scenario.name || 'TACTICAL DRILL';
    document.getElementById('hud-seed').textContent = `#${scenario.seed}`;

    // Update Degradation Gauges
    const deg = scenario.sensors || {};
    this.setGauge('radar', deg.radar || 0);
    this.setGauge('rf', deg.rf || 0);
    this.setGauge('eo', deg.eo || 0);

    // Throttle Track List DOM re-rendering (every 250ms) to preserve responsiveness
    const now = performance.now();
    if (!this.lastTrackRender || now - this.lastTrackRender > 250) {
      this.lastTrackRender = now;
      this.renderTrackList(tracks);
    }

    // Update Inspector if a track is selected
    this.updateInspector();

    // Render Radar Canvas
    this.radarDisplay.render(tracks, clutterBlips, sweepAngle, deg.radar || 0, this.selectedTrackId);
  }

  setGauge(sensorKey, val) {
    const fill = document.getElementById(`gauge-${sensorKey}`);
    const lbl = document.getElementById(`label-${sensorKey}-deg`);
    if (!fill || !lbl) return;

    const pct = Math.max(10, Math.round((1 - val) * 100));
    fill.style.width = `${pct}%`;
    if (val < 0.2) {
      fill.style.background = '#00ff88';
      lbl.textContent = 'NOMINAL';
    } else if (val < 0.5) {
      fill.style.background = '#ffcc00';
      lbl.textContent = 'DEGRADED';
    } else {
      fill.style.background = '#ff3344';
      lbl.textContent = 'CRITICAL INTERFERENCE';
    }
  }

  renderTrackList(tracks) {
    const container = document.getElementById('track-list');
    if (!container) return;
    document.getElementById('track-count-badge').textContent = `${tracks.length} TARGETS`;

    if (tracks.length === 0) {
      container.innerHTML = `<div class="empty-state">AIRSPACE CLEAR — SENSORS ACTIVE</div>`;
      return;
    }

    container.innerHTML = tracks.map(trk => {
      const isSelected = trk.trackId === this.selectedTrackId;
      const statusClass = trk.userStatus ? trk.userStatus.toLowerCase() : 'new';
      return `
        <div class="track-card ${isSelected ? 'selected' : ''} ${statusClass}" data-id="${trk.trackId}">
          <div class="track-card-head">
            <span class="track-id">${trk.trackId}</span>
            <span class="track-status-pill ${statusClass}">${trk.userStatus || 'NEW'}</span>
          </div>
          <div class="track-card-metrics">
            <span>RNG: <strong>${trk.range}m</strong></span>
            <span>BRG: <strong>${trk.bearing}°</strong></span>
            <span>ALT: <strong>${trk.altitude}m</strong></span>
            <span>CONF: <strong>${trk.confidence}%</strong></span>
          </div>
          <div class="track-sensors-active">
            <span class="chip ${trk.activeSensors?.radar ? 'active' : ''}">RAD</span>
            <span class="chip ${trk.activeSensors?.rf ? 'active' : ''}">RF</span>
            <span class="chip ${trk.activeSensors?.eo ? 'active' : ''}">EO</span>
            <span class="chip ${trk.activeSensors?.acoustic ? 'active' : ''}">AC</span>
          </div>
        </div>
      `;
    }).join('');
  }

  selectTrack(trackId) {
    this.selectedTrackId = trackId;
    const tag = document.getElementById('active-track-label');
    tag.textContent = `TARGET: ${trackId}`;

    // Enable OODA action buttons
    document.getElementById('btn-detect-action').removeAttribute('disabled');
    document.querySelectorAll('.classify-btn').forEach(b => b.removeAttribute('disabled'));
    document.querySelectorAll('.engage-btn').forEach(b => b.removeAttribute('disabled'));

    this.updateInspector();
  }

  updateInspector() {
    const content = document.getElementById('inspector-content');
    if (!this.selectedTrackId) {
      content.innerHTML = 'No track designated.';
      return;
    }

    const trk = this.activeTracks.find(t => t.trackId === this.selectedTrackId);
    if (!trk) {
      content.innerHTML = `Track ${this.selectedTrackId} dropped from active sensor range.`;
      return;
    }

    const rf = trk.sensorDetails?.rf;
    const eo = trk.sensorDetails?.eo;

    content.innerHTML = `
      <div class="inspector-grid">
        <div><strong>Range:</strong> ${trk.range} m</div>
        <div><strong>Bearing:</strong> ${trk.bearing}° Azimuth</div>
        <div><strong>Altitude:</strong> ${trk.altitude} m AGL</div>
        <div><strong>Fused Confidence:</strong> ${trk.confidence}%</div>
        <div><strong>RF Protocol:</strong> ${rf ? rf.protocol : 'None (Silent/Avian)'}</div>
        <div><strong>RF RSSI:</strong> ${rf ? `${rf.rssi} dBm` : 'N/A'}</div>
        <div><strong>EO Thermal:</strong> ${eo ? eo.visualQuality : 'Unacquired'}</div>
        <div><strong>User Classification:</strong> ${trk.userClassification || 'Pending'}</div>
      </div>
    `;
  }
}
