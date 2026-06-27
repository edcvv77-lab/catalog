/* supabase-api.js
 *
 * طبقة وسيطة للتعامل مع Supabase. توفر دوال جاهزة لإدارة الغرف، الرسائل، المستخدمين وغيرها.
 * يتم ربط هذه الدوال على كائن window.supabaseApi لسهولة الوصول من باقي السكربتات.
 */

(function() {
  if (!window.supabase) {
    console.error('Supabase is not loaded. تأكد من تحميل supabase قبل هذا الملف');
    return;
  }

  const supabase = window.supabase;

  // جلب بيانات ملف المستخدم
  async function getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  }

  // إنشاء أو تحديث ملف المستخدم
  async function upsertProfile(profile) {
    const { data, error } = await supabase.from('profiles').upsert(profile).select('*').single();
    if (error) throw error;
    return data;
  }

  // جلب قائمة الغرف، مع إمكانية البحث
  async function getRooms({ search = '', limit = 50 } = {}) {
    let query = supabase.from('rooms').select('*').order('created_at', { ascending: true }).limit(limit);
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // إنشاء غرفة جديدة
  async function createRoom({ name, slug, description = '', type = 'public' }) {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('No user');

    const payload = {
      name,
      slug,
      description,
      type,
      owner_id: userId
    };

    const { data, error } = await supabase
      .from('rooms')
      .insert([payload])
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  // جلب أعضاء غرفة
  async function getRoomMembers(roomId) {
    const { data, error } = await supabase
      .from('room_members')
      .select('*, profiles:profiles (*)')
      .eq('room_id', roomId);
    if (error) throw error;
    return data;
  }

  // الانضمام إلى غرفة
  async function joinRoom(roomId) {
    if (!roomId) throw new Error('No room selected');

    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('No user');

    // لا نستخدم upsert هنا لأن upsert قد يتحول إلى update ويفشل مع RLS للمستخدم العادي
    const { data: existing, error: existingError } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing;

    const { data, error } = await supabase
      .from('room_members')
      .insert({
        room_id: roomId,
        user_id: userId,
        role: 'member',
        muted_until: null
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  // جلب الرسائل لغرفة
  async function getMessages(roomId, { limit = 50, beforeId = null } = {}) {
    let query = supabase
      .from('messages')
      .select('*, profiles:profiles!messages_sender_id_fkey (username, display_name, avatar_url, role, status)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (beforeId) {
      // جلب رسائل قبل رسالة معينة
      const { data: beforeMsg } = await supabase.from('messages').select('created_at').eq('id', beforeId).single();
      if (beforeMsg) {
        query = query.lt('created_at', beforeMsg.created_at);
      }
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // إرسال رسالة
  async function sendMessage(roomId, content, { replyTo = null, type = 'text' } = {}) {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('No user');
    if (!roomId) throw new Error('No room selected');

    content = String(content || '').trim();
    if (!content) throw new Error('Empty message');

    const message = {
      room_id: roomId,
      sender_id: userId,
      content,
      message_type: type,
      reply_to: replyTo
    };
    const { data, error } = await supabase.from('messages').insert(message).select('*').single();
    if (error) throw error;
    return data;
  }

  // تعديل رسالة
  async function editMessage(id, content) {
    const { data, error } = await supabase.from('messages').update({ content, edited_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }

  // حذف رسالة (تعليمها كمحذوفة)
  async function deleteMessage(id) {
    const user = (await supabase.auth.getUser()).data.user;
    const { data, error } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  // إضافة تفاعل على رسالة
  async function addReaction(messageId, emoji) {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const { data, error } = await supabase.from('message_reactions').insert({ message_id: messageId, user_id: userId, emoji }).select('*').single();
    if (error) throw error;
    return data;
  }

  // جلب تفاعلات رسالة
  async function getReactions(messageId) {
    const { data, error } = await supabase
      .from('message_reactions')
      .select('emoji, user_id')
      .eq('message_id', messageId);
    if (error) throw error;
    return data;
  }

  // جلب المستخدمين (profiles) مع خيارات البحث والتصفية
  async function getUsers({ search = '', limit = 50 } = {}) {
    let query = supabase.from('profiles').select('*').order('created_at', { ascending: true }).limit(limit);
    if (search) {
      query = query.ilike('display_name', `%${search}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // تحديث دور المستخدم
  async function updateUserRole(userId, newRole) {
    const { data, error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId).select('*').single();
    if (error) throw error;
    return data;
  }

  // تحديث حالة المستخدم
  async function updateUserStatus(userId, newStatus) {
    const { data, error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', userId).select('*').single();
    if (error) throw error;
    return data;
  }

  // إنشاء محادثة خاصة (أو إرجاع الموجودة)
  async function getOrCreateConversation(userId) {
    const currentUser = (await supabase.auth.getUser()).data.user?.id;
    if (!currentUser) throw new Error('No user');
    // تأكد من ترتيب المستخدمين لضمان التفرد
    const pair = [currentUser, userId].sort();
    // تحقق من وجود محادثة مسبقاً
    const { data: existing } = await supabase
      .from('private_conversations')
      .select('*')
      .eq('user1_id', pair[0])
      .eq('user2_id', pair[1])
      .single();
    if (existing) return existing;
    const { data, error } = await supabase.from('private_conversations').insert({ user1_id: pair[0], user2_id: pair[1] }).select('*').single();
    if (error) throw error;
    return data;
  }

  // إرسال رسالة خاصة
  async function sendPrivateMessage(conversationId, content, { replyTo = null } = {}) {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const message = { conversation_id: conversationId, sender_id: userId, content, reply_to: replyTo };
    const { data, error } = await supabase.from('private_messages').insert(message).select('*').single();
    if (error) throw error;
    return data;
  }

  // جلب رسائل خاصة
  async function getPrivateMessages(conversationId, { limit = 50, beforeId = null } = {}) {
    let query = supabase
      .from('private_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (beforeId) {
      const { data: before } = await supabase.from('private_messages').select('created_at').eq('id', beforeId).single();
      if (before) query = query.lt('created_at', before.created_at);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // -------- الوظائف المضافة في الإصدار V3 -------- //

  // جلب المحادثات الخاصة للمستخدم الحالي
  async function getPrivateConversations() {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('No user');
    const { data, error } = await supabase
      .from('private_conversations')
      .select('*')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // جلب إعدادات المالك ككائن مفاتيح/قيم
  async function getOwnerSettings() {
    const { data, error } = await supabase.from('owner_settings').select('*');
    if (error) throw error;
    const settings = {};
    (data || []).forEach((item) => {
      settings[item.key] = item.value;
    });
    return settings;
  }

  // حفظ إعدادات المالك
  async function saveOwnerSettings(obj) {
    const entries = Object.entries(obj);
    for (const [key, value] of entries) {
      const { error } = await supabase.from('owner_settings').upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) throw error;
    }
    return true;
  }

  // جلب البلاغات مع خيار تحديد الحالة
  async function getReports({ status = null, limit = 50 } = {}) {
    let query = supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(limit);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // تحديث حالة البلاغ
  async function updateReportStatus(id, newStatus) {
    const { error } = await supabase.from('reports').update({ status: newStatus }).eq('id', id);
    if (error) throw error;
    return true;
  }

  // جلب الإعلانات
  async function getAnnouncements({ active = null } = {}) {
    let query = supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (active !== null) query = query.eq('active', active);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // إنشاء إعلان جديد
  async function createAnnouncement({ title, body, audience = 'all', roomId = null, role = null }) {
    const user = (await supabase.auth.getUser()).data.user;
    const payload = { title, body, audience, created_by: user.id, active: true, created_at: new Date().toISOString() };
    if (roomId) payload.room_id = roomId;
    if (role) payload.role = role;
    const { data, error } = await supabase.from('announcements').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  // تفعيل أو إيقاف الإعلان
  async function toggleAnnouncement(id, active) {
    const { error } = await supabase.from('announcements').update({ active }).eq('id', id);
    if (error) throw error;
    return true;
  }

  // جلب ملخصات الغرف (العدد والرسالة الأخيرة)
  async function getRoomsSummary({ search = '', limit = 50 } = {}) {
    const rooms = await getRooms({ search, limit });
    const summaries = [];
    for (const room of rooms) {
      // count members
      let memberCount = 0;
      try {
        const members = await getRoomMembers(room.id);
        memberCount = members.length;
      } catch {
        memberCount = 0;
      }
      // last message
      let lastMessage = null;
      try {
        const msgs = await getMessages(room.id, { limit: 1 });
        if (msgs.length > 0) lastMessage = msgs[0];
      } catch {
        lastMessage = null;
      }
      summaries.push({ room, memberCount, lastMessage });
    }
      return summaries;
  }

  // جلب بيانات غرفة محددة
  async function getRoomById(roomId) {
    const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    if (error) throw error;
    return data;
  }

  // جلب الرسائل المثبتة لغرفة
  async function getPinnedMessages(roomId) {
    const { data, error } = await supabase.from('messages').select('*').eq('room_id', roomId).eq('pinned', true).order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  // تثبيت رسالة
  async function pinMessage(id) {
    const { error } = await supabase.from('messages').update({ pinned: true }).eq('id', id);
    if (error) throw error;
    return true;
  }

  // إلغاء تثبيت رسالة
  async function unpinMessage(id) {
    const { error } = await supabase.from('messages').update({ pinned: false }).eq('id', id);
    if (error) throw error;
    return true;
  }

  // كتم مستخدم في غرفة لفترة معينة بالدقائق
  async function muteUserInRoom(roomId, userId, minutes) {
    const until = new Date(Date.now() + minutes * 60000).toISOString();
    const { error } = await supabase.from('room_members').update({ muted_until: until }).eq('room_id', roomId).eq('user_id', userId);
    if (error) throw error;
    return true;
  }

  // حظر مستخدم (تعيين الحالة إلى banned)
  async function banUser(userId) {
    const { error } = await supabase.from('profiles').update({ status: 'banned' }).eq('id', userId);
    if (error) throw error;
    return true;
  }

  // إلغاء حظر مستخدم (إعادة الحالة إلى active)
  async function unbanUser(userId) {
    const { error } = await supabase.from('profiles').update({ status: 'active' }).eq('id', userId);
    if (error) throw error;
    return true;
  }

  // جلب الإشعارات للمستخدم
  async function getNotifications({ unreadOnly = false } = {}) {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    let query = supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (unreadOnly) query = query.is('read_at', null);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // تعليم الإشعار كمقروء
  async function markNotificationAsRead(id) {
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    return true;
  }

  // تسجيل حدث تدقيق للمشرف
  async function logModerationAction(action, targetType, targetId, reason = '', metadata = {}) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    const payload = {
      actor_id: user.id,
      action,
      target_type: targetType,
      target_id: targetId,
      reason,
      metadata,
      created_at: new Date().toISOString()
    };
    await supabase.from('moderation_logs').insert(payload);
  }

  /*
   * -------- الوظائف الجديدة لإصدار V4 (منصة المجتمع) --------
   * تم تصميم هذه الدوال لتسهيل إدارة المنشورات والمهام والمشاريع والمقالات والتذاكر وغيرها. بعض هذه الدوال
   * تعتمد على أعمدة بسيطة في الجداول المضافة في schema_v4_super_community.sql. إذا كانت الجداول غير
   * متوفرة أو السياسات RLS تمنع الوصول، قد تظهر أخطاء عند استخدامها. يرجى تعديلها حسب الحاجة.
   */

  // المنشورات

  /**
   * جلب قائمة المنشورات
   * @param {Object} opts خيارات البحث: type (all|owner|announcement|popular), limit, since, userId
   */
  async function getPosts({ type = 'all', limit = 50, since = null, userId = null } = {}) {
    // نحصل على المنشورات مع انضمام الملف الشخصي للمؤلف
    let query = supabase
      .from('posts')
      .select('*, profiles:profiles!posts_author_id_fkey (id, display_name, avatar_url, role)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (since) query = query.gt('created_at', since);
    if (userId) query = query.eq('author_id', userId);
    // إذا كان نوع الطلب هو إعلان، استخدم حقل type الموجود في الجدول (وليس post_type)
    if (type === 'announcement') query = query.eq('type', 'announcement');
    if (type === 'owner') {
      const ownerIds = await _getOwnerIds();
      query = query.in('author_id', ownerIds);
    }
    // TODO: popular يمكن فرزها حسب التفاعلات أو التعليقات
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // دالة مساعدة لجلب معرفات المالكين (owner/admin)
  async function _getOwnerIds() {
    const { data, error } = await supabase.from('profiles').select('id').in('role', ['owner','admin']);
    if (error) throw error;
    return (data || []).map((p) => p.id);
  }

  /**
   * إنشاء منشور جديد
   * @param {Object} post يحتوي على المحتوى والصورة والنوع
   */
  async function createPost({ content, imageUrl = null, postType = 'post' }) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('No user');
    const payload = {
      author_id: user.id,
      content,
      image_url: imageUrl,
      type: postType,
      created_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('posts').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  /**
   * تحديث منشور (المحتوى والصورة فقط)
   */
  async function updatePost(id, { content, imageUrl = null }) {
    // نحدث المحتوى والصورة ونحدّث updated_at بدلاً من edited_at لعدم وجود هذا الحقل في الجدول
    const { data, error } = await supabase
      .from('posts')
      .update({ content, image_url: imageUrl, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * حذف منشور (تعليم الحذف دون إزالة السجل)
   */
  async function deletePost(id) {
    // حذف المنشور نهائيًا من قاعدة البيانات لأن الجدول لا يحتوي على حقول الحذف
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  // تعليقات المنشور
  async function getPostComments(postId, { limit = 100 } = {}) {
    const { data, error } = await supabase
      .from('post_comments')
      .select('*, profiles:profiles!post_comments_author_id_fkey (id, display_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data;
  }
  async function addPostComment(postId, content) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('No user');
    const payload = { post_id: postId, author_id: user.id, content, created_at: new Date().toISOString() };
    const { data, error } = await supabase.from('post_comments').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }

  // التفاعلات على المنشورات
  async function getPostReactions(postId) {
    const { data, error } = await supabase.from('post_reactions').select('*').eq('post_id', postId);
    if (error) throw error;
    return data;
  }
  async function addPostReaction(postId, emoji) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('No user');
    const { data, error } = await supabase.from('post_reactions').upsert({ post_id: postId, user_id: user.id, emoji }, { onConflict: 'post_id,user_id' }).select('*').single();
    if (error) throw error;
    return data;
  }

  // نظام المشاريع والمهام
  async function getProjects() {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
  async function createProject({ name, description = '', status = 'idea' }) {
    const user = (await supabase.auth.getUser()).data.user;
    const payload = { name, description, status, owner_id: user?.id, created_at: new Date().toISOString() };
    const { data, error } = await supabase.from('projects').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }
  async function updateProject(id, { name, description, status }) {
    const { data, error } = await supabase.from('projects').update({ name, description, status, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }

  async function getProjectMembers(projectId) {
    const { data, error } = await supabase.from('project_members').select('*, profiles:profiles!project_members_user_id_fkey (id, display_name, avatar_url)').eq('project_id', projectId);
    if (error) throw error;
    return data;
  }

  async function addProjectMember(projectId, userId) {
    const { data, error } = await supabase.from('project_members').upsert({ project_id: projectId, user_id: userId }, { onConflict: 'project_id,user_id' }).select('*').single();
    if (error) throw error;
    return data;
  }

  // المهام
  async function getTasks(projectId) {
    const { data, error } = await supabase.from('tasks').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
  async function createTask(projectId, { title, description = '', status = 'todo', priority = 'medium', assigneeId = null }) {
    // لا يحتوي جدول المهام على حقل created_by في المخطط الحالي، لذا لا نرسله
    const payload = {
      project_id: projectId,
      title,
      description,
      status,
      priority,
      assignee_id: assigneeId,
      created_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('tasks').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }
  async function updateTask(id, fields) {
    fields.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('tasks').update(fields).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }
  async function deleteTask(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  // مركز المعرفة
  async function getKnowledgeCategories() {
    const { data, error } = await supabase.from('knowledge_categories').select('*').order('name', { ascending: true });
    if (error) throw error;
    return data;
  }
  async function createKnowledgeCategory(name) {
    const { data, error } = await supabase.from('knowledge_categories').insert({ name }).select('*').single();
    if (error) throw error;
    return data;
  }
  async function getArticles({ categoryId = null, limit = 50 } = {}) {
    let query = supabase.from('knowledge_articles').select('*').order('created_at', { ascending: false }).limit(limit);
    if (categoryId) query = query.eq('category_id', categoryId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
  async function getArticleById(id) {
    const { data, error } = await supabase.from('knowledge_articles').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }
  async function createArticle({ title, content, categoryId }) {
    const user = (await supabase.auth.getUser()).data.user;
    const payload = { title, content, category_id: categoryId, author_id: user?.id, created_at: new Date().toISOString() };
    const { data, error } = await supabase.from('knowledge_articles').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }
  async function updateArticle(id, { title, content, categoryId }) {
    const { data, error } = await supabase.from('knowledge_articles').update({ title, content, category_id: categoryId, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }
  async function deleteArticle(id) {
    const { error } = await supabase.from('knowledge_articles').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  // مركز الدعم
  async function getTickets({ status = null } = {}) {
    const user = (await supabase.auth.getUser()).data.user;
    let query = supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    // إذا لم يكن المستخدم مالكاً أو مشرفاً، اجلب تذاكره فقط
    if (user && user.role !== 'owner' && user.role !== 'admin' && user.role !== 'moderator') {
      query = query.eq('creator_id', user.id);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
  async function createTicket({ title, description, type = 'other', priority = 'medium' }) {
    const user = (await supabase.auth.getUser()).data.user;
    const payload = { title, description, type, priority, creator_id: user?.id, status: 'open', created_at: new Date().toISOString() };
    const { data, error } = await supabase.from('support_tickets').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }
  async function getTicketById(id) {
    const { data, error } = await supabase.from('support_tickets').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }
  async function addTicketMessage(ticketId, content) {
    const user = (await supabase.auth.getUser()).data.user;
    const payload = { ticket_id: ticketId, sender_id: user?.id, content, created_at: new Date().toISOString() };
    const { data, error } = await supabase.from('ticket_messages').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  }
  async function updateTicketStatus(id, status, assigneeId = null) {
    const fields = { status, updated_at: new Date().toISOString() };
    if (assigneeId) fields.assignee_id = assigneeId;
    const { data, error } = await supabase.from('support_tickets').update(fields).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }

  // الإنجازات والسمعة
  async function getLeaderboard({ limit = 10 } = {}) {
    // يتم جلب المستخدمين الأعلى سمعة من جدول user_stats، إذا كان متاحًا
    const { data, error } = await supabase
      .from('user_stats')
      .select('user_id, messages_count, posts_count, reputation')
      .order('reputation', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }

  // البحث الموحد
  async function searchAll(term) {
    const results = {};
    const likeTerm = `%${term}%`;
    // ابحث في المستخدمين
    const { data: users, error: usersError } = await supabase.from('profiles').select('id, display_name, bio').ilike('display_name', likeTerm).limit(10);
    if (!usersError) results.users = users;
    // ابحث في الغرف
    const { data: rooms, error: roomsError } = await supabase.from('rooms').select('id, name, description').ilike('name', likeTerm).limit(10);
    if (!roomsError) results.rooms = rooms;
    // ابحث في المنشورات
    const { data: postsData, error: postsErr } = await supabase.from('posts').select('id, content').ilike('content', likeTerm).limit(10);
    if (!postsErr) results.posts = postsData;
    // ابحث في المقالات
    const { data: articles, error: artErr } = await supabase.from('knowledge_articles').select('id, title').ilike('title', likeTerm).limit(10);
    if (!artErr) results.articles = articles;
    return results;
  }

  // تصدير جميع الدوال إلى window.supabaseApi
  window.supabaseApi = {
    getProfile,
    upsertProfile,
    getRooms,
    createRoom,
    getRoomMembers,
    joinRoom,
    getMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    getReactions,
    getUsers,
    updateUserRole,
    updateUserStatus,
    getOrCreateConversation,
    sendPrivateMessage,
    getPrivateMessages,
    // إضافات V3
    getPrivateConversations,
    getOwnerSettings,
    saveOwnerSettings,
    getReports,
    updateReportStatus,
    getAnnouncements,
    createAnnouncement,
    toggleAnnouncement,
    getRoomsSummary,
    getRoomById,
    getPinnedMessages,
    pinMessage,
    unpinMessage,
    muteUserInRoom,
    banUser,
    unbanUser,
    getNotifications,
    markNotificationAsRead,
    logModerationAction,
    // ---- وظائف V4: المنشورات، المشاريع، المهام، المعرفة، الدعم، الإنجازات، البحث ----
    getPosts,
    createPost,
    updatePost,
    deletePost,
    getPostComments,
    addPostComment,
    getPostReactions,
    addPostReaction,
    getProjects,
    createProject,
    updateProject,
    getProjectMembers,
    addProjectMember,
    getTasks,
    createTask,
    updateTask,
    deleteTask,
    getKnowledgeCategories,
    createKnowledgeCategory,
    getArticles,
    getArticleById,
    createArticle,
    updateArticle,
    deleteArticle,
    getTickets,
    createTicket,
    getTicketById,
    addTicketMessage,
    updateTicketStatus,
    getLeaderboard,
    searchAll
  };
})();