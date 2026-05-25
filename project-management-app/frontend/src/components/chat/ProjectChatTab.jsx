import { useEffect, useState } from 'react';

import { getApiErrorMessage } from '../../logic/services/api';
import { createChatRoom, getChatRooms } from '../../logic/services/chatApi';
import { emitRealtimeEvent } from '../../logic/services/realtimeApi';
import { useUiStore } from '../../store/uiStore';
import ChatRoomList from './ChatRoomList';
import ChatWindow from './ChatWindow';

// Tab chat di detail project. Room dibuat otomatis saat project dibuka.
function ProjectChatTab({ project }) {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const showToast = useUiStore((state) => state.showToast);

  const fetchRooms = async ({ ensureRoom = false } = {}) => {
    if (!project?.id) {
      setRooms([]);
      setSelectedRoom(null);
      return;
    }

    setLoading(true);

    try {
      if (ensureRoom) {
        await createChatRoom({ type: 'project', project_id: project.id });
      }

      const rows = await getChatRooms({ project_id: project.id });
      setRooms(rows);

      setSelectedRoom((currentRoom) => {
        if (currentRoom && rows.some((room) => Number(room.id) === Number(currentRoom.id))) {
          return rows.find((room) => Number(room.id) === Number(currentRoom.id));
        }

        return rows[0] || null;
      });

      rows.forEach((room) => emitRealtimeEvent('chat:join', room.id));
      emitRealtimeEvent('project:join', project.id);
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms({ ensureRoom: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  useEffect(() => {
    const handleChatEvent = (event) => {
      const payload = event.detail;

      if (Number(payload?.project_id) !== Number(project?.id)) {
        return;
      }

      fetchRooms();
    };

    window.addEventListener('realtime:chat.message.created', handleChatEvent);
    window.addEventListener('realtime:chat.message.deleted', handleChatEvent);

    return () => {
      window.removeEventListener('realtime:chat.message.created', handleChatEvent);
      window.removeEventListener('realtime:chat.message.deleted', handleChatEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  return (
    <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <ChatRoomList rooms={rooms} selectedRoomId={selectedRoom?.id} loading={loading} onSelectRoom={setSelectedRoom} />
      <ChatWindow room={selectedRoom} onMessageCreated={() => fetchRooms()} onRoomRead={() => fetchRooms()} />
    </div>
  );
}

export default ProjectChatTab;
