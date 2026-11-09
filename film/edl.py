"""Edit decision list for the film.

Events are declared in timeline order.  Graphics and narration are attached to
a shot *by id*, so inserting or trimming material never silently breaks the
placement of a card or a line of narration.

    ('V', id, file, start, dur, mode, motion, look, trans)    silent shot
    ('A', id, file, start, dur, mode, motion, look, trans)    shot with its own sound
    ('G', kind, shot_id, offset, {kwargs})                    graphic over that shot
    ('N', audio, [cues], shot_id, offset)                     narration starting there
"""

# ------------------------------------------------------------------ sources
F_BB = "בני ברק מהרחפן — נוף העיר והגגות — 1080p — גרסה קלה 45MB.mp4"
F_PENCIL = "00_07 וגם 07_01 — הרב לנדו לומד וכותב בעיפרון בגמרא — לב שומע — 1080p.mp4"
F_SUKKA = '00_34 וגם 08_05 וגם 08_38 — מרן הג"ד לנדו מדבר במעמד ריתחא דאורייתא, שלט "זכרון מעוז הרוח" ברקע — סוכת מרן הרב לנדו 2025 — 1080p.mp4'
F_HAKAFOT = "05_40 וגם 09_45 — הרב לנדו והרב הירש — הקפות שניות 2022 — 1080p.mp4"
F_KINUS = "08_05 — כינוס בוגרים לדורותם, ישיבת סלבודקה — סלבודקער — 1080p.mp4"
F_DANCE = "09_45 — הרב לנדו רוקד עם ספר תורה — הקפות בני חול אצל ראובן שראן — 720p.mp4"
F_WALK = "10_22 — הרב לנדו והרב הירש צועדים בסלבודקה בחנוכה 2024 — חלופה — 1080p.mp4"
F_NIGGUN = "2026-07-29 — ניגון רבי ברוך בער — לוגו בפינה אך גרפיקה על התמונה.mp4"
F_STORY = "[3.40] הרב לנדו מספר על המסע לארהב.mp4"
F_BLESS = "[9.07] הרב לנדו מברך את הבחורים.mp4"
F_KAB = "[9.08] קבלת פני רבו – הרב לנדו.mp4"
F_HOUSE = "בית הרב לנדו — וידאו חוץ ופנים — החצר המדרגות והכניסה עם קהל — פסח 2024 — 848x478.mp4"
F_TORAH = "הרב לנדו קורא בספר תורה בחדרו.mp4"
F_PL36 = "חסידים בקרקוב וורשה — פולין 1936 — ארכיון USHMM 3005 — עותק SD עם טיימקוד.mp4"
F_PL38 = "חסידים ברחוב ובשוק — כשאנוב פולין 1938 — ארכיון USHMM 4378 — 1080p עם טיימקוד.mp4"
F_ZILB = "לימוד_משותף_רבי_דוב_לנדו_ורבי_יצחק_זילברשטיין_3דקות_720p.mp4"
F_HOME = "21 · הרב יוצא מהבית בבוקר — שריפת חמץ סמוך למעונו (1080p).mp4"
F_PLANE = "21 · הרב צועד בדרכו למטוס (1080p).mp4"
F_PEOPLE = "22 · הרב עם אנשים פרטיים — ברכה נדירה (קטע).mp4"
F_HESPED = "10 · הספד הרב לנדו על הגר״ג אדלשטיין (1080p, קטע).mp4"

I_PORTRAIT = "2023 פרסום — דיוקן בחדר הלימוד — 7329x4888.jpg"
I_STILL = "00_07 וגם 06_01 — הרב לנדו לומד בחדרו — שוקי לרר — סטילס.jpg"
I_CROWD = "2023 פרסום — יוצא מהשיעור הכללי מוקף בתלמידים — 6720x4480.jpg"
I_HEVRON = "שורשים_רבי_דוב_לנדו_ורבי_ברוך_מרדכי_אזרחי_בצעירותם_ישיבת_חברון.jpg"
I_STRIKOV = "1985 תשמ״ה — י״ט שבט — בסעודת הילולא בסטריקוב.jpg"
I_KOLNIDRE = "slabodka_kolnidre_9.jpg"
I_PONEV = "landau_ponevezh_sicha_7.jpg"
I_WIKI = "[03.35] לנדו – דיוקן wikimedia.png"
I_STRVIS = "09_30 — הרב לנדו בביקור אצל האדמור מסטריקוב.jpg"
I_SEFER = "06_01 וגם 09_45 — הרב לנדו מחזיק ספר תורה פתוח — כיכר השבת — 1600px.jpg"
I_MAON = "06_01 — הרב לנדו במעון המרן עם רב, אוקטובר 2026 — כיכר השבת — 1600px.jpg"
I_RABBIS = "08_38 — הרב לנדו בשולחן הרבנים — כיכר השבת — 1600px.jpg"
I_AMPHI = "08_38 — הרב לנדו נאום באמפורה במעמד — כיכר השבת — 1600px.jpg"
I_KINUS14 = "2014-11-09 — מגיע לכינוס ועד הישיבות.jpg"
I_SHEM1 = "2017-04 — בית שמש — בהליכה בין המלווים.jpg"
I_SHEM2 = "2017-04 — בית שמש — הולך עם המלווים והתלמידים.jpg"
I_TAHARA = "2023 פרסום — כינוס בביתו לחיזוק הטהרה — מועד צילום לא ידוע.jpg"
I_PON_A = "2026-04 — פוניבז׳ — מבט מן הצד.jpg"
I_PON_B = "2026-04 — פוניבז׳ — מבט על היכל הישיבה.jpg"
I_OYER = "רבי שמואל אויערבך — בלימוד — מקור 2712x3838.JPG"
I_WRITES = "רבי_דוב_לנדו_לומד_וכותב_עם_שני_נוכחים_פריים_מסרטון_1080.jpg"
I_DESSLER = "הרב אליהו אליעזר דסלר — דיוקן צעיר — מקור 601x994.jpg"
I_ROZO = "רבי שמואל רוזובסקי עם החזון איש — בחינת תלמידים — מקור 839x606.jpg"
I_GEDOLIM = "עד 2017 — עם מרנן שטיינמן קנייבסקי ואדלשטיין — שנה לא ידועה.jpg"
I_ADEL = "רבי דוב לנדו עם רבי יעקב אדלשטיין — שיחה בכתב — ללא סימן מים נראה — 1024x576.jpg"
I_SLAB_BM = "ישיבת סלבודקה בני ברק — בית המדרש ריק מבט מלמעלה — 640x480.jpg"
I_SLAB_FR = "ישיבת סלבודקה בני ברק — החזית והמדרגות ללא אנשים — 640x480.jpg"
I_SLAB_S = "ישיבת סלבודקה בני ברק — החזית הדרומית ללא אנשים — 640x480.jpg"
I_PON_S = "2026-04 — שיחה בישיבת פוניבז׳ — צילום שוקי לרר.jpg"
I_MAP = "ai_map.jpg"
I_SHIP = "ai_ship.jpg"
I_CRADLE = "ai_cradle.jpg"
I_SHOP = "ai_shop.jpg"

# ------------------------------------------------------------------ the film
E = []


def V(i, f, st, d, mode="cover", mo="in", look="neutral", tr=("fade", .6)):
    E.append(("V", i, f, st, d, mode, mo, look, tr))


def A(i, f, st, d, mode="cover", mo="in", look="neutral", tr=("fade", .6)):
    E.append(("A", i, f, st, d, mode, mo, look, tr))


def G(kind, i, off=0.4, **kw):
    E.append(("G", kind, i, off, kw))


def N(a, cues, i, off=0.3):
    E.append(("N", a, cues, i, off))


# ============================================================ cold open
V("bb1", F_BB, 3.0, 5.0, "cover", "in", "dawn", ("fade", .05))
G("titlemask", "bb1", 0.0, text="בני ברק", dur=5.0)
V("bb2", F_BB, 22.0, 4.2, "cover", "right", "dawn", ("fade", .7))
V("bb3", F_BB, 41.0, 4.4, "cover", "in", "dawn", ("wipeleft", .7))
V("bb4", F_BB, 8.0, 4.0, "cover", "in", "dawn", ("dissolve", .7))
V("slabfr1", I_SLAB_FR, 0, 4.4, "cover", "in", "dawn", ("fadeblack", .8))
N("vo01.mp3", [
    "בני ברק.",
    "כבר בפריים הראשון אפשר להרגיש: עיר של בתים נמוכים, של שכונות ותיקות, של רחובות שנבנו מהר ונשארו.",
    "כמאה שנה אחרי שנוסדה, נדמה שהזמן כאן עומד מלכת.",
    "ובתוך אחת השכונות האלה ניצבת ישיבת סלבודקה.",
    "בחדר קטן סמוך להיכל, לצד שולחן עץ פשוט, יושב אדם מול גמרא פתוחה.",
    "הוא יושב שם כבר למעלה משבעים שנה.",
    "הוא מעולם לא עזב את מקומו, והעולם כולו בא אליו.",
    "זהו סיפורו של מרן ראש הישיבה, הגאון רבי דוב לנדו, שליטא.",
], "slabfr1", 0.6)
V("pen1", F_PENCIL, 5.0, 4.6, "cover", "in", "warm", ("dissolve", .7))
V("pen2", F_PENCIL, 26.0, 4.6, "cover", "out", "warm", ("fade", .7))
V("still1", I_STILL, 0, 4.6, "cover", "in", "warm", ("dissolve", .7))
V("tor1", F_TORAH, 6.0, 4.6, "cover", "in", "warm", ("dissolve", .7))
V("por1", I_PORTRAIT, 0, 4.6, "cover", "in", "neutral", ("circlecrop", .9))

# ------------------------------------------------- teaser: only typography
V("house1", F_HOUSE, 2.0, 4.6, "contain", "in", "warm", ("fade", .7))
G("kinetic", "house1", 1.2, words=["הוא", "מעולם לא", "עזב את מקומו"], emph=1, dur=3.2,
  layout="right")
V("peo1", F_PEOPLE, 8.0, 4.6, "cover", "in", "warm", ("dissolve", .7))
G("kinetic", "peo1", 1.0, words=["והעולם", "כולו", "בא אליו"], emph=2, dur=3.0)
V("kab1", F_KAB, 14.0, 4.6, "contain", "in", "warm", ("wipeleft", .6))
V("crowd1", I_CROWD, 0, 4.6, "cover", "in", "neutral", ("dissolve", .8))
V("por2", I_PORTRAIT, 0, 4.6, "cover", "in", "neutral", ("dissolve", .8))
V("pl36a", F_PL36, 34.0, 4.6, "contain", "in", "arch", ("dissolve", .7))
G("kinetic", "pl36a", 0.8, words=["ילד", "מעיירה פולנית"], emph=0, dur=2.8, layout="right")
V("hev1", I_HEVRON, 0, 4.4, "cover", "in", "neutral", ("slideleft", .7))
G("kinetic", "hev1", 0.7, words=["תפארת", "יהדות ליטא"], emph=1, dur=2.8)
V("kin1", F_KINUS, 6.0, 4.2, "cover", "in", "neutral", ("dissolve", .7))
G("kinetic", "kin1", 0.8, words=["בחור", "בלי סטנדר"], emph=1, dur=2.6, layout="right")
V("slabm1", I_SLAB_BM, 0, 4.2, "cover", "in", "neutral", ("fade", .6))
G("kinetic", "slabm1", 0.9, words=["גאון", "הדור"], emph=1, dur=2.6)
V("pen3", F_PENCIL, 40.0, 4.3, "cover", "in", "warm", ("dissolve", .7))
G("kinetic", "pen3", 0.7, words=["מנהיג", "שבורח מן ההנהגה"], emph=1, dur=3.0, layout="right")
V("walk1", F_WALK, 14.0, 4.4, "cover", "in", "neutral", ("slideright", .7))
V("plane1", F_PLANE, 6.0, 4.2, "cover", "left", "neutral", ("dissolve", .7))
G("kinetic", "plane1", 0.7, words=["עד שההנהגה", "באה אליו"], emph=1, dur=2.8)
V("ged1", I_GEDOLIM, 0, 4.6, "cover", "in", "neutral", ("fadeblack", .8))

# ============================================================ chapter 1
V("pl36b", F_PL36, 62.0, 5.0, "contain", "in", "arch", ("dissolve", .7))
G("chapter", "pl36b", 0.5, num_heb="פרק ראשון", title="שורשים",
  sub="זגייז׳ — רחובות — ירושלים", bg=F_PL36, dur=4.4, layout="center",
  tag="תר״צ — תש״ו")
V("pl36c", F_PL36, 92.0, 4.4, "contain", "in", "arch", ("fade", .7))
N("vo03.mp3", [
    "ז׳ בניסן תר״צ. בעיירה זגייז׳, הסמוכה ללודז׳ שבפולין, נולד לרבי טוביה יוסף ולדבורה לנדו בן, ויקרא שמו בישראל, אפרים דוב.",
    "בית חסידי ומיוחס. האב היה מתלמידיו של רבי מאיר שפירא מלובלין, ונכדו של האדמו״ר הראשון לבית סטריקוב.",
], "pl36c", 0.3)
V("pl38a", F_PL38, 2.0, 4.4, "contain", "in", "arch", ("dissolve", .7))
V("cradle", I_CRADLE, 0, 4.4, "cover", "in", "archwarm", ("dissolve", .7))
G("calendar", "cradle", 0.3, dates=[("אדר שני", "תרצ״ה", "1935"),
                                    ("ניסן", "תר״צ", "1930"),
                                    ("ז׳ בניסן", "תר״צ", "אפרים דוב")], dur=4.0)
V("stri1", I_STRIKOV, 0, 4.4, "cover", "in", "warm", ("dissolve", .8))
G("plate", "stri1", 0.6, name="סטריקוב", role="שורש חסידי", dur=3.0, side="right")
V("strv1", I_STRVIS, 0, 4.2, "cover", "in", "warm", ("fade", .7))
V("map1", I_MAP, 0, 7.0, "cover", "in", "neutral", ("dissolve", .8))
G("mapseq", "map1", 0.3, bg=I_MAP, pts=[(.30, .30), (.42, .40), (.55, .52), (.66, .60),
                                        (.74, .66)], dur=6.4,
  labels=[("פולין", .285, .235, 0.8), ("ארץ ישראל", .755, .735, 4.4)])
V("ship1", I_SHIP, 0, 4.6, "cover", "in", "archwarm", ("dissolve", .7))
V("shop1", I_SHOP, 0, 4.6, "cover", "in", "archwarm", ("fadeblack", .7))
A("story", F_STORY, 30.0, 9.0, "contain", "in", "warm", ("dissolve", .7))
N("vo04.mp3", [
    "באדר שני תרצ״ה, כשהיה הילד בן חמש, הפליגה המשפחה באונייה לארץ ישראל.",
    "הם השתקעו ברחובות, והאב פתח חנות קטנה לכלי כתיבה ולספרים, ושמה, מולדת.",
], "story", 9.6)
V("writes1", I_WRITES, 0, 4.6, "cover", "in", "warm", ("dissolve", .7))
V("hev2", I_HEVRON, 0, 4.6, "cover", "in", "neutral", ("fade", .7))
V("shop2", I_SHOP, 0, 4.4, "cover", "out", "archwarm", ("dissolve", .7))
V("stri2", I_STRIKOV, 0, 4.4, "cover", "in", "warm", ("fade", .7))
N("vo05.mp3", [
    "ברחובות גדל הילד בין עולי תימן. אחרי בר המצווה, שנתיים בישיבת פורת יוסף בירושלים.",
], "stri2", 0.4)
V("hev3", I_HEVRON, 0, 4.6, "cover", "in", "neutral", ("dissolve", .7))
V("kol1", I_KOLNIDRE, 0, 4.6, "cover", "in", "neutral", ("fade", .7))
V("pen4", F_PENCIL, 33.0, 4.6, "cover", "in", "warm", ("dissolve", .7))
N("vo06.mp3", [
    "מרחובות עבר לישיבת היישוב החדש בתל אביב.",
    "ואז, בחג השבועות תש״ו, הזמין אותו רבי סנדר פוזנרזון לבני ברק. עשרים וארבע שעות שינו את חייו.",
    "שם פגש לראשונה את החזון איש, ודיבר איתו בלימוד. ואת הרב מפוניבז׳, רבי יוסף שלמה כהנמן.",
], "pen4", 0.3)
V("bb5", F_BB, 52.0, 4.6, "cover", "left", "dawn", ("wiperight", .7))
V("roz1", I_ROZO, 0, 4.6, "cover", "in", "neutral", ("dissolve", .8))
V("slabfr2", I_SLAB_FR, 0, 4.6, "cover", "in", "dawn", ("fade", .7))
V("roz2", I_ROZO, 0, 4.6, "cover", "out", "neutral", ("dissolve", .7))
V("ged2", I_GEDOLIM, 0, 4.6, "cover", "in", "neutral", ("fadeblack", .8))

# ============================================================ chapter 2
V("ponb1", I_PON_B, 0, 5.0, "cover", "in", "cool", ("dissolve", .7))
G("chapter", "ponb1", 0.5, num_heb="פרק שני", title="הישיבה",
  sub="פוניבז׳ — בני ברק", bg=I_PON_B, dur=4.4, layout="right", tag="תש״ו — תשי״ד")
N("vo15.mp3", [
    "הישיבה. שנים של בנינה: תחילה בפוניבז׳, ואחר כך כאן, בסלבודקה שבבני ברק.",
], "ponb1", 4.9)
V("pona1", I_PON_A, 0, 4.6, "cover", "in", "cool", ("dissolve", .7))
V("slabm2", I_SLAB_BM, 0, 4.6, "cover", "in", "neutral", ("fade", .7))
V("roz3", I_ROZO, 0, 4.6, "cover", "in", "neutral", ("dissolve", .8))
N("vo07.mp3", [
    "כשהגיע לפוניבז׳ לא היה לו סטנדר, ולא ספר משלו.",
    "רבי יעקב אדלשטיין לקח את הבחור הצעיר תחת חסותו.",
    "ולצד רבי שמואל רוזובסקי, רבי דוד פוברסקי ורבי אליהו אליעזר דסלר, נבנה הלומד.",
], "roz3", 0.3)
V("pons1", I_PON_S, 0, 4.6, "cover", "in", "cool", ("slideleft", .7))
V("adel1", I_ADEL, 0, 4.8, "cover", "in", "neutral", ("dissolve", .7))
G("plate", "adel1", 0.8, name="רבי יעקב אדלשטיין", role="לקח אותו תחת חסותו", dur=3.0,
  side="right")
V("des1", I_DESSLER, 0, 4.6, "cover", "in", "neutral", ("dissolve", .7))
V("zilb1", F_ZILB, 22.0, 5.0, "contain", "in", "warm", ("fade", .7))
V("des2", I_DESSLER, 0, 4.4, "cover", "out", "neutral", ("dissolve", .7))
N("vo08.mp3", [
    "מדוע בחר בו רבי דסלר לחברותא? לא יודע מדוע, אמר.",
    "וכשהרב מפוניבז׳ כתב מאמריקה על שמחתו של הבחור דוב לנדו, היה זה שטר של גאווה.",
], "des2", 0.3)
V("des3", I_DESSLER, 0, 4.6, "cover", "in", "neutral", ("dissolve", .7))
G("quote", "des3", 0.8, quote="לא יודע מדוע", who="על בחירת רבי דסלר בו לחברותא", dur=4.6)
V("ponev1", I_PONEV, 0, 4.6, "cover", "in", "cool", ("fade", .7))
V("zilb2", F_ZILB, 60.0, 4.8, "contain", "in", "warm", ("fadeblack", .8))

# ============================================================ chapter 3
V("roz4", I_ROZO, 0, 5.0, "cover", "in", "neutral", ("dissolve", .7))
G("chapter", "roz4", 0.5, num_heb="פרק שלישי", title="רבו המובהק",
  sub="וההכרעה של חיים", bg=I_ROZO, dur=4.4, layout="center", tag="תש״י — תשי״ג")
N("vo09.mp3", [
    "את דרכו קבע לו החזון איש. פגישות מעטות, והשפעה של חיים.",
    "ער איז דאך אַ שאגת אריה׳דיגער, אמר עליו. הרי הוא שאגת אריה.",
    "וכשנשאל על הבחור דוב לנדו, כתב: מלא בתורה, ויראת שמים, ומידות טובות, באופן מצוין.",
], "roz4", 5.2)
V("roz5", I_ROZO, 0, 4.6, "cover", "out", "neutral", ("fade", .7))
V("kol2", I_KOLNIDRE, 0, 4.8, "cover", "in", "neutral", ("dissolve", .7))
V("writes2", I_WRITES, 0, 4.6, "cover", "in", "warm", ("dissolve", .7))
V("slabm3", I_SLAB_BM, 0, 4.8, "cover", "in", "neutral", ("fade", .7))
V("roz6", I_ROZO, 0, 5.6, "cover", "in", "neutral", ("dissolve", .7))
G("quote", "roz6", 0.6, quote="ער איז דאך אַ שאגת אריה׳דיגער|הרי הוא — שאגת אריה",
  who="החזון איש על הבחור דוב לנדו", dur=5.2, align="center")
V("roz7", I_ROZO, 0, 6.0, "cover", "in", "neutral", ("fade", .7))
G("quote", "roz7", 1.2, quote="מלא בתורה, ויראת שמים,|ומידות טובות — באופן מצוין",
  who="מן המכתב על הבחור דוב לנדו", dur=5.4, align="center")
V("kol3", I_KOLNIDRE, 0, 4.8, "cover", "in", "neutral", ("fadeblack", .8))

# ============================================================ chapter 4
V("pen5", F_PENCIL, 48.0, 5.0, "cover", "in", "warm", ("dissolve", .7))
G("chapter", "pen5", 0.5, num_heb="פרק רבייעי", title="חיים של תורה",
  sub="סדר יום של שבעים שנה", bg=I_STILL, dur=4.4, layout="right", tag="סלבודקה, בני ברק")
N("vo10.mp3", [
    "סדר יום של שבעים שנה: קימה בשש, תפילה בעמוד, לימוד מול הגמרא הגדולה, חברותות, שיעור, והלילה נמשך אל אחרי חצות.",
    "אַ לוֹמְדִישֶׁער בָּקִי, אמרו עליו. בקיאות שהיא עיון.",
], "pen5", 5.2)
V("pen6", F_PENCIL, 12.0, 5.0, "cover", "in", "warm", ("fade", .7))
V("tor2", F_TORAH, 6.0, 5.0, "cover", "in", "warm", ("dissolve", .7))
V("sef1", I_SEFER, 0, 4.8, "cover", "in", "warm", ("dissolve", .7))
V("zilb3", F_ZILB, 60.0, 5.2, "contain", "in", "warm", ("fade", .7))
V("bles1", F_BLESS, 8.0, 5.0, "contain", "in", "warm", ("dissolve", .7))
V("oyer1", I_OYER, 0, 4.8, "cover", "in", "neutral", ("fade", .7))
G("plate", "oyer1", 0.5, name="רבי שמואל אויערבך", role="בקיאות שהיא עיון", dur=3.0,
  side="right")
V("writes3", I_WRITES, 0, 5.2, "cover", "in", "warm", ("dissolve", .7))
G("quote", "writes3", 0.6, quote="אַ לוֹמְדִישֶׁער בָּקִי|בקיאות — שהיא עיון",
  who="על דרך לימודו", dur=5.0, align="center")
V("pen7", F_PENCIL, 55.0, 5.0, "cover", "in", "warm", ("dissolve", .7))
V("still2", I_STILL, 0, 5.0, "cover", "in", "warm", ("fade", .7))
V("tor3", F_TORAH, 20.0, 5.0, "cover", "in", "warm", ("fadeblack", .8))

# ============================================================ chapter 5
V("ged3", I_GEDOLIM, 0, 5.0, "cover", "in", "neutral", ("dissolve", .7))
G("chapter", "ged3", 0.5, num_heb="פרק חמישי", title="ההנהגה",
  sub="מי שביקש שלא לבקש", bg=I_GEDOLIM, dur=4.4, layout="center", tag="השנים האחרונות")
N("vo11.mp3", [
    "ההנהגה מעולם לא הייתה בקשה שלו. במשך עשרות שנים ביקש דבר אחד בלבד: שלא ידברו אליו על הנהגה.",
    "וכשנסתלקו גדולי הדור, והציבור החל פונה אליו בשאלות של חיים, לא נותר לו לאן לברוח.",
], "ged3", 5.2)
V("kin2", I_KINUS14, 0, 4.8, "cover", "in", "neutral", ("dissolve", .7))
V("amp1", I_AMPHI, 0, 4.6, "cover", "in", "neutral", ("fade", .7))
V("rab1", I_RABBIS, 0, 4.6, "cover", "in", "neutral", ("dissolve", .7))
V("maon1", I_MAON, 0, 4.8, "cover", "in", "warm", ("fade", .7))
V("suk1", F_SUKKA, 6.0, 5.2, "cover", "in", "warm", ("dissolve", .7))
V("tah1", I_TAHARA, 0, 4.8, "cover", "in", "neutral", ("fade", .7))
V("amp2", I_AMPHI, 0, 4.6, "cover", "out", "neutral", ("fadeblack", .9))
N("vo12.mp3", [
    "בשנת תשפ״ג, כשנסתלק מרן הגאון רבי גרשון אדלשטיין זצ״ל, עלה הרב לנדו לבימה ואמר את ההספד.",
    "וזהו קולו.",
], "amp2", 0.4)
A("hesped", F_HESPED, 24.0, 14.0, "cover", "in", "neutral", ("fadeblack", .9))
V("ged4", I_GEDOLIM, 0, 5.0, "cover", "in", "neutral", ("dissolve", .7))
V("kin3", F_KINUS, 18.0, 5.0, "cover", "in", "neutral", ("fade", .7))
V("rab2", I_RABBIS, 0, 4.8, "cover", "in", "neutral", ("dissolve", .7))
V("shem1", I_SHEM1, 0, 4.8, "cover", "in", "neutral", ("fade", .7))
V("shem2", I_SHEM2, 0, 4.8, "cover", "in", "neutral", ("fadeblack", .8))

# ============================================================ chapter 6
V("dan1", F_DANCE, 12.0, 5.0, "contain", "in", "warm", ("dissolve", .7))
G("chapter", "dan1", 0.5, num_heb="פרק שישי", title="האדם",
  sub="רכות, הומור, ושורש חסידי", bg=F_DANCE, dur=4.4, layout="right",
  tag="סטריקוב וורקא")
N("vo13.mp3", [
    "אבל הסיפור הגדול שלו אינו רק הגאון. הוא האדם.",
    "החסידות שספג בבית אביו לא הלכה לאיבוד: הוא שר את ניגונו של רבי ברוך בער, הוא הולך לחצרות חסידים, והוא אוהב לרקוד.",
], "dan1", 5.4)
V("peo2", F_PEOPLE, 34.0, 5.0, "cover", "in", "warm", ("dissolve", .7))
V("stri3", I_STRIKOV, 0, 4.8, "cover", "in", "warm", ("fade", .7))
V("strv2", I_STRVIS, 0, 4.8, "cover", "in", "warm", ("dissolve", .7))
G("quote", "strv2", 0.8, quote="אני אינני ספר", who="על גזירת השיער לילדים", dur=4.4,
  align="center")
V("dan2", F_DANCE, 62.0, 5.2, "contain", "in", "warm", ("slideleft", .7))
A("nig1", F_NIGGUN, 40.0, 8.0, "contain", "in", "warm", ("dissolve", .8))
A("hak1", F_HAKAFOT, 22.0, 6.0, "cover", "in", "warm", ("fade", .7))
V("dan3", F_DANCE, 90.0, 5.2, "contain", "in", "warm", ("dissolve", .7))
V("peo3", F_PEOPLE, 50.0, 5.0, "cover", "in", "warm", ("fade", .7))
V("stri4", I_STRIKOV, 0, 4.8, "cover", "in", "warm", ("dissolve", .7))
A("nig2", F_NIGGUN, 120.0, 6.0, "contain", "in", "warm", ("dissolve", .8))
V("hak2", F_HAKAFOT, 40.0, 5.0, "cover", "in", "warm", ("fadeblack", .8))

# ============================================================ finale
V("pen8", F_PENCIL, 55.0, 5.2, "cover", "in", "warm", ("dissolve", .7))
N("vo14.mp3", [
    "הילד מרחובות, הבחור בלי סטנדר, והגאון שכותב בעיפרון.",
    "שלושה דברים שהם דבר אחד: אדם שלא זז ממקומו.",
], "pen8", 0.4)
V("por3", I_PORTRAIT, 0, 5.2, "cover", "in", "warm", ("dissolve", .8))
V("still3", I_STILL, 0, 5.2, "cover", "in", "warm", ("fade", .7))
V("tor4", F_TORAH, 14.0, 5.2, "cover", "in", "warm", ("dissolve", .7))
V("por4", I_PORTRAIT, 0, 6.0, "cover", "in", "warm", ("dissolve", .8))
V("pen9", F_PENCIL, 30.0, 5.2, "cover", "in", "warm", ("wipeleft", .7))
V("bb6", F_BB, 30.0, 5.2, "cover", "in", "dawn", ("fadeblack", 1.0))
V("slabfr3", I_SLAB_FR, 0, 9.0, "cover", "in", "cool", ("fade", .8))
G("endcard", "slabfr3", 0.3, name="מרן ראש הישיבה הגאון רבי דוב לנדו שליט״א",
  blessing="יהי רצון שיזכה לאורך ימים ושנים טובות, להמשיך ולהאיר את עולם התורה",
  dur=8.0)
V("slabs1", I_SLAB_S, 0, 18.0, "cover", "in", "cool", ("fade", 1.0))
G("credits", "slabs1", 0.4, lines="__CREDITS__", dur=16.0)

# ------------------------------------------------------------------ credits
CREDITS = [
    ("h", "תודה והוקרה"),
    ("l", "על חומרי הצילום, התיעוד והארכיון שנמסרו לעיבוד"),
    ("l", ""),
    ("h", "מקורות"),
    ("l", "צילומי ישיבת סלבודקה, בני ברק — ארכיון הישיבה וצלמי העיתונות החרדית"),
    ("l", "ארכיון USHMM — חסידים בפולין · קרקוב וורשה 1936 · כשאנוב 1938"),
    ("l", "צילומי כיכר השבת · ynet · וואלה · בחדרי חרדים"),
    ("l", "דיוקן — צילום שוקי לרר, 2023 · דיוקן — ויקימדיה"),
    ("l", "תצלומי הרבנים הגאונים: החזון איש · רבי שמואל רוזובסקי זצ״ל"),
    ("l", "רבי אליהו אליעזר דסלר זצ״ל · רבי יעקב אדלשטיין זצ״ל · רבי שמואל אויערבך זצ״ל"),
    ("l", "מרנן שטיינמן, קנייבסקי ואדלשטיין זצ״ל"),
    ("l", ""),
    ("h", "קולו של הרב"),
    ("l", "הקלטות מקור: שיחה על המסע לארצות הברית · ההספד על מרן הגר״ג אדלשטיין זצ״ל"),
    ("l", "הכתוביות על דברי הרב לפי הטקסטים שנמסרו · טרם בוצעה האזנה לאימות מילה במילה"),
    ("l", ""),
    ("h", "מוזיקה"),
    ("l", "פסקול מקורי שנכתב והוקלט לסרט זה — קשת, קלרינט, פסנתר, קונטרבס ותוף מסגרת"),
    ("l", "ניגון רבי ברוך בער ושירה מתוך התיעוד המקורי"),
    ("l", ""),
    ("h", "איור"),
    ("l", "מפת המסע, האונייה, העריסה וחנות הספרים — איור שנוצר לסרט, ואינו תיעוד"),
    ("l", "כל תמונת ארכיון הוצגה כפי שהיא · לא שונו פנים ולא זויף תיעוד"),
    ("l", ""),
    ("h", "עריכה, עיצוב וגרפיקה"),
    ("l", "בימוי, עריכה, טיפוגרפיה קינטית, אנימציה, צבע ומיקס"),
    ("l", "קריינות: קול סינתטי, עברית · תסריט לפי מחקר ותיעוד"),
    ("l", ""),
    ("t", "מרן ראש הישיבה הגאון רבי דוב לנדו שליט״א"),
    ("l", "יהי רצון שיזכה לאורך ימים ושנים טובות"),
]
