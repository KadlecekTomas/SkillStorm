import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class SetHomeroomDto {
  @ApiPropertyOptional({
    example: 'teacher-uuid',
    description:
      'Učitel, který bude třídní. Pokud undefined/null → třídnictví se zruší.',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  teacherId?: string | null;
}
