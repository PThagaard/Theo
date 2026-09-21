import type { Activity, ActivityContext } from '../../engine/activity';
import type { Settings } from '../../engine/parent';
import type { StoredPhoto } from '../../engine/photos';
import { BoblerGame } from './logic';
import { BoblerRenderer } from './render';
import { handleBoblerEvent } from './sounds';

/** Theos Bobler as an Activity: the bath's logic, its drawing and its sounds behind one small surface. */
export function createBobler(canvas: HTMLCanvasElement, ctx: ActivityContext): Activity {
  const game = new BoblerGame();
  const renderer = new BoblerRenderer(canvas);
  let photos: StoredPhoto[] = [];
  let familyOn = ctx.settings().familyBalloons;
  game.onEvent((event) => handleBoblerEvent(event, ctx));
  const applyPhotos = () => {
    renderer.setPhotos(photos);
    // Photo bubbles only appear when the parents have the family switched on.
    game.setPhotos(familyOn ? photos.map((photo) => photo.id) : []);
  };
  return {
    id: 'bobler',
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
    tilt: (roll) => game.setTilt(roll),
    applySettings: (settings: Settings) => {
      game.setTempo(settings.tempo);
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
    debug: { game },
    // The shower head's spray is a loop in the audio engine; it must not outlive the bath.
    dispose: () => ctx.audio()?.stopRain(),
  };
}
