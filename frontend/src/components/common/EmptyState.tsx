import React from 'react';
import { PackageOpen } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-white/40 border border-dashed border-plum-200 rounded-3xl my-6">
      <div className="w-14 h-14 rounded-2xl bg-plum-100 flex items-center justify-center text-plum-600 mb-4">
        {icon || <PackageOpen className="w-7 h-7" />}
      </div>
      <h3 className="text-lg font-bold font-display text-plum-900 mb-1.5">{title}</h3>
      <p className="text-sm text-plum-500 max-w-sm mb-6 leading-relaxed">{description}</p>
      {actionLabel && (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
