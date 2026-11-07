import { API_KEYS } from "../config/api-keys";
interface GenerationInput {
  topic: string;
  keyword?: string;
  secondaryKeywords?: string[];
  tone?: string;
  wordCount?: number;
  instructions?: string;
}

interface AIProvider {
  name: string;
  model: string;
  apiKey: string;
}

interface ArticleResult {
  provider: string;
  model: string;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
}

async function callAI(
  provider: AIProvider,
  prompt: string
): Promise<string> {
  let endpoint = "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  let body: any;

  if (provider.name.toLowerCase() === "gemini") {
    endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`;

    body = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    };
  } else if (provider.name.toLowerCase() === "groq") {
    endpoint = "https://api.groq.com/openai/v1/chat/completions";

    headers.Authorization = `Bearer ${provider.apiKey}`;

    body = {
      model: provider.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    };
  } else if (provider.name.toLowerCase() === "openrouter") {
    endpoint = "https://openrouter.ai/api/v1/chat/completions";

    headers.Authorization = `Bearer ${provider.apiKey}`;

    body = {
      model: provider.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    };
  } else {
    throw new Error(`Unsupported AI provider: ${provider.name}`);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `${provider.name} API error (${response.status}): ${errorText}`
    );
  }

  const data: any = await response.json();

  if (provider.name.toLowerCase() === "gemini") {
    return data.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text || "")
      .join("") || "";
  }

  return data.choices?.[0]?.message?.content || "";
}

function buildPrompt(input: GenerationInput): string {
  return `
You are a senior SEO strategist and professional content writer.

Write a high-quality, original, human-readable SEO article.

TOPIC: ${input.topic}

PRIMARY KEYWORD: ${input.keyword || input.topic}

SECONDARY KEYWORDS:
${(input.secondaryKeywords || []).join(", ")}

TARGET WORD COUNT: ${input.wordCount || 1500}

WRITING TONE: ${input.tone || "Professional and conversational"}

ADDITIONAL INSTRUCTIONS:
${input.instructions || "Use natural language and avoid keyword stuffing."}

REQUIREMENTS:
- Write a compelling SEO title.
- Use one clear H1 heading.
- Organize the article with relevant H2 and H3 headings.
- Naturally include the primary and secondary keywords.
- Write an engaging introduction.
- Include useful examples and actionable information.
- Add a conclusion.
- Include 5 relevant FAQs.
- Avoid repetitive or robotic language.
- Do not use the word "Guide" in the title.
- Do not invent statistics or unsupported claims.

Return ONLY valid JSON in this format:

{
  "title": "Article title",
  "content": "Complete article in HTML",
  "excerpt": "Short article summary",
  "slug": "article-url-slug",
  "metaTitle": "SEO meta title",
  "metaDescription": "SEO meta description",
  "keywords": ["primary keyword", "secondary keyword"]
}
`;
}

function parseArticle(
  raw: string,
  provider: AIProvider
): ArticleResult {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error(
      `${provider.name} returned invalid JSON.`
    );
  }

  const parsed = JSON.parse(
    cleaned.slice(start, end + 1)
  );

  if (!parsed.title || !parsed.content) {
    throw new Error(
      `${provider.name} returned incomplete article data.`
    );
  }

  return {
    provider: provider.name,
    model: provider.model,
    title: parsed.title,
    content: parsed.content,
    excerpt: parsed.excerpt || "",
    slug: parsed.slug || "",
    metaTitle: parsed.metaTitle || parsed.title,
    metaDescription: parsed.metaDescription || "",
    keywords: Array.isArray(parsed.keywords)
      ? parsed.keywords
      : []
  };
}

export async function runParallelGeneration(
  input: GenerationInput,
  providers: AIProvider[]
): Promise<ArticleResult[]> {
  if (!providers.length) {
    throw new Error(
      "Please enable at least one AI provider."
    );
  }

  const prompt = buildPrompt(input);

  const tasks = providers.map(async (provider) => {
    try {
      const raw = await callAI(provider, prompt);
      return parseArticle(raw, provider);
    } catch (error: any) {
      throw new Error(
        `${provider.name}: ${error.message}`
      );
    }
  });

  const results = await Promise.allSettled(tasks);

  const successful = results
    .filter(
      (result): result is PromiseFulfilledResult<ArticleResult> =>
        result.status === "fulfilled"
    )
    .map(result => result.value);

  if (!successful.length) {
    const errors = results
      .filter(result => result.status === "rejected")
      .map(result =>
        (result as PromiseRejectedResult).reason?.message
      );

    throw new Error(
      `All AI providers failed: ${errors.join(" | ")}`
    );
  }

  return successful;
}
