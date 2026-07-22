// Feature I — turning a signature drawn with PanResponder into a real PNG,
// in plain JavaScript.
//
// Why this exists: the obvious library, react-native-signature-canvas, works by
// hosting an HTML canvas inside react-native-webview and reading back
// canvas.toDataURL(). That drags an entire browser engine into the app for one
// 300x140 drawing, and pins us to that package's React Native compatibility on
// every future upgrade. We already ship react-native-svg for the icon set, and
// PanResponder is in React Native core, so the only missing piece was the
// encoder — about a hundred lines, and unlike a WebView it is provable: the
// harness inflates the output with Node's own zlib and checks the pixels.
//
// Output is 1-bit grayscale. A signature is ink or paper, nothing between, and
// 1bpp makes a 600x280 image about 21 KB before base64 instead of 168 KB — the
// difference between a comfortable Apps Script request and an awkward one.
//
// Import-pure: no database, no react-native, no Buffer.

export type Point = { x: number; y: number };
export type Stroke = readonly Point[];

export type RasterOptions = {
  /** The coordinate space the strokes were captured in (the pad's layout size). */
  sourceWidth: number;
  sourceHeight: number;
  /** Rendered width in pixels; height follows the source aspect ratio. */
  targetWidth?: number;
  /** Pen thickness in target pixels. */
  strokeWidth?: number;
};

export const DEFAULT_TARGET_WIDTH = 600;
export const DEFAULT_STROKE_WIDTH = 3;

export type Bitmap = {
  width: number;
  height: number;
  /** One byte per pixel: 0 = ink, 1 = paper. Packed to 1bpp at encode time. */
  pixels: Uint8Array;
};

// ---------- rasterizing ----------

function stampDisc(bmp: Bitmap, cx: number, cy: number, radius: number): void {
  const r = Math.max(0, radius);
  const minX = Math.max(0, Math.floor(cx - r));
  const maxX = Math.min(bmp.width - 1, Math.ceil(cx + r));
  const minY = Math.max(0, Math.floor(cy - r));
  const maxY = Math.min(bmp.height - 1, Math.ceil(cy + r));
  const rr = r * r;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      // <= so a radius of 0 still marks the centre pixel: a tap must leave a dot.
      if (dx * dx + dy * dy <= rr || (r === 0 && dx === 0 && dy === 0)) {
        bmp.pixels[y * bmp.width + x] = 0;
      }
    }
  }
}

/** Stamps discs along the segment. Step of half a radius keeps the line solid
 *  without redrawing the same pixels dozens of times on a slow finger. */
function drawSegment(bmp: Bitmap, a: Point, b: Point, radius: number): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const step = Math.max(0.5, radius / 2);
  const steps = Math.max(1, Math.ceil(distance / step));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    stampDisc(bmp, a.x + dx * t, a.y + dy * t, radius);
  }
}

/**
 * Strokes (in pad coordinates) → a bitmap. Points outside the source box are
 * clipped by stampDisc rather than rejected, so a stroke that runs off the
 * edge draws up to the edge instead of vanishing.
 */
export function rasterizeStrokes(
  strokes: readonly Stroke[],
  options: RasterOptions,
): Bitmap {
  const targetWidth = Math.max(1, Math.round(options.targetWidth ?? DEFAULT_TARGET_WIDTH));
  const scale = options.sourceWidth > 0 ? targetWidth / options.sourceWidth : 1;
  const targetHeight = Math.max(1, Math.round(options.sourceHeight * scale));

  const bmp: Bitmap = {
    width: targetWidth,
    height: targetHeight,
    pixels: new Uint8Array(targetWidth * targetHeight).fill(1),
  };

  const radius = Math.max(0, ((options.strokeWidth ?? DEFAULT_STROKE_WIDTH) * scale) / 2);
  const at = (p: Point): Point => ({ x: p.x * scale, y: p.y * scale });

  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    if (stroke.length === 1) {
      stampDisc(bmp, at(stroke[0]).x, at(stroke[0]).y, radius);
      continue;
    }
    for (let i = 1; i < stroke.length; i++) {
      drawSegment(bmp, at(stroke[i - 1]), at(stroke[i]), radius);
    }
  }

  return bmp;
}

/** True when nothing was actually drawn — an all-paper bitmap is not a
 *  signature, however many empty strokes the gesture recogniser produced. */
export function isBlankBitmap(bmp: Bitmap): boolean {
  return bmp.pixels.every((v) => v === 1);
}

export function hasInk(strokes: readonly Stroke[]): boolean {
  return strokes.some((s) => s.length > 0);
}

// ---------- PNG encoding ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function be32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function chunk(type: string, data: Uint8Array): number[] {
  const typeBytes = [...type].map((ch) => ch.charCodeAt(0));
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  return [...be32(data.length), ...body, ...be32(crc32(body))];
}

/** Scanlines: each row is a filter byte (0 = None) followed by 1bpp pixels,
 *  MSB first. Trailing bits in the last byte of a row are paper. */
function scanlines(bmp: Bitmap): Uint8Array {
  const stride = Math.ceil(bmp.width / 8);
  const out = new Uint8Array((stride + 1) * bmp.height);

  for (let y = 0; y < bmp.height; y++) {
    const rowStart = y * (stride + 1);
    out[rowStart] = 0; // filter: None
    for (let x = 0; x < bmp.width; x++) {
      if (bmp.pixels[y * bmp.width + x] === 1) {
        out[rowStart + 1 + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    // Pad the unused tail bits of the final byte to white.
    const usedBits = bmp.width & 7;
    if (usedBits !== 0) out[rowStart + stride] |= 0xff >> usedBits;
  }

  return out;
}

/**
 * Wraps raw bytes in a zlib stream using STORED (uncompressed) deflate blocks.
 *
 * A real deflate implementation would be several hundred more lines for no
 * benefit here: at 1bpp a signature is already ~21 KB, and stored blocks are
 * the one deflate mode that is impossible to get subtly wrong. Any PNG decoder
 * handles them — they are ordinary deflate.
 */
function zlibStored(raw: Uint8Array): Uint8Array {
  const MAX_BLOCK = 0xffff;
  const blocks: number[] = [0x78, 0x01]; // CMF/FLG; (0x7801 % 31 === 0) as required

  for (let offset = 0; offset < raw.length || offset === 0; offset += MAX_BLOCK) {
    const len = Math.min(MAX_BLOCK, raw.length - offset);
    const isFinal = offset + len >= raw.length;
    blocks.push(isFinal ? 1 : 0);
    blocks.push(len & 0xff, (len >>> 8) & 0xff);
    blocks.push(~len & 0xff, (~len >>> 8) & 0xff);
    for (let i = 0; i < len; i++) blocks.push(raw[offset + i]);
    if (isFinal) break;
  }

  blocks.push(...be32(adler32(raw)));
  return new Uint8Array(blocks);
}

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** A complete 1-bit grayscale PNG. */
export function encodePng(bmp: Bitmap): Uint8Array {
  const ihdr = new Uint8Array([
    ...be32(bmp.width),
    ...be32(bmp.height),
    1, // bit depth
    0, // colour type: grayscale
    0, // compression: deflate
    0, // filter method
    0, // interlace: none
  ]);

  const bytes = [
    ...PNG_SIGNATURE,
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', zlibStored(scanlines(bmp))),
    ...chunk('IEND', new Uint8Array(0)),
  ];

  return new Uint8Array(bytes);
}

/** The whole pipeline: gesture strokes in, PNG bytes out. */
export function strokesToPng(strokes: readonly Stroke[], options: RasterOptions): Uint8Array {
  return encodePng(rasterizeStrokes(strokes, options));
}

// ---------- base64 ----------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Hand-rolled because Hermes has no Buffer, and btoa cannot take binary bytes
 * without a lossy String.fromCharCode round trip through a string long enough
 * to matter.
 */
export function toBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;

  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }

  const remaining = bytes.length - i;
  if (remaining === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
  } else if (remaining === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }

  return out;
}

// ---------- live rendering ----------

/**
 * SVG path data for react-native-svg, so the pad shows the stroke as it is
 * drawn. A single point becomes a hairline segment: with strokeLinecap="round"
 * that renders as the dot the user expects, where a bare moveto renders
 * nothing at all.
 */
export function strokeToPath(stroke: Stroke): string {
  if (stroke.length === 0) return '';
  const head = `M ${round(stroke[0].x)} ${round(stroke[0].y)}`;
  if (stroke.length === 1) return `${head} l 0.01 0`;
  return (
    head + stroke.slice(1).map((p) => ` L ${round(p.x)} ${round(p.y)}`).join('')
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
