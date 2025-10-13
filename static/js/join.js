function createRoom() {
    fetch('/create', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username: "{{ username }}" })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            console.error(data.error);
            return;
        }
        console.log("Raum erstellt:", data);

        const roomCodeDiv = document.getElementById('roomCode');
        roomCodeDiv.innerHTML = `<h1 class="title roomCode">Room Code: ${data.roomID}</h1>`;

        socket.emit('join_room', {roomID: data.roomID, host: data.host}); //Host tritt direkt neu erstellten Raum bei
    })
    .catch(error => console.error('Fehler beim Erstellen vom Raum:', error));
}



function hostRoom() {
    loadPage('host');
    setTimeout(() => createRoom(), 200);
}



function joinButton() {
    const input = document.getElementById("roomIDInput")
    const inputText = input.value
    const joinButton = document.getElementById("joinButton")

    rooms = fetch('/get_rooms')
    .then(response => response.json())
    .then(data => {
        console.log(data)
        if(inputText in data) {
            joinButton.removeAttribute('disabled')
        } else {
            joinButton.setAttribute('disabled', true)
        }
    })
}


function joinRoom() {
    const roomID = document.getElementById("roomIDInput").value;
    idk = fetch("/join", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({roomID})
    })
    .then(response => response.json())
    .then(data => {
        if(data.success) {
            socket.emit('join_room', {roomID: data.roomID, username: data.player});
            // Kurze Verzögerung, damit das Event gesendet werden kann
            setTimeout(() => { window.location.href = "/play"; }, 100);
        } else {
            ShowErrorAlert("Fehler", data.error);
        }
    })
}