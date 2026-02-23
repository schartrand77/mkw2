# Security Audit Report (2026-02-23)

## Scope and methodology
- Dependency vulnerability scan using `npm audit --json`.
- Targeted manual review of auth, CSRF, rate-limiting, upload parsing, and privileged API routes.
- Spot checks for dangerous primitives (`eval`, unsafe SQL, shell execution, weak randomness in security-sensitive flows).

## Executive summary
- **Total dependency vulnerabilities:** 50 (1 critical, 42 high, 5 moderate, 2 low).
- **High-risk application findings:** 3
  1. **Critical DoS risk in XML parser dependency path used for uploaded 3MF processing**.
  2. **Missing CSRF protections on sensitive state-changing endpoints (including admin APIs)**.
  3. **Rate-limit keying trusts spoofable forwarding headers, enabling throttling bypass**.

## Findings

### 1) Critical: vulnerable XML parser reachable from user uploads
**Severity:** Critical  
**Evidence:** `fast-xml-parser` is directly installed and flagged critical by `npm audit`; repository code uses it to parse 3MF XML content in upload/preview workflows.  
**Impact:** Crafted XML (e.g., entity-expansion / parser-bypass payloads) can trigger excessive resource consumption and service degradation.

**Where used:**
- `lib/model-preview-queue.ts` (`XMLParser` usage on uploaded model internals)
- `scripts/backfill-3mf-previews.js` (`XMLParser` usage during preview backfill)

**Recommended changes:**
- Upgrade `fast-xml-parser` to a patched version immediately.
- Add strict XML size ceilings and parsing timeouts for 3MF internals before parsing.
- Consider moving parsing into an isolated worker process/container with hard memory/CPU limits.

---

### 2) High: state-changing endpoints rely on cookies but do not consistently enforce same-origin CSRF checks
**Severity:** High  
**Evidence:** A CSRF helper exists (`lib/csrf.ts`) and is used in select routes, but many mutation routes (notably under `/api/admin/...` and upload paths) do not enforce same-origin verification before acting.

**Impact:** Cross-site requests can potentially trigger authenticated actions where browser cookie behavior allows it (especially in mixed deployments / proxy setups / same-site contexts).

**Examples:**
- `app/api/upload/route.ts` POST path has no `isSameOriginRequest` check.
- Numerous admin mutation routes call `requireAdmin()` but do not pair this with CSRF origin validation.

**Recommended changes:**
- Add a shared mutation guard for **all** non-GET routes that combines:
  - authentication/authorization checks, and
  - `isSameOriginRequest(req)` rejection on failure.
- Prefer explicit CSRF tokens for highly sensitive operations (admin/user-account destructive actions).
- Add route-level tests that assert cross-origin POST/PATCH/DELETE requests are rejected.

---

### 3) High: rate-limiting can be bypassed via spoofed client IP headers
**Severity:** High  
**Evidence:** `getRequestIp` trusts `x-forwarded-for` and `x-real-ip` header values directly for rate-limit keys in login/register/resend flows.

**Impact:** Attackers can rotate spoofed header values to evade account and IP-based throttling controls.

**Where:**
- `lib/rate-limit.ts` (`getRequestIp`)
- `app/api/login/route.ts`, `app/api/register/route.ts`, `app/api/register/resend/route.ts` (rate key composition)

**Recommended changes:**
- Only trust forwarding headers when they come from a known reverse proxy boundary.
- In direct deployments, derive IP from platform-provided trusted metadata instead of raw client headers.
- Add secondary limiters keyed by account/email + device fingerprint to reduce single-vector bypass.

---

### 4) Dependency risk inventory (all `npm audit` findings)
The following table lists all vulnerabilities reported by `npm audit` in this environment.

| Package | Severity | Type |
|---|---|---|
| `fast-xml-parser` | critical | direct |
| `@aws-sdk/client-sesv2` | high | transitive |
| `@aws-sdk/client-sso` | high | transitive |
| `@aws-sdk/core` | high | transitive |
| `@aws-sdk/credential-provider-env` | high | transitive |
| `@aws-sdk/credential-provider-http` | high | transitive |
| `@aws-sdk/credential-provider-ini` | high | transitive |
| `@aws-sdk/credential-provider-node` | high | transitive |
| `@aws-sdk/credential-provider-process` | high | transitive |
| `@aws-sdk/credential-provider-sso` | high | transitive |
| `@aws-sdk/credential-provider-web-identity` | high | transitive |
| `@aws-sdk/middleware-sdk-s3` | high | transitive |
| `@aws-sdk/middleware-user-agent` | high | transitive |
| `@aws-sdk/nested-clients` | high | transitive |
| `@aws-sdk/signature-v4-multi-region` | high | transitive |
| `@aws-sdk/token-providers` | high | transitive |
| `@aws-sdk/util-user-agent-node` | high | transitive |
| `@aws-sdk/xml-builder` | high | transitive |
| `@eslint/config-array` | high | transitive |
| `@eslint/eslintrc` | high | transitive |
| `@lhci/cli` | high | direct |
| `@typescript-eslint/eslint-plugin` | high | transitive |
| `@typescript-eslint/parser` | high | transitive |
| `@typescript-eslint/type-utils` | high | transitive |
| `@typescript-eslint/typescript-estree` | high | transitive |
| `@typescript-eslint/utils` | high | transitive |
| `archiver` | high | direct |
| `chrome-launcher` | high | transitive |
| `eslint` | high | direct |
| `eslint-config-next` | high | direct |
| `eslint-plugin-import` | high | transitive |
| `eslint-plugin-jsx-a11y` | high | transitive |
| `eslint-plugin-react` | high | transitive |
| `glob` | high | transitive |
| `jws` | high | transitive |
| `minimatch` | high | transitive |
| `next` | high | direct |
| `nodemailer` | high | direct |
| `qs` | high | transitive |
| `readdir-glob` | high | transitive |
| `rimraf` | high | transitive |
| `tmp` | high | transitive |
| `typescript-eslint` | high | transitive |
| `ajv` | moderate | transitive |
| `asn1.js` | moderate | transitive |
| `bn.js` | moderate | transitive |
| `lodash` | moderate | transitive |
| `web-push` | moderate | direct |
| `external-editor` | low | transitive |
| `inquirer` | low | transitive |
## Priority remediation plan
1. **Immediate (same day):**
   - Patch `fast-xml-parser`, `next`, `nodemailer`, and other direct vulnerable dependencies.
   - Add CSRF checks to all state-changing authenticated routes.
2. **Short term (1–3 days):**
   - Harden rate-limiting trust boundary for client IP extraction.
   - Add integration tests for CSRF + rate-limit bypass attempts.
3. **Medium term (1–2 weeks):**
   - Introduce continuous dependency scanning in CI with fail thresholds.
   - Add security regression tests for upload parsing and admin mutation endpoints.

## Commands run
- `npm audit --json`
- `rg -n "(eval\(|new Function|child_process|exec\(|spawn\(|prisma\.(\$queryRawUnsafe|\$executeRawUnsafe)|jsonwebtoken\.verify\(|jwt\.verify\(|dangerouslySetInnerHTML|md5|sha1|Math\.random\(|CORS|Access-Control-Allow-Origin|csrf|rate.?limit|cookie|SameSite|secure:)" app lib scripts`
- `sed -n '1,220p' lib/csrf.ts`
- `sed -n '1,260p' app/api/upload/route.ts`
- `sed -n '1,260p' lib/auth.ts`
- `sed -n '1,240p' lib/rate-limit.ts`
- `sed -n '1,220p' app/api/login/route.ts`
- `sed -n '1,220p' app/api/register/route.ts`
- `sed -n '1,220p' app/api/register/resend/route.ts`
