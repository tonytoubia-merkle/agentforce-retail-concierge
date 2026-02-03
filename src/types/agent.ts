import type { Product } from './product';
import type { SceneSetting } from './scene';

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  uiDirective?: UIDirective;
}

export interface UIDirective {
  action: UIAction;
  payload: UIDirectivePayload;
}

export type UIAction =
  | 'SHOW_PRODUCT'
  | 'SHOW_PRODUCTS'
  | 'CHANGE_SCENE'
  | 'WELCOME_SCENE'
  | 'INITIATE_CHECKOUT'
  | 'CONFIRM_ORDER'
  | 'RESET_SCENE'
  | 'IDENTIFY_CUSTOMER';

export interface UIDirectivePayload {
  products?: Product[];
  welcomeMessage?: string;
  welcomeSubtext?: string;
  sceneContext?: {
    setting: SceneSetting;
    mood?: string;
    generateBackground?: boolean;
    backgroundPrompt?: string;
    cmsAssetId?: string;
    cmsTag?: string;
    editMode?: boolean;
    sceneAssetId?: string;
    imageUrl?: string;
  };
  checkoutData?: {
    products: Product[];
    useStoredPayment: boolean;
  };
  orderConfirmation?: {
    orderId: string;
    estimatedDelivery: string;
  };
  /** Email captured from anonymous user for identity resolution. */
  customerEmail?: string;
  /** Background captures that occurred alongside this response. */
  captures?: CaptureNotification[];
}

/** A background data-capture event the agent performed silently. */
export interface CaptureNotification {
  type: 'contact_created' | 'meaningful_event' | 'profile_enrichment';
  label: string;
}

export interface AgentResponse {
  sessionId: string;
  message: string;
  uiDirective?: UIDirective;
  suggestedActions?: string[];
  confidence: number;
}
