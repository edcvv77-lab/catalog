/* knowledge.js
 * يدير مركز المعرفة: يعرض التصنيفات والمقالات ويسمح بإنشاء مقالات جديدة.
 */

(function() {
  document.addEventListener('DOMContentLoaded', async () => {
    const supabase = window.supabase;
    const api = window.supabaseApi;
    const ui = window.ui;
    const container = document.getElementById('knowledgeContainer');
    const modal = document.getElementById('articleModal');
    const form = document.getElementById('articleForm');
    const categorySelect = document.getElementById('articleCategory');
    const cancelBtn = document.getElementById('cancelArticleBtn');
    const newBtn = document.getElementById('newArticleBtn');
    // session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    let categories = [];
    let articles = [];
    async function loadCategories() {
      try {
        categories = await api.getKnowledgeCategories();
        // populate select
        categorySelect.innerHTML = '';
        categories.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat.id;
          option.textContent = cat.name;
          categorySelect.appendChild(option);
        });
      } catch (err) {
        ui.showToast('خطأ في تحميل التصنيفات', 'error');
      }
    }
    async function loadArticles(categoryId = null) {
      container.innerHTML = '';
      try {
        articles = await api.getArticles({ categoryId });
        if (articles.length === 0) {
          container.innerHTML = '<p class="text-center text-gray-400">لا توجد مقالات.</p>';
          return;
        }
        articles.forEach(article => {
          const div = document.createElement('div');
          div.className = 'bg-gray-800 bg-opacity-50 p-4 rounded mb-2';
          div.innerHTML = `<h3 class="font-bold"><a href="article.html?id=${article.id}" class="hover:underline">${escapeHtml(article.title)}</a></h3>
            <p class="text-xs text-gray-500">${new Date(article.created_at).toLocaleDateString('ar')}</p>`;
          container.appendChild(div);
        });
      } catch (err) {
        ui.showToast('فشل تحميل المقالات: ' + err.message, 'error');
      }
    }
    await loadCategories();
    await loadArticles();
    // زر إنشاء
    newBtn?.addEventListener('click', () => {
      modal.classList.remove('hidden');
    });
    cancelBtn?.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('articleTitle').value.trim();
      const content = document.getElementById('articleContent').value.trim();
      const catId = categorySelect.value;
      if (!title || !content || !catId) {
        ui.showToast('يرجى تعبئة جميع الحقول', 'error');
        return;
      }
      try {
        await api.createArticle({ title, content, categoryId: catId });
        ui.showToast('تم إنشاء المقال', 'success');
        modal.classList.add('hidden');
        form.reset();
        await loadArticles(catId);
      } catch (err) {
        ui.showToast('فشل الإنشاء: ' + err.message, 'error');
      }
    });
  });
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function(m) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[m];
    });
  }
})();