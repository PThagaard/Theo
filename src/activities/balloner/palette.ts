import type { BalloonColor } from './types';

/** Candy-coloured balloons: bright and high contrast, which babies see best. */
export const BALLOON_COLORS: BalloonColor[] = [
  { name: 'red', main: '#ff4d6d', light: '#ff9db0', dark: '#c9184a' },
  { name: 'orange', main: '#ff8c42', light: '#ffc09a', dark: '#d1600f' },
  { name: 'yellow', main: '#ffd93d', light: '#fff3a6', dark: '#e0a800' },
  { name: 'green', main: '#5ed37a', light: '#a9f0b6', dark: '#2f9e4f' },
  { name: 'blue', main: '#4d96ff', light: '#a6c8ff', dark: '#2456c9' },
  { name: 'purple', main: '#b56cff', light: '#dbb8ff', dark: '#7b2fd6' },
  { name: 'pink', main: '#ff7ad9', light: '#ffbdec', dark: '#d63ea8' },
  { name: 'teal', main: '#3ddad7', light: '#a3f2f0', dark: '#1a9c99' },
];

export const GOLD: BalloonColor = { name: 'gold', main: '#ffc933', light: '#fff0a0', dark: '#e08e00' };

export const RAINBOW_COLOR: BalloonColor = { name: 'rainbow', main: '#ff4d6d', light: '#ffffff', dark: '#7b2fd6' };

export const RAINBOW = ['#ff4d6d', '#ff8c42', '#ffd93d', '#5ed37a', '#4d96ff', '#b56cff'];

export const SPARKLE_COLORS = ['#ffffff', '#fff6a8', '#ffd1ec', '#c8f5ff'];

export const SKY = { top: '#4fb3ff', middle: '#a8e1ff', bottom: '#fff4d6' };

export const HILLS = { back: '#8fdc6a', front: '#63c94f', frontDark: '#4fb03d' };

export const FLOWER_COLORS = ['#ff6b8a', '#ffd23f', '#ff9f43', '#b56cff', '#ffffff', '#ff7ad9'];
