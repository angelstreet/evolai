/** Pages publiques /learn : comprendre l’audit en cinq pages courtes (TASK-AE, ADR 0050). Miroir de `learn.en.ts`. */
export const learnFr = {
  nav: 'Comprendre l’audit, page par page',
  progress: 'Page {n} sur {total}',
  cockpit: 'Retour au cockpit',
  back: 'Retour',
  next: 'Suivant',
  watch: 'Regarder',
  minutes: '{n} min',
  freeText: 'Texte libre, {max} caractères',
  tells: 'Ce que cela nous apprend : {why}',
  videoCaption: 'Vidéo : {title} ({n} min)',
  entry: {
    front: 'Comprendre comment fonctionne l’audit',
    cardTitle: 'Comprendre l’audit',
    cardBody: 'Cinq pages courtes : le déroulé, les dix questions et ce que vous recevez.',
    cardCta: 'Commencer',
  },
  why: {
    title: 'Pourquoi un audit de l’IA',
    lead: 'Beaucoup d’entreprises adoptent l’IA et constatent peu de changement. Trois choses se passent souvent mal.',
    item1: 'Des outils sont achetés, mais personne ne les utilise au quotidien.',
    item2: 'Des données clients passent dans des outils d’IA publics, sans règle claire.',
    item3: 'Des heures partent dans des tâches répétitives que personne n’a mesurées.',
    closing:
      'EvolAI fait autrement. Nous interrogeons les personnes qui font le travail, puis nous venons sur place avec une image déjà claire.',
  },
  how: {
    title: 'Le déroulé',
    lead: 'Trois étapes : Comprendre, Adapter, Évoluer. En tant que référent, vous devez connaître ces faits.',
    item1:
      'L’enquête prend environ {minutes} minutes sur un téléphone. Elle compte {count} questions et vous pouvez en passer.',
    item2:
      'Les réponses sont anonymes : ni nom, ni e-mail. Les noms écrits en texte libre sont masqués avant l’enregistrement.',
    item3:
      'Le référent voit des totaux seulement, jamais qui a répondu. Un groupe doit compter {min} personnes pour apparaître.',
    item4: 'La visite a lieu après la clôture de l’enquête. Le rapport suit la visite.',
  },
  questions: {
    title: 'Les dix questions',
    lead: 'Voici les questions de l’enquête, mot pour mot. Vous y répondez depuis votre lien d’enquête, pas ici.',
    cardLabel: 'Question {n}',
    v1_source_check: { why: 'Si les gens vérifient les réponses de l’IA avant de les utiliser.' },
    v1_data_sharing: {
      why: 'Comment les données clients sont traitées aujourd’hui, et si les règles sont connues.',
    },
    v1_request_style: { why: 'À quel point les gens savent déjà bien formuler une demande.' },
    v1_report_flow: { why: 'Si les gens cartographient le travail avant de l’automatiser.' },
    v1_repeat_data: { why: 'Si l’IA est le premier réflexe, ou une simple automatisation.' },
    v1_repeat_time: { why: 'L’ampleur du travail répétitif, équipe par équipe.' },
    v1_repeat_task: { why: 'Les premières pistes d’amélioration.' },
    v1_missing_tool: { why: 'Les freins qui ne concernent pas du tout l’IA.' },
    v1_assistant_wish: { why: 'Ce pour quoi les gens accepteraient de l’aide.' },
    v1_job_family: {
      why: 'Les résultats par domaine, seulement pour les groupes de 5 personnes ou plus.',
    },
  },
  results: {
    title: 'Ce que vous recevez',
    lead: 'Après la visite, vous recevez un rapport en quatre parties.',
    item1: 'Un score de maturité de 0 à 100. Plus il est haut, plus les pratiques sont établies.',
    item2: 'Des actions classées : quoi faire en premier, et pourquoi.',
    item3: 'Un plan à 30, 60 et 90 jours, avec une étape pour chaque période.',
    item4: 'Le rapport en PDF, à partager.',
  },
  more: {
    title: 'En savoir plus',
    lead: 'De courtes vidéos sur l’audit et sur le bon usage de l’IA au travail.',
    empty: 'Pas encore de vidéo. Les quatre pages précédentes contiennent l’essentiel.',
    surveyLine: 'Vous avez reçu un lien d’enquête ? Ouvrez-le depuis le message reçu.',
    signIn: 'Se connecter (référents)',
  },
};
