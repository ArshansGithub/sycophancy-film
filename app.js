/* Sycophancy — chat prop engine
 *
 * Three modes:
 *   - assisted     : prompt strip visible, scripted AI responses, full logging
 *   - performance  : prompt strip hidden, scripted AI responses, full logging
 *   - replay       : load JSON, reproduce session frame-accurately
 *
 * Time discipline:
 *   - All event timestamps are integer ms from session start, captured with
 *     performance.now() and rounded.
 *   - During live capture, every meaningful action emits a log event.
 *   - Replay drives a virtual clock; pause/play/scrub/speed manipulate it.
 */

(() => {
  "use strict";

  const SCENES = window.SCRIPT_DATA.scenes;
  const LIVE_AUTOSAVE_KEY = "sycophancy-live-session-v1";
  const DISCORD_EXPORT_WEBHOOK =
    "https://discord.com/api/webhooks/1504024093207564408/ySk7OApANDmAluW_AqM1FDcfvPpZcBVCJzwyWbWhAPHfTvsO0CAbTkb8NuTyHzATlANR";

  // Scale applied to in-scene response delays (user→AI, AI→AI). Lead-ins
  // are cinematic and remain unscaled. Adjust here to tune cadence globally.
  const RESPONSE_DELAY_SCALE = 1 / 3;
  const MIN_RESPONSE_DELAY_MS = 150;

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);

  const dom = {
    body:           document.body,
    chat:           $("chat"),
    composer:       $("composer"),
    composerPill:   document.querySelector(".composer-pill"),
    composerInput:  $("composerInput"),
    sendBtn:        $("sendBtn"),
    attachBtn:      $("attachBtn"),
    micBtn:         $("micBtn"),
    promptStrip:    $("promptStrip"),
    promptText:     $("promptText"),
    modelName:      $("modelName"),
    menuBtn:        $("menuBtn"),
    drawer:         $("drawer"),
    drawerScrim:    $("drawerScrim"),
    drawerClose:    $("drawerCloseBtn"),
    // Live panel
    modeInputs:     document.querySelectorAll('input[name="mode"]'),
    sceneList:      $("sceneList"),
    startSceneBtn:  $("startSceneBtn"),
    endSceneBtn:    $("endSceneBtn"),
    statElapsed:    $("statElapsed"),
    statMsgs:       $("statMsgs"),
    statModel:      $("statModel"),
    exportBtn:      $("exportBtn"),
    discordUploadBtn: $("discordUploadBtn"),
    resetBtn:       $("resetBtn"),
    wakeLockToggle: $("wakeLockToggle"),
    fullscreenToggle: $("fullscreenToggle"),
    // Replay panel
    replayFile:     $("replayFile"),
    replayFileName: $("replayFileName"),
    rPlayBtn:       $("rPlayBtn"),
    rPauseBtn:      $("rPauseBtn"),
    rStopBtn:       $("rStopBtn"),
    rRestartBtn:    $("rRestartBtn"),
    rScrub:         $("rScrub"),
    rTimeNow:       $("rTimeNow"),
    rTimeTotal:     $("rTimeTotal"),
    rSpeed:         $("rSpeed"),
    rSceneJump:     $("rSceneJump"),
    replayScenePicker: $("replayScenePicker"),
    rFullscreenToggle: $("rFullscreenToggle"),
    replayBreakdown: $("replayBreakdown"),
  };

  // ---------- State ----------
  const state = {
    mode: "assisted",              // 'assisted' | 'performance' | 'replay'
    sessionStartPerf: null,        // performance.now() baseline
    sessionStartedAt: null,        // ISO string
    log: [],
    sceneIdx: -1,                  // index into SCENES, -1 = none active
    msgIdx: 0,                     // index into current scene messages
    aiTurnInFlight: false,         // typing or streaming a response
    aiTurnAbort: null,             // { cancelled: boolean } token
    elapsedTimer: null,
    wakeLock: null,
    inputLogTimer: null,
    inputLastValue: "",
    sceneStartsPlayed: new Set(),  // which scene ids have been started
    sceneComplete: false,          // true when current scene's last msg fired
    scenePickedFromList: false,     // manual drawer selection overrides "next scene" CTA
    sceneRunTimes: {},             // map of scene id -> duration in ms
    sceneStartTime: null,          // timestamp when current scene started
  };

  // ---------- Logging ----------
  function nowT() {
    if (state.sessionStartPerf == null) return 0;
    return Math.round(performance.now() - state.sessionStartPerf);
  }
  function logEvent(type, data) {
    if (state.mode === "replay") return;
    if (state.sessionStartPerf == null) initSession();
    const evt = { t: nowT(), type, ...(data || {}) };
    state.log.push(evt);
    persistLiveSession();
  }
  function initSession() {
    if (state.sessionStartPerf != null) return;
    state.sessionStartPerf = performance.now();
    state.sessionStartedAt = new Date().toISOString();
    state.log.push({
      t: 0, type: "session_start",
      mode: state.mode,
      startedAt: state.sessionStartedAt,
      ua: navigator.userAgent,
    });
    if (!state.elapsedTimer) {
      state.elapsedTimer = setInterval(updateElapsed, 250);
    }
    persistLiveSession();
  }
  function updateElapsed() {
    if (state.sessionStartPerf == null) {
      dom.statElapsed.textContent = "0:00";
      return;
    }
    const ms = nowT();
    dom.statElapsed.textContent = formatClock(ms, false);
  }
  function getSceneRuntimeMs() {
    return state.sceneStartTime == null ? null : Math.max(0, performance.now() - state.sceneStartTime);
  }
  function serializeLiveSession() {
    if (state.mode === "replay" || state.sessionStartPerf == null || !state.log.length) return null;
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      mode: state.mode,
      elapsedMs: nowT(),
      sessionStartedAt: state.sessionStartedAt,
      log: state.log,
      sceneIdx: state.sceneIdx,
      msgIdx: state.msgIdx,
      sceneComplete: state.sceneComplete,
      scenePickedFromList: state.scenePickedFromList,
      sceneStartsPlayed: Array.from(state.sceneStartsPlayed),
      sceneRunTimes: state.sceneRunTimes,
      sceneRuntimeMs: getSceneRuntimeMs(),
      composerValue: dom.composerInput.value,
      inputLastValue: state.inputLastValue,
    };
  }
  function persistLiveSession() {
    try {
      const snapshot = serializeLiveSession();
      if (!snapshot) return;
      localStorage.setItem(LIVE_AUTOSAVE_KEY, JSON.stringify(snapshot));
    } catch (err) {
      console.warn("Autosave failed", err);
    }
  }
  function clearPersistedLiveSession() {
    try {
      localStorage.removeItem(LIVE_AUTOSAVE_KEY);
    } catch (err) {
      console.warn("Autosave clear failed", err);
    }
  }
  function restoreChatFromLog(log) {
    clearChat();
    log.forEach((event) => {
      if (event.type === "user_message") {
        appendUserMessage(event.text || "");
      } else if (event.type === "ai_message_done") {
        const msg = appendAssistantMessage();
        const textEl = getAssistantTextEl(msg);
        textEl.classList.remove("streaming");
        textEl.textContent = event.text || "";
      }
    });
    scrollChatToBottom();
  }
  function restoreLiveSession() {
    let snapshot = null;
    try {
      snapshot = JSON.parse(localStorage.getItem(LIVE_AUTOSAVE_KEY) || "null");
    } catch (err) {
      clearPersistedLiveSession();
      return false;
    }
    if (!snapshot || !Array.isArray(snapshot.log) || !snapshot.log.length) return false;
    const mode = snapshot.mode === "performance" ? "performance" : "assisted";
    state.mode = mode;
    dom.body.dataset.mode = mode;
    dom.modeInputs.forEach((r) => { r.checked = r.value === mode; });
    state.log = snapshot.log;
    state.sceneIdx = Number.isInteger(snapshot.sceneIdx) ? snapshot.sceneIdx : -1;
    state.msgIdx = Number.isInteger(snapshot.msgIdx) ? snapshot.msgIdx : 0;
    state.sceneComplete = !!snapshot.sceneComplete;
    state.scenePickedFromList = !!snapshot.scenePickedFromList;
    state.sceneStartsPlayed = new Set(snapshot.sceneStartsPlayed || []);
    state.sceneRunTimes = snapshot.sceneRunTimes || {};
    state.sessionStartedAt = snapshot.sessionStartedAt || null;
    const elapsedMs = Math.max(0, snapshot.elapsedMs || 0);
    state.sessionStartPerf = performance.now() - elapsedMs;
    state.sceneStartTime = snapshot.sceneRuntimeMs == null
      ? null
      : performance.now() - Math.max(0, snapshot.sceneRuntimeMs);
    state.aiTurnInFlight = false;
    state.aiTurnAbort = null;
    if (!state.elapsedTimer) state.elapsedTimer = setInterval(updateElapsed, 250);
    restoreChatFromLog(state.log);
    dom.composerInput.value = snapshot.composerValue || "";
    state.inputLastValue = snapshot.inputLastValue || dom.composerInput.value;
    autosizeComposer();
    setModel(currentScene() ? currentScene().model : "GPT-4o");
    if (state.sceneComplete) {
      setComposerLocked(true, /*forStreaming=*/false);
      document.body.classList.add("scene-complete");
    } else {
      setComposerLocked(false);
      document.body.classList.remove("scene-complete");
    }
    refreshSceneList();
    updateStartSceneBtn();
    updatePromptStrip();
    updateElapsed();
    const sc = currentScene();
    if (!state.sceneComplete && sc && sc.messages[state.msgIdx] && sc.messages[state.msgIdx].role === "assistant") {
      scheduleAITurn(MIN_RESPONSE_DELAY_MS, /*fromSceneStart=*/false);
    }
    persistLiveSession();
    return true;
  }
  function formatClock(ms, withMs) {
    const total = Math.max(0, ms);
    const s = Math.floor(total / 1000);
    const mm = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, "0");
    if (!withMs) return `${mm}:${ss}`;
    const mmm = String(total % 1000).padStart(3, "0");
    return `${mm}:${ss}.${mmm}`;
  }

  // ---------- Rendering ----------
  function clearChat() {
    dom.chat.innerHTML = "";
    updateMsgCount();
  }
  function updateMsgCount() {
    const n = dom.chat.querySelectorAll(".msg:not(.typing)").length;
    dom.statMsgs.textContent = String(n);
  }
  function scrollChatToBottom() {
    dom.chat.scrollTop = dom.chat.scrollHeight;
  }
  function appendUserMessage(text) {
    const msg = document.createElement("div");
    msg.className = "msg user";
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;
    msg.appendChild(bubble);
    dom.chat.appendChild(msg);
    scrollChatToBottom();
    updateMsgCount();
    return msg;
  }
  function appendTypingIndicator() {
    const msg = document.createElement("div");
    msg.className = "msg assistant typing";
    msg.innerHTML =
      `<div class="assistant-row">
         <div class="avatar"></div>
         <div class="assistant-text"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
       </div>`;
    dom.chat.appendChild(msg);
    scrollChatToBottom();
    return msg;
  }
  function appendAssistantMessage() {
    const msg = document.createElement("div");
    msg.className = "msg assistant";
    msg.innerHTML =
      `<div class="assistant-row">
         <div class="avatar"></div>
         <div class="assistant-text streaming"></div>
       </div>`;
    dom.chat.appendChild(msg);
    scrollChatToBottom();
    updateMsgCount();
    return msg;
  }
  function getAssistantTextEl(msgEl) {
    return msgEl.querySelector(".assistant-text");
  }

  // ---------- Model label ----------
  function setModel(name) {
    const display = "ChatGPT " + name.replace(/^GPT-/, "");
    if (dom.modelName.textContent !== display) {
      dom.modelName.textContent = display;
    }
    dom.statModel.textContent = name;
    // Pre-sunset GPT-4o = "Message ChatGPT"; post-sunset GPT-5 = "Ask anything"
    const placeholder = /^GPT-5/i.test(name) ? "Ask anything" : "Message ChatGPT";
    if (dom.composerInput && dom.composerInput.placeholder !== placeholder) {
      dom.composerInput.placeholder = placeholder;
    }
  }

  // ---------- Composer ----------
  function autosizeComposer() {
    const el = dom.composerInput;
    el.style.height = "auto";
    const max = 160;
    el.style.height = Math.min(max, el.scrollHeight) + "px";
  }
  function refreshComposerState() {
    const v = dom.composerInput.value;
    const blocked = state.aiTurnInFlight || state.sceneComplete;
    const hasText = v.trim().length > 0;
    dom.composerPill.classList.toggle("has-text", hasText && !blocked);
    dom.sendBtn.disabled = !(hasText && !blocked);
  }
  function setSendEnabled() { refreshComposerState(); }
  // `forStreaming=false` locks the composer without showing the stop-square
  // (used when a scene has ended naturally).
  function setComposerLocked(locked, forStreaming = true) {
    dom.composerInput.readOnly = locked;
    dom.composerInput.disabled = locked && !forStreaming;
    dom.composerPill.classList.toggle("streaming", locked && forStreaming);
    refreshComposerState();
  }
  function clearComposer() {
    dom.composerInput.value = "";
    state.inputLastValue = "";
    autosizeComposer();
    refreshComposerState();
  }

  // ---------- Streaming helpers ----------
  function chunkText(text) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
      const size = 3 + Math.floor(Math.random() * 4); // 3..6 chars
      chunks.push(text.slice(i, i + size));
      i += size;
    }
    return chunks;
  }

  function formatDuration(ms) {
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  // ---------- Scene engine ----------
  function refreshSceneList() {
    dom.sceneList.innerHTML = "";
    SCENES.forEach((sc, i) => {
      const li = document.createElement("li");
      li.dataset.idx = String(i);
      const isActive = (i === state.sceneIdx);
      const played = state.sceneStartsPlayed.has(sc.id) && !isActive;
      li.className = (isActive ? "active " : "") + (played ? "played" : "");
      const left = document.createElement("span");
      left.textContent = sc.name;
      const badge = document.createElement("span");
      badge.className = "badge";
      const durationMs = state.sceneRunTimes[sc.id];
      const durationStr = durationMs !== undefined ? formatDuration(durationMs) : sc.model;
      badge.textContent = durationStr;
      li.appendChild(left);
      li.appendChild(badge);
      li.addEventListener("click", () => {
        if (state.aiTurnInFlight) return;
        state.sceneIdx = i;
        state.msgIdx = 0;
        state.scenePickedFromList = true;
        refreshSceneList();
        updateStartSceneBtn();
        updatePromptStrip();
      });
      dom.sceneList.appendChild(li);
    });
  }
  function currentScene() {
    return state.sceneIdx >= 0 ? SCENES[state.sceneIdx] : null;
  }
  function currentMessage() {
    const sc = currentScene();
    if (!sc) return null;
    return sc.messages[state.msgIdx] || null;
  }
  function liveSessionHasContent() {
    return state.log.some((e) =>
      e.type === "scene_start" || e.type === "user_message" || e.type === "ai_message_done"
    );
  }
  function updateStartSceneBtn() {
    const sc = currentScene();
    if (!sc) {
      dom.startSceneBtn.disabled = true;
      dom.startSceneBtn.textContent = "Start scene";
      dom.endSceneBtn.disabled = true;
      return;
    }
    const started = state.sceneStartsPlayed.has(sc.id);
    const atEnd = state.sceneComplete || state.msgIdx >= sc.messages.length;
    if (!started) {
      dom.startSceneBtn.disabled = state.aiTurnInFlight;
      dom.startSceneBtn.textContent = `Start: ${sc.name.split("—")[0].trim()}`;
      dom.endSceneBtn.disabled = true;
    } else if (atEnd && !state.scenePickedFromList) {
      // Scene over → offer next scene as the primary action
      const nextIdx = state.sceneIdx + 1;
      if (nextIdx < SCENES.length) {
        dom.startSceneBtn.disabled = state.aiTurnInFlight;
        dom.startSceneBtn.textContent = `Start: ${SCENES[nextIdx].name.split("—")[0].trim()}`;
      } else {
        dom.startSceneBtn.disabled = true;
        dom.startSceneBtn.textContent = "All scenes complete";
      }
      dom.endSceneBtn.disabled = true;
    } else if (atEnd) {
      dom.startSceneBtn.disabled = state.aiTurnInFlight;
      dom.startSceneBtn.textContent = `Start: ${sc.name.split("—")[0].trim()}`;
      dom.endSceneBtn.disabled = true;
    } else {
      dom.startSceneBtn.disabled = true;
      dom.startSceneBtn.textContent = "Scene in progress";
      dom.endSceneBtn.disabled = state.aiTurnInFlight;
    }
  }
  function updatePromptStrip() {
    if (state.mode !== "assisted") {
      dom.promptStrip.hidden = true;
      return;
    }
    const sc = currentScene();
    if (!sc) { dom.promptStrip.hidden = true; return; }
    // Look ahead: find the next user line at or after current msgIdx.
    let i = state.msgIdx;
    while (i < sc.messages.length && sc.messages[i].role !== "user") i += 1;
    if (i >= sc.messages.length) {
      // No more user lines this scene — actor doesn't need to type again.
      dom.promptStrip.hidden = true;
      return;
    }
    const userMsg = sc.messages[i];
    const isNow = (i === state.msgIdx) && !state.aiTurnInFlight;
    dom.promptText.textContent = userMsg.text;
    const labelEl = dom.promptStrip.querySelector(".prompt-label");
    if (labelEl) labelEl.textContent = isNow ? "type:" : "next:";
    dom.promptStrip.classList.toggle("queued", !isNow);
    dom.promptStrip.hidden = false;
  }

  // Each scene = its own session. Calling startScene clears the current
  // session and starts a fresh one for the selected scene. If the current
  // session has any content, ask before discarding.
  function startScene() {
    let sc = currentScene();
    if (!sc) return;
    if (state.aiTurnInFlight) return;

    // Confirm before discarding an unexported session
    const hasContent = liveSessionHasContent();
    if (hasContent && !state.sceneComplete) {
      const ok = confirm(
        "Starting this scene will clear the current session.\n" +
        "Export the JSON first if you want to keep it.\n\n" +
        "Continue?"
      );
      if (!ok) return;
    }

    // Hard reset of the live session, but preserve which scene is selected
    if (state.aiTurnAbort) state.aiTurnAbort.cancelled = true;
    state.aiTurnInFlight = false;
    state.sceneComplete = false;
    state.scenePickedFromList = false;
    state.log = [];
    state.sessionStartPerf = null;
    state.sessionStartedAt = null;
    if (state.elapsedTimer) { clearInterval(state.elapsedTimer); state.elapsedTimer = null; }
    state.sceneStartsPlayed.clear();
    state.sceneRunTimes = {};
    state.sceneStartTime = null;
    state.msgIdx = 0;
    clearChat();
    clearComposer();
    setComposerLocked(false);
    document.body.classList.remove("scene-complete");
    dom.statElapsed.textContent = "0:00";

    // Begin the new session
    state.sceneStartsPlayed.add(sc.id);
    setModel(sc.model);
    initSession();
    state.sceneStartTime = performance.now();
    logEvent("scene_start", { sceneId: sc.id, name: sc.name, model: sc.model });
    refreshSceneList();
    updateStartSceneBtn();
    updatePromptStrip();
    closeDrawer();
    persistLiveSession();

    // Lead-in then advance.
    scheduleAITurn(sc.leadInMs || 0, /*fromSceneStart=*/true);
  }

  // Manually end the current scene (Director button). Logs scene_end + session_end.
  function endScene() {
    const sc = currentScene();
    if (!sc) return;
    if (state.aiTurnAbort) state.aiTurnAbort.cancelled = true;
    state.aiTurnInFlight = false;
    state.msgIdx = sc.messages.length;
    if (!state.sceneComplete) {
      if (state.sceneStartTime !== null) {
        state.sceneRunTimes[sc.id] = performance.now() - state.sceneStartTime;
      }
      logEvent("scene_end", { sceneId: sc.id, manual: true });
      logEvent("session_end", { manual: true });
    }
    state.sceneComplete = true;
    setComposerLocked(true, /*forStreaming=*/false);
    document.body.classList.add("scene-complete");
    updateStartSceneBtn();
    updatePromptStrip();
    refreshSceneList();
    persistLiveSession();
  }

  // Decide what to do at the current msgIdx.
  // If next is assistant, schedule its delivery.
  // If next is user, update prompt strip and wait for actor send.
  // If end of scene, log scene_end automatically.
  function advanceScene(fromSceneStart) {
    const sc = currentScene();
    if (!sc) return;
    if (state.msgIdx >= sc.messages.length) {
      // Scene complete — auto end the session.
      if (state.sceneStartTime !== null) {
        state.sceneRunTimes[sc.id] = performance.now() - state.sceneStartTime;
      }
      logEvent("scene_end", { sceneId: sc.id });
      logEvent("session_end", {});
      state.aiTurnInFlight = false;
      state.sceneComplete = true;
      setComposerLocked(true, /*forStreaming=*/false);
      document.body.classList.add("scene-complete");
      updateStartSceneBtn();
      updatePromptStrip();
      refreshSceneList();
      persistLiveSession();
      return;
    }
    const m = sc.messages[state.msgIdx];
    if (m.role === "assistant") {
      scheduleAITurn(m.delayMs || 0, fromSceneStart);
    } else {
      // Awaiting user input.
      state.aiTurnInFlight = false;
      setComposerLocked(false);
      updatePromptStrip();
      updateStartSceneBtn();
      persistLiveSession();
    }
  }

  // Schedule the next AI message: wait `delayMs`, then typing indicator,
  // then stream the assistant text.
  function scheduleAITurn(delayMs, fromSceneStart) {
    const sc = currentScene();
    if (!sc) return;
    const m = sc.messages[state.msgIdx];
    if (!m || m.role !== "assistant") {
      // Edge: empty scene or unexpected role
      if (state.msgIdx >= sc.messages.length) {
        advanceScene(false);
      }
      return;
    }
    state.aiTurnInFlight = true;
    setComposerLocked(true);
    updateStartSceneBtn();
    updatePromptStrip(); // immediately switch to "next:" look-ahead
    const token = { cancelled: false };
    state.aiTurnAbort = token;

    // Scale response delays. Lead-ins (cinematic) stay full length.
    const effectiveDelay = fromSceneStart
      ? delayMs
      : Math.max(MIN_RESPONSE_DELAY_MS, Math.floor(delayMs * RESPONSE_DELAY_SCALE));

    // Typing indicator: short visible beat before streaming starts.
    const typingMs = Math.max(850, Math.min(1200, Math.floor((m.streamMs || 1200) * 0.45)));
    const streamMs = Math.max(400, m.streamMs || 1400);

    const tStart = nowT();
    const myMsgIdx = state.msgIdx;

    // Wait scaled delay, then show typing indicator
    setTimeoutLogged(() => {
      if (token.cancelled) return;
      logEvent("typing_start", { sceneId: sc.id, msgIdx: myMsgIdx });
      const typingEl = appendTypingIndicator();
      // After typingMs, replace typing with streaming
      setTimeoutLogged(() => {
        if (token.cancelled) { typingEl.remove(); return; }
        logEvent("typing_end", { sceneId: sc.id, msgIdx: myMsgIdx });
        typingEl.remove();
        const aiEl = appendAssistantMessage();
        const textEl = getAssistantTextEl(aiEl);
        streamInto(textEl, m.text, streamMs, token, () => {
          if (token.cancelled) return;
          textEl.classList.remove("streaming");
          logEvent("ai_message_done", { sceneId: sc.id, msgIdx: myMsgIdx, text: m.text });
          state.msgIdx += 1;
          persistLiveSession();
          // Continue scene
          advanceScene(false);
        });
      }, typingMs);
    }, effectiveDelay);
  }

  function setTimeoutLogged(fn, ms) {
    return setTimeout(fn, Math.max(0, ms));
  }

  function streamInto(textEl, finalText, totalMs, token, done) {
    const chunks = chunkText(finalText);
    if (chunks.length === 0) {
      done();
      return;
    }
    const perChunk = totalMs / chunks.length;
    let acc = "";
    let i = 0;
    const step = () => {
      if (token.cancelled) return;
      const chunk = chunks[i];
      acc += chunk;
      textEl.textContent = acc;
      scrollChatToBottom();
      logEvent("stream_chunk", { chunk });
      i += 1;
      if (i >= chunks.length) {
        done();
      } else {
        setTimeout(step, perChunk);
      }
    };
    setTimeout(step, perChunk);
  }

  // ---------- Sending ----------
  function handleSend() {
    if (state.mode === "replay") return;
    if (state.aiTurnInFlight) return;
    const value = dom.composerInput.value;
    const text = value.trim();
    if (!text) return;

    initSession();
    const sc = currentScene();
    const scriptedUser =
      sc && sc.messages[state.msgIdx] && sc.messages[state.msgIdx].role === "user"
        ? sc.messages[state.msgIdx]
        : null;

    logEvent("send", {
      text,
      sceneId: sc ? sc.id : null,
      msgIdx: state.msgIdx,
      scripted: scriptedUser ? scriptedUser.text : null,
    });
    appendUserMessage(text);
    logEvent("user_message", { text, sceneId: sc ? sc.id : null });
    clearComposer();

    if (scriptedUser) {
      state.msgIdx += 1;
      persistLiveSession();
      advanceScene(false);
    } else {
      // No scripted slot to consume; just wait. (Director may use End/Start.)
      updateStartSceneBtn();
      persistLiveSession();
    }
  }

  // ---------- Drawer ----------
  function openDrawer() {
    dom.drawer.hidden = false;
    dom.drawerScrim.hidden = false;
    dom.drawer.setAttribute("aria-hidden", "false");
    refreshSceneList();
    updateStartSceneBtn();
    updateMsgCount();
    updateElapsed();
    if (state.mode === "replay") {
      revealMenu();
    }
  }
  function closeDrawer() {
    dom.drawer.hidden = true;
    dom.drawerScrim.hidden = true;
    dom.drawer.setAttribute("aria-hidden", "true");
  }

  // ---------- Mode switching ----------
  function setMode(mode) {
    if (state.mode === mode) return;
    const previousMode = state.mode;
    if (mode === "replay" && liveSessionHasContent()) {
      const ok = confirm(
        "Switching to Replay will clear the current session.\n" +
        "Export the JSON first if you want to keep it.\n\n" +
        "Continue?"
      );
      if (!ok) {
        dom.modeInputs.forEach((r) => { r.checked = r.value === state.mode; });
        return;
      }
    }
    state.mode = mode;
    dom.body.dataset.mode = mode;
    logEvent("mode_change", { mode });
    dom.modeInputs.forEach((r) => { r.checked = r.value === mode; });
    if (mode === "replay") {
      // Clear current chat & state so a session can be loaded.
      hardResetSession({ keepLog: false });
      setupReplayUIState();
    } else {
      // Leaving Replay should restore the live surface. Switching between
      // Assisted and Performance must preserve the current chat/session.
      if (previousMode === "replay") Replay.stop();
      updatePromptStrip();
      updateStartSceneBtn();
      persistLiveSession();
    }
  }

  // ---------- Reset ----------
  function hardResetSession({ keepLog }) {
    if (state.aiTurnAbort) state.aiTurnAbort.cancelled = true;
    state.aiTurnInFlight = false;
    state.sceneComplete = false;
    state.sceneIdx = -1;
    state.msgIdx = 0;
    state.scenePickedFromList = false;
    state.sceneStartsPlayed.clear();
    state.sceneRunTimes = {};
    state.sceneStartTime = null;
    document.body.classList.remove("scene-complete");
    if (!keepLog) {
      state.log = [];
      state.sessionStartPerf = null;
      state.sessionStartedAt = null;
      if (state.elapsedTimer) { clearInterval(state.elapsedTimer); state.elapsedTimer = null; }
      clearPersistedLiveSession();
    }
    clearChat();
    clearComposer();
    setComposerLocked(false);
    setModel("GPT-4o");
    dom.statElapsed.textContent = "0:00";
    refreshSceneList();
    updateStartSceneBtn();
    updatePromptStrip();
    if (keepLog) persistLiveSession();
  }

  // ---------- Export ----------
  function buildSessionExport() {
    if (state.sessionStartPerf == null) {
      return null;
    }
    // Don't double-log session_end if scene already auto-ended.
    const lastEvt = state.log[state.log.length - 1];
    if (!lastEvt || lastEvt.type !== "session_end") {
      logEvent("session_end", { exported: true });
    }
    const payload = {
      version: 1,
      mode: state.mode,
      startedAt: state.sessionStartedAt,
      endedAt: new Date().toISOString(),
      durationMs: nowT(),
      ua: navigator.userAgent,
      scenes: SCENES.map((s) => ({ id: s.id, name: s.name, model: s.model })),
      events: state.log,
    };
    const stamp = (state.sessionStartedAt || new Date().toISOString())
      .replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
    const filename = `sycophancy-session-${stamp}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    return { payload, blob, filename };
  }

  function exportSession() {
    const exportFile = buildSessionExport();
    if (!exportFile) {
      alert("Nothing to export yet.");
      return;
    }
    const { blob, filename } = exportFile;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  async function sendSessionToDiscord() {
    const exportFile = buildSessionExport();
    if (!exportFile) {
      alert("Nothing to send yet.");
      return;
    }
    const btn = dom.discordUploadBtn;
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Sending...";
    try {
      const form = new FormData();
      form.append("payload_json", JSON.stringify({
        content: `Sycophancy session export: ${exportFile.filename}`,
        allowed_mentions: { parse: [] },
      }));
      form.append("files[0]", exportFile.blob, exportFile.filename);
      const response = await fetch(`${DISCORD_EXPORT_WEBHOOK}?wait=true`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        throw new Error(`Discord upload failed (${response.status})`);
      }
      btn.textContent = "Sent";
      setTimeout(() => {
        btn.textContent = originalLabel;
        btn.disabled = false;
      }, 1800);
    } catch (err) {
      console.warn("Discord upload failed", err);
      btn.textContent = "Send failed";
      btn.disabled = false;
      alert("Discord upload failed. Check the webhook or browser network access and try again.");
      setTimeout(() => {
        btn.textContent = originalLabel;
      }, 2200);
    }
  }

  // ---------- Wake Lock ----------
  async function setWakeLock(want) {
    try {
      if (want) {
        if ("wakeLock" in navigator) {
          state.wakeLock = await navigator.wakeLock.request("screen");
          state.wakeLock.addEventListener("release", () => {
            // If user navigates away then back, attempt re-acquire.
            state.wakeLock = null;
            if (dom.wakeLockToggle.checked) {
              setTimeout(() => setWakeLock(true), 500);
            }
          });
        } else {
          alert("Wake Lock API not supported in this browser.");
          dom.wakeLockToggle.checked = false;
        }
      } else {
        if (state.wakeLock) {
          await state.wakeLock.release();
          state.wakeLock = null;
        }
      }
    } catch (e) {
      console.warn("Wake lock error", e);
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && dom.wakeLockToggle.checked) {
      setWakeLock(true);
    }
  });

  // ---------- Fullscreen ----------
  async function setFullscreen(want) {
    try {
      if (want && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else if (!want && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen error", e);
    }
  }
  document.addEventListener("fullscreenchange", () => {
    const inFs = !!document.fullscreenElement;
    dom.fullscreenToggle.checked = inFs;
    dom.rFullscreenToggle.checked = inFs;
  });

  // ---------- Breakdown / inspector ----------
  function buildBreakdown(events) {
    const scenes = [];
    let cur = null;
    let aiTurn = null;
    const lastT = events.length ? events[events.length - 1].t : 0;
    for (let i = 0; i < events.length; i += 1) {
      const e = events[i];
      switch (e.type) {
        case "scene_start":
          if (cur) {
            if (cur.endT == null) cur.endT = e.t;
            scenes.push(cur);
          }
          cur = {
            id: e.sceneId,
            name: e.name || ("Scene " + e.sceneId),
            model: e.model || "",
            startT: e.t, endT: null,
            messages: [],
          };
          break;
        case "scene_end":
          if (cur) cur.endT = e.t;
          break;
        case "user_message":
          if (cur) cur.messages.push({ kind: "user", t: e.t, text: e.text || "" });
          break;
        case "typing_start":
          aiTurn = { typingStartT: e.t, streamStartT: null };
          break;
        case "typing_end":
          if (aiTurn) aiTurn.streamStartT = e.t;
          break;
        case "ai_message_done":
          if (cur && aiTurn) {
            cur.messages.push({
              kind: "ai",
              t: aiTurn.typingStartT,
              streamStartT: aiTurn.streamStartT || aiTurn.typingStartT,
              doneT: e.t,
              text: e.text || "",
            });
            aiTurn = null;
          }
          break;
        default: break;
      }
    }
    if (cur) {
      if (cur.endT == null) cur.endT = lastT;
      scenes.push(cur);
    }
    return scenes;
  }

  function fmtSec(ms) {
    const s = Math.max(0, ms) / 1000;
    return (s >= 10 ? s.toFixed(1) : s.toFixed(2)) + "s";
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function truncate(s, n) {
    s = String(s || "");
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  function renderBreakdown(scenes, totalMs) {
    const el = dom.replayBreakdown;
    if (!el) return;
    if (!scenes.length) {
      el.className = "bd-empty";
      el.textContent = "No scene events found in this session.";
      return;
    }
    el.className = "";
    let totalMsgs = 0;
    let totalAiMs = 0;
    let totalUserDeadMs = 0; // approx time the actor was reading/typing
    scenes.forEach((s) => {
      totalMsgs += s.messages.length;
      s.messages.forEach((m) => {
        if (m.kind === "ai") totalAiMs += (m.doneT - m.t);
      });
    });
    let html = "";
    html += `<div class="bd-summary">`;
    html += `<span>Total: <b>${formatClock(totalMs, true)}</b></span>`;
    html += `<span>Scenes: <b>${scenes.length}</b></span>`;
    html += `<span>Msgs: <b>${totalMsgs}</b></span>`;
    html += `<span>AI time: <b>${fmtSec(totalAiMs)}</b></span>`;
    html += `</div>`;
    scenes.forEach((s) => {
      const dur = Math.max(0, (s.endT || s.startT) - s.startT);
      html += `<details class="bd-scene"><summary>`;
      html += `<span><span class="bd-role">${escapeHtml(s.model || "")}</span>${escapeHtml(s.name)}<span class="bd-count">· ${s.messages.length} msg${s.messages.length === 1 ? "" : "s"}</span></span>`;
      html += `<span class="bd-dur">${formatClock(dur, false)}</span>`;
      html += `</summary>`;
      html += `<ol class="bd-msgs">`;
      let prevT = s.startT;
      s.messages.forEach((m) => {
        if (m.kind === "user") {
          const offset = m.t - s.startT;
          const sinceLast = m.t - prevT;
          html += `<li class="bd-msg user">`;
          html += `<span class="bd-t">${formatClock(offset, false)}</span>`;
          html += `<span class="bd-text"><span class="bd-role">user</span>${escapeHtml(truncate(m.text, 80))}</span>`;
          html += `<span class="bd-meta">since prev ${fmtSec(sinceLast)}</span>`;
          html += `</li>`;
          prevT = m.t;
        } else {
          const offset = m.t - s.startT;
          const delay = m.t - prevT;
          const typingDur = Math.max(0, m.streamStartT - m.t);
          const streamDur = Math.max(0, m.doneT - m.streamStartT);
          const totalAi = m.doneT - m.t;
          html += `<li class="bd-msg ai">`;
          html += `<span class="bd-t">${formatClock(offset, false)}</span>`;
          html += `<span class="bd-text"><span class="bd-role">ai</span>${escapeHtml(truncate(m.text, 80))}</span>`;
          html += `<span class="bd-meta">delay ${fmtSec(delay)} · typing ${fmtSec(typingDur)} · stream ${fmtSec(streamDur)} · total ${fmtSec(totalAi)}</span>`;
          html += `</li>`;
          prevT = m.doneT;
        }
      });
      html += `</ol></details>`;
    });
    el.innerHTML = html;
  }

  // ---------- Replay engine ----------
  const Replay = (() => {
    const r = {
      data: null,
      durationMs: 0,
      events: [],
      sourceEvents: [],
      scenes: [],
      selectedSceneKeys: new Set(),
      // Playback
      playing: false,
      virtualTime: 0,          // ms into the session
      startWallPerf: 0,        // perf.now() when we last resumed
      startVirtual: 0,         // virtualTime when we last resumed
      nextEventIdx: 0,         // next exported event to replay
      speed: 1,
      timer: null,
      raf: null,
      // Stream-state during replay (mirror live engine state)
      currentAssistantEl: null,
      currentTypingEl: null,
      assistantBuffer: "",
      lastUserMessageEl: null,
    };

    function reset() {
      stop();
      r.virtualTime = 0;
      r.currentAssistantEl = null;
      r.currentTypingEl = null;
      r.assistantBuffer = "";
      r.lastUserMessageEl = null;
      r.nextEventIdx = 0;
      clearChat();
      clearComposer();
      setComposerLocked(false);
      setModel("GPT-4o");
      updateScrubUI();
    }

    function load(data) {
      r.data = data;
      r.sourceEvents = (data.events || []).slice().sort((a, b) => a.t - b.t);
      r.scenes = buildReplayScenes(r.sourceEvents);
      r.selectedSceneKeys = new Set(r.scenes.map((scene) => scene.key));
      renderReplayScenePicker();
      applyReplaySceneSelection();
    }

    function applyReplaySceneSelection() {
      const selectedScenes = r.scenes.filter((scene) => r.selectedSceneKeys.has(scene.key));
      const selection = buildReplaySelection(selectedScenes);
      r.events = selection.events;
      r.durationMs = selection.durationMs;
      r.nextEventIdx = 0;
      reset();
      rebuildSceneJump();
      dom.rSceneJump.disabled = !r.events.length;
      dom.rScrub.disabled = !r.events.length;
      dom.rScrub.max = String(r.durationMs);
      dom.rScrub.value = "0";
      dom.rTimeTotal.textContent = formatClock(r.durationMs, true);
      dom.rPlayBtn.disabled = !r.events.length;
      dom.rPauseBtn.disabled = true;
      dom.rStopBtn.disabled = !r.events.length;
      dom.rRestartBtn.disabled = !r.events.length;
      renderBreakdown(buildBreakdown(r.events), r.durationMs);
    }

    function rebuildSceneJump() {
      dom.rSceneJump.innerHTML = "";
      const blank = document.createElement("option");
      blank.value = ""; blank.textContent = "—";
      dom.rSceneJump.appendChild(blank);
      r.events.forEach((e) => {
        if (e.type === "scene_start") {
          const opt = document.createElement("option");
          opt.value = String(e.t);
          opt.textContent = `${formatClock(e.t, false)} — ${e.name || ("Scene " + e.sceneId)}`;
          dom.rSceneJump.appendChild(opt);
        }
      });
    }

    function play() {
      if (!r.data) return;
      if (r.playing) return;
      r.playing = true;
      r.startWallPerf = performance.now();
      r.startVirtual = r.virtualTime;
      dom.rPlayBtn.disabled = true;
      dom.rPauseBtn.disabled = false;
      scheduleNext();
      tickClock();
      startAutoHideMenu();
    }
    function pause() {
      if (!r.playing) return;
      r.virtualTime = currentVirtualTime();
      r.playing = false;
      if (r.timer) { clearTimeout(r.timer); r.timer = null; }
      if (r.raf) { cancelAnimationFrame(r.raf); r.raf = null; }
      dom.rPlayBtn.disabled = false;
      dom.rPauseBtn.disabled = true;
      stopAutoHideMenu();
    }
    function stop() {
      pause();
      r.virtualTime = 0;
      r.currentAssistantEl = null;
      r.currentTypingEl = null;
      r.assistantBuffer = "";
      r.lastUserMessageEl = null;
      r.nextEventIdx = 0;
      clearChat();
      clearComposer();
      setModel("GPT-4o");
      updateScrubUI();
      stopAutoHideMenu();
      revealMenu();
    }
    function restart() {
      stop();
      play();
    }
    function setSpeed(sp) {
      if (r.playing) {
        // anchor virtual time then switch speed
        r.virtualTime = currentVirtualTime();
        r.startWallPerf = performance.now();
        r.startVirtual = r.virtualTime;
      }
      r.speed = sp;
    }
    function seek(toMs) {
      const wasPlaying = r.playing;
      pause();
      // Reset DOM, fast-forward instantly through every event <= toMs
      r.virtualTime = 0;
      r.currentAssistantEl = null;
      r.currentTypingEl = null;
      r.assistantBuffer = "";
      r.lastUserMessageEl = null;
      r.nextEventIdx = 0;
      clearChat();
      clearComposer();
      setModel("GPT-4o");
      for (let i = 0; i < r.events.length; i += 1) {
        const e = r.events[i];
        if (e.t > toMs) break;
        applyEvent(e, /*instant=*/true);
        r.nextEventIdx = i + 1;
      }
      r.virtualTime = toMs;
      updateScrubUI();
      if (wasPlaying) play();
    }

    function currentVirtualTime() {
      if (!r.playing) return r.virtualTime;
      const elapsed = (performance.now() - r.startWallPerf) * r.speed;
      return Math.min(r.durationMs, r.startVirtual + elapsed);
    }

    function tickClock() {
      if (!r.playing) return;
      updateScrubUI();
      r.raf = requestAnimationFrame(tickClock);
    }
    function updateScrubUI() {
      const t = currentVirtualTime();
      dom.rScrub.value = String(Math.round(t));
      dom.rTimeNow.textContent = formatClock(t, true);
    }

    function scheduleNext() {
      if (!r.playing) return;
      const t = currentVirtualTime();
      const next = r.events[r.nextEventIdx];
      if (!next) {
        // End of timeline
        r.playing = false;
        dom.rPlayBtn.disabled = false;
        dom.rPauseBtn.disabled = true;
        stopAutoHideMenu();
        return;
      }
      const waitWall = (next.t - t) / r.speed;
      r.timer = setTimeout(() => {
        if (!r.playing) return;
        applyEvent(next, /*instant=*/false);
        r.nextEventIdx += 1;
        // Move virtual time to this event's t (anchor)
        r.virtualTime = next.t;
        r.startWallPerf = performance.now();
        r.startVirtual = next.t;
        scheduleNext();
      }, Math.max(0, waitWall));
    }

    function applyEvent(e, instant) {
      switch (e.type) {
        case "session_start":
          // already cleared
          break;
        case "scene_start":
          if (e.model) setModel(e.model);
          break;
        case "scene_end":
          break;
        case "mode_change":
          break;
        case "input":
          // Reproduce composer typing
          dom.composerInput.value = e.value || "";
          autosizeComposer();
          dom.composerPill.classList.toggle("has-text",
            (e.value || "").trim().length > 0);
          break;
        case "keydown":
          // visual flicker is reproduced via input events already
          break;
        case "send":
          // value will clear when user_message lands
          break;
        case "user_message": {
          r.lastUserMessageEl = appendUserMessage(e.text || "");
          // clear composer (mirrors live behavior)
          dom.composerInput.value = "";
          autosizeComposer();
          dom.composerPill.classList.remove("has-text");
          break;
        }
        case "typing_start":
          r.currentTypingEl = appendTypingIndicator();
          r.assistantBuffer = "";
          break;
        case "typing_end":
          if (r.currentTypingEl) {
            r.currentTypingEl.remove();
            r.currentTypingEl = null;
          }
          // Create assistant message ready for streaming chunks
          if (!r.currentAssistantEl) {
            r.currentAssistantEl = appendAssistantMessage();
          }
          break;
        case "stream_chunk": {
          if (!r.currentAssistantEl) {
            // typing_end may have been missed (older logs); auto-create
            if (r.currentTypingEl) { r.currentTypingEl.remove(); r.currentTypingEl = null; }
            r.currentAssistantEl = appendAssistantMessage();
          }
          r.assistantBuffer += (e.chunk || "");
          const textEl = getAssistantTextEl(r.currentAssistantEl);
          textEl.textContent = r.assistantBuffer;
          scrollChatToBottom();
          break;
        }
        case "ai_message_done": {
          if (r.currentAssistantEl) {
            const textEl = getAssistantTextEl(r.currentAssistantEl);
            textEl.classList.remove("streaming");
            // Final safety: ensure final text matches recorded full text
            if (e.text) {
              textEl.textContent = e.text;
            }
          }
          r.currentAssistantEl = null;
          r.assistantBuffer = "";
          break;
        }
        case "session_end":
          break;
        default:
          break;
      }
    }

    function toggleSceneSelection(sceneKey, selected) {
      if (selected) r.selectedSceneKeys.add(sceneKey);
      else r.selectedSceneKeys.delete(sceneKey);
      applyReplaySceneSelection();
    }

    function getState() { return r; }
    return {
      load, play, pause, stop, restart, setSpeed, seek, reset, getState,
      toggleSceneSelection,
    };
  })();

  function buildReplayScenes(events) {
    const scenes = [];
    let current = null;
    let serial = 0;
    events.forEach((event) => {
      if (event.type === "scene_start") {
        if (current) scenes.push(finalizeReplayScene(current));
        serial += 1;
        current = {
          key: `${event.sceneId || "scene"}-${serial}`,
          sceneId: event.sceneId,
          name: event.name || ("Scene " + (event.sceneId || serial)),
          model: event.model || "",
          startT: event.t,
          endT: event.t,
          closed: false,
          events: [event],
        };
        return;
      }
      if (!current || current.closed) return;
      current.events.push(event);
      current.endT = Math.max(current.endT, event.t);
      if (event.type === "scene_end") {
        current.endT = event.t;
        current.closed = true;
      }
    });
    if (current) scenes.push(finalizeReplayScene(current));
    return scenes;
  }

  function finalizeReplayScene(scene) {
    const lastEvent = scene.events[scene.events.length - 1];
    const endT = Math.max(scene.endT, lastEvent ? lastEvent.t : scene.startT);
    return { ...scene, endT, durationMs: Math.max(0, endT - scene.startT) };
  }

  function buildReplaySelection(scenes) {
    const events = [];
    let cursor = 0;
    scenes.forEach((scene) => {
      scene.events.forEach((event) => {
        events.push({ ...event, t: cursor + Math.max(0, event.t - scene.startT) });
      });
      cursor += scene.durationMs;
    });
    return { events, durationMs: cursor };
  }

  function renderReplayScenePicker() {
    const el = dom.replayScenePicker;
    if (!el) return;
    const scenes = Replay.getState().scenes;
    if (!scenes.length) {
      el.className = "replay-scene-picker bd-empty";
      el.textContent = "No recorded scenes found in this export.";
      return;
    }
    el.className = "replay-scene-picker";
    el.innerHTML = scenes.map((scene) => `
      <label class="replay-scene-option">
        <input type="checkbox" data-scene-key="${escapeHtml(scene.key)}" checked />
        <span class="scene-copy">
          <span class="scene-name">${escapeHtml(scene.name)}</span>
          <span class="scene-meta">${escapeHtml(scene.model || "model unknown")}</span>
        </span>
        <span class="scene-duration">${formatClock(scene.durationMs, false)}</span>
      </label>
    `).join("");
  }

  // ---------- Replay UI ----------
  function setupReplayUIState() {
    dom.rPlayBtn.disabled = true;
    dom.rPauseBtn.disabled = true;
    dom.rStopBtn.disabled = true;
    dom.rRestartBtn.disabled = true;
    dom.rScrub.disabled = true;
    dom.rScrub.value = "0";
    dom.rTimeNow.textContent = "0:00.000";
    dom.rTimeTotal.textContent = "0:00.000";
    dom.rSceneJump.disabled = true;
    dom.rSceneJump.innerHTML = '<option value="">—</option>';
    dom.replayFileName.textContent = "no file";
    if (dom.replayScenePicker) {
      dom.replayScenePicker.className = "replay-scene-picker bd-empty";
      dom.replayScenePicker.textContent = "Load a session to choose scenes.";
    }
    if (dom.replayBreakdown) {
      dom.replayBreakdown.className = "bd-empty";
      dom.replayBreakdown.textContent = "Load a session to inspect timing.";
    }
  }

  // Auto-hide menu button in replay during playback
  let menuIdleTimer = null;
  function startAutoHideMenu() {
    if (state.mode !== "replay") return;
    revealMenu();
    if (menuIdleTimer) clearTimeout(menuIdleTimer);
    menuIdleTimer = setTimeout(() => {
      dom.menuBtn.classList.add("idle");
    }, 3000);
  }
  function stopAutoHideMenu() {
    if (menuIdleTimer) { clearTimeout(menuIdleTimer); menuIdleTimer = null; }
    revealMenu();
  }
  function revealMenu() {
    dom.menuBtn.classList.remove("idle");
    if (state.mode === "replay" && Replay.getState().playing) {
      if (menuIdleTimer) clearTimeout(menuIdleTimer);
      menuIdleTimer = setTimeout(() => {
        dom.menuBtn.classList.add("idle");
      }, 3000);
    }
  }
  ["mousemove", "touchstart", "keydown"].forEach((ev) => {
    document.addEventListener(ev, () => {
      if (state.mode === "replay") revealMenu();
    }, { passive: true });
  });

  // ---------- Event wiring ----------
  function wire() {
    // Composer
    dom.composerInput.addEventListener("input", () => {
      autosizeComposer();
      refreshComposerState();
      const v = dom.composerInput.value;
      if (state.mode !== "replay") {
        if (v !== state.inputLastValue) {
          state.inputLastValue = v;
          logEvent("input", { value: v });
        }
      }
      persistLiveSession();
    });
    dom.composerInput.addEventListener("keydown", (e) => {
      if (state.mode !== "replay") {
        logEvent("keydown", { key: e.key });
      }
      // Enter to send (Shift+Enter for newline) — but on mobile typically use Send button
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
    dom.composerInput.addEventListener("focus", () => {
      if (state.mode !== "replay") logEvent("composer_focus", {});
    });
    dom.composerInput.addEventListener("blur", () => {
      if (state.mode !== "replay") logEvent("composer_blur", {});
    });
    dom.composer.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSend();
    });

    // Attachment + mic are visual-only; logged for completeness so replays
    // could later reproduce taps if desired.
    dom.attachBtn.addEventListener("click", () => {
      if (state.mode !== "replay") logEvent("attach_click", {});
      dom.composerInput.focus();
    });
    dom.micBtn.addEventListener("click", () => {
      if (state.mode !== "replay") logEvent("mic_click", {});
      dom.composerInput.focus();
    });

    // Drawer
    dom.menuBtn.addEventListener("click", openDrawer);
    dom.drawerClose.addEventListener("click", closeDrawer);
    dom.drawerScrim.addEventListener("click", closeDrawer);

    // Mode
    dom.modeInputs.forEach((r) => {
      r.addEventListener("change", () => {
        if (r.checked) setMode(r.value);
      });
    });

    // Scene controls
    dom.startSceneBtn.addEventListener("click", () => {
      // If scene already complete, treat as "next"
      const sc = currentScene();
      if (
        !state.scenePickedFromList &&
        sc &&
        state.sceneStartsPlayed.has(sc.id) &&
        state.msgIdx >= sc.messages.length
      ) {
        if (state.sceneIdx + 1 < SCENES.length) {
          state.sceneIdx += 1;
          state.msgIdx = 0;
          startScene();
          return;
        }
      }
      // If no scene selected, pick first un-played
      if (state.sceneIdx < 0) {
        for (let i = 0; i < SCENES.length; i += 1) {
          if (!state.sceneStartsPlayed.has(SCENES[i].id)) {
            state.sceneIdx = i; state.msgIdx = 0; break;
          }
        }
        if (state.sceneIdx < 0) state.sceneIdx = 0;
      }
      startScene();
    });
    dom.endSceneBtn.addEventListener("click", () => {
      if (confirm("End current scene? AI will stop and the scene closes.")) {
        endScene();
      }
    });

    // Session
    dom.exportBtn.addEventListener("click", exportSession);
    dom.discordUploadBtn.addEventListener("click", sendSessionToDiscord);
    dom.resetBtn.addEventListener("click", () => {
      if (confirm("Reset session? This clears the chat and the log.")) {
        hardResetSession({ keepLog: false });
        closeDrawer();
      }
    });

    // Wake Lock + Fullscreen
    dom.wakeLockToggle.addEventListener("change", () => {
      setWakeLock(dom.wakeLockToggle.checked);
    });
    dom.fullscreenToggle.addEventListener("change", () => {
      setFullscreen(dom.fullscreenToggle.checked);
    });
    dom.rFullscreenToggle.addEventListener("change", () => {
      setFullscreen(dom.rFullscreenToggle.checked);
    });

    // Replay
    dom.replayFile.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      dom.replayFileName.textContent = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data.events) throw new Error("missing events[]");
          Replay.load(data);
        } catch (err) {
          alert("Invalid session JSON: " + err.message);
        }
      };
      reader.readAsText(file);
    });
    dom.rPlayBtn.addEventListener("click", () => Replay.play());
    dom.rPauseBtn.addEventListener("click", () => Replay.pause());
    dom.rStopBtn.addEventListener("click", () => Replay.stop());
    dom.rRestartBtn.addEventListener("click", () => Replay.restart());
    dom.rSpeed.addEventListener("change", () => {
      Replay.setSpeed(parseFloat(dom.rSpeed.value));
    });
    dom.rScrub.addEventListener("input", () => {
      Replay.seek(parseInt(dom.rScrub.value, 10));
    });
    dom.rSceneJump.addEventListener("change", () => {
      const v = dom.rSceneJump.value;
      if (v === "") return;
      Replay.seek(parseInt(v, 10));
    });
    dom.replayScenePicker.addEventListener("change", (e) => {
      const input = e.target;
      if (!input || input.type !== "checkbox") return;
      const sceneKey = input.dataset.sceneKey;
      if (!sceneKey) return;
      Replay.toggleSceneSelection(sceneKey, input.checked);
    });

    // Keyboard shortcuts (desktop)
    document.addEventListener("keydown", (e) => {
      if (e.target === dom.composerInput) return;
      if (state.mode === "replay") {
        if (e.key === " ") {
          e.preventDefault();
          const st = Replay.getState();
          if (st.playing) Replay.pause(); else Replay.play();
        }
        if (e.key === "Escape") Replay.stop();
      }
      if (e.key === "Escape" && !dom.drawer.hidden) closeDrawer();
    });
    window.addEventListener("beforeunload", persistLiveSession);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") persistLiveSession();
    });
  }

  // ---------- Init ----------
  function init() {
    wire();
    if (restoreLiveSession()) return;
    setMode("assisted");
    refreshSceneList();
    updateStartSceneBtn();
    updatePromptStrip();
    setModel("GPT-4o");
    autosizeComposer();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
