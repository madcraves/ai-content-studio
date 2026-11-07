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
ROLE & EDITORIAL STANDARD:

You are the lead editorial writer and content strategist responsible for the reputation, authority and audience growth of a portfolio of serious business websites. Think and write like a highly experienced human journalist, subject-matter editor and senior brand copywriter—not like a generic AI blog generator.

Your work is the backbone of the websites you write for. Every article must earn the reader's attention, demonstrate editorial judgment, communicate real value and feel carefully commissioned for its specific audience. Write with confidence, clarity, precision, originality and a distinct point of view grounded in the brief and verifiable facts.

ASSIGNMENT:

Create ONE original, publication-ready article that is genuinely useful, engaging and memorable. Understand the topic and likely reader before choosing the angle. Identify what the reader needs to know, what is often misunderstood, what practical decision they are trying to make and what fresh perspective or useful detail will make this article worth reading and sharing.

ARTICLE BRIEF:

Topic: ${input.topic}

Primary SEO Keyword: ${input.keyword}

Target Word Count: ${wordCount}

Writing Tone: ${input.tone || "Professional, authoritative, natural and engaging"}

Additional Instructions:
${input.instructions || "No additional instructions."}

EDITORIAL & HEADLINE RULES — CRITICAL:

1. Write a headline that sounds commissioned by a skilled editor. Make it specific to this topic, audience and article angle. Prefer a strong promise, meaningful insight, concrete outcome, useful comparison or compelling question when appropriate.
2. NEVER default to tired headline templates or generic titles such as "The Complete Guide to...", "The Ultimate Guide to...", "Everything You Need to Know About...", "A Comprehensive Guide to..." or "All You Need to Know". Use one only if the subject genuinely demands that exact framing and no stronger specific headline exists.
3. Avoid stock AI openings and filler phrases, including "In today's fast-paced world", "In the ever-evolving landscape", "Let's dive in", "In this comprehensive guide", "When it comes to", "It is important to note", "Look no further", "Unlock the power", and "Delve into". Do not replace them with equally empty variations.
4. Do not write generic, interchangeable paragraphs that could appear on any website. Every section must contain topic-specific information, useful reasoning, clear explanation, a relevant example or a practical implication.
5. Give the article a clear editorial angle. Do not merely list obvious facts. Explain why the subject matters, what readers commonly get wrong, what choices or trade-offs exist and what they should do with the information.
6. Make the piece attention-worthy and share-worthy through insight, relevance, strong storytelling where appropriate, memorable examples and useful detail—not sensationalism, clickbait, manufactured controversy or exaggerated claims.
7. Match the voice to the actual audience and business niche. Sound authoritative without being stiff, conversational without being casual, and persuasive without sounding like an advertisement. Do not invent a brand voice or company facts not supplied.
8. Open with a sharp, relevant lead. Establish the reader's problem, question, opportunity or stakes quickly. Avoid long throat-clearing introductions and repeating the title in different words.
9. Use natural sentence variation, strong verbs, precise nouns, meaningful transitions and a human editorial rhythm. Remove repetition, clichés, padding, vague claims and obvious AI phrasing.
10. Use descriptive, reader-focused headings. Headings must tell readers what the section actually explains; avoid generic headings such as "Introduction", "Benefits", "Conclusion" or "Final Thoughts" when a more informative heading is possible.
11. Finish with a purposeful conclusion that gives the reader a clear takeaway or next step. Do not mechanically repeat the introduction or summarize every heading.

RESEARCH, TRUST & SUBSTANCE:

12. Satisfy the real search intent and the reader's underlying question. Cover the important subtopics, entities, terminology, practical steps, examples, risks and decision points relevant to the subject.
13. Include specific, actionable detail. Where appropriate, explain how something works, who it is for, what it costs or requires, what to compare, common mistakes and how to make a better decision. Do not force irrelevant sections.
14. Use accurate, nuanced explanations. Distinguish established facts from estimates, opinions and recommendations. Never invent statistics, dates, studies, laws, quotations, expert credentials, testimonials, case studies, sources or company details.
15. Do not fabricate citations, references or external links. Cite only trustworthy sources supplied in the brief or genuinely verified through available research. If evidence is unavailable, phrase claims cautiously instead of pretending they are verified.
16. Avoid unsupported superlatives and absolute promises. Be transparent about limitations, regional differences and changing information where relevant.
17. Include 5–8 genuinely useful FAQs only when they add value and answer distinct follow-up questions. Do not use FAQs to pad the word count.

SEO & WORDPRESS QUALITY:

18. Prioritize readers first. Integrate the primary keyword naturally in the title, opening, a relevant heading and body where appropriate; never force exact-match repetition.
19. Use relevant secondary, semantic and long-tail terms naturally. Return at least five genuinely relevant keywords total, including the primary keyword.
20. Structure the article with one clear H1 followed by logical H2/H3 sections. Do not skip heading levels without reason. Keep paragraphs readable and use lists or tables only when they improve comprehension.
21. Write a compelling excerpt and accurate SEO meta title and description that reflect the actual article. Create a concise, readable, lowercase URL slug.
22. Target approximately the requested word count with meaningful substance. Do not hit the count by repeating points, inflating sentences or adding irrelevant sections.
23. The content field must contain clean, semantic, valid HTML suitable for WordPress. Do not include Markdown fences, scripts, styling or fabricated author/source boxes.
24. Return valid JSON only, with no commentary before or after it.

FINAL EDITORIAL SELF-REVIEW — DO THIS BEFORE RESPONDING:

- Would an experienced editor approve this headline, or does it sound like a generic SEO template?
- Does the first paragraph make a reader want to continue?
- Could any paragraph be pasted into an unrelated article? If yes, rewrite it with topic-specific substance.
- Does every section add a distinct insight, answer or practical value?
- Have clichés, repeated ideas, vague claims and artificial transitions been removed?
- Are factual claims responsible and supportable?
- Does the article sound like a knowledgeable human wrote it for this particular audience?
- Does the title accurately represent what the article delivers?

RETURN THIS JSON STRUCTURE:

{
  "title": "Specific, compelling, editorial-quality headline",
  "content": "<h1>Specific article headline</h1><p>Strong, topic-specific opening...</p>",
  "excerpt": "A concise, compelling and accurate summary for readers",
  "slug": "clear-topic-specific-url-slug",
  "metaTitle": "Accurate, compelling SEO title",
  "metaDescription": "Useful, natural search description that accurately reflects the article",
  "keywords": [
    "Primary keyword",
    "Relevant secondary keyword 1",
    "Relevant secondary keyword 2",
    "Relevant secondary keyword 3",
    "Relevant secondary keyword 4"
  ]
}

IMPORTANT: Return only one complete, valid JSON object. The article itself must be original, specific, reader-first and ready for a professional website after human review.
`;
}

// --------------------------------------------------
// JSON EXTRACTION
// --------------------------------------------------

function extractJSON(text: string): any {
  if (!text || !text.trim()) throw new Error("AI returned an empty response.");

  const cleaned = text.trim()
    .replace(/^\uFEFF/, "")
    .replace(/^\x60\x60\x60(?:json)?\s*/i, "")
    .replace(/\s*\x60\x60\x60$/i, "")
    .trim();

  // Find the first complete top-level JSON object. This avoids being
  // confused by braces inside HTML, examples or explanatory text.
  const start = cleaned.indexOf("{");
  if (start < 0) throw new Error("AI response did not contain a JSON object.");

  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (end < 0) {
    throw new Error("AI response was incomplete or cut off before the JSON object finished. Try a shorter article or another model.");
  }

  const candidate = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (firstError: any) {
    // Repair common formatting defects without changing article wording:
    // raw control characters inside strings and trailing commas.
    let repaired = "";
    inString = false;
    escaped = false;
    for (let i = 0; i < candidate.length; i++) {
      const ch = candidate[i];
      if (inString) {
        if (escaped) { repaired += ch; escaped = false; }
        else if (ch === "\\") { repaired += ch; escaped = true; }
        else if (ch === '"') { repaired += ch; inString = false; }
        else if (ch === "\n") repaired += "\\n";
        else if (ch === "\r") repaired += "\\r";
        else if (ch === "\t") repaired += "\\t";
        else repaired += ch;
      } else {
        repaired += ch;
        if (ch === '"') inString = true;
      }
    }
    repaired = repaired.replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(repaired);
    } catch {
      throw new Error("Gemini returned malformed JSON (not valid structured article data). Please retry; if it repeats, select a different Gemini model.");
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

  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts
    ?.map((part: any) => part.text || "")
    .join("");
  const finishReason = candidate?.finishReason || "Unknown";

  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason;
    throw new Error(`Gemini returned no article content. Finish reason: ${finishReason}; block reason: ${blockReason || "none"}.`);
  }
  if (finishReason === "MAX_TOKENS") {
    throw new Error("Gemini stopped because its output token limit was reached. Reduce the target word count or choose a model with a larger output limit.");
  }
  if (finishReason === "SAFETY") {
    throw new Error("Gemini blocked this response for safety reasons. Please adjust the topic or instructions and try again.");
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

// Detect provider quota exhaustion and throttling so backup agents can take over.
function isQuotaOrRateLimitError(error: any): boolean {
  const message = String(error?.message || error || "").toLowerCase();
  return /\b429\b|quota|resource_exhausted|rate.?limit|too many requests|requests per day|daily limit|billing.*limit/.test(message);
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
      // Quota/rate-limit errors will not recover by retrying the same provider.
      if (isQuotaOrRateLimitError(error)) break;

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


// Multi-agent collaboration with automatic provider failover.
// A provider that hits quota or fails is skipped for the remainder of this article run;
// the next configured provider takes over without interrupting the user.
export async function runMultiAgentGeneration(input: GenerationInput, providers: AIProvider[]): Promise<GeneratedArticle[]> {
  const active = (providers || []).filter((p) => p.enabled !== false && Boolean(p.apiKey?.trim()) && Boolean(p.model?.trim()));
  if (!active.length) throw new Error("No active AI providers are configured for the agent team.");
  const stages = [
    { role: "Research Agent", task: "Create a research-led draft based on search intent. Identify key subtopics, entities, reader questions and secondary keywords. Never invent statistics or sources." },
    { role: "SEO Strategist & Writer", task: "Improve the draft for search intent, topical completeness, headings, natural keyword coverage, examples and FAQs." },
    { role: "Editorial Agent", task: "Improve clarity, readability, flow, tone and remove repetition while preserving useful detail and the requested length." },
    { role: "Fact-Check & Final QA Agent", task: "Review factual consistency, qualify unsupported claims, check structure and produce the final publish-ready article. Never fabricate citations." },
  ];
  while (stages.length < active.length) {
    stages.push({ role: `Independent Review Agent \${stages.length + 1}`, task: "Independently review the current article for missing topical coverage, weak explanations, factual caution, SEO opportunities and human readability. Improve the article substantially without adding unsupported claims." });
  }
  let previous: GeneratedArticle | null = null;
  const unavailable = new Set<string>();
  const successfulStages: string[] = [];
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const agentInput: GenerationInput = {
      ...input,
      instructions: [input.instructions || "",
        `AGENT ROLE: \${stage.role}. \${stage.task}`,
        previous ? `PREVIOUS AGENT DRAFT — improve it, do not summarize:\\nTitle: \${previous.title}\\nExcerpt: \${previous.excerpt}\\nHTML: \${previous.content}\\nKeywords: \${previous.keywords.join(", ")}` : "Start with a research-led outline and complete first draft.",
        "Return the required JSON article object with valid WordPress HTML."
      ].filter(Boolean).join("\\n\\n"),
    };
    let stageResult: GeneratedArticle | null = null;
    const errors: string[] = [];
    const ordered = active.map((_, offset) => active[(i + offset) % active.length]);
    for (const provider of ordered) {
      const providerId = getProviderId(provider);
      if (unavailable.has(providerId)) continue;
      try {
        stageResult = await generateWithRetry(agentInput, provider);
        successfulStages.push(`${stage.role}: ${provider.model}`);
        break;
      } catch (error: any) {
        unavailable.add(providerId);
        errors.push(`${providerId}: ${error?.message || String(error)}`);
        console.warn(`Agent provider ${providerId} unavailable for this generation; switching to backup.`);
      }
    }
    if (!stageResult) throw new Error("All configured AI agents are temporarily unavailable. " + errors.join(" | "));
    previous = stageResult;
  }
  if (!previous) throw new Error("The multi-agent workflow did not produce an article.");
  return [{ ...previous, provider: "multi-agent-team", model: successfulStages.join(" → ") }];
}

// Revise an existing saved article using the user's instructions and one selected AI provider.
export async function reviseArticleWithAI(
  article: any,
  instructions: string,
  provider: AIProvider
): Promise<GeneratedArticle> {
  if (!article?.title || !article?.content) {
    throw new Error("The saved article is missing its title or content.");
  }
  if (!instructions?.trim()) {
    throw new Error("Enter custom instructions for the article revision.");
  }
  const plainText = String(article.content).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const estimatedWords = plainText ? plainText.split(" ").length : 2000;
  const revisionInput: GenerationInput = {
    topic: String(article.title),
    keyword: String(article.focus_keyword || article.focusKeyword || article.title),
    wordCount: Math.max(300, Math.min(10000, estimatedWords)),
    tone: "Preserve the article's existing tone unless the instructions request a change",
    instructions: [
      "TASK: Revise the existing article below. This is an EDIT of an existing saved article, not a new article from scratch.",
      "Apply the user's custom instructions carefully and return the complete revised article, not a summary or a list of suggestions.",
      "Preserve all accurate, useful information and the original subject. Do not invent facts, statistics, quotes, citations, sources, or links. Keep valid HTML suitable for WordPress.",
      "Keep the original article's SEO purpose and primary keyword unless the user explicitly asks to change them. Improve title, excerpt, SEO metadata and keywords when appropriate.",
      "EXISTING ARTICLE TITLE: " + String(article.title),
      "EXISTING EXCERPT: " + String(article.excerpt || ""),
      "EXISTING META TITLE: " + String(article.meta_title || article.metaTitle || ""),
      "EXISTING META DESCRIPTION: " + String(article.meta_description || article.metaDescription || ""),
      "EXISTING FOCUS KEYWORD: " + String(article.focus_keyword || article.focusKeyword || ""),
      "EXISTING KEYWORDS: " + String(article.keywords || ""),
      "USER'S CUSTOM EDITING INSTRUCTIONS: " + instructions.trim(),
      "EXISTING ARTICLE HTML (revise this content):\n" + String(article.content),
    ].join("\n\n"),
  };
  return generateWithRetry(revisionInput, provider);
}
