/**
 * An instrument's readings as the desk has them, drawn under the slip that
 * carries the latest: one column per reading (state drawing, time, value,
 * the state's word), oldest left, this slip's in full ink and earlier slips'
 * in faint. A series whose slips state clock times also gets a clock axis,
 * each column tied down by a leader to where its time falls, so a long gap
 * between two readings shows as a long gap. Nothing here is new: every
 * state, time and value is one the slip text already states (the build checks
 * each — README, "Pictograms, the warning chain and the board marks"), and
 * nothing later than this slip is ever drawn.
 */
import type { Reading, Scenario, Timestep } from './types';
import { ReadingGlyph } from './glyphs';
import vocabulary from './vocabulary.json';

const LABEL = vocabulary.readings as unknown as Record<string, { label: string }>;
const mins = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const stamp = (t: Timestep) => `${t.approx ? '≈' : ''}${t.time}`;

type Column = { key: string; at?: string; by?: boolean; desk: string; now: boolean; readings: Reading[] };

/** The columns of one series, from the day's opening up to and including `itemId`. */
function columns(scenario: Scenario, series: string, itemId: string): Column[] {
  const out: Column[] = [];
  outer: for (const t of scenario.timesteps) {
    for (const info of t.info_available) {
      for (const r of info.readings ?? []) {
        if (r.series !== series) continue;
        // A timed series gets a column per stated time; an untimed one, a column per slip.
        const key = `${info.id}@${r.at ?? ''}`;
        const col = out.find((c) => c.key === key);
        if (col) col.readings.push(r);
        else out.push({ key, at: r.at, by: r.by, desk: stamp(t), now: info.id === itemId, readings: [r] });
      }
      if (info.id === itemId) break outer;
    }
  }
  return out;
}

export default function Readings({ scenario, itemId, readings }: { scenario: Scenario; itemId: string; readings: Reading[] }) {
  const series = Array.from(new Set(readings.map((r) => r.series)));
  return (
    <>
      {series.map((s) => <Series key={s} scenario={scenario} series={s} itemId={itemId} />)}
    </>
  );
}

function Series({ scenario, series, itemId }: { scenario: Scenario; series: string; itemId: string }) {
  const cols = columns(scenario, series, itemId);
  const timed = cols.every((c) => c.at);
  const name = scenario.instruments?.[series] ?? series;

  // The clock axis: whole hours around the stated times, at least one hour wide.
  let axis: { x: (m: number) => number; hours: number[]; every: number } | null = null;
  if (timed && cols.length) {
    const ts = cols.map((c) => mins(c.at!));
    const lo = Math.floor(Math.min(...ts) / 60) * 60;
    const hi = Math.max(Math.ceil(Math.max(...ts) / 60) * 60, lo + 60);
    const hours: number[] = [];
    for (let h = lo; h <= hi; h += 60) hours.push(h);
    axis = { x: (m) => 3 + (94 * (m - lo)) / (hi - lo), hours, every: Math.ceil((hours.length - 1) / 6) || 1 };
  }
  const cx = (i: number) => ((i + 0.5) / cols.length) * 100;

  return (
    <figure className={`cr-reads${timed ? ' is-timed' : ''}`} style={{ '--n': cols.length } as React.CSSProperties}>
      <figcaption className="cr-reads-head">
        <span className="cr-reads-name">{name}</span>
        <span className="cr-reads-note">{timed ? ' · on the desk so far, at the times the slips give' : ' · on the desk so far, in the order it arrived'}</span>
      </figcaption>
      <ol className="cr-reads-cols">
        {cols.map((c) => (
          <li key={c.key} className={c.now ? 'is-now' : 'is-past'}>
            <ReadingGlyph state={c.readings[c.readings.length - 1].state} size={30} className="cr-reads-glyph" />
            <span className={`cr-reads-time${c.at ? '' : ' is-desk'}`}>
              {c.at ? `${c.by ? 'by ' : ''}${c.at}` : <><span className="cr-reads-desk">desk </span>{c.desk}</>}
            </span>
            {c.readings.map((r, i) => (
              <span key={i} className="cr-reads-state">
                {r.value && <b className="cr-reads-value">{r.value} </b>}
                {LABEL[r.state]?.label ?? r.state}
              </span>
            ))}
          </li>
        ))}
      </ol>
      {axis && (
        <div className="cr-reads-axis" aria-hidden>
          <svg className="cr-reads-leaders" viewBox="0 0 100 20" preserveAspectRatio="none">
            {cols.map((c, i) => {
              const tx = axis!.x(mins(c.at!));
              return (
                <path key={c.key} className={c.now ? 'is-now' : ''} d={`M${cx(i)} 0V6L${tx} 15V20`}
                  vectorEffect="non-scaling-stroke" pathLength={1} />
              );
            })}
          </svg>
          <div className="cr-reads-rail">
            {axis.hours.map((h, i) => (
              <span key={h} className="cr-reads-hour" style={{ left: `${axis!.x(h)}%` }}>
                {i % axis!.every === 0 && <span className="cr-reads-hourlabel">{String(h / 60).padStart(2, '0')}:00</span>}
              </span>
            ))}
            {cols.map((c) => (
              <span key={c.key} className={`cr-reads-node${c.now ? ' is-now' : ''}`} style={{ left: `${axis!.x(mins(c.at!))}%` }} />
            ))}
          </div>
        </div>
      )}
    </figure>
  );
}
