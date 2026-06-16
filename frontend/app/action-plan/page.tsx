'use client';
/* Action Plan Tracker — shows all action tasks across all assessments.
   Users can create tasks from recommendations (via results page), manage status,
   set due dates, and add notes. Grouped by status column (Kanban-lite).        */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppNav from '@/components/AppNav';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { actionTaskAPI, type ActionTask } from '@/lib/api';
import { priorityColor } from '@/lib/utils';

/* ─── Status helpers ─────────────────────────────────── */
const STATUS_ORDER: ActionTask['status'][] = ['todo', 'in_progress', 'done', 'wont_do'];

function statusLabel(s: ActionTask['status'], lang: string): string {
  const labels: Record<ActionTask['status'], { en: string; tr: string }> = {
    todo:        { en: 'To Do',       tr: 'Yapılacak' },
    in_progress: { en: 'In Progress', tr: 'Devam Ediyor' },
    done:        { en: 'Done',        tr: 'Tamamlandı' },
    wont_do:     { en: "Won't Do",    tr: 'Yapılmayacak' },
  };
  return lang === 'tr' ? labels[s].tr : labels[s].en;
}

function statusColor(s: ActionTask['status']): string {
  if (s === 'done')        return 'var(--olive-deep)';
  if (s === 'in_progress') return 'var(--amber)';
  if (s === 'wont_do')     return 'var(--ink-4)';
  return 'var(--ink-3)';
}

/* ═══════════════════════════════════════════════════════════
   Action Plan Page
   ═══════════════════════════════════════════════════════════ */
export default function ActionPlanPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { lang } = useLang();

  const [tasks,   setTasks]   = useState<ActionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);  // task id being edited
  const [editNotes, setEditNotes]   = useState('');
  const [editDue,   setEditDue]     = useState('');
  const [saving,    setSaving]      = useState(false);
  const [statusFilter, setStatusFilter] = useState<ActionTask['status'] | 'all'>('all');

  const tr = (en: string, trStr: string) => lang === 'tr' ? trStr : en;

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const data = await actionTaskAPI.getMyTasks();
        if (active) setTasks(data);
      } catch { /* ignore */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [user]);

  const handleStatusChange = async (task: ActionTask, newStatus: ActionTask['status']) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      await actionTaskAPI.updateTask(task.id, { status: newStatus });
    } catch {
      // Revert on failure
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
    }
  };

  const handleSaveEdit = async (taskId: number) => {
    setSaving(true);
    try {
      const updated = await actionTaskAPI.updateTask(taskId, {
        notes:    editNotes,
        due_date: editDue || null,
      });
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      setEditing(null);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleDelete = async (taskId: number) => {
    if (!confirm(tr('Delete this task?', 'Bu görevi silmek istediğinizden emin misiniz?'))) return;
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await actionTaskAPI.deleteTask(taskId);
    } catch {
      // Reload on failure
      const fresh = await actionTaskAPI.getMyTasks();
      setTasks(fresh);
    }
  };

  const filteredTasks = statusFilter === 'all' ? tasks : tasks.filter(t => t.status === statusFilter);
  const todoCount = tasks.filter(t => t.status === 'todo').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>
          {tr('Loading…', 'Yükleniyor…')}
        </span>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <AppNav />

      <main className="wrap" style={{ paddingTop: 40, paddingBottom: 80, maxWidth: 900 }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>
              ← {tr('Dashboard', 'Ana Sayfa')}
            </span>
          </Link>
          <h1 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 22, color: 'var(--ink)', marginTop: 12, marginBottom: 4 }}>
            {tr('Action Plan', 'Aksiyon Planı')}
          </h1>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: 'var(--ink-3)' }}>
            {tr(
              'Track recommendations from your assessments. Add tasks from results pages to build your sustainability action plan.',
              'Değerlendirmelerinizdeki önerileri takip edin. Sürdürülebilirlik aksiyon planınızı oluşturmak için sonuç sayfalarından görev ekleyin.',
            )}
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: tr('To Do', 'Yapılacak'),        value: todoCount,       color: 'var(--ink-3)' },
            { label: tr('In Progress', 'Devam Ediyor'), value: inProgressCount, color: 'var(--amber)' },
            { label: tr('Done', 'Tamamlandı'),          value: doneCount,       color: 'var(--olive-deep)' },
          ].map(s => (
            <div key={s.label} style={{ padding: '16px 20px', background: 'var(--paper)', border: '1px solid var(--line)' }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: 32, color: s.color, letterSpacing: '-2px' }}>
                {s.value}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
          {(['all', ...STATUS_ORDER] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '5px 12px',
                background: statusFilter === s ? 'var(--ink)' : 'transparent',
                color:      statusFilter === s ? 'var(--cream)' : 'var(--ink-3)',
                border:     `1px solid ${statusFilter === s ? 'var(--ink)' : 'var(--line)'}`,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                letterSpacing: '0.06em', cursor: 'pointer', borderRadius: 3,
              }}
            >
              {s === 'all' ? tr('All', 'Tümü') : statusLabel(s, lang)}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {filteredTasks.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center', border: '1px dashed var(--line)', borderRadius: 6 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, color: 'var(--ink-3)', marginBottom: 16 }}>
              {tasks.length === 0
                ? tr(
                    'No action tasks yet. Go to a completed assessment\'s results page and click "Track" on any recommendation to add it here.',
                    'Henüz aksiyon görevi yok. Tamamlanmış bir değerlendirmenin sonuç sayfasına gidip herhangi bir önerideki "Takip Et" düğmesine tıklayarak buraya ekleyin.',
                  )
                : tr('No tasks match the selected filter.', 'Seçilen filtre ile eşleşen görev yok.')}
            </p>
            <Link href="/history" style={{ textDecoration: 'none' }}>
              <button className="btn btn-outline btn-sm">
                {tr('View Assessments', 'Değerlendirmeleri Görüntüle')}
              </button>
            </Link>
          </div>
        )}

        {/* Task list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredTasks.map(task => {
            const isEditing = editing === task.id;
            const isOverdue = task.due_date && task.status !== 'done' && task.status !== 'wont_do'
              && new Date(task.due_date) < new Date();
            return (
              <div
                key={task.id}
                style={{
                  background: 'var(--paper)',
                  border: `1px solid ${isOverdue ? 'rgba(192,57,43,0.35)' : 'var(--line)'}`,
                  borderLeft: `3px solid ${statusColor(task.status)}`,
                  padding: '16px 20px',
                }}
              >
                {/* Task header row */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title */}
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.4 }}>
                      {task.title}
                    </div>
                    {/* Meta row */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      {task.category && (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.08em' }}>
                          {task.category}
                        </span>
                      )}
                      {task.priority && (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: priorityColor(task.priority), letterSpacing: '0.08em' }}>
                          {task.priority}
                        </span>
                      )}
                      {task.due_date && (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: isOverdue ? 'var(--danger)' : 'var(--ink-4)', letterSpacing: '0.08em' }}>
                          {isOverdue ? '⚠ ' : ''}{tr('Due', 'Son Tarih')}: {new Date(task.due_date).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB')}
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
                        {task.description.length > 200 ? task.description.slice(0, 200) + '…' : task.description}
                      </p>
                    )}
                    {task.notes && !isEditing && (
                      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: 'var(--ink-4)', marginTop: 4, fontStyle: 'italic' }}>
                        {task.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    {/* Status selector */}
                    <select
                      value={task.status}
                      onChange={e => handleStatusChange(task, e.target.value as ActionTask['status'])}
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                        padding: '4px 8px', border: '1px solid var(--line)',
                        background: 'var(--cream)', color: statusColor(task.status),
                        cursor: 'pointer', outline: 'none',
                      }}
                    >
                      {STATUS_ORDER.map(s => (
                        <option key={s} value={s}>{statusLabel(s, lang)}</option>
                      ))}
                    </select>
                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditing) { setEditing(null); return; }
                        setEditing(task.id);
                        setEditNotes(task.notes ?? '');
                        setEditDue(task.due_date ?? '');
                      }}
                      style={{
                        background: 'transparent', border: '1px solid var(--line)',
                        color: 'var(--ink-3)', padding: '4px 10px', cursor: 'pointer',
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                      }}
                    >
                      {isEditing ? tr('Cancel', 'İptal') : '✎'}
                    </button>
                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(task.id)}
                      aria-label={tr('Delete task', 'Görevi sil')}
                      style={{
                        background: 'transparent', border: '1px solid var(--line)',
                        color: 'var(--ink-4)', padding: '4px 8px', cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >×</button>
                  </div>
                </div>

                {/* Inline edit form */}
                {isEditing && (
                  <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(0,0,0,0.025)', border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                          {tr('Due Date', 'Son Tarih')}
                        </label>
                        <input
                          type="date"
                          value={editDue}
                          onChange={e => setEditDue(e.target.value)}
                          style={{ padding: '6px 10px', border: '1px solid var(--line)', background: 'var(--cream)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, outline: 'none', width: '100%' }}
                        />
                      </div>
                    </div>
                    <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                      {tr('Notes', 'Notlar')}
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                      rows={2}
                      placeholder={tr('Progress notes, blockers, context…', 'İlerleme notları, engeller…')}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', background: 'var(--cream)', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, resize: 'vertical', outline: 'none' }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSaveEdit(task.id)}
                      disabled={saving}
                      style={{ marginTop: 8 }}
                    >
                      {saving ? tr('Saving…', 'Kaydediliyor…') : tr('Save', 'Kaydet')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
