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

const view = (page: Page) => page.getByTestId("view-3d");

test("passer en 3D, changer de point de vue et revenir en 2D", async ({ page }) => {
  await openEditor(page);
  await withPanel(page, () => page.getByRole("button", { name: "Placer Équipe A" }).click());
  await expect(page.getByRole("toolbar")).toBeVisible();

  await page.getByRole("button", { name: "Vue 3D" }).click();
  await expect(view(page)).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  // Onze joueurs en relief, outils d'édition masqués.
  await expect(view(page)).toHaveAttribute("data-objects", "11");
  await expect(page.getByRole("toolbar")).toBeHidden();
  await expect(page.getByRole("button", { name: "Vue 3D" })).toHaveAttribute("aria-pressed", "true");

  const cameras = page.getByRole("radiogroup", { name: "Point de vue" });
  await expect(cameras.getByRole("radio", { name: "Tribune" })).toHaveAttribute("aria-checked", "true");
  await cameras.getByRole("radio", { name: "Dessus" }).click();
  await expect(view(page)).toHaveAttribute("data-camera", "top");
  await cameras.getByRole("radio", { name: "Derrière le but" }).click();
  await expect(view(page)).toHaveAttribute("data-camera", "goal");

  const figures = page.getByRole("radiogroup", { name: "Représentation des joueurs" });
  await expect(figures.getByRole("radio", { name: "Personnages" })).toHaveAttribute("aria-checked", "true");
  await figures.getByRole("radio", { name: "Pions" }).click();
  await expect(figures.getByRole("radio", { name: "Pions" })).toHaveAttribute("aria-checked", "true");
  await figures.getByRole("radio", { name: "Personnages" }).click();

  // La scène 3D est bien dessinée : l'image n'est pas uniforme.
  const shot = await view(page).locator("canvas").screenshot();
  expect(shot.length).toBeGreaterThan(20_000);

  await page.keyboard.press("Escape");
  await expect(view(page)).toBeHidden();
  await expect(page.getByRole("toolbar")).toBeVisible();
});

test("lire l'animation dans la vue 3D", async ({ page }) => {
  await openEditor(page);
  await withPanel(page, () => page.getByRole("button", { name: "Placer Équipe A" }).click());
  await page.getByRole("button", { name: "Ajouter une étape" }).click();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+a");
  for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+ArrowRight");
  await page.getByRole("spinbutton", { name: "Durée" }).fill("0.6");

  await page.getByRole("button", { name: "Vue 3D" }).click();
  await expect(view(page)).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await page.getByTestId("timeline").getByRole("tab", { name: "Départ" }).click();
  await page.getByRole("button", { name: "Lire l'animation" }).click();
  await expect(page.getByTestId("timeline")).toHaveAttribute("data-mode", "idle", { timeout: 10_000 });
  await expect(page.getByTestId("timeline").getByRole("tab", { name: "Étape 1" })).toHaveAttribute("aria-selected", "true");
  // Toujours en 3D après la lecture.
  await expect(view(page)).toBeVisible();
});

test("message clair si l'appareil ne gère pas la 3D", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
  await openEditor(page);
  await page.getByRole("button", { name: "Vue 3D" }).click();
  await expect(view(page).getByRole("alert")).toContainText("ne permet pas l'affichage 3D");
  await page.getByRole("button", { name: "Vue 3D" }).click();
  await expect(view(page)).toBeHidden();
});

test("orienter les joueurs depuis le panneau", async ({ page }) => {
  await openEditor(page);
  await withPanel(page, () => page.getByRole("button", { name: "Placer Équipe A" }).click());
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+a");
  await withPanel(page, async () => {
    const panel = page.getByRole("complementary", { name: "Propriétés" });
    await expect(panel.getByLabel("Orientation : 0 degrés")).toBeVisible();
    await panel.getByRole("button", { name: "Tourner de 45° à droite" }).click();
    await expect(panel.getByLabel("Orientation : 45 degrés")).toBeVisible();
    await panel.getByRole("button", { name: "Demi-tour" }).click();
    await expect(panel.getByLabel("Orientation : 225 degrés")).toBeVisible();
    await panel.getByRole("button", { name: "Face au but adverse" }).click();
    await expect(panel.getByLabel("Orientation : 0 degrés")).toBeVisible();
  });
  await page.keyboard.press("Escape");
  await withPanel(page, async () => {
    const show = page.getByRole("checkbox", { name: /Montrer l'orientation des joueurs/ });
    await expect(show).toBeChecked();
    await show.uncheck();
    await expect(show).not.toBeChecked();
  });
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByTestId("editor-canvas").locator("canvas").first()).toBeVisible();
  await withPanel(page, () =>
    expect(page.getByRole("checkbox", { name: /Montrer l'orientation des joueurs/ })).not.toBeChecked(),
  );
});

test("déplacer un joueur en le faisant glisser dans la vue 3D, puis annuler", async ({ page }) => {
  await openEditor(page);
  // Un joueur au centre du terrain : il sera au centre de la vue 3D « Dessus ».
  await page.getByRole("button", { name: "Joueur (P)" }).click();
  const canvas2d = page.getByTestId("editor-canvas");
  const b2 = (await canvas2d.boundingBox())!;
  await canvas2d.click({ position: { x: b2.width / 2, y: b2.height / 2 } });
  await expect(page.getByTestId("object-count")).toHaveText("1 objet");
  await page.getByRole("button", { name: "Sélection (V)" }).click();

  await page.getByRole("button", { name: "Vue 3D" }).click();
  await expect(view(page)).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await page.getByRole("radiogroup", { name: "Point de vue" }).getByRole("radio", { name: "Dessus" }).click();
  await page.waitForTimeout(1200);
  const canvas = view(page).locator("canvas");
  const box = (await canvas.boundingBox())!;
  const before = await canvas.screenshot();

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 20, { steps: 5 });
  await page.mouse.move(x + 110, y + 50, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const moved = await canvas.screenshot();
  expect(moved.equals(before)).toBe(false);

  // Le déplacement entre dans l'historique : annuler remet le joueur à sa place.
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(400);
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(true);
  await expect(page.getByTestId("object-count")).toHaveText("1 objet");
});

test("les zones d'influence s'affichent aussi en 3D", async ({ page }) => {
  await openEditor(page);
  await withPanel(page, () => page.getByRole("button", { name: "Placer Équipe A" }).click());
  await page.getByRole("button", { name: "Vue 3D" }).click();
  await expect(view(page)).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await page.getByRole("radiogroup", { name: "Point de vue" }).getByRole("radio", { name: "Dessus" }).click();
  await page.waitForTimeout(1200);
  const canvas = view(page).locator("canvas");
  const plain = await canvas.screenshot();
  await withPanel(page, () => page.getByRole("checkbox", { name: "Zones d'influence (Voronoï)" }).check());
  await expect.poll(async () => (await canvas.screenshot()).equals(plain), { timeout: 10_000 }).toBe(false);
});
