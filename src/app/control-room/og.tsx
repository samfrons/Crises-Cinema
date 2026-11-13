import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = 'image/png';

// Hex copied from the :root tokens in globals.css (ImageResponse cannot read CSS vars).
const PAPER = '#f1e8d5';
const PAPER_DEEP = '#e4d8bd';
const INK = '#191410';
const INK_SOFT = '#5f5445';
const RULE = '#cbbd9f';
const EMBER = '#b8321a'; // a thin rule only: accent, never data

async function poster() {
  try {
    return await readFile(path.join(process.cwd(), 'public/fonts/SF Hollywood Hills.ttf'));
  } catch {
    return null;
  }
}

export async function sheet({ title, line, phase }: { title: string; line: string; phase: string }) {
  const font = await poster();
  const mono = 'ui-monospace, "Courier New", monospace';
  const long = title.length > 28;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: PAPER, padding: 36 }}>
        <div
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            border: `4px solid ${INK}`, background: PAPER, padding: '40px 56px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontFamily: mono, fontSize: 28, letterSpacing: 4, color: INK_SOFT }}>{phase}</div>
            <div style={{ display: 'flex', width: 120, height: 6, background: EMBER, marginTop: 18 }} />
          </div>
          <div
            style={{
              display: 'flex', fontFamily: font ? 'Hollywood' : 'sans-serif', fontWeight: 400,
              fontSize: long ? 96 : 124, lineHeight: 1.2, color: INK, textTransform: 'uppercase',
            }}
          >
            {title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontFamily: mono, fontSize: 30, color: INK, letterSpacing: 2 }}>{line}</div>
            <div style={{ display: 'flex', height: 3, background: INK, marginTop: 20, marginBottom: 16 }} />
            <div style={{ display: 'flex', fontFamily: mono, fontSize: 24, letterSpacing: 3, color: INK_SOFT, background: PAPER_DEEP, padding: '8px 14px', borderTop: `1px solid ${RULE}` }}>
              CONTROL ROOM · DISASTERS BY THE DECADE
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: font ? [{ name: 'Hollywood', data: font, style: 'normal', weight: 400 }] : undefined },
  );
}
