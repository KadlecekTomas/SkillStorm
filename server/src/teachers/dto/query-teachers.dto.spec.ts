import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { QueryTeachersDto } from './query-teachers.dto';

describe('QueryTeachersDto', () => {
  it('normalizes empty filters to undefined', () => {
    const dto = plainToInstance(QueryTeachersDto, {
      organizationId: '   ',
      search: '',
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.organizationId).toBeUndefined();
    expect(dto.search).toBeUndefined();
  });
});
