import { expect, test, type Page, type TestInfo } from "@playwright/test";

const PASSWORD = "motdepasse-test";
const RUN = Date.now();
const email = (info: TestInfo, who: string) => `e2e-${info.project.name}-${info.testId}-${RUN}-${who}@example.com`;

async function login(page: Page, address: string) {
  await page.goto("/fr/login");
  await page.getByLabel("Adresse e-mail").fill(address);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Mes projets" })).toBeVisible();
}

async function withPanel(page: Page, action: () => Promise<void>) {
  const toggle = page.getByRole("button", { name: "Propriétés" });
  const mobile = await toggle.isVisible();
  if (mobile) await toggle.click();
  await action();
  if (mobile) await page.getByRole("button", { name: "Fermer" }).click();
}

const view = (page: Page) => page.getByTestId("view-3d");

async function open3d(page: Page) {
  await page.getByRole("button", { name: "Vue 3D", exact: true }).first().click();
  await expect(view(page)).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
}

test("choisir la catégorie : U10-U11 passe au foot à 8 et ses systèmes", async ({ page }) => {
  await page.goto("/fr/editor");
  await expect(page.getByTestId("editor-canvas").locator("canvas").first()).toBeVisible();
  await withPanel(page, async () => {
    await page.getByRole("combobox", { name: "Catégorie" }).selectOption({ label: "U10-U11" });
    await expect(page.getByRole("combobox", { name: "Format de jeu" })).toHaveValue("football8");
    await expect(page.getByRole("combobox", { name: "Formation" }).locator("option")).toHaveText(["3-3-1", "2-3-2", "3-2-2", "2-4-1", "3-1-3"]);
    await page.getByRole("button", { name: "Placer Équipe A" }).click();
  });
  await open3d(page);
  await expect(view(page)).toHaveAttribute("data-objects", "8");
  await page.keyboard.press("Escape");

  // Le format se change aussi à la main : foot à 5 en seniors, par exemple.
  await withPanel(page, async () => {
    await page.getByRole("combobox", { name: "Format de jeu" }).selectOption("football5");
    await expect(page.getByRole("combobox", { name: "Catégorie" })).toHaveValue("U11");
    await page.getByRole("combobox", { name: "Catégorie" }).selectOption({ label: "Seniors" });
    await expect(page.getByRole("combobox", { name: "Format de jeu" })).toHaveValue("football");
  });
});

test("stade en 3D, décor simple, trajectoires et plein écran", async ({ page }) => {
  await page.goto("/fr/editor");
  await expect(page.getByTestId("editor-canvas").locator("canvas").first()).toBeVisible();
  await withPanel(page, () => page.getByRole("button", { name: "Placer Équipe A" }).click());
  await page.getByRole("button", { name: "Ajouter une étape" }).click();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+a");
  for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+ArrowRight");

  await open3d(page);
  await expect(view(page)).toHaveAttribute("data-decor", "stadium");
  // Les onze déplacements de l'étape sont tracés en relief.
  await expect(view(page)).toHaveAttribute("data-traces", "11");
  await page.getByRole("button", { name: "Afficher les trajectoires" }).click();
  await expect(view(page)).toHaveAttribute("data-traces", "0");
  await page.getByRole("button", { name: "Afficher les trajectoires" }).click();
  await expect(view(page)).toHaveAttribute("data-traces", "11");

  const decor = page.getByRole("radiogroup", { name: "Décor" });
  await decor.getByRole("radio", { name: "Pelouse seule" }).click();
  await expect(view(page)).toHaveAttribute("data-decor", "plain");
  await decor.getByRole("radio", { name: "Stade" }).click();
  await expect(view(page)).toHaveAttribute("data-decor", "stadium");
  const shot = await view(page).locator("canvas").screenshot();
  expect(shot.length).toBeGreaterThan(20_000);

  const fullscreen = page.getByRole("button", { name: "Plein écran" });
  test.skip(!(await fullscreen.isVisible()), "Plein écran indisponible sur ce navigateur");
  await fullscreen.click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id ?? null)).toBe("editor-stage");
  // La vue 3D reste affichée en plein écran, avec sa bascule.
  await expect(view(page)).toBeVisible();
  await expect(page.getByTestId("timeline").getByRole("button", { name: "Vue 3D" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Quitter le plein écran" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
});

test("logo du club dans les réglages et le stade, présentation en 3D", async ({ page }, info) => {
  test.skip(info.project.name.includes("mobile"), "Présentation masquée sur téléphone");
  test.setTimeout(90_000);
  await login(page, email(info, "admin"));
  await page.getByTestId("workspace").filter({ visible: true }).selectOption({ label: "+ Créer un club…" });
  const dialog = page.getByRole("dialog", { name: "Créer un club" });
  await dialog.getByLabel("Nom du club").fill(`US Logo ${RUN}`);
  await dialog.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByRole("heading", { name: `US Logo ${RUN}`, level: 1 })).toBeVisible();

  await page.getByLabel("Logo du club").setInputFiles("e2e/fixtures/photo.png");
  await expect(page.getByRole("img", { name: "Logo actuel du club" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Changer le logo" })).toBeVisible();

  // Dans un projet du club, le stade propose de changer ce même logo.
  await page.getByRole("navigation", { name: "Espace" }).filter({ visible: true }).getByRole("link", { name: "Projets" }).click();
  await page.getByRole("button", { name: "Nouveau projet" }).click();
  await expect(page.getByTestId("editor-canvas").locator("canvas").first()).toBeVisible();
  await withPanel(page, () => page.getByRole("button", { name: "Placer Équipe A" }).click());
  await open3d(page);
  await expect(view(page).getByRole("button", { name: "Changer le logo" })).toBeVisible();
  await view(page).getByRole("button", { name: "Retirer" }).click();
  await expect(view(page).getByRole("button", { name: "Ajouter un logo" })).toBeVisible();

  // Ouverte depuis la 3D, la présentation reste en 3D.
  await page.getByRole("button", { name: "Présenter" }).click();
  const presenter = page.getByRole("dialog", { name: "Présentation" });
  await expect(presenter.getByRole("button", { name: "Vue 3D (V)" })).toHaveAttribute("aria-pressed", "true");
  await expect(presenter.getByTestId("view-3d")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await expect(presenter.getByTestId("view-3d")).toHaveAttribute("data-objects", "11");
  await presenter.getByRole("button", { name: "Vue 3D (V)" }).click();
  await expect(presenter.getByTestId("view-3d")).toBeHidden();
  await page.keyboard.press("v");
  await expect(presenter.getByTestId("view-3d")).toBeVisible();
  await presenter.getByRole("button", { name: "Quitter la présentation" }).click();
  await expect(view(page)).toBeVisible();
});
