// CONTENT SCRIPT
// Runs on Reddit pages, injects "Analyze Thread" button

console.log("Reddit Opinion Analyzer loaded on:", window.location.href);

// Function to inject the analyze button
function injectAnalyzeButton() {
  // Check if we're on a Reddit post (not the homepage)
  const postTitle = document.querySelector("h1");
  if (!postTitle) return;

  // Look for the post toolbar area (where upvote, comment, share buttons are)
  const toolbars = document.querySelectorAll('[data-test-id="post-content"]');

  if (toolbars.length === 0) return;

  // Create the analyze button
  const analyzeButton = document.createElement("button");
  analyzeButton.id = "reddit-analyze-button";
  analyzeButton.textContent = "🧠 Analyze Thread";
  analyzeButton.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: bold;
    cursor: pointer;
    font-size: 14px;
    margin-left: 10px;
    transition: transform 0.2s;
  `;

  analyzeButton.onmouseover = () => {
    analyzeButton.style.transform = "scale(1.05)";
  };
  analyzeButton.onmouseout = () => {
    analyzeButton.style.transform = "scale(1)";
  };

  // Click handler: send message to background script
  analyzeButton.addEventListener("click", () => {
    const currentUrl = window.location.href;
    console.log("Analyzing thread:", currentUrl);

    // Send message to background script
    chrome.runtime.sendMessage(
      {
        action: "analyzeRedditPost",
        reddit_url: currentUrl
      },
      (response) => {
        if (response && response.success) {
          console.log("Analysis started");
        } else {
          console.error("Error:", response?.error);
        }
      }
    );
  });

  // Insert button into the first toolbar
  const firstToolbar = toolbars[0];
  if (firstToolbar && !document.getElementById("reddit-analyze-button")) {
    firstToolbar.appendChild(analyzeButton);
    console.log("✅ Analyze button injected");
  }
}

// Run when page loads
window.addEventListener("load", injectAnalyzeButton);

// Also run immediately in case page is already loaded
injectAnalyzeButton();

// Re-run if page content changes (for dynamic Reddit loads)
const observer = new MutationObserver(injectAnalyzeButton);
observer.observe(document.body, { childList: true, subtree: true });
