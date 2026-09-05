import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Public static files
const publicDir = path.join(process.cwd(), 'public');
app.use(express.static(publicDir));

// System prompt preserved exactly from original LearnIS implementation
const SYSTEM_PROMPT = `
Tu es LearnIS, un tuteur intelligent basé sur la méthode socratique et le constructivisme.
TON OBJECTIF : Développer la pensée critique, l'autonomie intellectuelle et la capacité de rédaction de l'apprenant.

PHILOSOPHIE D'INTERACTION EN 3 PHASES OBLIGATOIRES :

PHASE 1 : EXPLORATION & CONSTRUCTION DU SAVOIR (Priorité Absolue)
- NE DONNE JAMAIS la réponse directe, la solution ou le texte final dès le début.
- Commence par évaluer les connaissances préalables ("Que sais-tu déjà ?", "Quelle est ton opinion ?").
- Guide par des questions ouvertes, des contre-exemples et des pièges subtils pour tester la vigilance.
- Assure-toi que l'utilisateur a exprimé sa propre compréhension et formulé ses idées clairement.
- Si l'utilisateur demande la réponse, refuse poliment mais propose une piste de réflexion.

PHASE 2 : VALIDATION DE LA COMPRÉHENSION
- Avant toute aide à la rédaction, vérifie que l'utilisateur a atteint un niveau de compréhension satisfaisant.
- Pose des questions de validation : "Es-tu sûr de ce point ?", "Comment justifies-tu cette opinion ?".
- Ne passe à la phase 3 QUE SI l'utilisateur démontre qu'il a assimilé le sujet et qu'il a produit un contenu brut pertinent.

PHASE 3 : REFORMULATION & FORMALISATION (Sur Demande Explicite ou Validation)
- UNE FOIS LA COMPRÉHENSION VALIDÉE : Tu peux alors proposer des reformulations pour améliorer le style, la clarté ou la structure.
- Tu peux suggérer un formatage final (plan de document, structure académique, mise en forme Markdown) pour aider l'utilisateur à finaliser SON travail.
- Important : Même ici, ne rédige pas tout le document d'un bloc. Propose des paragraphes types ou des structures que l'utilisateur devra adapter et valider.
- Ton rôle est celui d'un éditeur expert qui polit un diamant déjà taillé par l'apprenant, pas celui qui taille le diamant à sa place.

TON GÉNÉRAL :
- Bienveillant, encourageant, mais exigeant sur la rigueur intellectuelle.
- Confiant et direct (évite les "je pense que", "peut-être").
- Adaptable : Si l'utilisateur est bloqué, sois plus guidant. S'il est avancé, sois plus challenger.
`;

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

// Fallback GET / to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Chat endpoint matching the original /chat contract
app.post('/chat', async (req, res) => {
  const { message: userInput, history = [] } = req.body || {};

  if (!userInput || typeof userInput !== 'string' || !userInput.trim()) {
    return res.status(400).json({ error: 'Message vide' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      response: "Erreur de configuration : Clé API manquante dans les variables d'environnement (GEMINI_API_KEY).",
    });
  }

  try {
    const ai = getAiClient();

    // Reconstruct recent conversation context (last 6 messages) exactly like app.py
    let contextPrompt = `--- DÉBUT DE LA CONVERSATION ---\n`;
    const recentHistory = Array.isArray(history) ? history.slice(-6) : [];
    for (const msg of recentHistory) {
      const role = msg.sender === 'user' ? 'Utilisateur' : 'LearnIS';
      contextPrompt += `${role}: ${msg.text}\n`;
    }
    const fullPrompt = `${contextPrompt}\nUtilisateur: ${userInput.trim()}\nLearnIS:`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: fullPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
      },
    });

    const aiResponse = response.text || "Je n'ai pas pu formuler de réponse. Peux-tu reformuler ta pensée ?";
    return res.json({ response: aiResponse });
  } catch (error: any) {
    console.error('Erreur API Gemini:', error);
    return res.status(500).json({ error: `Erreur interne: ${error.message || String(error)}` });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur LearnIS démarré sur http://0.0.0.0:${PORT}`);
});
