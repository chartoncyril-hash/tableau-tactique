import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";

const PASSWORD = "motdepasse-test";
const RUN = Date.now();
const email = (info: TestInfo, who: string) => `e2e-${info.project.name}-${info.testId}-${RUN}-${who}@example.com`;

async function signIn(page: Page, address: string) {
  await page.getByLabel("Adresse e-mail").fill(address);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

async function newPage(browser: Browser, info: TestInfo) {
  const context = await browser.newContext(info.project.use);
  return context.newPage();
}

const workspace = (page: Page) => page.getByTestId("workspace").filter({ visible: true });
const presence = (page: Page) => page.getByTestId("presence");
const count = (page: Page) => page.getByTestId("object-count");

/** Un club à deux entraîneurs et un projet commun, ouvert par les deux. */
async function twoCoaches(browser: Browser, page: Page, info: TestInfo) {
  await page.goto("/fr/login");
  await signIn(page, email(info, "alice"));
  await expect(page.getByRole("heading", { name: "Mes projets" })).toBeVisible();
  await workspace(page).selectOption({ label: "+ Créer un club…" });
  const dialog = page.getByRole("dialog", { name: "Créer un club" });
  await dialog.getByLabel("Nom du club").fill(`Club Collab ${RUN}`);
  await dialog.getByRole("button", { name: "Créer" }).click();
  await page.getByRole("button", { name: "Créer le lien" }).click();
  const link = await page.getByLabel(/^Lien d'invitation/).first().inputValue();

  await page.getByRole("navigation", { name: "Espace" }).filter({ visible: true }).getByRole("link", { name: "Projets" }).click();
  await page.getByRole("button", { name: "Nouveau projet" }).click();
  await expect(page.getByTestId("editor-canvas").locator("canvas").first()).toBeVisible();
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
  const projectUrl = page.url();

  const bob = await newPage(browser, info);
  await bob.goto(link);
  await bob.getByRole("link", { name: "Se connecter" }).click();
  await signIn(bob, email(info, "bob"));
  await bob.getByRole("button", { name: /^Rejoindre/ }).click();
  await expect(bob.getByRole("heading", { name: "Mes projets" })).toBeVisible();
  await bob.goto(projectUrl);
  await expect(bob.getByTestId("editor-canvas").locator("canvas").first()).toBeVisible();
  // Chacun voit l'autre.
  await expect(presence(page)).toHaveAttribute("data-count", "1", { timeout: 15_000 });
  await expect(presence(bob)).toHaveAttribute("data-count", "1", { timeout: 15_000 });
  return bob;
}

async function placePlayer(page: Page, fx: number, fy: number) {
  await page.getByRole("button", { name: "Joueur (P)" }).click();
  const canvas = page.getByTestId("editor-canvas");
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * fx, y: box.height * fy } });
  await page.getByRole("button", { name: "Sélection (V)" }).click();
}

test("deux entraîneurs modifient le même tableau en même temps", async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  const bob = await twoCoaches(browser, page, info);
  await expect(presence(page).getByLabel(/est sur ce tableau/)).toBeVisible();

  // Alice place un joueur : Bob le voit apparaître sans recharger.
  await placePlayer(page, 0.3, 0.5);
  await expect(count(page)).toHaveText("1 objet");
  await expect(count(bob)).toHaveText("1 objet", { timeout: 10_000 });

  // Bob en place un autre au même moment : les deux modifications se cumulent.
  await placePlayer(bob, 0.7, 0.5);
  await expect(count(bob)).toHaveText("2 objets");
  await expect(count(page)).toHaveText("2 objets", { timeout: 10_000 });

  // Annuler chez Alice n'efface que son propre joueur.
  await page.keyboard.press("Control+z");
  await expect(count(page)).toHaveText("1 objet");
  await expect(count(bob)).toHaveText("1 objet", { timeout: 10_000 });

  // Après rechargement, l'état commun est bien enregistré.
  await expect(bob.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
  await page.waitForTimeout(500);
  await page.reload();
  await expect(count(page)).toHaveText("1 objet");
});

test("commenter un tableau, répondre et résoudre, en direct", async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  const bob = await twoCoaches(browser, page, info);

  // Bob épingle un commentaire sur le tableau.
  await bob.getByRole("button", { name: "Commentaires" }).click();
  const panel = bob.getByRole("region", { name: "Commentaires du tableau" });
  await panel.getByLabel("Nouveau commentaire").fill("Resserrer le bloc ici");
  await panel.getByRole("button", { name: "Épingler sur le tableau" }).click();
  const canvas = bob.getByTestId("editor-canvas");
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.4 } });
  await expect(panel.getByText("Épinglé sur le tableau")).toBeVisible();
  await panel.getByRole("button", { name: "Publier" }).click();
  await expect(panel.getByTestId("comment-threads").getByRole("listitem")).toHaveCount(1);

  // Alice le voit arriver, répond et résout le fil.
  await page.getByRole("button", { name: "Commentaires" }).click();
  const alicePanel = page.getByRole("region", { name: "Commentaires du tableau" });
  const thread = alicePanel.getByRole("listitem", { name: /^Fil de/ });
  await expect(thread).toContainText("Resserrer le bloc ici", { timeout: 10_000 });
  await thread.getByRole("button", { name: "Répondre" }).click();
  await thread.getByLabel("Votre réponse").fill("D'accord, je modifie");
  await thread.getByRole("button", { name: "Envoyer" }).click();
  await expect(thread).toContainText("D'accord, je modifie");
  await expect(panel).toContainText("D'accord, je modifie", { timeout: 10_000 });
  await thread.getByRole("button", { name: "Résoudre" }).click();
  await expect(alicePanel.getByText("1 fil résolu")).toBeVisible();
  await expect(panel.getByText("1 fil résolu")).toBeVisible({ timeout: 10_000 });
});
