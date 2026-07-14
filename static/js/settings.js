function toggleSettingsMenu() {
    document.getElementById("settings").classList.toggle("is-active");
}

function toggleBuzzerSounds() {
    const list = document.getElementById('buzzer-sounds-list');
    const chevron = document.getElementById('buzzer-chevron');
    
    list.classList.toggle('is-hidden');
    
    // Dreht das Pfeil-Icon um, wenn geöffnet
    if (list.classList.contains('is-hidden')) {
        chevron.style.transform = 'rotate(0deg)';
    } else {
        chevron.style.transform = 'rotate(180deg)';
    }
}

function changeBuzzerSound(soundName) {
    document.cookie = `buzzerSound=${soundName}; path=/; max-age=31536000`; // Cookie für 1 Jahr setzen
    playBuzzerSound(); // Sofort den neuen Sound abspielen, um die Änderung zu bestätigen
}

function changeBuzzerVolume(value) {
    const volume = value / 100;
    document.cookie = `buzzerVolume=${volume}; path=/; max-age=31536000`;
}

function getCookie(name) {
    // Füge ein Semikolon am Anfang hinzu, um die Suche zu erleichtern
    const value = `; ${document.cookie}`;
    // Teile den String am gesuchten Cookie-Namen auf
    const parts = value.split(`; ${name}=`);
    
    // Wenn das Cookie existiert, isoliere den Wert
    if (parts.length === 2) {
        return parts.pop().split(';').shift();
    }
    return null; // Falls das Cookie nicht existiert
}

function kickPlayer() {
    ShowPlayerKickAlert().then((result) => {
        if (result.isConfirmed) {
            name = result.value;
            socket.emit('kickPlayer', {'roomID': roomID, 'username': name});
        }
    })
}


function toggleJoinability() {
    socket.emit('toggleJoinability', {'roomID': roomID});
}


let isLocked = false; // Startzustand: Raum ist offen
function toggleJoinability() {
    isLocked = !isLocked;
    const button = document.getElementById('btn-toggle-join');
    const icon = document.getElementById('join-icon');
    const text = document.getElementById('join-text');
    
    if (isLocked) {
        // Raum ist geschlossen
        button.classList.replace('is-success', 'is-danger');
        icon.className = 'fas fa-lock';
        text.innerText = 'Gesperrt';
        socket.emit('toggleJoinability', {'roomID': roomID});
    } else {
        // Raum ist offen
        button.classList.replace('is-danger', 'is-success');
        icon.className = 'fas fa-unlock';
        text.innerText = 'Offen';
        socket.emit('toggleJoinability', {'roomID': roomID});
    }
}