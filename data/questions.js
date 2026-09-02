// Référentiel de l'audit flash — 8 domaines × 3 questions.
// Sources d'inspiration : guide d'hygiène informatique ANSSI, directive NIS2 (art. 21 & 23).
// weight : 1 = important, 2 = majeur, 3 = critique (pèse sur le score ET la priorité des recos).
// horizon : échéance conseillée de la recommandation si la réponse n'est pas "oui".

const SECTEURS_NIS2 = [
  "Énergie", "Transports", "Banque / finance", "Santé", "Eau potable / assainissement",
  "Infrastructure numérique / télécoms", "Administration publique", "Espace",
  "Services postaux", "Gestion des déchets", "Chimie", "Agroalimentaire",
  "Industrie / fabrication", "Fournisseurs numériques (marketplace, cloud, moteur de recherche)",
  "Recherche",
];

const SECTEURS_AUTRES = [
  "Commerce / e-commerce", "Restauration / hôtellerie", "BTP / immobilier",
  "Services aux entreprises", "Artisanat", "Autre",
];

const PROFIL = {
  secteurs: [...SECTEURS_NIS2, ...SECTEURS_AUTRES],
  secteursNis2: SECTEURS_NIS2,
  effectifs: ["1 à 9 salariés", "10 à 49 salariés", "50 à 249 salariés", "250 salariés ou plus"],
};

const DOMAINES = [
  {
    id: "gouvernance",
    nom: "Gouvernance & organisation",
    icone: "🏛️",
    questions: [
      {
        id: "gov1",
        texte: "Une personne est-elle clairement responsable de la sécurité informatique dans l'entreprise ?",
        aide: "Même sans RSSI dédié : un dirigeant ou un référent identifié, qui sait qu'il porte le sujet.",
        weight: 3,
        reco: { label: "Désigner un référent cybersécurité (même non expert) et l'écrire noir sur blanc", horizon: "30j", effort: "faible" },
        refs: ["NIS2 art. 21 — gouvernance des risques"],
      },
      {
        id: "gov2",
        texte: "Avez-vous un inventaire à jour de vos équipements, logiciels et données importantes ?",
        aide: "On ne protège pas ce qu'on ne connaît pas : liste des PC, serveurs, logiciels, et où sont les données sensibles.",
        weight: 2,
        reco: { label: "Établir un inventaire simple (tableur suffisant) des matériels, logiciels et données critiques", horizon: "60j", effort: "moyen" },
        refs: ["ANSSI hygiène — connaître le système d'information"],
      },
      {
        id: "gov3",
        texte: "Existe-t-il des règles de sécurité écrites, même courtes, connues des salariés ?",
        aide: "Une charte informatique d'une page vaut mieux qu'une politique de 40 pages que personne ne lit.",
        weight: 1,
        reco: { label: "Rédiger une charte informatique d'une page et la faire signer aux salariés", horizon: "90j", effort: "faible" },
        refs: ["NIS2 art. 21 — politiques de sécurité"],
      },
    ],
  },
  {
    id: "sauvegardes",
    nom: "Sauvegardes & continuité",
    icone: "💾",
    questions: [
      {
        id: "sav1",
        texte: "Vos données importantes sont-elles sauvegardées régulièrement et automatiquement ?",
        aide: "Sauvegarde manuelle « quand on y pense » = pas de sauvegarde.",
        weight: 3,
        reco: { label: "Mettre en place une sauvegarde automatique quotidienne des données critiques", horizon: "30j", effort: "moyen" },
        refs: ["ANSSI hygiène — sauvegardes", "NIS2 art. 21 — continuité d'activité"],
      },
      {
        id: "sav2",
        texte: "Au moins une copie de sauvegarde est-elle hors ligne ou hors site (cloud, disque déconnecté) ?",
        aide: "Un ransomware chiffre aussi les sauvegardes connectées au réseau. Il faut une copie qu'il ne peut pas atteindre.",
        weight: 3,
        reco: { label: "Ajouter une copie de sauvegarde déconnectée ou dans un cloud séparé (règle 3-2-1)", horizon: "30j", effort: "moyen" },
        refs: ["ANSSI hygiène — sauvegardes hors ligne"],
      },
      {
        id: "sav3",
        texte: "Avez-vous déjà testé une restauration de sauvegarde ?",
        aide: "Une sauvegarde jamais testée est une loterie : on découvre qu'elle est vide le jour où on en a besoin.",
        weight: 2,
        reco: { label: "Planifier un test de restauration réel (un fichier, puis un poste complet) chaque trimestre", horizon: "60j", effort: "faible" },
        refs: ["NIS2 art. 21 — continuité d'activité"],
      },
    ],
  },
  {
    id: "majs",
    nom: "Mises à jour",
    icone: "🔄",
    questions: [
      {
        id: "maj1",
        texte: "Les systèmes (Windows, macOS…) et logiciels sont-ils maintenus à jour automatiquement ?",
        aide: "La majorité des attaques exploitent des failles déjà corrigées par des mises à jour non appliquées.",
        weight: 3,
        reco: { label: "Activer les mises à jour automatiques sur tous les postes et serveurs", horizon: "30j", effort: "faible" },
        refs: ["ANSSI hygiène — mises à jour"],
      },
      {
        id: "maj2",
        texte: "Utilisez-vous uniquement des systèmes et logiciels encore supportés par leur éditeur ?",
        aide: "Un Windows ou un logiciel en fin de vie ne reçoit plus de correctifs : chaque faille découverte reste ouverte à vie.",
        weight: 2,
        reco: { label: "Identifier les systèmes obsolètes et planifier leur remplacement ou isolement", horizon: "90j", effort: "élevé" },
        refs: ["ANSSI hygiène — obsolescence"],
      },
      {
        id: "maj3",
        texte: "Les équipements réseau (box, routeur, Wi-Fi, NAS) sont-ils aussi mis à jour ?",
        aide: "Le firmware de la box ou du NAS est souvent oublié — c'est pourtant la porte d'entrée du réseau.",
        weight: 1,
        reco: { label: "Vérifier et mettre à jour le firmware des équipements réseau, puis le refaire 2×/an", horizon: "60j", effort: "faible" },
        refs: ["ANSSI hygiène — équipements réseau"],
      },
    ],
  },
  {
    id: "acces",
    nom: "Mots de passe & accès",
    icone: "🔐",
    questions: [
      {
        id: "acc1",
        texte: "La double authentification (MFA) est-elle activée sur les comptes importants (email, banque, cloud, admin) ?",
        aide: "Le MFA bloque l'immense majorité des piratages de comptes, même si le mot de passe fuite.",
        weight: 3,
        reco: { label: "Activer le MFA sur l'email professionnel, la banque, le cloud et tous les comptes administrateur", horizon: "30j", effort: "faible" },
        refs: ["NIS2 art. 21 — authentification multifacteur"],
      },
      {
        id: "acc2",
        texte: "Chaque salarié a-t-il son propre compte, avec des mots de passe uniques et robustes ?",
        aide: "Comptes partagés et mot de passe unique réutilisé partout : une seule fuite compromet tout.",
        weight: 2,
        reco: { label: "Supprimer les comptes partagés et déployer un gestionnaire de mots de passe", horizon: "60j", effort: "moyen" },
        refs: ["ANSSI hygiène — authentification"],
      },
      {
        id: "acc3",
        texte: "Les accès sont-ils retirés immédiatement quand un salarié ou prestataire part ?",
        aide: "Les comptes fantômes d'anciens salariés sont un grand classique des intrusions.",
        weight: 2,
        reco: { label: "Créer une checklist de départ : désactivation des comptes et récupération du matériel le jour J", horizon: "60j", effort: "faible" },
        refs: ["NIS2 art. 21 — contrôle d'accès"],
      },
    ],
  },
  {
    id: "sensibilisation",
    nom: "Sensibilisation des équipes",
    icone: "🎓",
    questions: [
      {
        id: "sen1",
        texte: "Les salariés sont-ils sensibilisés au phishing (hameçonnage) au moins une fois par an ?",
        aide: "Le phishing est le point de départ de la plupart des attaques contre les PME.",
        weight: 3,
        reco: { label: "Organiser une sensibilisation phishing annuelle (atelier d'1 h ou module en ligne)", horizon: "60j", effort: "faible" },
        refs: ["NIS2 art. 21 — cyberhygiène et formation"],
      },
      {
        id: "sen2",
        texte: "Les salariés savent-ils à qui signaler un email ou un comportement suspect ?",
        aide: "Un signalement rapide peut stopper une attaque en cours. Encore faut-il savoir qui prévenir.",
        weight: 2,
        reco: { label: "Définir et afficher le canal de signalement (une adresse ou une personne, réponse sans blâme)", horizon: "30j", effort: "faible" },
        refs: ["ANSSI hygiène — sensibilisation"],
      },
      {
        id: "sen3",
        texte: "Les dirigeants eux-mêmes appliquent-ils les règles de sécurité ?",
        aide: "Les dirigeants sont les cibles n°1 (fraude au président) et donnent le ton : s'ils contournent les règles, tout le monde le fera.",
        weight: 1,
        reco: { label: "Faire suivre aux dirigeants la même sensibilisation que les équipes, MFA en tête", horizon: "90j", effort: "faible" },
        refs: ["NIS2 art. 20 — responsabilité des organes de direction"],
      },
    ],
  },
  {
    id: "protection",
    nom: "Protection réseau & postes",
    icone: "🛡️",
    questions: [
      {
        id: "pro1",
        texte: "Tous les postes ont-ils un antivirus/EDR actif et à jour ?",
        aide: "Y compris les portables personnels utilisés pour le travail, le cas échéant.",
        weight: 2,
        reco: { label: "Déployer un antivirus/EDR géré sur 100 % des postes, avec alerte centralisée", horizon: "30j", effort: "moyen" },
        refs: ["ANSSI hygiène — protection des postes"],
      },
      {
        id: "pro2",
        texte: "Le Wi-Fi de l'entreprise est-il protégé et séparé du Wi-Fi invités/clients ?",
        aide: "Les visiteurs ne doivent jamais être sur le même réseau que la caisse, la compta ou les serveurs.",
        weight: 2,
        reco: { label: "Créer un réseau Wi-Fi invités séparé et changer les mots de passe Wi-Fi par défaut", horizon: "60j", effort: "faible" },
        refs: ["ANSSI hygiène — cloisonnement réseau"],
      },
      {
        id: "pro3",
        texte: "Les données sensibles (paie, clients, santé…) sont-elles chiffrées ou à accès restreint ?",
        aide: "Au minimum : accès limité aux seules personnes qui en ont besoin, et chiffrement des portables (BitLocker/FileVault).",
        weight: 2,
        reco: { label: "Activer le chiffrement des portables et restreindre les dossiers sensibles aux seuls concernés", horizon: "60j", effort: "moyen" },
        refs: ["NIS2 art. 21 — cryptographie", "RGPD — sécurité des données"],
      },
    ],
  },
  {
    id: "incidents",
    nom: "Gestion des incidents",
    icone: "🚨",
    questions: [
      {
        id: "inc1",
        texte: "Savez-vous quoi faire concrètement en cas de cyberattaque (qui appeler, quoi débrancher) ?",
        aide: "Même une page A4 « en cas d'attaque » : isoler, ne pas éteindre, appeler X, prévenir l'assureur.",
        weight: 3,
        reco: { label: "Rédiger une fiche réflexe incident d'une page et l'imprimer (elle doit survivre à une panne du SI)", horizon: "30j", effort: "faible" },
        refs: ["NIS2 art. 21 — gestion des incidents"],
      },
      {
        id: "inc2",
        texte: "Avez-vous les contacts utiles notés quelque part : prestataire IT, assureur cyber, cybermalveillance.gouv.fr ?",
        aide: "Pendant une attaque, on n'a plus accès aux emails ni aux favoris. Les contacts doivent exister sur papier.",
        weight: 1,
        reco: { label: "Constituer la liste papier des contacts d'urgence (IT, assurance, cybermalveillance.gouv.fr, banque)", horizon: "30j", effort: "faible" },
        refs: ["Dispositif national cybermalveillance.gouv.fr"],
      },
      {
        id: "inc3",
        texte: "Gardez-vous des traces de ce qui se passe sur vos systèmes (journaux, alertes, historique) ?",
        aide: "Sans journaux, impossible de comprendre une attaque ni de prouver quoi que ce soit à l'assureur.",
        weight: 1,
        reco: { label: "Activer et conserver les journaux des systèmes critiques (6 mois minimum)", horizon: "90j", effort: "moyen" },
        refs: ["ANSSI hygiène — journalisation", "NIS2 art. 23 — notification d'incidents"],
      },
    ],
  },
  {
    id: "fournisseurs",
    nom: "Tiers & fournisseurs",
    icone: "🤝",
    questions: [
      {
        id: "fou1",
        texte: "Savez-vous quels prestataires ont accès à vos systèmes ou données (IT, compta, logiciels cloud…) ?",
        aide: "La chaîne d'approvisionnement est un angle d'attaque majeur : on entre chez vous via votre prestataire.",
        weight: 2,
        reco: { label: "Lister les prestataires ayant un accès et vérifier que chaque accès est encore justifié", horizon: "60j", effort: "faible" },
        refs: ["NIS2 art. 21 — sécurité de la chaîne d'approvisionnement"],
      },
      {
        id: "fou2",
        texte: "Les accès des prestataires sont-ils limités au strict nécessaire (comptes dédiés, pas de compte admin permanent) ?",
        aide: "Un prestataire ne doit pas garder un accès administrateur permanent « au cas où ».",
        weight: 2,
        reco: { label: "Passer les prestataires sur des comptes dédiés, limités et désactivables", horizon: "90j", effort: "moyen" },
        refs: ["ANSSI hygiène — gestion des accès tiers"],
      },
      {
        id: "fou3",
        texte: "La sécurité figure-t-elle dans vos contrats avec les prestataires critiques (engagements, réversibilité, notification d'incident) ?",
        aide: "Si votre hébergeur se fait pirater, dans quel délai doit-il vous prévenir ? Si ce n'est pas écrit : jamais.",
        weight: 1,
        reco: { label: "Ajouter une clause sécurité (notification d'incident sous 48 h, réversibilité des données) aux prochains contrats", horizon: "90j", effort: "moyen" },
        refs: ["NIS2 art. 21 — relations avec les fournisseurs"],
      },
    ],
  },
];

// Export Node (tests) sans casser le navigateur.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { DOMAINES, PROFIL };
}
