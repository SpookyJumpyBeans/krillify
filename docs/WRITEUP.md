# Krillify 1.2.0 design

Krillify keeps the v1.1.1 answer-selection workflow and adds an independently written game-state adapter. A page-world script attaches read-only listeners to the game's WebSocket and EventSource connections at document start. It applies snapshots and versioned patches, accumulates accepted pass answers for the current game, and forwards a small allowlisted state message to the isolated overlay. It does not send game actions, forward chat or credentials, or expose API keys.

The overlay requests the latest state when it loads, so an early snapshot is not lost. Server game identity controls resets when available. A patch version mismatch or closed socket drops structured tracking and permits the existing DOM fallback. The fallback reads visible prompts and accepted player bubbles; typing, rejected guesses and chat are ignored. Accepted names and known aliases remove visible suggestions and filter in-flight replies.

The worker owns API access and local storage. Status checks read settings only, avoiding deserializing all cached banks on every status poll. Storage is restricted to trusted extension contexts. Requests for obsolete categories are cancelled. Network work runs outside the storage mutation queue, and a second history lookup handles answers accepted during generation.

The cache holds up to 300 prompts and 60 candidates per prompt. Five original starter banks contain 57 candidates and work without an API key. Imports override starter lists. Both starter and AI rankings are estimates, not official acceptance or rarity data. Cached partial batches appear immediately.

AI generation has a 14-second deadline. Only an HTTP 5xx failure occurring within 1.5 seconds is retried, once, after 750 ms. Authentication, billing, rate-limit and timeout failures require a manual retry. Suggestion messaging has an 18-second deadline. Retrying can incur another API charge.

Validation covers snapshot/patch application, state replay, game resets, SSE, stale transport isolation, missing-patch fallback, and filtering private fields. Browser fixtures use the actual worker selection/history logic to check accepted aliases, chat/rejection filtering, in-flight exclusions, new-game reuse, and structured state overriding stale DOM. An unpacked-extension smoke test checks worker communication and on-page suggestions. These tests do not establish live-game acceptance rates or superiority over competing extensions.

The implementation is plain JavaScript and Manifest V3. No competitor source, keys, user profiles, generated answer caches or debugging archives are included in the release.
