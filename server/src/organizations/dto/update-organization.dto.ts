import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { OrganizationType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({
    example: 'ZŠ Komenského',
    description: 'Nový název organizace',
  })
  @IsOptional()
  @IsString()
  @Length(3, 255)
  name?: string;

  @ApiPropertyOptional({ example: 'Komenského 99' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Brno' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Česko' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    enum: OrganizationType,
    example: 'COMMUNITY',
    description: 'Změna typu organizace (SCHOOL, PRIVATE, COMMUNITY)',
  })
  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;
}
