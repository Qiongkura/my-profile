/*! netease-music-parser v0.1.0 | MIT | https://github.com/Qiongkura/netease-music-parser */
var NeteaseMusic = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.js
  var index_exports = {};
  __export(index_exports, {
    DEFAULT_RISK_RETRIES: () => DEFAULT_RISK_RETRIES,
    NeteaseApiError: () => NeteaseApiError,
    OFFICIAL_BASE: () => OFFICIAL_BASE,
    RESOURCE_TYPES: () => RESOURCE_TYPES,
    TYPE_LABELS: () => TYPE_LABELS,
    VERSION: () => VERSION2,
    autoInit: () => autoInit,
    buildWebUrl: () => buildWebUrl,
    clearPlayback: () => clearPlayback,
    createClient: () => createClient,
    default: () => index_default,
    formatCount: () => formatCount,
    formatDuration: () => formatDuration,
    getDefaultClient: () => getDefaultClient,
    highlightLyric: () => highlightLyric,
    injectStyles: () => injectStyles,
    isMediaSessionSupported: () => isMediaSessionSupported,
    isRiskControlResponse: () => isRiskControlResponse,
    load: () => load,
    looksLikeShare: () => looksLikeShare,
    lyric: () => lyric_exports,
    mount: () => mount,
    normalize: () => normalize_exports,
    parseShare: () => parseShare,
    parseUrl: () => parseUrl,
    readPlayback: () => readPlayback,
    render: () => render,
    renderError: () => renderError,
    renderLyrics: () => renderLyrics,
    renderSkeleton: () => renderSkeleton,
    resumeBar: () => resumeBar,
    resumeLastPlayback: () => resumeLastPlayback,
    savePlayback: () => savePlayback,
    setDefaultClient: () => setDefaultClient,
    setLyricsState: () => setLyricsState,
    showNotice: () => showNotice,
    unmount: () => unmount
  });

  // src/utils.js
  function formatDuration(ms) {
    const total = Math.floor(Number(ms) / 1e3);
    if (!Number.isFinite(total) || total < 0) return "--:--";
    const h = Math.floor(total / 3600);
    const m = Math.floor(total % 3600 / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }
  function formatCount(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return "0";
    if (num >= 1e8) return `${(num / 1e8).toFixed(1).replace(/\.0$/, "")}\u4EBF`;
    if (num >= 1e4) return `${(num / 1e4).toFixed(1).replace(/\.0$/, "")}\u4E07`;
    return String(num);
  }
  function formatDate(ts) {
    const d = new Date(Number(ts));
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function withImageSize(url, size = 300) {
    if (!url || typeof url !== "string") return "";
    const base = url.split("?")[0];
    return `${base}?param=${size}y${size}`;
  }
  function buildQuery(params = {}) {
    const parts = [];
    for (const [key, value] of Object.entries(params)) {
      if (value === void 0 || value === null || value === "") continue;
      const encoded = encodeURIComponent(typeof value === "object" ? JSON.stringify(value) : String(value));
      parts.push(`${encodeURIComponent(key)}=${encoded}`);
    }
    return parts.join("&");
  }
  function escapeHtml(text) {
    return String(text != null ? text : "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);
  }
  function joinArtists(artists) {
    if (typeof artists === "string") return artists.trim() || "\u672A\u77E5\u6B4C\u624B";
    if (!Array.isArray(artists) || artists.length === 0) return "\u672A\u77E5\u6B4C\u624B";
    return artists.map((a) => typeof a === "string" ? a : a == null ? void 0 : a.name).filter(Boolean).join(" / ") || "\u672A\u77E5\u6B4C\u624B";
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // src/parser.js
  var TYPE_LABELS = {
    song: "\u5355\u66F2",
    playlist: "\u6B4C\u5355",
    album: "\u4E13\u8F91",
    artist: "\u6B4C\u624B",
    djradio: "\u7535\u53F0",
    program: "\u58F0\u97F3",
    mv: "MV",
    video: "\u89C6\u9891",
    user: "\u7528\u6237",
    short: "\u77ED\u94FE"
  };
  var RESOURCE_TYPES = Object.keys(TYPE_LABELS);
  var HOST_PATTERN = /(^|\.)(music\.163\.com|163cn\.tv|163\.com)$/i;
  var URL_PATTERN = /(?:https?:\/\/[^\s"'<>()（）【】,，、]+)|(?:music\.163\.com\/[^\s"'<>()（）【】,，、]+)|(?:163cn\.tv\/[^\s"'<>()（）【】,，、]+)/gi;
  var PATH_RULES = [
    { type: "song", re: /^\/(?:#\/)?m?\/?song\/(\d+)/i },
    { type: "song", re: /^\/(?:#\/)?m?\/?song(?:\/)?$/i },
    { type: "song", re: /^\/song\/media\/outer\/url$/i },
    { type: "playlist", re: /^\/(?:#\/)?(?:m\/)?playlist\/(\d+)/i },
    { type: "playlist", re: /^\/(?:#\/)?(?:m\/)?playlist(?:\/)?$/i },
    { type: "playlist", re: /^\/discover\/toplist$/i },
    { type: "album", re: /^\/(?:#\/)?(?:m\/)?album\/(\d+)/i },
    { type: "album", re: /^\/(?:#\/)?(?:m\/)?album(?:\/)?$/i },
    { type: "artist", re: /^\/(?:#\/)?(?:m\/)?artist\/(\d+)/i },
    { type: "artist", re: /^\/(?:#\/)?(?:m\/)?artist(?:\/)?$/i },
    { type: "djradio", re: /^\/(?:#\/)?(?:m\/)?djradio\/(\d+)/i },
    { type: "djradio", re: /^\/(?:#\/)?(?:m\/)?djradio(?:\/)?$/i },
    { type: "program", re: /^\/(?:#\/)?(?:m\/)?program\/(\d+)/i },
    { type: "program", re: /^\/(?:#\/)?(?:m\/)?program(?:\/)?$/i },
    { type: "mv", re: /^\/(?:#\/)?(?:m\/)?mv\/(\d+)/i },
    { type: "mv", re: /^\/(?:#\/)?(?:m\/)?mv(?:\/)?$/i },
    { type: "video", re: /^\/(?:#\/)?(?:m\/)?video\/(\d+)/i },
    { type: "video", re: /^\/(?:#\/)?(?:m\/)?video(?:\/)?$/i },
    { type: "user", re: /^\/(?:#\/)?user\/home$/i },
    { type: "user", re: /^\/(?:#\/)?user\/(\d+)/i }
  ];
  var SHARE_HINTS = [
    { type: "song", re: /分享(?:单曲|歌曲)/ },
    { type: "playlist", re: /分享(?:歌单|播单)/ },
    { type: "album", re: /分享专辑/ },
    { type: "artist", re: /分享歌手/ },
    { type: "djradio", re: /分享电台/ },
    { type: "program", re: /分享(?:节目|声音)/ },
    { type: "mv", re: /分享MV/i },
    { type: "video", re: /分享视频/ }
  ];
  function parseQuery(str) {
    const out = {};
    if (!str) return out;
    for (const pair of String(str).replace(/^[?#]/, "").split("&")) {
      if (!pair) continue;
      const idx = pair.indexOf("=");
      const key = idx === -1 ? pair : pair.slice(0, idx);
      const value = idx === -1 ? "" : pair.slice(idx + 1);
      try {
        out[decodeURIComponent(key)] = decodeURIComponent(value);
      } catch {
        out[key] = value;
      }
    }
    return out;
  }
  function withScheme(url) {
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }
  function parseUrl(rawUrl) {
    if (!rawUrl) return null;
    let url;
    try {
      url = new URL(withScheme(String(rawUrl).trim()));
    } catch {
      return null;
    }
    if (!HOST_PATTERN.test(url.hostname)) return null;
    if (/^163cn\.tv$/i.test(url.hostname)) {
      const code = url.pathname.replace(/^\/+/, "").split("/")[0];
      if (!code) return null;
      return { type: "short", id: code, url: `https://163cn.tv/${code}`, short: true };
    }
    const hash = url.hash.replace(/^#/, "");
    const hashQueryIndex = hash.indexOf("?");
    const hashPath = hashQueryIndex === -1 ? hash : hash.slice(0, hashQueryIndex);
    const hashQuery = hashQueryIndex === -1 ? "" : hash.slice(hashQueryIndex + 1);
    const fullPath = (url.pathname + (hashPath.startsWith("/") ? hashPath : "")).replace(/\/{2,}/g, "/");
    const query = { ...parseQuery(url.search), ...parseQuery(hashQuery) };
    const fallbackId = query.id || query.songid || query.playlistId || query.albumId || "";
    for (const rule of PATH_RULES) {
      const match = fullPath.match(rule.re);
      if (!match) continue;
      const id = match[1] || fallbackId;
      if (!id || !/^\d+$/.test(String(id))) continue;
      return { type: rule.type, id: String(id), url: url.href };
    }
    if (fallbackId && /^\d+$/.test(String(fallbackId))) {
      return { type: "", id: String(fallbackId), url: url.href, ambiguous: true };
    }
    return null;
  }
  function extractTitleHint(text) {
    const src = String(text != null ? text : "");
    const beforeParen = src.split(/[(（]/)[0] || "";
    const cleaned = beforeParen.replace(/分享(?:单曲|歌曲|歌单|播单|专辑|歌手|电台|节目|声音|视频)/g, "").replace(/^[\s:：\-—]+/, "").trim();
    return cleaned || "";
  }
  function extractTypeHint(text) {
    const src = String(text != null ? text : "");
    for (const hint of SHARE_HINTS) {
      if (hint.re.test(src)) return hint.type;
    }
    return "";
  }
  function parseShare(input, options = {}) {
    const raw = String(input != null ? input : "");
    const text = raw.trim();
    const titleHint = extractTitleHint(text);
    const typeHint = extractTypeHint(text);
    const empty = {
      raw,
      resources: [],
      primary: null,
      titleHint,
      typeHint,
      kind: "empty"
    };
    if (!text) return empty;
    const seen = /* @__PURE__ */ new Set();
    const resources = [];
    for (const candidate of text.match(URL_PATTERN) || []) {
      const hit = parseUrl(candidate);
      if (!hit) continue;
      const key = `${hit.type}:${hit.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      resources.push(hit);
    }
    if (resources.length > 0) {
      let primary = resources[0];
      if (typeHint) {
        const better = resources.find((r) => r.type === typeHint);
        if (better) primary = better;
      }
      if (primary.ambiguous && typeHint) primary = { ...primary, type: typeHint };
      return { raw, resources, primary, titleHint, typeHint, kind: "url" };
    }
    const bareId = text.match(/^(\d{4,})$/);
    if (bareId) {
      const type = options.type || typeHint || "";
      const hit = { type, id: bareId[1], url: "", ambiguous: !type };
      return {
        raw,
        resources: [hit],
        primary: hit,
        titleHint,
        typeHint,
        kind: "id"
      };
    }
    return { ...empty, kind: "invalid" };
  }
  function looksLikeShare(input) {
    return parseShare(input).resources.length > 0;
  }
  function buildWebUrl(type, id) {
    if (type === "short") return `https://163cn.tv/${id}`;
    if (!type || !id) return "";
    if (type === "user") return `https://music.163.com/#/user/home?id=${id}`;
    return `https://music.163.com/#/${type}?id=${id}`;
  }

  // src/adapters.js
  function officialAdapter({ get }) {
    return {
      name: "official",
      song: (id) => get("/song", { id }),
      songUrl: (id, br = 32e4) => get("/song/url", { id, br }),
      lyric: (id) => get("/lyric", { id }),
      playlist: (id, limit = 1e3) => get("/playlist", { id, limit }),
      album: (id) => get("/album", { id }),
      artist: (id) => get("/artist", { id }),
      program: (id) => get("/program", { id }),
      djradio: (id, limit = 100) => get("/djradio", { id, limit }),
      search: (q, type = 1, limit = 30) => get("/search", { q, type, limit }),
      resolve: (url) => get("/resolve", { url })
    };
  }
  function digPlayUrl(raw) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!raw) return "";
    if (typeof raw === "string") return /^https?:\/\//.test(raw) ? raw : "";
    const candidates = [
      raw.url,
      (_a = raw.data) == null ? void 0 : _a.url,
      (_b = raw.song) == null ? void 0 : _b.url,
      (_d = (_c = raw.data) == null ? void 0 : _c[0]) == null ? void 0 : _d.url,
      (_g = (_f = (_e = raw.result) == null ? void 0 : _e.data) == null ? void 0 : _f[0]) == null ? void 0 : _g.url,
      (_h = raw.result) == null ? void 0 : _h.url
    ];
    return candidates.find((u) => typeof u === "string" && /^https?:\/\//.test(u)) || "";
  }
  function digSong(raw) {
    var _a;
    if (!raw) return null;
    if (Array.isArray(raw)) return raw[0] || null;
    return raw.song || ((_a = raw.data) == null ? void 0 : _a.song) || raw.data || raw;
  }
  function neteaseUrlAdapter({ get, post }, options = {}) {
    const quality = options.quality || "exhigh";
    const downloadPath = options.downloadPath || "/download";
    const useDownload = options.useDownload !== false;
    const base = (options.apiBase || "").replace(/\/+$/, "");
    async function resolvePlayUrl(id) {
      let direct = "";
      try {
        direct = digPlayUrl(await post("/song", { id: String(id), quality }));
      } catch {
      }
      if (direct) return direct;
      if (useDownload && base) {
        return `${base}${downloadPath}?id=${encodeURIComponent(id)}&quality=${encodeURIComponent(quality)}`;
      }
      return "";
    }
    const unsupported = (feature) => async () => {
      throw new Error(
        `Netease_url \u540E\u7AEF\u6CA1\u6709\u63D0\u4F9B\u300C${feature}\u300D\u63A5\u53E3\uFF0C\u8BF7\u6362\u56DE official \u9002\u914D\u5668\uFF08\u81EA\u5E26 proxy/\uFF09\uFF0C\u6216\u8005\u81EA\u5DF1\u5B9E\u73B0\u8FD9\u4E2A\u65B9\u6CD5`
      );
    };
    return {
      name: "netease-url",
      quality,
      song: async (id) => {
        const raw = await post("/song", { id: String(id), quality });
        const url = digPlayUrl(raw);
        const song = digSong(raw);
        if (song && url && !digPlayUrl(song)) return { ...song, playUrl: url };
        return song != null ? song : raw;
      },
      songUrl: async (id) => {
        const url = await resolvePlayUrl(id);
        return {
          data: [
            {
              id: Number(id),
              url: url || null,
              br: url ? 32e4 : 0,
              free: Boolean(url),
              reason: url ? "" : "Netease_url \u6CA1\u8FD4\u56DE\u53EF\u64AD\u653E\u5730\u5740\uFF0C\u68C0\u67E5\u5B83\u7684 cookie.txt \u662F\u4E0D\u662F\u9ED1\u80F6\u4F1A\u5458"
            }
          ],
          code: 200
        };
      },
      playlist: (id) => post("/playlist", { id: String(id) }),
      album: (id) => post("/album", { id: String(id) }),
      search: async (q, _type, limit = 30) => {
        var _a;
        const raw = await post("/search", { keywords: q, limit });
        const list = Array.isArray(raw) ? raw : (raw == null ? void 0 : raw.songs) || ((_a = raw == null ? void 0 : raw.result) == null ? void 0 : _a.songs) || [];
        return { result: { songs: list, songCount: list.length } };
      },
      // 短链 / 普通链接都在本地解析，不需要后端参与
      resolve: async (url) => {
        const hit = parseUrl(url);
        if (!hit) throw new Error("\u4E0D\u662F\u7F51\u6613\u4E91\u97F3\u4E50\u7684\u94FE\u63A5");
        if (hit.short) {
          throw new Error("Netease_url \u4E0D\u63D0\u4F9B\u77ED\u94FE\u89E3\u6790\uFF0C\u8BF7\u5728 official \u540E\u7AEF\u4E0A\u5148\u89E3\u6790\uFF0C\u6216\u8005\u76F4\u63A5\u7C98\u8D34\u5B8C\u6574\u94FE\u63A5");
        }
        return { type: hit.type, id: hit.id, url: hit.url };
      },
      lyric: unsupported("\u6B4C\u8BCD"),
      artist: unsupported("\u6B4C\u624B"),
      program: unsupported("\u58F0\u97F3"),
      djradio: unsupported("\u7535\u53F0")
    };
  }
  var ADAPTERS = {
    official: officialAdapter,
    "netease-url": neteaseUrlAdapter,
    neteaseUrl: neteaseUrlAdapter
  };

  // src/api.js
  var OFFICIAL_BASE = "https://music.163.com";
  var DEFAULT_RISK_RETRIES = 2;
  var RISK_RETRY_BASE_DELAY = 350;
  function isRiskControlResponse(status, data) {
    var _a;
    if (data && typeof data === "object") {
      if (data.code === -462) return true;
      if (((_a = data.data) == null ? void 0 : _a.verifyType) || data.verifyType) return true;
    }
    return status === 429;
  }
  var NeteaseApiError = class extends Error {
    constructor(message, { status = 0, body = null, url = "" } = {}) {
      super(message);
      this.name = "NeteaseApiError";
      this.status = status;
      this.body = body;
      this.url = url;
    }
  };
  function createClient(options = {}) {
    var _a, _b, _c, _d, _e;
    const apiBase = ((_a = options.apiBase) != null ? _a : "").replace(/\/+$/, "");
    const timeout = (_b = options.timeout) != null ? _b : 1e4;
    const customFetch = options.fetch;
    const extraHeaders = options.headers || {};
    const riskRetries = Math.max(0, Number((_c = options.riskRetries) != null ? _c : DEFAULT_RISK_RETRIES) || 0);
    const riskRetryDelay = Math.max(0, Number((_d = options.riskRetryDelay) != null ? _d : RISK_RETRY_BASE_DELAY) || 0);
    const onRiskRetry = typeof options.onRiskRetry === "function" ? options.onRiskRetry : null;
    function resolveFetch() {
      if (customFetch) return customFetch;
      if (typeof globalThis.fetch === "function") return globalThis.fetch.bind(globalThis);
      throw new NeteaseApiError("\u5F53\u524D\u73AF\u5883\u6CA1\u6709 fetch\uFF0C\u8BF7\u6CE8\u5165 options.fetch");
    }
    async function sendOnce(url, init) {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
      let res;
      try {
        res = await resolveFetch()(url, {
          ...init,
          signal: controller ? controller.signal : void 0,
          headers: { Accept: "application/json, text/plain, */*", ...extraHeaders, ...init.headers || {} }
        });
      } catch (err) {
        if (timer) clearTimeout(timer);
        if ((err == null ? void 0 : err.name) === "AbortError") {
          throw new NeteaseApiError(`\u8BF7\u6C42\u8D85\u65F6\uFF08${timeout}ms\uFF09\uFF1A${url}`, { url });
        }
        throw new NeteaseApiError(`\u8BF7\u6C42\u5931\u8D25\uFF1A${(err == null ? void 0 : err.message) || err}`, { url });
      }
      if (timer) clearTimeout(timer);
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new NeteaseApiError(`\u54CD\u5E94\u4E0D\u662F JSON\uFF08HTTP ${res.status}\uFF09`, {
          status: res.status,
          body: text.slice(0, 300),
          url
        });
      }
      if (!res.ok) {
        const hint = (data == null ? void 0 : data.message) || (data == null ? void 0 : data.msg) || (data == null ? void 0 : data.error) || "";
        throw new NeteaseApiError(`\u63A5\u53E3\u8FD4\u56DE HTTP ${res.status}${hint ? `\uFF1A${hint}` : ""}`, {
          status: res.status,
          body: data,
          url
        });
      }
      return data;
    }
    async function send(url, init) {
      let lastErr = null;
      for (let attempt = 0; attempt <= riskRetries; attempt++) {
        try {
          return await sendOnce(url, init);
        } catch (err) {
          const risk = err instanceof NeteaseApiError && isRiskControlResponse(err.status, err.body);
          if (!risk) throw err;
          lastErr = err;
          if (attempt >= riskRetries) break;
          if (onRiskRetry) {
            try {
              onRiskRetry(attempt + 1, riskRetries, err);
            } catch {
            }
          }
          await sleep(riskRetryDelay * (attempt + 1) + Math.random() * 250);
        }
      }
      if (riskRetries > 0 && lastErr) {
        throw new NeteaseApiError(`${lastErr.message}\uFF08\u5DF2\u81EA\u52A8\u6362\u65B0\u8BF7\u6C42\u91CD\u8BD5 ${riskRetries} \u6B21\u90FD\u6CA1\u8FC7\uFF09`, {
          status: lastErr.status,
          body: lastErr.body,
          url: lastErr.url
        });
      }
      throw lastErr;
    }
    function get(path, params = {}) {
      const query = buildQuery(params);
      const url = `${apiBase || OFFICIAL_BASE}${path}${query ? `?${query}` : ""}`;
      return send(url, { method: "GET" });
    }
    function post(path, body = {}) {
      const url = `${apiBase || OFFICIAL_BASE}${path}`;
      return send(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    }
    const adapterOption = (_e = options.adapter) != null ? _e : "official";
    let impl;
    if (typeof adapterOption === "function") {
      impl = adapterOption({ get, post, apiBase });
    } else {
      const factory = ADAPTERS[adapterOption];
      if (!factory) {
        throw new NeteaseApiError(
          `\u672A\u77E5\u7684 adapter\uFF1A${adapterOption}\uFF08\u53EF\u9009\uFF1A${Object.keys(ADAPTERS).join(" / ")}\uFF09`
        );
      }
      impl = factory({ get, post, apiBase }, { apiBase, ...options.adapterOptions || {} });
    }
    return {
      apiBase: apiBase || OFFICIAL_BASE,
      adapter: impl.name || String(adapterOption),
      riskRetries,
      get,
      post,
      ...impl
    };
  }
  var defaultClient = null;
  function getDefaultClient() {
    if (!defaultClient) defaultClient = createClient();
    return defaultClient;
  }
  function setDefaultClient(client) {
    defaultClient = client;
  }

  // src/normalize.js
  var normalize_exports = {};
  __export(normalize_exports, {
    default: () => normalize_default,
    normalizeAlbum: () => normalizeAlbum,
    normalizeArtistDetail: () => normalizeArtistDetail,
    normalizeDjradio: () => normalizeDjradio,
    normalizeLyric: () => normalizeLyric,
    normalizePlaylist: () => normalizePlaylist,
    normalizeProgram: () => normalizeProgram,
    normalizeSearch: () => normalizeSearch,
    normalizeSong: () => normalizeSong,
    normalizeSongUrl: () => normalizeSongUrl,
    toArtistArray: () => toArtistArray
  });
  function pick(obj, keys, fallback = void 0) {
    for (const key of keys) {
      if (obj && obj[key] !== void 0 && obj[key] !== null) return obj[key];
    }
    return fallback;
  }
  function toArtistArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      return value.split(/\s*[/、,，]\s*/).filter(Boolean);
    }
    return [value];
  }
  function normalizeArtist(raw) {
    if (!raw) return { id: "", name: "" };
    if (typeof raw === "string") return { id: "", name: raw };
    return {
      id: String(pick(raw, ["id"], "")),
      name: pick(raw, ["name"], "") || ""
    };
  }
  function normalizeCover(raw, size = 300) {
    const url = pick(
      raw,
      ["picUrl", "coverImgUrl", "coverUrl", "blurCoverUrl", "img1v1Url", "blurPicUrl", "cover"],
      ""
    );
    return url ? withImageSize(url, size) : "";
  }
  function looksLikeAudioUrl(url) {
    return typeof url === "string" && /^https?:\/\//.test(url) && /\.(mp3|flac|m4a|aac|wav|ape|mp4)(\?|$)/i.test(url);
  }
  function findPlayUrl(raw) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!raw) return "";
    const candidates = [
      raw.playUrl,
      raw.url,
      (_a = raw.song) == null ? void 0 : _a.url,
      (_b = raw.data) == null ? void 0 : _b.url,
      (_d = (_c = raw.data) == null ? void 0 : _c[0]) == null ? void 0 : _d.url,
      (_g = (_f = (_e = raw.result) == null ? void 0 : _e.data) == null ? void 0 : _f[0]) == null ? void 0 : _g.url
    ];
    return candidates.find(looksLikeAudioUrl) || "";
  }
  function webUrlOf(type, id) {
    if (!id) return "";
    return `https://music.163.com/#/${type}?id=${id}`;
  }
  function normalizeSong(raw) {
    if (!raw) return null;
    const id = String(pick(raw, ["id", "songId", "trackId", "mainTrackId"], ""));
    const artists = toArtistArray(pick(raw, ["ar", "artists", "artist"], [])).map(normalizeArtist);
    let albumRaw = pick(raw, ["al", "album"], {});
    if (typeof albumRaw === "string") albumRaw = { name: albumRaw };
    const album = albumRaw || {};
    const aliasRaw = pick(raw, ["alia", "alias"], []);
    const webUrl = webUrlOf("song", id);
    return {
      type: "song",
      id,
      name: pick(raw, ["name"], "") || "",
      alias: Array.isArray(aliasRaw) ? aliasRaw : aliasRaw ? [String(aliasRaw)] : [],
      artists,
      artistText: joinArtists(artists),
      album: {
        id: String(pick(album, ["id"], "")),
        name: pick(album, ["name"], "") || "",
        cover: normalizeCover(album)
      },
      cover: normalizeCover(album) || normalizeCover(raw),
      duration: pick(raw, ["dt", "duration"], null),
      fee: pick(raw, ["fee"], 0),
      mvId: pick(raw, ["mvId", "mvid"], 0) || 0,
      playable: pick(raw, ["fee"], 0) === 0,
      // 网页链接；url 保留成同义字段，方便直接塞进 <a href>
      webUrl,
      url: webUrl,
      // 只有后端直接给了音频直链才有值（比如 Netease_url）
      playUrl: findPlayUrl(raw)
    };
  }
  function normalizePlaylist(raw) {
    var _a, _b, _c, _d;
    if (!raw) return null;
    const playlist = raw.playlist || raw.result || raw;
    const tracks = (playlist.tracks || playlist.songs || []).map(normalizeSong).filter(Boolean);
    const creatorRaw = (_b = (_a = playlist.creator) != null ? _a : playlist.user) != null ? _b : {};
    const creator = typeof creatorRaw === "string" ? { id: "", name: creatorRaw } : {
      id: String((_d = (_c = creatorRaw.userId) != null ? _c : creatorRaw.id) != null ? _d : ""),
      name: creatorRaw.nickname || creatorRaw.name || ""
    };
    const id = String(pick(playlist, ["id"], ""));
    const webUrl = webUrlOf("playlist", id);
    return {
      type: "playlist",
      id,
      name: pick(playlist, ["name"], "") || "",
      cover: normalizeCover(playlist, 500),
      description: pick(playlist, ["description"], "") || "",
      trackCount: pick(playlist, ["trackCount"], tracks.length) || tracks.length,
      playCount: pick(playlist, ["playCount"], 0) || 0,
      creator,
      tracks,
      webUrl,
      url: webUrl
    };
  }
  function normalizeAlbum(raw) {
    var _a;
    if (!raw) return null;
    const album = raw.album || raw.result || raw;
    const songList = ((_a = album.songs) == null ? void 0 : _a.length) ? album.songs : raw.songs || [];
    const songs = songList.map(normalizeSong).filter(Boolean);
    const id = String(pick(album, ["id"], ""));
    const webUrl = webUrlOf("album", id);
    return {
      type: "album",
      id,
      name: pick(album, ["name"], "") || "",
      cover: normalizeCover(album, 500),
      description: pick(album, ["description"], "") || "",
      artistText: joinArtists(toArtistArray(pick(album, ["artists", "ar", "artist"], [])).map(normalizeArtist)),
      company: pick(album, ["company"], "") || "",
      publishTime: pick(album, ["publishTime"], 0) || 0,
      trackCount: songs.length,
      tracks: songs,
      webUrl,
      url: webUrl
    };
  }
  function normalizeArtistDetail(raw) {
    if (!raw) return null;
    const artist = raw.artist || raw;
    const hotSongs = (raw.hotSongs || artist.hotSongs || []).map(normalizeSong).filter(Boolean);
    const id = String(pick(artist, ["id"], ""));
    const webUrl = webUrlOf("artist", id);
    return {
      type: "artist",
      id,
      name: pick(artist, ["name"], "") || "",
      cover: normalizeCover(artist, 500),
      description: pick(artist, ["briefDesc", "description"], "") || "",
      albumSize: pick(artist, ["albumSize"], 0) || 0,
      musicSize: pick(artist, ["musicSize"], 0) || 0,
      trackCount: hotSongs.length,
      tracks: hotSongs,
      webUrl,
      url: webUrl
    };
  }
  function normalizeProgram(raw) {
    var _a, _b, _c, _d, _e, _f;
    const program = (raw == null ? void 0 : raw.program) || raw;
    if (!program) return null;
    const programId = String((_a = program.id) != null ? _a : "");
    const mainTrackId = String((_b = program.mainTrackId) != null ? _b : "");
    const song = normalizeSong(program.mainSong || program.song);
    if (!song && !programId && !mainTrackId) return null;
    const radio = program.radio || {};
    const id = String(mainTrackId || (song == null ? void 0 : song.id) || programId);
    const webUrl = `https://music.163.com/#/program?id=${programId || id}`;
    const artists = ((_c = song == null ? void 0 : song.artists) == null ? void 0 : _c.length) ? song.artists : [{ id: "", name: radio.name || "\u7535\u53F0" }];
    return {
      ...song || {},
      type: "song",
      // UI 靠它把标签渲染成「声音」而不是「单曲」
      kind: "program",
      id,
      programId,
      mainTrackId: mainTrackId || id,
      name: program.name || (song == null ? void 0 : song.name) || "",
      artists,
      artistText: joinArtists(artists),
      radio: { id: String((_d = radio.id) != null ? _d : ""), name: radio.name || "" },
      cover: normalizeCover(program, 500) || (song == null ? void 0 : song.cover) || "",
      duration: (_f = (_e = song == null ? void 0 : song.duration) != null ? _e : program.duration) != null ? _f : null,
      webUrl,
      url: webUrl
    };
  }
  function programTrack(p) {
    var _a, _b;
    const song = normalizeSong((p == null ? void 0 : p.mainSong) || (p == null ? void 0 : p.song));
    if (song) return song;
    const id = (_a = p == null ? void 0 : p.mainTrackId) != null ? _a : p == null ? void 0 : p.id;
    if (!id) return null;
    return normalizeSong({
      id,
      name: p == null ? void 0 : p.name,
      duration: p == null ? void 0 : p.duration,
      fee: p == null ? void 0 : p.fee,
      album: { name: (_b = p == null ? void 0 : p.radio) == null ? void 0 : _b.name }
    });
  }
  function normalizeDjradio(raw, radioInfo) {
    var _a, _b, _c;
    const programs = (raw == null ? void 0 : raw.programs) || (raw == null ? void 0 : raw.data) || [];
    const tracks = programs.map(programTrack).filter(Boolean);
    const info = radioInfo || (raw == null ? void 0 : raw.radio) || {};
    const id = String(pick(info, ["id"], ""));
    const webUrl = webUrlOf("djradio", id);
    return {
      type: "playlist",
      kind: "djradio",
      id,
      name: pick(info, ["name"], "") || "\u7535\u53F0",
      cover: normalizeCover(info, 500),
      description: pick(info, ["desc", "description"], "") || "",
      creator: { id: String((_b = (_a = info.dj) == null ? void 0 : _a.userId) != null ? _b : ""), name: ((_c = info.dj) == null ? void 0 : _c.nickname) || "" },
      trackCount: tracks.length,
      tracks,
      webUrl,
      url: webUrl
    };
  }
  function normalizeLyric(raw) {
    var _a, _b, _c;
    if (!raw) return { lyric: "", translated: "", roma: "" };
    const clean = (text) => String(text || "").split("\n").filter((line) => !/^\[(by|re|ve|ti|ar|al):/i.test(line.trim())).join("\n").trim();
    return {
      lyric: clean((_a = raw == null ? void 0 : raw.lrc) == null ? void 0 : _a.lyric),
      translated: clean((_b = raw == null ? void 0 : raw.tlyric) == null ? void 0 : _b.lyric),
      roma: clean((_c = raw == null ? void 0 : raw.romalrc) == null ? void 0 : _c.lyric)
    };
  }
  function unavailableKind(code, item, raw) {
    var _a, _b;
    if (code === -462 || ((_a = raw == null ? void 0 : raw.data) == null ? void 0 : _a.verifyType) || (raw == null ? void 0 : raw.verifyType)) return "risk";
    if (code === 404) return "copyright";
    if (code === -110) return "vip";
    if (Number(item == null ? void 0 : item.fee) > 0 || ((_b = item == null ? void 0 : item.freeTrialPrivilege) == null ? void 0 : _b.cannotListenReason)) return "vip";
    if (/cookie/i.test(String((item == null ? void 0 : item.reason) || ""))) return "nocookie";
    return "unknown";
  }
  var UNAVAILABLE_REASONS = {
    risk: "\u7F51\u6613\u4E91\u98CE\u63A7\u62E6\u4E86\u4E00\u4E0B\uFF0C\u8FC7\u51E0\u79D2\u518D\u70B9\u4E00\u6B21\u901A\u5E38\u5C31\u597D",
    copyright: "\u7F51\u6613\u4E91\u6CA1\u6709\u8FD9\u9996\u6B4C\u7684\u64AD\u653E\u7248\u6743\uFF08\u6216\u5DF2\u4E0B\u67B6\uFF09\uFF0C\u914D Cookie \u4E5F\u62FF\u4E0D\u5230",
    vip: "\u8FD9\u9996\u6B4C\u9700\u8981 VIP / \u4ED8\u8D39\u624D\u80FD\u542C",
    nocookie: "\u8FD9\u9996\u6B4C\u8981\u914D\u767B\u5F55 Cookie \u624D\u80FD\u62FF\u5230\u76F4\u94FE",
    unknown: "\u8FD9\u9996\u6B4C\u6682\u65F6\u6CA1\u6709\u53EF\u64AD\u653E\u7684\u5730\u5740"
  };
  function normalizeSongUrl(raw) {
    var _a, _b, _c, _d, _e;
    const item = ((_a = raw == null ? void 0 : raw.data) == null ? void 0 : _a[0]) || (raw == null ? void 0 : raw.data) || raw;
    if (!item) {
      return {
        url: "",
        size: 0,
        br: 0,
        free: false,
        available: false,
        code: (_b = raw == null ? void 0 : raw.code) != null ? _b : null,
        kind: "unknown",
        reason: "\u63A5\u53E3\u6CA1\u6709\u8FD4\u56DE\u6570\u636E"
      };
    }
    const envelope = raw == null ? void 0 : raw.code;
    const code = (_c = item.code) != null ? _c : typeof envelope === "number" && envelope !== 200 ? envelope : null;
    const url = item.url || "";
    if (url) {
      return {
        id: String((_d = item.id) != null ? _d : ""),
        url,
        size: item.size || 0,
        br: item.br || 0,
        free: Boolean(item.free),
        available: true,
        code: code != null ? code : 200,
        kind: "ok",
        reason: ""
      };
    }
    const kind = unavailableKind(code, item, raw);
    return {
      id: String((_e = item.id) != null ? _e : ""),
      url: "",
      size: item.size || 0,
      br: item.br || 0,
      free: false,
      available: false,
      code: code != null ? code : null,
      kind,
      reason: item.reason || UNAVAILABLE_REASONS[kind]
    };
  }
  function normalizeSearch(raw) {
    const result = (raw == null ? void 0 : raw.result) || raw || {};
    return {
      songCount: result.songCount || (result.songs || []).length || 0,
      songs: (result.songs || []).map(normalizeSong).filter(Boolean),
      playlists: (result.playlists || []).map((p) => {
        var _a;
        return {
          id: String((_a = p.id) != null ? _a : ""),
          name: p.name || "",
          cover: normalizeCover(p, 300),
          trackCount: p.trackCount || 0
        };
      }),
      albums: (result.albums || []).map((a) => {
        var _a;
        return {
          id: String((_a = a.id) != null ? _a : ""),
          name: a.name || "",
          cover: normalizeCover(a, 300),
          artistText: joinArtists(toArtistArray(pick(a, ["artists", "artist"], [])).map(normalizeArtist))
        };
      }),
      artists: (result.artists || []).map((a) => {
        var _a;
        return {
          id: String((_a = a.id) != null ? _a : ""),
          name: a.name || "",
          cover: normalizeCover(a, 300)
        };
      })
    };
  }
  var normalize_default = {
    normalizeSong,
    normalizePlaylist,
    normalizeAlbum,
    normalizeArtistDetail,
    normalizeProgram,
    normalizeDjradio,
    normalizeLyric,
    normalizeSongUrl,
    normalizeSearch,
    toArtistArray
  };

  // src/ui.js
  var ICONS = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.2v14H7zm6.8 0H17v14h-3.2z"/></svg>',
    music: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10.6A4 4 0 1 0 14 17V7h4V3z"/></svg>',
    volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.2L11.5 18V6L7.2 9.5z"/><path d="M14.6 9.2a4 4 0 0 1 0 5.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.2L11.5 18V6L7.2 9.5z"/><path d="M14.5 10l4.5 4.5M19 10l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a3 3 0 1 1 4.2 4.2l-1.4 1.4-1.4-1.4 1.4-1.4a1 1 0 0 0-1.4-1.4L12 13.4a1 1 0 0 1-1.4 0zm2.8-2.8a1 1 0 0 1 0 1.4l-3.5 3.5a3 3 0 1 1-4.2-4.2l1.4-1.4 1.4 1.4-1.4 1.4a1 1 0 0 0 1.4 1.4l3.5-3.5a1 1 0 0 1 1.4 0z"/></svg>'
  };
  function renderSkeleton(container) {
    container.innerHTML = `
    <div class="nmp-card nmp-card--loading">
      <div class="nmp-cover nmp-skeleton"></div>
      <div class="nmp-body">
        <div class="nmp-line nmp-skeleton"></div>
        <div class="nmp-line nmp-line--short nmp-skeleton"></div>
      </div>
    </div>`;
  }
  function renderError(container, message) {
    container.dataset.nmpState = "error";
    container.innerHTML = `
    <div class="nmp-card nmp-card--error">
      <div class="nmp-error-icon">!</div>
      <div class="nmp-body">
        <div class="nmp-title">\u89E3\u6790\u5931\u8D25</div>
        <div class="nmp-sub">${escapeHtml(message || "\u672A\u77E5\u9519\u8BEF")}</div>
      </div>
    </div>`;
  }
  function trackRow(song, index, playable = true) {
    const id = escapeHtml(song.id);
    const canPlay = playable && Boolean(song.id);
    return `
    <li class="nmp-track" data-nmp-song="${id}" ${canPlay ? 'data-nmp-playable="1"' : ""}
        ${canPlay ? "" : `title="${playable ? "\u8FD9\u4E00\u884C\u6CA1\u6709\u53EF\u7528\u7684 id\uFF0C\u70B9\u4E0D\u4E86" : "\u5F53\u524D\u540E\u7AEF\u62FF\u4E0D\u5230\u64AD\u653E\u76F4\u94FE"}"`}>
      <span class="nmp-track-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="nmp-track-name" title="${escapeHtml(song.name)}">${escapeHtml(song.name)}</span>
      <span class="nmp-track-artist">${escapeHtml(song.artistText)}</span>
      <span class="nmp-track-time">${formatDuration(song.duration)}</span>
      ${canPlay ? `<button class="nmp-track-play" type="button" data-nmp-action="toggle" data-nmp-song="${id}"
                     aria-label="\u64AD\u653E ${escapeHtml(song.name)}">${ICONS.play}</button>` : ""}
    </li>`;
  }
  function playNote(options) {
    const hint = options.playbackHint || "\u5F53\u524D\u540E\u7AEF\u62FF\u4E0D\u5230\u64AD\u653E\u76F4\u94FE\uFF0C\u53EA\u80FD\u770B\u4FE1\u606F";
    return `<div class="nmp-note">${escapeHtml(hint)}</div>`;
  }
  function playerBlock(options = {}) {
    const raw = Number(options.volume);
    const volume = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 100;
    return `
    <div class="nmp-player">
      <input class="nmp-seek" type="range" min="0" max="1000" step="1" value="0"
             aria-label="\u64AD\u653E\u8FDB\u5EA6" data-nmp-seek />
      <div class="nmp-player-row">
        <span class="nmp-time">
          <span class="nmp-time-cur">0:00</span>
          <span class="nmp-time-sep">/</span>
          <span class="nmp-time-total">--:--</span>
        </span>
        <span class="nmp-volume">
          <button class="nmp-mute" type="button" data-nmp-action="mute"
                  aria-label="\u9759\u97F3" aria-pressed="false">${ICONS.volume}</button>
          <input class="nmp-volume-range" type="range" min="0" max="100" step="1" value="${volume}"
                 aria-label="\u97F3\u91CF" data-nmp-volume />
        </span>
      </div>
      <div class="nmp-lyrics" data-nmp-lyrics="idle"></div>
    </div>`;
  }
  function renderSong(container, song, options = {}) {
    var _a;
    const playback = options.playback !== false;
    const label = TYPE_LABELS[song.kind] || TYPE_LABELS.song;
    container.dataset.nmpState = "ready";
    container.dataset.nmpType = "song";
    container.innerHTML = `
    <div class="nmp-card nmp-card--song" data-nmp-song="${escapeHtml(song.id)}">
      <div class="nmp-cover-wrap">
        <img class="nmp-cover" src="${escapeHtml(song.cover)}" alt="${escapeHtml(song.name)} \u5C01\u9762" loading="lazy" />
        ${playback ? `<button class="nmp-play" type="button" data-nmp-action="toggle" data-nmp-song="${escapeHtml(song.id)}"
                     aria-label="\u64AD\u653E ${escapeHtml(song.name)}">
          ${ICONS.play}
        </button>` : ""}
      </div>
      <div class="nmp-body">
        <div class="nmp-kind">${label}</div>
        <div class="nmp-title">${escapeHtml(song.name)}</div>
        <div class="nmp-sub">${escapeHtml(song.artistText)}${((_a = song.album) == null ? void 0 : _a.name) ? `<span class="nmp-dot">\xB7</span>${escapeHtml(song.album.name)}` : ""}</div>
        <div class="nmp-meta">
          <span class="nmp-duration">${formatDuration(song.duration)}</span>
          ${song.playable ? "" : '<span class="nmp-badge">VIP</span>'}
        </div>
        ${playback ? '<audio class="nmp-audio" preload="none"></audio>' : playNote(options)}
      </div>
      <a class="nmp-link" href="${escapeHtml(song.url)}" target="_blank" rel="noopener noreferrer" title="\u5728\u7F51\u6613\u4E91\u6253\u5F00">
        ${ICONS.link}
      </a>
      ${playback ? playerBlock(options) : ""}
    </div>`;
    return container;
  }
  function renderCollection(container, data, options = {}) {
    var _a;
    const playback = options.playback !== false;
    const isPlaylist = data.type === "playlist";
    const tracks = data.tracks || [];
    const label = data.kind === "djradio" ? TYPE_LABELS.djradio : TYPE_LABELS[data.type] || "\u5408\u96C6";
    const subtitle = isPlaylist ? [((_a = data.creator) == null ? void 0 : _a.name) && `by ${data.creator.name}`, `${data.trackCount} \u9996`].filter(Boolean).join(" \xB7 ") : data.type === "artist" ? [`${data.musicSize || data.trackCount} \u9996\u4F5C\u54C1`, `${data.albumSize || 0} \u5F20\u4E13\u8F91`].join(" \xB7 ") : [data.artistText, data.publishTime ? formatDate(data.publishTime) : ""].filter(Boolean).join(" \xB7 ");
    container.dataset.nmpState = "ready";
    container.dataset.nmpType = data.type;
    container.innerHTML = `
    <div class="nmp-card nmp-card--collection">
      <div class="nmp-cover-wrap">
        <img class="nmp-cover" src="${escapeHtml(data.cover)}" alt="${escapeHtml(data.name)} \u5C01\u9762" loading="lazy" />
        ${// 合集也要有一个常驻的播放/暂停键：曲目表默认是收起来的，
    // 只靠曲目行上的按钮，用户第一眼还是找不到怎么停。
    // 播放目标由 index.js 决定（已在放的那首 → 否则第一首）。
    playback && tracks.length ? `<button class="nmp-play" type="button" data-nmp-action="toggle" data-nmp-song="${escapeHtml(tracks[0].id)}"
                     aria-label="\u64AD\u653E">${ICONS.play}</button>` : ""}
      </div>
      <div class="nmp-body">
        <div class="nmp-kind">${label}</div>
        <div class="nmp-title">${escapeHtml(data.name)}</div>
        <div class="nmp-sub">${escapeHtml(subtitle)}</div>
        ${isPlaylist && data.playCount ? `<div class="nmp-meta"><span>${formatCount(data.playCount)} \u6B21\u64AD\u653E</span></div>` : ""}
        ${tracks.length ? `<button class="nmp-toggle" type="button" data-nmp-action="expand" aria-expanded="false">
                 \u5C55\u5F00\u5168\u90E8 ${tracks.length} \u9996
               </button>` : `<div class="nmp-note">\u8FD9\u4E2A\u5408\u96C6\u6CA1\u6709\u8FD4\u56DE\u53EF\u64AD\u7684\u66F2\u76EE\uFF08\u540E\u7AEF\u53EF\u80FD\u53EA\u7ED9\u4E86\u66F2\u76EE id \u5217\u8868\uFF09</div>`}
        ${playback ? "" : playNote(options)}
      </div>
      <a class="nmp-link" href="${escapeHtml(data.url)}" target="_blank" rel="noopener noreferrer" title="\u5728\u7F51\u6613\u4E91\u6253\u5F00">
        ${ICONS.link}
      </a>
      ${tracks.length ? `<ol class="nmp-tracks" hidden>${tracks.map((s, i) => trackRow(s, i, playback)).join("")}</ol>` : ""}
      ${playback ? '<audio class="nmp-audio" preload="none"></audio>' : ""}
      ${playback ? playerBlock(options) : ""}
    </div>`;
    return container;
  }
  function render(container, data, options = {}) {
    if (!data) return renderError(container, "\u6CA1\u6709\u62FF\u5230\u6570\u636E");
    if (data.type === "song") return renderSong(container, data, options);
    if (["playlist", "album", "artist"].includes(data.type)) {
      return renderCollection(container, data, options);
    }
    return renderError(container, `\u6682\u4E0D\u652F\u6301\u7684\u7C7B\u578B\uFF1A${data.type}`);
  }
  function renderLyrics(panel, lines, options = {}) {
    if (!panel) return panel;
    const list = Array.isArray(lines) ? lines : [];
    resetLyricScroll(panel);
    if (!list.length) {
      const fallback = String(options.plain || "").trim();
      if (fallback) {
        panel.dataset.nmpLyrics = "plain";
        panel.innerHTML = `<p class="nmp-lyrics-plain">${escapeHtml(fallback).replace(/\n/g, "<br />")}</p>`;
      } else {
        panel.dataset.nmpLyrics = "empty";
        panel.innerHTML = `<p class="nmp-lyrics-hint">${escapeHtml(options.message || "\u8FD9\u9996\u6B4C\u6CA1\u6709\u6B4C\u8BCD")}</p>`;
      }
      return panel;
    }
    panel.dataset.nmpLyrics = "ready";
    panel.innerHTML = list.map(
      (line, index) => `
      <p class="nmp-lyric-line" data-nmp-line="${index}" data-nmp-time="${line.time}">
        <span class="nmp-lyric-text">${escapeHtml(line.text)}</span>
        ${line.translation ? `<span class="nmp-lyric-tr">${escapeHtml(line.translation)}</span>` : ""}
      </p>`
    ).join("");
    return panel;
  }
  function setLyricsState(panel, state, message) {
    if (!panel) return panel;
    resetLyricScroll(panel);
    panel.dataset.nmpLyrics = state;
    panel.innerHTML = message ? `<p class="nmp-lyrics-hint">${escapeHtml(message)}</p>` : "";
    return panel;
  }
  function resetLyricScroll(panel) {
    delete panel.dataset.nmpLyricsActive;
    delete panel.dataset.nmpLyricsProgram;
    panel.dataset.nmpLyricsAuto = "1";
    clearTimeout(panel._nmpAutoTimer);
    clearTimeout(panel._nmpProgramTimer);
    try {
      panel.scrollTop = 0;
    } catch {
    }
  }
  function highlightLyric(root, index) {
    var _a;
    const panel = (_a = root == null ? void 0 : root.querySelector) == null ? void 0 : _a.call(root, ".nmp-lyrics");
    if (!panel || panel.dataset.nmpLyrics !== "ready") return;
    if (panel.dataset.nmpLyricsActive === String(index)) return;
    const lines = panel.querySelectorAll(".nmp-lyric-line");
    if (!lines.length) return;
    panel.dataset.nmpLyricsActive = String(index);
    const next = index >= 0 && index < lines.length ? lines[index] : null;
    lines.forEach((line, i) => {
      if (i === index) line.dataset.nmpActive = "1";
      else line.removeAttribute("data-nmp-active");
    });
    if (!next || panel.dataset.nmpLyricsAuto === "0") return;
    const target = Math.max(0, next.offsetTop - panel.clientHeight / 2 + next.clientHeight / 2);
    panel.dataset.nmpLyricsProgram = "1";
    clearTimeout(panel._nmpProgramTimer);
    panel._nmpProgramTimer = setTimeout(() => {
      panel.dataset.nmpLyricsProgram = "0";
    }, 800);
    try {
      if (typeof panel.scrollTo === "function") panel.scrollTo({ top: target, behavior: "smooth" });
      else panel.scrollTop = target;
    } catch {
      panel.scrollTop = target;
    }
  }
  function showNotice(container, message, duration = 3200) {
    const card = container.querySelector(".nmp-card") || container;
    let notice = card.querySelector(".nmp-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.className = "nmp-notice";
      card.appendChild(notice);
    }
    notice.textContent = message;
    notice.dataset.nmpVisible = "1";
    clearTimeout(notice._nmpTimer);
    notice._nmpTimer = setTimeout(() => {
      notice.dataset.nmpVisible = "0";
    }, duration);
    return notice;
  }
  function resumeBar(state = {}) {
    const name = state.songName || state.listName || "\u4E0A\u6B21\u90A3\u9996";
    const artist = state.artistText ? `<span class="nmp-dot">\xB7</span>${escapeHtml(state.artistText)}` : "";
    return `
    <div class="nmp-resume" data-nmp-resume="1">
      <span class="nmp-resume-text">\u4E0A\u6B21\u6CA1\u542C\u5B8C\uFF1A<b>${escapeHtml(name)}</b>${artist}</span>
      <button class="nmp-resume-go" type="button" data-nmp-action="resume">\u7EE7\u7EED\u64AD\u653E</button>
      <button class="nmp-resume-close" type="button" data-nmp-action="resume-dismiss" aria-label="\u5FFD\u7565\u8FD9\u6B21\u7EED\u64AD">\xD7</button>
    </div>`;
  }

  // src/lyric.js
  var lyric_exports = {};
  __export(lyric_exports, {
    default: () => lyric_default,
    findLineIndex: () => findLineIndex,
    hasTimestamp: () => hasTimestamp,
    mergeTranslation: () => mergeTranslation,
    parseLrc: () => parseLrc
  });
  var TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  var OFFSET_TAG = /\[offset:\s*([+-]?\d+)\s*\]/i;
  function toSeconds(min, sec, frac) {
    let ms = 0;
    if (frac) {
      ms = frac.length === 1 ? Number(frac) * 100 : frac.length === 2 ? Number(frac) * 10 : Number(frac);
    }
    return Number(min) * 60 + Number(sec) + ms / 1e3;
  }
  function hasTimestamp(text) {
    TIME_TAG.lastIndex = 0;
    return TIME_TAG.test(String(text || ""));
  }
  function parseLrc(text) {
    const raw = String(text || "");
    if (!raw.trim()) return [];
    const offsetMatch = raw.match(OFFSET_TAG);
    const offset = offsetMatch ? Number(offsetMatch[1]) / 1e3 : 0;
    const lines = [];
    for (const rawLine of raw.split(/\r?\n/)) {
      TIME_TAG.lastIndex = 0;
      const times = [];
      let match;
      while (match = TIME_TAG.exec(rawLine)) times.push(toSeconds(match[1], match[2], match[3]));
      if (!times.length) continue;
      TIME_TAG.lastIndex = 0;
      const content = rawLine.replace(TIME_TAG, "").trim();
      if (!content) continue;
      for (const time of times) lines.push({ time: Math.max(0, time - offset), text: content });
    }
    lines.sort((a, b) => a.time - b.time);
    return lines;
  }
  function mergeTranslation(lines, translatedText) {
    const base = Array.isArray(lines) ? lines : [];
    const translated = parseLrc(translatedText);
    if (!base.length || !translated.length) return base.map((line) => ({ ...line }));
    const out = [];
    let cursor = 0;
    for (const line of base) {
      while (cursor < translated.length && translated[cursor].time < line.time - 0.6) cursor += 1;
      const candidate = translated[cursor];
      if (candidate && Math.abs(candidate.time - line.time) <= 0.6) {
        out.push({ ...line, translation: candidate.text });
        cursor += 1;
      } else {
        out.push({ ...line });
      }
    }
    return out;
  }
  function findLineIndex(lines, seconds) {
    if (!Array.isArray(lines) || !lines.length) return -1;
    const t = Number(seconds);
    if (!Number.isFinite(t) || t < lines[0].time) return -1;
    let lo = 0;
    let hi = lines.length - 1;
    let answer = -1;
    while (lo <= hi) {
      const mid = lo + hi >> 1;
      if (lines[mid].time <= t) {
        answer = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return answer;
  }
  var lyric_default = { parseLrc, mergeTranslation, findLineIndex, hasTimestamp };

  // src/mediasession.js
  function session() {
    if (typeof navigator === "undefined") return null;
    try {
      return navigator.mediaSession || null;
    } catch {
      return null;
    }
  }
  function isMediaSessionSupported() {
    return Boolean(session());
  }
  function syncMediaSession({ meta, handlers } = {}) {
    const api = session();
    if (!api) return false;
    try {
      if (meta && typeof MediaMetadata === "function") {
        api.metadata = new MediaMetadata({
          title: meta.title || "",
          artist: meta.artist || "",
          album: meta.album || "",
          artwork: meta.artwork ? [{ src: meta.artwork, sizes: "500x500" }] : []
        });
      }
    } catch {
    }
    for (const [action, handler] of Object.entries(handlers || {})) {
      try {
        api.setActionHandler(action, typeof handler === "function" ? handler : null);
      } catch {
      }
    }
    return true;
  }
  function setPlaybackState(state) {
    const api = session();
    if (!api || !state) return;
    try {
      api.playbackState = state;
    } catch {
    }
  }
  function setPositionState({ duration, position, playbackRate = 1 } = {}) {
    const api = session();
    if (!api || typeof api.setPositionState !== "function") return;
    try {
      if (!Number.isFinite(duration) || duration <= 0) {
        api.setPositionState();
        return;
      }
      const pos = Number.isFinite(position) ? Math.min(Math.max(position, 0), duration) : 0;
      api.setPositionState({ duration, playbackRate, position: pos });
    } catch {
    }
  }
  function clearMediaSession() {
    const api = session();
    if (!api) return;
    try {
      api.metadata = null;
      api.playbackState = "none";
    } catch {
    }
    for (const action of ["play", "pause", "seekto", "nexttrack", "previoustrack"]) {
      try {
        api.setActionHandler(action, null);
      } catch {
      }
    }
  }

  // src/resume.js
  var KEY = "nmp-session";
  var VERSION = 1;
  var DEFAULT_MAX_AGE = 30 * 60 * 1e3;
  function store() {
    try {
      if (typeof sessionStorage === "undefined") return null;
      return sessionStorage;
    } catch {
      return null;
    }
  }
  function savePlayback(state) {
    const s = store();
    if (!s || !state) return false;
    try {
      s.setItem(KEY, JSON.stringify({ ...state, v: VERSION, at: Date.now() }));
      return true;
    } catch {
      return false;
    }
  }
  function readPlayback(options = {}) {
    const maxAge = Number.isFinite(options.maxAge) ? Number(options.maxAge) : DEFAULT_MAX_AGE;
    const s = store();
    if (!s) return null;
    try {
      const raw = s.getItem(KEY);
      if (!raw) return null;
      const state = JSON.parse(raw);
      if (!state || state.v !== VERSION) return null;
      if (!Number.isFinite(state.at) || Date.now() - state.at > maxAge) {
        s.removeItem(KEY);
        return null;
      }
      return state;
    } catch {
      return null;
    }
  }
  function clearPlayback() {
    const s = store();
    if (!s) return;
    try {
      s.removeItem(KEY);
    } catch {
    }
  }
  function createThrottledSave(delay = 1e3) {
    let last = 0;
    let pending = null;
    let timer = null;
    const write = () => {
      timer = null;
      const state = pending;
      pending = null;
      if (!state) return;
      last = Date.now();
      savePlayback(state);
    };
    return {
      save(state, { force = false } = {}) {
        if (!state) return;
        const now = Date.now();
        if (force || now - last >= delay) {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          pending = state;
          write();
          return;
        }
        pending = state;
        if (!timer) timer = setTimeout(write, Math.max(0, delay - (now - last)));
      },
      /** 立刻把待写的状态写下去（pagehide / beforeunload 用） */
      flush() {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (pending) write();
      }
    };
  }
  function shouldResume(state, target = {}) {
    if (!(state == null ? void 0 : state.songId)) return false;
    if (target.force) return true;
    if (!target.src) return false;
    return String(state.src || "") === String(target.src || "");
  }

  // src/index.js
  var VERSION2 = "0.1.0";
  var BUNDLED_CSS = true ? `/* ==========================================================================
   netease-music-parser \u2014\u2014 \u5185\u7F6E\u6837\u5F0F
   \u5168\u90E8\u8D70 CSS \u53D8\u91CF\uFF0C\u5728\u4F60\u7684\u4E3B\u9875\u91CC\u53EF\u4EE5\u6574\u4E2A\u8986\u76D6\u6389\u3002
   \u6697\u8272\u8DDF\u968F\u7CFB\u7EDF\uFF0C\u4E5F\u53EF\u4EE5\u624B\u52A8\u6307\u5B9A <div class="nmp-root" data-nmp-theme="dark">
   ========================================================================== */

.nmp-root {
  --nmp-bg: #ffffff;
  --nmp-bg-soft: #f6f6f8;
  --nmp-border: #e6e6ec;
  --nmp-text: #1c1c1e;
  --nmp-text-dim: #6b6b76;
  --nmp-accent: #ec4141;
  --nmp-radius: 14px;
  --nmp-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px -12px rgba(0, 0, 0, 0.16);
  --nmp-gap: 14px;
  --nmp-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', 'PingFang SC',
    'Microsoft YaHei', sans-serif;

  display: block;
  max-width: 480px;
  font-family: var(--nmp-font);
  color: var(--nmp-text);
  -webkit-font-smoothing: antialiased;
}

.nmp-root[data-nmp-theme='dark'] {
  --nmp-bg: #1f1f23;
  --nmp-bg-soft: #2a2a30;
  --nmp-border: #37373f;
  --nmp-text: #f2f2f4;
  --nmp-text-dim: #a0a0ad;
  --nmp-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 10px 30px -14px rgba(0, 0, 0, 0.7);
}

@media (prefers-color-scheme: dark) {
  .nmp-root:not([data-nmp-theme='light']) {
    --nmp-bg: #1f1f23;
    --nmp-bg-soft: #2a2a30;
    --nmp-border: #37373f;
    --nmp-text: #f2f2f4;
    --nmp-text-dim: #a0a0ad;
    --nmp-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 10px 30px -14px rgba(0, 0, 0, 0.7);
  }
}

/* ---------- \u5361\u7247\u9AA8\u67B6 ---------- */

.nmp-card {
  position: relative;
  display: grid;
  grid-template-columns: 88px 1fr auto;
  gap: var(--nmp-gap);
  align-items: center;
  padding: var(--nmp-gap);
  background: var(--nmp-bg);
  border: 1px solid var(--nmp-border);
  border-radius: var(--nmp-radius);
  box-shadow: var(--nmp-shadow);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.nmp-card:hover {
  transform: translateY(-1px);
}

.nmp-card--collection {
  grid-template-rows: auto auto;
}

.nmp-card--collection .nmp-tracks {
  grid-column: 1 / -1;
}

/* ---------- \u5C01\u9762 ---------- */

.nmp-cover-wrap {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--nmp-bg-soft);
  flex: none;
}

.nmp-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.nmp-play {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border: 0;
  padding: 0;
  cursor: pointer;
  color: #fff;
  background: rgba(0, 0, 0, 0.38);
  opacity: 0;
  transition: opacity 0.18s ease, background 0.18s ease;
}

.nmp-card:hover .nmp-play,
.nmp-card[data-nmp-playing='1'] .nmp-play,
.nmp-play:focus-visible {
  opacity: 1;
}

.nmp-play:hover {
  background: rgba(0, 0, 0, 0.55);
}

.nmp-play svg {
  width: 30px;
  height: 30px;
  fill: currentColor;
}

/* \u5408\u96C6\uFF08\u6B4C\u5355 / \u4E13\u8F91 / \u7535\u53F0\uFF09\u5C01\u9762\u4E0A\u7684\u90A3\u4E2A\u952E\u662F**\u552F\u4E00\u7684\u5E38\u9A7B\u63A7\u5236**\uFF1A
   \u66F2\u76EE\u8868\u9ED8\u8BA4\u6536\u7740\uFF0C\u884C\u5185\u6309\u94AE\u770B\u4E0D\u5230\uFF1B\u89E6\u5C4F\u53C8\u6CA1\u6709 hover\u3002
   \u6240\u4EE5\u5B83\u4E0D\u80FD\u50CF\u5355\u66F2\u5361\u90A3\u6837\u85CF\u5230 hover \u624D\u51FA\u73B0 \u2014\u2014 \u6539\u6210\u53F3\u4E0B\u89D2\u4E00\u4E2A\u5E38\u9A7B\u7684\u5706\u5F62\u5C0F\u952E\uFF0C
   \u65E2\u4E0D\u7CCA\u4F4F\u5C01\u9762\uFF0C\u53C8\u4E00\u773C\u5C31\u80FD\u627E\u5230\u300C\u600E\u4E48\u6682\u505C\u300D\u3002 */
.nmp-card--collection .nmp-play {
  inset: auto 6px 6px auto;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--nmp-accent);
  opacity: 1;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  transition: transform 0.16s ease, background 0.16s ease;
}

.nmp-card--collection .nmp-play:hover {
  background: var(--nmp-accent);
  transform: scale(1.08);
}

.nmp-card--collection .nmp-play svg {
  width: 16px;
  height: 16px;
}

/* ---------- \u64AD\u653E\u5668\uFF1A\u8FDB\u5EA6\u6761 / \u65F6\u95F4 / \u97F3\u91CF ---------- */

.nmp-player {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--nmp-border);
}

/* \u8FDB\u5EA6\u7528\u6E10\u53D8\u753B\u300C\u5DF2\u64AD\u90E8\u5206\u300D\uFF0C--nmp-fill \u7531 JS \u66F4\u65B0\u3002
   \u7528\u539F\u751F appearance:none \u662F\u4E3A\u4E86\u8BA9\u4E24\u79CD\u6D4F\u89C8\u5668\u957F\u5F97\u4E00\u6837\uFF0C\u4EE3\u4EF7\u5C31\u662F\u8981\u81EA\u5DF1\u753B\u586B\u5145\u3002 */
.nmp-seek,
.nmp-volume-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 3px;
  margin: 0;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--nmp-accent) var(--nmp-fill, 0%),
    var(--nmp-border) var(--nmp-fill, 0%)
  );
  cursor: pointer;
}

.nmp-seek:focus-visible,
.nmp-volume-range:focus-visible {
  outline: 1px solid var(--nmp-accent);
  outline-offset: 3px;
}

.nmp-seek::-webkit-slider-thumb,
.nmp-volume-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 11px;
  height: 11px;
  border: 0;
  border-radius: 50%;
  background: var(--nmp-accent);
  cursor: pointer;
}

.nmp-seek::-moz-range-thumb,
.nmp-volume-range::-moz-range-thumb {
  width: 11px;
  height: 11px;
  border: 0;
  border-radius: 50%;
  background: var(--nmp-accent);
  cursor: pointer;
}

.nmp-player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.nmp-time {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--nmp-text-dim);
  white-space: nowrap;
}

.nmp-time-sep {
  margin: 0 4px;
  opacity: 0.6;
}

.nmp-volume {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.nmp-volume-range {
  flex: none;
  width: 84px;
}

.nmp-mute {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--nmp-text-dim);
  cursor: pointer;
  transition: color 0.18s ease;
}

.nmp-mute:hover { color: var(--nmp-text); }
.nmp-mute[aria-pressed='true'] { color: var(--nmp-accent); }
.nmp-mute svg { width: 16px; height: 16px; fill: currentColor; }

/* ---------- \u6B4C\u8BCD ---------- */

.nmp-lyrics {
  position: relative; /* \u5173\u952E\uFF1A\u8BA9 offsetTop \u76F8\u5BF9\u9762\u677F\uFF0ChighlightLyric \u624D\u80FD\u7B97\u6EDA\u52A8\u4F4D\u7F6E */
  max-height: 200px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  font-size: 13px;
  line-height: 1.7;
}

.nmp-lyrics[data-nmp-lyrics='idle'] { display: none; }
.nmp-lyrics[data-nmp-lyrics='ready'] { margin-top: 4px; }

.nmp-lyric-line {
  margin: 0;
  padding: 3px 0;
  color: var(--nmp-text-dim);
  opacity: 0.72;
  transition: color 0.2s ease, opacity 0.2s ease;
}

.nmp-lyrics[data-nmp-lyrics='ready'] .nmp-lyric-line { cursor: pointer; }
.nmp-lyrics[data-nmp-lyrics='ready'] .nmp-lyric-line:hover { opacity: 1; }

.nmp-lyric-line[data-nmp-active='1'] {
  color: var(--nmp-text);
  opacity: 1;
  font-weight: 500;
}

.nmp-lyric-tr {
  display: block;
  font-size: 11px;
  color: var(--nmp-text-dim);
  opacity: 0.85;
}

.nmp-lyrics-hint,
.nmp-lyrics-plain {
  margin: 0;
  font-size: 12px;
  line-height: 1.75;
  color: var(--nmp-text-dim);
}

/* ---------- \u6587\u672C ---------- */

.nmp-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.nmp-kind {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--nmp-accent);
  text-transform: uppercase;
}

.nmp-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.nmp-sub {
  font-size: 13px;
  color: var(--nmp-text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nmp-dot {
  margin: 0 5px;
  opacity: 0.6;
}

.nmp-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--nmp-text-dim);
  margin-top: 2px;
}

.nmp-badge {
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--nmp-accent);
  border: 1px solid currentColor;
  border-radius: 4px;
  opacity: 0.85;
}

/* \u540E\u7AEF\u62FF\u4E0D\u5230\u64AD\u653E\u76F4\u94FE\u65F6\u7684\u90A3\u884C\u8BF4\u660E\uFF08\u66FF\u4EE3\u64AD\u653E\u952E\u7684\u4F4D\u7F6E\uFF09 */
.nmp-note {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--nmp-text-dim);
  opacity: 0.85;
}

/* ---------- \u653E\u4E0D\u51FA\u6765\u7684\u90A3\u4E00\u9996 ---------- */

/* \u70B9\u4E86\u624D\u77E5\u9053\u653E\u4E0D\u4E86\uFF0C\u90A3\u5C31\u628A"\u5DF2\u7ECF\u77E5\u9053\u653E\u4E0D\u4E86"\u753B\u51FA\u6765\uFF1A
   \u5F31\u5316\u6574\u884C\uFF0C\u64AD\u653E\u952E\u6362\u6210\u7981\u6B62\u5149\u6807\u3002\u63D0\u793A\u8BED\u5728 title / aria \u4E0A\u3002 */
.nmp-track[data-nmp-unplayable='1'] {
  opacity: 0.55;
}

.nmp-track[data-nmp-unplayable='1'] .nmp-track-play {
  cursor: not-allowed;
}

.nmp-card[data-nmp-unplayable='1'] .nmp-play {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ---------- \u8DE8\u9875\u7EED\u64AD\u6761 ---------- */

/* \u4ECE\u522B\u7684\u9875\u9762\u56DE\u5230\u64AD\u653E\u9875\u65F6\uFF0C\u6D4F\u89C8\u5668\u8BA4\u4E3A\u65B0\u6587\u6863\u6CA1\u6709\u7528\u6237\u624B\u52BF\uFF0C
   audio.play() \u4F1A\u88AB\u81EA\u52A8\u64AD\u653E\u7B56\u7565\u62D2\u6389 \u2014\u2014 \u8FD9\u6761\u5C31\u662F\u90A3\u65F6\u5019\u7684\u843D\u70B9\u3002
   \u505A\u6210\u6574\u884C\u663E\u773C\u7684\u6A2A\u6761\uFF0C\u56E0\u4E3A\u7528\u6237\u6B64\u523B\u7684\u9884\u671F\u662F"\u97F3\u4E50\u5E94\u8BE5\u81EA\u5DF1\u5728\u54CD"\u3002 */
.nmp-resume {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: -4px 0 4px;
  padding: 8px 10px;
  font-size: 12.5px;
  line-height: 1.4;
  background: var(--nmp-bg-soft);
  border: 1px solid var(--nmp-border);
  border-radius: 8px;
}

.nmp-resume-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--nmp-text-dim);
}

.nmp-resume-text b {
  color: var(--nmp-text);
}

.nmp-resume-go {
  flex: none;
  padding: 4px 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: var(--nmp-accent);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.nmp-resume-go:hover {
  filter: brightness(1.06);
}

.nmp-resume-close {
  flex: none;
  width: 20px;
  height: 20px;
  padding: 0;
  font: inherit;
  font-size: 15px;
  line-height: 1;
  color: var(--nmp-text-dim);
  background: none;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}

.nmp-resume-close:hover {
  color: var(--nmp-text);
}

.nmp-link {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  color: var(--nmp-text-dim);
  align-self: start;
  transition: color 0.16s ease, background 0.16s ease;
}

.nmp-link:hover {
  color: var(--nmp-accent);
  background: var(--nmp-bg-soft);
}

.nmp-link svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

/* ---------- \u5C55\u5F00\u6309\u94AE ---------- */

.nmp-toggle {
  align-self: flex-start;
  margin-top: 6px;
  padding: 4px 10px;
  font: inherit;
  font-size: 12px;
  color: var(--nmp-text-dim);
  background: var(--nmp-bg-soft);
  border: 1px solid var(--nmp-border);
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.16s ease, border-color 0.16s ease;
}

.nmp-toggle:hover {
  color: var(--nmp-accent);
  border-color: currentColor;
}

/* ---------- \u66F2\u76EE\u5217\u8868 ---------- */

.nmp-tracks {
  list-style: none;
  margin: 10px 0 0;
  padding: 10px 0 0;
  border-top: 1px solid var(--nmp-border);
  max-height: 320px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.nmp-track {
  display: grid;
  grid-template-columns: 26px 1fr auto auto;
  gap: 8px;
  align-items: center;
  padding: 6px 4px;
  border-radius: 6px;
  font-size: 13px;
  cursor: default;
}

/* \u53EA\u6709\u6E32\u67D3\u4E86\u64AD\u653E\u952E\u7684\u884C\u624D\u591A\u7559\u4E00\u5217\uFF0C\u4E0D\u7136\u653E\u4E0D\u4E86\u7684\u65F6\u5019\u4F1A\u7A7A\u51FA 22px */
.nmp-track[data-nmp-playable='1'] {
  grid-template-columns: 26px 1fr auto auto 22px;
}

.nmp-track[data-nmp-playable='1'] {
  cursor: pointer;
}

.nmp-track:hover {
  background: var(--nmp-bg-soft);
}

.nmp-track[data-nmp-active='1'] .nmp-track-name {
  color: var(--nmp-accent);
  font-weight: 600;
}

.nmp-track-index {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--nmp-text-dim);
  opacity: 0.7;
}

.nmp-track-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nmp-track-artist {
  font-size: 12px;
  color: var(--nmp-text-dim);
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nmp-track-time {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--nmp-text-dim);
  opacity: 0.7;
}

/* \u66F2\u76EE\u884C\u4E0A\u7684\u64AD\u653E/\u6682\u505C\u952E\u3002
   \u523B\u610F\u4E0D\u9760 hover \u624D\u663E\u5F62 \u2014\u2014 \u89E6\u5C4F\u6CA1\u6709 hover\uFF0C\u85CF\u8D77\u6765\u5C31\u7B49\u4E8E\u6CA1\u6709\u8FD9\u4E2A\u952E\uFF0C
   \u800C\u300C\u600E\u4E48\u6682\u505C\u300D\u6B63\u662F\u5B83\u8981\u56DE\u7B54\u7684\u95EE\u9898\u3002\u9ED8\u8BA4\u7ED9 0.5 \u7684\u900F\u660E\u5EA6\uFF0C\u591F\u5B89\u9759\u4E5F\u591F\u660E\u663E\u3002 */
.nmp-track-play {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--nmp-text-dim);
  opacity: 0.5;
  cursor: pointer;
  transition: opacity 0.16s ease, color 0.16s ease;
}

.nmp-track-play svg {
  width: 13px;
  height: 13px;
  fill: currentColor;
}

.nmp-track:hover .nmp-track-play,
.nmp-track-play:focus-visible,
.nmp-track[data-nmp-active='1'] .nmp-track-play {
  opacity: 1;
}

.nmp-track-play:hover {
  color: var(--nmp-accent);
}

.nmp-track[data-nmp-active='1'] .nmp-track-play {
  color: var(--nmp-accent);
}

/* ---------- \u52A0\u8F7D / \u62A5\u9519 ---------- */

.nmp-skeleton {
  background: linear-gradient(90deg, var(--nmp-bg-soft) 25%, var(--nmp-border) 50%, var(--nmp-bg-soft) 75%);
  background-size: 200% 100%;
  animation: nmp-shimmer 1.3s linear infinite;
}

@keyframes nmp-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

.nmp-line {
  height: 12px;
  border-radius: 6px;
}

.nmp-line--short {
  width: 55%;
}

.nmp-card--loading .nmp-body {
  gap: 10px;
}

.nmp-card--error {
  border-color: var(--nmp-accent);
  grid-template-columns: 44px 1fr;
}

.nmp-error-icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  font-size: 22px;
  font-weight: 700;
  color: var(--nmp-accent);
  border: 1.5px solid currentColor;
  border-radius: 50%;
}

/* ---------- \u4E34\u65F6\u63D0\u793A ---------- */

.nmp-notice {
  grid-column: 1 / -1;
  margin-top: 8px;
  padding: 7px 10px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--nmp-text-dim);
  background: var(--nmp-bg-soft);
  border-left: 2px solid var(--nmp-accent);
  border-radius: 6px;
  opacity: 0;
  max-height: 0;
  overflow: hidden;
  transition: opacity 0.2s ease, max-height 0.2s ease, margin 0.2s ease;
}

.nmp-notice[data-nmp-visible='1'] {
  opacity: 1;
  max-height: 80px;
}

/* \u6B63\u5728\u64AD\u653E\u65F6\u5C01\u9762\u5FAE\u5FAE\u547C\u5438\u4E00\u4E0B */
.nmp-card[data-nmp-playing='1'] .nmp-cover {
  animation: nmp-breathe 2.4s ease-in-out infinite;
}

@keyframes nmp-breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.04);
  }
}

@media (prefers-reduced-motion: reduce) {
  .nmp-card,
  .nmp-play,
  .nmp-track-play,
  .nmp-skeleton {
    transition: none;
    animation: none;
  }
  .nmp-lyric-line {
    transition: none;
  }
}

@media (max-width: 420px) {
  .nmp-card {
    grid-template-columns: 68px 1fr auto;
    gap: 11px;
    padding: 11px;
  }
  .nmp-cover-wrap {
    width: 68px;
    height: 68px;
  }
  .nmp-track-artist {
    display: none;
  }
  /* \u7A84\u5C4F\u4E0A\u628A\u97F3\u91CF\u6761\u7F29\u77ED\uFF0C\u522B\u628A\u65F6\u95F4\u6324\u5230\u6362\u884C */
  .nmp-volume-range {
    width: 62px;
  }
  .nmp-lyrics {
    max-height: 168px;
  }
}
` : "";
  var STYLE_ID = "nmp-styles";
  var VOLUME_KEY = "nmp-volume";
  var activeAudio = null;
  var mediaTarget = null;
  var mediaHandlersBound = false;
  var lyricCache = /* @__PURE__ */ new Map();
  var lyricPending = /* @__PURE__ */ new Map();
  function readStoredVolume() {
    try {
      if (typeof localStorage === "undefined") return 100;
      const raw = localStorage.getItem(VOLUME_KEY);
      if (raw === null) return 100;
      const value = Number(raw);
      return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 100;
    } catch {
      return 100;
    }
  }
  function storeVolume(value) {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(VOLUME_KEY, String(value));
    } catch {
    }
  }
  function injectStyles(cssText = BUNDLED_CSS) {
    if (typeof document === "undefined" || !cssText) return false;
    let tag = document.getElementById(STYLE_ID);
    if (!tag) {
      tag = document.createElement("style");
      tag.id = STYLE_ID;
      tag.textContent = cssText;
      document.head.appendChild(tag);
    }
    return true;
  }
  function ensureStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    if (document.querySelector('link[href*="netease-music.css"]')) return;
    injectStyles();
  }
  function resolveElement(target) {
    if (!target) return null;
    if (typeof target === "string") return document.querySelector(target);
    return target;
  }
  function pickSong(raw) {
    var _a, _b;
    return ((_a = raw == null ? void 0 : raw.songs) == null ? void 0 : _a[0]) || (raw == null ? void 0 : raw.song) || ((_b = raw == null ? void 0 : raw.data) == null ? void 0 : _b[0]) || raw;
  }
  async function load(src, client = getDefaultClient(), options = {}) {
    var _a, _b, _c;
    const parsed = parseShare(src, { type: options.type });
    if (!parsed.primary) {
      throw new NeteaseApiError("\u6CA1\u6709\u8BC6\u522B\u5230\u7F51\u6613\u4E91\u97F3\u4E50\u7684\u94FE\u63A5\u6216 ID");
    }
    let { type, id } = parsed.primary;
    let resourceUrl = parsed.primary.url;
    if (type === "short") {
      const resolved = await client.resolve(resourceUrl);
      if (!(resolved == null ? void 0 : resolved.type) || !(resolved == null ? void 0 : resolved.id)) {
        throw new NeteaseApiError(`\u77ED\u94FE\u89E3\u6790\u5931\u8D25\uFF1A${resourceUrl}`);
      }
      type = resolved.type;
      id = String(resolved.id);
      resourceUrl = resolved.url || resourceUrl;
    }
    if (!type) type = options.type || parsed.typeHint;
    if (!type) {
      throw new NeteaseApiError("\u8BA4\u4E0D\u51FA\u8FD9\u662F\u54EA\u4E00\u7C7B\u8D44\u6E90\uFF0C\u8BD5\u8BD5\u4F20\u5165 options.type\uFF08song/playlist/album/...\uFF09");
    }
    switch (type) {
      case "song": {
        const data = normalizeSong(pickSong(await client.song(id)));
        if (!data) throw new NeteaseApiError(`\u62FF\u4E0D\u5230\u5355\u66F2\u4FE1\u606F\uFF1A${id}`);
        return data;
      }
      case "playlist": {
        const data = normalizePlaylist(await client.playlist(id));
        if (!(data == null ? void 0 : data.id)) throw new NeteaseApiError(`\u62FF\u4E0D\u5230\u6B4C\u5355\u4FE1\u606F\uFF1A${id}`);
        return data;
      }
      case "album": {
        const data = normalizeAlbum(await client.album(id));
        if (!(data == null ? void 0 : data.id)) throw new NeteaseApiError(`\u62FF\u4E0D\u5230\u4E13\u8F91\u4FE1\u606F\uFF1A${id}`);
        return data;
      }
      case "artist": {
        const data = normalizeArtistDetail(await client.artist(id));
        if (!(data == null ? void 0 : data.id)) throw new NeteaseApiError(`\u62FF\u4E0D\u5230\u6B4C\u624B\u4FE1\u606F\uFF1A${id}`);
        return data;
      }
      case "program": {
        const data = normalizeProgram(await client.program(id));
        if (!(data == null ? void 0 : data.id)) throw new NeteaseApiError(`\u62FF\u4E0D\u5230\u58F0\u97F3\u4FE1\u606F\uFF1A${id}`);
        return data;
      }
      case "djradio": {
        const raw = await client.djradio(id);
        const data = normalizeDjradio(raw, (_b = (_a = raw == null ? void 0 : raw.programs) == null ? void 0 : _a[0]) == null ? void 0 : _b.radio);
        if (!((_c = data == null ? void 0 : data.tracks) == null ? void 0 : _c.length)) throw new NeteaseApiError(`\u7535\u53F0\u91CC\u6CA1\u6709\u53EF\u89E3\u6790\u7684\u8282\u76EE\uFF1A${id}`);
        return { ...data, id, url: buildWebUrl("djradio", id) };
      }
      default:
        throw new NeteaseApiError(`\u6682\u4E0D\u652F\u6301\u89E3\u6790\u300C${TYPE_LABELS[type] || type}\u300D\uFF0C\u53EF\u4EE5\u53BB\u5B98\u7F51\u770B\uFF1A${resourceUrl}`);
    }
  }
  async function mount(target, options = {}) {
    var _a, _b, _c, _d;
    const el = resolveElement(target);
    if (!el) {
      (_a = options.onError) == null ? void 0 : _a.call(options, new Error("\u627E\u4E0D\u5230\u6302\u8F7D\u5BB9\u5668"));
      return null;
    }
    ensureStyles();
    el.classList.add("nmp-root");
    if (options.theme) el.dataset.nmpTheme = options.theme;
    const client = options.client || (options.apiBase || options.adapter ? createClient({
      apiBase: options.apiBase,
      adapter: options.adapter,
      adapterOptions: options.adapterOptions,
      fetch: options.fetch,
      riskRetries: options.riskRetries,
      riskRetryDelay: options.riskRetryDelay,
      // 撞风控时默认在骨架屏里提示一句，不然用户只会看到它卡在那里
      onRiskRetry: options.onRiskRetry || ((attempt, total) => {
        if (el.dataset.nmpState !== "loading") return;
        showNotice(el, `\u7F51\u6613\u4E91\u98CE\u63A7\u62E6\u4E86\u4E00\u4E0B\uFF0C\u6B63\u5728\u6362\u4E2A\u8282\u70B9\u91CD\u8BD5\uFF08${attempt}/${total}\uFF09`, 2500);
      })
    }) : getDefaultClient());
    const savedState = options.resume ? readPlayback({ maxAge: options.resumeMaxAge }) : null;
    const explicitSrc = (_c = (_b = options.src) != null ? _b : el.dataset.netease) != null ? _c : "";
    const srcFromSaved = !explicitSrc && Boolean(savedState == null ? void 0 : savedState.src);
    const src = explicitSrc || (savedState == null ? void 0 : savedState.src) || el.textContent || "";
    renderSkeleton(el);
    el.dataset.nmpState = "loading";
    try {
      const data = await load(src, client, options);
      render(el, data, {
        playback: options.playback,
        playbackHint: options.playbackHint,
        volume: readStoredVolume()
      });
      if (data.playUrl) {
        const card = el.querySelector(".nmp-card");
        if (card) card.dataset.nmpSrcUrl = data.playUrl;
      }
      el.dataset.nmpSrc = src;
      if (srcFromSaved) el.dataset.nmpSrcFromSaved = "1";
      bind(el, client, options);
      if (data.type === "song" && data.id) {
        loadLyrics(el, client, data.id, { loadingText: "\u6B4C\u8BCD\u52A0\u8F7D\u4E2D\u2026" });
      }
      if (options.resume) {
        el._nmpResume = resumeLastPlayback(el, { ...options, client, saved: savedState }).catch(() => false);
      }
      return data;
    } catch (err) {
      el.dataset.nmpState = "error";
      renderError(el, (err == null ? void 0 : err.message) || String(err));
      (_d = options.onError) == null ? void 0 : _d.call(options, err);
      return null;
    }
  }
  function paintRange(input) {
    if (!input) return;
    const max = Number(input.max) || 100;
    const value = Number(input.value) || 0;
    const pct = Math.min(100, Math.max(0, value / max * 100));
    input.style.setProperty("--nmp-fill", `${pct}%`);
  }
  function syncMuteButton(root, audio) {
    const btn = root.querySelector('[data-nmp-action="mute"]');
    if (!btn || !audio) return;
    const muted = audio.muted || audio.volume === 0;
    btn.innerHTML = muted ? ICONS.mute : ICONS.volume;
    btn.setAttribute("aria-pressed", muted ? "true" : "false");
    btn.setAttribute("aria-label", muted ? "\u53D6\u6D88\u9759\u97F3" : "\u9759\u97F3");
  }
  function setAudioVolume(root, audio, value) {
    if (!audio) return;
    const volume = Math.min(100, Math.max(0, Number(value) || 0));
    audio.volume = volume / 100;
    const input = root.querySelector("[data-nmp-volume]");
    if (input) {
      input.value = String(Math.round(volume));
      paintRange(input);
    }
    storeVolume(Math.round(volume));
    syncMuteButton(root, audio);
  }
  function syncProgress(root, audio) {
    if (!audio) return;
    const seek = root.querySelector("[data-nmp-seek]");
    const currentEl = root.querySelector(".nmp-time-cur");
    const totalEl = root.querySelector(".nmp-time-total");
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const current = Number.isFinite(audio.currentTime) && audio.currentTime > 0 ? audio.currentTime : 0;
    if (currentEl) currentEl.textContent = formatDuration(current * 1e3);
    if (totalEl) totalEl.textContent = duration ? formatDuration(duration * 1e3) : "--:--";
    if (seek && duration && root.dataset.nmpSeeking !== "1") {
      seek.value = String(Math.round(current / duration * 1e3));
      paintRange(seek);
    }
  }
  function isEmptyLyric(raw) {
    return !(raw == null ? void 0 : raw.lyric) && !(raw == null ? void 0 : raw.translated) && !(raw == null ? void 0 : raw.roma);
  }
  function fetchLyric(client, songId) {
    const key = String(songId || "");
    if (!key) return Promise.resolve({ raw: null, failed: true });
    const cached = lyricCache.get(key);
    if (cached) return Promise.resolve({ raw: cached, failed: false });
    const inflight = lyricPending.get(key);
    if (inflight) return inflight;
    const job = (async () => {
      try {
        const raw = normalizeLyric(await client.lyric(songId));
        if (!isEmptyLyric(raw)) lyricCache.set(key, raw);
        return { raw, failed: false };
      } catch {
        return { raw: null, failed: true };
      } finally {
        lyricPending.delete(key);
      }
    })();
    lyricPending.set(key, job);
    return job;
  }
  async function loadLyrics(root, client, songId, options = {}) {
    const panel = root.querySelector(".nmp-lyrics");
    if (!panel || !songId) return null;
    const key = String(songId);
    if (panel.dataset.nmpLyricsSong === key && panel.dataset.nmpLyrics === "ready") return null;
    panel.dataset.nmpLyricsSong = key;
    const cached = lyricCache.get(key);
    if (cached) return paintLyrics(panel, cached, key);
    setLyricsState(panel, "loading", options.loadingText || "\u6B4C\u8BCD\u52A0\u8F7D\u4E2D\u2026");
    const { raw, failed } = options.job ? await options.job : await fetchLyric(client, songId);
    if (panel.dataset.nmpLyricsSong !== key) return null;
    if (failed) {
      setLyricsState(panel, "error", "\u6B4C\u8BCD\u6CA1\u62C9\u5230\uFF08\u53EF\u80FD\u88AB\u98CE\u63A7\u62E6\u4E86\u4E00\u4E0B\uFF09\uFF0C\u70B9\u64AD\u653E\u53EF\u4EE5\u518D\u8BD5");
      return null;
    }
    return paintLyrics(panel, raw, key);
  }
  function paintLyrics(panel, raw, songId) {
    const text = String((raw == null ? void 0 : raw.lyric) || "");
    const lines = mergeTranslation(parseLrc(text), raw == null ? void 0 : raw.translated);
    const plain = hasTimestamp(text) ? "" : text.trim();
    panel._nmpLines = lines;
    panel._nmpLyricsFor = String(songId);
    return renderLyrics(panel, lines, { plain, message: "\u8FD9\u9996\u6B4C\u6CA1\u6709\u6B4C\u8BCD" });
  }
  var playToken = 0;
  function findRow(root, songId) {
    if (!songId) return null;
    return Array.from(root.querySelectorAll(".nmp-track[data-nmp-song]")).find(
      (row) => row.dataset.nmpSong === songId
    ) || null;
  }
  function songNameOf(root, songId) {
    var _a;
    const row = findRow(root, songId);
    const nameEl = row ? row.querySelector(".nmp-track-name") : null;
    if (nameEl) return nameEl.textContent.trim();
    const card = root.querySelector(".nmp-card");
    if (card && card.dataset.nmpSong === songId) {
      return ((_a = card.querySelector(".nmp-title")) == null ? void 0 : _a.textContent.trim()) || "";
    }
    return "";
  }
  function knownUnplayableReason(root, songId) {
    const row = findRow(root, songId);
    if ((row == null ? void 0 : row.dataset.nmpUnplayable) === "1") return row.dataset.nmpUnplayableReason || "\u8FD9\u9996\u6B4C\u653E\u4E0D\u4E86";
    const card = root.querySelector(".nmp-card");
    if ((card == null ? void 0 : card.dataset.nmpUnplayable) === "1") {
      return card.dataset.nmpUnplayableReason || "\u8FD9\u9996\u6B4C\u653E\u4E0D\u4E86";
    }
    return "";
  }
  function markUnplayable(root, songId, reason) {
    var _a;
    const text = reason || "\u8FD9\u9996\u6B4C\u6682\u65F6\u653E\u4E0D\u4E86";
    const row = findRow(root, songId);
    const target = row || (((_a = root.querySelector(".nmp-card")) == null ? void 0 : _a.dataset.nmpSong) === songId ? root.querySelector(".nmp-card") : null);
    if (!target) return;
    target.dataset.nmpUnplayable = "1";
    target.dataset.nmpUnplayableReason = text;
    if (row) row.title = text;
  }
  function failToPlay(root, songId, reason) {
    const text = reason || "\u8FD9\u9996\u6B4C\u6682\u65F6\u653E\u4E0D\u4E86";
    markUnplayable(root, songId, text);
    const name = songNameOf(root, songId);
    showNotice(root, `${name ? `\u300A${name}\u300B` : "\u8FD9\u9996"}\u653E\u4E0D\u4E86\uFF1A${text}`, 4200);
  }
  function playErrorMessage(err) {
    const name = (err == null ? void 0 : err.name) || "";
    if (name === "NotAllowedError") return "\u6D4F\u89C8\u5668\u62E6\u4E86\u81EA\u52A8\u64AD\u653E\uFF0C\u70B9\u4E00\u4E0B\u64AD\u653E\u952E\u5C31\u884C";
    if (name === "NotSupportedError") return "\u8FD9\u4E2A\u5730\u5740\u653E\u4E0D\u4E86\uFF08\u76F4\u94FE\u53EF\u80FD\u5DF2\u7ECF\u8FC7\u671F\u6216\u9632\u76D7\u94FE\uFF09";
    if (name === "AbortError") return "\u64AD\u653E\u88AB\u6253\u65AD\u4E86\uFF0C\u518D\u70B9\u4E00\u6B21";
    return (err == null ? void 0 : err.message) || String(err);
  }
  function isAutoplayBlocked(err) {
    return ((err == null ? void 0 : err.name) || "") === "NotAllowedError";
  }
  function stopAudio(audio) {
    if (!audio) return;
    try {
      audio.pause();
    } catch {
    }
    try {
      audio.removeAttribute("src");
      if (typeof audio.load === "function") audio.load();
    } catch {
    }
    delete audio.dataset.nmpSong;
    delete audio.dataset.nmpLoading;
    delete audio.dataset.nmpTarget;
  }
  function stopDetachedAudio() {
    if (!activeAudio) return;
    if (typeof activeAudio.isConnected === "boolean" && !activeAudio.isConnected) {
      stopAudio(activeAudio);
      activeAudio = null;
    }
  }
  function resetLyricsFor(root, songId) {
    const panel = root.querySelector(".nmp-lyrics");
    if (!panel) return;
    if (panel._nmpLyricsFor && panel._nmpLyricsFor !== String(songId)) return;
    setLyricsState(panel, "error", "\u8FD9\u9996\u6B4C\u653E\u4E0D\u51FA\u6765\uFF0C\u6240\u4EE5\u6CA1\u6709\u6B4C\u8BCD\u53EF\u4EE5\u8DDF");
    delete panel._nmpLyricsFor;
    delete panel.dataset.nmpLyricsSong;
  }
  function metaFor(root, songId) {
    var _a, _b, _c, _d, _e;
    const row = findRow(root, songId);
    const card = root.querySelector(".nmp-card");
    const cover = ((_a = card == null ? void 0 : card.querySelector("img.nmp-cover")) == null ? void 0 : _a.getAttribute("src")) || "";
    if (row) {
      return {
        title: ((_b = row.querySelector(".nmp-track-name")) == null ? void 0 : _b.textContent.trim()) || "",
        artist: ((_c = row.querySelector(".nmp-track-artist")) == null ? void 0 : _c.textContent.trim()) || "",
        album: ((_d = card == null ? void 0 : card.querySelector(".nmp-title")) == null ? void 0 : _d.textContent.trim()) || "",
        artwork: cover
      };
    }
    const sub = card == null ? void 0 : card.querySelector(".nmp-sub");
    const artist = sub ? sub.textContent.split("\xB7")[0].trim() : "";
    return {
      title: ((_e = card == null ? void 0 : card.querySelector(".nmp-title")) == null ? void 0 : _e.textContent.trim()) || "",
      artist,
      album: "",
      artwork: cover
    };
  }
  function syncNowPlaying(root, client, state, options = {}) {
    mediaTarget = { root, client, autoNext: options.autoNext !== false };
    if (!mediaHandlersBound) {
      mediaHandlersBound = syncMediaSession({ handlers: mediaActions() });
    }
    const audio = root.querySelector(".nmp-audio");
    const songId = (audio == null ? void 0 : audio.dataset.nmpSong) || "";
    if (songId) syncMediaSession({ meta: metaFor(root, songId) });
    setPlaybackState(state);
    if (state === "playing") {
      setPositionState({
        duration: audio == null ? void 0 : audio.duration,
        position: audio == null ? void 0 : audio.currentTime,
        playbackRate: (audio == null ? void 0 : audio.playbackRate) || 1
      });
    } else if (state === "none") {
      setPositionState({ duration: 0 });
    }
  }
  function mediaActions() {
    const targetAudio = () => {
      var _a;
      return ((_a = mediaTarget == null ? void 0 : mediaTarget.root) == null ? void 0 : _a.querySelector(".nmp-audio")) || null;
    };
    return {
      play: () => {
        const audio = targetAudio();
        const songId = audio == null ? void 0 : audio.dataset.nmpSong;
        if (!audio) return;
        if (songId) playSong(mediaTarget.root, mediaTarget.client, songId);
      },
      pause: () => {
        var _a;
        return (_a = targetAudio()) == null ? void 0 : _a.pause();
      },
      seekto: (details) => {
        const audio = targetAudio();
        const seconds = details == null ? void 0 : details.seekTime;
        if (audio && Number.isFinite(seconds)) audio.currentTime = seconds;
      },
      nexttrack: () => {
        if (mediaTarget == null ? void 0 : mediaTarget.autoNext) playNext(mediaTarget.root, mediaTarget.client);
      },
      previoustrack: () => {
        if (mediaTarget == null ? void 0 : mediaTarget.autoNext) playPrev(mediaTarget.root, mediaTarget.client);
      }
    };
  }
  async function playSong(root, client, songId, options = {}) {
    const card = root.querySelector(".nmp-card");
    const audio = root.querySelector(".nmp-audio");
    if (!card || !audio) return;
    const current = audio.dataset.nmpSong === songId;
    const loading = audio.dataset.nmpLoading === songId;
    if (current && !audio.paused || loading) {
      delete audio.dataset.nmpLoading;
      playToken += 1;
      audio.pause();
      syncPlayButton(root, false);
      return;
    }
    const known = knownUnplayableReason(root, songId);
    if (known && !options.resumeAt) {
      failToPlay(root, songId, known);
      return;
    }
    stopDetachedAudio();
    if (activeAudio && activeAudio !== audio) {
      activeAudio.pause();
    }
    activeAudio = audio;
    const lyricJob = fetchLyric(client, songId);
    if (current && audio.getAttribute("src")) {
      try {
        await audio.play();
      } catch (err) {
        if (isAutoplayBlocked(err)) showResumeBar(root, options.resumeState);
        else showNotice(root, `\u64AD\u653E\u5931\u8D25\uFF1A${playErrorMessage(err)}`);
      }
      return;
    }
    const token = ++playToken;
    audio.dataset.nmpLoading = songId;
    audio.dataset.nmpTarget = songId;
    const abandon = () => {
      if (audio.dataset.nmpLoading === songId) delete audio.dataset.nmpLoading;
      if (audio.dataset.nmpTarget === songId) delete audio.dataset.nmpTarget;
    };
    try {
      const info = normalizeSongUrl(await client.songUrl(songId));
      if (token !== playToken) return abandon();
      delete audio.dataset.nmpLoading;
      if (!info.available) {
        abandon();
        failToPlay(root, songId, info.reason);
        return;
      }
      audio.src = info.url;
      audio.dataset.nmpSong = songId;
      delete audio.dataset.nmpTarget;
      syncProgress(root, audio);
      loadLyrics(root, client, songId, { loadingText: "\u6B4C\u8BCD\u52A0\u8F7D\u4E2D\u2026", job: lyricJob });
      await audio.play();
      if (Number.isFinite(options.resumeAt) && options.resumeAt > 1) {
        try {
          audio.currentTime = options.resumeAt;
        } catch {
        }
      }
      syncNowPlaying(root, client, "playing", options);
    } catch (err) {
      if (token !== playToken) return abandon();
      delete audio.dataset.nmpLoading;
      abandon();
      if (isAutoplayBlocked(err)) {
        showResumeBar(root, options.resumeState);
        return;
      }
      stopAudio(audio);
      resetLyricsFor(root, songId);
      syncPlayButton(root, false);
      failToPlay(root, songId, playErrorMessage(err));
    }
  }
  function showResumeBar(root, state = {}) {
    const card = root.querySelector(".nmp-card");
    if (!card || card.querySelector("[data-nmp-resume]")) return null;
    card.insertAdjacentHTML("afterbegin", resumeBar(state || {}));
    return card.querySelector("[data-nmp-resume]");
  }
  function resumePlayback(root, client) {
    var _a;
    const audio = root.querySelector(".nmp-audio");
    const bar = root.querySelector("[data-nmp-resume]");
    if (!audio) return;
    const dismiss = () => bar == null ? void 0 : bar.remove();
    if (audio.dataset.nmpSong && audio.getAttribute("src")) {
      audio.play().then(dismiss, (err) => {
        showNotice(root, `\u8FD8\u662F\u653E\u4E0D\u4E86\uFF1A${playErrorMessage(err)}`);
      });
      return;
    }
    const songId = audio.dataset.nmpSong || ((_a = root.querySelector(".nmp-card")) == null ? void 0 : _a.dataset.nmpSong) || "";
    if (!songId) {
      dismiss();
      showNotice(root, "\u4E0D\u77E5\u9053\u8981\u63A5\u7740\u653E\u54EA\u4E00\u9996\uFF0C\u91CD\u65B0\u89E3\u6790\u4E00\u6B21\u5427");
      return;
    }
    Promise.resolve(playSong(root, client, songId)).then(dismiss);
  }
  async function playPrev(root, client) {
    const audio = root.querySelector(".nmp-audio");
    if (!audio) return false;
    const rows = Array.from(root.querySelectorAll('.nmp-track[data-nmp-playable="1"]'));
    const index = rows.findIndex((row) => row.dataset.nmpSong === audio.dataset.nmpSong);
    if (index <= 0) return false;
    await playSong(root, client, rows[index - 1].dataset.nmpSong);
    return true;
  }
  function playbackStateOf(root) {
    var _a, _b, _c;
    const audio = root.querySelector(".nmp-audio");
    const card = root.querySelector(".nmp-card");
    const songId = (audio == null ? void 0 : audio.dataset.nmpSong) || "";
    const row = songId ? findRow(root, songId) : null;
    const sub = card == null ? void 0 : card.querySelector(".nmp-sub");
    return {
      src: root.dataset.nmpSrc || "",
      type: root.dataset.nmpType || "",
      songId,
      songName: songId ? songNameOf(root, songId) : "",
      artistText: row ? ((_a = row.querySelector(".nmp-track-artist")) == null ? void 0 : _a.textContent.trim()) || "" : sub ? sub.textContent.split("\xB7")[0].trim() : "",
      listName: ((_b = card == null ? void 0 : card.querySelector(".nmp-title")) == null ? void 0 : _b.textContent.trim()) || "",
      cover: ((_c = card == null ? void 0 : card.querySelector("img.nmp-cover")) == null ? void 0 : _c.getAttribute("src")) || "",
      position: Number.isFinite(audio == null ? void 0 : audio.currentTime) ? audio.currentTime : 0,
      playing: Boolean(audio && songId && !audio.paused)
    };
  }
  async function resumeLastPlayback(target, options = {}) {
    var _a;
    const el = resolveElement(target);
    if (!el) return false;
    const saved = options.saved || readPlayback({ maxAge: options.resumeMaxAge });
    if (!(saved == null ? void 0 : saved.songId)) return false;
    const mountedSrc = el.dataset.nmpSrc || el.dataset.netease || "";
    const fromSaved = el.dataset.nmpSrcFromSaved === "1";
    if (!shouldResume(saved, { src: mountedSrc, force: fromSaved })) return false;
    const onCard = ((_a = el.querySelector(".nmp-card")) == null ? void 0 : _a.dataset.nmpSong) === String(saved.songId) || Boolean(findRow(el, String(saved.songId)));
    if (!onCard) return false;
    const client = options.client || getDefaultClient();
    await playSong(el, client, String(saved.songId), {
      resumeAt: Number(saved.position) || 0,
      resumeState: { songName: saved.songName, listName: saved.listName, artistText: saved.artistText },
      autoNext: options.autoNext
    });
    return true;
  }
  async function playNext(root, client) {
    const audio = root.querySelector(".nmp-audio");
    if (!audio) return false;
    const rows = Array.from(root.querySelectorAll('.nmp-track[data-nmp-playable="1"]'));
    const index = rows.findIndex((row) => row.dataset.nmpSong === audio.dataset.nmpSong);
    if (index < 0) return false;
    const next = rows[index + 1];
    if (!next) return false;
    await playSong(root, client, next.dataset.nmpSong);
    return true;
  }
  function syncPlayButton(root, playing) {
    const card = root.querySelector(".nmp-card");
    const audio = root.querySelector(".nmp-audio");
    const currentId = (audio == null ? void 0 : audio.dataset.nmpSong) || "";
    if (card) card.dataset.nmpPlaying = playing ? "1" : "0";
    const cover = root.querySelector(".nmp-play");
    if (cover) {
      cover.innerHTML = playing ? ICONS.pause : ICONS.play;
      cover.setAttribute("aria-label", playing ? "\u6682\u505C" : "\u64AD\u653E");
    }
    root.querySelectorAll(".nmp-track[data-nmp-song]").forEach((row) => {
      var _a;
      const isCurrent = Boolean(currentId) && row.dataset.nmpSong === currentId;
      if (isCurrent) row.dataset.nmpActive = "1";
      else row.removeAttribute("data-nmp-active");
      const btn = row.querySelector(".nmp-track-play");
      if (!btn) return;
      const showPause = isCurrent && playing;
      btn.innerHTML = showPause ? ICONS.pause : ICONS.play;
      const name = ((_a = row.querySelector(".nmp-track-name")) == null ? void 0 : _a.textContent) || "";
      btn.setAttribute("aria-label", `${showPause ? "\u6682\u505C" : "\u64AD\u653E"} ${name}`.trim());
    });
  }
  function toggleTarget(root, action) {
    if (action.classList.contains("nmp-track-play")) return action.dataset.nmpSong || "";
    const audio = root.querySelector(".nmp-audio");
    const card = root.querySelector(".nmp-card");
    return (audio == null ? void 0 : audio.dataset.nmpSong) || (card == null ? void 0 : card.dataset.nmpSong) || action.dataset.nmpSong || "";
  }
  var boundListeners = /* @__PURE__ */ new WeakMap();
  function detachListeners(root) {
    const prev = boundListeners.get(root);
    if (!prev) return;
    root.removeEventListener("click", prev.onClick);
    if (typeof document !== "undefined" && prev.onVisibility) {
      document.removeEventListener("visibilitychange", prev.onVisibility);
    }
    if (typeof window !== "undefined" && prev.onPageHide) {
      window.removeEventListener("pagehide", prev.onPageHide);
    }
    boundListeners.delete(root);
  }
  function bind(root, client, options = {}) {
    if (root.dataset.nmpBound === "1") return;
    detachListeners(root);
    root.dataset.nmpBound = "1";
    const tracked = { onClick: null, onVisibility: null, onPageHide: null };
    boundListeners.set(root, tracked);
    const audio = root.querySelector(".nmp-audio");
    const seek = root.querySelector("[data-nmp-seek]");
    const volumeInput = root.querySelector("[data-nmp-volume]");
    const lyricPanel = root.querySelector(".nmp-lyrics");
    const playbackOff = options.playback === false;
    const offHint = options.playbackHint || "\u5F53\u524D\u540E\u7AEF\u62FF\u4E0D\u5230\u64AD\u653E\u76F4\u94FE\uFF0C\u53EA\u80FD\u770B\u4FE1\u606F";
    const autoNext = options.autoNext !== false;
    const pauseWhenHidden = options.pauseWhenHidden === true;
    const wantResume = options.resume === true;
    const saver = wantResume ? createThrottledSave(1e3) : null;
    if (audio) {
      setAudioVolume(root, audio, readStoredVolume());
    }
    if (seek) {
      paintRange(seek);
      seek.addEventListener("input", () => {
        if (!audio) return;
        root.dataset.nmpSeeking = "1";
        paintRange(seek);
        const duration = audio.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;
        const seconds = Number(seek.value) / 1e3 * duration;
        audio.currentTime = seconds;
        const currentEl = root.querySelector(".nmp-time-cur");
        if (currentEl) currentEl.textContent = formatDuration(seconds * 1e3);
      });
      const endSeek = () => {
        root.dataset.nmpSeeking = "0";
        if (audio) syncProgress(root, audio);
      };
      seek.addEventListener("change", endSeek);
      seek.addEventListener("blur", endSeek);
    }
    if (volumeInput) {
      paintRange(volumeInput);
      volumeInput.addEventListener("input", () => {
        if (!audio) return;
        const value = Number(volumeInput.value);
        if (audio.muted && value > 0) audio.muted = false;
        setAudioVolume(root, audio, value);
      });
    }
    const onRootClick = (event) => {
      var _a;
      const action = event.target.closest("[data-nmp-action]");
      if (action) {
        const name = action.dataset.nmpAction;
        if (name === "toggle") {
          const songId = toggleTarget(root, action);
          if (songId) playSong(root, client, songId);
          return;
        }
        if (name === "resume") {
          resumePlayback(root, client);
          return;
        }
        if (name === "resume-dismiss") {
          clearPlayback();
          (_a = action.closest("[data-nmp-resume]")) == null ? void 0 : _a.remove();
          return;
        }
        if (name === "mute") {
          if (!audio) return;
          const muted = audio.muted || audio.volume === 0;
          if (muted) {
            audio.muted = false;
            if (audio.volume === 0) setAudioVolume(root, audio, 100);
            else syncMuteButton(root, audio);
          } else {
            audio.muted = true;
            syncMuteButton(root, audio);
          }
          return;
        }
        if (name === "expand") {
          const list = root.querySelector(".nmp-tracks");
          if (!list) return;
          const open = list.hidden;
          list.hidden = !open;
          action.setAttribute("aria-expanded", String(open));
          action.textContent = open ? `\u6536\u8D77\u66F2\u76EE` : `\u5C55\u5F00\u5168\u90E8 ${list.children.length} \u9996`;
          return;
        }
      }
      const lyricLine = event.target.closest(".nmp-lyric-line[data-nmp-time]");
      if (lyricLine) {
        const seconds = Number(lyricLine.dataset.nmpTime);
        if (!audio || !Number.isFinite(seconds)) return;
        if (!audio.src) {
          showNotice(root, "\u5148\u70B9\u4E00\u4E0B\u64AD\u653E\u952E\uFF0C\u518D\u70B9\u6B4C\u8BCD\u5C31\u80FD\u8DF3\u8FC7\u53BB");
          return;
        }
        audio.currentTime = seconds;
        if (audio.paused) audio.play().catch(() => {
        });
        return;
      }
      const track = event.target.closest(".nmp-track[data-nmp-song]");
      if (track) {
        if (playbackOff) {
          showNotice(root, offHint);
          return;
        }
        playSong(root, client, track.dataset.nmpSong);
      }
    };
    tracked.onClick = onRootClick;
    root.addEventListener("click", onRootClick);
    const snapshot = (force = false) => {
      if (!saver) return;
      const state = playbackStateOf(root);
      if (!state.songId || !state.playing && state.position < 3) return;
      saver.save(state, { force });
    };
    if (audio) {
      audio.addEventListener("play", () => {
        syncPlayButton(root, true);
        syncNowPlaying(root, client, "playing", options);
        snapshot(true);
      });
      audio.addEventListener("pause", () => {
        syncPlayButton(root, false);
        syncNowPlaying(root, client, "paused", options);
        snapshot(true);
      });
      audio.addEventListener("ended", () => {
        syncPlayButton(root, false);
        setPlaybackState("paused");
        root.dataset.nmpSeeking = "0";
        snapshot(true);
        if (autoNext) playNext(root, client);
      });
      audio.addEventListener("loadedmetadata", () => syncProgress(root, audio));
      audio.addEventListener("durationchange", () => {
        syncProgress(root, audio);
        setPositionState({
          duration: audio.duration,
          position: audio.currentTime,
          playbackRate: audio.playbackRate || 1
        });
      });
      audio.addEventListener("timeupdate", () => {
        syncProgress(root, audio);
        snapshot(false);
        setPositionState({
          duration: audio.duration,
          position: audio.currentTime,
          playbackRate: audio.playbackRate || 1
        });
        if ((lyricPanel == null ? void 0 : lyricPanel.dataset.nmpLyrics) !== "ready") return;
        if (lyricPanel._nmpLyricsFor !== audio.dataset.nmpSong) return;
        highlightLyric(root, findLineIndex(lyricPanel._nmpLines || [], audio.currentTime));
      });
      audio.addEventListener("error", () => {
        if (!audio.src || !audio.dataset.nmpSong) return;
        const failedId = audio.dataset.nmpSong;
        const reason = "\u97F3\u9891\u52A0\u8F7D\u5931\u8D25\uFF08\u76F4\u94FE\u53EF\u80FD\u8FC7\u671F\u4E86\uFF0C\u6216\u8005\u88AB\u9632\u76D7\u94FE\u62E6\u4E86\uFF09";
        stopAudio(audio);
        resetLyricsFor(root, failedId);
        syncPlayButton(root, false);
        setPlaybackState("paused");
        failToPlay(root, failedId, reason);
      });
    }
    if (pauseWhenHidden && typeof document !== "undefined") {
      tracked.onVisibility = () => {
        if (document.hidden && activeAudio && !activeAudio.paused) activeAudio.pause();
      };
      document.addEventListener("visibilitychange", tracked.onVisibility);
    }
    if (saver && typeof window !== "undefined") {
      tracked.onPageHide = () => {
        const state = playbackStateOf(root);
        if (state.songId && (state.playing || state.position >= 3)) {
          saver.save(state, { force: true });
        }
      };
      window.addEventListener("pagehide", tracked.onPageHide);
    }
    if (lyricPanel) {
      lyricPanel.addEventListener("scroll", () => {
        if (lyricPanel.dataset.nmpLyricsProgram === "1") return;
        lyricPanel.dataset.nmpLyricsAuto = "0";
        clearTimeout(lyricPanel._nmpAutoTimer);
        lyricPanel._nmpAutoTimer = setTimeout(() => {
          lyricPanel.dataset.nmpLyricsAuto = "1";
          delete lyricPanel.dataset.nmpLyricsActive;
          if (audio && lyricPanel.dataset.nmpLyrics === "ready" && lyricPanel._nmpLyricsFor === audio.dataset.nmpSong) {
            highlightLyric(root, findLineIndex(lyricPanel._nmpLines || [], audio.currentTime));
          }
        }, 4e3);
      });
    }
    return options;
  }
  async function autoInit(options = {}) {
    if (typeof document === "undefined") return [];
    ensureStyles();
    const selector = options.selector || "[data-netease]";
    const nodes = Array.from(document.querySelectorAll(selector)).filter(
      (el) => el.dataset.nmpBound !== "1"
    );
    const results = await Promise.all(
      nodes.map(async (el) => {
        const theme = options.theme || el.dataset.neteaseTheme;
        const apiBase = el.dataset.neteaseApi || options.apiBase;
        const adapter = el.dataset.neteaseAdapter || options.adapter;
        const src = el.dataset.netease || el.textContent;
        const data = await mount(el, { ...options, src, apiBase, adapter, theme });
        return { el, data };
      })
    );
    return results;
  }
  function unmount(target) {
    var _a;
    const el = resolveElement(target);
    if (!el) return;
    const audio = (_a = el.querySelector) == null ? void 0 : _a.call(el, ".nmp-audio");
    if (audio) {
      stopAudio(audio);
      if (activeAudio === audio) activeAudio = null;
    }
    if ((mediaTarget == null ? void 0 : mediaTarget.root) === el) {
      mediaTarget = null;
      clearMediaSession();
    }
    detachListeners(el);
    el.classList.remove("nmp-root");
    el.removeAttribute("data-nmp-bound");
    el.removeAttribute("data-nmp-state");
    el.removeAttribute("data-nmp-src");
    el.removeAttribute("data-nmp-src-from-saved");
    el.innerHTML = "";
  }
  var NeteaseMusic = {
    VERSION: VERSION2,
    mount,
    unmount,
    autoInit,
    load,
    injectStyles,
    resumeLastPlayback,
    createClient,
    getDefaultClient,
    setDefaultClient,
    parseShare,
    parseUrl,
    buildWebUrl,
    looksLikeShare,
    TYPE_LABELS,
    RESOURCE_TYPES,
    normalize: normalize_exports,
    lyric: lyric_exports,
    renderLyrics,
    highlightLyric,
    isMediaSessionSupported,
    readPlayback,
    savePlayback,
    clearPlayback,
    ADAPTERS,
    NeteaseApiError,
    isRiskControlResponse
  };
  var index_default = NeteaseMusic;
  return __toCommonJS(index_exports);
})();
