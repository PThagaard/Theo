# Changelog

Alle væsentlige ændringer i Theos Legeplads. Datoer er udgivelsesdatoer (push til GitHub). Det øverste afsnit bliver
automatisk til release-noter og til "Hvad er nyt" i appens opdateringstjek.

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
