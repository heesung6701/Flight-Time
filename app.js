import {
  DEFAULT_PAGE_SIZE,
  buildOutputPage,
  buildValidationReport,
  clean,
  displayCount,
  formatDuration,
  modifyRows,
  normalizePageSize,
  parseAircraftTypeMap,
  parseOriginalRows,
  parseTsv,
} from "./src/core/flighttime-core.js";

const state = {
  originalRows: [],
  modifiedRows: [],
  currentPage: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  effectivePageSize: DEFAULT_PAGE_SIZE,
};

const els = {
  workbookInput: document.querySelector("#workbookInput"),
  pasteArea: document.querySelector("#pasteArea"),
  parsePasteButton: document.querySelector("#parsePasteButton"),
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

function escapeHtml(value) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cell(value, className = "") {
  return `<td class="${className}">${escapeHtml(value)}</td>`;
}

function setLoaded(message) {
  els.loadState.textContent = message;
}

function buildModifiedRows() {
  state.effectivePageSize = normalizePageSize(state.pageSize, state.originalRows.length);
  state.modifiedRows = modifyRows(state.originalRows, {
    pageSize: state.effectivePageSize,
  });
  const maxPage = Math.max(Math.ceil(state.modifiedRows.length / state.effectivePageSize), 1);
  state.currentPage = Math.min(Math.max(state.currentPage, 1), maxPage);
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
      const tr = document.createElement("tr");
      tr.innerHTML = [
        cell(row.date),
        cell(row.aircraftType),
        cell(row.aircraftIdent),
        cell(row.from),
        cell(row.to),
        cell(row.flightNo),
        cell(displayCount(row.dayTakeoff)),
        cell(displayCount(row.dayLanding)),
        cell(displayCount(row.nightTakeoff)),
        cell(displayCount(row.nightLanding)),
        cell(row.autoLand),
        cell(formatDuration(row.dayCondition)),
        cell(formatDuration(row.nightCondition)),
        cell(formatDuration(row.actualInst)),
        cell(row.instApp),
        cell(formatDuration(row.blockTime)),
        cell(formatDuration(row.pic)),
        cell(formatDuration(row.fo)),
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
    ["PAGE TOTAL", page.pageTotal],
    ["PREVIOUS TOTAL", page.previousTotal],
    ["NEW TOTAL", page.newTotal],
  ];
  els.totalBody.innerHTML = totals
    .map(([label, summary]) => {
      const values = [
        "",
        "",
        "",
        "",
        label,
        "",
        summary.dayTakeoff || "",
        summary.dayLanding || "",
        summary.nightTakeoff || "",
        summary.nightLanding || "",
        "",
        formatDuration(summary.dayCondition),
        formatDuration(summary.nightCondition),
        formatDuration(summary.actualInst),
        "",
        formatDuration(summary.blockTime),
        "",
        formatDuration(summary.fo),
        "",
        "",
        "",
        "",
        "",
        "",
      ];
      return `<tr>${values.map((value, index) => cell(value, index === 4 ? "label-cell" : "")).join("")}</tr>`;
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
  const aircraftTypes = configSheet ? parseAircraftTypeMap(rowsFromSheet(configSheet)) : {};

  state.originalRows = parseOriginalRows(rowsFromSheet(originalSheet), {
    aircraftTypes,
    xlsxDateParser: XLSX.SSF.parse_date_code,
  });
  state.currentPage = 1;
  setLoaded(`${file.name} original 로드됨`);
  renderOutput();
}

function handlePaste() {
  const rows = parseTsv(els.pasteArea.value);
  if (!rows.length) return;
  state.originalRows = parseOriginalRows(rows);
  state.currentPage = 1;
  setLoaded("붙여넣기 적용됨");
  renderOutput();
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
els.printButton.addEventListener("click", () => window.print());
els.prevPage.addEventListener("click", () => changePage(state.currentPage - 1));
els.nextPage.addEventListener("click", () => changePage(state.currentPage + 1));
els.pageSizeSelect.addEventListener("change", () => changePageSize(els.pageSizeSelect.value));
els.pageInput.addEventListener("change", () => changePage(Number(els.pageInput.value || 1)));
renderOutput();
