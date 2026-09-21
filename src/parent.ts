import type { KidLock } from './kidlock';

/**
 * Parent menu: music and sound on/off, and (on Android) locking the app to the screen.
 * It opens by holding the small corner button for two seconds with one finger, which a
 * whole resting hand never does, and closes itself again after a while.
 */

export interface Settings {
  music: boolean;
  sfx: boolean;
  /** Ask to pin the app to the screen every time it starts (Android). */
  autoLock: boolean;
}

export interface ParentPanelHooks {
  onChange(settings: Settings): void;
  lock?: KidLock;
}

const STORAGE_KEY = 'theos-balloner.settings';
const DEFAULTS: Settings = { music: true, sfx: true, autoLock: false };
const HOLD_MS = 2000;
const AUTO_CLOSE_MS = 15000;

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
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
  private readonly lockSection = element<HTMLElement>('lock-section');
  private readonly lockButton = element<HTMLButtonElement>('lock-button');
  private readonly lockStatus = element<HTMLElement>('lock-status');
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

    for (const toggle of [this.musicToggle, this.sfxToggle, this.autoLockToggle]) {
      toggle.addEventListener('change', () => this.changed());
    }
    element<HTMLButtonElement>('parent-close').addEventListener('click', () => this.close());
    this.panel.addEventListener('pointerdown', () => this.armAutoClose());
  }

  get isOpen(): boolean {
    return !this.panel.hidden;
  }

  open(): void {
    this.panel.hidden = false;
    this.armAutoClose();
    void this.refreshLock();
    if (this.lockPoll) clearInterval(this.lockPoll);
    this.lockPoll = setInterval(() => void this.refreshLock(), 1000);
  }

  close(): void {
    this.panel.hidden = true;
    if (this.autoClose) clearTimeout(this.autoClose);
    this.autoClose = null;
    if (this.lockPoll) clearInterval(this.lockPoll);
    this.lockPoll = null;
  }

  private armAutoClose(): void {
    if (this.autoClose) clearTimeout(this.autoClose);
    this.autoClose = setTimeout(() => this.close(), AUTO_CLOSE_MS);
  }

  private changed(): void {
    this.settings.music = this.musicToggle.checked;
    this.settings.sfx = this.sfxToggle.checked;
    this.settings.autoLock = this.autoLockToggle.checked;
    this.hooks.onChange({ ...this.settings });
    this.armAutoClose();
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
