/* security.js
 *
 * دوال مخصصة للتحقق من الرسائل وفرض سياسات المنصة مثل الكلمات المحظورة والطول الأقصى ووضع البطء.
 * تعتمد هذه الدوال على إعدادات المالك المخزنة في جدول owner_settings.
 */

(function() {
  if (typeof window === 'undefined') return;
  const utils = window.utils;
  const api = window.supabaseApi;

  // كائن لتخزين آخر إرسال لكل غرفة للتأكد من احترام وضع البطء
  const lastSendTimes = {};

  /**
   * جلب إعدادات المالك مخزنة في قاعدة البيانات، تُعاد ككائن مفاتيح/قيم.
   * @returns {Promise<object>}
   */
  async function getOwnerSettings() {
    if (!api || !api.getOwnerSettings) return {};
    try {
      const settings = await api.getOwnerSettings();
      return settings;
    } catch (error) {
      console.warn('تعذر تحميل إعدادات المالك:', error);
      return {};
    }
  }

  /**
   * التحقق من نص الرسالة قبل إرسالها. يقوم بالتالي:
   * 1. تطبيق sanitize لمنع XSS.
   * 2. التحقق من الكلمات المحظورة واستبدالها بــ **.
   * 3. التحقق من أقصى طول للرسالة من الإعدادات.
   * 4. التحقق من وضع البطء لغرفة معينة عبر قيمة slow_mode_seconds في كائن room.
   * @param {string} text - نص الرسالة الأصلية
   * @param {object} settings - إعدادات المالك (forbidden_words, max_message_length)
   * @param {object} room - كائن الغرفة (يحتوى slow_mode_seconds)
   * @returns {object} { valid: boolean, sanitized: string, error?: string }
   */
  function checkMessage(text, settings = {}, room = {}) {
    if (typeof text !== 'string' || !text.trim()) {
      return { valid: false, error: 'الرسالة فارغة' };
    }
    const sanitized = utils.sanitize(text.trim());
    // أقصى طول
    const maxLen = settings.max_message_length || 500;
    if (sanitized.length > maxLen) {
      return { valid: false, error: `الرسالة طويلة جدًا، الحد الأقصى ${maxLen} حرف` };
    }
    // كلمات محظورة
    const forbidden = (settings.forbidden_words || '').split(',').map((w) => w.trim()).filter(Boolean);
    let replaced = sanitized;
    if (forbidden.length) {
      const re = new RegExp(forbidden.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
      replaced = sanitized.replace(re, (match) => '*'.repeat(match.length));
    }
    // وضع البطء
    const slow = parseInt(room.slow_mode_seconds || 0, 10);
    if (slow > 0) {
      const now = Date.now();
      const last = lastSendTimes[room.id] || 0;
      if (now - last < slow * 1000) {
        return { valid: false, error: `وضع البطء مفعّل. يجب الانتظار ${Math.ceil((slow * 1000 - (now - last)) / 1000)} ثواني قبل إرسال رسالة أخرى` };
      }
      // تحديث آخر إرسال فقط إذا التحقق ناجح
      lastSendTimes[room.id] = now;
    }
    return { valid: true, sanitized: replaced };
  }

  // ربط الدوال على window.securityUtils
  window.securityUtils = {
    getOwnerSettings,
    checkMessage
  };
})();