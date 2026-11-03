import React, { useEffect, useState } from "react";
import "./styles.css";

type Page =
  | "Dashboard"
  | "AI Article Generator"
  | "Article Library"
  | "Websites"
  | "AI Providers"
  | "Content Scheduler";

export default function App() {
  const [page, setPage] = useState<Page>("Dashboard");
  const [sites, setSites] = useState<Website[]>([]);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [siteName, setSiteName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [siteToken, setSiteToken] = useState("");

  const [providerName, setProviderName] = useState("Gemini");
  const [providerModel, setProviderModel] = useState("gemini-2.0-flash");
  const [apiKey, setApiKey] = useState("");

  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [wordCount, setWordCount] = useState("1500");
  const [tone, setTone] = useState("Professional");
  const [instructions, setInstructions] = useState("");

  const [editingArticle, setEditingArticle] =
    useState<Article | null>(null);

  const [scheduleTopic, setScheduleTopic] = useState("");
  const [scheduleSite, setScheduleSite] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [
        dashboard,
        websiteList,
        providerList,
        articleList,
        scheduleList
      ] = await Promise.all([
        window.studio.dashboard(),
        window.studio.listSites(),
        window.studio.listProviders(),
        window.studio.listArticles(),
        window.studio.listSchedules()
      ]);

      setStats(dashboard || {});
      setSites(websiteList || []);
      setProviders(providerList || []);
      setArticles(articleList || []);
      setSchedules(scheduleList || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load application data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function notify(text: string) {
    setMessage(text);
    setError("");
  }

  function showError(err: unknown) {
    setError(
      err instanceof Error ? err.message : "Something went wrong."
    );
    setMessage("");
  }

  async function addWebsite(e: React.FormEvent) {
    e.preventDefault();

    try {
      await window.studio.addSite({
        name: siteName,
        url: siteUrl,
        token: siteToken
      });

      setSiteName("");
      setSiteUrl("");
      setSiteToken("");
      notify("Website added successfully.");
      await loadData();
    } catch (err) {
      showError(err);
    }
  }

  async function removeWebsite(id: number) {
    if (!window.confirm("Delete this website?")) return;

    try {
      await window.studio.deleteSite(id);
      notify("Website deleted.");
      await loadData();
    } catch (err) {
      showError(err);
    }
  }

  async function addProvider(e: React.FormEvent) {
    e.preventDefault();

    try {
      await window.studio.saveProvider({
        name: providerName,
        provider: providerName.toLowerCase(),
        model: providerModel,
        apiKey,
        enabled: true
      });

      setApiKey("");
      notify("AI provider saved successfully.");
      await loadData();
    } catch (err) {
      showError(err);
    }
  }

  async function generateArticle(e: React.FormEvent) {
    e.preventDefault();

    if (!topic.trim()) {
      setError("Please enter an article topic.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await window.studio.generate({
        topic,
        keyword,
        wordCount: Number(wordCount),
        tone,
        instructions
      });

      const count = result?.results?.length ?? 0;

      notify(
        count > 0
          ? `${count} article version(s) generated successfully.`
          : "Generation completed."
      );

      setTopic("");
      await loadData();
      setPage("Article Library");
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveArticle(article: Article) {
    try {
      await window.studio.saveEdit(article);
      setEditingArticle(null);
      notify("Article saved.");
      await loadData();
    } catch (err) {
      showError(err);
    }
  }

  async function sendToWordPress(article: Article) {
    if (sites.length === 0) {
      setError("Please connect a WordPress website first.");
      setPage("Websites");
      return;
    }

    const siteId = Number(
      window.prompt(
        "Enter the website ID:\n" +
        sites.map(s => `${s.id}: ${s.name || s.url}`).join("\n")
      )
    );

    if (!siteId || !sites.some(s => s.id === siteId)) return;

    try {
      await window.studio.publish({
        articleId: article.id,
        siteId
      });

      notify("Article sent to WordPress.");
      await loadData();
    } catch (err) {
      showError(err);
    }
  }

  async function addNewSchedule(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (!scheduleTopic.trim() || !scheduleDate || !scheduleSite) {
        throw new Error("Complete all schedule fields.");
      }

      await window.studio.addSchedule({
        title: scheduleTopic,
        topic: scheduleTopic,
        siteId: Number(scheduleSite),
        run_at: new Date(scheduleDate).toISOString(),
        enabled: true
      });

      setScheduleTopic("");
      setScheduleDate("");
      notify("Schedule saved.");
      await loadData();
    } catch (err) {
      showError(err);
    }
  }

  async function removeSchedule(id: number) {
    try {
      await window.studio.deleteSchedule(id);
      notify("Schedule deleted.");
      await loadData();
    } catch (err) {
      showError(err);
    }
  }

  const menu: Page[] = [
    "Dashboard",
    "AI Article Generator",
    "Article Library",
    "Content Scheduler",
    "Websites",
    "AI Providers"
  ];

  return (
    <div className="app">
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
          {menu.map(item => (
            <button
              key={item}
              className={`nav-item ${page === item ? "active" : ""}`}
              onClick={() => {
                setPage(item);
                setMessage("");
                setError("");
              }}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="plan-card">
            <small>YOUR WORKSPACE</small>
            <strong>AI Content Studio</strong>
            <div className="plan-line"><span /></div>
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

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{page}</h1>
            <p>Manage your AI content workspace.</p>
          </div>
          <div className="top-actions">
            <button className="refresh" onClick={() => void loadData()}>
              ↻ Refresh
            </button>
          </div>
        </header>

        {message && <div className="notice success">{message}</div>}
        {error && <div className="notice error">{error}</div>}

        {page === "Dashboard" && (
          <>
            <section className="hero">
              <div className="hero-content">
                <span className="hero-tag">YOUR AI CONTENT WORKSPACE</span>
                <h2>Turn ideas into search-ready content.</h2>
                <p>
                  Generate articles with AI, manage your library
                  and send reviewed content to WordPress drafts.
                </p>
                <button onClick={() => setPage("AI Article Generator")}>
                  Create an article
                </button>
              </div>
            </section>

            <section className="stats">
              {[
                ["Connected Websites", sites.length],
                ["AI Providers", providers.length],
                ["Articles Created", stats.totalArticles ?? articles.length],
                ["Scheduled Tasks", stats.scheduled ?? schedules.length]
              ].map(([label, value]) => (
                <div className="stat-card" key={String(label)}>
                  <div className="stat-top">
                    <label>{label}</label>
                  </div>
                  <strong>{loading ? "…" : value}</strong>
                </div>
              ))}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <h3>Recent Articles</h3>
                <button onClick={() => setPage("Article Library")}>
                  View library
                </button>
              </div>
              {articles.slice(0, 5).map(article => (
                <div className="list-row" key={article.id}>
                  <div className="list-info">
                    <strong>{article.title}</strong>
                    <small>{article.status || "Generated"}</small>
                  </div>
                </div>
              ))}
              {articles.length === 0 && <p>No articles created yet.</p>}
            </section>
          </>
        )}

        {page === "Websites" && (
          <section className="panel">
            <h3>Connect WordPress Website</h3>
            <form onSubmit={addWebsite} className="studio-form">
              <label>Website name</label>
              <input value={siteName} onChange={e => setSiteName(e.target.value)} required />
              <label>Website URL</label>
              <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://example.com" required />
              <label>WordPress Application Password</label>
              <input type="password" value={siteToken} onChange={e => setSiteToken(e.target.value)} required />
              <button type="submit">Add Website</button>
            </form>

            <h3>Connected Websites</h3>
            {sites.map(site => (
              <div className="list-row" key={site.id}>
                <div className="list-info">
                  <strong>{site.name}</strong>
                  <small>{site.url}</small>
                </div>
                <button onClick={() => void removeWebsite(site.id)}>Delete</button>
              </div>
            ))}
            {sites.length === 0 && <p>No websites connected.</p>}
          </section>
        )}

        {page === "AI Providers" && (
          <section className="panel">
            <h3>Configure AI Provider</h3>
            <form onSubmit={addProvider} className="studio-form">
              <label>Provider</label>
              <select value={providerName} onChange={e => {
                setProviderName(e.target.value);
                setProviderModel(
                  e.target.value === "Gemini"
                    ? "gemini-2.0-flash"
                    : e.target.value === "Groq"
                    ? "llama-3.3-70b-versatile"
                    : "openai/gpt-4o-mini"
                );
              }}>
                <option>Gemini</option>
                <option>Groq</option>
                <option>OpenRouter</option>
              </select>
              <label>Model ID</label>
              <input value={providerModel} onChange={e => setProviderModel(e.target.value)} required />
              <label>API Key</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} required />
              <button type="submit">Save AI Provider</button>
            </form>

            <h3>Configured Providers</h3>
            {providers.map(provider => (
              <div className="list-row" key={provider.id}>
                <div className="list-info">
                  <strong>{provider.name}</strong>
                  <small>{provider.model}</small>
                </div>
                <span>{provider.enabled ? "Enabled" : "Disabled"}</span>
              </div>
            ))}
          </section>
        )}

        {page === "AI Article Generator" && (
          <section className="panel">
            <h3>Generate SEO Article</h3>
            <form onSubmit={generateArticle} className="studio-form">
              <label>Article topic</label>
              <input value={topic} onChange={e => setTopic(e.target.value)} required placeholder="Enter your article topic" />
              <label>Primary keyword</label>
              <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Main SEO keyword" />
              <label>Target word count</label>
              <input type="number" min="300" max="10000" value={wordCount} onChange={e => setWordCount(e.target.value)} />
              <label>Writing tone</label>
              <select value={tone} onChange={e => setTone(e.target.value)}>
                <option>Professional</option>
                <option>Conversational</option>
                <option>Friendly</option>
                <option>Technical</option>
                <option>Persuasive</option>
              </select>
              <label>Additional instructions</label>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={5} />
              <button type="submit" disabled={loading}>
                {loading ? "Generating..." : "Generate Article"}
              </button>
            </form>
            <p>All enabled AI providers are used for parallel generation.</p>
          </section>
        )}

        {page === "Article Library" && (
          <section className="panel">
            <h3>Saved Articles</h3>
            {articles.map(article => (
              <div className="list-row" key={article.id}>
                <div className="list-info">
                  <strong>{article.title}</strong>
                  <small>{article.status || "Generated"}</small>
                </div>
                <button onClick={() => setEditingArticle({ ...article })}>Edit</button>
                <button onClick={() => void sendToWordPress(article)}>Send to Drafts</button>
              </div>
            ))}
            {articles.length === 0 && <p>Your article library is empty.</p>}

            {editingArticle && (
              <div className="editor">
                <h3>Edit Article</h3>
                <label>Title</label>
                <input value={editingArticle.title} onChange={e => setEditingArticle({ ...editingArticle, title: e.target.value })} />
                <label>Content (HTML)</label>
                <textarea rows={18} value={editingArticle.content} onChange={e => setEditingArticle({ ...editingArticle, content: e.target.value })} />
                <label>Meta description</label>
                <textarea rows={3} value={editingArticle.meta_description || ""} onChange={e => setEditingArticle({ ...editingArticle, meta_description: e.target.value })} />
                <button onClick={() => void saveArticle(editingArticle)}>Save Changes</button>
                <button onClick={() => setEditingArticle(null)}>Cancel</button>
              </div>
            )}
          </section>
        )}

        {page === "Content Scheduler" && (
          <section className="panel">
            <h3>Schedule Content Generation</h3>
            <form onSubmit={addNewSchedule} className="studio-form">
              <label>Article topic</label>
              <input value={scheduleTopic} onChange={e => setScheduleTopic(e.target.value)} required />
              <label>WordPress website</label>
              <select value={scheduleSite} onChange={e => setScheduleSite(e.target.value)} required>
                <option value="">Select website</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
              <label>Date and time</label>
              <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} required />
              <button type="submit">Save Schedule</button>
            </form>

            <h3>Scheduled Tasks</h3>
            {schedules.map(item => (
              <div className="list-row" key={item.id}>
                <div className="list-info">
                  <strong>{item.topic || item.title}</strong>
                  <small>{item.run_at}</small>
                </div>
                <button onClick={() => void removeSchedule(item.id)}>Delete</button>
              </div>
            ))}
            {schedules.length === 0 && <p>No scheduled tasks.</p>}
          </section>
        )}

        <footer>
          AI Content Studio · Windows Portable Edition
        </footer>
      </main>
    </div>
  );
}
