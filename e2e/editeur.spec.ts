import { expect, test, type Page } from "@playwright/test";

async function openEditor(page: Page) {
  await page.goto("/fr/editor");
  const canvas = page.getByTestId("editor-canvas");
  await expect(canvas.locator("canvas").first()).toBeVisible();
  return canvas;
}

async function openPanel(page: Page) {
  const toggle = page.getByRole("button", { name: "Propriétés" });
  if (await toggle.isVisible()) await toggle.click();
}

const count = (page: Page) => page.getByTestId("object-count");

test("placer des joueurs, annuler et rétablir", async ({ page }) => {
  const canvas = await openEditor(page);
  await expect(count(page)).toHaveText("Aucun objet");

  await page.getByRole("button", { name: "Joueur (P)" }).click();
  const box = (await canvas.boundingBox())!;
  for (const fx of [0.3, 0.5, 0.7]) {
    await canvas.click({ position: { x: box.width * fx, y: box.height * 0.5 } });
  }
  await expect(count(page)).toHaveText("3 objets");

  await page.getByRole("button", { name: "Annuler" }).click();
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(count(page)).toHaveText("1 objet");
  await page.getByRole("button", { name: "Rétablir" }).click();
  await expect(count(page)).toHaveText("2 objets");
});

test("appliquer une formation en un clic", async ({ page }) => {
  await openEditor(page);
  await openPanel(page);
  await page.getByRole("button", { name: "Placer Équipe A" }).click();
  await expect(count(page)).toHaveText("11 objets");
  await page.getByRole("button", { name: "Placer Équipe B" }).click();
  await expect(count(page)).toHaveText("22 objets");
  // Réappliquer une autre formation déplace les joueurs sans en créer.
  await page.getByRole("combobox").filter({ hasText: "4-3-3" }).selectOption("4-3-3");
  await page.getByRole("button", { name: "Placer Équipe A" }).click();
  await expect(count(page)).toHaveText("22 objets");
});

test("tracer une passe et une zone", async ({ page }) => {
  const canvas = await openEditor(page);
  const box = (await canvas.boundingBox())!;
  const drag = async (x0: number, y0: number, x1: number, y1: number) => {
    await page.mouse.move(box.x + box.width * x0, box.y + box.height * y0);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * x1, box.y + box.height * y1, { steps: 6 });
    await page.mouse.up();
  };
  await page.getByRole("button", { name: "Tracé (L)" }).click();
  await drag(0.3, 0.45, 0.5, 0.5);
  await page.getByRole("button", { name: "Zone (Z)" }).click();
  await drag(0.55, 0.45, 0.7, 0.55);
  await expect(count(page)).toHaveText("2 objets");
});

test("raccourcis : tout sélectionner, dupliquer, supprimer", async ({ page }) => {
  await openEditor(page);
  await openPanel(page);
  await page.getByRole("button", { name: "Placer Équipe A" }).click();
  await page.keyboard.press("Escape");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Control+d");
  await expect(count(page)).toHaveText("22 objets");
  await page.keyboard.press("Delete");
  await expect(count(page)).toHaveText("11 objets");
  await page.keyboard.press("Control+z");
  await expect(count(page)).toHaveText("22 objets");
});

test("le brouillon survit au rechargement", async ({ page }) => {
  await openEditor(page);
  await openPanel(page);
  await page.getByRole("button", { name: "Placer Équipe A" }).click();
  await expect(count(page)).toHaveText("11 objets");
  await page.waitForTimeout(700);
  await page.reload();
  await expect(count(page)).toHaveText("11 objets");
});
