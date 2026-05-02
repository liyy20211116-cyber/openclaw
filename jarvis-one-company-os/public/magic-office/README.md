# Magic Office Art Assets

Drop replaceable art assets into this directory without changing Magic Office business logic.

Expected paths:
- `themes/<theme-id>/background.webp`
- `themes/<theme-id>/rooms/<room_id>.webp`
- `agents/<agent-folder>/idle.webp`
- `agents/<agent-folder>/working.webp`
- `agents/<agent-folder>/blocked.webp`
- `effects/approval.webp`
- `effects/blocked.webp`
- `effects/syncing.webp`
- `effects/completed.webp`

The React components try these paths first and fall back to the current CSS placeholders when files are missing.
