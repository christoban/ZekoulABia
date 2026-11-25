import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Contenu de base de connaissances pour le copilot Admin (aide contextuelle) —
// premier jet limité aux 5 écrans les plus fréquentés/complexes identifiés.
// Locale FR uniquement pour l'instant ; ajouter des lignes locale: "en" plus
// tard sans changer le schéma.
const articles: {
  screenKey: string;
  title: string;
  content: string;
  relatedSelectors: string[];
  role: string[];
  locale: "fr" | "en";
}[] = [
  {
    screenKey: "admin.grades",
    title: "Consultation et validation des notes",
    content:
      "Cet écran sert à consulter et valider les notes soumises par les enseignants. Filtrez par classe, matière et statut, puis cliquez sur « Charger ». Le bouton « Valider tout » (visible seulement s'il y a des notes en attente) valide en une fois toutes les notes au statut « Soumis » pour la classe sélectionnée. Pour rejeter une note individuelle, utilisez le bouton rouge à côté de la note concernée — le motif de rejet se saisit dans le module notes de l'enseignant, pas ici.",
    relatedSelectors: ['[data-help-id="grades-bulk-validate"]'],
    role: ["ADMIN"],
    locale: "fr",
  },
  {
    screenKey: "admin.lv2-choice",
    title: "Fenêtre de choix LV2",
    content:
      "Cet écran gère la fenêtre de choix de LV2 (deuxième langue vivante) par niveau. Ouvrez une fenêtre avec une date de début et de fin : pendant cette période, les élèves choisissent leur LV2. Le bouton « Suivi » affiche qui a répondu. Pour les élèves qui n'ont pas soumis à temps, utilisez la saisie manuelle de secours en bas du panneau de suivi. Le bouton « Appliquer » clôture la fenêtre et applique définitivement les choix collectés aux dossiers élèves — à utiliser seulement quand tous les choix nécessaires sont enregistrés, y compris les saisies manuelles.",
    relatedSelectors: ['[data-help-id="lv2-apply-btn"]', '[data-help-id="lv2-manual-entry"]'],
    role: ["ADMIN"],
    locale: "fr",
  },
  {
    screenKey: "admin.pebs-exams",
    title: "Sessions de sélection PEBS",
    content:
      "Cet écran gère les sessions de sélection PEBS (Programme Spécial Bilingue). Créez une session en indiquant le niveau, la classe cible, la date d'examen, le seuil de sélection et le nombre de places disponibles. Après avoir saisi ou scanné les résultats des candidats, cliquez sur « Calculer la sélection » pour appliquer automatiquement le seuil. « Détecter les anomalies » vérifie les incohérences avant de continuer. Le bouton « Appliquer le transfert » déplace effectivement les élèves sélectionnés vers la classe cible — une confirmation est demandée car cette action déplace réellement les élèves entre classes.",
    relatedSelectors: ['[data-help-id="pebs-compute-btn"]', '[data-help-id="pebs-apply-transfer-btn"]'],
    role: ["ADMIN"],
    locale: "fr",
  },
  {
    screenKey: "admin.matricules",
    title: "Import Excel des matricules",
    content:
      "Cet écran importe un fichier Excel (.xlsx/.xls) de matricules officiels et les rapproche des élèves déjà dans EduNexus. Après l'import, trois catégories apparaissent : les correspondances exactes (automatiques), les correspondances probables à confirmer (rapprochement approximatif par similarité de nom — vérifiez bien avant de confirmer ou signaler), et les lignes non rapprochées à traiter manuellement. Le pourcentage affiché sur chaque correspondance probable indique le niveau de similarité des noms.",
    relatedSelectors: ['[data-help-id="matricules-import-btn"]', '[data-help-id="matricules-fuzzy-confirm-btn"]'],
    role: ["ADMIN"],
    locale: "fr",
  },
  {
    screenKey: "admin.bulletins",
    title: "Génération des bulletins",
    content:
      "Cet écran génère les bulletins scolaires. Sélectionnez une classe puis cliquez sur « Charger » pour voir la pré-vérification : elle affiche si toutes les notes sont validées et si le conseil de classe est verrouillé — ces deux conditions sont obligatoires avant de pouvoir générer (le bouton « Générer les bulletins » reste grisé sinon). Une fois générés, vous pouvez télécharger tous les bulletins en un ZIP ou les envoyer directement aux parents.",
    relatedSelectors: ['[data-help-id="bulletins-generate-btn"]'],
    role: ["ADMIN"],
    locale: "fr",
  },
];

async function main() {
  console.log("📚 Seeding HelpArticle...");
  let count = 0;
  for (const a of articles) {
    const existing = await (prisma as any).helpArticle.findFirst({
      where: { screenKey: a.screenKey, locale: a.locale },
    });
    if (existing) {
      await (prisma as any).helpArticle.update({
        where: { id: existing.id },
        data: { title: a.title, content: a.content, relatedSelectors: a.relatedSelectors, role: a.role },
      });
    } else {
      await (prisma as any).helpArticle.create({ data: a });
    }
    count++;
  }
  console.log(`   ✓ ${count} fiches d'aide`);
}

main()
  .catch((e) => {
    console.error("❌ Erreur seed HelpArticle:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
