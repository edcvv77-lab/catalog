/* ticket.js
 * يعرض تفاصيل تذكرة دعم معينة ويسمح بإضافة ردود داخل التذكرة.
 */

(function() {
  document.addEventListener('DOMContentLoaded', async () => {
    const supabase = window.supabase;
    const api = window.supabaseApi;
    const ui = window.ui;
    const container = document.getElementById('ticketContainer');
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
      container.innerHTML = '<p class="text-center text-gray-400">لم يتم تحديد التذكرة.</p>';
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    async function loadTicket() {
      container.innerHTML = '';
      try {
        const ticket = await api.getTicketById(id);
        if (!ticket) {
          container.innerHTML = '<p class="text-center text-gray-400">التذكرة غير موجودة.</p>';
          return;
        }
        // عرض تفاصيل التذكرة
        const header = document.createElement('div');
        header.className = 'mb-4';
        header.innerHTML = `<h1 class="text-2xl font-bold mb-1">${escapeHtml(ticket.title)}</h1>
          <p class="text-sm text-gray-400">${escapeHtml(ticket.type)} • ${escapeHtml(ticket.status)}</p>
          <p class="text-xs text-gray-500">${new Date(ticket.created_at).toLocaleDateString('ar')}</p>`;
        container.appendChild(header);
        // الرسائل
        const messagesDiv = document.createElement('div');
        messagesDiv.id = 'ticketMessages';
        messagesDiv.className = 'space-y-2 mb-4';
        container.appendChild(messagesDiv);
        // نموذج الرد
        const formDiv = document.createElement('div');
        formDiv.className = 'mt-4';
        formDiv.innerHTML = `
          <form id="ticketReplyForm" class="flex gap-2">
            <input id="ticketReplyContent" type="text" class="flex-grow p-2 rounded bg-gray-700 text-gray-100" placeholder="اكتب ردًا...">
            <button type="submit" class="btn-custom">إرسال</button>
          </form>
        `;
        container.appendChild(formDiv);
        // تحميل الرسائل
        await loadMessages();
        // إرسال الرد
        const replyForm = document.getElementById('ticketReplyForm');
        replyForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const content = document.getElementById('ticketReplyContent').value.trim();
          if (!content) return;
          try {
            await api.addTicketMessage(id, content);
            document.getElementById('ticketReplyContent').value = '';
            await loadMessages();
          } catch (err) {
            ui.showToast('فشل إضافة الرد: ' + err.message, 'error');
          }
        });
      } catch (err) {
        ui.showToast('فشل تحميل التذكرة: ' + err.message, 'error');
      }
    }
    async function loadMessages() {
      const messagesDiv = document.getElementById('ticketMessages');
      messagesDiv.innerHTML = '';
      try {
        const { data, error } = await window.supabase
          .from('ticket_messages')
          .select('*, profiles:profiles!ticket_messages_sender_id_fkey (display_name, avatar_url)')
          .eq('ticket_id', id)
          .order('created_at', { ascending: true });
        if (error) throw error;
        (data || []).forEach(msg => {
          const div = document.createElement('div');
          div.className = 'bg-gray-800 bg-opacity-50 p-3 rounded';
          div.innerHTML = `<div class="flex items-center gap-2 mb-1">
            <img src="${msg.profiles?.avatar_url || '../assets/default-avatar.png'}" class="w-6 h-6 rounded-full">
            <strong>${escapeHtml(msg.profiles?.display_name || '')}</strong>
            <span class="text-xs text-gray-500">${new Date(msg.created_at).toLocaleDateString('ar')}</span>
          </div>
          <p>${escapeHtml(msg.content)}</p>`;
          messagesDiv.appendChild(div);
        });
      } catch (err) {
        ui.showToast('فشل تحميل الرسائل: ' + err.message, 'error');
      }
    }
    await loadTicket();
  });
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function(m) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[m];
    });
  }
})();