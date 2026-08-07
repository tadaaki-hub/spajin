import test from "node:test";
import assert from "node:assert/strict";
import { normalizeName, parseCsv, resolvePlace, toCsv } from "../src/cli.mjs";

test("CSVの引用符・改行・配列を往復できる", () => {
  const rows = parseCsv('facility_id,facility_name\r\na,"湯, の里"\r\n');
  assert.deepEqual(rows, [{ facility_id: "a", facility_name: "湯, の里" }]);
  assert.equal(toCsv([{ id: "a", tags: ["露天", "海"] }]), 'id,tags\na,"露天,海"\n');
});

test("施設名を正規化して都県一致の候補を自動採用する", async () => {
  assert.equal(normalizeName("スカイスパ YOKOHAMA"), "スカイスパyokohama");
  const fakeFetch = async () => ({ ok: true, json: async () => ({ places: [{ id: "p1", displayName: { text: "スカイスパYOKOHAMA" }, formattedAddress: "神奈川県横浜市", googleMapsUri: "https://maps.example/p1" }] }) });
  const result = await resolvePlace({ facility_id: "k1", facility_name: "スカイスパ YOKOHAMA", prefecture: "神奈川県" }, "key", fakeFetch);
  assert.equal(result.place_id, "p1");
  assert.equal(result.place_match_status, "auto_matched");
});
