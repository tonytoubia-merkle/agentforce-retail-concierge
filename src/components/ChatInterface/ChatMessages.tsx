import { useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import { ProductShowcase } from '@/components/ProductShowcase';
import { CollapsedProductCard } from '@/components/ProductShowcase/CollapsedProductCard';
import type { AgentMessage } from '@/types/agent';
import type { AdvisorMode, SceneLayout } from '@/types/scene';

// ─── Routine card parser ───────────────────────────────────────────────────

interface RoutineSection {
  title: string;
  steps: string[];
  isMorning: boolean;
}

interface ParsedRoutine {
  preText: string;
  sections: RoutineSection[];
  postText: string;
}

function parseRoutines(text: string): ParsedRoutine | null {
  // Flatten newlines — msg.content arrives as a single line from the agent client
  const flat = text.replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();

  // Find section header positions (Morning Routine: / Evening Routine:)
  const morningMatch = /\bMorning Routine\s*:/i.exec(flat);
  const eveningMatch = /\bEvening Routine\s*:/i.exec(flat);
  if (!morningMatch && !eveningMatch) return null;

  // Step separator: "Step N — " (handles em dash \u2014, en dash \u2013, hyphen)
  const STEP_RE = /Step\s*\d+\s*[\u2014\u2013-]+\s*/i;

  const splitSteps = (fragment: string): string[] =>
    fragment
      .split(new RegExp(STEP_RE.source, 'gi'))
      .slice(1) // first element is empty string before first Step
      .map((s, idx, arr) => {
        const t = s.trim();
        // For the last step, strip any trailing closing sentence
        if (idx === arr.length - 1) {
          const closeIdx = t.search(/\s+(?:This|These|Would|Let|You|Feel|I |If )\b/);
          return closeIdx > 0 ? t.slice(0, closeIdx).trim() : t;
        }
        return t;
      })
      .filter(Boolean);

  const sections: RoutineSection[] = [];

  if (morningMatch) {
    const start = morningMatch.index + morningMatch[0].length;
    const end = eveningMatch ? eveningMatch.index : flat.length;
    const steps = splitSteps(flat.slice(start, end));
    if (steps.length) sections.push({ title: 'Morning Routine', steps, isMorning: true });
  }

  if (eveningMatch) {
    const start = eveningMatch.index + eveningMatch[0].length;
    const steps = splitSteps(flat.slice(start));
    if (steps.length) sections.push({ title: 'Evening Routine', steps, isMorning: false });
  }

  if (!sections.length) return null;

  const firstIdx = morningMatch ? morningMatch.index : eveningMatch!.index;
  const preText = flat.slice(0, firstIdx).trim();

  return { preText, sections, postText: '' };
}

// ─── Routine card component ────────────────────────────────────────────────

function RoutineCard({ section, index }: { section: RoutineSection; index: number }) {
  const accentClass = section.isMorning
    ? 'from-amber-500/20 to-orange-400/10 border-amber-400/20'
    : 'from-indigo-500/20 to-violet-400/10 border-indigo-400/20';
  const dotClass = section.isMorning ? 'bg-amber-400/70' : 'bg-indigo-400/70';
  const labelClass = section.isMorning ? 'text-amber-300/80' : 'text-indigo-300/80';
  const icon = section.isMorning ? '☀️' : '🌙';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.12 }}
      className={`rounded-xl border bg-gradient-to-br ${accentClass} backdrop-blur-sm p-3.5 mb-2.5`}
    >
      <div className={`flex items-center gap-1.5 mb-2.5 ${labelClass} text-[11px] font-semibold uppercase tracking-wider`}>
        <span>{icon}</span>
        <span>{section.title}</span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {section.steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px] text-white/85 leading-snug">
            <span className={`mt-0.5 w-4 h-4 rounded-full ${dotClass} flex items-center justify-center text-[9px] font-bold text-black/70 flex-shrink-0`}>
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </motion.div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface ChatMessagesProps {
  messages: AgentMessage[];
  sceneLayout: SceneLayout;
  advisorMode?: AdvisorMode;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, sceneLayout, advisorMode }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  // Use URL as the authoritative source for skin-advisor mode
  const isSkinAdvisor = location.pathname.includes('skin-advisor') || advisorMode === 'skin-concierge';

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

        // In skin-advisor mode, parse routine sections from completed agent messages
        const isSkinAgent = isSkinAdvisor && msg.role === 'agent' && !msg.isStreaming;
        const routine = isSkinAgent ? parseRoutines(msg.content) : null;

        return (
          <div key={msg.id}>
            {msg.content.trim() && !routine && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed backdrop-blur-sm',
                msg.role === 'user'
                  ? 'ml-auto bg-black/40 text-white rounded-br-md shadow-sm'
                  : 'mr-auto bg-black/30 text-white/95 rounded-bl-md shadow-sm'
              )}
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
            >
              {msg.content}
              {msg.isStreaming && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="inline-block w-[2px] h-[1em] bg-white/70 ml-0.5 align-middle"
                />
              )}
            </motion.div>
            )}
            {routine && (
              <div className="mr-auto max-w-[90%]">
                {routine.preText && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-3 py-2 mb-2 rounded-2xl rounded-bl-md text-[13px] leading-relaxed bg-black/30 text-white/95 backdrop-blur-sm shadow-sm"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                  >
                    {routine.preText}
                  </motion.div>
                )}
                {routine.sections.map((section, idx) => (
                  <RoutineCard key={section.title} section={section} index={idx} />
                ))}
                {routine.postText && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: routine.sections.length * 0.12 }}
                    className="px-3 py-2 mt-2 rounded-2xl rounded-bl-md text-[13px] leading-relaxed bg-black/30 text-white/95 backdrop-blur-sm shadow-sm"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                  >
                    {routine.postText}
                  </motion.div>
                )}
              </div>
            )}
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
