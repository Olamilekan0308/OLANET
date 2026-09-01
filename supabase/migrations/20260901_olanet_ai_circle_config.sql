create table if not exists public.circle_ai_configs (
  circle_id bigint primary key references public.circles(id) on delete cascade,
  ai_name text not null default 'OLANET AI',
  instructions text not null default '',
  knowledge text not null default '',
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.circle_ai_configs enable row level security;

create index if not exists circle_ai_configs_enabled_idx
  on public.circle_ai_configs(enabled);
