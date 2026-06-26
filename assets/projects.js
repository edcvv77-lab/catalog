/* projects.js
 * إدارة المشاريع: جلب المشاريع الحالية، إنشاء مشاريع جديدة، وتحديث حالة المشروع.
 */

(function() {
  document.addEventListener('DOMContentLoaded', async () => {
    const supabase = window.supabase;
    const api = window.supabaseApi;
    const ui = window.ui;
    const projectsContainer = document.getElementById('projectsContainer');
    const newProjectBtn = document.getElementById('newProjectBtn');
    const modal = document.getElementById('projectModal');
    const form = document.getElementById('projectForm');
    const cancelBtn = document.getElementById('cancelProjectBtn');
    // session check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    async function loadProjects() {
      projectsContainer.innerHTML = '';
      try {
        const projects = await api.getProjects();
        if (projects.length === 0) {
          projectsContainer.innerHTML = '<p class="text-center text-gray-400">لا توجد مشاريع بعد.</p>';
          return;
        }
        projects.forEach(project => {
          const item = document.createElement('div');
          item.className = 'bg-gray-800 bg-opacity-50 p-4 rounded-lg space-y-1';
          item.innerHTML = `<h3 class="text-lg font-bold">${escapeHtml(project.name)}</h3>
            <p class="text-gray-400">${escapeHtml(project.description || '')}</p>
            <p class="text-xs text-gray-500">${project.status}</p>`;
          projectsContainer.appendChild(item);
        });
      } catch (err) {
        ui.showToast('فشل تحميل المشاريع: ' + err.message, 'error');
      }
    }
    await loadProjects();
    newProjectBtn.addEventListener('click', () => {
      modal.classList.remove('hidden');
    });
    cancelBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('projectName').value.trim();
      const description = document.getElementById('projectDescription').value.trim();
      const status = document.getElementById('projectStatus').value;
      if (!name) {
        ui.showToast('اسم المشروع مطلوب', 'error');
        return;
      }
      try {
        await api.createProject({ name, description, status });
        ui.showToast('تم إنشاء المشروع', 'success');
        modal.classList.add('hidden');
        form.reset();
        await loadProjects();
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