import React from 'react';
import {HeartHandshake, MessageSquare, X} from 'lucide-react';
import {MatchRecord} from '../types';

interface MatchCelebrationModalProps {
  match: MatchRecord | null;
  onClose: () => void;
  onOpenChat: (match: MatchRecord) => void;
}

/**
 * Match confirmation overlay — strictly ad-free per Experience Protection Rule 8.6.
 */
export const MatchCelebrationModal: React.FC<MatchCelebrationModalProps> = ({
  match,
  onClose,
  onOpenChat,
}) => {
  if (!match) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 text-center shadow-2xl">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar confirmación de match"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <HeartHandshake className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {match.module === 'commercial' ? 'Coincidencia Comercial Confirmada' : 'Coincidencia Laboral Confirmada'}
          </p>
          <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">Hay interés mutuo</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Tú y <strong>{match.recipientName}</strong> coincidieron en <strong>{match.targetTitle}</strong>.
          </p>
          {match.compatibilityExplanation && (
            <p className="text-xs text-blue-700 dark:text-blue-400 pt-1">{match.compatibilityExplanation}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
          >
            Seguir explorando
          </button>
          <button
            type="button"
            onClick={() => onOpenChat(match)}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold min-h-[44px]"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Abrir chat privado</span>
          </button>
        </div>
      </div>
    </div>
  );
};
