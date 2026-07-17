import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class StartCampaignDto {
  @IsUUID()
  classSectionId!: string;

  /** Slug kampaně z content registry (ne UUID — kampaň není v DB). */
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  campaignId!: string;
}
