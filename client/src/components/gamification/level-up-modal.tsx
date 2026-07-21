"use client";

import { AnimatePresence, motion } from "framer-motion";

type LevelUpModalProps = {
  open: boolean;
  level: number;
  onOpenChange: (open: boolean) => void;
};

export const LevelUpModal = ({ open, level, onOpenChange }: LevelUpModalProps): React.JSX.Element => (
  <AnimatePresence>
    {open && (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => onOpenChange(false)}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="max-w-md rounded-3xl bg-gradient-to-br from-purple-600 to-indigo-600 p-6 text-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="text-center text-2xl font-bold">Nová úroveň! 🎉</p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <div className="rounded-full bg-white/20 px-4 py-2 text-sm uppercase tracking-wide">
              Úroveň {level}
            </div>
            <p className="text-center text-sm text-white/90">
              Skvělá práce! Pokračuj ve sbírání XP za testy a aktivitu v platformě.
            </p>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
