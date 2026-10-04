/**
 * Threat Behaviour AI & Swarm Intelligence
 * Implements an auditable Finite State Machine (FSM) for single drones
 * and a modified Boids flocking algorithm with tactical role differentiation for swarms.
 */

import * as THREE from 'three';
import { THREAT_TYPES } from '../../shared/threatTypes.js';

export class ThreatInstance {
  constructor(def, rng) {
    this.id = def.id;
    this.type = def.type;
    this.spec = THREAT_TYPES[def.type] || THREAT_TYPES.recon_quad;
    this.spawnT = def.spawnT ?? 0;
    this.state = 'UNSPAWNED'; // UNSPAWNED, INGRESS, LOITER, ATTACK, EVADE, NEUTRALIZED, BREACHED
    this.isSwarmLeader = def.isSwarmLeader || false;
    this.swarmGroup = def.swarmGroup || null;

    // Kinematic vectors
    const bearingRad = ((def.bearing ?? rng.range(0, 360)) * Math.PI) / 180;
    const dist = def.distance ?? 2200;
    const altitude = def.altitude ?? 120;

    this.position = new THREE.Vector3(
      Math.sin(bearingRad) * dist,
      altitude,
      Math.cos(bearingRad) * dist
    );

    this.velocity = new THREE.Vector3();
    this.target = new THREE.Vector3(0, 0, 0); // Defended asset coordinate
    this.speed = def.speed ?? rng.range(this.spec.speedMin, this.spec.speedMax);
    this.maxSpeed = this.speed;

    // Tactical state trackers
    this.stateTimer = 0;
    this.jammedEffect = 0; // 0 to 1
    this.isNeutralized = false;
    this.neutralizedReason = null;
    this.breachNotified = false;

    // Natural wander noise for bird/recon
    this.wanderAngle = rng.range(0, Math.PI * 2);
    this.rng = rng;
  }

  update(dt, simTime, swarmMembers = []) {
    if (this.state === 'UNSPAWNED') {
      if (simTime >= this.spawnT) {
        this.state = 'INGRESS';
      } else {
        return;
      }
    }

    if (this.isNeutralized) return;

    this.stateTimer += dt;
    const distToAsset = this.position.distanceTo(this.target);

    // Terminal breach condition
    if (distToAsset < 60 && !this.breachNotified) {
      this.breachNotified = true;
      this.state = 'BREACHED';
      return;
    }

    // Reaction to electronic jamming
    if (this.jammedEffect > 0) {
      this.jammedEffect = Math.max(0, this.jammedEffect - dt * 0.2);
      // Jamming causes GPS loss & forced spiral descent
      this.position.y = Math.max(0, this.position.y - dt * 15);
      this.position.x += Math.sin(simTime * 8) * 8 * dt;
      this.position.z += Math.cos(simTime * 8) * 8 * dt;
      if (this.position.y <= 0) {
        this.isNeutralized = true;
        this.neutralizedReason = 'Forced ground landing via RF/GNSS denial';
        this.state = 'NEUTRALIZED';
      }
      return;
    }

    // Finite State Machine transitions
    switch (this.state) {
      case 'INGRESS':
        this.steerTowards(this.target, dt);
        if (this.type === 'bird') {
          // Bird biological wander
          this.applyBiologicalWander(dt);
        } else if (this.type === 'recon_quad' && distToAsset < 900) {
          this.state = 'LOITER';
          this.stateTimer = 0;
        } else if (this.type === 'strike_quad' && distToAsset < 1000) {
          this.state = 'ATTACK';
          this.maxSpeed = this.spec.speedMax * 1.25; // Terminal sprint
        }
        break;

      case 'LOITER':
        // Recon drone circles defended base perimeter
        const orbitSpeed = 0.3;
        const orbitRadius = 850;
        const angle = simTime * orbitSpeed + (this.spawnT % 10);
        const orbitTarget = new THREE.Vector3(
          Math.sin(angle) * orbitRadius,
          this.position.y,
          Math.cos(angle) * orbitRadius
        );
        this.steerTowards(orbitTarget, dt);
        break;

      case 'ATTACK':
        // Fast direct terminal dive towards asset
        this.steerTowards(new THREE.Vector3(0, 10, 0), dt);
        break;

      case 'EVADE':
        // Evasive erratic vector away from incoming fire
        const evadeVector = this.position.clone().sub(this.target).normalize();
        this.position.addScaledVector(evadeVector, this.maxSpeed * dt);
        if (this.stateTimer > 4.0) {
          this.state = 'INGRESS';
        }
        break;
    }

    // Apply Swarm Flocking (Boids algorithm) if member of active swarm
    if (swarmMembers.length > 1 && this.type !== 'bird') {
      this.applySwarmBoids(swarmMembers, dt);
    }

    // Apply kinematic velocity to position
    this.position.addScaledVector(this.velocity, dt);

    // Altitude floor
    if (this.position.y < 12) this.position.y = 12;
  }

  steerTowards(dest, dt) {
    const desired = dest.clone().sub(this.position).normalize().multiplyScalar(this.maxSpeed);
    const steer = desired.sub(this.velocity).clampLength(0, this.maxSpeed * 2.0);
    this.velocity.addScaledVector(steer, dt * 2.5);
  }

  applyBiologicalWander(dt) {
    this.wanderAngle += this.rng.range(-0.5, 0.5) * dt * 4;
    this.velocity.x += Math.sin(this.wanderAngle) * 6 * dt;
    this.velocity.z += Math.cos(this.wanderAngle) * 6 * dt;
    this.velocity.clampLength(this.spec.speedMin, this.spec.speedMax);
  }

  applySwarmBoids(neighbors, dt) {
    const separation = new THREE.Vector3();
    const alignment = new THREE.Vector3();
    const cohesion = new THREE.Vector3();
    let neighborCount = 0;

    const separationDist = 45;
    const neighborDist = 280;

    for (const other of neighbors) {
      if (other.id === this.id || other.state === 'UNSPAWNED' || other.isNeutralized) continue;
      const d = this.position.distanceTo(other.position);

      if (d < separationDist) {
        const diff = this.position.clone().sub(other.position).divideScalar(d || 1);
        separation.add(diff);
      }

      if (d < neighborDist) {
        alignment.add(other.velocity);
        cohesion.add(other.position);
        neighborCount++;
      }
    }

    if (neighborCount > 0) {
      alignment.divideScalar(neighborCount).normalize().multiplyScalar(this.maxSpeed);
      cohesion.divideScalar(neighborCount).sub(this.position).normalize().multiplyScalar(this.maxSpeed);

      this.velocity.addScaledVector(separation.normalize(), dt * 35.0);
      this.velocity.addScaledVector(alignment, dt * 8.0);
      this.velocity.addScaledVector(cohesion, dt * 6.0);
    }
  }

  applyCountermeasure(method) {
    if (method === 'jam') {
      if (this.spec.rfSignature) {
        this.jammedEffect = 1.0;
        return { success: true, text: 'RF C2 link broken. Target forced into spiral failsafe landing.' };
      } else {
        return { success: false, text: 'Jammer ineffective: Target operates without RF broadcast link.' };
      }
    }

    if (method === 'kinetic') {
      this.isNeutralized = true;
      this.neutralizedReason = 'Destroyed by High-Explosive Kinetic CIWS burst';
      this.state = 'NEUTRALIZED';
      return { success: true, text: 'Direct kinetic hit: Target disintegrating mid-air.' };
    }

    if (method === 'capture') {
      this.isNeutralized = true;
      this.neutralizedReason = 'Entangled by Interceptor Net Drone';
      this.state = 'NEUTRALIZED';
      return { success: true, text: 'Net deployed: Target captured intact for forensic analysis.' };
    }

    if (method === 'escalate') {
      return { success: true, text: 'Air Defence Battery alerted; sector missile cue established.' };
    }

    if (method === 'ignore') {
      return { success: true, text: 'Target marked as biological/benign non-threat.' };
    }

    return { success: false, text: 'Unknown countermeasure.' };
  }
}
