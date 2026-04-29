// BACKGROUND SERVICE WORKER
// Handles communication between content script and our FastAPI backend

const BACKEND_URL = "http://127.0.0.1:3001";

console.log("Reddit Opinion Analyzer background worker started");

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request.action);

  if (request.action === "analyzeRedditPost") {
    analyzeRedditPost(request.reddit_url, sendResponse);
    return true; // Keep channel open for async response
  }
});

// Send request to backend and return analysis
async function analyzeRedditPost(redditUrl, sendResponse) {
  try {
    console.log("Sending to backend:", redditUrl);

    // Call our FastAPI backend
    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        reddit_url: redditUrl
      })
    });
    console.log("Received response from backend:", response.status);

    if (!response.ok) {
      throw new Error(`Backend error: ${response.statusText}`);
    }

    const analysisResult = await response.json();
    console.log("✅ Analysis received:", analysisResult);

    // Send result back to popup
    sendResponse({
      success: true,
      data: analysisResult
    });
    console.log("Sent analysis result to popup");

    // Store result for popup to access
    chrome.storage.local.set({
      lastAnalysis: analysisResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error analyzing post:", error.message);
    console.error("Full error:", error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Handler for popup to get latest analysis
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getLatestAnalysis") {
    chrome.storage.local.get(["lastAnalysis"], (result) => {
      sendResponse({
        analysis: result.lastAnalysis || null
      });
    });
    return true;
  }
});
