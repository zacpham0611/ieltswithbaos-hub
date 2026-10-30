import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import {
  TuitionStatement,
  TuitionModel,
  FeeConfiguration,
  PaymentRecord,
  TeacherBankInfo,
} from '../types';
import {
  WalletCards,
  Plus,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  Printer,
  ChevronRight,
  ChevronLeft,
  Filter,
  Search,
  CreditCard,
  Building,
  QrCode,
  ShieldCheck,
  History,
  X,
  TrendingUp,
  Globe,
  Edit,
  Upload,
  Trash2,
  Check,
  FileText,
} from 'lucide-react';
import { Portal } from '../components/Portal';
import {
  calculateMonthlyTuition,
  getEligibleSessionsForMonth,
  formatCurrency as formatTuitionCurrency,
  parseBillingMonth,
} from '../lib/tuitionCalculator';

export const TuitionView: React.FC = () => {
  const {
    currentUser,
    courses,
    courseMembers,
    feeConfigurations,
    createFeeConfiguration,
    updateFeeConfiguration,
    tuitionStatements,
    generateTuitionStatement,
    approveTuitionStatement,
    publishTuitionStatement,
    voidTuitionStatement,
    deleteTuitionStatement,
    recordPayment,
    selectedStatementId,
    setSelectedStatementId,
    lessons,
    toggleAttendanceSession,
    uploadTeacherPaymentQr,
    removeTeacherPaymentQr,
    updateProfile,
  } = useApp();

  const { t, locale, formatCurrency } = useI18n();

  if (!currentUser) return null;
  const isTeacher = currentUser.role === 'teacher';

  // Filters
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [searchStudent, setSearchStudent] = useState('');

  // Active Sub-Tab (Teacher)
  const [activeSubTab, setActiveSubTab] = useState<'statements' | 'calendar' | 'qr_banking' | 'settings'>('statements');

  // Modals
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  // Teaching Calendar state
  const [calendarCourseId, setCalendarCourseId] = useState<string>('');
  const [calendarStudentId, setCalendarStudentId] = useState<string>('');
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [sessionDuration, setSessionDuration] = useState<number>(60);
  const [isAttendanceUpdating, setIsAttendanceUpdating] = useState<boolean>(false);

  // Bank Info & QR Management state
  const [bankName, setBankName] = useState(currentUser.bankInfo?.bankName || 'Vietcombank');
  const [accountHolder, setAccountHolder] = useState(currentUser.bankInfo?.accountHolder || currentUser.name.toUpperCase());
  const [accountNumber, setAccountNumber] = useState(currentUser.bankInfo?.accountNumber || '');
  const [branch, setBranch] = useState(currentUser.bankInfo?.branch || 'Ho Chi Minh City');
  const [transferDesc, setTransferDesc] = useState(currentUser.bankInfo?.transferDescription || 'IELTS {STUDENT_NAME}');
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [isUploadingQr, setIsUploadingQr] = useState<boolean>(false);
  const [isSavingBank, setIsSavingBank] = useState<boolean>(false);
  const [qrNotice, setQrNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bankNotice, setBankNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // PDF Export Language Mode: 'en' | 'vi' | 'bilingual'
  const [pdfLanguageMode, setPdfLanguageMode] = useState<'en' | 'vi' | 'bilingual'>('bilingual');

  // Fee Config Form
  const [cfgCourseId, setCfgCourseId] = useState('');
  const [cfgModel, setCfgModel] = useState<TuitionModel>('fixed_monthly');
  const [cfgCurrency, setCfgCurrency] = useState<'VND' | 'USD'>('USD');
  const [cfgAmount, setCfgAmount] = useState(60);
  const [cfgDueDays, setCfgDueDays] = useState(15);
  const [cfgDiscountPercent, setCfgDiscountPercent] = useState(5);
  const [isSubmittingConfig, setIsSubmittingConfig] = useState(false);

  // Statement Generation Form
  const [calcCourseId, setCalcCourseId] = useState('');
  const [calcStudentId, setCalcStudentId] = useState('');
  const [calcPeriod, setCalcPeriod] = useState('October 2026');
  const [calcDueDate, setCalcDueDate] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]
  );
  const [calcUnits, setCalcUnits] = useState(5);
  const [calcCustomDiscount, setCalcCustomDiscount] = useState(15);
  const [calcDiscountNote, setCalcDiscountNote] = useState('Early payment discount 5%');
  const [isSubmittingCalc, setIsSubmittingCalc] = useState(false);

  // Record Payment Form
  const [payAmount, setPayAmount] = useState(285);
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState<'Bank Transfer' | 'Cash' | 'Credit Card' | 'Other'>('Bank Transfer');
  const [payRef, setPayRef] = useState('TX-2026-001');
  const [payNotes, setPayNotes] = useState('Paid via mobile banking transfer');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  const activeStatement = selectedStatementId
    ? tuitionStatements.find((s) => s.id === selectedStatementId)
    : null;

  // Scoped statements:
  const visibleStatements = isTeacher
    ? tuitionStatements.filter((s) => s.teacherId === currentUser.id)
    : tuitionStatements.filter((s) => s.studentId === currentUser.id);

  const filteredStatements = visibleStatements.filter((s) => {
    const matchesPeriod = filterPeriod === 'all' || s.billingPeriod.includes(filterPeriod);
    const matchesStudent =
      !searchStudent || s.studentName.toLowerCase().includes(searchStudent.toLowerCase());
    return matchesPeriod && matchesStudent;
  });

  // Overview metrics
  const totalRevenue = visibleStatements.reduce((acc, curr) => acc + curr.totalAmountDue, 0);
  const totalCollected = visibleStatements.reduce((acc, curr) => acc + curr.amountPaid, 0);
  const totalOutstanding = visibleStatements.reduce((acc, curr) => acc + curr.remainingBalance, 0);
  const pendingCount = visibleStatements.filter((s) => s.status === 'pending_approval').length;

  const openEditCourseFee = (cfg: FeeConfiguration) => {
    setCfgCourseId(cfg.courseId);
    setCfgModel(cfg.model);
    setCfgCurrency(cfg.currency);
    setCfgAmount(cfg.amount);
    setCfgDueDays(cfg.dueDays || 15);
    setCfgDiscountPercent(cfg.earlyPaymentDiscountPercent || 0);
    setShowConfigModal(true);
  };

  // Active course and dates for Teaching Calendar
  const activeCalCourse = courses.find((c) => c.id === (calendarCourseId || courses[0]?.id));
  const effectiveCalCourseId = activeCalCourse?.id || '';

  const calYear = calendarMonth.getFullYear();
  const calMonthIdx = calendarMonth.getMonth(); // 0-11
  const daysInCalMonth = new Date(calYear, calMonthIdx + 1, 0).getDate();
  const firstDayOfCalMonth = new Date(calYear, calMonthIdx, 1).getDay(); // 0 is Sunday
  const calStartOffset = (firstDayOfCalMonth + 6) % 7; // Monday-first: Mon=0, ..., Sun=6
  const calMonthName = calendarMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Filter lessons for calendar course and optional student in this calendar month
  const calMonthSessions = useMemo(() => {
    return lessons.filter((l) => {
      if (l.courseId !== effectiveCalCourseId) return false;
      if (calendarStudentId && l.studentId && l.studentId !== calendarStudentId) return false;
      if (l.status === 'cancelled') return false;
      if (!l.date) return false;
      const d = new Date(l.date);
      return d.getFullYear() === calYear && d.getMonth() === calMonthIdx;
    });
  }, [lessons, effectiveCalCourseId, calendarStudentId, calYear, calMonthIdx]);

  const calSessionMap = useMemo(() => {
    const map = new Map<string, typeof lessons[0]>();
    calMonthSessions.forEach((s) => {
      if (s.date) map.set(s.date, s);
    });
    return map;
  }, [calMonthSessions]);

  const calTotalMinutes = calMonthSessions.reduce((acc, s) => acc + (s.durationMinutes || 60), 0);
  const calTotalHours = (calTotalMinutes / 60).toFixed(1);

  // Live calculation preview for statement modal
  const calcPreview = useMemo(() => {
    if (!calcCourseId) return null;
    const targetCourse = courses.find((c) => c.id === calcCourseId);
    const targetStudent = courseMembers.find((m) => m.studentId === calcStudentId);
    const targetConfig = feeConfigurations.find((f) => f.courseId === calcCourseId);

    return calculateMonthlyTuition({
      courseId: calcCourseId,
      courseName: targetCourse?.name || 'Course',
      studentId: calcStudentId,
      studentName: targetStudent?.studentName || 'Student',
      billingMonth: calcPeriod,
      feeConfig: targetConfig,
      course: targetCourse,
      sessions: lessons,
      manualDiscount: calcCustomDiscount,
      discountDescription: calcDiscountNote,
    });
  }, [calcCourseId, calcStudentId, calcPeriod, calcCustomDiscount, calcDiscountNote, courses, courseMembers, feeConfigurations, lessons]);

  const handleToggleDay = async (dayNumber: number) => {
    if (!effectiveCalCourseId || isAttendanceUpdating) return;
    const dateStr = `${calYear}-${String(calMonthIdx + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    setIsAttendanceUpdating(true);
    try {
      await toggleAttendanceSession(effectiveCalCourseId, calendarStudentId || null, dateStr, sessionDuration);
    } catch (err: any) {
      alert(err.message || 'Error updating attendance session');
    } finally {
      setIsAttendanceUpdating(false);
    }
  };

  const handleSelectQrFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQrNotice(null);
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (file.size > 5 * 1024 * 1024) {
      setQrNotice({ type: 'error', text: 'QR image must be under 5MB' });
      return;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setQrNotice({ type: 'error', text: 'Supported formats: PNG, JPG, WEBP, SVG' });
      return;
    }

    setQrFile(file);
    const objectUrl = URL.createObjectURL(file);
    setQrPreview(objectUrl);
  };

  const handleUploadQr = async () => {
    if (!qrFile) return;
    setIsUploadingQr(true);
    setQrNotice(null);
    try {
      await uploadTeacherPaymentQr(qrFile);
      setQrNotice({ type: 'success', text: 'Teacher Payment QR code saved and active!' });
      setQrFile(null);
    } catch (err: any) {
      setQrNotice({ type: 'error', text: err.message || 'Failed to upload QR code' });
    } finally {
      setIsUploadingQr(false);
    }
  };

  const handleRemoveQr = async () => {
    if (!confirm('Are you sure you want to remove your payment QR code?')) return;
    setIsUploadingQr(true);
    setQrNotice(null);
    try {
      await removeTeacherPaymentQr();
      setQrPreview(null);
      setQrFile(null);
      setQrNotice({ type: 'success', text: 'Payment QR code removed' });
    } catch (err: any) {
      setQrNotice({ type: 'error', text: err.message || 'Failed to remove QR code' });
    } finally {
      setIsUploadingQr(false);
    }
  };

  const handleSaveBankInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBank(true);
    setBankNotice(null);
    try {
      const updatedBankInfo: TeacherBankInfo = {
        bankName: bankName.trim(),
        accountHolder: accountHolder.trim().toUpperCase(),
        accountNumber: accountNumber.trim(),
        branch: branch.trim(),
        transferDescription: transferDesc.trim(),
        qrCodeUrl: currentUser.paymentQrUrl,
      };

      await updateProfile({
        bankInfo: updatedBankInfo,
      });

      setBankNotice({ type: 'success', text: 'Banking details updated successfully!' });
    } catch (err: any) {
      setBankNotice({ type: 'error', text: err.message || 'Failed to update banking details' });
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleCreateFeeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfgCourseId) return;

    setIsSubmittingConfig(true);
    try {
      const course = courses.find((c) => c.id === cfgCourseId);
      await updateFeeConfiguration(cfgCourseId, {
        courseId: cfgCourseId,
        courseName: course?.name || 'Course',
        model: cfgModel,
        currency: cfgCurrency,
        amount: cfgAmount,
        sessionRate: cfgModel === 'per_session' ? cfgAmount : undefined,
        hourlyRate: cfgModel === 'hourly' ? cfgAmount : undefined,
        effectiveDate: new Date().toISOString().split('T')[0],
        billingDay: 1,
        dueDays: cfgDueDays,
        prorationRule: 'session',
        earlyPaymentDiscountPercent: cfgDiscountPercent,
      });

      setShowConfigModal(false);
    } catch (err: any) {
      alert(err.message || 'Error saving configuration');
    } finally {
      setIsSubmittingConfig(false);
    }
  };

  const handleGenerateStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calcCourseId || !calcStudentId) return;

    setIsSubmittingCalc(true);
    try {
      const created = await generateTuitionStatement({
        courseId: calcCourseId,
        studentId: calcStudentId,
        billingPeriod: calcPeriod,
        dueDate: calcDueDate,
        billableUnits: calcUnits,
        customDiscount: calcCustomDiscount,
        customDiscountNote: calcDiscountNote,
      });

      setShowCalcModal(false);
      setSelectedStatementId(created.id);
    } catch (err: any) {
      alert(err.message || 'Error generating statement');
    } finally {
      setIsSubmittingCalc(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStatement) return;

    setIsSubmittingPay(true);
    try {
      await recordPayment(activeStatement.id, {
        amount: Number(payAmount),
        paymentDate: payDate,
        paymentMethod: payMethod,
        transactionReference: payRef,
        notes: payNotes,
      });

      setShowPayModal(false);
    } catch (err: any) {
      alert(err.message || 'Error recording payment');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Helper for Statement PDF Language Mode
  const getPdfLabel = (enText: string, viText: string) => {
    if (pdfLanguageMode === 'en') return enText;
    if (pdfLanguageMode === 'vi') return viText;
    return `${enText} / ${viText}`;
  };

  // Deletion state
  const [statementToDelete, setStatementToDelete] = useState<TuitionStatement | null>(null);
  const [isDeletingStatement, setIsDeletingStatement] = useState<boolean>(false);
  const [confirmPaidDeleteChecked, setConfirmPaidDeleteChecked] = useState<boolean>(false);

  const handleDeleteStatement = async () => {
    if (!statementToDelete) return;
    setIsDeletingStatement(true);
    try {
      await deleteTuitionStatement(statementToDelete.id);
      if (selectedStatementId === statementToDelete.id) {
        setSelectedStatementId(null);
      }
      setStatementToDelete(null);
      setConfirmPaidDeleteChecked(false);
    } catch (err: any) {
      alert(err?.message || 'Có lỗi xảy ra khi xóa phiếu học phí.');
    } finally {
      setIsDeletingStatement(false);
    }
  };

  const renderDeleteModal = () => {
    if (!statementToDelete) return null;
    const isPaidOrHasPayments = statementToDelete.status === 'paid' || statementToDelete.amountPaid > 0;
    return (
      <Portal>
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="relative z-10 bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center space-x-3 text-red-600 mb-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {getPdfLabel('Confirm Delete Tuition Statement', 'Xác nhận xóa phiếu học phí')}
              </h3>
            </div>
            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              {getPdfLabel('Are you sure you want to permanently delete statement', 'Bạn có chắc chắn muốn xóa vĩnh viễn phiếu học phí')}{' '}
              <strong className="text-slate-900 font-mono">{statementToDelete.statementNumber}</strong> {getPdfLabel('for student', 'của học viên')}{' '}
              <strong className="text-slate-900">{statementToDelete.studentName}</strong> ({statementToDelete.courseName} - {statementToDelete.billingPeriod})?
            </p>

            {isPaidOrHasPayments ? (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 mb-4 space-y-2">
                <div className="flex items-center space-x-1.5 font-bold text-rose-900">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{getPdfLabel('Warning: Statement Has Payments Recorded!', 'Cảnh báo: Phiếu đã được thanh toán / có lịch sử thanh toán!')}</span>
                </div>
                <p>
                  {getPdfLabel(
                    `This statement has recorded payments (${formatTuitionCurrency(statementToDelete.amountPaid, statementToDelete.currency)}). Deleting it will permanently remove all associated payment transaction records and reset the student billing status for this period.`,
                    `Phiếu này đã ghi nhận thanh toán (${formatTuitionCurrency(statementToDelete.amountPaid, statementToDelete.currency)}). Việc xóa phiếu sẽ xóa toàn bộ lịch sử thanh toán liên quan và khôi phục lại trạng thái học phí của kỳ này.`
                  )}
                </p>
                <label className="flex items-start space-x-2 pt-2 border-t border-rose-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmPaidDeleteChecked}
                    onChange={(e) => setConfirmPaidDeleteChecked(e.target.checked)}
                    className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="font-semibold text-rose-900">
                    {getPdfLabel(
                      'I confirm that I want to delete this paid statement and all its payment history.',
                      'Tôi hiểu và xác nhận muốn xóa phiếu học phí đã thanh toán này cùng toàn bộ lịch sử giao dịch.'
                    )}
                  </span>
                </label>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-4">
                <p className="font-semibold mb-1">{getPdfLabel('Important Notice:', 'Lưu ý quan trọng:')}</p>
                <p>
                  {getPdfLabel(
                    'This action will permanently delete this tuition statement. Attendance records and teaching calendar logs will remain intact.',
                    'Thao tác này sẽ xóa vĩnh viễn phiếu học phí. Lịch sử điểm danh và buổi dạy của học viên vẫn được giữ nguyên an toàn.'
                  )}
                </p>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={isDeletingStatement}
                onClick={() => {
                  setStatementToDelete(null);
                  setConfirmPaidDeleteChecked(false);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={isDeletingStatement || (isPaidOrHasPayments && !confirmPaidDeleteChecked)}
                onClick={handleDeleteStatement}
                className={`px-4 py-2 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 ${
                  isDeletingStatement || (isPaidOrHasPayments && !confirmPaidDeleteChecked)
                    ? 'bg-red-400 cursor-not-allowed opacity-60'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isDeletingStatement ? (
                  <span>{t('common.loading')}</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{getPdfLabel('Delete Statement', 'Xóa phiếu học phí')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Portal>
    );
  };

  // If a statement is selected, show Statement Detail / Printable View
  if (activeStatement) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Navigation & Actions */}
        <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <button
              onClick={() => setSelectedStatementId(null)}
              className="text-xs font-semibold text-blue-600 hover:underline mb-1 block"
            >
              &larr; {t('tuition.backToStatements')}
            </button>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-slate-900">
                {t('tuition.statementNoLabel')} {activeStatement.statementNumber}
              </h1>
              <span
                className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                  activeStatement.status === 'paid'
                    ? 'bg-emerald-100 text-emerald-800'
                    : activeStatement.status === 'partially_paid'
                    ? 'bg-blue-100 text-blue-800'
                    : activeStatement.status === 'approved'
                    ? 'bg-indigo-100 text-indigo-800'
                    : activeStatement.status === 'void'
                    ? 'bg-slate-200 text-slate-600'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {t(`status.${activeStatement.status === 'partially_paid' ? 'partiallyPaid' : activeStatement.status === 'pending_approval' ? 'pendingApproval' : activeStatement.status}` as any) || activeStatement.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('tuition.tableCourse')}: <span className="font-semibold text-slate-700">{activeStatement.courseName}</span> · {t('tuition.tableStudent')}: {activeStatement.studentName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* PDF Language Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs mr-1">
              <span className="px-2 text-slate-400 font-medium flex items-center space-x-1">
                <Globe className="w-3 h-3" />
                <span className="hidden sm:inline">{t('tuition.languageModeLabel')}:</span>
              </span>
              <button
                type="button"
                onClick={() => setPdfLanguageMode('en')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  pdfLanguageMode === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setPdfLanguageMode('vi')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  pdfLanguageMode === 'vi' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                VI
              </button>
              <button
                type="button"
                onClick={() => setPdfLanguageMode('bilingual')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  pdfLanguageMode === 'bilingual' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN/VI
              </button>
            </div>

            <button
              onClick={() => window.print()}
              className="whitespace-nowrap shrink-0 px-3.5 py-2 bg-slate-800 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>{t('tuition.exportPdfBtn')}</span>
            </button>

            {isTeacher && activeStatement.status === 'pending_approval' && (
              <button
                onClick={() => approveTuitionStatement(activeStatement.id)}
                className="whitespace-nowrap shrink-0 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{t('tuition.approveBtn')}</span>
              </button>
            )}

            {isTeacher && activeStatement.status === 'approved' && (
              <button
                onClick={() => publishTuitionStatement(activeStatement.id)}
                className="whitespace-nowrap shrink-0 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{t('tuition.publishBtn')}</span>
              </button>
            )}

            {isTeacher && activeStatement.remainingBalance > 0 && (
              <button
                onClick={() => {
                  setPayAmount(activeStatement.remainingBalance);
                  setShowPayModal(true);
                }}
                className="whitespace-nowrap shrink-0 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
              >
                <DollarSign className="w-4 h-4" />
                <span>{t('tuition.recordPaymentBtn')}</span>
              </button>
            )}

            {isTeacher && (
              <button
                onClick={() => {
                  setConfirmPaidDeleteChecked(false);
                  setStatementToDelete(activeStatement);
                }}
                className="whitespace-nowrap shrink-0 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
                title={getPdfLabel('Delete statement', 'Xóa phiếu học phí')}
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>{getPdfLabel('Delete', 'Xóa')}</span>
              </button>
            )}
          </div>
        </div>

        {/* PRINTABLE STATEMENT CONTAINERS (PAGINATION-OPTIMIZED: MAX 2 A4 PAGES) */}
        {(() => {
          const sessionCount = activeStatement.teachingDates?.length || 0;
          const chargeCount = activeStatement.itemizedCharges.length + (activeStatement.discountAmount > 0 ? 1 : 0);
          const paymentCount = activeStatement.payments.length;
          const auditCount = activeStatement.auditHistory.length;
          const qrUrl = activeStatement.bankInfo?.qrCodeUrl || activeStatement.qrCodeUrl || currentUser.paymentQrUrl;
          const isMultiPage = sessionCount > 8 || chargeCount > 4 || paymentCount > 1 || (sessionCount > 4 && paymentCount > 0) || auditCount > 3;

          // Render Bank & QR Sub-block
          const renderPaymentInfoBlock = (isCompact: boolean) => (
            <div className="print-avoid-break">
              <h3 className="text-xs font-extrabold uppercase text-slate-900 tracking-wider mb-2">
                {getPdfLabel('PAYMENT INFORMATION', 'THÔNG TIN THANH TOÁN')}
              </h3>

              <div className="border border-slate-200 rounded-lg overflow-hidden grid grid-cols-1 md:grid-cols-2">
                {/* Bank Transfer Details */}
                <div className={`${isCompact ? 'p-3 space-y-2' : 'p-4 space-y-3'} border-b md:border-b-0 md:border-r border-slate-200`}>
                  <div className="bg-slate-900 text-white text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-sm w-fit">
                    {getPdfLabel('BANK TRANSFER', 'CHUYỂN KHOẢN NGÂN HÀNG')}
                  </div>
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        {getPdfLabel('Bank name', 'Tên ngân hàng')}
                      </span>
                      <span className="font-bold text-slate-800">{activeStatement.bankInfo.bankName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        {getPdfLabel('Account holder', 'Chủ tài khoản')}
                      </span>
                      <span className="font-bold text-slate-800">{activeStatement.bankInfo.accountHolder}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        {getPdfLabel('Account number', 'Số tài khoản')}
                      </span>
                      <span className="font-mono font-bold text-slate-900 text-sm tracking-wider">
                        {activeStatement.bankInfo.accountNumber}
                      </span>
                    </div>
                    {activeStatement.bankInfo.branch && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          {getPdfLabel('Branch', 'Chi nhánh')}
                        </span>
                        <span className="font-semibold text-slate-800">{activeStatement.bankInfo.branch}</span>
                      </div>
                    )}
                    <div className="pt-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        {getPdfLabel('Transfer description', 'Nội dung chuyển khoản')}
                      </span>
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 block mt-0.5 text-xs">
                        {activeStatement.bankInfo.transferDescription || activeStatement.statementNumber}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 pt-0.5">
                    {getPdfLabel(
                      'Please verify the recipient and amount before confirming your transfer.',
                      'Vui lòng kiểm tra kỹ người nhận và số tiền trước khi xác nhận chuyển khoản.'
                    )}
                  </p>
                </div>

                {/* Scan to Pay QR Graphic */}
                {!qrUrl ? (
                  <div className="p-3 flex flex-col items-center justify-center text-center space-y-1.5 bg-slate-50/50">
                    <div className="bg-slate-200 text-slate-700 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-sm">
                      {getPdfLabel('DIRECT TRANSFER', 'CHUYỂN KHOẢN TRỰC TIẾP')}
                    </div>
                    <p className="text-xs text-slate-500 max-w-xs mt-1">
                      {getPdfLabel(
                        'No payment QR code is attached. Please use the account details on the left for manual mobile banking transfer.',
                        'Không có mã QR thanh toán đính kèm. Vui lòng chuyển khoản theo thông tin tài khoản bên trái.'
                      )}
                    </p>
                    <p className="font-mono font-bold text-slate-700 text-xs mt-1">
                      {getPdfLabel('Reference', 'Nội dung CK')}: {activeStatement.bankInfo?.transferDescription || activeStatement.statementNumber}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 flex flex-col items-center justify-center text-center space-y-2 bg-slate-50/50">
                    <div className="bg-slate-900 text-white text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-sm">
                      {getPdfLabel('SCAN TO PAY', 'QUÉT MÃ ĐỂ THANH TOÁN')}
                    </div>
                    <img
                      src={qrUrl}
                      alt="Payment QR Code"
                      className={`${isCompact ? 'w-24 h-24' : 'w-32 h-32'} object-contain rounded-lg border border-slate-300 bg-white p-1.5 shadow-2xs`}
                    />
                    <div className="text-[10px] text-slate-500">
                      <p>{getPdfLabel('Scan using your banking or e-wallet app.', 'Quét bằng app ngân hàng hoặc ví điện tử.')}</p>
                      <p className="font-mono font-bold text-slate-700 mt-0.5">
                        {getPdfLabel('Reference', 'Mã phiếu')}: {activeStatement.statementNumber}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );

          // Render Fee Breakdown Table
          const renderFeeTable = () => (
            <div className="print-avoid-break">
              <h3 className="text-xs font-extrabold uppercase text-slate-900 tracking-wider mb-2">
                {getPdfLabel('FEE BREAKDOWN', 'CHI TIẾT CÁC KHOẢN PHÍ')}
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
                    <tr>
                      <th className="py-2 px-3.5">{getPdfLabel('Description', 'Diễn giải')}</th>
                      <th className="py-2 px-3.5 text-center">{getPdfLabel('Quantity', 'Số lượng')}</th>
                      <th className="py-2 px-3.5 text-right">{getPdfLabel('Unit price', 'Đơn giá')}</th>
                      <th className="py-2 px-3.5 text-right">{getPdfLabel('Amount', 'Thành tiền')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activeStatement.itemizedCharges.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 px-3.5 font-medium text-slate-800">{item.description}</td>
                        <td className="py-2 px-3.5 text-center text-slate-600">{item.quantity ?? '—'}</td>
                        <td className="py-2 px-3.5 text-right text-slate-600">
                          {item.unitPrice ? `${activeStatement.currency} ${item.unitPrice.toLocaleString()}` : '—'}
                        </td>
                        <td className="py-2 px-3.5 text-right font-bold text-slate-900">
                          {item.amount > 0 ? `${activeStatement.currency} ${item.amount.toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    ))}

                    {/* Discount */}
                    {activeStatement.discountAmount > 0 && (
                      <tr className="bg-slate-50/50">
                        <td className="py-2 px-3.5 font-medium text-slate-800">
                          {activeStatement.discountDescription || getPdfLabel('Discount', 'Chiết khấu / Giảm giá')}
                        </td>
                        <td className="py-2 px-3.5 text-center text-slate-600">—</td>
                        <td className="py-2 px-3.5 text-right text-slate-600">—</td>
                        <td className="py-2 px-3.5 text-right font-bold text-emerald-700">
                          − {activeStatement.currency} {activeStatement.discountAmount.toLocaleString()}
                        </td>
                      </tr>
                    )}

                    {/* Previous Balance */}
                    <tr>
                      <td className="py-1.5 px-3.5 font-medium text-slate-600">
                        {getPdfLabel('Previous balance', 'Số dư kỳ trước')}
                      </td>
                      <td className="py-1.5 px-3.5 text-center text-slate-400">—</td>
                      <td className="py-1.5 px-3.5 text-right text-slate-400">—</td>
                      <td className="py-1.5 px-3.5 text-right font-medium text-slate-600">
                        {activeStatement.currency} {activeStatement.previousBalance.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Total Due Banner */}
                <div className="bg-blue-50/90 px-4 py-2.5 flex items-center justify-between border-t border-slate-200">
                  <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
                    {getPdfLabel('TOTAL AMOUNT DUE', 'TỔNG TIỀN PHẢI THANH TOÁN')}
                  </span>
                  <span className="font-extrabold text-lg text-blue-900">
                    {activeStatement.currency} {activeStatement.totalAmountDue.toLocaleString()}
                  </span>
                </div>

                {/* Payment Status summary strip */}
                <div className="bg-white px-4 py-2 text-xs flex flex-wrap items-center justify-between border-t border-slate-200 text-slate-600 gap-2">
                  <div className="flex items-center space-x-1.5">
                    <span>{getPdfLabel('Payment status', 'Trạng thái')}:</span>
                    <strong className="capitalize text-slate-900 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200">
                      {activeStatement.status.replace('_', ' ')}
                    </strong>
                  </div>
                  <div className="flex items-center space-x-3 text-xs">
                    <span>
                      {getPdfLabel('Amount paid', 'Đã thanh toán')}: <strong className="text-slate-900">{activeStatement.currency} {activeStatement.amountPaid.toLocaleString()}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      {getPdfLabel('Remaining', 'Còn lại')}: <strong className="text-rose-700 font-bold">{activeStatement.currency} {activeStatement.remainingBalance.toLocaleString()}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );

          // Render Payment History Table
          const renderPaymentHistory = () => (
            activeStatement.payments.length > 0 ? (
              <div className="print-avoid-break">
                <h4 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider mb-2">
                  {getPdfLabel('PAYMENT HISTORY & SETTLEMENTS', 'LỊCH SỬ THANH TOÁN & ĐỐI SOÁT')}
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold">
                      <tr>
                        <th className="py-2 px-3">{getPdfLabel('Date', 'Ngày')}</th>
                        <th className="py-2 px-3">{getPdfLabel('Method', 'Phương thức')}</th>
                        <th className="py-2 px-3">{getPdfLabel('Transaction Ref', 'Mã giao dịch')}</th>
                        <th className="py-2 px-3 text-right">{getPdfLabel('Amount Paid', 'Số tiền')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeStatement.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-1.5 px-3 text-slate-700">{p.paymentDate}</td>
                          <td className="py-1.5 px-3 text-slate-700">{p.paymentMethod}</td>
                          <td className="py-1.5 px-3 font-mono text-slate-600">{p.transactionReference}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-emerald-700">
                            {activeStatement.currency} {p.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null
          );

          // Render Audit History & Disclaimer
          const renderAuditAndDisclaimer = () => (
            <div className="space-y-2 pt-2 border-t border-slate-200 print-avoid-break">
              {activeStatement.auditHistory.length > 0 && (
                <div className="text-[10px] text-slate-500 space-y-0.5">
                  <span className="font-bold text-slate-700 flex items-center space-x-1 mb-0.5">
                    <History className="w-3 h-3 text-slate-400" />
                    <span>{getPdfLabel('Traceable Audit History:', 'Lịch sử đối soát:')}</span>
                  </span>
                  {activeStatement.auditHistory.slice(0, 3).map((a, i) => (
                    <div key={i} className="flex justify-between">
                      <span>• {a.action} ({a.user})</span>
                      <span className="text-slate-400">{a.timestamp}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-[9px] text-slate-400 text-center pt-2 border-t border-slate-100">
                {getPdfLabel(
                  'This statement is a tuition payment document generated by IELTS Teaching Hub, not a tax invoice.',
                  'Phiếu này là chứng từ học phí được tạo từ IELTS Teaching Hub, không phải hóa đơn giá trị gia tăng.'
                )}
              </div>
            </div>
          );

          // -------------------------------------------------------------
          // CONDITIONAL RENDERING: SINGLE-PAGE MODE
          // -------------------------------------------------------------
          if (!isMultiPage) {
            return (
              <div className="print-page bg-white rounded-xl border border-slate-200 shadow-md p-6 sm:p-8 space-y-4 font-sans">
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b-2 border-slate-800 gap-4">
                  <div>
                    <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-xl tracking-tight">
                      <span className="w-3 h-3 bg-blue-700 inline-block"></span>
                      <span>IELTS Teaching Hub</span>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                      {getPdfLabel('MONTHLY TUITION STATEMENT • STUDENT COPY', 'PHIẾU BÁO HỌC PHÍ HÀNG THÁNG • BẢN HỌC VIÊN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-base text-slate-900 uppercase">
                      {activeStatement.billingPeriod}
                    </span>
                  </div>
                </div>

                {/* Student & Course Meta Info */}
                <div className="print-avoid-break">
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">{getPdfLabel('STUDENT', 'HỌC VIÊN')}</span>
                      <span className="font-bold text-slate-900 text-xs">{activeStatement.studentName}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">{getPdfLabel('TEACHER', 'GIÁO VIÊN')}</span>
                      <span className="font-bold text-slate-900 text-xs">{activeStatement.teacherName}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">{getPdfLabel('COURSE', 'KHÓA HỌC')}</span>
                      <span className="font-bold text-slate-800">{activeStatement.courseName}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">{getPdfLabel('DUE DATE', 'HẠN THANH TOÁN')}</span>
                      <span className="font-bold text-slate-800">{activeStatement.dueDate}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">{getPdfLabel('STATEMENT NO.', 'SỐ PHIẾU')}</span>
                      <span className="font-mono font-bold text-slate-800">{activeStatement.statementNumber}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">{getPdfLabel('BILLING PERIOD', 'KỲ HỌC PHÍ')}</span>
                      <span className="font-bold text-slate-800">{activeStatement.billingPeriod}</span>
                    </div>
                  </div>
                </div>

                {/* Attended Teaching Sessions */}
                {activeStatement.teachingDates && activeStatement.teachingDates.length > 0 && (
                  <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/60 text-xs print-avoid-break">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block mb-1">
                      {getPdfLabel('ATTENDED TEACHING SESSIONS', 'BUỔI HỌC ĐÃ ĐIỂM DANH')} ({activeStatement.teachingDates.length} {getPdfLabel('sessions', 'buổi')}{activeStatement.totalTeachingHours ? ` • ${activeStatement.totalTeachingHours} hrs` : ''})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {activeStatement.teachingDates.map((dateStr, idx) => (
                        <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          ✓ {dateStr}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fee Breakdown Table */}
                {renderFeeTable()}

                {/* Payment Information & QR code */}
                {renderPaymentInfoBlock(true)}

                {/* Payment History if any */}
                {renderPaymentHistory()}

                {/* Audit & Disclaimer */}
                {renderAuditAndDisclaimer()}

                {/* Page Indicator Footer */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 print-avoid-break">
                  <span>{activeStatement.statementNumber} • {activeStatement.billingPeriod}</span>
                  <span className="font-semibold text-slate-500">{getPdfLabel('Page 1 of 1', 'Trang 1 / 1')}</span>
                </div>
              </div>
            );
          }

          // -------------------------------------------------------------
          // CONDITIONAL RENDERING: MULTI-PAGE MODE (EXACTLY 2 A4 PAGES)
          // -------------------------------------------------------------
          return (
            <div className="space-y-6">
              {/* PAGE 1 CONTAINER */}
              <div className="print-page bg-white rounded-xl border border-slate-200 shadow-md p-6 sm:p-8 space-y-4 font-sans relative">
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b-2 border-slate-800 gap-4">
                  <div>
                    <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-xl tracking-tight">
                      <span className="w-3.5 h-3.5 bg-blue-700 inline-block"></span>
                      <span>IELTS Teaching Hub</span>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                      {getPdfLabel('MONTHLY TUITION STATEMENT • STUDENT COPY', 'PHIẾU BÁO HỌC PHÍ HÀNG THÁNG • BẢN HỌC VIÊN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-base text-slate-900 uppercase">
                      {activeStatement.billingPeriod}
                    </span>
                  </div>
                </div>

                {/* Student & Course Meta Info */}
                <div className="print-avoid-break">
                  <h3 className="text-xs font-extrabold uppercase text-slate-900 tracking-wider mb-2">
                    {getPdfLabel('STUDENT INFORMATION', 'THÔNG TIN HỌC VIÊN')}
                  </h3>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">{getPdfLabel('STUDENT', 'HỌC VIÊN')}</span>
                      <span className="font-bold text-slate-900 text-sm">{activeStatement.studentName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">{getPdfLabel('TEACHER', 'GIÁO VIÊN')}</span>
                      <span className="font-bold text-slate-900 text-sm">{activeStatement.teacherName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">{getPdfLabel('COURSE', 'KHÓA HỌC')}</span>
                      <span className="font-bold text-slate-800">{activeStatement.courseName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">{getPdfLabel('DUE DATE', 'HẠN THANH TOÁN')}</span>
                      <span className="font-bold text-slate-800">{activeStatement.dueDate}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">{getPdfLabel('STATEMENT NO.', 'SỐ PHIẾU')}</span>
                      <span className="font-mono font-bold text-slate-900">{activeStatement.statementNumber}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">{getPdfLabel('BILLING PERIOD', 'KỲ HỌC PHÍ')}</span>
                      <span className="font-bold text-slate-800">{activeStatement.billingPeriod}</span>
                    </div>
                  </div>
                </div>

                {/* Attended Teaching Sessions */}
                {activeStatement.teachingDates && activeStatement.teachingDates.length > 0 && (
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60 text-xs print-avoid-break">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">
                      {getPdfLabel('ATTENDED TEACHING SESSIONS', 'BUỔI HỌC ĐÃ ĐIỂM DANH')} ({activeStatement.teachingDates.length} {getPdfLabel('sessions', 'buổi')}{activeStatement.totalTeachingHours ? ` • ${activeStatement.totalTeachingHours} hrs` : ''})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeStatement.teachingDates.map((dateStr, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          ✓ {dateStr}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fee Breakdown Table */}
                {renderFeeTable()}

                {/* Transition notice to Page 2 */}
                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between print-avoid-break">
                  <span className="font-medium">
                    {getPdfLabel(
                      'Payment instructions, bank QR code, and settlement history are detailed on Page 2.',
                      'Hướng dẫn chuyển khoản, mã QR và lịch sử thanh toán được trình bày chi tiết tại Trang 2.'
                    )}
                  </span>
                  <span className="font-bold text-blue-700 ml-2 whitespace-nowrap">&rarr; {getPdfLabel('See Page 2', 'Xem Trang 2')}</span>
                </div>

                {/* Page 1 Footer */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 print-avoid-break">
                  <span>{activeStatement.statementNumber} • {activeStatement.billingPeriod}</span>
                  <span className="font-bold text-slate-600">{getPdfLabel('Page 1 of 2', 'Trang 1 / 2')}</span>
                </div>
              </div>

              {/* PAGE 2 CONTAINER */}
              <div className="print-page print-force-page-break bg-white rounded-xl border border-slate-200 shadow-md p-6 sm:p-8 space-y-4 font-sans relative">
                {/* Compact Page 2 Header */}
                <div className="flex items-center justify-between pb-3 border-b-2 border-slate-800 text-xs">
                  <div className="flex items-center space-x-2 text-slate-900 font-extrabold">
                    <span className="w-2.5 h-2.5 bg-blue-700 inline-block"></span>
                    <span>IELTS Teaching Hub • {getPdfLabel('TUITION STATEMENT', 'PHIẾU HỌC PHÍ')}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-slate-600 text-[11px]">
                    <span>{activeStatement.studentName}</span>
                    <span>•</span>
                    <span className="font-mono">{activeStatement.statementNumber}</span>
                    <span>•</span>
                    <span className="font-bold text-blue-800">
                      {activeStatement.currency} {activeStatement.totalAmountDue.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Payment Information & QR code */}
                {renderPaymentInfoBlock(false)}

                {/* Payment History Table */}
                {renderPaymentHistory()}

                {/* Audit & Legal Disclaimer */}
                {renderAuditAndDisclaimer()}

                {/* Page 2 Footer */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 print-avoid-break">
                  <span>{activeStatement.statementNumber} • {activeStatement.billingPeriod}</span>
                  <span className="font-bold text-slate-600">{getPdfLabel('Page 2 of 2', 'Trang 2 / 2')}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Modal: Record Payment */}
        {showPayModal && (
          <Portal>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="relative z-10 bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <h3 className="text-base font-bold text-slate-900">{t('tuition.recordModalTitle')}</h3>
                  <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs mb-4">
                  <span className="text-slate-500">{t('tuition.tableStudent')}: </span>
                  <strong className="text-slate-800">{activeStatement.studentName}</strong>
                  <span className="block text-slate-500 mt-1">
                    {t('tuition.remainingLabel')}: <strong>{activeStatement.currency} {activeStatement.remainingBalance.toLocaleString()}</strong>
                  </span>
                </div>

                <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('tuition.paymentAmount')}</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={payAmount}
                      onChange={(e) => setPayAmount(Number(e.target.value))}
                      className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden font-bold text-sm"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      {t('tuition.partialNote')}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">{t('tuition.paymentDate')}</label>
                      <input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">{t('tuition.paymentMethod')}</label>
                      <select
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value as any)}
                        className="w-full p-2 border border-slate-300 rounded-lg outline-hidden bg-white"
                      >
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cash">Cash</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('tuition.transactionRef')}</label>
                    <input
                      type="text"
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      placeholder="e.g. TX-2026-001234 or bank trace ID"
                      className="w-full p-2 border border-slate-300 rounded-lg outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('tuition.notesRemark')}</label>
                    <input
                      type="text"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      placeholder="e.g. Paid in full via banking app"
                      className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowPayModal(false)}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingPay}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs"
                    >
                      {isSubmittingPay ? t('common.loading') : t('tuition.confirmPaymentBtn')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Portal>
        )}
        {/* Modal: Confirm Delete Statement */}
        {renderDeleteModal()}
      </div>
    );
  }

  // Tuition Management Overview
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('tuition.title')}</h1>
          <p className="text-sm text-slate-500">
            {isTeacher ? t('tuition.subtitleTeacher') : t('tuition.subtitleStudent')}
          </p>
        </div>

        {isTeacher && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (courses.length > 0 && !cfgCourseId) {
                  setCfgCourseId(courses[0].id);
                }
                setShowConfigModal(true);
              }}
              className="px-3.5 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{t('tuition.newConfigBtn')}</span>
            </button>
            <button
              onClick={() => {
                if (courses.length > 0 && !calcCourseId) {
                  setCalcCourseId(courses[0].id);
                }
                setShowCalcModal(true);
              }}
              className="px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <DollarSign className="w-4 h-4" />
              <span>{t('tuition.calculateStatementBtn')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Sub Tabs Navigation (Teachers) */}
      {isTeacher && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setActiveSubTab('statements')}
            className={`whitespace-nowrap shrink-0 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors flex items-center space-x-1.5 ${
              activeSubTab === 'statements'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <WalletCards className="w-4 h-4" />
            <span>{t('tuition.tabStatements')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('calendar')}
            className={`whitespace-nowrap shrink-0 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors flex items-center space-x-1.5 ${
              activeSubTab === 'calendar'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{t('tuition.tabCalendar')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('qr_banking')}
            className={`whitespace-nowrap shrink-0 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors flex items-center space-x-1.5 ${
              activeSubTab === 'qr_banking'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>{t('tuition.tabQrBanking')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('settings')}
            className={`whitespace-nowrap shrink-0 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors flex items-center space-x-1.5 ${
              activeSubTab === 'settings'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>{t('tuition.tabPolicies')}</span>
          </button>
        </div>
      )}

      {/* SUBTAB 1: STATEMENTS & BILLING OVERVIEW */}
      {(activeSubTab === 'statements' || !isTeacher) && (
        <div className="space-y-6">
          {/* 4 Supported Billing Models Explanatory Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block">
                {t('tuition.fixedMonthly')}
              </span>
              <p className="text-xs font-bold text-slate-800 mt-1">One amount / month</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{t('tuition.fixedMonthlyDesc')}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">
                {t('tuition.perSession')}
              </span>
              <p className="text-xs font-bold text-slate-800 mt-1">Billable sessions × rate</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{t('tuition.perSessionDesc')}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block">
                {t('tuition.hourly')}
              </span>
              <p className="text-xs font-bold text-slate-800 mt-1">Approved hours × rate</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{t('tuition.hourlyDesc')}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block">
                {t('tuition.coursePackage')}
              </span>
              <p className="text-xs font-bold text-slate-800 mt-1">Package or instalments</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{t('tuition.coursePackageDesc')}</p>
            </div>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {t('tuition.totalBilled')}
              </span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                ${totalRevenue.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400">{t('tuition.acrossStatements')}</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {t('tuition.outstandingBalance')}
              </span>
              <div className="text-2xl font-extrabold text-amber-600 mt-1">
                ${totalOutstanding.toLocaleString()}
              </div>
              <span className="text-[11px] text-amber-600 font-semibold">{t('tuition.uncollected')}</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {t('tuition.collected')}
              </span>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                ${totalCollected.toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold">{t('tuition.settled')}</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {t('tuition.pendingApproval')}
              </span>
              <div className="text-2xl font-extrabold text-blue-600 mt-1">{pendingCount}</div>
              <span className="text-[11px] text-blue-600 font-semibold">{t('tuition.awaitingSignOff')}</span>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={t('tuition.searchPlaceholder')}
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white outline-hidden text-slate-700"
              >
                <option value="all">{t('tuition.allPeriods')}</option>
                <option value="October 2026">October 2026</option>
                <option value="2026">2026 Periods</option>
              </select>
            </div>
          </div>

          {/* Statements Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-3 px-4">{t('tuition.tableStatementNo')}</th>
                  <th className="py-3 px-4">{t('tuition.tableStudent')}</th>
                  <th className="py-3 px-4">{t('tuition.tableCourse')}</th>
                  <th className="py-3 px-4">{t('tuition.tablePeriod')}</th>
                  <th className="py-3 px-4">{t('tuition.tableAmountDue')}</th>
                  <th className="py-3 px-4">{t('tuition.tableStatus')}</th>
                  <th className="py-3 px-4 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStatements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      {isTeacher
                        ? 'No tuition statements generated yet. Click "Calculate Tuition Statement" above.'
                        : 'No tuition statements on file.'}
                    </td>
                  </tr>
                ) : (
                  filteredStatements.map((stmt) => (
                    <tr key={stmt.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{stmt.statementNumber}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{stmt.studentName}</td>
                      <td className="py-3 px-4 text-slate-600">{stmt.courseName}</td>
                      <td className="py-3 px-4 text-slate-600">{stmt.billingPeriod}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {stmt.currency} {stmt.totalAmountDue.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            stmt.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : stmt.status === 'partially_paid'
                              ? 'bg-blue-100 text-blue-800'
                              : stmt.status === 'approved'
                              ? 'bg-indigo-100 text-indigo-800'
                              : stmt.status === 'void'
                              ? 'bg-slate-200 text-slate-600'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {stmt.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setSelectedStatementId(stmt.id)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                          >
                            {t('tuition.viewStatement')} &rarr;
                          </button>
                          {isTeacher && (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmPaidDeleteChecked(false);
                                setStatementToDelete(stmt);
                              }}
                              title={getPdfLabel('Delete statement', 'Xóa phiếu học phí')}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: TEACHING CALENDAR & ATTENDANCE TRACKER */}
      {isTeacher && activeSubTab === 'calendar' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">{t('tuition.calTargetCourse')}</label>
                <select
                  value={calendarCourseId || effectiveCalCourseId}
                  onChange={(e) => setCalendarCourseId(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white outline-hidden"
                >
                  {courses
                    .filter((c) => c.teacherId === currentUser.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.tuitionModel.replace('_', ' ')})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">{t('tuition.calStudentScope')}</label>
                <select
                  value={calendarStudentId}
                  onChange={(e) => setCalendarStudentId(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 bg-white outline-hidden"
                >
                  <option value="">{t('tuition.calAllStudents')}</option>
                  {courseMembers
                    .filter((m) => (!effectiveCalCourseId || m.courseId === effectiveCalCourseId) && m.status === 'enrolled')
                    .map((m) => (
                      <option key={m.studentId} value={m.studentId}>
                        {m.studentName} ({m.studentEmail})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">{t('tuition.calSessionDuration')}</label>
                <div className="flex items-center space-x-1">
                  {[60, 90, 120].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setSessionDuration(dur)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                        sessionDuration === dur
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {dur}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setCalendarMonth(new Date(calYear, calMonthIdx - 1, 1))}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-slate-800 min-w-[140px] text-center">
                {calMonthName}
              </span>
              <button
                type="button"
                onClick={() => setCalendarMonth(new Date(calYear, calMonthIdx + 1, 1))}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Monthly Summary Banner */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="space-y-0.5 text-center sm:text-left">
              <span className="text-xs font-bold text-blue-900">
                {t('tuition.calRecordedSessions')}: <strong className="font-extrabold text-blue-900">{calMonthSessions.length}</strong> · {t('tuition.calTotalHours')}: <strong className="font-extrabold text-blue-900">{calTotalHours} hrs</strong> · Model: <span className="font-bold uppercase text-[10px]">{activeCalCourse?.tuitionModel.replace('_', ' ') || 'Fixed'}</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (effectiveCalCourseId) setCalcCourseId(effectiveCalCourseId);
                if (calendarStudentId) setCalcStudentId(calendarStudentId);
                setCalcPeriod(calMonthName);
                setShowCalcModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 whitespace-nowrap shrink-0"
            >
              <DollarSign className="w-4 h-4" />
              <span>{t('tuition.calGenerateMonth', { month: calMonthName })} &rarr;</span>
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
            {/* Weekday Header */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[11px] font-bold uppercase text-slate-400 tracking-wider">
              <div>{t('tuition.calDaysMon')}</div>
              <div>{t('tuition.calDaysTue')}</div>
              <div>{t('tuition.calDaysWed')}</div>
              <div>{t('tuition.calDaysThu')}</div>
              <div>{t('tuition.calDaysFri')}</div>
              <div>{t('tuition.calDaysSat')}</div>
              <div>{t('tuition.calDaysSun')}</div>
            </div>

            {/* Date Cells */}
            <div className="grid grid-cols-7 gap-2">
              {/* Empty offset days */}
              {Array.from({ length: calStartOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[85px] bg-slate-50/50 rounded-lg border border-transparent"></div>
              ))}

              {/* Days of current month */}
              {Array.from({ length: daysInCalMonth }).map((_, i) => {
                const dayNumber = i + 1;
                const dateStr = `${calYear}-${String(calMonthIdx + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                const session = calSessionMap.get(dateStr);
                const isMarked = !!session;

                return (
                  <div
                    key={`day-${dayNumber}`}
                    onClick={() => handleToggleDay(dayNumber)}
                    className={`min-h-[85px] p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between group ${
                      isMarked
                        ? 'bg-emerald-50/70 border-emerald-300 hover:bg-emerald-100/80 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isMarked ? 'text-emerald-900' : 'text-slate-700'}`}>
                        {dayNumber}
                      </span>
                      {isMarked && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      )}
                    </div>

                    {isMarked ? (
                      <div className="mt-1 flex flex-col items-center text-center">
                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 shadow-2xs">
                          <Check className="w-3 h-3" />
                          <span>{session?.durationMinutes || 60}m</span>
                        </span>
                        <span className="text-[9px] text-emerald-700 font-semibold mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          Click to unmark
                        </span>
                      </div>
                    ) : (
                      <div className="mt-1 text-center text-[10px] text-slate-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        + Mark {sessionDuration}m
                      </div>
                    )}

                    <div className="text-[9px] text-slate-400 text-right">
                      {isMarked ? 'Completed' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: PAYMENT QR & BANKING DETAILS */}
      {isTeacher && activeSubTab === 'qr_banking' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Bank Transfer Details Form */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Building className="w-5 h-5 text-blue-600" />
                <span>{t('tuition.bankDetailsTitle')}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('tuition.bankDetailsDesc')}
              </p>
            </div>

            {bankNotice && (
              <div
                className={`p-3 rounded-lg text-xs font-semibold flex items-center space-x-2 ${
                  bankNotice.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {bankNotice.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                <span>{bankNotice.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveBankInfo} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('settings.bankName')}</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Vietcombank, Techcombank, MB Bank"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('settings.accountHolder')}</label>
                <input
                  type="text"
                  required
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                  placeholder="e.g. NGUYEN VAN A"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden font-bold uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('settings.accountNumber')}</label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 1029384756"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden font-mono font-bold text-sm tracking-wider"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('tuition.branchOptional')}</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="e.g. Ho Chi Minh City Branch"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('tuition.transferDescPrefix')}</label>
                <input
                  type="text"
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                  placeholder="e.g. IELTS {STUDENT_NAME} {STATEMENT_NO}"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingBank}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <Building className="w-4 h-4" />
                  <span>{isSavingBank ? t('common.loading') : t('tuition.saveBankBtn')}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right: Payment QR Code Upload & Preview */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <QrCode className="w-5 h-5 text-blue-600" />
                  <span>{t('tuition.uploadQrTitle')}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('tuition.bankDetailsDesc')}
                </p>
              </div>

              {qrNotice && (
                <div
                  className={`p-3 rounded-lg text-xs font-semibold flex items-center space-x-2 ${
                    qrNotice.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {qrNotice.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                  <span>{qrNotice.text}</span>
                </div>
              )}

              {/* QR Image Preview or Existing */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 flex flex-col items-center justify-center min-h-[220px]">
                {qrPreview || currentUser.paymentQrUrl ? (
                  <div className="flex flex-col items-center space-y-3">
                    <img
                      src={qrPreview || currentUser.paymentQrUrl}
                      alt="Teacher Payment QR Code"
                      className="w-48 h-48 object-contain rounded-lg border border-slate-300 bg-white p-2 shadow-xs"
                    />
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center space-x-1">
                      <Check className="w-3 h-3" />
                      <span>Active Payment QR</span>
                    </span>
                  </div>
                ) : (
                  <div className="text-center space-y-2 text-slate-400 py-6">
                    <QrCode className="w-12 h-12 mx-auto stroke-1 text-slate-300" />
                    <p className="text-xs font-medium">{t('tuition.noCoursesYet') || 'No QR code uploaded yet'}</p>
                    <p className="text-[11px] text-slate-400">
                      {t('tuition.qrNote')}
                    </p>
                  </div>
                )}
              </div>

              {/* Upload controls */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleSelectQrFile}
                className="hidden"
              />

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center space-x-1.5 shadow-2xs whitespace-nowrap"
                >
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>{currentUser.paymentQrUrl ? t('tuition.replaceQrBtn') : t('tuition.selectQrBtn')}</span>
                </button>

                {qrFile && (
                  <button
                    type="button"
                    disabled={isUploadingQr}
                    onClick={handleUploadQr}
                    className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs whitespace-nowrap"
                  >
                    {isUploadingQr ? t('common.loading') : t('tuition.saveQrBtn')}
                  </button>
                )}

                {currentUser.paymentQrUrl && !qrFile && (
                  <button
                    type="button"
                    disabled={isUploadingQr}
                    onClick={handleRemoveQr}
                    className="py-2 px-3 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition-colors flex items-center space-x-1 whitespace-nowrap"
                    title={t('tuition.removeQrBtn')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('tuition.removeQrBtn')}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-600">Note: </span>
              {t('tuition.qrNote')}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: COURSE FEE POLICIES */}
      {isTeacher && activeSubTab === 'settings' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>{t('tuition.policiesTitle')}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('tuition.policiesDesc')}
              </p>
            </div>
            <button
              onClick={() => {
                if (courses.length > 0) setCfgCourseId(courses[0].id);
                setShowConfigModal(true);
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('tuition.configureCourseBtn')}</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {courses.filter((c) => c.teacherId === currentUser.id).length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                {t('tuition.noCoursesYet')}
              </div>
            ) : (
              courses
                .filter((c) => c.teacherId === currentUser.id)
                .map((course) => {
                  const cfg = feeConfigurations.find((f) => f.courseId === course.id) || {
                    id: `cfg_${course.id}`,
                    courseId: course.id,
                    courseName: course.name,
                    teacherId: course.teacherId,
                    model: course.tuitionModel || 'fixed_monthly',
                    currency: course.currency || 'VND',
                    amount: course.tuitionAmount || 0,
                    effectiveDate: new Date().toISOString().split('T')[0],
                    billingDay: 1,
                    dueDays: 15,
                    prorationRule: 'none' as const,
                    earlyPaymentDiscountPercent: 0,
                  };

                  return (
                    <div
                      key={course.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900">{course.name}</span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {cfg.model.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span>
                            {t('tuition.rateLabel')}: <strong className="text-slate-800">{cfg.currency} {cfg.amount.toLocaleString()}</strong>
                            {cfg.model === 'per_session' ? ' / session' : cfg.model === 'hourly' ? ' / hour' : cfg.model === 'fixed_monthly' ? ' / month' : ' (package)'}
                          </span>
                          <span>{t('tuition.dueWindowLabel')}: <strong>{cfg.dueDays || 15} days</strong></span>
                          {cfg.earlyPaymentDiscountPercent ? (
                            <span className="text-emerald-600 font-semibold">
                              {t('tuition.earlyDiscountLabel')}: {cfg.earlyPaymentDiscountPercent}%
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <button
                        onClick={() => openEditCourseFee(cfg as FeeConfiguration)}
                        className="self-start sm:self-center px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center space-x-1.5 whitespace-nowrap shrink-0"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>{t('tuition.editPolicyBtn')}</span>
                      </button>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Modal: Calculate Tuition Statement */}
      {showCalcModal && (
        <Portal>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="relative z-10 bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="text-base font-bold text-slate-900">{t('tuition.calcModalTitle')}</h3>
                <button onClick={() => setShowCalcModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleGenerateStatement} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('resources.selectCourse')}</label>
                  <select
                    required
                    value={calcCourseId}
                    onChange={(e) => setCalcCourseId(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white"
                  >
                    <option value="">{t('resources.chooseCourse')}</option>
                    {courses
                      .filter((c) => c.teacherId === currentUser.id && c.status === 'active')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.tuitionModel.replace('_', ' ')})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('tuition.tableStudent')}</label>
                  <select
                    required
                    value={calcStudentId}
                    onChange={(e) => setCalcStudentId(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white"
                  >
                    <option value="">{t('assessments.chooseStudent')}</option>
                    {courseMembers
                      .filter((m) => (!calcCourseId || m.courseId === calcCourseId) && m.status === 'enrolled')
                      .map((m) => (
                        <option key={m.studentId} value={m.studentId}>
                          {m.studentName} ({m.studentEmail})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('tuition.billingPeriodLabel')}</label>
                    <input
                      type="text"
                      value={calcPeriod}
                      onChange={(e) => setCalcPeriod(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('tuition.dueDateLabel')}</label>
                    <input
                      type="date"
                      value={calcDueDate}
                      onChange={(e) => setCalcDueDate(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('tuition.billableUnitsLabel')} (Auto-derived from attended sessions)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={calcPreview?.billableUnits || calcUnits}
                    onChange={(e) => setCalcUnits(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-hidden font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('tuition.discountAmountLabel')}</label>
                    <input
                      type="number"
                      value={calcCustomDiscount}
                      onChange={(e) => setCalcCustomDiscount(Number(e.target.value))}
                      className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('tuition.discountDescLabel')}</label>
                    <input
                      type="text"
                      value={calcDiscountNote}
                      onChange={(e) => setCalcDiscountNote(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                    />
                  </div>
                </div>

                {/* Live Transparent Calculation Preview */}
                {calcPreview && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-700 font-bold pb-1.5 border-b border-slate-200">
                      <span className="flex items-center space-x-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                        <span>Live Calculation Breakdown ({calcPreview.model.replace('_', ' ')})</span>
                      </span>
                      <span className="text-blue-700 font-mono">
                        {calcPreview.currency} {calcPreview.baseRate.toLocaleString()} / unit
                      </span>
                    </div>

                    {calcPreview.completedTeachingDates.length > 0 ? (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Attended Sessions ({calcPreview.completedTeachingDates.length} sessions, {calcPreview.totalTeachingHours} hrs):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {calcPreview.completedTeachingDates.map((date, idx) => (
                            <span key={idx} className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px] text-slate-700">
                              ✓ {date}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">
                        No teaching sessions marked on calendar for {calcPeriod}.
                      </p>
                    )}

                    <div className="space-y-1 pt-1 text-slate-600">
                      <div className="flex justify-between">
                        <span>Subtotal ({calcPreview.billableUnits} {calcPreview.unitLabel}):</span>
                        <span className="font-semibold text-slate-800 font-mono">
                          {calcPreview.currency} {calcPreview.subtotal.toLocaleString()}
                        </span>
                      </div>
                      {calcPreview.discountAmount > 0 && (
                        <div className="flex justify-between text-emerald-700 font-semibold">
                          <span>Discount:</span>
                          <span className="font-mono">− {calcPreview.currency} {calcPreview.discountAmount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-extrabold text-blue-800 pt-1 border-t border-slate-200">
                        <span>Total Amount Due:</span>
                        <span className="font-mono text-base">
                          {calcPreview.currency} {calcPreview.totalAmountDue.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCalcModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCalc}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs"
                  >
                    {isSubmittingCalc ? t('common.loading') : t('tuition.generateStatementBtn')} &rarr;
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Modal: New Fee Configuration */}
      {showConfigModal && (
        <Portal>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="relative z-10 bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="text-base font-bold text-slate-900">{t('tuition.configModalTitle')}</h3>
                <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateFeeConfig} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('tuition.targetCourse')}</label>
                  <select
                    required
                    value={cfgCourseId}
                    onChange={(e) => setCfgCourseId(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white"
                  >
                    <option value="">{t('resources.chooseCourse')}</option>
                    {courses
                      .filter((c) => c.teacherId === currentUser.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('courses.tuitionModel')}</label>
                    <select
                      value={cfgModel}
                      onChange={(e) => setCfgModel(e.target.value as TuitionModel)}
                      className="w-full p-2 border border-slate-300 rounded-lg outline-hidden bg-white"
                    >
                      <option value="fixed_monthly">{t('tuition.fixedMonthly')}</option>
                      <option value="per_session">{t('tuition.perSession')}</option>
                      <option value="hourly">{t('tuition.hourly')}</option>
                      <option value="course_package">{t('tuition.coursePackage')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                    <select
                      value={cfgCurrency}
                      onChange={(e) => setCfgCurrency(e.target.value as any)}
                      className="w-full p-2 border border-slate-300 rounded-lg outline-hidden bg-white"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="VND">VND (đ)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('tuition.baseRateLabel')}</label>
                  <input
                    type="number"
                    value={cfgAmount}
                    onChange={(e) => setCfgAmount(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('tuition.dueDaysLabel')}</label>
                    <input
                      type="number"
                      value={cfgDueDays}
                      onChange={(e) => setCfgDueDays(Number(e.target.value))}
                      className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('tuition.discountPercentLabel')}</label>
                    <input
                      type="number"
                      value={cfgDiscountPercent}
                      onChange={(e) => setCfgDiscountPercent(Number(e.target.value))}
                      className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingConfig}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs"
                  >
                    {isSubmittingConfig ? t('common.loading') : t('tuition.saveConfigBtn')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Modal: Confirm Delete Statement */}
      {renderDeleteModal()}
    </div>
  );
};
