'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Table as TableIcon, LineChart } from 'lucide-react';

// Sprint charts drawn as inline SVG. Colors come from the --viz-* tokens in globals.css
// (validated for both themes); text always uses the app's text tokens, never series color.

const HEIGHT = 220;
const M = { top: 16, right: 16, bottom: 28, left: 36 };

/** Tracks an element's width so the SVG can be drawn at true pixel size. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Integer ticks from 0 to max, at most ~5 of them. */
function intTicks(max: number) {
  const step = Math.max(1, Math.ceil(max / 4));
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

const shortDate = (iso: string) => format(parseISO(iso), 'MMM d');

function ViewToggle({ showTable, onToggle }: { showTable: boolean; onToggle: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onToggle}>
      {showTable ? <LineChart className="w-3.5 h-3.5 mr-1.5" /> : <TableIcon className="w-3.5 h-3.5 mr-1.5" />}
      {showTable ? 'Chart' : 'Table'}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Burndown: remaining features per day (series) against the ideal line (reference)
// ---------------------------------------------------------------------------

export function BurndownChart({ data }: { data: { date: string; ideal: number; remaining: number | null }[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Set sprint dates to see the burndown.</p>;
  }

  const max = Math.max(1, ...data.map((d) => Math.max(d.ideal, d.remaining ?? 0)));
  const ticks = intTicks(max);
  const yMax = ticks[ticks.length - 1];
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = HEIGHT - M.top - M.bottom;
  const x = (i: number) => M.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => M.top + innerH - (v / yMax) * innerH;

  const idealPath = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.ideal)}`).join(' ');
  const actual = data.map((d, i) => ({ ...d, i })).filter((d) => d.remaining !== null);
  const actualPath = actual.map((d, k) => `${k ? 'L' : 'M'}${x(d.i)},${y(d.remaining!)}`).join(' ');
  const last = actual[actual.length - 1];

  // About six date labels, always including the first and last day
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));
  const xLabels = data.map((d, i) => i).filter((i) => i % labelEvery === 0 || i === data.length - 1);

  const nearest = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left - M.left;
    const i = Math.round((px / Math.max(innerW, 1)) * (data.length - 1));
    return Math.min(data.length - 1, Math.max(0, i));
  };
  const onMove = (e: PointerEvent<SVGRectElement>) => setActive(nearest(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect()));
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setActive((cur) => {
      const start = cur ?? (last?.i ?? 0);
      return Math.min(data.length - 1, Math.max(0, start + (e.key === 'ArrowRight' ? 1 : -1)));
    });
  };

  const point = active !== null ? data[active] : null;
  const tipLeft = active !== null ? Math.min(Math.max(x(active) + 12, 0), Math.max(width - 168, 0)) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {/* Legend: two lines, keyed with line marks */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <svg width="16" height="8" aria-hidden><line x1="0" y1="4" x2="16" y2="4" stroke="var(--viz-series-1)" strokeWidth="2" strokeLinecap="round" /></svg>
            Remaining
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="8" aria-hidden><line x1="0" y1="4" x2="16" y2="4" stroke="var(--viz-reference)" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
            Ideal
          </span>
        </div>
        <ViewToggle showTable={showTable} onToggle={() => setShowTable((s) => !s)} />
      </div>

      {showTable ? (
        <div className="max-h-64 overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr><th className="text-left p-2 font-medium">Day</th><th className="text-right p-2 font-medium">Remaining</th><th className="text-right p-2 font-medium">Ideal</th></tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className="border-t">
                  <td className="p-2">{shortDate(d.date)}</td>
                  <td className="p-2 text-right tabular-nums">{d.remaining ?? '—'}</td>
                  <td className="p-2 text-right tabular-nums text-muted-foreground">{d.ideal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={ref}
          className="relative focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          tabIndex={0}
          role="img"
          aria-label={`Burndown: ${last ? `${last.remaining} of ${data[0].ideal} features remaining on ${shortDate(last.date)}` : 'no data yet'}. Use arrow keys to read each day.`}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          {width > 0 && (
            <svg width={width} height={HEIGHT} className="block">
              {/* Recessive horizontal grid + y labels */}
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth="1" />
                  <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">{t}</text>
                </g>
              ))}
              {xLabels.map((i) => (
                <text key={i} x={x(i)} y={HEIGHT - 8} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} className="fill-muted-foreground text-[10px]">
                  {shortDate(data[i].date)}
                </text>
              ))}

              <path d={idealPath} fill="none" stroke="var(--viz-reference)" strokeWidth="1.5" strokeDasharray="4 3" />
              {actual.length > 0 && (
                <path d={actualPath} fill="none" stroke="var(--viz-series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              )}

              {/* Crosshair */}
              {active !== null && (
                <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + innerH} stroke="var(--muted-foreground)" strokeWidth="1" opacity="0.5" />
              )}
              {point?.remaining != null && (
                <circle cx={x(active!)} cy={y(point.remaining)} r="4" fill="var(--viz-series-1)" stroke="var(--card)" strokeWidth="2" />
              )}
              {/* End dot + the one direct label: today's remaining */}
              {last && active === null && (
                <>
                  <circle cx={x(last.i)} cy={y(last.remaining!)} r="4" fill="var(--viz-series-1)" stroke="var(--card)" strokeWidth="2" />
                  <text x={x(last.i)} y={y(last.remaining!) - 10} textAnchor={last.i > data.length * 0.8 ? 'end' : 'middle'} className="fill-foreground text-[11px] font-semibold tabular-nums">
                    {last.remaining} left
                  </text>
                </>
              )}

              {/* Hit area: the whole plot, so readers aim at a day, not a 2px line */}
              <rect x={M.left} y={M.top} width={innerW} height={innerH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setActive(null)} />
            </svg>
          )}

          {point && (
            <div className="pointer-events-none absolute top-2 z-10 w-40 rounded-md border bg-popover px-3 py-2 text-xs shadow-md" style={{ left: tipLeft }}>
              <div className="text-muted-foreground mb-1">{shortDate(point.date)}</div>
              <div className="flex items-center gap-2">
                <svg width="12" height="6" aria-hidden><line x1="0" y1="3" x2="12" y2="3" stroke="var(--viz-series-1)" strokeWidth="2" /></svg>
                <span className="font-semibold text-foreground tabular-nums">{point.remaining ?? '—'}</span>
                <span className="text-muted-foreground">remaining</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="12" height="6" aria-hidden><line x1="0" y1="3" x2="12" y2="3" stroke="var(--viz-reference)" strokeWidth="1.5" strokeDasharray="3 2" /></svg>
                <span className="font-semibold text-foreground tabular-nums">{point.ideal}</span>
                <span className="text-muted-foreground">ideal</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Velocity: features released per sprint (single series, columns)
// ---------------------------------------------------------------------------

export function VelocityChart({ data, currentSprintId }: { data: { sprint_id: string; name: string; completed: number }[]; currentSprintId?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Velocity appears once sprints are completed.</p>;
  }

  const ticks = intTicks(Math.max(1, ...data.map((d) => d.completed)));
  const yMax = ticks[ticks.length - 1];
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = HEIGHT - M.top - M.bottom;
  const band = innerW / data.length;
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => M.top + innerH - (v / yMax) * innerH;
  const average = data.reduce((s, d) => s + d.completed, 0) / data.length;

  // Column with a 4px rounded data-end and a square baseline
  const barPath = (cx: number, v: number) => {
    const top = y(v);
    const base = M.top + innerH;
    const h = base - top;
    if (h <= 0) return '';
    const r = Math.min(4, h, barW / 2);
    const l = cx - barW / 2;
    const rt = cx + barW / 2;
    return `M${l},${base} L${l},${top + r} Q${l},${top} ${l + r},${top} L${rt - r},${top} Q${rt},${top} ${rt},${top + r} L${rt},${base} Z`;
  };
  const point = active !== null ? data[active] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Features released per sprint · average <span className="font-medium text-foreground tabular-nums">{average.toFixed(1)}</span>
        </p>
        <ViewToggle showTable={showTable} onToggle={() => setShowTable((s) => !s)} />
      </div>

      {showTable ? (
        <div className="rounded-md border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr><th className="text-left p-2 font-medium">Sprint</th><th className="text-right p-2 font-medium">Features released</th></tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.sprint_id} className="border-t">
                  <td className="p-2">{d.name}{d.sprint_id === currentSprintId ? ' (this sprint)' : ''}</td>
                  <td className="p-2 text-right tabular-nums">{d.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative">
          {width > 0 && (
            <svg width={width} height={HEIGHT} className="block">
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth="1" />
                  <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">{t}</text>
                </g>
              ))}
              {/* Average as a reference line */}
              <line x1={M.left} x2={width - M.right} y1={y(average)} y2={y(average)} stroke="var(--viz-reference)" strokeWidth="1.5" strokeDasharray="4 3" />

              {data.map((d, i) => {
                const cx = M.left + band * i + band / 2;
                const isCurrent = d.sprint_id === currentSprintId;
                return (
                  <g
                    key={d.sprint_id}
                    tabIndex={0}
                    role="img"
                    aria-label={`${d.name}: ${d.completed} features released`}
                    className="focus:outline-none"
                    onPointerEnter={() => setActive(i)}
                    onPointerLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                  >
                    {/* Hit target: the full band, bigger than the bar */}
                    <rect x={cx - band / 2} y={M.top} width={band} height={innerH} fill="transparent" />
                    <path
                      d={barPath(cx, d.completed)}
                      fill="var(--viz-series-1)"
                      opacity={active === null || active === i ? 1 : 0.55}
                    />
                    <text x={cx} y={HEIGHT - 8} textAnchor="middle" className={`text-[10px] ${isCurrent ? 'fill-foreground font-semibold' : 'fill-muted-foreground'}`}>
                      {d.name.length > 12 ? `${d.name.slice(0, 11)}…` : d.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {point && (
            <div
              className="pointer-events-none absolute top-2 z-10 rounded-md border bg-popover px-3 py-2 text-xs shadow-md"
              style={{ left: Math.min(Math.max(M.left + band * active! + band / 2 - 70, 0), Math.max(width - 150, 0)) }}
            >
              <div className="text-muted-foreground mb-0.5">{point.name}</div>
              <div><span className="font-semibold text-foreground tabular-nums">{point.completed}</span> <span className="text-muted-foreground">features released</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
