"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheScopeForUser = cacheScopeForUser;
exports.makeUserSearch = makeUserSearch;
exports.orgVersionKey = orgVersionKey;
exports.getOrgVersion = getOrgVersion;
exports.bumpOrgVersion = bumpOrgVersion;
exports.stableStringify = stableStringify;
exports.buildVersionedListKey = buildVersionedListKey;
exports.cacheGetOrSet = cacheGetOrSet;
const client_1 = require("@prisma/client");
function cacheScopeForUser(systemRole, orgId) {
    return systemRole === client_1.SystemRole.SUPERADMIN ? 'ALL' : (orgId ?? 'UNKNOWN');
}
function makeUserSearch(search) {
    if (!search?.trim())
        return undefined;
    const s = search.trim();
    return {
        OR: [
            { name: { contains: s, mode: 'insensitive' } },
            { email: { contains: s, mode: 'insensitive' } },
            { username: { contains: s, mode: 'insensitive' } },
        ],
    };
}
function orgVersionKey(scopeId) {
    return `org:ver:${scopeId}`;
}
async function getOrgVersion(cache, scopeId) {
    const v = await cache.get(orgVersionKey(scopeId));
    return v ?? 1;
}
async function bumpOrgVersion(cache, scopeId) {
    await cache.set(orgVersionKey(scopeId), Date.now(), 0);
}
function stableStringify(obj) {
    if (obj == null)
        return '';
    if (typeof obj !== 'object')
        return String(obj);
    const entries = Object.entries(obj)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
}
function buildVersionedListKey(opts) {
    const p = opts.page ?? 1;
    const l = opts.limit ?? 20;
    const s = (opts.search ?? '').trim().toLowerCase();
    const inc = opts.includeLevels ? '1' : '0';
    const ord = stableStringify(opts.order);
    const fil = stableStringify(opts.filters);
    return [
        `${opts.namespace}:list`,
        `v${opts.version}`,
        `scope:${opts.scopeId}`,
        `p${p}`,
        `l${l}`,
        `q:${s}`,
        `lev:${inc}`,
        `ord:${ord}`,
        `f:${fil}`,
    ].join(':');
}
async function cacheGetOrSet(cache, key, ttlMs, fetcher) {
    const hit = await cache.get(key);
    if (hit !== undefined && hit !== null)
        return hit;
    const fresh = await fetcher();
    await cache.set(key, fresh, ttlMs);
    return fresh;
}
//# sourceMappingURL=org-cache.utils.js.map