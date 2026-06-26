/* profile-edit.js
 * يوفر نموذجًا لتحديث ملف المستخدم. يقوم بتحميل البيانات الحالية وحفظ التغييرات عبر supabaseApi.
 */

(function() {
  document.addEventListener('DOMContentLoaded', async () => {
    const supabase = window.supabase;
    const api = window.supabaseApi;
    const ui = window.ui;
    const form = document.getElementById('profileEditForm');
    if (!form) return;
    // التحقق من الجلسة
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    const userId = session.user.id;
    // تحميل البيانات
    try {
      const profile = await api.getProfile(userId);
      document.getElementById('displayName').value = profile.display_name || '';
      document.getElementById('bio').value = profile.bio || '';
      document.getElementById('avatarUrl').value = profile.avatar_url || '';
    } catch (err) {
      ui.showToast('خطأ في تحميل البيانات', 'error');
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const displayName = document.getElementById('displayName').value.trim();
      const bio = document.getElementById('bio').value.trim();
      const avatarUrl = document.getElementById('avatarUrl').value.trim() || null;
      try {
        await api.upsertProfile({ id: userId, display_name: displayName, bio, avatar_url: avatarUrl, updated_at: new Date().toISOString() });
        ui.showToast('تم تحديث الملف الشخصي بنجاح', 'success');
        setTimeout(() => {
          window.location.href = 'profile.html';
        }, 1000);
      } catch (err) {
        ui.showToast('فشل التحديث: ' + err.message, 'error');
      }
    });
  });
})();