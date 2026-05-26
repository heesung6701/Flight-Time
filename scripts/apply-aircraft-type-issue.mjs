#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dbPath = path.join(root, "data", "aircraft-types.json");
const packagePath = path.join(root, "package.json");
const summaryPath = process.env.AIRCRAFT_TYPE_ISSUE_SUMMARY || path.join(root, "aircraft-type-issue-summary.json");

function normalizeRegistration(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function normalizeAircraftType(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function section(body, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(body || "").match(new RegExp(`(?:^|\\n)### ${escaped}\\s*\\n+([\\s\\S]*?)(?=\\n### |$)`, "i"));
  return match ? match[1].trim() : "";
}

function stripCodeFence(text) {
  return String(text || "")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("```"))
    .join("\n")
    .trim();
}

function parseRows(text, mode) {
  const rows = [];
  for (const line of stripCodeFence(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^A\/C\s*No/i.test(trimmed)) continue;
    const [registrationValue, typeValue = ""] = trimmed.split(/[\t,\s]+/);
    const registration = normalizeRegistration(registrationValue);
    const aircraftType = normalizeAircraftType(typeValue);
    if (!registration) continue;
    if (mode !== "delete" && !aircraftType) {
      throw new Error(`Missing aircraft type for ${registration}`);
    }
    rows.push({ registration, aircraftType });
  }
  if (!rows.length) throw new Error("No aircraft registrations found in issue body");
  return rows;
}

function emptyDb() {
  return {
    schemaVersion: 1,
    description: "Aircraft registration to aircraft type database. Add registrations under aircraft.",
    updatedAt: null,
    aircraft: {},
  };
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function sortAircraft(db) {
  db.aircraft = Object.fromEntries(Object.entries(db.aircraft).sort(([a], [b]) => a.localeCompare(b)));
}

function typeMap(db) {
  return Object.fromEntries(
    Object.entries(db.aircraft || {}).map(([registration, record]) => [
      registration,
      typeof record === "string" ? record : record?.aircraftType || "",
    ]),
  );
}

async function writeSummary(summary) {
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
}

function bumpPatch(version) {
  const parts = String(version || "0.0.0").split(".").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`Unsupported package version: ${version}`);
  }
  parts[2] += 1;
  return parts.join(".");
}

async function bumpAppVersion() {
  const packageJson = await readJson(packagePath, {});
  packageJson.version = bumpPatch(packageJson.version);
  await fs.writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is required");

  const event = JSON.parse(await fs.readFile(eventPath, "utf8"));
  const body = event?.issue?.body || "";
  const changeType = section(body, "Change type");
  const mode = /delete/i.test(changeType) ? "delete" : "upsert";
  const rows = parseRows(section(body, "Aircraft type map"), mode);

  const db = {
    ...emptyDb(),
    ...(await readJson(dbPath, emptyDb())),
  };
  db.aircraft = db.aircraft && typeof db.aircraft === "object" && !Array.isArray(db.aircraft) ? db.aircraft : {};

  let changed = false;
  const changes = {
    added: [],
    updated: [],
    deleted: [],
    unchanged: [],
  };
  const runStartedAt = new Date().toISOString();
  for (const row of rows) {
    if (mode === "delete") {
      if (Object.hasOwn(db.aircraft, row.registration)) {
        const existing = db.aircraft[row.registration];
        const aircraftType = typeof existing === "string" ? existing : existing?.aircraftType || "";
        delete db.aircraft[row.registration];
        changes.deleted.push({ registration: row.registration, aircraftType });
        changed = true;
      } else {
        changes.unchanged.push({ registration: row.registration, aircraftType: "" });
      }
      continue;
    }

    const existing = db.aircraft[row.registration];
    const existingRecord = existing && typeof existing === "object" ? existing : {};
    const currentType = typeof existing === "string" ? existing : existingRecord.aircraftType || "";
    const shouldRefreshMetadata = currentType !== row.aircraftType || existingRecord.registration !== row.registration || existingRecord.source !== "GitHub issue";
    const nextRecord = {
      ...existingRecord,
      registration: row.registration,
      aircraftType: row.aircraftType,
      source: "GitHub issue",
      updatedAt: shouldRefreshMetadata ? runStartedAt : existingRecord.updatedAt,
    };
    if (JSON.stringify(existing || null) !== JSON.stringify(nextRecord)) {
      db.aircraft[row.registration] = nextRecord;
      if (existing) {
        changes.updated.push({ registration: row.registration, from: currentType, to: row.aircraftType });
      } else {
        changes.added.push({ registration: row.registration, aircraftType: row.aircraftType });
      }
      changed = true;
    } else {
      changes.unchanged.push({ registration: row.registration, aircraftType: row.aircraftType });
    }
  }

  if (!changed) {
    sortAircraft(db);
    await fs.writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`);
    await writeSummary({ changed, mode, changes, finalMap: typeMap(db) });
    return;
  }

  db.updatedAt = new Date().toISOString();
  sortAircraft(db);
  await fs.writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`);
  await writeSummary({ changed, mode, changes, finalMap: typeMap(db) });
  await bumpAppVersion();
}

await main();
