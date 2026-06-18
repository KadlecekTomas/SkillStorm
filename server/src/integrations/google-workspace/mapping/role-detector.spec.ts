import {
  detectGroupRole,
  detectOrgUnitRole,
  resolveRole,
} from './role-detector';

describe('detectGroupRole', () => {
  it('classifies teacher groups', () => {
    expect(detectGroupRole({ email: 'ucitele@skola.cz', name: 'Učitelé' })).toBe(
      'TEACHER',
    );
    expect(detectGroupRole({ email: 'teachers@skola.cz', name: 'Teachers' })).toBe(
      'TEACHER',
    );
  });

  it('classifies director groups', () => {
    expect(detectGroupRole({ email: 'vedeni@skola.cz', name: 'Vedení' })).toBe(
      'DIRECTOR',
    );
    expect(detectGroupRole({ email: 'reditel@skola.cz', name: 'Ředitel' })).toBe(
      'DIRECTOR',
    );
  });

  it('returns null for class / unrelated groups', () => {
    expect(detectGroupRole({ email: 'trida-7a@skola.cz', name: 'Třída 7.A' })).toBeNull();
    expect(detectGroupRole({ email: 'lyzak-2026@skola.cz', name: 'Lyžák' })).toBeNull();
  });

  it('prefers DIRECTOR over TEACHER when both substrings appear', () => {
    expect(
      detectGroupRole({ email: 'vedeni-ucitele@skola.cz', name: 'Vedení učitelé' }),
    ).toBe('DIRECTOR');
  });
});

describe('detectOrgUnitRole', () => {
  it('maps teacher org-units', () => {
    expect(detectOrgUnitRole('/Zamestnanci/Ucitele')).toBe('TEACHER');
    expect(detectOrgUnitRole('/Učitelé')).toBe('TEACHER');
  });

  it('maps student org-units', () => {
    expect(detectOrgUnitRole('/Žáci')).toBe('STUDENT');
    expect(detectOrgUnitRole('/Studenti')).toBe('STUDENT');
  });

  it('returns null when no fragment matches', () => {
    expect(detectOrgUnitRole('/Ostatni')).toBeNull();
    expect(detectOrgUnitRole(null)).toBeNull();
  });
});

describe('resolveRole (DIRECTOR > TEACHER > STUDENT)', () => {
  it('returns the single role with no conflict', () => {
    const r = resolveRole(['STUDENT']);
    expect(r).toEqual({
      role: 'STUDENT',
      conflict: false,
      candidates: ['STUDENT'],
    });
  });

  it('resolves DIRECTOR over TEACHER and STUDENT, flags conflict', () => {
    const r = resolveRole(['STUDENT', 'TEACHER', 'DIRECTOR']);
    expect(r?.role).toBe('DIRECTOR');
    expect(r?.conflict).toBe(true);
    expect(r?.candidates[0]).toBe('DIRECTOR');
  });

  it('resolves TEACHER over STUDENT', () => {
    const r = resolveRole(['STUDENT', 'TEACHER']);
    expect(r?.role).toBe('TEACHER');
    expect(r?.conflict).toBe(true);
  });

  it('returns null for no candidates', () => {
    expect(resolveRole([])).toBeNull();
  });

  it('does not flag a conflict when the same role repeats', () => {
    const r = resolveRole(['STUDENT', 'STUDENT']);
    expect(r?.conflict).toBe(false);
  });
});
