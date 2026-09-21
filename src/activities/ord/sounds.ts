import { ImpactStyle } from '@capacitor/haptics';
import type { ActivityContext } from '../../engine/activity';
import type { AudioEngine } from '../../engine/audio';
import type { OrdEvent, Thing } from './logic';

/** The thing's own sound (the dog barks, the balloon pops a little), before the parent's word. */
function thingSound(audio: AudioEngine, thing: Thing): void {
  switch (thing.creature) {
    case 'dog':
      audio.bark();
      return;
    case 'elephant':
      audio.trumpet();
      return;
    case 'bird':
      audio.chirp();
      return;
    case 'butterfly':
      audio.flutter();
      return;
    case 'snail':
      audio.blub();
      return;
    case 'tractor':
      audio.honk();
      return;
    default:
      break;
  }
  if (thing.kind === 'balloon') audio.boing();
  else if (thing.kind === 'photo') audio.tada();
}

/** Turns the Ord activity's events into sound, vibration, counters and the parents' words. */
export function handleOrdEvent(event: OrdEvent, thing: Thing, ctx: ActivityContext): void {
  const audio = ctx.audio();
  switch (event.type) {
    case 'touch':
      if (audio) thingSound(audio, thing);
      ctx.say(event.key, 0.5, 1.5);
      ctx.haptic(ImpactStyle.Light);
      ctx.stats.bump('ordTouched');
      break;
    case 'peek':
      audio?.sparkle();
      if (audio) thingSound(audio, thing);
      ctx.say(event.key, 0.6, 1.5);
      ctx.haptic(ImpactStyle.Medium);
      ctx.stats.bump('ordPeeks');
      break;
    case 'next':
      audio?.wee();
      ctx.stats.bump('ordNext');
      break;
    case 'enter':
      audio?.chime();
      break;
    case 'sparkle':
      audio?.sparkle();
      break;
  }
}
