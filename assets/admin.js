// admin.js
// سكربت لوحة المالك لإدارة الغرف والرسائل

document.addEventListener('DOMContentLoaded', () => {
  const roomSelect = document.getElementById('ownerRoomSelect');
  const messagesList = document.getElementById('ownerMessages');
  const createRoomForm = document.getElementById('createRoomForm');
  const newRoomNameInput = document.getElementById('newRoomName');
  const signOutButton = document.getElementById('ownerSignOutButton');
  const ownerNameDisplay = document.getElementById('ownerNameDisplay');

  // عناصر قسم الإعدادات
  const themeSelect = document.getElementById('themeSelect');
  const accentColorInput = document.getElementById('accentColorInput');
  const joinNotificationsToggle = document.getElementById('joinNotificationsToggle');
  const retainDaysInput = document.getElementById('retainDaysInput');
  const clearMessagesBtn = document.getElementById('clearMessagesBtn');
  const exportMessagesBtn = document.getElementById('exportMessagesBtn');

  let currentRoomId = null;
  let currentSubscription = null;
  let currentUser = null;

  // ------- إعدادات الواجهة -------
  // تحميل الإعدادات من localStorage
  function loadSettings() {
    let settings = {};
    try {
      settings = JSON.parse(localStorage.getItem('ownerSettings')) || {};
    } catch (e) {
      settings = {};
    }
    return {
      theme: settings.theme || 'dark',
      accent: settings.accent || '#3b82f6',
      joinNotifications: settings.joinNotifications !== undefined ? settings.joinNotifications : true,
      retainDays: settings.retainDays || 30
    };
  }

  // حفظ الإعدادات إلى localStorage
  function saveSettings(settings) {
    localStorage.setItem('ownerSettings', JSON.stringify(settings));
  }

  // تفتيح اللون لزر hover
  function lightenColor(hex, percent = 0.15) {
    let color = hex.replace('#', '');
    if (color.length === 3) {
      color = color.split('').map((c) => c + c).join('');
    }
    const num = parseInt(color, 16);
    let r = (num >> 16) + Math.round(255 * percent);
    let g = ((num >> 8) & 0x00ff) + Math.round(255 * percent);
    let b = (num & 0x0000ff) + Math.round(255 * percent);
    r = r > 255 ? 255 : r;
    g = g > 255 ? 255 : g;
    b = b > 255 ? 255 : b;
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // تطبيق الإعدادات على الواجهة والـ DOM
  function applySettings(settings) {
    // تعيين الثيم
    document.documentElement.setAttribute('data-theme', settings.theme);
    // تعيين الألوان
    document.documentElement.style.setProperty('--button-bg', settings.accent);
    const hover = lightenColor(settings.accent, 0.15);
    document.documentElement.style.setProperty('--button-hover', hover);
    // تحديث قيمة عناصر النموذج
    if (themeSelect) themeSelect.value = settings.theme;
    if (accentColorInput) accentColorInput.value = settings.accent;
    if (joinNotificationsToggle) joinNotificationsToggle.checked = settings.joinNotifications;
    if (retainDaysInput) retainDaysInput.value = settings.retainDays;
  }

  // الحصول على المستخدم الحالي
  async function getCurrentUser() {
    const { data: { user } } = await window.supabase.auth.getUser();
    return user;
  }

  // جلب جميع الغرف وتحديث القائمة
  async function fetchRooms() {
    const { data, error } = await window.supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: true });
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
    // اختيار أول غرفة إذا لم يتم اختيار واحدة مسبقاً
    if (data.length > 0 && !currentRoomId) {
      roomSelect.value = data[0].id;
      changeRoom(data[0].id);
    }
  }

  // إنشاء غرفة جديدة
  if (createRoomForm) {
    createRoomForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = newRoomNameInput.value.trim();
      if (!name) return;
      const { error } = await window.supabase.from('rooms').insert([{ name }]);
      if (error) {
        console.error('Error creating room:', error);
      } else {
        newRoomNameInput.value = '';
        fetchRooms();
      }
    });
  }

  // تغيير الغرفة المعروضة
  async function changeRoom(roomId) {
    currentRoomId = roomId;
    // إلغاء الاشتراك القديم إن وجد
    if (currentSubscription) {
      await currentSubscription.unsubscribe();
      currentSubscription = null;
    }
    await fetchMessages();
    subscribeToRoomMessages();
  }

  roomSelect.addEventListener('change', (e) => {
    const selected = e.target.value;
    changeRoom(selected);
  });

  // جلب الرسائل لغرفة معينة
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

  // عرض الرسالة مع زر الحذف
  function renderMessage(msg) {
    const li = document.createElement('li');
    li.id = `adm-msg-${msg.id}`;
    li.innerHTML = `<span>${new Date(msg.created_at).toLocaleString()} | <strong>${msg.username}</strong>: ${msg.content}</span>`;
    const delBtn = document.createElement('button');
    delBtn.textContent = 'حذف';
    delBtn.style.marginLeft = '1rem';
    delBtn.style.color = '#f87171';
    delBtn.style.background = 'transparent';
    delBtn.style.border = 'none';
    delBtn.style.cursor = 'pointer';
    delBtn.addEventListener('click', async () => {
      const { error } = await window.supabase
        .from('messages')
        .delete()
        .eq('id', msg.id);
      if (error) {
        console.error('Error deleting message:', error);
      }
    });
    li.appendChild(delBtn);
    messagesList.appendChild(li);
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  // إزالة الرسالة من الواجهة
  function removeMessage(id) {
    const el = document.getElementById(`adm-msg-${id}`);
    if (el) el.remove();
  }

  // الاشتراك في الرسائل للغرفة الحالية
  function subscribeToRoomMessages() {
    if (!currentRoomId) return;
    currentSubscription = window.supabase
      .channel(`admin:messages:${currentRoomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${currentRoomId}` },
        (payload) => {
          renderMessage(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${currentRoomId}` },
        (payload) => {
          removeMessage(payload.old.id);
        }
      )
      .subscribe();
  }

  // تسجيل خروج المالك
  if (signOutButton) {
    signOutButton.addEventListener('click', async () => {
      await window.supabase.auth.signOut();
      window.location.href = 'login.html';
    });
  }

  // تهيئة الصفحة
  (async () => {
    currentUser = await getCurrentUser();
    if (!currentUser) {
      window.location.href = 'login.html';
      return;
    }
    if (ownerNameDisplay) ownerNameDisplay.textContent = currentUser.email;
    await fetchRooms();
    // تحميل وتطبيق الإعدادات
    const initSettings = loadSettings();
    applySettings(initSettings);
    // ربط أحداث تغيير الإعدادات
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        const settings = loadSettings();
        settings.theme = e.target.value;
        saveSettings(settings);
        applySettings(settings);
      });
    }
    if (accentColorInput) {
      accentColorInput.addEventListener('input', (e) => {
        const settings = loadSettings();
        settings.accent = e.target.value;
        saveSettings(settings);
        applySettings(settings);
      });
    }
    if (joinNotificationsToggle) {
      joinNotificationsToggle.addEventListener('change', (e) => {
        const settings = loadSettings();
        settings.joinNotifications = e.target.checked;
        saveSettings(settings);
      });
    }
    if (retainDaysInput) {
      retainDaysInput.addEventListener('change', (e) => {
        const settings = loadSettings();
        const days = parseInt(e.target.value, 10);
        settings.retainDays = isNaN(days) ? 30 : days;
        saveSettings(settings);
      });
    }
    // زر مسح الرسائل
    if (clearMessagesBtn) {
      clearMessagesBtn.addEventListener('click', async () => {
        if (!currentRoomId) return;
        const confirmDelete = window.confirm('هل أنت متأكد من رغبتك في حذف جميع الرسائل لهذه الغرفة؟');
        if (!confirmDelete) return;
        const { error } = await window.supabase.from('messages').delete().eq('room_id', currentRoomId);
        if (error) {
          alert('حدث خطأ أثناء حذف الرسائل');
          console.error('Error clearing messages:', error);
        } else {
          // تحديث الواجهة بعد الحذف
          messagesList.innerHTML = '';
        }
      });
    }
    // زر تصدير الرسائل
    if (exportMessagesBtn) {
      exportMessagesBtn.addEventListener('click', async () => {
        if (!currentRoomId) return;
        const { data, error } = await window.supabase
          .from('messages')
          .select('*')
          .eq('room_id', currentRoomId)
          .order('created_at', { ascending: true });
        if (error) {
          alert('حدث خطأ أثناء جلب الرسائل');
          console.error('Error exporting messages:', error);
          return;
        }
        const content = JSON.stringify(data, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `room-${currentRoomId}-messages.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }
  })();
});