import React, {useEffect, useState} from 'react';
import {doc, serverTimestamp, updateDoc} from 'firebase/firestore';
import {CreditCard, Moon, ShieldAlert, Sun, Trash2} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {useTheme} from '../contexts/ThemeContext';
import {useToast} from '../contexts/ToastContext';
import {db, handleFirestoreError, OperationType} from '../services/firebase/firebaseClient';
import {getFlowGatewayStatus, FlowStatusResponse} from '../services/payments/paymentService';
import {PWAInstallButton} from '../components/PWAInstallButton';
import {NotificationPreferences} from '../types';

export const SettingsPage: React.FC = () => {
  const {firebaseUser, userAccount, updateAccountProfile, logout} = useAuth();
  const {theme, toggleTheme} = useTheme();
  const {showToast} = useToast();

  const [flowStatus, setFlowStatus] = useState<FlowStatusResponse | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void getFlowGatewayStatus().then(setFlowStatus);
  }, []);

  const togglePref = async (key: keyof NotificationPreferences) => {
    if (!userAccount) return;
    const nextPrefs = {
      ...userAccount.notificationPrefs,
      [key]: !userAccount.notificationPrefs[key],
    };
    await updateAccountProfile({notificationPrefs: nextPrefs});
    showToast('Preferencia de notificación actualizada.', 'success');
  };

  const handleDeactivateAccount = async () => {
    if (!firebaseUser) return;
    setDeleting(true);
    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        displayName: 'Cuenta eliminada',
        phone: '',
        status: 'deleted',
        updatedAt: serverTimestamp(),
      });
      showToast('Cuenta marcada como eliminada conforme a Ley 19.628. Cerrando sesión...', 'info');
      await logout();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Configuración</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Apariencia, alertas, instalación PWA y gestión de privacidad de tu cuenta.
        </p>
      </div>

      {/* Appearance & PWA */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Apariencia e Instalación</h2>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Tema de interfaz</p>
            <p className="text-xs text-slate-500">Alterna entre modo claro de alta legibilidad y modo oscuro.</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold min-h-[44px]"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span>{theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}</span>
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Aplicación Web Progresiva (PWA)</p>
            <p className="text-xs text-slate-500">Instala MATCH+ en tu teléfono o computador para acceso rápido.</p>
          </div>
          <PWAInstallButton />
        </div>
      </div>

      {/* Notification Prefs */}
      {userAccount && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Preferencias de Notificación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {(
              [
                ['matches', 'Nuevos matches mutuos'],
                ['messages', 'Mensajes directos en chat'],
                ['interests', 'Interés en tus publicaciones'],
                ['compatibleNeeds', 'Necesidades comerciales compatibles'],
                ['compatibleJobs', 'Vacantes laborales compatibles'],
                ['campaigns', 'Estado de tus campañas publicitarias'],
                ['payments', 'Confirmaciones y comprobantes de pago'],
              ] as [keyof NotificationPreferences, string][]
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer"
              >
                <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(userAccount.notificationPrefs[key])}
                  onChange={() => togglePref(key)}
                  className="w-4 h-4"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Payment Gateway Info */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-2">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-blue-700 dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Pasarela de Pagos Flow Chile</h2>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Estado del entorno servidor:{' '}
          <strong>
            {flowStatus?.configured
              ? `Configurado (${flowStatus.environment.toUpperCase()})`
              : 'Pendiente de credenciales FLOW_API_KEY / FLOW_SECRET_KEY (modo transferencia bancaria disponible)'}
          </strong>
        </p>
      </div>

      {/* Account deletion / Privacy */}
      <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 p-6 space-y-3">
        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
          <ShieldAlert className="w-4 h-4" />
          <h2 className="text-base font-bold">Privacidad y Eliminación de Cuenta</h2>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          De acuerdo con los principios de protección de datos personales en Chile (Ley 19.628), puedes solicitar la
          desactivación y anonimización de tu cuenta en cualquier momento.
        </p>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold min-h-[44px]"
          >
            <Trash2 className="w-4 h-4" />
            <span>Solicitar eliminación de mi cuenta</span>
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={deleting}
              onClick={handleDeactivateAccount}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold min-h-[44px]"
            >
              {deleting ? 'Procesando...' : 'Confirmar eliminación definitiva'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold min-h-[44px]"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
