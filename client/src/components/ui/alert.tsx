"use client";

/**
 * Alert Design System
 * - destructive = system / backend error
 * - warning = validation / non-blocking issue
 * - risk-* = academic performance alerts
 * - info = neutral system message
 * - success = positive confirmation
 */

import { cn } from "@/utils/cn";
import {
  AlertCircle,
  AlertOctagon,
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export const ALERT_VARIANTS = [
  "default",
  "success",
  "warning",
  "destructive",
  "info",
  "risk-low",
  "risk-medium",
  "risk-high",
] as const;

export type AlertVariant = (typeof ALERT_VARIANTS)[number];

type AlertConfig = {
  wrapper: string;
  icon: LucideIcon;
};

const VARIANT_CONFIG: Record<AlertVariant, AlertConfig> = {
  default: {
    wrapper: "border border-slate-200 bg-slate-50 text-slate-700",
    icon: Info,
  },
  success: {
    wrapper: "border border-green-300 bg-green-50 text-green-800",
    icon: CheckCircle2,
  },
  warning: {
    wrapper: "border border-amber-300 bg-amber-50 text-amber-800",
    icon: AlertCircle,
  },
  destructive: {
    wrapper: "border border-red-300 bg-red-50 text-red-800",
    icon: XCircle,
  },
  info: {
    wrapper: "border border-blue-300 bg-blue-50 text-blue-800",
    icon: Info,
  },
  "risk-low": {
    wrapper: "border border-emerald-300 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  "risk-medium": {
    wrapper: "border border-orange-300 bg-orange-50 text-orange-800",
    icon: AlertCircle,
  },
  "risk-high": {
    wrapper: "border border-red-500 bg-red-100 text-red-900 font-medium",
    icon: AlertOctagon,
  },
};

export type AlertProps = {
  title: string;
  description?: string | ReactNode;
  variant?: AlertVariant;
  className?: string;
};

export const Alert = ({
  title,
  description,
  variant = "default",
  className,
}: AlertProps): React.JSX.Element => {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl px-4 py-3 text-sm",
        config.wrapper,
        className,
      )}
      role="alert"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {description != null && description !== "" && (
          <div className="mt-0.5 text-sm [&>p]:mt-0">{description}</div>
        )}
      </div>
    </div>
  );
};

export type ErrorAlertProps = Omit<AlertProps, "variant">;
export function ErrorAlert(props: ErrorAlertProps): React.JSX.Element {
  return <Alert {...props} variant="destructive" />;
}

export type WarningAlertProps = Omit<AlertProps, "variant">;
export function WarningAlert(props: WarningAlertProps): React.JSX.Element {
  return <Alert {...props} variant="warning" />;
}

export type SuccessAlertProps = Omit<AlertProps, "variant">;
export function SuccessAlert(props: SuccessAlertProps): React.JSX.Element {
  return <Alert {...props} variant="success" />;
}

export type InfoAlertProps = Omit<AlertProps, "variant">;
export function InfoAlert(props: InfoAlertProps): React.JSX.Element {
  return <Alert {...props} variant="info" />;
}

export type RiskAlertLevel = "risk-low" | "risk-medium" | "risk-high";

export type RiskAlertProps = Omit<AlertProps, "variant"> & {
  level: RiskAlertLevel;
};

export function RiskAlert({ level, ...props }: RiskAlertProps): React.JSX.Element {
  return <Alert {...props} variant={level} />;
}

/*
  Example usage (prefer semantic wrappers; use <Alert variant={...} /> only when needed):

  <ErrorAlert title="Chyba" description="Nepodařilo se načíst data." />
  <WarningAlert title="Pozor" description="Vyplň prosím povinná pole." />
  <SuccessAlert title="Hotovo" description="Změny byly uloženy." />
  <InfoAlert title="Osobní režim" description="Připoj se ke škole pro týmové funkce." />
  <RiskAlert level="risk-high" title="Vysoké riziko" description="2 žáci výrazně za průměrem." />
  <Alert variant={ALERT_VARIANTS[0]} title="..." description="..." />
*/
