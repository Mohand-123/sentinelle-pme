// UI de l'audit flash : wizard une-question-à-la-fois, puis rendu du rapport.
// Toute la logique de calcul vit dans src/engine.js — ici on ne fait que de l'affichage.

(function () {
  const $ = (sel) => document.querySelector(sel);

  const ecrans = {
    accueil: $("#ecran-accueil"),
    questions: $("#ecran-questions"),
    rapport: $("#ecran-rapport"),
  };

  // Liste plate des questions, dans l'ordre des domaines.
  const questionsPlates = DOMAINES.flatMap((d) => d.questions.map((q) => ({ ...q, domaine: d })));

  const etat = {
    profil: { secteur: null, effectif: null },
    nom: "",
    reponses: {},
    index: 0,
  };

  function afficher(nom) {
    Object.values(ecrans).forEach((e) => (e.hidden = true));
    ecrans[nom].hidden = false;
    window.scrollTo({ top: 0 });
  }

  /* ---------- Écran accueil ---------- */

  function echapper(t) {
    const d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
  }

  function initAccueil() {
    const selSecteur = $("#profil-secteur");
    const selEffectif = $("#profil-effectif");
    for (const s of PROFIL.secteurs) {
      selSecteur.appendChild(new Option(s, s));
    }
    for (const e of PROFIL.effectifs) {
      selEffectif.appendChild(new Option(e, e));
    }
    $("#btn-commencer").addEventListener("click", () => {
      etat.profil.secteur = selSecteur.value;
      etat.profil.effectif = selEffectif.value;
      etat.nom = $("#profil-nom").value.trim();
      etat.index = 0;
      afficher("questions");
      rendreQuestion();
    });
  }

  /* ---------- Écran questionnaire ---------- */

  const CHOIX = [
    { valeur: "oui", libelle: "Oui", detail: "C'est en place et ça fonctionne." },
    { valeur: "partiel", libelle: "En partie", detail: "C'est partiel, pas systématique, ou je n'en suis pas sûr." },
    { valeur: "non", libelle: "Non", detail: "Ce n'est pas en place." },
  ];

  function rendreQuestion() {
    const q = questionsPlates[etat.index];
    const total = questionsPlates.length;

    $("#progression-texte").textContent =
      `Question ${etat.index + 1} / ${total} — ${q.domaine.icone} ${q.domaine.nom}`;
    $("#progression-remplie").style.width = `${Math.round((etat.index / total) * 100)}%`;

    const boutons = CHOIX.map(
      (c) => `
      <button data-valeur="${c.valeur}" class="${etat.reponses[q.id] === c.valeur ? "choisi" : ""}">
        <span class="choix-libelle">${c.libelle}</span>
        <span class="choix-detail">${c.detail}</span>
      </button>`
    ).join("");

    $("#conteneur-question").innerHTML = `
      <div class="carte">
        <div class="q-domaine">${q.domaine.icone} ${q.domaine.nom}</div>
        <div class="q-texte">${q.texte}</div>
        <div class="q-aide">💡 ${q.aide}</div>
        <div class="q-choix">${boutons}</div>
        <div class="q-nav">
          ${etat.index > 0 ? '<button class="q-retour" id="btn-retour">← Question précédente</button>' : "<span></span>"}
        </div>
      </div>`;

    document.querySelectorAll(".q-choix button").forEach((btn) => {
      btn.addEventListener("click", () => {
        etat.reponses[q.id] = btn.dataset.valeur;
        if (etat.index < total - 1) {
          etat.index += 1;
          rendreQuestion();
        } else {
          rendreRapport();
          afficher("rapport");
        }
      });
    });

    const retour = $("#btn-retour");
    if (retour) {
      retour.addEventListener("click", () => {
        etat.index -= 1;
        rendreQuestion();
      });
    }
  }

  /* ---------- Écran rapport ---------- */

  const LIBELLES_HORIZON = {
    "30j": "🔴 Sous 30 jours — urgent",
    "60j": "🟠 Sous 60 jours — important",
    "90j": "🟡 Sous 90 jours — à planifier",
  };

  const CLE_HISTORIQUE = "sentinelle-pme:dernier-audit";

  function lireDernierAudit() {
    try {
      const brut = localStorage.getItem(CLE_HISTORIQUE);
      const audit = brut ? JSON.parse(brut) : null;
      return audit && typeof audit.global === "number" && Array.isArray(audit.parDomaine) ? audit : null;
    } catch (e) {
      return null;
    }
  }

  function sauverAudit(resultat) {
    try {
      localStorage.setItem(
        CLE_HISTORIQUE,
        JSON.stringify({
          date: new Date().toISOString(),
          global: resultat.global,
          parDomaine: resultat.parDomaine.map((d) => ({ id: d.id, nom: d.nom, pct: d.pct })),
        })
      );
    } catch (e) {
      /* stockage indisponible : le rapport fonctionne sans historique */
    }
  }

  const signe = (n) => (n > 0 ? `+${n}` : `${n}`);

  function blocEvolution(precedent, resultat) {
    if (!precedent) return "";
    const cmp = comparerAudits(precedent, resultat);
    const quand = new Date(precedent.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const lignes = cmp.parDomaine
      .filter((d) => d.delta !== 0)
      .map((d) => `<li><span>${d.nom}</span> <strong class="${d.delta > 0 ? "texte-solide" : "texte-critique"}">${signe(d.delta)} pts</strong></li>`)
      .join("");
    const titre = { hausse: "Progression", baisse: "Recul", stable: "Score inchangé" }[cmp.tendance];
    return `
      <div class="rapport-section">
        <h2>Évolution depuis votre dernier audit</h2>
        <div class="carte evolution-carte">
          <div class="evolution-titre">${titre} : ${precedent.global}% → ${resultat.global}% (<strong>${signe(cmp.delta)} pts</strong>) · audit du ${quand}</div>
          ${lignes ? `<ul class="evolution-liste">${lignes}</ul>` : "<p>Aucun domaine n'a changé de score.</p>"}
        </div>
      </div>`;
  }

  function exporterPlanCsv(plan) {
    const cellule = (t) => `"${String(t).replace(/"/g, '""')}"`;
    const lignes = [["Horizon", "Domaine", "Action", "Effort", "Références"]].concat(
      plan.actions
        .slice()
        .sort((a, b) => a.horizon.localeCompare(b.horizon))
        .map((a) => [a.horizon, a.domaine, a.label, a.effort, a.refs.join(" ; ")])
    );
    const csv = "﻿" + lignes.map((l) => l.map(cellule).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "plan-action-sentinelle.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function rendreRapport(options = {}) {
    const resultat = scorerAudit(DOMAINES, etat.reponses);
    const risques = topRisques(DOMAINES, etat.reponses, 3);
    const plan = planAction(DOMAINES, etat.reponses);
    const nis2 = perimetreNis2(etat.profil, PROFIL.secteursNis2);
    const precedent = options.demo ? null : lireDernierAudit();
    const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    const barres = resultat.parDomaine
      .map(
        (d) => `
      <div class="barre-domaine">
        <span>${d.icone} ${d.nom}</span>
        <div class="barre-fond"><div class="barre-remplie niveau-${d.niveau.classe}" data-pct="${d.pct}"></div></div>
        <span class="barre-pct texte-${d.niveau.classe}">${d.pct}%</span>
      </div>`
      )
      .join("");

    const blocRisques = risques.length
      ? risques
          .map(
            (r, i) => `
        <div class="risque">
          <div class="r-rang">${i + 1}</div>
          <div>
            <div class="r-domaine">${r.icone} ${r.domaine}</div>
            <div class="r-question">${r.question}</div>
          </div>
        </div>`
          )
          .join("")
      : `<p>✅ Aucun risque majeur détecté sur les points évalués — beau niveau d'hygiène.</p>`;

    const blocsHorizon = ["30j", "60j", "90j"]
      .filter((h) => plan.parHorizon[h].length > 0)
      .map(
        (h) => `
      <div class="horizon-bloc">
        <span class="horizon-titre">${LIBELLES_HORIZON[h]}</span>
        ${plan.parHorizon[h]
          .map(
            (a) => `
          <div class="action">
            <span class="a-poids">${a.icone}</span>
            <div>
              <div class="a-label">${a.label}</div>
              <div class="a-meta">Effort : ${a.effort} · ${a.domaine} · Réf : ${a.refs.join(" · ")}</div>
            </div>
          </div>`
          )
          .join("")}
      </div>`
      )
      .join("");

    const planHtml = plan.actions.length
      ? blocsHorizon
      : `<p>✅ Rien à signaler : toutes les réponses sont « oui ». Prochaine étape : formaliser et tester ce qui existe.</p>`;

    $("#conteneur-rapport").innerHTML = `
      <div class="rapport-entete">
        <h1>Sentinelle PME — rapport d'audit flash</h1>
        ${etat.nom ? `<div class="rapport-nom">${echapper(etat.nom)}</div>` : ""}
        <div class="rapport-date">${etat.profil.secteur} · ${etat.profil.effectif} · généré le ${date}</div>
      </div>

      <div class="score-global">
        <div class="score-anneau anneau-${resultat.niveau.classe}" data-pct="${resultat.global}" role="img" aria-label="Score global : ${resultat.global}%">
          <div class="score-coeur">
            <span class="pct">${resultat.global}%</span>
            <span class="sur">maturité globale</span>
          </div>
        </div>
        <div class="score-verdict">
          <div class="niveau texte-${resultat.niveau.classe}">Niveau : ${resultat.niveau.label}</div>
          <p>${resultat.niveau.phrase}</p>
        </div>
      </div>

      ${blocEvolution(precedent, resultat)}

      <div class="rapport-section">
        <h2>Maturité par domaine</h2>
        <div class="barres-domaines">${barres}</div>
      </div>

      <div class="rapport-section">
        <h2>Vos ${risques.length > 1 ? risques.length + " risques principaux" : "risques principaux"}</h2>
        ${blocRisques}
      </div>

      <div class="rapport-section">
        <h2>Plan d'action priorisé</h2>
        ${planHtml}
      </div>

      <div class="rapport-section" id="section-consultant" hidden>
        <h2>Lecture du consultant</h2>
        <div class="carte consultant-carte">
          <div id="consultant-contenu" class="consultant-attente">Analyse en cours de rédaction…</div>
          <p class="consultant-note">Rédigée par IA à partir de vos seuls résultats chiffrés — le score, lui, est calculé par un moteur déterministe.</p>
        </div>
      </div>

      <div class="rapport-section">
        <h2>Et la directive NIS2 ?</h2>
        <div class="carte nis2-carte">
          <div class="nis2-statut">Périmètre indicatif : ${
            { probable: "⚠️ probablement concerné", possible: "🟠 possiblement concerné (indirectement)", hors: "🟢 pas directement concerné" }[nis2.statut]
          }</div>
          <p>${nis2.texte}</p>
          <p class="nis2-avertissement">Indication basée uniquement sur le secteur et l'effectif déclarés.
          Elle ne constitue pas un conseil juridique — la qualification réelle relève d'une analyse au cas par cas.</p>
        </div>
      </div>

      <div class="rapport-actions">
        <button class="btn btn-principal btn-auto" id="btn-imprimer">🖨️ Imprimer / exporter en PDF</button>
        <button class="btn btn-secondaire btn-auto" id="btn-export">⬇️ Plan d'action (CSV)</button>
        <button class="btn btn-secondaire" id="btn-refaire">↺ Refaire l'audit</button>
      </div>`;

    /* Styles posés via le CSSOM (la CSP interdit les attributs style= en HTML) */
    document.querySelectorAll("#conteneur-rapport [data-pct]").forEach((el) => {
      const pct = Number(el.dataset.pct);
      if (el.classList.contains("score-anneau")) el.style.setProperty("--pct", pct);
      else el.style.width = `${pct}%`;
    });
    $("#btn-imprimer").addEventListener("click", () => window.print());
    $("#btn-export").addEventListener("click", () => exporterPlanCsv(plan));
    if (!options.demo) sauverAudit(resultat);

    $("#btn-refaire").addEventListener("click", () => {
      etat.reponses = {};
      etat.index = 0;
      afficher("accueil");
    });

    chargerAnalyseConsultant(resultat, risques, plan);
  }

  // v2 IA : demande l'analyse rédigée à la fonction serverless.
  // Ne tourne que servi en HTTP (pas en file://) ; en cas d'échec ou d'API non
  // configurée, la section reste masquée — le rapport est complet sans elle.
  async function chargerAnalyseConsultant(resultat, risques, plan) {
    if (!location.protocol.startsWith("http")) return;
    const section = $("#section-consultant");
    const contenu = $("#consultant-contenu");
    section.hidden = false;
    try {
      const rep = await fetch("/api/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profil: etat.profil,
          global: resultat.global,
          parDomaine: resultat.parDomaine.map((d) => ({ nom: d.nom, pct: d.pct })),
          risques: risques.map((r) => ({ question: r.question })),
          actions: plan.actions.slice(0, 8).map((a) => a.label),
        }),
      });
      if (!rep.ok) throw new Error(String(rep.status));
      const { narrative } = await rep.json();
      contenu.classList.remove("consultant-attente");
      contenu.textContent = "";
      for (const paragraphe of narrative.split(/\n\s*\n/)) {
        const p = document.createElement("p");
        p.textContent = paragraphe.trim();
        contenu.appendChild(p);
      }
    } catch {
      section.hidden = true;
    }
  }

  /* ---------- Mode démo : rapport d'exemple pré-rempli ---------- */
  // Profil fictif "PME santé de 60 salariés" avec des réponses volontairement mitigées,
  // pour montrer un rapport réaliste (risques + plan d'action + NIS2 probable).
  const REPONSES_DEMO = {
    gov1: "non", gov2: "partiel", gov3: "non",
    sav1: "oui", sav2: "non", sav3: "non",
    maj1: "oui", maj2: "partiel", maj3: "non",
    acc1: "partiel", acc2: "non", acc3: "oui",
    sen1: "non", sen2: "partiel", sen3: "partiel",
    pro1: "oui", pro2: "oui", pro3: "partiel",
    inc1: "non", inc2: "non", inc3: "partiel",
    fou1: "partiel", fou2: "non", fou3: "non",
  };

  function lancerDemo() {
    etat.profil = { secteur: "Santé", effectif: "50 à 249 salariés" };
    etat.nom = "";
    etat.reponses = { ...REPONSES_DEMO };
    rendreRapport({ demo: true });
    afficher("rapport");
  }

  $("#btn-demo").addEventListener("click", lancerDemo);

  initAccueil();
  if (new URLSearchParams(location.search).has("demo")) {
    lancerDemo();
  } else {
    afficher("accueil");
  }
})();
