export const LIVE_SEMANTIC_EVENT_TYPES = [
  'PREDICTION_SUBMITTED',
  'ALGORITHM_STEP_ADDED',
  'PROGRAM_RUN',
  'TEST_FAILED',
  'DEBUG_HYPOTHESIS_SUBMITTED',
  'COMPONENT_PLACED',
  'PLACEMENT_REJECTED',
  'MEASUREMENT_TAKEN',
  'MODEL_CHANGED',
  'HINT_REQUESTED',
  'CHECKPOINT_COMPLETED',
  'EXPLANATION_SUBMITTED',
] as const;

export type LiveSemanticEventType = (typeof LIVE_SEMANTIC_EVENT_TYPES)[number];

export const LIVE_EVIDENCE_EVENT_TYPES = new Set<LiveSemanticEventType>([
  'PREDICTION_SUBMITTED',
  'DEBUG_HYPOTHESIS_SUBMITTED',
  'MEASUREMENT_TAKEN',
  'MODEL_CHANGED',
  'CHECKPOINT_COMPLETED',
  'EXPLANATION_SUBMITTED',
]);

export const MAX_LIVE_EVENT_PAYLOAD_BYTES = 8 * 1024;

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'pointer',
  'pointerx',
  'pointery',
  'coordinate',
  'coordinates',
  'cursor',
  'mouse',
  'mousemove',
  'rawaudio',
  'rawvideo',
  'biometric',
  'biometrics',
  'screenrecording',
]);

export function semanticPayloadViolation(payload: unknown): string | null {
  if (payload === undefined || payload === null) return null;

  const encoded = JSON.stringify(payload);
  if (Buffer.byteLength(encoded, 'utf8') > MAX_LIVE_EVENT_PAYLOAD_BYTES) {
    return 'PAYLOAD_TOO_LARGE';
  }

  const stack: unknown[] = [payload];
  while (stack.length > 0) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    if (!current || typeof current !== 'object') continue;
    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (FORBIDDEN_PAYLOAD_KEYS.has(normalized)) return 'FORBIDDEN_TELEMETRY';
      stack.push(value);
    }
  }

  return null;
}
