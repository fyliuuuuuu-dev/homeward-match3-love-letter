# Homeward: A Match-3 Love Letter

Homeward is an early playable prototype for a small, mobile-first connection game. It explores a simple idea: two companions take turns leaving routes across the same board, and the next route earns a bonus when it ends on the previous one.

This is a small game dedicated to the person I love, built to turn ordinary moments, rides home, and the tiny rituals of sharing a life into something playable.

Two cats carry the companion roles in this public edition. Dabing, the low-slung Chief Comfort Officer, brings the feeling of settling in after the ride home. Yuwan, the silver-white Head of Quality Assurance, notices details and checks them again. They supervised every major engineering decision and approved none on the first try. If software gets ghosts, may these be kind ones.

Their approved AI-redrawn portraits are the only personal character art in the repository. The game engine and save format still call them Cat A and Cat B, so forks can replace them without changing the rules. Read [COMPANIONS.md](COMPANIONS.md) for the short character notes and the separate artwork license.

## What makes the prototype different

The board has six columns, seven rows, and five geometric tile types. Connect three or more matching tiles in any of eight directions. Cleared tiles refill in place, so the spatial relationship between routes remains easy to read.

The previous valid route stays visible. End the next valid route on any tile from that route to create a rendezvous and earn four bonus journey points. Crossing the route in the middle or starting on it does not count. This small rule turns each move into a choice between immediate length and setting up the next companion.

The prototype includes deterministic seeds, a three-step guided route, eight calibration moves, optional eight-move challenges, twelve-move journey soft stops, four feedback tiers, local save and restore with a v1 to v2 migration path, exportable session logs, keyboard controls, reduced motion, silent-by-default audio, and low-end device fallbacks. A recursive V0.2 resource budget check keeps the local first-screen graph bounded.

## Run it locally

You need Node.js 20.11 or newer. The project has no third-party runtime or development dependencies.

```text
git clone <repository-url>
cd homeward-match3-love-letter
npm start
```

Open `http://127.0.0.1:8080` in a browser. ES modules require a local web server, so opening `index.html` directly is not supported.

Run the checks with:

```text
npm test
npm run scan
```

The scan produces a short release report and checks the public tree for local machine paths, account artifacts, internal identifiers, credentials, non-English text, and private-source markers.

## How to play

1. Drag through at least three adjacent tiles of the same type. Horizontal, vertical, and diagonal steps are valid.
2. Drag back to undo the latest step, or return to an earlier tile to shorten the current path.
3. Release to clear the path. The next companion takes a turn, and your route remains marked.
4. Finish the next route on a tile from the marked route to earn a rendezvous bonus.

Keyboard and screen-reader users can activate tiles one at a time, then choose Submit path. Escape and Cancel path abandon the unfinished route without consuming a move.

## Make it yours

Apart from the two expressly published companion portraits, the repository does not include the author's private relationship materials. Bring your own memories and confirm that you have the right and consent to use every photo, pet likeness, ring design, travel keepsake, shared object, or original character you add.

A focused set works better than a scrapbook. Choose two to four memory carriers that can affect the play loop, reward rhythm, companion roles, or long-term collection. For example, a shared object can become a challenge reward, while two original companions can alternate turns. See [CUSTOMIZATION.md](CUSTOMIZATION.md) for a practical replacement guide.

## Privacy and copyright boundary

The default game uses original geometric tiles and replaceable Cat A and Cat B slots. Two approved AI-redrawn companion portraits are included as a narrow exception. Their source photographs, editable production files, reference material, and other personal assets are not included. The repository contains no dates, locations, conversations, personal photographs, or relationship timeline.

Game state stays in browser local storage. The prototype sends no analytics and uses no remote assets. Session exports contain gameplay state and event timing, so review them before sharing. A server used to host the static files may keep normal request logs under that server's own policy. See [PRIVACY.md](PRIVACY.md).

Do not commit material you cannot lawfully publish. References to a well-known character, product, vehicle, fashion object, or commercial artwork do not grant permission to reproduce its protected expression. Prefer your own photographs, licensed material, abstract motifs, or original characters.

## Current status

Homeward is an early playable prototype. The rules and presentation are still being iterated. Automated checks cover the engine, persistence, static accessibility contract, assets, privacy schema, and local server.

The repository does not claim completed human playtesting, real-device iPhone validation, PWA installation, WeChat integration, production readiness, or a finished visual identity. The current build is a candidate for learning what deserves further work.

## Roadmap

- Observe whether new players discover and plan around the rendezvous rule.
- Validate one-handed touch behavior and accessibility on real mobile devices.
- Improve tutorial pacing and feedback while preserving the small resource budget.
- Add an optional, rights-conscious customization layer for two to four memory carriers.
- Evaluate offline installation or platform-specific packaging only after repeated-play evidence supports it.

## Contributing

Bug reports, accessibility findings, rule experiments, and small focused pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) first. Contributions must use publishable material and must keep the default repository free of personal relationship content.

## License

Code, documentation, and the included geometric assets are available under the [MIT License](LICENSE). The two companion portraits are personal character artwork, excluded from the MIT grant, and published with all rights reserved. Forks should replace them. See [ASSET_LICENSE.md](ASSET_LICENSE.md).
