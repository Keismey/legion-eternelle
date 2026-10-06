// Effets sonores synthétisés (Web Audio) : aucun fichier à charger.
// Le contexte audio ne démarre qu'après un geste du joueur.
let ctx = null;
let enabled = true;
let master = null;
const lastPlayed = {};

export function setSfx(on) {
  enabled = on;
}

export function unlockAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

function tone({ freq = 440, to = null, type = "sine", duration = 0.12, volume = 1, delay = 0 }) {
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(duration = 0.08, volume = 0.5) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.buffer = buffer;
  src.connect(gain).connect(master);
  src.start();
}

const SOUNDS = {
  hit: () => noise(0.05, 0.25),
  crit: () => {
    noise(0.07, 0.4);
    tone({ freq: 900, to: 500, type: "square", duration: 0.08, volume: 0.25 });
  },
  hurt: () => tone({ freq: 160, to: 90, type: "sawtooth", duration: 0.1, volume: 0.25 }),
  heal: () => tone({ freq: 660, to: 990, duration: 0.15, volume: 0.25 }),
  ultimate: () => {
    tone({ freq: 220, to: 880, type: "sawtooth", duration: 0.35, volume: 0.35 });
    tone({ freq: 440, to: 1320, type: "triangle", duration: 0.35, volume: 0.25, delay: 0.05 });
  },
  combo: () => [0, 0.07, 0.14].forEach((d, i) => tone({ freq: 660 * (1 + i * 0.25), type: "triangle", duration: 0.12, volume: 0.35, delay: d })),
  phase: () => tone({ freq: 110, to: 55, type: "sawtooth", duration: 0.6, volume: 0.45 }),
  boss: () => [0, 0.12, 0.24, 0.36].forEach((d, i) => tone({ freq: [392, 494, 587, 784][i], type: "triangle", duration: 0.22, volume: 0.35, delay: d })),
  loot: () => [0, 0.08, 0.16].forEach((d, i) => tone({ freq: [523, 659, 784][i], type: "sine", duration: 0.2, volume: 0.35, delay: d })),
  legendary: () => [0, 0.09, 0.18, 0.27, 0.36].forEach((d, i) => tone({ freq: [523, 659, 784, 1047, 1319][i], type: "triangle", duration: 0.3, volume: 0.35, delay: d })),
  defeat: () => tone({ freq: 330, to: 110, type: "triangle", duration: 0.5, volume: 0.35 }),
  click: () => tone({ freq: 700, duration: 0.04, volume: 0.15 }),
};

// Limite de fréquence par son, pour éviter la bouillie sonore.
const COOLDOWN = { hit: 90, crit: 120, hurt: 150, heal: 200 };

export function sfx(name) {
  if (!enabled || !ctx || document.hidden || !SOUNDS[name]) return;
  const now = performance.now();
  if (now - (lastPlayed[name] || 0) < (COOLDOWN[name] || 0)) return;
  lastPlayed[name] = now;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  try {
    SOUNDS[name]();
  } catch {
    /* audio indisponible */
  }
}
