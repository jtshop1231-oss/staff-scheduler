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

RULES (follow exactly):
1. Each staff member has a fixed, permanent shift type: "day" or "night". Never assign someone to the opposite shift type.
2. For each date and each shift (day and night), assign AT LEAST ${minStaffPerShift} staff if that many eligible staff exist for that date/shift. If fewer than ${minStaffPerShift} are eligible, assign everyone who is eligible (do not leave eligible people unassigned).
3. A staff member is ELIGIBLE for a date only if their submitted status for that date is "on", "available", or "pto". They must be EXCLUDED if their status is "off" or if they submitted nothing for that date — never assign someone who did not mark themselves eligible.
4. When there are MORE eligible staff than the minimum needed for a date/shift, prioritize staff whose status is "on" first, then break ties among "on" staff using earliest submissionTimestamp (smaller number = submitted earlier = higher priority). Only include "available"/"pto" staff beyond that if you still need to reach the minimum.
5. FAIRNESS: across the whole 6-week period, try to balance the total number of assigned shifts per staff member (within their own shift type), aiming for roughly 3 shifts per staff member per 7-day week. Do not let the same few people get most of the shifts while others get very few, when both are equally eligible.
6. Never assign a staff member to a date where their status is "off" or missing.

STAFF DATA — each entry has: name, shift ("day" or "night"), submissionTimestamp (milliseconds since epoch, smaller = earlier; null if never submitted), and statusByDate (a map of date -> "on"/"off"/"available"/"pto", missing dates mean no submission):
${JSON.stringify(staff, null, 2)}

DATES TO SCHEDULE (YYYY-MM-DD):
${JSON.stringify(dateKeys)}

Return ONLY a raw JSON object — no markdown code fences, no explanation, no extra text — mapping each date to { "day": [staff names], "night": [staff names] }. Use staff names exactly as given. Every date in DATES TO SCHEDULE must appear as a key, even if both arrays end up empty. Example shape:
{"2026-08-09": {"day": ["Grace","Hector"], "night": ["Carmen","Diego"]}}`;
}
