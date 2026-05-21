import { useEffect, useState } from 'react';

import FormField from '../shared/FormField';
import Modal from '../shared/Modal';

// Nilai awal form tanggal pengecualian kalender.
const initialForm = {
  exception_date: '',
  type: 'holiday',
  name: '',
  description: '',
};

// Modal form untuk membuat atau mengubah libur/hari kerja khusus.
function CalendarExceptionForm({ open, exception, onSubmit, onClose }) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setErrors({});

    if (!exception) {
      setForm(initialForm);
      return;
    }

    setForm({
      exception_date: exception.exception_date || '',
      type: exception.type || 'holiday',
      name: exception.name || '',
      description: exception.description || '',
    });
  }, [exception, open]);

  if (!open) {
    return null;
  }

  // Mengubah satu field form kalender dan membersihkan errornya.
  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  // Memastikan tanggal, tipe, dan nama pengecualian sudah diisi.
  const validateForm = () => {
    const nextErrors = {};

    if (!form.exception_date) {
      nextErrors.exception_date = 'Pilih tanggal exception.';
    }

    if (!form.name.trim()) {
      nextErrors.name = 'Masukkan nama exception.';
    }

    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  };

  // Mengirim data form kalender ke parent component.
  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit({
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
    });
  };

  return (
    <Modal
      description="Holiday mengurangi work days, sedangkan working day menambah hari kerja manual walaupun tanggal jatuh pada weekend."
      footer={
        <>
          <button className="btn-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" form="calendar-exception-form" type="submit">
            {exception ? 'Save Changes' : 'Create Exception'}
          </button>
        </>
      }
      open={open}
      size="md"
      title={exception ? 'Edit Calendar Exception' : 'Tambah Calendar Exception'}
      onClose={onClose}
    >
      <form className="grid gap-4" id="calendar-exception-form" noValidate onSubmit={handleSubmit}>
        <FormField error={errors.exception_date} htmlFor="exception-date" label="Tanggal" required>
          <input
            className={`field mt-1 ${errors.exception_date ? 'field-error' : ''}`}
            id="exception-date"
            required
            type="date"
            value={form.exception_date}
            onChange={(event) => updateField('exception_date', event.target.value)}
          />
        </FormField>
        <FormField htmlFor="exception-type" label="Type">
          <select className="field mt-1" id="exception-type" value={form.type} onChange={(event) => updateField('type', event.target.value)}>
            <option value="holiday">Holiday</option>
            <option value="working_day">Working Day</option>
          </select>
        </FormField>
        <FormField error={errors.name} htmlFor="exception-name" label="Nama" required>
          <input
            className={`field mt-1 ${errors.name ? 'field-error' : ''}`}
            id="exception-name"
            required
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
          />
        </FormField>
        <FormField htmlFor="exception-description" label="Deskripsi">
          <textarea
            className="field mt-1 min-h-20"
            id="exception-description"
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
          />
        </FormField>
      </form>
    </Modal>
  );
}

export default CalendarExceptionForm;
