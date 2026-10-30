import type {
  FeeConfiguration,
  Lesson,
  StatementChargeItem,
  TuitionModel,
  StatementStatus,
  Course,
} from '../types/index.ts';

export interface TuitionCalculationInput {
  courseId: string;
  courseName: string;
  studentId: string;
  studentName: string;
  billingMonth: string; // e.g. "2026-10" or "October 2026"
  feeConfig?: FeeConfiguration;
  course?: Course;
  sessions: Lesson[];
  manualDiscount?: number;
  discountDescription?: string;
  customSurcharge?: number;
  previousBalance?: number;
  amountPaid?: number;
}

export interface TuitionCalculationResult {
  model: TuitionModel;
  currency: 'VND' | 'USD';
  baseRate: number;
  billableUnits: number;
  unitLabel: string;
  subtotal: number;
  completedTeachingDates: string[];
  totalTeachingMinutes: number;
  totalTeachingHours: number;
  itemizedCharges: StatementChargeItem[];
  discountAmount: number;
  discountDescription: string;
  customSurcharge: number;
  previousBalance: number;
  totalAmountDue: number;
  amountPaid: number;
  remainingBalance: number;
  status: StatementStatus;
  warnings: string[];
  isValid: boolean;
}

/**
 * Normalizes billing period string into year and month (0-indexed).
 * Supports formats like "2026-10", "10/2026", "October 2026", "2026-10-01"
 */
export function parseBillingMonth(periodStr: string): { year: number; month: number } {
  const trimmed = (periodStr || '').trim();

  // "2026-10"
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10) - 1,
    };
  }

  // "10/2026"
  const slashMatch = trimmed.match(/^(\d{1,2})[-/](\d{4})/);
  if (slashMatch) {
    return {
      year: parseInt(slashMatch[2], 10),
      month: parseInt(slashMatch[1], 10) - 1,
    };
  }

  // Month names like "October 2026"
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  const lower = trimmed.toLowerCase();
  for (let i = 0; i < monthNames.length; i++) {
    if (lower.includes(monthNames[i])) {
      const yearMatch = lower.match(/\b(20\d{2})\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
      return { year, month: i };
    }
  }

  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

/**
 * Filter sessions that took place within the target billing month for the given student and course.
 */
export function getEligibleSessionsForMonth(
  sessions: Lesson[],
  courseId: string,
  studentId: string,
  billingMonth: string
): Lesson[] {
  const { year, month } = parseBillingMonth(billingMonth);

  return sessions.filter((s) => {
    // 1. Must belong to the course
    if (s.courseId !== courseId) return false;

    // 2. If session is assigned to a specific student (1-on-1), must match
    if (s.studentId && s.studentId !== studentId) return false;

    // 3. Must not be cancelled
    if (s.status === 'cancelled') return false;

    // 4. Must fall within the target billing month
    if (!s.date) return false;
    const sessionDate = new Date(s.date);
    if (isNaN(sessionDate.getTime())) return false;

    return (
      sessionDate.getFullYear() === year &&
      sessionDate.getMonth() === month
    );
  });
}

/**
 * Format currency consistently for Vietnamese Dong (VND) and US Dollar (USD)
 */
export function formatCurrency(amount: number, currency: 'VND' | 'USD' = 'VND'): string {
  const num = Math.max(0, Number(amount) || 0);
  if (currency === 'USD') {
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${Math.round(num).toLocaleString('vi-VN')} ₫`;
}

/**
 * Authoritative, single-source-of-truth tuition calculator.
 * Used identically across Tuition UI preview, statement generation, and PDF export.
 */
export function calculateMonthlyTuition(input: TuitionCalculationInput): TuitionCalculationResult {
  const warnings: string[] = [];
  const model: TuitionModel = input.feeConfig?.model || input.course?.tuitionModel || 'fixed_monthly';
  const currency: 'VND' | 'USD' = input.feeConfig?.currency || input.course?.currency || 'VND';

  const baseConfigRate = Number(input.feeConfig?.amount || input.course?.tuitionAmount || 0);
  if (baseConfigRate <= 0) {
    warnings.push('Pricing rate is not configured (amount is 0 or missing). Please set fee configuration.');
  }

  // 1. Retrieve eligible teaching sessions
  const eligibleSessions = getEligibleSessionsForMonth(
    input.sessions,
    input.courseId,
    input.studentId,
    input.billingMonth
  );

  // Filter completed and billable sessions
  const completedSessions = eligibleSessions.filter((s) => {
    // Treat status === 'completed' or undefined as completed if date is in the past
    const isCompleted = s.status === 'completed' || (!s.status && new Date(s.date) <= new Date());
    const isBillable = s.isBillable !== false;
    return isCompleted && isBillable;
  });

  // Extract unique sorted teaching dates
  const completedTeachingDates = Array.from(
    new Set(completedSessions.map((s) => s.date))
  ).sort();

  // Calculate durations
  let totalTeachingMinutes = 0;
  completedSessions.forEach((s) => {
    if (typeof s.durationMinutes === 'number' && s.durationMinutes > 0) {
      totalTeachingMinutes += s.durationMinutes;
    } else {
      totalTeachingMinutes += 60; // Standard 60 minute lesson fallback
      if (model === 'hourly' && s.durationMinutes === undefined) {
        warnings.push(`Session on ${s.date} has no recorded duration; defaulted to 60 minutes.`);
      }
    }
  });

  const totalTeachingHours = Math.round((totalTeachingMinutes / 60) * 10) / 10;

  let billableUnits = 0;
  let unitLabel = '';
  let subtotal = 0;
  let baseRate = baseConfigRate;
  const itemizedCharges: StatementChargeItem[] = [];

  // 2. Apply Pricing Model
  switch (model) {
    case 'fixed_monthly': {
      billableUnits = 1;
      unitLabel = 'Month';
      subtotal = baseConfigRate;
      baseRate = baseConfigRate;

      itemizedCharges.push({
        id: `charge_month_${Date.now()}`,
        description: `Fixed Monthly Tuition (${input.billingMonth}) — ${completedTeachingDates.length} teaching sessions completed`,
        quantity: 1,
        unitPrice: baseConfigRate,
        amount: baseConfigRate,
      });
      break;
    }

    case 'per_session': {
      const sessionRate = Number(input.feeConfig?.sessionRate || baseConfigRate);
      baseRate = sessionRate;
      billableUnits = completedTeachingDates.length;
      unitLabel = 'Sessions';
      subtotal = billableUnits * sessionRate;

      if (billableUnits === 0) {
        warnings.push('No completed teaching sessions recorded for this student in the billing month.');
      }

      // Add itemized charge per completed session date
      completedSessions.forEach((s, idx) => {
        itemizedCharges.push({
          id: `charge_session_${s.id || idx}`,
          description: `Lesson Session on ${s.date}${s.title ? `: ${s.title}` : ''}`,
          quantity: 1,
          unitPrice: sessionRate,
          amount: sessionRate,
          date: s.date,
        });
      });

      if (itemizedCharges.length === 0) {
        itemizedCharges.push({
          id: `charge_session_empty`,
          description: `Per-session tuition for ${input.billingMonth} (0 sessions marked)`,
          quantity: 0,
          unitPrice: sessionRate,
          amount: 0,
        });
      }
      break;
    }

    case 'hourly': {
      const hourlyRate = Number(input.feeConfig?.hourlyRate || baseConfigRate);
      baseRate = hourlyRate;
      billableUnits = totalTeachingHours;
      unitLabel = 'Hours';
      subtotal = Math.round(billableUnits * hourlyRate);

      if (billableUnits === 0) {
        warnings.push('0 teaching hours recorded for this student in the billing month.');
      }

      completedSessions.forEach((s, idx) => {
        const hours = (s.durationMinutes || 60) / 60;
        const amount = Math.round(hours * hourlyRate);
        itemizedCharges.push({
          id: `charge_hour_${s.id || idx}`,
          description: `Teaching Session on ${s.date} (${s.durationMinutes || 60} mins)`,
          quantity: `${hours} hr`,
          unitPrice: hourlyRate,
          amount,
          date: s.date,
        });
      });

      if (itemizedCharges.length === 0) {
        itemizedCharges.push({
          id: `charge_hour_empty`,
          description: `Hourly tuition for ${input.billingMonth} (0 hours marked)`,
          quantity: 0,
          unitPrice: hourlyRate,
          amount: 0,
        });
      }
      break;
    }

    case 'course_package': {
      const installments = Math.max(1, input.feeConfig?.packageInstallments || 1);
      const installmentRate = Math.round(baseConfigRate / installments);
      baseRate = installmentRate;
      billableUnits = 1;
      unitLabel = `Installment (1/${installments})`;
      subtotal = installmentRate;

      itemizedCharges.push({
        id: `charge_pkg_${Date.now()}`,
        description: `Course Package Tuition (${input.courseName || 'Course'}) — Installment 1 of ${installments}`,
        quantity: 1,
        unitPrice: installmentRate,
        amount: installmentRate,
      });
      break;
    }
  }

  // 3. Deductions & Adjustments
  let discountAmount = 0;
  let discountDescription = input.discountDescription || '';

  // Configured early payment discount
  if (input.feeConfig?.earlyPaymentDiscountPercent && input.feeConfig.earlyPaymentDiscountPercent > 0) {
    const earlyPct = input.feeConfig.earlyPaymentDiscountPercent;
    discountAmount += Math.round((subtotal * earlyPct) / 100);
    discountDescription = discountDescription
      ? `${discountDescription}; Early payment discount (${earlyPct}%)`
      : `Early payment discount (${earlyPct}%)`;
  }

  // Custom manual discount
  if (input.manualDiscount && input.manualDiscount > 0) {
    discountAmount += input.manualDiscount;
    if (!discountDescription) {
      discountDescription = `Manual fee adjustment`;
    }
  }

  const customSurcharge = Math.max(0, Number(input.customSurcharge) || 0);
  const previousBalance = Math.max(0, Number(input.previousBalance) || 0);

  const totalAmountDue = Math.max(0, subtotal - discountAmount + customSurcharge + previousBalance);
  const amountPaid = Math.max(0, Number(input.amountPaid) || 0);
  const remainingBalance = Math.max(0, totalAmountDue - amountPaid);

  // 4. Status
  let status: StatementStatus = 'draft';
  if (remainingBalance === 0 && amountPaid > 0) {
    status = 'paid';
  } else if (amountPaid > 0 && remainingBalance > 0) {
    status = 'partially_paid';
  }

  return {
    model,
    currency,
    baseRate,
    billableUnits,
    unitLabel,
    subtotal,
    completedTeachingDates,
    totalTeachingMinutes,
    totalTeachingHours,
    itemizedCharges,
    discountAmount,
    discountDescription,
    customSurcharge,
    previousBalance,
    totalAmountDue,
    amountPaid,
    remainingBalance,
    status,
    warnings,
    isValid: baseConfigRate > 0 && (model === 'fixed_monthly' || model === 'course_package' || billableUnits > 0),
  };
}
