import React, {useState} from 'react';
import {ArrowLeft, CheckCircle2, KeyRound, Mail, RefreshCw, ShieldAlert} from 'lucide-react';
import {useAuth} from '../../contexts/AuthContext';
import {useToast} from '../../contexts/ToastContext';
import {Logo} from '../../components/Logo';
import {PWAInstallButton} from '../../components/PWAInstallButton';

interface AuthScreenProps {
  initialMode?: 'login' | 'register' | 'reset';
  onBack?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({initialMode = 'login', onBack}) => {
  const {
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
    needsEmailVerification,
    resendVerification,
    refreshAccount,
    logout,
    firebaseUser,
  } = useAuth();
  const {showToast} = useToast();

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [providerNotice, setProviderNotice] = useState<string | null>(null);

  if (needsEmailVerification && firebaseUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 space-y-5">
          <Logo size="md" />
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Verifica tu correo electrónico</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Enviamos un enlace de verificación a <strong>{firebaseUser.email}</strong>. Por seguridad, las acciones en
              MATCH+ requieren correo verificado.
            </p>
          </div>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={async () => {
                await refreshAccount();
                showToast('Estado de verificación actualizado.', 'info');
              }}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Ya verifiqué mi correo</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await resendVerification();
                showToast('Correo de verificación reenviado.', 'success');
              }}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reenviar enlace de verificación</span>
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="w-full py-2.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Cerrar sesión o usar otra cuenta
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleGoogle = async () => {
    setLoading(true);
    setProviderNotice(null);
    try {
      await signInWithGoogle();
      showToast('Sesión iniciada correctamente con Google.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar con Google.';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProviderNotice(null);
    if (!email.trim()) {
      showToast('Ingresa tu correo electrónico.', 'error');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'reset') {
        await sendPasswordReset(email.trim());
        showToast('Instrucciones enviadas a tu correo para restablecer la contraseña.', 'success');
        setMode('login');
      } else if (mode === 'register') {
        if (!consentAccepted) {
          showToast('Debes aceptar las políticas de privacidad y términos de uso.', 'error');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
          setLoading(false);
          return;
        }
        await registerWithEmail(email.trim(), password, displayName.trim() || email.split('@')[0]);
        showToast('Cuenta creada. Revisa tu bandeja para verificar tu correo.', 'success');
      } else {
        await signInWithEmail(email.trim(), password);
        showToast('Bienvenido a MATCH+.', 'success');
      }
    } catch (err) {
      const code = (err as {code?: string})?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setProviderNotice(
          'El proveedor Correo y Contraseña aún no está habilitado en Firebase Console (Authentication → Sign-in method → Email/Password). Puedes habilitarlo allí o ingresar de inmediato con Google.'
        );
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        showToast('Correo o contraseña incorrectos.', 'error');
      } else if (code === 'auth/email-already-in-use') {
        showToast('Ese correo ya está registrado. Intenta iniciar sesión.', 'error');
      } else {
        showToast(err instanceof Error ? err.message : 'No se pudo completar la operación.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 relative">
      <div className="fixed top-4 right-4 z-30">
        <PWAInstallButton compact responsiveLabel />
      </div>
      <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <Logo size="md" />
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver</span>
            </button>
          )}
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {mode === 'login'
              ? 'Ingresar a MATCH+'
              : mode === 'register'
                ? 'Crear cuenta gratuita'
                : 'Recuperar contraseña'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Una sola cuenta para comprar, vender, buscar empleo, contratar y anunciar.
          </p>
        </div>

        {/* Google Auth (Primary zero-friction login) */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors min-h-[48px] disabled:opacity-60"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.22 1.18-3.24 0-5.99-2.19-6.97-5.14H1.03v3.14C3.04 21.18 7.21 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.03 14.03c-.25-.74-.39-1.53-.39-2.34 0-.81.14-1.6.39-2.34V6.21H1.03C.37 7.52 0 9 0 10.69c0 1.69.37 3.17 1.03 4.48l4-3.14Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.04 2.82 1.03 6.91l4 3.14c.98-2.95 3.73-5.3 6.97-5.3Z"
            />
          </svg>
          <span>Continuar con Google</span>
        </button>

        <div className="relative flex items-center">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
          <span className="shrink mx-3 text-xs text-slate-400">o con tu correo</span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
        </div>

        {providerNotice && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{providerNotice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nombre o negocio</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ej. María Soto o Taller Chiloé"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Correo electrónico</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.cl"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Contraseña</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          )}

          {mode === 'register' && (
            <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              <span>
                Autorizo el tratamiento de mis datos conforme a la Ley N° 19.628 de Chile, política de privacidad y
                términos de uso de MATCH+.
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors min-h-[48px] disabled:opacity-60"
          >
            {loading
              ? 'Procesando...'
              : mode === 'login'
                ? 'Iniciar sesión'
                : mode === 'register'
                  ? 'Crear cuenta'
                  : 'Enviar enlace de recuperación'}
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 pt-1">
          {mode === 'login' ? (
            <>
              <button type="button" onClick={() => setMode('register')} className="hover:text-blue-700 font-medium">
                ¿No tienes cuenta? Regístrate
              </button>
              <button type="button" onClick={() => setMode('reset')} className="hover:text-blue-700 font-medium">
                Olvidé mi contraseña
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setMode('login')} className="hover:text-blue-700 font-medium">
              Ya tengo una cuenta · Iniciar sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
