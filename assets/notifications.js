/* notifications.js
 * إدارة وعرض الإشعارات. يقوم بتحميل إشعارات المستخدم وتعليمها كمقروء.
 */

(function() {
  document.addEventListener('DOMContentLoaded', async () => {
    const supabase = window.supabase;
    const api = window.supabaseApi;
    const ui = window.ui;
    const container = document.getElementById('notificationsContainer');
    const markAllBtn = document.getElementById('markAllReadBtn');
    // session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    async function loadNotifications() {
      container.innerHTML = '';
      try {
        const notifications = await api.getNotifications();
        if (!notifications || notifications.length === 0) {
          container.innerHTML = '<p class="text-center text-gray-400">لا توجد إشعارات.</p>';
          return;
        }
        notifications.forEach(notif => {
          const div = document.createElement('div');
          div.className = `bg-gray-800 bg-opacity-50 p-4 rounded mb-2 ${notif.read_at ? 'opacity-70' : ''}`;
          div.innerHTML = `<h3 class="font-bold">${escapeHtml(notif.title || '')}</h3>
            <p class="text-gray-300">${escapeHtml(notif.body || '')}</p>
            <p class="text-xs text-gray-500">${new Date(notif.created_at).toLocaleString('ar')}</p>`;
          div.addEventListener('click', async () => {
            if (!notif.read_at) {
              await api.markNotificationAsRead(notif.id);
              div.classList.add('opacity-70');
            }
          });
          container.appendChild(div);
        });
      } catch (err) {
        ui.showToast('فشل تحميل الإشعارات: ' + err.message, 'error');
      }
    }
    await loadNotifications();
    markAllBtn?.addEventListener('click', async () => {
      try {
        const notifications = await api.getNotifications();
        await Promise.all(notifications.map(n => api.markNotificationAsRead(n.id)));
        ui.showToast('تم تعليم الكل كمقروء', 'success');
        await loadNotifications();
      } catch (err) {
        ui.showToast('فشل تعليم الكل: ' + err.message, 'error');
      }
    });
  });
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function(m) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[m];
    });
  }
})();