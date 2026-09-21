# Roadmap – aktiviteter efter Theos udvikling

Theo er født i januar 2026. Aldersangivelserne er vejledende: børn udvikler sig i deres eget tempo, og en aktivitet
skal blive, så længe den er sjov. Hver aktivitet har ét tydeligt udviklingsmål, men skal først og fremmest være sjov
at trykke, swipe og ryste med. Vi bygger dét, Theo viser interesse for (se `OBSERVATIONER.md`), ikke dét, en tabel siger.

Status: ✅ færdig · 🔨 i gang · 💡 idé

## Platform (næste skridt)

- 🔨 **Aktivitets-platform:** fælles motor (`src/engine/`), `Activity`-interface, aktiviteter i `src/activities/`,
  forældrestyret valg af aktivitet i menuen, valgfrit automatisk skift hvert par minutter, og en blid overgang
  (svæv ud / svæv ind) mellem aktiviteter. Balloner flyttes ind som første aktivitet uden at ændre oplevelsen.
- ✅ **Dagbog for forældre** ("Theos leg" i menuen): tællere for alt, i dag og i alt, og legetid (kun lokalt på
  telefonen). Næste: pr. dag over tid, så man kan se hvad han foretrækker i perioder.

## 6–9 måneder: årsag og virkning, sanser, opmærksomhed

Det Theo kan: slå/klappe på skærmen, swipe med hele hånden, gribe, ryste, følge bevægelse med øjnene, reagere på
lyd og ansigter. Han lærer, at *hans* handling får noget til at ske.

- ✅ **Balloner** – tryk/swipe popper, himlen puster balloner op, fingerspor med harpetoner, sol og skyer reagerer,
  ryst ryster alt. Træner: årsag-virkning, øje-hånd, visuel tracking, rytme.
- ✅ **Familie-balloner** – mor, far og Theo på balloner (klippet på telefonen eller indbygget fra `src/familie/`);
  billedet springer frem ved pop. Træner: ansigtsgenkendelse, glæde ved kendte ansigter, senere ord ("Mor!") med
  egen stemme.
- ✅ **Besøg** – hund, elefant, fugl, sommerfugl, snegl og stjerneskud kommer forbi, reagerer på tryk og ryst og går
  igen. Træner: opmærksomhed og forventning ("hvem kommer nu?"), dyrelyde til ordforråd, tracking af bevægelse.
  Næste: flere dyr (kat, kanin, frø, bi), en stemme der siger dyrets navn.
- ✅ **Levende blomster** – tryk snurrer og farveskifter, swipe plukker (flyver, snurrer, vokser igen). Træner:
  årsag-virkning med to forskellige svar på to forskellige bevægelser (tryk vs. swipe).
- ✅ **Uvejrssky** – sjældent besøg med regn, lyn og torden, hvor alle elementer reagerer (hund → hotdog,
  elefant → mus, fugl strutter, balloner presses ned, blomster vokser, regnbuen lyser op bagefter). Træner:
  forventning, overraskelse, "hvad sker der nu?", at ting hænger sammen.
- 💡 **Ballonen samler dyr op** – en ballon pustet op over et dyr løfter det i snoren; det råber om hjælp, og et pop
  lader det dale roligt ned. 💡 **Gården** – et lille landbrug til højre med skorstensrøg og en gammel traktor, der
  kører ud og hjem og kan samles op af en ballon.
- 💡 **Rasle** – hele skærmen er en rangle: tryk giver klokker, ryst giver rasle-lyd og hoppende kugler, tilt får kuglerne
  til at rulle (accelerometer). Træner: årsag-virkning, kropslig kontrol, lyd-opmærksomhed.
- 💡 **Tromme og klaver** – store farvede felter, hvert felt en tone eller trommelyd; swipe spiller glissando. Alle
  toner er i samme skala, så det altid lyder godt. Træner: rytme, lyd/handling, tap-præcision.
- 💡 **Fisk i dammen** – rolige fisk følger fingeren, tryk laver bobler, fisk der rammes vender og siger "blub".
  Træner: visuel tracking, rolig leg (god til at falde ned før søvn).
- 💡 **Lys og mørke** – tryk tænder lygter/stjerner i en mørk himmel, som langsomt slukker igen. Høj kontrast.
  Træner: årsag-virkning, kontrast-syn.

## 9–12 måneder: objektpermanens, pegen, imitation, første ord

Det Theo kan: pege med én finger, tage og slippe, kigge efter det, der forsvinder, genkende navne på ting, pludre
efter lyde.

- 💡 **Titte-bøh** – dyr gemmer sig bag klapper, skyer og buske; tryk afslører dem med lyd og navn ("Ko! Muuh").
  Træner: objektpermanens, forventning, ordforråd.
- 💡 **Hvor er lyden?** – en lyd kommer fra en side af skærmen, og et dyr dukker op der, når man trykker. Træner:
  lyd-lokalisering, opmærksomhed.
- 💡 **Dyr og lyde** – store dyr, der siger deres lyd og navn, når de røres, og laver en lille dans. Træner: ordforråd,
  imitation (Theo siger lyden efter).
- 💡 **Bobler** – bobler stiger langsomt; tryk popper dem; swipe laver en boblesky. Roligere søskende til Balloner.

## 12–18 måneder: matche, putte i, aflevere, simple ord og kropsdele

- 💡 **Put klodsen i hullet** – træk en form til det matchende hul (stor tolerance, snap-hjælp). Træner: form-genkendelse,
  træk-og-slip, tålmodighed.
- 💡 **Find den røde** – "Hvor er den røde ballon?" med dansk tale (vores egen indtalte stemme eller syntetisk),
  al respons positiv. Træner: farver, sprogforståelse.
- 💡 **Kroppen** – tryk på en figurs næse/mave/fødder; figuren siger navnet og reagerer sjovt. Træner: kropsdele, ord.
- 💡 **Byg og vælt** – stabl klodser med tryk, swipe vælter tårnet med brag og latter. Træner: årsag-virkning-kæder,
  forventningsglæde.

## 18–24 måneder: sortere, størrelser, tælle til 3, sange med fagter

- 💡 **Sortér** – sæt ens ting sammen (farve, form, dyr). 💡 **Stor og lille**. 💡 **Tæl med** – 1, 2, 3 dyr dukker op,
  vi tæller højt sammen. 💡 **Sangbog** – de sange, musikafspilleren allerede kan, med figurer der viser fagterne.

## 2–3 år: navne på farver/former, tælle til 5, hukommelse, simple regler

- 💡 **Vendespil light** (2–4 par). 💡 **Male** – finger-maling med regnbuespor og stempler. 💡 **Køre bil** – styr en
  bil med tilt, saml ting op. 💡 **Rim og remser** med figurer.

## 3+ år: bogstaver, tal, puslespil, historier

- 💡 Bogstav-jagt, tal-puslespil, "Theos bog" (billeder og ord fra hans egen verden), tegne og gemme tegninger.

## Tekniske ideer, der løfter alle aktiviteter

- 💡 **Egen stemme:** far/mor indtaler ord og navne (lokal optagelse i forældremenuen), så ordforrådsspil taler med
  velkendte stemmer. Kun gemt på telefonen.
- 💡 **Tilt (accelerometer)** som styring: kugler ruller, vand skvulper.
- 💡 **Kamera-selfie** som ansigt på en ballon (kun lokalt). Kræver kamera-tilladelse; overvej nøje.
- 💡 **Rolig-tilstand** i forældremenuen: langsommere, dæmpede farver og vuggeviser til aftenbrug.
- 💡 **Tablet-layout** når der kommer en tablet i huset.
