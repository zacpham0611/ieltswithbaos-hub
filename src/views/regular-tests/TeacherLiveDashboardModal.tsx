import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../i18n/context';
import type { RegularTest, RegularTestAttempt } from '../../types';
import {
  X,
  Clock,
  ShieldAlert,
  AlertTriangle,
  User,
  PlusCircle,
  Send,
  CheckCircle,
  FileText,
  Activity,
} from 'lucide-react';

interface TeacherLiveDashboardModalProps {
  test: RegularTest;
  onClose: () => void;
}

export const TeacherLiveDashboardModal: React.FC<TeacherLiveDashboardModalProps> = ({ test, onClose }) => {
  const {
    regularTestAttempts,
    grantRegularTestExtraTime,
    forceSubmitRegularTestAttempt,
  } = useApp();
  const { t } = useI18n();

  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [extraMinutes, setExtraMinutes] = useState<number>(5);
  const [extraTimeReason, setExtraTimeReason] = useState<string>('');
  const [forceSubmitReason, setForceSubmitReason] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const testAttempts = regularTestAttempts.filter((a) => a.testId === test.id);
  const inProgressAttempts = testAttempts.filter((a) => a.status === 'in_progress');
  const submittedAttempts = testAttempts.filter((a) => a.status === 'submitted' || a.status === 'auto_submitted');

  const selectedAttempt = testAttempts.find((a) => a.id === selectedAttemptId);

  const handleGrantExtra = async () => {
    if (!selectedAttemptId) return;
    if (!extraTimeReason.trim()) {
      setActionError(t('regularTests.reasonRequired'));
      return;
    }
    try {
      setActionError(null);
      await grantRegularTestExtraTime(selectedAttemptId, extraMinutes, extraTimeReason.trim());
      setActionSuccess(`Successfully granted +${extraMinutes} minutes.`);
      setExtraTimeReason('');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to grant extra time');
    }
  };

  const handleForceSubmit = async () => {
    if (!selectedAttemptId) return;
    if (!forceSubmitReason.trim()) {
      setActionError('Reason is required to force submit');
      return;
    }
    if (!window.confirm('Are you sure you want to force submit this student’s exam attempt?')) {
      return;
    }
    try {
      setActionError(null);
      await forceSubmitRegularTestAttempt(selectedAttemptId, forceSubmitReason.trim());
      setActionSuccess('Student exam has been force-submitted.');
      setForceSubmitReason('');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to force submit');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                {t('regularTests.liveMonitoring')}
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  LIVE
                </span>
              </h2>
              <p className="text-xs text-slate-400">{test.title} • {test.courseName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 border-b border-slate-200 text-xs">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-slate-500">{t('regularTests.activeStudents')}</div>
            <div className="text-xl font-bold text-blue-600 mt-1">{inProgressAttempts.length}</div>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-slate-500">{t('regularTests.tabs.submitted')}</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">{submittedAttempts.length}</div>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-slate-500">Duration & Mode</div>
            <div className="text-xs font-semibold text-slate-800 mt-1">
              {test.durationMinutes} mins • {test.timingMode === 'per_section' ? 'Per-section' : 'Overall'}
            </div>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-slate-500">Strict Mode Preset</div>
            <div className="text-xs font-bold text-slate-800 mt-1 uppercase">
              {test.strictPreset}
            </div>
          </div>
        </div>

        {/* Feedback alerts */}
        {actionError && (
          <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-800">×</button>
          </div>
        )}
        {actionSuccess && (
          <div className="mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center justify-between">
            <span>{actionSuccess}</span>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-800">×</button>
          </div>
        )}

        {/* Main 2-column view */}
        <div className="flex-1 flex overflow-hidden">
          {/* Student list */}
          <div className="w-1/2 border-r border-slate-200 p-4 overflow-y-auto">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Roster & Attempts ({testAttempts.length})
            </h3>
            {testAttempts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No students have started this test yet.
              </div>
            ) : (
              <div className="space-y-2">
                {testAttempts.map((attempt) => {
                  const isSelected = attempt.id === selectedAttemptId;
                  const isHighRisk = attempt.riskLevel === 'high';
                  const isMedRisk = attempt.riskLevel === 'medium';

                  return (
                    <div
                      key={attempt.id}
                      onClick={() => setSelectedAttemptId(attempt.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{attempt.studentName || 'Student'}</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            attempt.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {attempt.status === 'in_progress' ? 'IN PROGRESS' : 'SUBMITTED'}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-slate-500 text-[11px]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Started: {new Date(attempt.serverStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {attempt.extraTimeMinutes > 0 && (
                            <span className="text-blue-600 font-semibold">(+{attempt.extraTimeMinutes}m)</span>
                          )}
                        </span>

                        <span
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            isHighRisk
                              ? 'bg-rose-100 text-rose-700'
                              : isMedRisk
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <ShieldAlert className="w-3 h-3" />
                          Risk: {attempt.riskLevel || 'low'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Intervention and Details Panel */}
          <div className="w-1/2 p-5 overflow-y-auto bg-slate-50/50">
            {selectedAttempt ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedAttempt.studentName}</h3>
                  <p className="text-xs text-slate-500">{selectedAttempt.studentEmail}</p>
                </div>

                {/* Audit & Intervention Box */}
                {selectedAttempt.status === 'in_progress' && (
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-4">
                    <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                      <PlusCircle className="w-4 h-4 text-blue-600" />
                      {t('regularTests.grantExtraTime')}
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {[5, 10, 15].map((mins) => (
                        <button
                          key={mins}
                          onClick={() => setExtraMinutes(mins)}
                          className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                            extraMinutes === mins
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          +{mins} Minutes
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Reason for audit trail (Required)
                      </label>
                      <input
                        type="text"
                        value={extraTimeReason}
                        onChange={(e) => setExtraTimeReason(e.target.value)}
                        placeholder="e.g. Device reboot / power glitch"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <button
                      onClick={handleGrantExtra}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors"
                    >
                      Confirm & Grant +{extraMinutes} Minutes
                    </button>

                    <div className="pt-3 border-t border-slate-200">
                      <h4 className="text-xs font-bold text-rose-700 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Emergency Intervention: Force Submit
                      </h4>
                      <input
                        type="text"
                        value={forceSubmitReason}
                        onChange={(e) => setForceSubmitReason(e.target.value)}
                        placeholder="Reason for early forced submission"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 mb-2 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                      />
                      <button
                        onClick={handleForceSubmit}
                        className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-lg border border-rose-200 transition-colors"
                      >
                        {t('regularTests.forceSubmit')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Attempt Status Card */}
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Attempt Status</span>
                    <span className="font-semibold text-slate-800 uppercase">{selectedAttempt.status}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Total Extra Time Granted</span>
                    <span className="font-semibold text-blue-600">+{selectedAttempt.extraTimeMinutes} mins</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Server Deadline</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(selectedAttempt.serverDeadline).toLocaleTimeString()}
                    </span>
                  </div>
                  {selectedAttempt.submittedAt && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Submitted At</span>
                      <span className="font-semibold text-emerald-700">{selectedAttempt.submittedAt}</span>
                    </div>
                  )}
                  {selectedAttempt.scores?.reading && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Reading Band</span>
                      <span className="font-bold text-slate-900">{selectedAttempt.scores.reading.band}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Select a student from the left panel to inspect details and perform interventions.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
