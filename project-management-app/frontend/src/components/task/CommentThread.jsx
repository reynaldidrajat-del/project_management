import { useEffect, useMemo, useState } from 'react';

import {
  createTaskComment,
  deleteTaskComment,
  getTaskComments,
  markTaskCommentsRead,
  updateTaskComment,
} from '../../logic/services/commentApi';
import { formatDate } from '../../logic/helpers/dateHelper';
import { getApiErrorMessage } from '../../logic/services/api';
import { emitRealtimeEvent } from '../../logic/services/realtimeApi';
import { useUiStore } from '../../store/uiStore';

const getInitials = (name = '') =>
  String(name || '?')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const getMentionUserIds = (comment) => (comment.mentions || []).map((mention) => String(mention.user_id));

function ReadByPopover({ readReceipts = [] }) {
  return (
    <details className="group relative">
      <summary className="cursor-pointer list-none text-xs font-semibold text-text-muted transition hover:text-primary">
        {readReceipts.length} read
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-border bg-white p-3 shadow-lg">
        <p className="label mb-2">Read by</p>
        <div className="max-h-44 space-y-2 overflow-y-auto">
          {readReceipts.length ? (
            readReceipts.map((receipt) => (
              <div key={`${receipt.user_id}-${receipt.read_at}`} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-semibold text-text-dark">{receipt.name}</span>
                <span className="shrink-0 text-text-muted">{formatDate(receipt.read_at, 'dd MMM HH:mm')}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-text-muted">Belum dibaca.</p>
          )}
        </div>
      </div>
    </details>
  );
}

function MentionPicker({ users = [], selectedUserIds = [], onChange }) {
  const selectedSet = useMemo(() => new Set(selectedUserIds.map(String)), [selectedUserIds]);
  const availableUsers = users.filter((user) => !selectedSet.has(String(user.id)));
  const selectedUsers = users.filter((user) => selectedSet.has(String(user.id)));

  const addUser = (userId) => {
    if (!userId) {
      return;
    }

    onChange([...selectedUserIds, String(userId)]);
  };

  const removeUser = (userId) => {
    onChange(selectedUserIds.filter((selectedUserId) => String(selectedUserId) !== String(userId)));
  };

  return (
    <div className="space-y-2">
      <select className="field" value="" onChange={(event) => addUser(event.target.value)}>
        <option value="">Mention user</option>
        {availableUsers.map((user) => (
          <option key={user.id} value={user.id}>
            @{user.name}
          </option>
        ))}
      </select>
      {selectedUsers.length ? (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <button
              key={user.id}
              className="badge bg-blue-100 text-blue-700 transition hover:bg-blue-200"
              type="button"
              onClick={() => removeUser(user.id)}
            >
              @{user.name} x
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CommentEditor({ users, value, mentionUserIds, submitting, submitLabel, onCancel, onMentionChange, onSubmit, onValueChange }) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <textarea
        className="field min-h-24 resize-y"
        placeholder="Tulis komentar kerja..."
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <MentionPicker selectedUserIds={mentionUserIds} users={users} onChange={onMentionChange} />
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <button className="btn-secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button className="btn-primary" disabled={submitting || !value.trim()} type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// Thread komentar task dengan mention, read-by, edit, dan soft delete.
function CommentThread({ task, users = [] }) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [mentionUserIds, setMentionUserIds] = useState([]);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editMentionUserIds, setEditMentionUserIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const showToast = useUiStore((state) => state.showToast);
  const currentUser = useUiStore((state) => state.currentUser);
  const currentUserId = String(currentUser?.id || '');
  const elevatedRole = ['super_admin', 'admin', 'manager'].includes(currentUser?.role);

  const fetchComments = async ({ markRead = false } = {}) => {
    if (!task?.id) {
      setComments([]);
      return;
    }

    setLoading(true);

    try {
      const rows = await getTaskComments(task.id);
      setComments(rows);

      if (markRead && rows.length) {
        await markTaskCommentsRead(task.id);
        setComments(await getTaskComments(task.id));
      }
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments({ markRead: true });
    if (task?.id) {
      emitRealtimeEvent('task:join', task.id);
    }
    setCommentText('');
    setMentionUserIds([]);
    setEditingCommentId(null);
    setEditText('');
    setEditMentionUserIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  useEffect(() => {
    const handleRealtimeCommentEvent = (event) => {
      const payload = event.detail;

      if (Number(payload?.task_id) !== Number(task?.id)) {
        return;
      }

      fetchComments({ markRead: true });
    };

    const handleRealtimeReadEvent = (event) => {
      const payload = event.detail;

      if (Number(payload?.task_id) !== Number(task?.id)) {
        return;
      }

      fetchComments();
    };

    window.addEventListener('realtime:comment.created', handleRealtimeCommentEvent);
    window.addEventListener('realtime:comment.read', handleRealtimeReadEvent);

    return () => {
      window.removeEventListener('realtime:comment.created', handleRealtimeCommentEvent);
      window.removeEventListener('realtime:comment.read', handleRealtimeReadEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  const handleCreateComment = async (event) => {
    event.preventDefault();

    if (!commentText.trim()) {
      return;
    }

    setSubmitting(true);

    try {
      await createTaskComment(task.id, {
        comment: commentText.trim(),
        mention_user_ids: mentionUserIds,
      });
      setCommentText('');
      setMentionUserIds([]);
      await fetchComments({ markRead: true });
      showToast({ type: 'success', message: 'Komentar ditambahkan.' });
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const startEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditText(comment.comment);
    setEditMentionUserIds(getMentionUserIds(comment));
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditText('');
    setEditMentionUserIds([]);
  };

  const handleUpdateComment = async (event) => {
    event.preventDefault();

    if (!editText.trim() || !editingCommentId) {
      return;
    }

    setSubmitting(true);

    try {
      await updateTaskComment(editingCommentId, {
        comment: editText.trim(),
        mention_user_ids: editMentionUserIds,
      });
      cancelEditComment();
      await fetchComments({ markRead: true });
      showToast({ type: 'success', message: 'Komentar diperbarui.' });
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (comment) => {
    if (!window.confirm('Hapus komentar ini?')) {
      return;
    }

    try {
      await deleteTaskComment(comment.id);
      await fetchComments({ markRead: true });
      showToast({ type: 'success', message: 'Komentar dihapus.' });
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  return (
    <section className="mt-4 rounded-xl border border-border p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label">Discussion</p>
          <p className="text-sm text-text-muted">{comments.length} komentar kerja.</p>
        </div>
        {loading ? <span className="badge bg-slate-100 text-slate-600">Loading</span> : null}
      </div>

      <div className="mb-4 space-y-3">
        {comments.length ? (
          comments.map((comment) => {
            const canMutate = elevatedRole || String(comment.user_id) === currentUserId;

            return (
              <article key={comment.id} className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-white">
                    {getInitials(comment.user_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-text-dark">{comment.user_name || 'Unknown user'}</p>
                        <p className="text-xs text-text-muted">{formatDate(comment.created_at, 'dd MMM yyyy HH:mm')}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <ReadByPopover readReceipts={comment.read_receipts || []} />
                        {canMutate ? (
                          <div className="flex items-center gap-2">
                            <button className="text-xs font-bold text-primary" type="button" onClick={() => startEditComment(comment)}>
                              Edit
                            </button>
                            <button className="text-xs font-bold text-danger" type="button" onClick={() => handleDeleteComment(comment)}>
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {editingCommentId === comment.id ? (
                      <div className="mt-3">
                        <CommentEditor
                          mentionUserIds={editMentionUserIds}
                          submitLabel="Save Comment"
                          submitting={submitting}
                          users={users}
                          value={editText}
                          onCancel={cancelEditComment}
                          onMentionChange={setEditMentionUserIds}
                          onSubmit={handleUpdateComment}
                          onValueChange={setEditText}
                        />
                      </div>
                    ) : (
                      <>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-dark">{comment.comment}</p>
                        {comment.mentions?.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {comment.mentions.map((mention) => (
                              <span key={mention.user_id} className="badge bg-blue-100 text-blue-700">
                                @{mention.name}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-text-muted">Belum ada komentar.</p>
        )}
      </div>

      <CommentEditor
        mentionUserIds={mentionUserIds}
        submitLabel="Post Comment"
        submitting={submitting}
        users={users}
        value={commentText}
        onMentionChange={setMentionUserIds}
        onSubmit={handleCreateComment}
        onValueChange={setCommentText}
      />
    </section>
  );
}

export default CommentThread;
