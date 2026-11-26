# Forge op je iPhone zetten

Forge is een web-app: hij draait in Safari, maar als je hem op je beginscherm zet werkt hij als een gewone app. Hij krijgt een eigen icoon, opent schermvullend en werkt ook offline. Je gegevens staan alleen op je telefoon.

Je doet dit één keer. Reken op ongeveer 15 minuten.

---

## Stap 1 – Maak een gratis GitHub-account

1. Ga op je computer naar **github.com** en klik op **Sign up**.
2. Vul je e-mail in, kies een wachtwoord en een gebruikersnaam (bijv. `jouwnaam`).
   Let op: die gebruikersnaam komt straks in de link van je app.
3. Bevestig je e-mailadres met de code die je krijgt.
4. Kies het gratis abonnement (**Free**).

## Stap 2 – Maak een "repository" (een map voor je app)

1. Klik rechtsboven op **+** en kies **New repository**.
2. Bij **Repository name** vul je `forge` in.
3. Kies **Public**. Dat moet voor gratis hosting. Er staan geen persoonlijke gegevens in de code: je workouts blijven op je telefoon.
4. Klik op **Create repository**.

## Stap 3 – Upload de bestanden

1. Klik op de pagina van je nieuwe repository op de link **uploading an existing file**.
2. Open op je Mac de map `gym-app` in Finder.
3. Selecteer **alles in die map** (Cmd+A) en sleep het naar het uploadvak in de browser.
   Sleep de *inhoud* van de map, niet de map zelf. `index.html` moet bovenaan staan, niet in een submap. De map `icons` mag je gewoon meeslepen.
4. Klik onderaan op **Commit changes**.

## Stap 4 – Zet GitHub Pages aan (de app online zetten)

1. Ga in je repository naar **Settings**, dan in het menu links naar **Pages**.
2. Bij **Source** kies je **Deploy from a branch**.
3. Bij **Branch** kies je **main** en **/ (root)**. Klik op **Save**.
4. Wacht 1 à 2 minuten en ververs de pagina. Bovenaan verschijnt dan:
   **Your site is live at `https://jouwnaam.github.io/forge/`**

## Stap 5 – Op je iPhone zetten

1. Open die link op je iPhone in **Safari**. Gebruik echt Safari, niet Chrome of de Instagram-browser.
2. Tik onderaan op het **deel-icoon** (vierkantje met pijl omhoog).
3. Scroll naar beneden en tik op **Zet op beginscherm**.
4. Tik op **Voeg toe**.

Forge staat nu met het zwart-groene dumbbell-icoon op je beginscherm. Open hem voortaan altijd via dat icoon.

---

## Updates

Heb ik iets aangepast aan de app? Upload dan de gewijzigde bestanden opnieuw via **Add file → Upload files** in je repository. Bestanden met dezelfde naam worden overschreven. Na 1 à 2 minuten heeft je telefoon de nieuwe versie: sluit de app helemaal af en open hem opnieuw.

## Back-up

Je gegevens staan alleen op je telefoon. Maak af en toe een back-up via **Profiel → Back-up maken** en bewaar het bestand in iCloud Drive of je mail. Met **Back-up terugzetten** zet je alles weer terug, bijvoorbeeld op een nieuwe telefoon.

Let op: verwijder je het icoon van je beginscherm, dan verwijdert iOS ook je gegevens. Maak dus eerst een back-up.

## Hoe gebruik je de app?

- **Vandaag**: bovenaan staat wat je gaat doen, bijv. *💪 Gewichten · Sportschool*. Tik erop om te wisselen naar **Circuit**, **Cardio** of **Hotel**. Je ziet dan je workout. Tik op **Start**.
  - **↻ Andere workout**: de coach maakt een nieuwe. Je ❤️ favorieten blijven staan.
  - **Pas aan**: alleen voor vandaag korter (ongeveer 30% korter, hooguit 30 min; eerst minder sets en kortere rust, dan pas minder oefeningen), lichter, of iets ontzien als er iets pijn doet. Bij **Iets doet pijn** kiest de coach vervangers die passen bij waar je bent (in het hotel geen machines), met verse reps en zonder je oude gewicht.
  - **↻ Andere workout** in het hotel: elke oefening wordt een andere van dezelfde soort (een row blijft een row; met dumbbells blijft een dumbbell-oefening een dumbbell-oefening), met reps die erbij passen (zonder gewicht 10-20).
  - **Oefening aanpassen**: tik op een oefening in je workout. Je kunt sets en reps (bij cardio: minuten) wijzigen, een andere oefening kiezen, hem eerder doen of eruit halen. Dit wordt bewaard voor de volgende keer (bij Hotel en Circuit alleen voor vandaag).
  - **+ Oefening toevoegen**: zoek in de lijst. Staat hij er niet bij? Tik op **Maak eigen oefening**.
- **Trainen**: je ziet één oefening tegelijk, met een foto. Zet kg en reps goed met **−/+** en tik op **Set klaar ✓**. Het grijze getal is je plan; typ om het te vervangen of gebruik − / +. Typ je iets wat niet kan kloppen (bijv. 600 kg), dan vraagt de app het even na. De rusttimer start vanzelf; aan het eind piept hij en wordt je scherm groen. Na je laatste set ga je vanzelf door naar de volgende oefening die nog niet af is; als alles af is, tik je op **Training afronden ✓**. Tik je **Set ongedaan maken**, dan stopt de rusttimer.
  - Tik op een set in het lijstje om hem aan te passen.
  - Tik op de foto of de naam (ⓘ) voor uitleg en een video. Heeft een oefening geen foto, dan staat de uitleg er meteen.
  - Via **⋯** kies je een andere oefening, sla je hem over, maak je hem favoriet of zeg je **Niet meer doen**. Sets die je al deed, blijven bewaard.
- **Na afloop** tik je **👍 of 👎**.
  - 👍: klaar, de workout is bewaard.
  - 👎: tik aan wat je niet meer wilt (mag ook niets) en tik op **Opslaan**. De volgende keer krijg je andere oefeningen (je favorieten blijven). Was het je eigen workout, dan staat die bij Profiel › Oude workouts. In het hotel verandert je sportschool-schema niet. Wat je afkeurt, komt niet meer terug; terugzetten kan bij Profiel.
  - **Overslaan**: bewaren zonder oordeel.
- **De coach leert wat je fijn vindt**: na een 👍 kiest hij de oefeningen die je deed vaker (in het hotel niet), na een 👎 minder vaak. Een ❤️ krijgt een oefening alleen als jij hem favoriet maakt.
- **❤️ Favoriet**: tik bij Vandaag op een oefening (of tijdens het trainen op **⋯**) en tik op **🤍 Maak favoriet**. Je favorieten staan bij Profiel; daar haal je ze ook weg. **Niet meer doen** gaat altijd voor.
- **Tijdens het trainen** zie je ook wat je **vorige keer** deed. Bij de eerste zware oefening krijg je **2 opwarmsets** voorgesteld, afgerond op 5 kg. Til je meer dan ooit, dan zie je **🏆 Nieuw record!**
- **Eerste keer een oefening?** De app vult een startgewicht in dat past bij je niveau (grote oefeningen zoals bench press en squat zwaarder). Pas het aan tot je net het aantal reps haalt.
- **Cardio** (fiets, loopband, roeien, crosstrainer, traploper of buiten hardlopen): kies bovenaan bij Vandaag **🚴 Cardio**, je apparaat en hoe lang. Apparaten die je blessure belasten, staan er niet tussen. Bij **Andere oefening kiezen** zie je dan alleen cardio, en een eigen oefening wordt daar ook cardio. Je vult **minuten en km** in in plaats van kg en reps; km mag leeg blijven; tik daarna op **Gedaan ✓**. Je ziet wat je vorige keer deed en je doel: verder komen in dezelfde tijd. Kom je verder dan ooit, dan zie je **🏆 Nieuw record!** Een cardiotraining telt mee in je week, maar verandert niets aan je krachtschema.
- **Zonder gewicht** (hotel): haal je alle reps, dan krijg je de volgende keer een zwaardere variant (bijv. push-up → decline push-up). Cardio wordt in een hotel zonder spullen **buiten hardlopen** (behalve bij een knieblessure).
- **Rustweek**: na 6 weken trainen stelt de coach een lichtere week voor (±10% lichter dan wat je voor de rustweek tilde, altijd minstens 1 stap, 1 set minder en dezelfde reps als vorige keer).
- **Back-up**: één keer per maand herinnert de app je eraan.
- **Gewichten** past de app zelf aan. Deed je vorige keer 8·8·7, dan is je doel nu 9·9·8. Haal je alle sets op de bovenkant van je reps, dan gaat het gewicht 1 stap omhoog (dumbbells 2 kg, stang, kabel en machine 2,5 kg, leg press 5 kg). Zit je 2× onder je reps, dan wordt je doel 1 stap lichter dan wat je tilde; terug naar dat zwaardere gewicht gaat pas na 2 goede trainingen. Pak je zelf zwaarder en haal je minder reps, dan blijft je doel staan. Staat een oefening op meer dagen, dan gaat het nieuwe gewicht overal mee.
- **Voortgang**: je trainingen per week, een grafiek per oefening (kg, of km bij cardio), je records en je geschiedenis.
- **Profiel**: je doel, niveau, dagen, tijd, indeling en blessures. Bij Boven/onder, Voorkant/achterkant en Push/pull/legs rouleert de coach de dagen, zodat alles even vaak aan de beurt komt. Bij **Cardio na krachttraining** kies je 10 of 20 minuten en je favoriete apparaat: de coach zet dat aan het eind van elke krachttraining. Dat komt bovenop je tijd per training: je krachtoefeningen blijven hetzelfde. Wijzig je iets, dan vraagt de app of hij een nieuw schema moet maken. Voeg je een blessure toe, dan wisselt de coach meteen de oefeningen die hem belasten (bij knieklachten blijven leg press en wall sit, zak dan minder diep).
- **Tijd per training**: de coach vult de minuten die je kiest (20 min = 3 korte oefeningen, 30 min = 4 à 5). Grote oefeningen eerst (na **Maak nieuw schema**), dan de kleine (armen, schouders, buik, extra borst), de spiergroep die die week het minst aan bod kwam eerst. Past niet alles, dan doe je kleine oefeningen 2 sets, zodat elke spiergroep toch aan bod komt. Twee grote oefeningen voor dezelfde spiergroep op één dag (bijv. row en pulldown): de tweede 1 set minder. Met **Kracht** doe je alleen de eerste grote oefening van de dag zwaar (4-6 reps), de rest 6-8 (6-10 als je ook spiermassa kiest).
- **✨ Je coach is vernieuwd**: die melding zie je één keer bovenaan Vandaag. Tik **Nieuw schema** voor nieuwe workouts (je eigen workouts gaan dan naar Oude workouts) of **Zo laten** (je eigen workouts blijven in je schema).
- **Oude workouts**: je eigen workouts en circuits uit de oude app staan bij Profiel › **Oude workouts**. Tik er een aan om hem vandaag te doen; je schema blijft hetzelfde. Staat bovenaan 🏨 Hotel, dan past de coach hem aan voor het hotel (geen machines of kabels).
- **Circuit** begint met 2 minuten rustig opwarmen. Oefeningen die je overslaat, tellen niet mee.

## Bronnen

De oefenfoto's komen uit [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (publiek domein). Ze worden geladen zodra je een oefening bekijkt en daarna bewaard, zodat ze ook offline werken. Een paar oefeningen hebben geen foto (burpees, jumping jacks, high knees, bear crawl, wall sit, pike push-up). Daarvoor gebruik je de uitleg en de videoknop.
