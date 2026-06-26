/* leaderboard.js
 * يعرض المستخدمين الأعلى سمعة أو نشاطاً. يستخدم getLeaderboard من supabaseApi.
 */

(function() {
  document.addEventListener('DOMContentLoaded', async () => {
    const supabase = window.supabase;
    const api = window.supabaseApi;
    const ui = window.ui;
    const container = document.getElementById('leaderboardContainer');
    // session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    try {
      const entries = await api.getLeaderboard({ limit: 20 });
      if (!entries || entries.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400">لا توجد بيانات بعد.</p>';
        return;
      }
      const list = document.createElement('ol');
      list.className = 'space-y-2';
      let rank = 1;
      for (const e of entries) {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between bg-gray-800 bg-opacity-50 p-3 rounded';
        const profileLink = document.createElement('a');
        profileLink.href = `profile.html?id=${e.user_id}`;
        profileLink.className = 'font-bold text-blue-400 hover:underline';
        profileLink.textContent = `#${rank}`;
        const info = document.createElement('span');
        info.textContent = `رسائل: ${e.messages_count || 0} • منشورات: ${e.posts_count || 0} • سمعة: ${e.reputation || 0}`;
        li.appendChild(profileLink);
        li.appendChild(info);
        list.appendChild(li);
        rank++;
      }
      container.appendChild(list);
    } catch (err) {
      ui.showToast('فشل تحميل لوحة الصدارة: ' + err.message, 'error');
    }
  });
})();