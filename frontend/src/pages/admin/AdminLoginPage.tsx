import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { storeConfig } from '../../config/store';
import { Button } from '../../components/common/Button';

export const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { adminLogin } = useAuth();
  const navigate = useNavigate();

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please provide administrator email and password.');
      return;
    }

    setLoading(true);
    const res = await adminLogin(trimmedEmail, password);
    setLoading(false);

    if (res.success) {
      navigate('/admin/dashboard', { replace: true });
    } else {
      setError(res.error || 'Administrator authentication failed. Unauthorized credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-white">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link to="/" className="inline-flex items-center justify-center mb-4">
          <img 
            src={storeConfig.logo.dark} 
            alt={storeConfig.officialName} 
            className="h-12 w-auto object-contain"
          />
        </Link>
        <h2 className="text-2xl font-display font-extrabold text-white tracking-tight">
          {storeConfig.officialName} Super Admin Portal
        </h2>
        <p className="mt-2 text-xs text-slate-400">
          Authorized administrative access for store operations, inventory & order fulfillment.
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-md">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-medium leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleAdminSignIn} className="space-y-5">
            {/* Admin Email Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Official Administrator Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sanjanamobiledatabase@gmail.com"
                  autoComplete="email"
                  required
                  className="w-full text-xs font-medium bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
                />
              </div>
            </div>

            {/* Admin Password Input with Show/Hide Toggle */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Secure Master Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full text-xs font-medium bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-11 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full shadow-lg shadow-primary/20"
                isLoading={loading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Authenticate & Access Console
              </Button>
            </div>
          </form>

          {/* Navigation link to customer site */}
          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Customer Storefront</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
