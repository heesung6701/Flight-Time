#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dbPath = path.join(root, "data", "aircraft-types.json");
const apiKey = process.env.AERODATABOX_API_KEY || process.env.RAPIDAPI_KEY || "";
const rapidApiHost = process.env.AERODATABOX_RAPIDAPI_HOST || "aerodatabox.p.rapidapi.com";
const baseUrl = process.env.AERODATABOX_BASE_URL || `https://${rapidApiHost}`;
const maxRequests = Number(process.env.AERODATABOX_MAX_REQUESTS || 25);
const manualRegistrations = (process.env.AIRCRAFT_REGISTRATIONS || "")
  .split(/[\s,]+/)
  .map(normalizeRegistration)
  .filter(Boolean);

function normalizeRegistration(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function todayIso() {
  return new Date().toISOString();
}

function emptyDb() {
  return {
    schemaVersion: 1,
    description: "Aircraft registration to aircraft type database. Add registrations under aircraft; GitHub Actions fills aircraftType from AeroDataBox.",
    updatedAt: null,
    aircraft: {},
  };
}

async function readDb() {
  try {
    const raw = await fs.readFile(dbPath, "utf8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return emptyDb();
    return {
      ...emptyDb(),
      ...data,
      aircraft: data.aircraft && typeof data.aircraft === "object" ? data.aircraft : {},
    };
  } catch (error) {
    if (error.code === "ENOENT") return emptyDb();
    throw error;
  }
}

function ensureRecord(db, registration) {
  const reg = normalizeRegistration(registration);
  if (!reg) return null;
  const existing = db.aircraft[reg];
  db.aircraft[reg] = existing && typeof existing === "object" ? existing : { aircraftType: String(existing || "") };
  db.aircraft[reg].registration = reg;
  return db.aircraft[reg];
}

function needsLookup(record) {
  return !record?.aircraftType && record?.lookup?.status !== "not_found";
}

async function fetchAircraft(registration) {
  if (!apiKey) throw new Error("Missing AERODATABOX_API_KEY secret");
  const url = new URL(`/aircrafts/reg/${encodeURIComponent(registration)}`, baseUrl);
  url.searchParams.set("withImage", "false");
  url.searchParams.set("withRegistrations", "false");

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": rapidApiHost,
    },
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 500) };
    }
  }

  if (response.status === 404) return { status: "not_found", body };
  if (!response.ok) {
    const message = body?.message || body?.error || text || response.statusText;
    throw new Error(`AeroDataBox ${response.status}: ${message}`);
  }
  return { status: "ok", body };
}

function applyAircraftPayload(record, payload) {
  const aircraftType = payload?.icaoCode || payload?.modelCode || payload?.iataType || payload?.iataCodeShort || record.aircraftType || "";
  Object.assign(record, {
    aircraftType,
    icaoCode: payload?.icaoCode || "",
    iataType: payload?.iataType || "",
    iataCodeShort: payload?.iataCodeShort || "",
    model: payload?.model || "",
    modelCode: payload?.modelCode || "",
    typeName: payload?.typeName || "",
    airlineName: payload?.airlineName || "",
    active: payload?.active ?? null,
    verified: payload?.verified ?? null,
    source: "AeroDataBox",
    sourceId: payload?.id ?? null,
    fetchedAt: todayIso(),
    lookup: { status: "ok" },
  });
}

function sortDb(db) {
  db.aircraft = Object.fromEntries(Object.entries(db.aircraft).sort(([a], [b]) => a.localeCompare(b)));
}

async function main() {
  const db = await readDb();
  for (const reg of manualRegistrations) ensureRecord(db, reg);

  const candidates = Object.entries(db.aircraft)
    .map(([reg, record]) => [normalizeRegistration(reg), record])
    .filter(([reg, record]) => reg && needsLookup(record))
    .slice(0, Number.isFinite(maxRequests) && maxRequests > 0 ? maxRequests : 25);

  if (!candidates.length) {
    console.log("No aircraft registrations need AeroDataBox lookup.");
    sortDb(db);
    await fs.writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`);
    return;
  }

  let changed = false;
  for (const [registration, record] of candidates) {
    ensureRecord(db, registration);
    console.log(`Looking up ${registration}...`);
    try {
      const result = await fetchAircraft(registration);
      if (result.status === "not_found") {
        record.lookup = { status: "not_found", fetchedAt: todayIso() };
        record.fetchedAt = todayIso();
        changed = true;
        console.log(`  not found`);
      } else {
        applyAircraftPayload(record, result.body);
        changed = true;
        console.log(`  ${record.aircraftType || "type unknown"} ${record.model || record.typeName || ""}`.trim());
      }
    } catch (error) {
      record.lookup = { status: "error", message: error.message, fetchedAt: todayIso() };
      changed = true;
      console.error(`  error: ${error.message}`);
      if (/Missing AERODATABOX_API_KEY/.test(error.message)) throw error;
    }
  }

  if (changed) db.updatedAt = todayIso();
  sortDb(db);
  await fs.writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

await main();
