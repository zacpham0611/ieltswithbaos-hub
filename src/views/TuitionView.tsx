import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import {
  TuitionStatement,
  TuitionModel,
  FeeConfiguration,
  PaymentRecord,
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
} from 'lucide-react';

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
    recordPayment,
    selectedStatementId,
    setSelectedStatementId,
  } = useApp();

  const { t, locale, formatCurrency } = useI18n();

  if (!currentUser) return null;
  const isTeacher = currentUser.role === 'teacher';

  // Filters
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [searchStudent, setSearchStudent] = useState('');

  // Modals
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

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
              className="px-3.5 py-2 bg-slate-800 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>{t('tuition.exportPdfBtn')}</span>
            </button>

            {isTeacher && activeStatement.status === 'pending_approval' && (
              <button
                onClick={() => approveTuitionStatement(activeStatement.id)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{t('tuition.approveBtn')}</span>
              </button>
            )}

            {isTeacher && activeStatement.status === 'approved' && (
              <button
                onClick={() => publishTuitionStatement(activeStatement.id)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
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
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
              >
                <DollarSign className="w-4 h-4" />
                <span>{t('tuition.recordPaymentBtn')}</span>
              </button>
            )}
          </div>
        </div>

        {/* PRINTABLE STATEMENT CONTAINER */}
        <div className="print-page bg-white rounded-xl border border-slate-200 shadow-md p-6 sm:p-10 space-y-8 font-sans">
          {/* Header block with logo and title */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between pb-6 border-b-2 border-slate-800 gap-4">
            <div>
              <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-2xl tracking-tight">
                <span className="w-3.5 h-3.5 bg-blue-700 inline-block"></span>
                <span>IELTS Teaching Hub</span>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-1">
                {getPdfLabel('MONTHLY TUITION STATEMENT • STUDENT COPY', 'PHIẾU BÁO HỌC PHÍ HÀNG THÁNG • BẢN HỌC VIÊN')}
              </p>
            </div>
            <div className="text-right">
              <span className="font-extrabold text-lg text-slate-900 uppercase">
                {activeStatement.billingPeriod}
              </span>
            </div>
          </div>

          {/* Student & Course Meta Info */}
          <div>
            <h3 className="text-xs font-extrabold uppercase text-slate-900 tracking-wider mb-3">
              {getPdfLabel('STUDENT INFORMATION', 'THÔNG TIN HỌC VIÊN')}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-y-3 gap-x-6 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {getPdfLabel('STUDENT', 'HỌC VIÊN')}
                </span>
                <span className="font-bold text-slate-900 text-sm">{activeStatement.studentName}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {getPdfLabel('TEACHER', 'GIÁO VIÊN')}
                </span>
                <span className="font-bold text-slate-900 text-sm">{activeStatement.teacherName}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {getPdfLabel('COURSE', 'KHÓA HỌC')}
                </span>
                <span className="font-bold text-slate-900">{activeStatement.courseName}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {getPdfLabel('BILLING PERIOD', 'KỲ HỌC PHÍ')}
                </span>
                <span className="font-bold text-slate-900">{activeStatement.billingPeriod}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {getPdfLabel('STATEMENT NO.', 'SỐ PHIẾU')}
                </span>
                <span className="font-mono font-bold text-slate-900">{activeStatement.statementNumber}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {getPdfLabel('DUE DATE', 'HẠN THANH TOÁN')}
                </span>
                <span className="font-bold text-slate-900">{activeStatement.dueDate}</span>
              </div>
            </div>
          </div>

          {/* Fee Breakdown Table */}
          <div>
            <h3 className="text-xs font-extrabold uppercase text-slate-900 tracking-wider mb-2">
              {getPdfLabel('FEE BREAKDOWN', 'CHI TIẾT CÁC KHOẢN PHÍ')}
            </h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-4">{getPdfLabel('Description', 'Diễn giải')}</th>
                    <th className="py-2.5 px-4">{getPdfLabel('Quantity', 'Số lượng')}</th>
                    <th className="py-2.5 px-4">{getPdfLabel('Unit price', 'Đơn giá')}</th>
                    <th className="py-2.5 px-4 text-right">{getPdfLabel('Amount', 'Thành tiền')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeStatement.itemizedCharges.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-4 font-medium text-slate-800">{item.description}</td>
                      <td className="py-2.5 px-4 text-slate-600">{item.quantity ?? '—'}</td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {item.unitPrice ? `${activeStatement.currency} ${item.unitPrice.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        {item.amount > 0 ? `${activeStatement.currency} ${item.amount.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}

                  {/* Discount */}
                  {activeStatement.discountAmount > 0 && (
                    <tr className="bg-slate-50/50">
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {activeStatement.discountDescription || getPdfLabel('Discount', 'Chiết khấu / Giảm giá')}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">—</td>
                      <td className="py-2.5 px-4 text-slate-600">—</td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                        − {activeStatement.currency} {activeStatement.discountAmount.toLocaleString()}
                      </td>
                    </tr>
                  )}

                  {/* Previous Balance */}
                  <tr>
                    <td className="py-2 px-4 font-medium text-slate-600">
                      {getPdfLabel('Previous balance', 'Số dư kỳ trước')}
                    </td>
                    <td className="py-2 px-4 text-slate-400">—</td>
                    <td className="py-2 px-4 text-slate-400">—</td>
                    <td className="py-2 px-4 text-right font-medium text-slate-600">
                      {activeStatement.currency} {activeStatement.previousBalance.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Total Due Banner */}
              <div className="bg-blue-50/80 px-4 py-3 flex items-center justify-between border-t border-slate-200">
                <span className="font-extrabold text-sm text-slate-900 uppercase">
                  {getPdfLabel('TOTAL AMOUNT DUE', 'TỔNG TIỀN PHẢI THANH TOÁN')}
                </span>
                <span className="font-extrabold text-xl text-blue-800">
                  {activeStatement.currency} {activeStatement.totalAmountDue.toLocaleString()}
                </span>
              </div>

              {/* Payment Status summary strip */}
              <div className="bg-white px-4 py-2 text-xs flex items-center justify-between border-t border-slate-200 text-slate-600">
                <span>
                  {getPdfLabel('Payment status', 'Trạng thái')}: <strong className="capitalize text-slate-900">{activeStatement.status.replace('_', ' ')}</strong>
                </span>
                <span>
                  {getPdfLabel('Amount paid', 'Đã thanh toán')}: <strong>{activeStatement.currency} {activeStatement.amountPaid.toLocaleString()}</strong> • {getPdfLabel('Remaining', 'Còn lại')}: <strong className="text-red-700">{activeStatement.currency} {activeStatement.remainingBalance.toLocaleString()}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Payment Information & QR code */}
          <div>
            <h3 className="text-xs font-extrabold uppercase text-slate-900 tracking-wider mb-2">
              {getPdfLabel('PAYMENT INFORMATION', 'THÔNG TIN THANH TOÁN')}
            </h3>

            <div className="border border-slate-200 rounded-lg overflow-hidden grid grid-cols-1 md:grid-cols-2">
              {/* Bank Transfer Details */}
              <div className="p-4 space-y-3 border-b md:border-b-0 md:border-r border-slate-200">
                <div className="bg-slate-900 text-white text-[10px] font-bold uppercase px-3 py-1 rounded-sm w-fit">
                  {getPdfLabel('BANK TRANSFER', 'CHUYỂN KHOẢN NGÂN HÀNG')}
                </div>
                <div className="text-xs space-y-1.5">
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
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      {getPdfLabel('Branch', 'Chi nhánh')}
                    </span>
                    <span className="font-semibold text-slate-800">{activeStatement.bankInfo.branch}</span>
                  </div>
                  <div className="pt-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      {getPdfLabel('Transfer description', 'Nội dung chuyển khoản')}
                    </span>
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 block mt-0.5">
                      {activeStatement.bankInfo.transferDescription}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 pt-1">
                  {getPdfLabel(
                    'Please verify the recipient and amount before confirming your transfer.',
                    'Vui lòng kiểm tra kỹ người nhận và số tiền trước khi xác nhận chuyển khoản.'
                  )}
                </p>
              </div>

              {/* Scan to Pay QR Graphic */}
              <div className="p-4 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/50">
                <div className="bg-slate-900 text-white text-[10px] font-bold uppercase px-3 py-1 rounded-sm">
                  {getPdfLabel('SCAN TO PAY', 'QUÉT MÃ ĐỂ THANH TOÁN')}
                </div>

                {/* SVG QR Code Simulation */}
                <div className="w-36 h-36 bg-white p-2 border border-slate-300 rounded shadow-xs flex flex-col items-center justify-center">
                  <div className="grid grid-cols-4 gap-1 w-full h-full p-2 bg-slate-100 rounded">
                    <div className="bg-slate-900 rounded-xs"></div>
                    <div className="bg-slate-900 rounded-xs"></div>
                    <div className="bg-slate-200 rounded-xs"></div>
                    <div className="bg-slate-900 rounded-xs"></div>
                    <div className="bg-slate-900 rounded-xs"></div>
                    <div className="bg-slate-200 rounded-xs"></div>
                    <div className="bg-slate-900 rounded-xs"></div>
                    <div className="bg-slate-200 rounded-xs"></div>
                    <div className="bg-slate-200 rounded-xs"></div>
                    <div className="bg-slate-900 rounded-xs"></div>
                    <div className="bg-slate-900 rounded-xs"></div>
                    <div className="bg-slate-900 rounded-xs"></div>
                    <div className="bg-slate-900 rounded-xs"></div>
                    <div className="bg-slate-200 rounded-xs"></div>
                    <div className="bg-slate-900 rounded-xs"></div>
                    <div className="bg-slate-900 rounded-xs"></div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500">
                  <p>{getPdfLabel('Scan using your banking app.', 'Quét bằng app ngân hàng của bạn.')}</p>
                  <p className="font-mono font-bold text-slate-700 mt-0.5">
                    {getPdfLabel('Reference', 'Mã phiếu')}: {activeStatement.statementNumber}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment History Table if payments exist */}
          {activeStatement.payments.length > 0 && (
            <div className="pt-2">
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
                        <td className="py-2 px-3 text-slate-700">{p.paymentDate}</td>
                        <td className="py-2 px-3 text-slate-700">{p.paymentMethod}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{p.transactionReference}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">
                          {activeStatement.currency} {p.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Audit Trail */}
          <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
            <span className="font-bold text-slate-700 flex items-center space-x-1 mb-1">
              <History className="w-3.5 h-3.5" />
              <span>{getPdfLabel('Traceable Audit History:', 'Lịch sử kiểm tra đối soát:')}</span>
            </span>
            {activeStatement.auditHistory.map((a, i) => (
              <div key={i} className="flex justify-between">
                <span>• {a.action} ({a.user})</span>
                <span>{a.timestamp}</span>
              </div>
            ))}
          </div>

          {/* Legal Disclaimer */}
          <div className="text-[10px] text-slate-400 text-center pt-4 border-t border-slate-100">
            {getPdfLabel(
              'This statement is a tuition payment document generated by IELTS Teaching Hub, not a legally compliant tax invoice.',
              'Phiếu này là chứng từ học phí được tạo từ IELTS Teaching Hub, không phải hóa đơn giá trị gia tăng.'
            )}
          </div>
        </div>

        {/* Modal: Record Payment */}
        {showPayModal && (
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
        )}
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

      {/* Course Tuition Configurations (Teachers) */}
      {isTeacher && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>Course Tuition Policies & Settings</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configured fee schedules, rates, and due policies synchronized across courses
              </p>
            </div>
            <button
              onClick={() => {
                if (courses.length > 0) setCfgCourseId(courses[0].id);
                setShowConfigModal(true);
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Configure Course</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {courses.filter((c) => c.teacherId === currentUser.id).length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No courses created yet. Create a course first to set up tuition policies.
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
                            Rate: <strong className="text-slate-800">{cfg.currency} {cfg.amount.toLocaleString()}</strong>
                            {cfg.model === 'per_session' ? ' / session' : cfg.model === 'hourly' ? ' / hour' : cfg.model === 'fixed_monthly' ? ' / month' : ' (package)'}
                          </span>
                          <span>Due window: <strong>{cfg.dueDays || 15} days</strong></span>
                          {cfg.earlyPaymentDiscountPercent ? (
                            <span className="text-emerald-600 font-semibold">
                              Early discount: {cfg.earlyPaymentDiscountPercent}%
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <button
                        onClick={() => openEditCourseFee(cfg as FeeConfiguration)}
                        className="self-start sm:self-center px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center space-x-1.5"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit Policy</span>
                      </button>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

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
                    <button
                      onClick={() => setSelectedStatementId(stmt.id)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      {t('tuition.viewStatement')} &rarr;
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Calculate Tuition Statement */}
      {showCalcModal && (
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
                  {t('tuition.billableUnitsLabel')}
                </label>
                <input
                  type="number"
                  min="1"
                  value={calcUnits}
                  onChange={(e) => setCalcUnits(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
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
      )}

      {/* Modal: New Fee Configuration */}
      {showConfigModal && (
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
      )}
    </div>
  );
};
