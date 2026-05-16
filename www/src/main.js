const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randomRange = (min, max) => Math.random() * (max - min) + min;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

let width = 0;
let height = 0;
let scale = 1;
let ship = null;
let asteroids = [];
let bullets = [];
let enemyBullets = [];
let pickups = [];
let particles = [];
let popups = [];
let stars = [];
let alienShip = null;
let bossShip = null;
let rafId = 0;

const keys = Object.create(null);
const touch = {
  rotate: 0,
  stickThrust: false,
  buttonThrust: false,
  fire: false,
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
  bulletCooldownMax: 14,
  bulletRegenTimer: 0,
  bulletRegenInterval: 300,
  combo: 0,
  comboTimer: 0,
  comboMult: 1,
  powerType: '',
  powerTimer: 0,
  powerDuration: 900,
  alienTimer: 0,
  alienInterval: 1200,
  bossWave: false,
  frame: 0,
  shake: 0,
  shakeX: 0,
  shakeY: 0,
};

let audio = null;
let masterGain = null;
let noiseBuffer = null;

class Vector {
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
    return new Vector(this.x, this.y);
  }

  static fromAngle(angle, length = 1) {
    return new Vector(Math.cos(angle) * length, Math.sin(angle) * length);
  }
}

class Ship {
  constructor() {
    this.pos = new Vector(width / 2, height / 2);
    this.vel = new Vector();
    this.angle = -Math.PI / 2;
    this.radius = 16 * scale;
    this.rotationSpeed = 0.078;
    this.acceleration = 0.22 * scale;
    this.maxSpeed = 7.2 * scale;
    this.friction = 0.992;
    this.invincible = 120;
    this.thrusting = false;
  }

  update() {
    const rotateLeft = keys.ArrowLeft || keys.KeyA;
    const rotateRight = keys.ArrowRight || keys.KeyD;
    const keyboardRotate = (rotateRight ? 1 : 0) - (rotateLeft ? 1 : 0);
    const rotate = keyboardRotate || touch.rotate;
    this.angle += rotate * this.rotationSpeed;

    const wantsThrust = keys.ArrowUp || keys.KeyW || touch.stickThrust || touch.buttonThrust;
    const drain = state.powerType === 'double_fuel' ? 0.18 : 0.36;
    this.thrusting = false;

    if (wantsThrust && state.fuel > 0) {
      this.vel.add(Vector.fromAngle(this.angle, this.acceleration));
      this.vel.limit(this.maxSpeed);
      state.fuel = Math.max(0, state.fuel - drain);
      this.thrusting = true;
      emitThrust(this);
      if (state.frame % 9 === 0) {
        playSfx('thrust');
      }
    } else if (state.mode === 'playing') {
      state.fuel = Math.min(state.maxFuel, state.fuel + 0.035);
    }

    this.vel.multiply(this.friction);
    this.pos.add(this.vel);
    wrap(this.pos, this.radius);

    if (this.invincible > 0) {
      this.invincible -= 1;
    }
  }

  shoot() {
    if (state.mode !== 'playing' || state.bulletCooldown > 0) {
      return;
    }

    if (state.ammo <= 0 && state.powerType !== 'infinite_bullets') {
      playSfx('empty');
      state.bulletCooldown = 8;
      return;
    }

    const shotSpeed = 9.5 * scale;
    const spread = state.powerType === 'triple_shot' ? [-0.18, 0, 0.18] : [0];
    spread.forEach((offset) => {
      const shotAngle = this.angle + offset;
      const muzzle = Vector.fromAngle(shotAngle, this.radius + 4 * scale);
      const velocity = Vector.fromAngle(shotAngle, shotSpeed).add(this.vel.copy().multiply(0.28));
      bullets.push(new Bullet(this.pos.x + muzzle.x, this.pos.y + muzzle.y, velocity));
    });

    if (state.powerType !== 'infinite_bullets') {
      state.ammo -= 1;
    }

    state.bulletCooldown = state.powerType === 'infinite_bullets' || state.powerType === 'triple_shot' ? 5 : state.bulletCooldownMax;
    triggerShake(3, 6);
    playSfx('shoot');
  }

  hit() {
    if (this.invincible > 0) {
      return;
    }

    if (state.shield > 0) {
      state.shield -= 1;
      this.invincible = 90;
      createExplosion(this.pos.x, this.pos.y, '#00f2ff', 18);
      triggerShake(8, 12);
      notify('SHIELD HIT', '#00f2ff');
      playSfx('power');
      return;
    }

    state.lives -= 1;
    createExplosion(this.pos.x, this.pos.y, '#ff4d7d', 26);
    triggerShake(14, 18);
    playSfx('explosion');

    if (state.lives <= 0) {
      endGame();
      return;
    }

    this.pos = new Vector(width / 2, height / 2);
    this.vel = new Vector();
    this.angle = -Math.PI / 2;
    this.invincible = 180;
    notify('HULL BREACH', '#ff4d7d');
  }

  draw() {
    if (this.invincible > 0 && Math.floor(state.frame / 6) % 2 === 0) {
      return;
    }

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);

    ctx.lineWidth = 2 * scale;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowBlur = 12 * scale;
    ctx.shadowColor = '#00f2ff';
    ctx.strokeStyle = '#ffffff';

    ctx.beginPath();
    ctx.moveTo(this.radius, 0);
    ctx.lineTo(-this.radius * 0.85, -this.radius * 0.62);
    ctx.lineTo(-this.radius * 0.46, 0);
    ctx.lineTo(-this.radius * 0.85, this.radius * 0.62);
    ctx.closePath();
    ctx.stroke();

    ctx.shadowColor = '#ff4dff';
    ctx.strokeStyle = '#ff4dff';
    ctx.beginPath();
    ctx.moveTo(-this.radius * 0.2, -this.radius * 0.35);
    ctx.lineTo(this.radius * 0.45, 0);
    ctx.lineTo(-this.radius * 0.2, this.radius * 0.35);
    ctx.stroke();

    if (this.thrusting) {
      ctx.shadowColor = '#ffcc00';
      ctx.strokeStyle = '#ffcc00';
      ctx.beginPath();
      ctx.moveTo(-this.radius * 0.85, 0);
      ctx.lineTo(-this.radius * randomRange(1.25, 1.85), 0);
      ctx.stroke();
    }

    if (state.shield > 0) {
      ctx.shadowColor = '#00f2ff';
      ctx.strokeStyle = 'rgba(0, 242, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.45, 0, TAU);
      ctx.stroke();
    }

    ctx.restore();
  }
}

class Bullet {
  constructor(x, y, velocity) {
    this.pos = new Vector(x, y);
    this.vel = velocity.copy();
    this.radius = 2.5 * scale;
    this.life = 86;
  }

  update() {
    this.pos.add(this.vel);
    wrap(this.pos, this.radius);
    this.life -= 1;
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 12 * scale;
    ctx.shadowColor = '#00f2ff';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

class Asteroid {
  constructor(x, y, size = 3, velocity = null) {
    this.pos = new Vector(x, y);
    this.size = size;
    this.radius = asteroidRadius(size);
    this.vel = velocity || randomVelocity((0.75 + state.wave * 0.08) * (1.15 - size * 0.09));
    this.angle = randomRange(0, TAU);
    this.rotation = randomRange(-0.025, 0.025) * (4 - size);
    this.vertices = this.createVertices();
  }

  createVertices() {
    const vertices = [];
    const count = 9 + Math.floor(Math.random() * 5);

    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * TAU;
      const radius = this.radius * randomRange(0.72, 1.16);
      vertices.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    }

    return vertices;
  }

  split() {
    if (this.size <= 1) {
      return;
    }

    const childSize = this.size - 1;
    const baseAngle = Math.atan2(this.vel.y, this.vel.x) || randomRange(0, TAU);
    const speed = Math.max(1.25 * scale, this.vel.magnitude() + randomRange(0.2, 0.75));
    asteroids.push(new Asteroid(this.pos.x, this.pos.y, childSize, Vector.fromAngle(baseAngle - 0.72, speed)));
    asteroids.push(new Asteroid(this.pos.x, this.pos.y, childSize, Vector.fromAngle(baseAngle + 0.72, speed)));
  }

  update() {
    this.pos.add(this.vel);
    this.angle += this.rotation;
    wrap(this.pos, this.radius);
  }

  draw() {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);
    ctx.lineWidth = Math.max(1.5, 2 * scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 8 * scale;
    ctx.shadowColor = this.size === 3 ? '#ffffff' : this.size === 2 ? '#00f2ff' : '#ffcc00';
    ctx.strokeStyle = '#ffffff';

    ctx.beginPath();
    ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
    for (let i = 1; i < this.vertices.length; i += 1) {
      ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

class AlienShip {
  constructor() {
    const side = Math.floor(Math.random() * 4);
    const margin = 60 * scale;
    this.radius = 16 * scale;
    this.hitRadius = 24 * scale;
    this.angle = 0;
    this.life = 720;
    this.scoreValue = 500;

    if (side === 0) {
      this.pos = new Vector(randomRange(0, width), -margin);
      this.target = new Vector(randomRange(0, width), height + margin);
    } else if (side === 1) {
      this.pos = new Vector(width + margin, randomRange(0, height));
      this.target = new Vector(-margin, randomRange(0, height));
    } else if (side === 2) {
      this.pos = new Vector(randomRange(0, width), height + margin);
      this.target = new Vector(randomRange(0, width), -margin);
    } else {
      this.pos = new Vector(-margin, randomRange(0, height));
      this.target = new Vector(width + margin, randomRange(0, height));
    }

    const dx = this.target.x - this.pos.x;
    const dy = this.target.y - this.pos.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = (2.2 + state.wave * 0.08) * scale;
    this.vel = new Vector((dx / dist) * speed, (dy / dist) * speed);
  }

  update() {
    this.pos.add(this.vel);
    this.angle += 0.05;
    this.life -= 1;

    if (
      this.life <= 0 ||
      this.pos.x < -120 * scale ||
      this.pos.x > width + 120 * scale ||
      this.pos.y < -120 * scale ||
      this.pos.y > height + 120 * scale
    ) {
      alienShip = null;
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);
    ctx.lineWidth = 2 * scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 14 * scale;
    ctx.shadowColor = '#79ff8b';
    ctx.strokeStyle = state.frame % 24 < 12 ? '#79ff8b' : '#fff36a';

    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius * 1.35, this.radius * 0.48, 0, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -this.radius * 0.22, this.radius * 0.36, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-this.radius, 0);
    ctx.lineTo(this.radius, 0);
    ctx.stroke();
    ctx.restore();
  }
}

class BossShip {
  constructor() {
    this.pos = new Vector(width / 2, -110 * scale);
    this.vel = new Vector(0, 0.78 * scale);
    this.radius = 54 * scale;
    this.angle = 0;
    this.maxHp = 18 + state.wave * 5;
    this.hp = this.maxHp;
    this.shootTimer = 90;
    this.scoreValue = 2500 + state.wave * 250;
  }

  update() {
    if (this.pos.y < height * 0.22) {
      this.pos.add(this.vel);
    } else {
      this.pos.x = width / 2 + Math.sin(state.frame * 0.018) * width * 0.28;
      this.pos.y = height * 0.2 + Math.cos(state.frame * 0.014) * 18 * scale;
    }

    this.angle += 0.01;
    this.shootTimer -= 1;
    if (this.shootTimer <= 0) {
      this.shootTimer = Math.max(42, 92 - state.wave * 4);
      fireEnemyBurst(this.pos, 5, ship ? Math.atan2(ship.pos.y - this.pos.y, ship.pos.x - this.pos.x) : Math.PI / 2, 0.8);
      playSfx('alien');
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);
    ctx.lineWidth = 2 * scale;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowBlur = 18 * scale;
    ctx.shadowColor = '#ff335f';
    ctx.strokeStyle = '#ff335f';

    ctx.beginPath();
    ctx.moveTo(0, -this.radius);
    ctx.lineTo(this.radius * 1.25, -this.radius * 0.16);
    ctx.lineTo(this.radius * 0.54, this.radius * 0.82);
    ctx.lineTo(0, this.radius * 0.35);
    ctx.lineTo(-this.radius * 0.54, this.radius * 0.82);
    ctx.lineTo(-this.radius * 1.25, -this.radius * 0.16);
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.34, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

class EnemyBullet {
  constructor(x, y, velocity) {
    this.pos = new Vector(x, y);
    this.vel = velocity.copy();
    this.radius = 4.5 * scale;
    this.life = 180;
  }

  update() {
    this.pos.add(this.vel);
    this.life -= 1;
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 12 * scale;
    ctx.shadowColor = '#ff335f';
    ctx.fillStyle = '#ff6688';
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

class Pickup {
  constructor(x, y, type) {
    this.pos = new Vector(x, y);
    this.vel = randomVelocity(0.75);
    this.type = type;
    this.radius = 13 * scale;
    this.life = 720;
    this.angle = randomRange(0, TAU);
  }

  update() {
    if (ship) {
      const pullRange = 120 * scale;
      const dx = ship.pos.x - this.pos.x;
      const dy = ship.pos.y - this.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < pullRange && dist > 0.01) {
        this.vel.x += (dx / dist) * 0.045 * scale;
        this.vel.y += (dy / dist) * 0.045 * scale;
      }
    }

    this.vel.limit(3.5 * scale);
    this.pos.add(this.vel);
    wrap(this.pos, this.radius);
    this.angle += 0.04;
    this.life -= 1;
  }

  draw() {
    const color = pickupColor(this.type);
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);
    ctx.lineWidth = 2 * scale;
    ctx.shadowBlur = 14 * scale;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.rect(-this.radius * 0.7, -this.radius * 0.7, this.radius * 1.4, this.radius * 1.4);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = `${Math.max(8, 9 * scale)}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pickupLabel(this.type), 0, 1);
    ctx.restore();
  }
}

class Particle {
  constructor(x, y, color, speed = randomRange(1.4, 4.6)) {
    this.pos = new Vector(x, y);
    this.vel = Vector.fromAngle(randomRange(0, TAU), speed * scale);
    this.color = color;
    this.life = randomRange(24, 44);
    this.maxLife = this.life;
    this.radius = randomRange(1.2, 2.6) * scale;
  }

  update() {
    this.pos.add(this.vel);
    this.vel.multiply(0.965);
    this.life -= 1;
  }

  draw() {
    const alpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 10 * scale;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

class ScorePopup {
  constructor(x, y, text, color = '#ffffff') {
    this.pos = new Vector(x, y);
    this.text = String(text);
    this.color = color;
    this.life = 70;
    this.maxLife = 70;
  }

  update() {
    this.pos.y -= 0.55 * scale;
    this.life -= 1;
  }

  draw() {
    const alpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.font = `${Math.max(10, 12 * scale)}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.shadowBlur = 8 * scale;
    ctx.shadowColor = this.color;
    ctx.fillText(this.text, this.pos.x, this.pos.y);
    ctx.restore();
  }
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
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.09);
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
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.linearRampToValueAtTime(310, now + 0.35);
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
    filter.frequency.setValueAtTime(120, now);
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

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  scale = clamp(Math.min(width, height) / 720, 0.72, 1.18);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  createStars();

  if (ship) {
    ship.radius = 16 * scale;
    ship.pos.x = clamp(ship.pos.x, 0, width);
    ship.pos.y = clamp(ship.pos.y, 0, height);
  }
}

function createStars() {
  stars = [];
  const layers = [
    { count: 70, speed: 0.12, size: 1, alpha: 0.45 },
    { count: 50, speed: 0.24, size: 1.5, alpha: 0.65 },
    { count: 26, speed: 0.42, size: 2, alpha: 0.9 },
  ];

  layers.forEach((layer) => {
    for (let i = 0; i < layer.count; i += 1) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: layer.size * scale * randomRange(0.75, 1.35),
        speed: layer.speed * scale,
        alpha: layer.alpha,
      });
    }
  });
}

function drawStars() {
  ctx.save();
  stars.forEach((star) => {
    const driftX = ship ? ship.vel.x * 0.025 * star.speed : 0.02;
    const driftY = ship ? ship.vel.y * 0.025 * star.speed : 0.05;
    star.x = (star.x + driftX + width) % width;
    star.y = (star.y + driftY + star.speed + height) % height;
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, TAU);
    ctx.fill();
  });
  ctx.restore();
}

function asteroidRadius(size) {
  return [0, 17, 29, 45][size] * scale;
}

function randomVelocity(speed) {
  return Vector.fromAngle(randomRange(0, TAU), Math.max(0.45, speed) * randomRange(0.75, 1.35) * scale);
}

function wrap(pos, margin) {
  if (pos.x < -margin) pos.x = width + margin;
  if (pos.x > width + margin) pos.x = -margin;
  if (pos.y < -margin) pos.y = height + margin;
  if (pos.y > height + margin) pos.y = -margin;
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

function pickupLabel(type) {
  return {
    fuel: 'F',
    ammo: 'A',
    shield: 'S',
    repair: '+',
    triple_shot: '3',
    infinite_bullets: 'I',
    double_fuel: 'D',
  }[type] || '?';
}

function fireEnemyBurst(origin, count, aimAngle, spread) {
  for (let i = 0; i < count; i += 1) {
    const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread;
    const speed = (2.9 + state.wave * 0.08) * scale;
    enemyBullets.push(new EnemyBullet(origin.x, origin.y, Vector.fromAngle(aimAngle + offset, speed)));
  }
}

function createWave() {
  asteroids = [];
  bullets = [];
  enemyBullets = [];
  pickups = [];
  particles = [];
  popups = [];
  alienShip = null;
  bossShip = null;
  state.kills = 0;
  state.alienTimer = 0;
  state.alienInterval = Math.max(480, 1200 - state.wave * 30);
  state.bossWave = state.wave % 5 === 0;

  const count = state.bossWave ? Math.min(4 + Math.floor(state.wave / 2), 9) : Math.min(4 + state.wave, 12);
  for (let i = 0; i < count; i += 1) {
    spawnAsteroidAwayFromShip(3);
  }

  if (state.bossWave) {
    bossShip = new BossShip();
    notify(`BOSS WAVE ${state.wave}`, '#ff335f');
  } else {
    notify(`WAVE ${state.wave}`, '#00f2ff');
  }
}

function spawnAsteroidAwayFromShip(size) {
  let x = 0;
  let y = 0;
  let tries = 0;
  const safeDistance = Math.min(Math.max(170 * scale, Math.min(width, height) * 0.23), 280 * scale);

  do {
    x = randomRange(0, width);
    y = randomRange(0, height);
    tries += 1;
  } while (ship && tries < 80 && Math.hypot(x - ship.pos.x, y - ship.pos.y) < safeDistance);

  asteroids.push(new Asteroid(x, y, size));
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
  const lines = ['[SYNC] ASTEROID FIELD ONLINE', '[READY] PILOT INTERFACE ACTIVE'];
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

function updateMenuUI() {
  const coins = document.getElementById('totalCoinsDisplay');
  const high = document.getElementById('highScoreDisplay');
  if (coins) coins.textContent = String(state.totalCoins);
  if (high) high.textContent = String(state.highScore);
}

function updateGarageUI() {
  const hpLevel = Number(localStorage.getItem('upg_hp') || '0');
  const ammoLevel = Number(localStorage.getItem('upg_am') || '0');
  const fuelLevel = Number(localStorage.getItem('upg_fuel') || '0');
  const shieldLevel = Number(localStorage.getItem('upg_shield') || '0');
  const hp = document.getElementById('hpLevel');
  const ammo = document.getElementById('ammoLevel');
  const fuel = document.getElementById('fuelLevel');
  const shield = document.getElementById('shieldLevel');
  const coins = document.getElementById('totalCoinsDisplay');
  if (hp) hp.textContent = `LVL: ${hpLevel}`;
  if (ammo) ammo.textContent = `LVL: ${ammoLevel}`;
  if (fuel) fuel.textContent = `LVL: ${fuelLevel}`;
  if (shield) shield.textContent = `LVL: ${shieldLevel}`;
  if (coins) coins.textContent = String(state.totalCoins);
}

function startGame() {
  initAudio();
  const hpLevel = Number(localStorage.getItem('upg_hp') || '0');
  const ammoLevel = Number(localStorage.getItem('upg_am') || '0');
  const fuelLevel = Number(localStorage.getItem('upg_fuel') || '0');
  const shieldLevel = Number(localStorage.getItem('upg_shield') || '0');

  state.mode = 'playing';
  state.score = 0;
  state.lives = 3 + hpLevel;
  state.wave = 1;
  state.maxFuel = 100 + fuelLevel * 20;
  state.fuel = state.maxFuel;
  state.maxAmmo = 20 + ammoLevel * 5;
  state.ammo = state.maxAmmo;
  state.maxShield = shieldLevel;
  state.shield = state.maxShield;
  state.bulletCooldown = 0;
  state.bulletCooldownMax = 14;
  state.bulletRegenTimer = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.comboMult = 1;
  state.powerType = '';
  state.powerTimer = 0;
  state.frame = 0;

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
      popups.push(new ScorePopup(ship.pos.x, ship.pos.y - 48 * scale, 'AMMO +1', '#00f2ff'));
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
      state.bulletCooldownMax = 14;
    }
  }

  updateAlien();
  updateBoss();
  updateObjects();
  checkCollisions();

  if (asteroids.length === 0 && !bossShip && state.mode === 'playing') {
    state.wave += 1;
    state.fuel = Math.min(state.maxFuel, state.fuel + 40);
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
    if (bullets[i].life <= 0) {
      bullets.splice(i, 1);
    }
  }

  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    enemyBullets[i].update();
    const offScreen =
      enemyBullets[i].pos.x < -80 * scale ||
      enemyBullets[i].pos.x > width + 80 * scale ||
      enemyBullets[i].pos.y < -80 * scale ||
      enemyBullets[i].pos.y > height + 80 * scale;
    if (enemyBullets[i].life <= 0 || offScreen) {
      enemyBullets.splice(i, 1);
    }
  }

  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    pickups[i].update();
    if (pickups[i].life <= 0) {
      pickups.splice(i, 1);
    }
  }

  asteroids.forEach((asteroid) => asteroid.update());

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    particles[i].update();
    if (particles[i].life <= 0) {
      particles.splice(i, 1);
    }
  }

  for (let i = popups.length - 1; i >= 0; i -= 1) {
    popups[i].update();
    if (popups[i].life <= 0) {
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
      if (distance(ship.pos, asteroid.pos) < ship.radius + asteroid.radius * 0.82) {
        ship.hit();
        break;
      }
    }

    if (alienShip && distance(ship.pos, alienShip.pos) < ship.radius + alienShip.hitRadius) {
      ship.hit();
      createExplosion(alienShip.pos.x, alienShip.pos.y, '#79ff8b', 18);
      alienShip = null;
    }

    if (bossShip && distance(ship.pos, bossShip.pos) < ship.radius + bossShip.radius * 0.75) {
      ship.hit();
    }

    for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
      if (distance(ship.pos, enemyBullets[i].pos) < ship.radius + enemyBullets[i].radius) {
        enemyBullets.splice(i, 1);
        ship.hit();
        break;
      }
    }
  }

  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    if (distance(ship.pos, pickups[i].pos) < ship.radius + pickups[i].radius) {
      collectPickup(pickups[i]);
      pickups.splice(i, 1);
    }
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    let bulletConsumed = false;

    for (let j = asteroids.length - 1; j >= 0; j -= 1) {
      const asteroid = asteroids[j];
      if (distance(bullet.pos, asteroid.pos) < asteroid.radius) {
        bullets.splice(i, 1);
        destroyAsteroid(j);
        bulletConsumed = true;
        break;
      }
    }

    if (bulletConsumed) {
      continue;
    }

    if (alienShip && distance(bullet.pos, alienShip.pos) < alienShip.hitRadius) {
      bullets.splice(i, 1);
      destroyAlien();
      continue;
    }

    if (bossShip && distance(bullet.pos, bossShip.pos) < bossShip.radius) {
      bullets.splice(i, 1);
      damageBoss(bullet.pos.x, bullet.pos.y);
    }
  }
}

function destroyAsteroid(index) {
  const asteroid = asteroids[index];
  asteroid.split();
  asteroids.splice(index, 1);

  const points = (4 - asteroid.size) * 100;
  registerScore(points, asteroid.pos.x, asteroid.pos.y);
  createExplosion(asteroid.pos.x, asteroid.pos.y, asteroid.size === 1 ? '#ffcc00' : '#ffffff', 12 + asteroid.size * 4);
  triggerShake(asteroid.size * 2.4, 8 + asteroid.size * 2);
  playSfx('explosion');

  if (asteroid.size === 3) {
    state.fuel = Math.min(state.maxFuel, state.fuel + 30);
    popups.push(new ScorePopup(asteroid.pos.x, asteroid.pos.y - 28 * scale, 'FUEL +30', '#ffcc00'));
  }

  if (state.powerType !== 'infinite_bullets') {
    state.ammo = Math.min(state.maxAmmo, state.ammo + 1);
    popups.push(new ScorePopup(asteroid.pos.x, asteroid.pos.y + 32 * scale, 'AMMO +1', '#00f2ff'));
  }

  const dropChance = asteroid.size === 3 ? 0.32 : asteroid.size === 2 ? 0.2 : 0.09;
  if (Math.random() < dropChance) {
    spawnPickup(asteroid.pos.x, asteroid.pos.y);
  }
}

function destroyAlien() {
  if (!alienShip) {
    return;
  }

  const x = alienShip.pos.x;
  const y = alienShip.pos.y;
  registerScore(alienShip.scoreValue, x, y);
  createExplosion(x, y, '#79ff8b', 28);
  triggerShake(12, 16);
  alienShip = null;

  const powerType = Math.random() < 0.5 ? 'double_fuel' : 'infinite_bullets';
  activatePower(powerType, x, y);
}

function damageBoss(x, y) {
  if (!bossShip) {
    return;
  }

  bossShip.hp -= state.powerType === 'triple_shot' ? 2 : 1;
  createExplosion(x, y, '#ff335f', 4);
  triggerShake(3, 5);

  if (bossShip.hp <= 0) {
    const bx = bossShip.pos.x;
    const by = bossShip.pos.y;
    registerScore(bossShip.scoreValue, bx, by);
    createExplosion(bx, by, '#ff335f', 54);
    createExplosion(bx, by, '#ffcc00', 36);
    triggerShake(20, 28);
    playSfx('explosion');
    pickups.push(new Pickup(bx, by, 'shield'));
    pickups.push(new Pickup(bx + 26 * scale, by, 'triple_shot'));
    bossShip = null;
    enemyBullets = [];
    notify('BOSS DESTROYED', '#ffcc00');
  }
}

function spawnPickup(x, y) {
  const roll = Math.random();
  let type = 'fuel';
  if (roll > 0.78) type = 'triple_shot';
  else if (roll > 0.62) type = 'shield';
  else if (roll > 0.46) type = 'repair';
  else if (roll > 0.24) type = 'ammo';
  pickups.push(new Pickup(x, y, type));
}

function collectPickup(pickup) {
  if (pickup.type === 'fuel') {
    state.fuel = state.maxFuel;
    popups.push(new ScorePopup(pickup.pos.x, pickup.pos.y, 'FUEL FULL', '#ffcc00'));
  } else if (pickup.type === 'ammo') {
    state.ammo = state.maxAmmo;
    popups.push(new ScorePopup(pickup.pos.x, pickup.pos.y, 'AMMO FULL', '#00f2ff'));
  } else if (pickup.type === 'shield') {
    state.shield = Math.min(state.maxShield || 1, state.shield + 1);
    popups.push(new ScorePopup(pickup.pos.x, pickup.pos.y, 'SHIELD +1', '#79ff8b'));
  } else if (pickup.type === 'repair') {
    state.lives += 1;
    popups.push(new ScorePopup(pickup.pos.x, pickup.pos.y, 'LIFE +1', '#ff6688'));
  } else {
    activatePower(pickup.type, pickup.pos.x, pickup.pos.y);
  }

  playSfx('power');
}

function activatePower(type, x, y) {
  state.powerType = type;
  state.powerTimer = state.powerDuration;

  if (type === 'double_fuel') {
    state.fuel = state.maxFuel;
    popups.push(new ScorePopup(x, y - 42 * scale, 'DOUBLE FUEL', '#ffcc00'));
  } else if (type === 'infinite_bullets') {
    state.bulletCooldownMax = 5;
    popups.push(new ScorePopup(x, y - 42 * scale, 'INFINITE AMMO', '#00f2ff'));
  } else if (type === 'triple_shot') {
    state.bulletCooldownMax = 5;
    popups.push(new ScorePopup(x, y - 42 * scale, 'TRIPLE SHOT', '#ff4dff'));
  }

  const label = {
    double_fuel: 'DOUBLE FUEL',
    infinite_bullets: 'INFINITE AMMO',
    triple_shot: 'TRIPLE SHOT',
  }[type] || 'POWER UP';
  notify(label, pickupColor(type));
  playSfx('power');
}

function registerScore(points, x, y) {
  state.kills += 1;
  state.combo = state.comboTimer > 0 ? state.combo + 1 : 1;
  state.comboTimer = 180;
  state.comboMult = 1 + Math.floor((state.combo - 1) / 5);

  const total = points * state.comboMult;
  state.score += total;
  const coins = Math.max(1, Math.floor(points / 100));
  state.totalCoins += coins;

  popups.push(new ScorePopup(x, y, state.comboMult > 1 ? `${total} x${state.comboMult}` : total, '#ffffff'));
}

function emitThrust(source) {
  const back = Vector.fromAngle(source.angle + Math.PI, source.radius * 0.8);
  const spread = source.angle + Math.PI + randomRange(-0.32, 0.32);
  const particle = new Particle(source.pos.x + back.x, source.pos.y + back.y, '#ffcc00', randomRange(1.2, 3.2));
  particle.vel = Vector.fromAngle(spread, randomRange(2.2, 4.2) * scale).add(source.vel.copy().multiply(0.1));
  particle.life = randomRange(10, 18);
  particle.maxLife = particle.life;
  particles.push(particle);
}

function createExplosion(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    particles.push(new Particle(x, y, color));
  }
}

function triggerShake(intensity, duration) {
  state.shake = Math.max(state.shake, duration);
  state.shakeX = Math.max(state.shakeX, intensity * scale);
  state.shakeY = Math.max(state.shakeY, intensity * scale);
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
  window.clearTimeout(notify.timeout);
  notify.timeout = window.setTimeout(() => {
    node.style.opacity = '0';
  }, 1100);
}

function updateUI() {
  const score = document.getElementById('s');
  const wave = document.getElementById('w');
  const rocks = document.getElementById('k');
  const lives = document.getElementById('l');
  const high = document.getElementById('h');
  const fuel = document.getElementById('f');
  const ammo = document.getElementById('a');
  const shield = document.getElementById('sh');
  const power = document.getElementById('p');
  const combo = document.getElementById('comboUI');
  const comboMult = document.getElementById('comboMult');
  const boss = document.getElementById('bossUI');
  const bossFill = document.getElementById('bossFill');

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
      const label = state.powerType === 'double_fuel' ? 'DOUBLE FUEL' : 'INFINITE AMMO';
      const name = state.powerType === 'triple_shot' ? 'TRIPLE SHOT' : label;
      power.textContent = `${name} ${Math.ceil(state.powerTimer / 60)}S`;
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
    const visible = state.comboMult > 1;
    combo.style.display = visible ? 'block' : 'none';
    comboMult.textContent = String(state.comboMult);
  }
}

function draw() {
  ctx.fillStyle = state.mode === 'playing' || state.mode === 'paused' ? 'rgba(0, 0, 0, 0.36)' : '#000000';
  ctx.fillRect(0, 0, width, height);

  const shakeX = state.shake > 0 ? randomRange(-state.shakeX, state.shakeX) : 0;
  const shakeY = state.shake > 0 ? randomRange(-state.shakeY, state.shakeY) : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawStars();
  asteroids.forEach((asteroid) => asteroid.draw());
  pickups.forEach((pickup) => pickup.draw());
  if (bossShip) bossShip.draw();
  if (alienShip) alienShip.draw();
  bullets.forEach((bullet) => bullet.draw());
  enemyBullets.forEach((bullet) => bullet.draw());
  particles.forEach((particle) => particle.draw());
  if (ship) ship.draw();
  popups.forEach((popup) => popup.draw());
  ctx.restore();

  if (state.mode === 'paused') {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.max(18, 24 * scale)}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', width / 2, height / 2);
    ctx.restore();
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
  draw();
  rafId = requestAnimationFrame(loop);
}

function setupTouch() {
  const joystick = document.getElementById('jz');
  const knob = document.getElementById('jk');
  const fireButton = document.getElementById('fb');
  const thrustButton = document.getElementById('hb');

  const resetStick = () => {
    touch.rotate = 0;
    touch.stickThrust = false;
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
    touch.rotate = clamp(dx / max, -1, 1);
    touch.stickThrust = y < -max * 0.22;
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

  thrustButton?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    initAudio();
    touch.buttonThrust = true;
  });
  thrustButton?.addEventListener('pointerup', () => {
    touch.buttonThrust = false;
  });
  thrustButton?.addEventListener('pointercancel', () => {
    touch.buttonThrust = false;
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
  document.getElementById('rankBtn')?.addEventListener('click', () => {
    notify(`HIGH SCORE ${state.highScore}`, '#ffcc00');
  });

  document.getElementById('buyHp')?.addEventListener('click', () => {
    buyUpgrade('upg_hp', 500);
  });
  document.getElementById('buyAmmo')?.addEventListener('click', () => {
    buyUpgrade('upg_am', 800);
  });
  document.getElementById('buyFuel')?.addEventListener('click', () => {
    buyUpgrade('upg_fuel', 650);
  });
  document.getElementById('buyShield')?.addEventListener('click', () => {
    buyUpgrade('upg_shield', 1200);
  });
}

function buyUpgrade(key, cost) {
  if (state.totalCoins < cost) {
    notify('NEED MORE COINS', '#ff4d7d');
    return;
  }

  state.totalCoins -= cost;
  const nextLevel = Number(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, String(nextLevel));
  localStorage.setItem('srCoins', String(state.totalCoins));
  updateGarageUI();
  playSfx('power');
}

function init() {
  resize();
  setupKeyboard();
  setupTouch();
  setupButtons();
  bootSequence();

  if (rafId) {
    cancelAnimationFrame(rafId);
  }
  loop();
}

window.addEventListener('resize', resize);
document.addEventListener('pointerdown', initAudio, { once: true });
init();
