import { ImpactStyle } from '@capacitor/haptics';
import type { ActivityContext } from '../../engine/activity';
import type { BoldeEvent } from './logic';

/** Turns the balls' events into sound, vibration and counters. No words: this is a bouncing toy. */
export function handleBoldeEvent(event: BoldeEvent, ctx: ActivityContext): void {
  const audio = ctx.audio();
  switch (event.type) {
    case 'tap':
      // Caught: a rubbery "boing".
      audio?.boing();
      ctx.haptic(ImpactStyle.Medium);
      ctx.stats.bump('ballTaps');
      break;
    case 'jump':
      audio?.wee();
      ctx.haptic(ImpactStyle.Light);
      break;
    case 'throw':
      audio?.wee();
      ctx.haptic(ImpactStyle.Medium);
      ctx.stats.bump('ballThrows');
      break;
    case 'bounce':
      // Only the hard bounces reach here; soft ones stay quiet.
      audio?.bop(event.size, event.strength);
      if (event.strength > 0.65) ctx.haptic(ImpactStyle.Light);
      ctx.stats.bump('ballBounces');
      break;
    case 'floor':
      audio?.bop(1.4, 0.9);
      ctx.haptic(ImpactStyle.Medium);
      ctx.stats.bump('ballFloorTaps');
      break;
    case 'push':
      audio?.pluck();
      ctx.haptic(ImpactStyle.Light);
      ctx.stats.bump('ballPushes');
      break;
    case 'shake':
      audio?.rattle();
      ctx.haptic(ImpactStyle.Heavy);
      ctx.stats.bump('ballShakes');
      break;
    case 'celebration':
      audio?.fanfare();
      ctx.stats.bump('ballCelebrations');
      break;
    case 'photo':
      audio?.tada();
      ctx.stats.bump(`photo:${event.photoId}`);
      break;
    case 'sparkle':
      audio?.sparkle();
      break;
  }
}
