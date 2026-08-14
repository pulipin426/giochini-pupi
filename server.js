import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { serieA1x2Matches } from "./src/serieA1x2Calendar.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const dataDir = process.env.DATA_DIR || join(__dirname, "data");
const dbPath = join(dataDir, "serie-a-1x2.json");
const adminToken = process.env.ADMIN_TOKEN || "";
const footballDataToken = process.env.FOOTBALL_DATA_TOKEN || "";
const footballDataCompetition = process.env.FOOTBALL_DATA_COMPETITION || "SA";
const footballDataSeason = process.env.FOOTBALL_DATA_SEASON || "2026";
const footballDataSyncIntervalMs = Number(process.env.FOOTBALL_DATA_SYNC_INTERVAL_MS || 15 * 60 * 1000);

function makeInitialDb() {
  return {
    users: [],
    sessions: [],
    predictions: [],
    predictionHistory: [],
    results: [],
    cutoffs: {},
    fixtures: [],
  };
}

function readDb() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(dbPath)) writeFileSync(dbPath, JSON.stringify(makeInitialDb(), null, 2));
  return { ...makeInitialDb(), ...JSON.parse(readFileSync(dbPath, "utf8")) };
}

function writeDb(db) {
  writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function hashPin(pin, salt = randomBytes(16).toString("hex")) {
  const hash = createHash("sha256").update(`${salt}:${pin}`).digest("hex");
  return `${salt}:${hash}`;
}

function verifyPin(pin, stored) {
  const [salt, expected] = stored.split(":");
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

function getSessionUser(req, db) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const session = db.sessions.find((item) => item.token === token);
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

function publicUser(user) {
  return { id: user.id, name: user.name };
}

function activeFixtures(db) {
  // Il calendario del gioco resta quello scritto in serieA1x2Calendar.js.
  // Football-Data non sostituisce più nomi, ID o ordine delle partite.
  return serieA1x2Matches;
}

function getManualCutoff(match, db) {
  const value = db.cutoffs?.[String(match.matchday)];
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function getMatchdayCutoff(match, db) {
  return getManualCutoff(match, db);
}

function isLocked(match, db) {
  const cutoff = getMatchdayCutoff(match, db);
  if (!cutoff) return false;
  return Date.now() >= cutoff;
}

function fixtureWithResult(match, db) {
  const result = db.results.find((item) => item.matchId === match.id);
  const cutoff = getMatchdayCutoff(match, db);
  return {
    ...match,
    cutoffAt: cutoff ? new Date(cutoff).toISOString() : null,
    officialResult: result?.officialResult || null,
    locked: isLocked(match, db),
  };
}

function leaderboard(db) {
  return db.users
    .map((user) => {
      const points = db.predictions.reduce((total, prediction) => {
        if (prediction.userId !== user.id) return total;
        const result = db.results.find((item) => item.matchId === prediction.matchId);
        return total + (result?.officialResult === prediction.pick ? 1 : 0);
      }, 0);
      const played = db.results.length;
      const submitted = db.predictions.filter((prediction) => prediction.userId === user.id).length;
      return { userId: user.id, name: user.name, points, played, submitted };
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

function resultFromScore(match) {
  const home = match.score?.fullTime?.home;
  const away = match.score?.fullTime?.away;
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  if (home > away) return "1";
  if (home < away) return "2";
  return "X";
}

function normalizeFootballDataMatches(matches) {
  const grouped = new Map();
  for (const match of matches.filter((item) => item.matchday)) {
    const list = grouped.get(match.matchday) || [];
    list.push(match);
    grouped.set(match.matchday, list);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([matchday, list]) =>
      list
        .sort((left, right) => new Date(left.utcDate).getTime() - new Date(right.utcDate).getTime())
        .map((match, index) => ({
          id: `g${String(matchday).padStart(2, "0")}m${String(index + 1).padStart(2, "0")}`,
          footballDataId: match.id,
          matchday,
          date: match.utcDate.slice(0, 10),
          utcDate: match.utcDate,
          status: match.status,
          homeTeam: match.homeTeam?.shortName || match.homeTeam?.name,
          awayTeam: match.awayTeam?.shortName || match.awayTeam?.name,
          officialResult: null,
        })),
    );
}

async function syncFootballData(db) {
  if (!footballDataToken) throw new Error("FOOTBALL_DATA_TOKEN mancante.");
  const response = await fetch(
    `https://api.football-data.org/v4/competitions/${footballDataCompetition}/matches?season=${footballDataSeason}`,
    { headers: { "X-Auth-Token": footballDataToken } },
  );
  if (!response.ok) throw new Error(`football-data ha risposto ${response.status}`);
  const payload = await response.json();
  const fixtures = normalizeFootballDataMatches(payload.matches || []);
  if (!fixtures.length) throw new Error("Nessuna partita ricevuta da football-data.");

  db.fixtures = fixtures;
  for (const fixture of fixtures) {
    const source = (payload.matches || []).find((match) => match.id === fixture.footballDataId);
    const officialResult = source ? resultFromScore(source) : null;
    if (!officialResult || source.status !== "FINISHED") continue;
    const existing = db.results.find((item) => item.matchId === fixture.id);
    if (existing) {
      existing.officialResult = officialResult;
      existing.updatedAt = new Date().toISOString();
    } else {
      db.results.push({ matchId: fixture.id, officialResult, updatedAt: new Date().toISOString() });
    }
  }
  return fixtures;
}

async function handleApi(req, res, pathname) {
  const db = readDb();

  try {
    if (req.method === "GET" && pathname === "/api/health") {
      return send(res, 200, { ok: true, service: "serie-a-1x2" });
    }

    if (req.method === "POST" && pathname === "/api/auth/register") {
      const { name, password, pin } = await parseBody(req);
      const cleanName = String(name || "").trim();
      const cleanPassword = String(password ?? pin ?? "").trim();
      if (cleanName.length < 2 || cleanPassword.length < 4) {
        return send(res, 400, { error: "Nome minimo 2 caratteri, password minimo 4 caratteri." });
      }
      if (db.users.some((user) => user.name.toLowerCase() === cleanName.toLowerCase())) {
        return send(res, 409, { error: "Nome gia registrato. Fai login." });
      }

      const user = {
        id: randomBytes(12).toString("hex"),
        name: cleanName,
        passwordHash: hashPin(cleanPassword),
        createdAt: new Date().toISOString(),
      };
      const token = randomBytes(32).toString("hex");
      db.users.push(user);
      db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
      writeDb(db);
      return send(res, 201, { token, user: publicUser(user) });
    }

    if (req.method === "POST" && pathname === "/api/auth/login") {
      const { name, password, pin } = await parseBody(req);
      const cleanPassword = String(password ?? pin ?? "").trim();
      const user = db.users.find((item) => item.name.toLowerCase() === String(name || "").trim().toLowerCase());
      const storedPassword = user?.passwordHash || user?.pinHash;
      if (!user || !storedPassword || !verifyPin(cleanPassword, storedPassword)) {
        return send(res, 401, { error: "Nome o password non validi." });
      }
      const token = randomBytes(32).toString("hex");
      db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
      writeDb(db);
      return send(res, 200, { token, user: publicUser(user) });
    }

    if (req.method === "GET" && pathname === "/api/me") {
      const user = getSessionUser(req, db);
      if (!user) return send(res, 401, { error: "Non autenticato." });
      return send(res, 200, { user: publicUser(user) });
    }

    if (req.method === "GET" && pathname === "/api/fixtures") {
      return send(res, 200, {
        fixtures: activeFixtures(db).map((match) => fixtureWithResult(match, db)),
        source: "static",
      });
    }

    if (req.method === "GET" && pathname === "/api/predictions") {
      const user = getSessionUser(req, db);
      if (!user) return send(res, 401, { error: "Non autenticato." });
      const predictions = Object.fromEntries(
        db.predictions.filter((item) => item.userId === user.id).map((item) => [item.matchId, item.pick]),
      );
      return send(res, 200, { predictions });
    }

    if (req.method === "PUT" && pathname.startsWith("/api/predictions/")) {
      const user = getSessionUser(req, db);
      if (!user) return send(res, 401, { error: "Non autenticato." });

      const matchId = decodeURIComponent(pathname.replace("/api/predictions/", ""));
      const match = activeFixtures(db).find((item) => item.id === matchId);
      if (!match) return send(res, 404, { error: "Partita non trovata." });

      const { pick } = await parseBody(req);
      if (!["1", "X", "2"].includes(pick)) return send(res, 400, { error: "Pronostico non valido." });
      if (isLocked(match, db)) {
        return send(res, 409, { error: "Cutoff superata: pronostico bloccato." });
      }

      const existing = db.predictions.find((item) => item.userId === user.id && item.matchId === matchId);
      const now = new Date().toISOString();
      if (existing) {
        existing.pick = pick;
        existing.updatedAt = now;
      } else {
        db.predictions.push({ userId: user.id, matchId, pick, updatedAt: now });
      }
      db.predictionHistory.push({
        id: randomBytes(12).toString("hex"),
        userId: user.id,
        matchId,
        pick,
        createdAt: now,
      });
      writeDb(db);
      return send(res, 200, { ok: true });
    }

    if (req.method === "GET" && pathname === "/api/leaderboard") {
      return send(res, 200, { leaderboard: leaderboard(db) });
    }

    if (req.method === "PUT" && pathname.startsWith("/api/admin/results/")) {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!adminToken || token !== adminToken) return send(res, 403, { error: "Admin token non valido." });

      const matchId = decodeURIComponent(pathname.replace("/api/admin/results/", ""));
      const match = activeFixtures(db).find((item) => item.id === matchId);
      if (!match) return send(res, 404, { error: "Partita non trovata." });

      const { officialResult } = await parseBody(req);
      if (!["1", "X", "2"].includes(officialResult)) return send(res, 400, { error: "Risultato non valido." });
      const existing = db.results.find((item) => item.matchId === matchId);
      if (existing) {
        existing.officialResult = officialResult;
        existing.updatedAt = new Date().toISOString();
      } else {
        db.results.push({ matchId, officialResult, updatedAt: new Date().toISOString() });
      }
      writeDb(db);
      return send(res, 200, { ok: true, leaderboard: leaderboard(db) });
    }

    if (req.method === "GET" && pathname === "/api/admin/overview") {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!adminToken || token !== adminToken) return send(res, 403, { error: "Admin token non valido." });

      const fixtures = activeFixtures(db).map((match) => fixtureWithResult(match, db));
      const history = (db.predictionHistory || []).map((item) => {
        const user = db.users.find((candidate) => candidate.id === item.userId);
        const match = fixtures.find((candidate) => candidate.id === item.matchId);
        return {
          ...item,
          userName: user?.name || "Utente eliminato",
          match: match ? `${match.homeTeam} - ${match.awayTeam}` : item.matchId,
        };
      }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return send(res, 200, {
        ok: true,
        cutoffs: db.cutoffs || {},
        users: db.users.map(publicUser),
        fixtures,
        history,
      });
    }

    if (req.method === "PUT" && pathname.startsWith("/api/admin/cutoffs/")) {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!adminToken || token !== adminToken) return send(res, 403, { error: "Admin token non valido." });

      const matchday = Number(decodeURIComponent(pathname.replace("/api/admin/cutoffs/", "")));
      if (!Number.isInteger(matchday) || matchday < 1 || matchday > 38) {
        return send(res, 400, { error: "Giornata non valida." });
      }

      const { cutoffAt } = await parseBody(req);
      if (!cutoffAt) {
        delete db.cutoffs[matchday];
      } else {
        const parsed = new Date(cutoffAt);
        if (!Number.isFinite(parsed.getTime())) {
          return send(res, 400, { error: "Cutoff non valido." });
        }
        db.cutoffs[matchday] = parsed.toISOString();
      }
      writeDb(db);
      return send(res, 200, { ok: true, matchday, cutoffAt: db.cutoffs[matchday] || null });
    }

    if (req.method === "POST" && pathname === "/api/admin/sync-football-data") {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!adminToken || token !== adminToken) return send(res, 403, { error: "Admin token non valido." });

      const fixtures = await syncFootballData(db);
      writeDb(db);
      return send(res, 200, {
        ok: true,
        source: "football-data",
        fixtures: fixtures.length,
        results: db.results.length,
      });
    }

    return send(res, 404, { error: "Endpoint non trovato." });
  } catch (error) {
    return send(res, 400, { error: error.message || "Richiesta non valida." });
  }
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(__dirname, "dist", safePath);
  if (!filePath.startsWith(join(__dirname, "dist"))) {
    res.writeHead(403);
    return res.end();
  }
  try {
    const file = readFileSync(filePath);
    const type = filePath.endsWith(".js") ? "text/javascript" : filePath.endsWith(".css") ? "text/css" : "text/html";
    res.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
    return res.end(file);
  } catch {
    const index = readFileSync(join(__dirname, "dist", "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(index);
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) return handleApi(req, res, url.pathname);
  return serveStatic(req, res, url.pathname);
});

server.listen(port, () => {
  console.log(`Serie A 1X2 server attivo sulla porta ${port}`);
  scheduleFootballDataSync();
});

async function runFootballDataSync() {
  if (!footballDataToken) return;
  try {
    const db = readDb();
    const fixtures = await syncFootballData(db);
    writeDb(db);
    console.log(`football-data sync ok: ${fixtures.length} partite, ${db.results.length} risultati`);
  } catch (error) {
    console.error(`football-data sync fallito: ${error.message}`);
  }
}

function scheduleFootballDataSync() {
  // Disattivato: calendario, cutoff e risultati sono gestiti manualmente.
}
