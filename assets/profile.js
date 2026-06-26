/* profile.js
 * يحمّل ويعرض معلومات الملف الشخصي للمستخدم، ويتيح إجراءات بسيطة مثل التعديل أو بدء محادثة خاصة.
 */

(function() {
  document.addEventListener('DOMContentLoaded', async () => {
    const supabase = window.supabase;
    const api = window.supabaseApi;
    const ui = window.ui;
    // تحقق من الجلسة
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    const currentUserId = session.user.id;
    // الحصول على معرف المستخدم من عنوان الصفحة (?id=)
    const params = new URLSearchParams(window.location.search);
    const profileId = params.get('id') || currentUserId;
    try {
      const profile = await api.getProfile(profileId);
      renderProfile(profile, profileId === currentUserId);
    } catch (err) {
      console.error(err);
      ui.showToast('حدث خطأ أثناء تحميل الملف الشخصي', 'error');
    }
  });

  function renderProfile(profile, isCurrentUser) {
    const container = document.getElementById('profileContainer');
    const actions = document.getElementById('profileActions');
    if (!container) return;
    // المعلومات الأساسية
    container.innerHTML = `
      <div class="flex flex-col items-center space-y-4">
        <img src="${profile.avatar_url || '../assets/default-avatar.png'}" alt="avatar" class="w-24 h-24 rounded-full object-cover">
        <h2 class="text-2xl font-bold">${escapeHtml(profile.display_name || profile.username || '')}</h2>
        <p class="text-gray-400">${escapeHtml(profile.bio || '')}</p>
        <div class="flex gap-2 flex-wrap text-sm">
          <span class="bg-gray-700 px-2 py-1 rounded">الرتبة: ${profile.role || 'user'}</span>
          <span class="bg-gray-700 px-2 py-1 rounded">الحالة: ${profile.status || 'active'}</span>
          <span class="bg-gray-700 px-2 py-1 rounded">تاريخ الانضمام: ${formatDate(profile.created_at)}</span>
        </div>
      </div>
    `;
    // إجراءات
    actions.innerHTML = '';
    if (isCurrentUser) {
      const editBtn = document.createElement('a');
      editBtn.href = 'profile-edit.html';
      editBtn.className = 'btn-custom';
      editBtn.textContent = 'تعديل الملف الشخصي';
      actions.appendChild(editBtn);
    } else {
      const dmBtn = document.createElement('button');
      dmBtn.className = 'btn-custom';
      dmBtn.textContent = 'مراسلة خاصة';
      dmBtn.onclick = async () => {
        try {
          const convo = await window.supabaseApi.getOrCreateConversation(profile.id);
          window.location.href = `dm.html?conversation=${convo.id}`;
        } catch (err) {
          ui.showToast('حدث خطأ أثناء إنشاء المحادثة', 'error');
        }
      };
      actions.appendChild(dmBtn);
      // زر الحظر
      const blockBtn = document.createElement('button');
      blockBtn.className = 'btn-custom bg-red-600';
      blockBtn.textContent = 'حظر المستخدم';
      blockBtn.onclick = async () => {
        if (confirm('هل أنت متأكد من حظر هذا المستخدم؟')) {
          try {
            await api.banUser(profile.id);
            ui.showToast('تم حظر المستخدم', 'success');
          } catch (err) {
            ui.showToast('فشل الحظر: ' + err.message, 'error');
          }
        }
      };
      actions.appendChild(blockBtn);
    }
  }
  // helpers
  function formatDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function(m) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[m];
    });
  }
})();