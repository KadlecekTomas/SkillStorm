import {
  LIVE_SEMANTIC_EVENT_TYPES,
  MAX_LIVE_EVENT_PAYLOAD_BYTES,
  semanticPayloadViolation,
} from './classroom-orchestration.constants';

describe('classroom semantic payload policy', () => {
  it('allows the Algorithm Lab semantic event vocabulary without raw telemetry', () => {
    expect(LIVE_SEMANTIC_EVENT_TYPES).toEqual(
      expect.arrayContaining([
        'ALGORITHM_STEP_ADDED',
        'PROGRAM_RUN',
        'TEST_FAILED',
        'DEBUG_HYPOTHESIS_SUBMITTED',
        'CHECKPOINT_COMPLETED',
      ]),
    );
  });

  it('accepts compact semantic evidence payloads', () => {
    expect(
      semanticPayloadViolation({
        choice: 'B',
        reason: 'Model lépe odpovídá měření.',
        measurement: { value: 12.4, unit: 'cm' },
      }),
    ).toBeNull();
  });

  it('accepts compact algorithm traces but not pointer coordinates', () => {
    expect(
      semanticPayloadViolation({
        mission: 2,
        program: ['RIGHT', 'FORWARD', 'LEFT'],
        failedStep: 2,
        failureKind: 'OBSTACLE_COLLISION',
      }),
    ).toBeNull();
  });

  it('rejects continuous pointer telemetry', () => {
    expect(
      semanticPayloadViolation({
        interaction: { pointerX: 412, pointerY: 201 },
      }),
    ).toBe('FORBIDDEN_TELEMETRY');
  });

  it('rejects raw media and biometric-shaped payloads', () => {
    expect(semanticPayloadViolation({ rawAudio: 'blob' })).toBe(
      'FORBIDDEN_TELEMETRY',
    );
    expect(semanticPayloadViolation({ biometric: { face: true } })).toBe(
      'FORBIDDEN_TELEMETRY',
    );
  });

  it('rejects oversized payloads', () => {
    expect(
      semanticPayloadViolation({ text: 'x'.repeat(MAX_LIVE_EVENT_PAYLOAD_BYTES + 1) }),
    ).toBe('PAYLOAD_TOO_LARGE');
  });
});
