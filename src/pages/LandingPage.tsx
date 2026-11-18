import React from 'react';
import {ArrowRight, Briefcase, CheckCircle2, Megaphone, ShieldCheck, Store} from 'lucide-react';
import {TopBar} from '../components/TopBar';
import {SafeImage} from '../components/SafeImage';
import {PWAInstallButton} from '../components/PWAInstallButton';
import {AppSection} from '../types';

interface LandingPageProps {
  onStartAuth: () => void;
  onNavigate: (section: AppSection) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({onStartAuth, onNavigate}) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <TopBar
        onNavigate={onNavigate}
        primaryActionLabel="Ingresar"
        onPrimaryAction={onStartAuth}
      />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-14 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 tracking-wide">
              Piloto Chiloé · Región de Los Lagos · Expansión Nacional
            </p>
            <h1
              className="font-display font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.08]"
              style={{fontSize: 'clamp(2.25rem, 4vw, 3.6rem)', textWrap: 'balance'}}
            >
              Conectamos necesidades con oportunidades reales.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              MATCH+ reúne en una sola aplicación tres motores independientes: comercio bidireccional, empleo con
              compatibilidad explicable y publicidad local autogestionada con Flow.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onStartAuth}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors min-h-[48px]"
              >
                <span>Comenzar gratis</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <PWAInstallButton />
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-72 sm:h-96 lg:h-full min-h-[320px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-900">
              <SafeImage
                src="/src/assets/images/hero_match_chiloe_1795023910594.jpg"
                alt="Emprendedores y comercio local en Castro, Chiloé"
                className="w-full h-full object-cover"
                fallbackLabel="Comercio y oportunidades en Chiloé"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3 Independent Business Engines - Asymmetric Bento */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-2xl mb-10 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight">
            Tres motores independientes en una sola plataforma
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Cambia entre comercio, empleo y campañas publicitarias sin cerrar sesión y con separación contable total.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <article className="lg:col-span-2 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">01. MATCH COMERCIAL</span>
              <Store className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Marketplace bidireccional: ofrece productos o publica lo que necesitas comprar
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Los vendedores publican su catálogo y los compradores pueden publicar solicitudes concretas (por ejemplo:
              &ldquo;Busco 100 kilos de ajo chilote para comprar esta semana&rdquo;). Cuando ambas partes muestran
              interés mutuo mediante tarjetas deslizables o buscador filtrado, se habilita el chat privado.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('commercial')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline"
              >
                <span>Explorar catálogo comercial</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">02. MATCH LABORAL</span>
              <Briefcase className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Compatibilidad explicable y sin discriminación
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Algoritmo transparente que evalúa habilidades obligatorias, experiencia, comuna y modalidad. Los
              trabajadores nunca pagan por postular y mantienen privado su currículum.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('employment')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                <span>Ver vacantes disponibles</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </article>

          <article className="lg:col-span-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <Megaphone className="w-4 h-4" />
                <span>03. MATCH ADVERTISING · CREA TU ANUNCIO</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Publicidad local segmentada con asistente de 10 pasos y pago en línea con Flow
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Cualquier emprendedor, artesano, comercio o empresa externa puede diseñar su anuncio desde el teléfono,
                previsualizarlo en tiempo real, segmentarlo por comuna o categoría y contratar planes desde $2.990 CLP
                con moderación y rotación equilibrada.
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600 dark:text-slate-400 pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  15% de descuento para anunciantes registrados
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Nunca invade chats privados ni confirmaciones de match
                </span>
              </div>
            </div>
            <div className="lg:col-span-5 flex lg:justify-end">
              <button
                type="button"
                onClick={() => onNavigate('advertising')}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 dark:bg-blue-700 text-white text-sm font-semibold hover:bg-slate-800 dark:hover:bg-blue-800 transition-colors min-h-[48px]"
              >
                <span>Ir a CREA TU ANUNCIO</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </article>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-10 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-700 dark:text-blue-400" />
          <span>MATCH+ · Conectamos necesidades con oportunidades · Lanzamiento Chiloé, Chile</span>
        </div>
        <div className="flex items-center gap-5">
          <button type="button" onClick={() => onNavigate('help')} className="hover:text-slate-900 dark:hover:text-white">
            Privacidad y Normativa Chile
          </button>
          <button type="button" onClick={onStartAuth} className="hover:text-slate-900 dark:hover:text-white">
            Acceder
          </button>
        </div>
      </footer>
    </div>
  );
};
