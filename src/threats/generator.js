/**
 * Procedural Threat Scenario Generator for VayuRaksha
 * Generates endless non-repeating tactical scenarios driven by seeded PRNG.
 * Prevents rote learning while adhering to strict military constraint satisfaction.
 */

import { SeededRandom } from '../../shared/rng.js';
import { THREAT_TYPES } from '../../shared/threatTypes.js';

export const SCENARIO_TEMPLATES = [
  {
    id: 'tpl_night_decoy_heavy',
    name: 'Night Ingress & Biological Clutter',
    testedSkills: ['night_detection', 'decoy_rejection', 'threat_classification'],
    envPool: { terrain: ['urban', 'rural'], timeOfDay: [20, 23], weather: ['fog', 'clear'] },
    threatWeights: { bird: 0.45, civilian_quad: 0.15, recon_quad: 0.25, strike_quad: 0.15, fixed_wing: 0.0 }
  },
  {
    id: 'tpl_degraded_sensor_swarm',
    name: 'Electronic Warfare & Sensor Jamming Swarm',
    testedSkills: ['degraded_sensors', 'swarm_prioritisation', 'roe_compliance'],
    envPool: { terrain: ['rural', 'urban'], timeOfDay: [10, 17], weather: ['dust', 'rain'] },
    threatWeights: { bird: 0.1, civilian_quad: 0.1, recon_quad: 0.2, strike_quad: 0.5, fixed_wing: 0.1 }
  },
  {
    id: 'tpl_fast_low_strike',
    name: 'Terrain-Masked High-Speed Terminal Dives',
    testedSkills: ['threat_classification', 'roe_compliance'],
    envPool: { terrain: ['urban', 'rural'], timeOfDay: [6, 18], weather: ['clear', 'fog'] },
    threatWeights: { bird: 0.1, civilian_quad: 0.1, recon_quad: 0.1, strike_quad: 0.5, fixed_wing: 0.2 }
  },
  {
    id: 'tpl_multi_vector_saturation',
    name: 'Multi-Directional Converging Airspace Breach',
    testedSkills: ['swarm_prioritisation', 'threat_classification', 'decoy_rejection'],
    envPool: { terrain: ['urban'], timeOfDay: [14, 21], weather: ['fog', 'clear'] },
    threatWeights: { bird: 0.2, civilian_quad: 0.2, recon_quad: 0.2, strike_quad: 0.3, fixed_wing: 0.1 }
  }
];

export function generateProceduralScenario(templateId = 'tpl_night_decoy_heavy', difficulty = 5, seed = 12345) {
  const rng = new SeededRandom(seed);
  const template = SCENARIO_TEMPLATES.find(t => t.id === templateId) || SCENARIO_TEMPLATES[0];

  const terrain = rng.choice(template.envPool.terrain);
  const timeOfDay = rng.rangeInt(template.envPool.timeOfDay[0], template.envPool.timeOfDay[1]);
  const weather = rng.choice(template.envPool.weather);

  // Difficulty scaling (1 - 10)
  // Higher difficulty = more threats, worse sensor degradation, tighter spawn spacing
  const droneCount = Math.min(15, Math.max(2, Math.floor(2 + (difficulty * 1.1))));
  const radarDegradation = Math.min(0.85, 0.05 * difficulty + (weather === 'dust' ? 0.2 : 0.0));
  const eoDegradation = Math.min(0.9, (timeOfDay > 19 || timeOfDay < 6 ? 0.4 : 0.0) + (weather === 'fog' ? 0.3 : 0.0));
  const rfDegradation = Math.min(0.7, 0.04 * difficulty);
  const acousticDegradation = Math.min(0.6, 0.05 * difficulty);

  const threats = [];
  const typeKeys = Object.keys(template.threatWeights);

  for (let i = 0; i < droneCount; i++) {
    // Weighted sample for threat type
    const roll = rng.next();
    let cumulative = 0;
    let selectedType = 'recon_quad';
    for (const k of typeKeys) {
      cumulative += template.threatWeights[k];
      if (roll <= cumulative) {
        selectedType = k;
        break;
      }
    }

    const bearing = rng.range(0, 360);
    const distance = rng.range(1600, 3000);
    const altitude = selectedType === 'fixed_wing' ? rng.range(250, 450) : rng.range(40, 220);
    const spawnT = Number((2.0 + (i * rng.range(3.5, 8.0) * (1 - (difficulty * 0.05)))).toFixed(1));
    const speed = rng.range(THREAT_TYPES[selectedType].speedMin, THREAT_TYPES[selectedType].speedMax);

    threats.push({
      id: `proc-${selectedType.slice(0, 3)}-${i + 1}`,
      type: selectedType,
      bearing: Math.round(bearing),
      distance: Math.round(distance),
      altitude: Math.round(altitude),
      spawnT,
      speed: Math.round(speed)
    });
  }

  // Sort by spawn time
  threats.sort((a, b) => a.spawnT - b.spawnT);

  return {
    id: `proc_${template.id}_${seed}`,
    name: `ADVERSARY DRILL: ${template.name} (Diff ${difficulty})`,
    description: `Procedurally generated tactical engagement tailored to target operator weaknesses. Seed #${seed}.`,
    seed,
    difficulty,
    isProcedural: true,
    templateId: template.id,
    env: {
      terrain,
      timeOfDay,
      weather
    },
    sensors: {
      radar: Number(radarDegradation.toFixed(2)),
      rf: Number(rfDegradation.toFixed(2)),
      eo: Number(eoDegradation.toFixed(2)),
      acoustic: Number(acousticDegradation.toFixed(2))
    },
    defendedAsset: {
      name: 'Tactical Forward Deployment Site',
      x: 0,
      y: 0,
      z: 0,
      radius: 175
    },
    threats,
    skills: template.testedSkills
  };
}
