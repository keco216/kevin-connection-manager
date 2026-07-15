/*
 * Farbschema-Wahl (hell / dunkel / wie im System).
 *
 * Guacamole 1.6 kennt kein Farbschema. Die Wahl gehört daher uns: Sie liegt im
 * localStorage und landet als data-kb-theme am <html>-Element, worauf css/
 * kevin.css reagiert.
 *
 * WICHTIG: Das Attribut wird IMMER gesetzt, auch bei „Wie im System“ – die
 * Systemvorgabe wird hier per matchMedia aufgelöst. Dadurch braucht die CSS
 * nur einen Regelsatz für Dunkel; mit einer zusätzlichen
 * prefers-color-scheme-Query stünde dieselbe Palette doppelt in der Datei und
 * müsste doppelt gepflegt werden.
 *
 * Das Auswahlfeld liefert der HTML-Patch html/kevin-theme.html; es existiert
 * erst, wenn die Präferenzen-Seite gerendert ist. Angular baut es beim
 * Seitenwechsel jedes Mal neu auf, weshalb hier weder ein einmaliges
 * querySelector noch ein Listener am Feld selbst genügt:
 *   - Änderungen fängt ein delegierter Listener am document ab (überlebt jeden
 *     Neuaufbau),
 *   - den angezeigten Wert setzt ein MutationObserver, sobald das Feld
 *     auftaucht.
 */
(function () {
    'use strict';

    var SPEICHER_SCHLUESSEL = 'kevin-theme';
    var FELD_ID = 'kevin-theme-select';
    var ERLAUBT = ['system', 'light', 'dark'];

    var systemDunkel = window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;

    function gewaehltesSchema() {
        try {
            var wert = window.localStorage.getItem(SPEICHER_SCHLUESSEL);
            return ERLAUBT.indexOf(wert) !== -1 ? wert : 'system';
        } catch (e) {
            // Privater Modus o. Ä.: dann eben ohne Gedächtnis
            return 'system';
        }
    }

    function anwenden(schema) {
        var wirksam = schema;
        if (wirksam === 'system')
            wirksam = systemDunkel && systemDunkel.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-kb-theme', wirksam);
    }

    function merken(schema) {
        try {
            window.localStorage.setItem(SPEICHER_SCHLUESSEL, schema);
        } catch (e) {
            // Nicht speicherbar – die Wahl gilt dann nur für diese Sitzung
        }
    }

    // So früh wie möglich anwenden, sonst blitzt die helle Oberfläche auf,
    // bevor das Attribut steht.
    anwenden(gewaehltesSchema());

    // Wechselt das System (Windows-Einstellung) und steht die Wahl auf
    // „Wie im System“, muss die Oberfläche mitziehen – ohne Neuladen.
    if (systemDunkel) {
        var beiSystemwechsel = function () {
            if (gewaehltesSchema() === 'system')
                anwenden('system');
        };
        if (systemDunkel.addEventListener)
            systemDunkel.addEventListener('change', beiSystemwechsel);
        else if (systemDunkel.addListener)
            systemDunkel.addListener(beiSystemwechsel); // ältere Engines
    }

    // Delegiert: Das Feld wird bei jedem Seitenwechsel neu gebaut, ein
    // Listener direkt daran wäre danach weg.
    document.addEventListener('change', function (event) {
        var ziel = event.target;
        if (!ziel || ziel.id !== FELD_ID)
            return;
        var schema = ERLAUBT.indexOf(ziel.value) !== -1 ? ziel.value : 'system';
        merken(schema);
        anwenden(schema);
    });

    // Sobald das Feld auftaucht: auf den gespeicherten Wert stellen. Ohne das
    // stünde dort immer „Wie im System“, egal was gilt.
    function feldAbgleichen() {
        var feld = document.getElementById(FELD_ID);
        if (feld && feld.value !== gewaehltesSchema())
            feld.value = gewaehltesSchema();
    }

    function beobachten() {
        feldAbgleichen();
        new MutationObserver(feldAbgleichen).observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    if (document.body)
        beobachten();
    else
        document.addEventListener('DOMContentLoaded', beobachten);
})();
