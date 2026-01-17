"use client";

import type { ComponentType } from "react";
import { GuardBoundary } from "@/lib/guard/GuardBoundary";
import type { GuardOptions } from "@/lib/guard/useGuard";

export const withGuard =
  (options?: GuardOptions) =>
  <P extends object>(Component: ComponentType<P>): ComponentType<P> => {
    const GuardedComponent = (props: P): React.JSX.Element => (
      <GuardBoundary {...options}>
        <Component {...props} />
      </GuardBoundary>
    );

    GuardedComponent.displayName = `WithGuard(${Component.displayName ?? Component.name ?? "Component"})`;
    return GuardedComponent;
  };
