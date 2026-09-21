# Lydfiler (rigtige optagelser)

Læg en lydfil i denne mappe, så bruger appen den i stedet for den syntetiserede lyd, i alle udgaver (APK og webapp).
Ingen kode skal ændres: næste build samler filen op. Mangler filen, eller kan den ikke afkodes, spiller synthen.

**Filnavne, appen lytter efter** (små bogstaver, ingen æøå, endelse `.mp3`, `.ogg`, `.wav` eller `.m4a`):

| Fil                   | Bruges til                                                                 |
|-----------------------|----------------------------------------------------------------------------|
| `hund.mp3`            | hunden gør, når man rører den                                              |
| `hund-hjaelp.mp3`     | hunden kalder på hjælp fra ballonsnoren (ellers spilles `hund` lidt lysere) |
| `elefant.mp3`         | elefanten trutter, når man rører den                                       |
| `elefant-hjaelp.mp3`  | elefanten kalder på hjælp fra snoren (ellers `elefant` lidt lysere)         |
| `elefant-brum.mp3`    | elefanten brummer, når den kigger op bag bakken                            |
| `fugl.mp3`            | fuglen pipper                                                              |
| `sommerfugl.mp3`      | sommerfuglen flagrer                                                       |
| `snegl.mp3`           | sneglen siger blub                                                         |
| `torden.mp3`          | torden, når uvejrsskyen lyner                                              |
| `regn.mp3`            | regn, der loopes mens uvejrsskyen er på skærmen (skal kunne loope pænt)    |

Listen vedligeholdes i `src/samples.ts` (`SAMPLE_NAMES`); en fil med et andet navn får enhedstesten til at fejle.

**Format:** kort (½–2 sekunder, regn gerne 5–10), én lyd pr. fil, mono. Appen varierer selv tonehøjden lidt fra gang
til gang, så én optagelse er nok. Klip og normalisér med værktøjet, som også gemmer som lille MP3:

```
node scripts/lyd.mjs info  optagelse.mp3              # varighed og en kurve over lydstyrken
node scripts/lyd.mjs trim  optagelse.mp3 hund         # hele filen → src/lyde/hund.mp3
node scripts/lyd.mjs trim  optagelse.mp3 elefant 0 1.4   # kun sekund 0–1,4
```

(kræver `npm install`; afkodningen sker i Playwright-Chromium, så alle formater en browser kan afspille virker.)

**Licens:** repoet er offentligt, så kun lyde, der må bruges frit (CC0/public domain, Pixabay Content License eller
tilsvarende), og kilden skrives her:

| Fil           | Kilde                                                                                   |
|---------------|-----------------------------------------------------------------------------------------|
| `hund.mp3`    | "Free dog bark" af Dragon Studio, Pixabay (id 419014), Pixabay Content License          |
| `elefant.mp3` | "Elephant trumpets growls" af freesound_community, Pixabay (id 6047), Pixabay Content License |
