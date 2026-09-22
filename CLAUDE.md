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
   netværksadgang er opdateringstjekket (kort efter start højst hver 12. time, når forældremenuen åbnes, og på
   *Søg efter ny version*), som kun taler med projektets egne GitHub Releases (sender intet andet end en almindelig
   HTTP-forespørgsel og henter højst en APK i baggrunden, som forældrene selv installerer). Ingen
   tredjeparts-SDK'er ud over Capacitor og dets officielle plugins. Det gælder også, når appen bliver offentlig.
2. **Alt, barnet rører ved, reagerer** – med bevægelse *og* lyd, inden for 100 ms. Ingen døde områder, ingen "forkert",
   ingen straf, ingen tidspres, ingen "game over". Alt kan gøres med én hel hånd, ikke kun en præcis finger.
3. **Ingen tekst, knapper eller menuer til barnet.** Alt voksen-UI ligger bag "hold nede i 2 sekunder"-porten
   (forældremenuen), som også afbrydes, hvis flere fingre rører skærmen. Undtagelsen er forsiden "Theos spil", som
   kun vises, når appen åbnes eller forældrene vælger *Skift spil*; inde i et spil findes der ingen vej tilbage til
   den. Den anden undtagelse er en lille, mat nedtælling til pausen nederst til højre (kun tal, intet at trykke på),
   som forældrene bad om.
4. **Barnet kan ikke forlade eller ødelægge noget.** Tilbage ignoreres, zoom/scroll/langt-tryk er blokeret, skærmen
   slukker ikke, appen er altid på tværs (landscape, forældrenes valg), og appen kan låses fast på skærmen
   (KidLock). Indstillinger kan kun ændres fra forældremenuen.
5. **Roligt og trygt.** Moderat lydstyrke og et kompressor-sikret miks; ingen pludselige høje eller skræmmende lyde;
   ingen hurtige blink (aldrig mere end 3 blink i sekundet på store flader); bløde, glade figurer.
6. **Sjov først, læring gennem leg.** Hver aktivitet har et udviklingsmål (`docs/ROADMAP.md`), men det må aldrig
   mærkes som undervisning. Theo bestemmer tempoet.
7. **Robusthed frem for features.** Én fejl må aldrig fryse spillet (spil-loopet fanger fejl), partikler og
   objekter har lofter, og alt skal køre glat (60 fps) på S21'eren og gerne på ældre telefoner.
8. **Al musik er public domain eller original.** Lyd syntetiseres i koden, undtagen dyrelyde og vejr, som må være
   rigtige optagelser fra `src/lyde/`, når licensen tillader fri brug (CC0, Pixabay Content License eller lignende)
   og kilden står i `src/lyde/README.md`. Synthen er altid reserve, hvis filen mangler. Grafik tegnes i kode eller er
   vores egen. Forældrenes egne lydfiler (*Jeres musik*) vælges på telefonen og bliver der, ligesom
   familiebillederne; de kommer aldrig i repoet eller i appen.

## Alderssvarende (forskningsgrundlag)

Det, vi ved: skærmen lærer ikke et barn under to år noget i sig selv. Sundhedsstyrelsen anbefaler ingen skærm
under to år uden en voksen, der deltager aktivt; WHO ingen skærmtid under ét år; AAP ingen under 18 måneder. Det
eneste, forskningen finder virker for små børn på en skærm, er *kontingens* (barnets egen handling giver et svar med
det samme) sammen med en voksen, der sætter ord på. Højt tempo, mange samtidige stimuli, pludselige lyde, lange
sessioner og skærm før sengetid er det, der skader. Kilder: Sundhedsstyrelsens anbefalinger om skærmbrug (2023/24),
WHO's retningslinjer for 0–5 år (2019), AAP's medieanbefalinger, Choi & Kirkorian (2016) og Kirkorian m.fl. (2021)
om kontingens og "video deficit". Uddybning med links og en plan pr. alder: `docs/FORSKNING.md`.

Derfor gælder for **al kode**, nu og fremover:

- **Appen er et legetøj, I bruger sammen, i korte stunder.** Ikke et læringsprogram. Dens værdi er, at Theos
  handling giver et svar, og at forældrene sætter ord på. README fortæller forældrene det.
- **Aldersprofiler er loven.** `AGE_PROFILES` i `game.ts` (`8-12` mdr er standard, `1-2` år, `2+` år) styrer, hvor
  meget der er på skærmen ad gangen, hvor hurtigt, hvor tit noget sker af sig selv, uvejr, blink og musikstyrke.
  Hver ny funktion skal svare på: hvad gør den i den yngste profil? Som regel: mindre, langsommere eller slet ikke.
  Ingen ny funktion må gøre den yngste profil travlere.
- **Kontingens frem for underholdning.** For de mindste sker det vigtige kun, når barnet rører noget. Ting, der
  starter af sig selv (besøg, uvejr, lyn), holdes få og rolige i den yngste profil.
- **Én ting ad gangen, roligt.** Bløde bevægelser, ingen skærmblink for de mindste, moderat lyd, plads til
  forældrenes stemme (musikken er lavere for de mindste).
- **Korte sessioner.** Pausen (verdenen falder i søvn efter 10 minutter, forældrene kan ændre eller slå den fra) er
  en del af produktet, ikke en detalje. Den må aldrig føles som straf: solen går ned, alt lægger sig til rette.
- **Kendte stemmer.** Forældrenes egne indtalte ord ("hund", "mor") er den sprogstøtte, der giver mening; syntetiske
  stemmer er ikke et mål. Appen har ingen syntetisk tale og ingen tekst til barnet. Ordene bruges kun i Titte-bøh og
  Ord (forældrenes beslutning); Balloner og Badekarret siger ingen ord, og indstillinger, der hører til ét spil,
  vises kun i menuen, mens det spil kører (`hasTempo`, `hasVoices` i `registry.ts`).
- **Ikke før sengetid, aldrig som trøst** og altid sammen med en voksen: det står i README, appen kan ikke sikre det.
- **Ingen "rigtigt/forkert" før 12 måneder.** Fra profilen *1–2 år* må en leg spørge efter noget ("Hvor er skyen?"),
  men alt, barnet rører, svarer venligt med sit eget navn, og det efterspurgte fejrer. Aldrig fejl-lyd, tidspres
  eller score. Gentages spørgsmålet, er det med en hjælp (tingen vrikker), ikke en rettelse.
- **Ord i profilen 8–12 mdr er titte-bøh** med familiens ansigter og få dyr bag busken; ordet siges kun i
  forældrenes stemme. Resten af tingene og "Hvor er …?" hører til fra *1–2 år*.
- **Hver aktivitet skal kunne begrundes som mindst én af tre ting:** et kontingens-legetøj (barnets handling giver
  et svar med det samme), et fælles fokuspunkt for forældrenes egen snak, eller titte-bøh/objektpermanens. Kan den
  ikke, hører den til en ældre profil.
- **Appen lover aldrig læring.** README kalder den et legetøj til fælles leg, og det skal blive ved med at være
  sandt i alt, vi skriver om den.

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
  main.ts                 skallen: forsiden "Theos spil", canvas, spil-loop (try/catch), lyd, forældremenu, lås,
                          tællere, pause, billeder og stemmer; starter og skifter spil
  engine/                 alt, aktiviteterne deler
    activity.ts           Activity-interfacet (resize/update/render/press/drag/release/shake/sleep/wake) og
                          ActivityContext (audio, stats, haptic, say, settings)
    age.ts                aldersprofiler (AGE_PROFILES) – loven for alle aktiviteter
    audio.ts              Synth (stemmer), lydeffekter, musikafspiller, forældrenes stemmer. Kan køre offline til test
    music.ts              sange (notation + kompilering til events) – rene funktioner
    samples.ts            optagelser fra src/lyde/ (filnavn = lyd); audio.ts spiller dem, synthen er reserve
    input.ts              touch/mus → press/drag/release; ryst (DeviceMotion); blokering af browser-gestus
    parent.ts             forældremenu (hold 2 sek., faner), indstillinger (localStorage), lås-knap, opdatering
    kidlock.ts, update.ts broer til android/.../KidLockPlugin.java og AppUpdatePlugin.java
    photos.ts, cropper.ts familiebilleder (IndexedDB, kun på telefonen) og ansigts-klipperen
    voices.ts             forældrenes indtalte ord og navne (MediaRecorder → IndexedDB, kun på telefonen)
    tracks.ts             forældrenes egne sange (Jeres musik: lydfiler valgt på telefonen → IndexedDB, kun der);
                          audio.ts spiller dem først i spillelisten, niveau-jævnet
    stats.ts              tællere for alt (i dag / i alt / legetid), gemt i localStorage
    rng.ts                seedbar tilfældighed og små matematikhjælpere
  activities/
    registry.ts           listen over spil (id, titel, emoji, blurb, hasTempo, create) – forsiden og menuen bruger den
    ord/                  Titte-bøh og Ord: plan pr. alder (8–12: gem bag busken; fra 1 år: én ting ad gangen og
                          "Hvor er …?"-runder), ordet i forældrenes stemme (logic.ts, render.ts låner
                          balloner/render.ts' dyr og bakker, figures.ts tegner ko, kat og bil, sounds.ts, index.ts)
    bobler/               Theos Badekar: badet (logic.ts uden DOM: bobler, vand, ænder, dråber, bølger; render.ts;
                          sounds.ts; index.ts). Samme kontingens-greb som Balloner
    trommer/              Theos Trommer: store farveflader med pentatoniske toner (logic.ts uden DOM: flader, bølger,
                          noder, hvirvel; render.ts; sounds.ts; index.ts)
    bolde/                Theos Bolde: bløde bolde i et legerum (logic.ts uden DOM: fysik med gulv, vægge, stød, tilt,
                          grib/kast; render.ts; sounds.ts; index.ts)
    lys/                  Theos Lys: en mørk nat, hvor hver berøring bliver lys (logic.ts uden DOM: stjerner, stjernestøv,
                          lygter, kontakter, månen, stjerneskud; render.ts med glød-sprites; sounds.ts; index.ts)
    balloner/             Theos Balloner
      index.ts            createBalloner(): Game + Renderer + lyd-mapping bag Activity-interfacet
      game.ts             al spillogik (besøg, vind, sol/skyer, uvejr, gården, foto-balloner, søvn). Ingen DOM →
                          enhedstestes i Node
      render.ts           tegning. Ingen spillogik her
      sounds.ts           GameEvent → lyd, vibration, tællere og forældrenes ord
      types.ts, terrain.ts, palette.ts
  lyde/                   rigtige optagelser (se README der)
  styles.css, sw.js (service worker-skabelon; udfyldes af vite.config.ts)
test/           Vitest-enhedstests (spillogik, sange, stemmer)
scripts/e2e/    Playwright-røgtests mod det byggede spil (se "Test")
android/, ios/  native projekter (committes). Web-filerne kopieres ind med `npx cap sync`
assets/         kilder til app-ikon og splash (genereres med @capacitor/assets)
```

**Sådan laves en ny aktivitet:** en mappe under `src/activities/<navn>/` med logik uden DOM (testbar), tegning for
sig og en `index.ts`, der giver et `Activity`; en linje i `registry.ts`. Aktiviteten får lyd, tællere, vibration,
forældrenes ord og indstillingerne gennem `ActivityContext` og skal svare på aldersprofilen (`engine/age.ts`), søvn
(`sleep/wake`) og familiebilleder (`setPhotos`).

**Faste regler i koden**

- Spillogik må ikke kende DOM, canvas eller Web Audio. Den udsender events (`GameEvent`), som aktivitetens
  `sounds.ts` oversætter til lyd og vibration. Det holder logikken testbar og lydsiden udskiftelig.
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

**Claude arbejder selvstændigt.** Når en ændring følger principperne og reglerne her, beslutter, bygger, tester,
udgiver Claude og skriver testlisten uden at spørge først; forældrene svarer med, hvad Theo gjorde. Claude spørger
kun ved uigenkaldelige indgreb (omskrivning af git-historik, sletning af brugerdata), ved ændringer af principperne
eller aldersreglerne, ved noget der koster penge eller kræver konti, og når to læsninger af et ønske giver helt
forskellige produkter.

Git: én lang levende branch er fint i den private fase (standard-branchen). Historikken blev omskrevet 21.9.2026
for at fjerne familiebilleder (git filter-repo); kloner fra før den dato skal hentes forfra. Commit-beskeder: dansk, første linje
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
