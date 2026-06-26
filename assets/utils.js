/* utils.js
 *
 * ملفات مساعدة متنوعة للمنصة.
 * تشمل دوال التنسيق وتعقيم النصوص وغيرها.
 */

// تعقيم النص لمنع HTML أو XSS
function sanitize(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// تحويل نص إلى slug صالح للاستخدام في URLs
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// تنسيق الوقت إلى صيغة مقروءة (ساعات:دقائق تاريخ)
function formatTime(ts) {
  const date = new Date(ts);
  return date.toLocaleString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// تفتيح لون HEX بنسبة معينة (0-1)
function lightenColor(hex, percent = 0.15) {
  let color = hex.replace('#', '');
  if (color.length === 3) {
    color = color.split('').map((c) => c + c).join('');
  }
  const num = parseInt(color, 16);
  let r = (num >> 16) + Math.round(255 * percent);
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * percent);
  let b = (num & 0x0000ff) + Math.round(255 * percent);
  r = r > 255 ? 255 : r;
  g = g > 255 ? 255 : g;
  b = b > 255 ? 255 : b;
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// اجعل الدوال متاحة عبر window.utils لسهولة الوصول من السكربتات غير المعيارية
if (typeof window !== 'undefined') {
  window.utils = {
    sanitize,
    slugify,
    formatTime,
    lightenColor
  };
}