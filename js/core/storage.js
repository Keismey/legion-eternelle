// Sauvegarde : compte Claude quand le jeu tourne dans un artefact,
// sinon localStorage (GitHub Pages, PWA, APK), sinon mémoire.
const LOCAL_KEY = "legionEternelle_v2";

// Partie de l'ancienne version (un seul index.html, format incompatible) :
// on ne la reprend pas, mais on la laisse en place et on accueille le joueur.
export function hasLegacySave() {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith("idleAutoRPG_save"));
  } catch {
    return false;
  }
}

function localAdapter() {
  try {
    const probe = "__le_probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
  } catch {
    return null;
  }
  return {
    kind: "local",
    async load() {
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    async save(data) {
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
      } catch {
        /* quota plein ou stockage bloqué : on continue sans */
      }
    },
    async clear() {
      try {
        localStorage.removeItem(LOCAL_KEY);
      } catch {
        /* rien à faire */
      }
    },
  };
}

async function claudeAdapter() {
  if (!window.claude?.use) return null;
  try {
    const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if (!db || !user) return null;
    const id = await user.id();
    if (!id) return null;
    const ref = db.doc(`data/users/${id}/legion`);
    let writing = Promise.resolve();
    return {
      kind: "cloud",
      async load() {
        const snap = await ref.get();
        return snap.exists ? JSON.parse(snap.data().save) : null;
      },
      save(data) {
        // Une écriture à la fois sur le document.
        writing = writing.then(() => ref.set({ save: JSON.stringify(data), at: Date.now() })).catch(() => {});
        return writing;
      },
      async clear() {
        await writing;
        await ref.delete().catch(() => {});
      },
    };
  } catch {
    return null;
  }
}

function memoryAdapter() {
  let data = null;
  return {
    kind: "memory",
    async load() {
      return data;
    },
    async save(next) {
      data = next;
    },
    async clear() {
      data = null;
    },
  };
}

export async function createStorage() {
  const cloud = await claudeAdapter();
  if (cloud) {
    // Reprend une sauvegarde locale existante la première fois.
    const local = localAdapter();
    cloud.load = ((original) => async () => {
      const saved = await original().catch(() => null);
      if (saved) return saved;
      return local ? local.load() : null;
    })(cloud.load);
    return cloud;
  }
  return localAdapter() || memoryAdapter();
}
