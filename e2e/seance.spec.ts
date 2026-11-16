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
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

  // En-tête de la fiche et lien de partage.
  await page.getByRole("button", { name: "Fiche de séance" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Thème de séance", { exact: true }).fill("Déséquilibrer par la passe");
  await dialog.getByLabel("Catégorie", { exact: true }).fill("U13");
  await dialog.getByLabel("On a le ballon", { exact: true }).fill("Conserver / Progresser\nDéséquilibrer / Finir");
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
