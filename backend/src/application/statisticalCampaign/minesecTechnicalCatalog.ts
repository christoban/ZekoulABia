/**
 * Catalogue officiel des specialites techniques MINESEC (feuille Atelier_Workshop,
 * colonnes W:AB, legende complete). Utilise pour le formulaire complementaire ESTP
 * (Categorie C integrale pour cette phase -- voir decision actee : aucune correspondance
 * fiable entre les ~12 filieres internes ZekoulABia et ces 89 specialites officielles).
 */

export interface SpecialiteTechnique {
  acronyme: string;
  designationFr: string;
  designationEn: string | null;
}

export const SPECIALITES_TECHNIQUES_MINESEC: SpecialiteTechnique[] = [
  {
    "acronyme": "AAT",
    "designationFr": "ACCEUIL ET ANIMATION TOURISTIQUE",
    "designationEn": "HOME AND TOURIST ANIMATION"
  },
  {
    "acronyme": "ACA",
    "designationFr": "ACTION ET COMMUNICATION ADMINISTRATIVE",
    "designationEn": "ACTION AND ADMINISTRATIVE COMMUNICATION"
  },
  {
    "acronyme": "ACC",
    "designationFr": "ACTION ET COMMUNICATION COMMERCIALE",
    "designationEn": "ACTION AND COMMERCIAL COMMUNICATION"
  },
  {
    "acronyme": "AF1",
    "designationFr": "ARTISTIQUE OPTION CERAMIQUE",
    "designationEn": "ART WORK-CERAMICS OPTION"
  },
  {
    "acronyme": "AF2",
    "designationFr": "ARTISTIQUE OPTION PEINTURE",
    "designationEn": "ART WORK - FINE ARTS OPTION"
  },
  {
    "acronyme": "AF3",
    "designationFr": "ARTISTIQUE OPTION SCULPTURE",
    "designationEn": "ART WORK – SCULPTURE OPTION"
  },
  {
    "acronyme": "AFSCI",
    "designationFr": "AFFUTEUR SCIEUR",
    "designationEn": "SAW GRINDER"
  },
  {
    "acronyme": "AG-BI",
    "designationFr": "AGRICULTURE OPTION  PRODUCTION ANIMALE",
    "designationEn": "AGRICULTURE - ANIMAL PRODUCTION"
  },
  {
    "acronyme": "AG-PV",
    "designationFr": "AGRICULTURE OPTION PRODUCTION VEGETALE",
    "designationEn": "AGRICULTURE – PLANT PRODUCTION"
  },
  {
    "acronyme": "AG-TP",
    "designationFr": "AGRICULTURE OPTION TRANSFORMATION DES PRODUITS",
    "designationEn": "AGRICULTURE – TRANSFORMATION"
  },
  {
    "acronyme": "AICB",
    "designationFr": "AIDE CHIMIQUE BIOLOGISTE",
    "designationEn": "BIO-CHEMICAL INDUSTRY ASSISTANT"
  },
  {
    "acronyme": "AICI",
    "designationFr": "AIDE CHIMIQUE INDUSTRIELLE",
    "designationEn": "CHEMICAL INDUSTRY ASSISTANT"
  },
  {
    "acronyme": "AJUS",
    "designationFr": "AJUSTAGE",
    "designationEn": "BENCH WORK"
  },
  {
    "acronyme": "AV",
    "designationFr": "AGENCE DE VOYAGE",
    "designationEn": "TRAVEL AGENCY"
  },
  {
    "acronyme": "BIJO",
    "designationFr": "BIJOUTERIE",
    "designationEn": "JEWELERY"
  },
  {
    "acronyme": "BP CF",
    "designationFr": "BP COUTURE FLOU",
    "designationEn": "FUZZY SEWING BP"
  },
  {
    "acronyme": "BPA",
    "designationFr": "BOULANGERIE PATISSERIE",
    "designationEn": "BAKERY-PASTRY"
  },
  {
    "acronyme": "CAPA",
    "designationFr": "CARROSSERIE PEINTURE AUTOMOBILE",
    "designationEn": "AUTOMOBILE BODY WORK AND SPRAYING"
  },
  {
    "acronyme": "CARR",
    "designationFr": "CARRELAGE",
    "designationEn": "TILE LAYING"
  },
  {
    "acronyme": "CG",
    "designationFr": "COMPTABILITE DE GESTION",
    "designationEn": "ACCOUNTING AND MANAGEMENT"
  },
  {
    "acronyme": "CH",
    "designationFr": "CHAUDRONNERIE",
    "designationEn": "BOILERWORKS"
  },
  {
    "acronyme": "CHAR",
    "designationFr": "CHARPENTIER",
    "designationEn": "ROOF TECHNICIAN"
  },
  {
    "acronyme": "CI",
    "designationFr": "CHIMIE INDUSTRIELLE",
    "designationEn": "INDUSTRIAL CHEMISTRY"
  },
  {
    "acronyme": "CM",
    "designationFr": "CONSTRUCTION MECANIQUE",
    "designationEn": "METAL CONSTRUCTION"
  },
  {
    "acronyme": "COME",
    "designationFr": "COUTURE SUR MESURE",
    "designationEn": "BESPOKE TAILORING"
  },
  {
    "acronyme": "COOM",
    "designationFr": "CONSTRUCTION ET OUVRAGE METALLIQUE",
    "designationEn": "METALLIC FRAMEWORK CONSTRUCTION"
  },
  {
    "acronyme": "CU",
    "designationFr": "CUISINE",
    "designationEn": "COOKING"
  },
  {
    "acronyme": "DEBA",
    "designationFr": "DESSIN EN BATIMENT",
    "designationEn": "DRAFTSMANSHIP"
  },
  {
    "acronyme": "DECM",
    "designationFr": "DESSINATEUR EN CONSTRUCTION MECANIQUE",
    "designationEn": "MECHANICAL DESIGN"
  },
  {
    "acronyme": "DECOR",
    "designationFr": "DECORATION",
    "designationEn": "DECORATION"
  },
  {
    "acronyme": "E",
    "designationFr": "TECHNIQUE ET MATHEMATIQUE",
    "designationEn": "MATHEMATICS AND MECHANICS"
  },
  {
    "acronyme": "EF",
    "designationFr": "EXPLOITATION FORESTIERE",
    "designationEn": "FORESTRY EXPLOITATION"
  },
  {
    "acronyme": "ELAU",
    "designationFr": "ELECTRCITE AUTOMOBILE",
    "designationEn": "AUTO ELECTRICITY"
  },
  {
    "acronyme": "ELBA",
    "designationFr": "ELCTRICITE BATIMENT",
    "designationEn": "BUILDING ELECTRICITY"
  },
  {
    "acronyme": "ELEQ",
    "designationFr": "ELECTRICITE D'EQUIPEMENT",
    "designationEn": "ELECTRICAL INSTALLATION"
  },
  {
    "acronyme": "ELME",
    "designationFr": "ELECTRO MECANIQUE",
    "designationEn": "ELECTRO-MECHANICS"
  },
  {
    "acronyme": "ELNI",
    "designationFr": "ELECTRONIQUE",
    "designationEn": "ELECTRONICS"
  },
  {
    "acronyme": "ESCO",
    "designationFr": "ESTHETIQUE COIFFURE",
    "designationEn": "ESTHETICS AND HAIR DRESSING"
  },
  {
    "acronyme": "ESCOM",
    "designationFr": "EMPLOYE DES SERVICES COMPTABLES",
    "designationEn": "ACCOUNTING OFFICER"
  },
  {
    "acronyme": "ESF",
    "designationFr": "ECONOMIE SOCIALE ET FAMILIALE",
    "designationEn": "HOME ECONOMICS"
  },
  {
    "acronyme": "ESFI",
    "designationFr": "EMLOYE DES SERVICES FINANCIERS",
    "designationEn": "FINANCIAL SERVICE EMPLOYEE"
  },
  {
    "acronyme": "F1",
    "designationFr": "MECANIQUE DE FABRICATION",
    "designationEn": "MANUFACTURING MECHANICS"
  },
  {
    "acronyme": "F2",
    "designationFr": "ELECTRONIQUE",
    "designationEn": "ELECTRONICS"
  },
  {
    "acronyme": "F3",
    "designationFr": "ELECTROTECHNIQUE",
    "designationEn": "ELECTRICAL TECHNOLOGY"
  },
  {
    "acronyme": "F4BA",
    "designationFr": "GENIE CIVIL BATIMENT",
    "designationEn": "CIVIL ENGINEERING- BUILDING CONSTRUCTION"
  },
  {
    "acronyme": "F4BE",
    "designationFr": "BUREAU D'ETUDES",
    "designationEn": "CIVIL ENGINEERING - DRAFTSMANSHIP"
  },
  {
    "acronyme": "F4TP",
    "designationFr": "TRAVAUX PUBLICS",
    "designationEn": "CIVIL ENGINEERING - PUBLIC WORKS"
  },
  {
    "acronyme": "F5",
    "designationFr": "FROID ET CLIMATISATION",
    "designationEn": "REFRIGERATION AND AIR CONDITIONING"
  },
  {
    "acronyme": "F7",
    "designationFr": "SCIENCE ET TECHNIQUE BIOLOGIQUE",
    "designationEn": "BIOLOGICAL AND MEDICO -SANITARY SCIENCE AND TECHNOLOGY"
  },
  {
    "acronyme": "F7BC",
    "designationFr": "BIOCHIMIE",
    "designationEn": "BIOCHEMISTRY"
  },
  {
    "acronyme": "F7BL",
    "designationFr": "BIOLOGIE",
    "designationEn": "BIOLOGY"
  },
  {
    "acronyme": "F8",
    "designationFr": "SCIENCE ET TECHNOLOGIE DE LA SANTE ET DU SOCI",
    "designationEn": "SOCIAL HEALTH SCIENCES AND TECHNOLOGY"
  },
  {
    "acronyme": "FIG",
    "designationFr": "FISCALITE ET INFORMATIQUE DE GESTION",
    "designationEn": "TAXATION AND IT MANAGEMENT"
  },
  {
    "acronyme": "FRCL",
    "designationFr": "FROID ET CLIMATISATION",
    "designationEn": "REFRIGERATION AND AIR CONDITIONING"
  },
  {
    "acronyme": "GT-PH",
    "designationFr": "GT-PHOTOGRAMMETRIE",
    "designationEn": "SURVEYS – PHOTOGRAMMETRIC OPTION"
  },
  {
    "acronyme": "GT-TO",
    "designationFr": "GEOMETRE TOPOGRAPHE",
    "designationEn": "SURVEYS - TOPOGRAPHY OPTION"
  },
  {
    "acronyme": "HE",
    "designationFr": "HEBERGEMENT",
    "designationEn": "LODGING"
  },
  {
    "acronyme": "HO",
    "designationFr": "HOTELLERIE",
    "designationEn": "HOTELLERY"
  },
  {
    "acronyme": "IB",
    "designationFr": "INDUSTRIE DU BOIS",
    "designationEn": "WOOD PROCESSING INDUSTRY"
  },
  {
    "acronyme": "IH",
    "designationFr": "INDUSTRIE D'HABILLEMENT",
    "designationEn": "CLOTHING INDUSTRY"
  },
  {
    "acronyme": "INSA",
    "designationFr": "INSTALLATION SANITAIRE",
    "designationEn": "SANITARY INSTALLATION"
  },
  {
    "acronyme": "IS",
    "designationFr": "INSTALLATION SANITAIRE",
    "designationEn": "SANITARY INSTALLATION"
  },
  {
    "acronyme": "MA",
    "designationFr": "MECANIQUE AUTOMOBILE",
    "designationEn": "AUTOMOBILE MECHANICS"
  },
  {
    "acronyme": "MACO",
    "designationFr": "MACONNERIE",
    "designationEn": "MASONRY (BUILDING CONSTRUCTION)"
  },
  {
    "acronyme": "MAEL",
    "designationFr": "MECA AUTO ELECTRICITE",
    "designationEn": "AUTOMOBILE ELECTRICAL WORKS"
  },
  {
    "acronyme": "MAIN",
    "designationFr": "MECANIQUE AUTOMOBILE A INJECTION DIESEL",
    "designationEn": "DIESEL (INJECTION) ENGINE MECHANICS"
  },
  {
    "acronyme": "MARE",
    "designationFr": "MECANIQUE AUTOMOBILE DE REPARATION",
    "designationEn": "AUTOMOBILE REPAIR MECHANICS"
  },
  {
    "acronyme": "MAV",
    "designationFr": "MAINTENANCE AUDIOVISUELLE",
    "designationEn": "AUDIOVISUAL MAINTENANCE"
  },
  {
    "acronyme": "MEA",
    "designationFr": "MAINTENANCE DES EQUIPEMENTS AGRICOLES",
    "designationEn": "MAINTENANCE OF AGRICULTURAL EQUIPMENT"
  },
  {
    "acronyme": "MEB",
    "designationFr": "MENUISERIE EBENISTERIE",
    "designationEn": "CARPENTRY / FURNITURE (WOOD WORK)"
  },
  {
    "acronyme": "MEFA",
    "designationFr": "MECANIQUE DE FABRICATION",
    "designationEn": "MANUFACTURING MECHANICS"
  },
  {
    "acronyme": "MEFE",
    "designationFr": "METAUX EN FEUILLES",
    "designationEn": "SHEET METAL WORK"
  },
  {
    "acronyme": "MEHB",
    "designationFr": "MAINTENANCE DES EQUIPEMENTS HOSPITALIERS ET B",
    "designationEn": "HOSPITAL AND BIOMEDICAL EQUIPMENT MAINTENANCE"
  },
  {
    "acronyme": "MEM",
    "designationFr": "MAINTENANCE ELECTROMECANIQUE",
    "designationEn": "ELECTRO-MECHANICAL MAINTENANCE"
  },
  {
    "acronyme": "MENU",
    "designationFr": "MENUISERIE",
    "designationEn": "WOOD WORK"
  },
  {
    "acronyme": "MF/CM",
    "designationFr": "METAUX EN FEUILLES ET CONSTRUCTION MECANIQUE",
    "designationEn": "SHEET METAL WORK AND METALLIC CONSTRUCTION"
  },
  {
    "acronyme": "MISE",
    "designationFr": "MAINTENANCE ET INSTALLATION DES SYSTEMES ELEC",
    "designationEn": "MAINTENANCE AND INSTALLATION OF ELECTRONICS SYSTEMS"
  },
  {
    "acronyme": "PLOMB",
    "designationFr": "PLOMBERIE",
    "designationEn": "PLUMBING"
  },
  {
    "acronyme": "RE",
    "designationFr": "RESTAURATION",
    "designationEn": "RESTAURATION"
  },
  {
    "acronyme": "RECA",
    "designationFr": "REPARATION CARROSSERIE AUTOMOBILE",
    "designationEn": "AUTO BODY REPAIRS"
  },
  {
    "acronyme": "SEBU",
    "designationFr": "SECRETARIAT ET BUREAUTIQUE",
    "designationEn": "SECRETARY’S OFFICE AUTOMATION"
  },
  {
    "acronyme": "SEME",
    "designationFr": "SECRETARIAT MEDICAL",
    "designationEn": "MEDICAL SECRETARY (CLERK)"
  },
  {
    "acronyme": "SERR",
    "designationFr": "SERRURIER",
    "designationEn": "LOCKSMITH"
  },
  {
    "acronyme": "SES",
    "designationFr": "SCIENCES ECONOMIQUES ET SOCIALES",
    "designationEn": "SOCIAL AND ECONOMICS SCIENCES"
  },
  {
    "acronyme": "TO",
    "designationFr": "TOURISME",
    "designationEn": "TOURISM"
  },
  {
    "acronyme": "VENTE",
    "designationFr": "VENDEUR",
    "designationEn": "SALE"
  },
  {
    "acronyme": "CH-TI",
    "designationFr": "CHAUDRAUNERIE ET TUYAUTERIE INDUSTRIELLE",
    "designationEn": "INDUSTRIAL BOILERWORKS AND PIPING"
  },
  {
    "acronyme": "CMA-MVT",
    "designationFr": "CONTRUCTION ET MAINTENANCE AUTOMOBILE OPTION MAINTENANCE VEHICULES DE TOURISME",
    "designationEn": "AUTOMOBIL BUILDING AND MAINTENANCE, TOURISM VEHICULE MAINTENANCE OPTION"
  },
  {
    "acronyme": "CMA-MVPL",
    "designationFr": "CONTRUCTION ET MAINTENANCE AUTOMOBILE OPTION MAINTENANCE VEHICULES POIDS LOURDS",
    "designationEn": "AUTOMOBIL BUILDING AND MAINTENANCE, HEAVYWEIGHT VEHICULE MAINTENANCE OPTION"
  }
];
