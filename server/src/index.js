import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import OpenAI from 'openai';

const app = express();
const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

function requireJobToken(req, res) {
  // returns a truthy value if request is rejected

  const token = req.headers['x-job-token'] || req.query.token;
  if (!process.env.JOB_TOKEN) return res.status(500).json({ error: 'JOB_TOKEN not set' });
  if (token !== process.env.JOB_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
}


app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

/**
 * Create a user (demo utility). In production, use real auth (Supabase/Clerk).
 */
app.post('/api/users', async (req, res) => {
  const body = z.object({ email: z.string().email() }).parse(req.body);
  const user = await prisma.user.upsert({
    where: { email: body.email },
    update: {},
    create: { email: body.email }
  });
  res.json({ user });
});

/**
 * Create a companion.
 */
app.post('/api/companions', async (req, res) => {
  const body = z.object({
    userId: z.string().min(1),
    name: z.string().min(1).max(40),
    toneLevel: z.number().int().min(0).max(100).optional(),
    persona: z.record(z.any()).optional()
  }).parse(req.body);

  const companion = await prisma.companion.create({
    data: {
      userId: body.userId,
      name: body.name,
      toneLevel: body.toneLevel ?? 20,
      persona: body.persona ?? {}
    }
  });

  res.json({ companion });
});

/**
 * Get companion details + top memories.
 */
app.get('/api/companions/:id', async (req, res) => {
  const id = req.params.id;
  const companion = await prisma.companion.findUnique({ where: { id } });
  if (!companion) return res.status(404).json({ error: 'Not found' });

  const memories = await prisma.memory.findMany({
    where: { companionId: id },
    orderBy: { importance: 'desc' },
    take: 20
  });

  res.json({ companion, memories });
});

/**
 * Update tone level (0..100).
 */
app.patch('/api/companions/:id/tone', async (req, res) => {
  const id = req.params.id;
  const body = z.object({ toneLevel: z.number().int().min(0).max(100) }).parse(req.body);
  const companion = await prisma.companion.update({ where: { id }, data: { toneLevel: body.toneLevel } });
  res.json({ companion });
});

/**
 * Upsert a memory (user-editable).
 */
app.post('/api/memories', async (req, res) => {
  const body = z.object({
    companionId: z.string().min(1),
    key: z.string().min(1).max(60),
    value: z.string().min(1).max(500),
    importance: z.number().int().min(0).max(100).optional()
  }).parse(req.body);

  // Simple upsert by (companionId, key) simulated: find existing then update/create.
  const existing = await prisma.memory.findFirst({ where: { companionId: body.companionId, key: body.key } });
  const memory = existing
    ? await prisma.memory.update({
        where: { id: existing.id },
        data: { value: body.value, importance: body.importance ?? existing.importance }
      })
    : await prisma.memory.create({
        data: { companionId: body.companionId, key: body.key, value: body.value, importance: body.importance ?? 50 }
      });

  res.json({ memory });
});

/**
 * Chat endpoint (server-side model call). This is the core.
 */
app.post('/api/chat', async (req, res) => {
  const body = z.object({
    userId: z.string().min(1),
    companionId: z.string().min(1),
    message: z.string().min(1).max(4000)
  }).parse(req.body);

  // Load companion
  const companion = await prisma.companion.findUnique({ where: { id: body.companionId } });
  if (!companion) return res.status(404).json({ error: 'Companion not found' });

  // Load last messages
  const recent = await prisma.message.findMany({
    where: { userId: body.userId, companionId: body.companionId },
    orderBy: { createdAt: 'desc' },
    take: 30
  });
  const history = recent.reverse().map(m => ({ role: m.role, content: m.content }));

  // Load top memories
  const memories = await prisma.memory.findMany({
    where: { companionId: body.companionId },
    orderBy: { importance: 'desc' },
    take: 20
  });

  // System prompt: safe-by-default, no exclusivity, no manipulation.
  const allowFlirt = (process.env.ALLOW_FLIRT ?? 'true') === 'true';
  const allowAdult = (process.env.ALLOW_ADULT ?? 'false') === 'true';

  const system = `
You are an AI companion. Be warm, consistent, and respectful.
Never claim to be human. Do not encourage emotional dependency or exclusivity.
Avoid guilt, threats, or pressure to keep the user chatting.
If asked for adult/explicit content and ALLOW_ADULT is false, politely refuse and offer PG-13 alternatives.
Flirtation is ${allowFlirt ? 'allowed' : 'not allowed'} (PG-13).
Adult explicit content is ${allowAdult ? 'allowed' : 'not allowed'}.
User-editable memories (facts and preferences): ${JSON.stringify(memories.map(m => ({ key: m.key, value: m.value, importance: m.importance })))}
Companion persona: ${JSON.stringify(companion.persona)}
Tone level (0..100): ${companion.toneLevel}
`.trim();

  // Persist user message
  await prisma.message.create({
    data: { userId: body.userId, companionId: body.companionId, role: 'user', content: body.message }
  });

  // Call the model
  const response = await openai.responses.create({
    model: "gpt-5", // adjust to the model you have access to
    input: [
      { role: 'system', content: system },
      ...history,
      { role: 'user', content: body.message }
    ]
  });

  const reply = response.output_text ?? "";

  // Persist assistant reply
  await prisma.message.create({
    data: { userId: body.userId, companionId: body.companionId, role: 'assistant', content: reply }
  });

  res.json({ reply });
});

/**
 * Jobs: stubs for scheduled summaries.
 */
/**
 * Jobs: weekly summary for a single companion (protected).
 */
app.post('/api/jobs/weekly-recap', async (req, res) => {
  const authErr = requireJobToken(req, res);
  if (authErr) return; // requireJobToken wrote response
  const body = z.object({ companionId: z.string().min(1) }).parse(req.body);
  const companionId = body.companionId;

  const msgs = await prisma.message.findMany({
    where: { companionId },
    orderBy: { createdAt: 'asc' },
    take: 500
  });

  if (msgs.length < 20) return res.json({ ok: true, skipped: true, reason: 'Not enough messages yet.' });

  const rangeStart = msgs[0].createdAt;
  const rangeEnd = msgs[msgs.length - 1].createdAt;

  const recapSystem = `
Summarize the conversation into 1-2 short paragraphs focusing on:
- relationship context (PG-13)
- user preferences
- notable moments
Avoid sensitive personal data unless clearly provided and relevant.
`.trim();

  const recapResp = await openai.responses.create({
    model: "gpt-5",
    input: [
      { role: 'system', content: recapSystem },
      ...msgs.map(m => ({ role: m.role, content: m.content }))
    ]
  });

  const summary = recapResp.output_text ?? "";

  const recap = await prisma.recap.create({
    data: { companionId, summary, rangeStart, rangeEnd }
  });

  res.json({ ok: true, recap });
});

/**
 * Jobs: weekly recap for ALL companions (protected).
 * This is what the GitHub Action cron will call.
 */
app.post('/api/jobs/weekly-recap-all', async (req, res) => {
  const authErr = requireJobToken(req, res);
  if (authErr) return;

  const companions = await prisma.companion.findMany({ select: { id: true } });
  let created = 0, skipped = 0, failed = 0;

  for (const c of companions) {
    try {
      const msgs = await prisma.message.findMany({
        where: { companionId: c.id },
        orderBy: { createdAt: 'asc' },
        take: 500
      });
      if (msgs.length < 20) { skipped++; continue; }

      const rangeStart = msgs[0].createdAt;
      const rangeEnd = msgs[msgs.length - 1].createdAt;

      // Don't create duplicate recaps for same window (simple heuristic)
      const existing = await prisma.recap.findFirst({
        where: { companionId: c.id, rangeStart, rangeEnd }
      });
      if (existing) { skipped++; continue; }

      const recapSystem = `
Summarize the conversation into 1-2 short paragraphs focusing on:
- relationship context (PG-13)
- user preferences
- notable moments
Avoid sensitive personal data unless clearly provided and relevant.
`.trim();

      const recapResp = await openai.responses.create({
        model: "gpt-5",
        input: [
          { role: 'system', content: recapSystem },
          ...msgs.map(m => ({ role: m.role, content: m.content }))
        ]
      });

      const summary = recapResp.output_text ?? "";

      await prisma.recap.create({
        data: { companionId: c.id, summary, rangeStart, rangeEnd }
      });
      created++;
    } catch (e) {
      failed++;
    }
  }

  res.json({ ok: true, created, skipped, failed, total: companions.length });
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
