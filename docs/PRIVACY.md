# Krillify privacy policy

Last updated: November 16, 2026

Krillify is an unofficial browser extension for Krillion's Puffer Party. It is not affiliated with or endorsed by Krillion. This policy covers the version published on the Chrome Web Store.

## What Krillify stores

Everything Krillify keeps stays in your browser's extension storage on your device. It is not synced and is not sent to the developer.

- Your settings: whether suggestions are on, the OpenAI model name, and your OpenAI API key if you add one.
- An answer cache: answer lists for prompts you have seen, so they load instantly next time.
- Used answers: the answers already played in each recent game, so they aren't suggested again in that game.
- Game results: answers the game accepted or rejected for each prompt, with the rarity tier the game showed. These rank future suggestions.

You can clear used answers in Settings. Removing the extension deletes all of it.

## What Krillify reads on Krillion

On krillion.io, Krillify reads the current category, the answers the game accepts or rejects, their rarity tiers, and the text in your own answer box. It reads the game's own updates without changing them and never sends game actions. To tell which accepted answers are yours, it compares players' typing previews with your answer box inside the page; player identifiers are never stored or sent anywhere. Krillify does not read or store chat, player names, cookies, or account details.

## What Krillify sends, and to whom

- OpenAI, and only if you add your own API key. When a prompt has no banked answers left, Krillify sends OpenAI the category text, answers to avoid, and answers the game accepted or rejected for that category, together with your API key. It never sends chat, player names, or anything about you beyond your key. Requests set `store: false`. OpenAI's handling of that data is covered by OpenAI's own policies.
- Nobody else. Krillify has no analytics, tracking, ads or developer server. The answer bank that ships with the extension is a file inside the extension; it is not downloaded at runtime.

## What Krillify does not do

Krillify does not sell or transfer your data, does not use it for anything other than suggesting answers in Puffer Party, and does not use it to determine creditworthiness or for lending.

## Contact

Questions or concerns: open an issue at https://github.com/SpookyJumpyBeans/krillify/issues.
