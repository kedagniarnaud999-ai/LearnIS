import os
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev_key")

api_key = os.getenv("GOOGLE_API_KEY")
model = None

if api_key:
    genai.configure(api_key=api_key)
    try:
        # Nom exact du modèle pour la version 0.8.4+
        model = genai.GenerativeModel('gemini-1.5-flash')
        print("✅ Modèle gemini-1.5-flash chargé avec succès.")
    except Exception as e:
        print(f"❌ Erreur chargement modèle: {e}")
else:
    print("⚠️ Clé API manquante")

SYSTEM_PROMPT = """
Tu es LearnIS, un tuteur intelligent (méthode socratique).
RÈGLES :
1. NE DONNE JAMAIS la réponse directe.
2. Commence par demander ce que l'élève sait déjà.
3. Guide par questions, pièges et contre-exemples.
4. Phase finale UNIQUEMENT : Si l'élève a tout compris, propose une reformulation ou un plan, mais ne rédige pas tout le devoir.
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
        return jsonify({"response": "Erreur Serveur : Modèle IA non initialisé. Vérifiez la clé API et le déploiement."}), 500

    try:
        chat_session = model.start_chat(history=[])
        
        # Construction du prompt contextuel
        context = f"{SYSTEM_PROMPT}\n\nHistorique :\n"
        for msg in history[-5:]:
            role = "Élève" if msg['sender'] == 'user' else "Tuteur"
            context += f"{role}: {msg['text']}\n"
        
        full_prompt = f"{context}\nÉlève: {user_input}\nTuteur:"

        response = chat_session.send_message(full_prompt)
        return jsonify({"response": response.text})

    except Exception as e:
        error_msg = str(e)
        if "404" in error_msg or "not found" in error_msg.lower():
            return jsonify({"response": "Erreur de modèle : Le nom 'gemini-1.5-flash' est introuvable. Cela signifie que la librairie google-generativeai sur le serveur est trop ancienne. Veuillez mettre à jour requirements.txt vers la version 0.8.4."}), 500
        return jsonify({"response": f"Erreur technique: {error_msg}"}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)