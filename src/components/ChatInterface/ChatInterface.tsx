import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import { TypingIndicator } from './TypingIndicator';
import { SuggestedActions } from './SuggestedActions';
import { RememberMeButton } from './RememberMeButton';
import { useCustomer } from '@/contexts/CustomerContext';
import type { AgentMessage } from '@/types/agent';
import type { SceneLayout } from '@/types/scene';

interface ChatInterfaceProps {
  position: 'center' | 'bottom' | 'minimized';
  messages: AgentMessage[];
  onSendMessage: (message: string) => void;
  isAgentTyping: boolean;
  isMinimized?: boolean;
  suggestedActions?: string[];
  sceneLayout: SceneLayout;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  position,
  messages,
  onSendMessage,
  isAgentTyping,
  isMinimized = false,
  suggestedActions = [],
  sceneLayout,
}) => {
  const [inputValue, setInputValue] = useState('');
  const { customer } = useCustomer();

  // Show "Remember Me" button for users who are not fully identified
  // (anonymous = no customer, appended = 3P data only, both should see it)
  const showRememberMe = !customer || customer.merkuryIdentity?.identityTier !== 'known';

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  if (isMinimized) {
    return (
      <motion.button
        className="fixed bottom-4 right-4 w-14 h-14 bg-white rounded-full shadow-lg flex items-center justify-center"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </motion.button>
    );
  }

  const hasConversation = messages.length > 0 || isAgentTyping;

  // Initial state: vertically centered welcome + input
  if (position === 'center' && !hasConversation) {
    return (
      <motion.div
        layout
        className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-4 flex-1"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <h1 className="text-3xl font-light text-white mb-1">
            I'm your beauty advisor
          </h1>
          <p className="text-white/70 text-base">
            How can I help you today?
          </p>
        </motion.div>

        {suggestedActions.length > 0 && (
          <SuggestedActions actions={suggestedActions} onSelect={onSendMessage} />
        )}

        <div className="w-full mt-4">
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            placeholder="Ask me anything..."
            isCentered
          />
          {showRememberMe && (
            <div className="flex justify-center mt-3">
              <RememberMeButton onSubmit={onSendMessage} />
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // Active conversation: centered when short, scrollable when tall.
  // The outer container is full-height flex. The scroll area uses
  // justify-center so short conversations sit in the middle, but once
  // content overflows it naturally scrolls and the input stays pinned.
  return (
    <motion.div
      layout
      className="flex flex-col w-full max-w-2xl mx-auto px-4 h-screen"
    >
      {/* Scrollable chat pane — spacers center content when short, collapse when tall */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-2 scrollbar-hide">
        <div className="min-h-full flex flex-col">
          <div className="flex-1" />
          <ChatMessages messages={messages} sceneLayout={sceneLayout} />

          {isAgentTyping && <TypingIndicator />}

          {!isAgentTyping && suggestedActions.length > 0 && (
            <SuggestedActions actions={suggestedActions} onSelect={onSendMessage} />
          )}
          <div className="flex-1" />
        </div>
      </div>

      {/* Fixed input — never scrolls away */}
      <div className="shrink-0 pb-4 pt-2">
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          placeholder="Ask me anything..."
          isCentered={false}
        />
        {showRememberMe && (
          <div className="flex justify-center mt-2">
            <RememberMeButton onSubmit={onSendMessage} />
          </div>
        )}
      </div>
    </motion.div>
  );
};
