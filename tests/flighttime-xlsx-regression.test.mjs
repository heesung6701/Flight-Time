import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildOutputPage,
  formatDuration,
  modifyRows,
  parseAircraftTypeMap,
  parseDuration,
  parseOriginalRows,
} from "../src/core/flighttime-core.js";

const workbookPath = process.env.FLIGHTTIME_XLSX_PATH || path.join(os.homedir(), "Downloads", "flighttime.xlsx");
const extractorPath = new URL("./harness/extract-xlsx-json.py", import.meta.url).pathname;

function loadWorkbookSheets(sheetNames) {
  const output = execFileSync("python3", [extractorPath, workbookPath, ...sheetNames], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  return JSON.parse(output);
}

function countValue(value) {
  if (value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function excelDayToMinutes(value) {
  if (value === "") return "";
  return Math.round(Number(value) * 24 * 60);
}

function durationValue(value) {
  if (value === "") return "";
  return String(value).includes(":") ? parseDuration(value) : excelDayToMinutes(value);
}

function expectedOutputRow(row) {
  return {
    date: row[0],
    aircraftType: row[1],
    aircraftIdent: row[2],
    from: row[3],
    to: row[4],
    flightNo: row[5],
    dayTakeoff: countValue(row[6]),
    dayLanding: countValue(row[7]),
    nightTakeoff: countValue(row[8]),
    nightLanding: countValue(row[9]),
    dayCondition: durationValue(row[11]),
    nightCondition: durationValue(row[12]),
    actualInst: durationValue(row[13]),
    blockTime: durationValue(row[15]),
    pic: durationValue(row[16]),
    fo: durationValue(row[17]),
    id: countValue(row[23]),
  };
}

function comparableOutputRow(row) {
  return {
    date: row.date,
    aircraftType: row.aircraftType,
    aircraftIdent: row.aircraftIdent,
    from: row.from,
    to: row.to,
    flightNo: row.flightNo,
    dayTakeoff: row.dayTakeoff,
    dayLanding: row.dayLanding,
    nightTakeoff: row.nightTakeoff,
    nightLanding: row.nightLanding,
    dayCondition: row.dayCondition,
    nightCondition: row.nightCondition,
    actualInst: row.actualInst,
    blockTime: row.blockTime,
    pic: row.pic,
    fo: row.fo,
    id: row.id,
  };
}

test("matches the filled output page from the private flighttime workbook", { skip: !fs.existsSync(workbookPath) }, () => {
  const sheets = loadWorkbookSheets(["original", "config", "output"]);
  const aircraftTypes = parseAircraftTypeMap(sheets.config);
  const originalRows = parseOriginalRows(sheets.original, { aircraftTypes });
  const modifiedRows = modifyRows(originalRows, { pageSize: 19 });
  const expectedPageNumber = countValue(sheets.output[1][1]);
  const expectedStart = countValue(sheets.output[2][1]);
  const expectedEnd = countValue(sheets.output[3][1]);
  const expectedCount = countValue(sheets.output[4][1]);

  const page = buildOutputPage(modifiedRows, expectedPageNumber, 19);

  assert.equal(page.page, expectedPageNumber);
  assert.equal(page.maxPage, 32);
  assert.equal(page.start, expectedStart);
  assert.equal(page.end, expectedEnd);
  assert.equal(page.count, expectedCount);

  const expectedRows = sheets.output.slice(9, 28).map(expectedOutputRow);
  assert.deepEqual(page.rows.map(comparableOutputRow), expectedRows);

  assert.equal(formatDuration(page.pageTotal.dayCondition), formatDuration(excelDayToMinutes(sheets.output[28][11])));
  assert.equal(formatDuration(page.pageTotal.nightCondition), formatDuration(excelDayToMinutes(sheets.output[28][12])));
  assert.equal(formatDuration(page.pageTotal.actualInst), formatDuration(excelDayToMinutes(sheets.output[28][13])));
  assert.equal(formatDuration(page.pageTotal.blockTime), formatDuration(excelDayToMinutes(sheets.output[28][15])));
  assert.equal(formatDuration(page.pageTotal.fo), formatDuration(excelDayToMinutes(sheets.output[28][17])));
});
