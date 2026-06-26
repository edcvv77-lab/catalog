// auth.js
// التعامل مع التسجيل وتسجيل الدخول وتسجيل الخروج باستخدام Supabase Auth

document.addEventListener('DOMContentLoaded', () => {
  const signUpForm = document.getElementById('signUpForm');
  const signInForm = document.getElementById('signInForm');
  const signOutButton = document.getElementById('signOutButton');
  const errorBox = document.getElementById('authError');

  // إظهار الأخطاء للمستخدم
  function displayError(message) {
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.style.display = 'block';
    }
  }

  // إخفاء الأخطاء
  function clearError() {
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.style.display = 'none';
    }
  }

  // تسجيل مستخدم جديد
  if (signUpForm) {
    signUpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      const email = signUpForm.elements['email'].value.trim();
      const password = signUpForm.elements['password'].value.trim();
      const displayName = signUpForm.elements['display_name'].value.trim();
      try {
        // إنشاء حساب في Supabase
        const { data, error } = await window.supabase.auth.signUp({ email, password });
        if (error) throw error;
        const user = data?.user;
        // إنشاء ملف شخصي للمستخدم الجديد في جدول profiles
        if (user && window.supabaseApi && window.supabaseApi.upsertProfile) {
          try {
            await window.supabaseApi.upsertProfile({ id: user.id, display_name: displayName, username: email.split('@')[0] });
          } catch (profileErr) {
            console.warn('تعذر إنشاء الملف الشخصي:', profileErr);
          }
        }
        alert('تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني لتأكيد الحساب.');
      } catch (err) {
        displayError(err.message);
      }
    });
  }

  // تسجيل دخول مستخدم
  if (signInForm) {
    signInForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      const email = signInForm.elements['email'].value.trim();
      const password = signInForm.elements['password'].value.trim();
      try {
        const { data, error } = await window.supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // التأكد من وجود ملف شخصي لهذا المستخدم وإنشاؤه إذا كان مفقوداً
        const user = data?.user;
        if (user && window.supabaseApi) {
          try {
            const profile = await window.supabaseApi.getProfile(user.id).catch(() => null);
            if (!profile) {
              await window.supabaseApi.upsertProfile({ id: user.id, display_name: email.split('@')[0], username: email.split('@')[0] });
            }
          } catch (profileErr) {
            console.warn('تعذر التحقق أو إنشاء الملف الشخصي:', profileErr);
          }
        }
        // عند تسجيل الدخول بنجاح، الانتقال إلى غرفة الدردشة
        window.location.href = 'chat.html';
      } catch (err) {
        displayError(err.message);
      }
    });
  }

  // تسجيل خروج
  if (signOutButton) {
    signOutButton.addEventListener('click', async () => {
      await window.supabase.auth.signOut();
      window.location.href = 'login.html';
    });
  }

  // التحقق من حالة الجلسة وتوجيه المستخدم إذا كان قد سجل الدخول مسبقًا
  window.supabase.auth.getSession().then(({ data: { session } }) => {
    const currentPage = window.location.pathname.split('/').pop();
    if (session) {
      // المستخدم مسجل الدخول
      if (currentPage === 'login.html') {
        // إذا كان في صفحة تسجيل الدخول، اذهب إلى الدردشة مباشرة
        window.location.href = 'chat.html';
      }
    }
  });
});