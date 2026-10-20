import { supabase, isSupabaseConfigured } from './supabase';

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
}

export interface AiError {
  message: string;
  code?: string;
}

/**
 * Invoke the secure Supabase Edge Function to generate an AI draft using Google Gemini.
 * The Gemini API key is accessed exclusively server-side and is never exposed to the client.
 */
export async function generateAiAssistantDraft(
  params: GenerateDraftParams
): Promise<GenerateDraftResult> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Please connect a valid Supabase project.');
  }

  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: {
      action: 'generate_assistant_draft',
      prompt: params.prompt,
      skill: params.skill || 'all',
      courseName: params.courseName,
      studentName: params.studentName,
      submissionsCount: params.submissionsCount ?? 0,
      evidenceSummary: params.evidenceSummary,
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

    throw new Error(message || 'Failed to generate AI assistant draft.');
  }

  if (!data || !data.draft) {
    throw new Error('AI assistant returned an empty response. Please try again.');
  }

  return {
    draft: data.draft,
    model: data.model || 'gemini-3.8-flash',
  };
}
