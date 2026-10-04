/**
 * 3D Drone & Threat Mesh Builder
 * Constructs lightweight procedural models for quads, fixed-wings, and decoys.
 * Animates spinning propellers, wing flaps, and destruction particle effects.
 */

import * as THREE from 'three';

export class DroneRenderer {
  constructor(threatsGroup, fxGroup) {
    this.threatsGroup = threatsGroup;
    this.fxGroup = fxGroup;
    this.meshes = new Map(); // id -> { group, type, rotors: [], wings: [] }
    this.explosions = [];
  }

  createThreatMesh(threat) {
    const group = new THREE.Group();
    group.name = threat.id;

    const rotors = [];
    const wings = [];

    if (threat.type === 'bird') {
      // Biological Bird Decoy
      const bodyGeo = new THREE.ConeGeometry(0.8, 2.5, 6);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.rotation.x = Math.PI / 2;
      group.add(body);

      // Flapping Wings
      const wingGeo = new THREE.BoxGeometry(2.8, 0.1, 0.8);
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x2e241c });
      
      const leftWing = new THREE.Mesh(wingGeo, wingMat);
      leftWing.position.set(-1.4, 0.2, 0);
      group.add(leftWing);
      wings.push({ mesh: leftWing, side: -1 });

      const rightWing = new THREE.Mesh(wingGeo, wingMat);
      rightWing.position.set(1.4, 0.2, 0);
      group.add(rightWing);
      wings.push({ mesh: rightWing, side: 1 });

    } else if (threat.type === 'fixed_wing') {
      // Delta-Wing Loitering Munition / Shahed type
      const fuseGeo = new THREE.ConeGeometry(1.4, 6.0, 8);
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b303a, roughness: 0.5, metalness: 0.6 });
      const fuse = new THREE.Mesh(fuseGeo, darkMat);
      fuse.rotation.x = Math.PI / 2;
      fuse.castShadow = true;
      group.add(fuse);

      // Delta Wings
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 2);
      wingShape.lineTo(-5.5, -2.5);
      wingShape.lineTo(5.5, -2.5);
      wingShape.closePath();

      const wingExtrude = new THREE.ExtrudeGeometry(wingShape, { depth: 0.15, bevelEnabled: false });
      const wingMesh = new THREE.Mesh(wingExtrude, darkMat);
      wingMesh.rotation.x = Math.PI / 2;
      wingMesh.position.y = 0.1;
      wingMesh.castShadow = true;
      group.add(wingMesh);

      // Pusher Propeller
      const propGeo = new THREE.BoxGeometry(1.8, 0.1, 0.05);
      const propMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const prop = new THREE.Mesh(propGeo, propMat);
      prop.position.z = -3.1;
      group.add(prop);
      rotors.push(prop);

    } else {
      // Quadcopters (Civilian, Recon, Strike FPV)
      const isStrike = threat.type === 'strike_quad';
      const isRecon = threat.type === 'recon_quad';
      const baseColor = isStrike ? 0x8b0000 : (isRecon ? 0x2f4f4f : 0xdddddd);

      // Central Body
      const bodyGeo = new THREE.BoxGeometry(1.6, 0.5, 1.6);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.4,
        metalness: 0.5
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      group.add(body);

      // 4 Carbon Arms
      const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8);
      const armMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

      const arm1 = new THREE.Mesh(armGeo, armMat);
      arm1.rotation.z = Math.PI / 4;
      arm1.rotation.y = Math.PI / 4;
      group.add(arm1);

      const arm2 = new THREE.Mesh(armGeo, armMat);
      arm2.rotation.z = -Math.PI / 4;
      arm2.rotation.y = Math.PI / 4;
      group.add(arm2);

      // 4 Propellers
      const propPositions = [
        [-1.1, 0.35, -1.1],
        [1.1, 0.35, -1.1],
        [-1.1, 0.35, 1.1],
        [1.1, 0.35, 1.1]
      ];

      const propGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.04, 12);
      const propMat = new THREE.MeshBasicMaterial({
        color: 0x00ffcc,
        transparent: true,
        opacity: 0.6
      });

      propPositions.forEach(p => {
        const prop = new THREE.Mesh(propGeo, propMat);
        prop.position.set(...p);
        group.add(prop);
        rotors.push(prop);
      });

      // Front LED / Camera Eye
      const ledGeo = new THREE.SphereGeometry(0.2, 8, 8);
      const ledMat = new THREE.MeshBasicMaterial({ color: isStrike ? 0xff0000 : 0x00ff00 });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(0, 0, 0.85);
      group.add(led);
    }

    // Tactical Target Selection Bounding Bracket
    const boxHelper = new THREE.BoxHelper(group, 0x00ff88);
    boxHelper.visible = false;
    group.add(boxHelper);

    this.threatsGroup.add(group);
    this.meshes.set(threat.id, { group, type: threat.type, rotors, wings, boxHelper });
    return group;
  }

  updateThreatPosition(threat, isSelected = false) {
    let item = this.meshes.get(threat.id);
    if (!item) {
      this.createThreatMesh(threat);
      item = this.meshes.get(threat.id);
    }

    const { group, boxHelper } = item;
    group.position.copy(threat.position);

    // Orientation towards heading
    if (threat.velocity && threat.velocity.lengthSq() > 0.1) {
      const heading = Math.atan2(threat.velocity.x, threat.velocity.z);
      group.rotation.y = heading;
    }

    boxHelper.visible = isSelected;
  }

  removeThreatMesh(threatId, spawnExplosion = false) {
    const item = this.meshes.get(threatId);
    if (!item) return;

    if (spawnExplosion) {
      this.createExplosion(item.group.position);
    }

    this.threatsGroup.remove(item.group);
    this.meshes.delete(threatId);
  }

  createExplosion(pos) {
    const particleCount = 45;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.2) * 45,
        (Math.random() - 0.5) * 40
      ));
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xff4500,
      size: 4,
      transparent: true,
      opacity: 1.0
    });

    const pSystem = new THREE.Points(geo, mat);
    this.fxGroup.add(pSystem);
    this.explosions.push({ pSystem, velocities, age: 0, maxAge: 1.2 });
  }

  update(dt, simTime) {
    // Animate rotors and bird wings
    for (const item of this.meshes.values()) {
      for (const r of item.rotors) {
        r.rotation.y += dt * 45; // Rapid rotor spin
      }
      for (const w of item.wings) {
        w.mesh.rotation.z = Math.sin(simTime * 14) * 0.45 * w.side; // Flap flap
      }
    }

    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.age += dt;
      const progress = ex.age / ex.maxAge;

      const pos = ex.pSystem.geometry.attributes.position;
      for (let j = 0; j < ex.velocities.length; j++) {
        pos.setX(j, pos.getX(j) + ex.velocities[j].x * dt);
        pos.setY(j, pos.getY(j) + ex.velocities[j].y * dt);
        pos.setZ(j, pos.getZ(j) + ex.velocities[j].z * dt);
        ex.velocities[j].y -= 9.8 * dt * 2.0; // Gravity
      }
      pos.needsUpdate = true;
      ex.pSystem.material.opacity = 1 - progress;

      if (ex.age >= ex.maxAge) {
        this.fxGroup.remove(ex.pSystem);
        ex.pSystem.geometry.dispose();
        ex.pSystem.material.dispose();
        this.explosions.splice(i, 1);
      }
    }
  }

  clear() {
    for (const item of this.meshes.values()) {
      this.threatsGroup.remove(item.group);
    }
    this.meshes.clear();

    for (const ex of this.explosions) {
      this.fxGroup.remove(ex.pSystem);
    }
    this.explosions = [];
  }
}
