import { readFileSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const PASSWORD = "motdepasse-test";
const RUN = Date.now();

async function login(page: Page, info: TestInfo) {
  await page.goto("/fr/login");
  await page.getByLabel("Adresse e-mail").fill(`seance-${info.project.name}-${info.testId}-${RUN}@example.com`);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Mes projets" })).toBeVisible();
  await page.getByRole("button", { name: "Nouveau projet" }).click();
  await expect(page.getByTestId("editor-canvas").locator("canvas").first()).toBeVisible();
}

async function withPanel(page: Page, action: (panel: ReturnType<Page["locator"]>) => Promise<void>) {
  const toggle = page.getByRole("button", { name: "Propriétés" });
  const mobile = await toggle.isVisible();
  if (mobile) await toggle.click();
  await action(page.locator("aside"));
  if (mobile) await page.getByRole("button", { name: "Fermer" }).click();
}

test("fiche de séance : PDF, lien public, animation et désactivation", async ({ page, browser }, info) => {
  test.slow();
  await login(page, info);

  // Un exercice animé, avec sa fiche.
  await withPanel(page, async (panel) => {
    await panel.getByRole("button", { name: "Placer Équipe A" }).click();
    await panel.getByLabel("Procédé").selectOption("situation");
    await panel.getByLabel("Durée", { exact: true }).fill("15 minutes");
    await panel.getByLabel("Objectif", { exact: true }).fill("Changer de rythme pour attaquer");
    await panel.getByLabel("Consignes", { exact: true }).fill("Rotation de 2 minutes avant de changer les rôles.");
  });
  await page.getByRole("button", { name: "Ajouter une étape" }).click();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.getByTestId("save-state").filter({ visible: true })).toHaveAttribute("data-state", "saved");

  // En-tête de la fiche, modifiable en place, et lien de partage.
  await page.getByRole("link", { name: "Fiche de séance" }).click();
  await expect(page).toHaveURL(/\/fr\/app\/project\/sheet\?id=/);
  const dialog = page.locator("main");
  await dialog.getByLabel("Thème de séance", { exact: true }).fill("Déséquilibrer par la passe");
  await dialog.getByLabel("Catégorie", { exact: true }).fill("U13");
  await dialog.getByLabel("On a le ballon 1", { exact: true }).fill("Conserver / Progresser");
  await dialog.getByLabel("On a le ballon 2", { exact: true }).fill("Déséquilibrer / Finir");
  await expect(dialog.getByLabel("Objectif", { exact: true })).toHaveValue("Changer de rythme pour attaquer");
  await dialog.getByRole("button", { name: "Créer un lien de partage" }).click();
  const link = dialog.getByRole("textbox", { name: /lien/i });
  await expect(link).toHaveValue(/\/fr\/s\/[0-9a-f]{32}$/);
  const url = await link.inputValue();

  // Le PDF se télécharge et en est bien un.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Télécharger la fiche PDF" }).click(),
  ]);
  const file = info.outputPath("fiche.pdf");
  await download.saveAs(file);
  const bytes = readFileSync(file);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(20_000);

  // La page publique s'ouvre sans compte et lit l'animation.
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto(url);
  await expect(pub.getByRole("heading", { name: "Déséquilibrer par la passe" })).toBeVisible();
  await expect(pub.getByText("Changer de rythme pour attaquer")).toBeVisible();
  await expect(pub.getByText("Situation", { exact: true })).toBeVisible();
  await pub.getByRole("button", { name: "Lire l'animation" }).click();
  await expect(pub.getByRole("button", { name: "Mettre en pause" })).toBeVisible();
  // La page publique ne permet aucune modification.
  await expect(pub.getByRole("button", { name: "Nouveau projet" })).toHaveCount(0);

  // Désactiver le lien coupe l'accès.
  await dialog.getByRole("button", { name: "Désactiver le lien" }).click();
  await expect(dialog.getByRole("button", { name: "Créer un lien de partage" })).toBeVisible();
  await pub.reload();
  await expect(pub.getByRole("heading", { name: "Lien inactif" })).toBeVisible();
  await visitor.close();
});

test("un lien inventé ne montre rien", async ({ page }) => {
  await page.goto("/fr/s/0123456789abcdef0123456789abcdef");
  await expect(page.getByRole("heading", { name: "Lien inactif" })).toBeVisible();
  await page.goto("/fr/s/pas-un-jeton");
  await expect(page.getByRole("heading", { name: "Lien inactif" })).toBeVisible();
});

test("la fiche se remplit et se réorganise dans l'app", async ({ page }, info) => {
  await login(page, info);
  await page.getByRole("button", { name: "Ajouter un tableau" }).click();
  await expect(page.getByRole("tab", { name: "Tableau 2" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name: "Fiche de séance" }).click();

  const first = page.getByRole("article", { name: "Exercice 1" });
  const second = page.getByRole("article", { name: "Exercice 2" });
  await expect(first.getByLabel("Nom de l'exercice")).toHaveValue("Tableau 1");
  await first.getByLabel("Objectif", { exact: true }).fill("Conserver le ballon");
  await first.getByRole("radio", { name: "Jeu" }).click();
  await second.getByLabel("Durée", { exact: true }).fill("20 minutes");
  await page.getByLabel("On n'a pas le ballon 1", { exact: true }).fill("Récupérer vite");
  await expect(page.getByTestId("save-state").filter({ visible: true })).toHaveAttribute("data-state", "saved");

  // L'exercice 2 passe en tête.
  await second.getByRole("button", { name: "Monter l'exercice" }).click();
  await expect(page.getByRole("article", { name: "Exercice 1" }).getByLabel("Nom de l'exercice")).toHaveValue("Tableau 2");
  await expect(page.getByTestId("save-state").filter({ visible: true })).toHaveAttribute("data-state", "saved");

  await page.reload();
  const top = page.getByRole("article", { name: "Exercice 1" });
  const bottom = page.getByRole("article", { name: "Exercice 2" });
  await expect(top.getByLabel("Durée", { exact: true })).toHaveValue("20 minutes");
  await expect(bottom.getByLabel("Objectif", { exact: true })).toHaveValue("Conserver le ballon");
  await expect(bottom.getByRole("radio", { name: "Jeu" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("On n'a pas le ballon 1", { exact: true })).toHaveValue("Récupérer vite");

  // « Modifier le schéma » ouvre l'éditeur sur le bon tableau.
  await bottom.getByRole("link", { name: "Modifier le schéma" }).click();
  await expect(page.getByRole("tab", { name: "Tableau 1" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("navigation", { name: "Tableaux" }).getByRole("tab").first()).toHaveText("Tableau 2");

  // Ajout et suppression d'un exercice depuis la fiche.
  await page.getByRole("link", { name: "Fiche de séance" }).click();
  await page.getByRole("button", { name: "Ajouter un exercice" }).click();
  await expect(page.getByRole("article")).toHaveCount(3);
  const third = page.getByRole("article", { name: "Exercice 3" });
  await third.getByRole("button", { name: "Supprimer l'exercice" }).click();
  await third.getByRole("button", { name: "Confirmer la suppression" }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
});

test("une saisie faite juste avant de quitter la fiche n'est pas perdue", async ({ page }, info) => {
  await login(page, info);
  await page.getByRole("link", { name: "Fiche de séance" }).click();
  await page.getByLabel("Thème de séance", { exact: true }).fill("Pressing haut");
  // On quitte aussitôt, sans attendre l'enregistrement différé.
  await page.getByRole("link", { name: "Retour à l'éditeur" }).click();
  await expect(page.getByTestId("editor-canvas").locator("canvas").first()).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Fiche de séance" }).click();
  await expect(page.getByLabel("Thème de séance", { exact: true })).toHaveValue("Pressing haut");
});

