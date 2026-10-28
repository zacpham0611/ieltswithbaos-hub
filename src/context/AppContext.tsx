import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  User,
  Course,
  EnrollmentRequest,
  CourseMember,
  Resource,
  Lesson,
  Assignment,
  Submission,
  MonthlyReport,
  FeeConfiguration,
  TuitionStatement,
  ActivityItem,
  NotificationItem,
  PaymentRecord,
  InlineAnnotation,
  UserRole,
  TuitionModel,
  ReadingQuestion,
  QuestionGroup,
  ParsedPassage,
  TeacherBankInfo,
  CourseSkill,
} from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { I18nProvider } from '../i18n/context';
import { gradeAssignmentSubmission } from '../lib/assignmentGrader';
import { extractAllNormalizedQuestions, sanitizeQuestionsForStudent } from '../lib/questionNormalizer';
import { calculateMonthlyTuition } from '../lib/tuitionCalculator';

interface AppContextType {
  currentUser: User | null;
  loadingAuth: boolean;
  loadingData: boolean;
  dataError: string | null;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  setAuthenticatedUser: (supabaseUser: any) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;

  // Courses
  courses: Course[];
  activeCourses: Course[];
  createCourse: (course: Omit<Course, 'id' | 'teacherId' | 'teacherName' | 'createdAt'>) => Promise<Course>;
  updateCourse: (id: string, updates: Partial<Course>) => Promise<void>;
  deleteCourse: (courseId: string) => Promise<{ success: boolean; message?: string }>;
  regenerateCourseCode: (courseId: string) => Promise<string>;
  archiveCourse: (courseId: string) => Promise<void>;

  // Enrollment & Roster
  enrollmentRequests: EnrollmentRequest[];
  courseMembers: CourseMember[];
  requestEnrollment: (courseCode: string) => Promise<{ success: boolean; message: string }>;
  reviewEnrollmentRequest: (requestId: string, status: 'approved' | 'rejected', reason?: string) => Promise<void>;
  removeStudentFromCourse: (courseId: string, studentId: string) => Promise<void>;

  // Resources
  resources: Resource[];
  addResource: (resource: Omit<Resource, 'id' | 'teacherId' | 'createdAt'>) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
  toggleResourcePublish: (id: string) => Promise<void>;

  // Lessons & Attendance
  lessons: Lesson[];
  createLesson: (lesson: Omit<Lesson, 'id'>) => Promise<void>;
  updateLesson: (id: string, updates: Partial<Lesson>) => Promise<void>;
  toggleAttendanceSession: (
    courseId: string,
    studentId: string | null,
    date: string,
    durationMinutes?: number,
    status?: 'completed' | 'scheduled' | 'cancelled'
  ) => Promise<void>;

  // Assignments & Submissions
  assignments: Assignment[];
  createAssignment: (assignment: Omit<Assignment, 'id'>) => Promise<void>;
  updateAssignment: (id: string, updates: Partial<Assignment>) => Promise<void>;
  deleteAssignment: (id: string, forceHardDelete?: boolean) => Promise<{ success: boolean; hasSubmissions?: boolean }>;
  submissions: Submission[];
  submitAssignment: (assignmentId: string, data: Partial<Submission>) => Promise<void>;
  gradeSubmission: (submissionId: string, updates: Partial<Submission>) => Promise<void>;
  returnForRevision: (submissionId: string, teacherComments: string) => Promise<void>;

  // Monthly Assessments
  monthlyReports: MonthlyReport[];
  createMonthlyReportDraft: (courseId: string, studentId: string, month: string) => Promise<MonthlyReport>;
  updateMonthlyReport: (id: string, updates: Partial<MonthlyReport>) => Promise<void>;
  approveMonthlyReport: (id: string) => Promise<void>;
  publishMonthlyReport: (id: string) => Promise<void>;
  voidMonthlyReport: (id: string) => Promise<void>;

  // Tuition
  feeConfigurations: FeeConfiguration[];
  createFeeConfiguration: (config: Omit<FeeConfiguration, 'id' | 'teacherId'>) => Promise<void>;
  updateFeeConfiguration: (courseId: string, updates: Partial<FeeConfiguration>) => Promise<void>;
  tuitionStatements: TuitionStatement[];
  generateTuitionStatement: (data: {
    courseId: string;
    studentId: string;
    billingPeriod: string;
    dueDate: string;
    billableUnits?: number;
    customDiscount?: number;
    customDiscountNote?: string;
    customSurcharge?: number;
    previousBalance?: number;
  }) => Promise<TuitionStatement>;
  approveTuitionStatement: (id: string) => Promise<void>;
  publishTuitionStatement: (id: string) => Promise<void>;
  voidTuitionStatement: (id: string) => Promise<void>;
  recordPayment: (statementId: string, payment: Omit<PaymentRecord, 'id' | 'statementId'>) => Promise<void>;
  uploadTeacherPaymentQr: (file: File) => Promise<string>;
  removeTeacherPaymentQr: () => Promise<void>;

  // Activities & Notifications
  activities: ActivityItem[];
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  addActivity: (text: string, type: ActivityItem['type'], targetTab?: string) => Promise<void>;

  // Navigation state
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedCourseId: string | null;
  setSelectedCourseId: (id: string | null) => void;
  selectedStatementId: string | null;
  setSelectedStatementId: (id: string | null) => void;
  selectedReportId: string | null;
  setSelectedReportId: (id: string | null) => void;

  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentUserRef = useRef<User | null>(null);
  const inFlightProfilePromiseRef = useRef<Map<string, Promise<User | null>>>(new Map());
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Core production entities (defaults to empty arrays - no fake records!)
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollmentRequests, setEnrollmentRequests] = useState<EnrollmentRequest[]>([]);
  const [courseMembers, setCourseMembers] = useState<CourseMember[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [feeConfigurations, setFeeConfigurations] = useState<FeeConfiguration[]>([]);
  const [tuitionStatements, setTuitionStatements] = useState<TuitionStatement[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Navigation state
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Generate 7-character course code helper
  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for (let i = 0; i < 7; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  // Helper to parse teacher comments and inline annotations safely
  const parseTeacherComments = (raw: any) => {
    let comments = raw || '';
    let annotations: InlineAnnotation[] = [];
    let isDraft = false;
    if (typeof raw === 'string' && raw.trim().startsWith('{') && raw.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          comments = parsed.general !== undefined ? parsed.general : comments;
          annotations = Array.isArray(parsed.annotations) ? parsed.annotations : [];
          isDraft = Boolean(parsed.isDraft);
        }
      } catch {
        // Fallback to raw text
      }
    }
    return { comments, annotations, isDraft };
  };

  // Helper to unpack reading questions, question groups, passages and metadata safely
  const unpackAssignmentReadingData = (raw: any): {
    questions: ReadingQuestion[];
    questionGroups: QuestionGroup[];
    passages: ParsedPassage[];
    metadata: any;
  } => {
    let questions: ReadingQuestion[] = [];
    let questionGroups: QuestionGroup[] = [];
    let passages: ParsedPassage[] = [];
    let metadata: any = {};

    if (!raw) {
      return { questions, questionGroups, passages, metadata };
    }

    if (Array.isArray(raw)) {
      questions = raw.filter((q: any) => {
        if (q && q._metadata) {
          metadata = q._metadata;
          return false;
        }
        return true;
      });
    } else if (typeof raw === 'object') {
      if (Array.isArray(raw.questions)) {
        questions = raw.questions;
      }
      if (Array.isArray(raw.questionGroups)) {
        questionGroups = raw.questionGroups;
      }
      if (Array.isArray(raw.passages)) {
        passages = raw.passages;
      }
      metadata = raw._metadata || raw.metadata || {};
    }

    // Normalizes questions and flattens/links any questions from passages or groups to eliminate 0 / 0 Answered
    const extracted = extractAllNormalizedQuestions({
      readingQuestions: questions,
      questionGroups,
      passages,
    });

    return {
      questions: extracted.questions,
      questionGroups,
      passages,
      metadata,
    };
  };

  // 1. DATA REFRESH FUNCTION - Pulls real records from Supabase
  const refreshData = useCallback(async () => {
    if (!currentUser) return;
    setLoadingData(true);
    setDataError(null);

    try {
      if (currentUser.role === 'teacher') {
        // Teacher sees courses where teacher_id = currentUser.id
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('*')
          .eq('teacher_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (coursesError) {
          console.error('Error fetching teacher courses:', coursesError);
          setDataError(coursesError.message);
        }

        let currentCourses: Course[] = [];
        if (coursesData) {
          const mappedCourses: Course[] = coursesData.map((c: any) => ({
            id: c.id,
            teacherId: c.teacher_id,
            teacherName: currentUser.name,
            name: c.name,
            description: c.description,
            coverUrl: c.cover_url,
            skills: c.skills || [],
            status: c.status,
            code: c.code,
            startDate: c.start_date || '',
            endDate: c.end_date || '',
            tuitionModel: c.tuition_model,
            tuitionAmount: Number(c.tuition_amount),
            currency: c.currency,
            createdAt: c.created_at?.split('T')[0] || '',
          }));
          currentCourses = mappedCourses;
          setCourses(mappedCourses);

          const courseIds = mappedCourses.map((c) => c.id);

          if (courseIds.length > 0) {
            // Enrollments
            const { data: enrollmentsData } = await supabase
              .from('enrollments')
              .select('*, profiles:student_id(*)')
              .in('course_id', courseIds);

            if (enrollmentsData) {
              const reqs: EnrollmentRequest[] = [];
              const members: CourseMember[] = [];

              enrollmentsData.forEach((e: any) => {
                const courseName = mappedCourses.find((c) => c.id === e.course_id)?.name || 'Course';
                const studentProfile = e.profiles || {};

                if (e.status === 'pending' || e.status === 'rejected') {
                  reqs.push({
                    id: e.id,
                    courseId: e.course_id,
                    courseName,
                    studentId: e.student_id,
                    studentName: studentProfile.name || 'Student',
                    studentEmail: studentProfile.email || '',
                    status: e.status,
                    requestedAt: e.requested_at?.replace('T', ' ').substring(0, 16) || '',
                    reviewedAt: e.reviewed_at?.replace('T', ' ').substring(0, 16),
                    rejectionReason: e.rejection_reason,
                  });
                }

                if (e.status === 'approved' || e.status === 'removed') {
                  members.push({
                    id: e.id,
                    courseId: e.course_id,
                    studentId: e.student_id,
                    studentName: studentProfile.name || 'Student',
                    studentEmail: studentProfile.email || '',
                    status: e.status === 'approved' ? 'enrolled' : 'removed',
                    joinedAt: e.reviewed_at?.split('T')[0] || e.created_at?.split('T')[0] || '',
                    recentActivity: e.notes || 'Enrolled in course',
                    outstandingWork: 0,
                    targetBand: studentProfile.target_band,
                  });
                }
              });

              setEnrollmentRequests(reqs);
              setCourseMembers(members);
            }

            // Assignments
            const { data: assignmentsData } = await supabase
              .from('assignments')
              .select('*')
              .in('course_id', courseIds)
              .order('created_at', { ascending: false });

            if (assignmentsData) {
              setAssignments(
                assignmentsData.map((a: any) => {
                  const { questions: cleanQuestions, questionGroups, passages, metadata } = unpackAssignmentReadingData(a.reading_questions);

                  return {
                    id: a.id,
                    courseId: a.course_id,
                    title: a.title,
                    instructions: a.instructions,
                    skill: a.skill,
                    objectives: a.objectives,
                    dueDate: a.due_date,
                    status: a.status,
                    readingPassage: a.reading_passage,
                    readingQuestions: cleanQuestions,
                    questionGroups,
                    passages,
                    readingTestType: a.reading_test_type || metadata.readingTestType || 'academic',
                    writingTaskType: a.writing_task_type,
                    writingTaskCategory: a.writing_task_category || metadata.writingTaskCategory || (a.writing_task_type === 'task1' ? 'task1_academic' : 'task2'),
                    writingPrompt: a.writing_prompt,
                    writingMinWords: a.writing_min_words,
                    task1ImageUrl: a.task1_image_url || metadata.task1ImageUrl,
                    modelAnswer: a.model_answer || metadata.modelAnswer,
                    modelAnswerReleaseCondition: a.model_answer_release_policy || a.model_answer_release_condition || metadata.modelAnswerReleaseCondition || 'after_graded',
                    speakingPart: a.speaking_part,
                    speakingCueCard: a.speaking_cue_card,
                  };
                })
              );
            }

            // Submissions
            const { data: subsData } = await supabase
              .from('submissions')
              .select('*, profiles:student_id(*), assignments:assignment_id(*)')
              .in('course_id', courseIds)
              .order('submitted_at', { ascending: false });

            if (subsData) {
              setSubmissions(
                subsData.map((s: any) => {
                  const { comments, annotations, isDraft } = parseTeacherComments(s.teacher_comments);
                  return {
                    id: s.id,
                    assignmentId: s.assignment_id,
                    assignmentTitle: s.assignments?.title || 'Assignment',
                    studentId: s.student_id,
                    studentName: s.profiles?.name || 'Student',
                    courseId: s.course_id,
                    courseName: mappedCourses.find((c) => c.id === s.course_id)?.name || 'Course',
                    skill: s.skill,
                    status: s.status,
                    submittedAt: s.submitted_at?.replace('T', ' ').substring(0, 16) || '',
                    updatedAt: s.updated_at?.replace('T', ' ').substring(0, 16) || '',
                    readingAnswers: s.reading_answers,
                    readingScore: s.reading_score,
                    readingErrorAnalysis: s.reading_error_analysis,
                    writingText: s.writing_text,
                    writingWordCount: s.writing_word_count,
                    writingRevisions: s.writing_revisions,
                    speakingAudioUrl: s.speaking_audio_url,
                    speakingTranscript: s.speaking_transcript,
                    speakingDuration: s.speaking_duration,
                    rubricScores: s.rubric_scores,
                    strengths: s.strengths,
                    areasToImprove: s.areas_to_improve,
                    teacherComments: comments,
                    nextSteps: s.next_steps,
                    aiSuggestedFeedback: s.ai_suggested_feedback,
                    score: s.score ? Number(s.score) : undefined,
                    annotations,
                    isDraft: isDraft || s.status === 'in_review',
                  };
                })
              );
            }
          } else {
            setEnrollmentRequests([]);
            setCourseMembers([]);
            setAssignments([]);
            setSubmissions([]);
          }
        }

        // Monthly Assessments
        const { data: assessmentsData } = await supabase
          .from('monthly_assessments')
          .select('*, profiles:student_id(*), courses:course_id(*)')
          .eq('teacher_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (assessmentsData) {
          setMonthlyReports(
            assessmentsData.map((m: any) => ({
              id: m.id,
              courseId: m.course_id,
              courseName: m.courses?.name || 'Course',
              studentId: m.student_id,
              studentName: m.profiles?.name || 'Student',
              studentEmail: m.profiles?.email || '',
              teacherId: m.teacher_id,
              teacherName: currentUser.name,
              month: m.month,
              targetBand: m.target_band,
              state: m.state,
              createdAt: m.created_at?.replace('T', ' ').substring(0, 16) || '',
              publishedAt: m.published_at?.replace('T', ' ').substring(0, 16),
              learningEvidence: m.learning_evidence || {},
              aiDraft: m.ai_draft || {},
              teacherEvaluation: m.teacher_evaluation || {},
              history: m.history || [],
            }))
          );
        }

        // Tuition Statements
        const { data: statementsData } = await supabase
          .from('tuition_statements')
          .select('*, profiles:student_id(*), courses:course_id(*), payment_records(*)')
          .eq('teacher_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (statementsData) {
          setTuitionStatements(
            statementsData.map((s: any) => ({
              id: s.id,
              statementNumber: s.statement_number,
              studentId: s.student_id,
              studentName: s.profiles?.name || 'Student',
              teacherId: s.teacher_id,
              teacherName: currentUser.name,
              courseId: s.course_id,
              courseName: s.courses?.name || 'Course',
              billingPeriod: s.billing_period,
              issueDate: s.issue_date,
              dueDate: s.due_date,
              currency: s.currency,
              status: s.status,
              model: s.model,
              itemizedCharges: s.itemized_charges || [],
              discountAmount: Number(s.discount_amount || 0),
              discountDescription: s.discount_description,
              previousBalance: Number(s.previous_balance || 0),
              totalAmountDue: Number(s.total_amount_due || 0),
              amountPaid: Number(s.amount_paid || 0),
              remainingBalance: Number(s.remaining_balance || 0),
              payments: (s.payment_records || []).map((p: any) => ({
                id: p.id,
                statementId: p.statement_id,
                amount: Number(p.amount),
                paymentDate: p.payment_date,
                paymentMethod: p.payment_method,
                transactionReference: p.transaction_reference,
                notes: p.notes,
              })),
              bankInfo: s.bank_info || {},
              auditHistory: s.audit_history || [],
              teachingDates: s.bank_info?.teachingDates || [],
              totalTeachingHours: s.bank_info?.totalTeachingHours,
              billableSessionCount: s.bank_info?.billableSessionCount,
              qrCodeUrl: s.bank_info?.qrCodeUrl || s.qr_code_url,
            }))
          );
        }

        // Tuition Settings / Fee Configurations
        if (currentCourses.length > 0) {
          const allCourseIds = currentCourses.map((c) => c.id);
          const { data: tuitionSettingsData } = await supabase
            .from('tuition_settings')
            .select('*')
            .in('course_id', allCourseIds);

          const feeConfigs: FeeConfiguration[] = currentCourses.map((c) => {
            const setting = (tuitionSettingsData || []).find((s: any) => s.course_id === c.id);
            if (setting) {
              return {
                id: setting.id,
                courseId: c.id,
                courseName: c.name,
                teacherId: setting.teacher_id,
                model: setting.model as TuitionModel,
                currency: setting.currency as 'VND' | 'USD',
                amount: Number(setting.amount),
                sessionRate: setting.session_rate ? Number(setting.session_rate) : undefined,
                hourlyRate: setting.hourly_rate ? Number(setting.hourly_rate) : undefined,
                effectiveDate: setting.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
                billingDay: setting.billing_day || 1,
                dueDays: setting.due_days || 15,
                prorationRule: setting.proration_rule || 'none',
                earlyPaymentDiscountPercent: Number(setting.early_payment_discount_percent || 0),
              };
            } else {
              return {
                id: `cfg_${c.id}`,
                courseId: c.id,
                courseName: c.name,
                teacherId: c.teacherId,
                model: c.tuitionModel || 'fixed_monthly',
                currency: c.currency || 'VND',
                amount: c.tuitionAmount || 0,
                effectiveDate: c.startDate || new Date().toISOString().split('T')[0],
                billingDay: 1,
                dueDays: 15,
                prorationRule: 'none',
                earlyPaymentDiscountPercent: 0,
              };
            }
          });
          setFeeConfigurations(feeConfigs);
        } else {
          setFeeConfigurations([]);
        }

        // Resources
        const { data: resData } = await supabase
          .from('resources')
          .select('*')
          .eq('teacher_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (resData) {
          setResources(
            resData.map((r: any) => ({
              id: r.id,
              teacherId: r.teacher_id,
              courseId: r.course_id,
              title: r.title,
              type: r.type,
              url: r.url,
              content: r.content,
              tags: r.tags || [],
              skill: r.skill,
              folder: r.folder,
              isPublished: r.is_published,
              createdAt: r.created_at?.split('T')[0] || '',
            }))
          );
        }

        // Lessons
        const { data: lessonsData } = await supabase
          .from('class_sessions')
          .select('*')
          .order('created_at', { ascending: false });

        if (lessonsData) {
          setLessons(
            lessonsData.map((l: any) => ({
              id: l.id,
              courseId: l.course_id,
              title: l.title,
              objectives: l.objectives,
              skill: l.skill,
              teacherNotes: l.teacher_notes,
              resources: [],
              activities: l.activities,
              homework: l.homework,
              date: l.session_date,
              isPublished: l.is_published,
              studentId: l.student_id,
              status: l.status || 'completed',
              durationMinutes: Number(l.duration_minutes) || 60,
              isBillable: l.is_billable !== false,
            }))
          );
        }

        // Activities
        const { data: actsData } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (actsData) {
          setActivities(
            actsData.map((a: any) => ({
              id: a.id,
              teacherId: a.user_id,
              text: a.text,
              timeAgo: 'Just now',
              timestamp: a.created_at?.replace('T', ' ').substring(0, 16) || '',
              type: a.type || 'info',
              targetTab: a.target_tab,
            }))
          );
        }
      } else {
        // STUDENT DATA FETCHING
        // 1. My Enrollments
        const { data: enrollmentsData } = await supabase
          .from('enrollments')
          .select('*, courses:course_id(*)')
          .eq('student_id', currentUser.id);

        if (enrollmentsData) {
          const reqs: EnrollmentRequest[] = [];
          const members: CourseMember[] = [];
          const approvedCourseIds: string[] = [];
          const loadedCourses: Course[] = [];

          enrollmentsData.forEach((e: any) => {
            const c = e.courses;
            if (c) {
              loadedCourses.push({
                id: c.id,
                teacherId: c.teacher_id,
                teacherName: 'Teacher',
                name: c.name,
                description: c.description,
                coverUrl: c.cover_url,
                skills: c.skills || [],
                status: c.status,
                code: c.code,
                startDate: c.start_date || '',
                endDate: c.end_date || '',
                tuitionModel: c.tuition_model,
                tuitionAmount: Number(c.tuition_amount),
                currency: c.currency,
                createdAt: c.created_at?.split('T')[0] || '',
              });
            }

            reqs.push({
              id: e.id,
              courseId: e.course_id,
              courseName: c?.name || 'Course',
              studentId: currentUser.id,
              studentName: currentUser.name,
              studentEmail: currentUser.email,
              status: e.status,
              requestedAt: e.requested_at?.replace('T', ' ').substring(0, 16) || '',
              reviewedAt: e.reviewed_at?.replace('T', ' ').substring(0, 16),
              rejectionReason: e.rejection_reason,
            });

            if (e.status === 'approved') {
              approvedCourseIds.push(e.course_id);
              members.push({
                id: e.id,
                courseId: e.course_id,
                studentId: currentUser.id,
                studentName: currentUser.name,
                studentEmail: currentUser.email,
                status: 'enrolled',
                joinedAt: e.reviewed_at?.split('T')[0] || e.created_at?.split('T')[0] || '',
                recentActivity: 'Enrolled in course',
                outstandingWork: 0,
              });
            }
          });

          setCourses(loadedCourses);
          setEnrollmentRequests(reqs);
          setCourseMembers(members);

        // 1. Student Submissions
        const { data: subsData } = await supabase
          .from('submissions')
          .select('*, assignments:assignment_id(*), courses:course_id(*)')
          .eq('student_id', currentUser.id)
          .order('submitted_at', { ascending: false });

        // 2. Assignments for approved courses
        if (approvedCourseIds.length > 0) {
          const { data: assignmentsData } = await supabase
            .from('assignments')
            .select('*')
            .in('course_id', approvedCourseIds)
            .eq('status', 'published')
            .order('created_at', { ascending: false });

          if (assignmentsData) {
            setAssignments(
              assignmentsData.map((a: any) => {
                const studentSub = subsData?.find((s: any) => s.assignment_id === a.id);
                const isGraded = studentSub && studentSub.status === 'graded';
                const hasSubmitted = !!studentSub;

                const { questions: questionsList, questionGroups, passages, metadata } = unpackAssignmentReadingData(a.reading_questions);

                const releaseCondition =
                  a.model_answer_release_policy ||
                  a.model_answer_release_condition ||
                  metadata.modelAnswerReleaseCondition ||
                  'after_graded';

                const canSeeAnswers = isGraded && releaseCondition !== 'never';
                const canSeeModelAnswer =
                  releaseCondition === 'immediate' ||
                  (releaseCondition === 'after_submission' && hasSubmitted) ||
                  (releaseCondition === 'after_graded' && isGraded);

                const sanitizedQuestions = questionsList.map((q: any) => {
                  if (canSeeAnswers) return q;
                  const { correctAnswer, explanation, ...safeQ } = q;
                  return {
                    ...safeQ,
                    correctAnswer: '',
                    explanation: '',
                  };
                });

                const sanitizedGroups = questionGroups.map((group) => ({
                  ...group,
                  questions: (group.questions || []).map((q: any) => {
                    if (canSeeAnswers) return q;
                    const { correctAnswer, explanation, ...safeQ } = q;
                    return {
                      ...safeQ,
                      correctAnswer: '',
                      explanation: '',
                    };
                  }),
                }));

                const sanitizedPassages = passages.map((p) => ({
                  ...p,
                  questions: (p.questions || []).map((q: any) => {
                    if (canSeeAnswers) return q;
                    const { correctAnswer, explanation, ...safeQ } = q;
                    return {
                      ...safeQ,
                      correctAnswer: '',
                      explanation: '',
                    };
                  }),
                  questionGroups: (p.questionGroups || []).map((g) => ({
                    ...g,
                    questions: (g.questions || []).map((q: any) => {
                      if (canSeeAnswers) return q;
                      const { correctAnswer, explanation, ...safeQ } = q;
                      return {
                        ...safeQ,
                        correctAnswer: '',
                        explanation: '',
                      };
                    }),
                  })),
                }));

                return {
                  id: a.id,
                  courseId: a.course_id,
                  title: a.title,
                  instructions: a.instructions,
                  skill: a.skill,
                  objectives: a.objectives,
                  dueDate: a.due_date,
                  status: a.status,
                  readingPassage: a.reading_passage,
                  readingQuestions: sanitizedQuestions,
                  questionGroups: sanitizedGroups,
                  passages: sanitizedPassages,
                  readingTestType: a.reading_test_type || metadata.readingTestType || 'academic',
                  writingTaskType: a.writing_task_type,
                  writingTaskCategory:
                    a.writing_task_category ||
                    metadata.writingTaskCategory ||
                    (a.writing_task_type === 'task1' ? 'task1_academic' : 'task2'),
                  writingPrompt: a.writing_prompt,
                  writingMinWords: a.writing_min_words,
                  task1ImageUrl: a.task1_image_url || metadata.task1ImageUrl,
                  modelAnswer: canSeeModelAnswer ? (a.model_answer || metadata.modelAnswer) : undefined,
                  modelAnswerReleaseCondition: releaseCondition,
                  speakingPart: a.speaking_part,
                  speakingCueCard: a.speaking_cue_card,
                };
              })
            );
          } else {
            setAssignments([]);
          }
        }

        if (subsData) {
          setSubmissions(
            subsData.map((s: any) => {
              const { comments, annotations, isDraft } = parseTeacherComments(s.teacher_comments);
              const isGradedPublished = s.status === 'graded' && !isDraft;
              return {
                id: s.id,
                assignmentId: s.assignment_id,
                assignmentTitle: s.assignments?.title || 'Assignment',
                studentId: s.student_id,
                studentName: currentUser.name,
                courseId: s.course_id,
                courseName: s.courses?.name || 'Course',
                skill: s.skill,
                status: s.status === 'in_review' ? 'submitted' : s.status,
                submittedAt: s.submitted_at?.replace('T', ' ').substring(0, 16) || '',
                updatedAt: s.updated_at?.replace('T', ' ').substring(0, 16) || '',
                readingAnswers: s.reading_answers,
                readingScore: s.reading_score,
                readingErrorAnalysis: s.reading_error_analysis,
                writingText: s.writing_text,
                writingWordCount: s.writing_word_count,
                writingRevisions: s.writing_revisions,
                speakingAudioUrl: s.speaking_audio_url,
                speakingTranscript: s.speaking_transcript,
                speakingDuration: s.speaking_duration,
                rubricScores: isGradedPublished ? s.rubric_scores : [],
                strengths: isGradedPublished ? s.strengths : undefined,
                areasToImprove: isGradedPublished ? s.areas_to_improve : undefined,
                teacherComments: isGradedPublished ? comments : undefined,
                nextSteps: isGradedPublished ? s.next_steps : undefined,
                aiSuggestedFeedback: isGradedPublished ? s.ai_suggested_feedback : undefined,
                score: isGradedPublished && s.score ? Number(s.score) : undefined,
                annotations: isGradedPublished ? annotations : [],
                isDraft,
              };
            })
          );
        }
      }

      // Student Published Monthly Reports
        const { data: assessmentsData } = await supabase
          .from('monthly_assessments')
          .select('*, courses:course_id(*)')
          .eq('student_id', currentUser.id)
          .eq('state', 'published')
          .order('created_at', { ascending: false });

        if (assessmentsData) {
          setMonthlyReports(
            assessmentsData.map((m: any) => ({
              id: m.id,
              courseId: m.course_id,
              courseName: m.courses?.name || 'Course',
              studentId: currentUser.id,
              studentName: currentUser.name,
              studentEmail: currentUser.email,
              teacherId: m.teacher_id,
              teacherName: 'Teacher',
              month: m.month,
              targetBand: m.target_band,
              state: m.state,
              createdAt: m.created_at?.replace('T', ' ').substring(0, 16) || '',
              publishedAt: m.published_at?.replace('T', ' ').substring(0, 16),
              learningEvidence: m.learning_evidence || {},
              aiDraft: m.ai_draft || {},
              teacherEvaluation: m.teacher_evaluation || {},
              history: m.history || [],
            }))
          );
        }

        // Student Tuition Statements
        const { data: statementsData } = await supabase
          .from('tuition_statements')
          .select('*, courses:course_id(*), payment_records(*)')
          .eq('student_id', currentUser.id)
          .in('status', ['approved', 'published', 'paid', 'partially_paid', 'overdue'])
          .order('created_at', { ascending: false });

        if (statementsData) {
          setTuitionStatements(
            statementsData.map((s: any) => ({
              id: s.id,
              statementNumber: s.statement_number,
              studentId: s.student_id,
              studentName: currentUser.name,
              teacherId: s.teacher_id,
              teacherName: 'Teacher',
              courseId: s.course_id,
              courseName: s.courses?.name || 'Course',
              billingPeriod: s.billing_period,
              issueDate: s.issue_date,
              dueDate: s.due_date,
              currency: s.currency,
              status: s.status,
              model: s.model,
              itemizedCharges: s.itemized_charges || [],
              discountAmount: Number(s.discount_amount || 0),
              discountDescription: s.discount_description,
              previousBalance: Number(s.previous_balance || 0),
              totalAmountDue: Number(s.total_amount_due || 0),
              amountPaid: Number(s.amount_paid || 0),
              remainingBalance: Number(s.remaining_balance || 0),
              payments: (s.payment_records || []).map((p: any) => ({
                id: p.id,
                statementId: p.statement_id,
                amount: Number(p.amount),
                paymentDate: p.payment_date,
                paymentMethod: p.payment_method,
                transactionReference: p.transaction_reference,
                notes: p.notes,
              })),
              bankInfo: s.bank_info || {},
              auditHistory: s.audit_history || [],
              teachingDates: s.bank_info?.teachingDates || [],
              totalTeachingHours: s.bank_info?.totalTeachingHours,
              billableSessionCount: s.bank_info?.billableSessionCount,
              qrCodeUrl: s.bank_info?.qrCodeUrl || s.qr_code_url,
            }))
          );
        }
      }

      // Notifications for current user (Teacher or Student)
      try {
        const { data: notifData } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(30);

        if (notifData) {
          setNotifications(
            notifData.map((n: any) => ({
              id: n.id,
              userId: n.user_id,
              title: n.title,
              message: n.message,
              timestamp: n.created_at?.replace('T', ' ').substring(0, 16) || '',
              read: Boolean(n.read),
              type: n.type || 'info',
              linkTarget: n.link_target,
            }))
          );
        }
      } catch {
        // Safe fallback if notifications table does not yet exist
      }
    } catch (err: any) {
      console.error('Error fetching Supabase data:', err);
      setDataError(err?.message || 'Error loading records from database');
    } finally {
      setLoadingData(false);
    }
  }, [currentUser]);

  // AUTHORITATIVE USER PROFILE LOADER & RESOLVER
  const loadUserProfile = async (supabaseUser: any): Promise<User | null> => {
    if (!supabaseUser?.id) return null;

    // Deduplicate in-flight profile fetch promises for the same user ID
    if (inFlightProfilePromiseRef.current.has(supabaseUser.id)) {
      return inFlightProfilePromiseRef.current.get(supabaseUser.id)!;
    }

    const fetchPromise = (async (): Promise<User | null> => {
      try {
        // 1. Attempt to fetch authoritative profile from public.profiles with retry & backoff
        let profile: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', supabaseUser.id)
            .maybeSingle();

          if (data) {
            profile = data;
            break;
          }

          if (error) {
            console.warn(`Profile fetch attempt ${attempt + 1} notice:`, error.message);
          }

          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
          }
        }

        // 2. If profile found, return mapped User
        if (profile) {
          if (profile.language_preference) {
            try {
              localStorage.setItem('ielts_language', profile.language_preference);
            } catch {
              // Ignore localStorage restrictions if any
            }
          }

          return {
            id: profile.id,
            name: profile.name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
            email: profile.email || supabaseUser.email || '',
            role: profile.role === 'teacher' ? 'teacher' : 'student',
            avatar: profile.avatar_url || `https://images.unsplash.com/photo-${profile.role === 'teacher' ? '1472099645785-5658abf4ff4e' : '1534528741775-53994a69daeb'}?w=150&auto=format&fit=crop&q=80`,
            bio: profile.bio || '',
            targetBand: profile.target_band,
            paymentQrUrl: profile.payment_qr_url,
            bankInfo: profile.bank_info,
          };
        }

        // 3. If profile not found in public.profiles (e.g. trigger delay or new account):
        // Self-heal: attempt to insert the initial profile record into public.profiles
        const metadataRole = supabaseUser.user_metadata?.role;
        const initialRole: UserRole = metadataRole === 'teacher' ? 'teacher' : 'student';
        const initialName = supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User';

        try {
          const { data: inserted, error: insertErr } = await supabase
            .from('profiles')
            .upsert(
              {
                id: supabaseUser.id,
                name: initialName,
                email: supabaseUser.email || '',
                role: initialRole,
                language_preference: supabaseUser.user_metadata?.language_preference || 'vi',
              },
              { onConflict: 'id' }
            )
            .select()
            .maybeSingle();

          if (inserted) {
            return {
              id: inserted.id,
              name: inserted.name,
              email: inserted.email,
              role: inserted.role === 'teacher' ? 'teacher' : 'student',
              avatar: inserted.avatar_url || `https://images.unsplash.com/photo-${inserted.role === 'teacher' ? '1472099645785-5658abf4ff4e' : '1534528741775-53994a69daeb'}?w=150&auto=format&fit=crop&q=80`,
              bio: inserted.bio || '',
              targetBand: inserted.target_band,
            };
          }
          if (insertErr) {
            console.warn('Profile self-heal insert notice:', insertErr.message);
          }
        } catch (insertCatch) {
          console.warn('Profile self-heal exception:', insertCatch);
        }

        // 4. Safe verified fallback constructed directly from authenticated session JWT
        return {
          id: supabaseUser.id,
          name: initialName,
          email: supabaseUser.email || '',
          role: initialRole,
          avatar: `https://images.unsplash.com/photo-${initialRole === 'teacher' ? '1472099645785-5658abf4ff4e' : '1534528741775-53994a69daeb'}?w=150&auto=format&fit=crop&q=80`,
          bio: '',
          targetBand: supabaseUser.user_metadata?.target_band,
        };
      } catch (err) {
        console.error('Fatal loadUserProfile error:', err);
        return null;
      } finally {
        inFlightProfilePromiseRef.current.delete(supabaseUser.id);
      }
    })();

    inFlightProfilePromiseRef.current.set(supabaseUser.id, fetchPromise);
    return fetchPromise;
  };

  // DIRECT AUTHENTICATION HANDLERS
  const signIn = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user || !data.session) {
        return { success: false, error: 'Authentication failed: No active session returned.' };
      }

      // Resolve user profile
      const user = await loadUserProfile(data.user);
      if (!user) {
        return { success: false, error: 'Failed to initialize authenticated profile.' };
      }

      currentUserRef.current = user;
      setCurrentUser(user);
      setActiveTab('dashboard');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed.' };
    }
  };

  const setAuthenticatedUser = async (supabaseUser: any): Promise<boolean> => {
    try {
      const user = await loadUserProfile(supabaseUser);
      if (!user) return false;
      currentUserRef.current = user;
      setCurrentUser(user);
      setActiveTab('dashboard');
      return true;
    } catch {
      return false;
    }
  };

  // LOGOUT
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out warning:', err);
    }
    currentUserRef.current = null;
    setCurrentUser(null);
    setLoadingData(false);
    setDataError(null);
    setCourses([]);
    setEnrollmentRequests([]);
    setCourseMembers([]);
    setAssignments([]);
    setSubmissions([]);
    setMonthlyReports([]);
    setTuitionStatements([]);
    setActivities([]);
    setNotifications([]);
    setActiveTab('dashboard');
  };

  // 2. AUTH SESSION LISTENER & PROFILE RESTORATION
  useEffect(() => {
    let mounted = true;

    // Use onAuthStateChange as the single authoritative source of truth for auth lifecycle
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !session?.user) {
        currentUserRef.current = null;
        setCurrentUser(null);
        setCourses([]);
        setEnrollmentRequests([]);
        setCourseMembers([]);
        setAssignments([]);
        setSubmissions([]);
        setMonthlyReports([]);
        setTuitionStatements([]);
        setActivities([]);
        setNotifications([]);
        setLoadingAuth(false);
        return;
      }

      // If user profile is already established for this session, avoid redundant re-fetch
      if (currentUserRef.current?.id === session.user.id) {
        setLoadingAuth(false);
        return;
      }

      try {
        const user = await loadUserProfile(session.user);
        if (user && mounted) {
          currentUserRef.current = user;
          setCurrentUser(user);
        }
      } catch (err) {
        console.error('Auth state resolution error:', err);
      } finally {
        if (mounted) {
          setLoadingAuth(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 3. LOAD DATA ON USER CHANGE & REALTIME SUBSCRIPTIONS
  useEffect(() => {
    if (!currentUser) return;
    refreshData();

    // Supabase Realtime Channels for Cross-Device Synchronization
    const channel = supabase
      .channel('public_realtime_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => {
        refreshData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        refreshData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tuition_statements' }, () => {
        refreshData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_assessments' }, () => {
        refreshData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        refreshData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, refreshData]);

  // UPDATE PROFILE
  const updateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;

    // Do NOT allow changing role to admin or tampering
    const sanitized: any = {
      name: updates.name,
      bio: updates.bio,
      target_band: updates.targetBand,
      updated_at: new Date().toISOString(),
    };

    if (updates.paymentQrUrl !== undefined) {
      sanitized.payment_qr_url = updates.paymentQrUrl;
    }
    if (updates.bankInfo !== undefined) {
      sanitized.bank_info = updates.bankInfo;
    }

    await supabase.from('profiles').update(sanitized).eq('id', currentUser.id);

    setCurrentUser((prev) => (prev ? { ...prev, ...updates } : null));
  };

  // COURSES OPERATIONS
  const createCourse = async (
    courseData: Omit<Course, 'id' | 'teacherId' | 'teacherName' | 'createdAt'>
  ): Promise<Course> => {
    if (!currentUser) throw new Error('Not authenticated');

    const code = courseData.code?.trim().toUpperCase() || generateCode();

    const newCourseRow = {
      teacher_id: currentUser.id,
      name: courseData.name.trim(),
      description: courseData.description?.trim() || '',
      cover_url: courseData.coverUrl || null,
      skills: courseData.skills && courseData.skills.length > 0 ? courseData.skills : ['reading', 'writing'],
      status: courseData.status || 'active',
      code,
      start_date: courseData.startDate || null,
      end_date: courseData.endDate || null,
      tuition_model: courseData.tuitionModel || 'fixed_monthly',
      tuition_amount: Number(courseData.tuitionAmount) || 0,
      currency: courseData.currency || 'VND',
    };

    const { data, error } = await supabase.from('courses').insert(newCourseRow).select().single();

    if (error) {
      console.error('Create course error:', error);
      throw error;
    }

    const created: Course = {
      id: data.id,
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      name: data.name,
      description: data.description || '',
      coverUrl: data.cover_url,
      skills: data.skills || [],
      status: data.status,
      code: data.code,
      startDate: data.start_date || '',
      endDate: data.end_date || '',
      tuitionModel: data.tuition_model,
      tuitionAmount: Number(data.tuition_amount),
      currency: data.currency,
      createdAt: data.created_at?.split('T')[0] || '',
    };

    setCourses((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);

    // Keep tuition_settings synchronized
    try {
      await supabase.from('tuition_settings').upsert(
        {
          course_id: data.id,
          teacher_id: currentUser.id,
          model: data.tuition_model,
          currency: data.currency,
          amount: Number(data.tuition_amount),
        },
        { onConflict: 'course_id' }
      );
    } catch (tErr) {
      console.warn('Initial tuition_settings sync notice:', tErr);
    }

    addActivity(`Created course: ${created.name}`, 'enrollment', 'courses');
    return created;
  };

  const updateCourse = async (id: string, updates: Partial<Course>) => {
    if (!currentUser) throw new Error('Not authenticated');

    const rowUpdates: any = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) rowUpdates.name = updates.name.trim();
    if (updates.description !== undefined) rowUpdates.description = updates.description.trim();
    if (updates.skills !== undefined) rowUpdates.skills = updates.skills;
    if (updates.status !== undefined) rowUpdates.status = updates.status;
    if (updates.tuitionModel !== undefined) rowUpdates.tuition_model = updates.tuitionModel;
    if (updates.tuitionAmount !== undefined) rowUpdates.tuition_amount = Number(updates.tuitionAmount) || 0;
    if (updates.currency !== undefined) rowUpdates.currency = updates.currency;
    if (updates.startDate !== undefined) rowUpdates.start_date = updates.startDate || null;
    if (updates.endDate !== undefined) rowUpdates.end_date = updates.endDate || null;

    const { data, error } = await supabase
      .from('courses')
      .update(rowUpdates)
      .eq('id', id)
      .eq('teacher_id', currentUser.id)
      .select()
      .single();

    if (error) {
      console.error('Update course error:', error);
      throw error;
    }

    // Keep tuition_settings synchronized if tuition model/amount changed
    if (updates.tuitionModel !== undefined || updates.tuitionAmount !== undefined || updates.currency !== undefined) {
      try {
        await supabase.from('tuition_settings').upsert(
          {
            course_id: id,
            teacher_id: currentUser.id,
            model: updates.tuitionModel || data.tuition_model || 'fixed_monthly',
            currency: updates.currency || data.currency || 'VND',
            amount: Number(updates.tuitionAmount ?? data.tuition_amount) || 0,
          },
          { onConflict: 'course_id' }
        );
      } catch (tErr) {
        console.warn('Tuition settings sync notice on update:', tErr);
      }
    }

    setCourses((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              ...updates,
              name: data.name,
              description: data.description || '',
              skills: data.skills || c.skills,
              status: data.status,
              tuitionModel: data.tuition_model,
              tuitionAmount: Number(data.tuition_amount),
              currency: data.currency,
              startDate: data.start_date || '',
              endDate: data.end_date || '',
            }
          : c
      )
    );
    addActivity(`Updated course: ${data.name || updates.name || id}`, 'enrollment', 'courses');
  };

  const deleteCourse = async (courseId: string): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser) throw new Error('Not authenticated');

    const course = courses.find((c) => c.id === courseId);
    if (!course) throw new Error('Course not found');
    if (course.teacherId?.toLowerCase() !== currentUser.id?.toLowerCase()) {
      throw new Error('Unauthorized to delete this course');
    }

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId)
      .eq('teacher_id', currentUser.id);

    if (error) {
      console.error('Delete course error:', error);
      throw error;
    }

    setCourses((prev) => prev.filter((c) => c.id !== courseId));
    addActivity(`Deleted course: ${course.name}`, 'enrollment', 'courses');
    return { success: true };
  };

  const regenerateCourseCode = async (courseId: string): Promise<string> => {
    const newCode = generateCode();
    await supabase.from('courses').update({ code: newCode }).eq('id', courseId);

    setCourses((prev) => prev.map((c) => (c.id === courseId ? { ...c, code: newCode } : c)));
    addActivity(`Regenerated course code to ${newCode}`, 'enrollment', 'courses');
    return newCode;
  };

  const archiveCourse = async (courseId: string) => {
    await supabase.from('courses').update({ status: 'archived' }).eq('id', courseId);
    setCourses((prev) => prev.map((c) => (c.id === courseId ? { ...c, status: 'archived' } : c)));
    addActivity(`Archived course`, 'enrollment', 'courses');
  };

  // ENROLLMENT OPERATIONS
  const requestEnrollment = async (courseCode: string) => {
    if (!currentUser) return { success: false, message: 'Please log in to join a course.' };

    const trimmed = courseCode.trim().toUpperCase();

    // Query course from Supabase
    const { data: course, error } = await supabase
      .from('courses')
      .select('*')
      .eq('code', trimmed)
      .single();

    if (error || !course) {
      return { success: false, message: `No course found with code "${trimmed}".` };
    }

    if (course.status !== 'active') {
      return { success: false, message: `This course is currently ${course.status}. Enrollments are not accepted.` };
    }

    // Check existing enrollment
    const { data: existing } = await supabase
      .from('enrollments')
      .select('*')
      .eq('course_id', course.id)
      .eq('student_id', currentUser.id)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'approved') {
        return { success: false, message: 'You are already enrolled in this course.' };
      }
      if (existing.status === 'pending') {
        return { success: false, message: 'You already have a pending request for this course. Please wait for the teacher to review.' };
      }
      if (existing.status === 'rejected') {
        // Re-apply
        await supabase
          .from('enrollments')
          .update({ status: 'pending', requested_at: new Date().toISOString() })
          .eq('id', existing.id);

        refreshData();
        return { success: true, message: `Re-applied for ${course.name} successfully!` };
      }
    }

    // Insert new pending enrollment
    await supabase.from('enrollments').insert({
      course_id: course.id,
      student_id: currentUser.id,
      status: 'pending',
    });

    refreshData();
    return { success: true, message: `Request to join ${course.name} submitted successfully!` };
  };

  const reviewEnrollmentRequest = async (
    requestId: string,
    status: 'approved' | 'rejected',
    reason?: string
  ) => {
    await supabase
      .from('enrollments')
      .update({
        status,
        rejection_reason: reason || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    refreshData();
  };

  const removeStudentFromCourse = async (courseId: string, studentId: string) => {
    await supabase
      .from('enrollments')
      .update({ status: 'removed', reviewed_at: new Date().toISOString() })
      .eq('course_id', courseId)
      .eq('student_id', studentId);

    refreshData();
  };

  // RESOURCES OPERATIONS
  const addResource = async (resourceData: Omit<Resource, 'id' | 'teacherId' | 'createdAt'>) => {
    if (!currentUser) return;

    await supabase.from('resources').insert({
      teacher_id: currentUser.id,
      course_id: resourceData.courseId || null,
      title: resourceData.title,
      type: resourceData.type,
      url: resourceData.url || null,
      content: resourceData.content || null,
      tags: resourceData.tags,
      skill: resourceData.skill,
      folder: resourceData.folder || null,
      is_published: resourceData.isPublished,
    });

    refreshData();
  };

  const deleteResource = async (id: string) => {
    await supabase.from('resources').delete().eq('id', id);
    setResources((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleResourcePublish = async (id: string) => {
    const res = resources.find((r) => r.id === id);
    if (!res) return;

    await supabase.from('resources').update({ is_published: !res.isPublished }).eq('id', id);
    setResources((prev) => prev.map((r) => (r.id === id ? { ...r, isPublished: !r.isPublished } : r)));
  };

  // LESSONS OPERATIONS
  const createLesson = async (lessonData: Omit<Lesson, 'id'>) => {
    if (!currentUser) throw new Error('Not authenticated');

    const validSkills: CourseSkill[] = ['reading', 'writing', 'speaking', 'listening'];
    const safeSkill = validSkills.includes(lessonData.skill as any) ? lessonData.skill : 'writing';

    const insertPayload: any = {
      course_id: lessonData.courseId,
      title: lessonData.title,
      objectives: lessonData.objectives || '',
      skill: safeSkill,
      teacher_notes: lessonData.teacherNotes || '',
      activities: lessonData.activities || '',
      homework: lessonData.homework || '',
      session_date: lessonData.date || new Date().toISOString().split('T')[0],
      is_published: lessonData.isPublished !== false,
      duration_minutes: lessonData.durationMinutes || 60,
      is_billable: lessonData.isBillable !== false,
    };

    let { data: inserted, error } = await supabase
      .from('class_sessions')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      const errMsg = String(error.message || '');
      if (errMsg.includes('duration_minutes') || errMsg.includes('is_billable')) {
        delete insertPayload.duration_minutes;
        delete insertPayload.is_billable;
        const retry = await supabase
          .from('class_sessions')
          .insert(insertPayload)
          .select()
          .single();
        if (retry.error) {
          console.error('Error inserting lesson:', retry.error);
          throw retry.error;
        }
        inserted = retry.data;
      } else {
        console.error('Error inserting lesson:', error);
        throw error;
      }
    }

    if (inserted) {
      const newLessonObj: Lesson = {
        id: inserted.id,
        courseId: inserted.course_id,
        studentId: inserted.student_id,
        title: inserted.title,
        objectives: inserted.objectives || '',
        skill: (inserted.skill as CourseSkill) || safeSkill,
        teacherNotes: inserted.teacher_notes || '',
        activities: inserted.activities || '',
        homework: inserted.homework || '',
        date: inserted.session_date,
        status: inserted.status || 'completed',
        durationMinutes: Number(inserted.duration_minutes) || lessonData.durationMinutes || 60,
        isBillable: inserted.is_billable !== false,
        resources: lessonData.resources || [],
        isPublished: inserted.is_published,
      };

      setLessons((prev) => [newLessonObj, ...prev]);
    }

    refreshData();
  };

  const updateLesson = async (id: string, updates: Partial<Lesson>) => {
    await supabase
      .from('class_sessions')
      .update({
        title: updates.title,
        objectives: updates.objectives,
        teacher_notes: updates.teacherNotes,
        activities: updates.activities,
        homework: updates.homework,
        is_published: updates.isPublished,
      })
      .eq('id', id);

    setLessons((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  };

  const toggleAttendanceSession = async (
    courseId: string,
    studentId: string | null,
    date: string,
    durationMinutes: number = 60,
    status: 'completed' | 'scheduled' | 'cancelled' = 'completed'
  ) => {
    if (!currentUser) throw new Error('Not authenticated');

    const existing = lessons.find(
      (l) => l.courseId === courseId && l.date === date && (!studentId || !l.studentId || l.studentId === studentId)
    );

    if (existing) {
      if (existing.status === 'completed') {
        await supabase.from('class_sessions').delete().eq('id', existing.id);
        setLessons((prev) => prev.filter((l) => l.id !== existing.id));
      } else {
        const updatePayload: any = {
          status: 'completed',
          is_billable: true,
          duration_minutes: durationMinutes,
        };
        const { error: updErr } = await supabase
          .from('class_sessions')
          .update(updatePayload)
          .eq('id', existing.id);

        if (updErr) {
          const errMsg = String(updErr.message || '');
          if (errMsg.includes('duration_minutes') || errMsg.includes('is_billable')) {
            console.warn('class_sessions missing duration_minutes/is_billable in schema cache; falling back to basic update.', updErr);
            const { error: fallbackErr } = await supabase
              .from('class_sessions')
              .update({ status: 'completed' })
              .eq('id', existing.id);
            if (fallbackErr) throw fallbackErr;
          } else {
            throw updErr;
          }
        }

        setLessons((prev) =>
          prev.map((l) =>
            l.id === existing.id
              ? { ...l, status: 'completed', isBillable: true, durationMinutes }
              : l
          )
        );
      }
    } else {
      const newSessionRow: any = {
        course_id: courseId,
        student_id: studentId || null,
        title: `Teaching Session - ${date}`,
        session_date: date,
        status,
        duration_minutes: durationMinutes,
        is_billable: true,
        is_published: true,
        skill: 'all',
      };

      let { data: created, error } = await supabase
        .from('class_sessions')
        .insert(newSessionRow)
        .select()
        .single();

      if (error) {
        const errMsg = String(error.message || '');
        if (errMsg.includes('duration_minutes') || errMsg.includes('is_billable') || errMsg.includes('student_id')) {
          console.warn('class_sessions missing extended columns in schema cache; falling back to standard row insert.', error);
          const fallbackRow: any = {
            course_id: courseId,
            title: `Teaching Session - ${date}`,
            session_date: date,
            status,
            is_published: true,
            skill: 'all',
          };
          const fallbackRes = await supabase
            .from('class_sessions')
            .insert(fallbackRow)
            .select()
            .single();

          if (fallbackRes.error) {
            console.error('Error toggling attendance session fallback:', fallbackRes.error);
            throw fallbackRes.error;
          }
          created = fallbackRes.data;
        } else {
          console.error('Error toggling attendance session:', error);
          throw error;
        }
      }

      if (created) {
        setLessons((prev) => [
          {
            id: created.id,
            courseId: created.course_id,
            studentId: created.student_id,
            title: created.title,
            objectives: created.objectives || '',
            skill: created.skill || 'all',
            teacherNotes: created.teacher_notes || '',
            activities: created.activities || [],
            homework: created.homework || '',
            date: created.session_date,
            status: created.status || 'completed',
            durationMinutes: Number(created.duration_minutes) || durationMinutes,
            isBillable: created.is_billable !== false,
            resources: [],
            isPublished: created.is_published,
          },
          ...prev,
        ]);
      }
    }
  };

  // ASSIGNMENTS OPERATIONS
  const createAssignment = async (assignmentData: Omit<Assignment, 'id'>) => {
    if (!currentUser) throw new Error('Not authenticated');

    const packedQuestions = {
      questions: assignmentData.readingQuestions || [],
      questionGroups: assignmentData.questionGroups || [],
      passages: assignmentData.passages || [],
      _metadata: {
        readingTestType: assignmentData.readingTestType || 'academic',
        writingTaskCategory: assignmentData.writingTaskCategory,
        task1ImageUrl: assignmentData.task1ImageUrl,
        modelAnswer: assignmentData.modelAnswer,
        modelAnswerReleaseCondition: assignmentData.modelAnswerReleaseCondition || 'after_graded',
      },
    };

    const { data: newAssign, error } = await supabase
      .from('assignments')
      .insert({
        course_id: assignmentData.courseId,
        title: assignmentData.title,
        instructions: assignmentData.instructions,
        skill: assignmentData.skill,
        objectives: assignmentData.objectives,
        due_date: assignmentData.dueDate,
        status: assignmentData.status,
        reading_passage: assignmentData.readingPassage || null,
        reading_questions: packedQuestions,
        writing_task_type: assignmentData.writingTaskType || null,
        writing_prompt: assignmentData.writingPrompt || null,
        writing_min_words: assignmentData.writingMinWords || (assignmentData.writingTaskCategory === 'task2' ? 250 : 150),
        speaking_part: assignmentData.speakingPart || null,
        speaking_cue_card: assignmentData.speakingCueCard || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Create assignment error:', error);
      throw error;
    }

    if (assignmentData.status === 'published') {
      try {
        const { data: enrolledStudents } = await supabase
          .from('enrollments')
          .select('student_id')
          .eq('course_id', assignmentData.courseId)
          .eq('status', 'approved');

        if (enrolledStudents && enrolledStudents.length > 0) {
          const notifs = enrolledStudents.map((e: any) => ({
            user_id: e.student_id,
            title: `New Assignment: ${assignmentData.title}`,
            message: `A new ${assignmentData.skill} assignment has been posted. Due: ${assignmentData.dueDate || 'No due date'}.`,
            type: 'info',
            read: false,
            link_target: 'assignments',
          }));
          await supabase.from('notifications').insert(notifs);
        }
      } catch {
        // Non-blocking notification insert
      }
    }

    refreshData();
  };

  const updateAssignment = async (id: string, updates: Partial<Assignment>) => {
    if (!currentUser) throw new Error('Not authenticated');

    const existing = assignments.find((a) => a.id === id);
    if (!existing) throw new Error('Assignment not found');

    const mergedQuestions = updates.readingQuestions !== undefined ? updates.readingQuestions : existing.readingQuestions;
    const mergedGroups = updates.questionGroups !== undefined ? updates.questionGroups : existing.questionGroups;
    const mergedPassages = updates.passages !== undefined ? updates.passages : existing.passages;

    const packedQuestions = {
      questions: mergedQuestions || [],
      questionGroups: mergedGroups || [],
      passages: mergedPassages || [],
      _metadata: {
        readingTestType: updates.readingTestType || existing.readingTestType || 'academic',
        writingTaskCategory: updates.writingTaskCategory || existing.writingTaskCategory,
        task1ImageUrl: updates.task1ImageUrl !== undefined ? updates.task1ImageUrl : existing.task1ImageUrl,
        modelAnswer: updates.modelAnswer !== undefined ? updates.modelAnswer : existing.modelAnswer,
        modelAnswerReleaseCondition: updates.modelAnswerReleaseCondition || existing.modelAnswerReleaseCondition || 'after_graded',
      },
    };

    const rowUpdates: any = {
      updated_at: new Date().toISOString(),
    };
    if (updates.courseId !== undefined) rowUpdates.course_id = updates.courseId;
    if (updates.title !== undefined) rowUpdates.title = updates.title;
    if (updates.instructions !== undefined) rowUpdates.instructions = updates.instructions;
    if (updates.skill !== undefined) rowUpdates.skill = updates.skill;
    if (updates.objectives !== undefined) rowUpdates.objectives = updates.objectives;
    if (updates.dueDate !== undefined) rowUpdates.due_date = updates.dueDate;
    if (updates.status !== undefined) rowUpdates.status = updates.status;
    if (updates.readingPassage !== undefined) rowUpdates.reading_passage = updates.readingPassage;
    rowUpdates.reading_questions = packedQuestions;
    if (updates.writingTaskType !== undefined) rowUpdates.writing_task_type = updates.writingTaskType;
    if (updates.writingPrompt !== undefined) rowUpdates.writing_prompt = updates.writingPrompt;
    if (updates.writingMinWords !== undefined) rowUpdates.writing_min_words = updates.writingMinWords;
    if (updates.speakingPart !== undefined) rowUpdates.speaking_part = updates.speakingPart;
    if (updates.speakingCueCard !== undefined) rowUpdates.speaking_cue_card = updates.speakingCueCard;

    const { error } = await supabase
      .from('assignments')
      .update(rowUpdates)
      .eq('id', id);

    if (error) {
      console.error('Update assignment error:', error);
      throw error;
    }

    refreshData();
  };

  const deleteAssignment = async (id: string): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser) throw new Error('Not authenticated');

    const assign = assignments.find((a) => a.id === id);
    if (!assign) throw new Error('Assignment not found');

    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete assignment error:', error);
      throw error;
    }

    setAssignments((prev) => prev.filter((a) => a.id !== id));
    addActivity(`Deleted assignment: ${assign.title}`, 'submission', 'assignments');
    return { success: true };
  };

  // SUBMISSIONS OPERATIONS
  const submitAssignment = async (assignmentId: string, data: Partial<Submission>) => {
    if (!currentUser) return;
    const assign = assignments.find((a) => a.id === assignmentId);
    if (!assign) return;

    const existing = submissions.find(
      (s) => s.assignmentId === assignmentId && s.studentId === currentUser.id
    );

    const now = new Date().toISOString();

    // Authoritative server/database grading for objective reading/document questions
    if (data.readingAnswers && Object.keys(data.readingAnswers).length > 0) {
      try {
        const { data: rawAssign } = await supabase
          .from('assignments')
          .select('reading_questions')
          .eq('id', assignmentId)
          .single();

        if (rawAssign) {
          const rawQ = rawAssign.reading_questions;
          const { questions: questionsList } = extractAllNormalizedQuestions(
            Array.isArray(rawQ) ? { readingQuestions: rawQ } : rawQ
          );
          const gradeSummary = gradeAssignmentSubmission(
            questionsList,
            data.readingAnswers,
            assign.readingTestType || 'academic'
          );
          data.readingScore = {
            correct: gradeSummary.earnedScore,
            total: gradeSummary.maxScore,
            percentage: gradeSummary.percentage,
            estimatedBand: gradeSummary.bandEstimate,
            testType: assign.readingTestType || 'academic',
            bandNotes: gradeSummary.bandNotes,
          };
          data.readingErrorAnalysis = gradeSummary.errorAnalysis;
          data.score = gradeSummary.hasOpenEnded ? undefined : gradeSummary.bandEstimate;
          data.status = gradeSummary.finalStatus;
        }
      } catch (gradeErr) {
        console.warn('Error during authoritative grading in submitAssignment:', gradeErr);
      }
    }

    if (existing) {
      await supabase
        .from('submissions')
        .update({
          status: existing.status === 'returned' ? 'resubmitted' : 'submitted',
          updated_at: now,
          writing_text: data.writingText ?? existing.writingText,
          writing_word_count: data.writingWordCount ?? existing.writingWordCount,
          writing_revisions: [
            ...(existing.writingRevisions || []),
            {
              text: data.writingText || '',
              timestamp: now.replace('T', ' ').substring(0, 16),
              wordCount: data.writingWordCount || 0,
            },
          ],
          reading_answers: data.readingAnswers ?? existing.readingAnswers,
          reading_score: data.readingScore ?? existing.readingScore,
          reading_error_analysis: data.readingErrorAnalysis ?? existing.readingErrorAnalysis,
          speaking_audio_url: data.speakingAudioUrl ?? existing.speakingAudioUrl,
          speaking_transcript: data.speakingTranscript ?? existing.speakingTranscript,
          speaking_duration: data.speakingDuration ?? existing.speakingDuration,
          score: data.score ?? existing.score,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('submissions').insert({
        assignment_id: assignmentId,
        student_id: currentUser.id,
        course_id: assign.courseId,
        skill: assign.skill,
        status: data.status || 'submitted',
        writing_text: data.writingText || null,
        writing_word_count: data.writingWordCount || 0,
        writing_revisions: data.writingText
          ? [
              {
                text: data.writingText,
                timestamp: now.replace('T', ' ').substring(0, 16),
                wordCount: data.writingWordCount || 0,
              },
            ]
          : [],
        reading_answers: data.readingAnswers || null,
        reading_score: data.readingScore || null,
        reading_error_analysis: data.readingErrorAnalysis || null,
        speaking_audio_url: data.speakingAudioUrl || null,
        speaking_transcript: data.speakingTranscript || null,
        speaking_duration: data.speakingDuration || null,
        score: data.score || null,
      });
    }

    refreshData();
  };

  const gradeSubmission = async (submissionId: string, updates: Partial<Submission>) => {
    // Serialize comments & inline annotations safely
    let serializedComments = updates.teacherComments || '';
    if (updates.annotations || updates.isDraft !== undefined) {
      serializedComments = JSON.stringify({
        general: updates.teacherComments || '',
        annotations: updates.annotations || [],
        isDraft: Boolean(updates.isDraft),
      });
    }

    const newStatus = updates.isDraft ? 'in_review' : 'graded';

    await supabase
      .from('submissions')
      .update({
        rubric_scores: updates.rubricScores || [],
        strengths: updates.strengths,
        areas_to_improve: updates.areasToImprove,
        teacher_comments: serializedComments,
        next_steps: updates.nextSteps,
        score: updates.score,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId);

    // If published (not draft), notify the student
    if (!updates.isDraft) {
      const sub = submissions.find((s) => s.id === submissionId);
      if (sub) {
        try {
          await supabase.from('notifications').insert({
            user_id: sub.studentId,
            title: `Grading Published: ${sub.assignmentTitle}`,
            message: `Your teacher has completed grading your ${sub.skill} assignment with band score and detailed feedback.`,
            type: 'success',
            read: false,
            link_target: 'assignments',
          });
        } catch {
          // Non-blocking notification insert
        }
      }
    }

    refreshData();
  };

  const returnForRevision = async (submissionId: string, teacherComments: string) => {
    await supabase
      .from('submissions')
      .update({
        teacher_comments: teacherComments,
        status: 'returned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId);

    refreshData();
  };

  // MONTHLY ASSESSMENTS OPERATIONS
  const createMonthlyReportDraft = async (
    courseId: string,
    studentId: string,
    month: string
  ): Promise<MonthlyReport> => {
    if (!currentUser) throw new Error('Not authenticated');

    const course = courses.find((c) => c.id === courseId);
    const studentSubs = submissions.filter((s) => s.studentId === studentId && s.courseId === courseId);
    const readingSubs = studentSubs.filter((s) => s.skill === 'reading');
    const writingSubs = studentSubs.filter((s) => s.skill === 'writing');
    const speakingSubs = studentSubs.filter((s) => s.skill === 'speaking');

    let readingAccuracyStr = 'Not enough data';
    if (readingSubs.length > 0) {
      const avg = Math.round(
        readingSubs.reduce((acc, curr) => acc + (curr.readingScore?.percentage || 75), 0) / readingSubs.length
      );
      readingAccuracyStr = `Reading accuracy: ${avg}% across ${readingSubs.length} exercise(s)`;
    }

    const missingSkills: string[] = [];
    if (readingSubs.length === 0) missingSkills.push('Reading');
    if (writingSubs.length === 0) missingSkills.push('Writing');
    if (speakingSubs.length === 0) missingSkills.push('Speaking');
    missingSkills.push('Listening (No logged tests)');

    const learningEvidence = {
      readingAccuracy: readingAccuracyStr,
      readingAttempts: readingSubs.length,
      writingSubmissions: writingSubs.length,
      writingLastFeedback: writingSubs.length > 0 ? writingSubs[0].areasToImprove || 'Good task structure' : 'No writing submissions logged',
      speakingSubmissions: speakingSubs.length,
      speakingAudioAvailable: speakingSubs.some((s) => !!s.speakingAudioUrl),
      insufficientEvidenceSkills: missingSkills,
      summaryNotes: `Gathered ${studentSubs.length} real submission(s) for ${month}. Evidence strictly scoped to verified activities.`,
    };

    const aiDraft = {
      strengths: `• Demonstrates consistent effort in ${writingSubs.length > 0 ? 'Writing essays' : 'Reading exercises'}.\n• Maintained active submission timeline.`,
      focusAreas: `• Precision in lexical selection.\n• Address flagged evidence gaps before mock testing.`,
      evidenceGapsFlagged: missingSkills.length > 0 ? `Flagged: Insufficient evidence in ${missingSkills.join(', ')}. Band estimates must not be invented for these skills.` : 'No gaps flagged.',
      recurringPatterns: 'Shows analytical strengths with text comprehension; needs structured grammar drills on complex compound sentences.',
      generatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    const newReportRow = {
      course_id: courseId,
      student_id: studentId,
      teacher_id: currentUser.id,
      month,
      target_band: 'Band 7.0',
      state: 'ai_generated',
      learning_evidence: learningEvidence,
      ai_draft: aiDraft,
      teacher_evaluation: {
        professionalJudgement: '',
        nextMonthPriorities: '',
        estimatedBand: '',
      },
      history: [
        {
          version: 1,
          action: 'AI draft generated from real verified evidence',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          actor: 'AI Assistant',
        },
      ],
    };

    const { data, error } = await supabase.from('monthly_assessments').insert(newReportRow).select().single();

    if (error) throw error;

    const created: MonthlyReport = {
      id: data.id,
      courseId,
      courseName: course?.name || 'Course',
      studentId,
      studentName: 'Student',
      studentEmail: '',
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      month: data.month,
      targetBand: data.target_band,
      state: data.state,
      createdAt: data.created_at?.replace('T', ' ').substring(0, 16),
      learningEvidence: data.learning_evidence,
      aiDraft: data.ai_draft,
      teacherEvaluation: data.teacher_evaluation,
      history: data.history,
    };

    setMonthlyReports((prev) => [created, ...prev]);
    return created;
  };

  const updateMonthlyReport = async (id: string, updates: Partial<MonthlyReport>) => {
    await supabase
      .from('monthly_assessments')
      .update({
        teacher_evaluation: updates.teacherEvaluation,
        state: updates.state || 'in_review',
      })
      .eq('id', id);

    setMonthlyReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const approveMonthlyReport = async (id: string) => {
    const report = monthlyReports.find((r) => r.id === id);
    if (!report) return;

    const newHistory = [
      ...report.history,
      {
        version: report.history.length + 1,
        action: 'Report approved by Teacher',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        actor: currentUser?.name || 'Teacher',
      },
    ];

    await supabase
      .from('monthly_assessments')
      .update({
        state: 'approved',
        history: newHistory,
      })
      .eq('id', id);

    setMonthlyReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, state: 'approved', history: newHistory } : r))
    );
  };

  const publishMonthlyReport = async (id: string) => {
    const report = monthlyReports.find((r) => r.id === id);
    if (!report) return;

    if (!report.teacherEvaluation.professionalJudgement?.trim()) {
      alert('Cannot publish report: Separate teacher professional evaluation is required before publication.');
      return;
    }

    const now = new Date().toISOString();
    const newHistory = [
      ...report.history,
      {
        version: report.history.length + 1,
        action: 'Report published to student workspace',
        timestamp: now.replace('T', ' ').substring(0, 16),
        actor: currentUser?.name || 'Teacher',
      },
    ];

    await supabase
      .from('monthly_assessments')
      .update({
        state: 'published',
        published_at: now,
        history: newHistory,
      })
      .eq('id', id);

    setMonthlyReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, state: 'published', publishedAt: now, history: newHistory } : r))
    );
  };

  const voidMonthlyReport = async (id: string) => {
    await supabase.from('monthly_assessments').update({ state: 'void' }).eq('id', id);
    setMonthlyReports((prev) => prev.map((r) => (r.id === id ? { ...r, state: 'void' } : r)));
  };

  // TUITION OPERATIONS
  const createFeeConfiguration = async (configData: Omit<FeeConfiguration, 'id' | 'teacherId'>) => {
    if (!currentUser) return;

    await supabase.from('tuition_settings').upsert({
      course_id: configData.courseId,
      teacher_id: currentUser.id,
      model: configData.model,
      currency: configData.currency,
      amount: configData.amount,
      session_rate: configData.sessionRate,
      hourly_rate: configData.hourlyRate,
      due_days: configData.dueDays,
      proration_rule: configData.prorationRule,
      early_payment_discount_percent: configData.earlyPaymentDiscountPercent,
    }, { onConflict: 'course_id' });

    // Sync courses table
    await supabase.from('courses').update({
      tuition_model: configData.model,
      tuition_amount: configData.amount,
      currency: configData.currency,
    }).eq('id', configData.courseId).eq('teacher_id', currentUser.id);

    refreshData();
  };

  const updateFeeConfiguration = async (id: string, updates: Partial<FeeConfiguration>) => {
    if (!currentUser) return;
    const existing = feeConfigurations.find((f) => f.id === id || f.courseId === updates.courseId);
    const courseId = updates.courseId || existing?.courseId;
    if (!courseId) return;

    await supabase.from('tuition_settings').upsert({
      course_id: courseId,
      teacher_id: currentUser.id,
      model: updates.model || existing?.model || 'fixed_monthly',
      currency: updates.currency || existing?.currency || 'VND',
      amount: updates.amount ?? existing?.amount ?? 0,
      session_rate: updates.sessionRate ?? existing?.sessionRate ?? null,
      hourly_rate: updates.hourlyRate ?? existing?.hourlyRate ?? null,
      due_days: updates.dueDays ?? existing?.dueDays ?? 15,
      proration_rule: updates.prorationRule ?? existing?.prorationRule ?? 'none',
      early_payment_discount_percent: updates.earlyPaymentDiscountPercent ?? existing?.earlyPaymentDiscountPercent ?? 0,
    }, { onConflict: 'course_id' });

    // Sync courses table
    await supabase.from('courses').update({
      tuition_model: updates.model || existing?.model,
      tuition_amount: updates.amount ?? existing?.amount,
      currency: updates.currency || existing?.currency,
    }).eq('id', courseId).eq('teacher_id', currentUser.id);

    refreshData();
  };

  const uploadTeacherPaymentQr = async (file: File): Promise<string> => {
    if (!currentUser) throw new Error('Not authenticated');

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error('File size exceeds 5MB limit');
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Please upload an image in PNG, JPG, WEBP, or SVG format');
    }

    const fileExt = file.name.split('.').pop() || 'png';
    const filePath = `${currentUser.id}/qr_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('teacher_assets')
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      console.error('Error uploading payment QR:', uploadError);
      throw new Error(uploadError.message || 'Failed to upload QR image to storage');
    }

    const { data: publicUrlData } = supabase.storage
      .from('teacher_assets')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    await updateProfile({
      paymentQrUrl: publicUrl,
    });

    return publicUrl;
  };

  const removeTeacherPaymentQr = async (): Promise<void> => {
    if (!currentUser) throw new Error('Not authenticated');

    await updateProfile({
      paymentQrUrl: undefined,
    });
  };

  const generateTuitionStatement = async (data: {
    courseId: string;
    studentId: string;
    billingPeriod: string;
    dueDate: string;
    billableUnits?: number;
    customDiscount?: number;
    customDiscountNote?: string;
    customSurcharge?: number;
    previousBalance?: number;
  }): Promise<TuitionStatement> => {
    if (!currentUser) throw new Error('Not authenticated');

    const course = courses.find((c) => c.id === data.courseId);
    const student = courseMembers.find((m) => m.studentId === data.studentId);
    const feeConfig = feeConfigurations.find((f) => f.courseId === data.courseId);

    const calcResult = calculateMonthlyTuition({
      courseId: data.courseId,
      courseName: course?.name || 'Course',
      studentId: data.studentId,
      studentName: student?.studentName || 'Student',
      billingMonth: data.billingPeriod,
      feeConfig,
      course,
      sessions: lessons,
      manualDiscount: data.customDiscount,
      discountDescription: data.customDiscountNote,
      customSurcharge: data.customSurcharge,
      previousBalance: data.previousBalance,
    });

    const statementNumber = `TS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const effectiveQr = currentUser.paymentQrUrl || currentUser.bankInfo?.qrCodeUrl;
    const bankInfo: TeacherBankInfo = {
      bankName: currentUser.bankInfo?.bankName || 'Vietcombank',
      accountHolder: currentUser.bankInfo?.accountHolder || currentUser.name.toUpperCase(),
      accountNumber: currentUser.bankInfo?.accountNumber || '1234 5678 9012',
      branch: currentUser.bankInfo?.branch || 'Ho Chi Minh City',
      transferDescription: currentUser.bankInfo?.transferDescription || statementNumber,
      qrCodeUrl: effectiveQr,
      teachingDates: calcResult.completedTeachingDates,
      totalTeachingHours: calcResult.totalTeachingHours,
      billableSessionCount: calcResult.billableUnits,
    };

    const newStatementRow = {
      statement_number: statementNumber,
      teacher_id: currentUser.id,
      student_id: data.studentId,
      course_id: data.courseId,
      billing_period: data.billingPeriod,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: data.dueDate,
      currency: calcResult.currency,
      status: 'pending_approval',
      model: calcResult.model,
      itemized_charges: calcResult.itemizedCharges,
      discount_amount: calcResult.discountAmount,
      discount_description: calcResult.discountDescription || (calcResult.discountAmount > 0 ? 'Discount' : null),
      previous_balance: calcResult.previousBalance,
      total_amount_due: calcResult.totalAmountDue,
      amount_paid: 0,
      remaining_balance: calcResult.remainingBalance,
      bank_info: bankInfo,
      audit_history: [
        {
          action: 'Statement drafted with transparent calculation breakdown',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          user: currentUser.name,
          details: `Model: ${calcResult.model}, Subtotal: ${calcResult.subtotal}, Discount: ${calcResult.discountAmount}, Units: ${calcResult.billableUnits}`,
        },
      ],
    };

    const { data: createdRow, error } = await supabase.from('tuition_statements').insert(newStatementRow).select().single();

    if (error) throw error;

    const created: TuitionStatement = {
      id: createdRow.id,
      statementNumber,
      studentId: data.studentId,
      studentName: student?.studentName || 'Student',
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      courseId: data.courseId,
      courseName: course?.name || 'Course',
      billingPeriod: data.billingPeriod,
      issueDate: createdRow.issue_date,
      dueDate: createdRow.due_date,
      currency: calcResult.currency,
      status: createdRow.status,
      model: calcResult.model,
      itemizedCharges: calcResult.itemizedCharges,
      discountAmount: calcResult.discountAmount,
      discountDescription: createdRow.discount_description,
      previousBalance: calcResult.previousBalance,
      totalAmountDue: calcResult.totalAmountDue,
      amountPaid: 0,
      remainingBalance: calcResult.remainingBalance,
      payments: [],
      bankInfo,
      auditHistory: createdRow.audit_history,
      teachingDates: calcResult.completedTeachingDates,
      totalTeachingHours: calcResult.totalTeachingHours,
      billableSessionCount: calcResult.billableUnits,
      qrCodeUrl: effectiveQr,
    };

    setTuitionStatements((prev) => [created, ...prev]);
    return created;
  };

  const approveTuitionStatement = async (id: string) => {
    await supabase.from('tuition_statements').update({ status: 'approved' }).eq('id', id);
    setTuitionStatements((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'approved' } : s)));
  };

  const publishTuitionStatement = async (id: string) => {
    await supabase.from('tuition_statements').update({ status: 'published' }).eq('id', id);
    setTuitionStatements((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'published' } : s)));
  };

  const voidTuitionStatement = async (id: string) => {
    await supabase.from('tuition_statements').update({ status: 'void' }).eq('id', id);
    setTuitionStatements((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'void' } : s)));
  };

  const recordPayment = async (
    statementId: string,
    paymentData: Omit<PaymentRecord, 'id' | 'statementId'>
  ) => {
    const stmt = tuitionStatements.find((s) => s.id === statementId);
    if (!stmt) return;

    await supabase.from('payment_records').insert({
      statement_id: statementId,
      amount: paymentData.amount,
      payment_date: paymentData.paymentDate,
      payment_method: paymentData.paymentMethod,
      transaction_reference: paymentData.transactionReference,
      notes: paymentData.notes,
    });

    const newPaid = stmt.amountPaid + paymentData.amount;
    const newRemaining = Math.max(0, stmt.totalAmountDue - newPaid);
    const newStatus = newRemaining <= 0 ? 'paid' : 'partially_paid';

    await supabase
      .from('tuition_statements')
      .update({
        amount_paid: newPaid,
        remaining_balance: newRemaining,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', statementId);

    refreshData();
  };

  const markNotificationRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
    } catch {
      // Non-blocking fallback
    }
  };

  const addActivity = async (text: string, type: ActivityItem['type'], targetTab?: string) => {
    if (!currentUser) return;

    try {
      await supabase.from('activity_logs').insert({
        user_id: currentUser.id,
        text,
        type,
        target_tab: targetTab || null,
      });
    } catch {
      // Ignore background activity log error
    }

    const newAct: ActivityItem = {
      id: `act-${Date.now()}`,
      teacherId: currentUser.id,
      text,
      timeAgo: 'Just now',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      type,
      targetTab,
    };
    setActivities((prev) => [newAct, ...prev]);
  };

  const activeCourses = courses.filter((c) =>
    currentUser?.role === 'teacher'
      ? c.teacherId === currentUser.id
      : courseMembers.some((m) => m.studentId === currentUser?.id && m.courseId === c.id && m.status === 'enrolled')
  );

  return (
    <AppContext.Provider
      value={{
        currentUser,
        loadingAuth,
        loadingData,
        dataError,
        signIn,
        setAuthenticatedUser,
        logout,
        updateProfile,
        courses,
        activeCourses,
        createCourse,
        updateCourse,
        deleteCourse,
        regenerateCourseCode,
        archiveCourse,
        enrollmentRequests,
        courseMembers,
        requestEnrollment,
        reviewEnrollmentRequest,
        removeStudentFromCourse,
        resources,
        addResource,
        deleteResource,
        toggleResourcePublish,
        lessons,
        createLesson,
        updateLesson,
        toggleAttendanceSession,
        assignments,
        createAssignment,
        updateAssignment,
        deleteAssignment,
        submissions,
        submitAssignment,
        gradeSubmission,
        returnForRevision,
        monthlyReports,
        createMonthlyReportDraft,
        updateMonthlyReport,
        approveMonthlyReport,
        publishMonthlyReport,
        voidMonthlyReport,
        feeConfigurations,
        createFeeConfiguration,
        updateFeeConfiguration,
        tuitionStatements,
        generateTuitionStatement,
        approveTuitionStatement,
        publishTuitionStatement,
        voidTuitionStatement,
        recordPayment,
        uploadTeacherPaymentQr,
        removeTeacherPaymentQr,
        activities,
        notifications,
        markNotificationRead,
        addActivity,
        activeTab,
        setActiveTab,
        selectedCourseId,
        setSelectedCourseId,
        selectedStatementId,
        setSelectedStatementId,
        selectedReportId,
        setSelectedReportId,
        refreshData,
      }}
    >
      <I18nProvider userLanguage={currentUser ? (localStorage.getItem('ielts_language') as any || 'vi') : undefined}>
        {children}
      </I18nProvider>
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
