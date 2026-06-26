/* feed.js
 * يدير صفحة المنشورات. يقوم بجلب المنشورات من قاعدة البيانات وعرضها، كما يسمح بإنشاء منشور جديد.
 */

(function() {
  document.addEventListener('DOMContentLoaded', async () => {
    const supabase = window.supabase;
    const api = window.supabaseApi;
    const ui = window.ui;
    const postsContainer = document.getElementById('postsContainer');
    const modal = document.getElementById('postModal');
    const form = document.getElementById('postForm');
    const newPostBtn = document.getElementById('newPostBtn');
    const cancelBtn = document.getElementById('cancelPostBtn');
    // تحقق من الجلسة
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    // تحميل المنشورات عند التحميل الأول
    async function loadPosts() {
      postsContainer.innerHTML = '';
      try {
        const posts = await api.getPosts({ type: 'all', limit: 100 });
        posts.forEach((post) => {
          const card = window.renderPostCard(post);
          postsContainer.appendChild(card);
        });
      } catch (err) {
        ui.showToast('فشل تحميل المنشورات: ' + err.message, 'error');
      }
    }
    await loadPosts();
    // فتح وإغلاق النافذة
    newPostBtn.addEventListener('click', () => {
      modal.classList.remove('hidden');
    });
    cancelBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
    // إرسال المنشور
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = document.getElementById('postContent').value.trim();
      const imageUrl = document.getElementById('postImageUrl').value.trim() || null;
      if (!content) {
        ui.showToast('لا يمكن ترك النص فارغًا', 'error');
        return;
      }
      try {
        await api.createPost({ content, imageUrl, postType: 'text' });
        ui.showToast('تم نشر المنشور', 'success');
        // إعادة تحميل
        modal.classList.add('hidden');
        form.reset();
        await loadPosts();
      } catch (err) {
        ui.showToast('فشل النشر: ' + err.message, 'error');
      }
    });
  });
})();