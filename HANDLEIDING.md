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
3. Kies **Public**. Dat moet voor gratis hosting. Er staan geen persoonlijke gegevens in de code: je workouts en je API-sleutel blijven op je telefoon.
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

Forge staat nu met het blauwe dumbbell-icoon op je beginscherm. Open hem voortaan altijd via dat icoon.

---

## AI-coach aanzetten (optioneel)

De **Snelle coach** werkt altijd en is gratis. Wil je de **AI-chat**, waarin je gewoon typt wat je wilt en de coach je schema aanpast? Daarvoor heb je een Claude API-sleutel nodig:

1. Ga naar **console.anthropic.com** en maak een account.
2. Ga naar **Billing** en zet er tegoed op, bijv. $5. Een gesprek kost meestal een paar cent.
3. Ga naar **API Keys** en klik op **Create Key**. Kopieer de sleutel (`sk-ant-…`).
4. Plak hem in Forge bij **Profiel → AI-coach → API-sleutel**.

Tips:
- De sleutel staat alleen op je telefoon. Deel hem met niemand. Wie hem heeft, kan op jouw tegoed chatten.
- Stel in de console een maandlimiet in (**Limits**), dan kan het nooit duurder worden dan je wilt.
- Is je sleutel ooit uitgelekt? Verwijder hem in de console en maak een nieuwe.

---

## Updates

Heb ik iets aangepast aan de app? Upload dan de gewijzigde bestanden opnieuw via **Add file → Upload files** in je repository. Bestanden met dezelfde naam worden overschreven. Na 1 à 2 minuten heeft je telefoon de nieuwe versie: sluit de app helemaal af en open hem opnieuw.

## Back-up

Je gegevens staan alleen op je telefoon. Maak af en toe een back-up via **Profiel → Back-up maken** en bewaar het bestand in iCloud Drive of je mail. Met **Back-up terugzetten** zet je alles weer terug, bijvoorbeeld op een nieuwe telefoon.

Let op: verwijder je het icoon van je beginscherm, dan verwijdert iOS ook je gegevens. Maak dus eerst een back-up.

## Hoe gebruik je de app?

- **Training**: hier zie je je volgende training. Tik op **Start**. Vul per set je gewicht en reps in en vink de set af. De rusttimer start dan vanzelf.
  Laat je een vak leeg, dan wordt de grijze suggestie gebruikt. Die is gebaseerd op je vorige keer: haalde je toen alle reps, dan stelt de app een hoger gewicht voor.
- **Schema's**: je trainingen bekijken, bewerken en zelf maken, plus de bibliotheek met ruim 880 oefeningen. Filter op spiergroep, materiaal (ook "Zonder gewicht") en soort (kracht, explosief, cardio, stretching). Oefeningen met **NL** hebben Nederlandse uitleg, de rest Engelse.
- **Coach**:
  - **Snelle coach**: maakt een schema op basis van je profiel, maakt circuits op tijd en past een training aan als je moe bent, weinig tijd hebt of ergens pijn hebt.
  - **AI-chat**: gewoon vragen stellen. Stelt de coach een schema voor, dan tik je op **Opslaan**.
- **Uitleg per oefening**: tik op de naam van een oefening (met ⓘ), in je training, in je schema of in de bibliotheek. Je ziet:
  - foto's van de begin- en eindpositie, die om de beurt verschijnen;
  - een korte uitleg in het Nederlands;
  - een knop naar video's op YouTube;
  - je eigen gewichten: je doel, je beste set en de laatste keren.
- **Gewichten automatisch aanpassen**: elke oefening in je schema heeft een doelgewicht.
  - Na je eerste training wordt vastgelegd wat je deed.
  - De app kijkt naar je reps. Deed je vorige keer 8·8·7 op hetzelfde gewicht, dan is het doel nu 9·9·8.
  - Haal je bij alle sets de bovenkant van je reps (bijv. 3 × 10)? Dan gaat het doel 1 stap omhoog: +2,5 kg (barbell en machines), +2 kg (dumbbells) of +1,25 kg (kleine spieroefeningen).
  - Zit je 2 trainingen op rij onder je minimum aantal reps, dan gaat het doel 1 stap omlaag.
  - Na elke training zie je wat er is aangepast. Je kunt het doelgewicht ook zelf wijzigen via **Schema's → Bewerken**, of de automatische aanpassing uitzetten bij **Profiel → Training**.
- **Soort set**: tik tijdens je training op het setnummer en kies:
  - **O** opwarmen: telt niet mee voor records, sets per spiergroep en de gewichtsaanpassing, en de rust is korter;
  - **D** drop set;
  - **F** tot falen.
  Daar kun je een set ook verwijderen.
- **🔥 Opwarmsets**: vul je werkgewicht in bij set 1 en tik op **Opwarmsets**. De app zet er opwarmsets voor: lege stang × 10, 50% × 8, 70% × 5 en 85% × 2.
- **🔗 Supersets**: koppel twee oefeningen via **⋯ → Superset met …**, tijdens je training of in **Schema's → Bewerken**. Je doet dan een set van de eerste, direct een set van de tweede, en pas daarna start de rusttimer.
- **🏨 In een hotel**: twee manieren.
  - **Je eigen training**: **Bijsturen → Ik zit in een hotel**. Kies "Alleen mijn kamer" of "Hotelgym met dumbbells". Elke oefening wordt dan vervangen door een variant voor dezelfde spieren, bijvoorbeeld bench press → push-up en squat → split squat.
  - **Snel iets doen**: **Snel starten → Hotelkamer**. Kies 20, 30 of 45 minuten en je krijgt een full body training in supersets met een korte finisher.
  - In beide gevallen tik je op **Start nu**. De training is dan alleen voor vandaag: je eigen schema en je doelgewichten veranderen niet, en je volgende sportschooltraining schuift gewoon door.
- **Voortgang**:
  - **sets per spiergroep** deze week en vorige week. Het groene vlak is je doel: 10-20 sets bij spiermassa, 6-12 bij fit blijven;
  - volume per week, een grafiek per oefening, je PR's en je geschiedenis.
  Op het Training-scherm zie je welke spiergroepen deze week nog achterlopen.
- **Profiel**: doelen, niveau, dagen, tijd, plek en blessures. Daarop baseert de coach alles.

## Bronnen

De oefenfoto's komen uit [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (publiek domein). Ze worden geladen zodra je een oefening bekijkt en daarna bewaard, zodat ze ook offline werken. Een paar oefeningen hebben geen foto (burpees, jumping jacks, high knees, bear crawl, wall sit, pike push-up). Daarvoor gebruik je de uitleg en de videoknop.
