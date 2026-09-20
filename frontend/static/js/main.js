/**
 * Main Application Utilities & Shared Components
 * 
 * Includes:
 * - Currency formatting for Bangladeshi Taka (৳ BDT)
 * - Toast notification manager with dynamic DOM injection
 * - Interactive Top Navbar Calendar widget
 */

// Determine base API URL dynamically from current window location
const API_BASE_URL = window.location.origin;


/**
 * Formats numeric values into standard Bangladeshi Taka currency notation (e.g. ৳250.00).
 * Uses browser Intl.NumberFormat for clean decimal and comma separators.
 */
function formatCurrency(amount) {
    return '৳' + new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount || 0);
}


/**
 * Displays modern floating toast alert notifications on the bottom-right corner of the screen.
 * 
 * How it works:
 * 1. Checks if a #toast-container element exists in the DOM; if not, creates one dynamically.
 * 2. Injects a Bootstrap 5 dismissable toast with color themes ('success', 'warning', 'danger', 'info').
 * 3. Auto-dismisses after 3000ms (3 seconds) and cleanly removes itself from the DOM tree.
 */
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
    
    // Clean up DOM node once animation finishes
    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}


// ── Navbar Calendar Widget ───────────────────────────────────────────────────
// Keeps track of the currently viewed month in the navbar calendar dropdown
let _navCalendarView = new Date();

document.addEventListener('DOMContentLoaded', () => {
    initNavCalendar();
});


/**
 * Initializes the header date pill and renders the calendar dropdown grid.
 */
function initNavCalendar() {
    updateNavCalendarDateLabel();
    renderNavCalendar();
}


/**
 * Formats and updates the top navigation date pill (e.g. "Sun, Sep 20, 2026").
 */
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


/**
 * Computes the days in the active month, identifies blank starting offset slots,
 * highlights today's active date, and renders the interactive monthly calendar grid.
 */
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

    // Empty offset cells for days before the 1st of the month
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="nav-calendar-day empty"></div>';
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = today.getFullYear() === year
            && today.getMonth() === month
            && today.getDate() === day;
        html += `<div class="nav-calendar-day${isToday ? ' today' : ''}">${day}</div>`;
    }

    html += '</div>';
    container.innerHTML = html;
}


/**
 * Moves the calendar forwards or backwards by delta months (+1 for next month, -1 for previous).
 */
function changeNavCalendarMonth(delta) {
    _navCalendarView = new Date(_navCalendarView.getFullYear(), _navCalendarView.getMonth() + delta, 1);
    renderNavCalendar();
}
