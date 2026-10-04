/**
 * Tactical Threat Types Specification for Counter-UAS (C-UAS) Simulation
 * Calibrated against modern military drone capabilities and biological decoys.
 */

export const THREAT_TYPES = {
  bird: {
    id: 'bird',
    name: 'Avian Target (Biological Decoy)',
    isThreat: false,
    category: 'decoy',
    rcs: 0.01, // Radar Cross Section (m^2) - very low
    rfSignature: null, // Natural animal, no RF link
    speedMin: 8, // m/s (~30 km/h)
    speedMax: 18,
    altitudeMin: 20,
    altitudeMax: 120,
    maneuverability: 'erratic_flutter',
    acousticDecibels: 25,
    description: 'Flock or lone bird with natural flapping signatures. Must NOT be engaged.'
  },
  civilian_quad: {
    id: 'civilian_quad',
    name: 'Commercial DJI-Class Quadcopter',
    isThreat: true,
    threatLevel: 'low',
    category: 'drone',
    rcs: 0.05,
    rfSignature: { protocol: 'OcuSync / Wi-Fi', freqGHz: [2.4, 5.8], hops: false },
    speedMin: 10,
    speedMax: 22,
    altitudeMin: 30,
    altitudeMax: 200,
    maneuverability: 'standard',
    acousticDecibels: 55,
    description: 'Off-the-shelf civilian drone, potential visual surveillance or accidental airspace intrusion.'
  },
  recon_quad: {
    id: 'recon_quad',
    name: 'Military Tactical ISR Quadcopter',
    isThreat: true,
    threatLevel: 'medium',
    category: 'drone',
    rcs: 0.08,
    rfSignature: { protocol: 'Frequency Hopping Military C2', freqGHz: [1.4, 2.4], hops: true },
    speedMin: 14,
    speedMax: 28,
    altitudeMin: 60,
    altitudeMax: 350,
    maneuverability: 'loiter_perimeter',
    acousticDecibels: 50,
    description: 'Low-noise tactical recon quadcopter observing military installations and relaying coordinates.'
  },
  strike_quad: {
    id: 'strike_quad',
    name: 'FPV Loitering Munition / Kamikaze Drone',
    isThreat: true,
    threatLevel: 'critical',
    category: 'drone',
    rcs: 0.06,
    rfSignature: { protocol: 'Analog VTX Video Link + Crossfire', freqGHz: [0.9, 5.8], hops: false },
    speedMin: 25,
    speedMax: 48, // fast sprint (~170 km/h dive)
    altitudeMin: 15,
    altitudeMax: 180,
    maneuverability: 'aggressive_dive',
    acousticDecibels: 68,
    description: 'High-speed explosive payload drone executing direct terminal dive towards defended asset.'
  },
  fixed_wing: {
    id: 'fixed_wing',
    name: 'Fixed-Wing Autonomous Drone (Delta-Wing / Shahed Type)',
    isThreat: true,
    threatLevel: 'high',
    category: 'drone',
    rcs: 0.25, // higher radar cross section
    rfSignature: { protocol: 'Satellite GNSS Guided / Minimal Telemetry', freqGHz: [1.2, 1.6], hops: false },
    speedMin: 30,
    speedMax: 65,
    altitudeMin: 80,
    altitudeMax: 600,
    maneuverability: 'straight_vector',
    acousticDecibels: 75,
    description: 'Long-range autonomous fixed-wing attack platform navigating via inertial/GPS guidance.'
  }
};

export const COUNTERMEASURES = {
  jam: {
    id: 'jam',
    name: 'RF / GNSS Electronic Jammer (Soft Kill)',
    effectiveAgainst: ['civilian_quad', 'recon_quad', 'strike_quad'],
    rangeMax: 2500,
    beamAngle: 35, // directional cone in degrees
    cooldownSeconds: 3,
    description: 'Disrupts command & control RF frequencies and GPS, triggering return-to-home or forced landing.'
  },
  kinetic: {
    id: 'kinetic',
    name: 'High-Precision Automated Cannon / CIWS (Hard Kill)',
    effectiveAgainst: ['strike_quad', 'fixed_wing', 'recon_quad'],
    rangeMax: 1500,
    collateralRisk: 'high',
    cooldownSeconds: 1.5,
    description: 'Rapid physical projectile destruction of target. High collateral hazard in urban zones.'
  },
  capture: {
    id: 'capture',
    name: 'Net-Catcher Interceptor Drone (Tactical Retrieval)',
    effectiveAgainst: ['civilian_quad', 'recon_quad'],
    rangeMax: 800,
    cooldownSeconds: 6,
    description: 'Deploys pneumatic kevlar entanglement net to capture drone intact for forensic intelligence.'
  },
  escalate: {
    id: 'escalate',
    name: 'Escalate to Air Defence Command (QRF Alert)',
    effectiveAgainst: ['fixed_wing', 'strike_quad'],
    rangeMax: 10000,
    cooldownSeconds: 5,
    description: 'Broadcasts immediate base-wide alert, scramble QRF, and hand-off track to theater air-defence.'
  },
  ignore: {
    id: 'ignore',
    name: 'Monitor & Do Not Engage (Classified Non-Threat)',
    effectiveAgainst: ['bird'],
    rangeMax: Infinity,
    cooldownSeconds: 0,
    description: 'Designates track as biological or false alarm. Prevents expenditure of ammunition and friendly alert.'
  }
};
