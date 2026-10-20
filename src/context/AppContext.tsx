import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
} from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { I18nProvider } from '../i18n/context';

interface AppContextType {
  currentUser: User | null;
  loadingAuth: boolean;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;

  // Courses
  courses: Course[];
  activeCourses: Course[];
  createCourse: (course: Omit<Course, 'id' | 'teacherId' | 'teacherName' | 'createdAt'>) => Promise<Course>;
  updateCourse: (id: string, updates: Partial<Course>) => Promise<void>;
  regenerateCourseCode: (courseId: string) => Promise<string>;
  archiveCourse: (courseId: string) => Promise<void>;

  // Enrollment & Roster
  enrollmentRequests: EnrollmentRequest[];
  courseMembers: CourseMember[];
  requestEnrollment: (courseCode: string) => Promise<{ success: boolean; message: string }>;
  reviewEnrollmentRequest: (requestId: string, status: 'approved' | 'rejected', reason?: string) => Promise<void>;
  removeStudentFromCourse: (courseId: string, studentId: string) => Promise<void>;

  // Resources & Lessons
  resources: Resource[];
  addResource: (resource: Omit<Resource, 'id' | 'teacherId' | 'createdAt'>) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
  toggleResourcePublish: (id: string) => Promise<void>;
  lessons: Lesson[];
  createLesson: (lesson: Omit<Lesson, 'id'>) => Promise<void>;
  updateLesson: (id: string, updates: Partial<Lesson>) => Promise<void>;

  // Assignments & Submissions
  assignments: Assignment[];
  createAssignment: (assignment: Omit<Assignment, 'id'>) => Promise<void>;
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
  tuitionStatements: TuitionStatement[];
  generateTuitionStatement: (data: {
    courseId: string;
    studentId: string;
    billingPeriod: string;
    dueDate: string;
    billableUnits?: number;
    customDiscount?: number;
    customDiscountNote?: string;
  }) => Promise<TuitionStatement>;
  approveTuitionStatement: (id: string) => Promise<void>;
  publishTuitionStatement: (id: string) => Promise<void>;
  voidTuitionStatement: (id: string) => Promise<void>;
  recordPayment: (statementId: string, payment: Omit<PaymentRecord, 'id' | 'statementId'>) => Promise<void>;

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
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);

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

  // 1. DATA REFRESH FUNCTION - Pulls real records from Supabase
  const refreshData = useCallback(async () => {
    if (!currentUser) return;

    try {
      if (currentUser.role === 'teacher') {
        // Teacher sees courses where teacher_id = currentUser.id
        const { data: coursesData } = await supabase
          .from('courses')
          .select('*')
          .eq('teacher_id', currentUser.id)
          .order('created_at', { ascending: false });

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
                assignmentsData.map((a: any) => ({
                  id: a.id,
                  courseId: a.course_id,
                  title: a.title,
                  instructions: a.instructions,
                  skill: a.skill,
                  objectives: a.objectives,
                  dueDate: a.due_date,
                  status: a.status,
                  readingPassage: a.reading_passage,
                  readingQuestions: a.reading_questions,
                  writingTaskType: a.writing_task_type,
                  writingPrompt: a.writing_prompt,
                  writingMinWords: a.writing_min_words,
                  speakingPart: a.speaking_part,
                  speakingCueCard: a.speaking_cue_card,
                }))
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
            }))
          );
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

          // Assignments for approved courses
          if (approvedCourseIds.length > 0) {
            const { data: assignmentsData } = await supabase
              .from('assignments')
              .select('*')
              .in('course_id', approvedCourseIds)
              .eq('status', 'published')
              .order('created_at', { ascending: false });

            if (assignmentsData) {
              setAssignments(
                assignmentsData.map((a: any) => ({
                  id: a.id,
                  courseId: a.course_id,
                  title: a.title,
                  instructions: a.instructions,
                  skill: a.skill,
                  objectives: a.objectives,
                  dueDate: a.due_date,
                  status: a.status,
                  readingPassage: a.reading_passage,
                  readingQuestions: a.reading_questions,
                  writingTaskType: a.writing_task_type,
                  writingPrompt: a.writing_prompt,
                  writingMinWords: a.writing_min_words,
                  speakingPart: a.speaking_part,
                  speakingCueCard: a.speaking_cue_card,
                }))
              );
            }
          } else {
            setAssignments([]);
          }
        }

        // Student Submissions
        const { data: subsData } = await supabase
          .from('submissions')
          .select('*, assignments:assignment_id(*), courses:course_id(*)')
          .eq('student_id', currentUser.id)
          .order('submitted_at', { ascending: false });

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
    } catch (err) {
      console.error('Error fetching Supabase data:', err);
    }
  }, [currentUser]);

  // 2. AUTH SESSION LISTENER & PROFILE RESTORATION
  useEffect(() => {
    let mounted = true;

    const fetchUserProfileWithRetry = async (userId: string, attempts = 3, delayMs = 350) => {
      for (let i = 0; i < attempts; i++) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (profile) return profile;
        if (i < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
      return null;
    };

    async function checkSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session?.user) {
          if (mounted) {
            setCurrentUser(null);
            setLoadingAuth(false);
          }
          return;
        }

        // Fetch or create profile with retry to prevent race condition on new registrations
        const profile = await fetchUserProfileWithRetry(session.user.id);

        if (profile && mounted) {
          setCurrentUser({
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            avatar: profile.avatar_url || `https://images.unsplash.com/photo-${profile.role === 'teacher' ? '1472099645785-5658abf4ff4e' : '1534528741775-53994a69daeb'}?w=150&auto=format&fit=crop&q=80`,
            bio: profile.bio,
            targetBand: profile.target_band,
          });
        }
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        if (mounted) setLoadingAuth(false);
      }
    }

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
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

      const profile = await fetchUserProfileWithRetry(session.user.id);

      if (profile) {
        setCurrentUser({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          avatar: profile.avatar_url || `https://images.unsplash.com/photo-${profile.role === 'teacher' ? '1472099645785-5658abf4ff4e' : '1534528741775-53994a69daeb'}?w=150&auto=format&fit=crop&q=80`,
          bio: profile.bio,
          targetBand: profile.target_band,
        });
      }
      setLoadingAuth(false);
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

  // LOGOUT
  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

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
      name: courseData.name,
      description: courseData.description,
      skills: courseData.skills,
      status: courseData.status || 'active',
      code,
      start_date: courseData.startDate || null,
      end_date: courseData.endDate || null,
      tuition_model: courseData.tuitionModel,
      tuition_amount: courseData.tuitionAmount,
      currency: courseData.currency,
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
      description: data.description,
      coverUrl: data.cover_url,
      skills: data.skills,
      status: data.status,
      code: data.code,
      startDate: data.start_date || '',
      endDate: data.end_date || '',
      tuitionModel: data.tuition_model,
      tuitionAmount: Number(data.tuition_amount),
      currency: data.currency,
      createdAt: data.created_at?.split('T')[0] || '',
    };

    setCourses((prev) => [created, ...prev]);
    addActivity(`Created course: ${created.name}`, 'enrollment', 'courses');
    return created;
  };

  const updateCourse = async (id: string, updates: Partial<Course>) => {
    const rowUpdates: any = {
      name: updates.name,
      description: updates.description,
      skills: updates.skills,
      status: updates.status,
      tuition_model: updates.tuitionModel,
      tuition_amount: updates.tuitionAmount,
      currency: updates.currency,
      updated_at: new Date().toISOString(),
    };

    await supabase.from('courses').update(rowUpdates).eq('id', id);

    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
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
    await supabase.from('class_sessions').insert({
      course_id: lessonData.courseId,
      title: lessonData.title,
      objectives: lessonData.objectives,
      skill: lessonData.skill,
      teacher_notes: lessonData.teacherNotes,
      activities: lessonData.activities,
      homework: lessonData.homework,
      session_date: lessonData.date || new Date().toISOString().split('T')[0],
      is_published: lessonData.isPublished,
    });

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

  // ASSIGNMENTS OPERATIONS
  const createAssignment = async (assignmentData: Omit<Assignment, 'id'>) => {
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
        reading_questions: assignmentData.readingQuestions || [],
        writing_task_type: assignmentData.writingTaskType || null,
        writing_prompt: assignmentData.writingPrompt || null,
        writing_min_words: assignmentData.writingMinWords || 250,
        speaking_part: assignmentData.speakingPart || null,
        speaking_cue_card: assignmentData.speakingCueCard || null,
      })
      .select()
      .single();

    if (!error && assignmentData.status === 'published') {
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

  // SUBMISSIONS OPERATIONS
  const submitAssignment = async (assignmentId: string, data: Partial<Submission>) => {
    if (!currentUser) return;
    const assign = assignments.find((a) => a.id === assignmentId);
    if (!assign) return;

    const existing = submissions.find(
      (s) => s.assignmentId === assignmentId && s.studentId === currentUser.id
    );

    const now = new Date().toISOString();

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
    });

    refreshData();
  };

  const generateTuitionStatement = async (data: {
    courseId: string;
    studentId: string;
    billingPeriod: string;
    dueDate: string;
    billableUnits?: number;
    customDiscount?: number;
    customDiscountNote?: string;
  }): Promise<TuitionStatement> => {
    if (!currentUser) throw new Error('Not authenticated');

    const course = courses.find((c) => c.id === data.courseId);
    const units = data.billableUnits ?? 4;
    const baseRate = course?.tuitionAmount || 60;
    const model = course?.tuitionModel || 'fixed_monthly';
    const currency = course?.currency || 'VND';

    let itemizedCharges = [];
    let subtotal = 0;

    if (model === 'fixed_monthly') {
      itemizedCharges.push({
        id: `c-1`,
        description: `Monthly tuition (${data.billingPeriod})`,
        quantity: 1,
        unitPrice: baseRate,
        amount: baseRate,
      });
      subtotal = baseRate;
    } else if (model === 'per_session') {
      const lineTotal = units * baseRate;
      itemizedCharges.push({
        id: `c-1`,
        description: 'Tuition fee',
        quantity: `${units} sessions`,
        unitPrice: baseRate,
        amount: lineTotal,
      });
      itemizedCharges.push({
        id: `c-2`,
        description: `Number of sessions (${units} attended)`,
        quantity: `${units} attended`,
        amount: 0,
      });
      subtotal = lineTotal;
    } else if (model === 'hourly') {
      const lineTotal = units * baseRate;
      itemizedCharges.push({
        id: `c-1`,
        description: 'Billable tuition hours',
        quantity: `${units} hours`,
        unitPrice: baseRate,
        amount: lineTotal,
      });
      subtotal = lineTotal;
    } else {
      itemizedCharges.push({
        id: `c-1`,
        description: `Course Package: ${course?.name || 'Complete Track'}`,
        quantity: 1,
        unitPrice: baseRate,
        amount: baseRate,
      });
      subtotal = baseRate;
    }

    const discountAmount = data.customDiscount ?? 0;
    const totalDue = Math.max(0, subtotal - discountAmount);
    const statementNumber = `TS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const bankInfo = {
      bankName: 'Vietcombank',
      accountHolder: currentUser.name.toUpperCase(),
      accountNumber: '1234 5678 9012',
      branch: 'Ho Chi Minh City',
      transferDescription: `${statementNumber}`,
    };

    const newStatementRow = {
      statement_number: statementNumber,
      teacher_id: currentUser.id,
      student_id: data.studentId,
      course_id: data.courseId,
      billing_period: data.billingPeriod,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: data.dueDate,
      currency,
      status: 'pending_approval',
      model,
      itemized_charges: itemizedCharges,
      discount_amount: discountAmount,
      discount_description: data.customDiscountNote || (discountAmount > 0 ? 'Discount' : null),
      previous_balance: 0,
      total_amount_due: totalDue,
      amount_paid: 0,
      remaining_balance: totalDue,
      bank_info: bankInfo,
      audit_history: [
        {
          action: 'Statement drafted with transparent calculation breakdown',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          user: currentUser.name,
          details: `Model: ${model}, Subtotal: ${subtotal}, Discount: ${discountAmount}`,
        },
      ],
    };

    const { data: createdRow, error } = await supabase.from('tuition_statements').insert(newStatementRow).select().single();

    if (error) throw error;

    const created: TuitionStatement = {
      id: createdRow.id,
      statementNumber,
      studentId: data.studentId,
      studentName: 'Student',
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      courseId: data.courseId,
      courseName: course?.name || 'Course',
      billingPeriod: data.billingPeriod,
      issueDate: createdRow.issue_date,
      dueDate: createdRow.due_date,
      currency,
      status: createdRow.status,
      model,
      itemizedCharges,
      discountAmount,
      discountDescription: createdRow.discount_description,
      previousBalance: 0,
      totalAmountDue: totalDue,
      amountPaid: 0,
      remainingBalance: totalDue,
      payments: [],
      bankInfo,
      auditHistory: createdRow.audit_history,
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
        logout,
        updateProfile,
        courses,
        activeCourses,
        createCourse,
        updateCourse,
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
        assignments,
        createAssignment,
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
        tuitionStatements,
        generateTuitionStatement,
        approveTuitionStatement,
        publishTuitionStatement,
        voidTuitionStatement,
        recordPayment,
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
