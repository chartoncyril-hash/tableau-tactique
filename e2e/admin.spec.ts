import { expect, test, type Page, type TestInfo } from "@playwright/test";

const RUN = Date.now();

async function login(page: Page, address: string) {
  await page.goto("/fr/login");
  await page.getByLabel("Adresse e-mail").fill(address);
  await page.getByLabel("Mot de passe").fill("motdepasse-test");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Mes projets" })).toBeVisible();
}

const nav = (page: Page) => page.getByRole("navigation", { name: "Espace" }).filter({ visible: true });
const who = (info: TestInfo, prefix: string) => `${prefix}e2e-${info.project.name}-${info.testId}-${RUN}@example.com`;

test("le tableau de bord n'est visible que de l'administrateur", async ({ page, browser }, info) => {
  await login(page, who(info, "admin-"));
  await nav(page).getByRole("link", { name: "Tableau de bord" }).click();
  await expect(page.getByRole("heading", { name: "Tableau de bord", level: 1 })).toBeVisible();
  const kpis = page.getByTestId("admin-kpis");
  await expect(kpis.getByText("Comptes", { exact: true })).toBeVisible();
  await expect(page.getByTestId("admin-users")).toContainText(who(info, "admin-"));
  await expect(page.getByRole("list", { name: "Inscriptions, 30 derniers jours" }).getByRole("listitem")).toHaveCount(30);

  // Un entraîneur ordinaire : pas d'onglet, et la page refuse l'accès.
  const other = await (await browser.newContext(info.project.use)).newPage();
  await login(other, who(info, "coach-"));
  await expect(nav(other).getByRole("link", { name: "Projets" })).toBeVisible();
  await expect(nav(other).getByRole("link", { name: "Tableau de bord" })).toHaveCount(0);
  await other.goto("/fr/app/admin");
  await expect(other.getByText("Cette page est réservée à l'administrateur de l'application.")).toBeVisible();
  await expect(other.getByTestId("admin-users")).toHaveCount(0);
});
