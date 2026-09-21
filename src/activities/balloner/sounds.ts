import { ImpactStyle } from '@capacitor/haptics';
import type { ActivityContext } from '../../engine/activity';
import type { AudioEngine } from '../../engine/audio';
import { photoVoiceKey } from '../../engine/voices';
import type { GameEvent, VisitorKind } from './types';

/**
 * Turns the balloon game's events into sound, vibration, counters and the parents' words. The game logic
 * knows nothing about audio; this is the one place that does, so the sound side stays swappable.
 */
export function handleBallonerEvent(event: GameEvent, ctx: ActivityContext): void {
  const audio = ctx.audio();
  switch (event.type) {
    case 'pop':
      audio?.pop(event.size);
      if (event.kind === 'star') audio?.chime();
      else if (event.kind === 'rainbow') audio?.boing();
      else if (event.kind === 'photo') audio?.tada();
      // A parent's voice says who it was, or now and then "ballon".
      if (event.kind === 'photo' && event.photoId) ctx.say(photoVoiceKey(event.photoId), 0.5, 2);
      else ctx.say('ballon', 0.3, 4);
      ctx.haptic(ImpactStyle.Medium);
      ctx.stats.bump('pops');
      if (event.kind === 'star') ctx.stats.bump('popsStar');
      if (event.kind === 'rainbow') ctx.stats.bump('popsRainbow');
      if (event.kind === 'photo') {
        ctx.stats.bump('popsPhoto');
        if (event.photoId) ctx.stats.bump(`photo:${event.photoId}`);
      }
      break;
    case 'spawn':
      audio?.inflate();
      ctx.stats.bump('balloonsMade');
      break;
    case 'sparkle':
      audio?.sparkle();
      ctx.haptic(ImpactStyle.Light);
      ctx.stats.bump('skyTouches');
      break;
    case 'glide':
      audio?.glide(event.note);
      ctx.stats.bump('harpNotes');
      break;
    case 'blow':
      ctx.stats.bump('blown');
      break;
    case 'swipe':
      ctx.stats.bump('swipes');
      break;
    case 'sun':
      audio?.wee();
      ctx.say('sol', 0.4, 2.5);
      ctx.haptic(ImpactStyle.Light);
      ctx.stats.bump('sun');
      break;
    case 'cloud':
      audio?.rain();
      ctx.say('sky', 0.4, 2.5);
      ctx.haptic(ImpactStyle.Light);
      ctx.stats.bump('clouds');
      break;
    case 'shake':
      audio?.rattle();
      ctx.haptic(ImpactStyle.Heavy);
      ctx.stats.bump('shakes');
      break;
    case 'flower':
      if (event.what === 'spin') {
        audio?.twirl();
        ctx.stats.bump('flowersSpun');
      } else {
        audio?.pluck();
        ctx.stats.bump('flowersPlucked');
      }
      ctx.say('blomst', 0.4, 2.5);
      ctx.haptic(ImpactStyle.Light);
      break;
    case 'visitor':
      visitorSound(audio, event.kind, event.what);
      if (event.what === 'appear' && event.kind === 'storm') ctx.say('regn', 1.5, 20);
      if (event.what === 'poke') {
        const word = wordForVisitor(event.kind);
        if (word) ctx.say(word, 0.45, 2);
        ctx.haptic(ImpactStyle.Light);
        ctx.stats.bump('visitorsPoked');
        ctx.stats.bump(`visitor:${event.kind}`);
      } else if (event.what === 'appear') {
        ctx.stats.bump(event.kind === 'storm' ? 'storms' : 'visitorsSeen');
      }
      break;
    case 'carry':
      if (event.what === 'hooked') {
        audio?.boing();
        ctx.stats.bump('creaturesLifted');
      } else if (event.what === 'help') {
        audio?.help(event.kind);
      } else if (event.what === 'released') {
        audio?.sparkle();
      } else {
        audio?.land();
        ctx.haptic(ImpactStyle.Light);
      }
      break;
    case 'lightning':
      if (event.quick) audio?.zap();
      else audio?.thunder();
      if (!event.quick) ctx.say('lyn', 0.6, 4);
      ctx.haptic(event.quick ? ImpactStyle.Light : ImpactStyle.Heavy);
      ctx.stats.bump('lightning');
      break;
    case 'hold':
      if (event.what === 'storm') {
        audio?.thunder();
        ctx.stats.bump('stormsSummoned');
      } else if (event.what === 'burst') {
        audio?.burst();
        ctx.stats.bump('bursts');
      } else {
        audio?.sunburst();
        ctx.stats.bump('sunbursts');
      }
      ctx.haptic(ImpactStyle.Heavy);
      break;
    case 'transform':
      if (event.form === 'hotdog') audio?.sizzle();
      else if (event.form === 'mouse') audio?.squeak();
      else if (event.form === 'puffed') audio?.chirp();
      else audio?.sparkle();
      if (event.form) ctx.stats.bump('transformations');
      break;
    case 'celebrate':
      audio?.fanfare();
      ctx.haptic(ImpactStyle.Heavy);
      ctx.stats.bump('celebrations');
      break;
  }
}

function visitorSound(audio: AudioEngine | null, kind: VisitorKind, what: 'appear' | 'poke' | 'leave'): void {
  if (!audio) return;
  switch (kind) {
    case 'storm':
      if (what === 'appear') {
        audio.rumble();
        audio.startRain();
      } else if (what === 'leave') {
        audio.stopRain();
        audio.clearing();
      }
      break;
    case 'dog':
      audio.bark();
      break;
    case 'elephant':
      if (what === 'appear') audio.rumble();
      else audio.trumpet();
      break;
    case 'bird':
      audio.chirp();
      break;
    case 'butterfly':
      audio.flutter();
      break;
    case 'snail':
      if (what === 'poke') audio.blub();
      break;
    case 'tractor':
      if (what === 'appear') audio.putter();
      else if (what === 'poke') audio.honk();
      break;
    case 'star':
      if (what === 'appear') audio.sparkle();
      else audio.chime();
      break;
  }
}

/** The word (see engine/voices.ts) for a visitor, or null for those without one (the star, the storm itself). */
export function wordForVisitor(kind: VisitorKind): string | null {
  switch (kind) {
    case 'dog':
      return 'hund';
    case 'elephant':
      return 'elefant';
    case 'bird':
      return 'fugl';
    case 'butterfly':
      return 'sommerfugl';
    case 'snail':
      return 'snegl';
    case 'tractor':
      return 'traktor';
    default:
      return null;
  }
}
