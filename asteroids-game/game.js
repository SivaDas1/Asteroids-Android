// 80s Asteroids Game - Pure JavaScript with Canvas
// Authentic black and white pixel art style

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameState = 'start'; // start, playing, paused, gameOver
let score = 0;
let lives = 3;
let highScore = localStorage.getItem('asteroidsHighScore') || 0;

// Thrust System
let thrustFuel = 100; // Current fuel amount
let maxThrustFuel = 100;
let thrustConsumptionRate = 2; // Fuel consumed per frame when thrusting

// Bullet System
let bulletCount = 10; // Current bullet count
let maxBulletCount = 20;
let bulletCooldown = 0; // Frames until next shot allowed
let bulletCooldownTime = 15; // Frames between shots

// Bullet Regeneration
let bulletRegenTimer = 0; // Frames until next bullet regen
let bulletRegenInterval = 300; // Frames between regen (5 seconds at 60fps)

// Alien Spaceship
let alienShip = null;
let alienSpawnTimer = 0;
let alienSpawnInterval = 1200; // Frames between alien spawns (20 seconds at 60fps)
let alienActive = false;

// Parallax Background
let parallaxStars = [];
let parallaxOffset = 0;

// Power-up System
let powerUpActive = false;
let powerUpType = ''; // 'double_fuel', 'infinite_bullets', 'shield', 'rapid_fire', 'multi_shot'
let powerUpTimer = 0;
let powerUpDuration = 900; // 15 seconds at 60fps

// Upgrade System
let playerLevel = 1;
let experience = 0;
let experienceToNextLevel = 1000;
let upgrades = {
    bulletSpeed: 1.0,
    fireRate: 1.0,
    thrustPower: 1.0,
    shieldCapacity: 0
};

// Combo System
let comboMultiplier = 1;
let comboTimer = 0;
let lastKillTime = 0;

// Difficulty Scaling
let waveNumber = 1;
let asteroidSpawnRate = 1.0;

// Camera Shake
let cameraShake = {
    intensity: 0,
    duration: 0,
    offsetX: 0,
    offsetY: 0
};

// Audio System
let audioContext = null;
let masterGain = null;
let isAudioInitialized = false;
let musicLoop = null;
let musicStartTime = 0;
let musicLoopDuration = 8; // 8 seconds loop

// Initialize Audio Context
function initAudio() {
    if (isAudioInitialized) return;
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.3; // Lower master volume
        masterGain.connect(audioContext.destination);
        isAudioInitialized = true;
        
        // Start music when game starts
        startMusic();
    } catch (e) {
        console.log("Web Audio API not supported");
    }
}

// 80s Chiptune Music Generator - Deep Space Horror Version
function startMusic() {
    if (!audioContext || !masterGain) return;
    
    // Stop any existing music
    stopMusic();
    
    musicStartTime = audioContext.currentTime;
    
    // Schedule the 12-second loop for more atmospheric spacing
    scheduleMusicLoop(musicStartTime);
    
    // Set up loop restart
    musicLoop = setInterval(() => {
        musicStartTime = audioContext.currentTime;
        scheduleMusicLoop(musicStartTime);
    }, musicLoopDuration * 1000);
}

function stopMusic() {
    if (musicLoop) {
        clearInterval(musicLoop);
        musicLoop = null;
    }
}

function scheduleMusicLoop(startTime) {
    const tempo = 60; // Very slow, ominous tempo
    const beatTime = 60 / tempo;
    const measureTime = beatTime * 4; // 4/4 time signature
    
    // Deep space ambient drones - the foundation of loneliness
    const spaceDrones = [
        { note: 36, duration: beatTime * 16 }, // C0 - Sub-bass foundation
        { note: 43, duration: beatTime * 16 }, // G1 - Harmonic overtones
        { note: 48, duration: beatTime * 16 }, // C2 - Mid-range texture
    ];
    
    // Haunting, sparse melody - like a distant signal
    const lonelyMelody = [
        { note: 55, duration: beatTime * 4 }, // G2 - Long, sustained note
        { note: 0, duration: beatTime * 4 },  // Silence - the void
        { note: 53, duration: beatTime * 4 }, // F2 - Descent into darkness
        { note: 0, duration: beatTime * 4 },  // Silence - isolation
        { note: 50, duration: beatTime * 4 }, // D#2 - Minor, unsettling
        { note: 0, duration: beatTime * 4 },  // Silence - emptiness
        { note: 48, duration: beatTime * 4 }, // C2 - Resolution into dread
        { note: 0, duration: beatTime * 4 },  // Silence - the abyss
    ];
    
    // Random, unpredictable tension pulses - like distant machinery
    const randomPulses = [
        { note: 0, duration: beatTime * 8 },  // Long silence
        { note: 1, duration: beatTime * 0.2 }, // Sharp, metallic pulse
        { note: 0, duration: beatTime * 12 }, // More silence
        { note: 1, duration: beatTime * 0.2 }, // Another pulse
        { note: 0, duration: beatTime * 6 },  // Shorter silence
        { note: 1, duration: beatTime * 0.2 }, // Unexpected pulse
        { note: 0, duration: beatTime * 10 }, // Return to silence
    ];
    
    // Very sparse, echoing percussion - like a dying heartbeat
    const dyingHeartbeat = [
        { note: 0, duration: beatTime * 6 },  // Long pause
        { note: 1, duration: beatTime * 0.1 }, // Weak pulse
        { note: 0, duration: beatTime * 10 }, // Long silence
        { note: 1, duration: beatTime * 0.1 }, // Fainter pulse
        { note: 0, duration: beatTime * 8 },  // Silence
        { note: 1, duration: beatTime * 0.1 }, // Barely audible
        { note: 0, duration: beatTime * 12 }, // Return to void
    ];
    
    // Dissonant, slowly shifting harmonics - the sound of cosmic dread
    const cosmicHarmonics = [
        { note: 48, duration: beatTime * 6 },  // C2 - Root tone
        { note: 51, duration: beatTime * 6 },  // D#2 - Minor third, dissonant
        { note: 54, duration: beatTime * 6 },  // F2 - Diminished fifth, unsettling
        { note: 57, duration: beatTime * 6 },  // A2 - Octave, but cold
    ];
    
    // ALARMING TENSION ELEMENTS - Screeching, dissonant sounds
    const alarmTension = [
        { note: 72, duration: beatTime * 2 },  // C4 - High, piercing alarm
        { note: 0, duration: beatTime * 2 },   // Silence - anticipation
        { note: 71, duration: beatTime * 1 },  // B3 - Sharp dissonance
        { note: 69, duration: beatTime * 1 },  // A3 - Descending dread
        { note: 0, duration: beatTime * 4 },   // Long silence - building tension
        { note: 76, duration: beatTime * 1 },  // E4 - Ear-piercing screech
        { note: 74, duration: beatTime * 1 },  // D4 - Dissonant harmony
        { note: 0, duration: beatTime * 6 },   // Extended silence - unease
    ];
    
    // RANDOM ALARM PULSES - Unpredictable, jarring sounds
    const alarmPulses = [
        { note: 1, duration: beatTime * 0.1 }, // Sharp metallic click
        { note: 0, duration: beatTime * 12 },  // Long pause
        { note: 1, duration: beatTime * 0.1 }, // Another click
        { note: 0, duration: beatTime * 8 },   // Shorter pause
        { note: 1, duration: beatTime * 0.2 }, // Longer, more threatening pulse
        { note: 0, duration: beatTime * 16 },  // Very long pause - anticipation
        { note: 1, duration: beatTime * 0.3 }, // Sustained alarm tone
        { note: 0, duration: beatTime * 4 },   // Brief respite
    ];
    
    // Schedule space drones - the foundation of isolation
    let time = startTime;
    for (let i = 0; i < spaceDrones.length; i++) {
        playDeepSpaceDrone(time, spaceDrones[i].note, spaceDrones[i].duration);
        time += spaceDrones[i].duration;
    }
    
    // Schedule lonely melody - the distant, fading signal
    time = startTime;
    for (let i = 0; i < lonelyMelody.length; i++) {
        if (lonelyMelody[i].note !== 0) {
            playLonelySignal(time, lonelyMelody[i].note, lonelyMelody[i].duration);
        }
        time += lonelyMelody[i].duration;
    }
    
    // Schedule random tension pulses - unpredictable cosmic events
    time = startTime;
    for (let i = 0; i < randomPulses.length; i++) {
        if (randomPulses[i].note === 1) {
            playCosmicPulse(time);
        }
        time += randomPulses[i].duration;
    }
    
    // Schedule dying heartbeat - the fading pulse of life
    time = startTime;
    for (let i = 0; i < dyingHeartbeat.length; i++) {
        if (dyingHeartbeat[i].note === 1) {
            playDyingHeartbeat(time);
        }
        time += dyingHeartbeat[i].duration;
    }
    
    // Schedule cosmic harmonics - the dissonant song of the void
    time = startTime;
    for (let i = 0; i < cosmicHarmonics.length; i++) {
        playCosmicHarmonic(time, cosmicHarmonics[i].note, cosmicHarmonics[i].duration);
        time += cosmicHarmonics[i].duration;
    }
    
    // Schedule ALARMING TENSION ELEMENTS - Screeching, dissonant sounds
    time = startTime;
    for (let i = 0; i < alarmTension.length; i++) {
        if (alarmTension[i].note !== 0) {
            playAlarmingTension(time, alarmTension[i].note, alarmTension[i].duration);
        }
        time += alarmTension[i].duration;
    }
    
    // Schedule RANDOM ALARM PULSES - Unpredictable, jarring sounds
    time = startTime;
    for (let i = 0; i < alarmPulses.length; i++) {
        if (alarmPulses[i].note === 1) {
            playAlarmPulse(time);
        }
        time += alarmPulses[i].duration;
    }
}

// Audio synthesis functions
function playBassNote(time, midiNote, duration) {
    if (!audioContext) return;
    
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, time);
    
    // Pitch slide down for that 80s bass sound
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.95, time + 0.05);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
    
    osc.connect(gain);
    gain.connect(masterGain);
    
    osc.start(time);
    osc.stop(time + duration + 0.1);
}

function playLeadNote(time, midiNote, duration) {
    if (!audioContext) return;
    
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(frequency, time);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, time);
    filter.Q.setValueAtTime(1, time);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.1, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    
    osc.start(time);
    osc.stop(time + duration + 0.1);
}

function playArpeggioNote(time, midiNote, duration) {
    if (!audioContext) return;
    
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency, time);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.05, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    
    osc.connect(gain);
    gain.connect(masterGain);
    
    osc.start(time);
    osc.stop(time + duration + 0.1);
}

function playHiHat(time) {
    if (!audioContext) return;
    
    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < output.length; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    const whiteNoise = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    whiteNoise.buffer = noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(5000, time);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.1, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    
    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    
    whiteNoise.start(time);
    whiteNoise.stop(time + 0.06);
}

// Ominous Audio synthesis functions
function playOminousBassNote(time, midiNote, duration) {
    if (!audioContext) return;
    
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'sine'; // Deep, resonant sine wave
    osc.frequency.setValueAtTime(frequency, time);
    
    // Very slow pitch slide for ominous effect
    osc.frequency.linearRampToValueAtTime(frequency * 0.98, time + duration * 0.8);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.4, time + 0.1); // Slow attack
    gain.gain.exponentialRampToValueAtTime(0.02, time + duration);
    
    osc.connect(gain);
    gain.connect(masterGain);
    
    osc.start(time);
    osc.stop(time + duration + 0.2);
}

function playOminousLeadNote(time, midiNote, duration) {
    if (!audioContext) return;
    
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    osc.type = 'triangle'; // Haunting, hollow sound
    osc.frequency.setValueAtTime(frequency, time);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, time); // Dark, muffled sound
    filter.Q.setValueAtTime(2, time); // Resonant
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.15, time + 0.2); // Slow attack
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    
    osc.start(time);
    osc.stop(time + duration + 0.3);
}

function playOminousArpeggioNote(time, midiNote, duration) {
    if (!audioContext) return;
    
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'square'; // Metallic, dissonant sound
    osc.frequency.setValueAtTime(frequency, time);
    
    // Pitch wobble for unsettling effect
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(5, time); // 5Hz wobble
    lfoGain.gain.setValueAtTime(10, time); // 10 cent modulation
    
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.08, time + 0.05); // Quick attack
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    
    osc.connect(gain);
    gain.connect(masterGain);
    
    lfo.start(time);
    osc.start(time);
    osc.stop(time + duration + 0.1);
    lfo.stop(time + duration + 0.1);
}

function playOminousHiHat(time) {
    if (!audioContext) return;
    
    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.05, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < output.length; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    const whiteNoise = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    whiteNoise.buffer = noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, time); // Very bright, piercing
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.2, time + 0.001); // Sharp attack
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03); // Fast decay
    
    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    
    whiteNoise.start(time);
    whiteNoise.stop(time + 0.04);
}

// Metroid-style ambient drone
function playMetroidDrone(time, midiNote, duration) {
    if (!audioContext) return;
    
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, time);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, time); // Very low cutoff for sub-bass
    filter.Q.setValueAtTime(10, time); // High resonance
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.2, time + 1.0); // Very slow attack
    gain.gain.linearRampToValueAtTime(0.1, time + duration - 1.0); // Hold
    gain.gain.linearRampToValueAtTime(0, time + duration); // Slow release
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    
    osc.start(time);
    osc.stop(time + duration + 0.5);
}

// Alien movie-style tension pulse
function playAlienPulse(time) {
    if (!audioContext) return;
    
    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < output.length; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    noise.buffer = noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, time); // Mid-range pulse
    filter.Q.setValueAtTime(15, time); // Very narrow band for piercing sound
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.5, time + 0.01); // Sharp attack
    gain.gain.linearRampToValueAtTime(0, time + 0.1); // Quick decay
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    
    noise.start(time);
    noise.stop(time + 0.15);
}

// Deep space ambient drone - the foundation of cosmic loneliness
function playDeepSpaceDrone(time, midiNote, duration) {
    if (!audioContext) return;
    
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, time);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, time); // Extremely low cutoff
    filter.Q.setValueAtTime(20, time); // High resonance for that "singing" quality
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.1, time + 2.0); // Very slow attack
    gain.gain.linearRampToValueAtTime(0.05, time + duration - 2.0); // Hold
    gain.gain.linearRampToValueAtTime(0, time + duration); // Slow release
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    
    osc.start(time);
    osc.stop(time + duration + 1.0);
}

// Lonely, fading signal - like a distant transmission
function playLonelySignal(time, midiNote, duration) {
    if (!audioContext) return;
    
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, time);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, time); // Muffled, distant sound
    filter.Q.setValueAtTime(5, time);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.05, time + 1.0); // Slow fade in
    gain.gain.linearRampToValueAtTime(0.02, time + duration - 1.0); // Fade out
    gain.gain.linearRampToValueAtTime(0, time + duration); // Complete fade out
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    
    osc.start(time);
    osc.stop(time + duration + 0.5);
}

// Cosmic pulse - random, metallic sounds from distant machinery
function playCosmicPulse(time) {
    if (!audioContext) return;
    
    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.05, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < output.length; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    noise.buffer = noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(5000, time); // Very bright, metallic
    filter.Q.setValueAtTime(2, time);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.001); // Instant attack
    gain.gain.linearRampToValueAtTime(0, time + 0.05); // Quick decay
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    
    noise.start(time);
    noise.stop(time + 0.06);
}

// Dying heartbeat - the fading pulse of life in the void
function playDyingHeartbeat(time) {
    if (!audioContext) return;
    
    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < output.length; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    noise.buffer = noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(80, time); // Very low, sub-bass pulse
    filter.Q.setValueAtTime(1, time);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.1, time + 0.01); // Weak attack
    gain.gain.linearRampToValueAtTime(0, time + 0.05); // Faint decay
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    
    noise.start(time);
    noise.stop(time + 0.06);
}

// Cosmic harmonic - dissonant, slowly shifting tones
function playCosmicHarmonic(time, midiNote, duration) {
    if (!audioContext) return;
    
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency, time);
    
    // Slow pitch drift for unsettling effect
    osc.frequency.linearRampToValueAtTime(frequency * 1.01, time + duration * 0.5);
    osc.frequency.linearRampToValueAtTime(frequency * 0.99, time + duration);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, time);
    filter.Q.setValueAtTime(3, time);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.08, time + 1.0); // Slow attack
    gain.gain.linearRampToValueAtTime(0.04, time + duration - 1.0); // Hold
    gain.gain.linearRampToValueAtTime(0, time + duration); // Slow release
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    
    osc.start(time);
    osc.stop(time + duration + 0.5);
}

// ALARMING TENSION ELEMENTS - Screeching, dissonant sounds
function playAlarmingTension(time, midiNote, duration) {
    if (!audioContext) return;
    
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    osc.type = 'square'; // Harsh, metallic sound
    osc.frequency.setValueAtTime(frequency, time);
    
    // Rapid pitch wobble for screeching effect
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(20, time); // 20Hz wobble for screech
    lfoGain.gain.setValueAtTime(50, time); // 50 cent modulation
    
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1000, time); // Bright, piercing
    filter.Q.setValueAtTime(1, time);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.2, time + 0.01); // Sharp attack
    gain.gain.linearRampToValueAtTime(0.05, time + duration - 0.1); // Sustain
    gain.gain.linearRampToValueAtTime(0, time + duration); // Quick decay
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    
    lfo.start(time);
    osc.start(time);
    osc.stop(time + duration + 0.1);
    lfo.stop(time + duration + 0.1);
}

// RANDOM ALARM PULSES - Unpredictable, jarring sounds
function playAlarmPulse(time) {
    if (!audioContext) return;
    
    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.03, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < output.length; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    noise.buffer = noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6000, time); // Very bright, metallic click
    filter.Q.setValueAtTime(2, time);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.4, time + 0.001); // Instant attack
    gain.gain.linearRampToValueAtTime(0, time + 0.03); // Very quick decay
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    
    noise.start(time);
    noise.stop(time + 0.04);
}

// Sound effects
function playThrustSound() {
    if (!audioContext) return;
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(masterGain);
    
    osc.start();
    osc.stop(audioContext.currentTime + 0.5);
}

// Alien spaceship sound effect
function playAlienShipSound() {
    if (!audioContext) return;
    
    // Create multiple oscillators for rich, alien sound
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const osc3 = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    // Main carrier wave
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(220, audioContext.currentTime); // A3
    osc1.frequency.linearRampToValueAtTime(110, audioContext.currentTime + 2.0); // Slide down
    
    // Modulation wave for alien effect
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(5, audioContext.currentTime); // 5Hz LFO
    osc2.frequency.linearRampToValueAtTime(2, audioContext.currentTime + 2.0);
    
    // High frequency harmonic
    osc3.type = 'square';
    osc3.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    osc3.frequency.linearRampToValueAtTime(440, audioContext.currentTime + 2.0);
    
    // Filter for that "alien" sound
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, audioContext.currentTime);
    filter.frequency.linearRampToValueAtTime(300, audioContext.currentTime + 2.0);
    filter.Q.setValueAtTime(5, audioContext.currentTime); // Resonant
    
    // Volume envelope
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 1.5);
    gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 2.0);
    
    // Connect modulation
    const modGain = audioContext.createGain();
    modGain.gain.setValueAtTime(20, audioContext.currentTime);
    osc2.connect(modGain);
    modGain.connect(osc1.frequency);
    
    // Connect audio chain
    osc1.connect(filter);
    osc3.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    
    // Start all oscillators
    osc1.start();
    osc2.start();
    osc3.start();
    
    // Stop after duration
    osc1.stop(audioContext.currentTime + 2.0);
    osc2.stop(audioContext.currentTime + 2.0);
    osc3.stop(audioContext.currentTime + 2.0);
}

function playShootSound() {
    if (!audioContext) return;
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(masterGain);
    
    osc.start();
    osc.stop(audioContext.currentTime + 0.1);
}

function playExplosionSound() {
    if (!audioContext) return;
    
    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.3, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < output.length; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    noise.buffer = noiseBuffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    
    noise.start();
    noise.stop(audioContext.currentTime + 0.3);
}

function playPowerUpSound() {
    if (!audioContext) return;
    
    const notes = [60, 64, 67, 72]; // C major arpeggio
    let time = audioContext.currentTime;
    
    notes.forEach((midiNote, index) => {
        const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, time);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.1, time + 0.01);
        gain.gain.linearRampToValueAtTime(0, time + 0.1);
        
        osc.connect(gain);
        gain.connect(masterGain);
        
        osc.start(time);
        osc.stop(time + 0.15);
        
        time += 0.05;
    });
}

// DOM Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const scoreDisplay = document.getElementById('score');
const livesDisplay = document.getElementById('lives');
const finalScoreDisplay = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Input Handling
const keys = {};
let touchControls = {
    left: false,
    right: false,
    thrust: false,
    fire: false
};

// Resize Canvas
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Utility Functions
function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Vector Class
class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    
    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }
    
    mult(n) {
        this.x *= n;
        this.y *= n;
        return this;
    }
    
    copy() {
        return new Vector(this.x, this.y);
    }
    
    magnitude() {
        return Math.sqrt(this.x ** 2 + this.y ** 2);
    }
    
    normalize() {
        const m = this.magnitude();
        if (m > 0) {
            this.x /= m;
            this.y /= m;
        }
        return this;
    }
}

// Ship Class
class Ship {
    constructor() {
        this.pos = new Vector(canvas.width / 2, canvas.height / 2);
        this.vel = new Vector(0, 0);
        this.angle = -Math.PI / 2; // Pointing up
        this.radius = 15;
        this.rotation = 0;
        this.thrusting = false;
        this.thrust = {
            x: 0,
            y: 0
        };
        this.friction = 0.98;
        this.acceleration = 0.5;
        this.invincible = false;
        this.invincibleTimer = 0;
    }
    
    update() {
        // Rotation (slowed down)
        if (keys['ArrowLeft'] || keys['a'] || touchControls.left) {
            this.angle -= 0.05; // Slower rotation
        }
        if (keys['ArrowRight'] || keys['d'] || touchControls.right) {
            this.angle += 0.05; // Slower rotation
        }
        
        // Thrust
        if (keys['ArrowUp'] || keys['w'] || touchControls.thrust) {
            if (thrustFuel > 0) {
                this.thrust.x = this.acceleration * Math.cos(this.angle);
                this.thrust.y = this.acceleration * Math.sin(this.angle);
                this.vel.add(this.thrust);
                this.thrusting = true;
                
                // Consume fuel
                thrustFuel = Math.max(0, thrustFuel - thrustConsumptionRate);
                
                // Play thrust sound
                playThrustSound();
                
                // Massive camera shake when using thrust
                triggerCameraShake(15, 20);
            } else {
                this.thrusting = false;
            }
        } else {
            this.thrusting = false;
        }
        
        // Apply velocity
        this.vel.x *= this.friction;
        this.vel.y *= this.friction;
        this.pos.add(this.vel);
        
        // Screen wrapping
        if (this.pos.x < 0) this.pos.x = canvas.width;
        if (this.pos.x > canvas.width) this.pos.x = 0;
        if (this.pos.y < 0) this.pos.y = canvas.height;
        if (this.pos.y > canvas.height) this.pos.y = 0;
        
        // Invincibility timer
        if (this.invincible) {
            this.invincibleTimer--;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
            }
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);
        
        // Draw ship
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Ship body
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, -this.radius / 1.5);
        ctx.lineTo(-this.radius / 2, 0);
        ctx.lineTo(-this.radius, this.radius / 1.5);
        ctx.closePath();
        ctx.stroke();
        
        // Thruster flame
        if (this.thrusting) {
            ctx.beginPath();
            ctx.moveTo(-this.radius, 0);
            ctx.lineTo(-this.radius - randomRange(5, 15), 0);
            ctx.stroke();
        }
        
        // Invincibility flicker
        if (this.invincible && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    shoot() {
        if (gameState !== 'playing' || !ship) return;
        
        // Check if player has bullets and cooldown is ready (or infinite bullets power-up)
        if ((bulletCount > 0 || powerUpType === 'infinite_bullets') && bulletCooldown <= 0) {
            const bulletSpeed = 10;
            const bulletVel = new Vector(
                bulletSpeed * Math.cos(this.angle),
                bulletSpeed * Math.sin(this.angle)
            );
            
            bullets.push(new Bullet(
                this.pos.x + this.radius * Math.cos(this.angle),
                this.pos.y + this.radius * Math.sin(this.angle),
                bulletVel
            ));
            
            // Consume bullet (unless infinite bullets power-up is active)
            if (powerUpType !== 'infinite_bullets') {
                bulletCount--;
            }
            bulletCooldown = bulletCooldownTime;
            
            // Play shoot sound
            playShootSound();
            
            // Massive camera shake when firing
            triggerCameraShake(8, 10);
        }
    }
    
    hit() {
        if (this.invincible) return;
        
        lives--;
        updateUI();
        
        if (lives <= 0) {
            gameOver();
        } else {
            this.respawn();
        }
    }
    
    respawn() {
        this.pos = new Vector(canvas.width / 2, canvas.height / 2);
        this.vel = new Vector(0, 0);
        this.angle = -Math.PI / 2;
        this.invincible = true;
        this.invincibleTimer = 180; // 3 seconds at 60fps
    }
}

// Bullet Class
class Bullet {
    constructor(x, y, velocity) {
        this.pos = new Vector(x, y);
        this.vel = velocity.copy();
        this.life = 60; // Frames to live
        this.radius = 2;
    }
    
    update() {
        this.pos.add(this.vel);
        this.life--;
        
        // Screen wrapping
        if (this.pos.x < 0) this.pos.x = canvas.width;
        if (this.pos.x > canvas.width) this.pos.x = 0;
        if (this.pos.y < 0) this.pos.y = canvas.height;
        if (this.pos.y > canvas.height) this.pos.y = 0;
    }
    
    draw() {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Asteroid Class
class Asteroid {
    constructor(x, y, size) {
        this.pos = new Vector(x, y);
        this.size = size; // 3 = large, 2 = medium, 1 = small
        this.radius = size * 15;
        this.vel = new Vector(
            randomRange(-1, 1),
            randomRange(-1, 1)
        );
        this.angle = 0;
        this.rotation = randomRange(-0.1, 0.1);
        
        // Create jagged shape
        this.vertices = [];
        const vertCount = 10;
        for (let i = 0; i < vertCount; i++) {
            const angle = (i / vertCount) * Math.PI * 2;
            const offset = randomRange(-this.radius / 4, this.radius / 4);
            this.vertices.push({
                x: Math.cos(angle) * (this.radius + offset),
                y: Math.sin(angle) * (this.radius + offset)
            });
        }
    }
    
    update() {
        this.pos.add(this.vel);
        this.angle += this.rotation;
        
        // Screen wrapping
        if (this.pos.x < -this.radius) this.pos.x = canvas.width + this.radius;
        if (this.pos.x > canvas.width + this.radius) this.pos.x = -this.radius;
        if (this.pos.y < -this.radius) this.pos.y = canvas.height + this.radius;
        if (this.pos.y > canvas.height + this.radius) this.pos.y = -this.radius;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        
        ctx.restore();
    }
    
    break() {
        if (this.size > 1) {
            const newSize = this.size - 1;
            asteroids.push(new Asteroid(this.pos.x, this.pos.y, newSize));
            asteroids.push(new Asteroid(this.pos.x, this.pos.y, newSize));
        }
    }
}

// Alien Spaceship Class
class AlienShip {
    constructor() {
        this.radius = 12;
        this.hitRadius = 20; // Larger hitbox for easier targeting
        this.speed = 4; // Much faster than asteroids
        this.angle = 0;
        this.rotationSpeed = 0.05;
        
        // Spawn at edge of screen
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { // Top
            this.pos = new Vector(randomRange(0, canvas.width), -50);
            this.target = new Vector(randomRange(0, canvas.width), canvas.height + 50);
        } else if (side === 1) { // Right
            this.pos = new Vector(canvas.width + 50, randomRange(0, canvas.height));
            this.target = new Vector(-50, randomRange(0, canvas.height));
        } else if (side === 2) { // Bottom
            this.pos = new Vector(randomRange(0, canvas.width), canvas.height + 50);
            this.target = new Vector(randomRange(0, canvas.width), -50);
        } else { // Left
            this.pos = new Vector(-50, randomRange(0, canvas.height));
            this.target = new Vector(canvas.width + 50, randomRange(0, canvas.height));
        }
        
        // Calculate velocity towards target
        const dx = this.target.x - this.pos.x;
        const dy = this.target.y - this.pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        this.vel = new Vector(
            (dx / distance) * this.speed,
            (dy / distance) * this.speed
        );
        
        this.life = 600; // 10 seconds at 60fps
        this.scoreValue = 500;
    }
    
    update() {
        this.pos.add(this.vel);
        this.angle += this.rotationSpeed;
        this.life--;
        
        // Remove if off screen or time expired
        if (this.pos.x < -100 || this.pos.x > canvas.width + 100 || 
            this.pos.y < -100 || this.pos.y > canvas.height + 100 ||
            this.life <= 0) {
            alienShip = null;
            alienActive = false;
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);
        
        // Draw alien ship (saucer shape)
        ctx.strokeStyle = '#00ff00'; // Bright green for alien
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Saucer body
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.quadraticCurveTo(0, -8, -15, 0);
        ctx.quadraticCurveTo(0, 8, 15, 0);
        ctx.closePath();
        ctx.stroke();
        
        // Cockpit
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.stroke();
        
        // Blinking effect
        if (Math.floor(Date.now() / 200) % 2 === 0) {
            ctx.strokeStyle = '#ffff00'; // Yellow when blinking
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

// Game Objects
let ship;
let bullets = [];
let asteroids = [];
let backgroundAsteroids = [];
let particles = [];
let scorePopups = [];

// Particle System for Explosions
class Particle {
    constructor(x, y, color) {
        this.pos = new Vector(x, y);
        this.vel = new Vector(
            randomRange(-3, 3),
            randomRange(-3, 3)
        );
        this.life = 30;
        this.maxLife = 30;
        this.color = color;
    }
    
    update() {
        this.pos.add(this.vel);
        this.life--;
    }
    
    draw() {
        const alpha = this.life / this.maxLife;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Score Popup System
class ScorePopup {
    constructor(x, y, points) {
        this.pos = new Vector(x, y);
        this.points = points;
        this.life = 60; // Frames to live
        this.maxLife = 60;
        this.velocity = new Vector(0, -2); // Floats upward
    }
    
    update() {
        this.pos.add(this.velocity);
        this.life--;
    }
    
    draw() {
        const alpha = this.life / this.maxLife;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`+${this.points}`, this.pos.x, this.pos.y);
    }
}

// Initialize Game
function init() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    score = 0;
    lives = 3;
    updateUI();
    
    // Initialize audio system
    initAudio();
    
    // Create parallax background stars
    createParallaxStars();
    
    // Create initial asteroids
    createAsteroids(4);
    
    // Create background asteroids (visual only)
    createBackgroundAsteroids(10);
    
    // Force a draw to show the ship and asteroids immediately
    draw();
}

// Create Parallax Stars
function createParallaxStars() {
    parallaxStars = [];
    
    // Create three layers of stars for parallax effect
    for (let layer = 0; layer < 3; layer++) {
        const layerStars = [];
        const starCount = 30 + (layer * 20); // More stars in closer layers
        const speed = 0.5 + (layer * 0.5); // Faster movement for closer layers
        const size = 0.5 + (layer * 0.5); // Larger stars for closer layers
        const alpha = 0.3 + (layer * 0.3); // Brighter stars for closer layers
        
        for (let i = 0; i < starCount; i++) {
            layerStars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: size + Math.random() * 0.5,
                alpha: alpha + Math.random() * 0.2,
                speed: speed
            });
        }
        
        parallaxStars.push(layerStars);
    }
}

function createBackgroundAsteroids(count) {
    for (let i = 0; i < count; i++) {
        const x = randomRange(0, canvas.width);
        const y = randomRange(0, canvas.height);
        const size = randomRange(1, 2); // Smaller background asteroids
        
        backgroundAsteroids.push(new Asteroid(x, y, size));
    }
}

function createAsteroids(count) {
    for (let i = 0; i < count; i++) {
        let x, y;
        do {
            x = randomRange(0, canvas.width);
            y = randomRange(0, canvas.height);
        } while (dist(x, y, ship.pos.x, ship.pos.y) < 100);
        
        asteroids.push(new Asteroid(x, y, 3));
    }
}

// Game Loop
function update() {
    // Always update game objects for proper rendering and movement
    if (ship) {
        ship.update();
    }
    
    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].update();
        if (bullets[i].life <= 0) {
            bullets.splice(i, 1);
        }
    }
    
    // Update asteroids
    for (let i = asteroids.length - 1; i >= 0; i--) {
        asteroids[i].update();
    }
    
    // Update background asteroids (visual only)
    for (let i = backgroundAsteroids.length - 1; i >= 0; i--) {
        backgroundAsteroids[i].update();
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
    
    // Update score popups
    for (let i = scorePopups.length - 1; i >= 0; i--) {
        scorePopups[i].update();
        if (scorePopups[i].life <= 0) {
            scorePopups.splice(i, 1);
        }
    }
    
    // Update camera shake
    updateCameraShake();
    
    // Update bullet cooldown
    if (bulletCooldown > 0) {
        bulletCooldown--;
    }
    
    // Update game systems
    if (gameState === 'playing') {
        updateGameSystems();
        checkCollisions();
        
        // Check win condition
        if (asteroids.length === 0) {
            createAsteroids(4);
            waveNumber++;
            asteroidSpawnRate += 0.1; // Increase difficulty
        }
    }
}

function draw() {
    // Clear screen with trail effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Apply camera shake offset
    ctx.save();
    ctx.translate(cameraShake.offsetX, cameraShake.offsetY);
    
    // Draw parallax stars (background)
    drawParallaxStars();
    
    // Draw game objects only if they exist
    if (ship) {
        ship.draw();
    }
    
    bullets.forEach(bullet => bullet.draw());
    asteroids.forEach(asteroid => asteroid.draw());
    
    // Draw alien ship if active
    if (alienShip) {
        alienShip.draw();
    }
    backgroundAsteroids.forEach(asteroid => {
        // Draw background asteroids with steady brightness (no blinking)
        ctx.save();
        ctx.translate(asteroid.pos.x, asteroid.pos.y);
        ctx.rotate(asteroid.angle);
        
        ctx.strokeStyle = '#ddd'; // Steady light gray for background asteroids
        ctx.lineWidth = 1; // Thinner line for background
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(asteroid.vertices[0].x, asteroid.vertices[0].y);
        for (let i = 1; i < asteroid.vertices.length; i++) {
            ctx.lineTo(asteroid.vertices[i].x, asteroid.vertices[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        
        ctx.restore();
    });
    particles.forEach(particle => particle.draw());
    scorePopups.forEach(popup => popup.draw());
    
    // Restore camera shake
    ctx.restore();
    
    // Draw thrust meter UI
    drawThrustMeter();
    
    // Draw bullet meter UI
    drawBulletMeter();
}

function drawStars() {
    ctx.fillStyle = '#fff';
    // Draw fixed starfield - no randomization or animation
    
    // Create a fixed pattern of stars
    const starCount = 80;
    const starPositions = [];
    
    // Generate fixed star positions based on canvas size
    for (let i = 0; i < starCount; i++) {
        // Use a fixed formula to create consistent star positions
        const x = (i * 157.389) % canvas.width;
        const y = (i * 241.765) % canvas.height;
        const size = (i % 3) + 0.5; // Fixed sizes: 0.5, 1.5, 2.5
        
        starPositions.push({ x, y, size });
    }
    
    // Draw the fixed stars
    starPositions.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Update Parallax Stars
function updateParallaxStars() {
    parallaxOffset += 0.5; // Base movement speed
    
    for (let layerIndex = 0; layerIndex < parallaxStars.length; layerIndex++) {
        const layer = parallaxStars[layerIndex];
        const layerSpeed = (layerIndex + 1) * 0.2; // Each layer moves at different speed
        
        for (let i = 0; i < layer.length; i++) {
            const star = layer[i];
            
            // Move stars based on layer speed and ship velocity
            if (ship) {
                star.y += layerSpeed + (ship.vel.y * 0.1 * (layerIndex + 1));
                star.x += layerSpeed + (ship.vel.x * 0.1 * (layerIndex + 1));
            } else {
                star.y += layerSpeed;
                star.x += layerSpeed;
            }
            
            // Wrap stars around screen
            if (star.y > canvas.height) {
                star.y = -10;
                star.x = Math.random() * canvas.width;
            }
            if (star.x > canvas.width) {
                star.x = -10;
                star.y = Math.random() * canvas.height;
            }
            if (star.y < -10) {
                star.y = canvas.height + 10;
                star.x = Math.random() * canvas.width;
            }
            if (star.x < -10) {
                star.x = canvas.width + 10;
                star.y = Math.random() * canvas.height;
            }
        }
    }
}

// Draw Parallax Stars
function drawParallaxStars() {
    for (let layerIndex = 0; layerIndex < parallaxStars.length; layerIndex++) {
        const layer = parallaxStars[layerIndex];
        
        for (let i = 0; i < layer.length; i++) {
            const star = layer[i];
            
            ctx.globalAlpha = star.alpha;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1.0; // Reset alpha
}

function checkCollisions() {
    // Ship vs Asteroids
    if (!ship.invincible) {
        for (let i = 0; i < asteroids.length; i++) {
            const asteroid = asteroids[i];
            const distance = dist(ship.pos.x, ship.pos.y, asteroid.pos.x, asteroid.pos.y);
            
            if (distance < ship.radius + asteroid.radius) {
                ship.hit();
                createExplosion(ship.pos.x, ship.pos.y, '#fff');
                triggerScreenSplash(ship.pos.x, ship.pos.y);
                triggerCameraShake(10, 15);
                playExplosionSound();
                break;
            }
        }
    }
    
    // Bullets vs Asteroids
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const asteroid = asteroids[j];
            const distance = dist(bullet.pos.x, bullet.pos.y, asteroid.pos.x, asteroid.pos.y);
            
            if (distance < asteroid.radius) {
                // Hit!
                bullets.splice(i, 1);
                asteroid.break();
                createExplosion(asteroid.pos.x, asteroid.pos.y, '#fff');
                triggerScreenSplash(asteroid.pos.x, asteroid.pos.y);
                triggerCameraShake(5, 10);
                playExplosionSound();
                
                // Score points
                const points = asteroid.size * 100;
                score += points;
                updateUI();
                
                // Create score popup
                scorePopups.push(new ScorePopup(asteroid.pos.x, asteroid.pos.y, points));
                
                // Gain thrust fuel from large asteroids
                if (asteroid.size === 3) { // Large asteroid
                    thrustFuel = Math.min(maxThrustFuel, thrustFuel + 30);
                    // Create fuel pickup popup
                    scorePopups.push(new ScorePopup(asteroid.pos.x, asteroid.pos.y - 30, 'FUEL +30'));
                }
                
                // Gain bullets from all asteroids
                bulletCount = Math.min(maxBulletCount, bulletCount + 1);
                // Create bullet pickup popup
                scorePopups.push(new ScorePopup(asteroid.pos.x, asteroid.pos.y + 30, 'BULLETS +1'));
                
                // Remove asteroid
                asteroids.splice(j, 1);
                break;
            }
        }
    }
    
    // Bullets vs Alien Ship
    if (alienShip) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            const distance = dist(bullet.pos.x, bullet.pos.y, alienShip.pos.x, alienShip.pos.y);
            
            if (distance < alienShip.hitRadius) {
                // Hit alien ship!
                bullets.splice(i, 1);
                createExplosion(alienShip.pos.x, alienShip.pos.y, '#00ff00');
                triggerScreenSplash(alienShip.pos.x, alienShip.pos.y);
                triggerCameraShake(10, 15);
                
                // Score points
                score += alienShip.scoreValue;
                updateUI();
                
                // Create score popup
                scorePopups.push(new ScorePopup(alienShip.pos.x, alienShip.pos.y, alienShip.scoreValue));
                
                // Random power-up selection
                const powerUpChoice = Math.random();
                if (powerUpChoice < 0.5) {
                    // Double fuel power-up
                    powerUpActive = true;
                    powerUpType = 'double_fuel';
                    powerUpTimer = 0;
                    thrustConsumptionRate = 1; // Half consumption for 5 seconds
                    
                    // Create power-up popup
                    scorePopups.push(new ScorePopup(alienShip.pos.x, alienShip.pos.y - 40, 'DOUBLE FUEL!'));
                } else {
                    // Infinite bullets power-up
                    powerUpActive = true;
                    powerUpType = 'infinite_bullets';
                    powerUpTimer = 0;
                    
                    // Create power-up popup
                    scorePopups.push(new ScorePopup(alienShip.pos.x, alienShip.pos.y - 40, 'INFINITE BULLETS!'));
                }
                
                // Play power-up sound
                playPowerUpSound();
                
                // Remove alien ship
                alienShip = null;
                alienActive = false;
                break;
            }
        }
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// Screen Splash Effect
function triggerScreenSplash(x, y) {
    // Create white flash effect at impact location
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// Camera Shake Function
function triggerCameraShake(intensity, duration) {
    cameraShake.intensity = intensity;
    cameraShake.duration = duration;
    cameraShake.offsetX = 0;
    cameraShake.offsetY = 0;
}

// Update Camera Shake
function updateCameraShake() {
    if (cameraShake.duration > 0) {
        cameraShake.duration--;
        cameraShake.offsetX = (Math.random() - 0.5) * cameraShake.intensity;
        cameraShake.offsetY = (Math.random() - 0.5) * cameraShake.intensity;
        
        if (cameraShake.duration <= 0) {
            cameraShake.offsetX = 0;
            cameraShake.offsetY = 0;
        }
    }
}

// Update Game Systems
function updateGameSystems() {
    // Update bullet regeneration
    bulletRegenTimer++;
    if (bulletRegenTimer >= bulletRegenInterval) {
        if (bulletCount < maxBulletCount) {
            bulletCount++;
            // Create regen popup
            scorePopups.push(new ScorePopup(ship.pos.x, ship.pos.y - 50, 'REGEN +1'));
        }
        bulletRegenTimer = 0;
    }
    
    // Update alien ship
    if (!alienActive) {
        alienSpawnTimer++;
        if (alienSpawnTimer >= alienSpawnInterval) {
            alienShip = new AlienShip();
            alienActive = true;
            alienSpawnTimer = 0;
            // Play alien ship arrival sound
            playAlienShipSound();
        }
    } else if (alienShip) {
        alienShip.update();
    }
    
// Update power-up timer
    if (powerUpActive) {
        powerUpTimer++;
        if (powerUpTimer >= powerUpDuration) {
            powerUpActive = false;
            powerUpType = '';
            powerUpTimer = 0;
            // Reset normal behavior
            thrustConsumptionRate = 2;
            bulletCooldownTime = 15; // Reset fire rate
            ship.invincible = false; // Remove shield
        }
    }
    
    // Update combo system
    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer <= 0) {
            comboMultiplier = 1;
        }
    }
    
    // Update experience and level system
    if (experience >= experienceToNextLevel) {
        playerLevel++;
        experience = 0;
        experienceToNextLevel = Math.floor(experienceToNextLevel * 1.5);
        // Level up bonus
        maxThrustFuel += 20;
        maxBulletCount += 5;
        thrustFuel = maxThrustFuel;
        bulletCount = maxBulletCount;
        // Create level up popup
        scorePopups.push(new ScorePopup(ship.pos.x, ship.pos.y - 80, `LEVEL ${playerLevel}!`));
    }
    
    // Update difficulty scaling
    if (waveNumber > 1) {
        // Gradually increase asteroid speed and spawn rate
        for (let asteroid of asteroids) {
            if (asteroid.vel.magnitude() < 3) {
                asteroid.vel.mult(1.001); // Slowly speed up asteroids
            }
        }
    }
    
    // Update parallax stars
    updateParallaxStars();
}

// Draw Thrust Meter UI
function drawThrustMeter() {
    // Thrust meter position (top center)
    const meterWidth = 200;
    const meterHeight = 20;
    const meterX = canvas.width / 2 - meterWidth / 2;
    const meterY = 20;
    
    // Draw background
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(meterX, meterY, meterWidth, meterHeight);
    
    // Draw fuel level
    const fuelPercentage = thrustFuel / maxThrustFuel;
    const fuelWidth = meterWidth * fuelPercentage;
    
    // Color based on fuel level
    let fuelColor = '#fff';
    if (thrustFuel < maxThrustFuel * 0.3) {
        fuelColor = '#ff0000'; // Red when low
    }
    
    ctx.fillStyle = fuelColor;
    ctx.fillRect(meterX, meterY, fuelWidth, meterHeight);
    
    // Draw label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('THRUST FUEL', canvas.width / 2, meterY - 5);
    
    // Draw fuel amount
    ctx.fillText(`${Math.floor(thrustFuel)}/${maxThrustFuel}`, canvas.width / 2, meterY + meterHeight + 15);
}

// Draw Bullet Meter UI
function drawBulletMeter() {
    // Bullet meter position (below thrust meter)
    const meterWidth = 200;
    const meterHeight = 20;
    const meterX = canvas.width / 2 - meterWidth / 2;
    const meterY = 50;
    
    // Draw background
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(meterX, meterY, meterWidth, meterHeight);
    
    // Draw bullet level
    const bulletPercentage = bulletCount / maxBulletCount;
    const bulletWidth = meterWidth * bulletPercentage;
    
    // Color based on bullet count
    let bulletColor = '#fff';
    if (bulletCount === 0) {
        bulletColor = '#ff0000'; // Red when empty
    }
    
    ctx.fillStyle = bulletColor;
    ctx.fillRect(meterX, meterY, bulletWidth, meterHeight);
    
    // Draw label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BULLETS', canvas.width / 2, meterY - 5);
    
    // Draw bullet amount
    ctx.fillText(`${bulletCount}/${maxBulletCount}`, canvas.width / 2, meterY + meterHeight + 15);
    
    // Draw cooldown indicator if active
    if (bulletCooldown > 0) {
        const cooldownPercentage = bulletCooldown / bulletCooldownTime;
        const cooldownWidth = meterWidth * cooldownPercentage;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(meterX, meterY, cooldownWidth, meterHeight);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Arial';
        ctx.fillText('RELOADING...', canvas.width / 2, meterY + meterHeight + 30);
    }
}

function updateUI() {
    scoreDisplay.innerText = `SCORE: ${score.toString().padStart(4, '0')}`;
    livesDisplay.innerText = `LIVES: ${lives}`;
}

function gameOver() {
    gameState = 'gameOver';
    gameOverScreen.style.display = 'flex';
    finalScoreDisplay.innerText = `Score: ${score}`;
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('asteroidsHighScore', highScore);
    }
}

// Input Events
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    if (e.code === 'Space') {
        ship.shoot();
    }
    
    if (e.code === 'KeyP' && gameState === 'playing') {
        gameState = 'paused';
    } else if (e.code === 'KeyP' && gameState === 'paused') {
        gameState = 'playing';
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Touch Controls for Mobile
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    // Determine touch zone
    if (x < canvas.width / 3) {
        touchControls.left = true;
    } else if (x > canvas.width * 2 / 3) {
        touchControls.right = true;
    } else {
        touchControls.thrust = true;
    }
}, { passive: false });

canvas.addEventListener('touchend', () => {
    touchControls.left = false;
    touchControls.right = false;
    touchControls.thrust = false;
});

// Button Events
startBtn.addEventListener('click', () => {
    startScreen.style.display = 'none';
    gameState = 'playing';
    init();
});

restartBtn.addEventListener('click', () => {
    gameOverScreen.style.display = 'none';
    gameState = 'playing';
    init();
});

// Main Loop
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// Start the game loop
loop();

// Initial UI
updateUI();