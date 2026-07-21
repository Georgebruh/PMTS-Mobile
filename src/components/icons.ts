// Glyph data ported 1:1 from the <defs> symbol set in pmt-ui-redesign.html.
// All glyphs share a 24x24 viewBox and are stroke-drawn (fill none).

export type IconShape =
  | { type: 'path'; d: string }
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'rect'; x: number; y: number; width: number; height: number; rx?: number };

export const glyphs = {
  home: [{ type: 'path', d: 'M4 11l8-7 8 7M6 9.5V20h4.5v-5h3v5H18V9.5' }],
  calendar: [
    { type: 'rect', x: 4, y: 5, width: 16, height: 15, rx: 2.5 },
    { type: 'path', d: 'M4 9.5h16M8 3v4M16 3v4' },
  ],
  menu: [{ type: 'path', d: 'M4 7h16M4 12h16M4 17h16' }],
  plus: [{ type: 'path', d: 'M12 5v14M5 12h14' }],
  bell: [
    { type: 'path', d: 'M6 9.5a6 6 0 0 1 12 0c0 5 1.8 6 1.8 6H4.2s1.8-1 1.8-6' },
    { type: 'path', d: 'M10.4 19a1.9 1.9 0 0 0 3.2 0' },
  ],
  cloudcheck: [
    { type: 'path', d: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z' },
    { type: 'path', d: 'M9.6 12.9l2 2 3.8-3.9' },
  ],
  // Feature C: offline state of the sync indicator — the cloudcheck cloud
  // with a slash instead of the check (no equivalent exists in the mockup).
  cloudoff: [
    { type: 'path', d: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z' },
    { type: 'path', d: 'M5.5 5.5l13 13' },
  ],
  clock: [
    { type: 'circle', cx: 12, cy: 12, r: 8.5 },
    { type: 'path', d: 'M12 7.5V12l3 1.8' },
  ],
  check: [{ type: 'path', d: 'M5 12.5l4.5 4.5L19 7.5' }],
  search: [
    { type: 'circle', cx: 11, cy: 11, r: 6.2 },
    { type: 'path', d: 'M15.6 15.6L20 20' },
  ],
  sliders: [
    { type: 'path', d: 'M4 8h9M17.5 8H20M4 16h2.5M11 16h9' },
    { type: 'circle', cx: 15, cy: 8, r: 2.2 },
    { type: 'circle', cx: 8.5, cy: 16, r: 2.2 },
  ],
  chevleft: [{ type: 'path', d: 'M14.5 6L8.5 12l6 6' }],
  chevright: [{ type: 'path', d: 'M9.5 6l6 6-6 6' }],
  pin: [
    { type: 'path', d: 'M12 21.3S5.8 15.7 5.8 10.9a6.2 6.2 0 1 1 12.4 0c0 4.8-6.2 10.4-6.2 10.4z' },
    { type: 'circle', cx: 12, cy: 10.7, r: 2.3 },
  ],
  wrench: [
    {
      type: 'path',
      d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
    },
  ],
  pencil: [{ type: 'path', d: 'M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' }],
  // Feature D: the FAB's Add Asset action — no equivalent in the mockup.
  box: [
    {
      type: 'path',
      d: 'M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z',
    },
    { type: 'path', d: 'M3.3 7l8.7 5 8.7-5' },
    { type: 'path', d: 'M12 22V12' },
  ],
  // Feature D: Staff tab — no people glyph exists in the mockup's symbol set.
  users: [
    { type: 'path', d: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2' },
    { type: 'circle', cx: 9, cy: 8, r: 3.5 },
    { type: 'path', d: 'M21 21v-2a4 4 0 0 0-3-3.87' },
    { type: 'path', d: 'M16 4.6a3.5 3.5 0 0 1 0 6.8' },
  ],
  // Feature H: removing a not-yet-synced crew member — the mockup has no
  // dismiss glyph.
  close: [{ type: 'path', d: 'M6 6l12 12M18 6L6 18' }],
  // Feature I: attaching a photo to a maintenance report.
  camera: [
    {
      type: 'path',
      d: 'M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.3-2h7l1.3 2h2.2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9z',
    },
    { type: 'circle', cx: 12, cy: 13, r: 3.6 },
  ],
  // Feature I: an upload still on its way to Drive.
  upload: [
    { type: 'path', d: 'M12 16V4' },
    { type: 'path', d: 'M7.5 8.5L12 4l4.5 4.5' },
    { type: 'path', d: 'M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16' },
  ],
  // Feature I: a queued file that has stopped retrying and needs the user.
  warning: [
    { type: 'path', d: 'M12 4.5L21 19.5H3L12 4.5z' },
    { type: 'path', d: 'M12 10v4' },
    { type: 'circle', cx: 12, cy: 17, r: 0.6 },
  ],
} satisfies Record<string, IconShape[]>;

export type IconName = keyof typeof glyphs;
