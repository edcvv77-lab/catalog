// chat-room.js
// التعامل مع الدردشة متعددة الغرف باستخدام Supabase

document.addEventListener('DOMContentLoaded', () => {
  const roomSelect = document.getElementById('roomSelect');
  const messagesList = document.getElementById('messages');
  const messageForm = document.getElementById('messageForm');
  const messageInput = document.getElementById('message');
  const usernameDisplay = document.getElementById('usernameDisplay');

  let currentRoomId = null;
  let currentSubscription = null;
  let currentUser = null;

  // الحصول على المستخدم الحالي
  async function getCurrentUser() {
    const { data: { user } } = await window.supabase.auth.getUser();
    return user;
  }

  // جلب الغرف المتاحة
  async function fetchRooms() {
    const { data, error } = await window.supabase.from('rooms').select('*').order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching rooms:', error);
      return;
    }
    roomSelect.innerHTML = '';
    data.forEach((room) => {
      const option = document.createElement('option');
      option.value = room.id;
      option.textContent = room.name;
      roomSelect.appendChild(option);
    });
    // اختيار أول غرفة افتراضياً
    if (data.length > 0) {
      changeRoom(data[0].id);
      roomSelect.value = data[0].id;
    }
  }

  // تغيير الغرفة
  async function changeRoom(roomId) {
    currentRoomId = roomId;
    // إلغاء الاشتراك السابق إن وجد
    if (currentSubscription) {
      await currentSubscription.unsubscribe();
      currentSubscription = null;
    }
    // جلب رسائل الغرفة
    await fetchMessages();
    // الاشتراك في الرسائل الجديدة لتلك الغرفة
    subscribeToRoomMessages();
  }

  // جلب الرسائل لغرفة محددة
  async function fetchMessages() {
    if (!currentRoomId) return;
    const { data, error } = await window.supabase
      .from('messages')
      .select('*')
      .eq('room_id', currentRoomId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }
    messagesList.innerHTML = '';
    data.forEach((msg) => renderMessage(msg));
  }

  // عرض رسالة في الواجهة
  function renderMessage(msg) {
    const li = document.createElement('li');
    li.textContent = `${msg.username}: ${msg.content}`;
    messagesList.appendChild(li);
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  // إرسال رسالة للغرفة الحالية
  messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content || !currentRoomId || !currentUser) return;
    const { error } = await window.supabase.from('messages').insert([
      { room_id: currentRoomId, username: currentUser.email, content }
    ]);
    if (error) console.error('Error sending message:', error);
    messageInput.value = '';
  });

  // الاشتراك في رسائل الغرفة الحالية
  function subscribeToRoomMessages() {
    if (!currentRoomId) return;
    currentSubscription = window.supabase
      .channel(`public:messages:room:${currentRoomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${currentRoomId}` },
        (payload) => {
          renderMessage(payload.new);
        }
      )
      .subscribe();
  }

  // عند تغيير الغرفة من القائمة
  roomSelect.addEventListener('change', (e) => {
    const selectedRoom = e.target.value;
    changeRoom(selectedRoom);
  });

  // بدء تهيئة المنصة
  (async () => {
    currentUser = await getCurrentUser();
    if (!currentUser) {
      // إذا لم يكن المستخدم مسجلاً الدخول، إعادة التوجيه إلى صفحة الدخول
      window.location.href = 'login.html';
      return;
    }
    if (usernameDisplay) {
      usernameDisplay.textContent = currentUser.email;
    }
    await fetchRooms();
  })();
});