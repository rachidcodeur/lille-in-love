-- =====================================================================
--  LILLE IN LOVE — Un crush time dure quinze minutes
--  À exécuter après 14_ordre_photos.sql.
--
--  Jusqu'ici une manche restait ouverte tant que l'hôte ne la refermait
--  pas. Un soir de soirée, personne ne refermera rien : l'hôte a autre
--  chose à faire, et une manche oubliée accepterait encore des likes à
--  minuit — ce qui viderait de son sens la règle du choix unique par
--  manche.
--
--  La durée est donc portée par la manche elle-même. L'ouverture reste un
--  geste ; la fermeture se fait toute seule, et l'hôte peut toujours
--  abréger.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

alter table public.lil_crush_rounds
  add column if not exists duree_minutes smallint not null default 15;

do $$ begin
  alter table public.lil_crush_rounds
    add constraint lil_crush_rounds_duree_plausible
    check (duree_minutes between 1 and 240);
  exception when duplicate_object then null;
end $$;

comment on column public.lil_crush_rounds.duree_minutes is
  'Combien de temps la manche reste ouverte une fois lancée. Au-delà, elle est close même si personne ne l''a refermée.';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lil_crush_rounds'
      and column_name = 'duree_minutes'
  ) then
    raise exception 'La durée des manches n''est pas en place.';
  end if;

  raise notice 'Les crush times durent quinze minutes par défaut. Aucune manche n''a bougé.';
end $$;
