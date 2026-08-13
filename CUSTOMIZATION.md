# Customizing Homeward

Homeward is designed to carry personal meaning without shipping anyone else's private story. The public repository contains five MIT-licensed geometric tiles, two neutral companion slots, and two separately licensed companion portraits. Forks should replace both portraits with their own assets. Replace only what improves the play loop, reward rhythm, or sense of return.

## Start with two to four memory carriers

Choose a small set that you can explain in one sentence each. Useful candidates include:

- two pets or original companion characters that alternate turns;
- a shared object that becomes a progress marker or challenge reward;
- a travel keepsake that appears after a rendezvous milestone;
- a ring or other meaningful object used as an abstract motif;
- one or two photographs that you have permission to use, preferably kept outside the repository and translated into original, non-identifying art.

Each carrier should have a job. If an element does not change a turn, reward, space, or lasting collection, leave it out of the first version.

## A practical mapping

| Personal meaning | Good gameplay role | Public-safe default |
| --- | --- | --- |
| Two companions | Alternate valid moves | Cat A and Cat B circles |
| A shared ritual | Eight-move optional challenge | Rendezvous challenge |
| A small keepsake | Reward after a completed challenge | Text-only keepsake marker |
| A familiar object | One geometric tile family | Original SVG tile |

## Replace the five tile assets

Runtime tile files live in `assets/tiles/` and use these stable names:

```text
t001_pebble_dots.svg
t002_cushion_grid.svg
t003_diamond_ripples.svg
t004_hex_honeycomb.svg
t005_flower_stitches.svg
```

Keep the filenames, or update `TILE_ASSET_FILES` in `src/presentation.mjs`. For best results:

- use an SVG `viewBox` of `0 0 48 48`;
- keep the subject readable at 36 to 48 pixels tall;
- give every tile a distinct silhouette, color, and internal texture;
- avoid remote fonts, scripts, linked images, or hidden metadata;
- include an English `title` and `desc` in each SVG;
- test the set in grayscale and with reduced motion enabled.

Run `npm test` after replacing assets. The public checks verify that all five files exist, remain local, and contain no remote references.

## Rename the companions

The visible labels are created in `index.html` and `src/presentation.mjs`. The engine uses neutral `A` and `B` identifiers in saved state. Keeping those identifiers stable avoids breaking existing saves while allowing any display names you choose.

The default portrait paths are `assets/companions/dabing.png` and `assets/companions/yuwan.png`. Those two files are personal character artwork and are not licensed under MIT. Replace them before redistributing a fork unless you have separate permission to redistribute the originals. If a portrait is missing, the interface falls back to the neutral A or B badge. See [ASSET_LICENSE.md](ASSET_LICENSE.md) for the exact boundary.

If names or likenesses identify real people or pets, keep your customized build private unless everyone involved has agreed to publication.

## Add a keepsake without turning the game into a collage

Start with one reward state. A short original phrase, a small abstract badge, or a newly drawn object is enough. Tie it to a clear action such as completing the optional challenge. Add another carrier only after the first one still feels meaningful across repeated sessions.

## Rights and consent checklist

Before publishing your customized version, confirm that:

- you created the material, received a suitable license, or have clear permission to use it;
- every identifiable person has agreed to that public use;
- pet, home, travel, and object images reveal no unwanted location or account details;
- exported files contain no camera metadata, device identifiers, or private notes;
- commercial characters, logos, packaging, product art, music, and commissioned artwork are used only when the relevant rights allow it;
- your public Git history has never contained the private originals.

Build a fresh public repository from a clean allowlist if private materials have ever entered your working history. Deleting a file from the latest commit does not remove it from earlier commits.
