import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas

PDF_PATH = "/home/ndzanachristophe/Téléchargements/ZekoulABia Vision et Solution.pdf"

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Header (Pages >= 2)
        if self._pageNumber > 1:
            self.drawString(38, 808, "ZekoulABia — Vision, Solution & Architecture Métier")
            self.drawRightString(A4[0] - 38, 808, "MINESEC & MINEDUB · SaaS Multi-établissement")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(38, 801, A4[0] - 38, 801)

        # Footer (All pages)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(38, 38, A4[0] - 38, 38)
        self.drawString(38, 26, "Document confidentiel · Réservé à la Direction et Team ZekoulABia")
        self.drawRightString(A4[0] - 38, 26, f"Page {self._pageNumber} sur {total_pages}")
        self.restoreState()


def build_pdf():
    doc = SimpleDocTemplate(
        PDF_PATH,
        pagesize=A4,
        leftMargin=38,
        rightMargin=38,
        topMargin=44,
        bottomMargin=44
    )

    styles = getSampleStyleSheet()

    PRIMARY = colors.HexColor("#0F2942")     # Bleu marine profond
    SECONDARY = colors.HexColor("#059669")   # Vert Émeraude ZekoulABia
    TEXT_COLOR = colors.HexColor("#1E293B")  # Gris ardoise foncé
    MUTED = colors.HexColor("#64748B")       # Gris neutre
    BG_LIGHT = colors.HexColor("#F8FAFC")    # Fond très clair
    BG_HEADER = colors.HexColor("#0F2942")
    ACCENT_BG = colors.HexColor("#ECFDF5")   # Vert pastel
    BORDER_COLOR = colors.HexColor("#CBD5E1")

    styles.add(ParagraphStyle(
        name='DocTitle',
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=30,
        textColor=PRIMARY,
        spaceAfter=5
    ))
    styles.add(ParagraphStyle(
        name='DocSubtitle',
        fontName='Helvetica',
        fontSize=11.5,
        leading=15,
        textColor=SECONDARY,
        spaceAfter=12
    ))
    styles.add(ParagraphStyle(
        name='MetaNotice',
        fontName='Helvetica-Oblique',
        fontSize=8.5,
        leading=12,
        textColor=MUTED,
        spaceAfter=12
    ))
    styles.add(ParagraphStyle(
        name='SecHeading',
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=PRIMARY,
        spaceBefore=12,
        spaceAfter=7,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        name='SubSecHeading',
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13.5,
        textColor=SECONDARY,
        spaceBefore=9,
        spaceAfter=4,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        name='CustomBody',
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=TEXT_COLOR,
        spaceAfter=5
    ))
    styles.add(ParagraphStyle(
        name='BulletText',
        fontName='Helvetica',
        fontSize=8.3,
        leading=11.8,
        textColor=TEXT_COLOR,
        leftIndent=10,
        spaceAfter=3.5
    ))
    styles.add(ParagraphStyle(
        name='TableHeader',
        fontName='Helvetica-Bold',
        fontSize=7.8,
        leading=10,
        textColor=colors.white,
        alignment=0
    ))
    styles.add(ParagraphStyle(
        name='TableCell',
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=TEXT_COLOR
    ))
    styles.add(ParagraphStyle(
        name='TableCellBold',
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10,
        textColor=PRIMARY
    ))
    styles.add(ParagraphStyle(
        name='CalloutText',
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#065F46")
    ))

    story = []

    # ─────────────────────────────────────────────────────────────────────────────
    # PAGE 1 : EN-TÊTE & ESSENTIEL
    # ─────────────────────────────────────────────────────────────────────────────
    story.append(Paragraph("ZekoulABia", styles['DocTitle']))
    story.append(Paragraph("Notre école, simplement. — Vision, Solution & Inventaire Fonctionnel Conforme", styles['DocSubtitle']))
    story.append(Paragraph("Plateforme SaaS multi-établissement conçue pour les sous-systèmes éducatifs camerounais (MINESEC & MINEDUB)<br/><b>Mise à jour intégrale : Octobre 2026</b> · Document de référence stratégique & technique", styles['MetaNotice']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=SECONDARY, spaceBefore=0, spaceAfter=10))

    story.append(Paragraph("1. L'essentiel", styles['SecHeading']))
    story.append(Paragraph(
        "<b>ZekoulABia</b> est une plateforme SaaS (<i>Software as a Service</i>) multi-établissement de gestion scolaire intégrale. "
        "Chaque établissement y dispose de son espace indépendant, étanche et entièrement configuré selon son sous-système "
        "(francophone, anglophone, bilingue, enseignement technique ou primaire). Elle digitalise l'intégralité du cycle de vie éducatif : "
        "onboarding déterministe, inscriptions directes, emplois du temps par solveur sous contraintes, présences horodatées, workflow hiérarchique des notes, "
        "bulletins officiels MINESEC infalsifiables, paiements directs Mobile Money et communications d'urgence.",
        styles['CustomBody']
    ))
    story.append(Paragraph("La plateforme s'appuie sur quatre piliers d'excellence technique et métier :", styles['CustomBody']))
    story.append(Paragraph("• <b>Conformité ministérielle rigoureuse :</b> 19 configurations officielles (MINESEC/MINEDUB) intégrées en dur. Coefficients, grilles horaires, séries, épreuves et mentions sont nativement conformes aux arrêtés nationaux.", styles['BulletText']))
    story.append(Paragraph("• <b>Architecture Offline-First robuste :</b> Saisie des notes en classe, appel et cahier de texte opérationnels même sans internet, grâce à une base locale Dexie.js (IndexedDB), un registre de risques et une boîte d'envoi chiffrée.", styles['BulletText']))
    story.append(Paragraph("• <b>Automatisation mathématique & IA souveraine :</b> Solveur CP-SAT (Google OR-Tools) pour la génération d'emplois du temps sans conflit et assistant Copilot exécutant sécurisé (Groq LLM) avec annulation réversible.", styles['BulletText']))
    story.append(Paragraph("• <b>Inclusion financière & Sécurité bancaire :</b> Rapprochement immédiat des frais par Mobile Money (MTN MoMo & Orange Money via Campay) et double authentification obligatoire (MFA/TOTP) pour tous les encadrants.", styles['BulletText']))

    story.append(Spacer(1, 3))
    story.append(Paragraph("2. Le nom, la vision et la mission", styles['SecHeading']))
    story.append(Paragraph(
        "<b>Le nom :</b> Issu des racines camerounaises, <i>Zekoulu</i> signifie « l'école » et <i>Abia</i> signifie « notre ». "
        "ZekoulABia proclame : <i>« Notre école »</i>. L'outil n'impose pas une bureaucratie externe mais restitue la maîtrise aux acteurs de terrain.",
        styles['CustomBody']
    ))

    v_text = Paragraph("<b>Notre vision :</b> <i>« Permettre à tout établissement du Cameroun — du lycée métropolitain d'excellence de Yaoundé ou Douala au collège d'arrondissement le plus isolé — d'être administré avec la rigueur d'une grande institution : zéro papier perdu, zéro erreur de calcul sur les bulletins et zéro interruption d'activité face aux coupures réseau. »</i>", styles['CalloutText'])
    v_table = Table([[v_text]], colWidths=[518])
    v_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), ACCENT_BG),
        ('BOX', (0,0), (-1,-1), 1, SECONDARY),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(v_table)
    story.append(Spacer(1, 5))

    story.append(Paragraph(
        "<b>Notre mission :</b> Équiper Proviseurs, Censeurs, Surveillants Généraux, Intendants, Enseignants et Parents d'une interface limpide, unifiée et bilingue, "
        "qui respecte scrupuleusement la hiérarchie scolaire et libère des centaines d'heures de saisie manuelle au profit de la réussite pédagogique.",
        styles['CustomBody']
    ))

    # ─────────────────────────────────────────────────────────────────────────────
    # PAGE 2 : MATRICE DES PROBLÈMES & SAAS MULTI-TENANT
    # ─────────────────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("3. Les défis majeurs du terrain et la réponse ZekoulABia", styles['SecHeading']))

    prob_data = [
        [Paragraph("Problématique de terrain", styles['TableHeader']), Paragraph("Solution déployée dans le code ZekoulABia", styles['TableHeader'])],
        [
            Paragraph("<b>Dossiers dispersés & fiches perdues</b><br/>Fichiers Excel multiples, doublons d'élèves, perte d'historique.", styles['TableCell']),
            Paragraph("Dossier élève unique et immuable, traçabilité par matricule national, synchronisation automatique avec la carte scolaire MINESEC et historique d'audit unifié.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Calcul manuel des moyennes & contestations</b><br/>Nuits blanches de fin de trimestre, coefficients erronés, fraudes.", styles['TableCell']),
            Paragraph("Moteur de notation déterministe à source unique : calcul instantané des moyennes, rangs et mentions selon la filière. Verrouillage hiérarchique (DRAFT → SUBMITTED → VALIDATED → LOCKED).", styles['TableCell'])
        ],
        [
            Paragraph("<b>Casse-tête des emplois du temps</b><br/>Conflits d'enseignants, salles occupées en double, 3 semaines perdues.", styles['TableCell']),
            Paragraph("Solveur sous contraintes CP-SAT (Google OR-Tools) : génération globale multi-classes asynchrone (Inngest), respect des journées raccourcies, blocs contigus et créneaux groupés de LV2.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Pointage & assiduité non vérifiables</b><br/>Présence réelle contestée, cours non dispensés, parents non prévenus.", styles['TableCell']),
            Paragraph("Feuille d'appel numérique par créneau, carillon in-app, alertes instantanées par SMS aux parents en cas d'absence imprévue, et lien direct avec le cahier de texte numérique.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Élèves en décrochage détectés trop tard</b><br/>Aucune corrélation entre retards, discipline et chute de notes.", styles['TableCell']),
            Paragraph("Indice d'alerte et de santé scolaire assisté par IA (Groq) : détection précoce du risque de décrochage dès la 3e absence ou baisse séquentielle, avec fiches de suivi assignées.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Gestion opaque des frais & recouvrement</b><br/>Cahiers de caisse égarés, fraudes sur les reçus, impayés récurrents.", styles['TableCell']),
            Paragraph("Paiement digitalisé direct par Mobile Money (MTN MoMo, Orange Money via Campay) avec reçu sécurisé immédiat, gestion des versements cash au guichet et suivi des cotisations APEE.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Connexion internet intermittente ou absente</b><br/>Logiciels cloud bloqués à la moindre coupure réseau ou délestage.", styles['TableCell']),
            Paragraph("Technologie Offline-First : Dexie.js (IndexedDB local), boîte d'envoi Outbox avec clés d'idempotence UUID v4. Les profs font l'appel et saisissent les notes hors-ligne sans blocage.", styles['TableCell'])
        ],
    ]
    prob_table = Table(prob_data, colWidths=[175, 343])
    prob_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_HEADER),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(prob_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("4. Architecture SaaS Multi-établissement & Isolation", styles['SecHeading']))
    story.append(Paragraph(
        "ZekoulABia opère sur une architecture multi-tenant étanche à haute disponibilité. "
        "Chaque établissement client bénéficie d'une étanchéité logique stricte :",
        styles['CustomBody']
    ))
    story.append(Paragraph("• <b>Isolation des données au niveau de la requête :</b> Toutes les tables métier sont liées à une clé <code>schoolId</code>. Le middleware <code>authMultiTenant.ts</code> et les politiques RBAC brident systématiquement chaque requête au contexte de l'école.", styles['BulletText']))
    story.append(Paragraph("• <b>Espaces de direction autonomes :</b> Un Fondateur de groupe scolaire (<code>SchoolGroupOwner</code>) peut superviser plusieurs campus tout en préservant l'étanchéité des gestions quotidiennes.", styles['BulletText']))
    story.append(Paragraph("• <b>Ségrégation des accès Master :</b> Le portail d'administration plateforme (<code>/master</code>) dispose de jetons JWT spécifiques chiffrés en HS512 avec clés indépendantes et journal d'audit des actions sensibles.", styles['BulletText']))

    # ─────────────────────────────────────────────────────────────────────────────
    # PAGE 3 : INVENTAIRE COMPLET DES RÔLES & SOUS-RÔLES
    # ─────────────────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("5. Cartographie exhaustive des Rôles et Permissions (RBAC)", styles['SecHeading']))
    story.append(Paragraph(
        "La sécurité de ZekoulABia repose sur un contrôle d'accès fondé sur les rôles (RBAC) conforme aux usages administratifs camerounais. "
        "Le rôle <b>STAFF</b> se subdivise en titres réels portant des ensembles de permissions vérifiées à chaque route d'API :",
        styles['CustomBody']
    ))

    roles_data = [
        [Paragraph("Rôle / Titre dans le code", styles['TableHeader']), Paragraph("Périmètre & Mission", styles['TableHeader']), Paragraph("Permissions & Actions Clés", styles['TableHeader'])],
        [
            Paragraph("<b>SUPER_ADMIN</b><br/><i>(Master Admin)</i>", styles['TableCellBold']),
            Paragraph("Équipe plateforme ZekoulABia. Supervision globale, gestion des licences et santé du système.", styles['TableCell']),
            Paragraph("Invitation et activation d'écoles, suspension/réactivation, changement de plan, réinitialisation de sécurité MFA, déclenchement des sauvegardes.", styles['TableCell'])
        ],
        [
            Paragraph("<b>ADMIN</b><br/><i>(Proviseur / Directeur)</i>", styles['TableCellBold']),
            Paragraph("Chef d'établissement. Pleins pouvoirs de gestion, gouvernance et clôture d'année.", styles['TableCell']),
            Paragraph("Configuration de l'école, création des classes/matières, attribution des rôles staff, clôture d'année, bulletins officiels, pilotage IA Copilot (avec undo).", styles['TableCell'])
        ],
        [
            Paragraph("<b>Censeur / Vice-Principal</b><br/><i>(Staff Secondaire FR/EN)</i>", styles['TableCellBold']),
            Paragraph("Directeur des études et de l'organisation pédagogique.", styles['TableCell']),
            Paragraph("<code>MANAGE_TIMETABLE</code>, <code>VALIDATE_GRADES</code>, <code>MANAGE_CLASSES</code>, <code>MANAGE_STUDENT_ASSIGNMENTS</code>, <code>MANAGE_TEACHING_ASSIGNMENTS</code>, <code>MANAGE_ANONYMAT</code>.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Surveillant Général / Discipline Master</b><br/><i>(Staff Vie Scolaire)</i>", styles['TableCellBold']),
            Paragraph("Garant de l'ordre, de la ponctualité et du respect du règlement.", styles['TableCell']),
            Paragraph("<code>MANAGE_ATTENDANCE</code>, <code>MANAGE_DISCIPLINE</code>, <code>MANAGE_INCIDENTS</code> : gestion des absences, justifications, sanctions et conseils de discipline.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Intendant / Économe / Bursar</b><br/><i>(Staff Finances)</i>", styles['TableCellBold']),
            Paragraph("Gestionnaire financier et comptable de l'établissement.", styles['TableCell']),
            Paragraph("<code>MANAGE_FINANCE</code>, <code>VALIDATE_PAYMENTS</code>, <code>GENERATE_REPORTS</code>, <code>MANAGE_ENROLLMENT</code> : plans de frais, factures masse, encaissements cash, cautions.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Secrétaire / School Secretary</b><br/><i>(Staff Scolarité)</i>", styles['TableCellBold']),
            Paragraph("Guichet d'accueil, inscriptions et pièces administratives.", styles['TableCell']),
            Paragraph("<code>MANAGE_ENROLLMENT</code>, <code>GENERATE_REPORTS</code> : inscriptions directes d'élèves en cours d'année, imports Excel, certificats de scolarité et cartes d'élèves.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Animateur Pédagogique / HOD</b><br/><i>(Staff Département)</i>", styles['TableCellBold']),
            Paragraph("Responsable de département disciplinaire (Maths, Lettres...).", styles['TableCell']),
            Paragraph("<code>SUPERVISE_DEPARTMENT_TEACHERS</code>, <code>VIEW_DEPARTMENT_GRADES</code>, <code>SUPERVISE_LESSON_PLANS</code> : suivi des cahiers de texte et progression des cours.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Directeur Adjoint / Deputy Head</b><br/><i>(Staff Primaire FR/EN)</i>", styles['TableCellBold']),
            Paragraph("Adjoint de direction pour le cycle primaire ou maternel.", styles['TableCell']),
            Paragraph("Gestion des livrets scolaires, présences, maîtres, classes primaires, conseils des maîtres et affectations pédagogiques primaires.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Chef des Travaux</b><br/><i>(Staff Technique)</i>", styles['TableCellBold']),
            Paragraph("Responsable des filières industrielles et commerciales.", styles['TableCell']),
            Paragraph("<code>MANAGE_ATELIERS</code>, <code>MANAGE_PRACTICAL_GRADES</code>, <code>MANAGE_INTERNSHIPS</code>, <code>MANAGE_STAGE_CONVENTIONS</code> : ateliers, matières pratiques, stages.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Conseiller d'Orientation</b><br/><i>(Staff Orientation)</i>", styles['TableCellBold']),
            Paragraph("Accompagnement vocationnel et choix de séries.", styles['TableCell']),
            Paragraph("<code>MANAGE_ORIENTATION</code> : fiches de souhaits, entretiens personnalisés, passation de tests d'aptitude, recommandations de filières (A, C, D, TI, STT...).", styles['TableCell'])
        ],
        [
            Paragraph("<b>Documentaliste & Comptable-M.</b><br/><i>(Staff Bibliothèque & Mat.)</i>", styles['TableCellBold']),
            Paragraph("Gestion du fonds documentaire et inventaire mobilier.", styles['TableCell']),
            Paragraph("<code>MANAGE_LIBRARY</code> (prêts, retours, catalogue) et <code>MANAGE_PATRIMOINE</code> / <code>MANAGE_DEGRADATIONS</code> (inventaire matériel et signalement de casse).", styles['TableCell'])
        ],
        [
            Paragraph("<b>TEACHER</b><br/><i>(dont Prof. Principal)</i>", styles['TableCellBold']),
            Paragraph("Corps professoral et d'enseignement.", styles['TableCell']),
            Paragraph("Appel en direct, saisie et soumission de notes, correction anonyme, cahier de texte, demandes de rattrapage. Si Prof Principal : appréciations globales de bulletins.", styles['TableCell'])
        ],
        [
            Paragraph("<b>PARENT & STUDENT</b><br/><i>(Espaces Familles)</i>", styles['TableCellBold']),
            Paragraph("Parents d'élèves, tuteurs légaux et apprenants.", styles['TableCell']),
            Paragraph("Parent : paiement Mobile Money, relevé de présence, notes, bulletins certifiés. Élève : devoirs, emploi du temps, choix LV2 dès la 4e, babillard officiel.", styles['TableCell'])
        ],
    ]
    roles_table = Table(roles_data, colWidths=[120, 160, 238])
    roles_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_HEADER),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(roles_table)

    # ─────────────────────────────────────────────────────────────────────────────
    # PAGE 4 : INVENTAIRE DÉTAILLÉ DES FONCTIONNALITÉS PAR MODULE
    # ─────────────────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("6. Inventaire des Fonctionnalités par Module Métier", styles['SecHeading']))

    mods_data = [
        [Paragraph("Module Métier", styles['TableHeader']), Paragraph("Écrans Frontend Réels", styles['TableHeader']), Paragraph("Fonctionnalités & Capacités Déployées", styles['TableHeader'])],
        [
            Paragraph("<b>Inscriptions & Admissions</b>", styles['TableCellBold']),
            Paragraph("<code>SectionInscriptionsStaff</code><br/><code>SectionImportElevesStaff</code><br/><code>SectionAdminEntranceExams</code><br/><code>SectionAdminPebsExams</code><br/><code>SectionEleveOnboarding</code>", styles['TableCell']),
            Paragraph("• Inscription directe sans tiers par Secrétaire ou Admin (option <code>adminGereInscriptions</code>).<br/>• Import Excel en masse avec détection intelligente des doublons.<br/>• Cycle complet du concours d'entrée en 6e : sessions, scan Vision IA des listes papier, détection d'anomalies, admission provisoire et bascule définitive sur résultat du CEP.<br/>• Sélection et examen d'entrée PEBS (Programme Bilingue Spécial).", styles['TableCell'])
        ],
        [
            Paragraph("<b>Classes, Groupes & Affectations</b>", styles['TableCellBold']),
            Paragraph("<code>SectionClasses</code><br/><code>SectionClassesStaff</code><br/><code>SectionSubjects</code><br/><code>SectionAffectations</code><br/><code>SectionOrgPedagogyHub</code>", styles['TableCell']),
            Paragraph("• Définition des classes, sous-groupes de travaux pratiques (TP) et salles attitrées.<br/>• Nomination du Professeur Principal et gestion des délégués.<br/>• Algorithme glouton déterministe d'affectation automatique enseignants ↔ matières/classes sous plafond hebdomadaire d'heures (max 14h pour les Animateurs Pédagogiques).<br/>• Déclaration des choix LV2 des élèves (Allemand, Espagnol, Italien, Chinois).", styles['TableCell'])
        ],
        [
            Paragraph("<b>Emplois du Temps (CP-SAT Engine)</b>", styles['TableCellBold']),
            Paragraph("<code>SectionTimetable</code><br/><code>SectionTimetableStaff</code><br/><code>SectionGrilleHoraire</code><br/><code>SectionTeacherTimetable</code><br/><code>SectionStudentTimetable</code>", styles['TableCell']),
            Paragraph("• Solveur mathématique CP-SAT (Google OR-Tools WASM) avec pattern <i>propose → apply</i>.<br/>• Prise en charge des journées écourtées (mercredi ou samedi midi) et pauses.<br/>• Regroupement synchronisé des séances de cours électifs (LV2, séries du 2nd cycle).<br/>• Génération globale multi-classes asynchrone par Inngest (<code>propose-all</code> / <code>apply-all</code>).<br/>• Gestion complète des demandes de rattrapage d'heures par les enseignants.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Présences & Vie Scolaire</b>", styles['TableCellBold']),
            Paragraph("<code>SectionTeacherAttendance</code><br/><code>SectionAttendanceStaff</code><br/><code>SectionAdminAttendance</code><br/><code>SectionDiscipline</code>", styles['TableCell']),
            Paragraph("• Appel numérique en direct par créneau horaire sur mobile ou ordinateur.<br/>• Déclenchement automatique de SMS aux parents dès la notification d'absence.<br/>• Justification médicale ou parentale tracée dans le dossier élève.<br/>• Registre de discipline : avertissements, blâmes, retenues, exclusions temporaires.<br/>• Convocation et procès-verbaux des séances de conseil de discipline.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Notes, Évaluations & Bulletins</b>", styles['TableCellBold']),
            Paragraph("<code>SectionTeacherGrades</code><br/><code>SectionGradeValidation</code><br/><code>SectionBulletins</code><br/><code>SectionBulletinValidation</code><br/><code>SectionTeacherCorrectionAnonyme</code>", styles['TableCell']),
            Paragraph("• Saisie séquentielle et trimestrielle des notes avec barème MINESEC.<br/>• Mode correction sous anonymat pour compositions et examens blancs.<br/>• Circuit hiérarchique étanche de validation des notes avant calcul des moyennes.<br/>• 6 templates officiels de bulletins PDF (Secondaire FR, EN, Technique, Primaire, Annuel, Mensuel) générés avec moyennes, rangs, coefficients et visas.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Finances & Frais de Scolarité</b>", styles['TableCellBold']),
            Paragraph("<code>SectionFinance</code><br/><code>SectionFinanceStaff</code><br/><code>SectionParentPayments</code><br/><code>SectionCautions</code><br/><code>SectionAPEEStaff</code>", styles['TableCell']),
            Paragraph("• Grille tarifaire paramétrable par cycle et échéancier de versement.<br/>• Facturation en masse et gestion des encaissements physiques au guichet (Cash).<br/>• Rapprochement instantané Mobile Money (MTN MoMo et Orange Money via Campay).<br/>• Reçu de caisse dématérialisé avec QR code transmis immédiatement aux parents.<br/>• Gestion dédiée des cautions remboursables et de la trésorerie APEE.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Babillard, Messagerie & Alertes</b>", styles['TableCellBold']),
            Paragraph("<code>Babillard</code><br/><code>Messagerie</code><br/><code>SectionModerationMessagerie</code><br/><code>NotificationCenter</code>", styles['TableCell']),
            Paragraph("• Babillard officiel skeuomorphique (panneau d'affichage A4 en liège) avec pièces jointes vérifiées, épinglage d'urgences et tracking de lecture.<br/>• Messagerie instantanée sécurisée avec canaux de classe et modération administrative.<br/>• Carillon de notification Web Audio API in-app et alertes d'urgence.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Ressources Humaines & Documents</b>", styles['TableCellBold']),
            Paragraph("<code>SectionRH</code><br/><code>SectionMonProfilRH</code><br/><code>SectionParentDocuments</code><br/><code>SectionStudentDocuments</code>", styles['TableCell']),
            Paragraph("• Dossier administratif du personnel, suivi des avancements d'échelon.<br/>• Gestion numérique des congés et autorisations d'absence avec solde en direct.<br/>• Émission d'ordres de mission officiels avec cachet et QR code de sécurité.<br/>• Génération de certificats de scolarité et cartes scolaires certifiées.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Statistiques Officielles & Direction</b>", styles['TableCellBold']),
            Paragraph("<code>SectionStatistics</code><br/><code>SectionMinesecStatistics</code><br/><code>SectionMinedubStatistics</code><br/><code>SectionAdminAI</code>", styles['TableCell']),
            Paragraph("• Génération automatisée des 7 tableaux de la déclaration statistique MINESEC.<br/>• Synthèses statistiques MINEDUB pour les écoles primaires.<br/>• Tableaux de bord de pilotage stratégique de l'établissement (Recharts).<br/>• Tableau de bord consolidé pour les réseaux et groupes scolaires.", styles['TableCell'])
        ],
    ]
    mods_table = Table(mods_data, colWidths=[110, 145, 263])
    mods_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_HEADER),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(mods_table)

    # ─────────────────────────────────────────────────────────────────────────────
    # PAGE 5 : MODULES TRANSVERSES
    # ─────────────────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("7. Les Modules Transverses & Socle Technologique", styles['SecHeading']))

    story.append(Paragraph("7.1. Les 19 Modèles Réglementaires MINESEC / MINEDUB", styles['SubSecHeading']))
    story.append(Paragraph(
        "ZekoulABia intègre en dur 19 configurations complètes (<code>schoolTemplateConfig.ts</code>) éliminant tout paramétrage fastidieux à la rentrée :",
        styles['CustomBody']
    ))
    tpl_data = [
        [Paragraph("Sous-Système Éducatif", styles['TableHeader']), Paragraph("Codes Templates Officiels Actifs", styles['TableHeader']), Paragraph("Spécificités Pédagogiques", styles['TableHeader'])],
        [
            Paragraph("<b>Secondaire Général Francophone</b>", styles['TableCellBold']),
            Paragraph("<code>LYCEE_FR</code>, <code>CES_FR</code>, <code>PRIVE_FR</code>", styles['TableCell']),
            Paragraph("Cycles d'observation (6e-5e), d'orientation (4e-3e avec LV2 obligatoire), second cycle séries A, C, D, TI. Grilles officielles de coefficients du Baccalauréat.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Secondaire Général Anglophone</b>", styles['TableCellBold']),
            Paragraph("<code>GHS_EN</code>, <code>GSS_EN</code>, <code>PRIVE_EN</code>", styles['TableCell']),
            Paragraph("Structure GCE O-Level (Forms 1 à 5) et A-Level (Lower/Upper Sixth) avec filières Arts et Sciences. Volumes horaires conformes à l'Anglophone Subject Load.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Établissements Bilingues & Spéciaux</b>", styles['TableCellBold']),
            Paragraph("<code>LYCEE_BILINGUE</code>", styles['TableCell']),
            Paragraph("Cohabitation des deux sections avec administration unifiée et programme spécial d'immersion bilingue (PEBS).", styles['TableCell'])
        ],
        [
            Paragraph("<b>Enseignement Technique & Pro</b>", styles['TableCellBold']),
            Paragraph("<code>LYCEE_TECHNIQUE_FR</code>, <code>CETIC</code>, <code>GTC_GTHS_EN</code>, <code>GTC_EN</code>, <code>SAR_SM</code>, <code>CFM</code>", styles['TableCell']),
            Paragraph("Gestion des filières industrielles (F1, F2, F3, F4, MEB...) et tertiaires (STT, ESF). Gestion des ateliers, matières pratiques et conventions de stage.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Enseignement Primaire & Maternelle</b>", styles['TableCellBold']),
            Paragraph("<code>PRIMAIRE_FR</code>, <code>MATERNELLE_FR</code>, <code>PRIMARY_EN</code>, <code>NURSERY_EN</code>, <code>PRIMARY_BILINGUAL</code>, <code>COMPLEXE_SCOLAIRE</code>", styles['TableCell']),
            Paragraph("Système par Unités d'Apprentissage (UA1 à UA8) conforme à l'Approche Par Compétences (APC) et livrets d'évaluation primaire.", styles['TableCell'])
        ],
    ]
    tpl_table = Table(tpl_data, colWidths=[130, 160, 228])
    tpl_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_HEADER),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(tpl_table)
    story.append(Spacer(1, 5))

    story.append(Paragraph("7.2. Offline-First : Registre de Risques et Fonctionnement Réel", styles['SubSecHeading']))
    story.append(Paragraph(
        "L'application ne bloque jamais l'utilisateur face à un réseau défaillant. "
        "Le registre <code>actionRegistry.ts</code> sépare rigoureusement les opérations :",
        styles['CustomBody']
    ))
    story.append(Paragraph("• <b>Opérations autorisées hors ligne (Risque MOYEN) :</b> Enregistrées dans Dexie.js (IndexedDB) avec clé d'idempotence UUID v4. Elles s'exécutent localement puis se synchronisent automatiquement sans doublon : <i>appel des présences (ATTENDANCE), brouillons de notes (GRADE_DRAFT_SAVE), cahier de texte (CAHIER_DE_TEXTE_CREATE), appréciations PP (APPRECIATION_PP), sanctions courantes (DISCIPLINE_SANCTION), messagerie optimiste (MESSAGE_SEND), encaissement cash au guichet (FEE_PAYMENT_CASH), gestion des livres de bibliothèque.</i>", styles['BulletText']))
    story.append(Paragraph("• <b>Opérations protégées exigeant le réseau (Risque FORT) :</b> Refusées avec message d'explication explicite (<code>OfflineActionRefusedError</code>) car leur intégrité ne tolère aucune divergence : <i>verrouillage officiel de notes (GRADE), validation/activation définitive d'inscriptions (ENROLLMENT_VALIDATE), publication d'examens (EXAM_PUBLISH), transactions financières APEE lourdes et paiements Mobile Money.</i>", styles['BulletText']))

    story.append(Spacer(1, 4))
    story.append(Paragraph("7.3. Matrice de Routage des Notifications et Règles d'Urgence", styles['SubSecHeading']))
    story.append(Paragraph(
        "La politique <code>NotificationRoutingPolicy.ts</code> arbitre les canaux (Push, SMS, In-App, Email) selon 4 niveaux d'urgence :",
        styles['CustomBody']
    ))
    story.append(Paragraph("• <b>Niveau LOW :</b> Distribution discrète dans l'application uniquement (<code>IN_APP</code>).", styles['BulletText']))
    story.append(Paragraph("• <b>Niveaux NORMAL & HIGH :</b> Envoi en notification Push web + In-App, sous réserve du consentement et des préférences de l'utilisateur.", styles['BulletText']))
    story.append(Paragraph("• <b>Niveau URGENT (Absence critique, sécurité, discipline grave) :</b> <b>Outrepasse les préférences de l'utilisateur.</b> Si le token Push n'est pas actif sur l'appareil du parent, un <b>SMS direct</b> est immédiatement expédié sur son téléphone mobile.", styles['BulletText']))

    story.append(Spacer(1, 4))
    story.append(Paragraph("7.4. Sécurité, Double Authentification (MFA) & Sauvegardes", styles['SubSecHeading']))
    story.append(Paragraph("• <b>MFA TOTP Obligatoire :</b> Tout compte <code>ADMIN</code>, <code>STAFF</code> et <code>TEACHER</code> a l'obligation stricte d'activer la double authentification par application d'authentification (Google/Microsoft Authenticator) dès sa première connexion, avec codes de secours. Elle est impossible à désactiver.", styles['BulletText']))
    story.append(Paragraph("• <b>Sauvegardes automatisées étanches :</b> Le service <code>SchoolBackupService.ts</code> génère des snapshots JSON complets de chaque école (utilisateurs, notes, finances, cours, historique) avec rétention glissante de 30 jours et déclenchement programmable ou manuel.", styles['BulletText']))

    story.append(Spacer(1, 4))
    story.append(Paragraph("7.5. Cas d'Usage Réels de l'Intelligence Artificielle (Groq LLM)", styles['SubSecHeading']))
    story.append(Paragraph("• <b>Copilot d'administration exécutant :</b> Assistant conversationnel doté d'un catalogue de 14 actions réelles (ouverture de sessions de concours, création de classes, affectations), protégé par RBAC et doté d'un journal d'annulation (<code>undo</code>).", styles['BulletText']))
    story.append(Paragraph("• <b>Vision Scan & Détection d'anomalies :</b> Numérisation OCR intelligente de listes manuscrites de candidats (concours 6e / PEBS) et détection automatique des incohérences de notes ou de barème.", styles['BulletText']))
    story.append(Paragraph("• <b>Indice de santé scolaire & Décrochage :</b> Analyse prédictive croisant notes, retards et incidents pour alerter les équipes pédagogiques avant l'échec.", styles['BulletText']))
    story.append(Paragraph("• <b>RH :</b> Analyse et extraction automatisée des mentions de diplômes lors des recrutements de professeurs.", styles['BulletText']))

    # ─────────────────────────────────────────────────────────────────────────────
    # PAGE 6 : COMPARATIF & JOURNÉE TYPE
    # ─────────────────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("8. ZekoulABia face aux Alternatives du Marché", styles['SecHeading']))

    comp_data = [
        [Paragraph("Critères d'évaluation", styles['TableHeader']), Paragraph("Cahiers, Excel, WhatsApp", styles['TableHeader']), Paragraph("Logiciels génériques / étrangers", styles['TableHeader']), Paragraph("Plateforme ZekoulABia", styles['TableHeader'])],
        [
            Paragraph("<b>Conformité MINESEC / MINEDUB</b>", styles['TableCellBold']),
            Paragraph("Calculs manuels, formules Excel erronées, révision annuelle lourde.", styles['TableCell']),
            Paragraph("Inadaptés : ignorent les séries, les coefficients et les découpages du Cameroun.", styles['TableCell']),
            Paragraph("<b>Native & intégrale</b> : 19 templates prédéfinis, arrêtés ministériels respectés à 100%.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Continuité sans réseau (Offline)</b>", styles['TableCellBold']),
            Paragraph("Possible sur papier mais données dispersées sans synchronisation.", styles['TableCell']),
            Paragraph("Blocage immédiat dès que la connexion internet est coupée.", styles['TableCell']),
            Paragraph("<b>Offline-First natif</b> : appel et notes saisis hors-ligne, synchronisés sans doublon.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Conception d'emploi du temps</b>", styles['TableCellBold']),
            Paragraph("Semaines de casse-tête, conflits de profs et de salles constants.", styles['TableCell']),
            Paragraph("Modules rigides ignorant les contraintes locales (samedi midi, LV2...).", styles['TableCell']),
            Paragraph("<b>Solveur CP-SAT automatique</b> : simulation what-if, génération multi-classes en minutes.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Encaissement des frais scolaires</b>", styles['TableCellBold']),
            Paragraph("Espèces à la caisse, fraudes, retards et cahiers de quittances perdus.", styles['TableCell']),
            Paragraph("Passerelles CB inadaptées aux familles non bancarisées.", styles['TableCell']),
            Paragraph("<b>Mobile Money direct</b> (MTN MoMo, Orange Money) avec reçu numérique immédiat.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Bulletins et documents certifiés</b>", styles['TableCellBold']),
            Paragraph("Impression Word artisanale, falsification de notes aisée.", styles['TableCell']),
            Paragraph("Bulletins standardisés non conformes aux formats régionaux.", styles['TableCell']),
            Paragraph("<b>6 formats MINESEC officiels</b>, calculs infalsifiables et QR code d'authenticité.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Sécurité & Sauvegardes</b>", styles['TableCellBold']),
            Paragraph("Zéro sauvegarde : un disque dur grillé détruit l'année scolaire.", styles['TableCell']),
            Paragraph("Sauvegardes centralisées opaques sans isolation claire.", styles['TableCell']),
            Paragraph("<b>MFA obligatoire</b>, isolation étanche par école et instantanés quotidiens restaurables.", styles['TableCell'])
        ],
    ]
    comp_table = Table(comp_data, colWidths=[110, 125, 135, 148])
    comp_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_HEADER),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(comp_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("9. Une Journée Typique avec ZekoulABia", styles['SecHeading']))
    story.append(Paragraph("<b>07h30 — Le Professeur :</b> Arrivé en classe, il ouvre ZekoulABia sur son téléphone, effectue l'appel en 30 secondes et renseigne le titre du chapitre au cahier de texte. La connexion internet est coupée dans le quartier : tout s'enregistre localement sur son appareil sans le moindre ralentissement.", styles['CustomBody']))
    story.append(Paragraph("<b>09h45 — Le Censeur :</b> Un enseignant notifie une indisponibilité imprévue. Depuis son bureau, le Censeur simule un réajustement d'emploi du temps via le solveur automatique CP-SAT et applique la solution en deux clics : élèves et collègues sont instantanément informés sur leur planning.", styles['CustomBody']))
    story.append(Paragraph("<b>11h15 — La Secrétaire :</b> Elle finalise l'inscription directe d'un élève transféré, valide le dossier en un clic, et imprime immédiatement son certificat de scolarité officiel horodaté avec QR code de sécurité.", styles['CustomBody']))
    story.append(Paragraph("<b>14h30 — Le Parent d'Élève :</b> Alerté par SMS d'un devoir important et d'une facture de scolarité à échéance, il ouvre l'application, consulte les notes récentes et règle la tranche restante en un instant par Orange Money depuis son salon.", styles['CustomBody']))
    story.append(Paragraph("<b>Fin de Trimestre — Le Proviseur :</b> Toutes les notes ont suivi le circuit de validation hiérarchique. Les bulletins PDF bilingues sont générés automatiquement par lots sans la moindre erreur manuelle. Le Proviseur consulte sur son tableau de bord les taux de réussite par classe et télécharge les déclarations officielles pour l'Inspection.", styles['CustomBody']))

    # ─────────────────────────────────────────────────────────────────────────────
    # PAGE 7 : ARGUMENTS COMMERCIAUX & CONCLUSION STRATÉGIQUE
    # ─────────────────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("10. Les 10 Arguments Majeurs pour la Présentation Commerciale", styles['SecHeading']))
    story.append(Paragraph(
        "Arguments percutants et différenciateurs à destination des promoteurs d'établissements privés, chefs d'établissements publics et délégations régionales :",
        styles['CustomBody']
    ))
    story.append(Spacer(1, 4))

    pitch_points = [
        ("1. Conformité totale MINESEC & MINEDUB :", "19 modèles prédéfinis intégrant nativement les coefficients officiels, filières et bulletins réglementaires camerounais."),
        ("2. Double sous-système bilingue natif :", "Prise en charge fluide du sous-système francophone, anglophone, technique et des sections bilingues d'excellence (PEBS)."),
        ("3. Générateur d'emplois du temps par IA :", "Solveur sous contraintes CP-SAT résolvant automatiquement les conflits de salles, de profs et de créneaux LV2 en quelques secondes."),
        ("4. Encaissement Mobile Money direct :", "Rapprochement instantané MTN MoMo et Orange Money avec génération de quittances numériques sécurisées et mise à jour des soldes."),
        ("5. Continuité Offline-First garantie :", "Appel, saisie de notes et cahier de texte pleinement opérationnels en classe même lors des coupures de réseau ou de délestages."),
        ("6. Alertes SMS directes aux parents :", "Notification immédiate et forcée sur le téléphone mobile des familles dès qu'une absence ou un retard critique est constaté."),
        ("7. Bulletins et documents infalsifiables :", "Calculs déterministes sans risque d'erreur humaine et sécurisation des pièces administratives par QR code officiel vérifiable."),
        ("8. Sécurité et protection des données :", "Double authentification obligatoire (MFA/TOTP), traçabilité d'audit intégrale et sauvegardes quotidiennes cloisonnées par école."),
        ("9. Vie scolaire unifiée :", "Babillard officiel anti-rumeurs, messagerie interne modérée, carnet de santé et suivi APEE réunis dans une seule application."),
        ("10. Copilot administratif intelligent :", "Assistant IA capable d'exécuter des requêtes de gestion en langage naturel et d'anticiper le décrochage scolaire avant la fin du trimestre.")
    ]
    for title, desc in pitch_points:
        story.append(Paragraph(f"• <b>{title}</b> {desc}", styles['BulletText']))

    story.append(Spacer(1, 14))
    story.append(Paragraph("11. Notre Engagement : Moins de paperasse, plus d'éducation", styles['SecHeading']))

    c_text = Paragraph(
        "<b>La promesse ZekoulABia :</b><br/>"
        "<i>« ZekoulABia n'est pas un simple logiciel de saisie. C'est le moteur opérationnel de l'école moderne camerounaise. "
        "En éliminant les tâches administratives répétitives, les calculs manuels fastidieux et les incertitudes de trésorerie, "
        "nous redonnons aux éducateurs leur ressource la plus précieuse : le temps d'enseigner, d'écouter et de faire grandir la jeunesse. »</i>",
        styles['CalloutText']
    )
    c_table = Table([[c_text]], colWidths=[518])
    c_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), ACCENT_BG),
        ('BOX', (0,0), (-1,-1), 1, SECONDARY),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(c_table)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF généré avec succès : {PDF_PATH}")

if __name__ == "__main__":
    build_pdf()
