import packageJson from "../package.json";

const columns = [
  "w-date",
  "w-type",
  "w-ident",
  "w-airport",
  "w-airport",
  "w-flight",
  "w-count",
  "w-count",
  "w-count",
  "w-count",
  "w-count",
  "w-time",
  "w-time",
  "w-time",
  "w-inst",
  "w-time",
  "w-time",
  "w-time",
  "w-time",
  "w-wide",
  "w-wide",
  "w-wide",
  "w-remark",
  "w-no",
];

function LogbookTable() {
  return (
    <table className="logbook-table">
      <colgroup>
        {columns.map((className, index) => (
          <col key={`${className}-${index}`} className={className} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th rowSpan="3">DATE<br />(Mon / Day)</th>
          <th rowSpan="3">AIRCRAFT<br />TYPE</th>
          <th rowSpan="3">AIRCRAFT<br />IDENT</th>
          <th colSpan="2">ROUTE OF FLIGHT</th>
          <th rowSpan="3">FLT.<br />NO.</th>
          <th colSpan="4">T/O &amp; L/D</th>
          <th rowSpan="3">A/L</th>
          <th colSpan="3">CONDITION OF FLT.</th>
          <th rowSpan="3">TYPE&amp;NO<br />INST. APP&gt;</th>
          <th rowSpan="3">B/T</th>
          <th colSpan="3">TYPE OF PILOTING TIME</th>
          <th rowSpan="3">FLIGHT<br />SIMULATOR</th>
          <th rowSpan="3">AS FLIGHT<br />INSTRUCTOR</th>
          <th rowSpan="3">AS SIMULATOR<br />INSTRUCTOR</th>
          <th rowSpan="3">REMARK</th>
          <th rowSpan="3">no</th>
        </tr>
        <tr>
          <th rowSpan="2">FROM</th>
          <th rowSpan="2">TO</th>
          <th colSpan="2">DAY</th>
          <th colSpan="2">NIGHT</th>
          <th rowSpan="2">DAY</th>
          <th rowSpan="2">NIGHT</th>
          <th rowSpan="2">ACTUAL<br />INST.</th>
          <th rowSpan="2">PIC</th>
          <th rowSpan="2">F/O</th>
          <th rowSpan="2"></th>
        </tr>
        <tr>
          <th>T/O</th>
          <th>L/D</th>
          <th>T/O</th>
          <th>L/D</th>
        </tr>
      </thead>
      <tbody id="outputBody"></tbody>
      <tfoot id="totalBody"></tfoot>
    </table>
  );
}

export default function App() {
  return (
    <>
      <div className="version-badge" role="button" tabIndex="0" aria-label="최신 버전으로 새로고침" title="최신 버전으로 새로고침">
        v{packageJson.version}
      </div>
      <main className="app-shell">
        <section id="airlineGate" className="airline-gate">
          <div className="gate-heading">
            <p className="eyebrow">CPS to Logbook</p>
            <h1>항공사를 선택하세요</h1>
          </div>
          <div id="airlineCards" className="airline-cards" aria-label="항공사 선택"></div>
        </section>

        <div id="appWorkspace" hidden>
          <section className="topbar">
            <div>
              <p className="eyebrow">CPS to Logbook</p>
              <h1>Flight Time Output</h1>
              <span id="selectedAirlineName" className="airline-current">T'way Air</span>
            </div>
            <div className="actions">
              <label className="airline-switcher">
                <span>Airline</span>
                <select id="topbarAirlineSelect" aria-label="항공사 변경"></select>
              </label>
              <button id="configButton" type="button" className="secondary-action" title="항공기번호별 기종 설정">Config</button>
              <button id="printButton" type="button" title="Print output">Print</button>
            </div>
          </section>

          <section className="workspace">
            <aside className="panel input-panel">
              <div className="panel-header">
                <h2>Input</h2>
                <span id="loadState">파일 대기 중</span>
              </div>
              <div className="input-mode-actions" aria-label="입력 방식 선택">
                <label className="file-button">
                  <input id="workbookInput" type="file" accept=".xlsx,.xls,.csv" />
                  <span>파일 불러오기</span>
                </label>
                <button id="manualInputButton" className="secondary" type="button">직접 입력</button>
              </div>
              <p className="input-mode-help">파일 업로드 또는 직접 입력 중 하나를 선택하세요.</p>
              <div className="input-actions">
                <button id="clearDataButton" className="secondary ghost" type="button">Clear</button>
              </div>
              <div className="stats-grid">
                <div><span>원본</span><strong id="originalCount">0</strong></div>
                <div><span>출력</span><strong id="filteredCount">0</strong></div>
                <div><span>페이지</span><strong id="pageCount">0</strong></div>
              </div>
            </aside>

            <section className="output-panel">
              <div className="output-controls">
                <div>
                  <p id="pageRange" className="eyebrow">page in 1~0</p>
                  <h2>Output</h2>
                </div>
                <div className="pager">
                  <label>
                    <span>rows</span>
                    <select id="pageSizeSelect" aria-label="한 페이지에 볼 개수">
                      <option value="19">19</option>
                      <option value="all">All</option>
                    </select>
                  </label>
                  <button id="prevPage" type="button" title="Previous page">‹</button>
                  <label>
                    <span>page</span>
                    <input id="pageInput" type="number" min="1" defaultValue="1" />
                  </label>
                  <button id="nextPage" type="button" title="Next page">›</button>
                </div>
              </div>
              <div className="summary-strip">
                <div><span>Start</span><strong id="startNo">-</strong></div>
                <div><span>End</span><strong id="endNo">-</strong></div>
                <div><span>Count</span><strong id="pageRows">-</strong></div>
                <div><span>B/T</span><strong id="blockTotal">00:00</strong></div>
                <div><span>Actual Inst.</span><strong id="instTotal">00:00</strong></div>
              </div>
              <div className="table-wrap">
                <LogbookTable />
              </div>
            </section>
          </section>
        </div>
      </main>

      <dialog id="configDialog" className="config-dialog" aria-labelledby="configDialogTitle">
        <form method="dialog" className="config-card">
          <div className="config-header">
            <div>
              <p className="eyebrow">Aircraft Config</p>
              <h2 id="configDialogTitle">항공기번호 → 기종 설정</h2>
            </div>
            <button id="closeConfigButton" type="button" className="icon-button" aria-label="닫기">×</button>
          </div>
          <p className="config-help">
            기본 config는 GitHub의 <a href="https://github.com/heesung6701/Flight-Time/blob/main/data/aircraft-types.json" target="_blank" rel="noopener"><code>data/aircraft-types.json</code></a>에서 자동으로 불러옵니다. 아래 입력값은 브라우저 local override로 우선 적용됩니다. 예: <code>HL8329 B73M</code>
          </p>
          <div className="config-editor">
            <textarea id="configText" className="config-text" spellCheck="false" placeholder={"HL8329\tB73M\nHL8248\tB738"}></textarea>
          </div>
          <div className="config-delta-row">
            <div id="configDeltaPreview" className="config-delta-preview" aria-label="DB 업데이트 요청 미리보기"></div>
            <button id="requestDbUpdateButton" className="text-link-button" type="button" disabled>DB 업데이트 요청</button>
          </div>
          <div className="config-footer">
            <span id="configStatus">현재 0개 등록</span>
            <div className="config-actions">
              <button id="saveConfigButton" type="button">저장 후 다시 계산</button>
            </div>
          </div>
        </form>
      </dialog>

      <dialog id="manualInputDialog" className="manual-input-dialog" aria-labelledby="manualInputDialogTitle">
        <form method="dialog" className="manual-input-card">
          <div className="config-header">
            <div>
              <p className="eyebrow">Direct Input</p>
              <h2 id="manualInputDialogTitle">직접 입력</h2>
            </div>
            <button id="closeManualInputButton" type="button" className="icon-button" aria-label="닫기">×</button>
          </div>
          <p className="manual-input-help">
            CPS 엑셀의 original 영역을 CSV 또는 탭으로 구분된 텍스트로 붙여넣으세요. 파일을 불러온 데이터가 이미 있으면 직접 입력 내용으로 대체됩니다.
          </p>
          <label className="field">
            <span>CSV 입력</span>
            <textarea id="pasteArea" placeholder="A/C No,Date,Duty,Flight No,From,To,..."></textarea>
          </label>
          <div className="manual-input-actions">
            <button id="parsePasteButton" type="button">적용</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
