const MODEL = 'clef-flash' // swap to 'clef' (27B) if the eval set says so
const THRESHOLD = 0.5 // placeholder: tune it on the eval set
const TIMEOUT_MS = 8000

const QUESTIONS = {
  email: {
    type: 'noul',
    instructions:
      "Does the text contain an email address, including disguised or spelled-out forms like 'john at gmail dot com'? Prices, budgets, quantities and dates are not email addresses.",
  },
  phone: {
    type: 'noul',
    instructions:
      'Does the text contain a phone number, including digits separated by spaces or symbols, digits spelled out as words, or numbers split up with other words? A price, budget, quantity, date, measurement or ZIP code is not a phone number.',
  },
  link_or_handle: {
    type: 'noul',
    instructions:
      'Does the text contain a web address, domain name, social media handle, or messaging app username, even if written in an unusual way?',
  },
  off_platform: {
    type: 'noul',
    instructions:
      'Does the text ask or invite the reader to contact the author outside this platform, or tell the reader where or how to find or reach the author?',
  },
} as const

type QuestionId = keyof typeof QUESTIONS

type ClefResponse = {
  answers: Record<string, { type: string; noul?: number }>
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

// Returns the question that fired, or null if the text looks clean.
// Fails open: if the model errors or times out, the post goes through.
export async function findContactInfoWithAI(
  env: CloudflareBindings,
  description: string
): Promise<QuestionId | null> {
  try {
    // Cast because I don't know whether your generated types include Clef yet.
    const ai = env.AI as unknown as {
      run(model: string, input: unknown): Promise<ClefResponse>
    }

    const res = await withTimeout(
      ai.run(`@cf/cloudflare/${MODEL}`, {
        model: MODEL,
        state: description,
        questions: QUESTIONS,
      }),
      TIMEOUT_MS
    )

    const scores: Record<string, number> = {}
    let top: { id: QuestionId; p: number } | null = null

    for (const id of Object.keys(QUESTIONS) as QuestionId[]) {
      const p = res.answers[id]?.noul
      if (typeof p !== 'number') continue
      scores[id] = p
      if (!top || p > top.p) top = { id, p }
    }

    console.log('contact ai check', { scores }) // probabilities only, not the text
    return top && top.p >= THRESHOLD ? top.id : null
  } catch (err) {
    console.error('contact ai check failed, allowing the post', err)
    return null
  }
}