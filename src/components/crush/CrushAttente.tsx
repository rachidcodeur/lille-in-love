'use client';

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
  const heure = (iso: string) =>
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="cr-attente">
      <p className="cr-attente-mot">
        {prochaine ? 'Le prochain crush time n’est pas encore ouvert.' : 'Les crush times sont terminés.'}
      </p>

      <ol className="cr-horaires">
        {manches.map((m) => (
          <li key={m.numero} data-passee={m.passee || undefined} data-prochaine={m === prochaine || undefined}>
            <span>Crush time {m.numero}</span>
            <b>{heure(m.prevu_a)}</b>
          </li>
        ))}
      </ol>

      <p className="cr-aide">
        {prochaine
          ? 'Garde ton téléphone à portée : on te préviendra au moment d’ouvrir.'
          : 'Tes matchs restent accessibles ci-dessous.'}
      </p>
    </div>
  );
}
