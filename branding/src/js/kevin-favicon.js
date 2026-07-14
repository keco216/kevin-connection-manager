/*
 * Kevin Connection Manager – Favicon-Tausch.
 * Die <link rel="icon">-Tags stehen in der index.html (kein Angular-
 * Template, HTML-Patches greifen dort nicht) und zeigen auf Guacamoles
 * grünes Logo – Browser wie Vivaldi färben danach sogar den Tab ein.
 * Extension-JS läuft nach dem DOM-Aufbau: Stock-Icons raus, K-Logo
 * (bereits registrierte Extension-Ressource) als SVG-Favicon rein,
 * plus theme-color in Navy für die Tab-/PWA-Färbung.
 */
(function kevinFavicon() {

    'use strict';

    var FAVICON = 'app/ext/kevin-branding/images/kevin-logo.svg';
    var NAVY = '#0F1E3D';

    // Guacamoles Favicon- und Touch-Icon-Links entfernen
    var links = document.querySelectorAll(
        'link[rel~="icon"], link[rel="apple-touch-icon"]');
    Array.prototype.forEach.call(links, function (link) {
        link.parentNode.removeChild(link);
    });

    // K-Logo als Favicon
    var icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/svg+xml';
    icon.href = FAVICON;
    document.head.appendChild(icon);

    // Tab-/Adressleisten-Färbung (Vivaldi/Chromium) auf Marken-Navy
    var themeColor = document.querySelector('meta[name="theme-color"]');
    if (!themeColor) {
        themeColor = document.createElement('meta');
        themeColor.name = 'theme-color';
        document.head.appendChild(themeColor);
    }
    themeColor.content = NAVY;

}());
