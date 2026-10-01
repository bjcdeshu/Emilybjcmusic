/** Boundary for the optional English host; default hosting is now Mandarin. Unicode Latin names and punctuation are allowed;
 * Han, Kana, Cyrillic and other non-Latin letters must never reach synthesis.
 * This is a script boundary, not a claim to recognise every Latin-script language. */
export function isEnglishHosting(text: string): boolean {
  return !!text.trim() && /[A-Za-z]/.test(text) && !/(?!\p{Script=Latin})\p{L}/u.test(text) && !/[<>`\x00-\x1f\x7f]/.test(text);
}

export function isHosting(text: string, language: "en" | "zh"): boolean {
  if (language === "en") return isEnglishHosting(text);
  return !!text.trim() && /\p{Script=Han}/u.test(text) && !/[<>`\x00-\x1f\x7f]/.test(text) && !/https?:\/\//i.test(text);
}

export function spokenMetadata(value: string): string | undefined {
  // Omit the entire name rather than extract an English fragment from mixed metadata,
  // transliterate an unknown artist, or invent an official English song title.
  const name = value.trim();
  return name.length <= 180 && isEnglishHosting(name) ? name : undefined;
}
