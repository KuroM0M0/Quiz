(function (S) {
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

        const count = S.state.slots.length;

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
        S.state.slots.forEach((slot, idx) => {
            const card = document.createElement('div');
            const hasUser = !!slot.username;
            card.className = 'slot-overview-card' + (hasUser ? ' is-assigned' : '');
            card.onclick = function (e) {
                onSlotClick(idx, e);
            };

            const points = (hasUser && S.state.roomPlayers[slot.username]) ? S.state.roomPlayers[slot.username].points : 0;
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
        S.state.currentEditingSlotIndex = slotIndex;
        openSlotAssignModal();
    };

    function openSlotAssignModal() {
        const title = document.getElementById('slotModalTitle');
        const select = document.getElementById('slotPlayerSelect');
        const reactiveInput = document.getElementById('slotReactiveInput');
        const overlayInput = document.getElementById('slotOverlayInput');

        if (S.state.currentEditingSlotIndex === null) return;

        if (title) title.textContent = `Slot ${S.state.currentEditingSlotIndex + 1} zuweisen`;

        if (select) {
            select.innerHTML = `<option value="">-- Kein Spieler (Slot leeren) --</option>`;
            const currentAssigned = S.state.slots[S.state.currentEditingSlotIndex].username;

            Object.keys(S.state.roomPlayers).forEach(pName => {
                const opt = document.createElement('option');
                opt.value = pName;
                opt.textContent = pName;
                if (pName === currentAssigned) {
                    opt.selected = true;
                }
                select.appendChild(opt);
            });

            if (currentAssigned && !S.state.roomPlayers[currentAssigned]) {
                const opt = document.createElement('option');
                opt.value = currentAssigned;
                opt.textContent = `${currentAssigned} (Offline)`;
                opt.selected = true;
                select.appendChild(opt);
            }
        }

        if (reactiveInput) {
            reactiveInput.value = S.state.slots[S.state.currentEditingSlotIndex].reactiveUrl || "";
        }

        if (overlayInput) {
            overlayInput.value = S.state.slots[S.state.currentEditingSlotIndex].overlayUrl || "";
        }

        openModal('slotAssignModal');
    }

    window.closeSlotAssignModal = function () {
        closeModal('slotAssignModal');
        S.state.currentEditingSlotIndex = null;
    };

    window.saveCurrentSlot = function () {
        if (S.state.currentEditingSlotIndex === null) return;

        const select = document.getElementById('slotPlayerSelect');
        const reactiveInput = document.getElementById('slotReactiveInput');
        const overlayInput = document.getElementById('slotOverlayInput');

        const chosenUser = select ? select.value : "";
        const chosenReactive = reactiveInput ? reactiveInput.value.trim() : "";
        const chosenOverlay = overlayInput ? overlayInput.value.trim() : "";

        S.state.slots[S.state.currentEditingSlotIndex].username = chosenUser;
        S.state.slots[S.state.currentEditingSlotIndex].reactiveUrl = chosenReactive;
        S.state.slots[S.state.currentEditingSlotIndex].overlayUrl = chosenOverlay;

        S.saveSlots();
        renderSlots();
        renderSlotOverviewGrid();
        closeModal('slotAssignModal');
        S.state.currentEditingSlotIndex = null;
    };

    window.clearCurrentSlot = function () {
        if (S.state.currentEditingSlotIndex === null) return;

        S.state.slots[S.state.currentEditingSlotIndex].username = "";
        S.state.slots[S.state.currentEditingSlotIndex].reactiveUrl = "";
        S.state.slots[S.state.currentEditingSlotIndex].overlayUrl = "";

        S.saveSlots();
        renderSlots();
        renderSlotOverviewGrid();
        closeModal('slotAssignModal');
        S.state.currentEditingSlotIndex = null;
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
        const count = S.state.slots.length;

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

        S.state.slots.forEach((slot, index) => {
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
            const points = (username && S.state.roomPlayers[username]) ? S.state.roomPlayers[username].points : 0;
            const hasOverlay = !!(slot.overlayUrl && slot.overlayUrl.trim());
            const isVdoOverlay = hasOverlay && slot.overlayUrl.toLowerCase().includes('vdo.ninja');
            const overlaySrc = hasOverlay ? (isVdoOverlay ? prepareVdoNinjaUrl(slot.overlayUrl) : slot.overlayUrl.trim()) : '';
            const overlayClass = isVdoOverlay ? 'slot-overlay-iframe is-vdo-inactive' : 'slot-overlay-iframe';

            if (username) {
                // Belegter Slot: Klick auf den Header öffnet das Modal
                cell.innerHTML = `
                    <div class="slot-header" onclick="onSlotClick(${index}, event)" title="Klicken um Spieler für diesen Slot zu ändern">
                        <div class="slot-header-content">
                            <h1 class="title zentriert kleinAbstandOben slot-title">
                                <span class="buzzer-badge is-hidden" id="buzzerBadge_${index}"></span>
                                <span class="slot-player-name">${username}</span>
                            </h1>
                            <div class="slot-points-wrapper">
                                <span class="tag is-primary ml-2" id="slotPoints_${index}">${points} Pkt</span>
                                <span class="icon is-small slot-edit-hint ml-1"><i class="fas fa-edit"></i></span>
                            </div>
                        </div>
                    </div>
                    <div class="slot-body">
                        <div class="slot-text-container">
                            <iframe class="slot-text-iframe" src="/${S.state.activeRoomId}/${encodeURIComponent(username)}/text" width="100%" height="100%" frameborder="0"></iframe>
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
        if (S.state.slots.length >= 8) {
            S.triggerErrorAlert("Limit erreicht", "Es können maximal 8 Slots angelegt werden.");
            return;
        }
        S.state.slots.push({ username: "", reactiveUrl: "", overlayUrl: "" });
        S.saveSlots();
        renderSlots();
        renderSlotOverviewGrid();
        updateSlotUI();
    };

    window.removeSlot = function () {
        if (S.state.slots.length <= 1) {
            S.triggerErrorAlert("Limit erreicht", "Es muss mindestens 1 Slot vorhanden sein.");
            return;
        }
        const doRemove = () => {
            S.state.slots.pop();
            S.saveSlots();
            renderSlots();
            renderSlotOverviewGrid();
            updateSlotUI();
        };

        const lastSlot = S.state.slots[S.state.slots.length - 1];
        if (lastSlot && lastSlot.username) {
            S.triggerQuestionAlert("Slot entfernen", `Slot ${S.state.slots.length} ist Spieler "${lastSlot.username}" zugewiesen. Wirklich entfernen?`).then((res) => {
                if (res && res.isConfirmed) doRemove();
            });
            return;
        }
        doRemove();
    };

    function updateSlotUI() {
        const count = S.state.slots.length;
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
        const playerNames = Object.keys(S.state.roomPlayers);
        playerNames.forEach((name, idx) => {
            if (idx < S.state.slots.length) {
                S.state.slots[idx].username = name;
            }
        });
        S.saveSlots();
        renderSlots();
        renderSlotOverviewGrid();
        updateSlotUI();
    };

    window.clearAllSlots = function () {
        const doClear = () => {
            S.state.slots = S.state.slots.map(s => ({ username: "", reactiveUrl: s.reactiveUrl, overlayUrl: s.overlayUrl }));
            S.saveSlots();
            renderSlots();
            renderSlotOverviewGrid();
            updateSlotUI();
            S.triggerSuccessAlert("Slots geleert", "Alle Spieler-Slots wurden geleert.");
        };

        S.triggerQuestionAlert("Slots leeren", `Möchtest du wirklich alle ${S.state.slots.length} Slots leeren?`).then((res) => {
            if (res && res.isConfirmed) doClear();
        });
    };


    S.openSlotAssignModal = openSlotAssignModal;
    S.prepareVdoNinjaUrl = prepareVdoNinjaUrl;
    S.renderSlotOverviewGrid = renderSlotOverviewGrid;
    S.renderSlots = renderSlots;
    S.updateSlotUI = updateSlotUI;
})(window.StreamApp);
