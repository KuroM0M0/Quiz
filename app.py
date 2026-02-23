import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request, session, redirect, url_for, jsonify, Response, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from datetime import timedelta
import time
import json
import secrets


app = Flask(__name__)
app.secret_key = "geheimes-passwort"
app.permanent_session_lifetime = timedelta(hours=8)
socketio = SocketIO(app, cors_allowed_origins="*")  # erlaubt auch lokale Tests
rooms = {}
players = [] #nötig für Prüfung ob Username bereits existiert

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
    return render_template("host.html")


@app.route('/play')
def play():
    username = session.get("username")
    return render_template("play.html", username=username)


@app.route('/faq')
def faq():
    return render_template("faq.html")


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
        "buzzerOrder": 0
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









#Spieler joint
@socketio.on('join_room')
def on_join_room(data):
    roomID = data['roomID']
    username = data.get('username') or data.get('host')

    if username != rooms[roomID]["players"] and username not in rooms[roomID]["host"]:
        rooms[roomID]["players"].update({username: {"textFeld": "", "points": 0}})

    join_room(roomID)
    print(f"\x1b[32m User {username} joined room {roomID}\x1b[0m python")
    # schickt aktuelle Raum Daten an ALLE im Raum
    #socketio.emit("room_update", rooms[roomID], room=roomID)
    if data.get('username') is not None:
        print(rooms[roomID]["players"])
        socketio.emit("cards_update", {"username": username}, room=roomID)
        socketio.emit("playerList", {"players": rooms[roomID]["players"]}, room=roomID)


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
    only_first = data["firstBuzz"]
    rooms[roomID]["only_first"] = only_first
    #socketio.emit("room_update", rooms[roomID], room=roomID)

@socketio.on("text_update")
def text_update(data):
    print("\x1b[33m", data, "\x1b[0m")
    socketio.emit('text_update', data, room=data['room'])


@socketio.on("buzzer")
def buzzer(data):
    #print("\x1b[33m", data, "\x1b[0m")
    #print("\x1b[32m", data['room'], "\x1b[0m")

    rooms[data['room']]["buzzer_active"] = False
    rooms[data['room']]["buzzed_by"] = data['username']

    #Setze BuzzerOrder +1
    buzzerOrder = rooms[data['room']]["buzzerOrder"] + 1
    rooms[data['room']]["buzzerOrder"] = buzzerOrder

    #Füge Dinge in data hinzu
    data['buzzerOrder'] = buzzerOrder
    data['players'] = rooms[data['room']]["players"]
    print(data['players'])

    socketio.emit('buzzer', data, room=data['room'])


@socketio.on("playLoaded")
def playLoaded(data):
    buzzerStatus = rooms[data['roomID']]["buzzer_active"]
    buzzed_by = rooms[data['roomID']]["buzzed_by"]
    textLocked = rooms[data['roomID']]["text_locked"]

    socketio.emit("playLoaded", {"buzzerStatus": buzzerStatus, "buzzed_by": buzzed_by, "textLocked": textLocked}, room=data['roomID'])


@socketio.on("buzzerReset")
def buzzerReset(data):
    rooms[data['roomID']]["buzzer_active"] = True
    rooms[data['roomID']]["buzzerOrder"] = 0
    print("\x1b[33m", "Resettet", "\x1b[0m")
    data['players'] = rooms[data['roomID']]["players"]
    socketio.emit("buzzerReset", data, room=data['roomID'])


@socketio.on("clearText")
def clearText(data):
    print("Textclear in python")
    socketio.emit("clearText", data, room=data['roomID'])


@socketio.on("addPoints")
def addPoints(data):
    roomID = data['roomID']
    username = data['username']

    rooms[roomID]["players"][username]["points"] += 1

    #socketio.emit("addPoints", data, room=data['roomID'])
    socketio.emit("playerList", {"players": rooms[roomID]["players"]}, room=roomID)


@socketio.on("decreasePoints")
def decreasePoints(data):
    roomID = data['roomID']
    username = data['username']

    rooms[roomID]["players"][username]["points"] -= 1

    #socketio.emit("decreasePoints", data, room=data['roomID'])
    socketio.emit("playerList", {"players": rooms[roomID]["players"]}, room=roomID)


@socketio.on("lockBuzzer")
def lockBuzzer(data):
    roomID = data['roomID']
    rooms[roomID]["buzzer_active"] = not rooms[roomID]["buzzer_active"]
    socketio.emit("lockBuzzer", data, room=data['roomID'])
    socketio.emit("buzzerReset", data, room=data['roomID'])


@socketio.on("lockText")
def lockText(data):
    data['username'] = session.get("username")
    roomID = data['roomID']
    rooms[roomID]["text_locked"] = not rooms[roomID]["text_locked"]
    socketio.emit("lockText", data, room=roomID)


@socketio.on("answerInputToggle")
def answerInputToggle(data):
    data['username'] = session.get("username")
    roomID = data['roomID']
    socketio.emit("answerInputToggle", data, room=roomID)


@socketio.on("submitAnswer")
def submitAnswer(data):
    data['username'] = session.get("username")
    print(data)
    socketio.emit("submitAnswer", data, room=data['room'])


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5500, debug=True)