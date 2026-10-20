import React, { createContext, useContext, useState, useEffect } from 'react';
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
} from '../types';
import {
  initialUsers,
  initialCourses,
  initialEnrollmentRequests,
  initialCourseMembers,
  initialResources,
  initialLessons,
  initialAssignments,
  initialSubmissions,
  initialMonthlyReports,
  initialFeeConfigurations,
  initialTuitionStatements,
  initialActivities,
  initialNotifications,
} from '../data/mockData';

interface AppContextType {
  currentUser: User;
  switchUser: (userId: string) => void;
  users: User[];
  registerUser: (name: string, email: string, role: 'teacher' | 'student') => void;

  // Courses
  courses: Course[];
  activeCourses: Course[];
  createCourse: (course: Omit<Course, 'id' | 'teacherId' | 'teacherName' | 'createdAt'>) => Course;
  updateCourse: (id: string, updates: Partial<Course>) => void;
  regenerateCourseCode: (courseId: string) => string;
  archiveCourse: (courseId: string) => void;

  // Enrollment & Roster
  enrollmentRequests: EnrollmentRequest[];
  courseMembers: CourseMember[];
  requestEnrollment: (courseCode: string) => { success: boolean; message: string };
  reviewEnrollmentRequest: (requestId: string, status: 'approved' | 'rejected', reason?: string) => void;
  removeStudentFromCourse: (courseId: string, studentId: string) => void;

  // Resources & Lessons
  resources: Resource[];
  addResource: (resource: Omit<Resource, 'id' | 'teacherId' | 'createdAt'>) => void;
  deleteResource: (id: string) => void;
  toggleResourcePublish: (id: string) => void;
  lessons: Lesson[];
  createLesson: (lesson: Omit<Lesson, 'id'>) => void;
  updateLesson: (id: string, updates: Partial<Lesson>) => void;

  // Assignments & Submissions
  assignments: Assignment[];
  createAssignment: (assignment: Omit<Assignment, 'id'>) => void;
  submissions: Submission[];
  submitAssignment: (assignmentId: string, data: Partial<Submission>) => void;
  gradeSubmission: (submissionId: string, updates: Partial<Submission>) => void;
  returnForRevision: (submissionId: string, teacherComments: string) => void;

  // Monthly Assessments
  monthlyReports: MonthlyReport[];
  createMonthlyReportDraft: (courseId: string, studentId: string, month: string) => MonthlyReport;
  updateMonthlyReport: (id: string, updates: Partial<MonthlyReport>) => void;
  approveMonthlyReport: (id: string) => void;
  publishMonthlyReport: (id: string) => void;
  voidMonthlyReport: (id: string) => void;

  // Tuition
  feeConfigurations: FeeConfiguration[];
  createFeeConfiguration: (config: Omit<FeeConfiguration, 'id' | 'teacherId'>) => void;
  tuitionStatements: TuitionStatement[];
  generateTuitionStatement: (data: {
    courseId: string;
    studentId: string;
    billingPeriod: string;
    dueDate: string;
    billableUnits?: number; // sessions or hours
    customDiscount?: number;
    customDiscountNote?: string;
  }) => TuitionStatement;
  approveTuitionStatement: (id: string) => void;
  publishTuitionStatement: (id: string) => void;
  voidTuitionStatement: (id: string) => void;
  recordPayment: (statementId: string, payment: Omit<PaymentRecord, 'id' | 'statementId'>) => void;

  // Activities & Notifications
  activities: ActivityItem[];
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  addActivity: (text: string, type: ActivityItem['type'], targetTab?: string) => void;

  // Navigation
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedCourseId: string | null;
  setSelectedCourseId: (id: string | null) => void;
  selectedStatementId: string | null;
  setSelectedStatementId: (id: string | null) => void;
  selectedReportId: string | null;
  setSelectedReportId: (id: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Local storage keys or fallback
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('ielts_users');
    return saved ? JSON.parse(saved) : initialUsers;
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return localStorage.getItem('ielts_current_user') || 'teacher-1';
  });

  const currentUser = users.find((u) => u.id === currentUserId) || users[0];

  const [courses, setCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem('ielts_courses');
    return saved ? JSON.parse(saved) : initialCourses;
  });

  const [enrollmentRequests, setEnrollmentRequests] = useState<EnrollmentRequest[]>(() => {
    const saved = localStorage.getItem('ielts_enrollment_requests');
    return saved ? JSON.parse(saved) : initialEnrollmentRequests;
  });

  const [courseMembers, setCourseMembers] = useState<CourseMember[]>(() => {
    const saved = localStorage.getItem('ielts_course_members');
    return saved ? JSON.parse(saved) : initialCourseMembers;
  });

  const [resources, setResources] = useState<Resource[]>(() => {
    const saved = localStorage.getItem('ielts_resources');
    return saved ? JSON.parse(saved) : initialResources;
  });

  const [lessons, setLessons] = useState<Lesson[]>(() => {
    const saved = localStorage.getItem('ielts_lessons');
    return saved ? JSON.parse(saved) : initialLessons;
  });

  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    const saved = localStorage.getItem('ielts_assignments');
    return saved ? JSON.parse(saved) : initialAssignments;
  });

  const [submissions, setSubmissions] = useState<Submission[]>(() => {
    const saved = localStorage.getItem('ielts_submissions');
    return saved ? JSON.parse(saved) : initialSubmissions;
  });

  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>(() => {
    const saved = localStorage.getItem('ielts_monthly_reports');
    return saved ? JSON.parse(saved) : initialMonthlyReports;
  });

  const [feeConfigurations, setFeeConfigurations] = useState<FeeConfiguration[]>(() => {
    const saved = localStorage.getItem('ielts_fee_configs');
    return saved ? JSON.parse(saved) : initialFeeConfigurations;
  });

  const [tuitionStatements, setTuitionStatements] = useState<TuitionStatement[]>(() => {
    const saved = localStorage.getItem('ielts_tuition_statements');
    return saved ? JSON.parse(saved) : initialTuitionStatements;
  });

  const [activities, setActivities] = useState<ActivityItem[]>(() => {
    const saved = localStorage.getItem('ielts_activities');
    return saved ? JSON.parse(saved) : initialActivities;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem('ielts_notifications');
    return saved ? JSON.parse(saved) : initialNotifications;
  });

  // Navigation state
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('ielts_current_user', currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    localStorage.setItem('ielts_courses', JSON.stringify(courses));
  }, [courses]);

  useEffect(() => {
    localStorage.setItem('ielts_enrollment_requests', JSON.stringify(enrollmentRequests));
  }, [enrollmentRequests]);

  useEffect(() => {
    localStorage.setItem('ielts_course_members', JSON.stringify(courseMembers));
  }, [courseMembers]);

  useEffect(() => {
    localStorage.setItem('ielts_resources', JSON.stringify(resources));
  }, [resources]);

  useEffect(() => {
    localStorage.setItem('ielts_lessons', JSON.stringify(lessons));
  }, [lessons]);

  useEffect(() => {
    localStorage.setItem('ielts_assignments', JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    localStorage.setItem('ielts_submissions', JSON.stringify(submissions));
  }, [submissions]);

  useEffect(() => {
    localStorage.setItem('ielts_monthly_reports', JSON.stringify(monthlyReports));
  }, [monthlyReports]);

  useEffect(() => {
    localStorage.setItem('ielts_fee_configs', JSON.stringify(feeConfigurations));
  }, [feeConfigurations]);

  useEffect(() => {
    localStorage.setItem('ielts_tuition_statements', JSON.stringify(tuitionStatements));
  }, [tuitionStatements]);

  const switchUser = (userId: string) => {
    setCurrentUserId(userId);
    setActiveTab('dashboard');
    setSelectedCourseId(null);
    setSelectedStatementId(null);
    setSelectedReportId(null);
  };

  const registerUser = (name: string, email: string, role: 'teacher' | 'student') => {
    const newUser: User = {
      id: `user-${Date.now()}`,
      name,
      email,
      role,
      avatar: `https://images.unsplash.com/photo-${role === 'teacher' ? '1472099645785-5658abf4ff4e' : '1534528741775-53994a69daeb'}?w=150&auto=format&fit=crop&q=80`,
    };
    setUsers((prev) => [...prev, newUser]);
    switchUser(newUser.id);
  };

  // Helper for generating course codes
  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for (let i = 0; i < 7; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  const createCourse = (courseData: Omit<Course, 'id' | 'teacherId' | 'teacherName' | 'createdAt'>): Course => {
    const newCourse: Course = {
      ...courseData,
      id: `course-${Date.now()}`,
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      code: courseData.code || generateCode(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    setCourses((prev) => [newCourse, ...prev]);
    addActivity(`Created course: ${newCourse.name}`, 'enrollment', 'courses');
    return newCourse;
  };

  const updateCourse = (id: string, updates: Partial<Course>) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const regenerateCourseCode = (courseId: string): string => {
    const newCode = generateCode();
    setCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, code: newCode } : c))
    );
    addActivity(`Regenerated course code to ${newCode}`, 'enrollment', 'courses');
    return newCode;
  };

  const archiveCourse = (courseId: string) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, status: 'archived' } : c))
    );
    addActivity(`Archived course`, 'enrollment', 'courses');
  };

  // Enrollment
  const requestEnrollment = (courseCode: string) => {
    const trimmed = courseCode.trim().toUpperCase();
    const course = courses.find((c) => c.code.toUpperCase() === trimmed);

    if (!course) {
      return { success: false, message: 'No course found with this code. Please verify with your teacher.' };
    }

    if (course.status !== 'active') {
      return {
        success: false,
        message: `This course is currently ${course.status}. New enrollments are not accepted.`,
      };
    }

    // Check if already enrolled
    const alreadyEnrolled = courseMembers.some(
      (m) => m.courseId === course.id && m.studentId === currentUser.id && m.status === 'enrolled'
    );
    if (alreadyEnrolled) {
      return { success: false, message: 'You are already enrolled in this course.' };
    }

    // Check if duplicate pending request
    const existingPending = enrollmentRequests.find(
      (r) => r.courseId === course.id && r.studentId === currentUser.id && r.status === 'pending'
    );
    if (existingPending) {
      return {
        success: false,
        message: 'You already have a pending request for this course. Please wait for the teacher to review.',
      };
    }

    const newRequest: EnrollmentRequest = {
      id: `req-${Date.now()}`,
      courseId: course.id,
      courseName: course.name,
      studentId: currentUser.id,
      studentName: currentUser.name,
      studentEmail: currentUser.email,
      status: 'pending',
      requestedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    setEnrollmentRequests((prev) => [newRequest, ...prev]);

    // Send notification to teacher
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        userId: course.teacherId,
        title: 'New Enrollment Request',
        message: `${currentUser.name} requested to join ${course.name}.`,
        timestamp: 'Just now',
        read: false,
        type: 'info',
        linkTarget: 'courses',
      },
      ...prev,
    ]);

    return { success: true, message: `Request to join ${course.name} submitted successfully!` };
  };

  const reviewEnrollmentRequest = (requestId: string, status: 'approved' | 'rejected', reason?: string) => {
    const req = enrollmentRequests.find((r) => r.id === requestId);
    if (!req) return;

    setEnrollmentRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status,
              rejectionReason: reason,
              reviewedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
            }
          : r
      )
    );

    if (status === 'approved') {
      // Add to course roster if not already added
      const exists = courseMembers.find((m) => m.courseId === req.courseId && m.studentId === req.studentId);
      if (exists) {
        setCourseMembers((prev) =>
          prev.map((m) => (m.id === exists.id ? { ...m, status: 'enrolled' } : m))
        );
      } else {
        const newMember: CourseMember = {
          id: `member-${Date.now()}`,
          courseId: req.courseId,
          studentId: req.studentId,
          studentName: req.studentName,
          studentEmail: req.studentEmail,
          status: 'enrolled',
          joinedAt: new Date().toISOString().split('T')[0],
          recentActivity: 'Joined course',
          outstandingWork: 0,
        };
        setCourseMembers((prev) => [...prev, newMember]);
      }

      // Notify student
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          userId: req.studentId,
          title: 'Enrollment Approved!',
          message: `Your request to join ${req.courseName} was approved. You can now access all course lessons and assignments.`,
          timestamp: 'Just now',
          read: false,
          type: 'success',
          linkTarget: 'courses',
        },
        ...prev,
      ]);
    } else {
      // Notify student rejected
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          userId: req.studentId,
          title: 'Enrollment Request Update',
          message: `Your request to join ${req.courseName} was not approved.${reason ? ` Reason: ${reason}` : ''}`,
          timestamp: 'Just now',
          read: false,
          type: 'warning',
          linkTarget: 'courses',
        },
        ...prev,
      ]);
    }

    addActivity(
      `${status === 'approved' ? 'Approved' : 'Rejected'} enrollment request for ${req.studentName} in ${req.courseName}`,
      'enrollment',
      'courses'
    );
  };

  const removeStudentFromCourse = (courseId: string, studentId: string) => {
    // History preserved: we set status to 'removed', not delete record!
    setCourseMembers((prev) =>
      prev.map((m) =>
        m.courseId === courseId && m.studentId === studentId ? { ...m, status: 'removed' } : m
      )
    );
    addActivity(`Removed student from course (historical records preserved)`, 'enrollment', 'courses');
  };

  // Resources
  const addResource = (resourceData: Omit<Resource, 'id' | 'teacherId' | 'createdAt'>) => {
    const newRes: Resource = {
      ...resourceData,
      id: `res-${Date.now()}`,
      teacherId: currentUser.id,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setResources((prev) => [newRes, ...prev]);
  };

  const deleteResource = (id: string) => {
    setResources((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleResourcePublish = (id: string) => {
    setResources((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isPublished: !r.isPublished } : r))
    );
  };

  // Lessons
  const createLesson = (lessonData: Omit<Lesson, 'id'>) => {
    const newLesson: Lesson = {
      ...lessonData,
      id: `les-${Date.now()}`,
    };
    setLessons((prev) => [...prev, newLesson]);
  };

  const updateLesson = (id: string, updates: Partial<Lesson>) => {
    setLessons((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
  };

  // Assignments
  const createAssignment = (assignmentData: Omit<Assignment, 'id'>) => {
    const newAssign: Assignment = {
      ...assignmentData,
      id: `assign-${Date.now()}`,
    };
    setAssignments((prev) => [...prev, newAssign]);
    addActivity(`Published new assignment: ${newAssign.title}`, 'submission', 'assignments');
  };

  const submitAssignment = (assignmentId: string, data: Partial<Submission>) => {
    const assign = assignments.find((a) => a.id === assignmentId);
    if (!assign) return;

    const existingIndex = submissions.findIndex(
      (s) => s.assignmentId === assignmentId && s.studentId === currentUser.id
    );

    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    if (existingIndex >= 0) {
      // Resubmission or revision
      const existing = submissions[existingIndex];
      const updated: Submission = {
        ...existing,
        ...data,
        status: existing.status === 'returned' ? 'resubmitted' : 'submitted',
        updatedAt: now,
        writingRevisions: [
          ...(existing.writingRevisions || []),
          {
            text: data.writingText || '',
            timestamp: now,
            wordCount: data.writingWordCount || 0,
          },
        ],
      };
      const updatedSubmissions = [...submissions];
      updatedSubmissions[existingIndex] = updated;
      setSubmissions(updatedSubmissions);
    } else {
      const newSub: Submission = {
        id: `sub-${Date.now()}`,
        assignmentId,
        assignmentTitle: assign.title,
        studentId: currentUser.id,
        studentName: currentUser.name,
        courseId: assign.courseId,
        courseName: courses.find((c) => c.id === assign.courseId)?.name || 'Course',
        skill: assign.skill,
        status: 'submitted',
        submittedAt: now,
        updatedAt: now,
        writingRevisions: data.writingText
          ? [
              {
                text: data.writingText,
                timestamp: now,
                wordCount: data.writingWordCount || 0,
              },
            ]
          : [],
        ...data,
      };
      setSubmissions((prev) => [newSub, ...prev]);
    }

    addActivity(`${currentUser.name} submitted assignment: ${assign.title}`, 'submission', 'assignments');
  };

  const gradeSubmission = (submissionId: string, updates: Partial<Submission>) => {
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId
          ? {
              ...s,
              ...updates,
              status: 'graded',
              updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
            }
          : s
      )
    );
    const sub = submissions.find((s) => s.id === submissionId);
    if (sub) {
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          userId: sub.studentId,
          title: 'Assignment Graded',
          message: `Your work for "${sub.assignmentTitle}" has been graded with feedback.`,
          timestamp: 'Just now',
          read: false,
          type: 'success',
          linkTarget: 'assignments',
        },
        ...prev,
      ]);
    }
  };

  const returnForRevision = (submissionId: string, teacherComments: string) => {
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId
          ? {
              ...s,
              teacherComments,
              status: 'returned',
              updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
            }
          : s
      )
    );
    const sub = submissions.find((s) => s.id === submissionId);
    if (sub) {
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          userId: sub.studentId,
          title: 'Submission Returned for Revision',
          message: `Teacher requested revision for "${sub.assignmentTitle}": ${teacherComments}`,
          timestamp: 'Just now',
          read: false,
          type: 'warning',
          linkTarget: 'assignments',
        },
        ...prev,
      ]);
    }
  };

  // Monthly Reports
  const createMonthlyReportDraft = (courseId: string, studentId: string, month: string): MonthlyReport => {
    const course = courses.find((c) => c.id === courseId);
    const student = users.find((u) => u.id === studentId);

    // Collect real student learning evidence
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

    const newReport: MonthlyReport = {
      id: `rep-${Date.now()}`,
      courseId,
      courseName: course?.name || 'IELTS Course',
      studentId,
      studentName: student?.name || 'Student',
      studentEmail: student?.email || '',
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      month,
      targetBand: student?.targetBand ? `Band ${student.targetBand}` : 'Band 7.0',
      state: 'ai_generated',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      learningEvidence: {
        readingAccuracy: readingAccuracyStr,
        readingAttempts: readingSubs.length,
        writingSubmissions: writingSubs.length,
        writingLastFeedback: writingSubs.length > 0 ? writingSubs[0].areasToImprove || 'Good task structure' : 'No writing submissions logged',
        speakingSubmissions: speakingSubs.length,
        speakingAudioAvailable: speakingSubs.some((s) => !!s.speakingAudioUrl),
        insufficientEvidenceSkills: missingSkills,
        summaryNotes: `Gathered ${studentSubs.length} real submission(s) for ${month}. Evidence strictly scoped to verified activities.`,
      },
      aiDraft: {
        strengths: `• Demonstrates consistent effort in ${writingSubs.length > 0 ? 'Writing essays' : 'Reading exercises'}.\n• Maintained active submission timeline.`,
        focusAreas: `• Precision in lexical selection.\n• Address flagged evidence gaps before mock testing.`,
        evidenceGapsFlagged: missingSkills.length > 0 ? `Flagged: Insufficient evidence in ${missingSkills.join(', ')}. Band estimates must not be invented for these skills.` : 'No gaps flagged.',
        recurringPatterns: 'Shows analytical strengths with text comprehension; needs structured grammar drills on complex compound sentences.',
        generatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      },
      teacherEvaluation: {
        professionalJudgement: '',
        nextMonthPriorities: '',
        estimatedBand: '',
      },
      history: [
        {
          version: 1,
          action: 'AI draft generated from real logs',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          actor: 'AI Assistant',
        },
      ],
    };

    setMonthlyReports((prev) => [newReport, ...prev]);
    return newReport;
  };

  const updateMonthlyReport = (id: string, updates: Partial<MonthlyReport>) => {
    setMonthlyReports((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = {
          ...r,
          ...updates,
          state: r.state === 'ai_generated' ? 'in_review' : (updates.state || r.state),
        };
        return updated;
      })
    );
  };

  const approveMonthlyReport = (id: string) => {
    setMonthlyReports((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              state: 'approved',
              teacherEvaluation: {
                ...r.teacherEvaluation,
                approvedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
              },
              history: [
                ...r.history,
                {
                  version: r.history.length + 1,
                  action: 'Report approved by Teacher',
                  timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
                  actor: currentUser.name,
                },
              ],
            }
          : r
      )
    );
  };

  const publishMonthlyReport = (id: string) => {
    const report = monthlyReports.find((r) => r.id === id);
    if (!report) return;

    if (!report.teacherEvaluation.professionalJudgement.trim()) {
      alert('Cannot publish report: Separate teacher professional evaluation is required before publication.');
      return;
    }

    setMonthlyReports((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              state: 'published',
              publishedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
              history: [
                ...r.history,
                {
                  version: r.history.length + 1,
                  action: 'Report published to student workspace',
                  timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
                  actor: currentUser.name,
                },
              ],
            }
          : r
      )
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        userId: report.studentId,
        title: 'Monthly Learning Report Published',
        message: `Your ${report.month} report for ${report.courseName} is now available in your workspace.`,
        timestamp: 'Just now',
        read: false,
        type: 'info',
        linkTarget: 'assessments',
      },
      ...prev,
    ]);

    addActivity(`Published monthly assessment report for ${report.studentName}`, 'report', 'assessments');
  };

  const voidMonthlyReport = (id: string) => {
    setMonthlyReports((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              state: 'void',
              history: [
                ...r.history,
                {
                  version: r.history.length + 1,
                  action: 'Report marked as Void (archived with history)',
                  timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
                  actor: currentUser.name,
                },
              ],
            }
          : r
      )
    );
  };

  // Tuition & Statements
  const createFeeConfiguration = (configData: Omit<FeeConfiguration, 'id' | 'teacherId'>) => {
    const newConfig: FeeConfiguration = {
      ...configData,
      id: `fee-${Date.now()}`,
      teacherId: currentUser.id,
    };
    setFeeConfigurations((prev) => [newConfig, ...prev]);
  };

  const generateTuitionStatement = (data: {
    courseId: string;
    studentId: string;
    billingPeriod: string;
    dueDate: string;
    billableUnits?: number;
    customDiscount?: number;
    customDiscountNote?: string;
  }): TuitionStatement => {
    const course = courses.find((c) => c.id === data.courseId);
    const student = users.find((u) => u.id === data.studentId);
    const feeConfig = feeConfigurations.find((f) => f.courseId === data.courseId);

    const model = feeConfig?.model || course?.tuitionModel || 'fixed_monthly';
    const currency = feeConfig?.currency || course?.currency || 'USD';
    const baseRate = feeConfig?.amount || course?.tuitionAmount || 100;
    const units = data.billableUnits ?? 4;

    let itemizedCharges = [];
    let subtotal = 0;

    if (model === 'fixed_monthly') {
      itemizedCharges.push({
        id: `c-${Date.now()}-1`,
        description: `Monthly tuition (${data.billingPeriod})`,
        quantity: 1,
        unitPrice: baseRate,
        amount: baseRate,
      });
      subtotal = baseRate;
    } else if (model === 'per_session') {
      const lineTotal = units * (feeConfig?.sessionRate || baseRate);
      itemizedCharges.push({
        id: `c-${Date.now()}-1`,
        description: 'Tuition fee',
        quantity: `${units} sessions`,
        unitPrice: feeConfig?.sessionRate || baseRate,
        amount: lineTotal,
      });
      itemizedCharges.push({
        id: `c-${Date.now()}-2`,
        description: `Number of sessions (${units} attended)`,
        quantity: `${units} attended`,
        amount: 0,
      });
      subtotal = lineTotal;
    } else if (model === 'hourly') {
      const lineTotal = units * (feeConfig?.hourlyRate || baseRate);
      itemizedCharges.push({
        id: `c-${Date.now()}-1`,
        description: 'Billable tuition hours',
        quantity: `${units} hours`,
        unitPrice: feeConfig?.hourlyRate || baseRate,
        amount: lineTotal,
      });
      subtotal = lineTotal;
    } else {
      // Course package
      itemizedCharges.push({
        id: `c-${Date.now()}-1`,
        description: `Course Package Bundle: ${course?.name || 'Complete Track'}`,
        quantity: 1,
        unitPrice: baseRate,
        amount: baseRate,
      });
      subtotal = baseRate;
    }

    const discountAmount = data.customDiscount ?? (feeConfig?.earlyPaymentDiscountPercent ? (subtotal * feeConfig.earlyPaymentDiscountPercent) / 100 : 0);
    const totalDue = Math.max(0, subtotal - discountAmount);

    const statementNumber = `TS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newStatement: TuitionStatement = {
      id: `stmt-${Date.now()}`,
      statementNumber,
      studentId: data.studentId,
      studentName: student?.name || 'Student',
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      courseId: data.courseId,
      courseName: course?.name || 'Course',
      billingPeriod: data.billingPeriod,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: data.dueDate,
      currency,
      status: 'pending_approval',
      model,
      itemizedCharges,
      discountAmount,
      discountDescription: data.customDiscountNote || (discountAmount > 0 ? 'Applied Discount' : undefined),
      previousBalance: 0,
      totalAmountDue: totalDue,
      amountPaid: 0,
      remainingBalance: totalDue,
      payments: [],
      bankInfo: {
        bankName: 'Vietcombank',
        accountHolder: currentUser.name.toUpperCase(),
        accountNumber: '1234 5678 9012',
        branch: 'Ho Chi Minh City',
        transferDescription: `${student?.name.toUpperCase()} ${statementNumber}`,
      },
      auditHistory: [
        {
          action: 'Statement drafted with transparent calculation breakdown',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          user: currentUser.name,
          details: `Model: ${model}, Subtotal: ${subtotal}, Discount: ${discountAmount}`,
        },
      ],
    };

    setTuitionStatements((prev) => [newStatement, ...prev]);
    return newStatement;
  };

  const approveTuitionStatement = (id: string) => {
    setTuitionStatements((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              status: 'approved',
              auditHistory: [
                ...s.auditHistory,
                {
                  action: 'Statement approved by Teacher',
                  timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
                  user: currentUser.name,
                  details: 'Ready for publishing or PDF generation',
                },
              ],
            }
          : s
      )
    );
  };

  const publishTuitionStatement = (id: string) => {
    const stmt = tuitionStatements.find((s) => s.id === id);
    if (!stmt) return;

    setTuitionStatements((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              status: s.amountPaid >= s.totalAmountDue ? 'paid' : (s.amountPaid > 0 ? 'partially_paid' : 'approved'),
              auditHistory: [
                ...s.auditHistory,
                {
                  action: 'Statement published to student workspace',
                  timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
                  user: currentUser.name,
                  details: 'Student can now view breakdown and export PDF',
                },
              ],
            }
          : s
      )
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        userId: stmt.studentId,
        title: 'Tuition Statement Published',
        message: `Your statement ${stmt.statementNumber} for ${stmt.billingPeriod} has been published. Due: ${stmt.dueDate}`,
        timestamp: 'Just now',
        read: false,
        type: 'info',
        linkTarget: 'tuition',
      },
      ...prev,
    ]);
  };

  const voidTuitionStatement = (id: string) => {
    setTuitionStatements((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              status: 'void',
              auditHistory: [
                ...s.auditHistory,
                {
                  action: 'Statement voided',
                  timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
                  user: currentUser.name,
                  details: 'Withdrawn from active statements, history preserved.',
                },
              ],
            }
          : s
      )
    );
  };

  const recordPayment = (statementId: string, paymentData: Omit<PaymentRecord, 'id' | 'statementId'>) => {
    const stmt = tuitionStatements.find((s) => s.id === statementId);
    if (!stmt) return;

    const newPayment: PaymentRecord = {
      ...paymentData,
      id: `pay-${Date.now()}`,
      statementId,
    };

    const newPaid = stmt.amountPaid + paymentData.amount;
    const newRemaining = Math.max(0, stmt.totalAmountDue - newPaid);
    const newStatus = newRemaining <= 0 ? 'paid' : 'partially_paid';

    setTuitionStatements((prev) =>
      prev.map((s) =>
        s.id === statementId
          ? {
              ...s,
              amountPaid: newPaid,
              remainingBalance: newRemaining,
              status: newStatus,
              payments: [...s.payments, newPayment],
              auditHistory: [
                ...s.auditHistory,
                {
                  action: `Recorded payment: ${paymentData.amount.toLocaleString()} ${s.currency}`,
                  timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
                  user: currentUser.name,
                  details: `Ref: ${paymentData.transactionReference || 'N/A'}, Method: ${paymentData.paymentMethod}`,
                },
              ],
            }
          : s
      )
    );

    addActivity(
      `Recorded payment of ${paymentData.amount.toLocaleString()} ${stmt.currency} for ${stmt.studentName} (${stmt.statementNumber})`,
      'payment',
      'tuition'
    );

    // Notify student
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        userId: stmt.studentId,
        title: 'Payment Confirmed',
        message: `Your payment of ${paymentData.amount.toLocaleString()} ${stmt.currency} for ${stmt.statementNumber} was confirmed.`,
        timestamp: 'Just now',
        read: false,
        type: 'success',
        linkTarget: 'tuition',
      },
      ...prev,
    ]);
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const addActivity = (text: string, type: ActivityItem['type'], targetTab?: string) => {
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
    currentUser.role === 'teacher'
      ? c.teacherId === currentUser.id
      : courseMembers.some((m) => m.studentId === currentUser.id && m.courseId === c.id && m.status === 'enrolled')
  );

  return (
    <AppContext.Provider
      value={{
        currentUser,
        switchUser,
        users,
        registerUser,
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
      }}
    >
      {children}
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
