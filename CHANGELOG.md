# Changelog

Alle væsentlige ændringer i Theos Legeplads. Datoer er udgivelsesdatoer (push til GitHub). Det øverste afsnit bliver
automatisk til release-noter og til "Hvad er nyt" i appens opdateringstjek.

## 2026-09-21 – opdatering inde fra appen og tempo

- **Søg efter ny version** i forældremenuen: appen spørger GitHub Releases, viser hvad der er nyt, og *Hent og
  installér* henter APK'en og åbner Androids installationsvindue. Den eneste netværksadgang i appen, og kun på et tryk.
- **Tempo** i forældremenuen: Rolig / Normal / Vild bestemmer antal balloner, hvor tit de kommer og hvor hurtigt de
  stiger. Virker med det samme, også på balloner der allerede er i luften.
- **Ansigts-klipper** til familie-balloner: vælg et billede (også et gruppebillede), træk ansigtet ind i cirklen,
  zoom med skyderen eller to fingre, gem, og klip det næste ansigt fra samme billede.
- Forældremenuen kan rulles, når den er længere end skærmen.
- Hver udgivelse har nu et versionsnummer (1.0.<build>) og en `version.json`, som appen bruger til opdateringstjekket.

**Test på telefonen:** (1) Hent og installér denne version fra GitHub én sidste gang. (2) Forældremenu → *Familie-
balloner* → *Vælg billede* → familiebilledet: træk mors ansigt ind i cirklen, zoom, *Gem ansigtet*, tryk *Nyt ansigt*
og gør det samme for far; luk. Tag Theo med *Tag et billede* eller fra galleriet. Ansigterne vises som runde
miniaturer, og balloner med dem dukker op. (3) Menuen kan rulles op og ned med fingeren. (4) *Tempo* → *Vild*: der
kommer tydeligt flere og hurtigere balloner med det samme; *Rolig* gør det roligt; valget huskes efter genstart.
(5) *Opdatering* viser "Du har version 1.0.x"; *Søg efter ny version* svarer "Du har den nyeste version". (6) Når
næste udgivelse kommer: *Søg efter ny version* → "Ny version … er klar" med "Hvad er nyt" → *Hent og installér* →
tillad installation første gang → Android installerer, og appen åbner igen med indstillinger og billeder bevaret.

## 2026-09-21

### Theos Balloner 1.0 – første udgave
- Balloner med ansigter og mønstre stiger op over en eng med sol, skyer, regnbue og blomster.
- Tryk popper (konfetti, ring, pop-lyd med pentatonisk tone), tryk på himlen puster nye balloner op, swipe popper
  alt på vejen. Fest for hver 10. ballon. Musikdåse med børnesange (public domain) og Ballonvalsen.
- Forældremenu bag 2 sekunders tryk (musik/lyde), skærmen holdes tændt, fuld skærm.
- Capacitor-projekter til Android og iOS, app-ikoner og splash.

### Distribution uden Mac
- GitHub Actions bygger en signeret APK ved hvert push og udgiver den under Releases (`latest`).
- Webappen er en installerbar PWA med offline-cache og ligger på GitHub Pages.

### Familie-balloner
- Billeder af familien (fra galleriet eller kameraet) gemmes lokalt og dukker op på hver tredje ballon. Et pop
  lader billedet springe stort frem med hjerter og en "ta-daa"-lyd.

**Test på telefonen:** (1) Forældremenu → Familie-balloner → *Vælg billede* åbner galleriet, og *Tag et billede*
åbner frontkameraet; billedet vises som rund miniature. (2) Luk menuen: inden for et minut kommer balloner med
billedet; ansigtet vender rigtigt og fylder ballonen. (3) Pop en familie-ballon: billedet springer stort frem
med hjerter og "ta-daa" og forsvinder igen efter et par sekunder. (4) Luk appen helt og åbn igen: billederne er
der stadig. (5) Fjern et billede med ✕: der kommer ikke flere balloner med det.

### Swipe, ryst og lås
- Fingerspor i regnbuefarver med harpetoner; vind fra swipes skubber balloner og skyer.
- Solen og skyerne reagerer på tryk (snurrer/"wiii", regn/"plip").
- Ryst telefonen: alt hopper, rasler og drysser konfetti.
- Lås appen fast på skærmen fra forældremenuen (Androids "fastgør vinduer"), valgfri automatisk lås ved start.
  Tilbage-knappen lukker ikke længere spillet. Forældremenuen afbrydes af flere fingre.
