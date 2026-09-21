import type { Activity, ActivityContext } from '../../engine/activity';
import type { Settings } from '../../engine/parent';
import type { StoredPhoto } from '../../engine/photos';
import { Game } from './game';
import { Renderer } from './render';
import { handleBallonerEvent } from './sounds';

/** Theos Balloner as an activity: the game logic, its drawing and its sounds behind one small surface. */
export function createBalloner(canvas: HTMLCanvasElement, ctx: ActivityContext): Activity {
  const game = new Game();
  const renderer = new Renderer(canvas);
  let photos: StoredPhoto[] = [];
  let familyOn = ctx.settings().familyBalloons;
  game.onEvent((event) => handleBallonerEvent(event, ctx));
  const applyPhotos = () => {
    renderer.setPhotos(photos);
    // Photo balloons only appear when the parents have them switched on.
    game.setPhotos(familyOn ? photos.map((photo) => photo.id) : []);
  };
  return {
    id: 'balloner',
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
    dispose: () => undefined,
  };
}
