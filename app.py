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
model = None

if api_key:
    genai.configure(api_key=api_key)
    try:
        # Nom exact du modèle compatible avec la version 0.8.3+
        model = genai.GenerativeModel('gemini-1.5-flash')
        print("✅ Modèle gemini-1.5-flash chargé avec succès.")
    except Exception as e:
        print(f"❌ Erreur chargement modèle: {e}")
        model = None
else:
    print("⚠️ ATTENTION: Clé API GOOGLE_API_KEY manquante.")

# Prompt Système : Logique Pédagogique Avancée
SYSTEM_PROMPT = """
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
"""

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_input = data.get('message')
    history = data.get('history', [])

    if not user_input:
        return jsonify({"error": "Message vide"}), 400

    if not model:
        error_msg = "Erreur de configuration : La clé API Gemini n'est pas définie ou le modèle est indisponible."
        if not api_key:
            error_msg += " (Clé API manquante dans les variables d'environnement Render)"
        return jsonify({"response": error_msg}), 500

    try:
        # Démarrage d'une session de chat
        chat_session = model.start_chat(history=[])
        
        # Construction du contexte complet
        context_prompt = f"{SYSTEM_PROMPT}\n\n--- DÉBUT DE LA CONVERSATION ---\n"
        
        # Ajout de l'historique récent (les 6 derniers échanges)
        recent_history = history[-6:] 
        for msg in recent_history:
            role = "Utilisateur" if msg['sender'] == 'user' else "LearnIS"
            context_prompt += f"{role}: {msg['text']}\n"
        
        full_prompt = f"{context_prompt}\nUtilisateur: {user_input}\nLearnIS:"

        response = chat_session.send_message(full_prompt)
        ai_response = response.text

        return jsonify({"response": ai_response})

    except Exception as e:
        error_detail = str(e)
        print(f"❌ Erreur API Gemini: {error_detail}")
        
        # Gestion spécifique des erreurs de modèle
        if "404" in error_detail or "model" in error_detail.lower() or "not found" in error_detail.lower():
            return jsonify({
                "response": "Erreur de modèle : Le modèle spécifié est introuvable. Veuillez vérifier la configuration du serveur."
            }), 500
            
        return jsonify({"error": f"Erreur interne: {error_detail}"}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)