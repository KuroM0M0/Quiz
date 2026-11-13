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
    if (Bild && Bild.files && Bild.files.length > 0) {
        const formData = new FormData();
        formData.append("file", Bild.files[0]);
        const res = await fetch("/upload", { method: "POST", body: formData });
        const data = await res.json();
        bildURL = data.url;

        socket.emit("sendImage", { room: roomID, image: bildURL });
        if (typeof closeModal === 'function') {
            closeModal("bildModal");
        }
        Bild.value = "";
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
    const imgWrapper = document.getElementById('qImageWrapper');
    const playerImg = document.getElementById('playerQuestionImage');
    const lightboxImg = document.getElementById('playerLightboxImage');
    const text = document.getElementById('qText');

    if (!data) return;
    const hasAudio = !!(data.audio && data.audio.trim().length > 0);
    const hasImage = !!(data.image && typeof data.image === 'string' && data.image.trim().length > 0);
    const isImageOnly = !!data.imageOnly;
    const hasText = !!(data.question && data.question.trim().length > 0);

    // Audio-Synchronisation
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

    // Bild-Synchronisation
    if (hasImage) {
        if (playerImg) playerImg.src = data.image;
        if (lightboxImg) lightboxImg.src = data.image;
        if (imgWrapper) imgWrapper.classList.remove('unsichtbar');
    } else {
        if (playerImg) playerImg.removeAttribute('src');
        if (lightboxImg) lightboxImg.removeAttribute('src');
        if (imgWrapper) imgWrapper.classList.add('unsichtbar');
        closePlayerImageLightbox();
    }

    // Fragekarten-Darstellung
    if (card != null) {
        if (hasText) {
            card.classList.remove('unsichtbar');
            if (text) {
                text.textContent = data.question;
                text.classList.remove('unsichtbar');
            }
            card.classList.remove('qcard-slide');
            card.style.opacity = '0';
            void card.offsetWidth;
            card.classList.add('qcard-slide');
        } else if (hasImage) {
            card.classList.remove('unsichtbar');
            if (text) {
                text.textContent = "";
                text.classList.add('unsichtbar');
            }
            card.classList.remove('qcard-slide');
            card.style.opacity = '0';
            void card.offsetWidth;
            card.classList.add('qcard-slide');
        } else if (hasAudio) {
            card.classList.remove('unsichtbar');
            if (text) {
                text.textContent = "Audio-Rätsel";
                text.classList.remove('unsichtbar');
            }
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

// Wenn der Host "Clear Text" klickt: Audio auf dem Spielergerät ebenfalls stoppen, Bild leeren und Karte verstecken
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

    // Bild bereinigen und verstecken
    const imgWrapper = document.getElementById('qImageWrapper');
    const playerImg = document.getElementById('playerQuestionImage');
    const lightboxImg = document.getElementById('playerLightboxImage');
    if (playerImg) playerImg.removeAttribute('src');
    if (lightboxImg) lightboxImg.removeAttribute('src');
    if (imgWrapper) imgWrapper.classList.add('unsichtbar');
    closePlayerImageLightbox();

    const card = document.getElementById('qCard');
    if (card) {
        card.classList.remove('qcard-slide');
        card.classList.add('unsichtbar');
        card.style.opacity = '0';
    }
});

socket.on('sendImage', function(data) {
    if (!data || !data.image) return;
    const card = document.getElementById('qCard');
    const imgWrapper = document.getElementById('qImageWrapper');
    const playerImg = document.getElementById('playerQuestionImage');
    const lightboxImg = document.getElementById('playerLightboxImage');
    const text = document.getElementById('qText');

    if (playerImg) playerImg.src = data.image;
    if (lightboxImg) lightboxImg.src = data.image;
    if (imgWrapper) imgWrapper.classList.remove('unsichtbar');

    if (data.imageOnly && text) {
        text.textContent = "";
        text.classList.add('unsichtbar');
    }

    if (card != null) {
        card.classList.remove('unsichtbar');
        card.classList.remove('qcard-slide');
        card.style.opacity = '0';
        void card.offsetWidth;
        card.classList.add('qcard-slide');
    }
});

window.openPlayerImageLightbox = function() {
    const modal = document.getElementById('playerImageModal');
    if (modal) {
        modal.classList.add('is-active');
    }
};

window.closePlayerImageLightbox = function() {
    const modal = document.getElementById('playerImageModal');
    if (modal) {
        modal.classList.remove('is-active');
    }
};
