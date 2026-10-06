// Notes de mise à jour, de la plus récente à la plus ancienne.
// Pour un patch : ajouter un bloc en tête (version, date, changements FR/EN),
// et changer CACHE dans sw.js pour que les joueurs reçoivent la mise à jour.
export const PATCHNOTES = [
  {
    version: "2.0.1",
    date: "2026-10-06",
    fr: ["Le bouton Combat passe au centre de la barre du bas, en plus grand."],
    en: ["The Battle button moves to the center of the bottom bar, and gets bigger."],
  },
  {
    version: "2.0",
    date: "2026-10-06",
    fr: [
      "Refonte complète du jeu : nouveau moteur de combat en temps réel, nouvelle interface pensée pour le téléphone.",
      "Ultimes : touchez un héros quand sa jauge dorée est pleine. La jauge se garde d'une vague à l'autre, et les ultimes enchaînés font des combos.",
      "Équipement à gérer soi-même : raretés, 12 légendaires uniques, pièces de set, forge, recyclage et comparaison par appui long.",
      "16 classes à débloquer, chacune avec deux spécialisations au niveau 30.",
      "8 boss avec leur repaire, des élites, une phase 2 sous 50 % de PV et des boss corrompus au-delà du niveau 40.",
      "Éveil et Transcendance pour aller toujours plus loin.",
      "Défis : 25 succès et une tour d'épreuves qui change chaque semaine.",
      "Tutoriel au premier lancement, astuces au bon moment, objectifs du jour.",
      "Nouvelles illustrations, jeu installable et jouable hors connexion, en français et en anglais. Toujours gratuit et sans pub.",
    ],
    en: [
      "Complete rebuild: new real-time combat engine and a new interface designed for phones.",
      "Ultimates: tap a hero when their golden gauge is full. The gauge carries over between waves, and chained ultimates trigger combos.",
      "Hands-on gear: rarities, 12 unique legendaries, set pieces, forge, salvage and long-press comparison.",
      "16 classes to unlock, each with two specializations at level 30.",
      "8 bosses with their own lair, elites, a phase 2 below 50% HP and corrupted bosses beyond level 40.",
      "Awakening and Transcendence to push ever further.",
      "Challenges: 25 achievements and a trial tower that changes every week.",
      "First-launch tutorial, timely tips and daily goals.",
      "New artwork, installable and playable offline, in French and English. Still free with no ads.",
    ],
  },
];

export const GAME_VERSION = PATCHNOTES[0].version;
