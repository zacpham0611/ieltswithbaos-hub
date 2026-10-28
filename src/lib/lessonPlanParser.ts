import type { CourseSkill } from '../types/index.ts';

export interface ParsedLessonPlan {
  title: string;
  skill: CourseSkill;
  objectives: string;
  activities: string;
  teacherNotes: string;
  homework: string;
}

/**
 * Parses Gemini-generated lesson plans (markdown or key-value format)
 * into structured fields for the Lesson creation form.
 */
export function parseAiLessonPlan(
  rawText: string,
  defaultSkill: CourseSkill = 'writing',
  defaultTopic = 'IELTS Masterclass'
): ParsedLessonPlan {
  if (!rawText || !rawText.trim()) {
    return {
      title: `Lesson: ${defaultTopic}`,
      skill: defaultSkill,
      objectives: '',
      activities: '',
      teacherNotes: '',
      homework: '',
    };
  }

  // Remove top draft banner if present
  const text = rawText
    .replace(/^#\s*\[AI ASSISTANT DRAFT[^\]]*\]\s*/i, '')
    .trim();

  // 1. Extract Title
  let title = '';
  const titleMatch = text.match(/^##?\s*(?:IELTS\s+Lesson\s+Plan:\s*)?([^\n\r]+)/im);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].replace(/^[#\s*\-]+|[#\s*]+$/g, '').trim();
    title = title.replace(/\s*\((?:Reading|Writing|Listening|Speaking|IELTS)\)\s*$/i, '').trim();
  }
  if (!title) {
    const altTitle = text.match(/Title:\s*([^\n\r]+)/i);
    if (altTitle && altTitle[1]) {
      title = altTitle[1].trim();
    }
  }

  // 2. Extract Objectives
  let objectives = '';
  const objMatch = text.match(/(?:Primary\s+Learning\s+Objectives|Learning\s+Objectives|Objectives|Mục tiêu)[^\n:]*:\s*([^\n\r]+(?:\n(?:\s*[-*•]|\s*\d+\.)[^\n\r]+)*)/i);
  if (objMatch && objMatch[1]) {
    objectives = objMatch[1].trim();
  } else {
    const altObj = text.match(/Objectives:\s*([\s\S]*?)(?=Activities:|Teacher Notes:|Homework:|###|$)/i);
    if (altObj && altObj[1]) {
      objectives = altObj[1].trim();
    }
  }

  // 3. Extract Timed Stages / Classroom Drills / Activities
  let activities = '';
  const stageMatch = text.match(/###?\s*(?:2|3|\d+)?\.?\s*(?:Detailed\s+Timed\s+Stages|Classroom\s+Drills|Activities|Hoạt động)[\s\S]*?(?=###?\s*(?:4|\d+)?\.?\s*(?:Formative\s+Assessment|Homework|Bài tập)|$)/i);
  if (stageMatch) {
    activities = stageMatch[0].replace(/^###?\s*[^\n\r]+\n?/i, '').trim();
  } else {
    const altAct = text.match(/Activities:\s*([\s\S]*?)(?=Teacher Notes:|Homework:|###|$)/i);
    if (altAct && altAct[1]) {
      activities = altAct[1].trim();
    }
  }

  // 4. Extract Teacher Notes / Preparation
  let teacherNotes = '';
  const prepMatch = text.match(/###?\s*(?:1|\d+)?\.?\s*(?:Preparation\s+&?\s*Materials|Teacher\s+Notes|Chuẩn bị)[\s\S]*?(?=###?\s*(?:2|\d+)?\.?\s*(?:Detailed\s+Timed\s+Stages|Classroom|Activities)|$)/i);
  if (prepMatch) {
    teacherNotes = prepMatch[0].replace(/^###?\s*[^\n\r]+\n?/i, '').trim();
  } else {
    const altNotes = text.match(/Teacher Notes:\s*([\s\S]*?)(?=Homework:|###|$)/i);
    if (altNotes && altNotes[1]) {
      teacherNotes = altNotes[1].trim();
    }
  }

  // 5. Extract Homework
  let homework = '';
  const hwMatch = text.match(/###?\s*(?:4|\d+)?\.?\s*(?:Formative\s+Assessment|Homework|Bài tập về nhà)[\s\S]*$/i);
  if (hwMatch) {
    homework = hwMatch[0].replace(/^###?\s*[^\n\r]+\n?/i, '').trim();
  } else {
    const altHw = text.match(/Homework:\s*([\s\S]*?)$/i);
    if (altHw && altHw[1]) {
      homework = altHw[1].trim();
    }
  }

  // Normalize defaults
  return {
    title: title || `Lesson: ${defaultTopic}`,
    skill: defaultSkill,
    objectives: objectives || `Master Band 7.0+ targets for ${defaultTopic}`,
    activities: activities || text.slice(0, 500),
    teacherNotes: teacherNotes || 'AI-generated draft. Review and calibrate with class pace.',
    homework: homework || 'Complete practice exercises and submit via portal.',
  };
}
