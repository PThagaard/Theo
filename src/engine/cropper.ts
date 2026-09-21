import { cropToDataUrl, imageSize, loadImage, releaseImage, type LoadedImage } from './photos';

/**
 * Face cropper for the parent menu: the picked picture sits behind a round window; drag to
 * move it, use the slider or two fingers to zoom, then save. Family photos are usually group
 * photos, so the same picture can be used again for the next face.
 */

const VIEW = 260;
const MAX_ZOOM = 5;

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Mangler element #${id}`);
  return found as T;
}

export class Cropper {
  private readonly dialog = element<HTMLElement>('crop-dialog');
  private readonly canvas = element<HTMLCanvasElement>('crop-canvas');
  private readonly zoom = element<HTMLInputElement>('crop-zoom');
  private readonly save = element<HTMLButtonElement>('crop-save');
  private readonly again = element<HTMLButtonElement>('crop-again');
  private readonly cancel = element<HTMLButtonElement>('crop-cancel');
  private readonly status = element<HTMLElement>('crop-status');
  private image: LoadedImage | null = null;
  private width = 1;
  private height = 1;
  private scale = 1;
  private panX = 0;
  private panY = 0;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private resolveOpen: ((dataUrl: string | null) => void) | null = null;
  private savedFromThisPicture = 0;

  constructor(private readonly onSave: (dataUrl: string) => Promise<void>) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas er ikke understøttet');
    this.canvas.width = VIEW * 2;
    this.canvas.height = VIEW * 2;
    ctx.setTransform(2, 0, 0, 2, 0, 0);

    this.canvas.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.pinchDistance = this.distance();
    });
    this.canvas.addEventListener('pointermove', (event) => {
      const previous = this.pointers.get(event.pointerId);
      if (!previous) return;
      event.preventDefault();
      if (this.pointers.size === 1) {
        this.panX += event.clientX - previous.x;
        this.panY += event.clientY - previous.y;
      }
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.pointers.size === 2) {
        const distance = this.distance();
        if (this.pinchDistance > 0) this.setZoom((this.scale * distance) / this.pinchDistance);
        this.pinchDistance = distance;
      }
      this.clampPan();
      this.draw();
    });
    const end = (event: PointerEvent) => {
      this.pointers.delete(event.pointerId);
      this.pinchDistance = this.distance();
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.zoom.addEventListener('input', () => {
      this.setZoom(parseFloat(this.zoom.value));
      this.clampPan();
      this.draw();
    });
    this.save.addEventListener('click', () => void this.saveFace());
    this.again.addEventListener('click', () => this.resetFraming());
    this.cancel.addEventListener('click', () => this.close());
  }

  get isOpen(): boolean {
    return !this.dialog.hidden;
  }

  /** Opens the cropper for a picked file. Resolves when the parent closes it. */
  async open(file: Blob): Promise<void> {
    this.image = await loadImage(file);
    const { width, height } = imageSize(this.image);
    this.width = width;
    this.height = height;
    this.savedFromThisPicture = 0;
    this.dialog.hidden = false;
    this.resetFraming();
    await new Promise<void>((resolve) => {
      this.resolveOpen = () => resolve();
    });
  }

  private resetFraming(): void {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.zoom.value = '1';
    this.again.hidden = true;
    this.status.textContent = 'Træk billedet, så ansigtet sidder i cirklen. Zoom med skyderen eller to fingre.';
    this.draw();
  }

  /** Scale that makes the picture just cover the round window. */
  private get baseScale(): number {
    return VIEW / Math.min(this.width, this.height);
  }

  private setZoom(zoom: number): void {
    this.scale = Math.min(MAX_ZOOM, Math.max(1, zoom));
    this.zoom.value = String(this.scale);
  }

  private clampPan(): void {
    const s = this.baseScale * this.scale;
    const maxX = Math.max(0, (this.width * s - VIEW) / 2);
    const maxY = Math.max(0, (this.height * s - VIEW) / 2);
    this.panX = Math.min(maxX, Math.max(-maxX, this.panX));
    this.panY = Math.min(maxY, Math.max(-maxY, this.panY));
  }

  private distance(): number {
    const points = Array.from(this.pointers.values());
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  /** Where the picture's top-left corner sits in the window, in window pixels. */
  private origin(): { x: number; y: number; s: number } {
    const s = this.baseScale * this.scale;
    return { x: VIEW / 2 - (this.width * s) / 2 + this.panX, y: VIEW / 2 - (this.height * s) / 2 + this.panY, s };
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx || !this.image) return;
    const { x, y, s } = this.origin();
    ctx.clearRect(0, 0, VIEW, VIEW);
    ctx.drawImage(this.image, x, y, this.width * s, this.height * s);
    // Darken everything outside the circle so the parent sees exactly what the balloon will show.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW, VIEW);
    ctx.arc(VIEW / 2, VIEW / 2, VIEW / 2 - 2, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(30, 20, 50, 0.55)';
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#ffd93d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(VIEW / 2, VIEW / 2, VIEW / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  private async saveFace(): Promise<void> {
    if (!this.image) return;
    const { x, y, s } = this.origin();
    const dataUrl = cropToDataUrl(this.image, -x / s, -y / s, VIEW / s);
    this.save.disabled = true;
    try {
      await this.onSave(dataUrl);
      this.savedFromThisPicture++;
      this.status.textContent =
        this.savedFromThisPicture === 1
          ? 'Gemt! Er der flere ansigter på billedet, så træk det næste ind i cirklen og gem igen.'
          : `Gemt (${this.savedFromThisPicture} fra dette billede). Træk det næste ansigt ind, eller luk.`;
      this.again.hidden = false;
    } finally {
      this.save.disabled = false;
    }
  }

  close(): void {
    this.dialog.hidden = true;
    if (this.image) releaseImage(this.image);
    this.image = null;
    this.pointers.clear();
    this.resolveOpen?.(null);
    this.resolveOpen = null;
  }
}
