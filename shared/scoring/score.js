/**
 * VayuRaksha Doctrinal Scoring Engine (Pure Function)
 * Fully auditable, explainable scoring conforming to MoD DSSC evaluation criteria.
 * Maps every point directly to an explicit military decision reason string and skill vector.
 */

import { THREAT_TYPES } from '../threatTypes.js';

const T_DETECT_MAX = 18.0; // Seconds allowed to detect before point degradation
const T_DECIDE_MAX = 12.0; // Seconds allowed between detection and engagement

export function calculateSessionScore(scenario, events, roeRules) {
  const activeROE = roeRules?.rules || roeRules;
  const threatEvents = {};
  
  // Group events by threatId
  for (const ev of events) {
    if (ev.threatId) {
      if (!threatEvents[ev.threatId]) {
        threatEvents[ev.threatId] = [];
      }
      threatEvents[ev.threatId].push(ev);
    }
  }

  const perThreatScores = [];
  const skillDeltas = {
    night_detection: { points: 0, max: 0 },
    degraded_sensors: { points: 0, max: 0 },
    decoy_rejection: { points: 0, max: 0 },
    threat_classification: { points: 0, max: 0 },
    swarm_prioritisation: { points: 0, max: 0 },
    roe_compliance: { points: 0, max: 0 }
  };

  const isNight = scenario.env.timeOfDay >= 19 || scenario.env.timeOfDay <= 5;
  const hasDegradedSensors = Object.values(scenario.sensors || {}).some(v => v > 0.25);
  const isSwarmScenario = (scenario.threats?.length || 0) >= 5;

  let totalWeightedScore = 0;
  let totalMaxWeight = 0;
  const auditLogs = [];

  for (const threatDef of scenario.threats) {
    const threatSpec = THREAT_TYPES[threatDef.type] || {
      id: threatDef.type,
      name: threatDef.type,
      isThreat: threatDef.type !== 'bird'
    };

    // Threat weight priority
    let weight = 1.0;
    if (threatDef.type === 'strike_quad') weight = 2.0;
    if (threatDef.type === 'fixed_wing') weight = 1.8;
    if (threatDef.type === 'recon_quad') weight = 1.3;
    if (threatDef.type === 'civilian_quad') weight = 1.0;
    if (threatDef.type === 'bird') weight = 1.2; // High weight on not committing false positive

    const evList = threatEvents[threatDef.id] || [];
    const spawnT = threatDef.spawnT ?? 0;

    const detectEv = evList.find(e => e.type === 'detect');
    const classifyEv = evList.find(e => e.type === 'classify');
    const engageEv = evList.find(e => e.type === 'engage');
    const breachEv = evList.find(e => e.type === 'breach');

    let detectScore = 0;
    let classifyScore = 0;
    let engageScore = 0;
    let timingScore = 0;
    const reasons = [];

    // 1. Detection Evaluation (Max 30 pts)
    if (detectEv) {
      const deltaT = Math.max(0, detectEv.t - spawnT);
      const ratio = Math.max(0, Math.min(1, 1 - (deltaT / T_DETECT_MAX)));
      detectScore = Math.round(30 * ratio);
      reasons.push(`[+${detectScore}/30] Detected at t=${deltaT.toFixed(1)}s`);
      
      if (isNight) {
        skillDeltas.night_detection.points += detectScore;
        skillDeltas.night_detection.max += 30;
      }
      if (hasDegradedSensors) {
        skillDeltas.degraded_sensors.points += detectScore;
        skillDeltas.degraded_sensors.max += 30;
      }
    } else {
      detectScore = 0;
      reasons.push(`[0/30] Target was never acknowledged on sensors`);
      if (isNight) skillDeltas.night_detection.max += 30;
      if (hasDegradedSensors) skillDeltas.degraded_sensors.max += 30;
    }

    // 2. Classification Evaluation (Max 25 pts)
    if (classifyEv) {
      const selected = classifyEv.data?.classification;
      if (selected === threatDef.type) {
        classifyScore = 25;
        reasons.push(`[+25/25] Accurate identification as ${threatSpec.name}`);
        skillDeltas.threat_classification.points += 25;
      } else if (
        (threatDef.type !== 'bird' && selected !== 'bird') ||
        (threatDef.type === 'bird' && selected === 'bird')
      ) {
        classifyScore = 12;
        reasons.push(`[+12/25] Partial identification: Recognized category correctly but misjudged subtype (tagged as ${selected})`);
        skillDeltas.threat_classification.points += 12;
      } else {
        classifyScore = -10;
        reasons.push(`[-10/25] Critical misclassification: Tagged ${threatSpec.name} as ${selected}`);
      }
      skillDeltas.threat_classification.max += 25;
    } else {
      classifyScore = 0;
      reasons.push(`[0/25] No classification submitted`);
      skillDeltas.threat_classification.max += 25;
    }

    // 3. Engagement Evaluation & ROE Adherence (Max 25 pts)
    const roeForThreat = activeROE[threatDef.type] || { correct: ['jam'], acceptable: [], penalty: ['ignore'] };
    const method = engageEv?.data?.method;

    if (!threatSpec.isThreat) {
      // Decoy (Bird) handling
      if (!engageEv || method === 'ignore') {
        engageScore = 25;
        reasons.push(`[+25/25] Decoy properly ignored / cleared without expending ordnance`);
        skillDeltas.decoy_rejection.points += 25;
        skillDeltas.roe_compliance.points += 25;
      } else {
        engageScore = -25;
        reasons.push(`[-25/25] ROE VIOLATION: Fired countermeasure '${method}' at harmless biological decoy!`);
        skillDeltas.decoy_rejection.points += 0;
      }
      skillDeltas.decoy_rejection.max += 25;
      skillDeltas.roe_compliance.max += 25;
    } else {
      // Hostile Drone handling
      if (!engageEv || method === 'ignore') {
        engageScore = -15;
        reasons.push(`[-15/25] FAILURE TO ENGAGE: Hostile threat '${threatSpec.name}' left uncontested`);
        skillDeltas.roe_compliance.max += 25;
      } else if (roeForThreat.correct.includes(method)) {
        engageScore = 25;
        reasons.push(`[+25/25] Doctrinally optimal countermeasure '${method}' employed`);
        skillDeltas.roe_compliance.points += 25;
        skillDeltas.roe_compliance.max += 25;
      } else if (roeForThreat.acceptable.includes(method)) {
        engageScore = 12;
        reasons.push(`[+12/25] Sub-optimal but acceptable countermeasure '${method}'`);
        skillDeltas.roe_compliance.points += 12;
        skillDeltas.roe_compliance.max += 25;
      } else {
        engageScore = -10;
        reasons.push(`[-10/25] Inappropriate weapon doctrine '${method}' against ${threatSpec.name}`);
        skillDeltas.roe_compliance.max += 25;
      }
    }

    // 4. Decision Timing (Max 20 pts)
    if (detectEv && engageEv && method !== 'ignore') {
      const decisionLag = Math.max(0, engageEv.t - detectEv.t);
      const ratio = Math.max(0, Math.min(1, 1 - (decisionLag / T_DECIDE_MAX)));
      timingScore = Math.round(20 * ratio);
      reasons.push(`[+${timingScore}/20] Reaction speed: Decision loop completed in ${decisionLag.toFixed(1)}s`);
    } else if (!threatSpec.isThreat && (!engageEv || method === 'ignore')) {
      // Ignored bird promptly
      timingScore = 20;
      reasons.push(`[+20/20] Zero delay non-threat clearance`);
    } else {
      timingScore = 0;
      reasons.push(`[0/20] Incomplete OODA decision loop`);
    }

    // Swarm prioritization metric
    if (isSwarmScenario) {
      const scoreSubtotal = Math.max(0, detectScore + classifyScore + engageScore + timingScore);
      skillDeltas.swarm_prioritisation.points += (scoreSubtotal / 100) * 20;
      skillDeltas.swarm_prioritisation.max += 20;
    }

    const threatTotal = Math.max(0, Math.min(100, detectScore + classifyScore + engageScore + timingScore));

    perThreatScores.push({
      threatId: threatDef.id,
      type: threatDef.type,
      name: threatSpec.name,
      weight,
      scores: {
        detect: detectScore,
        classify: classifyScore,
        engage: engageScore,
        timing: timingScore,
        total: threatTotal
      },
      reasons
    });

    totalWeightedScore += threatTotal * weight;
    totalMaxWeight += 100 * weight;
    auditLogs.push({ threat: threatSpec.name, id: threatDef.id, score: threatTotal, reasons });
  }

  // Normalized overall score [0 - 100]
  const finalScore = totalMaxWeight > 0 ? Math.round((totalWeightedScore / totalMaxWeight) * 100) : 0;

  // Grade classification
  let grade = 'UNSATISFACTORY';
  if (finalScore >= 90) grade = 'EXEMPLARY (DISTINCTION)';
  else if (finalScore >= 75) grade = 'MISSION CAPABLE (PASS)';
  else if (finalScore >= 60) grade = 'DEVELOPING (NEEDS DRILL)';

  return {
    score: finalScore,
    grade,
    perThreat: perThreatScores,
    skillDeltas,
    auditLogs
  };
}
