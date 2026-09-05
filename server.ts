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

// System prompt preserved exactly from original LearnIS implementation with pedagogical vocabulary tagging
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

ENRICHISSEMENT VOCABULAIRE & MOTS COMPLEXES :
- Dans chacune de tes réponses, identifie 2 à 4 mots, concepts ou termes techniques / académiques qui peuvent être complexes pour l'apprenant (par exemple : termes conceptuels, notions méthodologiques, mots de vocabulaire soutenu).
- Entoure OBLIGATOIREMENT ces mots de balises claires <term>mot ou expression</term> (exemple : "La <term>maïeutique</term> permet de formuler une <term>hypothèse</term>...").
- Ne modifie pas le mot à l'intérieur de la balise. L'apprenant pourra cliquer dessus pour voir une définition simplifiée adaptée à son niveau.

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

// Helper for resilient generation with retries and fallback models
async function generateSocraticResponse(ai: GoogleGenAI, fullPrompt: string): Promise<string> {
  const candidateModels = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: fullPrompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
        },
      });

      if (response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      console.warn(`[LearnIS] Modèle ${model} a échoué (${errMsg}), tentative avec le modèle suivant...`);
    }
  }

  throw lastError;
}

// Fallback adaptive dictionary for pedagogical and philosophical concepts
const ADAPTIVE_FALLBACK_DICTIONARY: Record<string, Record<'debutant' | 'intermediaire' | 'avance', { definition: string; example: string; synonym: string }>> = {
  'socratique': {
    debutant: {
      definition: "Une manière d'apprendre en se posant des questions au lieu d'écouter un cours magistral tout fait.",
      example: "C'est comme une enquête policière où le professeur te pose des énigmes pour que tu trouves toi-même le mystère.",
      synonym: "Par questions-réponses / dialogue"
    },
    intermediaire: {
      definition: "Méthode philosophique initiée par Socrate, fondée sur le dialogue et le questionnement pour faire émerger la vérité.",
      example: "Plutôt que d'affirmer 'la justice est ceci', le tuteur interroge les contradictions de son interlocuteur.",
      synonym: "Méthode interrogative / dialectique"
    },
    avance: {
      definition: "Approche philosophique et pédagogique aporétique où le questionnement rigoureux déconstruit les préjugés (doxa) pour accoucher des concepts.",
      example: "L'ironie socratique met en crise les certitudes non fondées afin de stimuler une investigation critique autonome.",
      synonym: "Investigation dialectique aporétique"
    }
  },
  'constructivisme': {
    debutant: {
      definition: "Une façon d'apprendre où l'on construit soi-même ses connaissances avec ses propres expériences.",
      example: "Comme assembler soi-même un château de Lego : on comprend mieux comment les pièces s'emboîtent en les manipulant !",
      synonym: "Apprentissage actif / par la pratique"
    },
    intermediaire: {
      definition: "Théorie de l'apprentissage selon laquelle l'élève élabore son savoir en reliant activement de nouvelles informations à ce qu'il sait déjà.",
      example: "Face à une énigme scientifique, l'élève émet une idée, la teste et ajuste sa compréhension.",
      synonym: "Construction cognitive active"
    },
    avance: {
      definition: "Paradigme épistémologique (Piaget, Vygotski) postulant que la connaissance n'est pas transmise passivement mais construite par assimilation et accommodation.",
      example: "L'apprenant reconfigure ses schèmes conceptuels préexistants lors d'un conflit sociocognitif.",
      synonym: "Genèse cognitive interactionniste"
    }
  },
  'maïeutique': {
    debutant: {
      definition: "L'art d'aider quelqu'un à trouver une bonne idée qu'il avait déjà au fond de sa tête sans le savoir.",
      example: "Comme un ami qui te pose la bonne question et soudain tu te dis : 'Mais oui, c'est évident !'",
      synonym: "Faire naître les idées"
    },
    intermediaire: {
      definition: "Technique de questionnement socratique visant à faire 'accoucher' l'esprit des vérités qu'il porte en lui de manière implicite.",
      example: "Dans le dialogue du Ménon, Socrate amène un jeune serviteur à démontrer un théorème de géométrie sans lui donner la formule.",
      synonym: "Accouchement des esprits"
    },
    avance: {
      definition: "Dispositif heuristique socratique procédant par questions ciblées pour extérioriser et formaliser des intuitions latentes.",
      example: "La maïeutique postule la réminiscence ou la capacité transcendantale de l'intellect à formuler le vrai par auto-examen.",
      synonym: "Élucidation conceptuelle maïeutique"
    }
  },
  'autonomie': {
    debutant: {
      definition: "La capacité de réfléchir et de faire des choses par soi-même sans avoir besoin qu'on te dise tout le temps quoi faire.",
      example: "Réussir à faire ses devoirs et comprendre ses erreurs sans attendre que quelqu'un te donne la solution.",
      synonym: "Indépendance / se débrouiller seul"
    },
    intermediaire: {
      definition: "Faculté d'agir et de penser selon ses propres règles de manière responsable et réfléchie.",
      example: "Être capable de planifier ses révisions et d'évaluer soi-même la qualité de son travail.",
      synonym: "Auto-détermination / libre arbitre"
    },
    avance: {
      definition: "Principe éthique et intellectuel (kantien) où le sujet se donne à lui-même ses propres lois guidées par la raison critique.",
      example: "L'émancipation intellectuelle s'oppose à l'hétéronomie des dogmes reçus sans examen rationnel.",
      synonym: "Auto-législation rationnelle"
    }
  },
  'savoir': {
    debutant: {
      definition: "L'ensemble des choses que l'on a apprises, comprises et que l'on peut réutiliser pour résoudre des problèmes.",
      example: "Savoir pourquoi le ciel est bleu ou savoir comment faire du vélo.",
      synonym: "Connaissance / bagage"
    },
    intermediaire: {
      definition: "Ensemble structuré de connaissances vérifiées, assimilées et mobilisables dans un domaine précis.",
      example: "La différence entre une simple rumeur et un savoir prouvé par des expériences scientifiques.",
      synonym: "Connaissance acquise / compétence"
    },
    avance: {
      definition: "Corpus épistémique validé intersubjectivement, distinct de la simple croyance ou de l'opinion par son exigence de justification.",
      example: "La dialectique entre savoir théorique (épistémê) et savoir-faire pratique (technê).",
      synonym: "Épistémè / corpus cognitif"
    }
  },
  'hypothèse': {
    debutant: {
      definition: "Une supposition ou une idée que l'on imagine pour essayer d'expliquer quelque chose, avant de vérifier si c'est vrai.",
      example: "Si la plante fane, mon hypothèse est qu'elle manque d'eau ; je l'arrose pour voir si c'est bien ça !",
      synonym: "Supposition / idée à tester"
    },
    intermediaire: {
      definition: "Proposition théorique provisoire formulée pour expliquer un phénomène et destinée à être confirmée ou réfutée par l'expérience.",
      example: "En physique, formuler l'hypothèse que la masse n'influe pas sur la vitesse de chute dans le vide.",
      synonym: "Conjecture scientifique"
    },
    avance: {
      definition: "Énoncé axiomatique ou heuristique provisoire intégré dans un système hypothético-déductif soumis à la falsification empirique.",
      example: "Selon Popper, une hypothèse scientifique doit être réfutable pour posséder une valeur heuristique.",
      synonym: "Conjecture falsifiable"
    }
  },
  'métacognition': {
    debutant: {
      definition: "Réfléchir à la façon dont ton propre cerveau apprend et réfléchit.",
      example: "Te demander : 'Quelle méthode m'aide le mieux à mémoriser cette poésie ? En la lisant ou en l'écoutant ?'",
      synonym: "Penser sur sa façon de penser"
    },
    intermediaire: {
      definition: "Capacité d'analyser, de surveiller et d'adapter ses propres stratégies de pensée et d'apprentissage.",
      example: "Se rendre compte au milieu d'un problème qu'on fait fausse route et décider de changer de méthode.",
      synonym: "Auto-régulation des apprentissages"
    },
    avance: {
      definition: "Conscience réflexive et contrôle exécutif de premier ordre exercés sur ses propres processus et représentations cognitives.",
      example: "L'évaluation critique de ses propres biais cognitifs lors d'un processus de décision stratégique.",
      synonym: "Monitorage cognitif réflexif"
    }
  }
};

// In-memory definition cache to minimize duplicate calls
const definitionCache = new Map<string, any>();

// Helper to normalize words for dictionary lookups
function normalizeWord(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics for lookup
    .replace(/[^\w\s-]/g, '')
    .trim();
}

const LEVEL_CONFIG: Record<string, { label: string; desc: string; fallbackKey: 'debutant' | 'intermediaire' | 'avance' }> = {
  debutant: {
    label: "Débutant (Primaire / Collège)",
    desc: "Vocabulaire simple, phrases courtes, analogies du quotidien, aucun jargon technique.",
    fallbackKey: 'debutant'
  },
  intermediaire: {
    label: "Intermédiaire (Lycée)",
    desc: "Définition équilibrée, claire, avec des exemples d'application et des explications précises.",
    fallbackKey: 'intermediaire'
  },
  avance: {
    label: "Avancé (Enseignement supérieur)",
    desc: "Définition conceptuelle rigoureuse, mise en perspective théorique, nuances méthodologiques.",
    fallbackKey: 'avance'
  }
};

// Definition endpoint adapting words to the learner's level
app.post('/api/define', async (req, res) => {
  const { word, context = '', level = 'debutant' } = req.body || {};

  if (!word || typeof word !== 'string' || !word.trim()) {
    return res.status(400).json({ error: 'Mot manquant' });
  }

  const cleanWord = word.trim();
  const selectedLevel = (['debutant', 'intermediaire', 'avance'].includes(level) ? level : 'debutant') as 'debutant' | 'intermediaire' | 'avance';
  const levelInfo = LEVEL_CONFIG[selectedLevel];
  const cacheKey = `${selectedLevel}:${cleanWord.toLowerCase()}`;

  if (definitionCache.has(cacheKey)) {
    return res.json(definitionCache.get(cacheKey));
  }

  // Check fallback dictionary
  const normalizedKey = normalizeWord(cleanWord);
  for (const [dictKey, entries] of Object.entries(ADAPTIVE_FALLBACK_DICTIONARY)) {
    if (normalizeWord(dictKey) === normalizedKey || normalizedKey.includes(normalizeWord(dictKey))) {
      const entry = entries[selectedLevel];
      const result = {
        word: cleanWord,
        level: selectedLevel,
        levelLabel: levelInfo.label,
        simplifiedDefinition: entry.definition,
        analogyOrExample: entry.example,
        simplerSynonym: entry.synonym,
        source: 'dictionary'
      };
      definitionCache.set(cacheKey, result);
      return res.json(result);
    }
  }

  // Dynamic Gemini generation
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    // If no key configured, generate a smart pedagogical fallback
    const fallbackResult = {
      word: cleanWord,
      level: selectedLevel,
      levelLabel: levelInfo.label,
      simplifiedDefinition: `Notion clé utilisée dans le raisonnement : "${cleanWord}" désigne un concept important pour approfondir la réflexion.`,
      analogyOrExample: `Dans notre échange, ce terme sert à préciser l'idée suivante : "${context || cleanWord}".`,
      simplerSynonym: cleanWord,
      source: 'fallback'
    };
    return res.json(fallbackResult);
  }

  try {
    const ai = getAiClient();
    const prompt = `Tu es un pédagogue expert en vulgarisation linguistique et en apprentissage constructiviste.
L'élève a cliqué sur le mot complexe ou conceptuel : "${cleanWord}".
Contexte dans la réponse de LearnIS : "${context || cleanWord}".
Niveau d'apprentissage actuel de l'élève : "${levelInfo.label}".
Consigne pour ce niveau : ${levelInfo.desc}

Donne une explication pédagogique bienveillante et adaptée.
Réponds UNIQUEMENT en JSON avec la structure exacte suivante :
{
  "simplifiedDefinition": "Définition courte et percutante (1 à 2 phrases) adaptée au niveau",
  "analogyOrExample": "Un exemple concret ou une analogie visuelle facile à retenir",
  "simplerSynonym": "Un ou deux synonymes plus simples et courants"
}`;

    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            systemInstruction: "Tu es un tuteur pédagogique bienveillant. Réponds exclusivement en JSON strict.",
          }
        });

        if (response.text) {
          const parsed = JSON.parse(response.text.trim());
          const output = {
            word: cleanWord,
            level: selectedLevel,
            levelLabel: levelInfo.label,
            simplifiedDefinition: parsed.simplifiedDefinition || `Définition simplifiée de ${cleanWord}.`,
            analogyOrExample: parsed.analogyOrExample || `Exemple : ${cleanWord} dans notre discussion.`,
            simplerSynonym: parsed.simplerSynonym || cleanWord,
            source: 'gemini'
          };
          definitionCache.set(cacheKey, output);
          return res.json(output);
        }
      } catch (e) {
        lastError = e;
      }
    }

    throw lastError || new Error("Échec de génération");
  } catch (error) {
    console.warn(`[LearnIS] Échec de la définition IA pour "${cleanWord}":`, error);
    // Graceful fallback if Gemini API had transient errors
    const safeFallback = {
      word: cleanWord,
      level: selectedLevel,
      levelLabel: levelInfo.label,
      simplifiedDefinition: `Terme clé : "${cleanWord}" est une notion importante abordée dans notre dialogue pour structurer vos connaissances.`,
      analogyOrExample: `Utilisé dans le contexte : "${context || cleanWord}".`,
      simplerSynonym: cleanWord,
      source: 'fallback'
    };
    definitionCache.set(cacheKey, safeFallback);
    return res.json(safeFallback);
  }
});

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

    const aiResponse = await generateSocraticResponse(ai, fullPrompt);
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur LearnIS démarré sur http://0.0.0.0:${PORT}`);
});
