/**
 * Text for matching what someone typed, the way Vietnamese is typed in a
 * hurry: no tone marks or hats (either tone placement, Hòa / Hoà, folds the
 * same), đ as d, any case, single spaces. "ba dinh", "Ba Đình", "BA ĐÌNH" →
 * "ba dinh".
 */
export function foldVietnamese(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[’‘`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
