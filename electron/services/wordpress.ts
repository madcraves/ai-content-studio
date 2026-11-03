
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

export async function publishDraft(
  site: WordPressSite,
  article: Article
) {
  if (!site.url || !site.token) {
    throw new Error("WordPress website URL or API token is missing.");
  }

  const endpoint =
    `${site.url.replace(/\/+$/, "")}/wp-json/madcraves/v1/draft`;

  const payload = {
    title: article.title,
    content: article.content,
    excerpt: article.excerpt || "",
    slug: article.slug || "",
    status: "draft",
    meta_title: article.meta_title || article.title,
    meta_description: article.meta_description || "",
    focus_keyword: article.focus_keyword || "",
    keywords: article.keywords || ""
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MadCraves-Token": site.token
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();

  let result: any;

  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch {
    result = { message: responseText };
  }

  if (!response.ok) {
    throw new Error(
      result.message ||
      result.error ||
      `WordPress request failed: HTTP ${response.status}`
    );
  }

  return {
    success: true,
    status: "draft",
    response: result
  };
}
