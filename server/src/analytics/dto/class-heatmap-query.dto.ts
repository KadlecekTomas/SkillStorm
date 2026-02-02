import { IsUUID } from 'class-validator';

export class ClassHeatmapQueryDto {
  @IsUUID()
  yearId!: string;
}
