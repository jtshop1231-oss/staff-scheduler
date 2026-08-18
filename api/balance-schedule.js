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
                max_tokens: 4096,
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
            return res.status(502).json({ error: 'Claude did not return a text response.' });
        }

        let cleaned = textBlock.text.trim();
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');

        let schedule;
        try {
            schedule = JSON.parse(cleaned);
        } catch (parseError) {
            return res.status(502).json({ error: 'Could not parse Claude\'s response as JSON.', raw: textBlock.text });
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
    return `You are a hospital telemetry department scheduling assistant. Balance a 6-week staff schedule fairly and safely.

RULES (follow exactly, in this priority order):
1. Each staff member has a fixed, permanent shift type: "day" or "night" (see the "shift" field). Never assign someone to the opposite shift type.
2. ELIGIBILITY: a staff member is eligible for a given date only if their statusByDate value for that date is "on", "available", or "pto". They must be EXCLUDED from that date if their status is "off" or missing — never assign someone who did not mark themselves eligible for that specific date.
3. LOCKED / PRE-SET WEEKDAYS: each staff member may have a "lockedWeekdays" list (e.g. ["Saturday","Sunday"]). If a date falls on one of their locked weekdays AND they are eligible that date, they should always be scheduled that date — these days are fixed by Admin and must NEVER be changed or rotated away. Locked weekdays are exempt from the rotation rule below.
4. WEEKDAY ROTATION (soft preference, not a hard rule): each staff member has a "previousWeekdays" list — the weekday(s) they were scheduled on in the last approved cycle. Where possible (staff is eligible and doing so doesn't violate the minimum staffing or fairness rules), prefer shifting each staff member to a DIFFERENT weekday than their previousWeekdays this cycle (e.g. someone who worked Monday last cycle should ideally work Tuesday this cycle), so the same people are not always stuck on the same day of the week forever. Do NOT apply this rotation to a staff member's lockedWeekdays (rule 3 always wins there).
5. MINIMUM STAFFING: for each date and each shift (day and night), assign AT LEAST ${minStaffPerShift} staff if that many eligible staff exist. If fewer than ${minStaffPerShift} are eligible, assign everyone who is eligible (never leave an eligible person unassigned when the minimum isn't met).
6. PRIORITY / TIE-BREAKING when MORE staff are eligible for a date/shift than the minimum needed: first prefer staff with statusByDate "on" over "available"/"pto". Among staff who are otherwise tied, use "quarterlyPriorityRank" (lower number = higher priority this quarter — this is pre-computed and already accounts for fair quarterly rotation, so just use it directly) as the primary tie-breaker, then "fcfsTimestamp" (smaller number = submitted earlier = higher priority; this may be null) as a secondary tie-breaker if ranks are equal.
7. FAIRNESS: across the whole 6-week period, balance the total number of assigned shifts per staff member (within their own shift type), aiming for roughly 3 shifts per staff member per 7-day week. Do not let the same few people get most of the shifts while others equally eligible get very few.
8. Never assign a staff member to a date where their status is "off" or missing, even if it would help rotation, locked days, or fairness — eligibility (rule 2) always overrides everything else.

STAFF DATA — each entry has: name, shift ("day"/"night"), lockedWeekdays (weekday names that are fixed for this staff, per rule 3), previousWeekdays (weekday names they worked last cycle, per rule 4), fcfsTimestamp (ms since epoch or null), fcfsSource ("preferences" or "shiftRequest", tells you which submission the timestamp came from), quarterlyPriorityRank (pre-computed quarterly-rotated priority, 1 = highest), and statusByDate (map of date -> "on"/"off"/"available"/"pto", missing dates = no submission):
${JSON.stringify(staff, null, 2)}

DATES TO SCHEDULE (YYYY-MM-DD):
${JSON.stringify(dateKeys)}

Return ONLY a raw JSON object — no markdown code fences, no explanation, no extra text — mapping each date to { "day": [staff names], "night": [staff names] }. Use staff names exactly as given. Every date in DATES TO SCHEDULE must appear as a key, even if both arrays end up empty. Example shape:
{"2026-08-09": {"day": ["Grace","Hector"], "night": ["Carmen","Diego"]}}`;
}
