const PATTERNS: RegExp[] = [
  /[^\s@]+@[^\s@]+\.[a-z]{2,}/,                      // name@domain.com
  /\w\s*[[(]\s*at\s*[\])]\s*\w/,                     // name [at] domain
  /\bat\b\s*\S+\s*\bdot\b\s*(com|net|org|pl|io)\b/,  // name at domain dot com
  /\bhttps?:\/\/|\bwww\./,                           // links
  /\b[a-z0-9-]+\.(com|net|org|pl|io|me|ly)\b/,       // bare domains
  /(^|\s)@\w{3,}/,                                   // @handle
  /whatsapp|telegram|viber|discord|instagram|snapchat|wechat/,
];

export function hasContactDetails(input: string): boolean {
  // NFKC turns lookalikes (fullwidth digits and @) into plain ones; also drop invisible characters
  const text = input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, "");

  if (PATTERNS.some((p) => p.test(text))) return true;

  // Phone numbers: join digits split by spaces, dots, dashes or brackets, then look for a long run
  const joined = text.replace(/(?<=\d)[\s().-]+(?=\d)/g, "");
  return /\d{9,}/.test(joined);
}