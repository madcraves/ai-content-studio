import React, { useCallback, useEffect, useState } from "react";
import "./styles.css";

const studio = window.studio as any;

type Page =
  | "Dashboard"
  | "AI Article Generator"
  | "Article Library"
  | "Content Scheduler"
  | "Websites"
  | "AI Providers";

type Provider = {
  id: string;
  name: string;
  description: string;
  model: string;
};

const PROVIDERS: Provider[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Google AI article generation",
    model: "gemini-3.5-flash",
  },
  {
    id: "groq",
    name: "Groq",
    description: "Fast AI inference",
    model: "openai/gpt-oss-120b",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Multi-model AI gateway",
    model: "openai/gpt-4o-mini",
  },
];

const NAVIGATION: Page[] = [
  "Dashboard",
  "AI Article Generator",
  "Article Library",
  "Content Scheduler",
  "Websites",
  "AI Providers",
];

const emptyMessage = "No records found.";

function formatDate(value: any) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString();
}

function App() {
  const [page, setPage] = useState<Page>("Dashboard");

  const [licenseChecking, setLicenseChecking] = useState(true);
  const [licenseStatus, setLicenseStatus] = useState<any>(null);
  const [machineId, setMachineId] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [licenseLoading, setLicenseLoading] = useState(false);

  const [sites, setSites] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});

  const [online, setOnline] = useState(true);
  const [updateInfo, setUpdateInfo] = useState<any>({ status: "idle" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [providerStatus, setProviderStatus] = useState<
    Record<string, string>
  >({});
  const [providerLoading, setProviderLoading] = useState<string | null>(null);
  const [providerKeyInputs, setProviderKeyInputs] = useState<Record<string, string>>({});
  const [providerModelInputs, setProviderModelInputs] = useState<Record<string, string>>({});
  const [providerSaving, setProviderSaving] = useState<string | null>(null);
  const [manualProviderName, setManualProviderName] = useState("");
  const [manualProviderModel, setManualProviderModel] = useState("");
  const [manualProviderBaseUrl, setManualProviderBaseUrl] = useState("");
  const [manualProviderApiKey, setManualProviderApiKey] = useState("");
  const [manualProviderSaving, setManualProviderSaving] = useState(false);
  const [multiAgent, setMultiAgent] = useState(true);

  const [siteName, setSiteName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [siteToken, setSiteToken] = useState("");
  const [siteLoading, setSiteLoading] = useState(false);
  const [siteStatus, setSiteStatus] = useState<Record<string, string>>({});

  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [wordCount, setWordCount] = useState("2000");
  const [tone, setTone] = useState("Professional");
  const [instructions, setInstructions] = useState("");
  const [articleLoading, setArticleLoading] = useState(false);
  const [generatedOptions, setGeneratedOptions] = useState<any[]>([]);
  const [generatedArticle, setGeneratedArticle] = useState<any>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");

  const [editingArticle, setEditingArticle] = useState<any>(null);

  const [scheduleTopic, setScheduleTopic] = useState("");
  const [scheduleKeyword, setScheduleKeyword] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [publishingArticle, setPublishingArticle] = useState(false);

  const notify = useCallback((text: string, isError = false) => {
    setMessage(isError ? "" : text);
    setError(isError ? text : "");
  }, []);

  const clearNotifications = useCallback(() => {
    setMessage("");
    setError("");
  }, []);

  const loadData = useCallback(async (force = false) => {
    if (
      !force &&
      !licenseStatus?.activated &&
      !licenseChecking &&
      licenseStatus !== null
    ) {
      return;
    }

    try {
      const [
        dashboardData,
        siteData,
        providerData,
        articleData,
        scheduleData,
      ] = await Promise.all([
        studio.dashboard(),
        studio.listSites(),
        studio.listProviders(),
        studio.listArticles(),
        studio.listSchedules(),
      ]);

      setStats(dashboardData || {});
      setSites(Array.isArray(siteData) ? siteData : []);
      setProviders(Array.isArray(providerData) ? providerData : []);
      setArticles(Array.isArray(articleData) ? articleData : []);
      setSchedules(Array.isArray(scheduleData) ? scheduleData : []);
    } catch (err: any) {
      console.error("Data loading error:", err);
      notify(err?.message || "Unable to load application data.", true);
    }
  }, [licenseStatus, licenseChecking, notify]);

  const refreshNetwork = useCallback(async () => {
    try {
      const result = await studio.getConnectionStatus();
      setOnline(Boolean(result?.online));
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const [status, id] = await Promise.all([
          studio.getLicenseStatus(),
          studio.getMachineId(),
        ]);

        if (!active) return;

        setLicenseStatus(status);
        setMachineId(id || "");

        if (status?.activated) {
          await loadData(true);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        if (active) setLicenseChecking(false);
      }

      if (active) await refreshNetwork();
    }

    void initialize();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    studio.getUpdateStatus?.().then((status: any) => { if (active && status) setUpdateInfo(status); }).catch(() => {});
    const unsubscribe = studio.onUpdateStatus?.((status: any) => setUpdateInfo(status));
    return () => { active = false; if (typeof unsubscribe === "function") unsubscribe(); };
  }, []);

  useEffect(() => {
    const unsubscribe = studio.onNetworkStatus?.(
      (status: { online: boolean }) => {
        setOnline(Boolean(status?.online));
      }
    );

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  async function activateLicense() {
    clearNotifications();

    if (!activationCode.trim()) {
      notify("Please enter your license activation code.", true);
      return;
    }

    setLicenseLoading(true);

    try {
      const result = await studio.activateLicense(activationCode.trim());

      if (!result?.activated) {
        notify(result?.message || "License activation failed.", true);
        return;
      }

      setLicenseStatus(result);
      setActivationCode("");

      await loadData(true);

      setPage("Dashboard");
      notify("License activated successfully.");
    } catch (err: any) {
      notify(err?.message || "License activation failed.", true);
    } finally {
      setLicenseLoading(false);
    }
  }

  async function testProvider(providerId: string) {
    clearNotifications();
    setProviderLoading(providerId);
    setProviderStatus((previous) => ({
      ...previous,
      [providerId]: "Testing...",
    }));

    try {
      const result = await studio.testProvider(providerId);

      if (result?.ok || result?.success) {
        setProviderStatus((previous) => ({
          ...previous,
          [providerId]: "Connected",
        }));
        notify(`${providerId} connection successful.`);
      } else {
        const detail = result?.message || "Connection failed.";

        setProviderStatus((previous) => ({
          ...previous,
          [providerId]: "Failed",
        }));

        notify(detail, true);
      }
    } catch (err: any) {
      setProviderStatus((previous) => ({
        ...previous,
        [providerId]: "Failed",
      }));

      notify(err?.message || "Provider connection test failed.", true);
    } finally {
      setProviderLoading(null);
    }
  }

  async function saveBuiltinProvider(provider: any) {
    clearNotifications();
    const apiKey = providerKeyInputs[provider.id]?.trim();
    const model = (providerModelInputs[provider.id] || provider.model || "").trim();
    if (!apiKey) {
      notify(`Enter your ${provider.name} API key first.`, true);
      return;
    }
    if (!model) {
      notify("Enter a valid model ID.", true);
      return;
    }
    setProviderSaving(provider.id);
    try {
      await studio.saveProvider({
        name: provider.name,
        provider: provider.id,
        model,
        apiKey,
        enabled: true,
      });
      setProviderKeyInputs((current) => ({ ...current, [provider.id]: "" }));
      await loadData(true);
      notify(`${provider.name} settings saved. Test the connection before generating articles.`);
    } catch (err: any) {
      notify(err?.message || `Unable to save ${provider.name} settings.`, true);
    } finally {
      setProviderSaving(null);
    }
  }

  async function saveManualProvider(event?: React.FormEvent) {
    event?.preventDefault();
    clearNotifications();
    if (!manualProviderName.trim() || !manualProviderModel.trim() || !manualProviderBaseUrl.trim() || !manualProviderApiKey.trim()) {
      notify("Complete provider name, Base URL, Model ID and API key.", true);
      return;
    }
    setManualProviderSaving(true);
    try {
      await studio.saveProvider({ name: manualProviderName.trim(), provider: "openai-compatible", model: manualProviderModel.trim(), baseUrl: manualProviderBaseUrl.trim(), apiKey: manualProviderApiKey.trim(), enabled: true });
      setManualProviderName(""); setManualProviderModel(""); setManualProviderBaseUrl(""); setManualProviderApiKey("");
      await loadData(true);
      notify("Custom AI provider saved. Test its connection before generating content.");
    } catch (err: any) {
      notify(err?.message || "Unable to save custom AI provider.", true);
    } finally { setManualProviderSaving(false); }
  }

  async function addWebsite(event?: React.FormEvent) {
    event?.preventDefault();
    clearNotifications();

    if (!siteName.trim() || !siteUrl.trim() || !siteToken.trim()) {
      notify("Please complete all website fields.", true);
      return;
    }

    setSiteLoading(true);

    try {
      await studio.addSite({
        name: siteName.trim(),
        url: siteUrl.trim(),
        token: siteToken.trim(),
      });

      setSiteName("");
      setSiteUrl("");
      setSiteToken("");

      await loadData(true);
      notify("Website added successfully.");
    } catch (err: any) {
      notify(err?.message || "Unable to add website.", true);
    } finally {
      setSiteLoading(false);
    }
  }

  async function testWebsite(id: number | string) {
    clearNotifications();

    setSiteStatus((previous) => ({
      ...previous,
      [String(id)]: "Testing...",
    }));

    try {
      const result = await studio.testSite(id);

      if (result?.ok || result?.success) {
        setSiteStatus((previous) => ({
          ...previous,
          [String(id)]: "Connected",
        }));
        notify(result?.message || "WordPress connection successful.");
      } else {
        setSiteStatus((previous) => ({
          ...previous,
          [String(id)]: "Failed",
        }));
        notify(result?.message || "WordPress connection failed.", true);
      }
    } catch (err: any) {
      setSiteStatus((previous) => ({
        ...previous,
        [String(id)]: "Failed",
      }));
      notify(err?.message || "Website connection test failed.", true);
    }
  }

  async function deleteWebsite(id: number | string) {
    if (!window.confirm("Are you sure you want to remove this website?")) {
      return;
    }

    clearNotifications();

    try {
      await studio.deleteSite(id);
      await loadData(true);
      notify("Website removed.");
    } catch (err: any) {
      notify(err?.message || "Unable to remove website.", true);
    }
  }

  async function generateArticle(event?: React.FormEvent) {
    event?.preventDefault();
    clearNotifications();

    if (!topic.trim()) {
      notify("Please enter an article topic.", true);
      return;
    }

    if (!keyword.trim()) {
      notify("Please enter a primary SEO keyword.", true);
      return;
    }

    const count = Number(wordCount);

    if (!Number.isFinite(count) || count < 300 || count > 10000) {
      notify("Word count must be between 300 and 10,000.", true);
      return;
    }

    setArticleLoading(true);

    try {
      const result = await studio.generate({
        topic: topic.trim(),
        keyword: keyword.trim(),
        wordCount: count,
        tone,
        instructions: instructions.trim(),
        multiAgent,
      });

      if (result?.ok === false) {
        throw new Error(result?.message || "Article generation failed.");
      }

      await loadData(true);
      const savedArticles = await studio.listArticles();
      const generated = Array.isArray(savedArticles) ? savedArticles.filter((item: any) => Number(item.job_id) === Number(result?.jobId)) : [];
      setArticles(Array.isArray(savedArticles) ? savedArticles : []);
      setGeneratedOptions(generated);
      setGeneratedArticle(generated[0] || null);
      if (sites.length && !selectedSiteId) setSelectedSiteId(String(sites[0].id));
      setPage("AI Article Generator");
      notify("Article generation completed successfully. Review your article below.");
    } catch (err: any) {
      notify(err?.message || "Article generation failed.", true);
    } finally {
      setArticleLoading(false);
    }
  }

  async function publishGeneratedArticle() {
    if (!generatedArticle?.id) {
      notify("Generate an article first before sending it to WordPress.", true);
      return;
    }
    if (!selectedSiteId) {
      notify("Please select a WordPress publishing destination.", true);
      return;
    }
    clearNotifications();
    setPublishingArticle(true);
    try {
      const result = await studio.publish({
        articleId: generatedArticle.id,
        siteId: Number(selectedSiteId),
      });
      if (result?.ok === false || result?.success === false) {
        throw new Error(result?.message || "WordPress publishing failed.");
      }
      await loadData(true);
      const refreshed = await studio.listArticles();
      if (Array.isArray(refreshed)) {
        setArticles(refreshed);
        const updated = refreshed.find((item: any) => Number(item.id) === Number(generatedArticle.id));
        if (updated) setGeneratedArticle(updated);
      }
      notify(result?.message || "Article successfully sent to WordPress drafts.");
    } catch (err: any) {
      notify(err?.message || "Unable to send article to WordPress.", true);
    } finally {
      setPublishingArticle(false);
    }
  }

  async function saveArticleEdit() {
    if (!editingArticle) return;

    clearNotifications();

    try {
      await studio.saveEdit(editingArticle);
      if (Number(generatedArticle?.id) === Number(editingArticle.id)) {
        setGeneratedArticle({ ...editingArticle });
        setGeneratedOptions((items) => items.map((item) => Number(item.id) === Number(editingArticle.id) ? { ...editingArticle } : item));
      }
      setEditingArticle(null);
      await loadData(true);
      notify("Article updated successfully.");
    } catch (err: any) {
      notify(err?.message || "Unable to save article.", true);
    }
  }

  async function publishArticle(articleId: number | string) {
    clearNotifications();

    if (!sites.length) {
      notify("Please add a WordPress website first.", true);
      return;
    }

    const options = sites
      .map((site: any) => `${site.id}: ${site.name} (${site.url})`)
      .join("\n");

    const selected = window.prompt(
      `Enter the website ID where you want to save this article as a WordPress draft:\n\n${options}`
    );

    if (!selected) return;

    const site = sites.find(
      (item: any) => String(item.id) === selected.trim()
    );

    if (!site) {
      notify("Invalid website ID.", true);
      return;
    }

    setPublishingArticle(true);

    try {
      const result = await studio.publish({
        articleId,
        siteId: site.id,
      });

      if (result?.ok === false || result?.success === false) {
        throw new Error(result?.message || "WordPress publishing failed.");
      }

      await loadData(true);

      notify(
        result?.message || "Article successfully sent to WordPress drafts."
      );
    } catch (err: any) {
      notify(err?.message || "Unable to send article to WordPress.", true);
    } finally {
      setPublishingArticle(false);
    }
  }

  async function addSchedule(event?: React.FormEvent) {
    event?.preventDefault();
    clearNotifications();

    if (!scheduleTopic.trim() || !scheduleKeyword.trim()) {
      notify("Enter a topic and primary keyword.", true);
      return;
    }

    if (!scheduleDate || !scheduleTime) {
      notify("Select a schedule date and time.", true);
      return;
    }

    setScheduleLoading(true);

    try {
      const scheduledAt = new Date(
        `${scheduleDate}T${scheduleTime}`
      ).toISOString();

      await studio.addSchedule({
        topic: scheduleTopic.trim(),
        keyword: scheduleKeyword.trim(),
        scheduledAt,
        scheduled_at: scheduledAt,
        wordCount: 2000,
      });

      setScheduleTopic("");
      setScheduleKeyword("");
      setScheduleDate("");
      setScheduleTime("");

      await loadData(true);
      notify("Content schedule created.");
    } catch (err: any) {
      notify(err?.message || "Unable to create schedule.", true);
    } finally {
      setScheduleLoading(false);
    }
  }

  async function deleteSchedule(id: number | string) {
    if (!window.confirm("Delete this scheduled task?")) return;

    clearNotifications();

    try {
      await studio.deleteSchedule(id);
      await loadData(true);
      notify("Scheduled task deleted.");
    } catch (err: any) {
      notify(err?.message || "Unable to delete schedule.", true);
    }
  }

  async function refreshAll() {
    setLoading(true);
    clearNotifications();

    try {
      await loadData(true);
      await refreshNetwork();
      notify("Data refreshed.");
    } finally {
      setLoading(false);
    }
  }

  function renderProviderStatus(providerId: string) {
    const status = providerStatus[providerId];

    if (status === "Connected") {
      return <span className="connected">● Connected</span>;
    }

    if (status === "Failed") {
      return <span className="error-text">● Failed</span>;
    }

    if (status === "Testing...") {
      return <span className="muted">Testing...</span>;
    }

    return <span className="muted">Not tested</span>;
  }

  if (licenseChecking) {
    return (
      <main className="license-screen">
        <section className="license-card">
          <h1>MadCraves AI Content Studio</h1>
          <p>Checking your license...</p>
          <div className="loader" />
        </section>
      </main>
    );
  }

  if (!licenseStatus?.activated) {
    return (
      <main className="license-screen">
        <section className="license-card">
          <div className="brand-mark">MC</div>

          <h1>MadCraves AI Content Studio</h1>
          <p>Activate your license to continue.</p>

          <div className="license-machine">
            <label>Machine ID</label>
            <div className="machine-id-row">
              <code>{machineId || "Loading machine ID..."}</code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(machineId);
                  notify("Machine ID copied.");
                }}
              >
                Copy
              </button>
            </div>
          </div>

          <label htmlFor="activation-code">License Activation Code</label>
          <textarea
            id="activation-code"
            value={activationCode}
            onChange={(event) => setActivationCode(event.target.value)}
            placeholder="Paste your activation code here"
            rows={5}
          />

          {error && <div className="alert error-alert">{error}</div>}

          <button
            className="primary-button"
            type="button"
            disabled={licenseLoading}
            onClick={() => void activateLicense()}
          >
            {licenseLoading ? "Activating..." : "ACTIVATE NOW"}
          </button>

          <small>Powered by MadCraves</small>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">MC</div>
          <div>
            <strong>MadCraves</strong>
            <small>AI Content Studio</small>
          </div>
        </div>

        <nav className="navigation">
          <span className="nav-label">WORKSPACE</span>

          {NAVIGATION.map((item) => (
            <button
              type="button"
              key={item}
              className={`nav-item ${page === item ? "active" : ""}`}
              onClick={() => {
                clearNotifications();
                setPage(item);
                setEditingArticle(null);
              }}
            >
              {item === "Dashboard" && "▦"}
              {item === "AI Article Generator" && "✦"}
              {item === "Article Library" && "▤"}
              {item === "Content Scheduler" && "◷"}
              {item === "Websites" && "◎"}
              {item === "AI Providers" && "◇"}
              <span>{item}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="network-indicator">
            <span className={`status-dot ${online ? "online" : "offline"}`} />
            {online ? "Internet connected" : "Offline"}
          </div>
          <small>MadCraves AI Content Studio</small>
          <small>Version 1.0.0</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h2>{page}</h2>
            <p>Manage your AI content workflow</p>
          </div>

          <div className="topbar-actions">
            {updateInfo.status === "downloaded" ? (
              <button type="button" className="primary-button" onClick={() => void studio.installUpdate()}>
                Restart to Update {updateInfo.version ? `(${updateInfo.version})` : ""}
              </button>
            ) : (
              <button type="button" className="secondary-button" disabled={updateInfo.status === "checking" || updateInfo.status === "downloading"} title={updateInfo.message || "Automatically checks for updates"} onClick={() => void studio.checkForUpdates().then(setUpdateInfo).catch((e: any) => notify(e.message, true))}>
                {updateInfo.status === "downloading" ? (updateInfo.message || "Downloading update...") : updateInfo.status === "checking" ? "Checking updates..." : "Check updates"}
              </button>
            )}
            <span className={`connection-label ${online ? "online" : "offline"}`}>
              {online ? "● Online" : "● Offline"}
            </span>

            <button
              type="button"
              className="secondary-button"
              disabled={loading}
              onClick={() => void refreshAll()}
            >
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>
        </header>

        {updateInfo.message && updateInfo.status !== "idle" && updateInfo.status !== "latest" && (
          <div className="alert success-alert"><span>{updateInfo.message}</span></div>
        )}

        {(message || error) && (
          <div className={`alert ${error ? "error-alert" : "success-alert"}`}>
            <span>{error || message}</span>
            <button type="button" onClick={clearNotifications}>
              ×
            </button>
          </div>
        )}

        <div className="page-content">
          {/* DASHBOARD */}
          {page === "Dashboard" && (
            <>
              <section className="welcome-panel">
                <div>
                  <span className="eyebrow">CONTENT WORKSPACE</span>
                  <h1>Welcome to your AI Content Studio</h1>
                  <p>
                    Generate, manage and send SEO content to your WordPress
                    websites.
                  </p>
                </div>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setPage("AI Article Generator")}
                >
                  + Create New Article
                </button>
              </section>

              <div className="stats-grid">
                {[
                  {
                    label: "Connected Websites",
                    value: sites.length,
                    icon: "◎",
                  },
                  {
                    label: "Available AI Providers",
                    value: providers.length,
                    icon: "✦",
                  },
                  {
                    label: "Generated Articles",
                    value: articles.length,
                    icon: "▤",
                  },
                  {
                    label: "Scheduled Tasks",
                    value: schedules.length,
                    icon: "◷",
                  },
                ].map((stat) => (
                  <section className="stat-card" key={stat.label}>
                    <div className="stat-icon">{stat.icon}</div>
                    <div>
                      <span>{stat.label}</span>
                      <strong>{stat.value}</strong>
                    </div>
                  </section>
                ))}
              </div>

              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h3>Recent Articles</h3>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setPage("Article Library")}
                    >
                      View all →
                    </button>
                  </div>

                  {articles.length === 0 ? (
                    <p className="empty-state">{emptyMessage}</p>
                  ) : (
                    <div className="simple-list">
                      {articles.slice(0, 5).map((article: any) => (
                        <div className="list-row" key={article.id}>
                          <div>
                            <strong>{article.title || "Untitled article"}</strong>
                            <small>{formatDate(article.created_at)}</small>
                          </div>
                          <span className="status-badge">
                            {article.status || "Generated"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <h3>Workspace Overview</h3>
                  </div>

                  <div className="overview-item">
                    <span>Internet connection</span>
                    <strong>{online ? "Connected" : "Offline"}</strong>
                  </div>

                  <div className="overview-item">
                    <span>License</span>
                    <strong>Active</strong>
                  </div>

                  <div className="overview-item">
                    <span>AI providers</span>
                    <strong>{providers.length} available</strong>
                  </div>

                  <div className="overview-item">
                    <span>WordPress websites</span>
                    <strong>{sites.length} connected</strong>
                  </div>
                </section>
              </div>
            </>
          )}

          {/* AI ARTICLE GENERATOR */}
          {page === "AI Article Generator" && (
            <section className="generator-workspace">
              <div className="generator-heading">
                <div>
                  <span className="eyebrow-light">CONTENT CREATION WORKSPACE</span>
                  <h1>AI Article Studio</h1>
                  <p>Build your SEO brief, review the generated content and choose where to publish.</p>
                </div>
                <div className="generator-stepper">
                  <span className="step-active"><b>01</b> Article brief</span>
                  <span className={generatedArticle ? "step-active" : ""}><b>02</b> Review article</span>
                  <span><b>03</b> Publishing</span>
                </div>
              </div>

              <div className="generator-columns">
                <section className="brief-card">
                  <div className="generator-card-title">
                    <div className="section-number">01</div>
                    <div><h3>Article Brief</h3><p>Tell the AI what to write.</p></div>
                  </div>
                  <form onSubmit={generateArticle} className="brief-form">
                    <div className="form-group">
                      <label>Article Topic <span>*</span></label>
                      <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="e.g. Complete Guide to Umrah Packages" required />
                    </div>
                    <div className="form-group">
                      <label>Primary SEO Keyword <span>*</span></label>
                      <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Enter your main keyword" required />
                    </div>
                    <div className="brief-two-col">
                      <div className="form-group">
                        <label>Target Word Count</label>
                        <select value={wordCount} onChange={(event) => setWordCount(event.target.value)}>
                          <option value="500">500 words</option><option value="1000">1,000 words</option><option value="1500">1,500 words</option><option value="2000">2,000 words</option><option value="2500">2,500 words</option><option value="3000">3,000 words</option><option value="4000">4,000 words</option><option value="5000">5,000 words</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Writing Tone</label>
                        <select value={tone} onChange={(event) => setTone(event.target.value)}>
                          <option>Professional</option><option>Informative</option><option>Conversational</option><option>Friendly</option><option>Persuasive</option><option>Technical</option><option>Academic</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group brief-instructions">
                      <label>Additional Instructions</label>
                      <textarea rows={5} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Audience, brand details, style preferences, SEO instructions and other requirements..." />
                    </div>
                    <label className="agent-mode-toggle">
                      <input type="checkbox" checked={multiAgent} onChange={(event) => setMultiAgent(event.target.checked)} />
                      <span><strong>Multi-Agent Workflow</strong><small>Research → SEO Strategy → Writing → Editing → Fact-checking</small></span>
                    </label>
                    <div className="brief-submit">
                      <span>AI output is saved to your Article Library automatically.</span>
                      <button type="submit" className="primary-button" disabled={articleLoading}>
                        {articleLoading ? <><span className="button-spinner" /> Generating...</> : "✦ Generate Article"}
                      </button>
                    </div>
                  </form>
                </section>

                <div className="generated-column">
                  <section className="generated-card">
                    <div className="generator-card-title generated-title-row">
                      <div className="section-number">02</div>
                      <div><h3>Generated Article</h3><p>Preview and select an AI result.</p></div>
                      {generatedArticle && <span className="status-badge">Ready to review</span>}
                    </div>
                    {generatedOptions.length > 1 && (
                      <div className="form-group result-selector">
                        <label>AI generated versions</label>
                        <select value={String(generatedArticle?.id || "")} onChange={(event) => setGeneratedArticle(generatedOptions.find((item: any) => String(item.id) === event.target.value) || null)}>
                          {generatedOptions.map((item: any) => <option key={item.id} value={String(item.id)}>{item.provider || "AI"} · {item.title}</option>)}
                        </select>
                      </div>
                    )}
                    {generatedArticle ? (
                      <>
                        <div className="article-preview-meta"><span>{generatedArticle.provider || "AI generated"}</span><span>{generatedArticle.model || "Generated content"}</span><span>{generatedArticle.status || "Generated"}</span></div>
                        <h2 className="generated-article-title">{generatedArticle.title}</h2>
                        <p className="generated-excerpt">{generatedArticle.excerpt || "No excerpt returned by the provider."}</p>
                        <iframe className="article-preview-frame" title="Generated article preview" sandbox="" srcDoc={String(generatedArticle.content || "")} />
                        <div className="generated-actions">
                          <button type="button" className="secondary-button" onClick={() => { setEditingArticle({ ...generatedArticle }); setPage("Article Library"); }}>Edit Article</button>
                          <button type="button" className="text-button" onClick={() => setPage("Article Library")}>Open Article Library →</button>
                        </div>
                      </>
                    ) : (
                      <div className="generated-empty">
                        <div className="empty-preview-icon">✦</div>
                        <h3>Your article preview will appear here</h3>
                        <p>Complete the brief and select Generate Article. Your saved article will appear in this panel for review.</p>
                      </div>
                    )}
                  </section>

                  <section className="blog-image-card">
                    <div className="generator-card-title">
                      <div className="section-number image-number">03</div>
                      <div><h3>Blog Image</h3><p>Featured image for your article.</p></div>
                      <span className="coming-soon-label">Not connected</span>
                    </div>
                    <div className="image-placeholder">
                      <div className="image-placeholder-art"><span>✧</span><i /><b /></div>
                      <div><strong>Featured image workspace</strong><small>Image generation is not connected in this build yet.</small></div>
                    </div>
                  </section>
                </div>
              </div>

              <section className="publishing-card">
                <div className="publishing-copy">
                  <div className="section-number publish-number">04</div>
                  <div><h3>Publishing Destination</h3><p>Choose a connected WordPress website. Your article will be saved as a draft.</p></div>
                </div>
                <div className="publishing-controls">
                  <select aria-label="Publishing destination" value={selectedSiteId} onChange={(event) => setSelectedSiteId(event.target.value)} disabled={!sites.length}>
                    <option value="">{sites.length ? "Select a website" : "No website connected — add one in Websites"}</option>
                    {sites.map((site: any) => <option key={site.id} value={String(site.id)}>{site.name} · {site.url}</option>)}
                  </select>
                  <button type="button" className="primary-button" disabled={!generatedArticle?.id || !selectedSiteId || publishingArticle} onClick={() => void publishGeneratedArticle()}>
                    {publishingArticle ? "Sending draft..." : "Send to WordPress Draft"}
                  </button>
                </div>
              </section>
            </section>
          )}

          {/* ARTICLE LIBRARY */}
          {page === "Article Library" && (
            <>
              <div className="section-toolbar">
                <div>
                  <h3>Your Articles</h3>
                  <p>Review, edit and send articles to WordPress drafts.</p>
                </div>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setPage("AI Article Generator")}
                >
                  + New Article
                </button>
              </div>

              {editingArticle ? (
                <section className="panel">
                  <div className="panel-heading">
                    <h3>Edit Article</h3>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setEditingArticle(null)}
                    >
                      Close
                    </button>
                  </div>

                  <div className="form-group">
                    <label>Article Title</label>
                    <input
                      value={editingArticle.title || ""}
                      onChange={(event) =>
                        setEditingArticle({
                          ...editingArticle,
                          title: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Article Content (HTML)</label>
                    <textarea
                      className="article-editor"
                      rows={22}
                      value={editingArticle.content || ""}
                      onChange={(event) =>
                        setEditingArticle({
                          ...editingArticle,
                          content: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Excerpt</label>
                    <textarea
                      rows={4}
                      value={editingArticle.excerpt || ""}
                      onChange={(event) =>
                        setEditingArticle({
                          ...editingArticle,
                          excerpt: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="button-row">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void saveArticleEdit()}
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setEditingArticle(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </section>
              ) : articles.length === 0 ? (
                <section className="panel empty-panel">
                  <div className="empty-icon">▤</div>
                  <h3>No articles yet</h3>
                  <p>Generate your first AI article to see it here.</p>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setPage("AI Article Generator")}
                  >
                    Create First Article
                  </button>
                </section>
              ) : (
                <div className="article-grid">
                  {articles.map((article: any) => (
                    <section className="panel article-card" key={article.id}>
                      <div className="panel-heading">
                        <span className="status-badge">
                          {article.status || "Generated"}
                        </span>
                        <small>{formatDate(article.created_at)}</small>
                      </div>

                      <h3>{article.title || "Untitled article"}</h3>

                      <p className="article-excerpt">
                        {article.excerpt ||
                          String(article.content || "")
                            .replace(/<[^>]*>/g, " ")
                            .slice(0, 180)}
                      </p>

                      <div className="article-meta">
                        <span>{article.word_count || "—"} words</span>
                        <span>{article.provider || "AI generated"}</span>
                      </div>

                      <div className="button-row">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setEditingArticle({ ...article })}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="primary-button"
                          disabled={publishingArticle || sites.length === 0}
                          onClick={() => void publishArticle(article.id)}
                        >
                          Send to WordPress
                        </button>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}

          {/* CONTENT SCHEDULER */}
          {page === "Content Scheduler" && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Create Content Schedule</h3>
                    <p>Set a date and time for automatic article generation.</p>
                  </div>
                </div>

                <form onSubmit={addSchedule}>
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>Article Topic *</label>
                      <input
                        value={scheduleTopic}
                        onChange={(event) =>
                          setScheduleTopic(event.target.value)
                        }
                        placeholder="Enter article topic"
                        required
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>Primary Keyword *</label>
                      <input
                        value={scheduleKeyword}
                        onChange={(event) =>
                          setScheduleKeyword(event.target.value)
                        }
                        placeholder="Enter primary keyword"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Schedule Date</label>
                      <input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        value={scheduleDate}
                        onChange={(event) =>
                          setScheduleDate(event.target.value)
                        }
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Schedule Time</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(event) =>
                          setScheduleTime(event.target.value)
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="form-footer">
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={scheduleLoading}
                    >
                      {scheduleLoading ? "Creating..." : "Create Schedule"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <h3>Scheduled Tasks</h3>
                  <span className="status-badge">
                    {schedules.length} tasks
                  </span>
                </div>

                {schedules.length === 0 ? (
                  <p className="empty-state">{emptyMessage}</p>
                ) : (
                  <div className="simple-list">
                    {schedules.map((item: any) => (
                      <div className="list-row" key={item.id}>
                        <div>
                          <strong>{item.topic || "Scheduled article"}</strong>
                          <small>
                            {item.keyword || "No keyword"} ·{" "}
                            {formatDate(
                              item.scheduled_at || item.scheduledAt
                            )}
                          </small>
                        </div>

                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => void deleteSchedule(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {/* WEBSITES */}
          {page === "Websites" && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Connect WordPress Website</h3>
                    <p>
                      Use a WordPress Application Password, not your normal
                      account password.
                    </p>
                  </div>
                </div>

                <form onSubmit={addWebsite}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Website Name *</label>
                      <input
                        value={siteName}
                        onChange={(event) => setSiteName(event.target.value)}
                        placeholder="My Website"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Website URL *</label>
                      <input
                        type="url"
                        value={siteUrl}
                        onChange={(event) => setSiteUrl(event.target.value)}
                        placeholder="https://example.com"
                        required
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>WordPress Username:Application Password *</label>
                      <input
                        type="password"
                        value={siteToken}
                        onChange={(event) => setSiteToken(event.target.value)}
                        placeholder="username:xxxx xxxx xxxx xxxx xxxx xxxx"
                        required
                      />
                      <small className="muted">
                        Generate this from WordPress Users → Profile →
                        Application Passwords.
                      </small>
                    </div>
                  </div>

                  <div className="form-footer">
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={siteLoading}
                    >
                      {siteLoading ? "Connecting..." : "+ Add Website"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <h3>Connected Websites</h3>
                  <span className="status-badge">{sites.length} websites</span>
                </div>

                {sites.length === 0 ? (
                  <p className="empty-state">
                    No WordPress websites connected yet.
                  </p>
                ) : (
                  <div className="website-grid">
                    {sites.map((site: any) => (
                      <div className="website-card" key={site.id}>
                        <div className="website-icon">W</div>

                        <div className="website-info">
                          <strong>{site.name}</strong>
                          <small>{site.url}</small>
                          <small>
                            Connection:{" "}
                            {siteStatus[String(site.id)] || "Not tested"}
                          </small>
                        </div>

                        <div className="button-row">
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => void testWebsite(site.id)}
                          >
                            Test
                          </button>

                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => void deleteWebsite(site.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {/* AI PROVIDERS */}
          {page === "AI Providers" && (
            <>
              <section className="panel"><div className="panel-heading"><div><h3>Available AI Providers</h3><p>Built-in providers and your manually configured APIs.</p></div><span className="connected">{providers.length} providers available</span></div></section>

              <div className="provider-grid">
                {providers.map((provider: any) => (
                  <section
                    className="panel provider-card"
                    key={provider.id}
                  >
                    <div className="panel-heading">
                      <div>
                        <h3>{provider.name}</h3>
                        <small>{provider.description || (provider.builtIn ? "Built-in AI service" : "Custom OpenAI-compatible API")}</small>
                      </div>

                      {renderProviderStatus(provider.id)}
                    </div>

                    <div className="provider-logo">
                      {provider.id === "gemini" ? "G" : provider.id === "groq" ? "GQ" : provider.id === "openrouter" ? "OR" : "API"}
                    </div>

                    <div className="form-group">
                      <label>Model ID</label>
                      <input
                        value={providerModelInputs[provider.id] ?? provider.model}
                        onChange={(event) => setProviderModelInputs((current) => ({ ...current, [provider.id]: event.target.value }))}
                        placeholder="Enter model ID"
                      />
                    </div>

                    {provider.builtIn && (
                      <div className="form-group provider-key-field">
                        <label>API Key</label>
                        <input
                          type="password"
                          value={providerKeyInputs[provider.id] || ""}
                          onChange={(event) => setProviderKeyInputs((current) => ({ ...current, [provider.id]: event.target.value }))}
                          placeholder={provider.configured ? "Saved securely — enter to replace" : "Paste your API key"}
                          autoComplete="new-password"
                        />
                        <small>{provider.configured ? "An API key is saved. Leave blank to keep it unchanged." : "API key required to activate this provider."}</small>
                      </div>
                    )}

                    <p className="provider-saved">
                      <span className={`status-dot ${provider.configured ? "online" : "offline"}`} />
                      {provider.configured ? "API key saved securely" : "API key not configured"}
                    </p>

                    {provider.builtIn && (
                      <button
                        type="button"
                        className="primary-button"
                        disabled={providerSaving === provider.id}
                        onClick={() => void saveBuiltinProvider(provider)}
                      >
                        {providerSaving === provider.id ? "Saving..." : "Save Provider"}
                      </button>
                    )}

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={providerLoading === provider.id}
                      onClick={() => void testProvider(provider.id)}
                    >
                      {providerLoading === provider.id
                        ? "Testing Connection..."
                        : "Test Connection"}
                    </button>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>

        <footer className="app-footer">
          <span>© MadCraves</span>
          <span>AI Content Studio · Version {updateInfo.version || "Current"}</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
