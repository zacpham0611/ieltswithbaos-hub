import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  PenTool,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Folder,
  ArrowRight,
  Eye,
  FileText,
  Sliders,
  Crop,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { uploadMediaFile } from '../lib/mediaStorage';
import { Portal } from './Portal';
import {
  parseWritingDocument,
  type ExtractedWritingDocument,
  type ExtractedWritingTask,
} from '../lib/writingDocumentExtractor';

interface WritingImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  targetFolderId?: string | null;
  targetFolderName?: string;
}

export type WritingTaskType = 'task1' | 'task2';
export type ChartType =
  | 'Line Graph'
  | 'Bar Chart'
  | 'Pie Chart'
  | 'Table'
  | 'Map'
  | 'Process / Diagram'
  | 'Mixed Charts';

export const WritingImportModal: React.FC<WritingImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  targetFolderId,
  targetFolderName,
}) => {
  const { currentUser, courses, addResource, createAssignment } = useApp();

  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Raw file metadata
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [extractedDoc, setExtractedDoc] = useState<ExtractedWritingDocument | null>(null);

  // Active review tab
  const [activeReviewTab, setActiveReviewTab] = useState<'task1' | 'task2'>('task1');

  // Independent Task 1 Form State
  const [task1Title, setTask1Title] = useState('');
  const [task1Prompt, setTask1Prompt] = useState('');
  const [task1MinWords, setTask1MinWords] = useState(150);
  const [task1ChartType, setTask1ChartType] = useState<ChartType>('Bar Chart');
  const [task1ModelAnswer, setTask1ModelAnswer] = useState('');
  const [task1DetectedImages, setTask1DetectedImages] = useState<string[]>([]);
  const [task1SelectedImageIndex, setTask1SelectedImageIndex] = useState<number>(0);
  const [task1CustomImageUrl, setTask1CustomImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [saveTask1, setSaveTask1] = useState(true);

  // Independent Task 2 Form State (NO chart controls / diagram preview)
  const [task2Title, setTask2Title] = useState('');
  const [task2Prompt, setTask2Prompt] = useState('');
  const [task2MinWords, setTask2MinWords] = useState(250);
  const [task2ModelAnswer, setTask2ModelAnswer] = useState('');
  const [saveTask2, setSaveTask2] = useState(true);

  // Metadata for saving
  const [targetFolder, setTargetFolder] = useState(targetFolderName || (targetFolderId ? '' : 'Writing Prompts'));
  const [targetCourseId, setTargetCourseId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // File selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processWritingFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processWritingFile(file);
  };

  const processWritingFile = async (file: File) => {
    setErrorMsg(null);
    setIsProcessing(true);
    setProcessStatus('Đang đọc tài liệu Writing...');
    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const extension = file.name.split('.').pop()?.toLowerCase() || '';

      let text = '';
      const extractedImgs: string[] = [];

      if (extension === 'docx') {
        setProcessStatus('Trích xuất văn bản, bảng số liệu và ảnh nhúng từ DOCX...');
        const mammothModule = await import('mammoth');
        const mammoth = (mammothModule as any).default || mammothModule;

        const res = await mammoth.convertToHtml(
          { arrayBuffer },
          {
            convertImage: mammoth.images.inline((element: any) => {
              return element.read('base64').then((imageBuffer: string) => {
                const src = `data:${element.contentType};base64,${imageBuffer}`;
                extractedImgs.push(src);
                return { src };
              });
            }),
          }
        );

        let html = res.value || '';
        // Convert HTML tables into Markdown tables so tabular data is fully preserved
        html = html.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_: string, rowContent: string) => {
          const cells = Array.from(rowContent.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((m: any) =>
            m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
          );
          return cells.length > 0 ? `\n| ${cells.join(' | ')} |\n` : '';
        });
        html = html.replace(/<p[^>]*>/gi, '\n').replace(/<\/p>/gi, '\n');
        text = html
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      } else if (extension === 'pdf') {
        setProcessStatus('Đang đọc trang PDF và render biểu đồ...');
        const pdfjsLib = await import('pdfjs-dist');
        if (
          typeof window !== 'undefined' &&
          'Worker' in window &&
          !(pdfjsLib as any).GlobalWorkerOptions.workerSrc
        ) {
          (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${
            (pdfjsLib as any).version || '3.11.174'
          }/pdf.worker.min.js`;
        }

        const pdfDoc = await (pdfjsLib as any).getDocument({
          data: new Uint8Array(arrayBuffer),
        }).promise;

        let fullText = '';
        const numPages = Math.min(pdfDoc.numPages, 5);

        for (let i = 1; i <= numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str || '').join(' ');
          fullText += pageText + '\n';

          // Render first page or pages with potential charts onto canvas
          try {
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              await page.render({ canvasContext: ctx, viewport }).promise;
              const imgData = canvas.toDataURL('image/png');
              extractedImgs.push(imgData);
            }
          } catch (renderErr) {
            console.warn('PDF page canvas render error:', renderErr);
          }
        }
        text = fullText.trim();
      } else {
        // Plain text
        const decoder = new TextDecoder('utf-8');
        text = decoder.decode(arrayBuffer);
      }

      setRawText(text);

      // Advanced multi-task document parser
      const parsedDoc = parseWritingDocument(text, file.name);
      setExtractedDoc(parsedDoc);

      const cleanBaseName = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

      // Automatic classification and field mapping into independent state
      const task1Found = parsedDoc.tasks.find((t) => t.taskType === 'task1');
      const task2Found = parsedDoc.tasks.find((t) => t.taskType === 'task2');

      if (task1Found) {
        setTask1Title(task1Found.title || `Task 1: ${task1Found.chartType || 'Report'} - ${cleanBaseName}`);
        setTask1Prompt(task1Found.prompt || '');
        setTask1MinWords(task1Found.minWords || 150);
        if (task1Found.chartType) setTask1ChartType(task1Found.chartType);
        setTask1ModelAnswer(task1Found.sampleAnswers?.[0]?.content || '');
        setTask1DetectedImages(extractedImgs);
        setTask1SelectedImageIndex(0);
        setTask1CustomImageUrl(extractedImgs[0] || null);
        setSaveTask1(true);
      } else {
        setTask1Title(`Task 1: Report - ${cleanBaseName}`);
        setTask1Prompt('');
        setTask1MinWords(150);
        setTask1DetectedImages(extractedImgs);
        setTask1SelectedImageIndex(0);
        setTask1CustomImageUrl(extractedImgs[0] || null);
        setSaveTask1(false);
      }

      if (task2Found) {
        setTask2Title(task2Found.title || `Task 2: Essay - ${cleanBaseName}`);
        setTask2Prompt(task2Found.prompt || '');
        setTask2MinWords(task2Found.minWords || 250);
        setTask2ModelAnswer(task2Found.sampleAnswers?.[0]?.content || '');
        setSaveTask2(true);
      } else {
        setTask2Title(`Task 2: Essay - ${cleanBaseName}`);
        setTask2Prompt('');
        setTask2MinWords(250);
        setTask2ModelAnswer('');
        setSaveTask2(false);
      }

      // Default active tab to task1 if present, otherwise task2
      if (task1Found) {
        setActiveReviewTab('task1');
      } else if (task2Found) {
        setActiveReviewTab('task2');
      } else {
        setActiveReviewTab('task1');
      }

      setStep('review');
    } catch (err: any) {
      console.error('Writing import error:', err);
      setErrorMsg(err.message || 'Lỗi khi trích xuất tài liệu Writing.');
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  // Upload custom replacement image for Task 1
  const handleUploadCustomImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const url = await uploadMediaFile(file, 'images', `writing_chart_${Date.now()}`);
      setTask1CustomImageUrl(url);
    } catch (err: any) {
      alert(`Lỗi tải ảnh: ${err.message}`);
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleSaveWritingResource = async (createAsAssignment: boolean = false) => {
    if (!currentUser) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      let savedCount = 0;

      // 1. Save Task 1 if enabled & has prompt
      if (saveTask1 && task1Prompt.trim()) {
        let finalImageUrl = task1CustomImageUrl || task1DetectedImages[task1SelectedImageIndex] || '';

        // If diagram is a base64 string, upload to persistent storage
        if (finalImageUrl.startsWith('data:')) {
          try {
            const blob = await (await fetch(finalImageUrl)).blob();
            finalImageUrl = await uploadMediaFile(blob, 'images', `writing_diagram_${Date.now()}`);
          } catch (uploadErr) {
            console.warn('Failed to upload image blob, using inline:', uploadErr);
          }
        }

        const task1Content = {
          taskType: 'task1',
          chartType: task1ChartType,
          prompt: task1Prompt.trim(),
          minWords: task1MinWords,
          imageUrl: finalImageUrl || undefined,
          modelAnswer: task1ModelAnswer.trim() || undefined,
        };

        await addResource({
          title: task1Title.trim() || `Writing Task 1 (${task1ChartType})`,
          type: 'doc',
          skill: 'writing',
          url: finalImageUrl || undefined,
          content: JSON.stringify(task1Content),
          folder: targetFolderName !== undefined ? (targetFolderName || undefined) : (targetFolder.trim() || undefined),
          folderId: targetFolderId || null,
          courseId: targetCourseId || null,
          tags: [],
          isPublished: true,
        });
        savedCount++;

        if (createAsAssignment) {
          await createAssignment({
            title: task1Title.trim() || `Writing Task 1 (${task1ChartType})`,
            courseId: targetCourseId || courses[0]?.id || 'course_default',
            skill: 'writing',
            instructions: `Đề bài IELTS Writing Task 1 (${task1ChartType}). Yêu cầu tối thiểu ${task1MinWords} từ.`,
            objectives: 'Luyện tập kỹ năng IELTS Writing Task 1 theo tiêu chuẩn chấm thi quốc tế.',
            status: 'published',
            dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
            writingPrompt: task1Prompt.trim(),
            writingMinWords: task1MinWords,
            writingTaskType: 'task1',
            task1ImageUrl: finalImageUrl || undefined,
            questions: [],
          });
        }
      }

      // 2. Save Task 2 if enabled & has prompt
      if (saveTask2 && task2Prompt.trim()) {
        const task2Content = {
          taskType: 'task2',
          prompt: task2Prompt.trim(),
          minWords: task2MinWords,
          modelAnswer: task2ModelAnswer.trim() || undefined,
        };

        await addResource({
          title: task2Title.trim() || 'Writing Task 2 (Essay)',
          type: 'doc',
          skill: 'writing',
          content: JSON.stringify(task2Content),
          folder: targetFolderName !== undefined ? (targetFolderName || undefined) : (targetFolder.trim() || undefined),
          folderId: targetFolderId || null,
          courseId: targetCourseId || null,
          tags: [],
          isPublished: true,
        });
        savedCount++;

        if (createAsAssignment) {
          await createAssignment({
            title: task2Title.trim() || 'Writing Task 2 (Essay)',
            courseId: targetCourseId || courses[0]?.id || 'course_default',
            skill: 'writing',
            instructions: `Đề bài IELTS Writing Task 2 Essay. Yêu cầu tối thiểu ${task2MinWords} từ.`,
            objectives: 'Luyện tập kỹ năng IELTS Writing Task 2 theo tiêu chuẩn chấm thi quốc tế.',
            status: 'published',
            dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
            writingPrompt: task2Prompt.trim(),
            writingMinWords: task2MinWords,
            writingTaskType: 'task2',
            questions: [],
          });
        }
      }

      if (savedCount === 0) {
        alert('Vui lòng bật lưu ít nhất Task 1 hoặc Task 2 có nội dung đề bài.');
        return;
      }

      setSaveSuccessMsg(
        createAsAssignment
          ? `Đã lưu ${savedCount} bài Writing vào Thư viện và tạo Bài tập thành công!`
          : `Đã lưu ${savedCount} bài Writing vào Thư viện thành công!`
      );
      onSuccess?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Save writing resource error:', err);
      setErrorMsg(err.message || 'Không thể lưu tài liệu Writing.');
    } finally {
      setIsSaving(false);
    }
  };

  const activeTask1DiagramUrl = task1CustomImageUrl || task1DetectedImages[task1SelectedImageIndex];

  return (
    <Portal containerId="modal-root">
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-50/60 to-white">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <PenTool className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Import Tài liệu IELTS Writing
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                    Task 1 & Task 2
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Tự động nhận diện cấu trúc đề, trích xuất biểu đồ/hình ảnh từ DOCX & PDF.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {errorMsg && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-3 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {saveSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-3 text-xs text-emerald-800 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* STEP 1: FILE UPLOAD */}
            {step === 'upload' && (
              <div className="space-y-6">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-10 text-center bg-slate-50/50 hover:bg-emerald-50/20 cursor-pointer transition-all duration-200 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx,.pdf,.txt"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                    <Upload className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">
                    Kéo & thả file tài liệu Writing vào đây, hoặc nhấn để duyệt file
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Hỗ trợ định dạng DOCX, PDF (tự động trích xuất bảng số liệu và ảnh biểu đồ), và file text.
                  </p>
                </div>

                {isProcessing && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center space-x-3 text-xs text-slate-700">
                    <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
                    <span className="font-semibold">{processStatus}</span>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: REVIEW & EDIT */}
            {step === 'review' && (
              <div className="space-y-6">
                {/* Clean Task Tabs Switcher with independent state */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setActiveReviewTab('task1')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        activeReviewTab === 'task1'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>Writing Task 1 (Report)</span>
                      {task1Prompt.trim() && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            activeReviewTab === 'task1'
                              ? 'bg-emerald-700 text-white'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          Đã nhận diện
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveReviewTab('task2')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        activeReviewTab === 'task2'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>Writing Task 2 (Essay)</span>
                      {task2Prompt.trim() && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            activeReviewTab === 'task2'
                              ? 'bg-emerald-700 text-white'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          Đã nhận diện
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Selective Save Checkboxes */}
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={saveTask1}
                        disabled={!task1Prompt.trim()}
                        onChange={(e) => setSaveTask1(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded-sm accent-emerald-600"
                      />
                      <span>Lưu Task 1</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={saveTask2}
                        disabled={!task2Prompt.trim()}
                        onChange={(e) => setSaveTask2(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded-sm accent-emerald-600"
                      />
                      <span>Lưu Task 2</span>
                    </label>
                  </div>
                </div>

                {/* TASK 1 CONTENT */}
                {activeReviewTab === 'task1' && (
                  <div className="space-y-5">
                    {/* Task 1 Classification Bar */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Dạng biểu đồ Task 1:
                        </span>
                        <select
                          value={task1ChartType}
                          onChange={(e) => setTask1ChartType(e.target.value as ChartType)}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        >
                          <option value="Line Graph">Line Graph</option>
                          <option value="Bar Chart">Bar Chart</option>
                          <option value="Pie Chart">Pie Chart</option>
                          <option value="Table">Table</option>
                          <option value="Map">Map</option>
                          <option value="Process / Diagram">Process / Diagram</option>
                          <option value="Mixed Charts">Mixed Charts</option>
                        </select>
                      </div>

                      <div className="text-xs text-slate-500">
                        Yêu cầu tối thiểu: <strong className="text-slate-800">{task1MinWords}</strong> từ • Thời gian gợi ý: 20 phút
                      </div>
                    </div>

                    {/* Grid: Left Prompt & Metadata, Right Diagram Preview */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Left Column (Prompt & Settings) */}
                      <div className="lg:col-span-7 space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 block">Tiêu đề tài liệu Task 1:</label>
                          <input
                            type="text"
                            value={task1Title}
                            onChange={(e) => setTask1Title(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700 block">
                              Đề bài Task 1 (Writing Prompt):
                            </label>
                            <span className="text-[11px] text-slate-500 font-medium">
                              Yêu cầu tối thiểu: <strong>{task1MinWords}</strong> từ
                            </span>
                          </div>
                          <textarea
                            value={task1Prompt}
                            onChange={(e) => setTask1Prompt(e.target.value)}
                            rows={6}
                            className="w-full p-3 text-xs rounded-xl border border-slate-300 text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden leading-relaxed"
                            placeholder="Nhập nội dung đề bài Task 1..."
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 block">
                              Số từ tối thiểu (Word Count):
                            </label>
                            <input
                              type="number"
                              value={task1MinWords}
                              onChange={(e) => setTask1MinWords(Number(e.target.value))}
                              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-bold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 block">Thư mục Thư viện:</label>
                            <input
                              type="text"
                              value={targetFolder}
                              onChange={(e) => setTargetFolder(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-800 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                              placeholder="Writing Prompts"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 block">
                            Bài mẫu / Gợi ý làm bài (Sample / Model Answer - tùy chọn):
                          </label>
                          <textarea
                            value={task1ModelAnswer}
                            onChange={(e) => setTask1ModelAnswer(e.target.value)}
                            rows={4}
                            className="w-full p-3 text-xs rounded-xl border border-slate-300 text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden leading-relaxed"
                            placeholder="Dán bài mẫu Band 8.0+ hoặc từ vựng trọng tâm Task 1..."
                          />
                        </div>
                      </div>

                      {/* Right Column (Task 1 Diagram / Image Manager) */}
                      <div className="lg:col-span-5 space-y-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <ImageIcon className="w-4 h-4 text-emerald-600" />
                              Biểu đồ Task 1 (Diagram / Chart)
                            </span>
                            <input
                              ref={imageInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleUploadCustomImage}
                            />
                            <button
                              type="button"
                              onClick={() => imageInputRef.current?.click()}
                              disabled={isUploadingImage}
                              className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Tải ảnh khác</span>
                            </button>
                          </div>

                          {/* Detected Images Selector if multiple */}
                          {task1DetectedImages.length > 1 && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Tìm thấy {task1DetectedImages.length} ảnh/trang từ tài liệu:
                              </span>
                              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                {task1DetectedImages.map((img, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      setTask1SelectedImageIndex(idx);
                                      setTask1CustomImageUrl(null);
                                    }}
                                    className={`w-14 h-14 rounded-lg border-2 shrink-0 overflow-hidden bg-white p-0.5 transition-all ${
                                      task1SelectedImageIndex === idx && !task1CustomImageUrl
                                        ? 'border-emerald-600 ring-2 ring-emerald-200'
                                        : 'border-slate-200 hover:border-slate-400'
                                    }`}
                                  >
                                    <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-contain" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Active Image Display */}
                          {activeTask1DiagramUrl ? (
                            <div className="space-y-2">
                              <div className="w-full max-h-72 bg-white rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center p-2 shadow-2xs">
                                <img
                                  src={activeTask1DiagramUrl}
                                  alt="Writing Diagram"
                                  className="max-h-68 max-w-full object-contain"
                                />
                              </div>

                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Đã gắn biểu đồ Task 1
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTask1CustomImageUrl(null);
                                    setTask1DetectedImages((prev) =>
                                      prev.filter((_, i) => i !== task1SelectedImageIndex)
                                    );
                                  }}
                                  className="text-[11px] text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Xóa ảnh</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => imageInputRef.current?.click()}
                              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-8 text-center bg-white cursor-pointer group transition-all"
                            >
                              <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-emerald-600 mx-auto mb-2 transition-colors" />
                              <p className="text-xs font-bold text-slate-700">Chưa có ảnh biểu đồ</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">Nhấn để tải lên ảnh biểu đồ Task 1</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TASK 2 CONTENT (Independent fields, NO chart controls or diagram preview) */}
                {activeReviewTab === 'task2' && (
                  <div className="space-y-5">
                    {/* Task 2 Header Notice */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Writing Task 2 (Discursive Essay)
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Yêu cầu tối thiểu: <strong className="text-slate-800">{task2MinWords}</strong> từ • Thời gian gợi ý: 40 phút
                      </div>
                    </div>

                    <div className="space-y-4 max-w-4xl">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 block">Tiêu đề tài liệu Task 2:</label>
                        <input
                          type="text"
                          value={task2Title}
                          onChange={(e) => setTask2Title(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 block">
                            Đề bài Task 2 (Writing Prompt):
                          </label>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Yêu cầu tối thiểu: <strong>{task2MinWords}</strong> từ
                          </span>
                        </div>
                        <textarea
                          value={task2Prompt}
                          onChange={(e) => setTask2Prompt(e.target.value)}
                          rows={7}
                          className="w-full p-3 text-xs rounded-xl border border-slate-300 text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden leading-relaxed"
                          placeholder="Nhập nội dung đề bài Task 2..."
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 block">
                            Số từ tối thiểu (Word Count):
                          </label>
                          <input
                            type="number"
                            value={task2MinWords}
                            onChange={(e) => setTask2MinWords(Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-bold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 block">Thư mục Thư viện:</label>
                          <input
                            type="text"
                            value={targetFolder}
                            onChange={(e) => setTargetFolder(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-800 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                            placeholder="Writing Prompts"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 block">
                          Bài mẫu / Gợi ý làm bài (Sample / Model Answer - tùy chọn):
                        </label>
                        <textarea
                          value={task2ModelAnswer}
                          onChange={(e) => setTask2ModelAnswer(e.target.value)}
                          rows={5}
                          className="w-full p-3 text-xs rounded-xl border border-slate-300 text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden leading-relaxed"
                          placeholder="Dán bài mẫu Band 8.0+ hoặc dàn ý gợi ý Task 2..."
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            {step === 'review' ? (
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Quay lại chọn file
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Hủy
              </button>

              {step === 'review' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSaveWritingResource(false)}
                    disabled={isSaving}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    {isSaving ? 'Đang lưu...' : 'Lưu vào Thư viện'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveWritingResource(true)}
                    disabled={isSaving}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <span>Lưu & Tạo bài tập online</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};
