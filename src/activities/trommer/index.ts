import type { Activity, ActivityContext } from '../../engine/activity';
import type { Settings } from '../../engine/parent';
import type { StoredPhoto } from '../../engine/photos';
import { TrommerGame } from './logic';
import { TrommerRenderer } from './render';
import { handleTrommerEvent } from './sounds';

/** Theos Trommer as an Activity: the pads' logic, their drawing and their sounds behind one small surface. */
export function createTrommer(canvas: HTMLCanvasElement, ctx: ActivityContext): Activity {
  const game = new TrommerGame();
  const renderer = new TrommerRenderer(canvas);
  let photos: StoredPhoto[] = [];
  let familyOn = ctx.settings().familyBalloons;
  game.onEvent((event) => handleTrommerEvent(event, ctx));
  const applyPhotos = () => {
    renderer.setPhotos(photos);
    // Faces on the notes only when the parents have the family switched on.
    game.setPhotos(familyOn ? photos.map((photo) => photo.id) : []);
  };
  return {
    id: 'trommer',
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
    debug: { game },
    dispose: () => undefined,
  };
}
