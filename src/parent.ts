/**
 * Tiny parent menu (music and sound on/off). It opens by holding the small
 * corner button for two seconds, which small hands practically never do by
 * accident, and closes itself again after a while.
 */

export interface Settings {
  music: boolean;
  sfx: boolean;
}

const STORAGE_KEY = 'theos-balloner.settings';
const DEFAULTS: Settings = { music: true, sfx: true };
const HOLD_MS = 2000;
const AUTO_CLOSE_MS = 12000;

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

export class ParentPanel {
  private readonly button = element<HTMLButtonElement>('parent-button');
  private readonly panel = element<HTMLElement>('parent-panel');
  private readonly musicToggle = element<HTMLInputElement>('opt-music');
  private readonly sfxToggle = element<HTMLInputElement>('opt-sfx');
  private holdStart = 0;
  private holdFrame = 0;
  private autoClose: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly settings: Settings,
    private readonly onChange: (settings: Settings) => void,
  ) {
    this.musicToggle.checked = settings.music;
    this.sfxToggle.checked = settings.sfx;

    this.button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.beginHold();
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
      this.button.addEventListener(type, () => this.cancelHold());
    }
    this.button.addEventListener('contextmenu', (event) => event.preventDefault());

    this.musicToggle.addEventListener('change', () => this.changed());
    this.sfxToggle.addEventListener('change', () => this.changed());
    element<HTMLButtonElement>('parent-close').addEventListener('click', () => this.close());
    this.panel.addEventListener('pointerdown', () => this.armAutoClose());
  }

  get isOpen(): boolean {
    return !this.panel.hidden;
  }

  open(): void {
    this.panel.hidden = false;
    this.armAutoClose();
  }

  close(): void {
    this.panel.hidden = true;
    if (this.autoClose) clearTimeout(this.autoClose);
    this.autoClose = null;
  }

  private beginHold(): void {
    this.holdStart = performance.now();
    cancelAnimationFrame(this.holdFrame);
    this.tickHold();
  }

  private readonly tickHold = (): void => {
    const progress = (performance.now() - this.holdStart) / HOLD_MS;
    this.button.style.setProperty('--progress', String(Math.min(1, progress)));
    if (progress >= 1) {
      this.cancelHold();
      this.open();
      return;
    }
    this.holdFrame = requestAnimationFrame(this.tickHold);
  };

  private cancelHold(): void {
    cancelAnimationFrame(this.holdFrame);
    this.holdFrame = 0;
    this.button.style.setProperty('--progress', '0');
  }

  private armAutoClose(): void {
    if (this.autoClose) clearTimeout(this.autoClose);
    this.autoClose = setTimeout(() => this.close(), AUTO_CLOSE_MS);
  }

  private changed(): void {
    this.settings.music = this.musicToggle.checked;
    this.settings.sfx = this.sfxToggle.checked;
    this.onChange({ ...this.settings });
    this.armAutoClose();
  }
}
