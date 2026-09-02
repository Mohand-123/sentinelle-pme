// Analyse du consultant — fonction serverless Vercel (v2 IA, moteur Gemini).
// Le moteur de scoring (src/engine.js) reste seul juge des notes : ici, l'IA REDIGE, elle ne note pas.
//
// Sécurité by design :
// - Aucun texte libre de l'utilisateur n'entre dans le prompt : secteur/effectif sont validés
//   par liste blanche, les noms de domaines/risques/actions viennent de NOTRE référentiel
//   (revalidés contre lui côté serveur) → surface d'injection de prompt quasi nulle.
// - Corps de requête plafonné, sortie capée, rate-limit par IP (best effort sur lambda chaude).
// - Sans clé API configurée : 503 propre, le front masque la section — le site ne casse jamais.
//
// Fournisseur : API Gemini (tier gratuit, aucune donnée personnelle dans le prompt).
// L'architecture est multi-fournisseur : seul ce fichier change si on rebranche Claude & co.

const { DOMAINES, PROFIL } = require("../data/questions.js");

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const MAX_BODY = 8 * 1024;
const RATE_LIMIT = { max: 6, windowMs: 60_000 };
const buckets = globalThis.__sentinelleBuckets || (globalThis.__sentinelleBuckets = new Map());

// Référentiels de validation (tout vient de data/questions.js — jamais du client).
const NOMS_DOMAINES = new Set(DOMAINES.map((d) => d.nom));
const QUESTIONS = new Set(DOMAINES.flatMap((d) => d.questions.map((q) => q.texte)));
const ACTIONS = new Set(DOMAINES.flatMap((d) => d.questions.map((q) => q.reco.label)));

function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip) || { count: 0, start: now };
  if (now - b.start > RATE_LIMIT.windowMs) {
    b.count = 0;
    b.start = now;
  }
  b.count += 1;
  buckets.set(ip, b);
  return b.count > RATE_LIMIT.max;
}

// Valide et reconstruit le payload à partir de NOS référentiels. Rejette tout le reste.
function valider(body) {
  if (!body || typeof body !== "object") return null;
  const { profil, global: score, parDomaine, risques, actions } = body;
  if (!profil || !PROFIL.secteurs.includes(profil.secteur) || !PROFIL.effectifs.includes(profil.effectif)) return null;
  if (!Number.isInteger(score) || score < 0 || score > 100) return null;
  if (!Array.isArray(parDomaine) || parDomaine.length === 0 || parDomaine.length > 8) return null;
  const domaines = [];
  for (const d of parDomaine) {
    if (!d || !NOMS_DOMAINES.has(d.nom) || !Number.isInteger(d.pct) || d.pct < 0 || d.pct > 100) return null;
    domaines.push({ nom: d.nom, pct: d.pct });
  }
  const topRisques = (Array.isArray(risques) ? risques : [])
    .slice(0, 3)
    .filter((r) => r && QUESTIONS.has(r.question))
    .map((r) => r.question);
  const topActions = (Array.isArray(actions) ? actions : [])
    .slice(0, 8)
    .filter((a) => ACTIONS.has(a));
  return { secteur: profil.secteur, effectif: profil.effectif, score, domaines, topRisques, topActions };
}

const SYSTEME = `Tu es un consultant cybersécurité senior spécialisé PME françaises (GRC, référentiels ANSSI et NIS2).
Tu rédiges la section « Lecture du consultant » d'un rapport d'audit flash déclaratif.
Ton lecteur est un dirigeant de PME non technique : zéro jargon non expliqué, vouvoiement, ton direct et pédagogue — jamais alarmiste, jamais commercial.
Règles strictes :
- Appuie-toi UNIQUEMENT sur les données fournies. N'invente ni chiffre, ni fait, ni obligation légale.
- 3 courts paragraphes (150 à 220 mots au total), séparés par une ligne vide : 1) ce que dit le score, en une lecture d'ensemble ; 2) le point qui mérite l'attention en premier et pourquoi (relie les risques entre eux si pertinent) ; 3) le premier pas concret de la semaine, choisi dans les actions listées.
- Pas de titres, pas de listes, pas de gras, pas d'emojis. Du texte, c'est tout.`;

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "POST uniquement" }));
  }
  if (!process.env.GEMINI_API_KEY) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: "Analyse IA non configurée" }));
  }
  const ip = (req.headers["x-forwarded-for"] || "?").split(",")[0].trim();
  if (rateLimited(ip)) {
    res.statusCode = 429;
    return res.end(JSON.stringify({ error: "Trop de requêtes, réessayez dans une minute" }));
  }
  if (Number(req.headers["content-length"] || 0) > MAX_BODY) {
    res.statusCode = 413;
    return res.end(JSON.stringify({ error: "Requête trop volumineuse" }));
  }

  const donnees = valider(req.body);
  if (!donnees) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "Payload invalide" }));
  }

  const contexte = [
    `Profil : ${donnees.secteur}, ${donnees.effectif}.`,
    `Score global de maturité : ${donnees.score}/100.`,
    `Scores par domaine : ${donnees.domaines.map((d) => `${d.nom} ${d.pct}%`).join(" · ")}.`,
    donnees.topRisques.length ? `Risques principaux détectés : ${donnees.topRisques.join(" | ")}` : "Aucun risque majeur détecté.",
    donnees.topActions.length ? `Actions recommandées (par priorité) : ${donnees.topActions.join(" | ")}` : "Aucune action en attente.",
  ].join("\n");

  try {
    const appel = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEME }] },
        contents: [{ role: "user", parts: [{ text: contexte }] }],
        // thinkingBudget: 0 → les modèles 2.5 « réfléchissent » par défaut et ces tokens
        // comptent dans maxOutputTokens ; sans ça, l'analyse sort tronquée.
        generationConfig: { maxOutputTokens: 1200, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!appel.ok) throw new Error(`Gemini HTTP ${appel.status}`);
    const data = await appel.json();
    const texte = (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || "")
      .join("")
      .trim()
      // le modèle répète parfois le titre de section malgré la consigne — on le retire
      .replace(/^lecture du consultant\s*:?\s*\n+/i, "");
    if (!texte) throw new Error("réponse vide");
    res.statusCode = 200;
    return res.end(JSON.stringify({ narrative: texte }));
  } catch (err) {
    console.error("narrative:", err && err.message);
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: "Analyse indisponible pour le moment" }));
  }
};

module.exports.valider = valider; // exposé pour les tests
