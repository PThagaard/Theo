import type { Activity, ActivityContext } from '../../engine/activity';
import type { Settings } from '../../engine/parent';
import type { StoredPhoto } from '../../engine/photos';
import { OrdGame } from './logic';
import { OrdRenderer } from './render';
import { handleOrdEvent } from './sounds';

/** "Titte-bøh og Ord" as an Activity (see logic.ts). */
export function createOrd(canvas: HTMLCanvasElement, ctx: ActivityContext): Activity {
  const game = new OrdGame();
  const renderer = new OrdRenderer(canvas);
  let photos: StoredPhoto[] = [];
  let familyOn = ctx.settings().familyBalloons;
  game.onEvent((event) => handleOrdEvent(event, ctx));
  const applyPhotos = () => {
    renderer.setPhotos(photos);
    game.setPhotos(familyOn ? photos.map((photo) => photo.id) : []);
  };
  return {
    id: 'ord',
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
    debug: { game, ord: game },
    dispose: () => undefined,
  };
}
