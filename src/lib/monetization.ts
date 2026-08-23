/**
 * Muv'it Monetization System
 * 
 * Based on Facebook/Meta's creator monetization model:
 * - Revenue comes from a platform ad revenue pool
 * - Creators receive 55% of ad revenue attributed to their content
 * - Platform retains 45% for operations, development, and growth
 * 
 * Revenue Attribution Model:
 * - CPM (Cost Per Mille): $2-8 depending on region and content quality
 * - Revenue is calculated per 1000 views
 * - Engagement multipliers boost earnings for high-quality content
 * - Watch time is the primary metric (like YouTube/Facebook)
 */

// Revenue share percentages
export const CREATOR_SHARE = 0.55; // 55% to creators (Facebook standard)
export const PLATFORM_SHARE = 0.45; // 45% to platform

// CPM rates by region (USD per 1000 views)
export const CPM_RATES: Record<string, number> = {
  US: 6.00,
  CA: 5.50,
  GB: 5.00,
  AU: 5.00,
  DE: 4.50,
  FR: 4.50,
  JP: 4.00,
  KR: 3.50,
  BR: 2.00,
  IN: 1.50,
  NG: 1.50,
  ZA: 2.00,
  KE: 1.50,
  GH: 1.50,
  PH: 1.50,
  ID: 1.50,
  TH: 2.00,
  MY: 2.00,
  SG: 4.00,
  AE: 4.50,
  SA: 4.00,
  EG: 1.50,
  MX: 2.00,
  AR: 1.50,
  CL: 2.00,
  CO: 1.50,
  PL: 2.50,
  TR: 1.50,
  PK: 1.00,
  DEFAULT: 2.00, // Default for unlisted countries
};

// Engagement bonus multipliers
export const ENGAGEMENT_MULTIPLIERS = {
  LIKES: 0.1,      // +10% bonus per like relative to views
  COMMENTS: 0.2,   // +20% bonus per comment relative to views
  SHARES: 0.3,     // +30% bonus per share relative to views
  SAVES: 0.15,     // +15% bonus per save relative to views
  REPLAYS: 0.05,   // +5% bonus per replay (watch again)
};

// Watch time bonuses
export const WATCH_TIME_BONUSES = {
  FULL_WATCH: 1.5,      // 1.5x if user watches 100% of video
  HALF_WATCH: 1.2,      // 1.2x if user watches 50%+ of video
  QUARTER_WATCH: 1.0,   // Base rate for 25%+ watch
  SKIP: 0.5,            // 0.5x if user skips within first few seconds
};

// Minimum payout thresholds by currency
export const PAYOUT_THRESHOLDS: Record<string, number> = {
  USD: 110,
  EUR: 100,
  GBP: 90,
  ZAR: 2000,
  NGN: 180000,
  KES: 14500,
  GHS: 1500,
  INR: 9200,
  BRL: 600,
  PHP: 6200,
  MXN: 2000,
  DEFAULT: 2000,
};

// Eligibility requirements
export const ELIGIBILITY = {
  MIN_FOLLOWERS: 6000,
  MIN_WATCH_HOURS: 2000000,
  MIN_REELS: 3,              // At least 3 reels uploaded
  MIN_ACCOUNT_AGE_DAYS: 30,  // Account must be 30 days old
};

/**
 * Calculate earnings for a single reel/video
 */
export interface ReelEarningsInput {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves?: number;
  avgWatchPercent?: number; // 0-100
  countryCode: string;
}

export interface ReelEarningsResult {
  grossAdRevenue: number;      // Total ad revenue generated
  creatorShare: number;        // Creator's 55%
  platformShare: number;       // Platform's 45%
  engagementBonus: number;     // Bonus from engagement
  watchTimeMultiplier: number; // Multiplier from watch time
  totalCreatorEarnings: number; // Final creator earnings
  cpmUsed: number;             // CPM rate applied
  breakdown: {
    baseEarnings: number;
    likeBonus: number;
    commentBonus: number;
    shareBonus: number;
    saveBonus: number;
  };
}

export function calculateReelEarnings(input: ReelEarningsInput): ReelEarningsResult {
  const {
    views,
    likes,
    comments,
    shares,
    saves = 0,
    avgWatchPercent = 50,
    countryCode,
  } = input;

  // Get CPM for country
  const cpmUsed = CPM_RATES[countryCode] || CPM_RATES.DEFAULT;

  // Base earnings from views (CPM / 1000 * views)
  const baseEarnings = (cpmUsed / 1000) * views;

  // Calculate engagement bonuses relative to view count
  const engagementRate = views > 0 ? ((likes + comments + shares) / views) : 0;
  
  const likeBonus = views > 0 ? (likes / views) * baseEarnings * ENGAGEMENT_MULTIPLIERS.LIKES : 0;
  const commentBonus = views > 0 ? (comments / views) * baseEarnings * ENGAGEMENT_MULTIPLIERS.COMMENTS : 0;
  const shareBonus = views > 0 ? (shares / views) * baseEarnings * ENGAGEMENT_MULTIPLIERS.SHARES : 0;
  const saveBonus = views > 0 ? (saves / views) * baseEarnings * ENGAGEMENT_MULTIPLIERS.SAVES : 0;

  const engagementBonus = likeBonus + commentBonus + shareBonus + saveBonus;

  // Watch time multiplier
  let watchTimeMultiplier = WATCH_TIME_BONUSES.QUARTER_WATCH;
  if (avgWatchPercent >= 100) {
    watchTimeMultiplier = WATCH_TIME_BONUSES.FULL_WATCH;
  } else if (avgWatchPercent >= 50) {
    watchTimeMultiplier = WATCH_TIME_BONUSES.HALF_WATCH;
  } else if (avgWatchPercent >= 25) {
    watchTimeMultiplier = WATCH_TIME_BONUSES.QUARTER_WATCH;
  } else {
    watchTimeMultiplier = WATCH_TIME_BONUSES.SKIP;
  }

  // Total gross ad revenue
  const grossAdRevenue = (baseEarnings + engagementBonus) * watchTimeMultiplier;

  // Revenue split
  const creatorShare = grossAdRevenue * CREATOR_SHARE;
  const platformShare = grossAdRevenue * PLATFORM_SHARE;

  return {
    grossAdRevenue,
    creatorShare,
    platformShare,
    engagementBonus,
    watchTimeMultiplier,
    totalCreatorEarnings: creatorShare,
    cpmUsed,
    breakdown: {
      baseEarnings,
      likeBonus,
      commentBonus,
      shareBonus,
      saveBonus,
    },
  };
}

/**
 * Calculate total earnings for a creator across all their content
 */
export interface CreatorEarningsInput {
  reels: Array<{
    id: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }>;
  countryCode: string;
  vatRate: number;
}

export interface CreatorEarningsSummary {
  totalGrossEarnings: number;
  totalCreatorEarnings: number;
  platformRevenue: number;
  vatDeduction: number;
  netEarnings: number;
  reelBreakdown: Array<{
    id: string;
    earnings: number;
    views: number;
  }>;
  isEligibleForPayout: boolean;
  payoutThreshold: number;
  amountToNextPayout: number;
}

export function calculateCreatorEarnings(input: CreatorEarningsInput): CreatorEarningsSummary {
  const { reels, countryCode, vatRate } = input;

  let totalGrossEarnings = 0;
  let totalCreatorEarnings = 0;
  let platformRevenue = 0;
  
  const reelBreakdown = reels.map(reel => {
    const earnings = calculateReelEarnings({
      views: reel.views,
      likes: reel.likes,
      comments: reel.comments,
      shares: reel.shares,
      countryCode,
    });

    totalGrossEarnings += earnings.grossAdRevenue;
    totalCreatorEarnings += earnings.creatorShare;
    platformRevenue += earnings.platformShare;

    return {
      id: reel.id,
      earnings: earnings.creatorShare,
      views: reel.views,
    };
  });

  // Calculate VAT deduction
  const vatDeduction = totalCreatorEarnings * (vatRate / 100);
  const netEarnings = totalCreatorEarnings - vatDeduction;

  // Payout eligibility
  const threshold = PAYOUT_THRESHOLDS[getCurrencyForCountry(countryCode)] || PAYOUT_THRESHOLDS.DEFAULT;
  const isEligibleForPayout = netEarnings >= threshold;
  const amountToNextPayout = Math.max(0, threshold - netEarnings);

  return {
    totalGrossEarnings,
    totalCreatorEarnings,
    platformRevenue,
    vatDeduction,
    netEarnings,
    reelBreakdown: reelBreakdown.sort((a, b) => b.earnings - a.earnings),
    isEligibleForPayout,
    payoutThreshold: threshold,
    amountToNextPayout,
  };
}

/**
 * Check if a user meets monetization eligibility
 */
export interface EligibilityCheckInput {
  followers: number;
  watchHours: number;
  reelsCount: number;
  accountCreatedAt: Date;
}

export interface EligibilityResult {
  isEligible: boolean;
  requirements: {
    followers: { current: number; required: number; met: boolean };
    watchHours: { current: number; required: number; met: boolean };
    reels: { current: number; required: number; met: boolean };
    accountAge: { currentDays: number; required: number; met: boolean };
  };
  missingRequirements: string[];
}

export function checkEligibility(input: EligibilityCheckInput): EligibilityResult {
  const accountAgeDays = Math.floor(
    (Date.now() - input.accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const requirements = {
    followers: {
      current: input.followers,
      required: ELIGIBILITY.MIN_FOLLOWERS,
      met: input.followers >= ELIGIBILITY.MIN_FOLLOWERS,
    },
    watchHours: {
      current: input.watchHours,
      required: ELIGIBILITY.MIN_WATCH_HOURS,
      met: input.watchHours >= ELIGIBILITY.MIN_WATCH_HOURS,
    },
    reels: {
      current: input.reelsCount,
      required: ELIGIBILITY.MIN_REELS,
      met: input.reelsCount >= ELIGIBILITY.MIN_REELS,
    },
    accountAge: {
      currentDays: accountAgeDays,
      required: ELIGIBILITY.MIN_ACCOUNT_AGE_DAYS,
      met: accountAgeDays >= ELIGIBILITY.MIN_ACCOUNT_AGE_DAYS,
    },
  };

  const missingRequirements: string[] = [];
  if (!requirements.followers.met) {
    missingRequirements.push(`${ELIGIBILITY.MIN_FOLLOWERS - input.followers} more followers needed`);
  }
  if (!requirements.watchHours.met) {
    missingRequirements.push(`${ELIGIBILITY.MIN_WATCH_HOURS - input.watchHours} more watch hours needed`);
  }
  if (!requirements.reels.met) {
    missingRequirements.push(`${ELIGIBILITY.MIN_REELS - input.reelsCount} more Muv'z needed`);
  }
  if (!requirements.accountAge.met) {
    missingRequirements.push(`Account must be ${ELIGIBILITY.MIN_ACCOUNT_AGE_DAYS} days old`);
  }

  const isEligible = Object.values(requirements).every(r => r.met);

  return {
    isEligible,
    requirements,
    missingRequirements,
  };
}

/**
 * Helper to get currency code for a country
 */
function getCurrencyForCountry(countryCode: string): string {
  const currencyMap: Record<string, string> = {
    US: 'USD', CA: 'USD', GB: 'GBP', AU: 'USD', DE: 'EUR', FR: 'EUR',
    JP: 'USD', KR: 'USD', BR: 'BRL', IN: 'INR', NG: 'NGN', ZA: 'ZAR',
    KE: 'KES', GH: 'GHS', PH: 'PHP', ID: 'USD', TH: 'USD', MY: 'USD',
    SG: 'USD', AE: 'USD', SA: 'USD', EG: 'USD', MX: 'MXN', AR: 'USD',
    CL: 'USD', CO: 'USD', PL: 'EUR', TR: 'USD', PK: 'USD',
  };
  return currencyMap[countryCode] || 'USD';
}

/**
 * Format earnings for display
 */
export function formatEarnings(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', ZAR: 'R', NGN: '₦', KES: 'KSh',
    GHS: '₵', INR: '₹', BRL: 'R$', PHP: '₱', MXN: 'MX$',
  };
  const symbol = symbols[currency] || '$';
  return `${symbol}${amount.toFixed(2)}`;
}
