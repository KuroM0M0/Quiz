/**
 * KuroBuzz - Hotkey Management System (hotkeys.js)
 * Konfigurierbare Hotkeys für Host & Stream-Regie mit dezentem Feedback
 */

(function () {
    const HOTKEY_STORAGE_KEY = 'kurobuzz_hotkeys';
    const HOTKEY_SETTINGS_KEY = 'kurobuzz_hotkey_settings';

    // Konfigurierbare Aktionen (Pfeiltasten sind fest in stream.js und hier bewusst ausgeschlossen)
    const HOTKEY_ACTIONS = [
        {
            id: 'toggleQuizCard',
            name: 'Quizfeld groß / klein',
            desc: 'Macht die Quizkarte in /stream groß und wieder klein',
            icon: 'fas fa-expand-arrows-alt'
        },
        {
            id: 'resetBuzzer',
            name: 'Buzzer zurücksetzen',
            desc: 'Setzt den Buzzer für alle Spieler zurück (Buzzer Reset)',
            icon: 'fas fa-undo'
        },
        {
            id: 'lockBuzzer',
            name: 'Buzzer sperren / entsperren',
            desc: 'Sperrt oder entsperrt den Buzzer für alle Spieler',
            icon: 'fas fa-bell-slash'
        }
    ];

    // Standardmäßig alle Hotkeys deaktiviert (null)
    const DEFAULT_HOTKEYS = {
        toggleQuizCard: null,
        resetBuzzer: null,
        lockBuzzer: null
    };

    const DEFAULT_SETTINGS = {
        crossWindow: true
    };

    let hotkeys = loadHotkeys();
    let settings = loadSettings();

    let recordingActionId = null;
    let recordingListener = null;

    // =========================================================================
    // Speichern & Laden (localStorage)
    // =========================================================================

    function loadHotkeys() {
        try {
            const raw = localStorage.getItem(HOTKEY_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return { ...DEFAULT_HOTKEYS, ...parsed };
            }
        } catch (e) {
            console.error("Fehler beim Laden der Hotkeys:", e);
        }
        return { ...DEFAULT_HOTKEYS };
    }

    function saveHotkeys(newHotkeys) {
        hotkeys = { ...newHotkeys };
        localStorage.setItem(HOTKEY_STORAGE_KEY, JSON.stringify(hotkeys));
    }

    function loadSettings() {
        try {
            const raw = localStorage.getItem(HOTKEY_SETTINGS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (e) {
            console.error("Fehler beim Laden der Hotkey-Einstellungen:", e);
        }
        return { ...DEFAULT_SETTINGS };
    }

    function saveSettings(newSettings) {
        settings = { ...newSettings };
        localStorage.setItem(HOTKEY_SETTINGS_KEY, JSON.stringify(settings));
    }

    // =========================================================================
    // Formatierung & Tasten-Codes
    // =========================================================================

    function getEventHotkey(e) {
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;

        const parts = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Meta');

        parts.push(e.code);
        return parts.join('+');
    }

    function formatHotkeyDisplay(codeStr) {
        if (!codeStr) {
            return '<span class="has-text-grey">Deaktiviert</span>';
        }
        const parts = codeStr.split('+');
        const formatted = parts.map(p => {
            if (p === 'Ctrl') return 'Strg';
            if (p === 'Shift') return 'Shift';
            if (p === 'Alt') return 'Alt';
            if (p === 'Meta') return 'Cmd';
            if (p.startsWith('Key')) return p.slice(3);
            if (p.startsWith('Digit')) return p.slice(5);
            if (p === 'Space') return 'Leertaste';
            if (p === 'Escape') return 'Esc';
            if (p === 'ArrowRight') return 'Pfeil Rechts';
            if (p === 'ArrowLeft') return 'Pfeil Links';
            if (p === 'ArrowUp') return 'Pfeil Oben';
            if (p === 'ArrowDown') return 'Pfeil Unten';
            return p;
        });
        return formatted.join(' + ');
    }

    // =========================================================================
    // Subtiles Feedback (Nur Button-Flash, kein Dot/Badge)
    // =========================================================================

    function triggerSubtleFeedback(targetElement) {
        // Taktiler Button-Flash, falls der Button sichtbar ist
        if (targetElement) {
            targetElement.classList.remove('hotkey-pulse');
            void targetElement.offsetWidth; // Reflow
            targetElement.classList.add('hotkey-pulse');
            setTimeout(() => {
                targetElement.classList.remove('hotkey-pulse');
            }, 200);
        }
    }

    // =========================================================================
    // Hotkey Ausführung
    // =========================================================================

    function getTargetRoom() {
        return window.STREAM_ROOM_ID || (typeof roomID !== 'undefined' ? roomID : '') || '';
    }

    function executeHotkey(actionId) {
        const targetRoom = getTargetRoom();

        if (actionId === 'toggleQuizCard') {
            const quizBtn = document.getElementById('quizButton');
            if (quizBtn && typeof window.toggleQuizCardFullscreen === 'function') {
                window.toggleQuizCardFullscreen();
                triggerSubtleFeedback(quizBtn);
            } else if (settings.crossWindow && targetRoom) {
                // Fensterübergreifend an /stream senden
                if (typeof socket !== 'undefined' && socket && socket.connected) {
                    socket.emit('stream_sync', { type: 'toggle_fullscreen', roomID: targetRoom });
                }
                triggerSubtleFeedback(null);
            }
        } else if (actionId === 'resetBuzzer') {
            const resetBtn = document.getElementById('resetBuzzer');
            if (resetBtn && typeof onBuzzerReset === 'function') {
                triggerSubtleFeedback(resetBtn);
                onBuzzerReset();
            } else if (settings.crossWindow && targetRoom) {
                if (typeof socket !== 'undefined' && socket && socket.connected) {
                    socket.emit('buzzerReset', { roomID: targetRoom });
                }
                triggerSubtleFeedback(null);
            }
        } else if (actionId === 'lockBuzzer') {
            const lockBtn = document.getElementById('lockBuzzerBtn') || document.querySelector('button[onclick*="lockBuzzer"]');
            if (lockBtn && typeof lockBuzzer === 'function') {
                triggerSubtleFeedback(lockBtn);
                lockBuzzer(lockBtn);
            } else if (settings.crossWindow && targetRoom) {
                if (typeof socket !== 'undefined' && socket && socket.connected) {
                    // Lock-Status toggeln
                    socket.emit('lockBuzzer', { roomID: targetRoom, lockBuzzer: true });
                }
                triggerSubtleFeedback(null);
            }
        }
    }

    // =========================================================================
    // Globaler Keydown Listener
    // =========================================================================

    window.addEventListener('keydown', function (e) {
        // Falls gerade eine Taste im Einstellungs-Modal aufgenommen wird
        if (recordingActionId !== null) return;

        // Wenn der Nutzer in einem Eingabefeld schreibt, ignorieren
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) {
            return;
        }

        // Wenn ein Dialog/Modal geöffnet ist, keine Hotkeys ausführen
        if (document.querySelector('.modal.is-active')) {
            return;
        }

        const pressedCode = getEventHotkey(e);
        if (!pressedCode) return;

        // Prüfen, ob eine konfigurierte Aktion zu diesem Key passt
        for (const [actionId, assignedCode] of Object.entries(hotkeys)) {
            if (assignedCode && assignedCode === pressedCode) {
                e.preventDefault();
                e.stopPropagation();
                executeHotkey(actionId);
                return;
            }
        }
    });

    // =========================================================================
    // Aufnahme-Modus für Tastenbelegung
    // =========================================================================

    function startRecording(actionId) {
        if (recordingListener) {
            window.removeEventListener('keydown', recordingListener, true);
            recordingListener = null;
        }

        recordingActionId = actionId;
        renderModalList();

        recordingListener = function (e) {
            e.preventDefault();
            e.stopPropagation();

            // Escape bricht die Aufnahme ab
            if (e.key === 'Escape') {
                stopRecording();
                renderModalList();
                return;
            }

            // Backspace oder Delete löscht den Hotkey
            if (e.key === 'Backspace' || e.key === 'Delete') {
                hotkeys[recordingActionId] = null;
                saveHotkeys(hotkeys);
                stopRecording();
                renderModalList();
                return;
            }

            // Reine Modifier ignorieren
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                return;
            }

            const newCode = getEventHotkey(e);
            if (newCode) {
                // Eventuelle Doppelbelegung bei anderer Aktion aufheben
                for (const act of HOTKEY_ACTIONS) {
                    if (act.id !== recordingActionId && hotkeys[act.id] === newCode) {
                        hotkeys[act.id] = null;
                    }
                }
                hotkeys[recordingActionId] = newCode;
                saveHotkeys(hotkeys);
            }

            stopRecording();
            renderModalList();
        };

        window.addEventListener('keydown', recordingListener, true);
    }

    function stopRecording() {
        if (recordingListener) {
            window.removeEventListener('keydown', recordingListener, true);
            recordingListener = null;
        }
        recordingActionId = null;
    }

    function clearHotkey(actionId) {
        hotkeys[actionId] = null;
        saveHotkeys(hotkeys);
        renderModalList();
    }

    window.resetHotkeysToDefault = function () {
        const doReset = () => {
            hotkeys = { ...DEFAULT_HOTKEYS };
            saveHotkeys(hotkeys);
            renderModalList();
            if (typeof ShowSuccessAlert === "function") {
                ShowSuccessAlert("Hotkeys zurückgesetzt", "Alle konfigurierbaren Hotkeys wurden deaktiviert.");
            }
        };

        if (typeof ShowQuestionAlert === "function") {
            ShowQuestionAlert("Hotkeys zurücksetzen", "Möchtest du wirklich alle konfigurierbaren Hotkeys deaktivieren?").then(res => {
                if (res && res.isConfirmed) doReset();
            });
        } else if (typeof Swal !== "undefined") {
            Swal.fire({
                title: "Hotkeys zurücksetzen",
                text: "Möchtest du wirklich alle konfigurierbaren Hotkeys deaktivieren?",
                icon: "question",
                confirmButtonText: "Zurücksetzen",
                cancelButtonText: "Abbrechen",
                showCancelButton: true,
                theme: "dark"
            }).then(res => {
                if (res && res.isConfirmed) doReset();
            });
        }
    };

    window.toggleHotkeyCrossWindow = function (checked) {
        settings.crossWindow = !!checked;
        saveSettings(settings);
    };

    // =========================================================================
    // Modal-Erstellung & UI
    // =========================================================================

    function ensureModalInDOM() {
        let modal = document.getElementById('hotkeysModal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'hotkeysModal';
        modal.innerHTML = `
            <div class="modal-background" onclick="closeHotkeySettingsModal()"></div>
            <div class="modal-content p-4" style="max-width: 520px;">
                <div class="box p-5" style="background: #1a1a24; border: 1px solid #3e3e50; border-radius: 8px;">
                    <div class="is-flex is-align-items-center is-justify-content-space-between mb-3">
                        <h2 class="title is-4 mb-0 has-text-white">
                            <i class="fas fa-keyboard mr-2 has-text-info"></i>Hotkeys einstellen
                        </h2>
                        <button class="delete" aria-label="close" onclick="closeHotkeySettingsModal()"></button>
                    </div>
                    
                    <p class="subtitle is-6 has-text-grey-light mb-4">
                        Klicke auf ein Tastenfeld, um deine Wunschtaste zu drücken. Einzelne Tasten (z. B. <span class="tag is-dark is-small">R</span>) oder Kombinationen (z. B. <span class="tag is-dark is-small">Strg + R</span>) sind möglich.
                    </p>

                    <div id="hotkeysList" class="mb-4">
                        <!-- Dynamisch generiert -->
                    </div>

                    <!-- Einstellungs-Option: Fensterübergreifend -->
                    <div class="field mb-4 p-3" style="background: rgba(255, 255, 255, 0.04); border-radius: 6px;">
                        <label class="checkbox has-text-white is-size-7 is-flex is-align-items-flex-start" style="gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="hotkeyCrossWindowCheckbox" onchange="toggleHotkeyCrossWindow(this.checked)" style="margin-top: 2px;">
                            <div>
                                <strong class="has-text-light">Aktionen fensterübergreifend ausführen</strong>
                                <div class="has-text-grey mt-1">
                                    Ermöglicht z. B. das Vergrößern der Stream-Karte vom Host-Fenster aus oder das Zurücksetzen des Buzzers aus dem Stream-Overlay.
                                </div>
                            </div>
                        </label>
                    </div>

                    <div class="is-flex is-justify-content-space-between is-align-items-center pt-3" style="border-top: 1px solid rgba(255, 255, 255, 0.1);">
                        <button class="button is-danger is-small is-light" onclick="resetHotkeysToDefault()" title="Alle Tastenbelegungen entfernen">
                            <i class="fas fa-undo mr-1"></i> Alle deaktivieren
                        </button>
                        <button class="button is-primary is-small" onclick="closeHotkeySettingsModal()">
                            Fertig
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    function renderModalList() {
        const listContainer = document.getElementById('hotkeysList');
        if (!listContainer) return;

        listContainer.innerHTML = '';

        HOTKEY_ACTIONS.forEach(act => {
            const isRecording = (recordingActionId === act.id);
            const currentCode = hotkeys[act.id];

            const row = document.createElement('div');
            row.className = 'is-flex is-align-items-center is-justify-content-space-between p-3 mb-2';
            row.style.background = 'rgba(255, 255, 255, 0.03)';
            row.style.border = '1px solid rgba(255, 255, 255, 0.08)';
            row.style.borderRadius = '6px';

            const left = document.createElement('div');
            left.style.flex = '1';
            left.style.paddingRight = '12px';
            left.innerHTML = `
                <div class="has-text-weight-bold has-text-white is-size-6">
                    <i class="${act.icon} mr-2 has-text-info"></i>${act.name}
                </div>
                <div class="is-size-7 has-text-grey">${act.desc}</div>
            `;

            const right = document.createElement('div');
            right.className = 'is-flex is-align-items-center';
            right.style.gap = '6px';

            const btn = document.createElement('button');
            btn.className = 'button is-small ' + (isRecording ? 'is-warning is-light' : (currentCode ? 'is-info' : 'is-dark'));
            btn.style.minWidth = '130px';
            if (isRecording) {
                btn.innerHTML = '<span class="has-text-weight-bold"><i class="fas fa-circle-notch fa-spin mr-1"></i>Taste drücken...</span>';
            } else {
                btn.innerHTML = formatHotkeyDisplay(currentCode);
                btn.title = 'Klicken zum Ändern';
            }
            btn.onclick = function () {
                if (isRecording) {
                    stopRecording();
                    renderModalList();
                } else {
                    startRecording(act.id);
                }
            };
            right.appendChild(btn);

            if (currentCode) {
                const clearBtn = document.createElement('button');
                clearBtn.className = 'button is-small is-danger is-light';
                clearBtn.title = 'Hotkey entfernen';
                clearBtn.innerHTML = '<i class="fas fa-times"></i>';
                clearBtn.onclick = function () {
                    clearHotkey(act.id);
                };
                right.appendChild(clearBtn);
            }

            row.appendChild(left);
            row.appendChild(right);
            listContainer.appendChild(row);
        });
    }

    window.openHotkeySettingsModal = function () {
        const modal = ensureModalInDOM();
        const checkbox = document.getElementById('hotkeyCrossWindowCheckbox');
        if (checkbox) {
            checkbox.checked = !!settings.crossWindow;
        }
        renderModalList();
        modal.classList.add('is-active');
    };

    window.closeHotkeySettingsModal = function () {
        stopRecording();
        const modal = document.getElementById('hotkeysModal');
        if (modal) {
            modal.classList.remove('is-active');
        }
    };

})();
