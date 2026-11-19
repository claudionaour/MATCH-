import React from 'react';
import {
  ArrowRight,
  Bell,
  Briefcase,
  FileText,
  HeartHandshake,
  Megaphone,
  MessageSquare,
  Sparkles,
  Store,
} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {AppSection} from '../types';

interface HomeDashboardProps {
  onNavigate: (section: AppSection, subView?: string) => void;
  matchesCount: number;
  unreadNotifications: number;
  conversationsCount: number;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onNavigate,
  matchesCount,
  unreadNotifications,
  conversationsCount,
}) => {
  const {userAccount} = useAuth();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
            {userAccount?.commune || 'Castro'} · {userAccount?.region || 'Región de Los Lagos'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Hola, {userAccount?.displayName || 'bienvenido/a a MATCH+'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Elige el motor en el que quieres operar hoy. Tu cuenta única te permite comprar, vender, buscar empleo,
            contratar talento o crear campañas publicitarias con reglas y contabilidad independientes.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('matches')}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 text-left hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
          >
            <HeartHandshake className="w-4 h-4 text-emerald-600 mb-1" />
            <p className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">{matchesCount}</p>
            <p className="text-[11px] text-slate-500">Matches</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('messages')}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 text-left hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
          >
            <MessageSquare className="w-4 h-4 text-blue-600 mb-1" />
            <p className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">{conversationsCount}</p>
            <p className="text-[11px] text-slate-500">Chats</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('notifications')}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 text-left hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
          >
            <Bell className="w-4 h-4 text-amber-600 mb-1" />
            <p className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">{unreadNotifications}</p>
            <p className="text-[11px] text-slate-500">Alertas</p>
          </button>
        </div>
      </div>

      {/* Three Business Engines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Commercial */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Motor 01</p>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">MATCH COMERCIAL</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Explora productos y servicios locales o publica necesidades específicas como &ldquo;Busco 100 kilos de ajo
              chilote&rdquo; para conectar directamente con vendedores reales.
            </p>
          </div>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => onNavigate('commercial')}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold min-h-[44px]"
            >
              <span>Entrar a MATCH COMERCIAL</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('commercial', 'my_publications')}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold min-h-[40px]"
            >
              <FileText className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>Ver mis publicaciones</span>
            </button>
          </div>
        </div>

        {/* Employment */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Motor 02</p>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">MATCH LABORAL</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Postula gratis como trabajador con CV privado protegido o publica vacantes como empresa. Calcula
              compatibilidad verificable por requisitos, habilidades, experiencia y ubicación.
            </p>
          </div>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => onNavigate('employment')}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold min-h-[44px]"
            >
              <span>Entrar a MATCH LABORAL</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('employment', 'my_publications')}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold min-h-[40px]"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>Ver mis publicaciones</span>
            </button>
          </div>
        </div>

        {/* Advertising */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Motor 03 · Amplificación</p>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">MATCH PUBLICIDAD</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Promociona tu negocio con planes desde $2.990 CLP y 15% de descuento automático por ser usuario
              registrado. Pago online vía Flow Chile o transferencia verificada.
            </p>
          </div>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => onNavigate('advertising')}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold min-h-[44px]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Entrar a MATCH PUBLICIDAD</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('advertising', 'my_ads')}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold min-h-[40px]"
            >
              <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Ver mis publicaciones</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
