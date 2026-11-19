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
  Briefcase,
  Building2,
  CheckCircle2,
  Eye,
  FileText,
  Flag,
  HeartHandshake,
  Lock,
  Pause,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {useAuth} from '../../contexts/AuthContext';
import {useToast} from '../../contexts/ToastContext';
import {db, handleFirestoreError, OperationType} from '../../services/firebase/firebaseClient';
import {
  DEMO_ADS,
  DEMO_VACANCIES,
  DEMO_WORKERS,
  formatCLP,
  getRegionEntry,
  LABOR_CATEGORIES,
  normalizeRegionName,
} from '../../services/config/chileCatalog';
import {computeJobCompatibility} from '../../services/matching/matchingEngine';
import {scoreAndRankAds, shouldShowAdAtOrganicIndex} from '../../services/advertising/adRotationEngine';
import {
  AdCampaign,
  AdRotationConfig,
  CompanyProfile,
  JobVacancy,
  MatchRecord,
  WorkerPrivateCV,
  WorkerProfile,
} from '../../types';
import {SwipeCardDeck, SwipeDeckItem} from '../../components/SwipeCardDeck';
import {AdBannerCard} from '../../components/AdBannerCard';

interface EmploymentModuleProps {
  onMatchCreated: (match: MatchRecord) => void;
  rotationConfig: AdRotationConfig;
  initialTab?: 'explore_jobs' | 'my_publications';
}

interface RawEmploymentInteraction {
  id: string;
  fromUid: string;
  toUid: string;
  targetId: string;
  targetKind: 'vacancy' | 'worker';
  action: 'like' | 'pass' | 'favorite';
  compatibilityScore?: number;
}

export const EmploymentModule: React.FC<EmploymentModuleProps> = ({
  onMatchCreated,
  rotationConfig,
  initialTab,
}) => {
  const {firebaseUser, userAccount} = useAuth();
  const {showToast} = useToast();

  const [tab, setTab] = useState<'explore_jobs' | 'explore_workers' | 'worker_profile' | 'publish_job' | 'my_publications' | 'company_profile' | 'candidates_interest'>(initialTab || 'explore_jobs');
  const [viewMode, setViewMode] = useState<'tinder' | 'list'>('tinder');
  const [includeDemo, setIncludeDemo] = useState(true);

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);

  const [vacancies, setVacancies] = useState<JobVacancy[]>([]);
  const [myVacancies, setMyVacancies] = useState<JobVacancy[]>([]);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [myWorkerProfile, setMyWorkerProfile] = useState<WorkerProfile | null>(null);
  const [myCompany, setMyCompany] = useState<CompanyProfile | null>(null);
  const [myInteractions, setMyInteractions] = useState<RawEmploymentInteraction[]>([]);
  const [receivedInteractions, setReceivedInteractions] = useState<RawEmploymentInteraction[]>([]);
  const [activeAds, setActiveAds] = useState<AdCampaign[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [filterModality, setFilterModality] = useState<'todas' | 'presencial' | 'remoto' | 'hibrido'>('todas');
  const [filterCommune, setFilterCommune] = useState('Todas');

  // Detail & Report
  const [detailVacancy, setDetailVacancy] = useState<JobVacancy | null>(null);
  const [reportTarget, setReportTarget] = useState<{id: string; title: string} | null>(null);
  const [reportReason, setReportReason] = useState('Oferta laboral engañosa');
  const [reportDetails, setReportDetails] = useState('');

  // Ad rotation state
  const [sessionId] = useState(() => `sess_emp_${Date.now()}`);
  const [viewedCount, setViewedCount] = useState(0);
  const [postsSinceAd, setPostsSinceAd] = useState(0);
  const [adsShown, setAdsShown] = useState(0);
  const [advertiserCounts, setAdvertiserCounts] = useState<Record<string, number>>({});
  const [hiddenAdIds, setHiddenAdIds] = useState<string[]>([]);
  const [currentAd, setCurrentAd] = useState<AdCampaign | null>(null);

  // Worker Form States
  const [wName, setWName] = useState(userAccount?.displayName || '');
  const [wHeadline, setWHeadline] = useState('');
  const [wProfession, setWProfession] = useState('');
  const [wSkillsText, setWSkillsText] = useState('Atención al cliente, Comunicación');
  const [wExpYears, setWExpYears] = useState('2');
  const [wExpSummary, setWExpSummary] = useState('');
  const [wEducation, setWEducation] = useState<WorkerProfile['educationLevel']>('Media');
  const [wCommune, setWCommune] = useState(userAccount?.commune || 'Castro');
  const [wModality, setWModality] = useState<WorkerProfile['modality']>('presencial');
  const [wSchedule, setWSchedule] = useState<WorkerProfile['preferredSchedule']>('completa');
  const [wAvail, setWAvail] = useState<WorkerProfile['availability']>('inmediata');
  const [wSalary, setWSalary] = useState('750000');
  const [wShowSalary, setWShowSalary] = useState(true);
  const [wDirectContact, setWDirectContact] = useState(true);
  // Private CV fields (stored in workerPrivateCVs)
  const [cvFullSummary, setCvFullSummary] = useState('');
  const [cvEmail, setCvEmail] = useState(userAccount?.email || '');
  const [cvPhone, setCvPhone] = useState('');

  // Company Form States
  const [cLegalName, setCLegalName] = useState('');
  const [cCommName, setCCommName] = useState('');
  const [cTaxId, setCTaxId] = useState('');
  const [cSector, setCSector] = useState(LABOR_CATEGORIES[0]);
  const [cDesc, setCDesc] = useState('');
  const [cCommune, setCCommune] = useState(userAccount?.commune || 'Castro');
  const [cContact, setCContact] = useState('');
  const [cWebsite, setCWebsite] = useState('');

  // Job Vacancy Form States
  const [jTitle, setJTitle] = useState('');
  const [jDesc, setJDesc] = useState('');
  const [jResp, setJResp] = useState('');
  const [jMandSkills, setJMandSkills] = useState('');
  const [jDesSkills, setJDesSkills] = useState('');
  const [jMinExp, setJMinExp] = useState('1');
  const [jReqEdu, setJReqEdu] = useState<JobVacancy['requiredEducation']>('Media');
  const [jCat, setJCat] = useState(LABOR_CATEGORIES[0]);
  const [jCommune, setJCommune] = useState(userAccount?.commune || 'Castro');
  const [jModality, setJModality] = useState<JobVacancy['modality']>('presencial');
  const [jSchedule, setJSchedule] = useState<JobVacancy['schedule']>('completa');
  const [jContract, setJContract] = useState<JobVacancy['contractType']>('indefinido');
  const [jSalMin, setJSalMin] = useState('650000');
  const [jSalMax, setJSalMax] = useState('850000');

  useEffect(() => {
    const unsubVac = onSnapshot(
      query(collection(db, 'jobVacancies'), where('status', '==', 'active')),
      (snap) => setVacancies(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<JobVacancy, 'id'>)}))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'jobVacancies')
    );
    const unsubWorkers = onSnapshot(
      query(collection(db, 'workerProfiles'), where('status', '==', 'active')),
      (snap) => setWorkers(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<WorkerProfile, 'id'>)}))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'workerProfiles')
    );
    const unsubAds = onSnapshot(
      query(collection(db, 'adCampaigns'), where('moderationStatus', '==', 'active')),
      (snap) => setActiveAds(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<AdCampaign, 'id'>)}))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'adCampaigns')
    );

    return () => {
      unsubVac();
      unsubWorkers();
      unsubAds();
    };
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubMyWorker = onSnapshot(
      query(collection(db, 'workerProfiles'), where('ownerId', '==', firebaseUser.uid)),
      (snap) => {
        if (!snap.empty) {
          const d = snap.docs[0];
          const data = d.data() as Omit<WorkerProfile, 'id'>;
          setMyWorkerProfile({id: d.id, ...data});
          setWName(data.displayName);
          setWHeadline(data.headline);
          setWProfession(data.profession);
          setWSkillsText(data.skills.join(', '));
          setWExpYears(String(data.experienceYears));
          setWExpSummary(data.experienceSummary || '');
          setWEducation(data.educationLevel);
          setWCommune(data.commune);
          setWModality(data.modality);
          setWSchedule(data.preferredSchedule);
          setWAvail(data.availability);
          setWSalary(String(data.salaryExpectationCLP));
          setWShowSalary(data.showSalaryExpectation);
          setWDirectContact(data.allowDirectContact);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'workerProfiles')
    );

    const unsubMyCV = onSnapshot(
      query(collection(db, 'workerPrivateCVs'), where('ownerId', '==', firebaseUser.uid)),
      (snap) => {
        if (!snap.empty) {
          const data = snap.docs[0].data() as WorkerPrivateCV;
          setCvFullSummary(data.fullSummary || '');
          setCvEmail(data.contactEmail || '');
          setCvPhone(data.contactPhone || '');
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'workerPrivateCVs')
    );

    const unsubMyComp = onSnapshot(
      query(collection(db, 'companies'), where('ownerId', '==', firebaseUser.uid)),
      (snap) => {
        if (!snap.empty) {
          const d = snap.docs[0];
          const data = d.data() as Omit<CompanyProfile, 'id'>;
          setMyCompany({id: d.id, ...data});
          setCLegalName(data.legalName);
          setCCommName(data.commercialName);
          setCTaxId(data.taxId || '');
          setCSector(data.sector);
          setCDesc(data.description);
          setCCommune(data.commune);
          setCContact(data.contactInfo);
          setCWebsite(data.website || '');
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'companies')
    );

    const unsubOut = onSnapshot(
      query(collection(db, 'employmentInteractions'), where('fromUid', '==', firebaseUser.uid)),
      (snap) => setMyInteractions(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<RawEmploymentInteraction, 'id'>)}))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'employmentInteractions')
    );

    const unsubIn = onSnapshot(
      query(collection(db, 'employmentInteractions'), where('toUid', '==', firebaseUser.uid)),
      (snap) => setReceivedInteractions(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<RawEmploymentInteraction, 'id'>)}))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'employmentInteractions')
    );

    const unsubMyVacs = onSnapshot(
      query(collection(db, 'jobVacancies'), where('ownerId', '==', firebaseUser.uid)),
      (snap) => setMyVacancies(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<JobVacancy, 'id'>)}))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'jobVacancies')
    );

    return () => {
      unsubMyWorker();
      unsubMyCV();
      unsubMyComp();
      unsubOut();
      unsubIn();
      unsubMyVacs();
    };
  }, [firebaseUser]);

  const allVacancies = useMemo(() => (includeDemo ? [...vacancies, ...DEMO_VACANCIES] : vacancies), [vacancies, includeDemo]);
  const allWorkers = useMemo(() => (includeDemo ? [...workers, ...DEMO_WORKERS] : workers), [workers, includeDemo]);
  const allAds = useMemo(() => (includeDemo ? [...activeAds, ...DEMO_ADS] : activeAds), [activeAds, includeDemo]);

  // Reference profile for live compatibility scoring (worker's saved profile or form draft)
  const effectiveWorkerProfile: WorkerProfile = useMemo(() => {
    if (myWorkerProfile) return myWorkerProfile;
    return {
      id: 'temp',
      ownerId: firebaseUser?.uid || 'anon',
      displayName: wName || 'Candidato',
      headline: wHeadline || 'Buscando oportunidades',
      profession: wProfession || 'General',
      trades: [],
      skills: wSkillsText.split(',').map((s) => s.trim()).filter(Boolean),
      experienceYears: Number(wExpYears) || 0,
      experienceSummary: wExpSummary,
      educationLevel: wEducation,
      certifications: [],
      commune: wCommune,
      region: normalizeRegionName(userAccount?.region),
      availability: wAvail,
      preferredSchedule: wSchedule,
      modality: wModality,
      employmentType: 'Indefinido',
      salaryExpectationCLP: Number(wSalary) || 0,
      showSalaryExpectation: wShowSalary,
      allowDirectContact: wDirectContact,
      status: 'active',
    };
  }, [myWorkerProfile, firebaseUser?.uid, wName, wHeadline, wProfession, wSkillsText, wExpYears, wExpSummary, wEducation, wCommune, userAccount?.region, wAvail, wSchedule, wModality, wSalary, wShowSalary, wDirectContact]);

  const filteredVacancies = useMemo(() => {
    return allVacancies
      .filter((v) => {
        if (filterCategory !== 'Todas' && v.category !== filterCategory) return false;
        if (filterModality !== 'todas' && v.modality !== filterModality) return false;
        if (filterCommune !== 'Todas' && v.commune !== filterCommune) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (
            !v.title.toLowerCase().includes(q) &&
            !v.companyName.toLowerCase().includes(q) &&
            !v.description.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      })
      .map((v) => ({
        vacancy: v,
        compatibility: computeJobCompatibility(effectiveWorkerProfile, v),
      }))
      .sort((a, b) => b.compatibility.score - a.compatibility.score);
  }, [allVacancies, filterCategory, filterModality, filterCommune, searchQuery, effectiveWorkerProfile]);

  const interactedIds = useMemo(
    () => new Set(myInteractions.filter((i) => i.action !== 'favorite').map((i) => i.targetId)),
    [myInteractions]
  );

  const deckItems: SwipeDeckItem[] = useMemo(() => {
    if (tab === 'explore_workers') {
      return allWorkers
        .filter((w) => !interactedIds.has(w.id) && w.ownerId !== firebaseUser?.uid)
        .map((w) => ({
          id: w.id,
          title: w.displayName,
          subtitle: `${w.profession} · ${w.experienceYears} años exp.`,
          priceOrScoreLabel: w.showSalaryExpectation ? formatCLP(w.salaryExpectationCLP) : 'Renta reservada',
          description: w.headline + (w.experienceSummary ? ` — ${w.experienceSummary}` : ''),
          locationLabel: `${w.commune} · ${w.modality}`,
          metaLine: `Habilidades: ${w.skills.slice(0, 4).join(', ')}`,
          isDemo: w.isDemo,
        }));
    }

    return filteredVacancies
      .filter(({vacancy}) => !interactedIds.has(vacancy.id) && vacancy.ownerId !== firebaseUser?.uid)
      .map(({vacancy, compatibility}) => ({
        id: vacancy.id,
        title: vacancy.title,
        subtitle: `${vacancy.companyName} · ${vacancy.contractType.replace('_', ' ')}`,
        priceOrScoreLabel: `${compatibility.score}% compatible`,
        description: `${compatibility.explanation} ${vacancy.description}`,
        locationLabel: `${vacancy.commune} · ${vacancy.modality}`,
        metaLine: `Renta: ${formatCLP(vacancy.salaryMinCLP)} - ${formatCLP(vacancy.salaryMaxCLP)}`,
        verified: vacancy.verified,
        isDemo: vacancy.isDemo,
      }));
  }, [tab, allWorkers, filteredVacancies, interactedIds, firebaseUser?.uid]);

  const advanceAdRotation = () => {
    const nextViewed = viewedCount + 1;
    const nextSince = postsSinceAd + 1;
    setViewedCount(nextViewed);

    if (shouldShowAdAtOrganicIndex(nextViewed, adsShown, nextSince, rotationConfig)) {
      const ranked = scoreAndRankAds(
        allAds,
        {
          section: 'employment',
          activeCategory: filterCategory !== 'Todas' ? filterCategory : undefined,
          userCommune: userAccount?.commune,
          userRegion: userAccount?.region,
          hiddenAdIds,
        },
        advertiserCounts,
        rotationConfig
      );
      if (ranked.length > 0) {
        const chosen = ranked[0].campaign;
        setCurrentAd(chosen);
        setAdsShown((c) => c + 1);
        setPostsSinceAd(0);
        setAdvertiserCounts((prev) => ({
          ...prev,
          [chosen.advertiserId]: (prev[chosen.advertiserId] || 0) + 1,
        }));
        return;
      }
    }
    setPostsSinceAd(nextSince);
  };

  const createRealEmploymentMatch = async (
    recipientUid: string,
    recipientName: string,
    targetId: string,
    targetTitle: string,
    compatScore?: number,
    compatExp?: string
  ) => {
    if (!firebaseUser) return;
    const pair = [firebaseUser.uid, recipientUid].sort();
    const matchId = `m_emp_${pair[0]}_${pair[1]}_${targetId}`.slice(0, 120);
    const convId = `c_${matchId}`;

    const payload: Omit<MatchRecord, 'id'> = {
      module: 'employment',
      participantIds: pair,
      initiatorUid: firebaseUser.uid,
      recipientUid,
      initiatorName: userAccount?.displayName || firebaseUser.displayName || 'Usuario',
      recipientName,
      targetId,
      targetTitle,
      ...(typeof compatScore === 'number' ? {compatibilityScore: compatScore} : {}),
      ...(compatExp ? {compatibilityExplanation: compatExp} : {}),
      status: 'active',
    };

    try {
      await setDoc(doc(db, 'matches', matchId), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'conversations', convId), {
        matchId,
        module: 'employment',
        participantIds: pair,
        participantNames: {
          [firebaseUser.uid]: userAccount?.displayName || firebaseUser.displayName || 'Usuario',
          [recipientUid]: recipientName,
        },
        targetTitle,
        lastMessage: 'Coincidencia laboral confirmada. Ya pueden coordinar entrevista o detalles.',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'notifications'), {
        userId: recipientUid,
        type: 'new_match',
        title: 'Nuevo MATCH Laboral',
        body: `Coincidencia mutua confirmada para "${targetTitle}".`,
        module: 'employment',
        relatedId: matchId,
        read: false,
        createdAt: serverTimestamp(),
      });
      onMatchCreated({id: matchId, ...payload});
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `matches/${matchId}`);
    }
  };

  const handleSwipeAction = async (item: SwipeDeckItem, action: 'like' | 'pass' | 'favorite') => {
    advanceAdRotation();
    if (!firebaseUser) {
      showToast('Inicia sesión para postular o contactar candidatos.', 'info');
      return;
    }

    const isWorkerExplore = tab === 'explore_workers';
    const target = isWorkerExplore
      ? allWorkers.find((w) => w.id === item.id)
      : allVacancies.find((v) => v.id === item.id);
    if (!target) return;

    if (item.isDemo) {
      if (action === 'like') {
        showToast('Elemento de demostración: para matches reales interactúa con cuentas registradas.', 'info');
      }
      setMyInteractions((prev) => [
        ...prev,
        {
          id: `local_${item.id}`,
          fromUid: firebaseUser.uid,
          toUid: target.ownerId,
          targetId: item.id,
          targetKind: isWorkerExplore ? 'worker' : 'vacancy',
          action,
        },
      ]);
      return;
    }

    const interactionId = `ei_${firebaseUser.uid}_${item.id}_${action}`.slice(0, 120);
    const compat = !isWorkerExplore
      ? computeJobCompatibility(effectiveWorkerProfile, target as JobVacancy)
      : null;

    try {
      if (!myInteractions.some((i) => i.id === interactionId)) {
        await setDoc(doc(db, 'employmentInteractions', interactionId), {
          fromUid: firebaseUser.uid,
          toUid: target.ownerId,
          targetId: item.id,
          targetKind: isWorkerExplore ? 'worker' : 'vacancy',
          action,
          ...(compat ? {compatibilityScore: compat.score} : {}),
          createdAt: serverTimestamp(),
        });
      }

      if (action === 'favorite') {
        showToast('Guardado en favoritos laborales.', 'success');
        return;
      }

      if (action === 'like') {
        await addDoc(collection(db, 'notifications'), {
          userId: target.ownerId,
          type: isWorkerExplore ? 'company_response' : 'compatible_vacancy',
          title: isWorkerExplore ? 'Empresa interesada en tu perfil' : 'Nueva postulación compatible',
          body: `${userAccount?.displayName || 'Un usuario'} mostró interés en "${item.title}".`,
          module: 'employment',
          relatedId: item.id,
          read: false,
          createdAt: serverTimestamp(),
        });

        const reciprocal = receivedInteractions.find(
          (ri) => ri.fromUid === target.ownerId && ri.action === 'like'
        );
        if (reciprocal) {
          const name = isWorkerExplore
            ? (target as WorkerProfile).displayName
            : (target as JobVacancy).companyName;
          await createRealEmploymentMatch(
            target.ownerId,
            name,
            item.id,
            item.title,
            compat?.score,
            compat?.explanation
          );
        } else {
          showToast('Interés enviado. Si hay coincidencia mutua, se habilitará el chat privado.', 'success');
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `employmentInteractions/${interactionId}`);
    }
  };

  const handleSaveWorkerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const pubId = myWorkerProfile?.id || `wrk_${firebaseUser.uid}`;
    const skillsArr = wSkillsText.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20);

    try {
      await setDoc(
        doc(db, 'workerProfiles', pubId),
        {
          ownerId: firebaseUser.uid,
          displayName: wName.trim() || userAccount?.displayName || 'Trabajador',
          headline: wHeadline.trim(),
          profession: wProfession.trim(),
          trades: skillsArr.slice(0, 5),
          skills: skillsArr.length > 0 ? skillsArr : ['Responsabilidad'],
          experienceYears: Number(wExpYears) || 0,
          experienceSummary: wExpSummary.trim(),
          educationLevel: wEducation,
          certifications: [],
          commune: wCommune,
          region: normalizeRegionName(userAccount?.region),
          availability: wAvail,
          preferredSchedule: wSchedule,
          modality: wModality,
          employmentType: 'Indefinido / Obra',
          salaryExpectationCLP: Number(wSalary) || 0,
          showSalaryExpectation: wShowSalary,
          allowDirectContact: wDirectContact,
          status: 'active',
          createdAt: myWorkerProfile?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        {merge: true}
      );

      // Private CV stored strictly in isolated collection
      await setDoc(
        doc(db, 'workerPrivateCVs', pubId),
        {
          ownerId: firebaseUser.uid,
          fullSummary: cvFullSummary.trim() || wExpSummary.trim(),
          contactEmail: cvEmail.trim() || firebaseUser.email || '',
          contactPhone: cvPhone.trim(),
          updatedAt: serverTimestamp(),
        },
        {merge: true}
      );

      showToast('Perfil profesional y currículum protegido guardados.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workerProfiles/${pubId}`);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const compId = myCompany?.id || `comp_${firebaseUser.uid}`;
    try {
      await setDoc(
        doc(db, 'companies', compId),
        {
          ownerId: firebaseUser.uid,
          legalName: cLegalName.trim(),
          commercialName: cCommName.trim() || cLegalName.trim(),
          taxId: cTaxId.trim(),
          description: cDesc.trim(),
          sector: cSector,
          commune: cCommune,
          region: normalizeRegionName(userAccount?.region),
          contactInfo: cContact.trim(),
          website: cWebsite.trim(),
          verified: myCompany?.verified || false,
          status: 'active',
          createdAt: myCompany?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        {merge: true}
      );
      showToast('Perfil de empresa guardado.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `companies/${compId}`);
    }
  };

  const handlePublishJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const salMin = Number(jSalMin) || 0;
    const salMax = Math.max(salMin, Number(jSalMax) || salMin);
    try {
      await addDoc(collection(db, 'jobVacancies'), {
        ownerId: firebaseUser.uid,
        companyId: myCompany?.id || '',
        companyName: myCompany?.commercialName || userAccount?.displayName || 'Empresa local',
        title: jTitle.trim(),
        description: jDesc.trim(),
        responsibilities: jResp.trim(),
        requirements: jMandSkills.trim(),
        mandatorySkills: jMandSkills.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 15),
        desiredSkills: jDesSkills.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 15),
        minExperienceYears: Number(jMinExp) || 0,
        requiredEducation: jReqEdu,
        category: jCat,
        commune: jCommune,
        region: normalizeRegionName(userAccount?.region),
        modality: jModality,
        schedule: jSchedule,
        contractType: jContract,
        salaryMinCLP: salMin,
        salaryMaxCLP: salMax,
        startDate: new Date().toISOString().slice(0, 10),
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        verified: false,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Vacante laboral publicada.', 'success');
      setJTitle('');
      setJDesc('');
      setTab('explore_jobs');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'jobVacancies');
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !reportTarget) return;
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: firebaseUser.uid,
        targetType: 'vacancy',
        targetId: reportTarget.id,
        module: 'employment',
        reason: reportReason,
        details: reportDetails.trim() || 'Reporte laboral',
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Denuncia registrada para revisión inmediata.', 'success');
      setReportTarget(null);
      setReportDetails('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reports');
    }
  };

  const handleToggleVacancyStatus = async (vac: JobVacancy) => {
    const nextStatus = vac.status === 'active' ? 'paused' : 'active';
    try {
      await updateDoc(doc(db, 'jobVacancies', vac.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(nextStatus === 'paused' ? 'Vacante pausada.' : 'Vacante reactivada.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `jobVacancies/${vac.id}`);
    }
  };

  const handleDeleteVacancy = async (vacId: string) => {
    try {
      await deleteDoc(doc(db, 'jobVacancies', vacId));
      showToast('Vacante eliminada.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `jobVacancies/${vacId}`);
    }
  };

  const handleToggleWorkerStatus = async (worker: WorkerProfile) => {
    const nextStatus = worker.status === 'active' ? 'paused' : 'active';
    try {
      await updateDoc(doc(db, 'workerProfiles', worker.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(
        nextStatus === 'paused' ? 'Perfil laboral ocultado de búsquedas.' : 'Perfil laboral activado.',
        'success'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `workerProfiles/${worker.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">MATCH LABORAL</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Empleo y contratación bidireccional gratuita para trabajadores, con compatibilidad explicable y sin
            discriminación.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setTab('my_publications')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 min-h-[40px] whitespace-nowrap"
          >
            <FileText className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>Ver mis publicaciones ({myVacancies.length + (myWorkerProfile ? 1 : 0)})</span>
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

      {/* Equal Opportunity Guarantee */}
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3 flex items-center gap-3 text-xs text-emerald-900 dark:text-emerald-200">
        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
        <span>
          <strong>Igualdad de oportunidades:</strong> El algoritmo evalúa únicamente habilidades, experiencia,
          disponibilidad, ubicación y renta. Tu currículum y datos de contacto permanecen protegidos.
        </span>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          {id: 'explore_jobs' as const, label: 'Explorar Vacantes', icon: <Briefcase className="w-4 h-4" />},
          {id: 'explore_workers' as const, label: 'Explorar Candidatos', icon: <UserCheck className="w-4 h-4" />},
          {id: 'worker_profile' as const, label: 'Mi Perfil Laboral y CV', icon: <Lock className="w-4 h-4" />},
          {id: 'publish_job' as const, label: 'Publicar Vacante', icon: <Plus className="w-4 h-4" />},
          {
            id: 'my_publications' as const,
            label: `Mis publicaciones (${myVacancies.length + (myWorkerProfile ? 1 : 0)})`,
            icon: <FileText className="w-4 h-4" />,
          },
          {id: 'company_profile' as const, label: 'Perfil de Empresa', icon: <Building2 className="w-4 h-4" />},
          {
            id: 'candidates_interest' as const,
            label: `Intereses (${receivedInteractions.filter((i) => i.action === 'like').length})`,
            icon: <HeartHandshake className="w-4 h-4" />,
          },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap min-h-[40px] ${
              tab === t.id
                ? 'bg-emerald-700 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {(tab === 'explore_jobs' || tab === 'explore_workers') && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar cargo, empresa o habilidad..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('tinder')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    viewMode === 'tinder' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Tarjetas
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    viewMode === 'list' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Listado con %
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              >
                <option value="Todas">Todas las áreas laborales</option>
                {LABOR_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={filterModality}
                onChange={(e) => setFilterModality(e.target.value as 'todas' | 'presencial' | 'remoto' | 'hibrido')}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              >
                <option value="todas">Todas las modalidades</option>
                <option value="presencial">Presencial</option>
                <option value="hibrido">Híbrido</option>
                <option value="remoto">Remoto</option>
              </select>
              <select
                value={filterCommune}
                onChange={(e) => setFilterCommune(e.target.value)}
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
          </div>

          {currentAd && (
            <AdBannerCard
              campaign={currentAd}
              sessionId={sessionId}
              onHide={(id) => {
                setHiddenAdIds((prev) => [...prev, id]);
                setCurrentAd(null);
              }}
              onReport={(ad) => setReportTarget({id: ad.id, title: ad.title})}
              onActionTriggered={(ad) => showToast(`Contacto publicitario: ${ad.ctaDestination}`, 'info')}
            />
          )}

          {viewMode === 'tinder' ? (
            <SwipeCardDeck
              items={deckItems}
              onSwipeRight={(item) => void handleSwipeAction(item, 'like')}
              onSwipeLeft={(item) => void handleSwipeAction(item, 'pass')}
              onFavorite={(item) => void handleSwipeAction(item, 'favorite')}
              onViewDetails={(item) => {
                const v = allVacancies.find((vac) => vac.id === item.id) || null;
                setDetailVacancy(v);
              }}
            />
          ) : (
            <div className="space-y-3">
              {tab === 'explore_jobs'
                ? filteredVacancies.map(({vacancy, compatibility}) => (
                    <article
                      key={vacancy.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{vacancy.companyName}</span>
                          <span aria-hidden="true">·</span>
                          <span>{vacancy.commune}</span>
                          <span aria-hidden="true">·</span>
                          <span>{vacancy.modality}</span>
                          {vacancy.isDemo && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-600 font-medium">Demostración</span>
                            </>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{vacancy.title}</h3>
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
                          {compatibility.explanation}
                        </p>
                        <p className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          Renta: {formatCLP(vacancy.salaryMinCLP)} - {formatCLP(vacancy.salaryMaxCLP)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setDetailVacancy(vacancy)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold min-h-[40px]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detalles</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleSwipeAction(
                              {
                                id: vacancy.id,
                                title: vacancy.title,
                                subtitle: vacancy.companyName,
                                description: vacancy.description,
                                locationLabel: vacancy.commune,
                                metaLine: '',
                                isDemo: vacancy.isDemo,
                              },
                              'like'
                            )
                          }
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold min-h-[40px]"
                        >
                          Postular / Me interesa
                        </button>
                      </div>
                    </article>
                  ))
                : allWorkers.map((w) => (
                    <article
                      key={w.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500">
                          {w.commune} · {w.modality} · {w.experienceYears} años exp.
                          {w.isDemo ? ' · Demostración' : ''}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{w.displayName}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{w.headline}</p>
                        <p className="text-xs text-slate-500">Habilidades: {w.skills.join(', ')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void handleSwipeAction(
                            {
                              id: w.id,
                              title: w.displayName,
                              subtitle: w.profession,
                              description: w.headline,
                              locationLabel: w.commune,
                              metaLine: '',
                              isDemo: w.isDemo,
                            },
                            'like'
                          )
                        }
                        className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold min-h-[40px]"
                      >
                        Mostrar interés
                      </button>
                    </article>
                  ))}
            </div>
          )}
        </div>
      )}

      {/* Worker Profile & Private CV */}
      {tab === 'worker_profile' && (
        <form
          onSubmit={handleSaveWorkerProfile}
          className="max-w-3xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Perfil profesional y CV privado</h2>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">100% gratuito para trabajadores</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Nombre visible</label>
              <input
                type="text"
                required
                value={wName}
                onChange={(e) => setWName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Profesión u oficio</label>
              <input
                type="text"
                required
                value={wProfession}
                onChange={(e) => setWProfession(e.target.value)}
                placeholder="Ej. Carpintero, Técnico agrícola, Contador"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">Presentación profesional breve</label>
            <input
              type="text"
              required
              value={wHeadline}
              onChange={(e) => setWHeadline(e.target.value)}
              placeholder="Ej. 4 años de experiencia en logística y gestión de bodegas en Chiloé"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">Habilidades (separadas por coma)</label>
            <input
              type="text"
              required
              value={wSkillsText}
              onChange={(e) => setWSkillsText(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Años exp.</label>
              <input
                type="number"
                min={0}
                max={60}
                value={wExpYears}
                onChange={(e) => setWExpYears(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Formación</label>
              <select
                value={wEducation}
                onChange={(e) => setWEducation(e.target.value as WorkerProfile['educationLevel'])}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="Basica">Básica</option>
                <option value="Media">Media</option>
                <option value="Tecnico">Técnico</option>
                <option value="Universitario">Universitario</option>
                <option value="Postgrado">Postgrado</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Modalidad</label>
              <select
                value={wModality}
                onChange={(e) => setWModality(e.target.value as WorkerProfile['modality'])}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="presencial">Presencial</option>
                <option value="hibrido">Híbrido</option>
                <option value="remoto">Remoto</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Comuna</label>
              <select
                value={wCommune}
                onChange={(e) => setWCommune(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                {getRegionEntry(userAccount?.region).communes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Disponibilidad</label>
              <select
                value={wAvail}
                onChange={(e) => setWAvail(e.target.value as WorkerProfile['availability'])}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="inmediata">Inmediata</option>
                <option value="15_dias">En 15 días</option>
                <option value="30_dias">En 30 días</option>
                <option value="part_time">Part-time</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Jornada preferida</label>
              <select
                value={wSchedule}
                onChange={(e) => setWSchedule(e.target.value as WorkerProfile['preferredSchedule'])}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="completa">Completa</option>
                <option value="parcial">Parcial</option>
                <option value="turnos">Turnos</option>
                <option value="freelance">Freelance</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Pretensión de renta (CLP)</label>
              <input
                type="number"
                min={0}
                value={wSalary}
                onChange={(e) => setWSalary(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          {/* Privacy Controls */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-3">
            <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-700" />
              Privacidad de Currículum y Datos de Contacto (Nunca públicos)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="email"
                value={cvEmail}
                onChange={(e) => setCvEmail(e.target.value)}
                placeholder="Correo privado de contacto"
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={cvPhone}
                onChange={(e) => setCvPhone(e.target.value)}
                placeholder="Teléfono privado"
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              />
            </div>
            <textarea
              rows={3}
              value={cvFullSummary}
              onChange={(e) => setCvFullSummary(e.target.value)}
              placeholder="Resumen detallado de currículum (protegido, nunca expuesto en listados públicos)..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
            />
            <div className="flex flex-wrap gap-4 text-xs">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={wShowSalary}
                  onChange={(e) => setWShowSalary(e.target.checked)}
                />
                <span>Mostrar pretensión de renta en tarjeta pública</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={wDirectContact}
                  onChange={(e) => setWDirectContact(e.target.checked)}
                />
                <span>Autorizar contacto directo de empresas verificadas</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold min-h-[44px]"
          >
            Guardar perfil y currículum protegido
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
                  Mis vacantes laborales publicadas ({myVacancies.length})
                </h2>
                <p className="text-xs text-slate-500">Gestiona, pausa o elimina tus ofertas de empleo.</p>
              </div>
              <button
                type="button"
                onClick={() => setTab('publish_job')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold min-h-[40px] whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Publicar vacante</span>
              </button>
            </div>

            {myVacancies.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">Aún no has publicado vacantes laborales.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {myVacancies.map((vac) => (
                  <div key={vac.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className={vac.status === 'active' ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-amber-700 dark:text-amber-400 font-semibold'}>
                          {vac.status === 'active' ? 'Activa' : vac.status === 'paused' ? 'Pausada' : 'Cerrada'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{vac.companyName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{vac.commune}</span>
                        <span aria-hidden="true">·</span>
                        <span>{vac.modality}</span>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{vac.title}</h3>
                      <p className="font-mono tabular-nums text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        Renta: {formatCLP(vac.salaryMinCLP)} - {formatCLP(vac.salaryMaxCLP)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleToggleVacancyStatus(vac)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold min-h-[38px] whitespace-nowrap"
                      >
                        {vac.status === 'active' ? (
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
                        onClick={() => void handleDeleteVacancy(vac.id)}
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
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mi perfil laboral publicado</h2>
                <p className="text-xs text-slate-500">Visibilidad pública para que empresas compatibles te encuentren.</p>
              </div>
              <button
                type="button"
                onClick={() => setTab('worker_profile')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold min-h-[40px] whitespace-nowrap"
              >
                <span>{myWorkerProfile ? 'Editar perfil y CV' : 'Crear perfil laboral'}</span>
              </button>
            </div>

            {!myWorkerProfile ? (
              <p className="text-sm text-slate-500 py-2">Aún no has publicado tu perfil laboral.</p>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className={myWorkerProfile.status === 'active' ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-amber-700 dark:text-amber-400 font-semibold'}>
                      {myWorkerProfile.status === 'active' ? 'Visible' : 'Pausado'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{myWorkerProfile.profession}</span>
                    <span aria-hidden="true">·</span>
                    <span>{myWorkerProfile.commune}</span>
                    <span aria-hidden="true">·</span>
                    <span>{myWorkerProfile.modality}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{myWorkerProfile.displayName}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{myWorkerProfile.headline}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleWorkerStatus(myWorkerProfile)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold min-h-[38px] whitespace-nowrap shrink-0"
                >
                  {myWorkerProfile.status === 'active' ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pausar visibilidad</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Activar visibilidad</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Company Profile */}
      {tab === 'company_profile' && (
        <form
          onSubmit={handleSaveCompany}
          className="max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
        >
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Perfil de empresa contratante</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Razón social</label>
              <input
                type="text"
                required
                value={cLegalName}
                onChange={(e) => setCLegalName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Nombre comercial</label>
              <input
                type="text"
                value={cCommName}
                onChange={(e) => setCCommName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">RUT empresa (opcional)</label>
              <input
                type="text"
                value={cTaxId}
                onChange={(e) => setCTaxId(e.target.value)}
                placeholder="76.123.456-7"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Sector</label>
              <select
                value={cSector}
                onChange={(e) => setCSector(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                {LABOR_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Comuna</label>
              <select
                value={cCommune}
                onChange={(e) => setCCommune(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
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
            <label className="text-xs font-semibold">Descripción de la empresa</label>
            <textarea
              rows={3}
              required
              value={cDesc}
              onChange={(e) => setCDesc(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Contacto de selección</label>
              <input
                type="text"
                required
                value={cContact}
                onChange={(e) => setCContact(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Sitio web</label>
              <input
                type="text"
                value={cWebsite}
                onChange={(e) => setCWebsite(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold min-h-[44px]"
          >
            Guardar perfil de empresa
          </button>
        </form>
      )}

      {/* Publish Job Vacancy */}
      {tab === 'publish_job' && (
        <form
          onSubmit={handlePublishJob}
          className="max-w-3xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
        >
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Publicar vacante laboral</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Cargo</label>
              <input
                type="text"
                required
                value={jTitle}
                onChange={(e) => setJTitle(e.target.value)}
                placeholder="Ej. Técnico en climatización o Bodeguero"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Área laboral</label>
              <select
                value={jCat}
                onChange={(e) => setJCat(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              >
                {LABOR_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">Descripción y funciones del cargo</label>
            <textarea
              rows={3}
              required
              value={jDesc}
              onChange={(e) => setJDesc(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Habilidades obligatorias (separadas por coma)</label>
              <input
                type="text"
                required
                value={jMandSkills}
                onChange={(e) => setJMandSkills(e.target.value)}
                placeholder="Ej. Licencia clase B, Excel básico"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Habilidades deseables</label>
              <input
                type="text"
                value={jDesSkills}
                onChange={(e) => setJDesSkills(e.target.value)}
                placeholder="Ej. Atención al cliente"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Exp. mínima (años)</label>
              <input
                type="number"
                min={0}
                value={jMinExp}
                onChange={(e) => setJMinExp(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Formación mínima</label>
              <select
                value={jReqEdu}
                onChange={(e) => setJReqEdu(e.target.value as JobVacancy['requiredEducation'])}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="Basica">Básica</option>
                <option value="Media">Media</option>
                <option value="Tecnico">Técnico</option>
                <option value="Universitario">Universitario</option>
                <option value="Postgrado">Postgrado</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Renta mín. (CLP)</label>
              <input
                type="number"
                min={0}
                value={jSalMin}
                onChange={(e) => setJSalMin(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Renta máx. (CLP)</label>
              <input
                type="number"
                min={0}
                value={jSalMax}
                onChange={(e) => setJSalMax(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select
              value={jCommune}
              onChange={(e) => setJCommune(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              {getRegionEntry(userAccount?.region).communes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={jModality}
              onChange={(e) => setJModality(e.target.value as JobVacancy['modality'])}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="presencial">Presencial</option>
              <option value="hibrido">Híbrido</option>
              <option value="remoto">Remoto</option>
            </select>
            <select
              value={jSchedule}
              onChange={(e) => setJSchedule(e.target.value as JobVacancy['schedule'])}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="completa">Jornada Completa</option>
              <option value="parcial">Parcial</option>
              <option value="turnos">Turnos</option>
              <option value="freelance">Freelance</option>
            </select>
            <select
              value={jContract}
              onChange={(e) => setJContract(e.target.value as JobVacancy['contractType'])}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="indefinido">Indefinido</option>
              <option value="plazo_fijo">Plazo fijo</option>
              <option value="honorarios">Honorarios</option>
              <option value="practica">Práctica</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold min-h-[44px]"
          >
            Publicar vacante laboral
          </button>
        </form>
      )}

      {/* Incoming Interest */}
      {tab === 'candidates_interest' && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Postulaciones e intereses recibidos</h2>
          {receivedInteractions.filter((i) => i.action === 'like').length === 0 ? (
            <p className="text-sm text-slate-500">Aún no recibes intereses laborales.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {receivedInteractions
                .filter((i) => i.action === 'like')
                .map((inter) => (
                  <div key={inter.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Interés laboral ({inter.targetKind === 'vacancy' ? 'Vacante' : 'Perfil profesional'})
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        {inter.compatibilityScore ? `Compatibilidad: ${inter.compatibilityScore}% · ` : ''}ID: {inter.targetId}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void createRealEmploymentMatch(
                          inter.fromUid,
                          'Contraparte laboral',
                          inter.targetId,
                          'Oportunidad laboral',
                          inter.compatibilityScore
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold min-h-[40px]"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar MATCH laboral</span>
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Detail Vacancy Modal */}
      {detailVacancy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500">
                  {detailVacancy.companyName} · {detailVacancy.commune}
                </p>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{detailVacancy.title}</h3>
              </div>
              <button type="button" onClick={() => setDetailVacancy(null)} className="text-slate-400 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{detailVacancy.description}</p>
            <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
              <p>
                <strong>Habilidades obligatorias:</strong> {detailVacancy.mandatorySkills.join(', ')}
              </p>
              <p>
                <strong>Experiencia mínima:</strong> {detailVacancy.minExperienceYears} años · Formación:{' '}
                {detailVacancy.requiredEducation}
              </p>
              <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                Renta: {formatCLP(detailVacancy.salaryMinCLP)} - {formatCLP(detailVacancy.salaryMaxCLP)}
              </p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setReportTarget({id: detailVacancy.id, title: detailVacancy.title});
                  setDetailVacancy(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:underline"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Reportar oferta engañosa o discriminatoria</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <form
            onSubmit={handleReportSubmit}
            className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Reportar oferta laboral</h3>
              <button type="button" onClick={() => setReportTarget(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">{reportTarget.title}</p>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="Oferta laboral engañosa">Oferta laboral engañosa</option>
              <option value="Criterio discriminatorio">Criterio discriminatorio</option>
              <option value="Posible fraude o cobro indebido">Posible fraude o cobro indebido</option>
            </select>
            <textarea
              rows={3}
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Describe el problema..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold min-h-[44px]"
            >
              Enviar reporte
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
