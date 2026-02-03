import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import type { SceneState, SceneLayout, SceneSetting, SceneBackground, WelcomeData } from '@/types/scene';
import type { Product } from '@/types/product';
import type { UIDirective } from '@/types/agent';
import { useGenerativeBackground, type BackgroundOptions } from '@/hooks/useGenerativeBackground';

/** Build BackgroundOptions from a UIDirective's sceneContext payload. */
function buildBgOptions(sc?: UIDirective['payload']['sceneContext']): BackgroundOptions {
  if (!sc) return {};
  const raw = sc as Record<string, unknown>;
  return {
    cmsAssetId: sc.cmsAssetId,
    cmsTag: sc.cmsTag,
    editMode: sc.editMode,
    backgroundPrompt: sc.backgroundPrompt,
    editPrompt: sc.editMode ? sc.backgroundPrompt : undefined,
    sceneAssetId: sc.sceneAssetId,
    imageUrl: sc.imageUrl,
    mood: raw.mood as string | undefined,
    customerContext: raw.customerContext as string | undefined,
    sceneType: raw.sceneType as string | undefined,
  };
}

/** Infer a scene setting from product categories when the agent doesn't provide one. */
function inferSettingFromProducts(products: Product[]): SceneSetting {
  const categories = products.map((p) => (p.category || '').toLowerCase());
  const names = products.map((p) => (p.name || '').toLowerCase());
  const all = [...categories, ...names].join(' ');

  if (/foundation|lipstick|blush|mascara|makeup|palette|vanity/i.test(all)) return 'vanity';
  if (/fragrance|perfume|cologne|eau de|scent|parfum/i.test(all)) return 'bedroom';
  if (/shampoo|conditioner|hair/i.test(all)) return 'bathroom';
  if (/gym|workout|active|post.workout/i.test(all)) return 'gym';
  if (/office|work|minimal|desk/i.test(all)) return 'office';
  if (/travel|luggage|portable|mini|kit|on.the.go/i.test(all)) return 'travel';
  if (/sun|spf|outdoor|beach|hiking|uv/i.test(all)) return 'outdoor';
  if (/moisturiz|serum|cleanser|skincare|face|eye.cream|toner|mask|bathroom|sink/i.test(all)) return 'bathroom';
  if (/lifestyle/i.test(all)) return 'lifestyle';
  return 'bathroom'; // default for beauty products
}

export type SceneSnapshot = SceneState;

interface SceneContextValue {
  scene: SceneState;
  transitionTo: (layout: SceneLayout, products?: Product[]) => void;
  setBackground: (background: SceneBackground) => void;
  setSetting: (setting: SceneSetting) => void;
  processUIDirective: (directive: UIDirective) => Promise<void>;
  openCheckout: () => void;
  closeCheckout: () => void;
  dismissWelcome: () => void;
  resetScene: () => void;
  getSceneSnapshot: () => SceneSnapshot;
  restoreSceneSnapshot: (snapshot: SceneSnapshot) => void;
}

const initialScene: SceneState = {
  layout: 'conversation-centered',
  setting: 'neutral',
  background: {
    type: 'gradient',
    value: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  },
  chatPosition: 'center',
  products: [],
  checkoutActive: false,
  welcomeActive: false,
  transitionKey: 'initial',
};

type SceneAction =
  | { type: 'TRANSITION_LAYOUT'; layout: SceneLayout; products?: Product[] }
  | { type: 'SET_BACKGROUND'; background: SceneBackground }
  | { type: 'SET_SETTING'; setting: SceneSetting }
  | { type: 'SET_PRODUCTS'; products: Product[] }
  | { type: 'OPEN_CHECKOUT' }
  | { type: 'CLOSE_CHECKOUT' }
  | { type: 'SHOW_WELCOME'; welcomeData: WelcomeData }
  | { type: 'DISMISS_WELCOME' }
  | { type: 'RESET' }
  | { type: 'RESTORE'; snapshot: SceneState };

function sceneReducer(state: SceneState, action: SceneAction): SceneState {
  switch (action.type) {
    case 'TRANSITION_LAYOUT': {
      const chatPosition = action.layout === 'conversation-centered' 
        ? 'center' 
        : action.layout === 'checkout' 
          ? 'minimized' 
          : 'bottom';
      
      return {
        ...state,
        layout: action.layout,
        chatPosition,
        products: action.products ?? state.products,
        transitionKey: `${action.layout}-${Date.now()}`,
      };
    }
    case 'SET_BACKGROUND':
      return { ...state, background: action.background };
    case 'SET_SETTING':
      return { ...state, setting: action.setting };
    case 'SET_PRODUCTS':
      return { ...state, products: action.products };
    case 'OPEN_CHECKOUT':
      return { ...state, checkoutActive: true, chatPosition: 'minimized' };
    case 'CLOSE_CHECKOUT':
      return { ...state, checkoutActive: false, chatPosition: 'bottom' };
    case 'SHOW_WELCOME':
      return { ...state, welcomeActive: true, welcomeData: action.welcomeData, layout: 'conversation-centered', chatPosition: 'center' };
    case 'DISMISS_WELCOME':
      return { ...state, welcomeActive: false, welcomeData: undefined };
    case 'RESET':
      return initialScene;
    case 'RESTORE':
      return action.snapshot;
    default:
      return state;
  }
}

const SceneContext = createContext<SceneContextValue | null>(null);

export const SceneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scene, dispatch] = useReducer(sceneReducer, initialScene);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const { generateBackground } = useGenerativeBackground();

  const transitionTo = useCallback((layout: SceneLayout, products?: Product[]) => {
    dispatch({ type: 'TRANSITION_LAYOUT', layout, products });
  }, []);

  const setBackground = useCallback((background: SceneBackground) => {
    dispatch({ type: 'SET_BACKGROUND', background });
  }, []);

  const setSetting = useCallback((setting: SceneSetting) => {
    dispatch({ type: 'SET_SETTING', setting });
  }, []);

  const processUIDirective = useCallback(async (directive: UIDirective) => {
    const { action, payload } = directive;

    switch (action) {
      case 'SHOW_PRODUCT':
      case 'SHOW_PRODUCTS': {
        if (payload.products && payload.products.length > 0) {
          const layout = payload.products.length === 1 ? 'product-hero' : 'product-grid';
          dispatch({ type: 'TRANSITION_LAYOUT', layout, products: payload.products });
        }

        // Use explicit sceneContext setting if provided. Otherwise, keep the current
        // setting when we already have a background image — only infer from products
        // if we're on the initial gradient (no image loaded yet).
        const curBg = sceneRef.current;
        const hasExistingImage = curBg.background.type === 'image' && curBg.background.value;
        const agentExplicitSetting = payload.sceneContext?.setting;
        const setting: SceneSetting = agentExplicitSetting
          || (hasExistingImage ? curBg.setting : inferSettingFromProducts(payload.products || []));
        const shouldGenerate = payload.sceneContext?.generateBackground !== false;

        // Auto-generate a backgroundPrompt if the agent didn't provide one
        // but respect the agent's generateBackground flag
        const sceneCtx: UIDirective['payload']['sceneContext'] = payload.sceneContext || { setting };
        if (!sceneCtx.backgroundPrompt && payload.products?.length) {
          const names = payload.products.slice(0, 3).map(p => p.name).join(', ');
          sceneCtx.backgroundPrompt = `A luxurious ${setting} setting perfect for showcasing beauty products like ${names}. Elegant, soft lighting, high-end atmosphere.`;
          sceneCtx.setting = setting;
        }

        // Skip regeneration if we already have (or are generating) an image for the same setting,
        // OR if we have a valid image and agent didn't explicitly request a new background
        const cur = sceneRef.current;
        const hasValidImage = cur.background.type === 'image' && cur.background.value && !cur.background.value.includes('default');
        const isGenerating = cur.background.type === 'generative' && cur.background.isLoading;
        const agentRequestedGeneration = payload.sceneContext?.generateBackground === true;
        const alreadyHasImage = (cur.setting === setting && (hasValidImage || isGenerating)) ||
          (hasValidImage && !agentRequestedGeneration); // preserve existing image unless explicitly asked to regenerate

        dispatch({ type: 'SET_SETTING', setting });

        if (shouldGenerate && !alreadyHasImage) {
          dispatch({
            type: 'SET_BACKGROUND',
            background: { type: 'generative', value: '', isLoading: true },
          });

          try {
            const result = await generateBackground(setting, payload.products || [], buildBgOptions(sceneCtx));
            const isGradient = result.startsWith('linear-gradient');
            dispatch({
              type: 'SET_BACKGROUND',
              background: { type: isGradient ? 'gradient' : 'image', value: result },
            });
          } catch (error) {
            console.error('Background generation failed:', error);
            dispatch({
              type: 'SET_BACKGROUND',
              background: {
                type: 'gradient',
                value: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
              },
            });
          }
        }
        break;
      }

      case 'CHANGE_SCENE': {
        // Keep current setting when agent doesn't explicitly provide one and we have a background
        const curForChange = sceneRef.current;
        const hasImageForChange = curForChange.background.type === 'image' && curForChange.background.value;
        const agentChangeSetting = payload.sceneContext?.setting;
        const sceneSetting: SceneSetting = agentChangeSetting
          || (hasImageForChange ? curForChange.setting : inferSettingFromProducts(payload.products || []));
        const shouldGen = payload.sceneContext?.generateBackground !== false;

        // Auto-generate a backgroundPrompt if not provided
        const changeCtx: UIDirective['payload']['sceneContext'] = payload.sceneContext || { setting: sceneSetting };
        const agentProvidedPrompt = !!payload.sceneContext?.backgroundPrompt;
        if (!changeCtx.backgroundPrompt) {
          changeCtx.backgroundPrompt = `A luxurious ${sceneSetting} setting with elegant, soft lighting and a high-end beauty atmosphere.`;
          changeCtx.setting = sceneSetting;
          changeCtx.generateBackground = true;
        }

        // Skip regeneration if same setting + already have (or generating) image + agent didn't request a specific prompt
        const curScene = sceneRef.current;
        const alreadyHasSceneImage = curScene.setting === sceneSetting && !agentProvidedPrompt && (
          (curScene.background.type === 'image' && curScene.background.value) ||
          (curScene.background.type === 'generative' && curScene.background.isLoading)
        );

        dispatch({ type: 'SET_SETTING', setting: sceneSetting });

        if (shouldGen && !alreadyHasSceneImage) {
          dispatch({
            type: 'SET_BACKGROUND',
            background: { type: 'generative', value: '', isLoading: true },
          });

          try {
            const result = await generateBackground(sceneSetting, payload.products || [], buildBgOptions(changeCtx));
            const isGradient = result.startsWith('linear-gradient');
            dispatch({
              type: 'SET_BACKGROUND',
              background: { type: isGradient ? 'gradient' : 'image', value: result },
            });
          } catch (error) {
            console.error('Background generation failed:', error);
            dispatch({
              type: 'SET_BACKGROUND',
              background: {
                type: 'gradient',
                value: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
              },
            });
          }
        }
        break;
      }

      case 'INITIATE_CHECKOUT':
        dispatch({ type: 'OPEN_CHECKOUT' });
        break;

      case 'CONFIRM_ORDER':
        dispatch({ type: 'CLOSE_CHECKOUT' });
        break;

      case 'WELCOME_SCENE': {
        // Show welcome overlay
        dispatch({
          type: 'SHOW_WELCOME',
          welcomeData: {
            message: payload.welcomeMessage || 'Welcome!',
            subtext: payload.welcomeSubtext,
          },
        });

        // Generate background for welcome scene
        const welcomeSetting: SceneSetting = payload.sceneContext?.setting || 'neutral';
        const shouldGenWelcome = payload.sceneContext?.generateBackground !== false;
        dispatch({ type: 'SET_SETTING', setting: welcomeSetting });

        if (shouldGenWelcome) {
          dispatch({
            type: 'SET_BACKGROUND',
            background: { type: 'generative', value: '', isLoading: true },
          });
          try {
            const result = await generateBackground(welcomeSetting, [], buildBgOptions(payload.sceneContext));
            const isGradient = result.startsWith('linear-gradient');
            dispatch({
              type: 'SET_BACKGROUND',
              background: { type: isGradient ? 'gradient' : 'image', value: result },
            });
          } catch (error) {
            console.error('Welcome background generation failed:', error);
          }
        } else {
          // Use static default background (e.g. for unknown/appended customers)
          dispatch({
            type: 'SET_BACKGROUND',
            background: { type: 'image', value: '/assets/backgrounds/default.png' },
          });
        }
        break;
      }

      case 'RESET_SCENE':
        dispatch({ type: 'RESET' });
        break;
    }
  }, [generateBackground]);

  const openCheckout = useCallback(() => {
    dispatch({ type: 'OPEN_CHECKOUT' });
  }, []);

  const closeCheckout = useCallback(() => {
    dispatch({ type: 'CLOSE_CHECKOUT' });
  }, []);

  const dismissWelcome = useCallback(() => {
    dispatch({ type: 'DISMISS_WELCOME' });
  }, []);

  const resetScene = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const getSceneSnapshot = useCallback((): SceneSnapshot => {
    return { ...sceneRef.current };
  }, []);

  const restoreSceneSnapshot = useCallback((snapshot: SceneSnapshot) => {
    dispatch({ type: 'RESTORE', snapshot });
  }, []);

  return (
    <SceneContext.Provider
      value={{
        scene,
        transitionTo,
        setBackground,
        setSetting,
        processUIDirective,
        openCheckout,
        closeCheckout,
        dismissWelcome,
        resetScene,
        getSceneSnapshot,
        restoreSceneSnapshot,
      }}
    >
      {children}
    </SceneContext.Provider>
  );
};

export const useScene = (): SceneContextValue => {
  const context = useContext(SceneContext);
  if (!context) {
    throw new Error('useScene must be used within SceneProvider');
  }
  return context;
};
