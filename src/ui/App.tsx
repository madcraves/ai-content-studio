import React, { useEffect, useState } from "react";
import "./styles.css";

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardStats>({});
  const [sites, setSites] = useState<Website[]>([]);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

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
    } catch (err) {
      console.error("Dashboard error:", err);
      setError("Unable to load dashboard data. Please restart the application.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const stats = [
    {
      label: "Connected Websites",
      value: sites.length,
      icon: "🌐",
      note: "WordPress workspaces"
    },
    {
      label: "AI Providers",
      value: providers.length,
      icon: "✦",
      note: "Configured AI engines"
    },
    {
      label: "Articles Created",
      value: dashboard.totalArticles ?? articles.length,
      icon: "▤",
      note: "Saved in your library"
    },
    {
      label: "Scheduled Tasks",
      value: dashboard.scheduled ?? 0,
      icon: "◷",
      note: "Upcoming content jobs"
    }
  ];

  return (
    <div className="app">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <div className="brand">
          <div className="brand-icon">AI</div>
          <div>
            <h2>Content Studio</h2>
            <small>Intelligent SEO Workspace</small>
          </div>
        </div>

        <div className="menu-label">WORKSPACE</div>

        <nav>
          <div className="nav-item active">
            <span className="nav-icon">▦</span>
            <span>Dashboard</span>
          </div>

          <div className="nav-item">
            <span className="nav-icon">✦</span>
            <span>AI Article Generator</span>
          </div>

          <div className="nav-item">
            <span className="nav-icon">▤</span>
            <span>Article Library</span>
          </div>

          <div className="nav-item">
            <span className="nav-icon">◷</span>
            <span>Content Scheduler</span>
          </div>
        </nav>

        <div className="menu-label">MANAGEMENT</div>

        <nav>
          <div className="nav-item">
            <span className="nav-icon">🌐</span>
            <span>Websites</span>
          </div>

          <div className="nav-item">
            <span className="nav-icon">✧</span>
            <span>AI Providers</span>
          </div>

          <div className="nav-item">
            <span className="nav-icon">▧</span>
            <span>Media Library</span>
          </div>

          <div className="nav-item">
            <span className="nav-icon">⚙</span>
            <span>Settings</span>
          </div>
        </nav>

        <div className="sidebar-bottom">

          <div className="plan-card">
            <small>YOUR WORKSPACE</small>
            <strong>AI Content Studio</strong>
            <div className="plan-line">
              <span />
            </div>
          </div>

          <div className="profile">
            <div className="avatar">AI</div>
            <div>
              <strong>Workspace Owner</strong>
              <small>Local desktop account</small>
            </div>
          </div>

        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main">

        <header className="topbar">
          <div>
            <h1>Dashboard</h1>
            <p>Your content operations, all in one place.</p>
          </div>

          <div className="top-actions">
            <span className="system-status">
              <span className="status-dot" />
              System Online
            </span>

            <button
              className="refresh"
              onClick={() => void loadData()}
              disabled={loading}
            >
              ↻ &nbsp; {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </header>

        {/* HERO */}
        <section className="hero">

          <div className="hero-content">
            <span className="hero-tag">
              ✦ &nbsp; YOUR AI CONTENT WORKSPACE
            </span>

            <h2>Turn ideas into search-ready content.</h2>

            <p>
              Generate with multiple AI models, compare results
              and manage your WordPress content from one workspace.
            </p>
          </div>

          <div className="hero-art">✧</div>

        </section>

        {/* STATISTICS */}
        <div className="section-title">
          <h3>Workspace Overview</h3>
          <span>LIVE WORKSPACE DATA</span>
        </div>

        <section className="stats">

          {stats.map((item) => (
            <div className="stat-card" key={item.label}>

              <div className="stat-top">
                <label>{item.label}</label>
                <div className="stat-icon">{item.icon}</div>
              </div>

              <strong>
                {loading ? "—" : item.value}
              </strong>

              <div className="stat-note">{item.note}</div>

            </div>
          ))}

        </section>

        {/* CONNECTIONS */}
        <section className="two-columns">

          {/* WORDPRESS WEBSITES */}
          <div className="panel">

            <div className="panel-heading">
              <h3>Connected Websites</h3>
              <span>{sites.length} websites</span>
            </div>

            {loading ? (
              <div className="empty">Loading websites...</div>
            ) : sites.length === 0 ? (

              <div className="empty">
                <div className="empty-icon">🌐</div>
                <h4>No websites connected</h4>
                <p>
                  Connect WordPress websites to manage your content.
                </p>
              </div>

            ) : (

              sites.slice(0, 5).map((site) => (
                <div className="list-row" key={site.id}>

                  <div className="list-icon">W</div>

                  <div className="list-info">
                    <strong>{site.name || site.url}</strong>
                    <small>{site.url}</small>
                  </div>

                  <span className="connected">Connected</span>

                </div>
              ))

            )}

          </div>

          {/* AI PROVIDERS */}
          <div className="panel">

            <div className="panel-heading">
              <h3>AI Engine Connections</h3>
              <span>{providers.length} providers</span>
            </div>

            {loading ? (
              <div className="empty">Loading AI providers...</div>
            ) : providers.length === 0 ? (

              <div className="empty">
                <div className="empty-icon">✦</div>
                <h4>No AI engines configured</h4>
                <p>
                  Connect Gemini, Groq or OpenRouter to begin.
                </p>
              </div>

            ) : (

              providers.slice(0, 5).map((provider) => (
                <div className="list-row" key={provider.id}>

                  <div className="list-icon">✦</div>

                  <div className="list-info">
                    <strong>
                      {provider.name || provider.provider}
                    </strong>
                    <small>{provider.model || "AI model"}</small>
                  </div>

                  <span className="connected">Configured</span>

                </div>
              ))

            )}

          </div>

        </section>

        {/* RECENT ARTICLES */}
        <section className="panel recent">

          <div className="panel-heading">
            <h3>Recent Articles</h3>
            <span>{articles.length} saved articles</span>
          </div>

          {loading ? (

            <div className="empty">Loading articles...</div>

          ) : articles.length === 0 ? (

            <div className="empty">
              <div className="empty-icon">▤</div>
              <h4>Your article library is waiting</h4>
              <p>
                Generated articles will appear here for review and editing.
              </p>
            </div>

          ) : (

            <>
              <div className="article-header">
                <span>ARTICLE TITLE</span>
                <span>STATUS</span>
                <span>DATE</span>
              </div>

              {articles.slice(0, 8).map((article) => (

                <div className="article-row" key={article.id}>

                  <strong>
                    {article.title || "Untitled article"}
                  </strong>

                  <span className="article-status">
                    {article.status || "Generated"}
                  </span>

                  <small className="article-date">
                    {article.created_at || "—"}
                  </small>

                </div>

              ))}

            </>

          )}

        </section>

        {error && (
          <div className="empty">
            {error}
          </div>
        )}

        <footer>
          AI Content Studio · Premium Desktop Workspace · Portable Edition
        </footer>

      </main>
    </div>
  );
}
