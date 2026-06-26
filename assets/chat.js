/* chat.js
 *
 * سكربت واجهة الدردشة المتقدمة. يتيح للمستخدم الانضمام للغرف، إرسال وتعديل الرسائل، الرد على الرسائل، إضافة تفاعلات، وإنشاء غرف.
 * يعتمد على supabaseApi و realtimeApi و utils المتاحة على window.
 */

(function() {
  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase || !window.supabaseApi || !window.realtimeApi || !window.utils) {
      console.error('الملفات المطلوبة غير محملة (supabaseApi أو realtimeApi أو utils)');
      return;
    }
    const supabase = window.supabase;
    const api = window.supabaseApi;
    const rtm = window.realtimeApi;
    const utils = window.utils;
    const security = window.securityUtils || {};

    // إعدادات المالك الحالية والقيم الحالية للغرفة
    let ownerSettings = {};
    let currentRoomDetails = null;
    let currentUserProfile = null;

    // عناصر DOM
    const roomSidebar = document.getElementById('roomSidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const roomSearchInput = document.getElementById('roomSearchInput');
    const roomsList = document.getElementById('roomsList');
    const createRoomBtn = document.getElementById('createRoomBtn');
    const currentRoomName = document.getElementById('currentRoomName');
    const participantsCount = document.getElementById('participantsCount');
    const currentUsernameEl = document.getElementById('currentUsername');
    const signOutButton = document.getElementById('signOutButton');
    const messagesContainer = document.getElementById('messagesContainer');
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const toastContainer = document.getElementById('toastContainer');
    // Modals
    const createRoomModal = document.getElementById('createRoomModal');
    const newRoomNameInput = document.getElementById('newRoomNameInput');
    const newRoomTypeSelect = document.getElementById('newRoomTypeSelect');
    const confirmCreateRoom = document.getElementById('confirmCreateRoom');
    const cancelCreateRoom = document.getElementById('cancelCreateRoom');
    const editMessageModal = document.getElementById('editMessageModal');
    const editMessageInput = document.getElementById('editMessageInput');
    const confirmEditMessage = document.getElementById('confirmEditMessage');
    const cancelEditMessage = document.getElementById('cancelEditMessage');

    // متغيرات الحالة
    let currentUser = null;
    let currentRoomId = null;
    let currentRoomSubscription = null;
    let editMessageId = null;
    let replyToId = null;

    /**
     * عرض Toast بسيط في أسفل الشاشة
     * @param {string} msg
     */
    function showToast(msg) {
      const div = document.createElement('div');
      div.className = 'bg-gray-900 bg-opacity-80 text-white px-4 py-2 rounded shadow';
      div.textContent = msg;
      toastContainer.appendChild(div);
      setTimeout(() => {
        div.remove();
      }, 3000);
    }

    /**
     * تحميل المستخدم الحالي
     */
    async function loadCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = 'login.html';
        return;
      }
      currentUser = user;
      const profile = await api.getProfile(user.id).catch(() => null);
      currentUserProfile = profile || null;
      const displayName = profile?.display_name || profile?.username || user.email;
      currentUsernameEl.textContent = displayName;
      // تحميل إعدادات المالك مرة واحدة
      try {
        ownerSettings = await api.getOwnerSettings();
      } catch (err) {
        console.warn('تعذر تحميل إعدادات المالك:', err);
        ownerSettings = {};
      }
    }

    /**
     * تحميل قائمة الغرف وعرضها
     * @param {string} search
     */
    async function loadRooms(search = '') {
      try {
        const rooms = await api.getRooms({ search, limit: 100 });
        // clear list
        roomsList.innerHTML = '';
        if (rooms.length === 0) {
          const p = document.createElement('p');
          p.className = 'text-center text-sm opacity-75';
          p.textContent = 'لا توجد غرف';
          roomsList.appendChild(p);
          return;
        }
        for (const room of rooms) {
          const li = document.createElement('div');
          li.className = 'p-2 rounded cursor-pointer hover:bg-gray-700 flex justify-between items-center';
          li.dataset.roomId = room.id;
          li.textContent = room.name;
          // you can show occupant count or last message here later
          li.addEventListener('click', () => {
            joinAndSelectRoom(room);
          });
          roomsList.appendChild(li);
        }
      } catch (error) {
        console.error('Error loading rooms:', error);
        showToast('حدث خطأ أثناء جلب الغرف');
      }
    }

    /**
     * الانضمام إلى غرفة (إنشاء عضوية إن لم تكن موجودة) ثم تحديدها
     */
    async function joinAndSelectRoom(room) {
      if (currentRoomId === room.id) return;
      try {
          await api.joinRoom(room.id);
      } catch (error) {
        console.error('Error joining room:', error);
        showToast('لا يمكنك الانضمام إلى هذه الغرفة');
      }
      selectRoom(room);
    }

    /**
     * تحديد الغرفة الحالية
     */
    async function selectRoom(room) {
      // إلغاء الاشتراك الحالي
      if (currentRoomSubscription) {
        await rtm.unsubscribe(currentRoomSubscription);
        currentRoomSubscription = null;
      }
      currentRoomId = room.id;
      currentRoomName.textContent = room.name;
      participantsCount.textContent = '—';
      messagesContainer.innerHTML = '';
      replyToId = null;
      // تحميل الأعضاء للتحديث
      updateParticipantsCount(room.id);
      // تحميل الرسائل الحالية
      await loadMessages(room.id);
      // الاشتراك في رسائل الغرفة
      currentRoomSubscription = rtm.subscribeToRoomMessages(room.id, {
        onInsert: handleMessageInsert,
        onUpdate: handleMessageUpdate,
        onDelete: handleMessageDelete
      });

      // تحميل الرسائل المثبتة
      await loadPinnedMessages(room.id);

      // تحميل تفاصيل الغرفة (مثل slow mode) وحفظها
      try {
        currentRoomDetails = await api.getRoomById(room.id);
      } catch (err) {
        currentRoomDetails = null;
      }
    }

    /**
     * تحديث عدد المشاركين
     */
    async function updateParticipantsCount(roomId) {
      try {
        const members = await api.getRoomMembers(roomId);
        participantsCount.textContent = members.length + ' مستخدمين';
      } catch (error) {
        console.error('Error fetching members:', error);
        participantsCount.textContent = '—';
      }
    }

    /**
     * تحميل الرسائل في الغرفة وعرضها
     */
    async function loadMessages(roomId) {
      try {
        const messages = await api.getMessages(roomId, { limit: 100 });
        messagesContainer.innerHTML = '';
        messages.forEach((msg) => renderMessage(msg));
        // scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    }

    /**
     * Render single message element
     */
    function renderMessage(msg) {
      // إذا كانت الرسالة محذوفة
      const isDeleted = !!msg.deleted_at;
      const msgEl = document.createElement('div');
      msgEl.className = 'message-item flex flex-col bg-opacity-10 p-2 rounded hover:bg-opacity-20 relative';
      msgEl.dataset.messageId = msg.id;
      // Header
      const header = document.createElement('div');
      header.className = 'flex items-center mb-1';
      const avatar = document.createElement('img');
      avatar.className = 'w-8 h-8 rounded-full ml-2';
      avatar.src = msg.profiles?.avatar_url || 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png';
      avatar.alt = msg.profiles?.display_name || msg.profiles?.username || 'avatar';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'font-semibold';
      nameSpan.textContent = msg.profiles?.display_name || msg.profiles?.username || msg.sender_id;
      const role = msg.profiles?.role;
      let roleBadge = null;
      if (role && ['moderator', 'admin', 'owner'].includes(role)) {
        roleBadge = document.createElement('span');
        roleBadge.className = 'ml-1 px-1 text-xs rounded text-black';
        switch (role) {
          case 'owner':
            roleBadge.style.backgroundColor = '#f1c40f';
            roleBadge.textContent = 'المالك';
            break;
          case 'admin':
            roleBadge.style.backgroundColor = '#e67e22';
            roleBadge.textContent = 'مشرف';
            break;
          case 'moderator':
            roleBadge.style.backgroundColor = '#9b59b6';
            roleBadge.textContent = 'مراقب';
            break;
        }
      }
      const timeSpan = document.createElement('span');
      timeSpan.className = 'text-xs opacity-60 mr-2';
      timeSpan.textContent = utils.formatTime(msg.created_at);
      header.appendChild(avatar);
      header.appendChild(nameSpan);
      if (roleBadge) header.appendChild(roleBadge);
      header.appendChild(timeSpan);
      msgEl.appendChild(header);
      // Content or deleted
      const contentDiv = document.createElement('div');
      if (isDeleted) {
        contentDiv.className = 'italic opacity-60';
        contentDiv.textContent = 'تم حذف الرسالة';
      } else {
        contentDiv.innerHTML = utils.sanitize(msg.content);
      }
      msgEl.appendChild(contentDiv);
      // Reply preview if exists
      if (msg.reply_to) {
        const replyPreview = document.createElement('div');
        replyPreview.className = 'text-xs opacity-70 border-r-4 border-gray-500 pr-2 mt-1';
        replyPreview.textContent = 'رد على رسالة';
        // Could fetch reply content on demand
        msgEl.appendChild(replyPreview);
      }
      // Actions (edit/delete/reply/react) – only إذا لم تكن محذوفة
      if (!isDeleted) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'flex gap-2 mt-1 text-xs opacity-70';
        // Reply button
        const replyBtn = document.createElement('button');
        replyBtn.textContent = 'رد';
        replyBtn.addEventListener('click', () => {
          replyToId = msg.id;
          messageInput.focus();
          showToast('سترد على الرسالة المحددة');
        });
        actionsDiv.appendChild(replyBtn);
        // Edit button – فقط للمرسل أو الأدوار الأعلى
        if (msg.sender_id === currentUser.id || hasModeratorPrivileges()) {
          const editBtn = document.createElement('button');
          editBtn.textContent = 'تعديل';
          editBtn.addEventListener('click', () => {
            openEditModal(msg);
          });
          actionsDiv.appendChild(editBtn);
        }
        // Delete button – للمرسل أو الأدوار الأعلى
        if (msg.sender_id === currentUser.id || hasModeratorPrivileges()) {
          const deleteBtn = document.createElement('button');
          deleteBtn.textContent = 'حذف';
          deleteBtn.addEventListener('click', async () => {
            try {
              await api.deleteMessage(msg.id);
            } catch (error) {
              console.error('Error deleting message:', error);
              showToast('تعذر حذف الرسالة');
            }
          });
          actionsDiv.appendChild(deleteBtn);
        }
        // Reaction button (❤️)
        const reactBtn = document.createElement('button');
        reactBtn.textContent = '❤️';
        reactBtn.addEventListener('click', async () => {
          try {
            await api.addReaction(msg.id, '❤️');
          } catch (error) {
            showToast('تعذر إضافة التفاعل', 'error');
          }
        });
        actionsDiv.appendChild(reactBtn);
        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'نسخ';
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(msg.content).then(() => {
            showToast('تم نسخ الرسالة', 'success');
          });
        });
        actionsDiv.appendChild(copyBtn);
        // Pin/unpin button
        if (hasModeratorPrivileges()) {
          const pinBtn = document.createElement('button');
          pinBtn.textContent = msg.pinned ? 'إلغاء التثبيت' : 'تثبيت';
          pinBtn.addEventListener('click', async () => {
            try {
              if (msg.pinned) {
                await api.unpinMessage(msg.id);
              } else {
                await api.pinMessage(msg.id);
              }
              await loadPinnedMessages(currentRoomId);
              showToast('تم تحديث حالة التثبيت', 'success');
            } catch (err) {
              showToast('تعذر تحديث حالة التثبيت', 'error');
            }
          });
          actionsDiv.appendChild(pinBtn);
        }
        msgEl.appendChild(actionsDiv);
      }
      messagesContainer.appendChild(msgEl);
    }

    /**
     * هل للمستخدم صلاحيات تعديل/حذف؟
     */
    function hasModeratorPrivileges() {
      // يعامل مالك ومشرف كمسؤول
      return currentUserProfile && ['admin', 'moderator', 'owner'].includes(currentUserProfile.role);
    }

    /**
     * تحميل الرسائل المثبتة لغرفة معينة وعرضها في القسم المخصص.
     * يُظهر زر إلغاء التثبيت للمستخدمين ذوي الصلاحيات.
     * @param {string} roomId
     */
    async function loadPinnedMessages(roomId) {
      const section = document.getElementById('pinnedMessagesSection');
      const container = document.getElementById('pinnedMessagesContainer');
      if (!section || !container) return;
      try {
        const pinned = await api.getPinnedMessages(roomId);
        container.innerHTML = '';
        if (!pinned || pinned.length === 0) {
          section.classList.add('hidden');
          return;
        }
        section.classList.remove('hidden');
        pinned.forEach((msg) => {
          const item = document.createElement('div');
          item.className = 'p-2 rounded bg-gray-700 bg-opacity-50 flex justify-between items-center';
          const content = document.createElement('div');
          content.className = 'text-sm truncate';
          content.innerHTML = utils.sanitize(msg.content);
          item.appendChild(content);
          if (hasModeratorPrivileges()) {
            const unpinBtn = document.createElement('button');
            unpinBtn.className = 'text-xs underline text-red-400';
            unpinBtn.textContent = 'إلغاء التثبيت';
            unpinBtn.addEventListener('click', async () => {
              try {
                await api.unpinMessage(msg.id);
                await loadPinnedMessages(roomId);
                showToast('تم إلغاء تثبيت الرسالة', 'success');
              } catch (err) {
                showToast('تعذر إلغاء تثبيت الرسالة', 'error');
              }
            });
            item.appendChild(unpinBtn);
          }
          container.appendChild(item);
        });
      } catch (err) {
        console.error(err);
      }
    }

    /**
     * معالجة إدراج الرسالة في الوقت الحقيقي
     */
    function handleMessageInsert(newMsg) {
      // إذا كانت الرسالة تتعلق بالغرفة الحالية، قم بعرضها
      if (newMsg.room_id === currentRoomId) {
        renderMessage(newMsg);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }
    /**
     * معالجة تحديث الرسالة في الوقت الحقيقي
     */
    function handleMessageUpdate(updatedMsg) {
      if (updatedMsg.room_id !== currentRoomId) return;
      const msgEl = messagesContainer.querySelector(`[data-message-id="${updatedMsg.id}"]`);
      if (msgEl) {
        // إعادة إنشاء الرسالة
        msgEl.remove();
        renderMessage(updatedMsg);
      }
    }
    /**
     * معالجة حذف الرسالة في الوقت الحقيقي
     */
    function handleMessageDelete(oldMsg) {
      if (oldMsg.room_id !== currentRoomId) return;
      const msgEl = messagesContainer.querySelector(`[data-message-id="${oldMsg.id}"]`);
      if (msgEl) {
        msgEl.remove();
      }
    }

    /**
     * فتح حوار تعديل الرسالة
     */
    function openEditModal(msg) {
      editMessageId = msg.id;
      editMessageInput.value = msg.content;
      editMessageModal.classList.remove('hidden');
    }

    /**
     * إغلاق حوار تعديل الرسالة
     */
    function closeEditModal() {
      editMessageId = null;
      editMessageModal.classList.add('hidden');
    }

    // إدارة الإشارات (Events)
    // Toggle sidebar on mobile
    sidebarToggle.addEventListener('click', () => {
      roomSidebar.classList.toggle('translate-x-full');
    });
    // Search rooms
    roomSearchInput.addEventListener('input', async (e) => {
      const value = e.target.value.trim();
      await loadRooms(value);
    });
    // Create room button
    createRoomBtn.addEventListener('click', () => {
      createRoomModal.classList.remove('hidden');
      newRoomNameInput.value = '';
      newRoomTypeSelect.value = 'public';
    });
    // Cancel create room
    cancelCreateRoom.addEventListener('click', () => {
      createRoomModal.classList.add('hidden');
    });
    // Confirm create room
    confirmCreateRoom.addEventListener('click', async () => {
      const name = newRoomNameInput.value.trim();
      const type = newRoomTypeSelect.value;
      if (!name) {
        showToast('يجب كتابة اسم الغرفة');
        return;
      }
      const slug = utils.slugify(name);
      try {
        const room = await api.createRoom({ name, slug, type });
        createRoomModal.classList.add('hidden');
        showToast('تم إنشاء الغرفة بنجاح');
        // إعادة تحميل الغرف والانضمام إلى الغرفة الجديدة
        await loadRooms(roomSearchInput.value.trim());
        joinAndSelectRoom(room);
      } catch (error) {
        console.error('Error creating room:', error);
        showToast('تعذر إنشاء الغرفة');
      }
    });
    // Submit message form
    messageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = messageInput.value;
      if (security && typeof security.checkMessage === 'function') {
        const checkRes = security.checkMessage(text, ownerSettings, currentRoomDetails || {});
        if (!checkRes.valid) {
          showToast(checkRes.error, 'warning');
          return;
        }
        try {
          await api.sendMessage(currentRoomId, checkRes.sanitized, { replyTo: replyToId });
          messageInput.value = '';
          replyToId = null;
        } catch (error) {
          console.error('Error sending message:', error);
          showToast('تعذر إرسال الرسالة', 'error');
        }
      } else {
        // fallback: إرسال بدون تحققات
        try {
          await api.sendMessage(currentRoomId, utils.sanitize(text.trim()), { replyTo: replyToId });
          messageInput.value = '';
          replyToId = null;
        } catch (error) {
          console.error('Error sending message:', error);
          showToast('تعذر إرسال الرسالة', 'error');
        }
      }
    });
    // Sign out
    signOutButton.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = 'login.html';
    });
    // Edit message modal buttons
    cancelEditMessage.addEventListener('click', () => {
      closeEditModal();
    });
    confirmEditMessage.addEventListener('click', async () => {
      const newContent = editMessageInput.value.trim();
      if (!newContent) {
        showToast('لا يمكن أن تكون الرسالة فارغة');
        return;
      }
      try {
        await api.editMessage(editMessageId, utils.sanitize(newContent));
        closeEditModal();
      } catch (error) {
        console.error('Error editing message:', error);
        showToast('تعذر تعديل الرسالة');
      }
    });

    // عند تحميل الصفحة
    await loadCurrentUser();
    await loadRooms();
  });
})();