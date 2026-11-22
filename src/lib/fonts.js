/**
 * Real typefaces, bundled locally (no network at runtime).
 *
 * ReadEra's UI is Roboto on Android; because this app is Hebrew-first we pair
 * Roboto with Noto Sans Hebrew (the Hebrew face Android itself falls back to)
 * so both scripts sit on the same metrics. The reader's default face is
 * Merriweather — the face ReadEra shows in its FONT FACE row — with Noto Serif
 * Hebrew covering Hebrew glyphs at the same weight.
 *
 * Only the `latin` and `hebrew` subsets are pulled in on purpose: the default
 * `400.css` files would also ship cyrillic, greek, vietnamese, math and symbol
 * cuts that this app can never display (≈1 MB of fonts → ≈250 KB) while the
 * rendered glyphs stay byte-for-byte the same.
 */

/* UI — Latin (Roboto) */
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-700.css';

/* UI — Hebrew (Noto Sans Hebrew) */
import '@fontsource/noto-sans-hebrew/hebrew-400.css';
import '@fontsource/noto-sans-hebrew/hebrew-500.css';
import '@fontsource/noto-sans-hebrew/hebrew-700.css';
import '@fontsource/noto-sans-hebrew/latin-400.css';
import '@fontsource/noto-sans-hebrew/latin-500.css';
import '@fontsource/noto-sans-hebrew/latin-700.css';

/* Reader — Latin (Merriweather) */
import '@fontsource/merriweather/latin-400.css';
import '@fontsource/merriweather/latin-400-italic.css';
import '@fontsource/merriweather/latin-700.css';

/* Reader — Hebrew (Noto Serif Hebrew) */
import '@fontsource/noto-serif-hebrew/hebrew-400.css';
import '@fontsource/noto-serif-hebrew/hebrew-700.css';
import '@fontsource/noto-serif-hebrew/latin-400.css';
import '@fontsource/noto-serif-hebrew/latin-700.css';
