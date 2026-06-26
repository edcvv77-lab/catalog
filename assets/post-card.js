/* post-card.js
 * يحتوي على دالة لإنشاء عنصر منشور وعرضه داخل واجهة المستخدم.
 * يعتمد على كائن supabaseApi لتنفيذ التفاعلات.
 */

(function() {
  const api = window.supabaseApi;
  const ui = window.ui;

  /**
   * إنشاء بطاقة منشور وإرجاع عنصر DOM جاهز للإضافة إلى الصفحة
   * @param {Object} post سجل المنشور من قاعدة البيانات
   * @returns {HTMLElement}
   */
  window.renderPostCard = function(post) {
    const card = document.createElement('div');
    card.className = 'bg-gray-800 bg-opacity-50 p-4 rounded-lg space-y-3';
    // العنوان والمحتوى
    const header = document.createElement('div');
    header.className = 'flex items-center gap-2';
    const avatar = document.createElement('img');
    avatar.src = post.profiles?.avatar_url || '../assets/default-avatar.png';
    avatar.alt = 'avatar';
    avatar.className = 'w-8 h-8 rounded-full';
    const authorInfo = document.createElement('div');
    authorInfo.innerHTML = `<strong>${escapeHtml(post.profiles?.display_name || '')}</strong><br><small class="text-gray-400">${formatDate(post.created_at)}</small>`;
    header.appendChild(avatar);
    header.appendChild(authorInfo);
    card.appendChild(header);
    const content = document.createElement('p');
    content.textContent = post.content;
    card.appendChild(content);
    // صورة إن وجدت
    if (post.image_url) {
      const img = document.createElement('img');
      img.src = post.image_url;
      img.alt = 'post-image';
      img.className = 'mt-2 rounded-lg max-h-60 object-cover';
      card.appendChild(img);
    }
    // الأزرار (تفاعلات وحذف) في أسفل البطاقة
    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-4 mt-2 text-sm';
    // زر الإعجاب
    const likeBtn = document.createElement('button');
    likeBtn.className = 'text-blue-400 hover:text-blue-500';
    likeBtn.innerHTML = '👍';
    likeBtn.onclick = async () => {
      try {
        await api.addPostReaction(post.id, '👍');
        ui.showToast('تم تسجيل إعجابك', 'success');
      } catch (err) {
        ui.showToast('فشل التفاعل: ' + err.message, 'error');
      }
    };
    actions.appendChild(likeBtn);
    // زر التعليقات
    const commentBtn = document.createElement('a');
    commentBtn.href = `post.html?id=${post.id}`;
    commentBtn.className = 'text-blue-400 hover:text-blue-500';
    commentBtn.textContent = 'التعليقات';
    actions.appendChild(commentBtn);
    // يمكن إضافة زر حذف هنا لاحقًا في حال تفعيل الصلاحيات للمؤلفين والمشرفين
    card.appendChild(actions);
    return card;
  };
  // helper
  function formatDate(ts) {
    return new Date(ts).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });
  }
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function(m) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[m];
    });
  }
})();