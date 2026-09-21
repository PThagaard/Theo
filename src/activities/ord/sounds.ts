import { ImpactStyle } from '@capacitor/haptics';
import type { ActivityContext } from '../../engine/activity';
import type { AudioEngine } from '../../engine/audio';
import type { OrdEvent, Thing } from './logic';

/** The thing's own sound (the dog barks, the balloon boings), `at` seconds from now, before the parent's word. */
function thingSound(audio: AudioEngine, thing: Thing, at = 0): void {
  const when = audio.ctx.currentTime + at;
  switch (thing.creature) {
    case 'dog':
      audio.bark(when);
      return;
    case 'elephant':
      audio.trumpet(when);
      return;
    case 'bird':
      audio.chirp(when);
      return;
    case 'butterfly':
      audio.flutter(when);
      return;
    case 'snail':
      audio.blub(when);
      return;
    case 'tractor':
      audio.honk(when);
      return;
    default:
      break;
  }
  if (thing.kind === 'balloon') audio.boing(when);
  else if (thing.kind === 'cow') audio.moo(when);
  else if (thing.kind === 'cat') audio.meow(when);
  else if (thing.kind === 'car') audio.beep(when);
  else if (thing.kind === 'sun') audio.wee(when);
  else if (thing.kind === 'cloud') audio.rain(when);
  else if (thing.kind === 'flower') audio.twirl(when);
  else if (thing.kind === 'photo') audio.tada(when);
}

/**
 * "Hvor er …?": the parents' recorded question ("hvor er"), then the word in their voice. Whatever is not
 * recorded is stood in for, so the round still works and a parent can ask out loud: a rising "ding-ding?" for
 * the question, and the thing's own sound for the word (find the one that goes "vov vov").
 */
function askQuestion(thing: Thing, ctx: ActivityContext, audio: AudioEngine | null): void {
  const prefix = ctx.say('hvor-er', 0.2, 0);
  let at = 0.2;
  if (prefix > 0) at += prefix + 0.15;
  else {
    audio?.question();
    at = 0.8;
  }
  const word = ctx.say(thing.key, at, 0);
  if (word === 0 && audio) thingSound(audio, thing, at);
}

/** Turns the activity's events into sound, vibration, counters and the parents' words. */
export function handleOrdEvent(event: OrdEvent, ctx: ActivityContext): void {
  const audio = ctx.audio();
  switch (event.type) {
    case 'touch':
      if (audio) thingSound(audio, event.thing);
      ctx.say(event.thing.key, 0.5, 1.5);
      ctx.haptic(ImpactStyle.Light);
      ctx.stats.bump('ordTouched');
      break;
    case 'peek':
      audio?.sparkle();
      if (audio) thingSound(audio, event.thing);
      ctx.say(event.thing.key, 0.6, 1.5);
      ctx.haptic(ImpactStyle.Medium);
      ctx.stats.bump('ordPeeks');
      break;
    case 'rustle':
      audio?.rustle();
      ctx.haptic(ImpactStyle.Light);
      break;
    case 'ask':
      askQuestion(event.thing, ctx, audio);
      if (!event.repeat) ctx.stats.bump('ordAsked');
      break;
    case 'found':
      // Found it! A little fanfare, then the name once more in a parent's voice.
      audio?.tada();
      audio?.sparkle();
      ctx.say(event.thing.key, 0.9, 0);
      ctx.haptic(ImpactStyle.Medium);
      ctx.stats.bump('ordFound');
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
