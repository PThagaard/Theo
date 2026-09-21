# Changelog

Alle væsentlige ændringer i Theos Legeplads. Datoer er udgivelsesdatoer (push til GitHub). Det øverste afsnit bliver
automatisk til release-noter og til "Hvad er nyt" i appens opdateringstjek.

## 2026-09-21 – levende blomster

- **Tryk på en blomst:** den snurrer rundt og skifter farver gennem regnbuen i 4–5 sekunder med en lille
  snurre-lyd og gnister.
- **Swipe hen over blomsterne:** de plukkes med et "plop", flyver op i luften i swipe-retningen, snurrer rundt og
  daler ned; et par sekunder senere vokser de op igen. Ryst får blomsterne til at vrikke.
- Tælles i "Theos leg" (blomster snurret / plukket).

**Test på telefonen:** (1) Tryk på en blomst nederst: den snurrer og skifter farver et par sekunder. (2) Swipe langs
blomsterne: de flyver op og snurrer, og der er kun en stub tilbage, indtil de vokser op igen efter ca. 3 sekunder.
(3) Ryst: blomsterne vrikker.

## 2026-09-21 – tællere for alt

- **Theos leg** i forældremenuen: tabel med *i dag* og *i alt* for balloner poppet (og heraf familie-, stjerne- og
  regnbueballoner), balloner pustet op, balloner blæst væk, swipes, harpetoner, tryk på himlen, solen, skyerne, ryst,
  fester, besøg set og rørt (pr. dyr) og hver person i familien poppet. Legetid i dag og i alt (kun tiden lige efter
  et tryk tæller, så en glemt tændt telefon ikke tæller med). *Nulstil* kræver 2 sekunders tryk. Tallene bliver kun
  på telefonen.
- Nye hændelser i spillet til tælling: swipe (finger løftet efter mindst 60 px) og "blæst væk" (én gang pr. ballon
  pr. swipe).

**Test på telefonen:** (1) Leg et minut, åbn forældremenuen og rul til *Theos leg*: tallene passer nogenlunde med det,
der skete (balloner, swipes, dyr, familie). (2) Luk appen helt og åbn igen: tallene er der stadig, og "i dag" tæller
videre. (3) Hold *Nulstil tællere* nede: alt går i nul.

## 2026-09-21 – familien som standard, til/fra-kontakt og bedre dyrelyde

- Mor, far og Theo er lagt ind som indbyggede familiebilleder (renset for metadata). Foto-balloner har en blød vignet,
  så baggrunden toner over i ballonens farve og ansigtet træder frem.
- **Vis familien på balloner** kan slås til og fra i forældremenuen (gælder både indbyggede og egne billeder).
- Rettet: en finger, der gled hen over hunden, fik den til at gø 60–120 gange i sekundet (lød som en hurtig brummen).
  Alle besøgende reagerer nu højst hvert 0,35 sekund.
- Ny gøen og ny elefant-trut: lagt højere i tonelejet, fordi telefonhøjttalere næsten ikke gengiver toner under
  ca. 300 Hz. Elefanten trutter nu i knap 2 sekunder med messingklang og pust; hunden siger "vov vov" med bid i.
- Script til at fjerne metadata fra billeder før de lægges i repoet (`scripts/strip-photos.mjs`).

**Test på telefonen:** (1) Uden at gøre noget dukker mor, far og Theo op på balloner (ca. hver tredje); ansigtet er
tydeligt, baggrunden toner ud i ballonfarven. (2) Forældremenu → *Vis familien på balloner* fra: der kommer ingen
foto-balloner; til igen: de kommer tilbage. (3) Swipe frem og tilbage hen over hunden: den gør i et naturligt tempo,
ikke som en brummen. (4) Tryk på elefanten: en lang, tydelig trut, der kan høres på telefonens højttaler.

## 2026-09-21 – besøg af dyr og indbyggede familiebilleder

- **Besøg:** hvert 15.–30. sekund kommer der nogen forbi (højst to ad gangen): en hund, der går over græsset og
  hopper med tungen ude og gør "vov vov", når den røres; en elefant, der kigger op bag bakken med en dyb brummen og
  trumpeterer med snablen i vejret; en fugl, der flyver forbi og slår en kolbøtte med "pip pip"; en sommerfugl, der
  flagrer mellem blomsterne; en snegl, der langsomt kravler forbi og gemmer sig i sit hus med et "blub"; og af og
  til et stjerneskud, der eksploderer i stjerner. Alle reagerer også på et ryst. Bygget som ét besøgssystem, så nye
  dyr er nemme at tilføje.
- **Indbyggede familiebilleder:** billeder i mappen `src/familie/` bliver automatisk til familie-balloner i alle
  udgaver (se `src/familie/README.md` for format). De vises med blå kant i forældremenuen og kan ikke fjernes der.
- Mor, far og Theo er lagt ind som indbyggede billeder (renset for metadata, 600 × 600). Foto-balloner har fået en
  blød vignet, så billedets baggrund toner over i ballonens farve, og ansigtet træder frem.
- Røgtesten fejler nu, hvis siden logger fejl (og fotograferer de besøgende).

**Test på telefonen:** (1) Vent op til et halvt minut: der kommer et dyr. Rør det: hunden hopper og gør, elefanten
trumpeterer, fuglen slår en kolbøtte, sneglen gemmer sig, sommerfuglen flagrer væk, stjerneskuddet springer. (2) Ryst
telefonen mens der er besøg: de reagerer. (3) Dyrene går/svæver væk igen af sig selv, og der kommer nye. (4) Mor,
far og Theo dukker op på balloner uden at gøre noget på telefonen (ca. hver tredje ballon), og vises med blå kant i
menuen. Ansigterne skal være tydelige, og baggrunden tone ud i ballonens farve.

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
