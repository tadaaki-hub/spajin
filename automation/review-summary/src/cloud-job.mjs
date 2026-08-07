import { fetchPlace, resolvePlace, summarize } from "./cli.mjs";

const SPREADSHEET_ID = required("SPREADSHEET_ID");
const SHEET_NAME = process.env.SHEET_NAME || "神奈川県_施設マスター";
const PREFECTURE = process.env.PREFECTURE || "神奈川県";
const SOURCE_MODE = process.env.SOURCE_MODE || "kanagawa";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const MAX_ROWS = Number(process.env.MAX_ROWS || 74);
const DELAY_MS = Number(process.env.DELAY_MS || 500);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function retryFetch(url, options = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, options);
    if (response.ok || ![429, 500, 502, 503, 504].includes(response.status)) return response;
    if (attempt === 4) return response;
    await sleep((2 ** attempt) * 1000 + Math.floor(Math.random() * 500));
  }
}

async function accessToken() {
  const response = await retryFetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", { headers: { "Metadata-Flavor": "Google" } });
  if (!response.ok) throw new Error(`Metadata token ${response.status}: ${await response.text()}`);
  return (await response.json()).access_token;
}

async function sheetsRequest(path, options = {}) {
  const token = await accessToken();
  const response = await retryFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers } });
  if (!response.ok) throw new Error(`Sheets API ${response.status}: ${await response.text()}`);
  return response.json();
}

async function readRows() {
  const lastColumn = SOURCE_MODE === "compact" ? "AH" : "AC";
  const range = encodeURIComponent(`'${SHEET_NAME.replaceAll("'", "''")}'!A1:${lastColumn}${MAX_ROWS + 1}`);
  return (await sheetsRequest(`/values/${range}?majorDimension=ROWS`)).values || [];
}

async function writeResult(rowNumber, place, summary) {
  if (SOURCE_MODE === "compact") {
    const a1Range = `'${SHEET_NAME.replaceAll("'", "''")}'!Z${rowNumber}:AH${rowNumber}`;
    const range = encodeURIComponent(a1Range);
    const values = [[
      place.place_id, place.google_maps_url, place.rating, place.user_rating_count,
      summary.review_summary_gemini, summary.review_positive_points.join("｜"),
      summary.review_cautions.join("｜"), new Date().toISOString(), "completed"
    ]];
    await sheetsRequest(`/values/${range}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ range: a1Range, majorDimension: "ROWS", values }) });
    return;
  }
  const a1Range = `'${SHEET_NAME.replaceAll("'", "''")}'!F${rowNumber}:AB${rowNumber}`;
  const range = encodeURIComponent(a1Range);
  const values = [[
    place.place_id, place.google_maps_url, ...Array(8).fill(null),
    place.rating, place.user_rating_count, summary.review_summary_gemini,
    summary.review_positive_points.join("｜"), summary.review_cautions.join("｜"),
    ...Array(7).fill(null), new Date().toISOString()
  ]];
  await sheetsRequest(`/values/${range}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ range: a1Range, majorDimension: "ROWS", values }) });
}

async function writeCompactStatus(rowNumber, status) {
  if (SOURCE_MODE !== "compact") return;
  const a1Range = `'${SHEET_NAME.replaceAll("'", "''")}'!AH${rowNumber}`;
  await sheetsRequest(`/values/${encodeURIComponent(a1Range)}?valueInputOption=RAW`, {
    method: "PUT", body: JSON.stringify({ range: a1Range, majorDimension: "ROWS", values: [[status]] })
  });
}

async function main() {
  const mapsCredential = `Bearer ${await accessToken()}`;
  const [headers, ...rows] = await readRows();
  if (!headers?.length) throw new Error("Spreadsheet has no header row");
  const index = Object.fromEntries(headers.map((name, i) => [name, i]));
  const nameHeader = index.facility_name != null ? "facility_name" : "施設名";
  if (index[nameHeader] == null) throw new Error("Missing facility name header");
  if (SOURCE_MODE !== "compact") for (const requiredHeader of ["facility_id", "prefecture", "google_place_id", "review_summary_gemini"]) if (index[requiredHeader] == null) throw new Error(`Missing header: ${requiredHeader}`);

  let completed = 0, skipped = 0, review = 0, failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2, row = rows[i];
    const facility = Object.fromEntries(headers.map((h, col) => [h, row[col] || ""]));
    if (SOURCE_MODE === "compact") Object.assign(facility, {
      facility_id: `${PREFECTURE}_${String(rowNumber - 1).padStart(3, "0")}`,
      prefecture: PREFECTURE,
      facility_name: facility[nameHeader],
      google_place_id: facility.google_place_id || facility["google_place_id"] || "",
      review_summary_gemini: facility.review_summary_gemini || facility["review_summary_gemini"] || ""
    });
    if (!facility.facility_id || !facility.facility_name) continue;
    if (facility.review_summary_gemini && process.env.FORCE_REFRESH !== "true") { skipped++; continue; }
    try {
      const resolved = await resolvePlace({ ...facility, place_id: facility.google_place_id }, mapsCredential, retryFetch);
      if (!resolved.place_id || resolved.place_match_status === "needs_review") {
        await writeCompactStatus(rowNumber, resolved.place_match_status);
        console.warn(JSON.stringify({ severity: "WARNING", facility_id: facility.facility_id, status: resolved.place_match_status, candidates: resolved.place_candidates_json }));
        review++; continue;
      }
      const place = await fetchPlace(resolved, mapsCredential, retryFetch);
      const summary = await summarize(place, `Bearer ${await accessToken()}`, GEMINI_MODEL, retryFetch);
      await writeResult(rowNumber, place, summary);
      completed++;
      console.log(JSON.stringify({ severity: "INFO", facility_id: facility.facility_id, status: "completed", review_count_used: summary.review_count_used }));
      await sleep(DELAY_MS);
    } catch (error) {
      await writeCompactStatus(rowNumber, "failed").catch(() => {});
      failed++;
      console.error(JSON.stringify({ severity: "ERROR", facility_id: facility.facility_id, message: error.message }));
    }
  }
  console.log(JSON.stringify({ severity: failed ? "WARNING" : "INFO", status: "finished", completed, skipped, needs_review: review, failed }));
  if (failed) process.exitCode = 1;
}

main().catch(error => { console.error(JSON.stringify({ severity: "CRITICAL", message: error.message })); process.exitCode = 1; });
