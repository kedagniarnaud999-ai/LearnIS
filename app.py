from flask import Flask, render_template, request, jsonify, session
import json
import os
from datetime import datetime
import uuid

app = Flask(__name__)
app.secret_key = 'learnis_secret_key_2024'

# Store for user sessions and progress
user_sessions = {}
user_progress = {}

class LearningSession:
    def __init__(self, session_id, subject=None):
        self.session_id = session_id
        self.subject = subject
        self.messages = []
        self.mastery_level = 0
        self.turn_count = 0
        self.max_turns = 15
        self.completed = False
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        self.stats = {
            'questions_answered': 0,
            'correct_answers': 0,
            'concepts_mastered': [],
            'time_spent_minutes': 0
        }
    
    def add_message(self, role, content):
        self.messages.append({
            'role': role,
            'content': content,
            'timestamp': datetime.now().isoformat()
        })
        self.last_activity = datetime.now()
        self.turn_count += 1
    
    def update_mastery(self, level):
        self.mastery_level = min(100, max(0, level))
        if self.mastery_level >= 80:
            self.completed = True
    
    def should_end_session(self):
        return self.completed or self.turn_count >= self.max_turns
    
    def get_end_reason(self):
        if self.completed:
            return "Félicitations ! Vous avez maîtrisé ce concept (niveau >= 80%)"
        if self.turn_count >= self.max_turns:
            return "Session terminée - limite de tours atteinte. Sauvegardez pour reprendre plus tard."
        return None
    
    def to_dict(self):
        return {
            'session_id': self.session_id,
            'subject': self.subject,
            'messages': self.messages,
            'mastery_level': self.mastery_level,
            'turn_count': self.turn_count,
            'completed': self.completed,
            'created_at': self.created_at.isoformat(),
            'last_activity': self.last_activity.isoformat(),
            'stats': self.stats
        }
    
    @classmethod
    def from_dict(cls, data):
        session_obj = cls(data['session_id'], data.get('subject'))
        session_obj.messages = data.get('messages', [])
        session_obj.mastery_level = data.get('mastery_level', 0)
        session_obj.turn_count = data.get('turn_count', 0)
        session_obj.completed = data.get('completed', False)
        session_obj.created_at = datetime.fromisoformat(data['created_at'])
        session_obj.last_activity = datetime.fromisoformat(data['last_activity'])
        session_obj.stats = data.get('stats', {})
        return session_obj

def generate_response(session_obj, user_message):
    """Generate AI response based on learning state"""
    
    # Check if session should end
    if session_obj.should_end_session():
        end_reason = session_obj.get_end_reason()
        return f"{end_reason}\n\nUtilisez /save pour sauvegarder cette session ou commencez une nouvelle discussion."
    
    # Handle commands
    if user_message.startswith('/'):
        return handle_command(session_obj, user_message)
    
    # Simulate AI tutor response (in production, this would call an LLM API)
    session_obj.stats['questions_answered'] += 1
    
    # Simple mastery progression simulation
    progress_increment = 15
    session_obj.update_mastery(session_obj.mastery_level + progress_increment)
    
    # Generate contextual response
    if session_obj.mastery_level < 30:
        response = f"Excellent début ! Continuons à explorer les bases. Votre niveau de maîtrise actuel est de {session_obj.mastery_level}%.\n\nPouvez-vous me donner un exemple concret de ce que vous venez d'apprendre ?"
    elif session_obj.mastery_level < 60:
        response = f"Bien joué ! Vous progressez bien (maîtrise: {session_obj.mastery_level}%).\n\nMaintenant, essayez d'expliquer ce concept avec vos propres mots. Que retenez-vous principalement ?"
    elif session_obj.mastery_level < 80:
        response = f"Très bon travail ! Vous y êtes presque ({session_obj.mastery_level}%).\n\nPour consolider, pouvez-vous résoudre un problème pratique utilisant ce concept ?"
    else:
        response = f"🎉 Félicitations ! Vous avez atteint un excellent niveau de maîtrise ({session_obj.mastery_level}%).\n\nVous avez compris l'essentiel de ce sujet. Souhaitez-vous approfondir ou passer à un nouveau concept ?"
        session_obj.completed = True
    
    session_obj.add_message('assistant', response)
    return response

def handle_command(session_obj, command):
    """Handle slash commands"""
    cmd = command.lower().strip()
    
    if cmd == '/stats':
        stats = session_obj.stats
        return f"""📊 **Vos Statistiques d'Apprentissage**
        
Niveau de maîtrise: {session_obj.mastery_level}%
Tours effectués: {session_obj.turn_count}/{session_obj.max_turns}
Questions répondues: {stats['questions_answered']}
Concepts maîtrisés: {len(stats['concepts_mastered'])}
Session complétée: {'Oui ✓' if session_obj.completed else 'Non'}
        
Utilisez /save pour sauvegarder cette progression."""
    
    elif cmd == '/save':
        user_id = session.get('user_id', 'anonymous')
        if user_id not in user_sessions:
            user_sessions[user_id] = {}
        
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        user_sessions[user_id][session_id] = session_obj
        
        return f"✅ Session sauvegardée avec l'ID: {session_id}\n\nUtilisez /sessions pour voir toutes vos sessions sauvegardées."
    
    elif cmd == '/sessions':
        user_id = session.get('user_id', 'anonymous')
        saved_sessions = user_sessions.get(user_id, {})
        
        if not saved_sessions:
            return "📭 Aucune session sauvegardée trouvée.\n\nUtilisez /save pour sauvegarder votre session actuelle."
        
        session_list = "📚 **Vos Sessions Sauvegardées**:\n\n"
        for sid, sess in saved_sessions.items():
            status = "✓ Complété" if sess.completed else "○ En cours"
            session_list += f"• {sid}\n  Sujet: {sess.subject or 'Général'}\n  Maîtrise: {sess.mastery_level}% | Tours: {sess.turn_count}\n  Statut: {status}\n  Dernière activité: {sess.last_activity.strftime('%d/%m %H:%M')}\n\n"
        
        session_list += "\nUtilisez /load <session_id> pour reprendre une session."
        return session_list
    
    elif cmd.startswith('/load '):
        session_id = cmd.replace('/load ', '').strip()
        user_id = session.get('user_id', 'anonymous')
        saved_sessions = user_sessions.get(user_id, {})
        
        if session_id in saved_sessions:
            # Load the session
            loaded_session = saved_sessions[session_id]
            session_obj.messages = loaded_session.messages
            session_obj.mastery_level = loaded_session.mastery_level
            session_obj.turn_count = loaded_session.turn_count
            session_obj.completed = loaded_session.completed
            session_obj.stats = loaded_session.stats
            
            return f"✅ Session '{session_id}' chargée avec succès !\n\nNiveau de maîtrise: {session_obj.mastery_level}%\nDernier message repris. Continuez où vous vous étiez arrêté."
        else:
            return f"❌ Session '{session_id}' non trouvée.\n\nUtilisez /sessions pour voir vos sessions disponibles."
    
    elif cmd == '/help':
        return """📖 **Commandes Disponibles**:

/stats - Voir vos statistiques d'apprentissage
/save - Sauvegarder la session actuelle
/sessions - Lister toutes vos sessions sauvegardées
/load <ID> - Reprendre une session sauvegardée
/help - Afficher cette aide

**Conseils**:
- La session se termine automatiquement quand vous maîtrisez le sujet (80%+)
- Maximum 15 tours par session
- Sauvegardez régulièrement pour ne pas perdre votre progression"""
    
    else:
        return f"❌ Commande '{command}' non reconnue.\n\nTapez /help pour voir les commandes disponibles."

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message', '')
    subject = data.get('subject', None)
    
    # Get or create session
    session_id = session.get('session_id')
    if not session_id or session_id not in user_progress:
        session_id = str(uuid.uuid4())
        session['session_id'] = session_id
        user_progress[session_id] = LearningSession(session_id, subject)
    
    session_obj = user_progress[session_id]
    
    # Add user message
    session_obj.add_message('user', user_message)
    
    # Generate response
    response = generate_response(session_obj, user_message)
    
    return jsonify({
        'response': response,
        'mastery_level': session_obj.mastery_level,
        'turn_count': session_obj.turn_count,
        'completed': session_obj.completed,
        'should_end': session_obj.should_end_session(),
        'end_reason': session_obj.get_end_reason() if session_obj.should_end_session() else None
    })

@app.route('/api/session/new', methods=['POST'])
def new_session():
    data = request.json
    subject = data.get('subject', None)
    
    # Clear current session
    session_id = str(uuid.uuid4())
    session['session_id'] = session_id
    user_progress[session_id] = LearningSession(session_id, subject)
    
    return jsonify({
        'session_id': session_id,
        'message': 'Nouvelle session créée'
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    session_id = session.get('session_id')
    if not session_id or session_id not in user_progress:
        return jsonify({'error': 'Aucune session active'}), 404
    
    session_obj = user_progress[session_id]
    return jsonify(session_obj.to_dict())

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=8080, threaded=True)
