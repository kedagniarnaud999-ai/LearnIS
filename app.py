import os
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "cle_secrete_par_defaut_change_en_prod")

# Configuration de l'API Google Gemini
api_key = os.getenv("GOOGLE_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
    # Utilisation du modèle flash 1.5 (rapide, gratuit et compatible)
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    print("⚠️ ATTENTION: Clé API GOOGLE_API_KEY non trouvée dans les variables d'environnement.")
    model = None

# Prompt Système : L'âme pédagogique de LearnIS
SYSTEM_PROMPT = """
Tu es LearnIS, un tuteur intelligent basé sur la méthode socratique et le constructivisme.
TON OBJECTIF PRINCIPAL : Développer la pensée critique et l'autonomie de l'apprenant. NE DONNE JAMAIS LA RÉPONSE DIRECTE.

RÈGLES STRICTES À SUIVRE :
1. DIAGNOSTIC : Commence toujours par demander à l'élève ce qu'il sait déjà ou comment il perçoit le sujet.
2. GUIDAGE PROGRESSIF : Pose des questions ouvertes pour le faire réfléchir. Utilise la technique du "scaffolding" (aide progressive).
3. INTERDICTION DE RÉDIGER : Ne rédige jamais le devoir, l'exercice ou la solution finale à sa place. Propose des plans ou des structures, mais laisse l'élève remplir le contenu.
4. PIÈGES PÉDAGOGIQUES : Si l'élève semble avoir compris, teste-le avec un contre-exemple subtil ou une question piège pour vérifier sa vigilance.
5. VALIDATION : Une fois que l'élève a trouvé la réponse par lui-même, félicite-le et résume brièvement la notion acquise.
6. TON : Bienveillant, encourageant, mais ferme sur la méthode. Sois direct et confiant (évite les "je pense que", "peut-être").

Si l'élève insiste pour avoir la réponse : "Je comprends ta frustration, mais mon rôle est de t'aider à construire ton propre savoir. Si je te donne la réponse, tu n'apprendras rien. Essayons plutôt de regarder..."
"""

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    user_input = request.json.get('message')
    history = request.json.get('history', [])

    if not user_input:
        return jsonify({"error": "Message vide"}), 400

    if not model:
        return jsonify({"response": "Erreur de configuration : La clé API Gemini n'est pas définie sur le serveur. Veuillez contacter l'administrateur."}), 500

    try:
        # Construction du contexte de conversation pour Gemini
        # On injecte le prompt système au début de l'historique simulé
        chat_session = model.start_chat(history=[])
        
        # On envoie le prompt système + l'historique récent + le message actuel
        # Note: L'API Gemini gère l'historique différemment, on va simplifier en envoyant un bloc contextuel
        context_prompt = f"{SYSTEM_PROMPT}\n\nHistorique de la conversation :\n"
        
        # Ajouter les 5 derniers échanges pour le contexte
        recent_history = history[-5:] 
        for msg in recent_history:
            role = "Utilisateur" if msg['sender'] == 'user' else "LearnIS"
            context_prompt += f"{role}: {msg['text']}\n"
        
        full_prompt = f"{context_prompt}\nUtilisateur: {user_input}\nLearnIS:"

        response = chat_session.send_message(full_prompt)
        ai_response = response.text

        return jsonify({"response": ai_response})

    except Exception as e:
        print(f"Erreur API Gemini: {str(e)}")
        return jsonify({"error": f"Erreur interne: {str(e)}"}), 500

if __name__ == '__main__':
    # Récupérer le port depuis l'environnement (nécessaire pour Render)
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)