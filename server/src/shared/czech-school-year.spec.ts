import { BadRequestException } from '@nestjs/common';
import {
  deriveCzechSchoolYearFromStartYear,
  getDefaultCzechSchoolYear,
} from './czech-school-year';

describe('czech-school-year', () => {
  describe('deriveCzechSchoolYearFromStartYear', () => {
    it('returns correct dates and label for startYear 2025', () => {
      const result = deriveCzechSchoolYearFromStartYear(2025);
      expect(result.label).toBe('2025/2026');
      expect(result.startDate.getUTCFullYear()).toBe(2025);
      expect(result.startDate.getUTCMonth()).toBe(8);
      expect(result.startDate.getUTCDate()).toBe(1);
      expect(result.endDate.getUTCFullYear()).toBe(2026);
      expect(result.endDate.getUTCMonth()).toBe(7);
      expect(result.endDate.getUTCDate()).toBe(31);
    });

    it('throws for startYear < 2000', () => {
      expect(() => deriveCzechSchoolYearFromStartYear(1999)).toThrow(
        BadRequestException,
      );
    });

    it('throws for startYear > 2100', () => {
      expect(() => deriveCzechSchoolYearFromStartYear(2101)).toThrow(
        BadRequestException,
      );
    });

    it('accepts boundary 2000 and 2100', () => {
      expect(deriveCzechSchoolYearFromStartYear(2000).label).toBe('2000/2001');
      expect(deriveCzechSchoolYearFromStartYear(2100).label).toBe('2100/2101');
    });
  });

  describe('getDefaultCzechSchoolYear', () => {
    it('returns valid CZ school year structure', () => {
      const result = getDefaultCzechSchoolYear();
      expect(result.startDate.getUTCMonth()).toBe(8);
      expect(result.startDate.getUTCDate()).toBe(1);
      expect(result.endDate.getUTCMonth()).toBe(7);
      expect(result.endDate.getUTCDate()).toBe(31);
      expect(result.label).toMatch(/^\d{4}\/\d{4}$/);
    });
  });
});
