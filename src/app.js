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

  /* ---------- Identité visuelle : la matrice des 24 points de contrôle ---------- */

  const code = (d) => d.questions[0].id.slice(0, 3).toUpperCase();
  const codeParNom = Object.fromEntries(DOMAINES.map((d) => [d.nom, code(d)]));
  const CLASSE_REP = { oui: "s-oui", partiel: "s-part", non: "s-non" };
  const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const raf2 = (f) => requestAnimationFrame(() => requestAnimationFrame(f));

  // Les styles ne passent jamais par un attribut HTML (CSP) : on pose les variables via le CSSOM.
  function compter(el, vers, suffixe, duree, delai) {
    if (reduit) { el.textContent = vers + suffixe; return; }
    el.textContent = "0" + suffixe;
    const debut = performance.now() + delai;
    const pas = (now) => {
      const k = Math.min(1, Math.max(0, (now - debut) / duree));
      const e = 1 - Math.pow(1 - k, 4);
      el.textContent = Math.round(vers * e) + suffixe;
      if (k < 1) requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  }

  function initMatriceHero() {
    const conteneur = $(".matrice-hero");
    if (!conteneur) return;
    // Motif illustratif fixe (8 colonnes = 8 domaines, 3 lignes = 3 questions)
    const motif = "oui part non oui oui part non oui  part oui non part oui non part oui  non part oui oui non oui part non".split(/\s+/);
    motif.forEach((s, i) => {
      const c = document.createElement("span");
      c.className = "cellule " + { oui: "s-oui", part: "s-part", non: "s-non" }[s];
      const col = i % 8, ligne = Math.floor(i / 8);
      c.style.setProperty("--d", (col * 0.16 + ligne * 0.06).toFixed(2) + "s");
      conteneur.appendChild(c);
    });
  }

  function initEffets() {
    // Barre de lecture
    const barre = $("#barre-lecture");
    const maj = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      barre.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
    };
    addEventListener("scroll", maj, { passive: true });
    // Lueur qui suit le pointeur sur l'accueil
    const hero = $("#ecran-accueil");
    let attente = false;
    hero.addEventListener("pointermove", (e) => {
      if (attente || reduit) return;
      attente = true;
      requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        hero.style.setProperty("--mx", e.clientX - r.left + "px");
        hero.style.setProperty("--my", e.clientY - r.top + "px");
        attente = false;
      });
    });
    // Raccourcis clavier du questionnaire : 1 / 2 / 3, flèche gauche = retour
    document.addEventListener("keydown", (e) => {
      if (ecrans.questions.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
      if (["1", "2", "3"].includes(e.key)) {
        const b = document.querySelectorAll(".q-choix button")[Number(e.key) - 1];
        if (b) b.click();
      } else if (e.key === "ArrowLeft") {
        const r = $("#btn-retour");
        if (r) r.click();
      }
    });
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
      etat.dernier = null;
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

  // Bande de progression : 24 segments (8 groupes de 3) qui se colorent au fil des réponses.
  function rendreSegments() {
    const cont = $("#segments");
    if (!cont.children.length) {
      cont.innerHTML = DOMAINES.map(
        (d) => `<div class="seg-groupe"><div class="seg-cases">${d.questions
          .map((q) => `<span class="seg" data-q="${q.id}"></span>`).join("")}</div><span class="seg-code">${code(d)}</span></div>`
      ).join("");
    }
    const courant = questionsPlates[etat.index];
    cont.querySelectorAll(".seg").forEach((s) => {
      const rep = etat.reponses[s.dataset.q];
      s.className = "seg" + (rep ? " " + CLASSE_REP[rep] : "") + (s.dataset.q === courant.id ? " courant" : "") + (s.dataset.q === etat.dernier ? " neuf" : "");
    });
    cont.querySelectorAll(".seg-groupe").forEach((g, i) => g.classList.toggle("actif", DOMAINES[i] === courant.domaine));
  }

  function rendreQuestion() {
    const q = questionsPlates[etat.index];
    const total = questionsPlates.length;

    $("#progression-texte").textContent =
      `Question ${etat.index + 1} / ${total} — ${q.domaine.nom}`;
    $("#progression-remplie").style.width = `${Math.round((etat.index / total) * 100)}%`;

    const boutons = CHOIX.map(
      (c, i) => `
      <button data-valeur="${c.valeur}" class="choix-${c.valeur} ${etat.reponses[q.id] === c.valeur ? "choisi" : ""}">
        <span class="choix-marque" aria-hidden="true"></span>
        <span class="choix-texte">
          <span class="choix-libelle">${c.libelle}</span>
          <span class="choix-detail">${c.detail}</span>
        </span>
        <kbd class="choix-touche" aria-hidden="true">${i + 1}</kbd>
      </button>`
    ).join("");

    $("#conteneur-question").innerHTML = `
      <div class="carte">
        <div class="q-domaine"><span class="q-code">${code(q.domaine)}</span>${q.domaine.nom}</div>
        <div class="q-texte">${q.texte}</div>
        <div class="q-aide"><span class="q-aide-mot">Repère</span>${q.aide}</div>
        <div class="q-choix">${boutons}</div>
        <div class="q-nav">
          ${etat.index > 0 ? '<button class="q-retour" id="btn-retour">← Question précédente</button>' : "<span></span>"}
        </div>
      </div>`;

    rendreSegments();

    document.querySelectorAll(".q-choix button").forEach((btn) => {
      btn.addEventListener("click", () => {
        etat.reponses[q.id] = btn.dataset.valeur;
        etat.dernier = q.id;
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
    "30j": "Sous 30 jours — urgent",
    "60j": "Sous 60 jours — important",
    "90j": "Sous 90 jours — à planifier",
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

  // Matrice du rapport : 8 colonnes (domaines) × 3 cases (questions), colorées par réponse.
  function matriceRapport() {
    const cases = questionsPlates.map((q) => etat.reponses[q.id]);
    const n = (v) => cases.filter((x) => x === v).length;
    const colonnes = DOMAINES.map(
      (d) => `<div class="mr-col"><div class="mr-cases">${d.questions
        .map((q) => `<span class="cell ${CLASSE_REP[etat.reponses[q.id]] || ""}"></span>`).join("")}</div><div class="mr-code">${code(d)}</div></div>`
    ).join("");
    return `
      <div class="matrice-rapport">
        <div class="mr-grille" role="img" aria-label="Réponses aux 24 points de contrôle : ${n("oui")} en place, ${n("partiel")} partiels, ${n("non")} absents">${colonnes}</div>
        <div class="mr-legende">
          <span class="leg"><i class="cell s-oui"></i><b>${n("oui")}</b> en place</span>
          <span class="leg"><i class="cell s-part"></i><b>${n("partiel")}</b> partiels</span>
          <span class="leg"><i class="cell s-non"></i><b>${n("non")}</b> absents</span>
        </div>
      </div>`;
  }

  // Apparition au défilement. Le contenu est visible par défaut : la classe .rv n'est posée que par JS,
  // et un filet de sécurité révèle tout au bout de 2 s (onglet en arrière-plan, rendu sans scroll).
  function apparitions(racine) {
    const cibles = racine.querySelectorAll(".rapport-section h2, .risque, .action, .carte, .horizon-titre");
    if (reduit || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entrees) => {
      entrees.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -4% 0px" });
    cibles.forEach((c) => { c.classList.add("rv"); io.observe(c); });
    setTimeout(() => cibles.forEach((c) => c.classList.add("in")), 2200);
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
        <span class="bd-nom"><span class="bd-code">${codeParNom[d.nom] || ""}</span>${d.nom}</span>
        <div class="barre-fond"><div class="barre-remplie niveau-${d.niveau.classe}" data-pct="${d.pct}"></div></div>
        <span class="barre-pct texte-${d.niveau.classe}" data-compte="${d.pct}">${d.pct}%</span>
      </div>`
      )
      .join("");

    const blocRisques = risques.length
      ? risques
          .map(
            (r, i) => `
        <div class="risque">
          <div class="r-rang">${String(i + 1).padStart(2, "0")}</div>
          <div>
            <div class="r-domaine"><span class="bd-code">${codeParNom[r.domaine] || ""}</span>${r.domaine}</div>
            <div class="r-question">${r.question}</div>
          </div>
        </div>`
          )
          .join("")
      : `<p class="rien-a-signaler">Aucun risque majeur détecté sur les points évalués — beau niveau d'hygiène.</p>`;

    const blocsHorizon = ["30j", "60j", "90j"]
      .filter((h) => plan.parHorizon[h].length > 0)
      .map(
        (h) => `
      <div class="horizon-bloc h-${h}">
        <span class="horizon-titre">${LIBELLES_HORIZON[h]}</span>
        ${plan.parHorizon[h]
          .map(
            (a) => `
          <div class="action">
            <span class="a-code">${codeParNom[a.domaine] || ""}</span>
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
      : `<p class="rien-a-signaler">Rien à signaler : toutes les réponses sont « oui ». Prochaine étape : formaliser et tester ce qui existe.</p>`;

    $("#conteneur-rapport").innerHTML = `
      <div class="rapport-entete">
        <h1>Sentinelle PME — rapport d'audit flash</h1>
        ${etat.nom ? `<div class="rapport-nom">${echapper(etat.nom)}</div>` : ""}
        <div class="rapport-date">${etat.profil.secteur} · ${etat.profil.effectif} · généré le ${date}</div>
      </div>

      <div class="score-global">
        <div class="score-anneau anneau-${resultat.niveau.classe}" data-pct="${resultat.global}" role="img" aria-label="Score global : ${resultat.global}%">
          <div class="score-coeur">
            <span class="pct" data-compte="${resultat.global}">${resultat.global}%</span>
            <span class="sur">maturité globale</span>
          </div>
        </div>
        <div class="score-verdict">
          <div class="tampon tampon-${resultat.niveau.classe}"><span class="tampon-mot">Niveau</span><span class="tampon-niveau">${resultat.niveau.label}</span></div>
          <p>${resultat.niveau.phrase}</p>
        </div>
      </div>

      ${matriceRapport()}

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
        <div class="carte nis2-carte nis2-${nis2.statut}">
          <div class="nis2-statut">Périmètre indicatif : ${
            { probable: "probablement concerné", possible: "possiblement concerné (indirectement)", hors: "pas directement concerné" }[nis2.statut]
          }</div>
          <p>${nis2.texte}</p>
          <p class="nis2-avertissement">Indication basée uniquement sur le secteur et l'effectif déclarés.
          Elle ne constitue pas un conseil juridique — la qualification réelle relève d'une analyse au cas par cas.</p>
        </div>
      </div>

      <div class="rapport-actions">
        <button class="btn btn-principal btn-auto" id="btn-imprimer">Imprimer / exporter en PDF</button>
        <button class="btn btn-secondaire btn-auto" id="btn-export">Plan d'action (CSV)</button>
        <button class="btn btn-secondaire" id="btn-refaire">Refaire l'audit</button>
      </div>`;

    /* Styles posés via le CSSOM (la CSP interdit les attributs style= en HTML) */
    const rapport = $("#conteneur-rapport");
    rapport.querySelectorAll(".barre-remplie").forEach((el, i) => el.style.setProperty("--i", i));
    rapport.querySelectorAll(".mr-cases .cell").forEach((el, i) => el.style.setProperty("--i", i));
    rapport.querySelectorAll(".risque, .action").forEach((el, i) => el.style.setProperty("--i", i % 6));
    raf2(() => {
      rapport.querySelectorAll("[data-pct]").forEach((el) => {
        const pct = Number(el.dataset.pct);
        if (el.classList.contains("score-anneau")) el.style.setProperty("--pct", pct);
        else el.style.width = `${pct}%`;
      });
    });
    rapport.querySelectorAll("[data-compte]").forEach((el, i) => {
      const cible = Number(el.dataset.compte);
      const delai = el.classList.contains("pct") ? 250 : 500 + i * 70;
      compter(el, cible, "%", el.classList.contains("pct") ? 1300 : 900, delai);
    });
    apparitions(rapport);
    $("#btn-imprimer").addEventListener("click", () => window.print());
    $("#btn-export").addEventListener("click", () => exporterPlanCsv(plan));
    if (!options.demo) sauverAudit(resultat);

    $("#btn-refaire").addEventListener("click", () => {
      etat.reponses = {};
      etat.dernier = null;
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
  initMatriceHero();
  initEffets();
  if (new URLSearchParams(location.search).has("demo")) {
    lancerDemo();
  } else {
    afficher("accueil");
  }
})();
