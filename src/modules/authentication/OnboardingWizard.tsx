import React, {useState} from 'react';
import {ArrowRight, Briefcase, Check, Megaphone, Store} from 'lucide-react';
import {useAuth} from '../../contexts/AuthContext';
import {useToast} from '../../contexts/ToastContext';
import {REGIONS_CATALOG} from '../../services/config/chileCatalog';
import {AppModule, UserRole} from '../../types';

interface OnboardingWizardProps {
  onComplete: (initialModule?: AppModule) => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({onComplete}) => {
  const {userAccount, updateAccountProfile} = useAuth();
  const {showToast} = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [region, setRegion] = useState(userAccount?.region || REGIONS_CATALOG[0].region);
  const [commune, setCommune] = useState(userAccount?.commune || 'Castro');
  const [selectedModules, setSelectedModules] = useState<AppModule[]>(
    userAccount?.activeModules || ['commercial', 'employment']
  );
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(
    userAccount?.roles.filter((r) => r !== 'admin' && r !== 'moderator') || ['buyer', 'worker']
  );
  const [saving, setSaving] = useState(false);

  const currentRegionObj = REGIONS_CATALOG.find((r) => r.region === region) || REGIONS_CATALOG[0];

  const toggleModule = (mod: AppModule) => {
    setSelectedModules((prev) =>
      prev.includes(mod) ? (prev.length > 1 ? prev.filter((m) => m !== mod) : prev) : [...prev, mod]
    );
  };

  const toggleRole = (role: UserRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? (prev.length > 1 ? prev.filter((r) => r !== role) : prev) : [...prev, role]
    );
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateAccountProfile({
        region,
        commune,
        activeModules: selectedModules,
        roles: selectedRoles,
      });
      showToast('Preferencias guardadas. Ya puedes explorar MATCH+.', 'success');
      onComplete(selectedModules[0]);
    } catch {
      showToast('No pudimos guardar tus preferencias, puedes continuar igualmente.', 'info');
      onComplete(selectedModules[0]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Bienvenida · Paso {step} de 3</p>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {step === 1
                ? '¿Dónde te encuentras?'
                : step === 2
                  ? '¿Qué quieres hacer en MATCH+?'
                  : 'Elige tus perfiles iniciales'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onComplete()}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            Omitir por ahora
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Iniciamos nuestro piloto en Chiloé y Los Lagos, con cobertura expandible a todo Chile.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Región</label>
                <select
                  value={region}
                  onChange={(e) => {
                    const nextReg = e.target.value;
                    setRegion(nextReg);
                    const found = REGIONS_CATALOG.find((r) => r.region === nextReg);
                    if (found) setCommune(found.communes[0]);
                  }}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                >
                  {REGIONS_CATALOG.map((r) => (
                    <option key={r.region} value={r.region}>
                      {r.region}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Comuna</label>
                <select
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                >
                  {currentRegionObj.communes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Puedes usar uno o varios motores sin cerrar sesión ni crear cuentas adicionales.
            </p>
            <div className="grid grid-cols-1 gap-3">
              {[
                {
                  id: 'commercial' as AppModule,
                  title: 'MATCH COMERCIAL',
                  desc: 'Comprar, vender o publicar lo que necesitas mediante tarjetas deslizables y buscador.',
                  icon: <Store className="w-5 h-5 text-blue-700 dark:text-blue-400" />,
                },
                {
                  id: 'employment' as AppModule,
                  title: 'MATCH LABORAL',
                  desc: 'Encontrar empleo o contratar talento local con compatibilidad explicable.',
                  icon: <Briefcase className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />,
                },
                {
                  id: 'advertising' as AppModule,
                  title: 'MATCH ADVERTISING',
                  desc: 'Promocionar tu negocio o emprendimiento con creación guiada de anuncios.',
                  icon: <Megaphone className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
                },
              ].map((m) => {
                const active = selectedModules.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleModule(m.id)}
                    className={`flex items-start gap-4 p-4 rounded-2xl border text-left transition-colors ${
                      active
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-500'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0">
                      {m.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{m.title}</span>
                        {active && <Check className="w-4 h-4 text-blue-700 dark:text-blue-400" />}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{m.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Selecciona los roles que usarás hoy (puedes activarlos o cambiarlos en cualquier momento desde Mi Perfil):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                {id: 'buyer' as UserRole, label: 'Comprador'},
                {id: 'seller' as UserRole, label: 'Vendedor / Emprendedor'},
                {id: 'mixed' as UserRole, label: 'Mixto (Compro y vendo)'},
                {id: 'worker' as UserRole, label: 'Trabajador / Busco empleo'},
                {id: 'company' as UserRole, label: 'Empresa contratante'},
                {id: 'registered_advertiser' as UserRole, label: 'Anunciante registrado (-15%)'},
              ].map((r) => {
                const active = selectedRoles.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRole(r.id)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium min-h-[44px] ${
                      active
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{r.label}</span>
                    {active && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 min-h-[44px]"
            >
              Atrás
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold min-h-[44px]"
            >
              <span>Continuar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleFinish}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold min-h-[44px]"
            >
              <span>{saving ? 'Guardando...' : 'Comenzar en MATCH+'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
