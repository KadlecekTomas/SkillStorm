import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum NetworkedCoopAction {
  HANDOFF = 'HANDOFF',
  ROTATE = 'ROTATE',
}

export class NetworkedCoopTransitionDto {
  @IsUUID()
  transitionId!: string;

  @IsEnum(NetworkedCoopAction)
  action!: NetworkedCoopAction;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reason?: string;
}
