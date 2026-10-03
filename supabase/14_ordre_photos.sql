-- =====================================================================
--  LILLE IN LOVE — Ranger les photos d'une candidature
--  À exécuter après 13_crushtime.sql.
--
--  La première photo est celle qu'on voit partout : dans la liste du
--  back-office, et surtout sur le profil pendant le crush time, où elle
--  décide à peu près seule du sort de la personne. Il faut donc pouvoir
--  choisir laquelle c'est.
--
--  Ce qui l'empêchait : « unique (member_id, position) ». Échanger deux
--  positions passe forcément par un état où deux photos se disputent la
--  même place. Rendre la contrainte « deferrable » déplace sa vérification
--  à la fin de la transaction : l'état intermédiaire a le droit d'exister,
--  le résultat non.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La contrainte se vérifie à la fin, pas à chaque ligne
-- ---------------------------------------------------------------------
do $$
declare nom text;
begin
  select conname into nom
    from pg_constraint
   where conrelid = 'public.lil_photos'::regclass
     and contype = 'u'
     and pg_get_constraintdef(oid) like '%member_id, %position%';

  if nom is not null and not (
    select condeferrable from pg_constraint where conname = nom
      and conrelid = 'public.lil_photos'::regclass
  ) then
    execute format('alter table public.lil_photos drop constraint %I', nom);
    nom := null;
  end if;

  if nom is null then
    alter table public.lil_photos
      add constraint lil_photos_member_position_key
      unique (member_id, position) deferrable initially deferred;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Ranger, en une seule transaction
--
--  On passe la liste des identifiants dans l'ordre voulu. Tout se joue
--  dans une transaction : si quoi que ce soit échoue, l'ordre d'avant
--  reste, et personne ne se retrouve avec deux photos en position 1.
-- ---------------------------------------------------------------------
create or replace function public.lil_ranger_photos(p_member uuid, p_ordre uuid[])
returns void
language plpgsql
as $$
declare i int;
begin
  if p_ordre is null or array_length(p_ordre, 1) is null then
    return;
  end if;

  -- Toutes les photos passées doivent appartenir à cette candidature :
  -- sans ce garde-fou, un identifiant glissé dans la liste déplacerait la
  -- photo de quelqu'un d'autre.
  if exists (
    select 1 from unnest(p_ordre) as demande(id)
     where not exists (
       select 1 from public.lil_photos p
        where p.id = demande.id and p.member_id = p_member
     )
  ) then
    raise exception 'Une des photos n''appartient pas à cette candidature.';
  end if;

  for i in 1 .. array_length(p_ordre, 1) loop
    update public.lil_photos
       set position = i
     where id = p_ordre[i];
  end loop;
end $$;

comment on function public.lil_ranger_photos(uuid, uuid[]) is
  'Réordonne les photos d''une candidature. La position 1 est celle qui s''affiche partout, y compris sur le profil du crush time.';

-- Seul le serveur appelle cette fonction, avec la clé service_role.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.lil_ranger_photos(uuid, uuid[]) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.lil_ranger_photos(uuid, uuid[]) from authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Vérification
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.lil_photos'::regclass
       and contype = 'u' and condeferrable
       and pg_get_constraintdef(oid) like '%member_id, %position%'
  ) then
    raise exception 'La contrainte (member_id, position) n''est pas différable : les photos ne pourront pas être échangées.';
  end if;

  raise notice 'Les photos peuvent être rangées. Aucune n''a bougé.';
end $$;
