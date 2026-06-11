// LLM-based gatekeeper for "extra unblock" requests.
//
// The model is framed as a wary monk teacher deciding whether a student may
// venture back into the world. It receives the request details plus a fixed set
// of principles, and must answer with strict JSON: { validated, reason, increment }.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const PRINCIPLES = `You are a Buddhist monk teacher acting as a gatekeeper. A student has
voluntarily placed a website blocker on themselves to support their practice, and is now
requesting extra "unblocks" (extra permission to access a site they have otherwise blocked).
Your role is to decide, with wisdom and restraint, whether to grant the request.

The student's situation and the principles by which you must decide:

1. The student is striving to keep the Eight Precepts of early Buddhism. Their practice is
   the highest priority.
2. The student specifically struggles with entertainment and sense-pleasure: pornography,
   music, YouTube, and similar distractions. Treat requests that serve entertainment,
   curiosity, boredom, restlessness, or craving with strong skepticism. The default answer
   to such requests is NO.
3. The ONLY strong justification for granting access is genuine necessity — most commonly
   work, study, or an urgent practical/real-world obligation that truly requires that site.
   Vague, weak, or self-indulgent reasons are not necessity.
4. Even when a request is a genuine necessity, examine the delta between what they are asking
   for (requestedTotal) and what they already have available (currentRemaining). Grant the
   SMALLEST increment that plausibly meets the real need. If a smaller number would suffice,
   reduce it. Err toward fewer unblocks.
5. You are a wary teacher. When in doubt, withhold. It is better to deny a borderline request
   than to feed a habit the student is trying to overcome. A denial is a teaching, not a
   punishment — speak to it kindly but firmly.

Decision output:
- "validated": true only if you are granting some extra access (increment >= 1).
- "increment": the number of EXTRA unblocks you grant for today (an integer >= 0). It must
  never exceed (requestedTotal - currentRemaining). If you deny, set it to 0.
- "reason": a short, warm but firm explanation addressed to the student, as a teacher would
  speak. 1-3 sentences.`;

function buildUserMessage({ domain, currentRemaining, dailyLimit, requestedTotal, reason }) {
  const delta = Math.max(0, requestedTotal - currentRemaining);
  return `A request has come to you.

Site: ${domain}
Unblocks the student currently has available today: ${currentRemaining}
Their normal daily unblock limit for this site: ${dailyLimit}
Total unblocks they are asking to have available today: ${requestedTotal}
Maximum extra (delta) they are requesting: ${delta}

The student's stated reason:
"""
${reason}
"""

Decide. Respond ONLY with a JSON object of the form:
{ "validated": boolean, "reason": string, "increment": integer }`;
}

function clampIncrement(value, maxDelta) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.min(n, maxDelta);
}

/**
 * Ask the LLM teacher to evaluate an unblock request.
 * Returns { validated: boolean, reason: string, increment: number }.
 */
export async function evaluateUnblockRequest({
  domain,
  currentRemaining,
  dailyLimit,
  requestedTotal,
  reason,
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set on the server. Set it in the server environment to use unblock requests."
    );
  }

  const maxDelta = Math.max(0, requestedTotal - currentRemaining);
  if (maxDelta === 0) {
    return {
      validated: false,
      reason: "You are not asking for anything beyond what you already have.",
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
            requestedTotal,
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

  const increment = clampIncrement(parsed.increment, maxDelta);
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
