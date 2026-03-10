import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  label?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ label }) => {
  return (
    <div className="flex flex-col gap-1 mb-4">
      <div className="flex items-center gap-1 px-4 py-3 max-w-[80px] bg-white/10 rounded-2xl rounded-bl-md">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-white/60 rounded-full"
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
      {label && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-white/40 text-[11px] pl-1"
        >
          {label}
        </motion.p>
      )}
    </div>
  );
};
