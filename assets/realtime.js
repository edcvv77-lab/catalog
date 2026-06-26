/* realtime.js
 *
 * هذا الملف يوفر واجهة موحدة للاشتراك في تغييرات Supabase (رسائل، تفاعلات، إلخ).
 * يتم ربط الدوال على window.realtimeApi بحيث يمكن استخدامها في السكربتات الأخرى.
 */

(function() {
  if (!window.supabase) {
    console.error('Supabase is not loaded. تأكد من تحميل supabase قبل هذا الملف');
    return;
  }
  const supabase = window.supabase;

  /**
   * الاشتراك في رسائل غرفة محددة. يستمع لإدراج/تحديث/حذف الرسائل.
   *
   * @param {string} roomId - معرف الغرفة
   * @param {Object} handlers - كائن يحتوى الدوال التالية: onInsert, onUpdate, onDelete
   * @returns {object} subscription - مرجع الاشتراك لإلغائه لاحقًا
   */
  function subscribeToRoomMessages(roomId, handlers = {}) {
    const channel = supabase.channel(`room-messages-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          handlers.onInsert && handlers.onInsert(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          handlers.onUpdate && handlers.onUpdate(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          handlers.onDelete && handlers.onDelete(payload.old);
        }
      );
    channel.subscribe();
    return channel;
  }

  /**
   * الاشتراك في تفاعلات الرسائل ضمن غرفة معينة
   *
   * @param {string} roomId
   * @param {function} onReaction - يستدعى عند إضافة تفاعل
   * @returns {object} subscription
   */
  function subscribeToRoomReactions(roomId, onReaction) {
    const channel = supabase.channel(`room-reactions-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions' },
        (payload) => {
          // سنجلب الرسالة لمعرفة الغرفة
          if (onReaction) onReaction(payload.new);
        }
      );
    channel.subscribe();
    return channel;
  }

  /**
   * الاشتراك في رسائل خاصة لمحادثة معينة.
   * يستمع لإدراج/تحديث/حذف رسائل في جدول private_messages.
   * @param {string} conversationId - معرف المحادثة
   * @param {Object} handlers - دوال onInsert, onUpdate, onDelete
   * @returns {object} subscription
   */
  function subscribeToPrivateMessages(conversationId, handlers = {}) {
    const channel = supabase.channel(`private-messages-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        handlers.onInsert && handlers.onInsert(payload.new);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'private_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        handlers.onUpdate && handlers.onUpdate(payload.new);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'private_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        handlers.onDelete && handlers.onDelete(payload.old);
      });
    channel.subscribe();
    return channel;
  }

  /**
   * إلغاء الاشتراك من قناة معينة
   */
  async function unsubscribe(channel) {
    if (channel) {
      await channel.unsubscribe();
    }
  }

  window.realtimeApi = {
    subscribeToRoomMessages,
    subscribeToRoomReactions,
    subscribeToPrivateMessages,
    unsubscribe
  };
})();