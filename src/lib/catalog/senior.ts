import { COLORS, DrillBuilder } from "./builder";
import { L, type CatalogDrill } from "./types";

/** U14 à seniors (foot à 11) : principes de jeu, intensité, exercices de référence du haut niveau. */

export const SENIOR_DRILLS: CatalogDrill[] = [
  {
    id: "sr-fifa-11plus",
    band: "senior",
    category: "warmup",
    procede: "exercise",
    title: L("Échauffement FIFA 11+", "FIFA 11+ warm-up"),
    source: L("Programme FIFA 11+ de prévention des blessures (FIFA Medical)", "FIFA 11+ injury prevention programme (FIFA Medical)"),
    tags: { fr: ["prévention", "échauffement", "gainage"], en: ["injury prevention", "warm-up", "core"] },
    sheet: {
      objective: L("Préparer le corps et réduire le risque de blessure (genou, cheville, ischio-jambiers).", "Prepare the body and reduce injury risk (knee, ankle, hamstrings)."),
      goal: L("Réaliser les trois parties du programme avec une technique parfaite.", "Complete the three parts of the programme with perfect technique."),
      instructions: L(
        "Partie 1 (8 min) : courses entre les plots – droit devant, ouverture et fermeture de hanche, autour du partenaire, épaule contre épaule, sprint avant-arrière.\nPartie 2 (10 min) : gainage, planche latérale, ischio-jambiers (nordiques), équilibre sur une jambe, squats, sauts.\nPartie 3 (2 min) : courses à travers le terrain, bonds, changements de direction.",
        "Part 1 (8 min): running between the cones – straight ahead, hip out/in, circling partner, shoulder contact, quick forwards and backwards.\nPart 2 (10 min): plank, side plank, Nordic hamstrings, single-leg balance, squats, jumping.\nPart 3 (2 min): running across the pitch, bounding, plant and cut.",
      ),
      duration: L("20 min, au moins deux fois par semaine", "20 min, at least twice a week"),
      players: L("Tout le groupe, par deux", "Whole squad, in pairs"),
      space: L("Deux lignes parallèles de 6 plots, 5 à 6 m d'écart, 30 m de long", "Two parallel lines of 6 cones, 5–6 m apart, 30 m long"),
      variables: L("Trois niveaux de difficulté par exercice (débutant, intermédiaire, avancé).", "Three difficulty levels for each exercise (beginner, intermediate, advanced)."),
      method: L("Démonstration de chaque exercice, puis correction de l'alignement genou-pied.", "Demonstrate each exercise, then correct knee–foot alignment."),
      behaviours: L("Genou au-dessus du pied (jamais vers l'intérieur), réceptions souples, dos droit.", "Knee over the foot (never caving in), soft landings, straight back."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      const xs = [5, 11, 17, 23, 29, 35];
      d.cones(xs.map((x) => [x, 12] as [number, number]), COLORS.orange, "cone");
      d.cones(xs.map((x) => [x, 18] as [number, number]), COLORS.orange, "cone");
      const pairs = [
        [3, 11],
        [3, 19],
        [1, 12.5],
        [1, 17.5],
      ].map(([x, y]) => d.player(0, x, y));
      d.line("run", [5, 11], [35, 11]);
      d.line("run", [35, 19], [5, 19], { curve: [20, 21] });
      d.text(20, 7, "1. Courses · 2. Force-équilibre · 3. Courses", 1.2);
      d.step(3, { [pairs[0]]: { x: 33, y: 11 }, [pairs[1]]: { x: 33, y: 19 } });
      d.step(3, { [pairs[2]]: { x: 31, y: 12.5 }, [pairs[3]]: { x: 31, y: 17.5 }, [pairs[0]]: { x: 37, y: 13, rot: 90 }, [pairs[1]]: { x: 37, y: 17, rot: 270 } });
      return d.scene();
    },
  },
  {
    id: "sr-rondo-5c2",
    band: "senior",
    category: "tactics",
    procede: "situation",
    title: L("Rondo 5 contre 2", "5 v 2 rondo"),
    source: L("Rondo du FC Barcelone (Cruyff, Guardiola)", "FC Barcelona rondo (Cruyff, Guardiola)"),
    tags: { fr: ["rondo", "conservation", "passe qui casse"], en: ["rondo", "possession", "line-breaking pass"] },
    sheet: {
      objective: L("Conserver sous pression, trouver la passe qui élimine les deux défenseurs.", "Keep the ball under pressure, find the pass that splits both defenders."),
      goal: L("Réussir une passe entre les deux défenseurs (point) ; 15 passes = 2 points.", "Pass between the two defenders (1 point); 15 passes = 2 points."),
      instructions: L(
        "Cinq joueurs autour du carré, deux défenseurs au centre. Deux touches. Le joueur fautif et celui qui a fait la passe ratée remplacent les défenseurs.",
        "Five players around the square, two defenders inside. Two touches. The player who loses it and the one who made the poor pass replace the defenders.",
      ),
      duration: L("5 × 2 min 30", "5 × 2 min 30"),
      players: L("7 par carré", "7 per square"),
      space: L("Carré de 12 × 12 m", "12 × 12 m square"),
      variables: L("Une touche. Défenseurs qui doivent tenir 60 s. Carré réduit à 10 m.", "One touch. Defenders must last 60 s. Square reduced to 10 m."),
      method: L("Exigence sur le rythme et la qualité de passe ; peu d'arrêts.", "Demand tempo and pass quality; few stoppages."),
      behaviours: L("Orientation du corps avant la réception, passe au pied opposé au défenseur, appuis qui bougent.", "Open body before receiving, pass to the foot away from the defender, supporting players keep moving."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      d.grid(14, 9, 12, 12, COLORS.yellow);
      const ring = [
        [20, 8.2, 90],
        [26.8, 12, 180],
        [26.8, 18.5, 180],
        [20, 21.8, 270],
        [13.2, 15, 0],
      ].map(([x, y, r]) => d.player(0, x, y, { rot: r }));
      const d1 = d.player(1, 18, 13.5);
      const d2 = d.player(1, 22, 16.5);
      const ball = d.ball(13.8, 15.6);
      d.step(0.8, { [ball]: { x: 19.6, y: 9 }, [d1]: { x: 18.5, y: 11.5, rot: 300 }, [d2]: { x: 21, y: 14, rot: 270 } });
      d.step(0.8, { [ball]: { x: 26, y: 12.4 }, [d1]: { x: 21, y: 11.5, rot: 0 } });
      d.step(0.8, { [ball]: { x: 20.4, y: 21 }, [ring[3]]: { x: 19, y: 21.8 } });
      return d.scene();
    },
  },
  {
    id: "sr-jeu-position",
    band: "senior",
    category: "tactics",
    procede: "situation",
    title: L("Jeu de position 4 + 3 contre 4", "Positional game 4 + 3 v 4"),
    source: L("Jeu de position (Juego de posición), méthode de Pep Guardiola", "Positional play (juego de posición), Pep Guardiola's method"),
    tags: { fr: ["jeu de position", "supériorité", "troisième homme"], en: ["positional play", "overload", "third man"] },
    sheet: {
      objective: L("Créer la supériorité numérique et trouver le joueur libre entre les lignes.", "Create numerical superiority and find the free player between the lines."),
      goal: L("Passer d'un joker de bout à l'autre (via le centre) = 1 point.", "Move the ball from one end neutral to the other (through the middle) = 1 point."),
      instructions: L(
        "Deux équipes de 4 et trois jokers (un à chaque extrémité, un au centre) qui jouent avec l'équipe en possession, soit 7 contre 4. Deux touches. À la perte, l'autre équipe devient attaquante.",
        "Two teams of 4 and three neutrals (one at each end, one in the middle) who play with the team in possession: 7 v 4. Two touches. On a turnover, the other team attacks.",
      ),
      duration: L("4 × 4 min", "4 × 4 min"),
      players: L("11 (4 + 4 + 3)", "11 (4 + 4 + 3)"),
      space: L("30 × 25 m", "30 × 25 m"),
      variables: L("Joker central en une touche. Point seulement après une passe au troisième homme.", "Central neutral one touch. Point only after a third-man pass."),
      method: L("Arrêts ciblés sur les distances entre joueurs et les appuis en losange.", "Targeted stops on distances between players and diamond-shaped support."),
      behaviours: L("Largeur et profondeur maximales, recevoir orienté, attirer pour libérer un partenaire.", "Maximum width and depth, receive open, draw a defender to free a teammate."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      d.grid(5, 2.5, 30, 25, COLORS.white);
      d.player(2, 4.2, 15, { rot: 0 });
      d.player(2, 20, 15, { rot: 0 });
      d.player(2, 35.8, 15, { rot: 180 });
      d.player(0, 12, 5);
      d.player(0, 28, 5);
      d.player(0, 12, 25);
      d.player(0, 28, 25);
      const b = [d.player(1, 13, 12), d.player(1, 13, 18), d.player(1, 25, 12), d.player(1, 25, 18)];
      const ball = d.ball(5, 15.6);
      d.line("pass", [6, 15], [11.5, 6], { curve: [7, 9] });
      d.line("pass", [12.5, 6], [19.5, 14.3]);
      d.line("pass", [20.5, 15.5], [34.8, 15.4]);
      d.step(0.9, { [ball]: { x: 11.6, y: 5.6 }, [b[0]]: { x: 12.5, y: 9 } });
      d.step(0.9, { [ball]: { x: 20.3, y: 15.6 }, [b[2]]: { x: 22, y: 13.5 }, [b[1]]: { x: 16, y: 16 } });
      d.step(1, { [ball]: { x: 35, y: 15.6 } });
      return d.scene();
    },
  },
  {
    id: "sr-contre-pressing",
    band: "senior",
    category: "tactics",
    procede: "situation",
    title: L("Contre-pressing : la règle des 5 secondes", "Counter-pressing: the 5-second rule"),
    source: L("Gegenpressing de Jürgen Klopp ; « règle des 5 secondes » de Guardiola", "Jürgen Klopp's gegenpressing; Guardiola's 5-second rule"),
    tags: { fr: ["pressing", "transition", "récupération"], en: ["pressing", "transition", "ball recovery"] },
    sheet: {
      objective: L("Récupérer le ballon dans les 5 secondes qui suivent la perte.", "Win the ball back within 5 seconds of losing it."),
      goal: L("Équipe en possession : 6 passes = 1 point. Équipe qui vient de perdre : récupération en moins de 5 s = 2 points.", "Team in possession: 6 passes = 1 point. Team that just lost it: regain within 5 s = 2 points."),
      instructions: L(
        "Conservation à 6 contre 6. Dès la perte, les trois joueurs les plus proches pressent le porteur et ferment les solutions de passe, les autres réduisent les espaces.",
        "6 v 6 possession. As soon as the ball is lost, the three nearest players press the ball and close passing lanes, the others compact the space.",
      ),
      duration: L("5 × 3 min, 1 min 30 de récupération", "5 × 3 min, 1 min 30 rest"),
      players: L("12 (6 contre 6)", "12 (6 v 6)"),
      space: L("40 × 30 m", "40 × 30 m"),
      variables: L("Zone réduite à 30 × 25 m. Récupération = attaque d'un mini-but.", "Area reduced to 30 × 25 m. Regain = attack a mini goal."),
      method: L("L'éducateur compte les 5 secondes à voix haute après chaque perte.", "The coach counts the 5 seconds out loud after each turnover."),
      behaviours: L("Réaction immédiate, pressing en bloc, couper la passe vers l'avant, agressivité contrôlée.", "Immediate reaction, press as a unit, cut the forward pass, controlled aggression."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      d.grid(0.5, 0.5, 39, 29, COLORS.white);
      const a = [d.player(0, 10, 8), d.player(0, 9, 22), d.player(0, 18, 15), d.player(0, 24, 7), d.player(0, 27, 22), d.player(0, 33, 14)];
      const b = [d.player(1, 15, 11), d.player(1, 14, 19), d.player(1, 21, 10), d.player(1, 23, 18), d.player(1, 30, 9), d.player(1, 30, 19)];
      const ball = d.ball(19.8, 15.6);
      d.text(20, 27.5, "Perte → 5 s pour récupérer", 1.3);
      d.step(0.8, { [ball]: { x: 22.6, y: 17.6 } });
      d.step(1.4, {
        [a[2]]: { x: 21.5, y: 16.5 },
        [a[4]]: { x: 24.5, y: 19.5 },
        [a[3]]: { x: 23.5, y: 12.5 },
        [a[5]]: { x: 29, y: 16 },
        [a[1]]: { x: 16, y: 21 },
        [b[3]]: { x: 23, y: 17.5 },
      });
      d.step(0.8, { [ball]: { x: 23.2, y: 15.4 }, [a[3]]: { x: 23, y: 14.5 } });
      return d.scene();
    },
  },
  {
    id: "sr-sortie-balle",
    band: "senior",
    category: "tactics",
    procede: "situation",
    title: L("Relance face au pressing", "Building out under pressure"),
    source: L("Construction depuis le gardien (relance courte)", "Building from the goalkeeper (short build-up)"),
    tags: { fr: ["relance", "construction", "pressing adverse"], en: ["build-up", "playing out", "opponent press"] },
    sheet: {
      objective: L("Ressortir proprement le ballon depuis le gardien face à un pressing haut.", "Play out cleanly from the goalkeeper against a high press."),
      goal: L("Franchir la ligne médiane en conduite ou par une passe à un joueur dans la zone cible.", "Cross the halfway line by dribbling or with a pass to a player in the target zone."),
      instructions: L(
        "Gardien + 4 défenseurs + 2 milieux contre 4 attaquants et 2 milieux. Le gardien relance court. Les attaquants qui récupèrent ont 8 secondes pour marquer.",
        "Goalkeeper + 4 defenders + 2 midfielders against 4 forwards and 2 midfielders. The goalkeeper plays short. Forwards who win the ball have 8 seconds to score.",
      ),
      duration: L("6 × 3 min", "6 × 3 min"),
      players: L("13 (7 contre 6)", "13 (7 v 6)"),
      space: L("Moitié de terrain", "Half pitch"),
      variables: L("Pressing à 5. Interdiction de jouer long. Milieu qui doit recevoir dos au jeu.", "Press with 5. No long balls. Midfielder must receive facing his own goal."),
      method: L("Montrer les angles de passe et les écarts entre défenseurs centraux.", "Show passing angles and the spacing between centre-backs."),
      behaviours: L("Défenseurs centraux qui s'écartent, latéraux hauts, milieu qui décroche entre les lignes, gardien utilisé comme joueur de plus.", "Centre-backs split wide, full-backs high, midfielder drops between the lines, keeper used as an extra player."),
    },
    build() {
      // Moitié droite du terrain : l'équipe bleue relance depuis son gardien et attaque vers la gauche.
      const d = new DrillBuilder("football", "half");
      const X = (x: number) => 105 - x;
      const B = { rot: 180 };
      const R = { rot: 0 };
      d.zone(52.5, 0, 4.5, 68, COLORS.green, 0.2);
      d.player(0, X(1.5), 34, { gk: true, n: "1", ...B });
      d.player(0, X(8), 24, { n: "4", ...B });
      d.player(0, X(8), 44, { n: "5", ...B });
      d.player(0, X(18), 6, { n: "3", ...B });
      d.player(0, X(18), 62, { n: "2", ...B });
      const cm = d.player(0, X(22), 30, { n: "6", ...B });
      d.player(0, X(26), 42, { n: "8", ...B });
      const f = [
        d.player(1, X(15), 26, { n: "9", ...R }),
        d.player(1, X(15), 42, { n: "10", ...R }),
        d.player(1, X(25), 12, { n: "11", ...R }),
        d.player(1, X(25), 56, { n: "7", ...R }),
      ];
      d.player(1, X(32), 30, { n: "6", ...R });
      d.player(1, X(32), 40, { n: "8", ...R });
      const ball = d.ball(X(3.2), 34.6);
      d.step(0.9, { [ball]: { x: X(8.6), y: 24.6 }, [f[0]]: { x: X(12), y: 25 } });
      d.step(1, { [ball]: { x: X(18), y: 7 }, [f[2]]: { x: X(21), y: 9 } });
      d.step(1.1, { [ball]: { x: X(22.6), y: 30.4 }, [cm]: { x: X(22), y: 29, rot: 180 } });
      d.step(1.6, { [cm]: { x: X(46), y: 30 }, [ball]: { x: X(47.8), y: 30.8, attach: cm } });
      return d.scene();
    },
  },
  {
    id: "sr-3c2-continu",
    band: "senior",
    category: "game",
    procede: "situation",
    title: L("3 contre 2 puis 2 contre 1 en continu", "Continuous 3 v 2 into 2 v 1"),
    source: L("Exercice de surnombre en continu, classique des centres de formation", "Continuous overload drill, an academy classic"),
    tags: { fr: ["surnombre", "transition", "finition"], en: ["overload", "transition", "finishing"] },
    sheet: {
      objective: L("Exploiter un surnombre vite et bien, puis défendre en infériorité.", "Exploit an overload quickly, then defend while outnumbered."),
      goal: L("Marquer en moins de 10 secondes.", "Score within 10 seconds."),
      instructions: L(
        "Trois attaquants contre deux défenseurs et un gardien. Après l'action, les deux défenseurs et l'un des attaquants repartent dans l'autre sens : 2 contre 1 face à un nouveau défenseur.",
        "Three attackers against two defenders and a goalkeeper. After the action, the two defenders and one attacker go the other way: 2 v 1 against a new defender.",
      ),
      duration: L("15 min", "15 min"),
      players: L("12 à 16 + 2 gardiens", "12 to 16 + 2 goalkeepers"),
      space: L("Deux tiers de terrain", "Two-thirds of the pitch"),
      variables: L("Défenseur supplémentaire qui revient après 3 s. Une seule touche dans la surface.", "Extra defender recovering after 3 s. One touch inside the box."),
      method: L("Rotation rapide, enchaînement sans temps mort.", "Fast rotation, no dead time."),
      behaviours: L("Porteur au centre qui fixe, appels larges, passe au moment où le défenseur s'engage.", "Central carrier commits, wide runs, pass when the defender commits."),
    },
    build() {
      const d = new DrillBuilder("football", "half");
      const gk = d.player(1, 104, 34, { gk: true, n: "G" });
      const a = [d.player(0, 62, 34), d.player(0, 64, 22), d.player(0, 64, 46)];
      const def = [d.player(1, 84, 28), d.player(1, 84, 40)];
      const ball = d.ball(63.8, 34.6);
      d.step(1.8, { [a[0]]: { x: 78, y: 34 }, [ball]: { x: 79.8, y: 34.8, attach: a[0] }, [a[1]]: { x: 82, y: 20 }, [a[2]]: { x: 82, y: 48 }, [def[0]]: { x: 82, y: 31 }, [def[1]]: { x: 82, y: 38 } });
      d.step(0.9, { [ball]: { x: 85.6, y: 47.6 }, [def[1]]: { x: 85, y: 42 }, [a[2]]: { x: 86, y: 47 } });
      d.step(0.8, { [ball]: { x: 105.3, y: 36.5 }, [gk]: { x: 104, y: 37, delay: 0.4 } });
      return d.scene();
    },
  },
  {
    id: "sr-debordement-centre",
    band: "senior",
    category: "finishing",
    procede: "exercise",
    title: L("Dédoublement et centre", "Overlap and cross"),
    source: L("Combinaison côté, ailier et latéral", "Wide combination between winger and full-back"),
    tags: { fr: ["dédoublement", "centre", "finition"], en: ["overlap", "crossing", "finishing"] },
    sheet: {
      objective: L("Créer le surnombre sur un côté par le dédoublement du latéral, puis finir sur centre.", "Create a wide overload with the full-back's overlap, then finish from the cross."),
      goal: L("Marquer sur le centre du latéral.", "Score from the full-back's cross."),
      instructions: L(
        "Le milieu sert l'ailier, qui rentre intérieur en conduite. Le latéral dédouble à l'extérieur, reçoit et centre. Deux attaquants et un milieu attaquent le premier poteau, le second poteau et le point de penalty.",
        "The midfielder feeds the winger, who drives inside. The full-back overlaps outside, receives and crosses. Two strikers and a midfielder attack the near post, far post and penalty spot.",
      ),
      duration: L("15 min, alterner les côtés", "15 min, alternate sides"),
      players: L("8 à 10 + 1 gardien", "8 to 10 + a goalkeeper"),
      space: L("Moitié de terrain", "Half pitch"),
      variables: L("Deux défenseurs dans la surface. Choix libre : centre ou retrait.", "Two defenders in the box. Free choice: cross or cut-back."),
      method: L("Insister sur le moment du dédoublement (quand l'ailier attire le défenseur).", "Focus on the timing of the overlap (when the winger draws the defender)."),
      behaviours: L("Ailier qui fixe à l'intérieur, latéral qui ne ralentit pas, trois zones de la surface occupées.", "Winger commits inside, full-back keeps running, three zones of the box filled."),
    },
    build() {
      const d = new DrillBuilder("football", "half");
      const gk = d.player(1, 104, 34, { gk: true, n: "G" });
      d.player(0, 62, 26, { n: "8" });
      const wing = d.player(0, 74, 8, { n: "11" });
      const fb = d.player(0, 64, 4, { n: "3" });
      const s1 = d.player(0, 84, 28, { n: "9" });
      const s2 = d.player(0, 82, 40, { n: "10" });
      const ball = d.ball(63.8, 26.6);
      d.line("dribble", [76, 8.5], [84, 14]);
      d.line("run", [65, 4], [92, 4], { curve: [78, 1.5] });
      d.step(1, { [ball]: { x: 73.6, y: 8.6 } });
      d.step(1.6, { [wing]: { x: 83, y: 13 }, [ball]: { x: 84.8, y: 13.8, attach: wing }, [fb]: { x: 86, y: 4, curve: [76, 1.5] } });
      d.step(0.9, { [ball]: { x: 91.6, y: 5.6 }, [fb]: { x: 91, y: 4.5 } });
      d.step(1.2, { [ball]: { x: 99.6, y: 38.6, arc: 3 }, [s1]: { x: 99, y: 30, curve: [94, 26] }, [s2]: { x: 99, y: 38, curve: [93, 42] } });
      d.step(0.6, { [ball]: { x: 105.3, y: 35.5 }, [gk]: { x: 104, y: 32 } });
      return d.scene();
    },
  },
  {
    id: "sr-attaque-defense",
    band: "senior",
    category: "game",
    procede: "game",
    title: L("Attaque contre défense 6 contre 4 + contre-attaque", "6 v 4 attack v defence with counter-attack"),
    source: L("Jeu d'attaque placée contre bloc défensif", "Positional attack against a defensive block"),
    tags: { fr: ["attaque placée", "bloc défensif", "contre-attaque"], en: ["positional attack", "defensive block", "counter-attack"] },
    sheet: {
      objective: L("Attaquer un bloc organisé ; pour la défense, rester compacte et contre-attaquer.", "Break down an organised block; for the defence, stay compact and counter."),
      goal: L("Attaquants : marquer dans le grand but. Défenseurs : récupérer et marquer dans l'un des deux mini-buts à la ligne médiane.", "Attackers: score in the big goal. Defenders: win the ball and score in one of the two mini goals on the halfway line."),
      instructions: L(
        "Six attaquants (2 milieux, 2 ailiers, 2 attaquants) contre quatre défenseurs et un gardien. Chaque action démarre du milieu. Les défenseurs qui récupèrent contre-attaquent vers les mini-buts.",
        "Six attackers (2 midfielders, 2 wingers, 2 strikers) against four defenders and a goalkeeper. Each attack starts from midfield. Defenders who win the ball counter towards the mini goals.",
      ),
      duration: L("4 × 6 min", "4 × 6 min"),
      players: L("11 (6 contre 4 + gardien)", "11 (6 v 4 + goalkeeper)"),
      space: L("Moitié de terrain", "Half pitch"),
      variables: L("Ajouter un milieu défensif (6 contre 5). Attaque en moins de 15 s.", "Add a holding midfielder (6 v 5). Attack within 15 s."),
      method: L("Observer, arrêter sur les décalages et les déplacements de la ligne défensive.", "Observe, stop on overloads and defensive line movement."),
      behaviours: L("Attaque : largeur, jeu entre les lignes, changements d'aile. Défense : coulissement, couverture, sortir ensemble.", "Attack: width, play between the lines, switches. Defence: shift across, cover, step up together."),
    },
    build() {
      const d = new DrillBuilder("football", "half");
      d.player(1, 104, 34, { gk: true, n: "G" });
      d.eq("minigoal", 52.5, 14, { rot: 180 });
      d.eq("minigoal", 52.5, 54, { rot: 180 });
      const att = [
        d.player(0, 60, 28, { n: "6" }),
        d.player(0, 62, 42, { n: "8" }),
        d.player(0, 76, 8, { n: "11" }),
        d.player(0, 76, 60, { n: "7" }),
        d.player(0, 84, 30, { n: "9" }),
        d.player(0, 82, 40, { n: "10" }),
      ];
      const def = [d.player(1, 90, 14, { n: "2" }), d.player(1, 92, 28, { n: "4" }), d.player(1, 92, 40, { n: "5" }), d.player(1, 90, 54, { n: "3" })];
      const ball = d.ball(61.8, 28.6);
      d.step(1, { [ball]: { x: 81.6, y: 40.6 }, [def[2]]: { x: 88, y: 39 } });
      d.step(1, { [ball]: { x: 75.6, y: 59.6 }, [def[3]]: { x: 84, y: 55 }, [def[2]]: { x: 90, y: 44 }, [def[1]]: { x: 92, y: 34 }, [def[0]]: { x: 92, y: 22 } });
      d.step(1.6, { [att[3]]: { x: 92, y: 60 }, [ball]: { x: 93.8, y: 60.8, attach: att[3] }, [att[4]]: { x: 98, y: 30 } });
      return d.scene();
    },
  },
  {
    id: "sr-corner",
    band: "senior",
    category: "setPieces",
    procede: "exercise",
    title: L("Corner : déviation au premier poteau", "Corner: near-post flick-on"),
    source: L("Combinaison de coup de pied de coin", "Corner kick routine"),
    tags: { fr: ["corner", "coup de pied arrêté", "déviation"], en: ["corner", "set piece", "flick-on"] },
    sheet: {
      objective: L("Automatiser une combinaison de corner avec appels croisés.", "Automate a corner routine with crossed runs."),
      goal: L("Marquer sur la déviation au second poteau.", "Score from the flick-on at the far post."),
      instructions: L(
        "Corner rentrant au premier poteau. Le joueur 1 attaque le premier poteau et dévie de la tête. Les joueurs 2 et 3 partent du point de penalty et croisent vers le second poteau. Le joueur 4 reste en retrait pour le second ballon.",
        "In-swinging corner to the near post. Player 1 attacks the near post and flicks it on. Players 2 and 3 start on the penalty spot and cross towards the far post. Player 4 stays on the edge for the second ball.",
      ),
      duration: L("15 min (10 répétitions de chaque côté)", "15 min (10 reps each side)"),
      players: L("4 attaquants + 1 tireur, défenseurs de zone, gardien", "4 attackers + a taker, zonal defenders, goalkeeper"),
      space: L("Surface de réparation", "Penalty area"),
      variables: L("Corner sortant au second poteau. Ajouter un écran sur le gardien.", "Out-swinging corner to the far post. Add a screen on the goalkeeper."),
      method: L("Rythme : un signal du tireur (bras levé) déclenche les courses.", "Timing: a signal from the taker (raised arm) triggers the runs."),
      behaviours: L("Courses tardives et explosives, attaquer le ballon au point le plus haut.", "Late, explosive runs, attack the ball at its highest point."),
    },
    build() {
      const d = new DrillBuilder("football", "half");
      const gk = d.player(1, 104, 34, { gk: true, n: "G" });
      d.player(0, 105.5, 0.5, { rot: 135 });
      const p1 = d.player(0, 92, 24, { n: "1" });
      const p2 = d.player(0, 93, 34, { n: "2" });
      const p3 = d.player(0, 92, 38, { n: "3" });
      d.player(0, 86, 30, { n: "4" });
      [
        [102, 28],
        [102, 34],
        [102, 40],
        [98, 30],
        [98, 38],
      ].forEach(([x, y]) => d.player(1, x, y));
      const ball = d.ball(104.6, 1);
      d.line("run", [92, 24.5], [100, 29.5], { curve: [97, 25] });
      d.line("run", [93, 34.5], [101, 41.5], { curve: [96, 38] });
      d.step(1.3, { [ball]: { x: 100.2, y: 29.6, arc: 4 }, [p1]: { x: 100, y: 29.5, curve: [97, 25] }, [p2]: { x: 97, y: 37 }, [p3]: { x: 99, y: 43 } });
      d.step(0.9, { [ball]: { x: 101.4, y: 41.4, arc: 1.2 }, [p2]: { x: 101, y: 41, curve: [99, 38] } });
      d.step(0.6, { [ball]: { x: 105.3, y: 38 }, [gk]: { x: 104, y: 36 } });
      return d.scene();
    },
  },
  {
    id: "sr-parcours-hoff",
    band: "senior",
    category: "physical",
    procede: "exercise",
    title: L("Parcours de Hoff (endurance avec ballon)", "Hoff track (aerobic dribbling circuit)"),
    source: L("Parcours de Hoff, étude Helgerud et Hoff (2001), intervalles 4 × 4 min", "Hoff track, Helgerud & Hoff study (2001), 4 × 4 min intervals"),
    tags: { fr: ["endurance", "VMA", "intermittent"], en: ["endurance", "aerobic", "intervals"] },
    sheet: {
      objective: L("Développer l'endurance aérobie (VO2max) en gardant le ballon.", "Develop aerobic capacity (VO2max) while keeping the ball."),
      goal: L("Faire le plus de tours en 4 minutes, à 90–95 % de la fréquence cardiaque maximale.", "Complete as many laps as possible in 4 minutes at 90–95% of maximum heart rate."),
      instructions: L(
        "Parcours en conduite : slalom entre les plots, saut de haies basses (ballon qui passe à côté), conduite en arrière sur la dernière ligne droite. 4 × 4 min, 3 min de récupération active entre les séries.",
        "Dribbling circuit: slalom through the cones, jump low hurdles (ball rolled beside), backwards dribble on the last straight. 4 × 4 min, 3 min active recovery between sets.",
      ),
      duration: L("4 × 4 min, 3 min de récupération", "4 × 4 min, 3 min recovery"),
      players: L("Tout le groupe, départs décalés", "Whole squad, staggered starts"),
      space: L("Circuit d'environ 290 m (ou version réduite 40 × 30 m)", "Circuit of about 290 m (or a reduced 40 × 30 m version)"),
      variables: L("Cardiofréquencemètre pour contrôler l'intensité. Version sans ballon en fin de saison.", "Heart-rate monitor to control intensity. No-ball version at the end of the season."),
      method: L("Expliquer l'objectif d'intensité ; prise de fréquence cardiaque à la fin de chaque série.", "Explain the intensity target; check heart rate at the end of each set."),
      behaviours: L("Rythme régulier, ballon maîtrisé même fatigué, posture droite.", "Steady pace, ball under control even when tired, upright posture."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      d.cones([[8, 5], [32, 5], [32, 25], [8, 25]], COLORS.red, "pole");
      d.cones([[12, 5], [15, 5], [18, 5], [21, 5], [24, 5], [27, 5]], COLORS.orange, "cone");
      d.eq("hurdle", 32, 11, { rot: 0 });
      d.eq("hurdle", 32, 15, { rot: 0 });
      d.eq("hurdle", 32, 19, { rot: 0 });
      d.line("dribble", [9, 6.5], [30.5, 6.5]);
      d.line("run", [33, 8], [33, 23]);
      d.line("dribble", [30, 26.5], [10, 26.5]);
      d.line("run", [6.5, 24], [6.5, 8]);
      d.text(20, 15, "4 × 4 min · 90–95 % FCmax", 1.5);
      const p = d.player(0, 8, 7.5);
      const ball = d.ball(9.9, 8.1);
      d.step(2.4, { [p]: { x: 30, y: 7.5 }, [ball]: { x: 31.9, y: 8.6, attach: p } });
      d.step(2.2, { [p]: { x: 33.5, y: 23, rot: 90 }, [ball]: { x: 35.4, y: 24.1, attach: p } });
      d.step(2.4, { [p]: { x: 11, y: 26.5, rot: 0 }, [ball]: { x: 12.9, y: 27.6, attach: p } });
      return d.scene();
    },
  },
];
