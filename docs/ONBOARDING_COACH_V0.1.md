# Three Step Route Coach V0.1

Status: an early playable prototype feature. The coach is a decorative explanation layer and does not change the game rules.

## What it teaches

1. The first frame shows a valid route through at least three adjacent matching tiles.
2. The second frame shows Companion A's marked route and a Companion B route that meets it at the endpoint.
3. The third frame keeps a long route and a rendezvous route visible. The player chooses what to try.

The coach reads the authoritative tutorial candidates already present in the game state. It does not search the board, calculate legal paths, submit moves, alter growth, or write events.

## Controls and accessibility

- The first two frames use a short route animation. The third frame stays still.
- Reduced motion places the route marker at its endpoint and keeps the route, endpoints, and meeting marker visible.
- A route illustration appears only while every recorded route still uses one tile type on the current 42-cell board. When the board has changed, the SVG stays hidden and the panel gives a safety note instead.
- The coach SVG has no pointer interaction, so dragging and keyboard controls remain available.
- Skip and close make the explanation panel hidden, then show a brief noninteractive "Your turn" cue. The cue also remains safe when reduced motion is enabled.
- Replay opens the frames already learned by the local player. It never restores a board, random state, move count, or session log.

## Persistence boundary

At most three anonymous frames are stored in settings. Each frame contains only a step number, generic companion role, previous route ownership, route coordinates, and candidate routes. Invalid, duplicated, oversized, or out of bounds frames are discarded as a group.

The coach loads after the first screen through one local module. A player can also request it from the rules dialog. This keeps the initial game input path independent from the explanation layer.

## Verification boundary

Automated tests cover frame validation, replay order, reduced motion, input independence, English copy, and the local loading boundary. Local browser checks cover narrow mobile layouts at 320 by 568 and 390 by 844 CSS pixels. Target iPhone Safari, real device performance, and human comprehension remain open evidence.
