import React, {useEffect, useMemo, useState} from 'react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Monitor,
  Smartphone,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {useAuth} from '../../contexts/AuthContext';
import {useToast} from '../../contexts/ToastContext';
import {db, handleFirestoreError, OperationType} from '../../services/firebase/firebaseClient';
import {
  COMMERCIAL_CATEGORIES,
  DEFAULT_AD_PACKAGES,
  formatCLP,
  getRegionEntry,
  normalizeRegionName,
  REGIONS_CATALOG,
} from '../../services/config/chileCatalog';
import {
  getFlowGatewayStatus,
  initiateFlowPayment,
} from '../../services/payments/paymentService';
import {AdCampaign, AdPackage, AdvertiserAccount} from '../../types';
import {SafeImage} from '../../components/SafeImage';

const OBJECTIVES = [
  {id: 'emprendimiento', label: 'Dar a conocer un emprendimiento', tip: 'Destaca tu historia local y qué te hace único en tu comuna.'},
  {id: 'negocio', label: 'Promocionar un negocio', tip: 'Incluye horarios, ubicación clara y tu producto estrella.'},
  {id: 'productos', label: 'Ofrecer productos', tip: 'Menciona precio referencial o rango y modalidad de entrega.'},
  {id: 'servicios', label: 'Ofrecer servicios', tip: 'Especifica cobertura geográfica y tiempos de respuesta.'},
  {id: 'descuentos', label: 'Promocionar descuentos y ofertas', tip: 'Indica el porcentaje o monto de ahorro y vigencia de la oferta.'},
  {id: 'eventos', label: 'Difundir eventos o actividades', tip: 'Incluye fecha, lugar exacto y cómo reservar cupos.'},
  {id: 'clientes', label: 'Conseguir nuevos clientes', tip: 'Ofrece un beneficio claro de bienvenida para el primer contacto.'},
  {id: 'local', label: 'Aumentar visitas a un local comercial', tip: 'Usa dirección exacta y un llamado a la acción presencial.'},
  {id: 'turismo', label: 'Promocionar una actividad turística', tip: 'Muestra una fotografía atractiva del entorno y duración del tour.'},
];

const CTA_OPTIONS: {value: AdCampaign['ctaActionType']; label: string; placeholder: string}[] = [
  {value: 'visit_store', label: 'Visitar el negocio', placeholder: 'Ej. Calle Blanco 240, Castro'},
  {value: 'call', label: 'Llamar por teléfono', placeholder: 'Ej. +56 9 8765 4321'},
  {value: 'message', label: 'Enviar un mensaje', placeholder: 'Ej. WhatsApp o correo de atención'},
  {value: 'website', label: 'Visitar un sitio web', placeholder: 'Ej. https://minegocio.cl'},
  {value: 'map', label: 'Abrir ubicación en el mapa', placeholder: 'Ej. Plaza de Armas de Ancud'},
  {value: 'product', label: 'Consultar un producto o servicio', placeholder: 'Ej. Catálogo de temporada'},
  {value: 'promo', label: 'Conocer una promoción', placeholder: 'Ej. Código CHILOE15 en local'},
];

const GALLERY_PRESETS = [
  {label: 'Panadería y Café', url: '/src/assets/images/ad_local_bakery_1795023912080.jpg'},
  {label: 'Comercio Costero Chiloé', url: '/src/assets/images/hero_match_chiloe_1795023910594.jpg'},
  {label: 'Productos Agrícolas', url: '/src/assets/images/commercial_garlic_chilote_1795023911044.jpg'},
  {label: 'Artesanía y Lana', url: '/src/assets/images/commercial_wool_crafts_1795023911124.jpg'},
  {label: 'Turismo y Naturaleza', url: '/src/assets/images/commercial_tourism_kayak_1795023911666.jpg'},
];

interface CreateAdWizardProps {
  packages: AdPackage[];
  discountPercent: number;
  existingAdvertiser: AdvertiserAccount | null;
  editingCampaign?: AdCampaign | null;
  onComplete: () => void;
  onCancel: () => void;
}

export const CreateAdWizard: React.FC<CreateAdWizardProps> = ({
  packages,
  discountPercent,
  existingAdvertiser,
  editingCampaign,
  onComplete,
  onCancel,
}) => {
  const {firebaseUser, userAccount, isPaymentExempt} = useAuth();
  const {showToast} = useToast();

  const [step, setStep] = useState(1);
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [submitting, setSubmitting] = useState(false);
  const [flowAvailable, setFlowAvailable] = useState<{configured: boolean; environment: string}>({
    configured: false,
    environment: 'sandbox',
  });
  const [flowNotice, setFlowNotice] = useState<string | null>(null);

  // Step 1: Advertiser Identification
  const [advertiserType, setAdvertiserType] = useState<'external' | 'registered'>(
    existingAdvertiser?.advertiserType || (userAccount?.roles.includes('seller') ? 'registered' : 'external')
  );
  const [businessName, setBusinessName] = useState(
    editingCampaign?.businessName || existingAdvertiser?.businessName || ''
  );
  const [responsibleName, setResponsibleName] = useState(
    existingAdvertiser?.responsibleName || userAccount?.displayName || ''
  );
  const [category, setCategory] = useState(
    editingCampaign?.targetCategories[0] || existingAdvertiser?.category || COMMERCIAL_CATEGORIES[0]
  );
  const [bizDescription, setBizDescription] = useState(existingAdvertiser?.description || '');
  const [commune, setCommune] = useState(
    editingCampaign?.targetCommune || existingAdvertiser?.commune || userAccount?.commune || 'Castro'
  );
  const [region, setRegion] = useState(
    normalizeRegionName(editingCampaign?.targetRegion || existingAdvertiser?.region || userAccount?.region)
  );
  const [contactEmail, setContactEmail] = useState(
    existingAdvertiser?.contactEmail || userAccount?.email || ''
  );
  const [contactPhone, setContactPhone] = useState(existingAdvertiser?.contactPhone || '');
  const [website, setWebsite] = useState(existingAdvertiser?.website || '');

  // Step 2: Objective
  const [objective, setObjective] = useState(editingCampaign?.objective || OBJECTIVES[0].label);

  // Step 3: Content
  const [title, setTitle] = useState(editingCampaign?.title || '');
  const [description, setDescription] = useState(editingCampaign?.description || '');
  const [benefit, setBenefit] = useState(editingCampaign?.benefit || '');
  const [offerPriceText, setOfferPriceText] = useState(editingCampaign?.offerPriceText || '');
  const [ctaLabel, setCtaLabel] = useState(editingCampaign?.ctaLabel || 'Visitar el negocio');

  // Step 4: Visuals
  const [imageUrl, setImageUrl] = useState(editingCampaign?.imageUrl || GALLERY_PRESETS[0].url);
  const [logoUrl, setLogoUrl] = useState(editingCampaign?.logoUrl || '');

  // Step 5: Destination
  const [ctaActionType, setCtaActionType] = useState<AdCampaign['ctaActionType']>(
    editingCampaign?.ctaActionType || 'visit_store'
  );
  const [ctaDestination, setCtaDestination] = useState(editingCampaign?.ctaDestination || '');

  // Step 6: Segmentation
  const [targetScope, setTargetScope] = useState<'chiloe' | 'los_lagos' | 'chile'>(
    editingCampaign?.targetScope || 'chiloe'
  );
  const [targetSections, setTargetSections] = useState<('commercial' | 'employment' | 'general')[]>(
    editingCampaign?.targetSections || ['commercial', 'general']
  );
  const [targetAudienceNote, setTargetAudienceNote] = useState(editingCampaign?.targetAudienceNote || '');

  // Step 7: Package
  const activePackages = useMemo(
    () => (packages.length > 0 ? packages : DEFAULT_AD_PACKAGES).filter((p) => p.active),
    [packages]
  );
  const [selectedPackageId, setSelectedPackageId] = useState(
    editingCampaign?.packageId || activePackages[0]?.id || 'pkg_inicial'
  );

  // Step 9: Terms & Payment Method
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'flow' | 'transfer'>('flow');
  const [transferNote, setTransferNote] = useState('');

  useEffect(() => {
    void getFlowGatewayStatus().then((st) => setFlowAvailable(st));
  }, []);

  // Load saved draft if not editing an existing campaign
  useEffect(() => {
    if (!firebaseUser || editingCampaign) return;
    const draftRef = doc(db, 'adDrafts', `draft_${firebaseUser.uid}`);
    void getDoc(draftRef)
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as {step: number; payload: Record<string, unknown>};
          const p = data.payload || {};
          if (typeof p.businessName === 'string' && !businessName) setBusinessName(p.businessName);
          if (typeof p.title === 'string' && !title) setTitle(p.title);
          if (typeof p.description === 'string' && !description) setDescription(p.description);
          if (typeof p.benefit === 'string' && !benefit) setBenefit(p.benefit);
          if (typeof p.ctaDestination === 'string' && !ctaDestination) setCtaDestination(p.ctaDestination);
        }
      })
      .catch(() => {
        // Ignore missing draft
      });
  }, [firebaseUser, editingCampaign]);

  // Auto-save draft when advancing steps
  const saveDraft = async (nextStep: number) => {
    if (!firebaseUser) return;
    try {
      await setDoc(
        doc(db, 'adDrafts', `draft_${firebaseUser.uid}`),
        {
          ownerId: firebaseUser.uid,
          step: nextStep,
          payload: {
            businessName,
            responsibleName,
            category,
            commune,
            objective,
            title,
            description,
            benefit,
            offerPriceText,
            imageUrl,
            ctaActionType,
            ctaDestination,
            selectedPackageId,
          },
          updatedAt: serverTimestamp(),
        },
        {merge: true}
      );
    } catch {
      // Non-blocking draft save
    }
  };

  const selectedPkg = activePackages.find((p) => p.id === selectedPackageId) || activePackages[0];
  const effectiveDiscountPct = isPaymentExempt ? 100 : advertiserType === 'registered' ? discountPercent : 0;
  const discountAmount = isPaymentExempt
    ? selectedPkg.priceCLP
    : Math.round((selectedPkg.priceCLP * effectiveDiscountPct) / 100);
  const finalAmountCLP = isPaymentExempt ? 0 : Math.max(0, selectedPkg.priceCLP - discountAmount);

  // Client-side copy assistant (improves grammar/capitalization & suggests titles only on user click)
  const handleImproveTextHelper = () => {
    if (!title.trim()) {
      setTitle(`${businessName || 'Tu negocio'} en ${commune}: ${objective.toLowerCase()}`);
    } else {
      const cleaned = title.trim().replace(/\s+/g, ' ');
      setTitle(cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
    }
    if (description.trim()) {
      const cleanedDesc = description.trim().replace(/\s+/g, ' ');
      setDescription(cleanedDesc.charAt(0).toUpperCase() + cleanedDesc.slice(1) + (cleanedDesc.endsWith('.') ? '' : '.'));
    } else {
      setDescription(
        `Descubre ${businessName || 'nuestros servicios'} en ${commune}. Atención directa, calidad local y respuesta rápida.`
      );
    }
    showToast('Sugerencia aplicada para tu revisión. Puedes editarla libremente antes de publicar.', 'info');
  };

  const validateCurrentStep = (): boolean => {
    if (step === 1) {
      if (!businessName.trim() || !contactEmail.trim() || !contactPhone.trim()) {
        showToast('Completa el nombre del negocio, correo y teléfono de contacto.', 'error');
        return false;
      }
    }
    if (step === 3) {
      if (title.trim().length < 3 || description.trim().length < 10) {
        showToast('Escribe un título (mín. 3 caracteres) y una descripción clara para tu anuncio.', 'error');
        return false;
      }
    }
    if (step === 5 && !ctaDestination.trim()) {
      showToast('Indica el destino de contacto (dirección, teléfono, WhatsApp o URL).', 'error');
      return false;
    }
    if (step === 6 && targetSections.length === 0) {
      showToast('Selecciona al menos una sección de MATCH+ donde aparecerá el aviso.', 'error');
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!validateCurrentStep()) return;
    const next = Math.min(10, step + 1);
    setStep(next);
    void saveDraft(next);
  };

  const handleConfirmAndContract = async () => {
    if (!firebaseUser) {
      showToast('Inicia sesión para contratar y guardar tu campaña.', 'error');
      return;
    }
    if (!termsAccepted) {
      showToast('Debes aceptar las condiciones comerciales y revisión de contenido.', 'error');
      return;
    }

    setSubmitting(true);
    setFlowNotice(null);

    try {
      // 1. Ensure Advertiser document exists
      const advertiserId = existingAdvertiser?.id || `adv_${firebaseUser.uid}`;
      if (existingAdvertiser) {
        await updateDoc(doc(db, 'advertisers', advertiserId), {
          businessName: businessName.trim(),
          responsibleName: responsibleName.trim() || businessName.trim(),
          category,
          description: bizDescription.trim() || description.trim(),
          commune,
          region,
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          website: website.trim(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'advertisers', advertiserId), {
          ownerId: firebaseUser.uid,
          advertiserType,
          businessName: businessName.trim(),
          responsibleName: responsibleName.trim() || businessName.trim(),
          category,
          description: bizDescription.trim() || description.trim(),
          commune,
          region,
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          website: website.trim(),
          discountPercent: effectiveDiscountPct,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // 2. Create or update Campaign
      const startISO = new Date().toISOString().slice(0, 10);
      const endISO = new Date(Date.now() + selectedPkg.durationDays * 86400000).toISOString().slice(0, 10);
      const commerceOrder = `MP_${Date.now().toString().slice(-8)}_${firebaseUser.uid.slice(0, 5)}`;

      let campaignId = editingCampaign?.id || '';

      if (editingCampaign) {
        await updateDoc(doc(db, 'adCampaigns', editingCampaign.id), {
          title: title.trim(),
          description: description.trim(),
          benefit: benefit.trim() || 'Atención directa',
          offerPriceText: offerPriceText.trim(),
          ctaLabel: ctaLabel.trim(),
          ctaActionType,
          ctaDestination: ctaDestination.trim(),
          imageUrl: imageUrl.trim(),
          logoUrl: logoUrl.trim(),
          targetSections,
          targetCategories: [category],
          targetScope,
          targetCommune: commune,
          targetRegion: region,
          targetAudienceNote: targetAudienceNote.trim(),
          moderationStatus: isPaymentExempt ? 'active' : 'pending_review',
          updatedAt: serverTimestamp(),
        });
        campaignId = editingCampaign.id;
        showToast(
          isPaymentExempt ? 'Anuncio actualizado y activado sin costo.' : 'Anuncio corregido y reenviado a moderación.',
          'success'
        );
        setStep(10);
        setSubmitting(false);
        return;
      }

      const campRef = await addDoc(collection(db, 'adCampaigns'), {
        ownerId: firebaseUser.uid,
        advertiserId,
        advertiserType,
        businessName: businessName.trim(),
        objective,
        title: title.trim(),
        description: description.trim(),
        benefit: benefit.trim() || 'Atención personalizada',
        offerPriceText: offerPriceText.trim(),
        ctaLabel: ctaLabel.trim(),
        ctaActionType,
        ctaDestination: ctaDestination.trim(),
        imageUrl: imageUrl.trim(),
        logoUrl: logoUrl.trim(),
        targetSections,
        targetCategories: [category],
        targetScope,
        targetCommune: commune,
        targetRegion: region,
        targetAudienceNote: targetAudienceNote.trim(),
        packageId: selectedPkg.id,
        packageName: selectedPkg.name,
        durationDays: selectedPkg.durationDays,
        basePriceCLP: selectedPkg.priceCLP,
        discountCLP: discountAmount,
        finalAmountCLP,
        priorityWeight: selectedPkg.priorityWeight,
        startDate: startISO,
        endDate: endISO,
        paymentStatus: isPaymentExempt
          ? 'confirmed'
          : paymentMethod === 'transfer'
            ? 'pending_confirmation'
            : 'pending_payment',
        moderationStatus: isPaymentExempt ? 'active' : 'pending_review',
        impressionsCount: 0,
        clicksCount: 0,
        contactsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      campaignId = campRef.id;

      // 3. Create Payment Order record
      await addDoc(collection(db, 'adOrders'), {
        ownerId: firebaseUser.uid,
        campaignId,
        engine: 'advertising',
        orderType: 'ad_campaign',
        description: `${selectedPkg.name} — ${title.trim()}`,
        commerceOrder,
        amountCLP: finalAmountCLP,
        currency: 'CLP',
        paymentMethod: isPaymentExempt ? 'exempt' : paymentMethod,
        receiptNote: isPaymentExempt
          ? 'Cuenta habilitada libre de pago (100% bonificado)'
          : transferNote.trim() || (paymentMethod === 'flow' ? 'Orden generada para Flow' : 'Pendiente de comprobante'),
        status: isPaymentExempt
          ? 'confirmed'
          : paymentMethod === 'transfer'
            ? 'pending_confirmation'
            : 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 4. Bypass Flow for exempt accounts; otherwise initiate Flow or confirm transfer registration
      if (isPaymentExempt) {
        showToast('Campaña publicada sin costo (cuenta libre de pago).', 'success');
      } else if (paymentMethod === 'flow') {
        const flowResult = await initiateFlowPayment({
          commerceOrder,
          packageId: selectedPkg.id,
          isRegisteredAdvertiser: advertiserType === 'registered',
          email: contactEmail.trim(),
          subject: `MATCH+ ${selectedPkg.name} - ${businessName.trim()}`,
          customDiscountPercent: discountPercent,
        });

        if (flowResult.exempt) {
          showToast('Campaña confirmada sin costo (cuenta libre de pago).', 'success');
        } else if (flowResult.redirectUrl) {
          showToast('Redirigiendo a Flow para completar el pago seguro...', 'success');
          window.location.assign(flowResult.redirectUrl);
          return;
        } else {
          setFlowNotice(
            flowResult.instructions ||
              flowResult.error ||
              'La orden fue guardada en estado Pendiente de Pago. Configura FLOW_API_KEY y FLOW_SECRET_KEY o concilia por transferencia en Administración.'
          );
        }
      } else {
        showToast('Orden por transferencia registrada. Queda en revisión y validación administrativa.', 'success');
      }

      setStep(10);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'adCampaigns');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSection = (sec: 'commercial' | 'employment' | 'general') => {
    setTargetSections((prev) =>
      prev.includes(sec) ? prev.filter((s) => s !== sec) : [...prev, sec]
    );
  };

  const activeObjectiveTip = OBJECTIVES.find((o) => o.label === objective)?.tip;

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 space-y-6">
      {/* Wizard Progress Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            CREA TU ANUNCIO · Etapa {step} de 10
          </p>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
            {step === 1 && 'Identificación del anunciante'}
            {step === 2 && 'Objetivo de la publicidad'}
            {step === 3 && 'Elaboración del contenido'}
            {step === 4 && 'Imágenes y elementos visuales'}
            {step === 5 && 'Destino y contacto'}
            {step === 6 && 'Segmentación publicitaria'}
            {step === 7 && 'Selección del plan y duración'}
            {step === 8 && 'Vista previa del anuncio'}
            {step === 9 && 'Confirmación y contratación'}
            {step === 10 && 'Revisión y publicación'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white self-start sm:self-auto"
        >
          Volver a Mi Publicidad
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-blue-700 transition-all duration-300"
          style={{width: `${step * 10}%`}}
        />
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAdvertiserType('registered')}
              className={`p-4 rounded-2xl border text-left ${
                advertiserType === 'registered'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <p className="text-sm font-bold">Anunciante registrado en MATCH+</p>
              <p className="text-xs text-slate-500 mt-1">
                Integra tu tienda/empresa y obtén {discountPercent}% de descuento promocional.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setAdvertiserType('external')}
              className={`p-4 rounded-2xl border text-left ${
                advertiserType === 'external'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <p className="text-sm font-bold">Anunciante externo</p>
              <p className="text-xs text-slate-500 mt-1">
                Contrata publicidad directa sin registrarte como vendedor ni empresa laboral.
              </p>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Nombre del negocio o emprendimiento *</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ej. Cafetería Costanera"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Persona responsable</label>
              <input
                type="text"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Categoría de actividad</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
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
              <label className="text-xs font-semibold">Región</label>
              <select
                value={region}
                onChange={(e) => {
                  const nextReg = e.target.value;
                  setRegion(nextReg);
                  setCommune(getRegionEntry(nextReg).communes[0]);
                }}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
              >
                {REGIONS_CATALOG.map((r) => (
                  <option key={r.region} value={r.region}>
                    {r.region}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Comuna</label>
              <select
                value={commune}
                onChange={(e) => setCommune(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm"
              >
                {getRegionEntry(region).communes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Teléfono de contacto *</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+56 9..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Correo de contacto (para comprobantes Flow) *</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Sitio web o red social (opcional)</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            ¿Cuál es el objetivo principal de tu campaña?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {OBJECTIVES.map((obj) => (
              <button
                key={obj.id}
                type="button"
                onClick={() => setObjective(obj.label)}
                className={`p-3.5 rounded-xl border text-left text-sm font-medium flex items-center justify-between ${
                  objective === obj.label
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 font-semibold'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <span>{obj.label}</span>
                {objective === obj.label && <Check className="w-4 h-4 shrink-0" />}
              </button>
            ))}
          </div>
          {activeObjectiveTip && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3.5 text-xs text-amber-900 dark:text-amber-200">
              <strong>Recomendación:</strong> {activeObjectiveTip}
            </div>
          )}
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Redacta un mensaje claro y directo. No necesitas conocimientos de marketing.
            </p>
            <button
              type="button"
              onClick={handleImproveTextHelper}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-xs font-semibold shrink-0"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Mejorar redacción y título</span>
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">Título del anuncio *</label>
            <input
              type="text"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Pan de masa madre y café recién molido en el centro de Castro"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">Texto descriptivo *</label>
            <textarea
              rows={3}
              maxLength={600}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explica qué ofreces, dónde estás ubicado y por qué deberían elegirte."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Beneficio principal para el cliente</label>
              <input
                type="text"
                value={benefit}
                onChange={(e) => setBenefit(e.target.value)}
                placeholder="Ej. 15% de descuento en tu primera visita"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Precio u oferta (opcional)</label>
              <input
                type="text"
                value={offerPriceText}
                onChange={(e) => setOfferPriceText(e.target.value)}
                placeholder="Ej. Desde $2.500 CLP"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 4 */}
      {step === 4 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Elige una fotografía principal autorizada o ingresa la URL de tu imagen propia.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {GALLERY_PRESETS.map((g) => (
              <button
                key={g.url}
                type="button"
                onClick={() => setImageUrl(g.url)}
                className={`rounded-xl overflow-hidden border text-left ${
                  imageUrl === g.url ? 'border-blue-600 ring-2 ring-blue-600' : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="h-20">
                  <SafeImage src={g.url} alt={g.label} className="w-full h-full object-cover" />
                </div>
                <p className="p-1.5 text-[11px] font-medium truncate">{g.label}</p>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">URL de imagen principal</label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">URL de logotipo (opcional)</label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 5 */}
      {step === 5 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            ¿Qué acción realizará la persona cuando haga clic en tu anuncio?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {CTA_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setCtaActionType(opt.value);
                  setCtaLabel(opt.label);
                }}
                className={`p-3.5 rounded-xl border text-left text-sm font-medium ${
                  ctaActionType === opt.value
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 font-semibold'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Texto del botón</label>
              <input
                type="text"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Destino (Dirección, Teléfono o URL) *</label>
              <input
                type="text"
                value={ctaDestination}
                onChange={(e) => setCtaDestination(e.target.value)}
                placeholder={CTA_OPTIONS.find((o) => o.value === ctaActionType)?.placeholder}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 6 */}
      {step === 6 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {id: 'chiloe' as const, title: 'Chiloé (Piloto local)', desc: `Prioridad en ${commune} y comunas de Chiloé`},
              {id: 'los_lagos' as const, title: 'Región de Los Lagos', desc: 'Cobertura regional completa'},
              {id: 'chile' as const, title: 'Todo Chile', desc: 'Alcance nacional en expansión'},
            ].map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => setTargetScope(sc.id)}
                className={`p-4 rounded-2xl border text-left ${
                  targetScope === sc.id ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <p className="text-sm font-bold">{sc.title}</p>
                <p className="text-xs text-slate-500 mt-1">{sc.desc}</p>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold">Secciones donde aparecerá el aviso</label>
            <div className="flex flex-wrap gap-2.5">
              {[
                {id: 'commercial' as const, label: 'MATCH COMERCIAL'},
                {id: 'employment' as const, label: 'MATCH LABORAL'},
                {id: 'general' as const, label: 'Directorio de Destacados'},
              ].map((sec) => {
                const active = targetSections.includes(sec.id);
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => toggleSection(sec.id)}
                    className={`px-4 py-2 rounded-xl border text-xs font-semibold ${
                      active ? 'bg-blue-700 text-white border-blue-700' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {sec.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">Nota de público contextual (sin datos sensibles)</label>
            <input
              type="text"
              value={targetAudienceNote}
              onChange={(e) => setTargetAudienceNote(e.target.value)}
              placeholder="Ej. Personas interesadas en gastronomía local y turismo"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
          </div>
        </div>
      )}

      {/* Step 7 */}
      {step === 7 && (
        <div className="space-y-4">
          {isPaymentExempt ? (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 text-xs text-emerald-900 dark:text-emerald-200">
              <strong>Cuenta habilitada libre de pago:</strong> Tu correo está exento de cobros en MATCH+. Todos los
              planes publicitarios tienen valor <strong>$0 CLP</strong> (100% bonificado).
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Planes configurables desde administración. {advertiserType === 'registered' && `Tienes ${discountPercent}% de descuento de anunciante registrado.`}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activePackages.map((pkg) => {
              const selected = selectedPackageId === pkg.id;
              const disc = isPaymentExempt
                ? pkg.priceCLP
                : advertiserType === 'registered'
                  ? Math.round((pkg.priceCLP * discountPercent) / 100)
                  : 0;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedPackageId(pkg.id)}
                  className={`p-4 rounded-2xl border text-left space-y-2 ${
                    selected ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">{pkg.name}</span>
                    <span className="font-mono tabular-nums font-bold text-blue-700 dark:text-blue-400">
                      {isPaymentExempt && pkg.priceCLP > 0 && (
                        <span className="text-xs line-through text-slate-400 mr-2">{formatCLP(pkg.priceCLP)}</span>
                      )}
                      {formatCLP(Math.max(0, pkg.priceCLP - disc))}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Duración: {pkg.durationDays} días · Prioridad algoritmo: {pkg.priorityWeight}/100
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{pkg.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 8: Live Responsive Preview */}
      {step === 8 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Así verán tu aviso los usuarios dentro de MATCH+:
            </p>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setPreviewMode('mobile')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  previewMode === 'mobile' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Móvil</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('desktop')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  previewMode === 'desktop' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Computador</span>
              </button>
            </div>
          </div>

          <div className={previewMode === 'mobile' ? 'max-w-sm mx-auto' : 'w-full'}>
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-slate-950 overflow-hidden">
              <div className="px-4 py-2 border-b border-amber-200/60 dark:border-slate-800 text-xs font-semibold text-amber-800 dark:text-amber-400">
                Publicidad patrocinada · {businessName || 'Tu negocio'}
              </div>
              <div className={previewMode === 'mobile' ? 'block' : 'grid grid-cols-5'}>
                <div className={previewMode === 'mobile' ? 'h-48' : 'col-span-2 h-52'}>
                  <SafeImage src={imageUrl} alt={title || 'Vista previa'} className="w-full h-full object-cover" />
                </div>
                <div className={`${previewMode === 'mobile' ? '' : 'col-span-3'} p-5 space-y-2.5`}>
                  <p className="text-xs text-slate-500">
                    {category} · {commune} {offerPriceText ? `· ${offerPriceText}` : ''}
                  </p>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white">{title || 'Título de tu anuncio'}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
                  {benefit && <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Beneficio: {benefit}</p>}
                  <div className="pt-2">
                    <span className="inline-flex px-4 py-2 rounded-xl bg-slate-900 dark:bg-blue-700 text-white text-xs font-semibold">
                      {ctaLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 9: Confirmation & Flow Checkout */}
      {step === 9 && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 space-y-2 text-sm">
            <h3 className="font-bold text-slate-900 dark:text-white">Resumen de contratación</h3>
            <p>
              <strong>Anunciante:</strong> {businessName} ({advertiserType === 'registered' ? 'Registrado' : 'Externo'})
            </p>
            <p>
              <strong>Anuncio:</strong> {title}
            </p>
            <p>
              <strong>Segmentación:</strong> {targetScope.toUpperCase()} · {commune} · {category}
            </p>
            <p>
              <strong>Plan:</strong> {selectedPkg.name} ({selectedPkg.durationDays} días)
            </p>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 font-mono tabular-nums">
              <span>Valor base: {formatCLP(selectedPkg.priceCLP)}</span>
              {discountAmount > 0 && (
                <span className="text-emerald-600">
                  {isPaymentExempt ? 'Bonificación cuenta exenta (100%):' : 'Descuento:'} -{formatCLP(discountAmount)}
                </span>
              )}
              <span className="text-lg font-extrabold text-blue-700 dark:text-blue-400">
                Total: {formatCLP(finalAmountCLP)}
              </span>
            </div>
          </div>

          {isPaymentExempt ? (
            <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Cuenta habilitada libre de pago ($0 CLP)</span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300/90">
                Tu correo está exento de cobros en MATCH+. No necesitas pagar por Flow ni enviar comprobante de transferencia; tu campaña se activará directamente al confirmar.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('flow')}
                  className={`p-4 rounded-2xl border text-left ${
                    paymentMethod === 'flow' ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CreditCard className="w-4 h-4 text-blue-700" />
                    <span>Pagar en línea con Flow (Chile)</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Webpay, tarjetas o Servipag vía Flow ({flowAvailable.configured ? `Ambiente ${flowAvailable.environment} activo` : 'Requiere configurar API keys en servidor'}).
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('transfer')}
                  className={`p-4 rounded-2xl border text-left ${
                    paymentMethod === 'transfer' ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Orden de Pago / Transferencia Bancaria</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Registra tu orden y número de comprobante para conciliación y activación administrativa.
                  </p>
                </button>
              </div>

              {paymentMethod === 'transfer' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Referencia o número de transferencia</label>
                  <input
                    type="text"
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    placeholder="Ej. Comprobante BancoEstado #442190"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                  />
                </div>
              )}
            </>
          )}

          <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-blue-700"
            />
            <span>
              {isPaymentExempt
                ? 'Acepto las condiciones de publicación y normas de contenido de MATCH+. Esta campaña se emitirá sin costo ($0 CLP).'
                : 'Acepto las condiciones de contratación publicitaria: los anuncios pasan por moderación de contenido y verificación de pago en el servidor antes de activarse en la rotación.'}
            </span>
          </label>
        </div>
      )}

      {/* Step 10 */}
      {step === 10 && (
        <div className="py-4 space-y-4 text-center max-w-lg mx-auto">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            {isPaymentExempt ? 'Anuncio activado sin costo' : 'Solicitud y anuncio registrados'}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {isPaymentExempt ? (
              <>
                Tu cuenta está habilitada libre de pago. La orden quedó confirmada por <strong>$0 CLP</strong> y tu
                campaña ya está <strong>activa</strong> en el motor rotativo de MATCH+.
              </>
            ) : (
              <>
                Tu campaña quedó guardada en <strong>Pendiente de revisión</strong>. Una vez validado el pago y
                aprobada por moderación, ingresará automáticamente al motor rotativo de MATCH+.
              </>
            )}
          </p>
          {flowNotice && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3.5 text-xs text-amber-900 dark:text-amber-200 text-left">
              {flowNotice}
            </div>
          )}
          <button
            type="button"
            onClick={onComplete}
            className="px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold min-h-[44px]"
          >
            Ir a MI PUBLICIDAD
          </button>
        </div>
      )}

      {/* Footer Navigation */}
      {step < 10 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep(step - 1) : onCancel())}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{step === 1 ? 'Cancelar' : 'Anterior'}</span>
          </button>

          {step < 9 ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold min-h-[44px]"
            >
              <span>Siguiente</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirmAndContract}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold min-h-[44px] disabled:opacity-60"
            >
              <span>{submitting ? 'Procesando...' : editingCampaign ? 'Reenviar a moderación' : 'Confirmar y contratar'}</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
