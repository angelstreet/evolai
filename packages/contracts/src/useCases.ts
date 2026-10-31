import { z } from 'zod';
import { catalogueEntry, evidenceTagSchema, type LocalisedText } from './improvementCatalogue.js';

/**
 * Use-case playbook (ADR 0064). A use case is what the client pays the audit for: one named piece
 * of work where AI or a simpler way of working saves time, with the findings that show it, the
 * steps to get there, the data rule to respect and what to measure. The report is built on them.
 *
 * Each use case is proposed when approved findings carry one of its evidence tags. The steps are
 * catalogue entries, so a report still copies their text and records the catalogue version.
 * The visit questions are the auditor's guide to measure the use case during the visit.
 */

export const USE_CASES_VERSION = '2026-10-31.1';

const textSchema = z.object({ en: z.string().min(1), fr: z.string().min(1) }).strict();

export const useCaseSchema = z
  .object({
    id: z.string().regex(/^uc\.[a-z0-9_]+$/),
    title: textSchema,
    /** One sentence: what changes for the people doing the work. */
    approach: textSchema,
    /** Evidence tags that propose this use case. */
    evidence: z.array(evidenceTagSchema).min(1).max(4),
    /** Catalogue entry ids, in the order they are planned. */
    steps: z.array(z.string()).min(1).max(4),
    /** The rule on data that goes with it. */
    dataRule: textSchema,
    /** What is counted: "CV", "tender answer", ... (singular, lower case). */
    unit: textSchema,
    /** Questions to ask during the visit to measure it. */
    visitQuestions: z.array(textSchema).min(1).max(4),
    /** Rules first: always ranked before the others and planned in the first 30 days. */
    pinned: z.boolean().optional(),
    /** Core work of a professional-services firm: proposed before general use cases. */
    core: z.boolean().optional(),
    /** Owner of a step for this use case, when the catalogue's role is too generic. */
    owners: z.record(z.string(), textSchema).optional(),
  })
  .strict();
export type UseCase = z.infer<typeof useCaseSchema>;

const t = (en: string, fr: string): LocalisedText => ({ en, fr });

const COMMON_QUESTIONS = [
  t(
    'How many times a week is it done, in the whole firm?',
    'Combien de fois par semaine, dans toute la société ?',
  ),
  t('How long does it take each time, today?', 'Combien de temps à chaque fois, aujourd’hui ?'),
];

export const USE_CASES: readonly UseCase[] = [
  {
    id: 'uc.ai_data_charter',
    title: t(
      'Rules for client data in AI tools',
      'Des règles pour les données clients dans les outils d’IA',
    ),
    approach: t(
      'Everyone knows which AI tools are allowed and what may go into them, at the firm and at clients.',
      'Chacun sait quels outils d’IA sont autorisés et ce qu’on peut y mettre, dans la société et chez les clients.',
    ),
    // "AI answers used without checking" is a rule to set too (ESN content review).
    evidence: ['policy_unclear', 'document_review'],
    steps: [
      'governance.client_data_rule',
      'governance.approved_ai_tool',
      'governance.human_review_rule',
    ],
    owners: {
      'governance.client_data_rule': t(
        'Management, with the data protection lead',
        'La direction, avec le référent données personnelles',
      ),
      'governance.approved_ai_tool': t('IT lead', 'Responsable informatique'),
      'governance.human_review_rule': t('Practice heads', 'Responsables de practice'),
    },
    dataRule: t(
      'Until the rule exists, no client document goes into a public AI tool.',
      'En attendant la règle, aucun document client ne va dans un outil d’IA public.',
    ),
    unit: t('rule', 'règle'),
    visitQuestions: [
      t(
        'Which AI tools do people use today, paid or free?',
        'Quels outils d’IA sont utilisés aujourd’hui, payants ou gratuits ?',
      ),
      t(
        'Do client contracts say anything about AI or data?',
        'Les contrats clients disent-ils quelque chose sur l’IA ou les données ?',
      ),
    ],
    pinned: true,
  },
  {
    id: 'uc.cv_tailoring',
    title: t('Adapt consultant CVs to each offer', 'Adapter les CV des consultants à chaque offre'),
    approach: t(
      'One master profile per consultant, and a first draft of the tailored CV in minutes instead of rewriting it by hand.',
      'Un profil de référence par consultant, et un premier jet du CV adapté en quelques minutes au lieu de le réécrire à la main.',
    ),
    evidence: ['cv_profiles'],
    steps: ['data.cv_master_profiles', 'ai.cv_tailoring'],
    owners: {
      'data.cv_master_profiles': t(
        'Sales lead (business managers)',
        'Responsable commercial (business managers)',
      ),
      'ai.cv_tailoring': t('Business managers', 'Business managers'),
    },
    dataRule: t(
      'Only the consultant’s own profile and the public part of the offer go into the AI tool.',
      'Seuls le profil du consultant et la partie publique de l’offre vont dans l’outil d’IA.',
    ),
    unit: t('CV', 'CV'),
    visitQuestions: [
      ...COMMON_QUESTIONS,
      t(
        'Where is the latest version of each profile kept?',
        'Où est gardée la dernière version de chaque profil ?',
      ),
    ],
    core: true,
  },
  {
    id: 'uc.tender_drafting',
    title: t('Answer tenders faster', 'Répondre plus vite aux appels d’offres'),
    approach: t(
      'Each answer starts from a library of the best past answers and a drafted first version, not from a blank page.',
      'Chaque réponse part d’une bibliothèque des meilleures réponses passées et d’un premier jet, pas d’une page blanche.',
    ),
    evidence: ['tender_response'],
    steps: ['simplify.tender_library', 'ai.tender_first_draft'],
    owners: {
      'simplify.tender_library': t('Bid lead', 'Responsable des réponses aux appels d’offres'),
      'ai.tender_first_draft': t('Bid lead', 'Responsable des réponses aux appels d’offres'),
    },
    dataRule: t(
      'The client’s tender documents go only into an approved tool, never a public one.',
      'Les documents de l’appel d’offres ne vont que dans un outil autorisé, jamais dans un outil public.',
    ),
    unit: t('tender answer', 'réponse'),
    visitQuestions: [
      t('How many tenders are answered a month?', 'Combien de réponses par mois ?'),
      t(
        'How many hours does one answer take, all people together?',
        'Combien d’heures pour une réponse, toutes personnes confondues ?',
      ),
      t(
        'Which past answers would you reuse first?',
        'Quelles réponses passées réutiliseriez-vous d’abord ?',
      ),
    ],
    core: true,
  },
  {
    id: 'uc.timesheet_billing',
    title: t(
      'From timesheets to invoices without retyping',
      'Des comptes rendus d’activité aux factures sans ressaisie',
    ),
    approach: t(
      'Timesheets entered once, reminders sent automatically, and invoice drafts built from them.',
      'Des comptes rendus saisis une seule fois, des relances automatiques, et des brouillons de factures construits à partir d’eux.',
    ),
    evidence: ['timesheet_billing'],
    steps: ['automate.timesheet_once', 'automate.invoice_from_timesheet'],
    owners: {
      'automate.timesheet_once': t('Sales administration', 'Administration des ventes'),
      'automate.invoice_from_timesheet': t(
        'Sales administration, with IT',
        'Administration des ventes, avec l’informatique',
      ),
    },
    dataRule: t(
      'Timesheets and rates stay in the firm’s own tools; no AI tool is needed for this.',
      'Comptes rendus et taux restent dans les outils de la société ; aucun outil d’IA n’est nécessaire.',
    ),
    unit: t('invoice', 'facture'),
    visitQuestions: [
      t('How many invoices a month?', 'Combien de factures par mois ?'),
      t(
        'How long from the timesheet to the invoice sent, per invoice?',
        'Combien de temps du compte rendu à la facture envoyée, par facture ?',
      ),
      t(
        'How many reminders to get the timesheets?',
        'Combien de relances pour obtenir les comptes rendus ?',
      ),
    ],
    core: true,
  },
  {
    id: 'uc.staffing_view',
    title: t('A staffing view that updates itself', 'Un staffing qui se met à jour tout seul'),
    approach: t(
      'Availability and mission end dates come from one board fed by the timesheets and contracts.',
      'Disponibilités et fins de mission viennent d’un tableau alimenté par les comptes rendus et les contrats.',
    ),
    evidence: ['staffing'],
    steps: ['data.staffing_board', 'automate.scheduled_report'],
    owners: {
      'data.staffing_board': t('Operations lead', 'Responsable des opérations'),
      'automate.scheduled_report': t('IT lead', 'Responsable informatique'),
    },
    dataRule: t(
      'Internal data only; no AI tool is needed for this.',
      'Données internes uniquement ; aucun outil d’IA n’est nécessaire.',
    ),
    unit: t('update', 'mise à jour'),
    visitQuestions: [
      t(
        'How often is the staffing sheet updated, and by whom?',
        'À quelle fréquence le tableau de staffing est-il mis à jour, et par qui ?',
      ),
      t('How long does one update take?', 'Combien de temps prend une mise à jour ?'),
    ],
    core: true,
  },
  {
    id: 'uc.candidate_screening',
    title: t(
      'Screen candidates and write up interviews faster',
      'Trier les candidatures et rédiger les entretiens plus vite',
    ),
    approach: t(
      'A grid per job, a summary of each CV against it, and interview notes put into shape; the recruiter decides.',
      'Une grille par poste, un résumé de chaque CV au regard de la grille, et des notes d’entretien mises au propre ; le recruteur décide.',
    ),
    evidence: ['recruiting'],
    steps: ['ai.candidate_screening', 'ai.interview_summary'],
    owners: {
      'ai.candidate_screening': t('HR and recruiting lead', 'Responsable RH et recrutement'),
      'ai.interview_summary': t('Recruiters', 'Recruteurs'),
    },
    dataRule: t(
      'Candidates’ data goes only into an approved tool, and nobody is rejected by a machine.',
      'Les données des candidats ne vont que dans un outil autorisé, et personne n’est écarté par une machine.',
    ),
    unit: t('application', 'candidature'),
    visitQuestions: [
      t('How many applications a week are read?', 'Combien de candidatures lues par semaine ?'),
      t(
        'How long per application, and per interview write-up?',
        'Combien de temps par candidature, et par compte rendu d’entretien ?',
      ),
    ],
    core: true,
  },
  {
    id: 'uc.recurring_reports',
    title: t(
      'Recurring reports that build themselves',
      'Des rapports récurrents qui se construisent seuls',
    ),
    approach: t(
      'The weekly or monthly report starts from an export and a drafted commentary instead of being assembled by hand.',
      'Le rapport de la semaine ou du mois part d’un export et d’un commentaire pré-rédigé au lieu d’être assemblé à la main.',
    ),
    evidence: ['reporting'],
    steps: ['automate.scheduled_report', 'ai.client_status_report'],
    dataRule: t(
      'For a client’s report, the client’s rules on tools and data come first.',
      'Pour un rapport client, les règles du client sur les outils et les données passent avant tout.',
    ),
    unit: t('report', 'rapport'),
    visitQuestions: [
      ...COMMON_QUESTIONS,
      t('Which tools does the data come from?', 'De quels outils viennent les données ?'),
    ],
    core: true,
  },
  {
    id: 'uc.meeting_notes',
    title: t('Meeting notes and follow-ups', 'Comptes rendus de réunion et suites à donner'),
    approach: t(
      'Notes and actions drafted right after the meeting, checked by the organiser.',
      'Notes et actions rédigées juste après la réunion, relues par l’organisateur.',
    ),
    evidence: ['meeting_overload'],
    steps: ['ai.meeting_notes'],
    dataRule: t(
      'Recording or transcribing needs everyone’s agreement, and client meetings follow the client’s rules.',
      'Enregistrer ou transcrire demande l’accord de chacun, et les réunions client suivent les règles du client.',
    ),
    unit: t('meeting', 'réunion'),
    visitQuestions: COMMON_QUESTIONS,
  },
  {
    id: 'uc.find_documents',
    title: t('Find the right document first time', 'Trouver le bon document du premier coup'),
    approach: t(
      'Documents kept in one organised place, with a search that answers in plain words.',
      'Des documents rangés au même endroit, avec une recherche qui répond en mots simples.',
    ),
    evidence: ['search_information'],
    steps: ['data.organise_documents', 'ai.knowledge_search'],
    dataRule: t(
      'The search only reads documents the person may already open.',
      'La recherche ne lit que les documents que la personne peut déjà ouvrir.',
    ),
    unit: t('search', 'recherche'),
    visitQuestions: COMMON_QUESTIONS,
  },
  {
    id: 'uc.data_reentry',
    title: t('Stop typing the same data twice', 'Arrêter de saisir deux fois les mêmes données'),
    approach: t(
      'Data entered once and passed between tools automatically, with a check of the result.',
      'Une saisie unique et un transfert automatique entre les outils, avec un contrôle du résultat.',
    ),
    evidence: ['manual_reentry'],
    steps: ['simplify.remove_double_entry', 'automate.transfer_between_tools'],
    dataRule: t(
      'Internal data only; no AI tool is needed for this.',
      'Données internes uniquement ; aucun outil d’IA n’est nécessaire.',
    ),
    unit: t('entry', 'saisie'),
    visitQuestions: COMMON_QUESTIONS,
  },
  {
    id: 'uc.drafting',
    title: t('First drafts of everyday documents', 'Premiers jets des documents courants'),
    approach: t(
      'Shared templates and an approved AI tool for first drafts; a person always rereads and sends.',
      'Des modèles partagés et un outil d’IA autorisé pour les premiers jets ; une personne relit et envoie toujours.',
    ),
    evidence: ['writing_drafting'],
    steps: ['simplify.templates_library', 'ai.drafting_assistant'],
    dataRule: t(
      'No client or personal data in a public AI tool.',
      'Pas de données clients ni personnelles dans un outil d’IA public.',
    ),
    unit: t('document', 'document'),
    visitQuestions: COMMON_QUESTIONS,
  },
  {
    id: 'uc.requests',
    title: t('Requests that arrive complete', 'Des demandes qui arrivent complètes'),
    approach: t(
      'One form with the required fields, and requests sorted to the right person automatically.',
      'Un formulaire avec les champs obligatoires, et des demandes envoyées automatiquement à la bonne personne.',
    ),
    evidence: ['customer_requests'],
    steps: ['automate.form_intake', 'ai.request_triage'],
    dataRule: t(
      'Personal data only in approved tools.',
      'Données personnelles uniquement dans des outils autorisés.',
    ),
    unit: t('request', 'demande'),
    visitQuestions: COMMON_QUESTIONS,
  },
];

const byId = new Map(USE_CASES.map((u) => [u.id, u]));

/** The use case with this id, or undefined. */
export const useCaseById = (id: string): UseCase | undefined => byId.get(id);

/** Every step id of every use case is a catalogue entry (checked by the tests). */
export const missingUseCaseSteps = (): string[] =>
  USE_CASES.flatMap((u) => u.steps.filter((s) => !catalogueEntry(s)).map((s) => `${u.id}:${s}`));

/**
 * Share of today's time a use case can save, as a low-high range (ADR 0064). Working assumptions,
 * dated and versioned like prices: a report records `SAVING_RATES.version`, shows the range as an
 * estimate, and the day-90 measure replaces it. Change the numbers here with a new version.
 */
export const SAVING_RATES = {
  version: '2026-10-31.1',
  effectiveFrom: '2026-10-31',
  byUseCase: {
    'uc.cv_tailoring': [0.4, 0.6],
    'uc.tender_drafting': [0.25, 0.4],
    'uc.timesheet_billing': [0.5, 0.7],
    'uc.staffing_view': [0.5, 0.8],
    'uc.candidate_screening': [0.3, 0.5],
    'uc.recurring_reports': [0.3, 0.5],
    'uc.meeting_notes': [0.3, 0.5],
    'uc.find_documents': [0.3, 0.6],
    'uc.data_reentry': [0.5, 0.8],
    'uc.drafting': [0.2, 0.4],
    'uc.requests': [0.2, 0.4],
  } as Readonly<Record<string, readonly [number, number]>>,
} as const;

/** What the auditor measured for a use case during the visit (ADR 0064). All optional. */
export const useCaseQualificationSchema = z
  .object({
    /** How many units a week, whole firm. */
    volumePerWeek: z.number().min(0).max(100000).nullable(),
    /** Minutes per unit today. */
    minutesPerUnit: z.number().min(0).max(6000).nullable(),
    /** Teams that do it, as the auditor writes them. */
    teams: z.string().max(200),
    /** Where the measure comes from ("visit, 2 business managers"). */
    source: z.string().max(200),
  })
  .strict();
export type UseCaseQualification = z.infer<typeof useCaseQualificationSchema>;

export const emptyQualification: UseCaseQualification = {
  volumePerWeek: null,
  minutesPerUnit: null,
  teams: '',
  source: '',
};
