import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request, session, redirect, url_for, jsonify, Response, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import request as flask_request
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user
from datetime import timedelta
from dotenv import load_dotenv
import time
import json
import secrets
import os

load_dotenv()
app = Flask(__name__)
app.secret_key = "geheimes-passwort"
password = os.getenv("pw")
app.permanent_session_lifetime = timedelta(hours=8)
socketio = SocketIO(app, cors_allowed_origins="*")  # erlaubt auch lokale Tests
rooms = {}
players = [] #nötig für Prüfung ob Username bereits existiert

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'wartung/login' # Wo soll man hin, wenn man nicht eingeloggt ist?

class User(UserMixin):
    def __init__(self, id):
        self.id = id

# Da wir keine DB haben, erstellen wir einen festen Admin
admin_user = User(id="1")

@login_manager.user_loader
def load_user(user_id):
    return admin_user if user_id == "1" else None

@app.route('/', methods=["GET", "POST"])
def index():
    #print(f"\x1b[34m{players}\x1b[0m")
    if request.method == "POST":
        name = request.form.get("name")
        session.permanent = True
        session["username"] = name
        players.append(name)
        #print(f"\x1b[34m{players}\x1b[0m")
        return redirect(url_for("lobby"))

    username = session.get("username")
    return render_template("base.html", username=username)


@app.route('/name_exists')
def name_exists():
    name = request.args.get("name")
    if name in players:
        return jsonify(True)
    else:
        return jsonify(False)


@app.route('/lobby', methods=["GET"])
def lobby():
    #print(rooms)
    username = session.get("username")
    return render_template("lobby.html", username=username)


@app.route('/host')
def host():
    roomID = session.get("roomID")
    if roomID:
        if roomID not in rooms:
            session.pop("roomID", None)
            roomID = None
        elif rooms[roomID].get("host") != session.get("username"):
            # The user was a player in this room, not the host. They want to create a new room.
            roomID = None
    return render_template("host.html", roomID=roomID)


@app.route('/play')
def play():
    username = session.get("username")
    roomID = session.get("roomID")
    if roomID and roomID not in rooms:
        session.pop("roomID", None)
        return redirect(url_for("lobby"))
    return render_template("play.html", username=username)


@app.route('/faq')
def faq():
    return render_template("faq.html")

@app.route('/wartung', methods=['GET','POST'])
@login_required
def wartung():
    if request.method == 'POST':
        msg = request.form.get("message")
        action = request.form.get("action") # "show" oder "hide"

        is_active = (action == "show")
        saveWartung(msg, is_active)
        
        # Echtzeit-Broadcast an alle User
        socketio.emit('wartungUpdate', {'message': msg, 'isActive': is_active})
        
        # Redirect, damit beim Refresh der Seite nicht alles doppelt gesendet wird
        return redirect(url_for('wartung'))

    # Bei GET: Aktuellen Status laden, um ihn im Formular anzuzeigen
    current_status = loadWartung() 
    return render_template("wartung.html", status=current_status)

@app.route('/wartung/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        pw = request.form.get('password')
        if pw == password:
            login_user(admin_user)
            return redirect(url_for('wartung'))
    return '''<form method="post">Passwort: <input name="password" type="password"><input type="submit"></form>'''


@app.route('/sitemap.xml')
def static_from_root():
    return send_from_directory(app.static_folder, 'sitemap.xml')

@app.route('/join', methods=["POST"])
def join():
    username = session.get("username")
    #print(username, "\x1b[33m Halloooooooo \x1b[0m")
    roomID = request.json.get("roomID")  # client schickt z.B. {"roomID": "ABC123"}

    if not username:
        return jsonify({"error": "Username required"}), 400
    if not roomID or roomID not in rooms:
        return jsonify({"error": "Room not found"}), 404

    room = rooms[roomID]
    # Spieler hinzufügen, wenn er noch nicht drin ist
    if username not in room["players"]:
        room["players"].update({username: {"textFeld": "", "points": 0}})

    session["roomID"] = roomID
    return jsonify({"success": True, "roomID": roomID, "players": room["players"], "player": username})


@app.route('/create', methods=["GET", "POST"])
def create():
    username = session.get("username")

    if not username:
        return jsonify({"error": "Username required"}), 400
    roomID = secrets.token_hex(3).upper()  # z. B. "A1B2C3"

    rooms[roomID] = {
        "host": username,
        "players": {},
        "buzzer_active": True,
        "text_locked": False,
        "only_first": False,
        "buzzed_by": None,
        "buzzerOrder": 0,
        "answerButton": False
    }

    # Add host as first player, unnötig, weil durch Vue er sonst auch in der Spielerliste erscheint
    #rooms[roomID]["players"][username] = {
    #    "textFeld": "",
    #    "points": 0
    #}

    session["roomID"] = roomID
    print(f"Raum erstellt: {roomID} (Host: {username})")

    #schickt an alle verbundenen Clients eine Nachricht, dass der Raum erstellt wurde
    #socketio.emit("room_created", {"roomID": roomID, "host": username})

    return jsonify({"roomID": roomID, "host": username})


@app.route('/get_rooms')
def get_rooms():
    #print(rooms)
    return jsonify(rooms)


@app.route('/rejoin')
def rejoin():
    username = session.get("username")
    roomID = session.get("roomID")
    if roomID not in rooms:
        return jsonify({"success": "False"})
    if username in rooms[roomID]["players"]:
        return jsonify({"success": "True"})
    else:
        return jsonify({"success": "False"})
    







#Spieler joint
@socketio.on('join_room')
def on_join_room(data):
    roomID = data['roomID']
    username = data.get('username') or data.get('host')

    if roomID not in rooms:
        return

    if username not in rooms[roomID]["players"] and username != rooms[roomID]["host"]:
        rooms[roomID]["players"].update({username: {"textFeld": "", "points": 0}})

    join_room(roomID)
    print(f"\x1b[32m User {username} joined room {roomID}\x1b[0m python")
    # schickt aktuelle Raum Daten an ALLE im Raum
    #socketio.emit("room_update", rooms[roomID], room=roomID)

    socketio.emit("playerList", {"players": rooms[roomID]["players"]}, room=roomID)

    if data.get('host') is not None:
        # If the host is joining/reconnecting, send them the cards for all players
        for player_name in rooms[roomID]["players"]:
            socketio.emit("cards_update", {"username": player_name}, to=flask_request.sid)
            text = rooms[roomID]["players"][player_name].get("textFeld", "")
            if text:
                socketio.emit("text_update", {"username": player_name, "text": text}, to=flask_request.sid)
    elif data.get('username') is not None:
        print(rooms[roomID]["players"])
        socketio.emit("cards_update", {"username": username}, room=roomID)


#Spieler leavt
@socketio.on('leave_room')
def on_leave_room(data):
    roomID = data['roomID']
    username = data['username']

    if roomID in rooms and username in rooms[roomID]["players"]:
        rooms[roomID]["players"].remove(username)

    leave_room(roomID)
    #socketio.emit("room_update", rooms[roomID], room=roomID)

@socketio.on("firstBuzz")
def firstBuzz(data):
    roomID = data.get("roomID")
    if roomID not in rooms:
        return
    only_first = data["firstBuzz"]
    rooms[roomID]["only_first"] = only_first
    #socketio.emit("room_update", rooms[roomID], room=roomID)

@socketio.on("text_update")
def text_update(data):
    print("\x1b[33m", data, "\x1b[0m")
    roomID = data.get('room')
    if roomID in rooms and 'username' in data:
        rooms[roomID]["players"][data['username']]["textFeld"] = data.get('text', '')
    socketio.emit('text_update', data, room=data['room'])


@socketio.on("buzzer")
def buzzer(data):
    #print("\x1b[33m", data, "\x1b[0m")
    #print("\x1b[32m", data['room'], "\x1b[0m")
    if data['room'] not in rooms:
        return

    rooms[data['room']]["buzzer_active"] = False
    rooms[data['room']]["buzzed_by"] = data['username']

    #Setze BuzzerOrder +1
    buzzerOrder = rooms[data['room']]["buzzerOrder"] + 1
    rooms[data['room']]["buzzerOrder"] = buzzerOrder

    #Füge Dinge in data hinzu
    data['buzzerOrder'] = buzzerOrder
    data['players'] = rooms[data['room']]["players"]

    socketio.emit('buzzer', data, room=data['room'])


@socketio.on("playLoaded")
def playLoaded(data):
    roomID = data.get('roomID')
    if not roomID or roomID not in rooms:
        return

    buzzerStatus = rooms[roomID]["buzzer_active"]
    buzzed_by = rooms[roomID]["buzzed_by"]
    textLocked = rooms[roomID]["text_locked"]
    answerButton = rooms[roomID]["answerButton"]

    socketio.emit("playLoaded", {"buzzerStatus": buzzerStatus, "buzzed_by": buzzed_by, "textLocked": textLocked, "answerButton": answerButton}, to=flask_request.sid)


@socketio.on("buzzerReset")
def buzzerReset(data):
    if data['roomID'] not in rooms:
        return
    rooms[data['roomID']]["buzzer_active"] = True
    rooms[data['roomID']]["buzzerOrder"] = 0
    print("\x1b[33m", "Resettet", "\x1b[0m")
    data['players'] = rooms[data['roomID']]["players"]
    socketio.emit("buzzerReset", data, room=data['roomID'])


@socketio.on("clearText")
def clearText(data):
    socketio.emit("clearText", data, room=data['roomID'])


@socketio.on("addPoints")
def addPoints(data):
    roomID = data['roomID']
    username = data['username']
    if roomID not in rooms or username not in rooms[roomID]["players"]:
        return

    rooms[roomID]["players"][username]["points"] += 1

    #socketio.emit("addPoints", data, room=data['roomID'])
    socketio.emit("playerList", {"players": rooms[roomID]["players"]}, room=roomID)


@socketio.on("decreasePoints")
def decreasePoints(data):
    roomID = data['roomID']
    username = data['username']
    if roomID not in rooms or username not in rooms[roomID]["players"]:
        return

    rooms[roomID]["players"][username]["points"] -= 1

    #socketio.emit("decreasePoints", data, room=data['roomID'])
    socketio.emit("playerList", {"players": rooms[roomID]["players"]}, room=roomID)


@socketio.on("lockBuzzer")
def lockBuzzer(data):
    roomID = data['roomID']
    if roomID not in rooms:
        return
    # lockBuzzer logic currently expects "lockBuzzer: True" to mean locked, so buzzer_active should be False.
    rooms[roomID]["buzzer_active"] = not data['lockBuzzer']
    socketio.emit("lockBuzzer", data, room=data['roomID'])
    # Only emit buzzerReset to update UI elements like reset button state,
    # but do NOT call the server buzzerReset event because that sets buzzer_active = True
    socketio.emit("buzzerReset", data, room=data['roomID'])


@socketio.on("lockText")
def lockText(data):
    data['username'] = session.get("username")
    roomID = data['roomID']
    if roomID not in rooms:
        return
    rooms[roomID]["text_locked"] = not rooms[roomID]["text_locked"]
    socketio.emit("lockText", data, room=roomID)


@socketio.on("answerInputToggle")
def answerInputToggle(data):
    data['username'] = session.get("username")
    roomID = data['roomID']
    if roomID not in rooms:
        return
    rooms[roomID]["answerButton"] = not rooms[roomID]["answerButton"]
    socketio.emit("answerInputToggle", data, room=roomID)


@socketio.on("submitAnswer")
def submitAnswer(data):
    data['username'] = session.get("username")
    socketio.emit("submitAnswer", data, room=data['room'])


@socketio.on("wartungUpdate")
def wartungUpdate(data):
    msg = data.get("message", "")
    is_active = True if msg else False # Wenn Text da ist -> aktiv, sonst nicht
    saveWartung(msg, is_active) # Speichern, damit es permanent bleibt!

    socketio.emit("wartungUpdate", data)


@socketio.on("timer")
def handle_timer(data):
    duration = int(data.get("timer"))
    # Wir berechnen den Endzeitpunkt: Aktuelle Zeit + Dauer
    end_time = (time.time() * 1000) + (duration * 1000) 
    data["endTime"] = end_time
    socketio.emit("timer", data, to=data.get("room"))



@app.context_processor
def inject_wartung():
    # Diese Variable "wartung_status" ist nun in JEDEM HTML-Template verfügbar
    return dict(wartung_status=loadWartung())


wartungsFile = 'wartungStatus.json'

# Hilfsfunktion zum Speichern
def saveWartung(msg, active=True):
    with open(wartungsFile, 'w') as f:
        json.dump({'message': msg, 'active': active}, f)

# Hilfsfunktion zum Laden
def loadWartung():
    if os.path.exists(wartungsFile):
        with open(wartungsFile, 'r') as f:
            return json.load(f)
    return {'message': '', 'active': False}


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5500, debug=True)