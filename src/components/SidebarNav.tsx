import React from 'react';
import {
  Bell,
  Briefcase,
  HeartHandshake,
  HelpCircle,
  Home,
  Megaphone,
  MessageSquare,
  Settings,
  ShieldCheck,
  Store,
  User,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react';
import {AppSection} from '../types';
import {Logo} from './Logo';
import {useTheme} from '../contexts/ThemeContext';
import {PWAInstallButton} from './PWAInstallButton';

interface SidebarNavProps {
  activeSection: AppSection;
  onSelect: (section: AppSection) => void;
  isAdmin: boolean;
  unreadNotifications: number;
  matchesCount: number;
  userName?: string;
  onLogout?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeSection,
  onSelect,
  isAdmin,
  unreadNotifications,
  matchesCount,
  userName,
  onLogout,
}) => {
  const {theme, toggleTheme} = useTheme();

  const items: {id: AppSection; label: string; icon: React.ReactNode; count?: number}[] = [
    {id: 'home', label: 'Inicio', icon: <Home className="w-4 h-4" />},
    {id: 'commercial', label: 'MATCH COMERCIAL', icon: <Store className="w-4 h-4" />},
    {id: 'employment', label: 'MATCH LABORAL', icon: <Briefcase className="w-4 h-4" />},
    {id: 'advertising', label: 'Publicidad y Destacados', icon: <Megaphone className="w-4 h-4" />},
    {id: 'matches', label: 'Mis coincidencias', icon: <HeartHandshake className="w-4 h-4" />, count: matchesCount},
    {id: 'messages', label: 'Mensajes', icon: <MessageSquare className="w-4 h-4" />},
    {id: 'notifications', label: 'Notificaciones', icon: <Bell className="w-4 h-4" />, count: unreadNotifications},
    {id: 'profile', label: 'Mi perfil', icon: <User className="w-4 h-4" />},
    {id: 'settings', label: 'Configuración', icon: <Settings className="w-4 h-4" />},
    {id: 'help', label: 'Ayuda y Normativa', icon: <HelpCircle className="w-4 h-4" />},
  ];

  if (isAdmin) {
    items.push({id: 'admin', label: 'Panel Administrativo', icon: <ShieldCheck className="w-4 h-4" />});
  }

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 min-h-screen sticky top-0 h-screen">
      <div className="h-16 px-5 flex items-center border-b border-slate-100 dark:border-slate-800">
        <button type="button" onClick={() => onSelect('home')} className="focus-visible:outline-none">
          <Logo size="md" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Navegación principal">
        {items.map((item) => {
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[40px] ${
                active
                  ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <span className="flex items-center gap-3 truncate">
                {item.icon}
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.count === 'number' && item.count > 0 && (
                <span className="font-mono tabular-nums text-xs font-semibold text-blue-700 dark:text-blue-300">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
        <PWAInstallButton compact />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px]"
          >
            {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            <span>{theme === 'light' ? 'Modo oscuro' : 'Modo claro'}</span>
          </button>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title={`Cerrar sesión (${userName || ''})`}
              aria-label="Cerrar sesión"
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
