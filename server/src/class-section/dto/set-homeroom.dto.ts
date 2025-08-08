import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class SetHomeroomDto {
  @ApiProperty({
    example: 'teacher-uuid',
    description:
      'Učitel, který bude třídní. Pokud null/undefined, třídnictví se zruší.',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  teacherId?: string | null;
}
