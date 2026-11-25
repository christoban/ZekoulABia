# Schéma de la base de données ZEKOULABIA

## Nombre total de tables : ~100 modèles Prisma (+ ~45 enums)

---

## Vue d'ensemble par domaine fonctionnel

### 1. Multi-tenancy & Propriété (5 tables)

| Table | Rôle | Attributs clés |
|---|---|---|
| **SchoolGroup** | Groupe d'écoles | id, name, ownerId, planTier |
| **SchoolGroupOwner** | Propriétaire du groupe | id, email, passwordHash, name, mfaEnabled |
| **School** | Établissement (racine du tenant) | id, name, subdomain, type, plan, status, subsystem, educationType, ownership, features, defaultMaxWeeklyHours |
| **SchoolInvite** | Invitation à la plateforme | id, email, token, status, expiresAt |
| **GroupTransferRequest** | Transfert inter-école dans un groupe | id, groupId, type, sourceSchoolId, targetSchoolId, status |

**Relations :** `SchoolGroup` 1 ← * `School` · `SchoolGroup` 1 ← 1 `SchoolGroupOwner`

---

### 2. Configuration de l'école (9 tables)

| Table | Rôle | Attributs clés |
|---|---|---|
| **SchoolConfig** | Config (poids notes, sécurité, features) | ds1Weight, ds2Weight, compositionWeight, passMark, aiRiskThreshold, bulletinTemplate |
| **SchoolSettings** | Timezone, locale, currency, backup | timezone, locale, currency, lastBackupAt |
| **SchoolNotificationSettings** | Toggle SMS/email | smsAbsences, smsPayments, smsBulletins |
| **SchoolConfigurationForm** | Formulaire onboarding config | formData (JSON) |
| **SchoolOnboardingSettings** | Paramètres d'onboarding | selfServiceEnabled, tokenExpiryDays, reminderDelayDays |
| **SchoolStatisticalSupplement** | Données statistiques MINESEC | hasTitreFoncier, superficieTerrainM2, etc. |
| **MinedubSchoolSupplement** | Données MINEDUB | zoneImplantation, elevesVulnerablesDetail |
| **TimetableGridConfig** | Config grille emploi du temps | heureDebut, dureePeriode, joursActifs |
| **OrientationCheckpointConfig** | Config checkpoints orientation | possibleTracks, relevantSubjects |

**Relations :** Toutes en 1..1 avec `School`

---

### 3. Utilisateurs & Rôles (8 tables)

| Table | Rôle | Attributs clés |
|---|---|---|
| **MasterUser** | Admin/support plateforme | email, role, assignedSchoolIds, mfaEnabled |
| **MasterAuthAudit** | Audit auth master | action, ipAddress |
| **User** | Personne dans le système | firstName, lastName, email, phone, role, isActive, accessMode |
| **UserArchive** | Archive d'un user supprimé | originalUserId, snapshot (JSON) |
| **StudentProfile** | Données spécifiques élève | matricule, dateOfBirth, gender, healthScore, photoUrl |
| **TeacherProfile** | Données spécifiques enseignant | specialization[], supervisedSubjectIds[], maxWeeklyHours |
| **ParentProfile** | Données spécifiques parent | (vide — extension de User) |
| **StaffProfile** | Personnel administratif | title, sectionId |

**Relations :** `School` 1 ← * `User` · `User` 1 ← 0..1 `StudentProfile` / `TeacherProfile` / `ParentProfile` / `StaffProfile`

---

### 4. Liens Parent-Élève & Sous-groupes (6 tables)

| Table | Rôle |
|---|---|
| **ParentStudent** | Join many-to-many parent ↔ élève |
| **StudentSubGroupAssignment** | Affectation élève ↔ sous-groupe |
| **ClassSubGroup** | Sous-groupe dans une classe |
| **StudentGroupSet** | Dimension de subdivision (LV2, Sport…) |
| **StudentGroup** | Valeur dans un set (ex: "Allemand" dans "LV2") |
| **StudentGroupMembership** | Affectation élève ↔ groupe ↔ année |

---

### 5. Sections & Départements (4 tables)

| Table | Rôle | Attributs clés |
|---|---|---|
| **Section** | Regroupement académique | name, code (FR/EN), gradingSystem, passmark |
| **Department** | Département académique | name, color, headId |
| **SubjectCoefficient** | Coefficient par niveau/série | subjectId, classLevel, coefficient |
| **ClassSubjectOverride** | Override coefficient par classe | classId, subjectId, coefficient |

---

### 6. Matières & Enseignement (6 tables)

| Table | Rôle |
|---|---|
| **Subject** | Matière enseignée (name, coefficient, subjectType, isLV2) |
| **TeacherSubject** | Join enseignant ↔ matière |
| **TeachingAssignment** | Affectation enseignant-matière-classe-année | source, createdAt |
| **TeacherUnavailability** | Indisponibilité hebdomadaire enseignant |
| **Lv2ChoiceWindow** | Fenêtre de choix LV2 |
| **Lv2ChoiceSubmission** | Choix LV2 d'un élève |

---

### 7. Classes & Promotions (7 tables)

| Table | Rôle |
|---|---|
| **Class** | Classe (6ème A, Tle C…) : name, level, capacity, filiere, serie |
| **Enrollment** | Inscription élève dans une classe/année |
| **StudentPromotion** | Promotion individuelle d'un élève |
| **ClassPromotion** | Promotion de classe → classe |
| **ClassRoomAssignment** | Affectation classe → salle |
| **ClassCouncilSession** | Session du conseil de classe |
| **ClassCouncilDecision** | Décision du conseil par élève |

---

### 8. Années & Périodes académiques (3 tables)

| Table | Rôle |
|---|---|
| **AcademicYear** | Année scolaire (name, startDate, endDate, isCurrent) |
| **AcademicPeriod** | Trimestre/terme (type TRIMESTER, orderIndex) |
| **AcademicSequence** | Séquence/évaluation (DS, COMPOSITION…) |

**Relations :** `AcademicYear` 1 ← * `AcademicPeriod` 1 ← * `AcademicSequence`

---

### 9. Notes & Évaluations (5 tables)

| Table | Rôle | Attributs clés |
|---|---|---|
| **Grade** | Note élève/matière/séquence | sequenceScore, classTestScore, terminalExamScore, coefficient, validationStatus |
| **GradeFormula** | Formule de notation custom | evaluations (JSON) |
| **MentionRule** | Règles de mention | rules (JSON) |
| **Exam** | Définition d'examen | title, scheduledAt, duration, content, isAiGenerated |
| **Submission** | Soumission élève à un examen | answers (JSON), score |

---

### 10. Bulletins (2 tables)

| Table | Rôle |
|---|---|
| **ReportCard** | Bulletin par période | generalAverage, rank, mention, template, pdfUrl |
| **ReportCardSubjectLine** | Ligne matière du bulletin | subjectName, coefficient, seq1Score…seq6Score, subjectAverage |

---

### 11. Emploi du temps (4 tables)

| Table | Rôle |
|---|---|---|
| **Timetable** | Container emploi du temps | status (DRAFT/PUBLISHED), generatedByAI |
| **TimetableSlot** | Créneau horaire | dayOfWeek, startTime, endTime, kind (CLASS/BREAK/ACTIVITY) |
| **TimetableGenerationRun** | Run asynchrone de génération globale EDT | status, requestedById, progress/results (JSON), preflightReport, budgetSeconds, heartbeatAt |
| **Room** | Salle physique | name, type (NORMAL/LABORATORY/…), capacity, equipment |

---

### 12. Présence (1 table)

| Table | Rôle |
|---|---|
| **Attendance** | Présence élève/jour/période | status (PRESENT/ABSENT/LATE/…), period, justification |

---

### 13. Discipline (3 tables)

| Table | Rôle |
|---|---|
| **DisciplineRecord** | Infraction | type (WARNING/EXCLUSION…), reason, status |
| **DisciplineCouncilSession** | Conseil de discipline | motif, decision, pv |
| **DisciplineCouncilSession** | Session discipline | status, composition (JSON) |

---

### 14. Finances (7 tables)

| Table | Rôle |
|---|---|
| **FeePlan** | Plan de frais | name, amount, feeType, dueDate |
| **Invoice** | Facture élève | amount, status (PENDING/PAID/OVERDUE…) |
| **Payment** | Paiement | amount, method (CASH/MOMO/…), status |
| **Expense** | Dépense école | label, amount, category |
| **APEETransaction** | Transaction APEE | type (COLLECTE/DEPENSE), montant |
| **InscriptionMinesec** | Inscription MINESEC | status, anneeScolaire |
| **Enrollment** | Inscription scolaire | status, enrolledAt |

---

### 15. MINESEC & Examens officiels (9 tables)

| Table | Rôle |
|---|---|
| **ExamRegistration** | Inscription à un examen officiel |
| **EntranceExamSession** | Session examen d'entrée |
| **EntranceExamCandidate** | Candidat examen d'entrée |
| **PebsExamSession** | Session PEBS |
| **PebsExamCandidate** | Candidat PEBS |
| **PaiementMinesec** | Paiement frais MINESEC |
| **PaiementEtablissement** | Paiement frais établissement |
| **TarifMinesecReference** | Référence tarifaire MINESEC |
| **TypeFraisMinesec** | (enum) Types de frais |

---

### 16. Messaging & Notifications (8 tables)

| Table | Rôle |
|---|---|
| **Conversation** | Conversation (PRIVATE, CLASS_CHANNEL…) |
| **ConversationParticipant** | Participant à une conversation |
| **Message** | Message avec modération |
| **MessageReadStatus** | Accusé de réception |
| **Notification** | Notification in-app/push |
| **NotificationPreference** | Préférences notif par user |
| **PushSubscription** | Abonnement Web Push (VAPID) |
| **Announcement** | Annonce école |

---

### 17. Orientation & Suivi (8 tables)

| Table | Rôle |
|---|---|
| **FicheOrientation** | Fiche orientation élève |
| **EntretienOrientation** | Entretien d'orientation |
| **TestAptitude** | Test d'aptitude |
| **RecommandationSerie** | Recommandation de série |
| **SuiviOrientation** | Suivi orientation |
| **StudentAspiration** | Aspiration de l'élève |
| **StudentRecommendation** | Recommandation IA personnalisée |
| **StudentFollowUpAction** | Action de suivi |

---

### 18. Bibliothèque (2 tables)

| Table | Rôle |
|---|---|
| **Book** | Livre (title, author, isbn, quantity) |
| **BookLoan** | Emprunt (borrowedAt, dueDate, status) |

---

### 19. Programmes & Cahier de textes (4 tables)

| Table | Rôle |
|---|---|
| **Programme** | Programme par matière/classe/année |
| **Chapitre** | Chapitre du programme |
| **CahierDeTexte** | Cahier de textes enseignant |
| **AcademicEvent** | Événement calendaire (rentrée, choix LV2…) |

---

### 20. RH / Personnel (6 tables)

| Table | Rôle |
|---|---|
| **EmployeeFile** | Dossier employé |
| **CareerEvent** | Événement de carrière |
| **StaffAttendance** | Présence du personnel |
| **LeaveRequest** | Demande de congé |
| **LeaveBalance** | Solde congés |
| **MissionOrder** | Ordre de mission |

---

### 21. Onboarding (1 table)

| Table | Rôle |
|---|---|
| **StudentOnboarding** | Onboarding élève (token, submittedData, status) |

---

### 22. Statistiques & Rapports (4 tables)

| Table | Rôle |
|---|---|
| **StatisticalCampaignTemplate** | Modèle de campagne statistique |
| **CampaignFieldMapping** | Mapping champs template |
| **StatisticalSubmission** | Soumission statistique |
| **MinedubStatisticalReport** | Rapport Minedub généré |

---

### 23. Logs & Utilitaires (13 tables)

| Table | Rôle |
|---|---|
| **ActivitiesLog** | Log d'activités |
| **EmailLog** | Log emails envoyés |
| **SmsLog** | Log SMS envoyés |
| **BroadcastLog** | Log diffusions |
| **OfflineQueue** | File d'attente offline |
| **AssistantActionLog** | Log actions assistant IA |
| **AssistantHelpQueryLog** | Log requêtes aide IA |
| **AssistantConversationTurn** | Tour de conversation IA |
| **AIActionAuditLog** | Audit actions IA |
| **AISecurityAlert** | Alertes sécurité IA |
| **IdempotencyRecord** | Clé d'idempotence |
| **MatriculeImportJob** | Job import matricules |
| **VerifiableDocument** | Document vérifiable |

---

## Relations principales (pour diagramme de classes)

```
SchoolGroup ◆── School (composition, 1..*)
SchoolGroupOwner ─── SchoolGroup (association, 1..1)

School ─── User (1..*)
School ─── Section (1..*)
School ─── AcademicYear (1..*)
School ─── Subject (1..*)
School ─── Department (1..*)

User ─── StudentProfile (1..0..1)
User ─── TeacherProfile (1..0..1)
User ─── ParentProfile (1..0..1)
User ─── StaffProfile (1..0..1)
User ─── EmployeeFile (1..0..1)

ParentProfile ◇── ParentStudent ◇── StudentProfile (agrégation)

StudentProfile ─── Enrollment (1..*)
Enrollment ─── Class (1..1)
Enrollment ─── AcademicYear (1..1)

Class ─── AcademicYear (1..1)
Class ─── Section (0..1)
Class ─── Timetable (1..*)
Class ─── ClassCouncilSession (1..*)

AcademicYear ─── AcademicPeriod (1..*)
AcademicPeriod ─── AcademicSequence (1..*)
AcademicSequence ─── Grade (1..*)

Grade ─── StudentProfile (1..1)
Grade ─── Subject (1..1)
Grade ─── AcademicSequence (1..1)

ReportCard ─── StudentProfile (1..1)
ReportCard ─── AcademicPeriod (1..1)
ReportCard ◆── ReportCardSubjectLine (composition, 1..*)

Timetable ◆── TimetableSlot (composition, 1..*)

FeePlan ─── School (1..1)
Invoice ─── FeePlan (0..1)
Invoice ─── StudentProfile (1..1)
Invoice ◆── Payment (agrégation, 1..*)

FicheOrientation ◆── EntretienOrientation (composition)
FicheOrientation ◆── TestAptitude (composition)
FicheOrientation ◆── RecommandationSerie (composition)
FicheOrientation ◆── SuiviOrientation (composition)

Conversation ◆── Message (composition, 1..*)
Conversation ◆── ConversationParticipant (composition)

Book ◆── BookLoan (composition, 1..*)

Programme ◆── Chapitre (composition, 1..*)

EntranceExamSession ◆── EntranceExamCandidate (composition)
PebsExamSession ◆── PebsExamCandidate (composition)
InscriptionMinesec ◆── PaiementMinesec (composition)
InscriptionMinesec ◆── PaiementEtablissement (composition)
```

---

## Enums principaux à placer dans le diagramme

| Enum | Utilisation |
|---|---|
| `UserRole` | ADMIN, STAFF, TEACHER, PARENT, STUDENT |
| `SchoolType` | PRESCHOOL, PRIMARY, SECONDARY, MULTI |
| `SchoolStatus` | DRAFT, PENDING, APPROVED, ACTIVE, REJECTED, SUSPENDED |
| `GradeValidationStatus` | DRAFT, SUBMITTED, VALIDATED, LOCKED, REJECTED |
| `InvoiceStatus` | PENDING, PARTIAL, PAID, OVERDUE, CANCELLED |
| `AttendanceStatus` | PRESENT, ABSENT, LATE, ABSENT_JUSTIFIED |
| `TimetableStatus` | DRAFT, PUBLISHED |
| `BulletinTemplate` | FR_SECONDARY, EN_SECONDARY, PRIMARY, ANNUAL… |
| `FeeType` | TUITION, APEE_PTA, EXAM, UNIFORM, CAUTION, WORKSHOP, INSCRIPTION… |
| `PaymentMethod` | CASH, MTN_MOMO, ORANGE_MONEY, BANK_TRANSFER, EXPRESS_UNION |
| `DisciplineType` | WARNING_ORAL, WARNING_WRITTEN, TEMP_EXCLUSION, COUNCIL_DECISION, PERMANENT_EXCLUSION |
| `CouncilDecision` | PASS, REPEAT, DELIBERATION |
| `SequenceType` | DS, COMPOSITION, CLASS_TEST, TERMINAL_EXAM, UA |
| `ConversationType` | PRIVATE, CLASS_CHANNEL, PARENT_CHANNEL, SYSTEM |
| `NotificationType` | ACADEMIC, ATTENDANCE, COMMUNICATION, FINANCIAL, AI_ALERT, POSITIVE, SYSTEM |

---

**Note :** Les opérations (méthodes) ne sont pas dans le schema Prisma — elles vivent dans les use cases / controllers du backend. Pour le diagramme de classes UML, tu peux les déduire des routes API ou les modéliser à partir des comportements métier (ex: `Grade.calculateAverage()`, `ReportCard.generate()`, `Timetable.autoGenerate()`).
