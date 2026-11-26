import { EXERCISES, MUSCLES, EQUIPMENT, INJURIES } from "./data.js";
import { uid, SPLITS, generatePlan, generateCircuit, adjustRoutine, suggestNext, progressRoutine, hotelRoutine, regenerateDay, swapExercise, increment, dosage, fixBwReps, preferLiked, hotelPool, bwDose, uid as newId } from "./coach.js";
import { howto as howtoCurated, videoUrl, imgsFor } from "./howto.js";

// ---------- State ----------
const KEY = "forge-v1";
const DEFAULT = {
  tab: "today",
  profile: { goals: ["spiermassa"], level: "beginner", days: 3, minutes: 50, location: "gym", injuries: [], split: "auto", cardioMin: 0, cardioEx: "bike", done: false },
  routines: [], workouts: [], customExercises: [], disliked: [], likes: {},
  prefs: { mode: "kracht", place: "gym", hotelEq: "bodyweight", circMin: 20, cardioEx: "bike", cardioMin: 30 },
  active: null, nextIdx: 0, settings: {},
};
let S, raw = {};
try { raw = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch {}
if (!raw || typeof raw !== "object" || Array.isArray(raw)) raw = {};
S = { ...structuredClone(DEFAULT), ...raw };
// De app die nu op je telefoon staat (v7) had nog geen prefs: die gegevens zetten we één keer om.
const fromV7 = !!raw.profile && !raw.prefs;
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
S.profile = { ...DEFAULT.profile, ...obj(S.profile) };
S.prefs = { ...DEFAULT.prefs, ...obj(S.prefs) };
// Kapotte of oude vormen rechtzetten, anders start de app niet
for (const k of ["routines", "workouts", "customExercises", "disliked"]) if (!Array.isArray(S[k])) S[k] = [];
S.routines = S.routines.filter((r) => r && Array.isArray(r.exercises));
S.routines.forEach((r) => { r.exercises = r.exercises.filter((x) => x && x.exId); });
S.workouts = S.workouts.filter((w) => w && Array.isArray(w.exercises));
S.workouts.forEach((w) => { w.exercises = w.exercises.filter((e) => e && Array.isArray(e.sets)); w.exercises.forEach((e) => { e.sets = e.sets.filter((s) => s && typeof s === "object"); }); });
S.customExercises = S.customExercises.filter((e) => e && e.id);
S.customExercises.forEach((e) => { if (!Array.isArray(e.avoid)) e.avoid = []; e.custom = true; }); // v7: eigen oefeningen hadden geen custom-vlag
if (S.active && (!Array.isArray(S.active.exercises) || S.active.exercises.some((e) => !e || !Array.isArray(e.sets)))) S.active = null;
S.active?.exercises.forEach((e) => { e.plan = obj(e.plan); });
if (!Array.isArray(S.profile.injuries)) S.profile.injuries = [];
// Doelen: oud "conditie" = "fit"; nooit zonder doel
S.profile.goals = [...new Set((Array.isArray(S.profile.goals) ? S.profile.goals : []).map((g) => (g === "conditie" ? "fit" : g)).filter((g) => ["spiermassa", "kracht", "fit"].includes(g)))];
if (!S.profile.goals.length) S.profile.goals = ["spiermassa"];
S.profile.minutes = Math.min(90, Math.max(20, Number(S.profile.minutes) || 50));
// Oud "Waar train je meestal?": thuis of zonder spullen wordt de Hotel-stand; het schema zelf is altijd voor de sportschool
if (S.profile.location !== "gym") {
  if (fromV7) { Object.assign(S.prefs, { place: "hotel", hotelEq: S.profile.location === "home" ? "dumbbell" : "bodyweight" }); S.v7Hotel = true; }
  S.profile.location = "gym";
}
// De AI-chat is weg: sleutel en gesprek niet bewaren
if (S.settings && typeof S.settings === "object") delete S.settings.apiKey;
delete S.chat;
if (![0, 10, 20].includes(Number(S.profile.cardioMin))) S.profile.cardioMin = 0;
S.profile.cardioMin = Number(S.profile.cardioMin);
if (!["kracht", "circuit", "cardio"].includes(S.prefs.mode)) S.prefs.mode = "kracht";
S.prefs.cardioMin = Number(S.prefs.cardioMin) || 30;
// Wat je fijn vindt: { oefening: score }, van -3 (liever niet) tot 3 (liever wel); 5 = ❤️ favoriet (zelf gekozen).
// Een oude 4 (van vaak 👍) wordt 3: alleen een echte ❤️ blijft ❤️.
S.likes = S.likes && typeof S.likes === "object" && !Array.isArray(S.likes) ? S.likes : {};
for (const [id, v] of Object.entries(S.likes)) { let n = Math.max(-3, Math.min(5, Math.round(Number(v)) || 0)); if (n === 4) n = 3; if (n) S.likes[id] = n; else delete S.likes[id]; }
S.upgrade = S.upgrade || {}; // makkelijke variant → zwaardere (zonder gewicht)
S.deload = S.deload || {};   // rustweek: { until, last, snooze }
if (!["today", "progress", "profile"].includes(S.tab)) S.tab = "today";
// Schema = alleen krachttrainingen. Oude circuits bewaren we apart en je volgende workout blijft dezelfde.
{
  const all = S.routines, keep = all.filter((r) => r.type !== "circuit");
  if (keep.length < all.length) {
    const ni = Number(S.nextIdx) || 0;
    const nx = [...all.slice(ni % all.length), ...all].find((r) => r.type !== "circuit");
    S.nextIdx = Math.max(0, keep.indexOf(nx));
    S.oldCircuits = [...(Array.isArray(S.oldCircuits) ? S.oldCircuits : []), ...all.filter((r) => r.type === "circuit")];
  }
  S.routines = keep;
}
if (!Array.isArray(S.oldRoutines)) S.oldRoutines = []; // eigen (niet-coach) schema's van vroeger, alleen bewaard
// Eerste keer na de update: de vernieuwde coach biedt één keer een nieuw schema aan (bestaande kaart)
if (fromV7 && S.profile.done && S.routines.length) S.profDirty = "coach";
S.routines.forEach((r) => fixBwReps(r, (id) => [...EXERCISES, ...(S.customExercises || [])].find((e) => e.id === id)));
// Stang, kabel en machine gaan per 2,5 kg: oude doelen (bijv. 16,25) één keer afronden. Dumbbells laten we staan.
{
  const find = (id) => [...EXERCISES, ...(S.customExercises || [])].find((e) => e.id === id);
  S.routines.forEach((r) => r.exercises.forEach((x) => {
    const w = Number(x.weight) || 0;
    if (w > 0 && ["barbell", "cable", "machine"].includes(find(x.exId)?.eq) && Math.abs(w / 2.5 - Math.round(w / 2.5)) > 1e-9) x.weight = Math.max(2.5, Math.round(w / 2.5) * 2.5);
  }));
}

let saveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast("Opslaan mislukt"); } }, 150);
}
const saveNow = () => { clearTimeout(saveT); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast("Opslaan mislukt"); } };
// Nieuw schema: je eigen (niet door de coach gemaakte) workouts gooien we nooit weg, we bewaren ze apart
const archiveRoutines = () => { const mine = S.routines.filter((r) => r.source !== "coach"); if (mine.length) S.oldRoutines = [...(Array.isArray(S.oldRoutines) ? S.oldRoutines : []), ...mine]; };
// Nieuw schema = nieuwe coach: de oude keuze "geen automatische gewichten" vervalt
// Je eigen workout (niet van de coach) wordt vervangen? Dan blijft het origineel bij Oude workouts (niet dubbel)
const keepOwn = (r) => {
  if (!r || r.source === "coach") return false;
  const old = Array.isArray(S.oldRoutines) ? S.oldRoutines : [];
  const ids = (x) => JSON.stringify((x.exercises || []).map((e) => e.exId));
  if (!old.some((o) => o.id === r.id && ids(o) === ids(r))) S.oldRoutines = [...old, structuredClone(r)];
  return true;
};
// Nieuwe blessure in je profiel: de coach wisselt meteen de oefeningen die hem belasten (sets blijven, geen oud gewicht)
function applyInjury(inj) {
  const msgs = [];
  S.routines.forEach((r, k) => {
    const bad = r.exercises.filter((x) => exById(x.exId)?.avoid?.includes(inj));
    if (!bad.length) return;
    keepOwn(r); // een eigen workout blijft in het origineel bij Oude workouts
    const nr = { ...r, exercises: [...r.exercises] };
    for (const x of bad) {
      const alt = swapExercise(profileFor(), nr, x.exId, coachExtra(r));
      const j = nr.exercises.findIndex((y) => y.exId === x.exId);
      if (alt) { nr.exercises[j] = { ...alt, sets: x.sets }; msgs.push(`${exName(x.exId)} → ${exName(alt.exId)}`); }
      else if (nr.exercises.length > 2) { nr.exercises.splice(j, 1); msgs.push(`${exName(x.exId)} geschrapt`); }
    }
    S.routines[k] = nr;
  });
  U.hotel = null; U.circ = null;
  if (msgs.length) toast(`${andList(msgs)} (${inj})`);
}
const freshCoach = () => { archiveRoutines(); if (S.settings && typeof S.settings === "object") delete S.settings.autoWeights; };
navigator.storage?.persist?.();

// UI-state (niet opgeslagen)
const dayKey = () => new Date().toDateString();
// seen/cAvoid/hotelSeen: wat je met "Andere workout" al wegtikte, zodat je niet steeds dezelfde terugkrijgt
const U = { rest: null, circuit: null, override: null, circ: null, cSeed: 0, cAvoid: null, seen: null, hotelSeen: null, hotel: null, picker: null, progEx: null, rating: null };

// ---------- Helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let EXTRA = [];
const allEx = () => [...EXERCISES, ...S.customExercises, ...EXTRA];
const exById = (id) => allEx().find((e) => e.id === id);
// De coach kent de vaste en je eigen oefeningen. Bibliotheek-oefeningen die in de workout staan, geven we mee
// (alleen die, zodat de coach zelf nog steeds uit zijn eigen lijst kiest).
function coachExtra(r) {
  const ids = new Set((r?.exercises || []).map((x) => x.exId));
  return [...S.customExercises, ...EXTRA.filter((e) => ids.has(e.id))];
}
// Dag opnieuw maken: de coach kent dan ook de bibliotheek-oefeningen uit deze workout (een favoriet blijft staan).
// Rekoefeningen geven we niet mee: die laat hij gewoon staan en kiest hij nooit als hoofdoefening.
const dayExtra = (r) => coachExtra(r).filter((e) => e.cat !== "stretching");
const exName = (id) => exById(id)?.name || "Oefening";
const fmtDate = (t) => new Date(t).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
const fmtDur = (ms) => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}u ${m % 60}m` : `${m} min`; };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;
const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? 0 : n; };
const isWork = (s) => s.done && s.type !== "w";
const fmtKg = (v) => String(Math.round(num(v) * 100) / 100).replace(".", ",");
// Cardio (fiets, loopband, ...): minuten en km in plaats van kg en reps
const fmt1 = (v) => String(Math.round(num(v) * 10) / 10).replace(".", ",");
const isCardioSet = (s) => !!s && (s.mins !== undefined || s.km !== undefined);
const cardioItem = (x) => x.mins != null || !!exById(x.exId)?.cardio; // oefening in een workout
function cardioTotals(sets) {
  const d = sets.filter((s) => s.done && isCardioSet(s));
  // afronden op 0,01: 4,4 + 1,9 km is 6,3 km (en geen 6,300000000000001 = vals record)
  const sum = (k) => Math.round(d.reduce((a, s) => a + num(s[k]), 0) * 100) / 100;
  return { mins: sum("mins"), km: sum("km") };
}
function cardioText(mins, km, speed = false) {
  const t = [mins > 0 ? `${fmtKg(mins)} min` : "", km > 0 ? `${fmtKg(km)} km` : ""].filter(Boolean).join(" · ");
  return t + (speed && mins > 0 && km > 0 ? ` (${fmt1(km / (mins / 60))} km/u)` : "");
}
const bestKm = (exId) => Math.max(0, ...S.workouts.map((w) => cardioTotals(w.exercises.filter((x) => x.exId === exId).flatMap((x) => x.sets)).km));
const CARDIO_CHOICES = [["bike", "Fiets"], ["treadmill_run", "Loopband"], ["rower", "Roeien"], ["crosstrainer", "Crosstrainer"], ["stairs", "Traploper"], ["run_outside", "Buiten hardlopen"]];
const cardioLabel = (id) => CARDIO_CHOICES.find(([v]) => v === id)?.[1] || exName(id);
// Cardio die je mag doen: niet op je "niet meer doen"-lijst en spaart je blessures (net als de coach)
const cardioOk = (id) => !S.disliked.includes(id) && !(exById(id)?.avoid || []).some((a) => (S.profile.injuries || []).includes(a));
const exSub = (ex) => [MUSCLES[ex?.muscle] || ex?.muscle || "", ex?.cardio && ex.eq === "bodyweight" ? "" : EQUIPMENT[ex?.eq] || ex?.eq || ""].filter(Boolean).join(" · ");
const START_KG = { barbell: 20, dumbbell: 8, kettlebell: 12, machine: 20, cable: 15 };
// Eerste gok voor een gewicht: grote oefeningen zwaarder, en zwaarder als je al langer traint. Isolatie blijft licht.
const BIG_KG = { bench: 30, squat: 40, front_squat: 30, deadlift: 50, rdl: 30, barbell_row: 30, ohp: 20, leg_press: 60, lat_pulldown: 30, seated_row: 30 };
function startKg(ex) {
  const step = increment(ex);
  if (ex?.kind !== "compound") return START_KG[ex?.eq] || 10;
  const lvl = { beginner: 1, gemiddeld: 1.5, gevorderd: 2 }[S.profile.level] || 1;
  return Math.max(step, Math.round(((BIG_KG[ex.id] || START_KG[ex.eq] || 10) * lvl) / step) * step);
}
const LADDER = { incline_pushup: "pushup", pushup: "decline_pushup", bw_squat: "split_squat_bw", split_squat_bw: "bulgarian_bw", glute_bridge: "single_leg_bridge" };
// Zwaardere variant: loop de ladder af en neem de verste stap die mag (niet "niet meer doen", niet slecht voor je blessure, niet dubbel)
function upgradeInPlace(r) {
  if (!r || !Object.keys(S.upgrade).length) return r;
  const inj = S.profile.injuries || [];
  r.exercises.forEach((x) => {
    const ok = (id) => !S.disliked.includes(id) && !(exById(id)?.avoid || []).some((v) => inj.includes(v)) && !r.exercises.some((y) => y !== x && y.exId === id);
    let best = x.exId, id = x.exId;
    for (let n = 0; n < 5 && S.upgrade[id]; n++) { id = S.upgrade[id]; if (ok(id)) best = id; }
    x.exId = best;
  });
  return r;
}
const weekStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const deloadOn = () => S.deload.until && Date.now() < S.deload.until;
function deloadDue() {
  if (deloadOn() || (S.deload.snooze || 0) > Date.now()) return false;
  const weeks = new Set(S.workouts.filter((w) => w.type !== "circuit" && w.type !== "cardio" && w.start > (S.deload.last || 0)).map((w) => weekStart(w.start)));
  return weeks.size >= 6;
}
function backupDue() {
  if (S.workouts.length < 5 || (S.backupSnooze || 0) > Date.now()) return false;
  return Date.now() - (S.lastBackup || S.workouts[0].start) > 30 * 864e5;
}
// Bibliotheek-oefeningen kent de coach pas als de bibliotheek geladen is; daarna maken we de hotelversie opnieuw
const hotelKey = (base) => `${base.id}|${S.prefs.hotelEq}|${base.exercises.map((x) => x.exId).join()}${!EXTRA.length && base.exercises.some((x) => String(x.exId).startsWith("x_")) ? "|laden" : ""}`;
// De coach leert wat je fijn vindt: 👍 = +1 en 👎 = −1 per oefening die je deed (stil, van −3 tot 3).
// Vanaf 2 kiest de coach hem liever, vanaf −2 liever niet. ❤️ Favoriet = 5: alleen als jij hem zelf favoriet maakt.
// "Niet meer doen" gaat altijd voor.
const likeOf = (id) => S.likes[id] || 0;
const isLiked = (id) => likeOf(id) >= 2 && !S.disliked.includes(id);
const likedIds = () => Object.keys(S.likes).filter(isLiked);
const lessIds = () => Object.keys(S.likes).filter((id) => likeOf(id) <= -2);
const isFav = (id) => likeOf(id) >= 5 && !S.disliked.includes(id);
const favIds = () => Object.keys(S.likes).filter(isFav);
// 👍/👎 sturen stil bij (hooguit +3, minstens −3). Een ❤️ die je zelf zette blijft staan; cardio telt niet mee.
function rateLike(id, d) { const v = likeOf(id); if (v >= 5 || exById(id)?.cardio) return; const n = Math.max(-3, Math.min(3, v + d)); if (n) S.likes[id] = n; else delete S.likes[id]; }
const heart = (id) => (isFav(id) ? ` <span class="heart">❤️</span>` : "");
const favChip = (id, i) => `<button class="chip fav ${isFav(id) ? "on" : ""}" data-act="fav" data-id="${esc(id)}"${i != null ? ` data-i="${i}"` : ""}>${isFav(id) ? "❤️ Favoriet" : "🤍 Maak favoriet"}</button>`;
// "A", "A en B", "A, B en C", "A, B en 3 andere oefeningen"
const andList = (n) => (n.length > 3 ? `${n.slice(0, 2).join(", ")} en ${n.length - 2} andere oefeningen` : n.length > 1 ? `${n.slice(0, -1).join(", ")} en ${n.at(-1)}` : n[0] || "");
const profileFor = (extra = {}) => ({ ...S.profile, location: "gym", exclude: S.disliked, prefer: likedIds(), fav: favIds(), lessPreferred: lessIds(), ...extra });
// In een hotel kies je bij "Andere oefening" uit wat je daar hebt: geen stang, geen machines. Cardio blijft cardio.
const HOTEL_NO = ["pullup", "chinup", "hanging_raise", "dips", "inverted_row", "kb_swing"];
const swapProfile = (exId) => (S.prefs.place === "hotel" && !exById(exId)?.cardio
  ? profileFor({ location: S.prefs.hotelEq === "dumbbell" ? "home" : "bodyweight", exclude: [...S.disliked, ...HOTEL_NO] })
  : profileFor());
// Pas aan › Iets doet pijn: vervangers uit wat je hier hebt (in het hotel geen machines of stang)
const placeProfile = () => (S.prefs.place === "hotel" && S.prefs.mode !== "cardio" ? profileFor({ location: S.prefs.hotelEq === "dumbbell" ? "home" : "bodyweight", exclude: [...S.disliked, ...HOTEL_NO] }) : profileFor());
const ICON = {
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
};

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
}

// Oefening-bibliotheek op de achtergrond laden (voor "zelf kiezen" en uitleg)
// Cardio uit de bibliotheek telt ook in minuten en km; dubbelen van onze eigen cardio-oefeningen verbergen we in de lijst.
const CARDIO_DUP = new Set(["Bicycling_Stationary", "Running_Treadmill", "Walking_Treadmill", "Rowing_Stationary", "Elliptical_Trainer", "Stairmaster", "Trail_Running_Walking"]);
function loadExtra() {
  import("./exercises-db.js").then((m) => {
    EXTRA = m.DB.map(([id, name, muscle, eq, kind, cat, level, folder, instr]) => {
      const cardio = cat === "cardio";
      return { id: "x_" + id, name, muscle: cardio ? "cardio" : muscle, eq, kind, cat, level, folder, instr, avoid: [], timed: cat === "stretching", ...(cardio ? { cardio: true, hide: CARDIO_DUP.has(id) } : {}) };
    });
    if (U.picker) refreshPicker();
    // namen van bibliotheek-oefeningen staan nu klaar
    else if ($("#sheet").hidden && !U.circuit && !(S.active && U.showActive) && !document.activeElement?.matches?.("input, select, textarea")) render();
  }).catch(() => {});
}
function howto(id) {
  const e = id.startsWith("x_") ? EXTRA.find((x) => x.id === id) : null;
  if (e) return { imgs: imgsFor(e.folder), cues: e.instr || [], en: true };
  return howtoCurated(id);
}
function thumb(id) {
  const img = howto(id).imgs[0];
  return img ? `<img class="thumb" src="${img}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="thumb ph">${esc(exName(id)[0] || "?")}</span>`;
}

// Geluid en scherm aan
let actx;
function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } actx?.resume?.(); }
function beep(freq = 880, dur = 0.15, times = 1) {
  if (!actx) return;
  for (let i = 0; i < times; i++) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
    const t = actx.currentTime + i * (dur + 0.08);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }
  navigator.vibrate?.(200);
}
function flash(msg) {
  const f = document.createElement("div"); f.className = "flash"; f.textContent = msg;
  document.body.appendChild(f); setTimeout(() => f.remove(), 1600);
}
let wakeLock;
async function keepAwake(on) {
  try { if (on && "wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); else { await wakeLock?.release(); wakeLock = null; } } catch {}
}

// ---------- De workout van vandaag ----------
function strengthPlan() {
  if (!S.routines.length) { S.routines = generatePlan(profileFor(), S.customExercises); S.nextIdx = 0; save(); }
  return S.routines;
}
function baseRoutine() { const p = strengthPlan(); return p[S.nextIdx % p.length]; }

function setOverride(o) { U.override = o; S.override = o ? { day: dayKey(), o } : null; }
// Cardio-modus: één oefening (apparaat en minuten uit het keuzemenu). Telt niet mee voor je krachtschema.
function cardioWorkout() {
  const exId = S.prefs.cardioEx || "bike", mins = Number(S.prefs.cardioMin) || 30;
  return { id: "cardio", name: `Cardio · ${cardioLabel(exId)}`, type: "cardio", source: "coach", exercises: [{ exId, sets: 1, mins, repsMin: 0, repsMax: 0, rest: 0 }] };
}
function todayWorkout() {
  if (S.prefs.mode === "cardio") return { r: cardioWorkout(), temp: true, cardio: true };
  if (!U.override && S.override?.day === dayKey()) U.override = S.override.o;
  if (U.override) return U.override;
  if (S.prefs.mode === "circuit") {
    const loc = S.prefs.place === "hotel" ? (S.prefs.hotelEq === "dumbbell" ? "home" : "bodyweight") : "gym";
    const key = `${loc}|${S.prefs.circMin}|${U.cSeed}`;
    if (!U.circ || U.circ._key !== key) {
      const noBar = S.prefs.place === "hotel" ? ["pullup", "chinup", "hanging_raise", "dips", "inverted_row"] : [];
      U.circ = upgradeInPlace(generateCircuit(profileFor({ location: loc, exclude: [...S.disliked, ...noBar] }), { minutes: S.prefs.circMin, seed: U.cSeed, avoid: U.cAvoid?.cur, seen: U.cAvoid?.seen }, S.customExercises));
      U.circ._key = key;
    }
    return { r: U.circ, temp: true };
  }
  const base = upgradeInPlace(baseRoutine());
  if (S.prefs.place === "hotel") {
    const key = hotelKey(base);
    if (!U.hotel || U.hotel.key !== key) { U.hotel = { key, r: upgradeInPlace(hotelRoutine(base, S.prefs.hotelEq, profileFor(), coachExtra(base)).routine) }; U.hotelSeen = null; }
    return { r: U.hotel.r, temp: true, from: base.id, hotel: true };
  }
  return { r: base };
}

function estMinutes(r) {
  if (r.type === "circuit") return Math.round((r.exercises.length * (r.work + r.restBetween) * r.rounds + (r.rounds - 1) * (r.roundRest || 60)) / 60);
  return Math.round(r.exercises.reduce((a, x) => a + (cardioItem(x) ? (num(x.mins) || 20) * 60 * (x.sets || 1) : (x.sets || 3) * (45 + (x.rest || 90))), 0) / 60);
}

// ---------- Render ----------
const TITLES = { today: "Vandaag", progress: "Voortgang", profile: "Profiel" };
function render() {
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === S.tab));
  $("#title").textContent = TITLES[S.tab];
  $("#topaction").innerHTML = "";
  $("#view").innerHTML = ({ today: viewToday, progress: viewProgress, profile: viewProfile })[S.tab]();
  renderOverlay();
}

function seg(key, opts) {
  return `<div class="seg">${opts.map(([v, l]) => `<button class="${S.prefs[key] === v ? "on" : ""}" data-act="pref" data-k="${key}" data-v="${v}">${l}</button>`).join("")}</div>`;
}

function weekCount() {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return S.workouts.filter((w) => w.start >= d.getTime()).length;
}

function modeLabel() {
  const p = S.prefs;
  if (p.mode === "cardio") return `<b>🚴 Cardio ${p.cardioMin} min</b> · ${esc(cardioLabel(p.cardioEx))}`;
  const a = p.mode === "kracht" ? "💪 Gewichten" : `⚡ Circuit ${p.circMin} min`;
  const b = p.place === "gym" ? "Sportschool" : `🏨 Hotel · ${p.hotelEq === "dumbbell" ? "dumbbells" : "geen spullen"}`;
  return `<b>${a}</b> · ${b}`;
}
function modeSheetHtml() {
  const chips = (key, opts) => `<div class="chips" style="margin:-4px 0 10px">${opts.map(([v, l]) => `<button class="chip ${String(S.prefs[key]) === String(v) ? "on" : ""}" data-act="pref" data-k="${key}" data-v="${v}">${l}</button>`).join("")}</div>`;
  let m = `<div class="row between"><h3>Wat ga je doen?</h3><button class="icon-btn" data-act="closeSheet" aria-label="Sluiten">${ICON.close}</button></div><p class="flabel">Soort training</p>`;
  m += seg("mode", [["kracht", "💪 Gewichten"], ["circuit", "⚡ Circuit"], ["cardio", "🚴 Cardio"]]);
  if (S.prefs.mode === "circuit") m += chips("circMin", [10, 20, 30].map((v) => [v, `${v} min`]));
  if (S.prefs.mode === "cardio") m += chips("cardioEx", CARDIO_CHOICES.filter(([v]) => cardioOk(v) || S.prefs.cardioEx === v)) + `<p class="flabel">Hoe lang</p>` + chips("cardioMin", [20, 30, 45].map((v) => [v, `${v} min`]));
  m += `<p class="flabel">Waar</p>`;
  m += seg("place", [["gym", "Sportschool"], ["hotel", "🏨 Hotel"]]);
  if (S.prefs.place === "hotel") m += chips("hotelEq", [["bodyweight", "Geen spullen"], ["dumbbell", "Dumbbells"]]);
  return m + `<button class="btn primary block" style="margin-top:14px" data-act="closeSheet">Klaar</button>`;
}
function weekDots() {
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const today = (new Date().getDay() + 6) % 7;
  const days = ["ma", "di", "wo", "do", "vr", "za", "zo"].map((l, i) => {
    const a = mon.getTime() + i * 864e5, b = a + 864e5;
    const did = S.workouts.some((w) => w.start >= a && w.start < b);
    return `<div class="wd ${did ? "did" : ""} ${i === today ? "now" : ""}"><i>${did ? "✓" : ""}</i><span>${l}</span></div>`;
  }).join("");
  const n = weekCount(), goal = S.profile.days;
  return `<div class="card week"><div class="row between"><b>Deze week</b><span class="small ${n >= goal ? "accent" : "muted"}">${n} van ${goal}${n >= goal ? " · doel gehaald 🔥" : ""}</span></div><div class="wdots">${days}</div></div>`;
}

function viewToday() {
  if (!S.profile.done) {
    return `<div class="card hero"><h3>Welkom bij Forge 💪</h3><p class="muted small">Vertel je coach in 1 minuut wat je wilt. Daarna maakt hij je workouts.</p>
      <button class="btn primary block" style="margin-top:10px" data-act="tab" data-tab="profile">Starten</button></div>`;
  }
  let h = "";
  if (S.active) h += `<div class="card hero"><h3>Training bezig</h3><p class="muted small">${esc(S.active.name)}</p><button class="btn primary block" data-act="openActive">Verder trainen</button></div>`;
  h += `<button class="modebar" data-act="modeSheet"><span class="grow">${modeLabel()}</span><span class="small muted">wijzig ⌄</span></button>`;

  const { r, cardio } = todayWorkout();
  const circ = r.type === "circuit", n = r.exercises.length;
  const prevC = cardio ? lastCardio(r.exercises[0].exId) : null;
  const dose = (x) => circ ? `${r.work}s` : cardioItem(x) ? `${num(x.mins) || 20} min` : x.secs ? `${x.sets}×${x.secs}s` : `${x.sets}×${x.repsMin}-${x.repsMax}`;
  h += `<div class="card today">
    <div class="row between"><h3 class="grow">${esc(r.name)}</h3>${r.rating === "up" ? `<span class="tag accent">👍</span>` : ""}${U.override && !cardio ? `<span class="tag">aangepast</span>` : ""}</div>
    <p class="small muted">${prevC ? `Vorige keer: ${cardioText(prevC.mins, prevC.km)}` : `${cardio ? "" : `${n} oefening${n === 1 ? "" : "en"} · `}±${estMinutes(r)} min${circ ? ` · ${r.rounds} rondes van ${r.work}s` : ""}`}</p>
    <div class="exlist">${r.exercises.map((x, i) => `<div class="list-item" data-act="editEx" data-i="${i}">${thumb(x.exId)}<span class="grow">${esc(exName(x.exId))}${heart(x.exId)}</span><span class="small muted">${dose(x)}${x.weight && !cardioItem(x) ? ` · ${fmtKg(x.weight)} kg` : ""}</span><span class="edit-dot">›</span></div>`).join("")}
      ${cardio ? "" : `<button class="sl add" style="margin-top:6px" data-act="addToday">${ICON.plus} Oefening toevoegen</button>`}</div>
    <button class="btn primary block big" data-act="startToday" ${S.active ? "disabled" : ""}>Start</button>
    ${cardio ? "" : `<div class="row" style="justify-content:space-between;margin-top:8px">
      <button class="btn ghost sm" data-act="another">↻ Andere workout</button>
      ${U.override ? `<button class="btn ghost sm" data-act="resetOverride">↺ Origineel</button>` : `<button class="btn ghost sm" data-act="adjust">Pas aan</button>`}
    </div>`}</div>`;
  if (S.prefs.mode === "kracht" && deloadOn()) h = `<div class="card note">😌 <b>Rustweek</b> · alles ±10% lichter en 1 set minder. Geniet ervan.</div>` + h;
  else if (S.prefs.mode === "kracht" && !S.active && deloadDue()) h += `<div class="card note"><b>😌 Tijd voor een rustweek?</b><p class="small muted" style="margin:4px 0 10px">Je traint al 6 weken op rij. Een week ±10% lichter en 1 set minder laat je lichaam herstellen. Daarna ga je sterker verder.</p><div class="row" style="gap:8px"><button class="btn primary sm" data-act="deloadYes">Ja, rustweek</button><button class="btn ghost sm" data-act="deloadNo">Nu niet</button></div></div>`;
  if (S.profDirty) {
    // Bovenaan, zodat je hem ook op een kleine iPhone meteen ziet
    const mine = S.routines.filter((r) => r.source !== "coach" && r.type !== "circuit"), many = mine.length > 1;
    // eigen circuits uit de oude app staan al bij Oude workouts (alleen bij de eenmalige coach-melding noemen)
    const circs = S.profDirty === "coach" ? (S.oldCircuits || []).filter((r) => r.source !== "coach") : [], mc = circs.length > 1;
    const names = (rs) => rs.map((r) => `<b>${esc(r.name)}</b>`).join(", ");
    const lines = [
      mine.length ? `Kies je Nieuw schema, dan ${many ? "blijven" : "blijft"} je eigen workout${many ? "s" : ""} ${names(mine)} bewaard onder Profiel › Oude workouts. Zo laten: ${many ? "ze blijven" : "hij blijft"} in je schema.` : "",
      circs.length ? `Je eigen circuit${mc ? "s" : ""} ${names(circs)} ${mc ? "staan" : "staat"} al onder Profiel › Oude workouts.` : "",
      S.profDirty === "coach" && S.v7Hotel && S.prefs.place === "hotel" ? "Je trainde thuis, dus bovenaan staat nu 🏨 Hotel. In de sportschool? Wissel daar." : "",
    ].filter(Boolean).map((t) => `<p class="small muted" style="margin:0 0 6px">${t}</p>`).join("");
    h = `<div class="card note"><b>${S.profDirty === "coach" ? "✨ Je coach is vernieuwd" : "✏️ Je profiel is gewijzigd"}</b><p class="small muted" style="margin:4px 0 6px">Wil je dat de coach je workouts opnieuw maakt? Je gewichten en geschiedenis blijven bewaard.</p>${lines}<div class="row" style="gap:8px;margin-top:10px"><button class="btn primary sm" data-act="newPlanNow">Nieuw schema</button><button class="btn ghost sm" data-act="keepPlan">Zo laten</button></div></div>` + h;
  }
  h += weekDots();
  if (backupDue()) h += `<div class="card note"><b>💾 Even een back-up maken?</b><p class="small muted" style="margin:4px 0 10px">Je trainingen staan alleen op deze telefoon. Bewaar af en toe een kopie in iCloud of je mail.</p><div class="row" style="gap:8px"><button class="btn primary sm" data-act="exportData">Back-up maken</button><button class="btn ghost sm" data-act="backupLater">Later</button></div></div>`;
  return h;
}

// ---------- Voortgang ----------
function streakWeeks() {
  if (!S.workouts.length) return 0;
  const wk = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
  const weeks = new Set(S.workouts.map((w) => wk(w.start)));
  let cur = wk(Date.now()), n = 0;
  if (!weeks.has(cur)) cur -= 7 * 864e5;
  while (weeks.has(cur)) { n++; cur -= 7 * 864e5; }
  return n;
}
function viewProgress() {
  if (!S.workouts.length) return `<div class="empty"><p>Nog geen workouts.</p><p class="small">Na je eerste training zie je hier je vooruitgang.</p></div>`;
  let h = `<div class="stats"><div class="stat"><b>${weekCount()}</b><span>deze week</span></div><div class="stat"><b>${S.workouts.length}</b><span>totaal</span></div><div class="stat"><b>${streakWeeks()}</b><span>weken op rij</span></div></div>`;
  const hasKg = (e) => e.sets.some((s) => isWork(s) && num(s.w) > 0);
  const hasCardio = (e) => e.sets.some((s) => isWork(s) && isCardioSet(s) && (num(s.mins) > 0 || num(s.km) > 0));
  const logged = [...new Set(S.workouts.flatMap((w) => w.exercises.filter((e) => hasKg(e) || hasCardio(e)).map((e) => e.exId)))];
  if (logged.length) {
    if (!U.progEx || !logged.includes(U.progEx)) U.progEx = logged[0];
    const sessions = S.workouts.map((w) => ({ t: w.start, e: w.exercises.find((x) => x.exId === U.progEx) })).filter((x) => x.e);
    let points, unit = "kg";
    if (sessions.some((x) => hasCardio(x.e))) {
      // cardio: km per training, of minuten als je nooit km hebt ingevuld
      const tot = sessions.map((x) => ({ t: x.t, ...cardioTotals(x.e.sets) }));
      unit = tot.some((x) => x.km > 0) ? "km" : "min";
      points = tot.map((x) => ({ t: x.t, v: unit === "km" ? x.km : x.mins })).filter((p) => p.v > 0);
    } else {
      points = sessions.map(({ t, e }) => { const done = e.sets.filter(isWork); return done.length ? { t, v: Math.max(...done.map((s) => num(s.w))) } : null; }).filter(Boolean);
    }
    h += `<h2>Per oefening</h2><div class="card"><select id="progEx">${logged.map((id) => `<option value="${id}" ${id === U.progEx ? "selected" : ""}>${esc(exName(id))}</option>`).join("")}</select>${lineChart(points, unit)}</div>`;
  }
  const prs = S.workouts.flatMap((w) => (w.prs || []).map((p) => ({ ...p, t: w.start }))).slice(-5).reverse();
  if (prs.length) h += `<h2>Records 🏆</h2><div class="card">${prs.map((p) => `<div class="list-item"><div class="grow"><b>${esc(exName(p.exId))}</b><div class="small muted">${esc(p.text)}</div></div><span class="small muted">${fmtDate(p.t)}</span></div>`).join("")}</div>`;
  const kmOf = (w) => w.exercises.reduce((a, e) => a + cardioTotals(e.sets).km, 0);
  h += `<h2>Geschiedenis</h2>` + S.workouts.slice().reverse().map((w) => `<div class="card tap" data-act="showWorkout" data-id="${w.id}"><div class="row between"><b>${esc(w.name)}</b><span class="small muted">${fmtDate(w.start)}</span></div><div class="small muted">${fmtDur(w.end - w.start)}${kmOf(w) ? ` · ${fmtKg(kmOf(w))} km` : ""}${w.rating ? ` · ${w.rating === "up" ? "👍" : "👎"}` : ""}${w.prs?.length ? ` · 🏆 ${w.prs.length}` : ""}</div></div>`).join("");
  return h;
}
function lineChart(points, unit = "kg") {
  const f = (v) => `${fmtKg(v)} ${unit}`;
  if (points.length < 2) return `<p class="small muted" style="margin-top:8px">${points.length ? `Eerste keer: ${f(points[0].v)}. Na de volgende training zie je hier je lijn.` : ""}</p>`;
  const W = 320, H = 160, pad = 46;
  const vs = points.map((p) => p.v), min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1;
  const x = (i) => pad + (i / (points.length - 1)) * (W - pad - 10);
  const y = (v) => H - 22 - ((v - min) / span) * (H - 44);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><text x="2" y="${y(max) + 4}">${f(max)}</text>${max !== min ? `<text x="2" y="${y(min) + 4}">${f(min)}</text>` : ""}
    <path d="${d}" stroke="var(--accent)" stroke-width="2.5"/>${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="3.5" fill="var(--accent)" stroke="none"/>`).join("")}</svg>`;
}

// ---------- Profiel ----------
function viewProfile() {
  const p = S.profile;
  // alleen je echte ❤️ favorieten (die je zelf koos); wat de coach van je 👍 leerde, blijft stil
  const favs = favIds().sort((a, b) => exName(a).localeCompare(exName(b)));
  const multi = (key, opts) => `<div class="chips">${opts.map(([v, l]) => `<button class="chip ${p[key].includes(v) ? "on" : ""}" data-act="profToggle" data-k="${key}" data-v="${v}">${l}</button>`).join("")}</div>`;
  const single = (key, opts) => `<div class="chips">${opts.map(([v, l]) => `<button class="chip ${String(p[key]) === String(v) ? "on" : ""}" data-act="profSet" data-k="${key}" data-v="${v}">${l}</button>`).join("")}</div>`;
  return `<div class="card">
    <label class="field"><span>Doel</span>${multi("goals", [["spiermassa", "Spiermassa"], ["kracht", "Kracht"], ["fit", "Fit blijven"]])}</label>
    <label class="field"><span>Niveau</span>${single("level", [["beginner", "Beginner"], ["gemiddeld", "Gemiddeld"], ["gevorderd", "Gevorderd"]])}</label>
    <label class="field"><span>Trainingen per week</span>${single("days", [[2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"]])}</label>
    <label class="field"><span>Tijd per training: <b id="minLbl">${p.minutes} min</b></span><input type="range" min="20" max="90" step="5" value="${p.minutes}" data-bind="minutes"></label>
    <label class="field"><span>Cardio na krachttraining</span>${single("cardioMin", [[0, "Geen"], [10, "10 min"], [20, "20 min"]])}
      ${p.cardioMin ? `<p class="small muted" style="margin:10px 0 6px">Liefst</p>${single("cardioEx", CARDIO_CHOICES.filter(([v]) => v !== "run_outside"))}<p class="small muted" style="margin-top:8px">Komt bovenop je tijd per training.</p>` : ""}</label>
    <label class="field"><span>Indeling</span>${single("split", Object.entries(SPLITS))}</label>
    <label class="field"><span>Blessures (worden ontzien)</span>${multi("injuries", INJURIES.map((i) => [i, i[0].toUpperCase() + i.slice(1)]))}</label>
    <button class="btn primary block" data-act="${!p.done ? "profileDone" : S.profDirty ? "newPlanNow" : "newPlan"}">${!p.done ? "Klaar, maak mijn workouts" : S.profDirty === "coach" ? "✨ Maak nieuw schema" : S.profDirty ? "✏️ Gewijzigd: maak nieuw schema" : "Maak nieuw schema"}</button>
    ${p.done ? `<p class="small muted" style="margin-top:6px">Profiel gewijzigd? Tik hierop om je workouts opnieuw te laten maken.</p>` : ""}
  </div>
  ${favs.length ? `<h2>❤️ Favorieten</h2><div class="card">${favs.map((id) => `<div class="list-item">${thumb(id)}<span class="grow">${esc(exName(id))}</span><button class="btn ghost sm" data-act="unlike" data-id="${esc(id)}">Weghalen</button></div>`).join("")}</div>` : ""}
  ${S.disliked.length ? `<h2>Niet meer doen</h2><div class="card">${S.disliked.map((id) => `<div class="list-item">${thumb(id)}<span class="grow">${esc(exName(id))}</span><button class="btn ghost sm" data-act="undislike" data-id="${id}">Terugzetten</button></div>`).join("")}</div>` : ""}
  <h2>Gegevens</h2>
  <div class="card"><p class="small muted">Alles staat alleen op deze telefoon.</p>
    ${oldList().length ? `<div class="list-item" data-act="oldSheet"><span class="grow">Oude workouts (${oldList().length})</span><span class="edit-dot">›</span></div>` : ""}
    <div class="row wrap" style="margin-top:8px"><button class="btn sm" data-act="exportData">Back-up maken</button><label class="btn sm">Back-up terugzetten<input type="file" accept="application/json,.json" id="importFile" hidden></label></div>
    <button class="btn danger sm" style="margin-top:12px" data-act="resetAll">Alles wissen</button></div>`;
}

// Je oude workouts (eigen schema's en circuits van vroeger): niet in je schema, wel als workout voor vandaag
const oldList = () => [...(S.oldRoutines || []), ...(S.oldCircuits || [])];
// Een oude workout in het hotel: net als je schema omzetten naar wat je daar kunt doen (geen machines of kabels;
// zonder spullen ook geen dumbbells). Een circuit houdt zijn rondes en tijden.
function oldForPlace(r) {
  if (S.prefs.place !== "hotel") return r;
  const h = upgradeInPlace(hotelRoutine(r, S.prefs.hotelEq, profileFor(), coachExtra(r)).routine);
  if (r.type === "circuit") { h.exercises = h.exercises.map((x) => ({ exId: x.exId })); h.note = r.note; }
  return h;
}
function oldSheetHtml() {
  return `<h3>Oude workouts</h3><p class="small muted">Tik er een aan om hem vandaag te doen. Je schema blijft hetzelfde.</p>
    <div style="margin-top:6px">${oldList().map((r, i) => { const n = r.exercises?.length || 0; return `<div class="list-item" data-act="oldPick" data-i="${i}"><span class="grow"><b>${esc(r.name)}</b><div class="small muted">${r.type === "circuit" ? "Circuit · " : ""}${n} oefening${n === 1 ? "" : "en"}</div></span><span class="edit-dot">›</span></div>`; }).join("")}</div>`;
}

// ---------- Training (één oefening tegelijk) ----------
const i0 = (prev) => Math.max(0, prev.length - 1);
// before: alleen trainingen van voor dat moment (bijv. het begin van je rustweek)
function lastSetsFor(exId, before = Infinity) {
  for (let i = S.workouts.length - 1; i >= 0; i--) {
    if ((S.workouts[i].start || 0) >= before) continue;
    const e = S.workouts[i].exercises.find((x) => x.exId === exId);
    if (e && e.sets.some(isWork)) return e.sets.filter(isWork);
  }
  return [];
}
function repTarget(p, target, plan) {
  if (!plan.repsMax || !plan.repsMin) return p?.r || "";
  const clamp = (v) => Math.min(plan.repsMax, Math.max(plan.repsMin, v));
  if (p && num(p.r) > 0) {
    if (num(p.w) === num(target)) return clamp(num(p.r) + 1);
    // ander gewicht: schat via je 1RM (Epley) hoeveel reps je nu haalt
    if (num(p.w) > 0 && num(target) > 0) return clamp(Math.round(30 * ((num(p.w) * (1 + num(p.r) / 30)) / num(target) - 1)));
  }
  return plan.repsMin;
}
// Cardio: wat deed je de laatste keer op dit apparaat (totaal minuten en km)
function lastCardio(exId) {
  for (let i = S.workouts.length - 1; i >= 0; i--) {
    const e = S.workouts[i].exercises.find((x) => x.exId === exId);
    if (!e) continue;
    const t = cardioTotals(e.sets);
    if (t.mins > 0 || t.km > 0) return t;
  }
  return null;
}
function newCardioEx(exId, plan) {
  const mins = Math.max(1, Math.round(num(plan?.mins) || 20));
  const prev = lastCardio(exId);
  // even lang als vorige keer: verder komen; andere duur: zelfde tempo als doel
  const km = prev?.km ? Math.round((prev.mins > 0 ? (prev.km * mins) / prev.mins : prev.km) * 10) / 10 : 0;
  return {
    exId, cardio: true, plan: { ...(plan || {}), sets: 1, mins, repsMin: 0, repsMax: 0, rest: 0 },
    sets: [{ mins: "", km: "", done: false, pm: String(mins), pk: km ? String(km) : "" }],
    hint: `${mins} min${km ? ` · probeer verder dan ${fmtKg(km)} km` : ""}`,
    last: prev ? cardioText(prev.mins, prev.km, true) : "",
  };
}
// Wissel of sla je een oefening over, dan blijven je gedane sets staan
const keepDone = (a) => { const e = a.exercises[a.cur]; if (!e?.sets.some((s) => s.done)) return false; e.sets = e.sets.filter((s) => s.done); return true; };
// Overslaan: gedane sets blijven staan, je gaat door naar de volgende oefening
const skipEx = (a) => {
  if (keepDone(a)) { if (a.cur < a.exercises.length - 1) a.cur++; }
  else { a.exercises.splice(a.cur, 1); a.cur = Math.max(0, Math.min(a.cur, a.exercises.length - 1)); }
  U.selSet = null; U.infoOpen = false;
};
const putEx = (a, nx) => { if (keepDone(a)) { a.exercises.splice(a.cur + 1, 0, nx); a.cur++; } else a.exercises[a.cur] = nx; U.selSet = null; U.infoOpen = false; };
function newActiveEx(exId, plan) {
  const ex = exById(exId);
  if (ex?.cardio || plan?.mins != null) return newCardioEx(exId, plan);
  plan = { sets: 3, repsMin: 8, repsMax: 12, rest: 90, ...(plan || {}) };
  if (ex?.timed && !plan.secs) plan.secs = 30;
  const prev = lastSetsFor(exId);
  const sug = suggestNext(exId, plan, S.workouts, exById);
  const known = num(plan.weight || sug?.weight || prev[i0(prev)]?.w || 0);
  const weighted = !ex?.timed && ex?.eq !== "bodyweight";
  const first = weighted && !known;
  const deload = deloadOn() && !ex?.timed;
  const step = increment(ex);
  let target = known || (first ? startKg(ex) : 0);
  // Rustweek: ±10% lichter dan wat je voor de rustweek echt tilde (niet dan je nieuwe doel), altijd minstens 1 stap lichter
  const before = deload ? lastSetsFor(exId, S.deload.last || Infinity) : [];
  const base = num(before[i0(before)]?.w) || known;
  if (deload && base) target = base <= step ? base : Math.max(step, Math.min(base - step, Math.round((base * 0.9) / step) * step));
  const nSets = deload ? Math.max(Math.min(2, plan.sets), plan.sets - 1) : plan.sets;
  // Rustweek: lichter gewicht, dezelfde reps als vorige keer (geen extra reps)
  const deloadReps = (p) => plan.repsMax && plan.repsMin && p && num(p.r) > 0 ? Math.min(plan.repsMax, Math.max(plan.repsMin, num(p.r))) : (plan.repsMin || p?.r || "");
  const sets = Array.from({ length: nSets }, (_, i) => ({
    w: "", r: "", secs: "", done: false,
    pw: target ? String(target) : "",
    pr: ex?.timed ? "" : first ? plan.repsMax : deload ? deloadReps(prev[i] || prev[i0(prev)]) : repTarget(prev[i] || prev[i0(prev)], target, plan),
    ps: ex?.timed ? (prev[i]?.secs || plan.secs) : "",
  }));
  const goal = sets.map((s) => s.pr).filter(Boolean).join(" · ");
  const hint = ex?.timed ? `${nSets} × ${plan.secs} sec`
    : first ? `${nSets} × ${plan.repsMin}-${plan.repsMax} reps. ${fmtKg(target)} kg is een gok: kies een gewicht dat je net ${plan.repsMax} keer kunt.`
    : target ? `${fmtKg(target)} kg × ${goal}${deload ? " (rustweek)" : ""}`
    : `${nSets} × ${goal || `${plan.repsMin}-${plan.repsMax}`} reps`;
  const short = first ? `${nSets} × ${plan.repsMin}-${plan.repsMax} reps` : ""; // zonder "gok" zodra je begonnen bent
  let last = "";
  if (prev.length) {
    if (ex?.timed) last = prev.map((s) => `${s.secs}s`).join(" · ");
    else if (prev.every((s) => num(s.w) === num(prev[0].w))) last = `${num(prev[0].w) ? `${fmtKg(prev[0].w)} kg × ` : ""}${prev.map((s) => s.r).join(" · ")}${num(prev[0].w) ? "" : " reps"}`;
    else last = prev.map((s) => `${fmtKg(s.w)}×${s.r}`).join(" · ");
  }
  return { exId, plan, sets, hint, last, ...(short ? { short } : {}) };
}
function startWorkout(r, extra = {}) {
  unlockAudio();
  if (r.type === "circuit") return startCircuit(r);
  S.active = { id: uid(), routineId: extra.temp ? null : r.id, countsAs: extra.from || null, name: r.name, start: Date.now(), cur: 0, exercises: r.exercises.map((x) => newActiveEx(x.exId, x)), ...(r.type === "cardio" ? { type: "cardio" } : {}), ...(extra.hotel ? { hotel: true } : {}) };
  U.showActive = true; U.infoOpen = false; keepAwake(true); save(); render();
}

function renderOverlay() {
  const o = $("#overlay");
  if (U.circuit) { o.hidden = false; o.innerHTML = viewCircuit(); return; }
  if (S.active && U.showActive) { o.hidden = false; o.innerHTML = viewActive(); renderRest(); return; }
  o.hidden = true; o.innerHTML = ""; renderRest();
}

function viewActive() {
  const a = S.active;
  a.cur = Math.min(a.cur || 0, Math.max(0, a.exercises.length - 1));
  const e = a.exercises[a.cur];
  const head = `<div class="ohead"><button class="btn ghost" data-act="minimize" aria-label="Verkleinen">${ICON.down}</button><button class="btn ghost listbtn" data-act="exList" aria-label="Oefeningen">☰</button><div style="text-align:center" class="grow"><b>${esc(a.name)}</b><div class="small muted" id="elapsed">${mmss((Date.now() - a.start) / 1000)}</div></div><button class="btn good sm" data-act="finish">Klaar</button></div>`;
  if (!e) return head + `<div class="obody"><p class="muted">Geen oefeningen meer.</p><button class="btn primary block" data-act="finish">Training afronden</button></div>`;
  const ex = exById(e.exId), timed = ex?.timed, bw = ex?.eq === "bodyweight";
  const { imgs, cues, en } = howto(e.exId);
  const last = a.cur === a.exercises.length - 1;
  const nxt = a.exercises[a.cur + 1];
  // Alles gedaan (of je laatste oefening klaar)? Dan staat "Training afronden ✓" groot op de plek van "Set klaar ✓"
  const allDoneW = a.exercises.every((x) => x.sets.every((s) => s.done));
  const bigFinish = curSet(e) < 0 && (last || allDoneW); // curSet < 0: alle sets van deze oefening klaar (en geen set aangetikt)
  const back = a.cur > 0 ? `<button class="btn" data-act="prevEx" aria-label="Vorige oefening">←</button>` : "";
  const next = !last ? `<button class="btn grow" data-act="nextEx">Volgende oefening →</button>` : bigFinish ? "" : `<button class="btn grow" data-act="finish">Training afronden</button>`;
  return head + `<div class="obody">
    ${a.exercises.length > 1 ? `<div class="dots">${a.exercises.map((x, i) => `<span class="${i === a.cur ? "on" : x.sets.every((s) => s.done) ? "done" : ""}" data-act="goEx" data-i="${i}"></span>`).join("")}</div>
    <p class="small muted" style="text-align:center;margin:6px 0 10px">Oefening ${a.cur + 1} van ${a.exercises.length}</p>` : ""}
    <div class="card">
      <div class="row between"><h3 class="grow" data-act="toggleInfo">${esc(exName(e.exId))}${heart(e.exId)} <span class="info">ⓘ</span></h3><button class="icon-btn" data-act="exMenu" aria-label="Meer">${ICON.more}</button></div>
      <div class="hint">Doel: ${esc(e.short && e.sets.some((s) => s.done || (s.w !== "" && num(s.w) !== num(s.pw))) ? e.short : e.hint)}</div>
      ${e.last ? `<div class="lastline">Vorige keer: <b>${esc(e.last)}</b></div>` : ""}
      ${warmHtml(a, e)}
      ${imgs.length ? `<div class="anim big" data-act="toggleInfo"><img src="${imgs[0]}" alt=""><img class="b" src="${imgs[1] || imgs[0]}" alt=""></div>` : ""}
      ${U.infoOpen || (!imgs.length && !e.cardio) ? `<div class="inline-info">
        ${cues.length ? `${en ? `<p class="small muted">Uitleg (Engels)</p>` : ""}<ol class="cues">${cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>` : ""}
        <a class="btn sm block" href="${videoUrl(ex?.name || "")}" target="_blank" rel="noopener">▶︎ Video</a></div>` : ""}
      ${curSetHtml(e, timed, bw, last || allDoneW)}
      <div class="setlist">${e.sets.map((s, si) => {
        const val = e.cardio ? cardioText(num(s.mins || s.pm), num(s.km)) || "– min"
          : timed ? `${s.secs || s.ps || "–"}s` : `${!num(s.w || s.pw) ? (bw ? "" : "– kg × ") : `${fmtKg(s.w || s.pw)} kg × `}${s.r || s.pr || "–"} reps`;
        const ci = curSet(e);
        return `<button class="sl ${s.done ? "done" : ""} ${si === ci ? "now" : ""}" data-act="pickSet" data-si="${si}"><span class="setno">${si + 1}</span><span class="grow">${esc(val)}</span>${s.done ? `<i>✓</i>` : ""}</button>`;
      }).join("")}<button class="sl add" data-act="addSet">${ICON.plus} ${e.cardio ? "Nog een deel" : "Set erbij"}</button></div>
    </div>
    ${nxt ? `<p class="small muted" style="text-align:center;margin-top:10px">Hierna: ${esc(exName(nxt.exId))}</p>` : ""}
    ${back || next ? `<div class="row" style="margin-top:12px;gap:10px">${back}${next}</div>` : ""}</div>`;
}

function warmHtml(a, e) {
  const ex = exById(e.exId);
  if (ex?.kind !== "compound" || ex.eq === "bodyweight" || ex.timed || e.sets.some((s) => s.done)) return "";
  const firstHeavy = a.exercises.find((x) => { const y = exById(x.exId); return y?.kind === "compound" && y.eq !== "bodyweight" && !y.timed; });
  if (firstHeavy !== e) return "";
  const w = num(e.sets[0].w || e.sets[0].pw), min = ex.eq === "barbell" ? 20 : increment(ex);
  if (w < 2 * min) return "";
  // Opwarmen in ronde getallen: per 5 kg (dumbbells en kettlebells per 2 kg)
  const wStep = ex.eq === "dumbbell" || ex.eq === "kettlebell" ? 2 : 5;
  const r = (v) => Math.max(min, Math.round(v / wStep) * wStep);
  const a1 = r(w * 0.5), a2 = r(w * 0.75);
  const second = a2 > a1 && a2 < w ? ` en <b>${fmtKg(a2)} kg × 3</b>` : "";
  return `<div class="warm">🔥 Eerst opwarmen: <b>${fmtKg(a1)} kg × 8</b>${second}</div>`;
}
function curSet(e) {
  if (U.selSet != null && e.sets[U.selSet]) return U.selSet;
  const i = e.sets.findIndex((x) => !x.done);
  return i;
}
function stepper(si, k, val, ph, unit) {
  return `<div class="step"><span class="lbl">${unit}</span><div class="row"><button class="sbtn" data-act="bump" data-si="${si}" data-k="${k}" data-d="-1">−</button>
    <input type="text" inputmode="${k === "w" || k === "km" ? "decimal" : "numeric"}" autocomplete="off" enterkeyhint="done" value="${esc(String(val ?? "").replace(".", ","))}" placeholder="${esc(String(ph || 0).replace(".", ","))}" data-set="${si}.${k}"><button class="sbtn" data-act="bump" data-si="${si}" data-k="${k}" data-d="1">+</button></div></div>`;
}
// finishHere: je laatste oefening (of alles) is klaar, dan komt hier de grote knop om af te ronden
function curSetHtml(e, timed, bw, finishHere) {
  const ci = curSet(e);
  if (ci < 0) return finishHere ? `<div class="curset"><button class="btn primary block big" data-act="finish">Training afronden ✓</button></div>`
    : `<div class="curset donebox">${e.cardio ? "✓ Gedaan" : "✓ Alle sets klaar"}</div>`;
  const s = e.sets[ci];
  // Cardio telt in minuten en km: geen "sets", maar een deel (bijv. 2 stukken fietsen)
  if (e.cardio) return `<div class="curset">${e.sets.length > 1 ? `<p class="small muted" style="text-align:center">Deel ${ci + 1} van ${e.sets.length}</p>` : ""}
    <div class="steps">${stepper(ci, "mins", s.mins, s.pm, "minuten") + stepper(ci, "km", s.km, "–", "km")}</div>
    <button class="btn primary block big" data-act="toggleSet" data-si="${ci}">${s.done ? "Ongedaan maken" : "Gedaan ✓"}</button></div>`;
  return `<div class="curset"><p class="small muted" style="text-align:center">Set ${ci + 1} van ${e.sets.length}</p>
    <div class="steps">${timed ? stepper(ci, "secs", s.secs, s.ps, "seconden")
      : (bw ? "" : stepper(ci, "w", s.w, s.pw, "kg")) + stepper(ci, "r", s.r, s.pr, "reps")}</div>
    <button class="btn primary block big" data-act="toggleSet" data-si="${ci}">${s.done ? "Set ongedaan maken" : "Set klaar ✓"}</button></div>`;
}

function renderRest() {
  let bar = $("#restbar");
  if (!U.rest || !U.showActive || !S.active) { bar?.remove(); return; }
  if (!bar) { bar = document.createElement("div"); bar.id = "restbar"; document.body.appendChild(bar); }
  const left = Math.max(0, Math.ceil((U.rest.end - Date.now()) / 1000));
  bar.innerHTML = `<div class="grow"><div class="small muted">Rust</div><div class="time">${mmss(left)}</div><div class="bar"><i style="width:${(left / U.rest.total) * 100}%"></i></div></div>
    <button class="btn sm" data-act="restAdd" data-s="30">+30</button><button class="btn primary sm" data-act="restSkip">Skip</button>`;
}

setInterval(() => {
  if (S.active && U.showActive) { const el = $("#elapsed"); if (el) el.textContent = mmss((Date.now() - S.active.start) / 1000); }
  if (U.rest) {
    const left = Math.ceil((U.rest.end - Date.now()) / 1000);
    if (left <= 0) { U.rest = null; beep(988, 0.35, 2); renderRest(); flash("Volgende set! 💪"); }
    else { if (left <= 3 && U.rest.lastBeep !== left) { U.rest.lastBeep = left; beep(660, 0.1); } renderRest(); }
  }
  if (U.circuit) tickCircuit();
}, 250);

// ---------- Na de training: beoordelen ----------
function sourceIndex(a) {
  const id = a.routineId || a.countsAs;
  return id ? S.routines.findIndex((r) => r.id === id) : -1;
}
// ---------- Oefeningen-lijst tijdens het trainen: springen, slepen, weghalen, toevoegen, stoppen ----------
function exListHtml() {
  const a = S.active;
  const rows = a.exercises.map((e, i) => {
    const n = e.sets.filter((s) => s.done).length, all = e.sets.length;
    const st = n === all && all ? "✓" : n ? `${n}/${all}` : "";
    return `<div class="xrow ${i === a.cur ? "now" : ""} ${n === all && all ? "done" : ""}" data-i="${i}">
      <span class="xhandle" aria-label="Slepen">≡</span>
      <button class="xname" data-act="xGo" data-i="${i}"><b>${esc(exName(e.exId))}</b>${st ? `<span class="small muted"> · ${st}</span>` : ""}</button>
      <button class="icon-btn" data-act="xRemove" data-i="${i}" aria-label="Weghalen">${ICON.close}</button></div>`;
  }).join("");
  return `<div class="row between"><h3>Oefeningen</h3><button class="icon-btn" data-act="closeSheet" aria-label="Sluiten">${ICON.close}</button></div>
    <p class="small muted" style="margin:2px 0 10px">Tik om ernaartoe te gaan · sleep ≡ om de volgorde te veranderen</p>
    <div id="xlist">${rows || `<p class="small muted">Geen oefeningen.</p>`}</div>
    <button class="sl add" style="margin-top:8px;width:100%" data-act="xAdd">${ICON.plus} Oefening toevoegen</button>
    <button class="btn danger block" style="margin-top:16px" data-act="xStop">Training stoppen</button>`;
}
function stopHtml() {
  const done = S.active.exercises.some((e) => e.sets.some((s) => s.done));
  return `<h3>Training stoppen?</h3>
    <div class="stack" style="margin-top:12px">
      ${done ? `<button class="btn primary block" data-act="xStopSave">💾 Opslaan wat ik deed</button>` : ""}
      <button class="btn danger block" data-act="xStopDiscard">🗑 Weggooien</button>
      <button class="btn ghost block" data-act="exList">Toch doorgaan</button>
    </div>`;
}
// Slepen met het ≡-handvat (werkt met vinger en muis)
let drag = null;
document.addEventListener("pointerdown", (ev) => {
  const h = ev.target.closest(".xhandle"); if (!h || !S.active) return;
  const row = h.closest(".xrow"), list = $("#xlist");
  ev.preventDefault();
  drag = { row, list, from: +row.dataset.i, startY: ev.clientY, rows: [...list.children] };
  row.classList.add("dragging"); h.setPointerCapture?.(ev.pointerId);
});
document.addEventListener("pointermove", (ev) => {
  if (!drag) return;
  const dy = ev.clientY - drag.startY;
  drag.row.style.transform = `translateY(${dy}px)`;
  const mid = drag.row.getBoundingClientRect().top + drag.row.offsetHeight / 2;
  let to = drag.from;
  drag.rows.forEach((r, i) => { if (r === drag.row) return; const b = r.getBoundingClientRect(), m = b.top + b.height / 2 - (r.style.transform ? 0 : 0); if (i < drag.from && mid < m) to = Math.min(to, i); if (i > drag.from && mid > m) to = Math.max(to, i); });
  drag.to = to;
  const hgt = drag.row.offsetHeight + 6;
  drag.rows.forEach((r, i) => { if (r === drag.row) return; r.style.transform = (drag.from < i && i <= to) ? `translateY(${-hgt}px)` : (to <= i && i < drag.from) ? `translateY(${hgt}px)` : ""; });
});
const endDrag = () => {
  if (!drag) return;
  const { from, to } = drag; drag = null;
  if (to != null && to !== from && S.active) {
    const a = S.active, cur = a.exercises[a.cur];
    const [x] = a.exercises.splice(from, 1); a.exercises.splice(to, 0, x);
    a.cur = a.exercises.indexOf(cur); save();
  }
  if (S.active) { showSheet(exListHtml()); renderOverlay(); }
};
document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", endDrag);

function finishWorkout(force = false) {
  const a = S.active;
  const done = a.exercises.map((e) => ({ exId: e.exId, sets: e.sets.filter((s) => s.done).map(({ w, r, secs, mins, km, done }) => (e.cardio ? { mins, km, done } : { w, r, secs, done })) })).filter((e) => e.sets.length);
  const left = a.exercises.filter((e) => !e.sets.some((s) => s.done)).length;
  if (done.length && left && !force && !confirm(`Nog ${left} oefening${left > 1 ? "en" : ""} niet gedaan. Toch afronden?`)) return;
  if (!done.length) {
    if (confirm("Nog geen sets afgevinkt. Training stoppen zonder opslaan?")) { S.active = null; U.showActive = false; U.rest = null; save(); render(); }
    return;
  }
  U.rest = null; renderRest(); // geen rusttimer (en geen "Volgende set!") meer over het beoordelen heen
  U.rating = { rating: null, bad: [], done };
  showSheet(ratingHtml());
}
// 👍 = meteen klaar. 👎 = kies eerst wat je niet meer wilt. Overslaan = geen oordeel.
function ratingHtml() {
  const R = U.rating, down = R.rating === "down";
  return `<h3>Hoe was deze workout?</h3>
    <div class="pick2" style="margin-top:12px">
      <button class="tile" data-act="rate" data-v="up"><span class="ti">👍</span><b>Goed</b><span>Bewaren</span></button>
      <button class="tile ${down ? "on" : ""}" data-act="rate" data-v="down"><span class="ti">👎</span><b>Niet fijn</b><span>Volgende keer anders</span></button>
    </div>
    ${down ? `<p class="small muted" style="margin-top:16px">Wat wil je niet meer? (mag ook niets)</p>
    <div class="chips" style="margin-top:6px">${R.done.map((e) => `<button class="chip ${R.bad.includes(e.exId) ? "on bad" : ""}" data-act="rateEx" data-id="${e.exId}">${R.bad.includes(e.exId) ? "✕ " : ""}${esc(exName(e.exId))}</button>`).join("")}</div>
    <button class="btn primary block" style="margin-top:18px" data-act="saveRating">Opslaan</button>`
    : `<button class="btn ghost block" style="margin-top:14px" data-act="saveRating">Overslaan</button>`}`;
}
function tipFor(done) {
  const n = S.workouts.length, wk = weekCount(), goal = S.profile.days;
  const cardio = done.every((e) => e.sets.every(isCardioSet));
  const more = !cardio ? "Probeer volgende keer 1 rep meer per set."
    : done.some((e) => cardioTotals(e.sets).km > 0) ? "Probeer volgende keer iets verder te komen in dezelfde tijd."
    : "Vul ook je km in, dan zie je je vooruitgang.";
  if (n === 1) return cardio ? `Eerste training staat erin 💪 ${more}` : "Eerste training staat erin! Volgende keer weet ik je gewichten 💪";
  if (wk === goal) return `Weekdoel gehaald: ${goal} van ${goal} 🔥`;
  if (wk < goal) return `Nog ${goal - wk} training${goal - wk > 1 ? "en" : ""} deze week. ${more}`;
  return `Lekker bezig. ${more}`;
}
function replaceDisliked(ids) {
  const msgs = [];
  for (const id of ids) {
    if (!S.disliked.includes(id)) S.disliked.push(id);
    delete S.likes[id]; // "niet meer doen" gaat voor: geen favoriet meer
    if (S.prefs.cardioEx === id) S.prefs.cardioEx = (CARDIO_CHOICES.find(([v]) => cardioOk(v)) || ["bike"])[0];
    S.routines.forEach((r) => {
      const i = r.exercises.findIndex((x) => x.exId === id);
      if (i < 0) return;
      const alt = swapExercise(profileFor(), r, id, coachExtra(r));
      if (alt) { r.exercises[i] = alt; msgs.push(`${exName(id)} → ${exName(alt.exId)}`); }
      else { r.exercises.splice(i, 1); msgs.push(`${exName(id)} verwijderd`); }
    });
  }
  return msgs;
}
function saveRating() {
  if (!U.rating || !S.active) return; // dubbel tikken: maar één keer opslaan
  const a = S.active, R = U.rating, done = R.done;
  const prs = [];
  for (const e of done) {
    if (e.sets.some(isCardioSet)) {
      // cardio-record = verder dan ooit op dit apparaat (in één training)
      const km = cardioTotals(e.sets).km, old = bestKm(e.exId);
      if (old > 0 && km > old) prs.push({ exId: e.exId, text: `${fmtKg(km)} km (was ${fmtKg(old)})` });
      continue;
    }
    const prevSets = S.workouts.flatMap((w) => w.exercises.filter((x) => x.exId === e.exId).flatMap((x) => x.sets.filter(isWork))).filter((s) => num(s.r) > 0 || num(s.w) > 0); // een circuit (alleen seconden) telt niet
    if (!prevSets.length || exById(e.exId)?.timed) continue;
    const bestW = Math.max(...e.sets.map((s) => num(s.w))), oldW = Math.max(...prevSets.map((s) => num(s.w)));
    const bestR = Math.max(...e.sets.map((s) => num(s.r))), oldR = Math.max(...prevSets.map((s) => num(s.r)));
    if (oldW > 0 && bestW > oldW) prs.push({ exId: e.exId, text: `${fmtKg(bestW)} kg (was ${fmtKg(oldW)})` });
    else if (bestW === 0 && oldR > 0 && bestR > oldR) prs.push({ exId: e.exId, text: `${bestR} reps (was ${oldR})` });
  }
  const w = { id: a.id, name: a.name, start: a.start, end: Date.now(), exercises: done, prs, rating: R.rating, ...(a.type === "cardio" ? { type: "cardio" } : {}) };
  S.workouts.push(w);
  // De coach leert stil wat je fijn vindt: 👍 = +1, 👎 = −1 voor elke oefening die je deed (wat je "niet meer" wilt, telt niet mee).
  // In het hotel telt alleen 👎: anders gaat je sportschool-schema hotel-oefeningen voortrekken.
  const inHotel = a.hotel || (!a.routineId && a.countsAs && S.prefs.place === "hotel"); // ook een hotelworkout van voor deze update
  if (R.rating && !(inHotel && R.rating === "up")) [...new Set(done.map((e) => e.exId))].filter((id) => !R.bad.includes(id)).forEach((id) => rateLike(id, R.rating === "up" ? 1 : -1));
  const idx = sourceIndex(a);
  const notes = [];
  if (idx >= 0) {
    S.nextIdx = idx + 1;
    const changes = a.routineId && !deloadOn() && S.settings?.autoWeights !== false ? progressRoutine(S.routines[idx], done, exById).filter((c) => !R.bad.includes(c.exId)) : [];
    // Staat dezelfde oefening op een andere dag (bijv. Upper A en B)? Dan gaat het nieuwe gewicht daar ook mee.
    changes.forEach((c) => {
      const x = S.routines[idx].exercises.find((e) => e.exId === c.exId);
      S.routines.forEach((r, j) => { if (j !== idx) r.exercises.forEach((y) => { if (y.exId === c.exId && y.mins == null && y.repsMin === x?.repsMin && y.repsMax === x?.repsMax) { y.weight = c.to; y.low = 0; } }); });
    });
    // Ook de tellers (2× te zwaar, 2× gehaald) gelden voor die oefening op elke dag
    const doneIds = new Set(done.map((e) => e.exId));
    S.routines[idx].exercises.forEach((x) => {
      if (!doneIds.has(x.exId) || x.mins != null) return;
      S.routines.forEach((r, j) => { if (j !== idx) r.exercises.forEach((y) => {
        if (y.exId !== x.exId || y.mins != null || y.repsMin !== x.repsMin || y.repsMax !== x.repsMax) return;
        for (const k of ["low", "cap", "top"]) { if (x[k] === undefined) delete y[k]; else y[k] = x[k]; }
      }); });
    });
    // Alleen als je je echte schema-dag deed: een hotel- of aangepaste workout laat je schema met rust
    if (a.routineId && R.rating === "up") S.routines[idx].rating = "up";
    if (inHotel && R.rating === "down" && !R.bad.length) notes.push("Je sportschool-schema blijft hetzelfde");
    if (a.routineId && R.rating === "down") {
      const before = new Set(S.routines[idx].exercises.map((x) => x.exId));
      const own = keepOwn(S.routines[idx]);
      S.routines[idx] = regenerateDay(profileFor({ exclude: [...S.disliked, ...R.bad] }), S.routines[idx], idx, dayExtra(S.routines[idx]), 1 + Math.floor(Math.random() * 20));
      S.routines[idx].source = "coach";
      const kept = S.routines[idx].exercises.filter((x) => before.has(x.exId) && isFav(x.exId)).length;
      notes.push(`${S.routines[idx].name} krijgt volgende keer andere oefeningen${kept > 1 ? " (je favorieten blijven)" : kept ? " (je favoriet blijft)" : ""}${own ? " (je eigen versie staat bij Profiel › Oude workouts)" : ""}`);
    }
    const still = new Set(S.routines[idx].exercises.map((x) => x.exId));
    // Kort en in de volgorde van je workout: startgewichten in één regel, daarna hooguit 3 aanpassingen
    const mine = changes.filter((c) => still.has(c.exId));
    const starts = mine.filter((c) => !c.from), ups = mine.filter((c) => c.from && c.to > c.from), downs = mine.filter((c) => c.from && c.to < c.from);
    const lines = [];
    if (starts.length === 1) lines.push(`📌 ${exName(starts[0].exId)}: volgende keer ${fmtKg(starts[0].to)} kg`);
    else if (starts.length > 1) {
      // Haalde je al alle reps? Dan staat het startgewicht hoger dan wat je deed: noem die oefeningen
      const heavier = starts.filter((c) => c.to > Math.max(0, ...(done.find((e) => e.exId === c.exId)?.sets || []).filter((s) => s.type !== "w").map((s) => num(s.w))));
      lines.push(heavier.length ? `📌 Je gewichten staan erin. Volgende keer zwaarder: ${andList(heavier.map((c) => exName(c.exId)))}` : "📌 Je gewichten staan erin");
    }
    const moved = [...ups.map((c) => `💪 ${exName(c.exId)}: ${fmtKg(c.from)} → ${fmtKg(c.to)} kg, want ${c.why}`),
      ...downs.map((c) => `${exName(c.exId)}: ${fmtKg(c.from)} → ${fmtKg(c.to)} kg, want ${c.why}. Eerst de reps goed halen.`)];
    lines.push(...moved.slice(0, 3));
    if (moved.length > 3) lines.push(`…en nog ${moved.length - 3} oefening${moved.length - 3 > 1 ? "en" : ""} aangepast`);
    notes.unshift(...lines);
  }
  // Zonder gewicht en alles gehaald? Volgende keer een zwaardere variant.
  for (const d of done) {
    const ae = a.exercises.find((x) => x.exId === d.exId), ex = exById(d.exId), to = LADDER[d.exId];
    if (!ae || !to || ex?.eq !== "bodyweight" || R.bad.includes(d.exId) || S.disliked.includes(to)) continue;
    if (d.sets.length >= ae.plan.sets && d.sets.every((s) => num(s.r) >= ae.plan.repsMax)) {
      S.upgrade[d.exId] = to; S.routines.forEach(upgradeInPlace); U.hotel = null; U.circ = null;
      notes.push(`⬆️ ${exName(d.exId)} ging soepel (${d.sets.length}× ${ae.plan.repsMax}+). Volgende keer: ${exName(to)}`);
    }
  }
  if (a.type === "cardio" && R.rating === "down" && !R.bad.length) notes.push("Kies bij Vandaag een ander apparaat of minder minuten");
  if (!notes.length && !prs.length) notes.push(tipFor(done));
  if (R.bad.length) { replaceDisliked(R.bad); notes.push(`${R.bad.map(exName).join(", ")} ${R.bad.length > 1 ? "komen" : "komt"} niet meer terug`); }
  S.active = null; U.showActive = false; U.rest = null; U.rating = null; setOverride(null); U.hotel = null; U.seen = null; keepAwake(false);
  saveNow(); render();
  const vol = (wk) => wk.exercises.reduce((t, e) => t + e.sets.filter((s) => s.type !== "w").reduce((u, s) => u + num(s.w) * num(s.r), 0), 0); // alleen echte sets, geen warming-up
  // Alleen vergelijken met dezelfde workout (zelfde naam én oefeningen)
  const sameIds = (x, y) => JSON.stringify([...new Set(x.exercises.map((e) => e.exId))].sort()) === JSON.stringify([...new Set(y.exercises.map((e) => e.exId))].sort());
  const prevSame = S.workouts.slice(0, -1).reverse().find((x) => x.name === w.name && sameIds(x, w));
  const v = vol(w), dv = prevSame ? v - vol(prevSame) : 0;
  const nSets = done.reduce((s, e) => s + e.sets.filter((x) => !isCardioSet(x)).length, 0);
  const km = done.reduce((t, e) => t + cardioTotals(e.sets).km, 0);
  showSheet(`<h3>Opgeslagen 💪</h3>
    <div class="sumgrid"><div><b>${fmtDur(w.end - w.start)}</b><span>tijd</span></div>${nSets ? `<div><b>${nSets}</b><span>sets</span></div>` : ""}${v ? `<div><b>${Math.round(v).toLocaleString("nl-NL")}</b><span>kg totaal${prevSame && dv > 0 ? ` · <i class="accent">+${Math.round(dv).toLocaleString("nl-NL")}</i>` : ""}</span></div>` : ""}${km ? `<div><b>${fmtKg(km)}</b><span>km</span></div>` : ""}</div>
    ${prs.length > 2 ? `<p style="margin-top:12px"><b>${esc(`🏆 ${prs.length} records: ${andList(prs.map((p) => `${exName(p.exId)} ${p.text.replace(/ \(was .*\)$/, "")}`))}`)}</b></p>`
      : prs.length ? `<p style="margin-top:12px"><b>🏆 ${prs.length > 1 ? "Nieuwe records!" : "Nieuw record!"}</b></p>${prs.map((p) => `<p class="small">${esc(exName(p.exId))}: ${esc(p.text)}</p>`).join("")}` : ""}
    ${notes.length ? `<p style="margin-top:10px"><b>Je coach</b></p>${notes.map((n) => `<p class="small muted">• ${esc(n)}</p>`).join("")}` : ""}
    <button class="btn primary block" style="margin-top:16px" data-act="closeSheet">Sluiten</button>`);
}

// ---------- Circuit-speler ----------
function startCircuit(r) {
  unlockAudio();
  U.circuit = { r, hotel: S.prefs.place === "hotel", round: 1, idx: 0, phase: "warm", end: Date.now() + 120000, total: 120, paused: false, start: Date.now(), log: [] };
  keepAwake(true); renderOverlay();
}
function setPhase(phase, secs) { const c = U.circuit; c.phase = phase; c.total = secs; c.end = Date.now() + secs * 1000; c.lastBeep = null; }
function advanceCircuit(skipped = false) {
  const c = U.circuit, r = c.r;
  if (c.phase === "warm") { setPhase("prep", 10); beep(880, 0.2); }
  else if (c.phase === "prep") { setPhase("work", r.work); beep(1046, 0.3); }
  else if (c.phase === "work") {
    if (!skipped) c.log.push({ exId: r.exercises[c.idx].exId, secs: r.work });
    const lastEx = c.idx >= r.exercises.length - 1;
    if (lastEx && c.round >= r.rounds) { c.phase = "done"; beep(1318, 0.25, 3); finishCircuit(); return; }
    if (lastEx) { setPhase("roundrest", r.roundRest || 60); c.idx = 0; c.round++; }
    else { setPhase("rest", r.restBetween); c.idx++; }
    beep(660, 0.25);
  } else { setPhase("work", r.work); beep(1046, 0.3); }
  renderOverlay();
}
function tickCircuit() {
  const c = U.circuit;
  if (c.paused || c.phase === "done") return;
  const left = Math.ceil((c.end - Date.now()) / 1000);
  if (left <= 0) return advanceCircuit();
  if (left <= 3 && c.lastBeep !== left) { c.lastBeep = left; beep(523, 0.1); }
  const t = $("#cTime"); if (t) t.textContent = left;
  const ring = $("#cRing"); if (ring) ring.style.strokeDashoffset = 691 * (1 - left / c.total);
}
function viewCircuit() {
  const c = U.circuit, r = c.r;
  if (c.phase === "done") return `<div class="ohead"><b>${esc(r.name)}</b></div><div class="obody circuit"><div class="big">🔥</div><div class="name">Klaar!</div><p class="muted">${fmtDur(Date.now() - c.start)}</p>
    <p class="small muted" style="margin-top:20px">Hoe was het?</p>
    <div class="pick2" style="margin-top:8px"><button class="tile" data-act="circRate" data-v="up"><span class="ti">👍</span><b>Goed</b></button><button class="tile" data-act="circRate" data-v="down"><span class="ti">👎</span><b>Niet fijn</b></button></div></div>`;
  const cur = r.exercises[c.idx], nxt = c.phase === "work" ? r.exercises[c.idx + 1] : cur;
  const label = { warm: "Opwarmen", prep: "Maak je klaar", work: "Werk", rest: "Rust", roundrest: `Rust · ronde ${c.round} komt eraan` }[c.phase];
  const left = Math.max(0, Math.ceil((c.end - Date.now()) / 1000));
  const showName = c.phase === "work" ? exName(cur.exId) : c.phase === "warm" ? "Rustig: jumping jacks, squats en armcirkels" : `Volgende: ${exName(cur.exId)}`;
  return `<div class="ohead"><button class="btn ghost" data-act="stopCircuit" aria-label="Stoppen">${ICON.close}</button><div class="grow" style="text-align:center"><b>${esc(r.name)}</b><div class="small muted">Ronde ${c.round}/${r.rounds} · ${c.idx + 1}/${r.exercises.length}</div></div><span style="width:44px"></span></div>
  <div class="obody circuit ${c.phase === "work" ? "work" : "rest"}">
    <div class="phase">${label}</div>
    <div class="ring"><svg viewBox="0 0 240 240"><circle cx="120" cy="120" r="110" stroke="var(--line)" stroke-width="10"/><circle id="cRing" cx="120" cy="120" r="110" stroke="${c.phase === "work" ? "var(--good)" : "var(--warn)"}" stroke-width="10" stroke-dasharray="691" stroke-dashoffset="${691 * (1 - left / c.total)}"/></svg><div class="inner"><div class="big" id="cTime">${left}</div></div></div>
    <div class="name" style="margin-top:16px">${esc(showName)}</div>
    ${c.phase === "work" && nxt ? `<p class="muted">Daarna: ${esc(exName(nxt.exId))}</p>` : ""}
    <div class="row" style="justify-content:center;margin-top:28px;gap:12px"><button class="btn" data-act="circPause">${c.paused ? "▶︎ Verder" : "❚❚ Pauze"}</button><button class="btn" data-act="circSkip">Overslaan ⏭</button></div>
  </div>`;
}
function finishCircuit() {
  const c = U.circuit;
  if (c.log.length) {
    const map = new Map();
    c.log.forEach((l) => { if (!map.has(l.exId)) map.set(l.exId, []); map.get(l.exId).push({ w: "", r: "", secs: l.secs, done: true }); });
    c.wid = uid(); // zodat 👍/👎 bij precies dit circuit hoort
    S.workouts.push({ id: c.wid, name: c.r.name, start: c.start, end: Date.now(), exercises: [...map].map(([exId, sets]) => ({ exId, sets })), prs: [], type: "circuit" });
    saveNow();
  }
  keepAwake(false); renderOverlay();
}

// ---------- Sheets ----------
function showSheet(html) { const s = $("#sheet"); s.innerHTML = `<div class="panel"><div class="grab"></div>${html}</div>`; s.hidden = false; }
function closeSheet() { const s = $("#sheet"); s.hidden = true; s.innerHTML = ""; U.picker = null; U.modeOpen = false; }

function exInfoHtml(id) {
  const ex = exById(id);
  const { imgs, cues, en } = howto(id);
  return `<div class="row between"><div><h3 style="margin:0">${esc(ex?.name || "Oefening")}</h3><div class="small muted">${esc(exSub(ex))}</div></div><button class="icon-btn" data-act="closeSheet" aria-label="Sluiten">${ICON.close}</button></div>
    ${imgs.length ? `<div class="anim"><img src="${imgs[0]}" alt=""><img class="b" src="${imgs[1]}" alt=""></div>` : ""}
    ${cues.length ? `${en ? `<p class="small muted" style="margin-top:8px">Uitleg (Engels)</p>` : ""}<ol class="cues">${cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>` : ""}
    <a class="btn block" href="${videoUrl(ex?.name || "")}" target="_blank" rel="noopener">▶︎ Video</a>`;
}

function pickListHtml() {
  const p = U.picker, q = p.q.toLowerCase().trim();
  const all = allEx().filter((e) => !e.hide && !S.disliked.includes(e.id) && (!p.cardio || e.cardio) && (!p.muscle || e.muscle === p.muscle) && (!p.eq || e.eq === p.eq) && (!q || e.name.toLowerCase().includes(q)));
  return all.slice(0, 80).map((e) => `<div class="list-item" data-act="pickIt" data-id="${e.id}">${thumb(e.id)}<div class="grow"><b>${esc(e.name)}</b><div class="small muted">${esc(exSub(e))}</div></div></div>`).join("") || `<p class="small muted">Niets gevonden.</p>`;
}
function pickerHtml() {
  const p = U.picker;
  // Cardio-modus: je kiest alleen uit cardio, dus geen spiergroep- en materiaalknoppen
  const filters = p.cardio ? "" : `<p class="flabel">Spiergroep</p>
    <div class="chips scroll">${Object.entries(MUSCLES).filter(([k]) => k !== "fullbody").map(([k, l]) => `<button class="chip ${p.muscle === k ? "on" : ""}" data-act="pickMuscle" data-v="${k}">${l}</button>`).join("")}</div>
    <p class="flabel">Materiaal</p>
    <div class="chips scroll eqrow">${[["machine", "Machine"], ["dumbbell", "Dumbbell"], ["barbell", "Barbell"], ["cable", "Kabel"], ["bodyweight", "Zonder gewicht"], ["kettlebell", "Kettlebell"], ["band", "Elastiek"]].map(([k, l]) => `<button class="chip ${p.eq === k ? "on" : ""}" data-act="pickEq" data-v="${k}">${l}</button>`).join("")}</div>`;
  return `<div class="row between"><h3>Kies oefening</h3><button class="icon-btn" data-act="closeSheet" aria-label="Sluiten">${ICON.close}</button></div>
    <input type="search" id="pickQ" placeholder="${p.cardio ? "Zoek, bijv. fiets, loopband" : "Zoek, bijv. squat, curl, row"}" value="${esc(p.q)}" style="margin:8px 0">
    ${filters}
    <button class="sl add" style="margin:4px 0 8px" data-act="newCustom">${ICON.plus} Staat hij er niet bij? Maak eigen oefening</button>
    <div id="pickList">${pickListHtml()}</div>`;
}
function editExHtml(i) {
  const { r, temp, cardio } = todayWorkout(), x = r.exercises[i];
  if (!x) return "";
  const ex = exById(x.exId), circ = r.type === "circuit";
  const row = (label, k, val) => `<div class="erow"><span class="grow">${label}</span><button class="sbtn" data-act="editBump" data-i="${i}" data-k="${k}" data-d="-1">−</button><b class="eval">${val}</b><button class="sbtn" data-act="editBump" data-i="${i}" data-k="${k}" data-d="1">+</button></div>`;
  return `<div class="row between"><div><h3 style="margin:0">${esc(ex?.name || "Oefening")}</h3><div class="small muted">${esc(exSub(ex))}</div></div><button class="icon-btn" data-act="closeSheet" aria-label="Sluiten">${ICON.close}</button></div>
    <div style="margin-top:10px">${favChip(x.exId, i)}</div>
    ${circ ? "" : `<div style="margin-top:12px">${cardioItem(x) ? row("Minuten", "mins", num(x.mins) || 20) : row("Sets", "sets", x.sets) + (x.secs ? row("Seconden", "secs", x.secs) : row("Reps", "reps", `${x.repsMin}-${x.repsMax}`))}</div>`}
    <div class="stack" style="margin-top:12px">
      <button class="btn block" data-act="exInfo" data-id="${x.exId}">ⓘ Uitleg en video</button>
      <button class="btn block" data-act="swapToday" data-i="${i}">↻ Andere oefening kiezen</button>
      ${i > 0 ? `<button class="btn block" data-act="moveUp" data-i="${i}">↑ Eerder doen</button>` : ""}
      ${cardio ? "" : `<button class="btn danger block" data-act="removeToday" data-i="${i}">✕ Uit deze workout halen</button>`}
    </div>
    <p class="small muted" style="margin-top:10px;text-align:center">${temp && !cardio ? "Geldt alleen voor deze workout van vandaag." : "Wordt bewaard voor de volgende keer."}</p>`;
}
// ⋯ tijdens het trainen
function exMenuHtml() {
  const id = S.active.exercises[S.active.cur]?.exId;
  return `<h3>${esc(exName(id))}</h3><div style="margin-top:8px">${favChip(id)}</div><div class="stack" style="margin-top:12px">
      <button class="btn block" data-act="exSwap">↻ Andere oefening</button>
      <button class="btn block" data-act="exPick">Zelf een oefening kiezen</button>
      <button class="btn block" data-act="exSkip">Overslaan vandaag</button>
      <button class="btn danger block" data-act="exNever">✕ Niet meer doen</button></div>`;
}
function customHtml() {
  const c = U.custom;
  const chips = (k, opts) => `<div class="chips">${opts.map(([v, l]) => `<button class="chip ${c[k] === v ? "on" : ""}" data-act="customSet" data-k="${k}" data-v="${v}">${l}</button>`).join("")}</div>`;
  // Vanuit de cardio-modus wordt het altijd een cardio-oefening
  const muscles = c.cardioOnly ? [["cardio", MUSCLES.cardio]] : Object.entries(MUSCLES).filter(([k]) => k !== "fullbody");
  return `<div class="row between"><h3>Eigen oefening</h3><button class="icon-btn" data-act="closeSheet" aria-label="Sluiten">${ICON.close}</button></div>
    <input id="customName" placeholder="${c.cardioOnly ? "Naam, bijv. Spinningfiets" : "Naam, bijv. Hack squat machine"}" value="${esc(c.name)}" style="margin:8px 0 12px">
    <p class="small muted">Spiergroep</p>${chips("muscle", muscles)}
    <p class="small muted" style="margin-top:10px">Materiaal</p>${chips("eq", [["machine", "Machine"], ["dumbbell", "Dumbbell"], ["barbell", "Barbell"], ["cable", "Kabel"], ["bodyweight", "Lichaamsgewicht"], ["overig", "Overig"]])}
    ${c.muscle === "cardio" ? `<p class="small muted" style="margin-top:10px">Je telt in minuten en km.</p>` : `<p class="small muted" style="margin-top:10px">Hoe tel je?</p>${chips("timed", [["0", "Reps"], ["1", "Seconden"]])}`}
    <button class="btn primary block" style="margin-top:16px" data-act="saveCustom">Opslaan en toevoegen</button>`;
}
function planFor(id) {
  const ex = exById(id);
  try { return { exId: id, ...dosage(profileFor(), ex) }; } catch { return ex?.timed ? { exId: id, sets: 3, secs: 30, repsMin: 0, repsMax: 0, rest: 60 } : { exId: id, sets: 3, repsMin: 8, repsMax: 12, rest: 90 }; }
}
function todayChanged() { save(); render(); }
function refreshPicker() { if (U.picker && $("#pickList")) $("#pickList").innerHTML = pickListHtml(); }

// ---------- Acties ----------
const ACT = {
  tab: (d) => { S.tab = d.tab; save(); closeSheet(); render(); window.scrollTo(0, 0); },
  pref: (d) => {
    S.prefs[d.k] = d.k === "circMin" || d.k === "cardioMin" ? +d.v : d.v;
    // Cardio in een hotel zonder spullen: dan ga je buiten hardlopen (niet bij een knieblessure of als je het niet meer wilt)
    if (["mode", "place", "hotelEq"].includes(d.k) && S.prefs.mode === "cardio" && S.prefs.place === "hotel" && S.prefs.hotelEq === "bodyweight" && cardioOk("run_outside")) S.prefs.cardioEx = "run_outside";
    setOverride(null); save(); render(); if (U.modeOpen) showSheet(modeSheetHtml());
  },
  modeSheet: () => { U.modeOpen = true; showSheet(modeSheetHtml()); },
  startToday: () => { const t = todayWorkout(); startWorkout(t.r, { temp: t.temp, from: t.from, hotel: t.hotel }); },
  another: () => {
    setOverride(null);
    // Een ander circuit: je favorieten mogen blijven, de rest wordt anders (ook anders dan wat je al wegtikte)
    if (S.prefs.mode === "circuit") {
      const cur = (U.circ?.exercises || []).map((x) => x.exId);
      U.cAvoid = { cur, seen: [...new Set([...(U.cAvoid?.seen || []), ...(U.cAvoid?.cur || [])])] }; U.cSeed++; render(); return;
    }
    const idx = S.nextIdx % strengthPlan().length;
    if (S.prefs.place === "hotel") {
      // Andere hotelworkout: per oefening een willekeurige andere voor dezelfde spiergroep (liefst een favoriet). Je sportschool-schema blijft staan.
      // Je favorieten blijven staan; zou er dan niets veranderen, dan wordt alles anders. Wat je al wegtikte, komt liefst niet terug.
      const { r } = todayWorkout();
      const seen = U.hotelSeen = [...new Set([...(U.hotelSeen || []), ...r.exercises.map((x) => x.exId)])];
      const prof = profileFor();
      prof.prefer = prof.prefer.filter((id) => !seen.includes(id)); prof.seenBefore = seen;
      // wat je hier mag doen: past bij je niveau en blessures, zonder "niet meer doen" en zonder stang of kettlebell
      const base = hotelPool(prof, S.prefs.hotelEq, S.customExercises);
      const build = (keepFav) => {
        const nr = structuredClone(r);
        nr.exercises = [];
        for (const x of r.exercises) {
          const e = exById(x.exId);
          if (cardioItem(x) || (keepFav && isFav(x.exId))) { nr.exercises.push(x); continue; } // cardio blijft gewoon staan
          const used = new Set([...nr.exercises.map((y) => y.exId), ...r.exercises.map((y) => y.exId)]);
          const same = base.filter((o) => o.muscle === e?.muscle && !!o.timed === !!e?.timed && !used.has(o.id) && !S.upgrade[o.id] && !o.cardio);
          // liefst dezelfde soort (een row blijft een grote oefening), en met dumbbells een dumbbell-oefening
          // een grote oefening wordt nooit een kleine: is er geen andere grote, dan blijft hij staan
          let c = same.filter((o) => o.kind === e?.kind); if (!c.length && e?.kind !== "compound") c = same;
          // met dumbbells blijft een dumbbell-oefening een dumbbell-oefening: is er geen andere, dan blijft hij staan
          // (anders wordt bijv. de dumbbell row een deur-row)
          if (S.prefs.hotelEq === "dumbbell" && e?.eq === "dumbbell") c = c.filter((o) => o.eq === "dumbbell");
          const cand = preferLiked(prof, c);
          const pick = cand[Math.floor(Math.random() * cand.length)];
          // verse dosis: zonder gewicht 10-20 reps, dumbbell naar dumbbell houdt je reps
          nr.exercises.push(pick ? { exId: pick.id, ...bwDose(pick, e?.eq === pick.eq ? x : { sets: x.sets }) } : x);
        }
        return nr;
      };
      const changed = (nr) => nr.exercises.some((x, i) => x.exId !== r.exercises[i].exId);
      let nr = build(true);
      if (!changed(nr)) nr = build(false);
      U.hotel = { key: U.hotel?.key, r: nr };
      render(); toast(changed(nr) ? "Nieuwe hotelworkout (je sportschool-schema blijft hetzelfde)" : "Geen andere oefeningen gevonden"); return;
    }
    if (S.routines[idx].rating === "up" && !confirm("Deze workout gaf je 👍. Toch een andere?")) return;
    const r0 = S.routines[idx];
    if (U.seen?.idx !== idx) U.seen = { idx, ids: [] };
    const own = keepOwn(r0);
    S.routines[idx] = regenerateDay(profileFor(), r0, idx, dayExtra(r0), 1 + Math.floor(Math.random() * 20), U.seen.ids);
    S.routines[idx].source = "coach";
    U.seen.ids = [...new Set([...U.seen.ids, ...r0.exercises.map((x) => x.exId)])];
    U.hotel = null; save(); render(); toast(own ? "Nieuwe workout gemaakt. Je eigen versie staat bij Oude workouts" : "Nieuwe workout gemaakt");
  },
  adjust: () => {
    // Korter = ongeveer 30% korter dan nu (10-30 min). Een workout van 12 min of minder kan niet korter.
    const t = todayWorkout(), est = estMinutes(t.r), v = Math.max(10, Math.min(30, Math.round(est * 0.7)));
    showSheet(`<h3>Pas aan voor vandaag</h3><div class="stack" style="margin-top:10px">
      ${est > 12 ? `<button class="btn block" data-act="doAdjust" data-k="tijd" data-v="${v}">⏱ Korter (±${v} min)</button>` : ""}
      <button class="btn block" data-act="doAdjust" data-k="moe">😴 Lichter, ik ben moe</button>
      <button class="btn block" data-act="adjPain">🩹 Iets doet pijn</button></div>`);
  },
  adjPain: () => showSheet(`<h3>Wat wil je ontzien?</h3><div class="chips" style="margin-top:10px">${INJURIES.map((i) => `<button class="chip" data-act="doAdjust" data-k="blessure" data-v="${i}">${i[0].toUpperCase() + i.slice(1)}</button>`).join("")}</div>`),
  doAdjust: (d) => {
    const t = todayWorkout();
    const { routine } = adjustRoutine(t.r, d.k, d.v, placeProfile(), coachExtra(t.r));
    routine.name = t.r.name;
    setOverride({ r: routine, temp: true, from: t.from || (t.temp ? null : t.r.id) }); save();
    closeSheet(); render(); toast("Aangepast voor vandaag");
  },
  resetOverride: () => { setOverride(null); save(); render(); },
  exInfo: (d) => showSheet(exInfoHtml(d.id)),
  openActive: () => { U.showActive = true; renderOverlay(); },
  minimize: () => { U.showActive = false; render(); },
  goEx: (d) => { S.active.cur = +d.i; U.infoOpen = false; U.selSet = null; save(); renderOverlay(); $("#overlay").scrollTop = 0; },
  nextEx: () => { S.active.cur++; U.infoOpen = false; U.selSet = null; save(); renderOverlay(); $("#overlay").scrollTop = 0; },
  prevEx: () => { S.active.cur--; U.infoOpen = false; U.selSet = null; save(); renderOverlay(); $("#overlay").scrollTop = 0; },
  pickSet: (d) => { U.selSet = +d.si; renderOverlay(); },
  bump: (d) => {
    const e = S.active.exercises[S.active.cur], s = e.sets[d.si], ex = exById(e.exId);
    const ph = { w: "pw", r: "pr", secs: "ps", mins: "pm", km: "pk" }[d.k];
    const step = d.k === "w" ? increment(ex) : d.k === "secs" ? 5 : d.k === "km" ? 0.1 : 1;
    const cur = s[d.k] !== "" ? num(s[d.k]) : num(s[ph]);
    s[d.k] = String(Math.max(0, Math.round((cur + step * d.d) * 100) / 100));
    if (d.k === "w") e.sets.slice(+d.si + 1).forEach((n) => { if (!n.done && n.w === "") n.pw = s.w; });
    save(); renderOverlay();
  },
  toggleInfo: () => { U.infoOpen = !U.infoOpen; renderOverlay(); },
  toggleSet: (d) => {
    const a = S.active, e = a.exercises[a.cur], s = e.sets[d.si];
    const exx = exById(e.exId);
    const focus = (k) => $(`[data-set="${d.si}.${k}"]`)?.focus();
    // Je beste gewicht ooit op deze oefening (voor het record en om typfouten te vangen)
    const best = Math.max(0, ...S.workouts.flatMap((w) => w.exercises.filter((x) => x.exId === e.exId).flatMap((x) => x.sets.filter(isWork).map((y) => num(y.w)))));
    if (!s.done && e.cardio) {
      const mins = num(s.mins !== "" ? s.mins : s.pm);
      if (mins <= 0) { toast("Vul eerst je minuten in"); focus("mins"); return; }
      if (mins > 300 && !confirm(`${fmtKg(mins)} minuten: klopt dat?`)) { focus("mins"); return; }
    } else if (!s.done && exx?.timed) {
      const secs = num(s.secs !== "" ? s.secs : s.ps);
      if (secs <= 0) { toast("Vul eerst je seconden in"); focus("secs"); return; }
      if (secs > 600 && !confirm(`${Math.round(secs)} seconden: klopt dat?`)) { focus("secs"); return; }
    } else if (!s.done) {
      const w = num(s.w !== "" ? s.w : s.pw), r = num(s.r !== "" ? s.r : s.pr), bw = exx?.eq === "bodyweight";
      if (!bw && w <= 0) { toast("Vul eerst je gewicht in"); focus("w"); return; }
      if (r <= 0) { toast("Vul eerst je reps in"); return; }
      // Een getypt getal dat niet kan (bijv. 6062,5 kg): even vragen
      const base = Math.max(best, num(e.sets[d.si].pw), num(e.plan?.weight));
      const oddW = !bw && ((base > 0 && w > Math.max(2 * base, base + 40)) || (base === 0 && w > 300));
      if ((oddW || r > 60) && !confirm(bw || !w ? `${Math.round(r)} reps: klopt dat?` : `${fmtKg(w)} kg × ${Math.round(r)} reps: klopt dat?`)) { focus(oddW ? "w" : "r"); return; }
    }
    s.done = !s.done;
    if (!s.done && U.rest) U.rest = null; // set ongedaan: rusttimer stopt
    if (s.done) {
      if (e.cardio) {
        // km mag leeg blijven; record = verder dan ooit op dit apparaat
        if (s.mins === "") s.mins = s.pm;
        s.km = num(s.km) > 0 ? String(num(s.km)) : ""; // 0 of min-getal: leeg
        const bestK = bestKm(e.exId);
        if (bestK > 0 && cardioTotals(e.sets).km > bestK && !e.prFlag) { e.prFlag = true; setTimeout(() => flash("🏆 Nieuw record!"), 50); }
      } else if (exx?.timed) { if (s.secs === "") s.secs = s.ps; s.secs = String(Math.round(num(s.secs))); }
      else {
        if (s.w === "") s.w = s.pw; if (s.r === "") s.r = s.pr;
        s.r = String(Math.round(num(s.r)));
        e.sets.slice(+d.si + 1).forEach((n) => { if (!n.done && n.w === "") n.pw = s.w; });
        if (best > 0 && num(s.w) > best && !e.prFlag) { e.prFlag = true; setTimeout(() => flash("🏆 Nieuw record!"), 50); }
      }
      const allDoneW = a.exercises.every((x) => x.sets.every((y) => y.done));
      if (allDoneW) U.rest = null; // geen rusttimer na je allerlaatste set
      else {
        if (e.plan.rest && !e.cardio) { U.rest = { end: Date.now() + e.plan.rest * 1000, total: e.plan.rest }; unlockAudio(); }
        if (e.sets.every((x) => x.done)) {
          // door naar de eerstvolgende oefening die nog niet af is (anders een eerdere)
          const open = (i) => a.exercises[i].sets.some((x) => !x.done);
          let j = a.exercises.findIndex((x, i) => i > a.cur && open(i));
          if (j < 0) j = a.exercises.findIndex((x, i) => i < a.cur && open(i));
          if (j >= 0) { a.cur = j; U.infoOpen = false; toast(`Door naar ${exName(a.exercises[j].exId)}`); $("#overlay").scrollTop = 0; }
        }
      }
    }
    U.selSet = null; save(); renderOverlay();
  },
  addSet: () => {
    const e = S.active.exercises[S.active.cur]; const l = e.sets.at(-1) || {};
    e.sets.push(e.cardio ? { mins: "", km: "", done: false, pm: l.mins || l.pm || String(e.plan.mins || 10), pk: "" }
      : { w: "", r: "", secs: "", done: false, pw: l.w || l.pw || "", pr: l.r || l.pr || "", ps: l.secs || l.ps || "" });
    save(); renderOverlay();
  },
  exMenu: () => showSheet(exMenuHtml()),
  exList: () => showSheet(exListHtml()),
  xGo: (d) => { const a = S.active; a.cur = +d.i; U.infoOpen = false; U.selSet = null; save(); closeSheet(); renderOverlay(); $("#overlay").scrollTop = 0; },
  xRemove: (d) => {
    const a = S.active, i = +d.i, e = a.exercises[i];
    if (e.sets.some((s) => s.done) && !confirm(`${exName(e.exId)} weghalen? De sets die je al deed, worden dan niet bewaard.`)) return;
    const cur = a.exercises[a.cur];
    a.exercises.splice(i, 1);
    a.cur = cur === e ? Math.min(i, Math.max(0, a.exercises.length - 1)) : a.exercises.indexOf(cur);
    U.selSet = null; U.infoOpen = false; save(); renderOverlay(); showSheet(exListHtml()); toast(`${exName(e.exId)} weggehaald`);
  },
  xAdd: () => { U.picker = { q: "", muscle: "", eq: S.prefs.place === "hotel" && S.prefs.hotelEq === "bodyweight" ? "bodyweight" : "", mode: "activeAdd" }; showSheet(pickerHtml()); },
  xStop: () => showSheet(stopHtml()),
  xStopSave: () => { closeSheet(); finishWorkout(true); },
  xStopDiscard: () => {
    if (!confirm("Deze training weggooien? Niets wordt bewaard.")) return;
    S.active = null; U.showActive = false; U.rest = null; U.selSet = null; keepAwake(false); closeSheet(); saveNow(); render(); toast("Training gestopt");
  },
  // ❤️ Favoriet aan/uit: aan = 5 (de coach kiest hem liever), uit = vergeten
  fav: (d) => {
    const on = !isFav(d.id);
    if (on) { S.likes[d.id] = 5; S.disliked = S.disliked.filter((x) => x !== d.id); } else delete S.likes[d.id];
    save();
    if (d.i != null) { render(); showSheet(editExHtml(+d.i)); } // Vandaag: blad blijft open
    else if (S.active && U.showActive) { renderOverlay(); showSheet(exMenuHtml()); }
    toast(on ? `❤️ ${exName(d.id)} is favoriet` : `${exName(d.id)} is geen favoriet meer`);
  },
  unlike: (d) => { delete S.likes[d.id]; save(); render(); },
  exSwap: () => {
    const a = S.active, e = a.exercises[a.cur];
    const alt = swapExercise(swapProfile(e.exId), { exercises: a.exercises }, e.exId, coachExtra(a));
    if (!alt) return toast("Geen andere oefening gevonden");
    putEx(a, newActiveEx(alt.exId, { ...e.plan, ...alt, weight: undefined }));
    closeSheet(); save(); renderOverlay();
  },
  exPick: () => { U.picker = { q: "", muscle: exById(S.active.exercises[S.active.cur].exId)?.muscle || "", eq: "" }; showSheet(pickerHtml()); },
  pickMuscle: (d) => { U.picker.muscle = U.picker.muscle === d.v ? "" : d.v; showSheet(pickerHtml()); },
  pickEq: (d) => { U.picker.eq = U.picker.eq === d.v ? "" : d.v; showSheet(pickerHtml()); },
  pickIt: (d) => {
    const mode = U.picker?.mode;
    if (mode === "add" || mode === "swap") {
      const t = todayWorkout(), { r } = t, circ = r.type === "circuit";
      if (t.cardio) {
        // Cardio-modus: je keuze wordt bewaard voor de volgende keer
        if (!exById(d.id)?.cardio) { toast("Kies een cardio-oefening"); if (U.picker) showSheet(pickerHtml()); return; }
        S.prefs.cardioEx = d.id; closeSheet(); todayChanged(); toast(`Gewisseld naar ${exName(d.id)}`); return;
      }
      const item = circ ? { exId: d.id } : planFor(d.id);
      const old = mode === "swap" ? r.exercises[U.picker.i] : null;
      if (item.mins != null && old?.mins) item.mins = old.mins; // cardio: je minuten blijven
      if (mode === "add") r.exercises.push(item); else r.exercises[U.picker.i] = item;
      closeSheet(); todayChanged(); toast(mode === "add" ? `${exName(d.id)} toegevoegd` : `Gewisseld naar ${exName(d.id)}`); return;
    }
    if (mode === "activeAdd") {
      const a = S.active;
      if (a.exercises.some((x) => x.exId === d.id)) { toast("Die staat al in je training"); return; }
      a.exercises.push(newActiveEx(d.id, planFor(d.id))); save(); renderOverlay(); showSheet(exListHtml()); toast(`${exName(d.id)} toegevoegd`); return;
    }
    const a = S.active, e = a.exercises[a.cur];
    if (d.id === e.exId) { closeSheet(); return; } // dezelfde oefening: er verandert niets (geen dubbele rij)
    const same = !!exById(d.id)?.cardio === !!e.cardio; // van cardio naar kracht (of andersom): nieuw doel
    putEx(a, newActiveEx(d.id, same ? { ...e.plan, weight: undefined } : planFor(d.id))); closeSheet(); save(); renderOverlay();
  },
  editEx: (d) => showSheet(editExHtml(+d.i)),
  addToday: () => { U.picker = { q: "", muscle: "", eq: S.prefs.place === "hotel" && S.prefs.hotelEq === "bodyweight" ? "bodyweight" : "", mode: "add" }; showSheet(pickerHtml()); },
  swapToday: (d) => { const { r, cardio } = todayWorkout(); U.picker = { q: "", muscle: exById(r.exercises[+d.i].exId)?.muscle || "", eq: "", mode: "swap", i: +d.i, cardio: !!cardio }; showSheet(pickerHtml()); },
  removeToday: (d) => { const { r } = todayWorkout(); const [x] = r.exercises.splice(+d.i, 1); closeSheet(); todayChanged(); toast(`${exName(x.exId)} eruit gehaald`); },
  moveUp: (d) => { const { r } = todayWorkout(), i = +d.i; [r.exercises[i - 1], r.exercises[i]] = [r.exercises[i], r.exercises[i - 1]]; todayChanged(); showSheet(editExHtml(i - 1)); },
  editBump: (d) => {
    const t = todayWorkout(), x = t.r.exercises[+d.i], n = +d.d;
    if (d.k === "sets") x.sets = Math.min(8, Math.max(1, x.sets + n));
    if (d.k === "secs") x.secs = Math.max(10, x.secs + 5 * n);
    if (d.k === "reps" && x.repsMin + n >= 1) { x.repsMin += n; x.repsMax += n; }
    if (d.k === "mins") { x.mins = Math.max(5, (num(x.mins) || 20) + 5 * n); if (t.cardio) S.prefs.cardioMin = x.mins; }
    todayChanged(); showSheet(editExHtml(+d.i));
  },
  newCustom: () => {
    const cardioOnly = !!U.picker?.cardio; // cardio-modus: dan wordt het een cardio-oefening
    U.custom = { name: U.picker?.q || "", muscle: cardioOnly ? "cardio" : U.picker?.muscle || "", eq: U.picker?.eq || "machine", timed: "0", back: U.picker, cardioOnly };
    showSheet(customHtml());
  },
  customSet: (d) => { if (!U.custom) return closeSheet(); U.custom.name = $("#customName")?.value ?? U.custom.name; U.custom[d.k] = d.v; showSheet(customHtml()); },
  saveCustom: () => {
    const c = U.custom; if (!c) return closeSheet();
    c.name = ($("#customName")?.value || "").trim();
    if (!c.name) return toast("Geef je oefening een naam");
    if (!c.muscle) return toast("Kies een spiergroep");
    const cardio = c.muscle === "cardio";
    const ex = { id: "c_" + newId(), name: c.name, muscle: c.muscle, eq: c.eq, kind: cardio ? "cardio" : c.eq === "barbell" ? "compound" : "isolation", avoid: [], timed: !cardio && c.timed === "1", custom: true, ...(cardio ? { cardio: true } : {}) };
    S.customExercises.push(ex); save();
    U.picker = c.back || { q: "", muscle: "", eq: "", mode: S.active && U.showActive ? undefined : "add" };
    U.custom = null; ACT.pickIt({ id: ex.id });
  },
  exSkip: () => { skipEx(S.active); closeSheet(); save(); renderOverlay(); },
  exNever: () => {
    const a = S.active, plan = a.exercises[a.cur].plan, id = a.exercises[a.cur].exId;
    replaceDisliked([id]);
    const alt = swapExercise(swapProfile(id), { exercises: a.exercises }, id, coachExtra(a));
    if (alt) putEx(a, newActiveEx(alt.exId, { ...plan, ...alt, weight: undefined }));
    else skipEx(a);
    closeSheet(); save(); renderOverlay(); toast(`${exName(id)} komt niet meer terug`);
  },
  restAdd: (d) => { if (U.rest) { U.rest.end += +d.s * 1000; U.rest.total += +d.s; renderRest(); } },
  restSkip: () => { U.rest = null; renderRest(); },
  finish: () => finishWorkout(),
  rate: (d) => { if (!U.rating) return; U.rating.rating = d.v; if (d.v === "up") return saveRating(); $("#sheet .panel").innerHTML = '<div class="grab"></div>' + ratingHtml(); },
  rateEx: (d) => { if (!U.rating) return; const b = U.rating.bad, i = b.indexOf(d.id); i >= 0 ? b.splice(i, 1) : b.push(d.id); $("#sheet .panel").innerHTML = '<div class="grab"></div>' + ratingHtml(); },
  saveRating: () => saveRating(),
  closeSheet: () => closeSheet(),
  circPause: () => { const c = U.circuit; if (c.paused) { c.end = Date.now() + c.pausedLeft; c.paused = false; } else { c.pausedLeft = c.end - Date.now(); c.paused = true; } renderOverlay(); },
  circSkip: () => advanceCircuit(true),
  stopCircuit: () => { if (confirm("Circuit stoppen? Wat je gedaan hebt wordt opgeslagen.")) { finishCircuit(); U.circuit = null; keepAwake(false); render(); } },
  circRate: (d) => {
    const c = U.circuit, w = c?.wid ? S.workouts.find((x) => x.id === c.wid) : null;
    if (w) {
      // net als na een krachttraining: de coach leert stil welke oefeningen je fijn vindt (in het hotel telt alleen 👎)
      w.rating = d.v;
      if (!(c.hotel && d.v === "up")) [...new Set(w.exercises.map((e) => e.exId))].forEach((id) => rateLike(id, d.v === "up" ? 1 : -1));
    }
    // 👎: volgende keer een ander circuit (favorieten mogen blijven); 👍: dit circuit blijft staan
    const ids = (c?.r.exercises || []).map((x) => x.exId);
    if (d.v === "down") { U.cSeed++; U.cAvoid = { cur: ids, seen: [] }; } else U.cAvoid = null;
    U.circuit = null; saveNow(); render();
    toast(d.v === "down" ? "Volgende keer een ander circuit" : "Lekker gedaan!");
  },
  showWorkout: (d) => {
    const w = S.workouts.find((x) => x.id === d.id); if (!w) return;
    showSheet(`<div class="row between"><h3>${esc(w.name)}</h3><button class="icon-btn" data-act="closeSheet" aria-label="Sluiten">${ICON.close}</button></div><p class="small muted">${fmtDate(w.start)} · ${fmtDur(w.end - w.start)}</p>
      ${w.exercises.map((e) => `<div class="list-item"><span class="grow">${esc(exName(e.exId))}</span><span class="small muted">${e.sets.map((s) => (isCardioSet(s) ? cardioText(num(s.mins), num(s.km)) || "–" : s.secs ? `${s.secs}s` : num(s.w) ? `${fmtKg(s.w)}×${s.r}` : `${s.r}`)).join(", ")}</span></div>`).join("")}
      <button class="btn danger block" style="margin-top:14px" data-act="delWorkout" data-id="${w.id}">Verwijderen</button>`);
  },
  delWorkout: (d) => { if (confirm("Deze workout verwijderen?")) { S.workouts = S.workouts.filter((w) => w.id !== d.id); save(); closeSheet(); render(); } },
  profToggle: (d) => { const a = S.profile[d.k]; const i = a.indexOf(d.v); if (d.k === "goals" && i >= 0 && a.length === 1) return toast("Kies minstens één doel"); i >= 0 ? a.splice(i, 1) : a.push(d.v); if (d.k === "injuries" && i < 0) applyInjury(d.v); if (S.profile.done) S.profDirty = true; save(); render(); },
  profSet: (d) => { S.profile[d.k] = d.k === "days" || d.k === "cardioMin" ? +d.v : d.v; if (S.profile.done) S.profDirty = true; save(); render(); },
  profileDone: () => { freshCoach(); S.profile.done = true; S.routines = generatePlan(profileFor(), S.customExercises); S.nextIdx = 0; save(); ACT.tab({ tab: "today" }); toast("Je workouts zijn klaar"); },
  oldSheet: () => showSheet(oldSheetHtml()),
  oldPick: (d) => {
    const old = oldList()[+d.i]; if (!old) return closeSheet();
    if (S.prefs.mode !== "kracht") S.prefs.mode = "kracht";
    setOverride({ r: oldForPlace(upgradeInPlace(JSON.parse(JSON.stringify(old)))), temp: true }); closeSheet(); save(); ACT.tab({ tab: "today" }); toast(`${old.name} staat klaar`);
  },
  newPlanNow: () => { delete S.v7Hotel; freshCoach(); S.routines = generatePlan(profileFor(), S.customExercises); S.nextIdx = 0; U.hotel = null; setOverride(null); S.profDirty = false; save(); ACT.tab({ tab: "today" }); toast("Nieuwe workouts gemaakt"); },
  keepPlan: () => { delete S.v7Hotel; S.profDirty = false; save(); render(); },
  newPlan: () => { if (!confirm("Nieuwe workouts maken? Je huidige schema wordt vervangen (je geschiedenis blijft).")) return; freshCoach(); S.routines = generatePlan(profileFor(), S.customExercises); S.nextIdx = 0; U.hotel = null; setOverride(null); S.profDirty = false; save(); ACT.tab({ tab: "today" }); toast("Nieuwe workouts gemaakt"); },
  undislike: (d) => { S.disliked = S.disliked.filter((x) => x !== d.id); save(); render(); },
  deloadYes: () => { S.deload = { until: Date.now() + 7 * 864e5, last: Date.now() }; save(); render(); toast("Rustweek gestart"); },
  deloadNo: () => { S.deload.snooze = Date.now() + 7 * 864e5; save(); render(); },
  backupLater: () => { S.backupSnooze = Date.now() + 14 * 864e5; save(); render(); },
  exportData: async () => {
    // Pas als het bestand echt gedeeld of bewaard is, telt het als back-up (wegvegen telt niet)
    const done = () => { S.lastBackup = Date.now(); save(); if (S.tab === "today") render(); };
    const data = JSON.stringify({ ...S, active: null, chat: undefined, settings: { ...(S.settings || {}), apiKey: undefined } }, null, 1);
    const name = `forge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([data], name, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: "Forge back-up" }); done(); return; } catch (e) { if (e.name === "AbortError") return; } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; a.click(); done();
  },
  resetAll: () => { if (confirm("Echt ALLES wissen? Dit kan niet ongedaan worden.")) { localStorage.removeItem(KEY); location.reload(); } },
};

document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-act]");
  if (t) { if (t.tagName !== "A") ev.preventDefault(); ACT[t.dataset.act]?.(t.dataset); return; }
  // Tik op de titel van een profielveld: niet stiekem de eerste keuze aanzetten
  if (ev.target.closest("label.field") && !ev.target.closest("input")) ev.preventDefault();
  const tab = ev.target.closest("#tabs button");
  if (tab) ACT.tab({ tab: tab.dataset.tab });
  if (ev.target.id === "sheet" && !U.rating) closeSheet();
});
document.addEventListener("input", (ev) => {
  const el = ev.target;
  if (el.dataset.set) {
    // Komma of punt mag; alleen cijfers bewaren. Reps, seconden en minuten zijn hele getallen.
    const [si, k] = el.dataset.set.split(".");
    let v = el.value.replace(",", ".").replace(/[^0-9.]/g, "");
    const dot = v.indexOf(".");
    if (dot >= 0) v = ["r", "secs", "mins"].includes(k) ? v.slice(0, dot) : v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "");
    if (v !== el.value.replace(",", ".")) el.value = v;
    S.active.exercises[S.active.cur].sets[si][k] = v; save(); return;
  }
  if (el.dataset.bind === "minutes") { S.profile.minutes = +el.value; $("#minLbl").textContent = el.value + " min"; if (S.profile.done) S.profDirty = true; save(); return; }
  if (el.id === "pickQ") { U.picker.q = el.value; $("#pickList").innerHTML = pickListHtml(); }
});
// Tik je in een veld met een getal dat je al typte: alles geselecteerd, je volgende toets vervangt het
document.addEventListener("focusin", (ev) => {
  const el = ev.target;
  if (el.dataset?.set && el.value) setTimeout(() => { try { el.setSelectionRange(0, el.value.length); } catch {} }, 0);
});
document.addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.id === "progEx") { U.progEx = el.value; render(); }
  if (el.dataset.bind === "minutes" && S.profDirty) render();
  if (el.id === "importFile" && el.files[0]) {
    // Alleen een echt Forge-bestand terugzetten: een kapot bestand mag de app niet laten vastlopen
    const okBackup = (d) => !!d && typeof d === "object" && Array.isArray(d.workouts)
      && d.workouts.every((w) => w && Array.isArray(w.exercises) && w.exercises.every((e) => e && Array.isArray(e.sets)))
      && ["routines", "customExercises", "disliked"].every((k) => d[k] == null || Array.isArray(d[k]))
      && (d.profile == null || (typeof d.profile === "object" && !Array.isArray(d.profile)));
    el.files[0].text().then((txt) => {
      try {
        const data = JSON.parse(txt);
        if (!okBackup(data)) throw new Error();
        if (!confirm(`Back-up met ${data.workouts.length} workouts terugzetten? Huidige gegevens worden vervangen.`)) return;
        // Bewaar het bestand zoals het is: bij het opstarten zet de app het om (ook een back-up van de oude app)
        clearTimeout(saveT); localStorage.setItem(KEY, JSON.stringify({ ...data, active: null })); location.reload();
      } catch { toast("Dit is geen geldig Forge back-upbestand"); }
    });
  }
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) { renderOverlay(); if (S.active || U.circuit) keepAwake(true); } });

if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});

if (S.active) { U.showActive = false; S.active.cur = S.active.cur || 0; }
if (fromV7) save();
render();
loadExtra();
