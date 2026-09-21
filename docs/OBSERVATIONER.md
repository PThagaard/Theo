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
