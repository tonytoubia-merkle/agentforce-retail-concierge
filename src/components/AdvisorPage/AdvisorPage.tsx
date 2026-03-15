import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useScene } from '@/contexts/SceneContext';
import { useConversation } from '@/contexts/ConversationContext';
import { GenerativeBackground } from '@/components/GenerativeBackground';
import { ChatInterface } from '@/components/ChatInterface';
import { CheckoutOverlay } from '@/components/CheckoutOverlay';
import { SkinAnalysisModal, SkinConciergeWelcome } from '@/components/SkinAnalysis';
import { RetailerHandoff } from '@/components/RetailerHandoff';
import { WelcomeScreen } from '@/components/WelcomeScreen/WelcomeScreen';
import { WelcomeLoader } from '@/components/WelcomeScreen/WelcomeLoader';
import { DemoPanel } from '@/components/Storefront/DemoPanel';
import { ProfileDropdown } from '@/components/Storefront/ProfileDropdown';
import type { AdvisorMode } from '@/types/scene';

interface AdvisorPageProps {
  mode?: AdvisorMode;
}

export const AdvisorPage: React.FC<AdvisorPageProps> = ({ mode = 'beauty' }) => {
  const { scene, setAdvisorMode, setBackground } = useScene();
  const { messages, sendMessage, isAgentTyping, isLoadingWelcome, suggestedActions } = useConversation();
  const navigate = useNavigate();

  // Skin concierge has its own landing — show it until the user takes an action
  const [skinWelcomeActive, setSkinWelcomeActive] = useState(mode === 'skin-concierge');

  // Sync mode into SceneContext so product cards read it without prop drilling
  useEffect(() => {
    setAdvisorMode(mode);
  }, [mode, setAdvisorMode]);

  // Skin concierge gets its own consultative gradient — never the generative beauty background
  useEffect(() => {
    if (mode === 'skin-concierge') {
      setBackground({
        type: 'gradient',
        value: 'linear-gradient(150deg, #071419 0%, #0d2530 35%, #0c2a34 55%, #0a1e28 80%, #051018 100%)',
      });
    }
  }, [mode, setBackground]);

  return (
    <div className="relative min-h-screen">
      <GenerativeBackground
        background={scene.background}
        setting={scene.setting}
      />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white/80 hover:text-white bg-black/20 hover:bg-black/30 backdrop-blur-sm rounded-full transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Store
        </button>

        <div className="flex items-center gap-2">
          {mode === 'skin-concierge' && (
            <span className="px-3 py-1 text-xs font-medium text-white/70 bg-black/20 backdrop-blur-sm rounded-full border border-white/10">
              Skin Concierge
            </span>
          )}
          <ProfileDropdown />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'skin-concierge' && skinWelcomeActive ? (
          <SkinConciergeWelcome key="skin-welcome" onDismiss={() => setSkinWelcomeActive(false)} />
        ) : isLoadingWelcome ? (
          <WelcomeLoader key="loader" />
        ) : scene.welcomeActive ? (
          <WelcomeScreen key="welcome" />
        ) : (
          <motion.div
            key="main-chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 min-h-screen flex flex-col"
          >
            <ChatInterface
              position={scene.chatPosition}
              messages={messages}
              onSendMessage={sendMessage}
              isAgentTyping={isAgentTyping}
              isMinimized={scene.layout === 'checkout' || scene.retailerHandoffActive}
              suggestedActions={suggestedActions}
              sceneLayout={scene.layout}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Beauty mode: standard checkout overlay */}
      {mode === 'beauty' && (
        <AnimatePresence>
          {scene.checkoutActive && <CheckoutOverlay />}
        </AnimatePresence>
      )}

      {/* Skin Concierge mode: skin analysis modal + retailer handoff */}
      {mode === 'skin-concierge' && (
        <>
          <AnimatePresence>
            {scene.skinAnalysisActive && <SkinAnalysisModal />}
          </AnimatePresence>
          <AnimatePresence>
            {scene.retailerHandoffActive && <RetailerHandoff />}
          </AnimatePresence>
        </>
      )}

      <DemoPanel />
    </div>
  );
};
