// Vercel Serverless Function — /api/schedule-chat
//
// Powers the small "Ask AI About This Schedule" chatbox on the Pending
// Approval page. This is a SEPARATE, much lighter endpoint than
// /api/balance-schedule — it does not recompute or edit the schedule,
// it only lets Admin have a short, strictly-scoped conversation about
// the balance that was already generated (and saved) there.

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY. Check Vercel Environment Variables.' });
    }

    try {
        const { messages, scheduleSummary } = req.body || {};

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Missing required field: messages.' });
        }

        // Anthropic's API requires the message list to start with a
        // "user" message. Our chat UI auto-opens with an assistant
        // greeting (the "Are you satisfied?" starter) before the Admin
        // has said anything — strip any leading assistant message(s) so
        // the API call itself always starts on a real user turn.
        const apiMessages = messages
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .map((m) => ({ role: m.role, content: m.content }));

        while (apiMessages.length && apiMessages[0].role === 'assistant') {
            apiMessages.shift();
        }

        if (apiMessages.length === 0) {
            return res.status(400).json({ error: 'No user message to respond to yet.' });
        }

        const systemPrompt = buildChatSystemPrompt(scheduleSummary || '');

        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-5',
                max_tokens: 1024,
                system: systemPrompt,
                messages: apiMessages
            })
        });

        if (!anthropicResponse.ok) {
            const errText = await anthropicResponse.text();
            return res.status(502).json({ error: 'Anthropic API error: ' + errText });
        }

        const data = await anthropicResponse.json();
        const textBlock = (data.content || []).find((block) => block.type === 'text');

        if (!textBlock) {
            return res.status(502).json({ error: 'Claude did not return a text response.' });
        }

        return res.status(200).json({ reply: textBlock.text.trim() });
    } catch (error) {
        return res.status(500).json({ error: 'Server error: ' + error.message });
    }
}

function buildChatSystemPrompt(scheduleSummary) {
    return `You are a scheduling assistant embedded in a hospital staff scheduling app. You are having a short conversation with Admin (a scheduling coordinator) about the AI-generated schedule balance they just reviewed and saved.

STRICT SCOPE — this is the most important rule: you may ONLY discuss this specific schedule and its balancing — staffing coverage, shift assignments, fairness across staff, locked/pre-set dates, understaffed dates, and reasonable next steps for Admin to take. If Admin asks about anything outside this (general conversation, unrelated topics, technical or code questions about how the app itself is built, or anything not about this schedule), politely decline in one short sentence and redirect back to scheduling — do not answer the off-topic question at all, even partially.

TONE: Talk like a helpful scheduling coordinator briefing their manager, not like software documentation. Never mention internal rule numbers, tier labels, or technical field/variable names — plain everyday language only, matching the summary below.

LENGTH: Keep replies short and conversational — 1-3 sentences typically. Only go longer if Admin explicitly asks for more detail or a full breakdown.

IMPORTANT LIMITATION: This chat cannot directly edit the schedule. If Admin says they are not satisfied or wants something changed, acknowledge it briefly and remind them they can click any date on the calendar to manually adjust who's assigned, or run "AI Balance Schedule" again for a fresh attempt.

THE SCHEDULE BALANCE SUMMARY (this is your only source of truth about what happened in this schedule — do not invent details beyond what's here):
"""
${scheduleSummary || '(no summary available for this schedule yet)'}
"""`;
}
