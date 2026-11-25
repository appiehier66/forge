import { EXERCISES, MUSCLES, EQUIPMENT, INJURIES, CATEGORIES } from "./data.js";
import { uid, SPLITS, generatePlan, generateCircuit, adjustRoutine, suggestNext, e1rm, progressRoutine, hotelRoutine, generateHotel } from "./coach.js";
import { howto as howtoCurated, videoUrl, imgsFor } from "./howto.js";

// ---------- State ----------
const KEY = "forge-v1";
const DEFAULT = {
  tab: "train",
  profile: { goals: ["spiermassa", "fit"], level: "beginner", days: 3, minutes: 60, location: "gym", injuries: [], notes: "", bodyweight: "", done: false },
  routines: [], workouts: [], customExercises: [], chat: [],
  active: null, nextIdx: 0,
  settings: { apiKey: "", autoWeights: true },
};
let S;
try { S = { ...structuredClone(DEFAULT), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
catch { S = structuredClone(DEFAULT); }
S.profile = { ...DEFAULT.profile, ...S.profile };
S.settings = { ...DEFAULT.settings, ...S.settings };

let saveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("Opslaan mislukt: opslag vol?"); }
  }, 150);
}
const saveNow = () => { clearTimeout(saveT); localStorage.setItem(KEY, JSON.stringify(S)); };
navigator.storage?.persist?.();

// UI-only state (niet opgeslagen)
const U = { coachMode: null, circuitOpts: { minutes: 20, intensity: "normaal", focus: "fullbody" }, adjust: null, preview: null, picker: null, edit: null, rest: null, circuit: null, progEx: null, busy: false, streaming: "" };

// ---------- Helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Volledige bibliotheek (ca. 800 extra oefeningen) wordt op de achtergrond geladen
let EXTRA = [];
const allEx = () => [...EXERCISES, ...S.customExercises, ...EXTRA];
function loadExtra() {
  import("./exercises-db.js").then((m) => {
    EXTRA = m.DB.map(([id, name, muscle, eq, kind, cat, level, folder, instr]) => ({ id: "x_" + id, name, muscle, eq, kind, cat, level, folder, instr, avoid: [], timed: cat === "stretching" }));
    render(); if (U.picker) refreshPicker();
  }).catch(() => {});
}
function howto(id) {
  const e = id.startsWith("x_") ? EXTRA.find((x) => x.id === id) : null;
  if (e) return { imgs: imgsFor(e.folder), cues: e.instr || [], en: true };
  return howtoCurated(id);
}
const LEVELS = { b: "Beginner", g: "Gemiddeld", e: "Gevorderd" };
const catOf = (e) => e.cat || (e.kind === "cardio" ? "cardio" : "kracht");
const exById = (id) => allEx().find((e) => e.id === id);
const exName = (id) => exById(id)?.name || "Onbekende oefening";
const fmtDate = (t) => new Date(t).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
const fmtDur = (ms) => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}u ${m % 60}m` : `${m} min`; };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;
const isWork = (s) => s.done && s.type !== "w";
const SET_TYPES = { w: ["O", "Opwarmen", "var(--warn)"], d: ["D", "Drop set", "#b78cff"], f: ["F", "Tot falen", "var(--bad)"] };
const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? 0 : n; };
const ICON = {
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
};

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
}

// Geluid (iOS: na eerste tik ontgrendeld)
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
let wakeLock;
async function keepAwake(on) {
  try { if (on && "wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); else { await wakeLock?.release(); wakeLock = null; } } catch {}
}

// ---------- Render ----------
const TITLES = { train: "Training", routines: "Schema's", coach: "Coach", progress: "Voortgang", profile: "Profiel" };
function render() {
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === S.tab));
  $("#title").textContent = TITLES[S.tab];
  $("#topaction").innerHTML = S.tab === "routines" ? `<button class="btn ghost" data-act="newRoutine">${ICON.plus} Nieuw</button>` : "";
  const v = $("#view");
  v.innerHTML = ({ train: viewTrain, routines: viewRoutines, coach: viewCoach, progress: viewProgress, profile: viewProfile })[S.tab]();
  if (S.tab === "coach" && coachMode() === "chat") { const c = $("#chatEnd"); c?.scrollIntoView({ block: "end" }); }
  renderOverlay();
}

function routineCard(r, extra = "") {
  const sub = r.type === "circuit"
    ? `${r.exercises.length} oefeningen · ${r.rounds} rondes · ${r.work}/${r.restBetween}s`
    : `${r.exercises.length} oefeningen · ${r.exercises.reduce((a, x) => a + (+x.sets || 0), 0)} sets`;
  return `<div class="card">
    <div class="row between"><h3 class="grow">${esc(r.name)}</h3>${r.type === "circuit" ? '<span class="tag accent">Circuit</span>' : ""}${r.source === "coach" || r.source === "ai" ? '<span class="tag">Coach</span>' : ""}</div>
    <p class="muted small">${sub}</p>
    <p class="small muted">${r.exercises.slice(0, 5).map((x) => esc(exName(x.exId)) + (x.weight ? ` <span style="color:var(--text)">${x.weight}kg</span>` : "")).join(" · ")}${r.exercises.length > 5 ? " …" : ""}</p>
    ${extra}
  </div>`;
}

function nextRoutine() {
  const list = S.routines;
  if (!list.length) return null;
  return list[S.nextIdx % list.length];
}

function viewTrain() {
  const nx = nextRoutine();
  const weekAgo = Date.now() - 7 * 864e5;
  const thisWeek = S.workouts.filter((w) => w.start > weekAgo).length;
  let h = "";
  if (S.active) {
    h += `<div class="card hero"><h3>Training bezig</h3><p class="muted small">${esc(S.active.name)} · gestart ${fmtDur(Date.now() - S.active.start)} geleden</p><button class="btn primary block" data-act="openActive">Verder trainen</button></div>`;
  }
  if (!S.profile.done) {
    h += `<div class="card hero"><h3>Welkom bij Forge 💪</h3><p class="muted small">Vul eerst je profiel in, dan maakt je coach een schema dat bij jou past.</p><button class="btn primary block" data-act="tab" data-tab="profile">Profiel invullen</button></div>`;
  }
  h += `<div class="stats" style="margin-top:12px"><div class="stat"><b>${thisWeek}/${S.profile.days || 3}</b><span>deze week</span></div><div class="stat"><b>${S.workouts.length}</b><span>workouts</span></div><div class="stat"><b>${streakWeeks()}</b><span>weken op rij</span></div></div>`;
  const behind = S.workouts.length ? behindThisWeek().slice(0, 3) : [];
  if (behind.length) h += `<div class="card tap" style="margin-top:10px" data-act="tab" data-tab="progress"><div class="small muted">Nog te doen deze week (sets per spiergroep)</div><div class="row wrap" style="margin-top:6px">${behind.map((b) => `<span class="tag" style="color:var(--warn)">${MUSCLES[b.m]} ${b.n}/${b.min}</span>`).join("")}</div></div>`;
  if (nx && !S.active) {
    h += `<h2>Volgende training</h2>` + routineCard(nx, `<div class="row" style="margin-top:10px"><button class="btn primary grow" data-act="startRoutine" data-id="${nx.id}">Start</button><button class="btn sm" data-act="adjustOpen" data-id="${nx.id}">Bijsturen</button></div>`);
  }
  if (!S.routines.length) {
    h += `<h2>Aan de slag</h2><div class="card"><p>Je hebt nog geen schema's.</p><div class="row wrap" style="margin-top:10px"><button class="btn primary" data-act="tab" data-tab="coach">Coach laten maken</button><button class="btn" data-act="newRoutine">Zelf maken</button></div></div>`;
  }
  h += `<h2>Snel starten</h2><div class="row wrap">
    <button class="btn" data-act="startEmpty">${ICON.plus} Lege workout</button>
    <button class="btn" data-act="quickCircuit">⚡ Circuit 20 min</button>
    <button class="btn" data-act="hotelOpen">🏨 Hotelkamer</button></div>`;
  if (S.routines.length > 1) {
    h += `<h2>Al je schema's</h2>` + S.routines.map((r) => `<div class="card tap row" data-act="startRoutine" data-id="${r.id}"><div class="grow"><b>${esc(r.name)}</b><div class="small muted">${r.exercises.length} oefeningen${r.type === "circuit" ? " · circuit" : ""}</div></div><span class="tag accent">Start</span></div>`).join("");
  }
  const recent = S.workouts.slice(-3).reverse();
  if (recent.length) {
    h += `<h2>Recent</h2>` + recent.map(workoutRow).join("");
  }
  return h;
}

function streakWeeks() {
  if (!S.workouts.length) return 0;
  const wk = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
  const weeks = new Set(S.workouts.map((w) => wk(w.start)));
  let cur = wk(Date.now()), n = 0;
  if (!weeks.has(cur)) cur -= 7 * 864e5;
  while (weeks.has(cur)) { n++; cur -= 7 * 864e5; }
  return n;
}

function workoutVolume(w) {
  return w.exercises.reduce((a, e) => a + e.sets.filter(isWork).reduce((b, s) => b + num(s.w) * num(s.r), 0), 0);
}
function workoutRow(w) {
  const sets = w.exercises.reduce((a, e) => a + e.sets.filter(isWork).length, 0);
  const vol = Math.round(workoutVolume(w));
  return `<div class="card tap" data-act="showWorkout" data-id="${w.id}"><div class="row between"><b>${esc(w.name)}</b><span class="small muted">${fmtDate(w.start)}</span></div>
    <div class="small muted">${fmtDur(w.end - w.start)} · ${sets} sets${vol ? ` · ${vol.toLocaleString("nl-NL")} kg volume` : ""}${w.prs?.length ? ` · <span class="tag good">${w.prs.length} PR</span>` : ""}</div></div>`;
}

function viewRoutines() {
  if (!S.routines.length) return `<div class="empty"><p>Nog geen schema's.</p><div class="row wrap" style="justify-content:center;margin-top:12px"><button class="btn primary" data-act="tab" data-tab="coach">Coach laten maken</button><button class="btn" data-act="newRoutine">Zelf maken</button></div></div>`;
  return S.routines.map((r) => routineCard(r, `<div class="row" style="margin-top:10px"><button class="btn primary sm grow" data-act="startRoutine" data-id="${r.id}">Start</button><button class="btn sm" data-act="editRoutine" data-id="${r.id}">Bewerken</button><button class="btn sm" data-act="adjustOpen" data-id="${r.id}">Bijsturen</button></div>`)).join("")
    + `<button class="btn block" style="margin-top:16px" data-act="openLibrary">Oefeningen-bibliotheek</button>`;
}

// ---------- Coach ----------
function coachMode() { return U.coachMode || (S.settings.apiKey ? "chat" : "quick"); }
function viewCoach() {
  const mode = coachMode();
  let h = `<div class="chips" style="margin:6px 0 12px"><button class="chip ${mode === "chat" ? "on" : ""}" data-act="coachMode" data-mode="chat">💬 AI-chat</button><button class="chip ${mode === "quick" ? "on" : ""}" data-act="coachMode" data-mode="quick">⚡ Snelle coach</button></div>`;
  return h + (mode === "chat" ? viewChat() : viewQuickCoach());
}

function splitAdvice(p) {
  const d = Number(p.days) || 3;
  switch (p.split || "auto") {
    case "fullbody": return d > 3 ? "Elke training het hele lichaam. Bij 4+ dagen wordt het veel; overweeg voorkant/achterkant." : "Elke training het hele lichaam. Ideaal bij 2-3 dagen.";
    case "voorachter": return d === 3 ? "Voorkant: borst, schouders, triceps, bovenbenen, buik. Achterkant: rug, biceps, hamstrings, billen. Bij 3 dagen doe je de ene kant 2× en de andere 1×: wissel elke week om." : "Voorkant: borst, schouders, triceps, bovenbenen, buik. Achterkant: rug, biceps, hamstrings, billen. Bij 4 dagen train je elke spier 2× per week en spaar je je onderrug.";
    case "bovenonder": return "Bovenlichaam en benen op aparte dagen. Ideaal bij 4 dagen.";
    case "ppl": return "Duwen (borst, schouders, triceps), trekken (rug, biceps) en benen. Ideaal bij 3 of 6 dagen.";
    default: return "De coach kiest: 1-3 dagen full body, 4 dagen boven/onder, 5-6 dagen push/pull/legs.";
  }
}

function profileLine() {
  const p = S.profile;
  return `${(p.goals || []).join(", ")} · ${p.level} · ${p.days}x per week${p.split && p.split !== "auto" ? ` · ${SPLITS[p.split]}` : ""} · ${p.minutes} min · ${({ gym: "sportschool", home: "thuis + dumbbells", bodyweight: "zonder spullen" })[p.location]}${p.injuries?.length ? ` · let op: ${p.injuries.join(", ")}` : ""}`;
}

function viewQuickCoach() {
  const o = U.circuitOpts;
  const chip = (key, val, label) => `<button class="chip ${o[key] === val ? "on" : ""}" data-act="circOpt" data-k="${key}" data-v="${val}">${label}</button>`;
  return `
  <h2 style="margin-top:6px">Wat wil je maken?</h2>
  <div class="pick2">
    <button class="tile on" data-act="genPlan"><span class="ti">💪</span><b>Krachtschema</b><span>Met gewichten, voor spiermassa</span></button>
    <button class="tile${U.showCirc ? " on" : ""}" data-act="toggleCirc"><span class="ti">⚡</span><b>Circuit</b><span>Op tijd, voor conditie</span></button>
  </div>
  <p class="small muted" style="margin:8px 2px 0">Krachtschema op basis van: ${esc(profileLine())} · <a href="#" data-act="tab" data-tab="profile" style="color:var(--accent)">aanpassen</a></p>
  ${U.showCirc ? `<div class="card" style="margin-top:12px"><h3>Circuit</h3>
    <p class="small muted">Tijd</p><div class="chips">${[10, 15, 20, 30, 45].map((m) => chip("minutes", m, m + " min")).join("")}</div>
    <p class="small muted" style="margin-top:10px">Intensiteit</p><div class="chips">${chip("intensity", "rustig", "Rustig")}${chip("intensity", "normaal", "Normaal")}${chip("intensity", "zwaar", "Zwaar")}</div>
    <p class="small muted" style="margin-top:10px">Focus</p><div class="chips">${chip("focus", "fullbody", "Full body")}${chip("focus", "benen", "Benen")}${chip("focus", "boven", "Bovenlichaam")}${chip("focus", "core", "Core")}</div>
    <button class="btn primary block" style="margin-top:12px" data-act="genCircuit">Maak circuit</button></div>` : ""}
  <div class="card"><h3>Bijsturen voor vandaag</h3><p class="small muted">Geef aan hoe je je voelt, de coach past je volgende training aan.</p>
    ${S.routines.length ? `<button class="btn block" style="margin-top:8px" data-act="adjustOpen" data-id="${nextRoutine().id}">Bijsturen: ${esc(nextRoutine().name)}</button>` : `<p class="small">Maak eerst een schema.</p>`}</div>
  <div class="card"><h3>Coach-tips</h3><ul class="small muted" style="padding-left:18px;margin:6px 0">
    <li>Haal je bij alle sets de bovenkant van de reps? Dan geeft de app vanzelf een hoger gewicht als suggestie.</li>
    <li>Spiermassa: 10-20 harde sets per spiergroep per week, 1-3 reps voor falen.</li>
    <li>Eet genoeg eiwit (ca. 1,6-2 g per kg lichaamsgewicht) en slaap 7-9 uur.</li></ul></div>`;
}

function viewChat() {
  if (!S.settings.apiKey) {
    return `<div class="card"><h3>AI-coach instellen</h3><p class="small muted">De AI-coach is een echte chat: vertel wat je wilt ("maak een push/pull/legs voor 4 dagen", "mijn schouder doet pijn bij bench", "ik heb maar 25 min") en hij past je schema's aan.</p>
      <p class="small muted">Je hebt hiervoor een eigen Claude API-sleutel nodig (een paar cent per gesprek). Zonder sleutel werkt de Snelle coach gewoon.</p>
      <button class="btn primary block" style="margin-top:10px" data-act="tab" data-tab="profile">Sleutel invullen bij Profiel</button></div>`;
  }
  const quick = ["Maak een schema voor mij", "Ik heb vandaag maar 30 minuten", "Maak een circuit zonder spullen", "Ik ben moe vandaag", "Mijn knie doet pijn", "Hoe gaat mijn progressie?"];
  let h = `<div class="chat">`;
  if (!S.chat.length) h += `<div class="msg assistant">Hoi! Ik ben je coach. Ik ken je profiel, je schema's en je gelogde workouts. Waar kan ik je mee helpen?</div>`;
  S.chat.forEach((m, i) => {
    const text = m.role === "assistant" ? m.text.replace(/```json[\s\S]*?```/g, "").trim() : m.text;
    h += `<div class="msg ${m.role}${m.error ? " err" : ""}">${esc(text)}${m.routines ? `<div style="margin-top:10px"><button class="btn primary sm" data-act="saveAiRoutines" data-i="${i}">${m.saved ? "✓ Opgeslagen" : `Opslaan (${m.routines.length} schema${m.routines.length > 1 ? "'s" : ""})`}</button></div>` : ""}</div>`;
  });
  if (U.busy) h += `<div class="msg assistant" id="streamMsg">${esc(U.streaming.replace(/```json[\s\S]*?(```|$)/g, "…schema wordt gemaakt…")) || "…"}</div>`;
  h += `</div><div id="chatEnd"></div>`;
  if (!U.busy) h += `<div class="chips" style="margin-top:12px">${quick.map((q) => `<button class="chip" data-act="chatQuick" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>`;
  h += `<div class="composer"><textarea id="chatInput" rows="1" placeholder="Vraag je coach…"></textarea><button class="btn primary" data-act="chatSend" ${U.busy ? "disabled" : ""}>Stuur</button></div>`;
  if (S.chat.length) h += `<button class="btn ghost sm" data-act="chatClear">Gesprek wissen</button>`;
  return h;
}

async function sendChat(text) {
  text = text.trim();
  if (!text || U.busy) return;
  S.chat.push({ role: "user", text });
  U.busy = true; U.streaming = ""; save(); render();
  const { askCoach, extractRoutines } = await import("./ai.js");
  const res = await askCoach({
    apiKey: S.settings.apiKey, state: S, exName,
    onText: (t) => { U.streaming = t; const el = $("#streamMsg"); if (el) { el.textContent = t.replace(/```json[\s\S]*?(```|$)/g, "…schema wordt gemaakt…"); $("#chatEnd")?.scrollIntoView({ block: "end" }); } },
  });
  U.busy = false;
  if (res.error) {
    S.chat.pop(); // vraag niet in de geschiedenis houden als het mislukte
    S.chat.push({ role: "user", text }, { role: "assistant", text: res.text, error: true, local: true });
  } else {
    S.chat.push({ role: "assistant", text: res.text, routines: extractRoutines(res.text) || undefined });
  }
  save(); render();
}

function normalizeRoutine(r, source) {
  const exercises = (r.exercises || []).map((x) => {
    let id = x.exId;
    if (!id || !exById(id)) {
      const name = x.name || x.exId || "Oefening";
      const found = allEx().find((e) => e.name.toLowerCase() === String(name).toLowerCase());
      if (found) id = found.id;
      else {
        id = "c_" + uid();
        S.customExercises.push({ id, name, muscle: MUSCLES[x.muscle] ? x.muscle : "fullbody", eq: EQUIPMENT[x.eq] ? x.eq : "bodyweight", kind: "compound", avoid: [], timed: !!x.secs });
      }
    }
    const e = exById(id);
    return { exId: id, weight: +x.weight || undefined, sets: +x.sets || 3, repsMin: +x.repsMin || (e?.timed ? 0 : 8), repsMax: +x.repsMax || (e?.timed ? 0 : 12), rest: +x.rest || 90, secs: x.secs ? +x.secs : e?.timed ? 30 : undefined };
  });
  return {
    id: uid(), name: r.name || "Schema", type: r.type === "circuit" ? "circuit" : "strength", note: r.note || "", source,
    rounds: +r.rounds || 3, work: +r.work || 40, restBetween: +r.restBetween || 20, roundRest: +r.roundRest || 60, exercises,
  };
}

// ---------- Sets per spiergroep ----------
const MUSCLE_ORDER = ["borst", "rug", "schouders", "biceps", "triceps", "benen", "hamstrings", "billen", "kuiten", "core"];
function weekStart(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
function muscleSets(weekOffset = 0) {
  const from = weekStart(Date.now()) - weekOffset * 7 * 864e5, to = from + 7 * 864e5;
  const c = Object.fromEntries(MUSCLE_ORDER.map((m) => [m, 0]));
  S.workouts.filter((w) => w.start >= from && w.start < to).forEach((w) => w.exercises.forEach((e) => {
    const m = exById(e.exId)?.muscle; if (m in c) c[m] += e.sets.filter(isWork).length;
  }));
  return c;
}
function muscleTarget() { return (S.profile.goals || []).includes("spiermassa") ? [10, 20] : [6, 12]; }
function behindThisWeek() {
  const c = muscleSets(0), [min] = muscleTarget();
  return MUSCLE_ORDER.filter((m) => m !== "core" && m !== "kuiten" && c[m] < min).sort((a, b) => c[a] - c[b]).map((m) => ({ m, n: c[m], min }));
}
function muscleCard(weekOffset) {
  const c = muscleSets(weekOffset), [min, max] = muscleTarget(), scale = max + 6;
  return MUSCLE_ORDER.map((m) => {
    const n = c[m], col = n < min ? "var(--warn)" : n <= max ? "var(--good)" : "var(--accent)";
    return `<div class="mbar"><span>${MUSCLES[m]}</span><div class="track"><div class="zone" style="left:${(min / scale) * 100}%;width:${((max - min) / scale) * 100}%"></div><div class="fill" style="width:${Math.min(100, (n / scale) * 100)}%;background:${col}"></div></div><b style="text-align:right">${n}</b></div>`;
  }).join("");
}

// ---------- Voortgang ----------
function viewProgress() {
  if (!S.workouts.length) return `<div class="empty"><p>Nog geen workouts gelogd.</p><p class="small">Na je eerste training zie je hier grafieken, PR's en je geschiedenis.</p></div>`;
  let h = `<div class="stats"><div class="stat"><b>${S.workouts.length}</b><span>workouts</span></div><div class="stat"><b>${streakWeeks()}</b><span>weken op rij</span></div><div class="stat"><b>${S.workouts.reduce((a, w) => a + (w.prs?.length || 0), 0)}</b><span>PR's</span></div></div>`;
  // Volume per week (8 weken)
  const wk = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
  const now = wk(Date.now());
  const weeks = Array.from({ length: 8 }, (_, i) => now - (7 - i) * 7 * 864e5);
  const vols = weeks.map((w) => S.workouts.filter((x) => wk(x.start) === w).reduce((a, x) => a + workoutVolume(x), 0));
  const cnt = weeks.map((w) => S.workouts.filter((x) => wk(x.start) === w).length);
  U.mWeek = U.mWeek || 0;
  const [tmin, tmax] = muscleTarget();
  h += `<h2>Sets per spiergroep</h2><div class="card"><div class="chips" style="margin-bottom:6px"><button class="chip ${U.mWeek === 0 ? "on" : ""}" data-act="mWeek" data-v="0">Deze week</button><button class="chip ${U.mWeek === 1 ? "on" : ""}" data-act="mWeek" data-v="1">Vorige week</button></div>
    ${muscleCard(U.mWeek)}<p class="small muted">Groen vlak = doel ${tmin}-${tmax} harde sets per week (${(S.profile.goals || []).includes("spiermassa") ? "spiermassa" : "fit blijven"}). Opwarmsets tellen niet mee. Biceps en triceps worden ook getraind bij trek- en drukoefeningen.</p></div>`;
  h += `<h2>Volume per week</h2><div class="card">${barChart(weeks.map((w) => new Date(w).toLocaleDateString("nl-NL", { day: "numeric", month: "numeric" })), vols, cnt)}</div>`;
  // Per oefening
  const logged = [...new Set(S.workouts.flatMap((w) => w.exercises.filter((e) => e.sets.some((s) => s.done)).map((e) => e.exId)))];
  if (!U.progEx || !logged.includes(U.progEx)) U.progEx = logged[0];
  if (U.progEx) {
    const ex = exById(U.progEx);
    const points = S.workouts.map((w) => {
      const e = w.exercises.find((x) => x.exId === U.progEx); if (!e) return null;
      const done = e.sets.filter(isWork);
      if (!done.length) return null;
      let val;
      if (ex?.timed) val = Math.max(...done.map((s) => num(s.secs)));
      else if (done.some((s) => num(s.w) > 0)) val = Math.max(...done.map((s) => e1rm(num(s.w), num(s.r))));
      else val = Math.max(...done.map((s) => num(s.r)));
      return { t: w.start, v: Math.round(val * 10) / 10 };
    }).filter(Boolean);
    const unit = ex?.timed ? "sec" : points.some(() => S.workouts.some((w) => w.exercises.some((x) => x.exId === U.progEx && x.sets.some((s) => num(s.w) > 0)))) ? "kg (geschat 1RM)" : "reps";
    h += `<h2>Per oefening</h2><div class="card"><select id="progEx">${logged.map((id) => `<option value="${id}" ${id === U.progEx ? "selected" : ""}>${esc(exName(id))}</option>`).join("")}</select>
      <p class="small muted" style="margin-top:8px">Beste set per training, in ${unit}</p>${lineChart(points)}</div>`;
  }
  // PR's
  const prs = S.workouts.flatMap((w) => (w.prs || []).map((p) => ({ ...p, t: w.start }))).slice(-8).reverse();
  if (prs.length) h += `<h2>Recente PR's 🏆</h2><div class="card">${prs.map((p) => `<div class="list-item"><div class="grow"><b>${esc(exName(p.exId))}</b><div class="small muted">${esc(p.text)}</div></div><span class="small muted">${fmtDate(p.t)}</span></div>`).join("")}</div>`;
  h += `<h2>Geschiedenis</h2>` + S.workouts.slice().reverse().map(workoutRow).join("");
  return h;
}

function barChart(labels, vals, counts) {
  const W = 320, H = 170, max = Math.max(1, ...vals), bw = W / vals.length;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${vals.map((v, i) => {
    const bh = (v / max) * (H - 40);
    return `<rect x="${i * bw + 6}" y="${H - 22 - bh}" width="${bw - 12}" height="${Math.max(bh, counts[i] ? 2 : 0)}" rx="4" fill="${i === vals.length - 1 ? "var(--accent)" : "#3a3a3a"}" stroke="none"/>
      <text x="${i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${labels[i]}</text>
      ${counts[i] ? `<text x="${i * bw + bw / 2}" y="${H - 28 - bh}" text-anchor="middle">${counts[i]}x</text>` : ""}`;
  }).join("")}</svg><p class="small muted">Totaal gewicht × reps per week (cijfer = aantal trainingen)</p>`;
}

function lineChart(points) {
  if (points.length < 2) return `<p class="small muted">${points.length ? `Eerste meting: ${points[0].v}. Na nog een training zie je hier je lijn.` : "Nog geen data."}</p>`;
  const W = 320, H = 170, pad = 28;
  const vs = points.map((p) => p.v), min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1;
  const x = (i) => pad + (i / (points.length - 1)) * (W - pad - 10);
  const y = (v) => H - 22 - ((v - min) / span) * (H - 44);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">
    <text x="2" y="${y(max) + 4}">${max}</text><text x="2" y="${y(min) + 4}">${min}</text>
    <path d="${d}" stroke="var(--accent)" stroke-width="2.5"/>
    ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="3.5" fill="var(--accent)" stroke="none"/>`).join("")}
    <text x="${pad}" y="${H - 4}">${new Date(points[0].t).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</text>
    <text x="${W - 10}" y="${H - 4}" text-anchor="end">${new Date(points.at(-1).t).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</text>
  </svg>`;
}

// ---------- Profiel ----------
function viewProfile() {
  const p = S.profile;
  const multi = (key, opts) => `<div class="chips">${opts.map(([v, l]) => `<button class="chip ${p[key].includes(v) ? "on" : ""}" data-act="profToggle" data-k="${key}" data-v="${v}">${l}</button>`).join("")}</div>`;
  const single = (key, opts) => `<div class="chips">${opts.map(([v, l]) => `<button class="chip ${String(p[key]) === String(v) ? "on" : ""}" data-act="profSet" data-k="${key}" data-v="${v}">${l}</button>`).join("")}</div>`;
  return `
  <div class="card">
    <h3>Jouw profiel</h3><p class="small muted">Hierop baseert de coach je schema's.</p>
    <label class="field"><span>Doelen</span>${multi("goals", [["spiermassa", "Spiermassa"], ["kracht", "Kracht"], ["fit", "Algemeen fit"], ["conditie", "Conditie"]])}</label>
    <label class="field"><span>Niveau</span>${single("level", [["beginner", "Beginner (<1 jaar)"], ["gemiddeld", "Gemiddeld"], ["gevorderd", "Gevorderd (3+ jaar)"]])}</label>
    <label class="field"><span>Dagen per week</span>${single("days", [[2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"]])}</label>
    <label class="field"><span>Indeling van je schema</span>${single("split", Object.entries(SPLITS))}<p class="small muted" style="margin-top:6px">${splitAdvice(p)}</p>
      ${p.done ? `<button class="btn ghost sm" data-act="genPlan">Maak nieuw schema met deze indeling</button>` : ""}</label>
    <label class="field"><span>Tijd per training: <b id="minLbl">${p.minutes} min</b></span><input type="range" min="20" max="120" step="5" value="${p.minutes}" data-bind="profile.minutes"></label>
    <label class="field"><span>Waar train je meestal?</span>${single("location", [["gym", "Sportschool"], ["home", "Thuis + dumbbells"], ["bodyweight", "Zonder spullen"]])}</label>
    <label class="field"><span>Blessures / ontzien</span>${multi("injuries", INJURIES.map((i) => [i, i[0].toUpperCase() + i.slice(1)]))}</label>
    <label class="field"><span>Lichaamsgewicht (kg, optioneel)</span><input type="number" inputmode="decimal" value="${esc(p.bodyweight)}" data-bind="profile.bodyweight"></label>
    <label class="field"><span>Wensen voor je coach (optioneel)</span><textarea data-bind="profile.notes" rows="2" placeholder="Bijv. focus op schouders, geen deadlifts, maandag weinig tijd">${esc(p.notes)}</textarea></label>
    ${p.done ? "" : `<button class="btn primary block" data-act="profileDone">Opslaan & schema laten maken</button>`}
  </div>

  <h2>AI-coach</h2>
  <div class="card">
    <p class="small muted">Voor de chat-coach is een Claude API-sleutel nodig. Maak die aan op <b>console.anthropic.com</b> → API Keys, en zet er wat tegoed op (bijv. $5; een gesprek kost een paar cent). De sleutel blijft alleen op deze telefoon.</p>
    <label class="field"><span>API-sleutel</span><input type="password" autocomplete="off" placeholder="sk-ant-…" value="${esc(S.settings.apiKey)}" data-bind="settings.apiKey"></label>
    ${S.settings.apiKey ? `<button class="btn danger sm" data-act="clearKey">Sleutel verwijderen</button>` : ""}
  </div>

  <h2>Training</h2>
  <div class="card row between"><div class="grow"><b>Gewichten automatisch aanpassen</b><div class="small muted">De app kijkt naar je reps: eerst meer reps, haal je bij alle sets de bovenkant dan 1 stap zwaarder. Zit je 2× onder je minimum reps, dan 1 stap lichter.</div></div>
    <button class="chip ${S.settings.autoWeights !== false ? "on" : ""}" data-act="toggleAuto">${S.settings.autoWeights !== false ? "Aan" : "Uit"}</button></div>

  <h2>Oefeningen</h2>
  <div class="card row between"><div><b>Bibliotheek</b><div class="small muted">${allEx().length} oefeningen, ${S.customExercises.length} eigen</div></div><button class="btn sm" data-act="openLibrary">Openen</button></div>

  <h2>Gegevens</h2>
  <div class="card">
    <p class="small muted">Alles staat alleen op deze telefoon. Maak af en toe een back-up.</p>
    <div class="row wrap" style="margin-top:8px"><button class="btn sm" data-act="exportData">Back-up maken</button>
    <label class="btn sm">Back-up terugzetten<input type="file" accept="application/json,.json" id="importFile" hidden></label></div>
    <button class="btn danger sm" style="margin-top:12px" data-act="resetAll">Alles wissen</button>
  </div>
  <p class="small muted" style="text-align:center;margin-top:20px">Forge · v1.0</p>`;
}

// ---------- Actieve workout ----------
function makeActiveFromRoutine(r) {
  return {
    id: uid(), routineId: r.id, name: r.name, start: Date.now(), note: r.note || "",
    exercises: r.exercises.map((x) => newActiveEx(x.exId, x)),
  };
}
function lastSetsFor(exId) {
  for (let i = S.workouts.length - 1; i >= 0; i--) {
    const e = S.workouts[i].exercises.find((x) => x.exId === exId);
    if (e && e.sets.some(isWork)) return e.sets.filter(isWork);
  }
  return [];
}
function newActiveEx(exId, plan) {
  const ex = exById(exId);
  plan = { sets: 3, repsMin: 8, repsMax: 12, rest: 90, ...(plan || {}) };
  if (ex?.timed && !plan.secs) plan.secs = 30;
  const prev = lastSetsFor(exId);
  const sug = suggestNext(exId, plan, S.workouts);
  const target = plan.weight || sug?.weight || prev[i0(prev)]?.w || "";
  const sets = Array.from({ length: plan.sets }, (_, i) => ({
    w: "", r: "", secs: "", done: false,
    pw: target || prev[i]?.w || "",
    pr: ex?.timed ? "" : repTarget(prev[i], target, plan),
    ps: ex?.timed ? (prev[i]?.secs || plan.secs) : "",
  }));
  const sameW = prev.length && prev.every((p) => num(p.w) === num(target));
  const goal = sets.map((s) => s.pr).filter(Boolean).join("·");
  const hint = plan.weight && !ex?.timed
    ? `${plan.weight} kg${sameW ? ` · vorige keer ${prev.map((p) => p.r).join("·")} → probeer ${goal}` : ` × ${plan.repsMin}-${plan.repsMax}`}. Alle sets ${plan.repsMax} = volgende keer zwaarder.`
    : sug?.text || "";
  return { exId, plan, sets, hint, ...(plan.ss ? { ss: plan.ss } : {}) };
}
const i0 = (prev) => Math.max(0, prev.length - 1);
// Reps-doel per set: zelfde gewicht als vorige keer -> 1 rep meer (tot de bovenkant)
function repTarget(p, target, plan) {
  if (!plan.repsMax || !plan.repsMin) return p?.r || "";
  if (p && num(p.w) === num(target) && num(p.r) > 0) return Math.min(plan.repsMax, Math.max(plan.repsMin, num(p.r) + 1));
  return plan.repsMin;
}

function startWorkout(active) {
  if (S.active) { if (!confirm("Je hebt al een training bezig. Die stoppen en deze starten?")) return; }
  S.active = active; save(); render();
}

function renderOverlay() {
  const o = $("#overlay");
  if (U.circuit) { o.hidden = false; o.innerHTML = viewCircuit(); return; }
  if (U.edit) { o.hidden = false; o.innerHTML = viewEditor(); return; }
  if (S.active && U.showActive) { o.hidden = false; const y = o.scrollTop; o.innerHTML = viewActive(); o.scrollTop = y; renderRest(); return; }
  o.hidden = true; o.innerHTML = ""; renderRest();
}

function viewActive() {
  const a = S.active;
  let h = `<div class="ohead"><button class="btn ghost" data-act="minimize">${ICON.down}</button><div style="text-align:center" class="grow"><b>${esc(a.name)}</b><div class="small muted" id="elapsed">${mmss((Date.now() - a.start) / 1000)}</div></div><button class="btn good sm" data-act="finish">Klaar</button></div><div class="obody">`;
  if (a.note) h += `<p class="small muted">${esc(a.note)}</p>`;
  a.exercises.forEach((e, ei) => {
    const ex = exById(e.exId);
    const timed = ex?.timed;
    const target = timed ? `${e.plan.sets} × ${e.plan.secs}s` : e.plan.repsMin ? `${e.plan.sets} × ${e.plan.repsMin}-${e.plan.repsMax} reps` : "";
    const bw = ex?.eq === "bodyweight";
    const ssPrev = ei > 0 && e.ss && a.exercises[ei - 1].ss === e.ss;
    const ssNext = e.ss && a.exercises[ei + 1]?.ss === e.ss;
    const prevAll = lastSetsFor(e.exId);
    const hasWarm = e.sets.some((s) => s.type === "w");
    const canWarm = !timed && !bw && ex?.kind === "compound" && !hasWarm;
    const canPlates = !timed && (ex?.eq === "barbell" || e.exId === "leg_press");
    let workNo = 0;
    h += `${e.ss && !ssPrev ? `<div class="ss-label">🔗 Superset</div>` : ""}<div class="card${e.ss ? " ss" : ""}${ssNext ? " ss-top" : ""}${ssPrev ? " ss-bottom" : ""}"><div class="row between"><div class="grow" data-act="exToggle" data-ei="${ei}"><h3 style="color:var(--accent)">${esc(exName(e.exId))} <span class="info${e._open ? " on" : ""}">ⓘ <svg viewBox="0 0 24 24" style="width:14px;height:14px;vertical-align:-2px;${e._open ? "transform:rotate(180deg)" : ""}"><path d="M6 9l6 6 6-6"/></svg></span></h3><div class="small muted">${target}${e.plan.rest ? ` · rust ${e.plan.rest}s` : ""}</div></div>
      <button class="icon-btn" data-act="exMenu" data-ei="${ei}">${ICON.more}</button></div>
      ${e._open ? inlineInfo(e.exId) : ""}
      ${e.hint ? `<div class="hint">💡 ${esc(e.hint)}</div>` : ""}
      <table class="sets"><tr><th>Set</th><th>Vorige</th>${timed ? "<th>Sec</th>" : `<th>${bw ? "+kg" : "kg"}</th><th>Reps</th>`}<th></th></tr>
      ${e.sets.map((s, si) => {
        const t = SET_TYPES[s.type];
        const prev = s.type === "w" ? null : prevAll[workNo];
        const label = t ? t[0] : String(++workNo);
        const prevTxt = prev ? (timed ? `${prev.secs}s` : `${prev.w || 0}×${prev.r}`) : "–";
        return `<tr class="${s.done ? "done" : ""}"><td><button class="setno" ${t ? `style="color:${t[2]}"` : ""} data-act="setMenu" data-ei="${ei}" data-si="${si}">${label}</button></td><td class="prev">${prevTxt}</td>
          ${timed ? `<td><input type="number" inputmode="numeric" placeholder="${esc(s.ps)}" value="${esc(s.secs)}" data-set="${ei}.${si}.secs"></td>`
          : `<td><input type="number" inputmode="decimal" placeholder="${esc(s.pw)}" value="${esc(s.w)}" data-set="${ei}.${si}.w"></td><td><input type="number" inputmode="numeric" placeholder="${esc(s.pr)}" value="${esc(s.r)}" data-set="${ei}.${si}.r"></td>`}
          <td><button class="check ${s.done ? "on" : ""}" data-act="toggleSet" data-ei="${ei}" data-si="${si}">${ICON.check}</button></td></tr>`;
      }).join("")}</table>
      <div class="row wrap" style="gap:2px"><button class="btn ghost sm" data-act="addSet" data-ei="${ei}">${ICON.plus} Set</button>
      ${canWarm ? `<button class="btn ghost sm" data-act="addWarmups" data-ei="${ei}">🔥 Opwarmsets</button>` : ""}
      ${canPlates ? `<button class="btn ghost sm" data-act="plates" data-ei="${ei}">🏋️ Schijven</button>` : ""}</div></div>`;
  });
  h += `<button class="btn block" style="margin-top:12px" data-act="pickExercise" data-mode="active">${ICON.plus} Oefening toevoegen</button>
    <button class="btn danger block" style="margin-top:10px" data-act="discard">Training annuleren</button></div>`;
  return h;
}

function renderRest() {
  let bar = $("#restbar");
  if (!U.rest || !U.showActive || !S.active) { bar?.remove(); return; }
  if (!bar) { bar = document.createElement("div"); bar.id = "restbar"; document.body.appendChild(bar); }
  const left = Math.max(0, Math.ceil((U.rest.end - Date.now()) / 1000));
  bar.innerHTML = `<div class="grow"><div class="small muted">Rust</div><div class="time">${mmss(left)}</div><div class="bar"><i style="width:${(left / U.rest.total) * 100}%"></i></div></div>
    <button class="btn sm" data-act="restAdd" data-s="-15">−15</button><button class="btn sm" data-act="restAdd" data-s="15">+15</button><button class="btn primary sm" data-act="restSkip">Skip</button>`;
}

setInterval(() => {
  if (S.active && U.showActive) { const el = $("#elapsed"); if (el) el.textContent = mmss((Date.now() - S.active.start) / 1000); }
  if (U.rest) {
    const left = (U.rest.end - Date.now()) / 1000;
    if (left <= 0) { U.rest = null; beep(988, 0.18, 3); renderRest(); toast("Rust voorbij — volgende set!"); }
    else renderRest();
  }
  if (U.circuit) tickCircuit();
}, 250);

async function finishWorkout() {
  const a = S.active;
  const done = a.exercises.map((e) => ({ exId: e.exId, sets: e.sets.filter((s) => s.done).map(({ w, r, secs, done, type }) => (type ? { w, r, secs, done, type } : { w, r, secs, done })) })).filter((e) => e.sets.length);
  if (!done.length) {
    if (confirm("Je hebt nog geen sets afgevinkt. Training weggooien?")) { S.active = null; U.showActive = false; U.rest = null; save(); render(); }
    return;
  }
  const feeling = await askFeeling();
  if (feeling === null) return;
  // PR-detectie
  const prs = [];
  for (const e0 of done) {
    const e = { ...e0, sets: e0.sets.filter((s) => s.type !== "w") };
    if (!e.sets.length) continue;
    const ex = exById(e.exId);
    const prevSets = S.workouts.flatMap((w) => w.exercises.filter((x) => x.exId === e.exId).flatMap((x) => x.sets.filter(isWork)));
    if (!prevSets.length) continue;
    if (ex?.timed) {
      const best = Math.max(...e.sets.map((s) => num(s.secs))), old = Math.max(...prevSets.map((s) => num(s.secs)));
      if (best > old) prs.push({ exId: e.exId, text: `Langste: ${best}s (was ${old}s)` });
      continue;
    }
    const bestW = Math.max(...e.sets.map((s) => num(s.w))), oldW = Math.max(...prevSets.map((s) => num(s.w)));
    const best1 = Math.max(...e.sets.map((s) => e1rm(num(s.w), num(s.r)))), old1 = Math.max(...prevSets.map((s) => e1rm(num(s.w), num(s.r))));
    const bestR = Math.max(...e.sets.map((s) => num(s.r))), oldR = Math.max(...prevSets.map((s) => num(s.r)));
    if (bestW > oldW && bestW > 0) prs.push({ exId: e.exId, text: `Zwaarste gewicht: ${bestW} kg (was ${oldW})` });
    else if (best1 > old1 + 0.5 && bestW > 0) prs.push({ exId: e.exId, text: `Beste set: geschat 1RM ${Math.round(best1)} kg (was ${Math.round(old1)})` });
    else if (bestW === 0 && bestR > oldR) prs.push({ exId: e.exId, text: `Meeste reps: ${bestR} (was ${oldR})` });
  }
  const w = { id: a.id, routineId: a.routineId, name: a.name, start: a.start, end: Date.now(), exercises: done, prs, feeling };
  S.workouts.push(w);
  const idx = S.routines.findIndex((r) => r.id === a.routineId);
  if (idx >= 0) S.nextIdx = idx + 1;
  const cIdx = a.countsAs ? S.routines.findIndex((r) => r.id === a.countsAs) : -1;
  if (cIdx >= 0) S.nextIdx = cIdx + 1;
  const wChanges = idx >= 0 && S.settings.autoWeights !== false ? progressRoutine(S.routines[idx], done, exById) : [];
  w.weightChanges = wChanges;
  S.active = null; U.showActive = false; U.rest = null;
  saveNow(); render();
  showSheet(`<h3>Lekker getraind! 🔥</h3><p class="muted">${fmtDur(w.end - w.start)} · ${done.reduce((a, e) => a + e.sets.length, 0)} sets · ${Math.round(workoutVolume(w)).toLocaleString("nl-NL")} kg volume</p>
    ${prs.length ? `<h3 style="margin-top:14px">Nieuwe PR's 🏆</h3>${prs.map((p) => `<div class="list-item"><b class="grow">${esc(exName(p.exId))}</b><span class="small">${esc(p.text)}</span></div>`).join("")}` : ""}
    ${wChanges.length ? `<h3 style="margin-top:14px">Schema aangepast 📈</h3>${wChanges.map((c) => `<div class="list-item"><div class="grow"><b>${esc(exName(c.exId))}</b><div class="small muted">${esc(c.why)}</div></div><span class="small">${c.from ? `${c.from} → ` : ""}<b>${c.to} kg</b></span></div>`).join("")}` : ""}
    ${feeling === "zwaar" ? `<p class="hint" style="margin-top:12px">Was het zwaar? Bij de volgende training kun je bij "Bijsturen" kiezen voor "Te zwaar".</p>` : feeling === "makkelijk" ? `<p class="hint" style="margin-top:12px">Te makkelijk? De app stelt volgende keer automatisch zwaardere gewichten voor als je alle reps haalt.</p>` : ""}
    <button class="btn primary block" style="margin-top:16px" data-act="closeSheet">Sluiten</button>`);
}

function askFeeling() {
  return new Promise((resolve) => {
    showSheet(`<h3>Hoe voelde de training?</h3><div class="chips" style="margin-top:12px">
      <button class="chip" data-feel="zwaar">😮‍💨 Zwaar</button><button class="chip" data-feel="goed">👍 Goed</button><button class="chip" data-feel="makkelijk">💪 Makkelijk</button></div>
      <button class="btn ghost" style="margin-top:12px" data-feel="__cancel">Nog niet klaar</button>`);
    U.feelResolve = (v) => { closeSheet(); resolve(v === "__cancel" ? null : v); };
  });
}

// ---------- Circuit-speler ----------
function startCircuit(r) {
  unlockAudio();
  U.circuit = { r, round: 1, idx: 0, phase: "prep", end: Date.now() + 10000, total: 10, paused: false, start: Date.now(), log: [] };
  keepAwake(true); renderOverlay();
}
function setPhase(phase, secs) {
  const c = U.circuit; c.phase = phase; c.total = secs; c.end = Date.now() + secs * 1000; c.lastBeep = null;
}
function advanceCircuit() {
  const c = U.circuit, r = c.r;
  if (c.phase === "prep") { setPhase("work", r.work); beep(1046, 0.3); }
  else if (c.phase === "work") {
    c.log.push({ exId: r.exercises[c.idx].exId, secs: r.work });
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
  if (c.phase === "done") return `<div class="ohead"><b>${esc(r.name)}</b></div><div class="obody circuit"><div class="big">🔥</div><div class="name">Circuit klaar!</div><p class="muted">${r.rounds} rondes · ${fmtDur(Date.now() - c.start)}</p><button class="btn primary block" style="margin-top:24px" data-act="closeCircuit">Sluiten</button></div>`;
  const cur = r.exercises[c.idx], nxt = c.phase === "work" ? r.exercises[c.idx + 1] : cur;
  const label = { prep: "Maak je klaar", work: "Werk", rest: "Rust", roundrest: `Rust · ronde ${c.round} komt eraan` }[c.phase];
  const left = Math.max(0, Math.ceil((c.end - Date.now()) / 1000));
  const showName = c.phase === "work" ? exName(cur.exId) : `Volgende: ${exName(cur.exId)}`;
  return `<div class="ohead"><button class="btn ghost" data-act="stopCircuit">${ICON.close}</button><div class="grow" style="text-align:center"><b>${esc(r.name)}</b><div class="small muted">Ronde ${c.round}/${r.rounds} · oefening ${c.idx + 1}/${r.exercises.length}</div></div><span style="width:44px"></span></div>
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
    S.workouts.push({ id: uid(), routineId: c.r.id, name: c.r.name, start: c.start, end: Date.now(), exercises: [...map].map(([exId, sets]) => ({ exId, sets })), prs: [], type: "circuit" });
    const idx = S.routines.findIndex((x) => x.id === c.r.id); if (idx >= 0) S.nextIdx = idx + 1;
    saveNow();
  }
  keepAwake(false); renderOverlay();
}

// ---------- Schema-editor ----------
function viewEditor() {
  const r = U.edit;
  const circ = r.type === "circuit";
  let h = `<div class="ohead"><button class="btn ghost" data-act="editCancel">Annuleer</button><b>${r._new ? "Nieuw schema" : "Bewerken"}</b><button class="btn primary sm" data-act="editSave">Bewaar</button></div><div class="obody">
    <label class="field"><span>Naam</span><input type="text" value="${esc(r.name)}" data-edit="name"></label>
    <div class="chips"><button class="chip ${!circ ? "on" : ""}" data-act="editType" data-v="strength">Kracht (sets/reps)</button><button class="chip ${circ ? "on" : ""}" data-act="editType" data-v="circuit">Circuit (op tijd)</button></div>`;
  if (circ) {
    h += `<div class="row" style="margin-top:10px">
      <label class="field grow"><span>Rondes</span><input type="number" inputmode="numeric" value="${r.rounds}" data-edit="rounds"></label>
      <label class="field grow"><span>Werk (s)</span><input type="number" inputmode="numeric" value="${r.work}" data-edit="work"></label>
      <label class="field grow"><span>Rust (s)</span><input type="number" inputmode="numeric" value="${r.restBetween}" data-edit="restBetween"></label>
      <label class="field grow"><span>Rondepauze</span><input type="number" inputmode="numeric" value="${r.roundRest}" data-edit="roundRest"></label></div>`;
  }
  h += `<label class="field"><span>Notitie (optioneel)</span><input type="text" value="${esc(r.note)}" data-edit="note"></label>`;
  r.exercises.forEach((x, i) => {
    const ex = exById(x.exId);
    const nx = r.exercises[i + 1], linked = x.ss && nx?.ss === x.ss, pv = r.exercises[i - 1];
    h += `${x.ss && !(pv?.ss === x.ss) ? `<div class="ss-label">🔗 Superset</div>` : ""}<div class="card${x.ss ? " ss" : ""}${linked ? " ss-top" : ""}${x.ss && pv?.ss === x.ss ? " ss-bottom" : ""}"><div class="row"><b class="grow" data-act="exInfo" data-id="${x.exId}">${esc(exName(x.exId))} <span class="info">ⓘ</span></b>
      <button class="icon-btn" data-act="edMove" data-i="${i}" data-d="-1">${ICON.up}</button><button class="icon-btn" data-act="edMove" data-i="${i}" data-d="1">${ICON.down}</button><button class="icon-btn" data-act="edDel" data-i="${i}">${ICON.trash}</button></div>
      ${circ ? "" : `<div class="row" style="margin-top:6px">
        <label class="grow"><span class="small muted">Sets</span><input type="number" inputmode="numeric" value="${x.sets}" data-edx="${i}.sets"></label>
        ${ex?.timed ? `<label class="grow"><span class="small muted">Seconden</span><input type="number" inputmode="numeric" value="${x.secs || 30}" data-edx="${i}.secs"></label>`
        : `<label class="grow"><span class="small muted">kg</span><input type="number" inputmode="decimal" value="${x.weight ?? ""}" placeholder="–" data-edx="${i}.weight"></label><label class="grow"><span class="small muted">Reps min</span><input type="number" inputmode="numeric" value="${x.repsMin}" data-edx="${i}.repsMin"></label><label class="grow"><span class="small muted">Reps max</span><input type="number" inputmode="numeric" value="${x.repsMax}" data-edx="${i}.repsMax"></label>`}
        <label class="grow"><span class="small muted">Rust (s)</span><input type="number" inputmode="numeric" value="${x.rest}" data-edx="${i}.rest"></label></div>`}</div>`;
    if (nx && !circ) h += `<div class="ss-link"><button class="btn ghost sm" data-act="edLink" data-i="${i}">${linked ? "🔗 Superset opheffen" : "🔗 Superset met volgende"}</button></div>`;
  });
  h += `<button class="btn block" style="margin-top:12px" data-act="pickExercise" data-mode="edit">${ICON.plus} Oefening toevoegen</button>`;
  if (!r._new) h += `<button class="btn danger block" style="margin-top:24px" data-act="editDelete">Schema verwijderen</button>`;
  return h + `</div>`;
}

// ---------- Opwarmsets, schijven, supersets ----------
function warmupSets(work, ex) {
  const barbell = ex?.eq === "barbell";
  const bar = S.settings.bar ?? 20;
  const step = ex?.eq === "dumbbell" || ex?.eq === "kettlebell" ? 2 : 2.5;
  const r = (v) => Math.round(v / step) * step;
  const plan = barbell && work > bar + 10 ? [[bar, 10]] : [];
  for (const [pct, reps] of [[0.5, 8], [0.7, 5], [0.85, 2]]) {
    const w = r(work * pct);
    if (w >= work || (plan.length && w <= plan.at(-1)[0]) || (barbell && w < bar)) continue;
    plan.push([w, reps]);
  }
  return plan;
}
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const PLATE_COLORS = { 25: "#e5484d", 20: "#3e63dd", 15: "#f5d90a", 10: "#30a46c", 5: "#eeeeee", 2.5: "#888", 1.25: "#555" };
function platesHtml() {
  const bar = U.plateLeg ? 0 : S.settings.bar ?? 20;
  let side = (U.plateW - bar) / 2;
  const list = [];
  if (side > 0) for (const p of PLATES) while (side >= p - 1e-9) { list.push(p); side -= p; }
  const left = Math.round(side * 2 * 100) / 100;
  const chip = (v, l) => `<button class="chip ${bar === v ? "on" : ""}" data-act="plateSet" data-k="bar" data-v="${v}">${l}</button>`;
  return `<div class="row between"><h3>Schijvencalculator</h3><button class="icon-btn" data-act="closeSheet">${ICON.close}</button></div>
    <div class="row" style="justify-content:center;gap:10px;margin:14px 0">
      <button class="btn" data-act="plateSet" data-v="-2.5">−2,5</button><div style="font-size:34px;font-weight:800;min-width:120px;text-align:center">${U.plateW} kg</div><button class="btn" data-act="plateSet" data-v="2.5">+2,5</button></div>
    ${U.plateLeg ? `<p class="small muted">Leg press: schijven zonder stang, verdeel over beide kanten.</p>` : `<p class="small muted">Stang</p><div class="chips">${chip(20, "20 kg (normaal)")}${chip(15, "15 kg (dames)")}${chip(10, "10 kg (EZ/kort)")}</div>`}
    <div class="bar-viz">${U.plateLeg ? "" : '<span class="sleeve"></span>'}${list.map((p) => `<span class="plate" style="background:${PLATE_COLORS[p]};height:${40 + p * 3}px">${String(p).replace(".", ",")}</span>`).join("")}</div>
    ${U.plateW <= bar && !U.plateLeg ? `<p>Alleen de stang (${bar} kg).</p>` : `<p><b>Per kant:</b> ${list.length ? list.map((p) => String(p).replace(".", ",")).join(" + ") : "niets"}</p>`}
    ${left > 0 ? `<p class="small" style="color:var(--warn)">Niet precies te maken: ${String(left).replace(".", ",")} kg over. Kies een gewicht in stappen van 2,5 kg.</p>` : ""}`;
}
function linkSuperset(list, i) {
  const a = list[i], b = list[i + 1];
  if (!a || !b) return;
  const id = a.ss || b.ss || uid();
  a.ss = id; b.ss = id;
}
function unlinkSuperset(list, i) {
  const id = list[i].ss;
  list.forEach((x) => { if (x.ss === id) delete x.ss; });
}

// ---------- Sheets ----------
function showSheet(html) { const s = $("#sheet"); s.innerHTML = `<div class="panel"><div class="grab"></div>${html}</div>`; s.hidden = false; }
function closeSheet() { const s = $("#sheet"); s.hidden = true; s.innerHTML = ""; U.picker = null; U.backHtml = null; }

function pickResults() {
  const p = U.picker, q = p.q.toLowerCase().trim();
  return allEx().filter((e) => (!p.muscle || e.muscle === p.muscle)
    && (!p.eq || (p.eq === "zonder" ? e.eq === "bodyweight" : e.eq === p.eq))
    && (!p.cat || catOf(e) === p.cat)
    && (!q || e.name.toLowerCase().includes(q)));
}
function pickListHtml() {
  const p = U.picker, all = pickResults(), list = all.slice(0, p.limit || 80);
  const row = (e) => `<div class="list-item" ${p.mode !== "library" ? `data-act="pickIt" data-id="${e.id}"` : `data-act="exInfo" data-id="${e.id}"`}>${thumb(e.id)}<div class="grow"><b>${esc(e.name)}</b>${!e.id.startsWith("x_") && !e.id.startsWith("c_") ? ` <span class="tag accent">NL</span>` : ""}<div class="small muted">${MUSCLES[e.muscle] || e.muscle} · ${EQUIPMENT[e.eq] || e.eq}${e.cat && e.cat !== "kracht" ? ` · ${CATEGORIES[e.cat]}` : ""}${e.level ? ` · ${LEVELS[e.level]}` : ""}</div></div>${e.id.startsWith("c_") && p.mode === "library" ? `<button class="icon-btn" data-act="delCustom" data-id="${e.id}">${ICON.trash}</button>` : p.mode !== "library" ? `<button class="icon-btn" data-act="exInfo" data-id="${e.id}" aria-label="Uitleg">ⓘ</button><span class="tag accent">+</span>` : ""}</div>`;
  return `<p class="small muted" style="margin:4px 0">${all.length} oefeningen${!EXTRA.length ? " (bibliotheek laadt…)" : ""}</p>${list.map(row).join("") || `<p class="muted small">Niets gevonden. Voeg hem hieronder zelf toe.</p>`}
    ${all.length > list.length ? `<button class="btn block" data-act="pickMore">Toon meer (${all.length - list.length})</button>` : ""}`;
}
function pickerHtml() {
  const p = U.picker;
  const chip = (k, v, l) => `<button class="chip ${p[k] === v ? "on" : ""}" data-act="pickFilter" data-k="${k}" data-v="${v}">${l}</button>`;
  return `<div class="row between"><h3>${p.mode === "library" ? "Oefeningen" : "Kies oefening"}</h3><button class="icon-btn" data-act="closeSheet">${ICON.close}</button></div>
    <input type="search" id="pickQ" placeholder="Zoek, bijv. squat, curl, row" value="${esc(p.q)}" style="margin:8px 0">
    <div class="chips scroll">${chip("muscle", "", "Alle spieren")}${Object.entries(MUSCLES).map(([k, l]) => chip("muscle", k, l)).join("")}</div>
    <div class="chips scroll">${chip("eq", "", "Alle materiaal")}${chip("eq", "zonder", "Zonder gewicht")}${Object.entries(EQUIPMENT).filter(([k]) => k !== "bodyweight").map(([k, l]) => chip("eq", k, l)).join("")}</div>
    <div class="chips scroll" style="margin-bottom:6px">${chip("cat", "", "Alle soorten")}${Object.entries(CATEGORIES).map(([k, l]) => chip("cat", k, l)).join("")}</div>
    <div id="pickList">${pickListHtml()}</div>
    <hr><h3>Eigen oefening</h3>
    <input type="text" id="cName" placeholder="Naam, bijv. Hack squat" value="${esc(p.q)}">
    <div class="row" style="margin-top:8px"><select id="cMuscle">${Object.entries(MUSCLES).map(([k, l]) => `<option value="${k}" ${p.muscle === k ? "selected" : ""}>${l}</option>`).join("")}</select><select id="cEq">${Object.entries(EQUIPMENT).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
    <label class="row small" style="margin-top:8px"><input type="checkbox" id="cTimed"> Op tijd (seconden i.p.v. reps)</label>
    <button class="btn block" style="margin-top:10px" data-act="addCustom">Toevoegen</button>`;
}
function thumb(id) {
  const img = howto(id).imgs[0];
  return img ? `<img class="thumb" src="${img}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="thumb ph">${esc(exName(id)[0] || "?")}</span>`;
}

// Uitleg + jouw gewichten voor één oefening
function exInfoHtml(id) {
  const ex = exById(id);
  const { imgs, cues } = howto(id);
  const hist = S.workouts.map((w) => ({ t: w.start, sets: (w.exercises.find((x) => x.exId === id)?.sets || []).filter(isWork) })).filter((h) => h.sets.length);
  const all = hist.flatMap((h) => h.sets);
  const timed = ex?.timed;
  const best = all.length ? (timed
    ? `${Math.max(...all.map((s) => num(s.secs)))} sec`
    : (() => { const b = all.reduce((a, s) => (num(s.w) > num(a.w) || (num(s.w) === num(a.w) && num(s.r) > num(a.r)) ? s : a)); return num(b.w) ? `${b.w} kg × ${b.r}` : `${b.r} reps`; })()) : null;
  const targets = S.routines.flatMap((r) => r.exercises.filter((x) => x.exId === id && x.weight).map((x) => ({ r: r.name, w: x.weight, reps: `${x.repsMin}-${x.repsMax}` })));
  const fmtSets = (sets) => sets.map((s) => (timed ? `${s.secs}s` : num(s.w) ? `${s.w}×${s.r}` : `${s.r} reps`)).join(", ");
  const tab = U.infoTab || "uitleg";
  const body = tab === "uitleg"
    ? `${imgs.length ? `<div class="anim"><img src="${imgs[0]}" alt="Startpositie"><img class="b" src="${imgs[1]}" alt="Eindpositie"></div>` : ""}
      ${cues.length ? `${howto(id).en ? `<p class="small muted">Uitleg (Engels)</p>` : ""}<ol class="cues">${cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>` : `<p class="small muted">Nog geen uitleg voor deze oefening. Bekijk de video.</p>`}
      <a class="btn block" href="${videoUrl(ex?.name || "")}" target="_blank" rel="noopener">▶︎ Video</a>`
    : `${targets.map((t) => `<div class="list-item"><span class="grow">Doel in ${esc(t.r)}</span><b>${t.w} kg × ${t.reps}</b></div>`).join("")}
      ${hist.length ? `<div class="list-item"><span class="grow">Beste set</span><b>${best}</b></div><div class="list-item"><span class="grow">Aantal keer gedaan</span><b>${hist.length}</b></div>
        <p class="small muted" style="margin-top:8px">Laatste keren</p>${hist.slice(-5).reverse().map((h) => `<div class="list-item small"><span class="muted" style="min-width:90px">${fmtDate(h.t)}</span><span class="grow">${fmtSets(h.sets)}</span></div>`).join("")}`
        : `<p class="small muted">Nog niet gedaan. Na je eerste training onthoudt de app je gewichten.</p>`}`;
  return `${U.backHtml ? `<button class="btn ghost sm" data-act="infoBack">← Terug</button>` : ""}
    <div class="row between"><div><h3 style="margin:0">${esc(ex?.name || "Oefening")}</h3><div class="small muted">${esc(MUSCLES[ex?.muscle] || "")} · ${esc(EQUIPMENT[ex?.eq] || "")}${ex?.avoid?.length ? ` · let op bij ${ex.avoid.join(", ")}` : ""}</div></div><button class="icon-btn" data-act="closeSheet">${ICON.close}</button></div>
    <div class="seg"><button class="${tab === "uitleg" ? "on" : ""}" data-act="infoTab" data-v="uitleg" data-id="${id}">Uitleg</button><button class="${tab === "gewichten" ? "on" : ""}" data-act="infoTab" data-v="gewichten" data-id="${id}">Mijn gewichten</button></div>
    ${body}`;
}

// Uitleg die openklapt in de trainingskaart
function inlineInfo(id) {
  const ex = exById(id);
  const { imgs, cues } = howto(id);
  return `<div class="inline-info">
    ${imgs.length ? `<div class="anim small"><img src="${imgs[0]}" alt="Startpositie"><img class="b" src="${imgs[1]}" alt="Eindpositie"></div>` : ""}
    ${cues.length ? `<ol class="cues">${cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>` : `<p class="small muted">Nog geen uitleg. Bekijk de video.</p>`}
    <div class="row"><a class="btn sm grow" href="${videoUrl(ex?.name || "")}" target="_blank" rel="noopener">▶︎ Video</a><button class="btn sm grow" data-act="exInfo" data-id="${id}" data-tab="gewichten">Mijn gewichten</button></div>
  </div>`;
}

function openPicker(mode) { U.picker = { mode, q: "", muscle: "", eq: "", cat: "", limit: 80 }; showSheet(pickerHtml()); }
function refreshPicker() {
  const q = $("#pickQ"); const pos = q?.selectionStart;
  showSheet(pickerHtml());
  const nq = $("#pickQ"); if (nq && document.activeElement !== nq && pos != null && U.picker._typing) { nq.focus(); nq.setSelectionRange(pos, pos); }
}
function onPicked(id) {
  const mode = U.picker.mode;
  closeSheet();
  const ex = exById(id);
  const plan = { sets: 3, repsMin: ex?.kind === "compound" ? 8 : 10, repsMax: ex?.kind === "compound" ? 12 : 15, rest: ex?.kind === "compound" ? 120 : 75, secs: ex?.timed ? 30 : undefined };
  if (mode === "active") { S.active.exercises.push(newActiveEx(id, plan)); save(); renderOverlay(); setTimeout(() => ($("#overlay").scrollTop = 1e6), 30); }
  if (mode === "edit") { U.edit.exercises.push({ exId: id, ...plan }); renderOverlay(); setTimeout(() => ($("#overlay").scrollTop = 1e6), 30); }
}

function previewSheet(routines, title, opts = {}) {
  U.preview = routines; U.previewTemp = !!opts.temp; U.previewFrom = opts.from || null;
  showSheet(`<div class="row between"><h3>${esc(title)}</h3><button class="icon-btn" data-act="closeSheet">${ICON.close}</button></div>
    ${opts.changes ? `<div class="card" style="margin:8px 0">${opts.changes.map((c) => `<p class="small">• ${esc(c)}</p>`).join("")}</div>` : ""}
    ${routines.map((r) => `<div class="card"><b>${esc(r.name)}</b>${r.note ? `<p class="small muted">${esc(r.note)}</p>` : ""}
      ${r.exercises.map((x) => `<div class="list-item small" data-act="exInfo" data-id="${x.exId}">${thumb(x.exId)}<span class="grow">${esc(exName(x.exId))} <span class="info">ⓘ</span></span><span class="muted">${r.type === "circuit" ? `${r.work}s` : x.secs ? `${x.sets}×${x.secs}s` : `${x.sets}×${x.repsMin}-${x.repsMax}${x.weight ? ` · ${x.weight}kg` : ""}`}</span></div>`).join("")}</div>`).join("")}
    <div class="row" style="margin-top:14px">
      ${routines.length === 1 ? `<button class="btn primary grow" data-act="previewStart">Start nu</button>` : ""}
      <button class="btn ${routines.length === 1 ? "" : "primary"} grow" data-act="previewSave" data-replace="${opts.replace ? 1 : 0}">${opts.replace ? "Vervang mijn coach-schema's" : opts.temp ? "Bewaar als schema" : "Opslaan"}</button></div>
    ${opts.temp ? `<p class="small muted" style="margin-top:8px">Start nu = alleen voor vandaag; je eigen schema blijft hetzelfde.</p>` : ""}
    ${opts.replace ? `<button class="btn ghost block" data-act="previewSave" data-replace="0">Toevoegen naast bestaande</button>` : ""}`);
}

function hotelHtml() {
  const o = U.hotel;
  const chip = (k, v, l) => `<button class="chip ${o[k] === v ? "on" : ""}" data-act="hotelOpt" data-k="${k}" data-v="${v}">${l}</button>`;
  return `<div class="row between"><h3>Hotelkamer-training</h3><button class="icon-btn" data-act="closeSheet">${ICON.close}</button></div>
    <p class="small muted">Full body in supersets, met een korte finisher. Geen stang of apparaten nodig.</p>
    <p class="small muted" style="margin-top:12px">Tijd</p><div class="chips">${chip("minutes", 20, "20 min")}${chip("minutes", 30, "30 min")}${chip("minutes", 45, "45 min")}</div>
    <p class="small muted" style="margin-top:12px">Wat heb je?</p><div class="chips">${chip("mode", "bodyweight", "Geen spullen")}${chip("mode", "dumbbell", "Hotelgym met dumbbells")}</div>
    <button class="btn primary block" style="margin-top:16px" data-act="hotelGen">Maak training</button>`;
}

function adjustSheet(routineId, step = "main") {
  const r = S.routines.find((x) => x.id === routineId);
  if (!r) return;
  U.adjust = routineId;
  if (step === "tijd") return showSheet(`<h3>Hoeveel tijd heb je?</h3><div class="chips" style="margin-top:10px">${[15, 20, 30, 45].map((m) => `<button class="chip" data-act="doAdjust" data-k="tijd" data-v="${m}">${m} min</button>`).join("")}</div>`);
  if (step === "hotel") return showSheet(`<h3>Wat heb je in het hotel?</h3><div class="stack" style="margin-top:10px">
      <button class="btn block" data-act="doAdjust" data-k="hotel" data-v="bodyweight">🛏 Alleen mijn kamer (geen spullen)</button>
      <button class="btn block" data-act="doAdjust" data-k="hotel" data-v="dumbbell">🏋️ Hotelgym met dumbbells</button></div>`);
  if (step === "blessure") return showSheet(`<h3>Wat wil je ontzien?</h3><div class="chips" style="margin-top:10px">${INJURIES.map((i) => `<button class="chip" data-act="doAdjust" data-k="blessure" data-v="${i}">${i[0].toUpperCase() + i.slice(1)}</button>`).join("")}</div>`);
  showSheet(`<div class="row between"><h3>Bijsturen: ${esc(r.name)}</h3><button class="icon-btn" data-act="closeSheet">${ICON.close}</button></div><p class="small muted">Hoe gaat het vandaag?</p>
    <div class="stack" style="margin-top:10px">
      <button class="btn block" data-act="adjStep" data-step="tijd">⏱ Ik heb weinig tijd</button>
      <button class="btn block" data-act="doAdjust" data-k="moe">😴 Ik ben moe / slecht geslapen</button>
      <button class="btn block" data-act="adjStep" data-step="hotel">🏨 Ik zit in een hotel</button>
      <button class="btn block" data-act="adjStep" data-step="blessure">🩹 Iets doet pijn</button>
      <button class="btn block" data-act="doAdjust" data-k="zwaar">😮‍💨 Vorige keer was te zwaar</button>
      <button class="btn block" data-act="doAdjust" data-k="makkelijk">💪 Het is te makkelijk</button>
    </div>${S.settings.apiKey ? `<button class="btn ghost block" style="margin-top:8px" data-act="adjAi">Iets anders? Vraag de AI-coach</button>` : ""}`);
}

// ---------- Events ----------
const ACT = {
  tab: (d) => { S.tab = d.tab; save(); closeSheet(); render(); window.scrollTo(0, 0); },
  startRoutine: (d) => { const r = S.routines.find((x) => x.id === d.id); if (!r) return; unlockAudio(); if (r.type === "circuit") return startCircuit(r); startWorkout(makeActiveFromRoutine(r)); U.showActive = true; renderOverlay(); },
  startEmpty: () => { unlockAudio(); startWorkout({ id: uid(), routineId: null, name: "Workout", start: Date.now(), exercises: [] }); U.showActive = true; renderOverlay(); },
  hotelOpen: () => { U.hotel = U.hotel || { minutes: 30, mode: "bodyweight" }; showSheet(hotelHtml()); },
  hotelOpt: (d) => { U.hotel[d.k] = d.k === "minutes" ? +d.v : d.v; $("#sheet .panel").innerHTML = '<div class="grab"></div>' + hotelHtml(); },
  hotelGen: () => { const r = generateHotel(S.profile, U.hotel, S.customExercises); previewSheet([r], r.name, { temp: true }); },
  quickCircuit: () => { const r = generateCircuit(S.profile, { minutes: 20 }, S.customExercises); previewSheet([r], "Circuit van 20 minuten"); },
  openActive: () => { U.showActive = true; renderOverlay(); },
  minimize: () => { U.showActive = false; render(); },
  toggleSet: (d) => {
    const ex = S.active.exercises, e = ex[d.ei], s = e.sets[d.si];
    s.done = !s.done;
    if (s.done) {
      if (exById(e.exId)?.timed) { if (s.secs === "") s.secs = s.ps; }
      else {
        if (s.w === "") s.w = s.pw; if (s.r === "") s.r = s.pr;
        // volgende werksets nemen dit gewicht over als suggestie (opwarmsets niet)
        if (s.type !== "w") e.sets.slice(+d.si + 1).forEach((n) => { if (!n.done && n.w === "" && n.type !== "w") n.pw = s.w; });
      }
      // Superset: pas rust na de laatste oefening van de groep
      const nextInSs = e.ss && ex[+d.ei + 1]?.ss === e.ss ? ex[+d.ei + 1] : null;
      if (nextInSs) { U.rest = null; toast(`Superset: nu ${exName(nextInSs.exId)}`); }
      else {
        const rest = s.type === "w" ? Math.min(60, e.plan.rest || 60) : e.plan.rest;
        if (rest) { U.rest = { end: Date.now() + rest * 1000, total: rest }; unlockAudio(); }
      }
    }
    save(); renderOverlay();
  },
  addSet: (d) => { const e = S.active.exercises[d.ei]; const last = e.sets.at(-1) || {}; e.sets.push({ w: "", r: "", secs: "", done: false, pw: last.w || last.pw || "", pr: last.r || last.pr || "", ps: last.secs || last.ps || "" }); save(); renderOverlay(); },
  setMenu: (d) => {
    const s = S.active.exercises[d.ei].sets[d.si];
    const opt = (t, label, sub) => `<button class="btn block ${(s.type || "") === t ? "primary" : ""}" data-act="setType" data-ei="${d.ei}" data-si="${d.si}" data-t="${t}" style="justify-content:flex-start"><b style="width:22px">${t ? SET_TYPES[t][0] : "#"}</b> ${label}<span class="small muted" style="margin-left:auto">${sub}</span></button>`;
    showSheet(`<h3>Soort set</h3><div class="stack" style="margin-top:10px">
      ${opt("", "Normale set", "telt mee")}
      ${opt("w", "Opwarmen", "telt niet mee voor records")}
      ${opt("d", "Drop set", "lichter direct erna")}
      ${opt("f", "Tot falen", "tot je niet meer kunt")}
      <button class="btn danger block" data-act="setDel" data-ei="${d.ei}" data-si="${d.si}">Set verwijderen</button></div>`);
  },
  setType: (d) => { const s = S.active.exercises[d.ei].sets[d.si]; if (d.t) s.type = d.t; else delete s.type; closeSheet(); save(); renderOverlay(); },
  setDel: (d) => { S.active.exercises[d.ei].sets.splice(d.si, 1); closeSheet(); save(); renderOverlay(); },
  addWarmups: (d) => {
    const e = S.active.exercises[d.ei], ex = exById(e.exId);
    const first = e.sets.find((s) => s.type !== "w");
    const work = num(first?.w || first?.pw || e.plan.weight);
    if (!work) return toast("Vul eerst je werkgewicht in bij set 1");
    const sets = warmupSets(work, ex);
    if (!sets.length) return toast("Gewicht is te licht voor opwarmsets");
    e.sets.unshift(...sets.map(([w, r]) => ({ w: "", r: "", secs: "", done: false, type: "w", pw: w, pr: r, ps: "" })));
    save(); renderOverlay(); toast(`${sets.length} opwarmsets toegevoegd`);
  },
  plates: (d) => {
    const e = S.active.exercises[d.ei];
    const first = e.sets.find((s) => !s.done && s.type !== "w") || e.sets.find((s) => s.type !== "w");
    U.plateW = num(first?.w || first?.pw || e.plan.weight) || 60;
    U.plateLeg = e.exId === "leg_press";
    showSheet(platesHtml());
  },
  plateSet: (d) => { if (d.k === "bar") { S.settings.bar = +d.v; save(); } else U.plateW = Math.max(0, U.plateW + +d.v); $("#sheet .panel").innerHTML = '<div class="grab"></div>' + platesHtml(); },
  exMenu: (d) => {
    const a = S.active.exercises, e = a[d.ei];
    const linked = e.ss && (a[+d.ei + 1]?.ss === e.ss || a[+d.ei - 1]?.ss === e.ss);
    showSheet(`<h3>${esc(exName(e.exId))}</h3><div class="stack" style="margin-top:10px">
      ${linked ? `<button class="btn block" data-act="ssUnlink" data-ei="${d.ei}">🔗 Superset opheffen</button>` : a[+d.ei + 1] ? `<button class="btn block" data-act="ssLink" data-ei="${d.ei}">🔗 Superset met ${esc(exName(a[+d.ei + 1].exId))}</button>` : ""}
      <button class="btn block" data-act="exSwap" data-ei="${d.ei}">Vervangen</button>
      <button class="btn block" data-act="exMove" data-ei="${d.ei}" data-d="-1">Omhoog</button><button class="btn block" data-act="exMove" data-ei="${d.ei}" data-d="1">Omlaag</button>
      <button class="btn danger block" data-act="exDel" data-ei="${d.ei}">Verwijderen</button></div>`);
  },
  ssLink: (d) => { linkSuperset(S.active.exercises, +d.ei); closeSheet(); save(); renderOverlay(); },
  ssUnlink: (d) => { unlinkSuperset(S.active.exercises, +d.ei); closeSheet(); save(); renderOverlay(); },
  exDel: (d) => { S.active.exercises.splice(d.ei, 1); closeSheet(); save(); renderOverlay(); },
  exMove: (d) => { const a = S.active.exercises, i = +d.ei, j = i + +d.d; if (j >= 0 && j < a.length) [a[i], a[j]] = [a[j], a[i]]; closeSheet(); save(); renderOverlay(); },
  exSwap: (d) => { U.swapIdx = +d.ei; openPicker("swap"); },
  restAdd: (d) => { if (U.rest) { U.rest.end += +d.s * 1000; U.rest.total = Math.max(U.rest.total + +d.s, 1); renderRest(); } },
  restSkip: () => { U.rest = null; renderRest(); },
  finish: () => finishWorkout(),
  discard: () => { if (confirm("Training annuleren? Niets wordt opgeslagen.")) { S.active = null; U.showActive = false; U.rest = null; save(); render(); } },
  pickExercise: (d) => openPicker(d.mode),
  pickMuscle: (d) => { U.picker.muscle = d.v; refreshPicker(); },
  pickFilter: (d) => { U.picker[d.k] = U.picker[d.k] === d.v && d.v ? "" : d.v; U.picker.limit = 80; const y = $("#sheet .panel").scrollTop; refreshPicker(); $("#sheet .panel").scrollTop = y; },
  pickMore: () => { U.picker.limit += 120; $("#pickList").innerHTML = pickListHtml(); },
  pickIt: (d) => {
    if (U.picker.mode === "swap") {
      const old = S.active.exercises[U.swapIdx];
      S.active.exercises[U.swapIdx] = newActiveEx(d.id, old.plan); closeSheet(); save(); renderOverlay(); return;
    }
    onPicked(d.id);
  },
  addCustom: () => {
    const name = $("#cName").value.trim(); if (!name) return toast("Geef de oefening een naam");
    const id = "c_" + uid();
    S.customExercises.push({ id, name, muscle: $("#cMuscle").value, eq: $("#cEq").value, kind: "compound", avoid: [], timed: $("#cTimed").checked });
    save(); toast(`${name} toegevoegd`);
    if (U.picker.mode === "library") { U.picker.q = ""; refreshPicker(); } else ACT.pickIt({ id });
  },
  delCustom: (d) => { if (confirm("Eigen oefening verwijderen?")) { S.customExercises = S.customExercises.filter((e) => e.id !== d.id); save(); refreshPicker(); } },
  openLibrary: () => openPicker("library"),
  exToggle: (d) => { const e = S.active.exercises[d.ei]; e._open = !e._open; save(); renderOverlay(); },
  infoTab: (d) => { U.infoTab = d.v; $("#sheet .panel").innerHTML = '<div class="grab"></div>' + exInfoHtml(d.id); },
  exInfo: (d) => {
    U.infoTab = d.tab || "uitleg";
    const open = !$("#sheet").hidden;
    U.backHtml = open ? $("#sheet .panel").innerHTML : null;
    const s = $("#sheet"); s.innerHTML = `<div class="panel"><div class="grab"></div>${exInfoHtml(d.id)}</div>`; s.hidden = false;
    $("#sheet .panel").scrollTop = 0;
  },
  infoBack: () => { const h = U.backHtml; U.backHtml = null; if (h) $("#sheet .panel").innerHTML = h; },
  mWeek: (d) => { U.mWeek = +d.v; render(); },
  toggleAuto: () => { S.settings.autoWeights = S.settings.autoWeights === false; save(); render(); },
  closeSheet: () => closeSheet(),
  showWorkout: (d) => {
    const w = S.workouts.find((x) => x.id === d.id); if (!w) return;
    showSheet(`<div class="row between"><h3>${esc(w.name)}</h3><button class="icon-btn" data-act="closeSheet">${ICON.close}</button></div><p class="small muted">${fmtDate(w.start)} · ${fmtDur(w.end - w.start)}${w.feeling ? ` · ${w.feeling}` : ""}</p>
      ${w.exercises.map((e) => `<div class="card"><b>${esc(exName(e.exId))}</b>${e.sets.map((s, i) => `<div class="small muted">${s.type ? SET_TYPES[s.type][1] : `Set ${i + 1}`}: ${s.secs ? `${s.secs}s` : `${s.w || 0} kg × ${s.r}`}</div>`).join("")}</div>`).join("")}
      <button class="btn danger block" style="margin-top:14px" data-act="delWorkout" data-id="${w.id}">Workout verwijderen</button>`);
  },
  delWorkout: (d) => { if (confirm("Deze workout verwijderen?")) { S.workouts = S.workouts.filter((w) => w.id !== d.id); save(); closeSheet(); render(); } },
  // Schema's
  newRoutine: () => { U.edit = { id: uid(), name: "Nieuw schema", type: "strength", note: "", rounds: 3, work: 40, restBetween: 20, roundRest: 60, exercises: [], _new: true }; renderOverlay(); },
  editRoutine: (d) => { const r = S.routines.find((x) => x.id === d.id); U.edit = { rounds: 3, work: 40, restBetween: 20, roundRest: 60, ...structuredClone(r) }; renderOverlay(); },
  editType: (d) => { U.edit.type = d.v; renderOverlay(); },
  edMove: (d) => { const a = U.edit.exercises, i = +d.i, j = i + +d.d; if (j >= 0 && j < a.length) [a[i], a[j]] = [a[j], a[i]]; renderOverlay(); },
  edLink: (d) => { const l = U.edit.exercises, i = +d.i; if (l[i].ss && l[i + 1]?.ss === l[i].ss) { const id = l[i].ss; l.slice(i + 1).forEach((x) => { if (x.ss === id) delete x.ss; }); if (!l.some((x, j) => j !== i && x.ss === id)) delete l[i].ss; } else linkSuperset(l, i); renderOverlay(); },
  edDel: (d) => { U.edit.exercises.splice(+d.i, 1); renderOverlay(); },
  editCancel: () => { U.edit = null; renderOverlay(); },
  editSave: () => {
    const r = U.edit; delete r._new;
    if (!r.exercises.length) return toast("Voeg minstens één oefening toe");
    const i = S.routines.findIndex((x) => x.id === r.id);
    if (i >= 0) S.routines[i] = r; else S.routines.push(r);
    U.edit = null; save(); render(); toast("Schema opgeslagen");
  },
  editDelete: () => { if (confirm("Schema verwijderen?")) { S.routines = S.routines.filter((x) => x.id !== U.edit.id); U.edit = null; save(); render(); } },
  // Coach
  toggleCirc: () => { U.showCirc = !U.showCirc; render(); },
  coachMode: (d) => { U.coachMode = d.mode; render(); },
  circOpt: (d) => { U.circuitOpts[d.k] = isNaN(+d.v) ? d.v : +d.v; render(); },
  genPlan: () => {
    const plan = generatePlan(S.profile, S.customExercises);
    previewSheet(plan, `Jouw schema: ${plan.length} trainingen`, { replace: S.routines.some((r) => r.source === "coach" && r.type !== "circuit") });
  },
  genCircuit: () => { const r = generateCircuit(S.profile, U.circuitOpts, S.customExercises); previewSheet([r], r.name); },
  previewSave: (d) => {
    if (+d.replace) S.routines = S.routines.filter((r) => !(r.source === "coach" && r.type !== "circuit"));
    S.routines.push(...U.preview); if (+d.replace) S.nextIdx = 0;
    save(); closeSheet(); toast("Opgeslagen bij Schema's"); render();
  },
  previewStart: () => {
    const r = U.preview[0];
    if (U.previewTemp && r.type !== "circuit") {
      // alleen voor vandaag: niet opslaan als schema, wel meetellen in je rotatie
      const a = makeActiveFromRoutine(r); a.routineId = null; a.countsAs = U.previewFrom;
      closeSheet(); unlockAudio(); startWorkout(a); U.showActive = true; render(); return;
    }
    S.routines.push(r); save(); closeSheet(); ACT.startRoutine({ id: r.id }); render();
  },
  adjustOpen: (d) => adjustSheet(d.id),
  adjStep: (d) => adjustSheet(U.adjust, d.step),
  doAdjust: (d) => {
    const r = S.routines.find((x) => x.id === U.adjust);
    const { routine, changes } = d.k === "hotel"
      ? hotelRoutine(r, d.v, S.profile, S.customExercises)
      : adjustRoutine(r, d.k, d.v, S.profile, S.customExercises);
    previewSheet([routine], d.k === "hotel" ? "Hotelversie voor vandaag" : "Aangepast voor vandaag", { changes, temp: true, from: r.id });
  },
  adjAi: () => { closeSheet(); U.coachMode = "chat"; S.tab = "coach"; render(); setTimeout(() => $("#chatInput")?.focus(), 50); },
  chatSend: () => { const t = $("#chatInput").value; sendChat(t); },
  chatQuick: (d) => sendChat(d.q),
  chatClear: () => { if (confirm("Gesprek wissen?")) { S.chat = []; save(); render(); } },
  saveAiRoutines: (d) => {
    const m = S.chat[+d.i]; if (!m?.routines || m.saved) return;
    S.routines.push(...m.routines.map((r) => normalizeRoutine(r, "ai")));
    m.saved = true; save(); render(); toast("Opgeslagen bij Schema's");
  },
  // Circuit
  circPause: () => { const c = U.circuit; if (c.paused) { c.end = Date.now() + c.pausedLeft; c.paused = false; } else { c.pausedLeft = c.end - Date.now(); c.paused = true; } renderOverlay(); },
  circSkip: () => advanceCircuit(),
  stopCircuit: () => { if (confirm("Circuit stoppen? Wat je gedaan hebt wordt opgeslagen.")) { finishCircuit(); U.circuit = null; keepAwake(false); render(); } },
  closeCircuit: () => { U.circuit = null; render(); },
  // Profiel
  profToggle: (d) => { const a = S.profile[d.k]; const i = a.indexOf(d.v); i >= 0 ? a.splice(i, 1) : a.push(d.v); save(); render(); },
  profSet: (d) => { S.profile[d.k] = d.k === "days" ? +d.v : d.v; save(); render(); },
  profileDone: () => { S.profile.done = true; save(); S.tab = "coach"; U.coachMode = "quick"; render(); window.scrollTo(0, 0); ACT.genPlan(); },
  clearKey: () => { if (confirm("API-sleutel verwijderen?")) { S.settings.apiKey = ""; save(); render(); } },
  exportData: async () => {
    const data = JSON.stringify({ ...S, settings: { apiKey: "" }, active: null }, null, 1);
    const name = `forge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([data], name, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: "Forge back-up" }); return; } catch (e) { if (e.name === "AbortError") return; } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; a.click();
  },
  resetAll: () => { if (confirm("Echt ALLES wissen? Workouts, schema's en profiel. Dit kan niet ongedaan worden.")) { localStorage.removeItem(KEY); location.reload(); } },
};

document.addEventListener("click", (ev) => {
  const feel = ev.target.closest("[data-feel]");
  if (feel && U.feelResolve) { const f = U.feelResolve; U.feelResolve = null; return f(feel.dataset.feel); }
  const t = ev.target.closest("[data-act]");
  if (t) { ev.preventDefault(); ACT[t.dataset.act]?.(t.dataset); return; }
  const tab = ev.target.closest("#tabs button");
  if (tab) ACT.tab({ tab: tab.dataset.tab });
  if (ev.target.id === "sheet") { if (U.feelResolve) { const f = U.feelResolve; U.feelResolve = null; f("__cancel"); } else closeSheet(); }
});

document.addEventListener("input", (ev) => {
  const el = ev.target;
  if (el.dataset.set) { const [ei, si, k] = el.dataset.set.split("."); S.active.exercises[ei].sets[si][k] = el.value; save(); return; }
  if (el.dataset.edit) { U.edit[el.dataset.edit] = el.type === "number" ? +el.value : el.value; return; }
  if (el.dataset.edx) { const [i, k] = el.dataset.edx.split("."); U.edit.exercises[i][k] = +el.value; return; }
  if (el.dataset.bind) {
    const [o, k] = el.dataset.bind.split(".");
    S[o][k] = el.type === "range" ? +el.value : el.value;
    if (k === "minutes") $("#minLbl").textContent = el.value + " min";
    save(); return;
  }
  if (el.id === "pickQ") { U.picker.q = el.value; U.picker.limit = 80; $("#pickList").innerHTML = pickListHtml(); return; }
  if (el.id === "chatInput") { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 140) + "px"; }
});

document.addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.id === "progEx") { U.progEx = el.value; render(); }
  if (el.dataset.bind === "settings.apiKey") { render(); if (el.value) toast("Sleutel opgeslagen — de AI-chat staat aan"); }
  if (el.id === "importFile" && el.files[0]) {
    el.files[0].text().then((txt) => {
      try {
        const data = JSON.parse(txt);
        if (!Array.isArray(data.workouts) || !Array.isArray(data.routines)) throw new Error();
        if (!confirm(`Back-up met ${data.workouts.length} workouts en ${data.routines.length} schema's terugzetten? Huidige gegevens worden vervangen.`)) return;
        const key = S.settings.apiKey;
        S = { ...structuredClone(DEFAULT), ...data, settings: { apiKey: key }, active: null };
        saveNow(); render(); toast("Back-up teruggezet");
      } catch { toast("Dit is geen geldig Forge back-upbestand"); }
    });
  }
});

document.addEventListener("keydown", (ev) => {
  if (ev.target.id === "chatInput" && ev.key === "Enter" && !ev.shiftKey && !("ontouchstart" in window)) { ev.preventDefault(); ACT.chatSend(); }
});

// Bij terugkomen in de app: rust-timer klopt nog (op tijdstempels gebaseerd)
document.addEventListener("visibilitychange", () => { if (!document.hidden) { renderOverlay(); if (U.circuit && wakeLock === null) keepAwake(true); } });

if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});

if (S.active) U.showActive = false;
render();
loadExtra();
