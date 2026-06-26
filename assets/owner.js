/* owner.js
 *
 * سكربت لإدارة لوحة المالك المتقدمة. يوفر أقسام متعددة (الرئيسية، المستخدمون، الغرف، البلاغات، الإعلانات، الإعدادات، السجل، الصحة)
 * يعتمد على supabaseApi للتعامل مع قاعدة البيانات، وعلى utils للتنسيق.
 */

(function() {
  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase || !window.supabaseApi || !window.utils) {
      console.error('الملفات المطلوبة غير متوفرة');
      return;
    }
    const supabase = window.supabase;
    const api = window.supabaseApi;
    const utils = window.utils;

    // واجهة المستخدم للمودال والتنبيهات
    const ui = window.ui || {};
    /**
     * إظهار رسالة Toast موحدة في لوحة المالك
     * @param {string} message
     * @param {string} type
     */
    function showToast(message, type = 'info') {
      if (ui.showToast) {
        ui.showToast(message, type);
      } else {
        // احتياطي: استخدام alert
        console.info(`[${type}]`, message);
      }
    }

    // عناصر الصفحة
    const navButtons = document.querySelectorAll('.owner-nav-item');
    const sections = document.querySelectorAll('.owner-section');
    const ownerSignOut = document.getElementById('ownerSignOut');
    const openSidebarBtn = document.getElementById('openSidebarBtn');
    const ownerSidebar = document.getElementById('ownerSidebar');

    // Dashboard elements
    const dashboardCards = document.getElementById('dashboardCards');

    // Users elements
    const userSearchInput = document.getElementById('userSearchInput');
    const usersTable = document.getElementById('usersTable');

    // Rooms elements
    const ownerCreateRoomBtn = document.getElementById('ownerCreateRoomBtn');
    const roomsTable = document.getElementById('roomsTable');
    const ownerCreateRoomModal = document.getElementById('ownerCreateRoomModal');
    const ownerNewRoomNameInput = document.getElementById('ownerNewRoomNameInput');
    const ownerNewRoomTypeSelect = document.getElementById('ownerNewRoomTypeSelect');
    const ownerCancelCreateRoom = document.getElementById('ownerCancelCreateRoom');
    const ownerConfirmCreateRoom = document.getElementById('ownerConfirmCreateRoom');

    // Reports elements
    const reportsList = document.getElementById('reportsList');

    // Announcements elements
    const createAnnouncementBtn = document.getElementById('createAnnouncementBtn');
    const announcementsList = document.getElementById('announcementsList');

    // Settings elements
    const settingsForm = document.getElementById('settingsForm');

    // Audit elements
    const auditLogs = document.getElementById('auditLogs');

    // Health elements
    const healthStatus = document.getElementById('healthStatus');

    let currentUser = null;

    /**
     * التحقق من أن المستخدم لديه صلاحية الوصول لهذه الصفحة
     */
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = 'login.html';
        return;
      }
      currentUser = user;
      // احصل على الملف الشخصي لمعرفة الدور
      let profile;
      try {
        profile = await api.getProfile(user.id);
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
      const role = profile?.role || 'user';
      if (!['admin', 'owner'].includes(role)) {
        // إعادة توجيه المستخدم العادي إلى الدردشة
        window.location.href = 'chat.html';
      }
    }

    /**
     * تغيير القسم الظاهر بناءً على الزر
     */
    function showSection(sectionId) {
      sections.forEach((sec) => {
        sec.classList.add('hidden');
      });
      const target = document.getElementById(sectionId);
      if (target) target.classList.remove('hidden');
      // إغلاق الشريط الجانبي على الجوال
      ownerSidebar.classList.add('hidden');
    }

    /**
     * تحميل وإظهار بيانات لوحة المعلومات
     */
    async function loadDashboard() {
      dashboardCards.innerHTML = '';
      // جلب الإحصائيات: المستخدمون، الغرف، الرسائل، البلاغات المفتوحة
      try {
        const [{ data: users }, { data: rooms }, { data: messages }, { data: openReports }] = await Promise.all([
          supabase.from('profiles').select('id'),
          supabase.from('rooms').select('id'),
          supabase.from('messages').select('id'),
          supabase.from('reports').select('id').eq('status', 'open')
        ]);
        const stats = [
          { title: 'المستخدمون', count: users?.length || 0 },
          { title: 'الغرف', count: rooms?.length || 0 },
          { title: 'الرسائل', count: messages?.length || 0 },
          { title: 'البلاغات المفتوحة', count: openReports?.length || 0 }
        ];
        stats.forEach((item) => {
          const card = document.createElement('div');
          card.className = 'p-4 bg-gray-800 bg-opacity-40 rounded shadow';
          card.innerHTML = `<h4 class="text-lg font-semibold mb-2">${item.title}</h4><p class="text-3xl font-bold">${item.count}</p>`;
          dashboardCards.appendChild(card);
        });
      } catch (error) {
        dashboardCards.textContent = 'حدث خطأ أثناء تحميل البيانات.';
      }
    }

    /**
     * تحميل قائمة المستخدمين وعرضهم
     */
    async function loadUsers(search = '') {
      usersTable.innerHTML = 'جاري التحميل...';
      try {
        const users = await api.getUsers({ search, limit: 100 });
        const table = document.createElement('table');
        table.className = 'min-w-full text-sm';
        const thead = document.createElement('thead');
        thead.innerHTML = '<tr><th class="p-2">المستخدم</th><th class="p-2">الدور</th><th class="p-2">الحالة</th><th class="p-2">إجراءات</th></tr>';
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        users.forEach((u) => {
          const tr = document.createElement('tr');
          tr.className = 'border-b border-gray-700';
          // Name
          const nameTd = document.createElement('td');
          nameTd.className = 'p-2';
          nameTd.textContent = u.display_name || u.username || u.id;
          tr.appendChild(nameTd);
          // Role select
          const roleTd = document.createElement('td');
          roleTd.className = 'p-2';
          const roleSelect = document.createElement('select');
          ['user','moderator','admin','owner'].forEach((r) => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            if (u.role === r) opt.selected = true;
            roleSelect.appendChild(opt);
          });
          roleSelect.addEventListener('change', async (e) => {
            try {
              await api.updateUserRole(u.id, e.target.value);
              showToast('تم تحديث الدور');
            } catch (error) {
              console.error(error);
              showToast('تعذر تحديث الدور');
            }
          });
          roleTd.appendChild(roleSelect);
          tr.appendChild(roleTd);
          // Status select
          const statusTd = document.createElement('td');
          statusTd.className = 'p-2';
          const statusSelect = document.createElement('select');
          ['active','muted','banned','suspended'].forEach((s) => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            if (u.status === s) opt.selected = true;
            statusSelect.appendChild(opt);
          });
          statusSelect.addEventListener('change', async (e) => {
            try {
              await api.updateUserStatus(u.id, e.target.value);
              showToast('تم تحديث الحالة');
            } catch (error) {
              console.error(error);
              showToast('تعذر تحديث الحالة');
            }
          });
          statusTd.appendChild(statusSelect);
          tr.appendChild(statusTd);
          // Actions
          const actionsTd = document.createElement('td');
          actionsTd.className = 'p-2';
          const viewBtn = document.createElement('button');
          viewBtn.className = 'underline text-blue-400';
          viewBtn.textContent = 'عرض';
          viewBtn.addEventListener('click', () => {
            showToast('عرض ملف المستخدم قيد التطوير');
          });
          actionsTd.appendChild(viewBtn);
          tr.appendChild(actionsTd);
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        usersTable.innerHTML = '';
        usersTable.appendChild(table);
      } catch (error) {
        usersTable.textContent = 'حدث خطأ أثناء تحميل المستخدمين';
      }
    }

    /**
     * تحميل قائمة الغرف وعرضها
     */
    async function loadRoomsAdmin() {
      roomsTable.innerHTML = 'جاري التحميل...';
      try {
        const rooms = await api.getRooms({ limit: 100 });
        const table = document.createElement('table');
        table.className = 'min-w-full text-sm';
        const thead = document.createElement('thead');
        thead.innerHTML = '<tr><th class="p-2">الغرفة</th><th class="p-2">النوع</th><th class="p-2">وضع البطء (ثانية)</th><th class="p-2">قفل</th><th class="p-2">أرشفة</th><th class="p-2">إجراءات</th></tr>';
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        rooms.forEach((room) => {
          const tr = document.createElement('tr');
          tr.className = 'border-b border-gray-700';
          // name
          const nameTd = document.createElement('td');
          nameTd.className = 'p-2';
          nameTd.textContent = room.name;
          tr.appendChild(nameTd);
          // type
          const typeTd = document.createElement('td');
          typeTd.className = 'p-2';
          typeTd.textContent = room.type;
          tr.appendChild(typeTd);
          // slow mode input
          const slowTd = document.createElement('td');
          slowTd.className = 'p-2';
          const slowInput = document.createElement('input');
          slowInput.type = 'number';
          slowInput.min = '0';
          slowInput.value = room.slow_mode_seconds;
          slowInput.className = 'w-20 p-1 rounded';
          slowInput.addEventListener('change', async (e) => {
            const newValue = parseInt(e.target.value, 10);
            try {
              await supabase.from('rooms').update({ slow_mode_seconds: newValue }).eq('id', room.id);
              showToast('تم تحديث وضع البطء');
            } catch (error) {
              console.error(error);
              showToast('تعذر تحديث وضع البطء');
            }
          });
          slowTd.appendChild(slowInput);
          tr.appendChild(slowTd);
          // lock toggle
          const lockTd = document.createElement('td');
          lockTd.className = 'p-2';
          const lockCheckbox = document.createElement('input');
          lockCheckbox.type = 'checkbox';
          lockCheckbox.checked = room.is_locked;
          lockCheckbox.addEventListener('change', async (e) => {
            try {
              await supabase.from('rooms').update({ is_locked: e.target.checked }).eq('id', room.id);
              showToast('تم تغيير حالة القفل');
            } catch (error) {
              console.error(error);
              showToast('تعذر تحديث القفل');
            }
          });
          lockTd.appendChild(lockCheckbox);
          tr.appendChild(lockTd);
          // archive toggle
          const archiveTd = document.createElement('td');
          archiveTd.className = 'p-2';
          const archiveCheckbox = document.createElement('input');
          archiveCheckbox.type = 'checkbox';
          archiveCheckbox.checked = room.is_archived;
          archiveCheckbox.addEventListener('change', async (e) => {
            try {
              await supabase.from('rooms').update({ is_archived: e.target.checked }).eq('id', room.id);
              showToast('تم تحديث حالة الأرشفة');
            } catch (error) {
              console.error(error);
              showToast('تعذر تحديث الأرشفة');
            }
          });
          archiveTd.appendChild(archiveCheckbox);
          tr.appendChild(archiveTd);
          // actions
          const actionsTd = document.createElement('td');
          actionsTd.className = 'p-2';
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'text-red-500 underline';
          deleteBtn.textContent = 'حذف';
          deleteBtn.addEventListener('click', async () => {
            if (!confirm('هل أنت متأكد من حذف الغرفة؟')) return;
            try {
              await supabase.from('rooms').delete().eq('id', room.id);
              showToast('تم حذف الغرفة');
              loadRoomsAdmin();
            } catch (error) {
              console.error(error);
              showToast('تعذر حذف الغرفة');
            }
          });
          actionsTd.appendChild(deleteBtn);
          tr.appendChild(actionsTd);
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        roomsTable.innerHTML = '';
        roomsTable.appendChild(table);
      } catch (error) {
        roomsTable.textContent = 'حدث خطأ أثناء تحميل الغرف';
      }
    }

    /**
     * تحميل البلاغات المفتوحة
     */
    async function loadReports() {
      reportsList.innerHTML = 'جاري التحميل...';
      try {
        const { data, error } = await supabase
          .from('reports')
          .select('*, reporter:profiles!reports_reporter_id_fkey (display_name)')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        reportsList.innerHTML = '';
        data.forEach((rep) => {
          const div = document.createElement('div');
          div.className = 'p-4 bg-gray-800 bg-opacity-40 rounded';
          div.innerHTML = `<p class="mb-1"><strong>النوع:</strong> ${rep.target_type}</p>
                           <p class="mb-1"><strong>السبب:</strong> ${rep.reason || '—'}</p>
                           <p class="mb-1"><strong>المُبلِّغ:</strong> ${rep.reporter?.display_name || rep.reporter_id}</p>
                           <p class="mb-1"><strong>الحالة:</strong> ${rep.status}</p>`;
          const actions = document.createElement('div');
          actions.className = 'mt-2 flex gap-2';
          const resolveBtn = document.createElement('button');
          resolveBtn.className = 'btn-custom';
          resolveBtn.textContent = 'حلّ البلاغ';
          resolveBtn.addEventListener('click', async () => {
            try {
              await supabase.from('reports').update({ status: 'resolved' }).eq('id', rep.id);
              showToast('تم حل البلاغ');
              loadReports();
            } catch (err) {
              console.error(err);
              showToast('تعذر حل البلاغ');
            }
          });
          const rejectBtn = document.createElement('button');
          rejectBtn.className = 'bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded';
          rejectBtn.textContent = 'رفض';
          rejectBtn.addEventListener('click', async () => {
            try {
              await supabase.from('reports').update({ status: 'rejected' }).eq('id', rep.id);
              showToast('تم رفض البلاغ');
              loadReports();
            } catch (err) {
              console.error(err);
              showToast('تعذر رفض البلاغ');
            }
          });
          actions.appendChild(resolveBtn);
          actions.appendChild(rejectBtn);
          div.appendChild(actions);
          reportsList.appendChild(div);
        });
      } catch (error) {
        reportsList.textContent = 'حدث خطأ أثناء تحميل البلاغات';
      }
    }

    /**
     * تحميل الإعلانات
     */
    async function loadAnnouncements() {
      announcementsList.innerHTML = 'جاري التحميل...';
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        announcementsList.innerHTML = '';
        data.forEach((ann) => {
          const div = document.createElement('div');
          div.className = 'p-4 bg-gray-800 bg-opacity-40 rounded';
          div.innerHTML = `<h4 class="text-lg font-semibold mb-1">${ann.title}</h4>
                           <p class="mb-1">${ann.body}</p>
                           <p class="text-xs opacity-70">${utils.formatTime(ann.created_at)}</p>`;
          const actions = document.createElement('div');
          actions.className = 'mt-2 flex gap-2';
          const toggleBtn = document.createElement('button');
          toggleBtn.className = 'btn-custom';
          toggleBtn.textContent = ann.active ? 'إلغاء تفعيل' : 'تفعيل';
          toggleBtn.addEventListener('click', async () => {
            try {
              await supabase.from('announcements').update({ active: !ann.active }).eq('id', ann.id);
              loadAnnouncements();
            } catch (err) {
              console.error(err);
              showToast('تعذر تغيير حالة الإعلان');
            }
          });
          actions.appendChild(toggleBtn);
          div.appendChild(actions);
          announcementsList.appendChild(div);
        });
      } catch (error) {
        announcementsList.textContent = 'حدث خطأ أثناء تحميل الإعلانات';
      }
    }

    /**
     * تحميل الإعدادات وعرضها
     */
    async function loadSettings() {
      settingsForm.innerHTML = 'جاري التحميل...';
      try {
        // جلب جميع الإعدادات
        const { data, error } = await supabase.from('owner_settings').select('*');
        if (error) throw error;
        const values = {};
        data.forEach((item) => {
          values[item.key] = item.value;
        });
        settingsForm.innerHTML = '';
        // تعريف الإعدادات المرغوبة
        const fields = [
          { key: 'platform_name', label: 'اسم المنصة', type: 'text', placeholder: 'اسم المنصة' },
          { key: 'platform_description', label: 'وصف المنصة', type: 'textarea', placeholder: 'وصف مختصر' },
          { key: 'max_message_length', label: 'أقصى طول للرسالة', type: 'number', placeholder: '' },
          { key: 'max_messages_per_minute', label: 'أقصى عدد رسائل في الدقيقة', type: 'number', placeholder: '' },
          { key: 'forbidden_words', label: 'الكلمات المحظورة (مفصولة بفاصلة)', type: 'text', placeholder: 'مثال: كلمة1,كلمة2' },
          { key: 'welcome_message', label: 'رسالة الترحيب', type: 'textarea', placeholder: 'رسالة ترحيب تظهر للزوار الجدد' },
          { key: 'primary_color', label: 'اللون الأساسي', type: 'color', placeholder: '' },
          { key: 'maintenance_mode', label: 'وضع الصيانة', type: 'checkbox', placeholder: '' },
          { key: 'maintenance_message', label: 'رسالة وضع الصيانة', type: 'textarea', placeholder: 'سيتم عرضها في حال تفعيل الصيانة' }
        ];
        fields.forEach((field) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'mb-4';
          const label = document.createElement('label');
          label.className = 'block mb-1 font-semibold';
          label.textContent = field.label;
          wrapper.appendChild(label);
          let input;
          const value = values[field.key] !== undefined ? values[field.key] : (field.type === 'checkbox' ? false : '');
          if (field.type === 'textarea') {
            input = document.createElement('textarea');
            input.rows = 3;
            input.className = 'w-full p-2 rounded';
            input.value = value || '';
          } else if (field.type === 'checkbox') {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!value;
          } else {
            input = document.createElement('input');
            input.type = field.type;
            input.className = 'w-full p-2 rounded';
            input.value = value || '';
          }
          input.dataset.key = field.key;
          wrapper.appendChild(input);
          settingsForm.appendChild(wrapper);
        });
        // حفظ
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-custom';
        saveBtn.textContent = 'حفظ الإعدادات';
        saveBtn.addEventListener('click', async () => {
          const updates = [];
          settingsForm.querySelectorAll('[data-key]').forEach((el) => {
            const key = el.dataset.key;
            let val;
            if (el.type === 'checkbox') {
              val = el.checked;
            } else {
              val = el.value;
              if (el.type === 'number') val = parseInt(val, 10);
            }
            updates.push({ key, value: val });
          });
          try {
            // upsert each setting
            for (const item of updates) {
              await supabase.from('owner_settings').upsert({ key: item.key, value: item.value, updated_at: new Date().toISOString() });
            }
            showToast('تم حفظ الإعدادات');
          } catch (error) {
            console.error(error);
            showToast('تعذر حفظ الإعدادات');
          }
        });
        settingsForm.appendChild(saveBtn);
      } catch (error) {
        settingsForm.textContent = 'حدث خطأ أثناء تحميل الإعدادات';
      }
    }

    /**
     * تحميل سجلات الإدارة
     */
    async function loadAudit() {
      auditLogs.innerHTML = 'جاري التحميل...';
      try {
        const { data, error } = await supabase
          .from('moderation_logs')
          .select('*, actor:profiles!moderation_logs_actor_id_fkey (display_name)')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        auditLogs.innerHTML = '';
        data.forEach((log) => {
          const div = document.createElement('div');
          div.className = 'p-3 bg-gray-800 bg-opacity-40 rounded';
          div.innerHTML = `<p><strong>${log.actor?.display_name || log.actor_id}</strong> قام بـ <strong>${log.action}</strong></p>
                           <p class="text-xs opacity-70">${utils.formatTime(log.created_at)}</p>
                           <p class="text-xs">${log.reason || ''}</p>`;
          auditLogs.appendChild(div);
        });
      } catch (error) {
        auditLogs.textContent = 'حدث خطأ أثناء تحميل السجل';
      }
    }

    /**
     * تحميل حالة الصحة
     */
    async function loadHealth() {
      healthStatus.innerHTML = '';
      try {
        const tests = [];
        // اختبار اتصال Supabase
        tests.push(supabase.from('rooms').select('id').limit(1));
        // اختبار جدول الرسائل
        tests.push(supabase.from('messages').select('id').limit(1));
        // اختبار جدول المستخدمين
        tests.push(supabase.from('profiles').select('id').limit(1));
        const results = await Promise.allSettled(tests);
        results.forEach((res, idx) => {
          const div = document.createElement('div');
          div.className = 'p-3 rounded';
          let testName;
          if (idx === 0) testName = 'اتصال قاعدة البيانات';
          if (idx === 1) testName = 'جدول الرسائل';
          if (idx === 2) testName = 'جدول المستخدمين';
          if (res.status === 'fulfilled' && !res.value.error) {
            div.classList.add('bg-green-800');
            div.textContent = `${testName}: ✔️`;
          } else {
            div.classList.add('bg-red-800');
            div.textContent = `${testName}: ❌`;
          }
          healthStatus.appendChild(div);
        });
        // تحقق من إعداد supabase-config
        if (!supabase || !supabase.url) {
          const warn = document.createElement('div');
          warn.className = 'p-3 bg-yellow-800 rounded mt-2';
          warn.textContent = 'تحذير: لم يتم إعداد supabase-config.js بشكل صحيح';
          healthStatus.appendChild(warn);
        }
      } catch (error) {
        healthStatus.textContent = 'حدث خطأ أثناء إجراء فحوص الصحة';
      }
    }

    /**
     * تحميل عناصر قسم المجتمع (المنشورات، التعليقات، البلاغات، الإعلانات)
     * في هذه النسخة التجريبية يتم عرض تنبيه للمطورين مع روابط سريعة للقوائم الخاصة.
     */
    async function loadCommunity() {
      const container = document.getElementById('communityControls');
      container.innerHTML = '';
      const info = document.createElement('div');
      info.className = 'p-4 bg-gray-800 bg-opacity-40 rounded';
      info.innerHTML = `<p>هذا القسم تحت الإنشاء. ستتمكن قريبًا من إدارة المنشورات والتعليقات والبلاغات والإعلانات من هنا.</p>
        <p class="mt-2">يمكنك حالياً استخدام أقسام البلاغات والإعلانات الموجودة.</p>`;
      container.appendChild(info);
    }

    /**
     * تحميل قسم المشاريع (قائمة المشاريع وإدارتها)
     */
    async function loadProjectsAdminPanel() {
      const container = document.getElementById('projectsAdmin');
      container.innerHTML = '';
      try {
        const projects = await api.getProjects();
        if (!projects || projects.length === 0) {
          container.innerHTML = '<p class="text-gray-400">لا توجد مشاريع.</p>';
          return;
        }
        projects.forEach((proj) => {
          const div = document.createElement('div');
          div.className = 'p-3 bg-gray-800 bg-opacity-40 rounded mb-2';
          div.innerHTML = `<h4 class="font-semibold">${proj.name}</h4>
            <p class="text-sm text-gray-400">${proj.description || ''}</p>
            <p class="text-xs text-gray-500">${proj.status}</p>`;
          container.appendChild(div);
        });
      } catch (err) {
        container.innerHTML = '<p class="text-red-500">فشل تحميل المشاريع</p>';
      }
    }

    /**
     * تحميل قسم الدعم (التذاكر)
     */
    async function loadSupportAdmin() {
      const container = document.getElementById('supportAdmin');
      container.innerHTML = '';
      try {
        const tickets = await api.getTickets();
        if (!tickets || tickets.length === 0) {
          container.innerHTML = '<p class="text-gray-400">لا توجد تذاكر.</p>';
          return;
        }
        tickets.forEach((ticket) => {
          const div = document.createElement('div');
          div.className = 'p-3 bg-gray-800 bg-opacity-40 rounded mb-2';
          div.innerHTML = `<h4 class="font-semibold"><a href="ticket.html?id=${ticket.id}" class="hover:underline">${ticket.title}</a></h4>
            <p class="text-sm text-gray-400">${ticket.type} • ${ticket.status}</p>
            <p class="text-xs text-gray-500">${new Date(ticket.created_at).toLocaleDateString('ar')}</p>`;
          container.appendChild(div);
        });
      } catch (err) {
        container.innerHTML = '<p class="text-red-500">فشل تحميل التذاكر</p>';
      }
    }

    /**
     * تحميل قسم الأمان (قيد التطوير)
     */
    async function loadSecurityAdmin() {
      const container = document.getElementById('securityAdmin');
      container.innerHTML = '';
      const msg = document.createElement('p');
      msg.className = 'text-gray-400';
      msg.textContent = 'هذا القسم قيد التطوير حالياً. سيكون مخصصاً لمراقبة عمليات الدخول، إعدادات الحظر والكتم، وقوائم الكلمات المحظورة.';
      container.appendChild(msg);
    }

    /**
     * تحميل قسم المحتوى (قيد التطوير)
     */
    async function loadContentAdmin() {
      const container = document.getElementById('contentAdmin');
      container.innerHTML = '';
      const msg = document.createElement('p');
      msg.className = 'text-gray-400';
      msg.textContent = 'قريبًا: إدارة المقالات، المنشورات المثبتة، والإعلانات من مكان واحد.';
      container.appendChild(msg);
    }

    /**
     * تحميل قسم الثيم (تغيير الألوان والثيمات)
     */
    async function loadThemeAdmin() {
      const container = document.getElementById('themeAdmin');
      container.innerHTML = '';
      const themeForm = document.createElement('div');
      themeForm.className = 'space-y-4';
      // اختيار الوضع (فاتح/داكن)
      const modeWrapper = document.createElement('div');
      modeWrapper.innerHTML = `<label class="block mb-1 font-semibold">وضع العرض</label>`;
      const modeSelect = document.createElement('select');
      modeSelect.className = 'p-2 rounded';
      ['dark','light'].forEach((m) => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m === 'dark' ? 'داكن' : 'فاتح';
        modeSelect.appendChild(opt);
      });
      modeWrapper.appendChild(modeSelect);
      themeForm.appendChild(modeWrapper);
      // اختيار اللون الأساسي
      const colorWrapper = document.createElement('div');
      colorWrapper.innerHTML = `<label class="block mb-1 font-semibold">اللون الأساسي</label>`;
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'w-16 h-8 p-0 rounded';
      colorWrapper.appendChild(colorInput);
      themeForm.appendChild(colorWrapper);
      // زر حفظ
      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn-custom';
      saveBtn.textContent = 'حفظ الثيم';
      saveBtn.addEventListener('click', () => {
        const mode = modeSelect.value;
        const color = colorInput.value;
        // تخزين في localStorage ليتم تطبيقه بواسطة load-settings.js
        localStorage.setItem('theme_mode', mode);
        localStorage.setItem('primary_color', color);
        showToast('تم حفظ الثيم. قد تحتاج لتحديث الصفحة لتطبيقه');
      });
      themeForm.appendChild(saveBtn);
      container.appendChild(themeForm);
    }

    // لاحظ: تم تعريف showToast أعلى الملف باستخدام ui.showToast

    // إدارة التنقل بين الأقسام
    navButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const target = btn.dataset.section + 'Section';
        showSection(target);
        // تحميل البيانات الخاصة بالقسم
        switch (btn.dataset.section) {
          case 'dashboard':
            loadDashboard();
            break;
          case 'users':
            loadUsers();
            break;
          case 'rooms':
            loadRoomsAdmin();
            break;
          case 'reports':
            loadReports();
            break;
          case 'announcements':
            loadAnnouncements();
            break;
          case 'settings':
            loadSettings();
            break;
          case 'audit':
            loadAudit();
            break;
          case 'health':
            loadHealth();
            break;
          case 'community':
            loadCommunity();
            break;
          case 'projects':
            loadProjectsAdminPanel();
            break;
          case 'support':
            loadSupportAdmin();
            break;
          case 'security':
            loadSecurityAdmin();
            break;
          case 'content':
            loadContentAdmin();
            break;
          case 'theme':
            loadThemeAdmin();
            break;
        }
      });
    });
    // فتح الشريط الجانبي على الجوال
    openSidebarBtn.addEventListener('click', () => {
      ownerSidebar.classList.toggle('hidden');
    });
    // تسجيل خروج
    ownerSignOut.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = 'login.html';
    });

    // البحث عن مستخدمين
    if (userSearchInput) {
      userSearchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        loadUsers(val);
      });
    }

    // إنشاء غرفة من لوحة المالك
    ownerCreateRoomBtn.addEventListener('click', () => {
      ownerCreateRoomModal.classList.remove('hidden');
      ownerNewRoomNameInput.value = '';
      ownerNewRoomTypeSelect.value = 'public';
    });
    ownerCancelCreateRoom.addEventListener('click', () => {
      ownerCreateRoomModal.classList.add('hidden');
    });
    ownerConfirmCreateRoom.addEventListener('click', async () => {
      const name = ownerNewRoomNameInput.value.trim();
      const type = ownerNewRoomTypeSelect.value;
      if (!name) {
        showToast('اسم الغرفة مطلوب');
        return;
      }
      const slug = utils.slugify(name);
      try {
        await api.createRoom({ name, slug, type });
        showToast('تم إنشاء الغرفة');
        ownerCreateRoomModal.classList.add('hidden');
        loadRoomsAdmin();
      } catch (error) {
        console.error(error);
        showToast('تعذر إنشاء الغرفة');
      }
    });

    // إنشاء إعلان
    createAnnouncementBtn.addEventListener('click', () => {
      // يمكن توسيع هذه الوظيفة لإنشاء إعلان
      const title = prompt('عنوان الإعلان:');
      if (!title) return;
      const body = prompt('نص الإعلان:');
      if (!body) return;
      supabase
        .from('announcements')
        .insert({ title, body, created_by: currentUser.id, audience: 'all' })
        .then(() => {
          showToast('تم إنشاء الإعلان');
          loadAnnouncements();
        })
        .catch((err) => {
          console.error(err);
          showToast('تعذر إنشاء الإعلان');
        });
    });

    // تشغيل الوصول والتحقق ثم تحميل القسم الافتراضي
    await checkAccess();
    // إظهار القسم الأول (لوحة المعلومات)
    showSection('dashboardSection');
    await loadDashboard();
  });
})();