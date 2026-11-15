(function () {
    var grid = document.getElementById('cal-grid');
    var title = document.getElementById('cal-title');
    var prevBtn = document.getElementById('cal-prev');
    var nextMonthBtn = document.getElementById('cal-next');
    var hidden = document.getElementById('dates');
    var summary = document.getElementById('cal-summary');
    var clearBtn = document.getElementById('cal-clear');
    var market = document.getElementById('market');
    var shopName = document.getElementById('shop_name');
    var submitBtn = document.getElementById('btn-next');

    var DEFAULT_TEXT = "Pick one or more days.";
    var monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
    var shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var view = new Date(today.getFullYear(), today.getMonth(), 1);

    // Selected dates are kept as "YYYY-MM-DD" strings (local time, avoids timezone shifts)
    var selected = new Set(
        hidden.value ? hidden.value.split(',').filter(Boolean) : []
    );

    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function toKey(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
    function fromKey(k) {
        var p = k.split('-');
        return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    }

    function render() {
        var y = view.getFullYear();
        var m = view.getMonth();
        var firstDay = new Date(y, m, 1).getDay();
        var daysInMonth = new Date(y, m + 1, 0).getDate();

        title.textContent = monthFmt.format(view);
        prevBtn.disabled = (y === today.getFullYear() && m === today.getMonth());

        var html = '';
        for (var i = 0; i < firstDay; i++) html += '<span class="cal-blank"></span>';

        for (var d = 1; d <= daysInMonth; d++) {
            var key = toKey(y, m, d);
            var date = new Date(y, m, d);
            var isPast = date < today;
            var isSelected = selected.has(key);
            var cls = 'cal-day' + (isSelected ? ' is-selected' : '') +
                (date.getTime() === today.getTime() ? ' is-today' : '');
            html += '<button type="button" class="' + cls + '" data-date="' + key + '"' +
                ' aria-pressed="' + isSelected + '"' + (isPast ? ' disabled' : '') + '>' + d + '</button>';
        }
        grid.innerHTML = html;
    }

    function sync() {
        var keys = Array.from(selected).sort();
        hidden.value = keys.join(',');

        if (keys.length === 0) {
            summary.textContent = DEFAULT_TEXT;
            clearBtn.hidden = true;
        } else {
            summary.textContent = keys.length + (keys.length === 1 ? ' day: ' : ' days: ') +
                keys.map(function (k) { return shortFmt.format(fromKey(k)); }).join(', ');
            clearBtn.hidden = false;
        }
        submitBtn.disabled = !(market.value && shopName.value.trim() && keys.length > 0);
    }

    grid.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-date]');
        if (!btn || btn.disabled) return;
        var key = btn.dataset.date;
        if (selected.has(key)) selected.delete(key); else selected.add(key);
        btn.classList.toggle('is-selected', selected.has(key));
        btn.setAttribute('aria-pressed', selected.has(key));
        sync();
    });

    prevBtn.addEventListener('click', function () {
        view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
        render();
    });
    nextMonthBtn.addEventListener('click', function () {
        view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
        render();
    });
    clearBtn.addEventListener('click', function () {
        selected.clear();
        render();
        sync();
    });
    market.addEventListener('change', sync);
    shopName.addEventListener('input', sync);

    render();
    sync();
})();
