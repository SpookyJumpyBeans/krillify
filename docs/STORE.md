# Chrome Web Store submission

Everything the developer dashboard asks for, ready to paste. Build the upload with:

```sh
node tools/build-store.mjs        # dist/krillify-<version>-store.zip
python tools/store-art/capture.py # dist/store-art/*.png
```

## Store listing

**Name** (from the manifest): Krillify: Answer Helper for Krillion Puffer Party

**Summary** (from the manifest, 118 of 132 characters): Unofficial helper for Krillion's Puffer Party: three rare answer suggestions for each category, right beside the game.

**Category:** the closest games or entertainment category the dashboard offers.

**Language:** English

**Description** (plain text; copy everything inside the block):

```text
Krillify puts three answer suggestions next to Puffer Party, Krillion's multiplayer category game. Read the category, click a suggestion to fill the answer box, then press Enter yourself.

What it does
• Shows three unused answers for the current category, rarest first, picked at random from the best few so players don't all give the same ones.
• Ranks answers by what the game has actually accepted, and stops suggesting answers the game rejected.
• Tracks every answer played in your game, including the short or alternate names Krillion accepts, so the panel doesn't offer answers that have already been said. When a card is used, only that card is replaced.
• Works without an API key on hundreds of prompts from the built-in answer bank. Add your own OpenAI API key to get suggestions for any prompt.

Things to know
• Krillify never plays for you. It fills the box when you click, and you decide whether to submit.
• Rarity is estimated and acceptance isn't guaranteed. The game's own answer list decides.
• Your settings, cache and API key stay in your browser. With a key, the category and answer names go to OpenAI to generate suggestions. There are no analytics, ads or developer servers.

Krillify is an independent, unofficial project. It is not affiliated with or endorsed by Krillion.
Source code: https://github.com/SpookyJumpyBeans/krillify
```

**Images** (in `dist/store-art/`):
- Store icon: `extension/icons/icon-128.png`
- Screenshots (1280x800): `screenshot-1-suggestions.png`, `screenshot-2-settings.png`
- Small promo tile (440x280): `promo-tile-440x280.png`

**Homepage URL:** https://github.com/SpookyJumpyBeans/krillify

**Support URL:** https://github.com/SpookyJumpyBeans/krillify/issues

## Privacy practices tab

**Single purpose:** Suggest answers for the current category in Krillion's Puffer Party, shown in a panel beside the game.

**Permission justifications:**

- **storage:** Keeps the user's settings (including their optional OpenAI API key), cached answer lists, the answers already played in each game, and answers the game accepted or rejected, all locally.
- **Host permission https://api.openai.com/\*:** Only used when the user adds their own OpenAI API key: sends the category and answer names to OpenAI to generate suggestions for prompts the built-in bank doesn't cover.
- **Content scripts on krillion.io and www.krillion.io:** Show the suggestion panel beside Puffer Party and read the current category and the answers the game accepts or rejects, so used answers aren't suggested again. A script in the page reads the game's own state updates without changing them or sending game actions.

**Remote code:** No, I am not using remote code. All JavaScript is packaged in the extension.

**Data usage** (tick these):
- **Authentication information:** the user's own OpenAI API key, stored locally and sent only to OpenAI.
- **Website content:** the game's category and answers on krillion.io, used locally to pick suggestions; category and answer names go to OpenAI only when the user has added a key.

Then certify all three: not sold to third parties, not used or transferred for purposes unrelated to the single purpose, not used to determine creditworthiness or for lending.

**Privacy policy URL:** https://github.com/SpookyJumpyBeans/krillify/blob/main/docs/PRIVACY.md

## Distribution

Public, all regions. Free.
