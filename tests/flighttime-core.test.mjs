import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildOutputPage,
  buildValidationReport,
  classifyNightDay,
  displayTakeoffCount,
  formatDuration,
  modifyRows,
  normalizePageSize,
  parseAircraftConfigText,
  parseAircraftTypeMap,
  parseOriginalRows,
  parseTsv,
  serializeAircraftTypeMap,
  specialFlightNo,
} from "../src/core/flighttime-core.js";

const fixture = fs.readFileSync(new URL("./fixtures/original-sample.tsv", import.meta.url), "utf8");
const indexHtml = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const agentRules = fs.readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");

test("requires every repository commit to bump the visible app version", () => {
  assert.match(agentRules, /version/i);
  assert.match(agentRules, /package\.json/);
  assert.match(agentRules, /version-badge/);
});

test("shows the package version in a screen corner", () => {
  assert.match(indexHtml, /class="version-badge"/);
  assert.match(indexHtml, new RegExp(`v${packageJson.version}`));
});

test("provides a config button and editable aircraft mapping popup", () => {
  assert.match(indexHtml, /id="configButton"/);
  assert.match(indexHtml, /id="configDialog"/);
  assert.match(indexHtml, /id="configText"/);
  assert.match(indexHtml, /항공기번호/);
});

test("parses original rows and removes summary rows", () => {
  const rows = parseOriginalRows(parseTsv(fixture));

  assert.equal(rows.length, 5);
  assert.equal(rows[0].duty, "O");
  assert.equal(rows.at(-1).aircraft, "TEST005");
});

test("filters excluded duties and keeps original aircraft type", () => {
  const originalRows = parseOriginalRows(parseTsv(fixture));
  const modified = modifyRows(originalRows);

  assert.equal(modified.length, 4);
  assert.equal(modified[0].aircraftType, "TST2");
  assert.equal(modified.at(-1).aircraftType, "TST5");
});

test("uses config aircraft registration mappings before the original type column", () => {
  const rows = [["HL8329", "2030-01-01", "F", "101", "ICN", "CJU", "B738", "", "", "01:00", "", "", "", "", "", 1, 1]];
  const originalRows = parseOriginalRows(rows, {
    aircraftTypes: {
      HL8329: "B73M",
    },
  });

  assert.equal(originalRows[0].type, "B73M");
  assert.equal(modifyRows(originalRows)[0].aircraftType, "B73M");
});

test("parses and serializes editable aircraft config text", () => {
  assert.deepEqual(parseAircraftConfigText("HL8329\tB73M\nHL8248, B738\n# comment\nBADONLY"), {
    HL8329: "B73M",
    HL8248: "B738",
  });

  assert.equal(serializeAircraftTypeMap({ HL8248: "B738", HL8329: "B73M" }), "HL8248\tB738\nHL8329\tB73M");
});

test("calculates F/O from duty using full F block time and two thirds NF block time", () => {
  const modified = modifyRows([
    {
      aircraft: "TEST-F",
      date: "2030-01-01",
      duty: "F",
      flightNo: "101",
      from: "AAA",
      to: "BBB",
      type: "TST",
      blockTime: 90,
      night: 0,
      inst: 0,
      takeoff: 0,
      landing: 0,
    },
    {
      aircraft: "TEST-NF",
      date: "2030-01-02",
      duty: "NF",
      flightNo: "102",
      from: "BBB",
      to: "CCC",
      type: "TST",
      blockTime: 90,
      night: 0,
      inst: 0,
      takeoff: 0,
      landing: 0,
    },
    {
      aircraft: "TEST-R",
      date: "2030-01-03",
      duty: "R",
      flightNo: "103",
      from: "CCC",
      to: "DDD",
      type: "TST",
      blockTime: 90,
      night: 0,
      inst: 0,
      takeoff: 0,
      landing: 0,
    },
  ]);

  assert.equal(modified[0].fo, 90);
  assert.equal(modified[1].fo, 60);
  assert.equal(modified[2].fo, "");
});

test("classifies takeoff and landing across day and night cases", () => {
  assert.equal(specialFlightNo("0166"), true);
  assert.equal(specialFlightNo("729"), false);

  assert.deepEqual(
    classifyNightDay({ flightNo: "711", night: 0, blockTime: 90, takeoff: 1, landing: 1 }),
    { dayTakeoff: 1, dayLanding: 1, nightTakeoff: "", nightLanding: "" },
  );
  assert.deepEqual(
    classifyNightDay({ flightNo: "729", night: 71, blockTime: 71, takeoff: 1, landing: 0 }),
    { dayTakeoff: "", dayLanding: "", nightTakeoff: 1, nightLanding: 0 },
  );
  assert.deepEqual(
    classifyNightDay({ flightNo: "0166", night: 210, blockTime: 378, takeoff: 1, landing: 1 }),
    { dayTakeoff: "", dayLanding: 1, nightTakeoff: 1, nightLanding: "" },
  );
  assert.deepEqual(
    classifyNightDay({ flightNo: "729", night: 71, blockTime: 90, takeoff: 1, landing: 1 }),
    { dayTakeoff: 1, dayLanding: "", nightTakeoff: "", nightLanding: 1 },
  );
});

test("builds output page totals and previous totals", () => {
  const originalRows = parseOriginalRows(parseTsv(fixture));
  const modified = modifyRows(originalRows, { pageSize: 2 });
  const page2 = buildOutputPage(modified, 2, 2);

  assert.equal(page2.start, 3);
  assert.equal(page2.end, 4);
  assert.equal(page2.count, 2);
  assert.equal(formatDuration(page2.pageTotal.blockTime), "04:06");
  assert.equal(formatDuration(page2.pageTotal.fo), "04:06");
  assert.equal(formatDuration(page2.previousTotal.blockTime), "02:41");
  assert.equal(formatDuration(page2.newTotal.blockTime), "06:47");
});

test("normalizes selectable page sizes and falls back to the default", () => {
  assert.equal(normalizePageSize("19"), 19);
  assert.equal(normalizePageSize("all", 42), 42);
  assert.equal(normalizePageSize("all", 0), 1);
  assert.equal(normalizePageSize("999"), 19);
  assert.equal(normalizePageSize("bad value"), 19);
});

test("renders zero takeoff counts as blank", () => {
  assert.equal(displayTakeoffCount(0), "");
  assert.equal(displayTakeoffCount("0"), "");
  assert.equal(displayTakeoffCount(1), "1");
  assert.equal(displayTakeoffCount(""), "");
});

test("wires landing counts through zero-blank display", () => {
  assert.match(appJs, /cell\(displayTakeoffCount\(row\.dayLanding\)\)/);
  assert.match(appJs, /cell\(displayTakeoffCount\(row\.nightLanding\)\)/);
});

test("builds validation report for upload harness", () => {
  const originalRows = parseOriginalRows(parseTsv(fixture));
  const report = buildValidationReport(originalRows, { pageSize: 2 });

  assert.equal(report.originalCount, 5);
  assert.equal(report.filteredCount, 4);
  assert.equal(report.excludedCount, 1);
  assert.equal(report.dutyCounts.O, 1);
  assert.equal(report.pageCount, 2);
});
