import { useState } from 'react';

import { TASK_LABEL_COLORS, getTaskLabelBadgeClass } from '../../logic/helpers/taskLabelHelper';
import { getApiErrorMessage } from '../../logic/services/api';
import { createTaskLabel, deleteTaskLabel } from '../../logic/services/taskApi';
import { useUiStore } from '../../store/uiStore';

const initialForm = {
  name: '',
  color: 'slate',
};

// Pengelola label task sederhana per project.
function TaskLabelManager({ embedded = false, hideHeader = false, projectId, labels = [], onChanged }) {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const showToast = useUiStore((state) => state.showToast);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!projectId) {
      showToast({ type: 'error', message: 'Pilih project sebelum membuat label.' });
      return;
    }

    if (!form.name.trim()) {
      showToast({ type: 'error', message: 'Nama label wajib diisi.' });
      return;
    }

    setLoading(true);

    try {
      await createTaskLabel({
        project_id: projectId,
        name: form.name.trim(),
        color: form.color,
      });
      setForm(initialForm);
      showToast({ type: 'success', message: 'Label task dibuat.' });
      await onChanged?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (label) => {
    if (!window.confirm(`Hapus label "${label.name}"? Label akan dilepas dari task terkait.`)) {
      return;
    }

    try {
      await deleteTaskLabel(label.id);
      showToast({ type: 'success', message: 'Label task dihapus.' });
      await onChanged?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  return (
    <div className={embedded ? 'space-y-3' : 'card p-4'}>
      {hideHeader ? null : (
        <div className="section-header">
          <div>
            <h2 className="section-title">Task Labels</h2>
            <p className="section-subtitle">Label membantu filter dan pengelompokan task dalam project.</p>
          </div>
        </div>
      )}
      <form className="grid gap-2 sm:grid-cols-[1fr_160px_auto]" onSubmit={handleSubmit}>
        <input
          className="field"
          disabled={!projectId || loading}
          placeholder={projectId ? 'Nama label' : 'Pilih project dulu'}
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
        />
        <select
          className="field"
          disabled={!projectId || loading}
          value={form.color}
          onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
        >
          {TASK_LABEL_COLORS.map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
        <button className="btn-primary" disabled={!projectId || loading} type="submit">
          Add Label
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {labels.length ? (
          labels.map((label) => (
            <span key={label.id} className={`badge inline-flex items-center gap-2 ${getTaskLabelBadgeClass(label.color)}`}>
              {label.name}
              <button className="font-black" type="button" onClick={() => handleDelete(label)}>
                x
              </button>
            </span>
          ))
        ) : (
          <p className="text-sm text-text-muted">Belum ada label task.</p>
        )}
      </div>
    </div>
  );
}

export default TaskLabelManager;
