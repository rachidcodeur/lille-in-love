-- =====================================================================
--  LILLE IN LOVE — Un match qui ne se rate pas
--  À exécuter après 17_notifications.sql.
--
--  Celui qui ferme la boucle voit son match tout de suite. L'autre, non :
--  il a peut-être le téléphone en poche, ou l'application fermée. Jusqu'ici
--  il l'apprenait par une notification, et en ouvrant l'application il
--  trouvait… une liste. Le moment de la soirée passait à la trappe.
--
--  On note donc, de chaque côté, si la personne a vu l'annonce. Un match
--  pas encore vu se rejoue à l'ouverture, avec le même éclat.
--
--  Deux colonnes et non une : les deux personnes ne regardent pas leur
--  téléphone au même moment, et c'est bien tout le problème.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

alter table public.lil_crush_matches
  add column if not exists vu_a_at timestamptz,
  add column if not exists vu_b_at timestamptz;

comment on column public.lil_crush_matches.vu_a_at is
  'Date à laquelle a_id a vu l''annonce du match. Vide = elle lui sera rejouée à sa prochaine ouverture.';

comment on column public.lil_crush_matches.vu_b_at is
  'Date à laquelle b_id a vu l''annonce du match. Vide = elle lui sera rejouée à sa prochaine ouverture.';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lil_crush_matches'
      and column_name = 'vu_a_at'
  ) then
    raise exception 'La trace des annonces vues n''est pas en place.';
  end if;

  raise notice 'Les matchs non vus se rejoueront à l''ouverture.';
end $$;
