/**
 * KuroBuzz - Stream Overlay & Host Stream-Steuerung JavaScript (stream.js)
 * Dynamische 8-Spieler Kacheln (anklickbar), interaktive Mittelkarte & Host-Synchronisation
 */

(function () {
    const isStreamPage = !!document.getElementById('streamGrid');
    let activeRoomId = window.STREAM_ROOM_ID || (isStreamPage ? (window.location.pathname.split('/')[1] || '') : '');
    let syncChannel = null;

    let roomPlayers = {};
    let isCardFullscreen = false;
    let shrinkTimeout = null;
    let timerCountdownInterval = null;
    let activeStreamTimer = null;
    let timerHideTimeout = null;
    let currentEditingSlotIndex = null;
    let editingCardId = null;

    let slots = createEmptySlots();
    let cards = [];
    let activeCardIndex = 0;
    let isMiddleCardHidden = false;

    function createEmptySlots(count = 8) {
        const arr = [];
        const n = Math.max(1, Math.min(8, count || 8));
        for (let i = 0; i < n; i++) {
            arr.push({ username: "", reactiveUrl: "", overlayUrl: "" });
        }
        return arr;
    }

    // Safe Modal Helper
    window.openModal = window.openModal || function (id) {
        const m = document.getElementById(id);
        if (m) m.classList.add('is-active');
    };
    window.closeModal = window.closeModal || function (id) {
        const m = document.getElementById(id);
        if (m) m.classList.remove('is-active');
    };

    // Alert-Hilfsfunktionen: Nutzen immer SweetAlert2 aus alerts.js (keine nativen alerts/confirms)
    function triggerErrorAlert(title, text) {
        if (typeof ShowErrorAlert === 'function') {
            ShowErrorAlert(title, text);
        } else if (typeof window.ShowErrorAlert === 'function') {
            window.ShowErrorAlert(title, text);
        } else if (typeof Swal !== 'undefined') {
            Swal.fire({ title: title, text: text, icon: 'error', confirmButtonText: 'Ok', theme: 'dark' });
        }
    }

    function triggerSuccessAlert(title, text) {
        if (typeof ShowSuccessAlert === 'function') {
            ShowSuccessAlert(title, text);
        } else if (typeof window.ShowSuccessAlert === 'function') {
            window.ShowSuccessAlert(title, text);
        } else if (typeof ShowSuccesAlert === 'function') {
            ShowSuccesAlert(title ? (title + (text ? ': ' + text : '')) : text);
        } else if (typeof Swal !== 'undefined') {
            Swal.fire({ title: title, text: text, icon: 'success', timer: 2500, showConfirmButton: false, theme: 'dark' });
        }
    }

    function triggerQuestionAlert(title, text) {
        if (typeof ShowQuestionAlert === 'function') {
            return ShowQuestionAlert(title, text);
        } else if (typeof window.ShowQuestionAlert === 'function') {
            return window.ShowQuestionAlert(title, text);
        } else if (typeof Swal !== 'undefined') {
            return Swal.fire({
                title: title,
                text: text,
                icon: 'question',
                confirmButtonText: 'Bestätigen',
                cancelButtonText: 'Abbrechen',
                showCancelButton: true,
                cancelButtonColor: '#d33',
                theme: 'dark'
            });
        }
        return Promise.resolve({ isConfirmed: false });
    }

    // =========================================================================
    // Raum-Initialisierung & Laden aus localStorage
    // =========================================================================

    function setupSyncChannel(rId) {
        if (!rId || rId === 'None') return;
        if (syncChannel) {
            try { syncChannel.close(); } catch (e) {}
        }
        syncChannel = new BroadcastChannel('kurobuzz_stream_sync_' + rId);
        syncChannel.onmessage = function (ev) {
            handleSyncMessage(ev.data);
        };
    }

    function loadRoomState(rId) {
        if (!rId || rId === 'None') return;

        // Slots laden
        try {
            const savedSlots = localStorage.getItem('kurobuzz_slots_' + rId);
            if (savedSlots) {
                const parsed = JSON.parse(savedSlots);
                if (Array.isArray(parsed) && parsed.length >= 1 && parsed.length <= 8) {
                    slots = parsed;
                } else if (Array.isArray(parsed) && parsed.length > 8) {
                    slots = parsed.slice(0, 8);
                } else {
                    slots = createEmptySlots(8);
                }
            } else {
                slots = createEmptySlots(8);
            }
        } catch (e) {
            console.error("Fehler beim Laden der Slots:", e);
            slots = createEmptySlots(8);
        }

        // Fragenliste laden
        try {
            const savedCards = localStorage.getItem('kurobuzz_cards_' + rId);
            if (savedCards) {
                const parsedCards = JSON.parse(savedCards);
                cards = Array.isArray(parsedCards) ? parsedCards : [];
            } else {
                cards = [];
            }
        } catch (e) {
            console.error("Fehler beim Laden der Karten:", e);
            cards = [];
        }

        // Wenn im Speicher noch die alten 3 Standardfragen liegen, diese entfernen
        if (Array.isArray(cards)) {
            const isOldDefault = cards.length === 3 &&
                cards[0] && cards[0].title === "Gaming Quiz 2026" &&
                cards[1] && cards[1].title === "Runde 1: Retro Gaming" &&
                cards[2] && cards[2].title === "Runde 2: Sound & Musik";
            if (isOldDefault) {
                cards = [];
                localStorage.setItem('kurobuzz_cards_' + rId, JSON.stringify(cards));
            } else {
                // Sicherstellen, dass jede Karte eine eindeutige ID besitzt
                cards.forEach((c, idx) => {
                    if (!c.id) c.id = Date.now() + idx;
                });
            }
        }

        // Aktiver Karten-Index
        try {
            const savedIndex = localStorage.getItem('kurobuzz_active_card_' + rId);
            if (savedIndex !== null) {
                activeCardIndex = parseInt(savedIndex, 10);
                if (isNaN(activeCardIndex) || activeCardIndex < 0 || (cards.length > 0 && activeCardIndex >= cards.length)) {
                    activeCardIndex = 0;
                }
            } else {
                activeCardIndex = 0;
            }
        } catch (e) {
            activeCardIndex = 0;
        }

        // Status der Mittelkarte (ein- oder ausgeblendet)
        try {
            isMiddleCardHidden = (localStorage.getItem('kurobuzz_card_hidden_' + rId) === 'true');
        } catch (e) {
            isMiddleCardHidden = false;
        }

        // Aktiven Timer wiederherstellen, falls vorhanden und noch nicht abgelaufen
        try {
            const savedTimer = localStorage.getItem('kurobuzz_active_timer_' + rId);
            if (savedTimer) {
                const parsed = JSON.parse(savedTimer);
                if (parsed && typeof parsed.endTime === 'number' && parsed.endTime > Date.now()) {
                    handleTimerSync(parsed);
                } else {
                    localStorage.removeItem('kurobuzz_active_timer_' + rId);
                }
            }
        } catch (e) {}
    }

    window.initStreamRoom = function (newRoomId) {
        if (!newRoomId || newRoomId === 'None') return;
        const changed = (activeRoomId !== newRoomId);
        activeRoomId = newRoomId;
        window.STREAM_ROOM_ID = newRoomId;

        const drawerRoomElem = document.getElementById('drawerRoomID');
        if (drawerRoomElem) drawerRoomElem.textContent = newRoomId;

        setupSyncChannel(activeRoomId);
        loadRoomState(activeRoomId);

        renderMiddleCard();
        updateControlBar();
        updateMiddleCardToggleBtn();
        renderSlots();
        renderSlotOverviewGrid();
        updateSlotUI();

        if (changed) {
            fetchRoomPlayers();
        }
    };

    // =========================================================================
    // Speichern & Synchronisieren (localStorage + BroadcastChannel + Socket.IO)
    // =========================================================================

    function broadcastSync(payload) {
        if (!activeRoomId || activeRoomId === 'None') return;
        const msg = { ...payload, roomID: activeRoomId };
        if (syncChannel) {
            try { syncChannel.postMessage(msg); } catch (e) {}
        }
        if (typeof socket !== 'undefined' && socket && socket.connected) {
            socket.emit('stream_sync', msg);
        }
    }

    function saveSlots() {
        if (!activeRoomId || activeRoomId === 'None') return;
        localStorage.setItem('kurobuzz_slots_' + activeRoomId, JSON.stringify(slots));
        broadcastSync({ type: 'slots_updated', slots: slots });
    }

    function saveCards() {
        if (!activeRoomId || activeRoomId === 'None') return;
        localStorage.setItem('kurobuzz_cards_' + activeRoomId, JSON.stringify(cards));
        broadcastSync({ type: 'cards_updated', cards: cards });
    }

    function saveActiveCardIndex() {
        if (!activeRoomId || activeRoomId === 'None') return;
        localStorage.setItem('kurobuzz_active_card_' + activeRoomId, activeCardIndex);
        broadcastSync({ type: 'active_card_updated', activeCardIndex: activeCardIndex });
    }

    function handleSyncMessage(msg) {
        if (!msg) return;
        if (msg.roomID && activeRoomId && msg.roomID !== activeRoomId) return;

        if (msg.type === 'slots_updated' && Array.isArray(msg.slots)) {
            slots = msg.slots.slice(0, 8);
            if (activeRoomId) localStorage.setItem('kurobuzz_slots_' + activeRoomId, JSON.stringify(slots));
            renderSlots();
            renderSlotOverviewGrid();
            updateSlotUI();
        } else if (msg.type === 'cards_updated' && Array.isArray(msg.cards)) {
            cards = msg.cards;
            if (activeRoomId) localStorage.setItem('kurobuzz_cards_' + activeRoomId, JSON.stringify(cards));
            if (activeCardIndex >= cards.length) {
                activeCardIndex = Math.max(0, cards.length - 1);
            }
            renderMiddleCard();
            updateControlBar();
            renderCardManagerList();
        } else if (msg.type === 'active_card_updated' && typeof msg.activeCardIndex === 'number') {
            activeCardIndex = msg.activeCardIndex;
            if (activeRoomId) localStorage.setItem('kurobuzz_active_card_' + activeRoomId, activeCardIndex);
            renderMiddleCard();
            updateControlBar();
            renderCardManagerList();
        } else if (msg.type === 'middle_card_hidden_updated') {
            isMiddleCardHidden = !!msg.isHidden;
            if (activeRoomId && activeRoomId !== 'None') {
                try {
                    localStorage.setItem('kurobuzz_card_hidden_' + activeRoomId, isMiddleCardHidden ? 'true' : 'false');
                } catch (e) {}
            }
            applyMiddleCardDOM();
            updateMiddleCardToggleBtn();
        } else if (msg.type === 'toggle_fullscreen') {
            if (typeof window.toggleQuizCardFullscreen === 'function') {
                window.toggleQuizCardFullscreen();
            }
        } else if (msg.type === 'stream_audio_visual') {
            setStreamAudioVisualState(msg.state, msg);
        } else if (msg.type === 'stream_audio_levels') {
            if (Array.isArray(msg.levels) && msg.levels.length === 5) {
                lastReceivedAudioLevels = msg.levels;
                lastReceivedAudioLevelsTime = performance.now();
            }
        } else if (msg.type === 'stream_audio_seek') {
            const streamAudio = document.getElementById('streamQuestionAudio');
            if (typeof msg.currentTime === 'number') {
                if (streamAudio) {
                    try { streamAudio.currentTime = msg.currentTime; } catch (e) {}
                }
                streamVisualizerPlaybackTime = msg.currentTime;
            }
        } else if (msg.type === 'stream_timer_sync' && msg.timerData) {
            handleTimerSync(msg.timerData);
        } else if (msg.type === 'request_sync' && !isStreamPage) {
            // Host antwortet einem neu geöffneten Stream-Fenster (z. B. in OBS) mit dem aktuellen Stand
            broadcastSync({
                type: 'full_sync',
                slots: slots,
                cards: cards,
                activeCardIndex: activeCardIndex,
                isMiddleCardHidden: isMiddleCardHidden,
                activeTimer: (activeStreamTimer && activeStreamTimer.endTime > Date.now()) ? activeStreamTimer : null
            });
        } else if (msg.type === 'full_sync') {
            if (Array.isArray(msg.slots) && msg.slots.length >= 1 && msg.slots.length <= 8) {
                slots = msg.slots;
                if (activeRoomId) localStorage.setItem('kurobuzz_slots_' + activeRoomId, JSON.stringify(slots));
                renderSlots();
                renderSlotOverviewGrid();
                updateSlotUI();
            }
            if (Array.isArray(msg.cards)) {
                cards = msg.cards;
                if (activeRoomId) localStorage.setItem('kurobuzz_cards_' + activeRoomId, JSON.stringify(cards));
            }
            if (typeof msg.activeCardIndex === 'number') {
                activeCardIndex = msg.activeCardIndex;
                if (activeRoomId) localStorage.setItem('kurobuzz_active_card_' + activeRoomId, activeCardIndex);
            }
            if (typeof msg.isMiddleCardHidden === 'boolean') {
                isMiddleCardHidden = msg.isMiddleCardHidden;
                if (activeRoomId && activeRoomId !== 'None') {
                    try {
                        localStorage.setItem('kurobuzz_card_hidden_' + activeRoomId, isMiddleCardHidden ? 'true' : 'false');
                    } catch (e) {}
                }
            }
            if (msg.activeTimer && typeof msg.activeTimer.endTime === 'number' && msg.activeTimer.endTime > Date.now()) {
                handleTimerSync(msg.activeTimer);
            }
            renderMiddleCard();
            updateControlBar();
            updateMiddleCardToggleBtn();
        }
    }

    // Fallback: storage-Event zwischen Browser-Tabs
    window.addEventListener('storage', function (ev) {
        if (!activeRoomId || !ev.key) return;
        if (ev.key === 'kurobuzz_slots_' + activeRoomId && ev.newValue) {
            try {
                const parsed = JSON.parse(ev.newValue);
                if (Array.isArray(parsed) && parsed.length >= 1 && parsed.length <= 8) {
                    slots = parsed;
                    renderSlots();
                    renderSlotOverviewGrid();
                    updateSlotUI();
                }
            } catch (e) {}
        } else if (ev.key === 'kurobuzz_cards_' + activeRoomId && ev.newValue) {
            try {
                cards = JSON.parse(ev.newValue);
                renderMiddleCard();
                updateControlBar();
                renderCardManagerList();
            } catch (e) {}
        } else if (ev.key === 'kurobuzz_active_card_' + activeRoomId && ev.newValue !== null) {
            const parsed = parseInt(ev.newValue, 10);
            if (!isNaN(parsed)) {
                activeCardIndex = parsed;
                renderMiddleCard();
                updateControlBar();
                renderCardManagerList();
            }
        } else if (ev.key === 'kurobuzz_card_hidden_' + activeRoomId && ev.newValue !== null) {
            isMiddleCardHidden = (ev.newValue === 'true');
            applyMiddleCardDOM();
            updateMiddleCardToggleBtn();
        } else if (ev.key === 'kurobuzz_active_timer_' + activeRoomId) {
            if (ev.newValue) {
                try {
                    const parsed = JSON.parse(ev.newValue);
                    if (parsed && typeof parsed.endTime === 'number' && parsed.endTime > Date.now()) {
                        handleTimerSync(parsed);
                    }
                } catch (e) {}
            } else {
                if (timerCountdownInterval) {
                    clearInterval(timerCountdownInterval);
                    timerCountdownInterval = null;
                }
                activeStreamTimer = null;
                const badge = document.getElementById('quizCardTimerBadge');
                if (badge) badge.classList.add('unsichtbar');
            }
        }
    });

    // =========================================================================
    // Mittelkarte: Klick-Animation (Vollbild / Verkleinern)
    // =========================================================================

    function expandQuizCard() {
        const quizBtn = document.getElementById('quizButton');
        const quizFeld = document.getElementById('quizFeld');
        if (!quizBtn || !quizFeld) return;

        if (shrinkTimeout) {
            clearTimeout(shrinkTimeout);
            shrinkTimeout = null;
        }

        quizFeld.style.zIndex = '100';
        quizBtn.classList.remove('button-klein');
        quizBtn.classList.add('button-vollbild');
        isCardFullscreen = true;
    }

    function shrinkQuizCard() {
        const quizBtn = document.getElementById('quizButton');
        const quizFeld = document.getElementById('quizFeld');
        if (!quizBtn || !quizFeld) return;

        if (shrinkTimeout) {
            clearTimeout(shrinkTimeout);
            shrinkTimeout = null;
        }

        quizBtn.classList.remove('button-vollbild');
        quizBtn.classList.remove('button-klein');
        isCardFullscreen = false;

        shrinkTimeout = setTimeout(() => {
            if (!isCardFullscreen) {
                quizFeld.style.zIndex = '10';
            }
            shrinkTimeout = null;
        }, 500);
    }

    window.toggleQuizCardFullscreen = function (event) {
        if (event) {
            event.stopPropagation();
        }
        const quizBtn = document.getElementById('quizButton');
        if (!quizBtn) return;

        // Fokus entfernen, damit weder Browser-Fokusrahmen noch Leertasten-Konflikte entstehen
        quizBtn.blur();

        if (isCardFullscreen) {
            shrinkQuizCard();
        } else {
            expandQuizCard();
        }
    };

    let lastRenderedCardSignature = null;
    let lastRenderedCardIndex = 0;
    let cardSwitchOutTimer = null;
    let cardSwitchCleanupTimer = null;

    function applyMiddleCardDOM() {
        const catElem = document.getElementById('quizCardCategory');
        const textElem = document.getElementById('quizCardText');
        const imgElem = document.getElementById('quizCardImage');
        const quizBtn = document.getElementById('quizButton');
        const quizFeld = document.getElementById('quizFeld');
        const audioBadge = document.getElementById('quizCardAudioBadge');
        const audioWave = document.getElementById('quizCardAudioWave');

        if (!catElem && !textElem && !imgElem) return;

        if (!cards || cards.length === 0) {
            if (isStreamPage && quizFeld) {
                if (isMiddleCardHidden) {
                    quizFeld.classList.add('is-card-hidden');
                } else {
                    quizFeld.classList.remove('is-card-hidden');
                }
            }
            if (quizBtn) quizBtn.classList.remove('is-image-only-mode', 'is-audio-only-mode');
            if (audioBadge) audioBadge.classList.add('unsichtbar');
            if (audioWave) audioWave.classList.remove('is-active-wave', 'is-paused');
            if (catElem) {
                catElem.textContent = "Keine aktive Frage";
                catElem.classList.remove('unsichtbar');
            }
            if (textElem) {
                textElem.textContent = "Noch keine Aufgaben vorhanden. Klicke unten auf 'Fragen & Aufgaben verwalten', um Aufgaben anzulegen oder ein Quiz-Paket zu importieren.";
                textElem.classList.remove('unsichtbar');
            }
            if (imgElem) {
                imgElem.src = "";
                imgElem.classList.remove('quiz-image-only');
                imgElem.classList.add('unsichtbar');
            }
            return;
        }

        if (activeCardIndex >= cards.length) activeCardIndex = Math.max(0, cards.length - 1);
        const current = cards[activeCardIndex];

        // Platzhalter-Erkennung (z. B. isPlaceholder Flag oder Titel "[Platzhalter]")
        const isPlaceholder = !!(current.isPlaceholder || (current.title && current.title.trim().toLowerCase() === '[platzhalter]') || current.placeholder);
        const shouldHideOnStream = isMiddleCardHidden || isPlaceholder;

        if (isStreamPage && quizFeld) {
            if (shouldHideOnStream) {
                quizFeld.classList.add('is-card-hidden');
            } else {
                quizFeld.classList.remove('is-card-hidden');
            }
        }

        if (isPlaceholder) {
            if (!isStreamPage) {
                // Auf /host im Vorschau-Panel anzeigen, dass der Stream gerade frei ist
                if (catElem) {
                    catElem.textContent = "💤 Platzhalter (Mitte ausgeblendet)";
                    catElem.classList.remove('unsichtbar');
                }
                if (textElem) {
                    textElem.textContent = current.question ? `[Notiz für Host] ${current.question}` : "Das Mittelfeld im Stream ist bei dieser Karte komplett ausgeblendet.";
                    textElem.classList.remove('unsichtbar');
                }
                if (imgElem) {
                    imgElem.src = "";
                    imgElem.classList.add('unsichtbar');
                }
            }
            if (quizBtn) quizBtn.classList.remove('is-image-only-mode', 'is-audio-only-mode');
            if (audioBadge) audioBadge.classList.add('unsichtbar');
            if (audioWave) audioWave.classList.remove('is-active-wave', 'is-paused');
            return;
        }

        const isImageOnly = !!(current.imageOnly && current.image);
        const hasAudio = !!(current.audio && current.audio.trim().length > 0);
        const isAudioOnly = hasAudio && !current.image && (!current.question || !current.question.trim().length);

        if (quizBtn) {
            if (isImageOnly) {
                quizBtn.classList.add('is-image-only-mode');
            } else {
                quizBtn.classList.remove('is-image-only-mode');
            }
            if (isAudioOnly) {
                quizBtn.classList.add('is-audio-only-mode');
            } else {
                quizBtn.classList.remove('is-audio-only-mode');
            }
        }

        if (catElem) catElem.textContent = current.title || "Quiz";

        // Audio Badge Status
        if (audioBadge) {
            if (hasAudio) {
                audioBadge.classList.remove('unsichtbar');
            } else {
                audioBadge.classList.add('unsichtbar');
            }
        }
        const audioBadgeIcon = audioBadge ? audioBadge.querySelector('.audio-icon-pulse') : null;
        if (audioBadgeIcon) {
            audioBadgeIcon.classList.remove('is-pulsing');
        }

        // Audio Wave Anzeige: Zunächst im Ruhezustand (unsichtbar via opacity, aber Layout-Höhe bleibt reserviert!)
        if (audioWave) {
            audioWave.classList.remove('is-active-wave', 'is-paused');
        }
        if (isStreamPage) {
            const streamAudio = document.getElementById('streamQuestionAudio');
            if (streamAudio) {
                try {
                    streamAudio.pause();
                    streamAudio.currentTime = 0;
                } catch (e) {}
            }
            if (typeof stopStreamVisualizerLoop === 'function') {
                stopStreamVisualizerLoop(false);
            }
        }

        if (isImageOnly) {
            // Bild statt Frage anzeigen
            if (isStreamPage) {
                // Auf dem Stream Überschrift und Fragetext ausblenden
                if (catElem) catElem.classList.add('unsichtbar');
                if (textElem) {
                    textElem.textContent = "";
                    textElem.classList.add('unsichtbar');
                }
            } else {
                // Im Host Drawer anzeigen, dass ein Bild statt Frage aktiv ist (inkl. Notiz wenn vorhanden)
                if (catElem) catElem.classList.remove('unsichtbar');
                if (textElem) {
                    textElem.textContent = current.question ? `📷 [Bild-Frage] ${current.question}` : "📷 [Bild statt Frage aktiv]";
                    textElem.classList.remove('unsichtbar');
                }
            }

            if (imgElem) {
                imgElem.src = current.image;
                imgElem.classList.remove('unsichtbar');
                imgElem.classList.add('quiz-image-only');
            }
        } else if (isAudioOnly) {
            // Reines Audio-Rätsel (ohne Text und ohne Bild)
            if (catElem) catElem.classList.remove('unsichtbar');
            if (textElem) {
                if (isStreamPage) {
                    textElem.textContent = "";
                    textElem.classList.add('unsichtbar');
                } else {
                    textElem.textContent = "🎵 [Reines Audio-Rätsel]";
                    textElem.classList.remove('unsichtbar');
                }
            }
            if (imgElem) {
                imgElem.src = "";
                imgElem.classList.add('unsichtbar');
            }
        } else {
            // Standard: Überschrift und Fragetext anzeigen, Bild optional darunter
            if (catElem) catElem.classList.remove('unsichtbar');
            if (textElem) {
                textElem.textContent = current.question || "";
                textElem.classList.remove('unsichtbar');
            }

            if (imgElem) {
                imgElem.classList.remove('quiz-image-only');
                if (current.image) {
                    imgElem.src = current.image;
                    imgElem.classList.remove('unsichtbar');
                } else {
                    imgElem.src = "";
                    imgElem.classList.add('unsichtbar');
                }
            }
        }
    }

    function renderMiddleCard() {
        const quizBtn = document.getElementById('quizButton');

        if (!isStreamPage || !quizBtn) {
            applyMiddleCardDOM();
            return;
        }

        let currentSig = 'empty';
        if (cards && cards.length > 0) {
            const safeIdx = Math.min(activeCardIndex, Math.max(0, cards.length - 1));
            const current = cards[safeIdx];
            currentSig = safeIdx + ':' + (current && current.id !== undefined ? current.id : safeIdx);
        }

        // Erstes Rendern beim Laden der Seite: Sofort ohne Wechsel-Animation anzeigen
        if (lastRenderedCardSignature === null) {
            lastRenderedCardSignature = currentSig;
            lastRenderedCardIndex = activeCardIndex;
            applyMiddleCardDOM();
            return;
        }

        // Gleiche Karte (z. B. doppelte Sync-Nachricht via BroadcastChannel + Socket.IO oder Textbearbeitung)
        if (currentSig === lastRenderedCardSignature) {
            if (!cardSwitchOutTimer) {
                applyMiddleCardDOM();
            }
            return;
        }

        // Richtungsabhängige Animation beim Fragenwechsel (weiter = nach links raus / von rechts rein)
        const dir = (activeCardIndex >= lastRenderedCardIndex) ? 'next' : 'prev';
        lastRenderedCardSignature = currentSig;
        lastRenderedCardIndex = activeCardIndex;

        // Laufendes Audio auf dem Stream sofort stoppen
        const streamAudio = document.getElementById('streamQuestionAudio');
        if (streamAudio) {
            try {
                streamAudio.pause();
                streamAudio.currentTime = 0;
            } catch (e) {}
        }
        if (typeof stopStreamVisualizerLoop === 'function') {
            stopStreamVisualizerLoop(false);
        }

        if (cardSwitchCleanupTimer) {
            clearTimeout(cardSwitchCleanupTimer);
            cardSwitchCleanupTimer = null;
        }

        const outClass = dir === 'next' ? 'card-switch-out-next' : 'card-switch-out-prev';
        const inClass = dir === 'next' ? 'card-switch-in-next' : 'card-switch-in-prev';

        const targetCard = (cards && cards.length > 0) ? cards[Math.min(activeCardIndex, cards.length - 1)] : null;
        const isTargetPlaceholder = targetCard ? !!(targetCard.isPlaceholder || (targetCard.title && targetCard.title.trim().toLowerCase() === '[platzhalter]') || targetCard.placeholder) : false;
        const targetShouldHide = isMiddleCardHidden || isTargetPlaceholder || !targetCard;

        const quizFeld = document.getElementById('quizFeld');
        const wasHidden = quizFeld ? quizFeld.classList.contains('is-card-hidden') : false;

        // Bei sehr schnellem Durchklicken laufenden Timer abbrechen
        if (cardSwitchOutTimer) {
            clearTimeout(cardSwitchOutTimer);
            cardSwitchOutTimer = null;
        }

        // Fall A: Wechsel zu einem Platzhalter (vorherige Karte wischt nach links weg, aber KEINE neue Karte fliegt rein!)
        if (targetShouldHide) {
            if (!wasHidden) {
                quizBtn.classList.remove('card-switch-out-next', 'card-switch-out-prev', 'card-switch-in-next', 'card-switch-in-prev');
                void quizBtn.offsetWidth;
                quizBtn.classList.add(outClass);

                cardSwitchOutTimer = setTimeout(() => {
                    cardSwitchOutTimer = null;
                    applyMiddleCardDOM();
                    quizBtn.classList.remove('card-switch-out-next', 'card-switch-out-prev', 'card-switch-in-next', 'card-switch-in-prev');
                }, 135);
            } else {
                applyMiddleCardDOM();
                quizBtn.classList.remove('card-switch-out-next', 'card-switch-out-prev', 'card-switch-in-next', 'card-switch-in-prev');
            }
            return;
        }

        // Fall B: Wechsel von einem Platzhalter zu einer sichtbaren Frage (kein Rauswischen der leeren Mitte, neue Karte fliegt sauber rein)
        if (wasHidden) {
            applyMiddleCardDOM();
            quizBtn.classList.remove('card-switch-out-next', 'card-switch-out-prev', 'card-switch-in-next', 'card-switch-in-prev');
            void quizBtn.offsetWidth;
            quizBtn.classList.add(inClass);
            cardSwitchCleanupTimer = setTimeout(() => {
                quizBtn.classList.remove('card-switch-in-next', 'card-switch-in-prev');
                cardSwitchCleanupTimer = null;
            }, 440);
            return;
        }

        // Fall C: Regulärer Wechsel zwischen zwei sichtbaren Fragen (Rauswischen -> Reinwischen)
        quizBtn.classList.remove('card-switch-out-next', 'card-switch-out-prev', 'card-switch-in-next', 'card-switch-in-prev');
        void quizBtn.offsetWidth;
        quizBtn.classList.add(outClass);

        cardSwitchOutTimer = setTimeout(() => {
            cardSwitchOutTimer = null;
            applyMiddleCardDOM();
            quizBtn.classList.remove('card-switch-out-next', 'card-switch-out-prev', 'card-switch-in-next', 'card-switch-in-prev');
            void quizBtn.offsetWidth;
            quizBtn.classList.add(inClass);

            cardSwitchCleanupTimer = setTimeout(() => {
                quizBtn.classList.remove('card-switch-in-next', 'card-switch-in-prev');
                cardSwitchCleanupTimer = null;
            }, 440);
        }, 135);
    }

    // =========================================================================
    // Navigation der Quiz-Karten & Host-Aktionen
    // =========================================================================

    window.nextCard = function () {
        if (!cards || cards.length === 0) return;
        if (typeof window.hostStopAudio === 'function') window.hostStopAudio();
        if (activeCardIndex < cards.length - 1) {
            activeCardIndex++;
            saveActiveCardIndex();
            renderMiddleCard();
            updateControlBar();
            renderCardManagerList();
        }
    };

    window.prevCard = function () {
        if (!cards || cards.length === 0) return;
        if (typeof window.hostStopAudio === 'function') window.hostStopAudio();
        if (activeCardIndex > 0) {
            activeCardIndex--;
            saveActiveCardIndex();
            renderMiddleCard();
            updateControlBar();
            renderCardManagerList();
        }
    };

    window.selectCardFromDropdown = function (index) {
        if (!cards || cards.length === 0) return;
        const parsed = parseInt(index, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < cards.length) {
            if (typeof window.hostStopAudio === 'function') window.hostStopAudio();
            activeCardIndex = parsed;
            saveActiveCardIndex();
            renderMiddleCard();
            updateControlBar();
            renderCardManagerList();
        }
    };

    window.sendCardToPlayers = function () {
        if (!cards || cards.length === 0) {
            triggerErrorAlert("Keine Fragen", "Bitte lege zuerst eine Frage an.");
            return;
        }
        const current = cards[activeCardIndex];
        if (!current) return;

        const targetRoom = activeRoomId || (typeof roomID !== 'undefined' ? roomID : '');
        if (!targetRoom) return;

        const hostPlayer = document.getElementById('hostAudioPlayer');
        const isAudioPlaying = !!(hostAudioPlaying && hostPlayer && !hostPlayer.paused);
        const currentSeek = (hostPlayer && typeof hostPlayer.currentTime === 'number') ? hostPlayer.currentTime : 0;

        socket.emit("sendQuestion", {
            room: targetRoom,
            question: current.question || "",
            answer: current.answer || "",
            audio: current.audio || "",
            loop: !!current.audioLoop
        });

        if (current.image) {
            socket.emit("sendImage", {
                room: targetRoom,
                image: current.image
            });
        }

        lastSentCardId = current.id;
        updateAudioSentHint();

        // Wenn das Audio beim Host bereits lief, während er auf Senden klickt:
        // Ab jetzt läuft es synchron auch bei allen Spielern!
        if (isAudioPlaying && current.audio) {
            socket.emit('playAudio', {
                room: targetRoom,
                audioUrl: current.audio,
                loop: !!current.audioLoop,
                seekTime: currentSeek
            });
        }

        triggerSuccessAlert("Gesendet!", "Frage wurde an die Teilnehmer übertragen.");
    };

    window.startCardTimer = function () {
        if (!cards || cards.length === 0) {
            triggerErrorAlert("Keine Fragen", "Bitte erstelle zuerst eine Frage.");
            return;
        }

        const targetRoom = activeRoomId || (typeof roomID !== 'undefined' ? roomID : '');
        if (!targetRoom) return;

        const current = cards[activeCardIndex];
        let duration = (current && current.timer) ? parseInt(current.timer, 10) : 0;

        // Wenn kein Timer auf der Karte hinterlegt ist -> Dialog zur optionalen Eingabe
        if (!duration || duration <= 0) {
            if (window.Swal) {
                Swal.fire({
                    title: "Timer starten",
                    text: "Für diese Frage ist kein Timer hinterlegt. Dauer in Sekunden eingeben:",
                    input: "number",
                    inputValue: 30,
                    inputAttributes: { min: 1, max: 600, step: 1 },
                    showCancelButton: true,
                    confirmButtonText: "Starten",
                    cancelButtonText: "Abbrechen",
                    confirmButtonColor: "#ffdd57",
                    cancelButtonColor: "#363645",
                    background: "#1a1a28",
                    color: "#f5f5f7"
                }).then((res) => {
                    if (res.isConfirmed && res.value && parseInt(res.value, 10) > 0) {
                        const secs = parseInt(res.value, 10);
                        const timerEndTime = Date.now() + secs * 1000;
                        socket.emit("timer", {
                            room: targetRoom,
                            roomID: targetRoom,
                            timer: secs
                        });
                        broadcastSync({
                            type: 'stream_timer_sync',
                            timerData: {
                                duration: secs,
                                endTime: timerEndTime
                            }
                        });
                    }
                });
            }
            return;
        }

        const timerEndTime = Date.now() + duration * 1000;
        socket.emit("timer", {
            room: targetRoom,
            roomID: targetRoom,
            timer: duration
        });
        broadcastSync({
            type: 'stream_timer_sync',
            timerData: {
                duration: duration,
                endTime: timerEndTime
            }
        });
    };

    window.toggleSolution = function () {
        const solElem = document.getElementById('streamSolutionDisplay');
        if (solElem) {
            solElem.classList.toggle('unsichtbar');
        }
    };

    // =========================================================================
    // Mittelkarte: Ein- und Ausblenden auf dem Stream (/stream)
    // =========================================================================

    function updateMiddleCardToggleBtn() {
        const btn = document.getElementById('btnToggleMiddleCard');
        const icon = document.getElementById('btnToggleMiddleCardIcon');
        const text = document.getElementById('btnToggleMiddleCardText');
        if (!btn) return;

        if (isMiddleCardHidden) {
            if (icon) icon.className = 'fas fa-eye mr-2 has-text-success';
            if (text) text.textContent = 'Mittelkarte einblenden';
            btn.title = 'Mittelkarte im Stream wieder einblenden';
            btn.classList.add('has-text-success');
            btn.style.borderColor = 'rgba(72, 199, 142, 0.45)';
        } else {
            if (icon) icon.className = 'fas fa-eye-slash mr-2 has-text-warning';
            if (text) text.textContent = 'Mittelkarte ausblenden';
            btn.title = 'Mittelkarte im Stream ausblenden';
            btn.classList.remove('has-text-success');
            btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        }
    }
    window.updateMiddleCardToggleBtn = updateMiddleCardToggleBtn;

    function toggleStreamMiddleCard() {
        isMiddleCardHidden = !isMiddleCardHidden;
        if (activeRoomId && activeRoomId !== 'None') {
            try {
                localStorage.setItem('kurobuzz_card_hidden_' + activeRoomId, isMiddleCardHidden ? 'true' : 'false');
            } catch (e) {}
        }
        broadcastSync({
            type: 'middle_card_hidden_updated',
            isHidden: isMiddleCardHidden
        });
        applyMiddleCardDOM();
        updateMiddleCardToggleBtn();

        triggerSuccessAlert(
            isMiddleCardHidden ? "Mittelkarte ausgeblendet" : "Mittelkarte wieder sichtbar",
            isMiddleCardHidden ? "Die Karte in der Mitte auf /stream ist nun ausgeblendet." : "Die Karte in der Mitte auf /stream wird wieder angezeigt."
        );
    }
    window.toggleStreamMiddleCard = toggleStreamMiddleCard;

    window.toggleControlDrawer = function () {
        const drawer = document.getElementById('controlDrawer');
        if (!drawer) return;
        if (drawer.classList.contains('is-open')) {
            window.closeControlDrawer();
        } else {
            window.openControlDrawer();
        }
    };

    window.openControlDrawer = function () {
        const drawer = document.getElementById('controlDrawer');
        if (!drawer) return;
        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        const icon = document.getElementById('drawerTabIcon');
        if (icon) {
            icon.className = 'fas fa-chevron-right';
        }
        updateMiddleCardToggleBtn();
    };

    window.closeControlDrawer = function () {
        const drawer = document.getElementById('controlDrawer');
        if (!drawer) return;
        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
        const icon = document.getElementById('drawerTabIcon');
        if (icon) {
            icon.className = 'fas fa-sliders-h';
        }
    };

    window.openControlPanel = function () {
        window.toggleControlDrawer();
    };

    window.openStreamView = function () {
        const targetRoom = activeRoomId || (typeof roomID !== 'undefined' ? roomID : '');
        if (!targetRoom || targetRoom === 'None') {
            triggerErrorAlert("Kein Raum", "Es wurde noch kein Raum-Code geladen.");
            return;
        }
        window.open('/' + encodeURIComponent(targetRoom) + '/stream', '_blank');
    };

    function updateControlBar() {
        updateMiddleCardToggleBtn();

        const counter = document.getElementById('cardCounterTag');
        const dropdown = document.getElementById('cardSelectDropdown');
        const solText = document.getElementById('solutionAnswerText');
        const timerBtn = document.getElementById('streamTimerBtn');
        const timerBtnText = document.getElementById('streamTimerBtnText');
        const prevBtn = document.getElementById('prevCardBtn');
        const nextBtn = document.getElementById('nextCardBtn');
        const sendBtn = document.getElementById('sendCardBtn');
        const solBtn = document.getElementById('toggleSolutionBtn');
        const drawerRoomElem = document.getElementById('drawerRoomID');

        if (drawerRoomElem && activeRoomId && activeRoomId !== 'None') {
            drawerRoomElem.textContent = activeRoomId;
        }

        if (!counter && !dropdown && !solText && !timerBtn) return;

        if (!cards || cards.length === 0) {
            if (counter) {
                counter.textContent = "Noch keine Fragen";
                counter.classList.remove('has-text-info', 'has-text-weight-bold');
                counter.classList.add('has-text-grey');
            }
            const hostAudioBar = document.getElementById('hostAudioBar');
            if (hostAudioBar) hostAudioBar.classList.add('is-hidden');
            const hostAudioPlayer = document.getElementById('hostAudioPlayer');
            if (hostAudioPlayer) {
                hostAudioPlayer.pause();
                hostAudioPlayer.currentTime = 0;
                hostAudioPlayer.src = "";
            }
            updateHostAudioButtons(false);
            updateAudioSentHint();
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            if (dropdown) {
                dropdown.innerHTML = "<option value=''>-- Noch keine Fragen angelegt --</option>";
                dropdown.disabled = true;
            }
            if (solText) solText.textContent = "-";
            if (timerBtn) {
                timerBtn.classList.add('is-outlined');
                timerBtn.disabled = true;
                timerBtn.title = "Erst Fragen anlegen";
            }
            if (timerBtnText) timerBtnText.textContent = "Timer";
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.title = "Erst Fragen anlegen";
            }
            if (solBtn) solBtn.disabled = true;
            return;
        }

        if (prevBtn) prevBtn.disabled = false;
        if (nextBtn) nextBtn.disabled = false;
        if (dropdown) dropdown.disabled = false;
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.title = "Aktive Frage und Bild an alle Teilnehmer übertragen";
        }
        if (solBtn) solBtn.disabled = false;
        if (timerBtn) timerBtn.disabled = false;

        if (activeCardIndex >= cards.length) activeCardIndex = Math.max(0, cards.length - 1);
        const current = cards[activeCardIndex];

        // Host Audio Bar Sichtbarkeit & Audio-Source aktualisieren
        const hostAudioBar = document.getElementById('hostAudioBar');
        if (hostAudioBar) {
            const hasAudio = !!(current && current.audio && current.audio.trim().length > 0);
            if (hasAudio) {
                hostAudioBar.classList.remove('is-hidden');
                const hostAudioPlayer = document.getElementById('hostAudioPlayer');
                if (hostAudioPlayer) {
                    if (hostAudioPlayer.src !== current.audio && !hostAudioPlayer.src.endsWith(current.audio)) {
                        hostAudioPlayer.src = current.audio;
                        hostAudioPlayer.currentTime = 0;
                        updateHostAudioButtons(false);
                        updateHostAudioSeekSlider(0, 0);
                    }
                    hostAudioPlayer.loop = !!current.audioLoop;
                }
            } else {
                hostAudioBar.classList.add('is-hidden');
                const hostAudioPlayer = document.getElementById('hostAudioPlayer');
                if (hostAudioPlayer) {
                    hostAudioPlayer.pause();
                    hostAudioPlayer.currentTime = 0;
                    hostAudioPlayer.src = "";
                    updateHostAudioButtons(false);
                    updateHostAudioSeekSlider(0, 0);
                }
            }
            updateAudioSentHint();
        }

        if (counter) {
            counter.textContent = `Frage ${activeCardIndex + 1} von ${cards.length}`;
            counter.classList.remove('has-text-grey');
            counter.classList.add('has-text-info', 'has-text-weight-bold');
        }

        if (dropdown) {
            dropdown.innerHTML = "";
            cards.forEach((c, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                const timerTag = (c.timer && parseInt(c.timer, 10) > 0) ? ` [${c.timer}s]` : '';
                let modePrefix = '';
                if (c.imageOnly && c.image) modePrefix += '📷 ';
                if (c.audio && c.audio.trim().length > 0) modePrefix += '🎵 ';
                const qText = c.question ? c.question.substring(0, 25) + '...' : ((c.imageOnly && c.image) ? '[Bild]' : (c.audio ? '[Audio]' : '...'));
                opt.textContent = `${idx + 1}. ${modePrefix}${c.title || 'Frage'}${timerTag}: ${qText}`;
                if (idx === activeCardIndex) opt.selected = true;
                dropdown.appendChild(opt);
            });
        }

        if (solText) {
            solText.textContent = (current && current.answer) ? current.answer : "(Keine Lösung hinterlegt)";
        }

        if (timerBtn) {
            if (current && current.timer && parseInt(current.timer, 10) > 0) {
                timerBtn.classList.remove('is-outlined');
                timerBtn.title = `Timer für diese Aufgabe starten (${current.timer}s)`;
                if (timerBtnText) timerBtnText.textContent = `Timer (${current.timer}s)`;
            } else {
                timerBtn.classList.add('is-outlined');
                timerBtn.title = "Kein Timer für diese Aufgabe hinterlegt (Klicken für manuellen Timer)";
                if (timerBtnText) timerBtnText.textContent = "Timer";
            }
        }
    }

    // =========================================================================
    // Host Audio-Steuerung
    // =========================================================================

    let hostAudioPlaying = false;

    function formatAudioTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function updateHostAudioButtons(isPlaying) {
        hostAudioPlaying = isPlaying;
        const playIcon = document.getElementById('hostAudioPlayIcon');
        const playBtn = document.getElementById('hostAudioPlayBtn');
        if (playIcon) {
            playIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
        if (playBtn) {
            playBtn.classList.toggle('is-warning', isPlaying);
            playBtn.classList.toggle('is-info', !isPlaying);
            playBtn.title = isPlaying ? "Audio pausieren" : "Audio abspielen";
        }
    }

    let lastSentCardId = null;

    function updateAudioSentHint() {
        const container = document.getElementById('hostAudioSentStatus');
        if (!container) return;

        if (!cards || cards.length === 0 || activeCardIndex >= cards.length) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        const current = cards[activeCardIndex];
        const hasAudio = !!(current && current.audio && current.audio.trim().length > 0);

        if (!hasAudio) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        const isSent = (lastSentCardId === current.id);
        container.style.display = 'block';

        if (isSent) {
            container.style.borderTop = '1px dashed rgba(72, 199, 142, 0.35)';
            container.innerHTML = `
                <div class="is-flex is-align-items-center" style="gap: 6px; color: #48c78e; font-weight: 500;">
                    <i class="fas fa-check-circle has-text-success"></i>
                    <span>An alle Spieler gesendet</span>
                </div>
            `;
        } else {
            container.style.borderTop = '1px dashed rgba(255, 221, 87, 0.35)';
            container.innerHTML = `
                <div id="hostAudioNotSentNotice" class="is-flex is-align-items-center is-justify-content-space-between" style="color: #ffe08a;">
                    <span class="is-flex is-align-items-center" style="gap: 6px;">
                        <i class="fas fa-exclamation-triangle has-text-warning"></i>
                        <span>Noch nicht an Spieler gesendet!</span>
                    </span>
                    <button class="button is-warning is-small is-outlined py-0 px-2" style="height: 22px; font-size: 0.72rem; font-weight: bold;" onclick="sendCardToPlayers()" title="Jetzt Frage & Audio an alle Spieler übertragen">
                        <i class="fas fa-paper-plane mr-1"></i> Jetzt senden
                    </button>
                </div>
            `;
        }
    }
    window.updateAudioSentHint = updateAudioSentHint;

    window.onClearTextTriggered = function () {
        lastSentCardId = null;
        if (typeof window.hostStopAudio === 'function') {
            window.hostStopAudio();
        }
        updateAudioSentHint();
    };

    window.toggleHostAudioPlay = function () {
        if (!cards || cards.length === 0) return;
        const current = cards[activeCardIndex];
        if (!current || !current.audio) return;

        const targetRoom = activeRoomId || (typeof roomID !== 'undefined' ? roomID : '');
        const player = document.getElementById('hostAudioPlayer');
        if (!player) return;

        const isSent = (lastSentCardId === current.id);

        if (hostAudioPlaying && !player.paused) {
            // Pausieren
            player.pause();
            updateHostAudioButtons(false);
            stopHostAudioAnalyzerLoop();
            const audioPayload = { state: 'paused' };
            setStreamAudioVisualState('paused', audioPayload);
            broadcastSync({ type: 'stream_audio_visual', ...audioPayload });
            if (targetRoom) {
                socket.emit('streamAudioVisual', { room: targetRoom, ...audioPayload });
            }

            // An die Spieler nur senden, wenn die Frage bereits übertragen wurde
            if (isSent && targetRoom) {
                socket.emit('pauseAudio', { room: targetRoom });
            }
        } else {
            // Abspielen
            if (player.src !== current.audio && !player.src.endsWith(current.audio)) {
                player.src = current.audio;
            }
            player.loop = !!current.audioLoop;

            initHostAudioAnalyzer();
            if (hostAudioCtx && hostAudioCtx.state === 'suspended') {
                hostAudioCtx.resume().catch(() => {});
            }

            // Hinweis kurz hervorheben, falls die Frage noch nicht übertragen wurde (Host-Vorhören)
            if (!isSent) {
                const notSentNotice = document.getElementById('hostAudioNotSentNotice');
                if (notSentNotice) {
                    notSentNotice.style.transition = 'transform 0.15s ease, background-color 0.15s ease';
                    notSentNotice.style.transform = 'scale(1.03)';
                    notSentNotice.style.backgroundColor = 'rgba(255, 221, 87, 0.2)';
                    notSentNotice.style.borderRadius = '4px';
                    notSentNotice.style.padding = '4px 6px';
                    setTimeout(() => {
                        notSentNotice.style.transform = 'scale(1)';
                        notSentNotice.style.backgroundColor = 'transparent';
                    }, 350);
                }
            }

            player.play().then(() => {
                updateHostAudioButtons(true);
                startHostAudioAnalyzerLoop();
            }).catch(err => {
                console.warn("Host Audio Playback Fehler:", err);
            });

            // Wellen-Animation auf Stream anzeigen (auch im Vorhörmodus laut Benutzerauswahl)
            const audioPayload = {
                state: 'playing',
                audioUrl: current.audio,
                currentTime: player.currentTime || 0,
                loop: !!current.audioLoop
            };
            setStreamAudioVisualState('playing', audioPayload);
            broadcastSync({ type: 'stream_audio_visual', ...audioPayload });
            if (targetRoom) {
                socket.emit('streamAudioVisual', { room: targetRoom, ...audioPayload });
            }

            // An die Spieler nur senden, wenn die Frage bereits übertragen wurde!
            if (isSent && targetRoom) {
                const seekTime = player.currentTime || 0;
                socket.emit('playAudio', {
                    room: targetRoom,
                    audioUrl: current.audio,
                    loop: !!current.audioLoop,
                    seekTime: seekTime
                });
            }
        }
    };

    // =========================================================================
    // Web Audio API & Dynamischer Visualizer (Host-Echtzeitanalyse & Stream-Welle)
    // =========================================================================

    // Host-seitige Audio-Analyse
    let hostAudioCtx = null;
    let hostAnalyser = null;
    let hostGainNode = null;
    let hostAudioSource = null;
    let hostVisualizerFrameId = null;
    let hostVisualizerInterval = null;
    let isHostVisualizerRunning = false;
    let hostLastSocketEmitTime = 0;
    let hostRunningMax = [120, 120, 140, 120, 100];
    let hostRunningMin = [30, 30, 35, 30, 25];
    let hostPrevRaw = [0, 0, 0, 0, 0];

    function initHostAudioAnalyzer() {
        const player = document.getElementById('hostAudioPlayer');
        if (!player) return;
        if (!hostAudioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            hostAudioCtx = new AudioContextClass();
        }
        if (!hostGainNode && hostAudioCtx) {
            hostGainNode = hostAudioCtx.createGain();
            const curVol = (typeof player.volume === 'number' && !isNaN(player.volume)) ? player.volume : 0.8;
            hostGainNode.gain.value = curVol;
            hostGainNode.connect(hostAudioCtx.destination);
        }
        if (!hostAnalyser && hostAudioCtx) {
            hostAnalyser = hostAudioCtx.createAnalyser();
            hostAnalyser.fftSize = 256;
            hostAnalyser.smoothingTimeConstant = 0.25; // Schnelle, direkte Transienten-Erfassung
        }
        if (!hostAudioSource && hostAudioCtx && hostAnalyser && hostGainNode) {
            try {
                hostAudioSource = hostAudioCtx.createMediaElementSource(player);
                hostAudioSource.connect(hostAnalyser);
                hostAudioSource.connect(hostGainNode);
            } catch (e) {
                console.warn("Host Audio Source Verbindung:", e);
            }
        }
    }

    function startHostAudioAnalyzerLoop() {
        if (isHostVisualizerRunning) return;
        isHostVisualizerRunning = true;
        initHostAudioAnalyzer();

        const freqData = new Uint8Array(hostAnalyser ? hostAnalyser.frequencyBinCount : 128);

        function getBandEnergy(startBin, endBin) {
            let sum = 0, count = 0, max = 0;
            for (let k = startBin; k <= endBin && k < freqData.length; k++) {
                const val = freqData[k];
                sum += val;
                if (val > max) max = val;
                count++;
            }
            if (count === 0) return 0;
            // 40% Schnitt + 60% Peak-Transiente: Lässt Schläge und Akzente stark herausstechen
            return (sum / count) * 0.40 + max * 0.60;
        }

        function hostAnalyzeTick() {
            if (!isHostVisualizerRunning) return;

            const player = document.getElementById('hostAudioPlayer');
            if (!player || player.paused || !hostAnalyser) {
                return;
            }

            hostAnalyser.getByteFrequencyData(freqData);

            let totalEnergy = 0;
            for (let i = 0; i < freqData.length; i++) totalEnergy += freqData[i];

            let levels = [0, 0, 0, 0, 0];

            if (totalEnergy > 8) {
                // Frequenzbänder bei fftSize = 256 (~187.5 Hz pro Bin bei 48kHz):
                // Sub & Kick: 0-2 (~0-560 Hz)
                // Low-Mids & Snare: 3-7 (~560-1500 Hz)
                // Vocals & Melodie: 8-18 (~1500-3500 Hz)
                // High-Mids & Perkussion: 19-38 (~3500-7100 Hz)
                // Treble & Air / Hi-Hats: 39-75 (~7100-14000 Hz)

                const subBass = getBandEnergy(0, 2);
                const lowMids = getBandEnergy(3, 7);
                const vocals = getBandEnergy(8, 18);
                const highMids = getBandEnergy(19, 38);
                const treble = getBandEnergy(39, 75);

                // Symmetrischer Studio-Waveform Equalizer:
                // Bar 0: Linker Flügel (Perkussion-Transienten & High-Mids)
                // Bar 1: Linke Flanke (Snare, Rhythmus & Low-Mids)
                // Bar 2: ZENTRUM (Kickdrum & Haupt-Beat in GOLD)
                // Bar 3: Rechte Flanke (Vocals, Lead-Melodie)
                // Bar 4: Rechter Flügel (Treble, Hi-Hats, Air)

                const centerBeat = Math.max(subBass * 1.1, vocals * 1.15);

                const raw0 = highMids * 1.6;
                const raw1 = lowMids * 1.25;
                const raw2 = centerBeat * 1.1;
                const raw3 = vocals * 1.35;
                const raw4 = treble * 2.5;

                const raws = [raw0, raw1, raw2, raw3, raw4];

                // Dynamische adaptive Pegelanpassung pro Band:
                // Verhindert Sättigung/Klebenbleiben bei lauter Musik, sorgt für vollen Beat-Hub!
                for (let i = 0; i < 5; i++) {
                    const val = raws[i];

                    // 1. Schneller Attack auf Peaks, langsamer natürlicher Abfall
                    if (val > hostRunningMax[i]) {
                        hostRunningMax[i] = val;
                    } else {
                        hostRunningMax[i] = Math.max(75, hostRunningMax[i] * 0.993);
                    }

                    // 2. Erfassen des Dauer-Klangteppichs (RMS-Floor)
                    if (val < hostRunningMin[i]) {
                        hostRunningMin[i] = Math.max(0, val);
                    } else {
                        hostRunningMin[i] = hostRunningMin[i] * 0.994 + val * 0.006;
                    }

                    // Der Teppich darf max 58% des Peaks erreichen -> min. 42% Headroom für Beats
                    const maxFloor = hostRunningMax[i] * 0.58;
                    if (hostRunningMin[i] > maxFloor) {
                        hostRunningMin[i] = maxFloor;
                    }

                    // 3. Dynamische Spreizung
                    const dynamicRange = Math.max(35, hostRunningMax[i] - hostRunningMin[i]);
                    let norm = (val - hostRunningMin[i]) / dynamicRange;
                    norm = Math.max(0.0, Math.min(1.0, norm));

                    // 4. Transienten-Punch: Schneller Lautstärkeanstieg (z. B. Kick/Snare-Hit) gibt Extraschub
                    const delta = val - hostPrevRaw[i];
                    if (delta > 6) {
                        norm = Math.min(1.0, norm + (delta / dynamicRange) * 0.28);
                    }
                    hostPrevRaw[i] = val;

                    // 5. Exponentielle Dynamik-Kurve: Zieht den Trog zwischen Beats tief nach unten
                    norm = Math.pow(norm, 1.4);

                    levels[i] = parseFloat(norm.toFixed(3));
                }
            }

            // Sofort per BroadcastChannel ans Stream-Fenster (0ms Verzögerung)
            broadcastSync({ type: 'stream_audio_levels', levels: levels });

            // Gedrosselt per Socket.IO (~30fps) für OBS oder Netzwerk-Clients
            const now = performance.now();
            if (now - hostLastSocketEmitTime > 32) {
                hostLastSocketEmitTime = now;
                const targetRoom = activeRoomId || (typeof roomID !== 'undefined' ? roomID : '');
                if (targetRoom) {
                    socket.emit('streamAudioLevels', { room: targetRoom, levels: levels });
                }
            }
        }

        function hostLoop() {
            if (!isHostVisualizerRunning) return;
            hostVisualizerFrameId = requestAnimationFrame(hostLoop);
            hostAnalyzeTick();
        }

        hostLoop();
        if (hostVisualizerInterval) clearInterval(hostVisualizerInterval);
        hostVisualizerInterval = setInterval(hostAnalyzeTick, 33);
    }

    function stopHostAudioAnalyzerLoop() {
        isHostVisualizerRunning = false;
        if (hostVisualizerFrameId) {
            cancelAnimationFrame(hostVisualizerFrameId);
            hostVisualizerFrameId = null;
        }
        if (hostVisualizerInterval) {
            clearInterval(hostVisualizerInterval);
            hostVisualizerInterval = null;
        }
        hostRunningMax = [120, 120, 140, 120, 100];
        hostRunningMin = [30, 30, 35, 30, 25];
        hostPrevRaw = [0, 0, 0, 0, 0];
        const zeroLevels = [0, 0, 0, 0, 0];
        broadcastSync({ type: 'stream_audio_levels', levels: zeroLevels });
        const targetRoom = activeRoomId || (typeof roomID !== 'undefined' ? roomID : '');
        if (targetRoom) {
            socket.emit('streamAudioLevels', { room: targetRoom, levels: zeroLevels });
        }
    }

    // Stream-seitiger Visualizer-Status
    let lastReceivedAudioLevels = null;
    let lastReceivedAudioLevelsTime = 0;
    let streamAudioCtx = null;
    let streamAnalyser = null;
    let streamAudioSource = null;
    let streamVisualizerFrameId = null;
    let isStreamVisualizerRunning = false;
    let streamVisualizerHeights = [8, 8, 8, 8, 8];

    function initStreamVisualizerAudio() {
        const audioEl = document.getElementById('streamQuestionAudio');
        if (!audioEl) return;
        if (!streamAudioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            streamAudioCtx = new AudioContextClass();
        }
        if (!streamAnalyser && streamAudioCtx) {
            streamAnalyser = streamAudioCtx.createAnalyser();
            streamAnalyser.fftSize = 256;
            streamAnalyser.smoothingTimeConstant = 0.25;
        }
        if (!streamAudioSource && streamAudioCtx && streamAnalyser) {
            try {
                streamAudioSource = streamAudioCtx.createMediaElementSource(audioEl);
                streamAudioSource.connect(streamAnalyser);
            } catch (e) {
                console.warn("Stream Audio Source Verbindung:", e);
            }
        }
    }

    let streamRunningMax = [120, 120, 140, 120, 100];
    let streamRunningMin = [30, 30, 35, 30, 25];
    let streamPrevRaw = [0, 0, 0, 0, 0];

    function startStreamVisualizerLoop() {
        if (isStreamVisualizerRunning) return;
        isStreamVisualizerRunning = true;

        function tick() {
            if (!isStreamVisualizerRunning) return;
            streamVisualizerFrameId = requestAnimationFrame(tick);

            const waveContainer = document.getElementById('quizCardAudioWave');
            if (!waveContainer) return;

            const isFullscreen = document.getElementById('quizButton')?.classList.contains('button-vollbild');
            const minH = isFullscreen ? 12 : 8;
            const maxH = isFullscreen ? 135 : 46;

            const targetHeights = [minH, minH, minH, minH, minH];
            const now = performance.now();

            // 1. Höchste Priorität: Echte Live-Audiopegel vom Host
            if (lastReceivedAudioLevels && (now - lastReceivedAudioLevelsTime) < 800) {
                const maxScale = [0.82, 0.92, 1.0, 0.92, 0.82];
                for (let i = 0; i < 5; i++) {
                    const norm = Math.max(0, Math.min(1, lastReceivedAudioLevels[i]));
                    targetHeights[i] = minH + norm * (maxH - minH) * maxScale[i];
                }
            } else if (streamAnalyser) {
                // 2. Lokale Analyse, falls lokaler Audioplayer auf dem Stream läuft
                try {
                    const freqData = new Uint8Array(streamAnalyser.frequencyBinCount);
                    streamAnalyser.getByteFrequencyData(freqData);

                    let sum = 0;
                    for (let i = 0; i < freqData.length; i++) sum += freqData[i];

                    if (sum > 8) {
                        const getAvg = (s, e) => {
                            let total = 0, count = 0, max = 0;
                            for (let k = s; k <= e && k < freqData.length; k++) {
                                total += freqData[k];
                                if (freqData[k] > max) max = freqData[k];
                                count++;
                            }
                            return count > 0 ? ((total / count) * 0.40 + max * 0.60) : 0;
                        };

                        const subBass = getAvg(0, 2);
                        const lowMids = getAvg(3, 7);
                        const vocals = getAvg(8, 18);
                        const highMids = getAvg(19, 38);
                        const treble = getAvg(39, 75);

                        const centerBeat = Math.max(subBass * 1.1, vocals * 1.15);
                        const raws = [
                            highMids * 1.6,
                            lowMids * 1.25,
                            centerBeat * 1.1,
                            vocals * 1.35,
                            treble * 2.5
                        ];
                        const maxScale = [0.82, 0.92, 1.0, 0.92, 0.82];
                        for (let i = 0; i < 5; i++) {
                            const val = raws[i];
                            if (val > streamRunningMax[i]) {
                                streamRunningMax[i] = val;
                            } else {
                                streamRunningMax[i] = Math.max(75, streamRunningMax[i] * 0.993);
                            }
                            if (val < streamRunningMin[i]) {
                                streamRunningMin[i] = Math.max(0, val);
                            } else {
                                streamRunningMin[i] = streamRunningMin[i] * 0.994 + val * 0.006;
                            }
                            const maxFloor = streamRunningMax[i] * 0.58;
                            if (streamRunningMin[i] > maxFloor) {
                                streamRunningMin[i] = maxFloor;
                            }
                            const dynamicRange = Math.max(35, streamRunningMax[i] - streamRunningMin[i]);
                            let norm = (val - streamRunningMin[i]) / dynamicRange;
                            norm = Math.max(0.0, Math.min(1.0, norm));
                            const delta = val - streamPrevRaw[i];
                            if (delta > 6) {
                                norm = Math.min(1.0, norm + (delta / dynamicRange) * 0.28);
                            }
                            streamPrevRaw[i] = val;
                            norm = Math.pow(norm, 1.4);
                            targetHeights[i] = minH + norm * (maxH - minH) * maxScale[i];
                        }
                    }
                } catch (e) {}
            }

            // Dynamisches Glätten (Schneller Attack bei Beats, schwungvoller Release)
            for (let i = 0; i < 5; i++) {
                const target = targetHeights[i];
                const cur = streamVisualizerHeights[i];
                if (target > cur) {
                    streamVisualizerHeights[i] = cur + (target - cur) * 0.80; // Knackiger Beat-Peak
                } else {
                    streamVisualizerHeights[i] = cur + (target - cur) * 0.28; // Zieht tief nach unten
                }
                const bar = document.getElementById('audioBar' + i);
                if (bar) {
                    bar.style.height = `${Math.round(streamVisualizerHeights[i])}px`;
                }
            }
        }

        tick();
    }

    function stopStreamVisualizerLoop(isPaused = false) {
        isStreamVisualizerRunning = false;
        if (streamVisualizerFrameId) {
            cancelAnimationFrame(streamVisualizerFrameId);
            streamVisualizerFrameId = null;
        }

        const isFullscreen = document.getElementById('quizButton')?.classList.contains('button-vollbild');
        const restingH = isFullscreen ? 12 : 8;

        lastReceivedAudioLevels = [0, 0, 0, 0, 0];
        lastReceivedAudioLevelsTime = 0;
        streamRunningMax = [120, 120, 140, 120, 100];
        streamRunningMin = [30, 30, 35, 30, 25];
        streamPrevRaw = [0, 0, 0, 0, 0];

        for (let i = 0; i < 5; i++) {
            streamVisualizerHeights[i] = restingH;
            const bar = document.getElementById('audioBar' + i);
            if (bar) {
                bar.style.height = `${restingH}px`;
            }
        }
    }

    function setStreamAudioVisualState(state, info = {}) {
        // state: 'playing' | 'paused' | 'stopped'
        const audioWave = document.getElementById('quizCardAudioWave');
        const audioBadge = document.getElementById('quizCardAudioBadge');
        const audioBadgeIcon = audioBadge ? audioBadge.querySelector('.audio-icon-pulse') : null;
        const streamAudio = document.getElementById('streamQuestionAudio');

        const current = (cards && cards.length > 0 && activeCardIndex < cards.length) ? cards[activeCardIndex] : null;
        const hasAudio = !!(info.audioUrl || (current && current.audio && current.audio.trim().length > 0));
        const isAudioOnly = hasAudio && (!current || (!current.image && (!current.question || !current.question.trim().length)));

        const audioUrl = info.audioUrl || (current ? current.audio : null);

        if (state === 'playing') {
            if (audioWave && isAudioOnly) {
                audioWave.classList.remove('is-paused');
                audioWave.classList.add('is-active-wave');
            }
            if (audioBadge && hasAudio) {
                audioBadge.classList.remove('unsichtbar');
            }
            if (audioBadgeIcon && hasAudio) {
                audioBadgeIcon.classList.add('is-pulsing');
            }

            if (isStreamPage) {
                if (streamAudio && audioUrl) {
                    initStreamVisualizerAudio();
                    if (streamAudioCtx && streamAudioCtx.state === 'suspended') {
                        streamAudioCtx.resume().catch(() => {});
                    }

                    if (streamAudio.src !== audioUrl && !streamAudio.src.endsWith(audioUrl)) {
                        streamAudio.src = audioUrl;
                    }
                    streamAudio.loop = (typeof info.loop !== 'undefined') ? !!info.loop : !!(current && current.audioLoop);

                    const seekTime = (typeof info.currentTime === 'number' && info.currentTime >= 0)
                        ? info.currentTime
                        : ((typeof info.seekTime === 'number' && info.seekTime >= 0) ? info.seekTime : null);
                    if (seekTime !== null && Math.abs(streamAudio.currentTime - seekTime) > 0.5) {
                        try { streamAudio.currentTime = seekTime; } catch (e) {}
                    }

                    streamAudio.play().catch(() => {});
                }
                startStreamVisualizerLoop();
            }
        } else if (state === 'paused') {
            if (audioWave && isAudioOnly) {
                audioWave.classList.add('is-active-wave', 'is-paused');
            }
            if (audioBadgeIcon) {
                audioBadgeIcon.classList.remove('is-pulsing');
            }

            if (isStreamPage && streamAudio) {
                try { streamAudio.pause(); } catch (e) {}
            }
            stopStreamVisualizerLoop(true);
        } else { // 'stopped'
            if (audioWave) {
                audioWave.classList.remove('is-active-wave', 'is-paused');
            }
            if (audioBadgeIcon) {
                audioBadgeIcon.classList.remove('is-pulsing');
            }

            if (isStreamPage && streamAudio) {
                try {
                    streamAudio.pause();
                    streamAudio.currentTime = 0;
                } catch (e) {}
            }
            stopStreamVisualizerLoop(false);
        }
    }

    let isUserDraggingSeek = false;

    function updateHostAudioSeekSlider(cur, dur) {
        const slider = document.getElementById('hostAudioSeekSlider');
        if (!slider) return;

        if (dur && !isNaN(dur) && dur > 0) {
            slider.max = dur;
        }
        if (!isUserDraggingSeek) {
            slider.value = cur || 0;
        }

        const maxVal = parseFloat(slider.max) || (dur > 0 ? dur : 100);
        const percent = (maxVal > 0) ? ((parseFloat(slider.value) / maxVal) * 100) : 0;
        slider.style.background = `linear-gradient(to right, #209cee 0%, #209cee ${percent}%, #363645 ${percent}%, #363645 100%)`;
    }

    window.onHostAudioSeekInput = function (val) {
        isUserDraggingSeek = true;
        const player = document.getElementById('hostAudioPlayer');
        const dur = (player && player.duration) ? player.duration : 0;
        const targetSec = parseFloat(val) || 0;

        const timeElem = document.getElementById('hostAudioTime');
        if (timeElem) {
            timeElem.textContent = `${formatAudioTime(targetSec)} / ${formatAudioTime(dur)}`;
        }

        const slider = document.getElementById('hostAudioSeekSlider');
        if (slider) {
            const maxVal = parseFloat(slider.max) || (dur > 0 ? dur : 100);
            const percent = (maxVal > 0) ? ((targetSec / maxVal) * 100) : 0;
            slider.style.background = `linear-gradient(to right, #209cee 0%, #209cee ${percent}%, #363645 ${percent}%, #363645 100%)`;
        }
    };

    window.onHostAudioSeekChange = function (val) {
        isUserDraggingSeek = false;
        const player = document.getElementById('hostAudioPlayer');
        if (!player) return;

        const targetSec = parseFloat(val) || 0;
        player.currentTime = targetSec;

        updateHostAudioSeekSlider(player.currentTime, player.duration);
        syncSeekToPlayers(player.currentTime);
    };

    window.hostSeekRelative = function (seconds) {
        const player = document.getElementById('hostAudioPlayer');
        if (!player) return;

        const cur = player.currentTime || 0;
        const dur = player.duration || 0;
        let newTime = cur + seconds;

        if (dur > 0) {
            newTime = Math.max(0, Math.min(dur, newTime));
        } else {
            newTime = Math.max(0, newTime);
        }

        player.currentTime = newTime;
        updateHostAudioSeekSlider(newTime, dur);

        const timeElem = document.getElementById('hostAudioTime');
        if (timeElem) {
            timeElem.textContent = `${formatAudioTime(newTime)} / ${formatAudioTime(dur)}`;
        }

        syncSeekToPlayers(newTime);
    };

    function syncSeekToPlayers(newTime) {
        const current = (cards && cards.length > 0 && activeCardIndex < cards.length) ? cards[activeCardIndex] : null;
        const isSent = !!(current && lastSentCardId === current.id);
        const targetRoom = activeRoomId || (typeof roomID !== 'undefined' ? roomID : '');
        broadcastSync({ type: 'stream_audio_seek', currentTime: newTime });
        if (targetRoom) {
            socket.emit('seekAudio', {
                room: targetRoom,
                seekTime: newTime
            });
        }
    }

    window.hostStopAudio = function () {
        const player = document.getElementById('hostAudioPlayer');
        if (player) {
            player.pause();
            player.currentTime = 0;
            updateHostAudioSeekSlider(0, player.duration || 0);
            const timeElem = document.getElementById('hostAudioTime');
            if (timeElem) {
                timeElem.textContent = `0:00 / ${formatAudioTime(player.duration)}`;
            }
        }
        updateHostAudioButtons(false);
        stopHostAudioAnalyzerLoop();
        const audioPayload = { state: 'stopped' };
        setStreamAudioVisualState('stopped', audioPayload);
        broadcastSync({ type: 'stream_audio_visual', ...audioPayload });

        const current = (cards && cards.length > 0 && activeCardIndex < cards.length) ? cards[activeCardIndex] : null;
        const isSent = !!(current && lastSentCardId === current.id);
        const targetRoom = activeRoomId || (typeof roomID !== 'undefined' ? roomID : '');
        if (targetRoom) {
            socket.emit('streamAudioVisual', { room: targetRoom, ...audioPayload });
        }
        if (isSent && targetRoom) {
            socket.emit('stopAudio', { room: targetRoom });
        }
    };

    window.setHostAudioVolume = function (val) {
        const player = document.getElementById('hostAudioPlayer');
        const v = Math.max(0, Math.min(1, parseFloat(val)));
        if (player) {
            player.volume = v;
        }
        if (hostGainNode && hostAudioCtx) {
            try {
                hostGainNode.gain.setValueAtTime(v, hostAudioCtx.currentTime);
            } catch (e) {
                hostGainNode.gain.value = v;
            }
        }
        const vSlider = document.getElementById('hostAudioVolumeSlider');
        if (vSlider) {
            const percent = v * 100;
            vSlider.style.background = `linear-gradient(to right, #209cee 0%, #209cee ${percent}%, #363645 ${percent}%, #363645 100%)`;
        }
    };

    function initHostAudioPlayer() {
        const hostAudioPlayer = document.getElementById('hostAudioPlayer');
        if (!hostAudioPlayer) return;

        initHostAudioAnalyzer();

        hostAudioPlayer.ontimeupdate = function () {
            const timeElem = document.getElementById('hostAudioTime');
            if (timeElem) {
                const cur = formatAudioTime(hostAudioPlayer.currentTime);
                const dur = formatAudioTime(hostAudioPlayer.duration);
                timeElem.textContent = `${cur} / ${dur}`;
            }
            updateHostAudioSeekSlider(hostAudioPlayer.currentTime, hostAudioPlayer.duration);
        };

        hostAudioPlayer.onloadedmetadata = function () {
            const timeElem = document.getElementById('hostAudioTime');
            if (timeElem) {
                const cur = formatAudioTime(hostAudioPlayer.currentTime);
                const dur = formatAudioTime(hostAudioPlayer.duration);
                timeElem.textContent = `${cur} / ${dur}`;
            }
            updateHostAudioSeekSlider(hostAudioPlayer.currentTime, hostAudioPlayer.duration);
        };

        hostAudioPlayer.onended = function () {
            if (!hostAudioPlayer.loop) {
                window.hostStopAudio();
            }
        };

        window.setHostAudioVolume(0.8);
    }

    // =========================================================================
    // Anklickbare Slots & Zuweisungs-Modals (Stream & Host)
    // =========================================================================

    window.openSlotOverviewModal = function () {
        renderSlotOverviewGrid();
        updateSlotUI();
        openModal('slotOverviewModal');
    };

    function renderSlotOverviewGrid() {
        const overviewGrid = document.getElementById('slotOverviewGrid');
        if (!overviewGrid) return;

        const count = slots.length;

        // Dynamische Spaltenanzahl für das Modal-Grid
        if (count <= 1) {
            overviewGrid.style.gridTemplateColumns = 'minmax(200px, 320px)';
            overviewGrid.style.justifyContent = 'center';
        } else if (count === 2) {
            overviewGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
            overviewGrid.style.justifyContent = 'stretch';
        } else if (count === 3) {
            overviewGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
            overviewGrid.style.justifyContent = 'stretch';
        } else if (count === 4) {
            overviewGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
            overviewGrid.style.justifyContent = 'stretch';
        } else if (count === 5 || count === 6) {
            overviewGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
            overviewGrid.style.justifyContent = 'stretch';
        } else {
            // 7 oder 8 Slots
            overviewGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
            overviewGrid.style.justifyContent = 'stretch';
        }

        overviewGrid.innerHTML = "";
        slots.forEach((slot, idx) => {
            const card = document.createElement('div');
            const hasUser = !!slot.username;
            card.className = 'slot-overview-card' + (hasUser ? ' is-assigned' : '');
            card.onclick = function (e) {
                onSlotClick(idx, e);
            };

            const points = (hasUser && roomPlayers[slot.username]) ? roomPlayers[slot.username].points : 0;
            const camBadge = slot.reactiveUrl
                ? `<span class="tag is-info is-light is-small mt-1"><i class="fas fa-video"></i>&nbsp;Kamera/Reactive</span>`
                : `<span class="tag is-dark is-small mt-1">Kein Kamera-Link</span>`;
            const overlayBadge = slot.overlayUrl
                ? `<span class="tag is-warning is-light is-small mt-1"><i class="fas fa-layer-group"></i>&nbsp;Overlay</span>`
                : '';

            if (hasUser) {
                card.innerHTML = `
                    <div class="is-size-7 has-text-grey-light mb-1">Slot ${idx + 1}</div>
                    <div class="has-text-weight-bold is-size-5 has-text-white" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${slot.username}</div>
                    <div class="is-size-7 has-text-primary mt-1">${points} Pkt</div>
                    <div class="is-flex is-flex-direction-column is-align-items-center mt-1" style="gap: 2px;">
                        ${camBadge}
                        ${overlayBadge}
                    </div>
                `;
            } else {
                card.innerHTML = `
                    <div class="is-size-7 has-text-grey-light mb-1">Slot ${idx + 1}</div>
                    <div class="has-text-grey my-2"><i class="fas fa-user-plus fa-lg"></i></div>
                    <div class="is-size-7 has-text-grey">Frei – Klicken</div>
                    <div class="is-flex is-flex-direction-column is-align-items-center mt-1" style="gap: 2px;">
                        ${camBadge}
                        ${overlayBadge}
                    </div>
                `;
            }

            overviewGrid.appendChild(card);
        });
    }

    window.onSlotClick = function (slotIndex, event) {
        if (event) event.stopPropagation();
        currentEditingSlotIndex = slotIndex;
        openSlotAssignModal();
    };

    function openSlotAssignModal() {
        const title = document.getElementById('slotModalTitle');
        const select = document.getElementById('slotPlayerSelect');
        const reactiveInput = document.getElementById('slotReactiveInput');
        const overlayInput = document.getElementById('slotOverlayInput');

        if (currentEditingSlotIndex === null) return;

        if (title) title.textContent = `Slot ${currentEditingSlotIndex + 1} zuweisen`;

        if (select) {
            select.innerHTML = `<option value="">-- Kein Spieler (Slot leeren) --</option>`;
            const currentAssigned = slots[currentEditingSlotIndex].username;

            Object.keys(roomPlayers).forEach(pName => {
                const opt = document.createElement('option');
                opt.value = pName;
                opt.textContent = pName;
                if (pName === currentAssigned) {
                    opt.selected = true;
                }
                select.appendChild(opt);
            });

            if (currentAssigned && !roomPlayers[currentAssigned]) {
                const opt = document.createElement('option');
                opt.value = currentAssigned;
                opt.textContent = `${currentAssigned} (Offline)`;
                opt.selected = true;
                select.appendChild(opt);
            }
        }

        if (reactiveInput) {
            reactiveInput.value = slots[currentEditingSlotIndex].reactiveUrl || "";
        }

        if (overlayInput) {
            overlayInput.value = slots[currentEditingSlotIndex].overlayUrl || "";
        }

        openModal('slotAssignModal');
    }

    window.closeSlotAssignModal = function () {
        closeModal('slotAssignModal');
        currentEditingSlotIndex = null;
    };

    window.saveCurrentSlot = function () {
        if (currentEditingSlotIndex === null) return;

        const select = document.getElementById('slotPlayerSelect');
        const reactiveInput = document.getElementById('slotReactiveInput');
        const overlayInput = document.getElementById('slotOverlayInput');

        const chosenUser = select ? select.value : "";
        const chosenReactive = reactiveInput ? reactiveInput.value.trim() : "";
        const chosenOverlay = overlayInput ? overlayInput.value.trim() : "";

        slots[currentEditingSlotIndex].username = chosenUser;
        slots[currentEditingSlotIndex].reactiveUrl = chosenReactive;
        slots[currentEditingSlotIndex].overlayUrl = chosenOverlay;

        saveSlots();
        renderSlots();
        renderSlotOverviewGrid();
        closeModal('slotAssignModal');
        currentEditingSlotIndex = null;
    };

    window.clearCurrentSlot = function () {
        if (currentEditingSlotIndex === null) return;

        slots[currentEditingSlotIndex].username = "";
        slots[currentEditingSlotIndex].reactiveUrl = "";
        slots[currentEditingSlotIndex].overlayUrl = "";

        saveSlots();
        renderSlots();
        renderSlotOverviewGrid();
        closeModal('slotAssignModal');
        currentEditingSlotIndex = null;
    };

    // =========================================================================
    // VDO.ninja automatische Stream-Erkennung für das Textfeld-Overlay
    // =========================================================================

    function prepareVdoNinjaUrl(url) {
        if (!url || typeof url !== 'string') return url;
        if (!url.toLowerCase().includes('vdo.ninja')) return url;

        try {
            let safeUrl = url.trim();
            if (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://')) {
                safeUrl = 'https://' + safeUrl;
            }
            const parsed = new URL(safeUrl);
            if (!parsed.searchParams.has('api')) {
                parsed.searchParams.set('api', '1');
            }
            if (!parsed.searchParams.has('transparent')) {
                parsed.searchParams.set('transparent', '1');
            }
            if (!parsed.searchParams.has('cleanoutput')) {
                parsed.searchParams.set('cleanoutput', '1');
            }
            return parsed.toString();
        } catch (e) {
            let u = url.trim();
            if (!u.includes('api=')) {
                u += (u.includes('?') ? '&' : '?') + 'api=1';
            }
            if (!u.includes('transparent=')) {
                u += '&transparent=1';
            }
            if (!u.includes('cleanoutput=')) {
                u += '&cleanoutput=1';
            }
            return u;
        }
    }

    // Hört auf postMessage Events der eingebetteten VDO.ninja Iframes
    window.addEventListener('message', function (ev) {
        if (!ev || !ev.data) return;

        let data = ev.data;
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                return;
            }
        }
        if (typeof data !== 'object') return;

        // Finde das zugehörige Overlay-Iframe anhand von ev.source
        const overlayIframes = document.querySelectorAll('.slot-overlay-iframe');
        let targetIframe = null;
        overlayIframes.forEach(iframe => {
            if (iframe.contentWindow === ev.source) {
                targetIframe = iframe;
            }
        });

        if (!targetIframe) return;

        const action = data.action || '';

        // Status prüfen: Sendet der Stream aktives Video/Audio?
        const isPlaying = (
            action === 'playing' ||
            action === 'new-video-track-added' ||
            action === 'guest-connected' ||
            action === 'stream-started' ||
            (action === 'video-status' && data.value === true) ||
            ('loudness' in data) ||
            (data.stats && data.stats.inboundRtp && data.stats.inboundRtp.bytesReceived > 0)
        );

        const isStopped = (
            action === 'hangup' ||
            action === 'guest-disconnected' ||
            action === 'stream-stopped' ||
            action === 'close' ||
            (action === 'video-status' && data.value === false)
        );

        if (isPlaying) {
            targetIframe.classList.remove('is-vdo-inactive');
            targetIframe.classList.add('is-vdo-active');
        } else if (isStopped) {
            targetIframe.classList.remove('is-vdo-active');
            targetIframe.classList.add('is-vdo-inactive');
        }
    });

    // Regelmäßiger Heartbeat zur Statusabfrage aller aktiven VDO-Overlays
    setInterval(function () {
        const overlayIframes = document.querySelectorAll('.slot-overlay-iframe');
        overlayIframes.forEach(iframe => {
            if (iframe && iframe.contentWindow) {
                try {
                    iframe.contentWindow.postMessage({ action: 'getStats' }, '*');
                } catch (e) {}
            }
        });
    }, 4000);

    function renderSlots() {
        const grid = document.getElementById('streamGrid');
        if (!grid) return;

        grid.innerHTML = "";

        // Dynamisches Grid-Layout für den Stream anpassen
        const fixedGrid = document.getElementById('streamFixedGrid') || grid.closest('.fixed-grid');
        const count = slots.length;

        if (fixedGrid) {
            for (let c = 1; c <= 8; c++) {
                fixedGrid.classList.remove(`has-${c}-cols`);
            }
            fixedGrid.classList.remove('is-stream-single-row');

            if (count >= 7) {
                fixedGrid.classList.add('has-4-cols');
            } else if (count === 5 || count === 6) {
                fixedGrid.classList.add('has-3-cols');
            } else if (count === 4) {
                fixedGrid.classList.add('has-2-cols');
            } else if (count === 3) {
                fixedGrid.classList.add('has-3-cols');
                fixedGrid.classList.add('is-stream-single-row');
            } else if (count === 2) {
                fixedGrid.classList.add('has-2-cols');
                fixedGrid.classList.add('is-stream-single-row');
            } else {
                fixedGrid.classList.add('has-1-cols');
                fixedGrid.classList.add('is-stream-single-row');
            }
        }

        slots.forEach((slot, index) => {
            const cell = document.createElement('div');

            // Spezielle Positionierungsklasse je nach Spalten-Layout
            let positionClass = '';
            if (count >= 7) {
                if (index === 1) positionClass = ' slot-top-left-shift';
                else if (index === 2) positionClass = ' slot-top-right-shift';
                else if (index === 5) positionClass = ' slot-bottom-left-shift';
                else if (index === 6) positionClass = ' slot-bottom-right-shift';
            } else if (count === 5 || count === 6) {
                if (index === 1) positionClass = ' slot-top-center-shift';
                else if (index === 4) positionClass = ' slot-bottom-center-shift';
            } else if (count === 4) {
                if (index === 0) positionClass = ' slot-top-left-shift';
                else if (index === 1) positionClass = ' slot-top-right-shift';
                else if (index === 2) positionClass = ' slot-bottom-left-shift';
                else if (index === 3) positionClass = ' slot-bottom-right-shift';
            }

            cell.className = 'cell zellen' + positionClass;
            cell.id = `streamSlot_${index}`;
            cell.setAttribute('data-slot-index', index);

            const username = slot.username;
            const points = (username && roomPlayers[username]) ? roomPlayers[username].points : 0;
            const hasOverlay = !!(slot.overlayUrl && slot.overlayUrl.trim());
            const isVdoOverlay = hasOverlay && slot.overlayUrl.toLowerCase().includes('vdo.ninja');
            const overlaySrc = hasOverlay ? (isVdoOverlay ? prepareVdoNinjaUrl(slot.overlayUrl) : slot.overlayUrl.trim()) : '';
            const overlayClass = isVdoOverlay ? 'slot-overlay-iframe is-vdo-inactive' : 'slot-overlay-iframe';

            if (username) {
                // Belegter Slot: Klick auf den Header öffnet das Modal
                cell.innerHTML = `
                    <div class="slot-header" onclick="onSlotClick(${index}, event)" title="Klicken um Spieler für diesen Slot zu ändern">
                        <h1 class="title zentriert kleinAbstandOben">
                            <span class="buzzer-badge is-hidden" id="buzzerBadge_${index}"></span>
                            <span>${username}</span>
                        </h1>
                        <span class="tag is-primary ml-2" id="slotPoints_${index}">${points} Pkt</span>
                        <span class="icon is-small slot-edit-hint ml-1"><i class="fas fa-edit"></i></span>
                    </div>
                    <div class="slot-body">
                        <div class="slot-text-container">
                            <iframe class="slot-text-iframe" src="/${activeRoomId}/${encodeURIComponent(username)}/text" width="100%" height="100%" frameborder="0"></iframe>
                            ${hasOverlay ? `<iframe class="${overlayClass}" id="slotOverlayFrame_${index}" src="${overlaySrc}" width="100%" height="100%" frameborder="0" allow="autoplay; camera; microphone; fullscreen; picture-in-picture; display-capture" allowfullscreen></iframe>` : ''}
                        </div>
                        ${slot.reactiveUrl ? `<iframe class="slot-reactive-iframe" src="${slot.reactiveUrl}" width="100%" height="100%" frameborder="0" allow="autoplay; camera; microphone; fullscreen; picture-in-picture; display-capture" allowfullscreen></iframe>` : ''}
                    </div>
                `;
            } else {
                // Freier Slot: Gesamte Kachel ist klickbar
                cell.onclick = function (e) {
                    onSlotClick(index, e);
                };
                cell.innerHTML = `
                    <h1 class="title zentriert kleinAbstandOben has-text-grey">Slot ${index + 1}</h1>
                    <div class="slot-empty-container">
                        <i class="fas fa-user-plus"></i>
                        <p>Klicken zum Zuweisen</p>
                    </div>
                `;
            }

            grid.appendChild(cell);
        });
    }

    window.addSlot = function () {
        if (slots.length >= 8) {
            triggerErrorAlert("Limit erreicht", "Es können maximal 8 Slots angelegt werden.");
            return;
        }
        slots.push({ username: "", reactiveUrl: "", overlayUrl: "" });
        saveSlots();
        renderSlots();
        renderSlotOverviewGrid();
        updateSlotUI();
    };

    window.removeSlot = function () {
        if (slots.length <= 1) {
            triggerErrorAlert("Limit erreicht", "Es muss mindestens 1 Slot vorhanden sein.");
            return;
        }
        const doRemove = () => {
            slots.pop();
            saveSlots();
            renderSlots();
            renderSlotOverviewGrid();
            updateSlotUI();
        };

        const lastSlot = slots[slots.length - 1];
        if (lastSlot && lastSlot.username) {
            triggerQuestionAlert("Slot entfernen", `Slot ${slots.length} ist Spieler "${lastSlot.username}" zugewiesen. Wirklich entfernen?`).then((res) => {
                if (res && res.isConfirmed) doRemove();
            });
            return;
        }
        doRemove();
    };

    function updateSlotUI() {
        const count = slots.length;
        const modalCountElem = document.getElementById('slotCountDisplay');
        if (modalCountElem) modalCountElem.textContent = count;

        const drawerCountElem = document.getElementById('drawerSlotCountDisplay');
        if (drawerCountElem) drawerCountElem.textContent = count;

        const btnAdd = document.getElementById('btnAddSlot');
        if (btnAdd) {
            btnAdd.disabled = (count >= 8);
            btnAdd.title = (count >= 8) ? "Maximal 8 Slots erreicht" : "Einen weiteren Slot hinzufügen (max. 8)";
        }

        const btnRemove = document.getElementById('btnRemoveSlot');
        if (btnRemove) {
            btnRemove.disabled = (count <= 1);
            btnRemove.title = (count <= 1) ? "Mindestens 1 Slot erforderlich" : "Letzten Slot entfernen";
        }
    }
    window.updateSlotUI = updateSlotUI;

    window.autoAssignSlots = function () {
        const playerNames = Object.keys(roomPlayers);
        playerNames.forEach((name, idx) => {
            if (idx < slots.length) {
                slots[idx].username = name;
            }
        });
        saveSlots();
        renderSlots();
        renderSlotOverviewGrid();
        updateSlotUI();
    };

    window.clearAllSlots = function () {
        const doClear = () => {
            slots = slots.map(s => ({ username: "", reactiveUrl: s.reactiveUrl, overlayUrl: s.overlayUrl }));
            saveSlots();
            renderSlots();
            renderSlotOverviewGrid();
            updateSlotUI();
            triggerSuccessAlert("Slots geleert", "Alle Spieler-Slots wurden geleert.");
        };

        triggerQuestionAlert("Slots leeren", `Möchtest du wirklich alle ${slots.length} Slots leeren?`).then((res) => {
            if (res && res.isConfirmed) doClear();
        });
    };

    // =========================================================================
    // Fragen-Manager Modal (Erstellen, Bearbeiten, Löschen)
    // =========================================================================

    window.openCardManagerModal = function () {
        renderCardManagerList();
        resetCardForm();
        openModal('cardManagerModal');
    };

    window.closeCardManagerModal = function () {
        closeModal('cardManagerModal');
    };

    function renderCardManagerList() {
        const listContainer = document.getElementById('cardManagerList');
        if (!listContainer) return;

        listContainer.innerHTML = "";

        if (!cards || cards.length === 0) {
            listContainer.innerHTML = '<p class="has-text-grey-light p-3 is-size-7">Noch keine Fragen oder Aufgaben vorhanden. Erstelle unten deine erste Frage!</p>';
            return;
        }

        cards.forEach((card, idx) => {
            const row = document.createElement('div');
            const isSelected = (idx === activeCardIndex);
            row.className = 'p-3 mb-2 is-flex is-align-items-center is-justify-content-space-between card-manager-item' + (isSelected ? ' is-selected' : '');

            const isPlaceholder = !!(card.isPlaceholder || (card.title && card.title.trim().toLowerCase() === '[platzhalter]') || card.placeholder);

            const timerBadge = (card.timer && parseInt(card.timer, 10) > 0)
                ? `<span class="tag is-small is-warning is-light ml-2"><i class="fas fa-stopwatch"></i>&nbsp;${card.timer}s</span>`
                : '';
            const imageBadge = (card.imageOnly && card.image)
                ? `<span class="tag is-small is-warning is-light ml-2"><i class="fas fa-image"></i>&nbsp;Nur Bild</span>`
                : (card.image ? `<span class="tag is-small is-dark ml-2"><i class="fas fa-image"></i></span>` : '');
            const audioBadge = (card.audio && card.audio.trim().length > 0)
                ? `<span class="tag is-small is-info is-light ml-2" title="Audio hinterlegt"><i class="fas fa-music"></i>${card.audioLoop ? '&nbsp;<i class="fas fa-redo" style="font-size:0.7em;"></i>' : ''}</span>`
                : '';
            const placeholderBadge = isPlaceholder
                ? `<span class="tag is-small is-dark has-text-warning ml-2" title="Mitte im Stream ausgeblendet"><i class="fas fa-eye-slash mr-1"></i>Platzhalter</span>`
                : '';

            const displayText = isPlaceholder
                ? (card.question ? `[Notiz: ${card.question}] (Stream-Mitte ausgeblendet)` : '(Stream-Mitte ausgeblendet)')
                : (card.question || (card.imageOnly ? '[Bild statt Fragetext]' : (card.audio ? '[Audio-Rätsel]' : '')));

            row.innerHTML = `
                <div style="flex: 1; overflow: hidden; padding-right: 12px; cursor: pointer;" onclick="selectCardFromDropdown(${idx})" title="Klicken um diese Frage als aktiv auszuwählen">
                    <strong>${idx + 1}. ${card.title || 'Kein Titel'}</strong> ${placeholderBadge} ${imageBadge} ${audioBadge} ${timerBadge}
                    <div class="is-size-7" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.8;">${displayText}</div>
                </div>
                <div class="buttons are-small mb-0" style="flex-shrink: 0;">
                    <button class="button is-info is-small" onclick="editCardInForm('${card.id}', ${idx})" title="Bearbeiten">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="button is-small" onclick="moveCard(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Nach oben">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    <button class="button is-small" onclick="moveCard(${idx}, 1)" ${idx === cards.length - 1 ? 'disabled' : ''} title="Nach unten">
                        <i class="fas fa-arrow-down"></i>
                    </button>
                    <button class="button is-danger is-small" onclick="deleteQuizCard('${card.id}', ${idx})" title="Löschen">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            listContainer.appendChild(row);
        });
    }

    function updateQuestionRequiredLabel() {
        const qLabel = document.getElementById('cardQuestionRequiredLabel');
        const qInput = document.getElementById('cardQuestionInput');
        const imageOnlyCheck = document.getElementById('cardImageOnlyInput');
        const audioVal = document.getElementById('cardAudioInput') ? document.getElementById('cardAudioInput').value.trim() : '';
        const imageVal = document.getElementById('cardImageInput') ? document.getElementById('cardImageInput').value.trim() : '';
        const isImageOnly = !!(imageOnlyCheck && imageOnlyCheck.checked);
        const hasAudio = audioVal.length > 0;
        const hasImage = imageVal.length > 0;

        if (isImageOnly) {
            if (qLabel) qLabel.textContent = "(Optional - Notiz für Host)";
            if (qInput) qInput.placeholder = "Optionale Notiz oder Frage, die der Host vorliest...";
        } else if (hasAudio || hasImage) {
            if (qLabel) qLabel.textContent = "(Optional)";
            if (qInput) qInput.placeholder = "Fragetext (optional wenn Audio oder Bild vorhanden)...";
        } else {
            if (qLabel) qLabel.textContent = "(Erforderlich)";
            if (qInput) qInput.placeholder = "Fragetext oder Aufgabe hier eingeben...";
        }
    }
    window.updateQuestionRequiredLabel = updateQuestionRequiredLabel;

    window.onToggleImageOnly = function (checked) {
        updateQuestionRequiredLabel();
    };

    window.onCardImageUrlChange = function (val) {
        const status = document.getElementById('cardImageStatus');
        if (status) {
            if (val && val.trim().length > 0) {
                status.innerHTML = `Bild-Link aktiv &bull; <a href="javascript:void(0)" onclick="removeCardImage()" class="has-text-danger ml-1"><i class="fas fa-trash-alt"></i> Entfernen</a>`;
            } else {
                status.textContent = "";
            }
        }
        updateQuestionRequiredLabel();
    };

    window.onCardAudioUrlChange = function (val) {
        const status = document.getElementById('cardAudioStatus');
        const previewBtn = document.getElementById('cardAudioPreviewBtn');
        const hasVal = !!(val && val.trim().length > 0);
        if (previewBtn) {
            previewBtn.disabled = !hasVal;
            if (!hasVal) {
                previewBtn.classList.add('is-outlined');
                previewBtn.innerHTML = '<i class="fas fa-play" id="cardAudioPreviewIcon"></i>&nbsp;Probehören';
            }
        }
        if (status) {
            if (hasVal) {
                status.innerHTML = `Audio-Link aktiv &bull; <a href="javascript:void(0)" onclick="removeCardAudio()" class="has-text-danger ml-1"><i class="fas fa-trash-alt"></i> Entfernen</a>`;
            } else {
                status.textContent = "";
            }
        }
        updateQuestionRequiredLabel();
    };

    window.editCardInForm = function (cardId, fallbackIndex) {
        let card = cards.find(c => String(c.id) === String(cardId));
        if (!card && typeof fallbackIndex === 'number' && fallbackIndex >= 0 && fallbackIndex < cards.length) {
            card = cards[fallbackIndex];
        }
        if (!card) return;

        editingCardId = card.id;
        document.getElementById('cardTitleInput').value = card.title || '';
        document.getElementById('cardQuestionInput').value = card.question || '';
        document.getElementById('cardAnswerInput').value = card.answer || '';
        document.getElementById('cardImageInput').value = card.image || '';
        document.getElementById('cardTimerInput').value = (card.timer !== null && card.timer !== undefined && card.timer !== '') ? card.timer : '';

        const audioInput = document.getElementById('cardAudioInput');
        if (audioInput) audioInput.value = card.audio || '';
        const audioLoopInput = document.getElementById('cardAudioLoopInput');
        if (audioLoopInput) audioLoopInput.checked = !!card.audioLoop;

        const audioStatus = document.getElementById('cardAudioStatus');
        const previewBtn = document.getElementById('cardAudioPreviewBtn');
        if (card.audio && card.audio.trim().length > 0) {
            if (audioStatus) audioStatus.innerHTML = `Audio vorhanden &bull; <a href="javascript:void(0)" onclick="removeCardAudio()" class="has-text-danger ml-1"><i class="fas fa-trash-alt"></i> Entfernen</a>`;
            if (previewBtn) previewBtn.disabled = false;
        } else {
            if (audioStatus) audioStatus.textContent = '';
            if (previewBtn) previewBtn.disabled = true;
        }

        const imageOnlyCheck = document.getElementById('cardImageOnlyInput');
        if (imageOnlyCheck) {
            imageOnlyCheck.checked = !!card.imageOnly;
        }

        const status = document.getElementById('cardImageStatus');
        if (status) {
            if (card.image) {
                status.innerHTML = `Bild vorhanden &bull; <a href="javascript:void(0)" onclick="removeCardImage()" class="has-text-danger ml-1"><i class="fas fa-trash-alt"></i> Entfernen</a>`;
            } else {
                status.textContent = "";
            }
        }

        updateQuestionRequiredLabel();

        document.getElementById('cardFormSubmitBtn').innerHTML = '<i class="fas fa-save"></i>&nbsp;Änderungen speichern';
        const formTitle = document.getElementById('cardFormTitle');
        if (formTitle) formTitle.textContent = "Frage #" + (cards.findIndex(c => String(c.id) === String(cardId)) + 1) + " bearbeiten";
    };

    window.removeCardImage = function () {
        const input = document.getElementById('cardImageInput');
        if (input) input.value = '';
        const fileInput = document.getElementById('cardImageFileInput');
        if (fileInput) fileInput.value = '';
        const status = document.getElementById('cardImageStatus');
        if (status) status.textContent = 'Bild entfernt.';
        updateQuestionRequiredLabel();
    };

    window.removeCardAudio = function () {
        const input = document.getElementById('cardAudioInput');
        if (input) input.value = '';
        const fileInput = document.getElementById('cardAudioFileInput');
        if (fileInput) fileInput.value = '';
        const previewPlayer = document.getElementById('cardAudioPreviewPlayer');
        if (previewPlayer) {
            previewPlayer.pause();
            previewPlayer.currentTime = 0;
            previewPlayer.src = '';
        }
        const previewBtn = document.getElementById('cardAudioPreviewBtn');
        if (previewBtn) {
            previewBtn.disabled = true;
            previewBtn.classList.add('is-outlined');
            previewBtn.innerHTML = '<i class="fas fa-play" id="cardAudioPreviewIcon"></i>&nbsp;Probehören';
        }
        const status = document.getElementById('cardAudioStatus');
        if (status) status.textContent = 'Audio entfernt.';
        updateQuestionRequiredLabel();
    };

    window.toggleCardAudioPreview = function () {
        const previewPlayer = document.getElementById('cardAudioPreviewPlayer');
        const audioInput = document.getElementById('cardAudioInput');
        const previewBtn = document.getElementById('cardAudioPreviewBtn');
        if (!previewPlayer || !audioInput) return;
        const url = audioInput.value.trim();
        if (!url) return;

        if (!previewPlayer.paused) {
            previewPlayer.pause();
            if (previewBtn) {
                previewBtn.classList.add('is-outlined');
                previewBtn.innerHTML = '<i class="fas fa-play" id="cardAudioPreviewIcon"></i>&nbsp;Probehören';
            }
        } else {
            if (previewPlayer.src !== url && !previewPlayer.src.endsWith(url)) {
                previewPlayer.src = url;
            }
            previewPlayer.play().then(() => {
                if (previewBtn) {
                    previewBtn.classList.remove('is-outlined');
                    previewBtn.innerHTML = '<i class="fas fa-pause" id="cardAudioPreviewIcon"></i>&nbsp;Pausieren';
                }
            }).catch(err => {
                console.error("Audio-Probehören fehlgeschlagen:", err);
                triggerErrorAlert("Audiofehler", "Audiodatei konnte nicht abgespielt werden. Bitte URL/Format prüfen.");
            });

            previewPlayer.onended = function () {
                if (previewBtn) {
                    previewBtn.classList.add('is-outlined');
                    previewBtn.innerHTML = '<i class="fas fa-play" id="cardAudioPreviewIcon"></i>&nbsp;Probehören';
                }
            };
        }
    };

    function resetCardForm() {
        editingCardId = null;
        const titleInput = document.getElementById('cardTitleInput');
        if (!titleInput) return;

        titleInput.value = '';
        document.getElementById('cardQuestionInput').value = '';
        document.getElementById('cardAnswerInput').value = '';
        document.getElementById('cardImageInput').value = '';
        const fileInput = document.getElementById('cardImageFileInput');
        if (fileInput) fileInput.value = '';
        const status = document.getElementById('cardImageStatus');
        if (status) status.textContent = '';
        document.getElementById('cardTimerInput').value = '';

        const audioInput = document.getElementById('cardAudioInput');
        if (audioInput) audioInput.value = '';
        const audioFileInput = document.getElementById('cardAudioFileInput');
        if (audioFileInput) audioFileInput.value = '';
        const audioLoopInput = document.getElementById('cardAudioLoopInput');
        if (audioLoopInput) audioLoopInput.checked = false;
        const audioStatus = document.getElementById('cardAudioStatus');
        if (audioStatus) audioStatus.textContent = '';
        const previewBtn = document.getElementById('cardAudioPreviewBtn');
        if (previewBtn) {
            previewBtn.disabled = true;
            previewBtn.classList.add('is-outlined');
            previewBtn.innerHTML = '<i class="fas fa-play" id="cardAudioPreviewIcon"></i>&nbsp;Probehören';
        }
        const previewPlayer = document.getElementById('cardAudioPreviewPlayer');
        if (previewPlayer) {
            previewPlayer.pause();
            previewPlayer.currentTime = 0;
            previewPlayer.src = '';
        }

        const imageOnlyCheck = document.getElementById('cardImageOnlyInput');
        if (imageOnlyCheck) {
            imageOnlyCheck.checked = false;
        }

        updateQuestionRequiredLabel();

        document.getElementById('cardFormSubmitBtn').innerHTML = '<i class="fas fa-save"></i>&nbsp;Frage speichern';
        const formTitle = document.getElementById('cardFormTitle');
        if (formTitle) formTitle.textContent = "Frage erstellen / bearbeiten";
    }

    window.addPlaceholderCard = function () {
        const newCard = {
            id: Date.now(),
            title: "[Platzhalter]",
            question: "",
            answer: "",
            image: "",
            imageOnly: false,
            audio: "",
            audioLoop: false,
            timer: null,
            isPlaceholder: true
        };
        cards.push(newCard);
        activeCardIndex = cards.length - 1;
        saveCards();
        saveActiveCardIndex();
        renderCardManagerList();
        renderMiddleCard();
        updateControlBar();
        resetCardForm();
        triggerSuccessAlert("Platzhalter hinzugefügt", "Der Platzhalter blendet das Mittelfeld auf /stream komplett aus.");
    };

    window.resetCardForm = resetCardForm;

    window.saveCardForm = function () {
        const title = document.getElementById('cardTitleInput').value.trim() || 'Quizfrage';
        const question = document.getElementById('cardQuestionInput').value.trim();
        const answer = document.getElementById('cardAnswerInput').value.trim();
        const image = document.getElementById('cardImageInput').value.trim();
        const audio = document.getElementById('cardAudioInput') ? document.getElementById('cardAudioInput').value.trim() : '';
        const audioLoop = document.getElementById('cardAudioLoopInput') ? document.getElementById('cardAudioLoopInput').checked : false;
        const timerVal = document.getElementById('cardTimerInput').value.trim();
        const timer = (timerVal && parseInt(timerVal, 10) > 0) ? parseInt(timerVal, 10) : null;
        const imageOnly = document.getElementById('cardImageOnlyInput') ? document.getElementById('cardImageOnlyInput').checked : false;
        const isPlaceholder = (title.trim().toLowerCase() === '[platzhalter]');

        if (imageOnly && !image) {
            triggerErrorAlert("Bild fehlt", "Bitte wähle ein Bild aus (oder trage eine Bild-URL ein), da 'Bild statt Frage anzeigen' aktiviert ist.");
            return;
        }

        if (!isPlaceholder && !imageOnly && !question && !image && !audio) {
            triggerErrorAlert("Fehlende Eingabe", "Bitte gib einen Fragetext ein oder hinterlege ein Bild bzw. eine Audiodatei.");
            return;
        }

        if (editingCardId) {
            const card = cards.find(c => String(c.id) === String(editingCardId));
            if (card) {
                card.title = title;
                card.question = question;
                card.answer = answer;
                card.image = image;
                card.imageOnly = imageOnly;
                card.audio = audio;
                card.audioLoop = audioLoop;
                card.timer = timer;
                if (isPlaceholder) card.isPlaceholder = true;
            }
        } else {
            const newCard = {
                id: Date.now(),
                title: title,
                question: question,
                answer: answer,
                image: image,
                imageOnly: imageOnly,
                audio: audio,
                audioLoop: audioLoop,
                timer: timer,
                isPlaceholder: isPlaceholder
            };
            cards.push(newCard);
        }

        saveCards();
        renderCardManagerList();
        renderMiddleCard();
        updateControlBar();
        resetCardForm();
        triggerSuccessAlert("Gespeichert", "Frage/Aufgabe erfolgreich gespeichert.");
    };

    window.deleteQuizCard = function (cardId, fallbackIndex) {
        const doDelete = () => {
            let deleted = false;
            if (cardId !== undefined && cardId !== null && cardId !== 'undefined') {
                const beforeLen = cards.length;
                cards = cards.filter(c => String(c.id) !== String(cardId));
                if (cards.length < beforeLen) {
                    deleted = true;
                }
            }
            if (!deleted && typeof fallbackIndex === 'number' && fallbackIndex >= 0 && fallbackIndex < cards.length) {
                cards.splice(fallbackIndex, 1);
                deleted = true;
            }
            if (!deleted && cards.length > 0) {
                const idx = (typeof fallbackIndex === 'number') ? fallbackIndex : activeCardIndex;
                if (idx >= 0 && idx < cards.length) {
                    cards.splice(idx, 1);
                }
            }
            if (String(editingCardId) === String(cardId)) {
                resetCardForm();
            }
            activeCardIndex = Math.max(0, Math.min(activeCardIndex, cards.length - 1));
            saveCards();
            saveActiveCardIndex();
            renderCardManagerList();
            renderMiddleCard();
            updateControlBar();
            triggerSuccessAlert("Gelöscht", "Der Eintrag wurde entfernt.");
        };

        triggerQuestionAlert("Löschen bestätigen", "Möchtest du diese Frage bzw. diesen Platzhalter wirklich löschen?").then((result) => {
            if (result && result.isConfirmed) {
                doDelete();
            }
        });
    };
    window.deleteCard = window.deleteQuizCard;

    window.moveCard = function (index, direction) {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= cards.length) return;

        const temp = cards[index];
        cards[index] = cards[targetIndex];
        cards[targetIndex] = temp;

        if (activeCardIndex === index) {
            activeCardIndex = targetIndex;
        } else if (activeCardIndex === targetIndex) {
            activeCardIndex = index;
        }

        saveCards();
        saveActiveCardIndex();
        renderCardManagerList();
        renderMiddleCard();
        updateControlBar();
    };

    window.uploadCardImage = async function (fileInput) {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const formData = new FormData();
        formData.append("file", fileInput.files[0]);

        const status = document.getElementById('cardImageStatus');
        if (status) status.textContent = "Wird hochgeladen...";

        try {
            const res = await fetch("/upload", { method: "POST", body: formData });
            if (!res.ok) {
                if (res.status === 413) {
                    throw new Error("Die Bilddatei ist zu groß für den Webserver (Nginx/Server-Limit überschritten).");
                }
                const text = await res.text();
                let errJson;
                try { errJson = JSON.parse(text); } catch (e) {}
                throw new Error((errJson && errJson.error) || `Serverfehler beim Upload (HTTP ${res.status})`);
            }
            const data = await res.json();
            if (data.url) {
                document.getElementById('cardImageInput').value = data.url;
                if (status) {
                    status.innerHTML = `Bild hochgeladen &bull; <a href="javascript:void(0)" onclick="removeCardImage()" class="has-text-danger ml-1"><i class="fas fa-trash-alt"></i> Entfernen</a>`;
                }
                updateQuestionRequiredLabel();
            } else {
                if (status) status.textContent = "Upload fehlgeschlagen.";
            }
        } catch (err) {
            console.error("Fehler beim Hochladen:", err);
            if (status) status.textContent = "Fehler beim Upload.";
            triggerErrorAlert("Upload-Fehler", err.message || "Fehler beim Hochladen des Bildes.");
        }
    };

    window.uploadCardAudio = async function (fileInput) {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const formData = new FormData();
        formData.append("file", fileInput.files[0]);

        const status = document.getElementById('cardAudioStatus');
        if (status) status.textContent = "Wird hochgeladen...";

        try {
            const res = await fetch("/upload", { method: "POST", body: formData });
            if (!res.ok) {
                if (res.status === 413) {
                    throw new Error("Die Audiodatei ist zu groß für den Webserver (Nginx client_max_body_size überschritten).");
                }
                const text = await res.text();
                let errJson;
                try { errJson = JSON.parse(text); } catch (e) {}
                throw new Error((errJson && errJson.error) || `Serverfehler beim Upload (HTTP ${res.status})`);
            }
            const data = await res.json();
            if (data.url) {
                const input = document.getElementById('cardAudioInput');
                if (input) input.value = data.url;
                const previewBtn = document.getElementById('cardAudioPreviewBtn');
                if (previewBtn) previewBtn.disabled = false;
                if (status) {
                    status.innerHTML = `Audio hochgeladen &bull; <a href="javascript:void(0)" onclick="removeCardAudio()" class="has-text-danger ml-1"><i class="fas fa-trash-alt"></i> Entfernen</a>`;
                }
                updateQuestionRequiredLabel();
            } else {
                if (status) status.textContent = "Upload fehlgeschlagen.";
            }
        } catch (err) {
            console.error("Fehler beim Hochladen:", err);
            if (status) status.textContent = "Fehler beim Upload.";
            triggerErrorAlert("Upload-Fehler", err.message || "Fehler beim Hochladen der Audiodatei.");
        }
    };

    // =========================================================================
    // Import & Export System
    // =========================================================================

    window.exportQuizPackage = function () {
        function triggerDownload(includeSlots) {
            const exportData = {
                version: "1.0",
                exportedAt: new Date().toISOString(),
                cards: cards
            };
            if (includeSlots) {
                exportData.slots = slots;
            }

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
            const downloadAnchor = document.createElement('a');
            const today = new Date().toISOString().slice(0, 10);
            const fileName = includeSlots ? `kurobuzz_quiz_mit_slots_${today}.json` : `kurobuzz_quiz_${today}.json`;
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", fileName);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();

            const msg = includeSlots
                ? "Fragen sowie Stream-Slots & Links wurden erfolgreich exportiert!"
                : "Fragen wurden erfolgreich (ohne Slots) exportiert!";
            triggerSuccessAlert("Export erfolgreich", msg);
        }

        if (window.Swal) {
            Swal.fire({
                title: "Quiz exportieren",
                text: "Möchtest du die Stream-Slots (Spielerzuweisungen, Kamera- und Overlay-Links) mit in die Datei exportieren?",
                icon: "question",
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: "Mit Slots & Links",
                denyButtonText: "Nur Fragen",
                cancelButtonText: "Abbrechen",
                confirmButtonColor: "#485fc7",
                denyButtonColor: "#3e8ed0",
                cancelButtonColor: "#363645",
                background: "#1a1a28",
                color: "#f5f5f7"
            }).then((res) => {
                if (res.isConfirmed) {
                    triggerDownload(true);
                } else if (res.isDenied) {
                    triggerDownload(false);
                }
            });
        } else {
            triggerDownload(false);
        }
    };

    window.importQuizPackage = function (fileInput) {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const importedData = JSON.parse(e.target.result);

                const importedCards = Array.isArray(importedData.cards) ? importedData.cards : (Array.isArray(importedData) ? importedData : null);
                if (!importedCards || importedCards.length === 0) {
                    triggerErrorAlert("Ungültige Datei", "Die Datei enthält keine gültigen Fragen.");
                    fileInput.value = "";
                    return;
                }

                // Sicherstellen, dass jede importierte Karte eine eindeutige ID besitzt
                importedCards.forEach((c, idx) => {
                    if (!c.id) c.id = Date.now() + idx;
                });

                function checkAndPromptSlots() {
                    if (Array.isArray(importedData.slots) && importedData.slots.length >= 1 && importedData.slots.length <= 8) {
                        const hasConfiguredSlots = importedData.slots.some(s => (s.username && s.username.trim()) || (s.reactiveUrl && s.reactiveUrl.trim()) || (s.overlayUrl && s.overlayUrl.trim()));
                        if (hasConfiguredSlots && window.Swal) {
                            Swal.fire({
                                title: "Stream-Slots importieren?",
                                text: "Die importierte Datei enthält auch gespeicherte Stream-Slots und Kamera-/Overlay-Links. Möchtest du diese ebenfalls übernehmen?",
                                icon: "question",
                                showCancelButton: true,
                                confirmButtonText: "Slots übernehmen",
                                cancelButtonText: "Bestehende Slots behalten",
                                confirmButtonColor: "#485fc7",
                                cancelButtonColor: "#363645",
                                background: "#1a1a28",
                                color: "#f5f5f7"
                            }).then((slotRes) => {
                                if (slotRes.isConfirmed) {
                                    slots = importedData.slots;
                                    saveSlots();
                                    renderSlots();
                                    renderSlotOverviewGrid();
                                    updateSlotUI();
                                }
                            });
                        }
                    }
                }

                if (window.Swal) {
                    Swal.fire({
                        title: "Import-Option wählen",
                        text: `Die Datei enthält ${importedCards.length} Fragen. Möchtest du die aktuellen Fragen ersetzen oder die neuen Fragen hinten anhängen?`,
                        icon: "question",
                        showCancelButton: true,
                        showDenyButton: true,
                        confirmButtonText: "Komplett ersetzen",
                        denyButtonText: "Fragen anhängen",
                        cancelButtonText: "Abbrechen",
                        confirmButtonColor: "#485fc7",
                        denyButtonColor: "#3e8ed0",
                        cancelButtonColor: "#363645",
                        background: "#1a1a28",
                        color: "#f5f5f7"
                    }).then((result) => {
                        if (result.isConfirmed) {
                            cards = importedCards;
                            activeCardIndex = 0;
                            saveCards();
                            saveActiveCardIndex();
                            renderCardManagerList();
                            renderMiddleCard();
                            updateControlBar();
                            if (window.ShowSuccessAlert) ShowSuccessAlert("Erfolgreich", "Quiz-Paket wurde vollständig geladen!");
                            checkAndPromptSlots();
                        } else if (result.isDenied) {
                            const maxId = cards.reduce((max, c) => Math.max(max, c.id || 0), 0);
                            importedCards.forEach((c, idx) => {
                                cards.push({
                                    ...c,
                                    id: maxId + idx + 1
                                });
                            });
                            saveCards();
                            renderCardManagerList();
                            renderMiddleCard();
                            updateControlBar();
                            if (window.ShowSuccessAlert) ShowSuccessAlert("Erfolgreich", `${importedCards.length} Fragen wurden angehängt!`);
                        }
                        fileInput.value = "";
                    });
                } else {
                    cards = importedCards;
                    saveCards();
                    saveActiveCardIndex();
                    renderCardManagerList();
                    renderMiddleCard();
                    updateControlBar();
                    fileInput.value = "";
                    triggerSuccessAlert("Erfolgreich", "Import erfolgreich abgeschlossen!");
                }
            } catch (err) {
                console.error("Fehler beim Importieren:", err);
                triggerErrorAlert("Import-Fehler", "Fehler beim Lesen der Datei. Bitte stelle sicher, dass es eine gültige JSON-Datei ist.");
                fileInput.value = "";
            }
        };

        reader.readAsText(file);
    };

    // =========================================================================
    // Socket.IO Events & Spielerliste
    // =========================================================================

    async function fetchRoomPlayers() {
        if (!activeRoomId || activeRoomId === 'None') return;
        try {
            const res = await fetch('/get_rooms');
            const allRooms = await res.json();

            if (allRooms && allRooms[activeRoomId] && allRooms[activeRoomId].players) {
                roomPlayers = allRooms[activeRoomId].players;
                updateSlotPointsUI();
                renderSlotOverviewGrid();
            }

            if (isStreamPage) {
                const actualHost = (allRooms && allRooms[activeRoomId] && allRooms[activeRoomId].host)
                    ? allRooms[activeRoomId].host
                    : (window.CURRENT_USERNAME || "Host");

                socket.emit('join_room', { roomID: activeRoomId, host: actualHost });
                broadcastSync({ type: 'request_sync' });
            }
        } catch (err) {
            console.error("Fehler beim Abrufen des Raum-Status:", err);
            if (isStreamPage && activeRoomId) {
                socket.emit('join_room', { roomID: activeRoomId, host: window.CURRENT_USERNAME || "Host" });
            }
        }
    }

    function updateSlotPointsUI() {
        slots.forEach((s, idx) => {
            if (s.username && roomPlayers[s.username]) {
                const pElem = document.getElementById(`slotPoints_${idx}`);
                if (pElem) {
                    pElem.textContent = `${roomPlayers[s.username].points} Pkt`;
                }
            }
        });
    }

    socket.on('connect', function () {
        if (activeRoomId && activeRoomId !== 'None') {
            fetchRoomPlayers();
        }
    });

    socket.on('stream_sync', function (data) {
        handleSyncMessage(data);
    });

    socket.on('playerList', function (data) {
        if (data && data.players) {
            roomPlayers = data.players;
            updateSlotPointsUI();
            renderSlotOverviewGrid();
        }
    });

    socket.on('buzzer', function (data) {
        const buzzedUser = data.username;
        const order = data.buzzerOrder;

        // Automatisch Audio bei Buzzer pausieren (damit die Antwort verstanden wird)
        const hostPlayer = document.getElementById('hostAudioPlayer');
        if (hostPlayer && !hostPlayer.paused) {
            hostPlayer.pause();
            if (typeof updateHostAudioButtons === 'function') updateHostAudioButtons(false);
        }
        setStreamAudioVisualState('paused');

        slots.forEach((s, idx) => {
            if (s.username === buzzedUser) {
                const cell = document.getElementById(`streamSlot_${idx}`);
                if (cell) cell.classList.add('slot-buzzed');
                // Auf /stream soll die Zahl verschwinden und nur der Rahmen grün leuchten
                const badge = document.getElementById(`buzzerBadge_${idx}`);
                if (badge) {
                    badge.textContent = '';
                    badge.classList.add('is-hidden');
                }
            }
        });
    });

    socket.on('playAudio', function (data) {
        if (!data || !data.audioUrl) return;

        // Host Player (auf host.html)
        const hostPlayer = document.getElementById('hostAudioPlayer');
        if (hostPlayer) {
            if (hostPlayer.src !== data.audioUrl && !hostPlayer.src.endsWith(data.audioUrl)) {
                hostPlayer.src = data.audioUrl;
            }
            if (typeof data.seekTime === 'number' && Math.abs(hostPlayer.currentTime - data.seekTime) > 1.5) {
                hostPlayer.currentTime = data.seekTime;
            }
            hostPlayer.loop = !!data.loop;
            hostPlayer.play().then(() => {
                if (typeof updateHostAudioButtons === 'function') updateHostAudioButtons(true);
            }).catch(err => {
                console.log("Host Audio Autoplay blockiert oder nicht gestartet:", err);
            });
        }

        // Stream Seite: Audio wird im stummen AudioContext für die Frequenzanalyse analysiert
        setStreamAudioVisualState('playing', data);
    });

    socket.on('pauseAudio', function () {
        const hostPlayer = document.getElementById('hostAudioPlayer');
        if (hostPlayer) {
            hostPlayer.pause();
            if (typeof updateHostAudioButtons === 'function') updateHostAudioButtons(false);
        }
        setStreamAudioVisualState('paused');
    });

    socket.on('stopAudio', function () {
        const hostPlayer = document.getElementById('hostAudioPlayer');
        if (hostPlayer) {
            hostPlayer.pause();
            hostPlayer.currentTime = 0;
            if (typeof updateHostAudioButtons === 'function') updateHostAudioButtons(false);
        }
        setStreamAudioVisualState('stopped');
    });

    socket.on('seekAudio', function (data) {
        const streamAudio = document.getElementById('streamQuestionAudio');
        if (data && typeof data.seekTime === 'number') {
            if (streamAudio) {
                try { streamAudio.currentTime = data.seekTime; } catch (e) {}
            }
            streamVisualizerPlaybackTime = data.seekTime;
        }
    });

    socket.on('streamAudioVisual', function (data) {
        if (!data || !data.state) return;
        setStreamAudioVisualState(data.state, data);
    });

    socket.on('streamAudioLevels', function (data) {
        if (data && Array.isArray(data.levels) && data.levels.length === 5) {
            lastReceivedAudioLevels = data.levels;
            lastReceivedAudioLevelsTime = performance.now();
        }
    });

    function resetSlotBorders() {
        slots.forEach((_, idx) => {
            const cell = document.getElementById(`streamSlot_${idx}`);
            if (cell) {
                cell.classList.remove('slot-buzzed');
                cell.classList.remove('slot-submitted');
            }
            const badge = document.getElementById(`buzzerBadge_${idx}`);
            if (badge) {
                badge.textContent = '';
                badge.classList.add('is-hidden');
            }
        });
    }

    socket.on('buzzerReset', function () {
        slots.forEach((_, idx) => {
            const cell = document.getElementById(`streamSlot_${idx}`);
            if (cell) cell.classList.remove('slot-buzzed');
            const badge = document.getElementById(`buzzerBadge_${idx}`);
            if (badge) {
                badge.textContent = '';
                badge.classList.add('is-hidden');
            }
        });
    });

    socket.on('submitAnswer', function (data) {
        const username = data.username;
        slots.forEach((s, idx) => {
            if (s.username === username) {
                const cell = document.getElementById(`streamSlot_${idx}`);
                if (cell) cell.classList.add('slot-submitted');
            }
        });
    });

    socket.on('clearText', function () {
        resetSlotBorders();
        lastSentCardId = null;
        if (typeof window.hostStopAudio === 'function') {
            window.hostStopAudio();
        }
        updateAudioSentHint();
    });

    socket.on('answerInputToggle', function (data) {
        if (data && data.answerInput === false) {
            slots.forEach((_, idx) => {
                const cell = document.getElementById(`streamSlot_${idx}`);
                if (cell) cell.classList.remove('slot-submitted');
            });
        }
    });

    socket.on('sendQuestion', function () {
        resetSlotBorders();
    });

    function handleTimerSync(data) {
        if (!data) return;
        const duration = parseInt(data.duration || data.timer, 10);
        if (isNaN(duration) || duration <= 0) return;

        const badge = document.getElementById('quizCardTimerBadge');
        const timerText = document.getElementById('quizCardTimerText');
        if (!badge && !timerText) return;

        let endTime;
        if (typeof data.endTime === 'number' && data.endTime > Date.now()) {
            endTime = data.endTime;
        } else {
            endTime = Date.now() + duration * 1000;
        }

        if (timerHideTimeout) {
            clearTimeout(timerHideTimeout);
            timerHideTimeout = null;
        }

        activeStreamTimer = {
            duration: duration,
            endTime: endTime
        };

        if (activeRoomId && activeRoomId !== 'None') {
            try {
                localStorage.setItem('kurobuzz_active_timer_' + activeRoomId, JSON.stringify(activeStreamTimer));
            } catch (e) {}
        }

        if (timerCountdownInterval) {
            clearInterval(timerCountdownInterval);
            timerCountdownInterval = null;
        }

        function updateTimerDOM() {
            const timeLeft = endTime - Date.now();

            if (timeLeft <= 0) {
                if (timerCountdownInterval) {
                    clearInterval(timerCountdownInterval);
                    timerCountdownInterval = null;
                }
                activeStreamTimer = null;
                if (activeRoomId && activeRoomId !== 'None') {
                    try { localStorage.removeItem('kurobuzz_active_timer_' + activeRoomId); } catch (e) {}
                }
                if (timerText) {
                    timerText.textContent = (duration >= 60) ? "00:00" : "0s";
                }
                if (timerHideTimeout) clearTimeout(timerHideTimeout);
                timerHideTimeout = setTimeout(() => {
                    timerHideTimeout = null;
                    if (!activeStreamTimer && badge) {
                        badge.classList.add('unsichtbar');
                    }
                }, 1500);
                return;
            }

            if (badge) badge.classList.remove('unsichtbar');

            const totalSeconds = Math.max(0, Math.floor(timeLeft / 1000));
            const mins = Math.floor(totalSeconds / 60);
            const secs = totalSeconds % 60;

            const formattedMS = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

            if (timerText) {
                if (duration >= 60) {
                    timerText.textContent = formattedMS;
                } else {
                    timerText.textContent = `${totalSeconds}s`;
                }
            }
        }

        updateTimerDOM();
        timerCountdownInterval = setInterval(updateTimerDOM, 200);
    }
    window.handleTimerSync = handleTimerSync;

    socket.on('timer', function (data) {
        handleTimerSync(data);
    });

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && activeStreamTimer && activeStreamTimer.endTime > Date.now()) {
            handleTimerSync(activeStreamTimer);
        }
    });

    // =========================================================================
    // Tastatur-Shortcuts
    // =========================================================================

    document.addEventListener('keydown', function (e) {
        // Escape: Schließt zunächst offene Modals; falls kein Modal offen ist, schließt es den Drawer oder verkleinert die Vollbild-Karte
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.is-active');
            if (activeModal) {
                closeModal('cardManagerModal');
                closeModal('slotAssignModal');
                closeModal('slotOverviewModal');
                return;
            }
            const drawer = document.getElementById('controlDrawer');
            if (drawer && drawer.classList.contains('is-open')) {
                e.preventDefault();
                window.closeControlDrawer();
                return;
            }
            if (isCardFullscreen) {
                e.preventDefault();
                shrinkQuizCard();
                return;
            }
            return;
        }

        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
            return;
        }

        // Wenn ein Modal geöffnet ist, keine Karten im Hintergrund wechseln
        const isModalActive = document.querySelector('.modal.is-active');
        if (isModalActive) {
            return;
        }

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            nextCard();
        }

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            prevCard();
        }
    });

    // =========================================================================
    // Initialisierung
    // =========================================================================

    document.addEventListener('DOMContentLoaded', function () {
        initHostAudioPlayer();
        if (activeRoomId && activeRoomId !== 'None') {
            window.initStreamRoom(activeRoomId);
        } else {
            renderMiddleCard();
            updateControlBar();
            renderSlots();
            renderSlotOverviewGrid();
        }
    });

})();
