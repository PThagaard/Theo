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
