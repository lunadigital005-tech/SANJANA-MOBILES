import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';
import { storeConfig } from '../../config/store';
import { api } from '../../services/api';
import { Category } from '../../types';
import { useToast } from '../../context/ToastContext';

export const Footer: React.FC = () => {
  const [email, setEmail] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    api.getCategories()
      .then((data) => {
        if (active && Array.isArray(data)) {
          setCategories(data.slice(0, 6));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      showToast('Please provide a valid email address.', 'warning');
      return;
    }
    showToast(`Welcome to ${storeConfig.officialName} Club. Exclusive mobile deals are on the way!`, 'success');
    setEmail('');
  };

  return (
    <footer className="bg-plum-950 text-ivory border-t border-plum-900 mt-20">
      {/* Brand Values / Value Pillars */}
      <div className="border-b border-plum-900/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-plum-900 text-coral-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-display font-semibold text-sm text-ivory">100% Genuine Devices</h4>
                <p className="text-xs text-plum-300 mt-1 leading-relaxed">
                  Direct authorized brand stocks with official manufacturer warranty and IMEI verification.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-plum-900 text-mint-300 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-display font-semibold text-sm text-ivory">Express Delivery & Store Pickup</h4>
                <p className="text-xs text-plum-300 mt-1 leading-relaxed">
                  Same-day local dispatch within 10 km and seamless in-store collection at our Bengaluru store.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-plum-900 text-coral-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-display font-semibold text-sm text-ivory">Safe & Secure Payments</h4>
                <p className="text-xs text-plum-300 mt-1 leading-relaxed">
                  End-to-end verified transactions via Google Pay & UPI, Instant QR transfer, and Sanjana Loyalty Coins.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand Intro & Newsletter */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2">
              <img 
                src={storeConfig.logo.dark} 
                alt={storeConfig.officialName} 
                className="h-10 w-auto object-contain" 
              />
            </Link>
            <p className="text-xs text-plum-300 max-w-sm leading-relaxed">
              {storeConfig.description}
            </p>

            <div className="pt-2">
              <p className="text-xs font-semibold text-ivory mb-2 uppercase tracking-wider">
                Sanjana Mobile Club
              </p>
              <form onSubmit={handleSubscribe} className="flex gap-2 max-w-sm">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 text-plum-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full bg-plum-900/90 border border-plum-800 rounded-xl py-2 pl-9 pr-3 text-xs text-ivory placeholder:text-plum-400 focus:outline-none focus:border-coral-400"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-coral-500 hover:bg-coral-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
                >
                  <span>Join</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>

          {/* Collections */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-ivory mb-4">
              Curated Collections
            </h5>
            <ul className="space-y-2.5 text-xs text-plum-300">
              {categories.length > 0 ? (
                categories.map((cat) => (
                  <li key={cat.id}>
                    <Link
                      to={`/category/${cat.slug}`}
                      className="hover:text-coral-400 transition-colors"
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))
              ) : (
                <>
                  <li>
                    <Link to="/products" className="hover:text-coral-400 transition-colors">
                      All Smartphones
                    </Link>
                  </li>
                  <li>
                    <Link to="/products" className="hover:text-coral-400 transition-colors">
                      Charging & Cables
                    </Link>
                  </li>
                  <li>
                    <Link to="/products" className="hover:text-coral-400 transition-colors">
                      Audio & Earbuds
                    </Link>
                  </li>
                  <li>
                    <Link to="/products" className="hover:text-coral-400 transition-colors">
                      Protection & Cases
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Customer Care */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-ivory mb-4">
              Client Concierge
            </h5>
            <ul className="space-y-2.5 text-xs text-plum-300">
              <li>
                <Link to="/dashboard" className="hover:text-coral-400 transition-colors">
                  Client Dashboard
                </Link>
              </li>
              <li>
                <Link to="/orders" className="hover:text-coral-400 transition-colors">
                  Order Inquiries & Tracking
                </Link>
              </li>
              <li>
                <Link to="/rewards" className="hover:text-coral-400 transition-colors">
                  Loyalty Sanctuary
                </Link>
              </li>
              <li>
                <Link to="/addresses" className="hover:text-coral-400 transition-colors">
                  Address Book
                </Link>
              </li>
              <li>
                <span className="block text-plum-400 mt-2">Concierge Hotline:</span>
                <span className="text-ivory font-medium">{storeConfig.contact.phone}</span>
              </li>
            </ul>
          </div>

          {/* Admin & Security Portal */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-ivory mb-4">
              Platform & Governance
            </h5>
            <ul className="space-y-2.5 text-xs text-plum-300">
              <li>
                <Link to="/admin/login" className="text-coral-400 hover:text-coral-300 font-medium transition-colors">
                  Admin Command Portal
                </Link>
              </li>
              <li>
                <span className="text-plum-400">Headquarters:</span>
                <p className="text-plum-300 leading-snug mt-0.5">{storeConfig.contact.address}</p>
              </li>
              <li className="pt-2">
                <span className="text-plum-400">Hours:</span>
                <p className="text-plum-300">{storeConfig.contact.supportHours}</p>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="mt-12 pt-8 border-t border-plum-900 text-xs text-plum-400 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} {storeConfig.officialName}. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="text-[11px] text-plum-500 uppercase tracking-widest">Deep Plum & Vibrant Coral Edition</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
