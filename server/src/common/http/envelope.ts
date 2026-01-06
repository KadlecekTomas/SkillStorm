export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; meta?: any };

export const ok = <T>(
  data: T | Promise<T>,
): ApiResponse<T> | Promise<ApiResponse<T>> => {
  if (data instanceof Promise) {
    return data.then((resolved) => ({ success: true, data: resolved }));
  }
  return { success: true, data };
};

export const fail = (error: string, meta?: any): ApiResponse<never> => ({
  success: false,
  error,
  ...(meta ? { meta } : {}),
});
