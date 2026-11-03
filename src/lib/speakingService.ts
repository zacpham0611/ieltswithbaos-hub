import { supabase, isSupabaseConfigured } from './supabase.ts';
import { uploadAudioOptimized, type AudioUploadProgress } from './optimizedAudioUploader.ts';
import type {
  Assignment,
  SpeakingTopic,
  SpeakingCueCard,
  SpeakingPart3Group,
  SpeakingQuestionResponse,
  SpeakingLibraryContent,
} from '../types/index.ts';

/**
 * Normalizes and extracts speaking assignment structure (Part 1, Part 2, or Part 3)
 */
export function extractSpeakingAssignmentDetails(assign: Partial<Assignment> | undefined) {
  if (!assign) {
    return {
      part: 'part2' as const,
      parts: ['part2'] as Array<'part1' | 'part2' | 'part3'>,
      hasPart1: false,
      hasPart2: true,
      hasPart3: false,
      topics: [] as SpeakingTopic[],
      cueCard: null as SpeakingCueCard | null,
      questions: [] as string[],
      groups: [] as SpeakingPart3Group[],
    };
  }

  const rawCueCard: any = assign.speakingCueCard || {};

  // Resolve parts array
  let parts: Array<'part1' | 'part2' | 'part3'> = [];
  if (Array.isArray(assign.speakingParts) && assign.speakingParts.length > 0) {
    parts = assign.speakingParts;
  } else if (assign.speakingPart === 'full') {
    parts = ['part1', 'part2', 'part3'];
  } else if (assign.speakingPart === 'part1') {
    parts = ['part1'];
  } else if (assign.speakingPart === 'part3') {
    parts = ['part3'];
  } else if (assign.speakingPart === 'part2') {
    parts = ['part2'];
  } else {
    // Infer from presence of data
    if (Array.isArray(assign.speakingTopics) && assign.speakingTopics.length > 0) parts.push('part1');
    if (assign.speakingCueCard?.topic || rawCueCard.topic) parts.push('part2');
    if ((Array.isArray(assign.speakingQuestions) && assign.speakingQuestions.length > 0) ||
        (Array.isArray(assign.speakingPart3Groups) && assign.speakingPart3Groups.length > 0)) {
      parts.push('part3');
    }
    if (parts.length === 0) parts = ['part2'];
  }

  const hasPart1 = parts.includes('part1');
  const hasPart2 = parts.includes('part2');
  const hasPart3 = parts.includes('part3');
  const part = (parts[0] || 'part2') as 'part1' | 'part2' | 'part3';

  // Part 1: Topics with Questions
  let rawTopics: SpeakingTopic[] = [];
  if (hasPart1) {
    rawTopics = Array.isArray(assign.speakingTopics) && assign.speakingTopics.length > 0
      ? assign.speakingTopics
      : Array.isArray(rawCueCard.topics) && rawCueCard.topics.length > 0
      ? rawCueCard.topics
      : rawCueCard.topic && !hasPart2
      ? [
          {
            id: 'topic_1',
            topic: rawCueCard.topic,
            questions: Array.isArray(rawCueCard.points) ? rawCueCard.points : ['Tell me about your experience.'],
          },
        ]
      : [];
  }

  // Filter topics if explicit individual exercise selection IDs were stored
  const selectedIds = Array.isArray(assign.selectedSpeakingExerciseIds) ? assign.selectedSpeakingExerciseIds : [];
  const topics: SpeakingTopic[] =
    selectedIds.length > 0 && hasPart1
      ? rawTopics.filter((t) => selectedIds.includes(t.id) || selectedIds.includes(t.topic))
      : rawTopics;

  // Part 2: Cue Card
  const cueCard: SpeakingCueCard | null =
    hasPart2
      ? {
          topic: assign.speakingCueCard?.topic || rawCueCard.topic || 'Describe an experience that taught you something valuable.',
          points: Array.isArray(assign.speakingCueCard?.points) && assign.speakingCueCard.points.length > 0
            ? assign.speakingCueCard.points
            : Array.isArray(rawCueCard.points) && rawCueCard.points.length > 0
            ? rawCueCard.points
            : [
                'What the experience was',
                'When and where it took place',
                'What you learned from it',
                'And explain why this experience was important to you',
              ],
          prepTimeSeconds: assign.speakingCueCard?.prepTimeSeconds || rawCueCard.prepTimeSeconds || 60,
          speakTimeSeconds: assign.speakingCueCard?.speakTimeSeconds || rawCueCard.speakTimeSeconds || 120,
        }
      : null;

  // Part 3: Independent Questions & Groups
  let questions: string[] = [];
  let groups: SpeakingPart3Group[] = [];
  if (hasPart3) {
    questions = Array.isArray(assign.speakingQuestions) && assign.speakingQuestions.length > 0
      ? assign.speakingQuestions
      : Array.isArray(rawCueCard.questions) && rawCueCard.questions.length > 0
      ? rawCueCard.questions
      : !hasPart2 && Array.isArray(rawCueCard.points) && rawCueCard.points.length > 0
      ? rawCueCard.points
      : [];

    groups = Array.isArray(assign.speakingPart3Groups)
      ? assign.speakingPart3Groups
      : [];
  }

  return {
    part,
    parts,
    hasPart1,
    hasPart2,
    hasPart3,
    topics: topics.length > 0 ? topics : rawTopics,
    cueCard,
    questions,
    groups,
  };
}

/**
 * Unpacks stored speaking submission data (handles both legacy plain text and structured JSON with per-question audio)
 */
export function unpackSpeakingSubmission(
  rawTranscript: string | null | undefined,
  rawAudioUrl: string | null | undefined
): {
  transcript: string;
  translation: string;
  responses: Record<string, SpeakingQuestionResponse>;
} {
  if (!rawTranscript && !rawAudioUrl) {
    return { transcript: '', translation: '', responses: {} };
  }

  if (rawTranscript && rawTranscript.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawTranscript);
      if (parsed && typeof parsed === 'object') {
        return {
          transcript: typeof parsed.transcript === 'string' ? parsed.transcript : '',
          translation: typeof parsed.translation === 'string' ? parsed.translation : '',
          responses: parsed.responses && typeof parsed.responses === 'object' ? parsed.responses : {},
        };
      }
    } catch {
      // Not JSON, fall back to plain text
    }
  }

  return {
    transcript: rawTranscript || '',
    translation: '',
    responses: rawAudioUrl
      ? {
          default: {
            audioUrl: rawAudioUrl,
            transcript: rawTranscript || '',
            translation: '',
            status: 'completed',
          },
        }
      : {},
  };
}

/**
 * Packs speaking submission payload for persistence in Supabase
 */
export function packSpeakingSubmission(data: {
  transcript?: string;
  translation?: string;
  responses?: Record<string, SpeakingQuestionResponse>;
}): string {
  return JSON.stringify({
    transcript: data.transcript || '',
    translation: data.translation || '',
    responses: data.responses || {},
  });
}

/**
 * Uploads student speaking audio recording or file to Supabase Storage with graceful fallback
 */
export async function uploadSpeakingAudio(
  fileOrBlob: Blob | File,
  metadata: { assignmentId: string; studentId: string; questionId?: string },
  options?: { onProgress?: (p: AudioUploadProgress) => void; signal?: AbortSignal }
): Promise<string> {
  const safeQId = (metadata.questionId || 'part2').replace(/[^a-zA-Z0-9_-]/g, '_');
  const preferredFileName = `${metadata.studentId}_${safeQId}`;

  return uploadAudioOptimized(fileOrBlob, {
    folder: 'speaking',
    preferredFileName: `speaking_${metadata.assignmentId}_${preferredFileName}`,
    bucket: 'speaking_audios',
    onProgress: options?.onProgress,
    signal: options?.signal,
  });
}

/**
 * Auto-transcription functionality has been completely removed from Speaking module per product specifications.
 * Retained as a lightweight zero-overhead stub to prevent breaking any callers.
 */
export async function transcribeAndTranslateAudio(_params?: {
  audioUrl?: string;
  promptContext?: string;
  speakingPart?: string;
}): Promise<{ transcript: string; translation: string }> {
  return {
    transcript: '',
    translation: '',
  };
}

/**
 * Triggers clean client-side file download for teacher audio review
 */
export function downloadSpeakingAudio(
  audioUrl: string,
  filename: string
) {
  if (!audioUrl) return;

  const a = document.createElement('a');
  a.href = audioUrl;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
