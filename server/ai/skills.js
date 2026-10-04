/**
 * Bayesian / Elo Trainee Skill Modeling
 * Calibrates tactical mastery ratings across 6 military counter-UAS competencies.
 */

const expected = (R, D) => 1 / (1 + 10 ** ((D - R) / 400));

export function updateSkill(R, D, success, K = 32) {
  const S = success ? 1 : 0;
  return Math.round(R + K * (S - expected(R, D)));
}

// Calibrates scenario difficulty rating to achieve ~65% target pass rate
export const targetDifficulty = (R) => Math.round(R - 108);

export const DEFAULT_SKILLS = {
  night_detection: 1000,
  degraded_sensors: 1000,
  decoy_rejection: 1000,
  threat_classification: 1000,
  swarm_prioritisation: 1000,
  roe_compliance: 1000
};
