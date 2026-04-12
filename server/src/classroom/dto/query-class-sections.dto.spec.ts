import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { QueryClassSectionsDto } from './query-class-sections.dto';

describe('QueryClassSectionsDto', () => {
  it('normalizes empty classroom filter params to undefined', () => {
    const dto = plainToInstance(QueryClassSectionsDto, {
      yearId: '   ',
      academicYearId: '',
      grade: '',
      search: '   ',
      teacherId: '',
      cursor: '   ',
      direction: '',
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.yearId).toBeUndefined();
    expect(dto.academicYearId).toBeUndefined();
    expect(dto.grade).toBeUndefined();
    expect(dto.search).toBeUndefined();
    expect(dto.teacherId).toBeUndefined();
    expect(dto.cursor).toBeUndefined();
    expect(dto.direction).toBeUndefined();
  });

  it('keeps valid grade filter intact', () => {
    const dto = plainToInstance(QueryClassSectionsDto, {
      grade: 'GRADE_5',
      search: '  5.A  ',
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.grade).toBe('GRADE_5');
    expect(dto.search).toBe('5.A');
  });
});
