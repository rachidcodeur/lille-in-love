-- =====================================================================
--  LILLE IN LOVE — « Autrement », précisé
--  À exécuter après 20_matching.sql.
--
--  « Comment tu nous as connus ? » proposait « Autrement » sans la suite,
--  ce qui ne nous apprenait rien : c'est précisément la réponse dont on a
--  besoin qu'elle soit détaillée, puisque c'est la seule qu'on n'a pas
--  prévue. Un champ s'ouvre désormais quand on la choisit.
--
--  Facultative : sans elle, le formulaire tourne, la précision n'est
--  simplement pas gardée.
--
--  Idempotent : relançable sans risque.
-- =====================================================================

alter table public.lil_members
  add column if not exists referral_other text;

comment on column public.lil_members.referral_other is
  'Précision libre, quand « Comment tu nous as connus ? » vaut « autrement ».';

do $$
begin
  raise notice 'La précision de « Autrement » sera conservée.';
end $$;
