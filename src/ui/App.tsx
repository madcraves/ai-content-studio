import React, { useEffect, useState } from "react";
import "./styles.css";

const studio = window.studio as any;

type Page =
  | "Dashboard"
  | "AI Article Generator"
  | "Article Library"
  | "Content Scheduler"
  | "Websites"
  | "AI Providers";

const PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Google's advanced AI models",
    defaultModel: "gemini-3.5-flash"
  },
  {
    id: "groq",
    name: "Groq",
    description: "Ultra-fast AI inference",
    defaultModel: "openai/gpt-oss-120b"
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access multiple AI models",
    defaultModel: "openai/gpt-4o-mini"
  }
];

export default function App() {
  const [page, setPage] = useState<Page>("Dashboard");

  const [sites, setSites] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  const [stats, setStats] = useState<any>({});
  const [online, setOnline] = useState<boolean | null>(null);

  const [providerModels, setProviderModels] = useState<Record<string, string>>({
    gemini: "gemini-3.5-flash",
    groq: "openai/gpt-oss-120b",
    openrouter: "openai/gpt-4o-mini"
  });

  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({});
  const [providerStatus, setProviderStatus] = useState<Record<string, string>>({});
  const [providerLoading, setProviderLoading] = useState<string | null>(null);

  const [siteName, setSiteName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [siteToken, setSiteToken] = useState("");
  const [siteStatus, setSiteStatus] = useState<Record<number, string>>({});
  const [siteLoading, setSiteLoading] = useState<number | null>(null);

  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [wordCount, setWordCount] = useState("1500");
  const [tone, setTone] = useState("Professional");
  const [instructions, setInstructions] = useState("");

  const [scheduleTopic, setScheduleTopic] = useState("");
  const [scheduleSite, setScheduleSite] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");

  const [editingArticle, setEditingArticle] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const menu: Page[] = [
    "Dashboard",
    "AI Article Generator",
    "Article Library",
    "Content Scheduler",
    "Websites",
    "AI Providers"
  ];

  async function loadData() {
    setLoading(true);

    try {
      const [
        dashboard,
        websiteList,
        providerList,
        articleList,
        scheduleList
      ] = await Promise.all([
        studio.dashboard(),
        studio.listSites(),
        studio.listProviders(),
        studio.listArticles(),
        studio.listSchedules()
      ]);

      setStats(dashboard || {});
      setSites(websiteList || []);
      setProviders(providerList || []);
      setArticles(articleList || []);
      setSchedules(scheduleList || []);

      const configured: Record<string, string> = {};

      for (const provider of providerList || []) {
        const id = String(
          provider.provider || provider.name
        ).toLowerCase();

        configured[id] = "connected";
      }

      setProviderStatus(previous => ({
        ...configured,
        ...previous
      }));
    } catch (err: any) {
      setError(err?.message || "Unable to load application data.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshNetwork() {
    try {
      const result = await studio.getConnectionStatus();
      setOnline(Boolean(result?.online));
    } catch {
      setOnline(false);
    }
  }

  useEffect(() => {
    void loadData();
    void refreshNetwork();

    const unsubscribe = studio.onNetworkStatus?.(
      (status: boolean) => setOnline(status)
    );

    const timer = window.setInterval(
      refreshNetwork,
      15000
    );

    return () => {
      window.clearInterval(timer);
      unsubscribe?.();
    };
  }, []);

  function notify(text: string) {
    setMessage(text);
    setError("");
  }

  function showError(err: any) {
    setError(
      err?.message || "Something went wrong."
    );
    setMessage("");
  }

  async function saveProvider(providerId: string) {
    const model = providerModels[providerId];
    const apiKey = providerKeys[providerId] || "";

    if (!model.trim()) {
      setError("Please enter a model ID.");
      return;
    }

    if (!apiKey.trim()) {
      setError("Please enter the API key.");
      return;
    }

    setProviderLoading(providerId);

    try {
      const provider = PROVIDERS.find(p => p.id === providerId)!;

      await studio.saveProvider({
        name: provider.name,
        provider: providerId,
        model,
        apiKey,
        enabled: true
      });

      setProviderKeys(previous => ({
        ...previous,
        [providerId]: ""
      }));

      setProviderStatus(previous => ({
        ...previous,
        [providerId]: "connected"
      }));

      notify(`${provider.name} API key saved securely.`);
      await loadData();
    } catch (err) {
      showError(err);
    } finally {
      setProviderLoading(null);
    }
  }

  async function testProvider(providerId: string) {
    setProviderLoading(providerId);

    try {
      setProviderStatus(previous => ({
        ...previous,
        [providerId]: "testing"
      }));

      const result = await studio.testProvider(providerId);

      setProviderStatus(previous => ({
        ...previous,
        [providerId]: result?.ok ? "connected" : "disconnected"
      }));

      notify(result?.message || "Provider connection successful.");
    } catch (err) {
      setProviderStatus(previous => ({
        ...previous,
        [providerId]: "disconnected"
      }));

      showError(err);
    } finally {
      setProviderLoading(null);
    }
  }

  async function addWebsite(e: React.FormEvent) {
    e.preventDefault();

    try {
      await studio.addSite({
        name: siteName,
        url: siteUrl,
        token: siteToken
      });

      setSiteName("");
      setSiteUrl("");
      setSiteToken("");

      notify("Website saved. You can now test its connection.");
      await loadData();
    } catch (err) {
      showError(err);
    }
  }

  async function testWebsite(id: number) {
    setSiteLoading(id);

    try {
      setSiteStatus(previous => ({
        ...previous,
        [id]: "testing"
      }));

      await studio.testSite(id);

      setSiteStatus(previous => ({
        ...previous,
        [id]: "connected"
      }));

      notify("Website connection successful.");
    } catch (err) {
      setSiteStatus(previous => ({
        ...previous,
        [id]: "disconnected"
      }));

      showError(err);
    } finally {
      setSiteLoading(null);
    }
  }

  async function deleteWebsite(id: number) {
    if (!window.confirm("Delete this website?")) return;

    try {
      await studio.deleteSite(id);
      notify("Website deleted.");
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

    try {
      const result = await studio.generate({
        topic,
        keyword,
        wordCount: Number(wordCount),
        tone,
        instructions
      });

      const count = result?.results?.length ?? 0;

      notify(
        count
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

  async function saveArticle(article: any) {
    try {
      await studio.saveEdit(article);
      setEditingArticle(null);
      notify("Article saved successfully.");
      await loadData();
    } catch (err) {
      showError(err);
    }
  }

  async function sendToWordPress(article: any) {
    if (!sites.length) {
      setPage("Websites");
      setError("Connect a WordPress website first.");
      return;
    }

    const options = sites
      .map(site => `${site.id}: ${site.name}`)
      .join("\n");

    const id = Number(
      window.prompt(`Select WordPress website ID:\n${options}`)
    );

    if (!id || !sites.some(site => site.id === id)) return;

    try {
      await studio.publish({
        articleId: article.id,
        siteId: id
      });

      notify("Article sent to WordPress.");
      await loadData();
    } catch (err) {
      showError(err);
    }
  }

  async function addSchedule(e: React.FormEvent) {
    e.preventDefault();

    try {
      await studio.addSchedule({
        title: scheduleTopic,
        topic: scheduleTopic,
        siteId: Number(scheduleSite),
        run_at: new Date(scheduleDate).toISOString(),
        enabled: true
      });

      setScheduleTopic("");
      setScheduleSite("");
      setScheduleDate("");

      notify("Schedule saved.");
      await loadData();
    } catch (err) {
      showError(err);
    }
  }

  async function deleteSchedule(id: number) {
    try {
      await studio.deleteSchedule(id);
      notify("Schedule deleted.");
      await loadData();
    } catch (err) {
      showError(err);
    }
  }

  function renderProviderStatus(id: string) {
    const status = providerStatus[id];

    if (status === "testing") {
      return <span className="disconnected">Testing...</span>;
    }

    if (status === "connected") {
      return (
        <span className="connected">
          <span className="status-dot" />
          Configured
        </span>
      );
    }

    if (status === "disconnected") {
      return (
        <span className="disconnected">
          <span className="status-dot offline" />
          Disconnected
        </span>
      );
    }

    return <span className="disconnected">Not configured</span>;
  }

  return (
    <div className="app">

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">AI</div>
          <div>
            <h2>Content Studio</h2>
            <small>Professional AI Workspace</small>
          </div>
        </div>

        <div className="menu-label">MAIN WORKSPACE</div>

        <nav>
          {menu.map(item => (
            <button
              key={item}
              className={`nav-item ${page === item ? "active" : ""}`}
              onClick={() => {
                setPage(item);
                setError("");
                setMessage("");
              }}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="plan-card">
            <small>SYSTEM CONNECTION</small>
            <strong>
              {online === null
                ? "Checking connection..."
                : online
                ? "Internet connected"
                : "Internet offline"}
            </strong>
            <span className="system-status">
              <span className={`status-dot ${online ? "" : "offline"}`} />
              {online === null ? "Checking" : online ? "Online" : "Offline"}
            </span>
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
            <p>Manage your AI content operations.</p>
          </div>

          <div className="top-actions">
            <span className={`system-status ${online === false ? "offline" : ""}`}>
              <span className={`status-dot ${online === false ? "offline" : ""}`} />
              {online === null ? "Checking" : online ? "Online" : "Offline"}
            </span>

            <button className="refresh" onClick={() => {
              void loadData();
              void refreshNetwork();
            }}>
              ↻ Refresh
            </button>
          </div>
        </header>

        {message && <div className="notice success">{message}</div>}
        {error && <div className="notice error">{error}</div>}

        {/* DASHBOARD */}

        {page === "Dashboard" && (
          <>
            <section className="hero">
              <div className="hero-content">
                <span className="hero-tag">AI CONTENT AUTOMATION</span>
                <h2>Build better content. Faster.</h2>
                <p>
                  Generate SEO articles, manage multiple WordPress
                  websites and organize your entire content workflow
                  from one workspace.
                </p>
                <button onClick={() => setPage("AI Article Generator")}>
                  + Create New Article
                </button>
              </div>
            </section>

            <section className="stats">
              {[
                ["Connected Websites", sites.length],
                ["Configured AI Providers", providers.length],
                ["Articles Created", stats.totalArticles ?? articles.length],
                ["Scheduled Tasks", stats.scheduled ?? schedules.length]
              ].map(([label, value]) => (
                <div className="stat-card" key={String(label)}>
                  <div className="stat-top">
                    <label>{label}</label>
                  </div>
                  <strong>{loading ? "..." : value}</strong>
                </div>
              ))}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <h3>Recent Articles</h3>
                <button onClick={() => setPage("Article Library")}>
                  View Library
                </button>
              </div>

              {articles.slice(0, 6).map(article => (
                <div className="list-row" key={article.id}>
                  <div className="list-info">
                    <strong>{article.title}</strong>
                    <small>{article.status || "Generated"}</small>
                  </div>
                </div>
              ))}

              {articles.length === 0 && (
                <div className="empty">
                  <h4>No articles yet</h4>
                  <p>Your generated articles will appear here.</p>
                </div>
              )}
            </section>
          </>
        )}

        {/* AI PROVIDERS */}

        {page === "AI Providers" && (
          <>
            <section className="panel">
              <div className="panel-heading">
                <h3>AI Provider Connections</h3>
                <span className="connected">
                  {providers.length} configured
                </span>
              </div>

              <p>
                Configure Gemini, Groq and OpenRouter independently.
                All three providers can remain enabled together.
              </p>
            </section>

            <div className="provider-grid">
              {PROVIDERS.map(provider => {
                const configured = providers.some(
                  item =>
                    String(item.provider || item.name).toLowerCase() === provider.id
                );

                return (
                  <section className="panel provider-card" key={provider.id}>
                    <div className="panel-heading">
                      <div>
                        <h3>{provider.name}</h3>
                        <small>{provider.description}</small>
                      </div>
                      {renderProviderStatus(provider.id)}
                    </div>

                    <div className="provider-logo">
                      {provider.id === "gemini"
                        ? "G"
                        : provider.id === "groq"
                        ? "GQ"
                        : "OR"}
                    </div>

                    <label>Model ID</label>
                    <input
                      value={providerModels[provider.id]}
                      onChange={e =>
                        setProviderModels(previous => ({
                          ...previous,
                          [provider.id]: e.target.value
                        }))
                      }
                      placeholder={provider.defaultModel}
                    />

                    <label>API Key</label>
                    <input
                      type="password"
                      value={providerKeys[provider.id] || ""}
                      onChange={e =>
                        setProviderKeys(previous => ({
                          ...previous,
                          [provider.id]: e.target.value
                        }))
                      }
                      placeholder={
                        configured
                          ? "Saved key — enter a new key to replace"
                          : "Enter your API key"
                      }
                    />

                    {configured && (
                      <p className="provider-saved">
                        <span className="status-dot" />
                        API key saved
                      </p>
                    )}

                    <button
                      disabled={providerLoading === provider.id}
                      onClick={() => void saveProvider(provider.id)}
                    >
                      {providerLoading === provider.id
                        ? "Saving..."
                        : "Save API Configuration"}
                    </button>

                    <button
                      className="refresh"
                      disabled={!configured || providerLoading === provider.id}
                      onClick={() => void testProvider(provider.id)}
                    >
                      {providerLoading === provider.id
                        ? "Testing..."
                        : "Test Connection"}
                    </button>
                  </section>
                );
              })}
            </div>
          </>
        )}

        {/* WEBSITES */}

        {page === "Websites" && (
          <>
            <section className="panel">
              <h3>Connect WordPress Website</h3>
              <p>
                Add your WordPress website to manage and send articles
                directly to its Drafts.
              </p>

              <form onSubmit={addWebsite} className="studio-form">
                <label>Website Name</label>
                <input
                  value={siteName}
                  onChange={e => setSiteName(e.target.value)}
                  placeholder="My WordPress Website"
                  required
                />

                <label>Website URL</label>
                <input
                  type="url"
                  value={siteUrl}
                  onChange={e => setSiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  required
                />

                <label>WordPress Application Password</label>
                <input
                  type="password"
                  value={siteToken}
                  onChange={e => setSiteToken(e.target.value)}
                  placeholder="Enter application password"
                  required
                />

                <button type="submit">+ Connect Website</button>
              </form>
            </section>

            <section className="panel">
              <h3>Connected Websites</h3>

              {sites.map(site => {
                const status = siteStatus[site.id];

                return (
                  <div className="list-row" key={site.id}>
                    <div className="list-info">
                      <strong>{site.name}</strong>
                      <small>{site.url}</small>
                    </div>

                    {status === "connected" ? (
                      <span className="connected">Connected</span>
                    ) : status === "testing" ? (
                      <span className="disconnected">Testing...</span>
                    ) : status === "disconnected" ? (
                      <span className="disconnected">Disconnected</span>
                    ) : (
                      <span className="disconnected">Not tested</span>
                    )}

                    <button
                      disabled={siteLoading === site.id}
                      onClick={() => void testWebsite(site.id)}
                    >
                      Test
                    </button>

                    <button onClick={() => void deleteWebsite(site.id)}>
                      Delete
                    </button>
                  </div>
                );
              })}

              {sites.length === 0 && (
                <div className="empty">
                  <h4>No websites connected</h4>
                  <p>Add a WordPress website to get started.</p>
                </div>
              )}
            </section>
          </>
        )}

        {/* ARTICLE GENERATOR */}

        {page === "AI Article Generator" && (
          <section className="panel">
            <h3>AI Article Generator</h3>
            <p>Create search-friendly content with your configured AI providers.</p>

            <form onSubmit={generateArticle} className="studio-form">
              <label>Article Topic</label>
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="What should the article be about?"
                required
              />

              <label>Primary SEO Keyword</label>
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="Enter primary keyword"
              />

              <label>Target Word Count</label>
              <input
                type="number"
                min="300"
                max="10000"
                value={wordCount}
                onChange={e => setWordCount(e.target.value)}
              />

              <label>Writing Tone</label>
              <select value={tone} onChange={e => setTone(e.target.value)}>
                <option>Professional</option>
                <option>Conversational</option>
                <option>Friendly</option>
                <option>Technical</option>
                <option>Persuasive</option>
              </select>

              <label>Additional Instructions</label>
              <textarea
                rows={6}
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="Add any special content requirements..."
              />

              <button type="submit" disabled={loading}>
                {loading ? "Generating Article..." : "Generate Article"}
              </button>
            </form>
          </section>
        )}

        {/* ARTICLE LIBRARY */}

        {page === "Article Library" && (
          <section className="panel">
            <h3>Article Library</h3>

            {articles.map(article => (
              <div className="list-row" key={article.id}>
                <div className="list-info">
                  <strong>{article.title}</strong>
                  <small>{article.status || "Generated"}</small>
                </div>

                <button onClick={() => setEditingArticle({ ...article })}>
                  Edit
                </button>

                <button onClick={() => void sendToWordPress(article)}>
                  Send to Drafts
                </button>
              </div>
            ))}

            {articles.length === 0 && (
              <div className="empty">
                <h4>Your library is empty</h4>
                <p>Generate an article to see it here.</p>
              </div>
            )}

            {editingArticle && (
              <div className="editor">
                <h3>Edit Article</h3>

                <label>Article Title</label>
                <input
                  value={editingArticle.title}
                  onChange={e =>
                    setEditingArticle({
                      ...editingArticle,
                      title: e.target.value
                    })
                  }
                />

                <label>Article Content</label>
                <textarea
                  rows={18}
                  value={editingArticle.content}
                  onChange={e =>
                    setEditingArticle({
                      ...editingArticle,
                      content: e.target.value
                    })
                  }
                />

                <label>Meta Description</label>
                <textarea
                  rows={3}
                  value={editingArticle.meta_description || ""}
                  onChange={e =>
                    setEditingArticle({
                      ...editingArticle,
                      meta_description: e.target.value
                    })
                  }
                />

                <button onClick={() => void saveArticle(editingArticle)}>
                  Save Changes
                </button>

                <button onClick={() => setEditingArticle(null)}>
                  Cancel
                </button>
              </div>
            )}
          </section>
        )}

        {/* SCHEDULER */}

        {page === "Content Scheduler" && (
          <>
            <section className="panel">
              <h3>Content Scheduler</h3>
              <p>Plan your upcoming AI article generation tasks.</p>

              <form onSubmit={addSchedule} className="studio-form">
                <label>Article Topic</label>
                <input
                  value={scheduleTopic}
                  onChange={e => setScheduleTopic(e.target.value)}
                  required
                />

                <label>Destination Website</label>
                <select
                  value={scheduleSite}
                  onChange={e => setScheduleSite(e.target.value)}
                  required
                >
                  <option value="">Select a website</option>
                  {sites.map(site => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>

                <label>Schedule Date and Time</label>
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  required
                />

                <button type="submit">Create Schedule</button>
              </form>
            </section>

            <section className="panel">
              <h3>Upcoming Tasks</h3>

              {schedules.map(item => (
                <div className="list-row" key={item.id}>
                  <div className="list-info">
                    <strong>{item.topic || item.title}</strong>
                    <small>{item.run_at}</small>
                  </div>

                  <button onClick={() => void deleteSchedule(item.id)}>
                    Delete
                  </button>
                </div>
              ))}

              {schedules.length === 0 && (
                <div className="empty">
                  <h4>No scheduled tasks</h4>
                  <p>Your upcoming tasks will appear here.</p>
                </div>
              )}
            </section>
          </>
        )}

        <footer>
          AI Content Studio · Professional Windows Edition
        </footer>

      </main>
    </div>
  );
}
