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
  // Strip any embedded uiDirective JSON (agent appends it at the end of message text)
  const jsonIdx = text.indexOf('{"uiDirective"');
  const cleanText = jsonIdx > 0 ? text.slice(0, jsonIdx).trim() : text;

  const lines = cleanText.split('\n');
  const sections: RoutineSection[] = [];
  let current: RoutineSection | null = null;
  let firstSectionLine = -1;
  let lastStepLine = -1;

  const isHeaderLike = (l: string) => /[*#:]/.test(l) || l.split(/\s+/).length <= 6;
  const isMorningHeader = (l: string) =>
    l.length < 80 && /\b(morning|a\.?m\.?)\b/i.test(l) && !/\b(evening|night|p\.?m\.?)\b/i.test(l) && isHeaderLike(l);
  const isEveningHeader = (l: string) =>
    l.length < 80 && /\b(evening|p\.?m\.?|night(?:time)?|bedtime)\b/i.test(l) && !/\bmorning\b/i.test(l) && isHeaderLike(l);
  // Match dash/bullet markers OR "Step N — " style lines
  const isStep = (l: string) =>
    /^\s*[-*•]/.test(l) ||
    /^\s*\d+[.)]\s/.test(l) ||
    /^\s*step\s*\d+/i.test(l);

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    if (isMorningHeader(trimmed)) {
      if (firstSectionLine === -1) firstSectionLine = i;
      current = { title: 'Morning Routine', steps: [], isMorning: true };
      sections.push(current);
    } else if (isEveningHeader(trimmed)) {
      if (firstSectionLine === -1) firstSectionLine = i;
      current = { title: 'Evening Routine', steps: [], isMorning: false };
      sections.push(current);
    } else if (current && isStep(trimmed)) {
      // Strip "Step N — ", dash bullet, numbered marker, and bold markers
      const step = trimmed
        .replace(/^\s*step\s*\d+\s*[—–\-]+\s*/i, '')
        .replace(/^\s*[-*•]\s*/, '')
        .replace(/^\s*\d+[.)]\s*/, '')
        .replace(/\*\*/g, '')
        .trim();
      if (step) {
        current.steps.push(step);
        lastStepLine = i;
      }
    } else if (current) {
      // Non-step line after section started — stop collecting
      current = null;
    }
  }

  const validSections = sections.filter((s) => s.steps.length > 0);
  if (validSections.length === 0) return null;

  const preText = firstSectionLine > 0
    ? lines.slice(0, firstSectionLine).join('\n').trim()
    : '';
  const rawPost = lastStepLine >= 0 && lastStepLine < lines.length - 1
    ? lines.slice(lastStepLine + 1).join('\n').trim()
    : '';
  // Strip any JSON that leaked into post-text
  const postJsonIdx = rawPost.indexOf('{');
  const postText = postJsonIdx > 0 ? rawPost.slice(0, postJsonIdx).trim() : rawPost;

  return { preText, sections: validSections, postText };
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
