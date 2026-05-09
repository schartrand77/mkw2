# Profile Models Compact View Design

## Scope

Add a compact view option to the Models section on user profile pages at `/u/[slug]`. The `/me` route redirects to the current user's profile, so it benefits from the same change without becoming a separate private page.

## Behavior

- The profile header, creator quality card, contact details, and social links stay unchanged.
- The Models section gets a `Gallery / Compact` segmented view toggle.
- `view=compact` in the URL selects compact mode.
- `view=grid` or no view query selects gallery mode unless a saved preference exists.
- A profile-models cookie, `mwv2_profile_models_view`, remembers the last selected view.
- Pagination links preserve the selected view.

## UI

Gallery mode keeps the current three-column model cards.

Compact mode renders a denser list-like grid with small thumbnails, model title, price label, optional sale strike-through, and a link to the model detail page. It should be visually consistent with the Discover compact view while using only the profile page's model data.

## Implementation

Introduce a small reusable client toggle component for profile models rather than coupling the profile page to Discover's full list component. Keep the view resolution and query-string helpers near the profile page unless they need to be shared later.

## Testing

Add a focused unit test for profile model view helpers:

- Cookie fallback selects compact mode.
- URL `view=grid` overrides a compact cookie.
- Pagination hrefs keep `view=compact` when compact mode is active.

