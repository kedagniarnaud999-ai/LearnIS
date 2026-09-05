import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Public static files
const publicDir = path.join(process.cwd(), 'public');
app.use(express.static(publicDir));

// Base system prompt preserved and enriched with LearnIS pedagogical framework
const BASE_SYSTEM_PROMPT = `
Tu es LearnIS, un tuteur intelligent basé sur la méthode socratique, la maïeutique et le constructivisme.
TON OBJECTIF MAJEUR : Développer la pensée critique, l'autonomie intellectuelle et la capacité de réflexion et de synthèse de l'apprenant.

RÈGLES D'OR PÉDAGOGIQUES ABSOLUES :

1. CONCISION STRICTE (NE SOIS JAMAIS TROP LONG) :
- ÉVITE absolument les longs monologues, les cours magistraux ou les pavés de texte rébarbatifs.
- Réponds de façon concise, vive, aérée et stimulante (2 à 3 paragraphes courts maximum).
- Ne pose JAMAIS plus de 1 ou 2 questions ciblées et percutantes à la fois pour ne pas noyer l'apprenant sous trop d'informations.

2. DÉTECTION IMMÉDIATE DE LA COMPRÉHENSION & INVITATION À CONCLURE / REFORMULER :
- Dès que tu sens ou perçois que l'apprenant a compris l'idée clé ou a eu la bonne intuition (MÊME si c'est dès sa toute première réponse ou après la première question) :
  * ARRÊTE immédiatement de poser d'autres questions d'investigation ou de tergiverser.
  * Valide et félicite chaleureusement sa bonne déduction ("Bravo, tu as mis le doigt exactement dessus !").
  * DEMANDE-LUI DIRECTEMENT de CONCLURE, de REFORMULER avec ses propres mots, ou de partager quelle LEÇON / RÈGLE GÉNÉRALE il retient de cette réflexion ("Si tu devais résumer cette règle ou cette leçon essentielle avec tes propres mots pour l'expliquer à un ami, comment la formulerais-tu ?").
  * La reformulation active est l'étape reine du constructivisme pour sceller définitivement le savoir.

3. SUGGESTION DE PISTES D'APPROFONDISSEMENT DANS LE MÊME SENS :
- Pour ouvrir l'horizon et attiser la curiosité, suggère à la fin 2 ou 3 pistes passionnantes à explorer dans le même sens (par exemple sous la forme « 💡 Pistes à éclairer dans le même sens : 1... 2... 3... »).

4. ANALYSE ET UTILISATION DES IMAGES / ILLUSTRATIONS :
- Si l'apprenant te fournit une image (schéma, problème manuscrit, photo d'exercice, graphique, plante ou objet du quotidien) :
  * Observe méticuleusement chaque détail de l'image.
  * Appuie ton questionnement socratique sur ce qui est visible dans l'image ("Que remarques-tu sur le triangle tracé à gauche ?", "Sur ta photo, observe bien la tige...").
  * Ne donne pas la réponse directe visible sur la photo, mais amène l'élève à l'identifier par lui-même.
- Tu peux également proposer de petits schémas textuels clairs ou des représentations visuelles simples (diagrammes fléchés, tableaux) si cela aide l'apprenant à se représenter mentalement le concept.

5. PROGRESSION DU DIALOGUE :
- PHASE 1 : Questionner le point de départ et faire émerger les hypothèses de l'élève sans donner la solution.
- PHASE 2 : Dès que l'élève a compris, demander la conclusion / reformulation / leçon retenue.
- PHASE 3 : Proposer les pistes d'approfondissement dans le même sens.

TON GÉNÉRAL :
- Bienveillant, direct, valorisant et dynamique.
- Évite les hésitations ("peut-être", "je crois"). Sois clair et stimulant.
`;

interface EducationalContext {
  level?: string; // 'primaire' | 'college' | 'lycee' | 'superieur' | 'adulte'
  environment?: string; // 'afrique' | 'universel' | 'academique'
  tone?: string; // 'bienveillant' | 'equilibre' | 'challenge'
  learnerName?: string;
}

function buildSystemPrompt(context?: EducationalContext): string {
  let extra = '';

  const learnerName = context?.learnerName?.trim();
  if (learnerName) {
    extra += `\n- Nom de l'apprenant : "${learnerName}". Salue-le ou adresse-toi à lui avec bienveillance et respect.`;
  }

  // Niveau d'études et de langue adaptatif
  const level = context?.level || 'college';
  if (level === 'primaire') {
    extra += `\n- NIVEAU D'ÉTUDES : Primaire / Enfant / Débutant absolu (7 à 11 ans).
  * Vocabulaire très simple, familier et chaleureux, sans termes techniques ardus.
  * Phrases courtes et concrètes.
  * Utilise des images visuelles simples et encourage vivement chaque réflexion.`;
  } else if (level === 'college') {
    extra += `\n- NIVEAU D'ÉTUDES : Collège / Premier cycle secondaire (11 à 15 ans).
  * Langage clair et direct, sans jargon abstrait non expliqué.
  * Découpe méthodique des étapes de raisonnement.
  * Vérifie la compréhension des notions de base avant d'avancer.`;
  } else if (level === 'lycee') {
    extra += `\n- NIVEAU D'ÉTUDES : Lycée / Second cycle secondaire (15 à 18 ans).
  * Rigueur conceptuelle, esprit critique, argumentation structurée et vocabulaire précis.
  * Pousse à définir les termes et à justifier logiquement chaque affirmation.`;
  } else if (level === 'superieur') {
    extra += `\n- NIVEAU D'ÉTUDES : Enseignement Supérieur / Université / Recherche.
  * Vocabulaire académique et scientifique rigoureux.
  * Problématisation avancée, analyse épistémologique et nuance dans les raisonnements.`;
  } else if (level === 'adulte') {
    extra += `\n- NIVEAU D'ÉTUDES : Adulte / Formation continue / Autodidacte.
  * Approche pragmatique, orientée vers les applications concrètes et professionnelles.
  * Ton collaboratif, valorisant le vécu et l'expérience de l'apprenant.`;
  }

  // Environnement et réalités socio-culturelles
  const env = context?.environment || 'afrique';
  if (env === 'afrique') {
    extra += `\n- CONTEXTE & RÉALITÉS SOCIO-CULTURELLES (Afrique subsaharienne & Francophonie locale) :
  * CRUCIAL : Ancre systématiquement tes exemples, métaphores et analogies dans le quotidien et l'environnement familier de l'Afrique francophone (marchés populaires vivants, artisanat, agriculture locale comme le manioc, l'igname, le maïs ou le mil, transports familiers comme taxis-motos/zemidjans/sotramas/gbakas, vie communautaire et entraide solidaire, faune et climat sahélien/tropical, monnaies locales en FCFA).
  * ÉVITE FORMELLEMENT les exemples euro-centrés ou inadaptés aux réalités locales (pas de métaphores sur la neige, le métro parisien, les euros, ou des institutions occidentales étrangères).
  * Respecte les valeurs culturelles : politesse, sagesse des proverbes, respect de l'effort et solidarité.`;
  } else if (env === 'universel') {
    extra += `\n- CONTEXTE UNIVERSEL :
  * Privilégie des exemples intemporels basés sur la nature, le corps humain, les outils simples et la vie quotidienne universelle.`;
  } else if (env === 'academique') {
    extra += `\n- CONTEXTE ACADÉMIQUE FORMEL :
  * Emploie les normes classiques des programmes scolaires francophones avec définitions formelles.`;
  }

  // Posture pédagogique
  const tone = context?.tone || 'equilibre';
  if (tone === 'bienveillant') {
    extra += `\n- POSTURE : Très douce, rassurante et pas-à-pas. Guide patiemment chaque étape.`;
  } else if (tone === 'challenge') {
    extra += `\n- POSTURE : Stimulante et exigeante. Challenge les présupposés, soumets des contre-exemples pour pousser l'apprenant à argumenter solidement.`;
  } else {
    extra += `\n- POSTURE : Équilibrée, maïeutique socratique classique (questionne, écoute, guide).`;
  }

  return `${BASE_SYSTEM_PROMPT.trim()}\n\n--- DIRECTIVES D'ADAPTATION AU CONTEXTE ÉDUCATIF ---${extra}\n`;
}

// Lazy initialization of Gemini client to prevent crashing if environment variable is not immediately present
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Clé API manquante dans les variables d'environnement (GEMINI_API_KEY).");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

interface ImagePayload {
  data: string;
  mimeType: string;
}

// Helper for resilient generation with retries, fallback models and multimodal image support
async function generateSocraticResponse(
  ai: GoogleGenAI,
  fullPrompt: string,
  systemInstruction: string,
  image?: ImagePayload | null
): Promise<string> {
  // gemini-3.1-flash-lite has optimal quota availability and fast response times
  const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
  let lastError: any = null;

  // Clean base64 string if client sent a data-URL header
  let cleanImageData = image?.data;
  if (cleanImageData && cleanImageData.includes('base64,')) {
    cleanImageData = cleanImageData.split('base64,')[1];
  }

  const contents: any = cleanImageData
    ? [
        {
          role: 'user',
          parts: [
            { text: fullPrompt },
            {
              inlineData: {
                data: cleanImageData,
                mimeType: image?.mimeType || 'image/jpeg',
              },
            },
          ],
        },
      ]
    : fullPrompt;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
        },
      });

      if (response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      console.log(`[LearnIS] Info: Modèle ${model} indisponible (${errMsg.slice(0, 100)}...), bascule sur le modèle alternatif...`);
    }
  }

  throw lastError;
}

// Fallback GET / to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Google OAuth URL generation endpoint
app.get('/api/auth/google/url', (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID;
  const devUrl = 'https://ais-dev-4qlgk5dq77b37oviwxoulr-128669897305.europe-west1.run.app';
  const sharedUrl = 'https://ais-pre-4qlgk5dq77b37oviwxoulr-128669897305.europe-west1.run.app';
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${baseUrl}/auth/callback`;

  if (!googleClientId) {
    return res.json({
      configured: false,
      url: null,
      redirectUri,
      devCallbackUrl: `${devUrl}/auth/callback`,
      sharedCallbackUrl: `${sharedUrl}/auth/callback`,
      defaultUserEmail: 'kedagniarnaud999@gmail.com'
    });
  }

  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account'
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return res.json({
    configured: true,
    url: authUrl,
    redirectUri,
    devCallbackUrl: `${devUrl}/auth/callback`,
    sharedCallbackUrl: `${sharedUrl}/auth/callback`,
    defaultUserEmail: 'kedagniarnaud999@gmail.com'
  });
});

// Google OAuth Callback handler (Iframe / Popup compatible)
app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error || !code) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>Connexion Google</title></head>
        <body style="font-family: system-ui, sans-serif; text-align: center; padding: 40px; color: #1e293b; background: #f8fafc;">
          <h3 style="color: #dc2626;">Connexion Google interrompue</h3>
          <p style="font-size: 14px; color: #64748b;">${error ? `Détail : ${error}` : 'Aucun code d\'autorisation reçu.'}</p>
          <p style="font-size: 12px; color: #94a3b8;">Cette fenêtre va se fermer...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${error || 'canceled'}' }, '*');
              setTimeout(() => window.close(), 1500);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET;
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${baseUrl}/auth/callback`;

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleClientId || '',
        client_secret: googleClientSecret || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Erreur échange jeton Google:', tokenData);
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><title>Erreur d'authentification</title></head>
          <body style="font-family: system-ui, sans-serif; text-align: center; padding: 40px; color: #1e293b; background: #f8fafc;">
            <h3 style="color: #dc2626;">Échec de la validation Google</h3>
            <p style="font-size: 14px; color: #64748b;">${tokenData.error_description || tokenData.error || 'Erreur lors de l\'échange de jeton avec Google'}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: 'Token exchange failed' }, '*');
                setTimeout(() => window.close(), 2500);
              }
            </script>
          </body>
        </html>
      `);
    }

    // Récupération des informations du profil utilisateur depuis Google UserInfo
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userInfo = await userInfoResponse.json();

    const userData = {
      name: userInfo.name || userInfo.given_name || 'Utilisateur Google',
      email: userInfo.email || '',
      picture: userInfo.picture || '',
      sub: userInfo.sub || '',
      provider: 'google'
    };

    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>Connexion Google réussie</title></head>
        <body style="font-family: system-ui, sans-serif; text-align: center; padding: 40px; color: #1e293b; background: #f8fafc;">
          <div style="max-width: 400px; margin: 40px auto; background: white; padding: 28px; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
            <div style="width: 52px; height: 52px; background: #ecfdf5; color: #059669; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 26px;">✓</div>
            <h3 style="margin: 0 0 8px; color: #0f172a; font-size: 18px;">Connexion réussie !</h3>
            <p style="margin: 0 0 16px; color: #475569; font-size: 14px;">Bienvenue sur LearnIS, <strong>${userData.name}</strong></p>
            <p style="margin: 0; color: #94a3b8; font-size: 12px;">Cette fenêtre va se fermer automatiquement...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_AUTH_SUCCESS',
                provider: 'google',
                user: ${JSON.stringify(userData)}
              }, '*');
              setTimeout(() => window.close(), 800);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('Erreur interne OAuth Google:', err);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>Erreur</title></head>
        <body style="font-family: system-ui, sans-serif; text-align: center; padding: 40px; color: #1e293b;">
          <h3>Erreur interne</h3>
          <p>${err?.message}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${err?.message}' }, '*');
              setTimeout(() => window.close(), 2000);
            }
          </script>
        </body>
      </html>
    `);
  }
});

// Chat endpoint matching the /chat contract with educational context & multimodal support
app.post('/chat', async (req, res) => {
  const { message: userInput, history = [], context = {}, image = null } = req.body || {};

  if ((!userInput || typeof userInput !== 'string' || !userInput.trim()) && !image) {
    return res.status(400).json({ error: 'Message ou image requis' });
  }

  const promptText = (userInput && typeof userInput === 'string' && userInput.trim())
    ? userInput.trim()
    : "Que peux-tu observer et m'apprendre sur cette image ?";

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      response: "Erreur de configuration : Clé API manquante dans les variables d'environnement (GEMINI_API_KEY).",
    });
  }

  try {
    const ai = getAiClient();
    const systemInstruction = buildSystemPrompt(context);

    // Reconstruct recent conversation context (last 8 messages)
    let contextPrompt = `--- DÉBUT DE LA CONVERSATION ---\n`;
    const recentHistory = Array.isArray(history) ? history.slice(-8) : [];
    for (const msg of recentHistory) {
      const role = msg.sender === 'user' ? 'Utilisateur' : 'LearnIS';
      contextPrompt += `${role}: ${msg.text}\n`;
    }
    const fullPrompt = `${contextPrompt}\nUtilisateur: ${promptText}\nLearnIS:`;

    const aiResponse = await generateSocraticResponse(ai, fullPrompt, systemInstruction, image);
    return res.json({ response: aiResponse });
  } catch (error: any) {
    console.error('Erreur API Gemini:', error);
    const errMsg = error?.message || String(error);
    const isTransient =
      errMsg.includes('503') ||
      errMsg.includes('429') ||
      errMsg.includes('high demand') ||
      errMsg.includes('UNAVAILABLE') ||
      errMsg.includes('overloaded');

    if (isTransient) {
      return res.json({
        response:
          "Le service de tuteur IA connaît actuellement une forte demande temporaire sur les serveurs de Google. Merci de patienter quelques secondes puis de renvoyer votre message.",
      });
    }

    return res.status(500).json({
      error: "Une erreur temporaire est survenue lors de la communication avec l'IA. Veuillez réessayer dans un instant.",
    });
  }
});

// Transcription Endpoint using model gemini-3.5-transcribe
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audio, mimeType } = req.body || {};
    if (!audio) {
      return res.status(400).json({ error: "Fichier ou enregistrement audio manquant." });
    }

    const ai = getAiClient();
    let cleanAudio = audio;
    if (cleanAudio.includes('base64,')) {
      cleanAudio = cleanAudio.split('base64,')[1];
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/webm',
        data: cleanAudio,
      },
    };

    // Primary model: gemini-3.5-transcribe
    const candidateModels = ['gemini-3.5-transcribe', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    let lastError: any = null;
    let transcript = '';

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              audioPart,
              {
                text: 'Transcris fidèlement et exactement cet enregistrement audio en français. Ne retourne QUE la transcription textuelle exacte, sans guillemets, sans commentaires et sans ajouts.',
              },
            ],
          },
        });

        if (response.text) {
          transcript = response.text.trim();
          return res.json({ text: transcript, modelUsed: model });
        }
      } catch (err: any) {
        lastError = err;
        console.log(`[Transcribe] Modèle ${model} non disponible: ${err?.message?.slice(0, 100)}, essai modèle suivant...`);
      }
    }

    throw lastError || new Error("Échec de la transcription audio");
  } catch (error: any) {
    console.error('Erreur API Transcription:', error);
    return res.status(500).json({
      error: error?.message || "Erreur lors de la transcription avec gemini-3.5-transcribe.",
    });
  }
});

// Image Creation & Editing Endpoint using gemini-3.1-flash-image-preview
app.post('/api/images/generate', async (req, res) => {
  try {
    const { prompt, image, aspectRatio = '1:1' } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: "Un prompt textuel descriptif est nécessaire pour créer ou retoucher l'image." });
    }

    const ai = getAiClient();
    const parts: any[] = [];

    // If an existing image is provided, include it for editing/transformation
    if (image && image.data) {
      let cleanImageData = image.data;
      if (cleanImageData.includes('base64,')) {
        cleanImageData = cleanImageData.split('base64,')[1];
      }
      parts.push({
        inlineData: {
          data: cleanImageData,
          mimeType: image.mimeType || 'image/png',
        },
      });
    }

    parts.push({ text: prompt.trim() });

    // Mandated primary model: gemini-3.1-flash-image-preview
    const candidateModels = [
      'gemini-3.1-flash-image-preview',
      'gemini-3.1-flash-image',
      'gemini-3.1-flash-lite-image',
    ];

    let lastError: any = null;
    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio || '1:1',
            },
          },
        });

        let imageUrl: string | null = null;
        let description = '';

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          } else if (part.text) {
            description += part.text;
          }
        }

        if (imageUrl) {
          return res.json({
            imageUrl,
            description: description.trim(),
            modelUsed: model,
          });
        }
      } catch (err: any) {
        lastError = err;
        console.log(`[ImageGen] Modèle ${model} indisponible: ${err?.message?.slice(0, 100)}, tentative suivant...`);
      }
    }

    throw lastError || new Error("Aucune image n'a pu être produite par le modèle.");
  } catch (error: any) {
    console.error('Erreur API Création/Retouche Image:', error);
    return res.status(500).json({
      error: error?.message || "Erreur lors de la génération ou retouche de l'image.",
    });
  }
});

// Create shared HTTP server for Express and WebSocket
const server = http.createServer(app);

// WebSocket Server for Voice Conversations using gemini-3.1-flash-live-preview (Live API)
const wss = new WebSocketServer({ server, path: '/api/live' });

wss.on('connection', async (clientWs: WebSocket) => {
  console.log('[LiveAPI] Nouveau client connecté au flux vocal en direct');
  let liveSession: any = null;

  try {
    const ai = getAiClient();
    liveSession = await ai.live.connect({
      model: 'gemini-3.1-flash-live-preview',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: `Tu es LearnIS, un tuteur socratique intelligent et chaleureux qui dialogue en direct à la voix.
RÈGLES EN DIRECT :
- Sois bref, vivant et concis (1 à 2 phrases courtes maximum par intervention).
- Parle un français naturel, clair et stimulant.
- Ne donne pas la réponse directe : pose une question brève pour faire réfléchir l'apprenant.
- Si l'élève a compris, valide avec enthousiasme et demande-lui de reformuler sa conclusion.`,
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          if (clientWs.readyState !== WebSocket.OPEN) return;

          // Model spoken audio chunk (PCM 24kHz)
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio) {
            clientWs.send(JSON.stringify({ type: 'audio', audio }));
          }

          // Interruption event (when learner speaks over model)
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ type: 'interrupted' }));
          }

          // Transcribed text from model turn if available
          const textPart = message.serverContent?.modelTurn?.parts?.find((p) => p.text);
          if (textPart?.text) {
            clientWs.send(JSON.stringify({ type: 'text', text: textPart.text }));
          }
        },
        onclose: () => {
          console.log('[LiveAPI] Session Gemini Live fermée');
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'closed' }));
          }
        },
        onerror: (err: any) => {
          console.error('[LiveAPI] Erreur session Live:', err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'error', message: err?.message || 'Erreur Live API' }));
          }
        },
      },
    });

    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'ready', model: 'gemini-3.1-flash-live-preview' }));
    }

    clientWs.on('message', (rawData: any) => {
      try {
        const payload = JSON.parse(rawData.toString());
        if (payload.audio && liveSession) {
          liveSession.sendRealtimeInput({
            audio: { data: payload.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (payload.text && liveSession) {
          liveSession.sendRealtimeInput({
            text: payload.text,
          });
        }
      } catch (e) {
        console.error('[LiveAPI] Erreur traitement message client:', e);
      }
    });

    clientWs.on('close', () => {
      console.log('[LiveAPI] Client déconnecté');
      if (liveSession) {
        try {
          liveSession.close();
        } catch (e) {}
      }
    });
  } catch (err: any) {
    console.error('[LiveAPI] Échec initialisation connect Live API:', err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: err?.message || 'Impossible d\'initialiser la session vocale Live',
        })
      );
      clientWs.close();
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur LearnIS démarré avec Express & Live API WebSocket sur http://0.0.0.0:${PORT}`);
});
