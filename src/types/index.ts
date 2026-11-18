export type UserRole =
  | 'buyer'
  | 'seller'
  | 'mixed'
  | 'worker'
  | 'company'
  | 'external_advertiser'
  | 'registered_advertiser'
  | 'moderator'
  | 'admin';

export type AppModule = 'commercial' | 'employment' | 'advertising';

export type AppSection =
  | 'landing'
  | 'home'
  | 'commercial'
  | 'employment'
  | 'advertising'
  | 'matches'
  | 'messages'
  | 'notifications'
  | 'profile'
  | 'settings'
  | 'help'
  | 'admin';

export interface NotificationPreferences {
  matches: boolean;
  messages: boolean;
  interests: boolean;
  compatibleNeeds: boolean;
  compatibleJobs: boolean;
  campaigns: boolean;
  payments: boolean;
  webPushEnabled: boolean;
}

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  phone?: string;
  commune: string;
  region: string;
  roles: UserRole[];
  activeModules: AppModule[];
  notificationPrefs: NotificationPreferences;
  privacyConsentAt?: string;
  status: 'active' | 'suspended' | 'deleted';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BusinessProfile {
  id: string;
  ownerId: string;
  businessName: string;
  commercialName: string;
  logoUrl?: string;
  photos?: string[];
  description: string;
  category: string;
  commune: string;
  region: string;
  location?: string;
  contactInfo: string;
  hours: string;
  salesTerms: string;
  deliveryMethods: string[];
  availability: 'available' | 'limited' | 'unavailable';
  verified: boolean;
  status: 'active' | 'paused';
  isDemo?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BuyerProfile {
  ownerId: string;
  soughtProducts: string[];
  requiredServices: string[];
  categoriesOfInterest: string[];
  minBudgetCLP: number;
  maxBudgetCLP: number;
  commune: string;
  region: string;
  searchRadiusKm: number;
  preferences: string;
  specificNeeds: string;
}

export interface CommercialProduct {
  id: string;
  ownerId: string;
  businessId?: string;
  itemType: 'product' | 'service';
  title: string;
  description: string;
  category: string;
  priceCLP: number;
  sellerName: string;
  commune: string;
  region: string;
  distanceKm?: number;
  imageUrl: string;
  availability: 'available' | 'limited' | 'unavailable';
  deliveryMethods: string[];
  verified: boolean;
  status: 'active' | 'paused' | 'archived';
  isDemo?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PurchaseRequest {
  id: string;
  ownerId: string;
  buyerName: string;
  title: string;
  description: string;
  category: string;
  minBudgetCLP: number;
  maxBudgetCLP: number;
  commune: string;
  region: string;
  urgency: 'inmediata' | 'esta_semana' | 'este_mes';
  status: 'open' | 'matched' | 'closed';
  isDemo?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WorkerProfile {
  id: string;
  ownerId: string;
  displayName: string;
  photoUrl?: string;
  headline: string;
  profession: string;
  trades: string[];
  skills: string[];
  experienceYears: number;
  experienceSummary: string;
  educationLevel: 'Basica' | 'Media' | 'Tecnico' | 'Universitario' | 'Postgrado';
  certifications: string[];
  commune: string;
  region: string;
  availability: 'inmediata' | '15_dias' | '30_dias' | 'part_time';
  preferredSchedule: 'completa' | 'parcial' | 'turnos' | 'freelance';
  modality: 'presencial' | 'remoto' | 'hibrido';
  employmentType: string;
  salaryExpectationCLP: number;
  showSalaryExpectation: boolean;
  allowDirectContact: boolean;
  status: 'active' | 'paused';
  isDemo?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WorkerPrivateCV {
  ownerId: string;
  fullSummary: string;
  contactEmail: string;
  contactPhone: string;
  cvUrl?: string;
  updatedAt?: unknown;
}

export interface CompanyProfile {
  id: string;
  ownerId: string;
  legalName: string;
  commercialName: string;
  taxId?: string;
  logoUrl?: string;
  description: string;
  sector: string;
  commune: string;
  region: string;
  contactInfo: string;
  website?: string;
  verified: boolean;
  status: 'active' | 'paused';
  isDemo?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface JobVacancy {
  id: string;
  ownerId: string;
  companyId?: string;
  companyName: string;
  title: string;
  description: string;
  responsibilities: string;
  requirements: string;
  mandatorySkills: string[];
  desiredSkills: string[];
  minExperienceYears: number;
  requiredEducation: 'Basica' | 'Media' | 'Tecnico' | 'Universitario' | 'Postgrado';
  category: string;
  commune: string;
  region: string;
  modality: 'presencial' | 'remoto' | 'hibrido';
  schedule: 'completa' | 'parcial' | 'turnos' | 'freelance';
  contractType: 'indefinido' | 'plazo_fijo' | 'honorarios' | 'practica';
  salaryMinCLP: number;
  salaryMaxCLP: number;
  startDate: string;
  expiresAt: string;
  verified: boolean;
  status: 'active' | 'paused' | 'expired' | 'closed';
  isDemo?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CompatibilityResult {
  eligible: boolean;
  score: number;
  explanation: string;
  failedMandatory: string[];
  breakdown: {
    skills: number;
    experience: number;
    education: number;
    location: number;
    availability: number;
    schedule: number;
    modality: number;
    salary: number;
  };
}

export interface MatchRecord {
  id: string;
  module: 'commercial' | 'employment';
  participantIds: string[];
  initiatorUid: string;
  recipientUid: string;
  initiatorName: string;
  recipientName: string;
  targetId: string;
  targetTitle: string;
  compatibilityScore?: number;
  compatibilityExplanation?: string;
  status: 'active' | 'blocked' | 'archived';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Conversation {
  id: string;
  matchId: string;
  module: 'commercial' | 'employment';
  participantIds: string[];
  participantNames: Record<string, string>;
  targetTitle: string;
  lastMessage: string;
  lastMessageAt?: unknown;
  blockedBy?: string | null;
  status: 'active' | 'blocked';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  imageUrl?: string;
  read: boolean;
  createdAt?: unknown;
}

export interface AppNotification {
  id: string;
  userId: string;
  type:
    | 'new_match'
    | 'new_message'
    | 'new_interest'
    | 'compatible_request'
    | 'compatible_vacancy'
    | 'company_response'
    | 'ad_campaign'
    | 'payment'
    | 'expiration'
    | 'admin_change';
  title: string;
  body: string;
  module?: AppModule;
  relatedId?: string;
  read: boolean;
  createdAt?: unknown;
}

export interface AdvertiserAccount {
  id: string;
  ownerId: string;
  advertiserType: 'external' | 'registered';
  businessName: string;
  responsibleName: string;
  category: string;
  description: string;
  commune: string;
  region: string;
  contactEmail: string;
  contactPhone: string;
  website?: string;
  discountPercent: number;
  status: 'active' | 'suspended';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdPackage {
  id: string;
  name: string;
  tier: 'inicial' | 'profesional' | 'premium' | 'patrocinador' | 'temp_3' | 'temp_7' | 'temp_15';
  billingCycle: 'monthly' | 'temporary';
  durationDays: number;
  priceCLP: number;
  priorityWeight: number;
  description: string;
  features: string[];
  active: boolean;
  updatedAt?: unknown;
}

export type AdPaymentStatus =
  | 'pending_payment'
  | 'pending_confirmation'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export type AdModerationStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'paused'
  | 'finished'
  | 'cancelled';

export interface AdCampaign {
  id: string;
  ownerId: string;
  advertiserId: string;
  advertiserType: 'external' | 'registered';
  businessName: string;
  objective: string;
  title: string;
  description: string;
  benefit: string;
  offerPriceText?: string;
  ctaLabel: string;
  ctaActionType: 'visit_store' | 'call' | 'message' | 'website' | 'map' | 'product' | 'promo';
  ctaDestination: string;
  imageUrl: string;
  logoUrl?: string;
  targetSections: ('commercial' | 'employment' | 'general')[];
  targetCategories: string[];
  targetScope: 'chiloe' | 'los_lagos' | 'chile';
  targetCommune: string;
  targetRegion: string;
  targetAudienceNote?: string;
  packageId: string;
  packageName: string;
  durationDays: number;
  basePriceCLP: number;
  discountCLP: number;
  finalAmountCLP: number;
  priorityWeight: number;
  startDate: string;
  endDate: string;
  paymentStatus: AdPaymentStatus;
  moderationStatus: AdModerationStatus;
  rejectionReason?: string;
  impressionsCount: number;
  clicksCount: number;
  contactsCount: number;
  isDemo?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdOrder {
  id: string;
  ownerId: string;
  campaignId?: string;
  engine: AppModule;
  orderType: 'ad_campaign' | 'seller_subscription' | 'company_subscription' | 'featured_post';
  description: string;
  commerceOrder: string;
  amountCLP: number;
  currency: 'CLP';
  paymentMethod: 'flow' | 'transfer' | 'exempt';
  flowToken?: string;
  flowOrder?: string;
  receiptNote?: string;
  status: 'pending' | 'pending_confirmation' | 'confirmed' | 'rejected' | 'cancelled' | 'expired';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdRotationConfig {
  firstAdAfterPosts: number;
  secondAdAfterAdditional: number;
  thirdAdAfterAdditional: number;
  maxConsecutiveAds: number;
  maxAdsPerSession: number;
  maxSameAdvertiserPerSession: number;
  minPostsBetweenAds: number;
  registeredAdvertiserDiscountPercent: number;
}

export interface ReportRecord {
  id: string;
  reporterId: string;
  targetType: 'product' | 'vacancy' | 'ad' | 'user' | 'message';
  targetId: string;
  module: AppModule;
  reason: string;
  details: string;
  status: 'open' | 'reviewed' | 'dismissed';
  resolutionNote?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLogEntry {
  id: string;
  actorUid: string;
  actorEmail?: string;
  action: string;
  targetCollection: string;
  targetId: string;
  summary: string;
  createdAt?: unknown;
}
