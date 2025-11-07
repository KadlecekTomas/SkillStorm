"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/utils/cn";

type BaseModalProps = {
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export const BaseModal = ({
  title,
  description,
  open,
  onOpenChange,
  children,
}: BaseModalProps) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" />
      <Dialog.Content asChild>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25 }}
          className={cn(
            "fixed inset-x-4 top-20 z-50 mx-auto max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:inset-x-auto",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-semibold text-slate-900">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-slate-500">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="mt-6">{children}</div>
        </motion.div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
