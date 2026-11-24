import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button } from '../components/common/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-16 text-center">
      <div className="max-w-md w-full bg-white rounded-3xl border border-plum-100 p-8 sm:p-12 shadow-card space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-plum-100 text-coral-500 flex items-center justify-center mx-auto">
          <Compass className="w-8 h-8" />
        </div>
        <div>
          <span className="text-4xl font-display font-extrabold text-plum-950 block mb-1">
            404
          </span>
          <h2 className="text-xl font-display font-bold text-plum-900 mb-2">
            Sanctuary Coordinate Not Found
          </h2>
          <p className="text-xs text-plum-500 leading-relaxed">
            The page or architectural object you are searching for has moved, expired, or exists in an unmapped dimension.
          </p>
        </div>
        <div className="pt-2">
          <Link to="/">
            <Button variant="secondary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Return to Atelier Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
