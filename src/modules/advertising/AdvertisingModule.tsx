import React, {useEffect, useState} from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  BarChart3,
  CheckCircle2,
  Edit3,
  Megaphone,
  Pause,
  Play,
  Plus,
  Receipt,
  Sparkles,
} from 'lucide-react';
import {useAuth} from '../../contexts/AuthContext';
import {useToast} from '../../contexts/ToastContext';
import {db, handleFirestoreError, OperationType} from '../../services/firebase/firebaseClient';
import {DEFAULT_AD_PACKAGES, DEMO_ADS, formatCLP} from '../../services/config/chileCatalog';
import {AdCampaign, AdOrder, AdPackage, AdvertiserAccount} from '../../types';
import {CreateAdWizard} from './CreateAdWizard';
import {SafeImage} from '../../components/SafeImage';

interface AdvertisingModuleProps {
  discountPercent: number;
}

export const AdvertisingModule: React.FC<AdvertisingModuleProps> = ({discountPercent}) => {
  const {firebaseUser} = useAuth();
  const {showToast} = useToast();

  const [view, setView] = useState<'directory' | 'my_ads' | 'wizard'>('directory');
  const [packages, setPackages] = useState<AdPackage[]>([]);
  const [activeAds, setActiveAds] = useState<AdCampaign[]>([]);
  const [myCampaigns, setMyCampaigns] = useState<AdCampaign[]>([]);
  const [myOrders, setMyOrders] = useState<AdOrder[]>([]);
  const [myAdvertiser, setMyAdvertiser] = useState<AdvertiserAccount | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<AdCampaign | null>(null);

  useEffect(() => {
    const unsubPkg = onSnapshot(
      query(collection(db, 'adPackages'), where('active', '==', true)),
      (snap) => setPackages(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<AdPackage, 'id'>)}))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'adPackages')
    );

    const unsubPublicAds = onSnapshot(
      query(collection(db, 'adCampaigns'), where('moderationStatus', '==', 'active')),
      (snap) => setActiveAds(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<AdCampaign, 'id'>)}))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'adCampaigns')
    );

    return () => {
      unsubPkg();
      unsubPublicAds();
    };
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubMine = onSnapshot(
      query(collection(db, 'adCampaigns'), where('ownerId', '==', firebaseUser.uid)),
      (snap) => setMyCampaigns(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<AdCampaign, 'id'>)}))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'adCampaigns')
    );

    const unsubOrders = onSnapshot(
      query(collection(db, 'adOrders'), where('ownerId', '==', firebaseUser.uid)),
      (snap) => setMyOrders(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<AdOrder, 'id'>)}))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'adOrders')
    );

    const unsubAdv = onSnapshot(
      query(collection(db, 'advertisers'), where('ownerId', '==', firebaseUser.uid)),
      (snap) => {
        if (!snap.empty) {
          const d = snap.docs[0];
          setMyAdvertiser({id: d.id, ...(d.data() as Omit<AdvertiserAccount, 'id'>)});
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'advertisers')
    );

    return () => {
      unsubMine();
      unsubOrders();
      unsubAdv();
    };
  }, [firebaseUser]);

  const displayDirectoryAds = [...activeAds, ...DEMO_ADS];

  const handleTogglePause = async (camp: AdCampaign) => {
    const nextStatus = camp.moderationStatus === 'active' ? 'paused' : 'active';
    try {
      await updateDoc(doc(db, 'adCampaigns', camp.id), {
        moderationStatus: nextStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(nextStatus === 'paused' ? 'Campaña pausada.' : 'Campaña reanudada.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `adCampaigns/${camp.id}`);
    }
  };

  const totalImpressions = myCampaigns.reduce((acc, c) => acc + (c.impressionsCount || 0), 0);
  const totalClicks = myCampaigns.reduce((acc, c) => acc + (c.clicksCount || 0), 0);
  const totalContacts = myCampaigns.reduce((acc, c) => acc + (c.contactsCount || 0), 0);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            MATCH ADVERTISING · Publicidad y Destacados
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Crea tu anuncio en 10 pasos guiados, segmenta por comuna o categoría y gestiona tus campañas con Flow.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingCampaign(null);
            setView('wizard');
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold min-h-[44px] whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>CREA TU ANUNCIO</span>
        </button>
      </div>

      {view !== 'wizard' && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setView('directory')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold min-h-[40px] ${
              view === 'directory'
                ? 'bg-slate-900 dark:bg-blue-700 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Negocios Destacados y Planes</span>
          </button>
          <button
            type="button"
            onClick={() => setView('my_ads')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold min-h-[40px] ${
              view === 'my_ads'
                ? 'bg-slate-900 dark:bg-blue-700 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>MI PUBLICIDAD ({myCampaigns.length})</span>
          </button>
        </div>
      )}

      {view === 'wizard' && (
        <CreateAdWizard
          packages={packages.length > 0 ? packages : DEFAULT_AD_PACKAGES}
          discountPercent={discountPercent}
          existingAdvertiser={myAdvertiser}
          editingCampaign={editingCampaign}
          onComplete={() => {
            setEditingCampaign(null);
            setView('my_ads');
          }}
          onCancel={() => {
            setEditingCampaign(null);
            setView('my_ads');
          }}
        />
      )}

      {view === 'directory' && (
        <div className="space-y-8">
          {/* Active Featured Ads Directory */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Avisos patrocinados activos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayDirectoryAds.map((ad) => (
                <article
                  key={ad.id}
                  className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between"
                >
                  <div className="h-44 bg-slate-100 dark:bg-slate-800">
                    <SafeImage src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-5 space-y-2 flex-1">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Publicidad patrocinada · {ad.targetCommune}
                      {ad.isDemo ? ' · Demostración' : ''}
                    </p>
                    <h3 className="font-bold text-slate-900 dark:text-white leading-snug">{ad.title}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{ad.description}</p>
                  </div>
                  <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-500 truncate">{ad.businessName}</span>
                    <span className="font-semibold text-blue-700 dark:text-blue-400">{ad.ctaLabel}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Configurable Pricing Plans Showcase */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Tarifas y planes vigentes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(packages.length > 0 ? packages : DEFAULT_AD_PACKAGES).map((pkg) => (
                <div
                  key={pkg.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                      {pkg.billingCycle === 'monthly' ? 'Plan Mensual' : `Campaña ${pkg.durationDays} días`}
                    </p>
                    <h3 className="font-bold text-slate-900 dark:text-white">{pkg.name}</h3>
                    <p className="font-mono tabular-nums text-2xl font-extrabold text-slate-950 dark:text-white">
                      {formatCLP(pkg.priceCLP)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{pkg.description}</p>
                    <ul className="space-y-1 pt-2 text-xs text-slate-600 dark:text-slate-300">
                      {pkg.features.map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => setView('wizard')}
                    className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-blue-700 text-white text-xs font-semibold hover:bg-slate-800 min-h-[40px]"
                  >
                    Contratar plan
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === 'my_ads' && (
        <div className="space-y-6">
          {/* Verified Advertiser Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {label: 'Impresiones reales', value: totalImpressions},
              {label: 'Clics', value: totalClicks},
              {label: 'CTR (%)', value: `${ctr}%`},
              {label: 'Contactos', value: totalContacts},
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
              >
                <p className="text-xs text-slate-500">{m.label}</p>
                <p className="font-mono tabular-nums text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* Campaigns Table / List */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-700" />
                <span>Mis campañas publicitarias</span>
              </h2>
            </div>

            {myCampaigns.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-sm text-slate-500">Aún no has creado ninguna campaña publicitaria.</p>
                <button
                  type="button"
                  onClick={() => setView('wizard')}
                  className="px-5 py-2.5 rounded-xl bg-blue-700 text-white text-xs font-semibold"
                >
                  Crear mi primer anuncio
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {myCampaigns.map((camp) => (
                  <div key={camp.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-blue-700 dark:text-blue-400">
                          Moderación: {camp.moderationStatus}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Pago: {camp.paymentStatus}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">
                          {camp.startDate} → {camp.endDate}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{camp.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {camp.packageName} · {formatCLP(camp.finalAmountCLP)} · Impresiones:{' '}
                        <span className="font-mono">{camp.impressionsCount}</span> · Clics:{' '}
                        <span className="font-mono">{camp.clicksCount}</span>
                      </p>
                      {camp.moderationStatus === 'rejected' && camp.rejectionReason && (
                        <p className="text-xs text-rose-600 font-medium">
                          Motivo de rechazo: {camp.rejectionReason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(camp.moderationStatus === 'draft' || camp.moderationStatus === 'rejected') && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCampaign(camp);
                            setView('wizard');
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold min-h-[38px]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Corregir y reenviar</span>
                        </button>
                      )}
                      {(camp.moderationStatus === 'active' ||
                        (camp.moderationStatus === 'paused' && camp.paymentStatus === 'confirmed')) && (
                        <button
                          type="button"
                          onClick={() => void handleTogglePause(camp)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold min-h-[38px]"
                        >
                          {camp.moderationStatus === 'active' ? (
                            <>
                              <Pause className="w-3.5 h-3.5" />
                              <span>Pausar</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              <span>Reanudar</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Orders & Receipts */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              <span>Órdenes de pago y comprobantes</span>
            </h2>
            {myOrders.length === 0 ? (
              <p className="text-sm text-slate-500">No hay órdenes de pago registradas aún.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2.5 pr-4">Orden</th>
                      <th className="py-2.5 pr-4">Descripción</th>
                      <th className="py-2.5 pr-4">Medio</th>
                      <th className="py-2.5 pr-4">Estado</th>
                      <th className="py-2.5 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {myOrders.map((ord) => (
                      <tr key={ord.id}>
                        <td className="py-3 pr-4 font-mono">{ord.commerceOrder}</td>
                        <td className="py-3 pr-4">{ord.description}</td>
                        <td className="py-3 pr-4 uppercase font-mono">{ord.paymentMethod}</td>
                        <td className="py-3 pr-4">{ord.status}</td>
                        <td className="py-3 text-right font-mono font-bold">{formatCLP(ord.amountCLP)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
