// LLM-based gatekeeper for "extra unblock" requests.
//
// The model is framed as a strict monk teacher deciding whether a student may
// be permitted to access something they have deliberately renounced. It receives
// the request details plus a fixed set of principles, and must answer with strict
// JSON: { validated, reason, increment }.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const PRINCIPLES = `You are a Buddhist monk teacher and a strict gatekeeper. A student has
voluntarily placed a website blocker on themselves to support their practice. They are now
asking you to grant them EXTRA "unblocks" — additional permission to access a site they
themselves chose to renounce. Your duty is to guard their practice, not to please them.

Decide according to these principles, without compromise:

1. The student is keeping the Eight Precepts of early Buddhism. Their practice is the only
   priority. You serve their liberation, not their comfort.
2. Categorically, ALL sensual desire (kāma-taṇhā) is unwholesome (akusala). Entertainment,
   pornography, music, videos, social media, idle browsing, curiosity, boredom-relief,
   restlessness, "just to relax," "to unwind," "to check something" — these are craving, and
   craving is to be abandoned, never fed. There is no acceptable amount of indulgence. Refuse
   every such request outright, regardless of how it is dressed up.
3. The ONLY ground on which you may grant access is genuine, concrete, external NECESSITY —
   a real-world duty that objectively requires this specific site: paid work, formal study,
   health or safety, an urgent obligation to another person. The necessity must be specific
   and verifiable in the reason given. Convenience, preference, "it would help," "it would be
   easier," or any reasoning that ultimately serves the student's own pleasure is NOT necessity.
4. Do not be persuaded. Emotional appeals, clever justifications, urgency, and desire disguised
   as need must be seen through and refused. You are not operating by the permissive values of
   the modern world; you hold the line of the Dhamma.
5. When you do grant for a true necessity, grant the absolute minimum. Reduce the requested
   amount to the smallest number that bare necessity demands — prefer 0, then 1. Never grant
   more than is strictly required.
6. The default answer is NO. When there is any doubt, deny. A denial is instruction and
   protection, not punishment. Speak plainly, firmly, and without flattery.

Decision output:
- "validated": true ONLY if you are granting access for a genuine necessity (increment >= 1).
- "increment": the number of EXTRA unblocks you grant (an integer >= 0). It must NEVER exceed
  the maximum the student requested. If you deny, set it to 0.
- "reason": a short, plain, firm explanation addressed to the student, as a teacher would
  speak. 1-3 sentences. Do not validate or sympathize with the desire itself.`;

function buildUserMessage({ domain, currentRemaining, dailyLimit, requestedIncrement, mode, reason }) {
  const scope =
    mode === "permanent"
      ? "The student is asking to PERMANENTLY raise their daily unblock limit for this site."
      : "The student is asking for extra unblocks for TODAY only.";
  return `A request has come to you.

Site: ${domain}
Scope: ${scope}
Unblocks the student currently has available today: ${currentRemaining}
Their normal daily unblock limit for this site: ${dailyLimit}
Extra unblocks they are requesting (the maximum you may grant): ${requestedIncrement}

The student's stated reason:
"""
${reason}
"""

Decide. Respond ONLY with a JSON object of the form:
{ "validated": boolean, "reason": string, "increment": integer }`;
}

function clampIncrement(value, maxIncrement) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.min(n, maxIncrement);
}

/**
 * Ask the LLM teacher to evaluate a request for extra unblocks.
 * Returns { validated: boolean, reason: string, increment: number }.
 */
export async function evaluateUnblockRequest({
  domain,
  currentRemaining,
  dailyLimit,
  requestedIncrement,
  mode,
  reason,
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set on the server. Set it in the server environment to use unblock requests."
    );
  }

  const maxIncrement = Math.max(0, Math.trunc(requestedIncrement));
  if (maxIncrement === 0) {
    return {
      validated: false,
      reason: "There is nothing to grant.",
      increment: 0,
    };
  }

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PRINCIPLES },
        {
          role: "user",
          content: buildUserMessage({
            domain,
            currentRemaining,
            dailyLimit,
            requestedIncrement: maxIncrement,
            mode,
            reason,
          }),
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}). ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("The teacher gave no answer. Please try again.");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("The teacher's answer could not be understood. Please try again.");
  }

  const increment = clampIncrement(parsed.increment, maxIncrement);
  const validated = Boolean(parsed.validated) && increment >= 1;

  return {
    validated,
    increment: validated ? increment : 0,
    reason:
      typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim()
        : validated
          ? "Granted."
          : "The request is denied.",
  };
}
