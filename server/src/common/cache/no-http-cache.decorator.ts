import { SetMetadata } from '@nestjs/common';
export const NO_HTTP_CACHE = 'NO_HTTP_CACHE';
export const NoHttpCache = () => SetMetadata(NO_HTTP_CACHE, true);
