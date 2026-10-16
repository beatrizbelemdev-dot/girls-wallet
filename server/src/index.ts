import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import multer from 'multer';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { PDFParse } from 'pdf-parse';
import { parseStatementText } from './parser.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const maxFileSize = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize, files: 1 },
});

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',').map((value) => value.trim()) ?? false }));
app.use(express.json({ limit: '32kb' }));

function adminApp() {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.GOOGLE_APPLICATION_CREDENTIALS) return undefined;
  return getApps()[0] ?? initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

async function verifiedUid(authorization: string | undefined): Promise<string> {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw Object.assign(new Error('Autenticação necessária.'), { status: 401 });
  const appInstance = adminApp();
  if (!appInstance) throw Object.assign(new Error('Firebase Admin não configurado para operações push.'), { status: 503 });
  try {
    const decoded = await getAuth(appInstance).verifyIdToken(token);
    return decoded.uid;
  } catch {
    throw Object.assign(new Error('Token inválido ou expirado. Entre novamente.'), { status: 401 });
  }
}

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'girls-wallet-api' });
});

app.post('/api/statements/analyze', upload.single('file'), async (request, response, next) => {
  try {
    await verifiedUid(request.header('authorization'));
    const file = request.file;
    if (!file) {
      response.status(400).json({ message: 'Selecione um arquivo PDF para análise.' });
      return;
    }
    if (file.mimetype !== 'application/pdf' && !file.originalname.toLocaleLowerCase().endsWith('.pdf')) {
      response.status(415).json({ message: 'Formato não suportado. Selecione um arquivo PDF.' });
      return;
    }
    const period = request.body.period;
    if (typeof period !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      response.status(400).json({ message: 'Informe um período válido no formato AAAA-MM.' });
      return;
    }
    let allowedCategories: string[] = [];
    try {
      const parsedCategories: unknown = JSON.parse(String(request.body.categories ?? '[]'));
      if (Array.isArray(parsedCategories) && parsedCategories.every((item) => typeof item === 'string')) {
        allowedCategories = parsedCategories;
      }
    } catch {
      response.status(400).json({ message: 'A lista de categorias enviada é inválida.' });
      return;
    }

    const parser = new PDFParse({ data: file.buffer });
    let text: string;
    try {
      const parsed = await parser.getText();
      text = parsed.text;
    } finally {
      await parser.destroy();
    }
    const result = parseStatementText(text, period, allowedCategories);
    response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Nenhuma compra foi reconhecida')) {
      response.status(422).json({ message: error.message });
      return;
    }
    if (error instanceof Error && error.message.includes('período inválido')) {
      response.status(400).json({ message: error.message });
      return;
    }
    next(error);
  }
});

app.post('/api/push/register', async (request, response, next) => {
  try {
    const uid = await verifiedUid(request.header('authorization'));
    const token = request.body?.token;
    const platform = request.body?.platform;
    if (typeof token !== 'string' || token.length < 20 || !['ios', 'android'].includes(platform)) {
      response.status(400).json({ message: 'Token de dispositivo ou plataforma inválidos.' });
      return;
    }
    const appInstance = adminApp();
    if (!appInstance) {
      response.status(503).json({ message: 'Firebase Admin não configurado.' });
      return;
    }
    const tokenId = createHash('sha256').update(token).digest('hex');
    await getFirestore(appInstance).doc(`users/${uid}/devices/${tokenId}`).set({
      token,
      platform,
      updatedAt: Date.now(),
    });
    response.status(201).json({ registered: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/push/budget-alert', async (request, response, next) => {
  try {
    const uid = await verifiedUid(request.header('authorization'));
    const { category, spent, limit } = request.body ?? {};
    if (typeof category !== 'string' || !category.trim() || !Number.isFinite(spent) || !Number.isFinite(limit) || spent <= limit || limit < 0) {
      response.status(400).json({ message: 'Dados de orçamento inválidos ou limite ainda não ultrapassado.' });
      return;
    }
    const appInstance = adminApp();
    if (!appInstance) {
      response.status(503).json({ message: 'Firebase Admin não configurado para enviar notificações.' });
      return;
    }
    const devices = await getFirestore(appInstance).collection(`users/${uid}/devices`).get();
    const tokens = devices.docs.map((device) => device.data().token).filter((token): token is string => typeof token === 'string');
    if (!tokens.length) {
      response.status(409).json({ message: 'Nenhum dispositivo registrado para notificações.' });
      return;
    }
    const result = await getMessaging(appInstance).sendEachForMulticast({
      tokens,
      notification: {
        title: `Limite de ${category.trim()} ultrapassado`,
        body: `Gastos: R$ ${Number(spent).toFixed(2)} · limite: R$ ${Number(limit).toFixed(2)}.`,
      },
      data: { category: category.trim(), spent: String(spent), limit: String(limit) },
    });
    response.json({ sent: result.successCount, failed: result.failureCount });
  } catch (error) {
    next(error);
  }
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      message: error.code === 'LIMIT_FILE_SIZE' ? 'A fatura excede o limite de 10 MB.' : 'Não foi possível receber o arquivo.',
    });
    return;
  }
  const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
    ? error.status
    : 500;
  response.status(status).json({ message: status === 500 ? 'Erro interno ao processar a solicitação.' : (error instanceof Error ? error.message : 'Solicitação inválida.') });
};
app.use(errorHandler);

createServer(app).listen(port, () => {
  console.log(`Girls Wallet API listening on port ${port}`);
});
