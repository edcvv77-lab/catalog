/* ui.js
 *
 * دوال الواجهة العامة مثل التوستس (الإشعارات السريعة)، الحوارات، والرسائل المنبثقة.
 * الهدف من هذا الملف هو توحيد طريقة عرض الرسائل للمستخدمين في مختلف صفحات النظام.
 * يتم ربط الدوال على window.ui لسهولة الوصول من باقي السكربتات.
 */

(function() {
  /**
   * عرض توست (toast) بسيط في أسفل الشاشة. يدعم أنواع مختلفة للتنبيه.
   * الأنواع المدعومة: success, error, info, warning. الافتراضي: info.
   * @param {string} message - نص الرسالة
   * @param {string} [type='info'] - نوع التوست
   */
  function showToast(message, type = 'info') {
    // محاولة إيجاد حاوية التوست، إن لم توجد أنشئ واحدة في آخر body
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.style.position = 'fixed';
      container.style.bottom = '20px';
      container.style.right = '20px';
      container.style.zIndex = '9999';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '8px';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `px-4 py-2 rounded shadow text-white mb-2`; 
    // تحديد اللون بناءً على النوع
    let bg;
    switch (type) {
      case 'success':
        bg = '#2ecc71';
        break;
      case 'error':
        bg = '#e74c3c';
        break;
      case 'warning':
        bg = '#f39c12';
        break;
      default:
        bg = '#3498db';
    }
    toast.style.backgroundColor = bg;
    toast.textContent = message;
    container.appendChild(toast);
    // إزالة التوست بعد ثلاث ثوانٍ
    setTimeout(() => {
      toast.remove();
      if (!container.hasChildNodes()) {
        container.remove();
      }
    }, 3000);
  }

  /**
   * عرض مربع حوار تأكيد مع رسالتك. يعيد Promise تُحل بالقيمة true عند التأكيد وfalse عند الإلغاء.
   * @param {string} message - نص السؤال
   * @returns {Promise<boolean>}
   */
  function confirmDialog(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.zIndex = '10000';
      const dialog = document.createElement('div');
      dialog.style.background = '#1f2937';
      dialog.style.padding = '20px';
      dialog.style.borderRadius = '8px';
      dialog.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
      dialog.style.maxWidth = '90%';
      dialog.style.color = '#fff';
      dialog.innerHTML = `<p class="mb-4">${message}</p>`;
      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '10px';
      const okBtn = document.createElement('button');
      okBtn.textContent = 'تأكيد';
      okBtn.style.background = '#2ecc71';
      okBtn.style.color = '#fff';
      okBtn.style.padding = '8px 12px';
      okBtn.style.borderRadius = '4px';
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'إلغاء';
      cancelBtn.style.background = '#e74c3c';
      cancelBtn.style.color = '#fff';
      cancelBtn.style.padding = '8px 12px';
      cancelBtn.style.borderRadius = '4px';
      okBtn.addEventListener('click', () => {
        overlay.remove();
        resolve(true);
      });
      cancelBtn.addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });
      actions.appendChild(okBtn);
      actions.appendChild(cancelBtn);
      dialog.appendChild(actions);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
    });
  }

  // كشف الـ API إلى window
  if (typeof window !== 'undefined') {
    window.ui = {
      showToast,
      confirmDialog
    };
  }
})();