import { Container, Graphics } from 'pixi.js';
import type { Hand, Scene } from './layout';

// The drawing half of rendering: turns a Scene into PixiJS graphics. Nothing
// here reads a clock; the caller decides when to render.

export interface Palette {
  hands: Record<Hand, number>;
  white: number;
  black: number;
  keyEdge: number;
}

export const defaultPalette: Palette = {
  hands: { left: 0x4fc3f7, right: 0xffb74d },
  white: 0xf4f4f2,
  black: 0x1b1b1f,
  keyEdge: 0x9a9a9a,
};

const velocityAlpha = (velocity: number): number => 0.45 + 0.55 * (velocity / 127);

export class ScenePainter {
  readonly view = new Container();
  private bars = new Graphics();
  private keys = new Graphics();

  constructor(private palette: Palette = defaultPalette) {
    this.view.addChild(this.bars, this.keys);
  }

  paint(scene: Scene): void {
    const p = this.palette;
    this.bars.clear();
    for (const b of scene.bars) {
      this.bars
        .roundRect(b.x, b.y, b.w, b.h, Math.min(4, b.w / 3))
        .fill({ color: p.hands[b.hand], alpha: velocityAlpha(b.velocity) });
    }

    this.keys.clear();
    // White keys first so the black keys sit on top of them.
    for (const pass of [false, true]) {
      for (const k of scene.keys) {
        if (k.black !== pass) continue;
        const base = k.black ? p.black : p.white;
        this.keys.rect(k.x, k.y, k.w, k.h).fill(base);
        if (k.pressed) {
          this.keys.rect(k.x, k.y, k.w, k.h).fill({ color: p.hands[k.hand], alpha: velocityAlpha(k.velocity) });
        }
        if (!k.black) this.keys.rect(k.x, k.y, k.w, k.h).stroke({ color: p.keyEdge, width: 1 });
      }
    }
  }
}
