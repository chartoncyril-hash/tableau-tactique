import { describe, expect, it } from "vitest";
import { parseTags } from "./drills-api";

describe("étiquettes d'exercice", () => {
  it("découpe, nettoie et dédoublonne", () => {
    expect(parseTags(" pressing, U13 ,, pressing ")).toEqual(["pressing", "U13"]);
    expect(parseTags("")).toEqual([]);
  });
  it("limite le nombre et la longueur", () => {
    const many = Array.from({ length: 30 }, (_, i) => `t${i}`).join(",");
    expect(parseTags(many)).toHaveLength(20);
    expect(parseTags("x".repeat(50))[0]).toHaveLength(30);
  });
});
