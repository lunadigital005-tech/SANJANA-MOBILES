import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Image, Shield, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../context/ToastContext';

export const ProfilePage: React.FC = () => {
  const { user, token, updateProfile } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast('Full name is required', 'error');
      return;
    }

    setLoading(true);
    try {
      if (token) {
        await api.updateProfile(token, {
          full_name: fullName,
          phone,
          avatar_url: avatarUrl,
        });
      }
      await updateProfile({
        full_name: fullName,
        phone,
        avatar_url: avatarUrl,
      });
      showToast('Profile information successfully saved', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <span className="text-xs uppercase tracking-widest font-bold text-coral-600 block mb-1">
          Account Settings
        </span>
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-plum-950">
          Personal Profile
        </h1>
        <p className="text-xs sm:text-sm text-plum-500 mt-1">
          Manage your contact credentials and client identity details.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-plum-100 p-6 sm:p-10 shadow-card">
        {/* Profile Card Header */}
        <div className="flex flex-col sm:flex-row items-center gap-6 pb-8 border-b border-plum-100 mb-8">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="w-24 h-24 rounded-full object-cover border-4 border-plum-100 shadow-md"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-plum-900 text-ivory text-3xl font-bold flex items-center justify-center uppercase shadow-md">
                {fullName.charAt(0) || 'U'}
              </div>
            )}
          </div>

          <div className="text-center sm:text-left space-y-1">
            <h3 className="font-display font-bold text-xl text-plum-950">{fullName || 'Client'}</h3>
            <p className="text-xs text-plum-400">{user?.email}</p>
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
              <Badge variant="plum">{user?.role || 'customer'}</Badge>
              <span className="text-[11px] text-plum-400">
                Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '2026'}
              </span>
            </div>
          </div>
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Input
              label="Full Name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Elena Rostova"
              leftIcon={<User className="w-4 h-4" />}
              required
            />

            <div>
              <Input
                label="Email Address (Linked to Supabase Auth)"
                type="email"
                value={user?.email || ''}
                leftIcon={<Mail className="w-4 h-4" />}
                disabled
                className="bg-plum-50/60 text-plum-500 cursor-not-allowed"
                helperText="Email changes require security verification."
              />
            </div>

            <Input
              label="Telephone Number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 234-5678"
              leftIcon={<Phone className="w-4 h-4" />}
            />

            <Input
              label="Avatar Image URL"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              leftIcon={<Image className="w-4 h-4" />}
            />
          </div>

          {/* Security Notice */}
          <div className="p-4 rounded-2xl bg-ivory border border-plum-100 flex items-start gap-3 text-xs text-plum-600">
            <Shield className="w-4 h-4 text-plum-700 mt-0.5 shrink-0" />
            <span>
              Security Notice: System access roles are cryptographically managed. Client accounts cannot escalate their own authorization permissions.
            </span>
          </div>

          <div className="flex justify-end pt-4 border-t border-plum-100">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={loading}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Profile Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
