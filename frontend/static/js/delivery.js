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
});

// ── Session Management ────────────────────────────────────────
let _heartbeatTimer = null;

async function checkSession() {
    let name = sessionStorage.getItem('delivery_boy_name');
    const id = sessionStorage.getItem('delivery_boy_id');
    const loginView     = document.getElementById('delivery-login-view');
    const dashboardView = document.getElementById('delivery-dashboard-view');

    if (id) {
        if (loginView)     loginView.classList.add('d-none');
        if (dashboardView) dashboardView.classList.remove('d-none');

        const nameEl = document.getElementById('dashboard-delivery-boy-name');
        const idEl   = document.getElementById('dashboard-delivery-boy-id');

        if (idEl) idEl.textContent = id;
        if (name && name !== 'undefined' && name !== 'null' && name !== 'Rider' && name !== 'Loading...') {
            if (nameEl) nameEl.textContent = name;
        }

        // Fetch authoritative profile from backend
        try {
            const res = await fetch(`${API_BASE_URL}/delivery/profile/${encodeURIComponent(id)}`);
            if (res.ok) {
                const profile = await res.json();
                if (profile && profile.name) {
                    sessionStorage.setItem('delivery_boy_name', profile.name);
                    if (nameEl) nameEl.textContent = profile.name;
                }
                if (profile && profile.delivery_boy_id && idEl) {
                    idEl.textContent = profile.delivery_boy_id;
                }
            } else {
                // Fallback query to admin delivery-boys endpoint
                const resList = await fetch(`${API_BASE_URL}/api/admin/delivery-boys`);
                if (resList.ok) {
                    const data = await resList.json();
                    const list = data.deliveryBoys || data || [];
                    const boy = list.find(b => String(b.delivery_boy_id).trim() === String(id).trim());
                    if (boy && (boy.name || boy.delivery_boy_name)) {
                        const realName = boy.name || boy.delivery_boy_name;
                        sessionStorage.setItem('delivery_boy_name', realName);
                        if (nameEl) nameEl.textContent = realName;
                    }
                }
            }
        } catch (err) {
            console.warn('Could not fetch delivery profile:', err);
        }

        loadPendingOrders();
        startAutoRefresh();
        startHeartbeat();
    } else {
        if (loginView)     loginView.classList.remove('d-none');
        if (dashboardView) dashboardView.classList.add('d-none');
        stopAutoRefresh();
        stopHeartbeat();
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

async function sendHeartbeat() {
    const id = sessionStorage.getItem('delivery_boy_id');
    const status = sessionStorage.getItem('delivery_status') || 'Online';
    if (!id || status === 'Offline') return;
    try {
        await fetch(`${API_BASE_URL}/delivery/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delivery_boy_id: id, status: 'Online' })
        });
    } catch (e) {
        console.warn('Heartbeat error', e);
    }
}

function startHeartbeat() {
    stopHeartbeat();
    sendHeartbeat();
    _heartbeatTimer = setInterval(sendHeartbeat, 15000); // Send heartbeat every 15s
}

function stopHeartbeat() {
    if (_heartbeatTimer) {
        clearInterval(_heartbeatTimer);
        _heartbeatTimer = null;
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
    stopHeartbeat();
    sessionStorage.removeItem('delivery_boy_name');
    sessionStorage.removeItem('delivery_boy_id');
    sessionStorage.removeItem('delivery_status');
    showToast('Logged out successfully', 'info');
    checkSession();
}

window.addEventListener('beforeunload', () => {
    const id = sessionStorage.getItem('delivery_boy_id');
    if (id) {
        const payload = JSON.stringify({ delivery_boy_id: id, status: 'Offline' });
        if (navigator.sendBeacon) {
            navigator.sendBeacon(`${API_BASE_URL}/delivery/status`, new Blob([payload], { type: 'application/json' }));
        } else {
            fetch(`${API_BASE_URL}/delivery/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true
            }).catch(() => {});
        }
    }
});

// ── Pagination & Filter State ─────────────────────────────────
let _allPendingOrders = [];
let _allOrders = [];
let _deliveryCurrentPage = 1;
let _deliveryPageSize = 10;
let _deliverySearchQuery = '';
let _deliveryFilter = 'all'; // 'all', 'my', 'available', 'taken'
let _deliverySort = 'newest'; // 'newest' | 'oldest'

// ── Format Date Helper ─────────────────────────────────────────
function formatDeliveryDate(dateString) {
    if (!dateString) return '';
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}

// ── Load Orders & Stats ───────────────────────────────────────
async function loadPendingOrders() {
    const currentBoyId = sessionStorage.getItem('delivery_boy_id');
    if (!currentBoyId) return;

    try {
        // Load pending deliveries queue and delivery boy stats efficiently in parallel
        const [pendingRes, statsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/orders/pending`),
            fetch(`${API_BASE_URL}/delivery/stats/${encodeURIComponent(currentBoyId)}`).catch(() => null)
        ]);

        const pendingOrders = pendingRes.ok ? await pendingRes.json() : [];
        _allPendingOrders = pendingOrders;

        if (statsRes && statsRes.ok) {
            const stats = await statsRes.json();
            const pEl = document.getElementById('stats-pending-count');
            const cEl = document.getElementById('stats-completed-count');
            const iEl = document.getElementById('stats-income-total');
            if (pEl) pEl.textContent = Number(stats.pending_count || 0).toLocaleString();
            if (cEl) cEl.textContent = Number(stats.completed_count || 0).toLocaleString();
            if (iEl) iEl.textContent = formatCurrency(stats.total_income || 0);
        }

        // ── Render paginated table ─────────────────────────────
        renderDeliveryTable();

    } catch (error) {
        console.error('Error loading orders:', error);
        const tbody = document.getElementById('orders-list');
        if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger py-4"><i class="bi bi-wifi-off me-2"></i>Error loading orders. Retrying...</td></tr>';
    }
}

// ── Filter, Search & Sort Handlers ────────────────────────────
function setDeliveryFilter(filterType, btn) {
    _deliveryFilter = filterType;
    document.querySelectorAll('#delivery-filter-group button').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _deliveryCurrentPage = 1;
    renderDeliveryTable();
}

function onDeliverySearchChange() {
    const input = document.getElementById('delivery-search-input');
    _deliverySearchQuery = (input ? input.value : '').trim().toLowerCase();
    _deliveryCurrentPage = 1;
    renderDeliveryTable();
}

function changeDeliverySort(newSort) {
    _deliverySort = newSort;
    const sortSelect = document.getElementById('delivery-sort-select');
    if (sortSelect && sortSelect.value !== newSort) sortSelect.value = newSort;
    _deliveryCurrentPage = 1;
    renderDeliveryTable();
}

function toggleDeliverySort() {
    const newSort = _deliverySort === 'newest' ? 'oldest' : 'newest';
    changeDeliverySort(newSort);
}

function changeDeliveryPageSize(newSize) {
    _deliveryPageSize = parseInt(newSize) || 10;
    _deliveryCurrentPage = 1;
    renderDeliveryTable();
}

function setDeliveryPage(page) {
    _deliveryCurrentPage = page;
    renderDeliveryTable();
}

// ── Group Multi-Shop Orders Helper ────────────────────────────
function groupOrdersForDelivery(ordersList) {
    return ordersList.map(order => {
        let items = (order.items && order.items.length > 0) ? order.items : [
            {
                id: order.id,
                food_name: order.food_name || 'Food Item',
                shop_name: order.shop_name || 'Canteen Shop',
                quantity: order.quantity || 1,
                total_price: order.total_price || 0
            }
        ];
        return {
            id: order.id,
            primary_id: order.id,
            order_ids: [order.id],
            order_group_id: order.order_group_id,
            student_name: order.student_name,
            student_id: order.student_id,
            email: order.email,
            otp_code: order.otp_code,
            phone: order.phone,
            delivery_location: order.delivery_location,
            delivery_boy_id: order.delivery_boy_id,
            delivery_request_status: order.delivery_request_status || 'None',
            status: order.status,
            created_at: order.created_at,
            total_price: order.total_price || 0,
            total_quantity: order.quantity || items.reduce((s, it) => s + (it.quantity || 1), 0),
            admin_fee: order.admin_fee || 0,
            delivery_fee: order.delivery_fee || 0,
            items: items
        };
    });
}

// ── Render Paginated Table ────────────────────────────────────
function renderDeliveryTable() {
    const currentBoyId = sessionStorage.getItem('delivery_boy_id');
    const tbody = document.getElementById('orders-list');
    const pageInfo = document.getElementById('delivery-pagination-info');
    const pageList = document.getElementById('delivery-pagination-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Update sort icon UI
    const sortIcon = document.getElementById('delivery-sort-icon');
    if (sortIcon) {
        if (_deliverySort === 'oldest') {
            sortIcon.className = 'bi bi-sort-numeric-down text-primary ms-1';
        } else {
            sortIcon.className = 'bi bi-sort-numeric-down-alt text-primary ms-1';
        }
    }

    // 1. Group raw orders by checkout/order_group_id
    const allGrouped = groupOrdersForDelivery(_allPendingOrders);

    // 2. Select data source based on filter
    let sourceList = [];
    if (_deliveryFilter === 'my') {
        // "My Deliveries" includes all items assigned to and delivered by this delivery partner
        const myAllGrouped = groupOrdersForDelivery(_allOrders.length > 0 ? _allOrders : _allPendingOrders);
        sourceList = myAllGrouped.filter(g => String(g.delivery_boy_id) === String(currentBoyId));
    } else if (_deliveryFilter === 'available') {
        // "Available" shows all unclaimed active deliveries in the queue
        sourceList = allGrouped.filter(g => !g.delivery_boy_id || g.delivery_request_status === 'None');
    } else if (_deliveryFilter === 'taken') {
        // "Taken" shows active deliveries locked by other delivery partners
        sourceList = allGrouped.filter(g => g.delivery_boy_id && String(g.delivery_boy_id) !== String(currentBoyId) && g.status !== 'Delivered');
    } else {
        // "All" shows all active queue pending deliveries
        sourceList = allGrouped;
    }

    // 3. Apply Search Filter
    let filtered = sourceList.filter(group => {
        if (_deliverySearchQuery) {
            const matchIds      = group.order_ids.some(id => String(id).includes(_deliverySearchQuery));
            const matchName     = (group.student_name || '').toLowerCase().includes(_deliverySearchQuery);
            const matchEmail    = (group.email || '').toLowerCase().includes(_deliverySearchQuery);
            const matchStudent  = (group.student_id || '').toLowerCase().includes(_deliverySearchQuery);
            const matchLocation = (group.delivery_location || '').toLowerCase().includes(_deliverySearchQuery);
            const matchStatus   = (group.status || '').toLowerCase().includes(_deliverySearchQuery);
            const matchItems    = group.items.some(it => 
                (it.food_name || '').toLowerCase().includes(_deliverySearchQuery) || 
                (it.shop_name || '').toLowerCase().includes(_deliverySearchQuery)
            );

            if (!matchIds && !matchName && !matchEmail && !matchStudent && !matchLocation && !matchStatus && !matchItems) {
                return false;
            }
        }
        return true;
    });

    // 4. Apply Sorting (Newest First vs Oldest First)
    filtered.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : (a.primary_id || 0);
        const timeB = b.created_at ? new Date(b.created_at).getTime() : (b.primary_id || 0);
        if (_deliverySort === 'oldest') {
            return (timeA - timeB) || ((a.primary_id || 0) - (b.primary_id || 0));
        } else {
            return (timeB - timeA) || ((b.primary_id || 0) - (a.primary_id || 0));
        }
    });

    const totalCount = filtered.length;

    if (totalCount === 0) {
        const emptyMsg = _deliveryFilter === 'my' 
            ? 'You have not completed or accepted any deliveries yet.' 
            : 'No matching orders in the queue.';
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2 text-secondary"></i>${emptyMsg}</td></tr>`;
        if (pageInfo) pageInfo.textContent = 'Showing 0 to 0 of 0 deliveries';
        if (pageList) pageList.innerHTML = '';
        return;
    }

    // 5. Pagination Math
    const totalPages = Math.max(1, Math.ceil(totalCount / _deliveryPageSize));
    if (_deliveryCurrentPage > totalPages) _deliveryCurrentPage = totalPages;
    if (_deliveryCurrentPage < 1) _deliveryCurrentPage = 1;

    const startIndex = (_deliveryCurrentPage - 1) * _deliveryPageSize;
    const endIndex   = Math.min(startIndex + _deliveryPageSize, totalCount);
    const pageItems  = filtered.slice(startIndex, endIndex);

    // 6. Render Rows
    pageItems.forEach(group => {
        const isAssignedToMe    = String(group.delivery_boy_id) === String(currentBoyId);
        const isAssignedToOther = group.delivery_boy_id && String(group.delivery_boy_id) !== String(currentBoyId);

        const tr = document.createElement('tr');
        if (isAssignedToMe && group.status !== 'Delivered') tr.classList.add('table-primary', 'bg-opacity-10');
        if (isAssignedToOther && group.status !== 'Delivered') tr.classList.add('opacity-60');

        const statusBadge = getStatusBadge(group, currentBoyId);
        const dateStr = formatDeliveryDate(group.created_at);

        // Render food items summary (supports single food or multiple foods from multiple shops)
        let foodsHtml = '';
        if (group.items.length === 1) {
            const it = group.items[0];
            foodsHtml = `
                <div class="fw-semibold text-dark">${it.food_name}</div>
                <small class="text-muted"><i class="bi bi-shop me-1 opacity-75"></i>${it.shop_name}</small>
            `;
        } else {
            foodsHtml = `
                <div class="d-flex flex-column gap-1.5 py-1">
                    <div class="d-flex align-items-center gap-1 mb-0.5">
                        <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-0.5" style="font-size:0.72rem;">
                            <i class="bi bi-basket2-fill me-1"></i>${group.items.length} Items Multi-Shop
                        </span>
                    </div>
                    ${group.items.map(it => `
                        <div class="d-flex align-items-center justify-content-between p-1.5 bg-light rounded border border-light-subtle" style="font-size:0.8rem;">
                            <div class="text-truncate me-2" style="max-width: 180px;">
                                <span class="fw-medium text-dark">${it.food_name}</span>
                                <small class="text-muted d-block" style="font-size:0.7rem;"><i class="bi bi-shop me-0.5"></i>${it.shop_name}</small>
                            </div>
                            <span class="badge bg-secondary bg-opacity-25 text-dark fw-bold px-1.5 py-0.5">x${it.quantity}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Order ID display (single unique Order ID)
        const orderIdDisplay = `<span class="fw-bold fs-6">#${group.id}</span>`;

        tr.innerHTML = `
            <td class="col-order-id">
                ${orderIdDisplay}
                ${group.otp_code ? `<br><span class="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle px-1.5 py-0.5 rounded font-monospace fw-bold mt-1 d-inline-block" style="font-size:0.74rem;"><i class="bi bi-key-fill me-0.5"></i>OTP: <strong>${group.otp_code}</strong></span>` : ''}
                ${dateStr ? `<small class="text-muted d-block mt-1" style="font-size:0.7rem;"><i class="bi bi-clock me-0.5"></i>${dateStr}</small>` : ''}
            </td>
            <td class="col-student-name">
                <div class="fw-semibold text-dark">${group.student_name}</div>
                ${group.email ? `<small class="text-muted d-block text-truncate" style="font-size:0.72rem; max-width: 140px;" title="${group.email}"><i class="bi bi-envelope me-0.5"></i>${group.email}</small>` : ''}
            </td>
            <td class="col-student-id"><code>${group.student_id}</code></td>
            <td class="col-foods">
                ${foodsHtml}
            </td>
            <td class="col-location"><span class="badge bg-light text-dark border p-2"><i class="bi bi-geo-alt"></i> ${group.delivery_location}</span></td>
            <td class="col-qty fw-bold text-center">
                <span class="fs-6">${group.total_quantity}</span>
                ${group.items.length > 1 ? `<small class="text-muted d-block" style="font-size:0.68rem;">(${group.items.length} items)</small>` : ''}
            </td>
            <td class="col-amount fw-bold text-primary">${formatCurrency(group.total_price)}</td>
            <td class="col-status">${statusBadge}</td>
            <td class="col-action">${getActionHtml(group, currentBoyId)}</td>
        `;
        tbody.appendChild(tr);
    });

    // 7. Update Pagination Info & Buttons
    if (pageInfo) {
        pageInfo.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${totalCount.toLocaleString()} deliveries (Page ${_deliveryCurrentPage} of ${totalPages})`;
    }

    if (pageList) {
        let pagesHtml = '';

        // Previous
        pagesHtml += `
            <li class="page-item ${_deliveryCurrentPage === 1 ? 'disabled' : ''}">
                <button class="page-link" onclick="setDeliveryPage(${_deliveryCurrentPage - 1})" aria-label="Previous">
                    <span aria-hidden="true">&laquo;</span>
                </button>
            </li>`;

        // Generate dynamic page numbers with ellipsis
        const pageRange = [];
        for (let p = 1; p <= totalPages; p++) {
            if (
                p === 1 ||
                p === totalPages ||
                (p >= _deliveryCurrentPage - 1 && p <= _deliveryCurrentPage + 1)
            ) {
                pageRange.push(p);
            }
        }

        let prevP = 0;
        pageRange.forEach(p => {
            if (prevP && p - prevP > 1) {
                pagesHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            pagesHtml += `
                <li class="page-item ${p === _deliveryCurrentPage ? 'active' : ''}">
                    <button class="page-link" onclick="setDeliveryPage(${p})">${p}</button>
                </li>`;
            prevP = p;
        });

        // Next
        pagesHtml += `
            <li class="page-item ${_deliveryCurrentPage === totalPages ? 'disabled' : ''}">
                <button class="page-link" onclick="setDeliveryPage(${_deliveryCurrentPage + 1})" aria-label="Next">
                    <span aria-hidden="true">&raquo;</span>
                </button>
            </li>`;

        pageList.innerHTML = pagesHtml;
    }
}

// ── Status Badge ──────────────────────────────────────────────
function getStatusBadge(order, currentBoyId) {
    if (order.status === 'Delivered') {
        return '<span class="badge rounded-pill bg-success text-white px-3 py-2 shadow-sm"><i class="bi bi-check-circle-fill me-1"></i>Delivered</span>';
    }

    if (String(order.delivery_boy_id) === String(currentBoyId)) {
        if (order.status === 'On Road') {
            return '<span class="badge rounded-pill bg-info text-white px-3 py-2"><i class="bi bi-bicycle me-1"></i>On Road</span>';
        }
        return '<span class="badge rounded-pill bg-primary px-3 py-2"><i class="bi bi-person-check me-1"></i>Accepted by You</span>';
    }
    if (order.delivery_boy_id && order.delivery_request_status !== 'None') {
        return '<span class="badge rounded-pill bg-secondary px-3 py-2"><i class="bi bi-lock-fill me-1"></i>Taken</span>';
    }
    return '<span class="badge rounded-pill bg-success px-3 py-2"><i class="bi bi-circle me-1"></i>Available</span>';
}

// ── Action Buttons ────────────────────────────────────────────
function getActionHtml(order, currentBoyId) {
    const orderId = order.primary_id || order.id;

    if (order.status === 'Delivered') {
        const fee = order.delivery_fee || (Math.round((order.total_price || 0) * 0.015 * 100) / 100);
        return `<span class="badge bg-success bg-opacity-10 text-success fw-bold px-2.5 py-1.5 rounded-pill border border-success border-opacity-25" style="font-size:0.82rem;">
                    <i class="bi bi-check2-circle me-1"></i>Earned ৳${Number(fee).toFixed(2)}
                </span>`;
    }

    // ── Order taken by another boy ─────────────────────────────
    if (order.delivery_boy_id && String(order.delivery_boy_id) !== String(currentBoyId) && order.delivery_request_status !== 'None') {
        return `<span class="text-muted small fst-italic">
                    <i class="bi bi-lock-fill me-1 text-secondary"></i>
                    Taken by another delivery boy
                </span>`;
    }

    // ── Order accepted by ME ───────────────────────────────────
    if (String(order.delivery_boy_id) === String(currentBoyId) && (order.delivery_request_status === 'Accepted' || order.delivery_request_status === 'Approved')) {
        if (order.status === 'Pending') {
            return `
                <div class="d-flex gap-2 flex-wrap">
                    <button class="btn btn-sm btn-primary rounded-pill px-3 fw-medium"
                            onclick="pickupDelivery(${orderId})">
                        <i class="bi bi-bicycle me-1"></i>Pick Up
                    </button>
                    <button class="btn btn-sm btn-outline-danger rounded-pill px-3 fw-medium"
                            onclick="cancelDelivery(${orderId})">
                        <i class="bi bi-x-circle me-1"></i>Cancel
                    </button>
                </div>`;
        }
        if (order.status === 'On Road') {
            return `<button class="btn btn-sm btn-success text-white rounded-pill px-3 fw-medium shadow-sm"
                            onclick="confirmDirectDelivery(${orderId})">
                        <i class="bi bi-check2-circle me-1"></i>Confirm Delivery
                    </button>`;
        }
    }

    // ── Order unassigned — show Accept button ──────────────────
    if (!order.delivery_boy_id || order.delivery_request_status === 'None') {
        return `<button class="btn btn-sm btn-success text-white rounded-pill px-4 fw-medium"
                        onclick="acceptDelivery(${orderId})">
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

// ── Confirm Direct Delivery ──────────────────────────────────
async function confirmDirectDelivery(orderId) {
    const currentBoyId = sessionStorage.getItem('delivery_boy_id');
    if (!currentBoyId) {
        showToast('Please log in first', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/delivery/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_id: orderId,
                delivery_boy_id: currentBoyId
            })
        });

        const data = await response.json();

        if (response.ok) {
            showToast(data.message || '✅ Order Delivered! Buyer notified via email.', 'success');
            loadPendingOrders();
        } else {
            showToast(data.detail || 'Error completing delivery', 'danger');
        }
    } catch (error) {
        console.error('Confirm delivery error:', error);
        showToast('Network error', 'danger');
    }
}
