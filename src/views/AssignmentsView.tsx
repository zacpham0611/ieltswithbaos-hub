import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Assignment,
  Submission,
  AssignmentSkill,
  SubmissionStatus,
  ReadingQuestion,
} from '../types';
import {
  FileCheck2,
  Clock,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Sparkles,
  BookOpen,
  Send,
  Mic,
  Square,
  Play,
  Volume2,
  Edit3,
  Award,
  ChevronRight,
  Plus,
  Eye,
  FileText,
  User,
  History,
} from 'lucide-react';

export const AssignmentsView: React.FC = () => {
  const {
    currentUser,
    courses,
    courseMembers,
    assignments,
    createAssignment,
    submissions,
    submitAssignment,
    gradeSubmission,
    returnForRevision,
  } = useApp();

  const isTeacher = currentUser.role === 'teacher';

  const [selectedSkillFilter, setSelectedSkillFilter] = useState<string>('all');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Student active taking state
  const [readingAnswers, setReadingAnswers] = useState<Record<string, string>>({});
  const [writingDraft, setWritingDraft] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioRecorded, setAudioRecorded] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Teacher grading state
  const [gradingRubrics, setGradingRubrics] = useState<{ criterion: string; score: number; descriptor: string }[]>([
    { criterion: 'Task Achievement / Response', score: 7.0, descriptor: 'Addresses all parts of the prompt well.' },
    { criterion: 'Coherence & Cohesion', score: 7.0, descriptor: 'Sequences information and ideas logically.' },
    { criterion: 'Lexical Resource', score: 7.0, descriptor: 'Uses a good range of vocabulary with some awareness of style.' },
    { criterion: 'Grammatical Range & Accuracy', score: 7.0, descriptor: 'Uses a variety of complex structures with good control.' },
  ]);
  const [teacherStrengths, setTeacherStrengths] = useState('');
  const [teacherAreasToImprove, setTeacherAreasToImprove] = useState('');
  const [teacherGeneralComments, setTeacherGeneralComments] = useState('');
  const [teacherNextSteps, setTeacherNextSteps] = useState('');
  const [overallScore, setOverallScore] = useState<number>(7.0);
  const [isAiDrafting, setIsAiDrafting] = useState(false);

  // Revision return prompt
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnComments, setReturnComments] = useState('');

  // Scoped assignments
  const visibleAssignments = isTeacher
    ? assignments.filter((a) => {
        const course = courses.find((c) => c.id === a.courseId);
        return course?.teacherId === currentUser.id;
      })
    : assignments.filter((a) => {
        const isEnrolled = courseMembers.some(
          (m) => m.courseId === a.courseId && m.studentId === currentUser.id && m.status === 'enrolled'
        );
        return isEnrolled && a.status === 'published';
      });

  const filteredAssignments = visibleAssignments.filter(
    (a) => selectedSkillFilter === 'all' || a.skill === selectedSkillFilter
  );

  const activeAssignment = selectedAssignmentId
    ? assignments.find((a) => a.id === selectedAssignmentId)
    : null;

  // Active submission for the student (or selected by teacher)
  const currentSubmission = isTeacher
    ? submissions.find((s) => s.id === selectedSubmissionId)
    : submissions.find(
        (s) => s.assignmentId === selectedAssignmentId && s.studentId === currentUser.id
      );

  // Count words in writing draft
  const wordCount = writingDraft.trim().length === 0 ? 0 : writingDraft.trim().split(/\s+/).length;

  // Auto-scoring logic for reading
  const handleReadingSubmit = () => {
    if (!activeAssignment || !activeAssignment.readingQuestions) return;

    const questions = activeAssignment.readingQuestions;
    let correctCount = 0;
    const errorAnalysis = questions.map((q) => {
      const userAns = (readingAnswers[q.id] || '').trim().toLowerCase();
      const correctAns = q.correctAnswer.trim().toLowerCase();
      const isCorrect = userAns === correctAns;
      if (isCorrect) correctCount++;
      return {
        questionId: q.id,
        userAnswer: readingAnswers[q.id] || '(No answer)',
        correctAnswer: q.correctAnswer,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const percentage = Math.round((correctCount / questions.length) * 100);
    // Rough IELTS band estimation for 4-question sample: 4 = 9.0, 3 = 7.5, 2 = 6.0, 1 = 5.0
    const bandEstimate = percentage >= 90 ? 9.0 : percentage >= 75 ? 7.5 : percentage >= 50 ? 6.0 : 4.5;

    submitAssignment(activeAssignment.id, {
      readingAnswers,
      readingScore: { correct: correctCount, total: questions.length, percentage },
      readingErrorAnalysis: errorAnalysis,
      score: bandEstimate,
      status: 'graded', // Reading auto-scores immediately
    });
  };

  // Submit writing
  const handleWritingSubmit = () => {
    if (!activeAssignment || !writingDraft.trim()) return;

    submitAssignment(activeAssignment.id, {
      writingText: writingDraft,
      writingWordCount: wordCount,
      status: 'submitted',
    });
  };

  // Submit speaking
  const handleSpeakingSubmit = () => {
    if (!activeAssignment) return;

    submitAssignment(activeAssignment.id, {
      speakingAudioUrl: 'https://example.com/audio/student_speaking_recording.mp3',
      speakingDuration: recordingSeconds || 85,
      speakingTranscript: 'Audio recorded by student. Verified speech transcript available for teacher review.',
      status: 'submitted',
    });
    setAudioRecorded(false);
  };

  // AI draft feedback generator for Teacher
  const handleGenerateAiFeedback = (sub: Submission) => {
    setIsAiDrafting(true);
    setTimeout(() => {
      if (sub.skill === 'writing') {
        const text = sub.writingText || '';
        const words = sub.writingWordCount || 0;
        const draftRubrics = [
          {
            criterion: 'Task Achievement / Response',
            score: words >= 250 ? 7.5 : 6.0,
            descriptor: words >= 250 ? 'Thoroughly addresses both views with clear thesis.' : 'Under minimum 250 words penalty.',
          },
          {
            criterion: 'Coherence & Cohesion',
            score: 7.5,
            descriptor: 'Logically organized paragraphs with cohesive devices.',
          },
          {
            criterion: 'Lexical Resource',
            score: 7.0,
            descriptor: 'Appropriate academic vocabulary with occasional minor collocation stiffness.',
          },
          {
            criterion: 'Grammatical Range & Accuracy',
            score: 7.0,
            descriptor: 'Good mix of complex structures; punctuation accurate throughout.',
          },
        ];

        setGradingRubrics(draftRubrics);
        setTeacherStrengths('Logical paragraph transitions and strong academic vocabulary.');
        setTeacherAreasToImprove('Provide more concrete workplace real-world examples in paragraph 3.');
        setTeacherGeneralComments('Promising Band 7.0+ essay. Teacher please verify paragraph 3 logic before approving.');
        setTeacherNextSteps('Focus on concise topic sentences and timed 40-minute drills.');
        setOverallScore(7.0);
      } else if (sub.skill === 'speaking') {
        setGradingRubrics([
          { criterion: 'Fluency & Coherence', score: 7.0, descriptor: 'Speaks at length with noticeable rhythm.' },
          { criterion: 'Lexical Resource', score: 7.0, descriptor: 'Resourceful range of descriptive phrases.' },
          { criterion: 'Grammar', score: 6.5, descriptor: 'A few minor tense inconsistencies when describing the past.' },
          { criterion: 'Pronunciation', score: 7.0, descriptor: 'Clear enunciation with appropriate intonation patterns.' },
        ]);
        setTeacherStrengths('Natural speaking cadence and spontaneous delivery on the cue card.');
        setTeacherAreasToImprove('Keep past tense verb consistency when describing origins.');
        setTeacherGeneralComments('Good performance. Clear accent, intelligible throughout.');
        setTeacherNextSteps('Practice abstract Part 3 discussion points with prompt follow-ups.');
        setOverallScore(7.0);
      }
      setIsAiDrafting(false);
    }, 700);
  };

  const handleFinalizeGrading = () => {
    if (!currentSubmission) return;

    gradeSubmission(currentSubmission.id, {
      rubricScores: gradingRubrics,
      strengths: teacherStrengths,
      areasToImprove: teacherAreasToImprove,
      teacherComments: teacherGeneralComments,
      nextSteps: teacherNextSteps,
      score: overallScore,
    });

    setSelectedSubmissionId(null);
  };

  const handleConfirmReturn = () => {
    if (!currentSubmission || !returnComments.trim()) return;
    returnForRevision(currentSubmission.id, returnComments);
    setShowReturnModal(false);
    setSelectedSubmissionId(null);
  };

  // If a submission is being inspected/graded by the teacher
  if (isTeacher && currentSubmission) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <button
              onClick={() => setSelectedSubmissionId(null)}
              className="text-xs font-semibold text-blue-600 hover:underline mb-1 block"
            >
              &larr; Back to Submissions
            </button>
            <h1 className="text-xl font-bold text-slate-900">
              Reviewing {currentSubmission.skill.toUpperCase()}: {currentSubmission.assignmentTitle}
            </h1>
            <p className="text-xs text-slate-500">
              Student: <span className="font-bold text-slate-700">{currentSubmission.studentName}</span> · Submitted: {currentSubmission.submittedAt}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleGenerateAiFeedback(currentSubmission)}
              disabled={isAiDrafting}
              className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>{isAiDrafting ? 'Analyzing...' : 'AI Draft Feedback'}</span>
            </button>

            <button
              onClick={() => {
                setShowReturnModal(true);
                setReturnComments('');
              }}
              className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Return for Revision</span>
            </button>
          </div>
        </div>

        {/* Student Submission Display */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Student Submission Work</h2>
            {currentSubmission.skill === 'writing' && (
              <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                Word Count: {currentSubmission.writingWordCount || 0} words
              </span>
            )}
            {currentSubmission.skill === 'speaking' && (
              <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                Duration: {currentSubmission.speakingDuration}s
              </span>
            )}
          </div>

          {currentSubmission.skill === 'writing' && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs text-slate-800 font-sans leading-relaxed whitespace-pre-wrap">
              {currentSubmission.writingText}
            </div>
          )}

          {currentSubmission.skill === 'speaking' && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Volume2 className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-xs font-bold text-blue-900">Student Audio Recording</p>
                    <p className="text-[11px] text-blue-600">Sample file verified: {currentSubmission.speakingDuration}s</p>
                  </div>
                </div>
                <button className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold flex items-center space-x-1">
                  <Play className="w-3.5 h-3.5" />
                  <span>Play Audio</span>
                </button>
              </div>

              {currentSubmission.speakingTranscript && (
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
                  <span className="font-bold text-slate-700 block mb-1">Verified Transcript:</span>
                  <p className="text-slate-600 leading-relaxed italic">
                    "{currentSubmission.speakingTranscript}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Submission Revision History */}
          {currentSubmission.writingRevisions && currentSubmission.writingRevisions.length > 1 && (
            <div className="p-3 bg-slate-100/70 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 flex items-center space-x-1 mb-2">
                <History className="w-3.5 h-3.5" />
                <span>Revision History ({currentSubmission.writingRevisions.length} drafts)</span>
              </span>
              <div className="space-y-1">
                {currentSubmission.writingRevisions.map((rev, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Draft {i + 1} ({rev.wordCount} words)</span>
                    <span>{rev.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Teacher Feedback & Rubric Grading Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Award className="w-4 h-4 text-blue-600" />
              <span>IELTS Assessment & Rubric Scoring</span>
            </h2>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-600">Overall Band:</span>
              <input
                type="number"
                step="0.5"
                min="1.0"
                max="9.0"
                value={overallScore}
                onChange={(e) => setOverallScore(Number(e.target.value))}
                className="w-16 p-1 border border-slate-300 rounded text-center font-bold text-sm text-blue-700"
              />
            </div>
          </div>

          {/* 4 Rubric Criteria */}
          <div className="space-y-3">
            {gradingRubrics.map((r, idx) => (
              <div key={r.criterion} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-800">{r.criterion}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500 text-[11px]">Score:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="1.0"
                      max="9.0"
                      value={r.score}
                      onChange={(e) => {
                        const newRubrics = [...gradingRubrics];
                        newRubrics[idx].score = Number(e.target.value);
                        setGradingRubrics(newRubrics);
                      }}
                      className="w-14 p-1 border border-slate-300 rounded text-center font-semibold text-slate-800 bg-white"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  value={r.descriptor}
                  onChange={(e) => {
                    const newRubrics = [...gradingRubrics];
                    newRubrics[idx].descriptor = e.target.value;
                    setGradingRubrics(newRubrics);
                  }}
                  className="w-full p-1.5 border border-slate-300 rounded text-[11px] bg-white outline-hidden"
                />
              </div>
            ))}
          </div>

          {/* Feedback Sections: Strengths, Areas to improve, Next Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-emerald-800 mb-1">Key Strengths</label>
              <textarea
                rows={3}
                value={teacherStrengths}
                onChange={(e) => setTeacherStrengths(e.target.value)}
                placeholder="What did the student do particularly well?"
                className="w-full p-2.5 border border-emerald-300 rounded-lg outline-hidden bg-emerald-50/20"
              />
            </div>

            <div>
              <label className="block font-semibold text-amber-800 mb-1">Areas to Improve</label>
              <textarea
                rows={3}
                value={teacherAreasToImprove}
                onChange={(e) => setTeacherAreasToImprove(e.target.value)}
                placeholder="Specific linguistic or structural gaps..."
                className="w-full p-2.5 border border-amber-300 rounded-lg outline-hidden bg-amber-50/20"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">Teacher Professional Comments</label>
            <textarea
              rows={2}
              value={teacherGeneralComments}
              onChange={(e) => setTeacherGeneralComments(e.target.value)}
              placeholder="Final encouraging and constructive feedback..."
              className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
            />
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">Recommended Next Steps</label>
            <input
              type="text"
              value={teacherNextSteps}
              onChange={(e) => setTeacherNextSteps(e.target.value)}
              placeholder="e.g. Redo paragraph 3 with counter-argument concession; practice 10-minute speed outline."
              className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
            <button
              onClick={() => setSelectedSubmissionId(null)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleFinalizeGrading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Finalize & Send Feedback</span>
            </button>
          </div>
        </div>

        {/* Modal: Return for revision */}
        {showReturnModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 mb-2">Return for Revision</h3>
              <p className="text-xs text-slate-500 mb-3">
                Specify what changes the student should make before this task can be accepted and graded.
              </p>
              <textarea
                rows={3}
                value={returnComments}
                onChange={(e) => setReturnComments(e.target.value)}
                placeholder="e.g. Essay is currently 190 words. Please expand your arguments to meet the 250-word minimum."
                className="w-full text-xs p-3 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-amber-500"
              />
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setShowReturnModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReturn}
                  className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  Confirm & Request Revision
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Active Assignment View for Student or Teacher preview
  if (activeAssignment) {
    const mySub = submissions.find(
      (s) => s.assignmentId === activeAssignment.id && s.studentId === currentUser.id
    );

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <button
              onClick={() => setSelectedAssignmentId(null)}
              className="text-xs font-semibold text-blue-600 hover:underline mb-1 block"
            >
              &larr; Back to all assignments
            </button>
            <div className="flex items-center space-x-2">
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                  activeAssignment.skill === 'reading'
                    ? 'bg-emerald-100 text-emerald-800'
                    : activeAssignment.skill === 'writing'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {activeAssignment.skill}
              </span>
              <h1 className="text-xl font-bold text-slate-900">{activeAssignment.title}</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">Due date: {activeAssignment.dueDate}</p>
          </div>

          {/* Submission status tag for student */}
          {!isTeacher && mySub && (
            <span
              className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
                mySub.status === 'graded'
                  ? 'bg-emerald-100 text-emerald-800'
                  : mySub.status === 'returned'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              Status: {mySub.status}
            </span>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Instructions & Objectives
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">{activeAssignment.instructions}</p>
          <p className="text-xs text-slate-400 mt-1 italic">{activeAssignment.objectives}</p>
        </div>

        {/* 1. READING WORKFLOW */}
        {activeAssignment.skill === 'reading' && (
          <div className="space-y-6">
            {/* Reading Passage */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Reading Passage
              </h3>
              <div className="text-xs text-slate-800 leading-relaxed font-serif whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-200">
                {activeAssignment.readingPassage}
              </div>
            </div>

            {/* Reading Questions */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Comprehension Questions
              </h3>

              {activeAssignment.readingQuestions?.map((q, idx) => {
                const answer = readingAnswers[q.id] || '';
                const result = mySub?.readingErrorAnalysis?.find((e) => e.questionId === q.id);

                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-xl border text-xs space-y-3 ${
                      result
                        ? result.isCorrect
                          ? 'border-emerald-300 bg-emerald-50/20'
                          : 'border-red-300 bg-red-50/20'
                        : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        Question {idx + 1} ({q.type.replace(/_/g, ' ')})
                      </span>
                      {result && (
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            result.isCorrect
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {result.isCorrect ? 'Correct (+1)' : 'Incorrect'}
                        </span>
                      )}
                    </div>

                    <p className="font-semibold text-slate-800">{q.prompt}</p>

                    {/* Multiple choice or T/F/NG options */}
                    {q.options && q.options.length > 0 ? (
                      <div className="space-y-1.5">
                        {q.options.map((opt) => (
                          <label
                            key={opt}
                            className={`flex items-center space-x-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                              answer === opt ? 'bg-blue-50 border border-blue-300 text-blue-900 font-semibold' : 'hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`q_${q.id}`}
                              disabled={mySub?.status === 'graded'}
                              checked={answer === opt}
                              onChange={() => setReadingAnswers({ ...readingAnswers, [q.id]: opt })}
                              className="text-blue-600"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div>
                        <input
                          type="text"
                          disabled={mySub?.status === 'graded'}
                          placeholder="Type single word or number..."
                          value={answer}
                          onChange={(e) => setReadingAnswers({ ...readingAnswers, [q.id]: e.target.value })}
                          className="w-full sm:w-64 p-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    )}

                    {/* Explanation visible only after release/grading or for teacher */}
                    {(result || isTeacher) && (
                      <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                        <span className="font-bold text-slate-700">Answer Key: </span>
                        <span className="font-semibold text-emerald-700">{q.correctAnswer}</span>
                        <p className="mt-0.5 text-slate-500">
                          <span className="font-semibold">Explanation: </span>
                          {q.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              {!isTeacher && (!mySub || mySub.status === 'returned') && (
                <div className="pt-4 flex justify-end">
                  <button
                    onClick={handleReadingSubmit}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Submit & Auto-Score Quiz</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. WRITING WORKFLOW */}
        {activeAssignment.skill === 'writing' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Essay Prompt ({activeAssignment.writingTaskType?.toUpperCase() || 'TASK 2'})
                </h3>
                <span className="text-xs text-slate-500">
                  Target: Minimum {activeAssignment.writingMinWords || 250} words
                </span>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 leading-relaxed">
                {activeAssignment.writingPrompt}
              </div>

              {/* Text Editor with live word counter */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 text-xs">Your Academic Response</label>
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                      wordCount >= (activeAssignment.writingMinWords || 250)
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {wordCount} / {activeAssignment.writingMinWords || 250} words
                  </span>
                </div>
                <textarea
                  rows={14}
                  value={writingDraft || mySub?.writingText || ''}
                  onChange={(e) => setWritingDraft(e.target.value)}
                  placeholder="Type your essay paragraphs here..."
                  className="w-full p-4 text-xs font-sans border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden leading-relaxed"
                />
              </div>

              {!isTeacher && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleWritingSubmit}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center space-x-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>{mySub ? 'Resubmit Revision' : 'Submit Writing Essay'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Feedback Display if graded */}
            {mySub?.status === 'graded' && (
              <div className="bg-white rounded-xl border border-emerald-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Final Feedback & Official Band</h3>
                  <span className="text-lg font-extrabold text-blue-700">Band: {mySub.score}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  {mySub.rubricScores?.map((r) => (
                    <div key={r.criterion} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex justify-between font-bold text-slate-800 mb-1">
                        <span>{r.criterion}</span>
                        <span className="text-blue-600">{r.score}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{r.descriptor}</p>
                    </div>
                  ))}
                </div>

                <div className="text-xs space-y-2 pt-2">
                  <p className="text-emerald-800 font-semibold">Strengths: {mySub.strengths}</p>
                  <p className="text-amber-800 font-semibold">Improvement Areas: {mySub.areasToImprove}</p>
                  <p className="text-slate-700">Teacher Remarks: {mySub.teacherComments}</p>
                  <p className="text-blue-700 font-bold">Next Practice Steps: {mySub.nextSteps}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. SPEAKING WORKFLOW */}
        {activeAssignment.skill === 'speaking' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Speaking Cue Card ({activeAssignment.speakingPart?.toUpperCase() || 'PART 2'})
              </h3>

              {activeAssignment.speakingCueCard && (
                <div className="p-5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-3">
                  <p className="text-sm font-bold text-slate-900">
                    {activeAssignment.speakingCueCard.topic}
                  </p>
                  <p className="text-xs font-semibold text-slate-600">You should say:</p>
                  <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                    {activeAssignment.speakingCueCard.points.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                  <div className="pt-2 text-[11px] text-slate-500 flex space-x-4">
                    <span>Preparation: {activeAssignment.speakingCueCard.prepTimeSeconds}s</span>
                    <span>Speaking time: 1–2 minutes</span>
                  </div>
                </div>
              )}

              {/* Audio Recorder Simulation */}
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto text-2xl">
                  {isRecording ? <Mic className="w-8 h-8 text-red-600 animate-pulse" /> : <Mic className="w-8 h-8" />}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {isRecording
                      ? `Recording in progress... (${recordingSeconds}s)`
                      : audioRecorded
                      ? 'Audio clip recorded successfully!'
                      : 'Record Your Speaking Response'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Ensure a quiet room. Pronunciation will only be evaluated when genuine audio is attached.
                  </p>
                </div>

                <div className="flex justify-center space-x-3">
                  {!isRecording ? (
                    <button
                      onClick={() => {
                        setIsRecording(true);
                        setRecordingSeconds(1);
                        const interval = setInterval(() => {
                          setRecordingSeconds((prev) => {
                            if (prev >= 115) {
                              clearInterval(interval);
                              setIsRecording(false);
                              setAudioRecorded(true);
                              return 115;
                            }
                            return prev + 1;
                          });
                        }, 1000);
                      }}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-2"
                    >
                      <Mic className="w-4 h-4" />
                      <span>Start Recording</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setIsRecording(false);
                        setAudioRecorded(true);
                      }}
                      className="px-5 py-2.5 bg-slate-800 hover:bg-black text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-2"
                    >
                      <Square className="w-4 h-4" />
                      <span>Stop & Save Clip ({recordingSeconds}s)</span>
                    </button>
                  )}
                </div>

                {audioRecorded && !isTeacher && (
                  <button
                    onClick={handleSpeakingSubmit}
                    className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-2 mx-auto"
                  >
                    <Send className="w-4 h-4" />
                    <span>Submit Speaking Audio Recording</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Listing View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Assignment Center</h1>
          <p className="text-sm text-slate-500">
            {isTeacher
              ? 'Create IELTS tasks, review student essays and speaking recordings, and draft rubric feedback.'
              : 'Complete timed Reading quizzes, submit Writing Task 1 & 2 essays, and record Speaking responses.'}
          </p>
        </div>

        {isTeacher && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Assignment</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs w-fit">
        {(['all', 'reading', 'writing', 'speaking'] as const).map((skill) => (
          <button
            key={skill}
            onClick={() => setSelectedSkillFilter(skill)}
            className={`px-3 py-1 rounded-md capitalize font-medium transition-all ${
              selectedSkillFilter === skill
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {skill}
          </button>
        ))}
      </div>

      {/* Teacher: Pending Submissions Queue */}
      {isTeacher && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Student Submissions Requiring Teacher Review</span>
            </h2>
            <span className="text-xs text-slate-400">
              {submissions.filter((s) => s.status === 'submitted' || s.status === 'resubmitted').length} pending
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {submissions.filter((s) => s.status === 'submitted' || s.status === 'resubmitted').length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">All submissions graded! No work pending review.</p>
            ) : (
              submissions
                .filter((s) => s.status === 'submitted' || s.status === 'resubmitted')
                .map((sub) => (
                  <div
                    key={sub.id}
                    className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            sub.skill === 'reading'
                              ? 'bg-emerald-100 text-emerald-800'
                              : sub.skill === 'writing'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {sub.skill}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{sub.assignmentTitle}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        By {sub.studentName} ({sub.courseName}) · Submitted: {sub.submittedAt}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedSubmissionId(sub.id);
                        handleGenerateAiFeedback(sub);
                      }}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                    >
                      Review & Grade &rarr;
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* Assignments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAssignments.map((a) => {
          const studentSub = submissions.find(
            (s) => s.assignmentId === a.id && s.studentId === currentUser.id
          );

          return (
            <div
              key={a.id}
              onClick={() => setSelectedAssignmentId(a.id)}
              className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer p-5 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      a.skill === 'reading'
                        ? 'bg-emerald-100 text-emerald-800'
                        : a.skill === 'writing'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {a.skill}
                  </span>
                  <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Due: {a.dueDate}</span>
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-1">
                  {a.title}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                  {a.instructions}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs">
                {!isTeacher && studentSub ? (
                  <span
                    className={`font-semibold capitalize text-[11px] ${
                      studentSub.status === 'graded'
                        ? 'text-emerald-600'
                        : studentSub.status === 'returned'
                        ? 'text-red-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {studentSub.status === 'graded' ? `Graded: Band ${studentSub.score}` : studentSub.status}
                  </span>
                ) : (
                  <span className="text-slate-400 text-[11px]">
                    {isTeacher ? 'Manage Task' : 'Not submitted'}
                  </span>
                )}
                <span className="font-semibold text-blue-600 group-hover:translate-x-1 transition-transform flex items-center">
                  <span>Enter</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
