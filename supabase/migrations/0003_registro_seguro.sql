-- =====================================================================
--  0003 · Registro seguro
--  - Redención de código ATÓMICA (evita exceder asientos por carrera).
--  - Compensación (liberar un uso si el alta falla después de reservar).
--  - Bitácora de intentos para rate limiting (antifuerza bruta).
--  - Código de registro más fuerte también en la función SQL.
--  Idempotente. Supabase -> SQL Editor -> pegar todo -> Run.
-- =====================================================================

-- ------------------------------------------------------------------
-- 1. Bitácora de intentos de registro (rate limiting).
--    Solo la escribe/lee el servidor (service role). Sin políticas RLS:
--    anon/authenticated no la alcanzan; el service role ignora RLS.
-- ------------------------------------------------------------------
create table if not exists public.registration_attempts (
  id    bigserial primary key,
  ip    text,
  code  text,
  ok    boolean not null default false,
  at    timestamptz not null default now()
);
create index if not exists idx_reg_attempts_ip_at
  on public.registration_attempts (ip, at desc);
alter table public.registration_attempts enable row level security;

-- ------------------------------------------------------------------
-- 2. Redención ATÓMICA: valida el código e incrementa `uses` en un solo
--    paso, con FOR UPDATE, para que dos registros simultáneos no puedan
--    pasar ambos la validación y exceder los asientos.
-- ------------------------------------------------------------------
create or replace function public.redeem_registration_code(p_code text, p_email text)
returns table (company_id uuid, role company_role, code_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.registration_codes%rowtype;
begin
  select * into v from public.registration_codes where code = p_code for update;

  if not found then
    raise exception 'CODE_INVALID';
  end if;
  if v.expires_at is not null and v.expires_at < now() then
    raise exception 'CODE_EXPIRED';
  end if;
  if v.uses >= v.max_uses then
    raise exception 'CODE_EXHAUSTED';
  end if;
  if v.email is not null and lower(v.email::text) <> lower(p_email) then
    raise exception 'CODE_EMAIL_MISMATCH';
  end if;

  update public.registration_codes set uses = uses + 1 where id = v.id;

  company_id := v.company_id;
  role := v.role;
  code_id := v.id;
  return next;
end;
$$;

-- ------------------------------------------------------------------
-- 3. Compensación: libera un uso si el alta falla después de reservarlo.
-- ------------------------------------------------------------------
create or replace function public.release_registration_code(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.registration_codes set uses = greatest(uses - 1, 0) where id = p_id;
$$;

-- ------------------------------------------------------------------
-- 4. Estas funciones SOLO las llama el servidor (service role). Se les
--    quita el permiso de ejecución a todos los demás para que un usuario
--    autenticado no pueda invocarlas por PostgREST y sondear/gastar códigos.
-- ------------------------------------------------------------------
revoke execute on function public.redeem_registration_code(text, text) from public;
revoke execute on function public.redeem_registration_code(text, text) from anon;
revoke execute on function public.redeem_registration_code(text, text) from authenticated;
revoke execute on function public.release_registration_code(uuid) from public;
revoke execute on function public.release_registration_code(uuid) from anon;
revoke execute on function public.release_registration_code(uuid) from authenticated;

-- ------------------------------------------------------------------
-- 5. Código de registro más fuerte en la función SQL (consistencia con la
--    app): 8 hex (~4.3 mil millones) en vez de 4 (65 mil).
-- ------------------------------------------------------------------
create or replace function public.generate_registration_code(p_name text)
returns text
language plpgsql
as $$
declare
  v_prefix text;
  v_suffix text;
  v_code   text;
begin
  v_prefix := upper(regexp_replace(unaccent_fallback(p_name), '[^a-zA-Z]', '', 'g'));
  v_prefix := left(coalesce(nullif(v_prefix, ''), 'AMK'), 5);

  loop
    v_suffix := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
    v_code := format('AMK-%s-%s-%s', to_char(now(), 'YYYY'), v_prefix, v_suffix);
    exit when not exists (select 1 from public.registration_codes where code = v_code);
  end loop;

  return v_code;
end;
$$;
