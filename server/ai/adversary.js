/**
 * AI Adversary Generator Engine (Thompson Sampling Multi-Armed Bandit)
 * Continuously evaluates operator skill deficits and algorithmically constructs
 * the next challenge drill to exploit weaknesses and eliminate blind spots.
 */

import { SCENARIO_TEMPLATES, generateProceduralScenario } from '../../src/threats/generator.js';
import { SeededRandom } from '../../shared/rng.js';

// Beta(a, b) pseudo-random sample using order statistics
const betaSample = (a, b, rng) => {
  const n = Math.max(1, Math.round(a + b - 1));
  const samples = Array.from({ length: n }, () => rng.next()).sort((x, y) => x - y);
  const idx = Math.min(samples.length - 1, Math.max(0, Math.round(a) - 1));
  return samples[idx] || 0.5;
};

export function pickNextAdversaryDrill(trainee, rngSeed = Date.now()) {
  const rng = new SeededRandom(rngSeed);

  // Identify trainee's lowest rated skill
  const skillEntries = Object.entries(trainee.skills || {})
    .sort((a, b) => a[1] - b[1]);

  const weakestSkill = skillEntries.length > 0 ? skillEntries[0][0] : 'decoy_rejection';
  const weakestRating = skillEntries.length > 0 ? skillEntries[0][1] : 1000;

  // Arms: Scenario templates
  let bestTemplate = null;
  let bestScore = -1;

  for (const tpl of SCENARIO_TEMPLATES) {
    const arm = trainee.banditArms?.[tpl.id] || { a: 2, b: 2 };
    // Bias towards templates that stress the operator's weakest domain
    const skillBonus = tpl.testedSkills.includes(weakestSkill) ? 1.6 : 0.8;
    const sampledValue = betaSample(arm.a, arm.b, rng) * skillBonus;

    if (sampledValue > bestScore) {
      bestScore = sampledValue;
      bestTemplate = tpl;
    }
  }

  // Scale difficulty (1 - 10) targeted at ~65% success frontier
  const targetLevel = Math.max(2, Math.min(10, Math.round((weakestRating - 700) / 60)));
  const scenarioSeed = rng.rangeInt(10000, 99999);

  const scenario = generateProceduralScenario(bestTemplate.id, targetLevel, scenarioSeed);

  const skillHumanNames = {
    night_detection: 'Night Surveillance & Detection',
    degraded_sensors: 'Operations under Sensor Jamming & Clutter',
    decoy_rejection: 'Avian Decoy & False Positive Discrimination',
    threat_classification: 'Rapid Hostile Threat Classification',
    swarm_prioritisation: 'Saturation Swarm Target Prioritization',
    roe_compliance: 'Rules of Engagement (ROE) Weapon Doctrine'
  };

  const reason = `AI Adversary Analysis: Operator demonstrated lowest proficiency in '${skillHumanNames[weakestSkill] || weakestSkill}' (Rating: ${weakestRating}). Generated customized scenario '${bestTemplate.name}' at Difficulty Level ${targetLevel} to build reflexive competence.`;

  return {
    templateId: bestTemplate.id,
    templateName: bestTemplate.name,
    difficulty: targetLevel,
    seed: scenarioSeed,
    reason,
    weakestSkill,
    scenario
  };
}
