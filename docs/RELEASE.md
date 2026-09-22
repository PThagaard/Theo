# Udgivelse og test på telefon

## Automatisk ved hvert push

`.github/workflows/build.yml` kører tre jobs:

1. **Webapp** – `npm ci`, `npm test`, `npm run build`; `dist/` gemmes som artefakt.
2. **Webapp på GitHub Pages** – lægger `dist/` på <https://pthagaard.github.io/Theo/> (kun fra standard-branchen og
   kun når repoet er offentligt). Pages skal én gang være sat til *Source: GitHub Actions* i repo-indstillingerne.
3. **APK** – Android SDK + JDK 21, `npx cap sync android`, `./gradlew assembleRelease` signeret med
   `android/keystore/theo.keystore`, versionsnummer `1.0.<build-nr>`. Udgives som `TheosBalloner.apk` under Releases
   med tag `latest` (slettes og genskabes ved hvert build, så linket <https://github.com/PThagaard/Theo/releases/latest>
   altid peger på det nyeste). Release-noterne er det øverste afsnit i `CHANGELOG.md`, og der lægges en `version.json`
   ved siden af APK'en (version, build, dato, noter, APK-adresse), som appens *Søg efter ny version* læser.
4. **Røgtest i Chromium** – Playwright-testene fra `scripts/e2e/` mod den byggede webapp; skærmbilleder gemmes som
   artefakt.

Kør workflowet manuelt fra fanen *Actions* → *Byg app* → *Run workflow*, hvis der er brug for et nyt build uden ændringer.

## Checkliste på S21'eren efter en udgivelse

- [ ] APK'en installerer oven i den gamle uden afinstallation (samme nøgle, højere versionsnummer), helst via
      *Søg efter ny version* i forældremenuen.
- [ ] Appen starter i fuld skærm uden status- og navigationsbjælke; ikonet er rigtigt.
- [ ] Lyd og musik virker fra første tryk; lydstyrken er behagelig.
- [ ] Tryk, swipe (spor + harpe), ryst, sol og skyer reagerer; intet hakker (føles som 60 fps).
- [ ] Tilbage-swipe lukker ikke appen. Skærmen slukker ikke i løbet af 5 minutters leg.
- [ ] Forældremenu: åbner kun ved 2 sekunders tryk med én finger; en hel hånd åbner den ikke.
- [ ] Lås: "Fastgør?"-dialogen kommer; låst app spærrer Hjem/Tilbage/notifikationer; oplåsning virker (hold knappen
      eller swipe op og hold).
- [ ] Baggrund/forgrund: musikken stopper, når appen forlades, og starter igen, når den åbnes.
- [ ] Appen bliver i landscape (begge veje), også når telefonen vendes på højkant.
- [ ] Batteri: ikke mærkbart varm efter 10 minutter.

Skriv resultatet (og hvad Theo gjorde) i `docs/OBSERVATIONER.md`.

## Versionsnumre

- Patch: build-nummeret fra GitHub Actions (`1.0.<n>`). Ingen manuel handling.
- Minor/major: bump `versionName`-grundtallet i `.github/workflows/build.yml` og `version` i `package.json` ved
  milepæle (ny aktivitet, ny platform). Beskriv milepælen i `CHANGELOG.md`.

## Før en offentlig udgivelse (senere)

Ny privat signeringsnøgle i GitHub Secrets (den nuværende er offentlig), Play Console-konto, privatlivspolitik,
"Designed for Families"-gennemgang, aldersmærkning, engelsk oversættelse, testflight/App Store kræver Mac.
