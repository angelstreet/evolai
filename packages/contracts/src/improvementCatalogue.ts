import { z } from 'zod';

/**
 * Improvement-step catalogue (TASK-V, ADR 0041, PRD §10 "propose improvement, automation and AI
 * options", §28.1 "opportunity backlog").
 *
 * A versioned list of interventions the auditor can attach to an approved opportunity. The list
 * is data, kept in this file so it is reviewed like code, typed, and shipped without a migration.
 * A report copies the text of each step it uses and records `IMPROVEMENT_CATALOGUE_VERSION`, so
 * editing an entry later never changes a report that was already drafted or published.
 *
 * Rules for an entry: plain words, both languages, no client or product names, no prices.
 * `evidence` lists the evidence patterns (theme tags, see `EVIDENCE_TAGS`) the step answers;
 * the rule-based matcher in `@evolai/domain` uses them.
 */

export const IMPROVEMENT_CATALOGUE_VERSION = '2026-10-30.1';

export const improvementCategorySchema = z.enum([
  'simplify',
  'automate',
  'train',
  'ai_assistant',
  'data_access',
  'governance',
]);
export type ImprovementCategory = z.infer<typeof improvementCategorySchema>;

export const levelSchema = z.enum(['low', 'medium', 'high']);
export type Level = z.infer<typeof levelSchema>;

export const ownerRoleSchema = z.enum([
  'team_lead',
  'process_owner',
  'it',
  'data_owner',
  'training',
  'security_privacy',
  'sponsor',
]);
export type OwnerRole = z.infer<typeof ownerRoleSchema>;

/**
 * Evidence patterns. Each one is a kind of problem people describe; the matcher finds them in an
 * opportunity's title, description and linked themes with the keywords below (accents and case
 * ignored), or from the axis of the theme.
 */
export const EVIDENCE_TAGS = [
  'manual_reentry',
  'repetitive_task',
  'search_information',
  'writing_drafting',
  'reporting',
  'approval_delay',
  'handover',
  'unclear_process',
  'literacy_gap',
  'low_practice',
  'tool_access',
  'data_quality',
  'policy_unclear',
  'meeting_overload',
  'customer_requests',
  'document_review',
  'translation',
  'scheduling',
  // Professional-services work (ESN pilot rehearsal, ADR 0062).
  'cv_profiles',
  'tender_response',
  'timesheet_billing',
  'staffing',
  'recruiting',
] as const;
export const evidenceTagSchema = z.enum(EVIDENCE_TAGS);
export type EvidenceTag = z.infer<typeof evidenceTagSchema>;

/** Keyword stems per evidence tag, French and English, written without accents. */
export const EVIDENCE_KEYWORDS: Readonly<Record<EvidenceTag, readonly string[]>> = {
  manual_reentry: [
    'copy',
    'paste',
    're-enter',
    'retype',
    'double entry',
    'manual entry',
    'copied',
    'pasting',
    'copie',
    'coller',
    'colles',
    'collee',
    'saisi a la main',
    'ressais',
    'double saisie',
    'saisie manuelle',
  ],
  repetitive_task: [
    'repetitive',
    'every day',
    'same task',
    'routine',
    'recurring',
    'repetiti',
    'chaque jour',
    'tous les jours',
    'chaque semaine',
    'toutes les semaines',
    'recurrent',
  ],
  search_information: [
    'search',
    'looking for',
    'find information',
    'where to find',
    'cherch',
    'retrouver',
    'trouver l',
  ],
  writing_drafting: ['write', 'draft', 'email', 'redig', 'ecrire', 'courriel', 'brouillon'],
  reporting: [
    'report',
    'dashboard',
    'spreadsheet',
    'excel',
    'figures',
    'rapport',
    'tableau',
    'chiffres',
  ],
  approval_delay: [
    'approval',
    'waiting',
    'sign-off',
    'bottleneck',
    'validation',
    'attente',
    'approbation',
    'goulot',
  ],
  handover: [
    'handover',
    'hand-off',
    'between teams',
    'back and forth',
    'passation',
    'aller-retour',
  ],
  unclear_process: [
    'unclear',
    'no process',
    'inconsistent',
    'everyone does',
    'pas clair',
    'flou',
    'chacun fait',
    'incoheren',
  ],
  literacy_gap: [
    'not confident',
    'do not know how',
    "don't know how",
    'training',
    'unsure',
    'formation',
    'pas a l aise',
    'ne sais pas',
  ],
  low_practice: ['never use', 'rarely', 'jamais', 'rarement'],
  tool_access: [
    'access',
    'licence',
    'license',
    'not allowed',
    'blocked',
    'no tool',
    'acces',
    'bloque',
    'pas d outil',
  ],
  data_quality: [
    'data quality',
    'wrong data',
    'duplicate',
    'outdated',
    'qualite des donnees',
    'erron',
    'doublon',
    'obsolete',
  ],
  policy_unclear: [
    'policy',
    'rules',
    'confidential',
    'privacy',
    'politique',
    'regle',
    'confidenti',
    'charte',
  ],
  meeting_overload: ['meeting', 'minutes', 'reunion', 'compte rendu', 'comptes rendus'],
  customer_requests: ['customer', 'ticket', 'support', 'request', 'demande', 'usager'],
  document_review: ['proofread', 'contract', 'compliance', 'relire', 'relecture', 'conformite'],
  translation: ['translat', 'tradu'],
  scheduling: ['schedule', 'calendar', 'planning', 'agenda', 'calendrier'],
  cv_profiles: [
    'cv',
    'curriculum',
    'dossier de competences',
    'dossiers de competences',
    'skills file',
    'profil consultant',
    'profils consultants',
  ],
  tender_response: [
    'appel d offres',
    'appels d offres',
    'tender',
    'rfp',
    'proposition commerciale',
    'propale',
    'bid',
  ],
  timesheet_billing: [
    'timesheet',
    'feuille de temps',
    'feuilles de temps',
    'compte rendu d activite',
    'comptes rendus d activite',
    'factur',
    'invoic',
    'note de frais',
    'notes de frais',
    'expense',
  ],
  staffing: [
    'staffing',
    'affectation',
    'intercontrat',
    'inter-contrat',
    'disponibilite des consultants',
  ],
  recruiting: [
    'recrut',
    'recruit',
    'candidat',
    'candidate',
    'jobboard',
    'job board',
    'sourcing',
    'onboarding',
  ],
};

const textSchema = z.object({ fr: z.string().min(3), en: z.string().min(3) });
export type LocalisedText = z.infer<typeof textSchema>;

export const improvementEntrySchema = z
  .object({
    id: z.string().regex(/^[a-z]+\.[a-z0-9_]+$/),
    category: improvementCategorySchema,
    title: textSchema,
    description: textSchema,
    effort: levelSchema,
    impact: levelSchema,
    risk: levelSchema,
    prerequisites: z.array(textSchema).max(4),
    ownerRole: ownerRoleSchema,
    evidence: z.array(evidenceTagSchema).min(1).max(5),
  })
  .strict();
export type ImprovementEntry = z.infer<typeof improvementEntrySchema>;

const t = (en: string, fr: string): LocalisedText => ({ en, fr });

export const IMPROVEMENT_CATALOGUE: readonly ImprovementEntry[] = [
  // ---- Simplify ------------------------------------------------------------------------------
  {
    id: 'simplify.remove_double_entry',
    category: 'simplify',
    title: t('Enter information once', 'Saisir une information une seule fois'),
    description: t(
      'Map where the same information is typed twice and keep one place where it is entered; the other tools read it from there.',
      'Repérer où la même information est saisie deux fois et garder un seul point de saisie ; les autres outils la lisent à partir de là.',
    ),
    effort: 'medium',
    impact: 'high',
    risk: 'low',
    prerequisites: [t('A list of the tools involved', 'La liste des outils concernés')],
    ownerRole: 'process_owner',
    evidence: ['manual_reentry', 'data_quality'],
  },
  {
    id: 'simplify.cut_approval_steps',
    category: 'simplify',
    title: t('Fewer approval steps', 'Moins d’étapes de validation'),
    description: t(
      'Review each approval in the flow, keep the ones that manage a real risk and set a delay after which the request moves on.',
      'Revoir chaque validation du circuit, garder celles qui couvrent un vrai risque et fixer un délai au-delà duquel la demande avance.',
    ),
    effort: 'low',
    impact: 'medium',
    risk: 'medium',
    prerequisites: [
      t(
        'Agreement of the people who approve today',
        'L’accord des personnes qui valident aujourd’hui',
      ),
    ],
    ownerRole: 'process_owner',
    evidence: ['approval_delay'],
  },
  {
    id: 'simplify.standard_way_of_working',
    category: 'simplify',
    title: t('One agreed way of working', 'Une façon de faire commune'),
    description: t(
      'Write the steps of the task on one page with the team, agree on one way, and keep it where everyone finds it.',
      'Écrire les étapes de la tâche sur une page avec l’équipe, choisir une seule façon de faire et la ranger là où chacun la trouve.',
    ),
    effort: 'low',
    impact: 'medium',
    risk: 'low',
    prerequisites: [],
    ownerRole: 'team_lead',
    evidence: ['unclear_process', 'handover'],
  },
  {
    id: 'simplify.clear_handover',
    category: 'simplify',
    title: t('A clear handover between teams', 'Une passation claire entre équipes'),
    description: t(
      'Agree what a complete request contains before it is passed on, with a short checklist, so it does not come back.',
      'Définir ce que contient une demande complète avant de la transmettre, avec une courte liste de contrôle, pour qu’elle ne revienne pas.',
    ),
    effort: 'low',
    impact: 'medium',
    risk: 'low',
    prerequisites: [t('Both teams take part', 'Les deux équipes participent')],
    ownerRole: 'process_owner',
    evidence: ['handover', 'approval_delay'],
  },
  {
    id: 'simplify.templates_library',
    category: 'simplify',
    title: t('Shared templates', 'Des modèles partagés'),
    description: t(
      'Collect the documents and messages written again and again, turn the best ones into templates, and share them in one place.',
      'Rassembler les documents et messages réécrits sans cesse, transformer les meilleurs en modèles et les partager au même endroit.',
    ),
    effort: 'low',
    impact: 'medium',
    risk: 'low',
    prerequisites: [],
    ownerRole: 'team_lead',
    evidence: ['writing_drafting', 'repetitive_task', 'cv_profiles', 'tender_response'],
  },
  // ---- Automate ------------------------------------------------------------------------------
  {
    id: 'automate.transfer_between_tools',
    category: 'automate',
    title: t(
      'Move data between tools automatically',
      'Transférer les données entre outils automatiquement',
    ),
    description: t(
      'Replace copy and paste between two tools by an automatic transfer (export and import, a connector or a small script), with a check of the result.',
      'Remplacer le copier-coller entre deux outils par un transfert automatique (export et import, connecteur ou petit script), avec un contrôle du résultat.',
    ),
    effort: 'medium',
    impact: 'high',
    risk: 'medium',
    prerequisites: [
      t(
        'Both tools allow an export or a connector',
        'Les deux outils permettent un export ou un connecteur',
      ),
      t('IT agrees', 'Accord de l’informatique'),
    ],
    ownerRole: 'it',
    evidence: ['manual_reentry', 'repetitive_task', 'timesheet_billing'],
  },
  {
    id: 'automate.scheduled_report',
    category: 'automate',
    title: t('A report that builds itself', 'Un rapport qui se construit tout seul'),
    description: t(
      'Build the recurring report once from the source data and refresh it on a schedule instead of assembling it by hand.',
      'Construire une fois le rapport récurrent à partir des données sources et l’actualiser à intervalle fixe au lieu de l’assembler à la main.',
    ),
    effort: 'medium',
    impact: 'high',
    risk: 'low',
    prerequisites: [t('Read access to the source data', 'Un accès en lecture aux données sources')],
    ownerRole: 'data_owner',
    evidence: ['reporting', 'repetitive_task', 'staffing'],
  },
  {
    id: 'automate.form_intake',
    category: 'automate',
    title: t('One form for incoming requests', 'Un formulaire unique pour les demandes'),
    description: t(
      'Collect requests through one form with the required fields, so they arrive complete and can be sorted automatically.',
      'Recevoir les demandes par un seul formulaire avec les champs obligatoires, pour qu’elles arrivent complètes et soient triées automatiquement.',
    ),
    effort: 'low',
    impact: 'medium',
    risk: 'low',
    prerequisites: [],
    ownerRole: 'process_owner',
    evidence: ['customer_requests', 'handover', 'unclear_process', 'recruiting'],
  },
  {
    id: 'automate.reminders_and_routing',
    category: 'automate',
    title: t('Automatic reminders and routing', 'Relances et aiguillage automatiques'),
    description: t(
      'Send pending approvals and requests to the right person automatically, with a reminder when they wait too long.',
      'Envoyer automatiquement les validations et demandes en attente à la bonne personne, avec une relance quand elles attendent trop.',
    ),
    effort: 'medium',
    impact: 'medium',
    risk: 'low',
    prerequisites: [t('An agreed approval flow', 'Un circuit de validation convenu')],
    ownerRole: 'it',
    evidence: ['approval_delay', 'customer_requests', 'timesheet_billing'],
  },
  {
    id: 'automate.scheduling_tool',
    category: 'automate',
    title: t('Shared scheduling', 'Une planification partagée'),
    description: t(
      'Use a shared calendar or booking tool so slots and plans are set without rounds of messages.',
      'Utiliser un agenda partagé ou un outil de réservation pour fixer créneaux et plannings sans allers-retours de messages.',
    ),
    effort: 'low',
    impact: 'medium',
    risk: 'low',
    prerequisites: [],
    ownerRole: 'team_lead',
    evidence: ['scheduling'],
  },
  // ---- Train ---------------------------------------------------------------------------------
  {
    id: 'train.ai_basics',
    category: 'train',
    title: t('AI basics for the team', 'Les bases de l’IA pour l’équipe'),
    description: t(
      'A short session on what AI tools do well and badly, how to check an answer, and what must never be pasted into them.',
      'Une courte séance sur ce que les outils d’IA font bien ou mal, comment vérifier une réponse et ce qu’il ne faut jamais y coller.',
    ),
    effort: 'low',
    impact: 'medium',
    risk: 'low',
    prerequisites: [],
    ownerRole: 'training',
    evidence: ['literacy_gap', 'policy_unclear'],
  },
  {
    id: 'train.hands_on_workshop',
    category: 'train',
    title: t('Hands-on workshop on real tasks', 'Atelier pratique sur des tâches réelles'),
    description: t(
      'People bring one task of their week and practise it with the approved tool, with a coach in the room.',
      'Chacun apporte une tâche de sa semaine et la pratique avec l’outil autorisé, accompagné par un formateur.',
    ),
    effort: 'medium',
    impact: 'high',
    risk: 'low',
    prerequisites: [t('An approved AI tool', 'Un outil d’IA autorisé')],
    ownerRole: 'training',
    evidence: ['literacy_gap', 'low_practice'],
  },
  {
    id: 'train.champions_network',
    category: 'train',
    title: t('Team champions', 'Des référents dans l’équipe'),
    description: t(
      'Name one or two volunteers who try new uses first, share what works, and answer colleagues’ questions.',
      'Désigner un ou deux volontaires qui testent les nouveaux usages, partagent ce qui marche et répondent aux questions des collègues.',
    ),
    effort: 'low',
    impact: 'medium',
    risk: 'low',
    prerequisites: [t('Time set aside for them', 'Du temps réservé pour eux')],
    ownerRole: 'team_lead',
    evidence: ['low_practice', 'literacy_gap'],
  },
  {
    id: 'train.verification_habits',
    category: 'train',
    title: t('Check before you trust', 'Vérifier avant de faire confiance'),
    description: t(
      'Practise checking AI answers against the source: facts, figures and names, with a short checklist kept next to the tool.',
      'S’entraîner à vérifier les réponses de l’IA par rapport à la source : faits, chiffres et noms, avec une courte liste de contrôle près de l’outil.',
    ),
    effort: 'low',
    impact: 'medium',
    risk: 'low',
    prerequisites: [],
    ownerRole: 'training',
    evidence: ['literacy_gap', 'document_review'],
  },
  {
    id: 'train.tool_skills',
    category: 'train',
    title: t('Get more from current tools', 'Mieux utiliser les outils actuels'),
    description: t(
      'Short tutorials on features people already have but do not use (filters, templates, shortcuts, search).',
      'De courts tutoriels sur des fonctions déjà disponibles mais peu utilisées (filtres, modèles, raccourcis, recherche).',
    ),
    effort: 'low',
    impact: 'low',
    risk: 'low',
    prerequisites: [],
    ownerRole: 'training',
    evidence: ['search_information', 'reporting', 'low_practice'],
  },
  // ---- AI assistant --------------------------------------------------------------------------
  {
    id: 'ai.drafting_assistant',
    category: 'ai_assistant',
    title: t('AI help for first drafts', 'L’IA pour les premiers jets'),
    description: t(
      'Use an approved AI assistant to write the first draft of routine messages and documents; a person always reviews and sends.',
      'Utiliser un assistant d’IA autorisé pour le premier jet des messages et documents courants ; une personne relit et envoie toujours.',
    ),
    effort: 'low',
    impact: 'high',
    risk: 'medium',
    prerequisites: [
      t('An approved AI tool', 'Un outil d’IA autorisé'),
      t('Rules on what data may be used', 'Des règles sur les données utilisables'),
    ],
    ownerRole: 'team_lead',
    evidence: ['writing_drafting', 'repetitive_task', 'tender_response', 'cv_profiles'],
  },
  {
    id: 'ai.meeting_notes',
    category: 'ai_assistant',
    title: t('AI-assisted meeting notes', 'Comptes rendus assistés par l’IA'),
    description: t(
      'Produce meeting notes and action lists with an approved assistant, checked by the organiser before they are shared.',
      'Produire comptes rendus et listes d’actions avec un assistant autorisé, vérifiés par l’organisateur avant diffusion.',
    ),
    effort: 'low',
    impact: 'medium',
    risk: 'medium',
    prerequisites: [
      t('Participants are told and agree', 'Les participants sont informés et d’accord'),
      t('An approved AI tool', 'Un outil d’IA autorisé'),
    ],
    ownerRole: 'team_lead',
    evidence: ['meeting_overload', 'writing_drafting', 'recruiting'],
  },
  {
    id: 'ai.knowledge_search',
    category: 'ai_assistant',
    title: t('Ask the team’s documents', 'Interroger les documents de l’équipe'),
    description: t(
      'An assistant that answers questions from the team’s own documents and always shows the source page.',
      'Un assistant qui répond aux questions à partir des documents de l’équipe et montre toujours la page source.',
    ),
    effort: 'high',
    impact: 'high',
    risk: 'medium',
    prerequisites: [
      t(
        'Documents are up to date and in one place',
        'Des documents à jour et réunis au même endroit',
      ),
      t('Access rights are respected', 'Les droits d’accès sont respectés'),
    ],
    ownerRole: 'it',
    evidence: ['search_information', 'data_quality'],
  },
  {
    id: 'ai.request_triage',
    category: 'ai_assistant',
    title: t('AI sorting of incoming requests', 'Tri des demandes par l’IA'),
    description: t(
      'An assistant suggests the category, priority and a draft answer for each incoming request; a person confirms.',
      'Un assistant propose la catégorie, la priorité et un projet de réponse pour chaque demande ; une personne confirme.',
    ),
    effort: 'medium',
    impact: 'high',
    risk: 'medium',
    prerequisites: [
      t('One channel for requests', 'Un canal unique pour les demandes'),
      t('An approved AI tool', 'Un outil d’IA autorisé'),
    ],
    ownerRole: 'process_owner',
    evidence: ['customer_requests', 'repetitive_task'],
  },
  {
    id: 'ai.document_check',
    category: 'ai_assistant',
    title: t('AI first pass on document checks', 'Premier contrôle des documents par l’IA'),
    description: t(
      'An assistant flags missing items and inconsistencies against a checklist; the reviewer decides.',
      'Un assistant signale les éléments manquants et les incohérences au regard d’une liste de contrôle ; le relecteur décide.',
    ),
    effort: 'medium',
    impact: 'medium',
    risk: 'high',
    prerequisites: [
      t('A written checklist', 'Une liste de contrôle écrite'),
      t('Security and privacy review', 'Un avis sécurité et confidentialité'),
    ],
    ownerRole: 'process_owner',
    evidence: ['document_review'],
  },
  {
    id: 'ai.translation_help',
    category: 'ai_assistant',
    title: t('AI help with translation', 'L’IA pour aider à traduire'),
    description: t(
      'Use an approved tool for first translations of internal texts; a fluent person reviews anything sent outside.',
      'Utiliser un outil autorisé pour les premières traductions de textes internes ; une personne maîtrisant la langue relit tout envoi externe.',
    ),
    effort: 'low',
    impact: 'medium',
    risk: 'medium',
    prerequisites: [t('An approved AI tool', 'Un outil d’IA autorisé')],
    ownerRole: 'team_lead',
    evidence: ['translation', 'writing_drafting'],
  },
  {
    id: 'ai.report_commentary',
    category: 'ai_assistant',
    title: t('AI draft of report comments', 'Commentaires de rapport rédigés par l’IA'),
    description: t(
      'An assistant drafts the comments on a recurring report from its figures; the author checks every number.',
      'Un assistant rédige les commentaires d’un rapport récurrent à partir de ses chiffres ; l’auteur vérifie chaque nombre.',
    ),
    effort: 'medium',
    impact: 'medium',
    risk: 'medium',
    prerequisites: [t('The report is already automated', 'Le rapport est déjà automatisé')],
    ownerRole: 'data_owner',
    evidence: ['reporting', 'writing_drafting'],
  },
  // ---- Data and tool access ------------------------------------------------------------------
  {
    id: 'data.grant_tool_access',
    category: 'data_access',
    title: t('Give access to the right tool', 'Donner accès au bon outil'),
    description: t(
      'Give the people who need it access to an approved tool, with a simple way to ask for it.',
      'Donner aux personnes qui en ont besoin l’accès à un outil autorisé, avec une façon simple de le demander.',
    ),
    effort: 'low',
    impact: 'high',
    risk: 'medium',
    prerequisites: [
      t('A tool approved by IT and security', 'Un outil validé par l’informatique et la sécurité'),
    ],
    ownerRole: 'it',
    evidence: ['tool_access', 'low_practice'],
  },
  {
    id: 'data.single_source',
    category: 'data_access',
    title: t('One trusted source for key data', 'Une source fiable pour les données clés'),
    description: t(
      'Name the reference source for each key piece of data and who keeps it correct; other copies are retired.',
      'Désigner la source de référence de chaque donnée clé et qui la maintient à jour ; les autres copies sont abandonnées.',
    ),
    effort: 'medium',
    impact: 'high',
    risk: 'low',
    prerequisites: [t('A data owner is named', 'Un responsable des données est désigné')],
    ownerRole: 'data_owner',
    evidence: ['data_quality', 'manual_reentry', 'search_information', 'staffing'],
  },
  {
    id: 'data.clean_up',
    category: 'data_access',
    title: t(
      'Clean the data before using AI on it',
      'Nettoyer les données avant d’y appliquer l’IA',
    ),
    description: t(
      'Remove duplicates and outdated records and fix the most frequent errors in the data the team relies on.',
      'Supprimer les doublons et les données périmées et corriger les erreurs les plus fréquentes dans les données utilisées par l’équipe.',
    ),
    effort: 'medium',
    impact: 'medium',
    risk: 'low',
    prerequisites: [],
    ownerRole: 'data_owner',
    evidence: ['data_quality'],
  },
  {
    id: 'data.organise_documents',
    category: 'data_access',
    title: t('Organise shared documents', 'Organiser les documents partagés'),
    description: t(
      'Agree one folder structure and naming rule, move the useful documents there and archive the rest.',
      'Convenir d’une arborescence et d’une règle de nommage, y ranger les documents utiles et archiver le reste.',
    ),
    effort: 'low',
    impact: 'medium',
    risk: 'low',
    prerequisites: [],
    ownerRole: 'team_lead',
    evidence: ['search_information', 'handover'],
  },
  // ---- Governance ----------------------------------------------------------------------------
  {
    id: 'governance.ai_use_policy',
    category: 'governance',
    title: t('Clear rules for using AI', 'Des règles claires pour utiliser l’IA'),
    description: t(
      'One page that says which tools are allowed, for which data, and who to ask, written in plain words.',
      'Une page qui dit quels outils sont autorisés, pour quelles données, et à qui s’adresser, en mots simples.',
    ),
    effort: 'low',
    impact: 'high',
    risk: 'low',
    prerequisites: [t('Input from security and legal', 'L’avis de la sécurité et du juridique')],
    ownerRole: 'security_privacy',
    evidence: ['policy_unclear', 'tool_access'],
  },
  {
    id: 'governance.data_classification',
    category: 'governance',
    title: t('Know which data is sensitive', 'Savoir quelles données sont sensibles'),
    description: t(
      'Label the team’s main data as public, internal or sensitive, and say what may go into which tool.',
      'Classer les principales données de l’équipe en publiques, internes ou sensibles, et dire ce qui peut aller dans quel outil.',
    ),
    effort: 'medium',
    impact: 'medium',
    risk: 'low',
    prerequisites: [],
    ownerRole: 'security_privacy',
    evidence: ['policy_unclear', 'data_quality'],
  },
  {
    id: 'governance.pilot_with_measure',
    category: 'governance',
    title: t('A measured pilot before scaling', 'Un pilote mesuré avant de généraliser'),
    description: t(
      'Try the change with a small group for a few weeks, measure time and quality before and after, then decide.',
      'Tester le changement avec un petit groupe pendant quelques semaines, mesurer temps et qualité avant et après, puis décider.',
    ),
    effort: 'medium',
    impact: 'medium',
    risk: 'low',
    prerequisites: [t('A baseline measure', 'Une mesure de départ')],
    ownerRole: 'sponsor',
    evidence: ['repetitive_task', 'writing_drafting', 'customer_requests'],
  },
  {
    id: 'governance.human_review_rule',
    category: 'governance',
    title: t('A person checks before anything leaves', 'Une personne vérifie avant tout envoi'),
    description: t(
      'Make it a rule that AI output sent to clients or used for decisions is read and approved by a named person.',
      'Instaurer la règle qu’un contenu produit par l’IA et envoyé à des clients ou utilisé pour décider est relu et approuvé par une personne désignée.',
    ),
    effort: 'low',
    impact: 'medium',
    risk: 'low',
    prerequisites: [],
    ownerRole: 'sponsor',
    evidence: ['policy_unclear', 'document_review'],
  },
];

const byId = new Map(IMPROVEMENT_CATALOGUE.map((e) => [e.id, e]));

/** The catalogue entry with this id, or undefined. */
export const catalogueEntry = (id: string): ImprovementEntry | undefined => byId.get(id);
