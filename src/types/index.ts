export type UserRole = 'teacher' | 'student';

export interface TeacherBankInfo {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branch: string;
  transferNotes?: string;
  transferDescription?: string;
  qrCodeUrl?: string;
  teachingDates?: string[];
  totalTeachingHours?: number;
  billableSessionCount?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  targetBand?: string;
  bio?: string;
  paymentQrUrl?: string;
  bankInfo?: TeacherBankInfo;
}

export type CourseSkill = 'listening' | 'reading' | 'writing' | 'speaking';
export type CourseStatus = 'active' | 'archived' | 'closed';

export interface Course {
  id: string;
  teacherId: string;
  teacherName: string;
  name: string;
  description: string;
  coverUrl?: string;
  skills: CourseSkill[];
  status: CourseStatus;
  code: string;
  startDate: string;
  endDate: string;
  tuitionModel: TuitionModel;
  tuitionAmount: number;
  currency: 'VND' | 'USD';
  createdAt: string;
}

export interface EnrollmentRequest {
  id: string;
  courseId: string;
  courseName: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface CourseMember {
  id: string;
  courseId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: 'enrolled' | 'removed';
  joinedAt: string;
  recentActivity: string;
  outstandingWork: number;
  targetBand?: string;
}

export type ResourceType = 'pdf' | 'doc' | 'image' | 'audio' | 'video' | 'link' | 'note';

export interface Resource {
  id: string;
  teacherId: string;
  courseId?: string | null; // null = global library
  title: string;
  type: ResourceType;
  url?: string;
  content?: string;
  tags: string[];
  skill?: CourseSkill;
  folder?: string;
  isPublished: boolean;
  createdAt: string;
  speakingPart?: 'part1' | 'part2' | 'part3';
  speakingPart1?: SpeakingPart1LibraryContent;
  speakingPart2?: SpeakingPart2LibraryContent;
  speakingPart3?: SpeakingPart3LibraryContent;
  description?: string;
  category?: string;
}

export interface Lesson {
  id: string;
  courseId: string;
  studentId?: string; // Target student for 1-on-1 tutoring, or undefined for class-wide
  title: string;
  objectives: string;
  skill: CourseSkill;
  teacherNotes: string;
  resources: Resource[];
  activities: string;
  homework: string;
  date: string;
  isPublished: boolean;
  status?: 'completed' | 'scheduled' | 'cancelled';
  durationMinutes?: number; // duration in minutes (e.g. 60, 90, 120)
  isBillable?: boolean; // eligible for tuition calculation
}

export type AssignmentSkill = 'reading' | 'writing' | 'speaking';

export type QuestionType =
  | 'multiple_choice'
  | 'multiple_select'
  | 'true_false_not_given'
  | 'yes_no_not_given'
  | 'matching'
  | 'matching_headings'
  | 'matching_information'
  | 'matching_features'
  | 'matching_sentence_endings'
  | 'sentence_completion'
  | 'summary_completion'
  | 'note_completion'
  | 'table_completion'
  | 'flowchart_completion'
  | 'short_answer'
  | 'diagram_completion'
  | 'fill_in_the_blank'
  | 'essay';

export interface ReadingQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  matchingPairs?: { left: string; right: string }[];
  headingsList?: string[];
  featuresList?: string[];
  diagramUrl?: string;
  wordLimit?: string;
  maxWords?: number;
  correctAnswer: string;
  explanation: string;
  points?: number;
  source?: 'extracted_from_doc' | 'ai_generated' | 'answer_key_extracted' | 'source_extracted' | string;
  answerKeyConfidence?: 'high' | 'medium' | 'needs_teacher_review';
  needsReview?: boolean;
  citation?: string;
  isTeacherEdited?: boolean;
}

export interface QuestionGroup {
  id: string;
  groupTitle?: string;
  instructions: string;
  questionType: QuestionType;
  wordLimit?: string;
  maxWords?: number;
  headingsList?: string[];
  featuresList?: string[];
  optionsBox?: string[];
  questions: ReadingQuestion[];
}

export interface ParsedPassage {
  id: string;
  passageIndex: number;
  title: string;
  subtitle?: string;
  content: string;
  questionGroups?: QuestionGroup[];
  questions?: ReadingQuestion[];
  labeledParagraphs?: { label: string; text: string }[];
}

export interface AiReadingTestConfig {
  sourceType: 'url' | 'file' | 'text';
  sourceUrl?: string;
  sourceText?: string;
  sourceFileName?: string;
  title: string;
  topic?: string;
  passageCount: number; // 1, 2, or 3
  selectedQuestionTypes: QuestionType[];
  totalQuestionCount: number;
  difficultyLevel: number; // 1 to 10
  timeLimitMinutes: number; // 20, 40, 60
  wordLimitConstraint?: string;
}

export interface GeneratedReadingTest {
  id: string;
  title: string;
  topic?: string;
  difficultyLevel: number;
  timeLimitMinutes: number;
  passages: ParsedPassage[];
  teacherNotes?: string;
  createdAt: string;
}

export type WritingTaskCategory =
  | 'task1_academic'
  | 'task1_general'
  | 'task2';

export type ReadingTestType = 'academic' | 'general';

export interface SpeakingTopic {
  id: string;
  topic: string;
  title?: string;
  questions: string[];
}

export interface SpeakingCueCard {
  topic: string;
  points: string[];
  prepTimeSeconds: number;
  speakTimeSeconds: number;
}

export interface SpeakingQuestionResponse {
  questionId?: string;
  audioUrl: string;
  transcript?: string;
  translation?: string;
  duration?: number;
  status?: 'idle' | 'processing' | 'completed' | 'failed';
  recordedAt?: string;
}

export interface SpeakingPart1LibraryContent {
  part: 'part1';
  topics: SpeakingTopic[];
  sourceDocumentName?: string;
}

export interface SpeakingPart2LibraryContent {
  part: 'part2';
  cueCards: Array<{
    id: string;
    topic: string;
    points: string[];
    prepTimeSeconds?: number;
    speakTimeSeconds?: number;
  }>;
  sourceDocumentName?: string;
}

export interface SpeakingPart3LibraryContent {
  part: 'part3';
  questions: string[];
  sourceDocumentName?: string;
}

export type SpeakingLibraryContent =
  | SpeakingPart1LibraryContent
  | SpeakingPart2LibraryContent
  | SpeakingPart3LibraryContent;

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  skill: AssignmentSkill;
  objectives: string;
  dueDate: string;
  status: 'draft' | 'published';
  resources?: string[];
  // Reading Specific
  readingPassage?: string;
  readingQuestions?: ReadingQuestion[];
  questionGroups?: QuestionGroup[];
  passages?: ParsedPassage[];
  readingTestType?: ReadingTestType;
  // Writing Specific
  writingTaskType?: 'task1' | 'task2';
  writingTaskCategory?: WritingTaskCategory;
  writingPrompt?: string;
  writingMinWords?: number;
  task1ImageUrl?: string;
  modelAnswer?: string;
  modelAnswerReleaseCondition?: 'immediate' | 'after_submission' | 'after_graded' | 'never';
  // Speaking Specific
  speakingPart?: 'part1' | 'part2' | 'part3' | 'full';
  speakingTopics?: SpeakingTopic[];
  speakingCueCard?: SpeakingCueCard;
  speakingQuestions?: string[];
  answerReleasePolicy?: 'immediate' | 'after_submission' | 'never';
  scoreVisibility?: 'private' | 'public';
  sourceDocumentName?: string;
}

export type SubmissionStatus = 'submitted' | 'returned' | 'resubmitted' | 'graded';

export interface WritingRevision {
  text: string;
  timestamp: string;
  wordCount: number;
}

export interface Submission {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  skill: AssignmentSkill;
  status: SubmissionStatus;
  submittedAt: string;
  updatedAt: string;
  // Reading
  readingAnswers?: Record<string, string>;
  readingScore?: {
    correct: number;
    total: number;
    percentage: number;
    estimatedBand?: number;
    testType?: 'academic' | 'general';
    bandNotes?: string;
  };
  readingErrorAnalysis?: { questionId: string; userAnswer: string; correctAnswer: string; isCorrect: boolean; explanation: string }[];
  // Writing
  writingText?: string;
  writingWordCount?: number;
  writingRevisions?: WritingRevision[];
  // Speaking
  speakingAudioUrl?: string;
  speakingTranscript?: string;
  speakingTranslation?: string;
  speakingDuration?: number;
  speakingResponses?: Record<string, SpeakingQuestionResponse>;
  // Rubrics & Feedback
  rubricScores?: {
    criterion: string;
    score: number;
    descriptor: string;
  }[];
  strengths?: string;
  areasToImprove?: string;
  teacherComments?: string;
  nextSteps?: string;
  aiSuggestedFeedback?: string;
  score?: number;
  annotations?: InlineAnnotation[];
  isDraft?: boolean;
}

export interface InlineAnnotation {
  id: string;
  startIndex: number;
  endIndex: number;
  selectedText: string;
  comment: string;
  type: 'correction' | 'suggestion' | 'grammar' | 'vocabulary' | 'praise' | 'deletion';
  suggestion?: string;
  createdAt: string;
}

export type AssessmentState = 'draft' | 'ai_generated' | 'in_review' | 'approved' | 'published' | 'void';

export interface AssignmentAssessmentEvidence {
  id: string;
  assignmentId: string;
  title: string;
  skill: AssignmentSkill;
  submittedAt: string;
  status: SubmissionStatus;
  score?: number; // Band score (e.g. 7.0)
  scoreSource: 'teacher' | 'ai' | 'unscored';
  readingCorrect?: number;
  readingTotal?: number;
  criteriaScores?: { criterion: string; score: number }[];
  comments?: string;
}

export interface MonthlyReportEvidence {
  readingAccuracy?: string;
  readingAttempts?: number;
  writingSubmissions?: number;
  writingLastFeedback?: string;
  speakingSubmissions?: number;
  speakingAudioAvailable?: boolean;
  insufficientEvidenceSkills: string[];
  summaryNotes: string;
  completedAssignments?: AssignmentAssessmentEvidence[];
  skillBreakdown?: {
    readingBand?: number;
    writingBand?: number;
    speakingBand?: number;
    overallEstimatedBand?: number;
  };
}

export interface MonthlyReport {
  id: string;
  courseId: string;
  courseName: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  teacherId: string;
  teacherName: string;
  month: string; // e.g. "2026-10" or "October 2026"
  targetBand?: string;
  state: AssessmentState;
  createdAt: string;
  publishedAt?: string;
  learningEvidence: MonthlyReportEvidence;
  aiDraft: {
    strengths: string;
    focusAreas: string;
    evidenceGapsFlagged: string;
    recurringPatterns: string;
    generatedAt?: string;
  };
  teacherEvaluation: {
    professionalJudgement: string;
    nextMonthPriorities: string;
    estimatedBand?: string;
    approvedAt?: string;
  };
  history: {
    version: number;
    action: string;
    timestamp: string;
    actor: string;
    note?: string;
  }[];
}

export type TuitionModel = 'fixed_monthly' | 'per_session' | 'hourly' | 'course_package';

export interface FeeConfiguration {
  id: string;
  courseId: string;
  courseName: string;
  teacherId: string;
  model: TuitionModel;
  currency: 'VND' | 'USD';
  amount: number;
  effectiveDate: string;
  billingDay: number; // day of month (e.g. 1)
  dueDays: number; // e.g. 15 days
  prorationRule: 'daily' | 'session' | 'none';
  sessionRate?: number;
  hourlyRate?: number;
  packageInstallments?: number;
  absenceRule?: 'charge_all' | 'excused_free' | 'make_up_allowed';
  earlyPaymentDiscountPercent?: number;
}

export interface StatementChargeItem {
  id: string;
  description: string;
  quantity?: string | number;
  unitPrice?: number;
  amount: number;
  date?: string;
}

export interface PaymentRecord {
  id: string;
  statementId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'Bank Transfer' | 'Cash' | 'Credit Card' | 'Other';
  transactionReference: string;
  notes?: string;
}

export type StatementStatus = 'draft' | 'pending_approval' | 'approved' | 'published' | 'paid' | 'partially_paid' | 'overdue' | 'void';

export interface TuitionStatement {
  id: string;
  statementNumber: string; // TS-2025-0042
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  courseId: string;
  courseName: string;
  billingPeriod: string; // "Apr 1–30, 2025" or "April 2026"
  issueDate: string;
  dueDate: string;
  currency: 'VND' | 'USD';
  status: StatementStatus;
  model: TuitionModel;
  itemizedCharges: StatementChargeItem[];
  discountAmount: number;
  discountDescription?: string;
  previousBalance: number;
  totalAmountDue: number;
  amountPaid: number;
  remainingBalance: number;
  payments: PaymentRecord[];
  bankInfo: TeacherBankInfo;
  teachingDates?: string[];
  totalTeachingHours?: number;
  billableSessionCount?: number;
  qrCodeUrl?: string;
  auditHistory: {
    action: string;
    timestamp: string;
    user: string;
    details: string;
  }[];
}

export interface ActivityItem {
  id: string;
  teacherId: string;
  text: string;
  timeAgo: string;
  timestamp: string;
  type: 'submission' | 'report' | 'payment' | 'enrollment';
  targetTab?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'success' | 'warning';
  linkTarget?: string;
}

// =============================================================================
// REGULAR TEST & STRICT EXAM MODE TYPES
// =============================================================================

export type StrictExamPreset = 'off' | 'standard' | 'strict';

export interface StrictExamSettings {
  desktopOnly: boolean;
  fullscreenRequired: boolean;
  blockCopyReading: boolean;
  blockPasteWriting: boolean;
  readingInactivitySeconds: number;
  disableSpellcheck: boolean;
  watermark: boolean;
  preventDevTools: boolean;
  sessionPolicy: 'takeover' | 'block_new';
  ipAllowlist?: string[];
}

export type RegularTestStatus = 'draft' | 'scheduled' | 'live' | 'completed' | 'closed' | 'archived';

export type RegularTestTimingMode = 'overall_timer' | 'per_section';

export interface RegularTestReleaseSettings {
  timing: 'immediate' | 'auto_graded' | 'manual_review';
  detailLevel: 'score_only' | 'with_corrections' | 'with_answers';
  feedbackReleased: boolean;
}

export interface RegularTestSection {
  id: string;
  skill: 'reading' | 'writing';
  title: string;
  durationMinutes?: number;
  instructions?: string;
  resourceId?: string; // Materials Library reference
  // Reading Payload
  readingPassage?: string;
  passages?: ParsedPassage[];
  readingQuestions?: ReadingQuestion[];
  questionGroups?: QuestionGroup[];
  readingTestType?: ReadingTestType;
  // Writing Payload
  writingTaskType?: 'task1' | 'task2';
  writingTaskCategory?: WritingTaskCategory;
  writingPrompt?: string;
  writingMinWords?: number;
  task1ImageUrl?: string;
  modelAnswer?: string;
}

export interface RegularTest {
  id: string;
  courseId: string;
  courseName?: string;
  teacherId: string;
  teacherName?: string;
  title: string;
  instructions: string;
  skills: ('reading' | 'writing')[];
  availabilityStart?: string;
  availabilityEnd?: string;
  hardDeadline?: string;
  durationMinutes: number;
  timingMode: RegularTestTimingMode;
  sectionTimers?: Record<string, number>;
  eligibleStudentIds?: string[];
  maxAttempts: number;
  accessCodeEnabled: boolean;
  accessCodeHash?: string;
  strictPreset: StrictExamPreset;
  strictSettings: StrictExamSettings;
  status: RegularTestStatus;
  currentVersion: number;
  releaseSettings: RegularTestReleaseSettings;
  sections?: RegularTestSection[];
  createdAt: string;
  updatedAt: string;
}

export type RegularTestAttemptStatus = 'in_progress' | 'submitted' | 'auto_submitted' | 'overdue';

export interface RegularTestAttempt {
  id: string;
  testId: string;
  testTitle?: string;
  versionId: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  courseId: string;
  courseName?: string;
  attemptNumber: number;
  serverStartTime: string;
  serverDeadline: string;
  extraTimeMinutes: number;
  currentSectionIndex: number;
  status: RegularTestAttemptStatus;
  submittedAt?: string;
  autoSubmitted: boolean;
  sessionToken: string;
  answers: {
    reading?: Record<string, string>;
    writing?: { text: string; wordCount: number };
    [key: string]: any;
  };
  flaggedQuestions: Record<string, boolean>;
  writingRevisions?: Array<{
    timestamp: string;
    wordCount: number;
    length: number;
    text?: string;
  }>;
  saveRevisionSequence?: number;
  scores?: {
    reading?: {
      raw: number;
      max: number;
      band: number;
      errorAnalysis?: Array<{
        questionId: string;
        userAnswer: string;
        correctAnswer: string;
        isCorrect: boolean;
        explanation?: string;
      }>;
    };
    writing?: {
      band: number;
      rubricScores?: Array<{
        criterion: string;
        score: number;
        descriptor: string;
      }>;
      strengths?: string;
      areasToImprove?: string;
      nextSteps?: string;
    };
    overall?: number;
  };
  gradingStatus: 'pending' | 'auto_graded' | 'pending_manual' | 'fully_graded';
  isReleased: boolean;
  releasedAt?: string;
  scoreAdjustments?: Array<{
    timestamp: string;
    adjustedBy: string;
    reason: string;
    previousScores: any;
    newScores: any;
  }>;
  eventCount?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  createdAt?: string;
  updatedAt?: string;
}

export interface RegularTestEvent {
  id: string;
  attemptId: string;
  testId: string;
  studentId: string;
  studentName?: string;
  eventType: string;
  category: 'objective' | 'indicator' | 'teacher_action';
  severity: 'info' | 'low' | 'medium' | 'high';
  serverTimestamp: string;
  clientTimestamp?: string;
  durationSeconds: number;
  metadata: Record<string, any>;
  reviewStatus: 'unreviewed' | 'acknowledged' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt?: string;
}

export interface RegularTestReportLink {
  id: string;
  reportId: string;
  attemptId: string;
  testId: string;
  studentId: string;
  testTitle?: string;
  submittedAt?: string;
  scores?: any;
  status?: string;
  createdAt?: string;
}

