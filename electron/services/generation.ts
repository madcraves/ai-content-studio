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
  baseUrl?: string;
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

Create ONE complete, exceptional, original, search-intent-matched SEO article that reads like it was written and carefully edited by an experienced human subject-matter writer.

ARTICLE BRIEF:

Topic: ${input.topic}

Primary SEO Keyword: ${input.keyword}

Target Word Count: ${wordCount}

Writing Tone: ${input.tone || "Professional"}

Additional Instructions:
${input.instructions || "No additional instructions."}

CONTENT REQUIREMENTS:

1. Write a comprehensive article targeting the requested word count, with genuinely useful depth rather than filler.
2. Satisfy the dominant search intent and cover important entities, related concepts, practical steps, examples and reader questions.
3. Use a natural human voice: varied sentence rhythm, specific explanations, smooth transitions and a confident but not robotic tone. Avoid generic AI phrases, repetitive conclusions, empty introductions and formulaic wording.
4. Use the primary keyword naturally in the title, opening, relevant headings and body; never force it.
5. Build topical coverage with relevant semantic, secondary and long-tail terms. Include at least five genuinely relevant keywords total.
6. Include relevant secondary and long-tail keywords.
7. Create a compelling introduction that directly addresses the reader’s search intent.
8. Use a logical H1, H2 and H3 heading structure with descriptive, useful headings.
9. Include useful examples, actionable recommendations and practical information where relevant.
10. Avoid keyword stuffing, repetition, padding and unnatural transitions.
11. Prioritize readers, clarity, trustworthiness and helpfulness over search-engine manipulation.
12. Include a useful conclusion with a clear next step where appropriate.
13. Add 5-8 specific FAQs that reflect real follow-up questions when appropriate.
14. Do not invent statistics, studies, sources, quotations, expert credentials or factual claims. Flag uncertainty honestly.
15. Do not include fake citations or fabricated references. Only cite verifiable sources if supplied in the brief.
16. Return valid JSON only.
17. The content field must contain clean, semantic HTML suitable for WordPress.
18. Do not wrap the JSON in Markdown code fences.

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
    endpoint = "https://api.groq.com/openai/v1/chat/completions";
  } else if (providerId === "openrouter") {
    endpoint = "https://openrouter.ai/api/v1/chat/completions";
  } else if (providerId === "openai-compatible" && provider.baseUrl) {
    const base = provider.baseUrl.trim().replace(/\/+$/, "");
    endpoint = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
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
    providerId === "openrouter" ||
    providerId === "openai-compatible"
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


// Multi-agent collaboration: each specialist receives and improves the previous draft.
export async function runMultiAgentGeneration(input: GenerationInput, providers: AIProvider[]): Promise<GeneratedArticle[]> {
  const active = (providers || []).filter((p) => p.enabled !== false && Boolean(p.apiKey?.trim()) && Boolean(p.model?.trim()));
  if (!active.length) throw new Error("No active AI providers are configured for the agent team.");
  const stages = [
    { role: "Research Agent", task: "Create a research-led draft based on search intent. Identify key subtopics, entities, reader questions and secondary keywords. Never invent statistics or sources." },
    { role: "SEO Strategist & Writer", task: "Improve the draft for search intent, topical completeness, headings, natural keyword coverage, examples and FAQs." },
    { role: "Editorial Agent", task: "Improve clarity, readability, flow, tone and remove repetition while preserving useful detail and the requested length." },
    { role: "Fact-Check & Final QA Agent", task: "Review factual consistency, qualify unsupported claims, check structure and produce the final publish-ready article. Never fabricate citations." },
  ];
  let previous: GeneratedArticle | null = null;
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const provider = active[i % active.length];
    const agentInput: GenerationInput = {
      ...input,
      instructions: [input.instructions || "",
        `AGENT ROLE: ${stage.role}. ${stage.task}`,
        previous ? `PREVIOUS AGENT DRAFT — improve it, do not summarize:\\nTitle: ${previous.title}\\nExcerpt: ${previous.excerpt}\\nHTML: ${previous.content}\\nKeywords: ${previous.keywords.join(", ")}` : "Start with a research-led outline and complete first draft.",
        "Return the required JSON article object with valid WordPress HTML."
      ].filter(Boolean).join("\\n\\n"),
    };
    previous = await generateWithRetry(agentInput, provider);
  }
  if (!previous) throw new Error("The multi-agent workflow did not produce an article.");
  return [{ ...previous, provider: "multi-agent-team", model: stages.map((stage, i) => `${stage.role}: ${active[i % active.length].model}`).join(" → ") }];
}
