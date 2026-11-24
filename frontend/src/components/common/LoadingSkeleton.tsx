import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-plum-100/70 rounded-lg ${className}`} />
);

export const ProductCardSkeleton: React.FC = () => (
  <div className="bg-white/60 rounded-2xl border border-plum-100 p-3 overflow-hidden shadow-card">
    <Skeleton className="w-full aspect-[4/5] rounded-xl mb-4" />
    <Skeleton className="w-24 h-4 mb-2" />
    <Skeleton className="w-full h-5 mb-3" />
    <div className="flex items-center justify-between pt-2">
      <Skeleton className="w-16 h-6" />
      <Skeleton className="w-20 h-8 rounded-lg" />
    </div>
  </div>
);

export const TableRowSkeleton: React.FC<{ cols?: number }> = ({ cols = 5 }) => (
  <tr className="border-b border-plum-100 animate-pulse">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="py-4 px-4">
        <div className="h-4 bg-plum-100 rounded w-3/4"></div>
      </td>
    ))}
  </tr>
);
