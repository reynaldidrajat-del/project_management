import { differenceInCalendarDays } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';

import { formatDate, parseDateSafe } from '../../logic/helpers/dateHelper';
import { getStatusBadgeClass } from '../../logic/helpers/statusHelper';
import { getTaskAssigneeNames, getTaskLeadName } from '../../logic/helpers/taskPeopleHelper';
import Modal from '../shared/Modal';

const MIN_REASON_LENGTH = 10;

const getTodayDateKey = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getInclusiveDurationDays = (startDate, endDate) => {
  const parsedStart = parseDateSafe(startDate);
  const parsedEnd = parseDateSafe(endDate);

  if (!parsedStart || !parsedEnd || parsedEnd < parsedStart) {
    return 0;
  }

  return differenceInCalendarDays(parsedEnd, parsedStart) + 1;
};

const getVarianceLabel = (actualDate, planDate) => {
  const parsedActual = parseDateSafe(actualDate);
  const parsedPlan = parseDateSafe(planDate);

  if (!parsedActual || !parsedPlan) {
    return '-';
  }

  const difference = differenceInCalendarDays(parsedActual, parsedPlan);

  if (difference === 0) {
    return 'Sesuai plan';
  }

  const dayLabel = `${Math.abs(difference)} hari`;
  return difference > 0 ? `Terlambat ${dayLabel}` : `Lebih awal ${dayLabel}`;
};

const getManualRealizationBlockReason = (task) => {
  if (!task) {
    return '';
  }

  if (task.children?.length) {
    return 'Parent task memakai rollup dari subtask. Isi realisasi manual pada task paling bawah.';
  }

  const rawStatus = task.raw_status || task.status;

  if (rawStatus === 'Done' && Number(task.progress || 0) >= 100) {
    return 'Task yang sudah Done dan approved tidak dapat diubah lewat realisasi manual.';
  }

  return '';
};

// Modal untuk mengisi tanggal realisasi task secara manual.
function TaskRealizationManualModal({ open, task, onClose, onSubmit }) {
  const [form, setForm] = useState({
    actual_start_date: '',
    actual_end_date: '',
    reason: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !task) {
      return;
    }

    setForm({
      actual_start_date: task.actual_start_date || '',
      actual_end_date: task.actual_end_date || '',
      reason: '',
    });
    setErrors({});
    setSubmitting(false);
  }, [open, task]);

  const summary = useMemo(() => {
    if (!task) {
      return {
        actualDurationDays: 0,
        finishVariance: '-',
        startVariance: '-',
      };
    }

    return {
      actualDurationDays: getInclusiveDurationDays(form.actual_start_date, form.actual_end_date),
      finishVariance: getVarianceLabel(form.actual_end_date, task.end_date),
      startVariance: getVarianceLabel(form.actual_start_date, task.start_date),
    };
  }, [form.actual_end_date, form.actual_start_date, task]);

  if (!task) {
    return null;
  }

  const blockReason = getManualRealizationBlockReason(task);
  const isBlocked = Boolean(blockReason);

  // Mengubah field tanggal/catatan realisasi manual.
  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[field];
      delete nextErrors.general;
      return nextErrors;
    });
  };

  const validateForm = () => {
    const nextErrors = {};
    const todayDate = getTodayDateKey();
    const actualStartDate = form.actual_start_date;
    const actualEndDate = form.actual_end_date;

    if (isBlocked) {
      nextErrors.general = blockReason;
    }

    if (!actualStartDate) {
      nextErrors.actual_start_date = 'Actual start wajib diisi.';
    }

    if (!actualEndDate) {
      nextErrors.actual_end_date = 'Actual finish wajib diisi.';
    }

    if (actualStartDate && !parseDateSafe(actualStartDate)) {
      nextErrors.actual_start_date = 'Tanggal actual start tidak valid.';
    }

    if (actualEndDate && !parseDateSafe(actualEndDate)) {
      nextErrors.actual_end_date = 'Tanggal actual finish tidak valid.';
    }

    if (actualStartDate && actualEndDate && actualEndDate < actualStartDate) {
      nextErrors.actual_end_date = 'Actual finish tidak boleh lebih awal dari actual start.';
    }

    if (actualStartDate && actualStartDate > todayDate) {
      nextErrors.actual_start_date = 'Actual start tidak boleh di masa depan.';
    }

    if (actualEndDate && actualEndDate > todayDate) {
      nextErrors.actual_end_date = 'Actual finish tidak boleh di masa depan.';
    }

    if (form.reason.trim().length < MIN_REASON_LENGTH) {
      nextErrors.reason = `Catatan wajib diisi minimal ${MIN_REASON_LENGTH} karakter.`;
    }

    return nextErrors;
  };

  // Mengirim tanggal realisasi manual ke parent.
  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = validateForm();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit?.({
        actual_start_date: form.actual_start_date,
        actual_end_date: form.actual_end_date,
        reason: form.reason.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      description={`Input aktual untuk "${task.title}" saat pekerjaan sudah terjadi tetapi belum tercatat real-time.`}
      footer={
        <>
          <button className="btn-secondary" disabled={submitting} type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={isBlocked || submitting} form="manual-realization-form" type="submit">
            {submitting ? 'Menyimpan...' : 'Simpan Realisasi Manual'}
          </button>
        </>
      }
      open={open}
      title="Realisasi Manual"
      onClose={onClose}
    >
      <form className="space-y-4" id="manual-realization-form" onSubmit={handleSubmit}>
        {errors.general || blockReason ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            {errors.general || blockReason}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-slate-50 p-3">
            <p className="label">Status</p>
            <span className={`badge mt-2 ${getStatusBadgeClass(task.status)}`}>{task.status}</span>
          </div>
          <div className="rounded-lg border border-border bg-slate-50 p-3">
            <p className="label">PIC</p>
            <p className="mt-2 truncate text-sm font-semibold text-text-dark">{getTaskAssigneeNames(task)}</p>
          </div>
          <div className="rounded-lg border border-border bg-slate-50 p-3">
            <p className="label">Lead</p>
            <p className="mt-2 truncate text-sm font-semibold text-text-dark">{getTaskLeadName(task)}</p>
          </div>
          <div className="rounded-lg border border-border bg-slate-50 p-3">
            <p className="label">Progress</p>
            <p className="mt-2 text-sm font-bold text-text-dark">{task.progress || 0}%</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <p className="label">Plan</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-text-muted">Start</p>
                <p className="font-semibold text-text-dark">{formatDate(task.start_date)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-text-muted">Finish</p>
                <p className="font-semibold text-text-dark">{formatDate(task.end_date)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="label">Preview</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold text-text-muted">Actual Duration</p>
                <p className="font-semibold text-text-dark">{summary.actualDurationDays} hari</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-text-muted">Start Variance</p>
                <p className="font-semibold text-text-dark">{summary.startVariance}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-text-muted">Finish Variance</p>
                <p className="font-semibold text-text-dark">{summary.finishVariance}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="manual-actual-start">
              Actual Start <span className="text-danger">*</span>
            </label>
            <input
              className={['field mt-1', errors.actual_start_date ? 'field-error' : ''].join(' ')}
              disabled={isBlocked || submitting}
              id="manual-actual-start"
              max={getTodayDateKey()}
              required
              type="date"
              value={form.actual_start_date}
              onChange={(event) => updateField('actual_start_date', event.target.value)}
            />
            {errors.actual_start_date ? <p className="form-error">{errors.actual_start_date}</p> : null}
          </div>
          <div>
            <label className="label" htmlFor="manual-actual-end">
              Actual Finish <span className="text-danger">*</span>
            </label>
            <input
              className={['field mt-1', errors.actual_end_date ? 'field-error' : ''].join(' ')}
              disabled={isBlocked || submitting}
              id="manual-actual-end"
              max={getTodayDateKey()}
              required
              type="date"
              value={form.actual_end_date}
              onChange={(event) => updateField('actual_end_date', event.target.value)}
            />
            {errors.actual_end_date ? <p className="form-error">{errors.actual_end_date}</p> : null}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="manual-realization-reason">
            Catatan Realisasi <span className="text-danger">*</span>
          </label>
          <textarea
            className={['field mt-1 min-h-24 resize-y', errors.reason ? 'field-error' : ''].join(' ')}
            disabled={isBlocked || submitting}
            id="manual-realization-reason"
            maxLength="500"
            placeholder="Contoh: Aktual sudah selesai kemarin, input baru dilakukan setelah konfirmasi PIC."
            required
            value={form.reason}
            onChange={(event) => updateField('reason', event.target.value)}
          />
          <div className="mt-1 flex items-center justify-between gap-3 text-xs">
            {errors.reason ? <p className="font-semibold text-danger">{errors.reason}</p> : <p className="text-text-muted">Tersimpan di audit trail.</p>}
            <span className="shrink-0 text-text-muted">{form.reason.trim().length}/500</span>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default TaskRealizationManualModal;
