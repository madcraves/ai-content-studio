import { API_KEYS, AI_MODELS } from "../config/api-keys";

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

const MAX_RETRIES = 1;

function getProviders(): AIProvider[] {
  return [
    {
      name: "Gemini",
      model: AI_MODELS.gemini,
      apiKey: API_KEYS.gemini
    },
    {
      name: "Groq",
      model: AI_MODELS.groq,
      apiKey: API_KEYS.groq
    },
    {
      name: "OpenRouter",
      model: AI_MODELS.openrouter,
      apiKey: API_KEYS.openrouter
    }
  ].filter(provider => provider.apiKey?.trim().length > 0);
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

  const providerName = provider.name.toLowerCase();

  if (providerName === "gemini") {
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
        maxOutputTokens: 16384,
        responseMimeType: "application/json"
      }
    };

  } else if (
    providerName === "groq" ||
    providerName === "openrouter"
  ) {
    endpoint =
      providerName === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://openrouter.ai/api/v1/chat/completions";

    headers.Authorization = `Bearer ${provider.apiKey}`;

    body = {
      model: provider.model,
      messages: [
        {
          role: "system",
          content:
            "You are a professional SEO writer. Return only valid JSON. Do not use Markdown code fences."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 16384,
      response_format: {
        type: "json_object"
      }
    };

  } else {
    throw new Error(
      `Unsupported AI provider: ${provider.name}`
    );
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000)
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `${provider.name} API error (${response.status}): ${errorText}`
    );
  }

  const data: any = await response.json();

  let output = "";

  if (providerName === "gemini") {
    output =
      data.candidates?.[0]?.content?.parts
        ?.map((part: any) => part.text || "")
        .join("") || "";

    if (!output) {
      throw new Error(
        "Gemini returned an empty response or no usable candidate."
      );
    }

  } else {
    output = data.choices?.[0]?.message?.content || "";

    if (!output) {
      throw new Error(
        `${provider.name} returned an empty response.`
      );
    }
  }

  return output;
}

function buildPrompt(input: GenerationInput): string {
  return `
You are a senior SEO strategist and professional content writer.

Write a high-quality, original, human-readable SEO article.

TOPIC:
${input.topic}

PRIMARY KEYWORD:
${input.keyword || input.topic}

SECONDARY KEYWORDS:
${(input.secondaryKeywords || []).join(", ")}

TARGET WORD COUNT:
${input.wordCount || 2000}

WRITING TONE:
${input.tone || "Professional and conversational"}

ADDITIONAL INSTRUCTIONS:
${input.instructions || "Use natural language and avoid keyword stuffing."}

REQUIREMENTS:

1. Write a compelling SEO title.
2. Use one clear H1 heading.
3. Organize the article with relevant H2 and H3 headings.
4. Naturally include the primary and secondary keywords.
5. Write an engaging introduction.
6. Include useful examples and actionable information.
7. Add a detailed conclusion.
8. Include 5 relevant FAQs.
9. Avoid repetitive or robotic language.
10. Do not use the word "Guide" in the title.
11. Do not invent statistics or unsupported claims.
12. Write complete, useful content close to the requested word count.
13. Return article content as valid HTML.
14. Do not include Markdown code fences.

Return ONLY valid JSON in this format:

{
  "title": "Article title",
  "content": "<h1>Article heading</h1><p>Complete article...</p>",
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

  let parsed: any;

  try {
    parsed = JSON.parse(
      cleaned.slice(start, end + 1)
    );
  } catch {
    throw new Error(
      `${provider.name} returned malformed JSON.`
    );
  }

  if (
    typeof parsed.title !== "string" ||
    !parsed.title.trim() ||
    typeof parsed.content !== "string" ||
    !parsed.content.trim()
  ) {
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

async function generateWithRetry(
  provider: AIProvider,
  prompt: string
): Promise<ArticleResult> {
  let lastError: any;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      const raw = await callAI(provider, prompt);
      return parseArticle(raw, provider);

    } catch (error: any) {
      lastError = error;

      if (attempt < MAX_RETRIES) {
        console.warn(
          `${provider.name} failed. Retrying...`,
          error.message
        );
      }
    }
  }

  throw new Error(
    `${provider.name} failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`
  );
}

export async function runParallelGeneration(
  input: GenerationInput,
  _providers: AIProvider[]
): Promise<ArticleResult[]> {

  const providers = getProviders();

  if (!providers.length) {
    throw new Error(
      "No hardcoded AI API keys configured. Check electron/config/api-keys.ts."
    );
  }

  const prompt = buildPrompt(input);

  // Run all configured providers simultaneously.
  const results = await Promise.allSettled(
    providers.map(provider =>
      generateWithRetry(provider, prompt)
    )
  );

  const successful: ArticleResult[] = [];
  const failedProviders: AIProvider[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successful.push(result.value);
    } else {
      failedProviders.push(providers[index]);

      console.error(
        `${providers[index].name} failed:`,
        result.reason?.message
      );
    }
  });

  // Keep every successful article.
  if (successful.length > 0) {
    return successful;
  }

  // All simultaneous attempts failed.
  // Try each provider again as a backup.
  const backupErrors: string[] = [];

  for (const provider of failedProviders) {
    try {
      const article = await generateWithRetry(
        provider,
        prompt
      );

      return [article];

    } catch (error: any) {
      backupErrors.push(error.message);
    }
  }

  throw new Error(
    `All AI providers failed. Backup errors: ${backupErrors.join(" | ")}`
  );
}
