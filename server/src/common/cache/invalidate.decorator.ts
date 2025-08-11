import { SetMetadata } from '@nestjs/common';

export const INVALIDATE_SCOPES = 'INVALIDATE_SCOPES';
export type ScopeFactory = (ctx: {
  req: any;
  result: any;
  args: any[];
}) => string[] | Promise<string[]>;

export function InvalidateScopes(scopes: string[] | ScopeFactory) {
  return SetMetadata(INVALIDATE_SCOPES, scopes);
}
