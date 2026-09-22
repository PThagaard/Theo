/**
 * Real recordings for the sound effects. Every sound file in src/lyde/ is picked up by its file
 * name (see src/lyde/README.md for the names the app listens for); the synthesised voice in
 * audio.ts stays as the fallback when a file is missing or cannot be decoded.
 */

const files = import.meta.glob('../lyde/*.{mp3,ogg,wav,m4a}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** File name without extension → URL of the bundled file. */
export const SAMPLE_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [(path.split('/').pop() ?? '').replace(/\.[^.]+$/, ''), url]),
);

/** The file names the app looks for, and what each one is used for. */
export const SAMPLE_NAMES = {
  hund: 'hunden gør (tryk på hunden)',
  'hund-hjaelp': 'hunden kalder på hjælp fra ballonsnoren (ellers bruges "hund" lidt lysere)',
  elefant: 'elefanten trutter (tryk på elefanten)',
  'elefant-hjaelp': 'elefanten kalder på hjælp fra ballonsnoren (ellers bruges "elefant" lidt lysere)',
  'elefant-brum': 'elefanten brummer, når den kigger op bag bakken',
  fugl: 'fuglen pipper (tryk på fuglen)',
  sommerfugl: 'sommerfuglen flagrer (tryk på sommerfuglen)',
  snegl: 'sneglen siger blub (tryk på sneglen)',
  torden: 'torden, når uvejrsskyen lyner',
  regn: 'regn, der loopes mens uvejrsskyen er på skærmen',
  traktor: 'traktoren dytter (tryk på traktoren)',
  'traktor-motor': 'motoren putter, når traktoren kører ud fra gården',
  ko: 'koen siger muh (tryk på koen i Ord)',
  kat: 'katten mjaver (tryk på katten i Ord og i Balloner)',
  kanin: 'kaninen dunker med bagbenene (tryk på kaninen i Balloner)',
  froe: 'frøen kvækker (tryk på frøen i Balloner)',
  bi: 'bien summer (tryk på bien i Balloner)',
  bil: 'bilen dytter (tryk på bilen i Ord)',
  and: 'anden rapper (tryk på anden i Badekarret)',
  hval: 'hvalen kalder, når den dukker op (Badekarret)',
  pingvin: 'pingvinen skræpper (tryk på pingvinen på vandscooteren i Badekarret)',
  isbjoern: 'isbjørnen brummer venligt (tryk på isbjørnen på isflagen i Badekarret)',
  haj: 'hajerne siger nam-nam (tryk på en haj i hajfamilien i Badekarret; tonehøjden varieres pr. haj)',
} as const;

export type SampleName = keyof typeof SAMPLE_NAMES;
