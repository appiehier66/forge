// Ingebouwde (offline) coach: schema's, circuits, bijsturen en progressie.
import { EXERCISES } from "./data.js";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function allowedEq(location) {
  if (location === "bodyweight") return ["bodyweight"];
  if (location === "home") return ["bodyweight", "dumbbell", "kettlebell"];
  return ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell"];
}

// Te technisch of te zwaar voor beginners
const HARD = ["front_squat", "nordic", "hanging_raise", "pullup", "chinup", "dips", "deadlift", "bulgarian_bw", "decline_pushup"];
const GYM_NO_BW = ["borst", "benen", "billen", "hamstrings", "schouders", "triceps", "kuiten"];
const BW_HARD = ["pullup", "chinup", "dips", "nordic"];
const hardReps = (id) => (id === "nordic" ? { repsMin: 4, repsMax: 8 } : { repsMin: 5, repsMax: 10 });

function pool(profile, extra = []) {
  const eq = allowedEq(profile.location);
  const inj = profile.injuries || [];
  const ex = new Set(profile.exclude || []); // oefeningen die je "niet meer" wilt
  if (profile.location === "gym") ["door_row", "prone_y", "decline_pushup", "bulgarian_bw"].forEach((id) => ex.add(id)); // alleen voor de hotelkamer
  if (profile.level === "beginner") HARD.forEach((id) => ex.add(id));
  const gym = profile.location === "gym";
  return [...EXERCISES, ...extra].filter(
    (e) => !e.cardio && eq.includes(e.eq) && !e.avoid.some((a) => inj.includes(a)) && !ex.has(e.id)
      // in de sportschool geen push-ups of squats zonder gewicht als hoofdoefening (wel core en optrekken)
      && !(gym && !e.custom && e.eq === "bodyweight" && !e.timed && GYM_NO_BW.includes(e.muscle))
  );
}

// Cardio (fiets, loopband, ...) telt in minuten en km. Nooit in krachtslots of circuits, wel apart na je krachttraining.
export function cardioPool(profile, extra = []) {
  const eq = allowedEq(profile.location);
  const inj = profile.injuries || [];
  const ex = new Set(profile.exclude || []);
  return [...EXERCISES, ...extra].filter((e) => e.cardio && eq.includes(e.eq) && !(e.avoid || []).some((a) => inj.includes(a)) && !ex.has(e.id));
}
// Jouw cardio uit het profiel; kan die niet (blessure of "niet meer doen"), dan een alternatief.
function pickCardio(profile, extra = []) {
  const list = cardioPool(profile, extra);
  const want = [profile.cardioEx || "bike", ...(profile.cardioEx === "treadmill_run" ? ["treadmill_walk"] : []), "bike"];
  return want.map((id) => list.find((e) => e.id === id)).find(Boolean) || list.find((e) => e.eq === "machine") || list[0] || null;
}
const isCardio = (x, byId) => x.mins != null || !!byId(x.exId)?.cardio;

// ---------- Wat je fijn vindt ----------
// profile.prefer = oefeningen die je fijn vindt, profile.lessPreferred = die je minder vindt,
// profile.seenBefore = die je vandaag al met "Andere workout" wegtikte.
// Uit een lijst kandidaten: liefst je favorieten, dan een nieuwe, dan een die je eerder zag, pas als het niet anders kan de minder leuke.
// "Niet meer doen" (profile.exclude) zit al niet in de pool en gaat dus altijd voor.
function byLikes(profile) {
  const liked = new Set(profile?.prefer || []), less = new Set(profile?.lessPreferred || []), seen = new Set(profile?.seenBefore || []);
  const keep = new Set(profile?.keep || []); // favorieten die er nu staan: die blijven
  const group = (c) => {
    const kept = c.filter((e) => keep.has(e.id) && liked.has(e.id));
    if (kept.length) return kept;
    const fav = c.filter((e) => liked.has(e.id));
    if (fav.length) return fav;
    const fresh = c.filter((e) => !less.has(e.id) && !seen.has(e.id));
    if (fresh.length) return fresh;
    const ok = c.filter((e) => !less.has(e.id));
    return ok.length ? ok : c;
  };
  group.fav = (e) => liked.has(e.id);
  return group;
}
export const preferLiked = (profile, list) => byLikes(profile)(list);
// "Iets anders, graag": wat er nu staat (cur) liever niet nog eens, en wat je eerder al wegtikte (seen) ook liever niet.
// keepFav: favorieten die er nu staan, mogen blijven.
function avoidCurrent(profile, cur, seen = [], keepFav = true) {
  const liked = new Set(profile.prefer || []), favs = new Set(profile.fav ?? profile.prefer ?? []);
  const hard = cur.filter((id) => !(keepFav && favs.has(id)));
  const soft = seen.filter((id) => !cur.includes(id));
  const away = new Set([...hard, ...soft]);
  return { ...profile, prefer: [...liked].filter((id) => !away.has(id)), lessPreferred: [...new Set([...(profile.lessPreferred || []), ...hard])], seenBefore: soft, keep: keepFav ? cur.filter((id) => favs.has(id)) : [] };
}
const sameIds = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

// Vaste keuzelijsten: een row en een verticale trek (niet 2 rows), 2e benenoefening op een machine of op 1 been (niet 2x squat)
const ROWS = ["barbell_row", "db_row", "seated_row"];
const VERTICAL = ["lat_pulldown", "pullup", "chinup"];
const LEGS2 = ["leg_press", "bulgarian", "lunge", "goblet_squat", "split_squat_bw", "step_up"];
// Dagtemplates: lijst slots { m: spiergroep(en), k: compound|isolation }
const T = {
  fullA: [["benen", "c"], ["borst", "c"], ["rug", "c"], ["hamstrings", "c"], ["schouders", "i"], ["biceps", "i"], ["triceps", "i"], ["core", "i"]],
  fullB: [["hamstrings", "c"], ["schouders", "c"], ["rug", "c"], ["benen", "c"], ["borst", "i"], ["triceps", "i"], ["core", "i"], ["biceps", "i"]],
  fullC: [["benen", "c"], ["rug", "c"], ["borst", "c"], ["billen", "c"], ["schouders", "i"], ["triceps", "i"], ["kuiten", "i"], ["core", "i"], ["biceps", "i"]],
  upper: [["borst", "c"], ["rug", "c", ROWS], ["rug", "c", VERTICAL], ["borst", "i"], ["schouders", "i", ["lateral_raise", "cable_lateral"]], ["triceps", "i"], ["biceps", "i"], ["schouders", "c"]],
  lower: [["benen", "c"], ["hamstrings", "c"], ["benen", "c", LEGS2], ["billen", "c"], ["hamstrings", "i"], ["kuiten", "i"], ["benen", "i", ["leg_ext"]], ["core", "i"]],
  push: [["borst", "c"], ["schouders", "c"], ["borst", "c"], ["schouders", "i", ["lateral_raise", "cable_lateral"]], ["triceps", "i"], ["triceps", "i"], ["borst", "i"]],
  pull: [["rug", "c", VERTICAL], ["rug", "c", ROWS], ["schouders", "i", ["face_pull", "rear_delt"]], ["biceps", "i"], ["rug", "c"], ["biceps", "i"], ["core", "i"]],
  legs: [["benen", "c"], ["hamstrings", "c"], ["benen", "c", LEGS2], ["billen", "c"], ["hamstrings", "i"], ["kuiten", "i"], ["benen", "i", ["leg_ext"]], ["core", "i"]],
  // Voorkant: borst, voorkant schouders, triceps, quadriceps, buik
  front: [["benen", "c"], ["borst", "c"], ["schouders", "c", ["ohp", "db_shoulder", "pike_pushup"]], ["benen", "c", LEGS2], ["borst", "i"], ["triceps", "i"], ["schouders", "i", ["lateral_raise", "cable_lateral"]], ["core", "i"]],
  // Achterkant: rug, achterkant schouders, biceps, hamstrings, billen, kuiten
  back: [["hamstrings", "c"], ["rug", "c", ROWS], ["rug", "c", VERTICAL], ["billen", "c"], ["hamstrings", "i"], ["biceps", "i"], ["schouders", "i", ["rear_delt", "face_pull"]], ["kuiten", "i"]],
};

export const SPLITS = {
  auto: "Automatisch",
  fullbody: "Full body",
  voorachter: "Voorkant / achterkant",
  bovenonder: "Boven / onder",
  ppl: "Push / pull / legs",
};

// Herhaal een cyclus dagtypes over het aantal dagen; letters A/B/C per herhaling.
// Elke dag krijgt een "variant" zodat A en B andere oefeningen krijgen.
function cycle(days, types) {
  const count = {}, seen = {};
  for (let i = 0; i < days; i++) { const n = types[i % types.length][0]; count[n] = (count[n] || 0) + 1; }
  return Array.from({ length: Math.max(1, days) }, (_, i) => {
    const [name, tpl] = types[i % types.length];
    const v = (seen[name] = (seen[name] || 0) + 1) - 1;
    return [count[name] > 1 ? `${name} ${"ABCDEF"[v]}` : name, tpl, v];
  });
}

function splitFor(days, split = "auto") {
  if (split === "fullbody") return Array.from({ length: Math.max(1, days) }, (_, i) => [days > 1 ? `Full body ${"ABCDEF"[i]}` : "Full body", [T.fullA, T.fullB, T.fullC][i % 3], i]);
  // Rouleer hele rondes, dan train je alles even vaak (bijv. boven/onder 3 dagen: Upper A, Lower A, Upper B, Lower B, ...)
  const whole = (k) => Math.ceil(Math.max(1, days) / k) * k;
  if (split === "voorachter") return cycle(whole(2), [["Voorkant", T.front], ["Achterkant", T.back]]);
  if (split === "bovenonder") return cycle(whole(2), [["Upper", T.upper], ["Lower", T.lower]]);
  if (split === "ppl" && days < 3) return splitFor(days, "auto"); // met 2 dagen zou je geen benen trainen
  if (split === "ppl") return cycle(whole(3), [["Push", T.push], ["Pull", T.pull], ["Legs", T.legs]]);
  if (days <= 1) return [["Full body", T.fullA]];
  if (days === 2) return [["Full body A", T.fullA], ["Full body B", T.fullB]];
  if (days === 3) return [["Full body A", T.fullA], ["Full body B", T.fullB], ["Full body C", T.fullC]];
  if (days === 4) return cycle(4, [["Upper", T.upper], ["Lower", T.lower]]);
  if (days === 5) return [["Push", T.push, 0], ["Pull", T.pull, 0], ["Legs", T.legs, 0], ["Upper", T.upper, 1], ["Lower", T.lower, 1]];
  return cycle(6, [["Push", T.push], ["Pull", T.pull], ["Legs", T.legs]]);
}

// Oude schema's: oefeningen zonder gewicht met te lage reps rechtzetten
export function fixBwReps(routine, byId) {
  let n = 0;
  routine.exercises.forEach((x) => {
    const e = byId(x.exId);
    if (e?.eq === "bodyweight" && !e.timed && !e.cardio && x.mins == null && !BW_HARD.includes(e.id) && (x.repsMax || 0) < 12) { x.repsMin = e.kind === "compound" ? 10 : 12; x.repsMax = 20; x.rest = Math.min(x.rest || 75, 75); n++; }
  });
  return n;
}
// opts.main = de eerste grote oefening van de dag (alleen die gaat bij Kracht zwaar, 4-6 reps)
export function dosage(profile, ex, opts = {}) {
  const d = baseDose(profile, ex, opts);
  // Korte training (30 min of minder): hooguit 3 sets en 90 s rust
  if (!ex.cardio && !ex.timed && Number(profile.minutes) <= 30) { d.sets = Math.min(d.sets, 3); d.rest = Math.min(d.rest, 90); }
  return d;
}
function baseDose(profile, ex, opts) {
  const goals = profile.goals || ["spiermassa"];
  const mass = goals.includes("spiermassa");
  const strength = goals.includes("kracht");
  const lvl = profile.level || "beginner";
  const baseSets = lvl === "beginner" ? 3 : lvl === "gevorderd" ? 4 : 3;
  if (ex.cardio) return { sets: 1, mins: 20, repsMin: 0, repsMax: 0, rest: 0 };
  if (ex.timed) return { sets: 3, secs: lvl === "beginner" ? 30 : 45, repsMin: 0, repsMax: 0, rest: 60 };
  // Zonder gewicht groei je via reps: hogere reps, behalve bij zware varianten zoals optrekken
  if (ex.eq === "bodyweight") return BW_HARD.includes(ex.id) ? { sets: baseSets, ...hardReps(ex.id), rest: 120 } : { sets: 3, repsMin: ex.kind === "compound" ? 10 : 12, repsMax: 20, rest: 75 };
  if (ex.kind === "compound") {
    if (strength && opts.main) return { sets: baseSets + 1, repsMin: 4, repsMax: 6, rest: 180 };
    // 5-6 dagen: 1 set minder op de grote oefeningen (minstens 3), anders te veel per week
    if (mass) return { sets: Math.max(3, baseSets + (lvl === "beginner" ? 0 : 1) - (lvl === "gevorderd" ? 1 : 0) - (Number(profile.days) >= 5 ? 1 : 0)), repsMin: 6, repsMax: 10, rest: 120 };
    if (strength) return { sets: baseSets + (lvl === "beginner" ? 0 : 1), repsMin: 6, repsMax: 8, rest: 150 };
    return { sets: 3, repsMin: 8, repsMax: 12, rest: 90 };
  }
  if (mass) return { sets: 3, repsMin: 10, repsMax: 15, rest: 75 };
  return { sets: 3, repsMin: 12, repsMax: 15, rest: 60 };
}

// group = byLikes(profile): je favorieten eerst. Binnen je favorieten draaien we met favOffset
// (de hoeveelste keer een favoriet op zo'n plek), zodat dagen nog steeds verschillen als er meer favorieten passen.
function pick(list, slot, used, offset, group = (c) => c, favOffset = offset) {
  const [m, k, prefer] = slot;
  const take = (c) => {
    const g = group(c);
    return g.length ? g[(group.fav?.(g[0]) ? favOffset : offset) % g.length] : null;
  };
  // vaste keuzelijst: alleen daaruit, maar wel je favorieten eerst
  if (prefer) return take(prefer.map((id) => list.find((e) => e.id === id && !used.has(e.id))).filter(Boolean));
  const want = k === "c" ? "compound" : "isolation";
  let c = list.filter((e) => e.muscle === m && !used.has(e.id));
  const exact = c.filter((e) => e.kind === want);
  if (exact.length) c = exact;
  if (!c.length) return null;
  return take(c);
}

export function exercisesPerMinutes(minutes) {
  return Math.max(3, Math.min(8, Math.round(minutes / 9)));
}

// Geschatte tijd van één oefening in seconden (zelfde som als "±min" op Vandaag)
const estSec = (x) => (x.sets || 3) * (45 + (x.rest || 90));
const heavyLift = (e) => e?.kind === "compound" && e.eq !== "bodyweight" && !e.timed;

export function generatePlan(profile, extraExercises = [], opts = {}) {
  const seed = opts.seed || 0;
  const list = pool(profile, extraExercises);
  const group = byLikes(profile);
  // Cardio na je krachttraining komt erbij: je krachtdeel blijft even groot (spiermassa)
  const cMin = Number(profile.cardioMin) || 0;
  const cardio = cMin > 0 ? pickCardio(profile, extraExercises) : null;
  // Je gekozen tijd bepaalt hoeveel oefeningen: vullen tot je minuten op zijn (minstens 3, hooguit 8)
  const budget = (Number(profile.minutes) || 60) * 60 * 1.05;
  const days = splitFor(Number(profile.days) || 3, profile.split || "auto");
  // Favorieten wisselen elkaar af: per soort plek (bijv. benen-basis) telt de coach hoe vaak hij al een favoriet koos,
  // zodat dag A en B (en C) een andere favoriet krijgen als er meer passen.
  const favTurn = {};
  // Sets per spiergroep in deze week (alle dagen tot nu toe). Past niet alles in je tijd, dan gaat de spiergroep
  // die deze week nog het minst kreeg voor, zodat bijv. schouders en armen niet de hele week wegvallen.
  const week = {};
  const count = (c, n) => { week[c.e.muscle] = (week[c.e.muscle] || 0) + n; };
  // tijd van een dag: alle oefeningen + 2 min opwarmen als er een zware oefening in zit
  const time = (cs) => cs.reduce((s, c) => s + estSec(c.item), 0) + (cs.some((c) => heavyLift(c.e)) ? 120 : 0);
  return days.map(([name, tpl, variant], di) => {
    const used = new Set();
    // 1. per plek een oefening (in de volgorde van de dag)
    const cands = [];
    let hasMain = false;
    const bigFor = {}; // grote oefeningen per spiergroep vandaag
    tpl.forEach((slot, si) => {
      const key = `${slot[0]}|${slot[1]}`;
      const e = pick(list, slot, used, (variant ?? di) + seed, group, (favTurn[key] || 0) + seed);
      if (!e) return;
      const main = e.kind === "compound" && !hasMain;
      if (e.kind === "compound") hasMain = true;
      if (group.fav(e)) favTurn[key] = (favTurn[key] || 0) + 1;
      used.add(e.id);
      const item = { exId: e.id, ...dosage(profile, e, { main }) };
      // 2e grote oefening voor dezelfde spiergroep (bijv. row + pulldown): 1 set minder (minstens 3),
      // anders gaat je tijd naar één spiergroep en valt de rest weg
      if (heavyLift(e) && bigFor[e.muscle] && !item.secs) item.sets = Math.max(3, item.sets - 1);
      if (heavyLift(e)) bigFor[e.muscle] = true;
      cands.push({ e, key, si, item });
    });
    // 2. de eerste 3 altijd (de grote oefeningen). Daarna wat nog past: eerst de kleine oefeningen, zodat elke
    //    spiergroep van de dag aan bod komt (bijv. armen bij full body, borst op een Upper-dag), de spiergroep met de
    //    minste sets deze week eerst. Een extra grote oefening alleen als er dan nog tijd over is.
    const chosen = cands.slice(0, 3);
    chosen.forEach((c) => count(c, c.item.sets));
    const small = (c) => c.e.kind !== "compound";
    const rest = cands.slice(3);
    while (rest.length && chosen.length < 8) { // hooguit 8 oefeningen
      rest.sort((a, b) => small(b) - small(a) || (week[a.e.muscle] || 0) - (week[b.e.muscle] || 0) || a.si - b.si);
      const c = rest.shift();
      // past hij niet, dan een kleine oefening met 2 sets in plaats van 3
      const two = small(c) && c.item.sets > 2 ? { ...c, item: { ...c.item, sets: 2 } } : null;
      let fit = [c, two].find((x) => x && time([...chosen, x]) <= budget);
      // past een kleine oefening nog steeds niet: maak andere kleine oefeningen 2 sets (eerst die van de spiergroep
      // met de meeste sets deze week). Liever meer spiergroepen met 2 sets dan minder met 3.
      if (!fit && two) {
        const shrink = chosen.filter((x, k) => k >= 3 && small(x) && x.item.sets > 2 && !x.item.secs)
          .sort((a, b) => (week[b.e.muscle] || 0) - (week[a.e.muscle] || 0) || b.si - a.si);
        let t = time([...chosen, two]);
        const cut = [];
        for (const x of shrink) { if (t <= budget) break; cut.push(x); t -= estSec(x.item) - estSec({ ...x.item, sets: 2 }); }
        if (t <= budget) {
          cut.forEach((x) => { count(x, 2 - x.item.sets); x.item = { ...x.item, sets: 2 }; });
          fit = two;
        }
      }
      if (!fit) { if (group.fav(c.e)) favTurn[c.key]--; continue; } // past niet meer: telt niet als favoriet-beurt
      chosen.push(fit); count(fit, fit.item.sets);
    }
    // grote oefeningen eerst, daarna de kleine (core zoals plank als laatste)
    const exs = chosen.sort((a, b) => small(a) - small(b) || a.si - b.si).map((c) => c.item);
    if (cardio) exs.push({ exId: cardio.id, ...dosage(profile, cardio), mins: cMin });
    return {
      id: uid(), name, type: "strength", exercises: exs, source: "coach",
      note: "Gemaakt door je coach. Laat 1-2 reps in de tank bij de laatste set.",
    };
  });
}

// Na "Andere workout" of 👎: avoid = het circuit dat er stond, seen = circuits die je daarvoor al wegtikte.
// Je favorieten mogen blijven, de rest liefst anders. Komt er dan precies hetzelfde uit, dan alles anders.
export function generateCircuit(profile, { minutes = 20, intensity = "normaal", focus = "fullbody", seed = 0, avoid = null, seen = [] } = {}, extraExercises = []) {
  if (avoid?.length) {
    const opts = { minutes, intensity, focus, seed };
    const c = generateCircuit(avoidCurrent(profile, avoid, seen), opts, extraExercises);
    return sameIds(c.exercises.map((x) => x.exId), avoid) ? generateCircuit(avoidCurrent(profile, avoid, seen, false), opts, extraExercises) : c;
  }
  const list = pool(profile, extraExercises);
  const group = byLikes(profile);
  const orderPref = focus === "core"
    ? ["core", "core", "fullbody", "core", "billen", "core"]
    : focus === "benen"
    ? ["benen", "billen", "fullbody", "hamstrings", "benen", "core", "kuiten"]
    : focus === "boven"
    ? ["borst", "rug", "schouders", "triceps", "core", "fullbody", "biceps"]
    : ["fullbody", "benen", "borst", "core", "rug", "billen", "schouders", "core"];
  const used = new Set();
  const stations = [];
  let i = 0;
  for (const m of orderPref) {
    const c = group(list.filter((e) => e.muscle === m && !used.has(e.id) && (e.eq === "bodyweight" || e.eq === "dumbbell" || e.eq === "kettlebell")));
    if (!c.length) continue;
    const e = c[(i++ + minutes + seed) % c.length];
    used.add(e.id);
    stations.push({ exId: e.id });
  }
  const [work, rest] = intensity === "rustig" ? [30, 30] : intensity === "zwaar" ? [45, 15] : [40, 20];
  const roundSecs = stations.length * (work + rest) + 60;
  const rounds = Math.max(1, Math.round((minutes * 60) / roundSecs));
  return {
    id: uid(), name: `Circuit ${minutes} min`, type: "circuit", source: "coach",
    rounds, work, restBetween: rest, roundRest: 60, exercises: stations,
    note: `${stations.length} oefeningen, ${work}s werk / ${rest}s rust, ${rounds} rondes, 60s rust tussen rondes.`,
  };
}

// Bijsturen: geeft { routine, changes[] }
export function adjustRoutine(routine, kind, arg, profile, extraExercises = []) {
  const r = JSON.parse(JSON.stringify(routine));
  r.id = uid();
  const changes = [];
  const all = [...EXERCISES, ...extraExercises];
  const byId = (id) => all.find((e) => e.id === id);

  if (r.type === "circuit") {
    if (kind === "tijd") {
      const m = Number(arg) || 20;
      const roundSecs = r.exercises.length * (r.work + r.restBetween) + (r.roundRest || 60);
      if (r.rounds <= 1) changes.push("Al zo kort als het kan: 1 ronde.");
      else {
        r.rounds = Math.max(1, Math.min(r.rounds - 1, Math.floor((m * 60) / roundSecs)));
        changes.push(`Rondes aangepast naar ${r.rounds} zodat het in ~${m} min past.`);
      }
    } else if (kind === "moe" || kind === "zwaar") {
      r.work = Math.max(20, r.work - 10); r.restBetween += 10;
      changes.push(`Werk/rust naar ${r.work}s/${r.restBetween}s.`);
    } else if (kind === "makkelijk") {
      r.work += 5; r.restBetween = Math.max(10, r.restBetween - 5); r.rounds += 1;
      changes.push(`Zwaarder: ${r.work}s/${r.restBetween}s en ${r.rounds} rondes.`);
    }
  } else {
    const cardio = (x) => isCardio(x, byId);
    const shorter = (x) => { x.sets = 1; x.mins = Math.max(5, Math.round((x.mins || 20) * 0.75)); }; // cardio ~een kwart korter
    if (kind === "tijd") {
      // Eerst korter rusten en minder sets op de kleine oefeningen; pas daarna kleine oefeningen schrappen.
      // Cardio blijft staan, maar hooguit 10 minuten.
      const m = Number(arg) || 30;
      const est = () => r.exercises.reduce((a, x) => a + (cardio(x) ? (x.mins || 20) * 60 * (x.sets || 1) : (x.sets || 3) * (45 + (x.rest || 90))), 0) / 60;
      const comp = (x) => byId(x.exId)?.kind === "compound";
      let capped = false;
      r.exercises.forEach((x) => {
        if (cardio(x)) { if ((x.mins || 20) > 10) capped = true; x.sets = 1; x.mins = Math.min(x.mins || 20, 10); return; }
        x.sets = Math.min(x.sets || 3, 3); x.rest = Math.min(x.rest || 90, comp(x) ? 90 : 60); if (!comp(x)) x.sets = Math.min(x.sets, 2);
      });
      const dropped = [];
      while (est() > m && r.exercises.filter((x) => !cardio(x)).length > 3) {
        let i = -1;
        for (let j = r.exercises.length - 1; j >= 0; j--) if (!comp(r.exercises[j]) && !cardio(r.exercises[j])) { i = j; break; }
        if (i < 0) for (let j = r.exercises.length - 1; j >= 0; j--) if (!cardio(r.exercises[j])) { i = j; break; }
        dropped.push(byId(r.exercises[i].exId)?.name); r.exercises.splice(i, 1);
      }
      // Nog te lang (bijv. 3 grote oefeningen van 3 sets)? Dan stap voor stap, van achter naar voren:
      // grote oefeningen 2 sets, dan kortere rust (groot 60s, klein 45s). Pas als laatste nog een oefening eraf.
      const nonCardio = () => r.exercises.filter((x) => !cardio(x));
      let fewer = false, quicker = false;
      for (const x of [...nonCardio()].reverse().filter(comp)) { if (est() <= m) break; if (x.sets > 2) { x.sets = 2; fewer = true; } }
      for (const x of [...nonCardio()].reverse()) { if (est() <= m) break; const to = comp(x) ? 60 : 45; if ((x.rest || 90) > to) { x.rest = to; quicker = true; } }
      while (est() > m && nonCardio().length > 2) {
        const last = nonCardio().pop();
        dropped.push(byId(last.exId)?.name); r.exercises.splice(r.exercises.indexOf(last), 1);
      }
      if (dropped.length) changes.push(`Geschrapt voor tijd: ${dropped.join(", ")}.`);
      changes.push(`Kortere rust en minder sets op de kleine oefeningen.`);
      if (fewer) changes.push("Grote oefeningen 2 sets.");
      if (quicker) changes.push("Kortere rust tussen de sets.");
      if (capped) changes.push("Cardio ingekort tot 10 minuten.");
    } else if (kind === "moe") {
      r.exercises.forEach((x) => { if (cardio(x)) shorter(x); else x.sets = Math.max(2, x.sets - 1); });
      changes.push("Eén set minder per oefening. Train op RPE 7: stop met 3 reps over.");
      if (r.exercises.some(cardio)) changes.push("Cardio een kwart korter, in praattempo.");
    } else if (kind === "zwaar") {
      r.exercises.forEach((x) => { if (cardio(x)) shorter(x); else { x.sets = Math.max(2, x.sets - 1); x.rest += 30; } });
      changes.push("Eén set minder, 30s extra rust. Pak ~10% minder gewicht dan vorige keer.");
    } else if (kind === "makkelijk") {
      r.exercises.forEach((x) => { if (byId(x.exId)?.kind === "compound") x.sets += 1; });
      changes.push("Extra set op de basisoefeningen. Verhoog het gewicht als je de bovenkant van de reps haalt.");
    }
  }

  if (kind === "blessure" && arg) {
    const inj = arg;
    const p = { ...profile, injuries: [...new Set([...(profile.injuries || []), inj])] };
    // Vervangers komen uit wat je op deze plek hebt (hotel: geen machines; circuit: geen stang of machine)
    const loc = profile.location || "gym";
    let okPool = loc === "gym" ? pool(p, extraExercises) : hotelPool(p, loc === "home" ? "dumbbell" : "bodyweight", extraExercises);
    if (r.type === "circuit") okPool = okPool.filter((o) => ["bodyweight", "dumbbell", "kettlebell"].includes(o.eq));
    const used = new Set(r.exercises.filter((x) => !byId(x.exId)?.avoid?.includes(inj)).map((x) => x.exId));
    r.exercises = r.exercises.map((x) => {
      const e = byId(x.exId);
      if (!e || !e.avoid?.includes(inj)) return x;
      if (e.cardio) {
        // ander cardio-apparaat dat je blessure spaart, minuten blijven gelijk
        const alt = cardioPool(p, extraExercises).find((o) => (e.eq !== "bodyweight" || o.eq === "bodyweight") && !used.has(o.id));
        if (alt) { used.add(alt.id); changes.push(`${e.name} → ${alt.name} (spaart je ${inj}).`); return { ...x, exId: alt.id }; }
        changes.push(`${e.name} verwijderd (belast je ${inj}).`);
        return null;
      }
      const group = byLikes(p), free = (o) => o.muscle === e.muscle && !used.has(o.id);
      const alt = group(okPool.filter((o) => free(o) && o.kind === e.kind))[0] || group(okPool.filter(free))[0];
      if (alt) {
        used.add(alt.id);
        changes.push(`${e.name} → ${alt.name} (spaart je ${inj}).`);
        // Circuit-stations hebben geen reps of gewicht; anders een verse dosis (geen oud gewicht of oude reps)
        if (r.type === "circuit") return { ...x, exId: alt.id };
        return { exId: alt.id, ...(loc !== "gym" && (alt.eq === "bodyweight" || alt.timed) ? bwDose(alt, e.eq === alt.eq ? x : { sets: x.sets }) : slotDose(p, alt, x, e)) };
      }
      changes.push(`${e.name} verwijderd (belast je ${inj}).`);
      return null;
    }).filter(Boolean);
    if (!changes.length) changes.push(`Geen oefeningen in dit schema die je ${inj} zwaar belasten.`);
    changes.push("Pijn is een stopsignaal: scherpe of toenemende pijn = stoppen en laten checken.");
  }

  if (!/\(aangepast\)$/.test(r.name)) r.name += " (aangepast)";
  r.source = "coach";
  return { routine: r, changes };
}

// Gewicht/reps-suggestie op basis van de vorige keer (double progression)
// exById: zoek de oefening op zoals de app (ook eigen en bibliotheek-oefeningen), zodat de stap klopt
export function suggestNext(exId, plan, workouts, exById) {
  const ex = exById?.(exId) || EXERCISES.find((e) => e.id === exId);
  const kg = (v) => Number(String(v).replace(",", ".")) || 0;
  for (let i = workouts.length - 1; i >= 0; i--) {
    const we = workouts[i].exercises.find((x) => x.exId === exId);
    if (!we) continue;
    const done = we.sets.filter((s) => s.done && s.type !== "w" && Number(s.r) > 0);
    if (!done.length) continue;
    const topW = Math.max(...done.map((s) => kg(s.w)));
    const atTop = done.filter((s) => kg(s.w) === topW);
    const repsMax = plan?.repsMax || 12;
    const allHit = atTop.length >= Math.min(plan?.sets || 3, done.length) && atTop.every((s) => Number(s.r) >= repsMax);
    if (!topW) return { weight: 0, text: allHit ? "Alle reps gehaald: probeer een moeilijkere variant of meer reps." : "Probeer 1 rep meer dan vorige keer." };
    const f = (v) => String(v).replace(".", ",");
    if (allHit) {
      const step = increment(ex), pw = kg(plan?.weight);
      // Is je doelgewicht bekend, dan nooit ver daarboven (een typfout in je vorige set telt niet zwaar mee)
      const next = Math.min(roundTo(topW + step, step), pw > 0 ? roundTo(Math.max(pw + 2 * step, pw * 1.5), step) : Infinity);
      return { weight: next, text: `Vorige keer alle reps op ${f(topW)} kg → probeer ${f(next)} kg.` };
    }
    return { weight: topW, text: `Blijf op ${f(topW)} kg en probeer meer reps dan vorige keer.` };
  }
  return null;
}

export const e1rm = (w, r) => (r > 0 ? w * (1 + r / 30) : 0);

// Stapgrootte voor gewichtsverhoging
export function increment(ex) {
  if (!ex) return 2.5;
  if (ex.id === "leg_press") return 5;
  if (ex.eq === "dumbbell" || ex.eq === "kettlebell") return 2;
  return 2.5; // stang, kabel en machine: stappen van 2,5 kg (die bestaan echt)
}
function roundTo(v, step) { return Math.round(v / step) * step; }

// Pas de doelgewichten aan op basis van je reps (double progression):
// - alle sets op de bovenkant van je reps -> 1 stap zwaarder
// - reps binnen je bereik -> gewicht blijft, volgende keer meer reps
// - 2 trainingen op rij onder je minimum reps -> 1 stap lichter
// Geeft wijzigingen terug: { exId, from, to, why }
export function progressRoutine(routine, doneExercises, exById) {
  const changes = [];
  if (!routine || routine.type === "circuit" || routine.type === "cardio") return changes;
  const kg = (v) => Number(String(v).replace(",", ".")) || 0;
  for (const x of routine.exercises) {
    const ex = exById(x.exId);
    if (!ex || ex.timed || ex.cardio || x.mins != null) continue; // cardio telt niet mee voor gewichten
    const done = doneExercises.find((d) => d.exId === x.exId);
    if (!done) continue;
    const sets = done.sets.filter((s) => s.done && s.type !== "w" && s.type !== "d" && Number(s.r) > 0);
    if (!sets.length) continue;
    const topW = Math.max(...sets.map((s) => kg(s.w)));
    if (topW <= 0) continue; // zonder extra gewicht: progressie via reps
    const atTop = sets.filter((s) => kg(s.w) === topW);
    const repsMin = x.repsMin || 8, repsMax = x.repsMax || 12, planned = x.sets || 3;
    const reps = atTop.map((s) => Number(s.r));
    const hitAll = atTop.length >= planned && reps.every((r) => r >= repsMax);
    const below = reps.filter((r) => r < repsMin).length > reps.length / 2;
    const from = x.weight || 0;
    const step = increment(ex);
    const r = (v) => roundTo(v, step);
    let to = from, why = "";
    delete x.stall;
    if (!from) { to = topW; why = "startgewicht vastgelegd"; x.low = 0; }
    // Net onder je doel (bijv. 15 kg op een machine die alleen per 5 gaat) telt ook als gehaald
    const hitBranch = hitAll && (!from || topW >= from - 2 * step);
    if (hitBranch) {
      to = r(Math.max(topW, from) + step); why = `je haalde alle ${planned} sets ${repsMax}+ reps`; x.low = 0;
      // Al alle reps gehaald op het gewicht dat eerder te zwaar was: de rem mag eraf
      if (x.cap && topW >= x.cap) { delete x.cap; delete x.top; }
      // Terug naar een gewicht dat eerder te zwaar was: eerst 2 goede trainingen
      if (x.cap && to >= x.cap) {
        x.top = (x.top || 0) + 1;
        if (x.top < 2) { to = from; why = ""; }
        else { why = `je haalde 2× alle ${planned} sets ${repsMax}+ reps`; delete x.cap; delete x.top; }
      }
    } else if (from && topW > from && !below) {
      to = topW; why = "je pakte zelf al meer"; x.low = 0;
      if (x.cap && to >= x.cap) { delete x.cap; delete x.top; } // zelf al terug op het oude gewicht: geen rem meer
    } else if (from && below && topW > from) {
      x.low = 0; // zwaarder geprobeerd: doel blijft staan
    } else if (from && below) {
      x.low = (x.low || 0) + 1;
      if (x.low >= 2) { to = Math.max(step, r(Math.min(from, topW) - step)); why = `je zat 2× onder ${repsMin} reps`; x.cap = from; x.low = 0; }
    } else if (from) {
      x.low = 0; // binnen je bereik: zelfde gewicht, meer reps
    }
    if (!hitBranch && x.top) x.top = 0;
    // Eén verkeerd getypte set (bijv. 6062,5 kg) mag je doel nooit ver omhoog gooien: hooguit 2 stappen of +50%
    if (from > 0 && to > from) to = Math.min(to, r(Math.max(from + 2 * step, from * 1.5)));
    if (to !== from) { x.weight = to; changes.push({ exId: x.exId, from, to, why }); }
  }
  return changes;
}

// ---------- Hotelkamer ----------
// In een hotelkamer heb je geen stang om aan te hangen of liggers voor dips.
const HOTEL_BLOCK = new Set(["pullup", "chinup", "hanging_raise", "dips", "inverted_row"]);
const HOTEL_MAP = {
  bodyweight: {
    bench: "pushup", db_bench: "pushup", incline_db: "pushup", chest_press: "pushup", cable_fly: "incline_pushup", pec_deck: "incline_pushup",
    dips: "bench_dips", barbell_row: "door_row", db_row: "door_row", seated_row: "door_row", lat_pulldown: "door_row",
    pullup: "door_row", chinup: "door_row", inverted_row: "door_row", face_pull: "prone_y", rear_delt: "prone_y",
    ohp: "pike_pushup", db_shoulder: "pike_pushup", lateral_raise: "prone_y", cable_lateral: "prone_y",
    squat: "split_squat_bw", front_squat: "bw_squat", leg_press: "bw_squat", goblet_squat: "bw_squat", lunge: "split_squat_bw", bulgarian: "split_squat_bw",
    leg_ext: "wall_sit", deadlift: "single_leg_bridge", rdl: "single_leg_bridge", db_rdl: "single_leg_bridge", leg_curl: "nordic", hip_thrust: "single_leg_bridge",
    calf_raise: "bw_calf", bb_curl: null, db_curl: null, hammer_curl: null, cable_curl: null,
    pushdown: "diamond_pushup", oh_ext: "bench_dips", skullcrusher: "diamond_pushup", cable_crunch: "crunch", hanging_raise: "dead_bug", kb_swing: "glute_bridge",
  },
  dumbbell: {
    bench: "db_bench", chest_press: "db_bench", cable_fly: "pushup", pec_deck: "pushup", dips: "bench_dips",
    barbell_row: "db_row", seated_row: "db_row", lat_pulldown: "db_row", pullup: "db_row", chinup: "db_row", face_pull: "rear_delt",
    ohp: "db_shoulder", cable_lateral: "lateral_raise", squat: "goblet_squat", front_squat: "goblet_squat", leg_press: "bulgarian", leg_ext: "lunge",
    deadlift: "db_rdl", rdl: "db_rdl", leg_curl: "nordic", hip_thrust: "single_leg_bridge", calf_raise: "bw_calf",
    bb_curl: "db_curl", cable_curl: "hammer_curl", pushdown: "diamond_pushup", oh_ext: "bench_dips", skullcrusher: "diamond_pushup",
    cable_crunch: "crunch", hanging_raise: "dead_bug", kb_swing: "goblet_squat",
  },
};

export function hotelPool(profile, mode, extra) {
  return pool({ ...profile, location: mode === "dumbbell" ? "home" : "bodyweight" }, extra).filter((e) => !HOTEL_BLOCK.has(e.id) && e.eq !== "kettlebell");
}

export function bwDose(ex, old) {
  if (ex.timed) return { sets: old?.sets || 3, secs: old?.secs || 40, repsMin: 0, repsMax: 0, rest: 60 };
  if (BW_HARD.includes(ex.id)) return { sets: old?.sets || 3, ...hardReps(ex.id), rest: 120 };
  if (ex.eq === "bodyweight") return { sets: old?.sets || 3, repsMin: ex.kind === "compound" ? 10 : 12, repsMax: 20, rest: Math.min(old?.rest || 75, 75) };
  return { sets: old?.sets || 3, repsMin: old?.repsMin || 8, repsMax: old?.repsMax || 12, rest: old?.rest || 90 };
}

// A: zet een bestaande training om naar hotelkamer (geen spullen of alleen dumbbells)
export function hotelRoutine(routine, mode, profile, extra = []) {
  const all = [...EXERCISES, ...extra];
  const byId = (id) => all.find((e) => e.id === id);
  const ok = hotelPool(profile, mode, extra);
  const okIds = new Set(ok.map((e) => e.id));
  const r = JSON.parse(JSON.stringify(routine));
  r.id = uid();
  const used = new Set();
  const changes = [];
  const out = [];
  for (const x of r.exercises) {
    const e = byId(x.exId);
    if (e?.cardio) {
      // Hotelgym: fiets of loopband is er meestal. Geen spullen: ga buiten hardlopen.
      if (used.has(x.exId)) continue;
      if (mode === "dumbbell" || e.eq === "bodyweight") { used.add(x.exId); out.push(x); continue; }
      const run = byId("run_outside");
      if (!run || used.has(run.id) || (profile.exclude || []).includes(run.id) || run.avoid.some((a) => (profile.injuries || []).includes(a))) { changes.push(`${e.name} geschrapt (geen apparaat in je kamer).`); continue; }
      used.add(run.id);
      const { weight, stall, ...rest } = x;
      out.push({ ...rest, exId: run.id });
      changes.push(`${e.name} → ${run.name}`);
      continue;
    }
    if (okIds.has(x.exId) && !used.has(x.exId)) { used.add(x.exId); out.push(e?.eq === "bodyweight" ? { ...x, ...bwDose(e, x) } : x); continue; }
    let to = HOTEL_MAP[mode][x.exId];
    // trekoefening (rug, biceps, achterkant schouders): nooit vervangen door een drukoefening
    const pulls = !!e && (e.muscle === "rug" || e.muscle === "biceps" || e.id === "face_pull" || e.id === "rear_delt");
    // geen nieuwe trekoefening meer over: 2 sets erbij op de row die al in je workout staat (hooguit 6 sets)
    const addToRow = (why = "") => {
      const row = out.find((y) => byId(y.exId)?.muscle === "rug" && byId(y.exId)?.kind === "compound" && (y.sets || 3) < 6);
      if (!row) return false;
      const add = Math.min(2, 6 - (row.sets || 3));
      row.sets = (row.sets || 3) + add; changes.push(`${e?.name} → ${add} sets extra ${byId(row.exId).name}${why}`);
      return true;
    };
    if (to === null && mode === "bodyweight") {
      if (addToRow(" (je biceps werken mee)")) continue;
      changes.push(`${e?.name} geschrapt: zonder spullen is er geen goede biceps-oefening (je biceps werken mee bij de rows).`); continue;
    }
    if (!to || !okIds.has(to) || used.has(to)) {
      const best = (f) => byLikes(profile)(ok.filter((o) => !used.has(o.id) && f(o)))[0]?.id;
      to = best((o) => o.muscle === e?.muscle && o.kind === e?.kind)
        || (pulls ? best((o) => o.muscle === "rug") : e?.kind === "compound" ? best((o) => o.muscle === e?.muscle) : undefined);
    }
    if (!to && pulls && addToRow()) continue;
    if (!to) { changes.push(`${e?.name} geschrapt (geen variant voor in je kamer).`); continue; }
    used.add(to);
    const n = byId(to);
    const { weight, stall, ...rest } = x;
    out.push({ ...rest, exId: to, ...bwDose(n, x) });
    changes.push(`${e?.name} → ${n.name}`);
  }
  r.exercises = out;
  r.name = `${routine.name.replace(/ \(aangepast\)$/, "")} (hotel)`;
  r.note = mode === "dumbbell"
    ? "Hotelgym-versie. Gebruik dumbbells die je 8-12 keer kunt tillen."
    : "Hotelkamer-versie. Maak het zwaarder door 3 tellen te zakken en 1 tel stil te houden. Deur-row: alleen bij een deur die van je af opent, test eerst of de klink stevig zit.";
  if (!changes.length) changes.push("Deze training kan al zonder spullen.");
  return { routine: r, changes };
}

// C: snelle hotelkamer-training (full body, supersets, korte finisher)
export function generateHotel(profile, { minutes = 30, mode = "bodyweight" } = {}, extra = []) {
  const ok = hotelPool(profile, mode, extra);
  const slots = [
    ["benen", "c", ["bulgarian", "split_squat_bw", "goblet_squat", "bw_squat", "lunge", "step_up"]],
    ["borst", "c", ["db_bench", "pushup", "incline_pushup"]],
    ["rug", "c", ["db_row", "door_row", "superman"]],
    ["billen", "c", ["db_rdl", "single_leg_bridge", "glute_bridge"]],
    ["schouders", "c", ["db_shoulder", "pike_pushup", "lateral_raise"]],
    ["triceps", "c", ["diamond_pushup", "bench_dips"]],
    ["core", "i", ["plank", "dead_bug", "side_plank", "russian_twist"]],
    ["hamstrings", "c", ["nordic", "db_rdl", "single_leg_bridge"]],
  ];
  const n = minutes <= 20 ? 4 : minutes <= 30 ? 6 : 8;
  const used = new Set();
  const exs = [];
  for (const [m, k, prefer] of slots) {
    if (exs.length >= n) break;
    const e = prefer.map((id) => ok.find((o) => o.id === id && !used.has(id))).find(Boolean)
      || ok.find((o) => o.muscle === m && !used.has(o.id));
    if (!e) continue;
    used.add(e.id);
    exs.push({ exId: e.id, ...bwDose(e, { sets: 3, rest: 60 }) });
  }
  // supersets per twee oefeningen
  for (let i = 0; i + 1 < exs.length; i += 2) { const id = uid(); exs[i].ss = id; exs[i + 1].ss = id; }
  // finisher
  const fin = ["mountain_climber", "burpee", "high_knees", "jumping_jack", "squat_jump"].map((id) => ok.find((o) => o.id === id)).filter(Boolean).slice(0, 2);
  if (fin.length === 2) {
    const id = uid();
    fin.forEach((e) => exs.push({ exId: e.id, sets: 3, secs: 30, repsMin: 0, repsMax: 0, rest: 30, ss: id }));
  }
  return {
    id: uid(), name: `Hotelkamer ${minutes} min`, type: "strength", source: "coach",
    note: "Supersets: doe de 2 oefeningen direct na elkaar, dan rust. Maak het zwaarder door 3 tellen te zakken. Eindig met de finisher.",
    exercises: exs,
  };
}


// ---------- Simpele modus: vervangen en opnieuw maken ----------
// Maak één dag van het schema opnieuw (na 👎 of "Andere workout"): je favorieten en cardio blijven op hun plek,
// elke andere oefening wordt een andere voor dezelfde spiergroep: liefst een favoriet, dan een nieuwe,
// dan een die je eerder vandaag al wegtikte (seen). Vaste keuzelijsten van de dag blijven gelden
// (bijv. achterkant: rear delt of face pull). Verandert er dan niets, dan worden ook je favorieten vervangen.
export function regenerateDay(profile, routine, index, extra = [], seed = 1, seen = []) {
  const all = [...EXERCISES, ...extra];
  const byId = (id) => all.find((e) => e.id === id);
  const days = splitFor(Number(profile.days) || 3, profile.split || "auto");
  const tpl = (days[index % days.length] || days[0])[1];
  const cur = routine.exercises.map((x) => x.exId), liked = new Set(profile.fav ?? profile.prefer ?? []); // alleen je ❤️ favorieten blijven staan
  // mag deze oefening blijven? Niet als je hem "niet meer" wilt of als hij je blessure belast
  const allowed = (id) => !(profile.exclude || []).includes(id) && !(byId(id)?.avoid || []).some((a) => (profile.injuries || []).includes(a));
  const build = (keepFav) => {
    const p = avoidCurrent(profile, cur, seen, keepFav), list = pool(p, extra), group = byLikes(p);
    const stays = (x) => isCardio(x, byId) || (keepFav && liked.has(x.exId) && allowed(x.exId));
    const used = new Set(routine.exercises.filter(stays).map((x) => x.exId));
    return routine.exercises.map((x, k) => {
      if (stays(x)) return x;
      const e = byId(x.exId);
      if (!e) return allowed(x.exId) ? x : null; // kent de coach niet (bijv. rekoefening uit de bibliotheek): laten staan
      const strict = tpl.find((s) => s[2]?.includes(x.exId))?.[2];
      const free = (o) => !used.has(o.id) && (strict ? strict.includes(o.id) : o.muscle === e.muscle);
      let g = group(list.filter((o) => free(o) && (strict || o.kind === e.kind)));
      if (!g.length) g = group(list.filter(free));
      if (!g.length) return allowed(x.exId) && !used.has(x.exId) ? (used.add(x.exId), x) : null; // geen andere: blijft, of valt weg als hij niet meer mag
      const alt = g[(seed + k) % g.length];
      used.add(alt.id);
      return alt.id === x.exId ? x : { exId: alt.id, ...slotDose(profile, alt, x, e) };
    }).filter(Boolean);
  };
  let exercises = build(true);
  if (sameIds(exercises.map((x) => x.exId), cur)) exercises = build(false);
  return { ...routine, exercises, rating: undefined };
}

// Wissel je de zware hoofdoefening (4-6 reps), dan blijft de vervanger zwaar
const heavy = (alt, x) => { const p = x?.plan || x; return alt.kind === "compound" && p?.repsMin === 4 && p?.repsMax === 6; };
// Dosis voor een vervanger op dezelfde plek. Had die plek minder sets (bijv. 2 omdat je tijd krap is), dan blijft dat zo.
function slotDose(profile, alt, x, e) {
  const d = dosage(profile, alt, { main: heavy(alt, x) });
  const sets = (x?.plan || x)?.sets;
  if (sets && sets < d.sets && e && alt.kind === e.kind && !alt.cardio) d.sets = sets;
  return d;
}

// Kies een vervanger voor één oefening: zelfde spiergroep en soort, nog niet in de training.
// Liefst een favoriet; een oefening die je minder vindt alleen als er niets anders is.
export function swapExercise(profile, routine, exId, extra = []) {
  const all = [...EXERCISES, ...extra];
  const e = all.find((x) => x.id === exId);
  const inR = new Set(routine.exercises.map((x) => x.exId));
  if (e?.cardio) {
    // Cardio: het volgende apparaat (buiten hardlopen blijft buiten), minuten blijven gelijk.
    // Apparaten die je minder vindt slaan we over, behalve als er niets anders is.
    const less = new Set(profile.lessPreferred || []);
    const opts = cardioPool(profile, extra).filter((o) => (o.eq === "bodyweight") === (e.eq === "bodyweight"));
    const start = opts.findIndex((o) => o.id === exId);
    let alt = null, meh = null;
    for (let k = 1; k <= opts.length && !alt; k++) {
      const o = opts[(start + k) % opts.length];
      if (o.id === exId || inR.has(o.id)) continue;
      if (less.has(o.id)) meh = meh || o; else alt = o;
    }
    alt = alt || meh;
    if (!alt) return null;
    const old = routine.exercises.find((x) => x.exId === exId);
    const mins = old?.mins || old?.plan?.mins;
    return { exId: alt.id, ...dosage(profile, alt), ...(mins ? { mins } : {}) };
  }
  const list = pool(profile, extra), group = byLikes(profile);
  const free = (o) => o.muscle === e?.muscle && !inR.has(o.id);
  const alt = group(list.filter((o) => free(o) && o.kind === e?.kind))[0] || group(list.filter(free))[0];
  if (!alt) return null;
  return { exId: alt.id, ...slotDose(profile, alt, routine.exercises.find((x) => x.exId === exId), e) };
}
