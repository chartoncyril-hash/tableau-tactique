import { readFileSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const PASSWORD = "motdepasse-test";
const RUN = Date.now();

async function login(page: Page, info: TestInfo) {
  await page.goto("/fr/login");
  await page.getByLabel("Adresse e-mail").fill(`effectif-${info.project.name}-${info.testId}-${RUN}@example.com`);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Mes projets" })).toBeVisible();
}

const saved = (page: Page) => expect(page.getByTestId("team-save")).toHaveAttribute("data-state", "saved");

async function newTeam(page: Page) {
  await page.getByRole("navigation", { name: "Espace" }).filter({ visible: true }).getByRole("link", { name: "Effectifs" }).click();
  await expect(page.getByRole("heading", { name: "Effectifs" })).toBeVisible();
  await page.getByRole("button", { name: "Nouvelle équipe" }).click();
  await expect(page).toHaveURL(/\/fr\/app\/teams\/team\?id=/);
  await page.getByLabel("Nom de l'équipe").fill("U13 A");
  await page.getByLabel("Catégorie").fill("U13");
}

test("créer une équipe, importer, modifier, photographier, exporter", async ({ page }, info) => {
  await login(page, info);
  await newTeam(page);
  await page.getByLabel("Motif").selectOption("stripes");

  await page.getByLabel("Fichier CSV de l'effectif").setInputFiles("e2e/fixtures/effectif.csv");
  await expect(page.getByText("12 joueurs importés")).toBeVisible();
  const list = page.getByTestId("player-list").getByRole("listitem");
  await expect(list).toHaveCount(12);

  // Modification en place d'un joueur.
  const lina = page.getByRole("listitem", { name: "Lina Fournier" });
  await lina.getByLabel("Notes").fill("Rapide en profondeur");
  await lina.getByLabel("Pied fort").selectOption("left");

  // Ajout et suppression.
  await page.getByRole("button", { name: "Ajouter un joueur" }).click();
  await expect(list).toHaveCount(13);
  const unnamed = page.getByRole("listitem", { name: "Joueur sans nom" });
  await expect(unnamed.getByLabel("Numéro")).toHaveValue("17");
  await unnamed.getByRole("button", { name: "Supprimer Joueur sans nom" }).click();
  await unnamed.getByRole("button", { name: "Confirmer" }).click();
  await expect(list).toHaveCount(12);

  // Photo : envoyée, réduite puis affichée.
  await page.getByRole("listitem", { name: "Lucas Martin" }).getByLabel("Fichier photo de Lucas Martin").setInputFiles("e2e/fixtures/photo.png");
  await expect(page.getByRole("listitem", { name: "Lucas Martin" }).getByTestId("player-photo")).toBeVisible();
  await saved(page);

  await page.reload();
  await expect(list).toHaveCount(12);
  await expect(page.getByLabel("Nom de l'équipe")).toHaveValue("U13 A");
  await expect(page.getByLabel("Motif")).toHaveValue("stripes");
  await expect(page.getByRole("listitem", { name: "Lina Fournier" }).getByLabel("Notes")).toHaveValue("Rapide en profondeur");
  await expect(page.getByRole("listitem", { name: "Lucas Martin" }).getByTestId("player-photo")).toBeVisible();

  // Export : relisible, avec les modifications.
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exporter en CSV" }).click()]);
  const file = info.outputPath("effectif.csv");
  await download.saveAs(file);
  const text = readFileSync(file, "utf8");
  expect(text).toContain("numero;prenom;nom;poste;pied;notes");
  expect(text).toContain("11;Lina;Fournier;A;gauche;Rapide en profondeur");

  await page.getByRole("link", { name: "Retour aux effectifs" }).click();
  await expect(page.getByTestId("team-list").getByRole("link", { name: /U13 A/ })).toBeVisible();
});

test("un fichier sans colonne de nom est refusé", async ({ page }, info) => {
  await login(page, info);
  await newTeam(page);
  await page.getByLabel("Fichier CSV de l'effectif").setInputFiles({
    name: "vide.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("a;b\n1;2\n"),
  });
  // Le rôle « alert » est aussi porté par l'annonceur de page de Next : on vise le texte.
  await expect(page.getByText(/Aucun joueur reconnu/)).toBeVisible();
});

test("composer une équipe du tableau depuis l'effectif", async ({ page }, info) => {
  await login(page, info);
  await newTeam(page);
  await page.getByLabel("Fichier CSV de l'effectif").setInputFiles("e2e/fixtures/effectif.csv");
  await expect(page.getByText("12 joueurs importés")).toBeVisible();
  await saved(page);

  // On attend chaque page avant de cliquer : un clic pendant une navigation peut être ignoré.
  await page.getByRole("link", { name: "Retour aux effectifs" }).click();
  await expect(page.getByTestId("team-list")).toBeVisible();
  await page.getByRole("navigation", { name: "Espace" }).filter({ visible: true }).getByRole("link", { name: "Projets" }).click();
  await expect(page.getByRole("heading", { name: "Mes projets" })).toBeVisible();
  await page.getByRole("button", { name: "Nouveau projet" }).click();
  await expect(page.getByTestId("editor-canvas").locator("canvas").first()).toBeVisible();

  const toggle = page.getByRole("button", { name: "Propriétés" });
  if (await toggle.isVisible()) await toggle.click();
  const panel = page.getByRole("complementary", { name: "Propriétés" });
  await expect(panel.getByRole("combobox", { name: "Effectif", exact: true })).toHaveValue(/./);
  await panel.getByRole("button", { name: "Composer en 4-4-2" }).click();
  await expect(page.getByTestId("object-count")).toHaveText("11 objets");
  // L'équipe du tableau prend le nom et le maillot de l'effectif.
  await expect(panel.getByRole("textbox", { name: "Nom de l'équipe" }).first()).toHaveValue("U13 A");
  await expect(panel.getByRole("combobox", { name: "Motif du maillot" }).first()).toHaveValue("plain");
  await expect(page.getByTestId("save-state").filter({ visible: true })).toHaveAttribute("data-state", "saved");
  await page.reload();
  await expect(page.getByTestId("object-count")).toHaveText("11 objets");
});
