# Matrix Bets

PWA personnelle de pronos foot — affiche le TOP 10 quotidien généré par le pipeline `Equipe Agent IA Foot`, avec analyses détaillées par match (macro/meso/micro/news), calculatrice Kelly fractionné /4 (et /8 sur les paris joueurs) et suivi de bankroll.

URL : https://zzeraf.github.io/matrix-bets/

## Architecture

```
Pipeline PC (00:01 chaque jour)
  ├─ Run_All_Data.cmd           ← collecte Footystats/Flashscore/FotMob
  ├─ Run_All_Analyses_Parallel  ← macro/meso/micro/news + synthèse + TOP 10
  ├─ generate_pwa_data.py       ← pivot JSON vers ce repo
  └─ git push                   ← GitHub Pages déploie en ~1 min
```

Bankroll et historique des paris vivent en `localStorage` côté téléphone (rien dans le repo).

## Structure

- `index.html` — point d'entrée
- `manifest.webmanifest` — config PWA installable
- `sw.js` — service worker (network-first sur data, cache-first sur assets)
- `styles/matrix.css` — palette MATRIX
- `js/` — Alpine.js + logique app
- `data/` — JSON pivot (`latest.json` + `<date>.json` produits par le pipeline)
- `icons/` — icônes 192×192 et 512×512

## Statut

🚧 En construction — squelette posé 2026-05-13.
