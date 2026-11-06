type WordPressSite = {
  id: number;
  name?: string;
  url: string;
  token: string;
};

type Article = {
  id?: number;
  title: string;
  content: string;
  excerpt?: string;
  slug?: string;
  meta_title?: string;
  meta_description?: string;
  focus_keyword?: string;
  keywords?: string;
};

function getBaseUrl(url: string): string {
  const clean = String(url || "").trim().replace(/\/+$/, "");

  if (!/^https?:\/\//i.test(clean)) {
    throw new Error("Website URL must start with https:// (or http:// for local testing).");
  }

  return clean;
}

function getAuthHeader(token: string): string {
  const value = String(token || "").trim();

  if (/^(Bearer|Basic)\s/i.test(value)) {
    return value;
  }

  const separator = value.indexOf(":");

  if (separator <= 0 || separator === value.length - 1) {
    throw new Error(
      "WordPress credentials format is incorrect. Enter: WordPress username:Application Password"
    );
  }

  const username = value.slice(0, separator).trim();
  const applicationPassword = value
    .slice(separator + 1)
    .replace(/\s+/g, "");

  if (!username || !applicationPassword) {
    throw new Error("WordPress username or Application Password is missing.");
  }

  return `Basic ${Buffer.from(
    `${username}:${applicationPassword}`,
    "utf8"
  ).toString("base64")}`;
}

async function readWordPressResponse(response: Response): Promise<any> {
  const raw = await response.text();

  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return { message: raw || `HTTP ${response.status}` };
  }
}

function explainWordPressError(status: number, data: any): string {
  const message =
    data?.message ||
    data?.code ||
    `WordPress returned HTTP ${status}.`;

  if (status === 401) {
    return `WordPress login failed (401). Check the WordPress username and Application Password. Details: ${message}`;
  }

  if (status === 403) {
    return `WordPress denied permission (403). The account may not have permission to create posts, or a security plugin may be blocking REST API access. Details: ${message}`;
  }

  if (status === 404) {
    return `WordPress REST API endpoint was not found (404). Check the website URL and make sure the WordPress REST API is enabled. Details: ${message}`;
  }

  return `WordPress error (${status}): ${message}`;
}

/**
 * Verifies that the saved WordPress credentials can authenticate
 * against the WordPress REST API.
 */
export async function testWordPressConnection(site: WordPressSite) {
  if (!site?.url || !site?.token) {
    throw new Error("WordPress website URL or credentials are missing.");
  }

  const base = getBaseUrl(site.url);
  const authorization = getAuthHeader(site.token);

  const response = await fetch(
    `${base}/wp-json/wp/v2/users/me?context=edit`,
    {
      method: "GET",
      headers: {
        Authorization: authorization,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(20000)
    }
  );

  const data = await readWordPressResponse(response);

  if (!response.ok) {
    throw new Error(explainWordPressError(response.status, data));
  }

  return {
    success: true,
    username: data?.slug || data?.name || "WordPress user",
    message: "WordPress authentication successful."
  };
}

/**
 * Creates a WordPress post with status=draft.
 * It never publishes the article automatically.
 */
export async function publishDraft(site: WordPressSite, article: Article) {
  if (!site?.url || !site?.token) {
    throw new Error("WordPress website URL or credentials are missing.");
  }

  if (!article?.title?.trim() || !article?.content?.trim()) {
    throw new Error("Article title or content is empty. Open the article and check it first.");
  }

  const base = getBaseUrl(site.url);
  const authorization = getAuthHeader(site.token);

  // Verify authentication before attempting to create the post.
  const authResponse = await fetch(
    `${base}/wp-json/wp/v2/users/me?context=edit`,
    {
      method: "GET",
      headers: {
        Authorization: authorization,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(20000)
    }
  );

  const authData = await readWordPressResponse(authResponse);

  if (!authResponse.ok) {
    throw new Error(explainWordPressError(authResponse.status, authData));
  }

  const postPayload: Record<string, any> = {
    title: article.title.trim(),
    content: article.content,
    excerpt: article.excerpt || "",
    status: "draft"
  };

  if (article.slug?.trim()) {
    postPayload.slug = article.slug.trim();
  }

  const response = await fetch(`${base}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(postPayload),
    signal: AbortSignal.timeout(30000)
  });

  const data = await readWordPressResponse(response);

  if (!response.ok) {
    throw new Error(explainWordPressError(response.status, data));
  }

  if (!data?.id) {
    throw new Error("WordPress response did not include a post ID. Draft creation could not be confirmed.");
  }

  return {
    success: true,
    status: data.status || "draft",
    postId: data.id,
    link: data.link || "",
    title: data.title?.rendered || article.title,
    message: "Draft successfully created in WordPress."
  };
}
