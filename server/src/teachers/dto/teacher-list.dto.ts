import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from 'shared/dto/pagination.dto';

export class TeacherListResponseDto {
  @ApiProperty({ type: 'array' })
  items: any[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}
