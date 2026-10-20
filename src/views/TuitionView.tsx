import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
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
} from 'lucide-react';

export const TuitionView: React.FC = () => {
  const {
    currentUser,
    courses,
    users,
    feeConfigurations,
    createFeeConfiguration,
    tuitionStatements,
    generateTuitionStatement,
    approveTuitionStatement,
    publishTuitionStatement,
    voidTuitionStatement,
    recordPayment,
    selectedStatementId,
    setSelectedStatementId,
  } = useApp();

  const isTeacher = currentUser.role === 'teacher';

  // Filters
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [searchStudent, setSearchStudent] = useState('');

  // Modals
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  // Fee Config Form
  const [cfgCourseId, setCfgCourseId] = useState('');
  const [cfgModel, setCfgModel] = useState<TuitionModel>('fixed_monthly');
  const [cfgCurrency, setCfgCurrency] = useState<'VND' | 'USD'>('USD');
  const [cfgAmount, setCfgAmount] = useState(60);
  const [cfgDueDays, setCfgDueDays] = useState(15);
  const [cfgDiscountPercent, setCfgDiscountPercent] = useState(5);

  // Statement Generation Form (matching Page 9 & 10)
  const [calcCourseId, setCalcCourseId] = useState('');
  const [calcStudentId, setCalcStudentId] = useState('');
  const [calcPeriod, setCalcPeriod] = useState('Apr 1–30, 2025');
  const [calcDueDate, setCalcDueDate] = useState('2025-04-30');
  const [calcUnits, setCalcUnits] = useState(5); // e.g. 5 sessions
  const [calcCustomDiscount, setCalcCustomDiscount] = useState(15);
  const [calcDiscountNote, setCalcDiscountNote] = useState('Discount (early payment 5%)');

  // Record Payment Form
  const [payAmount, setPayAmount] = useState(285);
  const [payDate, setPayDate] = useState('2025-04-03');
  const [payMethod, setPayMethod] = useState<'Bank Transfer' | 'Cash' | 'Credit Card' | 'Other'>('Bank Transfer');
  const [payRef, setPayRef] = useState('TX-2025-001234');
  const [payNotes, setPayNotes] = useState('Payment via Vietcombank QR transfer');

  const activeStatement = selectedStatementId
    ? tuitionStatements.find((s) => s.id === selectedStatementId)
    : null;

  // Scoped statements:
  // Teacher sees their own courses' statements
  // Student sees ONLY statements where studentId === currentUser.id
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

  const handleCreateFeeConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfgCourseId) return;

    const course = courses.find((c) => c.id === cfgCourseId);
    createFeeConfiguration({
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
  };

  const handleGenerateStatement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!calcCourseId || !calcStudentId) return;

    const created = generateTuitionStatement({
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
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStatement) return;

    recordPayment(activeStatement.id, {
      amount: Number(payAmount),
      paymentDate: payDate,
      paymentMethod: payMethod,
      transactionReference: payRef,
      notes: payNotes,
    });

    setShowPayModal(false);
  };

  // If a statement is selected, show Statement Detail / Printable View (Page 10 replica)
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
              &larr; Back to all tuition statements
            </button>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-slate-900">
                Tuition Statement: {activeStatement.statementNumber}
              </h1>
              <span
                className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                  activeStatement.status === 'paid'
                    ? 'bg-emerald-100 text-emerald-800'
                    : activeStatement.status === 'partially_paid'
                    ? 'bg-blue-100 text-blue-800'
                    : activeStatement.status === 'approved'
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {activeStatement.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Course: <span className="font-semibold text-slate-700">{activeStatement.courseName}</span> · Student: {activeStatement.studentName}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-slate-800 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Export Individual PDF</span>
            </button>

            {isTeacher && activeStatement.status === 'pending_approval' && (
              <button
                onClick={() => approveTuitionStatement(activeStatement.id)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Approve Statement</span>
              </button>
            )}

            {isTeacher && activeStatement.status === 'approved' && (
              <button
                onClick={() => publishTuitionStatement(activeStatement.id)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Publish to Student</span>
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
                <span>Record Payment</span>
              </button>
            )}
          </div>
        </div>

        {/* PRINTABLE STATEMENT CONTAINER (Page 10 Mockup Replica) */}
        <div className="print-page bg-white rounded-xl border border-slate-200 shadow-md p-6 sm:p-10 space-y-8 font-sans">
          {/* Header block with logo and title */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between pb-6 border-b-2 border-slate-800 gap-4">
            <div>
              <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-2xl tracking-tight">
                <span className="w-3.5 h-3.5 bg-blue-700 inline-block"></span>
                <span>IELTS Teaching Hub</span>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-1">
                MONTHLY TUITION STATEMENT • STUDENT COPY
              </p>
            </div>
            <div className="text-right">
              <span className="font-extrabold text-lg text-slate-900 uppercase">
                {activeStatement.billingPeriod.includes('2025') ? 'APR 2025' : 'OCT 2026'}
              </span>
            </div>
          </div>

          {/* Student & Course Meta Info */}
          <div>
            <h3 className="text-xs font-extrabold uppercase text-slate-900 tracking-wider mb-3">
              STUDENT INFORMATION
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-y-3 gap-x-6 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">STUDENT</span>
                <span className="font-bold text-slate-900 text-sm">{activeStatement.studentName}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">TEACHER</span>
                <span className="font-bold text-slate-900 text-sm">{activeStatement.teacherName}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">COURSE</span>
                <span className="font-bold text-slate-900">{activeStatement.courseName}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">BILLING PERIOD</span>
                <span className="font-bold text-slate-900">{activeStatement.billingPeriod}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">STATEMENT NO.</span>
                <span className="font-mono font-bold text-slate-900">{activeStatement.statementNumber}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">DUE DATE</span>
                <span className="font-bold text-slate-900">{activeStatement.dueDate}</span>
              </div>
            </div>
          </div>

          {/* Fee Breakdown Table (Exact replica of Page 10) */}
          <div>
            <h3 className="text-xs font-extrabold uppercase text-slate-900 tracking-wider mb-2">
              FEE BREAKDOWN
            </h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4">Quantity</th>
                    <th className="py-2.5 px-4">Unit price</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeStatement.itemizedCharges.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-4 font-medium text-slate-800">{item.description}</td>
                      <td className="py-2.5 px-4 text-slate-600">{item.quantity ?? '—'}</td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {item.unitPrice ? `${activeStatement.currency} ${item.unitPrice.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        {item.amount > 0 ? `${activeStatement.currency} ${item.amount.toFixed(2)}` : 'Shown separately'}
                      </td>
                    </tr>
                  ))}

                  {/* Discount */}
                  {activeStatement.discountAmount > 0 && (
                    <tr className="bg-slate-50/50">
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {activeStatement.discountDescription || 'Discount'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">—</td>
                      <td className="py-2.5 px-4 text-slate-600">5%</td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                        − {activeStatement.currency} {activeStatement.discountAmount.toFixed(2)}
                      </td>
                    </tr>
                  )}

                  {/* Previous Balance */}
                  <tr>
                    <td className="py-2 px-4 font-medium text-slate-600">Previous balance</td>
                    <td className="py-2 px-4 text-slate-400">—</td>
                    <td className="py-2 px-4 text-slate-400">—</td>
                    <td className="py-2 px-4 text-right font-medium text-slate-600">
                      {activeStatement.currency} {activeStatement.previousBalance.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Total Due Banner */}
              <div className="bg-blue-50/80 px-4 py-3 flex items-center justify-between border-t border-slate-200">
                <span className="font-extrabold text-sm text-slate-900 uppercase">
                  TOTAL AMOUNT DUE
                </span>
                <span className="font-extrabold text-xl text-blue-800">
                  {activeStatement.currency} {activeStatement.totalAmountDue.toFixed(2)}
                </span>
              </div>

              {/* Payment Status summary strip */}
              <div className="bg-white px-4 py-2 text-xs flex items-center justify-between border-t border-slate-200 text-slate-600">
                <span>
                  Payment status: <strong className="capitalize text-slate-900">{activeStatement.status.replace('_', ' ')}</strong>
                </span>
                <span>
                  Amount paid: <strong>{activeStatement.currency} {activeStatement.amountPaid.toFixed(2)}</strong> • Remaining: <strong className="text-red-700">{activeStatement.currency} {activeStatement.remainingBalance.toFixed(2)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Payment Information & QR code (Page 10 exact match) */}
          <div>
            <h3 className="text-xs font-extrabold uppercase text-slate-900 tracking-wider mb-2">
              PAYMENT INFORMATION
            </h3>

            <div className="border border-slate-200 rounded-lg overflow-hidden grid grid-cols-1 md:grid-cols-2">
              {/* Bank Transfer Details */}
              <div className="p-4 space-y-3 border-b md:border-b-0 md:border-r border-slate-200">
                <div className="bg-slate-900 text-white text-[10px] font-bold uppercase px-3 py-1 rounded-sm w-fit">
                  BANK TRANSFER
                </div>
                <div className="text-xs space-y-1.5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Bank name</span>
                    <span className="font-bold text-slate-800">{activeStatement.bankInfo.bankName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Account holder</span>
                    <span className="font-bold text-slate-800">{activeStatement.bankInfo.accountHolder}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Account number</span>
                    <span className="font-mono font-bold text-slate-900 text-sm tracking-wider">
                      {activeStatement.bankInfo.accountNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Branch</span>
                    <span className="font-semibold text-slate-800">{activeStatement.bankInfo.branch}</span>
                  </div>
                  <div className="pt-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Transfer description</span>
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 block mt-0.5">
                      {activeStatement.bankInfo.transferDescription}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 pt-1">
                  Please verify the recipient and amount before confirming your transfer.
                </p>
              </div>

              {/* Scan to Pay QR Graphic */}
              <div className="p-4 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/50">
                <div className="bg-slate-900 text-white text-[10px] font-bold uppercase px-3 py-1 rounded-sm">
                  SCAN TO PAY
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
                  <p>Scan using your banking app.</p>
                  <p className="font-mono font-bold text-slate-700 mt-0.5">
                    Reference: {activeStatement.statementNumber}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment History Table if payments exist */}
          {activeStatement.payments.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider mb-2">
                PAYMENT HISTORY & SETTLEMENTS
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Method</th>
                      <th className="py-2 px-3">Transaction Ref</th>
                      <th className="py-2 px-3 text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeStatement.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 px-3 text-slate-700">{p.paymentDate}</td>
                        <td className="py-2 px-3 text-slate-700">{p.paymentMethod}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{p.transactionReference}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">
                          {activeStatement.currency} {p.amount.toFixed(2)}
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
              <span>Traceable Audit History:</span>
            </span>
            {activeStatement.auditHistory.map((a, i) => (
              <div key={i} className="flex justify-between">
                <span>• {a.action} ({a.user})</span>
                <span>{a.timestamp}</span>
              </div>
            ))}
          </div>

          {/* Legal Disclaimer matching Page 10 */}
          <div className="text-[10px] text-slate-400 text-center pt-4 border-t border-slate-100">
            This statement is a tuition payment document generated by IELTS Teaching Hub, not a legally compliant tax invoice.
          </div>
        </div>

        {/* Modal: Record Payment */}
        {showPayModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="text-base font-bold text-slate-900">Record Payment</h3>
                <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs mb-4">
                <span className="text-slate-500">Student: </span>
                <strong className="text-slate-800">{activeStatement.studentName}</strong>
                <span className="block text-slate-500 mt-1">
                  Remaining Due: <strong>{activeStatement.remainingBalance} {activeStatement.currency}</strong>
                </span>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Amount</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden font-bold text-sm"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Supports partial payment. Remaining balance will update automatically.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Payment Date</label>
                    <input
                      type="date"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
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
                  <label className="block font-semibold text-slate-700 mb-1">Transaction Reference</label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="e.g. TX-2025-001234 or bank trace ID"
                    className="w-full p-2 border border-slate-300 rounded-lg outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Notes / Receipt remark</label>
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
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs"
                  >
                    Confirm & Record Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Tuition Management Overview (Page 9 Replica)
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tuition Management</h1>
          <p className="text-sm text-slate-500">
            {isTeacher
              ? 'Track, calculate, and manage tuition for your courses across 4 supported billing models.'
              : 'View your course statements, payment balances, and bank transfer QR codes.'}
          </p>
        </div>

        {isTeacher && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3.5 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>New Fee Configuration</span>
            </button>
            <button
              onClick={() => setShowCalcModal(true)}
              className="px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <DollarSign className="w-4 h-4" />
              <span>Calculate Tuition Statement</span>
            </button>
          </div>
        )}
      </div>

      {/* 4 Supported Billing Models Explanatory Strip (Page 6 Mockup) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block">
            FIXED MONTHLY
          </span>
          <p className="text-xs font-bold text-slate-800 mt-1">One amount / month</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Explicit proration for mid-month joins.</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">
            PER SESSION
          </span>
          <p className="text-xs font-bold text-slate-800 mt-1">Billable sessions × rate</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Attendance and excused absence rules.</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block">
            HOURLY
          </span>
          <p className="text-xs font-bold text-slate-800 mt-1">Approved hours × rate</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Transparent hour tracking breakdown.</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block">
            COURSE PACKAGE
          </span>
          <p className="text-xs font-bold text-slate-800 mt-1">Package or instalments</p>
          <p className="text-[11px] text-slate-500 mt-0.5">One defined bundle or staged payments.</p>
        </div>
      </div>

      {/* 4 Summary Cards (Total Revenue, Outstanding Balance, Paid, Pending Review) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Billed
          </span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            ${totalRevenue.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400">Across all statements</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Outstanding Balance
          </span>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">
            ${totalOutstanding.toLocaleString()}
          </div>
          <span className="text-[11px] text-amber-600 font-semibold">Uncollected tuition</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Collected
          </span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">
            ${totalCollected.toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold">Settled payments</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Pending Approval
          </span>
          <div className="text-2xl font-extrabold text-blue-600 mt-1">{pendingCount}</div>
          <span className="text-[11px] text-blue-600 font-semibold">Statements awaiting sign-off</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search student name..."
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
            <option value="all">All Billing Periods</option>
            <option value="Apr 2025">Apr 2025</option>
            <option value="2026">2026 Periods</option>
          </select>
        </div>
      </div>

      {/* Statements Table (Page 9 Replica) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
            <tr>
              <th className="py-3 px-4">Statement #</th>
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-4">Course</th>
              <th className="py-3 px-4">Period</th>
              <th className="py-3 px-4">Amount Due</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStatements.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-400">
                  No tuition statements found. Click "Calculate Tuition Statement" to generate one.
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
                    {stmt.totalAmountDue.toLocaleString()} {stmt.currency}
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
                      View Statement &rarr;
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Calculate Tuition Statement (Page 9 Replica) */}
      {showCalcModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Calculate Tuition Statement</h3>
              <button onClick={() => setShowCalcModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateStatement} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Course</label>
                <select
                  required
                  value={calcCourseId}
                  onChange={(e) => setCalcCourseId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white"
                >
                  <option value="">-- Choose Course --</option>
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
                <label className="block font-semibold text-slate-700 mb-1">Select Student</label>
                <select
                  required
                  value={calcStudentId}
                  onChange={(e) => setCalcStudentId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white"
                >
                  <option value="">-- Choose Student --</option>
                  {users
                    .filter((u) => u.role === 'student')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.email})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Billing Period</label>
                  <input
                    type="text"
                    value={calcPeriod}
                    onChange={(e) => setCalcPeriod(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
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
                  Billable Units (Sessions or Hours attended)
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
                  <label className="block font-semibold text-slate-700 mb-1">Discount Amount</label>
                  <input
                    type="number"
                    value={calcCustomDiscount}
                    onChange={(e) => setCalcCustomDiscount(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Discount Description</label>
                  <input
                    type="text"
                    value={calcDiscountNote}
                    onChange={(e) => setCalcDiscountNote(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                  />
                </div>
              </div>

              {/* Statement Preview */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-2 space-y-1 text-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Transparent Calculation Preview:
                </span>
                <div className="flex justify-between">
                  <span>Gross Tuition Charge:</span>
                  <span className="font-bold">
                    {(calcUnits * 60).toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Early Payment Discount:</span>
                  <span>- {calcCustomDiscount.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Estimated Total Due:</span>
                  <span>{(calcUnits * 60 - calcCustomDiscount).toFixed(2)} USD</span>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCalcModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs"
                >
                  Generate Statement &rarr;
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Fee Configuration */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Create Fee Configuration</h3>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFeeConfig} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Course</label>
                <select
                  required
                  value={cfgCourseId}
                  onChange={(e) => setCfgCourseId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white"
                >
                  <option value="">-- Choose Course --</option>
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
                  <label className="block font-semibold text-slate-700 mb-1">Billing Model</label>
                  <select
                    value={cfgModel}
                    onChange={(e) => setCfgModel(e.target.value as TuitionModel)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-hidden bg-white"
                  >
                    <option value="fixed_monthly">Fixed Monthly</option>
                    <option value="per_session">Per Session</option>
                    <option value="hourly">Hourly</option>
                    <option value="course_package">Course Package</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                  <select
                    value={cfgCurrency}
                    onChange={(e) => setCfgCurrency(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-hidden bg-white"
                  >
                    <option value="USD">USD</option>
                    <option value="VND">VND</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Base Rate / Fee Amount</label>
                <input
                  type="number"
                  value={cfgAmount}
                  onChange={(e) => setCfgAmount(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due Days After Issue</label>
                  <input
                    type="number"
                    value={cfgDueDays}
                    onChange={(e) => setCfgDueDays(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Early Payment Discount %</label>
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs"
                >
                  Save Fee Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
