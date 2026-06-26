/* article.js
 * يعرض مقالة مفردة بناءً على المعرف الموجود في عنوان URL.
 */

(function() {
  document.addEventListener('DOMContentLoaded', async () => {
    const supabase = window.supabase;
    const api = window.supabaseApi;
    const ui = window.ui;
    const container = document.getElementById('articleContainer');
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
      container.innerHTML = '<p class="text-center text-gray-400">لم يتم تحديد المقال.</p>';
      return;
    }
    try {
      const article = await api.getArticleById(id);
      container.innerHTML = `
        <h1 class="text-3xl font-bold mb-2">${escapeHtml(article.title)}</h1>
        <p class="text-sm text-gray-500 mb-4">${new Date(article.created_at).toLocaleDateString('ar')}</p>
        <div class="prose prose-invert">
          ${escapeHtml(article.content).replace(/\n/g, '<br>')}
        </div>
      `;
    } catch (err) {
      ui.showToast('فشل تحميل المقال: ' + err.message, 'error');
      container.innerHTML = '<p class="text-center text-red-500">حدث خطأ.</p>';
    }
  });
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function(m) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[m];
    });
  }
})();