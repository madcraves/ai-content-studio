
import DatabaseDriver from "better-sqlite3";

export class Database {
  private db: DatabaseDriver.Database;

  constructor(file: string) {
    this.db = new DatabaseDriver(file);

    this.db.pragma("journal_mode = WAL");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sites (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        token TEXT NOT NULL,
        protocol TEXT DEFAULT 'madcraves',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS providers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        model TEXT NOT NULL,
        apiKey TEXT NOT NULL,
        encrypted INTEGER DEFAULT 1,
        enabled INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY,
        topic TEXT,
        site_id INTEGER,
        status TEXT,
        error TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY,
        job_id INTEGER,
        site_id INTEGER,
        provider TEXT,
        model TEXT,
        title TEXT,
        content TEXT,
        excerpt TEXT,
        slug TEXT,
        meta_title TEXT,
        meta_description TEXT,
        focus_keyword TEXT,
        keywords TEXT,
        status TEXT DEFAULT 'generated',
        wp_post_id INTEGER,
        wp_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY,
        site_id INTEGER,
        topic TEXT,
        keyword TEXT,
        run_at TEXT,
        enabled INTEGER DEFAULT 1
      );
    `);
  }

  dashboard() {
    return {
      sites: (this.db.prepare(
        "SELECT COUNT(*) n FROM sites"
      ).get() as any).n,

      articles: (this.db.prepare(
        "SELECT COUNT(*) n FROM articles"
      ).get() as any).n,

      drafts: (this.db.prepare(
        "SELECT COUNT(*) n FROM articles WHERE status='draft'"
      ).get() as any).n,

      jobs: (this.db.prepare(
        "SELECT COUNT(*) n FROM jobs"
      ).get() as any).n
    };
  }

  listSites() {
    return this.db.prepare(
      "SELECT id,name,url,protocol,created_at FROM sites ORDER BY id DESC"
    ).all();
  }

  addSite(s: any) {
    const r = this.db.prepare(
      "INSERT INTO sites(name,url,token,protocol) VALUES(?,?,?,?)"
    ).run(
      s.name,
      s.url.replace(/\/$/, ""),
      s.token,
      s.protocol || "madcraves"
    );

    return this.getSite(Number(r.lastInsertRowid));
  }

  getSite(id: number) {
    return this.db.prepare(
      "SELECT * FROM sites WHERE id=?"
    ).get(id);
  }

  deleteSite(id: number) {
    this.db.prepare(
      "DELETE FROM sites WHERE id=?"
    ).run(id);

    return true;
  }

  saveProvider(p: any) {
    this.db.prepare(
      "INSERT INTO providers(name,model,apiKey,encrypted,enabled) VALUES(?,?,?,?,1)"
    ).run(
      p.name,
      p.model,
      p.apiKey,
      p.encrypted ? 1 : 0
    );
  }

  listProviders() {
    return this.db.prepare(
      "SELECT * FROM providers ORDER BY id DESC"
    ).all();
  }

  getEnabledProviders() {
    return this.db.prepare(
      "SELECT * FROM providers WHERE enabled=1"
    ).all();
  }

  listArticles() {
    return this.db.prepare(
      "SELECT * FROM articles ORDER BY id DESC"
    ).all();
  }

  createJob(input: any) {
    const r = this.db.prepare(
      "INSERT INTO jobs(topic,site_id,status) VALUES(?,?,'running')"
    ).run(input.topic, input.siteId);

    return Number(r.lastInsertRowid);
  }

  saveGenerationResults(
    jobId: number,
    input: any,
    results: any[]
  ) {
    const insert = this.db.prepare(`
      INSERT INTO articles(
        job_id,
        site_id,
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
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 'generated')
    `);

    const tx = this.db.transaction((items: any[]) => {
      for (const a of items) {
        insert.run(
          jobId,
          input.siteId,
          a.provider,
          a.model,
          a.title,
          a.content,
          a.excerpt || "",
          a.slug || "",
          a.metaTitle || a.title,
          a.metaDescription || "",
          input.keyword || "",
          JSON.stringify(a.keywords || [])
        );
      }
    });

    tx(results);

    this.db.prepare(
      "UPDATE jobs SET status='completed' WHERE id=?"
    ).run(jobId);
  }

  failJob(id: number, error: string) {
    this.db.prepare(
      "UPDATE jobs SET status='failed',error=? WHERE id=?"
    ).run(error, id);
  }

  getArticle(id: number) {
    return this.db.prepare(
      "SELECT * FROM articles WHERE id=?"
    ).get(id);
  }

  updateArticle(a: any) {
    this.db.prepare(`
      UPDATE articles
      SET title=?,
          content=?,
          meta_title=?,
          meta_description=?,
          focus_keyword=?,
          keywords=?
      WHERE id=?
    `).run(
      a.title,
      a.content,
      a.meta_title,
      a.meta_description,
      a.focus_keyword,
      a.keywords,
      a.id
    );

    return true;
  }

  markPublished(id: number, r: any) {
    this.db.prepare(
      "UPDATE articles SET status='draft',wp_post_id=?,wp_url=? WHERE id=?"
    ).run(r.id, r.link, id);
  }

  addSchedule(s: any) {
    const r = this.db.prepare(
      "INSERT INTO schedules(site_id,topic,keyword,run_at) VALUES(?,?,?,?)"
    ).run(
      s.siteId,
      s.topic,
      s.keyword,
      s.runAt
    );

    return Number(r.lastInsertRowid);
  }

  listSchedules() {
    return this.db.prepare(
      "SELECT * FROM schedules ORDER BY run_at"
    ).all();
  }

  deleteSchedule(id: number) {
    this.db.prepare(
      "DELETE FROM schedules WHERE id=?"
    ).run(id);

    return true;
  }
}
