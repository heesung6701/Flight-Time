import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { DEFAULT_AIRLINE_ID, getAirline } from "../src/core/airlines.js";
import {
  buildOutputPage,
  buildValidationReport,
  classifyNightDay,
  classifyTakeoffLandingBySun,
  displayTakeoffCount,
  formatDuration,
  inferArrivalDate,
  isClockNight,
  parseDuration,
  parseClockMinutes,
  modifyRows,
  normalizePageSize,
  parseAircraftConfigText,
  parseAircraftTypeDatabase,
  parseAircraftTypeMap,
  parseOriginalRows,
  parseTsv,
  serializeAircraftTypeMap,
  specialFlightNo,
} from "../src/core/flighttime-core.js";

const fixture = fs.readFileSync(new URL("./fixtures/original-sample.tsv", import.meta.url), "utf8");
const indexHtml = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = fs.readFileSync(new URL("../src/app-controller.js", import.meta.url), "utf8");
const appMarkup = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const mainJs = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const stylesCss = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const issueApiJs = fs.readFileSync(new URL("../api/aircraft-type-issue.js", import.meta.url), "utf8");
const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const packageLock = JSON.parse(fs.readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const aircraftIssueWorkflow = fs.readFileSync(new URL("../.github/workflows/apply-aircraft-type-issue.yml", import.meta.url), "utf8");
const aircraftIssueScript = fs.readFileSync(new URL("../scripts/apply-aircraft-type-issue.mjs", import.meta.url), "utf8");

const agentRules = fs.readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");

test("requires every repository commit to bump the visible app version", () => {
  assert.match(agentRules, /version/i);
  assert.match(agentRules, /package\.json/);
  assert.match(agentRules, /version-badge/);
});

test("shows the package version in a screen corner", () => {
  assert.match(appMarkup, /className="version-badge"/);
  assert.match(appMarkup, /v\{packageJson\.version\}/);
  assert.match(appMarkup, /import packageJson from "\.\.\/package\.json"/);
  assert.match(indexHtml, new RegExp(`v${packageJson.version.replaceAll(".", "\\.")}`));
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[""].version, packageJson.version);
});

test("aircraft type issue automation commits only existing versioned files", () => {
  assert.match(aircraftIssueWorkflow, /package-lock\.json/);
  assert.doesNotMatch(aircraftIssueWorkflow, /app\.js/);
  assert.match(aircraftIssueScript, /const packageLockPath/);
  assert.match(aircraftIssueScript, /const indexPath/);
  assert.match(aircraftIssueScript, /packageLock\.packages\[""\]\.version = packageJson\.version/);
  assert.match(aircraftIssueScript, /replace\(\/v\\d\+\\\.\\d\+\\\.\\d\+\//);
});

test("uses Vite as the React browser entry point", () => {
  assert.match(indexHtml, /id="root"/);
  assert.match(indexHtml, /src="\/src\/main\.jsx"/);
  assert.match(mainJs, /createRoot/);
  assert.match(mainJs, /import\("\.\/app-controller\.js"\)/);
  assert.match(appJs, /from "\.\/core\/airlines\.js"/);
  assert.match(appJs, /from "\.\/core\/flighttime-core\.js"/);
});

test("parses Korean duration strings emitted by formatted Excel cells", () => {
  assert.equal(parseDuration("1시간 14분"), 74);
  assert.equal(parseDuration("1시간"), 60);
  assert.equal(parseDuration("14분"), 14);
});

test("lets the version badge force a fresh page request", () => {
  assert.match(appMarkup, /className="version-badge"[^>]*role="button"/);
  assert.match(appMarkup, /className="version-badge"[^>]*tabIndex="0"/);
  assert.match(appJs, /function reloadLatestVersion\(\)/);
  assert.match(appJs, /searchParams\.set\("refresh", String\(Date\.now\(\)\)\)/);
  assert.match(appJs, /versionBadge\?\.addEventListener\("click", reloadLatestVersion\)/);
  assert.match(appJs, /versionBadge\?\.addEventListener\("keydown", handleVersionBadgeKeydown\)/);
});

test("starts from airline selection and keeps topbar airline switching available", () => {
  assert.match(appMarkup, /id="airlineGate"/);
  assert.match(appMarkup, /id="airlineCards"/);
  assert.match(appMarkup, /id="appWorkspace" hidden/);
  assert.match(appMarkup, /id="topbarAirlineSelect"/);
  assert.match(appJs, /flightTimeSelectedAirline/);
  assert.match(appJs, /chooseAirline/);
});

test("separates file upload from direct input in a dialog", () => {
  assert.match(appMarkup, /id="workbookInput"/);
  assert.match(appMarkup, /id="manualInputButton"/);
  assert.match(appMarkup, /id="manualInputDialog"/);
  assert.match(appMarkup, /id="pasteArea"/);
  assert.match(appMarkup, /CSV 입력/);
  assert.match(appJs, /openManualInputDialog/);
  assert.match(appJs, /closeManualInputDialog/);
});

test("loads workbook uploads from the first sheet only", () => {
  assert.match(appJs, /workbook\.Sheets\[workbook\.SheetNames\[0\]\]/);
  assert.doesNotMatch(appJs, /workbook\.Sheets\.original/);
  assert.doesNotMatch(appJs, /workbook\.Sheets\.Original/);
});

test("defines T'way as the default airline output rule set", () => {
  const tway = getAirline(DEFAULT_AIRLINE_ID);

  assert.equal(tway.id, "tway");
  assert.deepEqual(tway.excludedDuties, ["O", "EX", "2F"]);
  assert.equal(tway.credit.blockTime({ duty: "NF", blockTime: 91 }), 61);
});

test("requests and caches sunrise/sunset times in UTC", () => {
  assert.match(appJs, /const SUN_CACHE_KEY = "flightTimeSunTimesUtcByAirportDate"/);
  assert.match(appJs, /timezone: "UTC"/);
  assert.match(appJs, /UTC 일출/);
});

test("provides a config button and editable aircraft mapping popup", () => {
  assert.match(appMarkup, /id="configButton"/);
  assert.match(appMarkup, /id="configDialog"/);
  assert.match(appMarkup, /id="configText"/);
  assert.match(appMarkup, /id="configDeltaPreview"/);
  assert.match(appMarkup, /id="requestDbUpdateButton"/);
  assert.match(appMarkup, /className="config-delta-row"/);
  assert.match(appMarkup, /https:\/\/github\.com\/heesung6701\/Flight-Time\/blob\/main\/data\/aircraft-types\.json/);
  assert.match(appMarkup, /항공기번호/);
});

test("uses the default textarea rendering for the config editor", () => {
  assert.doesNotMatch(appMarkup, /id="configHighlight"/);
  assert.doesNotMatch(appJs, /configHighlight/);
  assert.doesNotMatch(appJs, /renderConfigHighlight/);
  assert.doesNotMatch(stylesCss, /\.config-highlight/);
  assert.doesNotMatch(stylesCss, /\.config-text\s*{/);
  assert.doesNotMatch(stylesCss, /\.config-editor \.config-text\s*{/);
  assert.doesNotMatch(stylesCss, /\.config-text::selection/);
  assert.doesNotMatch(stylesCss, /caret-color:/);
});

test("fills the direct input dialog apply button width", () => {
  assert.match(stylesCss, /\.manual-input-actions button\s*{[^}]*width:\s*100%/s);
});

test("places input mode buttons in one row at full width", () => {
  assert.match(stylesCss, /\.input-mode-actions\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(stylesCss, /\.input-mode-actions \.file-button\s*{[^}]*width:\s*100%/s);
  assert.match(stylesCss, /\.input-mode-actions button\s*{[^}]*width:\s*100%/s);
});

test("builds a GitHub issue request for local aircraft config deltas", () => {
  assert.match(appJs, /AIRCRAFT_TYPE_ISSUE_API_URL/);
  assert.match(appJs, /AIRCRAFT_TYPE_ISSUE_URL/);
  assert.match(appJs, /localConfigDelta/);
  assert.match(appJs, /configDraftDelta/);
  assert.match(appJs, /currentConfigDelta/);
  assert.match(appJs, /const deltaCount = currentConfigDelta\(\)\.length/);
  assert.match(appJs, /renderConfigDraftState/);
  assert.match(appJs, /renderConfigDeltaPreview/);
  assert.match(appJs, /Add or update registrations/);
  assert.match(appJs, /createAnonymousDbUpdateIssue/);
  assert.match(appJs, /window\.open\(fallbackUrl/);
  assert.match(stylesCss, /\.config-delta-row\s*{[^}]*display:\s*flex/s);
});

test("defines a Vercel function for anonymous aircraft type issue requests", () => {
  assert.match(issueApiJs, /GITHUB_ISSUE_TOKEN/);
  assert.match(issueApiJs, /https:\/\/api\.github\.com\/repos\/heesung6701\/Flight-Time\/issues/);
  assert.match(issueApiJs, /MAX_REQUESTS_PER_HOUR/);
  assert.match(issueApiJs, /website/);
  assert.match(issueApiJs, /Submitted anonymously from the Flight Time config popup/);
  assert.match(issueApiJs, /aircraft-type-map/);
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

test("parses GitHub aircraft type database JSON into registration mappings", () => {
  assert.deepEqual(
    parseAircraftTypeDatabase({
      aircraft: {
        HL8329: { aircraftType: "B38M", model: "737 MAX 8" },
        HL8248: { icaoCode: "B738" },
        EMPTY: { model: "missing type" },
      },
    }),
    { HL8329: "B38M", HL8248: "B738" },
  );
});

test("build script publishes the aircraft type database with Pages assets", () => {
  const buildScript = fs.readFileSync(new URL("../scripts/build-pages.mjs", import.meta.url), "utf8");
  const viteConfig = fs.readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");
  assert.match(buildScript, /vite/);
  assert.match(viteConfig, /data\/aircraft-types\.json/);
  assert.match(viteConfig, /\.nojekyll/);
});

test("does not expose a client-side aircraft lookup API key", () => {
  assert.doesNotMatch(appJs, /RapidAPI|AERODATABOX|X-RapidAPI-Key/);
  assert.doesNotMatch(appMarkup, /AeroDataBox|RapidAPI/);
});

test("defines an aircraft type map issue automation", () => {
  const addUpdateIssueTemplate = fs.readFileSync(new URL("../.github/ISSUE_TEMPLATE/aircraft-type-map-add-update.yml", import.meta.url), "utf8");
  const deleteIssueTemplate = fs.readFileSync(new URL("../.github/ISSUE_TEMPLATE/aircraft-type-map-delete.yml", import.meta.url), "utf8");
  const workflow = fs.readFileSync(new URL("../.github/workflows/apply-aircraft-type-issue.yml", import.meta.url), "utf8");
  const script = fs.readFileSync(new URL("../scripts/apply-aircraft-type-issue.mjs", import.meta.url), "utf8");

  assert.match(addUpdateIssueTemplate, /aircraft-type-map/);
  assert.match(addUpdateIssueTemplate, /Add or update/);
  assert.match(addUpdateIssueTemplate, /Registrations and aircraft types/);
  assert.match(addUpdateIssueTemplate, /Enter one registration and one aircraft type per row/);
  assert.match(deleteIssueTemplate, /aircraft-type-map-delete/);
  assert.match(deleteIssueTemplate, /Registrations to delete/);
  assert.match(deleteIssueTemplate, /Enter only one registration per row/);
  assert.doesNotMatch(deleteIssueTemplate, /HL8513 B73M/);
  assert.match(workflow, /issues:/);
  assert.match(workflow, /aircraft-type-map/);
  assert.match(workflow, /Detect and label aircraft type issue/);
  assert.match(workflow, /createLabel/);
  assert.match(workflow, /addLabels/);
  assert.match(workflow, /Resolve issue/);
  assert.match(workflow, /state_reason: 'completed'/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /close-invalid-open-issues/);
  assert.match(workflow, /listForRepo/);
  assert.match(workflow, /state_reason: 'not_planned'/);
  assert.match(workflow, /summary\.invalidInput/);
  assert.match(workflow, /입력 형식 오류/);
  assert.match(workflow, /steps\.commit\.outputs\.sha/);
  assert.match(workflow, /Final map/);
  assert.match(workflow, /aircraft-type-issue-summary\.json/);
  assert.match(workflow, /data\/aircraft-types\.json package\.json package-lock\.json index\.html/);
  assert.doesNotMatch(workflow, /app\.js/);
  assert.match(script, /GITHUB_EVENT_PATH/);
  assert.match(script, /IssueInputError/);
  assert.match(script, /aircraftRowsSection/);
  assert.match(script, /Registrations and aircraft types/);
  assert.match(script, /Registrations to delete/);
  assert.match(script, /invalidInput: true/);
  assert.match(script, /bumpAppVersion/);
  assert.match(script, /packageLockPath/);
  assert.match(script, /indexPath/);
  assert.match(script, /writeSummary/);
});

test("calculates B/T and F/O from duty using full F block time and rounded two thirds NF block time", () => {
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
      blockTime: 91,
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

  assert.equal(modified[0].blockTime, 90);
  assert.equal(modified[0].fo, 90);
  assert.equal(modified[1].blockTime, 61);
  assert.equal(modified[1].fo, 61);
  assert.equal(modified[2].blockTime, 90);
  assert.equal(modified[2].fo, "");
});

test("parses local clock times for sunrise/sunset comparison", () => {
  assert.equal(parseClockMinutes("00:00"), 0);
  assert.equal(parseClockMinutes("5:07"), 307);
  assert.equal(parseClockMinutes("23:59"), 1439);
  assert.equal(parseClockMinutes("2026-05-24T19:43"), 1183);
  assert.equal(parseClockMinutes("5:20:33 AM"), 320);
  assert.equal(parseClockMinutes("7:44:23 PM"), 1184);
  assert.equal(parseClockMinutes("bad"), null);
  assert.equal(parseClockMinutes("24:00"), null);
});

test("detects night outside sunrise-inclusive and sunset-exclusive day window", () => {
  const sunTimes = { sunrise: "06:00", sunset: "18:00" };

  assert.equal(isClockNight("05:59", sunTimes), true);
  assert.equal(isClockNight("06:00", sunTimes), false);
  assert.equal(isClockNight("17:59", sunTimes), false);
  assert.equal(isClockNight("18:00", sunTimes), true);
});

test("detects daytime when UTC sunrise/sunset window crosses midnight", () => {
  const icnUtcSunTimes = { sunrise: "20:33:15", sunset: "10:30:45" };

  assert.equal(isClockNight("19:00", icnUtcSunTimes), true);
  assert.equal(isClockNight("20:33", icnUtcSunTimes), false);
  assert.equal(isClockNight("22:59", icnUtcSunTimes), false);
  assert.equal(isClockNight("10:29", icnUtcSunTimes), false);
  assert.equal(isClockNight("10:30", icnUtcSunTimes), true);
});

test("infers arrival date from existing row RO/RI clocks when RI crosses midnight", () => {
  assert.equal(inferArrivalDate("2030-01-02", "02:30", "04:00"), "2030-01-02");
  assert.equal(inferArrivalDate("2030-01-02", "23:30", "01:10"), "2030-01-03");
});

test("classifies existing fixture takeoff and landing by RO/RI against airport sunrise/sunset", () => {
  const originalRows = parseOriginalRows(parseTsv(fixture));
  const row = originalRows.find((item) => item.aircraft === "TEST004");
  const sunTimesByAirportDate = {
    "CCC|2030-01-04": { sunrise: "06:00", sunset: "18:00" },
    "AAA|2030-01-04": { sunrise: "06:00", sunset: "18:00" },
  };

  assert.deepEqual(classifyTakeoffLandingBySun(row, sunTimesByAirportDate), {
    dayTakeoff: "",
    dayLanding: "",
    nightTakeoff: 1,
    nightLanding: 1,
  });
});

test("classifies fixture daytime RO/RI as day takeoff and day landing", () => {
  const originalRows = parseOriginalRows(parseTsv(fixture));
  const row = originalRows.find((item) => item.aircraft === "TEST005");
  const sunTimesByAirportDate = {
    "BBB|2030-01-05": { sunrise: "06:00", sunset: "18:00" },
    "AAA|2030-01-05": { sunrise: "06:00", sunset: "18:00" },
  };

  assert.deepEqual(classifyTakeoffLandingBySun(row, sunTimesByAirportDate), {
    dayTakeoff: 1,
    dayLanding: 1,
    nightTakeoff: "",
    nightLanding: "",
  });
});

test("ignores takeoff and landing time columns and classifies only by RO and RI", () => {
  const [row] = parseOriginalRows([
    ["HLTEST", "2030-06-01", "F", "729", "AAA", "BBB", "B738", "07:00", "20:00", "13:00", "23:00", "12:00", "12:30", "", "00:30", 1, 1],
  ]);
  const sunTimesByAirportDate = {
    "AAA|2030-06-01": { sunrise: "06:00", sunset: "18:00" },
    "BBB|2030-06-01": { sunrise: "06:00", sunset: "18:00" },
  };

  assert.deepEqual(classifyTakeoffLandingBySun(row, sunTimesByAirportDate), {
    dayTakeoff: 1,
    dayLanding: "",
    nightTakeoff: "",
    nightLanding: 1,
  });
});

test("returns null when sun-based classification lacks required times", () => {
  const originalRows = parseOriginalRows(parseTsv(fixture));
  const row = originalRows.find((item) => item.aircraft === "TEST004");

  assert.equal(classifyTakeoffLandingBySun(row, {}), null);
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


test("modifyRows prefers sun-based classification when airport date sun times are available", () => {
  const [row] = parseOriginalRows([
    ["HLTEST", "2030-06-01", "F", "729", "AAA", "BBB", "B738", "19:00", "20:30", "01:30", "19:15", "20:15", "01:00", "", "00:30", 1, 1],
  ]);
  const [modified] = modifyRows([row], {
    sunTimesByAirportDate: {
      "AAA|2030-06-01": { sunrise: "06:00", sunset: "18:00" },
      "BBB|2030-06-01": { sunrise: "06:00", sunset: "21:00" },
    },
  });

  assert.equal(modified.dayTakeoff, "");
  assert.equal(modified.nightTakeoff, 1);
  assert.equal(modified.dayLanding, 1);
  assert.equal(modified.nightLanding, "");
});

test("modifyRows falls back to legacy flight number classification when sun times are missing", () => {
  const [row] = parseOriginalRows([
    ["HLTEST", "2030-06-01", "F", "729", "AAA", "BBB", "B738", "19:00", "20:30", "01:30", "19:15", "20:15", "01:00", "", "00:30", 1, 1],
  ]);
  const [modified] = modifyRows([row], { sunTimesByAirportDate: {} });

  assert.equal(modified.dayTakeoff, 1);
  assert.equal(modified.nightLanding, 1);
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
  assert.match(appJs, /displayTakeoffCount\(row\.dayLanding\)/);
  assert.match(appJs, /displayTakeoffCount\(row\.nightLanding\)/);
});

test("adds calculation tooltips to output cells", () => {
  assert.match(appJs, /function tooltipAttr/);
  assert.doesNotMatch(appJs, /값: \$\{displayValue\}/);
  assert.match(appJs, /rowTooltips\(row\)/);
  assert.match(appJs, /totalTooltip\(label, summary, rows, "blockTime"/);
});

test("adds count difference tooltip to summary counts", () => {
  assert.match(appJs, /function countDifferenceTooltip/);
  assert.match(appJs, /excludedDutyDetails\(report, airline\)/);
  assert.match(appJs, /setCountTooltip\(els\.originalCount, countTooltip\)/);
  assert.match(appJs, /setCountTooltip\(els\.filteredCount, countTooltip\)/);
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
