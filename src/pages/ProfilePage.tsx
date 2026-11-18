import React, {useEffect, useState} from 'react';
import {Briefcase, Check, Megaphone, Store, User} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {useToast} from '../contexts/ToastContext';
import {REGIONS_CATALOG} from '../services/config/chileCatalog';
import {AppModule, AppSection, UserRole} from '../types';

interface ProfilePageProps {
  onNavigate: (section: AppSection) => void;
}

const ROLE_OPTIONS: {id: UserRole; label: string; desc: string}[] = [
  {id: 'buyer', label: 'Comprador', desc: 'Explora productos y publica necesidades de compra.'},
  {id: 'seller', label: 'Vendedor / Comercio', desc: 'Ofrece productos o servicios y responde solicitudes.'},
  {id: 'worker', label: 'Trabajador / Postulante', desc: 'Postula gratis con perfil laboral y CV privado.'},
  {id: 'company', label: 'Empresa / Empleador', desc: 'Publica vacantes y evalúa compatibilidad.'},
  {id: 'registered_advertiser', label: 'Anunciante registrado', desc: 'Accede a campañas con descuento preferente.'},
];

export const ProfilePage: React.FC<ProfilePageProps> = ({onNavigate}) => {
  const {userAccount, updateAccountProfile} = useAuth();
  const {showToast} = useToast();

  const [displayName, setDisplayName] = useState(userAccount?.displayName || '');
  const [phone, setPhone] = useState(userAccount?.phone || '');
  const [region, setRegion] = useState(userAccount?.region || REGIONS_CATALOG[0].region);
  const [commune, setCommune] = useState(userAccount?.commune || 'Castro');
  const [roles, setRoles] = useState<UserRole[]>(userAccount?.roles || ['buyer']);
  const [activeModules, setActiveModules] = useState<AppModule[]>(
    userAccount?.activeModules || ['commercial', 'employment']
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userAccount) return;
    setDisplayName(userAccount.displayName);
    setPhone(userAccount.phone || '');
    setRegion(userAccount.region);
    setCommune(userAccount.commune);
    setRoles(userAccount.roles);
    setActiveModules(userAccount.activeModules);
  }, [userAccount]);

  const currentRegionObj = REGIONS_CATALOG.find((r) => r.region === region) || REGIONS_CATALOG[0];

  const toggleRole = (role: UserRole) => {
    setRoles((prev) =>
      prev.includes(role) ? (prev.length > 1 ? prev.filter((r) => r !== role) : prev) : [...prev, role]
    );
  };

  const toggleModule = (mod: AppModule) => {
    setActiveModules((prev) =>
      prev.includes(mod) ? (prev.length > 1 ? prev.filter((m) => m !== mod) : prev) : [...prev, mod]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAccountProfile({
        displayName: displayName.trim() || 'Usuario MATCH+',
        phone: phone.trim(),
        region,
        commune,
        roles,
        activeModules,
      });
      showToast('Perfil multirrol actualizado.', 'success');
    } catch {
      showToast('No se pudo actualizar el perfil.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Mi Perfil Unificado</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Una misma cuenta te permite operar simultáneamente como comprador, vendedor, trabajador, empresa o anunciante.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSave}
          className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
        >
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Datos de Identidad y Ubicación</h2>
              <p className="text-xs text-slate-500">{userAccount?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nombre visible</span>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Teléfono de contacto</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+56 9 ..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Región</span>
              <select
                value={region}
                onChange={(e) => {
                  const nextRegion = e.target.value;
                  setRegion(nextRegion);
                  const found = REGIONS_CATALOG.find((r) => r.region === nextRegion);
                  if (found) setCommune(found.communes[0]);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                {REGIONS_CATALOG.map((r) => (
                  <option key={r.region} value={r.region}>
                    {r.region}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Comuna</span>
              <select
                value={commune}
                onChange={(e) => setCommune(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                {currentRegionObj.communes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Roles activos en esta cuenta</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ROLE_OPTIONS.map((opt) => {
                const selected = roles.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleRole(opt.id)}
                    className={`text-left p-3 rounded-xl border transition-colors ${
                      selected
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{opt.label}</span>
                      {selected && <Check className="w-4 h-4 text-blue-700 dark:text-blue-400" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Motores habilitados</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  {id: 'commercial', label: 'MATCH COMERCIAL'},
                  {id: 'employment', label: 'MATCH LABORAL'},
                  {id: 'advertising', label: 'CREA TU ANUNCIO'},
                ] as {id: AppModule; label: string}[]
              ).map((m) => {
                const active = activeModules.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleModule(m.id)}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-semibold min-h-[40px] ${
                      active
                        ? 'border-blue-600 bg-blue-700 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold min-h-[44px]"
          >
            {saving ? 'Guardando...' : 'Guardar cambios del perfil'}
          </button>
        </form>

        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Perfiles Especializados</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cada motor mantiene sus datos especializados y privacidad independiente.
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onNavigate('commercial')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
              >
                <span className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-blue-600" />
                  <span>Perfil de Vendedor / Comercio</span>
                </span>
                <span>Abrir</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('employment')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
              >
                <span className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-600" />
                  <span>Perfil Laboral, CV y Empresa</span>
                </span>
                <span>Abrir</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('advertising')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
              >
                <span className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-600" />
                  <span>Mi Publicidad y Campañas</span>
                </span>
                <span>Abrir</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
