// AI-coach via de Claude API (je eigen API-sleutel, alleen op jouw telefoon opgeslagen).
import { EXERCISES, MUSCLES } from "./data.js";

const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.8.0/+esm";
let sdkPromise = null;
const loadSdk = () => (sdkPromise ||= import(SDK_URL).then((m) => m.default || m.Anthropic));

function summarizeWorkouts(state, exName) {
  return state.workouts.slice(-12).map((w) => {
    const d = new Date(w.start).toISOString().slice(0, 10);
    const exs = w.exercises.map((e) => {
      const sets = e.sets.filter((s) => s.done).map((s) => (s.secs ? `${s.secs}s` : `${s.w || 0}x${s.r || 0}`) + (s.type ? `(${({ w: "opwarm", d: "drop", f: "falen" })[s.type]})` : "")).join(", ");
      return `${exName(e.exId)}: ${sets || "-"}`;
    }).join("; ");
    return `- ${d} ${w.name}${w.feeling ? ` (gevoel: ${w.feeling})` : ""}: ${exs}`;
  }).join("\n") || "(nog geen workouts gelogd)";
}

function summarizeRoutines(state, exName) {
  return state.routines.map((r) => {
    const exs = r.exercises.map((x) => `${exName(x.exId)} [${x.exId}] ${r.type === "circuit" ? "" : x.secs ? `${x.sets}x${x.secs}s` : `${x.sets}x${x.repsMin}-${x.repsMax}${x.weight ? ` @ ${x.weight}kg` : ""}`}`).join("; ");
    return `- "${r.name}" (${r.type}${r.type === "circuit" ? `, ${r.rounds} rondes ${r.work}/${r.restBetween}s` : ""}): ${exs}`;
  }).join("\n") || "(nog geen schema's)";
}

export function buildSystem(state, exName) {
  const p = state.profile;
  const lib = [...EXERCISES, ...state.customExercises]
    .map((e) => `${e.id} = ${e.name} (${MUSCLES[e.muscle] || e.muscle}, ${e.eq}${e.timed ? ", op tijd" : ""})`).join("\n");
  return `Je bent een persoonlijke fitnesscoach in een gym-app. Je praat Nederlands, informeel (je/jij), kort en concreet, zoals een goede PT op de vloer. Geen lange lappen tekst: gebruik korte alinea's of opsommingen.

Wat je doet:
- Schema's en circuits maken die passen bij doel, niveau, beschikbare tijd, plek en blessures.
- Bijsturen als de gebruiker iets aangeeft (moe, weinig tijd, pijn, te makkelijk, geen progressie) en uitleggen waarom.
- Progressie bewaken op basis van de gelogde workouts (double progression: eerst reps omhoog, dan gewicht).
- Bij pijn: aanpassen en sparen, maar geen diagnose stellen; bij scherpe, aanhoudende of uitstralende pijn adviseer je een fysiotherapeut of huisarts.

Wanneer je een nieuw of aangepast schema voorstelt, zet het dan ook in precies één codeblok met taal "json" in dit formaat, zodat de app het kan opslaan:
\`\`\`json
{"routines":[
 {"name":"Upper A","type":"strength","note":"korte tip","exercises":[{"exId":"bench","sets":3,"repsMin":6,"repsMax":10,"rest":120,"weight":60},{"exId":"plank","sets":3,"secs":45,"rest":60}]},
 {"name":"Circuit 20 min","type":"circuit","rounds":3,"work":40,"restBetween":20,"roundRest":60,"exercises":[{"exId":"burpee"},{"exId":"bw_squat"}]}
]}
\`\`\`
"weight" is het doelgewicht in kg (laat weg als je het niet weet; de app past het daarna automatisch aan op basis van wat er gelogd wordt). Gebruik alleen exId's uit de bibliotheek hieronder. Bestaat een oefening niet, gebruik dan {"name":"Naam","muscle":"<een van: ${Object.keys(MUSCLES).join(", ")}>","eq":"bodyweight|dumbbell|barbell|machine|cable|kettlebell"} in plaats van exId. Zet geen codeblok als je geen schema voorstelt.

PROFIEL
- Doelen: ${(p.goals || []).join(", ") || "onbekend"}
- Niveau: ${p.level || "onbekend"}
- Trainingsdagen per week: ${p.days || "?"}, tijd per training: ${p.minutes || "?"} min
- Gewenste indeling: ${({ fullbody: "full body", voorachter: "voorkant/achterkant (anterior/posterior)", bovenonder: "boven/onder", ppl: "push/pull/legs" })[p.split] || "geen voorkeur (kies zelf)"}
- Plek: ${p.location === "gym" ? "sportschool (volledige apparatuur), soms zonder spullen" : p.location === "home" ? "thuis met dumbbells" : "zonder spullen"}
- Blessures/aandachtspunten: ${(p.injuries || []).join(", ") || "geen"}${p.notes ? `\n- Wensen: ${p.notes}` : ""}${p.bodyweight ? `\n- Lichaamsgewicht: ${p.bodyweight} kg` : ""}

HUIDIGE SCHEMA'S
${summarizeRoutines(state, exName)}

LAATSTE WORKOUTS
${summarizeWorkouts(state, exName)}

Vandaag is het ${new Date().toISOString().slice(0, 10)}.

OEFENINGEN-BIBLIOTHEEK (exId = naam)
${lib}`;
}

export async function askCoach({ apiKey, state, exName, onText }) {
  const Anthropic = await loadSdk();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  // Mislukte beurten (foutmelding + de vraag ervoor) niet meesturen
  const chat = state.chat.filter((m, i, a) => !m.error && !a[i + 1]?.error);
  const messages = chat.slice(-30).map((m) => ({ role: m.role, content: m.text }));
  try {
    const stream = client.beta.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: buildSystem(state, exName),
      messages,
    });
    let text = "";
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        text += event.delta.text;
        onText(text);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      return { text: text || "De coach kon hier geen antwoord op geven. Probeer het anders te formuleren.", error: true };
    }
    return { text };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { text: "Je API-sleutel klopt niet. Check hem bij Profiel → AI-coach.", error: true };
    if (err instanceof Anthropic.PermissionDeniedError) return { text: "Je API-sleutel heeft geen toegang. Check je account op console.anthropic.com.", error: true };
    if (err instanceof Anthropic.RateLimitError) return { text: "Even te veel verzoeken. Probeer het over een minuutje opnieuw.", error: true };
    if (err instanceof Anthropic.APIConnectionError) return { text: "Geen verbinding met de coach. Check je internet.", error: true };
    if (err instanceof Anthropic.APIError) {
      const msg = String(err.message || "");
      if (/credit|billing|balance/i.test(msg)) return { text: "Je API-tegoed is op. Waardeer op via console.anthropic.com → Billing.", error: true };
      return { text: `De coach gaf een fout (${err.status ?? "?"}). ${msg.slice(0, 200)}`, error: true };
    }
    return { text: `Er ging iets mis: ${err?.message || err}`, error: true };
  }
}

// Haal een voorgesteld schema uit het antwoord
export function extractRoutines(text) {
  const m = text.match(/```json\s*([\s\S]*?)```/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]);
    const list = Array.isArray(data) ? data : data.routines;
    return Array.isArray(list) && list.length ? list : null;
  } catch {
    return null;
  }
}
