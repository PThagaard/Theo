import type { Activity, ActivityContext } from '../../engine/activity';
import type { Settings } from '../../engine/parent';
import type { StoredPhoto } from '../../engine/photos';
import { BoldeGame } from './logic';
import { BoldeRenderer } from './render';
import { handleBoldeEvent } from './sounds';

/** Theos Bolde as an Activity: the balls' physics, their drawing and their sounds behind one small surface. */
export function createBolde(canvas: HTMLCanvasElement, ctx: ActivityContext): Activity {
  const game = new BoldeGame();
  const renderer = new BoldeRenderer(canvas);
  let photos: StoredPhoto[] = [];
  let familyOn = ctx.settings().familyBalloons;
  game.onEvent((event) => handleBoldeEvent(event, ctx));
  const applyPhotos = () => {
    renderer.setPhotos(photos);
    // Faces on the balls only when the parents have the family switched on.
    game.setPhotos(familyOn ? photos.map((photo) => photo.id) : []);
  };
  return {
    id: 'bolde',
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
    // The balls feel every move of the phone (a tilt, a jerk, a shake), not just its roll.
    motion: (x, y) => game.setMotion(x, y),
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
