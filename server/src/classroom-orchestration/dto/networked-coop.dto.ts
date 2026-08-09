import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum NetworkedCoopAction {
  HANDOFF = 'HANDOFF',
  ROTATE = 'ROTATE',
}

export class NetworkedCoopTransitionDto {
  @IsString()
  @MaxLength(100)
  transitionId!: string;

  @IsEnum(NetworkedCoopAction)
  action!: NetworkedCoopAction;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reason?: string;
}
