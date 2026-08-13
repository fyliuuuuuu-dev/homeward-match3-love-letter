# Contributing

Thank you for helping Homeward become a clearer, kinder, and more reusable small game.

## Good contributions

- focused engine fixes with regression tests;
- mobile touch, keyboard, screen-reader, contrast, or reduced-motion improvements;
- explanations or examples that make privacy-conscious customization easier;
- small rule experiments that keep the engine deterministic and the presentation separate from game decisions;
- performance improvements that preserve 44-pixel minimum touch targets.

## Before opening a pull request

1. Keep the change focused and explain the player-facing reason.
2. Add or update tests when behavior changes.
3. Run `npm test` and `npm run scan`.
4. Confirm that no private material, local path, credential, account identifier, or unpublished relationship detail appears in the files or Git history.
5. Use only material you have the right to publish under the repository license.

## Content boundary

The default project must remain reusable. Do not contribute personal photographs, identifiable pet art, chat excerpts, real names, dates, locations, relationship timelines, commercial character art, logos, music, or proprietary product designs. Generic original examples and geometric placeholders are welcome.

## Code style

The project uses browser-native JavaScript modules, CSS, SVG, and the Node.js built-in test runner. Keep third-party dependencies out unless a clear, measured need justifies the maintenance and privacy cost.

Prefer small functions, deterministic tests, explicit state transitions, and accessible names. Presentation code must consume engine results instead of reimplementing game rules.

## Bug reports

Include the browser, device class, viewport, seed, steps to reproduce, expected behavior, and actual behavior. Review session exports before attaching them. Use the private security route described in [SECURITY.md](SECURITY.md) for vulnerabilities or accidental exposure.
