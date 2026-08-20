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

        let schedule;
        try {
            schedule = JSON.parse(cleaned);
        } catch (parseError) {
            return res.status(502).json({
                error: 'Could not parse Claude\'s response as JSON. First 500 characters of its response: ' + textBlock.text.slice(0, 500),
                raw: textBlock.text
            });
        }

        return res.status(200).json({ schedule });
    } catch (error) {
        console.error('balance-schedule error:', error);
        return res.status(500).json({ error: error.message || 'Unknown server error.' });
    }
}

// Builds the instructions sent to Claude, encoding the department's
// established scheduling rules.
function buildPrompt(staff, dateKeys, minStaffPerShift) {
    return `You are a hospital department scheduling assistant. Balance a 6-week staff schedule fairly, safely, and PRECISELY — every date must end up staffed with EXACTLY the configured target number of staff per shift, no more and no fewer, whenever enough eligible staff exist. This exact-target behavior is critical for small units that only have a couple of staff members total.

RULES (follow exactly, in this priority order):

1. FIXED SHIFT TYPE: Each staff member has a fixed, permanent shift type: "day" or "night" (see the "shift" field). Never assign someone to the opposite shift type.

2. THREE-TIER ELIGIBILITY per date (this is the most important rule — read carefully):
   Look at each staff member's statusByDate value for the date (missing = no key present for that date at all):
   - Status "off" → EXCLUDED. Never assign this person this date, no matter what (this overrides every other rule, including minimum staffing).
   - Status "on" → TIER 1 (highest-priority eligible candidate).
   - Status "available" or "pto" → TIER 2 (eligible, lower priority than Tier 1).
   - MISSING (no statusByDate entry at all for that date — they submitted nothing, from either their Shift Request or their Preferences) → TIER 3, "fallback-eligible". Do NOT treat this the same as "off". Tier 3 people are only assigned if Tier 1 + Tier 2 people aren't enough to reach minStaffPerShift for that date/shift — but they MUST be used for that purpose. Never leave a shift empty or understaffed just because everyone who is short of the minimum is Tier 3 rather than Tier 1/2 — filling the day always wins over waiting for an explicit response that never came.
   When choosing WHICH people fill a shift: always exhaust all Tier 1 candidates first, then Tier 2, then Tier 3, in that order, using rule 6 to pick among candidates within the same tier.

3. LOCKED / PRE-SET DATES: each staff member may have a "lockedDates" list of exact dates (YYYY-MM-DD) that Admin has pre-set for them. If a date appears in their lockedDates, they MUST be scheduled that date (their statusByDate for that date will already be "on" in practice, but treat the lockedDates entry as an unconditional guarantee regardless). A locked staff member fills ONE of that date's ${minStaffPerShift} target slots (per rule 5) — they do not add an extra slot beyond the target; the remaining slots (if any) go to other eligible staff as usual. Locked dates are completely exempt from rule 4's rotation preference — never skip or move a locked date for the sake of variety.

4. WEEKDAY ROTATION (soft preference, not a hard rule): each staff member has a "previousWeekdays" list — the weekday(s) they were scheduled on in the last approved cycle. Where possible (staff is eligible and doing so doesn't violate minimum staffing, fairness, or a locked date), prefer shifting each staff member to a DIFFERENT weekday than their previousWeekdays this cycle, so the same people aren't always stuck on the same day of the week forever. Never apply this to a staff member's lockedDates (rule 3 always wins there).

5. STAFFING TARGET — MANDATORY, BOTH A FLOOR AND A CEILING: for each date and each shift (day and night), assign EXACTLY ${minStaffPerShift} staff whenever enough non-"off" staff of that shift type exist — no more, no fewer. This is a hard target, not just a minimum:
   - If there are MORE than ${minStaffPerShift} eligible candidates (Tier 1 + Tier 2 + Tier 3 combined) for a date/shift, select exactly ${minStaffPerShift} of them using Tier order first (all Tier 1 before any Tier 2, all Tier 2 before any Tier 3) and rule 6's tie-breakers within a tier. Do NOT assign the extra eligible people that date, even if they are Tier 1 "on" — being eligible does not guarantee a slot once the target is already filled. Leaving someone unassigned on a date where they were eligible is expected and correct once ${minStaffPerShift} people are already assigned.
   - If there are FEWER than ${minStaffPerShift} eligible candidates total for a date/shift, assign everyone who isn't "off" (this is the only case where the day ends up below the target — never leave a date empty just because explicit Tier 1/2 responses ran out; pull in Tier 3 fallback candidates first, per rule 2, before accepting an understaffed day).
   - Never assign MORE than ${minStaffPerShift} for any date/shift under any circumstance, including fairness (rule 7) — fairness is achieved by WHICH people fill the ${minStaffPerShift} slots over the 6 weeks, never by adding extra people to a single day.

6. TIE-BREAKING when choosing exactly which ${minStaffPerShift} people fill a date/shift out of a larger eligible pool within the same tier: use "quarterlyPriorityRank" (lower number = higher priority this quarter — pre-computed, use directly) as the primary tie-breaker, then "fcfsTimestamp" (smaller number = submitted earlier = higher priority; may be null) as a secondary tie-breaker.

7. FAIRNESS: across the whole 6-week period, balance the total number of assigned shifts per staff member (within their own shift type), aiming for roughly 3 shifts per staff member per 7-day week. Do not let the same few people get most of the shifts while others equally eligible get very few — this applies across all three tiers, including how Tier 3 fallback assignments get distributed. Achieve this by choosing WHO fills each day's fixed ${minStaffPerShift} slots, never by adding extra slots.

8. Rule 2's "off" exclusion always overrides every other rule, including minimum staffing — never schedule someone marked "off".

STAFF DATA — each entry has: name, shift ("day"/"night"), lockedDates (exact YYYY-MM-DD dates that are guaranteed for this staff, per rule 3), previousWeekdays (weekday names they worked last cycle, per rule 4), fcfsTimestamp (ms since epoch or null), fcfsSource ("preferences" or "shiftRequest", tells you which submission the timestamp came from), quarterlyPriorityRank (pre-computed quarterly-rotated priority, 1 = highest), and statusByDate (map of date -> "on"/"off"/"available"/"pto"; a date with NO key present means no submission at all from either source — that is Tier 3, not excluded):
${JSON.stringify(staff, null, 2)}

DATES TO SCHEDULE (YYYY-MM-DD):
${JSON.stringify(dateKeys)}

Return ONLY a raw JSON object — no markdown code fences, no explanation, no extra text — mapping each date to { "day": [staff names], "night": [staff names] }. Use staff names exactly as given. Every date in DATES TO SCHEDULE must appear as a key, even if both arrays end up empty (which should be rare — only when everyone of that shift type is "off" that day). Example shape:
{"2026-08-09": {"day": ["Grace","Hector"], "night": ["Carmen","Diego"]}}`;
}
