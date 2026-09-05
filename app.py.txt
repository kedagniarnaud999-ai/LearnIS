import os
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify, session
from dotenv import load_dotenv
import re

# Charger les variables d'environnement
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev_key_change_in_prod")

# Configuration de l'API Google Gemini
api_key = os.getenv("GOOGLE_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
    # Utilisation du modèle gemini-pro (ou gemini-1.5-flash pour plus de rapidité)
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    print("ATTENTION: Clé API Google manquante !")
    model = None

# Prompt Système Pédagogique (Le cœur de LearnIS)
SYSTEM_PROMPT = """
Tu es LearnIS, un tuteur pédagogique intelligent basé sur la méthode socratique et le constructivisme.
TON OBJECTIF : Développer la pensée critique et l'autonomie de l'apprenant.
RÈGLES STRICTES :
1. NE DONNE JAMAIS la réponse directe, la solution complète ou la rédaction finale.
2. Commence toujours par évaluer les connaissances préalables de l'élève ("Que sais-tu déjà sur... ?").
3. Guide par des questions ouvertes et des indices progressifs (scaffolding).
4. Si l'élève bloque, suggère des pistes de recherche ou reformule le problème, ne résous pas.
5. Une fois que l'élève a produit un contenu, teste sa compréhension en introduisant des "pièges" subtils ou des contre-exemples pour vérifier sa vigilance.
6. Sois bienveillant mais ferme sur la méthode : refuse poliment de faire le travail à sa place.
7. Détecte quand l'objectif est atteint (l'élève a compris et peut expliquer seul) et conclus la session positivement.
8. Ton ton doit être confiant, clair et encourageant. Évite les hésitations ("peut-être", "je pense que").
9. Si l'utilisateur utilise une commande comme /save, /stats, réponds simplement que cette fonctionnalité sera disponible dans la version complète, mais concentre-toi sur l'apprentissage actuel.
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

    # Construction du contexte pour l'IA
    # On inclut le prompt système + les 5 derniers messages pour le contexte
    prompt_content = SYSTEM_PROMPT + "\n\nHistorique de la conversation :\n"
    
    for msg in history[-5:]:
        role = "Utilisateur" if msg['sender'] == 'user' else "Tuteur (Toi)"
        prompt_content += f"{role}: {msg['text']}\n"
    
    prompt_content += f"Utilisateur: {user_input}\nTuteur (Toi):"

    try:
        if model:
            # Appel à l'API Gemini
            response = model.generate_content(prompt_content)
            ai_response = response.text
        else:
            ai_response = "Erreur : Clé API non configurée. Veuillez vérifier la variable GOOGLE_API_KEY sur Render."
        
        return jsonify({"response": ai_response})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Récupérer le port défini par Render (ou utiliser 5000 en local)
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)