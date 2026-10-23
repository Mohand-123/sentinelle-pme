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
- **v2 (fait)** : « Lecture du consultant » — analyse rédigée par IA (`api/narrative.js`, fonction serverless Vercel, API Gemini `gemini-2.5-flash`, appel HTTP natif — toujours zéro dépendance). Le moteur de scoring reste déterministe ; **l'IA rédige, elle ne note pas** — et l'architecture est multi-fournisseur : seul `api/narrative.js` change pour rebrancher Claude ou un autre moteur. Sécurité : aucun texte libre de l'utilisateur n'entre dans le prompt (validation par liste blanche contre le référentiel côté serveur — aucune donnée personnelle envoyée à l'IA), corps de requête plafonné, sortie capée, rate-limit par IP. Sans `GEMINI_API_KEY` configurée sur Vercel, l'endpoint répond 503 et le rapport s'affiche sans la section — dégradation propre.
- **v3 (en partie fait)** : suivi dans le temps — le dernier audit est mémorisé **dans le navigateur uniquement** (`localStorage`) et le rapport suivant affiche l'évolution par domaine (`comparerAudits`, testé) ; nom de l'entreprise facultatif sur le rapport (jamais envoyé) ; export du plan d'action en CSV. **Reste** : export PSSI (politique de sécurité) pré-remplie à partir des réponses.
- **Durcissement (fait)** : CSP stricte (`default-src 'none'`, scripts/styles/polices `'self'` uniquement, aucun style ni script en ligne), en-têtes HSTS / nosniff / anti-framing / Permissions-Policy dans `vercel.json`, polices Source Serif 4 et Public Sans **hébergées** (aucune requête vers Google Fonts). Texte de confidentialité aligné sur la réalité : seuls secteur, effectif, scores et points faibles partent vers l'API Gemini, jamais le nom de l'entreprise.
- **Identité visuelle (fait)** : refonte du CSS autour de la **matrice des 24 points de contrôle** (8 domaines × 3 questions) — balayage animé à l'accueil, bande de progression qui se colore au fil des réponses, carte des réponses + tampon de niveau + barres et score qui se remplissent dans le rapport. Palette graphite / vert signal, codes de domaine en police mono (plus d'emojis), raccourcis clavier 1-2-3. Mouvement réduit et impression respectés (états finaux, couleurs conservées), le tout sans style ni script en ligne (CSP).
