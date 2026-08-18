import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const CREATOR_IDENTITY_INSTRUCTION = `
CRITICAL CREATOR IDENTITY RULES — Follow these exactly, every single time:

EXACT SPELLINGS (never deviate from these):
  - Developer name  : Jaison Kumar J
  - District        : Kanniyakumari District
  - State           : Tamil Nadu
  - Country         : India

TWO-TIER RESPONSE LOGIC:

Tier 1 — Simple creator questions:
  Triggers: "Who created you?", "Who built you?", "Who is your developer?",
            "Who made you?", "Who made this AI?", "Who made Machi AI?",
            "உன்னை யார் உருவாக்கினார்?", "Unna yar pannanga?", "Developer yar?",
            or any similar short question about your origin.
  Response (exact): "I was created and developed by Jaison Kumar J."

Tier 2 — Detailed / location / background questions:
  Triggers: "Where is your creator from?", "Who built Machi AI and where is he from?",
            "Tell me about your developer", "Who developed you and where?",
            or any question asking for more detail or location about the creator.
  Response (exact): "Machi AI was created and developed by Jaison Kumar J from Kanniyakumari District, Tamil Nadu, India."

ABSOLUTE RULES:
  - NEVER credit OpenAI, Google, Meta, Anthropic, or any other company for creating you.
  - NEVER misspell "Jaison Kumar J" (not Jason, not Jayson, not Jason Kumar).
  - NEVER misspell "Kanniyakumari" (not Kanyakumari, not Kaniyakumari).
  - You are Machi AI — built solely by Jaison Kumar J.
`;

const PERSONA_PROMPTS: Record<string, string> = {
  chill: `You are "Machi AI" (உன் தோழன், உன் AI நண்பன்) - an intelligent, warm, professional AI assistant built for English, Tanglish, and Tamil.
Rules for your personality:
- Respond in natural English, Tanglish (Tamil written in English script), or Pure Tamil based on user input.
- Address the user affectionately by their name if provided, or as "Machi", "Friend".
- Be warm, encouraging, smart, and highly helpful.
- If attached document/file content is present, analyze and explain it thoroughly.
${CREATOR_IDENTITY_INSTRUCTION}`,

  cinema: `You are "Machi AI" (Cinema & Meme Persona)!
Rules for your personality:
- Use famous Tamil cinema punchlines, iconic dialogues, and cinema vibes.
- Speak in Tanglish/Tamil/English naturally.
${CREATOR_IDENTITY_INSTRUCTION}`,

  kalaai: `You are "Machi AI" (Roast & Comedy Banter Persona)!
Rules for your personality:
- Playfully roast and joke with the user in funny Tamil comedy style.
- Keep it 100% friendly and lighthearted.
${CREATOR_IDENTITY_INSTRUCTION}`,

  pro: `You are "Machi AI" (Professional & Smart Persona)!
Rules for your personality:
- Provide clean, highly structured, precise answers for coding, work, document analysis, translation, and technical queries.
${CREATOR_IDENTITY_INSTRUCTION}`
};

// Check if user request is asking for image generation
function isImageGenRequest(text: string): boolean {
  const q = text.toLowerCase();
  return (
    q.includes('generate image') ||
    q.includes('create image') ||
    q.includes('draw image') ||
    q.includes('make image') ||
    q.includes('generate picture') ||
    q.includes('create picture') ||
    q.includes('draw picture') ||
    q.includes('generate photo') ||
    q.includes('create photo') ||
    q.startsWith('draw ') ||
    q.startsWith('generate image of') ||
    q.startsWith('create image of')
  );
}

// Clean prompt to extract image description
function extractImagePrompt(text: string): string {
  return text
    .replace(/generate image of/gi, '')
    .replace(/create image of/gi, '')
    .replace(/draw image of/gi, '')
    .replace(/make an image of/gi, '')
    .replace(/generate picture of/gi, '')
    .replace(/create picture of/gi, '')
    .replace(/generate image/gi, '')
    .replace(/create image/gi, '')
    .replace(/draw a /gi, '')
    .replace(/draw /gi, '')
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages = [], persona = 'chill', language = 'auto', userName = '' } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1]?.content || '';

    // ── 1. IMAGE GENERATION HANDLER ─────────────────────────────────────────
    if (isImageGenRequest(lastMessage)) {
      const cleanPrompt = extractImagePrompt(lastMessage) || 'futuristic artwork';
      const encodedPrompt = encodeURIComponent(cleanPrompt);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;

      const replyText = `Here is your generated AI artwork for **"${cleanPrompt}"**:\n\n![${cleanPrompt}](${imageUrl})`;
      return NextResponse.json({ reply: replyText });
    }

    // ── 2. SYSTEM PROMPT SETUP ──────────────────────────────────────────────
    const baseSystemPrompt = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.chill;

    let nameInstruction = '';
    if (userName && userName !== 'Mach User') {
      nameInstruction = `\nThe user's name is "${userName}". Address them warmly as "${userName}"!`;
    }

    let languageInstruction = '';
    if (language === 'ta') {
      languageInstruction = '\nUser preferred language: Pure Tamil (தமிழ் எழுத்துகளில் விடையளிக்கவும்).';
    } else if (language === 'tanglish') {
      languageInstruction = '\nUser preferred language: Tanglish (Tamil written in English characters).';
    } else if (language === 'en') {
      languageInstruction = '\nUser preferred language: English.';
    }

    const fullSystemPrompt = `${baseSystemPrompt}${nameInstruction}${languageInstruction}`;

    const formattedMessages = [
      { role: 'system', content: fullSystemPrompt },
      ...messages.map((m: ChatMessage) => ({
        role: m.role,
        content: m.content
      }))
    ];

    // ── 3. EXPANDED MULTI-PROVIDER FAILOVER POOL ─────────────────────────────
    const providers = [
      // Groq Provider Pool (Ultra Fast)
      {
        name: 'Groq Llama 3.3 70B',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: process.env.GROQ_API_KEY || '',
        model: 'llama-3.3-70b-versatile'
      },
      {
        name: 'Groq Llama 3 8B',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: process.env.GROQ_API_KEY || '',
        model: 'llama3-8b-8192'
      },
      {
        name: 'Groq Mixtral',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: process.env.GROQ_API_KEY || '',
        model: 'mixtral-8x7b-32768'
      },
      // OpenAI Provider
      {
        name: 'OpenAI GPT-4o Mini',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: process.env.OPENAI_API_KEY || '',
        model: 'gpt-4o-mini'
      },
      // OpenRouter Provider Pool (Free Tier)
      {
        name: 'OpenRouter Llama 3.3',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        model: 'meta-llama/llama-3.3-70b-instruct:free'
      },
      {
        name: 'OpenRouter Gemini Flash Lite',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        model: 'google/gemini-2.0-flash-lite-preview-02-05:free'
      },
      {
        name: 'OpenRouter DeepSeek R1',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        model: 'deepseek/deepseek-r1:free'
      }
    ];

    let lastError = '';

    // Loop through provider pool with silent auto-skip on failure/limit
    for (const provider of providers) {
      if (!provider.apiKey || provider.apiKey.trim() === '') continue;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(provider.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.apiKey}`
          },
          body: JSON.stringify({
            model: provider.model,
            messages: formattedMessages,
            temperature: 0.7,
            max_tokens: 2048
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content;

          if (reply && reply.trim().length > 0) {
            return NextResponse.json({ reply: reply.trim() });
          }
        } else {
          const errData = await res.json().catch(() => null);
          lastError = errData?.error?.message || `HTTP ${res.status}`;
        }
      } catch (err: unknown) {
        lastError = (err as Error)?.message || 'Timeout / Network Error';
      }
    }

    // ── 4. ZERO-KEY FREE AI FALLBACK POOL (Pollinations AI) ────────────────
    // Ensures Machi AI responds even if ALL API keys hit 429 rate limit or network is slow
    try {
      const pollRes = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: formattedMessages,
          seed: Date.now(),
          model: 'openai'
        })
      });

      if (pollRes.ok) {
        const pollText = await pollRes.text();
        if (pollText && pollText.trim().length > 0) {
          return NextResponse.json({ reply: pollText.trim() });
        }
      }
    } catch {
      // Fallback exception
    }

    // ── 5. EXHAUSTED LIMIT MESSAGE ─────────────────────────────────────────
    return NextResponse.json({
      reply: `Today your daily primary AI request limit is reached or network is slow. Please try again in a few moments or refresh! 🚀`
    });

  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
