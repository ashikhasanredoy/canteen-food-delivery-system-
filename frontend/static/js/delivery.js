// ──────────────────────────────────────────────────────────────
//  Delivery Boy Dashboard — University Canteen Food Delivery
// ──────────────────────────────────────────────────────────────

let currentAuthMode = 'login';
let _autoRefreshTimer = null;

// ── Auth Tab Switching ────────────────────────────────────────
function switchAuthTab(mode) {
    currentAuthMode = mode;
    const tabLogin    = document.getElementById('tab-delivery-login');
    const tabRegister = document.getElementById('tab-delivery-register');
    const authTitle   = document.getElementById('delivery-auth-title');
    const authSubtitle = document.getElementById('delivery-auth-subtitle');
    const authHelpText = document.getElementById('delivery-auth-help-text');
    const authSubmitBtn = document.getElementById('delivery-auth-submit-btn');

    if (mode === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        authTitle.textContent      = 'Delivery Login';
        authSubtitle.textContent   = 'University Canteen • Food Delivery';
        authHelpText.textContent   = 'Enter your 9 to 11-digit registered ID.';
        authSubmitBtn.innerHTML    = '<span>Login</span> <i class="bi bi-arrow-right"></i>';
    } else {
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        authTitle.textContent      = 'Register Delivery';
        authSubtitle.textContent   = 'Create a permanent delivery boy profile';
        authHelpText.textContent   = 'This ID and Name will be locked for delivery.';
        authSubmitBtn.innerHTML    = '<span>Register &amp; Start</span> <i class="bi bi-arrow-right"></i>';
    }
}

// ── DOMContentLoaded ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    checkSession();

    // Bind auth tabs
    const tabLogin    = document.getElementById('tab-delivery-login');
    const tabRegister = document.getElementById('tab-delivery-register');
    if (tabLogin)    tabLogin.addEventListener('click',    () => switchAuthTab('login'));
    if (tabRegister) tabRegister.addEventListener('click', () => switchAuthTab('register'));

    // Auth Form Submit
    const loginForm = document.getElementById('delivery-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name           = document.getElementById('delivery_boy_name').value.trim();
            const deliveryBoyId  = document.getElementById('delivery_boy_id').value.trim();
            const endpoint       = currentAuthMode === 'login' ? 'login' : 'register';

            try {
                const response = await fetch(`${API_BASE_URL}/delivery/${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, delivery_boy_id: deliveryBoyId })
                });

                if (response.ok) {
                    const data = await response.json();
                    sessionStorage.setItem('delivery_boy_name', data.name);
                    sessionStorage.setItem('delivery_boy_id',   data.delivery_boy_id);
                    sessionStorage.setItem('delivery_status',   'Online');
                    showToast(data.message || `Access granted! Welcome, ${data.name}`, 'success');
                    checkSession();
                } else {
                    const err = await response.json();
                    showToast(err.detail || 'Access Denied', 'danger');
                }
            } catch (error) {
                console.error('Auth error:', error);
                showToast('Network error, check backend server', 'danger');
            }
        });
    }

    // Verify Delivery Form Submit
    const verifyForm = document.getElementById('verify-form');
    if (verifyForm) {
        verifyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentBoyId = sessionStorage.getItem('delivery_boy_id');
            const verifyData = {
                order_id:        parseInt(document.getElementById('verify_order_id').value),
                student_id:      document.getElementById('verify_student_id').value,
                delivery_boy_id: currentBoyId
            };

            try {
                const response = await fetch(`${API_BASE_URL}/delivery/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(verifyData)
                });

                if (response.ok) {
                    const data = await response.json();
                    showToast(data.message || 'Delivery Completed! ✅', 'success');
                    const modalEl = document.getElementById('verifyModal');
                    const modal   = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                    modal.hide();
                    verifyForm.reset();
                    loadPendingOrders();
                } else {
                    const err = await response.json();
                    showToast(err.detail || 'Invalid Student ID', 'danger');
                }
            } catch (error) {
                console.error('Verify error:', error);
                showToast('Network error', 'danger');
            }
        });
    }
});

// ── Session Management ────────────────────────────────────────
function checkSession() {
    const name = sessionStorage.getItem('delivery_boy_name');
    const id   = sessionStorage.getItem('delivery_boy_id');
    const loginView     = document.getElementById('delivery-login-view');
    const dashboardView = document.getElementById('delivery-dashboard-view');

    if (name && id) {
        if (loginView)     loginView.classList.add('d-none');
        if (dashboardView) dashboardView.classList.remove('d-none');
        loadPendingOrders();
        startAutoRefresh();
    } else {
        if (loginView)     loginView.classList.remove('d-none');
        if (dashboardView) dashboardView.classList.add('d-none');
        stopAutoRefresh();
    }
}

function startAutoRefresh() {
    stopAutoRefresh();
    _autoRefreshTimer = setInterval(loadPendingOrders, 10000); // every 10 seconds
}

function stopAutoRefresh() {
    if (_autoRefreshTimer) {
        clearInterval(_autoRefreshTimer);
        _autoRefreshTimer = null;
    }
}

async function logoutDeliveryBoy() {
    const id = sessionStorage.getItem('delivery_boy_id');
    if (id) {
        try {
            await fetch(`${API_BASE_URL}/delivery/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delivery_boy_id: id, status: 'Offline' })
            });
        } catch (e) {
            console.warn('Failed to update status to Offline during logout', e);
        }
    }
    stopAutoRefresh();
    sessionStorage.removeItem('delivery_boy_name');
    sessionStorage.removeItem('delivery_boy_id');
    sessionStorage.removeItem('delivery_status');
    showToast('Logged out successfully', 'info');
    checkSession();
}

// ── Load Orders ───────────────────────────────────────────────
async function loadPendingOrders() {
    const currentBoyId = sessionStorage.getItem('delivery_boy_id');
    if (!currentBoyId) return;

    try {
        // Load both active + completed for stats
        const [pendingRes, allRes] = await Promise.all([
            fetch(`${API_BASE_URL}/orders/pending`),
            fetch(`${API_BASE_URL}/orders`)
        ]);
        const orders    = await pendingRes.json();
        const allOrders = await allRes.json();

        // ── Compute stats ──────────────────────────────────────
        let pendingCount   = 0;
        let completedCount = 0;
        let totalIncome    = 0;

        allOrders.forEach(o => {
            if (o.delivery_boy_id === currentBoyId) {
                if (o.status === 'Delivered') {
                    completedCount++;
                    const fee = (o.delivery_fee && o.delivery_fee > 0)
                        ? o.delivery_fee
                        : Math.round((o.total_price || 0) * 0.01 * 100) / 100;
                    totalIncome += fee;
                } else if (['Pending', 'On Road'].includes(o.status)) {
                    pendingCount++;
                }
            }
        });

        document.getElementById('stats-pending-count').textContent   = pendingCount;
        document.getElementById('stats-completed-count').textContent = completedCount;
        const incomeEl = document.getElementById('stats-income-total');
        if (incomeEl) incomeEl.textContent = formatCurrency(totalIncome);

        // ── Render table ───────────────────────────────────────
        const tbody = document.getElementById('orders-list');
        tbody.innerHTML = '';

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center py-5 text-muted"><i class="bi bi-check-circle fs-4 d-block mb-2 text-success"></i>No pending orders right now. Great job!</td></tr>';
            return;
        }

        orders.forEach(order => {
            const isAssignedToMe    = order.delivery_boy_id === currentBoyId;
            const isAssignedToOther = order.delivery_boy_id && order.delivery_boy_id !== currentBoyId;

            const tr = document.createElement('tr');
            if (isAssignedToMe) tr.classList.add('table-primary', 'bg-opacity-10');
            if (isAssignedToOther) tr.classList.add('opacity-60');

            const statusBadge = getStatusBadge(order, currentBoyId);

            tr.innerHTML = `
                <td class="fw-bold">#${order.id}</td>
                <td class="fw-medium">${order.student_name}</td>
                <td><code>${order.student_id}</code></td>
                <td>
                    <div class="fw-medium">${order.food_name || 'Unknown Food'}</div>
                    <small class="text-muted opacity-75">${order.shop_name || ''}</small>
                </td>
                <td><span class="badge bg-light text-dark border p-2"><i class="bi bi-geo-alt"></i> ${order.delivery_location}</span></td>
                <td class="fw-bold">${order.quantity}</td>
                <td class="fw-bold text-primary">${formatCurrency(order.total_price)}</td>
                <td>${statusBadge}</td>
                <td>${getActionHtml(order, currentBoyId)}</td>
            `;
            tbody.appendChild(tr);
        });

        if (tbody.children.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center py-5 text-muted">No available orders right now.</td></tr>';
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        const tbody = document.getElementById('orders-list');
        if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger py-4"><i class="bi bi-wifi-off me-2"></i>Error loading orders. Retrying...</td></tr>';
    }
}

// ── Status Badge ──────────────────────────────────────────────
function getStatusBadge(order, currentBoyId) {
    if (order.delivery_boy_id === currentBoyId) {
        if (order.status === 'On Road') {
            return '<span class="badge rounded-pill bg-info text-white px-3 py-2"><i class="bi bi-bicycle me-1"></i>On Road</span>';
        }
        return '<span class="badge rounded-pill bg-primary px-3 py-2"><i class="bi bi-person-check me-1"></i>Accepted by You</span>';
    }
    if (order.delivery_boy_id) {
        return '<span class="badge rounded-pill bg-secondary px-3 py-2"><i class="bi bi-lock-fill me-1"></i>Taken</span>';
    }
    return '<span class="badge rounded-pill bg-success px-3 py-2"><i class="bi bi-circle me-1"></i>Available</span>';
}

// ── Action Buttons ────────────────────────────────────────────
function getActionHtml(order, currentBoyId) {
    // ── Order taken by another boy ─────────────────────────────
    if (order.delivery_boy_id && order.delivery_boy_id !== currentBoyId) {
        return `<span class="text-muted small fst-italic">
                    <i class="bi bi-lock-fill me-1 text-secondary"></i>
                    Taken by another delivery boy
                </span>`;
    }

    // ── Order accepted by ME ───────────────────────────────────
    if (order.delivery_boy_id === currentBoyId && order.delivery_request_status === 'Accepted') {
        if (order.status === 'Pending') {
            return `
                <div class="d-flex gap-2 flex-wrap">
                    <button class="btn btn-sm btn-primary rounded-pill px-3 fw-medium"
                            onclick="pickupDelivery(${order.id})">
                        <i class="bi bi-bicycle me-1"></i>Pick Up
                    </button>
                    <button class="btn btn-sm btn-outline-danger rounded-pill px-3 fw-medium"
                            onclick="cancelDelivery(${order.id})">
                        <i class="bi bi-x-circle me-1"></i>Cancel
                    </button>
                </div>`;
        }
        if (order.status === 'On Road') {
            return `<button class="btn btn-sm btn-info text-white rounded-pill px-3 fw-medium"
                            onclick="openVerifyModal(${order.id})">
                        <i class="bi bi-check-circle me-1"></i>Complete Delivery
                    </button>`;
        }
    }

    // ── Order unassigned — show Accept button ──────────────────
    if (!order.delivery_boy_id || order.delivery_request_status === 'None') {
        return `<button class="btn btn-sm btn-success text-white rounded-pill px-4 fw-medium"
                        onclick="acceptDelivery(${order.id})">
                    <i class="bi bi-hand-index me-1"></i>Accept Delivery
                </button>`;
    }

    return '';
}

// ── Accept Delivery ───────────────────────────────────────────
async function acceptDelivery(orderId) {
    const currentBoyId = sessionStorage.getItem('delivery_boy_id');
    if (!currentBoyId) { showToast('Please log in first', 'warning'); return; }

    try {
        const response = await fetch(`${API_BASE_URL}/delivery/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId, delivery_boy_id: currentBoyId })
        });

        const data = await response.json();

        if (response.ok) {
            showToast(data.message || '✅ Order accepted! It is now locked to you.', 'success');
            loadPendingOrders();
        } else if (response.status === 409) {
            showToast('⚠️ ' + (data.detail || 'This order has already been accepted by another delivery boy.'), 'warning');
            loadPendingOrders(); // Refresh to show locked state
        } else {
            showToast(data.detail || 'Error accepting delivery', 'danger');
        }
    } catch (error) {
        console.error('Accept error:', error);
        showToast('Network error', 'danger');
    }
}

// ── Cancel Delivery ───────────────────────────────────────────
async function cancelDelivery(orderId) {
    const currentBoyId = sessionStorage.getItem('delivery_boy_id');
    if (!currentBoyId) return;

    const confirmed = window.confirm('Cancel this delivery? The order will become available for other delivery boys.');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_BASE_URL}/delivery/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId, delivery_boy_id: currentBoyId })
        });

        const data = await response.json();

        if (response.ok) {
            showToast(data.message || 'Delivery cancelled. Order is now available.', 'info');
            loadPendingOrders();
        } else {
            showToast(data.detail || 'Error cancelling delivery', 'danger');
        }
    } catch (error) {
        console.error('Cancel error:', error);
        showToast('Network error', 'danger');
    }
}

// ── Pickup Delivery ───────────────────────────────────────────
async function pickupDelivery(orderId) {
    const currentBoyId = sessionStorage.getItem('delivery_boy_id');
    if (!currentBoyId) return;

    try {
        const response = await fetch(`${API_BASE_URL}/delivery/pickup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId, delivery_boy_id: currentBoyId })
        });

        if (response.ok) {
            showToast('Order picked up! Drive safe 🛵', 'success');
            loadPendingOrders();
        } else {
            const err = await response.json();
            showToast(err.detail || 'Error picking up order', 'danger');
        }
    } catch (error) {
        console.error('Pickup error:', error);
        showToast('Network error', 'danger');
    }
}

// ── Verify & Complete Delivery Modal ──────────────────────────
function openVerifyModal(orderId) {
    document.getElementById('verify_order_id').value = orderId;
    document.getElementById('verify_student_id').value = '';
    document.getElementById('verify_delivery_boy_id').value = sessionStorage.getItem('delivery_boy_id');

    const modalEl = document.getElementById('verifyModal');
    const modal   = new bootstrap.Modal(modalEl);
    modal.show();

    setTimeout(() => {
        document.getElementById('verify_student_id').focus();
    }, 500);
}
