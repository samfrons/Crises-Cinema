'use client';

import { family, type Summary } from '@/lib/taxonomy';

interface Props {
  rows: Summary['plotLanguage'];
}

/**
 * A breakdown of how each category's own plot summaries talk about their
 * stakes -- not a claim about how any single film actually ends, which the
 * dataset has no field for. Built from scripts/build-data.mjs's two regexes
 * run against the real PlotSummary text; see that file for the exact wordlists.
 */
export default function PlotLanguage({ rows }: Props) {
  const sorted = [...rows].sort(
    (a, b) => (b.annihilationPct - b.survivalPct) - (a.annihilationPct - a.survivalPct),
  );

  return (
    <div className="lang">
      {sorted.map((row) => {
        const f = family(row.family);
        return (
          <div className="lang-row" key={row.family}>
            <span className="lang-label" style={{ color: f.color }}>{f.label}</span>
            <div className="lang-track">
              <div className="lang-meter"><div className="lang-bar surv" style={{ width: `${row.survivalPct}%` }} /></div>
              <span className="lang-pct">{row.survivalPct}% survival</span>
            </div>
            <div className="lang-track">
              <div className="lang-meter"><div className="lang-bar ann" style={{ width: `${row.annihilationPct}%` }} /></div>
              <span className="lang-pct">{row.annihilationPct}% annihilation</span>
            </div>
          </div>
        );
      })}
      <p className="lang-note">
        Share of each category&apos;s plot summaries (with one on file) using survival-coded
        language (survive, escape, rescue, shelter) versus annihilation-coded language
        (destroy, annihilate, extinct, wipe out). A summary can use both, or neither —
        the two bars aren&apos;t a split of 100%, and neither is a verdict on how any one
        film actually ends.
      </p>
    </div>
  );
}
