import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AssistantRequestBody {
  action: string;
  prompt: string;
  skill?: string;
  courseName?: string;
  studentName?: string;
  submissionsCount?: number;
  evidenceSummary?: string;
}

Deno.serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 2. Read and enforce strict payload size limit (max 32KB = 32,768 bytes)
    const rawBody = await req.text();
    if (rawBody.length > 32768) {
      return new Response(
        JSON.stringify({
          error: "Payload too large. Maximum request size is 32KB.",
          code: "PAYLOAD_TOO_LARGE",
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Authenticate Supabase caller from Bearer token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          error: "Missing or invalid Authorization header. You must be signed in.",
          code: "UNAUTHORIZED",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({
          error: "Server configuration error: missing Supabase environment variables.",
          code: "CONFIG_ERROR",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize authenticated Supabase client using caller's JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: "Invalid or expired session. Please sign in again.",
          code: "UNAUTHORIZED",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Retrieve authoritative user role from public.profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({
          error: "User profile not found. Please complete profile setup.",
          code: "PROFILE_NOT_FOUND",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Parse and validate JSON request body
    let body: AssistantRequestBody;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON request body.", code: "BAD_REQUEST" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      action,
      prompt,
      skill = "all",
      courseName,
      studentName,
      submissionsCount = 0,
      evidenceSummary,
    } = body;

    // Validate action
    const ALLOWED_ACTIONS = ["generate_assistant_draft"];
    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return new Response(
        JSON.stringify({
          error: `Unsupported action: '${action}'. Allowed actions: ${ALLOWED_ACTIONS.join(", ")}`,
          code: "INVALID_ACTION",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-side teacher authorization enforcement
    if (action === "generate_assistant_draft" && profile.role !== "teacher") {
      return new Response(
        JSON.stringify({
          error: "Forbidden: AI Teaching Assistant requires an authorized teacher role.",
          code: "FORBIDDEN",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate prompt input length (5 to 3000 characters)
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5 || prompt.length > 3000) {
      return new Response(
        JSON.stringify({
          error: "Prompt must be a string between 5 and 3,000 characters.",
          code: "INVALID_PROMPT",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Read server-only GEMINI_API_KEY secret
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({
          error: "AI service configuration error: GEMINI_API_KEY secret is not configured in Supabase Edge Functions.",
          code: "MISSING_API_KEY",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Configurable Gemini model identifier (defaulting to official gemini-3.8-flash)
    const geminiModel = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";

    // Build grounded system instructions & context
    const systemInstruction = `You are an expert IELTS Academic & General Training Master Teacher and Examiner Assistant.
Your mission is to assist an independent IELTS teacher by generating high-quality, actionable, evidence-based lesson ideas, recurring error summaries, and practice drills.

STRICT OPERATIONAL RULES:
1. Every response MUST begin with the exact header:
[AI ASSISTANT DRAFT — Teacher Review Required]
2. Ground all pedagogical observations in official IELTS band criteria (Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy, Fluency, Pronunciation).
3. Explicitly state that this draft is formative and requires teacher review and adaptation before use.
4. If there are 0 logged student submissions, explicitly warn the teacher that recommendations are generic templates rather than empirical cohort findings.
5. Provide structured, concise markdown output with:
   - 1. Context & Linguistic Observations
   - 2. Three Concrete IELTS Classroom Drills / Exercises (with timeframes)
   - 3. Teacher Action Note`;

    const userPromptText = `Teacher Request:
"${prompt.trim()}"

Context Information:
- Scoped Course: ${courseName ? courseName.slice(0, 100) : "All Courses"}
- Target Scope: ${studentName ? studentName.slice(0, 100) : "Whole Class Cohort"}
- IELTS Skill: ${skill.toUpperCase()}
- Student Submissions Logged in Scope: ${Number(submissionsCount) || 0}
${evidenceSummary ? `- Evidence Summary: ${evidenceSummary.slice(0, 1000)}` : ""}

Generate a professional, structured IELTS teaching draft addressing the request.`;

    // 7. Call Gemini REST endpoint with timeout and sanitized error handling
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: systemInstruction + "\n\n" + userPromptText,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
            topP: 0.95,
          },
        }),
        signal: controller.signal,
      });
    } catch (networkErr: any) {
      clearTimeout(timeoutId);
      if (networkErr.name === "AbortError") {
        return new Response(
          JSON.stringify({
            error: "Gemini API request timed out after 25 seconds. Please try again.",
            code: "TIMEOUT",
          }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          error: "Failed to connect to Google Gemini API provider.",
          code: "NETWORK_ERROR",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // 8. Handle upstream quota & error codes without leaking secrets or student data
    if (geminiResponse.status === 429) {
      return new Response(
        JSON.stringify({
          error: "Google AI Studio free-tier rate limit reached. Please wait 60 seconds before requesting another draft.",
          code: "RATE_LIMITED",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!geminiResponse.ok) {
      return new Response(
        JSON.stringify({
          error: `AI provider error (HTTP ${geminiResponse.status}). Please verify prompt or model configuration.`,
          code: "PROVIDER_ERROR",
        }),
        {
          status: geminiResponse.status >= 500 ? 502 : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const geminiData = await geminiResponse.json();
    const generatedDraft = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedDraft) {
      const blockReason =
        geminiData.promptFeedback?.blockReason ||
        geminiData.candidates?.[0]?.finishReason;

      const errorMsg = blockReason
        ? `Content generation restricted by AI provider safety filters (${blockReason}). Please rephrase prompt.`
        : "AI provider returned an empty draft response. Please try again.";

      return new Response(
        JSON.stringify({
          error: errorMsg,
          code: blockReason ? "CONTENT_FILTERED" : "EMPTY_RESPONSE",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log high-level audit metric only (no student content or API keys)
    console.log(
      `[ai-assistant] user=${user.id} role=${profile.role} model=${geminiModel} in_len=${prompt.length} out_len=${generatedDraft.length}`
    );

    return new Response(
      JSON.stringify({
        draft: generatedDraft,
        model: geminiModel,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err.message || "An unexpected error occurred in AI assistant.",
        code: "INTERNAL_ERROR",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
