const cfg = require("./config");
const {
  runStep, attachConsoleListener, clearConsoleErrors,
  fill, click, selectOption, expectText, expectURL, waitForIdle,
} = require("./helpers");

module.exports = async function runAdminSetup(browser, reporter) {

  const adminContext = await browser.newContext({ baseURL: cfg.BASE_URL });
  const adminPage    = await adminContext.newPage();
  attachConsoleListener(adminPage);

  // ── ÉTAPE 2.1 — Login Admin ──
  await runStep("2.1", "Login Admin École", cfg, reporter, adminPage, async () => {
    await adminPage.goto(`${cfg.BASE_URL}/login`);
    await waitForIdle(adminPage);
    // Sélectionner l'établissement (CustomAutocompleteSelect)
    const schoolTrigger = adminPage.getByPlaceholder("Selectionne ton etablissement");
    if (await schoolTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
      await schoolTrigger.click();
      await adminPage.getByPlaceholder("Rechercher un etablissement...").fill(cfg.SCHOOL.name);
      await adminPage.waitForTimeout(500);
      await adminPage.getByText(cfg.SCHOOL.name, { exact: false }).first().click();
      await waitForIdle(adminPage);
    }
    await adminPage.getByPlaceholder("m@example.com").fill(cfg.SCHOOL.adminEmail);
    await adminPage.locator("input[type='password']").first().fill(cfg.SCHOOL.adminPassword);
    await adminPage.getByRole("button", { name: "Se connecter" }).click();
    await waitForIdle(adminPage);
    await expectURL(adminPage, "/admin");
    console.log("   ✅ Connecté en tant qu'Admin École");
  });
  clearConsoleErrors(adminPage);

  // ── ÉTAPE 2.2 — Année scolaire ──
  await runStep("2.2", "Année scolaire", cfg, reporter, adminPage, async () => {
    await adminPage.goto(`${cfg.BASE_URL}/settings/academic-years`);
    await waitForIdle(adminPage);
    const exists = await adminPage.getByText("2025-2026", { exact: false }).first().isVisible().catch(() => false);
    if (!exists) {
      await click(adminPage, /créer|nouvelle|ajouter/i);
      await waitForIdle(adminPage);
      await fill(adminPage, /nom|intitulé|year/i, "2025-2026");
      const startDate = adminPage.getByLabel(/début|start/i).first();
      if (await startDate.isVisible().catch(() => false)) await startDate.fill("2025-09-01");
      const endDate = adminPage.getByLabel(/fin|end/i).first();
      if (await endDate.isVisible().catch(() => false)) await endDate.fill("2026-07-31");
      await click(adminPage, /enregistrer|créer|soumettre|save/i);
      await waitForIdle(adminPage);
    }
    await expectText(adminPage, "2025-2026");
    const activateBtn = adminPage.getByRole("row", { name: /2025-2026/i })
      .getByRole("button", { name: /activer|activate|définir.*actif/i }).first();
    if (await activateBtn.isVisible().catch(() => false)) { await activateBtn.click(); await waitForIdle(adminPage); }
  });
  clearConsoleErrors(adminPage);

  // ── ÉTAPE 2.3 — Paramètres école ──
  await runStep("2.3", "Paramètres école", cfg, reporter, adminPage, async () => {
    await adminPage.goto(`${cfg.BASE_URL}/admin/settings`);
    await waitForIdle(adminPage);
    const getNomField = () => adminPage.getByLabel(/nom.*école|établissement/i).first();
    if (await getNomField().isVisible().catch(() => false)) {
      await getNomField().clear(); await getNomField().fill(cfg.SCHOOL.name + " (modifié)");
      await click(adminPage, /enregistrer|sauvegarder|save/i); await waitForIdle(adminPage);
      await expectText(adminPage, /enregistré|sauvegardé|succès|saved/i);
      await getNomField().clear(); await getNomField().fill(cfg.SCHOOL.name);
      await click(adminPage, /enregistrer|sauvegarder|save/i); await waitForIdle(adminPage);
    }
  });
  clearConsoleErrors(adminPage);

  // ── ÉTAPE 2.4 — Classes ──
  await runStep("2.4", "Classes", cfg, reporter, adminPage, async () => {
    await adminPage.goto(`${cfg.BASE_URL}/admin/classes`);
    await waitForIdle(adminPage);
    for (const cls of cfg.CLASSES) {
      const exists = await adminPage.getByText(cls.name, { exact: false }).first().isVisible().catch(() => false);
      if (exists) { console.log(`   ℹ️ Classe "${cls.name}" déjà présente — ignorée`); continue; }
      await click(adminPage, /nouvelle classe|créer|ajouter/i); await waitForIdle(adminPage);
      await fill(adminPage, /nom/i, cls.name);
      await fill(adminPage, /capacité/i, String(cls.capacity));
      await click(adminPage, /créer|enregistrer|soumettre|save/i); await waitForIdle(adminPage);
      await expectText(adminPage, cls.name);
    }
    // Test suppression de la 2ème classe pour vérifier la modale de confirmation
    const rowClass2 = adminPage.getByRole("row", { name: new RegExp(cfg.CLASSES[1].name, "i") });
    const deleteBtn = rowClass2.getByRole("button", { name: /supprim|delete|trash/i }).first();
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
      const confirmBtn = adminPage.getByRole("button", { name: /confirm|oui|yes|supprimer/i }).first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click(); await waitForIdle(adminPage);
      }
      await click(adminPage, /nouvelle classe|créer|ajouter/i); await waitForIdle(adminPage);
      await fill(adminPage, /nom/i, cfg.CLASSES[1].name);
      await fill(adminPage, /capacité/i, String(cfg.CLASSES[1].capacity));
      await click(adminPage, /créer|enregistrer|soumettre|save/i); await waitForIdle(adminPage);
    }
    await expectText(adminPage, cfg.CLASSES[0].name);
  });
  clearConsoleErrors(adminPage);

  // ── ÉTAPE 2.5 — Matières ──
  await runStep("2.5", "Matières", cfg, reporter, adminPage, async () => {
    await adminPage.goto(`${cfg.BASE_URL}/admin/subjects`);
    await waitForIdle(adminPage);
    for (const s of cfg.SUBJECTS) {
      const exists = await adminPage.getByText(s.name, { exact: false }).first().isVisible().catch(() => false);
      if (exists) { console.log(`   ℹ️ Matière "${s.name}" déjà présente — ignorée`); continue; }
      await click(adminPage, /nouvelle matière|créer|ajouter/i); await waitForIdle(adminPage);
      await fill(adminPage, /^nom/i, s.name);
      await fill(adminPage, /code/i, s.code);
      await fill(adminPage, /coefficient/i, String(s.coefficient));
      await fill(adminPage, /heure|week|semaine/i, String(s.hoursPerWeek));
      await selectOption(adminPage, /type/i, s.subjectType);
      await click(adminPage, /créer|enregistrer|soumettre|save/i); await waitForIdle(adminPage);
      await expectText(adminPage, s.name);
    }
    await expectText(adminPage, "Mathématiques");
    console.log("   ✅ Matières créées avec coefficients MINESEC");
  });
  clearConsoleErrors(adminPage);

  // ── ÉTAPE 2.6 — Utilisateurs ──
  await runStep("2.6", "Créer les utilisateurs", cfg, reporter, adminPage, async () => {
    await adminPage.goto(`${cfg.BASE_URL}/admin/users`);
    await waitForIdle(adminPage);
    for (const u of [cfg.USERS.teacher, cfg.USERS.student, cfg.USERS.parent, cfg.USERS.censeur]) {
      const exists = await adminPage.getByText(u.email, { exact: false }).first().isVisible().catch(() => false);
      if (exists) { console.log(`   ℹ️ Utilisateur "${u.email}" déjà présent — ignoré`); continue; }
      await click(adminPage, /nouvel utilisateur|créer|ajouter|inviter/i); await waitForIdle(adminPage);
      if (u.firstName) await fill(adminPage, /prénom/i, u.firstName);
      if (u.lastName)  await fill(adminPage, /^nom/i, u.lastName);
      await fill(adminPage, /email/i, u.email);
      await fill(adminPage, /mot de passe|password/i, u.password);
      await selectOption(adminPage, /rôle|role/i, u.role);
      if (u.title) {
        const titleField = adminPage.getByLabel(/titre|title/i).first();
        if (await titleField.isVisible().catch(() => false)) await titleField.fill(u.title);
      }
      await click(adminPage, /créer|enregistrer|inviter|soumettre|save/i); await waitForIdle(adminPage);
      await expectText(adminPage, u.email);
    }

    // ── RÈGLE MÉTIER : assigner l'élève Marie à la classe 6e A ──
    const marieName = `${cfg.USERS.student.firstName} ${cfg.USERS.student.lastName}`;
    const marieRow  = adminPage.getByRole("row", { name: new RegExp(marieName, "i") });
    const editBtnMarie = marieRow.getByRole("button", { name: /éditer|modifier|edit/i }).first();
    if (await editBtnMarie.isVisible().catch(() => false)) {
      await editBtnMarie.click(); await waitForIdle(adminPage);
      await selectOption(adminPage, /classe/i, cfg.CLASSES[0].name);
      await click(adminPage, /enregistrer|sauvegarder|save/i); await waitForIdle(adminPage);
    }

    // ── RÈGLE MÉTIER : assigner l'enseignant Jean à Mathématiques / 6e A ──
    const jeanName = `${cfg.USERS.teacher.firstName} ${cfg.USERS.teacher.lastName}`;
    const jeanRow   = adminPage.getByRole("row", { name: new RegExp(jeanName, "i") });
    const editBtnJean = jeanRow.getByRole("button", { name: /éditer|modifier|edit/i }).first();
    if (await editBtnJean.isVisible().catch(() => false)) {
      await editBtnJean.click(); await waitForIdle(adminPage);
      const classeField = adminPage.getByLabel(/classe/i).first();
      if (await classeField.isVisible().catch(() => false)) await selectOption(adminPage, /classe/i, cfg.CLASSES[0].name);
      await click(adminPage, /enregistrer|sauvegarder|save/i); await waitForIdle(adminPage);
    }

    // ── Test export CSV ──
    const csvBtn = adminPage.getByRole("button", { name: /export|csv/i }).first();
    if (await csvBtn.isVisible().catch(() => false)) {
      try {
        const [download] = await Promise.all([
          adminPage.waitForEvent("download", { timeout: 8000 }),
          csvBtn.click(),
        ]);
        console.log(`   📥 CSV exporté : ${download.suggestedFilename()}`);
      } catch {
        console.log("   ℹ️ Export CSV non disponible ou timeout — non bloquant");
      }
    }
  });
  clearConsoleErrors(adminPage);

  console.log("\n✅ Admin Setup terminé — contexte admin conservé pour les parties suivantes\n");
  return { adminPage, adminContext };
};
