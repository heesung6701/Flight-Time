export const DEFAULT_PAGE_SIZE = 19;
export const PAGE_SIZE_OPTIONS = [19];
export const ALL_PAGE_SIZE = "all";
export const DEFAULT_EXCLUDED_DUTIES = ["O", "EX", "2F"];

export function normalizePageSize(value, rowCount = DEFAULT_PAGE_SIZE) {
  if (String(value).toLowerCase() === ALL_PAGE_SIZE) {
    const count = Number(rowCount);
    return Number.isFinite(count) && count > 0 ? count : 1;
  }
  const pageSize = Number(value);
  return PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE;
}

export function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function numeric(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseDuration(value, dateParser) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") {
    return value > 0 && value < 1 ? Math.round(value * 24 * 60) : Math.round(value);
  }
  if (value instanceof Date) {
    return value.getHours() * 60 + value.getMinutes();
  }
  const text = clean(value);
  if (!text) return 0;
  if (dateParser && typeof value === "number") {
    const parsed = dateParser(value);
    if (parsed) return parsed.hours * 60 + parsed.minutes;
  }
  const match = text.match(/^(-?\d+):(\d{1,2})$/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatDuration(minutes) {
  if (!minutes) return "";
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minutes));
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function displayCount(value) {
  if (value === "" || value === null || value === undefined) return "";
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : clean(value);
}

export function displayTakeoffCount(value) {
  if (Number(value) === 0) return "";
  return displayCount(value);
}

export function parseDate(value, xlsxDateParser) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && xlsxDateParser) {
    const parsed = xlsxDateParser(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  return clean(value);
}

export function parseTsv(text) {
  return clean(text)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split("\t"));
}

export function isSummaryRow(rawRow) {
  return rawRow.some((value) => clean(value).includes("계"));
}

export function parseAircraftTypeMap(configRows = []) {
  return Object.fromEntries(
    configRows
      .slice(1)
      .map((row) => [clean(row[0]), clean(row[1])])
      .filter(([aircraft, type]) => aircraft && type),
  );
}

export function parseAircraftConfigText(text) {
  return Object.fromEntries(
    clean(text)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split(/[\t, ]+/).map(clean))
      .filter(([aircraft, type]) => aircraft && type)
      .map(([aircraft, type]) => [aircraft, type]),
  );
}

export function serializeAircraftTypeMap(aircraftTypes = {}) {
  return Object.entries(aircraftTypes)
    .filter(([aircraft, type]) => clean(aircraft) && clean(type))
    .sort(([left], [right]) => clean(left).localeCompare(clean(right)))
    .map(([aircraft, type]) => `${clean(aircraft)}\t${clean(type)}`)
    .join("\n");
}

export function parseOriginalRows(rows, options = {}) {
  const firstCell = clean(rows[0]?.[0]).toLowerCase();
  const startRow = firstCell === "a/c no" ? 2 : 0;
  const aircraftTypes = options.aircraftTypes || {};
  return rows
    .slice(startRow)
    .filter((row) => !isSummaryRow(row))
    .map((row, index) => ({
      sourceIndex: startRow + index + 1,
      aircraft: clean(row[0]),
      date: parseDate(row[1], options.xlsxDateParser),
      duty: clean(row[2]),
      flightNo: clean(row[3]),
      from: clean(row[4]),
      to: clean(row[5]),
      type: aircraftTypes[clean(row[0])] || clean(row[6]) || "",
      ro: clean(row[7]),
      ri: clean(row[8]),
      blockTime: parseDuration(row[9]),
      takeoffTime: clean(row[10]),
      landingTime: clean(row[11]),
      airTime: parseDuration(row[12]),
      inst: parseDuration(row[13]),
      night: parseDuration(row[14]),
      takeoff: numeric(row[15]),
      landing: numeric(row[16]),
    }))
    .filter((row) => row.aircraft && row.date && row.flightNo);
}

export function specialFlightNo(flightNo) {
  const text = clean(flightNo);
  if (!/^\d+$/.test(text)) return false;
  const first = text[0];
  return (first === "0" || first === "1") && Number(text) % 2 === 0;
}

export function parseClockMinutes(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return value.getHours() * 60 + value.getMinutes();
  }
  const text = clean(value);
  const match = text.match(/(?:^|T)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?(?:$|[+-]\d{2}:?\d{2}|Z)/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[4]?.toUpperCase();
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "AM") hours = hours === 12 ? 0 : hours;
    if (meridiem === "PM") hours = hours === 12 ? 12 : hours + 12;
  }
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function isClockNight(clockTime, sunTimes) {
  const clock = parseClockMinutes(clockTime);
  const sunrise = parseClockMinutes(sunTimes?.sunrise);
  const sunset = parseClockMinutes(sunTimes?.sunset);
  if (clock === null || sunrise === null || sunset === null) return null;
  return clock < sunrise || clock >= sunset;
}

export function addDays(dateText, days) {
  const match = clean(dateText).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return clean(dateText);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

export function inferArrivalDate(departureDate, ro, ri) {
  const roMinutes = parseClockMinutes(ro);
  const riMinutes = parseClockMinutes(ri);
  if (roMinutes === null || riMinutes === null) return clean(departureDate);
  return riMinutes < roMinutes ? addDays(departureDate, 1) : clean(departureDate);
}

export function airportSunKey(iata, date) {
  return `${clean(iata).toUpperCase()}|${clean(date)}`;
}

export function getSunTimes(sunTimesByAirportDate, iata, date) {
  const key = airportSunKey(iata, date);
  if (sunTimesByAirportDate instanceof Map) return sunTimesByAirportDate.get(key) || null;
  return sunTimesByAirportDate?.[key] || null;
}

export function classifyTakeoffLandingBySun(row, sunTimesByAirportDate) {
  const takeoffTime = row.ro;
  const landingTime = row.ri;
  const departureDate = clean(row.date);
  const arrivalDate = inferArrivalDate(departureDate, row.ro, row.ri);
  const departureSunTimes = getSunTimes(sunTimesByAirportDate, row.from, departureDate);
  const arrivalSunTimes = getSunTimes(sunTimesByAirportDate, row.to, arrivalDate);
  const takeoffNight = isClockNight(takeoffTime, departureSunTimes);
  const landingNight = isClockNight(landingTime, arrivalSunTimes);

  if (takeoffNight === null || landingNight === null) return null;

  return {
    dayTakeoff: takeoffNight ? "" : row.takeoff,
    dayLanding: landingNight ? "" : row.landing,
    nightTakeoff: takeoffNight ? row.takeoff : "",
    nightLanding: landingNight ? row.landing : "",
  };
}

export function classifyNightDay(row) {
  const hasNight = row.night > 0;
  const nightEqualsBlock = hasNight && row.night === row.blockTime;
  const isSpecial = specialFlightNo(row.flightNo);

  if (!hasNight) {
    return {
      dayTakeoff: row.takeoff,
      dayLanding: row.landing,
      nightTakeoff: "",
      nightLanding: "",
    };
  }

  if (nightEqualsBlock) {
    return {
      dayTakeoff: "",
      dayLanding: "",
      nightTakeoff: row.takeoff,
      nightLanding: row.landing,
    };
  }

  if (isSpecial) {
    return {
      dayTakeoff: "",
      dayLanding: row.landing,
      nightTakeoff: row.takeoff,
      nightLanding: "",
    };
  }

  return {
    dayTakeoff: row.takeoff,
    dayLanding: "",
    nightTakeoff: "",
    nightLanding: row.landing,
  };
}

export function filterRows(originalRows, excludedDuties = DEFAULT_EXCLUDED_DUTIES) {
  const excluded = new Set(excludedDuties.map((duty) => duty.toUpperCase()));
  return originalRows.filter((row) => !excluded.has(row.duty.toUpperCase()));
}

export function calculateFoTime(row) {
  const duty = row.duty.toUpperCase();
  if (duty === "F") return row.blockTime || "";
  if (duty === "NF") return row.blockTime ? Math.round(row.blockTime * (2 / 3)) : "";
  return "";
}

export function modifyRows(originalRows, options = {}) {
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const excludedDuties = options.excludedDuties || DEFAULT_EXCLUDED_DUTIES;
  const rows = filterRows(originalRows, excludedDuties);

  return rows.map((row, index) => {
    const id = index + 1;
    const conditionDay = Math.max(row.blockTime - row.night, 0);
    const sunClassification = classifyTakeoffLandingBySun(row, options.sunTimesByAirportDate);
    const classification = sunClassification || classifyNightDay(row);
    return {
      id,
      page: Math.floor(index / pageSize) + 1,
      date: row.date,
      aircraftType: row.type,
      aircraftIdent: row.aircraft,
      from: row.from,
      to: row.to,
      flightNo: row.flightNo,
      ...classification,
      autoLand: "",
      dayCondition: conditionDay || "",
      nightCondition: row.night || "",
      actualInst: row.inst || "",
      instApp: "",
      blockTime: row.blockTime || "",
      pic: "",
      fo: calculateFoTime(row),
      otherPilot: "",
      simulator: "",
      flightInstructor: "",
      simulatorInstructor: "",
      remark: "",
    };
  });
}

export function sumRows(rows, key) {
  return rows.reduce((total, row) => total + numeric(row[key]), 0);
}

export function sumMinutes(rows, key) {
  return rows.reduce((total, row) => total + numeric(row[key]), 0);
}

export function buildSummary(rows) {
  return {
    dayTakeoff: sumRows(rows, "dayTakeoff"),
    dayLanding: sumRows(rows, "dayLanding"),
    nightTakeoff: sumRows(rows, "nightTakeoff"),
    nightLanding: sumRows(rows, "nightLanding"),
    dayCondition: sumMinutes(rows, "dayCondition"),
    nightCondition: sumMinutes(rows, "nightCondition"),
    actualInst: sumMinutes(rows, "actualInst"),
    blockTime: sumMinutes(rows, "blockTime"),
    fo: sumMinutes(rows, "fo"),
  };
}

export function buildOutputPage(modifiedRows, page, pageSize = DEFAULT_PAGE_SIZE) {
  const maxPage = Math.max(Math.ceil(modifiedRows.length / pageSize), 1);
  const valid = page >= 1 && page <= maxPage && modifiedRows.length > 0;
  const currentPage = valid ? page : 1;
  const startIndex = (currentPage - 1) * pageSize;
  const rows = valid ? modifiedRows.slice(startIndex, startIndex + pageSize) : [];
  const previousRows = valid ? modifiedRows.slice(0, startIndex) : [];
  const allRows = [...previousRows, ...rows];

  return {
    valid,
    page: currentPage,
    maxPage: modifiedRows.length ? maxPage : 0,
    start: rows.length ? rows[0].id : null,
    end: rows.length ? rows[rows.length - 1].id : null,
    count: rows.length,
    rows,
    pageTotal: buildSummary(rows),
    previousTotal: buildSummary(previousRows),
    newTotal: buildSummary(allRows),
  };
}

export function buildValidationReport(originalRows, options = {}) {
  const excludedDuties = options.excludedDuties || DEFAULT_EXCLUDED_DUTIES;
  const dutyCounts = {};
  for (const row of originalRows) {
    dutyCounts[row.duty || "(blank)"] = (dutyCounts[row.duty || "(blank)"] || 0) + 1;
  }
  const filteredRows = filterRows(originalRows, excludedDuties);
  return {
    originalCount: originalRows.length,
    filteredCount: filteredRows.length,
    excludedCount: originalRows.length - filteredRows.length,
    dutyCounts,
    pageCount: Math.ceil(filteredRows.length / (options.pageSize || DEFAULT_PAGE_SIZE)),
  };
}
