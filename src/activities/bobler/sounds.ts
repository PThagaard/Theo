import { ImpactStyle } from '@capacitor/haptics';
import type { ActivityContext } from '../../engine/activity';
import { photoVoiceKey } from '../../engine/voices';
import type { BoblerEvent } from './logic';

/** Turns the bath's events into sound, vibration, counters and the parents' words. */
export function handleBoblerEvent(event: BoblerEvent, ctx: ActivityContext): void {
  const audio = ctx.audio();
  switch (event.type) {
    case 'pop':
      audio?.plop(event.size);
      if (event.kind === 'star') audio?.chime();
      else if (event.kind === 'photo') audio?.tada();
      // A parent's voice says who it was, or now and then "boble".
      if (event.kind === 'photo' && event.photoId) ctx.say(photoVoiceKey(event.photoId), 0.5, 2);
      else ctx.say('boble', 0.3, 4);
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
      ctx.say('vand', 0.4, 4);
      ctx.haptic(ImpactStyle.Light);
      ctx.stats.bump('splashes');
      break;
    case 'quack':
      audio?.quack();
      ctx.say('and', 0.5, 2.5);
      ctx.haptic(ImpactStyle.Light);
      ctx.stats.bump('quacks');
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
    case 'sparkle':
      audio?.sparkle();
      break;
  }
}
