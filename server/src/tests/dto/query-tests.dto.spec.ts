import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { QueryTestsDto } from './query-tests.dto';

describe('QueryTestsDto', () => {
  it('normalizes empty filters to undefined', () => {
    const dto = plainToInstance(QueryTestsDto, {
      search: '   ',
      organizationId: '',
      subjectId: ' ',
      academicYearId: '',
      grade: '',
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.search).toBeUndefined();
    expect(dto.organizationId).toBeUndefined();
    expect(dto.subjectId).toBeUndefined();
    expect(dto.academicYearId).toBeUndefined();
    expect(dto.grade).toBeUndefined();
  });
});
