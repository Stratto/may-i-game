# Switching on live sharing (Supabase)

May I? works fully offline on one device. To let a whole table follow a group on their own phones, connect a free Supabase project. Takes about 10 minutes.

## 1. Create the project
1. Sign up at supabase.com and create a new project (free tier is fine).
2. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.

## 2. Run this SQL
Open **SQL Editor → New query**, paste, and run:

```sql
create table if not exists public.mayi_groups (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  doc jsonb not null,
  updated_at bigint not null default 0
);
alter table public.mayi_groups enable row level security;
-- No policies: the table can only be reached through the two functions below.

create or replace function public.mayi_get_group(p_code text)
returns jsonb language sql security definer set search_path = public as $$
  select doc from mayi_groups where code = upper(p_code);
$$;

create or replace function public.mayi_put_group(p_code text, p_doc jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if octet_length(p_doc::text) > 500000 then raise exception 'group too large'; end if;
  insert into mayi_groups (code, doc, updated_at)
  values (upper(p_code), p_doc, coalesce((p_doc->>'updatedAt')::bigint, 0))
  on conflict (code) do update
    set doc = excluded.doc, updated_at = excluded.updated_at
    where mayi_groups.updated_at <= excluded.updated_at;  -- newest write wins
end;
$$;

revoke all on function public.mayi_get_group(text) from public;
revoke all on function public.mayi_put_group(text, jsonb) from public;
grant execute on function public.mayi_get_group(text) to anon, authenticated;
grant execute on function public.mayi_put_group(text, jsonb) to anon, authenticated;
```

Live updates use Supabase Realtime **Broadcast** on a channel named `mayi-<CODE>`. It needs no extra setup.

## 3. Paste the keys into the app
In `index.html`, near the top of the app script:

```js
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "eyJ...";
```

The anon key is meant to be public. Commit, push, and the Share sheet will start working.

## What to know
- **A group code is the only key.** Anyone who has the 6-character code can view and edit that group. Codes are random (about 900 million combinations), but don't post one publicly.
- The whole group (players + games) syncs as one document. If two phones edit at the exact same moment, the newer save wins.
- Everything still works offline. Changes sync when the phone reconnects and the app is open.
