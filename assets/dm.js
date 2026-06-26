/* dm.js
 *
 * سكربت لإدارة الرسائل الخاصة بين المستخدمين. يوفر قائمة المحادثات الحالية وإمكانية إنشاء محادثة جديدة،
 * وعرض الرسائل وتحديثها في الوقت الحقيقي.
 */

(function() {
  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase || !window.supabaseApi || !window.realtimeApi || !window.securityUtils || !window.ui) {
      console.error('بعض الملفات المطلوبة غير محملة');
      return;
    }
    const supabase = window.supabase;
    const api = window.supabaseApi;
    const rtm = window.realtimeApi;
    const security = window.securityUtils;
    const uiUtils = window.ui;

    const dmSidebar = document.getElementById('dmSidebar');
    const dmSearchInput = document.getElementById('dmSearchInput');
    const dmConversationsList = document.getElementById('dmConversationsList');
    const dmSearchResults = document.getElementById('dmSearchResults');
    const dmMessagesContainer = document.getElementById('dmMessagesContainer');
    const dmMessageForm = document.getElementById('dmMessageForm');
    const dmMessageInput = document.getElementById('dmMessageInput');
    const currentDMUserEl = document.getElementById('currentDMUser');
    const signOutBtn = document.getElementById('dmSignOutButton');

    let currentUser = null;
    let currentConversationId = null;
    let currentOtherUser = null;
    let conversationSubscription = null;
    let ownerSettings = {};

    // تحميل المستخدم الحالي والملف الشخصي
    async function loadCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = 'login.html';
        return;
      }
      currentUser = user;
      const profile = await api.getProfile(user.id).catch(() => null);
      // تحميل إعدادات المالك لمعاينة الكلمات المحظورة وطول الرسالة
      ownerSettings = await security.getOwnerSettings();
      return profile;
    }

    // تحميل قائمة المحادثات
    async function loadConversations() {
      dmConversationsList.innerHTML = '';
      const conversations = await api.getPrivateConversations().catch((e) => { console.error(e); return []; });
      if (conversations.length === 0) {
        const p = document.createElement('p');
        p.className = 'text-center text-sm opacity-70';
        p.textContent = 'لا توجد محادثات بعد';
        dmConversationsList.appendChild(p);
        return;
      }
      for (const conv of conversations) {
        // تحديد الطرف الآخر
        const otherId = conv.user1_id === currentUser.id ? conv.user2_id : conv.user1_id;
        let otherProfile = null;
        try {
          otherProfile = await api.getProfile(otherId);
        } catch {
          otherProfile = { display_name: otherId };
        }
        // جلب آخر رسالة
        let lastMessage = null;
        try {
          const msgs = await api.getPrivateMessages(conv.id, { limit: 1 });
          if (msgs.length > 0) lastMessage = msgs[0];
        } catch {
          lastMessage = null;
        }
        const div = document.createElement('div');
        div.className = 'p-2 rounded cursor-pointer hover:bg-gray-700';
        div.dataset.conversationId = conv.id;
        div.dataset.otherId = otherId;
        div.innerHTML = `<div class="font-semibold">${otherProfile.display_name || otherProfile.username || otherId}</div>`;
        if (lastMessage) {
          const preview = document.createElement('div');
          preview.className = 'text-xs opacity-70 truncate';
          let previewText = lastMessage.content;
          if (previewText.length > 30) previewText = previewText.slice(0, 30) + '…';
          preview.textContent = previewText;
          div.appendChild(preview);
        }
        div.addEventListener('click', () => {
          selectConversation(conv.id, otherProfile);
        });
        dmConversationsList.appendChild(div);
      }
    }

    // اختيار محادثة
    async function selectConversation(conversationId, otherProfile) {
      if (currentConversationId === conversationId) return;
      // إلغاء الاشتراك السابق
      if (conversationSubscription) {
        await rtm.unsubscribe(conversationSubscription);
        conversationSubscription = null;
      }
      currentConversationId = conversationId;
      currentOtherUser = otherProfile;
      currentDMUserEl.textContent = `الدردشة مع ${otherProfile.display_name || otherProfile.username || ''}`;
      dmMessagesContainer.innerHTML = '';
      // تحميل رسائل هذه المحادثة
      await loadDmMessages(conversationId);
      // الاشتراك في الرسائل في الوقت الحقيقي
      conversationSubscription = rtm.subscribeToPrivateMessages(conversationId, {
        onInsert: (msg) => {
          renderDmMessage(msg);
          dmMessagesContainer.scrollTop = dmMessagesContainer.scrollHeight;
        },
        onUpdate: (msg) => {
          const el = dmMessagesContainer.querySelector(`[data-message-id="${msg.id}"]`);
          if (el) {
            el.querySelector('.msg-content').textContent = msg.content;
          }
        },
        onDelete: (msg) => {
          const el = dmMessagesContainer.querySelector(`[data-message-id="${msg.id}"]`);
          if (el) el.remove();
        }
      });
    }

    // تحميل الرسائل لمحاconversation
    async function loadDmMessages(conversationId) {
      try {
        const messages = await api.getPrivateMessages(conversationId, { limit: 100 });
        dmMessagesContainer.innerHTML = '';
        messages.forEach((msg) => renderDmMessage(msg));
        dmMessagesContainer.scrollTop = dmMessagesContainer.scrollHeight;
      } catch (error) {
        console.error(error);
      }
    }

    // عرض رسالة خاصة
    function renderDmMessage(msg) {
      const div = document.createElement('div');
      div.dataset.messageId = msg.id;
      div.className = 'p-2 rounded bg-opacity-10 mb-1';
      const owner = msg.sender_id === currentUser.id;
      div.style.backgroundColor = owner ? 'rgba(52, 152, 219, 0.2)' : 'rgba(108, 122, 137, 0.2)';
      div.innerHTML = `
        <div class="flex justify-between text-xs mb-1">
          <span class="font-semibold">${owner ? 'أنت' : (currentOtherUser?.display_name || currentOtherUser?.username || msg.sender_id)}</span>
          <span class="opacity-60">${window.utils.formatTime(msg.created_at)}</span>
        </div>
        <div class="msg-content">${window.utils.sanitize(msg.content)}</div>
      `;
      dmMessagesContainer.appendChild(div);
    }

    // إرسال رسالة خاصة
    dmMessageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentConversationId) {
        uiUtils.showToast('اختر محادثة أولاً', 'warning');
        return;
      }
      const text = dmMessageInput.value.trim();
      const res = security.checkMessage(text, ownerSettings, {});
      if (!res.valid) {
        uiUtils.showToast(res.error, 'error');
        return;
      }
      try {
        await api.sendPrivateMessage(currentConversationId, res.sanitized);
        dmMessageInput.value = '';
      } catch (error) {
        console.error(error);
        uiUtils.showToast('تعذر إرسال الرسالة', 'error');
      }
    });

    // البحث عن مستخدمين لبدء محادثة
    dmSearchInput.addEventListener('input', async (e) => {
      const value = e.target.value.trim();
      dmSearchResults.innerHTML = '';
      if (!value) return;
      try {
        const users = await api.getUsers({ search: value, limit: 10 });
        const results = users.filter((u) => u.id !== currentUser.id);
        results.forEach((u) => {
          const div = document.createElement('div');
          div.className = 'p-2 rounded hover:bg-gray-700 flex justify-between items-center';
          div.innerHTML = `<span>${u.display_name || u.username || u.id}</span>`;
          const startBtn = document.createElement('button');
          startBtn.className = 'btn-custom text-sm';
          startBtn.textContent = 'بدء محادثة';
          startBtn.addEventListener('click', async () => {
            try {
              const conv = await api.getOrCreateConversation(u.id);
              await loadConversations();
              selectConversation(conv.id, u);
              dmSearchResults.innerHTML = '';
              dmSearchInput.value = '';
            } catch (err) {
              console.error(err);
              uiUtils.showToast('تعذر بدء المحادثة', 'error');
            }
          });
          div.appendChild(startBtn);
          dmSearchResults.appendChild(div);
        });
      } catch (error) {
        console.error(error);
      }
    });

    // تسجيل خروج
    signOutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = 'login.html';
    });

    // تحميل المستخدم، المحادثات والمحادثة الأولى
    await loadCurrentUser();
    await loadConversations();
  });
})();