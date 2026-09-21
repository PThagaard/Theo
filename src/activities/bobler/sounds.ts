import { ImpactStyle } from '@capacitor/haptics';
import type { ActivityContext } from '../../engine/activity';
import type { AudioEngine } from '../../engine/audio';
import type { GuestKind } from './logic';
import type { BoblerEvent } from './logic';

/** What the guests sound like as they come, are touched, act and leave. */
function guestSound(audio: AudioEngine | null, kind: GuestKind, what: 'appear' | 'poke' | 'act' | 'leave'): void {
  if (!audio) return;
  const now = audio.ctx.currentTime;
  switch (kind) {
    case 'whale':
      if (what === 'appear') {
        audio.splash(true);
        audio.whaleCall(now + 0.4);
      } else if (what === 'poke') audio.spout();
      else if (what === 'leave') audio.splash(true);
      break;
    case 'fish':
      if (what === 'appear' || what === 'leave') audio.splash(false);
      else if (what === 'act') audio.splash(true);
      else audio.blub();
      break;
    case 'boat':
      // The cow moos, then the boat toots its old horn.
      if (what === 'appear') audio.putter();
      else if (what === 'poke') {
        audio.moo();
        audio.honk(now + 1.0);
      }
      break;
    case 'jetski':
      if (what === 'appear') audio.whine();
      else if (what === 'poke') {
        audio.squawk();
        audio.whine(now + 0.35);
      }
      break;
    case 'shower':
      if (what === 'appear') audio.startRain();
      else if (what === 'leave') audio.stopRain();
      else if (what === 'poke') audio.splash(false);
      break;
  }
}

/** Turns the bath's events into sound, vibration and counters (no spoken words here: those belong to Ord). */
export function handleBoblerEvent(event: BoblerEvent, ctx: ActivityContext): void {
  const audio = ctx.audio();
  switch (event.type) {
    case 'pop':
      audio?.plop(event.size);
      if (event.kind === 'star') audio?.chime();
      else if (event.kind === 'photo') audio?.tada();
      ctx.haptic(ImpactStyle.Medium);
      ctx.stats.bump('bubblesPopped');
      if (event.kind === 'star') ctx.stats.bump('bubblesPoppedStar');
      if (event.kind === 'photo') {
        ctx.stats.bump('bubblesPoppedPhoto');
        if (event.photoId) ctx.stats.bump(`photo:${event.photoId}`);
      }
      break;
    case 'splash':
      audio?.splash(event.big);
      ctx.haptic(ImpactStyle.Light);
      ctx.stats.bump('splashes');
      break;
    case 'quack':
      audio?.quack();
      ctx.haptic(ImpactStyle.Light);
      ctx.stats.bump('quacks');
      break;
    case 'dash':
      // Off it goes: a quack, a whoop and a good buzz in the hand.
      audio?.quack();
      audio?.wee(audio.ctx.currentTime + 0.3);
      ctx.haptic(ImpactStyle.Heavy);
      ctx.stats.bump('duckDashes');
      break;
    case 'soap':
      audio?.sparkle();
      ctx.haptic(ImpactStyle.Light);
      ctx.stats.bump('soapTouches');
      break;
    case 'grow':
      audio?.inflate();
      ctx.stats.bump('bubblesBlown');
      break;
    case 'blow':
      audio?.wee();
      break;
    case 'burst':
      audio?.burst();
      ctx.haptic(ImpactStyle.Heavy);
      ctx.stats.bump('bubbleBursts');
      break;
    case 'shake':
      audio?.gurgle();
      ctx.haptic(ImpactStyle.Heavy);
      ctx.stats.bump('bubbleShakes');
      break;
    case 'celebration':
      audio?.fanfare();
      ctx.stats.bump('bubbleCelebrations');
      break;
    case 'swipe':
      ctx.stats.bump('bubbleSwipes');
      break;
    case 'guest':
      guestSound(audio, event.kind, event.what);
      if (event.what === 'poke') {
        ctx.haptic(ImpactStyle.Light);
        ctx.stats.bump('bathGuestsPoked');
        ctx.stats.bump(`guest:${event.kind}`);
      } else if (event.what === 'appear') {
        ctx.stats.bump('bathGuests');
      }
      break;
    case 'sparkle':
      audio?.sparkle();
      break;
  }
}
