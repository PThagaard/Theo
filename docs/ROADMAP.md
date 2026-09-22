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
- ✅ **Familie-balloner** – mor, far og Theo på balloner (klippet på telefonen, bliver på telefonen);
  billedet springer frem ved pop. Træner: ansigtsgenkendelse, glæde ved kendte ansigter, senere ord ("Mor!") med
  egen stemme.
- ✅ **Besøg** – hund, elefant, fugl, sommerfugl, snegl og stjerneskud kommer forbi, reagerer på tryk og ryst og går
  igen. Træner: opmærksomhed og forventning ("hvem kommer nu?"), dyrelyde til ordforråd, tracking af bevægelse.
  Næste: flere dyr (kat, kanin, frø, bi), en stemme der siger dyrets navn.
- ✅ **Levende blomster** – tryk snurrer og farveskifter, swipe plukker (flyver, snurrer, vokser igen). Træner:
  årsag-virkning med to forskellige svar på to forskellige bevægelser (tryk vs. swipe).
- ✅ **Uvejrssky** – sjældent besøg (eller fremkaldt ved at holde på en sky) med regn, lyn og torden, hvor alle
  elementer reagerer (hund → hotdog, elefant → mus, fugl strutter, balloner skubbes ned og til siden, blomster
  vokser, regnbuen lyser op bagefter). Glad ansigt og sjove, ikke uhyggelige, lyde; kan trækkes rundt på himlen og
  bliver et par minutter. Træner: forventning, overraskelse, "hvad sker der nu?", at ting hænger sammen.
- ✅ **Ballonen samler dyr op** – en ballon pustet op over et dyr løfter det i snoren; det råber om hjælp, og et pop
  lader det dale roligt ned i faldskærm. Træner: kæder af årsag og virkning (min ballon → dyret hænger → mit tryk →
  det lander), omsorg ("hjælp den!").
- ✅ **Rigtige dyrelyde** – hund og elefant med optagelser fra `src/lyde/`; alle dyr og vejret kan få en. Træner:
  dyrelyde til ordforråd (rigtige lyde genkendes fra bøger og virkeligheden).
- ✅ **Gården** – et lille landbrug til højre med skorstensrøg og en gammel traktor, der kører ud og hjem, dytter ved
  tryk og kan samles op af en ballon. Træner: et fast sted, der lever (forventning: "kommer traktoren?"), køretøjer
  og maskinlyde til ordforråd, tempo-forskelle (traktoren er hurtigere end hunden).
- ✅ **Hold fingeren nede** – langt tryk på en sky gør den mørk og forvandler den til uvejrsskyen (far's idé);
  samme behov (Theo bestemmer selv, hvad der sker, ved at holde): hold på himlen, og ballonen vokser, til den
  sprænger; hold på solen, og den lader op til et solskinsbrag. Træner: en tredje bevægelse ud over tryk og swipe,
  tålmodighed og forventning ("nu sker det snart").
- ✅ **Aldersprofiler og pause** – *8–12 mdr* (standard), *1–2 år* og *2+ år* styrer, hvor meget der sker ad gangen;
  efter 5/10/20 minutter falder verdenen i søvn (solnedgang, måne, vuggevise), til en forælder vækker den. Det er
  den evidensbaserede brug af "nat": som blid slutning på en kort session, ikke som mere indhold.
- ✅ **Jeres stemmer** – mor og far indtaler ord ("hund", "ballon", "traktor") og navnene på familiebillederne
  ("Mor!", "Far!", "Theo!") i forældremenuen; appen siger ordet med jeres stemme, når Theo rører tingen eller
  popper billedet. Kendt stemme + kontingens er den sprogstøtte, forskningen peger på. Træner: ordforråd,
  genkendelse af stemmer, sammenhæng mellem ord og ting.
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

- ✅ **Titte-bøh og Ord (spil nr. 2)** – i profilen *8–12 mdr* er det titte-bøh: familiens ansigter og fire dyr
  (hund, elefant, ko, kat) gemmer sig bag busken tre ud af fire gange; rør busken, og tingen kommer frem med sin lyd
  og navnet i jeres stemme; swipe giver den næste; intet sker af sig selv. Fra *1–2 år* er det hele kortbunken
  (fugl, sommerfugl, snegl, traktor, bil, ballon, sol, sky, blomst med), én ting ad gangen, og "Hvor er …?"-runder
  (se 12–18 måneder). Træner: objektpermanens, forventning, kendte ansigter og navne. Grundlag: `docs/FORSKNING.md`.
- 💡 **Hvor er lyden?** – en lyd kommer fra en side af skærmen, og et dyr dukker op der, når man trykker. Træner:
  lyd-lokalisering, opmærksomhed.
- 💡 **Dyr og lyde** – store dyr, der siger deres lyd og navn, når de røres, og laver en lille dans. Træner: ordforråd,
  imitation (Theo siger lyden efter).
- ✅ **Badekar** (Bobler) – badet: sæbebobler stiger fra vandet; tryk popper, tryk på vandet plasker og sender nye bobler op,
  tryk på væggen giver sæbebobler, swipe popper alt på vejen og laver bølger, hold stille puster en boble op, ryst
  giver en byge, og gummiænderne rapper. Gæster som i Balloner: hvalen (gemmer sig med kun ryggen og hullet over
  vandet; tryk lader vandet ud, og den kommer glad op), koen i speedbåden, pingvinen på vandscooteren, guldfisken
  (springer; hvert tredje spring ender i en boble, der bærer den væk, medmindre den poppes), bruseren (drypper, til
  den røres; så sprøjter den, laver bobler og kan trækkes rundt; bliver længe) og isbjørnen på isflagen (vinker hej
  hej med overdrevet arm og pote, fordi Theo lærer at vinke); ryst kalder en gæst, når badet er tomt. Aldrig tomt:
  en ny boble stiger straks, når den sidste poppes. Vandet hælder, når telefonen drejes.
  Ænderne skifter farve ved tryk og suser i regnbuefarver ved hold. Familien i boblerne, stjernebobler som godbid.
  Samme kontingens som Balloner i en ny verden ("mere af det, der virker", `docs/FORSKNING.md`). Træner: hånd-øje,
  tryk og slip, at følge noget med øjnene, årsag-virkning, forventning (hvem kommer nu?).
  **Næste (forældrenes ønsker 21.9.2026):** hajfamilien (Theo-haj, Ma-Ma-haj, Da-Da-haj), når Baby Shark-løsningen
  er aftalt (spilledåse-notationen var for dårlig); rigtige optagelser af hval, pingvin og isbjørn (forældrene
  lægger dem i `src/lyde/`).
- ✅ **Musik-fane i forældremenuen** – hver sang til/fra, afspilningshastighed, næste sang. Baby Shark som
  spilledåse-notation blev prøvet og taget ud igen (forældrene: "virkelig dårlig").
- ✅ **Jeres musik** – forældrene vælger egne lydfiler på telefonen (bliver på telefonen som familiebillederne, så
  repoet forbliver rent, og princip 8 holder), som spiller i baggrunden som første sang, med egen kontakt og
  hastighed, niveau-jævnet efter spilledåsen. Vejen til Baby Shark; forældrene svarer, om det er den rigtige.
- ✅ **To hænder på skærmen** – håndfladen åbner ikke forældremenuen (store kontaktflader ignoreres af porten), og
  mange samtidige lyde bliver ikke en mur: de to første i samme øjeblik spiller fuldt, de næste svagere, aldrig
  stille.
- 💡 **Trommer** – hele skærmen er tre-fire store farveflader; hvert slag giver en tone og en bølge i fladen, og alle
  toner passer sammen (pentatonisk), så det aldrig lyder forkert; swipe giver et glissando; ryst en trommehvirvel.
  Træner: at slå og banke (det store ved 8–12 mdr), rytme, hånd-øje.
- 💡 **Bolde** – store bløde bolde, der hopper; tryk sender dem op, swipe ruller dem, ryst får dem alle til at hoppe;
  de forlader aldrig skærmen. Træner: at følge bevægelse, at forvente, hvor bolden lander.

## 12–18 måneder: matche, putte i, aflevere, simple ord og kropsdele

- 💡 **Put klodsen i hullet** – træk en form til det matchende hul (stor tolerance, snap-hjælp). Træner: form-genkendelse,
  træk-og-slip, tålmodighed.
- ✅ **Hvor er …?** (i Titte-bøh og Ord, fra profilen *1–2 år*) – hver tredje gang står to ting ved siden af
  hinanden (*2+*: hver anden gang, tre ting); jeres indtalte "hvor er" og ordet spørger efter én (ikke indtalt: en
  spørge-klokke og tingens egen lyd). Alt, han rører, siger sit eget navn; den efterspurgte fejrer med stjerner og
  hop, og så kommer den næste. Uden svar gentages spørgsmålet efter 7 sekunder, og tingen vrikker lidt (en hjælp,
  aldrig en rettelse). Ingen fejl, ingen tid, ingen score: Kirkorian, Choi & Pempek (2016) uden prøven. Senere med
  farver ("den røde"). Træner: sprogforståelse, pegen.
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
