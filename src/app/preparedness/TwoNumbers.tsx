'use client';

/*
 * Figure 3 — the two numbers.
 *
 * What the world's humanitarian appeals asked for in the latest year on
 * record, and what arrived. Two bars on one baseline, the gap labelled, and a
 * strip of the years behind it so the shortfall reads as a condition rather
 * than an accident. Loss and damage pledges sit underneath when the pipeline
 * has them and admit their absence when it does not.
 */

import { useMemo } from 'react';
import { fmtUsd, sourceLine, useFunding } from './data';

export default function TwoNumbers() {
  const { data: funding, state } = useFunding();

  const appeals = useMemo(
    () => (funding?.appeals ?? []).slice().sort((a, b) => a.year - b.year),
    [funding],
  );
  const latest = [...appeals].reverse().find((a) => a.requiredUsd > 0) ?? null;
  const live = funding?.status === 'loaded' && latest !== null;

  const fundedShare = latest && latest.requiredUsd > 0
    ? Math.min(1, latest.fundedUsd / latest.requiredUsd)
    : 0;
  const gap = latest ? Math.max(0, latest.requiredUsd - latest.fundedUsd) : 0;

  const ld = funding?.lossAndDamage;
  // The newest row is the year in progress; its coverage is a running total,
  // not a closed account, and the figure has to say so.
  const partial = latest ? latest.year >= new Date().getFullYear() : false;

  return (
    <section className="pr-figure pr-two" id="two-numbers" aria-labelledby="two-title">
      <div className="wrap">
        <p className="eyebrow">Figure 3 · The moral arithmetic</p>
        <h2 className="section-title" id="two-title">Asked for, and received</h2>
        <p className="pr-note">
          The UN-coordinated appeals are the closest thing there is to a global bill for
          catastrophe. It has never been paid in full.
        </p>

        {state === 'loading' && <p className="pr-empty">Loading the funding record…</p>}

        {state === 'ready' && !live && (
          <div className="pr-notloaded">
            <b>Data not loaded</b>
            <span>
              {funding?.instructions
                ?? 'The appeal record has not been ingested. The pipeline writes /data/preparedness/funding.json from the OCHA Financial Tracking Service.'}
            </span>
          </div>
        )}

        {live && latest && (
          <>
            <div className="pr-bars">
              <div className="pr-bar-row">
                <p className="pr-bar-label">
                  <span className="pr-bar-what">
                    Requested, {latest.year}{partial ? ' (year to date)' : ''}
                  </span>
                  <span className="pr-bar-num">{fmtUsd(latest.requiredUsd)}</span>
                </p>
                <div className="pr-bar-track">
                  <div className="pr-bar-fill pr-bar-req" style={{ width: '100%' }} />
                </div>
              </div>

              <div className="pr-bar-row">
                <p className="pr-bar-label">
                  <span className="pr-bar-what">Received</span>
                  <span className="pr-bar-num">{fmtUsd(latest.fundedUsd)}</span>
                </p>
                <div className="pr-bar-track">
                  <div
                    className="pr-bar-fill pr-bar-got"
                    style={{ width: `${Math.max(1, fundedShare * 100)}%` }}
                  />
                  <p className="pr-bar-gap" style={{ left: `${fundedShare * 100}%` }}>
                    <span>unfunded</span>
                    <b>{fmtUsd(gap)}</b>
                  </p>
                </div>
              </div>
            </div>

            <p className="pr-headline">
              <span className="pr-headline-big">{Math.round(fundedShare * 100)}%</span>
              <span className="pr-headline-say">
                of the {latest.year} appeal {partial ? 'has been funded so far' : 'was funded'}. The
                unmet balance, {fmtUsd(gap)}, sits in the same order of magnitude as the insured
                losses from a single week of fire in one American county.
              </span>
            </p>

            <div className="pr-strip">
              <p className="pr-strip-head">
                Coverage, year by year <span>bars clipped at 100%</span>
              </p>
              <ol className="pr-strip-bars">
                {appeals.map((a) => (
                  <li key={a.year}>
                    <span className="pr-strip-track" title={`${a.year}: ${Math.round((a.coverage ?? 0) * 100)}% funded`}>
                      <span
                        className="pr-strip-fill"
                        style={{ height: `${Math.max(2, Math.min(1, a.coverage ?? 0) * 100)}%` }}
                      />
                    </span>
                    <span className="pr-strip-yr">{String(a.year).slice(2)}</span>
                    <span className="pr-strip-pct">{Math.round((a.coverage ?? 0) * 100)}</span>
                  </li>
                ))}
              </ol>
            </div>

            <details className="table-toggle pr-table">
              <summary>Every appeal year, as a table ({appeals.length})</summary>
              <div className="table-scroll">
                <table className="counts">
                  <thead>
                    <tr><th>Year</th><th>Required</th><th>Funded</th><th>Coverage</th></tr>
                  </thead>
                  <tbody>
                    {[...appeals].reverse().map((a) => (
                      <tr key={a.year}>
                        <td>{a.year}</td>
                        <td>{fmtUsd(a.requiredUsd)}</td>
                        <td>{fmtUsd(a.fundedUsd)}</td>
                        <td>{Math.round((a.coverage ?? 0) * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}

        {/* ── Loss and damage ──────────────────────────────────────────── */}
        <div className="pr-ld">
          <h3 className="pr-ld-title">Loss and damage</h3>
          {ld?.status === 'loaded' && typeof ld.pledgedUsd === 'number' ? (
            <>
              <p className="pr-ld-nums">
                <span className="pr-headline-big">{fmtUsd(ld.pledgedUsd)}</span>
                <span className="pr-headline-say">
                  pledged to the fund
                  {typeof ld.neededUsd === 'number'
                    ? ` against an assessed need of ${fmtUsd(ld.neededUsd)} — ${(
                      (ld.pledgedUsd / ld.neededUsd) * 100
                    ).toFixed(2)}% of it.`
                    : '. No assessed need is carried in this dataset, so no ratio is claimed here.'}
                </span>
              </p>
              {ld.source && <p className="pr-src">{sourceLine(ld.source)}</p>}
            </>
          ) : (
            <div className="pr-notloaded">
              <b>Data not loaded</b>
              <span>
                {ld?.instructions
                  ?? 'Pledges to the Fund for responding to Loss and Damage have not been ingested. Until they are, this page will not put a figure here.'}
              </span>
            </div>
          )}
        </div>

        <p className="pr-plate-foot pr-foot-standalone">
          <span>{sourceLine(funding?.source)}</span>
          <span className="pr-plate-no" aria-hidden>PREPAREDNESS — FIG. 3</span>
        </p>
      </div>
    </section>
  );
}
