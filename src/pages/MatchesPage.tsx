import React, {useMemo, useState} from 'react';
import {doc, serverTimestamp, updateDoc} from 'firebase/firestore';
import {Archive, Ban, HeartHandshake, MessageSquare} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {useToast} from '../contexts/ToastContext';
import {db, handleFirestoreError, OperationType} from '../services/firebase/firebaseClient';
import {MatchRecord} from '../types';

interface MatchesPageProps {
  matches: MatchRecord[];
  onOpenMatchChat: (match: MatchRecord) => void;
}

export const MatchesPage: React.FC<MatchesPageProps> = ({matches, onOpenMatchChat}) => {
  const {firebaseUser} = useAuth();
  const {showToast} = useToast();
  const [filterModule, setFilterModule] = useState<'all' | 'commercial' | 'employment'>('all');

  const visibleMatches = useMemo(() => {
    return matches.filter((m) => {
      if (m.status === 'archived') return false;
      if (filterModule !== 'all' && m.module !== filterModule) return false;
      return true;
    });
  }, [matches, filterModule]);

  const handleStatusChange = async (matchId: string, status: 'archived' | 'blocked') => {
    try {
      await updateDoc(doc(db, 'matches', matchId), {
        status,
        updatedAt: serverTimestamp(),
      });
      showToast(status === 'blocked' ? 'Coincidencia bloqueada.' : 'Coincidencia archivada.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `matches/${matchId}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Mis Coincidencias</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Matches reales confirmados por interés mutuo en MATCH COMERCIAL y MATCH LABORAL.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {[
            {id: 'all', label: 'Todos'},
            {id: 'commercial', label: 'Comercial'},
            {id: 'employment', label: 'Laboral'},
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterModule(tab.id as typeof filterModule)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold min-h-[40px] ${
                filterModule === tab.id
                  ? 'bg-blue-700 text-white'
                  : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {visibleMatches.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-2">
          <HeartHandshake className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Aún no tienes coincidencias activas</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Explora ofertas, necesidades de compra o vacantes laborales y marca interés mutuo para iniciar un chat.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleMatches.map((m) => {
            const counterpartName =
              firebaseUser?.uid === m.initiatorUid ? m.recipientName : m.initiatorName;
            return (
              <div
                key={m.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span
                      className={`font-semibold ${
                        m.module === 'commercial'
                          ? 'text-blue-700 dark:text-blue-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {m.module === 'commercial' ? 'MATCH COMERCIAL' : 'MATCH LABORAL'}
                    </span>
                    {typeof m.compatibilityScore === 'number' && (
                      <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                        {m.compatibilityScore}% compatibilidad
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{m.targetTitle}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">Contraparte: {counterpartName}</p>
                  {m.compatibilityExplanation && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{m.compatibilityExplanation}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => onOpenMatchChat(m)}
                    disabled={m.status === 'blocked'}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold min-h-[42px]"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{m.status === 'blocked' ? 'Bloqueado' : 'Abrir chat privado'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(m.id, 'archived')}
                    title="Archivar match"
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white min-h-[42px] min-w-[42px] flex items-center justify-center"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(m.id, 'blocked')}
                    title="Bloquear match"
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 min-h-[42px] min-w-[42px] flex items-center justify-center"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
