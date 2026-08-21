// Vercel Serverless Function — /api/balance-schedule
//
// This runs on Vercel's server (never in the browser), so the
// ANTHROPIC_API_KEY environment variable stays secret. The staff
// scheduler app (index.html) calls this endpoint; this endpoint
// calls the real Claude API and returns a balanced schedule.

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY. Check Vercel Environment Variables.' });
    }

    try {
        const { staff, dateKeys, minStaffPerShift } = req.body || {};

        if (!Array.isArray(staff) || !Array.isArray(dateKeys) || !minStaffPerShift) {
            return res.status(400).json({ error: 'Missing required fields: staff, dateKeys, minStaffPerShift.' });
        }

        const prompt = buildPrompt(staff, dateKeys, minStaffPerShift);

        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-5',
                max_tokens: 20000,
                output_config: { effort: 'medium' },
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!anthropicResponse.ok) {
            const errText = await anthropicResponse.text();
            return res.status(502).json({ error: 'Anthropic API error: ' + errText });
        }

        const data = await anthropicResponse.json();
        const textBlock = (data.content || []).find(block => block.type === 'text');

        if (!textBlock) {
            return res.status(502).json({
                error: `Claude did not return a text response (stop_reason: ${data.stop_reason || 'unknown'}). This usually means max_tokens was too low for the response — try increasing it.`
            });
        }

        if (data.stop_reason === 'max_tokens') {
            return res.status(502).json({
                error: 'Claude\'s response was cut off before it finished (stop_reason: max_tokens) — the schedule was too large for the current max_tokens setting. Try increasing max_tokens further.',
                raw: textBlock.text.slice(-500)
            });
        }

        let cleaned = textBlock.text.trim();
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

        // Defensive extra step: if Claude added any stray text before/after
        // the JSON despite instructions not to, pull out just the
        // outermost {...} object instead of failing outright.
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            cleaned = cleaned.slice(firstBrace, lastBrace + 1);
        }

        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch (parseError) {
            return res.status(502).json({
                error: 'Could not parse Claude\'s response as JSON. First 500 characters of its response: ' + textBlock.text.slice(0, 500),
                raw: textBlock.text
            });
        }

        // Expected shape is { schedule, summary }. Fall back gracefully if
        // Claude ever returns just the bare schedule object (e.g. missing
        // the "schedule" wrapper key) so this doesn't hard-fail.
        const schedule = (parsed.schedule && typeof parsed.schedule === 'object') ? parsed.schedule : parsed;
        const summary = typeof parsed.summary === 'string' ? parsed.summary : '';

        return res.status(200).json({ schedule, summary });
    } catch (error) {
        console.error('balance-schedule error:', error);
        return res.status(500).json({ error: error.message || 'Unknown server error.' });
    }
}

// Builds the instructions sent to Claude, encoding the department's
// established scheduling rules.
function buildPrompt(staff, dateKeys, minStaffPerShift) {
    return `You are a hospital department scheduling assistant. Balance a 6-week staff schedule fairly and safely, using ONLY the staff who actually submitted a Shift Request or Preference. Treat this as ONE holistic 6-week puzzle, not 42 independent daily decisions — actively move eligible staff between dates to smooth out surpluses and shortfalls before settling on a final answer.

RULES (follow exactly, in this priority order):

1. FIXED SHIFT TYPE: Each staff member has a fixed, permanent shift type: "day" or "night" (see the "shift" field). Never assign someone to the opposite shift type.

2. TWO-TIER ELIGIBILITY per date, based ONLY on what the staff member actually submitted (this is the most important rule — read carefully):
   Look at each staff member's statusByDate value for the date (missing = no key present for that date at all):
   - Status "off" → EXCLUDED. Never assign this person this date, no matter what (this overrides every other rule, including the staffing target).
   - Status "on" → TIER 1 (highest-priority eligible candidate).
   - Status "available" or "pto" → TIER 2 (eligible, lower priority than Tier 1).
   - MISSING (no statusByDate entry at all for that date — this staff member did not submit a Shift Request or Preference for this date) → NOT ELIGIBLE. Do not assign this person this date under any circumstance. A staff member who submitted nothing is simply outside the scheduling pool for that date — never treated as a fallback, never used just to fill a number. Only Tier 1 and Tier 2 (people who actually responded) may ever be assigned.
   When choosing WHICH people fill a shift: exhaust Tier 1 candidates first, then Tier 2, using rule 6 to pick among candidates within the same tier. Never go beyond Tier 1 + Tier 2.

3. LOCKED / PRE-SET DATES: each staff member may have a "lockedDates" list of exact dates (YYYY-MM-DD) that Admin has pre-set for them. If a date appears in their lockedDates, they MUST be scheduled that date (their statusByDate for that date will already be "on" in practice, but treat the lockedDates entry as an unconditional guarantee regardless). A locked staff member fills ONE of that date's ${minStaffPerShift} target slots (per rule 5) — they do not add an extra slot beyond the target. Locked dates are exempt from rule 4's rotation preference and are never touched by rule 4b's redistribution — never move a locked staff member off their locked date.

4. WEEKDAY ROTATION (soft preference, not a hard rule): each staff member has a "previousWeekdays" list — the weekday(s) they were scheduled on in the last approved cycle. Where possible (staff is eligible and doing so doesn't violate the staffing target, fairness, or a locked date), prefer shifting each staff member to a DIFFERENT weekday than their previousWeekdays this cycle, so the same people aren't always stuck on the same day of the week forever. Never apply this to a staff member's lockedDates (rule 3 always wins there).

4b. HOLISTIC REDISTRIBUTION ACROSS THE 6 WEEKS (do this before finalizing): after an initial pass, look across the WHOLE period for dates that are short of the ${minStaffPerShift} target. For each shortfall date, check whether any Tier 1/2 eligible staff member for that date (per rule 2 — they must have actually submitted "on"/"available"/"pto" for that specific date) was left unassigned there only because their day was already at target — i.e. they are ALSO eligible for the shortfall date, but currently assigned elsewhere. If moving them to the shortfall date would still leave their original date at or above the target after the move, reassign them to the shortfall date instead. Repeat this check across the full period until no more such moves are possible. This active rebalancing only ever moves people among their OWN submitted eligible dates — it never invents eligibility for a date they didn't submit anything for.

5. STAFFING TARGET — a target, not just a minimum, and never a ceiling to exceed: for each date and each shift (day and night), aim for EXACTLY ${minStaffPerShift} staff, using ONLY Tier 1 + Tier 2 candidates (rule 2).
   - If MORE than ${minStaffPerShift} people are eligible (Tier 1 + Tier 2) for a date/shift after redistribution (rule 4b), select exactly ${minStaffPerShift} of them using Tier order and rule 6's tie-breakers. Do NOT assign the extra eligible people that date — being eligible does not guarantee a slot once the target is filled.
   - Never assign MORE than ${minStaffPerShift} for any date/shift under any circumstance, including fairness (rule 7) — fairness is achieved by WHICH people fill the fixed number of slots, never by adding extra people to a single day.
   - If FEWER than ${minStaffPerShift} people submitted "on"/"available"/"pto" for a date/shift (even after rule 4b's redistribution), assign only that smaller number — do NOT pull in anyone who didn't submit anything for that date, and do not leave the field artificially at zero either if some real Tier 1/2 people exist; just assign exactly however many real, eligible people there are, even if that's below the target. It is completely acceptable, and expected in a small unit, for a date/shift to end up below ${minStaffPerShift} (including zero) this way — a real, honest shortfall is what tells Admin where to step in and manually find coverage. Never pad a day with someone who submitted nothing just to hit the number.

6. TIE-BREAKING when choosing exactly which staff fill a date/shift out of a larger eligible pool within the same tier: use "quarterlyPriorityRank" (lower number = higher priority this quarter — pre-computed, use directly) as the primary tie-breaker, then "fcfsTimestamp" (smaller number = submitted earlier = higher priority; may be null) as a secondary tie-breaker.

7. FAIRNESS: across the whole 6-week period, balance the total number of assigned shifts per staff member (within their own shift type), aiming for roughly 3 shifts per staff member per 7-day week, among the staff who actually submitted. Do not let the same few people get most of the shifts while others equally eligible get very few. Achieve this by choosing WHO fills each day's fixed target slots, never by adding extra slots.

8. Rule 2's "off" exclusion and its "not eligible if missing" rule always override every other rule, including the staffing target — never schedule someone marked "off", and never schedule someone who submitted nothing for that date.

STAFF DATA — each entry has: name, shift ("day"/"night"), lockedDates (exact YYYY-MM-DD dates that are guaranteed for this staff, per rule 3), previousWeekdays (weekday names they worked last cycle, per rule 4), fcfsTimestamp (ms since epoch or null), fcfsSource ("preferences" or "shiftRequest", tells you which submission the timestamp came from), quarterlyPriorityRank (pre-computed quarterly-rotated priority, 1 = highest), and statusByDate (map of date -> "on"/"off"/"available"/"pto"; a date with NO key present means this staff member did not submit anything for that date — they are OUT OF THE POOL for that date, never a fallback):
${JSON.stringify(staff, null, 2)}

DATES TO SCHEDULE (YYYY-MM-DD):
${JSON.stringify(dateKeys)}

Return ONLY a raw JSON object — no markdown code fences, no explanation outside the JSON, no extra text — with exactly two top-level keys:
- "schedule": an object mapping each date to { "day": [staff names], "night": [staff names] }. Use staff names exactly as given. Every date in DATES TO SCHEDULE must appear as a key, even if both arrays end up empty.
- "summary": a short plain-English explanation (4-7 sentences) of the practical RESULT, written the way a scheduling coordinator would brief their manager — NOT a description of how the software works. Cover: (a) roughly how many dates/shifts ended up fully staffed vs short and why (genuinely nobody available that day), (b) any notable staff moves you made to fix a shortfall by shifting someone from a day that had extra people, (c) any pre-set/locked dates that were honored, (d) roughly how shifts were balanced fairly across staff, and (e) specific dates Admin should double-check first. Be concrete with real dates/names from this run, not generic. IMPORTANT — do NOT mention internal mechanics: no rule numbers, no tier labels ("Tier 1/2/3"), no field/variable names (statusByDate, lockedDates, quarterlyPriorityRank, fcfsTimestamp, etc.), and no explanation of the decision logic or process itself. Just describe what happened and why in everyday scheduling terms, as a short operational note — never as documentation of the system.

Example shape:
{"schedule": {"2026-08-09": {"day": ["Grace","Hector"], "night": ["Carmen","Diego"]}}, "summary": "Most dates reached the 2-person target from staff who requested ON. Aug 13 night is short at 1 person (only Diego was available) since no one else signed up that date. Felix was moved from Aug 14, which had extra people available, to cover Aug 20 night instead. Carmen's pre-set days were kept as scheduled. Admin should double-check Aug 13 and Aug 27 nights, which are both understaffed."}`;
}
