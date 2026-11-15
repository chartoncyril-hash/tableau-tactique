import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeNextPath("/fr/app")).toBe("/fr/app");
  });

  it("conserve la chaîne de requête", () => {
    expect(safeNextPath("/fr/app?tab=1")).toBe("/fr/app?tab=1");
  });

  it("retombe sur la valeur par défaut si la cible est absente", () => {
    expect(safeNextPath(null, "/fr/app")).toBe("/fr/app");
    expect(safeNextPath("", "/fr/app")).toBe("/fr/app");
  });

  it("refuse les URL absolues et les doubles barres", () => {
    expect(safeNextPath("https://exemple.com")).toBe("/");
    expect(safeNextPath("//exemple.com")).toBe("/");
    expect(safeNextPath("/\\exemple.com")).toBe("/");
  });

  it("refuse les caractères de contrôle", () => {
    expect(safeNextPath("/fr\n/app")).toBe("/");
  });
});
