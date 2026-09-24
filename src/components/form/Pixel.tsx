'use client';

import Script from 'next/script';
import { BRAND } from '@/lib/brand';

/**
 * Le pixel Meta, sur les pages publiques seulement.
 *
 * Il sert à mesurer ce que rapportent les campagnes : une visite, puis une
 * candidature envoyée. Il n'est jamais chargé dans l'espace de curation —
 * les curateurs ne sont pas une audience, et leurs pages montrent des
 * données personnelles qui n'ont rien à faire chez un annonceur.
 *
 * Le formulaire vit dans une iframe posée sur in-love.fr : le pixel doit
 * donc être présent des deux côtés, ici et sur la page WordPress, pour que
 * la visite et la conversion se rattachent à la même personne.
 */
export function Pixel() {
  if (!BRAND.pixelId) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${BRAND.pixelId}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt=""
          src={`https://www.facebook.com/tr?id=${BRAND.pixelId}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
