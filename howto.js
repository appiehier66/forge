// Uitleg per oefening: foto's (2 standen, afgespeeld als animatie) + korte aanwijzingen.
// Foto's: free-exercise-db (Unlicense / publiek domein), vastgezet op één versie.
const IMG_BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/";

const H = {
  bench: ["Barbell_Bench_Press_-_Medium_Grip", "Schouderbladen naar achter en omlaag, voeten plat op de grond.", "Laat de stang gecontroleerd zakken naar je onderborst, ellebogen ca. 45° van je lichaam.", "Duw krachtig omhoog tot je armen gestrekt zijn."],
  incline_db: ["Incline_Dumbbell_Press", "Bank op 30-45°, dumbbells naast je borst.", "Duw schuin omhoog tot boven je schouders.", "Langzaam terug zakken tot een lichte stretch in je borst."],
  db_bench: ["Dumbbell_Bench_Press", "Lig plat, dumbbells naast je borst, polsen recht.", "Duw omhoog en breng ze iets naar elkaar toe.", "Gecontroleerd terug tot ellebogen net onder de bank."],
  chest_press: ["Machine_Bench_Press", "Stel de stoel zo in dat de handvatten op borsthoogte zitten.", "Duw naar voren zonder je ellebogen op slot te zetten.", "Rustig terug, gewicht niet laten neerkomen."],
  cable_fly: ["Cable_Crossover", "Kabels op schouderhoogte, een stap naar voren, lichte knik in je ellebogen.", "Breng je handen in een boog naar elkaar voor je borst.", "Rustig terug tot je een stretch voelt."],
  pec_deck: ["Butterfly", "Rug tegen het kussen, armen op borsthoogte.", "Knijp de armen naar elkaar toe met je borst.", "Gecontroleerd terug, niet laten wegschieten."],
  pushup: ["Pushups", "Handen iets breder dan je schouders, lichaam één rechte plank.", "Zak tot je borst bijna de grond raakt, ellebogen ca. 45°.", "Duw jezelf omhoog en houd je buik aangespannen."],
  incline_pushup: ["Incline_Push-Up", "Handen op een bank of tafel, lichaam recht.", "Zak met je borst naar de rand.", "Duw terug. Hoe lager het steunpunt, hoe zwaarder."],
  dips: ["Dips_-_Triceps_Version", "Steun op de liggers met gestrekte armen.", "Zak tot je bovenarmen ongeveer horizontaal zijn.", "Duw omhoog. Rechtop = triceps, voorover = borst."],
  deadlift: ["Barbell_Deadlift", "Stang boven je middenvoet, heupbreedte, pak de stang net buiten je knieën.", "Rug recht, borst omhoog, duw de vloer weg met je benen.", "Stang dicht langs je benen. Bovenin heupen naar voren, niet achterover hangen."],
  barbell_row: ["Bent_Over_Barbell_Row", "Heupen naar achter, bovenlijf ca. 45° voorover, rug recht.", "Trek de stang naar je navel, ellebogen langs je lichaam.", "Gecontroleerd laten zakken."],
  db_row: ["One-Arm_Dumbbell_Row", "Eén hand en knie op de bank, rug plat.", "Trek de dumbbell naar je heup, elleboog langs je lichaam.", "Rustig laten zakken tot je arm gestrekt is."],
  lat_pulldown: ["Wide-Grip_Lat_Pulldown", "Handen iets breder dan je schouders, knieën onder het kussen.", "Trek de stang naar je bovenborst, borst omhoog.", "Laat hem gecontroleerd omhoog gaan tot je armen gestrekt zijn."],
  seated_row: ["Seated_Cable_Rows", "Rechtop zitten, lichte knik in je knieën.", "Trek de handgreep naar je buik, schouderbladen naar elkaar.", "Rustig terug zonder met je rug mee te zwaaien."],
  pullup: ["Pullups", "Hang met handen iets breder dan je schouders.", "Trek je borst naar de stang, schouders omlaag.", "Gecontroleerd zakken tot gestrekte armen. Te zwaar? Gebruik een band."],
  chinup: ["Chin-Up", "Handpalmen naar je toe, schouderbreedte.", "Trek je kin over de stang.", "Langzaam zakken tot gestrekte armen."],
  inverted_row: ["Inverted_Row", "Lig onder een stang of stevige tafel, lichaam recht.", "Trek je borst naar de stang.", "Rustig terug. Voeten verder naar voren maakt het zwaarder."],
  decline_pushup: ["Decline_Push-Up", "Voeten op het bed of een stoel, handen op de vloer iets breder dan je schouders.", "Lichaam recht als een plank, zak tot je borst bijna de vloer raakt.", "Duw je krachtig omhoog. Hoe hoger je voeten, hoe zwaarder."],
  bulgarian_bw: ["Split_Squats", "Ga met je rug naar het bed staan en leg één voet achter je op het bed.", "Zak recht naar beneden tot je voorste dij bijna horizontaal is.", "Duw je op via je voorste hiel. Eerst alle reps links, dan rechts."],
  door_row: ["", "Sla een handdoek om beide deurklinken van een dichte deur die van je af opent.", "Pak de uiteinden, voeten dicht bij de deur, leun achterover met gestrekte armen.", "Trek je borst naar de deur, knijp je schouderbladen samen, rustig terug.", "Test eerst of de klink stevig vastzit."],
  prone_y: ["", "Lig op je buik, armen schuin boven je hoofd in een Y, duimen omhoog.", "Til je armen een paar cm op door je schouderbladen naar achter en beneden te trekken.", "Houd 2 tellen vast, rustig terug. Nek lang, kijk naar de vloer."],
  superman: ["Superman", "Lig op je buik, armen gestrekt voor je.", "Til armen, borst en benen tegelijk een paar cm op.", "Houd 1-2 tellen vast en zak rustig terug."],
  face_pull: ["Face_Pull", "Kabel met touw op ooghoogte.", "Trek het touw naar je gezicht, handen uit elkaar, ellebogen hoog.", "Knijp je schouderbladen samen en ga rustig terug."],
  ohp: ["Standing_Military_Press", "Stang op je sleutelbeenderen, billen en buik aangespannen.", "Duw de stang recht omhoog, hoofd even naar achter.", "Bovenin hoofd door je armen, gecontroleerd terug."],
  db_shoulder: ["Seated_Dumbbell_Press", "Zit rechtop, dumbbells op schouderhoogte.", "Duw omhoog tot je armen bijna gestrekt zijn.", "Rustig terug naar oorhoogte."],
  lateral_raise: ["Side_Lateral_Raise", "Dumbbells langs je lichaam, lichte knik in je ellebogen.", "Til zijwaarts tot schouderhoogte, met je ellebogen voorop.", "Langzaam laten zakken, niet zwaaien."],
  cable_lateral: ["Cable_Seated_Lateral_Raise", "Kabel laag, pak hem met de hand die het verst van de kabel is.", "Til zijwaarts tot schouderhoogte.", "Gecontroleerd terug; de kabel houdt spanning op je schouder."],
  rear_delt: ["Reverse_Flyes", "Buig voorover met een rechte rug, dumbbells onder je borst.", "Til je armen zijwaarts op, lichte knik in je ellebogen.", "Knijp je schouderbladen samen en zak rustig terug."],
  pike_pushup: [null, "Handen op de grond, billen hoog (omgekeerde V).", "Zak met je hoofd richting de grond tussen je handen.", "Duw terug omhoog. Voeten op een verhoging maakt het zwaarder."],
  bb_curl: ["Barbell_Curl", "Stang op schouderbreedte, ellebogen tegen je lichaam.", "Krul de stang omhoog zonder met je rug te zwaaien.", "Rustig laten zakken tot je armen gestrekt zijn."],
  db_curl: ["Dumbbell_Bicep_Curl", "Dumbbells langs je lichaam, handpalmen naar voren.", "Krul omhoog, ellebogen blijven op hun plek.", "Langzaam laten zakken."],
  hammer_curl: ["Hammer_Curls", "Handpalmen naar elkaar toe (als een hamer).", "Krul omhoog, ellebogen tegen je lichaam.", "Gecontroleerd terug."],
  cable_curl: ["Standing_Biceps_Cable_Curl", "Kabel laag, stang of touw op schouderbreedte.", "Krul omhoog zonder je ellebogen te bewegen.", "Rustig terug tot gestrekte armen."],
  pushdown: ["Triceps_Pushdown", "Kabel hoog, ellebogen tegen je lichaam.", "Duw omlaag tot je armen gestrekt zijn.", "Rustig terug tot ca. 90°, ellebogen blijven stil."],
  oh_ext: ["Cable_Rope_Overhead_Triceps_Extension", "Rug naar de kabel, touw achter je hoofd.", "Strek je armen naar voren en omhoog.", "Gecontroleerd terug; je ellebogen wijzen naar voren."],
  skullcrusher: ["EZ-Bar_Skullcrusher", "Lig plat, stang boven je borst met gestrekte armen.", "Buig alleen je ellebogen en zak naar je voorhoofd.", "Strek je armen weer. Bovenarmen blijven stil."],
  diamond_pushup: ["Push-Ups_-_Close_Triceps_Position", "Handen dicht bij elkaar onder je borst.", "Zak met je ellebogen langs je lichaam.", "Duw omhoog. Te zwaar? Doe het op je knieën."],
  bench_dips: ["Bench_Dips", "Handen op de rand van een bank, benen gestrekt of gebogen.", "Zak tot je ellebogen ca. 90° zijn.", "Duw jezelf omhoog. Blijf dicht bij de bank."],
  squat: ["Barbell_Squat", "Stang op je bovenrug, voeten op schouderbreedte, tenen iets naar buiten.", "Zak alsof je gaat zitten, knieën in de richting van je tenen, borst omhoog.", "Minimaal tot je heupen op kniehoogte zijn, dan krachtig omhoog."],
  front_squat: ["Front_Barbell_Squat", "Stang voor op je schouders, ellebogen hoog.", "Zak recht naar beneden met een rechtop bovenlijf.", "Duw omhoog vanuit je hielen en midvoet."],
  leg_press: ["Leg_Press", "Voeten op schouderbreedte midden op het platform.", "Zak tot je knieën ca. 90° zijn, onderrug blijft tegen het kussen.", "Duw terug zonder je knieën op slot te zetten.", "Bij knieklachten: zak alleen zo diep als pijnvrij."],
  goblet_squat: ["Goblet_Squat", "Houd een dumbbell of kettlebell voor je borst.", "Zak diep tussen je knieën, borst omhoog.", "Duw omhoog vanuit je hele voet."],
  lunge: ["Dumbbell_Lunges", "Dumbbells langs je lichaam, grote stap naar voren.", "Zak tot je achterste knie bijna de grond raakt.", "Duw af en stap door met het andere been."],
  bulgarian: ["Split_Squat_with_Dumbbells", "Achterste voet op een bank, voorste voet ruim naar voren.", "Zak recht naar beneden op je voorste been.", "Duw omhoog vanuit je voorste hiel."],
  leg_ext: ["Leg_Extensions", "Stel de rol in net boven je enkels, knie bij het draaipunt.", "Strek je benen helemaal.", "Rustig terug laten zakken."],
  bw_squat: ["Bodyweight_Squat", "Voeten op schouderbreedte, armen naar voren.", "Zak zo diep als je kunt met een rechte rug.", "Duw omhoog vanuit je hielen."],
  split_squat_bw: ["Split_Squats", "Ruime stap uit elkaar, bovenlijf rechtop.", "Zak recht naar beneden tot je achterste knie bijna de grond raakt.", "Duw omhoog. Doe alle reps en wissel dan van been."],
  step_up: ["Dumbbell_Step_Ups", "Zet één voet op een stevige bank of trede.", "Duw jezelf omhoog met dat been, niet afzetten met je achterste voet.", "Rustig terug naar beneden."],
  wall_sit: [null, "Rug tegen de muur, schuif naar beneden.", "Knieën op 90°, boven je enkels.", "Houd vast en blijf rustig doorademen.", "Bij knieklachten: zak minder diep."],
  rdl: ["Romanian_Deadlift", "Sta met de stang voor je dijen, lichte knik in je knieën.", "Duw je heupen naar achter, stang dicht langs je benen, rug recht.", "Zak tot je een stretch in je hamstrings voelt en kom omhoog met je heupen."],
  db_rdl: ["Stiff-Legged_Dumbbell_Deadlift", "Dumbbells voor je dijen, lichte knik in je knieën.", "Heupen naar achter, rug recht, dumbbells langs je benen.", "Stretch in je hamstrings, dan omhoog met je heupen."],
  leg_curl: ["Lying_Leg_Curls", "Lig op je buik, rol net boven je hielen.", "Krul je hielen naar je billen.", "Langzaam terug laten zakken."],
  hip_thrust: ["Barbell_Hip_Thrust", "Bovenrug tegen een bank, stang (met kussen) op je heupen.", "Duw je heupen omhoog tot je lichaam recht is, knijp je billen.", "Rustig terug naar beneden."],
  glute_bridge: ["Butt_Lift_Bridge", "Lig op je rug, knieën gebogen, voeten plat.", "Duw je heupen omhoog en knijp je billen samen.", "Houd 1 tel vast en zak rustig terug."],
  single_leg_bridge: ["Single_Leg_Glute_Bridge", "Lig op je rug, één been gestrekt in de lucht.", "Duw je heup omhoog via je hiel op de grond.", "Rustig terug. Wissel na de set van been."],
  nordic: ["Natural_Glute_Ham_Raise", "Kniel met je enkels vast onder iets stevigs.", "Laat je bovenlijf zo langzaam mogelijk naar voren zakken.", "Vang jezelf op met je handen en duw terug."],
  calf_raise: ["Standing_Calf_Raises", "Voorvoeten op de rand, hielen hangen eronder.", "Kom zo hoog mogelijk op je tenen.", "Langzaam terug tot een stretch in je kuiten."],
  bw_calf: ["Standing_Calf_Raises", "Sta met je voorvoeten op een traptrede, hou je vast.", "Kom zo hoog mogelijk op je tenen.", "Langzaam terug tot een stretch. Zwaarder: op één been."],
  plank: ["Plank", "Steun op je onderarmen en tenen, ellebogen onder je schouders.", "Lichaam één rechte lijn, billen en buik aangespannen.", "Niet laten doorzakken, rustig doorademen."],
  side_plank: ["Side_Bridge", "Lig op je zij, steun op je onderarm.", "Til je heupen op tot je lichaam recht is.", "Houd vast en wissel daarna van kant."],
  hanging_raise: ["Hanging_Leg_Raise", "Hang aan een stang, schouders actief.", "Til je benen op zonder te zwaaien.", "Rustig laten zakken. Makkelijker: knieën optrekken."],
  cable_crunch: ["Cable_Crunch", "Kniel voor de kabel, touw naast je hoofd.", "Krul je bovenlijf naar beneden met je buikspieren.", "Rustig terug. Je heupen bewegen niet."],
  dead_bug: ["Dead_Bug", "Lig op je rug, armen omhoog, knieën op 90°.", "Strek tegelijk één arm en het andere been uit, onderrug tegen de grond.", "Terug en wissel van kant."],
  crunch: ["Crunches", "Lig op je rug, knieën gebogen, handen bij je slapen.", "Krul je schouders van de grond met je buik.", "Rustig terug. Niet aan je nek trekken."],
  russian_twist: ["Russian_Twist", "Zit met je bovenlijf iets naar achter, voeten op of boven de grond.", "Draai je bovenlijf van links naar rechts.", "Houd je borst omhoog en beweeg rustig."],
  mountain_climber: ["Mountain_Climbers", "Begin in push-up positie.", "Trek afwisselend je knieën snel naar je borst.", "Heupen laag houden, schouders boven je handen."],
  burpee: [null, "Vanuit staan: hurk en zet je handen op de grond.", "Spring of stap naar push-up positie (eventueel een push-up).", "Voeten terug naar je handen en spring omhoog."],
  jumping_jack: [null, "Sta met je voeten bij elkaar, armen langs je lichaam.", "Spring je benen uit elkaar en klap je handen boven je hoofd.", "Spring terug. Rustig tempo, landen op je voorvoeten."],
  high_knees: [null, "Ren op de plaats.", "Breng je knieën om en om tot heuphoogte.", "Gebruik je armen mee en blijf op je voorvoeten."],
  squat_jump: ["Freehand_Jump_Squat", "Zak in een squat.", "Spring explosief omhoog.", "Land zacht door je knieën en ga direct de volgende squat in."],
  kb_swing: ["One-Arm_Kettlebell_Swings", "Kettlebell tussen je benen, heupen naar achter, rug recht.", "Stoot je heupen krachtig naar voren; de bel zwaait tot borsthoogte.", "Laat hem terugzwaaien tussen je benen. Het is een heupbeweging, geen squat."],
  bear_crawl: [null, "Op handen en voeten, knieën net boven de grond.", "Kruip vooruit: rechterhand met linkervoet, en andersom.", "Rug plat, heupen laag."],
  // Cardio
  bike: ["Bicycling_Stationary", "Zadel op heuphoogte: onderaan is je knie bijna gestrekt.", "Rechtop zitten, schouders los, rustig doorademen.", "Praattempo: je kunt nog praten. Zwaarder: 30 sec hard, 1 min rustig."],
  treadmill_run: ["Running_Treadmill", "Begin 3 minuten rustig. Zet de helling op 1%.", "Korte, lichte passen, rechtop, armen ontspannen mee.", "Praattempo. Zwaarder: 1 min snel, 2 min rustig."],
  treadmill_walk: ["Walking_Treadmill", "Stevig doorstappen, rechtop, niet aan de leuning hangen.", "Zet de helling op 5-10%: zo wordt wandelen echt training.", "Je ademt sneller, maar je kunt nog praten."],
  rower: ["Rowing_Stationary", "Eerst afduwen met je benen, dan iets achterover, dan de stang naar je onderborst.", "Terug in omgekeerde volgorde: armen, bovenlijf, benen. Rug recht.", "Praattempo. Zwaarder: 1 min hard, 1 min rustig."],
  crosstrainer: ["Elliptical_Trainer", "Rechtop staan, voeten plat op de pedalen.", "Duw en trek mee met je armen, buik licht aangespannen.", "Praattempo. Zwaarder: meer weerstand of korte intervallen."],
  stairs: ["Stairmaster", "Rechtop, hele voet op de trede.", "Hooguit licht vasthouden: niet op de leuning leunen.", "Begin rustig, dit is zwaarder dan het lijkt. Praattempo."],
  run_outside: ["Trail_Running_Walking", "Warm 5 minuten op met wandelen of rustig joggen.", "Korte passen, land onder je lichaam, rechtop en ontspannen.", "Praattempo. Sneller worden? Af en toe 1 min hard."],
};

export function howto(id) {
  const h = H[id];
  if (!h) return { imgs: [], cues: [] };
  const [folder, ...cues] = h;
  return { imgs: folder ? [IMG_BASE + folder + "/0.jpg", IMG_BASE + folder + "/1.jpg"] : [], cues };
}

export function imgsFor(folder) {
  return folder ? [IMG_BASE + folder + "/0.jpg", IMG_BASE + folder + "/1.jpg"] : [];
}

export function videoUrl(name) {
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(`${name} exercise proper form`);
}
