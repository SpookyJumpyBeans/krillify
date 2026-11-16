# Troubleshooting v1.1.1

## Nothing appears on the game page

Load the repository's `extension` folder, enable the extension, and refresh the existing Krillion tab. In Settings, enable automatic recommendations. An API key or a matching imported answer bank is needed to produce suggestions.

## Waiting for a prompt while the game shows one

Use **Pick prompt**, then click the game’s actual category text. Version 1.1.1 relies on the game’s DOM classes and can miss prompts during animations. Selecting a parent with extra text may produce an incorrect category, so select the question itself.

## AI request timeout

An uncached prompt needs a network round trip. The worker cancels generation after 14 seconds. Try Retry when the connection is stable. Imported or cached answers avoid this request. Repeated retries may make additional billable requests; cancelling a request does not guarantee a refund.

## Extension response timeout

This means the page did not receive a worker reply before its deadline. It does not by itself prove that an API key or balance is wrong. Open your browser's Extensions page, reload Krillify, and refresh the game. If reporting an issue, include the exact message and browser version. Intermittent worker communication issues are known in this preserved release.

## API key, credits, or model errors

Use an OpenAI API key, not a Claude key or your account password. Check that the selected API organization has available credits and access to the configured model. API access is separate from merely signing in to ChatGPT. The model field defaults to `gpt-4.1-mini`; model availability can change.

Never post the key in a GitHub issue. Delete it from Settings if you no longer want this browser profile to keep it.

## The game rejects a suggestion

The game’s curated answer list is authoritative. Obscure or correct real-world answers may still be missing from it. Try another suggestion. Rejected submission attempts are remembered in the current game by this version.

## Answers repeat

Unused suggestions may repeat. Your submitted answers, observed accepted opponent answers, and known aliases are excluded for the current game. A new game intentionally allows previous answers again. Another tab has a separate tracker. If an opponent answer was used before the helper started and its bubble is no longer rendered, it cannot be tracked retroactively. Changes to the game’s bubble markup can also interrupt tracking.

## Updating

Replace the files in the same loaded `extension` folder, click Reload on your browser’s Extensions page, and refresh Krillion. Keeping the installed extension identity preserves local settings and caches. Loading the code as a separate extension or in a new profile can create separate storage.
