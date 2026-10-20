import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LineChart,
  Award,
  CheckCircle,
  Clock,
  AlertCircle,
  BookOpen,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export const ProgressView: React.FC = () => {
  const { currentUser, submissions, monthlyReports, setActiveTab } = useApp();

  const mySubs = submissions.filter((s) => s.studentId === currentUser.id);
  const myReports = monthlyReports.filter((r) => r.studentId === currentUser.id && r.state === 'published');

  const readingSubs = mySubs.filter((s) => s.skill === 'reading');
  const writingSubs = mySubs.filter((s) => s.skill === 'writing');
  const speakingSubs = mySubs.filter((s) => s.skill === 'speaking');
  const listeningSubs = mySubs.filter((s) => s.skill === ('listening' as any));

  // Average reading percentage
  const readingAvg = readingSubs.length > 0
    ? Math.round(readingSubs.reduce((a, b) => a + (b.readingScore?.percentage || 0), 0) / readingSubs.length)
    : null;

  // Average writing band
  const writingGraded = writingSubs.filter((s) => s.score);
  const writingAvg = writingGraded.length > 0
    ? (writingGraded.reduce((a, b) => a + (b.score || 0), 0) / writingGraded.length).toFixed(1)
    : null;

  // Speaking
  const speakingGraded = speakingSubs.filter((s) => s.score);
  const speakingAvg = speakingGraded.length > 0
    ? (speakingGraded.reduce((a, b) => a + (b.score || 0), 0) / speakingGraded.length).toFixed(1)
    : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Learning Progress</h1>
        <p className="text-sm text-slate-500">
          Real evidence tracked from your submitted homework, diagnostic quizzes, and teacher assessments.
        </p>
      </div>

      {/* Target Band Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-xl p-5 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-blue-200">
            STUDENT TARGET
          </span>
          <h2 className="text-xl font-extrabold mt-0.5">
            {currentUser.targetBand ? `Band ${currentUser.targetBand} Target` : 'Target Band Not Configured'}
          </h2>
          <p className="text-xs text-blue-100 mt-1">
            {myReports.length > 0
              ? `Latest monthly diagnostic estimate: ${myReports[0].teacherEvaluation.estimatedBand || 'Pending'}`
              : 'Complete upcoming monthly assignments for your diagnostic evaluation.'}
          </p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-extrabold text-blue-100">{currentUser.targetBand || '7.0'}</span>
        </div>
      </div>

      {/* 4 Skill Cards — Missing data is labelled "not enough data", never treated as zero! */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Reading */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>Reading</span>
            <span className="text-emerald-600">{readingSubs.length} drills</span>
          </div>
          {readingAvg !== null ? (
            <div>
              <div className="text-2xl font-extrabold text-slate-900">{readingAvg}%</div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Average accuracy</p>
            </div>
          ) : (
            <div>
              <div className="text-sm font-bold text-slate-400 italic">Not enough data</div>
              <p className="text-[11px] text-slate-400 mt-0.5">0 quizzes logged</p>
            </div>
          )}
        </div>

        {/* Writing */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>Writing</span>
            <span className="text-amber-600">{writingSubs.length} essays</span>
          </div>
          {writingAvg !== null ? (
            <div>
              <div className="text-2xl font-extrabold text-slate-900">Band {writingAvg}</div>
              <p className="text-[11px] text-amber-600 font-semibold mt-0.5">Teacher evaluated</p>
            </div>
          ) : (
            <div>
              <div className="text-sm font-bold text-slate-400 italic">Not enough data</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {writingSubs.length > 0 ? 'Awaiting grading' : '0 submissions'}
              </p>
            </div>
          )}
        </div>

        {/* Speaking */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>Speaking</span>
            <span className="text-purple-600">{speakingSubs.length} recorded</span>
          </div>
          {speakingAvg !== null ? (
            <div>
              <div className="text-2xl font-extrabold text-slate-900">Band {speakingAvg}</div>
              <p className="text-[11px] text-purple-600 font-semibold mt-0.5">With verified audio</p>
            </div>
          ) : (
            <div>
              <div className="text-sm font-bold text-slate-400 italic">Not enough data</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Awaiting audio grading</p>
            </div>
          )}
        </div>

        {/* Listening */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>Listening</span>
            <span className="text-slate-400">0 logged</span>
          </div>
          <div>
            <div className="text-sm font-bold text-slate-400 italic">Not enough data</div>
            <p className="text-[11px] text-slate-400 mt-0.5">No mock tests logged</p>
          </div>
        </div>
      </div>

      {/* Completed Submissions Log */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Evidence Log & Detailed Feedback</h3>
        {mySubs.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No assignments submitted yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {mySubs.map((sub) => (
              <div key={sub.id} className="py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded mr-2 ${
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
                  <span className="text-xs font-bold text-slate-900">
                    {sub.score ? `Band ${sub.score}` : sub.status}
                  </span>
                </div>

                {/* Feedback Separation: Rubrics, Strengths, Areas to Improve, Next Steps */}
                {sub.status === 'graded' && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5 text-slate-700">
                    {sub.strengths && (
                      <p>
                        <strong className="text-emerald-800">Strengths: </strong>
                        {sub.strengths}
                      </p>
                    )}
                    {sub.areasToImprove && (
                      <p>
                        <strong className="text-amber-800">Areas to Improve: </strong>
                        {sub.areasToImprove}
                      </p>
                    )}
                    {sub.teacherComments && (
                      <p>
                        <strong className="text-slate-800">Teacher Comments: </strong>
                        {sub.teacherComments}
                      </p>
                    )}
                    {sub.nextSteps && (
                      <p>
                        <strong className="text-blue-700">Next Steps: </strong>
                        {sub.nextSteps}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
