/** The rolling hills at the bottom of the screen, shared by the game (ground level) and the renderer. */

/** Top edge of a hill layer at horizontal position x. Layer 0 is the back hill, layer 1 the front hill. */
export function hillY(x: number, width: number, height: number, unit: number, layer: 0 | 1): number {
  return layer === 0
    ? height - height * 0.17 - unit * 24 * Math.sin((x / width) * Math.PI * 2.1 + 1.2)
    : height - height * 0.1 - unit * 16 * Math.sin((x / width) * Math.PI * 1.5 + 0.3);
}
