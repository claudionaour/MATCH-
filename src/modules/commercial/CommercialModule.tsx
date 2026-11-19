import React, {useEffect, useMemo, useState} from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Building2,
  CheckCircle2,
  Eye,
  FileText,
  Filter,
  Flag,
  HeartHandshake,
  LayoutGrid,
  Layers,
  List,
  Package,
  Pause,
  Play,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import {useAuth} from '../../contexts/AuthContext';
import {useToast} from '../../contexts/ToastContext';
import {db, handleFirestoreError, OperationType} from '../../services/firebase/firebaseClient';
import {
  COMMERCIAL_CATEGORIES,
  DEFAULT_REGION,
  DEMO_ADS,
  DEMO_PRODUCTS,
  DEMO_PURCHASE_REQUESTS,
  formatCLP,
  getRegionEntry,
  normalizeRegionName,
} from '../../services/config/chileCatalog';
import {computeCommercialMatchScore} from '../../services/matching/matchingEngine';
import {scoreAndRankAds, shouldShowAdAtOrganicIndex} from '../../services/advertising/adRotationEngine';
import {
  AdCampaign,
  AdRotationConfig,
  BusinessProfile,
  CommercialProduct,
  MatchRecord,
  MicroStore,
  PurchaseRequest,
} from '../../types';
import {SwipeCardDeck, SwipeDeckItem} from '../../components/SwipeCardDeck';
import {AdBannerCard} from '../../components/AdBannerCard';
import {SafeImage} from '../../components/SafeImage';
import {MicroStoreSection} from './MicroStoreSection';
import {sortByCreatedDesc} from '../../utils/sortNewest';

interface CommercialModuleProps {
  onMatchCreated: (match: MatchRecord) => void;
  onOpenChat: (conversationId: string) => void;
  rotationConfig: AdRotationConfig;
  initialTab?: 'explore_offers' | 'my_publications' | 'microstores' | 'my_store';
}

interface RawInteraction {
  id: string;
  fromUid: string;
  toUid: string;
  targetId: string;
  targetKind: 'product' | 'purchaseRequest';
  action: 'like' | 'pass' | 'favorite';
}

export const CommercialModule: React.FC<CommercialModuleProps> = ({
  onMatchCreated,
  rotationConfig,
  initialTab,
}) => {
  const {firebaseUser, userAccount} = useAuth();
  const {showToast} = useToast();

  const [tab, setTab] = useState<
    | 'explore_offers'
    | 'explore_needs'
    | 'publish_offer'
    | 'publish_need'
    | 'my_publications'
    | 'seller_profile'
    | 'incoming_interest'
    | 'microstores'
    | 'my_store'
  >(initialTab || 'explore_offers');
  const [viewMode, setViewMode] = useState<'tinder' | 'results' | 'categories'>('tinder');
  const [includeDemo, setIncludeDemo] = useState(true);
  const [microStoreSubMode, setMicroStoreSubMode] = useState<'directory' | 'my_store' | 'my_orders'>(
    initialTab === 'my_store' ? 'my_store' : 'directory'
  );
  const [selectedStoreSellerId, setSelectedStoreSellerId] = useState<string | null>(null);
  const [upgradeTrigger, setUpgradeTrigger] = useState(0);

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
      if (initialTab === 'my_store') {
        setMicroStoreSubMode('my_store');
      } else if (initialTab === 'microstores') {
        setMicroStoreSubMode('directory');
      }
    }
  }, [initialTab]);

  // Live Firestore states
  const [products, setProducts] = useState<CommercialProduct[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [myProducts, setMyProducts] = useState<CommercialProduct[]>([]);
  const [myRequests, setMyRequests] = useState<PurchaseRequest[]>([]);
  const [microStores, setMicroStores] = useState<MicroStore[]>([]);
  const [myStore, setMyStore] = useState<MicroStore | null>(null);
  const [myInteractions, setMyInteractions] = useState<RawInteraction[]>([]);
  const [receivedInteractions, setReceivedInteractions] = useState<RawInteraction[]>([]);
  const [activeAds, setActiveAds] = useState<AdCampaign[]>([]);
  const [myBusiness, setMyBusiness] = useState<BusinessProfile | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [filterCommune, setFilterCommune] = useState('Todas');
  const [filterType, setFilterType] = useState<'all' | 'product' | 'service'>('all');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterAvailOnly, setFilterAvailOnly] = useState(false);

  // Detail & Report modal
  const [detailItem, setDetailItem] = useState<CommercialProduct | PurchaseRequest | null>(null);
  const [reportTarget, setReportTarget] = useState<{id: string; type: 'product' | 'ad'; title: string} | null>(null);
  const [reportReason, setReportReason] = useState('Información engañosa');
  const [reportDetails, setReportDetails] = useState('');

  // Ad session state
  const [sessionId] = useState(() => `sess_com_${Date.now()}`);
  const [viewedOrganicCount, setViewedOrganicCount] = useState(0);
  const [postsSinceLastAd, setPostsSinceLastAd] = useState(0);
  const [adsShownInSession, setAdsShownInSession] = useState(0);
  const [sessionAdvertiserCounts, setSessionAdvertiserCounts] = useState<Record<string, number>>({});
  const [hiddenAdIds, setHiddenAdIds] = useState<string[]>([]);
  const [currentAdToShow, setCurrentAdToShow] = useState<AdCampaign | null>(null);

  // Forms: Product/Service
  const [itemType, setItemType] = useState<'product' | 'service'>('product');
  const [prodTitle, setProdTitle] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodCategory, setProdCategory] = useState(COMMERCIAL_CATEGORIES[0]);
  const [prodPrice, setProdPrice] = useState('');
  const [prodCommune, setProdCommune] = useState(userAccount?.commune || 'Castro');
  const [prodRegion, setProdRegion] = useState(normalizeRegionName(userAccount?.region));
  const [prodImageUrl, setProdImageUrl] = useState('/src/assets/images/commercial_garlic_chilote_1795023911044.jpg');
  const [prodAvail, setProdAvail] = useState<'available' | 'limited' | 'unavailable'>('available');
  const [prodDelivery, setProdDelivery] = useState('Retiro en local, Despacho comunal');

  // Forms: Purchase Request
  const [reqTitle, setReqTitle] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqCategory, setReqCategory] = useState(COMMERCIAL_CATEGORIES[9]);
  const [reqMinBudget, setReqMinBudget] = useState('');
  const [reqMaxBudget, setReqMaxBudget] = useState('');
  const [reqCommune, setReqCommune] = useState(userAccount?.commune || 'Castro');
  const [reqUrgency, setReqUrgency] = useState<'inmediata' | 'esta_semana' | 'este_mes'>('esta_semana');

  // Forms: Business Profile
  const [bizName, setBizName] = useState('');
  const [bizCommName, setBizCommName] = useState('');
  const [bizDesc, setBizDesc] = useState('');
  const [bizCategory, setBizCategory] = useState(COMMERCIAL_CATEGORIES[0]);
  const [bizCommune, setBizCommune] = useState(userAccount?.commune || 'Castro');
  const [bizContact, setBizContact] = useState('');
  const [bizHours, setBizHours] = useState('Lun a Sáb 09:00 - 19:00');
  const [bizTerms, setBizTerms] = useState('Pago transferencia o efectivo al entregar');

  useEffect(() => {
    const unsubProd = onSnapshot(
      query(collection(db, 'products'), where('status', '==', 'active')),
      (snap) => {
        setProducts(
          sortByCreatedDesc(
            snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<CommercialProduct, 'id'>)}))
          )
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'products')
    );

    const unsubReq = onSnapshot(
      query(collection(db, 'purchaseRequests'), where('status', '==', 'open')),
      (snap) => {
        setRequests(
          sortByCreatedDesc(
            snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<PurchaseRequest, 'id'>)}))
          )
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'purchaseRequests')
    );

    const unsubStores = onSnapshot(
      query(collection(db, 'microStores'), where('status', '==', 'active')),
      (snap) => {
        setMicroStores(
          sortByCreatedDesc(
            snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<MicroStore, 'id'>)}))
          )
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'microStores')
    );

    const unsubAds = onSnapshot(
      query(collection(db, 'adCampaigns'), where('moderationStatus', '==', 'active')),
      (snap) => {
        setActiveAds(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<AdCampaign, 'id'>)})));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'adCampaigns')
    );

    return () => {
      unsubProd();
      unsubReq();
      unsubStores();
      unsubAds();
    };
  }, []);

  useEffect(() => {
    if (!firebaseUser) {
      setMyStore(null);
      return;
    }
    const unsubOut = onSnapshot(
      query(collection(db, 'commercialInteractions'), where('fromUid', '==', firebaseUser.uid)),
      (snap) => {
        setMyInteractions(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<RawInteraction, 'id'>)})));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'commercialInteractions')
    );

    const unsubIn = onSnapshot(
      query(collection(db, 'commercialInteractions'), where('toUid', '==', firebaseUser.uid)),
      (snap) => {
        setReceivedInteractions(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<RawInteraction, 'id'>)})));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'commercialInteractions')
    );

    const unsubBiz = onSnapshot(
      query(collection(db, 'businessProfiles'), where('ownerId', '==', firebaseUser.uid)),
      (snap) => {
        if (!snap.empty) {
          const doc0 = snap.docs[0];
          const data = doc0.data() as Omit<BusinessProfile, 'id'>;
          setMyBusiness({id: doc0.id, ...data});
          setBizName(data.businessName);
          setBizCommName(data.commercialName);
          setBizDesc(data.description);
          setBizCategory(data.category);
          setBizCommune(data.commune);
          setBizContact(data.contactInfo);
          setBizHours(data.hours);
          setBizTerms(data.salesTerms);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'businessProfiles')
    );

    const unsubMyProds = onSnapshot(
      query(collection(db, 'products'), where('ownerId', '==', firebaseUser.uid)),
      (snap) => {
        setMyProducts(
          sortByCreatedDesc(
            snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<CommercialProduct, 'id'>)}))
          )
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'products')
    );

    const unsubMyReqs = onSnapshot(
      query(collection(db, 'purchaseRequests'), where('ownerId', '==', firebaseUser.uid)),
      (snap) => {
        setMyRequests(
          sortByCreatedDesc(
            snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<PurchaseRequest, 'id'>)}))
          )
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'purchaseRequests')
    );

    const storeRef = doc(db, 'microStores', `store_${firebaseUser.uid}`);
    const unsubMyStore = onSnapshot(
      storeRef,
      (snap) => {
        if (snap.exists()) {
          setMyStore({id: snap.id, ...(snap.data() as Omit<MicroStore, 'id'>)});
        } else {
          setMyStore(null);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `microStores/store_${firebaseUser.uid}`)
    );

    return () => {
      unsubOut();
      unsubIn();
      unsubBiz();
      unsubMyProds();
      unsubMyReqs();
      unsubMyStore();
    };
  }, [firebaseUser]);

  const allProducts = useMemo(() => {
    return includeDemo ? [...products, ...DEMO_PRODUCTS] : products;
  }, [products, includeDemo]);

  const allRequests = useMemo(() => {
    return includeDemo ? [...requests, ...DEMO_PURCHASE_REQUESTS] : requests;
  }, [requests, includeDemo]);

  const allAds = useMemo(() => {
    return includeDemo ? [...activeAds, ...DEMO_ADS] : activeAds;
  }, [activeAds, includeDemo]);

  const interactedTargetIds = useMemo(() => {
    return new Set(myInteractions.filter((i) => i.action !== 'favorite').map((i) => i.targetId));
  }, [myInteractions]);

  const filteredProducts = useMemo(() => {
    return allProducts.filter((p) => {
      if (filterCategory !== 'Todas' && p.category !== filterCategory) return false;
      if (filterCommune !== 'Todas' && p.commune !== filterCommune) return false;
      if (filterType !== 'all' && p.itemType !== filterType) return false;
      if (filterAvailOnly && p.availability !== 'available') return false;
      if (filterMaxPrice && p.priceCLP > Number(filterMaxPrice)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !p.title.toLowerCase().includes(q) &&
          !p.description.toLowerCase().includes(q) &&
          !p.sellerName.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [allProducts, filterCategory, filterCommune, filterType, filterAvailOnly, filterMaxPrice, searchQuery]);

  const filteredRequests = useMemo(() => {
    return allRequests.filter((r) => {
      if (filterCategory !== 'Todas' && r.category !== filterCategory) return false;
      if (filterCommune !== 'Todas' && r.commune !== filterCommune) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!r.title.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allRequests, filterCategory, filterCommune, searchQuery]);

  const freeLimit = myStore?.freeLimit ?? 3;
  const extraQuota = myStore?.extraQuota ?? 0;
  const maxProductsLimit = freeLimit + extraQuota;
  const isAtProductQuota = myProducts.length >= maxProductsLimit;

  const deckItems: SwipeDeckItem[] = useMemo(() => {
    if (tab === 'explore_needs') {
      return filteredRequests
        .filter((r) => !interactedTargetIds.has(r.id))
        .map((r) => ({
          id: r.id,
          title: r.title,
          subtitle: `Solicitud de compra · ${r.buyerName}${r.ownerId === firebaseUser?.uid ? ' · Tu publicación' : ''}`,
          priceOrScoreLabel: `${formatCLP(r.minBudgetCLP)} - ${formatCLP(r.maxBudgetCLP)}`,
          description: r.description,
          locationLabel: `${r.commune}, ${r.region}`,
          metaLine: `${r.category} · Urgencia: ${r.urgency.replace('_', ' ')}`,
          verified: false,
          isDemo: r.isDemo,
        }));
    }
    return filteredProducts
      .filter((p) => !interactedTargetIds.has(p.id))
      .map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: `${p.itemType === 'service' ? 'Servicio' : 'Producto'} · ${p.sellerName}${p.ownerId === firebaseUser?.uid ? ' · Tu publicación' : ''}`,
        priceOrScoreLabel: formatCLP(p.priceCLP),
        description: p.description,
        locationLabel: `${p.commune}${p.distanceKm ? ` (~${p.distanceKm} km)` : ''}`,
        metaLine: `${p.category} · ${p.availability === 'available' ? 'Disponible' : 'Stock limitado'}`,
        imageUrl: p.imageUrl,
        verified: p.verified,
        isDemo: p.isDemo,
      }));
  }, [tab, filteredProducts, filteredRequests, interactedTargetIds, firebaseUser?.uid]);

  const advanceRotationCheck = () => {
    const nextViewed = viewedOrganicCount + 1;
    const nextSinceAd = postsSinceLastAd + 1;
    setViewedOrganicCount(nextViewed);

    if (shouldShowAdAtOrganicIndex(nextViewed, adsShownInSession, nextSinceAd, rotationConfig)) {
      const ranked = scoreAndRankAds(
        allAds,
        {
          section: 'commercial',
          activeCategory: filterCategory !== 'Todas' ? filterCategory : undefined,
          userCommune: userAccount?.commune,
          userRegion: userAccount?.region,
          hiddenAdIds,
        },
        sessionAdvertiserCounts,
        rotationConfig
      );
      if (ranked.length > 0) {
        const chosen = ranked[0].campaign;
        setCurrentAdToShow(chosen);
        setAdsShownInSession((c) => c + 1);
        setPostsSinceLastAd(0);
        setSessionAdvertiserCounts((prev) => ({
          ...prev,
          [chosen.advertiserId]: (prev[chosen.advertiserId] || 0) + 1,
        }));
        return;
      }
    }
    setPostsSinceLastAd(nextSinceAd);
  };

  const createRealMatch = async (
    recipientUid: string,
    recipientName: string,
    targetId: string,
    targetTitle: string,
    explanation?: string
  ) => {
    if (!firebaseUser) return;
    const pair = [firebaseUser.uid, recipientUid].sort();
    const matchId = `m_com_${pair[0]}_${pair[1]}_${targetId}`.slice(0, 120);
    const convId = `c_${matchId}`;

    const matchPayload: Omit<MatchRecord, 'id'> = {
      module: 'commercial',
      participantIds: pair,
      initiatorUid: firebaseUser.uid,
      recipientUid,
      initiatorName: userAccount?.displayName || firebaseUser.displayName || 'Usuario',
      recipientName,
      targetId,
      targetTitle,
      ...(explanation ? {compatibilityExplanation: explanation} : {}),
      status: 'active',
    };

    try {
      await setDoc(doc(db, 'matches', matchId), {
        ...matchPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'conversations', convId), {
        matchId,
        module: 'commercial',
        participantIds: pair,
        participantNames: {
          [firebaseUser.uid]: userAccount?.displayName || firebaseUser.displayName || 'Usuario',
          [recipientUid]: recipientName,
        },
        targetTitle,
        lastMessage: 'Coincidencia comercial confirmada. Pueden iniciar conversación.',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'notifications'), {
        userId: recipientUid,
        type: 'new_match',
        title: 'Nuevo MATCH Comercial',
        body: `Tienes una coincidencia mutua en "${targetTitle}".`,
        module: 'commercial',
        relatedId: matchId,
        read: false,
        createdAt: serverTimestamp(),
      });
      onMatchCreated({id: matchId, ...matchPayload});
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `matches/${matchId}`);
    }
  };

  const handleInteraction = async (item: SwipeDeckItem, action: 'like' | 'pass' | 'favorite') => {
    advanceRotationCheck();

    if (!firebaseUser) {
      showToast('Inicia sesión para guardar interacciones y generar coincidencias reales.', 'info');
      return;
    }

    const isNeed = tab === 'explore_needs';
    const rawTarget = isNeed
      ? allRequests.find((r) => r.id === item.id)
      : allProducts.find((p) => p.id === item.id);
    if (!rawTarget) return;

    if (rawTarget.ownerId === firebaseUser.uid) {
      if (action === 'pass') {
        setMyInteractions((prev) => [
          ...prev,
          {
            id: `local_own_${item.id}`,
            fromUid: firebaseUser.uid,
            toUid: rawTarget.ownerId,
            targetId: item.id,
            targetKind: isNeed ? 'purchaseRequest' : 'product',
            action,
          },
        ]);
        return;
      }
      showToast(
        'Esta es tu propia publicación. Ya está activa y visible para todos los usuarios y en tu Microtienda.',
        'info'
      );
      return;
    }

    if (item.isDemo) {
      if (action === 'like') {
        showToast(
          'Elemento de demostración: las coincidencias reales solo se generan entre usuarios registrados en vivo.',
          'info'
        );
      }
      setMyInteractions((prev) => [
        ...prev,
        {
          id: `local_${item.id}`,
          fromUid: firebaseUser.uid,
          toUid: rawTarget.ownerId,
          targetId: item.id,
          targetKind: isNeed ? 'purchaseRequest' : 'product',
          action,
        },
      ]);
      return;
    }

    const interactionId = `ci_${firebaseUser.uid}_${item.id}_${action}`.slice(0, 120);
    try {
      if (!myInteractions.some((i) => i.id === interactionId)) {
        await setDoc(doc(db, 'commercialInteractions', interactionId), {
          fromUid: firebaseUser.uid,
          toUid: rawTarget.ownerId,
          targetId: item.id,
          targetKind: isNeed ? 'purchaseRequest' : 'product',
          action,
          createdAt: serverTimestamp(),
        });
      }

      if (action === 'favorite') {
        showToast('Guardado en favoritos.', 'success');
        return;
      }

      if (action === 'like') {
        await addDoc(collection(db, 'notifications'), {
          userId: rawTarget.ownerId,
          type: 'new_interest',
          title: 'Nuevo interés comercial',
          body: `${userAccount?.displayName || 'Un usuario'} mostró interés en "${item.title}".`,
          module: 'commercial',
          relatedId: item.id,
          read: false,
          createdAt: serverTimestamp(),
        });

        // Check if counterpart already liked one of our items or liked us back
        const reciprocal = receivedInteractions.find(
          (ri) => ri.fromUid === rawTarget.ownerId && ri.action === 'like'
        );
        if (reciprocal) {
          const counterpartName =
            'sellerName' in rawTarget ? rawTarget.sellerName : rawTarget.buyerName;
          await createRealMatch(rawTarget.ownerId, counterpartName, item.id, item.title);
        } else {
          showToast('Interés registrado. Si la contraparte coincide contigo, se abrirá el chat.', 'success');
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `commercialInteractions/${interactionId}`);
    }
  };

  const handleConfirmReceivedInterest = async (interaction: RawInteraction) => {
    if (!firebaseUser) return;
    const item =
      products.find((p) => p.id === interaction.targetId) ||
      requests.find((r) => r.id === interaction.targetId);
    const title = item?.title || 'Publicación comercial';
    await createRealMatch(interaction.fromUid, 'Usuario interesado', interaction.targetId, title);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      showToast('Debes iniciar sesión para publicar.', 'error');
      return;
    }
    if (myProducts.length >= maxProductsLimit) {
      showToast(
        `Tu Microtienda alcanzó su capacidad de ${maxProductsLimit} productos (${myProducts.length}/${maxProductsLimit}). Amplía +5 productos por $9.990/mes.`,
        'error'
      );
      setTab('my_store');
      setMicroStoreSubMode('my_store');
      setUpgradeTrigger((n) => n + 1);
      return;
    }
    try {
      if (!myStore) {
        const storeId = `store_${firebaseUser.uid}`;
        await setDoc(doc(db, 'microStores', storeId), {
          ownerId: firebaseUser.uid,
          storeName: myBusiness?.commercialName || `Microtienda ${userAccount?.displayName || 'Local'}`,
          description:
            myBusiness?.description ||
            `Catálogo de productos y servicios en ${prodCommune}, ${prodRegion}.`,
          category: prodCategory,
          commune: prodCommune,
          region: prodRegion,
          deliveryOptions: prodDelivery
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 6),
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
      }

      await addDoc(collection(db, 'products'), {
        ownerId: firebaseUser.uid,
        businessId: myBusiness?.id || '',
        itemType,
        title: prodTitle.trim(),
        description: prodDesc.trim(),
        category: prodCategory,
        priceCLP: Number(prodPrice) || 0,
        sellerName: myStore?.storeName || myBusiness?.commercialName || userAccount?.displayName || 'Vendedor local',
        commune: prodCommune,
        region: prodRegion,
        imageUrl: prodImageUrl.trim(),
        availability: prodAvail,
        deliveryMethods: prodDelivery.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6),
        verified: false,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Publicación creada, activa y visible en el catálogo y en tu Microtienda.', 'success');
      setProdTitle('');
      setProdDesc('');
      setProdPrice('');
      setTab('explore_offers');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'products');
    }
  };

  const handleCreatePurchaseRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      showToast('Debes iniciar sesión para publicar una solicitud de compra.', 'error');
      return;
    }
    const minB = Number(reqMinBudget) || 0;
    const maxB = Math.max(minB, Number(reqMaxBudget) || minB);
    try {
      await addDoc(collection(db, 'purchaseRequests'), {
        ownerId: firebaseUser.uid,
        buyerName: userAccount?.displayName || 'Comprador',
        title: reqTitle.trim(),
        description: reqDesc.trim(),
        category: reqCategory,
        minBudgetCLP: minB,
        maxBudgetCLP: maxB,
        commune: reqCommune,
        region: normalizeRegionName(userAccount?.region),
        urgency: reqUrgency,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Solicitud de compra publicada. Los vendedores compatibles ya pueden verla.', 'success');
      setReqTitle('');
      setReqDesc('');
      setTab('explore_needs');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'purchaseRequests');
    }
  };

  const handleSaveBusinessProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const docId = myBusiness?.id || `biz_${firebaseUser.uid}`;
    try {
      if (myBusiness) {
        await setDoc(
          doc(db, 'businessProfiles', docId),
          {
            businessName: bizName.trim(),
            commercialName: bizCommName.trim() || bizName.trim(),
            description: bizDesc.trim(),
            category: bizCategory,
            commune: bizCommune,
            region: normalizeRegionName(userAccount?.region),
            contactInfo: bizContact.trim(),
            hours: bizHours.trim(),
            salesTerms: bizTerms.trim(),
            updatedAt: serverTimestamp(),
          },
          {merge: true}
        );
      } else {
        await setDoc(doc(db, 'businessProfiles', docId), {
          ownerId: firebaseUser.uid,
          businessName: bizName.trim(),
          commercialName: bizCommName.trim() || bizName.trim(),
          description: bizDesc.trim(),
          category: bizCategory,
          commune: bizCommune,
          region: normalizeRegionName(userAccount?.region) || DEFAULT_REGION,
          contactInfo: bizContact.trim(),
          hours: bizHours.trim(),
          salesTerms: bizTerms.trim(),
          deliveryMethods: ['Retiro en local', 'Despacho local'],
          availability: 'available',
          verified: false,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      showToast('Perfil de vendedor guardado correctamente.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `businessProfiles/${docId}`);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !reportTarget) return;
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: firebaseUser.uid,
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        module: reportTarget.type === 'ad' ? 'advertising' : 'commercial',
        reason: reportReason,
        details: reportDetails.trim() || 'Reporte desde MATCH COMERCIAL',
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Denuncia enviada al equipo de moderación.', 'success');
      setReportTarget(null);
      setReportDetails('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reports');
    }
  };

  // Compatible requests for seller's own products
  const compatibleSuggestions = useMemo(() => {
    const myProds = products.filter((p) => p.ownerId === firebaseUser?.uid);
    if (myProds.length === 0) return [];
    const results: {product: CommercialProduct; request: PurchaseRequest; score: number; explanation: string}[] = [];
    for (const p of myProds) {
      for (const r of allRequests) {
        if (r.ownerId === firebaseUser?.uid) continue;
        const match = computeCommercialMatchScore(p, r);
        if (match.score >= 45) {
          results.push({product: p, request: r, ...match});
        }
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [products, allRequests, firebaseUser?.uid]);

  const handleToggleProductStatus = async (prod: CommercialProduct) => {
    const nextStatus = prod.status === 'active' ? 'paused' : 'active';
    try {
      await updateDoc(doc(db, 'products', prod.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(nextStatus === 'paused' ? 'Publicación pausada.' : 'Publicación reactivada.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${prod.id}`);
    }
  };

  const handleDeleteProduct = async (prodId: string) => {
    try {
      await deleteDoc(doc(db, 'products', prodId));
      showToast('Producto o servicio eliminado.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${prodId}`);
    }
  };

  const handleToggleRequestStatus = async (reqItem: PurchaseRequest) => {
    const nextStatus = reqItem.status === 'open' ? 'closed' : 'open';
    try {
      await updateDoc(doc(db, 'purchaseRequests', reqItem.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(nextStatus === 'closed' ? 'Solicitud cerrada.' : 'Solicitud reabierta.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `purchaseRequests/${reqItem.id}`);
    }
  };

  const handleDeleteRequest = async (reqId: string) => {
    try {
      await deleteDoc(doc(db, 'purchaseRequests', reqId));
      showToast('Solicitud de compra eliminada.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `purchaseRequests/${reqId}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">MATCH COMERCIAL</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Marketplace bidireccional: ofrece productos/servicios o publica solicitudes de compra.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setTab('my_publications')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 min-h-[40px] whitespace-nowrap"
          >
            <FileText className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <span>Ver mis publicaciones ({myProducts.length + myRequests.length})</span>
          </button>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDemo}
              onChange={(e) => setIncludeDemo(e.target.checked)}
              className="rounded border-slate-300 text-blue-700"
            />
            <span>Ver ejemplos de demostración (Chiloé)</span>
          </label>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          {id: 'explore_offers' as const, label: 'Explorar Ofertas', icon: <ShoppingBag className="w-4 h-4" />},
          {id: 'microstores' as const, label: 'Microtiendas', icon: <Store className="w-4 h-4" />},
          {
            id: 'my_store' as const,
            label: `Mi Microtienda (${myProducts.length}/${maxProductsLimit})`,
            icon: <Package className="w-4 h-4" />,
          },
          {id: 'explore_needs' as const, label: 'Solicitudes de Compra', icon: <Sparkles className="w-4 h-4" />},
          {id: 'publish_offer' as const, label: 'Publicar Producto/Servicio', icon: <Plus className="w-4 h-4" />},
          {id: 'publish_need' as const, label: 'Publicar Necesidad', icon: <Plus className="w-4 h-4" />},
          {
            id: 'my_publications' as const,
            label: `Mis publicaciones (${myProducts.length + myRequests.length})`,
            icon: <FileText className="w-4 h-4" />,
          },
          {id: 'seller_profile' as const, label: 'Mi Perfil Vendedor', icon: <Building2 className="w-4 h-4" />},
          {
            id: 'incoming_interest' as const,
            label: `Intereses Recibidos (${receivedInteractions.filter((i) => i.action === 'like').length})`,
            icon: <HeartHandshake className="w-4 h-4" />,
          },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              if (t.id === 'microstores') {
                setSelectedStoreSellerId(null);
                setMicroStoreSubMode('directory');
              } else if (t.id === 'my_store') {
                setSelectedStoreSellerId(null);
                setMicroStoreSubMode('my_store');
              }
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap min-h-[40px] ${
              tab === t.id
                ? 'bg-blue-700 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Microtiendas & Mi Microtienda */}
      {(tab === 'microstores' || tab === 'my_store') && (
        <MicroStoreSection
          products={products}
          myProducts={myProducts}
          myStore={myStore}
          allStores={microStores}
          selectedSellerId={selectedStoreSellerId}
          onSelectSellerId={setSelectedStoreSellerId}
          subMode={microStoreSubMode}
          onChangeSubMode={(mode) => {
            setMicroStoreSubMode(mode);
            if (mode === 'my_store') {
              setTab('my_store');
            } else {
              setTab('microstores');
            }
          }}
          onRequestPublishProduct={() => setTab('publish_offer')}
          onToggleProductStatus={handleToggleProductStatus}
          onDeleteProduct={handleDeleteProduct}
          includeDemo={includeDemo}
          openUpgradeTrigger={upgradeTrigger}
        />
      )}

      {/* Explore Offers or Needs */}
      {(tab === 'explore_offers' || tab === 'explore_needs') && (
        <div className="space-y-6">
          {/* Search & View Switcher */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    tab === 'explore_needs'
                      ? 'Buscar solicitudes (ej. ajo chilote, carpintería...)'
                      : 'Buscar productos, servicios o vendedores...'
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2 text-sm"
                />
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('tinder')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    viewMode === 'tinder'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Vista Tinder</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('results')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    viewMode === 'results'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Resultados</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('categories')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    viewMode === 'categories'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Categorías</span>
                </button>
              </div>
            </div>

            {/* Traditional Filters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                aria-label="Filtrar por categoría"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              >
                <option value="Todas">Todas las categorías</option>
                {COMMERCIAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={filterCommune}
                onChange={(e) => setFilterCommune(e.target.value)}
                aria-label="Filtrar por comuna"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              >
                <option value="Todas">Todas las comunas</option>
                {getRegionEntry(userAccount?.region).communes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {tab === 'explore_offers' && (
                <>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as 'all' | 'product' | 'service')}
                    aria-label="Filtrar producto o servicio"
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                  >
                    <option value="all">Productos y Servicios</option>
                    <option value="product">Solo Productos</option>
                    <option value="service">Solo Servicios</option>
                  </select>

                  <input
                    type="number"
                    min={0}
                    value={filterMaxPrice}
                    onChange={(e) => setFilterMaxPrice(e.target.value)}
                    placeholder="Precio máx (CLP)"
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono"
                  />

                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 px-2">
                    <input
                      type="checkbox"
                      checked={filterAvailOnly}
                      onChange={(e) => setFilterAvailOnly(e.target.checked)}
                      className="rounded border-slate-300 text-blue-700"
                    />
                    <span>Solo disponibles</span>
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Sponsored Ad Slot triggered by rotation rules */}
          {currentAdToShow && (
            <AdBannerCard
              campaign={currentAdToShow}
              sessionId={sessionId}
              onHide={(id) => {
                setHiddenAdIds((prev) => [...prev, id]);
                setCurrentAdToShow(null);
              }}
              onReport={(ad) => setReportTarget({id: ad.id, type: 'ad', title: ad.title})}
              onActionTriggered={(ad) => {
                showToast(`Abriendo destino del anuncio: ${ad.ctaDestination}`, 'info');
              }}
            />
          )}

          {/* View Modes */}
          {viewMode === 'tinder' && (
            <SwipeCardDeck
              items={deckItems}
              onSwipeRight={(item) => void handleInteraction(item, 'like')}
              onSwipeLeft={(item) => void handleInteraction(item, 'pass')}
              onFavorite={(item) => void handleInteraction(item, 'favorite')}
              onViewDetails={(item) => {
                const found =
                  allProducts.find((p) => p.id === item.id) ||
                  allRequests.find((r) => r.id === item.id) ||
                  null;
                setDetailItem(found);
              }}
            />
          )}

          {viewMode === 'results' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {(tab === 'explore_offers' ? filteredProducts : filteredRequests).map((entry) => {
                const isProd = 'priceCLP' in entry;
                return (
                  <article
                    key={entry.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between"
                  >
                    {isProd && (
                      <div className="h-44 bg-slate-100 dark:bg-slate-800">
                        <SafeImage
                          src={entry.imageUrl}
                          alt={entry.title}
                          className="w-full h-full object-cover"
                          fallbackLabel={entry.title}
                        />
                      </div>
                    )}
                    <div className="p-5 space-y-2.5 flex-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {entry.category} · {entry.commune}
                        {entry.isDemo ? ' · Demostración' : ''}
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white leading-snug">{entry.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{entry.description}</p>
                      <p className="font-mono tabular-nums text-sm font-bold text-blue-700 dark:text-blue-400">
                        {isProd
                          ? formatCLP(entry.priceCLP)
                          : `${formatCLP(entry.minBudgetCLP)} - ${formatCLP(entry.maxBudgetCLP)}`}
                      </p>
                    </div>
                    <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setDetailItem(entry)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detalles</span>
                        </button>
                        {isProd && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStoreSellerId(entry.ownerId);
                              setMicroStoreSubMode('directory');
                              setTab('microstores');
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap"
                          >
                            <Store className="w-3.5 h-3.5" />
                            <span>Ver tienda</span>
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void handleInteraction(
                            {
                              id: entry.id,
                              title: entry.title,
                              subtitle: '',
                              description: entry.description,
                              locationLabel: entry.commune,
                              metaLine: '',
                              isDemo: entry.isDemo,
                            },
                            'like'
                          )
                        }
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold min-h-[36px] whitespace-nowrap"
                      >
                        Me interesa
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {viewMode === 'categories' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {COMMERCIAL_CATEGORIES.map((cat) => {
                const count =
                  tab === 'explore_offers'
                    ? allProducts.filter((p) => p.category === cat).length
                    : allRequests.filter((r) => r.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setFilterCategory(cat);
                      setViewMode('results');
                    }}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left hover:border-blue-600 transition-colors space-y-1"
                  >
                    <Filter className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{cat}</p>
                    <p className="text-xs font-mono tabular-nums text-slate-500">{count} publicaciones</p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Compatible purchase requests for seller */}
          {compatibleSuggestions.length > 0 && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 space-y-3">
              <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                Solicitudes de compra compatibles con tus publicaciones
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {compatibleSuggestions.map((s) => (
                  <div
                    key={`${s.product.id}_${s.request.id}`}
                    className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{s.score}% afinidad</span>
                      <span className="text-slate-500">{s.request.commune}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.request.title}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{s.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Publish Product/Service */}
      {tab === 'publish_offer' && (
        <form
          onSubmit={handleCreateProduct}
          className="max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Publicar producto o servicio</h2>
            <span className="text-xs font-mono tabular-nums font-semibold text-blue-700 dark:text-blue-400">
              Cupo Microtienda: {myProducts.length} / {maxProductsLimit}
            </span>
          </div>
          {isAtProductQuota ? (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-bold">Alcanzaste los {maxProductsLimit} productos de tu Microtienda.</p>
                <p>
                  Cada Microtienda incluye hasta 3 productos gratis. Amplía +5 nuevos productos por $9.990 CLP mensuales.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTab('my_store');
                  setMicroStoreSubMode('my_store');
                  setUpgradeTrigger((n) => n + 1);
                }}
                className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold min-h-[40px] whitespace-nowrap shrink-0"
              >
                Ampliar +5 productos ($9.990/mes)
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tu publicación quedará activa de inmediato, visible para todos en MATCH COMERCIAL y dentro del catálogo de tu Microtienda.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Tipo</label>
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value as 'product' | 'service')}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
              >
                <option value="product">Producto</option>
                <option value="service">Servicio</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Categoría</label>
              <select
                value={prodCategory}
                onChange={(e) => setProdCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
              >
                {COMMERCIAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">Título del producto o servicio</label>
            <input
              type="text"
              required
              minLength={2}
              value={prodTitle}
              onChange={(e) => setProdTitle(e.target.value)}
              placeholder="Ej. Queso mantecoso artesanal de campo 1 kg"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">Descripción detallada</label>
            <textarea
              required
              rows={3}
              value={prodDesc}
              onChange={(e) => setProdDesc(e.target.value)}
              placeholder="Describe características, volumen disponible y condiciones de entrega."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Precio (CLP)</label>
              <input
                type="number"
                required
                min={0}
                value={prodPrice}
                onChange={(e) => setProdPrice(e.target.value)}
                placeholder="15000"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Comuna</label>
              <select
                value={prodCommune}
                onChange={(e) => setProdCommune(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
              >
                {getRegionEntry(prodRegion).communes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Disponibilidad</label>
              <select
                value={prodAvail}
                onChange={(e) => setProdAvail(e.target.value as 'available' | 'limited' | 'unavailable')}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
              >
                <option value="available">Disponible</option>
                <option value="limited">Stock limitado</option>
                <option value="unavailable">No disponible</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Métodos de entrega</label>
              <input
                type="text"
                value={prodDelivery}
                onChange={(e) => setProdDelivery(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">URL o imagen del producto</label>
              <input
                type="text"
                value={prodImageUrl}
                onChange={(e) => setProdImageUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold min-h-[44px]"
          >
            Publicar en MATCH COMERCIAL
          </button>
        </form>
      )}

      {/* Publish Purchase Request */}
      {tab === 'publish_need' && (
        <form
          onSubmit={handleCreatePurchaseRequest}
          className="max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
        >
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Publicar solicitud de compra (Necesidad)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ejemplo: &ldquo;Busco 100 kilos de ajo chilote para comprar esta semana&rdquo;. Vendedores compatibles
            recibirán la solicitud.
          </p>

          <div className="space-y-1">
            <label className="text-xs font-semibold">¿Qué necesitas comprar o contratar?</label>
            <input
              type="text"
              required
              minLength={3}
              value={reqTitle}
              onChange={(e) => setReqTitle(e.target.value)}
              placeholder="Ej. Busco 100 kilos de ajo chilote para comprar esta semana"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">Especificaciones y lugar de entrega</label>
            <textarea
              required
              rows={3}
              value={reqDesc}
              onChange={(e) => setReqDesc(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Categoría</label>
              <select
                value={reqCategory}
                onChange={(e) => setReqCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
              >
                {COMMERCIAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Presupuesto mín.</label>
              <input
                type="number"
                min={0}
                value={reqMinBudget}
                onChange={(e) => setReqMinBudget(e.target.value)}
                placeholder="100000"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Presupuesto máx.</label>
              <input
                type="number"
                required
                min={0}
                value={reqMaxBudget}
                onChange={(e) => setReqMaxBudget(e.target.value)}
                placeholder="250000"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Urgencia</label>
              <select
                value={reqUrgency}
                onChange={(e) => setReqUrgency(e.target.value as 'inmediata' | 'esta_semana' | 'este_mes')}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
              >
                <option value="inmediata">Inmediata</option>
                <option value="esta_semana">Esta semana</option>
                <option value="este_mes">Este mes</option>
              </select>
            </div>
          </div>

          <div className="space-y-1 max-w-xs">
            <label className="text-xs font-semibold">Comuna</label>
            <select
              value={reqCommune}
              onChange={(e) => setReqCommune(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
            >
              {getRegionEntry(userAccount?.region).communes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold min-h-[44px]"
          >
            Publicar solicitud de compra
          </button>
        </form>
      )}

      {/* My Publications */}
      {tab === 'my_publications' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Mis productos y servicios publicados ({myProducts.length})
                </h2>
                <p className="text-xs text-slate-500">Administra, pausa o elimina tus ofertas comerciales.</p>
              </div>
              <button
                type="button"
                onClick={() => setTab('publish_offer')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold min-h-[40px] whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Publicar producto o servicio</span>
              </button>
            </div>

            {myProducts.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">Aún no tienes productos ni servicios publicados.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {myProducts.map((prod) => (
                  <div key={prod.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                        <SafeImage src={prod.imageUrl} alt={prod.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className={prod.status === 'active' ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-amber-700 dark:text-amber-400 font-semibold'}>
                            {prod.status === 'active' ? 'Activa' : prod.status === 'paused' ? 'Pausada' : 'Archivada'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{prod.itemType === 'service' ? 'Servicio' : 'Producto'}</span>
                          <span aria-hidden="true">·</span>
                          <span>{prod.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{prod.commune}</span>
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white truncate">{prod.title}</h3>
                        <p className="font-mono tabular-nums text-xs font-bold text-blue-700 dark:text-blue-400">
                          {formatCLP(prod.priceCLP)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleToggleProductStatus(prod)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold min-h-[38px] whitespace-nowrap"
                      >
                        {prod.status === 'active' ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pausar</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Reactivar</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteProduct(prod.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs font-semibold min-h-[38px] whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Mis solicitudes de compra ({myRequests.length})
                </h2>
                <p className="text-xs text-slate-500">Revisa tus búsquedas y necesidades publicadas.</p>
              </div>
              <button
                type="button"
                onClick={() => setTab('publish_need')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold min-h-[40px] whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Publicar necesidad</span>
              </button>
            </div>

            {myRequests.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">Aún no has publicado solicitudes de compra.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {myRequests.map((reqItem) => (
                  <div key={reqItem.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className={reqItem.status === 'open' ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-400 font-semibold'}>
                          {reqItem.status === 'open' ? 'Abierta' : reqItem.status === 'matched' ? 'Con match' : 'Cerrada'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{reqItem.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{reqItem.commune}</span>
                        <span aria-hidden="true">·</span>
                        <span>Urgencia: {reqItem.urgency.replace('_', ' ')}</span>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{reqItem.title}</h3>
                      <p className="font-mono tabular-nums text-xs font-bold text-blue-700 dark:text-blue-400">
                        Presupuesto: {formatCLP(reqItem.minBudgetCLP)} - {formatCLP(reqItem.maxBudgetCLP)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleToggleRequestStatus(reqItem)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold min-h-[38px] whitespace-nowrap"
                      >
                        {reqItem.status === 'open' ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Cerrar</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Reabrir</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteRequest(reqItem.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs font-semibold min-h-[38px] whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seller Profile */}
      {tab === 'seller_profile' && (
        <form
          onSubmit={handleSaveBusinessProfile}
          className="max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
        >
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Perfil de vendedor / negocio</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Nombre del negocio</label>
              <input
                type="text"
                required
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Nombre comercial</label>
              <input
                type="text"
                value={bizCommName}
                onChange={(e) => setBizCommName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold">Descripción del negocio</label>
            <textarea
              rows={3}
              value={bizDesc}
              onChange={(e) => setBizDesc(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Categoría principal</label>
              <select
                value={bizCategory}
                onChange={(e) => setBizCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
              >
                {COMMERCIAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Comuna</label>
              <select
                value={bizCommune}
                onChange={(e) => setBizCommune(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
              >
                {getRegionEntry(userAccount?.region).communes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Horarios de atención</label>
              <input
                type="text"
                value={bizHours}
                onChange={(e) => setBizHours(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Contacto comercial</label>
              <input
                type="text"
                value={bizContact}
                onChange={(e) => setBizContact(e.target.value)}
                placeholder="Teléfono o correo público del local"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Condiciones de venta</label>
              <input
                type="text"
                value={bizTerms}
                onChange={(e) => setBizTerms(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold min-h-[44px]"
          >
            Guardar perfil comercial
          </button>
        </form>
      )}

      {/* Incoming Interest to confirm mutual matches */}
      {tab === 'incoming_interest' && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Intereses recibidos en tus publicaciones</h2>
          {receivedInteractions.filter((i) => i.action === 'like').length === 0 ? (
            <p className="text-sm text-slate-500">
              Aún no recibes intereses nuevos. Publica productos o solicitudes para conectar con otros usuarios.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {receivedInteractions
                .filter((i) => i.action === 'like')
                .map((inter) => (
                  <div key={inter.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Interés en publicación ({inter.targetKind === 'product' ? 'Producto/Servicio' : 'Solicitud'})
                      </p>
                      <p className="text-xs text-slate-500 font-mono">ID: {inter.targetId}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleConfirmReceivedInterest(inter)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold min-h-[40px]"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Aceptar y hacer MATCH</span>
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
            {'imageUrl' in detailItem && detailItem.imageUrl && (
              <div className="h-56 bg-slate-100 dark:bg-slate-800">
                <SafeImage src={detailItem.imageUrl} alt={detailItem.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">{detailItem.category} · {detailItem.commune}</p>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{detailItem.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{detailItem.description}</p>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                  {'priceCLP' in detailItem
                    ? formatCLP(detailItem.priceCLP)
                    : `${formatCLP(detailItem.minBudgetCLP)} - ${formatCLP(detailItem.maxBudgetCLP)}`}
                </span>
                <div className="flex items-center gap-3">
                  {'priceCLP' in detailItem && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStoreSellerId(detailItem.ownerId);
                        setMicroStoreSubMode('directory');
                        setTab('microstores');
                        setDetailItem(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold min-h-[36px] whitespace-nowrap"
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>Visitar Microtienda</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setReportTarget({id: detailItem.id, type: 'product', title: detailItem.title});
                      setDetailItem(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:underline"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Denunciar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSubmitReport}
            className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Denunciar contenido</h3>
              <button type="button" onClick={() => setReportTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">Elemento: {reportTarget.title}</p>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="Información engañosa">Información engañosa</option>
              <option value="Producto prohibido o fraude">Producto prohibido o fraude</option>
              <option value="Spam o contenido repetitivo">Spam o contenido repetitivo</option>
            </select>
            <textarea
              rows={3}
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Detalles adicionales para moderación..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold min-h-[44px]"
            >
              Enviar denuncia
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
