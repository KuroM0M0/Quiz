function closeRoom() {
    ShowQuestionAlert("Raum schließen", "Willst du wirklich den Raum schließen?").then((result) => { 
        if (result.isConfirmed) { 
            socket.emit('closeRoom', {roomID: roomID});
        } 
    })
}

socket.on('roomClosed', function() {
    ShowWarningAlert("Raum geschlossen", "Der Raum wurde geschlossen, du wirst zur Lobby weitergeleitet.").then((result) => {
        window.location.href = "/lobby";
    })
});