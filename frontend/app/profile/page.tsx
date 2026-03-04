'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { userAPI } from '@/lib/api';
import DashboardNavbar from '@/components/DashboardNavbar';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    company_name: '',
    phone: '',
  });

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-green-50 to-emerald-50">
        <div className="text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
            <div className="relative w-20 h-20 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-700 font-semibold text-lg">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    // Force redirect to homepage
    window.location.href = '/';
  };

  const handleEdit = () => {
    setIsEditing(true);
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
    try {
      await userAPI.updateProfile(formData);
      alert(t('error.profile.update.success'));
      setIsEditing(false);
      window.location.reload();
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert(t('error.profile.update.failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-50">
      <DashboardNavbar />
      
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-green-200/20 rounded-full blur-[150px] animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-emerald-200/20 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <main className="relative pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-semibold mb-6 group"
            >
              <i className="fas fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
              <span>Back to Dashboard</span>
            </Link>
            
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-[2rem] blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
              <div className="relative bg-white/95 backdrop-blur-2xl rounded-[2rem] shadow-2xl border-2 border-blue-100 p-10">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl blur-lg opacity-40"></div>
                    <div className="relative w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-xl">
                      <i className="fas fa-user-circle text-3xl text-white"></i>
                    </div>
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold text-gray-800">
                      Profile Settings
                    </h1>
                    <p className="text-gray-600 text-lg font-medium">
                      Manage your account settings and preferences
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-t-[2rem] blur-xl opacity-10"></div>
            <div className="relative bg-white/95 backdrop-blur-2xl rounded-t-[2rem] shadow-xl border-2 border-green-100 border-b-0">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex-1 px-6 py-5 font-bold transition-all rounded-tl-[2rem] ${
                    activeTab === 'profile'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-green-50'
                  }`}
                >
                  <i className="fas fa-user mr-2"></i>
                  Profile Information
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`flex-1 px-6 py-5 font-bold transition-all rounded-tr-[2rem] ${
                    activeTab === 'security'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-green-50'
                  }`}
                >
                  <i className="fas fa-lock mr-2"></i>
                  Security
                </button>
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-b-[2rem] blur-xl opacity-10"></div>
            <div className="relative bg-white/95 backdrop-blur-2xl rounded-b-[2rem] shadow-2xl border-2 border-green-100 border-t-0 p-8">
              {activeTab === 'profile' ? (
                <div className="space-y-6">
                  {/* Profile Info */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Username
                      </label>
                      <div className="px-4 py-3 bg-gray-100 rounded-xl text-gray-600 font-medium border-2 border-gray-200">
                        {user.username}
                        <span className="text-xs ml-2 text-gray-500">(cannot be changed)</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Email
                      </label>
                      {isEditing ? (
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border-2 border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                        />
                      ) : (
                        <div className="px-4 py-3 bg-green-50 rounded-xl text-gray-700 font-medium border-2 border-green-100">
                          {user.email}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        First Name
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="first_name"
                          value={formData.first_name}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border-2 border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                        />
                      ) : (
                        <div className="px-4 py-3 bg-green-50 rounded-xl text-gray-700 font-medium border-2 border-green-100">
                          {user.first_name || '-'}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Last Name
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="last_name"
                          value={formData.last_name}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border-2 border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                        />
                      ) : (
                        <div className="px-4 py-3 bg-green-50 rounded-xl text-gray-700 font-medium border-2 border-green-100">
                          {user.last_name || '-'}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Company Name
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="company_name"
                          value={formData.company_name}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border-2 border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                        />
                      ) : (
                        <div className="px-4 py-3 bg-green-50 rounded-xl text-gray-700 font-medium border-2 border-green-100">
                          {user.company_name || '-'}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Phone
                      </label>
                      {isEditing ? (
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border-2 border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                        />
                      ) : (
                        <div className="px-4 py-3 bg-green-50 rounded-xl text-gray-700 font-medium border-2 border-green-100">
                          {user.phone || '-'}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Membership Type
                      </label>
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl blur-md opacity-20"></div>
                        <div className="relative px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-xl font-bold border-2 border-green-200 flex items-center gap-2">
                          <i className="fas fa-crown"></i>
                          {user.membership_type.charAt(0).toUpperCase() + user.membership_type.slice(1)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t-2 border-green-100 flex gap-4">
                    {isEditing ? (
                      <>
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="group/btn relative px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                        >
                          <span className="relative z-10 flex items-center gap-2">
                            {saving ? (
                              <>
                                <i className="fas fa-spinner fa-spin"></i>
                                Saving...
                              </>
                            ) : (
                              <>
                                <i className="fas fa-save"></i>
                                Save Changes
                              </>
                            )}
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                        </button>
                        <button
                          onClick={handleCancel}
                          disabled={saving}
                          className="px-8 py-4 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleEdit}
                        className="group/btn relative px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-xl overflow-hidden"
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          <i className="fas fa-edit"></i>
                          Edit Profile
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Security Settings */}
                  <div className="relative group/alert">
                    <div className="absolute inset-0 bg-amber-400 rounded-2xl blur-lg opacity-20"></div>
                    <div className="relative bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <i className="fas fa-exclamation-triangle text-amber-600 text-xl"></i>
                        </div>
                        <div>
                          <h3 className="font-bold text-amber-800 mb-2 text-lg">
                            Password Change
                          </h3>
                          <p className="text-amber-700 leading-relaxed">
                            For security reasons, password changes must be done through the Django admin panel or contact support.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      <i className="fas fa-shield-alt text-green-600"></i>
                      Account Actions
                    </h3>
                    
                    <button
                      onClick={handleLogout}
                      className="group/btn relative w-full px-6 py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-xl overflow-hidden"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        <i className="fas fa-sign-out-alt"></i>
                        Logout from All Devices
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-red-600 opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
