/**
 * APPLICATION LAYER — Catalogue d'actions de l'assistant IA (copilot), rôle STAFF.
 *
 * Même principe que `adminActionCatalog.ts`/`teacherActionCatalog.ts`. Périmètre de ce
 * premier passage (Section 6.2 du plan) : uniquement les domaines qui n'ont AUCUN écran
 * Admin et n'ont donc jamais pu être couverts par le catalogue Admin — Discipline, APEE,
 * Bibliothèque, Orientation. Le reste (Finance, Notes, Conseil de classe pédagogique,
 * Emploi du temps...) est déjà dans `adminActionCatalog.ts` et devient automatiquement
 * accessible à un STAFF ayant la permission requise dès que le rôle STAFF est autorisé
 * sur la route — pas dupliqué ici.
 *
 * Chaque action porte `allowedRoles: ['STAFF']` ET, quand pertinent, `requiredPermission`
 * pour distinguer les profils STAFF entre eux (un Bibliothécaire n'a pas forcément
 * MANAGE_DISCIPLINE, un Censeur n'a pas forcément MANAGE_LIBRARY) — voir le fix apporté
 * à `filterCatalogForUser` dans catalogShared.ts, qui revérifie désormais les deux
 * critères ensemble au lieu de laisser `allowedRoles` court-circuiter `requiredPermission`.
 *
 * Note de conformité : contrairement au catalogue Admin (où chaque use case revérifie déjà
 * ses propres permissions), les routes REST existantes pour Discipline/APEE/Bibliothèque
 * ne vérifient qu'un `requireRole('ADMIN','STAFF')` générique, jamais la permission fine
 * (constat de l'état des lieux) — le filtrage par `requiredPermission` ci-dessus est donc
 * la SEULE protection fine pour ces domaines côté copilot, d'où son importance.
 */
import { z } from 'zod';
import type { CreerTransactionAPEEUseCase } from '@application/apee/CreerTransactionAPEEUseCase';
import type { ValiderDepenseAPEEUseCase } from '@application/apee/ValiderDepenseAPEEUseCase';
import type { AjouterSuiviUseCase } from '@application/orientation/AjouterSuiviUseCase';
import {
  type ActionDefinition,
  defineAction,
  resolveClass,
  resolveStudent,
  resolveCurrentAcademicYear,
} from '@infrastructure/assistant/catalog/catalogShared';

export interface StaffActionDeps {
  creerTransactionAPEE: CreerTransactionAPEEUseCase;
  validerDepenseAPEE: ValiderDepenseAPEEUseCase;
  ajouterSuiviOrientation: AjouterSuiviUseCase;
  /** Notification SMS/push/email aux parents — logique extraite de la route inline POST /api/v2/discipline. */
  notifierSanctionDisciplinaire: (
    schoolId: string,
    studentId: string,
    studentName: string,
    type: 'WARNING_ORAL' | 'WARNING_WRITTEN' | 'TEMP_EXCLUSION',
    reason: string,
  ) => Promise<void>;
}

/**
 * Libellés français des codes de sanction (DisciplineType) — évite d'exposer le code technique
 * brut dans le chat. Couvre les 5 valeurs de l'enum Prisma, pas seulement les 3 que ce catalogue
 * peut créer : `lever_sanction` peut lire un enregistrement créé depuis l'écran Discipline
 * classique (ex. COUNCIL_DECISION), hors du périmètre du copilot mais pas de sa lecture.
 */
const LABEL_TYPE_SANCTION: Record<string, string> = {
  WARNING_ORAL: 'Avertissement oral',
  WARNING_WRITTEN: 'Avertissement écrit',
  TEMP_EXCLUSION: 'Exclusion temporaire',
  COUNCIL_DECISION: 'Décision du conseil de discipline',
  PERMANENT_EXCLUSION: 'Exclusion définitive',
};

/** Libellés français des statuts de sanction (DisciplineStatus) — même raison que ci-dessus. */
const LABEL_STATUT_SANCTION: Record<string, string> = {
  ACTIVE: 'active',
  LIFTED: 'levée',
  APPEALED: 'contestée',
};

export function buildStaffActionCatalog(deps: StaffActionDeps): ActionDefinition[] {
  return [
    // ═══ Discipline ═══
    // Note de périmètre : uniquement les sanctions simples. La convocation d'un Conseil de
    // Discipline (Art. 30 — composition de 6 personnes nommées, délai légal de 72h, PV) reste
    // hors catalogue — trop structuré pour une commande en langage naturel, même logique que
    // l'exclusion de "tenir un conseil de classe complet" côté Admin.

    // 1. Enregistrer une sanction disciplinaire simple — NON destructif (réversible via lever_sanction)
    defineAction({
      name: 'enregistrer_sanction',
      description:
        "Enregistre une sanction disciplinaire simple (avertissement oral, avertissement écrit, ou exclusion temporaire) pour un élève. " +
        "Notifie automatiquement les parents (SMS/email). Pour une décision de conseil ou une exclusion définitive, orientez vers l'écran " +
        "Discipline — ces sanctions graves exigent un Conseil de Discipline formel (convocation 72h, composition légale, PV), non disponible depuis le copilot.",
      destructive: false,
      requiredPermission: 'MANAGE_DISCIPLINE',
      allowedRoles: ['STAFF'],
      inputSchema: z.object({
        studentName: z.string().min(1),
        className: z.string().optional().describe('Précisez si plusieurs élèves portent ce nom'),
        type: z
          .enum(['WARNING_ORAL', 'WARNING_WRITTEN', 'TEMP_EXCLUSION'])
          .describe('Type de sanction : oral, écrit, ou exclusion temporaire.'),
        reason: z.string().min(1).describe('Motif de la sanction'),
        startDate: z.string().optional().describe('Date de début au format YYYY-MM-DD, pour une exclusion temporaire'),
        endDate: z.string().optional().describe('Date de fin au format YYYY-MM-DD, pour une exclusion temporaire'),
      }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const record = await ctx.data.portal.createDisciplineRecord({
          schoolId: ctx.schoolId,
          studentId: student.id,
          type: input.type,
          reason: input.reason,
          decidedById: ctx.userId,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        });
        await deps.notifierSanctionDisciplinaire(ctx.schoolId, student.id, student.name, input.type, input.reason).catch(() => {});
        return {
          resultLabel: `Sanction (${LABEL_TYPE_SANCTION[input.type] ?? input.type}) enregistrée pour ${student.name} — parents notifiés`,
          undoData: { recordId: record.id },
          section: 'discipline',
          entity: 'disciplineRecord',
        };
      },
      async undo(_params, undoData, ctx) {
        await ctx.data.portal.liftDisciplineRecordById(ctx.schoolId, String(undoData.recordId));
      },
    }),

    // 2. Lever une sanction — NON destructif
    defineAction({
      name: 'lever_sanction',
      description: "Lève (annule) la sanction disciplinaire active la plus récente d'un élève.",
      destructive: false,
      requiredPermission: 'MANAGE_DISCIPLINE',
      allowedRoles: ['STAFF'],
      inputSchema: z.object({ studentName: z.string().min(1), className: z.string().optional() }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const record = await ctx.data.portal.findLatestActiveDisciplineRecord(ctx.schoolId, student.id);
        if (!record) throw new Error(`Aucune sanction active trouvée pour ${student.name}.`);
        await ctx.data.portal.liftDisciplineRecordById(ctx.schoolId, record.id);
        return {
          resultLabel: `Sanction (${LABEL_TYPE_SANCTION[record.type] ?? record.type}) levée pour ${student.name}`,
          section: 'discipline',
          entity: 'disciplineRecord',
        };
      },
      async undo() {
        throw new Error('La levée de sanction ne peut pas être annulée depuis le copilot — utilisez l\'écran Discipline.');
      },
    }),

    // 3. Sanctions récentes d'un élève — LECTURE SEULE
    defineAction({
      name: 'sanctions_recentes_eleve',
      description: "Liste les sanctions disciplinaires (actives ou levées) d'un élève.",
      destructive: false,
      requiredPermission: 'MANAGE_DISCIPLINE',
      allowedRoles: ['STAFF'],
      inputSchema: z.object({ studentName: z.string().min(1), className: z.string().optional() }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const records = await ctx.data.portal.findRecentDisciplineRecords(ctx.schoolId, student.id, 10);
        const resultLabel = records.length === 0
          ? `Aucune sanction enregistrée pour ${student.name}.`
          : `Sanctions de ${student.name} : ` + records.map((r) => `${LABEL_TYPE_SANCTION[r.type] ?? r.type} (${LABEL_STATUT_SANCTION[r.status] ?? r.status}, ${r.createdAt.toLocaleDateString('fr-FR')}) — ${r.reason}`).join(' ; ');
        return { resultLabel, section: 'discipline', entity: 'disciplineRecord' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    }),

    // ═══ APEE ═══

    // 4. Enregistrer une transaction APEE (collecte ou dépense) — NON destructif
    defineAction({
      name: 'enregistrer_transaction_apee',
      description:
        "Enregistre une transaction APEE : une COLLECTE (montant reçu, considérée valide immédiatement) ou une DEPENSE " +
        "(nécessite un justificatif à joindre depuis l'écran APEE avant de pouvoir être validée).",
      destructive: false,
      requiredPermission: 'MANAGE_FINANCE',
      allowedRoles: ['STAFF'],
      inputSchema: z.object({
        type: z.enum(['COLLECTE', 'DEPENSE']),
        montant: z.number().positive(),
        categorie: z.string().optional(),
        description: z.string().optional(),
      }),
      async execute(input, ctx) {
        const r = await deps.creerTransactionAPEE.execute({
          schoolId: ctx.schoolId,
          creeParId: ctx.userId,
          type: input.type,
          montant: input.montant,
          categorie: input.categorie,
          description: input.description,
        });
        const label = input.type === 'COLLECTE' ? 'Collecte' : 'Dépense';
        return {
          resultLabel: `${label} APEE de ${input.montant} FCFA enregistrée` + (input.type === 'DEPENSE' ? ' — joignez un justificatif depuis l\'écran APEE avant validation' : ''),
          undoData: { transactionId: r.id },
          section: 'apee',
          entity: 'apeeTransaction',
        };
      },
      async undo(_params, undoData, ctx) {
        await ctx.data.portal.deleteApeeTransactionById(ctx.schoolId, String(undoData.transactionId));
      },
    }),

    // 5. Valider une dépense APEE — NON annulable
    defineAction({
      name: 'valider_depense_apee',
      description: "Valide une dépense APEE qui a déjà un justificatif joint — refuse si aucun justificatif n'a été téléversé.",
      destructive: false,
      requiredPermission: 'MANAGE_FINANCE',
      allowedRoles: ['STAFF'],
      inputSchema: z.object({ description: z.string().min(1).describe('Description ou catégorie permettant de retrouver la dépense') }),
      async execute(input, ctx) {
        const target = await ctx.data.portal.findPendingApeeExpenseByDescription(ctx.schoolId, input.description);
        if (!target) throw new Error(`Aucune dépense APEE non validée trouvée correspondant à « ${input.description} ».`);
        await deps.validerDepenseAPEE.execute({ schoolId: ctx.schoolId, transactionId: target.id, valideParId: ctx.userId });
        return {
          resultLabel: `Dépense APEE de ${target.montant} FCFA validée`,
          section: 'apee',
          entity: 'apeeTransaction',
        };
      },
      async undo() {
        throw new Error('La validation d\'une dépense APEE ne peut pas être annulée depuis le copilot.');
      },
    }),

    // 6. Solde APEE — LECTURE SEULE
    defineAction({
      name: 'solde_apee',
      description: "Donne le solde actuel de l'APEE (total des collectes moins total des dépenses validées), et le nombre de dépenses en attente de justificatif ou de validation.",
      destructive: false,
      requiredPermission: 'MANAGE_FINANCE',
      allowedRoles: ['STAFF'],
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const { totalCollectes, totalDepenses, pendingExpensesCount } = await ctx.data.portal.getApeeBalanceSummary(ctx.schoolId);
        return {
          resultLabel: `Solde APEE : ${totalCollectes - totalDepenses} FCFA (${totalCollectes} FCFA collectés, ${totalDepenses} FCFA dépensés) — ${pendingExpensesCount} dépense(s) en attente de justificatif ou de validation.`,
          section: 'apee',
        };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    }),

    // ═══ Bibliothèque ═══

    // 7. Emprunter un livre — NON destructif (réversible via retourner_livre)
    defineAction({
      name: 'emprunter_livre',
      description: "Enregistre l'emprunt d'un livre par un élève — refuse si aucun exemplaire n'est disponible.",
      destructive: false,
      requiredPermission: 'MANAGE_LIBRARY',
      allowedRoles: ['STAFF'],
      inputSchema: z.object({
        studentName: z.string().min(1),
        className: z.string().optional(),
        bookTitle: z.string().min(1),
        dueDate: z.string().optional().describe('Date de retour prévue au format YYYY-MM-DD — 15 jours par défaut'),
      }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const book = await ctx.data.portal.findBookByTitleContains(ctx.schoolId, input.bookTitle);
        if (!book) throw new Error(`Aucun livre correspondant à « ${input.bookTitle} » n'existe dans le catalogue.`);
        if (book.available <= 0) throw new Error(`Aucun exemplaire disponible pour « ${book.title} ».`);
        const dueDate = input.dueDate ? new Date(input.dueDate) : new Date(Date.now() + 15 * 86400000);
        const loan = await ctx.data.portal.createBookLoanTransaction({
          schoolId: ctx.schoolId,
          bookId: book.id,
          studentId: student.id,
          dueDate,
        });
        return {
          resultLabel: `« ${book.title} » emprunté par ${student.name}, à retourner avant le ${dueDate.toLocaleDateString('fr-FR')}`,
          undoData: { loanId: loan.id, bookId: book.id },
          section: 'library',
          entity: 'bookLoan',
        };
      },
      async undo(_params, undoData, ctx) {
        await ctx.data.portal.cancelBookLoanTransaction({
          schoolId: ctx.schoolId,
          loanId: String(undoData.loanId),
          bookId: String(undoData.bookId),
        });
      },
    }),

    // 8. Retourner un livre — NON destructif
    defineAction({
      name: 'retourner_livre',
      description: "Enregistre le retour d'un livre emprunté par un élève.",
      destructive: false,
      requiredPermission: 'MANAGE_LIBRARY',
      allowedRoles: ['STAFF'],
      inputSchema: z.object({ studentName: z.string().min(1), className: z.string().optional(), bookTitle: z.string().optional().describe('Précisez si l\'élève a plusieurs emprunts actifs') }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const loans = await ctx.data.portal.findActiveStudentBookLoans({
          schoolId: ctx.schoolId,
          studentId: student.id,
          bookTitleContains: input.bookTitle ?? undefined,
        });
        if (loans.length === 0) throw new Error(`Aucun emprunt actif trouvé pour ${student.name}${input.bookTitle ? ` (« ${input.bookTitle} »)` : ''}.`);
        if (loans.length > 1) {
          throw new Error(`${student.name} a plusieurs emprunts actifs : ${loans.map((l) => l.bookTitle).join(', ')}. Précisez le titre.`);
        }
        const loan = loans[0];
        await ctx.data.portal.returnBookLoanTransaction({
          schoolId: ctx.schoolId,
          loanId: loan.id,
          bookId: loan.bookId,
        });
        return {
          resultLabel: `« ${loan.bookTitle} » retourné par ${student.name}`,
          section: 'library',
          entity: 'bookLoan',
        };
      },
      async undo() {
        throw new Error('Un retour de livre déjà enregistré ne peut pas être annulé depuis le copilot.');
      },
    }),

    // 9. Livres disponibles — LECTURE SEULE
    defineAction({
      name: 'livres_disponibles',
      description: "Recherche des livres dans le catalogue et indique le nombre d'exemplaires disponibles.",
      destructive: false,
      requiredPermission: 'MANAGE_LIBRARY',
      allowedRoles: ['STAFF'],
      inputSchema: z.object({ recherche: z.string().min(1).describe('Titre, auteur, ou mot-clé') }),
      async execute(input, ctx) {
        const books = await ctx.data.portal.searchBooks(ctx.schoolId, input.recherche, 10);
        const resultLabel = books.length === 0
          ? `Aucun livre trouvé pour « ${input.recherche} ».`
          : books.map((b) => `« ${b.title} »${b.author ? ` (${b.author})` : ''} : ${b.available}/${b.quantity} disponible(s)`).join(' ; ');
        return { resultLabel, section: 'library' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    }),

    // ═══ Orientation ═══

    // 10. Ajouter un suivi d'orientation — NON destructif (historique, mais non annulable une fois ajouté)
    defineAction({
      name: 'ajouter_suivi_orientation',
      description:
        "Ajoute un suivi (entretien de suivi, évolution du niveau de risque) à la fiche d'orientation ouverte d'un élève, pour l'année scolaire courante. " +
        "Nécessite qu'une fiche d'orientation soit déjà ouverte pour cet élève.",
      destructive: false,
      requiredPermission: 'MANAGE_ORIENTATION',
      allowedRoles: ['STAFF'],
      inputSchema: z.object({
        studentName: z.string().min(1),
        className: z.string().optional(),
        riskLevel: z.enum(['FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE']),
        mainConcern: z.enum(['SCOLAIRE', 'COMPORTEMENTAL', 'FAMILIAL', 'PROFESSIONNEL', 'SANTE', 'AUTRE']),
        interventions: z.string().optional(),
        notes: z.string().optional(),
      }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const year = await resolveCurrentAcademicYear(ctx);
        const ficheId = await ctx.data.portal.findOpenOrientationFicheId({
          schoolId: ctx.schoolId,
          studentId: student.id,
          academicYearId: year.id,
        });
        if (!ficheId) throw new Error(`Aucune fiche d'orientation ouverte pour ${student.name} sur l'année courante — créez-en une depuis l'écran Orientation d'abord.`);
        await deps.ajouterSuiviOrientation.execute({
          ficheId,
          schoolId: ctx.schoolId,
          riskLevel: input.riskLevel,
          mainConcern: input.mainConcern,
          interventions: input.interventions,
          notes: input.notes,
        });
        return {
          resultLabel: `Suivi ajouté pour ${student.name} — niveau de risque : ${input.riskLevel}`,
          section: 'orientation',
          entity: 'suiviOrientation',
        };
      },
      async undo() {
        throw new Error('Un suivi d\'orientation ajouté ne peut pas être annulé depuis le copilot — utilisez l\'écran Orientation.');
      },
    }),

    // 11. Élèves à risque en orientation — LECTURE SEULE
    defineAction({
      name: 'eleves_a_risque_orientation',
      description: "Liste les élèves ayant une fiche d'orientation ouverte avec un niveau de risque élevé ou critique, pour l'année scolaire courante.",
      destructive: false,
      requiredPermission: 'MANAGE_ORIENTATION',
      allowedRoles: ['STAFF'],
      inputSchema: z.object({ className: z.string().optional() }),
      async execute(input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        let classId: string | undefined;
        let label = "l'établissement";
        if (input.className) {
          const classe = await resolveClass(ctx, input.className);
          classId = classe.id;
          label = classe.name;
        }
        const fiches = await ctx.data.portal.findOpenHighRiskOrientationFiches({
          schoolId: ctx.schoolId,
          academicYearId: year.id,
          classId,
        });
        const resultLabel = fiches.length === 0
          ? `Aucun élève à risque élevé/critique en orientation pour ${label}.`
          : `${fiches.length} élève(s) à risque pour ${label} : ` +
            fiches.map((f) => `${f.firstName ?? ''} ${f.lastName ?? ''} (${f.riskLevel})`.trim()).join(', ');
        return { resultLabel, section: 'orientation' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    }),
  ];
}
