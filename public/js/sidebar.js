(function () {
    var trigger = document.getElementById('sidebar-trigger');
    var sidebar = document.getElementById('user-sidebar');
    var backdrop = document.getElementById('sidebar-backdrop');
    var closeBtn = document.getElementById('sidebar-close');
    if (!trigger || !sidebar || !backdrop || !closeBtn) return;

    function isOpen() { return sidebar.classList.contains('is-open'); }

    function openSidebar() {
        sidebar.classList.add('is-open');
        backdrop.classList.add('is-open');
        document.body.classList.add('sidebar-open');
        trigger.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(function () { closeBtn.focus({ preventScroll: true }); });
    }

    function closeSidebar(returnFocus) {
        sidebar.classList.remove('is-open');
        backdrop.classList.remove('is-open');
        document.body.classList.remove('sidebar-open');
        trigger.setAttribute('aria-expanded', 'false');
        if (returnFocus) trigger.focus({ preventScroll: true });
    }

    trigger.addEventListener('click', function () {
        if (isOpen()) closeSidebar(true); else openSidebar();
    });
    closeBtn.addEventListener('click', function () { closeSidebar(true); });
    backdrop.addEventListener('click', function () { closeSidebar(true); });

    document.addEventListener('keydown', function (e) {
        if (!isOpen()) return;

        if (e.key === 'Escape') {
            closeSidebar(true);
            return;
        }

        // ให้ Tab วนอยู่ภายใน sidebar ขณะเปิด
        if (e.key === 'Tab') {
            var items = sidebar.querySelectorAll('a[href], button:not([disabled])');
            if (!items.length) return;
            var first = items[0];
            var last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });
})();
