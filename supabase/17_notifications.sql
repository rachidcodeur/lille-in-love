-- =====================================================================
--  LILLE IN LOVE — Notifier l'ouverture d'un crush time et les matchs
--  À exécuter après 16_code_personnel.sql.
--
--  Deux moments, deux seulement : quand une manche s'ouvre, et quand un
--  match se fait. Un like reste muet — le notifier dirait à l'autre qu'il
--  a été choisi, et ce serait la fin du jeu.
--
--  Le reste de ce qu'il faut était déjà là : lil_crush_push, créée par
--  13_crushtime.sql, garde les abonnements des navigateurs. Il manquait
--  une trace de ce qui a été envoyé — sans elle, deux appuis sur
--  « Ouvrir » enverraient cent notifications.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

alter table public.lil_crush_rounds
  add column if not exists notifie_at timestamptz;

comment on column public.lil_crush_rounds.notifie_at is
  'Date du dernier envoi de la notification d''ouverture. Rouvrir une manche prévient de nouveau ; seuls deux appuis à moins d''une minute d''intervalle ne sonnent qu''une fois.';

alter table public.lil_crush_matches
  add column if not exists notifie_at timestamptz;

comment on column public.lil_crush_matches.notifie_at is
  'Date d''envoi de la notification aux deux personnes. Un match ne s''annonce qu''une fois.';

-- Un abonnement mort se reconnaît à ses refus répétés ; on les compte pour
-- pouvoir faire le ménage plutôt que de réessayer indéfiniment.
comment on column public.lil_crush_push.echecs is
  'Refus consécutifs du service de notification. Au-delà de quelques-uns, l''abonnement est effacé : le téléphone a été réinstallé, ou l''application désinstallée.';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lil_crush_rounds'
      and column_name = 'notifie_at'
  ) then
    raise exception 'La trace des notifications n''est pas en place.';
  end if;

  raise notice 'Notifications prêtes. Renseigne VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY.';
end $$;
