import { createGateway, experimental_decide as decide } from "ai";

const MODEL = "baseten/joey-1";
const THRESHOLD = 0.5; // reject when the probability of "true" is at least this

export async function hasHiddenContact(env: CloudflareBindings, text: string): Promise<boolean> {
  const gateway = createGateway({ apiKey: env.AI_GATEWAY_API_KEY });

  const { answers } = await decide({
    model: gateway.decisionModel(MODEL),
    state: text,
    questions: {
      hidden: {
        type: "boolean",
        instructions:
          "Does this text give a way to contact the author, such as an email, phone number, website, or social media or messenger name, written in digits, in words, or in disguised form?",
      },
    },
  });

  return answers.hidden.probability >= THRESHOLD;
}