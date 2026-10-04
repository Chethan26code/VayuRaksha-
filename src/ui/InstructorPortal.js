/**
 * Instructor Command & Tactical Unit Management Portal
 * Enables DSSC instructors to oversee unit competency distributions,
 * configure military Rules of Engagement (ROE), and dispatch identical seeded drills.
 */

export class InstructorPortal {
  constructor(domRoot, onBackToSimulation) {
    this.root = domRoot;
    this.onBackToSimulation = onBackToSimulation;
    this.unitData = null;
    this.roeData = null;
  }

  async loadAndRender() {
    try {
      const [unitRes, roeRes] = await Promise.all([
        fetch('/api/units/unit_15_ad').then(r => r.json()),
        fetch('/api/roe').then(r => r.json())
      ]);

      this.unitData = unitRes;
      this.roeData = roeRes;
      this.render();
    } catch (e) {
      console.error('Failed to load instructor data', e);
      this.root.innerHTML = `<div class="p-8 text-red">Failed to connect to local server: ${e.message}</div>`;
    }
  }

  render() {
    const { unit, trainees } = this.unitData;
    const rules = this.roeData?.rules || {};

    this.root.innerHTML = `
      <div class="instructor-view">
        <header class="inst-header">
          <div>
            <div class="inst-badge">DSSC INSTRUCTOR COMMAND CONSOLE</div>
            <h1>${unit.name}</h1>
            <p>Stationed: ${unit.location} | Active Cadre: ${trainees.length} Personnel</p>
          </div>
          <div>
            <button id="btn-inst-back" class="hud-btn">Back to Simulator [Esc]</button>
          </div>
        </header>

        <div class="inst-grid">
          <!-- CARD 1: UNIT CADRE ROSTER -->
          <div class="inst-card">
            <div class="card-head">
              <h3>UNIT PERFORMANCE & SKILL READINESS</h3>
              <span class="badge">UNIT ALPHA</span>
            </div>
            <table class="inst-table">
              <thead>
                <tr>
                  <th>Rank & Name</th>
                  <th>Drills</th>
                  <th>Avg Score</th>
                  <th>Weakest Domain</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${trainees.map(t => {
                  const weak = Object.entries(t.skills || {}).sort((a,b) => a[1] - b[1])[0];
                  const weakName = weak ? weak[0].replace('_', ' ').toUpperCase() : 'NONE';
                  return `
                    <tr>
                      <td><strong>${t.name}</strong></td>
                      <td>${t.sessionsCount}</td>
                      <td><span class="score-pill ${t.avgScore >= 80 ? 'high' : (t.avgScore >= 70 ? 'mid' : 'low')}">${t.avgScore}%</span></td>
                      <td><span class="weak-tag">${weakName}</span></td>
                      <td><span class="status-active">READY</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- CARD 2: DISPATCH SEEDED DRILL -->
          <div class="inst-card">
            <div class="card-head">
              <h3>DISPATCH STANDARDIZED SEEDED DRILL</h3>
              <span class="badge">FAIR BASELINE</span>
            </div>
            <p class="inst-desc">Deploy an identical deterministic scenario to every operator in the unit for standardized benchmark evaluation.</p>
            <form id="form-dispatch" class="dispatch-form">
              <label>Select Mission Template:</label>
              <select id="dispatch-mission" class="inst-select">
                <option value="urban_night_mixed" ${unit.assignedMissionId === 'urban_night_mixed' ? 'selected' : ''}>Phase 2: Urban Night Complex Multi-Vector</option>
                <option value="rural_swarm" ${unit.assignedMissionId === 'rural_swarm' ? 'selected' : ''}>Phase 3: Border Outpost Coordinated Swarm</option>
                <option value="tutorial_basic" ${unit.assignedMissionId === 'tutorial_basic' ? 'selected' : ''}>Phase 1: Basic Airspace Intrusion</option>
              </select>

              <label>Deterministic Random Seed (1 - 99999):</label>
              <input type="number" id="dispatch-seed" class="inst-input" value="${unit.assignedSeed || 4721}" />

              <button type="submit" class="hud-btn btn-primary" style="margin-top: 15px; width: 100%;">
                ⚡ Dispatch Drill to Whole Cadre
              </button>
            </form>
            <div id="dispatch-result" class="dispatch-status hidden"></div>
          </div>

          <!-- CARD 3: RULES OF ENGAGEMENT POLICY EDITOR -->
          <div class="inst-card full-span">
            <div class="card-head">
              <h3>DOCTRINAL RULES OF ENGAGEMENT (ROE) POLICY EDITOR</h3>
              <span class="badge">INSTRUCTOR CONFIGURABLE</span>
            </div>
            <p class="inst-desc">Modify authorized countermeasures per target classification without modifying code. Changes apply dynamically across scoring.</p>
            
            <div class="roe-editor-grid">
              ${Object.entries(rules).map(([typeKey, rule]) => `
                <div class="roe-item-box">
                  <h4>${rule.name} (<code>${typeKey}</code>)</h4>
                  <div class="roe-field">
                    <span class="text-green">Authorized (Correct):</span>
                    <strong>${rule.correct.join(', ') || 'None'}</strong>
                  </div>
                  <div class="roe-field">
                    <span class="text-yellow">Secondary (Acceptable):</span>
                    <span>${rule.acceptable.join(', ') || 'None'}</span>
                  </div>
                  <div class="roe-field">
                    <span class="text-red">Prohibited (Penalty):</span>
                    <span>${rule.penalty.join(', ') || 'None'}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('btn-inst-back').onclick = () => {
      this.root.innerHTML = '';
      this.onBackToSimulation?.();
    };

    document.getElementById('form-dispatch').onsubmit = async (e) => {
      e.preventDefault();
      const missionId = document.getElementById('dispatch-mission').value;
      const seed = document.getElementById('dispatch-seed').value;

      try {
        const res = await fetch('/api/units/unit_15_ad/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ missionId, seed: Number(seed) })
        });
        const data = await res.json();
        const stat = document.getElementById('dispatch-result');
        stat.textContent = `✓ Successfully assigned mission '${missionId}' with Seed #${seed} to Unit Alpha!`;
        stat.classList.remove('hidden');
      } catch (err) {
        alert('Failed to dispatch drill: ' + err.message);
      }
    };
  }
}
