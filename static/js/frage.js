function sendQuestion() {
    const Frage = document.getElementById("frageInput");
    const Antwort = document.getElementById("antwortInput");

    socket.emit("sendQuestion", { room: roomID, question: Frage.value, answer: Antwort.value});
    closeModal("frageModal");
    Frage.value = "";
    Antwort.value = "";
}

async function sendImage() {
    const Bild = document.getElementById("bildInput");
    let bildURL = "";
    if (Bild.files.length > 0) {
        const formData = new FormData();
        formData.append("file", Bild.files[0]);
        const res = await fetch("/upload", { method: "POST", body: formData });
        const data = await res.json();
        bildURL = data.url;

        socket.emit("sendImage", { room: roomID, image: bildURL });
    } else {
        ShowErrorAlert("Kein Bild ausgewählt", "Bitte wähle ein Bild aus, das du senden möchtest.");
        return;
    }
}


// =========================================================================
// Audio-Wiedergabe auf Spieler-Geräten (ausschließlich vom Host gesteuert)
// =========================================================================

socket.on('sendQuestion', function(data) {
    const card = document.getElementById('qCard');
    const audioElem = document.getElementById('playerQuestionAudio');
    const audioIndicator = document.getElementById('playerAudioIndicator');

    if (!data) return;
    const hasAudio = !!(data.audio && data.audio.trim().length > 0);

    if (hasAudio) {
        if (audioElem) {
            if (audioElem.src !== data.audio && !audioElem.src.endsWith(data.audio)) {
                audioElem.src = data.audio;
            }
            audioElem.loop = !!data.loop;
            audioElem.load();
        }
    } else {
        if (audioElem) {
            audioElem.pause();
            audioElem.currentTime = 0;
            audioElem.removeAttribute('src');
            audioElem.load();
        }
        if (audioIndicator) audioIndicator.classList.add('unsichtbar');
    }

    if (card != null) {
        if (data.question && data.question.trim().length > 0) {
            card.classList.remove('unsichtbar');
            const text = document.getElementById('qText');
            text.textContent = data.question;
            card.classList.remove('qcard-slide');
            card.style.opacity = '0';
            void card.offsetWidth;
            card.classList.add('qcard-slide');
        } else if (hasAudio) {
            card.classList.remove('unsichtbar');
            const text = document.getElementById('qText');
            text.textContent = "Audio-Rätsel";
            card.classList.remove('qcard-slide');
            card.style.opacity = '0';
            void card.offsetWidth;
            card.classList.add('qcard-slide');
        } else {
            card.classList.add('unsichtbar');
            card.style.opacity = '0';
        }
    }
});

socket.on('playAudio', function(data) {
    const audioElem = document.getElementById('playerQuestionAudio');
    const audioIndicator = document.getElementById('playerAudioIndicator');
    if (!audioElem || !data || !data.audioUrl) return;

    if (audioElem.src !== data.audioUrl && !audioElem.src.endsWith(data.audioUrl)) {
        audioElem.src = data.audioUrl;
    }
    audioElem.loop = !!data.loop;

    const targetSeek = (typeof data.seekTime === 'number' && data.seekTime >= 0) ? data.seekTime : 0;
    const applySeek = () => {
        try {
            if (Math.abs(audioElem.currentTime - targetSeek) > 1.5) {
                audioElem.currentTime = targetSeek;
            }
        } catch (e) {}
    };

    if (audioElem.readyState >= 1) {
        applySeek();
    } else {
        audioElem.addEventListener('loadedmetadata', applySeek, { once: true });
    }

    audioElem.play().then(() => {
        if (audioIndicator) audioIndicator.classList.remove('unsichtbar');
    }).catch(err => {
        console.log("Audio Wiedergabe:", err);
    });
});

socket.on('pauseAudio', function() {
    const audioElem = document.getElementById('playerQuestionAudio');
    const audioIndicator = document.getElementById('playerAudioIndicator');
    if (audioElem) audioElem.pause();
    if (audioIndicator) audioIndicator.classList.add('unsichtbar');
});

socket.on('stopAudio', function() {
    const audioElem = document.getElementById('playerQuestionAudio');
    const audioIndicator = document.getElementById('playerAudioIndicator');
    if (audioElem) {
        audioElem.pause();
        audioElem.currentTime = 0;
    }
    if (audioIndicator) audioIndicator.classList.add('unsichtbar');
});

socket.on('seekAudio', function(data) {
    const audioElem = document.getElementById('playerQuestionAudio');
    if (!audioElem || typeof data.seekTime !== 'number') return;
    try {
        audioElem.currentTime = data.seekTime;
    } catch (e) {}
});

// Wenn ein Spieler buzzert: Audio pausieren, damit die Antwort verstanden wird
socket.on('buzzer', function() {
    const audioElem = document.getElementById('playerQuestionAudio');
    const audioIndicator = document.getElementById('playerAudioIndicator');
    if (audioElem && !audioElem.paused) {
        audioElem.pause();
        if (audioIndicator) audioIndicator.classList.add('unsichtbar');
    }
});

// Wenn der Host "Clear Text" klickt: Audio auf dem Spielergerät ebenfalls stoppen und Karte verstecken
socket.on('clearText', function() {
    const audioElem = document.getElementById('playerQuestionAudio');
    const audioIndicator = document.getElementById('playerAudioIndicator');
    if (audioElem) {
        audioElem.pause();
        audioElem.currentTime = 0;
        audioElem.removeAttribute('src');
        audioElem.load();
    }
    if (audioIndicator) audioIndicator.classList.add('unsichtbar');

    const card = document.getElementById('qCard');
    if (card) {
        card.classList.remove('qcard-slide');
        card.classList.add('unsichtbar');
        card.style.opacity = '0';
    }
});

socket.on('sendImage', function(data) {
    const bildContainer = document.getElementById('bildContainer');
    if(bildContainer != null) {
        bildContainer.classList.remove('unsichtbar');
        const bild = document.getElementById('bild');
        const bildURL = data.image;
        bild.src = bildURL;
    }
});
