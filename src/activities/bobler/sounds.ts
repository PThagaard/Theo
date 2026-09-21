import { ImpactStyle } from '@capacitor/haptics';
import type { ActivityContext } from '../../engine/activity';
import type { AudioEngine } from '../../engine/audio';
import type { GuestEventWhat, GuestKind } from './logic';
import type { BoblerEvent } from './logic';

/** What the guests sound like as they come, are touched, act and leave. */
function guestSound(audio: AudioEngine | null, kind: GuestKind, what: GuestEventWhat, pokes: number): void {
  if (!audio) return;
  const now = audio.ctx.currentTime;
  switch (kind) {
    case 'whale':
      // Hidden, it only stirs the water and blows a few quiet bubbles; the first touch lets the water out with a
      // splash and its glad call; later touches just spout.
      if (what === 'appear') audio.plop(0.7);
      else if (what === 'drip') audio.plop(0.25);
      else if (what === 'poke') {
        audio.spout();
        if (pokes === 1) {
          audio.splash(true, now + 0.15);
          audio.whaleCall(now + 0.6);
        }
      } else if (what === 'leave' && pokes > 0) audio.splash(true);
      break;
    case 'fish':
      if (what === 'appear' || what === 'leave') audio.splash(false);
      else if (what === 'act' || what === 'fall') audio.splash(true);
      else if (what === 'ride') {
        // Caught in a bubble: a little whoop up, and a sparkle.
        audio.inflate();
        audio.sparkle(now + 0.3);
      } else if (what === 'poke') audio.blub();
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
      // Drips quietly until touched; the spray is the rain loop, which stops when the spray does.
      if (what === 'appear' || what === 'drip') audio.drip();
      else if (what === 'poke') {
        audio.splash(false);
        audio.startRain();
      } else if (what === 'act') audio.startRain();
      else if (what === 'stop' || what === 'leave') audio.stopRain();
      break;
    case 'bear':
      // A friendly "brum-brum" hello with every wave; a touch also bounces the floe.
      if (what === 'act') audio.bearHello();
      else if (what === 'poke') {
        audio.bearHello();
        audio.splash(false, now + 0.1);
      }
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
      guestSound(audio, event.kind, event.what, event.pokes ?? 0);
      if (event.what === 'poke') {
        ctx.haptic(ImpactStyle.Light);
        ctx.stats.bump('bathGuestsPoked');
        ctx.stats.bump(`guest:${event.kind}`);
      } else if (event.what === 'appear') {
        ctx.stats.bump('bathGuests');
      } else if (event.what === 'ride') {
        ctx.stats.bump('fishRides');
      } else if (event.what === 'fall') {
        ctx.stats.bump('fishFreed');
      }
      break;
    case 'sparkle':
      audio?.sparkle();
      break;
  }
}
