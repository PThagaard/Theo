import { Cropper } from './cropper';
import type { KidLock } from './kidlock';
import type { StoredPhoto } from './photos';
import { STAT_LABELS, formatMinutes, type StatsSnapshot } from './stats';
import type { AppUpdate } from './update';

/**
 * Parent menu: music and sound on/off, and (on Android) locking the app to the screen.
 * It opens by holding the small corner button for two seconds with one finger, which a
 * whole resting hand never does, and closes itself again after a while.
 */

export type Tempo = 'rolig' | 'normal' | 'vild';

export interface Settings {
  music: boolean;
  sfx: boolean;
  /** Ask to pin the app to the screen every time it starts (Android). */
  autoLock: boolean;
  /** How busy the sky is. */
  tempo: Tempo;
  /** Show family photos on balloons. */
  familyBalloons: boolean;
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

export interface StatsHooks {
  snapshot(): StatsSnapshot;
  reset(): void;
  /** Names of family photos, for "Mor poppet" rows (photo id -> name). */
  photoNames(): Record<string, string>;
}

export interface ParentPanelHooks {
  onChange(settings: Settings): void;
  lock?: KidLock;
  photos?: PhotoHooks;
  update?: AppUpdate;
  stats?: StatsHooks;
}

const STORAGE_KEY = 'theos-balloner.settings';
/** The menu remembers which page it was on (a small convenience, kept in the browser only). */
const TAB_KEY = 'theos-balloner.parentTab';
type TabName = 'leg' | 'familie' | 'theo' | 'telefon';
const TABS: TabName[] = ['leg', 'familie', 'theo', 'telefon'];
const DEFAULTS: Settings = { music: true, sfx: true, autoLock: false, tempo: 'normal', familyBalloons: true };
const TEMPOS: Tempo[] = ['rolig', 'normal', 'vild'];
const HOLD_MS = 2000;
const AUTO_CLOSE_MS = 15000;

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
      if (!TEMPOS.includes(stored.tempo)) stored.tempo = 'normal';
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
  private readonly sfxToggle = element<HTMLInputElement>('opt-sfx');
  private readonly autoLockToggle = element<HTMLInputElement>('opt-autolock');
  private readonly familyToggle = element<HTMLInputElement>('opt-family');
  private readonly tempoButtons = Array.from(element<HTMLElement>('tempo-options').querySelectorAll<HTMLButtonElement>('button[data-tempo]'));
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
  private readonly updateSection = element<HTMLElement>('update-section');
  private readonly updateStatus = element<HTMLElement>('update-status');
  private readonly updateCheck = element<HTMLButtonElement>('update-check');
  private readonly updateInstall = element<HTMLButtonElement>('update-install');
  private readonly updateNotes = element<HTMLDetailsElement>('update-notes');
  private readonly updateNotesText = element<HTMLElement>('update-notes-text');
  private updateUrl: string | null = null;
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
    for (const button of this.tempoButtons) {
      button.addEventListener('click', () => {
        this.settings.tempo = button.dataset.tempo as Tempo;
        this.renderTempo();
        this.changed();
      });
    }
    this.renderTempo();

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
    this.busy = true;
    this.updateStatus.textContent = 'Søger efter ny version …';
    this.updateInstall.hidden = true;
    this.updateNotes.hidden = true;
    try {
      const result = await update.check();
      if (result.newer) {
        this.updateUrl = result.apk;
        this.updateStatus.textContent = `Ny version ${result.latest} (${result.date}) er klar. Du har ${result.current}.`;
        this.updateNotesText.textContent = result.notes.trim();
        this.updateNotes.hidden = !result.notes.trim();
        this.updateInstall.hidden = false;
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
  }

  private async installUpdate(): Promise<void> {
    const update = this.hooks.update;
    if (!update?.available || !this.updateUrl || this.busy) return;
    this.busy = true;
    this.updateInstall.hidden = true;
    this.updateStatus.textContent = 'Henter opdateringen …';
    const stop = await update.onProgress((percent) => {
      this.updateStatus.textContent = percent >= 0 ? `Henter opdateringen … ${percent} %` : 'Henter opdateringen …';
      this.armAutoClose();
    });
    try {
      await update.install(this.updateUrl);
      this.updateStatus.textContent =
        'Hentet. Tryk "Installér" i telefonens vindue. Første gang skal du tillade, at appen må installere opdateringer.';
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
