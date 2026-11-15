(function (S) {
    // =========================================================================
    // Mittelkarte: Klick-Animation (Vollbild / Verkleinern)
    // =========================================================================

    function expandQuizCard() {
        const quizBtn = document.getElementById('quizButton');
        const quizFeld = document.getElementById('quizFeld');
        if (!quizBtn || !quizFeld) return;

        if (S.state.shrinkTimeout) {
            clearTimeout(S.state.shrinkTimeout);
            S.state.shrinkTimeout = null;
        }

        quizFeld.style.zIndex = '100';
        quizBtn.classList.remove('button-klein');
        quizBtn.classList.add('button-vollbild');
        S.state.isCardFullscreen = true;
        setTimeout(fitMiddleCardText, 520);
    }

    function shrinkQuizCard() {
        const quizBtn = document.getElementById('quizButton');
        const quizFeld = document.getElementById('quizFeld');
        if (!quizBtn || !quizFeld) return;

        if (S.state.shrinkTimeout) {
            clearTimeout(S.state.shrinkTimeout);
            S.state.shrinkTimeout = null;
        }

        quizBtn.classList.remove('button-vollbild');
        quizBtn.classList.remove('button-klein');
        S.state.isCardFullscreen = false;

        S.state.shrinkTimeout = setTimeout(() => {
            if (!S.state.isCardFullscreen) {
                quizFeld.style.zIndex = '10';
            }
            S.state.shrinkTimeout = null;
            fitMiddleCardText();
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

        if (S.state.isCardFullscreen) {
            shrinkQuizCard();
        } else {
            expandQuizCard();
        }
    };

    let lastRenderedCardSignature = null;
    let lastRenderedCardIndex = 0;
    let cardSwitchOutTimer = null;
    let cardSwitchCleanupTimer = null;

    function isMiddleCardOverflowing() {
        const quizBtn = document.getElementById('quizButton');
        const textElem = document.getElementById('quizCardText');
        if (!quizBtn || !textElem) return false;

        const btnRect = quizBtn.getBoundingClientRect();
        if (btnRect.height <= 0) return false;

        // Sicherheitsabstand zur physischen Unterkante der Mittelbox (6px)
        const maxAllowedBottom = btnRect.bottom - 6;

        // 1. Tiefstes sichtbares Element ermitteln
        const imgElem = document.getElementById('quizCardImage');
        const hasImage = imgElem && !imgElem.classList.contains('unsichtbar') && imgElem.src && imgElem.src.trim() && !imgElem.src.endsWith('#');

        const audioWave = document.getElementById('quizCardAudioWave');
        const hasWave = audioWave && audioWave.classList.contains('is-active-wave');

        const lowestElem = hasWave ? audioWave : (hasImage ? imgElem : textElem);
        const lowestRect = lowestElem.getBoundingClientRect();

        // Ragt das unterste sichtbare Element über die Unterkante hinaus?
        if (lowestRect.bottom > maxAllowedBottom) {
            return true;
        }

        // 2. scrollHeight der Box gegen clientHeight prüfen (mit 6px Toleranz)
        if (quizBtn.scrollHeight > quizBtn.clientHeight + 6) {
            return true;
        }

        // 3. Horizontale Prüfung (nur bei extrem langen, unbrechbaren Wörtern mit 10px Puffer)
        if (textElem.scrollWidth > textElem.clientWidth + 10) {
            return true;
        }

        return false;
    }

    function fitMiddleCardText() {
        if (!S.state.isStreamPage) return;
        const textElem = document.getElementById('quizCardText');
        const quizBtn = document.getElementById('quizButton');
        if (!textElem || !quizBtn) return;

        // Wenn kein Fragetext sichtbar ist, zurücksetzen und abbrechen
        if (textElem.classList.contains('unsichtbar') || !textElem.textContent || !textElem.textContent.trim()) {
            textElem.style.fontSize = '';
            textElem.style.lineHeight = '';
            return;
        }

        // Transition vorübergehend ausschalten für synchrone Messung
        const prevTransition = textElem.style.transition;
        textElem.style.transition = 'none';

        // Zunächst auf Standard-Größe zurücksetzen und Reflow erzwingen
        textElem.style.fontSize = '';
        textElem.style.lineHeight = '';
        void textElem.offsetHeight;

        // Basis-Schriftgröße (Standardwert) ermitteln
        const computedStyle = window.getComputedStyle(textElem);
        const baseFontSize = parseFloat(computedStyle.fontSize);
        if (!baseFontSize || isNaN(baseFontSize)) {
            textElem.style.transition = prevTransition;
            return;
        }

        // Falls der Text mit der Standard-Schriftgröße vollständig hineinpasst: Standard beibehalten!
        if (!isMiddleCardOverflowing()) {
            textElem.style.transition = prevTransition;
            return;
        }

        // Falls Text abgeschnitten wird: Schriftgröße schrittweise (1px-Schritte, max. 6px kleiner) verkleinern
        const maxReduction = 6;
        for (let reduction = 1; reduction <= maxReduction; reduction++) {
            const candidateSize = Math.max(10, baseFontSize - reduction);
            textElem.style.setProperty('font-size', candidateSize + 'px', 'important');
            textElem.style.lineHeight = '1.3';
            void textElem.offsetHeight; // Reflow erzwingen für präzise Überlaufprüfung

            if (!isMiddleCardOverflowing()) {
                break; // Text passt nun ohne Abschneiden hinein!
            }
        }

        // Layout erzwingen und Transition wiederherstellen
        void textElem.offsetHeight;
        textElem.style.transition = prevTransition;
    }

    function applyMiddleCardDOM() {
        const catElem = document.getElementById('quizCardCategory');
        const textElem = document.getElementById('quizCardText');
        const imgElem = document.getElementById('quizCardImage');
        const quizBtn = document.getElementById('quizButton');
        const quizFeld = document.getElementById('quizFeld');
        const audioBadge = document.getElementById('quizCardAudioBadge');
        const audioWave = document.getElementById('quizCardAudioWave');

        if (!catElem && !textElem && !imgElem) return;

        if (!S.state.cards || S.state.cards.length === 0) {
            if (S.state.isStreamPage && quizFeld) {
                if (S.state.isMiddleCardHidden) {
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

        if (S.state.activeCardIndex >= S.state.cards.length) S.state.activeCardIndex = Math.max(0, S.state.cards.length - 1);
        const current = S.state.cards[S.state.activeCardIndex];

        // Platzhalter-Erkennung (z. B. isPlaceholder Flag oder Titel "[Platzhalter]")
        const isPlaceholder = S.isCardPlaceholder(current);
        const shouldHideOnStream = S.state.isMiddleCardHidden || isPlaceholder;

        if (S.state.isStreamPage && quizFeld) {
            if (shouldHideOnStream) {
                quizFeld.classList.add('is-card-hidden');
            } else {
                quizFeld.classList.remove('is-card-hidden');
            }
        }

        if (isPlaceholder) {
            if (!S.state.isStreamPage) {
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
            } else {
                // Auf /stream: Text und Bild sofort leeren, damit keinerlei Geister-Inhalte verbleiben
                if (catElem) {
                    catElem.textContent = "";
                    catElem.classList.add('unsichtbar');
                }
                if (textElem) {
                    textElem.textContent = "";
                    textElem.classList.add('unsichtbar');
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
        if (S.state.isStreamPage) {
            const streamAudio = document.getElementById('streamQuestionAudio');
            if (streamAudio) {
                try {
                    streamAudio.pause();
                    streamAudio.currentTime = 0;
                } catch (e) {}
            }
            if (typeof S.stopStreamVisualizerLoop === 'function') {
                S.stopStreamVisualizerLoop(false);
            }
        }

        if (isImageOnly) {
            // Bild statt Frage anzeigen
            if (S.state.isStreamPage) {
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
                if (S.state.isStreamPage) {
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
                    imgElem.onload = function () {
                        fitMiddleCardText();
                    };
                } else {
                    imgElem.src = "";
                    imgElem.classList.add('unsichtbar');
                }
            }
        }

        // Dynamische Schriftgrößen-Anpassung bei Text-Überlauf (max. 6px kleiner)
        fitMiddleCardText();
    }

    function renderMiddleCard() {
        const quizBtn = document.getElementById('quizButton');

        if (!S.state.isStreamPage || !quizBtn) {
            applyMiddleCardDOM();
            return;
        }

        let currentSig = 'empty';
        if (S.state.cards && S.state.cards.length > 0) {
            const safeIdx = Math.min(S.state.activeCardIndex, Math.max(0, S.state.cards.length - 1));
            const current = S.state.cards[safeIdx];
            currentSig = safeIdx + ':' + (current && current.id !== undefined ? current.id : safeIdx);
        }

        // Erstes Rendern beim Laden der Seite: Sofort ohne Wechsel-Animation anzeigen
        if (lastRenderedCardSignature === null) {
            lastRenderedCardSignature = currentSig;
            lastRenderedCardIndex = S.state.activeCardIndex;
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
        const dir = (S.state.activeCardIndex >= lastRenderedCardIndex) ? 'next' : 'prev';
        lastRenderedCardSignature = currentSig;
        lastRenderedCardIndex = S.state.activeCardIndex;

        // Laufendes Audio auf dem Stream sofort stoppen
        const streamAudio = document.getElementById('streamQuestionAudio');
        if (streamAudio) {
            try {
                streamAudio.pause();
                streamAudio.currentTime = 0;
            } catch (e) {}
        }
        if (typeof S.stopStreamVisualizerLoop === 'function') {
            S.stopStreamVisualizerLoop(false);
        }

        if (cardSwitchCleanupTimer) {
            clearTimeout(cardSwitchCleanupTimer);
            cardSwitchCleanupTimer = null;
        }

        const outClass = dir === 'next' ? 'card-switch-out-next' : 'card-switch-out-prev';
        const inClass = dir === 'next' ? 'card-switch-in-next' : 'card-switch-in-prev';

        const targetCard = (S.state.cards && S.state.cards.length > 0) ? S.state.cards[Math.min(S.state.activeCardIndex, S.state.cards.length - 1)] : null;
        const isTargetPlaceholder = S.isCardPlaceholder(targetCard);
        const targetShouldHide = S.state.isMiddleCardHidden || isTargetPlaceholder || !targetCard;

        const quizFeld = document.getElementById('quizFeld');
        const wasHidden = quizFeld ? (quizFeld.classList.contains('is-card-hidden') || quizFeld.style.display === 'none' || getComputedStyle(quizFeld).display === 'none') : false;

        // Bei schnellem Durchklicken laufende Animationstimer abbrechen
        if (cardSwitchOutTimer) {
            clearTimeout(cardSwitchOutTimer);
            cardSwitchOutTimer = null;
        }
        if (cardSwitchCleanupTimer) {
            clearTimeout(cardSwitchCleanupTimer);
            cardSwitchCleanupTimer = null;
        }

        // Fall A: Wechsel zu einem Platzhalter (vorherige Karte wischt nach links weg, danach ist die Mitte sofort unsichtbar)
        if (targetShouldHide) {
            if (!wasHidden) {
                quizBtn.classList.remove('card-switch-out-next', 'card-switch-out-prev', 'card-switch-in-next', 'card-switch-in-prev');
                void quizBtn.offsetWidth;
                quizBtn.classList.add(outClass);

                cardSwitchOutTimer = setTimeout(() => {
                    cardSwitchOutTimer = null;
                    applyMiddleCardDOM();
                    quizBtn.classList.remove('card-switch-out-next', 'card-switch-out-prev', 'card-switch-in-next', 'card-switch-in-prev');
                }, 140);
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
                fitMiddleCardText();
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
                fitMiddleCardText();
            }, 440);
        }, 135);
    }

    // =========================================================================
    // Navigation der Quiz-Karten & Host-Aktionen
    // =========================================================================

    window.nextCard = function () {
        if (!S.state.cards || S.state.cards.length === 0) return;
        if (typeof window.hostStopAudio === 'function') window.hostStopAudio();
        if (S.state.activeCardIndex < S.state.cards.length - 1) {
            S.state.activeCardIndex++;
            S.saveActiveCardIndex();
            renderMiddleCard();
            updateControlBar();
            S.renderCardManagerList();
        }
    };

    window.prevCard = function () {
        if (!S.state.cards || S.state.cards.length === 0) return;
        if (typeof window.hostStopAudio === 'function') window.hostStopAudio();
        if (S.state.activeCardIndex > 0) {
            S.state.activeCardIndex--;
            S.saveActiveCardIndex();
            renderMiddleCard();
            updateControlBar();
            S.renderCardManagerList();
        }
    };

    window.selectCardFromDropdown = function (index) {
        if (!S.state.cards || S.state.cards.length === 0) return;
        const parsed = parseInt(index, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < S.state.cards.length) {
            if (typeof window.hostStopAudio === 'function') window.hostStopAudio();
            S.state.activeCardIndex = parsed;
            S.saveActiveCardIndex();
            renderMiddleCard();
            updateControlBar();

            if (!S.state.editingCardId) {
                S.state.insertTargetIndex = S.state.activeCardIndex + 1;
                if (typeof S.updateCardFormHeader === 'function') S.updateCardFormHeader();
            }
            S.renderCardManagerList();
        }
    };

    window.sendCardToPlayers = function () {
        if (!S.state.cards || S.state.cards.length === 0) {
            S.triggerErrorAlert("Keine Fragen", "Bitte lege zuerst eine Frage an.");
            return;
        }
        const current = S.state.cards[S.state.activeCardIndex];
        if (!current) return;

        const targetRoom = S.state.activeRoomId || (typeof roomID !== 'undefined' ? roomID : '');
        if (!targetRoom) return;

        const hostPlayer = document.getElementById('hostAudioPlayer');
        const isAudioPlaying = !!(hostAudioPlaying && hostPlayer && !hostPlayer.paused);
        const currentSeek = (hostPlayer && typeof hostPlayer.currentTime === 'number') ? hostPlayer.currentTime : 0;

        const cardImage = current.image || "";
        const isImageOnly = !!current.imageOnly;

        socket.emit("sendQuestion", {
            room: targetRoom,
            question: current.question || "",
            answer: current.answer || "",
            audio: current.audio || "",
            loop: !!current.audioLoop,
            image: cardImage,
            imageOnly: isImageOnly
        });

        if (cardImage) {
            socket.emit("sendImage", {
                room: targetRoom,
                image: cardImage,
                imageOnly: isImageOnly
            });
        }

        S.state.lastSentCardId = current.id;
        S.updateAudioSentHint();

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

        S.triggerSuccessAlert("Gesendet!", "Frage wurde an die Teilnehmer übertragen.");
    };

    window.startCardTimer = function () {
        if (!S.state.cards || S.state.cards.length === 0) {
            S.triggerErrorAlert("Keine Fragen", "Bitte erstelle zuerst eine Frage.");
            return;
        }

        const targetRoom = S.state.activeRoomId || (typeof roomID !== 'undefined' ? roomID : '');
        if (!targetRoom) return;

        const current = S.state.cards[S.state.activeCardIndex];
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
                        S.broadcastSync({
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
        S.broadcastSync({
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

        if (S.state.isMiddleCardHidden) {
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
        S.state.isMiddleCardHidden = !S.state.isMiddleCardHidden;
        if (S.state.activeRoomId && S.state.activeRoomId !== 'None') {
            try {
                localStorage.setItem('kurobuzz_card_hidden_' + S.state.activeRoomId, S.state.isMiddleCardHidden ? 'true' : 'false');
            } catch (e) {}
        }
        S.broadcastSync({
            type: 'middle_card_hidden_updated',
            isHidden: S.state.isMiddleCardHidden
        });
        applyMiddleCardDOM();
        updateMiddleCardToggleBtn();

        S.triggerSuccessAlert(
            S.state.isMiddleCardHidden ? "Mittelkarte ausgeblendet" : "Mittelkarte wieder sichtbar",
            S.state.isMiddleCardHidden ? "Die Karte in der Mitte auf /stream ist nun ausgeblendet." : "Die Karte in der Mitte auf /stream wird wieder angezeigt."
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
        const targetRoom = S.state.activeRoomId || (typeof roomID !== 'undefined' ? roomID : '');
        if (!targetRoom || targetRoom === 'None') {
            S.triggerErrorAlert("Kein Raum", "Es wurde noch kein Raum-Code geladen.");
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

        if (drawerRoomElem && S.state.activeRoomId && S.state.activeRoomId !== 'None') {
            drawerRoomElem.textContent = S.state.activeRoomId;
        }

        if (!counter && !dropdown && !solText && !timerBtn) return;

        if (!S.state.cards || S.state.cards.length === 0) {
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
            S.updateHostAudioButtons(false);
            S.updateAudioSentHint();
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

        if (S.state.activeCardIndex >= S.state.cards.length) S.state.activeCardIndex = Math.max(0, S.state.cards.length - 1);
        const current = S.state.cards[S.state.activeCardIndex];

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
                        S.updateHostAudioButtons(false);
                        S.updateHostAudioSeekSlider(0, 0);
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
                    S.updateHostAudioButtons(false);
                    S.updateHostAudioSeekSlider(0, 0);
                }
            }
            S.updateAudioSentHint();
        }

        if (counter) {
            counter.textContent = `Frage ${S.state.activeCardIndex + 1} von ${S.state.cards.length}`;
            counter.classList.remove('has-text-grey');
            counter.classList.add('has-text-info', 'has-text-weight-bold');
        }

        if (dropdown) {
            dropdown.innerHTML = "";
            S.state.cards.forEach((c, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                const timerTag = (c.timer && parseInt(c.timer, 10) > 0) ? ` [${c.timer}s]` : '';
                let modePrefix = '';
                if (c.imageOnly && c.image) modePrefix += '📷 ';
                if (c.audio && c.audio.trim().length > 0) modePrefix += '🎵 ';
                const qText = c.question ? c.question.substring(0, 25) + '...' : ((c.imageOnly && c.image) ? '[Bild]' : (c.audio ? '[Audio]' : '...'));
                opt.textContent = `${idx + 1}. ${modePrefix}${c.title || 'Frage'}${timerTag}: ${qText}`;
                if (idx === S.state.activeCardIndex) opt.selected = true;
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


    S.applyMiddleCardDOM = applyMiddleCardDOM;
    S.expandQuizCard = expandQuizCard;
    S.fitMiddleCardText = fitMiddleCardText;
    S.isMiddleCardOverflowing = isMiddleCardOverflowing;
    S.renderMiddleCard = renderMiddleCard;
    S.shrinkQuizCard = shrinkQuizCard;
    S.toggleStreamMiddleCard = toggleStreamMiddleCard;
    S.updateControlBar = updateControlBar;
    S.updateMiddleCardToggleBtn = updateMiddleCardToggleBtn;
})(window.StreamApp);
