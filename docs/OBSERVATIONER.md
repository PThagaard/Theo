# Observationer – hvad Theo gør med appen

Korte noter fra virkeligheden. De styrer, hvad vi bygger næste gang. Skriv dato, alder, hvad han gjorde, og hvad der
virkede/ikke virkede. Ingen vurderinger af Theo, kun af appen.

## 2026-09-21 (8 måneder) – Theos Balloner, første version på S21

- "Det fungerer bare super godt." Theo elsker at swipe og klikke.
- Konsekvens: swipe er blevet en hovedmekanik (regnbuespor, harpetoner, vind), og alt på skærmen reagerer nu på tryk
  (sol, skyer). Ryst tilføjet.
- Ønske: appen skal kunne låses uden at rode i Android-indstillinger → lås-knap i forældremenuen.

## 2026-09-21 (8 måneder) – version med swipe-spor, vind, ryst og lås

- Far: "Når jeg swiper, skubber den ballonerne væk – det er en sjov funktion og gameplay!" → vinden er en fast
  mekanik. Balloner direkte i fingerens bane skubbes ikke, så swipe altid popper det, den rammer.
- Theo elsker at se sig selv på video og billeder → næste feature: familie-balloner med billeder af mor, far og Theo
  (billederne bliver kun på telefonen).
- Theo bruger pegefingeren til at vælge, ud over at swipe og klappe.

## 2026-09-21 – ønsker fra far (behov bag)

- "Kan man justere intensiteten af balloner? Den er lidt langsom for nogen." → behov: tempoet skal passe til barnet
  og situationen (vild leg vs. rolig stund) → tempo-valg i forældremenuen.
- "Efter hver versions-bump skal jeg have en testliste." → behov: vide præcis hvad der skal prøves → fast testliste
  pr. udgivelse i changelog og chat.
- "Kan der laves in-app-opdatering?" → behov: opdatere uden at åbne GitHub → *Søg efter ny version* i menuen.
- "En hund der går over græsset … en elefant der kigger op bag græsset." → behov: liv, overraskelser og dyr med
  lyde, noget nyt at opdage → generelt besøgssystem (hund, elefant + egne ideer: fugl, sommerfugl, snegl, blomster
  der vrikker, stjerneskud). Forslag er eksempler på behov, ikke krav (regel i CLAUDE.md).

## 2026-09-21 – lyde, billeder og små ting (behov bag)

- "Elefanten lyder ikke rask" / "Vi skal have styr på lydene" → behov: dyrelyde skal lyde som dyr, ikke som en
  synth, så Theo kan genkende dem → rigtige, frie optagelser i `src/lyde/` (far finder lydene, Claude klipper og
  bygger dem ind); synthen bliver reserve. Regel: alle dyr og vejret kan få en optagelse med fast filnavn.
- "De 3 billeder skal væk … så ligger der heller ikke Theo-billeder offentligt i repo" → behov: privatliv; billeder
  af familien må ikke ligge offentligt → ingen indbyggede billeder, kun billeder valgt på telefonen. Regel i CLAUDE.md.
- "Når en slider er off skal den være rød" → behov: se med ét blik, hvad der er slået fra → rød/grøn.
- "Måske long-press på en sky skal lave den om til tordensky" → behov: Theo skal selv kunne fremkalde det sjældne;
  et langt tryk som tredje bevægelse → på roadmap med egne idéer (hold på himlen: ballon vokser til den sprænger).
- "Lav dag/nat-cyklus, så kan vi lave et helt nyt setup til nat" (til senere) → behov: variation i en kendt verden og
  ro før sengetid → på roadmap.

## 2026-09-21 – uvejrsskyen set på telefonen (far)

- "Den skal ikke være sur. Lyn kan godt være sjovt … det er til baby, så lyn behøver ikke være farligt" → behov:
  alt i verdenen skal være trygt og sjovt, også det vilde; høje sjove lyde og lysglimt er fint, uhygge er ikke →
  glad ansigt, lyn skubber i stedet for at poppe, venligere torden. Regel: "vildt" må aldrig blive "farligt".
- "Regnen skal også skubbe ballonerne automatisk" → behov: elementerne skal påvirke hinanden synligt uden at man
  gør noget → regn skubber balloner ned og ud.
- "Jeg vil kunne tage fat i lynskyen og swipe den rundt (den skal være på siden meget længere)" → behov: det
  sjældne skal kunne nydes og styres, ikke bare kigges på → skyen kan trækkes og flænges rundt og bliver 2½ minut.
- Uvejrsskyen kom første gang efter ret lang tid → tallene forklaret (tidligst 1 minut, ~9 % pr. besøg); vægten
  hævet, og skyen kan nu fremkaldes ved at holde på en hvid sky.
- "Burde vi have en lille farm/gård til højre med lidt liv i sig, en traktor der kører ud og tilbage" → behov: et
  fast sted i verdenen, der lever af sig selv (noget at vente på og genkende), og køretøjer/maskiner, som babyer
  elsker → gården med rygende skorsten som fast kulisse, traktoren som besøg med egen lyd, hop og røg.
- "Hvorfor kan jeg ikke skyde lyn hele tiden? Fjern delay" → behov: hvert tryk skal give et svar med det samme,
  også det tiende tryk på et sekund → lyn på hvert tryk; kun skærmglimtet holdes på højst 3 i sekundet (princip 5).
- "Forældremenuen skal have lidt mere system, så tællere, indstillinger og billeder ikke ligger i én lang liste"
  → behov: forældrene skal hurtigt finde det, de kom for (oftest: opdatering eller lås) → fire faner, menuen husker
  den sidste.

## 2026-09-21 – "hvad siger viden om babyer og skærm?" (far)

- Spørgsmål: har vi for mange aktiviteter, for højt tempo, er det korrekt for alderen? Svar: skærmen lærer ikke en
  8 måneder gammel noget i sig selv (Sundhedsstyrelsen, WHO, AAP); det eneste, der virker, er kontingens sammen med en
  voksen. Vi havde for meget på skærmen ad gangen for alderen.
- Beslutning (far: "lav alle 5"): aldersprofiler med *8–12 mdr* som standard, pause efter 10 minutter, README-afsnit
  om brug, forskningsregler i CLAUDE.md, og jeres egne stemmer som næste projekt (Anna læser ordene ind).
- Dag/nat som indhold er droppet; "nat" bruges kun som den blide afslutning på en session.
- Far: "rens billederne ud af historikken" → git-historikken er omskrevet med `git filter-repo` (de tre jpg'er er
  væk fra alle commits), branchen er force-pushet, og `latest`-tagget er lavet om. GitHub kan stadig have kopier i
  gamle CI-artefakter (kørsel 9–12) og i sin cache; det er noteret i chatten.
- "Kan vi ikke lave en 'vælg spil'-forside? Settings er jo kun til Balloner" → behov: appen er nu flere spil, og
  forældrene skal kunne vælge, når de giver Theo telefonen; indstillinger skal høre til det spil, de gælder →
  forsiden "Theos spil", *Skift spil* i menuen, Tempo kun i Balloner.
- "Det her ord-spil, jeg forstår det ikke. Hvordan skal det være sjovt og lærerigt for en 8 måneders? Der MÅ være
  noget dokumenteret videnskab" → behov: alt, vi bygger, skal kunne begrundes i, hvad der er dokumenteret for
  alderen, og appen må ikke love mere, end den kan → `docs/FORSKNING.md` (kilder med links), ærlig status: Ord var
  en talende billedbog, ikke et læringsspil. Beslutning (far: "ja, lav 1, 2 og 3"): titte-bøh for 8–12 mdr
  (familien og få dyr bag busken), "Hvor er …?"-runder fra 1 år uden fejl, og fem regler i CLAUDE.md.
- "Vores ballonspil er sjovt og lærer ham at koordinere hænder og fingre. Jeg har brug for et spil med samme sjove
  gameplay for en 8 måneders: sjovt at trykke, ryste, swipe" → behov: mere af det, der virker (kontingens med hele
  hånden), i en ny verden, så det er friskt → *Theos Badekar* (badet: pop, plask, ænder, swipe-bølger, hold-og-pust,
  ryst-byge), og ideerne *Trommer* og *Bolde* i roadmappen som de næste af samme slags.
- "Sindssyg god idé med Theos badekar (bedre navn). Lad os få flere ting ind ligesom i den anden: ting, der kommer
  i vandet, i luften. En pingvin på en vandscooter, en ko i en speedbåd, en hval, der kommer til overfladen, står og
  ryster, og sprøjter vand ud af toppen, når man trykker" → behov: overraskelser og liv, noget at vente på og kigge
  efter, og en tydelig belønning for at røre → gæster i badekarret (hval, ko i speedbåd, pingvin på vandscooter,
  fisk, bruser), få og rolige for de mindste, alle svarer på tryk; ryst kalder en gæst, når badet er tomt.
- "Muh lyder helt off. Det er det samme for alle dine lyde" → behov: dyrene skal lyde som dyr → rigtige optagelser
  til alle dyr og vejret (forældrenes Pixabay-filer + BigSoundBank, CC0); synthen kun som reserve.
- "Forældrenes ord skal kun bruges i ord-spillet; det var aldrig planen, at 'ballon' siges ved pop" → behov: hvert
  spil har sit formål, og indstillinger skal følge spillet → ord kun i Titte-bøh og Ord; *Jeres stemmer* vises kun
  der.
- Badekarret, 8 mdr, normal tempo: "det ender tit med, at der ingen bobler er; han popper de 1–2, og så sker der
  intet i 10 sekunder" → behov: der skal altid være noget at række ud efter → aldrig tomt: en ny boble stiger straks
  i modsat side.
- "Anden skal skifte farve on-click; longpress → farveskift og sejle hurtigt frem og tilbage; og svømme lidt
  hurtigere" → gjort som beskrevet (glidende regnbue, ingen blink).
- "Kan vandet følge, når jeg drejer telefonen, som rigtigt vand? Det ville være så cool" → tilt fra accelerometeret;
  vandet hælder med et skvulp; ænder driver ned mod den lave side.
- "30–35 px hvid baggrund i bunden" → badekarrets forkant lignede en fejl; fjernet.
- "Hvorfor står der 'ansigter på ballonerne' i Badekarret?" → menuens familie-tekst fulgte ikke spillet; nu
  "Familien i boblerne / på balloner / i Ord".
- "Kun set familiebillede én gang på 5 minutter; hvad er stjernerne til? Jeg elsker, at billederne falder i vandet"
  → billeder oftere (også fra Theos egne plask), stjernebobler som godbid, tællere i Theos leg.
- "Theo har tit begge hænder på skærmen og er ikke 100% koordineret" → behov: alt skal tåle håndflader og mange
  samtidige tryk → porten til forældremenuen skal ignorere store kontaktflader; lyden må ikke blive en mur (planlagt).
- "Musikken: en settings-fane, hvor jeg kan slå sange til/fra, justere hastigheden, og Baby Shark som den primære"
  og "Baby Shark i badekarret: Theo-haj, Da-Da-haj, Ma-Ma-haj" → planlagt (Musik-fane, notation af den traditionelle
  melodi, hajfamilien som gæst).
- Far: "skriv alle de her ting ind i planen, og vis mig den" → opgavelisten i sidepanelet holdes ajour med hvert
  ønske (færdig / i gang / kommende), og roadmappen har et "Næste"-afsnit under hvert spil.
- "Fælles funktioner som musik og pause: vis en lille nedtælling nederst til højre, når pausen er sat; ikke noget
  voldsomt synligt. Og jeg savner virkelig musik-indstillinger og Baby Shark" → nedtælling (mat, kun tal), Musik-fane
  (sange til/fra, hastighed, næste sang) og Baby Shark som første sang. Undtagelsen fra "ingen tekst til barnet" er
  skrevet ind i CLAUDE.md.
- "Baby Shark-musikken er virkelig dårlig. Glem det med sangen; vi finder en anden løsning i morgen" → notationen
  taget ud af spillelisten. Forslag til i morgen: *Jeres musik* (egne lydfiler valgt på telefonen, som bliver der
  ligesom familiebillederne); det holder repoet rent og princip 8 sandt. Hajfamilien venter på det.
- "Hvalen er ikke godkendt, den er grim. Mere tegneserie-hval med stort hoved (billeder vedhæftet). I starten kun
  toppen og hullet synligt, en hemmelighed: tryk lader vandet ud og aktiverer hvalen, som bliver synlig og glad,
  fordi man har hjulpet den" → behov: figurer, der ligner dem, Theo kender fra bøger, og en opdagelse med belønning
  → hvalen tegnet om efter billederne, og den gemmer sig med kun ryggen og hullet over vandet; første tryk lader
  vandet ud, og den kommer glad op. Ren kontingens for de mindste: intet sker, før han rører.
- "Guldfisken er fantastisk! Den springer, når man trykker. Vandet under den vises underligt (er der behov for
  det?)" → den tonede stribe under gæsterne fjernet for alle; delen under vandet ses svagt gennem vandet i stedet.
  "Kan man springe den op i en boble, så den flyver væk med boblen, medmindre man popper boblen?" → gjort: andet
  spring og hvert tredje derefter.
- "Hvad gør bruseren? Der skete ikke nok, og den var der kun 10 sekunder; det kunne sagtens være 100, hvis det var
  sjovt" → behov: gæster skal kunne leges med, ikke bare ses → bruseren drypper, til den røres, sprøjter så og
  laver bobler, kan trækkes rundt, ænder under den rapper, og hvert tryk giver den mere tid (op til 2½ minut).
- "Kan vi få en isbjørn, der driver på en isflage og vinker, med arm og hånd lidt overdrevet? Theo er begyndt at
  lære at vinke og sige hej hej" → behov: noget at efterligne (imitation er det store lige nu, `docs/ROADMAP.md`
  8–12 mdr) → isbjørnen vinker, når den kommer ind, når den røres og nu og da; stor pote, langsom bevægelse, så
  Theo kan nå at vinke med. Forældrene siger "hej hej", når den vinker.
- 22.9.2026, "Fortsæt udviklingen" → *Jeres musik* bygget som forslaget til Baby Shark (egne lydfiler fra
  telefonen, bliver der, spiller først), og lydmur-værnet (resten af "to hænder på skærmen"). Forældrene har ikke
  svaret endnu på musik-løsningen; det står i testlisten.
- 22.9.2026 → *Theos Trommer* bygget som spil nr. 4 fra roadmappen (at slå og banke er det store ved 8–12 mdr).
  Forældrene: sig, hvad Theo gør med fladerne, og om lydstyrken passer.
- 22.9.2026 → *Theos Bolde* bygget som spil nr. 5 (at gribe, slippe og kaste; at følge bolden med øjnene). Rasle-
  ideen foldet ind (ryst og tilt). Forældrene: sig, om Theo griber og kaster, eller mest trykker.
- "Appen skal altid være i landscape mode og ikke i andet" → låst i Android, iOS og web-manifestet; forsiden i to
  kolonner; røgtesten kører på tværs. "Skyen i ballonspillet: hvis man long-presser, skal den blive god igen" →
  behov: Theo (og forældrene) skal selv kunne slutte uvejret, ikke bare starte det → hold på uvejrsskyen, til den
  er hvid igen; regnen stopper, regnbuen kommer.
