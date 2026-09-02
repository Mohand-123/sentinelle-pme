# Sentinelle PME

Auditeur cyber de poche pour PME : questionnaire de 24 questions → score de maturité par domaine → rapport d'audit avec plan d'action priorisé 30/60/90 jours et indication de périmètre NIS2.

**Projet portfolio B2 Cybersécurité (Ynov Aix) — Amir Mohand Arezki, 2026-2027.**
Voie visée : GRC / gouvernance / consultant cyber. Référentiels utilisés : guide d'hygiène informatique ANSSI, directive NIS2 (art. 21 gestion des risques, art. 23 notification d'incidents).

## Lancer

Aucune dépendance, aucun build :

- double-cliquer sur `index.html`, ou
- servir le dossier : `npx serve .` (ou n'importe quel serveur statique), ou
- déployer sur Vercel : `vercel --prod --yes` dans ce dossier.

## Architecture

```
index.html      — coquille de l'app (wizard + rapport)
style.css       — design (thème "cabinet d'audit")
data/questions.js — référentiel : 8 domaines × 3 questions, pondérations, recommandations, réfs ANSSI/NIS2
src/engine.js   — moteur de scoring pur (testable sans navigateur avec Node)
src/app.js      — UI : wizard de questionnaire, rendu du rapport, impression
```

Choix d'architecture assumés (à raconter en entretien) :

1. **Statique et zéro dépendance** : le moteur de scoring est déterministe et auditable — pas de boîte noire, pas de coût d'hébergement, démo qui marche même sans réseau.
2. **`engine.js` découplé du DOM** : les mêmes fonctions tournent dans le navigateur et sous Node (`node test/smoke.js`), ce qui permet de tester le scoring sans UI.
3. **Le rapport est généré côté client** et imprimable en PDF via la boîte de dialogue du navigateur (`Ctrl+P`).

## Ce que le rapport ne prétend PAS être

Un audit flash déclaratif n'est ni un audit de conformité ni un conseil juridique.
Le périmètre NIS2 affiché est **indicatif** (basé sur secteur + taille) — la qualification réelle relève d'une analyse juridique. C'est écrit en toutes lettres dans le rapport.

## Roadmap

- **v1 (fait)** : questionnaire 8 domaines, scoring pondéré, rapport 30/60/90 j, indication NIS2, impression PDF.
- **v2** : couche IA — narratif du rapport et recommandations contextualisées générés via l'API Claude (fonction serverless Vercel, clé API requise). Le moteur de scoring reste déterministe ; l'IA rédige, elle ne note pas.
- **v3** : export PSSI (politique de sécurité) pré-remplie à partir des réponses ; suivi dans le temps (re-audit et delta).
