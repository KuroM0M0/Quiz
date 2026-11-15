(function (S) {
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

    function updateAudioSentHint() {
        const container = document.getElementById('hostAudioSentStatus');
        if (!container) return;

        if (!S.state.cards || S.state.cards.length === 0 || S.state.activeCardIndex >= S.state.cards.length) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        const current = S.state.cards[S.state.activeCardIndex];
        const hasAudio = !!(current && current.audio && current.audio.trim().length > 0);

        if (!hasAudio) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        const isSent = (S.state.lastSentCardId === current.id);
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
        S.state.lastSentCardId = null;
        if (typeof window.hostStopAudio === 'function') {
            window.hostStopAudio();
        }
        updateAudioSentHint();
    };

    window.toggleHostAudioPlay = function () {
        if (!S.state.cards || S.state.cards.length === 0) return;
        const current = S.state.cards[S.state.activeCardIndex];
        if (!current || !current.audio) return;

        const targetRoom = S.state.activeRoomId || (typeof roomID !== 'undefined' ? roomID : '');
        const player = document.getElementById('hostAudioPlayer');
        if (!player) return;

        const isSent = (S.state.lastSentCardId === current.id);

        if (hostAudioPlaying && !player.paused) {
            // Pausieren
            player.pause();
            updateHostAudioButtons(false);
            stopHostAudioAnalyzerLoop();
            const audioPayload = { state: 'paused' };
            setStreamAudioVisualState('paused', audioPayload);
            S.broadcastSync({ type: 'stream_audio_visual', ...audioPayload });
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
                updateHostAudioButtons(false);
                stopHostAudioAnalyzerLoop();
                S.triggerErrorAlert("Audio-Wiedergabe", "Die Audiodatei konnte nicht abgespielt werden. Bitte prüfe, ob die Datei auf dem Server existiert (404) oder lade sie für diese Frage neu hoch.");
            });

            // Wellen-Animation auf Stream anzeigen (auch im Vorhörmodus laut Benutzerauswahl)
            const audioPayload = {
                state: 'playing',
                audioUrl: current.audio,
                currentTime: player.currentTime || 0,
                loop: !!current.audioLoop
            };
            setStreamAudioVisualState('playing', audioPayload);
            S.broadcastSync({ type: 'stream_audio_visual', ...audioPayload });
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
            S.broadcastSync({ type: 'stream_audio_levels', levels: levels });

            // Gedrosselt per Socket.IO (~30fps) für OBS oder Netzwerk-Clients
            const now = performance.now();
            if (now - hostLastSocketEmitTime > 32) {
                hostLastSocketEmitTime = now;
                const targetRoom = S.state.activeRoomId || (typeof roomID !== 'undefined' ? roomID : '');
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
        S.broadcastSync({ type: 'stream_audio_levels', levels: zeroLevels });
        const targetRoom = S.state.activeRoomId || (typeof roomID !== 'undefined' ? roomID : '');
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
        audioEl.muted = true;
        audioEl.volume = 0;
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

        const current = (S.state.cards && S.state.cards.length > 0 && S.state.activeCardIndex < S.state.cards.length) ? S.state.cards[S.state.activeCardIndex] : null;
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

            if (S.state.isStreamPage) {
                if (streamAudio && audioUrl) {
                    streamAudio.muted = true;
                    streamAudio.volume = 0;
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

            if (S.state.isStreamPage && streamAudio) {
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

            if (S.state.isStreamPage && streamAudio) {
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
        const current = (S.state.cards && S.state.cards.length > 0 && S.state.activeCardIndex < S.state.cards.length) ? S.state.cards[S.state.activeCardIndex] : null;
        const isSent = !!(current && S.state.lastSentCardId === current.id);
        const targetRoom = S.state.activeRoomId || (typeof roomID !== 'undefined' ? roomID : '');
        S.broadcastSync({ type: 'stream_audio_seek', currentTime: newTime });
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
        S.broadcastSync({ type: 'stream_audio_visual', ...audioPayload });

        const current = (S.state.cards && S.state.cards.length > 0 && S.state.activeCardIndex < S.state.cards.length) ? S.state.cards[S.state.activeCardIndex] : null;
        const isSent = !!(current && S.state.lastSentCardId === current.id);
        const targetRoom = S.state.activeRoomId || (typeof roomID !== 'undefined' ? roomID : '');
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

        hostAudioPlayer.onerror = function () {
            const timeElem = document.getElementById('hostAudioTime');
            if (timeElem) {
                timeElem.innerHTML = `<span class="has-text-danger" title="Datei nicht geladen"><i class="fas fa-exclamation-triangle mr-1"></i>Audio nicht verfügbar</span>`;
            }
            updateHostAudioButtons(false);
            stopHostAudioAnalyzerLoop();
        };

        window.setHostAudioVolume(0.8);
    }


    S.formatAudioTime = formatAudioTime;
    S.initHostAudioAnalyzer = initHostAudioAnalyzer;
    S.initHostAudioPlayer = initHostAudioPlayer;
    S.initStreamVisualizerAudio = initStreamVisualizerAudio;
    S.setStreamAudioVisualState = setStreamAudioVisualState;
    S.startHostAudioAnalyzerLoop = startHostAudioAnalyzerLoop;
    S.startStreamVisualizerLoop = startStreamVisualizerLoop;
    S.stopHostAudioAnalyzerLoop = stopHostAudioAnalyzerLoop;
    S.stopStreamVisualizerLoop = stopStreamVisualizerLoop;
    S.syncSeekToPlayers = syncSeekToPlayers;
    S.updateAudioSentHint = updateAudioSentHint;
    S.updateHostAudioButtons = updateHostAudioButtons;
    S.updateHostAudioSeekSlider = updateHostAudioSeekSlider;
})(window.StreamApp);
