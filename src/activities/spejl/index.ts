import type { Activity, ActivityContext } from '../../engine/activity';
import type { Settings } from '../../engine/parent';
import type { StoredPhoto } from '../../engine/photos';
import { SpejlGame } from './logic';
import { SpejlRenderer } from './render';
import { handleSpejlEvent } from './sounds';

/**
 * Theos Spejl as an Activity: the mirror's logic, its drawing and its sounds, plus the one thing only this file
 * does: it opens the front camera and hands the live picture to the renderer, which draws it on the canvas and
 * nowhere else. Nothing is recorded, stored or sent; the camera is closed the moment the game is left. Without a
 * camera (no permission, no camera, the web version on a desktop) the game plays on a soft backdrop instead.
 */
export function createSpejl(canvas: HTMLCanvasElement, ctx: ActivityContext): Activity {
  const game = new SpejlGame();
  const renderer = new SpejlRenderer(canvas);
  let photos: StoredPhoto[] = [];
  let familyOn = ctx.settings().familyBalloons;
  let stream: MediaStream | null = null;
  let video: HTMLVideoElement | null = null;
  let disposed = false;
  game.onEvent((event) => handleSpejlEvent(event, ctx));
  const applyPhotos = () => {
    renderer.setPhotos(photos);
    game.setPhotos(familyOn ? photos.map((photo) => photo.id) : []);
  };
  const closeCamera = () => {
    renderer.setVideo(null);
    if (video) video.srcObject = null;
    video = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  };
  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const opened = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (disposed) {
        opened.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = opened;
      const element = document.createElement('video');
      element.muted = true;
      element.playsInline = true;
      element.autoplay = true;
      element.srcObject = opened;
      await element.play().catch(() => undefined);
      video = element;
      renderer.setVideo(element);
    } catch (error) {
      // No camera, or the parents said no: the mirror plays on its backdrop instead.
      console.warn('Kameraet kunne ikke åbnes', error);
    }
  };
  void openCamera();
  return {
    id: 'spejl',
    resize: (width, height, dpr) => {
      game.resize(width, height);
      renderer.resize(width, height, dpr);
    },
    update: (dt) => game.update(dt),
    render: (dt) => renderer.draw(game, dt),
    press: (id, x, y) => game.press(id, x, y),
    drag: (id, x, y) => game.drag(id, x, y),
    release: (id) => game.release(id),
    shake: () => game.shake(),
    applySettings: (settings: Settings) => {
      game.setAge(settings.age);
      familyOn = settings.familyBalloons;
      applyPhotos();
    },
    setPhotos: (list) => {
      photos = list;
      applyPhotos();
    },
    sleep: () => game.sleep(),
    wake: () => game.wake(),
    get asleep() {
      return game.asleep;
    },
    debug: { game, hasVideo: () => video !== null && video.readyState >= 2 },
    dispose: () => {
      disposed = true;
      closeCamera();
    },
  };
}
