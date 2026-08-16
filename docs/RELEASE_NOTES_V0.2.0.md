# Homeward v0.2.0: First Public Playable Prototype

Homeward v0.2.0 is the first public playable prototype of a small, mobile-first connection game about two companions finding their way home across a shared board.

## Playable scope

Players connect three or more matching geometric tiles in any of eight directions. A valid route stays marked for the next companion. Ending the next valid route on any tile from that marked route creates a rendezvous and adds a fixed four-point bonus. The prototype also includes deterministic seeds, a three-step route coach, first-play calibration, an optional eight-move challenge, twelve-move journey settlement, local save and restore, session-log export, keyboard controls, reduced motion, silent-by-default audio, and low-end device fallbacks.

The public screenshot and silent demo were captured from the local v0.2.0 site using only repository assets. The demo shows Cat A leaving a route and Cat B ending on the marked route to trigger a rendezvous.

## Run and verify

Use Node.js 20.11 or newer.

```text
npm start
npm test
npm run scan
```

The project has no third-party runtime or development dependencies. The automated suite covers engine rules, persistence and migration, onboarding, journey settlement, presentation contracts, accessibility-related static checks, resource budgets, the local server, release documentation, media presence, and the public privacy scan. CI runs the same test and scan commands on Node.js 20 and 22.

## Known limitations

This milestone remains an early prototype. It does not claim completed human playtesting, real-device iPhone validation, PWA installation, WeChat integration, production readiness, a finished visual identity, or independent external validation. The short demo illustrates the implemented rule and is not usability evidence.

## Privacy boundary

The default build stores game state in browser local storage and includes no analytics, advertising, remote assets, cloud save, or application server. The public repository excludes private relationship materials, source photographs, dates, locations, conversations, and relationship timelines. Session exports contain gameplay state and relative event timing, so they should be reviewed before sharing. Custom builds require a fresh consent, rights, and privacy review.

## Companion portrait license

The two included cat portraits are approved AI-redrawn personal character artwork. They are excluded from the MIT License and remain all rights reserved. Public display in this repository is permitted, while reuse or redistribution requires separate permission. Fork maintainers should replace both portraits. See [ASSET_LICENSE.md](../ASSET_LICENSE.md) for the exact terms.

## Next phase

The next phase should observe whether new players discover and plan around the rendezvous rule, validate one-handed touch and accessibility on real mobile devices, refine tutorial pacing and feedback, and test whether a small rights-conscious customization layer supports repeated play without weakening the privacy boundary or resource budget.
