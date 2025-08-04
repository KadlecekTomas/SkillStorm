import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTeacherDto {
  @ApiProperty({
    example: 'uuid-uzivatele',
    description: 'ID uživatele, který bude učitelem',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    example: 'uuid-skoly',
    description: 'ID školy, kam bude učitel přiřazen',
  })
  @IsUUID()
  @IsNotEmpty()
  schoolId: string;
}
