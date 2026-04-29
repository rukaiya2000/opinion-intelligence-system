// POPUP APP - Vanilla JavaScript
// Displays the Reddit analysis results

function renderPopup() {
  const root = document.getElementById("root");
  console.log("renderPopup called, root element:", root);

  // Load last analysis from storage
  chrome.storage.local.get(["lastAnalysis"], (result) => {
    console.log("Storage result:", result);
    const analysis = result.lastAnalysis;
    console.log("Analysis data:", analysis);

    if (!analysis) {
      root.innerHTML = `
        <div class="container empty">
          <div class="empty-icon">🔍</div>
          <h2>No Analysis Yet</h2>
          <p>Click the "🧠 Analyze Thread" button on a Reddit post to start</p>
        </div>
      `;
      return;
    }

    // Render analysis results
    let html = `
      <div class="container">
        <header class="header">
          <h1>📊 Thread Analysis</h1>
        </header>
        <div class="content">
    `;

    // Consensus
    if (analysis.consensus) {
      html += `
        <section class="section consensus">
          <div class="section-header">
            <span class="icon">🤝</span>
            <h3>Consensus</h3>
          </div>
          <p class="consensus-text">${escapeHtml(analysis.consensus)}</p>
        </section>
      `;
    }

    // Main Debate
    if (analysis.main_debate) {
      html += `
        <section class="section debate">
          <div class="section-header">
            <span class="icon">🔥</span>
            <h3>Main Debate</h3>
          </div>
          <p class="debate-text">${escapeHtml(analysis.main_debate)}</p>
        </section>
      `;
    }

    // Viewpoints
    if (analysis.viewpoints && analysis.viewpoints.length > 0) {
      html += `
        <section class="section viewpoints">
          <div class="section-header">
            <span class="icon">💭</span>
            <h3>Viewpoints</h3>
          </div>
          <div class="viewpoints-list">
      `;

      analysis.viewpoints.forEach((view) => {
        const sentimentEmoji =
          view.sentiment === "positive"
            ? "😊 Positive"
            : view.sentiment === "negative"
            ? "😞 Negative"
            : "😐 Neutral";

        html += `
          <div class="viewpoint ${view.sentiment}">
            <div class="viewpoint-title">${escapeHtml(view.title)}</div>
            <div class="viewpoint-sentiment">${sentimentEmoji}</div>
            <p class="viewpoint-summary">${escapeHtml(view.summary)}</p>
          </div>
        `;
      });

      html += `
          </div>
        </section>
      `;
    }

    // Most Heated
    if (analysis.most_heated) {
      html += `
        <section class="section heated">
          <div class="section-header">
            <span class="icon">⚡</span>
            <h3>Most Heated Topic</h3>
          </div>
          <p class="heated-text">${escapeHtml(analysis.most_heated)}</p>
        </section>
      `;
    }

    // Gap
    if (analysis.gap) {
      html += `
        <section class="section gap">
          <div class="section-header">
            <span class="icon">⚠️</span>
            <h3>Missing Perspective</h3>
          </div>
          <p class="gap-text">${escapeHtml(analysis.gap)}</p>
        </section>
      `;
    }

    html += `
        </div>
        <footer class="footer">
          <p>Powered by Reddit Opinion Analyzer</p>
        </footer>
      </div>
    `;

    root.innerHTML = html;
  });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Render when popup loads
document.addEventListener("DOMContentLoaded", renderPopup);

// Also render immediately if DOM is already ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderPopup);
} else {
  renderPopup();
}
