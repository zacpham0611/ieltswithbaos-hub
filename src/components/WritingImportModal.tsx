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

  // Extracted Writing Data
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [extractedDoc, setExtractedDoc] = useState<ExtractedWritingDocument | null>(null);
  const [activeTaskIndex, setActiveTaskIndex] = useState<number>(0);
  const [taskType, setTaskType] = useState<WritingTaskType>('task1');
  const [chartType, setChartType] = useState<ChartType>('Bar Chart');
  const [prompt, setPrompt] = useState('');
  const [minWords, setMinWords] = useState(150);
  const [modelAnswer, setModelAnswer] = useState('');

  // Diagram / Image extraction & management
  const [detectedImages, setDetectedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Metadata for saving
  const [targetTitle, setTargetTitle] = useState('');
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

  const applyWritingTask = (task: ExtractedWritingTask, currentFileName: string = fileName) => {
    setTaskType(task.taskType);
    if (task.chartType) {
      setChartType(task.chartType);
    }
    setPrompt(task.prompt);
    setMinWords(task.minWords);
    setModelAnswer(task.sampleAnswers[0]?.content || '');
    setTargetTitle(
      `${task.taskType === 'task1' ? `Task 1: ${task.chartType || 'Report'}` : 'Task 2: Essay'} - ${currentFileName.replace(/\.[^/.]+$/, '')}`
    );
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
      setDetectedImages(extractedImgs);
      setSelectedImageIndex(0);
      setCustomImageUrl(extractedImgs[0] || null);

      // Advanced multi-task document parser
      const parsedDoc = parseWritingDocument(text, file.name);
      setExtractedDoc(parsedDoc);
      setActiveTaskIndex(0);

      if (parsedDoc.tasks.length > 0) {
        applyWritingTask(parsedDoc.tasks[0], file.name);
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

  // Upload custom replacement image
  const handleUploadCustomImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const url = await uploadMediaFile(file, 'images', `writing_chart_${Date.now()}`);
      setCustomImageUrl(url);
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
      let finalImageUrl = customImageUrl || detectedImages[selectedImageIndex] || '';

      // If diagram is a base64 string, upload to persistent storage
      if (finalImageUrl.startsWith('data:')) {
        try {
          const blob = await (await fetch(finalImageUrl)).blob();
          finalImageUrl = await uploadMediaFile(blob, 'images', `writing_diagram_${Date.now()}`);
        } catch (uploadErr) {
          console.warn('Failed to upload image blob, using inline:', uploadErr);
        }
      }

      const writingContent = {
        taskType,
        chartType: taskType === 'task1' ? chartType : undefined,
        prompt: prompt.trim(),
        minWords,
        imageUrl: taskType === 'task1' ? finalImageUrl : undefined,
        modelAnswer: modelAnswer.trim() || undefined,
      };

      // Save as Resource
      await addResource({
        title: targetTitle.trim() || `Writing ${taskType.toUpperCase()}`,
        type: 'doc',
        skill: 'writing',
        url: finalImageUrl || undefined,
        content: JSON.stringify(writingContent),
        folder: targetFolderName !== undefined ? (targetFolderName || undefined) : (targetFolder.trim() || undefined),
        folderId: targetFolderId || null,
        courseId: targetCourseId || null,
        tags: ['writing', taskType, taskType === 'task1' ? chartType : 'essay', 'imported'].filter(Boolean),
        isPublished: true,
      });

      // Optionally create an Assignment
      if (createAsAssignment) {
        await createAssignment({
          title: targetTitle.trim() || `Writing ${taskType.toUpperCase()}`,
          courseId: targetCourseId || courses[0]?.id || 'course_default',
          skill: 'writing',
          instructions: `Đề bài IELTS Writing ${taskType === 'task1' ? `Task 1 (${chartType})` : 'Task 2 Essay'}. Yêu cầu tối thiểu ${minWords} từ.`,
          objectives: 'Luyện tập kỹ năng IELTS Writing theo tiêu chuẩn chấm thi quốc tế.',
          status: 'published',
          dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
          writingPrompt: prompt.trim(),
          writingMinWords: minWords,
          writingTaskType: taskType,
          task1ImageUrl: taskType === 'task1' ? finalImageUrl : undefined,
          questions: [],
        });
      }

      setSaveSuccessMsg(createAsAssignment ? 'Đã lưu vào Thư viện và tạo Bài tập Writing thành công!' : 'Đã lưu tài liệu Writing vào Thư viện thành công!');
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

  const activeDiagramUrl = customImageUrl || detectedImages[selectedImageIndex];

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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {saveSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span className="font-semibold">{saveSuccessMsg}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6 max-w-2xl mx-auto py-8">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl p-10 text-center bg-emerald-50/20 hover:bg-emerald-50/50 transition-all cursor-pointer group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  Chọn hoặc kéo thả đề Writing vào đây
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Hỗ trợ định dạng <strong>DOCX</strong> hoặc <strong>PDF</strong>. Tự động trích xuất biểu đồ / hình ảnh Task 1.
                </p>
                <span className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors">
                  Duyệt file từ máy tính
                </span>
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
              {/* Multi-Task Switcher (when file contains both Task 1 & Task 2) */}
              {extractedDoc && extractedDoc.tasks.length > 1 && (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Phát hiện {extractedDoc.tasks.length} phần thi trong tài liệu:
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {extractedDoc.tasks.map((taskItem, tIdx) => (
                      <button
                        key={taskItem.id}
                        type="button"
                        onClick={() => {
                          setActiveTaskIndex(tIdx);
                          applyWritingTask(taskItem);
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          activeTaskIndex === tIdx
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-emerald-100 border border-slate-200'
                        }`}
                      >
                        {taskItem.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Task Classification Bar */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Phân loại Task:</span>
                  <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setTaskType('task1');
                        setMinWords(150);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg transition-all ${
                        taskType === 'task1'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Writing Task 1 (Report)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTaskType('task2');
                        setMinWords(250);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg transition-all ${
                        taskType === 'task2'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Writing Task 2 (Essay)
                    </button>
                  </div>
                </div>

                {taskType === 'task1' && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-700">Dạng biểu đồ:</span>
                    <select
                      value={chartType}
                      onChange={(e) => setChartType(e.target.value as ChartType)}
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
                )}
              </div>

              {/* Grid: Left Prompt Editor & Metadata, Right Diagram Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column (Prompt & Settings) */}
                <div className={`${taskType === 'task1' ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Tiêu đề tài liệu:</label>
                    <input
                      type="text"
                      value={targetTitle}
                      onChange={(e) => setTargetTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 block">Đề bài (Writing Prompt):</label>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Yêu cầu tối thiểu: <strong>{minWords}</strong> từ
                      </span>
                    </div>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={6}
                      className="w-full p-3 text-xs rounded-xl border border-slate-300 text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden leading-relaxed"
                      placeholder="Nhập nội dung đề bài tại đây..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">Số từ tối thiểu (Word Count):</label>
                      <input
                        type="number"
                        value={minWords}
                        onChange={(e) => setMinWords(Number(e.target.value))}
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
                      value={modelAnswer}
                      onChange={(e) => setModelAnswer(e.target.value)}
                      rows={4}
                      className="w-full p-3 text-xs rounded-xl border border-slate-300 text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden leading-relaxed"
                      placeholder="Dán bài mẫu Band 8.0+ hoặc từ vựng trọng tâm (nếu có)..."
                    />
                  </div>
                </div>

                {/* Right Column (Task 1 Diagram / Image Manager) */}
                {taskType === 'task1' && (
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
                      {detectedImages.length > 1 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Tìm thấy {detectedImages.length} ảnh/trang từ tài liệu:
                          </span>
                          <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {detectedImages.map((img, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setSelectedImageIndex(idx);
                                  setCustomImageUrl(null);
                                }}
                                className={`w-14 h-14 rounded-lg border-2 shrink-0 overflow-hidden bg-white p-0.5 transition-all ${
                                  selectedImageIndex === idx && !customImageUrl
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
                      {activeDiagramUrl ? (
                        <div className="space-y-2">
                          <div className="w-full max-h-72 bg-white rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center p-2 shadow-2xs">
                            <img
                              src={activeDiagramUrl}
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
                                setCustomImageUrl(null);
                                setDetectedImages((prev) => prev.filter((_, i) => i !== selectedImageIndex));
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
                )}
              </div>
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
