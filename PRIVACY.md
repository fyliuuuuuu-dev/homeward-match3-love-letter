# Privacy

Homeward's default build is local-first and intentionally small.

## Data handled by the game

The browser stores the current seed, board state, previous route, score, move count, optional challenge state, sound preference, reduced-motion preference, and a local gameplay event chain. The event chain records rule state and relative timing. It is designed to reject common personal-data field names.

The default build collects no name, email address, phone number, location, photograph, recording, contact list, or account identifier.

## Where data goes

Game state stays in browser local storage. The application includes no analytics, advertising, remote fonts, remote images, cloud save, or application server. Copy log and Download log act only when the player chooses them.

A static hosting service or local server may keep ordinary request logs under its own policy. Review that service separately before sharing a hosted link.

## Session exports

Exports contain the complete local event chain for the current session, including the seed, generated board values, move paths, relative event times, and local session identifier. Review exports before sharing them. Remove them when they are no longer needed.

## Custom builds

Your customization can change this privacy profile. Personal photographs, pet likenesses, names, audio, cloud services, analytics, or third-party assets require a fresh privacy review and appropriate consent. Keep source material outside public Git history unless it is intentionally licensed for publication.

See [CUSTOMIZATION.md](CUSTOMIZATION.md) for a rights and consent checklist.
