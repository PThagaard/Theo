import { Cropper } from './cropper';
import type { KidLock } from './kidlock';
import type { StoredPhoto } from './photos';
import { STAT_LABELS, formatMinutes, type StatsSnapshot } from './stats';
import type { AppUpdate, UpdateCheck } from './update';
import { DEFAULT_AGE, type Age } from './age';
import { SONGS } from './music';
import { MIN_VOICE_SECONDS, VOICE_WORDS, photoVoiceKey, type Recording, type StoredVoice } from './voices';

/**
 * Parent menu: music and sound on/off, and (on Android) locking the app to the screen.
 * It opens by holding the small corner button for two seconds with one finger, which a
 * whole resting hand never does, and closes itself again after a while.
 */

export type Tempo = 'rolig' | 'normal' | 'vild';
export type MusicSpeed = 'langsom' | 'normal' | 'hurtig';
/** Playback speed per setting: the songs are written at a calm pace already. */
export const MUSIC_SPEEDS: Record<MusicSpeed, number> = { langsom: 0.8, normal: 1, hurtig: 1.2 };
export type PauseAfter = 0 | 5 | 10 | 20;

export interface Settings {
  music: boolean;
  sfx: boolean;
  /** Ask to pin the app to the screen every time it starts (Android). */
  autoLock: boolean;
  /** How busy the sky is. */
  tempo: Tempo;
  /** The child's age: decides how much happens at once (see AGE_PROFILES in game.ts). */
  age: Age;
  /** Minutes of play before the world goes to sleep (0 = never). */
  pauseAfter: PauseAfter;
  /** Show family photos on balloons. */
  familyBalloons: boolean;
  /** Which activity runs (see src/activities/registry.ts). */
  activity: string;
  /** How fast the songs play. */
  musicSpeed: MusicSpeed;
  /** Songs the parents have switched off (ids from engine/music.ts). */
  songsOff: string[];
}

export interface PhotoHooks {
  max: number;
  list(): Promise<StoredPhoto[]>;
  /** Stores a face the parent framed in the cropper (square JPEG data URL). */
  add(dataUrl: string): Promise<StoredPhoto>;
  remove(id: string): Promise<void>;
  /** Called with the full list whenever it changes. */
  onChange(photos: StoredPhoto[]): void;
}

export interface VoiceHooks {
  list(): Promise<StoredVoice[]>;
  save(key: string, blob: Blob, seconds: number): Promise<StoredVoice>;
  remove(key: string): Promise<void>;
  /** Starts a microphone recording (the phone asks for permission the first time). */
  record(): Promise<Recording>;
  /** Plays a recording back; false when the sound engine has not got it (yet). */
  play(key: string): boolean;
  /** Called after a recording was saved or removed. */
  onChange(): void;
}

export interface StatsHooks {
  snapshot(): StatsSnapshot;
  reset(): void;
  /** Names of family photos, for "Mor poppet" rows (photo id -> name). */
  photoNames(): Record<string, string>;
}

export interface ParentPanelHooks {
  onChange(settings: Settings): void;
  /** The menu opened (a parent held the corner button). */
  onOpen?(): void;
  /** The game running now (null on the start page), so the menu can show its name and its own settings. */
  currentGame?(): { id: string; title: string; hasTempo: boolean; hasVoices: boolean; familyWhere: string } | null;
  /** The name of the song playing right now, for the Musik page. */
  currentSong?(): string | null;
  /** The parents' "next song" button. */
  onSkipSong?(): void;
  /** "Skift spil": back to the start page. */
  onSwitchGame?(): void;
  /** One line about the pause ("falder i søvn om 7 min"), shown while the menu is open. */
  pauseStatus?(): string;
  lock?: KidLock;
  photos?: PhotoHooks;
  update?: AppUpdate;
  stats?: StatsHooks;
  voices?: VoiceHooks;
}

const STORAGE_KEY = 'theos-balloner.settings';
/** The menu remembers which page it was on (a small convenience, kept in the browser only). */
const TAB_KEY = 'theos-balloner.parentTab';
/** The background check after start happens at most this often. */
const BACKGROUND_CHECK_KEY = 'theos-balloner.lastUpdateCheck';
const BACKGROUND_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
type TabName = 'leg' | 'musik' | 'familie' | 'theo' | 'telefon';
const TABS: TabName[] = ['leg', 'musik', 'familie', 'theo', 'telefon'];
const DEFAULTS: Settings = { music: true, sfx: true, autoLock: false, tempo: 'normal', age: DEFAULT_AGE, pauseAfter: 10, familyBalloons: true, activity: 'balloner', musicSpeed: 'normal', songsOff: [] };
const MUSIC_SPEED_NAMES: MusicSpeed[] = ['langsom', 'normal', 'hurtig'];
const TEMPOS: Tempo[] = ['rolig', 'normal', 'vild'];
const AGES: Age[] = ['8-12', '1-2', '2+'];
const PAUSES: PauseAfter[] = [0, 5, 10, 20];
const HOLD_MS = 2000;
const AUTO_CLOSE_MS = 15000;

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
      if (!TEMPOS.includes(stored.tempo)) stored.tempo = 'normal';
      if (!AGES.includes(stored.age)) stored.age = DEFAULT_AGE;
      if (!PAUSES.includes(stored.pauseAfter)) stored.pauseAfter = 10;
      if (typeof stored.activity !== 'string') stored.activity = DEFAULTS.activity;
      if (!MUSIC_SPEED_NAMES.includes(stored.musicSpeed)) stored.musicSpeed = 'normal';
      if (!Array.isArray(stored.songsOff)) stored.songsOff = [];
      stored.songsOff = stored.songsOff.filter((id): id is string => typeof id === 'string');
      return stored;
    }
  } catch {
    // Storage unavailable (private mode etc.). Fall back to defaults.
  }
  return { ...DEFAULTS };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore; the settings simply won't persist.
  }
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Mangler element #${id}`);
  return found as T;
}

/** Counts fingers on the screen, so a whole hand resting on the screen can't trigger parent actions. */
class ActivePointers {
  private readonly ids = new Set<number>();

  constructor() {
    document.addEventListener('pointerdown', (event) => this.ids.add(event.pointerId), true);
    for (const type of ['pointerup', 'pointercancel'] as const) {
      document.addEventListener(type, (event) => this.ids.delete(event.pointerId), true);
    }
  }

  get count(): number {
    return this.ids.size;
  }
}

/** A button that only fires after being held down for two seconds with a single finger. */
class HoldButton {
  private start = 0;
  private frame = 0;
  /** Set when a hold fired, so the click that follows the finger lifting is ignored. */
  consumedClick = false;

  constructor(
    private readonly button: HTMLElement,
    private readonly onHold: () => void,
    private readonly pointers: ActivePointers,
  ) {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.begin();
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
      button.addEventListener(type, () => this.cancel());
    }
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  private begin(): void {
    this.start = performance.now();
    cancelAnimationFrame(this.frame);
    this.tick();
  }

  private readonly tick = (): void => {
    if (this.pointers.count > 1) {
      this.cancel();
      return;
    }
    const progress = (performance.now() - this.start) / HOLD_MS;
    this.button.style.setProperty('--progress', String(Math.min(1, progress)));
    if (progress >= 1) {
      this.cancel();
      this.consumedClick = true;
      this.onHold();
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  cancel(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.button.style.setProperty('--progress', '0');
  }
}

export class ParentPanel {
  private readonly panel = element<HTMLElement>('parent-panel');
  private readonly musicToggle = element<HTMLInputElement>('opt-music');
  private readonly musicSpeedButtons = Array.from(element<HTMLElement>('music-speed-options').querySelectorAll<HTMLButtonElement>('button[data-speed]'));
  private readonly songList = element<HTMLElement>('song-list');
  private readonly songStatus = element<HTMLElement>('song-status');
  private readonly sfxToggle = element<HTMLInputElement>('opt-sfx');
  private readonly autoLockToggle = element<HTMLInputElement>('opt-autolock');
  private readonly familyToggle = element<HTMLInputElement>('opt-family');
  private readonly tempoButtons = Array.from(element<HTMLElement>('tempo-options').querySelectorAll<HTMLButtonElement>('button[data-tempo]'));
  private readonly ageButtons = Array.from(element<HTMLElement>('age-options').querySelectorAll<HTMLButtonElement>('button[data-age]'));
  private readonly pauseButtons = Array.from(element<HTMLElement>('pause-options').querySelectorAll<HTMLButtonElement>('button[data-pause]'));
  private readonly activityName = element<HTMLElement>('activity-name');
  private readonly switchGame = element<HTMLButtonElement>('switch-game');
  private readonly tempoRow = element<HTMLElement>('tempo-row');
  private readonly pauseStatus = element<HTMLElement>('pause-status');
  private readonly lockSection = element<HTMLElement>('lock-section');
  private readonly lockButton = element<HTMLButtonElement>('lock-button');
  private readonly lockStatus = element<HTMLElement>('lock-status');
  private readonly photoSection = element<HTMLElement>('photo-section');
  private readonly photoList = element<HTMLElement>('photo-list');
  private readonly photoPick = element<HTMLInputElement>('photo-pick');
  private readonly photoSnap = element<HTMLInputElement>('photo-snap');
  private readonly photoStatus = element<HTMLElement>('photo-status');
  private photos: StoredPhoto[] = [];
  private cropper: Cropper | null = null;
  private readonly voiceSection = element<HTMLElement>('voice-section');
  private readonly voiceList = element<HTMLElement>('voice-list');
  private readonly voiceStatus = element<HTMLElement>('voice-status');
  private voices = new Map<string, StoredVoice>();
  /** The recording in progress (or on its way: the permission prompt may still be open). */
  private recording: { key: string; button: HTMLButtonElement; started: Promise<Recording>; released: boolean } | null = null;
  private readonly updateSection = element<HTMLElement>('update-section');
  private readonly updateStatus = element<HTMLElement>('update-status');
  private readonly updateCheck = element<HTMLButtonElement>('update-check');
  private readonly updateInstall = element<HTMLButtonElement>('update-install');
  private readonly updateNotes = element<HTMLDetailsElement>('update-notes');
  private readonly updateNotesText = element<HTMLElement>('update-notes-text');
  private updateUrl: string | null = null;
  private updateVersion = '';
  /** True once the new APK sits in the cache, so "Installér nu" goes straight to Android's installer. */
  private updateReady = false;
  /** A download is running (started from the menu or in the background); never two at once. */
  private fetching = false;
  private busy = false;
  private readonly tabButtons = Array.from(element<HTMLElement>('parent-tabs').querySelectorAll<HTMLButtonElement>('button[data-tab]'));
  private readonly tabPages = Array.from(this.panel.querySelectorAll<HTMLElement>('.tab-page'));
  private readonly statsSection = element<HTMLElement>('stats-section');
  private readonly statsBody = element<HTMLElement>('stats-body');
  private readonly statsFooter = element<HTMLElement>('stats-footer');
  private readonly pointers = new ActivePointers();
  private readonly lockHold: HoldButton;
  private locked = false;
  private autoClose: ReturnType<typeof setTimeout> | null = null;
  private lockPoll: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly settings: Settings,
    private readonly hooks: ParentPanelHooks,
  ) {
    this.musicToggle.checked = settings.music;
    this.sfxToggle.checked = settings.sfx;
    this.autoLockToggle.checked = settings.autoLock;
    this.familyToggle.checked = settings.familyBalloons;

    new HoldButton(element('parent-button'), () => this.open(), this.pointers);

    // Locking is one tap (the phone then asks the parent to confirm). Unlocking needs a two
    // second hold, so a child who somehow opened this menu can't undo the lock with a tap.
    this.lockHold = new HoldButton(this.lockButton, () => void this.unlock(), this.pointers);
    this.lockButton.addEventListener('click', () => {
      if (this.lockHold.consumedClick) {
        this.lockHold.consumedClick = false;
        return;
      }
      if (!this.locked) void this.lock();
    });
    this.lockSection.hidden = !hooks.lock?.available;

    for (const toggle of [this.musicToggle, this.sfxToggle, this.autoLockToggle, this.familyToggle]) {
      toggle.addEventListener('change', () => this.changed());
    }
    for (const button of this.musicSpeedButtons) {
      button.addEventListener('click', () => {
        this.settings.musicSpeed = button.dataset.speed as MusicSpeed;
        this.renderChoices();
        this.changed();
      });
    }
    this.renderSongs();
    this.songList.addEventListener('change', (event) => {
      const input = (event.target as HTMLInputElement).closest<HTMLInputElement>('input[data-song]');
      if (!input?.dataset.song) return;
      const id = input.dataset.song;
      const off = new Set(this.settings.songsOff);
      if (input.checked) off.delete(id);
      else off.add(id);
      this.settings.songsOff = [...off];
      this.changed();
    });
    element<HTMLButtonElement>('song-skip').addEventListener('click', () => {
      this.hooks.onSkipSong?.();
      window.setTimeout(() => this.renderSongStatus(), 400);
    });
    for (const button of this.tempoButtons) {
      button.addEventListener('click', () => {
        this.settings.tempo = button.dataset.tempo as Tempo;
        this.renderTempo();
        this.changed();
      });
    }
    this.renderTempo();
    for (const button of this.ageButtons) {
      button.addEventListener('click', () => {
        this.settings.age = button.dataset.age as Age;
        this.renderChoices();
        this.changed();
      });
    }
    for (const button of this.pauseButtons) {
      button.addEventListener('click', () => {
        this.settings.pauseAfter = Number(button.dataset.pause) as PauseAfter;
        this.renderChoices();
        this.changed();
        this.renderPauseStatus();
      });
    }
    this.switchGame.addEventListener('click', () => {
      this.close();
      hooks.onSwitchGame?.();
    });
    this.renderChoices();

    this.photoSection.hidden = !hooks.photos;
    if (hooks.photos) this.cropper = new Cropper((dataUrl) => this.storeFace(dataUrl));
    for (const input of [this.photoPick, this.photoSnap]) {
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        input.value = '';
        if (file) void this.cropPhoto(file);
      });
    }
    this.photoList.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-remove]');
      if (button?.dataset.remove) void this.removePhoto(button.dataset.remove);
    });
    void this.loadPhotos();

    this.voiceSection.hidden = !hooks.voices;
    if (hooks.voices) {
      this.voiceList.addEventListener('pointerdown', (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button.voice-record');
        if (!button?.dataset.key) return;
        event.preventDefault();
        void this.startVoice(button.dataset.key, button);
      });
      for (const type of ['pointerup', 'pointercancel'] as const) {
        document.addEventListener(type, () => void this.stopVoice(), true);
      }
      this.voiceList.addEventListener('contextmenu', (event) => event.preventDefault());
      this.voiceList.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const play = target.closest<HTMLButtonElement>('button.voice-play');
        if (play?.dataset.key) {
          if (!hooks.voices?.play(play.dataset.key)) this.voiceStatus.textContent = 'Lyden er ikke klar endnu. Prøv igen om et øjeblik.';
          this.armAutoClose();
          return;
        }
        const remove = target.closest<HTMLButtonElement>('button.voice-remove');
        if (remove?.dataset.key) void this.removeVoice(remove.dataset.key);
      });
      void this.loadVoices();
    }

    this.statsSection.hidden = !hooks.stats;
    new HoldButton(element('stats-reset'), () => {
      hooks.stats?.reset();
      this.renderStats();
    }, this.pointers);

    this.updateSection.hidden = !hooks.update?.available;
    this.updateCheck.addEventListener('click', () => void this.checkForUpdate());
    this.updateInstall.addEventListener('click', () => void this.installUpdate());
    element<HTMLButtonElement>('parent-close').addEventListener('click', () => this.close());
    this.panel.addEventListener('pointerdown', () => this.armAutoClose());

    // Pages: a tab only shows when there is something on it (no photos in some builds, no lock/update on the web).
    const available: Record<TabName, boolean> = {
      leg: true,
      musik: true,
      familie: !!hooks.photos,
      theo: !!hooks.stats,
      telefon: !!hooks.update?.available || !!hooks.lock?.available,
    };
    for (const button of this.tabButtons) {
      const name = button.dataset.tab as TabName;
      button.hidden = !available[name];
      button.addEventListener('click', () => this.showTab(name, true));
    }
    this.showTab(this.rememberedTab(), false);
  }

  /** Shows one page of the menu and hides the others. */
  showTab(name: TabName, remember: boolean): void {
    const button = this.tabButtons.find((b) => b.dataset.tab === name);
    const target = button && !button.hidden ? name : 'leg';
    for (const b of this.tabButtons) {
      b.classList.toggle('is-selected', b.dataset.tab === target);
      b.setAttribute('aria-selected', String(b.dataset.tab === target));
    }
    for (const page of this.tabPages) page.hidden = page.dataset.tab !== target;
    if (remember) {
      try {
        localStorage.setItem(TAB_KEY, target);
      } catch {
        // Fine without; the menu just opens on the first page next time.
      }
    }
  }

  get currentTab(): TabName {
    return (this.tabButtons.find((b) => b.classList.contains('is-selected'))?.dataset.tab as TabName | undefined) ?? 'leg';
  }

  private rememberedTab(): TabName {
    try {
      const stored = localStorage.getItem(TAB_KEY);
      if (stored && (TABS as string[]).includes(stored)) return stored as TabName;
    } catch {
      // Storage unavailable.
    }
    return 'leg';
  }

  get isOpen(): boolean {
    return !this.panel.hidden;
  }

  open(): void {
    this.panel.hidden = false;
    this.hooks.onOpen?.();
    this.renderGame();
    this.renderPauseStatus();
    this.armAutoClose();
    this.renderStats();
    void this.showVersion();
    void this.refreshLock();
    if (this.lockPoll) clearInterval(this.lockPoll);
    this.lockPoll = setInterval(() => void this.refreshLock(), 1000);
  }

  close(): void {
    this.cropper?.close();
    this.panel.hidden = true;
    if (this.autoClose) clearTimeout(this.autoClose);
    this.autoClose = null;
    if (this.lockPoll) clearInterval(this.lockPoll);
    this.lockPoll = null;
  }

  private armAutoClose(): void {
    if (this.autoClose) clearTimeout(this.autoClose);
    if (this.cropper?.isOpen) return;
    this.autoClose = setTimeout(() => this.close(), AUTO_CLOSE_MS);
  }

  private pauseAutoClose(): void {
    if (this.autoClose) clearTimeout(this.autoClose);
    this.autoClose = null;
  }

  private renderTempo(): void {
    for (const button of this.tempoButtons) {
      button.classList.toggle('is-selected', button.dataset.tempo === this.settings.tempo);
      button.setAttribute('aria-pressed', String(button.dataset.tempo === this.settings.tempo));
    }
  }

  private renderPauseStatus(): void {
    this.pauseStatus.textContent = this.hooks.pauseStatus?.() ?? '';
  }

  /** One row per song, with a switch; the songs come from engine/music.ts. */
  private renderSongs(): void {
    const off = new Set(this.settings.songsOff);
    this.songList.replaceChildren(
      ...SONGS.map((song) => {
        const row = document.createElement('label');
        row.className = 'row';
        const label = document.createElement('span');
        label.className = 'row-label';
        label.textContent = `🎵 ${song.name}`;
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.song = song.id;
        input.checked = !off.has(song.id);
        const toggle = document.createElement('span');
        toggle.className = 'switch';
        toggle.setAttribute('aria-hidden', 'true');
        row.append(label, input, toggle);
        return row;
      }),
    );
    this.renderSongStatus();
  }

  private renderSongStatus(): void {
    const name = this.hooks.currentSong?.() ?? null;
    this.songStatus.textContent = name ? `Spiller nu: ${name}` : 'Musikken er slået fra.';
  }

  private renderChoices(): void {
    for (const button of this.musicSpeedButtons) {
      const selected = button.dataset.speed === this.settings.musicSpeed;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    for (const button of this.ageButtons) {
      const selected = button.dataset.age === this.settings.age;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    for (const button of this.pauseButtons) {
      const selected = Number(button.dataset.pause) === this.settings.pauseAfter;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
  }

  /** The game's name at the top of the Leg page; settings that belong to one game only show for it. */
  private renderGame(): void {
    const game = this.hooks.currentGame?.() ?? null;
    this.activityName.textContent = game ? `🧩 ${game.title}` : '🧩 Intet spil valgt';
    this.switchGame.hidden = !game;
    this.tempoRow.hidden = !(game?.hasTempo ?? false);
    // The parents' words are only spoken by Titte-bøh og Ord, so recording them only shows there.
    this.voiceSection.hidden = !this.hooks.voices || !(game?.hasVoices ?? false);
    // The family photos are used by every game, but the wording says where they show up in this one.
    const where = game?.familyWhere ?? 'i spillene';
    element<HTMLElement>('family-title').textContent = `📷 Familien ${where}`;
    element<HTMLElement>('family-label').textContent = `Vis familien ${where}`;
    this.renderSongStatus();
  }

  private changed(): void {
    this.settings.music = this.musicToggle.checked;
    this.settings.sfx = this.sfxToggle.checked;
    this.settings.autoLock = this.autoLockToggle.checked;
    this.settings.familyBalloons = this.familyToggle.checked;
    this.hooks.onChange({ ...this.settings });
    this.armAutoClose();
  }

  // ---- Family photos ---------------------------------------------------------

  private async loadPhotos(): Promise<void> {
    if (!this.hooks.photos) return;
    this.photos = await this.hooks.photos.list();
    this.renderPhotos();
    this.hooks.photos.onChange([...this.photos]);
  }

  // ---- The parents' voices -----------------------------------------------------

  private async loadVoices(): Promise<void> {
    const hooks = this.hooks.voices;
    if (!hooks) return;
    this.voices = new Map((await hooks.list()).map((voice) => [voice.key, voice]));
    this.renderVoices();
  }

  /** One row per word, and one per family photo (its name), each with hold-to-record, play and remove. */
  private renderVoices(): void {
    if (!this.hooks.voices) return;
    const rows: Array<{ key: string; label: string; emoji?: string; image?: string }> = [
      ...VOICE_WORDS.map((word) => ({ key: word.key, label: word.label, emoji: word.emoji })),
      ...this.photos.map((photo, i) => ({ key: photoVoiceKey(photo.id), label: photo.name || `Billede ${i + 1}`, image: photo.dataUrl })),
    ];
    this.voiceList.replaceChildren(
      ...rows.map((row) => {
        const item = document.createElement('div');
        item.className = 'voice-row';
        const label = document.createElement('span');
        label.className = 'voice-label';
        if (row.image) {
          const image = document.createElement('img');
          image.src = row.image;
          image.alt = '';
          label.append(image);
        }
        label.append(`${row.emoji ? `${row.emoji} ` : ''}${row.label}`);
        const has = this.voices.has(row.key);
        const record = document.createElement('button');
        record.type = 'button';
        record.className = 'voice-record';
        record.dataset.key = row.key;
        record.textContent = has ? '🎙️ Optag igen' : '🎙️ Hold og sig ordet';
        const play = document.createElement('button');
        play.type = 'button';
        play.className = 'voice-play';
        play.dataset.key = row.key;
        play.textContent = '▶';
        play.setAttribute('aria-label', `Afspil ${row.label}`);
        play.hidden = !has;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'voice-remove';
        remove.dataset.key = row.key;
        remove.textContent = '✕';
        remove.setAttribute('aria-label', `Fjern ${row.label}`);
        remove.hidden = !has;
        item.append(label, record, play, remove);
        return item;
      }),
    );
  }

  private async startVoice(key: string, button: HTMLButtonElement): Promise<void> {
    const hooks = this.hooks.voices;
    if (!hooks || this.recording) return;
    button.classList.add('is-recording');
    button.textContent = '● Optager …';
    this.voiceStatus.textContent = 'Sig ordet, og slip knappen.';
    const started = hooks.record();
    this.recording = { key, button, started, released: false };
    this.armAutoClose();
    try {
      await started;
      // The finger may have lifted while the phone asked for permission: then there is nothing to keep.
      if (this.recording?.released) await this.stopVoice();
    } catch (error) {
      this.recording = null;
      this.renderVoices();
      this.voiceStatus.textContent = 'Telefonen gav ikke lov til mikrofonen. Tillad den under appens tilladelser, og prøv igen.';
      console.warn('Optagelse kunne ikke starte', error);
    }
  }

  private async stopVoice(): Promise<void> {
    const current = this.recording;
    const hooks = this.hooks.voices;
    if (!current || !hooks) return;
    current.released = true;
    let recorder: Recording;
    try {
      recorder = await current.started;
    } catch {
      return; // startVoice reports the error
    }
    if (this.recording !== current) return;
    this.recording = null;
    try {
      const { blob, seconds } = await recorder.stop();
      if (seconds < MIN_VOICE_SECONDS || blob.size === 0) {
        this.voiceStatus.textContent = 'Det blev for kort. Hold knappen nede, mens du siger ordet.';
      } else {
        const voice = await hooks.save(current.key, blob, seconds);
        this.voices.set(current.key, voice);
        this.voiceStatus.textContent = `Gemt (${seconds.toFixed(1).replace('.', ',')} s). Tryk ▶ for at høre den.`;
        hooks.onChange();
      }
    } catch (error) {
      this.voiceStatus.textContent = 'Optagelsen kunne ikke gemmes. Prøv igen.';
      console.warn('Optagelse fejlede', error);
    } finally {
      this.renderVoices();
      this.armAutoClose();
    }
  }

  private async removeVoice(key: string): Promise<void> {
    const hooks = this.hooks.voices;
    if (!hooks) return;
    await hooks.remove(key);
    this.voices.delete(key);
    this.voiceStatus.textContent = 'Fjernet.';
    this.renderVoices();
    hooks.onChange();
    this.armAutoClose();
  }

  /** Opens the cropper for a picked picture. The menu stays open while the parent frames the face. */
  private async cropPhoto(file: Blob): Promise<void> {
    const hooks = this.hooks.photos;
    if (!hooks || !this.cropper) return;
    this.photoStatus.textContent = 'Gør billedet klar …';
    this.pauseAutoClose();
    try {
      await this.cropper.open(file);
    } catch (error) {
      console.warn('Billede kunne ikke læses', error);
      this.photoStatus.textContent = 'Det billede kunne ikke bruges. Prøv et andet.';
    } finally {
      this.renderPhotos();
      this.armAutoClose();
    }
  }

  private async storeFace(dataUrl: string): Promise<void> {
    const hooks = this.hooks.photos;
    if (!hooks) return;
    if (this.photos.length >= hooks.max) {
      this.photoStatus.textContent = `Der er plads til ${hooks.max} billeder. Fjern et for at tilføje et nyt.`;
      return;
    }
    this.photos.push(await hooks.add(dataUrl));
    this.renderPhotos();
    hooks.onChange([...this.photos]);
  }

  private async removePhoto(id: string): Promise<void> {
    const hooks = this.hooks.photos;
    if (!hooks) return;
    await hooks.remove(id);
    this.photos = this.photos.filter((photo) => photo.id !== id);
    this.renderPhotos();
    hooks.onChange([...this.photos]);
    this.armAutoClose();
  }

  private renderPhotos(): void {
    const hooks = this.hooks.photos;
    if (!hooks) return;
    this.photoList.replaceChildren(
      ...this.photos.map((photo) => {
        const item = document.createElement('div');
        item.className = 'photo-item';
        const image = document.createElement('img');
        image.src = photo.dataUrl;
        image.alt = photo.name || 'Familiebillede';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'photo-remove';
        remove.dataset.remove = photo.id;
        remove.setAttribute('aria-label', 'Fjern billede');
        remove.textContent = '✕';
        item.append(image, remove);
        return item;
      }),
    );
    this.renderVoices();
    const count = this.photos.length;
    const full = count >= hooks.max;
    this.photoPick.parentElement!.hidden = full;
    this.photoSnap.parentElement!.hidden = full;
    this.photoStatus.textContent = full
      ? `Der er plads til ${hooks.max} billeder. Fjern et for at tilføje et nyt.`
      : count === 0
        ? 'Vælg et billede og klip ansigtet ud, så dukker det op på balloner. Billeder valgt her bliver kun på denne telefon.'
        : `${count} af ${hooks.max} billeder. Billeder valgt her bliver kun på denne telefon.`;
  }

  // ---- Statistics ------------------------------------------------------------

  private renderStats(): void {
    const hooks = this.hooks.stats;
    if (!hooks) return;
    const snapshot = hooks.snapshot();
    const names = hooks.photoNames();
    const rows: Array<[label: string, today: number, total: number, sub: boolean]> = [];
    for (const [key, label] of STAT_LABELS) {
      const total = snapshot.total[key] ?? 0;
      if (total === 0 && key !== 'pops') continue;
      rows.push([label.replace(/^… /, ''), snapshot.today[key] ?? 0, total, label.startsWith('…')]);
    }
    for (const [id, name] of Object.entries(names)) {
      const key = `photo:${id}`;
      const total = snapshot.total[key] ?? 0;
      if (total > 0) rows.push([`${name} poppet`, snapshot.today[key] ?? 0, total, true]);
    }
    this.statsBody.replaceChildren(
      ...rows.map(([label, today, total, sub]) => {
        const tr = document.createElement('tr');
        if (sub) tr.classList.add('is-sub');
        for (const text of [label, String(today), String(total)]) {
          const td = document.createElement('td');
          td.textContent = text;
          tr.append(td);
        }
        return tr;
      }),
    );
    this.statsFooter.textContent =
      `Legetid: ${formatMinutes(snapshot.playSecondsToday)} i dag, ${formatMinutes(snapshot.playSecondsTotal)} i alt ` +
      `siden ${snapshot.since}. Tallene bliver kun på telefonen.`;
  }

  // ---- Updates ---------------------------------------------------------------

  /** The menu looks for a new version by itself when it opens, at most this often. */
  private static readonly AUTO_CHECK_INTERVAL_MS = 10 * 60 * 1000;
  private lastAutoCheck = -Infinity;

  private async showVersion(): Promise<void> {
    const update = this.hooks.update;
    if (!update?.available || this.busy) return;
    const version = await update.version();
    if (!this.updateUrl) this.updateStatus.textContent = version ? `Du har version ${version}.` : '';
    // Check by itself when the menu opens, so "Ny version … er klar" and the install button are
    // there straight away without a tap on "Søg" (only on the phone; the web version updates itself).
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (online && Date.now() - this.lastAutoCheck > ParentPanel.AUTO_CHECK_INTERVAL_MS) {
      this.lastAutoCheck = Date.now();
      await this.checkForUpdate();
    }
  }

  private async checkForUpdate(): Promise<void> {
    const update = this.hooks.update;
    if (!update?.available || this.busy) return;
    if (this.updateReady || this.fetching) {
      // Already fetched (or on its way): nothing to look for, the status and the button are there.
      this.offerUpdate();
      return;
    }
    this.busy = true;
    this.updateStatus.textContent = 'Søger efter ny version …';
    this.updateInstall.hidden = true;
    this.updateNotes.hidden = true;
    let found: (UpdateCheck & { newer: boolean }) | null = null;
    try {
      const result = await update.check();
      if (result.newer) {
        found = result;
      } else {
        this.updateUrl = null;
        this.updateStatus.textContent = `Du har den nyeste version (${result.current}).`;
      }
    } catch (error) {
      this.updateUrl = null;
      this.updateStatus.textContent = 'Kunne ikke søge. Er telefonen på internettet?';
      console.warn('Opdateringstjek fejlede', error);
    } finally {
      this.busy = false;
      this.armAutoClose();
    }
    if (found) await this.fetchUpdate(found);
  }

  /**
   * Once a day, shortly after the app starts, it looks for a new version by itself and fetches it in the
   * background, so a parent only has to tap "Installér nu". A small dot on the corner button says it is ready.
   */
  async checkInBackground(): Promise<void> {
    const update = this.hooks.update;
    if (!update?.available || this.updateReady) return;
    try {
      const last = Number(localStorage.getItem(BACKGROUND_CHECK_KEY) ?? 0);
      if (Date.now() - last < BACKGROUND_CHECK_INTERVAL_MS) return;
      localStorage.setItem(BACKGROUND_CHECK_KEY, String(Date.now()));
    } catch {
      // No storage: check anyway, it is one small request.
    }
    try {
      const result = await update.check();
      if (result.newer) await this.fetchUpdate(result);
    } catch (error) {
      console.warn('Baggrunds-opdateringstjek fejlede', error);
    }
  }

  /** A newer version exists: fetch the APK now, so installing is one tap, and show it in the menu. */
  private async fetchUpdate(result: UpdateCheck): Promise<void> {
    const update = this.hooks.update;
    if (!update?.available || this.fetching) return;
    this.fetching = true;
    this.updateUrl = result.apk;
    this.updateVersion = result.latest;
    this.updateNotesText.textContent = result.notes.trim();
    this.updateNotes.hidden = !result.notes.trim();
    this.updateInstall.hidden = true;
    const describe = `Ny version ${result.latest} (${result.date}). Du har ${result.current}.`;
    this.updateStatus.textContent = `${describe} Henter …`;
    const stop = await update.onProgress((percent) => {
      if (!this.updateReady) this.updateStatus.textContent = `${describe} Henter … ${percent >= 0 ? `${percent} %` : ''}`;
    });
    try {
      await update.download(result.apk, result.latest);
      this.updateReady = true;
      this.updateStatus.textContent = `${describe} Hentet og klar til at installere.`;
    } catch (error) {
      // The download failed (no internet?): the button falls back to fetching on tap.
      this.updateReady = false;
      this.updateStatus.textContent = `${describe} Kunne ikke hente den endnu; prøv med knappen.`;
      console.warn('Opdateringen kunne ikke hentes i baggrunden', error);
    } finally {
      stop();
      this.fetching = false;
    }
    this.offerUpdate();
  }

  /** Shows the install button (and the dot on the corner button) for the update we know about. */
  private offerUpdate(): void {
    if (!this.updateUrl) return;
    this.updateInstall.textContent = this.updateReady ? '⬇️ Installér nu' : '⬇️ Hent og installér';
    this.updateInstall.hidden = this.fetching;
    element('parent-button').classList.toggle('has-update', this.updateReady);
  }

  private async installUpdate(): Promise<void> {
    const update = this.hooks.update;
    if (!update?.available || !this.updateUrl || this.busy) return;
    this.busy = true;
    this.updateInstall.hidden = true;
    this.updateStatus.textContent = this.updateReady ? 'Åbner installationen …' : 'Henter opdateringen …';
    const stop = await update.onProgress((percent) => {
      this.updateStatus.textContent = percent >= 0 ? `Henter opdateringen … ${percent} %` : 'Henter opdateringen …';
      this.armAutoClose();
    });
    try {
      await update.install(this.updateUrl, this.updateVersion);
      this.updateStatus.textContent =
        'Tryk "Installér" i telefonens vindue. Første gang skal du tillade, at appen må installere opdateringer.';
    } catch (error) {
      this.updateStatus.textContent = 'Opdateringen kunne ikke hentes. Prøv igen, eller hent den fra GitHub.';
      this.updateInstall.hidden = false;
      console.warn('Opdatering fejlede', error);
    } finally {
      stop();
      this.busy = false;
      this.armAutoClose();
    }
  }

  private async refreshLock(): Promise<void> {
    const lock = this.hooks.lock;
    if (!lock?.available) return;
    const status = await lock.status();
    this.setLocked(status.locked);
  }

  private setLocked(locked: boolean): void {
    this.locked = locked;
    this.lockButton.textContent = locked ? '🔓 Lås op – hold knappen nede' : '🔒 Lås appen fast på skærmen';
    this.lockButton.classList.toggle('is-locked', locked);
    this.lockStatus.textContent = locked
      ? 'Appen er låst: Hjem, Tilbage og notifikationer er spærret.'
      : 'Telefonen spørger "Fastgør?" – tryk OK. Lås op igen her, eller swipe op fra bunden og hold.';
  }

  private async lock(): Promise<void> {
    this.lockStatus.textContent = 'Tryk OK på telefonens spørgsmål …';
    await this.hooks.lock?.lock();
    this.armAutoClose();
  }

  private async unlock(): Promise<void> {
    await this.hooks.lock?.unlock();
    await this.refreshLock();
    this.armAutoClose();
  }
}
