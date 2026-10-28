import { supabase, isSupabaseConfigured } from './supabase';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  action?: string;
}

export interface GenerateDraftParams {
  prompt: string;
  skill?: string;
  courseName?: string;
  studentName?: string;
  submissionsCount?: number;
  evidenceSummary?: string;
}

export interface GenerateDraftResult {
  draft: string;
  model: string;
  action?: string;
  structuredData?: any;
}

export interface DocumentConversionParams {
  documentText: string;
  sourceDocumentName?: string;
  conversionMode?: 'preserve_questions' | 'generate_new' | 'mixed';
  skill?: string;
  targetBand?: string;
  courseName?: string;
}

export interface LessonPlannerParams {
  skill: string;
  currentBand: string;
  targetBand: string;
  duration: string;
  topic: string;
  objectives: string;
  constraints?: string;
  courseName?: string;
}

export interface WritingFeedbackParams {
  taskType: 'task1' | 'task2';
  testType: 'academic' | 'general';
  targetBand: string;
  essayText: string;
  prompt?: string;
  courseName?: string;
  studentName?: string;
}

export interface SpeakingPracticeParams {
  speakingPart: 'part1' | 'part2' | 'part3';
  topic: string;
  targetBand: string;
  studentLevel?: string;
  courseName?: string;
}

export interface ReadingListeningParams {
  skill: 'reading' | 'listening';
  topic: string;
  targetBand: string;
  questionTypes?: string[];
  courseName?: string;
}

export interface VocabularyGrammarParams {
  topic: string;
  targetBand: string;
  focus: 'vocabulary' | 'grammar' | 'both';
  difficulty?: string;
  courseName?: string;
}

export interface AssignmentDraftParams {
  skill: string;
  topic: string;
  targetBand: string;
  instructions?: string;
  courseName?: string;
}

export interface ChatParams {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  courseName?: string;
  studentName?: string;
  skill?: string;
}

/**
 * Universal invoker for the secure Supabase Edge Function 'ai-assistant'.
 * The Gemini API key is accessed exclusively server-side and is never exposed to the client.
 */
async function invokeAiAssistant(action: string, payload: Record<string, any>): Promise<GenerateDraftResult> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Please connect a valid Supabase project.');
  }

  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: {
      action,
      ...payload,
    },
  });

  if (error) {
    let message = error.message;

    // Parse Edge Function response body if available
    if ('context' in error && (error as any).context?.json) {
      try {
        const body = await (error as any).context.json();
        if (body?.error) {
          message = body.error;
        }
      } catch {
        // Fall back to error.message
      }
    }

    throw new Error(message || 'Failed to communicate with Gemini AI assistant.');
  }

  if (!data || !data.draft) {
    throw new Error('Gemini AI assistant returned an empty response. Please try again.');
  }

  return {
    draft: data.draft,
    model: data.model || 'gemini-1.5-flash',
    action: data.action,
    structuredData: data.structuredData,
  };
}

/**
 * Interactive Chat with Gemini
 */
export async function sendGeminiChat(params: ChatParams): Promise<GenerateDraftResult> {
  return invokeAiAssistant('chat', {
    message: params.message,
    history: params.history,
    courseName: params.courseName,
    studentName: params.studentName,
    skill: params.skill,
  });
}

/**
 * Specialized: Lesson Planner
 */
export async function generateLessonPlan(params: LessonPlannerParams): Promise<GenerateDraftResult> {
  return invokeAiAssistant('lesson_planner', params);
}

/**
 * Specialized: IELTS Writing Evaluator
 */
export async function generateWritingFeedback(params: WritingFeedbackParams): Promise<GenerateDraftResult> {
  return invokeAiAssistant('writing_feedback', params);
}

/**
 * Specialized: Speaking Practice Module
 */
export async function generateSpeakingPractice(params: SpeakingPracticeParams): Promise<GenerateDraftResult> {
  return invokeAiAssistant('speaking_practice', params);
}

/**
 * Specialized: Reading and Listening Materials Developer
 */
export async function generateReadingListeningMaterials(params: ReadingListeningParams): Promise<GenerateDraftResult> {
  return invokeAiAssistant('reading_listening_materials', params);
}

/**
 * Specialized: Vocabulary and Grammar Toolkit
 */
export async function generateVocabularyGrammar(params: VocabularyGrammarParams): Promise<GenerateDraftResult> {
  return invokeAiAssistant('vocabulary_grammar', params);
}

/**
 * Specialized: Assignment Drafting
 */
export async function generateAssignmentDraft(params: AssignmentDraftParams): Promise<GenerateDraftResult> {
  return invokeAiAssistant('assignment_drafting', params);
}

/**
 * Legacy/General Draft Generator (backward compatibility)
 */
export async function generateAiAssistantDraft(params: GenerateDraftParams): Promise<GenerateDraftResult> {
  return invokeAiAssistant('generate_assistant_draft', params);
}

/**
 * Smart Document Conversion: Convert document text to structured IELTS assignment
 */
export async function convertDocumentToAssignment(params: DocumentConversionParams): Promise<GenerateDraftResult> {
  return invokeAiAssistant('convert_document_to_assignment', params);
}

export interface GenerateReadingTestParams {
  sourceType: 'url' | 'file' | 'text';
  sourceUrl?: string;
  sourceText?: string;
  sourceDocumentName?: string;
  topic?: string;
  passageCount: number;
  questionTypes: string[];
  questionCount: number;
  difficultyLevel: number;
  timeLimitMinutes?: number;
  wordLimitConstraint?: string;
}

export interface RegenerateQuestionGroupParams {
  passageText: string;
  questionType: string;
  questionCount: number;
  difficultyLevel: number;
}

/**
 * Generate a complete, authentic IELTS Reading test with AI
 */
export async function generateReadingTestWithAi(params: GenerateReadingTestParams): Promise<GenerateDraftResult> {
  try {
    return await invokeAiAssistant('generate_reading_test', params);
  } catch (err: any) {
    const errMsg = String(err?.message || '');
    if (errMsg.includes('Unsupported action') || errMsg.includes('generate_reading_test')) {
      console.warn('generate_reading_test not deployed on Edge Function yet, falling back to convert_document_to_assignment', err);
      
      const instructions = `Generate an authentic IELTS Reading practice test with ${params.passageCount} passage(s) and ${params.questionCount} questions. Difficulty Level: ${params.difficultyLevel}/10. Supported types: ${params.questionTypes.join(', ')}. Include explanations citing paragraph letters.`;

      const fallbackResult = await invokeAiAssistant('convert_document_to_assignment', {
        documentText: params.sourceText || params.sourceUrl || params.topic || 'IELTS Reading Passage',
        sourceDocumentName: params.sourceDocumentName || 'Reading Material',
        conversionMode: 'generate_new',
        skill: 'reading',
        targetBand: params.difficultyLevel >= 8 ? '8.0 - 9.0' : params.difficultyLevel >= 6 ? '6.5 - 7.5' : '5.0 - 6.0',
        instructions,
      });

      let structured = fallbackResult.structuredData;
      if (!structured && fallbackResult.draft) {
        try {
          const match = fallbackResult.draft.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match) structured = JSON.parse(match[1]);
        } catch {}
      }

      if (structured) {
        if (structured.questions && (!structured.passages || structured.passages.length === 0)) {
          const passageText = structured.readingPassage || params.sourceText || '';
          const groupsMap: Record<string, any[]> = {};
          structured.questions.forEach((q: any) => {
            const t = q.type || 'multiple_choice';
            if (!groupsMap[t]) groupsMap[t] = [];
            groupsMap[t].push(q);
          });

          const questionGroups = Object.entries(groupsMap).map(([qType, qList], gIdx) => ({
            id: `qgroup_1_${gIdx + 1}`,
            groupTitle: `Questions ${gIdx + 1}`,
            questionType: qType,
            instructions: `Answer the questions based on the passage above.`,
            questions: qList,
          }));

          structured = {
            title: structured.title || params.topic || 'IELTS Reading Practice Test',
            topic: params.topic || 'Academic Studies',
            difficultyLevel: params.difficultyLevel,
            timeLimitMinutes: params.timeLimitMinutes || 20 * params.passageCount,
            passages: [
              {
                passageIndex: 1,
                title: structured.title || 'Reading Passage 1',
                content: passageText,
                questionGroups,
                questions: structured.questions,
              },
            ],
          };
        }
      }

      return {
        draft: fallbackResult.draft,
        model: fallbackResult.model,
        action: 'generate_reading_test_fallback',
        structuredData: structured,
      };
    }
    throw err;
  }
}

/**
 * Regenerate an individual question group with AI without altering the rest of the test
 */
export async function regenerateQuestionGroupWithAi(params: RegenerateQuestionGroupParams): Promise<GenerateDraftResult> {
  try {
    return await invokeAiAssistant('regenerate_question_group', {
      sourceText: params.passageText,
      questionTypes: [params.questionType],
      questionCount: params.questionCount,
      difficultyLevel: params.difficultyLevel,
    });
  } catch (err: any) {
    const errMsg = String(err?.message || '');
    if (errMsg.includes('Unsupported action') || errMsg.includes('regenerate_question_group')) {
      console.warn('regenerate_question_group not deployed on Edge Function yet, falling back to convert_document_to_assignment', err);
      return invokeAiAssistant('convert_document_to_assignment', {
        documentText: params.passageText,
        conversionMode: 'generate_new',
        skill: 'reading',
        instructions: `Generate ${params.questionCount} questions of type ${params.questionType} for this passage.`,
      });
    }
    throw err;
  }
}
