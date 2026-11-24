import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-plum-950 text-ivory">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-plum-800 border-t-coral-500 rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-plum-300 tracking-wider uppercase">Authenticating Admin Access...</span>
        </div>
      </div>
    );
  }

  // Not logged in -> Redirect to Admin Login
  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Logged in but not an admin or super admin -> Strict Authorization Denial
  if (role !== 'admin' && role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-plum-950 text-ivory flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-plum-900/80 border border-plum-800 p-8 rounded-2xl text-center shadow-2xl backdrop-blur-md">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold font-display text-ivory mb-2">Access Restricted</h2>
          <p className="text-plum-300 text-sm mb-6 leading-relaxed">
            Your current account (<span className="text-coral-400">{user.email}</span>) does not possess administrator privileges. All unauthorized access attempts are logged for security.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-plum-800 hover:bg-plum-700 text-ivory text-sm font-medium transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Store
            </Link>
            <Link
              to="/admin/login"
              className="flex-1 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-coral-500 hover:bg-coral-600 text-white text-sm font-semibold transition-all shadow-md"
            >
              Admin Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
