import { ImpactStyle } from '@capacitor/haptics';
import type { ActivityContext } from '../../engine/activity';
import type { SpejlEvent } from './logic';

/** Turns the mirror's events into sound, vibration and counters. No words: this is a mirror to play in front of. */
export function handleSpejlEvent(event: SpejlEvent, ctx: ActivityContext): void {
  const audio = ctx.audio();
  switch (event.type) {
    case 'sticker':
      // A soft round "plop" for most stickers, a rubbery boing for a balloon.
      if (event.kind === 'balloon') audio?.boing();
      else audio?.plop(0.6);
      ctx.haptic(ImpactStyle.Light);
      ctx.stats.bump('mirrorStickers');
      break;
    case 'trail':
      audio?.glide(event.note);
      if (event.first) ctx.stats.bump('mirrorTrails');
      break;
    case 'charge':
      audio?.inflate();
      ctx.haptic(ImpactStyle.Light);
      break;
    case 'burst':
      audio?.chime();
      ctx.haptic(ImpactStyle.Medium);
      ctx.stats.bump('mirrorBursts');
      break;
    case 'bubble':
      if (event.what === 'appear') audio?.sparkle();
      else {
        audio?.tada();
        ctx.haptic(ImpactStyle.Medium);
        ctx.stats.bump('mirrorPhotos');
        ctx.stats.bump(`photo:${event.photoId}`);
      }
      break;
    case 'shake':
      audio?.rattle();
      ctx.haptic(ImpactStyle.Heavy);
      ctx.stats.bump('mirrorShakes');
      break;
    case 'celebration':
      audio?.fanfare();
      ctx.stats.bump('mirrorCelebrations');
      break;
    case 'sparkle':
      audio?.sparkle();
      break;
  }
}
