import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const ALGORITHM_COMMANDS = ['FORWARD', 'LEFT', 'RIGHT'] as const;
export type CoopAlgorithmCommand = (typeof ALGORITHM_COMMANDS)[number];

export class UpdateNetworkedCoopProgramDto {
  @IsString()
  @MaxLength(100)
  operationId!: string;

  @IsInt()
  @Min(0)
  @Max(100_000)
  expectedProgramRevision!: number;

  @IsArray()
  @ArrayMaxSize(64)
  @IsIn(ALGORITHM_COMMANDS, { each: true })
  commands!: CoopAlgorithmCommand[];
}
