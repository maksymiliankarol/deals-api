export type ContactReason =
  | 'email'
  | 'link'
  | 'handle'
  | 'messenger'
  | 'solicitation'

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g

// Runs on a copy only: lowercasing and whitespace-collapsing must never reach
// the stored text. (The schema already canonicalizes what gets stored.)
export function normalize(text: string): string {
  return text
    .normalize('NFKD') // fancy characters become plain, accents split off
    .replace(/\p{M}/gu, '') // combining marks: strikethroughs, accents, variation selectors
    .replace(ZERO_WIDTH, '')
    .replace(/[\u2018\u2019]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const TLDS = 'com|net|org|io|co|me|app|dev|info|biz'
const MESSENGERS =
  "whats ?app|what's ?app|telegram|viber|we ?chat|snapchat|insta(?:gram)?|discord|skype"

const RULES: ReadonlyArray<{ reason: ContactReason; patterns: RegExp[] }> = [
  {
    reason: 'email',
    patterns: [
      /[\w.+-]+@[\w-]+/, // john@gmail
      /[\w.+-]+\s*[\[({<]\s*at\s*[\])}>]\s*[\w-]+/, // john (at) gmail
      /[\[({<]\s*dot\s*[\])}>]/, // gmail [dot] com
      new RegExp(`\\b[\\w.+-]+ at [\\w-]+ dot (?:${TLDS})\\b`), // john at gmail dot com
    ],
  },
  {
    reason: 'link',
    patterns: [
      /\b(?:https?|ftp):\/\//,
      /\bwww\./,
      /\b(?:bit\.ly|linktr\.ee|discord\.gg|goo\.gl|ow\.ly)\b/,
      // bare domains like johnsplumbing.com (asp.net is a framework, not a site)
      new RegExp(`\\b(?!asp\\.net\\b)[a-z0-9-]+\\.(?:${TLDS})\\b`),
    ],
  },
  {
    reason: 'handle',
    patterns: [/(?:^|[^\w@.])@\w{3,}/], // @john_doe, but not "3 @ $50"
  },
  {
    // A messenger name alone is fine ("build a Telegram bot");
    // it only counts when used to point at a person.
    reason: 'messenger',
    patterns: [
      new RegExp(`\\b(?:${MESSENGERS})\\b\\s*(?:[:=#@]|(?:id|handle|username)\\b)`), // whatsapp: ...
      new RegExp(`\\b(?:me|us)\\s+(?:on|via|at|through|in)\\s+(?:${MESSENGERS})\\b`), // add me on instagram
      new RegExp(`\\b(?:${MESSENGERS})\\s+(?:me|us)\\b`), // telegram me
    ],
  },
  {
    reason: 'solicitation',
    patterns: [
      /\b(?:call|text|e-?mail|mail|dm|pm|message|msg|contact|reach|ping)\s+(?:me|us)\b/,
      /\breach\s+out\s+to\s+(?:me|us)\b/,
      /\b(?:my|our)\s+(?:e-?mail|phone|number|cell|mobile|whatsapp|telegram|insta(?:gram)?|handle|username)\s*[:=-]/,
    ],
  },
]

// Returns the first rule that matched, or null if the text looks clean.
// None of the patterns use the g flag, so .test() is stateless.
export function findContactInfo(description: string): ContactReason | null {
  const text = normalize(description)
  for (const { reason, patterns } of RULES) {
    if (patterns.some((p) => p.test(text))) return reason
  }
  return null
}