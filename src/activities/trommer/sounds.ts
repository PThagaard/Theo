import { ImpactStyle } from '@capacitor/haptics';
import type { ActivityContext } from '../../engine/activity';
import type { TrommerEvent } from './logic';

/** Turns the drums' events into sound, vibration and counters. No words: this is a banging toy. */
export function handleTrommerEvent(event: TrommerEvent, ctx: ActivityContext): void {
  const audio = ctx.audio();
  switch (event.type) {
    case 'hit':
      // A tap is a full hit; a sweep a touch lighter; a roll soft and quick; a shake in between.
      audio?.drum(event.note, event.how === 'tap' ? 1 : event.how === 'sweep' ? 0.8 : event.how === 'shake' ? 0.7 : 0.4);
      if (event.how === 'roll') {
        ctx.haptic(ImpactStyle.Light);
        ctx.stats.bump('drumRolls');
      } else {
        ctx.haptic(ImpactStyle.Medium);
        ctx.stats.bump('drumHits');
        if (event.how === 'sweep') ctx.stats.bump('drumSweeps');
      }
      break;
    case 'shake':
      audio?.rattle();
      ctx.haptic(ImpactStyle.Heavy);
      ctx.stats.bump('drumShakes');
      break;
    case 'photo':
      audio?.chime();
      ctx.stats.bump('drumPhotos');
      ctx.stats.bump(`photo:${event.photoId}`);
      break;
    case 'sparkle':
      audio?.sparkle();
      break;
  }
}
