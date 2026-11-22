import React from 'react';
import raw_menu from '@material-design-icons/svg/filled/menu.svg?raw';
import raw_search from '@material-design-icons/svg/filled/search.svg?raw';
import raw_more from '@material-design-icons/svg/filled/more_vert.svg?raw';
import raw_back from '@material-design-icons/svg/filled/arrow_back.svg?raw';
import raw_forward from '@material-design-icons/svg/filled/arrow_forward.svg?raw';
import raw_readingNow from '@material-design-icons/svg/filled/autorenew.svg?raw';
import raw_booksDocs from '@material-design-icons/svg/filled/book.svg?raw';
import raw_clock from '@material-design-icons/svg/outlined/schedule.svg?raw';
import raw_doubleCheck from '@material-design-icons/svg/filled/done_all.svg?raw';
import raw_bars from '@material-design-icons/svg/filled/equalizer.svg?raw';
import raw_author from '@material-design-icons/svg/filled/person.svg?raw';
import raw_series from '@material-design-icons/svg/filled/label.svg?raw';
import raw_collection from '@material-design-icons/svg/filled/equalizer.svg?raw';
import raw_format from '@material-design-icons/svg/filled/layers.svg?raw';
import raw_folder from '@material-design-icons/svg/filled/folder.svg?raw';
import raw_download from '@material-design-icons/svg/filled/download.svg?raw';
import raw_trash from '@material-design-icons/svg/filled/delete.svg?raw';
import raw_settings from '@material-design-icons/svg/filled/settings.svg?raw';
import raw_feedback from '@material-design-icons/svg/filled/feedback.svg?raw';
import raw_restore from '@material-design-icons/svg/filled/restore.svg?raw';
import raw_toc from '@material-design-icons/svg/filled/toc.svg?raw';
import raw_fullscreen from '@material-design-icons/svg/filled/fullscreen.svg?raw';
import raw_font from '@material-design-icons/svg/filled/format_size.svg?raw';
import raw_home from '@material-design-icons/svg/filled/home.svg?raw';
import raw_library from '@material-design-icons/svg/filled/local_library.svg?raw';
import raw_history from '@material-design-icons/svg/filled/history.svg?raw';
import raw_info from '@material-design-icons/svg/filled/info.svg?raw';
import raw_edit from '@material-design-icons/svg/filled/edit.svg?raw';
import raw_plus from '@material-design-icons/svg/filled/add.svg?raw';
import raw_close from '@material-design-icons/svg/filled/close.svg?raw';
import raw_chevron from '@material-design-icons/svg/filled/chevron_right.svg?raw';
import raw_chevronLeft from '@material-design-icons/svg/filled/chevron_left.svg?raw';
import raw_sort from '@material-design-icons/svg/filled/sort.svg?raw';
import raw_grid from '@material-design-icons/svg/filled/grid_view.svg?raw';
import raw_list from '@material-design-icons/svg/filled/view_list.svg?raw';
import raw_zoomIn from '@material-design-icons/svg/filled/zoom_in.svg?raw';
import raw_zoomOut from '@material-design-icons/svg/filled/zoom_out.svg?raw';
import raw_play from '@material-design-icons/svg/filled/play_arrow.svg?raw';
import raw_pause from '@material-design-icons/svg/filled/pause.svg?raw';
import raw_stop from '@material-design-icons/svg/filled/stop.svg?raw';
import raw_sparkle from '@material-design-icons/svg/filled/auto_awesome.svg?raw';
import raw_external from '@material-design-icons/svg/filled/open_in_new.svg?raw';
import raw_moon from '@material-design-icons/svg/filled/dark_mode.svg?raw';
import raw_sun from '@material-design-icons/svg/filled/light_mode.svg?raw';
import raw_keyboard from '@material-design-icons/svg/filled/keyboard.svg?raw';
import raw_tts from '@material-design-icons/svg/filled/record_voice_over.svg?raw';
import raw_check from '@material-design-icons/svg/filled/check.svg?raw';
import raw_bookmark from '@material-design-icons/svg/filled/bookmark.svg?raw';
import raw_bookmarkBorder from '@material-design-icons/svg/filled/bookmark_border.svg?raw';
import raw_starFilled from '@material-design-icons/svg/filled/star.svg?raw';
import raw_starBorder from '@material-design-icons/svg/outlined/star_border.svg?raw';
import raw_heartFilled from '@material-design-icons/svg/filled/favorite.svg?raw';
import raw_heartBorder from '@material-design-icons/svg/outlined/favorite_border.svg?raw';
import raw_book from '@material-design-icons/svg/filled/book.svg?raw';
import raw_refresh from '@material-design-icons/svg/filled/refresh.svg?raw';
import raw_devices from '@material-design-icons/svg/filled/devices.svg?raw';
import raw_tune from '@material-design-icons/svg/filled/tune.svg?raw';
import raw_storefront from '@material-design-icons/svg/filled/storefront.svg?raw';
import raw_storage from '@material-design-icons/svg/filled/storage.svg?raw';
import raw_textFields from '@material-design-icons/svg/filled/text_fields.svg?raw';
import raw_formatLineSpacing from '@material-design-icons/svg/filled/format_line_spacing.svg?raw';
import raw_formatAlignJustify from '@material-design-icons/svg/filled/format_align_justify.svg?raw';
import raw_margin from '@material-design-icons/svg/filled/aspect_ratio.svg?raw';
import raw_swapHoriz from '@material-design-icons/svg/filled/swap_horiz.svg?raw';
import raw_swapVert from '@material-design-icons/svg/filled/swap_vert.svg?raw';
import raw_palette from '@material-design-icons/svg/filled/palette.svg?raw';
import raw_translate from '@material-design-icons/svg/filled/translate.svg?raw';
import raw_colorLens from '@material-design-icons/svg/filled/color_lens.svg?raw';
import raw_import from '@material-design-icons/svg/filled/file_download.svg?raw';

/**
 * Real Material Design icons (Apache-2.0) – the same icon language ReadEra
 * uses. Each component renders the official 24dp path so sizes, corners and
 * optical weights match the Android app instead of being hand-drawn lookalikes.
 */

/** Strip the outer <svg> wrapper so the path can be inlined. */
const inner = (raw) => {
  const start = raw.indexOf('>', raw.indexOf('<svg'));
  const end = raw.lastIndexOf('</svg>');
  return raw.slice(start + 1, end);
};

const cache = new Map();

const materialIcon = (raw) => {
  const markup = cache.get(raw) || inner(raw);
  cache.set(raw, markup);
  const Component = ({ size = 20, style, className, ...rest }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...rest}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
  return Component;
};

export const IconMenu = materialIcon(raw_menu);
export const IconSearch = materialIcon(raw_search);
export const IconMore = materialIcon(raw_more);
export const IconBack = materialIcon(raw_back);
export const IconForward = materialIcon(raw_forward);
export const IconReadingNow = materialIcon(raw_readingNow);
export const IconBooksDocs = materialIcon(raw_booksDocs);
export const IconClock = materialIcon(raw_clock);
export const IconDoubleCheck = materialIcon(raw_doubleCheck);
export const IconBars = materialIcon(raw_bars);
export const IconAuthor = materialIcon(raw_author);
export const IconSeries = materialIcon(raw_series);
export const IconCollection = materialIcon(raw_collection);
export const IconFormat = materialIcon(raw_format);
export const IconFolder = materialIcon(raw_folder);
export const IconDownload = materialIcon(raw_download);
export const IconTrash = materialIcon(raw_trash);
export const IconSettings = materialIcon(raw_settings);
export const IconFeedback = materialIcon(raw_feedback);
export const IconRestore = materialIcon(raw_restore);
export const IconToc = materialIcon(raw_toc);
export const IconFullscreen = materialIcon(raw_fullscreen);
export const IconFont = materialIcon(raw_font);
export const IconHome = materialIcon(raw_home);
export const IconLibrary = materialIcon(raw_library);
export const IconHistory = materialIcon(raw_history);
export const IconInfo = materialIcon(raw_info);
export const IconEdit = materialIcon(raw_edit);
export const IconPlus = materialIcon(raw_plus);
export const IconClose = materialIcon(raw_close);
export const IconChevron = materialIcon(raw_chevron);
export const IconChevronLeft = materialIcon(raw_chevronLeft);
export const IconSort = materialIcon(raw_sort);
export const IconGrid = materialIcon(raw_grid);
export const IconList = materialIcon(raw_list);
export const IconZoomIn = materialIcon(raw_zoomIn);
export const IconZoomOut = materialIcon(raw_zoomOut);
export const IconPlay = materialIcon(raw_play);
export const IconPause = materialIcon(raw_pause);
export const IconStop = materialIcon(raw_stop);
export const IconSparkle = materialIcon(raw_sparkle);
export const IconExternal = materialIcon(raw_external);
export const IconMoon = materialIcon(raw_moon);
export const IconSun = materialIcon(raw_sun);
export const IconKeyboard = materialIcon(raw_keyboard);
export const IconTts = materialIcon(raw_tts);
export const IconCheck = materialIcon(raw_check);
export const IconBookmarkSolid = materialIcon(raw_bookmark);
export const IconBookmarkBorder = materialIcon(raw_bookmarkBorder);
export const IconStarFilled = materialIcon(raw_starFilled);
export const IconStarBorder = materialIcon(raw_starBorder);
export const IconHeartFilled = materialIcon(raw_heartFilled);
export const IconHeartBorder = materialIcon(raw_heartBorder);
export const IconBook = materialIcon(raw_book);
export const IconRefresh = materialIcon(raw_refresh);
export const IconDevices = materialIcon(raw_devices);
export const IconTune = materialIcon(raw_tune);
export const IconStorefront = materialIcon(raw_storefront);
export const IconStorage = materialIcon(raw_storage);
export const IconTextFields = materialIcon(raw_textFields);
export const IconFormatLineSpacing = materialIcon(raw_formatLineSpacing);
export const IconFormatAlignJustify = materialIcon(raw_formatAlignJustify);
export const IconMargin = materialIcon(raw_margin);
export const IconSwapHoriz = materialIcon(raw_swapHoriz);
export const IconSwapVert = materialIcon(raw_swapVert);
export const IconPalette = materialIcon(raw_palette);
export const IconTranslate = materialIcon(raw_translate);
export const IconColorLens = materialIcon(raw_colorLens);
export const IconImport = materialIcon(raw_import);

/* Toggle pairs – ReadEra switches between the filled and the outlined glyph. */
export const IconStar = ({ filled, size, ...rest }) =>
  (filled ? <IconStarFilled size={size} {...rest} /> : <IconStarBorder size={size} {...rest} />);

export const IconHeart = ({ filled, size, ...rest }) =>
  (filled ? <IconHeartFilled size={size} {...rest} /> : <IconHeartBorder size={size} {...rest} />);

export const IconBookmark = ({ filled, size, ...rest }) =>
  (filled ? <IconBookmarkSolid size={size} {...rest} /> : <IconBookmarkBorder size={size} {...rest} />);
