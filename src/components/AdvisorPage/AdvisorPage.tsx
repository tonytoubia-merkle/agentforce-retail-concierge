import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useScene } from '@/contexts/SceneContext';
import { useConversation } from '@/contexts/ConversationContext';
import { useCustomer } from '@/contexts/CustomerContext';
import { GenerativeBackground } from '@/components/GenerativeBackground';
import { ChatInterface } from '@/components/ChatInterface';
import { CheckoutOverlay } from '@/components/CheckoutOverlay';
import { WelcomeScreen } from '@/components/WelcomeScreen/WelcomeScreen';
import { WelcomeLoader } from '@/components/WelcomeScreen/WelcomeLoader';
import { DemoPanel } from '@/components/Storefront/DemoPanel';
import { ProfileDropdown } from '@/components/Storefront/ProfileDropdown';
import { sceneAnimationVariants } from '@/utils/animations';

export const AdvisorPage: React.FC = () => {
  const { scene } = useScene();
  const { messages, sendMessage, isAgentTyping, isLoadingWelcome, suggestedActions } = useConversation();
  const { customer, isAuthenticated, signIn } = useCustomer();
  const navigate = useNavigate();

  const isKnown = customer?.merkuryIdentity?.identityTier === 'known';
  const isAppended = customer?.merkuryIdentity?.identityTier === 'appended';
  const isPseudonymous = (isKnown || isAppended) && !isAuthenticated;

  return (
    <div className="relative min-h-screen">
      <GenerativeBackground
        background={scene.background}
        setting={scene.setting}
      />

      {/* Advisor header overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-4">
        {/* Back to store */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white/80 hover:text-white bg-black/20 hover:bg-black/30 backdrop-blur-sm rounded-full transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Store
        </button>

        {/* Right side: Sign In + Profile */}
        <div className="flex items-center gap-2">
          {isPseudonymous && (
            <button
              onClick={signIn}
              className="px-3 py-1.5 text-sm font-medium bg-white/90 hover:bg-white text-stone-900 rounded-full backdrop-blur-sm transition-all shadow-sm"
            >
              Sign In
            </button>
          )}
          <ProfileDropdown />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isLoadingWelcome ? (
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
              isMinimized={scene.layout === 'checkout'}
              suggestedActions={suggestedActions}
              sceneLayout={scene.layout}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scene.checkoutActive && (
          <CheckoutOverlay />
        )}
      </AnimatePresence>

      <DemoPanel />
    </div>
  );
};
