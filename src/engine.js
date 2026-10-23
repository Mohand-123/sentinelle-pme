// Moteur de scoring — fonctions pures, sans DOM : tournent dans le navigateur ET sous Node (tests).
// Réponses possibles : "oui" (2 pts), "partiel" (1 pt), "non" (0 pt), pondérées par question.weight.

const POINTS = { oui: 2, partiel: 1, non: 0 };

const NIVEAUX = [
  { min: 80, label: "Solide", classe: "solide", phrase: "Les fondamentaux sont en place — l'enjeu est de maintenir et de formaliser." },
  { min: 60, label: "Correct", classe: "correct", phrase: "Une base existe, mais des angles morts subsistent sur des points importants." },
  { min: 40, label: "Fragile", classe: "fragile", phrase: "Plusieurs protections essentielles manquent : une attaque courante pourrait faire de gros dégâts." },
  { min: 0, label: "Critique", classe: "critique", phrase: "L'entreprise est exposée aux attaques les plus basiques. Les actions à 30 jours sont urgentes." },
];

function niveauPour(pct) {
  return NIVEAUX.find((n) => pct >= n.min);
}

// reponses : { [questionId]: "oui" | "partiel" | "non" }
function scorerDomaine(domaine, reponses) {
  let obtenus = 0;
  let max = 0;
  for (const q of domaine.questions) {
    const rep = reponses[q.id];
    max += POINTS.oui * q.weight;
    obtenus += (POINTS[rep] ?? 0) * q.weight;
  }
  const pct = max === 0 ? 0 : Math.round((obtenus / max) * 100);
  return { id: domaine.id, nom: domaine.nom, icone: domaine.icone, pct, niveau: niveauPour(pct) };
}

function scorerAudit(domaines, reponses) {
  const parDomaine = domaines.map((d) => scorerDomaine(d, reponses));
  let obtenus = 0;
  let max = 0;
  for (const d of domaines) {
    for (const q of d.questions) {
      max += POINTS.oui * q.weight;
      obtenus += (POINTS[reponses[q.id]] ?? 0) * q.weight;
    }
  }
  const global = max === 0 ? 0 : Math.round((obtenus / max) * 100);
  return { global, niveau: niveauPour(global), parDomaine };
}

// Plan d'action : toute question ≠ "oui" génère sa recommandation.
// Priorité = weight (3 critique → 1 important), les "non" avant les "partiel", groupé par horizon.
function planAction(domaines, reponses) {
  const actions = [];
  for (const d of domaines) {
    for (const q of d.questions) {
      const rep = reponses[q.id];
      if (rep === "oui") continue;
      actions.push({
        domaine: d.nom,
        icone: d.icone,
        question: q.texte,
        reponse: rep ?? "non renseigné",
        label: q.reco.label,
        horizon: q.reco.horizon,
        effort: q.reco.effort,
        weight: q.weight,
        refs: q.refs,
      });
    }
  }
  actions.sort((a, b) => b.weight - a.weight || (a.reponse === "non" ? -1 : 1));
  const parHorizon = { "30j": [], "60j": [], "90j": [] };
  for (const a of actions) parHorizon[a.horizon].push(a);
  return { actions, parHorizon };
}

// Top risques = les questions critiques (weight 3) répondues "non", puis weight 2 "non", puis weight 3 "partiel".
function topRisques(domaines, reponses, limite = 3) {
  const gravite = (q, rep) => q.weight * 2 + (rep === "non" ? 1 : 0);
  const risques = [];
  for (const d of domaines) {
    for (const q of d.questions) {
      const rep = reponses[q.id];
      if (rep === "oui" || rep === undefined) continue;
      risques.push({ domaine: d.nom, icone: d.icone, question: q.texte, reponse: rep, poids: gravite(q, rep) });
    }
  }
  risques.sort((a, b) => b.poids - a.poids);
  return risques.slice(0, limite);
}

// Périmètre NIS2 INDICATIF : secteur listé + taille moyenne ou plus (50+ salariés).
// Simplification volontaire et assumée — le rapport l'accompagne d'un avertissement.
function perimetreNis2(profil, secteursNis2) {
  const secteurConcerne = secteursNis2.includes(profil.secteur);
  const tailleConcernee = ["50 à 249 salariés", "250 salariés ou plus"].includes(profil.effectif);
  if (secteurConcerne && tailleConcernee) {
    return { statut: "probable", texte: "Votre secteur figure dans les annexes NIS2 et votre effectif dépasse le seuil des entreprises moyennes : vous êtes probablement dans le périmètre (entité essentielle ou importante)." };
  }
  if (secteurConcerne) {
    return { statut: "possible", texte: "Votre secteur figure dans les annexes NIS2, mais votre taille est sous les seuils usuels. Vous pouvez néanmoins être concerné par ricochet (client ou fournisseur d'entités régulées)." };
  }
  return { statut: "hors", texte: "Votre secteur ne figure pas directement dans les annexes NIS2. Vos clients ou donneurs d'ordres régulés peuvent toutefois vous imposer des exigences par contrat (chaîne d'approvisionnement)." };
}

// Comparaison de deux audits (ancien -> récent) : écarts en points de pourcentage.
// `avant` et `apres` : { global, parDomaine: [{ id, nom, pct }] }.
function comparerAudits(avant, apres) {
  const ancien = new Map((avant.parDomaine || []).map((d) => [d.id, d.pct]));
  const parDomaine = apres.parDomaine
    .filter((d) => ancien.has(d.id))
    .map((d) => ({ id: d.id, nom: d.nom, delta: d.pct - ancien.get(d.id) }));
  const delta = apres.global - avant.global;
  return { delta, tendance: delta > 0 ? "hausse" : delta < 0 ? "baisse" : "stable", parDomaine };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { POINTS, NIVEAUX, scorerDomaine, scorerAudit, planAction, topRisques, perimetreNis2, comparerAudits };
}
