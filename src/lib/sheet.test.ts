import { describe, expect, it } from "vitest";
import { cells, readDrillSheet, readSessionSheet } from "./sheet";

describe("fiches", () => {
  it("ignore les champs inconnus et les mauvais types", () => {
    expect(readSessionSheet({ theme: "Pressing", hack: "x", number: 3 })).toEqual({ theme: "Pressing" });
    expect(readSessionSheet(null)).toEqual({});
  });

  it("refuse un procédé ou un mode de schéma inconnu", () => {
    expect(readDrillSheet({ procede: "autre", diagrams: "tout", goal: "Marquer" })).toEqual({ goal: "Marquer" });
    expect(readDrillSheet({ procede: "situation", diagrams: "steps" })).toEqual({ procede: "situation", diagrams: "steps" });
  });

  it("découpe les principes en cases, quatre au plus", () => {
    expect(cells("Conserver / Progresser\nDéséquilibrer / Finir")).toEqual(["Conserver / Progresser", "Déséquilibrer / Finir"]);
    expect(cells("a | b | c | d | e")).toEqual(["a", "b", "c", "d"]);
    expect(cells(undefined)).toEqual([]);
  });
});
