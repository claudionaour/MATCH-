import React, {useEffect, useMemo, useState} from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import {Bell, BellRing, Check, CheckCheck} from 'lucide-react';
import {useAuth} from '../../contexts/AuthContext';
import {useToast} from '../../contexts/ToastContext';
import {db, handleFirestoreError, OperationType} from '../../services/firebase/firebaseClient';
import {AppNotification, AppSection} from '../../types';

interface NotificationsModuleProps {
  onNavigate: (section: AppSection) => void;
}

export const NotificationsModule: React.FC<NotificationsModuleProps> = ({onNavigate}) => {
  const {firebaseUser, userAccount, updateAccountProfile} = useAuth();
  const {showToast} = useToast();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', firebaseUser.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<AppNotification, 'id'>)}));
        list.sort((a, b) => {
          const tA = (a.createdAt as {seconds?: number})?.seconds || 0;
          const tB = (b.createdAt as {seconds?: number})?.seconds || 0;
          return tB - tA;
        });
        setNotifications(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );
    return () => unsub();
  }, [firebaseUser]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const visible = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.read) : notifications),
    [notifications, filter]
  );

  const markRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), {read: true});
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(
      unread.map((n) => updateDoc(doc(db, 'notifications', n.id), {read: true}).catch(() => {}))
    );
    showToast('Todas las notificaciones marcadas como leídas.', 'success');
  };

  const enableBrowserPush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('Este navegador no soporta notificaciones del sistema.', 'info');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      if (userAccount) {
        await updateAccountProfile({
          notificationPrefs: {...userAccount.notificationPrefs, webPushEnabled: true},
        });
      }
      showToast('Alertas web activadas en este dispositivo.', 'success');
    } else {
      showToast('Permiso de notificaciones denegado en el navegador.', 'info');
    }
  };

  const formatTime = (ts: unknown) => {
    const seconds = (ts as {seconds?: number})?.seconds;
    if (!seconds) return 'Reciente';
    return new Date(seconds * 1000).toLocaleString('es-CL', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Centro de Notificaciones
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Alertas de matches, mensajes, compatibilidad, campañas y pagos en tiempo real.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={enableBrowserPush}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
          >
            <BellRing className="w-4 h-4" />
            <span>Alertas del navegador</span>
          </button>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold min-h-[44px]"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Marcar todas leídas</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold min-h-[40px] ${
            filter === 'all'
              ? 'bg-blue-700 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Todas ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold min-h-[40px] ${
            filter === 'unread'
              ? 'bg-blue-700 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Sin leer ({unreadCount})
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-2">
          <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            No tienes notificaciones {filter === 'unread' ? 'pendientes' : 'aún'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Te avisaremos aquí cuando recibas coincidencias o actividad en tus publicaciones.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((notif) => (
            <div
              key={notif.id}
              className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                notif.read
                  ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  : 'border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/30'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-blue-700 dark:text-blue-400">
                    {notif.module === 'commercial'
                      ? 'MATCH COMERCIAL'
                      : notif.module === 'employment'
                      ? 'MATCH LABORAL'
                      : notif.module === 'advertising'
                      ? 'Publicidad'
                      : 'Sistema'}
                  </span>
                  <span>·</span>
                  <span className="tabular-nums">{formatTime(notif.createdAt)}</span>
                  {!notif.read && (
                    <>
                      <span>·</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">Nueva</span>
                    </>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{notif.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">{notif.body}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {notif.type === 'new_message' && (
                  <button
                    type="button"
                    onClick={() => onNavigate('messages')}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px]"
                  >
                    Ir al chat
                  </button>
                )}
                {notif.type === 'new_match' && (
                  <button
                    type="button"
                    onClick={() => onNavigate('matches')}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px]"
                  >
                    Ver match
                  </button>
                )}
                {!notif.read && (
                  <button
                    type="button"
                    onClick={() => markRead(notif.id)}
                    aria-label="Marcar notificación como leída"
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 min-h-[40px]"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Leída</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
