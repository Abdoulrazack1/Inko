// eslint.config.js — Lint du frontend vanilla (audit B-3)
// Objectif principal : empêcher que de nouveaux catch muets réapparaissent
// (no-empty avec allowEmptyCatch:false attrape les `catch (e) {}`). Volontairement
// minimal — le front n'a pas de bundler, on ne veut pas d'un lint bruyant, juste
// un garde-fou sur les erreurs avalées et quelques pièges classiques.
'use strict';

module.exports = [
    {
        files: ['assets/js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
        },
        rules: {
            'no-empty': ['error', { allowEmptyCatch: false }],
            'no-unused-vars': 'off',   // trop de faux positifs sur le style IIFE/globals
            'no-undef': 'off',         // globals window.MH/API non déclarés formellement
        },
    },
];
