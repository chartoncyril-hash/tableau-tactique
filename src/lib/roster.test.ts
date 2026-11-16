import { describe, expect, it } from "vitest";
import { formationSlots } from "@/editor/scene/formations";
import { assignLineup, parseCsv, playersFromCsv, playersToCsv, readKit, sortPlayers, type PlayerRow } from "./roster";

let n = 0;
const player = (position: PlayerRow["position"], number = "", first = ""): PlayerRow => ({
  id: `p${++n}`,
  team_id: "t",
  first_name: first || `Joueur${n}`,
  last_name: "",
  number,
  position,
  foot: "",
  notes: "",
  photo_path: null,
});

describe("CSV", () => {
  it("lit le point-virgule, les guillemets et les retours à la ligne", () => {
    expect(parseCsv('a;b\r\n"x;y";"il dit ""oui"""\n\n1;2')).toEqual([
      ["a", "b"],
      ["x;y", 'il dit "oui"'],
      ["1", "2"],
    ]);
  });

  it("lit la virgule quand elle domine", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("reconnaît les colonnes françaises et anglaises et normalise les valeurs", () => {
    const players = playersFromCsv(
      "﻿N°;Prénom;Nom;Poste;Pied fort;Notes\n1;Lucas;Martin;Gardien;droit;Capitaine\n9;Inès;;att;gauche;\n;;;D;;",
    );
    expect(players).toEqual([
      { number: "1", first_name: "Lucas", last_name: "Martin", position: "G", foot: "right", notes: "Capitaine" },
      { number: "9", first_name: "Inès", last_name: "", position: "A", foot: "left", notes: "" },
    ]);
    expect(playersFromCsv("first name,last name,position\nAda,Byron,midfielder")[0]).toMatchObject({
      first_name: "Ada",
      position: "M",
    });
  });

  it("refuse un fichier sans colonne de nom", () => {
    expect(playersFromCsv("a;b\n1;2")).toEqual([]);
  });

  it("relit ce qu'il exporte", () => {
    const source = [
      { number: "10", first_name: "Zoé", last_name: "Durand; fils", position: "M" as const, foot: "both" as const, notes: 'dit "go"' },
    ];
    expect(playersFromCsv(playersToCsv(source))).toEqual(source);
  });
});

describe("effectif", () => {
  it("trie par poste puis par numéro", () => {
    const sorted = sortPlayers([player("A", "9"), player("G", "16"), player("D", "4"), player("G", "1"), player("", "2")]);
    expect(sorted.map((p) => `${p.position}${p.number}`)).toEqual(["G1", "G16", "D4", "A9", "2"]);
  });

  it("place chaque joueur à son poste dans la formation", () => {
    const slots = formationSlots("4-4-2", 0, "football", "horizontal");
    const squad = [
      player("A", "9"), player("A", "11"),
      ...["6", "8", "10", "7"].map((num) => player("M", num)),
      ...["2", "3", "4", "5"].map((num) => player("D", num)),
      player("G", "1"), player("G", "16"),
    ];
    const lineup = assignLineup(slots, squad);
    expect(lineup.map((p, i) => `${slots[i].role}:${p?.position}`)).toEqual(slots.map((s) => `${s.role}:${s.role}`));
    expect(lineup[0]?.number).toBe("1");
  });

  it("complète avec les autres joueurs sans mettre un joueur de champ au but", () => {
    const slots = formationSlots("4-3-3", 0, "football", "horizontal");
    const lineup = assignLineup(slots, [player("D", "2"), player("M", "8"), player("", "")]);
    expect(lineup[0]).toBeUndefined();
    expect(lineup.filter(Boolean)).toHaveLength(3);
  });

  it("corrige un maillot mal formé", () => {
    expect(readKit({ color: "rouge", pattern: "zigzag" })).toEqual({ color: "#1d4ed8", color2: undefined, pattern: "plain" });
    expect(readKit({ color: "#ff0000", color2: "#00ff00", pattern: "stripes" })).toMatchObject({ pattern: "stripes" });
  });
});
