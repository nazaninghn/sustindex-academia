'use client';
/* CO-2: Notes & Evidence panel.
   Renders: notes textarea + file upload button + file list.  */

import type { RefObject } from 'react';
import { formatBytes } from '@/lib/utils';
import { PaperclipIcon } from './utils';

interface Props {
  note: string;
  files: File[];
  lang: string;
  fileInputRef: RefObject<HTMLInputElement>;
  onNoteChange: (val: string) => void;
  onAddFiles: (files: FileList | null) => void;
  onRemoveFile: (idx: number) => void;
}

export function EvidencePanel({
  note,
  files,
  lang,
  fileInputRef,
  onNoteChange,
  onAddFiles,
  onRemoveFile,
}: Props) {
  return (
    <div style={{
      borderTop: '1px solid var(--line)',
      paddingTop: 20,
      marginBottom: 40,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Section title */}
      <p style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5,
        color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase',
        margin: 0,
      }}>
        {/* Fix L-02: 'Kanit' → 'Kanıt' (dotless ı, U+0131) */}
        {lang === 'tr' ? 'Not & Kanıt (isteğe bağlı)' : 'Notes & Evidence (optional)'}
      </p>

      {/* Notes textarea */}
      <div>
        {/* Fix A-5: associate label with textarea via htmlFor/id */}
        <label htmlFor="qa-notes" style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
          color: 'var(--ink-4)', letterSpacing: '0.08em',
          display: 'block', marginBottom: 6,
        }}>
          {lang === 'tr' ? 'Notlar / Yorumlar' : 'Notes / Comments'}
        </label>
        <textarea
          id="qa-notes"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={3}
          placeholder={lang === 'tr'
            ? 'Bu soruyla ilgili ek not veya yorum ekleyin…'
            : 'Add context, clarifications, or additional comments…'}
          style={{
            width: '100%', padding: '12px 14px',
            background: 'var(--cream-deep)', border: '1px solid var(--line)',
            fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5,
            color: 'var(--ink)', lineHeight: 1.6, resize: 'vertical',
            outline: 'none', borderRadius: 0,
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--ink-3)')}
          onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--line)')}
        />
      </div>

      {/* File upload */}
      <div>
        <label style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
          color: 'var(--ink-4)', letterSpacing: '0.08em',
          display: 'block', marginBottom: 6,
        }}>
          {lang === 'tr' ? 'Kanıt Belgesi Yükle' : 'Upload Evidence'}
        </label>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', background: 'transparent',
            border: '1px dashed var(--line)', cursor: 'pointer',
            fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: 'var(--ink-3)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ink-3)'; e.currentTarget.style.color = 'var(--ink)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-3)'; }}
        >
          <PaperclipIcon />
          {lang === 'tr' ? 'Dosya seç veya sürükle' : 'Choose file or drag & drop'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          style={{ display: 'none' }}
          onChange={(e) => onAddFiles(e.target.files)}
        />

        {files.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {files.map((file, idx) => (
              <div key={`${file.name}-${file.size}`} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', background: 'var(--paper)',
                border: '1px solid var(--line)',
              }}>
                <PaperclipIcon />
                <span style={{ flex: 1, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </span>
                {/* Fix L-03: use shared formatBytes() from utils.ts */}
                <span style={{ fontSize: 10, color: 'var(--ink-4)', flexShrink: 0 }}>
                  {formatBytes(file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveFile(idx)}
                  /* Fix R5-L-03: aria-label so screen readers announce the action */
                  aria-label={lang === 'tr' ? 'Dosyayı kaldır' : 'Remove file'}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--ink-4)', fontSize: 13, lineHeight: 1, padding: '0 2px',
                    flexShrink: 0,
                  }}
                >×</button>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 8 }}>
          {lang === 'tr' ? 'PDF, Word, Excel, resim — maks. 10 MB' : 'PDF, Word, Excel, images — max 10 MB per file'}
        </p>
      </div>
    </div>
  );
}
