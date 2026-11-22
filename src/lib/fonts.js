/**
 * Real typefaces, bundled locally (no network at runtime).
 *
 * ReadEra's UI is Roboto on Android; because this app is Hebrew-first we pair
 * Roboto with Noto Sans Hebrew (the Hebrew face Android itself falls back to)
 * so both scripts sit on the same metrics. The reader's default face is
 * Merriweather — the face ReadEra shows in its FONT FACE row — with Noto Serif
 * Hebrew covering Hebrew glyphs at the same weight.
 */

import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import '@fontsource/noto-sans-hebrew/400.css';
import '@fontsource/noto-sans-hebrew/500.css';
import '@fontsource/noto-sans-hebrew/700.css';

import '@fontsource/merriweather/400.css';
import '@fontsource/merriweather/400-italic.css';
import '@fontsource/merriweather/700.css';

import '@fontsource/noto-serif-hebrew/400.css';
import '@fontsource/noto-serif-hebrew/700.css';
