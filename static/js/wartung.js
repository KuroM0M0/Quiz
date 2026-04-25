function WartungsNachricht() {
    ShowAnswerAlert("Welche Nachricht möchtest du auf den Wartungs Banner schreiben?").then((result) => {
        if (result.isConfirmed) {
            socket.emit("wartungUpdate", {message: result.value});
        }
    })
}

function WartungsNachrichtRemove() {
    ShowWarningAlert("Achtung!", "Willst du wirklich den Wartungs Banner löschen?").then((result) => {
        if (result.isConfirmed) {
            socket.emit("wartungUpdate", {message: ""});
        }
    })
}

socket.on("wartungUpdate", function(data) {
    WartungsBanner = document.getElementById("WartungsBanner");
    if(WartungsBanner != null) {
        WartungsBanner.innerHTML = data.message;
    }
})