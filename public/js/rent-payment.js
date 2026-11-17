(function () {
    var timer = document.getElementById('countdown');
    var input = document.getElementById('slip');
    var nameEl = document.getElementById('slip-name');
    var errEl = document.getElementById('slip-error');
    var expiredMsg = document.getElementById('pay-expired');
    var attachLabel = document.getElementById('attach-label');
    var nextBtn = document.getElementById('btn-next');

    var MAX_BYTES = 5 * 1024 * 1024;
    var TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    // ---- นับถอยหลัง: ใช้เวลาที่เหลือจาก server (ไม่รีเซ็ตเมื่อรีเฟรช) ----
    var remaining = Number(timer.dataset.remaining) || 0;
    var endAt = Date.now() + remaining * 1000;

    function expire() {
        timer.classList.add('is-expired');
        expiredMsg.hidden = false;
        input.disabled = true;
        attachLabel.classList.add('is-disabled');
        nextBtn.disabled = true;
        // Tell the server so the unpaid rental is cancelled immediately
        try { fetch('/rent/step4/expire', { method: 'POST', credentials: 'same-origin' }); } catch (e) {}
    }

    function tick() {
        var s = Math.max(0, Math.round((endAt - Date.now()) / 1000));
        timer.textContent = pad(Math.floor(s / 60)) + ':' + pad(s % 60);
        if (s <= 0) { clearInterval(id); expire(); }
    }

    var id = null;
    if (remaining > 0) {
        id = setInterval(tick, 1000);
    }

    // ---- เลือกไฟล์สลิป ----
    input.addEventListener('change', function () {
        errEl.hidden = true;
        var file = input.files[0];
        if (!file) { nameEl.textContent = ''; return; }

        if (TYPES.indexOf(file.type) === -1) {
            input.value = '';
            nameEl.textContent = '';
            errEl.textContent = 'Please attach a JPG, PNG or WebP image.';
            errEl.hidden = false;
            return;
        }
        if (file.size > MAX_BYTES) {
            input.value = '';
            nameEl.textContent = '';
            errEl.textContent = 'The file is larger than 5 MB.';
            errEl.hidden = false;
            return;
        }
        nameEl.textContent = file.name;
    });
})();
