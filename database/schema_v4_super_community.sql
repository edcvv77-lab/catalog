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