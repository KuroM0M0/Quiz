window.StreamApp = window.StreamApp || {
    state: {
        isStreamPage: !!document.getElementById('streamGrid'),
        activeRoomId: '',
        roomPlayers: {},
        isCardFullscreen: false,
        shrinkTimeout: null,
        timerCountdownInterval: null,
        activeStreamTimer: null,
        timerHideTimeout: null,
        currentEditingSlotIndex: null,
        editingCardId: null,
        insertTargetIndex: null,
        slots: [],
        cards: [],
        activeCardIndex: 0,
        isMiddleCardHidden: false,
        lastSentCardId: null
    }
};

(function (S) {
    let syncChannel = null;

    // Auf der /stream Seite sind sämtliche Sounds komplett deaktiviert und stummgeschaltet
    if (S.state.isStreamPage) {
        try {
            const origPlay = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function () {
                this.muted = true;
                this.volume = 0;
                return origPlay.apply(this, arguments);
            };
        } catch (e) {}

        const initialStreamAudio = document.getElementById('streamQuestionAudio');
        if (initialStreamAudio) {
            initialStreamAudio.muted = true;
            initialStreamAudio.volume = 0;
        }
    }

    S.state.activeRoomId = window.STREAM_ROOM_ID || (S.state.isStreamPage ? (window.location.pathname.split('/')[1] || '') : '');

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

    // Universelle Erkennung von Platzhalter-Karten (Mitte im Stream ausgeblendet)
    function isCardPlaceholder(card) {
        if (!card) return false;
        if (card.isPlaceholder || card.placeholder || card.is_placeholder) return true;
        if (typeof card.title === 'string') {
            const cleanTitle = card.title.trim().toLowerCase();
            if (cleanTitle === '[platzhalter]' || cleanTitle === 'platzhalter' || cleanTitle.includes('platzhalter') || cleanTitle.includes('[placeholder]') || cleanTitle.includes('placeholder')) {
                return true;
            }
        }
        return false;
    }

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
                    S.state.slots = parsed;
                } else if (Array.isArray(parsed) && parsed.length > 8) {
                    S.state.slots = parsed.slice(0, 8);
                } else {
                    S.state.slots = createEmptySlots(8);
                }
            } else {
                S.state.slots = createEmptySlots(8);
            }
        } catch (e) {
            console.error("Fehler beim Laden der Slots:", e);
            S.state.slots = createEmptySlots(8);
        }

        // Fragenliste laden
        try {
            const savedCards = localStorage.getItem('kurobuzz_cards_' + rId);
            if (savedCards) {
                const parsedCards = JSON.parse(savedCards);
                S.state.cards = Array.isArray(parsedCards) ? parsedCards : [];
            } else {
                S.state.cards = [];
            }
        } catch (e) {
            console.error("Fehler beim Laden der Karten:", e);
            S.state.cards = [];
        }

        // Wenn im Speicher noch die alten 3 Standardfragen liegen, diese entfernen
        if (Array.isArray(S.state.cards)) {
            const isOldDefault = S.state.cards.length === 3 &&
                S.state.cards[0] && S.state.cards[0].title === "Gaming Quiz 2026" &&
                S.state.cards[1] && S.state.cards[1].title === "Runde 1: Retro Gaming" &&
                S.state.cards[2] && S.state.cards[2].title === "Runde 2: Sound & Musik";
            if (isOldDefault) {
                S.state.cards = [];
                localStorage.setItem('kurobuzz_cards_' + rId, JSON.stringify(S.state.cards));
            } else {
                // Sicherstellen, dass jede Karte eine eindeutige ID besitzt
                S.state.cards.forEach((c, idx) => {
                    if (!c.id) c.id = Date.now() + idx;
                });
            }
        }

        // Aktiver Karten-Index
        try {
            const savedIndex = localStorage.getItem('kurobuzz_active_card_' + rId);
            if (savedIndex !== null) {
                S.state.activeCardIndex = parseInt(savedIndex, 10);
                if (isNaN(S.state.activeCardIndex) || S.state.activeCardIndex < 0 || (S.state.cards.length > 0 && S.state.activeCardIndex >= S.state.cards.length)) {
                    S.state.activeCardIndex = 0;
                }
            } else {
                S.state.activeCardIndex = 0;
            }
        } catch (e) {
            S.state.activeCardIndex = 0;
        }

        // Status der Mittelkarte (ein- oder ausgeblendet)
        try {
            S.state.isMiddleCardHidden = (localStorage.getItem('kurobuzz_card_hidden_' + rId) === 'true');
        } catch (e) {
            S.state.isMiddleCardHidden = false;
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
        const changed = (S.state.activeRoomId !== newRoomId);
        S.state.activeRoomId = newRoomId;
        window.STREAM_ROOM_ID = newRoomId;

        const drawerRoomElem = document.getElementById('drawerRoomID');
        if (drawerRoomElem) drawerRoomElem.textContent = newRoomId;

        setupSyncChannel(S.state.activeRoomId);
        loadRoomState(S.state.activeRoomId);

        S.renderMiddleCard();
        S.updateControlBar();
        S.updateMiddleCardToggleBtn();
        S.renderSlots();
        S.renderSlotOverviewGrid();
        S.updateSlotUI();

        if (changed) {
            fetchRoomPlayers();
        }
    };

    // =========================================================================
    // Speichern & Synchronisieren (localStorage + BroadcastChannel + Socket.IO)
    // =========================================================================

    function broadcastSync(payload) {
        if (!S.state.activeRoomId || S.state.activeRoomId === 'None') return;
        const msg = { ...payload, roomID: S.state.activeRoomId };
        if (syncChannel) {
            try { syncChannel.postMessage(msg); } catch (e) {}
        }
        if (typeof socket !== 'undefined' && socket && socket.connected) {
            socket.emit('stream_sync', msg);
        }
    }

    function saveSlots() {
        if (!S.state.activeRoomId || S.state.activeRoomId === 'None') {
            S.state.activeRoomId = window.STREAM_ROOM_ID || (typeof roomID !== 'undefined' && roomID !== 'None' ? roomID : '');
        }
        if (!S.state.activeRoomId || S.state.activeRoomId === 'None') return;
        localStorage.setItem('kurobuzz_slots_' + S.state.activeRoomId, JSON.stringify(S.state.slots));
        broadcastSync({ type: 'slots_updated', slots: S.state.slots });
    }

    function saveCards() {
        if (!S.state.activeRoomId || S.state.activeRoomId === 'None') {
            S.state.activeRoomId = window.STREAM_ROOM_ID || (typeof roomID !== 'undefined' && roomID !== 'None' ? roomID : '');
        }
        if (!S.state.activeRoomId || S.state.activeRoomId === 'None') return;
        localStorage.setItem('kurobuzz_cards_' + S.state.activeRoomId, JSON.stringify(S.state.cards));
        broadcastSync({ type: 'cards_updated', cards: S.state.cards });
    }

    function saveActiveCardIndex() {
        if (!S.state.activeRoomId || S.state.activeRoomId === 'None') {
            S.state.activeRoomId = window.STREAM_ROOM_ID || (typeof roomID !== 'undefined' && roomID !== 'None' ? roomID : '');
        }
        if (!S.state.activeRoomId || S.state.activeRoomId === 'None') return;
        localStorage.setItem('kurobuzz_active_card_' + S.state.activeRoomId, S.state.activeCardIndex);
        broadcastSync({ type: 'active_card_updated', activeCardIndex: S.state.activeCardIndex });
    }

    function handleSyncMessage(msg) {
        if (!msg) return;
        if (msg.roomID && S.state.activeRoomId && msg.roomID !== S.state.activeRoomId) return;

        if (msg.type === 'slots_updated' && Array.isArray(msg.slots)) {
            S.state.slots = msg.slots.slice(0, 8);
            if (S.state.activeRoomId) localStorage.setItem('kurobuzz_slots_' + S.state.activeRoomId, JSON.stringify(S.state.slots));
            S.renderSlots();
            S.renderSlotOverviewGrid();
            S.updateSlotUI();
        } else if (msg.type === 'cards_updated' && Array.isArray(msg.cards)) {
            S.state.cards = msg.cards;
            if (S.state.activeRoomId) localStorage.setItem('kurobuzz_cards_' + S.state.activeRoomId, JSON.stringify(S.state.cards));
            if (S.state.activeCardIndex >= S.state.cards.length) {
                S.state.activeCardIndex = Math.max(0, S.state.cards.length - 1);
            }
            S.renderMiddleCard();
            S.updateControlBar();
            S.renderCardManagerList();
        } else if (msg.type === 'active_card_updated' && typeof msg.activeCardIndex === 'number') {
            S.state.activeCardIndex = msg.activeCardIndex;
            if (S.state.activeRoomId) localStorage.setItem('kurobuzz_active_card_' + S.state.activeRoomId, S.state.activeCardIndex);
            S.renderMiddleCard();
            S.updateControlBar();
            S.renderCardManagerList();
        } else if (msg.type === 'middle_card_hidden_updated') {
            S.state.isMiddleCardHidden = !!msg.isHidden;
            if (S.state.activeRoomId && S.state.activeRoomId !== 'None') {
                try {
                    localStorage.setItem('kurobuzz_card_hidden_' + S.state.activeRoomId, S.state.isMiddleCardHidden ? 'true' : 'false');
                } catch (e) {}
            }
            S.applyMiddleCardDOM();
            S.updateMiddleCardToggleBtn();
        } else if (msg.type === 'toggle_fullscreen') {
            if (typeof window.toggleQuizCardFullscreen === 'function') {
                window.toggleQuizCardFullscreen();
            }
        } else if (msg.type === 'stream_audio_visual') {
            S.setStreamAudioVisualState(msg.state, msg);
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
        } else if (msg.type === 'request_sync' && !S.state.isStreamPage) {
            // Host antwortet einem neu geöffneten Stream-Fenster (z. B. in OBS) mit dem aktuellen Stand
            broadcastSync({
                type: 'full_sync',
                slots: S.state.slots,
                cards: S.state.cards,
                activeCardIndex: S.state.activeCardIndex,
                isMiddleCardHidden: S.state.isMiddleCardHidden,
                activeTimer: (S.state.activeStreamTimer && S.state.activeStreamTimer.endTime > Date.now()) ? S.state.activeStreamTimer : null
            });
        } else if (msg.type === 'full_sync') {
            if (Array.isArray(msg.slots) && msg.slots.length >= 1 && msg.slots.length <= 8) {
                S.state.slots = msg.slots;
                if (S.state.activeRoomId) localStorage.setItem('kurobuzz_slots_' + S.state.activeRoomId, JSON.stringify(S.state.slots));
                S.renderSlots();
                S.renderSlotOverviewGrid();
                S.updateSlotUI();
            }
            if (Array.isArray(msg.cards)) {
                S.state.cards = msg.cards;
                if (S.state.activeRoomId) localStorage.setItem('kurobuzz_cards_' + S.state.activeRoomId, JSON.stringify(S.state.cards));
            }
            if (typeof msg.activeCardIndex === 'number') {
                S.state.activeCardIndex = msg.activeCardIndex;
                if (S.state.activeRoomId) localStorage.setItem('kurobuzz_active_card_' + S.state.activeRoomId, S.state.activeCardIndex);
            }
            if (typeof msg.isMiddleCardHidden === 'boolean') {
                S.state.isMiddleCardHidden = msg.isMiddleCardHidden;
                if (S.state.activeRoomId && S.state.activeRoomId !== 'None') {
                    try {
                        localStorage.setItem('kurobuzz_card_hidden_' + S.state.activeRoomId, S.state.isMiddleCardHidden ? 'true' : 'false');
                    } catch (e) {}
                }
            }
            if (msg.activeTimer && typeof msg.activeTimer.endTime === 'number' && msg.activeTimer.endTime > Date.now()) {
                handleTimerSync(msg.activeTimer);
            }
            S.renderMiddleCard();
            S.updateControlBar();
            S.updateMiddleCardToggleBtn();
        }
    }

    // Fallback: storage-Event zwischen Browser-Tabs
    window.addEventListener('storage', function (ev) {
        if (!S.state.activeRoomId || !ev.key) return;
        if (ev.key === 'kurobuzz_slots_' + S.state.activeRoomId && ev.newValue) {
            try {
                const parsed = JSON.parse(ev.newValue);
                if (Array.isArray(parsed) && parsed.length >= 1 && parsed.length <= 8) {
                    S.state.slots = parsed;
                    S.renderSlots();
                    S.renderSlotOverviewGrid();
                    S.updateSlotUI();
                }
            } catch (e) {}
        } else if (ev.key === 'kurobuzz_cards_' + S.state.activeRoomId && ev.newValue) {
            try {
                S.state.cards = JSON.parse(ev.newValue);
                S.renderMiddleCard();
                S.updateControlBar();
                S.renderCardManagerList();
            } catch (e) {}
        } else if (ev.key === 'kurobuzz_active_card_' + S.state.activeRoomId && ev.newValue !== null) {
            const parsed = parseInt(ev.newValue, 10);
            if (!isNaN(parsed)) {
                S.state.activeCardIndex = parsed;
                S.renderMiddleCard();
                S.updateControlBar();
                S.renderCardManagerList();
            }
        } else if (ev.key === 'kurobuzz_card_hidden_' + S.state.activeRoomId && ev.newValue !== null) {
            S.state.isMiddleCardHidden = (ev.newValue === 'true');
            S.applyMiddleCardDOM();
            S.updateMiddleCardToggleBtn();
        } else if (ev.key === 'kurobuzz_active_timer_' + S.state.activeRoomId) {
            if (ev.newValue) {
                try {
                    const parsed = JSON.parse(ev.newValue);
                    if (parsed && typeof parsed.endTime === 'number' && parsed.endTime > Date.now()) {
                        handleTimerSync(parsed);
                    }
                } catch (e) {}
            } else {
                if (S.state.timerCountdownInterval) {
                    clearInterval(S.state.timerCountdownInterval);
                    S.state.timerCountdownInterval = null;
                }
                S.state.activeStreamTimer = null;
                const badge = document.getElementById('quizCardTimerBadge');
                if (badge) badge.classList.add('unsichtbar');
            }
        }
    });


    // =========================================================================
    // Socket.IO Events & Spielerliste
    // =========================================================================

    async function fetchRoomPlayers() {
        if (!S.state.activeRoomId || S.state.activeRoomId === 'None') return;
        try {
            const res = await fetch('/get_rooms');
            const allRooms = await res.json();

            if (allRooms && allRooms[S.state.activeRoomId] && allRooms[S.state.activeRoomId].players) {
                S.state.roomPlayers = allRooms[S.state.activeRoomId].players;
                updateSlotPointsUI();
                S.renderSlotOverviewGrid();
            }

            if (S.state.isStreamPage) {
                const actualHost = (allRooms && allRooms[S.state.activeRoomId] && allRooms[S.state.activeRoomId].host)
                    ? allRooms[S.state.activeRoomId].host
                    : (window.CURRENT_USERNAME || "Host");

                socket.emit('join_room', { roomID: S.state.activeRoomId, host: actualHost });
                broadcastSync({ type: 'request_sync' });
            }
        } catch (err) {
            console.error("Fehler beim Abrufen des Raum-Status:", err);
            if (S.state.isStreamPage && S.state.activeRoomId) {
                socket.emit('join_room', { roomID: S.state.activeRoomId, host: window.CURRENT_USERNAME || "Host" });
            }
        }
    }

    function updateSlotPointsUI() {
        S.state.slots.forEach((s, idx) => {
            if (s.username && S.state.roomPlayers[s.username]) {
                const pElem = document.getElementById(`slotPoints_${idx}`);
                if (pElem) {
                    pElem.textContent = `${S.state.roomPlayers[s.username].points} Pkt`;
                }
            }
        });
    }

    socket.on('connect', function () {
        if (S.state.activeRoomId && S.state.activeRoomId !== 'None') {
            fetchRoomPlayers();
        }
    });

    socket.on('stream_sync', function (data) {
        handleSyncMessage(data);
    });

    socket.on('playerList', function (data) {
        if (data && data.players) {
            S.state.roomPlayers = data.players;
            updateSlotPointsUI();
            S.renderSlotOverviewGrid();
        }
    });

    socket.on('buzzer', function (data) {
        const buzzedUser = data.username;
        const order = data.buzzerOrder;

        // Automatisch Audio bei Buzzer pausieren (damit die Antwort verstanden wird)
        const hostPlayer = document.getElementById('hostAudioPlayer');
        if (hostPlayer && !hostPlayer.paused) {
            hostPlayer.pause();
            if (typeof S.updateHostAudioButtons === 'function') S.updateHostAudioButtons(false);
        }
        S.setStreamAudioVisualState('paused');

        S.state.slots.forEach((s, idx) => {
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
                if (typeof S.updateHostAudioButtons === 'function') S.updateHostAudioButtons(true);
            }).catch(err => {
                console.log("Host Audio Autoplay blockiert oder nicht gestartet:", err);
            });
        }

        // Stream Seite: Audio wird im stummen AudioContext für die Frequenzanalyse analysiert
        S.setStreamAudioVisualState('playing', data);
    });

    socket.on('pauseAudio', function () {
        const hostPlayer = document.getElementById('hostAudioPlayer');
        if (hostPlayer) {
            hostPlayer.pause();
            if (typeof S.updateHostAudioButtons === 'function') S.updateHostAudioButtons(false);
        }
        S.setStreamAudioVisualState('paused');
    });

    socket.on('stopAudio', function () {
        const hostPlayer = document.getElementById('hostAudioPlayer');
        if (hostPlayer) {
            hostPlayer.pause();
            hostPlayer.currentTime = 0;
            if (typeof S.updateHostAudioButtons === 'function') S.updateHostAudioButtons(false);
        }
        S.setStreamAudioVisualState('stopped');
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
        S.setStreamAudioVisualState(data.state, data);
    });

    socket.on('streamAudioLevels', function (data) {
        if (data && Array.isArray(data.levels) && data.levels.length === 5) {
            lastReceivedAudioLevels = data.levels;
            lastReceivedAudioLevelsTime = performance.now();
        }
    });

    function resetSlotBorders() {
        S.state.slots.forEach((_, idx) => {
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
        S.state.slots.forEach((_, idx) => {
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
        S.state.slots.forEach((s, idx) => {
            if (s.username === username) {
                const cell = document.getElementById(`streamSlot_${idx}`);
                if (cell) cell.classList.add('slot-submitted');
            }
        });
    });

    socket.on('clearText', function () {
        resetSlotBorders();
        S.state.lastSentCardId = null;
        if (typeof window.hostStopAudio === 'function') {
            window.hostStopAudio();
        }
        S.updateAudioSentHint();
    });

    socket.on('answerInputToggle', function (data) {
        if (data && data.answerInput === false) {
            S.state.slots.forEach((_, idx) => {
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

        if (S.state.timerHideTimeout) {
            clearTimeout(S.state.timerHideTimeout);
            S.state.timerHideTimeout = null;
        }

        S.state.activeStreamTimer = {
            duration: duration,
            endTime: endTime
        };

        if (S.state.activeRoomId && S.state.activeRoomId !== 'None') {
            try {
                localStorage.setItem('kurobuzz_active_timer_' + S.state.activeRoomId, JSON.stringify(S.state.activeStreamTimer));
            } catch (e) {}
        }

        if (S.state.timerCountdownInterval) {
            clearInterval(S.state.timerCountdownInterval);
            S.state.timerCountdownInterval = null;
        }

        function updateTimerDOM() {
            const timeLeft = endTime - Date.now();

            if (timeLeft <= 0) {
                if (S.state.timerCountdownInterval) {
                    clearInterval(S.state.timerCountdownInterval);
                    S.state.timerCountdownInterval = null;
                }
                S.state.activeStreamTimer = null;
                if (S.state.activeRoomId && S.state.activeRoomId !== 'None') {
                    try { localStorage.removeItem('kurobuzz_active_timer_' + S.state.activeRoomId); } catch (e) {}
                }
                if (timerText) {
                    timerText.textContent = (duration >= 60) ? "00:00" : "0s";
                }
                if (S.state.timerHideTimeout) clearTimeout(S.state.timerHideTimeout);
                S.state.timerHideTimeout = setTimeout(() => {
                    S.state.timerHideTimeout = null;
                    if (!S.state.activeStreamTimer && badge) {
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
        S.state.timerCountdownInterval = setInterval(updateTimerDOM, 200);
    }
    window.handleTimerSync = handleTimerSync;

    socket.on('timer', function (data) {
        handleTimerSync(data);
    });

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && S.state.activeStreamTimer && S.state.activeStreamTimer.endTime > Date.now()) {
            handleTimerSync(S.state.activeStreamTimer);
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
            if (S.state.isCardFullscreen) {
                e.preventDefault();
                S.shrinkQuizCard();
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

    window.addEventListener('resize', function () {
        if (S.state.isStreamPage) {
            S.fitMiddleCardText();
        }
    });

    document.addEventListener('DOMContentLoaded', function () {
        S.initHostAudioPlayer();
        if (S.state.activeRoomId && S.state.activeRoomId !== 'None') {
            window.initStreamRoom(S.state.activeRoomId);
        } else {
            S.renderMiddleCard();
            S.updateControlBar();
            S.renderSlots();
            S.renderSlotOverviewGrid();
        }
    });


    S.state.slots = createEmptySlots();
    S.broadcastSync = broadcastSync;
    S.createEmptySlots = createEmptySlots;
    S.fetchRoomPlayers = fetchRoomPlayers;
    S.handleTimerSync = handleTimerSync;
    S.isCardPlaceholder = isCardPlaceholder;
    S.resetSlotBorders = resetSlotBorders;
    S.saveActiveCardIndex = saveActiveCardIndex;
    S.saveCards = saveCards;
    S.saveSlots = saveSlots;
    S.triggerErrorAlert = triggerErrorAlert;
    S.triggerQuestionAlert = triggerQuestionAlert;
    S.triggerSuccessAlert = triggerSuccessAlert;
    S.updateSlotPointsUI = updateSlotPointsUI;
})(window.StreamApp);
