import { expect, test, type Page, type TestInfo } from "@playwright/test";

const PASSWORD = "motdepasse-test";
const RUN = Date.now();

/** Chaque test a son propre compte, donc ses propres données. */
async function login(page: Page, info: TestInfo, suffix = "") {
  // Horodaté : un faux serveur resté ouvert d'une exécution à l'autre ne mélange pas les données.
  const email = `e2e-${info.project.name}-${info.testId}-${RUN}${suffix}@example.com`;
  await page.goto("/fr/login");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Mes projets" })).toBeVisible();
}

async function newProject(page: Page) {
  await page.getByRole("button", { name: "Nouveau projet" }).click();
  await expect(page).toHaveURL(/\/fr\/app\/project\?id=/);
  await expect(page.getByTestId("editor-canvas").locator("canvas").first()).toBeVisible();
}

async function openPanel(page: Page) {
  const toggle = page.getByRole("button", { name: "Propriétés" });
  if (await toggle.isVisible()) await toggle.click();
}

async function closePanel(page: Page) {
  const close = page.getByRole("button", { name: "Fermer" });
  if (await close.isVisible()) await close.click();
}

const count = (page: Page) => page.getByTestId("object-count");
const saved = (page: Page) => expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

test("un projet est enregistré et repris après rechargement", async ({ page }, info) => {
  await login(page, info);
  await newProject(page);
  await expect(count(page)).toHaveText("Aucun objet");

  await openPanel(page);
  await page.getByRole("button", { name: "Placer Équipe A" }).click();
  await expect(count(page)).toHaveText("11 objets");
  await saved(page);

  const name = page.getByLabel("Nom du projet");
  await name.fill("Séance du mardi");
  await name.press("Enter");

  await page.reload();
  await expect(count(page)).toHaveText("11 objets");
  await expect(page.getByLabel("Nom du projet")).toHaveValue("Séance du mardi");

  await closePanel(page);
  await page.getByRole("link", { name: "Retour aux projets" }).click();
  await expect(page.getByRole("link", { name: "Séance du mardi" })).toBeVisible();
});

test("plusieurs tableaux, notes et suppression d'un tableau", async ({ page }, info) => {
  await login(page, info);
  await newProject(page);
  await openPanel(page);
  await page.getByRole("button", { name: "Placer Équipe A" }).click();
  await page.getByLabel("Notes").fill("Bloc médian, pressing au signal.");
  await closePanel(page);

  await page.getByRole("button", { name: "Ajouter un tableau" }).click();
  await expect(page.getByRole("tab", { name: "Tableau 2" })).toHaveAttribute("aria-selected", "true");
  await expect(count(page)).toHaveText("Aucun objet");

  await page.getByRole("tab", { name: "Tableau 1" }).click();
  await expect(count(page)).toHaveText("11 objets");
  await saved(page);

  await page.reload();
  await expect(page.getByRole("tab")).toHaveCount(2);
  await expect(count(page)).toHaveText("11 objets");
  await openPanel(page);
  await expect(page.getByLabel("Notes")).toHaveValue("Bloc médian, pressing au signal.");
  await closePanel(page);

  await page.getByRole("tab", { name: "Tableau 2" }).click();
  await page.getByRole("button", { name: "Supprimer le tableau" }).click();
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(count(page)).toHaveText("11 objets");
});

test("copier-coller entre deux tableaux", async ({ page }, info) => {
  await login(page, info);
  await newProject(page);
  await openPanel(page);
  await page.getByRole("button", { name: "Placer Équipe A" }).click();
  await closePanel(page);
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Control+c");
  await page.getByRole("button", { name: "Ajouter un tableau" }).click();
  await expect(count(page)).toHaveText("Aucun objet");
  await page.keyboard.press("Control+v");
  await expect(count(page)).toHaveText("11 objets");
});

test("restaurer une version puis annuler la restauration", async ({ page }, info) => {
  await login(page, info);
  await newProject(page);
  await openPanel(page);
  await page.getByRole("button", { name: "Placer Équipe A" }).click();
  await saved(page);

  await page.getByRole("button", { name: "Afficher les versions" }).click();
  await page.getByRole("button", { name: "Restaurer" }).first().click();
  // La version gardée à l'ouverture est le tableau vide.
  await expect(count(page)).toHaveText("Aucun objet");
  await closePanel(page);
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(count(page)).toHaveText("11 objets");
});

test("dossiers, étiquettes, recherche, favoris et corbeille", async ({ page }, info) => {
  await login(page, info);
  await newProject(page);
  await page.getByRole("link", { name: "Retour aux projets" }).click();
  await expect(page.getByTestId("project-list").getByRole("listitem")).toHaveCount(1);

  const menu = (name: string) => page.getByRole("button", { name: `Actions pour ${name}` });
  await menu("Projet sans titre").click();
  await page.getByRole("menuitem", { name: "Renommer" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("Coups de pied arrêtés");
  await page.getByRole("dialog").getByRole("button", { name: "Renommer" }).click();
  await expect(page.getByRole("link", { name: "Coups de pied arrêtés" })).toBeVisible();

  await menu("Coups de pied arrêtés").click();
  await page.getByRole("menuitem", { name: "Étiquettes" }).click();
  await page.getByRole("dialog").getByLabel("Étiquettes").fill("U15, corner");
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("corner", { exact: true })).toBeVisible();

  // Dossier : création, déplacement du projet, filtre.
  await page.getByRole("button", { name: "Nouveau dossier" }).click();
  await page.getByRole("dialog").getByLabel("Nom du dossier").fill("Saison 2026");
  await page.getByRole("dialog").getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Aucun projet ici pour l'instant")).toBeVisible();
  await page.getByRole("button", { name: "Tous les projets" }).click();
  await menu("Coups de pied arrêtés").click();
  await page.getByRole("menuitem", { name: "Déplacer dans un dossier" }).click();
  await page.getByRole("dialog").getByRole("combobox").selectOption({ label: "Saison 2026" });
  await page.getByRole("dialog").getByRole("button", { name: "Déplacer" }).click();
  await page.getByRole("button", { name: "Saison 2026", exact: true }).click();
  await expect(page.getByRole("link", { name: "Coups de pied arrêtés" })).toBeVisible();

  // Recherche par étiquette.
  await page.getByRole("searchbox").fill("corner");
  await expect(page.getByRole("heading", { name: /Résultats pour/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Coups de pied arrêtés" })).toBeVisible();
  await page.getByRole("searchbox").fill("introuvable");
  await expect(page.getByText("Aucun projet ne correspond")).toBeVisible();
  await page.getByRole("searchbox").fill("");

  // Favoris.
  await page.getByRole("button", { name: "Tous les projets" }).click();
  await page.getByRole("button", { name: "Ajouter aux favoris" }).click();
  await page.getByRole("button", { name: "Favoris", exact: true }).click();
  await expect(page.getByRole("link", { name: "Coups de pied arrêtés" })).toBeVisible();

  // Suppression du dossier : confirmation par saisie du nom, le projet part à la corbeille.
  await page.getByRole("button", { name: "Saison 2026", exact: true }).click();
  await page.getByRole("button", { name: "Supprimer le dossier" }).click();
  const confirm = page.getByRole("dialog").getByRole("button", { name: "Supprimer le dossier" });
  await expect(confirm).toBeDisabled();
  await page.getByRole("dialog").getByLabel("Nom du dossier").fill("Saison 2026");
  await confirm.click();
  await expect(page.getByText("Aucun projet ici pour l'instant")).toBeVisible();

  await page.getByRole("button", { name: "Corbeille" }).click();
  await expect(page.getByText("Effacé dans 30 jours")).toBeVisible();
  await page.getByRole("button", { name: "Restaurer" }).click();
  await expect(page.getByText("La corbeille est vide.")).toBeVisible();
  await page.getByRole("button", { name: "Tous les projets" }).click();
  await expect(page.getByRole("link", { name: "Coups de pied arrêtés" })).toBeVisible();
});

test("un modèle ouvre une copie", async ({ page }, info) => {
  await login(page, info);
  await newProject(page);
  await openPanel(page);
  await page.getByRole("button", { name: "Placer Équipe A" }).click();
  await saved(page);
  await closePanel(page);
  await page.getByRole("link", { name: "Retour aux projets" }).click();

  await page.getByRole("button", { name: "Actions pour Projet sans titre" }).click();
  await page.getByRole("menuitem", { name: "Enregistrer comme modèle" }).click();
  await page.getByRole("button", { name: "Modèles" }).click();
  await page.getByRole("button", { name: "Projet sans titre", exact: true }).click();
  await expect(page).toHaveURL(/\/fr\/app\/project\?id=/);
  await expect(count(page)).toHaveText("11 objets");
  await page.getByRole("link", { name: "Retour aux projets" }).click();
  // Le modèle reste dans « Modèles » ; l'original et la copie sont dans « Tous les projets ».
  await expect(page.getByTestId("project-list").getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Tous les projets" }).click();
  await expect(page.getByTestId("project-list").getByRole("listitem")).toHaveCount(2);
});

test("le projet d'un autre compte est introuvable", async ({ page, browser }, info) => {
  await login(page, info);
  await newProject(page);
  const url = page.url();

  const other = await (await browser.newContext()).newPage();
  await login(other, info, "-autre");
  await other.goto(url);
  await expect(other.getByRole("heading", { name: "Projet introuvable" })).toBeVisible();
  await other.goto("/fr/app/project?id=pas-un-identifiant");
  await expect(other.getByRole("heading", { name: "Projet introuvable" })).toBeVisible();
  await other.context().close();
});
