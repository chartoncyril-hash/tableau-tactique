import { expect, test, type Page } from "@playwright/test";

async function openEditor(page: Page) {
  await page.goto("/fr/editor");
  await expect(page.getByTestId("editor-canvas").locator("canvas").first()).toBeVisible();
}

async function withPanel(page: Page, action: () => Promise<void>) {
  const toggle = page.getByRole("button", { name: "Propriétés" });
  const mobile = await toggle.isVisible();
  if (mobile) await toggle.click();
  await action();
  if (mobile) await page.getByRole("button", { name: "Fermer" }).click();
}

const timeline = (page: Page) => page.getByTestId("timeline");
const steps = (page: Page) => timeline(page).getByRole("tab");

async function animateTeam(page: Page) {
  await withPanel(page, () => page.getByRole("button", { name: "Placer Équipe A" }).click());
  await page.getByRole("button", { name: "Ajouter une étape" }).click();
  await expect(timeline(page).getByRole("tab", { name: "Étape 1" })).toHaveAttribute("aria-selected", "true");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+a");
  for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowRight");
}

test("créer une étape, lire l'animation jusqu'au bout", async ({ page }) => {
  await openEditor(page);
  await expect(page.getByRole("button", { name: "Lire l'animation" })).toBeDisabled();
  await animateTeam(page);

  const duration = page.getByRole("spinbutton", { name: "Durée" });
  await duration.fill("0.5");
  await timeline(page).getByRole("tab", { name: "Départ" }).click();
  await page.getByRole("button", { name: "Lire l'animation" }).click();
  await expect(timeline(page)).toHaveAttribute("data-mode", "playing");
  // À la fin, la lecture s'arrête sur la dernière étape et l'édition reprend.
  await expect(timeline(page)).toHaveAttribute("data-mode", "idle");
  await expect(timeline(page).getByRole("tab", { name: "Étape 1" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("object-count")).toHaveText("11 objets");
});

test("mettre en pause, reprendre et arrêter", async ({ page }) => {
  await openEditor(page);
  await animateTeam(page);
  await page.getByRole("spinbutton", { name: "Durée" }).fill("10");
  await page.getByRole("button", { name: "Lire l'animation" }).click();
  await page.getByRole("button", { name: "Mettre en pause" }).click();
  await expect(timeline(page)).toHaveAttribute("data-mode", "paused");
  // Pendant la lecture, on ne peut pas ajouter d'étape.
  await expect(page.getByRole("button", { name: "Ajouter une étape" })).toBeDisabled();
  await page.getByRole("button", { name: "Arrêter la lecture" }).click();
  await expect(timeline(page)).toHaveAttribute("data-mode", "idle");
  await expect(page.getByRole("button", { name: "Ajouter une étape" })).toBeEnabled();
});

test("les étapes sont enregistrées et peuvent être supprimées", async ({ page }) => {
  await openEditor(page);
  await animateTeam(page);
  await page.getByRole("button", { name: "Ajouter une étape" }).click();
  await expect(steps(page)).toHaveCount(3);
  await page.waitForTimeout(700);
  await page.reload();
  await expect(steps(page)).toHaveCount(3);

  await timeline(page).getByRole("tab", { name: "Étape 2" }).click();
  await page.getByRole("button", { name: "Supprimer cette étape" }).click();
  await expect(steps(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(steps(page)).toHaveCount(3);
});

test("régler la cloche d'un ballon dans une étape", async ({ page }) => {
  await openEditor(page);
  const canvas = page.getByTestId("editor-canvas");
  await page.getByRole("button", { name: "Ballon (B)" }).click();
  await page.waitForTimeout(300);
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
  await page.getByRole("button", { name: "Ajouter une étape" }).click();
  await withPanel(page, async () => {
    const arc = page.getByRole("slider", { name: "Hauteur de la cloche" });
    await arc.fill("8");
    await expect(page.getByText("Hauteur de la cloche 8 m")).toBeVisible();
    await page.getByRole("button", { name: "Supprimer ce déplacement" }).click();
    await expect(page.getByText("Hauteur de la cloche 0 m")).toBeVisible();
  });
});
