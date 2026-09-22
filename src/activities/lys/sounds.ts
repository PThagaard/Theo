import { ImpactStyle } from '@capacitor/haptics';
import type { ActivityContext } from '../../engine/activity';
import type { LysEvent } from './logic';

/** Turns the night's events into sound, vibration and counters. No words: this is a light-and-dark toy. */
export function handleLysEvent(event: LysEvent, ctx: ActivityContext): void {
  const audio = ctx.audio();
  switch (event.type) {
    case 'star':
      // A soft bell, higher up the screen higher in pitch.
      audio?.bell(event.note);
      ctx.haptic(ImpactStyle.Light);
      ctx.stats.bump('lightsLit');
      break;
    case 'flare':
      audio?.sparkle();
      ctx.stats.bump('lightFlares');
      break;
    case 'trail':
      audio?.glide(event.note);
      if (event.first) ctx.stats.bump('lightTrails');
      break;
    case 'lantern':
      switch (event.what) {
        case 'lit':
          audio?.kindle();
          ctx.haptic(ImpactStyle.Medium);
          break;
        case 'rise':
          audio?.inflate();
          ctx.haptic(ImpactStyle.Light);
          ctx.stats.bump('lanterns');
          break;
        case 'tap':
          audio?.pluck();
          ctx.haptic(ImpactStyle.Light);
          ctx.stats.bump('lanternTaps');
          break;
        case 'push':
          audio?.pluck();
          break;
      }
      break;
    case 'lamp':
      if (event.on) {
        audio?.switchOn();
        ctx.stats.bump('lampsOn');
      } else audio?.switchOff();
      ctx.haptic(ImpactStyle.Light);
      break;
    case 'house':
      if (event.on) {
        audio?.switchOn();
        ctx.stats.bump('houseOn');
      } else audio?.switchOff();
      ctx.haptic(ImpactStyle.Light);
      break;
    case 'moon':
      audio?.hum();
      ctx.haptic(ImpactStyle.Light);
      ctx.stats.bump('moonTouched');
      break;
    case 'shooting':
      audio?.shootingStar();
      ctx.stats.bump('shootingStars');
      break;
    case 'firefly':
      // The parents' wish: not a bird's tweet but a little magic.
      audio?.magic();
      ctx.haptic(ImpactStyle.Light);
      ctx.stats.bump('firefliesTouched');
      break;
    case 'shake':
      ctx.haptic(ImpactStyle.Heavy);
      ctx.stats.bump('lightShakes');
      break;
    case 'celebration':
      audio?.chime();
      ctx.stats.bump('lightCelebrations');
      break;
    case 'photo':
      audio?.tada();
      ctx.stats.bump('lightPhotos');
      ctx.stats.bump(`photo:${event.photoId}`);
      break;
    case 'sparkle':
      audio?.sparkle();
      break;
  }
}
