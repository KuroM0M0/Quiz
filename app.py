from flask import Flask, render_template, request, session, redirect, url_for, jsonify, Response
from flask_socketio import SocketIO, emit, join_room, leave_room
from datetime import timedelta
import time
import json
import secrets
import eventlet

eventlet.monkey_patch()

app = Flask(__name__)
app.secret_key = "geheimes-passwort"
app.permanent_session_lifetime = timedelta(hours=8)
socketio = SocketIO(app, cors_allowed_origins="*")  # erlaubt auch lokale Tests
rooms = {}

@app.route('/', methods=["GET", "POST"])
def index():
    if request.method == "POST":
        name = request.form.get("name")
        session.permanent = True
        session["username"] = name
        return redirect(url_for("lobby"))

    username = session.get("username")
    return render_template("base.html", username=username)


@app.route('/lobby', methods=["GET"])
def lobby():
    print(rooms)
    username = session.get("username")
    return render_template("lobby.html", username=username)


@app.route('/host')
def host():
    return render_template("host.html")


@app.route('/play')
def play():
    username = session.get("username")
    return render_template("play.html", username=username)


@app.route('/join', methods=["POST"])
def join():
    username = session.get("username")
    roomID = request.json.get("roomID")  # client schickt z.B. {"roomID": "ABC123"}

    if not username:
        return jsonify({"error": "Username required"}), 400
    if not roomID or roomID not in rooms:
        return jsonify({"error": "Room not found"}), 404

    room = rooms[roomID]
    # Spieler hinzufügen, wenn er noch nicht drin ist
    if username not in room["players"]:
        room["players"].append(username)

    session["roomID"] = roomID
    return jsonify({"success": True, "roomID": roomID, "players": room["players"]})


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
        "only_first": False,
        "buzzed_by": None
    }

    # Add host as first player
    rooms[roomID]["players"][username] = {
        "textField": "",
        "buzzerPressed": False,
        "buzzerTime": None,
        "buzzerOrder": None
    }

    session["roomID"] = roomID
    print(f"Raum erstellt: {roomID} (Host: {username})")

    # hier direkt allen Clients Bescheid sagen (z. B. Lobby-Ansicht)
    socketio.emit("room_created", {"roomID": roomID, "host": username})

    return jsonify({"roomID": roomID, "host": username})


@app.route('/get_rooms')
def get_rooms():
    print(rooms)
    return jsonify(rooms)


@app.route('/buzz', methods=["POST"])
def buzz():
    roomID = session.get("roomID")
    room = rooms[roomID]
    username = session.get("username")
    print(roomID)
    if roomID is None:
        return jsonify({"error": "No roomID found"}), 400
    if not room["buzzer_active"]:
        return jsonify({"error": "Buzzer locked"}), 400
    
    room["buzzed_by"] = username

    if rooms[roomID]["only_first"]:
        rooms[roomID]["buzzer_active"] = False

    return jsonify({"success": True})



#Spieler joint
@socketio.on('join_room')
def on_join_room(data):
    roomID = data['roomID']
    username = data['username']

    if roomID not in rooms:
        rooms[roomID] = {
            "host": username,
            "players": [],
            "buzzer_active": True,
            "only_first": False,
            "buzzed_by": None
        }

    if username not in rooms[roomID]["players"]:
        rooms[roomID]["players"].append(username)

    join_room(roomID)

    # schickt aktuelle Raum Daten an ALLE im Raum
    socketio.emit("room_update", rooms[roomID], room=roomID)


#Spieler leavt
@socketio.on('leave_room')
def on_leave_room(data):
    roomID = data['roomID']
    username = data['username']

    if roomID in rooms and username in rooms[roomID]["players"]:
        rooms[roomID]["players"].remove(username)

    leave_room(roomID)
    socketio.emit("room_update", rooms[roomID], room=roomID)


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5500, debug=True)