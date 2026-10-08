'use client';

import { nomManche, heureDeParis } from '@/lib/crush-regles';
import { Compte } from './Compte';

/**
 * Entre deux crush times.
 *
 * On ne laisse pas un écran vide : les horaires annoncés disent quand
 * revenir, et la salle fait le reste.
 */
export function CrushAttente({
  manches,
}: {
  manches: { numero: number; prevu_a: string; passee: boolean }[];
}) {
  const prochaine = manches.find((m) => !m.passee);
  const heure = heureDeParis;

  return (
    <div className="cr-attente">
      <p className="cr-attente-mot">
        {prochaine
          ? 'Le prochain crush time n’est pas encore ouvert.'
          : 'Les crush times sont terminés.'}
      </p>

      {/* Savoir qu'il reste dix-huit minutes change la soirée : on va
          parler à quelqu'un au lieu de regarder son téléphone. */}
      {prochaine && new Date(prochaine.prevu_a).getTime() > Date.now() && (
        <p className="cr-attente-compte">
          Dans <Compte jusqua={prochaine.prevu_a} />
        </p>
      )}

      <ol className="cr-horaires">
        {manches.map((m) => (
          <li
            key={m.numero}
            data-passee={m.passee || undefined}
            data-prochaine={m === prochaine || undefined}
          >
            <span>{nomManche(m.numero)}</span>
            <b>{heure(m.prevu_a)}</b>
          </li>
        ))}
      </ol>

      <p className="cr-aide">
        {prochaine
          ? 'Chacun dure quinze minutes. Garde ton téléphone à portée.'
          : 'Tes matchs restent accessibles en haut de l’écran.'}
      </p>
    </div>
  );
}
