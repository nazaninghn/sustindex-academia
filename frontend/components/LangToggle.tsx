'use client';
import { useLang } from '@/lib/i18n';

export default function LangToggle({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useLang();
  const border = dark ? 'rgba(249,239,229,0.4)' : 'var(--ink)';
  const fg     = dark ? 'var(--cream)' : 'var(--ink)';

  return (
    <div style={{
      display: 'inline-flex', gap: 0,
      border: `1px solid ${border}`, borderRadius: 999, padding: 2,
      fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10,
      fontWeight: 500, letterSpacing: '0.05em',
    }}>
      {(['en', 'tr'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          style={{
            padding: '3px 9px', borderRadius: 999, cursor: 'pointer',
            background: lang === l ? (dark ? 'var(--cream)' : 'var(--ink)') : 'transparent',
            color: lang === l ? (dark ? 'var(--ink)' : 'var(--cream)') : fg,
            border: 'none', fontFamily: 'inherit', fontWeight: 500, fontSize: 10,
            textTransform: 'uppercase',
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
