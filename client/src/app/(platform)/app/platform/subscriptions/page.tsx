"use client";

import { CreditCard } from "lucide-react";

type Plan = {
  name: string;
  price: string;
  color: string;
  orgs: string;
  users: string;
};

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "$0 / mo",
    color: "bg-gray-100 text-gray-600",
    orgs: "—",
    users: "—",
  },
  {
    name: "Starter",
    price: "$49 / mo",
    color: "bg-blue-50 text-blue-700",
    orgs: "—",
    users: "—",
  },
  {
    name: "Professional",
    price: "$149 / mo",
    color: "bg-violet-50 text-violet-700",
    orgs: "—",
    users: "—",
  },
  {
    name: "Enterprise",
    price: "Custom",
    color: "bg-amber-50 text-amber-700",
    orgs: "—",
    users: "—",
  },
];

const SUB_COLUMNS = [
  "Organization",
  "Plan",
  "Status",
  "Billing Cycle",
  "Next Renewal",
  "Actions",
];

export default function PlatformSubscriptionsPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* Plan tier cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <span
              className={`inline-block rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${plan.color}`}
            >
              {plan.name}
            </span>
            <p className="mt-3 text-xl font-semibold text-gray-900">
              {plan.price}
            </p>
            <div className="mt-3 space-y-1 text-xs text-gray-500">
              <p>Active orgs: {plan.orgs}</p>
              <p>Total users: {plan.users}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Subscriptions table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-gray-900">
            Active Subscriptions
          </h2>
        </div>
        <div className="border-b border-gray-200 px-5 py-3">
          <div className="grid grid-cols-6 gap-4 text-xs font-medium uppercase tracking-wide text-gray-400">
            {SUB_COLUMNS.map((col) => (
              <span key={col}>{col}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <CreditCard className="h-9 w-9 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">
            Subscription management coming soon
          </p>
          <p className="text-xs text-gray-400">
            Backend API: GET /platform/subscriptions
          </p>
        </div>
      </div>
    </div>
  );
}
