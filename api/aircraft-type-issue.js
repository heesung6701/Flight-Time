const GITHUB_API_URL = "https://api.github.com/repos/heesung6701/Flight-Time/issues";
const ISSUE_LABEL = "aircraft-type-map";
const MAX_ROWS = 50;
const MAX_REQUESTS_PER_HOUR = 5;
const rateLimitByIp = new Map();

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function clientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const record = rateLimitByIp.get(ip) || { count: 0, resetAt: now + windowMs };
  if (record.resetAt <= now) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }
  record.count += 1;
  rateLimitByIp.set(ip, record);
  return record.count <= MAX_REQUESTS_PER_HOUR;
}

function clean(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeRows(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > MAX_ROWS) {
    throw new Error(`항공기 타입 변경사항은 1-${MAX_ROWS}개만 보낼 수 있습니다.`);
  }

  return rows.map((row) => {
    const registration = clean(row?.registration);
    const aircraftType = clean(row?.aircraftType);
    if (!/^[A-Z0-9-]{3,12}$/.test(registration)) {
      throw new Error(`항공기번호 형식이 올바르지 않습니다: ${registration || "(empty)"}`);
    }
    if (!/^[A-Z0-9-]{2,12}$/.test(aircraftType)) {
      throw new Error(`기종 형식이 올바르지 않습니다: ${aircraftType || "(empty)"}`);
    }
    return { registration, aircraftType };
  });
}

function buildIssueBody(rows) {
  return [
    "### Change type",
    "",
    "Add or update registrations",
    "",
    "### Aircraft type map",
    "",
    "```tsv",
    rows.map(({ registration, aircraftType }) => `${registration}\t${aircraftType}`).join("\n"),
    "```",
    "",
    "_Submitted anonymously from the Flight Time config popup._",
  ].join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (req.body?.website) {
    return sendJson(res, 204, { ok: true });
  }

  const token = process.env.GITHUB_ISSUE_TOKEN;
  if (!token) {
    return sendJson(res, 501, { error: "GitHub issue token is not configured" });
  }

  if (!checkRateLimit(clientIp(req))) {
    return sendJson(res, 429, { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." });
  }

  let rows;
  try {
    rows = normalizeRows(req.body?.rows);
  } catch (error) {
    return sendJson(res, 400, { error: error.message });
  }

  const response = await fetch(GITHUB_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "flight-time-logbook",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title: "[aircraft-type-map] anonymous config sync",
      labels: [ISSUE_LABEL],
      body: buildIssueBody(rows),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return sendJson(res, response.status, { error: payload.message || "GitHub issue creation failed" });
  }

  return sendJson(res, 201, {
    ok: true,
    number: payload.number,
    url: payload.html_url,
  });
}
