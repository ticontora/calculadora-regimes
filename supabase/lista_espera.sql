-- Lista de espera (validação). O site só pode INSERIR; ler fica restrito ao painel do Supabase.
create table if not exists public.lista_espera (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  nome text not null check (char_length(nome) between 1 and 120),
  escritorio text not null check (char_length(escritorio) between 1 and 160),
  email text not null unique check (char_length(email) <= 160),
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,15}$'),
  clientes text not null check (char_length(clientes) <= 40),
  preco text not null check (char_length(preco) <= 40),
  interesse text check (char_length(interesse) <= 1000),
  pagaria_pix boolean not null default false,
  origem text check (char_length(origem) <= 200)
);
alter table public.lista_espera enable row level security;
drop policy if exists "site insere" on public.lista_espera;
create policy "site insere" on public.lista_espera for insert to anon with check (true);
revoke select, update, delete on public.lista_espera from anon, authenticated;
