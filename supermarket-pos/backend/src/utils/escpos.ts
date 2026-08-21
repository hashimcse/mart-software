// Minimal ESC/POS command builder. Produces raw bytes any ESC/POS-compatible
// thermal printer understands (Epson TM-series and the many clones that copy
// its command set) — no vendor SDK, no native binary, just documented byte
// sequences. See docs/ARCHITECTURE.md for how this is dispatched.
const ESC = 0x1b;
const GS = 0x1d;

export type Align = 'left' | 'center' | 'right';

export class EscPosBuilder {
  private chunks: Buffer[] = [];

  private push(...bytes: number[]): this {
    this.chunks.push(Buffer.from(bytes));
    return this;
  }

  init(): this {
    return this.push(ESC, 0x40); // ESC @ — reset to defaults
  }

  text(value: string): this {
    this.chunks.push(Buffer.from(value, 'ascii'));
    return this;
  }

  line(value = ''): this {
    return this.text(value + '\n');
  }

  align(mode: Align): this {
    const n = mode === 'left' ? 0 : mode === 'center' ? 1 : 2;
    return this.push(ESC, 0x61, n); // ESC a n
  }

  bold(on: boolean): this {
    return this.push(ESC, 0x45, on ? 1 : 0); // ESC E n
  }

  divider(width: number): this {
    return this.line('-'.repeat(width));
  }

  feed(lines = 1): this {
    return this.push(ESC, 0x64, lines); // ESC d n
  }

  cut(): this {
    return this.push(GS, 0x56, 1); // GS V 1 — partial cut
  }

  build(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

export function padLine(left: string, right: string, width: number): string {
  const space = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(space) + right;
}

export function centerLine(text: string, width: number): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text;
}
