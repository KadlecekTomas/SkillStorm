/**
 * Structural enforcement: any controller/route that is subject to RequireOrgReadyGuard
 * must declare @OrgOperation(AUTHORING | EXECUTION). No name-based allowlist.
 *
 * Subject to guard = guard runs and route is not exempt.
 * Exempt = controller in explicit public list (health/metrics) OR class/handler has
 * @AllowAnyOrgStatus() or @AllowPendingOrg().
 */
import { Test } from '@nestjs/testing';
import { Controller, Get } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';
import { AppModule } from '../src/app.module';
import { ORG_OPERATION_KEY } from '@/common/decorators/org-operation.decorator';
import { ALLOW_ANY_ORG_STATUS } from '@/common/decorators/allow-any-org-status.decorator';
import { ALLOW_PENDING_ORG } from '@/common/decorators/allow-pending-org.decorator';

/** Truly public controllers (no auth/org); not subject to readiness gating in practice. */
const EXPLICIT_PUBLIC_CONTROLLERS = new Set(['HealthController', 'MetricsController']);

function getRouteHandlerKeys(metatype: Function): string[] {
  const proto = metatype.prototype;
  if (!proto) return [];
  return Object.getOwnPropertyNames(proto).filter((key) => {
    if (key === 'constructor') return false;
    const fn = proto[key];
    return typeof fn === 'function' && Reflect.getMetadata(PATH_METADATA, fn) !== undefined;
  });
}

function isExemptFromReadiness(
  reflector: Reflector,
  metatype: Function,
  methodKey: string,
): boolean {
  const methodFn = (metatype as any).prototype?.[methodKey];
  const allowAny = reflector.getAllAndOverride<boolean>(ALLOW_ANY_ORG_STATUS, [
    methodFn,
    metatype,
  ]);
  const allowPending = reflector.getAllAndOverride<boolean>(ALLOW_PENDING_ORG, [
    methodFn,
    metatype,
  ]);
  return allowAny === true || allowPending === true;
}

function hasOrgOperation(
  reflector: Reflector,
  metatype: Function,
  methodKey: string,
): boolean {
  const methodFn = (metatype as any).prototype?.[methodKey];
  const atClass = reflector.get<string>(ORG_OPERATION_KEY, metatype);
  const atMethod = methodFn ? reflector.get<string>(ORG_OPERATION_KEY, methodFn) : undefined;
  return atClass !== undefined || atMethod !== undefined;
}

describe('OrgOperation decorator enforcement (structural)', () => {
  it('every route subject to readiness gating has @OrgOperation (class or handler)', async () => {
    const app = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    }).compile();

    const discovery = app.get(DiscoveryService);
    const reflector = app.get(Reflector);
    const controllers = discovery.getControllers();

    const missing: string[] = [];
    for (const wrapper of controllers) {
      const metatype = wrapper.metatype as Function & { name?: string };
      if (!metatype?.name) continue;
      if (EXPLICIT_PUBLIC_CONTROLLERS.has(metatype.name)) continue;

      const routeKeys = getRouteHandlerKeys(metatype);
      for (const methodKey of routeKeys) {
        if (isExemptFromReadiness(reflector, metatype, methodKey)) continue;
        if (!hasOrgOperation(reflector, metatype, methodKey)) {
          missing.push(`${metatype.name}.${methodKey}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('fails when a controller behind readiness has no @OrgOperation (negative)', async () => {
    @Controller('dummy')
    class DummyController {
      @Get()
      get() {
        return { ok: true };
      }
    }

    const module = await Test.createTestingModule({
      imports: [DiscoveryModule],
      controllers: [DummyController],
    }).compile();

    const discovery = module.get(DiscoveryService);
    const reflector = module.get(Reflector);
    const controllers = discovery.getControllers();

    const missing: string[] = [];
    for (const wrapper of controllers) {
      const metatype = wrapper.metatype as Function & { name?: string };
      if (!metatype?.name) continue;
      if (EXPLICIT_PUBLIC_CONTROLLERS.has(metatype.name)) continue;

      const routeKeys = getRouteHandlerKeys(metatype);
      for (const methodKey of routeKeys) {
        if (isExemptFromReadiness(reflector, metatype, methodKey)) continue;
        if (!hasOrgOperation(reflector, metatype, methodKey)) {
          missing.push(`${metatype.name}.${methodKey}`);
        }
      }
    }

    expect(missing.length).toBeGreaterThan(0);
    expect(missing.some((m) => m.startsWith('DummyController'))).toBe(true);
  });
});
