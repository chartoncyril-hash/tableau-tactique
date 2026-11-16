import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";

const PASSWORD = "motdepasse-test";
const RUN = Date.now();

const email = (info: TestInfo, who: string) => `e2e-${info.project.name}-${info.testId}-${RUN}-${who}@example.com`;

async function signIn(page: Page, address: string) {
  await page.getByLabel("Adresse e-mail").fill(address);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

async function login(page: Page, address: string) {
  await page.goto("/fr/login");
  await signIn(page, address);
  await expect(page.getByRole("heading", { name: "Mes projets" })).toBeVisible();
}

async function newPage(browser: Browser, info: TestInfo) {
  const context = await browser.newContext(info.project.use);
  return context.newPage();
}

const workspace = (page: Page) => page.getByTestId("workspace").filter({ visible: true });
const nav = (page: Page) => page.getByRole("navigation", { name: "Espace" }).filter({ visible: true });

/** Crée un club depuis le sélecteur d'espace ; on arrive sur la page du club. */
async function createClub(page: Page, name: string) {
  await workspace(page).selectOption({ label: "+ Créer un club…" });
  await page.getByRole("dialog", { name: "Créer un club" }).getByLabel("Nom du club").fill(name);
  await page.getByRole("dialog", { name: "Créer un club" }).getByRole("button", { name: "Créer" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

async function createInvite(page: Page, role: string, label: string) {
  await page.getByRole("combobox", { name: "Rôle", exact: true }).selectOption({ label: role });
  await page.getByLabel("Pour qui (facultatif)").fill(label);
  await page.getByRole("button", { name: "Créer le lien" }).click();
  const link = page.getByLabel(`Lien d'invitation : ${label}`);
  await expect(link).toBeVisible();
  return link.inputValue();
}

test("créer un club, inviter un entraîneur, travailler à deux puis passer en lecture seule", async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  const club = `FC Test ${RUN}`;
  await login(page, email(info, "admin"));
  await createClub(page, club);
  await expect(page.getByText("Votre rôle : Admin")).toBeVisible();
  await expect(page.getByTestId("member-list").getByRole("listitem")).toHaveCount(1);
  const link = await createInvite(page, "Entraîneur", "Bob");
  expect(link).toMatch(/\/fr\/invite\/[0-9a-f]{32}$/);

  // Un projet créé dans l'espace du club.
  await nav(page).getByRole("link", { name: "Projets" }).click();
  await expect(page.getByRole("heading", { name: "Mes projets" })).toBeVisible();
  await page.getByRole("button", { name: "Nouveau projet" }).click();
  await expect(page.getByTestId("editor-canvas").locator("canvas").first()).toBeVisible();
  await page.getByRole("textbox", { name: "Nom du projet" }).fill("Séance du club");
  await page.getByRole("textbox", { name: "Nom du projet" }).press("Enter");
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

  // Bob suit le lien, se connecte et revient sur l'invitation.
  const bob = await newPage(browser, info);
  await bob.goto(link);
  await expect(bob.getByRole("heading", { name: `Rejoindre ${club}` })).toBeVisible();
  await expect(bob.getByText("Vous êtes invité comme Entraîneur.")).toBeVisible();
  await bob.getByRole("link", { name: "Se connecter" }).click();
  await signIn(bob, email(info, "bob"));
  await expect(bob.getByRole("heading", { name: `Rejoindre ${club}` })).toBeVisible();
  await bob.getByRole("button", { name: `Rejoindre ${club}` }).click();

  // Bob voit le projet du club et peut le modifier.
  await expect(bob.getByRole("heading", { name: "Mes projets" })).toBeVisible();
  await expect(workspace(bob)).toHaveValue(/.+/);
  await bob.getByRole("link", { name: "Séance du club" }).click();
  await expect(bob.getByTestId("editor-canvas").locator("canvas").first()).toBeVisible();
  await expect(bob.getByRole("toolbar")).toBeVisible();
  await bob.getByRole("button", { name: "Joueur (P)" }).click();
  const canvas = bob.getByTestId("editor-canvas");
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 0.4, y: box.height * 0.5 } });
  await expect(bob.getByTestId("object-count")).toHaveText("1 objet");
  await expect(bob.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

  // Le lien a servi : il ne fonctionne plus pour quelqu'un d'autre.
  const carol = await newPage(browser, info);
  await carol.goto(link);
  await expect(carol.getByText(/déjà été utilisé/)).toBeVisible();

  // L'admin passe Bob en lecteur.
  await page.goto("/fr/app/club");
  const members = page.getByTestId("member-list");
  await expect(members.getByRole("listitem")).toHaveCount(2);
  await members.getByLabel(`Rôle de ${email(info, "bob")}`).selectOption({ label: "Lecteur" });
  await expect(members.getByLabel(`Rôle de ${email(info, "bob")}`)).toHaveValue("viewer");

  // Bob, désormais lecteur : le projet s'ouvre en lecture seule.
  await bob.goto("/fr/app");
  await expect(bob.getByText("Lecture seule dans ce club")).toBeVisible();
  await expect(bob.getByRole("button", { name: "Nouveau projet" })).toHaveCount(0);
  await bob.getByRole("link", { name: "Séance du club" }).click();
  await expect(bob.getByRole("note")).toContainText("Lecture seule");
  await expect(bob.getByRole("toolbar")).toBeHidden();
  await expect(bob.getByTestId("object-count")).toHaveText("1 objet");
  await bob.keyboard.press("Control+a");
  await bob.keyboard.press("Delete");
  await expect(bob.getByTestId("object-count")).toHaveText("1 objet");

  // L'admin ne peut pas se retirer son rôle s'il est le seul admin.
  await members.getByLabel(/Rôle de .*-admin@/).selectOption({ label: "Entraîneur" });
  await expect(page.getByText(/au moins un admin/)).toBeVisible();

  // Bob quitte le club : il revient à son espace personnel.
  await bob.goto("/fr/app/club");
  await bob.getByRole("button", { name: "Quitter le club" }).click();
  await bob.getByRole("button", { name: "Quitter le club" }).click();
  await expect(bob.getByRole("heading", { name: "Mes projets" })).toBeVisible();
  await expect(workspace(bob)).toHaveValue("");
  await expect(bob.getByRole("link", { name: "Séance du club" })).toHaveCount(0);
});

test("ranger un projet personnel dans le club, puis supprimer le club", async ({ page }, info) => {
  const club = `Club Rangement ${RUN}`;
  await login(page, email(info, "solo"));
  await page.getByRole("button", { name: "Nouveau projet" }).click();
  await expect(page.getByTestId("editor-canvas").locator("canvas").first()).toBeVisible();
  await page.getByRole("textbox", { name: "Nom du projet" }).fill("Projet perso");
  await page.getByRole("textbox", { name: "Nom du projet" }).press("Enter");
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
  await page.goto("/fr/app/club");
  await createClub(page, club);

  // Retour à l'espace personnel pour déplacer le projet vers le club.
  await workspace(page).selectOption({ label: "Mon espace personnel" });
  await expect(page).toHaveURL(/\/fr\/app$/);
  await page.getByRole("button", { name: "Actions pour Projet perso" }).click();
  await page.getByRole("menuitem", { name: "Changer d'espace" }).click();
  const dialog = page.getByRole("dialog", { name: "Changer d'espace" });
  await dialog.getByLabel("Changer d'espace").selectOption({ label: club });
  await dialog.getByRole("button", { name: "Déplacer" }).click();
  await expect(page.getByRole("link", { name: "Projet perso" })).toHaveCount(0);

  await workspace(page).selectOption({ label: `${club} · Admin` });
  await expect(page.getByRole("link", { name: "Projet perso" })).toBeVisible();

  // Supprimer le club efface ses projets.
  await nav(page).getByRole("link", { name: "Club" }).click();
  await page.getByRole("button", { name: "Supprimer le club" }).click();
  await page.getByLabel("Nom du club à confirmer").fill(club);
  await page.getByRole("button", { name: "Supprimer le club" }).click();
  await expect(page.getByRole("heading", { name: "Mes projets" })).toBeVisible();
  await expect(workspace(page)).toHaveValue("");
  await expect(page.getByRole("link", { name: "Projet perso" })).toHaveCount(0);
});
