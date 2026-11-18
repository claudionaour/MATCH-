import React, {useEffect, useMemo, useState} from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  Sliders,
  XCircle,
} from 'lucide-react';
import {useAuth} from '../../contexts/AuthContext';
import {useToast} from '../../contexts/ToastContext';
import {db, handleFirestoreError, OperationType} from '../../services/firebase/firebaseClient';
import {DEFAULT_AD_PACKAGES, DEFAULT_ROTATION_CONFIG, formatCLP} from '../../services/config/chileCatalog';
import {
  AdCampaign,
  AdOrder,
  AdPackage,
  AdRotationConfig,
  AuditLogEntry,
  CommercialProduct,
  JobVacancy,
  MatchRecord,
  ReportRecord,
  UserAccount,
} from '../../types';

interface AdminPanelProps {
  rotationConfig: AdRotationConfig;
  onRotationUpdated: (next: AdRotationConfig) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({rotationConfig, onRotationUpdated}) => {
  const {firebaseUser, isAdmin} = useAuth();
  const {showToast} = useToast();

  const [tab, setTab] = useState<'overview' | 'moderation' | 'tariffs' | 'finance' | 'audit'>('overview');

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [products, setProducts] = useState<CommercialProduct[]>([]);
  const [vacancies, setVacancies] = useState<JobVacancy[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [orders, setOrders] = useState<AdOrder[]>([]);
  const [packages, setPackages] = useState<AdPackage[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [rotDraft, setRotDraft] = useState<AdRotationConfig>(rotationConfig);
  const [pkgDrafts, setPkgDrafts] = useState<Record<string, {priceCLP: number; durationDays: number; active: boolean}>>({});
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    setRotDraft(rotationConfig);
  }, [rotationConfig]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubs = [
      onSnapshot(
        collection(db, 'users'),
        (s) => setUsers(s.docs.map((d) => d.data() as UserAccount)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'users')
      ),
      onSnapshot(
        collection(db, 'products'),
        (s) => setProducts(s.docs.map((d) => ({id: d.id, ...(d.data() as Omit<CommercialProduct, 'id'>)}))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'products')
      ),
      onSnapshot(
        collection(db, 'jobVacancies'),
        (s) => setVacancies(s.docs.map((d) => ({id: d.id, ...(d.data() as Omit<JobVacancy, 'id'>)}))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'jobVacancies')
      ),
      onSnapshot(
        collection(db, 'matches'),
        (s) => setMatches(s.docs.map((d) => ({id: d.id, ...(d.data() as Omit<MatchRecord, 'id'>)}))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'matches')
      ),
      onSnapshot(
        collection(db, 'adCampaigns'),
        (s) => setCampaigns(s.docs.map((d) => ({id: d.id, ...(d.data() as Omit<AdCampaign, 'id'>)}))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'adCampaigns')
      ),
      onSnapshot(
        collection(db, 'adOrders'),
        (s) => setOrders(s.docs.map((d) => ({id: d.id, ...(d.data() as Omit<AdOrder, 'id'>)}))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'adOrders')
      ),
      onSnapshot(
        collection(db, 'adPackages'),
        (s) => {
          const list = s.docs.map((d) => ({id: d.id, ...(d.data() as Omit<AdPackage, 'id'>)}));
          setPackages(list);
          const map: Record<string, {priceCLP: number; durationDays: number; active: boolean}> = {};
          (list.length > 0 ? list : DEFAULT_AD_PACKAGES).forEach((p) => {
            map[p.id] = {priceCLP: p.priceCLP, durationDays: p.durationDays, active: p.active};
          });
          setPkgDrafts(map);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'adPackages')
      ),
      onSnapshot(
        collection(db, 'reports'),
        (s) => setReports(s.docs.map((d) => ({id: d.id, ...(d.data() as Omit<ReportRecord, 'id'>)}))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'reports')
      ),
      onSnapshot(
        collection(db, 'auditLogs'),
        (s) => setAuditLogs(s.docs.map((d) => ({id: d.id, ...(d.data() as Omit<AuditLogEntry, 'id'>)}))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [isAdmin]);

  const recordAudit = async (action: string, targetCollection: string, targetId: string, summary: string) => {
    if (!firebaseUser) return;
    await addDoc(collection(db, 'auditLogs'), {
      actorUid: firebaseUser.uid,
      actorEmail: firebaseUser.email || '',
      action,
      targetCollection,
      targetId,
      summary,
      createdAt: serverTimestamp(),
    });
  };

  // Financial accounting strictly separated by engine
  const financeByEngine = useMemo(() => {
    const calc = (engine: 'commercial' | 'employment' | 'advertising') => {
      const subset = orders.filter((o) => o.engine === engine);
      const confirmed = subset.filter((o) => o.status === 'confirmed').reduce((acc, o) => acc + o.amountCLP, 0);
      const pending = subset
        .filter((o) => o.status === 'pending' || o.status === 'pending_confirmation')
        .reduce((acc, o) => acc + o.amountCLP, 0);
      return {totalOrders: subset.length, confirmed, pending};
    };
    return {
      commercial: calc('commercial'),
      employment: calc('employment'),
      advertising: calc('advertising'),
    };
  }, [orders]);

  const handleConfirmOrderAndActivateCampaign = async (order: AdOrder) => {
    try {
      await updateDoc(doc(db, 'adOrders', order.id), {
        status: 'confirmed',
        updatedAt: serverTimestamp(),
      });
      if (order.campaignId) {
        const linked = campaigns.find((c) => c.id === order.campaignId);
        await updateDoc(doc(db, 'adCampaigns', order.campaignId), {
          paymentStatus: 'confirmed',
          moderationStatus: linked?.moderationStatus === 'rejected' ? 'pending_review' : 'active',
          updatedAt: serverTimestamp(),
        });
      }
      await recordAudit(
        'confirm_payment',
        'adOrders',
        order.id,
        `Pago confirmado (${order.commerceOrder}) por ${formatCLP(order.amountCLP)}`
      );
      showToast('Pago confirmado y campaña activada.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `adOrders/${order.id}`);
    }
  };

  const handleCampaignModeration = async (
    camp: AdCampaign,
    decision: 'active' | 'approved' | 'rejected' | 'paused'
  ) => {
    if (decision === 'rejected' && !(rejectionReasons[camp.id] || '').trim()) {
      showToast('Debes ingresar un motivo de rechazo obligatorio.', 'error');
      return;
    }
    try {
      const nextStatus =
        decision === 'active' && camp.paymentStatus !== 'confirmed' ? 'approved' : decision;
      await updateDoc(doc(db, 'adCampaigns', camp.id), {
        moderationStatus: nextStatus,
        ...(decision === 'rejected' ? {rejectionReason: rejectionReasons[camp.id].trim()} : {}),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'notifications'), {
        userId: camp.ownerId,
        type: 'ad_campaign',
        title: decision === 'rejected' ? 'Campaña observada en revisión' : 'Campaña aprobada',
        body:
          decision === 'rejected'
            ? `Motivo: ${rejectionReasons[camp.id].trim()}`
            : `Tu campaña "${camp.title}" fue revisada (${nextStatus}).`,
        module: 'advertising',
        relatedId: camp.id,
        read: false,
        createdAt: serverTimestamp(),
      });
      await recordAudit(
        `moderate_campaign_${nextStatus}`,
        'adCampaigns',
        camp.id,
        `Campaña "${camp.title}" marcada como ${nextStatus}`
      );
      showToast(`Campaña actualizada a ${nextStatus}.`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `adCampaigns/${camp.id}`);
    }
  };

  const handleResolveReport = async (rep: ReportRecord, nextStatus: 'reviewed' | 'dismissed') => {
    try {
      await updateDoc(doc(db, 'reports', rep.id), {
        status: nextStatus,
        resolutionNote: nextStatus === 'reviewed' ? 'Revisado y atendido por administración' : 'Desestimado',
        updatedAt: serverTimestamp(),
      });
      await recordAudit('resolve_report', 'reports', rep.id, `Denuncia ${rep.targetType} marcada como ${nextStatus}`);
      showToast('Denuncia actualizada.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${rep.id}`);
    }
  };

  const handleToggleProductVerify = async (prod: CommercialProduct) => {
    try {
      await updateDoc(doc(db, 'products', prod.id), {
        verified: !prod.verified,
        updatedAt: serverTimestamp(),
      });
      await recordAudit('verify_product', 'products', prod.id, `Producto ${prod.title} verified=${!prod.verified}`);
      showToast('Estado de verificación actualizado.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${prod.id}`);
    }
  };

  const handleToggleVacancyVerify = async (vac: JobVacancy) => {
    try {
      await updateDoc(doc(db, 'jobVacancies', vac.id), {
        verified: !vac.verified,
        updatedAt: serverTimestamp(),
      });
      await recordAudit('verify_vacancy', 'jobVacancies', vac.id, `Vacante ${vac.title} verified=${!vac.verified}`);
      showToast('Estado de verificación laboral actualizado.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `jobVacancies/${vac.id}`);
    }
  };

  const handleSaveRotationConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await setDoc(doc(db, 'systemSettings', 'global'), {
        ...rotDraft,
        updatedAt: serverTimestamp(),
      });
      onRotationUpdated(rotDraft);
      await recordAudit(
        'update_rotation_config',
        'systemSettings',
        'global',
        `Rotación actualizada: 1er@${rotDraft.firstAdAfterPosts}, maxSession=${rotDraft.maxAdsPerSession}, desc=${rotDraft.registeredAdvertiserDiscountPercent}%`
      );
      showToast('Reglas de rotación y descuento guardadas.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'systemSettings/global');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSeedOrSavePackages = async () => {
    setSavingConfig(true);
    try {
      const baseList = packages.length > 0 ? packages : DEFAULT_AD_PACKAGES;
      for (const pkg of baseList) {
        const draft = pkgDrafts[pkg.id] || {
          priceCLP: pkg.priceCLP,
          durationDays: pkg.durationDays,
          active: pkg.active,
        };
        await setDoc(doc(db, 'adPackages', pkg.id), {
          name: pkg.name,
          tier: pkg.tier,
          billingCycle: pkg.billingCycle,
          durationDays: Number(draft.durationDays),
          priceCLP: Number(draft.priceCLP),
          priorityWeight: pkg.priorityWeight,
          description: pkg.description,
          features: pkg.features,
          active: Boolean(draft.active),
          updatedAt: serverTimestamp(),
        });
      }
      await recordAudit('update_ad_packages', 'adPackages', 'all', 'Tarifas de paquetes publicitarios sincronizadas');
      showToast('Tarifas publicitarias guardadas en Firestore.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'adPackages');
    } finally {
      setSavingConfig(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-8 text-center space-y-2">
        <ShieldCheck className="w-8 h-8 mx-auto text-rose-600" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Acceso restringido</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Esta sección está reservada exclusivamente para administradores autorizados de MATCH+.
        </p>
      </div>
    );
  }

  const effectivePackages = packages.length > 0 ? packages : DEFAULT_AD_PACKAGES;
  const openReports = reports.filter((r) => r.status === 'open');
  const pendingCampaigns = campaigns.filter(
    (c) => c.moderationStatus === 'pending_review' || c.moderationStatus === 'approved'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Panel Administrativo MATCH+
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Moderación, tarifas publicitarias, rotación y contabilidad separada por motor.
          </p>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          {id: 'overview', label: 'Panel general', icon: <BarChart3 className="w-4 h-4" />},
          {
            id: 'moderation',
            label: `Moderación y Denuncias (${pendingCampaigns.length + openReports.length})`,
            icon: <AlertTriangle className="w-4 h-4" />,
          },
          {id: 'tariffs', label: 'Tarifas y Rotación', icon: <Sliders className="w-4 h-4" />},
          {id: 'finance', label: 'Contabilidad por Motor', icon: <CreditCard className="w-4 h-4" />},
          {id: 'audit', label: `Auditoría (${auditLogs.length})`, icon: <ShieldCheck className="w-4 h-4" />},
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as typeof tab)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold min-h-[40px] ${
              tab === item.id
                ? 'bg-blue-700 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500">Usuarios registrados</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
                {users.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500">Productos / Vacantes</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
                {products.length} / {vacancies.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500">Matches reales</p>
              <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                {matches.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500">Campañas / Órdenes</p>
              <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 tabular-nums mt-1">
                {campaigns.length} / {orders.length}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Verificación de Productos Comerciales
              </h3>
              {products.length === 0 ? (
                <p className="text-xs text-slate-500">Sin productos reales registrados aún.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {products.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 text-xs py-2 border-b border-slate-100 dark:border-slate-800"
                    >
                      <div className="truncate">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{p.title}</p>
                        <p className="text-slate-500">
                          {p.sellerName} · {formatCLP(p.priceCLP)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleProductVerify(p)}
                        className={`px-2.5 py-1 rounded-lg font-semibold ${
                          p.verified
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {p.verified ? 'Verificado' : 'Verificar'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Verificación de Vacantes Laborales</h3>
              {vacancies.length === 0 ? (
                <p className="text-xs text-slate-500">Sin vacantes reales registradas aún.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {vacancies.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between gap-2 text-xs py-2 border-b border-slate-100 dark:border-slate-800"
                    >
                      <div className="truncate">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{v.title}</p>
                        <p className="text-slate-500">
                          {v.companyName} · {v.commune}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleVacancyVerify(v)}
                        className={`px-2.5 py-1 rounded-lg font-semibold ${
                          v.verified
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {v.verified ? 'Verificada' : 'Verificar'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'moderation' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Campañas Publicitarias ({campaigns.length})
            </h3>
            {campaigns.length === 0 ? (
              <p className="text-xs text-slate-500">No hay campañas enviadas.</p>
            ) : (
              <div className="space-y-3">
                {campaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                          {camp.businessName} · Pago: {camp.paymentStatus} · Moderación: {camp.moderationStatus}
                        </p>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{camp.title}</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{camp.description}</p>
                        <p className="text-xs text-slate-500 mt-1 tabular-nums">
                          Plan {camp.packageName} · {formatCLP(camp.finalAmountCLP)} · Alcance {camp.targetScope}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleCampaignModeration(camp, 'active')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Aprobar / Activar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCampaignModeration(camp, 'paused')}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                        >
                          Pausar
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={rejectionReasons[camp.id] || ''}
                        onChange={(e) =>
                          setRejectionReasons((prev) => ({...prev, [camp.id]: e.target.value}))
                        }
                        placeholder="Motivo obligatorio para rechazar..."
                        className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleCampaignModeration(camp, 'rejected')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Rechazar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Denuncias y Seguridad ({reports.length})
            </h3>
            {reports.length === 0 ? (
              <p className="text-xs text-slate-500">Sin denuncias registradas.</p>
            ) : (
              <div className="space-y-2.5">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                        {rep.module.toUpperCase()} · {rep.targetType} ({rep.targetId}) · Estado: {rep.status}
                      </p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{rep.reason}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{rep.details}</p>
                    </div>
                    {rep.status === 'open' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleResolveReport(rep, 'reviewed')}
                          className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-semibold"
                        >
                          Marcar atendida
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveReport(rep, 'dismissed')}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                        >
                          Desestimar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'tariffs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveRotationConfig}
            className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Reglas de Rotación y Descuento
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="space-y-1">
                <span className="font-medium text-slate-600 dark:text-slate-300">1er anuncio tras N posts</span>
                <input
                  type="number"
                  min={1}
                  value={rotDraft.firstAdAfterPosts}
                  onChange={(e) => setRotDraft({...rotDraft, firstAdAfterPosts: Number(e.target.value)})}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
                />
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-600 dark:text-slate-300">2do tras +N adicionales</span>
                <input
                  type="number"
                  min={1}
                  value={rotDraft.secondAdAfterAdditional}
                  onChange={(e) => setRotDraft({...rotDraft, secondAdAfterAdditional: Number(e.target.value)})}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
                />
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-600 dark:text-slate-300">3er+ tras +N adicionales</span>
                <input
                  type="number"
                  min={1}
                  value={rotDraft.thirdAdAfterAdditional}
                  onChange={(e) => setRotDraft({...rotDraft, thirdAdAfterAdditional: Number(e.target.value)})}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
                />
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-600 dark:text-slate-300">Máx. anuncios / sesión</span>
                <input
                  type="number"
                  min={1}
                  value={rotDraft.maxAdsPerSession}
                  onChange={(e) => setRotDraft({...rotDraft, maxAdsPerSession: Number(e.target.value)})}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
                />
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-600 dark:text-slate-300">Máx. mismo anunciante</span>
                <input
                  type="number"
                  min={1}
                  value={rotDraft.maxSameAdvertiserPerSession}
                  onChange={(e) => setRotDraft({...rotDraft, maxSameAdvertiserPerSession: Number(e.target.value)})}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
                />
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-600 dark:text-slate-300">Desc. anunciante registrado %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={rotDraft.registeredAdvertiserDiscountPercent}
                  onChange={(e) =>
                    setRotDraft({...rotDraft, registeredAdvertiserDiscountPercent: Number(e.target.value)})
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingConfig}
                className="flex-1 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold min-h-[44px]"
              >
                Guardar configuración global
              </button>
              <button
                type="button"
                onClick={() => setRotDraft(DEFAULT_ROTATION_CONFIG)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                Restaurar
              </button>
            </div>
          </form>

          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Tarifario de Paquetes Publicitarios
              </h3>
              <button
                type="button"
                disabled={savingConfig}
                onClick={handleSeedOrSavePackages}
                className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold min-h-[40px]"
              >
                Sincronizar paquetes
              </button>
            </div>
            <div className="space-y-2.5">
              {effectivePackages.map((pkg) => {
                const d = pkgDrafts[pkg.id] || {
                  priceCLP: pkg.priceCLP,
                  durationDays: pkg.durationDays,
                  active: pkg.active,
                };
                return (
                  <div
                    key={pkg.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs"
                  >
                    <div className="sm:col-span-5">
                      <p className="font-bold text-slate-900 dark:text-white">{pkg.name}</p>
                      <p className="text-slate-500">Peso prioridad: {pkg.priorityWeight}</p>
                    </div>
                    <label className="sm:col-span-3 space-y-1">
                      <span className="text-[11px] text-slate-500">Precio CLP</span>
                      <input
                        type="number"
                        value={d.priceCLP}
                        onChange={(e) =>
                          setPkgDrafts((prev) => ({
                            ...prev,
                            [pkg.id]: {...d, priceCLP: Number(e.target.value)},
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
                      />
                    </label>
                    <label className="sm:col-span-2 space-y-1">
                      <span className="text-[11px] text-slate-500">Días</span>
                      <input
                        type="number"
                        value={d.durationDays}
                        onChange={(e) =>
                          setPkgDrafts((prev) => ({
                            ...prev,
                            [pkg.id]: {...d, durationDays: Number(e.target.value)},
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
                      />
                    </label>
                    <label className="sm:col-span-2 flex items-center gap-1.5 justify-end">
                      <input
                        type="checkbox"
                        checked={d.active}
                        onChange={(e) =>
                          setPkgDrafts((prev) => ({
                            ...prev,
                            [pkg.id]: {...d, active: e.target.checked},
                          }))
                        }
                      />
                      <span>Activo</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'finance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-1">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">MATCH COMERCIAL</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {formatCLP(financeByEngine.commercial.confirmed)}
              </p>
              <p className="text-xs text-slate-500 tabular-nums">
                Pendiente: {formatCLP(financeByEngine.commercial.pending)} · Órdenes:{' '}
                {financeByEngine.commercial.totalOrders}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-1">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">MATCH LABORAL</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {formatCLP(financeByEngine.employment.confirmed)}
              </p>
              <p className="text-xs text-slate-500 tabular-nums">
                Pendiente: {formatCLP(financeByEngine.employment.pending)} · Órdenes:{' '}
                {financeByEngine.employment.totalOrders}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-1">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">MATCH ADVERTISING</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {formatCLP(financeByEngine.advertising.confirmed)}
              </p>
              <p className="text-xs text-slate-500 tabular-nums">
                Pendiente: {formatCLP(financeByEngine.advertising.pending)} · Órdenes:{' '}
                {financeByEngine.advertising.totalOrders}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Conciliación de Órdenes y Transferencias ({orders.length})
            </h3>
            {orders.length === 0 ? (
              <p className="text-xs text-slate-500">Sin órdenes de pago registradas aún.</p>
            ) : (
              <div className="space-y-2.5">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {order.commerceOrder} · {order.description}
                      </p>
                      <p className="text-slate-500 tabular-nums">
                        Motor: {order.engine} · Método: {order.paymentMethod.toUpperCase()} · Monto:{' '}
                        {formatCLP(order.amountCLP)} · Estado: {order.status}
                      </p>
                      {order.receiptNote && (
                        <p className="text-amber-700 dark:text-amber-400 mt-0.5">Comprobante: {order.receiptNote}</p>
                      )}
                    </div>
                    {order.status !== 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => handleConfirmOrderAndActivateCampaign(order)}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      >
                        Confirmar pago y activar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Bitácora de Auditoría Administrativa
          </h3>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500">Aún no se registran eventos de auditoría.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{log.summary}</p>
                    <p className="text-slate-500">
                      {log.actorEmail || log.actorUid} · {log.action} · {log.targetCollection}/{log.targetId}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
