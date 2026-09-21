# 🎈 Theos Balloner

En lille app til iPhone og Android, hvor en baby kan trykke, klappe og swipe på skærmen for at poppe balloner.
Lavet til små fingre: alt på skærmen giver en reaktion, der er ingen menuer at fare vild i, og alle lyde og al
musik laves af appen selv (ingen reklamer, intet internet).

## Sådan virker spillet

- **Tryk på en ballon** – den popper med konfetti, en ring og et sjovt "pop". Store balloner har en dybere lyd end små,
  og hvert pop spiller en tone fra en pentatonisk skala, så det lyder som musik når der trykkes meget.
- **Tryk på himlen** – der kommer gnister, og en ny ballon pustes op lige under fingeren.
- **Swipe hen over skærmen** – alle balloner fingeren rammer popper (og der drysser små gnister efter fingeren).
- **Flere fingre / hele hånden** virker også. Trykfladen er ekstra stor, så man ikke skal ramme præcist.
- **Særlige balloner**: guld-stjerneballoner giver en klokke-klang og stjernestøv, regnbueballoner siger "boing".
- **Hver 10. ballon** udløser en lille fest: konfettiregn, fanfare og solen snurrer rundt.
- Ballonerne har ansigter, der blinker, og forskellige mønstre (prikker, striber, stjerner, regnbue).
- Der spiller stille baggrundsmusik: *Lille stjerne (Twinkle Twinkle)*, *Mary havde et lille lam*,
  *Ro, ro, ro din båd*, *Mester Jakob*, *Jens Hansen havde en bondegård* og den originale *Ballonvalsen*.
- Telefonen vibrerer let ved hvert pop (hvis telefonen kan).

## Forældremenu

Hold den lille lås i øverste venstre hjørne nede i **2 sekunder**. Så åbner en menu, hvor musik og lyde kan slås
fra og til. Menuen lukker sig selv igen efter kort tid. Et almindeligt tryk på låsen gør ingenting.

**Tips til leg uden afbrydelser:**

- iPhone: Slå *Guidet adgang* til (Indstillinger → Tilgængelighed → Guidet adgang), så knapperne og Hjem-bevægelsen
  er låst, mens appen kører.
- Android: Brug *Fastgør app* / *Skærmfastgørelse* (Indstillinger → Sikkerhed).
- Skærmen slukker ikke af sig selv, mens appen er åben.
- Ingen lyd på iPhone? Tjek lydløs-knappen på siden af telefonen.

## Teknik

- Én kodebase i TypeScript. Grafikken tegnes på et `<canvas>`, og al lyd syntetiseres med Web Audio (ingen lydfiler).
- Pakket som rigtig app med [Capacitor](https://capacitorjs.com) – `ios/` og `android/` er de native projekter.
- iOS-projektet bruger Swift Package Manager (ingen CocoaPods nødvendig).

```
src/
  main.ts     opstart, spil-loop, lyd-events, wake lock
  game.ts     al spillogik (balloner, tryk, pop, partikler) – ren TypeScript, testet med Vitest
  render.ts   tegning af himmel, sol, skyer, bakker, balloner og konfetti
  audio.ts    lydeffekter + musikafspiller (Web Audio)
  music.ts    sange og musik-hjælpere
  input.ts    touch/mus → spil, og blokering af zoom/scroll/langt-tryk-menuer
  parent.ts   forældremenu og indstillinger
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

Kræver en Mac med [Xcode](https://apps.apple.com/dk/app/xcode/id497799835).

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

### Navn og app-id

Appen hedder *Theos Balloner* og har id'et `com.pthagaard.theoballoner`. Begge dele står i `capacitor.config.json`
(og navnet også i `index.html`, `android/app/src/main/res/values/strings.xml` og `ios/App/App/Info.plist`).
Skift dem gerne før den første rigtige build.
