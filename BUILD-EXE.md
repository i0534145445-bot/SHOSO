# איך מקבלים את ה-EXE של SHOSO Music

> **למה אין קובץ EXE מוכן בתיקייה?**
> קובץ `.exe` של אפליקציית Windows הוא קובץ טכני שמופק על־ידי מהדר (build),
> ולא ניתן ליצור אותו כראוי בלי Windows. לכן הפרויקט כולל שני מסלולים שמפיקים
> אותו עבורך אוטומטית — אחד על המחשב שלך, ואחד בענן של GitHub.

---

## מסלול א׳ — GitHub Actions (הכי מהיר, בלי להתקין כלום)

1. פתח: `https://github.com/i0534145445-bot/SHOSO/actions`
2. אם מופיע כפתור **„I understand my workflows, go ahead and enable them”** – לחץ עליו (זה נדרש פעם אחת בכל ריפו חדש).
3. בתפריט הימני בחר **Build Windows app** → **Run workflow** → בחר את הענף `arena/7781281b-shoso` → **Run workflow**.
4. המתן כ־3–5 דקות (Windows runner בונה את הקובץ).
5. בסיום הריצה, בתחתית עמוד הריצה, הורד את הארטיפקט **`SHOSO-Music-Windows`** – הוא מכיל:
   - `SHOSO-Music-1.0.0-x64.exe` — מתקין מלא (קיצור דרך בשולחן העבודה)
   - `SHOSO-Music-1.0.0-portable.exe` — גרסה ניידת, הרצה בלי התקנה

> אם ה-workflow לא מופיע ב-Actions — סימן ש-GitHub Actions כבויים בהגדרות הריפו:
> `Settings → Actions → General → Allow all actions` ואז שמור.

### מסלול א׳ חלופי — Release אוטומטי בעזרת תג
```powershell
git tag v1.0.0
git push origin v1.0.0
```
הבנייה תרוץ לבד והקבצים יצורפו לעמוד ה-Releases של הריפו.

---

## מסלול ב׳ — בנייה על המחשב שלך (Windows)

דרישה מוקדמת: [Node.js LTS](https://nodejs.org) (גרסה 18+).

1. הורד את הפרויקט (Code → Download ZIP) וחלץ.
2. לחץ פעמיים על **`build-exe.bat`**.
3. בסיום ייפתח חלון `release\` עם שני קבצי ה-`.exe`.

או ידנית:
```powershell
npm install
npm run dist
```

---

## מה בדיוק נכנס לקובץ

| רכיב | תוכן |
| --- | --- |
| `dist/` | ממשק ה-React שנבנה (HTML/JS/CSS) עם CSP מוקשח |
| `electron/` | תהליך ראשי + preload (סריקת ספרייה, פרוטוקול מדיה, שמירה) |
| `build/icon.ico` | סמל האפליקציה ל-Windows |
| `node_modules/music-metadata` | קורא תגי ID3/FLAC/M4A |

הגדרות האריזה נמצאות ב־`package.json` תחת `"build"` (יעד: `nsis` + `portable`, `x64`).

---

## בדיקות לפני שחרור

```powershell
npm test        # 20 בדיקות
npm run dist    # מתקין + נייד
```

## תקלות נפוצות

| תקלה | פתרון |
| --- | --- |
| `npm install` נכשל בהורדת Electron | חסימת רשת/אנטי־וירוס – הרץ שוב או הגדר פרוקסי |
| האפליקציה לא נפתחת אחרי התקנה | וודא Windows 10/11 64-bit |
| „Windows protected your PC” | לחץ More info → Run anyway (הקובץ לא חתום דיגיטלית) |
| קובץ גדול (~80MB) | זה נורמלי – Electron כולל דפדפן Chromium מלא |
