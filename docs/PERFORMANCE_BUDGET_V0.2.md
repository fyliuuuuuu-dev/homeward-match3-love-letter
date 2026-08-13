# Performance budget V0.2

The first screen is a closed local graph. It includes the HTML entrypoint, the
engine, persistence, onboarding fixture, presenter, styles, path utility, and
five tile SVGs. There are no deferred resources in this candidate.

Budget layers:

First screen, 80 KiB, 16 requests.

Session, 96 KiB, 18 requests.

Per-file ceilings are 8 KiB for HTML, 12 KiB for CSS, 24 KiB for JavaScript,
and 4 KiB for SVG. Runtime DOM ceilings are 64 static nodes, 160 steady nodes,
210 tracing nodes, and 220 feedback nodes. The recursive graph test is a
mechanical V0.2 gate. Runtime device evidence remains pending for p95 frame interval, long tasks, rapid swipes, background recovery, memory, real DOM growth, and iPhone Safari.
