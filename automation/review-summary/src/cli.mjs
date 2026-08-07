import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const TAGS = ["美肌", "天然温泉", "黒湯", "炭酸水素塩泉", "ぬるとろ", "サウナ", "水風呂", "ロウリュ", "アウフグース", "熱波", "岩盤浴", "炭酸泉", "おこもり", "漫画", "ラウンジ", "露天", "絶景", "海", "山", "展望", "外気浴", "王道", "清潔", "バランス", "普段使い"];

function mapsHeaders(credential) {
  if (credential.startsWith("Bearer ")) return { Authorization: credential, "X-Goog-User-Project": process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "" };
  return { "X-Goog-Api-Key": credential };
}

export function parseCsv(text) {
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted && c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (!quoted && c === ',') { row.push(cell); cell = ""; }
    else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = ""; if (row.some(Boolean)) rows.push(row); row = [];
    } else cell += c;
  }
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift()?.map(v => v.trim()) || [];
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i]?.trim() || ""])));
}

export function toCsv(rows) {
  if (!rows.length) return "";
  const headers = [...new Set(rows.flatMap(Object.keys))];
  const esc = v => { const s = Array.isArray(v) ? v.join(",") : String(v ?? ""); return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
  return [headers, ...rows.map(r => headers.map(h => r[h]))].map(r => r.map(esc).join(",")).join("\n") + "\n";
}

export function normalizeName(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[\s・･.\-‐－()（）]/g, "");
}

export async function resolvePlace(facility, apiKey, fetchFn = fetch) {
  if (facility.place_id || facility.google_place_id) return { ...facility, place_id: facility.place_id || facility.google_place_id, place_match_status: "provided" };
  const textQuery = [facility.facility_name, facility.prefecture, facility.address].filter(Boolean).join(" ");
  const response = await fetchFn("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...mapsHeaders(apiKey), "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.googleMapsUri" },
    body: JSON.stringify({ textQuery, languageCode: "ja", regionCode: "JP", pageSize: 3 })
  });
  if (!response.ok) throw new Error(`Places Text Search API ${response.status}: ${await response.text()}`);
  const candidates = (await response.json()).places || [];
  const wanted = normalizeName(facility.facility_name);
  const ranked = candidates.map(p => {
    const actual = normalizeName(p.displayName?.text);
    const nameMatch = actual === wanted ? 2 : (actual.includes(wanted) || wanted.includes(actual) ? 1 : 0);
    const prefectureMatch = !facility.prefecture || (p.formattedAddress || "").includes(facility.prefecture.replace(/[都道府県]$/, ""));
    return { p, score: nameMatch * 10 + (prefectureMatch ? 3 : 0), nameMatch, prefectureMatch };
  }).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best) return { ...facility, place_match_status: "not_found", place_candidates_json: "[]" };
  const status = best.nameMatch === 2 && best.prefectureMatch ? "auto_matched" : "needs_review";
  return { ...facility, place_id: best.p.id, matched_place_name: best.p.displayName?.text || "", address: facility.address || best.p.formattedAddress || "", google_maps_url: best.p.googleMapsUri || "", place_match_status: status, place_candidates_json: JSON.stringify(ranked.map(x => ({ id: x.p.id, name: x.p.displayName?.text, address: x.p.formattedAddress, score: x.score }))) };
}

export async function fetchPlace(facility, apiKey, fetchFn = fetch) {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(facility.place_id)}?languageCode=ja`;
  const response = await fetchFn(url, { headers: { ...mapsHeaders(apiKey), "X-Goog-FieldMask": "id,displayName,rating,userRatingCount,googleMapsUri,reviews" } });
  if (!response.ok) throw new Error(`Places API ${response.status}: ${await response.text()}`);
  const place = await response.json();
  return { ...facility, place_name: place.displayName?.text || "", rating: place.rating ?? "", user_rating_count: place.userRatingCount ?? "", google_maps_url: place.googleMapsUri || "", reviews: (place.reviews || []).map(r => ({ rating: r.rating, text: r.text?.text || r.originalText?.text || "", published_at: r.publishTime || "", maps_url: r.googleMapsUri || "" })).filter(r => r.text) };
}

export async function summarize(record, apiKey, model, fetchFn = fetch) {
  if (!record.reviews.length) return { review_summary_gemini: "要約対象の口コミなし", review_positive_points: [], review_cautions: [], facility_tags: [], review_count_used: 0 };
  const schema = { type: "object", properties: {
    review_summary_gemini: { type: "string", description: "誇張せず100文字以内でまとめた口コミ傾向" },
    review_positive_points: { type: "array", items: { type: "string" }, maxItems: 4 },
    review_cautions: { type: "array", items: { type: "string" }, maxItems: 3 },
    facility_tags: { type: "array", items: { type: "string", enum: TAGS }, maxItems: 8 }
  }, required: ["review_summary_gemini", "review_positive_points", "review_cautions", "facility_tags"] };
  const prompt = `温浴施設「${record.facility_name}」の口コミを要約してください。口コミにない事実を補わず、個人情報は出さず、少数意見を一般化しないでください。\n口コミ:\n${record.reviews.map((r, i) => `${i + 1}. 星${r.rating ?? "不明"}: ${r.text}`).join("\n")}`;
  const vertex = apiKey.startsWith("Bearer ");
  const project = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_LOCATION || "global";
  const endpoint = vertex
    ? `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`
    : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const authHeaders = vertex ? { Authorization: apiKey } : { "x-goog-api-key": apiKey };
  const response = await fetchFn(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 } }) });
  if (!response.ok) throw new Error(`Gemini API ${response.status}: ${await response.text()}`);
  const body = await response.json();
  const text = body.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("");
  if (!text) throw new Error("Gemini API returned no text");
  return { ...JSON.parse(text), review_count_used: record.reviews.length };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((v, i, a) => v.startsWith("--") ? [v.slice(2), a[i + 1]?.startsWith("--") ? "true" : a[i + 1]] : null).filter(Boolean));
  const input = resolve(args.input || "input/facilities.csv"), output = resolve(args.output || "output/facilities-with-review-summary.csv");
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY, geminiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  if (!mapsKey || !geminiKey) throw new Error("GOOGLE_MAPS_API_KEY と GEMINI_API_KEY を環境変数に設定してください");
  const facilities = parseCsv(await readFile(input, "utf8"));
  const results = [];
  for (const facility of facilities) {
    if (!facility.facility_id || !facility.facility_name) throw new Error("facility_id と facility_name は必須です");
    process.stderr.write(`[${results.length + 1}/${facilities.length}] ${facility.facility_name}\n`);
    const resolved = await resolvePlace(facility, mapsKey);
    if (!resolved.place_id || resolved.place_match_status === "needs_review") {
      results.push(resolved); continue;
    }
    const place = await fetchPlace(resolved, mapsKey);
    const summary = await summarize(place, geminiKey, model);
    results.push({ ...resolved, rating: place.rating, user_rating_count: place.user_rating_count, google_maps_url: place.google_maps_url, ...summary, review_positive_points: summary.review_positive_points.join("｜"), review_cautions: summary.review_cautions.join("｜"), facility_tags: summary.facility_tags.join(",") });
  }
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, toCsv(results), "utf8");
  process.stderr.write(`完了: ${output}\n`);
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });
