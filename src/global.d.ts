export {};

declare global {
  interface Website {
    id: number;
    name: string;
    url: string;
    token?: string;
    created_at?: string;
  }

  interface AIProvider {
    id: number;
    name: string;
    provider: string;
    model: string;
    enabled?: boolean;
  }

  interface Article {
    id: number;
    title: string;
    content: string;
    excerpt?: string;
    slug?: string;
    meta_title?: string;
    meta_description?: string;
    focus_keyword?: string;
    keywords?: string;
    status?: string;
    created_at?: string;
    updated_at?: string;
  }

  interface Schedule {
    id: number;
    title?: string;
    topic?: string;
    siteId?: number;
    site_id?: number;
    run_at: string;
    enabled: boolean;
    created_at?: string;
  }

  interface DashboardStats {
    totalArticles?: number;
    scheduled?: number;
    totalSites?: number;
    totalProviders?: number;
    [key: string]: unknown;
  }

  interface GenerateArticleInput {
    topic: string;
    keyword?: string;
    wordCount?: number;
    tone?: string;
    instructions?: string;
  }

  interface PublishArticleInput {
    articleId: number;
    siteId: number;
  }

  interface StudioAPI {
    dashboard: () => Promise<DashboardStats>;

    listSites: () => Promise<Website[]>;
    addSite: (site: Partial<Website>) => Promise<unknown>;
    deleteSite: (id: number) => Promise<unknown>;

    saveProvider: (
      provider: Partial<AIProvider> & {
        apiKey?: string;
        api_key?: string;
      }
    ) => Promise<unknown>;

    listProviders: () => Promise<AIProvider[]>;

    listArticles: () => Promise<Article[]>;

    generate: (
      input: GenerateArticleInput
    ) => Promise<{
      results?: unknown[];
      [key: string]: unknown;
    }>;

    publish: (
      input: PublishArticleInput
    ) => Promise<unknown>;

    saveEdit: (
      article: Partial<Article>
    ) => Promise<unknown>;

    addSchedule: (
      item: Partial<Schedule>
    ) => Promise<unknown>;

    listSchedules: () => Promise<Schedule[]>;

    deleteSchedule: (
      id: number
    ) => Promise<unknown>;

    onScheduled: (
      callback: (id: number) => void
    ) => () => void;
  }

  interface Window {
    studio: StudioAPI;
  }
}
