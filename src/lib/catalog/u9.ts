import { COLORS, DrillBuilder } from "./builder";
import { L, type CatalogDrill } from "./types";

/** École de foot, U6 à U9 (foot à 5) : jeux courts, beaucoup de ballons, peu d'attente. */

const FFF = L("Jeu de l'école de foot (FFF)", "French FA grassroots game");

export const U9_DRILLS: CatalogDrill[] = [
  {
    id: "u9-demenageurs",
    band: "u9",
    category: "game",
    procede: "game",
    title: L("Les déménageurs", "The removal men"),
    source: FFF,
    tags: { fr: ["conduite", "prise d'info"], en: ["dribbling", "scanning"] },
    sheet: {
      objective: L("Conduire le ballon tête levée et prendre l'information.", "Dribble with the head up and scan the space."),
      goal: L("Ramener le plus de ballons possible dans son camp en 2 minutes.", "Bring as many balls as possible back to your base in 2 minutes."),
      instructions: L(
        "Ballons au centre. Au signal, chaque joueur va chercher un ballon et le ramène en conduite dans son camp. Un seul ballon à la fois. On peut aussi prendre les ballons du camp adverse (pas de défense dans les camps).",
        "Balls in the middle. On the signal, each player fetches one ball and dribbles it back to their base. One ball at a time. Balls may also be taken from the other base (no defending inside the bases).",
      ),
      duration: L("4 × 2 min, 1 min de récupération", "4 × 2 min, 1 min rest"),
      players: L("8 (4 contre 4)", "8 (4 v 4)"),
      space: L("30 × 20 m, deux camps de 8 × 12 m", "30 × 20 m, two 8 × 12 m bases"),
      variables: L(
        "Pied faible seulement. Ballons de couleurs qui rapportent des points différents. Ramener le ballon par une passe à un partenaire resté dans le camp.",
        "Weak foot only. Coloured balls worth different points. Bring the ball back with a pass to a teammate waiting in the base.",
      ),
      method: L("Laisser jouer, puis questionner : « Comment en ramener plus ? »", "Let them play, then ask: “How can you bring back more?”"),
      behaviours: L("Tête levée, ballon près du pied, changements de direction.", "Head up, ball close to the foot, changes of direction."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      d.zone(3, 6, 9, 18, COLORS.blue, 0.22);
      d.zone(28, 6, 9, 18, COLORS.red, 0.22);
      d.grid(3, 6, 9, 18, COLORS.blue);
      d.grid(28, 6, 9, 18, COLORS.red);
      const balls = [
        [18, 13],
        [22, 17],
        [20, 15],
        [19, 17.5],
        [21.5, 12.5],
        [17, 16],
        [23, 15],
        [20, 11],
      ].map(([x, y]) => d.ball(x, y));
      const blue = [8.5, 12.5, 17.5, 21.5].map((y) => d.player(0, 7.5, y));
      const red = [8.5, 12.5, 17.5, 21.5].map((y) => d.player(1, 32.5, y));
      d.step(1.6, {
        [blue[1]]: { x: 17, y: 13 },
        [blue[2]]: { x: 16, y: 16 },
        [red[1]]: { x: 23, y: 13 },
        [red[2]]: { x: 22, y: 17 },
      });
      d.step(2.2, {
        [blue[1]]: { x: 9, y: 12 },
        [balls[0]]: { x: 10.9, y: 13.1, attach: blue[1] },
        [blue[2]]: { x: 8, y: 17 },
        [balls[5]]: { x: 9.9, y: 18.1, attach: blue[2] },
        [red[1]]: { x: 31, y: 12 },
        [balls[4]]: { x: 32.9, y: 13.1, attach: red[1] },
        [red[2]]: { x: 31, y: 18 },
        [balls[1]]: { x: 32.9, y: 19.1, attach: red[2] },
      });
      return d.scene();
    },
  },
  {
    id: "u9-epervier",
    band: "u9",
    category: "technique",
    procede: "game",
    title: L("L'épervier", "The hawk"),
    source: FFF,
    tags: { fr: ["dribble", "protection"], en: ["dribbling", "shielding"] },
    sheet: {
      objective: L("Garder le ballon en conduite face à un adversaire, éliminer par le dribble.", "Keep the ball under pressure and beat a defender with a dribble."),
      goal: L("Traverser le couloir sans se faire prendre le ballon.", "Cross the corridor without losing the ball."),
      instructions: L(
        "Les joueurs partent tous ensemble d'une ligne, ballon au pied. L'épervier, au milieu, essaie de sortir les ballons du couloir. Un joueur qui perd son ballon devient épervier à son tour. Le dernier joueur avec son ballon gagne.",
        "All players start together from one line with a ball. The hawk in the middle tries to knock the balls out of the corridor. A player who loses the ball becomes a hawk too. The last player keeping a ball wins.",
      ),
      duration: L("6 à 8 manches", "6 to 8 rounds"),
      players: L("8 à 10", "8 to 10"),
      space: L("Couloir de 30 × 20 m", "30 × 20 m corridor"),
      variables: L("Deux éperviers au départ. Obligation d'utiliser une feinte apprise.", "Two hawks from the start. Must use a learned feint."),
      method: L("Démonstration d'une feinte simple (passement de jambe), puis jeu libre.", "Show one simple feint (step-over), then free play."),
      behaviours: L("Accélérer après la feinte, protéger avec le corps, regarder les espaces libres.", "Accelerate after the feint, shield with the body, look for free space."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      d.grid(5, 5, 30, 20, COLORS.yellow, true);
      const ys = [7.5, 12.5, 17.5, 22.5];
      const runners = ys.map((y) => d.player(0, 6.5, y));
      const balls = ys.map((y) => d.ball(8.6, y + 0.4));
      const hawk = d.player(1, 20, 15, { n: "É" });
      d.step(2.6, {
        ...Object.fromEntries(runners.map((id, i) => [id, { x: 33, y: ys[i] + (i === 1 ? 2 : 0) }])),
        ...Object.fromEntries(balls.map((id, i) => [id, { x: 34.9, y: ys[i] + 1.1, attach: runners[i] }])),
        [hawk]: { x: 22, y: 13 },
      });
      return d.scene();
    },
  },
  {
    id: "u9-slalom-relais",
    band: "u9",
    category: "technique",
    procede: "exercise",
    title: L("Relais slalom", "Slalom relay"),
    source: FFF,
    tags: { fr: ["conduite", "motricité"], en: ["dribbling", "coordination"] },
    sheet: {
      objective: L("Conduire le ballon des deux pieds en changeant de direction.", "Dribble with both feet while changing direction."),
      goal: L("Être la première équipe dont tous les joueurs ont fait l'aller-retour.", "First team whose players have all completed the out-and-back."),
      instructions: L(
        "Deux colonnes. Slalom entre les plots à l'aller, retour en ligne droite, puis on tape dans la main du suivant.",
        "Two lines. Slalom between the cones on the way out, straight line back, then high-five the next player.",
      ),
      duration: L("6 courses", "6 races"),
      players: L("6 à 10, en deux équipes", "6 to 10, in two teams"),
      space: L("20 × 15 m", "20 × 15 m"),
      variables: L("Intérieur du pied seulement, puis extérieur. Slalom à reculons, semelle.", "Inside of the foot only, then outside. Backwards slalom with the sole."),
      method: L("Compétition entre équipes ; corriger la position du ballon près du pied.", "Team competition; correct the ball position close to the foot."),
      behaviours: L("Petites touches, ballon proche, regard devant soi.", "Small touches, ball close, eyes up."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      for (const y of [10, 20]) d.cones([12, 15, 18, 21, 24, 27].map((x) => [x, y] as [number, number]), COLORS.orange, "cone");
      const a = d.player(0, 7, 10);
      d.player(0, 3.4, 10);
      d.player(0, -0.2, 10);
      const b = d.player(1, 7, 20, { rot: 0 });
      d.player(1, 3.4, 20, { rot: 0 });
      const ba = d.ball(9, 10.6);
      const bb = d.ball(9, 20.6);
      d.line("dribble", [9, 10], [28.5, 10], { curve: [19, 13] });
      d.step(2.4, {
        [a]: { x: 16.5, y: 11.5, curve: [12, 8.5] },
        [ba]: { x: 18.4, y: 12.6, attach: a },
        [b]: { x: 16.5, y: 21.5, curve: [12, 18.5] },
        [bb]: { x: 18.4, y: 22.6, attach: b },
      });
      d.step(2.4, {
        [a]: { x: 28.5, y: 10, curve: [22.5, 8.5] },
        [ba]: { x: 30.4, y: 11.1, attach: a },
        [b]: { x: 28.5, y: 20, curve: [22.5, 18.5] },
        [bb]: { x: 30.4, y: 21.1, attach: b },
      });
      return d.scene();
    },
  },
  {
    id: "u9-couleurs",
    band: "u9",
    category: "warmup",
    procede: "game",
    title: L("Le jeu des couleurs", "The colour game"),
    source: FFF,
    tags: { fr: ["échauffement", "réaction"], en: ["warm-up", "reaction"] },
    sheet: {
      objective: L("S'échauffer en conduite, réagir vite à un signal.", "Warm up with the ball and react quickly to a signal."),
      goal: L("Passer le plus vite possible par la porte de la couleur annoncée.", "Get through the gate of the called colour as fast as possible."),
      instructions: L(
        "Chacun conduit librement son ballon dans le carré. L'éducateur annonce une couleur : tous passent par une porte de cette couleur puis reviennent dans le carré.",
        "Everyone dribbles freely in the square. The coach calls a colour: all players go through a gate of that colour and come back into the square.",
      ),
      duration: L("8 min", "8 min"),
      players: L("8 à 12", "8 to 12"),
      space: L("Carré de 15 × 15 m, portes à 5 m", "15 × 15 m square, gates 5 m outside"),
      variables: L("Deux couleurs annoncées à enchaîner. Signal visuel (plot levé) au lieu de la voix.", "Two colours in a row. Visual signal (raised cone) instead of voice."),
      method: L("Jeu ludique, consignes courtes, beaucoup de répétitions.", "Playful, short instructions, many repetitions."),
      behaviours: L("Tête levée pour éviter les autres, changement de rythme après le signal.", "Head up to avoid others, change of pace after the signal."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      d.grid(12.5, 7.5, 15, 15, COLORS.white);
      const gate = (x: number, y: number, color: string, vertical: boolean) =>
        d.cones(vertical ? [[x, y - 1.2], [x, y + 1.2]] : [[x - 1.2, y], [x + 1.2, y]], color, "cone");
      gate(7, 15, COLORS.red, true);
      gate(33, 15, COLORS.blue, true);
      gate(20, 3, COLORS.yellow, false);
      gate(20, 27, COLORS.green, false);
      const spots = [
        [16, 11],
        [23, 12],
        [18, 18],
        [24, 19],
        [15, 16],
        [21, 14.5],
      ];
      const players = spots.map(([x, y]) => d.player(0, x, y, { rot: (x * 37) % 360 }));
      const balls = spots.map(([x, y]) => d.ball(x + 1.4, y + 0.6));
      d.step(2.2, {
        [players[0]]: { x: 6, y: 15, rot: 180 },
        [balls[0]]: { x: 4.4, y: 15.6, attach: players[0] },
        [players[4]]: { x: 5.5, y: 13.5, rot: 180 },
        [balls[4]]: { x: 3.9, y: 14.1, attach: players[4] },
        [players[2]]: { x: 8, y: 16.5, rot: 180 },
        [balls[2]]: { x: 6.4, y: 17.1, attach: players[2] },
      });
      return d.scene();
    },
  },
  {
    id: "u9-portes",
    band: "u9",
    category: "technique",
    procede: "exercise",
    title: L("Passes à travers les portes", "Passing through the gates"),
    source: FFF,
    tags: { fr: ["passe", "contrôle"], en: ["passing", "receiving"] },
    sheet: {
      objective: L("Passer et contrôler de l'intérieur du pied.", "Pass and receive with the inside of the foot."),
      goal: L("Réussir le plus de passes à travers des portes différentes en 1 minute.", "Complete as many passes through different gates as possible in 1 minute."),
      instructions: L(
        "Par deux avec un ballon. On marque un point en passant le ballon à travers une porte à son partenaire ; on change ensuite de porte. Deux paires ne peuvent pas utiliser la même porte en même temps.",
        "In pairs with one ball. Score a point by passing through a gate to your partner, then move to another gate. Two pairs cannot use the same gate at the same time.",
      ),
      duration: L("5 × 1 min", "5 × 1 min"),
      players: L("Par deux, 8 à 12 joueurs", "Pairs, 8 to 12 players"),
      space: L("25 × 20 m, 8 portes de 1,5 m", "25 × 20 m, 8 gates 1.5 m wide"),
      variables: L("Contrôle orienté obligatoire. Pied faible. Portes plus étroites.", "Directional first touch required. Weak foot. Narrower gates."),
      method: L("Démonstration de la passe intérieur du pied, puis défi par équipes.", "Demonstrate the inside-foot pass, then a pairs challenge."),
      behaviours: L("Pied d'appui à côté du ballon, cheville verrouillée, contrôle qui prépare la suite.", "Standing foot next to the ball, locked ankle, first touch that prepares the next action."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      d.grid(7.5, 5, 25, 20, COLORS.white);
      const gates: [number, number][] = [
        [12, 10],
        [20, 9],
        [28, 11],
        [14, 19],
        [22, 16],
        [27, 20],
      ];
      for (const [x, y] of gates) d.cones([[x, y - 0.75], [x, y + 0.75]], COLORS.orange, "cone");
      const a1 = d.player(0, 16, 15, { rot: 180 });
      const a2 = d.player(0, 8.5, 9.5);
      const b = d.ball(14.8, 14.8);
      const c1 = d.player(1, 18, 20, { rot: 0 });
      d.player(1, 31, 21.5, { rot: 180 });
      const cb = d.ball(19.8, 20.2);
      d.step(1.2, { [b]: { x: 9.9, y: 9.9 }, [cb]: { x: 29.6, y: 21.2 } });
      d.step(1.8, {
        [a1]: { x: 22.5, y: 12, rot: 270 },
        [a2]: { x: 17, y: 6.5, rot: 0 },
        [b]: { x: 18.6, y: 6.9, attach: a2 },
        [c1]: { x: 22, y: 21, rot: 0 },
      });
      d.step(1.2, { [b]: { x: 22.4, y: 11.4 } });
      return d.scene();
    },
  },
  {
    id: "u9-conduite-tir",
    band: "u9",
    category: "finishing",
    procede: "exercise",
    title: L("Conduite, slalom et tir", "Dribble, slalom and shoot"),
    source: FFF,
    tags: { fr: ["tir", "conduite"], en: ["shooting", "dribbling"] },
    sheet: {
      objective: L("Enchaîner une conduite et une frappe cadrée.", "Link a dribble with an accurate shot."),
      goal: L("Marquer face au gardien après le slalom.", "Score against the goalkeeper after the slalom."),
      instructions: L(
        "Départ en conduite entre les plots, frappe avant la ligne des 8 m. Le tireur va chercher son ballon et prend la place du gardien ; le gardien rejoint la colonne.",
        "Dribble through the cones, shoot before the 8 m line. The shooter collects the ball and becomes the goalkeeper; the goalkeeper joins the line.",
      ),
      duration: L("10 min", "10 min"),
      players: L("6 à 8, dont 1 gardien tournant", "6 to 8, rotating goalkeeper"),
      space: L("Demi-terrain de foot à 5", "Half of a 5-a-side pitch"),
      variables: L("Frappe du pied faible. Un défenseur passif. Frappe en une touche sur passe de l'éducateur.", "Weak-foot shot. One passive defender. First-time shot from the coach's pass."),
      method: L("Répétition, encouragements, valoriser les frappes cadrées.", "Repetition, encouragement, reward shots on target."),
      behaviours: L("Lever la tête avant de frapper, frappe du coup de pied, viser les côtés.", "Look up before shooting, strike with the laces, aim for the corners."),
    },
    build() {
      const d = new DrillBuilder("football5", "half");
      d.cones([[24, 12], [26.5, 14], [29, 12]], COLORS.orange, "cone");
      const gk = d.player(1, 39.3, 15, { gk: true, n: "G" });
      const p = d.player(0, 22, 14);
      d.player(0, 21, 17);
      d.player(0, 21, 20);
      const ball = d.ball(23.8, 14.4);
      d.step(2.4, { [p]: { x: 31, y: 14.5, curve: [26.5, 11] }, [ball]: { x: 32.6, y: 15.4, attach: p } });
      d.step(0.9, { [ball]: { x: 40.4, y: 16.6 }, [gk]: { x: 39.3, y: 16, delay: 0.3 } });
      return d.scene();
    },
  },
  {
    id: "u9-1c1-minibuts",
    band: "u9",
    category: "game",
    procede: "situation",
    title: L("1 contre 1 vers les mini-buts", "1 v 1 to mini goals"),
    source: FFF,
    tags: { fr: ["duel", "dribble"], en: ["duel", "dribbling"] },
    sheet: {
      objective: L("Oser le duel : éliminer son adversaire et marquer.", "Dare to take on a defender and score."),
      goal: L("Marquer dans l'un des deux mini-buts adverses.", "Score in either of the opponent's two mini goals."),
      instructions: L(
        "L'attaquant part avec le ballon, le défenseur sort de sa ligne. Si le défenseur récupère, il attaque à son tour les mini-buts opposés. 30 secondes maximum par duel.",
        "The attacker starts with the ball, the defender steps out from the goal line. If the defender wins the ball, they attack the opposite mini goals. 30 seconds per duel.",
      ),
      duration: L("10 à 12 min", "10 to 12 min"),
      players: L("2 colonnes de 3 ou 4", "Two lines of 3 or 4"),
      space: L("20 × 15 m, 2 mini-buts de chaque côté", "20 × 15 m, two mini goals at each end"),
      variables: L("Défenseur qui part avec 1 s de retard. But valable seulement après une feinte.", "Defender starts 1 s late. Goal counts only after a feint."),
      method: L("Compter les points par équipe, féliciter les tentatives de dribble.", "Keep team scores, praise dribbling attempts."),
      behaviours: L("Attaquer l'adversaire de face, provoquer, changer de rythme.", "Run straight at the defender, commit them, change pace."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      d.grid(10, 7.5, 20, 15, COLORS.white);
      d.eq("minigoal", 10, 11, { rot: 0 });
      d.eq("minigoal", 10, 19, { rot: 0 });
      d.eq("minigoal", 30, 11, { rot: 180 });
      d.eq("minigoal", 30, 19, { rot: 180 });
      const att = d.player(0, 12, 15);
      d.player(0, 8, 14);
      d.player(0, 8, 16.5);
      const def = d.player(1, 28, 15);
      d.player(1, 32, 14);
      d.player(1, 32, 16.5);
      const ball = d.ball(13.8, 15.4);
      d.step(1.6, { [att]: { x: 19, y: 15 }, [ball]: { x: 20.8, y: 15.6, attach: att }, [def]: { x: 23, y: 15 } });
      d.step(1.2, { [att]: { x: 23, y: 18.5, curve: [21, 13.5] }, [ball]: { x: 24.8, y: 19.2, attach: att }, [def]: { x: 22.5, y: 14 } });
      d.step(0.8, { [ball]: { x: 30.3, y: 19 } });
      return d.scene();
    },
  },
  {
    id: "u9-beret",
    band: "u9",
    category: "warmup",
    procede: "game",
    title: L("Le béret ballon", "Ball tag (béret)"),
    source: L("Jeu traditionnel adapté au football", "Traditional playground game adapted to football"),
    tags: { fr: ["réaction", "vitesse", "duel"], en: ["reaction", "speed", "duel"] },
    sheet: {
      objective: L("Réagir vite, gagner le duel pour le ballon.", "React quickly and win the race to the ball."),
      goal: L("Être le premier à marquer dans le mini-but adverse.", "Be first to score in the opponent's mini goal."),
      instructions: L(
        "Deux équipes alignées face à face, chaque joueur a un numéro. L'éducateur annonce un numéro : les deux joueurs concernés sprintent vers le ballon et s'affrontent en 1 contre 1.",
        "Two teams lined up facing each other, each player numbered. The coach calls a number: those two players sprint to the ball and play 1 v 1.",
      ),
      duration: L("10 min", "10 min"),
      players: L("2 équipes de 4 à 6", "2 teams of 4 to 6"),
      space: L("25 × 20 m", "25 × 20 m"),
      variables: L("Annoncer deux numéros (2 contre 2). Départ assis ou dos au ballon.", "Call two numbers (2 v 2). Start sitting or facing away."),
      method: L("Jeu compétitif, ambiance ludique ; changer souvent les numéros.", "Competitive and fun; change numbers often."),
      behaviours: L("Démarrage explosif, protéger le ballon dès qu'on le touche.", "Explosive start, shield the ball as soon as you get it."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      d.eq("minigoal", 6, 15, { rot: 0 });
      d.eq("minigoal", 34, 15, { rot: 180 });
      const blue = [12, 16, 20, 24, 28].map((x, i) => d.player(0, x, 5, { n: String(i + 1), rot: 90 }));
      const red = [28, 24, 20, 16, 12].map((x, i) => d.player(1, x, 25, { n: String(i + 1), rot: 270 }));
      const ball = d.ball(20, 15);
      d.text(20, 10.5, "« 3 ! »", 1.8);
      d.step(1.3, { [blue[2]]: { x: 19.2, y: 13.6 }, [red[2]]: { x: 21, y: 17.5 } });
      d.step(2, { [blue[2]]: { x: 31, y: 15, rot: 0 }, [ball]: { x: 32.6, y: 15.8, attach: blue[2] }, [red[2]]: { x: 28.5, y: 17 } });
      return d.scene();
    },
  },
  {
    id: "u9-foot3-minibuts",
    band: "u9",
    category: "game",
    procede: "game",
    title: L("Foot à 3 sur 4 mini-buts", "3 v 3 on four mini goals"),
    source: FFF,
    tags: { fr: ["jeu réduit", "orientation"], en: ["small-sided game", "orientation"] },
    sheet: {
      objective: L("Jouer vers l'avant et changer de côté quand un but est fermé.", "Play forward and switch when one goal is blocked."),
      goal: L("Marquer dans l'un des deux mini-buts adverses.", "Score in either of the opponent's two mini goals."),
      instructions: L("Match à 3 contre 3 sans gardien, rentrées de touche au pied. Rotation des équipes toutes les 3 minutes.", "3 v 3 without goalkeepers, kick-ins. Teams rotate every 3 minutes."),
      duration: L("4 × 3 min", "4 × 3 min"),
      players: L("6 (+ équipes en attente)", "6 (+ waiting teams)"),
      space: L("25 × 20 m", "25 × 20 m"),
      variables: L("But double après 3 passes. Un joueur de l'équipe en attente joue joker.", "Double goal after 3 passes. One waiting player acts as a joker."),
      method: L("Jeu libre, l'éducateur arbitre peu et questionne à la pause.", "Free play, the coach intervenes little and asks questions at the break."),
      behaviours: L("Écarter le jeu, regarder les deux buts, se démarquer après la passe.", "Spread out, look at both goals, move after passing."),
    },
    build() {
      const d = new DrillBuilder("football5", "blank");
      d.grid(7.5, 5, 25, 20, COLORS.white);
      d.eq("minigoal", 7.5, 9, { rot: 0 });
      d.eq("minigoal", 7.5, 21, { rot: 0 });
      d.eq("minigoal", 32.5, 9, { rot: 180 });
      d.eq("minigoal", 32.5, 21, { rot: 180 });
      const a = [d.player(0, 13, 15), d.player(0, 18, 9), d.player(0, 19, 21)];
      const b = [d.player(1, 24, 14), d.player(1, 27, 9), d.player(1, 22, 20)];
      const ball = d.ball(14.8, 15.4);
      d.step(1, { [ball]: { x: 18.6, y: 20.4 }, [b[0]]: { x: 23, y: 15.5 } });
      d.step(1.6, { [a[2]]: { x: 26, y: 21.5 }, [ball]: { x: 27.8, y: 22.1, attach: a[2] }, [b[2]]: { x: 26, y: 19 }, [b[1]]: { x: 28, y: 13 } });
      d.step(0.7, { [ball]: { x: 32.7, y: 21 } });
      return d.scene();
    },
  },
  {
    id: "u9-match-foot5",
    band: "u9",
    category: "game",
    procede: "game",
    title: L("Match de foot à 5 : jouer vers l'avant", "5-a-side match: play forward"),
    source: FFF,
    tags: { fr: ["match", "foot à 5"], en: ["match", "5-a-side"] },
    sheet: {
      objective: L("Retrouver les principes du jeu en match : avancer, aider, défendre ensemble.", "Apply basic principles in a match: go forward, support, defend together."),
      goal: L("Marquer plus de buts que l'adversaire.", "Score more goals than the opponent."),
      instructions: L(
        "Match à 5 contre 5 (gardiens compris) sur terrain de foot à 5. Relance du gardien à la main ou au pied ballon posé. Tout le monde joue autant.",
        "5 v 5 (goalkeepers included) on a 5-a-side pitch. Goalkeeper restarts by hand or with the ball on the ground. Equal playing time for all.",
      ),
      duration: L("3 × 8 min", "3 × 8 min"),
      players: L("10 (2 équipes de 5)", "10 (2 teams of 5)"),
      space: L("Terrain de foot à 5 (40 × 30 m)", "5-a-side pitch (40 × 30 m)"),
      variables: L("But compté double s'il suit une passe vers l'avant. Changement de gardien à chaque période.", "Goal counts double after a forward pass. Change goalkeeper every period."),
      method: L("L'éducateur observe et ne donne qu'une consigne à la mi-temps.", "The coach observes and gives one instruction at half-time."),
      behaviours: L("Ballon au sol, se rendre disponible, se replacer à la perte.", "Ball on the ground, make yourself available, recover when the ball is lost."),
    },
    build() {
      const d = new DrillBuilder("football5", "full");
      d.player(0, 1.5, 15, { gk: true, n: "1" });
      const a = [d.player(0, 10, 9, { n: "2" }), d.player(0, 10, 21, { n: "3" }), d.player(0, 18, 15, { n: "4" }), d.player(0, 25, 13, { n: "5" })];
      d.player(1, 38.5, 15, { gk: true, n: "1" });
      const b = [d.player(1, 30, 9, { n: "2" }), d.player(1, 30, 21, { n: "3" }), d.player(1, 22, 17, { n: "4" }), d.player(1, 15, 13, { n: "5" })];
      const ball = d.ball(3.3, 15.5);
      d.step(1, { [ball]: { x: 11.8, y: 20.4 } });
      d.step(1.6, { [a[1]]: { x: 17, y: 22 }, [ball]: { x: 18.8, y: 22.6, attach: a[1] }, [b[2]]: { x: 20, y: 20 }, [a[3]]: { x: 28, y: 18 } });
      d.step(1, { [ball]: { x: 27.6, y: 18.6 }, [b[1]]: { x: 29, y: 19.5 } });
      d.step(0.8, { [ball]: { x: 40.5, y: 16.4 } });
      return d.scene();
    },
  },
];
