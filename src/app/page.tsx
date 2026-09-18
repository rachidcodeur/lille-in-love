import { redirect } from 'next/navigation';

/**
 * La racine mène au back-office.
 *
 * Le formulaire, lui, n'est jamais visité directement : il vit dans l'iframe
 * posée sur in-love.fr/inscription/, servie par /embed et /embed/court. Ces
 * deux adresses restent ouvertes dans un navigateur, ce qui suffit pour
 * relire le questionnaire en local.
 */
export default function Racine() {
  redirect('/admin');
}
