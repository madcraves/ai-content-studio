export interface GenerationInput {
  topic: string;
  keyword: string;
  wordCount?: number;
  tone?: string;
  instructions?: string;
}

export interface AIProvider {
  id?: string;
  name?: string;
  provider?: string;
  model: string;
  apiKey: string;
  enabled?: boolean;
}

interface GeneratedArticle {
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  provider: string;
  model: string;
}

const REQUEST_TIMEOUT = 120000;
const MAX_RETRIES = 1;

// --------------------------------------------------
// PROVIDER IDENTIFICATION
// --------------------------------------------------

function getProviderId(provider: AIProvider): string {
  return String(
    provider.provider || provider.id || ""
  ).toLowerCase();
}

// --------------------------------------------------
// ARTICLE PROMPT
// --------------------------------------------------

function buildPrompt(input: GenerationInput): string {
  const wordCount = Math.max(
    300,
    Math.min(Number(input.wordCount) || 2000, 10000)
  );

  return `
You are an expert SEO content writer, professional researcher
and experienced website content strategist.

Create a complete, high-quality, original SEO article.

ARTICLE BRIEF:

Topic: ${input.topic}

Primary SEO Keyword: ${input.keyword}

Target Word Count: ${wordCount}

Writing Tone: ${input.tone || "Professional"}

Additional Instructions:
${input.instructions || "No additional instructions."}

CONTENT REQUIREMENTS:

1. Write a comprehensive article targeting the requested word count.
2. Use the primary keyword naturally throughout the article.
3. Include relevant secondary and long-tail keywords.
4. Create an engaging introduction.
5. Use a logical H1, H2 and H3 heading structure.
6. Include useful examples and practical information.
7. Avoid keyword stuffing and unnecessary repetition.
8. Write naturally for human readers.
9. Include a useful conclusion.
10. Add 5-8 relevant FAQs when appropriate.
11. Do not invent statistics, studies, sources or factual claims.
12. Do not include fake citations or fabricated references.
13. Return valid JSON only.
14. The content field must contain valid HTML suitable for WordPress.
15. Do not wrap the JSON in Markdown code fences.

RETURN THIS JSON STRUCTURE:

{
  "title": "SEO article title",
  "content": "<h1>Article title</h1><p>Article introduction...</p>",
  "excerpt": "Short article summary",
  "slug": "seo-friendly-url-slug",
  "metaTitle": "SEO meta title",
  "metaDescription": "SEO meta description",
  "keywords": [
    "Primary keyword",
    "Secondary keyword 1",
    "Secondary keyword 2",
    "Secondary keyword 3",
    "Secondary keyword 4"
  ]
}

IMPORTANT:
Return only a valid JSON object.
`;
}

// --------------------------------------------------
// JSON EXTRACTION
// --------------------------------------------------

function extractJSON(text: string): any {
  if (!text || !text.trim()) {
    throw new Error("AI returned an empty response.");
  }

  let cleaned = text.trim();

  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error(
        "AI response did not contain valid JSON."
      );
    }

    const extracted = cleaned.substring(start, end + 1);

    try {
      return JSON.parse(extracted);
    } catch {
      throw new Error(
        "Unable to parse the AI-generated article JSON."
      );
    }
  }
}

// --------------------------------------------------
// ARTICLE VALIDATION
// --------------------------------------------------

function parseArticle(
  raw: any,
  provider: AIProvider
): GeneratedArticle {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid article response.");
  }

  const title = String(raw.title || "").trim();

  const content = String(
    raw.content || raw.html || ""
  ).trim();

  if (!title) {
    throw new Error("Generated article has no title.");
  }

  if (!content || content.length < 100) {
    throw new Error(
      "Generated article content is missing or too short."
    );
  }

  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords
        .map((item: any) => String(item).trim())
        .filter(Boolean)
    : [];

  return {
    title,
    content,

    excerpt: String(
      raw.excerpt || ""
    ).trim(),

    slug: String(
      raw.slug || ""
    ).trim(),

    metaTitle: String(
      raw.metaTitle || raw.meta_title || title
    ).trim(),

    metaDescription: String(
      raw.metaDescription ||
      raw.meta_description ||
      raw.excerpt ||
      ""
    ).trim(),

    keywords,

    provider: getProviderId(provider),
    model: provider.model,
  };
}

// --------------------------------------------------
// HTTP REQUEST WITH TIMEOUT
// --------------------------------------------------

async function requestWithTimeout(
  url: string,
  options: RequestInit
): Promise<Response> {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(
        "AI request timed out. Please try again."
      );
    }

    throw new Error(
      error?.message || "Unable to connect to AI provider."
    );
  } finally {
    clearTimeout(timeout);
  }
}

// --------------------------------------------------
// GEMINI API
// --------------------------------------------------

async function callGemini(
  input: GenerationInput,
  provider: AIProvider
): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(provider.model)}:generateContent` +
    `?key=${encodeURIComponent(provider.apiKey)}`;

  const response = await requestWithTimeout(url, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildPrompt(input),
            },
          ],
        },
      ],

      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,
        responseMimeType: "application/json",
      },
    }),
  });

  const data: any = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `Gemini API error: HTTP ${response.status}`
    );
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: any) => part.text || "")
    .join("");

  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason;

    throw new Error(
      `Gemini returned no article content. Finish reason: ${reason || "Unknown"}`
    );
  }

  return text;
}

// --------------------------------------------------
// OPENAI-COMPATIBLE PROVIDERS
// GROQ + OPENROUTER
// --------------------------------------------------

async function callOpenAICompatible(
  input: GenerationInput,
  provider: AIProvider
): Promise<string> {
  const providerId = getProviderId(provider);

  let endpoint = "";

  if (providerId === "groq") {
    endpoint =
      "https://api.groq.com/openai/v1/chat/completions";
  } else if (providerId === "openrouter") {
    endpoint =
      "https://openrouter.ai/api/v1/chat/completions";
  } else {
    throw new Error(
      `Unsupported OpenAI-compatible provider: ${providerId}`
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${provider.apiKey}`,
    "Content-Type": "application/json",
  };

  if (providerId === "openrouter") {
    headers["HTTP-Referer"] = "https://madcraves.com";
    headers["X-Title"] = "MadCraves AI Content Studio";
  }

  const response = await requestWithTimeout(endpoint, {
    method: "POST",
    headers,

    body: JSON.stringify({
      model: provider.model,

      messages: [
        {
          role: "system",
          content:
            "You are a professional SEO writer. Return only valid JSON.",
        },
        {
          role: "user",
          content: buildPrompt(input),
        },
      ],

      temperature: 0.7,
      max_tokens: 16384,

      response_format: {
        type: "json_object",
      },
    }),
  });

  const data: any = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `AI provider error: HTTP ${response.status}`
    );
  }

  const text = data?.choices?.[0]?.message?.content;

  if (!text || typeof text !== "string") {
    throw new Error(
      "AI provider returned an empty response."
    );
  }

  return text;
}

// --------------------------------------------------
// CALL AI PROVIDER
// --------------------------------------------------

async function callAI(
  input: GenerationInput,
  provider: AIProvider
): Promise<GeneratedArticle> {
  const providerId = getProviderId(provider);

  if (!provider.apiKey?.trim()) {
    throw new Error(
      `${providerId} API key is missing.`
    );
  }

  if (!provider.model?.trim()) {
    throw new Error(
      `${providerId} model is missing.`
    );
  }

  let responseText = "";

  if (providerId === "gemini") {
    responseText = await callGemini(input, provider);
  } else if (
    providerId === "groq" ||
    providerId === "openrouter"
  ) {
    responseText = await callOpenAICompatible(
      input,
      provider
    );
  } else {
    throw new Error(
      `Unsupported AI provider: ${providerId}`
    );
  }

  const parsed = extractJSON(responseText);

  return parseArticle(parsed, provider);
}

// --------------------------------------------------
// RETRY PROVIDER
// --------------------------------------------------

async function generateWithRetry(
  input: GenerationInput,
  provider: AIProvider
): Promise<GeneratedArticle> {
  let lastError: any;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      return await callAI(input, provider);
    } catch (error: any) {
      lastError = error;

      if (attempt < MAX_RETRIES) {
        console.warn(
          `${getProviderId(provider)} attempt ${attempt + 1} failed:`,
          error?.message
        );
      }
    }
  }

  throw new Error(
    `${getProviderId(provider)} failed: ${
      lastError?.message || "Unknown error"
    }`
  );
}

// --------------------------------------------------
// PARALLEL ARTICLE GENERATION
// USES THE PROVIDERS SUPPLIED BY MAIN.TS
// --------------------------------------------------

export async function runParallelGeneration(
  input: GenerationInput,
  providers: AIProvider[]
): Promise<GeneratedArticle[]> {
  if (!input || !input.topic?.trim()) {
    throw new Error("Article topic is required.");
  }

  if (!input.keyword?.trim()) {
    throw new Error("Primary SEO keyword is required.");
  }

  const activeProviders = (providers || []).filter(
    (provider) =>
      provider.enabled !== false &&
      typeof provider.apiKey === "string" &&
      provider.apiKey.trim().length > 0 &&
      typeof provider.model === "string" &&
      provider.model.trim().length > 0
  );

  if (activeProviders.length === 0) {
    throw new Error(
      "No valid AI providers supplied. Check your built-in API configuration."
    );
  }

  console.log(
    `Starting parallel generation with ${activeProviders.length} AI provider(s).`
  );

  const results = await Promise.allSettled(
    activeProviders.map((provider) =>
      generateWithRetry(input, provider)
    )
  );

  const successfulArticles: GeneratedArticle[] = [];

  const failures: string[] = [];

  results.forEach((result, index) => {
    const provider = activeProviders[index];

    if (result.status === "fulfilled") {
      successfulArticles.push(result.value);

      console.log(
        `${getProviderId(provider)} generated an article successfully.`
      );
    } else {
      const errorMessage =
        result.reason?.message ||
        String(result.reason);

      failures.push(
        `${getProviderId(provider)}: ${errorMessage}`
      );

      console.error(
        `${getProviderId(provider)} generation failed:`,
        errorMessage
      );
    }
  });

  if (successfulArticles.length === 0) {
    throw new Error(
      "All AI providers failed.\n" +
      failures.join("\n")
    );
  }

  console.log(
    `Generation completed. ${successfulArticles.length} article(s) generated.`
  );

  return successfulArticles;
}
