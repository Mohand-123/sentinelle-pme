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
    reponses: {},
    index: 0,
  };

  function afficher(nom) {
    Object.values(ecrans).forEach((e) => (e.hidden = true));
    ecrans[nom].hidden = false;
    window.scrollTo({ top: 0 });
  }

  /* ---------- Écran accueil ---------- */

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

  function rendreRapport() {
    const resultat = scorerAudit(DOMAINES, etat.reponses);
    const risques = topRisques(DOMAINES, etat.reponses, 3);
    const plan = planAction(DOMAINES, etat.reponses);
    const nis2 = perimetreNis2(etat.profil, PROFIL.secteursNis2);
    const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    const barres = resultat.parDomaine
      .map(
        (d) => `
      <div class="barre-domaine">
        <span>${d.icone} ${d.nom}</span>
        <div class="barre-fond"><div class="barre-remplie niveau-${d.niveau.classe}" style="width:${d.pct}%"></div></div>
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
        <div class="rapport-date">${etat.profil.secteur} · ${etat.profil.effectif} · généré le ${date}</div>
      </div>

      <div class="score-global">
        <div class="score-anneau anneau-${resultat.niveau.classe}" style="--pct:${resultat.global}" role="img" aria-label="Score global : ${resultat.global}%">
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
        <button class="btn btn-principal" style="width:auto" onclick="window.print()">🖨️ Imprimer / exporter en PDF</button>
        <button class="btn btn-secondaire" id="btn-refaire">↺ Refaire l'audit</button>
      </div>`;

    $("#btn-refaire").addEventListener("click", () => {
      etat.reponses = {};
      etat.index = 0;
      afficher("accueil");
    });
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
    etat.reponses = { ...REPONSES_DEMO };
    rendreRapport();
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
