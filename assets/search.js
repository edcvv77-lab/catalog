/* search.js
 * يوفر محرك بحث موحد على مستوى المنصة. يبحث في المستخدمين والغرف والمنشورات والمقالات.
 */

(function() {
  document.addEventListener('DOMContentLoaded', async () => {
    const supabase = window.supabase;
    const api = window.supabaseApi;
    const ui = window.ui;
    const input = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('searchResults');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    // دالة تأخير بسيطة لمنع تنفيذ البحث مع كل حرف
    const debounce = (func, delay) => {
      let timer;
      return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
      };
    };
    input.addEventListener('input', debounce(async (e) => {
      const term = e.target.value.trim();
      if (!term) {
        resultsDiv.innerHTML = '';
        return;
      }
      resultsDiv.innerHTML = '<p class="text-gray-400">جاري البحث...</p>';
      try {
        const results = await api.searchAll(term);
        renderResults(results);
      } catch (err) {
        ui.showToast('فشل البحث: ' + err.message, 'error');
        resultsDiv.innerHTML = '';
      }
    }, 500));
    function renderResults(results) {
      resultsDiv.innerHTML = '';
      const sections = [
        { key: 'users', title: 'المستخدمون', urlPrefix: 'profile.html?id=' },
        { key: 'rooms', title: 'الغرف', urlPrefix: 'chat.html?room=' },
        { key: 'posts', title: 'المنشورات', urlPrefix: 'post.html?id=' },
        { key: 'articles', title: 'المقالات', urlPrefix: 'article.html?id=' }
      ];
      let hasAny = false;
      sections.forEach(section => {
        const items = results[section.key];
        if (items && items.length > 0) {
          hasAny = true;
          const sec = document.createElement('div');
          sec.className = 'mb-4';
          sec.innerHTML = `<h3 class="font-bold mb-2">${section.title}</h3>`;
          items.forEach(item => {
            const link = document.createElement('a');
            link.className = 'block mb-1 text-blue-400 hover:underline';
            link.href = `${section.urlPrefix}${item.id}`;
            const label = section.key === 'users' ? item.display_name : (section.key === 'rooms' ? item.name : (section.key === 'posts' ? item.content.substring(0, 50) : item.title));
            link.textContent = label;
            sec.appendChild(link);
          });
          resultsDiv.appendChild(sec);
        }
      });
      if (!hasAny) {
        resultsDiv.innerHTML = '<p class="text-gray-400">لا توجد نتائج.</p>';
      }
    }
  });
})();