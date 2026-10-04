/**
 * 3D Tactical Simulation Scene Manager (Three.js)
 * High-performance, offline-capable 3D environment rendering urban/rural terrain,
 * day/night lighting, weather effects, and defended military assets.
 */

import * as THREE from 'three';

export class SceneManager {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.scene = new THREE.Scene();
    
    // Camera setup (Defended asset command observation deck)
    const aspect = canvasContainer.clientWidth / canvasContainer.clientHeight || 1;
    this.camera = new THREE.PerspectiveCamera(55, aspect, 1, 10000);
    this.camera.position.set(0, 35, 120);
    

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvasContainer.appendChild(this.renderer.domElement);

    // Lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    this.sunLight.position.set(500, 800, 300);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 50;
    this.sunLight.shadow.camera.far = 4000;
    const d = 1200;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);
    // was 0.0012 (fog) / 0.0018 (dust) / 3e-4 (clear)
    this.scene.fog = new Cs(color, 0.0003);

    // Secondary tactical fill light
    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3d3d3d, 0.3);
    this.scene.add(this.hemiLight);

    // Dynamic objects container
    this.terrainGroup = new THREE.Group();
    this.scene.add(this.terrainGroup);

    this.threatsGroup = new THREE.Group();
    this.scene.add(this.threatsGroup);

    this.fxGroup = new THREE.Group();
    this.scene.add(this.fxGroup);

    // Camera look target
    this.cameraTarget = new THREE.Vector3(0, 35, 0);
    this.cameraYaw = 0;
    this.cameraPitch = 0;
    this.cameraMode = 'operator'; // 'operator', 'tactical_overhead', 'track_target'
    this.trackedTargetMesh = null;

    // Defended asset radar dish animation
    this.radarDish = null;

    // Weather particle systems
    this.weatherParticles = null;

    this.initDefendedAsset();
    this.setupWindowResize();
    this.setupMouseLook();
  }

  initDefendedAsset() {
    const baseGroup = new THREE.Group();

    // Central Command Bunker
    const bunkerGeo = new THREE.CylinderGeometry(28, 34, 14, 16);
    const bunkerMat = new THREE.MeshStandardMaterial({
      color: 0x3b444b,
      roughness: 0.85,
      metalness: 0.2
    });
    const bunker = new THREE.Mesh(bunkerGeo, bunkerMat);
    bunker.position.y = 7;
    bunker.receiveShadow = true;
    bunker.castShadow = true;
    baseGroup.add(bunker);

    // Radar Mast Tower
    const mastGeo = new THREE.CylinderGeometry(2, 4, 45, 8);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7 });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.y = 28;
    mast.castShadow = true;
    baseGroup.add(mast);

    // Rotating Radar Dish Antenna
    const dishGeo = new THREE.BoxGeometry(16, 5, 2);
    const dishMat = new THREE.MeshStandardMaterial({
      color: 0x00ffaa,
      emissive: 0x004422,
      roughness: 0.3
    });
    this.radarDish = new THREE.Mesh(dishGeo, dishMat);
    this.radarDish.position.y = 51;
    this.radarDish.castShadow = true;
    baseGroup.add(this.radarDish);

    // Perimeter Defensive Blast Barrier / Hesco Bastions
    const barrierRadius = 80;
    const bastionsCount = 16;
    const bastionGeo = new THREE.BoxGeometry(10, 8, 8);
    const bastionMat = new THREE.MeshStandardMaterial({ color: 0x8a795d, roughness: 0.95 });

    for (let i = 0; i < bastionsCount; i++) {
      const angle = (i / bastionsCount) * Math.PI * 2;
      const b = new THREE.Mesh(bastionGeo, bastionMat);
      b.position.set(Math.cos(angle) * barrierRadius, 4, Math.sin(angle) * barrierRadius);
      b.rotation.y = -angle;
      b.castShadow = true;
      b.receiveShadow = true;
      baseGroup.add(b);
    }

    // Defence Range Marker Dome (Semi-transparent perimeter)
    const domeGeo = new THREE.RingGeometry(75, 80, 32);
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.rotation.x = -Math.PI / 2;
    dome.position.y = 0.5;
    baseGroup.add(dome);

    this.scene.add(baseGroup);
  }

  buildEnvironment(terrainType = 'urban', timeOfDay = 12, weather = 'clear') {
    // Clear existing terrain
    while (this.terrainGroup.children.length > 0) {
      const obj = this.terrainGroup.children[0];
      this.terrainGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    }

    // 1. Sky & Lighting calculation
    const isNight = timeOfDay >= 19 || timeOfDay <= 5;
    const isDuskDawn = (timeOfDay >= 6 && timeOfDay <= 8) || (timeOfDay >= 17 && timeOfDay <= 18);

    if (isNight) {
      this.scene.background = new THREE.Color(0x040812);
      this.ambientLight.intensity = 0.12;
      this.ambientLight.color.setHex(0x18243b);
      this.sunLight.intensity = 0.2; // Moonlight
      this.sunLight.color.setHex(0x6b8cce);
      this.sunLight.position.set(-300, 600, -200);
      this.hemiLight.intensity = 0.1;
    } else if (isDuskDawn) {
      this.scene.background = new THREE.Color(0x2d1b2e);
      this.ambientLight.intensity = 0.35;
      this.ambientLight.color.setHex(0xffaa77);
      this.sunLight.intensity = 0.8;
      this.sunLight.color.setHex(0xff7733);
      this.sunLight.position.set(700, 250, 400);
      this.hemiLight.intensity = 0.25;
    } else {
      this.scene.background = new THREE.Color(0x87ceeb);
      this.ambientLight.intensity = 0.55;
      this.ambientLight.color.setHex(0xffffff);
      this.sunLight.intensity = 1.3;
      this.sunLight.color.setHex(0xfffaed);
      this.sunLight.position.set(500, 900, 350);
      this.hemiLight.intensity = 0.4;
    }

    // 2. Weather Fog
    if (weather === 'fog') {
      const fogColor = isNight ? 0x07111e : 0xc8d6e5;
      this.scene.fog = new THREE.FogExp2(fogColor, 0.0012);
    } else if (weather === 'dust') {
      const dustColor = isNight ? 0x1f140a : 0xbfa17a;
      this.scene.fog = new THREE.FogExp2(dustColor, 0.0018);
    } else {
      this.scene.fog = new THREE.FogExp2(isNight ? 0x040812 : 0x87ceeb, 0.0003);
    }

    // 3. Ground Plane
    const groundGeo = new THREE.PlaneGeometry(6000, 6000, 64, 64);
    let groundMat;

    if (terrainType === 'urban') {
      groundMat = new THREE.MeshStandardMaterial({
        color: 0x24282f,
        roughness: 0.9,
        metalness: 0.1
      });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      this.terrainGroup.add(ground);

      // Procedural Urban Buildings Grid
      this.generateUrbanBuildings();
    } else {
      // Rural / Mountainous Ground
      groundMat = new THREE.MeshStandardMaterial({
        color: 0x475838,
        roughness: 0.95,
        metalness: 0.05
      });
      
      // Deform vertices for rolling hills
      const pos = groundGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const dist = Math.sqrt(vx * vx + vy * vy);
        // Keep base center flat
        if (dist > 250) {
          const hill = Math.sin(vx * 0.003) * Math.cos(vy * 0.003) * 60 +
                       Math.sin(vx * 0.008 + 1.2) * 25;
          pos.setZ(i, hill);
        }
      }
      groundGeo.computeVertexNormals();

      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      this.terrainGroup.add(ground);

      this.generateRuralOutposts();
    }

    // Tactical Grid Rings on Ground
    this.createTacticalRangeRings();
  }

  generateUrbanBuildings() {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x495057,
      roughness: 0.8,
      metalness: 0.2
    });

    const instancedMesh = new THREE.InstancedMesh(boxGeo, buildingMat, 120);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let idx = 0;

    for (let x = -1800; x <= 1800; x += 320) {
      for (let z = -1800; z <= 1800; z += 320) {
        const dist = Math.sqrt(x * x + z * z);
        if (dist < 320) continue; // Keep command perimeter clear

        const width = 60 + (Math.abs(x * z) % 40);
        const depth = 60 + (Math.abs(x + z) % 40);
        const height = 40 + (Math.abs(x * 3 + z * 7) % 180);

        dummy.position.set(x + (Math.sin(z) * 30), height / 2, z + (Math.cos(x) * 30));
        dummy.scale.set(width, height, depth);
        dummy.updateMatrix();

        if (idx < 120) {
          instancedMesh.setMatrixAt(idx++, dummy.matrix);
        }
      }
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(instancedMesh);
  }

  generateRuralOutposts() {
    // Generate observation towers and terrain rock clusters
    const rockGeo = new THREE.DodecahedronGeometry(8, 1);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a554c, roughness: 0.9 });
    const rocksMesh = new THREE.InstancedMesh(rockGeo, rockMat, 60);
    rocksMesh.castShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      const r = 350 + (i * 27) % 1400;
      dummy.position.set(Math.cos(angle) * r, 6, Math.sin(angle) * r);
      dummy.scale.set(1 + (i % 3), 1 + (i % 4), 1 + (i % 2));
      dummy.updateMatrix();
      rocksMesh.setMatrixAt(i, dummy.matrix);
    }
    rocksMesh.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(rocksMesh);
  }

  createTacticalRangeRings() {
    const ringRanges = [500, 1000, 1500, 2000, 2500];
    const ringMat = new THREE.LineBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.25
    });

    ringRanges.forEach(range => {
      const points = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(theta) * range, 2, Math.sin(theta) * range));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, ringMat);
      this.terrainGroup.add(line);
    });
  }

  setupMouseLook() {
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;

    const el = this.renderer.domElement;

    el.addEventListener('mousedown', (e) => {
      if (e.button === 0 || e.button === 2) {
        isDragging = true;
        prevX = e.clientX;
        prevY = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;

      this.cameraYaw -= dx * 0.003;
      this.cameraPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.cameraPitch - dy * 0.003));
      this.updateCameraOrientation();
    });

    el.addEventListener('wheel', (e) => {
      if (this.cameraMode === 'tactical_overhead') {
        this.camera.position.y = Math.max(80, Math.min(1800, this.camera.position.y + e.deltaY * 0.5));
      }
    }, { passive: true });
  }

  setCameraMode(mode = 'operator', targetMesh = null) {
    this.cameraMode = mode;
    this.trackedTargetMesh = targetMesh;

    if (mode === 'operator') {
      this.camera.position.set(0, 42, 0);
      this.updateCameraOrientation();
    } else if (mode === 'tactical_overhead') {
      this.camera.position.set(0, 950, 400);
      this.camera.lookAt(0, 0, 0);
    }
  }

  updateCameraOrientation() {
    if (this.cameraMode !== 'operator') return;
    const targetX = this.camera.position.x + Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * 100;
    const targetY = this.camera.position.y + Math.sin(this.cameraPitch) * 100;
    const targetZ = this.camera.position.z + Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * 100;
    this.camera.lookAt(targetX, targetY, targetZ);
  }

  setupWindowResize() {
    window.addEventListener('resize', () => {
      if (!this.container) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  update(dt, simTime) {
    // Rotate radar antenna dish
    if (this.radarDish) {
      this.radarDish.rotation.y += dt * 3.5; // ~33 RPM
    }

    // Follow target camera mode
    if (this.cameraMode === 'track_target' && this.trackedTargetMesh) {
      const p = this.trackedTargetMesh.position;
      this.camera.position.set(p.x + 30, p.y + 15, p.z + 40);
      this.camera.lookAt(p);
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
