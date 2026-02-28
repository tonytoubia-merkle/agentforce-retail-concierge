import { createContext, useContext, useState, useCallback } from 'react';
import type { CampaignAttribution } from '@/types/campaign';

interface CampaignContextValue {
  campaign: CampaignAttribution | null;
  setCampaign: (campaign: CampaignAttribution) => void;
  clearCampaign: () => void;
  navigateToMediaWall: (() => void) | null;
}

const CampaignContext = createContext<CampaignContextValue | null>(null);

interface CampaignProviderProps {
  children: React.ReactNode;
  initialCampaign?: CampaignAttribution | null;
  onNavigateToMediaWall?: () => void;
}

export const CampaignProvider: React.FC<CampaignProviderProps> = ({
  children,
  initialCampaign,
  onNavigateToMediaWall,
}) => {
  const [campaign, setCampaignState] = useState<CampaignAttribution | null>(initialCampaign ?? null);

  const setCampaign = useCallback((attribution: CampaignAttribution) => {
    setCampaignState(attribution);
  }, []);

  const clearCampaign = useCallback(() => {
    setCampaignState(null);
  }, []);

  return (
    <CampaignContext.Provider
      value={{
        campaign,
        setCampaign,
        clearCampaign,
        navigateToMediaWall: onNavigateToMediaWall || null,
      }}
    >
      {children}
    </CampaignContext.Provider>
  );
};

export function useCampaign(): CampaignContextValue {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error('useCampaign must be used within CampaignProvider');
  return ctx;
}
