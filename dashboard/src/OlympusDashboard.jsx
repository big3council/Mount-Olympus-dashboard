import { useState, useEffect, useRef, useCallback } from "react";
import OlympusView from "./OlympusView";
import CouncilChamber from "./CouncilChamber";
import { FONTS, css } from "./styles";
import {
  API_URL, WS_URL, NODE_HEALTH_TARGETS,
  targetToMode, tierToMode,
  smartNameFallback, QUORUM_MAP,
  FRUIT_DEFS, FRUIT_INFO,
} from "./utils/constants";
import StarField from "./components/StarField";
import VoteStamps from "./components/VoteStamps";
import CouncilThread from "./components/CouncilThread";
import SummarizedBlock from "./components/SummarizedBlock";
import GaiaTree from "./components/GaiaTree";
import FruitDetailContent from "./components/FruitDetailContent";
import QuorumPanel from "./components/council/QuorumPanel";

export default function OlympusDashboard() {
  // ── Mission state ──────────────────────────────────────────────────────────
  const [missions, setMissions]         = useState({});
  const [activeMissionId, setActiveMissionId] = useState(null);
  const savedMissionIds = useRef(new Set());

  // ── UI state ───────────────────────────────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState(null);
  const [panelTabMode, setPanelTabMode] = useState("council"); // "council" | "agent"
  const [wsStatus, setWsStatus]         = useState("connecting");
  const [time, setTime]                 = useState(new Date().toLocaleTimeString());
  const [gaiaReport, setGaiaReport]     = useState(null);
  const [nodeHealth, setNodeHealth]     = useState({ ZEUS: null, POSEIDON: null, HADES: null, GAIA: null });
  const [sendText, setSendText]         = useState("");
  const [sendTarget, setSendTarget]     = useState("B3C_COUNCIL");
  const [sending, setSending]           = useState(false);
  const [sidebarTab, setSidebarTab]     = useState("ALL");
  const [gaiaMessages, setGaiaMessages] = useState([]);
  const [gaiaTab, setGaiaTab]           = useState("ALL");
  const [activeUser, setActiveUser]     = useState(null); // "CARSON" | "TYLER" | null

  // ── Gaia standalone system state ───────────────────────────────────────────
  const [gaiaMode, setGaiaMode]               = useState(false);
  const [gaiaViewMode, setGaiaViewMode]       = useState("chat"); // "tree" | "chat" | "council"
  const [gaiaThinking, setGaiaThinking]       = useState(false);
  const [gaiaCouncilSending, setGaiaCouncilSending] = useState(false);
  const [sshCtrlPulse, setSshCtrlPulse]       = useState(null); // timestamp of last SSH action
  const [gaiaSSHLog, setGaiaSSHLog]           = useState([]);   // intervention log entries
  const [gaiaPendingText, setGaiaPendingText] = useState("");
  const [fruitRipeness, setFruitRipeness]     = useState({ zeus: 0, poseidon: 0, hades: 0, gaia: 0, saxon: 0, sydney: 0 });
  const [selectedFruit, setSelectedFruit]     = useState(null);
  const [gaiaDirectiveFeed, setGaiaDirectiveFeed] = useState([]);
  const [gaiaGrowthHistory, setGaiaGrowthHistory] = useState({});
  const [gaiaRetrospectives, setGaiaRetrospectives] = useState([]);
  const [activePulses, setActivePulses]       = useState([]);
  const [gaiaFeedTab, setGaiaFeedTab]         = useState("DIRECTIVES");
  const prevGaiaStateRef = useRef(null);
  const gaiaChatRef      = useRef(null);

  // ── Top-level view state ──────────────────────────────────────────────────
  const [topView, setTopView]               = useState("council"); // "council" | "olympus" | "record"
  const [nodeHealthOpen, setNodeHealthOpen] = useState(false);
  const nodeHealthRef = useRef(null);

  // ── Queue state ───────────────────────────────────────────────────────────
  const [queueState,         setQueueState]         = useState([]);   // full queue_update list
  const [zeusReorderNotif,   setZeusReorderNotif]   = useState(null); // { reason, ts }
  const [sendPriority,       setSendPriority]       = useState(false);
  const [routeOpen,          setRouteOpen]          = useState(false);
  const [expandedPrompts,   setExpandedPrompts]   = useState(new Set());
  const [expandedQueueItems, setExpandedQueueItems] = useState(new Set());
  const [cinematicOpen, setCinematicOpen] = useState(false);

  // ── Phase 6: Quorum smoke test results ───────────────────────────────────
  // Shape: { zeus: { "Hermes": { ok, latency_ms, ts }, ... }, poseidon: {...}, hades: {...} }
  const [smokeTestResults, setSmokeTestResults] = useState(null);
  const cinematicCouncilRef = useRef(null);

  // ── LLM-powered mission titles (cached) ────────────────────────────────────
  const [missionTitles, setMissionTitles] = useState({});
  const titleFetchQueue = useRef(new Set());

  // ── Gaia conversation state ───────────────────────────────────────────────
  // Each conversation: { id, userId, timestamp, messages: [{role, text, timestamp}] }
  const [gaiaConversations,  setGaiaConversations]  = useState({});
  const [activeGaiaConvId,   setActiveGaiaConvId]   = useState(null);
  const activeGaiaConvIdRef  = useRef(null);  // ref for WS handler closure
  const savedGaiaConvIds     = useRef(new Set()); // "convId:msgCount" seen set

  const wsRef          = useRef(null);
  const reconnectTimer = useRef(null);
  const isReplayingRef  = useRef(true);  // suppress auto-select during WS replay
  const backoffRef     = useRef(1000);   // exponential reconnect delay (ms)
  const queueStateRef  = useRef([]);     // stable ref for beforeunload handler

  // ── Derived active mission + mode ──────────────────────────────────────────
  const activeMission          = missions[activeMissionId] ?? null;
  const mode                   = activeMission?.uiMode ?? targetToMode(sendTarget);
  const stage                  = activeMission?.stage ?? "idle";
  const councilMessages        = activeMission?.councilMessages ?? [];
  const councilBackendMessages = activeMission?.councilBackendMessages ?? [];
  const progress               = activeMission?.progress ?? { zeus: 0, poseidon: 0, hades: 0 };
  const nodeThoughts           = activeMission?.nodeThoughts ?? {};
  const nodeTasks              = activeMission?.nodeTasks ?? {};
  const runStats               = activeMission?.runStats ?? null;
  const outputText             = activeMission?.output ?? null;
  const nodeStatus             = activeMission?.nodeStatus ?? {};
  const stageTimes             = activeMission?.stageTimes ?? {};
  const zeusDiagnostic         = activeMission?.zeusDiagnostic ?? null;
  // Returns the execution-phase status entry for a given agent key
  const getExecStatus = (agent) => nodeStatus[`${agent}:execution`] ?? null;
  // Returns elapsed seconds for a working execution agent (updates via 1s clock re-render)
  const execElapsed = (agent) => {
    const s = getExecStatus(agent);
    return (s?.status === "working") ? Math.floor((Date.now() - s.startedAt) / 1000) : null;
  };
  // Seconds elapsed in current pipeline stage
  const phaseElapsed = stageTimes[stage] ? Math.floor((Date.now() - stageTimes[stage]) / 1000) : null;
  const activeRequest          = activeMission
    ? { id: activeMission.id, text: activeMission.text, channel: activeMission.channel }
    : null;

  // Keep refs in sync with state (for WS handler closures and beforeunload)
  activeGaiaConvIdRef.current = activeGaiaConvId;
  queueStateRef.current       = queueState;

  // When gaiaMode is active, override all other mode styling/routing
  const effectiveMode = gaiaMode ? "gaia" : mode;


  // ── Cinematic takeover lifecycle ─────────────────────────────────────────────
  const isCinematicTier = mode === "tier2";

  // Auto-open when a T2/T3 mission activates
  useEffect(() => {
    if (activeMission?.status === "active" && isCinematicTier) {
      setCinematicOpen(true);
    }
  }, [activeMissionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close when mission clears, mode leaves T2/T3, or view switches away from council
  useEffect(() => {
    if (!cinematicOpen) return;
    if (!activeMission || !isCinematicTier || topView !== "council") {
      setCinematicOpen(false);
    }
  }, [activeMission, isCinematicTier, topView, cinematicOpen]);

  // Auto-close 3s after mission completes
  useEffect(() => {
    if (!cinematicOpen || stage !== "done") return;
    const t = setTimeout(() => setCinematicOpen(false), 3000);
    return () => clearTimeout(t);
  }, [cinematicOpen, stage]);

  // ESC to close
  useEffect(() => {
    if (!cinematicOpen) return;
    const handler = (e) => { if (e.key === "Escape") setCinematicOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cinematicOpen]);

  // Auto-scroll council right panel
  useEffect(() => {
    if (!cinematicOpen || !cinematicCouncilRef.current) return;
    cinematicCouncilRef.current.scrollTop = cinematicCouncilRef.current.scrollHeight;
  }, [cinematicOpen, councilMessages.length, councilBackendMessages.length]);

  // ── Clock ──────────────────────────────────────────────────────────────────
  
  // ── Fetch LLM titles for missions/queue items ─────────────────────────────
  const getMissionTitle = useCallback((id, text) => {
    if (missionTitles[id] || titleFetchQueue.current.has(id)) return missionTitles[id] || smartNameFallback(text);
    titleFetchQueue.current.add(id);
    fetch(API_URL + "/api/name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.title) {
          setMissionTitles(prev => ({ ...prev, [id]: data.title }));
        }
        titleFetchQueue.current.delete(id);
      })
      .catch(() => { titleFetchQueue.current.delete(id); });
    return smartNameFallback(text);
  }, [missionTitles]);

useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Pulse cleanup (remove finished animations after 3.5s) ─────────────────
  useEffect(() => {
    if (activePulses.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      setActivePulses(prev => prev.filter(p => now - p.start < 3500));
    }, 3600);
    return () => clearTimeout(timer);
  }, [activePulses]);

  // ── Rehydrate all Gaia state (called on mount + every WS reconnect) ──────────
  const rehydrateGaia = useCallback(async () => {
    try {
      const [convsRes, councilRes, retrosRes] = await Promise.all([
        fetch(`${API_URL}/gaia/conversations`).then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/gaia/council`).then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/gaia/retrospectives`).then(r => r.ok ? r.json() : []),
      ]);

      // ── Conversations → gaiaConversations + activeGaiaConvId + gaiaMessages ──
      const convMap = {};
      let latestTs = 0;
      let latestId = null;
      for (const c of convsRes) {
        convMap[c.id] = c;
        savedGaiaConvIds.current.add(`${c.id}:${(c.messages || []).length}`);
        // Track most-recently-updated conversation
        const msgs = c.messages ?? [];
        const lastTs = msgs.length ? new Date(msgs[msgs.length - 1].timestamp || 0).getTime() : 0;
        if (lastTs > latestTs) { latestTs = lastTs; latestId = c.id; }
      }
      setGaiaConversations(convMap);
      if (latestId) {
        setActiveGaiaConvId(latestId);
        activeGaiaConvIdRef.current = latestId;
      }

      // Reconstruct gaiaMessages (right-panel feed) from all conversation pairs
      const msgs = [];
      for (const conv of Object.values(convMap)) {
        const convMsgs = conv.messages ?? [];
        const userLabel = conv.userId === '8150818650' ? 'Carson'
                        : conv.userId === '874345067'  ? 'Tyler' : 'Dashboard';
        for (let i = 0; i < convMsgs.length - 1; i++) {
          const u = convMsgs[i], a = convMsgs[i + 1];
          if (u.role === 'user' && a.role === 'assistant') {
            msgs.push({ text: u.text, response: a.text, userId: conv.userId ?? null,
              channel: `Gaia · ${userLabel}`, timestamp: u.timestamp });
          }
        }
      }
      msgs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setGaiaMessages(msgs);

      // ── Council log → gaiaDirectiveFeed ──────────────────────────────────────
      const feed = [];
      for (const entry of councilRes) {
        for (const msg of entry.thread ?? []) {
          feed.push({ id: entry.id, speaker: msg.speaker, text: msg.text,
            phase: msg.phase, timestamp: msg.timestamp });
        }
      }
      setGaiaDirectiveFeed(feed);

      // ── Retrospectives ────────────────────────────────────────────────────────
      setGaiaRetrospectives(retrosRes.slice().reverse()); // newest first
    } catch (err) {
      console.error('[Dashboard] rehydrateGaia failed:', err);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist Gaia conversations to server when updated ─────────────────────
  useEffect(() => {
    for (const [id, conv] of Object.entries(gaiaConversations)) {
      if (!conv.messages?.length) continue;
      const key = `${id}:${conv.messages.length}`;
      if (!savedGaiaConvIds.current.has(key)) {
        savedGaiaConvIds.current.add(key);
        fetch(`${API_URL}/gaia/conversations/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(conv),
        }).catch(() => {});
      }
    }
  }, [gaiaConversations]);

  // ── Auto-scroll Gaia chat to bottom on new messages or thinking state ───────
  useEffect(() => {
    if (gaiaChatRef.current) {
      gaiaChatRef.current.scrollTop = gaiaChatRef.current.scrollHeight;
    }
  }, [gaiaConversations, activeGaiaConvId, gaiaThinking]);

  // ── Rehydrate queue state (called on mount + every WS reconnect) ────────────
  const rehydrateQueue = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/queue`);
      if (!r.ok) return;
      const { pending: pend, running: run } = await r.json();
      const allItems = [
        ...run.map(m => ({ ...m, status: 'running' })),
        ...pend.map(m => ({ ...m, status: 'pending' })),
      ];
      setQueueState(allItems);
      // Stub active mission entries for running missions not yet in history
      if (run.length > 0) {
        setMissions(prev => {
          const next = { ...prev };
          for (const m of run) {
            if (!next[m.id]) {
              next[m.id] = {
                id: m.id,
                text: m.text,
                channel: '',
                target: m.target ?? 'zeus',
                userId: m.userId ?? null,
                isWarRoom: false,
                timestamp: Date.now(),
                status: 'active',
                stage: 'idle',
                uiMode: m.tier ? tierToMode(m.tier) : 'classifying',
                tier: m.tier ?? null,
                councilMessages: [],
                councilBackendMessages: [],
                progress: { zeus: 0, poseidon: 0, hades: 0 },
                nodeThoughts: {},
              streamingContent: null,
                nodeTasks: {},
                runStats: null,
                output: null,
              };
            }
          }
          return next;
        });
      }
    } catch (err) {
      console.error('[Dashboard] rehydrateQueue failed:', err);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load missions from server on mount ─────────────────────────────────────
  useEffect(() => {
    fetch(`${API_URL}/missions`)
      .then(r => r.json())
      .then(list => {
        const map = {};
        for (const m of list) {
          // Backfill userId / isWarRoom from channel if missing (handles legacy saves)
          const ch = (m.channel || '').toLowerCase();
          if (!m.userId) {
            if (ch.includes('carson'))     m.userId = "8150818650";
            else if (ch.includes('tyler')) m.userId = "874345067";
          }
          if (!m.isWarRoom && ch.startsWith('war room')) m.isWarRoom = true;
          map[m.id] = m;
          savedMissionIds.current.add(m.id);
        }
        setMissions(map);
      })
      .catch(err => console.error("[Dashboard] Failed to load missions:", err));
    rehydrateQueue();
    rehydrateGaia();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Node health polling ────────────────────────────────────────────────────
  useEffect(() => {
    const pingAll = async () => {
      const results = await Promise.all(
        Object.entries(NODE_HEALTH_TARGETS).map(async ([name, target]) => {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 3500);
            const res = await fetch(`${API_URL}/proxy/health?target=${encodeURIComponent(target)}`, { signal: ctrl.signal });
            clearTimeout(timer);
            return [name, res.ok];
          } catch {
            return [name, false];
          }
        })
      );
      setNodeHealth(Object.fromEntries(results));
    };
    pingAll();
    const t = setInterval(pingAll, 10000);
    return () => clearInterval(t);
  }, []);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleEvent = (msg) => {
      switch (msg.type) {

        case "request_start": {
          const id = msg.id;
          // Gaia conversations are fully isolated in gaiaMessages — never enter missions state
          if (msg.target === "gaia") break;
          // Direct agents get their mode immediately; B3C council waits for tier_classified
          let uiMode;
          if (msg.text?.toUpperCase().startsWith("ZEUS PROTOCOL")) {
            uiMode = "zeus_protocol";
          } else if (msg.target === "poseidon") {
            uiMode = "poseidon";
          } else if (msg.target === "hades") {
            uiMode = "hades";
          } else if (msg.target === "gaia") {
            uiMode = "gaia";
          } else {
            uiMode = "classifying"; // hold on triangle until tier_classified
          }
          setMissions(prev => ({
            ...prev,
            [id]: {
              id,
              text: msg.text,
              channel: msg.channel,
              target: msg.target,
              userId: msg.userId ?? null,
              isWarRoom: msg.isWarRoom ?? false,
              timestamp: Date.now(),
              status: "active",
              stage: "idle",
              uiMode,
              tier: null,
              assigned_member: null,
              councilMessages: [],
              councilBackendMessages: [],
              progress: { zeus: 0, poseidon: 0, hades: 0 },
              nodeThoughts: {},
              nodeTasks: {},
              nodeStatus: {},
              stageTimes: { idle: Date.now() },
              quorumState: { zeus: { assignments: [], spark_returns: [], backend_council: [] }, poseidon: { assignments: [], spark_returns: [], backend_council: [] }, hades: { assignments: [], spark_returns: [], backend_council: [] } },
              smokeTestResults: null,
              zeusDiagnostic: null,
              runStats: null,
              output: null,
            },
          }));
          // Only auto-select if this is a live event, not a ring buffer replay
          if (!isReplayingRef.current) setActiveMissionId(id);
          break;
        }

        case "tier_classified": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            return {
              ...prev,
              [msg.id]: {
                ...prev[msg.id],
                tier: msg.tier,
                uiMode: tierToMode(msg.tier),
                assigned_member: msg.assigned_member ?? prev[msg.id].assigned_member ?? null,
              },
            };
          });
          break;
        }

        case "quorum_initial_council": {
          if (!msg.id || !msg.head) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            const head = msg.head;
            const qs = m.quorumState || {};
            const headState = qs[head] || { assignments: [], spark_returns: [], backend_council: [] };
            return {
              ...prev,
              [msg.id]: {
                ...m,
                quorumState: {
                  ...qs,
                  [head]: { ...headState, assignments: msg.assignments ?? headState.assignments },
                },
              },
            };
          });
          break;
        }

        case "quorum_spark_return": {
          if (!msg.id || !msg.head) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            const head = msg.head;
            const qs = m.quorumState || {};
            const headState = qs[head] || { assignments: [], spark_returns: [], backend_council: [] };
            const entry = {
              spark: msg.spark,
              status: msg.status ?? "complete",
              output: msg.output ?? null,
              error: msg.error ?? null,
              timestamp: msg.timestamp ?? Date.now(),
            };
            const existing = headState.spark_returns || [];
            const replaced = existing.some(e => e.spark === entry.spark);
            const nextReturns = replaced
              ? existing.map(e => e.spark === entry.spark ? { ...e, ...entry } : e)
              : [...existing, entry];
            return {
              ...prev,
              [msg.id]: {
                ...m,
                quorumState: {
                  ...qs,
                  [head]: { ...headState, spark_returns: nextReturns },
                },
              },
            };
          });
          break;
        }

        case "quorum_backend_council": {
          if (!msg.id || !msg.head) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            const head = msg.head;
            const qs = m.quorumState || {};
            const headState = qs[head] || { assignments: [], spark_returns: [], backend_council: [] };
            return {
              ...prev,
              [msg.id]: {
                ...m,
                quorumState: {
                  ...qs,
                  [head]: { ...headState, backend_council: msg.messages ?? headState.backend_council },
                },
              },
            };
          });
          break;
        }

        case "quorum_smoke_test": {
          // Backend emits one event per head with a per-spark map:
          //   { type, id, head, results: { Hermes: { ok, latency_ms, ts }, ... } }
          // Merge into the nested shape { head: { spark: {...} }, ... } so chips for
          // all heads can live side-by-side without overwriting each other.
          if (msg.head && msg.results) {
            setSmokeTestResults(prev => ({ ...(prev || {}), [msg.head]: msg.results }));
            if (msg.id) {
              setMissions(prev => {
                if (!prev[msg.id]) return prev;
                const existing = prev[msg.id].smokeTestResults || {};
                return {
                  ...prev,
                  [msg.id]: {
                    ...prev[msg.id],
                    smokeTestResults: { ...existing, [msg.head]: msg.results },
                  },
                };
              });
            }
          } else if (msg.results) {
            // Fallback: full-map replacement (old shape, if any emitter still uses it).
            setSmokeTestResults(msg.results);
            if (msg.id) {
              setMissions(prev => {
                if (!prev[msg.id]) return prev;
                return { ...prev, [msg.id]: { ...prev[msg.id], smokeTestResults: msg.results } };
              });
            }
          }
          break;
        }

        case "stage_change": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            return { ...prev, [msg.id]: { ...m, stage: msg.stage, stageTimes: { ...(m.stageTimes || {}), [msg.stage]: Date.now() } } };
          });
          break;
        }

        case "agent_thought": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            return { ...prev, [msg.id]: { ...m, nodeThoughts: { ...m.nodeThoughts, [msg.agent]: msg.text } } };
          });
          break;
        }

        case "agent_stream": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            return { ...prev, [msg.id]: { ...m, streamingContent: msg.full } };
          });
          break;
        }

        case "council_message": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            const entry = { speaker: msg.speaker, text: msg.text, vote: msg.vote || null };
            if (msg.council === "initial") {
              return { ...prev, [msg.id]: { ...m, councilMessages: [...m.councilMessages, entry] } };
            } else {
              return { ...prev, [msg.id]: { ...m, councilBackendMessages: [...m.councilBackendMessages, entry] } };
            }
          });
          break;
        }

        case "node_progress": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            return { ...prev, [msg.id]: { ...m, progress: { ...m.progress, [msg.agent]: msg.value } } };
          });
          break;
        }

        case "task_assigned": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            return { ...prev, [msg.id]: { ...m, nodeTasks: { ...m.nodeTasks, [msg.agent]: msg.task } } };
          });
          break;
        }

        case "agent_start": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            const key = `${msg.agent}:${msg.phase}`;
            return { ...prev, [msg.id]: { ...m, nodeStatus: { ...m.nodeStatus, [key]: { status: "working", startedAt: Date.now(), phase: msg.phase } } } };
          });
          break;
        }

        case "agent_complete": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            const key = `${msg.agent}:${msg.phase}`;
            const existing = m.nodeStatus[key] || {};
            return { ...prev, [msg.id]: { ...m, nodeStatus: { ...m.nodeStatus, [key]: { ...existing, status: "complete" } } } };
          });
          break;
        }

        case "agent_error": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            const key = `${msg.agent}:${msg.phase}`;
            const existing = m.nodeStatus[key] || {};
            return { ...prev, [msg.id]: { ...m, nodeStatus: { ...m.nodeStatus, [key]: { ...existing, status: "failed", error: msg.error } } } };
          });
          break;
        }

        case "zeus_diagnostic": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            return { ...prev, [msg.id]: { ...m, zeusDiagnostic: { agent: msg.agent, phase: msg.phase, error: msg.error, diagnosis: msg.diagnosis } } };
          });
          break;
        }

        case "request_complete": {
          const id = msg.id;
          setMissions(prev => {
            if (!prev[id]) return prev;
            return {
              ...prev,
              [id]: {
                ...prev[id],
                status: "done",
                stage: "done",
                output: msg.output ?? null,
                streamingContent: null,
                elapsed: msg.elapsed ?? null,
                runStats: { elapsed: msg.elapsed, tokens: msg.tokens, councils: msg.councils },
              },
            };
          });
          break;
        }

        case "gaia_report":
          setGaiaReport({ timestamp: msg.timestamp, text: msg.text });
          break;

        case "gaia_message":
          // Legacy feed (used by CONVERSATIONS tab in Gaia right panel)
          setGaiaMessages(prev => [{
            text:      msg.text,
            response:  msg.response,
            userId:    msg.userId ?? null,
            channel:   msg.channel,
            timestamp: msg.timestamp ?? new Date().toISOString(),
          }, ...prev]);
          setGaiaThinking(false);
          setGaiaPendingText("");
          // Append assistant response to the active conversation
          setGaiaConversations(prev => {
            const convId = activeGaiaConvIdRef.current;
            if (!convId || !prev[convId]) return prev;
            const conv = prev[convId];
            const assistantMsg = { role: "assistant", text: msg.response, timestamp: msg.timestamp ?? new Date().toISOString() };
            return { ...prev, [convId]: { ...conv, messages: [...conv.messages, assistantMsg] } };
          });
          break;

        case "gaia_error":
          setGaiaThinking(false);
          setGaiaPendingText("");
          break;

        case "queue_update":
          setQueueState(msg.queue ?? []);
          break;

        case "queue_ack":
          // Queue acknowledgment — handled by Telegram; dashboard shows it via queue_update
          break;

        case "queue_reorder": {
          const notifTs = Date.now();
          setZeusReorderNotif({ reason: msg.reason, ts: notifTs });
          setTimeout(() => setZeusReorderNotif(n => n?.ts === notifTs ? null : n), 8000);
          break;
        }

        case "mission_cancelled":
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            return { ...prev, [msg.id]: { ...prev[msg.id], status: "cancelled", stage: "done" } };
          });
          break;

        case "gaia_retrospective":
          setGaiaRetrospectives(prev => [{ timestamp: msg.timestamp, text: msg.text, missions_reviewed: msg.missions_reviewed }, ...prev]);
          setGaiaReport({ timestamp: msg.timestamp, text: msg.text });
          break;

        case "gaia_directive":
          setGaiaDirectiveFeed(prev => [...prev, {
            id: msg.id, speaker: msg.speaker, text: msg.text,
            phase: msg.phase, timestamp: msg.timestamp ?? new Date().toISOString(),
          }]);
          setGaiaCouncilSending(false);
          break;

        case "gaia_ssh_control":
          setSshCtrlPulse(Date.now());
          setGaiaSSHLog(prev => [{ node: msg.node, command: msg.command, reason: msg.reason, result: msg.result, ok: msg.ok, timestamp: msg.timestamp ?? new Date().toISOString() }, ...prev]);
          break;

        case "gaia_growth":
          if (msg.phase === "directive_sent") {
            setFruitRipeness(prev => ({ ...prev, [msg.target]: (prev[msg.target] || 0) + 1 }));
            setActivePulses(prev => [...prev, { id: msg.id, target: msg.target, phase: "up", start: Date.now() }]);
            setGaiaGrowthHistory(prev => ({
              ...prev,
              [msg.target]: [...(prev[msg.target] || []), { directive: msg.directive, timestamp: msg.timestamp }],
            }));
          } else if (msg.phase === "response_received") {
            setActivePulses(prev => [...prev, { id: `${msg.id}_down`, target: msg.target, phase: "down", start: Date.now() }]);
          }
          break;

        default:
          break;
      }
    };

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        // Mark replay window — skip auto-selecting missions from ring buffer replay
        isReplayingRef.current = true;
        setTimeout(() => { isReplayingRef.current = false; }, 2000);
        setWsStatus("live");
        clearTimeout(reconnectTimer.current);
        backoffRef.current = 1000;
        rehydrateQueue();
        rehydrateGaia();
      };
      ws.onclose = () => {
        setWsStatus("disconnected");
        reconnectTimer.current = setTimeout(connect, backoffRef.current);
        backoffRef.current = Math.min(backoffRef.current * 2, 30000);
      };
      ws.onerror = () => { ws.close(); };
      ws.onmessage = (e) => {
        let msg; try { msg = JSON.parse(e.data); } catch { return; }
        handleEvent(msg);
      };
    };

    connect();
    return () => { clearTimeout(reconnectTimer.current); wsRef.current?.close(); };
  }, []);

  // ── Warn before leaving when missions are active ───────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const hasActive = queueStateRef.current.some(
        m => m.status === 'running' || m.status === 'pending'
      );
      if (hasActive) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ── Persist completed missions to server ───────────────────────────────────
  useEffect(() => {
    for (const [id, m] of Object.entries(missions)) {
      if (m.status === "done" && !savedMissionIds.current.has(id)) {
        savedMissionIds.current.add(id);
        fetch(`${API_URL}/missions/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(m),
        }).catch(err => {
          savedMissionIds.current.delete(id);
          console.error("[Dashboard] Failed to save mission:", err);
        });
      }
    }
  }, [missions]);

  // ── Auto-select panel when stage changes (tier2 only) ──────────────────
  useEffect(() => {
    if (!activeMission) { setSelectedNode(null); return; }
    if (!mode === "tier2") { setSelectedNode(null); return; }
    if      (stage === "idle")            setSelectedNode(null);
    else if (stage === "council_initial") { setSelectedNode("council_initial"); setPanelTabMode("council"); }
    else if (stage === "execution")       { setSelectedNode("zeus_exec"); setPanelTabMode("council"); }
    else if (stage === "council_backend") { setSelectedNode("council_backend"); setPanelTabMode("council"); }
    else if (stage === "done")            { setSelectedNode("output"); setPanelTabMode("council"); }
  }, [stage, activeMissionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Node/connection state helpers ────────────────────────────────────────
  const getNodeState = (node) => {
    const stageOrder = ["idle", "council_initial", "execution", "council_backend", "done"];
    const nodeStages = { council_initial: 1, zeus_exec: 2, poseidon: 2, hades: 2, council_backend: 3, output: 4 };
    const current = stageOrder.indexOf(stage);
    const nodeIdx = nodeStages[node] || 0;
    if (current === nodeIdx) return "thinking";
    if (current > nodeIdx)  return "done";
    return "idle";
  };

  const getConnState = (from) => {
    const stageIdx = { idle: 0, council_initial: 1, execution: 2, council_backend: 3, done: 4 };
    const connEnds  = { council_initial: 1, execution: 2, council_backend: 3, done: 4 };
    const current = stageIdx[stage] || 0;
    const fromIdx = connEnds[from] || 0;
    if (current > fromIdx)  return "done";
    if (current === fromIdx) return "active";
    return "idle";
  };

  // ── Send handler ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!sendText.trim() || sending) return;
    setSending(true);
    try {
      const rawText    = sendText.trim();
      const userName   = activeUser === "CARSON" ? "Carson" : activeUser === "TYLER" ? "Tyler" : null;
      const idPrefix   = userName ? `Message from ${userName}: ` : "";
      let target = "zeus";
      let text;
      if (sendTarget === "ZEUS_PROTOCOL") {
        text = `ZEUS PROTOCOL: ${idPrefix}${rawText}`;
      } else {
        text = `${idPrefix}${rawText}`;
        if      (sendTarget === "POSEIDON") { target = "poseidon"; }
        else if (sendTarget === "HADES")    { target = "hades"; }
        else if (sendTarget === "GAIA")     { target = "gaia"; }
      }
      const userId   = activeUser === "CARSON" ? "8150818650" : activeUser === "TYLER" ? "874345067" : undefined;
      const channel  = activeUser ? `dashboard · ${activeUser}` : "dashboard";
      const priority = sendPriority;
      await fetch(`${API_URL}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, channel, target, priority, ...(userId ? { userId } : {}) }),
      });
      setSendText("");
      if (sendPriority) setSendPriority(false);
    } catch (err) {
      console.error("[Dashboard] Send failed:", err);
    } finally {
      setSending(false);
    }
  };

  // ── Cancel mission (active/pending) ───────────────────────────────────────
  // Optimistically marks cancelled in local state so the UI responds even if
  // the server's WS event is slow. If the server doesn't recognize the id
  // (404 — already done/stale), falls through to a hard delete so the trash
  // click never silently no-ops.
  const handleCancelMission = async (id, e) => {
    e.stopPropagation();
    setMissions(prev => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], status: "cancelled", stage: "done" } };
    });
    try {
      const r = await fetch(`${API_URL}/missions/${id}/cancel`, { method: "POST" });
      if (r.status === 404) {
        // Mission isn't in the live queue anymore — remove from the persisted store + local state.
        setMissions(prev => { const next = { ...prev }; delete next[id]; return next; });
        if (activeMissionId === id) setActiveMissionId(null);
        await fetch(`${API_URL}/missions/${id}`, { method: "DELETE" }).catch(() => {});
      }
    } catch (err) {
      console.error("[Dashboard] Cancel failed:", err);
    }
  };

  // ── Delete mission (completed/cancelled) ───────────────────────────────────
  // Optimistic local removal + persisted DELETE. If the persisted record is
  // already gone (404), the local removal still wins.
  const handleDeleteMission = async (id, e) => {
    e.stopPropagation();
    setMissions(prev => { const next = { ...prev }; delete next[id]; return next; });
    if (activeMissionId === id) setActiveMissionId(null);
    try {
      await fetch(`${API_URL}/missions/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("[Dashboard] Delete failed:", err);
    }
  };

  // ── Gaia direct send — continuous conversation ────────────────────────────
  const handleGaiaSend = async () => {
    if (!sendText.trim() || sending || gaiaThinking) return;

    // COUNCIL mode — initiate B3C council communication
    if (gaiaViewMode === "council") {
      const message = sendText.trim();
      setSendText("");
      setSending(true);
      setGaiaCouncilSending(true);
      try {
        await fetch(`${API_URL}/gaia/council`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ message }),
        });
      } catch (err) {
        console.error("[Dashboard] Council send failed:", err);
        setGaiaCouncilSending(false);
      } finally {
        setSending(false);
      }
      return;
    }

    const text    = sendText.trim();
    const userId  = activeUser === "CARSON" ? "8150818650" : activeUser === "TYLER" ? "874345067" : undefined;
    const channel = activeUser ? `Gaia · ${activeUser}` : "Gaia · Dashboard";

    // Create new conversation or continue existing one
    let convId = activeGaiaConvId;
    let conv;
    if (!convId || !gaiaConversations[convId]) {
      convId = `gaia_conv_${Date.now()}`;
      conv   = { id: convId, userId: userId ?? null, timestamp: Date.now(), messages: [] };
    } else {
      conv = { ...gaiaConversations[convId], messages: [...gaiaConversations[convId].messages] };
    }

    // Append user message optimistically
    const userMsg = { role: "user", text, timestamp: new Date().toISOString() };
    conv.messages = [...conv.messages, userMsg];

    setActiveGaiaConvId(convId);
    activeGaiaConvIdRef.current = convId;
    setGaiaConversations(prev => ({ ...prev, [convId]: conv }));
    setGaiaThinking(true);
    setGaiaPendingText(text);
    setSendText("");
    setSending(true);

    try {
      // Build OpenAI-format messages array for full context
      const messages = conv.messages.map(m => ({ role: m.role, content: m.text }));
      await fetch(`${API_URL}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, channel, target: "gaia", messages, ...(userId ? { userId } : {}) }),
      });
    } catch (err) {
      console.error("[Dashboard] Gaia send failed:", err);
      setGaiaThinking(false);
      setGaiaPendingText("");
    } finally {
      setSending(false);
    }
  };

  // ── Mission click (sidebar) ────────────────────────────────────────────────
  const handleMissionClick = (id) => {
    const m = missions[id];
    if (!m) return;
    setActiveMissionId(id);
    const missionMode = m.uiMode ?? "tier2";
    if (!missionMode === "tier2") { setSelectedNode(null); return; }
    if      (m.stage === "done")             setSelectedNode("output");
    else if (m.stage === "council_initial")  setSelectedNode("council_initial");
    else if (m.stage === "execution")        setSelectedNode("zeus_exec");
    else if (m.stage === "council_backend")  setSelectedNode("council_backend");
    else                                     setSelectedNode(null);
  };

  // ── Gaia mode toggle ───────────────────────────────────────────────────────
  const toggleGaiaMode = () => {
    if (gaiaMode) {
      setGaiaMode(false);
      setSelectedFruit(null);
    } else {
      prevGaiaStateRef.current = { sendTarget };
      setGaiaMode(true);
      setSelectedFruit(null);
    }
  };

  // ── Click-outside for node health dropdown ────────────────────────────────
  useEffect(() => {
    if (!nodeHealthOpen) return;
    const handler = (e) => {
      if (nodeHealthRef.current && !nodeHealthRef.current.contains(e.target)) {
        setNodeHealthOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [nodeHealthOpen]);

  // ── Detail panel renderer ────────────────────────────────────────────────
  const renderPanel = () => {
    if (!selectedNode || !mode === "tier2") return null;

    const panels = {
      council_initial: {
        title: "B3C INITIAL COUNCIL",
        content: (
          <>
            <VoteStamps messages={councilMessages} missionId={activeMissionId} />
            <div className="panel-section">
              <div className="panel-section-label">Council deliberation</div>
              <CouncilThread messages={councilMessages} />
            </div>
          </>
        ),
      },
      zeus_exec: {
        title: getExecStatus("zeus")?.status === "failed" ? "ZEUS — FAILED" : "ZEUS — EXECUTING",
        content: (
          <>
            {getExecStatus("zeus")?.status === "failed" && (
              <div className="panel-section">
                <div className="panel-section-label" style={{ color: "#ff5050" }}>Failure</div>
                <div className="tier2-error-msg">{getExecStatus("zeus")?.error || "No response received"}</div>
              </div>
            )}
            {nodeTasks.zeus && (
              <div className="panel-section">
                <div className="panel-section-label">Deliverable</div>
                <SummarizedBlock text={nodeTasks.zeus} />
              </div>
            )}
            {nodeThoughts.zeus && (
              <div className="panel-section">
                <div className="panel-section-label">Reasoning</div>
                <SummarizedBlock text={nodeThoughts.zeus} />
              </div>
            )}
            {zeusDiagnostic?.agent === "zeus" && (
              <div className="panel-section">
                <div className="panel-section-label" style={{ color: "var(--gold)" }}>Zeus Diagnostic</div>
                <SummarizedBlock text={zeusDiagnostic.diagnosis} threshold={300} style={{ borderLeftColor: "var(--gold)", color: "rgba(232,184,75,0.85)" }} />
              </div>
            )}
          </>
        ),
      },
      poseidon: {
        title: getExecStatus("poseidon")?.status === "failed" ? "POSEIDON — FAILED" : "POSEIDON — EXECUTING",
        content: (
          <>
            {getExecStatus("poseidon")?.status === "failed" && (
              <div className="panel-section">
                <div className="panel-section-label" style={{ color: "#ff5050" }}>Failure</div>
                <div className="tier2-error-msg">{getExecStatus("poseidon")?.error || "No response received"}</div>
              </div>
            )}
            {nodeTasks.poseidon && (
              <div className="panel-section">
                <div className="panel-section-label">Deliverable</div>
                <SummarizedBlock text={nodeTasks.poseidon} />
              </div>
            )}
            {nodeThoughts.poseidon && (
              <div className="panel-section">
                <div className="panel-section-label">Reasoning</div>
                <SummarizedBlock text={nodeThoughts.poseidon} style={{ borderLeftColor: "var(--poseidon)" }} />
              </div>
            )}
            {zeusDiagnostic?.agent === "poseidon" && (
              <div className="panel-section">
                <div className="panel-section-label" style={{ color: "var(--gold)" }}>Zeus Diagnostic</div>
                <SummarizedBlock text={zeusDiagnostic.diagnosis} threshold={300} style={{ borderLeftColor: "var(--gold)", color: "rgba(232,184,75,0.85)" }} />
              </div>
            )}
          </>
        ),
      },
      hades: {
        title: getExecStatus("hades")?.status === "failed" ? "HADES — FAILED" : "HADES — EXECUTING",
        content: (
          <>
            {getExecStatus("hades")?.status === "failed" && (
              <div className="panel-section">
                <div className="panel-section-label" style={{ color: "#ff5050" }}>Failure</div>
                <div className="tier2-error-msg">{getExecStatus("hades")?.error || "No response received"}</div>
              </div>
            )}
            {nodeTasks.hades && (
              <div className="panel-section">
                <div className="panel-section-label">Deliverable</div>
                <SummarizedBlock text={nodeTasks.hades} />
              </div>
            )}
            {nodeThoughts.hades && (
              <div className="panel-section">
                <div className="panel-section-label">Reasoning</div>
                <SummarizedBlock text={nodeThoughts.hades} style={{ borderLeftColor: "var(--hades)" }} />
              </div>
            )}
            {zeusDiagnostic?.agent === "hades" && (
              <div className="panel-section">
                <div className="panel-section-label" style={{ color: "var(--gold)" }}>Zeus Diagnostic</div>
                <SummarizedBlock text={zeusDiagnostic.diagnosis} threshold={300} style={{ borderLeftColor: "var(--gold)", color: "rgba(232,184,75,0.85)" }} />
              </div>
            )}
          </>
        ),
      },
      council_backend: {
        title: "B3C BACKEND COUNCIL",
        content: (
          <>
            <VoteStamps messages={councilBackendMessages} missionId={activeMissionId} />
            <div className="panel-section">
              <div className="panel-section-label">Review deliberation</div>
              <CouncilThread messages={councilBackendMessages} />
            </div>
          </>
        ),
      },
      output: {
        title: "OUTPUT — DELIVERED",
        content: (
          <>
            {activeRequest?.channel && (
              <div className="panel-section">
                <div className="panel-section-label">Origin channel</div>
                <div style={{ display: "inline-flex", padding: "4px 12px", borderRadius: 3, fontSize: 11, fontFamily: "Cinzel, serif", letterSpacing: "0.08em", background: "rgba(94,232,176,0.1)", border: "1px solid rgba(94,232,176,0.4)", color: "var(--done)" }}>
                  {activeRequest.channel.toUpperCase()}
                </div>
              </div>
            )}
            {runStats && (
              <div className="panel-section">
                <div className="panel-section-label">Run stats</div>
                <div className="timing-row"><span>Total time</span><span className="timing-val">{runStats.elapsed ? `${(runStats.elapsed / 1000).toFixed(1)}s` : "—"}</span></div>
                <div className="timing-row"><span>Council rounds</span><span className="timing-val">{runStats.councils ?? "—"}</span></div>
                <div className="timing-row"><span>Tier</span><span className="timing-val">{activeMission?.tier ?? "—"}</span></div>
              </div>
            )}
          </>
        ),
      },
    };

    return panels[selectedNode] || null;
  };

  // ── Mission list ───────────────────────────────────────────────────────────
  const USER_IDS = { CARSON: "8150818650", TYLER: "874345067" };
  // Match by userId (coerced to string) OR by channel name — handles legacy/dashboard missions
  const missionBelongsTo = (m, uid, nameHint) =>
    (m.userId != null && String(m.userId) === uid) ||
    (m.channel || '').toLowerCase().includes(nameHint);
  const missionList = Object.values(missions)
    .filter(m => m.target !== "gaia") // Gaia is isolated — never in B3C history
    .sort((a, b) => b.timestamp - a.timestamp)
    .filter(m => {
      if (sidebarTab === "CARSON") return missionBelongsTo(m, USER_IDS.CARSON, 'carson');
      if (sidebarTab === "TYLER")  return missionBelongsTo(m, USER_IDS.TYLER,  'tyler');
      return true; // ALL
    });

  // ── Sidebar component ──────────────────────────────────────────────────────
  const USER_LABELS = { "8150818650": "CARSON", "874345067": "TYLER" };
  const renderSidebar = () => {
    // Build lookup: missionId → queue position (pending only)
    const queuePositions = {};
    for (const q of queueState) {
      if (q.status === "pending") queuePositions[q.id] = q.position;
    }

    return (
    <div className="sidebar">
      {/* ── Queue Panel ── */}
      <div className="sidebar-section">
        {zeusReorderNotif && (
          <div className="zeus-reorder-notif">
            ⚡ Zeus reorganized — {zeusReorderNotif.reason}
          </div>
        )}
        <div className="queue-slot-pills">
          {(() => {
            const t1Count     = queueState.filter(q => q.status === "running" && q.tier === "TIER_1").length;
            const councilCount = queueState.filter(q => q.status === "running" && (q.tier === "TIER_2")).length;
            return (
              <>
                <div className={`queue-slot-pill t1${t1Count > 0 ? " occupied" : ""}`}>
                  <div className="queue-pill-label">TIER I</div>
                  <div className="queue-pill-count">instant</div>
                </div>
                <div className={`queue-slot-pill t2${councilCount > 0 ? " occupied" : ""}`}>
                  <div className="queue-pill-label">COUNCIL</div>
                  <div className="queue-pill-count">{councilCount}/1</div>
                </div>
              </>
            );
          })()}
        </div>
        {queueState.length === 0 ? (
          <div className="queue-empty-line">Queue clear</div>
        ) : (
          [...queueState]
            .sort((a, b) =>
              a.status === "running" && b.status !== "running" ? -1 :
              b.status === "running" && a.status !== "running" ?  1 :
              a.position - b.position
            )
            .map(q => {
              // Legacy TIER_3 missions are semantically TIER_2 in the unified pipeline — display as T-II.
              const tierLabel = q.tier === "TIER_1" ? "T-I"
                              : (q.tier === "TIER_2" || q.tier === "TIER_3") ? "T-II"
                              : q.tier === "DIRECT" ? "DIR"
                              : "";
              const userLabel = q.userId === "8150818650" ? "CARSON" : q.userId === "874345067" ? "TYLER" : "";
              return (
                <div key={q.id} className="queue-item">
                  {q.status === "running"
                    ? <span className="queue-item-run-dot" />
                    : <span className="queue-item-pos">#{q.position}</span>
                  }
                  {tierLabel && <span className="queue-item-tier">{tierLabel}</span>}
                  {userLabel && <span className="queue-item-user">{userLabel}</span>}
                  <span className="queue-item-name">{missionTitles[q.id] || getMissionTitle(q.id, q.text)}</span>
                  <button
                    className={`queue-expand-btn ${expandedQueueItems.has(q.id) ? "open" : ""}`}
                    onClick={(e) => { e.stopPropagation(); setExpandedQueueItems(prev => { const next = new Set(prev); next.has(q.id) ? next.delete(q.id) : next.add(q.id); return next; }); }}
                    title="Show full input"
                  >▾</button>
                  {q.status === "pending" && q.estimatedWait && <span className="queue-item-wait">{q.estimatedWait}</span>}
                  <button className="queue-item-cancel" onClick={(e) => handleCancelMission(q.id, e)} title="Cancel">🗑</button>
                  {expandedQueueItems.has(q.id) && (
                    <div className="queue-expanded-text">{q.text}</div>
                  )}
                </div>
              );
            })
        )}
      </div>

      {/* ── Mission History ── */}
      <div className="sidebar-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div className="sidebar-label" style={{ marginBottom: 0 }}>Mission History</div>
          <button className="new-mission-btn" onClick={() => setActiveMissionId(null)}>+ NEW</button>
        </div>
        <div className="sidebar-tabs">
          {["ALL", "CARSON", "TYLER"].map(tab => (
            <button
              key={tab}
              className={`sidebar-tab ${sidebarTab === tab ? "active" : ""}`}
              onClick={() => { setSidebarTab(tab); setActiveUser(tab === "ALL" ? null : tab); }}
            >{tab}</button>
          ))}
        </div>
        {missionList.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.7 }}>
            {sidebarTab === "ALL" ? "No missions yet. Waiting for activity." : `No missions from ${sidebarTab} yet.`}
          </div>
        ) : (
          missionList.map(m => {
            const queuePos = queuePositions[m.id];
            const isCancellable = m.status === "active" || queuePos != null;
            return (
            <div key={m.id}
              className={`req-item ${m.id === activeMissionId ? "selected" : ""} ${m.status === "active" ? "active" : ""}`}
              onClick={() => handleMissionClick(m.id)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                <span className={`req-status ${m.status === "cancelled" ? "cancelled" : m.status}`} />
                <span className="req-text" style={{ flex: 1 }}>{missionTitles[m.id] || getMissionTitle(m.id, m.text)}</span>
                <button
                  className={`req-expand-btn ${expandedPrompts.has(m.id) ? "open" : ""}`}
                  onClick={(e) => { e.stopPropagation(); setExpandedPrompts(prev => { const next = new Set(prev); next.has(m.id) ? next.delete(m.id) : next.add(m.id); return next; }); }}
                  title="Show full prompt"
                >▾</button>
                {isCancellable ? (
                  <button
                    className="req-trash-btn"
                    onClick={(e) => handleCancelMission(m.id, e)}
                    title="Cancel mission"
                  >🗑</button>
                ) : (
                  <button
                    className="req-trash-btn"
                    onClick={(e) => handleDeleteMission(m.id, e)}
                    title="Delete mission"
                  >🗑</button>
                )}
              </div>
              {expandedPrompts.has(m.id) && (
                <div className="req-expanded-prompt">{m.text}</div>
              )}
              <div className="req-time">
                {new Date(m.timestamp).toLocaleTimeString()}
                {m.elapsed ? ` · ${(m.elapsed / 1000).toFixed(1)}s` : ""}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                {queuePos != null && (
                  <div className="queue-pos-badge">#{queuePos}</div>
                )}
                {m.tier && (
                  <div className="req-tier" style={{ margin: 0 }}>
                    {/* Legacy TIER_3 missions are semantically TIER_2 in the unified pipeline. */}
                    {m.tier === "TIER_1" ? "T-I" : "T-II"}
                    {m.uiMode === "zeus_protocol" ? " · ZEUS" : m.uiMode === "poseidon" ? " · POSEIDON" : m.uiMode === "hades" ? " · HADES" : m.uiMode === "gaia" ? " · GAIA" : ""}
                  </div>
                )}
                {m.isWarRoom && (
                  <div className="req-user-badge" style={{ color: "var(--gold2)", borderColor: "rgba(200,150,10,0.4)" }}>WAR ROOM</div>
                )}
                {!m.isWarRoom && m.userId && USER_LABELS[m.userId] && sidebarTab === "ALL" && (
                  <div className="req-user-badge">{USER_LABELS[m.userId]}</div>
                )}
                {m.status === "cancelled" && (
                  <div className="req-user-badge" style={{ color: "var(--muted)", opacity: 0.5 }}>CANCELLED</div>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>
      <div className="sidebar-section" style={{ flex: 1 }}>
        <div className="sidebar-label">Gaia — Last Report</div>
        {gaiaReport ? (
          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.7 }}>
            <div style={{ color: "var(--gaia)", marginBottom: 6, fontFamily: "Cinzel, serif", fontSize: 11, letterSpacing: "0.08em" }}>
              GAIA · {gaiaReport.timestamp}
            </div>
            {gaiaReport.text}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "var(--dim)", lineHeight: 1.7 }}>Gaia's nightly retrospective will appear here.</div>
        )}
      </div>
    </div>
    );
  };

  // ── TIER 1 VIEW — Intimate, Zeus only ─────────────────────────────────────
  const renderTier1 = () => {
    const isThinking = activeMission?.status === "active";
    return (
      <>
        {renderSidebar()}
        <div className="tier1-area">
          <div className="tier1-symbol">⚡</div>
          <div className="tier1-agent-label">ZEUS</div>
          {isThinking && !outputText && (
            <div className="tier1-thinking">processing . . .</div>
          )}
          {outputText && (
            <div className="tier1-response">{outputText}</div>
          )}
          {!activeMission && (
            <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "Cinzel, serif", letterSpacing: "0.15em", textAlign: "center", marginTop: 8 }}>
              Direct line · Single response
            </div>
          )}
        </div>
      </>
    );
  };

  // ── TIER 2 VIEW — Focused trio ─────────────────────────────────────────────
  const renderTier2 = () => {
    // Idle state — no mission in progress. Show the CouncilChamber (three
    // thrones, present-and-waiting) rather than an empty three-domain card grid.
    if (!activeMission) {
      return (
        <>
          {renderSidebar()}
          <CouncilChamber nodeHealth={nodeHealth} />
        </>
      );
    }

    const isCoordinating = stage === "council_initial";
    const isExecuting    = stage === "execution";
    const isReviewing    = stage === "council_backend";
    const isDone         = stage === "done";
    const isActive       = activeMission?.status === "active";

    // Derive the display card state from live nodeStatus
    const getCardClass = (agentKey) => {
      const s = getExecStatus(agentKey);
      if (!s) return isDone || isReviewing ? `${agentKey}-done` : isExecuting ? "working" : "idle";
      return s.status; // "working" | "complete" | "failed"
    };

    // Which agents are currently speaking in council phases
    const speakerKey = isCoordinating ? "zeus:coordination"
      : isReviewing ? null : null;
    const coordinatingSpeaker = nodeStatus["zeus:coordination"];
    const currentSpeaker = isCoordinating && coordinatingSpeaker?.status === "working" ? "zeus" : null;

    const panel = renderPanel();
    return (
      <>
        {renderSidebar()}
        {renderTier2Content()}
        {/* Detail panel */}
        <div className={`detail-panel ${panel ? "" : "closed"}`}>
          {panel && (
            <>
              <div className="panel-header">
                <div className="panel-title">{panelTabMode === "council" ? "B3C COUNCIL" : panel.title}</div>
                <button className="panel-close" onClick={() => { setSelectedNode(null); setPanelTabMode("council"); }}>✕</button>
              </div>
              <div className="panel-tabs">
                <button className={`panel-tab ${panelTabMode === "council" ? "active" : ""}`} onClick={() => setPanelTabMode("council")}>Council</button>
                <button className={`panel-tab ${panelTabMode === "agent" ? "active" : ""}`} onClick={() => setPanelTabMode("agent")}>Agent</button>
              </div>
              <div className="panel-body">
                {panelTabMode === "council" ? (
                  <>
                    <VoteStamps messages={[...(councilMessages || []), ...(councilBackendMessages || [])]} missionId={activeMissionId} />
                    <div className="panel-section">
                      <div className="panel-section-label">Council deliberation</div>
                      <CouncilThread messages={[...(councilMessages || []), ...(councilBackendMessages || [])]} />
                    </div>
                  </>
                ) : (
                  panel.content
                )}
              </div>
            </>
          )}
        </div>
      </>
    );
  };

  const renderTier2Content = () => {
    const isCoordinating = stage === "council_initial";
    const isExecuting    = stage === "execution";
    const isReviewing    = stage === "council_backend";
    const isDone         = stage === "done";
    const isActive       = activeMission?.status === "active";
    const getCardClass = (agentKey) => {
      const s = getExecStatus(agentKey);
      if (!s) return isDone || isReviewing ? `${agentKey}-done` : isExecuting ? "working" : "idle";
      return s.status;
    };
    return (
        <div className="tier2-area">
          {activeRequest ? (
            <div className="tier2-request-pill">{activeRequest.text}</div>
          ) : (
            <div className="tier2-request-pill" style={{ color: "var(--muted)", fontFamily: "Cinzel, serif", letterSpacing: "0.15em" }}>
              FOCUSED THREE-DOMAIN EXECUTION
            </div>
          )}

          {isActive && (
            <div className="tier2-status">
              <span className="tier2-status-dot" />
              {isCoordinating ? "COORDINATING" : isExecuting ? "EXECUTING IN PARALLEL" : isReviewing ? "SINGLE REVIEW PASS" : "ACTIVE"}
              {phaseElapsed !== null && (
                <span style={{ marginLeft: 10, fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "rgba(232,184,75,0.5)" }}>
                  {phaseElapsed}s
                </span>
              )}
            </div>
          )}
          {!isActive && activeMission && (
            <div className="tier2-status" style={{ color: "var(--done)" }}>
              ✓ COMPLETE · {runStats?.elapsed ? `${(runStats.elapsed / 1000).toFixed(1)}s` : ""}
            </div>
          )}
          {!activeMission && (
            <div className="tier2-status">TIER II · FOCUSED TRIO</div>
          )}

          <div className="tier2-agents">
            {[
              { key: "zeus",     symbol: "⚡", name: "ZEUS",     domain: "Spiritual / Intellectual" },
              { key: "poseidon", symbol: "🔱", name: "POSEIDON", domain: "Financial / Social" },
              { key: "hades",    symbol: "🏛",  name: "HADES",   domain: "Physical / Technical" },
            ].map(agent => {
              const execSt      = getExecStatus(agent.key);
              const cardClass   = getCardClass(agent.key);
              const elapsed     = execElapsed(agent.key);
              const deliverable = nodeTasks[agent.key];
              const thought     = nodeThoughts[agent.key];

              let badgeLabel, badgeClass;
              if (execSt?.status === "failed")   { badgeLabel = "FAILED";   badgeClass = "failed"; }
              else if (execSt?.status === "complete") { badgeLabel = "COMPLETE"; badgeClass = "complete"; }
              else if (execSt?.status === "working")  { badgeLabel = "WORKING";  badgeClass = "working"; }
              else if (deliverable || thought)        { badgeLabel = "ASSIGNED"; badgeClass = "assigned"; }
              else                                    { badgeLabel = null;        badgeClass = ""; }

              return (
                <div key={agent.key} className={`tier2-card ${cardClass}`} onClick={() => { setSelectedNode(agent.key === "zeus" ? "zeus_exec" : agent.key); setPanelTabMode("agent"); }} style={{ cursor: "pointer" }}>
                  <div className="tier2-card-head">
                    <span className="tier2-card-symbol">{agent.symbol}</span>
                    <span className="tier2-card-name">{agent.name}</span>
                    {badgeLabel && (
                      <span className={`tier2-status-badge ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                    )}
                    {elapsed !== null && (
                      <span className="tier2-timer">{elapsed}s</span>
                    )}
                  </div>
                  <div className="tier2-card-domain">{agent.domain}</div>
                  {execSt?.status === "failed" ? (
                    <div className="tier2-error-msg">
                      {execSt.error || "No response received"}
                    </div>
                  ) : deliverable ? (
                    <div className="tier2-card-content">{deliverable}</div>
                  ) : thought ? (
                    <div className="tier2-card-content" style={{ color: "var(--muted)", fontStyle: "italic" }}>{thought}</div>
                  ) : (
                    <div className="tier2-card-content" style={{ color: "var(--dim)" }}>
                      {isCoordinating ? "Receiving task assignment..." : "Awaiting execution..."}
                    </div>
                  )}
                  {activeMission?.tier === "TIER_2" && (
                    <QuorumPanel
                      head={agent.key}
                      mode={activeMission.assigned_member === agent.key ? "full" : "compact"}
                      quorumState={activeMission.quorumState}
                      smokeTestResults={activeMission.smokeTestResults || smokeTestResults}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {zeusDiagnostic && (
            <div className="zeus-diagnostic">
              <div className="zeus-diagnostic-header">⚡ Zeus Diagnostic</div>
              <div className="zeus-diagnostic-meta">
                {zeusDiagnostic.agent?.toUpperCase()} · {zeusDiagnostic.phase} · Error: {zeusDiagnostic.error}
              </div>
              <div className="zeus-diagnostic-body">{zeusDiagnostic.diagnosis}</div>
            </div>
          )}

          {outputText && (
            <div className="tier2-synthesis">
              <div className="tier2-synth-header">
                <span>✦</span>
                <span>Synthesized Output</span>
                {runStats?.elapsed && (
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(94,232,176,0.5)", fontFamily: "JetBrains Mono, monospace" }}>
                    {(runStats.elapsed / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              <div className="tier2-synth-body">{outputText}</div>
            </div>
          )}

          <div style={{ height: 40 }} />
        </div>
    );
  };

  // ── DIRECT VIEW — zeus_protocol, poseidon, hades, gaia ────────────────────
  const renderDirect = () => {
    const DIRECT_CONFIGS = {
      zeus_protocol: { symbol: "⚡", label: "ZEUS PROTOCOL",  channel: "PRIVATE CHANNEL" },
      poseidon:      { symbol: "🔱", label: "POSEIDON",       channel: "FINANCIAL · SOCIAL" },
      hades:         { symbol: "🏛",  label: "HADES",         channel: "PHYSICAL · TECHNICAL" },
      gaia:          { symbol: "🌿", label: "GAIA",           channel: "RETROSPECTIVE · MEMORY" },
    };
    const cfg        = DIRECT_CONFIGS[mode] || DIRECT_CONFIGS.zeus_protocol;
    const isThinking = activeMission?.status === "active";

    return (
      <>
        {renderSidebar()}
        <div className="direct-area">
          <div className="direct-symbol">{cfg.symbol}</div>
          <div className="direct-agent-label">{cfg.label}</div>
          <div className="direct-channel-label">{cfg.channel}</div>
          {isThinking && !outputText && !activeMission?.streamingContent && (
            <div className="direct-thinking">processing . . .</div>
          )}
          {isThinking && !outputText && activeMission?.streamingContent && (
            <div className="direct-streaming">
              {activeMission.streamingContent}
              <span className="streaming-cursor" />
            </div>
          )}
          {outputText && (
            <div className="direct-response">{outputText}</div>
          )}
          {!activeMission && (
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "Cinzel, serif", letterSpacing: "0.15em", marginTop: 8 }}>
              Direct channel · Awaiting transmission
            </div>
          )}
        </div>
      </>
    );
  };

  // ── GAIA VIEW — Telegram conversations + framework direct ─────────────────
  const renderGaia = () => {
    const gaiaConvBelongsTo = (m, uid, nameHint) =>
      (m.userId != null && String(m.userId) === uid) ||
      (m.channel || '').toLowerCase().includes(nameHint);
    const filtered = gaiaMessages.filter(m => {
      if (gaiaTab === "CARSON") return gaiaConvBelongsTo(m, "8150818650", 'carson');
      if (gaiaTab === "TYLER")  return gaiaConvBelongsTo(m, "874345067",  'tyler');
      return true;
    });
    const isThinking = activeMission?.status === "active";

    return (
      <>
        {renderSidebar()}
        <div className="gaia-area">
          <div className="gaia-symbol">🌿</div>
          <div className="gaia-label">GAIA</div>
          <div className="gaia-sublabel">RETROSPECTIVE · MEMORY</div>

          {/* User tabs */}
          <div className="gaia-tabs">
            {["ALL", "CARSON", "TYLER"].map(tab => (
              <button
                key={tab}
                className={`sidebar-tab ${gaiaTab === tab ? "active" : ""}`}
                style={{ borderColor: gaiaTab === tab ? "var(--gaia)" : undefined, color: gaiaTab === tab ? "var(--gaia)" : undefined }}
                onClick={() => { setGaiaTab(tab); setActiveUser(tab === "ALL" ? null : tab); }}
              >{tab}</button>
            ))}
          </div>

          {/* Framework direct response if a Gaia mission is active */}
          {activeMission && !outputText && isThinking && (
            <div className="direct-thinking" style={{ marginBottom: 20 }}>processing . . .</div>
          )}
          {activeMission && outputText && (
            <div className="direct-response" style={{ marginBottom: 20 }}>{outputText}</div>
          )}

          {/* Gaia Telegram conversations from webhook */}
          <div className="gaia-messages">
            {filtered.length === 0 ? (
              <div className="gaia-empty">
                {gaiaTab === "ALL"
                  ? "Gaia's conversations will appear here as they arrive."
                  : `No ${gaiaTab} conversations from Gaia yet.`}
              </div>
            ) : (
              filtered.map((m, i) => (
                <div key={i} className="gaia-message-item">
                  <div className="gaia-msg-meta">
                    {gaiaTab === "ALL" && m.userId && (
                      <span className="gaia-msg-user">
                        {m.userId === "8150818650" ? "CARSON" : m.userId === "874345067" ? "TYLER" : m.userId}
                      </span>
                    )}
                    <span className="gaia-msg-time">{new Date(m.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="gaia-msg-question">{m.text}</div>
                  <div className="gaia-msg-response">{m.response}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    );
  };

  // ── GAIA SIDEBAR ─────────────────────────────────────────────────────────
  const renderGaiaSidebar = () => {
    const allConvs = Object.values(gaiaConversations)
      .sort((a, b) => b.timestamp - a.timestamp);
    const filtered = allConvs.filter(conv => {
      if (gaiaTab === "CARSON") return String(conv.userId) === "8150818650";
      if (gaiaTab === "TYLER")  return String(conv.userId) === "874345067";
      return true;
    });
    const lastRetro = gaiaRetrospectives[0] ?? null;

    return (
      <div className="gaia-sidebar">
        <div className="gaia-sidebar-section">
          <div className="gaia-sidebar-label">Gaia · Conversations</div>
          <div className="gaia-sidebar-tabs">
            {["ALL", "CARSON", "TYLER"].map(tab => (
              <button
                key={tab}
                className={`gaia-sidebar-tab ${gaiaTab === tab ? "active" : ""}`}
                onClick={() => { setGaiaTab(tab); setActiveUser(tab === "ALL" ? null : tab); }}
              >{tab}</button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div className="gaia-conv-empty">
              {gaiaTab === "ALL" ? "Gaia's conversations will appear here." : `No ${gaiaTab} conversations yet.`}
            </div>
          ) : (
            filtered.map(conv => {
              const firstUserMsg = conv.messages?.find(m => m.role === "user");
              const preview = firstUserMsg
                ? firstUserMsg.text.slice(0, 50) + (firstUserMsg.text.length > 50 ? "…" : "")
                : "…";
              const msgCount = conv.messages?.length ?? 0;
              const isActive = conv.id === activeGaiaConvId;
              const userLabel = conv.userId === "8150818650" ? "CARSON" : conv.userId === "874345067" ? "TYLER" : null;
              return (
                <div
                  key={conv.id}
                  className={`gaia-conv-card${isActive ? " active-conv" : ""}`}
                  onClick={() => { setActiveGaiaConvId(conv.id); setGaiaViewMode("chat"); }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                    {userLabel && (
                      <span style={{ fontSize: 9, fontFamily: "Cinzel, serif", letterSpacing: "0.08em", color: "var(--gaia)", opacity: 0.75 }}>
                        {userLabel}
                      </span>
                    )}
                    <span className="gaia-conv-card-time">{new Date(conv.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="gaia-conv-card-preview">{preview}</div>
                  <div className="gaia-conv-card-count">{msgCount} message{msgCount !== 1 ? "s" : ""}</div>
                </div>
              );
            })
          )}
        </div>
        <div className="gaia-sidebar-section" style={{ flex: 1 }}>
          <div className="gaia-sidebar-label">Gaia — Last Retrospective</div>
          {lastRetro ? (
            <>
              <div style={{ fontSize: 10, color: "var(--gaia)", opacity: 0.65, fontFamily: "Cinzel, serif", letterSpacing: "0.08em", marginBottom: 7 }}>
                {new Date(lastRetro.timestamp).toLocaleString()} · {lastRetro.missions_reviewed} missions
              </div>
              <div style={{ fontSize: 11, color: "rgba(148,188,148,0.72)", lineHeight: 1.75 }}>
                {lastRetro.text.slice(0, 230)}{lastRetro.text.length > 230 ? "…" : ""}
              </div>
            </>
          ) : gaiaReport ? (
            <>
              <div style={{ fontSize: 10, color: "var(--gaia)", opacity: 0.65, fontFamily: "Cinzel, serif", letterSpacing: "0.08em", marginBottom: 7 }}>
                GAIA · {gaiaReport.timestamp}
              </div>
              <div style={{ fontSize: 11, color: "rgba(148,188,148,0.72)", lineHeight: 1.75 }}>
                {gaiaReport.text}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: "rgba(120,216,122,0.22)", lineHeight: 1.75, fontStyle: "italic" }}>
              Gaia's nightly retrospective will appear here at 23:00.
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── GAIA TREE VIEW — Tree of Olympus ──────────────────────────────────────
  const renderGaiaTree = () => {
    const directiveGroups = {};
    for (const msg of gaiaDirectiveFeed) {
      if (!directiveGroups[msg.id]) directiveGroups[msg.id] = [];
      directiveGroups[msg.id].push(msg);
    }
    const directiveThreads = Object.values(directiveGroups).reverse().slice(0, 5);
    const selDef = selectedFruit ? FRUIT_DEFS.find(f => f.id === selectedFruit) : null;

    return (
      <>
        {renderGaiaSidebar()}

        {/* Center — toggle + tree or chat */}
        <div className="gaia-canvas-center">
          {/* View toggle + NEW CHAT */}
          <div className="gaia-view-toggle-bar" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="gaia-view-toggle">
              <button
                className={`gaia-toggle-btn ${gaiaViewMode === "tree" ? "active" : ""}`}
                onClick={() => setGaiaViewMode("tree")}
              >🌳 TREE</button>
              <button
                className={`gaia-toggle-btn ${gaiaViewMode === "chat" ? "active" : ""}`}
                onClick={() => setGaiaViewMode("chat")}
              >🌿 CHAT</button>
              <button
                className={`gaia-toggle-btn ${gaiaViewMode === "council" ? "active" : ""}`}
                onClick={() => setGaiaViewMode("council")}
              >⚖ COUNCIL</button>
            </div>
            {gaiaViewMode === "chat" && (
              <button
                className="gaia-new-chat-btn"
                onClick={() => {
                  setActiveGaiaConvId(null);
                  setGaiaThinking(false);
                  setGaiaPendingText("");
                }}
                title="Start a new conversation"
              >NEW CHAT</button>
            )}
          </div>

          {gaiaViewMode === "tree" ? (
            <GaiaTree
              fruitRipeness={fruitRipeness}
              activePulses={activePulses}
              selectedFruit={selectedFruit}
              onFruitClick={setSelectedFruit}
              sshCtrlPulse={sshCtrlPulse}
            />
          ) : gaiaViewMode === "council" ? (
            /* Council mode — OLYMPUS CHANNEL two-sided thread */
            <div className="gaia-council-view">
              {(() => {
                const directiveGroups = {};
                for (const msg of gaiaDirectiveFeed) {
                  if (!directiveGroups[msg.id]) directiveGroups[msg.id] = [];
                  directiveGroups[msg.id].push(msg);
                }
                const threads = Object.values(directiveGroups);
                if (threads.length === 0 && !gaiaCouncilSending) {
                  return (
                    <div className="gaia-council-empty">
                      <div style={{ fontSize: 28, marginBottom: 10 }}>⚖</div>
                      <div style={{ fontSize: 14, letterSpacing: "0.15em" }}>OLYMPUS CHANNEL · OPEN</div>
                      <div style={{ opacity: 0.45, marginTop: 8, fontSize: 13 }}>
                        Send a message to initiate a council conversation
                      </div>
                    </div>
                  );
                }
                return (
                  <>
                    {threads.map((thread, ti) => (
                      <div key={ti} className="gaia-council-exchange">
                        {thread.map((msg, mi) => (
                          <div key={mi} className={`gaia-council-msg ${msg.speaker === "gaia" ? "gaia-left" : "council-right"}`}>
                            <div className={`gaia-council-speaker ${msg.speaker}`}>{msg.speaker.toUpperCase()}</div>
                            <div className="gaia-council-text">{msg.text}</div>
                            <div className="gaia-council-meta">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              {" · "}{msg.phase?.replace(/_/g, " ")}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                    {gaiaCouncilSending && (
                      <div className="gaia-council-msg gaia-left">
                        <div className="gaia-council-speaker gaia">GAIA</div>
                        <div className="gaia-chat-thinking">
                          <span className="gaia-thinking-dot" />
                          <span className="gaia-thinking-dot" />
                          <span className="gaia-thinking-dot" />
                          <span style={{ marginLeft: 8, opacity: 0.7, fontSize: 13 }}>Opening the OLYMPUS CHANNEL…</span>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            /* Chat mode */
            <div className="gaia-chat-view">
              <div className="gaia-chat-messages" ref={gaiaChatRef}>
                {(() => {
                  const activeGaiaConv = gaiaConversations[activeGaiaConvId];
                  const messages = activeGaiaConv?.messages ?? [];
                  const userLabel = activeGaiaConv?.userId === "8150818650" ? "CARSON"
                    : activeGaiaConv?.userId === "874345067" ? "TYLER" : "YOU";

                  if (messages.length === 0 && !gaiaThinking) {
                    return (
                      <div className="gaia-chat-empty">
                        <div style={{ fontSize: 32, marginBottom: 12 }}>🌿</div>
                        <div>Send a message to begin your conversation with Gaia</div>
                      </div>
                    );
                  }

                  return (
                    <>
                      {messages.map((msg, i) => (
                        msg.role === "user" ? (
                          <div key={i} className="gaia-chat-entry" style={{ marginBottom: 0 }}>
                            <div className="gaia-chat-user-label">
                              {userLabel} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                            <div className="gaia-chat-user-msg">{msg.text}</div>
                          </div>
                        ) : (
                          <div key={i} className="gaia-chat-entry">
                            <div className="gaia-chat-gaia-label">🌿 GAIA</div>
                            <div className="gaia-chat-gaia-msg">{msg.text}</div>
                          </div>
                        )
                      ))}
                      {gaiaThinking && (
                        <div className="gaia-chat-entry">
                          <div className="gaia-chat-user-label">{userLabel}</div>
                          <div className="gaia-chat-user-msg">{gaiaPendingText}</div>
                          <div className="gaia-chat-thinking">
                            <span className="gaia-thinking-dot" /><span className="gaia-thinking-dot" /><span className="gaia-thinking-dot" />
                            <span style={{ marginLeft: 8, opacity: 0.7 }}>Gaia is contemplating…</span>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Right panel — always visible: OLYMPUS CHANNEL or fruit detail */}
        <div className="gaia-right-panel">
          {selDef ? (
            /* Fruit detail */
            <>
              <div className="gaia-panel-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24, filter: `drop-shadow(0 0 10px ${selDef.color})` }}>{selDef.symbol}</span>
                  <div>
                    <div className="gaia-panel-title" style={{ color: selDef.color }}>{selDef.label}</div>
                    <div className="gaia-panel-subtitle">{FRUIT_INFO[selectedFruit]?.domain}</div>
                  </div>
                </div>
                <button className="fruit-panel-close" onClick={() => setSelectedFruit(null)}>✕</button>
              </div>
              <div className="gaia-panel-body">
                <FruitDetailContent
                  fruitId={selectedFruit}
                  ripeness={fruitRipeness[selectedFruit] || 0}
                  growthHistory={gaiaGrowthHistory[selectedFruit] || []}
                />
              </div>
            </>
          ) : (
            /* OLYMPUS CHANNEL */
            <>
              <div className="gaia-panel-header">
                <div>
                  <div className="gaia-panel-title">OLYMPUS CHANNEL</div>
                  <div className="gaia-panel-subtitle">Gaia ↔ Council · Live Feed</div>
                </div>
              </div>
              <div className="gaia-channel-tabs">
                {["DIRECTIVES", "RETROSPECTIVE", "CONVERSATIONS", "SSH CTRL"].map(tab => (
                  <button key={tab} className={`gaia-feed-tab ${gaiaFeedTab === tab ? "active" : ""}${tab === "SSH CTRL" && gaiaSSHLog.length > 0 ? " ssh-tab-active" : ""}`}
                    onClick={() => setGaiaFeedTab(tab)}>{tab}</button>
                ))}
              </div>
              <div className="gaia-panel-body">

                {/* DIRECTIVES */}
                {gaiaFeedTab === "DIRECTIVES" && (
                  directiveThreads.length === 0
                    ? <div className="gaia-feed-empty">GAIA · WATCHING THE COUNCIL</div>
                    : directiveThreads.map((thread, ti) => (
                      <div key={ti} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(120,216,122,0.08)" }}>
                        {thread.map((msg, mi) => (
                          <div key={mi} className={`olympus-msg ${msg.speaker === "gaia" ? "gaia-side" : "council-side"}`}>
                            <div className={`gaia-feed-speaker ${msg.speaker}`}>{msg.speaker.toUpperCase()}</div>
                            <div className="gaia-feed-text">{msg.text.slice(0, 260)}{msg.text.length > 260 ? "…" : ""}</div>
                            <div className="gaia-feed-meta">{new Date(msg.timestamp).toLocaleTimeString()} · {msg.phase?.replace(/_/g, " ")}</div>
                          </div>
                        ))}
                      </div>
                    ))
                )}

                {/* RETROSPECTIVE */}
                {gaiaFeedTab === "RETROSPECTIVE" && (
                  gaiaRetrospectives.length === 0
                    ? <div className="gaia-feed-empty">NIGHTLY RETROSPECTIVES · 23:00</div>
                    : gaiaRetrospectives.slice(0, 5).map((r, i) => (
                      <div key={i} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(120,216,122,0.07)" }}>
                        <div className="gaia-feed-meta" style={{ color: "var(--gaia)", marginBottom: 6 }}>
                          {new Date(r.timestamp).toLocaleString()} · {r.missions_reviewed} missions reviewed
                        </div>
                        <div className="gaia-feed-text">{r.text.slice(0, 450)}{r.text.length > 450 ? "…" : ""}</div>
                      </div>
                    ))
                )}

                {/* CONVERSATIONS */}
                {gaiaFeedTab === "CONVERSATIONS" && (
                  gaiaMessages.length === 0
                    ? <div className="gaia-feed-empty">GAIA'S CONVERSATIONS APPEAR HERE</div>
                    : gaiaMessages.slice(0, 10).map((m, i) => (
                      <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(120,216,122,0.07)" }}>
                        <div className="gaia-feed-text" style={{ color: "var(--muted)", marginBottom: 4 }}>
                          {m.text.slice(0, 90)}{m.text.length > 90 ? "…" : ""}
                        </div>
                        <div className="gaia-feed-text">{m.response.slice(0, 220)}{m.response.length > 220 ? "…" : ""}</div>
                        <div className="gaia-feed-meta" style={{ marginTop: 4 }}>
                          {new Date(m.timestamp).toLocaleTimeString()} · {m.channel}
                        </div>
                      </div>
                    ))
                )}

                {/* SSH CTRL — intervention log */}
                {gaiaFeedTab === "SSH CTRL" && (
                  gaiaSSHLog.length === 0
                    ? <div className="gaia-feed-empty">NO INTERVENTIONS · SYSTEMS NOMINAL</div>
                    : gaiaSSHLog.map((entry, i) => (
                      <div key={i} className={`gaia-ssh-entry ${entry.ok ? "ok" : "failed"}`}>
                        <div className="gaia-ssh-header">
                          <span className={`gaia-ssh-status ${entry.ok ? "ok" : "failed"}`}>{entry.ok ? "✓" : "✗"}</span>
                          <span className="gaia-ssh-node">{entry.node.toUpperCase()}</span>
                          <span className="gaia-ssh-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="gaia-ssh-command"><code>{entry.command}</code></div>
                        <div className="gaia-ssh-reason">{entry.reason}</div>
                        <div className="gaia-ssh-result">{entry.result.slice(0, 200)}{entry.result.length > 200 ? "…" : ""}</div>
                      </div>
                    ))
                )}
              </div>
            </>
          )}
        </div>
      </>
    );
  };

  // ── Route to correct view ──────────────────────────────────────────────────

  // ── Cinematic Takeover Render ──────────────────────────────────────────────
  const renderCinematicTakeover = () => {
    if (!cinematicOpen || !activeMission) return null;

    const tierLabel = activeMission.tier === "TIER_1" ? "TIER I"
                    : activeMission.tier === "TIER_2" ? "TIER II"
                    : (activeMission.tier || "TIER");

    // Reuse the canonical Tier 2 view (full B3C pipeline + quorum panels) for the left panel
    const leftContent = renderTier2();

    return (
      <div className="cinematic-takeover">
        <button className="cinematic-exit" onClick={() => setCinematicOpen(false)}>\u2715 EXIT</button>

        {/* LEFT PANEL \u2014 existing flow/tier view, resized to fit */}
        <div className="cinematic-left">
          <div className="cinematic-tier-badge">
            <span className="tier-label">{tierLabel}</span>
            <span className="cinematic-mission-text">{activeRequest?.text || "Mission active"}</span>
          </div>
          <div className="cinematic-flow-wrap">
            {leftContent}
          </div>
        </div>

        {/* RIGHT PANEL \u2014 council conversation */}
        <div className="cinematic-right">
          <div className="cinematic-right-header">COUNCIL DELIBERATION</div>

          <div className="cinematic-council-section" ref={cinematicCouncilRef}>
            {councilMessages.length > 0 && (
              <>
                <div className="cinematic-phase-label">INITIAL COUNCIL</div>
                <VoteStamps messages={councilMessages} missionId={activeMissionId} />
                <CouncilThread messages={councilMessages} />
              </>
            )}

            {councilBackendMessages.length > 0 && (
              <>
                <div className="cinematic-phase-label" style={{ marginTop: 20 }}>BACKEND REVIEW</div>
                <VoteStamps messages={councilBackendMessages} missionId={activeMissionId} />
                <CouncilThread messages={councilBackendMessages} />
              </>
            )}

            {councilMessages.length === 0 && councilBackendMessages.length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: 12, textAlign: "center", marginTop: 40 }}>
                Council has not convened yet...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderModeView = () => {
    if (gaiaMode) return renderGaiaTree();
    switch (mode) {
      case "classifying":   return <>{renderSidebar()}<CouncilChamber nodeHealth={nodeHealth} classifying /></>;
      case "tier1":         return renderTier1();
      case "tier2":         return renderTier2();
      case "zeus_protocol": return renderDirect();
      case "poseidon":      return renderDirect();
      case "hades":         return renderDirect();
      default:              return renderTier2();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{FONTS + css}</style>
      <div className={`dashboard mode-${effectiveMode}`}>
        <StarField />

        {/* Cinematic takeover for T2/T3 */}
        {renderCinematicTakeover()}

        {/* Topbar */}
        <div className="topbar">
          <div className="logo">
            <span className="logo-mark">⚡</span>
            MOUNT OLYMPUS
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Top-mode toggle */}
            <div className="top-toggle">
              {["council", "olympus", "record"].map(v => (
                <button
                  key={v}
                  className={`top-toggle-btn ${topView === v ? "active" : ""}`}
                  onClick={() => {
                    if (v === "record" && topView !== "record") {
                      if (!gaiaMode) toggleGaiaMode();
                    } else if (v !== "record" && gaiaMode) {
                      toggleGaiaMode();
                    }
                    setTopView(v);
                  }}
                >{v.toUpperCase()}</button>
              ))}
            </div>

            {/* Node health dropdown trigger */}
            <div ref={nodeHealthRef} style={{ position: "relative" }}>
              <button
                className="node-health-btn"
                onClick={() => setNodeHealthOpen(o => !o)}
              >NODE HEALTH {nodeHealthOpen ? "▴" : "▾"}</button>

              {nodeHealthOpen && (
                <div className="node-health-expanded">
                  {["ZEUS", "POSEIDON", "HADES", "GAIA"].map(n => {
                    const headStatus = nodeHealth[n] === true ? "online" : nodeHealth[n] === false ? "offline" : "";
                    const quorum = QUORUM_MAP[n] || [];
                    return (
                      <div key={n} className="node-health-group">
                        <div className="node-health-head">
                          <div className={`node-chip ${headStatus}`}>
                            <span className="dot" />
                            {n}
                          </div>
                        </div>
                        {quorum.length > 0 && (
                          <div className="quorum-row">
                            {quorum.map(q => {
                              // Prefer real smoke test result for this spark when available,
                              // fall back to the parent head's reachability status.
                              const smoke = smokeTestResults?.[n.toLowerCase()]?.[q];
                              const chipStatus = smoke
                                ? (smoke.ok ? "online" : "offline")
                                : headStatus;
                              const title = smoke
                                ? (smoke.ok ? `${q} — ok (${smoke.latency_ms ?? "?"}ms)` : `${q} — failed`)
                                : undefined;
                              return (
                                <div key={q} className={`quorum-chip ${chipStatus}`} title={title}>
                                  <span className="dot" />
                                  {q.toUpperCase()}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* WebSocket status */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 4, background: "var(--bg3)", border: `1px solid ${wsStatus === "live" ? "rgba(94,232,176,0.3)" : wsStatus === "connecting" ? "rgba(240,192,96,0.3)" : "rgba(255,80,80,0.3)"}`, fontSize: 11, letterSpacing: "0.1em", color: wsStatus === "live" ? "var(--done)" : wsStatus === "connecting" ? "var(--active)" : "#ff5050" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: wsStatus === "live" ? "var(--done)" : wsStatus === "connecting" ? "var(--active)" : "#ff5050", boxShadow: wsStatus === "live" ? "0 0 5px var(--done)" : "none", animation: wsStatus === "live" ? "pulse-dot 2s ease infinite" : "none" }} />
              {wsStatus === "live" ? "LIVE" : wsStatus === "connecting" ? "CONNECTING" : "DISCONNECTED"}
            </div>
            <div className="topbar-time">{time} · LOCAL</div>
          </div>
        </div>

        {/* Mode canvas — routed by topView */}
        {topView === "council" && (
          <div className="main-canvas" key={effectiveMode}>
            {renderModeView()}
          </div>
        )}

        {topView === "olympus" && <OlympusView />}

        {topView === "record" && (
          <div className="main-canvas" key="record">
            {renderGaiaTree()}
          </div>
        )}

        {/* Input bar */}
        <div className={`input-bar${gaiaMode ? " gaia-input-bar" : ""}`}>
          <div className="input-inner">
            <div className="input-unified">
              <textarea
                className="input-textarea"
                placeholder={
                  gaiaMode && gaiaViewMode === "council" ? "Open the OLYMPUS CHANNEL — address the B3C Council…" :
                  gaiaMode                ? "Speak to Gaia — she is listening..." :
                  mode === "zeus_protocol" ? "Transmit to Zeus directly..." :
                  mode === "poseidon"      ? "Speak to Poseidon..." :
                  mode === "hades"         ? "Speak to Hades..." :
                  mode === "tier1"         ? "Ask Zeus directly..." :
                  "Enter a request for the council..."
                }
                value={sendText}
                onChange={e => setSendText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) gaiaMode ? handleGaiaSend() : handleSend(); }}
                disabled={sending}
              />
              <div className="input-controls">
                {!gaiaMode && (
                  <div className="route-selector">
                    <button className="route-current" onClick={() => setRouteOpen(o => !o)} disabled={sending}>
                      <span className={`route-chevron ${routeOpen ? "open" : ""}`}>▾</span>
                      {({B3C_COUNCIL:"B3C COUNCIL",ZEUS_PROTOCOL:"ZEUS PROTOCOL",POSEIDON:"POSEIDON",HADES:"HADES"})[sendTarget] || "B3C COUNCIL"} → {activeUser || "ALL"}
                    </button>
                    {routeOpen && (
                      <div className="route-dropdown">
                        {[
                          { id: "B3C_COUNCIL",   label: "B3C COUNCIL" },
                          { id: "ZEUS_PROTOCOL", label: "ZEUS PROTOCOL" },
                          { id: "POSEIDON",      label: "POSEIDON" },
                          { id: "HADES",         label: "HADES" },
                        ].map(t => (
                          <button
                            key={t.id}
                            className={`route-option ${sendTarget === t.id ? "active" : ""}`}
                            onClick={() => { setSendTarget(t.id); setRouteOpen(false); }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button
                  className={`user-context-btn ${activeUser ? "user-active" : "user-none"}`}
                  onClick={() => setActiveUser(u => u === null ? "CARSON" : u === "CARSON" ? "TYLER" : null)}
                  title="Active user — click to cycle"
                >
                  {activeUser ? `· ${activeUser}` : "· ALL USERS"}
                </button>
                {!gaiaMode && (
                  <button
                    className={`priority-btn ${sendPriority ? "active" : ""}`}
                    onClick={() => setSendPriority(p => !p)}
                    title="Priority — Zeus evaluates whether this mission should jump the queue"
                  >⚡ PRIORITY</button>
                )}
                <button
                  className={`send-arrow${gaiaMode ? " gaia-send-btn" : ""} ${sending ? "sending" : ""}`}
                  onClick={gaiaMode ? handleGaiaSend : handleSend}
                  disabled={sending || !sendText.trim()}
                  title={sending ? "Sending..." : "Send"}
                >
                  {sending ? "·" : "↑"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
