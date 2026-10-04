/**
 * After-Action Review (AAR) Tactical Debriefing Dashboard
 * Provides explainable scoring, interactive radar competency charts,
 * chronological decision timeline, and AI adversary drill recommendations.
 */

import { Chart, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';

// Register Chart.js components
Chart.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export class AARDashboard {
  constructor(domRoot, onRestartDrill, onHome) {
    this.root = domRoot;
    this.onRestartDrill = onRestartDrill;
    this.onHome = onHome;
    this.radarChart = null;
  }

  render(scoreResult, scenario, traineeStats, adversaryRecommendation) {
    const { score, grade, perThreat, auditLogs } = scoreResult;

    this.root.innerHTML = `
      <div class="aar-modal-backdrop">
        <div class="aar-window">
          <!-- AAR HEADER -->
          <header class="aar-header">
            <div>
              <div class="aar-tag">DEFENCE SERVICES STAFF COLLEGE — COUNTER-UAS AAR</div>
              <h2>MISSION AFTER-ACTION REVIEW & AUDIT</h2>
              <div class="aar-sub">Scenario: <strong>${scenario.name}</strong> (Seed #${scenario.seed})</div>
            </div>
            <div class="aar-score-hero">
              <div class="score-number ${score >= 75 ? 'pass' : 'fail'}">${score}</div>
              <div class="score-denom">/ 100</div>
              <div class="grade-badge">${grade}</div>
            </div>
          </header>

          <!-- AAR BODY SPLIT -->
          <div class="aar-body-grid">
            <!-- LEFT: PERFORMANCE METRICS & CHARTS -->
            <div class="aar-col-left">
              <div class="chart-card">
                <h3>OPERATOR SKILL COMPETENCY VECTOR</h3>
                <div class="canvas-container">
                  <canvas id="aar-skill-chart"></canvas>
                </div>
              </div>

              <!-- AI ADVERSARY DEBRIEF CARD -->
              <div class="adversary-card">
                <div class="adv-badge">🧠 AI ADVERSARY ASSESSMENT</div>
                <p class="adv-reason">${adversaryRecommendation ? adversaryRecommendation.reason : 'Trainee profile updating across tactical skill domains.'}</p>
                <div class="adv-next">
                  <span>Suggested Next Mission:</span>
                  <strong>${adversaryRecommendation ? adversaryRecommendation.templateName : 'Adaptive Tactical Drill'}</strong>
                </div>
              </div>
            </div>

            <!-- RIGHT: LINE-BY-LINE AUDIT & DECISION EXPLANATIONS -->
            <div class="aar-col-right">
              <h3>DOCTRINAL AUDIT & EXPLANATIONS</h3>
              <div class="audit-stream">
                ${auditLogs.map(log => `
                  <div class="audit-card">
                    <div class="audit-card-title">
                      <span class="threat-name">${log.threat}</span>
                      <span class="threat-score ${log.score >= 70 ? 'score-high' : 'score-low'}">${log.score} pts</span>
                    </div>
                    <ul class="reason-list">
                      ${log.reasons.map(r => `<li class="${r.startsWith('[-') ? 'reason-neg' : 'reason-pos'}">${r}</li>`).join('')}
                    </ul>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- AAR FOOTER ACTIONS -->
          <footer class="aar-footer">
            <button id="btn-aar-home" class="btn-aar btn-secondary">Tactical Mission Select</button>
            <button id="btn-aar-repeat" class="btn-aar btn-secondary">Replay Identical Drill (Seed #${scenario.seed})</button>
            <button id="btn-aar-next" class="btn-aar btn-primary">Engage AI Adversary Drill</button>
          </footer>
        </div>
      </div>
    `;

    this.initChart(scoreResult.skillDeltas, traineeStats);
    this.bindButtons(scenario);
  }

  initChart(skillDeltas, traineeStats) {
    const canvas = document.getElementById('aar-skill-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const skills = [
      { key: 'night_detection', label: 'Night Ops' },
      { key: 'degraded_sensors', label: 'Degraded Sensors' },
      { key: 'decoy_rejection', label: 'Decoy Rejection' },
      { key: 'threat_classification', label: 'Classification' },
      { key: 'swarm_prioritisation', label: 'Swarm Priority' },
      { key: 'roe_compliance', label: 'ROE Adherence' }
    ];

    const currentValues = skills.map(s => {
      const d = skillDeltas[s.key];
      if (!d || d.max === 0) return 70; // baseline if un-tested in this single drill
      return Math.round((d.points / d.max) * 100);
    });

    const historicalRatings = skills.map(s => {
      const elo = traineeStats?.skills?.[s.key] ?? 1000;
      return Math.min(100, Math.max(10, Math.round((elo / 1500) * 100)));
    });

    if (this.radarChart) {
      this.radarChart.destroy();
    }

    this.radarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: skills.map(s => s.label),
        datasets: [
          {
            label: 'This Session Score (%)',
            data: currentValues,
            fill: true,
            backgroundColor: 'rgba(0, 255, 170, 0.25)',
            borderColor: '#00ffaa',
            pointBackgroundColor: '#00ffaa',
            borderWidth: 2
          },
          {
            label: 'Cumulative Mastery Rating',
            data: historicalRatings,
            fill: true,
            backgroundColor: 'rgba(54, 162, 235, 0.15)',
            borderColor: '#36a2eb',
            pointBackgroundColor: '#36a2eb',
            borderWidth: 1.5,
            borderDash: [4, 4]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: 'rgba(255, 255, 255, 0.15)' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            pointLabels: { color: '#00ffaa', font: { family: 'monospace', size: 10 } },
            ticks: { display: false, min: 0, max: 100 }
          }
        },
        plugins: {
          legend: { labels: { color: '#e0e0e0', font: { family: 'monospace', size: 10 } } }
        }
      }
    });
  }

  bindButtons(scenario) {
    document.getElementById('btn-aar-home').onclick = () => {
      this.close();
      this.onHome?.();
    };

    document.getElementById('btn-aar-repeat').onclick = () => {
      this.close();
      this.onRestartDrill?.(scenario.id, scenario.seed);
    };

    document.getElementById('btn-aar-next').onclick = () => {
      this.close();
      this.onRestartDrill?.('procedural_next');
    };
  }

  close() {
    this.root.innerHTML = '';
  }
}
