import api, { unwrapData } from './api';

// Mengambil daftar chat room user, bisa difilter ke satu project.
export const getChatRooms = (params = {}) => api.get('/chat/rooms', { params }).then(unwrapData);

// Membuat atau mengambil project chat room.
export const createChatRoom = (payload) => api.post('/chat/rooms', payload).then(unwrapData);

// Mengambil pesan dalam satu chat room.
export const getChatMessages = (roomId, params = {}) => api.get(`/chat/rooms/${roomId}/messages`, { params }).then(unwrapData);

// Mengirim pesan chat.
export const createChatMessage = (roomId, payload) => api.post(`/chat/rooms/${roomId}/messages`, payload).then(unwrapData);

// Menandai semua pesan dalam room sudah dibaca.
export const markChatRoomRead = (roomId) => api.post(`/chat/rooms/${roomId}/read`).then(unwrapData);

// Mengubah isi pesan chat.
export const updateChatMessage = (messageId, payload) => api.patch(`/chat/messages/${messageId}`, payload).then(unwrapData);

// Soft delete pesan chat.
export const deleteChatMessage = (messageId) => api.delete(`/chat/messages/${messageId}`).then(unwrapData);

// Menandai satu pesan chat sudah dibaca.
export const markChatMessageRead = (messageId) => api.post(`/chat/messages/${messageId}/read`).then(unwrapData);
