import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { QueryStudentsDto } from './query-students.dto';

describe('QueryStudentsDto', () => {
  it('normalizes empty filters to undefined', () => {
    const dto = plainToInstance(QueryStudentsDto, {
      search: '   ',
      yearId: '',
      classSectionId: ' ',
      availableForClassSectionId: '',
      availableForYearId: '   ',
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.search).toBeUndefined();
    expect(dto.yearId).toBeUndefined();
    expect(dto.classSectionId).toBeUndefined();
    expect(dto.availableForClassSectionId).toBeUndefined();
    expect(dto.availableForYearId).toBeUndefined();
  });
});
