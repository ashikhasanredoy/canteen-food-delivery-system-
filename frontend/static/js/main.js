// Main utilities for the application

const API_BASE_URL = window.location.origin;

function formatCurrency(amount) {
    return '৳' + new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function showToast(message, type = 'success') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        toastContainer.style.zIndex = '1100';
        document.body.appendChild(toastContainer);
    }
    
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-white bg-${type} border-0 shadow-lg`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body fw-medium fs-6">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toastEl);
    
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
    
    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}

// ── Navbar Calendar (visible on all pages) ───────────────────────
let _navCalendarView = new Date();

document.addEventListener('DOMContentLoaded', () => {
    initNavCalendar();
});

function initNavCalendar() {
    updateNavCalendarDateLabel();
    renderNavCalendar();
}

function updateNavCalendarDateLabel() {
    const label = document.getElementById('nav-calendar-date');
    if (!label) return;
    const today = new Date();
    label.textContent = today.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function renderNavCalendar() {
    const container = document.getElementById('nav-calendar-widget');
    if (!container) return;

    const year = _navCalendarView.getFullYear();
    const month = _navCalendarView.getMonth();
    const today = new Date();
    const monthName = _navCalendarView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let html = `
        <div class="nav-calendar-header d-flex align-items-center justify-content-between mb-3">
            <button type="button" class="btn btn-sm btn-outline-secondary rounded-circle nav-calendar-nav-btn" onclick="changeNavCalendarMonth(-1)" aria-label="Previous month">
                <i class="bi bi-chevron-left"></i>
            </button>
            <span class="fw-bold text-dark">${monthName}</span>
            <button type="button" class="btn btn-sm btn-outline-secondary rounded-circle nav-calendar-nav-btn" onclick="changeNavCalendarMonth(1)" aria-label="Next month">
                <i class="bi bi-chevron-right"></i>
            </button>
        </div>
        <div class="nav-calendar-grid">
            ${dayNames.map(d => `<div class="nav-calendar-dayname">${d}</div>`).join('')}
    `;

    for (let i = 0; i < firstDay; i++) {
        html += '<div class="nav-calendar-day empty"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = today.getFullYear() === year
            && today.getMonth() === month
            && today.getDate() === day;
        html += `<div class="nav-calendar-day${isToday ? ' today' : ''}">${day}</div>`;
    }

    html += '</div>';
    container.innerHTML = html;
}

function changeNavCalendarMonth(delta) {
    _navCalendarView = new Date(_navCalendarView.getFullYear(), _navCalendarView.getMonth() + delta, 1);
    renderNavCalendar();
}
