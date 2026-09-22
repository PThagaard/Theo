# 🎈 Theos spil

En lille app til iPhone og Android med små spil til Theo: *Theos Balloner* (tryk, klap og swipe for at poppe
balloner) og *Theos Ord og Billeder* (én ting ad gangen, ordet i jeres egne stemmer). Lavet til små fingre: alt på
skærmen giver en reaktion, der er ingen menuer at fare vild i, og alle lyde og al musik laves af appen selv (ingen
reklamer, intet internet).

## 🌐 Anbefalet: én webapp på dit eget domæne

Web-udgaven er en fuldgyldig "installerbar" app (PWA): den lægger sig på startskærmen med ikon, kører i fuld skærm,
vibrerer, holder skærmen tændt og virker uden internet, når den først har været åbnet én gang. Fordelen frem for en
APK er, at nye spil og rettelser er live med det samme, og at den også virker på iPhone og tablets.

Webappen ligger allerede på <https://pthagaard.github.io/Theo/> (GitHub Pages, opdateres automatisk ved hvert push).
Åbn adressen på telefonen og installér den som beskrevet nedenfor, eller peg et eget domæne på den.

**Andre måder at lægge den på et domæne** (kræver https, hvilket alle nævnte muligheder giver gratis):

- *Almindeligt webhotel:* kør `npm run build` og upload indholdet af `dist/` (fx via FTP) til domænets rod eller en
  undermappe som `balloner/`. Mappen `dist/` kan også hentes færdigbygget som artefaktet **theos-balloner-web** under
  fanen *Actions* på GitHub.
- *Automatisk ved hvert push:* forbind repoet til [Cloudflare Pages](https://pages.cloudflare.com) eller
  [Netlify](https://www.netlify.com) (build-kommando `npm run build`, output-mappe `dist`) og peg domænet derhen.
  Begge er gratis og virker med private repos.
- *GitHub Pages (nemmest):* gør repoet offentligt (Settings → General → Danger Zone → *Change visibility*), så lægger
  workflowet automatisk webappen på <https://pthagaard.github.io/Theo/> ved næste push. Skulle jobbet klage over, at
  Pages ikke er slået til, så vælg *Settings → Pages → Source: GitHub Actions* én gang. Eget domæne sættes samme sted
  (*Custom domain*) plus en CNAME-post hos din DNS-udbyder, der peger på `pthagaard.github.io`.

**Installér den på telefonen:**

- *Android (Chrome):* åbn adressen → menuen ⋮ → **Føj til startskærm** / **Installér app**. Åbn den fra ikonet, så
  kører den i fuld skærm uden browserlinjen.
- *Android (Samsung Internet):* menuen ≡ → **Føj side til** → **Startskærm**.
- *iPhone (Safari):* **Del** → **Føj til hjemmeskærm**.

## 📱 Alternativ: Android-app (APK) uden udviklerværktøjer

Hver gang der pushes til GitHub, bygger GitHub selv en færdig app-fil (APK) og lægger den under **Releases**.

1. Åbn <https://github.com/PThagaard/Theo/releases/latest> i browseren **på telefonen** og tryk på
   **TheosBalloner.apk**. Repoet er offentligt, så det kræver ikke login.
2. Åbn den hentede fil (fra notifikationen eller mappen *Downloads*). Siger telefonen, at browseren ikke må installere
   ukendte apps, så tryk **Indstillinger** og slå **Tillad fra denne kilde** til. Tryk derefter **Installér**.
3. Spørger Google Play Protect, om appen skal scannes, så vælg blot *Installér alligevel* / *Scan*. Appen bruger
   ikke internettet og beder ikke om nogen tilladelser.
4. Nye versioner installeres bare oven i den gamle. Indstillinger bevares.

**Opdatering inde fra appen:** appen kigger selv efter nye versioner kort efter start (højst hver 12. time) og
henter dem i baggrunden. En lille rød prik på låseknappen i hjørnet betyder, at en ny version er klar. Åbn
forældremenuen → *Telefon*: der står, hvad der er nyt, og **Installér nu** åbner Androids installationsvindue med
det samme. Menuen kigger også selv, når den åbnes, og *Søg efter ny version* gør det på et tryk. Første gang spørger
telefonen, om Theos spil må installere apps; sig ja (det gælder kun denne app). Webappen opdaterer sig selv.

Vil du bygge en ny version manuelt, så kør workflowet *Byg app* under fanen **Actions** på GitHub
(knappen *Run workflow*).

**Lås:** brug knappen *Lås appen fast på skærmen* i forældremenuen (se nedenfor), så kan små fingre ikke forlade den.

## Sådan bruger I den rigtigt

Skærmen lærer ikke en baby noget i sig selv. Sundhedsstyrelsen anbefaler ingen skærm under to år uden en voksen,
der deltager aktivt, og det er sådan, appen er tænkt: som et legetøj, I bruger sammen, i korte stunder.

Hvad forskningen faktisk siger om skærm og apps under to år, og hvad det betyder for hvert spil, står i
`docs/FORSKNING.md`. Kort: appen kan ikke lære Theo noget i sig selv; det kan hans egen hånd, der får et svar,
titte-bøh, jeres ansigter og jeres ord.

- **Sammen.** Sid med ham, peg og sæt ord på det, han rører: "Hund! Vov vov." "Ballon, pop!" Det er jeres ord, han
  lærer af, ikke appens lyde.
- **Kort.** 5–10 minutter ad gangen. Pausen i forældremenuen sørger for, at verdenen selv falder i søvn.
- **Ikke før sengetid.** Skærm og søvn passer dårligt sammen, også for de mindste.
- **Hans signaler bestemmer.** Kigger han væk, gnider øjne, klynker eller bliver "fjern", så er det slut for i dag,
  uanset hvor lidt der er gået.
- **Start i den rolige ende.** *8–12 mdr* er standard. Skru først op, når han tydeligt kan følge med og bede om mere.

## Sådan virker spillet

- **Tryk på en ballon** – den popper med konfetti, en ring og et sjovt "pop". Store balloner har en dybere lyd end små,
  og hvert pop spiller en tone fra en pentatonisk skala, så det lyder som musik når der trykkes meget.
- **Tryk på himlen** – der kommer gnister, og en ny ballon pustes op lige under fingeren.
- **Swipe hen over skærmen** – fingeren maler et lysende regnbuespor, og hvert stykke af turen spiller en harpetone
  (lysere toner højere oppe på skærmen). Balloner fingeren rammer popper; balloner og skyer i nærheden blæses til
  side af "vinden" og svæver på plads igen.
- **Tryk på solen** – den snurrer rundt, kniber øjnene sammen og siger "wiii". **Tryk på en sky** – den vrikker og
  drypper regn med små plip-lyde.
- **Ryst telefonen** – alt hopper i vejret, det rasler og drysser konfetti.
- **Ballonen samler dyr op** – pust en ballon op lige over hunden, sneglen, elefanten, fuglen eller sommerfuglen,
  så hænger dyret i snoren og råber om hjælp, mens ballonen tungt stiger til vejrs. Pop ballonen: dyret daler roligt
  ned under en lille faldskærm og fortsætter, hvor det slap (fuglen og sommerfuglen flyver bare videre).
- **Uvejrsskyen** – en sjælden gæst: en stor, mørk sky med et glad, frækt ansigt, der bliver på himlen i et par
  minutter og regner. Regnen skubber ballonerne ned og ud til siderne og får blomsterne til at vokse. Man kan tage
  fat i skyen og swipe den rundt. Den lyner af sig selv af og til, og hver gang man trykker på den: et zap og et
  knald, balloner i lynets vej skubbes til siden, blomsterne snurrer, hunden bliver til en hotdog, elefanten til
  en mus og fuglen
  strutter af skræk (alt bliver normalt igen efter nogle sekunder). Når skyen er drevet over, lyser regnbuen op.
- **Blomsterne** – tryk på en blomst: den snurrer rundt og skifter farver i nogle sekunder. Swipe hen over
  blomsterne: de plukkes, flyver op i luften, snurrer og daler ned, og vokser op igen lidt efter.
- **Besøg** – med jævne mellemrum kommer der nogen forbi: en hund, der går hen over græsset og hopper og gør, når
  man rører den; en elefant, der kigger op bag bakken og trumpeterer; en fugl, der slår en kolbøtte; en sommerfugl,
  der flagrer mellem blomsterne; en snegl, der gemmer sig i sit hus; og af og til et stjerneskud, der eksploderer i
  stjerner. Alle reagerer også, når telefonen rystes.
- **Familie-balloner** – tilføj billeder af mor, far og Theo i forældremenuen: vælg et billede fra galleriet (gerne
  et gruppebillede) eller tag et selfie, træk ansigtet ind i cirklen, zoom og gem; klip gerne flere ansigter fra
  samme billede. Så får nogle af ballonerne et ansigt fra familien, og når sådan en poppes, springer billedet stort
  frem med hjerter og "ta-daa". Billeder valgt på telefonen bliver kun på telefonen; der ligger ingen billeder i
  appen eller i repoet.
- **Flere fingre / hele hånden** virker også. Trykfladen er ekstra stor, så man ikke skal ramme præcist.
- **Gården** til højre: en rød lade med rygende skorsten, og en gammel traktor, der af og til kører ud, holder
  lidt og kører hjem igen. Tryk på den, og den dytter og hopper. Den kan løftes af en ballon som alle de andre.
- **Forsiden "Theos spil"**: når appen åbner, vælger I spillet på store felter. Spillene har ingen vej tilbage
  til forsiden; forældremenuen → *Leg* → *Skift spil* fører tilbage.
- **Theos Badekar** (spil nr. 3): badet. Sæbebobler stiger langsomt op fra vandet. Tryk på en boble: plop. Tryk på
  vandet: plask, bølger og nye bobler. Swipe: popper alt på vejen og laver bølger. Hold fingeren stille: en boble
  vokser og svæver væk, når du slipper. Ryst telefonen: alt hopper, og en byge af bobler stiger op. Drej telefonen,
  og vandet hælder som rigtigt vand. Gummiænderne rapper og skifter farve ved tryk; hold fingeren på en and, og den
  suser i regnbuefarver frem og tilbage. Der er altid mindst én boble. Nu og da kommer en gæst: hvalen, der gemmer
  sig, så kun ryggen og hullet stikker op (tryk, og den lader vandet ud og kommer glad op), koen i speedbåden (muh
  og dyt), pingvinen på vandscooteren, guldfisken, der springer (hvert tredje spring ender i en boble, der bærer den
  væk, medmindre I popper boblen), bruseren, der drypper, til man rører den, og så sprøjter, laver bobler og kan
  trækkes rundt med fingeren, og isbjørnen, der driver forbi på sin isflage og vinker hej hej. Ryst telefonen, når
  badet er tomt, og en gæst kommer. Samme greb som Balloner, fordi det er dem, der virker for de mindste; *Tempo* og
  *Alder* gælder her også (for de mindste én gæst ad gangen og sjældent).
- **Theos Trommer** (spil nr. 4): hele skærmen er store farveflader (tre for de mindste, op til fem for de
  ældste). Slå på dem: en tone fra en pentatonisk skala, så det altid lyder godt, en bølge fra hånden og noder,
  der flyver op. Swipe over fladerne: de synger én ad gangen. Hold hånden stille: trommehvirvel. Ryst: hvirvel over
  alle. Hvert sjette slag sender et familieansigt op på en node. Ingen blink: en flade lyser højst op tre gange i
  sekundet.
- **Theos Bolde** (spil nr. 5): et legerum med store, bløde bolde med ansigter (tre for de mindste, op til seks).
  Rør en bold: den hopper. Hold fast og flyt hånden: den følger med og flyver den vej, hånden kaster. Tryk på
  måtten: trampolin. Swipe skubber, ryst får alle til at hoppe, og drejer I telefonen, ruller boldene ned mod den
  lave side. De forlader aldrig skærmen. Familien får ansigter på boldene.
- **Altid på tværs**: appen kører kun i landscape (begge veje), også når telefonen vendes.
- **Uvejret slutter med et langt tryk**: hold fingeren stille på uvejrsskyen, til den er hvid igen; så holder regnen
  op, regnbuen kommer, og en almindelig sky driver videre.
- **Theos Titte-bøh og Ord** (spil nr. 2) retter sig efter alderen i forældremenuen. *8–12 mdr*: titte-bøh. Jeres
  familiebilleder og fire dyr (hund, elefant, ko, kat) gemmer sig bag en busk tre ud af fire gange; rør busken, og
  tingen kommer frem med sin lyd og navnet i jeres stemme. Swipe: den næste. Intet sker af sig selv. Fra *1–2 år*:
  hele flokken (fugl, sommerfugl, snegl, traktor, bil, ballon, sol, sky og blomst med), én ting ad gangen midt på
  græsset, busken rasler først og åbner ved andet tryk, og hver tredje gang en **"Hvor er …?"-runde**: to ting ved
  siden af hinanden (*2+ år*: tre), jeres indtalte stemme spørger efter én, alt han rører siger sit eget navn, og
  den rigtige fejrer med stjerner og hop. Ingen fejl, ingen tid, ingen point. Hvorfor sådan: `docs/FORSKNING.md`.
- **Jeres stemmer** (forældremenuen → *Familie*, vises kun mens *Theos Titte-bøh og Ord* kører): indtal ordene
  (hund, elefant, ko, kat, traktor, bil, ballon, sol, sky, blomst …), spørgsmålet *Hvor er …?* (sig bare "hvor er")
  og navnene på familiebillederne med jeres egne stemmer. Når Theo rører tingen i Ord, siger appen ordet med jeres
  stemme. Balloner og Badekarret siger ingen ord; der er kun lyde. Telefonen beder om lov til mikrofonen første
  gang; optagelserne bliver på telefonen.
- **Musik** (forældremenuen → *Musik*): hver sang kan slås til og fra, hastigheden kan sættes (langsom, normal,
  hurtig), og *Næste sang* springer videre. Appens egne sange er gamle børnesange eller vores egne, spillet af appens
  spilledåse; ingen optagelser. (Baby Shark som spilledåse-melodi blev prøvet og taget ud igen.)
- **Jeres musik** (samme sted → *Vælg sang på telefonen*): læg jeres egne lydfiler ind (fx Baby Shark). De står
  først i listen, spiller først, følger hastigheden og kan slås fra som de andre. Lydstyrken jævnes ud efter appens
  egen musik. Filerne bliver kun på telefonen, ligesom billederne; der ligger ingen musikfiler i appen eller repoet.
  Plads til 10; fjern med ✕.
- **Nedtælling til pausen**: er *Pause efter* slået til, står der en lille, mat tid nederst til højre i spillet.
- **Alder og pause** (forældremenuen → *Leg*): *8–12 mdr* er standard og holder verdenen rolig (tre balloner,
  ét besøg ad gangen, intet uvejr af sig selv, ingen skærmblink, lavere musik); *1–2 år* og *2+ år* skruer op.
  *Pause efter* 5/10/20 minutter lader verdenen falde stille i søvn: solen går ned, månen kommer frem, og kun et hold
  på hjørneknappen vækker den igen. Tiden tælles fra appen åbnes (eller vækkes), uanset om der røres ved skærmen;
  menuen viser, hvornår det sker. Kan slås fra.
- **Hold fingeren stille** for en tredje slags leg: hold på en hvid sky, og den bliver mørk og til uvejrsskyen
  lige der; hold på tom himmel, og ballonen under fingeren vokser, til den sprænger (slip før, og kæmpeballonen
  flyver op); hold på solen, og den lader op til et solskinsbrag, hvor blomsterne skyder i vejret og ballonerne
  løftes.
- **Særlige balloner**: guld-stjerneballoner giver en klokke-klang og stjernestøv, regnbueballoner siger "boing".
- **Hver 10. ballon** udløser en lille fest: konfettiregn, fanfare og solen snurrer rundt.
- Ballonerne har ansigter, der blinker, og forskellige mønstre (prikker, striber, stjerner, regnbue).
- Der spiller stille baggrundsmusik: *Lille stjerne (Twinkle Twinkle)*, *Mary havde et lille lam*,
  *Ro, ro, ro din båd*, *Mester Jakob*, *Jens Hansen havde en bondegård* og den originale *Ballonvalsen*.
- Telefonen vibrerer let ved hvert pop (hvis telefonen kan).

## Forældremenu og lås

Hold den lille lås i øverste venstre hjørne nede i **2 sekunder** med én finger. Så åbner en menu, hvor musik og lyde
kan slås fra og til, og hvor **tempoet** vælges: *Rolig* (få, langsomme balloner), *Normal* eller *Vild* (mange,
hurtige). Menuen lukker sig selv igen efter kort tid. Et almindeligt tryk på låsen gør ingenting, og en hel
hånd på skærmen åbner den heller ikke.

**Lås appen fast (Android):** tryk på **Lås appen fast på skærmen** i menuen. Telefonen spørger "Fastgør?" én gang;
tryk OK. Derefter virker Hjem, Tilbage, Seneste apps og notifikationspanelet ikke, før appen låses op igen: hold
den grønne knap i menuen nede i 2 sekunder, eller brug Androids egen gestus (swipe op fra bunden og hold). Med
**Lås automatisk ved start** spørger telefonen, hver gang appen åbnes. Det er Androids indbyggede "Fastgør vinduer";
vil du også have PIN-kode ved oplåsning, så slå *Bed om PIN før frigørelse* til under Indstillinger → Sikkerhed →
Fastgør vinduer.

**Tips til leg uden afbrydelser:**

- iPhone: Slå *Guidet adgang* til (Indstillinger → Tilgængelighed → Guidet adgang), så knapperne og Hjem-bevægelsen
  er låst, mens appen kører.
- Android: Brug *Fastgør app* / *Skærmfastgørelse* (Indstillinger → Sikkerhed).
- Skærmen slukker ikke af sig selv, mens appen er åben.
- Ingen lyd på iPhone? Tjek lydløs-knappen på siden af telefonen.

## Theos leg (statistik)

Forældremenuen viser, hvad der er leget: balloner poppet (og hvor mange af dem var familie-, stjerne- og
regnbueballoner), balloner pustet op og blæst væk, swipes, harpetoner, tryk på himlen, solen, skyerne, ryst, fester,
besøg (og hvilke dyr der er rørt), hvor mange gange hver person i familien er poppet, og legetid. Alt både for i dag
og i alt siden første leg. Tallene gemmes kun på telefonen og kan nulstilles med knappen (hold nede).

## Teknik

- Én kodebase i TypeScript. Grafikken tegnes på et `<canvas>`, og al lyd syntetiseres med Web Audio (ingen lydfiler).
- Pakket som rigtig app med [Capacitor](https://capacitorjs.com) – `ios/` og `android/` er de native projekter.
- iOS-projektet bruger Swift Package Manager (ingen CocoaPods nødvendig).

```
src/
  sw.js       service worker (offline-cache til web-udgaven, udfyldes af vite.config.ts ved build)
  main.ts     opstart, spil-loop, lyd-events, wake lock
  game.ts     al spillogik (balloner, tryk, pop, partikler) – ren TypeScript, testet med Vitest
  render.ts   tegning af himmel, sol, skyer, bakker, balloner og konfetti
  audio.ts    lydeffekter + musikafspiller (Web Audio)
  music.ts    sange og musik-hjælpere
  input.ts    touch/mus → spil, og blokering af zoom/scroll/langt-tryk-menuer
  parent.ts   forældremenu, indstillinger og lås-knappen
  kidlock.ts  bro til Androids "fastgør app" (KidLockPlugin.java i android/)
```

## Kom i gang

Kræver [Node.js](https://nodejs.org) 22 eller nyere.

```bash
npm install
npm run dev        # prøv appen i browseren (åbn adressen på telefonen på samme wifi for at teste touch)
npm test           # kør enhedstests
npm run build      # byg web-delen til dist/
```

### iPhone / iPad

Kræver en Mac med [Xcode](https://apps.apple.com/dk/app/xcode/id497799835). Uden Mac: brug webappen (se øverst).

```bash
npm run ios        # bygger og åbner projektet i Xcode
```

I Xcode: vælg dit hold under *Signing & Capabilities* (et gratis Apple-id er nok til at køre på din egen telefon),
vælg din iPhone øverst og tryk ▶︎. Første gang skal du stole på udvikleren på telefonen
(Indstillinger → Generelt → VPN og enhedshåndtering).

### Android

Kræver [Android Studio](https://developer.android.com/studio).

```bash
npm run android    # bygger og åbner projektet i Android Studio
```

Slå *Udviklerindstillinger* og *USB-fejlfinding* til på telefonen, sæt den i, og tryk ▶︎ i Android Studio.
Alternativt: *Build → Build APK(s)* og kopier filen til telefonen.

### Efter ændringer i koden

```bash
npm run sync       # npm run build + npx cap sync (kopierer web-filerne ind i ios/ og android/)
```

### App-ikon og splash

Kilderne ligger i `assets/` (lavet ud fra `public/icon.svg`). De færdige ikoner er allerede genereret ind i de native
projekter. Vil du lave nye:

```bash
npx @capacitor/assets generate --iconBackgroundColor '#4fb3ff' --splashBackgroundColor '#4fb3ff' \
  --iconBackgroundColorDark '#4fb3ff' --splashBackgroundColorDark '#4fb3ff'
```

### Signering af Android-appen

`android/keystore/theo.keystore` er en fast nøgle til denne private app (kodeord står i `android/app/build.gradle`).
Den gør, at nye builds installeres som opdateringer i stedet for at kræve afinstallation. Skal appen nogensinde i
Google Play, så lav en ny privat nøgle og hold den uden for git.

### Navn og app-id

Appen hedder *Theos spil* og har id'et `com.pthagaard.theoballoner`. Begge dele står i `capacitor.config.json`
(og navnet også i `index.html`, `android/app/src/main/res/values/strings.xml` og `ios/App/App/Info.plist`).
Skift dem gerne før den første rigtige build.
