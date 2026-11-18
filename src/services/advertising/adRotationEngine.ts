import {AdCampaign, AdRotationConfig} from '../../types';
import {DEFAULT_ROTATION_CONFIG} from '../config/chileCatalog';

export interface AdSelectionContext {
  section: 'commercial' | 'employment' | 'general';
  activeCategory?: string;
  userCommune?: string;
  userRegion?: string;
  hiddenAdIds?: string[];
}

export interface ScoredAd {
  campaign: AdCampaign;
  totalScore: number;
  breakdown: {
    category: number;
    geography: number;
    campaignType: number;
    exposureBalance: number;
    contextualRelevance: number;
  };
}

/**
 * Experience protection rule: never show ads inside private chat or match confirmation modals.
 */
export function canShowAdsInView(view: 'commercial_feed' | 'employment_feed' | 'directory' | 'chat' | 'match_confirmation'): boolean {
  return view !== 'chat' && view !== 'match_confirmation';
}

function isCampaignActiveAndEligible(campaign: AdCampaign, todayISO: string): boolean {
  if (campaign.moderationStatus !== 'active' || campaign.paymentStatus !== 'confirmed') {
    return false;
  }
  if (campaign.startDate && campaign.startDate > todayISO) return false;
  if (campaign.endDate && campaign.endDate < todayISO) return false;
  return true;
}

/**
 * 100-point Ad Selection Algorithm:
 * - Category match: 30 pts
 * - Geographic match: 25 pts
 * - Campaign type/priority: 20 pts
 * - Exposure balance: 15 pts
 * - Contextual relevance: 10 pts
 */
export function scoreAndRankAds(
  campaigns: AdCampaign[],
  context: AdSelectionContext,
  sessionAdvertiserCounts: Record<string, number>,
  config: AdRotationConfig = DEFAULT_ROTATION_CONFIG
): ScoredAd[] {
  const todayISO = new Date().toISOString().slice(0, 10);
  const hiddenSet = new Set(context.hiddenAdIds || []);

  const eligible = campaigns.filter((c) => {
    if (hiddenSet.has(c.id)) return false;
    if (!isCampaignActiveAndEligible(c, todayISO)) return false;
    if ((sessionAdvertiserCounts[c.advertiserId] || 0) >= config.maxSameAdvertiserPerSession) return false;
    const sectionMatch =
      c.targetSections.includes(context.section) || c.targetSections.includes('general');
    return sectionMatch;
  });

  if (eligible.length === 0) return [];

  const maxImpressions = Math.max(1, ...eligible.map((c) => c.impressionsCount || 0));

  const scored: ScoredAd[] = eligible.map((campaign) => {
    // 1. Category (30 pts)
    const category =
      context.activeCategory && campaign.targetCategories.includes(context.activeCategory)
        ? 30
        : campaign.targetCategories.length > 0
          ? 12
          : 0;

    // 2. Geography (25 pts)
    let geography = 10;
    if (context.userCommune && campaign.targetCommune.toLowerCase() === context.userCommune.toLowerCase()) {
      geography = 25;
    } else if (context.userRegion && campaign.targetRegion.toLowerCase() === context.userRegion.toLowerCase()) {
      geography = 18;
    } else if (campaign.targetScope === 'chile') {
      geography = 14;
    }

    // 3. Campaign Priority (20 pts)
    const campaignType = Math.round(((campaign.priorityWeight || 40) / 100) * 20);

    // 4. Exposure Balance (15 pts) - favors advertisers with fewer impressions so none monopolize
    const impressionRatio = (campaign.impressionsCount || 0) / maxImpressions;
    const exposureBalance = Math.round((1 - impressionRatio * 0.8) * 15);

    // 5. Contextual Relevance (10 pts)
    const contextualRelevance = campaign.targetSections.includes(context.section) ? 10 : 5;

    return {
      campaign,
      totalScore: category + geography + campaignType + exposureBalance + contextualRelevance,
      breakdown: {category, geography, campaignType, exposureBalance, contextualRelevance},
    };
  });

  return scored.sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Determines whether an ad should be inserted after `viewedOrganicCount` organic cards
 * according to admin-configurable rotation rules:
 * - First ad after 6 posts (default)
 * - Second ad after +9 additional posts (15)
 * - Third ad after +10 additional posts (25), then respecting minPostsBetweenAds & maxAdsPerSession
 */
export function shouldShowAdAtOrganicIndex(
  viewedOrganicCount: number,
  adsShownInSession: number,
  postsSinceLastAd: number,
  config: AdRotationConfig = DEFAULT_ROTATION_CONFIG
): boolean {
  if (adsShownInSession >= config.maxAdsPerSession) return false;
  if (viewedOrganicCount < config.firstAdAfterPosts) return false;
  if (postsSinceLastAd < config.minPostsBetweenAds) return false;

  if (adsShownInSession === 0) {
    return viewedOrganicCount >= config.firstAdAfterPosts;
  }
  if (adsShownInSession === 1) {
    return viewedOrganicCount >= config.firstAdAfterPosts + config.secondAdAfterAdditional;
  }
  if (adsShownInSession === 2) {
    return (
      viewedOrganicCount >=
      config.firstAdAfterPosts + config.secondAdAfterAdditional + config.thirdAdAfterAdditional
    );
  }
  return postsSinceLastAd >= Math.max(config.minPostsBetweenAds, config.thirdAdAfterAdditional);
}
