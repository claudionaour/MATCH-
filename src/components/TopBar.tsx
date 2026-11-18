import React from 'react';
import {Logo} from './Logo';
import {AppSection} from '../types';

interface TopBarProps {
  onNavigate: (section: AppSection) => void;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onNavigate,
  primaryActionLabel,
  onPrimaryAction,
}) => {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('landing')}
          className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg"
        >
          <Logo size="md" />
        </button>

        {/* Zone 2: 4-5 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => onNavigate('commercial')}
            className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Comercial
          </button>
          <button
            type="button"
            onClick={() => onNavigate('employment')}
            className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Laboral
          </button>
          <button
            type="button"
            onClick={() => onNavigate('advertising')}
            className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Publicidad
          </button>
          <button
            type="button"
            onClick={() => onNavigate('help')}
            className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Normativa
          </button>
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
          >
            {primaryActionLabel}
          </button>
        </div>
      </div>
    </header>
  );
};
