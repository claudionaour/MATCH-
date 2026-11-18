import React from 'react';
import {AlertTriangle, RefreshCw} from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{children: React.ReactNode}, State> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false, errorMessage: ''};
  }

  static getDerivedStateFromError(error: Error): State {
    return {hasError: true, errorMessage: error.message || 'Error inesperado en la aplicación.'};
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('MATCH+ ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Ocurrió un problema técnico</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 break-words">
              {this.state.errorMessage.startsWith('{')
                ? 'Se detectó un error de permisos o conexión con Firestore. Revisa tu sesión e intenta nuevamente.'
                : this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Recargar MATCH+
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
