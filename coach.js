// Ingebouwde (offline) coach: schema's, circuits, bijsturen en progressie.
import { EXERCISES } from "./data.js";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function allowedEq(location) {
  if (location === "bodyweight") return ["bodyweight"];
  if (location === "home") return ["bodyweight", "dumbbell", "kettlebell"];
  return ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell"];
}

function pool(profile, extra = []) {
  const eq = allowedEq(profile.location);
  const inj = profile.injuries || [];
  return [...EXERCISES, ...extra].filter(
    (e) => eq.includes(e.eq) && !e.avoid.some((a) => inj.includes(a))
  );
}

// Dagtemplates: lijst slots { m: spiergroep(en), k: compound|isolation }
const T = {
  fullA: [["benen", "c"], ["borst", "c"], ["rug", "c"], ["hamstrings", "c"], ["schouders", "i"], ["biceps", "i"], ["core", "i"], ["triceps", "i"]],
  fullB: [["hamstrings", "c"], ["schouders", "c"], ["rug", "c"], ["benen", "c"], ["borst", "i"], ["triceps", "i"], ["core", "i"], ["biceps", "i"]],
  fullC: [["benen", "c"], ["rug", "c"], ["borst", "c"], ["billen", "c"], ["schouders", "i"], ["core", "i"], ["kuiten", "i"], ["biceps", "i"]],
  upper: [["borst", "c"], ["rug", "c"], ["schouders", "c"], ["rug", "c"], ["borst", "i"], ["biceps", "i"], ["triceps", "i"], ["schouders", "i"]],
  lower: [["benen", "c"], ["hamstrings", "c"], ["benen", "c"], ["billen", "c"], ["hamstrings", "i"], ["kuiten", "i"], ["core", "i"], ["core", "i"]],
  push: [["borst", "c"], ["schouders", "c"], ["borst", "c"], ["schouders", "i"], ["triceps", "i"], ["borst", "i"], ["triceps", "i"]],
  pull: [["rug", "c"], ["rug", "c"], ["rug", "c"], ["schouders", "i"], ["biceps", "i"], ["biceps", "i"], ["core", "i"]],
  legs: [["benen", "c"], ["hamstrings", "c"], ["benen", "c"], ["billen", "c"], ["hamstrings", "i"], ["kuiten", "i"], ["core", "i"]],
  // Voorkant: borst, voorkant schouders, triceps, quadriceps, buik
  front: [["benen", "c"], ["borst", "c"], ["schouders", "c", ["ohp", "db_shoulder", "pike_pushup"]], ["benen", "c", ["leg_press", "bulgarian", "lunge", "goblet_squat", "split_squat_bw", "step_up"]], ["borst", "i"], ["triceps", "i"], ["schouders", "i", ["lateral_raise", "cable_lateral"]], ["core", "i"]],
  // Achterkant: rug, achterkant schouders, biceps, hamstrings, billen, kuiten
  back: [["hamstrings", "c"], ["rug", "c"], ["billen", "c"], ["rug", "c"], ["hamstrings", "i"], ["schouders", "i", ["rear_delt", "face_pull"]], ["biceps", "i"], ["kuiten", "i"]],
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
  if (split === "voorachter") return cycle(days, [["Voorkant", T.front], ["Achterkant", T.back]]);
  if (split === "bovenonder") return cycle(days, [["Upper", T.upper], ["Lower", T.lower]]);
  if (split === "ppl") return cycle(days, [["Push", T.push], ["Pull", T.pull], ["Legs", T.legs]]);
  if (days <= 1) return [["Full body", T.fullA]];
  if (days === 2) return [["Full body A", T.fullA], ["Full body B", T.fullB]];
  if (days === 3) return [["Full body A", T.fullA], ["Full body B", T.fullB], ["Full body C", T.fullC]];
  if (days === 4) return [["Upper A", T.upper], ["Lower A", T.lower], ["Upper B", T.upper], ["Lower B", T.lower]];
  if (days === 5) return [["Push", T.push], ["Pull", T.pull], ["Legs", T.legs], ["Upper", T.upper], ["Lower", T.lower]];
  return [["Push A", T.push], ["Pull A", T.pull], ["Legs A", T.legs], ["Push B", T.push], ["Pull B", T.pull], ["Legs B", T.legs]];
}

function dosage(profile, ex) {
  const goals = profile.goals || ["spiermassa"];
  const mass = goals.includes("spiermassa");
  const strength = goals.includes("kracht");
  const lvl = profile.level || "beginner";
  const baseSets = lvl === "beginner" ? 3 : lvl === "gevorderd" ? 4 : 3;
  if (ex.timed) return { sets: 3, secs: lvl === "beginner" ? 30 : 45, repsMin: 0, repsMax: 0, rest: 60 };
  if (ex.kind === "compound") {
    if (strength) return { sets: baseSets + 1, repsMin: 4, repsMax: 6, rest: 180 };
    if (mass) return { sets: baseSets + (lvl === "beginner" ? 0 : 1) - (lvl === "gevorderd" ? 1 : 0), repsMin: 6, repsMax: 10, rest: 120 };
    return { sets: 3, repsMin: 8, repsMax: 12, rest: 90 };
  }
  if (mass) return { sets: 3, repsMin: 10, repsMax: 15, rest: 75 };
  return { sets: 3, repsMin: 12, repsMax: 15, rest: 60 };
}

function pick(list, slot, used, offset) {
  const [m, k, prefer] = slot;
  if (prefer) {
    const p = prefer.map((id) => list.find((e) => e.id === id && !used.has(e.id))).filter(Boolean);
    return p.length ? p[offset % p.length] : null;
  }
  const want = k === "c" ? "compound" : "isolation";
  let c = list.filter((e) => e.muscle === m && !used.has(e.id));
  const exact = c.filter((e) => e.kind === want);
  if (exact.length) c = exact;
  if (!c.length) return null;
  return c[offset % c.length];
}

export function exercisesPerMinutes(minutes) {
  return Math.max(3, Math.min(8, Math.round(minutes / 9)));
}

export function generatePlan(profile, extraExercises = []) {
  const list = pool(profile, extraExercises);
  const n = exercisesPerMinutes(profile.minutes || 60);
  const days = splitFor(Number(profile.days) || 3, profile.split || "auto");
  return days.map(([name, tpl, variant], di) => {
    const used = new Set();
    const exs = [];
    for (const slot of tpl) {
      if (exs.length >= n) break;
      const e = pick(list, slot, used, variant ?? di);
      if (!e) continue;
      used.add(e.id);
      exs.push({ exId: e.id, ...dosage(profile, e) });
    }
    return {
      id: uid(), name, type: "strength", exercises: exs, source: "coach",
      note: "Gemaakt door je coach. Laat 1-2 reps in de tank bij de laatste set.",
    };
  });
}

export function generateCircuit(profile, { minutes = 20, intensity = "normaal", focus = "fullbody" } = {}, extraExercises = []) {
  const list = pool(profile, extraExercises);
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
    const c = list.filter((e) => e.muscle === m && !used.has(e.id) && (e.eq === "bodyweight" || e.eq === "dumbbell" || e.eq === "kettlebell"));
    if (!c.length) continue;
    const e = c[(i++ + minutes) % c.length];
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
      r.rounds = Math.max(1, Math.floor((m * 60) / roundSecs));
      changes.push(`Rondes aangepast naar ${r.rounds} zodat het in ~${m} min past.`);
    } else if (kind === "moe" || kind === "zwaar") {
      r.work = Math.max(20, r.work - 10); r.restBetween += 10;
      changes.push(`Werk/rust naar ${r.work}s/${r.restBetween}s.`);
    } else if (kind === "makkelijk") {
      r.work += 5; r.restBetween = Math.max(10, r.restBetween - 5); r.rounds += 1;
      changes.push(`Zwaarder: ${r.work}s/${r.restBetween}s en ${r.rounds} rondes.`);
    }
  } else {
    if (kind === "tijd") {
      const m = Number(arg) || 30;
      const n = Math.max(3, exercisesPerMinutes(m));
      const sorted = [...r.exercises].sort((a, b) => (byId(a.exId)?.kind === "compound" ? 0 : 1) - (byId(b.exId)?.kind === "compound" ? 0 : 1));
      const keep = new Set(sorted.slice(0, n).map((x) => x.exId));
      const dropped = r.exercises.filter((x) => !keep.has(x.exId)).map((x) => byId(x.exId)?.name);
      r.exercises = r.exercises.filter((x) => keep.has(x.exId));
      if (m <= 35) r.exercises.forEach((x) => { x.sets = Math.min(x.sets, 3); x.rest = Math.min(x.rest, 90); });
      if (dropped.length) changes.push(`Geschrapt voor tijd: ${dropped.join(", ")}.`);
      changes.push(`Max 3 sets en kortere rust, focus op de basisoefeningen.`);
    } else if (kind === "moe") {
      r.exercises.forEach((x) => { x.sets = Math.max(2, x.sets - 1); });
      changes.push("Eén set minder per oefening. Train op RPE 7: stop met 3 reps over.");
    } else if (kind === "zwaar") {
      r.exercises.forEach((x) => { x.sets = Math.max(2, x.sets - 1); x.rest += 30; });
      changes.push("Eén set minder, 30s extra rust. Pak ~10% minder gewicht dan vorige keer.");
    } else if (kind === "makkelijk") {
      r.exercises.forEach((x) => { if (byId(x.exId)?.kind === "compound") x.sets += 1; });
      changes.push("Extra set op de basisoefeningen. Verhoog het gewicht als je de bovenkant van de reps haalt.");
    }
  }

  if (kind === "blessure" && arg) {
    const inj = arg;
    const p = { ...profile, injuries: [...new Set([...(profile.injuries || []), inj])] };
    const okPool = pool(p, extraExercises);
    r.exercises = r.exercises.map((x) => {
      const e = byId(x.exId);
      if (!e || !e.avoid.includes(inj)) return x;
      const alt = okPool.find((o) => o.muscle === e.muscle && o.kind === e.kind && !r.exercises.some((y) => y.exId === o.id))
        || okPool.find((o) => o.muscle === e.muscle && !r.exercises.some((y) => y.exId === o.id));
      if (alt) { changes.push(`${e.name} → ${alt.name} (spaart je ${inj}).`); return { ...x, exId: alt.id, secs: alt.timed ? (x.secs || 30) : undefined }; }
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
export function suggestNext(exId, plan, workouts) {
  const ex = EXERCISES.find((e) => e.id === exId);
  for (let i = workouts.length - 1; i >= 0; i--) {
    const we = workouts[i].exercises.find((x) => x.exId === exId);
    if (!we) continue;
    const done = we.sets.filter((s) => s.done && s.type !== "w" && Number(s.r) > 0);
    if (!done.length) continue;
    const topW = Math.max(...done.map((s) => Number(s.w) || 0));
    const atTop = done.filter((s) => (Number(s.w) || 0) === topW);
    const repsMax = plan?.repsMax || 12;
    const allHit = atTop.length >= Math.min(plan?.sets || 3, done.length) && atTop.every((s) => Number(s.r) >= repsMax);
    if (!topW) return { weight: 0, text: allHit ? "Alle reps gehaald: probeer een moeilijkere variant of meer reps." : "Probeer 1 rep meer dan vorige keer." };
    if (allHit) {
      const inc = ex && ex.eq === "barbell" ? 2.5 : ex && ex.kind === "compound" ? 2.5 : 1;
      return { weight: topW + inc, text: `Vorige keer alle reps op ${topW} kg → probeer ${topW + inc} kg.` };
    }
    return { weight: topW, text: `Blijf op ${topW} kg en probeer meer reps dan vorige keer.` };
  }
  return null;
}

export const e1rm = (w, r) => (r > 0 ? w * (1 + r / 30) : 0);

// Stapgrootte voor gewichtsverhoging
export function increment(ex) {
  if (!ex) return 2.5;
  if (ex.id === "leg_press") return 5;
  if (ex.eq === "dumbbell" || ex.eq === "kettlebell") return 2;
  if (ex.kind === "isolation") return 1.25;
  return 2.5;
}
const roundTo = (v, step) => Math.round(v / step) * step;

// Pas de doelgewichten aan op basis van je reps (double progression):
// - alle sets op de bovenkant van je reps -> 1 stap zwaarder
// - reps binnen je bereik -> gewicht blijft, volgende keer meer reps
// - 2 trainingen op rij onder je minimum reps -> 1 stap lichter
// Geeft wijzigingen terug: { exId, from, to, why }
export function progressRoutine(routine, doneExercises, exById) {
  const changes = [];
  if (!routine || routine.type === "circuit") return changes;
  const kg = (v) => Number(String(v).replace(",", ".")) || 0;
  for (const x of routine.exercises) {
    const ex = exById(x.exId);
    if (!ex || ex.timed) continue;
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
    if (!from) { to = topW; why = "eerste keer vastgelegd"; x.low = 0; }
    if (hitAll && topW >= (from || topW)) {
      to = r(topW + step); why = `alle ${planned} sets ${repsMax}+ reps: 1 stap zwaarder`; x.low = 0;
    } else if (from && topW > from && !below) {
      to = topW; why = "je pakte zelf al meer"; x.low = 0;
    } else if (from && below && topW >= from) {
      x.low = (x.low || 0) + 1;
      if (x.low >= 2) { to = Math.max(step, r(from - step)); why = `2× onder ${repsMin} reps: 1 stap lichter`; x.low = 0; }
    } else if (from) {
      x.low = 0; // binnen je bereik: zelfde gewicht, meer reps
    }
    if (to !== from) { x.weight = to; changes.push({ exId: x.exId, from, to, why }); }
  }
  return changes;
}

// ---------- Hotelkamer ----------
// In een hotelkamer heb je geen stang om aan te hangen of liggers voor dips.
const HOTEL_BLOCK = new Set(["pullup", "chinup", "hanging_raise", "dips"]);
const HOTEL_MAP = {
  bodyweight: {
    bench: "pushup", db_bench: "pushup", incline_db: "pushup", chest_press: "pushup", cable_fly: "incline_pushup", pec_deck: "incline_pushup",
    dips: "bench_dips", barbell_row: "inverted_row", db_row: "inverted_row", seated_row: "inverted_row", lat_pulldown: "inverted_row",
    pullup: "inverted_row", chinup: "inverted_row", face_pull: "superman", rear_delt: "superman",
    ohp: "pike_pushup", db_shoulder: "pike_pushup", lateral_raise: "pike_pushup", cable_lateral: "pike_pushup",
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

function hotelPool(profile, mode, extra) {
  return pool({ ...profile, location: mode === "dumbbell" ? "home" : "bodyweight" }, extra).filter((e) => !HOTEL_BLOCK.has(e.id) && e.eq !== "kettlebell");
}

function bwDose(ex, old) {
  if (ex.timed) return { sets: old?.sets || 3, secs: old?.secs || 40, repsMin: 0, repsMax: 0, rest: 60 };
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
    if (okIds.has(x.exId) && !used.has(x.exId)) { used.add(x.exId); out.push(x); continue; }
    let to = HOTEL_MAP[mode][x.exId];
    if (to === null && mode === "bodyweight") { changes.push(`${e?.name} geschrapt: zonder spullen is er geen goede biceps-oefening (je biceps werken mee bij de rows).`); continue; }
    if (!to || !okIds.has(to) || used.has(to)) {
      to = ok.find((o) => o.muscle === e?.muscle && o.kind === e?.kind && !used.has(o.id))?.id;
    }
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
    : "Hotelkamer-versie. Maak het zwaarder door 3 tellen te zakken en 1 tel stil te houden. Inverted row: onder een stevig bureau, test eerst of het niet wegschuift.";
  if (!changes.length) changes.push("Deze training kan al zonder spullen.");
  return { routine: r, changes };
}

// C: snelle hotelkamer-training (full body, supersets, korte finisher)
export function generateHotel(profile, { minutes = 30, mode = "bodyweight" } = {}, extra = []) {
  const ok = hotelPool(profile, mode, extra);
  const slots = [
    ["benen", "c", ["bulgarian", "split_squat_bw", "goblet_squat", "bw_squat", "lunge", "step_up"]],
    ["borst", "c", ["db_bench", "pushup", "incline_pushup"]],
    ["rug", "c", ["db_row", "inverted_row", "superman"]],
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
