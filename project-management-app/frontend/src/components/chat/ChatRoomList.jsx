import { MessageCircle } from 'lucide-react';

import { formatDate } from '../../logic/helpers/dateHelper';

// Daftar room chat project. Fase awal fokus ke satu project room, tetapi struktur siap untuk room tambahan.
function ChatRoomList({ rooms = [], selectedRoomId, loading, onSelectRoom }) {
  return (
    <aside className="card flex min-h-[520px] flex-col overflow-hidden">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="section-title">Project Chat</h2>
        </div>
        <p className="section-subtitle">Koordinasi ringan yang tetap terkait project.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? <p className="p-3 text-sm text-text-muted">Loading chat rooms...</p> : null}
        {!loading && !rooms.length ? <p className="p-3 text-sm text-text-muted">Belum ada chat room.</p> : null}

        {rooms.map((room) => {
          const active = Number(selectedRoomId) === Number(room.id);

          return (
            <button
              key={room.id}
              className={[
                'w-full rounded-lg p-3 text-left transition',
                active ? 'bg-blue-50 ring-1 ring-primary/30' : 'hover:bg-slate-50',
              ].join(' ')}
              type="button"
              onClick={() => onSelectRoom(room)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-text-dark">{room.name || room.project_name || 'Project Chat'}</p>
                  <p className="mt-1 truncate text-xs text-text-muted">
                    {room.last_message_body ? `${room.last_message_sender_name || 'User'}: ${room.last_message_body}` : 'Belum ada pesan.'}
                  </p>
                </div>
                {room.unread_count > 0 ? <span className="badge bg-danger text-white">{room.unread_count}</span> : null}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                <span>{room.member_count} members</span>
                <span>{formatDate(room.last_message_at || room.updated_at, 'dd MMM HH:mm')}</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default ChatRoomList;
