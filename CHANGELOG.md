# Changelog

Alle væsentlige ændringer i Theos Legeplads. Datoer er udgivelsesdatoer (push til GitHub). Det øverste afsnit bliver
automatisk til release-noter og til "Hvad er nyt" i appens opdateringstjek.

## 2026-09-22 – Altid på tværs, og uvejrsskyen kan gøres god igen

- **Appen kører altid i landscape** (forældrenes ønske): Android låser til landscape (begge veje), iOS ligeså, og
  webappen beder browseren om det, når den er installeret. Forsiden viser spillene i to kolonner, og alle spil
  tegner sig efter den brede skærm (trommerne som søjler, badet og legerummet lavere). Røgtesten kører nu på en
  telefon på tværs.
- **Uvejrsskyen bliver god igen ved et langt tryk** (forældrenes ønske): hold fingeren stille på uvejrsskyen lige
  så længe, som det tog at fremkalde den, og den lyser op, grinet bliver bredere, regnen holder op, regnbuen
  kommer, og en hvid sky driver videre fra samme sted. Flytter fingeren sig, eller slipper den for tidligt, bliver
  den mørk igen. Tæller under *Theos leg*: "… gjort gode igen ved at holde på uvejrsskyen".

**Test på telefonen:** (1) Vend telefonen på højkant: appen bliver på tværs. Forsiden viser fem spil i to
kolonner. (2) Balloner: hold på en hvid sky, til uvejret kommer; hold så stille på uvejrsskyen, til den er hvid
igen: regnen stopper, regnbuen kommer. (3) Kig alle fem spil igennem på tværs, og sig, hvis noget ser forkert ud.

## 2026-09-22 – Theos Bolde: spil nr. 5, bløde bolde at gribe, kaste og jagte

- **Theos Bolde** er nyt på forsiden: et legerum med store, bløde bolde med ansigter (tre for *8–12 mdr*, fem for
  *1–2 år*, seks for *2+ år*), som hopper og ruller og aldrig forlader skærmen. **Rør en bold**: den klemmes
  sammen, bliver glad og hopper, når fingeren slipper hurtigt. **Hold fast og flyt hånden**: bolden følger med, og
  når hånden slipper, flyver den den vej, hånden kastede. **Tryk på måtten**: den er en trampolin, og boldene
  tæt på hånden hopper. **Swipe**: skubber de bolde, hånden passerer. **Ryst**: alle bolde hopper med en rangle.
  **Drej telefonen**: boldene ruller ned mod den lave side. Boldene støder ind i hinanden, klemmes ved stød og
  siger "bop", når de lander hårdt nok; kigger den vej, de flyver. Hvert tiende tryk hopper alle med fanfare.
  Familien får ansigter på boldene (én pr. billede).
- For de mindste sker intet af sig selv; fra 1 år hopper en bold selv nu og da. At gribe, slippe og kaste er
  det, 8–12 måneder handler om (`docs/ROADMAP.md`); at følge bolden med øjnene og gætte, hvor den lander, kommer
  lige efter. Tællere under *Theos leg*: bolde rørt, kastet, hoppet, gulvet trampet, skubbet, rystet, fester.

**Test på telefonen:** (1) Forsiden → *Theos Bolde*. Rør en bold: den hopper. Hold fast, flyt hånden og slip:
den flyver med. (2) Tryk på den grønne måtte: boldene ved hånden hopper. (3) Swipe gennem boldene. (4) Ryst.
(5) Drej telefonen langsomt: boldene ruller ned mod den lave side. (6) Alder *8–12 mdr*: tre store bolde, intet
sker af sig selv. Sig, om "bop"-lyden og hoppene passer i styrke, og hvad Theo gør.

## 2026-09-22 – Theos Trommer: spil nr. 4, det store slå-og-banke-legetøj

- **Theos Trommer** er nyt på forsiden. Hele skærmen er store farveflader (tre for *8–12 mdr*, fire for *1–2 år*,
  fem for *2+ år*), og hvert slag giver en tone fra en pentatonisk skala, så det altid lyder som musik, hvor hårdt
  og hvor mange steder han end slår. Fladen dupper ned og springer tilbage, en bølge breder sig fra hånden, og små
  noder flyver op. **Swipe** hen over fladerne: de synger én ad gangen (glissando). **Hold hånden stille** på en
  flade: den laver en trommehvirvel og hviler efter tre sekunder, til hånden løftes og lægges igen. **Ryst
  telefonen**: en hvirvel over alle flader, ned og op igen. Hvert sjette slag sender et familieansigt op på en
  node, hvis I har billeder. At slå og banke er det store ved 8–12 måneder (`docs/ROADMAP.md`), og fladerne er
  store nok til en hel hånd.
- Ingen blink: en flade lyser højst op tre gange i sekundet, hvor hurtigt han end slår; bølgerne og noderne svarer
  på hvert eneste slag. Lyden er en blød tromme med en varm marimba-tone; mange samtidige slag dæmpes af
  lydmur-værnet. Tællere under *Theos leg*: trommeslag, swipes, hvirvler, ryst og familien på noderne.

**Test på telefonen:** (1) Forsiden → *Theos Trommer*. Slå på fladerne med hele hånden, også hurtigt og flere
steder: det skal lyde godt og ikke blinke. (2) Swipe op og ned over fladerne. (3) Læg hånden stille: hvirvel.
(4) Ryst telefonen. (5) Alder *8–12 mdr*: tre store flader; *2+ år*: fem. Sig, om lyden passer i styrke med
resten, og hvad Theo gør.

## 2026-09-22 – Jeres musik fra telefonen, og ingen lydmur ved mange fingre

- **Jeres musik** (forældremenuen → *Musik* → *Vælg sang på telefonen*): vælg en lydfil på telefonen (fx jeres
  Baby Shark), og den bliver en sang i appen: den står først i listen, spiller med det samme, har sin egen kontakt,
  følger *Hastighed*, og spiller først, hver gang musikken starter. Lydstyrken jævnes ud efter appens egen musik,
  så en høj popsang ikke overdøver legetøjet. Filen gemmes kun på telefonen, ligesom familiebillederne, og kommer
  aldrig i repoet (princip 8 holder: appen selv har kun fri musik). Der er plads til 10 sange; fjern med ✕. Det er
  vores forslag til løsningen på Baby Shark; sig til, hvis I vil have det anderledes.
- **Ingen lydmur ved mange fingre** (forældrene: "Theo har tit begge hænder på skærmen"): når flere lyde starter
  inden for samme øjeblik, spiller de to første med fuld styrke og de næste svagere, aldrig stille. Alt svarer
  stadig med bevægelse og lyd; det bliver bare ikke en mur.

**Test på telefonen:** (1) Menu → *Musik* → *Vælg sang på telefonen*: vælg jeres Baby Shark. Den skal stå øverst og
spille straks. Luk menuen: spillet kører videre til sangen. Sæt *Hastighed* til *Hurtig*: sangen følger med. Slå den
fra og til igen. Genstart appen: sangen er der stadig og spiller først. (2) Sig, om lydstyrken passer til resten.
(3) Læg hele hånden på ballonerne eller boblerne nogle gange: det skal lyde som leg, ikke som en mur.

## 2026-09-21 – Hvalen gemmer sig, guldfisken i en boble, bruseren bliver, og isbjørnen vinker

- **Hvalen er tegnet om** (forældrene: "ikke godkendt, grim"): nu en tegneserie-hval med stort rundt hoved, blå
  ryg med pletter, lys mave, halen i vejret og et hul på toppen, som på jeres billeder. Og den **gemmer sig**: den
  kommer op, så kun ryggen og hullet stikker op af vandet, og venter der (med små bobler fra hullet nu og da som
  en lille hjælp). Rører man den, lader den vandet ud i en fontæne, rejser sig op af vandet med et plask og sit
  kald, glad for hjælpen, og bliver så en stund og sprøjter igen ved hvert tryk. Rører ingen den, synker den stille
  væk igen; de mindste får længst tid til at finde den (40 sekunder), og for dem sker der intet, før de rører.
- **Guldfisken** (forældrene: "fantastisk"): det underlige vand under den er væk. Ingen gæst har længere en tonet
  stribe ned gennem vandet; den del af en gæst, der er under vandet, ses i stedet svagt gennem vandet. Og nu kan
  den **springe op i en boble**: andet spring, og derefter hvert tredje, ender i toppen af buen inde i en boble, som
  langsomt bærer fisken opad. Popper I boblen, falder fisken tilbage i vandet med et plask; ellers svæver den ud
  af skærmen med boblen, og fisken er væk til næste besøg.
- **Bruseren gør mere og bliver meget længere** (forældrene: "der skete ikke nok; 10 sekunder kunne sagtens være
  100"): den hænger nu og drypper stille (et lille plip nu og da), til man rører den; så sprøjter den kraftigt i fem
  sekunder, skumbobler stiger op, hvor strålen rammer vandet, og ænder under strålen rapper og hopper. **Træk i
  den**, og brusehovedet følger fingeren rundt i badet, mens det sprøjter. Den bliver 60 sekunder (45 for de
  mindste), og hvert tryk giver den 12 sekunder mere, op til 2½ minut: jo mere der leges med den, jo længere bliver
  den. Fra 1 år sprøjter den også af sig selv nu og da; for de mindste kun ved tryk.
- **Isbjørnen på isflagen** (forældrene: Theo lærer at vinke og sige "hej hej"): en ny gæst. En isflage driver
  langsomt hen over vandet med en hvid bjørn, der sidder og kigger på jer. Når den kommer ind på skærmen, vinker den
  hej: hele armen op og en stor, overdrevet pote, der vifter frem og tilbage. Den vinker igen, når man rører den
  (med et venligt "brum-brum" og et lille hop på flagen), og nu og da af sig selv (for de mindste kun sjældent).
  Læg `isbjoern.mp3` i `src/lyde/`, hvis I finder en venlig bjørnelyd; ellers bruges synthen.
- **Baby Shark er taget ud af spillelisten** (forældrene: "virkelig dårlig"). En anden løsning aftales i morgen
  (forslag: jeres egen musik fra telefonen, som bliver på telefonen ligesom familiebillederne). Hajfamilien i
  badekarret venter på det.
- Nye tællere under *Theos leg*: isbjørnen rørt, fisken fløjet væk i en boble, og poppet fri igen.

**Test på telefonen:** (1) Badekar: vent på hvalen (eller ryst telefonen, når der ingen gæst er): kun en blå ryg
med et hul stikker op af vandet. Rør den: fontæne, plask, kald, og den rejser sig glad op. Rør den igen: sprøjt.
Sig, om den nye hval er godkendt. (2) Rør guldfisken to gange: andet spring ender i en boble. Pop boblen: fisken
falder ned i vandet. Prøv også at lade boblen svæve væk. (3) Bruseren: den drypper, til I rører den; så sprøjter
den, og der kommer bobler. Træk den rundt med fingeren og hen over en and. Hold øje med, hvor længe den bliver.
(4) Isbjørnen: vent, til den vinker, og vink tilbage sammen med Theo; rør den, og den vinker igen med brum-brum.
(5) Alder *8–12 mdr*: hvalen venter længe, bruseren sprøjter kun ved tryk, bjørnen vinker sjældent af sig selv.

## 2026-09-21 – Musik-fanen, Baby Shark, nedtælling til pausen og håndflade-værn

- **Ny fane i forældremenuen: Musik.** Hver sang har sin egen kontakt (slå fra dem, I er trætte af), *Hastighed*
  (Langsom / Normal / Hurtig) gælder alle sange, *Næste sang* springer videre, og der står, hvad der spiller. Slår
  man alle sange fra, spiller appen alligevel dem alle (musikken har sin egen kontakt under *Leg*).
- **Baby Shark er første sang.** Den traditionelle melodi er skrevet ind som noder og spilles af appens egen
  spilledåse (ingen optagelse, ingen sang). Den spiller først, hver gang musikken starter.
- **Nedtælling til pausen**: når *Pause efter* er slået til, står der en lille, mat tid nederst til højre (fx 7:12),
  så I kan se, hvor længe der er igen. Den forsvinder i menuen, på forsiden og når verdenen sover. Det er den
  eneste tekst på Theos skærm, og der er intet at trykke på.
- **To hænder på skærmen**: en håndflade eller en hel hånd i hjørnet kan ikke længere åbne forældremenuen (store
  kontaktflader starter ikke porten; flere fingre afbrød den i forvejen). Alle tryk svarer stadig hver for sig.

**Test på telefonen:** (1) Menu → *Musik*: Baby Shark øverst; slå en sang fra; sæt *Hurtig*; tryk *Næste sang*.
Luk menuen: musikken starter med Baby Shark. (2) *Leg* → *Pause efter* → *5 min*, luk menuen: en lille tid tæller
ned nederst til højre. (3) Læg håndfladen på hjørneknappen i tre sekunder: menuen åbner ikke; en fingerspids i to
sekunder åbner den stadig.

## 2026-09-21 – Gæster i badekarret: hvalen, koen i speedbåden, pingvinen på vandscooteren, fisken og bruseren

- **Badekarret får besøg**, ligesom Balloner: nu og da kommer en gæst, i vandet eller i luften, og alle svarer på
  et tryk. *Hvalen* dukker op med et plask, står og ryster ved overfladen og sprøjter en fontæne ud af toppen, når
  man trykker på den; efter en stund dykker den. *Koen i speedbåden* kører hen over vandet, hopper over bølgerne
  og efterlader skum; tryk, og den siger muh og dytter. *Pingvinen på vandscooteren* suser forbi med sprøjt; tryk,
  og den skræpper og laver et hop. *Fisken* svømmer lige under overfladen og springer i en bue med plask, når man
  trykker (fra 1 år også af sig selv). *Bruseren* svinger ned fra oven og sprøjter dråber, der bølger vandet og
  skubber til boblerne; tryk, og den sprøjter ekstra. Ryst telefonen, når badet er tomt, og en gæst kommer straks
  (Theos egen handling kalder hvalen op). For *8–12 mdr* kommer der én gæst ad gangen og sjældent, fisken
  springer kun, når han rører den, og bruseren drypper roligt.
- Hvalens kald og pingvinens skræp er syntetiske indtil videre; læg `hval.mp3` og `pingvin.mp3` i `src/lyde/`
  (fx fra Pixabay), så bruges de. Speedbåden bruger traktorens motor og horn, vandscooteren motoren i højt tempo.
- **Familien oftere i boblerne**: hver anden-tredje nye boble bærer et billede (før hver femte), og de bobler, Theo
  selv laver ved at plaske på vandet, kan også være familien. Billedbobler er altid store nok til, at ansigtet ses.
- **Stjernebobler er nu en lille godbid**: pop en, og der kommer guldgnister, en pust af små guldbobler, og ænderne
  snurrer. Tællere for bobler, stjerner, billeder, plask, ænder, gæster m.m. står under *Theos leg*.
- **Menuen følger spillet**: familie-afsnittet hedder "Familien i boblerne", "på balloner" eller "i Ord" alt efter
  det spil, der kører (før stod der "balloner" i alle spil). Billederne bruges i alle tre.
- **Aldrig et tomt badekar** (forældrene: "der sker ikke noget i 10 sekunder"): i det øjeblik den sidste boble er
  poppet, stiger en ny op med det samme, i den modsatte side af der, hvor han poppede. Er under halvdelen tilbage,
  kommer den næste hurtigere.
- **Vandet følger telefonen**: drej telefonen, og vandet hælder som rigtigt vand, med et lille skvulp; ænderne
  driver ned mod den lave side, og boblerne trækker mod den høje. Aldrig mere end ca. 25 graders hældning.
- **Anden skifter farve ved tryk** (gul, lyserød, blå, grøn, lilla, orange), og **holder man fingeren på den**, går
  den i regnbuefarver (glidende, ingen blink) og suser frem og tilbage i badet i seks sekunder med plask i enderne,
  mens dens kølvand skubber til boblerne. Ænderne svømmer også lidt raskere til daglig.
- Den hvide kant i bunden af skærmen (badekarrets forkant, som lignede en fejl) er væk; vandet går helt ned.
- Nye tællere under *Theos leg*: gæster i badekarret, og hvem der er rørt.

**Test på telefonen:** (1) Badekar: vent et halvt minut, eller ryst telefonen, når der ingen gæst er. Rør hvalen,
når den står og ryster: fontænen. Rør koen i speedbåden: muh og dyt. Rør pingvinen: skræp og hop. Rør fisken: den
springer. Rør bruseren: ekstra sprøjt. (2) Plask på vandet nogle gange: familien dukker op i boblerne. Pop en
stjerneboble: guldbobler og snurrende ænder. (3) Menu → *Familie*: overskriften siger "Familien i boblerne". (4) Pop alle bobler: en ny kommer straks i den
anden side. Tryk på anden: ny farve. Hold fingeren på anden: regnbuetur. (5) Drej telefonen langsomt til siden:
vandet hælder og skvulper; løber det den forkerte vej, så sig til. (6) Alder *8–12 mdr*: kun én gæst ad gangen, og
fisken springer kun ved tryk. Sig til, hvilke gæster Theo kigger efter.

## 2026-09-21 – Rigtige lyde til alle dyr og vejret, og "Theos Badekar"

- **De syntetiserede dyrelyde er skiftet ud med optagelser** (forældrene: "de er helt off"): ko og kat fra jeres
  Pixabay-filer; and, fugl (solsort), traktor (gammelt "ahooga"-horn), traktor-motor, torden, regn og bil (gammelt
  bilhorn) fra BigSoundBank, som udgiver under CC0 og kan hentes direkte. Kilder og klip står i `src/lyde/README.md`.
  Synthen er stadig reserve, hvis en fil mangler. Sommerfuglen og sneglen har ingen rigtig lyd og beholder deres
  små syntetiske lyde.
- **Spil nr. 3 hedder nu "Theos Badekar"** (forældrenes forslag).
- **Forældrenes ord bruges kun i Titte-bøh og Ord.** Balloner og Badekarret siger ikke længere "ballon", "hund" eller
  navnet på et familiebillede ved tryk (forældrene: "det var aldrig planen"); der er kun lyde. *Jeres stemmer* vises
  derfor kun i menuen, mens Ord kører, og ordlisten er Ords ting plus *Hvor er …?* (regn, lyn, boble, and og vand er
  taget ud).

**Test på telefonen:** (1) Balloner: rør hunden, elefanten, fuglen, traktoren (horn), og lad traktoren køre ud
(motor). Hold på en sky, til uvejret kommer: regn og torden er nu optagelser. Ingen ord siges. (2) Ord: rør koen,
katten og bilen; her siges jeres ord stadig. Menu → *Familie*: *Jeres stemmer* findes kun her. (3) Badekar: rør
anden. Sig til, hvis en lyd er for høj eller for lav i forhold til de andre.

## 2026-09-21 – Theos Bobler: badet, hvor alt svarer

- **Nyt spil: Theos Bobler.** Samme greb som Balloner, fordi det er dem, en 8 måneders kan bruge (kontingens, se
  `docs/FORSKNING.md`), i en ny verden: badet. Sæbebobler stiger langsomt op fra vandet med regnbueskær. Tryk på en
  boble: den popper med et vådt plop og drypper. Tryk på vandet: plask, bølger og to nye bobler netop dér. Tryk på
  væggen: en lille sky af sæbebobler. Swipe: popper alt på vejen, skubber resten, efterlader et spor af små bobler,
  og langs vandet laver fingeren bølger, som ænderne gynger på. Hold fingeren stille: en boble vokser under den og
  svæver væk, når du slipper; holder du for længe, revner den med et brag. Ryst telefonen: alt hopper, ænderne
  snurrer, og en byge af små bobler stiger op. Gummiænderne rapper og snurrer, når de røres. Hver tiende boble: en
  stille boble-byge. Familiebilleder svæver med i bobler nu og da; pop dem, og billedet plasker i vandet, mens
  navnet siges. *Tempo* og *Alder* gælder som i Balloner: for *8–12 mdr* få bobler, én and, små byger.
- *Jeres stemmer* har fået *Boble*, *And* og *Vand*. En rigtig andelyd kan lægges i `src/lyde/and.mp3`.
- Flere spil af samme slags står som ideer i `docs/ROADMAP.md`: *Trommer* (slå på store farveflader, alt lyder godt)
  og *Bolde* (hoppebolde, der aldrig forsvinder).

**Test på telefonen:** (1) Forsiden → *Theos Bobler*. Tryk på en boble: plop. Tryk på vandet: plask og nye bobler.
Tryk på anden: rap og snur. (2) Swipe hen over boblerne og langs vandet. (3) Hold fingeren stille på vandet i to
sekunder: boblen vokser; slip, og den svæver op. Hold længere: den revner. (4) Ryst telefonen: byge af bobler.
(5) Alder *8–12 mdr*: roligt, få bobler, én and. Lyt efter, om plask og rap er for høje.

## 2026-09-21 – Titte-bøh for de mindste, og "Hvor er …?" fra 1 år

Efter forskningsnoten (`docs/FORSKNING.md`) og forældrenes "ja, lav 1, 2 og 3":

- **Spil nr. 2 hedder nu "Theos Titte-bøh og Ord" og retter sig efter alderen.** I *8–12 mdr* er det titte-bøh:
  jeres familiebilleder og fire dyr (hund, elefant, ko, kat) gemmer sig bag busken tre ud af fire gange; rør busken,
  og tingen kommer frem med sin lyd og navnet i jeres stemme. Intet sker af sig selv. Resten af tingene venter til
  *1–2 år*.
- **"Hvor er …?" fra 1 år**: hver tredje gang (*2+*: hver anden) står to (tre) ting ved siden af hinanden, og jeres
  indtalte stemme spørger efter én: "hvor er" + ordet (ikke indtalt: en lille spørge-klokke og tingens egen lyd,
  så man kan finde den, der siger "vov vov"). Alt, Theo rører, svarer med sit eget navn; den efterspurgte fejrer med
  stjerner og hop, og så kommer den næste. Uden svar gentages spørgsmålet efter 7 sekunder, og tingen vrikker lidt
  (en hjælp, aldrig en rettelse). Ingen fejl, ingen tid, ingen point. *Jeres stemmer* har fået rækken *Hvor er …?*
- **Fem regler i CLAUDE.md** ("Alderssvarende"): ingen rigtigt/forkert før 12 måneder, titte-bøh for de mindste,
  hvad en aktivitet skal kunne begrundes med, appen lover aldrig læring, og aldrig alene, før sengetid eller som
  trøst.

**Test på telefonen:** (1) Alder *8–12 mdr*, forsiden → *Theos Titte-bøh og Ord*: en busk. Rør den: titte-bøh med
lyd og navn; rør tingen igen: den siger navnet. Swipe: den næste gemmer sig igen; hver fjerde står frit. Kun hund,
elefant, ko, kat og jeres billeder. (2) *Familie* → *Jeres stemmer*: indtal *Hvor er …?* (sig "hvor er").
(3) *Leg* → *Alder* → *1–2 år*: swipe, til to ting står ved siden af hinanden, og I hører "hvor er … hund". Rør den
anden: den siger sit navn, intet andet sker. Rør hunden: stjerner, hop, og den næste kommer. Vent 7 sekunder uden at
røre: spørgsmålet igen, og hunden vrikker. (4) Sæt alderen tilbage til *8–12 mdr*, før Theo får telefonen.

## 2026-09-21 – Forskningsnote og revideret plan; ko, kat og bil i Ord

- **`docs/FORSKNING.md`**: hvad forskningen faktisk siger om skærm og apps til børn under to år (Sundhedsstyrelsen,
  WHO, AAP, Kuhl 2003, DeLoache 2010, Kirkorian 2016, Takahashi 2023 m.fl.), og hvad det betyder for Theos spil.
  Kort: ingen app lærer en 8 måneders noget i sig selv; det, der virker, er kontingens (Balloner), titte-bøh,
  familiens ansigter og jer, der sætter ord på. Ord i sin nuværende form er en talende billedbog, ikke et
  læringsspil. En plan pr. alder, med forslag til Ord, ligger i noten og i `docs/ROADMAP.md` og afventer forældrene.
- **Tre nye ting i Ord**: en ko (siger muh og løfter hovedet, klokken dingler), en kat (mjaver med glade, lukkede
  øjne og logrer med halen) og en lille blå bil (dytter, lyser med lygten og hopper på hjulene). Ordene *ko*,
  *kat* og *bil* kan indtales under *Jeres stemmer*. Rigtige lyde kan lægges i `src/lyde/` som `ko.mp3`, `kat.mp3`
  og `bil.mp3`; ellers laver appen dem selv.
- **Busken driller lidt** for *1–2 år* og *2+ år*: første tryk får den til at rasle og hoppe ("hmm?"), andet tryk
  åbner den. For *8–12 mdr* åbner den stadig ved første tryk: her skal svaret på Theos tryk komme med det samme.

**Test på telefonen:** ingen test nødvendig i denne version; planen skal besluttes først. Vil I se koen, katten og
bilen: Ord → swipe, til de kommer; rør dem (muh, mjav, dyt-dyt). Med alder *2+ år* rasler busken ved første tryk og
åbner ved andet.

## 2026-09-21 – Theos spil: en forside, og flere ting i Ord

- **Forsiden "Theos spil"**: når appen åbner, vælger man spillet på store felter: *Theos Balloner* eller *Theos Ord
  og Billeder*. Spillene har ingen vej tilbage til forsiden (Theo kan ikke forlade dem); forældremenuen → *Leg* →
  *Skift spil* fører tilbage. Menuen viser, hvilket spil der kører, og *Tempo* vises kun i Balloner, hvor den
  hører hjemme. Alder, pause, musik og lyde gælder begge spil.
- **Appen hedder nu "Theos spil"** (ikonet på telefonen, webappen og overskriften i forældremenuen); *Theos
  Balloner* er navnet på det første spil. Indstillinger, tællere, billeder og stemmer bevares ved opdateringen.
- **Flere ting i Ord**: solen (snurrer og kniber øjnene sammen ved tryk), en sky (regner ved tryk) og en stor
  blomst (snurrer i regnbuefarver). Ordene *sol*, *sky* og *blomst* kan indtales under *Jeres stemmer*.

**Test på telefonen:** (1) Ikonet hedder *Theos spil*. Åbn appen: forsiden med to felter. Tryk *Theos Ord og Billeder*: spillet starter med
lyd fra første tryk. (2) Hold hjørneknappen → *Leg*: øverst står spillets navn og *Skift spil*; *Tempo* er væk.
Tryk *Skift spil*: forsiden igen; vælg *Theos Balloner*: *Tempo* er tilbage. (3) I Ord: swipe, til solen, skyen og
blomsten kommer; rør dem.

## 2026-09-21 – spil nr. 2: Ord, og pausen tæller rigtigt

- **Ord** (forældremenu → *Leg* → *Aktivitet* → *Ord*): én ting ad gangen, stor og rolig midt på skærmen: hunden,
  elefanten, fuglen, sommerfuglen, sneglen, traktoren, en ballon og jeres familiebilleder. Rør den: den hopper, siger
  sin lyd, og så ordet med jeres stemme (hvis I har indtalt det, se *Jeres stemmer*). Swipe: den næste glider ind.
  Hver tredje gang gemmer tingen sig bag en busk: rør busken, og "titte-bøh", der er den. For *8–12 mdr* sker intet
  af sig selv (Theo bestemmer, hvornår den næste kommer); for de ældre kommer den næste selv efter en stund.
- **Pausen tæller nu almindelig tid**, siden appen blev åbnet eller verdenen vækket, uanset om Theo rører skærmen
  (før talte den kun aktiv leg, så en stille stund forsinkede søvnen). Tid i forældremenuen tæller ikke. Under
  *Pause efter* står der nu, hvornår verdenen falder i søvn ("om ca. 7 min").

**Test på telefonen:** (1) Menu → *Leg* → *Aktivitet* → *Ord*, luk menuen: en ting står midt på græsset. Rør den:
hop, lyd og jeres ord. Swipe til siden: den næste kommer. Tredje gang: en busk; rør busken. Familiebilleder er
med. (2) Skift tilbage til *Balloner*: alt som før. (3) *Pause efter* → *5 min*: under valget står "falder i søvn om
ca. 5 min"; lad telefonen ligge uden at røre den, og efter fem minutter sover verdenen. Hold hjørneknappen: den
vågner, og tælleren starter forfra.

## 2026-09-21 – under motorhjelmen: én skal, flere aktiviteter

- Koden er delt i en fælles skal (`src/engine/`: lyd, input, forældremenu, lås, tællere, pause, billeder, stemmer,
  aldersprofiler) og aktiviteter (`src/activities/`), hvor Theos Balloner er den første bag et fælles
  `Activity`-interface. Forældremenuen får en *Aktivitet*-vælger, så snart der er mere end én (spil nr. 2, *Ord*,
  er på vej). Intet ændrer sig i selve legen.

**Test på telefonen:** (1) Alt virker som i 1.0.22: balloner, dyr, uvejr, gården, hold-lege, stemmer, pause.
(2) Forældremenuen ser ud som før (ingen aktivitetsvælger endnu).

## 2026-09-21 – jeres stemmer

- **Jeres egne stemmer** (forældremenu → *Familie* → *Jeres stemmer*): hold knappen ved et ord nede, sig ordet, slip.
  Ord: ballon, hund, elefant, fugl, sommerfugl, snegl, traktor, sol, sky, blomst, regn, lyn, og navnet på hvert
  familiebillede ("Mor!", "Far!", "Theo!"). Når Theo rører tingen, siger appen ordet med jeres stemme et øjeblik efter
  lyden, og musikken dæmpes imens. Popper han en familie-ballon, siger den navnet. Hvert ord højst hvert andet sekund
  ("ballon" sjældnere), så det aldrig bliver til snak. Optagelserne bliver på telefonen. ▶ afspiller, ✕ fjerner.
- Telefonen spørger om lov til mikrofonen første gang, I optager (kun til det).

**Test på telefonen:** (1) Menu → *Familie* → *Jeres stemmer*: hold ved *Hund*, sig "hund", slip; tillad
mikrofonen første gang. Tryk ▶: I hører jer selv. (2) Indtal *Ballon*, *Traktor* og navnet på et familiebillede
(Anna må gerne læse dem alle ind). (3) Luk menuen: rør hunden → "vov" og så "hund" med jeres stemme, musikken dæmpes
kort. Pop et familiebillede → "ta-daa" og navnet. (4) Genstart appen: stemmerne er der stadig.

## 2026-09-21 – alder, pause og forskningsgrundlag

- **Alder** i forældremenuen (*Leg*): *8–12 mdr* (standard), *1–2 år*, *2+ år*. Den yngste profil holder verdenen
  rolig: tre balloner i stedet for seks, langsommere, ét besøg ad gangen og sjældnere, intet uvejr af sig selv (man
  kan stadig fremkalde det ved at holde på en sky), lynet lyser aldrig hele skærmen op, og musikken er lavere, så
  jeres stemmer vinder. De ældre profiler skruer op trin for trin. Alt nyt fremover skal rette sig efter profilerne
  (regel i CLAUDE.md).
- **Pause efter** 5/10/20 minutter (standard 10, kan slås fra): verdenen falder stille i søvn. Ballonerne driver væk,
  dyrene går hjem, solen går ned bag bakkerne, en mørkeblå nat med stjerner og en sovende måne lægger sig over
  alting, musikken toner ud i en langsom "Lille stjerne". Et tryk giver kun et lille glimt. Hold hjørneknappen (som
  når menuen åbnes), så vågner verdenen igen. Tælles i Theos leg (pauser).
- README har fået afsnittet *Sådan bruger I den rigtigt* (sammen, kort, ikke før sengetid, hans signaler
  bestemmer), og CLAUDE.md et afsnit om forskningsgrundlaget med regler for al kode.

**Test på telefonen:** (1) Forældremenu → *Leg*: *Alder* står på *8–12 mdr*. Luk menuen: der er kun få balloner,
de stiger roligt, og der er højst ét dyr ad gangen. (2) Sæt *Alder* til *2+ år*: straks flere og hurtigere balloner.
Sæt den tilbage. (3) Sæt *Pause efter* til *5 min*, og leg i fem minutter (eller lad Theo): verdenen falder i søvn
med solnedgang, måne og vuggevise; tryk giver kun små glimt. Hold hjørneknappen: menuen åbner, og verdenen vågner
bag den. (4) Lyn i den yngste profil: skyen lyser op, men hele skærmen blinker ikke.

## 2026-09-21 – opdateringer næsten af sig selv

- **Appen finder selv nye versioner.** Kort efter start (højst hver 12. time) spørger den GitHub Releases, og er der
  en ny version, hentes den med det samme i baggrunden. En lille rød prik på låseknappen i hjørnet viser, at den er
  klar. Kun på telefonen; webappen opdaterer sig selv som før.
- **Installér nu.** I forældremenuen (*Telefon*) står der "Ny version … Hentet og klar", og knappen *Installér nu*
  går direkte til Androids installationsvindue uden ventetid. Findes der en ny version, når menuen åbnes eller ved
  *Søg*, hentes den også straks. Kan den ikke hentes (ingen net), hedder knappen *Hent og installér* som før.
- Hentede opdateringer ligger i appens cache og ryddes, når en nyere hentes.

**Test på telefonen:** (1) Installér denne version (sidste gang med ventetid). (2) Når næste version er ude:
åbn appen, vent et øjeblik, og se en rød prik på låseknappen. (3) Forældremenu → *Telefon*: "Hentet og klar" og
*Installér nu* → Androids vindue åbner med det samme → *Installér*; appen starter igen uden prik.

## 2026-09-21 – forældremenuen i fire faner

- Forældremenuen er delt op i faner i stedet for én lang liste: **Leg** (musik, lyde, tempo), **Familie** (vis
  familien, billeder og ansigts-klipperen), **Theos leg** (tællerne) og **Telefon** (opdatering, lås og lås ved
  start). Menuen husker, hvilken fane du var på. Faner uden indhold vises ikke (webappen har fx ingen Telefon-fane).

**Test på telefonen:** (1) Åbn forældremenuen: fire faner øverst, *Leg* først. (2) Skift til *Telefon*: opdatering
og lås er der; luk menuen og åbn igen: den husker fanen. (3) *Familie* → vælg/tag et billede virker som før.

## 2026-09-21 – lyn på hvert tryk, og gården står på græsset

- **Uvejrsskyen lyner, hver gang man trykker på den**, så hurtigt man kan trykke (før var der 1,2 sekunders pause).
  Hurtige tryk efter hinanden får et kort "zap" i stedet for hele tordenbraget, så det bliver ved med at være
  sjovt og ikke larm. Selve lysglimtet over hele skærmen kommer højst tre gange i sekundet (ingen hurtige blink på
  store flader), lynet og lyden kommer hver gang.

- **Gården står på græsset.** Laden stod på en linje midt under sig, så den ene halvdel svævede, hvor bakken bøjer
  nedad. Nu står den på det laveste punkt under hele sin bredde med en lille græstue foran, og hegnspælene står hver
  især på jorden under sig.

**Test på telefonen:** (1) Tryk hurtigt mange gange på uvejrsskyen: et lyn for hvert tryk, zap-zap-zap, og skærmen
blinker roligt, ikke som et stroboskop. (2) Vent et halvt sekund og tryk igen: fuldt brag. (3) Laden til højre står
på græsset i begge sider, ingen luft under den.

## 2026-09-21 – gården og traktoren

- **En lille gård** til højre på den bagerste bakke: rød lade med hvid kant, stalddør, rundt vindue, et hegn og en
  skorsten, der ryger stille og roligt hele tiden.
- **Traktoren** kører af og til ud fra gården: en gammel rød traktor med stort baghjul, lille forhjul, en høj
  skorsten, der putter røg, og et ansigt på kølergrillen. Den kører et stykke ud (hurtigere end hunden), holder et
  øjeblik i tomgang og kører hjem igen. Tryk på den: "tut-tuuut", et hop og en ekstra røgsky. Lyn giver et hop og en
  stor røgsky, regn får den til at dryppe, og en ballon lige over den løfter den op, hvor den dytter om hjælp, daler
  ned i faldskærm og kører hjem.
- Egne lydfiler til traktoren: `traktor.mp3` (dyt) og `traktor-motor.mp3` (motor), se `src/lyde/README.md`.
- Tælles i Theos leg (… traktoren).

**Test på telefonen:** (1) Gården står til højre med røg fra skorstenen. (2) Traktoren kommer inden for et par
minutter: kører ud, holder, kører hjem, med røg fra skorstenen. (3) Tryk på den: dyt og hop. (4) Lav en ballon lige
over den: den løftes og dytter om hjælp; pop ballonen, og den daler ned og kører hjem.

## 2026-09-21 – hold fingeren nede: uvejr, kæmpeballon og solskinsbrag

- **Hold på en sky**, så bliver den mørkere og mørkere, og efter godt et sekund bliver den til uvejrsskyen lige
  der, med regn, lyn og alle forvandlingerne. Slip eller flyt fingeren, og skyen bliver hvid igen. (Fars idé.)
- **Hold på himlen**: ballonen, der pustes op under fingeren, bliver ved med at vokse, så længe fingeren holder,
  til den sprænger med et brag og konfetti. Slip før, og kæmpeballonen flyver op.
- **Hold på solen**: den lader op, lyser stærkere og snurrer, og efter godt et sekund kommer et solskinsbrag:
  gnister, blomsterne skyder i vejret, og alle balloner får et varmt løft.
- **Uvejrsskyen er blevet sjov i stedet for sur** (fars ønske: lyn er ikke farligt for en baby, bare høje sjove
  lyde og lysglimt). Den har nu et glad, frækt ansigt, der spærrer øjnene op, når den lyner. Lynet popper ikke
  længere balloner, det skubber dem ud til siderne med et lille hop. Regnen skubber ballonerne ned og ud fra
  skyen af sig selv. Tordenen er et "zap", et knald og et kort, venligt drøn med en lille klokke bagefter.
- **Tag fat i uvejrsskyen og swipe den rundt** på himlen; slip den, og den fortsætter med svinget. Den bliver på
  skærmen i omkring 2½ minut (før ca. 40 sekunder), driver langsomt og vender ved kanterne, før den flyver videre.
  Mens man trækker i den, lyner den ikke for hvert lille ryk, kun når man trykker på den.
- Forældremenuen **søger selv efter ny version**, når den åbnes (højst hvert 10. minut), så "Ny version … er klar"
  og *Hent og installér* står der med det samme. Ingen tur forbi GitHub.
- Uvejrsskyen kommer lidt oftere af sig selv (typisk 3–5 minutter efter start, mindst 4 minutter mellem to).
- Tælles i Theos leg (uvejr fremkaldt, balloner sprængt, solskinsbrag).

**Test på telefonen:** (1) Åbn forældremenuen: efter et øjeblik står der "Du har den nyeste version" eller "Ny
version … er klar" med *Hent og installér*, uden at trykke *Søg*. (2) Hold en finger stille på en hvid sky: den
bliver mørk og skælver, og så er den uvejrsskyen med torden; slip tidligt, og den bliver hvid igen. (3) Hold
fingeren stille på tom himmel: ballonen vokser og vokser og sprænger med et brag; slip før, og den store ballon
flyver op. (4) Hold på solen: den lyser op og snurrer, og så skyder blomsterne i vejret til et klokkespil. (5) Med
uvejrsskyen på skærmen: tryk på den (glad ansigt, lyn, sjovt zap-brag); balloner under lynet skubbes til siden, ikke
poppet; balloner under regnen glider ned og ud. Tag fat i skyen og swipe den rundt; slip, og den glider videre. Den
bliver i flere minutter. (6) Theos leg viser de tre nye tællere.

## 2026-09-21 – rigtige dyrelyde, ballonen samler dyr op, ingen billeder i repoet

- **Rigtige dyrelyde.** Hunden gør og elefanten trutter med rigtige optagelser (frie lyde fra Pixabay), lidt
  forskelligt i tonehøjde fra gang til gang. Når de hænger i en ballonsnor, kalder de på hjælp med samme stemme, bare
  lysere. Alle dyr og vejret kan få en optagelse: læg en lydfil i `src/lyde/` med det rigtige navn (se README der),
  klip og normalisér den med `node scripts/lyd.mjs`, og næste build bruger den. Mangler filen, spiller synthen som før.
- **Ballonen samler dyr op.** Pust en ballon op (tryk på himlen) lige over et dyr: snoren fanger det, dyret dingler
  og råber om hjælp, og ballonen stiger langsomt, fordi den er tung. Snoren hænger slapt, til ballonen er højt nok
  oppe til at løfte; dyret trækkes aldrig ned i jorden. Tryk på ballonen: dyret daler roligt ned under en lille
  regnbue-faldskærm, lander med et "flump" og fortsætter, hvor det slap. Fuglen og sommerfuglen flyver bare videre.
  Flyver ballonen ud af toppen, dumper dyret ned i faldskærm derfra. Tælles i Theos leg (dyr løftet af en ballon).
- **Ingen indbyggede familiebilleder.** De tre billeder af mor, far og Theo er fjernet fra appen og fra mappen i
  repoet; familie-balloner laves kun med billeder valgt på telefonen (galleri eller kamera), som bliver på telefonen.
  Kontakten *Vis familien på balloner* virker som før på dine egne billeder.
- Kontakterne i forældremenuen er **røde, når de er slået fra**, og grønne, når de er slået til (før var de altid
  grønne).

**Test på telefonen:** (1) Tryk på hunden: et rigtigt "vov"; tryk på elefanten: en rigtig elefant-trut, ikke for
høj og ikke skurrende i telefonens højttaler. (2) Vent på hunden (eller sneglen/elefanten), og tryk på himlen ca. en
fingerbredde over dens ryg: ballonen pustes op, snoren strammer, og dyret hænger i snoren og råber. (3) Ballonen
stiger langsomt; tryk på den: dyret daler ned i faldskærm og går videre. (4) Prøv det samme med fuglen: når ballonen
popper, flyver den bare videre. (5) Forældremenu → *Familie-balloner*: der er ingen indbyggede billeder, kun dem du
selv har valgt; vælg/tag et, og det dukker op på balloner. (6) Slå *Musik* fra: kontakten bliver rød; til igen:
grøn.

## 2026-09-21 – uvejrsskyen

- **Uvejrsskyen** kommer sjældent forbi (tidligst efter et minut, højst hvert 4. minut): en stor, mørk sky med et
  gnavent ansigt, der driver langsomt over himlen med stille regn i baggrunden.
- **Regn:** dråber falder fra skyen; balloner under den presses ned, blomster vokser sig store, dyr drypper,
  sneglen skynder sig (den elsker regn), sommerfuglen flygter fra regnen.
- **Lyn:** af sig selv hvert 6.–12. sekund, og hver gang man trykker på skyen. Skærmen blinker, et lyn slår ned med
  brag og torden. I lynets vej: balloner popper, blomster snurrer i regnbuefarver, **hunden bliver til en hotdog**
  (med sennep og logrende hale), **elefanten til en mus**, fuglen strutter, sneglen gemmer sig. Efter 7 sekunder
  bliver alle sig selv igen med et lille "pop".
- Når skyen er drevet over, lyser regnbuen kraftigt op til en klokkeklang.
- Tælles i Theos leg (uvejr, lyn, dyr forvandlet).

**Test på telefonen:** (1) Leg i et par minutter (eller vent): en mørk sky kommer ind fra siden, og der høres stille
regn. (2) Tryk på skyen: lyn, brag, torden og skærmen blinker. (3) Sørg for at hunden eller elefanten står under skyen
og tryk: hunden bliver til en hotdog, elefanten til en mus; efter ca. 7 sekunder er de sig selv igen. (4) Balloner
under skyen synker lidt; blomster under skyen vokser. (5) Når skyen er ude af skærmen, stopper regnen, og regnbuen
lyser op med en klokkeklang.

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
