/**
 * Demo books – generated in-browser so the whole app (including the EPUB
 * parser) can be explored without any real files.
 * Creates: 1 EPUB (Hebrew story), 1 TXT (English), 1 FB2 (Hebrew).
 */

import { registerFileHandle } from './platform.js';

const EPUB_CHAPTERS = [
  {
    title: 'פרק 1 – ההתחלה',
    body: `<h1>פרק 1 – ההתחלה</h1>
<p>הבוקר עלה לאט על פני העיר. אור זהוב שטף את הרחובות הצרים, והצללים התארכו על המדרכות האפורות. מרים עמדה ליד החלון, כוס תה חמה בידה, והביטה אל הנוף המוכר כל כך – ועדיין, משהו היה שונה היום.</p>
<p>היא הייתה בטוחה ששמעה קול מהחדר הסמוך. לא קול של אדם, אלא משהו אחר – כמו רשרוש של דפים מתהפכים, או אולי צעד קל על הרצפה. היא הניחה את הכוס על השולחן והלכה לאט אל הדלת.</p>
<p>הדלת הייתה פתוחה מעט. היא דחפה אותה בעדינות, והחדר נגלה לפניה. על השולחן עמד ספר ישן, כריכתו חומה ובלויה, ודפיו פתוחים לרווחה. מרים התקרבה, וראתה שעל הדף כתוב משפט אחד בלבד: <em>"מי שקורא – חי פעמיים."</em></p>
<p>העיר התעוררה לאט. מוכר הלחם פתח את התריס, ומכונית אחת חלפה ברחוב הריק. מרים אהבה את השעה הזאת, שבה הכל עוד אפשרי והכל עוד שקט. היא לבשה מעילה, לקחה את המפתחות, ויצאה אל המדרגות הצרות שהובילו אל הרחוב.</p>
<p>בקצה הרחוב היה בית קפה קטן, כזה שאף אחד לא שם לב אליו. היא הזמינה קפה, התיישבה ליד החלון, ופתחה את המחברת. השורה הראשונה תמיד הייתה הקשה ביותר, אבל ברגע שנכתבה – כל השאר זרם מעצמו.</p>
<p>היא כתבה על הילדה מהספר, על הבית שעל הגבעה, על הדלת הירוקה באמצע הספרייה. היא כתבה עד שהקפה התקרר, ואז הזמינה עוד אחד.</p>
<p>בצהריים כבר היו שלושה עמודים מלאים. מרים קיפלה את המחברת, הניחה אותה בתיק, והביטה בחלון הראווה של החנות ממול – שם, בין הספרים המוצעים למכירה, עמד ספר בכריכה חומה ובלויה, בדיוק כמו זה שמצאה בעליית הגג.</p>
<p>היא נכנסה לחנות. הפעמון מעל הדלת צלצל. מאחורי הדלפק עמד איש זקן, והרים אליה מבט כאילו חיכה לה שנים.</p>
<p>"חיפשת משהו?" שאל.<br />"כן," אמרה. "את הספר הזה."<br />הוא חייך. "הוא חיכה לך."</p>`,
  },
  {
    title: 'פרק 2 – הספר הישן',
    body: `<h1>פרק 2 – הספר הישן</h1>
<p>מרים פתחה את הספר לאט. כל דף היה כתוב בכתב יד, כאילו מישהו ישב כאן שעות ארוכות וכתב את סיפור חייו. הסיפור סיפר על ילדה קטנה בעיר אחרת, בזמן אחר, אבל המילים היו מוכרות לה באופן מוזר.</p>
<p>"זה לא יכול להיות," לחשה לעצמה. "זה סיפור שלי. אבל אני לא זוכרת שכתבתי אותו."</p>
<p>היא המשיכה לקרוא. כל עמוד גילה פרט חדש – זיכרון נשכח, חלום ישן, פנים שלא ראתה שנים. ככל שהעמיקה בקריאה, כך הרגישה שהספר קורא אותה בחזרה, כאילו הוא מכיר אותה טוב יותר ממה שהיא מכירה את עצמה.</p>
<p>הספר היה כבד יותר ממה שנראה. הכריכה החומה נשחקה בשוליים, והדפים הצהיבו. בכל דף היה כתב יד אחר – כאילו עשרות אנשים כתבו בו, כל אחד פרק משלו, ואף אחד לא מחק את מה שכתב האדם שלפניו.</p>
<p>מרים ישבה על הרצפה, בין ארגזים מאובקים, וקראה. הסיפור הראשון היה על אישה שעזבה עיר גדולה כדי לגור בכפר קטן ליד הים. השני היה על נער שמצא מפתח באדמה. השלישי – על זקן ששתל עץ שידע שלא יראה אותו גדל.</p>
<p>כשהתקדמה לעמודים האחרונים, הלמו ליבה. שם, בכתב יד מוכר, היה סיפור על ילדה בשם מרים, שגרה בבית עם גג אדום, ושאהבה לקרוא מתחת לשמיכה עם פנס קטן.</p>
<p>היא סגרה את הספר, ונשמה עמוק. היה לה ברור עכשיו: הספר הזה אינו אוסף סיפורים. הוא אוסף של אנשים. ועכשיו, היא אחת מהם.</p>`,
  },
  {
    title: 'פרק 3 – הסוף וההתחלה',
    body: `<h1>פרק 3 – הסוף וההתחלה</h1>
<p>כשהגיעה לעמוד האחרון, מצאה את שמה כתוב בכתב יד מוכר. מתחת לשם, משפט אחד אחרון: <em>"עכשיו תורך לכתוב."</em></p>
<p>מרים סגרה את הספר לאט. השמש כבר שקעה, והחדר היה חשוך. היא הדליקה את המנורה, לקחה עט ומחברת, והתיישבה ליד השולחן. העט נע על הנייר, והמילים החלו לזרום – סיפור חדש, על ילדה בעיר אחרת, בזמן אחר.</p>
<p>אבל הפעם, היא ידעה בדיוק מי כותב אותו.</p>
<p>למחרת חזרה לחנות. הזקן כבר הכין לה כוס תה, וכשהושיט לה אותה אמר: "כל מי שקורא את הספר הזה מגיע לכאן בסוף. זה לא מקרה."</p>
<p>"ומה קורה עכשיו?" שאלה.<br />"עכשיו את כותבת," הוא אמר. "עמוד אחד. זה כל מה שנדרש."</p>
<p>מרים לקחה את העט. היד שלה רעדה קצת. היא חשבה על הילדה שקראה מתחת לשמיכה, על האישה שעזבה אל הים, על הזקן ששתל את העץ – וכתבה את השורה הראשונה שלה: <em>"בבוקר שבו הכל השתנה, מרים עוד לא ידעה שזה קורה."</em></p>
<p>היא הניחה את העט, וסגרה את הספר. על הכריכה, באותיות דהויות, היה כתוב רק דבר אחד: <strong>הספר הישן</strong>. היא חייכה, הניחה אותו בתיק, ויצאה אל הרחוב – שהיה, בפעם הראשונה מזה שנים, מלא באפשרויות.</p>`,
  },
];

const TXT_CONTENT = `The Library at the End of the World

Chapter 1
Elias had worked in the municipal library for thirty-seven years. He knew every shelf, every spine, every dust mote that danced in the afternoon light. But on the morning of his retirement, he found a door he had never seen before, tucked between the history section and the children's corner.

Chapter 2
The door was narrow and painted a deep, impossible green – the color of moss after rain. Elias pressed his palm against it. It was warm. From the other side came the faint sound of pages turning, though no one was supposed to be there.

Chapter 3
Inside, the library was larger than the building that held it. Shelves stretched in every direction, and every book was open. Elias understood, with a calm that surprised him, that this was where stories went when their readers were done with them – not to be forgotten, but to be remembered by the books themselves.

Chapter 4
He picked up the nearest volume. It was his own life, bound in blue cloth, and the last page was still blank. Elias smiled, took a seat at the reading table, and began to write.`;

const FB2_CONTENT = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gutenberg.org/2009/fb2" xmlns:xlink="http://www.w3.org/1999/xlink">
<description>
<title-info>
<genre>prose</genre>
<book-title>הבית על הגבעה</book-title>
<lang>he</lang>
<author><first-name>דוד</first-name><last-name>כהן</last-name></author>
</title-info>
</description>
<body>
<section>
<title><p>פרק ראשון</p></title>
<p>הבית על הגבעה עמד שם מאה שנה. אבן לבנה, גג אדום, וגן מלא עצי זית. יוסי גדל שם, ושיחק בין העצים עם אחיו הקטן. הם בנו מחבואים, המציאו סיפורים, וחלמו על העולם שמעבר לגבעה.</p>
<p>יום אחד, כשחזר מהצבא, מצא את הבית ריק. ההורים עברו לעיר, והבית עמד נטוש. יוסי נכנס לאט, שמע את חריקת הדלת, והריח את ריח האבק והזמן.</p>
</section>
<section>
<title><p>פרק שני</p></title>
<p>בחדר של אחיו מצא יוסי יומן ישן. הדפים היו מלאים בציורים ובכתב ילדותי. אחיו כתב על חלומותיו, על הרצון לראות את הים, על הבטחה שנתן לעצמו – לחזור הביתה יום אחד.</p>
<p>יוסי ישב על המיטה הישנה, והדמעות עלו בעיניו. הוא הבין שהבית לא היה רק קירות ואבן. הוא היה הזיכרון של כולם – המקום שאליו חוזרים, גם כשכבר לא גרים בו.</p>
</section>
</body>
</FictionBook>`;

async function buildDemoEpub() {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.folder('META-INF').file(
    'container.xml',
    `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  );
  const oebps = zip.folder('OEBPS');
  const manifestItems = EPUB_CHAPTERS.map(
    (c, i) => `<item id="ch${i}" href="ch${i}.xhtml" media-type="application/xhtml+xml"/>`,
  ).join('\n');
  const spineItems = EPUB_CHAPTERS.map((c, i) => `<itemref idref="ch${i}"/>`).join('\n');
  oebps.file(
    'content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="2.0">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
<dc:title>הספר הישן</dc:title>
<dc:creator>מרים לוי</dc:creator>
<dc:language>he</dc:language>
<dc:identifier id="BookID">urn:uuid:shoso-demo-1</dc:identifier>
</metadata>
<manifest>
${manifestItems}
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
</manifest>
<spine toc="ncx">
${spineItems}
</spine>
</package>`,
  );
  const navEntries = EPUB_CHAPTERS.map(
    (c, i) => `<navLabel><text>${c.title}</text><content src="ch${i}.xhtml"/></navLabel>`,
  ).join('\n');
  oebps.file(
    'toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="urn:uuid:shoso-demo-1"/></head>
<docTitle><text>הספר הישן</text></docTitle>
<navMap>${navEntries}</navMap>
</ncx>`,
  );
  EPUB_CHAPTERS.forEach((c, i) => {
    oebps.file(
      `ch${i}.xhtml`,
      `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="he" lang="he"><head><title>${c.title}</title></head><body>${c.body}</body></html>`,
    );
  });
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}


/* ---- extra demo titles so the library looks like a real collection ---- */

const EXTRA_TEXTS = [
  {
    name: 'מכתבים מן העמק.txt',
    title: 'מכתבים מן העמק',
    author: 'לאה שדה',
    format: 'TXT',
    body: `מכתבים מן העמק

אגרת ראשונה
השמש נטתה מערבה כשהגעתי אל שער המשק. הריח של שחת קצורה ושל אדמה לחה מילא את האוויר, ונדמה היה לי שאיני זקוק לשום דבר מלבד המקום הזה.

אגרת שנייה
בבוקר יצאנו אל השדה. הטל עוד ריחף על העלים, והפועלים עבדו בדממה. אמרו לי: כאן הזמן נמדד בקצב של העונות, לא בשעון.

אגרת שלישית
החורף הגיע. הגשם הכה בגג הפח כל הלילה, ואני ישבתי וקראתי לאור מנורה. במרחק נשמע כלב נובח, ואחר כך דממה.`,
  },
  {
    name: 'The Quiet Hours.txt',
    title: 'The Quiet Hours',
    author: 'Margaret Ellery',
    format: 'TXT',
    body: `The Quiet Hours

Chapter One
The house on Alder Street had been empty for eleven years, which was exactly as long as no one had been able to agree about who owned it. The windows were boarded, the garden had become a thicket, and the children of the neighbourhood had invented three separate stories about what lived inside.

Chapter Two
On a Tuesday in October, a woman arrived with a small suitcase and a ring of keys. She stood on the pavement for a long moment, looked up at the second floor, and said, quietly, "There you are."

Chapter Three
By evening the boards were down. By Friday there were curtains. By the end of the month, the house on Alder Street had a lamp in every window, and the street had forgotten it had ever been dark.`,
  },
  {
    name: 'מדריך הגן הקטן.md',
    title: 'מדריך הגן הקטן',
    author: 'עמוס גבע',
    format: 'MD',
    body: `# מדריך הגן הקטן

## אדמה
גן טוב מתחיל באדמה. ערבבו חומר אורגני, בדקו ניקוז, ואל תמהרו לזרוע.

## מים
השקו פחות ממה שנדמה לכם. אצבע בתוך האדמה היא המדד הטוב ביותר.

## עונות
באביב זורעים, בקיץ משקים, בסתיו קוצרים, בחורף מתכננים.

## הכלל היחיד
צמח שמתאים למקום גדל בלי מאמץ. צמח שלא מתאים – יגרום לכם לעבוד כל הקיץ.`,
  },
  {
    name: 'זיכרונות של ספרייה.html',
    title: 'זיכרונות של ספרייה',
    author: 'רחל בן-עמי',
    format: 'HTML',
    body: `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>זיכרונות של ספרייה</title></head><body>
<h1>זיכרונות של ספרייה</h1>
<p>שלושים שנה עמדתי בין המדפים. ראיתי ילדים מגיעים בגיל שש ויוצאים בגיל שמונה-עשרה, וכמה מהם חזרו עם ילדים משלהם.</p>
<p>הספרייה אינה אוסף של ספרים. היא אוסף של אנשים שקראו אותם, ולפעמים גם של אלה שרק החזיקו אותם ביד והתביישו לשאול.</p>
<p>בקומה השנייה, ליד החלון, היה כיסא אחד שהתלמידים כינו "הכיסא של המזל". אף אחד לא ידע מי קבע את זה, אבל הוא תמיד היה תפוס.</p>
</body></html>`,
  },
  {
    name: 'על הכתיבה.epub.txt',
    title: 'על הכתיבה',
    author: 'יוסף אריאל',
    format: 'TXT',
    body: `על הכתיבה

פרק ראשון – הפסקה הראשונה
כתיבה מתחילה בגסות. הטיוטה הראשונה אינה נועדה להיות טובה; היא נועדה להיות קיימת.

פרק שני – המחיקה
החלק הקשה אינו הכתיבה אלא ההחלטה מה יישאר. כל מילה שמוחקים מחזירה את הקורא אל מה שנשאר.

פרק שלישי – הקול
אין "קול" שנמצא מראש. הקול הוא מה שנשאר אחרי שמנקים את כל מה שאינו שלך.`,
  },
];

const hashString = (str) => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return (((h1 ^ (h2 >>> 16)) >>> 0).toString(16) + (h2 >>> 0).toString(16)).slice(0, 16);
};

const enc = (s) => new TextEncoder().encode(s).buffer;

export async function createDemoBooks() {
  const epubBuffer = await buildDemoEpub();
  const txtBuffer = enc(TXT_CONTENT);
  const fb2Buffer = enc(FB2_CONTENT);

  const mk = (name, title, author, ext, buffer, format) => {
    const id = hashString(`demo:${name}`);
    const file = new File([buffer], name, { type: 'application/octet-stream' });
    registerFileHandle(id, file);
    return {
      id,
      path: URL.createObjectURL(file),
      dir: 'ספרי דמו',
      fileName: name,
      title,
      author,
      language: format === 'EPUB' || format === 'FB2' ? 'he' : 'en',
      format,
      ext,
      size: buffer.byteLength,
      mtime: Date.now(),
      cover: null,
      pageCount: 0,
      chapters: 0,
      wordCount: 0,
      addedAt: Date.now(),
      _buffer: buffer,
    };
  };

  const extras = EXTRA_TEXTS.map((b) =>
    mk(b.name, b.title, b.author, `.${b.format.toLowerCase()}`, enc(b.body), b.format));

  return [
    mk('הספר הישן.epub', 'הספר הישן', 'מרים לוי', '.epub', epubBuffer, 'EPUB'),
    mk('The Library at the End of the World.txt', 'The Library at the End of the World', 'Elias Hart', '.txt', txtBuffer, 'TXT'),
    mk('הבית על הגבעה.fb2', 'הבית על הגבעה', 'דוד כהן', '.fb2', fb2Buffer, 'FB2'),
    ...extras,
  ];
}
