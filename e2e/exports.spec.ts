import { readFile } from "node:fs/promises";
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

async function placeTeam(page: Page) {
  await withPanel(page, () => page.getByRole("button", { name: "Placer Équipe A" }).click());
  await expect(page.getByTestId("object-count")).toHaveText("11 objets");
}

async function animateTeam(page: Page) {
  await placeTeam(page);
  await page.getByRole("button", { name: "Ajouter une étape" }).click();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+a");
  for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowRight");
  await page.getByRole("spinbutton", { name: "Durée" }).fill("0.5");
}

const dialog = (page: Page) => page.getByRole("dialog", { name: "Exporter le tableau" });

async function exportAs(page: Page, format: string) {
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  await dialog(page).getByRole("radio", { name: new RegExp(`^${format}`) }).click();
  const download = page.waitForEvent("download", { timeout: 60_000 });
  await dialog(page).getByRole("button", { name: "Exporter", exact: true }).click();
  const file = await download;
  await expect(dialog(page).getByRole("status")).toContainText(`Fichier téléchargé : ${file.suggestedFilename()}`, { timeout: 60_000 });
  return { name: file.suggestedFilename(), bytes: await readFile((await file.path())!) };
}

test("exporter le tableau en PNG puis en SVG", async ({ page }) => {
  await openEditor(page);
  await placeTeam(page);

  const png = await exportAs(page, "Image PNG");
  expect(png.name).toBe("tableau.png");
  expect(png.bytes.subarray(1, 4).toString()).toBe("PNG");
  // Largeur standard : 1600 px.
  expect(png.bytes.readUInt32BE(16)).toBe(1600);
  await dialog(page).getByRole("button", { name: "Fermer" }).click();

  const svg = await exportAs(page, "Image SVG");
  expect(svg.name).toBe("tableau.svg");
  const text = svg.bytes.toString("utf8");
  expect(text.startsWith("<svg")).toBe(true);
  // Les onze joueurs, numérotés, sont des objets vectoriels.
  expect(text.match(/font-weight="bold"[^>]*>\d+<\/text>/g)?.length).toBe(11);
});

test("les formats animés demandent des étapes", async ({ page }) => {
  await openEditor(page);
  await placeTeam(page);
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  await expect(dialog(page).getByRole("radio", { name: /^Animation GIF/ })).toBeDisabled();
  await expect(dialog(page).getByRole("radio", { name: /^Vidéo/ })).toBeDisabled();
  await expect(dialog(page)).toContainText("Ajoutez des étapes d'animation");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
});

test("exporter l'animation en GIF et en vidéo", async ({ page }) => {
  test.setTimeout(120_000);
  await openEditor(page);
  await animateTeam(page);

  const gif = await exportAs(page, "Animation GIF");
  expect(gif.name).toBe("tableau.gif");
  expect(gif.bytes.subarray(0, 6).toString()).toBe("GIF89a");
  expect(gif.bytes.readUInt16LE(6)).toBe(640);
  await dialog(page).getByRole("button", { name: "Fermer" }).click();

  const video = await exportAs(page, "Vidéo");
  // MP4 si le navigateur encode le H.264, sinon WebM.
  expect(video.name).toMatch(/^tableau\.(mp4|webm)$/);
  if (video.name.endsWith(".mp4")) expect(video.bytes.subarray(4, 8).toString()).toBe("ftyp");
  else expect(video.bytes.readUInt32BE(0)).toBe(0x1a45dfa3);
  expect(video.bytes.length).toBeGreaterThan(5_000);
});

test("une image d'étape porte le numéro de l'étape", async ({ page }) => {
  await openEditor(page);
  await animateTeam(page);
  const png = await exportAs(page, "Image PNG");
  expect(png.name).toBe("etape-1.png");
});
