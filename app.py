from flask import Flask, render_template, request, session, redirect, url_for, jsonify
from datetime import timedelta
import secrets

app = Flask(__name__)
app.secret_key = "geheimes-passwort"
app.permanent_session_lifetime = timedelta(hours=8)
rooms = {}

@app.route("/", methods=["GET", "POST"])
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
    username = session.get("username")
    return render_template("lobby.html", username=username)


@app.route('/host')
def host():
    return render_template("host.html")


@app.route('/play')
def play():
    username = session.get("username")
    return render_template("play.html", username=username)


@app.route("/create_room", methods=["GET", "POST"])
def create_room():
    print("create_room")
    username = session.get("username")

    if not username:
        return jsonify({"error": "Username required"}), 400
    roomID = secrets.token_hex(3).upper()  # z. B. "A1B2C3"

    rooms[roomID] = {
        "host": username,
        "players": [username]
    }

    session["roomID"] = roomID
    return jsonify({"roomID": roomID, "host": username})


@app.route("/get_rooms")
def get_rooms():
    return jsonify(rooms)



if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5500, threaded=False)