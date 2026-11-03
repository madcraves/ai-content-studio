import DatabaseDriver from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export class Database {
  private db: DatabaseDriver.Database;

  constructor(databasePath: string) {
    const directory = path.dirname(databasePath);

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    this.db = new DatabaseDriver(databasePath);

    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        token TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        api_key TEXT,
        encrypted INTEGER DEFAULT 0,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT,
        site_id INTEGER,
        status TEXT DEFAULT 'pending',
        error TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER,
        provider TEXT,
        model TEXT,
        title TEXT NOT NULL,
        content TEXT,
        excerpt TEXT,
        slug TEXT,
        meta_title TEXT,
        meta_description TEXT,
        focus_keyword TEXT,
        keywords TEXT,
        status TEXT DEFAULT 'generated',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs(id)
      );

      CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        topic TEXT,
        site_id INTEGER,
        run_at TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  dashboard(): any {
    const totalArticles = this.db
      .prepare("SELECT COUNT(*) AS count FROM articles")
      .get() as any;

    const scheduled = this.db
      .prepare("SELECT COUNT(*) AS count FROM schedules WHERE enabled = 1")
      .get() as any;

    const totalSites = this.db
      .prepare("SELECT COUNT(*) AS count FROM sites")
      .get() as any;

    const totalProviders = this.db
      .prepare("SELECT COUNT(*) AS count FROM providers WHERE enabled = 1")
      .get() as any;

    return {
      totalArticles: totalArticles.count,
      scheduled: scheduled.count,
      totalSites: totalSites.count,
      totalProviders: totalProviders.count
    };
  }

  listSites(): any[] {
    return this.db
      .prepare("SELECT id, name, url, created_at FROM sites ORDER BY id DESC")
      .all() as any[];
  }

  addSite(site: any): any {
    const result = this.db.prepare(`
      INSERT INTO sites (name, url, token)
      VALUES (?, ?, ?)
    `).run(
      site.name,
      site.url,
      site.token
    );

    return this.getSite(Number(result.lastInsertRowid));
  }

  getSite(id: number): any {
    return this.db
      .prepare("SELECT * FROM sites WHERE id = ?")
      .get(id) as any;
  }

  deleteSite(id: number): any {
    return this.db
      .prepare("DELETE FROM sites WHERE id = ?")
      .run(id);
  }

  saveProvider(provider: any): any {
    const existing = provider.id
      ? this.db.prepare("SELECT id FROM providers WHERE id = ?")
          .get(provider.id) as any
      : null;

    if (existing) {
      this.db.prepare(`
        UPDATE providers
        SET name = ?,
            provider = ?,
            model = ?,
            api_key = ?,
            encrypted = ?,
            enabled = ?
        WHERE id = ?
      `).run(
        provider.name,
        provider.provider,
        provider.model,
        provider.api_key ?? provider.apiKey ?? null,
        provider.encrypted ? 1 : 0,
        provider.enabled === false ? 0 : 1,
        provider.id
      );

      return { id: provider.id, success: true };
    }

    const result = this.db.prepare(`
      INSERT INTO providers (
        name, provider, model, api_key, encrypted, enabled
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      provider.name,
      provider.provider,
      provider.model,
      provider.api_key ?? provider.apiKey ?? null,
      provider.encrypted ? 1 : 0,
      provider.enabled === false ? 0 : 1
    );

    return {
      id: Number(result.lastInsertRowid),
      success: true
    };
  }

  listProviders(): any[] {
    return this.db.prepare(`
      SELECT id, name, provider, model, enabled, created_at
      FROM providers
      ORDER BY id DESC
    `).all() as any[];
  }

  getEnabledProviders(): any[] {
    return this.db.prepare(`
      SELECT *
      FROM providers
      WHERE enabled = 1
      ORDER BY id ASC
    `).all() as any[];
  }

  listArticles(): any[] {
    return this.db.prepare(`
      SELECT *
      FROM articles
      ORDER BY id DESC
    `).all() as any[];
  }

  createJob(input: any): number {
    const result = this.db.prepare(`
      INSERT INTO jobs (topic, site_id, status)
      VALUES (?, ?, 'processing')
    `).run(
      input.topic ?? input.keyword ?? "",
      input.siteId ?? input.site_id ?? null
    );

    return Number(result.lastInsertRowid);
  }

  saveGenerationResults(jobId: number, results: any[]): void {
    const insert = this.db.prepare(`
      INSERT INTO articles (
        job_id,
        provider,
        model,
        title,
        content,
        excerpt,
        slug,
        meta_title,
        meta_description,
        focus_keyword,
        keywords,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'generated')
    `);

    const saveAll = this.db.transaction((items: any[]) => {
      for (const item of items) {
        const article = item.article ?? item;

        insert.run(
          jobId,
          item.provider ?? article.provider ?? "",
          item.model ?? article.model ?? "",
          article.title ?? "Untitled Article",
          article.content ?? "",
          article.excerpt ?? "",
          article.slug ?? "",
          article.meta_title ?? article.metaTitle ?? article.title ?? "",
          article.meta_description ?? article.metaDescription ?? "",
          article.focus_keyword ?? article.focusKeyword ?? "",
          Array.isArray(article.keywords)
            ? article.keywords.join(", ")
            : article.keywords ?? ""
        );
      }
    });

    saveAll(results);

    this.db.prepare(`
      UPDATE jobs SET status = 'completed' WHERE id = ?
    `).run(jobId);
  }

  failJob(jobId: number, error: any): void {
    this.db.prepare(`
      UPDATE jobs
      SET status = 'failed', error = ?
      WHERE id = ?
    `).run(
      String(error?.message ?? error),
      jobId
    );
  }

  getArticle(id: number): any {
    return this.db
      .prepare("SELECT * FROM articles WHERE id = ?")
      .get(id) as any;
  }

  updateArticle(article: any): any {
    return this.db.prepare(`
      UPDATE articles
      SET title = ?,
          content = ?,
          excerpt = ?,
          slug = ?,
          meta_title = ?,
          meta_description = ?,
          focus_keyword = ?,
          keywords = ?
      WHERE id = ?
    `).run(
      article.title,
      article.content,
      article.excerpt ?? "",
      article.slug ?? "",
      article.meta_title ?? "",
      article.meta_description ?? "",
      article.focus_keyword ?? "",
      Array.isArray(article.keywords)
        ? article.keywords.join(", ")
        : article.keywords ?? "",
      article.id
    );
  }

  markPublished(id: number): any {
    return this.db.prepare(`
      UPDATE articles
      SET status = 'draft'
      WHERE id = ?
    `).run(id);
  }

  addSchedule(item: any): any {
    const result = this.db.prepare(`
      INSERT INTO schedules (
        title, topic, site_id, run_at, enabled
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      item.title ?? "",
      item.topic ?? "",
      item.siteId ?? item.site_id ?? null,
      item.run_at ?? item.runAt,
      item.enabled === false ? 0 : 1
    );

    return {
      id: Number(result.lastInsertRowid),
      success: true
    };
  }

  listSchedules(): any[] {
    return this.db.prepare(`
      SELECT *
      FROM schedules
      ORDER BY run_at ASC
    `).all() as any[];
  }

  deleteSchedule(id: number): any {
    return this.db
      .prepare("DELETE FROM schedules WHERE id = ?")
      .run(id);
  }

  getDueSchedules(): any[] {
    return this.db.prepare(`
      SELECT *
      FROM schedules
      WHERE enabled = 1
      AND datetime(run_at) <= datetime('now', 'localtime')
    `).all() as any[];
  }

  markScheduleTriggered(id: number): void {
    this.db.prepare(`
      UPDATE schedules
      SET enabled = 0
      WHERE id = ?
    `).run(id);
  }

  close(): void {
    this.db.close();
  }
}
