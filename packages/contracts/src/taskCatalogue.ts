import { z } from 'zod';
import type { LocalisedText } from './improvementCatalogue.js';

/**
 * Task catalogue of the team audit (TASK-AK step K2). The questionnaire offers these tasks per job,
 * so a person taps their work instead of typing it, and the auditor starts the task board with
 * default scores. Every default can be changed by the auditor; a typed task starts with none.
 *
 * Scores are 1 to 5 (TASK-AK, owner definitions 2026-11-08):
 * - complexity: how hard the task is to change;
 * - aiRisk: how dangerous it would be to let AI do it unattended. A task that reaches a client, a
 *   candidate or a prospect is at least 4: AI may prepare it, a person confirms before it is sent.
 * Time, cost (what the task costs today) and gain come from the answers and the auditor, not from
 * the catalogue.
 *
 * The wording is generic (a professional-services firm, field works), drawn from the first pilot's
 * interviews without names. Versioned like the improvement catalogue: a report records the version.
 */

export const TASK_CATALOGUE_VERSION = '2026-11-08.1';

export const jobFamilySchema = z.enum([
  'direction',
  'business_manager',
  'recruitment_lead',
  'recruiter',
  'field_project_manager',
]);
export type JobFamily = z.infer<typeof jobFamilySchema>;

export const taskAreaSchema = z.enum([
  'admin',
  'prospecting',
  'recruiting',
  'delivery',
  'management',
  'onboarding',
  'reporting',
  'operations',
]);
export type TaskArea = z.infer<typeof taskAreaSchema>;

/** What is suggested first: change the way of working, automate without AI, use AI, or leave it. */
export const taskFixSchema = z.enum(['process', 'automation', 'ai', 'leave']);
export type TaskFix = z.infer<typeof taskFixSchema>;

const textSchema = z.object({ en: z.string().min(3), fr: z.string().min(3) }).strict();
const scoreSchema = z.number().int().min(1).max(5);

export const catalogueTaskSchema = z
  .object({
    id: z.string().regex(/^tk\.[a-z0-9_]+$/),
    area: taskAreaSchema,
    title: textSchema,
    /** What the task is made of, as people say it. */
    subTasks: z.array(textSchema).min(1).max(6),
    jobs: z.array(jobFamilySchema).min(1),
    complexity: scoreSchema,
    aiRisk: scoreSchema,
    /** It sends something to a client, a candidate or a prospect. */
    contactsPeople: z.boolean(),
    fix: taskFixSchema,
    /** The use case of the playbook (ADR 0064) it feeds, when there is one. */
    useCase: z
      .string()
      .regex(/^uc\.[a-z0-9_]+$/)
      .optional(),
  })
  .strict()
  .refine((x) => !x.contactsPeople || x.aiRisk >= 4, {
    message: 'a task that contacts people has an AI risk of 4 or more',
  });
export type CatalogueTask = z.infer<typeof catalogueTaskSchema>;

/** At this AI risk or above, AI only prepares the work and a person confirms it (TASK-AK decision 7). */
export const HUMAN_CONFIRM_FROM_RISK = 4;

/**
 * How AI may take part in a task. `person_confirms`: AI drafts, a person checks and sends; this is
 * forced for a high AI risk and for anything sent to a client, candidate or prospect, whatever the
 * suggested fix. `checked_after`: AI may run alone, a person checks the result afterwards.
 * `no_ai`: the fix is a process change, a plain automation or nothing.
 */
export type AiMode = 'person_confirms' | 'checked_after' | 'no_ai';

export const aiModeOf = (task: {
  readonly aiRisk: number;
  readonly contactsPeople: boolean;
  readonly fix: TaskFix;
}): AiMode => {
  if (task.contactsPeople || task.aiRisk >= HUMAN_CONFIRM_FROM_RISK) return 'person_confirms';
  return task.fix === 'ai' ? 'checked_after' : 'no_ai';
};

const t = (en: string, fr: string): LocalisedText => ({ en, fr });

export const JOB_FAMILIES: Readonly<Record<JobFamily, LocalisedText>> = {
  direction: t('Management and sales', 'Direction et commercial'),
  business_manager: t('Business manager', 'Business manager'),
  recruitment_lead: t('Recruitment team lead', 'Responsable d’une équipe de recrutement'),
  recruiter: t('Recruiter', 'Chargé de recrutement'),
  field_project_manager: t('Field project manager', 'Chargé d’affaires terrain'),
};

export const TASK_AREAS: Readonly<Record<TaskArea, LocalisedText>> = {
  admin: t('Administration', 'Administratif'),
  prospecting: t('Finding clients', 'Prospection'),
  recruiting: t('Recruiting', 'Recrutement'),
  delivery: t('Following assignments', 'Suivi des missions'),
  management: t('Running the team', 'Pilotage de l’équipe'),
  onboarding: t('Training newcomers', 'Intégration des nouveaux'),
  reporting: t('Reporting', 'Reporting'),
  operations: t('Field operations', 'Opérations terrain'),
};

export const TASK_CATALOGUE: readonly CatalogueTask[] = [
  {
    id: 'tk.executive_assistance',
    area: 'admin',
    title: t('Executive assistance', 'Assistanat de direction'),
    subTasks: [
      t('Company cars and field equipment', 'Flotte automobile et matériel terrain'),
      t('Quotes and expense notes to check', 'Devis et notes de frais à vérifier'),
      t('Hotel and train bookings', 'Réservations d’hôtel et de train'),
      t('Staff questions on leave and pay', 'Questions des salariés sur congés et paie'),
    ],
    jobs: ['direction'],
    complexity: 1,
    aiRisk: 3,
    contactsPeople: false,
    fix: 'automation',
    useCase: 'uc.requests',
  },
  {
    id: 'tk.subcontract_contracts',
    area: 'admin',
    title: t('Contracts for subcontractors', 'Contrats des sous-traitants'),
    subTasks: [
      t('Draft the contract from a template', 'Rédiger le contrat à partir d’un modèle'),
      t('Check the terms before sending', 'Vérifier les clauses avant l’envoi'),
    ],
    jobs: ['direction'],
    complexity: 2,
    aiRisk: 4,
    contactsPeople: true,
    fix: 'ai',
    useCase: 'uc.drafting',
  },
  {
    id: 'tk.absence_tracking',
    area: 'admin',
    title: t('Time sheets and missing absences', 'Pointage et absences non déclarées'),
    subTasks: [
      t(
        'Chase missing time entries by phone or email',
        'Relancer les pointages par téléphone ou email',
      ),
      t('Enter absences in the business application', 'Saisir les absences dans l’outil métier'),
    ],
    jobs: ['business_manager', 'field_project_manager'],
    complexity: 1,
    aiRisk: 3,
    contactsPeople: false,
    fix: 'automation',
    useCase: 'uc.timesheet_billing',
  },
  {
    id: 'tk.subcontractor_timesheets',
    area: 'admin',
    title: t(
      'Activity reports of subcontracted staff',
      'Comptes rendus d’activité des sous-traitants',
    ),
    subTasks: [
      t('Read each company’s own tool', 'Lire l’outil de chaque société'),
      t('Type the same figures again', 'Ressaisir les mêmes chiffres'),
      t('Validate before invoicing', 'Valider avant facturation'),
    ],
    jobs: ['business_manager'],
    complexity: 2,
    aiRisk: 2,
    contactsPeople: false,
    fix: 'automation',
    useCase: 'uc.data_reentry',
  },
  {
    id: 'tk.find_prospects',
    area: 'prospecting',
    title: t('Find new clients', 'Trouver des prospects'),
    subTasks: [
      t('Build the list of targets', 'Constituer la liste de cibles'),
      t('Find phone numbers', 'Trouver les numéros de téléphone'),
      t('Call and log each call', 'Appeler et noter chaque appel'),
      t('Spot assignments that end soon', 'Repérer les fins de mission'),
    ],
    jobs: ['direction', 'business_manager'],
    complexity: 3,
    aiRisk: 5,
    contactsPeople: true,
    fix: 'ai',
  },
  {
    id: 'tk.network_outreach',
    area: 'prospecting',
    title: t('Messages on professional networks', 'Messages sur les réseaux professionnels'),
    subTasks: [
      t('Opening message', 'Message d’accroche'),
      t('Second reply, checked first', 'Deuxième réponse, validée avant'),
      t('Voice messages and follow-ups', 'Messages vocaux et relances'),
      t('Filter targets by sector', 'Filtrer les cibles par secteur'),
    ],
    jobs: ['business_manager'],
    complexity: 2,
    aiRisk: 5,
    contactsPeople: true,
    fix: 'ai',
  },
  {
    id: 'tk.tailored_presentation',
    area: 'prospecting',
    title: t('Presentation made for one client', 'Présentation adaptée à un client'),
    subTasks: [
      t('Company references', 'Références de la société'),
      t('Profiles that fit the need', 'Profils qui répondent au besoin'),
    ],
    jobs: ['business_manager'],
    complexity: 2,
    aiRisk: 4,
    contactsPeople: true,
    fix: 'ai',
    useCase: 'uc.drafting',
  },
  {
    id: 'tk.job_ad_watch',
    area: 'prospecting',
    title: t('Watch the job ads of known clients', 'Veille des offres d’emploi des clients'),
    subTasks: [
      t('Visit each client’s careers page', 'Consulter le site carrière de chaque client'),
      t('List the new openings', 'Lister les nouveaux postes'),
    ],
    jobs: ['business_manager'],
    complexity: 3,
    aiRisk: 2,
    contactsPeople: false,
    fix: 'automation',
  },
  {
    id: 'tk.need_to_job_description',
    area: 'recruiting',
    title: t('Turn a need into a job description', 'Transformer un besoin en fiche de poste'),
    subTasks: [
      t('Understand the message or the tender', 'Comprendre le message ou l’appel d’offres'),
      t('Write the job description and keywords', 'Rédiger la fiche de poste et les mots-clés'),
    ],
    jobs: ['business_manager', 'recruitment_lead'],
    complexity: 1,
    aiRisk: 2,
    contactsPeople: false,
    fix: 'ai',
    useCase: 'uc.drafting',
  },
  {
    id: 'tk.source_profiles',
    area: 'recruiting',
    title: t('Search for profiles', 'Rechercher des profils'),
    subTasks: [
      t('Search job boards by keyword', 'Chercher sur les jobboards par mots-clés'),
      t(
        'Filter by sector, region and availability',
        'Filtrer par secteur, région et disponibilité',
      ),
      t('Check the profile fits the assignment', 'Vérifier que le profil colle à la mission'),
    ],
    jobs: ['direction', 'recruitment_lead', 'recruiter'],
    complexity: 3,
    aiRisk: 3,
    contactsPeople: false,
    fix: 'ai',
    useCase: 'uc.candidate_screening',
  },
  {
    id: 'tk.import_profiles',
    area: 'recruiting',
    title: t('Add a profile to the business application', 'Ajouter un profil dans l’outil métier'),
    subTasks: [
      t('Download the CV', 'Télécharger le CV'),
      t(
        'Check it is not already there, in every company',
        'Vérifier les doublons, dans chaque filiale',
      ),
      t('Write the comment', 'Écrire le commentaire'),
      t('Pass it to the business manager', 'Le transmettre au business manager'),
    ],
    jobs: ['recruitment_lead', 'recruiter'],
    complexity: 2,
    aiRisk: 2,
    contactsPeople: false,
    fix: 'automation',
    useCase: 'uc.data_reentry',
  },
  {
    id: 'tk.match_offer_cv',
    area: 'recruiting',
    title: t('Match a CV to a tender', 'Rapprocher un CV d’un appel d’offres'),
    subTasks: [
      t('Score the CV against the tender', 'Noter le CV face à l’appel d’offres'),
      t('Rework the CV and the cover letter', 'Reprendre le CV et la lettre'),
    ],
    jobs: ['business_manager'],
    complexity: 2,
    aiRisk: 4,
    contactsPeople: true,
    fix: 'ai',
    useCase: 'uc.cv_tailoring',
  },
  {
    id: 'tk.candidate_calls',
    area: 'recruiting',
    title: t('Calls with candidates', 'Appels aux candidats'),
    subTasks: [
      t('Pre-qualification call', 'Appel de préqualification'),
      t('Notes after the call', 'Notes après l’appel'),
      t('Keep the call history', 'Garder l’historique des appels'),
    ],
    jobs: ['recruiter'],
    complexity: 1,
    aiRisk: 5,
    contactsPeople: true,
    fix: 'ai',
    useCase: 'uc.meeting_notes',
  },
  {
    id: 'tk.assignment_follow_up',
    area: 'delivery',
    title: t('Follow-up with clients and consultants', 'Points de suivi clients et consultants'),
    subTasks: [
      t('Check-in with the client', 'Point avec le client'),
      t('Check-in with the consultant', 'Point avec le consultant'),
      t('Write up and plan the next one', 'Compte rendu et prochain point'),
    ],
    jobs: ['direction', 'business_manager'],
    complexity: 1,
    aiRisk: 5,
    contactsPeople: true,
    fix: 'ai',
    useCase: 'uc.meeting_notes',
  },
  {
    id: 'tk.team_daily_kpi',
    area: 'management',
    title: t('Daily check-in and team figures', 'Point du jour et indicateurs de l’équipe'),
    subTasks: [
      t('Contacts reached and targets', 'Contacts aboutis et objectifs'),
      t('CVs found, interviews, profiles accepted', 'CV sourcés, entretiens, profils validés'),
    ],
    jobs: ['recruitment_lead'],
    complexity: 1,
    aiRisk: 1,
    contactsPeople: false,
    fix: 'automation',
    useCase: 'uc.recurring_reports',
  },
  {
    id: 'tk.duplicate_records',
    area: 'management',
    title: t('The same data in several places', 'Les mêmes données à plusieurs endroits'),
    subTasks: [
      t('Personal spreadsheet', 'Tableur personnel'),
      t('Notes application', 'Application de notes'),
      t('Shared spreadsheet and business application', 'Tableur partagé et outil métier'),
    ],
    jobs: ['recruitment_lead', 'recruiter'],
    complexity: 2,
    aiRisk: 1,
    contactsPeople: false,
    fix: 'process',
    useCase: 'uc.data_reentry',
  },
  {
    id: 'tk.knowledge_sharing',
    area: 'management',
    title: t('Share what the team knows', 'Partager ce que l’équipe sait'),
    subTasks: [
      t('A shared knowledge base', 'Une base de connaissance commune'),
      t(
        'A backup when someone changes phone or leaves',
        'Une sauvegarde quand quelqu’un change de téléphone ou part',
      ),
    ],
    jobs: ['recruitment_lead'],
    complexity: 2,
    aiRisk: 2,
    contactsPeople: false,
    fix: 'process',
    useCase: 'uc.find_documents',
  },
  {
    id: 'tk.onboard_recruiters',
    area: 'onboarding',
    title: t('Train new recruiters', 'Former les nouveaux chargés de recrutement'),
    subTasks: [
      t('Job-board accounts and searches', 'Comptes et recherches sur les jobboards'),
      t('How to talk to candidates', 'Comment parler aux candidats'),
      t('How to check skills', 'Comment vérifier les compétences'),
    ],
    jobs: ['direction', 'recruitment_lead'],
    complexity: 1,
    aiRisk: 2,
    contactsPeople: false,
    fix: 'process',
  },
  {
    id: 'tk.onboard_sales',
    area: 'onboarding',
    title: t('Train new sales staff', 'Former les nouveaux commerciaux'),
    subTasks: [
      t('Set up the tools', 'Mettre en place les outils'),
      t('The prospecting method, with examples', 'La méthode de prospection, avec des exemples'),
      t('How to price a day', 'Comment positionner un tarif journalier'),
    ],
    jobs: ['direction'],
    complexity: 3,
    aiRisk: 2,
    contactsPeople: false,
    fix: 'process',
  },
  {
    id: 'tk.monthly_margin_report',
    area: 'reporting',
    title: t('Monthly margin per consultant', 'Marge mensuelle par consultant'),
    subTasks: [
      t(
        'Daily rate, daily cost and billed days',
        'Tarif journalier, coût journalier et jours facturés',
      ),
      t('Bonus of the business managers', 'Intéressement des business managers'),
    ],
    jobs: ['direction'],
    complexity: 1,
    aiRisk: 1,
    contactsPeople: false,
    fix: 'automation',
    useCase: 'uc.recurring_reports',
  },
  {
    id: 'tk.project_dashboard',
    area: 'reporting',
    title: t('Dashboard per client and project', 'Tableau de bord par client et projet'),
    subTasks: [
      t('Fill the spreadsheet by hand', 'Remplir le tableur à la main'),
      t('Cross figures from several sources', 'Croiser des chiffres de plusieurs sources'),
    ],
    jobs: ['field_project_manager'],
    complexity: 2,
    aiRisk: 1,
    contactsPeople: false,
    fix: 'automation',
    useCase: 'uc.recurring_reports',
  },
  {
    id: 'tk.weekly_planning',
    area: 'operations',
    title: t('Weekly plan of the field teams', 'Planning hebdomadaire des équipes terrain'),
    subTasks: [
      t('Planned and confirmed work', 'Travaux prévus et confirmés'),
      t('Validate with the client', 'Valider avec le client'),
      t('Final plans and equipment', 'Plannings finaux et matériel'),
    ],
    jobs: ['field_project_manager'],
    complexity: 3,
    aiRisk: 4,
    contactsPeople: true,
    fix: 'automation',
  },
  {
    id: 'tk.quote_to_invoice',
    area: 'operations',
    title: t('From quote to invoice', 'Du devis à la facture'),
    subTasks: [
      t('Site visit and quote', 'Visite technique et devis'),
      t('Purchase order and work', 'Bon de commande et intervention'),
      t('Acceptance report and invoice', 'Procès-verbal de réception et facture'),
    ],
    jobs: ['field_project_manager'],
    complexity: 2,
    aiRisk: 4,
    contactsPeople: true,
    fix: 'ai',
    useCase: 'uc.timesheet_billing',
  },
  {
    id: 'tk.site_safety_plan',
    area: 'operations',
    title: t('Safety plan for each site', 'Plan de prévention pour chaque chantier'),
    subTasks: [
      t('Start from the site and the client’s rules', 'Partir du chantier et des règles du client'),
      t('Check before work starts', 'Vérifier avant le début des travaux'),
    ],
    jobs: ['field_project_manager'],
    complexity: 2,
    aiRisk: 4,
    contactsPeople: false,
    fix: 'ai',
    useCase: 'uc.drafting',
  },
  {
    id: 'tk.site_follow_up',
    area: 'operations',
    title: t('Follow sites as they happen', 'Suivre les chantiers en temps réel'),
    subTasks: [
      t('Photos and messages from the teams', 'Photos et messages des équipes'),
      t('Keep track of what is done', 'Garder la trace de ce qui est fait'),
    ],
    jobs: ['field_project_manager'],
    complexity: 2,
    aiRisk: 2,
    contactsPeople: false,
    fix: 'process',
  },
  {
    id: 'tk.equipment_fleet',
    area: 'operations',
    title: t('Vehicles, fuel cards and equipment', 'Véhicules, cartes carburant et matériel'),
    subTasks: [
      t('Who has which vehicle and card', 'Qui a quel véhicule et quelle carte'),
      t('Phone lines and SIM cards', 'Lignes et cartes SIM'),
      t('Equipment supplied by the client', 'Matériel fourni par le client'),
    ],
    jobs: ['direction', 'field_project_manager'],
    complexity: 1,
    aiRisk: 1,
    contactsPeople: false,
    fix: 'automation',
  },
];

const byId = new Map(TASK_CATALOGUE.map((x) => [x.id, x]));
export const catalogueTaskById = (id: string): CatalogueTask | undefined => byId.get(id);

/** Tasks offered to a job, in catalogue order (areas grouped). */
export const tasksForJob = (job: JobFamily): readonly CatalogueTask[] =>
  TASK_CATALOGUE.filter((x) => x.jobs.includes(job));
