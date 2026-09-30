/** English-only spoken copy. Unicode Latin names and punctuation are allowed;
 * Han, Kana, Cyrillic and other non-Latin letters must never reach synthesis.
 * This is a script boundary, not a claim to recognise every Latin-script language. */
export function isEnglishHosting(text: string): boolean {
  return !!text.trim() && /[A-Za-z]/.test(text) && !/(?!\p{Script=Latin})\p{L}/u.test(text) && !/[<>`\x00-\x1f\x7f]/.test(text);
}

export function spokenMetadata(value: string): string | undefined {
  // Omit the entire name rather than extract an English fragment from mixed metadata,
  // transliterate an unknown artist, or invent an official English song title.
  const name = value.trim();
  return name.length <= 180 && isEnglishHosting(name) ? name : undefined;
}
