import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';

import { formatDate } from '../../logic/helpers/dateHelper';
import { getApiErrorMessage } from '../../logic/services/api';
import { createChatMessage, deleteChatMessage, getChatMessages, markChatRoomRead } from '../../logic/services/chatApi';
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

function ReadBySummary({ readReceipts = [] }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none text-[11px] font-semibold text-text-muted transition hover:text-primary">
        {readReceipts.length} read
      </summary>
      <div className="absolute bottom-full right-0 z-20 mb-2 w-64 rounded-lg border border-border bg-white p-3 shadow-lg">
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

// Jendela percakapan project chat dengan composer dan read-by ringkas.
function ChatWindow({ room, onRoomRead, onMessageCreated }) {
  const [messages, setMessages] = useState([]);
  const [messageBody, setMessageBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef(null);
  const currentUser = useUiStore((state) => state.currentUser);
  const showToast = useUiStore((state) => state.showToast);
  const currentUserId = Number(currentUser?.id || 0);
  const elevatedRole = ['super_admin', 'admin', 'manager'].includes(currentUser?.role);

  const fetchMessages = async ({ markRead = false } = {}) => {
    if (!room?.id) {
      setMessages([]);
      return;
    }

    setLoading(true);

    try {
      const rows = await getChatMessages(room.id);
      setMessages(rows);

      if (markRead && rows.length) {
        await markChatRoomRead(room.id);
        onRoomRead?.();
      }
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages({ markRead: true });

    if (room?.id) {
      emitRealtimeEvent('chat:join', room.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, room?.id]);

  useEffect(() => {
    const handleMessageChangeEvent = (event) => {
      const payload = event.detail;

      if (Number(payload?.room_id) !== Number(room?.id)) {
        return;
      }

      fetchMessages({ markRead: true });
    };

    const handleMessageReadEvent = (event) => {
      const payload = event.detail;

      if (Number(payload?.room_id) !== Number(room?.id)) {
        return;
      }

      fetchMessages({ markRead: false });
    };

    window.addEventListener('realtime:chat.message.created', handleMessageChangeEvent);
    window.addEventListener('realtime:chat.message.updated', handleMessageChangeEvent);
    window.addEventListener('realtime:chat.message.deleted', handleMessageChangeEvent);
    window.addEventListener('realtime:chat.message.read', handleMessageReadEvent);

    return () => {
      window.removeEventListener('realtime:chat.message.created', handleMessageChangeEvent);
      window.removeEventListener('realtime:chat.message.updated', handleMessageChangeEvent);
      window.removeEventListener('realtime:chat.message.deleted', handleMessageChangeEvent);
      window.removeEventListener('realtime:chat.message.read', handleMessageReadEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!messageBody.trim() || !room?.id) {
      return;
    }

    setSubmitting(true);

    try {
      await createChatMessage(room.id, { body: messageBody.trim() });
      setMessageBody('');
      await fetchMessages({ markRead: true });
      onMessageCreated?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (message) => {
    if (!window.confirm('Hapus pesan chat ini?')) {
      return;
    }

    try {
      await deleteChatMessage(message.id);
      await fetchMessages({ markRead: true });
      showToast({ type: 'success', message: 'Pesan chat dihapus.' });
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  if (!room) {
    return <div className="card flex min-h-[520px] items-center justify-center p-6 text-sm text-text-muted">Pilih chat room.</div>;
  }

  return (
    <section className="card flex min-h-[520px] flex-col overflow-hidden">
      <div className="border-b border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="section-title">{room.name || room.project_name || 'Project Chat'}</h2>
            <p className="section-subtitle">{room.member_count} members</p>
          </div>
          {loading ? <span className="badge bg-slate-100 text-slate-600">Syncing</span> : null}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
        {messages.length ? (
          messages.map((message) => {
            const mine = Number(message.sender_id) === currentUserId;
            const canDelete = mine || elevatedRole;

            return (
              <article key={message.id} className={['flex gap-3', mine ? 'justify-end' : 'justify-start'].join(' ')}>
                {!mine ? (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-white">
                    {getInitials(message.sender_name)}
                  </div>
                ) : null}

                <div className={['max-w-[78%] rounded-xl px-3 py-2 shadow-sm', mine ? 'bg-primary text-white' : 'bg-white text-text-dark'].join(' ')}>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={['text-xs font-bold', mine ? 'text-white' : 'text-text-dark'].join(' ')}>
                      {message.sender_name || 'Unknown user'}
                    </span>
                    <span className={['text-[11px]', mine ? 'text-blue-100' : 'text-text-muted'].join(' ')}>
                      {formatDate(message.created_at, 'dd MMM HH:mm')}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                  <div className="mt-2 flex items-center justify-end gap-3">
                    <ReadBySummary readReceipts={message.read_receipts || []} />
                    {canDelete ? (
                      <button className={['text-[11px] font-bold', mine ? 'text-blue-100' : 'text-danger'].join(' ')} type="button" onClick={() => handleDelete(message)}>
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-white p-6 text-center text-sm text-text-muted">
            Belum ada pesan. Mulai diskusi project dari sini.
          </div>
        )}
      </div>

      <form className="border-t border-border bg-white p-3" onSubmit={handleSubmit}>
        <div className="flex gap-2">
          <textarea
            className="field min-h-11 resize-none"
            placeholder="Tulis pesan project..."
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button className="btn-primary h-11 w-11 shrink-0 px-0" disabled={submitting || !messageBody.trim()} type="submit" title="Send">
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  );
}

export default ChatWindow;
