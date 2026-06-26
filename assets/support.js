/* support.js
 * يعرض تذاكر الدعم للمستخدم ويسمح بإنشاء تذاكر جديدة.
 */

(function() {
  document.addEventListener('DOMContentLoaded', async () => {
    const supabase = window.supabase;
    const api = window.supabaseApi;
    const ui = window.ui;
    const container = document.getElementById('ticketsContainer');
    const newBtn = document.getElementById('newTicketBtn');
    const modal = document.getElementById('ticketModal');
    const form = document.getElementById('ticketForm');
    const cancelBtn = document.getElementById('cancelTicketBtn');
    // session check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    async function loadTickets() {
      container.innerHTML = '';
      try {
        const tickets = await api.getTickets();
        if (!tickets || tickets.length === 0) {
          container.innerHTML = '<p class="text-center text-gray-400">لا توجد تذاكر بعد.</p>';
          return;
        }
        tickets.forEach(ticket => {
          const card = document.createElement('div');
          card.className = 'bg-gray-800 bg-opacity-50 p-4 rounded-lg mb-2';
          card.innerHTML = `<h3 class="font-bold"><a href="ticket.html?id=${ticket.id}" class="hover:underline">${escapeHtml(ticket.title)}</a></h3>
            <p class="text-sm text-gray-400">${escapeHtml(ticket.type)} • ${escapeHtml(ticket.status)}</p>
            <p class="text-xs text-gray-500">${new Date(ticket.created_at).toLocaleDateString('ar')}</p>`;
          container.appendChild(card);
        });
      } catch (err) {
        ui.showToast('فشل تحميل التذاكر: ' + err.message, 'error');
      }
    }
    await loadTickets();
    newBtn.addEventListener('click', () => {
      modal.classList.remove('hidden');
    });
    cancelBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('ticketType').value;
      const title = document.getElementById('ticketTitle').value.trim();
      const description = document.getElementById('ticketDescription').value.trim();
      if (!title || !description) {
        ui.showToast('يرجى تعبئة العنوان والوصف', 'error');
        return;
      }
      try {
        await api.createTicket({ title, description, type });
        ui.showToast('تم إرسال التذكرة', 'success');
        modal.classList.add('hidden');
        form.reset();
        await loadTickets();
      } catch (err) {
        ui.showToast('فشل الإرسال: ' + err.message, 'error');
      }
    });
  });
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function(m) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[m];
    });
  }
})();