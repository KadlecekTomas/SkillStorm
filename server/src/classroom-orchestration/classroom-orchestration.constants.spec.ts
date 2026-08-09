import {
  MAX_LIVE_EVENT_PAYLOAD_BYTES,
  semanticPayloadViolation,
} from './classroom-orchestration.constants';

describe('classroom semantic payload policy', () => {
  it('accepts compact semantic evidence payloads', () => {
    expect(
      semanticPayloadViolation({
        choice: 'B',
        reason: 'Model lépe odpovídá měření.',
        measurement: { value: 12.4, unit: 'cm' },
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
