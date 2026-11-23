'use client';
/** Small shared pieces of the admin console: icons, i18n helper, pills, pager, toast. */
import { useCallback, useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';
import type { Lang } from '@/lib/admin';

/** Inline bilingual copy: const tx = useTx();  tx('Users', 'Kullanıcılar') */
export function useTx() {
  const { lang } = useLang();
  const tx = useCallback((en: string, tr: string) => (lang === 'tr' ? tr : en), [lang]);
  return { tx, lang: lang as Lang };
}

const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5M9.5 20v-6h5v6',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.25 3.25 0 0 1 0 6.2',
  clipboard: 'M9 4h6v3H9zM9 5.5H6.5A1.5 1.5 0 0 0 5 7v12a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V7a1.5 1.5 0 0 0-1.5-1.5H15M9 12.5l2 2 4-4',
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 12.5l9 5 9-5M3 17l9 5 9-5',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  close: 'M6 6l12 12M18 6 6 18',
  external: 'M14 4h6v6M20 4l-9 9M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  userplus: 'M14 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 3 17.5V19M8.5 10.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM18.5 8v6M15.5 11h6',
  gauge: 'M4.5 17a8.5 8.5 0 1 1 15 0M12 13.5l4-5M12 15a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  flag: 'M5 21V4M5 4.5h11l-2 4 2 4H5',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  chevL: 'M14.5 6 8.5 12l6 6',
  chevR: 'M9.5 6l6 6-6 6',
  logout: 'M9 20H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3M15 16l4-4-4-4M19 12H9',
  leaf: 'M5 19c0-8 5-13 14-14 0 9-4 14-11 14-1.2 0-2.2-.2-3 0ZM5 19c2-4 5-7 9-9',
  refresh: 'M4 11a8 8 0 0 1 14-4.5L20 8M20 4v4h-4M20 13a8 8 0 0 1-14 4.5L4 16M4 20v-4h4',
};

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name] || ''} />
    </svg>
  );
}

/** Change against the previous period. `good` says which direction is good news (default: up). */
export function DeltaPill({ value, unit = '%', goodWhenUp = true }: { value: number | null | undefined; unit?: string; goodWhenUp?: boolean }) {
  if (value === null || value === undefined) return null;
  const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const cls = dir === 'flat' ? 'flat' : (dir === 'up') === goodWhenUp ? 'up' : 'down';
  return (
    <span className={`adm-delta ${cls} num`}>
      {dir !== 'flat' && <Icon name={dir === 'up' ? 'arrowUp' : 'arrowDown'} size={10} />}
      {Math.abs(value)}{unit}
    </span>
  );
}

export function GradeChip({ grade }: { grade: string | null | undefined }) {
  if (!grade) return <span style={{ color: 'var(--a-ink-3)' }}>—</span>;
  const cls = grade.startsWith('A') ? 'top' : grade === 'D' || grade === 'C' ? 'low' : '';
  return <span className={`adm-grade ${cls}`}>{grade}</span>;
}

export function ScoreBar({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <span style={{ color: 'var(--a-ink-3)' }}>—</span>;
  return (
    <span className="adm-scorebar">
      <b className="num" style={{ fontWeight: 600, width: 24 }}>{score}</b>
      <span className="adm-meter s1"><i style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></span>
    </span>
  );
}

export function MembershipPill({ type }: { type: string }) {
  const cls = type === 'gold' ? 'accent' : type === 'silver' ? 'solid' : '';
  return <span className={`adm-pill ${cls}`} style={{ textTransform: 'capitalize' }}>{type}</span>;
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      className="adm-switch" onClick={(e) => { e.stopPropagation(); onChange(!checked); }} />
  );
}

export function Pager({ page, pages, count, onPage }: { page: number; pages: number; count: number; onPage: (p: number) => void }) {
  const { tx, lang } = useTx();
  return (
    <div className="adm-pager">
      <span className="num">{count.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB')} {tx('results', 'sonuç')}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <button className="adm-icon-btn" style={{ width: 32, height: 32 }} disabled={page <= 1} onClick={() => onPage(page - 1)}
          aria-label={tx('Previous page', 'Önceki sayfa')}><Icon name="chevL" size={14} /></button>
        <span className="num">{page} / {pages}</span>
        <button className="adm-icon-btn" style={{ width: 32, height: 32 }} disabled={page >= pages} onClick={() => onPage(page + 1)}
          aria-label={tx('Next page', 'Sonraki sayfa')}><Icon name="chevR" size={14} /></button>
      </span>
    </div>
  );
}

export function SortTh({ label, field, ordering, onSort, right }: { label: string; field: string; ordering: string; onSort: (o: string) => void; right?: boolean }) {
  const active = ordering.replace('-', '') === field;
  const desc = ordering.startsWith('-');
  return (
    <th className={right ? 'r' : undefined} aria-sort={active ? (desc ? 'descending' : 'ascending') : undefined}>
      <button onClick={() => onSort(active && desc ? field : `-${field}`)}>
        {label}{active && <Icon name={desc ? 'arrowDown' : 'arrowUp'} size={10} />}
      </button>
    </th>
  );
}

export interface ToastState { msg: string; err?: boolean }
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.err ? 5000 : 2600);
    return () => clearTimeout(id);
  }, [toast]);
  const node = toast ? <div role="status" className={`adm-toast${toast.err ? ' err' : ''}`}>{toast.msg}</div> : null;
  return { show: setToast, node };
}

/** Debounced copy of a fast-changing value (search boxes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

export function Skeleton({ h = 140, className = '' }: { h?: number; className?: string }) {
  return <div className={`adm-skel ${className}`} style={{ height: h }} />;
}
