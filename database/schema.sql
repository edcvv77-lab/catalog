-- schema.sql
-- مخطط قاعدة بيانات متقدمة لمنصة الدردشة

-- تأكد من تفعيل امتداد uuid-ossp لإنتاج معرفات UUID تلقائية
create extension if not exists "uuid-ossp";

--
-- جدول الملفات الشخصية للمستخدمين
-- يرتبط مباشرة بجدول auth.users في Supabase
--
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

--
-- جدول الغرف (القنوات)
-- يحتوي على خصائص إضافية مثل النوع ووضع القفل والأرشفة وغيرها
--
create table if not exists public.rooms (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    slug text not null unique,
    description text,
    avatar_url text,
    type text not null default 'public', -- public / private / secret
    owner_id uuid references auth.users(id),
    slow_mode_seconds integer not null default 0,
    is_locked boolean not null default false,
    is_archived boolean not null default false,
    created_at timestamptz default now()
);

--
-- عضويات الغرف
-- تربط كل مستخدم بالغرفة مع دوره داخل الغرفة
--
create table if not exists public.room_members (
    room_id uuid references public.rooms(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    role text not null default 'member', -- member / mod / admin / owner
    muted_until timestamptz,
    joined_at timestamptz default now(),
    primary key (room_id, user_id)
);

--
-- جدول الرسائل للغرف
-- يدعم أنواع متعددة من الرسائل والرد والتعديل والحذف والتثبيت
--
create table if not exists public.messages (
    id uuid primary key default uuid_generate_v4(),
    room_id uuid references public.rooms(id) on delete cascade,
    sender_id uuid references auth.users(id),
    content text not null,
    message_type text not null default 'text', -- text / image / file / system / announcement
    reply_to uuid references public.messages(id) on delete set null,
    edited_at timestamptz,
    deleted_at timestamptz,
    deleted_by uuid references auth.users(id),
    pinned boolean not null default false,
    created_at timestamptz default now()
);

--
-- تفاعلات الرسائل (Reactions)
-- تخزن رمز الـ emoji والمستخدم الذي قام بالتفاعل
--
create table if not exists public.message_reactions (
    id uuid primary key default uuid_generate_v4(),
    message_id uuid references public.messages(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    emoji text not null,
    created_at timestamptz default now()
);

--
-- المحادثات الخاصة بين شخصين
--
create table if not exists public.private_conversations (
    id uuid primary key default uuid_generate_v4(),
    user1_id uuid references auth.users(id) on delete cascade,
    user2_id uuid references auth.users(id) on delete cascade,
    created_at timestamptz default now(),
    unique (user1_id, user2_id)
);

--
-- الرسائل الخاصة داخل المحادثات
--
create table if not exists public.private_messages (
    id uuid primary key default uuid_generate_v4(),
    conversation_id uuid references public.private_conversations(id) on delete cascade,
    sender_id uuid references auth.users(id),
    content text not null,
    reply_to uuid references public.private_messages(id) on delete set null,
    seen_at timestamptz,
    edited_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz default now()
);

--
-- البلاغات ضد المستخدمين أو الرسائل أو الغرف
--
create table if not exists public.reports (
    id uuid primary key default uuid_generate_v4(),
    reporter_id uuid references auth.users(id),
    target_type text not null, -- message / user / room
    target_id uuid not null,
    reason text,
    status text not null default 'open', -- open / reviewing / resolved / rejected
    admin_note text,
    created_at timestamptz default now()
);

--
-- سجل الإجراءات الإدارية
--
create table if not exists public.moderation_logs (
    id uuid primary key default uuid_generate_v4(),
    actor_id uuid references auth.users(id),
    action text not null,
    target_type text not null,
    target_id uuid not null,
    reason text,
    metadata jsonb,
    created_at timestamptz default now()
);

--
-- إعدادات المالك العامة
--
create table if not exists public.owner_settings (
    key text primary key,
    value jsonb,
    updated_at timestamptz default now()
);

--
-- الإعلانات عبر المنصة أو داخل غرفة معينة
--
create table if not exists public.announcements (
    id uuid primary key default uuid_generate_v4(),
    title text not null,
    body text not null,
    audience text not null default 'all', -- all / room / role
    room_id uuid references public.rooms(id) on delete cascade,
    created_by uuid references auth.users(id),
    active boolean not null default true,
    created_at timestamptz default now()
);

--
-- قائمة الحظر بين المستخدمين
--
create table if not exists public.user_blocks (
    blocker_id uuid references auth.users(id),
    blocked_id uuid references auth.users(id),
    created_at timestamptz default now(),
    primary key (blocker_id, blocked_id)
);

--
-- الإشعارات للمستخدمين
--
create table if not exists public.notifications (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    type text not null,
    title text,
    body text,
    read_at timestamptz,
    metadata jsonb,
    created_at timestamptz default now()
);

--
-- أحداث التدقيق (audit events) لمراقبة الأنشطة
--
create table if not exists public.audit_events (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id),
    event_type text not null,
    ip_hint text,
    user_agent_hint text,
    metadata jsonb,
    created_at timestamptz default now()
);

--
-- تمكين سياسات التحكم في الصفوف (RLS) لجميع الجداول
--
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.private_conversations enable row level security;
alter table public.private_messages enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_logs enable row level security;
alter table public.owner_settings enable row level security;
alter table public.announcements enable row level security;
alter table public.user_blocks enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;

--
-- هنا أمثلة على سياسات RLS. يجب تعديل السياسات حسب الحاجة.
-- هذه السياسات توفر الأساس للأمان وتحتاج إلى توسيع وفق متطلباتك.

-- مثال: سماح لجميع المستخدمين بقراءة profiles مع منع التحديث إلا لصاحب الحساب
-- create policy profiles_select on public.profiles for select using (true);
-- create policy profiles_update on public.profiles for update using (auth.uid() = id);

-- مثال: السماح بقراءة الغرف العامة وقراءة الغرف الخاصة للأعضاء فقط
-- create policy rooms_select_public on public.rooms for select using (type = 'public');
-- create policy rooms_select_private on public.rooms for select using (
--   type <> 'public' and exists(
--     select 1 from public.room_members m where m.room_id = id and m.user_id = auth.uid()
--   )
-- );

-- مثال: السماح للمستخدمين بإدخال رسائل في الغرف التي هم أعضاء فيها
-- create policy messages_insert on public.messages for insert with check (
--   exists(
--     select 1 from public.room_members m where m.room_id = room_id and m.user_id = auth.uid()
--   )
-- );

-- أضف سياسات مشابهة للجداول الأخرى (reactions, private messages, reports...)