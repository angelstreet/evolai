import type { reportEn } from './report.en.js';

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

/** Rapport de mission (TASK-V, ADR 0041). Même structure que `report.en.ts`. */
export const reportFr: Shape<typeof reportEn> = {
  nav: { tab: 'Rapports', client: 'Rapport' },
  list: {
    title: 'Rapports',
    subtitle: 'Préparez ce que reçoit le client : constats, score, actions et plan.',
    empty: 'Aucune mission pour l’instant. Créez-en d’abord une dans Missions.',
    colAudit: 'Mission',
    colState: 'Rapport',
    colVisible: 'Visible par le client',
    colUpdated: 'Mis à jour',
    notStarted: 'Pas commencé',
    start: 'Commencer le rapport',
    open: 'Ouvrir',
    visibleVersion: 'Version {version}',
    visibleNone: 'Rien',
    startedTitle: 'Rapport {audit}',
  },
  state: {
    draft: 'Brouillon',
    in_review: 'En relecture',
    published: 'Publié',
  },
  editor: {
    back: 'Tous les rapports',
    subtitle:
      'Version {version}. Vous seul pouvez modifier. Le client ne voit rien avant la publication.',
    visibleNow: 'Le client voit la version {version}.',
    visibleNothing: 'Le client ne voit encore aucun rapport.',
    preview: 'Voir comme le client',
    locked:
      'Cette version est publiée et verrouillée. Commencez une nouvelle version pour la modifier.',
    language: 'Rédigé en {language}.',
    fewPeople:
      '{count, plural, one {Seule # personne a répondu} other {Seules # personnes ont répondu}}. Le score et les constats sont masqués sous {n}. Vous pouvez quand même publier un rapport avec vos propres actions.',
    pdfLater: 'Le PDF sera disponible dès que le rapport sera publié.',
    readOnlyViewAs: 'Lecture seule pendant que vous voyez l’application comme une autre personne.',
  },
  workflow: {
    toReview: 'Prêt pour relecture',
    toDraft: 'Repasser en brouillon',
    publish: 'Publier',
    publishTitle: 'Publier ce rapport ?',
    publishBody:
      'Le référent verra la version {version} dans son espace et pourra la télécharger. Vous pourrez la retirer plus tard.',
    publishConfirm: 'Publier',
    publishNeedsReview: 'Marquez le rapport prêt pour relecture avant de le publier.',
    unpublish: 'Retirer la publication',
    unpublishTitle: 'Retirer le rapport ?',
    unpublishBody: 'Le client ne le verra plus. Le rapport repasse en brouillon.',
    unpublishConfirm: 'Retirer',
    newVersion: 'Commencer une nouvelle version',
    newVersionTitle: 'Commencer la version {version} ?',
    newVersionBody:
      'Le client continue de voir la version publiée jusqu’à la publication de la nouvelle.',
    newVersionConfirm: 'Commencer',
    cancel: 'Annuler',
  },
  result: {
    saved: 'Enregistré.',
    created: 'Rapport commencé.',
    suggested:
      '{count, plural, =0 {Aucune nouvelle suggestion.} one {# nouvelle suggestion.} other {# nouvelles suggestions.}}',
    planBuilt: 'Plan construit à partir des actions retenues.',
    published: 'Publié. Le client peut le voir.',
    unpublished: 'Publication retirée. Le client ne le voit plus.',
    newVersion: 'Nouvelle version commencée.',
    stateChanged: 'Statut modifié.',
    added: 'Action ajoutée.',
    error: 'Un problème est survenu. Veuillez réessayer.',
    forbidden: 'Vous ne pouvez pas modifier ce rapport.',
    locked: 'Cette version est publiée. Commencez d’abord une nouvelle version.',
    not_found: 'Introuvable.',
    not_in_review: 'Marquez d’abord le rapport prêt pour relecture.',
    unavailable: 'Ce n’est pas encore disponible sur ce serveur.',
    disputed:
      'Le référent du client a contesté un constat. Marquez-le corrigé ou maintenez-le d’abord, sous Constats.',
    not_published: 'Rien n’est publié.',
    duplicate: 'Cette action est déjà présente.',
    confirm_required: 'Veuillez d’abord confirmer.',
    no_draft: 'Il n’y a pas de brouillon IA.',
    summary_missing: 'Rédigez la synthèse avant de publier.',
    citation_missing: 'Cochez au moins un constat sur lequel repose la synthèse.',
    citation_unknown:
      'La synthèse cite un constat qui n’est plus approuvé. Mettez les cases à jour.',
    nothing_accepted:
      'Rien à publier pour l’instant. Ajoutez une action avec « Rédiger la mienne » sous Actions.',
    contains_name:
      'Le rapport contient un nom de la liste « noms à masquer ». Retirez-le avant de publier.',
    contains_quote:
      'Le rapport reprend des mots écrits par une personne dans le questionnaire. Reformulez avec vos propres mots.',
    invalid: 'Le rapport est incomplet. Vérifiez chaque partie.',
    bad_input: 'Vérifiez les champs et réessayez.',
  },
  sections: {
    title: 'Titre',
    summary: 'Synthèse',
    summaryHelp: 'Vos mots, pour le client. Aucun nom, aucune citation de réponse.',
    citations: 'Constats sur lesquels repose la synthèse',
    citationsHelp: 'Chaque affirmation garde sa source : cochez les constats utilisés.',
    noFindings:
      'Aucun constat n’est encore approuvé, ou aucun n’a été cité par au moins {n} personnes.',
    draft: 'Rédiger un premier jet',
    draftHelp:
      'Remplit la synthèse et la note de méthode à partir du score, des constats et des actions. Relisez-les avant de publier.',
    risks: 'Risques',
    risksHelp: 'Un risque par ligne.',
    methodology: 'Méthode et confidentialité',
    save: 'Enregistrer',
    methodBase:
      'Questionnaire anonyme auprès des équipes : {people, plural, one {# personne a répondu} other {# personnes ont répondu}}. Les scores sont des moyennes de groupes d’au moins {n} personnes.',
    methodThemes:
      '{count, plural, one {L’équipe EvolAI a vérifié et approuvé # constat.} other {L’équipe EvolAI a vérifié et approuvé # constats.}}',
    methodOpportunities:
      '{count, plural, one {L’équipe EvolAI a approuvé # action.} other {L’équipe EvolAI a approuvé # actions.}}',
    methodVisit:
      'Visite sur site : {interviews, plural, one {# entretien} other {# entretiens}}, {observations, plural, one {# observation} other {# observations}}, {workshops, plural, one {# atelier} other {# ateliers}}.',
    methodDisputed:
      '{count, plural, one {Le référent du client a contesté # constat} other {Le référent du client a contesté # constats}} ; {corrected, plural, one {# corrigé} other {# corrigés}}, les autres maintenus avec la contestation notée.',
    methodUnreviewed: 'L’équipe EvolAI n’a encore approuvé aucun constat ni aucune action.',
    methodRefreshed: 'La note de méthode a été réécrite à partir des chiffres actuels.',
  },
  draft: {
    listSep: ' ; ',
    intro:
      '{people} personnes ont répondu. Le score de préparation est de {score} sur 100, niveau « {level} ».',
    introNoScore: 'Trop peu de réponses pour donner un score de préparation.',
    findings: 'Ce qui ressort le plus : {list}.',
    opportunities: 'Les premières actions que nous recommandons : {list}.',
    closing: 'Le plan ci-dessous indique qui fait quoi dans les 30, 60 et 90 prochains jours.',
    closingNoSteps: 'Aucune action n’est encore recommandée.',
  },
  ai: {
    title: 'Brouillon IA',
    badge: 'Brouillon IA, non relu',
    meta: 'Route {route}, prompt {prompt}, {date}.',
    use: 'Utiliser ce brouillon',
    help: 'Un modèle l’a rédigé à partir des seuls constats approuvés. Il remplace le texte de votre synthèse ; vous le relisez ensuite.',
  },
  readiness: {
    title: 'Score de préparation',
    subtitle:
      'Calculé à partir des réponses, de 0 à 100. Les équipes de moins de {n} personnes ne sont pas affichées.',
    overall: 'Ensemble',
    people: '{count, plural, one {# personne} other {# personnes}}',
    noScore: 'Trop peu de réponses pour afficher un score (il en faut au moins {n}).',
    hiddenTeams:
      '{count, plural, one {# équipe n’est pas affichée} other {# équipes ne sont pas affichées}} pour protéger la confidentialité.',
    weights: 'Le score global est la moyenne des trois axes, chacun compte pour un tiers.',
    weightsSome:
      'Le score global repose seulement sur {used} : le questionnaire n’a pas de réponse notée pour {unused}.',
    missing: 'Un axe sans réponse est laissé de côté et les autres comptent davantage.',
    notHr:
      'Une image du groupe, pas une évaluation des personnes, et jamais pour des décisions RH.',
    axis: {
      literacy: 'Connaissances',
      practice: 'Usage',
      readiness: 'Conditions',
    },
    axisHelp: {
      literacy: 'Savoir ce que l’IA fait bien ou mal, et comment vérifier.',
      practice: 'À quelle fréquence et avec quelle qualité l’IA est utilisée au travail.',
      readiness: 'Outils, données, règles et accompagnement en place.',
    },
    level: {
      L0: 'Pas commencé',
      L1: 'Découverte',
      L2: 'Pratique',
      L3: 'Intégration',
      L4: 'Avancé',
      L5: 'Moteur',
    },
    levelMeaning: {
      L0: 'L’IA ne fait pas encore partie du travail.',
      L1: 'Quelques personnes essaient l’IA de temps en temps.',
      L2: 'L’IA aide pour certaines tâches, sans habitudes communes.',
      L3: 'L’IA fait partie de plusieurs tâches, avec des vérifications.',
      L4: 'L’usage de l’IA est régulier, vérifié et partagé dans l’équipe.',
      L5: 'L’IA est intégrée à la façon de travailler et progresse.',
    },
    scale:
      'Niveaux : 0 à 14 pas commencé, 15 à 34 découverte, 35 à 54 pratique, 55 à 69 intégration, 70 à 84 avancé, 85 et plus moteur.',
    scoreOf: '{score} sur 100',
    team: 'Équipe',
    noAxis: 'Pas de réponse',
  },
  quality: {
    title: 'Qualité de l’audit',
    subtitle:
      'Pour l’équipe EvolAI seulement : l’audit est-il assez solide pour être présenté ? Chaque point est noté de 0 à 5 à partir de ce que l’application enregistre.',
    score: '{score} sur 100',
    gate: {
      ready: 'Prêt pour la relecture du client',
      gaps: 'Combler les manques d’abord',
      discover: 'Il faut en apprendre davantage',
      unscored: 'Non noté : moins de {n} réponses',
    },
    noGo: {
      automation_without_owner: 'Une automatisation à fort impact n’a pas de responsable.',
      open_dispute: 'Un constat contesté par le référent attend votre réponse.',
    },
    rated: '{score} / 5',
    weight: 'Compte pour {pct} %',
    dimension: {
      coverage: 'Qui a répondu',
      fidelity: 'Travail vu sur place',
      evidence: 'Preuves',
      practicality: 'Actions prêtes à démarrer',
      governance: 'Risques et règles',
      validation: 'Vérifié par le client',
      measurement: 'Prêt à mesurer',
    },
    hint: {
      coverage:
        'Les réponses par rapport à l’objectif de 70 %. Une équipe sous {n} réponses coûte un point.',
      fidelity: 'Notes de visite : un point par entretien, deux par observation ou atelier.',
      evidence: 'Le temps passé, et les constats appuyés par {n} personnes ou une note de visite.',
      practicality: 'Les actions acceptées avec un responsable et ce qu’il faut d’abord.',
      governance:
        'Une note sur les risques, ce qu’il faut avant les actions risquées, et un score Conditions.',
      validation:
        'Les constats confirmés par le référent, ou contestés et auxquels vous avez répondu.',
      measurement: 'Les actions acceptées avec un point de départ et une date de suivi.',
    },
    note: 'Un contrôle interne, pas une certification. 80 et plus : prêt. De 60 à 79 : combler les manques. En dessous de 60 : en apprendre davantage.',
  },
  time: {
    title: 'Temps passé sur les tâches répétitives',
    subtitle:
      'Ce que les personnes ont dit de leur principale tâche répétitive : à quelle fréquence, et combien de temps à chaque fois. Déclaratif et arrondi : un ordre de grandeur, pas une mesure.',
    overall:
      '{people} personnes : environ {each, plural, =0 {moins d’une demi-heure} one {# heure} other {# heures}} par semaine et par personne, {hours, plural, one {# heure} other {# heures}} au total.',
    team: '{team} : environ {each, plural, =0 {moins d’une demi-heure} one {# heure} other {# heures}} par semaine et par personne ({people} personnes)',
    tool: 'surtout {tool}',
    hidden:
      '{count, plural, one {# équipe n’est pas affichée} other {# équipes ne sont pas affichées}} pour protéger la confidentialité.',
    toolName: {
      spreadsheet: 'dans un tableur',
      email: 'par e-mail',
      business_app: 'dans un logiciel métier',
      paper: 'sur papier ou PDF',
      ai_assistant: 'avec un assistant IA',
    },
  },
  findings: {
    title: 'Constats clés',
    subtitle: 'Constats approuvés, cités par au moins {n} personnes ou vus pendant la visite.',
    people: '{count, plural, one {cité par # personne} other {cité par # personnes}}',
    visit: 'vu pendant la visite',
    disputed: 'contesté par le client, maintenu',
    empty: 'Aucun constat à afficher.',
    work: {
      title: 'Constats',
      subtitle:
        'Ce que montrent les réponses. Approuvez ce que vous assumez : les constats approuvés d’au moins {n} personnes vont dans le rapport, avec des actions suggérées.',
      propose: 'Proposer des constats',
      fromAnswers: 'En écrire un depuis les réponses',
      empty:
        'Aucun constat. Proposez des constats à partir des réponses, ou écrivez-en un depuis l’onglet Réponses.',
      unavailable: 'Les constats ne sont pas encore activés sur ce serveur.',
      approve: 'Approuver',
      reject: 'Refuser',
      withdraw: 'Retirer',
      edit: 'Modifier le constat',
      editTitle: 'Modifier le constat',
      status: { draft: 'À relire', approved: 'Approuvé', rejected: 'Refusé' },
      source: { rule: 'Proposé à partir des réponses', auditor: 'Écrit par vous' },
      staffOnly:
        'Interne : moins de {n} personnes et aucune note de visite, jamais dans le rapport.',
      visit: '{n, plural, one {# note de visite} other {# notes de visite}}',
      review: {
        confirmed: 'Confirmé par le référent',
        disputed: 'Contesté par le référent : {comment}',
        corrected: 'Contestation traitée : corrigé',
        kept: 'Contestation traitée : maintenu, le rapport le signale',
        markCorrected: 'Marquer corrigé',
        keep: 'Maintenir tel quel',
      },
      rejectedTitle: 'Refusés',
      autoPicked: 'choisi par l’application pour l’instant',
      pick: 'Soumettre au référent',
      pickHelp:
        'Le référent confirme ou conteste jusqu’à {max} constats que vous cochez. Si vous n’en cochez aucun, l’application en choisit jusqu’à {max} et laisse de côté les thèmes de mots.',
      picked: '{count} sur {max} cochés pour le référent',
    },
    result: {
      proposed:
        '{count, plural, =0 {Aucun nouveau constat.} one {# nouveau constat à relire.} other {# nouveaux constats à relire.}}',
      created: 'Constat enregistré.',
      approved: 'Approuvé.',
      approvedWithActions: 'Approuvé. Les actions suggérées sont sous Actions.',
      rejected: 'Refusé.',
      corrected: 'Marqué corrigé.',
      updated:
        'Enregistré. L’action issue de ce constat prend le nouveau titre ; ses preuves et ses étapes restent. Vérifiez-les sous Actions.',
      picked: 'Coché pour le référent.',
      unpicked: 'N’est plus soumis au référent.',
      too_many: 'Au plus {count} constats vont au référent. Décochez-en un d’abord.',
      locked: 'Le rapport est publié. Commencez d’abord une nouvelle version.',
      unavailable: 'La modification des constats n’est pas encore disponible sur ce serveur.',
      kept: 'Maintenu. Le rapport signale la contestation.',
      few_people: 'Les constats demandent au moins {n} questionnaires terminés.',
      no_evidence: 'Cochez au moins une réponse ou un choix sur lequel repose le constat.',
      bad_input: 'Écrivez un titre de 3 à 200 caractères et choisissez un axe.',
      not_found: 'Introuvable.',
      forbidden: 'Vous ne pouvez pas modifier ces constats.',
      error: 'Une erreur est survenue. Veuillez réessayer.',
    },
    rule: {
      choice: {
        v1_source_check: {
          label: 'Pas d’habitude commune pour vérifier les réponses d’IA',
          statement:
            '{count} personnes sur {total} utilisent une réponse d’IA telle quelle ou la relisent seulement : il n’y a pas de façon commune de vérifier une source.',
        },
        v1_data_sharing: {
          label: 'Pas de règle claire sur les données clients dans les IA publiques',
          statement:
            '{count} personnes sur {total} colleraient des données clients telles quelles dans une IA publique : la règle n’est pas claire pour elles.',
        },
        v1_request_style: {
          label: 'Pas de façon commune de briefer une IA',
          statement:
            '{count} personnes sur {total} demandent à une IA en une ligne courte : il n’y a pas de façon commune de donner le but, le public et le format.',
        },
        v1_report_flow: {
          label: 'Le travail n’est pas décrit avant de choisir un outil',
          statement:
            '{count} personnes sur {total} chercheraient un outil avant de lister les étapes : décrire le travail d’abord n’est pas encore une habitude.',
        },
        v1_repeat_data: {
          label: 'L’automatisation simple ne vient pas en premier pour recopier',
          statement:
            '{count} personnes sur {total} prendraient un assistant d’IA là où une automatisation simple suffirait.',
        },
        v1_repeat_time: {
          label: 'Les tâches répétitives prennent 3 heures ou plus par semaine',
          statement:
            '{count} personnes sur {total} passent 3 heures ou plus par semaine sur des tâches répétitives.',
        },
        v2_task_frequency: {
          label: 'La principale tâche répétitive revient chaque jour',
          statement:
            '{count} personnes sur {total} font leur principale tâche répétitive chaque jour.',
        },
        v2_task_duration: {
          label: 'La principale tâche répétitive prend plus d’une heure à chaque fois',
          statement:
            '{count} personnes sur {total} passent plus d’une heure à chaque fois sur leur principale tâche répétitive.',
        },
        v2_task_tool: {
          label: 'La principale tâche répétitive se fait au tableur, par e-mail ou sur papier',
          statement:
            '{count} personnes sur {total} font leur principale tâche répétitive dans un tableur, par e-mail ou sur papier.',
        },
        v2_task_data: {
          label: 'La principale tâche répétitive touche des données personnelles ou clients',
          statement:
            '{count} personnes sur {total} manipulent des données personnelles ou des données clients confidentielles dans leur principale tâche répétitive.',
        },
        v2_task_heavy: {
          label: 'Une tâche répétitive lourde, chaque jour ou chaque semaine',
          statement:
            '{count} personnes sur {total} répètent chaque jour ou chaque semaine une tâche qui prend plus d’une heure à chaque fois.',
        },
      },
      unsure: {
        label: 'Incertitude : {question}',
        statement: '{count} personnes sur {total} ont répondu « Je ne sais pas » à : {question}',
      },
      tag: {
        label: '« {tag} » revient dans les textes libres',
        statement: '{count} personnes sur {total} évoquent « {tag} » dans leurs textes libres.',
      },
    },
  },
  steps: {
    title: 'Actions',
    subtitle:
      'Proposées à partir du catalogue pour chaque constat approuvé. Retenez, modifiez ou écartez chacune, ou rédigez la vôtre.',
    noOpportunity:
      'Aucun constat approuvé pour l’instant. Vous pouvez rédiger votre propre action ici.',
    suggestAgain: 'Proposer à nouveau',
    why: 'Pourquoi : {tags}',
    measure: {
      title: 'Mesure',
      help: 'Ce que vous mesurez aujourd’hui, et où en est la mesure au jour 90.',
      baseline: 'Point de départ',
      value: 'Valeur de départ',
      unit: 'Unité',
      unitHelp: 'Par exemple : minutes par commande',
      source: 'Source',
      sourceHelp: 'D’où vient le chiffre',
      followUp: 'Suivi',
      followUpOn: 'Date de suivi',
      day90: 'Jour 90',
      none: 'Pas encore',
      status: {
        validated: 'Validé',
        mixed: 'Mitigé',
        no_benefit: 'Sans bénéfice',
        not_implemented: 'Non mis en œuvre',
      },
      save: 'Enregistrer la mesure',
      after: 'Au suivi',
      afterValue: 'Valeur au suivi',
      afterHelp: 'Même unité que le point de départ',
      change: '{sign}{pct} %',
      due: 'Suivi à faire',
      dueTitle: '{count, plural, one {# suivi est à faire} other {# suivis sont à faire}}',
      dueBody:
        'Mesurez à nouveau, puis indiquez le résultat au jour 90. Le rapport publié ne change pas tant que vous ne publiez pas une nouvelle version.',
    },
    whyPicked: 'Choisie dans le catalogue.',
    whyAuditor: 'Rédigée par vous.',
    status: {
      suggested: 'Proposée',
      accepted: 'Retenue',
      rejected: 'Écartée',
    },
    accept: 'Retenir',
    reject: 'Écarter',
    undo: 'Annuler le choix',
    edit: 'Modifier',
    editTitle: 'Modifier l’action',
    save: 'Enregistrer',
    cancel: 'Annuler',
    stepTitle: 'Action',
    description: 'Ce qu’il faut faire',
    effort: 'Effort',
    impact: 'Impact',
    risk: 'Risque',
    owner: 'Responsable',
    ownerHelp: 'Un rôle, pas le nom d’une personne.',
    horizon: 'Quand',
    category: 'Type',
    add: 'Ajouter une action',
    addFromCatalogue: 'Depuis le catalogue',
    addCustom: 'Rédiger la mienne',
    pick: 'Choisir une action',
    prerequisites: 'Avant de commencer',
    none: 'Aucune action pour ce constat.',
    level: { low: 'Faible', medium: 'Moyen', high: 'Élevé' },
    horizonName: { d30: 'Sous 30 jours', d60: 'Sous 60 jours', d90: 'Sous 90 jours' },
    categoryName: {
      simplify: 'Simplifier',
      automate: 'Automatiser',
      train: 'Former',
      ai_assistant: 'Assistant IA',
      data_access: 'Données et outils',
      governance: 'Règles',
    },
    ownerRole: {
      team_lead: 'Responsable d’équipe',
      process_owner: 'La personne qui pilote la tâche',
      it: 'La personne qui gère les outils',
      data_owner: 'La personne qui tient les données',
      training: 'La personne qui organise les formations',
      security_privacy: 'La direction, avec le référent données personnelles',
      sponsor: 'Référent',
    },
    tag: {
      manual_reentry: 'information saisie deux fois',
      repetitive_task: 'tâche répétée',
      search_information: 'recherche d’information',
      writing_drafting: 'rédaction',
      reporting: 'reporting',
      approval_delay: 'attente de validation',
      handover: 'passation entre personnes',
      unclear_process: 'façon de faire peu claire',
      literacy_gap: 'manque de connaissances',
      low_practice: 'peu d’usage',
      tool_access: 'accès aux outils',
      data_quality: 'qualité des données',
      policy_unclear: 'règles peu claires',
      meeting_overload: 'réunions',
      customer_requests: 'demandes entrantes',
      document_review: 'contrôle de documents',
      translation: 'traduction',
      scheduling: 'planification',
      cv_profiles: 'CV et dossiers de compétences',
      tender_response: 'appels d’offres',
      timesheet_billing: 'temps et facturation',
      staffing: 'staffing',
      recruiting: 'recrutement',
    },
  },
  ranking: {
    title: 'Actions par priorité',
    subtitle: 'Impact élevé et effort faible en premier.',
    matrix: 'Impact et effort',
    matrixAria: 'Impact en fonction de l’effort : {list}',
    rank: 'Priorité {rank}',
    impactEffort: 'Impact {impact}, effort {effort}',
    quadrant: {
      quick_win: 'Gains rapides',
      big_bet: 'Grands chantiers',
      fill_in: 'Petits gains',
      reconsider: 'À reconsidérer',
    },
    quadrantHelp: {
      quick_win: 'Impact élevé, effort faible : commencer ici.',
      big_bet: 'Impact élevé, effort plus important : bien préparer.',
      fill_in: 'Impact faible, effort faible : quand il y a du temps.',
      reconsider: 'Impact faible, effort plus important : sans doute pas maintenant.',
    },
    empty: 'Retenez des actions pour les classer.',
  },
  plan: {
    title: 'Les 30, 60 et 90 prochains jours',
    subtitle: 'Construit à partir des actions retenues. Chaque ligne est modifiable.',
    build: 'Construire à partir des actions retenues',
    buildHelp: 'Remplace le plan actuel.',
    empty: 'Pas encore de plan. Retenez des actions, puis construisez le plan.',
    text: 'Action',
    owner: 'Responsable',
    horizon: 'Quand',
    remove: 'Supprimer la ligne',
    addLine: 'Ajouter une ligne',
    save: 'Enregistrer le plan',
    checkpoint: {
      d30: 'Vérifier l’usage des premiers changements : qui les utilise, ce qui bloque, ce qu’en disent les équipes.',
      d60: 'Mesurer les premiers résultats par rapport au point de départ : temps, qualité, adoption.',
      d90: 'Décider pour chaque changement : garder, adapter ou arrêter, et rendre compte de chaque résultat.',
    },
    checkpointOwner: 'Référent avec l’équipe EvolAI',
  },
  clientReview: {
    title: 'Vérifiez les constats',
    intro:
      'Avant la publication du rapport, dites-nous si chaque constat correspond à vos équipes. Les contestations vont à l’équipe EvolAI.',
    people: '{count, plural, one {# personne} other {# personnes}}',
    visit: 'vu pendant la visite',
    confirm: 'Confirmer',
    dispute: 'Contester',
    comment: 'Pourquoi, en une ligne',
    commentHelp: 'Nécessaire pour contester. Pas de noms.',
    confirmed: 'Confirmé',
    disputed: 'Contesté : {comment}',
    resolved: 'L’équipe EvolAI a répondu à votre contestation.',
    readOnly: 'Lecture seule : le référent confirme ou conteste.',
    result: {
      confirmed: 'Merci. Confirmé.',
      disputed: 'Merci. L’équipe EvolAI va l’examiner.',
      bad_input: 'Dites en une ligne pourquoi vous le contestez.',
      read_only: 'Lecture seule.',
      not_found: 'Ce constat n’est plus ouvert à la vérification.',
      forbidden: 'Vous ne pouvez pas vérifier ces constats.',
      error: 'Une erreur est survenue. Veuillez réessayer.',
    },
  },
  view: {
    draftBanner: 'Aperçu. Le client ne le voit pas avant la publication.',
    gateTitle: 'Pas encore prêt à publier',
    version: 'Version {version}, publiée le {date}',
    summary: 'Synthèse',
    sources: 'Sources : {list}',
    finding: 'Constat {n}',
    risksTitle: 'Risques',
    prerequisitesTitle: 'Avant de commencer',
    methodTitle: 'Méthode et confidentialité',
    privacyNote:
      'Les réponses étaient anonymes. Les groupes de moins de {n} personnes sont masqués. Aucune réponse individuelle, citation ou score personnel n’apparaît dans ce rapport.',
    noRisks: 'Aucun risque particulier noté.',
    download: 'Télécharger le PDF',
    print: 'Imprimer',
    stepsFor: 'Actions',
    empty:
      'Votre rapport n’est pas encore publié. Vous le trouverez ici dès que l’équipe EvolAI l’aura publié.',
    receiveTitle: 'Ce que vous recevrez',
    receiveWhat:
      'Un seul rapport pour toute la mission : le score, les constats principaux, les actions à mener et un plan à 30, 60 et 90 jours. Aucune réponse individuelle.',
    receiveWhenDate:
      'Le questionnaire ferme le {date}. Le rapport apparaît ici quand l’équipe EvolAI a lu les réponses et l’a publié.',
    receiveWhen:
      'Le rapport apparaît ici quand le questionnaire est terminé et que l’équipe EvolAI a lu les réponses et l’a publié.',
    receiveForward:
      'Pour le transmettre, téléchargez le PDF ou imprimez cette page, puis envoyez-le par e-mail.',
    clientTitle: 'Rapport',
    clientSubtitle: 'Ce qu’EvolAI a constaté et ce qu’il faut faire ensuite. Lecture seule.',
    reportLanguage: '{language, select, fr {Rédigé en français.} other {Rédigé en anglais.}}',
    aggregateNote: 'Un seul rapport pour toute la mission, toutes équipes réunies.',
    page: 'Page {page} sur {pages}',
    contents: 'Sommaire',
  },
};
