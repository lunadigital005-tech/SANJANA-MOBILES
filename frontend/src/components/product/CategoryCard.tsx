import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Category } from '../../types';

export const CategoryCard: React.FC<{ category: Category }> = ({ category }) => {
  return (
    <Link
      to={`/category/${category.slug}`}
      className="group relative block rounded-2xl overflow-hidden aspect-[4/3] bg-plum-900 shadow-card hover:shadow-card-hover transition-all duration-300"
    >
      <img
        src={category.image_url}
        alt={category.name}
        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 opacity-80 group-hover:opacity-75"
      />
      {/* Gradient vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-plum-950/90 via-plum-950/30 to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 p-5 sm:p-6 flex flex-col justify-end text-ivory">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-coral-300 font-semibold mb-1 block">
              {category.item_count} Items
            </span>
            <h3 className="font-display font-bold text-lg sm:text-xl text-white group-hover:text-coral-300 transition-colors">
              {category.name}
            </h3>
          </div>
          <div className="w-9 h-9 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-white group-hover:bg-coral-500 group-hover:border-coral-500 transition-all duration-300">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Link>
  );
};
