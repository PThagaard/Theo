# CLAUDE.md – Theos Legeplads

Denne fil er arbejdsgrundlaget for alle, der udvikler på projektet (mennesker og Claude). Læs den først.
Detaljer ligger i `docs/`. Hold filen kort og opdateret: når en regel eller en struktur ændrer sig, ændres den her.

## Hvad projektet er

Et reklamefrit, trygt lege- og læringsunivers til **Theo** (født januar 2026) på en gammel Samsung Galaxy S21, som er
"hans" telefon. Det udvikles af hans far sammen med Claude og skal følge Theo i mange år: nye aktiviteter kommer til,
efterhånden som han udvikler sig. Første aktivitet er **Theos Balloner** (pop balloner ved at trykke og swipe).

- **Nu:** privat udviklingsprojekt til Theo. Distribution: APK under GitHub Releases + webapp på GitHub Pages.
- **Senere (måske):** gratis udgivelse til alle interesserede (Google Play / App Store / web). Se "Vejen til offentlig
  udgivelse" nederst. Indtil da må vi gerne gå hurtigt frem, men aldrig på bekostning af principperne herunder.
- Roadmap og læringsmål pr. alder: `docs/ROADMAP.md`. Hvad Theo faktisk gør med appen: `docs/OBSERVATIONER.md`.
  Historik: `CHANGELOG.md`. Forældrevejledning: `README.md`.

## Ufravigelige principper

1. **Ingen reklamer, køb, konti, tracking eller analytics.** Ingen netværkskald i selve spillet. Den eneste
   netværksadgang er forældremenuens opdateringstjek (når menuen åbnes, og på *Søg efter ny version*), som kun
   forældrene kan udløse og som kun taler med projektets egne GitHub Releases (sender intet andet end en almindelig
   HTTP-forespørgsel). Ingen tredjeparts-SDK'er ud over Capacitor og dets officielle plugins. Det gælder også, når
   appen bliver offentlig.
2. **Alt, barnet rører ved, reagerer** – med bevægelse *og* lyd, inden for 100 ms. Ingen døde områder, ingen "forkert",
   ingen straf, ingen tidspres, ingen "game over". Alt kan gøres med én hel hånd, ikke kun en præcis finger.
3. **Ingen tekst, knapper eller menuer til barnet.** Alt voksen-UI ligger bag "hold nede i 2 sekunder"-porten
   (forældremenuen), som også afbrydes, hvis flere fingre rører skærmen.
4. **Barnet kan ikke forlade eller ødelægge noget.** Tilbage ignoreres, zoom/scroll/langt-tryk er blokeret, skærmen
   slukker ikke, og appen kan låses fast på skærmen (KidLock). Indstillinger kan kun ændres fra forældremenuen.
5. **Roligt og trygt.** Moderat lydstyrke og et kompressor-sikret miks; ingen pludselige høje eller skræmmende lyde;
   ingen hurtige blink (aldrig mere end 3 blink i sekundet på store flader); bløde, glade figurer.
6. **Sjov først, læring gennem leg.** Hver aktivitet har et udviklingsmål (`docs/ROADMAP.md`), men det må aldrig
   mærkes som undervisning. Theo bestemmer tempoet.
7. **Robusthed frem for features.** Én fejl må aldrig fryse spillet (spil-loopet fanger fejl), partikler og
   objekter har lofter, og alt skal køre glat (60 fps) på S21'eren og gerne på ældre telefoner.
8. **Al musik er public domain eller original.** Lyd syntetiseres i koden, undtagen dyrelyde og vejr, som må være
   rigtige optagelser fra `src/lyde/`, når licensen tillader fri brug (CC0, Pixabay Content License eller lignende)
   og kilden står i `src/lyde/README.md`. Synthen er altid reserve, hvis filen mangler. Grafik tegnes i kode eller er
   vores egen.

## Sådan forstår vi ønsker fra forældrene

Et forslag fra Theos forældre ("en hund, der går over græsset", "en elefant bag bakken") er et **eksempel på et
behov**, ikke en kravspecifikation. Arbejdsgangen er altid:

1. Find behovet bag forslaget (fx: overraskelser og liv i verdenen, dyr med lyde til ordforråd, nye ting at
   opdage, noget der belønner opmærksomhed). Skriv behovet ned i `docs/OBSERVATIONER.md` eller roadmappen.
2. Lav det foreslåede *og* mindst et par egne ideer, der dækker samme behov, gerne bygget som et generelt system
   (fx "besøg" i stedet for én hund), så det er nemt at tilføje flere.
3. Forklar kort, hvilket behov der er dækket hvordan, og foreslå selv næste skridt. Kom også selv med behov og
   ideer, forældrene ikke har nævnt, når udviklingstrinnet (`docs/ROADMAP.md`) peger på dem.

## Sprog og stil

- Brugervendt tekst, README, docs, changelog og commit-beskeder: **dansk**. Kode, kommentarer og identifikatorer:
  **engelsk**. Kommentarer forklarer *hvorfor* (og børne-hensynet bag), ikke hvad koden mekanisk gør.
- TypeScript i `strict`. Ingen `any`. Små moduler med ét ansvar. Ingen nye afhængigheder uden god grund.

## Arkitektur

Én kodebase: TypeScript + Vite, tegnet på et `<canvas>` (2D), lyd via Web Audio. Pakket med Capacitor 8 til Android
(`android/`) og iOS (`ios/`, Swift Package Manager). Web-udgaven er en installerbar PWA med service worker.

```
src/
  main.ts       opstart: canvas, spil-loop (try/catch), events → lyd/haptik, wake lock, service worker
  game.ts       Balloner: al spillogik inkl. besøg (dyr), vind, sol/skyer, foto-balloner. Ren TypeScript uden
                DOM/canvas → enhedstestes i Node
  render.ts     Balloner: tegning. Ingen spillogik her
  audio.ts      Synth (stemmer), lydeffekter og musikafspiller. Kan køre offline (OfflineAudioContext) til test
  music.ts      sange (notation + kompilering til events) – rene funktioner
  input.ts      touch/mus → press/drag/release; ryst (DeviceMotion); blokering af browser-gestus
  parent.ts     forældremenu (hold 2 sek.), indstillinger (localStorage), lås-knap
  kidlock.ts    bro til android/.../KidLockPlugin.java (Androids "fastgør vinduer")
  photos.ts     familiebilleder (IndexedDB, kun på telefonen) til foto-balloner. Ingen billeder i repoet
  samples.ts    optagelser fra src/lyde/ (filnavn = lyd); audio.ts spiller dem og falder tilbage på synthen
  cropper.ts    ansigts-klipper i forældremenuen
  stats.ts      tællere for alt (i dag / i alt / legetid), gemt i localStorage; vises i forældremenuen
  terrain.ts    bakkernes form, delt af spil (jordhøjde til besøgende) og tegning
  update.ts     bro til android/.../AppUpdatePlugin.java (søg/hent/installér ny version fra GitHub Releases)
  palette.ts, rng.ts, types.ts, styles.css, sw.js (service worker-skabelon; udfyldes af vite.config.ts)
test/           Vitest-enhedstests (spillogik, sange)
scripts/e2e/    Playwright-røgtests mod det byggede spil (se "Test")
android/, ios/  native projekter (committes). Web-filerne kopieres ind med `npx cap sync`
assets/         kilder til app-ikon og splash (genereres med @capacitor/assets)
```

**Målarkitektur (næste skridt, se `docs/ROADMAP.md`):** flere aktiviteter bag samme baby-sikre skal.
`src/engine/` (audio, input, partikler, tegnehjælpere, forældremenu, lås), `src/activities/<navn>/` med et fælles
`Activity`-interface (`resize/update/render/press/drag/release/shake`), og en aktivitetsvælger, som forældrene styrer
fra menuen (evt. med automatisk skift). Balloner bliver den første aktivitet. Nye aktiviteter følger samme snit:
logik uden DOM (testbar), tegning for sig, events ud til lyd/haptik.

**Faste regler i koden**

- Spillogik må ikke kende DOM, canvas eller Web Audio. Den udsender events (`GameEvent`), som `main.ts` oversætter til
  lyd og vibration. Det holder logikken testbar og lydsiden udskiftelig.
- Alle størrelser skaleres med `unit` (≈1 på en telefon, ≈2 på en tablet); hastigheder med skærmhøjden.
- Trykflader er store (mindst 1,6× objektets omrids for tryk), og swipe rammer alt på vejen.
- Nye lyde laves i `audio.ts` som syntetiserede stemmer og skal have en stat i røgtesten (ikke stille, ikke klip).
  Dyr og vejr kan få en rigtig optagelse i `src/lyde/` (navne i `samples.ts`, klip med `scripts/lyd.mjs`); synthen
  bliver stående som reserve.
- Ingen billeder af familien i repoet: familiebilleder vælges på telefonen og bliver der.
- Farver fra `palette.ts`. Høj kontrast og mættede farver: det ser babyer bedst.

## Sådan arbejder vi

```bash
npm install          # første gang
npm run dev          # spil i browseren (åbn adressen på telefonen på samme wifi for at teste touch)
npm test             # enhedstests (Vitest) – skal være grønne før hver commit
npm run build        # typecheck + Vite-build til dist/
npm run test:e2e     # Playwright-røgtest af dist/ i Chromium (kræver `npx playwright install chromium` første gang)
npm run sync         # build + npx cap sync (kopierer web-filer ind i android/ og ios/)
```

Arbejdsgang for en ændring:

1. Forstå hvad Theo skal opleve (`docs/OBSERVATIONER.md` og `docs/ROADMAP.md`). Sjov først.
2. Skriv/ret logikken med enhedstests. Tegning og lyd bagefter.
3. Kør `npm test`, `npm run build` og `npm run test:e2e`. Se på skærmbillederne i `test-results/`.
4. Ændrer du native kode: byg APK'en (lokalt med Android SDK eller lad CI gøre det) og tjek at den er grøn.
5. Opdater `CHANGELOG.md` (og README hvis forældre-vejledningen ændrer sig). Commit på dansk, push.
6. CI bygger APK og webapp. Prøv på telefonen. Skriv, hvad Theo gjorde, i `docs/OBSERVATIONER.md`.

Git: én lang levende branch er fint i den private fase (standard-branchen). Commit-beskeder: dansk, første linje
under 72 tegn, brødtekst forklarer hvorfor. Commit aldrig hemmeligheder. Signeringsnøglen i `android/keystore/` er
bevidst i repoet, mens appen er privat; den skal skiftes til en privat nøgle før en offentlig udgivelse.

## Test

- **Enhedstests (Vitest, `test/`)** dækker al spillogik og musiknotation. Nye mekanikker får tests først: hvad sker
  der ved tryk, swipe, ryst, kanttilfælde (ingen balloner, loft nået, meget små/store skærme).
- **Røgtest (Playwright, `scripts/e2e/smoke.mjs`)** kører det byggede spil i en telefonstor Chromium: tryk, swipe,
  ryst (syntetiske DeviceMotion-events), forældremenu, indstillinger, fps, ingen konsolfejl, og alle lyde renderes
  offline og tjekkes for stilhed, NaN og klipning. `offline.mjs` tjekker service worker og offline-start. `live.mjs`
  tjekker den udgivne webadresse.
- **Rigtig telefon** kan ikke erstattes: lyd, vibration, fuld skærm, lås, ryst, rotation, baggrund/forgrund og batteri
  tjekkes på S21'eren efter hver udgivelse. Checkliste i `docs/RELEASE.md`.
- "Verificeret" betyder: kørt, ikke antaget. Skriv i commit/PR, hvad der faktisk er kørt, og hvad der ikke kunne.

## Udgivelse

- Hvert push kører `.github/workflows/build.yml`: tests, web-build, signeret **APK** til GitHub Releases (tag
  `latest`, versionsnummer `1.0.<build-nr>`), og webappen til **GitHub Pages** fra standard-branchen.
- Forældre installerer fra Releases (se README). Webappen ligger på <https://pthagaard.github.io/Theo/>.
- **Efter hver udgivelse skriver Claude en kort testliste til telefonen** (kun det, der er nyt eller ændret, i
  prioriteret rækkefølge) i chatten og under versionen i `CHANGELOG.md`. Forældrene tester ud fra den og skriver
  resultatet i `docs/OBSERVATIONER.md`.
- Større milepæle (fx en ny aktivitet) beskrives i `CHANGELOG.md` med dato. Versionsnummeret i
  `android/app/build.gradle`/`package.json` bumpes ved milepæle (major.minor); patch følger build-nummeret.
- Proces og checkliste: `docs/RELEASE.md`.

## Vejen til offentlig udgivelse (senere)

Når appen skal ud til andre: privat signeringsnøgle uden for git (GitHub Secrets), privatlivspolitik (ingen data
indsamles – og det skal fortsat være sandt), Google Play "Designed for Families"-krav og aldersmærkning, App Store
Kids Category-krav (Mac + Apple Developer-konto), tilgængelighed (lyd fra/til, ingen blink), oversættelse (dansk +
engelsk som minimum), og en offentlig repo-README, der fortæller hvad appen er. Intet af dette må ændre principperne
øverst.
