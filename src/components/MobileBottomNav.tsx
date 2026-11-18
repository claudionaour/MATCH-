import React from 'react';
import {Briefcase, HeartHandshake, Home, MessageSquare, Store} from 'lucide-react';
import {AppSection} from '../types';

interface MobileBottomNavProps {
  activeSection: AppSection;
  onSelect: (section: AppSection) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({activeSection, onSelect}) => {
  const tabs: {id: AppSection; label: string; icon: React.ReactNode}[] = [
    {id: 'home', label: 'Inicio', icon: <Home className="w-5 h-5" />},
    {id: 'commercial', label: 'Comercial', icon: <Store className="w-5 h-5" />},
    {id: 'employment', label: 'Laboral', icon: <Briefcase className="w-5 h-5" />},
    {id: 'matches', label: 'Matches', icon: <HeartHandshake className="w-5 h-5" />},
    {id: 'messages', label: 'Chat', icon: <MessageSquare className="w-5 h-5" />},
  ];

  return (
    <nav
      aria-label="Navegación móvil"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe"
    >
      <div className="grid grid-cols-5 h-16 items-center">
        {tabs.map((tab) => {
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] transition-colors ${
                active
                  ? 'text-blue-700 dark:text-blue-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.icon}
              <span className="text-[11px] tracking-tight mt-0.5 whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
