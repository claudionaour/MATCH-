import React, {useEffect, useMemo, useState} from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Minus,
  Package,
  Pause,
  Play,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import {useAuth} from '../../contexts/AuthContext';
import {useToast} from '../../contexts/ToastContext';
import {db, handleFirestoreError, OperationType} from '../../services/firebase/firebaseClient';
import {
  COMMERCIAL_CATEGORIES,
  DEFAULT_REGION,
  DEMO_PRODUCTS,
  formatCLP,
  getRegionEntry,
  normalizeRegionName,
} from '../../services/config/chileCatalog';
import {initiateFlowPayment} from '../../services/payments/paymentService';
import {
  CommercialProduct,
  MicroStore,
  StoreCartItem,
  StoreDeliveryType,
  StoreOrder,
  StorePaymentMethod,
} from '../../types';
import {SafeImage} from '../../components/SafeImage';
import {sortByCreatedDesc} from '../../utils/sortNewest';

interface MicroStoreSectionProps {
  products: CommercialProduct[];
  myProducts: CommercialProduct[];
  myStore: MicroStore | null;
  allStores: MicroStore[];
  selectedSellerId: string | null;
  onSelectSellerId: (uid: string | null) => void;
  subMode: 'directory' | 'my_store' | 'my_orders';
  onChangeSubMode: (mode: 'directory' | 'my_store' | 'my_orders') => void;
  onRequestPublishProduct: () => void;
  onToggleProductStatus: (prod: CommercialProduct) => Promise<void>;
  onDeleteProduct: (prodId: string) => Promise<void>;
  includeDemo: boolean;
  openUpgradeTrigger?: number;
}

const DELIVERY_LABELS: Record<StoreDeliveryType, string> = {
  por_coordinar: 'Por coordinar con vendedor',
  retiro_tienda: 'Retiro en tienda / punto de entrega',
  despacho_domicilio: 'Despacho a domicilio (local)',
  envio_encomienda: 'Envío por encomienda (Starken / Chilexpress / Correos)',
};

const PAYMENT_LABELS: Record<StorePaymentMethod, string> = {
  por_coordinar: 'Por coordinar con vendedor',
  transferencia: 'Transferencia bancaria',
  efectivo: 'Efectivo al entregar',
  link_flow: 'Link de pago / Flow',
  otro: 'Otro acuerdo directo',
};

const STATUS_LABELS: Record<StoreOrder['status'], string> = {
  pending_coordination: 'Pendiente de coordinación',
  coordinated: 'Coordinado por vendedor',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export const MicroStoreSection: React.FC<MicroStoreSectionProps> = ({
  products,
  myProducts,
  myStore,
  allStores,
  selectedSellerId,
  onSelectSellerId,
  subMode,
  onChangeSubMode,
  onRequestPublishProduct,
  onToggleProductStatus,
  onDeleteProduct,
  includeDemo,
  openUpgradeTrigger = 0,
}) => {
  const {firebaseUser, userAccount, isPaymentExempt} = useAuth();
  const {showToast} = useToast();

  // Store directory filters
  const [storeSearch, setStoreSearch] = useState('');
  const [storeCommune, setStoreCommune] = useState('Todas');

  // My Store setup form
  const [storeName, setStoreName] = useState('');
  const [storeDesc, setStoreDesc] = useState('');
  const [storeCategory, setStoreCategory] = useState(COMMERCIAL_CATEGORIES[0]);
  const [storeCommuneField, setStoreCommuneField] = useState(userAccount?.commune || 'Castro');
  const [storeDeliveryText, setStoreDeliveryText] = useState(
    'Retiro en tienda, Despacho comunal, Envío por pagar'
  );
  const [storePaymentText, setStorePaymentText] = useState(
    'Transferencia bancaria, Efectivo contra entrega, Link de pago'
  );
  const [savingStore, setSavingStore] = useState(false);

  // Shopping carts keyed by sellerId (persisted in localStorage)
  const cartStorageKey = `matchplus_store_carts_${firebaseUser?.uid || 'guest'}`;
  const [cartsBySeller, setCartsBySeller] = useState<Record<string, StoreCartItem[]>>(() => {
    try {
      const raw = localStorage.getItem(cartStorageKey);
      return raw ? (JSON.parse(raw) as Record<string, StoreCartItem[]>) : {};
    } catch {
      return {};
    }
  });
  const [buyerNote, setBuyerNote] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  // Orders (incoming as seller + outgoing as buyer)
  const [sellerOrders, setSellerOrders] = useState<StoreOrder[]>([]);
  const [buyerOrders, setBuyerOrders] = useState<StoreOrder[]>([]);
  const [coordDrafts, setCoordDrafts] = useState<
    Record<
      string,
      {
        deliveryType: StoreDeliveryType;
        deliveryDetails: string;
        paymentMethod: StorePaymentMethod;
        paymentDetails: string;
      }
    >
  >({});

  // Upgrade modal (+5 products for $9.990/month)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMethod, setUpgradeMethod] = useState<'flow' | 'transfer'>('flow');
  const [transferNote, setTransferNote] = useState('');
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeFlowNotice, setUpgradeFlowNotice] = useState<string | null>(null);

  useEffect(() => {
    if (openUpgradeTrigger > 0) {
      setShowUpgradeModal(true);
    }
  }, [openUpgradeTrigger]);

  useEffect(() => {
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(cartsBySeller));
    } catch {
      // Ignore storage quota errors
    }
  }, [cartsBySeller, cartStorageKey]);

  useEffect(() => {
    if (myStore) {
      setStoreName(myStore.storeName);
      setStoreDesc(myStore.description);
      setStoreCategory(myStore.category || COMMERCIAL_CATEGORIES[0]);
      setStoreCommuneField(myStore.commune || userAccount?.commune || 'Castro');
      setStoreDeliveryText(myStore.deliveryOptions.join(', '));
      setStorePaymentText(myStore.acceptedPaymentMethods.join(', '));
    } else if (userAccount) {
      setStoreName(`Microtienda ${userAccount.displayName}`);
      setStoreCommuneField(userAccount.commune || 'Castro');
    }
  }, [myStore, userAccount]);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubSeller = onSnapshot(
      query(collection(db, 'storeOrders'), where('sellerId', '==', firebaseUser.uid)),
      (snap) => {
        const list = sortByCreatedDesc(
          snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<StoreOrder, 'id'>)}))
        );
        setSellerOrders(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'storeOrders')
    );

    const unsubBuyer = onSnapshot(
      query(collection(db, 'storeOrders'), where('buyerId', '==', firebaseUser.uid)),
      (snap) => {
        const list = sortByCreatedDesc(
          snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<StoreOrder, 'id'>)}))
        );
        setBuyerOrders(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'storeOrders')
    );

    return () => {
      unsubSeller();
      unsubBuyer();
    };
  }, [firebaseUser]);

  const freeLimit = myStore?.freeLimit ?? 3;
  const extraQuota = myStore?.extraQuota ?? 0;
  const maxProductsLimit = freeLimit + extraQuota;
  const usedProductsCount = myProducts.length;
  const remainingSlots = Math.max(0, maxProductsLimit - usedProductsCount);

  // Build full directory of live + derived + optional demo microstores
  const directoryStores = useMemo(() => {
    const map = new Map<string, MicroStore>();
    for (const s of allStores) {
      map.set(s.ownerId, s);
    }

    const sourceProducts = includeDemo ? [...products, ...DEMO_PRODUCTS] : products;
    for (const p of sourceProducts) {
      if (!map.has(p.ownerId)) {
        map.set(p.ownerId, {
          id: p.isDemo ? `demo_store_${p.ownerId}` : `store_${p.ownerId}`,
          ownerId: p.ownerId,
          storeName: `Microtienda ${p.sellerName}`,
          description: `Catálogo directo de ${p.sellerName} en ${p.commune}, ${p.region}.`,
          category: p.category,
          commune: p.commune,
          region: p.region,
          deliveryOptions: p.deliveryMethods.length > 0 ? p.deliveryMethods : ['Retiro en tienda', 'Despacho local'],
          acceptedPaymentMethods: ['Transferencia bancaria', 'Efectivo al entregar'],
          freeLimit: 3,
          extraQuota: 0,
          maxProductsLimit: 3,
          planPacksCount: 0,
          lastFlowToken: '',
          status: 'active',
          isDemo: p.isDemo,
        });
      }
    }

    return Array.from(map.values()).filter((st) => {
      if (storeCommune !== 'Todas' && st.commune !== storeCommune) return false;
      if (storeSearch.trim()) {
        const q = storeSearch.toLowerCase();
        if (
          !st.storeName.toLowerCase().includes(q) &&
          !st.description.toLowerCase().includes(q) &&
          !st.commune.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [allStores, products, includeDemo, storeCommune, storeSearch]);

  const activeStore = useMemo(() => {
    if (!selectedSellerId) return null;
    return directoryStores.find((s) => s.ownerId === selectedSellerId) || null;
  }, [selectedSellerId, directoryStores]);

  const activeStoreProducts = useMemo(() => {
    if (!selectedSellerId) return [];
    const source = includeDemo ? [...products, ...DEMO_PRODUCTS] : products;
    return sortByCreatedDesc(source.filter((p) => p.ownerId === selectedSellerId && p.status === 'active'));
  }, [selectedSellerId, products, includeDemo]);

  const currentCart = selectedSellerId ? cartsBySeller[selectedSellerId] || [] : [];
  const currentCartTotal = currentCart.reduce((acc, item) => acc + item.priceCLP * item.quantity, 0);
  const currentCartCount = currentCart.reduce((acc, item) => acc + item.quantity, 0);

  const addToCart = (prod: CommercialProduct) => {
    const sellerId = prod.ownerId;
    setCartsBySeller((prev) => {
      const existingList = prev[sellerId] || [];
      const found = existingList.find((i) => i.productId === prod.id);
      const updated = found
        ? existingList.map((i) => (i.productId === prod.id ? {...i, quantity: i.quantity + 1} : i))
        : [
            ...existingList,
            {
              productId: prod.id,
              title: prod.title,
              priceCLP: prod.priceCLP,
              quantity: 1,
              imageUrl: prod.imageUrl,
            },
          ];
      return {...prev, [sellerId]: updated};
    });
    showToast(`"${prod.title}" agregado al carrito.`, 'success');
  };

  const updateCartQty = (sellerId: string, productId: string, delta: number) => {
    setCartsBySeller((prev) => {
      const existingList = prev[sellerId] || [];
      const nextList = existingList
        .map((i) => (i.productId === productId ? {...i, quantity: i.quantity + delta} : i))
        .filter((i) => i.quantity > 0);
      return {...prev, [sellerId]: nextList};
    });
  };

  const handleCheckout = async () => {
    if (!firebaseUser || !activeStore) {
      showToast('Inicia sesión para concretar tu compra.', 'error');
      return;
    }
    if (currentCart.length === 0) {
      showToast('Tu carrito está vacío.', 'error');
      return;
    }
    if (activeStore.isDemo) {
      showToast(
        'Esta es una microtienda de demostración. Selecciona una microtienda de un usuario real para enviar un pedido en vivo.',
        'info'
      );
      return;
    }

    setCheckingOut(true);
    try {
      const orderRef = await addDoc(collection(db, 'storeOrders'), {
        storeId: activeStore.id || `store_${activeStore.ownerId}`,
        sellerId: activeStore.ownerId,
        sellerName: activeStore.storeName,
        buyerId: firebaseUser.uid,
        buyerName: userAccount?.displayName || firebaseUser.displayName || 'Cliente',
        buyerCommune: userAccount?.commune || 'Castro',
        items: currentCart.slice(0, 20),
        totalCLP: currentCartTotal,
        buyerNote: buyerNote.trim(),
        deliveryType: 'por_coordinar',
        deliveryDetails: '',
        paymentMethod: 'por_coordinar',
        paymentDetails: '',
        status: 'pending_coordination',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'notifications'), {
        userId: activeStore.ownerId,
        type: 'payment',
        title: 'Nuevo pedido en tu Microtienda',
        body: `${userAccount?.displayName || 'Un cliente'} concretó una compra por ${formatCLP(currentCartTotal)}. Coordina la entrega/envío y el método de pago.`,
        module: 'commercial',
        relatedId: orderRef.id,
        read: false,
        createdAt: serverTimestamp(),
      });

      setCartsBySeller((prev) => ({...prev, [activeStore.ownerId]: []}));
      setBuyerNote('');
      onSelectSellerId(null);
      onChangeSubMode('my_orders');
      showToast(
        'Compra concretada. El vendedor recibió tu pedido y coordinará la entrega/envío y método de pago.',
        'success'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'storeOrders');
    } finally {
      setCheckingOut(false);
    }
  };

  const ensureMyStoreDoc = async (): Promise<string> => {
    if (!firebaseUser) throw new Error('Usuario no autenticado');
    const storeId = `store_${firebaseUser.uid}`;
    if (!myStore) {
      await setDoc(doc(db, 'microStores', storeId), {
        ownerId: firebaseUser.uid,
        storeName: storeName.trim() || `Microtienda ${userAccount?.displayName || 'Local'}`,
        description: storeDesc.trim() || 'Microtienda local en MATCH+',
        category: storeCategory,
        commune: storeCommuneField,
        region: normalizeRegionName(userAccount?.region) || DEFAULT_REGION,
        deliveryOptions: storeDeliveryText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 6),
        acceptedPaymentMethods: storePaymentText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 6),
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
    return storeId;
  };

  const handleSaveMyStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSavingStore(true);
    const storeId = `store_${firebaseUser.uid}`;
    try {
      const payload = {
        storeName: storeName.trim() || `Microtienda ${userAccount?.displayName || 'Local'}`,
        description: storeDesc.trim(),
        category: storeCategory,
        commune: storeCommuneField,
        region: normalizeRegionName(userAccount?.region) || DEFAULT_REGION,
        deliveryOptions: storeDeliveryText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 6),
        acceptedPaymentMethods: storePaymentText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 6),
        status: myStore?.status || 'active',
        updatedAt: serverTimestamp(),
      };
      if (myStore) {
        await updateDoc(doc(db, 'microStores', storeId), payload);
      } else {
        await setDoc(doc(db, 'microStores', storeId), {
          ownerId: firebaseUser.uid,
          ...payload,
          freeLimit: 3,
          extraQuota: 0,
          maxProductsLimit: 3,
          planPacksCount: 0,
          lastFlowToken: '',
          createdAt: serverTimestamp(),
        });
      }
      showToast('Configuración de tu Microtienda guardada y visible para todos.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `microStores/${storeId}`);
    } finally {
      setSavingStore(false);
    }
  };

  const handleUpgradeQuota = async () => {
    if (!firebaseUser) return;
    setUpgrading(true);
    setUpgradeFlowNotice(null);

    try {
      const storeId = await ensureMyStoreDoc();
      const commerceOrder = `MS_${Date.now().toString().slice(-8)}_${firebaseUser.uid.slice(0, 5)}`;
      const amountCLP = isPaymentExempt ? 0 : 9990;

      if (isPaymentExempt) {
        await addDoc(collection(db, 'adOrders'), {
          ownerId: firebaseUser.uid,
          engine: 'commercial',
          orderType: 'microstore_quota',
          description: 'Plan Microtienda +5 productos mensuales (cuenta libre de pago)',
          commerceOrder,
          amountCLP: 0,
          currency: 'CLP',
          paymentMethod: 'exempt',
          receiptNote: 'Cuenta exenta de cobro ($0 CLP)',
          status: 'confirmed',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const nextExtra = (myStore?.extraQuota ?? 0) + 5;
        await updateDoc(doc(db, 'microStores', storeId), {
          extraQuota: nextExtra,
          maxProductsLimit: 3 + nextExtra,
          planPacksCount: (myStore?.planPacksCount ?? 0) + 1,
          lastFlowToken: `exempt_${Date.now()}`,
          updatedAt: serverTimestamp(),
        });

        showToast('¡Cuota ampliada! Se agregaron +5 productos gratis a tu Microtienda.', 'success');
        setShowUpgradeModal(false);
        return;
      }

      if (upgradeMethod === 'flow') {
        await addDoc(collection(db, 'adOrders'), {
          ownerId: firebaseUser.uid,
          engine: 'commercial',
          orderType: 'microstore_quota',
          description: 'Plan Microtienda +5 productos mensuales ($9.990 CLP/mes)',
          commerceOrder,
          amountCLP,
          currency: 'CLP',
          paymentMethod: 'flow',
          receiptNote: 'Orden generada vía Flow para ampliar +5 productos',
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const flowResult = await initiateFlowPayment({
          commerceOrder,
          packageId: 'pkg_microstore_5',
          isRegisteredAdvertiser: false,
          email: userAccount?.email || firebaseUser.email || '',
          subject: 'MATCH+ Microtienda +5 Productos (Plan Mensual)',
        });

        if (flowResult.exempt) {
          const nextExtra = (myStore?.extraQuota ?? 0) + 5;
          await updateDoc(doc(db, 'microStores', storeId), {
            extraQuota: nextExtra,
            maxProductsLimit: 3 + nextExtra,
            planPacksCount: (myStore?.planPacksCount ?? 0) + 1,
            lastFlowToken: `exempt_${Date.now()}`,
            updatedAt: serverTimestamp(),
          });
          showToast('Cuota ampliada (+5 productos) sin costo.', 'success');
          setShowUpgradeModal(false);
          return;
        }

        if (flowResult.redirectUrl) {
          showToast('Redirigiendo a Flow para confirmar tu plan de +5 productos...', 'success');
          window.location.assign(flowResult.redirectUrl);
          return;
        }

        setUpgradeFlowNotice(
          flowResult.instructions ||
            flowResult.error ||
            'Orden guardada como pendiente. Configura Flow en el servidor o envía comprobante por transferencia bancaria para que administración active tus +5 cupos.'
        );
      } else {
        await addDoc(collection(db, 'adOrders'), {
          ownerId: firebaseUser.uid,
          engine: 'commercial',
          orderType: 'microstore_quota',
          description: 'Plan Microtienda +5 productos mensuales ($9.990 CLP/mes)',
          commerceOrder,
          amountCLP: 9990,
          currency: 'CLP',
          paymentMethod: 'transfer',
          receiptNote: transferNote.trim() || 'Transferencia informada por vendedor',
          status: 'pending_confirmation',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast(
          'Solicitud de ampliación por transferencia registrada. Apenas se confirme el pago, tus +5 productos se sumarán automáticamente.',
          'success'
        );
        setTransferNote('');
        setShowUpgradeModal(false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'microStores');
    } finally {
      setUpgrading(false);
    }
  };

  const getCoordDraft = (order: StoreOrder) => {
    return (
      coordDrafts[order.id] || {
        deliveryType: order.deliveryType === 'por_coordinar' ? 'retiro_tienda' : order.deliveryType,
        deliveryDetails: order.deliveryDetails || '',
        paymentMethod: order.paymentMethod === 'por_coordinar' ? 'transferencia' : order.paymentMethod,
        paymentDetails: order.paymentDetails || '',
      }
    );
  };

  const handleCoordinateOrder = async (order: StoreOrder, nextStatus: StoreOrder['status']) => {
    const draft = getCoordDraft(order);
    try {
      await updateDoc(doc(db, 'storeOrders', order.id), {
        deliveryType: draft.deliveryType,
        deliveryDetails: draft.deliveryDetails.trim(),
        paymentMethod: draft.paymentMethod,
        paymentDetails: draft.paymentDetails.trim(),
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'notifications'), {
        userId: order.buyerId,
        type: 'payment',
        title:
          nextStatus === 'coordinated'
            ? `Coordinación lista en ${order.sellerName}`
            : nextStatus === 'completed'
              ? `Pedido completado en ${order.sellerName}`
              : `Pedido actualizado en ${order.sellerName}`,
        body:
          nextStatus === 'coordinated'
            ? `Entrega: ${DELIVERY_LABELS[draft.deliveryType]} · Pago: ${PAYMENT_LABELS[draft.paymentMethod]}.`
            : `Estado del pedido: ${STATUS_LABELS[nextStatus]}.`,
        module: 'commercial',
        relatedId: order.id,
        read: false,
        createdAt: serverTimestamp(),
      });

      showToast(
        nextStatus === 'coordinated'
          ? 'Coordinación de entrega y pago enviada al cliente.'
          : `Pedido marcado como ${STATUS_LABELS[nextStatus].toLowerCase()}.`,
        'success'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `storeOrders/${order.id}`);
    }
  };

  const pendingSellerOrdersCount = sellerOrders.filter((o) => o.status === 'pending_coordination').length;

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onSelectSellerId(null);
              onChangeSubMode('directory');
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold min-h-[40px] whitespace-nowrap ${
              subMode === 'directory' && !selectedSellerId
                ? 'bg-slate-900 dark:bg-blue-700 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Explorar Microtiendas ({directoryStores.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectSellerId(null);
              onChangeSubMode('my_store');
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold min-h-[40px] whitespace-nowrap ${
              subMode === 'my_store' && !selectedSellerId
                ? 'bg-slate-900 dark:bg-blue-700 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>
              Mi Microtienda ({usedProductsCount}/{maxProductsLimit})
              {pendingSellerOrdersCount > 0 ? ` · ${pendingSellerOrdersCount} nuevos` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectSellerId(null);
              onChangeSubMode('my_orders');
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold min-h-[40px] whitespace-nowrap ${
              subMode === 'my_orders' && !selectedSellerId
                ? 'bg-slate-900 dark:bg-blue-700 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Mis compras ({buyerOrders.length})</span>
          </button>
        </div>
      </div>

      {/* Storefront View with Shopping Cart */}
      {selectedSellerId && activeStore && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => onSelectSellerId(null)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline min-h-[36px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al directorio de Microtiendas</span>
          </button>

          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-blue-700 dark:text-blue-400">{activeStore.category}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {activeStore.commune}, {activeStore.region}
                </span>
                {activeStore.isDemo && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Demostración</span>
                  </>
                )}
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {activeStore.storeName}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">{activeStore.description}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500 pt-1">
                <span>Entrega: {activeStore.deliveryOptions.join(', ')}</span>
                <span>Pago aceptado: {activeStore.acceptedPaymentMethods.join(', ')}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-right">
                <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">Carrito de esta tienda</p>
                <p className="font-mono tabular-nums text-lg font-extrabold text-slate-900 dark:text-white">
                  {currentCartCount} ítems · {formatCLP(currentCartTotal)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Store Product Catalog */}
            <div className="lg:col-span-8 space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Catálogo de productos ({activeStoreProducts.length})
              </h3>
              {activeStoreProducts.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
                  Esta microtienda aún no tiene productos activos publicados.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeStoreProducts.map((prod) => {
                    const inCart = currentCart.find((c) => c.productId === prod.id);
                    return (
                      <article
                        key={prod.id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between"
                      >
                        <div className="h-44 bg-slate-100 dark:bg-slate-800">
                          <SafeImage
                            src={prod.imageUrl}
                            alt={prod.title}
                            className="w-full h-full object-cover"
                            fallbackLabel={prod.title}
                          />
                        </div>
                        <div className="p-4 space-y-2 flex-1">
                          <p className="text-xs text-slate-500">
                            {prod.category} · {prod.availability === 'available' ? 'Disponible' : 'Stock limitado'}
                          </p>
                          <h4 className="font-bold text-slate-900 dark:text-white leading-snug">{prod.title}</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{prod.description}</p>
                          <p className="font-mono tabular-nums text-base font-extrabold text-blue-700 dark:text-blue-400">
                            {formatCLP(prod.priceCLP)}
                          </p>
                        </div>
                        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                          {inCart ? (
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => updateCartQty(activeStore.ownerId, prod.id, -1)}
                                className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800"
                                aria-label="Quitar uno"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="font-mono tabular-nums text-sm font-bold text-slate-900 dark:text-white">
                                {inCart.quantity} en carrito
                              </span>
                              <button
                                type="button"
                                onClick={() => updateCartQty(activeStore.ownerId, prod.id, 1)}
                                className="w-10 h-10 rounded-xl bg-blue-700 hover:bg-blue-800 text-white flex items-center justify-center"
                                aria-label="Agregar uno más"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addToCart(prod)}
                              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold min-h-[40px]"
                            >
                              <ShoppingCart className="w-4 h-4" />
                              <span>Agregar al carrito</span>
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sticky Shopping Cart */}
            <aside className="lg:col-span-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 lg:sticky lg:top-20">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                  <span>Carrito de compras</span>
                </h3>
                <span className="font-mono tabular-nums text-xs font-semibold text-slate-500">
                  {currentCartCount} ítems
                </span>
              </div>

              {currentCart.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">
                  Agrega productos del catálogo para armar tu pedido y concretar la compra con el vendedor.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                    {currentCart.map((item) => (
                      <div key={item.productId} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">{item.title}</p>
                          <p className="font-mono tabular-nums text-slate-500">
                            {item.quantity} × {formatCLP(item.priceCLP)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateCartQty(activeStore.ownerId, item.productId, -1)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
                            aria-label="Disminuir"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCartQty(activeStore.ownerId, item.productId, 1)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
                            aria-label="Aumentar"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Nota para el vendedor (opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={buyerNote}
                      onChange={(e) => setBuyerNote(e.target.value)}
                      placeholder="Ej. Prefiero retiro hoy o envío a domicilio en Dalcahue"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Total estimado</span>
                    <span className="font-mono tabular-nums text-lg font-extrabold text-slate-950 dark:text-white">
                      {formatCLP(currentCartTotal)}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={checkingOut}
                    onClick={() => void handleCheckout()}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold min-h-[44px] disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{checkingOut ? 'Enviando pedido...' : 'Concretar compra'}</span>
                  </button>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Al pinchar <strong>Concretar compra</strong>, el vendedor recibirá tu pedido y podrá coordinar la
                    entrega o envío y el método de pago directamente contigo.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </div>
      )}

      {/* Directory of Microstores */}
      {subMode === 'directory' && !selectedSellerId && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                placeholder="Buscar microtienda por nombre o rubro..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2 text-sm"
              />
            </div>
            <select
              value={storeCommune}
              onChange={(e) => setStoreCommune(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="Todas">Todas las comunas</option>
              {getRegionEntry(userAccount?.region).communes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {directoryStores.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
              No se encontraron microtiendas con esos filtros.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {directoryStores.map((st) => {
                const source = includeDemo ? [...products, ...DEMO_PRODUCTS] : products;
                const count = source.filter((p) => p.ownerId === st.ownerId && p.status === 'active').length;
                const cartCount = (cartsBySeller[st.ownerId] || []).reduce((acc, i) => acc + i.quantity, 0);
                return (
                  <article
                    key={st.ownerId}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold text-blue-700 dark:text-blue-400">{st.category}</span>
                        <span>
                          {st.commune}
                          {st.isDemo ? ' · Demo' : ''}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{st.storeName}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{st.description}</p>
                      <p className="text-xs font-mono tabular-nums text-slate-500">
                        {count} {count === 1 ? 'producto publicado' : 'productos publicados'}
                        {cartCount > 0 ? ` · ${cartCount} en carrito` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectSellerId(st.ownerId)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold min-h-[40px]"
                    >
                      <Store className="w-4 h-4" />
                      <span>Abrir Microtienda y Carrito</span>
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Seller's Own Microtienda Management, Quota & Incoming Orders */}
      {subMode === 'my_store' && !selectedSellerId && (
        <div className="space-y-6">
          {/* Quota & Plan Card */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                <Sparkles className="w-4 h-4" />
                <span>Plan de Microtienda · 3 productos gratis + ampliación mensual</span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Capacidad actual:{' '}
                <span className="font-mono tabular-nums">
                  {usedProductsCount} / {maxProductsLimit}
                </span>{' '}
                productos
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Tu microtienda incluye <strong>3 productos gratis</strong>. Si deseas publicar más artículos, cada plan
                de <strong>$9.990 CLP mensuales</strong> agrega automáticamente <strong>+5 nuevos productos</strong> a
                tu cuota apenas se confirme el pago.
                {isPaymentExempt && ' (Cuenta exenta: ampliaciones a $0 CLP sin costo).'}
              </p>
              <div className="w-full max-w-md h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden pt-0">
                <div
                  className={`h-full transition-all ${
                    remainingSlots === 0 ? 'bg-amber-600' : 'bg-blue-700'
                  }`}
                  style={{width: `${Math.min(100, Math.round((usedProductsCount / maxProductsLimit) * 100))}%`}}
                />
              </div>
              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                Base gratuita: 3 · Cupos extra confirmados: +{extraQuota} ({myStore?.planPacksCount ?? 0} packs) ·
                Disponibles ahora: {remainingSlots}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold min-h-[44px] whitespace-nowrap"
              >
                <CreditCard className="w-4 h-4" />
                <span>
                  {isPaymentExempt ? 'Ampliar +5 productos ($0 CLP)' : 'Ampliar +5 productos ($9.990/mes)'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (remainingSlots <= 0) {
                    setShowUpgradeModal(true);
                  } else {
                    onRequestPublishProduct();
                  }
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold min-h-[44px] whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Publicar producto</span>
              </button>
            </div>
          </div>

          {/* Incoming Orders (Seller Coordination) */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Pedidos recibidos en tu Microtienda ({sellerOrders.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Cuando un cliente pinche &ldquo;Concretar compra&rdquo;, coordina aquí la entrega o envío y el método
                  de pago.
                </p>
              </div>
            </div>

            {sellerOrders.length === 0 ? (
              <p className="text-sm text-slate-500 py-3">
                Aún no has recibido pedidos desde el carrito de tu microtienda.
              </p>
            ) : (
              <div className="space-y-4">
                {sellerOrders.map((order) => {
                  const draft = getCoordDraft(order);
                  const isTerminal = order.status === 'completed' || order.status === 'cancelled';
                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span
                              className={`font-semibold ${
                                order.status === 'pending_coordination'
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : order.status === 'coordinated'
                                    ? 'text-blue-700 dark:text-blue-400'
                                    : order.status === 'completed'
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-rose-600'
                              }`}
                            >
                              {STATUS_LABELS[order.status]}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>Cliente: {order.buyerName}</span>
                            <span aria-hidden="true">·</span>
                            <span>{order.buyerCommune}</span>
                          </div>
                          <p className="font-mono tabular-nums text-base font-extrabold text-slate-900 dark:text-white">
                            Total pedido: {formatCLP(order.totalCLP)}
                          </p>
                          <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                            {order.items.map((it) => (
                              <li key={it.productId}>
                                {it.quantity} × {it.title} ({formatCLP(it.priceCLP * it.quantity)})
                              </li>
                            ))}
                          </ul>
                          {order.buyerNote && (
                            <p className="text-xs text-slate-500 italic">Nota del cliente: {order.buyerNote}</p>
                          )}
                        </div>
                      </div>

                      {!isTerminal ? (
                        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3 border border-slate-200/80 dark:border-slate-700/60">
                          <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Truck className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                            <span>Coordinar entrega / envío y método de pago</span>
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Opción de entrega o envío
                              </label>
                              <select
                                value={draft.deliveryType}
                                onChange={(e) =>
                                  setCoordDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: {...draft, deliveryType: e.target.value as StoreDeliveryType},
                                  }))
                                }
                                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                              >
                                <option value="retiro_tienda">Retiro en tienda / punto de entrega</option>
                                <option value="despacho_domicilio">Despacho a domicilio (local)</option>
                                <option value="envio_encomienda">Envío por encomienda (Starken / Chilexpress)</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Método de pago
                              </label>
                              <select
                                value={draft.paymentMethod}
                                onChange={(e) =>
                                  setCoordDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: {...draft, paymentMethod: e.target.value as StorePaymentMethod},
                                  }))
                                }
                                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                              >
                                <option value="transferencia">Transferencia bancaria</option>
                                <option value="efectivo">Efectivo al entregar</option>
                                <option value="link_flow">Link de pago / Flow</option>
                                <option value="otro">Otro acuerdo directo</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Detalles de entrega / dirección / horario
                              </label>
                              <input
                                type="text"
                                value={draft.deliveryDetails}
                                onChange={(e) =>
                                  setCoordDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: {...draft, deliveryDetails: e.target.value},
                                  }))
                                }
                                placeholder="Ej. Retiro en Calle Blanco 210 de 10:00 a 18:00"
                                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Datos o instrucciones de pago
                              </label>
                              <input
                                type="text"
                                value={draft.paymentDetails}
                                onChange={(e) =>
                                  setCoordDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: {...draft, paymentDetails: e.target.value},
                                  }))
                                }
                                placeholder="Ej. Cuenta Vista BancoEstado o pago al recibir"
                                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => void handleCoordinateOrder(order, 'coordinated')}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold min-h-[40px]"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Enviar coordinación al cliente</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCoordinateOrder(order, 'completed')}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold min-h-[40px]"
                            >
                              <span>Marcar como completado</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCoordinateOrder(order, 'cancelled')}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs font-semibold min-h-[40px]"
                            >
                              <span>Cancelar pedido</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3">
                          <p>
                            Entrega: <strong>{DELIVERY_LABELS[order.deliveryType]}</strong>
                            {order.deliveryDetails ? ` — ${order.deliveryDetails}` : ''}
                          </p>
                          <p>
                            Pago: <strong>{PAYMENT_LABELS[order.paymentMethod]}</strong>
                            {order.paymentDetails ? ` — ${order.paymentDetails}` : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seller's Published Catalog inside Mi Microtienda */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Catálogo de mi Microtienda ({myProducts.length})
              </h3>
              {firebaseUser && (
                <button
                  type="button"
                  onClick={() => onSelectSellerId(firebaseUser.uid)}
                  className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                >
                  Ver como cliente
                </button>
              )}
            </div>

            {myProducts.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aún no tienes productos publicados en tu microtienda. Tienes 3 cupos gratis disponibles.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {myProducts.map((prod) => (
                  <div key={prod.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                        <SafeImage src={prod.imageUrl} alt={prod.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">
                          <span
                            className={
                              prod.status === 'active'
                                ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                : 'text-amber-700 font-semibold'
                            }
                          >
                            {prod.status === 'active' ? 'Activo' : 'Pausado'}
                          </span>{' '}
                          · {prod.category}
                        </p>
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{prod.title}</p>
                        <p className="font-mono tabular-nums text-xs font-bold text-blue-700 dark:text-blue-400">
                          {formatCLP(prod.priceCLP)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void onToggleProductStatus(prod)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold min-h-[36px]"
                      >
                        {prod.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{prod.status === 'active' ? 'Pausar' : 'Activar'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteProduct(prod.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs font-semibold min-h-[36px]"
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

          {/* Store Settings Form */}
          <form
            onSubmit={handleSaveMyStore}
            className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Personalizar datos de mi Microtienda</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold">Nombre de tu Microtienda</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Comuna</label>
                <select
                  value={storeCommuneField}
                  onChange={(e) => setStoreCommuneField(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
                >
                  {getRegionEntry(userAccount?.region).communes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Descripción de tu Microtienda</label>
              <textarea
                rows={2}
                value={storeDesc}
                onChange={(e) => setStoreDesc(e.target.value)}
                placeholder="Qué vendes, horarios de despacho y atención."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Rubro principal</label>
                <select
                  value={storeCategory}
                  onChange={(e) => setStoreCategory(e.target.value)}
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
                <label className="text-xs font-semibold">Opciones de entrega/envío</label>
                <input
                  type="text"
                  value={storeDeliveryText}
                  onChange={(e) => setStoreDeliveryText(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Métodos de pago aceptados</label>
                <input
                  type="text"
                  value={storePaymentText}
                  onChange={(e) => setStorePaymentText(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingStore}
              className="px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold min-h-[44px]"
            >
              {savingStore ? 'Guardando...' : 'Guardar Microtienda'}
            </button>
          </form>
        </div>
      )}

      {/* Buyer's Orders */}
      {subMode === 'my_orders' && !selectedSellerId && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Mis pedidos en Microtiendas ({buyerOrders.length})
          </h3>
          {buyerOrders.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aún no has concretado compras en ninguna microtienda. Explora las tiendas disponibles para agregar productos
              al carrito.
            </p>
          ) : (
            <div className="space-y-3">
              {buyerOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{ord.sellerName}</span>
                    <span
                      className={`font-semibold ${
                        ord.status === 'coordinated'
                          ? 'text-blue-700 dark:text-blue-400'
                          : ord.status === 'completed'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : ord.status === 'cancelled'
                              ? 'text-rose-600'
                              : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {STATUS_LABELS[ord.status]}
                    </span>
                  </div>
                  <ul className="text-slate-600 dark:text-slate-300 space-y-0.5">
                    {ord.items.map((it) => (
                      <li key={it.productId}>
                        {it.quantity} × {it.title} ({formatCLP(it.priceCLP * it.quantity)})
                      </li>
                    ))}
                  </ul>
                  <p className="font-mono tabular-nums font-bold text-blue-700 dark:text-blue-400">
                    Total: {formatCLP(ord.totalCLP)}
                  </p>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 space-y-1">
                    <p>
                      Entrega / Envío: <strong>{DELIVERY_LABELS[ord.deliveryType]}</strong>
                      {ord.deliveryDetails ? ` — ${ord.deliveryDetails}` : ''}
                    </p>
                    <p>
                      Método de pago: <strong>{PAYMENT_LABELS[ord.paymentMethod]}</strong>
                      {ord.paymentDetails ? ` — ${orderDetailsText(ord.paymentDetails)}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upgrade Quota Modal (+5 products for $9.990/month) */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Ampliar cuota de tu Microtienda
              </h3>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-4 space-y-1.5">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                Plan Mensual Microtienda · +5 nuevos productos
              </p>
              <p className="font-mono tabular-nums text-2xl font-extrabold text-slate-950 dark:text-white">
                {isPaymentExempt ? '$0 CLP / mes' : '$9.990 CLP / mes'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Tu cuota pasará de <strong>{maxProductsLimit}</strong> a{' '}
                <strong>{maxProductsLimit + 5} productos</strong> automáticamente al confirmarse el pago.
              </p>
            </div>

            {!isPaymentExempt && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUpgradeMethod('flow')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold min-h-[40px] ${
                      upgradeMethod === 'flow'
                        ? 'border-blue-700 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Pago en línea (Flow)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpgradeMethod('transfer')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold min-h-[40px] ${
                      upgradeMethod === 'transfer'
                        ? 'border-blue-700 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Transferencia bancaria
                  </button>
                </div>

                {upgradeMethod === 'transfer' && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Referencia o comprobante de transferencia
                    </label>
                    <input
                      type="text"
                      value={transferNote}
                      onChange={(e) => setTransferNote(e.target.value)}
                      placeholder="Ej. Comprobante #48219 BancoEstado"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>
                )}

                {upgradeFlowNotice && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                    {upgradeFlowNotice}
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              disabled={upgrading}
              onClick={() => void handleUpgradeQuota()}
              className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold min-h-[44px] disabled:opacity-60"
            >
              {upgrading
                ? 'Procesando...'
                : isPaymentExempt
                  ? 'Confirmar +5 productos ($0 CLP)'
                  : upgradeMethod === 'flow'
                    ? 'Pagar $9.990 CLP/mes con Flow'
                    : 'Registrar transferencia ($9.990 CLP/mes)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function orderDetailsText(val: string): string {
  return val;
}
