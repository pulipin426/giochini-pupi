import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { serieA1x2Matches } from "./src/serieA1x2Calendar.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const adminToken = process.env.ADMIN_TOKEN || "";
const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || "";

if (!supabaseUrl || !supabaseSecretKey) {
  console.warn("Supabase non configurato: impostare SUPABASE_URL e SUPABASE_SECRET_KEY.");
}

function assertSupabaseConfigured() {
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Supabase non configurato.");
  }
}

async function supabaseRequest(path, options = {}) {
  assertSupabaseConfigured();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseSecretKey,
      Authorization: `Bearer ${supabaseSecretKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const message = data?.message || data?.hint || data?.details || data?.error || `Supabase HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function hashPin(pin, salt = randomBytes(16).toString("hex")) {
  const hash = createHash("sha256").update(`${salt}:${pin}`).digest("hex");
  return `${salt}:${hash}`;
}

function verifyPin(pin, stored) {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected) return false;
  const actual = hashPin(pin, salt).split(":")[1];
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function send(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload troppo grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON non valido"));
      }
    });
  });
}

async function getUserById(id) {
  if (!id) return null;
  const rows = await supabaseRequest(`users?id=eq.${encodeURIComponent(id)}&select=id,name,pin_hash,created_at&limit=1`);
  return rows?.[0] || null;
}

async function getUserByName(name) {
  const clean = String(name || "").trim();
  if (!clean) return null;
  const rows = await supabaseRequest(`users?name=eq.${encodeURIComponent(clean)}&select=id,name,pin_hash,created_at&limit=1`);
  return rows?.[0] || null;
}

async function getSessionUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;

  const sessions = await supabaseRequest(
    `sessions?token=eq.${encodeURIComponent(token)}&select=token,user_id,created_at&limit=1`,
  );
  const session = sessions?.[0];
  if (!session) return null;
  return getUserById(session.user_id);
}

function publicUser(user) {
  return { id: user.id, name: user.name };
}

function activeFixtures() {
  return serieA1x2Matches;
}

async function getCutoffMap() {
  const rows = await supabaseRequest("cutoffs?select=matchday,cutoff_at");
  return Object.fromEntries((rows || []).map((row) => [String(row.matchday), row.cutoff_at]));
}

async function getManualCutoff(match) {
  const rows = await supabaseRequest(
    `cutoffs?matchday=eq.${encodeURIComponent(match.matchday)}&select=cutoff_at&limit=1`,
  );
  const value = rows?.[0]?.cutoff_at;
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

async function isLocked(match) {
  const cutoff = await getManualCutoff(match);
  if (!cutoff) return false;
  return Date.now() >= cutoff;
}

async function fixtureWithResult(match) {
  const results = await supabaseRequest(
    `results?match_id=eq.${encodeURIComponent(match.id)}&select=official_result,updated_at&limit=1`,
  );
  const result = results?.[0];
  const cutoff = await getManualCutoff(match);
  return {
    ...match,
    cutoffAt: cutoff ? new Date(cutoff).toISOString() : null,
    officialResult: result?.official_result || null,
    locked: cutoff ? Date.now() >= cutoff : false,
  };
}

async function getLeaderboard() {
  const [users, predictions, results] = await Promise.all([
    supabaseRequest("users?select=id,name&order=name.asc"),
    supabaseRequest("predictions?select=user_id,match_id,pick,updated_at"),
    supabaseRequest("results?select=match_id,official_result"),
  ]);

  const resultMap = new Map((results || []).map((row) => [row.match_id, row.official_result]));
  const played = (results || []).length;

  const matchdayMap = new Map(serieA1x2Matches.map((match) => [match.id, Number(match.matchday)]));

  return (users || [])
    .map((user) => {
      const userPredictions = (predictions || []).filter((p) => p.user_id === user.id);

      let points = 0;
      let firstHalfPoints = 0;
      let secondHalfPoints = 0;

      for (const prediction of userPredictions) {
        if (resultMap.get(prediction.match_id) !== prediction.pick) continue;

        const matchday = matchdayMap.get(prediction.match_id);
        points += 1;

        if (matchday >= 1 && matchday <= 19) {
          firstHalfPoints += 1;
        } else if (matchday >= 20 && matchday <= 38) {
          secondHalfPoints += 1;
        }
      }

      return {
        userId: user.id,
        name: user.name,
        points,
        firstHalfPoints,
        secondHalfPoints,
        played,
        submitted: userPredictions.length,
      };
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}
async function requireAdmin(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!adminToken || token !== adminToken) {
    const error = new Error("Admin token non valido.");
    error.status = 403;
    throw error;
  }
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/health") {
      return send(res, 200, {
        ok: true,
        service: "serie-a-1x2",
        persistence: "supabase",
      });
    }

    if (req.method === "POST" && pathname === "/api/auth/register") {
      const { name, password, pin } = await parseBody(req);
      const cleanName = String(name || "").trim();
      const cleanPassword = String(password ?? pin ?? "").trim();

      if (cleanName.length < 2 || cleanPassword.length < 4) {
        return send(res, 400, { error: "Nome minimo 2 caratteri, password minimo 4 caratteri." });
      }

      const existing = await getUserByName(cleanName);
      if (existing) {
        return send(res, 409, { error: "Nome gia registrato. Fai login." });
      }

      const user = {
        id: randomBytes(12).toString("hex"),
        name: cleanName,
        pin_hash: hashPin(cleanPassword),
        created_at: new Date().toISOString(),
      };

      await supabaseRequest("users", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(user),
      });

      const token = randomBytes(32).toString("hex");
      await supabaseRequest("sessions", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          token,
          user_id: user.id,
          created_at: new Date().toISOString(),
        }),
      });

      return send(res, 201, { token, user: publicUser(user) });
    }

    if (req.method === "POST" && pathname === "/api/auth/login") {
      const { name, password, pin } = await parseBody(req);
      const cleanName = String(name || "").trim();
      const cleanPassword = String(password ?? pin ?? "").trim();
      const user = await getUserByName(cleanName);

      const storedPassword = user?.pin_hash;
      if (!user || !storedPassword || !verifyPin(cleanPassword, storedPassword)) {
        return send(res, 401, { error: "Nome o password non validi." });
      }

      const token = randomBytes(32).toString("hex");
      await supabaseRequest("sessions", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          token,
          user_id: user.id,
          created_at: new Date().toISOString(),
        }),
      });

      return send(res, 200, { token, user: publicUser(user) });
    }

    if (req.method === "GET" && pathname === "/api/me") {
      const user = await getSessionUser(req);
      if (!user) return send(res, 401, { error: "Non autenticato." });
      return send(res, 200, { user: publicUser(user) });
    }

    if (req.method === "GET" && pathname === "/api/fixtures") {
      const fixtures = await Promise.all(activeFixtures().map(fixtureWithResult));
      return send(res, 200, { fixtures, source: "static" });
    }

    if (req.method === "GET" && pathname === "/api/predictions") {
      const user = await getSessionUser(req);
      if (!user) return send(res, 401, { error: "Non autenticato." });

      const predictions = await supabaseRequest(
        `predictions?user_id=eq.${encodeURIComponent(user.id)}&select=match_id,pick`,
      );
      return send(res, 200, {
        predictions: Object.fromEntries((predictions || []).map((row) => [row.match_id, row.pick])),
      });
    }

    if (req.method === "PUT" && pathname.startsWith("/api/predictions/")) {
      const user = await getSessionUser(req);
      if (!user) return send(res, 401, { error: "Non autenticato." });

      const matchId = decodeURIComponent(pathname.replace("/api/predictions/", ""));
      const match = activeFixtures().find((item) => item.id === matchId);
      if (!match) return send(res, 404, { error: "Partita non trovata." });

      const { pick } = await parseBody(req);
      if (!["1", "X", "2"].includes(pick)) {
        return send(res, 400, { error: "Pronostico non valido." });
      }

      if (await isLocked(match)) {
        return send(res, 409, { error: "Cutoff superata: pronostico bloccato." });
      }

      const now = new Date().toISOString();

      await supabaseRequest("predictions", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          user_id: user.id,
          match_id: matchId,
          pick,
          updated_at: now,
        }),
      });

      await supabaseRequest("prediction_history", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          id: randomBytes(12).toString("hex"),
          user_id: user.id,
          match_id: matchId,
          pick,
          created_at: now,
        }),
      });

      return send(res, 200, { ok: true });
    }

    if (req.method === "GET" && pathname === "/api/leaderboard") {
      return send(res, 200, { leaderboard: await getLeaderboard() });
    }

    if (req.method === "GET" && pathname === "/api/admin/overview") {
      await requireAdmin(req);

      const [cutoffRows, users, fixtures, historyRows] = await Promise.all([
        supabaseRequest("cutoffs?select=matchday,cutoff_at"),
        supabaseRequest("users?select=id,name&order=name.asc"),
        Promise.all(activeFixtures().map(fixtureWithResult)),
        supabaseRequest("prediction_history?select=id,user_id,match_id,pick,created_at&order=created_at.desc"),
      ]);

      const userMap = new Map((users || []).map((u) => [u.id, u.name]));
      const fixtureMap = new Map(fixtures.map((f) => [f.id, f]));

      const history = (historyRows || []).map((item) => {
        const match = fixtureMap.get(item.match_id);
        return {
          ...item,
          createdAt: item.created_at,
          userName: userMap.get(item.user_id) || "Utente eliminato",
          match: match ? `${match.homeTeam} - ${match.awayTeam}` : item.match_id,
        };
      });

      return send(res, 200, {
        ok: true,
        cutoffs: Object.fromEntries((cutoffRows || []).map((row) => [String(row.matchday), row.cutoff_at])),
        users: users || [],
        fixtures,
        history,
      });
    }

    if (req.method === "PUT" && pathname.startsWith("/api/admin/cutoffs/")) {
      await requireAdmin(req);

      const matchday = Number(decodeURIComponent(pathname.replace("/api/admin/cutoffs/", "")));
      if (!Number.isInteger(matchday) || matchday < 1 || matchday > 38) {
        return send(res, 400, { error: "Giornata non valida." });
      }

      const { cutoffAt } = await parseBody(req);
      if (!cutoffAt) {
        await supabaseRequest(`cutoffs?matchday=eq.${matchday}`, { method: "DELETE" });
      } else {
        const parsed = new Date(cutoffAt);
        if (!Number.isFinite(parsed.getTime())) {
          return send(res, 400, { error: "Cutoff non valido." });
        }

        await supabaseRequest("cutoffs", {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({
            matchday,
            cutoff_at: parsed.toISOString(),
            updated_at: new Date().toISOString(),
          }),
        });
      }

      return send(res, 200, {
        ok: true,
        matchday,
        cutoffAt: cutoffAt ? new Date(cutoffAt).toISOString() : null,
      });
    }

    if (req.method === "PUT" && pathname.startsWith("/api/admin/results/")) {
      await requireAdmin(req);

      const matchId = decodeURIComponent(pathname.replace("/api/admin/results/", ""));
      const match = activeFixtures().find((item) => item.id === matchId);
      if (!match) return send(res, 404, { error: "Partita non trovata." });

      const { officialResult } = await parseBody(req);
      if (!["1", "X", "2"].includes(officialResult)) {
        return send(res, 400, { error: "Risultato non valido." });
      }

      await supabaseRequest("results", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          match_id: matchId,
          official_result: officialResult,
          updated_at: new Date().toISOString(),
        }),
      });

      return send(res, 200, { ok: true, leaderboard: await getLeaderboard() });
    }

    return send(res, 404, { error: "Endpoint non trovato." });
  } catch (error) {
    return send(res, error.status || 400, { error: error.message || "Richiesta non valida." });
  }
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(__dirname, "dist", safePath);
  const distRoot = join(__dirname, "dist");
  if (!filePath.startsWith(distRoot)) {
    res.writeHead(403);
    return res.end();
  }

  try {
    const file = readFileSync(filePath);
    const type = filePath.endsWith(".js")
      ? "text/javascript"
      : filePath.endsWith(".css")
        ? "text/css"
        : "text/html";
    res.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
    return res.end(file);
  } catch {
    const index = readFileSync(join(distRoot, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(index);
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    return handleApi(req, res, url.pathname);
  }
  return serveStatic(req, res, url.pathname);
});

server.listen(port, () => {
  console.log(`Serie A 1X2 server attivo sulla porta ${port}`);
});
