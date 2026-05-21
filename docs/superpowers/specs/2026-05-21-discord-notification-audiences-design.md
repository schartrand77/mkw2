# Discord Notification Audiences Design

## Context

MakerWorks currently reads Discord into two in-app surfaces:

- `Announcements` shows user-facing Discord messages that are explicitly marked as announcements.
- `NotificationBell` shows in-app notification items for signed-in users.

The Discord configuration already distinguishes a public/user channel from an admin channel:

- `DISCORD_CHANNEL_ID` for user-facing announcements.
- `DISCORD_ADMIN_CHANNEL_ID` for admin operational notifications.

The bell must preserve that audience boundary. A normal user must not receive admin channel messages, while admins should be able to see both user-facing notifications and admin-only operational notifications.

## Goals

- Keep admin-only Discord notifications visible to admin and staff users in the in-app bell.
- Keep admin-written user notifications visible to signed-in customers and admins.
- Ensure customers receive only user-facing notification items.
- Enforce the audience split on the server before notification items reach the browser.
- Preserve the existing user announcement convention: only user-channel Discord messages marked with `[notify]` or the existing checkmark reaction become user announcements.

## Non-Goals

- No new Discord write flow or admin composer in this change.
- No per-user private Discord notifications.
- No new Prisma storage for notification history or read state.
- No change to browser push notification behavior.

## Approaches

### Recommended: Merge Server-Side Audience Feeds

Fetch the user-facing Discord notification feed for every signed-in bell request. For admin and staff users, also fetch the admin Discord notification feed, merge both sets newest-first, and tag each item with its audience.

This keeps one bell UI and one server contract while preventing customer clients from receiving admin channel contents.

### Alternative: Separate Bell Endpoints and Client Merge

Expose a user feed and an admin feed separately and let the bell decide which requests to make. This duplicates audience logic in the client and risks leaking admin data if the wrong endpoint is called or reused.

### Alternative: Reuse Only Announcements

Keep routing the bell through announcements and require all admin notifications to be announcement-marked. This loses normal operational admin notifications and conflates user broadcast messages with admin-only activity.

## Audience Contract

### User Notifications

- Source channel: `DISCORD_CHANNEL_ID`.
- Source token: configured Discord bot token.
- Eligible messages: user-channel Discord messages marked by `[notify]` prefix or the existing checkmark reaction convention.
- Visible to: signed-in customer, admin, and staff users.
- UI label: user-facing notification label.

### Admin Notifications

- Source channel: `DISCORD_ADMIN_CHANNEL_ID`.
- Source token: configured Discord admin bot token, with existing bot token fallback where already supported.
- Eligible messages: normal non-empty admin-channel Discord messages.
- Visible to: admin and staff users only.
- UI label: admin notification label.

## Data Flow

1. The bell requests one notification API endpoint.
2. The API resolves the authenticated user and their role.
3. The API fetches user-facing notification messages from the user Discord channel and applies the existing announcement marker filter.
4. When the viewer is admin or staff, the API also fetches normal admin-channel Discord notifications.
5. The API normalizes, tags, merges, and sorts items newest-first.
6. The bell renders the returned items and keeps local read state by notification ID.

If a source is not configured or Discord fetch fails, that source contributes no items and the endpoint still returns the available notification items.

## API Design

Keep one bell-facing route under `/api/notifications/discord`.

The route response returns notification items with enough audience metadata for the bell title:

```ts
type DiscordNotificationItem = {
  id: string
  content: string
  author: string
  timestamp: string
  audience: 'user' | 'admin'
}
```

The API must not return admin-audience items for customer viewers. Authorization is checked in the route or in shared server logic before admin-channel messages are fetched or returned.

The user announcement route must read the user channel when both Discord channels are configured. It must not prefer the admin channel for user-facing announcements.

## UI Design

Keep one notification bell.

- User notification items render with a user-facing title.
- Admin notification items render with an admin title.
- Admin viewers can see both item types in a single newest-first list.
- Customer viewers see only user items.

The bell continues to keep read state locally. Dismissed popup announcements remain separate from bell read state.

## Error Handling

- Unauthenticated users do not receive bell notification items because the bell is only mounted for authenticated shells.
- Missing user Discord config returns no user items.
- Missing admin Discord config returns no admin items.
- Discord API failures degrade to available items from the other configured source.
- Empty Discord messages are discarded during normalization.

## Testing

Use TDD for the implementation.

Target tests:

- User-channel filtering keeps only `[notify]` or reaction-marked messages for user notifications.
- Admin-channel normalization keeps ordinary admin bot messages.
- Customer audience selection returns only user items.
- Admin/staff audience selection returns merged user and admin items sorted newest-first.
- Announcement channel selection does not fall back to the admin channel when the user channel is required.

Minimum verification:

- targeted notification tests
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

## Risks

- Admin and user Discord channels can contain Discord message IDs from different streams; read-state keys should remain message-ID based and keep working across both.
- User notification filtering and admin operational notification filtering differ intentionally. Mixing the filters would either leak admin volume to users or hide normal admin operational messages.
