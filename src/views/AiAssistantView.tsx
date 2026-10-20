import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import { CourseSkill } from '../types';
import { generateAiAssistantDraft } from '../lib/ai';
import {
  Sparkles,
  BookOpen,
  User,
  Copy,
  Check,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  Send,
  FileCheck2,
  Award,
} from 'lucide-react';

export const AiAssistantView: React.FC = () => {
  const { currentUser, courses, courseMembers, submissions, monthlyReports } = useApp();
  const { t } = useI18n();

  if (!currentUser) return null;

  const [prompt, setPrompt] = useState('Summarize recurring errors in writing submissions and propose 3 practice drills.');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<CourseSkill | 'all'>('writing');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [insufficientEvidenceFlag, setInsufficientEvidenceFlag] = useState<string | null>(null);

  // Filter available courses for this teacher
  const teacherCourses = courses.filter((c) => c.teacherId === currentUser.id);

  // Selected student & course details for context preview
  const activeCourse = courses.find((c) => c.id === selectedCourseId);
  const activeStudent = courseMembers.find((m) => m.studentId === selectedStudentId);

  // Context gathering
  const relevantSubmissions = submissions.filter((s) => {
    const matchCourse = !selectedCourseId || s.courseId === selectedCourseId;
    const matchStudent = !selectedStudentId || s.studentId === selectedStudentId;
    const matchSkill = selectedSkill === 'all' || s.skill === selectedSkill;
    return matchCourse && matchStudent && matchSkill;
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setErrorMessage(null);
    setInsufficientEvidenceFlag(null);

    if (relevantSubmissions.length === 0 && selectedStudentId) {
      setInsufficientEvidenceFlag(
        `Insufficient Evidence: No verified student submissions found for ${activeStudent?.studentName || 'this student'} under selected criteria. Output will be generated with clear evidence gap warnings.`
      );
    }

    try {
      const summary = relevantSubmissions.length > 0
        ? `${relevantSubmissions.length} submissions in scope. Skills: ${selectedSkill}. Average Band: ${
            relevantSubmissions.filter((s) => s.score).length > 0
              ? (
                  relevantSubmissions.reduce((acc, curr) => acc + (curr.score || 0), 0) /
                  relevantSubmissions.filter((s) => s.score).length
                ).toFixed(1)
              : 'Ungraded'
          }`
        : undefined;

      const result = await generateAiAssistantDraft({
        prompt: prompt.trim(),
        skill: selectedSkill,
        courseName: activeCourse?.name,
        studentName: activeStudent?.studentName,
        submissionsCount: relevantSubmissions.length,
        evidenceSummary: summary,
      });

      setGeneratedDraft(result.draft);
      setUsedModel(result.model);
    } catch (err: any) {
      setErrorMessage(err.message || t('aiAssistant.errorMessage'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedDraft) return;
    navigator.clipboard.writeText(generatedDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2 text-indigo-700 mb-1">
          <Sparkles className="w-5 h-5" />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('aiAssistant.title')}</h1>
        </div>
        <p className="text-sm text-slate-500">
          {t('aiAssistant.subtitle')}
        </p>
      </div>

      {/* Main Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        {/* Context Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.scopeCourse')}</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg outline-hidden bg-white"
            >
              <option value="">{t('aiAssistant.allMyCourses')}</option>
              {teacherCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.scopeStudent')}</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg outline-hidden bg-white"
            >
              <option value="">{t('aiAssistant.wholeClass')}</option>
              {courseMembers
                .filter((m) => (!selectedCourseId || m.courseId === selectedCourseId) && m.status === 'enrolled')
                .map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.studentName}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.skill')}</label>
            <select
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value as any)}
              className="w-full p-2 border border-slate-300 rounded-lg outline-hidden bg-white capitalize"
            >
              <option value="all">{t('skills.all')}</option>
              <option value="reading">{t('skills.reading')}</option>
              <option value="writing">{t('skills.writing')}</option>
              <option value="speaking">{t('skills.speaking')}</option>
              <option value="listening">{t('skills.listening')}</option>
            </select>
          </div>
        </div>

        {/* Live Context Preview Badge */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between text-slate-600">
          <span className="font-semibold">{t('aiAssistant.contextPreview')}</span>
          <span className="text-[11px] font-mono bg-white px-2.5 py-0.5 rounded border border-slate-200">
            {t('aiAssistant.recordsLoaded', { count: String(relevantSubmissions.length) })}
          </span>
        </div>

        {/* Prompt Input */}
        <div>
          <label className="block font-semibold text-slate-700 text-xs mb-1">
            {t('aiAssistant.promptLabel')}
          </label>
          <div className="flex gap-2">
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Draft 3 IELTS Part 2 cue cards about technological innovation with Band 7.5 vocabulary hints."
              className="flex-1 p-3 text-xs border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500 leading-relaxed"
            />
          </div>
        </div>

        {/* Fast Prompt Templates */}
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="text-slate-400 font-semibold self-center">{t('aiAssistant.quickTemplates')}</span>
          {[
            t('aiAssistant.template1'),
            t('aiAssistant.template2'),
            t('aiAssistant.template3'),
            t('aiAssistant.template4'),
          ].map((templateText) => (
            <button
              key={templateText}
              onClick={() => setPrompt(templateText)}
              className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 rounded-md text-slate-700 border border-slate-200/70 transition-colors"
            >
              {templateText}
            </button>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isGenerating ? t('aiAssistant.analyzingEvidence') : t('aiAssistant.generateBtn')}</span>
          </button>
        </div>
      </div>

      {/* Error Alert if any */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-xl flex items-start justify-between text-xs text-red-900">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">{t('aiAssistant.errorMessage')}</span>
              <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="ml-3 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded font-semibold shrink-0 transition-colors"
          >
            {t('aiAssistant.retryBtn')}
          </button>
        </div>
      )}

      {/* Flagged Evidence Alert if any */}
      {insufficientEvidenceFlag && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start space-x-3 text-xs text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">{t('aiAssistant.strictPolicy')}</span>
            <p className="mt-0.5 leading-relaxed">{insufficientEvidenceFlag}</p>
          </div>
        </div>
      )}

      {/* Generated Result Container */}
      {generatedDraft && (
        <div className="bg-white rounded-xl border border-indigo-200 shadow-md p-6 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                {t('aiAssistant.editableDraft')}
              </span>
              {usedModel && (
                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                  {t('aiAssistant.modelPoweredBy', { model: usedModel })}
                </span>
              )}
              <span className="text-xs text-slate-400">{t('aiAssistant.privateDraftNote')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center space-x-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t('common.copied') : t('common.copy')}</span>
              </button>
            </div>
          </div>

          <textarea
            rows={12}
            value={generatedDraft}
            onChange={(e) => setGeneratedDraft(e.target.value)}
            className="w-full p-3 font-mono text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-hidden leading-relaxed"
          />

          <p className="text-[11px] text-slate-400 italic">
            {t('aiAssistant.productRuleNote')}
          </p>
        </div>
      )}
    </div>
  );
};
