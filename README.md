# 🎈 Theos Balloner

En lille app til iPhone og Android, hvor en baby kan trykke, klappe og swipe på skærmen for at poppe balloner.
Lavet til små fingre: alt på skærmen giver en reaktion, der er ingen menuer at fare vild i, og alle lyde og al
musik laves af appen selv (ingen reklamer, intet internet).

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

**Opdatering inde fra appen:** åbn forældremenuen → *Opdatering* → **Søg efter ny version**. Er der en nyere, vises
hvad der er nyt, og **Hent og installér** henter den og åbner Androids installationsvindue. Første gang spørger
telefonen, om Theos Balloner må installere apps; sig ja (det gælder kun denne app). Webappen opdaterer sig selv.

Vil du bygge en ny version manuelt, så kør workflowet *Byg app* under fanen **Actions** på GitHub
(knappen *Run workflow*).

**Lås:** brug knappen *Lås appen fast på skærmen* i forældremenuen (se nedenfor), så kan små fingre ikke forlade den.

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
- **Uvejrsskyen** – en sjælden gæst: en mørk, gnaven sky driver hen over himlen og regner. Regnen presser
  ballonerne ned og får blomsterne til at vokse. Den lyner af sig selv af og til, og hver gang man trykker på den:
  balloner i lynets vej popper, blomsterne snurrer, hunden bliver til en hotdog, elefanten til en mus og fuglen
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

Appen hedder *Theos Balloner* og har id'et `com.pthagaard.theoballoner`. Begge dele står i `capacitor.config.json`
(og navnet også i `index.html`, `android/app/src/main/res/values/strings.xml` og `ios/App/App/Info.plist`).
Skift dem gerne før den første rigtige build.
