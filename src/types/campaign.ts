// ─── Merkury Media Wall + Campaign Attribution Types ────────────────

export type AdPlatform =
  | 'instagram'
  | 'youtube'
  | 'google-display'
  | 'tiktok'
  | 'pinterest'
  | 'ctv'
  | 'email';

export type TargetingStrategy =
  | 'lookalike'
  | 'retargeting'
  | 'interest-based'
  | 'demographic'
  | 'contextual'
  | 'first-party'
  | 'household';

export type CreativeType = 'static-image' | 'video' | 'carousel' | 'story' | 'native';

export interface UTMParams {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content?: string;
  utm_term?: string;
}

export interface MerkuryAudienceSegment {
  segmentName: string;
  segmentSize: string;
  matchType: 'pid' | 'hid' | 'modeled';
  dataSignals: string[];
}

export interface AdCreative {
  id: string;
  platform: AdPlatform;
  headline: string;
  description: string;
  creativeType: CreativeType;
  gradientFrom: string;
  gradientTo: string;
  productImage?: string;
  campaignName: string;
  campaignTheme: string;
  utmParams: UTMParams;
  audienceSegment: MerkuryAudienceSegment;
  targetingStrategy: TargetingStrategy;
  inferredInterests: string[];
  inferredIntentSignals: string[];
}

export interface CampaignAttribution {
  adCreative: AdCreative;
  clickedAt: string;
  entrySource: 'media-wall' | 'utm-deeplink';
}
