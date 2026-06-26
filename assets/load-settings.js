/*
 * load-settings.js
 *
 * هذا السكربت مسؤول عن تحميل الإعدادات المخزنة محلياً (الثيم ولون الأزرار)
 * وتطبيقها على الصفحة. يقرأ ملف ownerSettings من localStorage، ثم
 * يضبط السمة data-theme ويحدث قيم متغيرات CSS للأزرار بحسب اللون المختار.
 *
 * يمكن تضمين هذا السكربت في كل الصفحات التي تحتاج لدعم الثيمات والألوان.
 */

(function () {
  // قيم افتراضية للإعدادات
  const defaults = {
    theme: 'dark',
    accent: '#3b82f6'
  };
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem('ownerSettings')) || {};
  } catch (e) {
    settings = {};
  }
  const theme = settings.theme || defaults.theme;
  const accent = settings.accent || defaults.accent;
  // تطبيق الثيم
  document.documentElement.setAttribute('data-theme', theme);
  // تعيين لون الأزرار
  document.documentElement.style.setProperty('--button-bg', accent);
  // دالة لتفتيح اللون قليلاً للاستخدام في hover
  function lightenColor(hex, percent = 0.15) {
    // إزالة الهاش إذا كان موجوداً
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
  const hover = lightenColor(accent, 0.15);
  document.documentElement.style.setProperty('--button-hover', hover);
})();