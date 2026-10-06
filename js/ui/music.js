// Musique : thème principal et thème de boss, en fondu enchaîné.
// Les volumes sont suivis ici (iOS ignore audio.volume : la bascule y est franche).
const VOLUME = 0.35;
const FADE = 1.2; // secondes pour passer de 0 au volume plein

let tracks = null; // { main, boss } : éléments <audio>
const level = { main: 0, boss: 0 };
let enabled = false;
let mood = "main";
let frame = 0;
let last = 0;

export function initMusic() {
  tracks = { main: document.getElementById("music"), boss: document.getElementById("musicBoss") };
  for (const audio of Object.values(tracks)) audio.volume = 0;
}

export function setMusicEnabled(on) {
  enabled = on;
  apply();
}

// "boss" pendant un combat de boss, "main" le reste du temps.
export function setMusicMood(next) {
  if (next === mood) return;
  mood = next;
  apply();
}

const target = (key) => (enabled && key === mood ? VOLUME : 0);

function apply() {
  if (!tracks) return;
  for (const [key, audio] of Object.entries(tracks)) {
    if (target(key) > 0 && audio.paused) {
      if (key === "boss") audio.currentTime = 0; // le thème de boss repart du début
      audio.play().catch(() => {});
    }
  }
  if (!frame) frame = requestAnimationFrame(tick);
}

function tick(now) {
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
  last = now;
  const step = (VOLUME * dt) / FADE;
  let moving = false;
  for (const [key, audio] of Object.entries(tracks)) {
    const goal = target(key);
    const v = level[key] < goal ? Math.min(goal, level[key] + step) : Math.max(goal, level[key] - step);
    level[key] = v;
    try {
      audio.volume = v;
    } catch {
      /* volume en lecture seule */
    }
    if (v !== goal) moving = true;
    else if (goal === 0 && !audio.paused) audio.pause();
  }
  if (moving) frame = requestAnimationFrame(tick);
  else {
    frame = 0;
    last = 0;
  }
}
