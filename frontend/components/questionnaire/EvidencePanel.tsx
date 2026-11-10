'use client';
/* CO-2: Notes & Evidence panel.
   Renders: notes textarea + file upload button + file list (compact two-column card). */

import type { RefObject } from 'react';
import { formatBytes } from '@/lib/utils';
import { PaperclipIcon } from './utils';
import './questionnaire.css';

interface Props {
  note: string;
  files: File[];
  lang: string;
  /** When true, the notes textarea is hidden because the N/A justification is
   *  already shown inline in QuestionView above. */
  isNA?: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onNoteChange: (val: string) => void;
  onAddFiles: (files: FileList | null) => void;
  onRemoveFile: (idx: number) => void;
}

export function EvidencePanel({
  note,
  files,
  lang,
  isNA = false,
  fileInputRef,
  onNoteChange,
  onAddFiles,
  onRemoveFile,
}: Props) {
  return (
    <section className="qx-evidence">
      {/* Fix L-02: 'Kanit' → 'Kanıt' (dotless ı, U+0131) */}
      <span className="qx-label" style={{ margin: 0 }}>
        {lang === 'tr' ? 'Kanıt (isteğe bağlı)' : 'Evidence (optional)'}
      </span>

      <div className={`qx-evidence-row${isNA ? ' is-single' : ''}`}>
        {/* Notes textarea — hidden when isNA because the justification is shown above in QuestionView */}
        {!isNA && (
          <div>
            {/* Fix A-5: associate label with textarea via htmlFor/id */}
            <label htmlFor="qa-notes" className="qx-label" style={{ fontSize: 9 }}>
              {lang === 'tr' ? 'Notlar / Yorumlar' : 'Notes / Comments'}
            </label>
            <textarea
              id="qa-notes"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              rows={2}
              className="qx-notes"
              placeholder={lang === 'tr'
                ? 'Bu soruyla ilgili ek not veya yorum ekleyin…'
                : 'Add context, clarifications, or additional comments…'}
            />
          </div>
        )}

        {/* File upload */}
        <div>
          <span className="qx-label" style={{ fontSize: 9 }}>
            {lang === 'tr' ? 'Kanıt Belgesi Yükle' : 'Upload Evidence'}
          </span>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="qx-upload"
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
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {files.map((file, idx) => (
                <div key={`${file.name}-${file.size}`} className="qx-file">
                  <PaperclipIcon />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

          <p className="qx-fine">
            {lang === 'tr' ? 'PDF, Word, Excel, resim — maks. 10 MB' : 'PDF, Word, Excel, images — max 10 MB per file'}
          </p>
        </div>
      </div>
    </section>
  );
}
