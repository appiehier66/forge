// Oefeningen-bibliotheek
// eq: barbell | dumbbell | machine | cable | bodyweight | kettlebell
// kind: compound | isolation | cardio
// avoid: blessures waarbij deze oefening beter vermeden wordt
// cardio: true = je logt minuten en km in plaats van kg en reps (fiets, loopband, ...)
export const MUSCLES = {
  borst: "Borst", rug: "Rug", schouders: "Schouders", biceps: "Biceps",
  triceps: "Triceps", benen: "Benen", billen: "Billen", hamstrings: "Hamstrings",
  kuiten: "Kuiten", core: "Core", cardio: "Cardio", onderarmen: "Onderarmen", nek: "Nek", fullbody: "Full body",
};

export const EQUIPMENT = {
  barbell: "Barbell", dumbbell: "Dumbbell", machine: "Machine",
  cable: "Kabel", bodyweight: "Lichaamsgewicht", kettlebell: "Kettlebell",
  band: "Elastiek", bal: "Bal", foamroller: "Foamroller", overig: "Overig",
};

export const CATEGORIES = {
  kracht: "Kracht", explosief: "Explosief", cardio: "Cardio", stretching: "Stretching", olympisch: "Olympisch", strongman: "Strongman",
};

const E = (id, name, muscle, eq, kind, avoid = [], timed = false) =>
  ({ id, name, muscle, eq, kind, avoid, timed });
const C = (id, name, eq, avoid = []) =>
  ({ id, name, muscle: "cardio", eq, kind: "cardio", avoid, timed: false, cardio: true });

export const EXERCISES = [
  // Borst
  E("bench", "Bench press", "borst", "barbell", "compound", ["schouder", "pols"]),
  E("incline_db", "Incline dumbbell press", "borst", "dumbbell", "compound", ["schouder"]),
  E("db_bench", "Dumbbell bench press", "borst", "dumbbell", "compound", ["schouder"]),
  E("chest_press", "Chest press machine", "borst", "machine", "compound"),
  E("cable_fly", "Cable fly", "borst", "cable", "isolation", ["schouder"]),
  E("pec_deck", "Pec deck", "borst", "machine", "isolation"),
  E("pushup", "Push-up", "borst", "bodyweight", "compound", ["pols"]),
  E("incline_pushup", "Incline push-up", "borst", "bodyweight", "compound"),
  E("decline_pushup", "Decline push-up (voeten op bed)", "borst", "bodyweight", "compound", ["schouder"]),
  E("dips", "Dips", "triceps", "bodyweight", "compound", ["schouder"]),
  // Rug
  E("barbell_row", "Barbell row", "rug", "barbell", "compound", ["rug"]),
  E("db_row", "Dumbbell row", "rug", "dumbbell", "compound"),
  E("lat_pulldown", "Lat pulldown", "rug", "cable", "compound"),
  E("seated_row", "Seated cable row", "rug", "cable", "compound"),
  E("pullup", "Pull-up", "rug", "bodyweight", "compound", ["schouder"]),
  E("chinup", "Chin-up", "rug", "bodyweight", "compound"),
  E("inverted_row", "Inverted row (tafel/stang)", "rug", "bodyweight", "compound"),
  E("deadlift", "Deadlift", "rug", "barbell", "compound", ["rug"]),
  E("superman", "Superman", "rug", "bodyweight", "isolation"),
  E("door_row", "Deur-row (handdoek om deurklink)", "rug", "bodyweight", "compound"),
  E("prone_y", "Liggende Y-raise", "rug", "bodyweight", "isolation"),
  E("face_pull", "Face pull", "schouders", "cable", "isolation"),
  // Schouders
  E("ohp", "Overhead press", "schouders", "barbell", "compound", ["schouder", "rug"]),
  E("db_shoulder", "Dumbbell shoulder press", "schouders", "dumbbell", "compound", ["schouder"]),
  E("lateral_raise", "Lateral raise", "schouders", "dumbbell", "isolation"),
  E("cable_lateral", "Cable lateral raise", "schouders", "cable", "isolation"),
  E("rear_delt", "Rear delt fly", "schouders", "dumbbell", "isolation"),
  E("pike_pushup", "Pike push-up", "schouders", "bodyweight", "compound", ["schouder", "pols"]),
  // Armen
  E("bb_curl", "Barbell curl", "biceps", "barbell", "isolation", ["pols"]),
  E("db_curl", "Dumbbell curl", "biceps", "dumbbell", "isolation"),
  E("hammer_curl", "Hammer curl", "biceps", "dumbbell", "isolation"),
  E("cable_curl", "Cable curl", "biceps", "cable", "isolation"),
  E("pushdown", "Triceps pushdown", "triceps", "cable", "isolation"),
  E("oh_ext", "Overhead triceps extension", "triceps", "cable", "isolation", ["schouder"]),
  E("skullcrusher", "Skull crusher", "triceps", "barbell", "isolation", ["pols"]),
  E("diamond_pushup", "Diamond push-up", "triceps", "bodyweight", "compound", ["pols"]),
  E("bench_dips", "Bench dips", "triceps", "bodyweight", "compound", ["schouder"]),
  // Benen
  E("squat", "Back squat", "benen", "barbell", "compound", ["knie", "rug"]),
  E("front_squat", "Front squat", "benen", "barbell", "compound", ["knie", "pols", "rug"]),
  E("leg_press", "Leg press", "benen", "machine", "compound", []),
  E("goblet_squat", "Goblet squat", "benen", "dumbbell", "compound", ["knie"]),
  E("lunge", "Walking lunge", "benen", "dumbbell", "compound", ["knie"]),
  E("bulgarian", "Bulgarian split squat", "benen", "dumbbell", "compound", ["knie"]),
  E("leg_ext", "Leg extension", "benen", "machine", "isolation", ["knie"]),
  E("bw_squat", "Bodyweight squat", "benen", "bodyweight", "compound", ["knie"]),
  E("split_squat_bw", "Split squat", "benen", "bodyweight", "compound", ["knie"]),
  E("bulgarian_bw", "Bulgarian split squat (voet op bed)", "benen", "bodyweight", "compound", ["knie"]),
  E("step_up", "Step-up", "benen", "bodyweight", "compound", ["knie"]),
  E("wall_sit", "Wall sit", "benen", "bodyweight", "isolation", [], true),
  // Hamstrings / billen
  E("rdl", "Romanian deadlift", "hamstrings", "barbell", "compound", ["rug"]),
  E("db_rdl", "Dumbbell RDL", "hamstrings", "dumbbell", "compound", ["rug"]),
  E("leg_curl", "Leg curl", "hamstrings", "machine", "isolation"),
  E("hip_thrust", "Hip thrust", "billen", "barbell", "compound"),
  E("glute_bridge", "Glute bridge", "billen", "bodyweight", "compound"),
  E("single_leg_bridge", "Single-leg glute bridge", "billen", "bodyweight", "compound"),
  E("nordic", "Nordic curl (negatief)", "hamstrings", "bodyweight", "isolation", ["knie"]),
  // Kuiten
  E("calf_raise", "Standing calf raise", "kuiten", "machine", "isolation"),
  E("bw_calf", "Calf raise (lichaamsgewicht)", "kuiten", "bodyweight", "isolation"),
  // Core
  E("plank", "Plank", "core", "bodyweight", "isolation", [], true),
  E("side_plank", "Side plank", "core", "bodyweight", "isolation", ["schouder"], true),
  E("hanging_raise", "Hanging leg raise", "core", "bodyweight", "isolation", ["schouder"]),
  E("cable_crunch", "Cable crunch", "core", "cable", "isolation", ["rug"]),
  E("dead_bug", "Dead bug", "core", "bodyweight", "isolation"),
  E("crunch", "Crunch", "core", "bodyweight", "isolation", ["rug"]),
  E("russian_twist", "Russian twist", "core", "bodyweight", "isolation", ["rug"]),
  E("mountain_climber", "Mountain climbers", "core", "bodyweight", "cardio", ["pols"], true),
  // Full body / conditie
  E("burpee", "Burpees", "fullbody", "bodyweight", "cardio", ["knie", "pols"]),
  E("jumping_jack", "Jumping jacks", "fullbody", "bodyweight", "cardio", ["knie"], true),
  E("high_knees", "High knees", "fullbody", "bodyweight", "cardio", ["knie"], true),
  E("squat_jump", "Squat jumps", "benen", "bodyweight", "cardio", ["knie"]),
  E("kb_swing", "Kettlebell swing", "fullbody", "kettlebell", "compound", ["rug"]),
  E("bear_crawl", "Bear crawl", "fullbody", "bodyweight", "cardio", ["pols"], true),
  // Cardio: minuten en km (nooit in krachtschema-slots of circuits)
  C("bike", "Fiets / hometrainer", "machine"),
  C("treadmill_run", "Loopband – hardlopen", "machine", ["knie"]),
  C("treadmill_walk", "Loopband – stevig wandelen", "machine"),
  C("rower", "Roeimachine", "machine", ["rug"]),
  C("crosstrainer", "Crosstrainer", "machine"),
  C("stairs", "Traploper", "machine", ["knie"]),
  C("run_outside", "Hardlopen buiten", "bodyweight", ["knie"]),
];

export const INJURIES = ["knie", "schouder", "rug", "pols"];
