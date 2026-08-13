# Twelve Move Journey Settlement V0.1

Status: an early playable prototype feature. The settlement card is a soft pause after every twelve valid free-play moves. It does not end the game or change the rules.

## Player experience

The card appears only after the engine reports an authoritative journey arrival. It shows the completed journey number and total journey points, then offers two choices:

1. Start another journey and return to the board immediately.
2. Save for today and show an honest local-save result.

After saving, the player may close the page or reopen the board from the same card. If browser storage is unavailable, the card says that progress remains only in the open game and suggests downloading the session log.

## State and privacy boundary

The settlement layer does not calculate the twelve-move boundary. It does not modify the board, companion turn, previous route, random state, growth, or journey counters.

Each choice produces one anonymous event with only three fields: the generic choice, completed journey number, and journey points. The feature contains no private story material, real reward, store, currency, video, analytics, or remote request.

## Interaction boundary

The module loads locally after the first screen. While an arrival is waiting for the module or the modal card is open, new board input is paused. Restart clears the card. Escape does not silently dismiss it, and focus begins on the continue choice.

If the module cannot load, pending settlement state is released, board input resumes, and the current game state remains available.

## Verification boundary

Automated checks cover authoritative arrival gating, duplicate actions, anonymous payloads, save success and failure copy, deferred-load failure, input blocking, performance budgets, and the public privacy scan. Local Chromium checks cover the 390 by 844 CSS pixel layout and the continue and save interactions. Target iPhone Safari, screen-reader behavior, real-device background recovery, and human response to the pause remain open evidence.
