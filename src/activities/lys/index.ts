import type { Activity, ActivityContext } from '../../engine/activity';
import type { Settings } from '../../engine/parent';
import type { StoredPhoto } from '../../engine/photos';
import { LysGame } from './logic';
import { LysRenderer } from './render';
import { handleLysEvent } from './sounds';

/** Theos Lys as an Activity: the night's logic, its drawing and its sounds behind one small surface. */
export function createLys(canvas: HTMLCanvasElement, ctx: ActivityContext): Activity {
  const game = new LysGame();
  const renderer = new LysRenderer(canvas);
  let photos: StoredPhoto[] = [];
  let familyOn = ctx.settings().familyBalloons;
  game.onEvent((event) => handleLysEvent(event, ctx));
  const applyPhotos = () => {
    renderer.setPhotos(photos);
    // Faces in the lanterns only when the parents have the family switched on.
    game.setPhotos(familyOn ? photos.map((photo) => photo.id) : []);
  };
  return {
    id: 'lys',
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
    // The lanterns and the stardust drift with the phone's tilt, like a soft wind.
    tilt: (roll) => game.setTilt(roll),
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
    debug: { game },
    dispose: () => undefined,
  };
}
