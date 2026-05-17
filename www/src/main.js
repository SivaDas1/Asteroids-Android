import * as THREE from 'three';

const canvas = document.getElementById('c');
const uiLayer = document.querySelector('.ui-layer');

const TAU = Math.PI * 2;
const FOV = 58;
const CAMERA_Z = 72;
const SHIP_Z = 24;
const FAR_Z = -150;
const BOSS_Z = -104;
const DESPAWN_Z = SHIP_Z + 16;
const BASE_RAIL_SPEED = 1.55;
const BOOST_RAIL_SPEED = 2.75;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randomRange = (min, max) => Math.random() * (max - min) + min;
const pick = (items) => items[Math.floor(Math.random() * items.length)];

let width = 0;
let height = 0;
let worldWidth = 48;
let worldHeight = 42;
let unitScale = 1;
let renderer = null;
let scene = null;
let camera = null;
let starField = null;
let flightTunnel = null;
let speedLines = null;
let lockMarker = null;
let ship = null;
let asteroids = [];
let bullets = [];
let enemyBullets = [];
let pickups = [];
let particles = [];
let popups = [];
let alienShip = null;
let bossShip = null;
let rafId = 0;

const reusableProjectVector = new THREE.Vector3();
const keys = Object.create(null);
const touch = {
  moveX: 0,
  moveY: 0,
  fire: false,
  boost: false,
  pointerId: null,
};

const state = {
  mode: 'intro',
  score: 0,
  highScore: Number(localStorage.getItem('srHS') || '0'),
  totalCoins: Number(localStorage.getItem('srCoins') || '0'),
  lives: 3,
  wave: 1,
  kills: 0,
  fuel: 100,
  maxFuel: 100,
  ammo: 20,
  maxAmmo: 20,
  shield: 0,
  maxShield: 0,
  bulletCooldown: 0,
  bulletCooldownMax: 12,
  bulletRegenTimer: 0,
  bulletRegenInterval: 260,
  combo: 0,
  comboTimer: 0,
  comboMult: 1,
  powerType: '',
  powerTimer: 0,
  powerDuration: 900,
  alienTimer: 0,
  alienInterval: 1100,
  bossWave: false,
  frame: 0,
  shake: 0,
  shakeX: 0,
  shakeY: 0,
};

let audio = null;
let masterGain = null;
let noiseBuffer = null;

const materials = {};
const geometries = {};

class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(vector) {
    this.x += vector.x;
    this.y += vector.y;
    return this;
  }

  multiply(value) {
    this.x *= value;
    this.y *= value;
    return this;
  }

  limit(max) {
    const mag = this.magnitude();
    if (mag > max) {
      this.multiply(max / mag);
    }
    return this;
  }

  magnitude() {
    return Math.hypot(this.x, this.y);
  }

  copy() {
    return new Vector2(this.x, this.y);
  }

  static fromAngle(angle, length = 1) {
    return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length);
  }
}

class Ship {
  constructor() {
    this.pos = new Vector2(0, -worldHeight * 0.14);
    this.vel = new Vector2();
    this.radius = 1.85 * unitScale;
    this.invincible = 130;
    this.boosting = false;
    this.inputX = 0;
    this.inputY = 0;
    this.group = createShipGroup();
    scene.add(this.group);
    this.syncMesh();
  }

  update() {
    const keyboardX = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    const keyboardY = (keys.ArrowUp || keys.KeyW ? 1 : 0) - (keys.ArrowDown || keys.KeyS ? 1 : 0);
    this.inputX = clamp(keyboardX + touch.moveX, -1, 1);
    this.inputY = clamp(keyboardY + touch.moveY, -1, 1);

    const magnitude = Math.hypot(this.inputX, this.inputY);
    const normalizedX = magnitude > 1 ? this.inputX / magnitude : this.inputX;
    const normalizedY = magnitude > 1 ? this.inputY / magnitude : this.inputY;
    this.boosting = (keys.ShiftLeft || keys.ShiftRight || touch.boost) && state.fuel > 0;

    const acceleration = (this.boosting ? 0.08 : 0.055) * worldHeight;
    const maxSpeed = (this.boosting ? 0.14 : 0.095) * worldHeight;
    if (magnitude > 0.04) {
      this.vel.x += normalizedX * acceleration;
      this.vel.y += normalizedY * acceleration;
      this.vel.limit(maxSpeed);
      if (state.frame % 10 === 0) {
        emitThrust(this);
      }
    }

    if (this.boosting) {
      state.fuel = Math.max(0, state.fuel - (state.powerType === 'double_fuel' ? 0.14 : 0.28));
      if (state.frame % 8 === 0) {
        playSfx('thrust');
      }
    } else {
      state.fuel = Math.min(state.maxFuel, state.fuel + 0.045);
    }

    this.vel.multiply(0.78);
    this.pos.add(this.vel);
    const margin = this.radius * 1.15;
    this.pos.x = clamp(this.pos.x, -worldWidth / 2 + margin, worldWidth / 2 - margin);
    this.pos.y = clamp(this.pos.y, -worldHeight / 2 + margin, worldHeight / 2 - margin);

    if (this.invincible > 0) {
      this.invincible -= 1;
    }
    this.syncMesh();
  }

  syncMesh() {
    const bob = Math.sin(state.frame * 0.065) * 0.1 * unitScale;
    this.group.position.set(this.pos.x, this.pos.y, SHIP_Z + bob);
    this.group.rotation.x = this.inputY * 0.18;
    this.group.rotation.y = -this.inputX * 0.2;
    this.group.rotation.z = -this.inputX * 0.42;
    this.group.userData.flame.visible = this.boosting || Math.hypot(this.inputX, this.inputY) > 0.08;
    this.group.userData.shield.visible = state.shield > 0;
    this.group.visible = !(this.invincible > 0 && Math.floor(state.frame / 6) % 2 === 0);
  }

  shoot() {
    if (state.mode !== 'playing' || state.bulletCooldown > 0) {
      return;
    }

    if (state.ammo <= 0 && state.powerType !== 'infinite_bullets') {
      state.bulletCooldown = 9;
      playSfx('empty');
      return;
    }

    const spread = state.powerType === 'triple_shot' ? [-0.9, 0, 0.9] : [0];
    spread.forEach((offset) => {
      const target = findAutoAimTarget(offset);
      bullets.push(new Bullet(this.pos.x + offset * unitScale, this.pos.y, SHIP_Z - 3.2 * unitScale, offset * 0.018 * worldWidth, 0, -5.4 * unitScale, target));
    });

    if (state.powerType !== 'infinite_bullets') {
      state.ammo -= 1;
    }
    state.bulletCooldown = state.powerType === 'infinite_bullets' || state.powerType === 'triple_shot' ? 5 : state.bulletCooldownMax;
    triggerShake(0.35, 5);
    playSfx('shoot');
  }

  hit() {
    if (this.invincible > 0) {
      return;
    }

    if (state.shield > 0) {
      state.shield -= 1;
      this.invincible = 90;
      createExplosion(this.pos.x, this.pos.y, SHIP_Z, '#00f2ff', 22);
      notify('SHIELD HIT', '#00f2ff');
      triggerShake(1.1, 13);
      playSfx('power');
      return;
    }

    state.lives -= 1;
    createExplosion(this.pos.x, this.pos.y, SHIP_Z, '#ff4d7d', 34);
    triggerShake(1.9, 20);
    playSfx('explosion');

    if (state.lives <= 0) {
      endGame();
      return;
    }

    this.pos = new Vector2(0, -worldHeight * 0.12);
    this.vel = new Vector2();
    this.invincible = 170;
    notify('HULL BREACH', '#ff4d7d');
  }

  remove() {
    scene.remove(this.group);
  }
}

class Bullet {
  constructor(x, y, z, vx, vy, vz, target = null) {
    this.pos = new Vector2(x, y);
    this.z = z;
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.target = target;
    this.radius = 0.42 * unitScale;
    this.life = 60;
    this.mesh = new THREE.Mesh(geometries.bullet, materials.bullet);
    this.mesh.scale.setScalar(this.radius);
    scene.add(this.mesh);
    this.syncMesh();
  }

  update() {
    if (this.target && isTargetAlive(this.target)) {
      const dx = this.target.pos.x - this.pos.x;
      const dy = this.target.pos.y - this.pos.y;
      const dz = this.target.z - this.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      const speed = Math.hypot(this.vx, this.vy, this.vz) || 5.4 * unitScale;
      const steer = 0.18;
      this.vx = THREE.MathUtils.lerp(this.vx, (dx / dist) * speed, steer);
      this.vy = THREE.MathUtils.lerp(this.vy, (dy / dist) * speed, steer);
      this.vz = THREE.MathUtils.lerp(this.vz, (dz / dist) * speed, steer);
    } else {
      this.target = null;
    }

    this.pos.x += this.vx;
    this.pos.y += this.vy;
    this.z += this.vz;
    this.life -= 1;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.pos.x, this.pos.y, this.z);
  }

  remove() {
    scene.remove(this.mesh);
  }
}

class Asteroid {
  constructor(x, y, size = 3, z = FAR_Z, drift = null, speed = null) {
    this.pos = new Vector2(x, y);
    this.z = z;
    this.size = size;
    this.radius = asteroidRadius(size);
    this.drift = drift || new Vector2(randomRange(-0.024, 0.024) * worldWidth, randomRange(-0.02, 0.02) * worldHeight);
    this.speed = speed || randomRange(1.05, 1.72) * unitScale + state.wave * 0.055;
    this.expired = false;
    this.rot = new THREE.Vector3(randomRange(-0.02, 0.02), randomRange(-0.025, 0.025), randomRange(-0.02, 0.02));
    this.group = createAsteroidGroup(this.radius, size);
    scene.add(this.group);
    this.syncMesh();
  }

  split() {
    if (this.size <= 1) {
      return;
    }

    const childSize = this.size - 1;
    const baseSpeed = Math.max(0.95 * unitScale, this.speed * 0.9);
    asteroids.push(new Asteroid(this.pos.x - this.radius * 0.28, this.pos.y, childSize, this.z, new Vector2(this.drift.x - 0.28 * unitScale, this.drift.y + 0.18 * unitScale), baseSpeed));
    asteroids.push(new Asteroid(this.pos.x + this.radius * 0.28, this.pos.y, childSize, this.z, new Vector2(this.drift.x + 0.28 * unitScale, this.drift.y - 0.18 * unitScale), baseSpeed));
  }

  update() {
    this.pos.add(this.drift);
    this.z += this.speed + getRailSpeed() * 0.28;
    this.group.rotation.x += this.rot.x;
    this.group.rotation.y += this.rot.y;
    this.group.rotation.z += this.rot.z;

    const driftLimitX = worldWidth * 0.78;
    const driftLimitY = worldHeight * 0.68;
    if (Math.abs(this.pos.x) > driftLimitX) this.drift.x *= -0.75;
    if (Math.abs(this.pos.y) > driftLimitY) this.drift.y *= -0.75;

    if (this.z > DESPAWN_Z) {
      this.expired = true;
    }
    this.syncMesh();
  }

  syncMesh() {
    this.group.position.set(this.pos.x, this.pos.y, this.z);
  }

  remove() {
    scene.remove(this.group);
  }
}

class AlienShip {
  constructor() {
    this.pos = new Vector2(randomRange(-worldWidth * 0.34, worldWidth * 0.34), randomRange(-worldHeight * 0.12, worldHeight * 0.34));
    this.z = -92;
    this.radius = 2.6 * unitScale;
    this.hitRadius = 3.2 * unitScale;
    this.scoreValue = 600;
    this.life = 820;
    this.phase = randomRange(0, TAU);
    this.shootTimer = 70;
    this.group = createAlienGroup();
    scene.add(this.group);
    this.syncMesh();
  }

  update() {
    this.phase += 0.032;
    this.pos.x += Math.sin(this.phase) * 0.022 * worldWidth;
    this.pos.y += Math.cos(this.phase * 0.7) * 0.014 * worldHeight;
    this.pos.x = clamp(this.pos.x, -worldWidth * 0.42, worldWidth * 0.42);
    this.pos.y = clamp(this.pos.y, -worldHeight * 0.22, worldHeight * 0.38);
    this.group.rotation.z += 0.035;
    this.life -= 1;
    this.shootTimer -= 1;

    if (this.shootTimer <= 0) {
      this.shootTimer = Math.max(45, 92 - state.wave * 4);
      fireEnemyBurst(this, 2, 0.34);
      playSfx('alien');
    }

    if (this.life <= 0) {
      removeAlien();
      return;
    }
    this.syncMesh();
  }

  syncMesh() {
    this.group.position.set(this.pos.x, this.pos.y, this.z);
  }

  remove() {
    scene.remove(this.group);
  }
}

class BossShip {
  constructor() {
    this.pos = new Vector2(0, worldHeight * 0.18);
    this.z = BOSS_Z;
    this.radius = 7 * unitScale;
    this.maxHp = 22 + state.wave * 5;
    this.hp = this.maxHp;
    this.shootTimer = 72;
    this.scoreValue = 3000 + state.wave * 300;
    this.group = createBossGroup();
    scene.add(this.group);
    this.syncMesh();
  }

  update() {
    this.pos.x = Math.sin(state.frame * 0.026) * worldWidth * 0.36;
    this.pos.y = worldHeight * 0.15 + Math.cos(state.frame * 0.019) * worldHeight * 0.13;
    this.group.rotation.y += 0.012;
    this.group.rotation.z += 0.006;
    this.shootTimer -= 1;

    if (this.shootTimer <= 0) {
      this.shootTimer = Math.max(38, 86 - state.wave * 4);
      fireEnemyBurst(this, 5, 0.82);
      playSfx('alien');
    }
    this.syncMesh();
  }

  syncMesh() {
    this.group.position.set(this.pos.x, this.pos.y, this.z);
  }

  remove() {
    scene.remove(this.group);
  }
}

class EnemyBullet {
  constructor(x, y, z, vx, vy, vz) {
    this.pos = new Vector2(x, y);
    this.z = z;
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.radius = 0.72 * unitScale;
    this.life = 170;
    this.mesh = new THREE.Mesh(geometries.enemyBullet, materials.enemyBullet);
    this.mesh.scale.setScalar(this.radius);
    scene.add(this.mesh);
    this.syncMesh();
  }

  update() {
    this.pos.x += this.vx;
    this.pos.y += this.vy;
    this.z += this.vz;
    this.life -= 1;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.pos.x, this.pos.y, this.z);
  }

  remove() {
    scene.remove(this.mesh);
  }
}

class Pickup {
  constructor(x, y, z, type) {
    this.pos = new Vector2(x, y);
    this.z = z;
    this.type = type;
    this.radius = 1.55 * unitScale;
    this.life = 760;
    this.vz = 0.52 * unitScale;
    this.group = createPickupGroup(type);
    scene.add(this.group);
    this.syncMesh();
  }

  update() {
    if (ship) {
      const dx = ship.pos.x - this.pos.x;
      const dy = ship.pos.y - this.pos.y;
      const dz = SHIP_Z - this.z;
      const dist = Math.hypot(dx, dy, dz * 0.45);
      if (dist < 18 * unitScale && dist > 0.01) {
        this.pos.x += (dx / dist) * 0.16 * unitScale;
        this.pos.y += (dy / dist) * 0.16 * unitScale;
        this.vz += (dz / dist) * 0.012 * unitScale;
      }
    }

    this.z += this.vz;
    this.group.rotation.x += 0.025;
    this.group.rotation.y += 0.04;
    this.life -= 1;
    this.syncMesh();
  }

  syncMesh() {
    this.group.position.set(this.pos.x, this.pos.y, this.z);
  }

  remove() {
    scene.remove(this.group);
  }
}

class Particle {
  constructor(x, y, z, color, speed = randomRange(0.15, 0.58) * unitScale) {
    this.pos = new Vector2(x, y);
    this.z = z;
    const angle = randomRange(0, TAU);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.vz = randomRange(-0.7, 0.7) * unitScale;
    this.life = randomRange(24, 48);
    this.maxLife = this.life;
    this.mesh = new THREE.Mesh(geometries.particle, makeParticleMaterial(color));
    this.mesh.scale.setScalar(randomRange(0.13, 0.36) * unitScale);
    scene.add(this.mesh);
    this.syncMesh();
  }

  update() {
    this.pos.x += this.vx;
    this.pos.y += this.vy;
    this.z += this.vz;
    this.vx *= 0.96;
    this.vy *= 0.96;
    this.vz *= 0.96;
    this.life -= 1;
    this.mesh.material.opacity = clamp(this.life / this.maxLife, 0, 1);
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.pos.x, this.pos.y, this.z);
  }

  remove() {
    scene.remove(this.mesh);
    this.mesh.material.dispose();
  }
}

class ScorePopup {
  constructor(x, y, z, text, color = '#ffffff') {
    this.pos = new Vector2(x, y);
    this.z = z;
    this.life = 70;
    this.maxLife = 70;
    this.node = document.createElement('div');
    this.node.className = 'score-popup';
    this.node.textContent = String(text);
    this.node.style.color = color;
    uiLayer?.appendChild(this.node);
    this.update();
  }

  update() {
    this.pos.y += 0.03 * unitScale;
    this.z += 0.08 * unitScale;
    this.life -= 1;
    const screen = worldToScreen(this.pos.x, this.pos.y, this.z);
    this.node.style.opacity = String(clamp(this.life / this.maxLife, 0, 1));
    this.node.style.transform = `translate(${screen.x}px, ${screen.y}px) translate(-50%, -50%)`;
  }

  remove() {
    this.node.remove();
  }
}

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x01030a);
  scene.fog = new THREE.FogExp2(0x01030a, 0.0065);

  camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 700);
  camera.up.set(0, 1, 0);
  setCameraView();

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x01030a, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  scene.add(new THREE.AmbientLight(0x6c8dff, 0.54));
  const cyanLight = new THREE.PointLight(0x00f2ff, 64, 220);
  cyanLight.position.set(-28, 22, 36);
  scene.add(cyanLight);
  const pinkLight = new THREE.PointLight(0xff4dff, 48, 220);
  pinkLight.position.set(28, -22, 28);
  scene.add(pinkLight);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(0, 28, 58);
  scene.add(keyLight);

  buildMaterials();
  createLockMarker();
  resize();
}

function buildMaterials() {
  geometries.bullet = new THREE.SphereGeometry(1, 12, 8);
  geometries.enemyBullet = new THREE.SphereGeometry(1, 12, 8);
  geometries.particle = new THREE.IcosahedronGeometry(1, 0);

  materials.ship = new THREE.MeshStandardMaterial({
    color: 0x0c5cff,
    emissive: 0x002ccf,
    emissiveIntensity: 0.82,
    metalness: 0.46,
    roughness: 0.24,
  });
  materials.shipEdge = new THREE.LineBasicMaterial({ color: 0xff4dff, transparent: true, opacity: 0.95 });
  materials.flame = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.88 });
  materials.shield = new THREE.MeshBasicMaterial({ color: 0x00f2ff, wireframe: true, transparent: true, opacity: 0.34 });
  materials.rock = new THREE.MeshStandardMaterial({
    color: 0x2d3142,
    emissive: 0x7b849d,
    emissiveIntensity: 0.42,
    roughness: 0.86,
    metalness: 0.08,
  });
  materials.rockEdge = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  materials.smallRockEdge = new THREE.LineBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.95 });
  materials.bullet = new THREE.MeshBasicMaterial({ color: 0x9ffbff });
  materials.enemyBullet = new THREE.MeshBasicMaterial({ color: 0xff335f });
  materials.alien = new THREE.MeshStandardMaterial({
    color: 0x102c1b,
    emissive: 0x79ff8b,
    emissiveIntensity: 0.9,
    metalness: 0.36,
    roughness: 0.24,
  });
  materials.alienEdge = new THREE.LineBasicMaterial({ color: 0x79ff8b, transparent: true, opacity: 0.9 });
  materials.boss = new THREE.MeshStandardMaterial({
    color: 0x2a0714,
    emissive: 0xff335f,
    emissiveIntensity: 0.76,
    metalness: 0.45,
    roughness: 0.34,
  });
  materials.bossEdge = new THREE.LineBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.9 });
  materials.grid = new THREE.LineBasicMaterial({ color: 0x154e78, transparent: true, opacity: 0.34 });
  materials.gridHot = new THREE.LineBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.5 });
  materials.speedLine = new THREE.LineBasicMaterial({ color: 0xcfffff, transparent: true, opacity: 0.42 });
  materials.lock = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.9 });
}

function createShipGroup() {
  const group = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([
        0, 0, -2.55,
        -1.35, -0.8, 1.1,
        1.35, -0.8, 1.1,
        0, 1.0, 0.72,
        0, -0.12, 1.55,
      ]),
      3,
    ),
  );
  geometry.setIndex([0, 1, 3, 0, 3, 2, 0, 2, 4, 0, 4, 1, 1, 4, 3, 2, 3, 4]);
  geometry.computeVertexNormals();

  const body = new THREE.Mesh(geometry, materials.ship);
  group.add(body);
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), materials.shipEdge));

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 8), materials.ship);
  canopy.position.set(0, 0.28, -0.28);
  canopy.scale.set(1, 0.72, 1.2);
  group.add(canopy);

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.75, 10), materials.flame);
  flame.rotation.x = Math.PI / 2;
  flame.position.z = 2.1;
  group.add(flame);

  const shield = new THREE.Mesh(new THREE.SphereGeometry(2.35, 18, 10), materials.shield);
  group.add(shield);
  group.scale.setScalar(unitScale);
  group.userData = { flame, shield };
  return group;
}

function createAsteroidGroup(radius, size) {
  const group = new THREE.Group();
  const geometry = makeJaggedRockGeometry(radius);
  const edgeMaterial = size === 1 ? materials.smallRockEdge : materials.rockEdge;
  group.add(new THREE.Mesh(geometry, materials.rock));
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial));
  return group;
}

function makeJaggedRockGeometry(radius) {
  const geometry = new THREE.DodecahedronGeometry(radius, 0);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const vector = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    vector.multiplyScalar(randomRange(0.82, 1.22));
    pos.setXYZ(i, vector.x, vector.y, vector.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createAlienGroup() {
  const group = new THREE.Group();
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 3.05, 0.62, 26), materials.alien);
  saucer.rotation.x = Math.PI / 2;
  group.add(saucer);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.86, 16, 8), materials.alien);
  cockpit.position.z = -0.35;
  cockpit.scale.set(1, 1, 0.52);
  group.add(cockpit);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(saucer.geometry), materials.alienEdge);
  edges.rotation.copy(saucer.rotation);
  group.add(edges);
  group.scale.setScalar(unitScale);
  return group;
}

function createBossGroup() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(4.8, 1), materials.boss);
  core.scale.set(1.45, 0.82, 0.76);
  group.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.8, 0.17, 10, 40), materials.boss);
  group.add(ring);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(core.geometry), materials.bossEdge);
  edges.scale.copy(core.scale);
  group.add(edges);
  group.scale.setScalar(unitScale);
  return group;
}

function createPickupGroup(type) {
  const color = new THREE.Color(pickupColor(type));
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.14,
    roughness: 0.18,
    metalness: 0.24,
  });
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 0), material);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.08, 8, 24), material);
  group.add(core);
  group.add(ring);
  group.scale.setScalar(unitScale);
  group.userData.material = material;
  return group;
}

function createStarField() {
  if (starField) {
    scene.remove(starField);
    starField.geometry.dispose();
  }

  const count = 1500;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = randomRange(-worldWidth * 2.4, worldWidth * 2.4);
    positions[i * 3 + 1] = randomRange(-worldHeight * 2.4, worldHeight * 2.4);
    positions[i * 3 + 2] = randomRange(FAR_Z * 1.8, SHIP_Z + 20);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starField = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.55, transparent: true, opacity: 0.88, sizeAttenuation: true }),
  );
  scene.add(starField);
}

function createFlightTunnel() {
  if (flightTunnel) {
    scene.remove(flightTunnel);
    flightTunnel.traverse((child) => child.geometry?.dispose());
  }

  flightTunnel = new THREE.Group();
  const points = [];
  const addLine = (a, b) => {
    points.push(a.x, a.y, a.z, b.x, b.y, b.z);
  };

  const nearW = worldWidth / 2;
  const nearH = worldHeight / 2;
  const farW = worldWidth * 0.92;
  const farH = worldHeight * 0.82;
  const nearZ = SHIP_Z + 5;
  const farZ = FAR_Z;
  const nearCorners = [
    new THREE.Vector3(-nearW, -nearH, nearZ),
    new THREE.Vector3(nearW, -nearH, nearZ),
    new THREE.Vector3(nearW, nearH, nearZ),
    new THREE.Vector3(-nearW, nearH, nearZ),
  ];
  const farCorners = [
    new THREE.Vector3(-farW, -farH, farZ),
    new THREE.Vector3(farW, -farH, farZ),
    new THREE.Vector3(farW, farH, farZ),
    new THREE.Vector3(-farW, farH, farZ),
  ];

  for (let i = 0; i < 4; i += 1) {
    addLine(nearCorners[i], nearCorners[(i + 1) % 4]);
    addLine(farCorners[i], farCorners[(i + 1) % 4]);
    addLine(nearCorners[i], farCorners[i]);
  }

  for (let i = 1; i <= 12; i += 1) {
    const t = i / 13;
    const z = THREE.MathUtils.lerp(nearZ, farZ, t);
    const w = THREE.MathUtils.lerp(nearW, farW, t);
    const h = THREE.MathUtils.lerp(nearH, farH, t);
    addLine(new THREE.Vector3(-w, -h, z), new THREE.Vector3(w, -h, z));
    addLine(new THREE.Vector3(w, -h, z), new THREE.Vector3(w, h, z));
    addLine(new THREE.Vector3(w, h, z), new THREE.Vector3(-w, h, z));
    addLine(new THREE.Vector3(-w, h, z), new THREE.Vector3(-w, -h, z));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  flightTunnel.add(new THREE.LineSegments(geometry, materials.grid));
  scene.add(flightTunnel);
}

function createSpeedLines() {
  if (speedLines) {
    scene.remove(speedLines);
    speedLines.geometry?.dispose();
  }

  const points = [];
  const count = 120;
  for (let i = 0; i < count; i += 1) {
    const sideBias = Math.random() < 0.56;
    const x = sideBias ? randomRange(-worldWidth * 0.95, worldWidth * 0.95) : randomRange(-worldWidth * 1.5, worldWidth * 1.5);
    const y = sideBias ? randomRange(-worldHeight * 0.95, worldHeight * 0.95) : randomRange(-worldHeight * 1.35, worldHeight * 1.35);
    const z = randomRange(FAR_Z * 1.25, SHIP_Z + 30);
    const length = randomRange(12, 34) * unitScale;
    points.push(x, y, z, x, y, z + length);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  speedLines = new THREE.LineSegments(geometry, materials.speedLine);
  scene.add(speedLines);
}

function createLockMarker() {
  if (lockMarker) {
    scene.remove(lockMarker);
  }

  lockMarker = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 8, 34), materials.lock);
  const crossGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-1.45, 0, 0),
    new THREE.Vector3(-0.72, 0, 0),
    new THREE.Vector3(0.72, 0, 0),
    new THREE.Vector3(1.45, 0, 0),
    new THREE.Vector3(0, -1.45, 0),
    new THREE.Vector3(0, -0.72, 0),
    new THREE.Vector3(0, 0.72, 0),
    new THREE.Vector3(0, 1.45, 0),
  ]);
  const cross = new THREE.LineSegments(crossGeometry, materials.gridHot);
  lockMarker.add(ring);
  lockMarker.add(cross);
  lockMarker.visible = false;
  scene.add(lockMarker);
}

function makeParticleMaterial(color) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
}

function initAudio() {
  if (audio) {
    if (audio.state === 'suspended') {
      audio.resume();
    }
    return;
  }

  try {
    audio = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audio.createGain();
    masterGain.gain.value = 0.24;
    masterGain.connect(audio.destination);

    noiseBuffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = Math.random() * 2 - 1;
    }
  } catch {
    audio = null;
  }
}

function playSfx(type) {
  if (!audio || !masterGain) {
    return;
  }

  const now = audio.currentTime;
  const gain = audio.createGain();
  gain.connect(masterGain);

  if (type === 'shoot') {
    const osc = audio.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(820, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.09);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.12);
  } else if (type === 'explosion') {
    const src = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    src.buffer = noiseBuffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + 0.45);
    gain.gain.setValueAtTime(0.36, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    src.connect(filter);
    filter.connect(gain);
    src.start(now);
    src.stop(now + 0.5);
  } else if (type === 'power') {
    [520, 740, 1040].forEach((freq, index) => {
      const osc = audio.createOscillator();
      const stepGain = audio.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * 0.07);
      stepGain.gain.setValueAtTime(0.14, now + index * 0.07);
      stepGain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.07 + 0.16);
      osc.connect(stepGain);
      stepGain.connect(masterGain);
      osc.start(now + index * 0.07);
      osc.stop(now + index * 0.07 + 0.17);
    });
  } else if (type === 'alien') {
    const osc = audio.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(320, now + 0.35);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.43);
  } else if (type === 'thrust') {
    const src = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    src.buffer = noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(140, now);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    src.connect(filter);
    filter.connect(gain);
    src.start(now);
    src.stop(now + 0.08);
  } else if (type === 'empty') {
    const osc = audio.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.07);
  }
}

function setCameraView(shakeX = 0, shakeY = 0) {
  if (!camera) {
    return;
  }

  const followX = ship ? ship.pos.x * 0.14 : 0;
  const followY = ship ? ship.pos.y * 0.12 : 0;
  camera.up.set(0, 1, 0);
  camera.position.set(followX + shakeX, followY + shakeY, CAMERA_Z);
  camera.lookAt(followX * 0.2, followY * 0.18, -72);
  camera.updateMatrixWorld();
}

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.fov = FOV;
  camera.updateProjectionMatrix();

  const shipPlaneHeight = 2 * Math.tan(THREE.MathUtils.degToRad(FOV * 0.5)) * (CAMERA_Z - SHIP_Z);
  worldHeight = clamp(shipPlaneHeight * 0.8, 36, 52);
  worldWidth = clamp(shipPlaneHeight * camera.aspect * 0.82, 28, 88);
  unitScale = clamp(worldHeight / 44, 0.78, 1.16);

  createStarField();
  createFlightTunnel();
  createSpeedLines();
  if (ship) {
    ship.radius = 1.85 * unitScale;
    ship.group.scale.setScalar(unitScale);
    ship.syncMesh();
  }
}

function worldToScreen(x, y, z) {
  reusableProjectVector.set(x, y, z).project(camera);
  return {
    x: (reusableProjectVector.x * 0.5 + 0.5) * width,
    y: (-reusableProjectVector.y * 0.5 + 0.5) * height,
  };
}

function asteroidRadius(size) {
  return [0, 1.55, 2.75, 4.25][size] * unitScale;
}

function pickupColor(type) {
  return {
    fuel: '#ffcc00',
    ammo: '#00f2ff',
    shield: '#79ff8b',
    repair: '#ff6688',
    triple_shot: '#ff4dff',
    infinite_bullets: '#ffffff',
    double_fuel: '#ffcc00',
  }[type] || '#ffffff';
}

function fieldPoint(edgePadding = 0) {
  return {
    x: randomRange(-worldWidth / 2 + edgePadding, worldWidth / 2 - edgePadding),
    y: randomRange(-worldHeight / 2 + edgePadding, worldHeight / 2 - edgePadding),
  };
}

function lateralDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getRailSpeed() {
  const boost = ship?.boosting ? BOOST_RAIL_SPEED : BASE_RAIL_SPEED;
  const waveRamp = Math.min(0.55, state.wave * 0.055);
  return (state.mode === 'playing' ? boost + waveRamp : BASE_RAIL_SPEED * 0.52) * unitScale;
}

function isTargetAlive(target) {
  return target === bossShip || target === alienShip || asteroids.includes(target);
}

function findAutoAimTarget(offset = 0) {
  if (!ship || state.mode !== 'playing') {
    return null;
  }

  const origin = {
    x: ship.pos.x + offset * unitScale,
    y: ship.pos.y,
    z: SHIP_Z - 3.2 * unitScale,
  };
  const candidates = [];
  asteroids.forEach((asteroid) => candidates.push({ entity: asteroid, radius: asteroid.radius, priority: 0 }));
  if (alienShip) candidates.push({ entity: alienShip, radius: alienShip.hitRadius, priority: -9 });
  if (bossShip) candidates.push({ entity: bossShip, radius: bossShip.radius, priority: -14 });

  let best = null;
  let bestScore = Infinity;
  candidates.forEach(({ entity, radius, priority }) => {
    if (!entity || entity.z >= origin.z - 4 * unitScale) {
      return;
    }

    const depth = Math.abs(entity.z - origin.z);
    const lateral = Math.hypot(entity.pos.x - origin.x, entity.pos.y - origin.y);
    const lockCone = 9 * unitScale + depth * 0.22 + radius * 0.85;
    if (lateral > lockCone) {
      return;
    }

    const score = lateral * 1.25 + depth * 0.025 - radius * 0.65 + priority;
    if (score < bestScore) {
      bestScore = score;
      best = entity;
    }
  });

  return best;
}

function updateLockMarker() {
  if (!lockMarker) {
    return;
  }

  const target = findAutoAimTarget(0);
  if (!target) {
    lockMarker.visible = false;
    return;
  }

  const size = Math.max(2.3 * unitScale, (target.radius || 2) * 1.36);
  lockMarker.visible = true;
  lockMarker.position.set(target.pos.x, target.pos.y, target.z);
  lockMarker.scale.setScalar(size);
  lockMarker.lookAt(camera.position);
}

function fireEnemyBurst(source, count, spread) {
  if (!ship) {
    return;
  }

  for (let i = 0; i < count; i += 1) {
    const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread;
    const targetX = ship.pos.x + offset * worldWidth * 0.16;
    const targetY = ship.pos.y + Math.sin(i + state.frame * 0.02) * worldHeight * 0.06;
    const dx = targetX - source.pos.x;
    const dy = targetY - source.pos.y;
    const dz = SHIP_Z - source.z;
    const dist = Math.hypot(dx, dy, dz) || 1;
    const speed = (1.22 + state.wave * 0.045) * unitScale;
    enemyBullets.push(new EnemyBullet(source.pos.x, source.pos.y, source.z + 2 * unitScale, (dx / dist) * speed, (dy / dist) * speed, (dz / dist) * speed));
  }
}

function createWave() {
  clearEntityList(asteroids);
  clearEntityList(bullets);
  clearEntityList(enemyBullets);
  clearEntityList(pickups);
  clearEntityList(particles);
  clearEntityList(popups);
  removeAlien();
  removeBoss();
  state.kills = 0;
  state.alienTimer = 0;
  state.alienInterval = Math.max(500, 1180 - state.wave * 34);
  state.bossWave = state.wave % 5 === 0;

  const count = state.bossWave ? Math.min(6 + Math.floor(state.wave / 2), 11) : Math.min(7 + state.wave, 16);
  for (let i = 0; i < count; i += 1) {
    spawnIncomingAsteroid(3, FAR_Z - i * randomRange(6, 11));
  }

  if (state.bossWave) {
    bossShip = new BossShip();
    notify(`BOSS WAVE ${state.wave}`, '#ff335f');
  } else {
    notify(`WAVE ${state.wave}`, '#00f2ff');
  }
}

function spawnIncomingAsteroid(size, z = FAR_Z) {
  const point = fieldPoint(3 * unitScale);
  asteroids.push(new Asteroid(point.x, point.y, size, z));
}

function clearEntityList(list) {
  while (list.length) {
    const entity = list.pop();
    entity.remove?.();
  }
}

function removeAlien() {
  if (alienShip) {
    alienShip.remove();
    alienShip = null;
  }
}

function removeBoss() {
  if (bossShip) {
    bossShip.remove();
    bossShip = null;
  }
}

function showScreen(id) {
  document.querySelectorAll('.game-screen').forEach((screen) => screen.classList.add('hidden'));
  const screen = document.getElementById(id);
  if (screen) {
    screen.classList.remove('hidden');
  }

  const playing = id === 'none';
  document.getElementById('hud')?.classList.toggle('hidden', !playing);
  ['jz', 'fb', 'hb'].forEach((controlId) => {
    document.getElementById(controlId)?.classList.toggle('hidden', !playing);
  });
}

function bootSequence() {
  state.mode = 'intro';
  showScreen('introScreen');

  const log = document.getElementById('aiLog');
  const prompt = document.getElementById('bootPrompt');
  const lines = ['[SYNC] 3D FLIGHT CORRIDOR ONLINE', '[READY] HORIZONTAL / VERTICAL CONTROL ACTIVE'];
  let index = 0;

  const interval = window.setInterval(() => {
    if (index < lines.length) {
      if (log) {
        log.innerHTML += `${lines[index]}<br>`;
      }
      index += 1;
      return;
    }

    window.clearInterval(interval);
    if (prompt) {
      prompt.style.opacity = '1';
    }
  }, 420);

  document.getElementById('introScreen')?.addEventListener(
    'pointerdown',
    () => {
      initAudio();
      showMenu();
    },
    { once: true },
  );
}

function showMenu() {
  state.mode = 'menu';
  showScreen('startScreen');
  updateGarageUI();
  updateMenuUI();
}

function startGame() {
  initAudio();
  clearEntityList(asteroids);
  clearEntityList(bullets);
  clearEntityList(enemyBullets);
  clearEntityList(pickups);
  clearEntityList(particles);
  clearEntityList(popups);
  removeAlien();
  removeBoss();

  const hullLevel = Number(localStorage.getItem('srHull') || '0');
  const ammoLevel = Number(localStorage.getItem('srAmmo') || '0');
  const fuelLevel = Number(localStorage.getItem('srFuel') || '0');
  const shieldLevel = Number(localStorage.getItem('srShield') || '0');

  state.mode = 'playing';
  state.score = 0;
  state.lives = 3 + hullLevel;
  state.wave = 1;
  state.maxFuel = 100 + fuelLevel * 20;
  state.fuel = state.maxFuel;
  state.maxAmmo = 20 + ammoLevel * 6;
  state.ammo = state.maxAmmo;
  state.maxShield = shieldLevel;
  state.shield = Math.min(shieldLevel, 1);
  state.bulletCooldown = 0;
  state.bulletCooldownMax = 12;
  state.combo = 0;
  state.comboTimer = 0;
  state.comboMult = 1;
  state.powerType = '';
  state.powerTimer = 0;
  state.frame = 0;

  if (ship) {
    ship.remove();
  }
  ship = new Ship();
  createWave();
  showScreen('none');
  updateUI();
}

function endGame() {
  state.mode = 'gameover';
  state.highScore = Math.max(state.highScore, state.score);
  localStorage.setItem('srHS', String(state.highScore));
  localStorage.setItem('srCoins', String(state.totalCoins));

  const finalScore = document.getElementById('finalScore');
  if (finalScore) {
    finalScore.textContent = String(state.score);
  }
  showScreen('gameOverScreen');
  updateMenuUI();
}

function updatePlaying() {
  ship.update();

  if (keys.Space || touch.fire) {
    ship.shoot();
  }

  if (state.bulletCooldown > 0) {
    state.bulletCooldown -= 1;
  }

  state.bulletRegenTimer += 1;
  if (state.bulletRegenTimer >= state.bulletRegenInterval) {
    state.bulletRegenTimer = 0;
    if (state.ammo < state.maxAmmo && state.powerType !== 'infinite_bullets') {
      state.ammo += 1;
      popups.push(new ScorePopup(ship.pos.x, ship.pos.y + 2.7 * unitScale, SHIP_Z - 2, 'AMMO +1', '#00f2ff'));
    }
  }

  if (state.comboTimer > 0) {
    state.comboTimer -= 1;
  } else {
    state.combo = 0;
    state.comboMult = 1;
  }

  if (state.powerType) {
    state.powerTimer -= 1;
    if (state.powerTimer <= 0) {
      notify('POWER DOWN', '#ffcc00');
      state.powerType = '';
      state.bulletCooldownMax = 12;
    }
  }

  updateAlien();
  updateBoss();
  updateObjects();
  checkCollisions();
  removeExpiredAsteroids();

  if (asteroids.length === 0 && !bossShip && state.mode === 'playing') {
    state.wave += 1;
    state.fuel = Math.min(state.maxFuel, state.fuel + 35);
    state.ammo = Math.min(state.maxAmmo, state.ammo + 4);
    state.shield = Math.min(state.maxShield, state.shield + 1);
    createWave();
  }
}

function updateAlien() {
  if (state.bossWave) {
    return;
  }

  if (alienShip) {
    alienShip.update();
    return;
  }

  state.alienTimer += 1;
  if (state.alienTimer >= state.alienInterval) {
    state.alienTimer = 0;
    alienShip = new AlienShip();
    notify('ALIEN SIGNAL', '#79ff8b');
    playSfx('alien');
  }
}

function updateBoss() {
  if (bossShip) {
    bossShip.update();
  }
}

function updateObjects() {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    bullets[i].update();
    if (bullets[i].life <= 0 || bullets[i].z < FAR_Z - 35) {
      bullets[i].remove();
      bullets.splice(i, 1);
    }
  }

  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    enemyBullets[i].update();
    if (enemyBullets[i].life <= 0 || enemyBullets[i].z > DESPAWN_Z) {
      enemyBullets[i].remove();
      enemyBullets.splice(i, 1);
    }
  }

  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    pickups[i].update();
    if (pickups[i].life <= 0 || pickups[i].z > DESPAWN_Z) {
      pickups[i].remove();
      pickups.splice(i, 1);
    }
  }

  asteroids.forEach((asteroid) => asteroid.update());

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    particles[i].update();
    if (particles[i].life <= 0) {
      particles[i].remove();
      particles.splice(i, 1);
    }
  }

  for (let i = popups.length - 1; i >= 0; i -= 1) {
    popups[i].update();
    if (popups[i].life <= 0) {
      popups[i].remove();
      popups.splice(i, 1);
    }
  }

  updateShake();
}

function checkCollisions() {
  if (!ship || state.mode !== 'playing') {
    return;
  }

  if (ship.invincible <= 0) {
    for (const asteroid of asteroids) {
      const closeInDepth = Math.abs(asteroid.z - SHIP_Z) < asteroid.radius + ship.radius + 1.5 * unitScale;
      if (closeInDepth && lateralDistance(ship.pos, asteroid.pos) < ship.radius + asteroid.radius * 0.82) {
        ship.hit();
        asteroid.expired = true;
        break;
      }
    }

    if (alienShip && Math.abs(alienShip.z - SHIP_Z) < alienShip.hitRadius + ship.radius && lateralDistance(ship.pos, alienShip.pos) < ship.radius + alienShip.hitRadius) {
      ship.hit();
      createExplosion(alienShip.pos.x, alienShip.pos.y, alienShip.z, '#79ff8b', 18);
      removeAlien();
    }

    if (bossShip && Math.abs(bossShip.z - SHIP_Z) < bossShip.radius + ship.radius && lateralDistance(ship.pos, bossShip.pos) < ship.radius + bossShip.radius * 0.75) {
      ship.hit();
    }

    for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
      const bullet = enemyBullets[i];
      if (Math.abs(bullet.z - SHIP_Z) < ship.radius + bullet.radius + 1 && lateralDistance(ship.pos, bullet.pos) < ship.radius + bullet.radius) {
        bullet.remove();
        enemyBullets.splice(i, 1);
        ship.hit();
        break;
      }
    }
  }

  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const pickup = pickups[i];
    if (Math.abs(pickup.z - SHIP_Z) < ship.radius + pickup.radius + 2 && lateralDistance(ship.pos, pickup.pos) < ship.radius + pickup.radius + 0.6 * unitScale) {
      collectPickup(pickup);
      pickup.remove();
      pickups.splice(i, 1);
    }
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    let consumed = false;

    for (let j = asteroids.length - 1; j >= 0; j -= 1) {
      const asteroid = asteroids[j];
      if (Math.abs(bullet.z - asteroid.z) < Math.max(2.2 * unitScale, asteroid.radius * 1.2) && lateralDistance(bullet.pos, asteroid.pos) < asteroid.radius + bullet.radius) {
        bullet.remove();
        bullets.splice(i, 1);
        destroyAsteroid(j);
        consumed = true;
        break;
      }
    }

    if (consumed) {
      continue;
    }

    if (alienShip && Math.abs(bullet.z - alienShip.z) < alienShip.hitRadius + 2 * unitScale && lateralDistance(bullet.pos, alienShip.pos) < alienShip.hitRadius) {
      bullet.remove();
      bullets.splice(i, 1);
      destroyAlien();
      continue;
    }

    if (bossShip && Math.abs(bullet.z - bossShip.z) < bossShip.radius + 2 * unitScale && lateralDistance(bullet.pos, bossShip.pos) < bossShip.radius) {
      bullet.remove();
      bullets.splice(i, 1);
      damageBoss(bullet.pos.x, bullet.pos.y, bullet.z);
    }
  }
}

function removeExpiredAsteroids() {
  for (let i = asteroids.length - 1; i >= 0; i -= 1) {
    if (asteroids[i].expired) {
      asteroids[i].remove();
      asteroids.splice(i, 1);
    }
  }
}

function destroyAsteroid(index) {
  const asteroid = asteroids[index];
  asteroid.split();
  asteroids.splice(index, 1);

  const points = (4 - asteroid.size) * 100;
  registerScore(points, asteroid.pos.x, asteroid.pos.y, asteroid.z);
  createExplosion(asteroid.pos.x, asteroid.pos.y, asteroid.z, asteroid.size === 1 ? '#ffcc00' : '#ffffff', 13 + asteroid.size * 4);
  triggerShake(0.22 * asteroid.size, 7 + asteroid.size * 2);
  playSfx('explosion');

  if (asteroid.size === 3) {
    state.fuel = Math.min(state.maxFuel, state.fuel + 26);
    popups.push(new ScorePopup(asteroid.pos.x, asteroid.pos.y + 2.3 * unitScale, asteroid.z, 'FUEL +26', '#ffcc00'));
  }

  if (state.powerType !== 'infinite_bullets') {
    state.ammo = Math.min(state.maxAmmo, state.ammo + 1);
    popups.push(new ScorePopup(asteroid.pos.x, asteroid.pos.y - 2.3 * unitScale, asteroid.z, 'AMMO +1', '#00f2ff'));
  }

  const dropChance = asteroid.size === 3 ? 0.3 : asteroid.size === 2 ? 0.18 : 0.08;
  if (Math.random() < dropChance) {
    spawnPickup(asteroid.pos.x, asteroid.pos.y, asteroid.z);
  }

  asteroid.remove();
}

function destroyAlien() {
  if (!alienShip) {
    return;
  }

  const { x, y } = alienShip.pos;
  const z = alienShip.z;
  registerScore(alienShip.scoreValue, x, y, z);
  createExplosion(x, y, z, '#79ff8b', 28);
  triggerShake(1.2, 16);
  removeAlien();
  activatePower(Math.random() < 0.5 ? 'double_fuel' : 'infinite_bullets', x, y, z);
}

function damageBoss(x, y, z) {
  if (!bossShip) {
    return;
  }

  bossShip.hp -= state.powerType === 'triple_shot' ? 2 : 1;
  createExplosion(x, y, z, '#ff335f', 4);
  triggerShake(0.35, 5);

  if (bossShip.hp <= 0) {
    const bx = bossShip.pos.x;
    const by = bossShip.pos.y;
    const bz = bossShip.z;
    registerScore(bossShip.scoreValue, bx, by, bz);
    createExplosion(bx, by, bz, '#ff335f', 58);
    createExplosion(bx, by, bz, '#ffcc00', 38);
    triggerShake(2.2, 28);
    playSfx('explosion');
    pickups.push(new Pickup(bx, by, bz + 8 * unitScale, 'shield'));
    pickups.push(new Pickup(bx + 3.1 * unitScale, by, bz + 8 * unitScale, 'triple_shot'));
    removeBoss();
    clearEntityList(enemyBullets);
    notify('BOSS DESTROYED', '#ffcc00');
  }
}

function spawnPickup(x, y, z) {
  const roll = Math.random();
  let type = 'fuel';
  if (roll > 0.78) type = 'triple_shot';
  else if (roll > 0.62) type = 'shield';
  else if (roll > 0.46) type = 'repair';
  else if (roll > 0.24) type = 'ammo';
  pickups.push(new Pickup(x, y, z, type));
}

function collectPickup(pickup) {
  if (pickup.type === 'fuel') {
    state.fuel = state.maxFuel;
    popups.push(new ScorePopup(pickup.pos.x, pickup.pos.y, pickup.z, 'FUEL FULL', '#ffcc00'));
  } else if (pickup.type === 'ammo') {
    state.ammo = state.maxAmmo;
    popups.push(new ScorePopup(pickup.pos.x, pickup.pos.y, pickup.z, 'AMMO FULL', '#00f2ff'));
  } else if (pickup.type === 'shield') {
    state.shield = Math.min(state.maxShield || 1, state.shield + 1);
    popups.push(new ScorePopup(pickup.pos.x, pickup.pos.y, pickup.z, 'SHIELD +1', '#79ff8b'));
  } else if (pickup.type === 'repair') {
    state.lives += 1;
    popups.push(new ScorePopup(pickup.pos.x, pickup.pos.y, pickup.z, 'LIFE +1', '#ff6688'));
  } else {
    activatePower(pickup.type, pickup.pos.x, pickup.pos.y, pickup.z);
  }

  playSfx('power');
}

function activatePower(type, x, y, z) {
  state.powerType = type;
  state.powerTimer = state.powerDuration;

  if (type === 'double_fuel') {
    state.fuel = state.maxFuel;
    popups.push(new ScorePopup(x, y + 3.6 * unitScale, z, 'DOUBLE FUEL', '#ffcc00'));
  } else if (type === 'infinite_bullets') {
    state.bulletCooldownMax = 5;
    popups.push(new ScorePopup(x, y + 3.6 * unitScale, z, 'INFINITE AMMO', '#00f2ff'));
  } else if (type === 'triple_shot') {
    state.bulletCooldownMax = 5;
    popups.push(new ScorePopup(x, y + 3.6 * unitScale, z, 'TRIPLE SHOT', '#ff4dff'));
  }

  notify({
    double_fuel: 'DOUBLE FUEL',
    infinite_bullets: 'INFINITE AMMO',
    triple_shot: 'TRIPLE SHOT',
  }[type] || 'POWER UP', pickupColor(type));
  playSfx('power');
}

function registerScore(points, x, y, z) {
  state.kills += 1;
  state.combo = state.comboTimer > 0 ? state.combo + 1 : 1;
  state.comboTimer = 180;
  state.comboMult = 1 + Math.floor((state.combo - 1) / 5);

  const total = points * state.comboMult;
  state.score += total;
  state.totalCoins += Math.max(1, Math.floor(points / 100));
  popups.push(new ScorePopup(x, y, z, state.comboMult > 1 ? `${total} x${state.comboMult}` : total, '#ffffff'));
}

function emitThrust(source) {
  const particle = new Particle(source.pos.x + randomRange(-0.45, 0.45) * unitScale, source.pos.y + randomRange(-0.3, 0.3) * unitScale, SHIP_Z + 2.1 * unitScale, '#ffcc00', randomRange(0.06, 0.16) * unitScale);
  particle.vz = randomRange(0.45, 0.9) * unitScale;
  particle.life = randomRange(10, 18);
  particle.maxLife = particle.life;
  particles.push(particle);
}

function createExplosion(x, y, z, color, count) {
  for (let i = 0; i < count; i += 1) {
    particles.push(new Particle(x, y, z, color));
  }
}

function triggerShake(intensity, duration) {
  state.shake = Math.max(state.shake, duration);
  state.shakeX = Math.max(state.shakeX, intensity * unitScale);
  state.shakeY = Math.max(state.shakeY, intensity * unitScale);
}

function updateShake() {
  if (state.shake > 0) {
    state.shake -= 1;
    state.shakeX *= 0.88;
    state.shakeY *= 0.88;
  } else {
    state.shakeX = 0;
    state.shakeY = 0;
  }
}

function notify(text, color = '#00f2ff') {
  const node = document.getElementById('n');
  if (!node) {
    return;
  }

  node.textContent = text;
  node.style.color = color;
  node.style.opacity = '1';
  clearTimeout(node._timer);
  node._timer = window.setTimeout(() => {
    node.style.opacity = '0';
  }, 900);
}

function updateMenuUI() {
  const high = document.getElementById('highScoreDisplay');
  const coins = document.getElementById('totalCoinsDisplay');
  if (high) high.textContent = String(state.highScore);
  if (coins) coins.textContent = String(state.totalCoins);
}

function updateGarageUI() {
  const hull = Number(localStorage.getItem('srHull') || '0');
  const ammo = Number(localStorage.getItem('srAmmo') || '0');
  const fuel = Number(localStorage.getItem('srFuel') || '0');
  const shield = Number(localStorage.getItem('srShield') || '0');

  const hpNode = document.getElementById('hpLevel');
  const ammoNode = document.getElementById('ammoLevel');
  const fuelNode = document.getElementById('fuelLevel');
  const shieldNode = document.getElementById('shieldLevel');
  if (hpNode) hpNode.textContent = `LVL: ${hull}`;
  if (ammoNode) ammoNode.textContent = `LVL: ${ammo}`;
  if (fuelNode) fuelNode.textContent = `LVL: ${fuel}`;
  if (shieldNode) shieldNode.textContent = `LVL: ${shield}`;
}

function buyUpgrade(key, baseCost) {
  const level = Number(localStorage.getItem(key) || '0');
  const cost = Math.floor(baseCost * (level + 1) * 1.45);
  if (state.totalCoins < cost) {
    notify(`NEED ${cost} COINS`, '#ff335f');
    return;
  }

  state.totalCoins -= cost;
  localStorage.setItem('srCoins', String(state.totalCoins));
  localStorage.setItem(key, String(level + 1));
  updateGarageUI();
  updateMenuUI();
  notify('UPGRADE INSTALLED', '#79ff8b');
  playSfx('power');
}

function updateUI() {
  const score = document.getElementById('s');
  const wave = document.getElementById('w');
  const rocks = document.getElementById('k');
  const lives = document.getElementById('l');
  const high = document.getElementById('h');
  const power = document.getElementById('p');
  const fuel = document.getElementById('f');
  const ammo = document.getElementById('a');
  const shield = document.getElementById('sh');
  const boss = document.getElementById('bossUI');
  const bossFill = document.getElementById('bossFill');
  const combo = document.getElementById('comboUI');
  const comboMult = document.getElementById('comboMult');

  if (score) score.textContent = String(state.score).padStart(6, '0');
  if (wave) wave.textContent = `WAVE ${state.wave}`;
  if (rocks) rocks.textContent = `ROCKS ${asteroids.length}`;
  if (lives) lives.textContent = `LIVES: ${state.lives}`;
  if (high) high.textContent = `HI ${state.highScore}`;
  if (fuel) fuel.style.width = `${clamp((state.fuel / state.maxFuel) * 100, 0, 100)}%`;
  if (ammo) ammo.style.width = `${clamp((state.ammo / state.maxAmmo) * 100, 0, 100)}%`;
  if (shield) {
    const max = Math.max(1, state.maxShield);
    shield.style.width = `${clamp((state.shield / max) * 100, 0, 100)}%`;
  }

  if (power) {
    if (state.powerType) {
      const label = state.powerType === 'double_fuel' ? 'DOUBLE FUEL' : state.powerType === 'triple_shot' ? 'TRIPLE SHOT' : 'INFINITE AMMO';
      power.textContent = `${label} ${Math.ceil(state.powerTimer / 60)}S`;
    } else {
      power.textContent = 'POWER --';
    }
  }

  if (boss && bossFill) {
    boss.classList.toggle('hidden', !bossShip);
    if (bossShip) {
      bossFill.style.width = `${clamp((bossShip.hp / bossShip.maxHp) * 100, 0, 100)}%`;
    }
  }

  if (combo && comboMult) {
    combo.style.display = state.comboMult > 1 ? 'block' : 'none';
    comboMult.textContent = String(state.comboMult);
  }
}

function renderScene() {
  const railSpeed = getRailSpeed();
  if (starField) {
    starField.rotation.z += 0.00035 + railSpeed * 0.00008;
    starField.position.z = ((state.frame * railSpeed * 0.72) % 40) * unitScale;
  }
  if (flightTunnel) {
    flightTunnel.position.z = ((state.frame * railSpeed * 0.92) % 14) * unitScale;
  }
  if (speedLines) {
    speedLines.visible = state.mode === 'playing';
    speedLines.position.z = ((state.frame * railSpeed * 2.8) % 48) * unitScale;
    materials.speedLine.opacity = clamp(0.24 + railSpeed * 0.11, 0.32, 0.72);
  }
  if (camera) {
    const targetFov = FOV + (state.mode === 'playing' ? (ship?.boosting ? 10 : 4.5) : 0);
    camera.fov += (targetFov - camera.fov) * 0.08;
    camera.updateProjectionMatrix();
  }
  updateLockMarker();

  const shakeX = state.shake > 0 ? randomRange(-state.shakeX, state.shakeX) : 0;
  const shakeY = state.shake > 0 ? randomRange(-state.shakeY, state.shakeY) : 0;
  setCameraView(shakeX, shakeY);
  renderer.render(scene, camera);

  if (state.mode === 'paused') {
    notify('PAUSED', '#ffffff');
  }
}

function loop() {
  state.frame += 1;
  if (state.mode === 'playing') {
    updatePlaying();
  } else {
    updateObjects();
  }
  updateUI();
  renderScene();
  rafId = requestAnimationFrame(loop);
}

function setupTouch() {
  const joystick = document.getElementById('jz');
  const knob = document.getElementById('jk');
  const fireButton = document.getElementById('fb');
  const boostButton = document.getElementById('hb');

  const resetStick = () => {
    touch.moveX = 0;
    touch.moveY = 0;
    touch.pointerId = null;
    if (knob) {
      knob.style.transform = 'translate(0px, 0px)';
    }
  };

  const updateStick = (event) => {
    if (!joystick || !knob) return;
    const rect = joystick.getBoundingClientRect();
    const max = rect.width * 0.36;
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const mag = Math.hypot(dx, dy) || 1;
    const limited = Math.min(max, mag);
    const x = (dx / mag) * limited;
    const y = (dy / mag) * limited;
    touch.moveX = clamp(dx / max, -1, 1);
    touch.moveY = clamp(-dy / max, -1, 1);
    knob.style.transform = `translate(${x}px, ${y}px)`;
  };

  joystick?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    initAudio();
    touch.pointerId = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    updateStick(event);
  });

  joystick?.addEventListener('pointermove', (event) => {
    if (touch.pointerId !== event.pointerId) return;
    event.preventDefault();
    updateStick(event);
  });

  joystick?.addEventListener('pointerup', (event) => {
    if (touch.pointerId !== event.pointerId) return;
    event.preventDefault();
    resetStick();
  });

  joystick?.addEventListener('pointercancel', resetStick);

  fireButton?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    initAudio();
    touch.fire = true;
  });
  fireButton?.addEventListener('pointerup', () => {
    touch.fire = false;
  });
  fireButton?.addEventListener('pointercancel', () => {
    touch.fire = false;
  });

  boostButton?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    initAudio();
    touch.boost = true;
  });
  boostButton?.addEventListener('pointerup', () => {
    touch.boost = false;
  });
  boostButton?.addEventListener('pointercancel', () => {
    touch.boost = false;
  });
}

function setupKeyboard() {
  window.addEventListener('keydown', (event) => {
    keys[event.code] = true;

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }

    if (event.code === 'Space' && ship) {
      ship.shoot();
    }

    if (event.code === 'KeyP' && (state.mode === 'playing' || state.mode === 'paused')) {
      state.mode = state.mode === 'playing' ? 'paused' : 'playing';
      notify(state.mode === 'paused' ? 'PAUSED' : 'RESUME', '#ffffff');
    }

    if (event.code === 'Enter' && (state.mode === 'menu' || state.mode === 'gameover')) {
      startGame();
    }
  });

  window.addEventListener('keyup', (event) => {
    keys[event.code] = false;
  });
}

function setupButtons() {
  document.getElementById('startBtn')?.addEventListener('click', startGame);
  document.getElementById('restartBtn')?.addEventListener('click', startGame);
  document.getElementById('garageBtn')?.addEventListener('click', () => {
    showScreen('garageScreen');
    updateGarageUI();
  });
  document.getElementById('closeGarageBtn')?.addEventListener('click', showMenu);
  document.getElementById('helpBtn')?.addEventListener('click', () => showScreen('helpScreen'));
  document.getElementById('closeHelpBtn')?.addEventListener('click', showMenu);
  document.getElementById('rankBtn')?.addEventListener('click', () => notify(`HIGH SCORE ${state.highScore}`, '#ffcc00'));
  document.getElementById('buyHp')?.addEventListener('click', () => buyUpgrade('srHull', 500));
  document.getElementById('buyAmmo')?.addEventListener('click', () => buyUpgrade('srAmmo', 800));
  document.getElementById('buyFuel')?.addEventListener('click', () => buyUpgrade('srFuel', 650));
  document.getElementById('buyShield')?.addEventListener('click', () => buyUpgrade('srShield', 1200));
}

function init() {
  if (!canvas || !uiLayer) {
    throw new Error('Game canvas or UI layer missing');
  }

  initThree();
  setupTouch();
  setupKeyboard();
  setupButtons();
  bootSequence();
  updateGarageUI();
  updateMenuUI();
  loop();
}

window.addEventListener('resize', resize);
document.addEventListener('pointerdown', initAudio, { once: true });
init();
