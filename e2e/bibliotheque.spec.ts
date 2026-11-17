import { expect, test, type Page, type TestInfo } from "@playwright/test";

const PASSWORD = "motdepasse-test";

// Bibliothèque et présentation s'ouvrent depuis la barre de l'éditeur, masquées sur téléphone.
test.skip(({ isMobile }) => isMobile, "boutons réservés aux écrans larges");
const RUN = Date.now();

async function login(page: Page, info: TestInfo) {
  await page.goto("/fr/login");
  await page.getByLabel("Adresse e-mail").fill(`e2e-${info.project.name}-${info.testId}-${RUN}@example.com`);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Mes projets" })).toBeVisible();
}

async function newProjectWithTeam(page: Page) {
  await page.getByRole("button", { name: "Nouveau projet" }).click();
  await expect(page.getByTestId("editor-canvas").locator("canvas").first()).toBeVisible();
  const toggle = page.getByRole("button", { name: "Propriétés" });
  const mobile = await toggle.isVisible();
  if (mobile) await toggle.click();
  await page.getByRole("button", { name: "Placer Équipe A" }).click();
  if (mobile) await page.getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByTestId("object-count")).toHaveText("11 objets");
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
}

test("enregistrer un tableau dans la bibliothèque, le retrouver et le réutiliser", async ({ page }, info) => {
  await login(page, info);
  await newProjectWithTeam(page);

  // Enregistrer le tableau comme exercice.
  await page.getByRole("button", { name: "Bibliothèque d'exercices" }).click();
  const dialog = page.getByRole("dialog", { name: "Bibliothèque d'exercices" });
  await dialog.getByRole("tab", { name: "Enregistrer ce tableau" }).click();
  await dialog.getByLabel("Titre").fill("Pressing haut 4-4-2");
  await dialog.getByLabel("Catégorie").selectOption({ label: "Tactique" });
  await dialog.getByLabel("Étiquettes").fill("pressing, U13");
  await dialog.getByRole("button", { name: "Enregistrer dans la bibliothèque" }).click();
  await expect(dialog.getByRole("status")).toContainText("« Pressing haut 4-4-2 » est dans la bibliothèque.");
  await dialog.getByRole("button", { name: "Fermer" }).last().click();

  // L'insérer comme nouveau tableau du même projet.
  await page.getByRole("button", { name: "Bibliothèque d'exercices" }).click();
  await dialog.getByRole("radio", { name: "Ma bibliothèque" }).click();
  await dialog.getByRole("button", { name: "Insérer « Pressing haut 4-4-2 »" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("tab", { name: "Pressing haut 4-4-2" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("object-count")).toHaveText("11 objets");

  // La page Bibliothèque : filtre, recherche, aperçu, nouveau projet.
  await page.goto("/fr/app/library");
  await page.getByRole("tab", { name: "Mes exercices" }).click();
  const grid = page.getByTestId("drill-grid");
  await expect(grid.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("radiogroup", { name: "Catégorie" }).getByRole("radio", { name: "Échauffement" }).click();
  await expect(page.getByText("Aucun exercice ne correspond.")).toBeVisible();
  await page.getByRole("radiogroup", { name: "Catégorie" }).getByRole("radio", { name: "Tactique" }).click();
  await expect(grid.getByRole("listitem")).toHaveCount(1);
  await page.getByLabel("Rechercher un exercice").fill("press");
  await expect(grid.getByRole("listitem")).toHaveCount(1);
  await grid.getByRole("button").first().click();
  const preview = page.getByRole("dialog", { name: "Pressing haut 4-4-2" });
  await preview.getByRole("button", { name: "Créer un projet avec cet exercice" }).click();
  await expect(page).toHaveURL(/\/fr\/app\/project\?id=/);
  await expect(page.getByTestId("object-count")).toHaveText("11 objets");
  await expect(page.getByRole("textbox", { name: "Nom du projet" })).toHaveValue("Pressing haut 4-4-2");
});

test("exercices prêts à l'emploi : filtrer, prévisualiser, créer un projet, insérer et copier", async ({ page }, info) => {
  await login(page, info);
  await page.goto("/fr/app/library");
  const grid = page.getByTestId("catalog-grid");
  await expect(page.getByRole("tab", { name: /Prêts à l'emploi/ })).toHaveAttribute("aria-selected", "true");
  await expect(grid.getByRole("listitem")).toHaveCount(30);
  await page.getByRole("radiogroup", { name: "Tranche d'âge" }).getByRole("radio", { name: "U6-U9 · foot à 5" }).click();
  await expect(grid.getByRole("listitem")).toHaveCount(10);
  await page.getByRole("radiogroup", { name: "Tranche d'âge" }).getByRole("radio", { name: "Tous les âges" }).click();
  await page.getByLabel("Rechercher un exercice").fill("rondo");
  await expect(grid.getByRole("listitem")).toHaveCount(2);
  await grid.getByRole("button", { name: /Rondo 5 contre 2/ }).click();
  const preview = page.getByRole("dialog", { name: "Rondo 5 contre 2" });
  await expect(preview.getByText("Carré de 12 × 12 m")).toBeVisible();
  await expect(preview.getByText(/FC Barcelone/)).toBeVisible();

  // Copie dans sa bibliothèque, pour l'adapter.
  await preview.getByRole("button", { name: "Copier dans ma bibliothèque" }).click();
  await expect(page.getByRole("status")).toContainText("« Rondo 5 contre 2 » est dans votre bibliothèque");
  await page.getByRole("tab", { name: "Mes exercices" }).click();
  await expect(page.getByTestId("drill-grid").getByRole("listitem")).toHaveCount(1);

  // Nouveau projet à partir d'un exercice prêt à l'emploi : schéma animé et fiche remplie.
  await page.getByRole("tab", { name: /Prêts à l'emploi/ }).click();
  await page.getByLabel("Rechercher un exercice").fill("épervier");
  await grid.getByRole("button").first().click();
  await page.getByRole("dialog", { name: "L'épervier" }).getByRole("button", { name: "Créer un projet avec cet exercice" }).click();
  await expect(page).toHaveURL(/\/fr\/app\/project\?id=/);
  await expect(page.getByRole("textbox", { name: "Nom du projet" })).toHaveValue("L'épervier");
  await expect(page.getByTestId("timeline").getByRole("tab", { name: "Étape 1" })).toBeVisible();

  // Insérer un autre exercice comme nouveau tableau du projet.
  await page.getByRole("button", { name: "Bibliothèque d'exercices" }).click();
  const dialog = page.getByRole("dialog", { name: "Bibliothèque d'exercices" });
  await dialog.getByRole("radiogroup", { name: "Tranche d'âge" }).getByRole("radio", { name: "U14 à seniors · foot à 11" }).click();
  await dialog.getByRole("button", { name: "Insérer « Échauffement FIFA 11+ »" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("tab", { name: "Échauffement FIFA 11+" })).toHaveAttribute("aria-selected", "true");
});

test("présenter les tableaux en plein écran, dessiner puis quitter", async ({ page }, info) => {
  await login(page, info);
  await newProjectWithTeam(page);
  await page.getByRole("button", { name: "Ajouter un tableau" }).click();
  await expect(page.getByRole("tab", { name: "Tableau 2" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Présenter" }).click();
  const show = page.getByRole("dialog", { name: "Présentation" });
  await expect(show).toBeVisible();
  await expect(show.getByRole("heading")).toContainText("Tableau 2");
  await expect(show.getByRole("heading")).toContainText("2 / 2");

  await page.keyboard.press("ArrowLeft");
  await expect(show.getByRole("heading")).toContainText("1 / 2");
  await expect(show.getByRole("button", { name: "Tableau précédent" })).toBeDisabled();

  // Dessin à main levée, effacé au changement de tableau.
  await show.getByRole("button", { name: "Dessiner (D)" }).click();
  const ink = show.getByTestId("ink");
  const box = (await ink.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 6 });
  await page.mouse.up();
  await expect(ink).toHaveAttribute("data-strokes", "1");
  await show.getByRole("button", { name: "Effacer les dessins (X)" }).click();
  await expect(ink).toHaveAttribute("data-strokes", "0");

  await show.getByRole("button", { name: "Tableau suivant" }).click();
  await expect(show.getByRole("heading")).toContainText("2 / 2");
  await show.getByRole("button", { name: "Quitter la présentation" }).click();
  await expect(show).toBeHidden();
});
