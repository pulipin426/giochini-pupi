import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  CalendarDays,
  CircleDot,
  ExternalLink,
  History,
  Lock,
  RotateCcw,
  Save,
  Trophy,
} from "lucide-react";
import { serieA1x2Matches } from "./serieA1x2Calendar";
import "./styles.css";

const games = [
  {
    id: "seriea-prono",
    title: "SerieA Prono",
    status: "in-corso",
    category: "Serie A",
    season: "Live",
    format: "Pronostici stagionali",
    cost: "25 / 100 crediti",
    url: "https://prono-serie-a.vercel.app/",
    summary: "Il gioco principale, con pronostici e classifiche dedicate alla Serie A.",
    image:
      "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=80",
    featured: true,
  },
  {
    id: "champions-gironi",
    title: "Champions Gironi",
    status: "terminato",
    category: "Champions League",
    season: "2025-26",
    format: "Fase a gironi",
    cost: "25 crediti",
    podium: [
      { position: 1, name: "Alemet", detail: "556 pt" },
      { position: 2, name: "Bonzone", detail: "546 pt" },
      { position: 3, name: "Magicbox", detail: "537 pt" },
    ],
    url: "https://pulipin426.github.io/champions-gironi/",
    summary: "Pronostici e tabella per la fase a gironi della Champions League.",
    image:
      "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "serie-a-1x2",
    title: "Serie A 1X2",
    status: "in-corso",
    category: "Serie A",
    season: "2026-27",
    format: "Pronostici 1X2",
    cost: "25 crediti",
    appView: "serie-a-1x2",
    url: "https://docs.google.com/spreadsheets/d/1SDSjOJNf0frnFXL1X3lSjdmdM3PsunnVW1ptB6TOiT4/edit?gid=627905503#gid=627905503",
    summary:
      "La nuova versione del gioco 1X2, preparata con il calendario Serie A 2026-27 dalla 1 alla 38.",
    image:
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "serie-a-febbraio",
    title: "Serie A da febbraio",
    status: "terminato",
    category: "Serie A",
    season: "2025-26",
    format: "Sprint finale",
    cost: "25 crediti",
    podium: [
      { position: 1, name: "Thekingteam", detail: "106 pt" },
      { position: 2, name: "MagicboxV", detail: "97 pt" },
      { position: 3, name: "Mazzoleni", detail: "96 pt" },
    ],
    url: "https://pulipin426.github.io/Serie-A-25-26-da-febbraio-in-poi-/",
    summary: "Versione compatta sulla seconda parte del campionato, da febbraio in poi.",
    image:
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "road-to-final-ucl",
    title: "Road to Final UCL",
    status: "terminato",
    category: "Champions League",
    season: "2025-26",
    format: "Percorso finale",
    cost: "25 crediti",
    podium: [
      { position: 1, name: "Kapakkione", detail: "214 pt" },
      { position: 2, name: "Atleticotto", detail: "205 pt" },
      { position: 3, name: "Ciccio89", detail: "197 pt" },
    ],
    url: "https://pulipin426.github.io/Road-to-final-UCL-26/",
    summary: "Il percorso verso la finale di Champions, pensato come gioco a tappe.",
    image:
      "https://images.unsplash.com/photo-1577223625816-7546f13df25d?auto=format&fit=crop&w=1200&q=80",
  },
 {
  id: "pupi-world-cup-2026",
  title: "Pupi World Cup 2026",
  status: "terminato",
  category: "Mondiale",
  season: "2026",
  format: "Torneo",
  cost: "25 crediti",
  podium: [
    { position: 1, name: "ChallengerGX", detail: "Winner" },
    { position: 2, name: "AtleticottoB", detail: "2° posto" },
    { position: 3, name: "Magicbox", detail: "3° posto" },
  ],
  url: "https://pulipin426.github.io/pupi-world-cup-2026/",
  summary: "Edizione 2026 conclusa. Vittoria finale di ChallengerGX.",
  image:
    "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80",
},
  {
    id: "mondiale-ottavi",
    title: "Mondiale dagli ottavi",
    status: "terminato",
    category: "Mondiale",
    season: "2025",
    format: "Eliminazione diretta",
    cost: "25 crediti",
    podium: [
      { position: 1, name: "Jake", detail: "56 pt" },
      { position: 2, name: "Bonzone", detail: "42 pt" },
      { position: 3, name: "Pupi", detail: "40 pt" },
    ],
    podiumNote: "Ottavi",
    extraPodiums: [
      {
        label: "Antepost",
        entries: [
          { position: 1, name: "Pupi", detail: "145 pt" },
          { position: 1, name: "AtleticottoB", detail: "145 pt" },
          { position: 3, name: "Greg", detail: "135 pt" },
        ],
      },
    ],
    url: "https://pulipin426.github.io/mondiale2025ottavi/",
    summary: "Archivio della versione dagli ottavi in poi: consultabile per memoria e risultati.",
    image:
      "https://images.unsplash.com/photo-1510051640316-cee39563ddab?auto=format&fit=crop&w=1200&q=80",
  },
];

const filters = [
  { id: "tutti", label: "Tutti" },
  { id: "in-corso", label: "In corso" },
  { id: "terminato", label: "Terminati" },
];

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("serieA1x2Token");
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Errore di rete");
  return payload;
}

function App() {
  const [activeView, setActiveView] = useState(() =>
    window.location.pathname === "/serie-a-1x2" ? "serie-a-1x2" : "hub",
  );
  const [activeFilter, setActiveFilter] = useState("tutti");
  const [selectedId, setSelectedId] = useState("seriea-prono");

  const filteredGames = useMemo(() => {
    if (activeFilter === "tutti") return games;
    return games.filter((game) => game.status === activeFilter);
  }, [activeFilter]);

  useEffect(() => {
    if (filteredGames.length && !filteredGames.some((game) => game.id === selectedId)) {
      setSelectedId(filteredGames[0].id);
    }
  }, [filteredGames, selectedId]);

  const selectedGame = games.find((game) => game.id === selectedId) ?? games[0];
  const liveGames = games.filter((game) => game.status === "in-corso").length;
  const archivedGames = games.filter((game) => game.status === "terminato").length;

  if (activeView === "serie-a-1x2") {
    return (
      <SerieA1X2App
        onBack={() => {
          window.history.pushState({}, "", "/");
          setActiveView("hub");
        }}
      />
    );
  }

  return (
    <main className="app-shell">
      <section className="hero" aria-label="Giochini del Pupi">
        <div className="hero-media" aria-hidden="true">
          <img src={selectedGame.image} alt="" />
        </div>
        <div className="hero-content">
          <p className="eyebrow">Giochini del Pupi</p>
          <h1>Hub dei giochi in corso e degli archivi storici.</h1>
          <p className="hero-copy">
            Una sola pagina per raggiungere SerieA Prono, Champions, Mondiale e le versioni
            archiviate senza cercare link sparsi.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href={selectedGame.url} target="_blank" rel="noreferrer">
              Apri {selectedGame.title}
              <ArrowUpRight size={18} />
            </a>
            <a className="secondary-link" href="#catalogo">
              Vedi catalogo
            </a>
          </div>
        </div>
        <div className="hero-stats" aria-label="Riepilogo giochi">
          <Stat icon={<Trophy size={18} />} value={games.length} label="giochi" />
          <Stat icon={<CircleDot size={18} />} value={liveGames} label="in corso" />
          <Stat icon={<History size={18} />} value={archivedGames} label="terminati" />
        </div>
      </section>

      <section className="hub" id="catalogo">
        <div className="section-head">
          <div>
            <p className="eyebrow">Catalogo</p>
            <h2>Seleziona un gioco</h2>
          </div>
          <div className="filters" role="tablist" aria-label="Filtra giochi">
            {filters.map((filter) => (
              <button
                key={filter.id}
                className={activeFilter === filter.id ? "active" : ""}
                onClick={() => setActiveFilter(filter.id)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="layout">
          <div className="game-grid">
            {filteredGames.map((game) => (
              <button
                className={`game-card ${selectedGame.id === game.id ? "selected" : ""}`}
                key={game.id}
                onClick={() => setSelectedId(game.id)}
                type="button"
              >
                <span className="card-image">
                  <img src={game.image} alt="" />
                  <span className={`status ${game.status}`}>{statusLabel(game.status)}</span>
                </span>
                <span className="card-body">
                  <span className="card-title">{game.title}</span>
                  <span className="card-summary">{game.summary}</span>
                  <span className="card-meta">
                    <span>{game.category}</span>
                    <span>{game.season}</span>
                    <span>{game.cost}</span>
                  </span>
                  {game.podium && <WinnerStrip podium={game.podium} />}
                </span>
              </button>
            ))}
          </div>

          <aside className="detail" aria-label={`Dettaglio ${selectedGame.title}`}>
            <img className="detail-image" src={selectedGame.image} alt="" />
            <div className="detail-body">
              <span className={`status ${selectedGame.status}`}>
                {statusLabel(selectedGame.status)}
              </span>
              <h3>{selectedGame.title}</h3>
              <p>{selectedGame.summary}</p>

              <div className="facts">
                <Fact icon={<CalendarDays size={18} />} label="Stagione" value={selectedGame.season} />
                <Fact icon={<Trophy size={18} />} label="Formato" value={selectedGame.format} />
                <Fact icon={<CircleDot size={18} />} label="Costo" value={selectedGame.cost} />
              </div>

              {selectedGame.podium && (
                <section className="podium-panel" aria-label={`Podio ${selectedGame.title}`}>
                  <div className="podium-title">
                    <span>Winner</span>
                    {selectedGame.podiumNote && <small>{selectedGame.podiumNote}</small>}
                  </div>
                  <ol className="podium-list">
                    {selectedGame.podium.map((entry) => (
                      <li key={entry.position}>
                        <span className={`rank rank-${entry.position}`}>{entry.position}</span>
                        <strong>{entry.name}</strong>
                        <small>{entry.detail}</small>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {selectedGame.extraPodiums?.map((podium) => (
                <section
                  className="podium-panel podium-panel-secondary"
                  aria-label={`${podium.label} ${selectedGame.title}`}
                  key={podium.label}
                >
                  <div className="podium-title">
                    <span>Winner</span>
                    <small>{podium.label}</small>
                  </div>
                  <ol className="podium-list">
                    {podium.entries.map((entry) => (
                      <li key={`${podium.label}-${entry.position}`}>
                        <span className={`rank rank-${entry.position}`}>{entry.position}</span>
                        <strong>{entry.name}</strong>
                        <small>{entry.detail}</small>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}

              {selectedGame.appView === "serie-a-1x2" && (
                <button
                  className="open-game internal-action"
                  onClick={() => {
                    window.history.pushState({}, "", "/serie-a-1x2");
                    setActiveView("serie-a-1x2");
                  }}
                  type="button"
                >
                  Apri app 1X2
                  <ArrowUpRight size={18} />
                </button>
              )}

              <a className="open-game" href={selectedGame.url} target="_blank" rel="noreferrer">
                {selectedGame.appView === "serie-a-1x2" ? "Apri archivio" : "Apri gioco"}
                <ExternalLink size={18} />
              </a>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function SerieA1X2App({ onBack }) {
  const matchdays = [...new Set(serieA1x2Matches.map((match) => match.matchday))];
  const [selectedMatchday, setSelectedMatchday] = useState(matchdays[0]);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("serieA1x2Player") || "Mio utente");
  const [pin, setPin] = useState("");
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("serieA1x2AdminToken") || "");
  const [adminData, setAdminData] = useState(null);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("register");
  const [serverAvailable, setServerAvailable] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [fixtures, setFixtures] = useState(serieA1x2Matches);
  const [fixtureSource, setFixtureSource] = useState("static");
  const [leaderboard, setLeaderboard] = useState([]);
  const [predictions, setPredictions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("serieA1x2Predictions") || "{}");
    } catch {
      return {};
    }
  });
const currentMatches = fixtures.filter(
  (match) => match.matchday === selectedMatchday
);

const displayName = user?.name || playerName;

const ranking = leaderboard.length
  ? leaderboard
  : buildSerieA1x2Ranking(predictions, displayName, fixtures);

const savedCount = Object.values(predictions).filter(Boolean).length;
const maxScore = fixtures.length;

  useEffect(() => {
    let ignore = false;

    async function boot() {
      try {
        const fixturesPayload = await apiRequest("/api/fixtures");
        const leaderboardPayload = await apiRequest("/api/leaderboard");
        if (ignore) return;
        setFixtures(fixturesPayload.fixtures);
        setFixtureSource(fixturesPayload.source);
        setLeaderboard(leaderboardPayload.leaderboard);
        setServerAvailable(true);

        const token = localStorage.getItem("serieA1x2Token");
        if (token) {
          const mePayload = await apiRequest("/api/me");
          const predictionPayload = await apiRequest("/api/predictions");
          if (ignore) return;
          setUser(mePayload.user);
          setPlayerName(mePayload.user.name);
          setPredictions(predictionPayload.predictions);
        }
      } catch {
        if (!ignore) {
          setServerAvailable(false);
          setStatusMessage("Modalita locale: avvia il server per login, privacy e classifica reale.");
        }
      }
    }

    boot();
    return () => {
      ignore = true;
    };
  }, []);

  const setPick = async (matchId, pick) => {
    const match = fixtures.find((item) => item.id === matchId);
    if (match?.locked) {
      setStatusMessage("Cutoff superata: questa partita e bloccata.");
      return;
    }

    setPredictions((current) => ({ ...current, [matchId]: pick }));
    localStorage.setItem("serieA1x2Predictions", JSON.stringify({ ...predictions, [matchId]: pick }));

    if (!serverAvailable || !user) {
      setStatusMessage(`✓ Pronostico salvato solo in questo dispositivo: ${match.homeTeam} - ${match.awayTeam} → ${pick}`);
      return;
    }

    try {
      await apiRequest(`/api/predictions/${matchId}`, {
        method: "PUT",
        body: JSON.stringify({ pick }),
      });
      const leaderboardPayload = await apiRequest("/api/leaderboard");
      setLeaderboard(leaderboardPayload.leaderboard);
      setStatusMessage(`✓ Pronostico salvato sul server: ${match.homeTeam} - ${match.awayTeam} → ${pick}`);
    } catch (error) {
      setStatusMessage(error.message);
    }
  };

  const authenticate = async (mode) => {
    try {
      const payload = await apiRequest(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ name: playerName, password: pin }),
      });
      localStorage.setItem("serieA1x2Token", payload.token);
      localStorage.setItem("serieA1x2Player", payload.user.name);
      setUser(payload.user);
      setAuthMode("register");
      setPin("");
      setStatusMessage(mode === "register" ? `✓ Iscrizione completata. Sei connesso come ${payload.user.name}.` : `✓ Login effettuato. Bentornato, ${payload.user.name}.`);
      const predictionPayload = await apiRequest("/api/predictions");
      setPredictions(predictionPayload.predictions);
    } catch (error) {
      setStatusMessage(error.message);
    }
  };

const logout = () => {
  localStorage.removeItem("serieA1x2Token");
  localStorage.removeItem("serieA1x2Player");
  setUser(null);
  setPredictions({});
  setStatusMessage("Logout effettuato.");
  };

  const save = () => {
    localStorage.setItem("serieA1x2Player", playerName.trim() || "Mio utente");
    localStorage.setItem("serieA1x2Predictions", JSON.stringify(predictions));
    setStatusMessage("Dati salvati in locale.");
  };

  const reset = () => {
  localStorage.removeItem("serieA1x2Predictions");
  setPredictions({});
  setStatusMessage("Pronostici resettati.");
};

  const adminRequest = async (path, options = {}) => {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Errore admin");
    return payload;
  };

  const loadAdmin = async () => {
    try {
      const payload = await adminRequest("/api/admin/overview");
      localStorage.setItem("serieA1x2AdminToken", adminToken);
      setAdminData(payload);
      setStatusMessage("✓ Accesso super admin attivo.");
    } catch (error) {
      setAdminData(null);
      setStatusMessage(error.message);
    }
  };

  const saveCutoff = async (matchday, value) => {
    try {
      await adminRequest(`/api/admin/cutoffs/${matchday}`, {
        method: "PUT",
        body: JSON.stringify({ cutoffAt: value ? new Date(value).toISOString() : null }),
      });
      await loadAdmin();
      const fixturesPayload = await apiRequest("/api/fixtures");
      setFixtures(fixturesPayload.fixtures);
      setStatusMessage(`✓ Cutoff G${matchday} salvato.`);
    } catch (error) {
      setStatusMessage(error.message);
    }
  };

  const saveResult = async (matchId, officialResult) => {
    try {
      await adminRequest(`/api/admin/results/${matchId}`, {
        method: "PUT",
        body: JSON.stringify({ officialResult }),
      });
      await loadAdmin();
      const fixturesPayload = await apiRequest("/api/fixtures");
      const leaderboardPayload = await apiRequest("/api/leaderboard");
      setFixtures(fixturesPayload.fixtures);
      setLeaderboard(leaderboardPayload.leaderboard);
      setStatusMessage("✓ Risultato salvato.");
    } catch (error) {
      setStatusMessage(error.message);
    }
  };

  return (
    <main className="one-x-two">
      <header className="app-top">
        <button className="back-button" onClick={onBack} type="button">
          Torna all'hub
        </button>
        <div>
          <p className="eyebrow">Serie A 1X2</p>
          <h1>Pronostici nascosti, risultati automatici, ranking pulito.</h1>
          <p>
            MVP production-ready basato sul calendario Serie A 2026-27. Login leggero, pronostici privati,
            classifica pubblica senza mostrare le giocate degli altri.
          </p>
        </div>
      </header>

      <section className="one-x-two-grid">
        <aside className="game-control">
        {user && (
  <div className="status-note">
    👤 Connesso come <strong>{user.name}</strong>
  </div>
)}
          <label>
            Nome giocatore
            <input disabled={Boolean(user)} value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
          </label>

          <label>
            Password
            <input
              disabled={Boolean(user) || !serverAvailable}
              minLength={4}
              onChange={(event) => setPin(event.target.value)}
              placeholder="minimo 4 caratteri"
              type="password"
              value={pin}
            />
          </label>

          {!user && statusMessage && (
            <div className="status-note auth-error" role="alert">
              {statusMessage}
            </div>
          )}

          {user ? (
            <div className="auth-box logged-in">
              <div className="status-note">
                🟢 <strong>Connesso come {user.name}</strong>
              </div>
              <p className="auth-help">I tuoi pronostici sono privati e vengono salvati sul server.</p>
              <button className="reset-action" onClick={logout} type="button">
                Logout
              </button>
            </div>
          ) : (
            <div className="auth-box">
              <strong>{authMode === "register" ? "Prima volta? Iscriviti" : "Hai già un account? Accedi"}</strong>
              <p className="auth-help">
                {authMode === "register"
                  ? "Crea il tuo account per salvare i pronostici e partecipare alla classifica."
                  : "Inserisci nome e Password per recuperare i tuoi pronostici."}
              </p>
              <div className="app-actions auth-actions">
                <button
                  className="save-action"
                  disabled={!serverAvailable}
                  onClick={() => authenticate(authMode)}
                  type="button"
                >
                  {authMode === "register" ? "ISCRIVITI" : "LOGIN"}
                </button>
                <button
                  className="reset-action"
                  disabled={!serverAvailable}
                  onClick={() => setAuthMode(authMode === "register" ? "login" : "register")}
                  type="button"
                >
                  {authMode === "register" ? "Ho già un account → Login" : "Sono nuovo → Iscriviti"}
                </button>
              </div>
            </div>
          )}

          <div className="matchday-tabs" aria-label="Seleziona giornata">
            {matchdays.map((matchday) => (
              <button
                className={selectedMatchday === matchday ? "active" : ""}
                key={matchday}
                onClick={() => setSelectedMatchday(matchday)}
                type="button"
              >
                G{matchday}
              </button>
            ))}
          </div>

          <div className="privacy-note">
            <Lock size={18} />
            {user
              ? `I tuoi segni sono privati. Sei connesso come ${user.name}.`
              : "Prima iscriviti o fai login: così i pronostici vengono salvati sul server e restano privati."}{" "}
            Cutoff: impostato manualmente dall'amministratore.
          </div>

          {statusMessage && user && <div className="status-note">{statusMessage}</div>}

          <div className="app-actions">
            <button className="save-action" onClick={save} type="button">
              <Save size={17} />
              Salva locale
            </button>
            <button className="reset-action" onClick={reset} type="button">
              <RotateCcw size={17} />
              Reset
            </button>
          </div>

          <div className="mini-stats">
            <Stat icon={<CircleDot size={18} />} value={savedCount} label="pronostici" />
            <Stat icon={<Trophy size={18} />} value={maxScore} label="partite" />
          </div>

          <div className="status-note">Calendario: statico · cutoff manuale</div>
        </aside>

        <section className="match-panel">
          <div className="match-panel-head">
            <div>
              <p className="eyebrow">Giornata {selectedMatchday}</p>
              <h2>Schedina 1X2</h2>
              <p className="cutoff-banner">🔒 Pronostici aperti fino al cutoff della giornata</p>
            </div>
            <span>{currentMatches.length} partite</span>
          </div>

          <div className="match-list">
            {currentMatches.map((match) => (
              <article className="match-row" key={match.id}>
                <div>
                  <strong>
                    {match.homeTeam} - {match.awayTeam}
                  </strong>
                  <span>
                    Cutoff giornata: {formatCutoff(match)} - {match.locked ? "Bloccata" : "Aperta"}
                  </span>
                  <span>
                    {new Date(match.date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })} ·
                    Risultato ufficiale: {match.officialResult || "Da giocare"}
                  </span>
                </div>
                <div className="pick-buttons">
                  {["1", "X", "2"].map((pick) => (
                    <button
                      className={predictions[match.id] === pick ? "active" : ""}
                      disabled={match.locked}
                      key={pick}
                      onClick={() => setPick(match.id, pick)}
                      type="button"
                    >
                      {pick}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="ranking-panel">
          <div className="match-panel-head compact">
            <div>
              <p className="eyebrow">Ranking</p>
              <h2>Classifica MVP</h2>
            </div>
          </div>
          <ol className="ranking-list">
            {ranking.map((row, index) => (
              <li key={row.name}>
                <span>{index + 1}</span>
                <strong>{row.name}</strong>
                <small>
                  {row.points} pt · {row.submitted ?? savedCount} pron.
                </small>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="admin-panel">
        <div className="match-panel-head">
          <div>
            <p className="eyebrow">Super Admin</p>
            <h2>Gestione risultati e cutoff</h2>
          </div>
          <span>{adminData ? "🟢 autorizzato" : "protetto"}</span>
        </div>

        {!adminData ? (
          <div className="admin-login">
            <p>Solo il titolare del gioco deve inserire il token ADMIN_TOKEN di Render.</p>
            <input
              type="password"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              placeholder="ADMIN_TOKEN"
            />
            <button className="save-action" onClick={loadAdmin} type="button">
              Accedi come Super Admin
            </button>
          </div>
        ) : (
          <div className="admin-tools">
            <div className="admin-cutoffs">
              <h3>Cutoff giornate</h3>
              {matchdays.map((matchday) => {
                const saved = adminData.cutoffs?.[matchday];
                const localValue = saved ? new Date(saved).toISOString().slice(0, 16) : "";
                return (
                  <label key={matchday}>
                    G{matchday}
                    <input
                      type="datetime-local"
                      defaultValue={localValue}
                      onBlur={(event) => saveCutoff(matchday, event.target.value)}
                    />
                  </label>
                );
              })}
            </div>

            <div className="admin-results">
              <h3>Risultati</h3>
              {currentMatches.map((match) => (
                <div className="admin-result-row" key={match.id}>
                  <span>{match.homeTeam} - {match.awayTeam}</span>
                  <select
                    value={match.officialResult || ""}
                    onChange={(event) => event.target.value && saveResult(match.id, event.target.value)}
                  >
                    <option value="">—</option>
                    <option value="1">1</option>
                    <option value="X">X</option>
                    <option value="2">2</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="admin-history">
              <h3>Ultime giocate salvate</h3>
              {adminData.history?.slice(0, 30).map((item) => (
                <div className="admin-history-row" key={item.id}>
                  <strong>{item.userName}</strong>
                  <span>{item.match} → {item.pick}</span>
                  <small>{new Date(item.createdAt).toLocaleString("it-IT")}</small>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function buildSerieA1x2Ranking(localPredictions, playerName, fixtures) {
  const rows = [];
  const localPoints = fixtures.reduce((total, match) => {
    return total + (match.officialResult && localPredictions[match.id] === match.officialResult ? 1 : 0);
  }, 0);

  rows.push({ name: playerName.trim() || "Mio utente", points: localPoints, submitted: Object.keys(localPredictions).length });
  return rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

function formatCutoff(match) {
  const value = match.cutoffAt || match.utcDate || match.date;
  if (!value) return "Orario da confermare";
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    hour: match.cutoffAt || match.utcDate ? "2-digit" : undefined,
    minute: match.cutoffAt || match.utcDate ? "2-digit" : undefined,
    month: "2-digit",
    timeZone: "Europe/Rome",
  });
}

function Stat({ icon, value, label }) {
  return (
    <div className="stat">
      {icon}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Fact({ icon, label, value }) {
  return (
    <div className="fact">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WinnerStrip({ podium }) {
  const winner = podium[0];

  return (
    <span className="winner-strip">
      <Trophy size={15} />
      Winner: {winner.name}
    </span>
  );
}

function statusLabel(status) {
  return {
    "in-corso": "In corso",
    terminato: "Terminato",
  }[status];
}

createRoot(document.getElementById("root")).render(<App />);