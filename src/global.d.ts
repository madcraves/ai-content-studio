export {};

declare global {
  interface Website {
    id: number;
    name: string;
    url: string;
    token?: string;
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
    provider?: string;
    model?: string;
    excerpt?: string;
    slug?: string;
    meta_title?: string;
    meta_description?: string;
    focus_keyword?: string;
    keywords?: string;
    status?: string;
    created_at?: string;
  }

  interface Schedule {
    id: number;
    title?: string;
    run_at: string;
    enabled: boolean;
    [key: string]: unknown;
  }

  interface DashboardStats {
    totalArticles?: number;
    scheduled?: number;
    [key: string]: unknown;
  }

  interface LicenseStatus {
    activated: boolean;
    valid: boolean;
    machineId: string;
    licensee?: string;
    message?: string;
  }

  interface StudioAPI {
    getLicenseStatus: () => Promise<LicenseStatus>;
    getMachineId: () => Promise<string>;
    activateLicense: (code: string) => Promise<LicenseStatus>;

    dashboard: () => Promise<DashboardStats>;
    listSites: () => Promise<Website[]>;
    addSite: (site: Partial<Website>) => Promise<any>;
    deleteSite: (id: number) => Promise<any>;

    saveProvider: (provider: Partial<AIProvider> & {
      apiKey?: string;
      api_key?: string;
    }) => Promise<any>;

    listProviders: () => Promise<AIProvider[]>;
    listArticles: () => Promise<Article[]>;
    generate: (input: any) => Promise<any>;
    publish: (input: any) => Promise<any>;
    saveEdit: (article: Partial<Article>) => Promise<any>;

    addSchedule: (item: Partial<Schedule>) => Promise<any>;
    listSchedules: () => Promise<Schedule[]>;
    deleteSchedule: (id: number) => Promise<any>;

    onScheduled: (callback: (id: number) => void) => () => void;
  }

  interface Window {
    studio: StudioAPI;
  }
}
