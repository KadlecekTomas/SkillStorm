import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class SetStudentPinDto {
  /** 4–6 číslic (STOP #2). Hodnota se nikdy neloguje. */
  @ApiProperty({ example: '1234', pattern: '^\\d{4,6}$' })
  @Matches(/^\d{4,6}$/, { message: 'PIN_FORMAT_INVALID' })
  pin!: string;
}
