-- Migración inicial del framework de chatbots.
-- ⚠️ NO se ha aplicado a ningún proyecto real. La aplica el dueño (ver PASOS-HUMANOS.md):
--    Supabase → SQL Editor → pegar este archivo → Run.  (o `supabase db push` con la CLI)
-- El servidor usa la service role key (solo backend). RLS activado sin políticas públicas: nadie desde el
-- navegador puede leer conversaciones.

create table if not exists public.conversations (
  bot_id        text        not null,
  user_id       text        not null,
  channel       text,
  paused        boolean     not null default false,
  fields        jsonb       not null default '{}'::jsonb,
  data          jsonb       not null,           -- estado completo (Conversation del framework)
  message_count integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (bot_id, user_id)
);
create index if not exists conversations_updated_idx on public.conversations (bot_id, updated_at desc);

create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  bot_id      text        not null,
  user_id     text        not null,
  role        text        not null check (role in ('user', 'assistant', 'system')),
  text        text        not null,
  channel     text,
  tool_calls  jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages (bot_id, user_id, created_at);

-- Interesados / pedidos (guardar_lead)
create table if not exists public.leads (
  id          text        primary key,
  bot_id      text        not null,
  user_id     text        not null,
  data        jsonb       not null,
  created_at  timestamptz not null default now()
);
create index if not exists leads_bot_idx on public.leads (bot_id, created_at desc);

-- Derivaciones a humanos
create table if not exists public.handoffs (
  id          text        primary key,
  bot_id      text        not null,
  user_id     text        not null,
  destino     text        not null,
  motivo      text        not null,
  prioridad   text        not null default 'normal' check (prioridad in ('normal', 'alta')),
  resumen     text,
  atendido    boolean     not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists handoffs_pending_idx on public.handoffs (bot_id, atendido, created_at desc);

alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.leads         enable row level security;
alter table public.handoffs      enable row level security;
