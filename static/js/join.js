function createRoom() {
    fetch('/create_room', {
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
        // Optional: direkt den Raumcode anzeigen
        const roomCodeDiv = document.getElementById('roomCode');
        roomCodeDiv.innerHTML = `<h1 class="title roomCode">Room Code: ${data.roomID}</h1>`;
    })
    .catch(error => console.error('Fehler beim Erstellen vom Raum:', error));
}



function hostRoom() {
    loadPage('host');
    setTimeout(() => createRoom(), 200);
}



function joinRoom() {
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