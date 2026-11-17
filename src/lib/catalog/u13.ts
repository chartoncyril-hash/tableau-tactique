import { COLORS, DrillBuilder } from "./builder";
import { L, type CatalogDrill } from "./types";

/** Préformation, U10 à U13 (foot à 8) : technique de passe, jeu à plusieurs, premiers principes. */

export const U13_DRILLS: CatalogDrill[] = [
  {
    id: "u13-losange",
    band: "u13",
    category: "warmup",
    procede: "exercise",
    title: L("Losange de passes", "Passing diamond"),
    source: L("Exercice classique d'échauffement technique", "Classic technical warm-up"),
    tags: { fr: ["passe", "contrôle orienté", "suivre sa passe"], en: ["passing", "directional touch", "follow your pass"] },
    sheet: {
      objective: L("Enchaîner passe, contrôle orienté et déplacement.", "Link pass, directional first touch and movement."),
      goal: L("Faire tourner le ballon sans erreur, le plus vite possible.", "Move the ball round with no mistakes, as fast as possible."),
      instructions: L(
        "Quatre plots en losange, deux joueurs au départ. On passe au joueur suivant et on suit sa passe pour prendre sa place. Changer de sens toutes les 2 minutes.",
        "Four cones in a diamond, two players at the start cone. Pass to the next player and follow your pass to take their place. Change direction every 2 minutes.",
      ),
      duration: L("10 min", "10 min"),
      players: L("5 à 6 par losange", "5 to 6 per diamond"),
      space: L("Losange de 10 à 12 m de côté", "Diamond with 10 to 12 m sides"),
      variables: L("Deux ballons en même temps. Passe en une touche. Une-deux avec le plot suivant.", "Two balls at once. One-touch passes. One-two with the next cone."),
      method: L("Démonstration, puis corrections individuelles brèves.", "Demonstration, then brief individual corrections."),
      behaviours: L("Appel avant de recevoir, contrôle du pied opposé vers le prochain partenaire, passe appuyée.", "Call for the ball, receive on the back foot towards the next player, firm pass."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      const A: [number, number] = [11, 15];
      const B: [number, number] = [20, 8];
      const C: [number, number] = [29, 15];
      const D: [number, number] = [20, 22];
      d.cones([A, B, C, D], COLORS.orange, "cone");
      const a = d.player(0, A[0] - 1.5, A[1]);
      d.player(0, A[0] - 4, A[1]);
      const b = d.player(0, B[0], B[1] - 1.5, { rot: 90 });
      const c = d.player(0, C[0] + 1.5, C[1], { rot: 180 });
      d.player(0, D[0], D[1] + 1.5, { rot: 270 });
      const ball = d.ball(A[0], A[1] + 0.3);
      d.line("pass", [A[0] + 0.5, A[1] - 0.5], [B[0] - 0.6, B[1] + 0.6]);
      d.line("run", [A[0] - 1, A[1] - 1.2], [B[0] - 2, B[1] - 1]);
      d.step(1, { [ball]: { x: B[0], y: B[1] - 0.2 } });
      d.step(1.4, { [a]: { x: B[0] - 1.5, y: B[1] - 1.5 }, [b]: { x: B[0] + 1, y: B[1] - 0.5, rot: 0 } });
      d.step(1, { [ball]: { x: C[0], y: C[1] } });
      d.step(1.4, { [b]: { x: C[0] - 1, y: C[1] - 1.5 }, [c]: { x: C[0] + 0.5, y: C[1] + 1, rot: 90 } });
      return d.scene();
    },
  },
  {
    id: "u13-rondo-4c1",
    band: "u13",
    category: "technique",
    procede: "situation",
    title: L("Rondo 4 contre 1", "4 v 1 rondo"),
    source: L("Rondo, popularisé par l'Ajax et le FC Barcelone (Johan Cruyff)", "Rondo, made famous by Ajax and FC Barcelona (Johan Cruyff)"),
    tags: { fr: ["conservation", "passe", "rondo"], en: ["possession", "passing", "rondo"] },
    sheet: {
      objective: L("Conserver le ballon sous pression avec des appuis et des passes rapides.", "Keep the ball under pressure with quick support and passes."),
      goal: L("Atteindre 10 passes de suite ; le défenseur doit toucher le ballon.", "Reach 10 passes in a row; the defender must touch the ball."),
      instructions: L(
        "Quatre joueurs sur les côtés du carré, un défenseur au centre. Deux touches maximum. Le joueur qui perd le ballon (ou fait une passe trop forte) passe au centre.",
        "Four players on the sides of the square, one defender inside. Two touches maximum. The player who loses the ball (or overhits the pass) goes in the middle.",
      ),
      duration: L("4 × 3 min", "4 × 3 min"),
      players: L("5 par carré", "5 per square"),
      space: L("Carré de 8 × 8 m à 10 × 10 m", "8 × 8 m to 10 × 10 m square"),
      variables: L("Une seule touche. Passe entre les jambes du défenseur = 2 points. 5 contre 2 sur 12 × 12 m.", "One touch only. Pass through the defender's legs = 2 points. 5 v 2 on 12 × 12 m."),
      method: L("Rythme élevé, l'éducateur compte les passes à voix haute.", "High tempo, the coach counts the passes out loud."),
      behaviours: L("Toujours deux solutions de passe, corps ouvert, passe dans le bon pied.", "Always two passing options, open body shape, pass to the correct foot."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      d.grid(15, 10, 10, 10, COLORS.yellow);
      d.player(0, 20, 9.2, { rot: 90 });
      d.player(0, 25.8, 15, { rot: 180 });
      d.player(0, 20, 20.8, { rot: 270 });
      const w = d.player(0, 14.2, 15, { rot: 0 });
      const def = d.player(1, 19, 14);
      const ball = d.ball(15.6, 15.6);
      d.step(0.8, { [ball]: { x: 19.6, y: 10 }, [def]: { x: 18, y: 12, rot: 300 } });
      d.step(0.8, { [ball]: { x: 25, y: 14.6 }, [def]: { x: 21.5, y: 12.5, rot: 0 }, [w]: { x: 14.2, y: 17 } });
      d.step(0.8, { [ball]: { x: 15, y: 16.8 }, [def]: { x: 21, y: 15.5, rot: 180 } });
      return d.scene();
    },
  },
  {
    id: "u13-passes-y",
    band: "u13",
    category: "technique",
    procede: "exercise",
    title: L("Circuit de passes en Y", "Y passing drill"),
    source: L("Circuit de passes de l'école de l'Ajax", "Ajax academy passing pattern"),
    tags: { fr: ["passe", "une-deux", "appel"], en: ["passing", "one-two", "movement"] },
    sheet: {
      objective: L("Répéter les combinaisons courtes (remise, passe en profondeur) avec précision et rythme.", "Repeat short combinations (lay-off, through pass) accurately and at tempo."),
      goal: L("Enchaîner le circuit sans que le ballon s'arrête.", "Complete the pattern without the ball stopping."),
      instructions: L(
        "A passe au joueur du centre, qui remet en une touche. A joue alors dans la course du joueur du côté gauche. Chacun suit sa passe. Alterner gauche et droite.",
        "A passes to the central player, who lays it off first time. A then plays into the run of the left-side player. Everyone follows their pass. Alternate left and right.",
      ),
      duration: L("12 min", "12 min"),
      players: L("6 à 8", "6 to 8"),
      space: L("15 × 12 m", "15 × 12 m"),
      variables: L("Ajouter un troisième homme. Contrôle orienté obligatoire au centre.", "Add a third-man run. Directional touch required in the middle."),
      method: L("Démonstration lente, puis rythme match.", "Slow demonstration, then match tempo."),
      behaviours: L("Communication (« remise ! »), passe dans la course, appels au bon moment.", "Communication (“set!”), pass into the run, well-timed movement."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      const S: [number, number] = [8, 15];
      const M: [number, number] = [18, 15];
      const Lp: [number, number] = [27, 9];
      const R: [number, number] = [27, 21];
      d.cones([S, M, Lp, R], COLORS.orange, "cone");
      const a = d.player(0, S[0] - 1.5, S[1]);
      d.player(0, S[0] - 4, S[1]);
      const m = d.player(0, M[0] + 1.2, M[1], { rot: 180 });
      const l = d.player(0, Lp[0], Lp[1] - 1.2, { rot: 180 });
      d.player(0, R[0], R[1] + 1.2, { rot: 180 });
      const ball = d.ball(S[0], S[1] + 0.3);
      d.line("pass", [S[0] + 0.6, S[1]], [M[0] - 0.4, M[1]]);
      d.line("pass", [M[0], M[1] + 0.6], [S[0] + 3, S[1] + 0.8], { curve: [13, 17] });
      d.line("pass", [S[0] + 3, S[1] + 0.4], [Lp[0] - 1, Lp[1] + 2]);
      d.line("run", [Lp[0], Lp[1] - 0.5], [Lp[0] - 3, Lp[1] + 3], { curve: [Lp[0] + 1, Lp[1] + 2] });
      d.step(0.9, { [ball]: { x: M[0], y: M[1] } });
      d.step(0.9, { [ball]: { x: S[0] + 3, y: S[1] + 0.8 }, [a]: { x: S[0] + 2, y: S[1] } });
      d.step(1.2, { [ball]: { x: Lp[0] - 2.5, y: Lp[1] + 3 }, [l]: { x: Lp[0] - 2.5, y: Lp[1] + 2, rot: 225, delay: 0 } });
      d.step(1.4, { [a]: { x: M[0] + 1.2, y: M[1], rot: 180 }, [m]: { x: Lp[0], y: Lp[1] - 1.2, rot: 180 } });
      return d.scene();
    },
  },
  {
    id: "u13-2c1",
    band: "u13",
    category: "tactics",
    procede: "situation",
    title: L("2 contre 1 vers le but", "2 v 1 to goal"),
    source: L("Situation de surnombre de base (FFF, préformation)", "Basic overload situation (French FA youth development)"),
    tags: { fr: ["surnombre", "fixer", "décaler"], en: ["overload", "commit the defender", "release"] },
    sheet: {
      objective: L("Fixer le défenseur puis décaler le partenaire au bon moment.", "Commit the defender then release the teammate at the right time."),
      goal: L("Marquer en moins de 8 secondes.", "Score within 8 seconds."),
      instructions: L(
        "Deux attaquants partent avec le ballon face à un défenseur et un gardien. Le porteur conduit vers le défenseur ; s'il est fermé, il passe à son partenaire. Le défenseur qui récupère marque dans un mini-but.",
        "Two attackers start with the ball against one defender and a goalkeeper. The ball carrier drives at the defender; if blocked, they pass to the partner. A defender who wins the ball can score in a mini goal.",
      ),
      duration: L("12 min", "12 min"),
      players: L("2 colonnes d'attaquants, 1 défenseur tournant, 1 gardien", "Two lines of attackers, rotating defender, goalkeeper"),
      space: L("Moitié de terrain de foot à 8", "Half of an 8-a-side pitch"),
      variables: L("Défenseur qui part derrière les attaquants (retour). 3 contre 2.", "Defender starts behind the attackers (recovery run). 3 v 2."),
      method: L("Arrêter le jeu sur une bonne action pour la montrer.", "Freeze play on a good action to show it."),
      behaviours: L("Porteur qui attaque l'intervalle, non-porteur à distance de passe et en avance.", "Carrier attacks the gap, partner within passing range and slightly ahead."),
    },
    build() {
      const d = new DrillBuilder("football8", "half");
      const gk = d.player(1, 64.3, 25, { gk: true, n: "G" });
      const a = d.player(0, 38, 21);
      const b = d.player(0, 38, 30);
      d.player(0, 34, 21);
      d.player(0, 34, 30);
      const def = d.player(1, 52, 25);
      d.eq("minigoal", 33, 12, { rot: 180 });
      d.eq("minigoal", 33, 38, { rot: 180 });
      const ball = d.ball(39.8, 21.6);
      d.step(1.6, { [a]: { x: 47, y: 23 }, [ball]: { x: 48.8, y: 23.8, attach: a }, [b]: { x: 47, y: 32 }, [def]: { x: 50, y: 24 } });
      d.step(0.9, { [ball]: { x: 51, y: 32.5 }, [def]: { x: 51, y: 26.5 }, [b]: { x: 50, y: 32 } });
      d.step(0.8, { [ball]: { x: 65.3, y: 26.6 }, [gk]: { x: 64.3, y: 27, delay: 0.4 } });
      return d.scene();
    },
  },
  {
    id: "u13-une-deux-frappe",
    band: "u13",
    category: "finishing",
    procede: "exercise",
    title: L("Une-deux et frappe", "One-two and shoot"),
    source: L("Exercice de finition classique", "Classic finishing exercise"),
    tags: { fr: ["une-deux", "frappe"], en: ["one-two", "shooting"] },
    sheet: {
      objective: L("Combiner avec un appui puis frapper en une ou deux touches.", "Combine with a target player, then shoot in one or two touches."),
      goal: L("Marquer après le une-deux.", "Score after the one-two."),
      instructions: L(
        "Le tireur passe à l'appui, déborde et reçoit la remise dans la course, puis frappe avant la surface. Rotation : tireur → appui → colonne.",
        "The shooter passes to the target player, runs past and receives the return in stride, then shoots before the box. Rotation: shooter → target → line.",
      ),
      duration: L("12 min (6 de chaque côté)", "12 min (6 each side)"),
      players: L("6 à 8 + 1 gardien", "6 to 8 + a goalkeeper"),
      space: L("Moitié de terrain de foot à 8", "Half of an 8-a-side pitch"),
      variables: L("Frappe en une touche. Défenseur passif sur l'appui. Côté gauche, pied gauche.", "First-time finish. Passive defender on the target. Left side, left foot."),
      method: L("Répétition ; corriger la qualité de la remise.", "Repetition; correct the quality of the lay-off."),
      behaviours: L("Passe appuyée, course qui accélère après la passe, frappe cadrée.", "Firm pass, accelerate after passing, shot on target."),
    },
    build() {
      const d = new DrillBuilder("football8", "half");
      const gk = d.player(1, 64.3, 25, { gk: true, n: "G" });
      const s = d.player(0, 38, 25);
      d.player(0, 35, 25);
      d.player(0, 48, 21, { rot: 180, role: "Appui" });
      d.eq("mannequin", 47, 24);
      const ball = d.ball(39.8, 25.4);
      d.line("pass", [40, 25], [47.4, 21.4]);
      d.line("run", [39, 26], [50, 27.5], { curve: [45, 28.5] });
      d.line("pass", [48.5, 21.8], [50.5, 27]);
      d.line("shot", [51, 27], [64.5, 24]);
      d.step(0.9, { [ball]: { x: 47.4, y: 21.4 } });
      d.step(1.2, { [s]: { x: 50, y: 27.2, curve: [45, 28.5] }, [ball]: { x: 51.6, y: 27.4, delay: 0.35, span: 0.65 } });
      d.step(0.8, { [ball]: { x: 65.3, y: 23.6 }, [gk]: { x: 64.3, y: 24, delay: 0.4 } });
      return d.scene();
    },
  },
  {
    id: "u13-conservation-jokers",
    band: "u13",
    category: "tactics",
    procede: "situation",
    title: L("Conservation 4 contre 4 + 2 jokers", "4 v 4 + 2 possession game"),
    source: L("Jeu de conservation avec appuis (méthode de jeu de position)", "Possession game with neutral players (positional play)"),
    tags: { fr: ["conservation", "largeur", "jokers"], en: ["possession", "width", "neutrals"] },
    sheet: {
      objective: L("Conserver en utilisant la largeur et les appuis.", "Keep possession using width and support players."),
      goal: L("8 passes de suite = 1 point.", "8 passes in a row = 1 point."),
      instructions: L(
        "Les deux jokers jouent avec l'équipe qui a le ballon, sur les côtés du terrain, en deux touches. À la perte, l'équipe doit récupérer le ballon tout de suite.",
        "The two neutrals play with the team in possession, on the sides of the area, with two touches. When the ball is lost, the team must try to win it back straight away.",
      ),
      duration: L("4 × 4 min", "4 × 4 min"),
      players: L("10 (4 contre 4 + 2)", "10 (4 v 4 + 2)"),
      space: L("30 × 20 m", "30 × 20 m"),
      variables: L("Jokers en une touche. Passe d'un joker à l'autre = 2 points.", "Neutrals one touch. Pass from one neutral to the other = 2 points."),
      method: L("Arrêts courts pour montrer les bons placements (triangles).", "Short stops to show good positioning (triangles)."),
      behaviours: L("Écarter, créer des triangles, demander le ballon dans les intervalles.", "Spread out, create triangles, ask for the ball between opponents."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      d.grid(5, 5, 30, 20, COLORS.white);
      d.player(2, 20, 4.2, { rot: 90 });
      d.player(2, 20, 25.8, { rot: 270 });
      const a = [d.player(0, 10, 10), d.player(0, 12, 20), d.player(0, 22, 13), d.player(0, 29, 19)];
      const b = [d.player(1, 15, 12), d.player(1, 19, 17), d.player(1, 26, 11), d.player(1, 25, 21)];
      const ball = d.ball(11.6, 10.6);
      d.step(0.9, { [ball]: { x: 19.6, y: 5 }, [b[0]]: { x: 16, y: 9 } });
      d.step(0.9, { [ball]: { x: 21.8, y: 12.6 }, [b[2]]: { x: 24, y: 12 } });
      d.step(1, { [ball]: { x: 28.6, y: 18.6 }, [b[3]]: { x: 27, y: 21.5 }, [a[1]]: { x: 17, y: 22 } });
      d.step(0.9, { [ball]: { x: 20, y: 25.2 } });
      return d.scene();
    },
  },
  {
    id: "u13-centre-tir",
    band: "u13",
    category: "finishing",
    procede: "exercise",
    title: L("Centre et reprise", "Cross and finish"),
    source: L("Exercice de finition sur centre", "Crossing and finishing exercise"),
    tags: { fr: ["centre", "reprise", "appels"], en: ["crossing", "finishing", "runs"] },
    sheet: {
      objective: L("Centrer en retrait ou au point de penalty, attaquer le premier et le second poteau.", "Cross to the penalty spot or cut back, attack near and far post."),
      goal: L("Marquer sur le centre.", "Score from the cross."),
      instructions: L(
        "Le latéral conduit le long de la ligne et centre. Deux attaquants croisent leurs courses : un au premier poteau, un au second. Alterner les côtés.",
        "The wide player dribbles down the line and crosses. Two strikers cross their runs: one to the near post, one to the far post. Alternate sides.",
      ),
      duration: L("15 min", "15 min"),
      players: L("6 à 9 + 1 gardien", "6 to 9 + a goalkeeper"),
      space: L("Moitié de terrain de foot à 8", "Half of an 8-a-side pitch"),
      variables: L("Un défenseur dans la surface. Centre en une touche sur passe du milieu.", "One defender in the box. First-time cross from a midfield pass."),
      method: L("Insister sur le timing des appels : partir tard, arriver vite.", "Insist on timing: start late, arrive fast."),
      behaviours: L("Regarder avant de centrer, appels croisés, reprise du plat du pied au premier poteau.", "Look before crossing, crossed runs, side-foot finish at the near post."),
    },
    build() {
      const d = new DrillBuilder("football8", "half");
      const gk = d.player(1, 64.3, 25, { gk: true, n: "G" });
      const wing = d.player(0, 50, 4);
      const s1 = d.player(0, 48, 28);
      const s2 = d.player(0, 46, 20);
      const ball = d.ball(51.8, 4.6);
      d.line("dribble", [52, 4.5], [61, 5]);
      d.line("run", [48, 27.5], [59, 22], { curve: [55, 28] });
      d.line("run", [46, 20.5], [57, 30], { curve: [53, 19] });
      d.step(1.8, { [wing]: { x: 60, y: 4.8 }, [ball]: { x: 61.8, y: 5.6, attach: wing }, [s1]: { x: 54, y: 27 }, [s2]: { x: 52, y: 21 } });
      d.step(1.2, { [ball]: { x: 57.5, y: 29.4, arc: 2.5 }, [s1]: { x: 59, y: 22.5, curve: [56, 27.5] }, [s2]: { x: 57, y: 29.5, curve: [55, 20] }, [gk]: { x: 63.6, y: 23 } });
      d.step(0.7, { [ball]: { x: 65.3, y: 26.5 } });
      return d.scene();
    },
  },
  {
    id: "u13-transition-3c3",
    band: "u13",
    category: "game",
    procede: "game",
    title: L("3 contre 3 avec transitions", "3 v 3 transition game"),
    source: L("Jeu réduit à effectif réduit (small-sided game)", "Small-sided game"),
    tags: { fr: ["transition", "contre-attaque", "jeu réduit"], en: ["transition", "counter-attack", "small-sided"] },
    sheet: {
      objective: L("Réagir vite à la récupération et à la perte du ballon.", "React quickly when the ball is won or lost."),
      goal: L("Marquer ; un but dans les 6 secondes après une récupération compte double.", "Score; a goal within 6 seconds of winning the ball counts double."),
      instructions: L(
        "Match à 3 contre 3 avec gardiens. Après chaque but, la même équipe garde le ballon et une nouvelle équipe défend. Les équipes en attente se tiennent derrière les buts.",
        "3 v 3 with goalkeepers. After each goal, the scoring team keeps the ball and a new team defends. Waiting teams stand behind the goals.",
      ),
      duration: L("6 × 2 min", "6 × 2 min"),
      players: L("3 équipes de 3 + 2 gardiens", "3 teams of 3 + 2 goalkeepers"),
      space: L("30 × 20 m, buts de foot à 5", "30 × 20 m, 5-a-side goals"),
      variables: L("Relance du gardien interdite au pied. Obligation de marquer en moins de 10 s.", "Goalkeeper cannot restart with the feet. Must score within 10 s."),
      method: L("Jeu à haute intensité, temps de récupération respectés.", "High-intensity game, respect rest periods."),
      behaviours: L("Première passe vers l'avant à la récupération, pressing immédiat à la perte.", "First pass forward when winning the ball, immediate pressure when losing it."),
    },
    build() {
      const d = new DrillBuilder("football5", "full");
      d.player(0, 1.5, 15, { gk: true, n: "G" });
      const gk2 = d.player(1, 38.5, 15, { gk: true, n: "G" });
      const a = [d.player(0, 12, 11), d.player(0, 14, 20), d.player(0, 22, 15)];
      const b = [d.player(1, 18, 12), d.player(1, 25, 18), d.player(1, 28, 10)];
      const ball = d.ball(19.6, 12.4);
      d.text(20, 27, "Récupération → but en 6 s = ×2", 1.3);
      d.step(0.8, { [a[0]]: { x: 18.5, y: 12.2 } });
      d.step(0.9, { [ball]: { x: 21.6, y: 15.6 }, [b[0]]: { x: 17, y: 13.5 } });
      d.step(1.4, { [a[2]]: { x: 30, y: 16 }, [ball]: { x: 31.8, y: 16.8, attach: a[2] }, [a[1]]: { x: 26, y: 22 }, [b[1]]: { x: 28, y: 18.5 } });
      d.step(0.7, { [ball]: { x: 40.4, y: 16.6 }, [gk2]: { x: 38.5, y: 16.2, delay: 0.3 } });
      return d.scene();
    },
  },
  {
    id: "u13-gardien",
    band: "u13",
    category: "goalkeeper",
    procede: "exercise",
    title: L("Gardien : prise de balle, plongeon et relance", "Goalkeeper: handling, diving and distribution"),
    source: L("Atelier spécifique gardien de but", "Goalkeeper-specific session"),
    tags: { fr: ["gardien", "plongeon", "relance"], en: ["goalkeeper", "diving", "distribution"] },
    sheet: {
      objective: L("Se placer, se replacer, plonger du bon côté et relancer vite.", "Set, recover position, dive to the correct side and distribute quickly."),
      goal: L("Arrêter les frappes des deux tireurs et relancer vers un plot cible.", "Save shots from both servers and distribute to a target cone."),
      instructions: L(
        "Le gardien touche le plot central, se place face au tireur 1 qui frappe à ras de terre. Après l'arrêt, il relance à la main vers la cible, puis enchaîne face au tireur 2.",
        "The keeper touches the central cone, sets facing server 1 who strikes low. After the save, they throw to the target, then face server 2.",
      ),
      duration: L("3 × 6 frappes par gardien", "3 × 6 shots per keeper"),
      players: L("2 gardiens + 2 tireurs", "2 keepers + 2 servers"),
      space: L("Surface de réparation", "Penalty area"),
      variables: L("Frappes à mi-hauteur. Relance au pied. Ajouter un centre aérien.", "Mid-height shots. Distribution with the feet. Add a high cross."),
      method: L("Correction technique immédiate (mains en W, chute latérale).", "Immediate technical feedback (W hand shape, side-on landing)."),
      behaviours: L("Appuis actifs avant la frappe, mains devant, chute sur le côté.", "Active feet before the shot, hands in front, land on the side."),
    },
    build() {
      const d = new DrillBuilder("football8", "box");
      const gk = d.player(1, 63.5, 25, { gk: true, n: "G" });
      d.eq("marker", 62.5, 25, { color: COLORS.yellow });
      d.player(0, 53, 19, { role: "1" });
      d.player(0, 53, 31, { role: "2" });
      d.eq("cone", 49, 8, { color: COLORS.blue });
      const ball = d.ball(54.6, 19.6);
      d.step(1, { [gk]: { x: 63.5, y: 23.5, rot: 200 } });
      d.step(0.8, { [ball]: { x: 64, y: 22.2 }, [gk]: { x: 64, y: 22, delay: 0.3, rot: 200 } });
      d.step(1, { [ball]: { x: 49.8, y: 8.6, arc: 2 } });
      return d.scene();
    },
  },
  {
    id: "u13-coordination",
    band: "u13",
    category: "physical",
    procede: "exercise",
    title: L("Coordination : échelle, haies et conduite", "Coordination: ladder, hurdles and dribble"),
    source: L("Circuit de coordination motrice", "Motor coordination circuit"),
    tags: { fr: ["coordination", "appuis", "vitesse"], en: ["coordination", "footwork", "speed"] },
    sheet: {
      objective: L("Améliorer les appuis, la fréquence et l'enchaînement avec le ballon.", "Improve footwork, frequency and linking with the ball."),
      goal: L("Enchaîner le parcours proprement, puis frapper dans le mini-but.", "Complete the course cleanly, then shoot into the mini goal."),
      instructions: L(
        "Échelle (un appui par case), trois haies basses pieds joints, réception d'une passe de l'éducateur, conduite et tir dans le mini-but. Retour en trottinant.",
        "Ladder (one foot per square), three low hurdles with feet together, receive a pass from the coach, dribble and shoot into the mini goal. Jog back.",
      ),
      duration: L("2 séries de 6 passages", "2 sets of 6 runs"),
      players: L("6 à 10", "6 to 10"),
      space: L("25 × 10 m", "25 × 10 m"),
      variables: L("Appuis latéraux dans l'échelle. Haies en pas chassés. Signal visuel pour la direction.", "Lateral steps in the ladder. Side-steps over the hurdles. Visual signal for direction."),
      method: L("Qualité avant vitesse ; récupération complète entre les passages.", "Quality before speed; full recovery between runs."),
      behaviours: L("Pointe de pied, bras actifs, regard devant, contrôle orienté vers le but.", "On the toes, active arms, eyes up, directional touch towards goal."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      d.eq("ladder", 11, 15);
      d.eq("hurdle", 17, 15, { rot: 90 });
      d.eq("hurdle", 19, 15, { rot: 90 });
      d.eq("hurdle", 21, 15, { rot: 90 });
      d.eq("minigoal", 34, 15, { rot: 180 });
      const p = d.player(0, 6, 15);
      d.player(0, 4, 15);
      d.player(0, 2, 15);
      d.player(2, 24, 22, { rot: 270, n: "É" });
      const ball = d.ball(24.5, 20.5);
      d.step(1.6, { [p]: { x: 14.5, y: 15 } });
      d.step(1.2, { [p]: { x: 23, y: 15 } });
      d.step(0.8, { [ball]: { x: 24.6, y: 15.6 } });
      d.step(1.3, { [p]: { x: 28, y: 15 }, [ball]: { x: 29.8, y: 15.8, attach: p } });
      d.step(0.6, { [ball]: { x: 34.3, y: 15.2 } });
      return d.scene();
    },
  },
];
