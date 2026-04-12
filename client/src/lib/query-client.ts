"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type QueryKeyPart = string | number | boolean | null | undefined;
export type QueryKey = readonly QueryKeyPart[];

type QueryEntry<T = unknown> = {
  data?: T;
  error?: unknown;
  updatedAt: number;
  promise: Promise<T> | null;
  listeners: Set<() => void>;
};

type QueryState<T> = {
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
};

const queryEntries = new Map<string, QueryEntry<unknown>>();

function serializeKey(queryKey: QueryKey): string {
  return JSON.stringify(queryKey);
}

function matchesPrefix(queryKey: QueryKey, prefix: QueryKey): boolean {
  if (prefix.length > queryKey.length) return false;
  return prefix.every((part, index) => queryKey[index] === part);
}

function ensureEntry<T>(queryKey: QueryKey): QueryEntry<T> {
  const key = serializeKey(queryKey);
  const existing = queryEntries.get(key) as QueryEntry<T> | undefined;
  if (existing) return existing;
  const created: QueryEntry<T> = {
    updatedAt: 0,
    promise: null,
    listeners: new Set(),
  };
  queryEntries.set(key, created as QueryEntry<unknown>);
  return created;
}

function notify(queryKey: QueryKey) {
  const entry = ensureEntry(queryKey);
  entry.listeners.forEach((listener) => listener());
}

function isFresh(queryKey: QueryKey, staleTime: number) {
  const entry = ensureEntry(queryKey);
  return entry.updatedAt > 0 && Date.now() - entry.updatedAt < staleTime;
}

export const queryClient = {
  async fetchQuery<T>({
    queryKey,
    queryFn,
    staleTime = 0,
    force = false,
  }: {
    queryKey: QueryKey;
    queryFn: () => Promise<T>;
    staleTime?: number;
    force?: boolean;
  }): Promise<T> {
    const entry = ensureEntry<T>(queryKey);
    if (!force && entry.data !== undefined && isFresh(queryKey, staleTime)) {
      return entry.data;
    }
    if (entry.promise) {
      return entry.promise;
    }

    entry.promise = queryFn()
      .then((result) => {
        entry.data = result;
        entry.error = undefined;
        entry.updatedAt = Date.now();
        entry.promise = null;
        notify(queryKey);
        return result;
      })
      .catch((error) => {
        entry.error = error;
        entry.promise = null;
        notify(queryKey);
        throw error;
      });

    return entry.promise;
  },

  invalidateQueries(
    prefix: QueryKey,
    options?: { exclude?: QueryKey[]; notify?: boolean },
  ) {
    const excluded = new Set(
      (options?.exclude ?? []).map((queryKey) => serializeKey(queryKey)),
    );
    for (const [serializedKey, entry] of queryEntries.entries()) {
      if (excluded.has(serializedKey)) continue;
      const queryKey = JSON.parse(serializedKey) as QueryKey;
      if (!matchesPrefix(queryKey, prefix)) continue;
      entry.updatedAt = 0;
      entry.promise = null;
      if (options?.notify !== false) {
        notify(queryKey);
      }
    }
  },

  setQueryData<T>(
    queryKey: QueryKey,
    updater: T | ((current: T | undefined) => T | undefined),
  ) {
    const entry = ensureEntry<T>(queryKey);
    const nextValue =
      typeof updater === "function"
        ? (updater as (current: T | undefined) => T | undefined)(entry.data)
        : updater;
    if (nextValue === undefined) {
      delete entry.data;
    } else {
      entry.data = nextValue;
    }
    entry.error = undefined;
    entry.updatedAt = nextValue === undefined ? 0 : Date.now();
    entry.promise = null;
    notify(queryKey);
  },

  subscribe(queryKey: QueryKey, listener: () => void) {
    const entry = ensureEntry(queryKey);
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
    };
  },

  getSnapshot<T>(queryKey: QueryKey): QueryEntry<T> {
    return ensureEntry<T>(queryKey);
  },

  isFresh,

  clear() {
    queryEntries.clear();
  },
};

export function useQuery<T>({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 0,
}: {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  enabled?: boolean;
  staleTime?: number;
}) {
  const keyString = useMemo(() => serializeKey(queryKey), [queryKey]);
  const key = useMemo(() => JSON.parse(keyString) as QueryKey, [keyString]);
  const queryFnRef = useRef(queryFn);
  const [state, setState] = useState<QueryState<T>>(() => {
    const entry = queryClient.getSnapshot<T>(key);
    return {
      data: entry.data,
      error: entry.error,
      isLoading: enabled && entry.data === undefined,
    };
  });

  useEffect(() => {
    queryFnRef.current = queryFn;
  }, [queryFn]);

  const syncFromCache = useCallback(() => {
    const entry = queryClient.getSnapshot<T>(key);
    const nextIsLoading = enabled && entry.data === undefined && !!entry.promise;
    setState((current) => {
      if (
        current.data === entry.data &&
        current.error === entry.error &&
        current.isLoading === nextIsLoading
      ) {
        return current;
      }
      return {
        data: entry.data,
        error: entry.error,
        isLoading: nextIsLoading,
      };
    });
  }, [enabled, key]);

  const load = useCallback(
    async (force = false) => {
      if (!enabled) {
        setState((current) => {
          if (
            current.data === undefined &&
            current.error === undefined &&
            current.isLoading === false
          ) {
            return current;
          }
          return { data: undefined, error: undefined, isLoading: false };
        });
        return undefined;
      }
      setState((current) => {
        const nextIsLoading = current.data === undefined || force;
        if (current.isLoading === nextIsLoading) {
          return current;
        }
        return {
          ...current,
          isLoading: nextIsLoading,
        };
      });
      try {
        const result = await queryClient.fetchQuery<T>({
          queryKey: key,
          queryFn: () => queryFnRef.current(),
          staleTime,
          force,
        });
        const entry = queryClient.getSnapshot<T>(key);
        setState((current) => {
          if (
            current.data === result &&
            current.error === entry.error &&
            current.isLoading === false
          ) {
            return current;
          }
          return {
            data: result,
            error: entry.error,
            isLoading: false,
          };
        });
        return result;
      } catch (error) {
        const entry = queryClient.getSnapshot<T>(key);
        setState((current) => {
          if (
            current.data === entry.data &&
            current.error === error &&
            current.isLoading === false
          ) {
            return current;
          }
          return {
            data: entry.data,
            error,
            isLoading: false,
          };
        });
        return undefined;
      }
    },
    [enabled, key, staleTime],
  );

  useEffect(() => {
    if (!enabled) {
      setState({ data: undefined, error: undefined, isLoading: false });
      return;
    }

    const unsubscribe = queryClient.subscribe(key, () => {
      syncFromCache();
      if (!queryClient.isFresh(key, staleTime)) {
        void load(true);
      }
    });

    if (!queryClient.isFresh(key, staleTime)) {
      void load();
    } else {
      syncFromCache();
    }

    return unsubscribe;
  }, [enabled, key, load, staleTime, syncFromCache]);

  return {
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    refetch: () => load(true),
  };
}
