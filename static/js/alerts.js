const SuccessAlert = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    theme: 'dark',
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
})


/**
 * Shows a success alert dialog with a single 'Ok' button
 * @param {string} text The text of the dialog
 */
function ShowSuccesAlert(text) {
    SuccessAlert.fire({
        icon: 'success',
        title: text
    })
}

/**
 * Shows an error alert dialog with a single 'Ok' button
 * @param {string} title The title of the dialog
 * @param {string} text The text of the dialog
 */
function ShowErrorAlert(title, text) {
    Swal.fire({
        title: title,
        text: text,
        icon: 'error',
        confirmButtonText: 'Ok',
        theme: 'dark'
    })
}

/**
 * Shows a question alert dialog with a confirm and cancel button
 * @param {string} title The title of the dialog
 * @param {string} text The text of the dialog
 * @returns {Promise<any>} The promise of the Swal dialog
 */
function ShowQuestionAlert(title, text) {
    return Swal.fire({ //return, damit .then funktioniert
        title: title,
        text: text,
        icon: 'question',
        confirmButtonText: 'Löschen',
        cancelButtonText: 'Abbrechen',
        showCancelButton: true,
        cancelButtonColor: '#d33',
        theme: 'dark'
    })
}

/**
 * Shows a warning alert dialog with a confirm and cancel button
 * @param {string} title The title of the dialog
 * @param {string} text The text of the dialog
 * @returns {Promise} Resolves with true if the confirm button was clicked or false if the cancel button was clicked
 */
function ShowWarningAlert(title, text) {
    return Swal.fire({
        title: title,
        text: text,
        icon: 'warning',
        confirmButtonText: 'Löschen',
        cancelButtonText: 'Abbrechen',
        showCancelButton: true,
        cancelButtonColor: '#d33',
        theme: 'dark'
    })
}