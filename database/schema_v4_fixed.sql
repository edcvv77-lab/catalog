-- schema_v4_super_community.sql
-- مخطط قواعد البيانات لمنصة المجتمع المتكاملة Aiham Community Command Center
-- يتضمن كل الجداول المستخدمة في المنصة (الدردشة، المنشورات، المهام، المعرفة، الدعم، الإنجازات، الإشعارات، الصلاحيات، إلخ).

-- تأكد من تفعيل الامتداد uuid-ossp لإنشاء UUID تلقائياً
create extension if not exists "uuid-ossp";

-- إعادة استخدام الجداول الأساسية من الإصدار السابق
-- profiles, rooms, room_members, messages, message_reactions, private_conversations,
-- private_messages, reports, moderation_logs, owner_settings, announcements,
-- user_blocks, notifications, audit_events

-- ملف profiles
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text unique,
    display_name text,
    avatar_url text,
    bio text,
    role text not null default 'user',
    status text not null default 'active',
    last_seen timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- links المرتبطة بالملف الشخصي (ملف تعريف المستخدم)
create table if not exists public.profile_links (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.profiles(id) on delete cascade,
    label text,
    url text,
    created_at timestamptz default now()
);

-- جدول الشارات المعرَّفة في النظام
create table if not exists public.badges (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    description text,
    icon_url text,
    created_at timestamptz default now()
);

-- الشارات المملوكة لكل مستخدم
create table if not exists public.user_badges (
    user_id uuid references public.profiles(id) on delete cascade,
    badge_id uuid references public.badges(id) on delete cascade,
    awarded_at timestamptz default now(),
    primary key (user_id, badge_id)
);

-- جدول الأحداث التي تمنح نقاط السمعة
create table if not exists public.reputation_events (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.profiles(id) on delete cascade,
    reason text,
    points integer not null,
    created_at timestamptz default now()
);

-- إحصائيات المستخدم المجمعة (رسائل، منشورات، إلخ)
create table if not exists public.user_stats (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    messages_count integer not null default 0,
    posts_count integer not null default 0,
    reports_count integer not null default 0,
    reputation integer not null default 0,
    updated_at timestamptz default now()
);

-- نظام الغرف كما في الإصدار السابق مع تحسينات
create table if not exists public.rooms (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    slug text not null unique,
    description text,
    avatar_url text,
    type text not null default 'public', -- public / private / secret
    owner_id uuid references public.profiles(id),
    slow_mode_seconds integer not null default 0,
    is_locked boolean not null default false,
    is_archived boolean not null default false,
    created_at timestamptz default now()
);

create table if not exists public.room_members (
    room_id uuid references public.rooms(id) on delete cascade,
    user_id uuid references public.profiles(id) on delete cascade,
    role text not null default 'member', -- member / mod / admin / owner
    muted_until timestamptz,
    joined_at timestamptz default now(),
    primary key (room_id, user_id)
);

create table if not exists public.messages (
    id uuid primary key default uuid_generate_v4(),
    room_id uuid references public.rooms(id) on delete cascade,
    sender_id uuid references public.profiles(id),
    content text not null,
    message_type text not null default 'text', -- text / image / file / system / announcement
    reply_to uuid references public.messages(id) on delete set null,
    edited_at timestamptz,
    deleted_at timestamptz,
    deleted_by uuid references public.profiles(id),
    pinned boolean not null default false,
    created_at timestamptz default now()
);

create table if not exists public.message_reactions (
    id uuid primary key default uuid_generate_v4(),
    message_id uuid references public.messages(id) on delete cascade,
    user_id uuid references public.profiles(id) on delete cascade,
    emoji text not null,
    created_at timestamptz default now()
);

-- المحادثات الخاصة والرسائل الخاصة
create table if not exists public.private_conversations (
    id uuid primary key default uuid_generate_v4(),
    user1_id uuid references public.profiles(id) on delete cascade,
    user2_id uuid references public.profiles(id) on delete cascade,
    created_at timestamptz default now(),
    unique (user1_id, user2_id)
);

create table if not exists public.private_messages (
    id uuid primary key default uuid_generate_v4(),
    conversation_id uuid references public.private_conversations(id) on delete cascade,
    sender_id uuid references public.profiles(id),
    content text not null,
    reply_to uuid references public.private_messages(id) on delete set null,
    seen_at timestamptz,
    edited_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz default now()
);

-- التقارير
create table if not exists public.reports (
    id uuid primary key default uuid_generate_v4(),
    reporter_id uuid references public.profiles(id),
    target_type text not null, -- message / user / room / post / comment
    target_id uuid not null,
    reason text,
    status text not null default 'open', -- open / reviewing / resolved / rejected
    admin_note text,
    created_at timestamptz default now()
);

-- سجل الإجراءات الإدارية
create table if not exists public.moderation_logs (
    id uuid primary key default uuid_generate_v4(),
    actor_id uuid references public.profiles(id),
    action text not null,
    target_type text not null,
    target_id uuid not null,
    reason text,
    metadata jsonb,
    created_at timestamptz default now()
);

-- إعدادات المالك
create table if not exists public.owner_settings (
    key text primary key,
    value jsonb,
    -- تحديد ما إذا كان الإعداد عامًا ويمكن للجميع قراءته
    is_public boolean not null default false,
    updated_at timestamptz default now()
);

-- الإعلانات العامة أو الخاصة
create table if not exists public.announcements (
    id uuid primary key default uuid_generate_v4(),
    title text not null,
    body text not null,
    audience text not null default 'all', -- all / room / role
    room_id uuid references public.rooms(id) on delete cascade,
    role text,
    created_by uuid references public.profiles(id),
    active boolean not null default true,
    created_at timestamptz default now()
);

-- الحظر بين المستخدمين
create table if not exists public.user_blocks (
    blocker_id uuid references public.profiles(id),
    blocked_id uuid references public.profiles(id),
    created_at timestamptz default now(),
    primary key (blocker_id, blocked_id)
);

-- الإشعارات
create table if not exists public.notifications (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.profiles(id) on delete cascade,
    type text not null,
    title text,
    body text,
    read_at timestamptz,
    metadata jsonb,
    created_at timestamptz default now()
);

-- أحداث التدقيق
create table if not exists public.audit_events (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.profiles(id),
    event_type text not null,
    ip_hint text,
    user_agent_hint text,
    metadata jsonb,
    created_at timestamptz default now()
);

-- جداول نظام المنشورات
create table if not exists public.posts (
    id uuid primary key default uuid_generate_v4(),
    author_id uuid references public.profiles(id) on delete cascade,
    content text not null,
    image_url text,
    type text not null default 'post', -- post / announcement
    pinned boolean not null default false,
    created_at timestamptz default now(),
    updated_at timestamptz
);

create table if not exists public.post_comments (
    id uuid primary key default uuid_generate_v4(),
    post_id uuid references public.posts(id) on delete cascade,
    author_id uuid references public.profiles(id) on delete cascade,
    content text not null,
    reply_to uuid references public.post_comments(id) on delete set null,
    created_at timestamptz default now()
);

create table if not exists public.post_reactions (
    id uuid primary key default uuid_generate_v4(),
    post_id uuid references public.posts(id) on delete cascade,
    user_id uuid references public.profiles(id) on delete cascade,
    emoji text not null,
    created_at timestamptz default now()
);

create table if not exists public.post_reports (
    id uuid primary key default uuid_generate_v4(),
    post_id uuid references public.posts(id) on delete cascade,
    reporter_id uuid references public.profiles(id),
    reason text,
    status text not null default 'open',
    admin_note text,
    created_at timestamptz default now()
);

-- جداول نظام المشاريع والمهام
create table if not exists public.projects (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    description text,
    owner_id uuid references public.profiles(id),
    status text not null default 'idea', -- idea / planning / active / paused / done
    created_at timestamptz default now(),
    updated_at timestamptz
);

create table if not exists public.project_members (
    project_id uuid references public.projects(id) on delete cascade,
    user_id uuid references public.profiles(id) on delete cascade,
    role text not null default 'member', -- member / moderator / admin / owner
    joined_at timestamptz default now(),
    primary key (project_id, user_id)
);

create table if not exists public.tasks (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references public.projects(id) on delete cascade,
    title text not null,
    description text,
    assignee_id uuid references public.profiles(id),
    status text not null default 'todo', -- todo / doing / review / done
    priority text not null default 'medium', -- low / medium / high / critical
    due_date date,
    created_at timestamptz default now(),
    updated_at timestamptz
);

create table if not exists public.task_comments (
    id uuid primary key default uuid_generate_v4(),
    task_id uuid references public.tasks(id) on delete cascade,
    author_id uuid references public.profiles(id) on delete cascade,
    content text not null,
    created_at timestamptz default now()
);

create table if not exists public.task_activity (
    id uuid primary key default uuid_generate_v4(),
    task_id uuid references public.tasks(id) on delete cascade,
    actor_id uuid references public.profiles(id),
    action text not null,
    metadata jsonb,
    created_at timestamptz default now()
);

-- جداول نظام المعرفة
create table if not exists public.knowledge_categories (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    description text,
    created_at timestamptz default now()
);

create table if not exists public.knowledge_articles (
    id uuid primary key default uuid_generate_v4(),
    category_id uuid references public.knowledge_categories(id) on delete set null,
    author_id uuid references public.profiles(id),
    title text not null,
    content text not null,
    pinned boolean not null default false,
    is_private boolean not null default false,
    created_at timestamptz default now(),
    updated_at timestamptz
);

create table if not exists public.article_reactions (
    id uuid primary key default uuid_generate_v4(),
    article_id uuid references public.knowledge_articles(id) on delete cascade,
    user_id uuid references public.profiles(id) on delete cascade,
    reaction text not null,
    created_at timestamptz default now()
);

create table if not exists public.article_views (
    article_id uuid references public.knowledge_articles(id) on delete cascade,
    user_id uuid references public.profiles(id) on delete cascade,
    viewed_at timestamptz default now(),
    primary key (article_id, user_id)
);

-- جداول نظام الدعم
create table if not exists public.support_tickets (
    id uuid primary key default uuid_generate_v4(),
    creator_id uuid references public.profiles(id) on delete cascade,
    type text not null, -- account / chat / report / bug / suggestion / other
    title text not null,
    description text,
    status text not null default 'open', -- open / pending / answered / closed
    priority text not null default 'medium', -- low / medium / high / critical
    assignee_id uuid references public.profiles(id),
    created_at timestamptz default now(),
    updated_at timestamptz
);

create table if not exists public.ticket_messages (
    id uuid primary key default uuid_generate_v4(),
    ticket_id uuid references public.support_tickets(id) on delete cascade,
    sender_id uuid references public.profiles(id),
    content text not null,
    created_at timestamptz default now()
);

create table if not exists public.ticket_activity (
    id uuid primary key default uuid_generate_v4(),
    ticket_id uuid references public.support_tickets(id) on delete cascade,
    actor_id uuid references public.profiles(id),
    action text not null,
    metadata jsonb,
    created_at timestamptz default now()
);

-- جداول النظام للبحث الموحد يمكن استخدام نفسها دون جداول منفصلة

-- جداول نظام الصلاحيات والأدوار
create table if not exists public.roles (
    name text primary key,
    description text
);

create table if not exists public.role_permissions (
    role_name text references public.roles(name) on delete cascade,
    permission text not null,
    primary key (role_name, permission)
);

-- إضافة بعض الفهارس لتحسين الأداء
create index if not exists idx_posts_created_at on public.posts (created_at);
create index if not exists idx_messages_room_created_at on public.messages (room_id, created_at);
create index if not exists idx_private_messages_conv_created_at on public.private_messages (conversation_id, created_at);
create index if not exists idx_support_tickets_status on public.support_tickets (status);
create index if not exists idx_tasks_project_status on public.tasks (project_id, status);
create index if not exists idx_notifications_user_unread on public.notifications (user_id, read_at);
create index if not exists idx_audit_events_created_at on public.audit_events (created_at);

-- ضمان عدم تكرار تفاعل المستخدم على نفس المنشور أكثر من مرة
create unique index if not exists idx_post_reactions_unique on public.post_reactions (post_id, user_id);

-- تفعيل RLS للجداول الجديدة
alter table public.profile_links enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.reputation_events enable row level security;
alter table public.user_stats enable row level security;
alter table public.posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_reports enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_activity enable row level security;
alter table public.knowledge_categories enable row level security;
alter table public.knowledge_articles enable row level security;
alter table public.article_reactions enable row level security;
alter table public.article_views enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.ticket_activity enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;

-- سياسات RLS أساسية لضمان استخدام البيانات بشكل صحيح
-- يمكن تعديل هذه السياسات حسب الحاجة لتشمل أدوار إضافية أو شروط أكثر تعقيدًا.

/*

-- سياسات المنشورات (posts)
create policy if not exists posts_select on public.posts
  for select using (true);
create policy if not exists posts_insert on public.posts
  for insert with check (auth.uid() = author_id);
create policy if not exists posts_update on public.posts
  for update using (author_id = auth.uid() or (
    select role from public.profiles where id = auth.uid()
  ) in ('owner','admin','moderator'));
create policy if not exists posts_delete on public.posts
  for delete using (author_id = auth.uid() or (
    select role from public.profiles where id = auth.uid()
  ) in ('owner','admin','moderator'));

-- سياسات تعليقات المنشورات (post_comments)
create policy if not exists post_comments_select on public.post_comments
  for select using (true);
create policy if not exists post_comments_insert on public.post_comments
  for insert with check (auth.uid() = author_id);
create policy if not exists post_comments_update on public.post_comments
  for update using (author_id = auth.uid() or (
    select role from public.profiles where id = auth.uid()
  ) in ('owner','admin','moderator'));
create policy if not exists post_comments_delete on public.post_comments
  for delete using (author_id = auth.uid() or (
    select role from public.profiles where id = auth.uid()
  ) in ('owner','admin','moderator'));

-- سياسات المقالات (knowledge_articles)
create policy if not exists articles_select on public.knowledge_articles
  for select using (is_private = false or author_id = auth.uid() or (
    select role from public.profiles where id = auth.uid()
  ) in ('owner','admin','moderator'));
create policy if not exists articles_insert on public.knowledge_articles
  for insert with check (auth.uid() = author_id);
create policy if not exists articles_update on public.knowledge_articles
  for update using (author_id = auth.uid() or (
    select role from public.profiles where id = auth.uid()
  ) in ('owner','admin','moderator'));
create policy if not exists articles_delete on public.knowledge_articles
  for delete using (author_id = auth.uid() or (
    select role from public.profiles where id = auth.uid()
  ) in ('owner','admin','moderator'));

-- سياسات التذاكر (support_tickets)
create policy if not exists tickets_select on public.support_tickets
  for select using (creator_id = auth.uid() or (
    select role from public.profiles where id = auth.uid()
  ) in ('owner','admin','moderator'));
create policy if not exists tickets_insert on public.support_tickets
  for insert with check (auth.uid() = creator_id);
create policy if not exists tickets_update on public.support_tickets
  for update using (creator_id = auth.uid() or (
    select role from public.profiles where id = auth.uid()
  ) in ('owner','admin','moderator'));
create policy if not exists tickets_delete on public.support_tickets
  for delete using ((
    select role from public.profiles where id = auth.uid()
  ) in ('owner','admin','moderator'));

-- سياسات رسائل التذاكر (ticket_messages)
create policy if not exists ticket_messages_select on public.ticket_messages
  for select using (exists (
    select 1 from public.support_tickets t
    where t.id = ticket_messages.ticket_id
      and (t.creator_id = auth.uid() or (
        select role from public.profiles where id = auth.uid()
      ) in ('owner','admin','moderator'))
  ));
create policy if not exists ticket_messages_insert on public.ticket_messages
  for insert with check (exists (
    select 1 from public.support_tickets t
    where t.id = ticket_messages.ticket_id
      and (t.creator_id = auth.uid() or (
        select role from public.profiles where id = auth.uid()
      ) in ('owner','admin','moderator'))
  ));

-- سياسات المهام (tasks)
create policy if not exists tasks_select on public.tasks
  for select using (true);
create policy if not exists tasks_insert on public.tasks
  for insert with check (true);
create policy if not exists tasks_update on public.tasks
  for update using (true);
create policy if not exists tasks_delete on public.tasks
  for delete using ((
    select role from public.profiles where id = auth.uid()
  ) in ('owner','admin','moderator'));

-- سياسات الإعلانات (announcements)
create policy if not exists announcements_select on public.announcements
  for select using (active = true or (
    select role from public.profiles where id = auth.uid()
  ) in ('owner','admin','moderator'));
create policy if not exists announcements_insert on public.announcements
  for insert with check ((
    select role from public.profiles where id = auth.uid()
  ) in ('owner','admin','moderator'));
create policy if not exists announcements_update on public.announcements
  for update using ((
    select role from public.profiles where id = auth.uid()
  ) in ('owner','admin','moderator'));
create policy if not exists announcements_delete on public.announcements
  for delete using ((
    select role from public.profiles where id = auth.uid()
  ) in ('owner','admin','moderator'));

-- سياسات الرسائل العامة (messages)
alter table public.messages enable row level security;
-- يمكن لأي عضو في الغرفة أو مرسل الرسالة أو أصحاب الأدوار العليا قراءة الرسائل
create policy if not exists messages_select on public.messages
  for select using (
    exists (
      select 1 from public.room_members rm
        where rm.room_id = messages.room_id
          and rm.user_id = auth.uid()
    )
    or messages.sender_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin','moderator'))
  );
-- يمكن لأي عضو في الغرفة إدراج رسالة جديدة
create policy if not exists messages_insert on public.messages
  for insert with check (
    exists (
      select 1 from public.room_members rm
        where rm.room_id = messages.room_id
          and rm.user_id = auth.uid()
    )
  );
-- تعديل الرسالة مسموح فقط للمرسل
create policy if not exists messages_update on public.messages
  for update using (messages.sender_id = auth.uid());
-- حذف الرسالة مسموح فقط للمرسل أو للأدوار العليا
create policy if not exists messages_delete on public.messages
  for delete using (
    messages.sender_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin','moderator'))
  );

-- سياسات الرسائل الخاصة (private_messages)
alter table public.private_messages enable row level security;
-- يمكن للأطراف المشاركة في المحادثة قراءة الرسائل الخاصة
create policy if not exists private_messages_select on public.private_messages
  for select using (
    exists (
      select 1 from public.private_conversations pc
        where pc.id = private_messages.conversation_id
          and (pc.user1_id = auth.uid() or pc.user2_id = auth.uid())
    )
  );
-- يمكن للأطراف المشاركة في المحادثة إدراج رسائل خاصة
create policy if not exists private_messages_insert on public.private_messages
  for insert with check (
    exists (
      select 1 from public.private_conversations pc
        where pc.id = private_messages.conversation_id
          and (pc.user1_id = auth.uid() or pc.user2_id = auth.uid())
    )
  );
-- تعديل رسائل خاصة غير مسموح حاليًا
create policy if not exists private_messages_update on public.private_messages
  for update using (false);
-- يمكن للمرسل حذف رسالته الخاصة
create policy if not exists private_messages_delete on public.private_messages
  for delete using (private_messages.sender_id = auth.uid());

-- سياسات الغرف (rooms)
alter table public.rooms enable row level security;
-- قراءة الغرف متاحة للجميع إذا كانت عامة، أو إذا كان المستخدم عضوًا فيها، أو لديه دور مرتفع
create policy if not exists rooms_select on public.rooms
  for select using (
    rooms.type = 'public'
    or exists (
      select 1 from public.room_members rm
        where rm.room_id = rooms.id and rm.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin','moderator'))
  );
-- إنشاء غرفة متاح لجميع المستخدمين المسجلين
create policy if not exists rooms_insert on public.rooms
  for insert with check (auth.uid() is not null);
-- تعديل الغرفة مسموح فقط للمالك أو الأدمن أو المشرف
create policy if not exists rooms_update on public.rooms
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin','moderator'))
  );
-- حذف الغرفة مسموح فقط للمالك أو الأدمن
create policy if not exists rooms_delete on public.rooms
  for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin'))
  );

*/

-- ==================================================================
-- New row level security policies for all tables
-- These policies drop any existing policies and create new ones.
-- They avoid using "if not exists" and remove references to new.*
-- ==================================================================

-- === profiles ===
alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  -- عند إنشاء أو إدراج صف في profiles من الواجهة يجب أن يكون معرف المستخدم مطابقًا لمعرف الجلسة
  -- ويجب ألا يتم رفع الدور أو تغيير حالة الحساب بشكل مباشر. هذه السياسة تمنع المستخدمين
  -- من تحديد دور أعلى أو تغيير الحالة الافتراضية عند إنشاء ملفهم الشخصي.
  for insert with check (
    id = auth.uid()
    and role = 'user'
    and status = 'active'
  );
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (
    -- السماح بالتحديث إذا كان المستخدم يعدل ملفه أو لديه دور أعلى
    id = auth.uid() or (
      select role from public.profiles p where p.id = auth.uid()
    ) in ('owner','admin','moderator')
  )
  with check (
    -- المستخدم العادي يمكنه تعديل ملفه ولكن لا يمكنه تغيير الدور أو الحالة
    (
      id = auth.uid()
      and role = (select role from public.profiles p where p.id = auth.uid())
      and status = (select status from public.profiles p where p.id = auth.uid())
    )
    -- الأدوار العليا يمكنها تعديل أي حقل بما في ذلك role و status
    or (select role from public.profiles p where p.id = auth.uid()) in ('owner','admin')
  );
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin'))
  );

-- === profile_links ===
alter table public.profile_links enable row level security;
drop policy if exists profile_links_select on public.profile_links;
create policy profile_links_select on public.profile_links
  for select using (true);
drop policy if exists profile_links_insert on public.profile_links;
create policy profile_links_insert on public.profile_links
  for insert with check (
    user_id = auth.uid() or (
      select role from public.profiles p where p.id = auth.uid()
    ) in ('owner','admin','moderator')
  );
drop policy if exists profile_links_update on public.profile_links;
create policy profile_links_update on public.profile_links
  for update using (
    user_id = auth.uid() or (
      select role from public.profiles p where p.id = auth.uid()
    ) in ('owner','admin','moderator')
  );
drop policy if exists profile_links_delete on public.profile_links;
create policy profile_links_delete on public.profile_links
  for delete using (
    user_id = auth.uid() or (
      select role from public.profiles p where p.id = auth.uid()
    ) in ('owner','admin','moderator')
  );

-- === badges ===
alter table public.badges enable row level security;
drop policy if exists badges_select on public.badges;
create policy badges_select on public.badges
  for select using (true);
drop policy if exists badges_insert on public.badges;
create policy badges_insert on public.badges
  for insert with check ((select role from public.profiles where id = auth.uid()) in ('owner','admin'));
drop policy if exists badges_update on public.badges;
create policy badges_update on public.badges
  for update using ((select role from public.profiles where id = auth.uid()) in ('owner','admin'));
drop policy if exists badges_delete on public.badges;
create policy badges_delete on public.badges
  for delete using ((select role from public.profiles where id = auth.uid()) in ('owner','admin'));

-- === user_badges ===
alter table public.user_badges enable row level security;
drop policy if exists user_badges_select on public.user_badges;
create policy user_badges_select on public.user_badges
  for select using (true);
drop policy if exists user_badges_insert on public.user_badges;
create policy user_badges_insert on public.user_badges
  for insert with check ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));
drop policy if exists user_badges_delete on public.user_badges;
create policy user_badges_delete on public.user_badges
  for delete using (
    user_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );

-- === reputation_events ===
alter table public.reputation_events enable row level security;
drop policy if exists reputation_events_select on public.reputation_events;
create policy reputation_events_select on public.reputation_events
  for select using (true);
drop policy if exists reputation_events_insert on public.reputation_events;
create policy reputation_events_insert on public.reputation_events
  for insert with check ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));
drop policy if exists reputation_events_delete on public.reputation_events;
create policy reputation_events_delete on public.reputation_events
  for delete using ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));

-- === user_stats ===
alter table public.user_stats enable row level security;
drop policy if exists user_stats_select on public.user_stats;
create policy user_stats_select on public.user_stats
  for select using (true);
drop policy if exists user_stats_update on public.user_stats;
create policy user_stats_update on public.user_stats
  for update using ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));

-- === posts ===
-- تمكين RLS لجدول المنشورات وتحديد السياسات بحيث يمكن لأي شخص القراءة
-- ويمكن للمؤلف أو الأدوار العليا إنشاء وتعديل وحذف منشوراتهم
alter table public.posts enable row level security;
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select using (true);
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert with check (posts.author_id = auth.uid());
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts
  for update using (
    posts.author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  )
  with check (
    -- لا يسمح بتغيير author_id إلا من قبل الأدوار العليا
    (posts.author_id = auth.uid())
    or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts
  for delete using (
    posts.author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );

-- === rooms ===
alter table public.rooms enable row level security;
drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms
  for select using (
    rooms.type = 'public'
    or exists (select 1 from public.room_members rm where rm.room_id = rooms.id and rm.user_id = auth.uid())
    or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );
drop policy if exists rooms_insert on public.rooms;
create policy rooms_insert on public.rooms
  for insert with check (auth.uid() is not null);
drop policy if exists rooms_update on public.rooms;
create policy rooms_update on public.rooms
  for update using ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));
drop policy if exists rooms_delete on public.rooms;
create policy rooms_delete on public.rooms
  for delete using ((select role from public.profiles where id = auth.uid()) in ('owner','admin'));

-- === room_members ===
alter table public.room_members enable row level security;
drop policy if exists room_members_select on public.room_members;
create policy room_members_select on public.room_members
  for select using (
    exists (select 1 from public.rooms r where r.id = room_members.room_id and r.type = 'public')
    or room_members.user_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );
drop policy if exists room_members_insert on public.room_members;
create policy room_members_insert on public.room_members
  for insert with check (
    -- إذا كان المستخدم ينضم بنفسه فيجب أن يكون عضوًا عاديًا وليس لديه مدة كتم
    (
      room_members.user_id = auth.uid()
      and coalesce(room_members.role, 'member') = 'member'
      and room_members.muted_until is null
    )
    -- يمكن للأدوار العليا إضافة أعضاء أو تعيين أدوار أخرى
    or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );
drop policy if exists room_members_update on public.room_members;
create policy room_members_update on public.room_members
  for update using (
    (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );
drop policy if exists room_members_delete on public.room_members;
create policy room_members_delete on public.room_members
  for delete using (
    room_members.user_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );

-- === messages ===
alter table public.messages enable row level security;
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select using (
    exists (select 1 from public.room_members rm where rm.room_id = messages.room_id and rm.user_id = auth.uid())
    or messages.sender_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (
    -- يجب أن يكون المرسل عضواً في الغرفة وأن يكون معرف المرسل هو المستخدم الحالي
    exists (select 1 from public.room_members rm where rm.room_id = messages.room_id and rm.user_id = auth.uid())
    and messages.sender_id = auth.uid()
  );
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
  for update using (
    messages.sender_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
  for delete using (
    messages.sender_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );

-- === message_reactions ===
alter table public.message_reactions enable row level security;
drop policy if exists message_reactions_select on public.message_reactions;
create policy message_reactions_select on public.message_reactions
  for select using (
    exists (select 1 from public.messages m where m.id = message_reactions.message_id and (
      exists (select 1 from public.room_members rm where rm.room_id = m.room_id and rm.user_id = auth.uid())
      or m.sender_id = auth.uid()
      or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
    ))
  );
drop policy if exists message_reactions_insert on public.message_reactions;
create policy message_reactions_insert on public.message_reactions
  for insert with check (
    exists (select 1 from public.messages m where m.id = message_reactions.message_id and exists (select 1 from public.room_members rm where rm.room_id = m.room_id and rm.user_id = auth.uid()))
    and message_reactions.user_id = auth.uid()
  );
drop policy if exists message_reactions_delete on public.message_reactions;
create policy message_reactions_delete on public.message_reactions
  for delete using (
    message_reactions.user_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );

-- === private_conversations ===
alter table public.private_conversations enable row level security;
drop policy if exists private_conversations_select on public.private_conversations;
create policy private_conversations_select on public.private_conversations
  for select using (
    user1_id = auth.uid() or user2_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );
drop policy if exists private_conversations_insert on public.private_conversations;
create policy private_conversations_insert on public.private_conversations
  for insert with check (
    user1_id = auth.uid() or user2_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );
drop policy if exists private_conversations_delete on public.private_conversations;
create policy private_conversations_delete on public.private_conversations
  for delete using (
    user1_id = auth.uid() or user2_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );

-- === private_messages ===
alter table public.private_messages enable row level security;
drop policy if exists private_messages_select on public.private_messages;
create policy private_messages_select on public.private_messages
  for select using (
    exists (
      select 1 from public.private_conversations pc
        where pc.id = private_messages.conversation_id
          and (pc.user1_id = auth.uid() or pc.user2_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'))
    )
  );
drop policy if exists private_messages_insert on public.private_messages;
create policy private_messages_insert on public.private_messages
  for insert with check (
    exists (
      select 1 from public.private_conversations pc
        where pc.id = private_messages.conversation_id
          and (pc.user1_id = auth.uid() or pc.user2_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'))
    )
    and private_messages.sender_id = auth.uid()
  );
drop policy if exists private_messages_delete on public.private_messages;
create policy private_messages_delete on public.private_messages
  for delete using (
    private_messages.sender_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );

-- === reports ===
alter table public.reports enable row level security;
drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports
  for select using (
    reports.reporter_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert with check (reports.reporter_id = auth.uid());
drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports
  for update using ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));
drop policy if exists reports_delete on public.reports;
create policy reports_delete on public.reports
  for delete using ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));

-- === moderation_logs ===
alter table public.moderation_logs enable row level security;
drop policy if exists moderation_logs_select on public.moderation_logs;
create policy moderation_logs_select on public.moderation_logs
  for select using ((select role from public.profiles where id = auth.uid()) in ('owner','admin'));
drop policy if exists moderation_logs_insert on public.moderation_logs;
create policy moderation_logs_insert on public.moderation_logs
  for insert with check ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));

-- === owner_settings ===
alter table public.owner_settings enable row level security;
drop policy if exists owner_settings_select on public.owner_settings;
create policy owner_settings_select on public.owner_settings
  for select using (
    -- يمكن قراءة الإعدادات إذا كانت عامة
    owner_settings.is_public = true
    -- أو إذا كان لدى المستخدم دور أعلى من مستخدم عادي
    or (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );
drop policy if exists owner_settings_update on public.owner_settings;
create policy owner_settings_update on public.owner_settings
  for update using ((select role from public.profiles where id = auth.uid()) in ('owner','admin'));

-- السماح بإدراج إعدادات جديدة فقط من قبل المالك أو الأدمن
drop policy if exists owner_settings_insert on public.owner_settings;
create policy owner_settings_insert on public.owner_settings
  for insert with check ((select role from public.profiles where id = auth.uid()) in ('owner','admin'));

-- === announcements ===
alter table public.announcements enable row level security;
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select using (
    announcements.active = true or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );
drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements
  for insert with check ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));
drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements
  for update using ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));
drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete on public.announcements
  for delete using ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));

-- === user_blocks ===
alter table public.user_blocks enable row level security;
drop policy if exists user_blocks_select on public.user_blocks;
create policy user_blocks_select on public.user_blocks
  for select using (
    user_blocks.blocker_id = auth.uid() or user_blocks.blocked_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );
drop policy if exists user_blocks_insert on public.user_blocks;
create policy user_blocks_insert on public.user_blocks
  for insert with check (user_blocks.blocker_id = auth.uid());
drop policy if exists user_blocks_delete on public.user_blocks;
create policy user_blocks_delete on public.user_blocks
  for delete using (user_blocks.blocker_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin'));

-- === notifications ===
alter table public.notifications enable row level security;
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (notifications.user_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin'));
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (notifications.user_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin'));

-- === audit_events ===
alter table public.audit_events enable row level security;
drop policy if exists audit_events_select on public.audit_events;
create policy audit_events_select on public.audit_events
  for select using ((select role from public.profiles where id = auth.uid()) in ('owner','admin'));

-- === post_reactions ===
alter table public.post_reactions enable row level security;
drop policy if exists post_reactions_select on public.post_reactions;
create policy post_reactions_select on public.post_reactions
  for select using (true);
drop policy if exists post_reactions_insert on public.post_reactions;
create policy post_reactions_insert on public.post_reactions
  for insert with check (post_reactions.user_id = auth.uid());
drop policy if exists post_reactions_delete on public.post_reactions;
create policy post_reactions_delete on public.post_reactions
  for delete using (post_reactions.user_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));

-- === post_comments ===
alter table public.post_comments enable row level security;
drop policy if exists post_comments_select on public.post_comments;
create policy post_comments_select on public.post_comments
  for select using (true);
drop policy if exists post_comments_insert on public.post_comments;
create policy post_comments_insert on public.post_comments
  for insert with check (post_comments.author_id = auth.uid());
drop policy if exists post_comments_update on public.post_comments;
create policy post_comments_update on public.post_comments
  for update using (post_comments.author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));
drop policy if exists post_comments_delete on public.post_comments;
create policy post_comments_delete on public.post_comments
  for delete using (post_comments.author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));

-- === post_reports ===
alter table public.post_reports enable row level security;
drop policy if exists post_reports_select on public.post_reports;
create policy post_reports_select on public.post_reports
  for select using (post_reports.reporter_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));
drop policy if exists post_reports_insert on public.post_reports;
create policy post_reports_insert on public.post_reports
  for insert with check (post_reports.reporter_id = auth.uid());
drop policy if exists post_reports_update on public.post_reports;
create policy post_reports_update on public.post_reports
  for update using ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));
drop policy if exists post_reports_delete on public.post_reports;
create policy post_reports_delete on public.post_reports
  for delete using ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));

-- === projects ===
alter table public.projects enable row level security;
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select using (
    exists (select 1 from public.project_members pm where pm.project_id = projects.id and pm.user_id = auth.uid())
    or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert with check (
    -- يجب أن يكون المنشئ هو مالك المشروع
    projects.owner_id = auth.uid()
  );
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update using (
    projects.owner_id = auth.uid() or exists (select 1 from public.project_members pm where pm.project_id = projects.id and pm.user_id = auth.uid() and pm.role in ('moderator','admin','owner')) or (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete using (projects.owner_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin'));

-- === project_members ===
alter table public.project_members enable row level security;
drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
  for select using (
    project_members.user_id = auth.uid() or exists (select 1 from public.project_members pm2 where pm2.project_id = project_members.project_id and pm2.user_id = auth.uid()) or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );
drop policy if exists project_members_insert on public.project_members;
create policy project_members_insert on public.project_members
  for insert with check (
    -- إذا كان المستخدم يضيف نفسه فيجب أن يكون عضوًا عاديًا
    (
      project_members.user_id = auth.uid()
      and coalesce(project_members.role, 'member') = 'member'
    )
    -- السماح لصاحب المشروع أو للأدوار العليا بإضافة أعضاء أو تعيين رتب أعلى
    or (
      (select role from public.profiles where id = auth.uid()) in ('owner','admin')
      or exists (select 1 from public.projects p where p.id = project_members.project_id and p.owner_id = auth.uid())
    )
  );
drop policy if exists project_members_update on public.project_members;
create policy project_members_update on public.project_members
  for update using (
    exists (select 1 from public.projects p where p.id = project_members.project_id and p.owner_id = auth.uid()) or (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );
drop policy if exists project_members_delete on public.project_members;
create policy project_members_delete on public.project_members
  for delete using (
    project_members.user_id = auth.uid() or exists (select 1 from public.projects p where p.id = project_members.project_id and p.owner_id = auth.uid()) or (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );

-- === tasks ===
alter table public.tasks enable row level security;
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select using (
    exists (select 1 from public.project_members pm where pm.project_id = tasks.project_id and pm.user_id = auth.uid()) or (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert with check (
    exists (select 1 from public.project_members pm where pm.project_id = tasks.project_id and pm.user_id = auth.uid()) or (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update using (
    tasks.assignee_id = auth.uid() or exists (select 1 from public.projects p where p.id = tasks.project_id and p.owner_id = auth.uid()) or (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete using (
    tasks.assignee_id = auth.uid() or exists (select 1 from public.projects p where p.id = tasks.project_id and p.owner_id = auth.uid()) or (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );

-- === task_comments ===
alter table public.task_comments enable row level security;
drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments
  for select using (true);
drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert on public.task_comments
  for insert with check (task_comments.author_id = auth.uid());
drop policy if exists task_comments_update on public.task_comments;
create policy task_comments_update on public.task_comments
  for update using (task_comments.author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin'));
drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete on public.task_comments
  for delete using (task_comments.author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin'));

-- === task_activity ===
alter table public.task_activity enable row level security;
drop policy if exists task_activity_select on public.task_activity;
create policy task_activity_select on public.task_activity
  for select using ((select role from public.profiles where id = auth.uid()) in ('owner','admin'));
drop policy if exists task_activity_insert on public.task_activity;
create policy task_activity_insert on public.task_activity
  for insert with check ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));

-- === knowledge_categories ===
alter table public.knowledge_categories enable row level security;
drop policy if exists knowledge_categories_select on public.knowledge_categories;
create policy knowledge_categories_select on public.knowledge_categories
  for select using (true);
drop policy if exists knowledge_categories_insert on public.knowledge_categories;
create policy knowledge_categories_insert on public.knowledge_categories
  for insert with check ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));
drop policy if exists knowledge_categories_update on public.knowledge_categories;
create policy knowledge_categories_update on public.knowledge_categories
  for update using ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));
drop policy if exists knowledge_categories_delete on public.knowledge_categories;
create policy knowledge_categories_delete on public.knowledge_categories
  for delete using ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));

-- === knowledge_articles ===
alter table public.knowledge_articles enable row level security;
drop policy if exists knowledge_articles_select on public.knowledge_articles;
create policy knowledge_articles_select on public.knowledge_articles
  for select using (
    knowledge_articles.is_private = false or knowledge_articles.author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );
drop policy if exists knowledge_articles_insert on public.knowledge_articles;
create policy knowledge_articles_insert on public.knowledge_articles
  for insert with check (knowledge_articles.author_id = auth.uid());
drop policy if exists knowledge_articles_update on public.knowledge_articles;
create policy knowledge_articles_update on public.knowledge_articles
  for update using (knowledge_articles.author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));
drop policy if exists knowledge_articles_delete on public.knowledge_articles;
create policy knowledge_articles_delete on public.knowledge_articles
  for delete using (knowledge_articles.author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));

-- === article_reactions ===
alter table public.article_reactions enable row level security;
drop policy if exists article_reactions_select on public.article_reactions;
create policy article_reactions_select on public.article_reactions
  for select using (true);
drop policy if exists article_reactions_insert on public.article_reactions;
create policy article_reactions_insert on public.article_reactions
  for insert with check (article_reactions.user_id = auth.uid());
drop policy if exists article_reactions_delete on public.article_reactions;
create policy article_reactions_delete on public.article_reactions
  for delete using (article_reactions.user_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));

-- === article_views ===
alter table public.article_views enable row level security;
drop policy if exists article_views_select on public.article_views;
create policy article_views_select on public.article_views
  for select using (true);
drop policy if exists article_views_insert on public.article_views;
create policy article_views_insert on public.article_views
  for insert with check (article_views.user_id = auth.uid());

-- === support_tickets ===
alter table public.support_tickets enable row level security;
drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
  for select using (
    support_tickets.creator_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );
drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
  for insert with check (support_tickets.creator_id = auth.uid());
drop policy if exists support_tickets_update on public.support_tickets;
create policy support_tickets_update on public.support_tickets
  for update using (
    support_tickets.creator_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );
drop policy if exists support_tickets_delete on public.support_tickets;
create policy support_tickets_delete on public.support_tickets
  for delete using ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));

-- === ticket_messages ===
alter table public.ticket_messages enable row level security;
drop policy if exists ticket_messages_select on public.ticket_messages;
create policy ticket_messages_select on public.ticket_messages
  for select using (
    exists (select 1 from public.support_tickets t where t.id = ticket_messages.ticket_id and (t.creator_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')))
  );
drop policy if exists ticket_messages_insert on public.ticket_messages;
create policy ticket_messages_insert on public.ticket_messages
  for insert with check (
    exists (select 1 from public.support_tickets t where t.id = ticket_messages.ticket_id and (t.creator_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')))
  );
drop policy if exists ticket_messages_delete on public.ticket_messages;
create policy ticket_messages_delete on public.ticket_messages
  for delete using (
    ticket_messages.sender_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator')
  );

-- === ticket_activity ===
alter table public.ticket_activity enable row level security;
drop policy if exists ticket_activity_select on public.ticket_activity;
create policy ticket_activity_select on public.ticket_activity
  for select using ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));
drop policy if exists ticket_activity_insert on public.ticket_activity;
create policy ticket_activity_insert on public.ticket_activity
  for insert with check ((select role from public.profiles where id = auth.uid()) in ('owner','admin','moderator'));

-- === roles ===
alter table public.roles enable row level security;
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select using ((select role from public.profiles where id = auth.uid()) in ('owner','admin'));
drop policy if exists roles_insert on public.roles;
create policy roles_insert on public.roles
  for insert with check ((select role from public.profiles where id = auth.uid()) in ('owner'));
drop policy if exists roles_update on public.roles;
create policy roles_update on public.roles
  for update using ((select role from public.profiles where id = auth.uid()) in ('owner'));
drop policy if exists roles_delete on public.roles;
create policy roles_delete on public.roles
  for delete using ((select role from public.profiles where id = auth.uid()) in ('owner'));

-- === role_permissions ===
alter table public.role_permissions enable row level security;
drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select using ((select role from public.profiles where id = auth.uid()) in ('owner','admin'));
drop policy if exists role_permissions_insert on public.role_permissions;
create policy role_permissions_insert on public.role_permissions
  for insert with check ((select role from public.profiles where id = auth.uid()) in ('owner'));
drop policy if exists role_permissions_delete on public.role_permissions;
create policy role_permissions_delete on public.role_permissions
  for delete using ((select role from public.profiles where id = auth.uid()) in ('owner'));

-- === profile auto creation ===
-- عند إنشاء مستخدم جديد في جدول auth.users نقوم بإنشاء صف في جدول profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- إذا لم يكن هناك صف للملف الشخصي، أنشئ واحدًا بشكل افتراضي
  insert into public.profiles (id, username, display_name, created_at, updated_at)
  values (new.id, new.email, split_part(new.email, '@', 1), now(), now())
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();