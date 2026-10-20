import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ChatHistoryMessage {
  role: "user" | "assistant" | "model";
  content: string;
}

interface AssistantRequestBody {
  action: string;
  prompt?: string;
  message?: string;
  history?: ChatHistoryMessage[];
  skill?: string;
  courseName?: string;
  studentName?: string;
  submissionsCount?: number;
  evidenceSummary?: string;

  // Specialized Workflow Parameters
  taskType?: "task1" | "task2";
  testType?: "academic" | "general";
  targetBand?: string;
  currentBand?: string;
  duration?: string;
  objectives?: string;
  topic?: string;
  constraints?: string;
  essayText?: string;
  speakingPart?: "part1" | "part2" | "part3";
  studentLevel?: string;
  questionTypes?: string[];
  passageLength?: string;
  focus?: "vocabulary" | "grammar" | "both";
  difficulty?: string;
  instructions?: string;

  // Document Import & Conversion Parameters
  documentText?: string;
  conversionMode?: "preserve_questions" | "generate_new" | "mixed";
  sourceDocumentName?: string;
}

const ALLOWED_ACTIONS = [
  "generate_assistant_draft",
  "chat",
  "lesson_planner",
  "writing_feedback",
  "speaking_practice",
  "reading_listening_materials",
  "vocabulary_grammar",
  "assignment_drafting",
  "convert_document_to_assignment",
];

const TEACHER_ONLY_ACTIONS = [
  "generate_assistant_draft",
  "lesson_planner",
  "reading_listening_materials",
  "assignment_drafting",
  "convert_document_to_assignment",
];

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
    // 2. Read and enforce strict payload size limit (max 64KB = 65,536 bytes)
    const rawBody = await req.text();
    if (rawBody.length > 65536) {
      return new Response(
        JSON.stringify({
          error: "Payload too large. Maximum request size is 64KB.",
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

    // 4. Retrieve authoritative user role from public.profiles using validated JWT identity.
    // Never trust user_metadata.role or hardcoded claims. Distinguish query errors from missing profiles.
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const profileClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey)
      : supabase;

    const { data: profile, error: profileError } = await profileClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[ai-assistant] Database error querying user profile:", profileError);
      return new Response(
        JSON.stringify({
          error: "Database error while verifying user profile. Please try again later.",
          code: "PROFILE_QUERY_ERROR",
          details: profileError.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile) {
      return new Response(
        JSON.stringify({
          error: "User profile not found. Please complete profile setup before using the AI Assistant.",
          code: "PROFILE_NOT_FOUND",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userRole = profile.role === "teacher" ? "teacher" : "student";

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

    const action = body.action || "chat";
    if (!ALLOWED_ACTIONS.includes(action)) {
      return new Response(
        JSON.stringify({
          error: `Unsupported action: '${action}'. Allowed actions: ${ALLOWED_ACTIONS.join(", ")}`,
          code: "INVALID_ACTION",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enforce role authorization for teacher-only workflows
    if (TEACHER_ONLY_ACTIONS.includes(action) && userRole !== "teacher") {
      return new Response(
        JSON.stringify({
          error: `Action '${action}' requires teacher privileges. You are registered as '${userRole}'.`,
          code: "FORBIDDEN",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    const geminiModel = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";

    // 7. Assemble task-specific System Instructions & User Prompts
    let systemInstruction = "";
    let userPromptText = "";

    const courseContextStr = body.courseName ? `Course: ${body.courseName.slice(0, 80)}` : "Course: General / Independent Cohort";
    const studentContextStr = body.studentName ? `Target Student: ${body.studentName.slice(0, 80)}` : "Cohort: Whole Class";

    switch (action) {
      case "chat": {
        const rawMsg = (body.message || body.prompt || "").trim();
        if (rawMsg.length < 2) {
          return new Response(
            JSON.stringify({ error: "Message cannot be empty.", code: "INVALID_PROMPT" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        systemInstruction = `You are Gemini AI, a master IELTS Teacher and pedagogical assistant for independent educators.
Your mission is to provide expert, grounded, encouraging, and highly practical assistance to teachers.
You specialize in IELTS Academic & General Training (Band 1.0 to 9.0), Cambridge assessment scales, curriculum design, classroom management, and student feedback.

OPERATIONAL RULES:
1. Always maintain an academic, respectful, and practical tone.
2. Structure your explanations clearly with markdown headings, bullet points, and tables where helpful.
3. Every lesson plan, grading estimate, or rubric generated MUST be identified as a formative draft requiring teacher approval.
4. If asked about band descriptors, adhere strictly to the official British Council / IDP / Cambridge IELTS Assessment Criteria (Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy).`;

        userPromptText = `Teacher Query:
"${rawMsg}"

Current Teaching Context:
- ${courseContextStr}
- ${studentContextStr}
- Skill: ${body.skill ? body.skill.toUpperCase() : "GENERAL"}`;
        break;
      }

      case "lesson_planner": {
        const skill = (body.skill || "Writing").toUpperCase();
        const duration = body.duration || "60 minutes";
        const currentBand = body.currentBand || "5.5";
        const targetBand = body.targetBand || "7.0";
        const objectives = body.objectives || "Master cohesive devices and paragraph structuring";
        const topic = body.topic || "Environmental Protection and Renewable Energy";
        const constraints = body.constraints || "Mixed-ability classroom, interactive group work";

        systemInstruction = `You are an expert IELTS Curriculum Specialist.
Generate a comprehensive, structured lesson plan for an independent IELTS teacher.

REQUIRED STRUCTURE:
# [AI ASSISTANT DRAFT — Teacher Review Required]
## IELTS Lesson Plan: ${topic} (${skill})
- **Target Band Progression:** Band ${currentBand} → Band ${targetBand}
- **Duration:** ${duration}
- **Primary Learning Objectives:** ${objectives}

### 1. Preparation & Materials Needed
List essential handouts, audio tracks, or whiteboards.

### 2. Detailed Timed Stages
Break down the lesson into timed phases (e.g., Warm-up/Lead-in 10m, Guided Input 20m, Controlled Practice 15m, Free Production 15m). Include exact teacher instructions and student actions.

### 3. Concrete Classroom Drills & Activities
Provide at least 2 practical drills with target band linguistic expectations.

### 4. Formative Assessment Wrap-up & Homework Assignment
A quick check for understanding and an actionable homework task aligned with the lesson objectives.`;

        userPromptText = `Please generate the full structured lesson plan based on the parameters above. Constraints: ${constraints}.`;
        break;
      }

      case "writing_feedback": {
        const taskType = body.taskType === "task1" ? "Writing Task 1" : "Writing Task 2";
        const testType = body.testType === "general" ? "General Training" : "Academic";
        const targetBand = body.targetBand || "7.0";
        const essayText = (body.essayText || body.prompt || "").trim();

        if (essayText.length < 30) {
          return new Response(
            JSON.stringify({
              error: "Please provide the student's essay text (at least 30 characters) to analyze.",
              code: "ESSAY_TOO_SHORT",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const criteriaList =
          body.taskType === "task1"
            ? "1. Task Achievement (TA)\n2. Coherence and Cohesion (CC)\n3. Lexical Resource (LR)\n4. Grammatical Range and Accuracy (GRA)"
            : "1. Task Response (TR)\n2. Coherence and Cohesion (CC)\n3. Lexical Resource (LR)\n4. Grammatical Range and Accuracy (GRA)";

        systemInstruction = `You are a certified IELTS Writing Senior Examiner and Teacher Coach.
Analyze the submitted student essay according to official IELTS public band descriptors.

REQUIRED OUTPUT STRUCTURE:
# [AI ASSISTANT DRAFT — Teacher Review Required]
> **Formative Assessment Notice:** AI-generated band scores and feedback are diagnostic estimates designed for teacher evaluation and do not represent official IELTS certificates.

## 1. Overall Evaluation & Diagnostic Band Estimate
- **Estimated Band Score:** [Estimate a band range, e.g., Band 6.5]
- **Target Band:** Band ${targetBand}
- **Key Summary:** 2-3 concise sentences summarizing student performance.

## 2. Criterion-by-Criterion Detailed Feedback
Evaluate each criterion with explicit strengths and weaknesses:
${criteriaList}

## 3. Evidence-Based Examples & Corrections
Cite actual sentences from the essay and show recommended revisions:
- **Original:** "..."
- **Analysis:** (Why it limits the score)
- **Teacher Recommended Revision:** "..."

## 4. High-Yield Lexical & Grammatical Upgrades
Provide a table or bulleted list of 5 advanced collocations/structures relevant to this specific topic.

## 5. Next Steps for Student Revision
Actionable directives the teacher can assign for the second draft.`;

        userPromptText = `Evaluate this ${testType} ${taskType} essay:
---
${essayText}
---`;
        break;
      }

      case "speaking_practice": {
        const part = body.speakingPart || "part2";
        const topic = body.topic || "Hometown and Urban Development";
        const targetBand = body.targetBand || "7.5";

        systemInstruction = `You are an elite IELTS Speaking Coach and Examiner.
Generate an intensive, ready-to-teach Speaking Practice Module.

REQUIRED STRUCTURE:
# [AI ASSISTANT DRAFT — Teacher Review Required]
## IELTS Speaking Practice: ${topic} (${part.toUpperCase()})
- **Target Band:** Band ${targetBand}

### 1. Authentic Interview Questions & Follow-ups
${part === "part1" ? "Provide 6 realistic Part 1 introduction & interview questions." : part === "part2" ? "Provide a standard IELTS Speaking Cue Card (You should say: 4 bullet points)." : "Provide 5 in-depth, two-way abstract discussion questions."}

### 2. High-Scoring Model Answer (Band 8.0+)
Provide a realistic transcript of a high-scoring candidate response showcasing natural discourse markers, idioms, and complex structures.

### 3. Key Idiomatic Vocabulary & Collocations
List 6 topic-specific lexical items with definitions and example usages in spoken English.

### 4. Teacher Assessment Rubric Pointers
Checklist for Fluency & Coherence, Lexical Resource, Grammatical Range, and Pronunciation.`;

        userPromptText = `Generate the IELTS Speaking practice pack for ${part.toUpperCase()} on topic: "${topic}".`;
        break;
      }

      case "reading_listening_materials": {
        const skill = body.skill === "listening" ? "Listening" : "Reading";
        const topic = body.topic || "Technological Advancements in Modern Agriculture";
        const targetBand = body.targetBand || "7.0";
        const qTypes = body.questionTypes && body.questionTypes.length > 0
          ? body.questionTypes.join(", ")
          : "Multiple Choice, True/False/Not Given, Sentence Completion";

        systemInstruction = `You are an IELTS Test Materials Developer.
Generate classroom practice materials for IELTS ${skill}.

REQUIRED STRUCTURE:
# [AI ASSISTANT DRAFT — Teacher Review Required]
## IELTS ${skill} Practice Module: ${topic} (Target Band ${targetBand})

### Section A: ${skill === "reading" ? "Academic Reading Passage (~450-550 words)" : "Listening Audio Script (~400 words)"}
Provide an authentic, engaging academic text with numbered paragraphs.

### Section B: Student Question Paper
Provide 6-8 authentic questions conforming strictly to requested question types: ${qTypes}.

---
### Section C: Teacher Answer Key & Explanations (SEPARATE SECTION)
Clearly list correct answers with exact line/sentence citations from Section A explaining why each answer is correct and why common distractors are incorrect.`;

        userPromptText = `Create the complete IELTS ${skill} test passage and questions for topic: "${topic}".`;
        break;
      }

      case "vocabulary_grammar": {
        const topic = body.topic || "Global Climate Change and Environmental Policy";
        const targetBand = body.targetBand || "7.5";
        const focus = body.focus || "both";

        systemInstruction = `You are a Senior IELTS English Language Specialist.
Generate a targeted Vocabulary & Grammar Mastery Kit for IELTS candidates.

REQUIRED STRUCTURE:
# [AI ASSISTANT DRAFT — Teacher Review Required]
## IELTS Language Toolkit: ${topic} (Target Band ${targetBand})

### 1. Essential C1/C2 Academic Collocations & Phrasal Expressions
10 high-impact collocations with clear definitions and authentic IELTS Academic sample sentences.

### 2. Advanced Grammatical Structures
Provide 4 advanced syntactic patterns relevant to IELTS Writing and Speaking (e.g., Inversion, Conditionals, Nominalisation, Participle Clauses) with formula and examples.

### 3. Student Practice Drills
5 fill-in-the-blank or sentence transformation exercises testing the target language.

### 4. Teacher Answer Key & Usage Notes
Complete solutions with explanatory notes for classroom instruction.`;

        userPromptText = `Generate the vocabulary and grammar kit for topic: "${topic}" (Focus: ${focus}).`;
        break;
      }

      case "assignment_drafting": {
        const skill = (body.skill || "writing").toUpperCase();
        const topic = body.topic || "Public Transport Infrastructure";
        const targetBand = body.targetBand || "7.0";
        const instructions = body.instructions || "Standard IELTS exam timed assignment";

        systemInstruction = `You are an IELTS Educational Assessment Designer.
Draft a complete, classroom-ready IELTS Assignment.

REQUIRED STRUCTURE:
# [AI ASSISTANT DRAFT — Teacher Review Required]
## Assignment Title: IELTS ${skill} Practice Task — ${topic}
- **Target Band:** Band ${targetBand}
- **Mode:** Teacher Reviewed Assignment Draft

### 1. Student Instructions & Assignment Brief
Clear instructions, suggested time limit, and submission guidelines.

### 2. Core Prompt / Task Description
The official task prompt (e.g. essay prompt or cue card).

### 3. Teacher Marking Rubric
Clear band descriptors for scoring the assignment.

### 4. Model Band 8.0+ Benchmark Response
Full benchmark response demonstrating exemplary performance.`;

        userPromptText = `Draft the complete assignment for skill: ${skill}, topic: "${topic}", instructions: "${instructions}".`;
        break;
      }

      case "convert_document_to_assignment": {
        const rawDoc = (body.documentText || "").slice(0, 24000);
        const mode = body.conversionMode || "preserve_questions";
        const targetSkill = body.skill || "reading";
        const band = body.targetBand || "6.5 - 7.5";

        systemInstruction = `You are an expert IELTS Assessment Architect and Curriculum Specialist.
Your mission is to analyze imported educational text and convert it into a structured IELTS assignment draft with interactive questions.

CONVERSION MODE: "${mode}"
- If mode is "preserve_questions": Faithfully extract all existing questions, answer options, and answer keys from the source document. Do NOT invent new questions.
- If mode is "generate_new": Analyze the reading passage/material and generate brand new authentic IELTS questions targeting Band ${band}.
- If mode is "mixed": Extract existing questions and generate complementary IELTS questions to form a comprehensive practice set.

STRICT OPERATIONAL RULES:
1. Preserve fidelity: NEVER rewrite or distort original questions when preserving.
2. Label sources: Mark each question's "source" property as "extracted_from_doc" or "ai_generated".
3. Answer keys:
   - If an answer key is present in the source text, set "answerKeyConfidence" to "high" and "source" to "extracted_from_doc".
   - If an answer key is deduced or generated by AI, set "answerKeyConfidence" to "needs_teacher_review" or "medium".
4. Supported IELTS Question Types:
   - "multiple_choice": Standard 4-choice questions with "options" array.
   - "multiple_select": Questions requiring 2 or more correct choices.
   - "true_false_not_given": Academic reading factual confirmation.
   - "yes_no_not_given": Writer's claims/views confirmation.
   - "matching": Matching headings, features, or sentence endings with "matchingPairs" [{left: "...", right: "..."}].
   - "fill_in_the_blank": Summary/diagram completion.
   - "sentence_completion": Standard sentence completion.
   - "short_answer": Direct question with word limit (e.g., NO MORE THAN THREE WORDS).
   - "essay": Extended written prompt.

5. OUTPUT FORMAT:
You MUST respond with a valid JSON object wrapped inside a \`\`\`json ... \`\`\` code block adhering to this structure:
{
  "title": "Clear IELTS Assignment Title",
  "skill": "${targetSkill}",
  "instructions": "Clear step-by-step instructions for students...",
  "readingPassage": "Full reading passage or source study text if applicable...",
  "writingPrompt": "Writing prompt if applicable...",
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "prompt": "Question text...",
      "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
      "correctAnswer": "A",
      "explanation": "Citation from passage and explanation...",
      "points": 1,
      "source": "extracted_from_doc",
      "answerKeyConfidence": "high"
    }
  ],
  "teacherNotes": "Brief notes for teacher highlighting any ambiguous items or questions requiring verification."
}`;

        userPromptText = `Please analyze and convert this imported educational document into an interactive IELTS assignment:

Source Document Name: ${body.sourceDocumentName || "Uploaded Document"}
Course Scoped: ${courseContextStr}

--- START DOCUMENT CONTENT ---
${rawDoc}
--- END DOCUMENT CONTENT ---`;
        break;
      }

      case "generate_assistant_draft":
      default: {
        const promptText = (body.prompt || "").trim();
        systemInstruction = `You are an expert IELTS Academic & General Training Master Teacher and Examiner Assistant.
Your mission is to assist an independent IELTS teacher by generating high-quality, actionable, evidence-based lesson ideas, recurring error summaries, and practice drills.

STRICT OPERATIONAL RULES:
1. Every response MUST begin with the exact header:
# [AI ASSISTANT DRAFT — Teacher Review Required]
2. Ground all pedagogical observations in official IELTS band criteria.
3. Explicitly state that this draft is formative and requires teacher review and adaptation before use.
4. Provide structured, concise markdown output with:
   - 1. Context & Linguistic Observations
   - 2. Three Concrete IELTS Classroom Drills / Exercises (with timeframes)
   - 3. Teacher Action Note`;

        userPromptText = `Teacher Request:
"${promptText}"

Context Information:
- Scoped Course: ${courseContextStr}
- Target Scope: ${studentContextStr}
- IELTS Skill: ${body.skill ? body.skill.toUpperCase() : "ALL"}
- Student Submissions Logged in Scope: ${Number(body.submissionsCount) || 0}
${body.evidenceSummary ? `- Evidence Summary: ${body.evidenceSummary.slice(0, 1000)}` : ""}`;
        break;
      }
    }

    // 8. Prepare Gemini contents payload
    const contentsPayload: any[] = [];

    // If chat history is provided, include recent turns
    if (action === "chat" && Array.isArray(body.history) && body.history.length > 0) {
      const recentHistory = body.history.slice(-8); // keep last 8 turns
      for (const msg of recentHistory) {
        if (!msg.content) continue;
        const geminiRole = msg.role === "assistant" || msg.role === "model" ? "model" : "user";
        contentsPayload.push({
          role: geminiRole,
          parts: [{ text: msg.content.slice(0, 2500) }],
        });
      }
    }

    // Add current user prompt
    contentsPayload.push({
      role: "user",
      parts: [
        {
          text: systemInstruction + "\n\n---\n\n" + userPromptText,
        },
      ],
    });

    // 9. Call Gemini REST endpoint with timeout
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000); // 28s timeout

    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify({
          contents: contentsPayload,
          generationConfig: {
            temperature: action === "writing_feedback" ? 0.2 : 0.4,
            maxOutputTokens: 3072,
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
            error: "Gemini API request timed out after 28 seconds. Please try again.",
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

    // 10. Handle upstream errors
    if (geminiResponse.status === 429) {
      return new Response(
        JSON.stringify({
          error: "Google AI Studio free-tier rate limit reached. Please wait 60 seconds before requesting another response.",
          code: "RATE_LIMITED",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error(`[ai-assistant] Gemini provider error: ${geminiResponse.status} - ${errText}`);
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
        ? `Content generation restricted by AI safety filters (${blockReason}). Please rephrase prompt.`
        : "AI provider returned an empty draft response. Please try again.";

      return new Response(
        JSON.stringify({
          error: errorMsg,
          code: blockReason ? "CONTENT_FILTERED" : "EMPTY_RESPONSE",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `[ai-assistant] action=${action} user=${user.id} role=${userRole} model=${geminiModel} out_len=${generatedDraft.length}`
    );

    let structuredData: any = null;
    if (action === "convert_document_to_assignment") {
      try {
        const jsonMatch = generatedDraft.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : generatedDraft.trim();
        structuredData = JSON.parse(jsonStr);
      } catch (parseErr) {
        console.warn("[ai-assistant] Failed to parse structuredData JSON:", parseErr);
      }
    }

    return new Response(
      JSON.stringify({
        draft: generatedDraft,
        structuredData,
        model: geminiModel,
        action,
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
