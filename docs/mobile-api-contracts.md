# Mobile API Contracts

MakerWorks remains the source of truth for web, Docker/PWA, and native clients. Native clients should call these authenticated JSON routes and reuse existing mutation routes instead of rendering WKWebView pages or scraping server-rendered HTML.

## New Contracts

### Admin Users

`GET /api/admin/users?q={search}`

Auth: admin or staff via the existing admin guard.

Response:

```json
{
  "users": [
    {
      "id": "user_123",
      "email": "customer@example.com",
      "name": "Customer Name",
      "emailVerified": true,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "registrationSource": "invite",
      "registrationIp": "203.0.113.10",
      "registrationUserAgent": "Browser",
      "lastLoginAt": "2026-01-02T00:00:00.000Z",
      "lastLoginIp": "203.0.113.11",
      "lastLoginUserAgent": "Browser",
      "profile": { "slug": "customer", "avatarImagePath": "/avatars/customer.webp" },
      "badges": [{ "achievementId": "ach_1", "achievement": { "key": "comments_1" } }],
      "discountPercent": 10,
      "isFriendsAndFamily": false,
      "friendsAndFamilyPercent": 0,
      "isSuspended": false,
      "isAdmin": false,
      "role": "customer",
      "_count": { "orders": 2 },
      "orderCount": 2,
      "totalSpentCents": 3456
    }
  ],
  "summary": {
    "totalUsers": 1,
    "verifiedUsers": 1,
    "suspendedUsers": 0,
    "adminUsers": 0,
    "newUsers30d": 1,
    "activeUsers30d": 1,
    "customerOrders": 2,
    "orderingUsers": 1,
    "customerRevenueCents": 3456,
    "statCards": []
  },
  "query": { "q": "customer" }
}
```

Search matches the web panel fields: `id`, `name`, `email`, `role`, and `profile.slug`.

`GET /api/admin/users/{id}`

Auth: admin or staff via the existing admin guard.

Response: `{ user, profile, badges, summary }`, where `user` includes account metadata and role flags, `profile` includes editable profile fields, `badges` includes achievement data, and `summary` includes `orderCount` and `totalSpentCents`.

Existing mutation routes remain the source of truth:

- `PATCH /api/admin/users/{id}`
- `DELETE /api/admin/users/{id}`
- `POST /api/admin/users/discount`
- `POST /api/admin/users/invite`

### Customer Orders

`GET /api/customer/orders?limit=30`

Auth: signed-in user. Uses `listOrdersForUser`, including organization-visible orders already available to the web page.

Response: `{ orders, query: { limit } }`.

`GET /api/customer/orders/{orderId}`

Auth: signed-in user with direct or organization access to the order. Uses `getOrderForUser` and `getOrderProductionDetail`.

Response: `{ order, production, derived }`, where `derived` includes `manufacturabilityReport`, `organizationId`, `estimateFeedback`, `failureRecovery`, and `pendingApprovalRequests`.

Existing actions remain:

- `POST /api/customer/orders/{orderId}/messages`
- `POST /api/customer/orders/{orderId}/revision`
- `POST /api/customer/orders/{orderId}/reprint`
- `GET /api/customer/orders/{orderId}/receipt`
- `GET /api/customer/orders/{orderId}/manufacturability-report`

### Customer Workspaces

`GET /api/customer/workspaces`

Auth: signed-in user. Uses `listProjectWorkspacesForUser`.

Response: `{ workspaces }`.

`GET /api/customer/workspaces/{organizationId}/{projectCode}`

Auth: signed-in organization member. Uses `getProjectWorkspaceDetailForUser`, then returns active members and procurement policy shown on the web detail page.

Response: `{ workspace, members, policy }`.

## Audit Matrix

### Admin

- `/admin/users`: covered by `GET /api/admin/users` and existing per-user mutation routes.
- `/admin/users/{userId}/orders`: still server-rendered. Native contract needed: `GET /api/admin/users/{userId}/orders` returning `{ user, orders, legacyJobs }`.
- `/admin/users/{userId}/orders/{orderId}`: still server-rendered. Native contract needed: `GET /api/admin/users/{userId}/orders/{orderId}` returning `{ user, order, production, derived }`.
- `/admin/users/{userId}/orders/{orderId}/ticket`: still server-rendered print ticket. Native contract can reuse the same order detail payload plus ticket-specific presentation fields.
- `/admin/analytics`: covered by `GET /api/admin/analytics`.
- `/admin/catalog`: covered by `GET/PATCH /api/admin/catalog`.
- `/admin/featured`: covered by `GET/POST /api/admin/featured`.
- `/admin/home-comments`: covered by `GET /api/admin/home-comments` and `PATCH/DELETE /api/admin/home-comments/{id}`.
- `/admin/inventory`: covered by StockWorks inventory routes under `/api/stockworks/*`.
- `/admin/jobs`: covered by `GET /api/admin/production` for production queue data and `/api/admin/orderworks/jobs` for legacy jobs.
- `/admin/production`: covered by `GET /api/admin/production`.
- `/admin/products`: covered by `GET/POST /api/admin/products` and `GET/PATCH/DELETE /api/admin/products/{id}`.
- `/admin/site-config`: covered by `GET/PATCH /api/admin/site-config`.
- `/admin/suite-setup`: covered by `GET/PATCH /api/admin/suite-settings` and related test/token routes.
- `/admin/processing-queues`: covered by `GET /api/admin/processing-queues` and retry/requeue actions.
- `/admin/backup-tools` and `/admin`: partially covered by backup/restore routes; native dashboard contract should be `GET /api/admin/dashboard` returning counts and pending restore state.
- `/admin/failure-photos`: covered by `GET/POST /api/failure-photos`.
- `/admin/demand-forecasting`, `/admin/batch-optimization`, `/admin/material-optimization`, `/admin/fleet-intelligence`: server-rendered intelligence pages. Native contracts should be added per page if these are in the SwiftUI scope.

### Customer

- `/customer/orders`: covered by `GET /api/customer/orders`.
- `/customer/orders/{orderId}`: covered by `GET /api/customer/orders/{orderId}` plus existing action routes.
- `/customer/workspaces`: covered by `GET /api/customer/workspaces`.
- `/customer/workspaces/{organizationId}/{projectCode}`: covered by `GET /api/customer/workspaces/{organizationId}/{projectCode}`.
- `/customer/portal`: mostly upload configuration and existing upload actions. Native contract needed if the iOS app will render this dashboard: `GET /api/customer/portal` returning direct-upload URL, upload byte limits, and visibility permissions.

### Settings

- `/settings/profile`: covered by `GET/PATCH /api/profile`.
- `/settings/organizations`: covered by `/api/customer/organizations`, `/api/customer/organizations/{id}`, `/api/customer/organizations/{id}/members`, and `/api/customer/organizations/{id}/usage`.
- `/settings/account`: covered by `/api/me`, `/api/account/email/request`, `/api/account/password`, `/api/account/sessions/logout-all`, and `/api/logout`. Native clients should use these action routes directly.
