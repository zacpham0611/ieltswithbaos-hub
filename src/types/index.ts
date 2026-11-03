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
  audioUrl?: string;
  content?: string;
  tags: string[];
  skill?: CourseSkill;
  folder?: string;
  folderId?: string | null;
  isPublished: boolean;
  createdAt: string;
  isArchived?: boolean;
  mergedIntoTestId?: string;
  speakingPart?: 'part1' | 'part2' | 'part3';
  speakingPart1?: SpeakingPart1LibraryContent;
  speakingPart2?: SpeakingPart2LibraryContent;
  speakingPart3?: SpeakingPart3LibraryContent;
  listeningContent?: ListeningTestContent;
  description?: string;
  category?: string;
}

export interface MaterialFolder {
  id: string;
  name: string;
  parentId?: string | null;
  createdAt: string;
  updatedAt?: string;
  color?: string;
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

export type AssignmentSkill = 'reading' | 'writing' | 'speaking' | 'listening';

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
  | 'form_completion'
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
  imageUrl?: string;
  imageCaption?: string;
  wordLimit?: string;
  maxWords?: number;
  /** For multiple_select: how many options the student must choose (e.g. 2, 3). */
  multipleSelectCount?: number;
  /** Answer format for completion questions */
  completionFormat?: 'text' | 'options' | 'word_list';
  /** Configured word limit count (e.g. 1, 2, 3) */
  wordLimitCount?: number;
  /** Whether numbers are allowed in addition to words (AND/OR A NUMBER) */
  allowNumbers?: boolean;
  /** Formatted instruction string like "NO MORE THAN TWO WORDS AND/OR A NUMBER" */
  wordLimitInstruction?: string;
  /** In options mode, whether an option can only be used once */
  preventDuplicateOptions?: boolean;
  /** Optional word list specific to this question if not shared */
  wordList?: string[];
  /** Reference to shared resources if belonging to a shared resource set */
  sharedResourceId?: string;
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
  allowNumbers?: boolean;
  headingsList?: string[];
  featuresList?: string[];
  optionsBox?: string[];
  /** Visual image or diagram reference (e.g. flowchart, diagram labelling) */
  imageUrl?: string;
  imageCaption?: string;
  groupText?: string;
  /** Shared resources across questions in the group */
  hasSharedResources?: boolean;
  /** Shared Word Bank (list of words/phrases) */
  sharedWordBank?: string[];
  /** Shared Options (predefined answer options) */
  sharedOptions?: string[];
  /** Common instructions for questions sharing resources */
  sharedInstructions?: string;
  /** Question IDs that participate in the shared resource */
  sharedQuestionIds?: string[];
  warnings?: string[];
  questions: ReadingQuestion[];
}

// =============================================================================
// IELTS LISTENING DATA MODELS (OFFICIAL SPECIFICATIONS)
// =============================================================================

export type ListeningQuestionType =
  | 'multiple_choice'
  | 'multiple_select'
  | 'matching'
  | 'plan_map_diagram_labelling'
  | 'form_completion'
  | 'note_completion'
  | 'table_completion'
  | 'flowchart_completion'
  | 'summary_completion'
  | 'sentence_completion'
  | 'short_answer';

export interface ListeningQuestion {
  id: string;
  number?: number;
  questionNumber?: number;
  part?: 1 | 2 | 3 | 4 | number;
  groupId?: string;
  type: ListeningQuestionType;
  prompt: string;
  instruction?: string;
  options?: string[];
  correctAnswer?: string;
  acceptedAlternatives?: string[];
  wordLimit?: string;
  maxWords?: number;
  allowNumbers?: boolean;
  explanation?: string;
  points?: number;
  imageUrl?: string;
  imageCaption?: string;
  labelCoordinate?: { x: number; y: number };
}

export interface ListeningQuestionGroup {
  id: string;
  part?: 1 | 2 | 3 | 4 | number;
  groupTitle?: string;
  title?: string;
  instructions?: string;
  type?: ListeningQuestionType;
  questionType?: QuestionType;
  sharedContent?: string;
  groupText?: string;
  imageUrl?: string;
  imageCaption?: string;
  wordLimit?: string;
  maxWords?: number;
  allowNumbers?: boolean;
  optionsBox?: string[];
  options?: string[];
  questions: ListeningQuestion[];
}

export interface ListeningPart {
  partNumber: 1 | 2 | 3 | 4 | number;
  title: string;
  audioUrl?: string;
  audioDurationSeconds?: number;
  instructions?: string;
  questionGroups: ListeningQuestionGroup[];
  questions: ListeningQuestion[];
}

export interface ListeningTestContent {
  title?: string;
  audioUrl?: string;
  audioMode?: 'continuous' | 'segmented';
  continuousAudioUrl?: string;
  continuousAudioDurationSeconds?: number;
  parts: ListeningPart[];
  totalQuestions: number;
  allowReplay?: boolean;
  allowSpeedAdjustment?: boolean;
}

export interface ParsedPassage {
  id: string;
  passageIndex: number;
  title: string;
  subtitle?: string;
  content: string;
  htmlContent?: string;
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
  prepTimeSeconds?: number;
  speakTimeSeconds?: number;
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

export interface SpeakingPart3Group {
  id: string;
  cueCardTopic?: string;
  cueCardId?: string;
  questions: string[];
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
  groups?: SpeakingPart3Group[];
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
  resourceId?: string;
  // Reading Specific
  readingPassage?: string;
  readingPassageHtml?: string;
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
  chartType?: string;
  modelAnswer?: string;
  modelAnswerReleaseCondition?: 'immediate' | 'after_submission' | 'after_graded' | 'never';
  // Speaking Specific
  speakingPart?: 'part1' | 'part2' | 'part3' | 'full';
  speakingParts?: Array<'part1' | 'part2' | 'part3'>;
  speakingTopicCount?: number;
  speakingTopics?: SpeakingTopic[];
  speakingCueCard?: SpeakingCueCard;
  speakingCueCards?: SpeakingCueCard[];
  speakingQuestions?: string[];
  speakingPart3Groups?: SpeakingPart3Group[];
  selectedSpeakingExerciseIds?: string[];
  // Listening Specific
  listeningContent?: ListeningTestContent;
  listeningAudioUrl?: string;
  listeningAudioDurationSeconds?: number;
  listeningAudioMode?: 'continuous' | 'segmented';
  listeningParts?: ListeningPart[];
  listeningQuestions?: ListeningQuestion[];
  listeningQuestionGroups?: ListeningQuestionGroup[];
  listeningAllowReplay?: boolean;
  listeningAllowSpeed?: boolean;
  audioUrl?: string;
  questions?: any[];
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
  // Listening
  answers?: Record<string, string>;
  listeningAnswers?: Record<string, string>;
  listeningScore?: {
    correct?: number;
    raw?: number;
    total: number;
    percentage?: number;
    estimatedBand?: number;
    band?: number;
    bandNotes?: string;
    errorAnalysis?: any[];
  };
  listeningErrorAnalysis?: { questionId: string; userAnswer: string; correctAnswer: string; isCorrect: boolean; explanation?: string }[];
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
  skill: 'reading' | 'writing' | 'speaking' | 'listening';
  title: string;
  audioUrl?: string;
  durationMinutes?: number;
  instructions?: string;
  resourceId?: string; // Materials Library reference
  // Reading Payload
  readingPassage?: string;
  passages?: ParsedPassage[];
  readingQuestions?: ReadingQuestion[];
  questionGroups?: any[];
  readingTestType?: ReadingTestType;
  // Writing Payload
  writingTaskType?: 'task1' | 'task2';
  writingTaskCategory?: WritingTaskCategory;
  writingPrompt?: string;
  writingMinWords?: number;
  task1ImageUrl?: string;
  chartType?: string;
  modelAnswer?: string;
  // Speaking Payload
  speakingPart?: 'part1' | 'part2' | 'part3' | 'full' | 'combined';
  speakingParts?: Array<'part1' | 'part2' | 'part3'>;
  speakingTopicCount?: number;
  speakingTopics?: SpeakingTopic[];
  speakingCueCard?: SpeakingCueCard;
  speakingCueCards?: SpeakingCueCard[];
  speakingTopic?: string;
  speakingPoints?: string[];
  speakingQuestions?: string[];
  speakingPart3Groups?: SpeakingPart3Group[];
  associatedPart2Id?: string;
  // Listening Payload
  listeningAudioUrl?: string;
  listeningAudioDurationSeconds?: number;
  listeningAudioMode?: 'continuous' | 'segmented';
  listeningParts?: ListeningPart[];
  listeningQuestions?: ListeningQuestion[];
  listeningQuestionGroups?: ListeningQuestionGroup[];
  listeningDurationMinutes?: number;
}

export interface RegularTest {
  id: string;
  courseId: string;
  courseName?: string;
  teacherId: string;
  teacherName?: string;
  title: string;
  instructions: string;
  skills: ('reading' | 'writing' | 'speaking' | 'listening')[];
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
    writing?: {
      text: string;
      wordCount: number;
      task1?: { text: string; wordCount: number };
      task2?: { text: string; wordCount: number };
      [key: string]: any;
    };
    speaking?: Record<string, {
      audioUrl: string;
      duration?: number;
      submittedAt?: string;
      isLocked?: boolean;
      part?: string;
    }>;
    listening?: Record<string, string>;
    _listeningPlaybackState?: {
      currentPart: number;
      status: 'not_started' | 'playing' | 'completed' | 'interrupted';
      completedParts: number[];
      playCount: Record<string, number>;
    };
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
    speaking?: {
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
    listening?: {
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
  events?: RegularTestEvent[];
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

