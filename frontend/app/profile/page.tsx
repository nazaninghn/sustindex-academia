'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { userAPI } from '@/lib/api';
import AppNav from '@/components/AppNav';
import { useLang } from '@/lib/i18n';
import { Icon } from '@/components/shared';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout, refreshUser } = useAuth();
  const { t, lang } = useLang();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // ── Profile form ──
  const [isEditing, setIsEditing] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    company_name: '',
    phone: '',
  });

  // ── Password change form ──
  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm: '' });
  const [pwSaving,  setPwSaving]  = useState(false);
  const [pwError,   setPwError]   = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        company_name: user.company_name || '',
        phone: user.phone || '',
      });
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
          {lang === 'tr' ? 'YÜKLENİYOR…' : 'LOADING…'}
        </span>
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const handlePasswordChange = async () => {
    setPwError('');
    setPwSuccess(false);
    if (!pwForm.old_password || !pwForm.new_password) {
      setPwError(lang === 'tr' ? 'Tüm alanlar zorunludur.' : 'All fields are required.');
      return;
    }
    if (pwForm.new_password !== pwForm.confirm) {
      setPwError(lang === 'tr' ? 'Yeni şifreler eşleşmiyor.' : 'New passwords do not match.');
      return;
    }
    if (pwForm.new_password.length < 8) {
      setPwError(lang === 'tr' ? 'Şifre en az 8 karakter olmalıdır.' : 'Password must be at least 8 characters.');
      return;
    }
    setPwSaving(true);
    try {
      await userAPI.changePassword(pwForm.old_password, pwForm.new_password);
      setPwForm({ old_password: '', new_password: '', confirm: '' });
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 4000);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setPwError(
        (Array.isArray(detail) ? detail.join(' ') : detail) ||
        (lang === 'tr' ? 'Şifre değiştirilemedi. Mevcut şifrenizi kontrol edin.' : 'Could not change password. Check your current password.')
      );
    } finally {
      setPwSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        company_name: user.company_name || '',
        phone: user.phone || '',
      });
    }
    setIsEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      await userAPI.updateProfile(formData);
      setIsEditing(false);
      setSaveSuccess(true);
      await refreshUser();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to update profile:', error);
      setSaveError(
        lang === 'tr'
          ? 'Profil güncellenemedi. Lütfen tekrar deneyin.'
          : 'Failed to update profile. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const membershipLabel = user.membership_type
    ? user.membership_type.charAt(0).toUpperCase() + user.membership_type.slice(1)
    : 'Standard';

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <AppNav />

      <main className="wrap" style={{ padding: '36px 32px 80px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 40 }}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.08em',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              cursor: 'pointer',
            }}>
              ← {lang === 'tr' ? 'Panele Dön' : 'Back to Dashboard'}
            </span>
          </Link>
          <h1 style={{ fontSize: 36, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.05, marginTop: 14, marginBottom: 6 }}>
            {lang === 'tr' ? 'Hesap ' : 'Account '}
            <em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500 }}>
              {lang === 'tr' ? 'Ayarları' : 'Settings'}
            </em>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            {lang === 'tr'
              ? 'Profil bilgilerinizi ve güvenlik tercihlerinizi yönetin.'
              : 'Manage your profile information and security preferences.'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 32, alignItems: 'start' }}>

          {/* Sidebar tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(['profile', 'security'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  textAlign: 'left',
                  padding: '10px 14px',
                  border: 'none',
                  background: activeTab === tab ? 'var(--ink)' : 'transparent',
                  color: activeTab === tab ? 'var(--cream)' : 'var(--ink-3)',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontWeight: 500,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  letterSpacing: '0.01em',
                  transition: 'background 0.15s',
                }}
              >
                {tab === 'profile'
                  ? (lang === 'tr' ? 'Profil Bilgileri' : 'Profile Information')
                  : (lang === 'tr' ? 'Güvenlik' : 'Security')}
              </button>
            ))}

            {/* User card */}
            <div style={{
              marginTop: 24,
              padding: 16,
              background: 'var(--paper)',
              border: '1px solid var(--line)',
            }}>
              <div style={{
                width: 40, height: 40,
                background: 'var(--olive-pale)',
                border: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 10,
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontWeight: 600,
                fontSize: 16,
                color: 'var(--olive-deep)',
              }}>
                {(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                {user.first_name && user.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user.username}
              </p>
              <p style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 10 }}>{user.email}</p>
              <span style={{
                display: 'inline-block',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 9, letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '3px 8px',
                background: 'var(--olive-pale)',
                color: 'var(--olive-deep)',
                border: '1px solid var(--olive)',
              }}>
                {membershipLabel}
              </span>
            </div>
          </div>

          {/* Main panel */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: 32 }}>

            {activeTab === 'profile' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid var(--line)' }}>
                  <h2 style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.01em' }}>
                    {lang === 'tr' ? 'Profil Bilgileri' : 'Profile Information'}
                  </h2>
                  {!isEditing && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setIsEditing(true)}
                    >
                      {lang === 'tr' ? 'Düzenle' : 'Edit'}
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                  {/* Username — read-only */}
                  <div className="field">
                    <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                      {lang === 'tr' ? 'Kullanıcı Adı' : 'Username'}
                    </label>
                    <div style={{
                      padding: '10px 14px',
                      background: 'var(--cream-deep)',
                      border: '1px solid var(--line)',
                      fontSize: 13.5,
                      color: 'var(--ink-3)',
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}>
                      {user.username}
                      <span style={{ fontSize: 10, marginLeft: 8, color: 'var(--ink-4)' }}>
                        ({lang === 'tr' ? 'değiştirilemez' : 'cannot change'})
                      </span>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="field">
                    <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                      {lang === 'tr' ? 'E-posta' : 'Email'}
                    </label>
                    {isEditing ? (
                      <input className="input" type="email" name="email" value={formData.email} onChange={handleChange} />
                    ) : (
                      <div className="input" style={{ background: 'var(--cream-deep)', color: 'var(--ink-2)' }}>{user.email}</div>
                    )}
                  </div>

                  {/* First name */}
                  <div className="field">
                    <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                      {lang === 'tr' ? 'Ad' : 'First Name'}
                    </label>
                    {isEditing ? (
                      <input className="input" type="text" name="first_name" value={formData.first_name} onChange={handleChange} />
                    ) : (
                      <div className="input" style={{ background: 'var(--cream-deep)', color: 'var(--ink-2)' }}>{user.first_name || '—'}</div>
                    )}
                  </div>

                  {/* Last name */}
                  <div className="field">
                    <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                      {lang === 'tr' ? 'Soyad' : 'Last Name'}
                    </label>
                    {isEditing ? (
                      <input className="input" type="text" name="last_name" value={formData.last_name} onChange={handleChange} />
                    ) : (
                      <div className="input" style={{ background: 'var(--cream-deep)', color: 'var(--ink-2)' }}>{user.last_name || '—'}</div>
                    )}
                  </div>

                  {/* Company */}
                  <div className="field">
                    <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                      {lang === 'tr' ? 'Şirket' : 'Company'}
                    </label>
                    {isEditing ? (
                      <input className="input" type="text" name="company_name" value={formData.company_name} onChange={handleChange} />
                    ) : (
                      <div className="input" style={{ background: 'var(--cream-deep)', color: 'var(--ink-2)' }}>{user.company_name || '—'}</div>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="field">
                    <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                      {lang === 'tr' ? 'Telefon' : 'Phone'}
                    </label>
                    {isEditing ? (
                      <input className="input" type="tel" name="phone" value={formData.phone} onChange={handleChange} />
                    ) : (
                      <div className="input" style={{ background: 'var(--cream-deep)', color: 'var(--ink-2)' }}>{user.phone || '—'}</div>
                    )}
                  </div>

                  {/* Membership */}
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                      {lang === 'tr' ? 'Üyelik Tipi' : 'Membership Type'}
                    </label>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '8px 14px',
                      background: 'var(--olive-pale)',
                      border: '1px solid var(--olive)',
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 11, letterSpacing: '0.08em',
                      color: 'var(--olive-deep)',
                      textTransform: 'uppercase',
                    }}>
                      <Icon.check /> {membershipLabel}
                    </div>
                  </div>
                </div>

                {/* Feedback banners */}
                {saveSuccess && (
                  <div style={{ marginTop: 20, padding: '10px 16px', background: 'var(--olive-wash)', border: '1px solid var(--olive)', fontSize: 12.5, color: 'var(--olive-deep)' }}>
                    {lang === 'tr' ? '✓  Profil başarıyla güncellendi.' : '✓  Profile updated successfully.'}
                  </div>
                )}
                {saveError && (
                  <div style={{ marginTop: 20, padding: '10px 16px', background: '#FFF5F3', border: '1px solid var(--danger)', fontSize: 12.5, color: 'var(--danger)' }}>
                    {saveError}
                  </div>
                )}

                {/* Action buttons */}
                {isEditing && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
                    <button
                      className="btn btn-primary"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving
                        ? (lang === 'tr' ? 'Kaydediliyor…' : 'Saving…')
                        : (lang === 'tr' ? 'Değişiklikleri Kaydet' : 'Save Changes')}
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={handleCancel}
                      disabled={saving}
                    >
                      {lang === 'tr' ? 'İptal' : 'Cancel'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid var(--line)' }}>
                  <h2 style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.01em' }}>
                    {lang === 'tr' ? 'Güvenlik' : 'Security'}
                  </h2>
                </div>

                {/* ── Password change form ── */}
                <div style={{ marginBottom: 36 }}>
                  <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 }}>
                    {lang === 'tr' ? 'Şifre Değiştir' : 'Change Password'}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
                    {/* Old password */}
                    <div className="field">
                      <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                        {lang === 'tr' ? 'Mevcut Şifre' : 'Current Password'}
                      </label>
                      <input
                        className="input"
                        type="password"
                        placeholder="••••••••"
                        value={pwForm.old_password}
                        onChange={(e) => setPwForm({ ...pwForm, old_password: e.target.value })}
                      />
                    </div>
                    {/* New password */}
                    <div className="field">
                      <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                        {lang === 'tr' ? 'Yeni Şifre' : 'New Password'}
                      </label>
                      <input
                        className="input"
                        type="password"
                        placeholder="••••••••"
                        value={pwForm.new_password}
                        onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
                      />
                    </div>
                    {/* Confirm */}
                    <div className="field">
                      <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                        {lang === 'tr' ? 'Şifreyi Onayla' : 'Confirm New Password'}
                      </label>
                      <input
                        className="input"
                        type="password"
                        placeholder="••••••••"
                        value={pwForm.confirm}
                        onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Feedback */}
                  {pwError && (
                    <div style={{ marginTop: 14, padding: '10px 14px', background: '#FFF5F3', border: '1px solid var(--danger)', fontSize: 12.5, color: 'var(--danger)', maxWidth: 400 }}>
                      {pwError}
                    </div>
                  )}
                  {pwSuccess && (
                    <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--olive-wash)', border: '1px solid var(--olive)', fontSize: 12.5, color: 'var(--olive-deep)', maxWidth: 400 }}>
                      {lang === 'tr' ? '✓  Şifre başarıyla değiştirildi.' : '✓  Password changed successfully.'}
                    </div>
                  )}

                  <button
                    className="btn btn-primary"
                    onClick={handlePasswordChange}
                    disabled={pwSaving}
                    style={{ marginTop: 20, opacity: pwSaving ? 0.6 : 1 }}
                  >
                    {pwSaving
                      ? (lang === 'tr' ? 'Değiştiriliyor…' : 'Changing…')
                      : (lang === 'tr' ? 'Şifreyi Değiştir' : 'Change Password')}
                  </button>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 28 }}>
                  <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                    {lang === 'tr' ? 'Hesap İşlemleri' : 'Account Actions'}
                  </p>
                  <button
                    onClick={handleLogout}
                    style={{
                      padding: '10px 20px',
                      border: '1px solid var(--danger)',
                      background: 'transparent',
                      color: 'var(--danger)',
                      fontFamily: "'IBM Plex Sans', sans-serif",
                      fontWeight: 500,
                      fontSize: 12.5,
                      cursor: 'pointer',
                      letterSpacing: '0.01em',
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--danger)';
                      e.currentTarget.style.color = 'var(--cream)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--danger)';
                    }}
                  >
                    {lang === 'tr' ? 'Tüm Cihazlardan Çıkış Yap' : 'Logout from All Devices'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
