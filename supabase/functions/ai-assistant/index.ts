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

  // Reading Test Generator Parameters
  sourceType?: "url" | "file" | "text";
  sourceUrl?: string;
  sourceText?: string;
  passageCount?: number;
  questionCount?: number;
  difficultyLevel?: number; // 1 to 10
  timeLimitMinutes?: number;
  wordLimitConstraint?: string;
  regenerateGroupIndex?: number;
  existingPassages?: any[];
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
  "regenerate_question_group",
];

const TEACHER_ONLY_ACTIONS = [
  "generate_assistant_draft",
  "lesson_planner",
  "reading_listening_materials",
  "assignment_drafting",
  "convert_document_to_assignment",
  "regenerate_question_group",
];

function extractReadableTextFromHtml(html: string): string {
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");
  text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ");
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  text = text.replace(/<\/(p|div|h[1-6]|li|article|section|tr)>/gi, "\n");
  text = text.replace(/<br\s*[\/]?>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 25)
    .join("\n\n");
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
    // 2. Read and enforce strict payload size limit (max 1MB = 1,048,576 bytes)
    const rawBody = await req.text();
    if (rawBody.length > 1048576) {
      return new Response(
        JSON.stringify({
          error: "Payload too large. Maximum request size is 1MB.",
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

    let action = (body.action || "chat").trim().toLowerCase();
    if (action === "reading_test_generator" || action === "generatereadingtest" || action === "generate_reading") {
      action = "generate_reading_test";
    }
    if (action === "regenerate_reading_group" || action === "regenerate_group") {
      action = "regenerate_question_group";
    }

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

    const geminiModel = Deno.env.get("GEMINI_MODEL") || "gemini-1.5-flash";

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
        const testType = "Academic";
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

      case "generate_reading_test": {
        return new Response(
          JSON.stringify({
            error: "The AI Reading Test Generator in Library has been removed. Please use Smart Document Import or IELTS Exercise Library.",
            code: "ACTION_DEPRECATED",
          }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "regenerate_question_group": {
        const passageContent = (body.sourceText || body.documentText || "").slice(0, 10000);
        const qType = body.questionTypes?.[0] || "multiple_choice";
        const count = Math.max(1, Math.min(10, Number(body.questionCount) || 4));
        const diff = Math.max(1, Math.min(10, Number(body.difficultyLevel) || 5));

        systemInstruction = `You are an expert Cambridge IELTS Item Writer.
Your task is to generate ONE single Question Group of type "${qType}" with exactly ${count} questions based strictly on the provided passage.
Difficulty Level: ${diff}/10.

OUTPUT FORMAT:
Respond with a JSON object wrapped in \`\`\`json ... \`\`\`:
{
  "id": "qgroup_regenerated",
  "groupTitle": "Questions",
  "questionType": "${qType}",
  "instructions": "Instructions for ${qType}...",
  "wordLimit": "NO MORE THAN TWO WORDS",
  "headingsList": [],
  "featuresList": [],
  "questions": [
    {
      "id": "q1",
      "type": "${qType}",
      "prompt": "Question text...",
      "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
      "correctAnswer": "A",
      "explanation": "[Paragraph X]: Quotes evidence...",
      "points": 1
    }
  ]
}`;

        userPromptText = `Passage Text:
${passageContent}

Generate ${count} questions for type "${qType}".`;
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

    // 9. Call Gemini REST endpoint with bounded retries and model fallbacks
    const configuredPrimaryModel = Deno.env.get("GEMINI_MODEL") || "gemini-1.5-flash";
    const fallbackCandidates = ["gemini-1.5-flash-8b", "gemini-1.5-pro", "gemini-2.0-flash-exp"];
    const modelsToTry = [
      configuredPrimaryModel,
      ...fallbackCandidates.filter((m) => m !== configuredPrimaryModel),
    ];

    const isStructuredAction =
      action === "generate_reading_test" ||
      action === "regenerate_question_group" ||
      action === "convert_document_to_assignment";

    const generationConfig: Record<string, any> = {
      temperature: action === "writing_feedback" ? 0.2 : 0.4,
      maxOutputTokens: isStructuredAction ? 8192 : 4096,
      topP: 0.95,
    };

    if (isStructuredAction) {
      generationConfig.responseMimeType = "application/json";
    }

    const payloadBody = JSON.stringify({
      contents: contentsPayload,
      generationConfig,
    });

    const sanitize = (text: string): string => {
      if (!text) return "";
      let clean = text;
      if (geminiApiKey) {
        clean = clean.split(geminiApiKey).join("[REDACTED_API_KEY]");
      }
      if (token) {
        clean = clean.split(token).join("[REDACTED_TOKEN]");
      }
      clean = clean.replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_API_KEY]");
      clean = clean.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
      return clean.trim();
    };

    let geminiResponse: Response | null = null;
    let successfulModel = configuredPrimaryModel;
    let lastErrorStatus = 0;
    let lastErrorSanitized = "";
    let lastErrorCode = "PROVIDER_ERROR";

    // Iterate through models and retry transient errors
    modelLoop: for (const currentModel of modelsToTry) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent`;
      const MAX_ATTEMPTS_PER_MODEL = 2;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
        const GEMINI_TIMEOUT_MS = 38000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

        try {
          const res = await fetch(geminiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiApiKey,
            },
            body: payloadBody,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (res.ok) {
            geminiResponse = res;
            successfulModel = currentModel;
            break modelLoop;
          }

          // Inspect upstream error
          lastErrorStatus = res.status;
          const rawErr = await res.text();

          let pStatus = "";
          let pMsg = "";
          try {
            const parsed = JSON.parse(rawErr);
            if (parsed?.error) {
              pStatus = String(parsed.error.status || "");
              pMsg = String(parsed.error.message || "");
            }
          } catch {}

          lastErrorSanitized = sanitize(pMsg) || sanitize(rawErr.slice(0, 300));
          console.warn(
            `[ai-assistant] Model ${currentModel} attempt ${attempt} returned HTTP ${res.status}${
              pStatus ? ` (${pStatus})` : ""
            }: ${lastErrorSanitized}`
          );

          // Non-retryable client errors
          if (res.status === 400 || res.status === 401 || res.status === 403) {
            lastErrorCode = res.status === 400 ? "BAD_REQUEST" : "PERMISSION_DENIED";
            break modelLoop;
          }

          // If 503 (UNAVAILABLE / High Demand) or 429 (Resource Exhausted)
          if (res.status === 503 || res.status === 429) {
            lastErrorCode = res.status === 503 ? "PROVIDER_OVERLOADED" : "RATE_LIMITED";
            if (attempt < MAX_ATTEMPTS_PER_MODEL) {
              const backoffMs = Math.floor(1000 * Math.pow(1.6, attempt) + Math.random() * 400);
              await new Promise((r) => setTimeout(r, backoffMs));
              continue;
            }
            console.warn(`[ai-assistant] Failover: switching from ${currentModel} to next fallback model due to high demand...`);
            break;
          }

          break;
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          console.warn(`[ai-assistant] Network error on model ${currentModel} (attempt ${attempt}): ${fetchErr.message}`);
          if (attempt < MAX_ATTEMPTS_PER_MODEL) {
            await new Promise((r) => setTimeout(r, 1200 + Math.random() * 300));
            continue;
          }
          break;
        }
      }
    }

    if (!geminiResponse || !geminiResponse.ok) {
      let vietnameseMsg = "";
      if (lastErrorStatus === 503 || lastErrorCode === "PROVIDER_OVERLOADED") {
        vietnameseMsg =
          "Mô hình AI của Google hiện đang nhận lượng truy cập cao đột biến (HTTP 503 UNAVAILABLE: High Demand). Hệ thống đã giữ nguyên toàn bộ nội dung bạn vừa nhập, vui lòng bấm nút Thử lại sau ít giây.";
      } else if (lastErrorStatus === 429 || lastErrorCode === "RATE_LIMITED") {
        vietnameseMsg =
          "Hạn mức yêu cầu AI trong thời điểm này đã tạm thời đầy (HTTP 429 RATE LIMITED). Vui lòng đợi khoảng 20-30 giây rồi bấm Thử lại.";
      } else if (lastErrorStatus === 401 || lastErrorStatus === 403) {
        vietnameseMsg =
          "Khóa API Gemini chưa hợp lệ hoặc chưa được kích hoạt quyền truy cập trên Supabase. Vui lòng kiểm tra lại cấu hình.";
      } else {
        vietnameseMsg =
          `Dịch vụ AI phản hồi lỗi (HTTP ${lastErrorStatus || 502}): ${lastErrorSanitized || "Vui lòng thử lại sau giây lát."}`;
      }

      return new Response(
        JSON.stringify({
          error: vietnameseMsg,
          code: lastErrorCode,
          canRetry: [502, 503, 504, 429].includes(lastErrorStatus) || lastErrorCode === "PROVIDER_OVERLOADED",
          providerHttp: lastErrorStatus,
          providerMessage: lastErrorSanitized,
        }),
        {
          status: lastErrorStatus >= 500 ? 502 : 400,
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
      `[ai-assistant] action=${action} user=${user.id} role=${userRole} model=${successfulModel} out_len=${generatedDraft.length}`
    );

    let structuredData: any = null;
    if (
      action === "convert_document_to_assignment" ||
      action === "generate_reading_test" ||
      action === "regenerate_question_group"
    ) {
      try {
        let jsonStr = "";
        const jsonCodeFence = generatedDraft.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonCodeFence) {
          jsonStr = jsonCodeFence[1].trim();
        } else {
          // Extract outermost JSON object between first { and last }
          const firstBrace = generatedDraft.indexOf("{");
          const lastBrace = generatedDraft.lastIndexOf("}");
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            jsonStr = generatedDraft.substring(firstBrace, lastBrace + 1).trim();
          } else {
            jsonStr = generatedDraft.trim();
          }
        }

        // Clean trailing commas that break strict JSON parsing
        const cleanJsonStr = jsonStr.replace(/,\s*([\]}])/g, "$1");
        structuredData = JSON.parse(cleanJsonStr);
      } catch (parseErr) {
        console.warn("[ai-assistant] Failed to parse structuredData JSON:", parseErr);
      }
    }

    return new Response(
      JSON.stringify({
        draft: generatedDraft,
        structuredData,
        model: successfulModel,
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
