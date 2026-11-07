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

function formatLicenseCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function App() {
  const [page, setPage] = useState<Page>("Dashboard");
  const [licenseClock, setLicenseClock] = useState(Date.now());

  const [licenseChecking, setLicenseChecking] = useState(true);
  const [licenseStatus, setLicenseStatus] = useState<any>(null);
  const [machineId, setMachineId] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [licenseLoading, setLicenseLoading] = useState(false);
  const licenseRemainingMs = licenseStatus?.expiresAt ? Math.max(0, Date.parse(licenseStatus.expiresAt) - licenseClock) : null;

  const [sites, setSites] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [imageProviders, setImageProviders] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [deletingArticleId, setDeletingArticleId] = useState<number | null>(null);
  const [selectedArticleProvider, setSelectedArticleProvider] = useState("all");
  const [imageApiKeyInputs, setImageApiKeyInputs] = useState<Record<string, string>>({});
  const [imageProviderSaving, setImageProviderSaving] = useState<string | null>(null);
  const [selectedImageProvider, setSelectedImageProvider] = useState("image-openai");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState("");
  const [imageSectionFocus, setImageSectionFocus] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
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
  const [multiAgent, setMultiAgent] = useState(false);

  const [siteName, setSiteName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [siteUsername, setSiteUsername] = useState("");
  const [siteApplicationPassword, setSiteApplicationPassword] = useState("");
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
  const [aiEditingArticle, setAiEditingArticle] = useState<any>(null);
  const [aiEditInstructions, setAiEditInstructions] = useState("");
  const [aiEditProviderId, setAiEditProviderId] = useState("");
  const [aiEditLoading, setAiEditLoading] = useState(false);

  const [scheduleTopic, setScheduleTopic] = useState("");
  const [scheduleKeyword, setScheduleKeyword] = useState("");
  const [scheduleArticleId, setScheduleArticleId] = useState("");
  const [scheduleSiteId, setScheduleSiteId] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [publishingArticle, setPublishingArticle] = useState(false);
  const [publishingTargetArticle, setPublishingTargetArticle] = useState<any>(null);
  const [publishingSiteId, setPublishingSiteId] = useState("");

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
        imageProviderData,
        articleData,
        scheduleData,
      ] = await Promise.all([
        studio.dashboard(),
        studio.listSites(),
        studio.listProviders(),
        studio.listImageProviders(),
        studio.listArticles(),
        studio.listSchedules(),
      ]);

      setStats(dashboardData || {});
      setSites(Array.isArray(siteData) ? siteData : []);
      setProviders(Array.isArray(providerData) ? providerData : []);
      setImageProviders(Array.isArray(imageProviderData) ? imageProviderData : []);
      if (Array.isArray(providerData) && providerData.length && !providerData.some((item: any) => item.id === selectedArticleProvider)) {
        setSelectedArticleProvider(providerData.find((item: any) => item.configured)?.id || providerData[0].id);
      }
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
    if (page === "Article Library" && imageSectionFocus) {
      window.requestAnimationFrame(() => document.getElementById("image-generation-section")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      setImageSectionFocus(false);
    }
  }, [page, imageSectionFocus]);

  useEffect(() => {
    const timer = window.setInterval(() => setLicenseClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
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

    if (!siteName.trim() || !siteUrl.trim() || !siteUsername.trim() || !siteApplicationPassword.trim()) {
      notify("Please complete all website fields.", true);
      return;
    }

    setSiteLoading(true);

    try {
      await studio.addSite({
        name: siteName.trim(),
        url: siteUrl.trim(),
        token: `${siteUsername.trim()}:${siteApplicationPassword.trim().replace(/\\s+/g, "")}`,
      });

      setSiteName("");
      setSiteUrl("");
      setSiteUsername("");
      setSiteApplicationPassword("");

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

  async function deleteArticle(article: any) {
    if (!article?.id) return;
    const title = article.title || "this article";
    if (!window.confirm(`Delete "${title}" permanently? This will also remove its saved featured image. This action cannot be undone.`)) return;

    clearNotifications();
    setDeletingArticleId(Number(article.id));
    try {
      await studio.deleteArticle(Number(article.id));
      setArticles((current) => current.filter((item: any) => Number(item.id) !== Number(article.id)));
      if (Number(editingArticle?.id) === Number(article.id)) setEditingArticle(null);
      if (Number(previewArticle?.id) === Number(article.id)) { setPreviewArticle(null); setPreviewImage(""); }
      if (Number(generatedArticle?.id) === Number(article.id)) {
        setGeneratedArticle(null);
        setGeneratedImage("");
        setImagePrompt("");
      }
      await loadData(true);
      notify("Article deleted successfully.");
    } catch (err: any) {
      notify(err?.message || "Unable to delete article.", true);
    } finally {
      setDeletingArticleId(null);
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
        providerId: selectedArticleProvider,
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

  async function saveImageProvider(provider: any) {
    clearNotifications();
    const apiKey = imageApiKeyInputs[provider.id]?.trim();
    if (!apiKey) {
      notify(`Enter your ${provider.name} API key first.`, true);
      return;
    }
    setImageProviderSaving(provider.id);
    try {
      await studio.saveImageProvider({ providerId: provider.id, apiKey });
      setImageApiKeyInputs((current) => ({ ...current, [provider.id]: "" }));
      const refreshed = await studio.listImageProviders();
      setImageProviders(Array.isArray(refreshed) ? refreshed : []);
      notify(`${provider.name} API key saved securely.`);
    } catch (err: any) {
      notify(err?.message || `Unable to save ${provider.name} API key.`, true);
    } finally {
      setImageProviderSaving(null);
    }
  }

  async function startImageForArticle(article: any) {
    if (!article?.id) return;
    const articlePrompt = `Create a professional, original, high-quality editorial featured image for this blog article: ${article.title || "Blog article"}. Visual context: ${String(article.content || "").replace(/<[^>]*>/g, " ").slice(0, 1200)}. No text, no watermark, wide landscape composition.`;
    setGeneratedArticle(article);
    setImagePrompt(articlePrompt);
    setGeneratedImage("");
    setPage("Article Library");
    setImageSectionFocus(true);
    await generateFeaturedImage(article, articlePrompt);
  }

  async function generateFeaturedImage(articleOverride?: any, promptOverride?: string) {
    const article = articleOverride || generatedArticle;
    if (!article?.id) {
      notify("Select an article first, then create its featured image.", true);
      return;
    }
    clearNotifications();
    setImageLoading(true);
    try {
      const result = await studio.generateImage({
        articleId: Number(article.id),
        providerId: selectedImageProvider,
        prompt: (promptOverride || imagePrompt).trim() || article.title,
      });
      if (!result?.ok || !result?.imageDataUrl) throw new Error(result?.message || "Image generation failed.");
      setGeneratedImage(result.imageDataUrl);
      await loadData(true);
      notify("Featured image generated and saved with your article.");
    } catch (err: any) {
      notify(err?.message || "Image generation failed.", true);
    } finally {
      setImageLoading(false);
    }
  }

  async function openArticlePreview(article: any) {
    setPreviewArticle(article);
    setPreviewImage("");
    setPreviewLoading(true);
    try {
      const image = await studio.getArticleImage(Number(article.id));
      setPreviewImage(typeof image === "string" ? image : "");
    } catch {
      setPreviewImage("");
    } finally {
      setPreviewLoading(false);
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

  function startAiEditingArticle(article: any) {
    const available = providers.filter((item: any) => item.configured && item.enabled !== false);
    setAiEditingArticle(article);
    setAiEditInstructions("");
    setAiEditProviderId(String(available[0]?.id || ""));
  }

  async function applyAiArticleEdit() {
    if (!aiEditingArticle?.id) return;
    if (!aiEditInstructions.trim()) {
      notify("Enter the changes you want the AI to make.", true);
      return;
    }
    if (!aiEditProviderId) {
      notify("Configure and enable an AI provider before revising articles.", true);
      return;
    }
    clearNotifications();
    setAiEditLoading(true);
    try {
      const result = await studio.aiEditArticle({
        articleId: Number(aiEditingArticle.id),
        instructions: aiEditInstructions.trim(),
        providerId: aiEditProviderId,
      });
      if (!result?.ok) throw new Error(result?.message || "AI article revision failed.");
      const refreshed = await studio.listArticles();
      const refreshedArticles = Array.isArray(refreshed) ? refreshed : [];
      setArticles(refreshedArticles);
      const revised = refreshedArticles.find((item: any) => Number(item.id) === Number(aiEditingArticle.id)) || result.article;
      if (Number(generatedArticle?.id) === Number(revised.id)) {
        setGeneratedArticle(revised);
        setGeneratedOptions((items) => items.map((item) => Number(item.id) === Number(revised.id) ? revised : item));
      }
      if (Number(previewArticle?.id) === Number(revised.id)) setPreviewArticle(revised);
      setAiEditingArticle(null);
      setAiEditInstructions("");
      notify("AI revision completed. The existing Article Library entry has been updated.");
    } catch (err: any) {
      notify(err?.message || "Unable to revise this article.", true);
    } finally {
      setAiEditLoading(false);
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

  async function publishArticle(article: any) {
    clearNotifications();
    if (!sites.length) {
      notify("Please add a WordPress website first.", true);
      return;
    }
    setPublishingTargetArticle(article);
    setPublishingSiteId(sites.length === 1 ? String(sites[0].id) : "");
  }

  async function confirmPublishArticle() {
    if (!publishingTargetArticle?.id) return;
    const site = sites.find((item: any) => String(item.id) === publishingSiteId);
    if (!site) {
      notify("Please select a connected WordPress website.", true);
      return;
    }
    clearNotifications();
    setPublishingArticle(true);
    try {
      const result = await studio.publish({ articleId: Number(publishingTargetArticle.id), siteId: Number(site.id) });
      if (result?.ok === false || result?.success === false) throw new Error(result?.message || "WordPress publishing failed.");
      await loadData(true);
      setPublishingTargetArticle(null);
      setPublishingSiteId("");
      notify(result?.message || `Article successfully sent to WordPress draft on ${site.name}.`);
    } catch (err: any) {
      notify(err?.message || "Unable to send article to WordPress.", true);
    } finally {
      setPublishingArticle(false);
    }
  }

  async function addSchedule(event?: React.FormEvent) {
    event?.preventDefault();
    clearNotifications();

    const selectedArticle = articles.find((item: any) => String(item.id) === scheduleArticleId);
    const selectedSite = sites.find((item: any) => String(item.id) === scheduleSiteId);
    if (!selectedArticle) { notify("Please select an article from your Article Library.", true); return; }
    if (!selectedSite) { notify("Please select a connected WordPress website.", true); return; }
    if (!scheduleDate || !scheduleTime) { notify("Select a schedule date and time.", true); return; }

    const localRunAt = `${scheduleDate} ${scheduleTime}:00`;
    const selectedDate = new Date(`${scheduleDate}T${scheduleTime}:00`);
    if (Number.isNaN(selectedDate.getTime()) || selectedDate.getTime() <= Date.now()) {
      notify("Please select a future date and time.", true); return;
    }

    setScheduleLoading(true);
    try {
      await studio.addSchedule({
        articleId: Number(selectedArticle.id),
        article_id: Number(selectedArticle.id),
        siteId: Number(selectedSite.id),
        site_id: Number(selectedSite.id),
        title: selectedArticle.title || "Scheduled article",
        topic: selectedArticle.title || "Scheduled article",
        run_at: localRunAt,
        runAt: localRunAt,
        scheduledAt: localRunAt,
        scheduled_at: localRunAt,
      });
      setScheduleArticleId("");
      setScheduleSiteId("");
      setScheduleDate("");
      setScheduleTime("");
      await loadData(true);
      notify("Article publishing schedule created successfully.");
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
                Restart to Install
              </button>
            ) : (
              <button type="button" className="secondary-button" disabled={updateInfo.status === "checking" || updateInfo.status === "downloading"} title={updateInfo.message || "Automatically checks for updates"} onClick={() => void studio.checkForUpdates().then(setUpdateInfo).catch((e: any) => notify(e.message, true))}>
                {updateInfo.status === "downloading" ? "Downloading update…" : updateInfo.status === "checking" ? "Checking updates..." : "Check for Updates"}
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

        <section className="license-summary-panel" aria-label="License details">
          <div className="license-summary-heading">
            <span className="license-summary-icon">✓</span>
            <div><strong>License Details</strong><small>{licenseStatus?.licensee || "Activated user"} · {licenseStatus?.isLifetime ? "Lifetime license" : "Time-limited license"}</small></div>
          </div>
          <div className="license-summary-item"><span>Issued</span><strong>{formatDate(licenseStatus?.issuedAt)}</strong></div>
          <div className="license-summary-item"><span>Expires</span><strong>{licenseStatus?.isLifetime ? "Never (Lifetime)" : formatDate(licenseStatus?.expiresAt)}</strong></div>
          <div className="license-summary-item license-countdown"><span>Time remaining</span><strong>{licenseStatus?.isLifetime ? "Unlimited" : formatLicenseCountdown(licenseRemainingMs || 0)}</strong></div>
        </section>

        {updateInfo.status === "downloading" && (
          <section className="update-progress-panel" aria-live="polite">
            <div className="update-progress-heading">
              <div>
                <strong>Software update downloading</strong>
                <span>{updateInfo.message || "Downloading the latest version in the background…"}</span>
              </div>
              <b>{Math.round(Math.max(0, Math.min(100, Number(updateInfo.percent) || 0)))}%</b>
            </div>
            <div
              className="update-progress-track"
              role="progressbar"
              aria-label="Software update download progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.max(0, Math.min(100, Number(updateInfo.percent) || 0)))}
            >
              <div className="update-progress-fill" style={{ width: `${Math.max(0, Math.min(100, Number(updateInfo.percent) || 0))}%` }} />
            </div>
            <small>Please keep the app open. You can continue working while the update downloads.</small>
          </section>
        )}

        {updateInfo.status === "downloaded" && (
          <section className="update-ready-panel" aria-live="polite">
            <div>
              <strong>Update ready to install</strong>
              <span>Version {updateInfo.version || "latest"} has downloaded successfully.</span>
            </div>
            <button type="button" className="primary-button" onClick={() => void studio.installUpdate()}>
              Restart to Install
            </button>
          </section>
        )}

        {updateInfo.status === "error" && updateInfo.message && (
          <div className="alert error-alert"><span>Update check failed: {updateInfo.message}</span></div>
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
                    <span>AI providers active</span>
                    <strong>{providers.filter((item: any) => item.enabled && item.configured).length} active</strong>
                  </div>
                  <div className="overview-item">
                    <span>AI providers connected</span>
                    <strong>{providers.filter((item: any) => item.enabled && item.configured && providerStatus[item.id] === "Connected").length} connected</strong>
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
            <section className="generator-workspace professional-generator">
              <div className="generator-heading">
                <div>
                  <span className="eyebrow-light">MADCRAVES CONTENT WORKSPACE</span>
                  <h1>AI Article Generator</h1>
                  <p>Create a complete SEO-focused article brief and generate content with your preferred AI providers.</p>
                </div>
                <div className="generator-stepper"><span className="step-active"><b>01</b> Brief</span><span><b>02</b> Library</span><span><b>03</b> Image Studio</span></div>
              </div>

              <section className="brief-card professional-brief-card">
                <div className="generator-card-title">
                  <div className="section-number">01</div>
                  <div><h3>Article Brief</h3><p>Set the topic, SEO target and writing requirements.</p></div>
                </div>
                <form onSubmit={generateArticle} className="brief-form professional-brief-form">
                  <div className="brief-two-col">
                    <div className="form-group">
                      <label>Article Topic <span>*</span></label>
                      <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="e.g. Complete Guide to Umrah Packages" required />
                    </div>
                    <div className="form-group">
                      <label>Primary SEO Keyword <span>*</span></label>
                      <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Enter your main keyword" required />
                    </div>
                  </div>
                  <div className="brief-three-col">
                    <div className="form-group">
                      <label>Target Word Count</label>
                      <select value={wordCount} onChange={(event) => setWordCount(event.target.value)}>
                        <option value="500">500 words</option><option value="1000">1,000 words</option><option value="1500">1,500 words</option><option value="2000">2,000 words</option><option value="2500">2,500 words</option><option value="3000">3,000 words</option><option value="4000">4,000 words</option><option value="5000">5,000 words</option><option value="7500">7,500 words</option><option value="10000">10,000 words</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Writing Tone</label>
                      <select value={tone} onChange={(event) => setTone(event.target.value)}>
                        <option>Professional</option><option>Informative</option><option>Conversational</option><option>Friendly</option><option>Persuasive</option><option>Technical</option><option>Academic</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>AI Provider</label>
                      <select value={selectedArticleProvider} onChange={(event) => setSelectedArticleProvider(event.target.value)}>
                        <option value="all">All Available Providers</option>
                        {providers.filter((provider: any) => !String(provider.id).startsWith("image-")).map((provider: any) => (
                          <option key={provider.id} value={provider.id} disabled={!provider.configured || provider.enabled === false}>
                            {provider.name}{provider.configured ? "" : " — API key not saved"}
                          </option>
                        ))}
                      </select>
                      <small>{selectedArticleProvider === "all" ? "Uses every enabled provider with a saved API key." : "Only the selected provider will generate this article."}</small>
                    </div>
                  </div>
                  <div className="form-group brief-instructions professional-instructions">
                    <label>Custom Instructions <span className="optional-label">OPTIONAL</span></label>
                    <textarea rows={6} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Add your brand voice, target audience, competitor context, required headings, internal-link guidance, SEO requirements or anything else the AI should follow..." />
                  </div>
                  <div className="brief-footer">
                    <label className="agent-mode-toggle">
                      <input type="checkbox" checked={multiAgent} onChange={(event) => setMultiAgent(event.target.checked)} />
                      <span><strong>Advanced Multi-Agent Workflow</strong><small>Research · SEO strategy · Writing · Editing · Fact-checking</small></span>
                    </label>
                    <button type="submit" className="primary-button generate-article-cta" disabled={articleLoading}>
                      {articleLoading ? <><span className="button-spinner" /> Generating Article...</> : "✦ Generate Article"}
                    </button>
                  </div>
                </form>
              </section>

              {generatedArticle && (
                <section className="panel generation-success-panel">
                  <div><span className="connected">Article generated and saved</span><h3>{generatedArticle.title || "Your article is ready"}</h3><p>Your content is available in Article Library. You can review, edit, publish or create a featured image from there.</p></div>
                  <button type="button" className="primary-button" onClick={() => setPage("Article Library")}>Open Article Library →</button>
                </section>
              )}
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

              {aiEditingArticle && (
                <section className="panel ai-article-edit-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow-light">AI-POWERED CONTENT REVISION</span>
                      <h3>AI Edit: {aiEditingArticle.title || "Selected Article"}</h3>
                      <p>Describe exactly what you want changed. The AI will revise the existing article and update this same library entry.</p>
                    </div>
                    <button type="button" className="secondary-button" disabled={aiEditLoading} onClick={() => { setAiEditingArticle(null); setAiEditInstructions(""); }}>Close</button>
                  </div>
                  <div className="form-group">
                    <label>Custom Editing Instructions</label>
                    <textarea rows={7} value={aiEditInstructions} onChange={(event) => setAiEditInstructions(event.target.value)} placeholder="Example: Rewrite the introduction to make it more engaging, expand the section about benefits with practical details, improve natural keyword placement, remove repetitive sentences, and keep the tone professional and human." />
                    <small>Be specific about the sections, tone, SEO improvements, length or wording you want changed. The full revised article will be returned.</small>
                  </div>
                  <div className="form-grid ai-edit-options">
                    <div className="form-group">
                      <label>AI Provider</label>
                      <select value={aiEditProviderId} onChange={(event) => setAiEditProviderId(event.target.value)}>
                        <option value="">Choose a configured provider</option>
                        {providers.filter((item: any) => item.configured && item.enabled !== false).map((item: any) => <option key={item.id} value={String(item.id)}>{item.name} · {item.model}</option>)}
                      </select>
                    </div>
                    <div className="ai-edit-note"><strong>Existing article stays in place</strong><span>Its saved title, content, excerpt and SEO fields will be updated. No duplicate article is created.</span></div>
                  </div>
                  <div className="button-row ai-edit-actions">
                    <button type="button" className="primary-button" disabled={aiEditLoading || !aiEditInstructions.trim() || !aiEditProviderId} onClick={() => void applyAiArticleEdit()}>
                      {aiEditLoading ? <><span className="button-spinner" /> Revising Article...</> : "✦ Apply AI Changes"}
                    </button>
                    <button type="button" className="secondary-button" disabled={aiEditLoading} onClick={() => { setAiEditingArticle(null); setAiEditInstructions(""); }}>Cancel</button>
                  </div>
                </section>
              )}

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
                          onClick={() => void openArticlePreview(article)}
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setEditingArticle({ ...article })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={aiEditLoading}
                          onClick={() => startAiEditingArticle(article)}
                        >
                          AI Edit
                        </button>
                        <button type="button" className="secondary-button" disabled={imageLoading} onClick={() => void startImageForArticle(article)}>
                          {imageLoading && Number(generatedArticle?.id) === Number(article.id) ? "Generating image..." : "Generate Blog Image"}
                        </button>

                        <button
                          type="button"
                          className="primary-button"
                          disabled={publishingArticle || sites.length === 0}
                          onClick={() => void publishArticle(article)}
                        >
                          Send to WordPress
                        </button>
                        <button
                          type="button"
                          className="danger-button"
                          disabled={deletingArticleId === Number(article.id)}
                          onClick={() => void deleteArticle(article)}
                        >
                          {deletingArticleId === Number(article.id) ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </section>
                  ))}
                </div>
              )}
              <section className="panel image-studio-section" id="image-generation-section">
                <div className="panel-heading">
                  <div><span className="eyebrow-light">VISUAL CONTENT WORKSPACE</span><h3>Image Generation Studio</h3><p>Create a blog-specific featured image using OpenAI Images or Google Imagen.</p></div>
                  <span className={imageProviders.some((item: any) => item.id === selectedImageProvider && item.configured) ? "connected" : "coming-soon-label"}>{imageProviders.some((item: any) => item.id === selectedImageProvider && item.configured) ? "API ready" : "API setup needed"}</span>
                </div>
                <div className="image-studio-layout">
                  <div className="image-studio-controls">
                    <div className="form-group">
                      <label>Select Blog Article</label>
                      <select value={String(generatedArticle?.id || "")} onChange={(event) => {
                        const chosen = articles.find((item: any) => String(item.id) === event.target.value) || null;
                        setGeneratedArticle(chosen);
                        setImagePrompt(chosen ? `Create a professional, original, high-quality editorial featured image for this blog article: ${chosen.title}. Visual context: ${String(chosen.content || "").replace(/<[^>]*>/g, " ").slice(0, 1200)}. No text, no watermark, wide landscape composition.` : "");
                        setGeneratedImage("");
                      }}>
                        <option value="">Choose an article</option>
                        {articles.map((item: any) => <option key={item.id} value={String(item.id)}>{item.title || "Untitled article"}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Image Provider</label>
                      <select value={selectedImageProvider} onChange={(event) => setSelectedImageProvider(event.target.value)}>
                        {imageProviders.map((provider: any) => <option key={provider.id} value={provider.id}>{provider.name}{provider.configured ? "" : " — configure API key"}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Image Prompt / Art Direction</label>
                      <textarea rows={7} value={imagePrompt} onChange={(event) => setImagePrompt(event.target.value)} placeholder="Select an article to automatically create a relevant image prompt, or write your own art direction..." />
                      <small>When launched from an article card, the prompt is prepared automatically using its title and content.</small>
                    </div>
                    <button type="button" className="primary-button" disabled={!generatedArticle?.id || imageLoading || !imageProviders.some((item: any) => item.id === selectedImageProvider && item.configured)} onClick={() => void generateFeaturedImage()}>
                      {imageLoading ? <><span className="button-spinner" /> Generating Image...</> : "✦ Generate Featured Image"}
                    </button>
                  </div>
                  <div className="image-studio-preview">
                    {generatedImage ? <img className="generated-featured-image" src={generatedImage} alt="Generated featured image" /> : <div className="image-placeholder"><div className="image-placeholder-art"><span>✧</span><i /><b /></div><div><strong>Your featured image will appear here</strong><small>Select a blog and generate a new image. It will be saved with that article.</small></div></div>}
                  </div>
                </div>
                <div className="image-api-shortcut"><span>Need to configure image APIs?</span><button type="button" className="text-button" onClick={() => setPage("AI Providers")}>Open AI Providers →</button></div>
              </section>
            </>
          )}

          {/* CONTENT SCHEDULER */}
          {page === "Content Scheduler" && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Schedule Article Publishing</h3>
                    <p>Choose an existing article, its WordPress destination, and when it should be sent as a WordPress draft.</p>
                  </div>
                </div>

                <form onSubmit={addSchedule}>
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>Select Generated Article *</label>
                      <select value={scheduleArticleId} onChange={(event) => setScheduleArticleId(event.target.value)} required>
                        <option value="">Choose an article from Article Library</option>
                        {articles.map((article: any) => <option key={article.id} value={String(article.id)}>{article.title || "Untitled article"}</option>)}
                      </select>
                      {articles.length === 0 && <small className="muted">No generated articles found. Generate an article first.</small>}
                    </div>

                    <div className="form-group full-width">
                      <label>Publishing Website *</label>
                      <select value={scheduleSiteId} onChange={(event) => setScheduleSiteId(event.target.value)} required>
                        <option value="">Choose a connected WordPress website</option>
                        {sites.map((site: any) => <option key={site.id} value={String(site.id)}>{site.name} — {site.url}</option>)}
                      </select>
                      {sites.length === 0 && <small className="muted">No website connected. Add one in Websites first.</small>}
                    </div>

                    <div className="form-group">
                      <label>Schedule Date *</label>
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
                          <strong>{item.title || item.topic || "Scheduled article"}</strong>
                          <small>
                            {item.article_title || "Selected article"} · {item.site_name || "Selected website"} ·{" "}
                            {formatDate(item.run_at || item.scheduled_at || item.scheduledAt)}
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

                    <div className="form-group">
                      <label>WordPress Username *</label>
                      <input
                        type="text"
                        value={siteUsername}
                        onChange={(event) => setSiteUsername(event.target.value)}
                        placeholder="Your WordPress username"
                        autoComplete="username"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Application Password *</label>
                      <input
                        type="password"
                        value={siteApplicationPassword}
                        onChange={(event) => setSiteApplicationPassword(event.target.value)}
                        placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                        autoComplete="new-password"
                        required
                      />
                      <small className="muted">
                        Create it in WordPress Users → Profile → Application Passwords. Do not use your normal login password.
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

              <section className="panel image-api-settings">
                <div className="panel-heading">
                  <div><h3>Image Generation APIs</h3><p>Configure separate API keys for featured-image creation.</p></div>
                  <span className="status-badge">2 image providers</span>
                </div>
                <div className="image-api-grid">
                  {imageProviders.map((provider: any) => (
                    <div className="image-api-card" key={provider.id}>
                      <div><strong>{provider.name}</strong><small>{provider.id === "image-openai" ? "OpenAI Images · gpt-image-1" : "Google Imagen · imagen-4.0-generate-001"}</small></div>
                      <span className={provider.configured ? "connected" : "muted"}>{provider.configured ? "Key saved" : "Not configured"}</span>
                      <div className="form-group">
                        <label>API Key</label>
                        <input type="password" autoComplete="new-password" value={imageApiKeyInputs[provider.id] || ""} onChange={(event) => setImageApiKeyInputs((current) => ({ ...current, [provider.id]: event.target.value }))} placeholder={provider.configured ? "Saved securely — enter to replace" : "Paste API key"} />
                        <small>{provider.configured ? "Leave blank to keep the saved key." : "Your key is encrypted and stored locally."}</small>
                      </div>
                      <button type="button" className="primary-button" disabled={imageProviderSaving === provider.id} onClick={() => void saveImageProvider(provider)}>
                        {imageProviderSaving === provider.id ? "Saving..." : "Save Image API"}
                      </button>
                    </div>
                  ))}
                </div>
              </section>

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

        {publishingTargetArticle && (
          <div className="article-preview-modal wordpress-publish-modal" role="dialog" aria-modal="true" aria-label="Choose WordPress website" onMouseDown={(event) => { if (event.target === event.currentTarget && !publishingArticle) { setPublishingTargetArticle(null); setPublishingSiteId(""); } }}>
            <section className="wordpress-publish-card">
              <div className="panel-heading">
                <div><span className="eyebrow-light">PUBLISHING DESTINATION</span><h3>Send article to WordPress</h3><p>Choose which connected website should receive this article as a WordPress draft.</p></div>
                <button type="button" className="secondary-button" disabled={publishingArticle} onClick={() => { setPublishingTargetArticle(null); setPublishingSiteId(""); }}>Close</button>
              </div>
              <div className="publish-article-summary"><strong>{publishingTargetArticle.title || "Untitled article"}</strong><small>Article Library · WordPress Draft</small></div>
              <div className="wordpress-site-choice-list">
                {sites.map((site: any) => <label key={site.id} className={`wordpress-site-choice ${publishingSiteId === String(site.id) ? "selected" : ""}`}>
                  <input type="radio" name="wordpress-publish-site" value={String(site.id)} checked={publishingSiteId === String(site.id)} onChange={(event) => setPublishingSiteId(event.target.value)} />
                  <span className="wordpress-site-choice-copy"><strong>{site.name}</strong><small>{site.url}</small></span>
                  <span className="site-choice-indicator">{publishingSiteId === String(site.id) ? "Selected" : "Choose"}</span>
                </label>)}
              </div>
              <div className="button-row publish-modal-actions">
                <button type="button" className="secondary-button" disabled={publishingArticle} onClick={() => { setPublishingTargetArticle(null); setPublishingSiteId(""); }}>Cancel</button>
                <button type="button" className="primary-button" disabled={!publishingSiteId || publishingArticle} onClick={() => void confirmPublishArticle()}>{publishingArticle ? "Sending article..." : "Send as WordPress Draft"}</button>
              </div>
            </section>
          </div>
        )}

        {previewArticle && (
          <div className="article-preview-modal" role="dialog" aria-modal="true" aria-label="Article preview">
            <section className="article-preview-modal-card">
              <div className="panel-heading">
                <div><h3>{previewArticle.title || "Article Preview"}</h3><small>{previewArticle.provider || "AI generated"} · {formatDate(previewArticle.created_at)}</small></div>
                <button type="button" className="secondary-button" onClick={() => { setPreviewArticle(null); setPreviewImage(""); }}>Close</button>
              </div>
              {previewLoading ? <p className="muted">Loading preview...</p> : previewImage ? <img className="library-featured-image" src={previewImage} alt="Article featured image" /> : null}
              <iframe className="library-preview-frame" title="Full article preview" sandbox="" srcDoc={String(previewArticle.content || "")} />
            </section>
          </div>
        )}

        <footer className="app-footer">
          <span>© MadCraves</span>
          <span>AI Content Studio · Version {updateInfo.version || "Current"}</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
