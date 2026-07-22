/**
 * JIIT enrolment numbers are the local part of the college email:
 *   23103188@mail.jiit.ac.in
 *   ^^                        admission year -> 2023
 *
 * Because the year of study follows from the admission year, we never have to
 * ask for it — and a student can't claim to be a fresher when they're in 4th
 * year. The enrolment number itself is treated as private (see below).
 */

const ENROLMENT_RE = /^(\d{2})\d{6}$/; // 8 digits: YY + 6

/** Returns { enrolmentNo, admissionYear } or null if it isn't a student address. */
function parseEnrolmentEmail(email) {
  const [local, domain] = String(email || '').toLowerCase().trim().split('@');
  if (!local || !domain) return null;

  const m = ENROLMENT_RE.exec(local);
  if (!m) return null;

  const admissionYear = 2000 + Number(m[1]);
  const thisYear = new Date().getFullYear();
  // Guards against 99xxxxxx parsing as 2099 and other nonsense.
  if (admissionYear < 2015 || admissionYear > thisYear + 1) return null;

  return { enrolmentNo: local, admissionYear };
}

/**
 * Which year of study someone admitted in `admissionYear` is currently in.
 * The academic session rolls over in August, so anyone admitted in 2023 is
 * still "3rd Year" in July 2026 and becomes "4th Year" that August.
 */
function yearOfStudy(admissionYear, now = new Date()) {
  const SESSION_START_MONTH = 7; // 0-indexed: 7 = August
  const sessionYear = now.getMonth() >= SESSION_START_MONTH
    ? now.getFullYear()
    : now.getFullYear() - 1;

  const n = sessionYear - admissionYear + 1;
  // n === 0 is the incoming batch: admitted for a session that hasn't started
  // yet. Someone joining in July before an August session is a fresher, not
  // an "Other".
  if (n === 0) return '1st Year';
  if (n < 0) return 'Other';
  if (n === 1) return '1st Year';
  if (n === 2) return '2nd Year';
  if (n === 3) return '3rd Year';
  if (n === 4) return '4th Year';
  return 'Graduated';
}

module.exports = { parseEnrolmentEmail, yearOfStudy, ENROLMENT_RE };
