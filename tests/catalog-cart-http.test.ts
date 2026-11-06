import assert from "node:assert/strict";
import test from "node:test";
import { handleCatalogCart } from "../lib/catalog-cart-http";
import type { CatalogCart, CatalogPick } from "../lib/catalog-shopping";

const origin = "https://one.ad-mavericks.com";
const initial: CatalogCart = { version: 4, items: [{ productKey: "radio:galaxia:20", quantity: 30 }], clientId: null };
function fixture(authenticated = true) {
  let cart = structuredClone(initial), writes = 0;
  return {
    get cart() { return cart; }, get writes() { return writes; },
    store: {
      authenticated: async () => authenticated,
      load: async () => cart,
      save: async (items: CatalogPick[], version: number, clientId: string | null) => {
        if (clientId !== cart.clientId || version !== cart.version) return { ok: false as const, cart, error: "El carrito cambió." };
        cart = { ...cart, items, version: version + 1 }; writes++;
        return { ok: true as const, cart };
      },
    },
  };
}
const input = { items: [{ productKey: "ooh:billboard:0", quantity: 2 }, ...initial.items], expectedVersion: 4, expectedClientId: null };
function post(body: unknown = input, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/catalog/cart`, { method: "POST", headers: { origin, "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}

test("a stable URL retains radio while adding OOH, without build-specific action identifiers", async () => {
  const f = fixture();
  const saved = await handleCatalogCart(post(), f.store);
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).cart.version, 5);
  const read = await handleCatalogCart(new Request(`${origin}/api/catalog/cart`), f.store);
  assert.deepEqual((await read.json()).items, input.items);
  assert.equal(read.headers.get("cache-control"), "private, no-store");
  assert.equal(read.headers.get("vary"), "Cookie");
});

test("anonymous and cross-origin calls cannot read or alter the cart", async () => {
  const anonymous = fixture(false);
  assert.equal((await handleCatalogCart(post(), anonymous.store)).status, 401);
  assert.equal((await handleCatalogCart(new Request(`${origin}/api/catalog/cart`), anonymous.store)).status, 401);
  const f = fixture();
  const origins: Record<string, string>[] = [{ origin: "https://evil.example" }, { origin: "" }, { "sec-fetch-site": "cross-site" }];
  for (const headers of origins) {
    assert.equal((await handleCatalogCart(post(input, headers), f.store)).status, 403);
  }
  assert.equal(f.writes + anonymous.writes, 0);
});

test("another tab or another client cannot overwrite the saved version", async () => {
  const f = fixture();
  assert.equal((await handleCatalogCart(post(), f.store)).status, 200);
  const stale = await handleCatalogCart(post({ ...input, items: [] }), f.store);
  assert.equal(stale.status, 409);
  assert.deepEqual((await stale.json()).cart.items, input.items);
  const wrongClient = await handleCatalogCart(post({ ...input, expectedVersion: 5, expectedClientId: "11111111-1111-4111-8111-111111111111" }), f.store);
  assert.equal(wrongClient.status, 409);
  assert.equal(f.writes, 1);
});

test("untrusted prices, identity fields, malformed quantities and oversized lists never reach storage", async () => {
  const f = fixture();
  for (const body of [
    { ...input, companyId: "another-client" }, { ...input, expectedVersion: -1 },
    { ...input, expectedClientId: "not-a-uuid" }, { ...input, expectedClientId: undefined },
    { ...input, items: [{ ...input.items[0], priceCents: 1 }] },
    { ...input, items: [{ ...input.items[0], quantity: 0 }] },
    { ...input, items: [{ ...input.items[0], quantity: 1.5 }] },
    { ...input, items: [input.items[0], input.items[0]] },
    { ...input, items: Array.from({ length: 101 }, (_, i) => ({ productKey: `radio:${i}`, quantity: 1 })) },
  ]) assert.equal((await handleCatalogCart(post(body), f.store)).status, 400);
  assert.equal(f.writes, 0);
});

test("actual body size is bounded even without Content-Length", async () => {
  const f = fixture();
  const request = new Request(`${origin}/api/catalog/cart`, {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: " ".repeat(256 * 1024 + 1),
  });
  assert.equal((await handleCatalogCart(request, f.store)).status, 413);
  assert.equal(f.writes, 0);
});

test("invalid content and storage failures preserve the existing cart without leaking errors", async () => {
  const f = fixture();
  assert.equal((await handleCatalogCart(post(input, { "content-type": "text/plain" }), f.store)).status, 415);
  const badJson = new Request(`${origin}/api/catalog/cart`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: "{" });
  assert.equal((await handleCatalogCart(badJson, f.store)).status, 400);
  const failed = await handleCatalogCart(post(), { ...f.store, save: async () => { throw new Error("private-database-detail"); } });
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /private-database-detail/);
  assert.deepEqual(f.cart, initial);
});
