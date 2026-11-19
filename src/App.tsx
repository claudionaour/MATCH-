/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useEffect, useMemo, useState} from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {Bell, HelpCircle, LogOut, Megaphone, Settings, ShieldCheck, User} from 'lucide-react';
import {AuthProvider, useAuth} from './contexts/AuthContext';
import {ThemeProvider} from './contexts/ThemeContext';
import {ToastProvider, useToast} from './contexts/ToastContext';
import {ErrorBoundary} from './components/ErrorBoundary';
import {OfflineIndicator} from './components/OfflineIndicator';
import {SidebarNav} from './components/SidebarNav';
import {MobileBottomNav} from './components/MobileBottomNav';
import {MatchCelebrationModal} from './components/MatchCelebrationModal';
import {Logo} from './components/Logo';
import {TopBar} from './components/TopBar';
import {PWAInstallButton} from './components/PWAInstallButton';
import {DEFAULT_REGION, DEFAULT_ROTATION_CONFIG, normalizeRegionName} from './services/config/chileCatalog';
import {db, handleFirestoreError, OperationType} from './services/firebase/firebaseClient';
import {verifyFlowPaymentOnServer} from './services/payments/paymentService';
import {
  AdOrder,
  AdRotationConfig,
  AppModule,
  AppNotification,
  AppSection,
  Conversation,
  MatchRecord,
  MicroStore,
} from './types';
import {LandingPage} from './pages/LandingPage';
import {HomeDashboard} from './pages/HomeDashboard';
import {MatchesPage} from './pages/MatchesPage';
import {ProfilePage} from './pages/ProfilePage';
import {SettingsPage} from './pages/SettingsPage';
import {HelpLegalPage} from './pages/HelpLegalPage';
import {AuthScreen} from './modules/authentication/AuthScreen';
import {OnboardingWizard} from './modules/authentication/OnboardingWizard';
import {CommercialModule} from './modules/commercial/CommercialModule';
import {EmploymentModule} from './modules/employment/EmploymentModule';
import {AdvertisingModule} from './modules/advertising/AdvertisingModule';
import {MessagingModule} from './modules/messaging/MessagingModule';
import {NotificationsModule} from './modules/notifications/NotificationsModule';
import {AdminPanel} from './modules/administration/AdminPanel';

const SECTION_TITLES: Record<AppSection, string> = {
  landing: 'Inicio',
  home: 'Inicio',
  commercial: 'MATCH COMERCIAL',
  employment: 'MATCH LABORAL',
  advertising: 'MATCH PUBLICIDAD',
  matches: 'Mis coincidencias',
  messages: 'Mensajes',
  notifications: 'Notificaciones',
  profile: 'Mi perfil',
  settings: 'Configuración',
  help: 'Ayuda y Normativa',
  admin: 'Panel Administrativo',
};

const AppShell: React.FC = () => {
  const {firebaseUser, userAccount, authReady, isAdmin, needsEmailVerification, logout} = useAuth();
  const {showToast} = useToast();

  const [showAuth, setShowAuth] = useState(false);
  const [publicHelp, setPublicHelp] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSection>('home');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [rotationConfig, setRotationConfig] = useState<AdRotationConfig>(DEFAULT_ROTATION_CONFIG);

  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [celebrationMatch, setCelebrationMatch] = useState<MatchRecord | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [moduleSubView, setModuleSubView] = useState<string | undefined>(undefined);
  const [pendingFlowToken, setPendingFlowToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const flowReturn = params.get('flowReturn');
    const token = params.get('token');
    if (flowReturn === '1' && token) {
      return token;
    }
    return null;
  });

  const handleSectionSelect = (section: AppSection, subView?: string) => {
    setModuleSubView(subView);
    setActiveSection(section);
  };

  // Load global rotation config
  useEffect(() => {
    getDoc(doc(db, 'systemSettings', 'global'))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<AdRotationConfig>;
          setRotationConfig({...DEFAULT_ROTATION_CONFIG, ...data});
        }
      })
      .catch(() => {
        // Use default catalog config if systemSettings/global not yet seeded
      });
  }, []);

  // Verify Flow payment return params once user session is available
  useEffect(() => {
    if (!pendingFlowToken || !firebaseUser) return;
    const token = pendingFlowToken;
    setPendingFlowToken(null);
    window.history.replaceState({}, document.title, window.location.pathname);

    (async () => {
      try {
        const res = await verifyFlowPaymentOnServer(token);
        if (res.verified && res.result?.status === 2) {
          const commerceOrder = res.result.commerceOrder;
          const ordersSnap = await getDocs(
            query(
              collection(db, 'adOrders'),
              where('ownerId', '==', firebaseUser.uid),
              where('commerceOrder', '==', commerceOrder)
            )
          );

          if (!ordersSnap.empty) {
            const orderDoc = ordersSnap.docs[0];
            const orderData = orderDoc.data() as Omit<AdOrder, 'id'>;
            if (orderData.status !== 'confirmed') {
              await updateDoc(doc(db, 'adOrders', orderDoc.id), {
                status: 'confirmed',
                flowToken: token,
                flowOrder: res.result.flowOrder || 0,
                receiptNote: 'Pago Flow confirmado',
                updatedAt: serverTimestamp(),
              });
            }

            if (orderData.orderType === 'microstore_quota') {
              const storeId = `store_${firebaseUser.uid}`;
              const storeRef = doc(db, 'microStores', storeId);
              let storeSnap = await getDoc(storeRef);
              if (!storeSnap.exists()) {
                await setDoc(storeRef, {
                  ownerId: firebaseUser.uid,
                  storeName: `Microtienda ${userAccount?.displayName || 'Local'}`,
                  description: 'Microtienda local en MATCH+',
                  category: 'Alimentos y Productos Locales',
                  commune: userAccount?.commune || 'Castro',
                  region: normalizeRegionName(userAccount?.region) || DEFAULT_REGION,
                  deliveryOptions: ['Retiro en tienda', 'Despacho local'],
                  acceptedPaymentMethods: ['Transferencia bancaria', 'Efectivo al entregar'],
                  freeLimit: 3,
                  extraQuota: 0,
                  maxProductsLimit: 3,
                  planPacksCount: 0,
                  lastFlowToken: '',
                  status: 'active',
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                storeSnap = await getDoc(storeRef);
              }

              const storeData = storeSnap.data() as Omit<MicroStore, 'id'> | undefined;
              if (storeData && storeData.lastFlowToken !== token) {
                const nextExtra = (storeData.extraQuota || 0) + 5;
                await updateDoc(storeRef, {
                  extraQuota: nextExtra,
                  maxProductsLimit: 3 + nextExtra,
                  planPacksCount: (storeData.planPacksCount || 0) + 1,
                  lastFlowToken: token,
                  updatedAt: serverTimestamp(),
                });
              }

              showToast(
                'Pago Flow confirmado. Se agregaron +5 productos automáticamente a tu Microtienda.',
                'success'
              );
              handleSectionSelect('commercial', 'my_store');
              return;
            }

            if (orderData.campaignId) {
              await updateDoc(doc(db, 'adCampaigns', orderData.campaignId), {
                paymentStatus: 'confirmed',
                moderationStatus: 'active',
                updatedAt: serverTimestamp(),
              });
              showToast(`Pago Flow verificado (${commerceOrder}) y campaña activada.`, 'success');
              handleSectionSelect('advertising', 'my_ads');
              return;
            }
          }

          showToast(`Pago Flow verificado (${commerceOrder}).`, 'success');
        } else {
          showToast('Retorno de Flow recibido. Revisa el estado de tu orden.', 'info');
        }
      } catch {
        showToast('No fue posible verificar el retorno de Flow en este momento.', 'error');
      }
    })();
  }, [pendingFlowToken, firebaseUser, userAccount, showToast]);

  // First-time onboarding prompt per user
  useEffect(() => {
    if (!firebaseUser || !userAccount) {
      setShowOnboarding(false);
      return;
    }
    const key = `matchplus_onboarded_${firebaseUser.uid}`;
    if (!localStorage.getItem(key)) {
      setShowOnboarding(true);
    }
  }, [firebaseUser, userAccount]);

  // Live listeners for matches, conversations, notifications
  useEffect(() => {
    if (!firebaseUser || !userAccount) {
      setMatches([]);
      setConversations([]);
      setNotifications([]);
      return;
    }

    const unsubMatches = onSnapshot(
      query(collection(db, 'matches'), where('participantIds', 'array-contains', firebaseUser.uid)),
      (snap) => setMatches(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<MatchRecord, 'id'>)}))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'matches')
    );

    const unsubConvs = onSnapshot(
      query(collection(db, 'conversations'), where('participantIds', 'array-contains', firebaseUser.uid)),
      (snap) => setConversations(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Conversation, 'id'>)}))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'conversations')
    );

    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', firebaseUser.uid)),
      (snap) => setNotifications(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<AppNotification, 'id'>)}))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    return () => {
      unsubMatches();
      unsubConvs();
      unsubNotifs();
    };
  }, [firebaseUser, userAccount]);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const activeMatchesCount = useMemo(
    () => matches.filter((m) => m.status === 'active').length,
    [matches]
  );

  const openChatForMatch = (match: MatchRecord) => {
    const conv = conversations.find((c) => c.matchId === match.id);
    if (conv) {
      setSelectedConversationId(conv.id);
    }
    setCelebrationMatch(null);
    setActiveSection('messages');
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="space-y-3 text-center">
          <Logo size="lg" />
          <p className="text-xs font-medium text-slate-500">Cargando MATCH+...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated or pending email verification views
  if (!firebaseUser || !userAccount || needsEmailVerification) {
    if (showAuth || needsEmailVerification) {
      return <AuthScreen onBack={() => setShowAuth(false)} />;
    }

    if (publicHelp) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
          <TopBar
            onNavigate={(sec) => {
              if (sec === 'landing') setPublicHelp(false);
              else if (sec === 'help') setPublicHelp(true);
              else setShowAuth(true);
            }}
            primaryActionLabel="Ingresar"
            onPrimaryAction={() => setShowAuth(true)}
          />
          <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
            <HelpLegalPage />
          </main>
        </div>
      );
    }

    return (
      <LandingPage
        onStartAuth={() => setShowAuth(true)}
        onNavigate={(sec) => {
          if (sec === 'help') setPublicHelp(true);
          else setShowAuth(true);
        }}
      />
    );
  }

  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={(initialMod?: AppModule) => {
          localStorage.setItem(`matchplus_onboarded_${firebaseUser.uid}`, '1');
          setShowOnboarding(false);
          if (initialMod) setActiveSection(initialMod);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <SidebarNav
        activeSection={activeSection}
        onSelect={(sec) => handleSectionSelect(sec)}
        isAdmin={isAdmin}
        unreadNotifications={unreadNotifications}
        matchesCount={activeMatchesCount}
        userName={userAccount.displayName}
        onLogout={() => void logout()}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact Mobile Top Header */}
        <header className="lg:hidden sticky top-0 z-30 h-14 px-3 sm:px-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <button type="button" onClick={() => setActiveSection('home')} className="shrink-0">
            <Logo size="sm" />
          </button>

          <div className="flex items-center gap-1 min-w-0">
            <div className="flex items-center gap-0.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveSection('advertising')}
                aria-label="Publicidad"
                className="p-1.5 sm:p-2 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] min-w-[34px] sm:min-w-[40px] flex items-center justify-center shrink-0"
              >
                <Megaphone className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('notifications')}
                aria-label="Notificaciones"
                className="relative p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] min-w-[34px] sm:min-w-[40px] flex items-center justify-center shrink-0"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1.5 right-1.5 text-[10px] font-bold text-blue-700 dark:text-blue-400">
                    {unreadNotifications}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('profile')}
                aria-label="Mi perfil"
                className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] min-w-[34px] sm:min-w-[40px] flex items-center justify-center shrink-0"
              >
                <User className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('settings')}
                aria-label="Configuración"
                className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] min-w-[34px] sm:min-w-[40px] flex items-center justify-center shrink-0"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('help')}
                aria-label="Ayuda y Normativa"
                className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] min-w-[34px] sm:min-w-[40px] flex items-center justify-center shrink-0"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveSection('admin')}
                  aria-label="Panel Administrativo"
                  className="p-1.5 sm:p-2 rounded-xl text-blue-700 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] min-w-[34px] sm:min-w-[40px] flex items-center justify-center shrink-0"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => void logout()}
                aria-label="Cerrar sesión"
                className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-rose-600 min-h-[40px] min-w-[34px] sm:min-w-[40px] flex items-center justify-center shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            <PWAInstallButton compact responsiveLabel />
          </div>
        </header>

        {/* Desktop Top Header */}
        <header className="hidden lg:flex sticky top-0 z-30 h-16 px-8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {SECTION_TITLES[activeSection]}
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {userAccount.commune || 'Castro'}, {userAccount.region || 'Región de Los Lagos'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton compact />
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10">
          {activeSection === 'home' && (
            <HomeDashboard
              onNavigate={handleSectionSelect}
              matchesCount={activeMatchesCount}
              unreadNotifications={unreadNotifications}
              conversationsCount={conversations.length}
            />
          )}

          {activeSection === 'commercial' && (
            <CommercialModule
              rotationConfig={rotationConfig}
              initialTab={
                moduleSubView === 'my_publications' ||
                moduleSubView === 'microstores' ||
                moduleSubView === 'my_store'
                  ? moduleSubView
                  : undefined
              }
              onMatchCreated={(m) => setCelebrationMatch(m)}
              onOpenChat={(convId) => {
                setSelectedConversationId(convId);
                setActiveSection('messages');
              }}
            />
          )}

          {activeSection === 'employment' && (
            <EmploymentModule
              rotationConfig={rotationConfig}
              initialTab={moduleSubView === 'my_publications' ? 'my_publications' : undefined}
              onMatchCreated={(m) => setCelebrationMatch(m)}
            />
          )}

          {activeSection === 'advertising' && (
            <AdvertisingModule
              discountPercent={rotationConfig.registeredAdvertiserDiscountPercent}
              initialView={moduleSubView === 'my_ads' ? 'my_ads' : undefined}
            />
          )}

          {activeSection === 'matches' && (
            <MatchesPage matches={matches} onOpenMatchChat={openChatForMatch} />
          )}

          {activeSection === 'messages' && (
            <MessagingModule initialConversationId={selectedConversationId} />
          )}

          {activeSection === 'notifications' && (
            <NotificationsModule onNavigate={setActiveSection} />
          )}

          {activeSection === 'profile' && <ProfilePage onNavigate={setActiveSection} />}

          {activeSection === 'settings' && <SettingsPage />}

          {activeSection === 'help' && <HelpLegalPage />}

          {activeSection === 'admin' && (
            <AdminPanel
              rotationConfig={rotationConfig}
              onRotationUpdated={setRotationConfig}
            />
          )}
        </main>
      </div>

      <MobileBottomNav activeSection={activeSection} onSelect={(sec) => handleSectionSelect(sec)} />

      <MatchCelebrationModal
        match={celebrationMatch}
        onClose={() => setCelebrationMatch(null)}
        onOpenChat={openChatForMatch}
      />

      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
