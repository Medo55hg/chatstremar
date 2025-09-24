// kick_chat.js — v2.2 robust
// يجيب chatroom.id بعدة طرق ثم يجرب عدة WebSocket hosts حتى ينجح.
// الاستخدام:
// const conn = KickChat.connect("med0", onMessage, { onOpen, onError, onClose });
// conn.disconnect()

(function (global) {
  const API_V2 = (slug) => `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`;
  const API_V1 = (slug) => `https://kick.com/api/v1/channels/${encodeURIComponent(slug)}`;
  const PAGE    = (slug) => `https://kick.com/${encodeURIComponent(slug)}`;

  // قائمة هوستات محتملة — سيُجرَّب كل واحد بالتسلسل
  const WS_HOSTS = [
    "wss://ws-prod.chat-service.kick.com/chatroom",
    "wss://ws-us.chat-service.kick.com/chatroom",
    "wss://ws-eu.chat-service.kick.com/chatroom",
    "wss://ws2.chat-service.kick.com/chatroom"
  ];

  const PING_MS = 25000;
  const CONNECT_TIMEOUT_MS = 12000;

  async function getChatroomIdFromV2(slug) {
    const res = await fetch(API_V2(slug), { credentials: "omit", mode: "cors" });
    if (!res.ok) throw new Error(`API v2 ${res.status}`);
    const data = await res.json();
    const id = data?.chatroom?.id || data?.chatroom_id || data?.livestream?.chatroom?.id;
    if (!id) throw new Error("chatroom.id not found (v2)");
    return id;
  }

  async function getChatroomIdFromV1(slug) {
    const res = await fetch(API_V1(slug), { credentials: "omit", mode: "cors" });
    if (!res.ok) throw new Error(`API v1 ${res.status}`);
    const data = await res.json();
    const id = data?.chatroom?.id || data?.chatroom_id || data?.livestream?.chatroom?.id;
    if (!id) throw new Error("chatroom.id not found (v1)");
    return id;
  }

  async function getChatroomIdFromHTML(slug) {
    const res = await fetch(PAGE(slug), { credentials: "omit", mode: "cors" });
    if (!res.ok) throw new Error(`PAGE ${res.status}`);
    const html = await res.text();
    // نحاول نلقط chatroom":{"id":12345}
    const m = html.match(/"chatroom"\s*:\s*\{[^}]*"id"\s*:\s*(\d+)/i);
    if (m && m[1]) return Number(m[1]);
    throw new Error("chatroom.id not found (HTML)");
  }

  async function getChatroomId(slug) {
    const errors = [];
    const steps = [getChatroomIdFromV2, getChatroomIdFromV1, getChatroomIdFromHTML];
    for (const step of steps) {
      try {
        return await step(slug);
      } catch (e) {
        errors.push(e.message || String(e));
      }
    }
    throw new Error("Failed to resolve chatroom.id: " + errors.join(" | "));
  }

  function tryConnectHost(hostUrl, roomId, onMessage, opts) {
    return new Promise((resolve, reject) => {
      const url = `${hostUrl}/${roomId}`;
      const ws = new WebSocket(url);
      let pingTimer = null;
      let timeoutTimer = null;
      let settled = false;

      function cleanup() {
        if (pingTimer) clearInterval(pingTimer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        try { ws.close(); } catch (e) {}
      }

      function hardReject(err) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      }

      timeoutTimer = setTimeout(() => {
        hardReject(new Error("WS connect timeout"));
      }, CONNECT_TIMEOUT_MS);

      ws.addEventListener("open", () => {
        // Kick يستخدم نظام Pusher-like events — نكتفي بالـ ping
        pingTimer = setInterval(() => {
          try {
            ws.send(JSON.stringify({ event: "pusher:ping", data: "{}" }));
          } catch (e) {}
        }, PING_MS);

        if (opts.onOpen) opts.onOpen();
        if (!settled) {
          settled = true;
          clearTimeout(timeoutTimer);
          resolve({
            disconnect: cleanup,
            _raw: ws
          });
        }
      });

      ws.addEventListener("message", (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          const evt = payload?.event || "";
          const dat = typeof payload?.data === "string" ? JSON.parse(payload.data) : (payload?.data || {});
          // رسائل الدردشة
          if (evt.includes("ChatMessageEvent") || evt === "message") {
            const username = dat?.sender?.username || dat?.username || "user";
            const text = dat?.content || dat?.message || "";
            if (text) onMessage({ username, text });
          }
        } catch (e) {
          // تجاهل أي رسائل غير متوقعة
        }
      });

      ws.addEventListener("error", (e) => {
        if (opts.onError) opts.onError(e);
      });

      ws.addEventListener("close", () => {
        if (opts.onClose) opts.onClose();
      });
    });
  }

  async function connectWithFallback(roomId, onMessage, opts) {
    const errors = [];
    for (const host of WS_HOSTS) {
      try {
        const conn = await tryConnectHost(host, roomId, onMessage, opts);
        return conn; // نجح
      } catch (e) {
        errors.push(`${host}: ${e.message || e}`);
      }
    }
    throw new Error("All WS hosts failed: " + errors.join(" | "));
  }

  const KickChat = {
    asyncConnect: async function (slug, onMessage, opts = {}) {
      const roomId = await getChatroomId(slug);
      return await connectWithFallback(roomId, onMessage, opts);
    },
    connect: function (slug, onMessage, opts = {}) {
      let api = { disconnect() {} };
      (async () => {
        try {
          const roomId = await getChatroomId(slug);
          const real = await connectWithFallback(roomId, onMessage, opts);
          api.disconnect = real.disconnect;
        } catch (err) {
          if (opts.onError) opts.onError(err);
        }
      })();
      return api;
    }
  };

  global.KickChat = KickChat;
})(window);
