import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import { ProductShowcase } from '@/components/ProductShowcase';
import { CollapsedProductCard } from '@/components/ProductShowcase/CollapsedProductCard';
import type { AgentMessage } from '@/types/agent';
import type { SceneLayout } from '@/types/scene';

interface ChatMessagesProps {
  messages: AgentMessage[];
  sceneLayout: SceneLayout;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, sceneLayout }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Find indices of all messages with product directives
  const directiveIndices = messages.reduce<number[]>((acc, msg, i) => {
    if (msg.uiDirective?.payload?.products?.length) {
      acc.push(i);
    }
    return acc;
  }, []);

  const lastDirectiveIdx = directiveIndices.length > 0
    ? directiveIndices[directiveIndices.length - 1]
    : -1;

  return (
    <div className="flex flex-col gap-2">
      {messages.map((msg, i) => {
        const products = msg.uiDirective?.payload?.products;
        const hasProducts = products && products.length > 0;
        const isLatestDirective = i === lastDirectiveIdx;

        return (
          <div key={msg.id}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed',
                msg.role === 'user'
                  ? 'ml-auto bg-white/30 text-white rounded-br-md'
                  : 'mr-auto bg-white/20 text-white/90 rounded-bl-md'
              )}
            >
              {msg.content}
            </motion.div>
            {hasProducts && isLatestDirective && (
              <ProductShowcase products={products} layout={sceneLayout} />
            )}
            {hasProducts && !isLatestDirective && (
              <CollapsedProductCard products={products} layout={sceneLayout} />
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
