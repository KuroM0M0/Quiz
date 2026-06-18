function toggleSettingsMenu() {
    document.getElementById("settings").classList.toggle("is-active");
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