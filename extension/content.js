// CONTENT SCRIPT
// Runs on Reddit pages — injects "Analyze Thread" + inline results below each post's controls

console.log("Reddit Opinion Analyzer loaded on:", window.location.href);

/**
 * Real extension namespaces live on globalThis — never use a lexical `chrome` name,
 * since `window.chrome` can be overwritten by DOM (e.g. id="chrome") in the shared window.
 *
 * Validates `sendMessage` is a real function — partial/window mocks fail this check.
 */
function getGlobals() {
  return typeof globalThis !== "undefined"
    ? globalThis
    : typeof window !== "undefined"
      ? window
      : self;
}

function getExtensionRuntime() {
  try {
    const g = getGlobals();
    const chrom = g.chrome;
    if (
      chrom &&
      typeof chrom.runtime?.sendMessage === "function"
    ) {
      return chrom.runtime;
    }
    const br = g.browser;
    if (
      br &&
      typeof br.runtime?.sendMessage === "function"
    ) {
      return br.runtime;
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

function getExtensionStorageLocal() {
  try {
    const g = getGlobals();
    const chrom = g.chrome;
    if (
      chrom?.storage?.local &&
      typeof chrom.storage.local.set === "function"
    ) {
      return chrom.storage.local;
    }
    const br = g.browser;
    if (
      br?.storage?.local &&
      typeof br.storage.local.set === "function"
    ) {
      return br.storage.local;
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

function getRuntimeLastErrorMessage() {
  try {
    const g = getGlobals();
    return (
      g.chrome?.runtime?.lastError?.message ||
      g.browser?.runtime?.lastError?.message
    );
  } catch (_) {
    return undefined;
  }
}

/**
 * Accept both response shapes:
 * 1) { consensus, main_debate, ... }
 * 2) { success: true, data: { consensus, main_debate, ... } }
 */
function normalizeAnalysisPayload(payload) {
  if (!payload || typeof payload !== "object") return null;

  // Already flattened analysis object
  if (
    payload.consensus ||
    payload.main_debate ||
    payload.most_heated ||
    payload.gap ||
    Array.isArray(payload.viewpoints)
  ) {
    return payload;
  }

  // Nested backend shape
  if (payload.success === true && payload.data && typeof payload.data === "object") {
    return payload.data;
  }

  return null;
}

/** Resolve permalink for the Reddit post containing this Share control */
function getPostPermalinkFromShareBtn(shareBtn) {
  const post = shareBtn.closest("shreddit-post");
  if (post) {
    const permalink = post.getAttribute("permalink");
    const hrefAttr = post.getAttribute("href");
    let path = permalink || hrefAttr;
    if (path) {
      if (path.startsWith("http://") || path.startsWith("https://")) return path;
      if (path.startsWith("/")) return `https://www.reddit.com${path}`;
    }
  }
  return window.location.href;
}

function escapeHtml(text) {
  if (text == null || text === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

/** Build the same structured HTML as the popup uses */
function renderAnalysisInnerHtml(analysis) {
  let html = "";

  if (analysis.consensus) {
    html += `
      <section class="roa-section roa-consensus">
        <div class="roa-section-header"><span class="roa-icon">🤝</span><h3>Consensus</h3></div>
        <p class="roa-body">${escapeHtml(analysis.consensus)}</p>
      </section>`;
  }

  if (analysis.main_debate) {
    html += `
      <section class="roa-section roa-debate">
        <div class="roa-section-header"><span class="roa-icon">🔥</span><h3>Main Debate</h3></div>
        <p class="roa-body">${escapeHtml(analysis.main_debate)}</p>
      </section>`;
  }

  if (analysis.viewpoints && analysis.viewpoints.length > 0) {
    html += `
      <section class="roa-section roa-viewpoints">
        <div class="roa-section-header"><span class="roa-icon">💭</span><h3>Viewpoints</h3></div>
        <div class="roa-viewpoints-list">`;
    analysis.viewpoints.forEach((view) => {
      const sentimentCls = ["positive", "negative", "neutral"].includes(
        view.sentiment
      )
        ? view.sentiment
        : "neutral";
      const sentimentEmoji =
        view.sentiment === "positive"
          ? "😊 Positive"
          : view.sentiment === "negative"
            ? "😞 Negative"
            : "😐 Neutral";
      html += `
        <div class="roa-viewpoint roa-${sentimentCls}">
          <div class="roa-viewpoint-title">${escapeHtml(view.title)}</div>
          <div class="roa-viewpoint-sentiment">${sentimentEmoji}</div>
          <p class="roa-viewpoint-summary">${escapeHtml(view.summary)}</p>
        </div>`;
    });
    html += `</div></section>`;
  }

  if (analysis.most_heated) {
    html += `
      <section class="roa-section roa-heated">
        <div class="roa-section-header"><span class="roa-icon">⚡</span><h3>Most Heated Topic</h3></div>
        <p class="roa-body">${escapeHtml(analysis.most_heated)}</p>
      </section>`;
  }

  if (analysis.gap) {
    html += `
      <section class="roa-section roa-gap">
        <div class="roa-section-header"><span class="roa-icon">⚠️</span><h3>Missing Perspective</h3></div>
        <p class="roa-body">${escapeHtml(analysis.gap)}</p>
      </section>`;
  }

  return html;
}

function injectResultStylesOnce() {
  if (document.getElementById("reddit-opinion-inline-styles")) return;
  const style = document.createElement("style");
  style.id = "reddit-opinion-inline-styles";
  style.textContent = `
    .reddit-opinion-results[data-roa-inline] {
      box-sizing: border-box;
      width: 100%;
      margin: 10px 0 12px 0;
      padding: 12px;
      border-radius: 14px;
      background: #ffffff;
      border: 1px solid #edeff1;
      box-shadow: 0 1px 4px rgba(26, 26, 27, 0.12);
      color: #1a1a1b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.45;
      max-height: 420px;
      overflow-y: auto;
      clear: both;
      z-index: 5;
    }
    .reddit-opinion-results[data-roa-inline] .roa-loading,
    .reddit-opinion-results[data-roa-inner] .roa-loading {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #ff4500;
    }
    .reddit-opinion-results[data-roa-inline] .roa-spinner {
      width: 22px; height: 22px;
      border: 2px solid #ffd8cc;
      border-top-color: #ff4500;
      border-radius: 50%;
      animation: roa-spin 0.85s linear infinite;
    }
    @keyframes roa-spin { to { transform: rotate(360deg); } }
    .reddit-opinion-results .roa-err {
      color: #d93a00;
      margin: 0;
    }
    .reddit-opinion-results .roa-section {
      background: #ffffff;
      border: 1px solid #edeff1;
      border-left: 4px solid #ff4500;
      padding: 10px 12px;
      margin-bottom: 10px;
      border-radius: 10px;
    }
    .reddit-opinion-results .roa-section-header {
      display: flex;
      align-items: center;
      margin-bottom: 6px;
    }
    .reddit-opinion-results .roa-section-header h3 {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: #ff4500;
    }
    .reddit-opinion-results .roa-icon { margin-right: 8px; font-size: 16px; }
    .reddit-opinion-results .roa-body {
      margin: 0;
      color: #1c1c1c;
      font-size: 12px;
    }
    .reddit-opinion-results .roa-viewpoints-list { display: flex; flex-direction: column; gap: 8px; }
    .reddit-opinion-results .roa-viewpoint {
      background: #f8f9fa;
      padding: 8px 10px;
      border-radius: 6px;
      border-left: 3px solid #ffb899;
    }
    .reddit-opinion-results .roa-viewpoint.roa-positive { border-left-color: #46d160; }
    .reddit-opinion-results .roa-viewpoint.roa-negative { border-left-color: #ff4500; }
    .reddit-opinion-results .roa-viewpoint.roa-neutral { border-left-color: #7193ff; }
    .reddit-opinion-results .roa-viewpoint-title { font-weight: 600; color: #1a1a1b; font-size: 12px; margin-bottom: 4px; }
    .reddit-opinion-results .roa-viewpoint-sentiment { font-size: 11px; color: #6a6d70; margin-bottom: 4px; }
    .reddit-opinion-results .roa-viewpoint-summary { font-size: 12px; margin: 0; color: #1c1c1c; }
    button[data-roa-analyze-btn] {
      background: #ff4500 !important;
      color: white !important;
      border: 1px solid #ff4500 !important;
      padding: 8px 16px !important;
      border-radius: 20px !important;
      font-weight: bold !important;
      cursor: pointer !important;
      font-size: 14px !important;
      line-height: 1 !important;
      height: 34px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      vertical-align: middle !important;
      white-space: nowrap !important;
      margin-left: 10px !important;
      transition: transform 0.2s;
    }
    button[data-roa-analyze-btn]:hover {
      background: #e03d00 !important;
      border-color: #e03d00 !important;
    }
    button[data-roa-analyze-btn][disabled] { opacity: 0.65; cursor: wait !important; }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function injectForShareButton(shareBtn) {
  const toolbar =
    shareBtn.parentElement?.parentElement || shareBtn.parentElement;
  if (!toolbar) return;

  if (toolbar.querySelector("[data-roa-analyze-btn]")) return;

  injectResultStylesOnce();

  const analyzeButton = document.createElement("button");
  analyzeButton.type = "button";
  analyzeButton.setAttribute("data-roa-analyze-btn", "1");
  analyzeButton.textContent = "Analyze";

  analyzeButton.addEventListener("mouseenter", () => {
    if (!analyzeButton.disabled) analyzeButton.style.transform = "scale(1.05)";
  });
  analyzeButton.addEventListener("mouseleave", () => {
    analyzeButton.style.transform = "scale(1)";
  });

  const resultsOuter = document.createElement("div");
  resultsOuter.className = "reddit-opinion-results";
  resultsOuter.setAttribute("data-roa-inline", "1");
  resultsOuter.hidden = true;

  const permalink = () => getPostPermalinkFromShareBtn(shareBtn);

  analyzeButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const url = permalink();
    analyzeButton.disabled = true;
    resultsOuter.hidden = false;
    resultsOuter.innerHTML = `
      <div class="roa-loading">
        <div class="roa-spinner"></div>
        <span>Analyzing thread…</span>
      </div>`;

    const extRuntime = getExtensionRuntime();
    if (!extRuntime) {
      analyzeButton.disabled = false;
      resultsOuter.innerHTML = `<p class="roa-err">Extension messaging is not available on this page. Reload the tab, or ensure the extension is enabled and has permission for reddit.com.</p>`;
      return;
    }

    extRuntime.sendMessage({ action: "analyzeRedditPost", reddit_url: url }, (response) => {
      analyzeButton.disabled = false;
      resultsOuter.hidden = false;

      const lastErr = getRuntimeLastErrorMessage();
      if (lastErr) {
        resultsOuter.innerHTML = `<p class="roa-err">${escapeHtml(lastErr)}</p>`;
        return;
      }
      if (!response || !response.success) {
        resultsOuter.innerHTML = `<p class="roa-err">${escapeHtml(response?.error || "Unknown error")}</p>`;
        return;
      }

      if (response.data?.success === false) {
        resultsOuter.innerHTML = `<p class="roa-err">${escapeHtml(response.data?.error || "Backend reported an error")}</p>`;
        return;
      }

      const data = normalizeAnalysisPayload(response.data);
      if (!data) {
        resultsOuter.innerHTML = `<p class="roa-err">Unexpected response format from backend.</p>`;
        return;
      }

      const inner = renderAnalysisInnerHtml(data);
      if (!inner.trim()) {
        resultsOuter.innerHTML =
          `<p class="roa-body" style="color:#aaa">No structured fields returned.</p>`;
      } else {
        resultsOuter.innerHTML = inner;
      }

      const storage = getExtensionStorageLocal();
      if (storage?.set) {
        storage.set({
          lastAnalysis: data,
          timestamp: new Date().toISOString(),
        });
      }
    });
  });

  toolbar.appendChild(analyzeButton);
  toolbar.insertAdjacentElement("afterend", resultsOuter);

  console.log("✅ Analyze + inline panel injected for:", permalink());
}

/** Collect distinct Share buttons (one actionable control per post row) */
function findShareAnchors() {
  const clickable = [...document.querySelectorAll('button, [role="button"]')];
  const out = [];
  const seenRoots = new Set();

  for (const el of clickable) {
    const t = ((el.innerText || el.textContent || "") + "").trim();
    if (!t.includes("Share") || t.includes("Analyze")) continue;

    const postRoot =
      el.closest("shreddit-post") ||
      el.closest("article") ||
      el.closest('[data-testid="post-container"]') ||
      el;

    if (seenRoots.has(postRoot)) continue;
    if (postRoot.querySelector?.("[data-roa-analyze-btn]")) {
      seenRoots.add(postRoot);
      continue;
    }

    seenRoots.add(postRoot);
    out.push(el);
  }
  return out;
}

function injectAnalyzeButtons() {
  const anchors = findShareAnchors();
  console.log(`Reddit Opinion: found ${anchors.length} Share anchor(s)`);
  for (const shareBtn of anchors) {
    try {
      injectForShareButton(shareBtn);
    } catch (err) {
      console.warn("reddit-opinion inject failed:", err);
    }
  }
}

let injectDebounceTimer;
function scheduleInjectAnalyzeButtons() {
  clearTimeout(injectDebounceTimer);
  injectDebounceTimer = setTimeout(injectAnalyzeButtons, 200);
}

window.addEventListener("load", scheduleInjectAnalyzeButtons);
scheduleInjectAnalyzeButtons();

const observer = new MutationObserver(scheduleInjectAnalyzeButtons);
observer.observe(document.body, { childList: true, subtree: true });
