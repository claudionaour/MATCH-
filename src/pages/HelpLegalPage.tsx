import React from 'react';
import {BookOpen, FileText, Scale, ShieldCheck} from 'lucide-react';

export const HelpLegalPage: React.FC = () => {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Ayuda, Manual de Uso y Normativa Chile
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Guía operativa de MATCH+ y textos legales.
        </p>
      </div>

      {/* Manual */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-700 dark:text-blue-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Cómo funciona MATCH+</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
            <h3 className="font-bold text-slate-900 dark:text-white">1. MATCH COMERCIAL</h3>
            <p>
              Explora ofertas o publica una necesidad de compra (ej. 100 kg de ajo chilote). El match se produce solo
              cuando ambas partes confirman interés mutuo, abriendo el chat directo.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
            <h3 className="font-bold text-slate-900 dark:text-white">2. MATCH LABORAL</h3>
            <p>
              Gratuito para trabajadores. Completa tu perfil y CV privado. Las empresas publican vacantes y el motor
              calcula compatibilidad objetiva explicable (requisitos obligatorios, experiencia, ubicación y modalidad).
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
            <h3 className="font-bold text-slate-900 dark:text-white">3. CREA TU ANUNCIO</h3>
            <p>
              Asistente guiado de 10 pasos para anunciantes internos (15% dto.) y externos. Pago online vía Flow Chile o
              transferencia, sujeto a moderación y reglas estrictas de no intrusión en chats.
            </p>
          </div>
        </div>
      </section>

      {/* Legal Drafts */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Documentación Legal Base (Borrador para Revisión Profesional)
          </h2>
        </div>

        <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Política de Privacidad y Protección de Datos (Ley N° 19.628)</span>
            </h3>
            <p>
              MATCH+ recopila únicamente los datos necesarios para operar los tres motores (identidad, comuna,
              publicaciones y preferencias). El CV completo y datos de contacto del trabajador permanecen protegidos y no
              son indexados públicamente. Todo titular puede solicitar rectificación, bloqueo o eliminación desde
              Configuración.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Términos y Condiciones · Igualdad Laboral y Moderación</span>
            </h3>
            <p>
              Las vacantes laborales en MATCH LABORAL deben cumplir con la normativa laboral chilena de no discriminación
              (Art. 2° del Código del Trabajo). No se permiten exigencias discriminatorias por edad, género, estado
              civil, origen o creencia. Las ofertas sospechosas de fraude o cobro al postulante son suspendidas.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Política de Cookies, Almacenamiento Local y Denuncias
            </h3>
            <p>
              La plataforma utiliza almacenamiento local exclusivamente para mantener tu sesión segura, preferencias de
              tema claro/oscuro, capacidad PWA offline y control de frecuencia publicitaria (máximo 8 anuncios por
              sesión, nunca en chats privados). Toda publicación o conversación sospechosa puede denunciarse en un clic
              mediante el botón Reportar.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
