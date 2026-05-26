import {
  DEFAULT_PAGE_SIZE,
  buildOutputPage,
  airportSunKey,
  buildValidationReport,
  clean,
  displayCount,
  displayTakeoffCount,
  formatDuration,
  inferArrivalDate,
  modifyRows,
  normalizePageSize,
  numeric,
  parseAircraftConfigText,
  parseAircraftTypeDatabase,
  parseAircraftTypeMap,
  parseOriginalRows,
  parseTsv,
  serializeAircraftTypeMap,
} from "./src/core/flighttime-core.js?v=0.1.28";

const CONFIG_STORAGE_KEY = "flightTimeAircraftTypes";
const AIRPORT_CACHE_KEY = "flightTimeAirportsByIata";
const SUN_CACHE_KEY = "flightTimeSunTimesUtcByAirportDate";
const AIRCRAFT_TYPE_DB_URL = "./data/aircraft-types.json";
const AIRPORT_DATA_URL = "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json";
const SUN_API_URL = "https://api.sunrisesunset.io/json";

const state = {
  rawOriginalRows: [],
  originalRows: [],
  modifiedRows: [],
  aircraftTypes: loadSavedAircraftTypes(),
  aircraftTypeDbLoaded: false,
  currentPage: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  effectivePageSize: DEFAULT_PAGE_SIZE,
  sunTimesByAirportDate: loadSavedJson(SUN_CACHE_KEY, {}),
  sunRequestToken: 0,
};

const els = {
  workbookInput: document.querySelector("#workbookInput"),
  pasteArea: document.querySelector("#pasteArea"),
  parsePasteButton: document.querySelector("#parsePasteButton"),
  configButton: document.querySelector("#configButton"),
  configDialog: document.querySelector("#configDialog"),
  configText: document.querySelector("#configText"),
  configStatus: document.querySelector("#configStatus"),
  saveConfigButton: document.querySelector("#saveConfigButton"),
  closeConfigButton: document.querySelector("#closeConfigButton"),
  printButton: document.querySelector("#printButton"),
  loadState: document.querySelector("#loadState"),
  originalCount: document.querySelector("#originalCount"),
  filteredCount: document.querySelector("#filteredCount"),
  pageCount: document.querySelector("#pageCount"),
  pageRange: document.querySelector("#pageRange"),
  pageSizeSelect: document.querySelector("#pageSizeSelect"),
  pageInput: document.querySelector("#pageInput"),
  prevPage: document.querySelector("#prevPage"),
  nextPage: document.querySelector("#nextPage"),
  startNo: document.querySelector("#startNo"),
  endNo: document.querySelector("#endNo"),
  pageRows: document.querySelector("#pageRows"),
  blockTotal: document.querySelector("#blockTotal"),
  instTotal: document.querySelector("#instTotal"),
  outputBody: document.querySelector("#outputBody"),
  totalBody: document.querySelector("#totalBody"),
  emptyRowTemplate: document.querySelector("#emptyRowTemplate"),
};

function rowsFromSheet(sheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
}

function loadSavedAircraftTypes() {
  try {
    return parseAircraftConfigText(localStorage.getItem(CONFIG_STORAGE_KEY) || "");
  } catch {
    return {};
  }
}

function loadSavedJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "") || fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Caches are best-effort only.
  }
}

async function loadAircraftTypeDatabase() {
  const response = await fetch(`${AIRCRAFT_TYPE_DB_URL}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`aircraft type db ${response.status}`);
  const dbMap = parseAircraftTypeDatabase(await response.json());
  state.aircraftTypes = {
    ...dbMap,
    ...loadSavedAircraftTypes(),
  };
  state.aircraftTypeDbLoaded = true;
  refreshOriginalRows();
  updateConfigStatus();
  renderOutput();
}

async function loadAirportsByIata() {
  const cached = loadSavedJson(AIRPORT_CACHE_KEY, null);
  if (cached && Object.keys(cached).length) return cached;

  const response = await fetch(AIRPORT_DATA_URL);
  if (!response.ok) throw new Error(`airport data ${response.status}`);
  const airports = await response.json();
  const byIata = {};
  for (const airport of Object.values(airports)) {
    const iata = clean(airport?.iata).toUpperCase();
    const lat = Number(airport?.lat);
    const lng = Number(airport?.lon);
    if (iata && Number.isFinite(lat) && Number.isFinite(lng)) {
      byIata[iata] = { lat, lng, name: clean(airport?.name), tz: clean(airport?.tz) };
    }
  }
  saveJson(AIRPORT_CACHE_KEY, byIata);
  return byIata;
}

function rowsNeedingSunTimes(rows) {
  return rows.filter((row) => row.night > 0 && row.night !== row.blockTime);
}

function requiredSunKeys(rows) {
  const keys = new Map();
  for (const row of rowsNeedingSunTimes(rows)) {
    const departureDate = clean(row.date);
    const arrivalDate = inferArrivalDate(departureDate, row.ro, row.ri);
    if (row.from && departureDate) keys.set(airportSunKey(row.from, departureDate), { iata: row.from, date: departureDate });
    if (row.to && arrivalDate) keys.set(airportSunKey(row.to, arrivalDate), { iata: row.to, date: arrivalDate });
  }
  return [...keys.values()];
}

async function fetchSunTime(airport, date) {
  const params = new URLSearchParams({
    lat: String(airport.lat),
    lng: String(airport.lng),
    date,
    time_format: "24",
    timezone: "UTC",
  });
  const response = await fetch(`${SUN_API_URL}?${params}`);
  if (!response.ok) throw new Error(`sun data ${response.status}`);
  const data = await response.json();
  if (!data?.results?.sunrise || !data?.results?.sunset) throw new Error("sun data missing sunrise/sunset");
  return {
    sunrise: data.results.sunrise,
    sunset: data.results.sunset,
    timezone: "UTC",
  };
}

async function refreshSunTimes() {
  const token = ++state.sunRequestToken;
  const requests = requiredSunKeys(state.originalRows).filter(({ iata, date }) => !state.sunTimesByAirportDate[airportSunKey(iata, date)]);
  if (!requests.length) return;

  setLoaded(`일출/일몰 ${requests.length}건 조회 중...`);
  try {
    const airportsByIata = await loadAirportsByIata();
    let loaded = 0;
    for (const { iata, date } of requests) {
      const airport = airportsByIata[clean(iata).toUpperCase()];
      if (!airport) continue;
      const key = airportSunKey(iata, date);
      state.sunTimesByAirportDate[key] = await fetchSunTime(airport, date);
      loaded += 1;
    }
    saveJson(SUN_CACHE_KEY, state.sunTimesByAirportDate);
    if (token === state.sunRequestToken) {
      if (loaded) {
        setLoaded(`일출/일몰 ${loaded}건 적용됨`);
        renderOutput();
      } else {
        setLoaded("일출/일몰 공항 좌표 없음 · 기존 규칙으로 계산됨");
      }
    }
  } catch (error) {
    console.warn("Sunrise/sunset lookup failed; falling back to legacy classification", error);
    if (token === state.sunRequestToken) setLoaded("일출/일몰 조회 실패 · 기존 규칙으로 계산됨");
  }
}

function saveAircraftTypes() {
  localStorage.setItem(CONFIG_STORAGE_KEY, serializeAircraftTypeMap(state.aircraftTypes));
}

function refreshOriginalRows() {
  state.originalRows = parseOriginalRows(state.rawOriginalRows, {
    aircraftTypes: state.aircraftTypes,
    xlsxDateParser: window.XLSX?.SSF?.parse_date_code,
  });
}

function configCount() {
  return Object.keys(state.aircraftTypes).length;
}

function updateConfigStatus() {
  if (els.configStatus) {
    const source = state.aircraftTypeDbLoaded ? "GitHub DB + local" : "local";
    els.configStatus.textContent = `현재 ${configCount()}개 등록 (${source})`;
  }
}

function openConfigDialog() {
  els.configText.value = serializeAircraftTypeMap(state.aircraftTypes);
  updateConfigStatus();
  if (typeof els.configDialog.showModal === "function") {
    els.configDialog.showModal();
  } else {
    els.configDialog.setAttribute("open", "");
  }
}

function closeConfigDialog() {
  if (typeof els.configDialog.close === "function") {
    els.configDialog.close();
  } else {
    els.configDialog.removeAttribute("open");
  }
}

function handleConfigSave() {
  state.aircraftTypes = parseAircraftConfigText(els.configText.value);
  saveAircraftTypes();
  refreshOriginalRows();
  updateConfigStatus();
  setLoaded(`config ${configCount()}개 적용됨`);
  renderOutput();
  closeConfigDialog();
}

function escapeHtml(value) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function tooltipAttr(value, tooltip) {
  const text = clean(tooltip);
  if (!text) return "";
  const displayValue = clean(value) || "blank";
  const title = `값: ${displayValue}\n${text}`;
  return ` title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}"`;
}

function cell(value, className = "", tooltip = "") {
  return `<td class="${className}"${tooltipAttr(value, tooltip)}>${escapeHtml(value)}</td>`;
}

function spanCell(value, colspan, className = "", tooltip = "") {
  return `<td colspan="${colspan}" class="${className}"${tooltipAttr(value, tooltip)}>${escapeHtml(value)}</td>`;
}

function setLoaded(message) {
  els.loadState.textContent = message;
}

function buildModifiedRows() {
  state.effectivePageSize = normalizePageSize(state.pageSize, state.originalRows.length);
  state.modifiedRows = modifyRows(state.originalRows, {
    pageSize: state.effectivePageSize,
    sunTimesByAirportDate: state.sunTimesByAirportDate,
  });
  const maxPage = Math.max(Math.ceil(state.modifiedRows.length / state.effectivePageSize), 1);
  state.currentPage = Math.min(Math.max(state.currentPage, 1), maxPage);
}

function filteredOriginalRows() {
  return state.originalRows.filter((original) => !["O", "EX", "2F"].includes(original.duty.toUpperCase()));
}

function sourceRowForOutputRow(row) {
  return filteredOriginalRows()[row.id - 1] || null;
}

function durationFormula(value, label = "값") {
  return `${label}: ${formatDuration(value) || "00:00"}`;
}

function sunWindowText(sunTimes) {
  if (!sunTimes?.sunrise || !sunTimes?.sunset) return "일출/일몰 정보 없음";
  return `UTC 일출 ${sunTimes.sunrise}, UTC 일몰 ${sunTimes.sunset}${sunTimes.timezone ? ` (${sunTimes.timezone})` : ""}`;
}

function takeoffLandingTooltip(original, kind, value) {
  if (!original) return "";
  const isTakeoff = kind.includes("Takeoff");
  const isNightColumn = kind.includes("night");
  const airport = isTakeoff ? original.from : original.to;
  const clock = isTakeoff ? original.ro : original.ri;
  const date = isTakeoff ? clean(original.date) : inferArrivalDate(original.date, original.ro, original.ri);
  const count = isTakeoff ? original.takeoff : original.landing;
  const sunTimes = state.sunTimesByAirportDate[airportSunKey(airport, date)];
  const column = `${isNightColumn ? "Night" : "Day"} ${isTakeoff ? "T/O" : "L/D"}`;
  const displayed = displayTakeoffCount(value) || "blank";

  if (sunTimes) {
    return `${column}: ${airport} ${date} ${clock || "시간 없음"} UTC 기준. ${sunWindowText(sunTimes)}와 비교해 ${isNightColumn ? "야간" : "주간"}이면 원본 count ${count || 0} 표시 → ${displayed}.`;
  }

  const hasNight = original.night > 0;
  const nightEqualsBlock = hasNight && original.night === original.blockTime;
  const isSpecial = /^\d+$/.test(clean(original.flightNo)) && (clean(original.flightNo)[0] === "0" || clean(original.flightNo)[0] === "1") && Number(original.flightNo) % 2 === 0;
  if (!hasNight) return `${column}: Night 시간이 0이라 T/O·L/D를 주간으로 분류. 원본 count ${count || 0} → ${displayed}.`;
  if (nightEqualsBlock) return `${column}: Night(${formatDuration(original.night)}) = B/T(${formatDuration(original.blockTime)})라 T/O·L/D를 야간으로 분류. 원본 count ${count || 0} → ${displayed}.`;
  if (isSpecial) return `${column}: 편명 ${original.flightNo}는 0/1로 시작하는 짝수편이라 T/O는 야간, L/D는 주간으로 분류. 원본 count ${count || 0} → ${displayed}.`;
  return `${column}: 일부 야간 비행이며 일반편이라 T/O는 주간, L/D는 야간으로 분류. 원본 count ${count || 0} → ${displayed}.`;
}

function rowTooltips(row) {
  const original = sourceRowForOutputRow(row);
  if (!original) return {};
  const dayCondition = `${durationFormula(original.blockTime, "B/T")} - ${durationFormula(original.night, "Night")} = ${formatDuration(Math.max(original.blockTime - original.night, 0)) || "00:00"}`;
  const duty = original.duty.toUpperCase();
  const fo = duty === "F"
    ? `F/O: duty F라 B/T ${formatDuration(original.blockTime) || "00:00"} 전체 적용.`
    : duty === "NF"
      ? `F/O: duty NF라 원본 B/T ${formatDuration(original.blockTime) || "00:00"} × 2/3 반올림 = ${formatDuration(row.fo) || "00:00"}.`
      : `F/O: duty ${original.duty || "blank"}는 F/O 시간 없음.`;
  const blockTime = duty === "NF"
    ? `B/T: duty NF라 원본 Block Time ${formatDuration(original.blockTime) || "00:00"} × 2/3 반올림 = ${formatDuration(row.blockTime) || "00:00"}.`
    : `B/T: 원본 Block Time ${formatDuration(original.blockTime) || "00:00"} 적용.`;
  return {
    dayTakeoff: takeoffLandingTooltip(original, "dayTakeoff", row.dayTakeoff),
    dayLanding: takeoffLandingTooltip(original, "dayLanding", row.dayLanding),
    nightTakeoff: takeoffLandingTooltip(original, "nightTakeoff", row.nightTakeoff),
    nightLanding: takeoffLandingTooltip(original, "nightLanding", row.nightLanding),
    dayCondition: `Day condition: ${dayCondition}.`,
    nightCondition: `Night condition: 원본 Night ${formatDuration(original.night) || "00:00"} 적용.`,
    actualInst: `Actual Inst.: 원본 Inst. ${formatDuration(original.inst) || "00:00"} 적용.`,
    blockTime,
    fo,
  };
}

function totalTooltip(label, summary, rows, key, formatter = String) {
  const includedRows = rows.filter((row) => numeric(row[key]));
  const parts = includedRows.map((row) => `#${row.id} ${formatter(row[key]) || "00:00"}`);
  const total = formatter(summary[key] || 0) || "00:00";
  return `${label} ${key}: ${parts.length ? parts.join(" + ") : "계산할 값 없음"} = ${total}`;
}

function renderOutput() {
  buildModifiedRows();
  const report = buildValidationReport(state.originalRows);
  const page = buildOutputPage(state.modifiedRows, state.currentPage, state.effectivePageSize);

  els.originalCount.textContent = report.originalCount;
  els.filteredCount.textContent = report.filteredCount;
  els.pageCount.textContent = page.maxPage;
  els.pageRange.textContent = `page in 1~${page.maxPage}`;
  els.pageSizeSelect.value = String(state.pageSize);
  els.pageInput.max = Math.max(page.maxPage, 1);
  els.pageInput.value = page.page;
  els.startNo.textContent = page.start ?? "-";
  els.endNo.textContent = page.end ?? "-";
  els.pageRows.textContent = page.count || "-";
  els.blockTotal.textContent = formatDuration(page.pageTotal.blockTime) || "00:00";
  els.instTotal.textContent = formatDuration(page.pageTotal.actualInst) || "00:00";

  els.outputBody.innerHTML = "";
  if (!page.rows.length) {
    els.outputBody.appendChild(els.emptyRowTemplate.content.cloneNode(true));
  } else {
    page.rows.forEach((row) => {
      const tooltips = rowTooltips(row);
      const tr = document.createElement("tr");
      tr.innerHTML = [
        cell(row.date),
        cell(row.aircraftType),
        cell(row.aircraftIdent),
        cell(row.from),
        cell(row.to),
        cell(row.flightNo),
        cell(displayTakeoffCount(row.dayTakeoff), "", tooltips.dayTakeoff),
        cell(displayTakeoffCount(row.dayLanding), "", tooltips.dayLanding),
        cell(displayTakeoffCount(row.nightTakeoff), "", tooltips.nightTakeoff),
        cell(displayTakeoffCount(row.nightLanding), "", tooltips.nightLanding),
        cell(row.autoLand),
        cell(formatDuration(row.dayCondition), "", tooltips.dayCondition),
        cell(formatDuration(row.nightCondition), "", tooltips.nightCondition),
        cell(formatDuration(row.actualInst), "", tooltips.actualInst),
        cell(row.instApp),
        cell(formatDuration(row.blockTime), "", tooltips.blockTime),
        cell(formatDuration(row.pic)),
        cell(formatDuration(row.fo), "", tooltips.fo),
        cell(row.otherPilot),
        cell(row.simulator),
        cell(row.flightInstructor),
        cell(row.simulatorInstructor),
        cell(row.remark),
        cell(row.id),
      ].join("");
      els.outputBody.appendChild(tr);
    });
  }

  renderTotals(page);
}

function renderTotals(page) {
  const totals = [
    ["PAGE TOTAL", page.pageTotal, page.rows],
    ["PREVIOUS TOTAL", page.previousTotal, state.modifiedRows.slice(0, (page.page - 1) * state.effectivePageSize)],
    ["NEW TOTAL", page.newTotal, state.modifiedRows.slice(0, (page.page - 1) * state.effectivePageSize + page.rows.length)],
  ];
  els.totalBody.innerHTML = totals
    .map(([label, summary, rows]) => {
      const cells = [
        cell(""),
        cell(""),
        cell(""),
        cell(""),
        spanCell(label, 2, "label-cell"),
        cell(summary.dayTakeoff || "", "", totalTooltip(label, summary, rows, "dayTakeoff")),
        cell(summary.dayLanding || "", "", totalTooltip(label, summary, rows, "dayLanding")),
        cell(summary.nightTakeoff || "", "", totalTooltip(label, summary, rows, "nightTakeoff")),
        cell(summary.nightLanding || "", "", totalTooltip(label, summary, rows, "nightLanding")),
        cell(""),
        cell(formatDuration(summary.dayCondition), "", totalTooltip(label, summary, rows, "dayCondition", formatDuration)),
        cell(formatDuration(summary.nightCondition), "", totalTooltip(label, summary, rows, "nightCondition", formatDuration)),
        cell(formatDuration(summary.actualInst), "", totalTooltip(label, summary, rows, "actualInst", formatDuration)),
        cell(""),
        cell(formatDuration(summary.blockTime), "", totalTooltip(label, summary, rows, "blockTime", formatDuration)),
        cell(""),
        cell(formatDuration(summary.fo), "", totalTooltip(label, summary, rows, "fo", formatDuration)),
        cell(""),
        cell(""),
        cell(""),
        cell(""),
        cell(""),
        cell(""),
      ];
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("");
}

async function handleWorkbook(file) {
  if (!window.XLSX) {
    setLoaded("XLSX 라이브러리 로드 실패");
    return;
  }
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const originalSheet = workbook.Sheets.original || workbook.Sheets.Original || workbook.Sheets[workbook.SheetNames[0]];
  const configSheet = workbook.Sheets.config || workbook.Sheets.Config;
  if (configSheet) {
    state.aircraftTypes = {
      ...state.aircraftTypes,
      ...parseAircraftTypeMap(rowsFromSheet(configSheet)),
    };
    saveAircraftTypes();
  }

  state.rawOriginalRows = rowsFromSheet(originalSheet);
  refreshOriginalRows();
  state.currentPage = 1;
  setLoaded(`${file.name} original 로드됨 · config ${configCount()}개`);
  renderOutput();
  refreshSunTimes();
}

function handlePaste() {
  const rows = parseTsv(els.pasteArea.value);
  if (!rows.length) return;
  state.rawOriginalRows = rows;
  refreshOriginalRows();
  state.currentPage = 1;
  setLoaded(`붙여넣기 적용됨 · config ${configCount()}개`);
  renderOutput();
  refreshSunTimes();
}

function changePage(nextPage) {
  const maxPage = Math.max(Math.ceil(state.modifiedRows.length / state.effectivePageSize), 1);
  state.currentPage = Math.min(Math.max(nextPage, 1), maxPage);
  renderOutput();
}

function changePageSize(nextPageSize) {
  state.pageSize = String(nextPageSize).toLowerCase() === "all" ? "all" : normalizePageSize(nextPageSize);
  state.currentPage = 1;
  renderOutput();
}

els.workbookInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) {
    handleWorkbook(file).catch((error) => {
      console.error(error);
      setLoaded("파일을 읽지 못했습니다");
    });
  }
});

els.parsePasteButton.addEventListener("click", handlePaste);
els.configButton.addEventListener("click", openConfigDialog);
els.saveConfigButton.addEventListener("click", handleConfigSave);
els.closeConfigButton.addEventListener("click", closeConfigDialog);
els.configDialog.addEventListener("click", (event) => {
  if (event.target === els.configDialog) closeConfigDialog();
});
els.printButton.addEventListener("click", () => window.print());
els.prevPage.addEventListener("click", () => changePage(state.currentPage - 1));
els.nextPage.addEventListener("click", () => changePage(state.currentPage + 1));
els.pageSizeSelect.addEventListener("change", () => changePageSize(els.pageSizeSelect.value));
els.pageInput.addEventListener("change", () => changePage(Number(els.pageInput.value || 1)));
updateConfigStatus();
renderOutput();
loadAircraftTypeDatabase().catch((error) => {
  console.warn("Aircraft type database lookup failed; using local config only", error);
  updateConfigStatus();
});
