'use client';

import {
  FAMILIES, GROUPS, familiesInGroup, decadeLabel,
  type DecadeRow, type FamilyId,
} from '@/lib/taxonomy';

interface Props {
  active: Set<FamilyId>;
  byFamily: Record<FamilyId, number>;
  decades: DecadeRow[];
  onToggle: (id: FamilyId) => void;
  onReset: () => void;
}

export default function CategoryRail({ active, byFamily, decades, onToggle, onReset }: Props) {
  const allOn = active.size === FAMILIES.length;

  return (
    <div className="rail">
      <div className="rail-top">
        <h3>The eleven fears — tap to filter every view</h3>
        <button className="reset" onClick={onReset} disabled={allOn}>
          {allOn ? 'all showing' : 'show all'}
        </button>
      </div>

      <div className="groups">
        {GROUPS.map((g) => (
          <div className="group" key={g.id}>
            <h4>{g.label}</h4>
            <p>{g.gloss}</p>
            {familiesInGroup(g.id).map((f) => {
              const on = active.has(f.id);
              return (
                <button
                  key={f.id}
                  className="chip"
                  aria-pressed={on}
                  onClick={() => onToggle(f.id)}
                  title={f.gloss}
                >
                  <i style={{ background: f.color }} />
                  <span className="nm">{f.label}</span>
                  <span className="ct">{byFamily[f.id] ?? 0}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* The lighter fills sit under 3:1 against cream, so the figures are also
          available as text. Doubles as the accessible alternative to the SVG. */}
      <details className="table-toggle">
        <summary>See the numbers</summary>
        <div className="table-scroll">
          <table className="counts">
            <caption className="sr-only" style={{ position: 'absolute', left: -9999 }}>
              Number of disaster films by decade and category
            </caption>
            <thead>
              <tr>
                <th scope="col">Decade</th>
                {FAMILIES.map((f) => <th scope="col" key={f.id}>{f.label}</th>)}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {decades.map((d) => (
                <tr key={d.decade}>
                  <th scope="row">{decadeLabel(d.decade)}</th>
                  {FAMILIES.map((f) => {
                    const n = d.counts[f.id] ?? 0;
                    return <td key={f.id} className={n ? undefined : 'zero'}>{n || '·'}</td>;
                  })}
                  <td>{d.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
