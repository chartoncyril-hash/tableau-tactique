import { expect, test } from "@playwright/test";

test("la racine redirige vers la langue par défaut", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/(fr|en)$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("l'accueil s'affiche en français et en anglais", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(
    page.getByRole("heading", { level: 1, name: /tableau tactique/i }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Changer de langue" }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("le thème bascule entre clair et sombre", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/fr");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Changer de thème" }).click();
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(html).toHaveClass(/dark/);
});

test("le formulaire d'inscription est accessible depuis l'accueil", async ({ page }) => {
  await page.goto("/fr");
  await page.getByRole("link", { name: "Créer un compte gratuit" }).click();
  await expect(page).toHaveURL(/\/fr\/signup$/);
  await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
  await expect(page.getByLabel("Mot de passe")).toBeVisible();
});

test("l'espace personnel exige une connexion", async ({ page }) => {
  await page.goto("/fr/app");
  await expect(page).toHaveURL(/\/fr\/login$/);
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
});

test("une mauvaise connexion affiche une erreur", async ({ page }) => {
  await page.route("**/auth/v1/token**", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        code: 400,
        error_code: "invalid_credentials",
        msg: "Invalid login credentials",
      }),
    }),
  );
  await page.goto("/fr/login");
  await page.getByLabel("Adresse e-mail").fill("personne@example.com");
  await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(
    page.getByText("E-mail ou mot de passe incorrect."),
  ).toBeVisible();
});
