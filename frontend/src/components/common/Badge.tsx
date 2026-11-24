import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'plum' | 'coral' | 'mint' | 'neutral' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2.5 py-0.5 font-medium',
    md: 'text-xs px-3 py-1 font-semibold',
  };

  const variantStyles = {
    plum: 'bg-plum-100 text-plum-900 border border-plum-200',
    coral: 'bg-coral-50 text-coral-600 border border-coral-200',
    mint: 'bg-mint-200 text-mint-900 border border-mint-300',
    neutral: 'bg-ivory-200 text-plum-800 border border-plum-100',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full uppercase tracking-wider ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
