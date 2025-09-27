from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from datetime import timedelta

app = Flask(__name__)
app.secret_key = "geheimes-passwort"
app.permanent_session_lifetime = timedelta(hours=8)

#@app.before_request
#def beforeRequest():
#    getDB()


#@app.teardown_appcontext
#def teardownRequest(exception=None):
#    closeDB(exception)



@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        name = request.form.get("name")
        session.permanent = True
        session["username"] = name
        return redirect(url_for("index"))

    username = session.get("username")
    return render_template("base.html", username=username)

@app.route('/join')
def join():
    return render_template("join.html")

@app.route('/host')
def host():
    return render_template("host.html")


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5500, threaded=False)