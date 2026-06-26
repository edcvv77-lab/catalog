/* tasks.js
 * يوفّر واجهة بسيطة لإدارة المهام داخل المشاريع. يعرض قائمة المهام ويسمح بإنشاء مهام جديدة.
 */

(function() {
  document.addEventListener('DOMContentLoaded', async () => {
    const supabase = window.supabase;
    const api = window.supabaseApi;
    const ui = window.ui;
    const tasksContainer = document.getElementById('tasksContainer');
    const newTaskBtn = document.getElementById('newTaskBtn');
    const modal = document.getElementById('taskModal');
    const form = document.getElementById('taskForm');
    const cancelBtn = document.getElementById('cancelTaskBtn');
    const assigneeSelect = document.getElementById('taskAssignee');
    const prioritySelect = document.getElementById('taskPriority');
    const statusSelect = document.getElementById('taskStatus');
    // session check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    // load projects and tasks
    let projects = [];
    let currentProjectId = null;
    async function loadProjects() {
      try {
        projects = await api.getProjects();
        if (projects.length > 0) {
          currentProjectId = projects[0].id;
        }
      } catch (err) {
        ui.showToast('خطأ في تحميل المشاريع', 'error');
      }
    }
    async function loadTasks() {
      tasksContainer.innerHTML = '';
      if (!currentProjectId) {
        tasksContainer.innerHTML = '<p class="text-center text-gray-400">لا توجد مشاريع بعد.</p>';
        return;
      }
      try {
        const tasks = await api.getTasks(currentProjectId);
        if (tasks.length === 0) {
          tasksContainer.innerHTML = '<p class="text-center text-gray-400">لا توجد مهام في هذا المشروع.</p>';
        } else {
          tasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'bg-gray-800 bg-opacity-50 p-4 rounded mb-2';
            item.innerHTML = `<h3 class="font-bold">${escapeHtml(task.title)}</h3>
              <p class="text-gray-400 text-sm">${escapeHtml(task.description || '')}</p>
              <p class="text-xs text-gray-500 mt-1">${task.status} • ${task.priority}</p>`;
            tasksContainer.appendChild(item);
          });
        }
      } catch (err) {
        ui.showToast('خطأ في تحميل المهام', 'error');
      }
    }
    await loadProjects();
    await loadTasks();
    // load assignees
    async function loadUsers() {
      try {
        const users = await api.getUsers({ limit: 100 });
        assigneeSelect.innerHTML = '<option value="">بدون تعيين</option>';
        users.forEach(u => {
          const option = document.createElement('option');
          option.value = u.id;
          option.textContent = u.display_name || u.username;
          assigneeSelect.appendChild(option);
        });
      } catch {}
    }
    await loadUsers();
    // modal
    newTaskBtn.addEventListener('click', () => {
      if (!currentProjectId) {
        ui.showToast('يجب إنشاء مشروع أولاً', 'error');
        return;
      }
      modal.classList.remove('hidden');
    });
    cancelBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
    // submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('taskTitle').value.trim();
      const description = document.getElementById('taskDescription').value.trim();
      const assigneeId = assigneeSelect.value || null;
      const priority = prioritySelect.value;
      const status = statusSelect.value;
      if (!title) {
        ui.showToast('العنوان مطلوب', 'error');
        return;
      }
      try {
        await api.createTask(currentProjectId, { title, description, assigneeId, priority, status });
        ui.showToast('تم إنشاء المهمة', 'success');
        modal.classList.add('hidden');
        form.reset();
        await loadTasks();
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