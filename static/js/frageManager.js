(function (S) {
    // =========================================================================
    // Fragen-Manager Modal (Erstellen, Bearbeiten, Löschen)
    // =========================================================================

    window.openCardManagerModal = function () {
        S.state.insertTargetIndex = (S.state.cards && S.state.activeCardIndex >= 0 && S.state.activeCardIndex < S.state.cards.length) ? S.state.activeCardIndex + 1 : (S.state.cards ? S.state.cards.length : 0);
        resetCardForm(S.state.insertTargetIndex);
        renderCardManagerList();
        openModal('cardManagerModal');
    };

    window.closeCardManagerModal = function () {
        closeModal('cardManagerModal');
    };

    function createInsertMarkerElement(pos) {
        const marker = document.createElement('div');
        marker.className = 'card-insert-marker my-2 is-flex is-align-items-center';
        marker.style.cursor = 'default';
        marker.innerHTML = `
            <div style="flex: 1; height: 2px; background: linear-gradient(90deg, transparent, rgba(72, 199, 142, 0.8), rgba(62, 142, 208, 0.8)); border-radius: 2px;"></div>
            <span class="tag is-success is-light is-rounded is-small" style="font-size: 0.72rem; padding: 2px 10px; border: 1px dashed #48c78e; font-weight: 600; box-shadow: 0 2px 8px rgba(72, 199, 142, 0.25); background-color: rgba(72, 199, 142, 0.15); color: #48c78e;">
                <i class="fas fa-plus-circle mr-1"></i>Hier einfügen (Position ${pos + 1})
            </span>
            <div style="flex: 1; height: 2px; background: linear-gradient(90deg, rgba(62, 142, 208, 0.8), rgba(72, 199, 142, 0.8), transparent); border-radius: 2px;"></div>
        `;
        return marker;
    }

    function renderCardManagerList() {
        const listContainer = document.getElementById('cardManagerList');
        if (!listContainer) return;

        listContainer.innerHTML = "";

        if (!S.state.cards || S.state.cards.length === 0) {
            listContainer.innerHTML = '<p class="has-text-grey-light p-3 is-size-7">Noch keine Fragen oder Aufgaben vorhanden. Erstelle unten deine erste Frage!</p>';
            return;
        }

        const effectiveInsertIndex = (typeof S.state.insertTargetIndex === 'number' && S.state.insertTargetIndex >= 0 && S.state.insertTargetIndex <= S.state.cards.length)
            ? S.state.insertTargetIndex
            : ((S.state.activeCardIndex >= 0 && S.state.activeCardIndex < S.state.cards.length) ? S.state.activeCardIndex + 1 : S.state.cards.length);

        if (!S.state.editingCardId && effectiveInsertIndex === 0) {
            listContainer.appendChild(createInsertMarkerElement(0));
        }

        S.state.cards.forEach((card, idx) => {
            const row = document.createElement('div');
            const isSelected = (idx === S.state.activeCardIndex);
            const isEditing = (S.state.editingCardId && String(card.id) === String(S.state.editingCardId));
            row.className = 'p-3 mb-2 is-flex is-align-items-center is-justify-content-space-between card-manager-item' 
                + (isSelected ? ' is-selected' : '') 
                + (isEditing ? ' is-editing' : '');

            const isPlaceholder = S.isCardPlaceholder(card);

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
                <div style="flex: 1; overflow: hidden; padding-right: 12px; cursor: pointer;" onclick="editCardInForm('${card.id}', ${idx})" title="Klicken um diese Frage zu bearbeiten und auszuwählen">
                    <strong>${idx + 1}. ${card.title || 'Kein Titel'}</strong> ${placeholderBadge} ${imageBadge} ${audioBadge} ${timerBadge}
                    <div class="is-size-7" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.8;">${displayText}</div>
                </div>
                <div class="buttons are-small mb-0" style="flex-shrink: 0;" onclick="event.stopPropagation()">
                    <button class="button is-small" onclick="moveCard(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Nach oben">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    <button class="button is-small" onclick="moveCard(${idx}, 1)" ${idx === S.state.cards.length - 1 ? 'disabled' : ''} title="Nach unten">
                        <i class="fas fa-arrow-down"></i>
                    </button>
                    <button class="button is-danger is-small" onclick="deleteQuizCard('${card.id}', ${idx})" title="Löschen">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            listContainer.appendChild(row);

            if (!S.state.editingCardId && effectiveInsertIndex === (idx + 1)) {
                listContainer.appendChild(createInsertMarkerElement(idx + 1));
            }
        });

        if (!S.state.editingCardId) {
            const marker = listContainer.querySelector('.card-insert-marker');
            if (marker) {
                try {
                    marker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } catch (e) {}
            }
        }
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
        let card = S.state.cards.find(c => String(c.id) === String(cardId));
        if (!card && typeof fallbackIndex === 'number' && fallbackIndex >= 0 && fallbackIndex < S.state.cards.length) {
            card = S.state.cards[fallbackIndex];
        }
        if (!card) return;

        S.state.editingCardId = card.id;

        // Als aktive Frage synchronisieren
        let cardIdx = S.state.cards.findIndex(c => String(c.id) === String(card.id));
        if (cardIdx === -1 && typeof fallbackIndex === 'number') cardIdx = fallbackIndex;
        if (cardIdx >= 0 && S.state.activeCardIndex !== cardIdx) {
            if (typeof window.hostStopAudio === 'function') window.hostStopAudio();
            S.state.activeCardIndex = cardIdx;
            S.saveActiveCardIndex();
            S.renderMiddleCard();
            S.updateControlBar();
        }
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
        updateCardFormHeader();
        renderCardManagerList();
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
                S.triggerErrorAlert("Audiofehler", "Audiodatei konnte nicht abgespielt werden. Bitte URL/Format prüfen.");
            });

            previewPlayer.onended = function () {
                if (previewBtn) {
                    previewBtn.classList.add('is-outlined');
                    previewBtn.innerHTML = '<i class="fas fa-play" id="cardAudioPreviewIcon"></i>&nbsp;Probehören';
                }
            };
        }
    };

    function updateCardFormHeader() {
        const formTitle = document.getElementById('cardFormTitle');
        if (!formTitle) return;

        if (S.state.editingCardId) {
            const editIdx = S.state.cards.findIndex(c => String(c.id) === String(S.state.editingCardId));
            formTitle.innerHTML = `<span><i class="fas fa-edit mr-2 has-text-info"></i>Frage #${editIdx + 1} bearbeiten</span>`;
        } else {
            const effectiveInsertIndex = (typeof S.state.insertTargetIndex === 'number' && S.state.insertTargetIndex >= 0 && S.state.insertTargetIndex <= (S.state.cards ? S.state.cards.length : 0))
                ? S.state.insertTargetIndex
                : ((S.state.cards && S.state.activeCardIndex >= 0 && S.state.activeCardIndex < S.state.cards.length) ? S.state.activeCardIndex + 1 : (S.state.cards ? S.state.cards.length : 0));

            if (!S.state.cards || S.state.cards.length === 0) {
                formTitle.innerHTML = `<span><i class="fas fa-plus-circle mr-2 has-text-success"></i>Erste Frage erstellen</span>`;
            } else if (effectiveInsertIndex === 0) {
                formTitle.innerHTML = `
                    <span><i class="fas fa-plus-circle mr-2 has-text-success"></i>Neue Frage erstellen</span>
                    <span class="tag is-info is-light">Ganz an den Anfang</span>
                    <span class="is-size-7 ml-2" style="font-weight: normal;">
                        <a href="javascript:void(0)" onclick="setInsertTargetPosition('end')" class="has-text-info"><i class="fas fa-arrow-down mr-1"></i>Stattdessen ans Ende</a>
                    </span>
                `;
            } else if (effectiveInsertIndex >= S.state.cards.length) {
                const afterActiveLink = (S.state.activeCardIndex < S.state.cards.length - 1)
                    ? `<span class="has-text-grey-light mx-1">&bull;</span><a href="javascript:void(0)" onclick="setInsertTargetPosition(${S.state.activeCardIndex + 1})" class="has-text-info"><i class="fas fa-level-down-alt mr-1"></i>Nach aktiver Frage (#${S.state.activeCardIndex + 1})</a>`
                    : '';
                formTitle.innerHTML = `
                    <span><i class="fas fa-plus-circle mr-2 has-text-success"></i>Neue Frage erstellen</span>
                    <span class="tag is-info is-light">Wird am Ende angehängt (Pos. ${S.state.cards.length + 1})</span>
                    <span class="is-size-7 ml-2" style="font-weight: normal;">
                        <a href="javascript:void(0)" onclick="setInsertTargetPosition('start')" class="has-text-info"><i class="fas fa-arrow-up mr-1"></i>Ganz an den Anfang</a>
                        ${afterActiveLink}
                    </span>
                `;
            } else {
                const prevCard = S.state.cards[effectiveInsertIndex - 1];
                const prevTitle = prevCard && prevCard.title ? ` (${prevCard.title.length > 18 ? prevCard.title.slice(0, 16) + '...' : prevCard.title})` : '';
                formTitle.innerHTML = `
                    <span><i class="fas fa-plus-circle mr-2 has-text-success"></i>Neue Frage erstellen</span>
                    <span class="tag is-success is-light">Wird nach Frage #${effectiveInsertIndex}${prevTitle} eingefügt</span>
                    <span class="is-size-7 ml-2" style="font-weight: normal;">
                        <a href="javascript:void(0)" onclick="setInsertTargetPosition('end')" class="has-text-info mr-2"><i class="fas fa-arrow-down mr-1"></i>Ans Ende</a>
                        <span class="has-text-grey-light mr-2">&bull;</span>
                        <a href="javascript:void(0)" onclick="setInsertTargetPosition('start')" class="has-text-info"><i class="fas fa-arrow-up mr-1"></i>Ganz oben</a>
                    </span>
                `;
            }
        }
    }

    window.setInsertTargetPosition = function (pos) {
        if (!S.state.cards || S.state.cards.length === 0) {
            S.state.insertTargetIndex = 0;
        } else if (pos === 'end') {
            S.state.insertTargetIndex = S.state.cards.length;
        } else if (pos === 'start') {
            S.state.insertTargetIndex = 0;
        } else if (typeof pos === 'number') {
            S.state.insertTargetIndex = Math.max(0, Math.min(pos, S.state.cards.length));
        }
        updateCardFormHeader();
        renderCardManagerList();
    };

    function resetCardForm(explicitTargetIndex) {
        S.state.editingCardId = null;
        if (typeof explicitTargetIndex === 'number') {
            S.state.insertTargetIndex = Math.max(0, Math.min(explicitTargetIndex, S.state.cards ? S.state.cards.length : 0));
        } else {
            S.state.insertTargetIndex = (S.state.cards && S.state.activeCardIndex >= 0 && S.state.activeCardIndex < S.state.cards.length) ? S.state.activeCardIndex + 1 : (S.state.cards ? S.state.cards.length : 0);
        }

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
        updateCardFormHeader();
        renderCardManagerList();
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

        const targetPos = (typeof S.state.insertTargetIndex === 'number' && S.state.insertTargetIndex >= 0 && S.state.insertTargetIndex <= S.state.cards.length)
            ? S.state.insertTargetIndex
            : ((S.state.activeCardIndex >= 0 && S.state.activeCardIndex < S.state.cards.length) ? S.state.activeCardIndex + 1 : S.state.cards.length);

        S.state.cards.splice(targetPos, 0, newCard);
        S.state.activeCardIndex = targetPos;
        S.state.insertTargetIndex = S.state.activeCardIndex + 1;

        S.saveCards();
        S.saveActiveCardIndex();
        renderCardManagerList();
        S.renderMiddleCard();
        S.updateControlBar();
        resetCardForm(S.state.insertTargetIndex);
        renderCardManagerList();
        S.triggerSuccessAlert("Platzhalter hinzugefügt", `Platzhalter an Position ${targetPos + 1} eingefügt.`);
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
        const isPlaceholder = S.isCardPlaceholder({ title: title });

        if (imageOnly && !image) {
            S.triggerErrorAlert("Bild fehlt", "Bitte wähle ein Bild aus (oder trage eine Bild-URL ein), da 'Bild statt Frage anzeigen' aktiviert ist.");
            return;
        }

        if (!isPlaceholder && !imageOnly && !question && !image && !audio) {
            S.triggerErrorAlert("Fehlende Eingabe", "Bitte gib einen Fragetext ein oder hinterlege ein Bild bzw. eine Audiodatei.");
            return;
        }

        if (S.state.editingCardId) {
            const card = S.state.cards.find(c => String(c.id) === String(S.state.editingCardId));
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

            const targetPos = (typeof S.state.insertTargetIndex === 'number' && S.state.insertTargetIndex >= 0 && S.state.insertTargetIndex <= S.state.cards.length)
                ? S.state.insertTargetIndex
                : ((S.state.activeCardIndex >= 0 && S.state.activeCardIndex < S.state.cards.length) ? S.state.activeCardIndex + 1 : S.state.cards.length);

            S.state.cards.splice(targetPos, 0, newCard);
            S.state.activeCardIndex = targetPos;
            S.state.insertTargetIndex = S.state.activeCardIndex + 1;
        }

        S.saveCards();
        S.saveActiveCardIndex();
        renderCardManagerList();
        S.renderMiddleCard();
        S.updateControlBar();
        resetCardForm(S.state.insertTargetIndex);
        renderCardManagerList();
        S.triggerSuccessAlert("Gespeichert", "Frage/Aufgabe erfolgreich gespeichert.");
    };

    window.deleteQuizCard = function (cardId, fallbackIndex) {
        const doDelete = () => {
            let deleted = false;
            if (cardId !== undefined && cardId !== null && cardId !== 'undefined') {
                const beforeLen = S.state.cards.length;
                S.state.cards = S.state.cards.filter(c => String(c.id) !== String(cardId));
                if (S.state.cards.length < beforeLen) {
                    deleted = true;
                }
            }
            if (!deleted && typeof fallbackIndex === 'number' && fallbackIndex >= 0 && fallbackIndex < S.state.cards.length) {
                S.state.cards.splice(fallbackIndex, 1);
                deleted = true;
            }
            if (!deleted && S.state.cards.length > 0) {
                const idx = (typeof fallbackIndex === 'number') ? fallbackIndex : S.state.activeCardIndex;
                if (idx >= 0 && idx < S.state.cards.length) {
                    S.state.cards.splice(idx, 1);
                }
            }
            if (String(S.state.editingCardId) === String(cardId)) {
                resetCardForm();
            }
            S.state.activeCardIndex = Math.max(0, Math.min(S.state.activeCardIndex, S.state.cards.length - 1));
            if (!S.state.editingCardId) {
                S.state.insertTargetIndex = (S.state.cards && S.state.cards.length > 0) ? S.state.activeCardIndex + 1 : 0;
                updateCardFormHeader();
            }
            S.saveCards();
            S.saveActiveCardIndex();
            renderCardManagerList();
            S.renderMiddleCard();
            S.updateControlBar();
            S.triggerSuccessAlert("Gelöscht", "Der Eintrag wurde entfernt.");
        };

        S.triggerQuestionAlert("Löschen bestätigen", "Möchtest du diese Frage bzw. diesen Platzhalter wirklich löschen?").then((result) => {
            if (result && result.isConfirmed) {
                doDelete();
            }
        });
    };
    window.deleteCard = window.deleteQuizCard;

    window.moveCard = function (index, direction) {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= S.state.cards.length) return;

        const temp = S.state.cards[index];
        S.state.cards[index] = S.state.cards[targetIndex];
        S.state.cards[targetIndex] = temp;

        if (S.state.activeCardIndex === index) {
            S.state.activeCardIndex = targetIndex;
        } else if (S.state.activeCardIndex === targetIndex) {
            S.state.activeCardIndex = index;
        }

        if (!S.state.editingCardId) {
            S.state.insertTargetIndex = S.state.activeCardIndex + 1;
            updateCardFormHeader();
        }

        S.saveCards();
        S.saveActiveCardIndex();
        renderCardManagerList();
        S.renderMiddleCard();
        S.updateControlBar();
    };

    const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

    window.uploadCardImage = async function (fileInput) {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const file = fileInput.files[0];

        // Sofortige clientseitige Prüfung der Dateigröße
        if (file.size > MAX_UPLOAD_BYTES) {
            const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
            fileInput.value = "";
            S.triggerErrorAlert("Datei zu groß", `Die ausgewählte Bilddatei ist ${sizeMb} MB groß. Das Upload-Limit beträgt maximal 10 MB.`);
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        const status = document.getElementById('cardImageStatus');
        if (status) status.textContent = "Wird hochgeladen...";

        try {
            const res = await fetch("/upload", { method: "POST", body: formData });
            if (!res.ok) {
                if (res.status === 413) {
                    throw new Error("Die Bilddatei ist zu groß (maximal 10 MB erlaubt).");
                }
                const text = await res.text();
                let errJson;
                try { errJson = JSON.parse(text); } catch (e) {}
                throw new Error((errJson && errJson.error) || `Serverfehler beim Upload (HTTP ${res.status})`);
            }
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (jsonErr) {
                console.error("Server-Antwort war kein gültiges JSON:", text);
                throw new Error("Unerwartete Server-Antwort (kein JSON empfangen). Möglicherweise blockiert der Webserver die Datei.");
            }
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
            S.triggerErrorAlert("Upload-Fehler", err.message || "Fehler beim Hochladen des Bildes.");
        }
    };

    window.uploadCardAudio = async function (fileInput) {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const file = fileInput.files[0];

        // Sofortige clientseitige Prüfung der Dateigröße
        if (file.size > MAX_UPLOAD_BYTES) {
            const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
            fileInput.value = "";
            S.triggerErrorAlert("Datei zu groß", `Die ausgewählte Audiodatei ist ${sizeMb} MB groß. Das Upload-Limit beträgt maximal 10 MB.`);
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        const status = document.getElementById('cardAudioStatus');
        if (status) status.textContent = "Wird hochgeladen...";

        try {
            const res = await fetch("/upload", { method: "POST", body: formData });
            if (!res.ok) {
                if (res.status === 413) {
                    throw new Error("Die Audiodatei ist zu groß (maximal 10 MB erlaubt).");
                }
                const text = await res.text();
                let errJson;
                try { errJson = JSON.parse(text); } catch (e) {}
                throw new Error((errJson && errJson.error) || `Serverfehler beim Upload (HTTP ${res.status})`);
            }
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (jsonErr) {
                console.error("Server-Antwort war kein gültiges JSON:", text);
                throw new Error("Unerwartete Server-Antwort (kein JSON empfangen). Möglicherweise blockiert der Webserver die Datei.");
            }
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
            S.triggerErrorAlert("Upload-Fehler", err.message || "Fehler beim Hochladen der Audiodatei.");
        }
    };

    // =========================================================================
    // Import & Export System
    // =========================================================================

    window.exportQuizPackage = function () {
        // Falls gerade eine Frage im Formular aktiv bearbeitet wird, Änderungen vorab sichern
        if (S.state.editingCardId) {
            const currentEditing = S.state.cards.find(c => String(c.id) === String(S.state.editingCardId));
            if (currentEditing) {
                const titleVal = document.getElementById('cardTitleInput') ? document.getElementById('cardTitleInput').value.trim() : '';
                const qVal = document.getElementById('cardQuestionInput') ? document.getElementById('cardQuestionInput').value.trim() : '';
                const aVal = document.getElementById('cardAnswerInput') ? document.getElementById('cardAnswerInput').value.trim() : '';
                const imgVal = document.getElementById('cardImageInput') ? document.getElementById('cardImageInput').value.trim() : '';
                const audVal = document.getElementById('cardAudioInput') ? document.getElementById('cardAudioInput').value.trim() : '';
                const loopVal = document.getElementById('cardAudioLoopInput') ? document.getElementById('cardAudioLoopInput').checked : false;
                const timerVal = document.getElementById('cardTimerInput') ? document.getElementById('cardTimerInput').value.trim() : '';
                const imgOnlyVal = document.getElementById('cardImageOnlyInput') ? document.getElementById('cardImageOnlyInput').checked : false;

                if (titleVal) currentEditing.title = titleVal;
                currentEditing.question = qVal;
                currentEditing.answer = aVal;
                currentEditing.image = imgVal;
                currentEditing.imageOnly = imgOnlyVal;
                currentEditing.audio = audVal;
                currentEditing.audioLoop = loopVal;
                currentEditing.timer = (timerVal && parseInt(timerVal, 10) > 0) ? parseInt(timerVal, 10) : null;
                S.saveCards();
            }
        }

        function triggerDownload(includeSlots) {
            const exportData = {
                version: "1.0",
                exportedAt: new Date().toISOString(),
                cards: S.state.cards
            };
            if (includeSlots) {
                exportData.slots = S.state.slots;
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
            S.triggerSuccessAlert("Export erfolgreich", msg);
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
                    S.triggerErrorAlert("Ungültige Datei", "Die Datei enthält keine gültigen Fragen.");
                    fileInput.value = "";
                    return;
                }

                // Sicherstellen, dass jede importierte Karte eine eindeutige ID besitzt & Felder normalisiert sind
                importedCards.forEach((c, idx) => {
                    if (!c.id) c.id = Date.now() + idx;
                    c.audio = (c.audio || c.audioUrl || c.audio_url || c.sound || c.soundUrl || "").toString().trim();
                    c.image = (c.image || c.imageUrl || c.image_url || c.bild || "").toString().trim();
                    c.audioLoop = !!(c.audioLoop || c.loop);
                    if (S.isCardPlaceholder(c)) c.isPlaceholder = true;
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
                                    S.state.slots = importedData.slots;
                                    S.saveSlots();
                                    S.renderSlots();
                                    S.renderSlotOverviewGrid();
                                    S.updateSlotUI();
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
                            S.state.cards = importedCards;
                            S.state.activeCardIndex = 0;
                            S.saveCards();
                            S.saveActiveCardIndex();
                            renderCardManagerList();
                            S.renderMiddleCard();
                            S.updateControlBar();
                            if (window.ShowSuccessAlert) ShowSuccessAlert("Erfolgreich", `Quiz-Paket mit ${importedCards.length} Fragen geladen!`);
                            checkAndPromptSlots();
                        } else if (result.isDenied) {
                            const maxId = S.state.cards.reduce((max, c) => Math.max(max, c.id || 0), 0);
                            importedCards.forEach((c, idx) => {
                                S.state.cards.push({
                                    ...c,
                                    id: maxId + idx + 1
                                });
                            });
                            S.saveCards();
                            renderCardManagerList();
                            S.renderMiddleCard();
                            S.updateControlBar();
                            if (window.ShowSuccessAlert) ShowSuccessAlert("Erfolgreich", `${importedCards.length} Fragen wurden angehängt!`);
                        }
                        fileInput.value = "";
                    });
                } else {
                    S.state.cards = importedCards;
                    S.saveCards();
                    S.saveActiveCardIndex();
                    renderCardManagerList();
                    S.renderMiddleCard();
                    S.updateControlBar();
                    fileInput.value = "";
                    S.triggerSuccessAlert("Erfolgreich", "Import erfolgreich abgeschlossen!");
                }
            } catch (err) {
                console.error("Fehler beim Importieren:", err);
                S.triggerErrorAlert("Import-Fehler", "Fehler beim Lesen der Datei. Bitte stelle sicher, dass es eine gültige JSON-Datei ist.");
                fileInput.value = "";
            }
        };

        reader.readAsText(file);
    };


    S.createInsertMarkerElement = createInsertMarkerElement;
    S.renderCardManagerList = renderCardManagerList;
    S.resetCardForm = resetCardForm;
    S.updateCardFormHeader = updateCardFormHeader;
    S.updateQuestionRequiredLabel = updateQuestionRequiredLabel;
})(window.StreamApp);
