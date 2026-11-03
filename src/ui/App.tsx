import React, { useEffect, useState } from "react";

declare global {
  interface Window {
    studio: {
      dashboard: () => Promise<any>;
      listSites: () => Promise<any[]>;
      listProviders: () => Promise<any[]>;
      listArticles: () => Promise<any[]>;
    };
  }
}

export default function App() {
  const [dashboard, setDashboard] = useState<any>({});
  const [sites, setSites] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const [stats, websiteList, providerList, articleList] =
        await Promise.all([
          window.studio.dashboard(),
          window.studio.listSites(),
          window.studio.listProviders(),
          window.studio.listArticles()
        ]);

      setDashboard(stats || {});
      setSites(websiteList || []);
      setProviders(providerList || []);
      setArticles(articleList || []);
    } catch (error) {
      console.error("Dashboard loading failed:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const cards = [
    { label: "Websites", value: sites.length },
    { label: "AI Providers", value: providers.length },
    { label: "Total Articles", value: dashboard.totalArticles ?? articles.length },
    { label: "Scheduled", value: dashboard.scheduled ?? 0 }
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">AI</div>
          <div>
            <h2>Content Studio</h2>
            <small>SEO Writing Workspace</small>
          </div>
        </div>

        <nav>
          <div className="nav-item active">▦ Dashboard</div>
          <div className="nav-item">✦ AI Article Generator</div>
          <div className="nav-item">▤ Articles</div>
          <div className="nav-item">🌐 Websites</div>
          <div className="nav-item">⚙ AI Providers</div>
          <div className="nav-item">◷ Scheduler</div>
          <div className="nav-item">⚙ Settings</div>
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          Desktop Application
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>Dashboard</h1>
            <p>Manage your AI content generation workspace.</p>
          </div>
          <div className="top-actions">
            <span className="online"><span className="status-dot" /> System Ready</span>
            <button className="refresh" onClick={loadData}>↻ Refresh</button>
          </div>
        </header>

        <section className="welcome">
          <div>
            <span className="eyebrow">AI CONTENT WORKSPACE</span>
            <h2>Create SEO content with multiple AI models.</h2>
            <p>Generate, compare, edit and send articles to your WordPress websites.</p>
          </div>
          <div className="welcome-icon">✦</div>
        </section>

        <section className="stats">
          {cards.map((card) => (
            <div className="stat-card" key={card.label}>
              <span>{card.label}</span>
              <strong>{loading ? "—" : card.value}</strong>
            </div>
          ))}
        </section>

        <section className="content-grid">
          <div className="panel">
            <div className="panel-heading">
              <h3>Connected Websites</h3>
              <span>{sites.length} connected</span>
            </div>

            {loading ? (
              <p className="muted">Loading websites...</p>
            ) : sites.length === 0 ? (
              <div className="empty">
                <span>🌐</span>
                <h4>No websites connected</h4>
                <p>Add your WordPress website to start creating content.</p>
              </div>
            ) : (
              sites.map((site, index) => (
                <div className="list-row" key={site.id ?? index}>
                  <div className="list-icon">W</div>
                  <div>
                    <strong>{site.name || site.url}</strong>
                    <small>{site.url}</small>
                  </div>
                  <span className="connected">Connected</span>
                </div>
              ))
            )}
          </div>

          <div className="panel">
            <div className="panel-heading">
              <h3>AI Providers</h3>
              <span>{providers.length} configured</span>
            </div>

            {loading ? (
              <p className="muted">Loading providers...</p>
            ) : providers.length === 0 ? (
              <div className="empty">
                <span>✦</span>
                <h4>No AI providers configured</h4>
                <p>Configure Gemini, Groq or OpenRouter API keys.</p>
              </div>
            ) : (
              providers.map((provider, index) => (
                <div className="list-row" key={provider.id ?? index}>
                  <div className="list-icon">✦</div>
                  <div>
                    <strong>{provider.name || provider.provider}</strong>
                    <small>{provider.model || "AI model"}</small>
                  </div>
                  <span className="connected">Configured</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel recent">
          <div className="panel-heading">
            <h3>Recent Articles</h3>
            <span>{articles.length} articles</span>
          </div>

          {loading ? (
            <p className="muted">Loading articles...</p>
          ) : articles.length === 0 ? (
            <div className="empty">
              <span>▤</span>
              <h4>No articles generated yet</h4>
              <p>Your generated articles will appear here.</p>
            </div>
          ) : (
            articles.slice(0, 8).map((article, index) => (
              <div className="list-row" key={article.id ?? index}>
                <div className="list-icon">▤</div>
                <div>
                  <strong>{article.title || "Untitled article"}</strong>
                  <small>{article.status || "Generated"}</small>
                </div>
              </div>
            ))
          )}
        </section>

        <footer>AI Content Studio · Portable Desktop Edition</footer>
      </main>
    </div>
  );
}
