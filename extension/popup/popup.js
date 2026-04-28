// POPUP REACT APP
// Displays the Reddit analysis results in a beautiful UI

const { useState, useEffect } = React;

function PopupApp() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load last analysis when popup opens
    chrome.runtime.sendMessage(
      { action: "getLatestAnalysis" },
      (response) => {
        if (response.analysis) {
          setAnalysis(response.analysis);
        }
      }
    );
  }, []);

  // Listen for analysis results from background script
  useEffect(() => {
    const handleMessage = (message) => {
      if (message.type === "analysisComplete") {
        setAnalysis(message.data);
        setLoading(false);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  if (error) {
    return (
      <div className="container error">
        <div className="error-icon">❌</div>
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container loading">
        <div className="spinner"></div>
        <h2>Analyzing Thread...</h2>
        <p>This may take 30-60 seconds</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="container empty">
        <div className="empty-icon">🔍</div>
        <h2>No Analysis Yet</h2>
        <p>Click the "🧠 Analyze Thread" button on a Reddit post to start</p>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>📊 Thread Analysis</h1>
      </header>

      <div className="content">
        {/* Consensus */}
        {analysis.consensus && (
          <section className="section consensus">
            <div className="section-header">
              <span className="icon">🤝</span>
              <h3>Consensus</h3>
            </div>
            <p className="consensus-text">{analysis.consensus}</p>
          </section>
        )}

        {/* Main Debate */}
        {analysis.main_debate && (
          <section className="section debate">
            <div className="section-header">
              <span className="icon">🔥</span>
              <h3>Main Debate</h3>
            </div>
            <p className="debate-text">{analysis.main_debate}</p>
          </section>
        )}

        {/* Viewpoints */}
        {analysis.viewpoints && analysis.viewpoints.length > 0 && (
          <section className="section viewpoints">
            <div className="section-header">
              <span className="icon">💭</span>
              <h3>Viewpoints</h3>
            </div>
            <div className="viewpoints-list">
              {analysis.viewpoints.map((view, idx) => (
                <div key={idx} className={`viewpoint ${view.sentiment}`}>
                  <div className="viewpoint-title">{view.title}</div>
                  <div className="viewpoint-sentiment">
                    {view.sentiment === "positive" && "😊 Positive"}
                    {view.sentiment === "negative" && "😞 Negative"}
                    {view.sentiment === "neutral" && "😐 Neutral"}
                  </div>
                  <p className="viewpoint-summary">{view.summary}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Most Heated */}
        {analysis.most_heated && (
          <section className="section heated">
            <div className="section-header">
              <span className="icon">⚡</span>
              <h3>Most Heated Topic</h3>
            </div>
            <p className="heated-text">{analysis.most_heated}</p>
          </section>
        )}

        {/* Gap */}
        {analysis.gap && (
          <section className="section gap">
            <div className="section-header">
              <span className="icon">⚠️</span>
              <h3>Missing Perspective</h3>
            </div>
            <p className="gap-text">{analysis.gap}</p>
          </section>
        )}
      </div>

      <footer className="footer">
        <p>Powered by Reddit Opinion Analyzer</p>
      </footer>
    </div>
  );
}

// Render the app
ReactDOM.createRoot(document.getElementById("root")).render(<PopupApp />);
