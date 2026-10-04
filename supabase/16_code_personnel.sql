-- =====================================================================
--  LILLE IN LOVE — Un code à quatre chiffres par personne
--  À exécuter après 15_duree_manches.sql.
--
--  Le QR affiché dans la salle est forcément le même pour tout le monde :
--  imprimer cinquante QR personnels coûte trop cher. Il mène donc à un
--  écran qui demande qui vous êtes.
--
--  Jusqu'ici, la preuve était le code de la soirée, annoncé à voix haute :
--  qui connaissait une adresse email entrait à la place de son
--  propriétaire. Chacun reçoit maintenant le sien, par le mail de la
--  veille. Le code de la soirée reste, mais comme filet de l'hôte pour
--  celui qui ne retrouve plus son mail.
--
--  Pas d'unicité sur ce code : c'est l'email qui dit qui vous êtes, le code
--  ne fait que le prouver. Deux personnes peuvent tirer 4812 sans que cela
--  prête à conséquence.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

alter table public.lil_crush_participants
  add column if not exists code text;

do $$ begin
  alter table public.lil_crush_participants
    add constraint lil_crush_participants_code_forme
    check (code is null or code ~ '^[0-9]{4}$');
  exception when duplicate_object then null;
end $$;

comment on column public.lil_crush_participants.code is
  'Les quatre chiffres reçus par email. Avec son adresse, ils suffisent à entrer depuis le QR de la salle.';

-- Les participants déjà inscrits avant cette migration n'en ont pas :
-- on leur en tire un, sinon ils ne pourraient plus entrer que par le code
-- de la soirée.
update public.lil_crush_participants
   set code = lpad((floor(random() * 9000) + 1000)::int::text, 4, '0')
 where code is null;

-- Entrer, c'est chercher une adresse dans une soirée : autant que ce soit
-- immédiat, un soir où cinquante personnes le font en même temps.
create index if not exists lil_crush_participants_entree_idx
  on public.lil_crush_participants (soiree_id, email)
  where retire_at is null;

do $$
begin
  if exists (select 1 from public.lil_crush_participants where code is null) then
    raise exception 'Des participants n''ont pas de code.';
  end if;

  raise notice 'Chacun a son code à quatre chiffres. Aucune soirée n''a été touchée.';
end $$;
