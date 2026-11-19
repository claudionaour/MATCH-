import React, {useState} from 'react';
import {createPortal} from 'react-dom';
import {Download, ExternalLink, Laptop, Share, Smartphone, X} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  responsiveLabel?: boolean;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  responsiveLabel = false,
  className = '',
}) => {
  const {isInstallable, isInstalled, isIOS, isAndroid, isInIframe, install} = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  const modal =
    showGuide && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Instalar MATCH+ en tu dispositivo
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center"
                  aria-label="Cerrar instrucciones"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isIOS ? (
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                    <Share className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>En iPhone o iPad (Safari):</span>
                  </p>
                  <ol className="space-y-2 list-decimal pl-5">
                    <li>
                      Toca el botón <strong>Compartir</strong> en la barra inferior de Safari.
                    </li>
                    <li>
                      Desplázate hacia abajo y selecciona <strong>Agregar a inicio</strong>.
                    </li>
                    <li>
                      Confirma tocando <strong>Agregar</strong> para abrir MATCH+ como aplicación independiente.
                    </li>
                  </ol>
                </div>
              ) : isAndroid ? (
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                    <Smartphone className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>En Android (Chrome / Edge):</span>
                  </p>
                  <ol className="space-y-2 list-decimal pl-5">
                    <li>
                      Toca el menú del navegador (<strong>⋮</strong>) en la esquina superior derecha.
                    </li>
                    <li>
                      Selecciona <strong>Instalar aplicación</strong> o <strong>Agregar a la pantalla principal</strong>.
                    </li>
                    <li>Confirma la instalación para acceder desde tu pantalla de inicio.</li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                    <Laptop className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>En computador o móvil:</span>
                  </p>
                  <ol className="space-y-2 list-decimal pl-5">
                    <li>
                      En Chrome o Edge, haz clic en el ícono de <strong>Instalar MATCH+</strong> ubicado en el extremo
                      derecho de la barra de direcciones.
                    </li>
                    <li>
                      También puedes abrir el menú del navegador (<strong>⋮</strong>) →{' '}
                      <strong>Guardar y compartir</strong> → <strong>Instalar aplicación</strong>.
                    </li>
                    <li>
                      En Safari (iPhone/iPad), toca <strong>Compartir</strong> → <strong>Agregar a inicio</strong>.
                    </li>
                  </ol>
                </div>
              )}

              {isInIframe && typeof window !== 'undefined' && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-800/70 bg-blue-50 dark:bg-blue-950/40 p-3.5 space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <p>
                    Estás viendo la aplicación dentro de una vista previa embebida. Ábrela en una pestaña independiente
                    para habilitar el cuadro de instalación directo del navegador.
                  </p>
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold transition-colors min-h-[40px]"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir en pestaña nueva para instalar</span>
                  </a>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[44px]"
              >
                Entendido
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        title="Instalar aplicación MATCH+"
        aria-label="Instalar aplicación"
        className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/70 transition-colors whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 sm:px-3 py-1.5 text-xs font-semibold min-h-[40px]' : 'px-4 py-2 text-sm font-semibold min-h-[44px]'
        } ${className}`}
      >
        <Download className="w-4 h-4 text-blue-700 dark:text-blue-300 shrink-0" />
        {responsiveLabel ? (
          <>
            <span className="sm:hidden">Instalar</span>
            <span className="hidden sm:inline">Instalar App</span>
          </>
        ) : (
          <span>Instalar App</span>
        )}
      </button>
      {modal}
    </>
  );
};
