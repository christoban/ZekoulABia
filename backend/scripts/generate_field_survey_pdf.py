import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.pdfgen import canvase

PDF_PATH = "/home/ndzanachristophe/Téléchargements/ZekoulABia - Guide des Enquetes Terrain (Formelles et Informelles).pdf"

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
            self.drawString(38, 808, "ZekoulABia — Guide Opérationnel des Enquêtes de Terrain")
            self.drawRightString(A4[0] - 38, 808, "Enquêtes Formelles & Informelles · Cameroun 2026")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(38, 801, A4[0] - 38, 801)

        # Footer (All pages)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(38, 38, A4[0] - 38, 38)
        self.drawString(38, 26, "Document de travail terrain · Équipe Produit & Recherche ZekoulABia")
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
    ACCENT_WARM = colors.HexColor("#D97706") # Ambre pour alertes terrain
    TEXT_COLOR = colors.HexColor("#1E293B")  # Gris ardoise foncé
    MUTED = colors.HexColor("#64748B")       # Gris neutre
    BG_LIGHT = colors.HexColor("#F8FAFC")    # Fond très clair
    BG_HEADER = colors.HexColor("#0F2942")
    ACCENT_BG = colors.HexColor("#ECFDF5")   # Vert pastel
    WARM_BG = colors.HexColor("#FFFBEB")     # Ambre pastel
    BORDER_COLOR = colors.HexColor("#CBD5E1")

    styles.add(ParagraphStyle(
        name='DocTitle',
        fontName='Helvetica-Bold',
        fontSize=23,
        leading=28,
        textColor=PRIMARY,
        spaceAfter=5
    ))
    styles.add(ParagraphStyle(
        name='DocSubtitle',
        fontName='Helvetica',
        fontSize=11,
        leading=14.5,
        textColor=SECONDARY,
        spaceAfter=10
    ))
    styles.add(ParagraphStyle(
        name='MetaNotice',
        fontName='Helvetica-Oblique',
        fontSize=8.3,
        leading=11.5,
        textColor=MUTED,
        spaceAfter=10
    ))
    styles.add(ParagraphStyle(
        name='SecHeading',
        fontName='Helvetica-Bold',
        fontSize=12.5,
        leading=16,
        textColor=PRIMARY,
        spaceBefore=11,
        spaceAfter=6,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        name='SubSecHeading',
        fontName='Helvetica-Bold',
        fontSize=9.8,
        leading=13,
        textColor=SECONDARY,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        name='CustomBody',
        fontName='Helvetica',
        fontSize=8.3,
        leading=11.5,
        textColor=TEXT_COLOR,
        spaceAfter=4.5
    ))
    styles.add(ParagraphStyle(
        name='BulletText',
        fontName='Helvetica',
        fontSize=8,
        leading=11.2,
        textColor=TEXT_COLOR,
        leftIndent=9,
        spaceAfter=3
    ))
    styles.add(ParagraphStyle(
        name='TableHeader',
        fontName='Helvetica-Bold',
        fontSize=7.6,
        leading=9.8,
        textColor=colors.white,
        alignment=0
    ))
    styles.add(ParagraphStyle(
        name='TableCell',
        fontName='Helvetica',
        fontSize=7.4,
        leading=9.8,
        textColor=TEXT_COLOR
    ))
    styles.add(ParagraphStyle(
        name='TableCellBold',
        fontName='Helvetica-Bold',
        fontSize=7.4,
        leading=9.8,
        textColor=PRIMARY
    ))
    styles.add(ParagraphStyle(
        name='CalloutText',
        fontName='Helvetica',
        fontSize=8.2,
        leading=11.5,
        textColor=colors.HexColor("#065F46")
    ))
    styles.add(ParagraphStyle(
        name='WarningText',
        fontName='Helvetica',
        fontSize=8.2,
        leading=11.5,
        textColor=colors.HexColor("#92400E")
    ))

    story = []

    # ─────────────────────────────────────────────────────────────────────────────
    # PAGE 1 : CADRE STRATÉGIQUE & MÉTHODOLOGIE FORMEL VS INFORMEL
    # ─────────────────────────────────────────────────────────────────────────────
    story.append(Paragraph("ZekoulABia", styles['DocTitle']))
    story.append(Paragraph("Guide Opérationnel des Enquêtes de Terrain — Formelles et Informelles", styles['DocSubtitle']))
    story.append(Paragraph("Protocole d'investigation, collecte de données réelles et guide d'entretiens pour la validation terrain<br/><b>Contexte éducatif camerounais (MINESEC / MINEDUB) · Octobre 2026</b>", styles['MetaNotice']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=SECONDARY, spaceBefore=0, spaceAfter=8))

    story.append(Paragraph("1. La Méthode : Pourquoi dissocier Formel et Informel ?", styles['SecHeading']))
    story.append(Paragraph(
        "Au Cameroun, la gestion scolaire vit un double régime permanent : ce que prescrivent les circulaires ministérielles et "
        "ce que déclarent officiellement les chefs d'établissement (le <b>formel</b>) diffère régulièrement de la pratique concrète, "
        "des arrangements non écrits et des bricolages quotidiens imposés par les contraintes matérielles (l'<b>informel</b>). "
        "Concevoir ZekoulABia uniquement sur la base des textes ministériels mènerait à un logiciel théorique inutilisable. "
        "À l'inverse, ignorer le cadre formel bloquerait l'adoption institutionnelle.",
        styles['CustomBody']
    ))

    meth_data = [
        [Paragraph("Dimension", styles['TableHeader']), Paragraph("Cible Principale", styles['TableHeader']), Paragraph("Objectif & Démarche", styles['TableHeader']), Paragraph("Données Concrètes à Extraire", styles['TableHeader'])],
        [
            Paragraph("<b>Enquête Formelle</b><br/><i>(La Norme déclarée)</i>", styles['TableCellBold']),
            Paragraph("Proviseurs, Censeurs, Intendants, Délégués MINESEC.", styles['TableCell']),
            Paragraph("Entretiens assis (20-30 min), validation des procédures légales, règlements intérieurs et signatures obligatoires.", styles['TableCell']),
            Paragraph("Grilles de coefficients officielles, modèles de bulletins validés par l'Inspection, formulaires statistiques, seuils d'exclusion.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Enquête Informelle</b><br/><i>(La Réalité vécue)</i>", styles['TableCellBold']),
            Paragraph("Élèves dans la cour, vacataires, chefs de classe, parents au guichet.", styles['TableCell']),
            Paragraph("Discussions directes, observation in situ, récupération d'échantillons papier réels et calepins d'appel.", styles['TableCell']),
            Paragraph("Vrais emplois du temps gribouillés, arrangements d'horaires entre profs, retards tolérés, fausses déclarations, pannes réseau.", styles['TableCell'])
        ],
    ]
    meth_table = Table(meth_data, colWidths=[95, 115, 145, 163])
    meth_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_HEADER),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(meth_table)
    story.append(Spacer(1, 6))

    v_text = Paragraph("<b>Règle d'or de l'enquêteur :</b> <i>« Ne demandez jamais seulement comment les choses doivent se faire, demandez toujours ce qui s'est passé la dernière fois que la règle n'a pas pu être appliquée. C'est dans cette brèche que vit la véritable valeur de notre logiciel. »</i>", styles['CalloutText'])
    v_table = Table([[v_text]], colWidths=[518])
    v_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), ACCENT_BG),
        ('BOX', (0,0), (-1,-1), 1, SECONDARY),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(v_table)

    story.append(Paragraph("2. Synthèse des Modules Nécessitant des Investigations Terrain", styles['SecHeading']))
    story.append(Paragraph(
        "Sept fonctionnalités majeures de ZekoulABia doivent impérativement être éprouvées par cette double démarche d'enquête :",
        styles['CustomBody']
    ))
    story.append(Paragraph("• <b>1. Emplois du temps (Solveur CP-SAT) :</b> Collecte de 10-15 EDT réels d'élèves + entretiens approfondis de 5 censeurs.", styles['BulletText']))
    story.append(Paragraph("• <b>2. Notes & Bulletins :</b> Échantillonnage de 10 bulletins réels pour vérifier les matières éclatées et les mentions du conseil.", styles['BulletText']))
    story.append(Paragraph("• <b>3. Présences & Assiduité :</b> Identification de la personne qui fait réellement l'appel et test d'acceptabilité du SMS d'urgence.", styles['BulletText']))
    story.append(Paragraph("• <b>4. Frais scolaires & APEE :</b> Rapprochement Mobile Money vs espèces au guichet, calendrier des tranches et quittances.", styles['BulletText']))
    story.append(Paragraph("• <b>5. Concours 6e & Sélection PEBS :</b> Traitement des listes papier manuscrites et gestion des passerelles avant le CEP.", styles['BulletText']))
    story.append(Paragraph("• <b>6. Babillard & Canaux d'annonces :</b> Remplacement des groupes WhatsApp officieux et circulation des circulaires.", styles['BulletText']))
    story.append(Paragraph("• <b>7. Infrastructure & Offline-First :</b> Test du parc de téléphones des enseignants et couverture réseau dans les salles de classe.", styles['BulletText']))

    # ─────────────────────────────────────────────────────────────────────────────
    # PAGE 2 : MODULE 1 (EMPLOIS DU TEMPS) & MODULE 2 (NOTES ET BULLETINS)
    # ─────────────────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("3. Focus Approfondi : Emplois du Temps (Solveur CP-SAT)", styles['SecHeading']))
    story.append(Paragraph(
        "L'élaboration de l'emploi du temps est le casse-tête n°1 des établissements secondaires. "
        "Pour parfaire notre moteur sous contraintes (Google OR-Tools WASM), vous devez collecter des spécimens réels et interviewer les concepteurs :",
        styles['CustomBody']
    ))

    edt_data = [
        [Paragraph("Périmètre", styles['TableHeader']), Paragraph("Actions & Questions Clés sur le Terrain", styles['TableHeader']), Paragraph("Impact Direct sur le Code ZekoulABia", styles['TableHeader'])],
        [
            Paragraph("<b>Collecte Informelle</b><br/><i>(Élèves & Profs)</i>", styles['TableCellBold']),
            Paragraph(
                "• Photographier l'emploi du temps affiché dans le cahier d'au moins <b>10 à 15 élèves</b> issus de lycées publics, collèges privés et lycées techniques.<br/>"
                "• Observer : Le mercredi après-midi et le samedi matin ont-ils des cours ?<br/>"
                "• Repérer les créneaux d'EPS (Sport) : sont-ils uniquement placés à 07h30 pour éviter le soleil ?<br/>"
                "• Vérifier s'il y a des « heures de permanence » vides au milieu de la journée.",
                styles['TableCell']
            ),
            Paragraph(
                "Permet de calibrer les <i>contraintes douces</i> du solveur CP-SAT (poids de pénalité pour les créneaux libres isolés, distribution des blocs de 2h consécutifs pour les matières majeures).",
                styles['TableCell']
            )
        ],
        [
            Paragraph("<b>Entretiens Formels</b><br/><i>(5 Censeurs)</i>", styles['TableCellBold']),
            Paragraph(
                "1. <i>« Combien de temps passez-vous à concevoir l'EDT chaque année ? »</i><br/>"
                "2. <i>« Quelles sont les exigences des profs vacataires (qui enseignent dans 2 ou 3 établissements) ? »</i><br/>"
                "3. <i>« Comment gérez-vous physiquement les élèves de 4e/3e pendant l'heure de LV2 (Allemand/Espagnol) ? »</i><br/>"
                "4. <i>« Quelle est la procédure de rattrapage en cas d'absence d'un enseignant ? »</i>",
                styles['TableCell']
            ),
            Paragraph(
                "Validation du modèle d'affectation <code>isLV2Slot</code> et confirmation du workflow de validation des demandes de rattrapage d'heures (<code>MANAGE_CATCHUP_REQUESTS</code>).",
                styles['TableCell']
            )
        ],
    ]
    edt_table = Table(edt_data, colWidths=[90, 255, 173])
    edt_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_HEADER),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(edt_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("4. Focus Approfondi : Notes, Coefficients & Bulletins", styles['SecHeading']))
    story.append(Paragraph(
        "Les bulletins scolaires conditionnent la crédibilité de ZekoulABia auprès des parents et de l'Inspection. "
        "Les règles appliquées sur le terrain présentent souvent des variations avec les arrêtés théoriques :",
        styles['CustomBody']
    ))

    notes_data = [
        [Paragraph("Périmètre", styles['TableHeader']), Paragraph("Vérifications à Effectuer sur le Terrain", styles['TableHeader']), Paragraph("Impact Direct sur le Code ZekoulABia", styles['TableHeader'])],
        [
            Paragraph("<b>Collecte de Bulletins</b><br/><i>(10 spécimens)</i>", styles['TableCellBold']),
            Paragraph(
                "• Récupérer 10 vrais bulletins du 1er trimestre récents.<br/>"
                "• Observer le Français : est-il éclaté en sous-matières (Dictée, Étude de texte, Rédaction) avec sous-notes, ou une note unique est-elle saisie ?<br/>"
                "• Comment sont formulés les rangs ex-æquo (<i>1er ex, 2e ex...</i>) ?<br/>"
                "• Quelles sont les mentions exactes du conseil de classe tamponnées ?",
                styles['TableCell']
            ),
            Paragraph(
                "Ajustement du moteur de rendu PDFKit (<code>PdfKitBulletinService.ts</code>) et des gabarits <code>FR_SECONDARY</code> et <code>EN_SECONDARY</code> pour garantir une conformité visuelle parfaite.",
                styles['TableCell']
            )
        ],
        [
            Paragraph("<b>Entretien Censeur & Profs</b>", styles['TableCellBold']),
            Paragraph(
                "1. <i>« Comment traitez-vous un élève absent à une composition : note 00/20, mention 'Abs', ou neutralisation de la matière ? »</i><br/>"
                "2. <i>« Quelle est la note de conduite moyenne ? Est-elle chiffrée sur 20 ou sous forme d'appréciation littérale ? »</i><br/>"
                "3. <i>« Combien d'erreurs matérielles de calcul de moyenne découvrez-vous après remise aux parents ? »</i>",
                styles['TableCell']
            ),
            Paragraph(
                "Sécurisation des algorithmes de calcul de moyennes générales et de l'attribution des statuts de validation (DRAFT → LOCKED).",
                styles['TableCell']
            )
        ],
    ]
    notes_table = Table(notes_data, colWidths=[90, 255, 173])
    notes_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_HEADER),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(notes_table)

    # ─────────────────────────────────────────────────────────────────────────────
    # PAGE 3 : MODULE 3 (PRÉSENCES), MODULE 4 (FINANCES) & MODULE 5 (ADMISSIONS)
    # ─────────────────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("5. Focus Approfondi : Présences, Retards & Assiduité", styles['SecHeading']))

    att_data = [
        [Paragraph("Volet", styles['TableHeader']), Paragraph("Constats & Questions Terrain", styles['TableHeader']), Paragraph("Objectif ZekoulABia", styles['TableHeader'])],
        [
            Paragraph("<b>Informel</b><br/><i>(Dans la cour & en classe)</i>", styles['TableCellBold']),
            Paragraph(
                "• Observer qui prend les présences : est-ce le professeur qui fait l'appel, le chef de classe qui note sur un bout de papier, ou le surveillant qui passe de classe en classe avec le registre cartonné ?<br/>"
                "• À quel moment les élèves retardataires sont-ils bloqués au portail ?",
                styles['TableCell']
            ),
            Paragraph(
                "Adapter l'UI du module <code>SectionTeacherAttendance</code> pour permettre une saisie rapide en 30 secondes chrono, ou déléguer au surveillant de secteur.",
                styles['TableCell']
            )
        ],
        [
            Paragraph("<b>Formel</b><br/><i>(Surveillant Général)</i>", styles['TableCellBold']),
            Paragraph(
                "1. <i>« À partir de combien d'heures d'absences injustifiées l'élève est-il traduit en conseil de discipline ? »</i><br/>"
                "2. <i>« Comment prévenez-vous les parents aujourd'hui : convocation par l'élève, appel téléphonique ou attente du bulletin ? »</i>",
                styles['TableCell']
            ),
            Paragraph(
                "Calibrer les seuils d'alerte automatique par SMS (matrice <code>NotificationRoutingPolicy</code> niveau URGENT).",
                styles['TableCell']
            )
        ],
    ]
    att_table = Table(att_data, colWidths=[90, 255, 173])
    att_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_HEADER),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(att_table)
    story.append(Spacer(1, 6))

    story.append(Paragraph("6. Focus Approfondi : Frais de Scolarité, Mobile Money & APEE", styles['SecHeading']))

    fin_data = [
        [Paragraph("Volet", styles['TableHeader']), Paragraph("Constats & Questions Terrain", styles['TableHeader']), Paragraph("Objectif ZekoulABia", styles['TableHeader'])],
        [
            Paragraph("<b>Informel</b><br/><i>(Parents & Guichets)</i>", styles['TableCellBold']),
            Paragraph(
                "• Combien d'heures un parent attend-il à la banque ou au secrétariat pour payer ?<br/>"
                "• Les parents ont-ils peur de payer par Mobile Money sans un reçu portant un tampon physique humide ?<br/>"
                "• Quel est le nombre réel de tranches de versement pratiqué par les familles en difficulté ?",
                styles['TableCell']
            ),
            Paragraph(
                "Concevoir le reçu de paiement dématérialisé avec QR code de vérification imprimable, rassurant immédiatement le parent.",
                styles['TableCell']
            )
        ],
        [
            Paragraph("<b>Formel</b><br/><i>(Intendant & Économe)</i>", styles['TableCellBold']),
            Paragraph(
                "1. <i>« Quelle est la frontière financière exacte entre les frais de scolarité obligatoires et les cotisations APEE ? »</i><br/>"
                "2. <i>« Quels sont les risques liés aux fausses quittances et aux détournements de fonds au guichet ? »</i>",
                styles['TableCell']
            ),
            Paragraph(
                "Valider le cloisonnement des comptes de trésorerie APEE (<code>SectionAPEEStaff</code>) et la sécurisation des encaissements d'espèces.",
                styles['TableCell']
            )
        ],
    ]
    fin_table = Table(fin_data, colWidths=[90, 255, 173])
    fin_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_HEADER),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(fin_table)
    story.append(Spacer(1, 6))

    story.append(Paragraph("7. Focus Approfondi : Concours d'Entrée en 6e & Sélection PEBS", styles['SecHeading']))

    adm_data = [
        [Paragraph("Volet", styles['TableHeader']), Paragraph("Constats & Questions Terrain", styles['TableHeader']), Paragraph("Objectif ZekoulABia", styles['TableHeader'])],
        [
            Paragraph("<b>Informel</b><br/><i>(Candidats & Listes)</i>", styles['TableCellBold']),
            Paragraph(
                "• Récupérer des photos des listes d'admission manuscrites ou imprimées affichées sur les panneaux de liège du lycée.<br/>"
                "• Observer comment les noms mal orthographiés créent des doublons au moment de l'inscription définitive.",
                styles['TableCell']
            ),
            Paragraph(
                "Améliorer les prompts de notre pipeline de scan OCR Vision IA (Groq LLM) et l'algorithme de détection floue des doublons.",
                styles['TableCell']
            )
        ],
        [
            Paragraph("<b>Formel</b><br/><i>(Commission d'Admission)</i>", styles['TableCellBold']),
            Paragraph(
                "1. <i>« Quel est le sort d'un élève admis au concours en 6e mais qui échoue au CEP quelques semaines plus tard ? »</i><br/>"
                "2. <i>« Quels sont les critères officiels d'admission dans les classes bilingues spéciales (PEBS) ? »</i>",
                styles['TableCell']
            ),
            Paragraph(
                "Sécuriser la transition conditionnelle (ADMIS_PROVISOIRE → INSCRIT ou ANNULE sur échec CEP).",
                styles['TableCell']
            )
        ],
    ]
    adm_table = Table(adm_data, colWidths=[90, 255, 173])
    adm_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_HEADER),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(adm_table)

    # ─────────────────────────────────────────────────────────────────────────────
    # PAGE 4 : INFRASTRUCTURE OFFLINE-FIRST, CHECK-LIST DU MATÉRIEL & QUESTIONNAIRE
    # ─────────────────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("8. Infrastructure Technique, Équipement & Offline-First", styles['SecHeading']))
    story.append(Paragraph(
        "La viabilité technique de ZekoulABia dépend directement de la réalité matérielle dans les établissements :",
        styles['CustomBody']
    ))

    w_text = Paragraph(
        "<b>Points de vigilance technique à observer sur le terrain :</b><br/>"
        "• <b>Smartphones des professeurs :</b> Beaucoup d'enseignants utilisent des téléphones Android d'entrée de gamme (16 ou 32 Go de mémoire, versions Android 10 à 12). L'application doit être extrêmement légère et ne pas saturer le stockage local.<br/>"
        "• <b>Connectivité réseau en salle de classe :</b> Les bâtiments scolaires camerounais ont souvent des murs en parpaings épais et des toitures en tôle qui bloquent les ondes cellulaires (4G indisponible au fond des salles). Le mode Offline-First (Dexie.js) n'est pas une option, c'est une nécessité vitale.<br/>"
        "• <b>Délestages électriques :</b> Combien d'heures par semaine l'établissement est-il privé d'électricité ? L'administration dispose-t-elle d'un groupe électrogène ou d'un onduleur pour faire tourner les ordinateurs du secrétariat ?",
        styles['WarningText']
    )
    w_table = Table([[w_text]], colWidths=[518])
    w_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), WARM_BG),
        ('BOX', (0,0), (-1,-1), 1, ACCENT_WARM),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(w_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("9. Check-list des Pièces Physiques à Collecter", styles['SecHeading']))
    story.append(Paragraph(
        "Votre dossier de preuves physiques doit impérativement contenir les éléments suivants au retour de mission :",
        styles['CustomBody']
    ))

    chk_data = [
        [Paragraph("Type de Document Réel", styles['TableHeader']), Paragraph("Quantité Minimale Ciblée", styles['TableHeader']), Paragraph("Objectif Métier dans ZekoulABia", styles['TableHeader'])],
        [
            Paragraph("<b>Emplois du temps réels d'élèves</b>", styles['TableCellBold']),
            Paragraph("10 à 15 spécimens (FR, EN, Tech)", styles['TableCell']),
            Paragraph("Étalonnage mathématique du solveur CP-SAT et benchmark de contraintes.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Emplois du temps d'enseignants</b>", styles['TableCellBold']),
            Paragraph("5 spécimens (vacataires et permanents)", styles['TableCell']),
            Paragraph("Analyse de la dispersion hebdomadaire et des plafonds d'heures réels.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Bulletins de notes de 1er trimestre</b>", styles['TableCellBold']),
            Paragraph("10 bulletins récents (différents lycées)", styles['TableCell']),
            Paragraph("Conformité visuelle et validation des formules de calcul de moyennes.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Grilles de coefficients officielles</b>", styles['TableCellBold']),
            Paragraph("3 grilles remises par les Censeurs", styles['TableCell']),
            Paragraph("Comparaison avec nos 19 configurations codées (<code>schoolTemplateConfig.ts</code>).", styles['TableCell'])
        ],
        [
            Paragraph("<b>Feuilles d'appel / Registres de présence</b>", styles['TableCellBold']),
            Paragraph("2 spécimens de fiches de surveillance", styles['TableCell']),
            Paragraph("Modélisation du circuit d'enregistrement des absences et des billets d'entrée.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Procès-verbaux de conseils de classe</b>", styles['TableCellBold']),
            Paragraph("2 spécimens de délibérations", styles['TableCell']),
            Paragraph("Structure des statistiques de classe et formulations des décisions du conseil.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Reçus de paiement de scolarité & APEE</b>", styles['TableCellBold']),
            Paragraph("3 quittances de paiement", styles['TableCell']),
            Paragraph("Format de quittance attendu et informations juridiques obligatoires.", styles['TableCell'])
        ],
        [
            Paragraph("<b>Fiche statistique officielle MINESEC</b>", styles['TableCellBold']),
            Paragraph("1 formulaire de déclaration régionale", styles['TableCell']),
            Paragraph("Validation de notre module d'export automatisé des 7 tableaux statistiques.", styles['TableCell'])
        ],
    ]
    chk_table = Table(chk_data, colWidths=[140, 130, 248])
    chk_table.setStyle(TableStyle([
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
    story.append(chk_table)

    # ─────────────────────────────────────────────────────────────────────────────
    # PAGE 5 : QUESTIONNAIRES PRÊTS À L'EMPLOI (CENSEUR & ÉLÈVE)
    # ─────────────────────────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("10. Guide d'Entretien Type : Rencontre avec un Censeur (30 min)", styles['SecHeading']))
    story.append(Paragraph(
        "Questionnaire direct à imprimer et emporter lors de vos rendez-vous avec les équipes de direction :",
        styles['CustomBody']
    ))

    q_censeur = [
        ("1. Conception de l'Emploi du temps :", "Combien de jours/semaines vous prend la réalisation des emplois du temps ? Utilisez-vous un tableau mural, Excel ou un logiciel ? Quelles sont les 3 contraintes qui font systématiquement échouer la première version ?"),
        ("2. Négociations avec les professeurs :", "Comment gérez-vous les enseignants qui partagent leur service entre votre établissement et un collège privé concurrent ? Quel est le compromis typique que vous devez accepter ?"),
        ("3. Gestion des spécialités et langues :", "Pendant les heures d'Allemand et d'Espagnol en 4e et 3e, les élèves changent-ils de salle ? Les groupes sont-ils de taille égale ou y a-t-il une classe surchargée ?"),
        ("4. Saisie et validation des notes :", "Les enseignants saisissent-ils les notes sur un ordinateur de l'école ou vous remettent-ils des bordereaux manuscrits ? Quel est le taux de retardataires à la fin de la 2e séquence ?"),
        ("5. Calcul des moyennes et bulletins :", "Avez-vous déjà constaté des erreurs de coefficient ou de calcul qui ont entraîné la réimpression de bulletins après distribution ? Combien vous coûte l'impression papier d'un trimestre ?"),
        ("6. Conseils de classe et délibérations :", "Comment se déroule la délibération pour un élève ayant 09.80/20 de moyenne ? Quels sont les critères retenus pour lui accorder les encouragements ou le tableau d'honneur ?"),
        ("7. Statistiques ministérielles :", "Combien de temps passez-vous à remplir les 7 fiches de la campagne statistique du MINESEC ? Avez-vous toutes les données sous la main ou devez-vous recompter les dossiers à la main ?")
    ]
    for title, q in q_censeur:
        story.append(Paragraph(f"• <b>{title}</b> {q}", styles['BulletText']))

    story.append(Spacer(1, 8))
    story.append(Paragraph("11. Guide d'Entretien Éclair : Rencontre avec un Élève / Délégué (5 min)", styles['SecHeading']))
    story.append(Paragraph(
        "Questions simples à poser de façon informelle à des élèves rencontrés devant l'établissement ou lors de la récréation :",
        styles['CustomBody']
    ))

    q_eleve = [
        ("Sur ton emploi du temps :", "Est-ce qu'il y a des heures dans la semaine où tu n'as pas cours en pleine journée (heures creuses) ? Combien d'heures de sport as-tu et quel jour ? Les profs arrivent-ils toujours à l'heure ?"),
        ("Sur les devoirs et le cahier de texte :", "Comment sais-tu ce que tu dois faire pour le lendemain ? Est-ce que le professeur remplit le cahier de texte posé sur la table du prof ?"),
        ("Sur les notes et les bulletins :", "Quand tu as une mauvaise note, tes parents le savent-ils tout de suite ou seulement quand tu ramènes le bulletin papier ? Est-ce que le bulletin est parfois remis avec plusieurs semaines de retard ?"),
        ("Sur les paiements et renvois :", "Est-ce qu'on renvoie souvent les élèves chez eux pour non-paiement des frais de scolarité ou de l'APEE ? Combien de fois par an et pendant combien de jours es-tu bloqué à la maison ?"),
        ("Sur la communication de l'école :", "Où vas-tu pour savoir si un professeur est absent ou s'il y a un événement ? Est-ce qu'il y a un groupe WhatsApp de ta classe avec les délégués ?")
    ]
    for title, q in q_eleve:
        story.append(Paragraph(f"• <b>{title}</b> {q}", styles['BulletText']))

    story.append(Spacer(1, 8))
    story.append(Paragraph("12. Exploitation Immédiate des Résultats dans le Code", styles['SecHeading']))
    story.append(Paragraph(
        "Chaque observation recueillie sera directement injectée dans le code source de ZekoulABia :",
        styles['CustomBody']
    ))
    story.append(Paragraph("1. <b>Les 10-15 emplois du temps réels</b> serviront de jeu de données de test (fixtures de test) pour calibrer notre solveur CP-SAT afin qu'il produise des résultats identiques ou supérieurs aux solutions manuelles des censeurs.", styles['BulletText']))
    story.append(Paragraph("2. <b>Les bulletins réels collectés</b> permettront d'ajuster le moteur PDFKit pour produire un document visuellement indiscutable aux yeux des inspecteurs pédagogiques régionaux.", styles['BulletText']))
    story.append(Paragraph("3. <b>Les retours des parents sur le Mobile Money</b> permettront d'optimiser le parcours de délivrance instantanée des quittances numériques.", styles['BulletText']))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF généré avec succès : {PDF_PATH}")

if __name__ == "__main__":
    build_pdf()
