import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createStaticServer } from "../scripts/serve.mjs";

test("the local server loads the homepage and a tile asset", async (context) => {
  const server = createStaticServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  const home = await fetch(`${origin}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-type"), /^text\/html/);
  assert.match(await home.text(), /Homeward: A Match-3 Love Letter/);

  const asset = await fetch(`${origin}/assets/tiles/t001_pebble_dots.svg`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get("content-type"), /^image\/svg\+xml/);

  const missing = await fetch(`${origin}/missing-file`);
  assert.equal(missing.status, 404);
});
