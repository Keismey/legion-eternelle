# Légion Éternelle

Idle RPG navigateur de Keismey Studio. Installable sur mobile (PWA), jouable hors connexion, sans publicité.

## Lancer en local

Les scripts sont des modules ES : il faut un petit serveur, pas un double-clic.

```
npx serve .
```

## Structure

```
index.html          page unique
manifest.json       installation (PWA)
sw.js               hors connexion — changer CACHE à chaque mise en ligne
css/style.css
assets/             images, musique, polices (Cinzel et Sora, licence OFL : assets/fonts)
js/
  main.js           démarrage, actions de l'interface, boucle d'affichage
  data/             tout ce qui se règle sans toucher au code
    config.js       équilibrage (courbes, butin, forge, Éveil…)
    classes.js      rôles et classes
    specs.js        spécialisations et affixes de classe
    bosses.js       boss, sets, monstres
    effects.js      vocabulaire des effets
    i18n.js         textes FR / EN
  core/             logique pure, sans DOM (testable en Node)
    curve.js        formules : une seule courbe de référence
    combat.js       moteur de combat
    game.js         boucle de jeu, récompenses, Éveil, Transcendance
    heroes.js       stats et effets d'un héros
    loot.js         objets, forge, retouche, recyclage
    meta.js         objectifs du jour, codex, Transcendance
    zones.js        campagne et repaires
    state.js        sauvegarde et migration
    storage.js      localStorage (ou compte Claude dans un artefact)
  ui/               affichage
tools/              simulations en ligne de commande (non publié)
```

## Équilibrage

```
node tools/simulate.js 8 --hunt   # 8 h de jeu simulées (ultimes lancés au mieux)
ULT=none node tools/simulate.js 8 # joueur absent : aucun ultime avant l'Instinct
TUNE='{"boss":{"hp":5}}' node tools/simulate.js 4   # essayer un réglage sans toucher config.js
node tools/calibrate.js           # taux de victoire par niveau et qualité d'équipement
```

## Publier une mise à jour

1. Ajouter un bloc en tête de `js/data/patchnotes.js` (version, date, changements FR/EN) : les joueurs voient une pastille sur les réglages.
2. Changer `CACHE` dans `sw.js` pour que les versions installées se mettent à jour.
3. Les réglages d'équilibrage sont tous dans `js/data/config.js` ; `tools/simulate.js` permet de vérifier avant de publier.
