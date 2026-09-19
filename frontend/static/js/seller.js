let currentAuthMode = 'login';
let _orderHistoryCache = [];
let currentShop = null;

// ── Session Helpers ───────────────────────────────────────────
function getSellerSession() {
    try {
        const raw = localStorage.getItem('seller_session');
        if (raw) return JSON.parse(raw);
    } catch (e) {
        console.warn('Error parsing seller_session:', e);
    }
    const legacyName = localStorage.getItem('shop_name') || sessionStorage.getItem('shop_name');
    const legacyId = localStorage.getItem('shop_id') || sessionStorage.getItem('shop_id');
    if (legacyName || legacyId) {
        return {
            shop_name: legacyName || `Shop #${legacyId}`,
            shop_id: legacyId || legacyName,
            login_time: new Date().toISOString()
        };
    }
    return null;
}

function setSellerSession(shopData) {
    currentShop = {
        shop_name: shopData.shop_name,
        shop_id: shopData.shop_id,
        login_time: new Date().toISOString()
    };
    localStorage.setItem('seller_session', JSON.stringify(currentShop));
    localStorage.setItem('shop_name', currentShop.shop_name);
    localStorage.setItem('shop_id', currentShop.shop_id);
    sessionStorage.setItem('shop_name', currentShop.shop_name);
    sessionStorage.setItem('shop_id', currentShop.shop_id);
}

function clearSellerSession() {
    currentShop = null;
    localStorage.removeItem('seller_session');
    localStorage.removeItem('shop_name');
    localStorage.removeItem('shop_id');
    sessionStorage.removeItem('shop_name');
    sessionStorage.removeItem('shop_id');
}

// ── View Switching Logic ──────────────────────────────────────
function showLoginView() {
    const loginView = document.getElementById('seller-login-view');
    const dashboardView = document.getElementById('seller-dashboard-view');
    if (loginView) {
        loginView.classList.remove('d-none');
        loginView.style.removeProperty('display');
    }
    if (dashboardView) {
        dashboardView.classList.add('d-none');
        dashboardView.style.setProperty('display', 'none', 'important');
    }
}

function showDashboard() {
    const loginView = document.getElementById('seller-login-view');
    const dashboardView = document.getElementById('seller-dashboard-view');
    if (loginView) {
        loginView.classList.add('d-none');
        loginView.style.setProperty('display', 'none', 'important');
    }
    if (dashboardView) {
        dashboardView.classList.remove('d-none');
        dashboardView.style.setProperty('display', 'block', 'important');
    }
    if (currentShop) {
        const titleEl = document.getElementById('dashboard-shop-title');
        if (titleEl) titleEl.textContent = currentShop.shop_name || `Shop #${currentShop.shop_id}`;
        const shopNameInput = document.getElementById('shop_name');
        if (shopNameInput) shopNameInput.value = currentShop.shop_name || '';
    }
}

function checkSession() {
    currentShop = getSellerSession();
    if (currentShop && (currentShop.shop_name || currentShop.shop_id)) {
        showDashboard();
        try { loadInventory(); } catch (e) { console.error('Inventory load error:', e); }
        try { pollNotifications(); } catch (e) { console.error('Notification poll error:', e); }
        try { loadOrderHistory(); } catch (e) { console.error('Order history load error:', e); }
    } else {
        showLoginView();
    }
}

function logoutSeller() {
    clearSellerSession();
    showToast('Logged out successfully', 'info');
    showLoginView();
}

function switchAuthTab(mode) {
    currentAuthMode = mode;
    
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const authHelpText = document.getElementById('auth-help-text');
    const authSubmitBtn = document.getElementById('auth-submit-btn');

    if (mode === 'login') {
        if (tabLogin) tabLogin.classList.add('active');
        if (tabRegister) tabRegister.classList.remove('active');
        if (authTitle) authTitle.textContent = 'Shop Login';
        if (authSubtitle) authSubtitle.textContent = 'Enter Shop Name and Shop ID to access dashboard';
        if (authHelpText) authHelpText.textContent = 'Enter your registered Shop Name and Shop ID.';
        if (authSubmitBtn) authSubmitBtn.innerHTML = '<span>Enter Portal</span> <i class="bi bi-arrow-right"></i>';
    } else {
        if (tabLogin) tabLogin.classList.remove('active');
        if (tabRegister) tabRegister.classList.add('active');
        if (authTitle) authTitle.textContent = 'Register New Shop';
        if (authSubtitle) authSubtitle.textContent = 'Create a new shop name and shop ID combination';
        if (authHelpText) authHelpText.textContent = 'This ID and name combination will be locked for this shop.';
        if (authSubmitBtn) authSubmitBtn.innerHTML = '<span>Register &amp; Enter Shop</span> <i class="bi bi-arrow-right"></i>';
    }
}

async function handleSellerAuthSubmit(e) {
    if (e) e.preventDefault();
    const shopName = (document.getElementById('login_shop_name')?.value || '').trim();
    const shopId = (document.getElementById('login_shop_id')?.value || '').trim();

    if (!shopName && !shopId) {
        showToast('Please enter Shop Name or Shop ID.', 'warning');
        return false;
    }

    const endpoint = currentAuthMode === 'login' ? 'login' : 'register';

    const submitBtn = document.getElementById('auth-submit-btn');
    const originalHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Authenticating...';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/shops/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop_name: shopName, shop_id: shopId })
        });

        if (response.ok) {
            const data = await response.json();
            setSellerSession(data);
            showToast(data.message || `Access granted! Welcome, ${data.shop_name}`, 'success');
            showDashboard();
            try { loadInventory(); } catch (e) {}
            try { pollNotifications(); } catch (e) {}
            try { loadOrderHistory(); } catch (e) {}
        } else {
            const err = await response.json();
            showToast(err.detail || 'Access Denied', 'danger');
        }
    } catch (error) {
        console.error('Error logging in:', error);
        showToast('Network error, check backend server', 'danger');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
        }
    }
    return false;
}

document.addEventListener('DOMContentLoaded', () => {
    checkSession();

    // Bind tab events programmatically
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    if (tabLogin) {
        tabLogin.addEventListener('click', () => switchAuthTab('login'));
    }
    if (tabRegister) {
        tabRegister.addEventListener('click', () => switchAuthTab('register'));
    }

    const orderHistorySearch = document.getElementById('order-history-search');
    if (orderHistorySearch) {
        orderHistorySearch.addEventListener('input', onOrderHistorySearchChange);
    }

    // Seller Login/Register Form Submit
    const loginForm = document.getElementById('seller-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleSellerAuthSubmit);
    }

    // Add Food Form Submit
    const addFoodForm = document.getElementById('add-food-form');
    if (addFoodForm) {
        addFoodForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fileInput = document.getElementById('image_file');
            const file = fileInput.files ? fileInput.files[0] : null;
            let imageUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60';

            // 1. Upload file if selected
            if (file) {
                const formData = new FormData();
                formData.append('file', file);

                try {
                    const uploadRes = await fetch(`${API_BASE_URL}/foods/upload-image`, {
                        method: 'POST',
                        body: formData
                    });

                    if (uploadRes.ok) {
                        const uploadData = await uploadRes.json();
                        imageUrl = uploadData.image_url;
                    } else {
                        const err = await uploadRes.json();
                        showToast(err.detail || 'Failed to upload image file', 'danger');
                        return;
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    showToast('Network error during photo upload', 'danger');
                    return;
                }
            }
            
            const activeShopName = currentShop?.shop_name || localStorage.getItem('shop_name') || sessionStorage.getItem('shop_name');
            const foodData = {
                shop_name: activeShopName,
                food_name: document.getElementById('food_name').value,
                price: parseFloat(document.getElementById('price').value),
                quantity: parseInt(document.getElementById('quantity').value),
                image_url: imageUrl,
                description: document.getElementById('description').value,
                meal_type: document.getElementById('meal_type').value
            };
            
            try {
                const response = await fetch(`${API_BASE_URL}/foods`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(foodData)
                });
                
                if (response.ok) {
                    showToast('Food added successfully!', 'success');
                    const modal = bootstrap.Modal.getInstance(document.getElementById('addFoodModal'));
                    if (modal) modal.hide();
                    document.getElementById('add-food-form').reset();
                    document.getElementById('shop_name').value = activeShopName;
                    loadInventory();
                } else {
                    const err = await response.json();
                    showToast(err.detail || 'Error adding food', 'danger');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Network error', 'danger');
            }
        });
    }
});

let _notifPollInterval = null;
let _unreadNotifications = [];

async function pollNotifications() {
    const shopId = sessionStorage.getItem('shop_id') || localStorage.getItem('shop_id');
    if (!shopId) return;

    try {
        const res = await fetch(`${API_BASE_URL}/shops/${encodeURIComponent(shopId)}/notifications`);
        if (!res.ok) return;
        const notifs = await res.json();

        // Only process NEW notifications (not already in our list)
        const existingIds = _unreadNotifications.map(n => n.id);
        const newOnes = notifs.filter(n => !existingIds.includes(n.id));
        const isFirstLoad = _unreadNotifications.length === 0 && existingIds.length === 0;

        if (newOnes.length > 0) {
            // Show toast for truly new notifications (after first load)
            if (!isFirstLoad) {
                newOnes.forEach(n => showToast(`Admin: ${n.message}`, 'success'));
            }
        }

        // Update our in-memory list
        _unreadNotifications = notifs;

        // Update the bell button and panel
        renderNotifPanel();

        // Auto-open panel on first load if there are notifications
        if (isFirstLoad && notifs.length > 0) {
            const panel = document.getElementById('notif-panel');
            if (panel) panel.style.display = 'block';
        }
    } catch (e) {
        console.warn('Notification poll failed', e);
    }

    // Poll every 30 seconds
    if (!_notifPollInterval) {
        _notifPollInterval = setInterval(pollNotifications, 30000);
    }
}

function renderNotifPanel() {
    const count  = _unreadNotifications.length;
    const badge  = document.getElementById('notif-count-badge');
    const listEl = document.getElementById('notif-list');

    // Update badge count in green header
    if (badge) badge.textContent = count;

    if (!listEl) return;

    if (count === 0) {
        // Show empty state
        listEl.innerHTML = `
            <div id="notif-empty-state" class="text-center py-5 px-3" style="color:#9ca3af;">
                <div style="font-size: 0.88rem; font-weight: 500;">No notifications yet</div>
                <div style="font-size: 0.78rem; margin-top: 4px;">Admin messages will appear here</div>
            </div>`;
    } else {
        listEl.innerHTML = _unreadNotifications.map((n, i) => `
            <div class="d-flex align-items-start gap-3 px-4 py-3 position-relative" id="notif-item-${n.id}"
                 style="${i < _unreadNotifications.length - 1 ? 'border-bottom: 1px solid #f0fdf4;' : ''}
                        background: white; transition: all 0.2s ease; cursor: pointer;"
                 onclick="openNotificationModal(${n.id})"
                 onmouseover="this.style.background='#f0fdf4'; this.style.paddingLeft='1.85rem';"
                 onmouseout="this.style.background='white'; this.style.paddingLeft='1.5rem';"
                 title="Click to view full message">
                <span class="d-inline-block rounded-circle bg-success mt-1.5 flex-shrink-0" style="width: 8px; height: 8px;" title="Unread"></span>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:0.88rem; color:#111827; font-weight:500; line-height:1.45;" class="text-truncate-2">
                        ${escapeHtml(n.message)}
                    </div>
                    <div class="d-flex align-items-center gap-2 mt-1" style="font-size:0.73rem; color:#9ca3af;">
                        <i class="bi bi-clock"></i>
                        <span>${formatNotifDate(n.created_at)}</span>
                    </div>
                </div>
                <button onclick="event.stopPropagation(); dismissNotification(${n.id})"
                        style="flex-shrink:0; background:none; border:none; color:#d1d5db;
                               font-size:1rem; cursor:pointer; padding:2px 6px; border-radius:6px;
                               transition:color 0.2s; line-height:1;"
                        title="Dismiss"
                        onmouseover="this.style.color='#ef4444'"
                        onmouseout="this.style.color='#d1d5db'">✕</button>
            </div>`).join('');
    }
}

function openNotificationModal(id) {
    const notif = _unreadNotifications.find(n => n.id === id);
    if (!notif) return;

    // Populate Modal Content
    const msgEl = document.getElementById('modal-notif-message');
    const dateEl = document.getElementById('modal-notif-date');
    const shopEl = document.getElementById('modal-notif-shop');

    if (msgEl) msgEl.textContent = notif.message;
    if (dateEl) dateEl.textContent = formatNotifDate(notif.created_at);
    if (shopEl) shopEl.textContent = sessionStorage.getItem('shop_name') || 'Shop Portal';

    // Show the modal
    const modalEl = document.getElementById('notificationDetailModal');
    if (modalEl) {
        const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        bsModal.show();
    }

    // Mark as read immediately on server and locally
    dismissNotification(id);
}

function escapeHtml(str) {
    const el = document.createElement('div');
    el.innerText = str;
    return el.innerHTML;
}

function formatNotifDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        + ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

async function dismissNotification(id) {
    // Remove from local list immediately for instant UI feedback
    _unreadNotifications = _unreadNotifications.filter(n => n.id !== id);
    renderNotifPanel();

    // Mark as read on server
    try {
        await fetch(`${API_BASE_URL}/shops/${id}/read`, { method: 'POST' });
    } catch (e) {
        console.warn('Could not mark notification as read', e);
    }
}

// ── Inventory State & Handlers ────────────────────────────────
let _inventoryCache = [];
let _inventoryCurrentPage = 1;
let _inventoryPageSize = 5;
let _inventorySearchQuery = '';

async function loadInventory() {
    const shopName = currentShop?.shop_name || localStorage.getItem('shop_name') || sessionStorage.getItem('shop_name');
    if (!shopName) return;

    try {
        const response = await fetch(`${API_BASE_URL}/foods?shop_name=${encodeURIComponent(shopName)}&limit=1000`);
        const foods = await response.json();
        _inventoryCache = foods || [];
        renderInventoryTable();
        renderSellerAnalytics();
    } catch (error) {
        console.error('Error loading inventory:', error);
        document.getElementById('inventory-list').innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Error loading data.</td></tr>';
    }
}

function onInventorySearchChange() {
    const input = document.getElementById('inventory-search');
    _inventorySearchQuery = (input ? input.value : '').trim().toLowerCase();
    _inventoryCurrentPage = 1;
    renderInventoryTable();
}

function changeInventoryPageSize(newSize) {
    _inventoryPageSize = parseInt(newSize) || 5;
    _inventoryCurrentPage = 1;
    renderInventoryTable();
}

function setInventoryPage(page) {
    _inventoryCurrentPage = page;
    renderInventoryTable();
}

function renderInventoryTable() {
    const tbody = document.getElementById('inventory-list');
    const pageInfo = document.getElementById('inventory-pagination-info');
    const pageList = document.getElementById('inventory-pagination-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Filter by search query
    let filtered = _inventoryCache.filter(food => {
        if (!_inventorySearchQuery) return true;
        const matchName = (food.food_name || '').toLowerCase().includes(_inventorySearchQuery);
        const matchShop = (food.shop_name || '').toLowerCase().includes(_inventorySearchQuery);
        const matchDesc = (food.description || '').toLowerCase().includes(_inventorySearchQuery);
        const matchMeal = (food.meal_type || '').toLowerCase().includes(_inventorySearchQuery);
        const matchPrice = String(food.price || '').includes(_inventorySearchQuery);
        return matchName || matchShop || matchDesc || matchMeal || matchPrice;
    });

    const totalCount = filtered.length;

    if (totalCount === 0) {
        const emptyMsg = _inventoryCache.length === 0 
            ? 'No foods found. Add some delicious meals!'
            : 'No matching items in inventory.';
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">${emptyMsg}</td></tr>`;
        if (pageInfo) pageInfo.textContent = 'Showing 0 to 0 of 0 items';
        if (pageList) pageList.innerHTML = '';
        return;
    }

    // Pagination math
    const totalPages = Math.max(1, Math.ceil(totalCount / _inventoryPageSize));
    if (_inventoryCurrentPage > totalPages) _inventoryCurrentPage = totalPages;
    if (_inventoryCurrentPage < 1) _inventoryCurrentPage = 1;

    const startIndex = (_inventoryCurrentPage - 1) * _inventoryPageSize;
    const endIndex   = Math.min(startIndex + _inventoryPageSize, totalCount);
    const pageItems  = filtered.slice(startIndex, endIndex);

    pageItems.forEach(food => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <img src="${food.image_url}" alt="${food.food_name}" class="rounded shadow-sm" style="width: 50px; height: 50px; object-fit: cover;"
                     onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'">
            </td>
            <td class="fw-medium">${escapeHtml(food.food_name)}</td>
            <td class="text-muted small">${escapeHtml(food.shop_name)}</td>
            <td class="fw-bold text-primary">${formatCurrency(food.price)}</td>
            <td>
                <span class="badge ${food.quantity > 0 ? 'bg-success' : 'bg-danger'} rounded-pill px-3 py-1.5">
                    ${food.quantity} in stock
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-danger rounded-pill px-3 hover-lift" onclick="deleteFood(${food.id})">
                    Delete
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Update Pagination UI
    if (pageInfo) {
        pageInfo.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${totalCount.toLocaleString()} items (Page ${_inventoryCurrentPage} of ${totalPages})`;
    }

    if (pageList) {
        let pagesHtml = '';

        pagesHtml += `
            <li class="page-item ${_inventoryCurrentPage === 1 ? 'disabled' : ''}">
                <button class="page-link" onclick="setInventoryPage(${_inventoryCurrentPage - 1})" aria-label="Previous">&laquo;</button>
            </li>`;

        const pageRange = [];
        for (let p = 1; p <= totalPages; p++) {
            if (p === 1 || p === totalPages || (p >= _inventoryCurrentPage - 1 && p <= _inventoryCurrentPage + 1)) {
                pageRange.push(p);
            }
        }

        let prevP = 0;
        pageRange.forEach(p => {
            if (prevP && p - prevP > 1) {
                pagesHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            pagesHtml += `
                <li class="page-item ${p === _inventoryCurrentPage ? 'active' : ''}">
                    <button class="page-link" onclick="setInventoryPage(${p})">${p}</button>
                </li>`;
            prevP = p;
        });

        pagesHtml += `
            <li class="page-item ${_inventoryCurrentPage === totalPages ? 'disabled' : ''}">
                <button class="page-link" onclick="setInventoryPage(${_inventoryCurrentPage + 1})" aria-label="Next">&raquo;</button>
            </li>`;

        pageList.innerHTML = pagesHtml;
    }
}

async function deleteFood(id) {
    if (!confirm('Are you sure you want to delete this food item?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/foods/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Food deleted successfully', 'success');
            loadInventory();
        } else {
            showToast('Error deleting food', 'danger');
        }
    } catch (error) {
        showToast('Network error', 'danger');
    }
}

// ── Order History State & Handlers ────────────────────────────
let _orderHistoryCurrentPage = 1;
let _orderHistoryPageSize = 10;
let _orderHistoryStatusFilter = 'all'; // 'all', 'Delivered', 'Pending'
let _orderHistorySearchQuery = '';

async function loadOrderHistory() {
    const shopName = currentShop?.shop_name || localStorage.getItem('shop_name') || sessionStorage.getItem('shop_name');
    if (!shopName) return;

    try {
        const response = await fetch(`${API_BASE_URL}/orders/shop/${encodeURIComponent(shopName)}/history`);
        if (!response.ok) throw new Error('Failed to load history');

        const data = await response.json();
        const summary = data.summary || {};
        _orderHistoryCache = data.orders || [];

        document.getElementById('stats-items-sold').textContent = (summary.total_items_sold || 0).toLocaleString();
        document.getElementById('stats-gross-revenue').textContent = formatCurrency(summary.gross_revenue || 0);
        const totalFees = (summary.admin_fee_cut || 0) + (summary.delivery_fee_cut || 0);
        document.getElementById('stats-total-fees').textContent = formatCurrency(totalFees);
        document.getElementById('stats-net-revenue').textContent = formatCurrency(summary.net_seller_revenue || 0);

        renderOrderHistory();
        renderSellerAnalytics();
    } catch (error) {
        console.error('Error loading order history:', error);
        _orderHistoryCache = [];
        const tbody = document.getElementById('order-history-list');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger py-4">Error loading order history.</td></tr>';
        }
    }
}

function onOrderHistorySearchChange() {
    const searchEl = document.getElementById('order-history-search');
    _orderHistorySearchQuery = (searchEl ? searchEl.value : '').trim().toLowerCase();
    _orderHistoryCurrentPage = 1;
    renderOrderHistory();
}

function setOrderHistoryStatusFilter(status, btn) {
    _orderHistoryStatusFilter = status;
    document.querySelectorAll('#order-status-filter-group button').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _orderHistoryCurrentPage = 1;
    renderOrderHistory();
}

function changeOrderHistoryPageSize(newSize) {
    _orderHistoryPageSize = parseInt(newSize) || 10;
    _orderHistoryCurrentPage = 1;
    renderOrderHistory();
}

function setOrderHistoryPage(page) {
    _orderHistoryCurrentPage = page;
    renderOrderHistory();
}

function getOrderSearchText(order) {
    const fees = (order.admin_fee || 0) + (order.delivery_fee || 0);
    return [
        order.id,
        `#${order.id}`,
        formatOrderDate(order.created_at),
        order.food_name,
        order.quantity,
        order.student_name,
        order.student_id,
        order.delivery_location,
        order.phone,
        order.total_price,
        formatCurrency(order.total_price || 0),
        fees,
        formatCurrency(fees),
        order.admin_fee,
        order.delivery_fee,
        order.net_seller_revenue,
        formatCurrency(order.net_seller_revenue || 0),
        order.status,
        order.delivery_boy_id
    ].filter(Boolean).join(' ').toLowerCase();
}

function renderOrderHistory() {
    const tbody = document.getElementById('order-history-list');
    const pageInfo = document.getElementById('order-history-pagination-info');
    const pageList = document.getElementById('order-history-pagination-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (_orderHistoryCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-5 text-muted">No orders yet. Sales will appear here once students order your food.</td></tr>';
        if (pageInfo) pageInfo.textContent = 'Showing 0 to 0 of 0 orders';
        if (pageList) pageList.innerHTML = '';
        return;
    }

    // 1. Filter by Status & Search Query
    let filtered = _orderHistoryCache.filter(order => {
        if (_orderHistoryStatusFilter !== 'all') {
            if (order.status !== _orderHistoryStatusFilter) return false;
        }

        if (_orderHistorySearchQuery) {
            if (!getOrderSearchText(order).includes(_orderHistorySearchQuery)) {
                return false;
            }
        }
        return true;
    });

    const totalCount = filtered.length;

    if (totalCount === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5 text-muted">No matching orders found.</td></tr>`;
        if (pageInfo) pageInfo.textContent = 'Showing 0 to 0 of 0 orders';
        if (pageList) pageList.innerHTML = '';
        return;
    }

    // 2. Pagination Math
    const totalPages = Math.max(1, Math.ceil(totalCount / _orderHistoryPageSize));
    if (_orderHistoryCurrentPage > totalPages) _orderHistoryCurrentPage = totalPages;
    if (_orderHistoryCurrentPage < 1) _orderHistoryCurrentPage = 1;

    const startIndex = (_orderHistoryCurrentPage - 1) * _orderHistoryPageSize;
    const endIndex   = Math.min(startIndex + _orderHistoryPageSize, totalCount);
    const pageItems  = filtered.slice(startIndex, endIndex);

    // 3. Render Rows
    pageItems.forEach(order => {
        const fees = (order.admin_fee || 0) + (order.delivery_fee || 0);
        const statusClass = order.status === 'Delivered' ? 'bg-success'
            : order.status === 'Pending' ? 'bg-warning text-dark'
            : 'bg-secondary';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <span class="fw-bold fs-6">#${order.id}</span>
                ${order.otp_code ? `<br><span class="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle px-1.5 py-0.5 rounded font-monospace fw-bold mt-1 d-inline-block" style="font-size:0.74rem;"><i class="bi bi-key-fill me-0.5"></i>OTP: <strong>${escapeHtml(order.otp_code)}</strong></span>` : ''}
            </td>
            <td class="text-muted small">${formatOrderDate(order.created_at)}</td>
            <td class="fw-medium">${escapeHtml(order.food_name || 'Unknown')}</td>
            <td class="fw-bold">${order.quantity}</td>
            <td>
                <div class="fw-medium">${escapeHtml(order.student_name)}</div>
                ${order.email ? `<small class="text-muted d-block text-truncate" style="font-size:0.72rem; max-width: 140px;" title="${escapeHtml(order.email)}"><i class="bi bi-envelope me-0.5"></i>${escapeHtml(order.email)}</small>` : ''}
                <small class="text-muted">${escapeHtml(order.delivery_location || '')}</small>
            </td>
            <td>${formatCurrency(order.total_price || 0)}</td>
            <td class="text-danger">${formatCurrency(fees)}</td>
            <td class="fw-bold text-success">${formatCurrency(order.net_seller_revenue || 0)}</td>
            <td><span class="badge ${statusClass} rounded-pill px-3 py-1.5">${escapeHtml(order.status)}</span></td>
        `;
        tbody.appendChild(tr);
    });

    // 4. Update Pagination UI
    if (pageInfo) {
        pageInfo.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${totalCount.toLocaleString()} orders (Page ${_orderHistoryCurrentPage} of ${totalPages})`;
    }

    if (pageList) {
        let pagesHtml = '';

        // Previous
        pagesHtml += `
            <li class="page-item ${_orderHistoryCurrentPage === 1 ? 'disabled' : ''}">
                <button class="page-link" onclick="setOrderHistoryPage(${_orderHistoryCurrentPage - 1})" aria-label="Previous">&laquo;</button>
            </li>`;

        const pageRange = [];
        for (let p = 1; p <= totalPages; p++) {
            if (p === 1 || p === totalPages || (p >= _orderHistoryCurrentPage - 1 && p <= _orderHistoryCurrentPage + 1)) {
                pageRange.push(p);
            }
        }

        let prevP = 0;
        pageRange.forEach(p => {
            if (prevP && p - prevP > 1) {
                pagesHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            pagesHtml += `
                <li class="page-item ${p === _orderHistoryCurrentPage ? 'active' : ''}">
                    <button class="page-link" onclick="setOrderHistoryPage(${p})">${p}</button>
                </li>`;
            prevP = p;
        });

        // Next
        pagesHtml += `
            <li class="page-item ${_orderHistoryCurrentPage === totalPages ? 'disabled' : ''}">
                <button class="page-link" onclick="setOrderHistoryPage(${_orderHistoryCurrentPage + 1})" aria-label="Next">&raquo;</button>
            </li>`;

        pageList.innerHTML = pagesHtml;
    }
}

function formatOrderDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ── Menu Analytics & Food Performance Graphs ─────────────────
let _ratingsChartInstance = null;
let _salesChartInstance = null;
let _ratingsChartFilter = 'all'; // 'all', 'top', 'under'
let _salesChartFilter = 'all';    // 'all', 'top', 'low'

function setRatingsChartFilter(filter, btn) {
    _ratingsChartFilter = filter;
    document.querySelectorAll('#ratings-chart-filter-group button').forEach(b => {
        b.classList.remove('active', 'btn-white');
        b.classList.add('btn-light');
    });
    if (btn) {
        btn.classList.add('active', 'btn-white');
        btn.classList.remove('btn-light');
    }
    renderSellerAnalytics();
}

function setSalesChartFilter(filter, btn) {
    _salesChartFilter = filter;
    document.querySelectorAll('#sales-chart-filter-group button').forEach(b => {
        b.classList.remove('active', 'btn-white');
        b.classList.add('btn-light');
    });
    if (btn) {
        btn.classList.add('active', 'btn-white');
        btn.classList.remove('btn-light');
    }
    renderSellerAnalytics();
}

function renderSellerAnalytics() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not yet loaded');
        return;
    }

    if (!_inventoryCache || _inventoryCache.length === 0) {
        // Reset insight cards
        const topRatedName = document.getElementById('insight-top-rated-name');
        if (topRatedName) topRatedName.textContent = '—';
        const lowRatedName = document.getElementById('insight-low-rated-name');
        if (lowRatedName) lowRatedName.textContent = '—';
        const topSellingName = document.getElementById('insight-top-selling-name');
        if (topSellingName) topSellingName.textContent = '—';
        const lowSellingName = document.getElementById('insight-low-selling-name');
        if (lowSellingName) lowSellingName.textContent = '—';
        return;
    }

    // Aggregate sales data per food from _orderHistoryCache
    const salesMap = {};
    let shopTotalSales = 0;
    let shopTotalRevenue = 0;

    if (Array.isArray(_orderHistoryCache)) {
        _orderHistoryCache.forEach(order => {
            const rawName = (order.food_name || '').trim();
            if (!rawName) return;
            const key = rawName.toLowerCase();
            if (!salesMap[key]) {
                salesMap[key] = {
                    quantity: 0,
                    revenue: 0,
                    orderCount: 0
                };
            }
            const q = Number(order.quantity) || 0;
            const rev = Number(order.net_seller_revenue != null ? order.net_seller_revenue : order.total_price) || 0;
            salesMap[key].quantity += q;
            salesMap[key].revenue += rev;
            salesMap[key].orderCount += 1;
            shopTotalSales += q;
            shopTotalRevenue += rev;
        });
    }

    // Create item stats for each food in inventory
    const foodAnalytics = _inventoryCache.map(food => {
        const name = (food.food_name || '').trim();
        const key = name.toLowerCase();
        const sales = salesMap[key] || { quantity: 0, revenue: 0, orderCount: 0 };
        return {
            id: food.id,
            name: name,
            avg_rating: parseFloat(food.avg_rating || 0),
            rating_count: parseInt(food.rating_count || 0),
            price: parseFloat(food.price || 0),
            quantitySold: sales.quantity,
            revenue: sales.revenue,
            orderCount: sales.orderCount
        };
    });

    // ── 1. Update 4 Quick Insight Cards ─────────────────────────
    // Top Rated
    const byRatingDesc = [...foodAnalytics].sort((a, b) => {
        if (b.avg_rating !== a.avg_rating) return b.avg_rating - a.avg_rating;
        return b.rating_count - a.rating_count;
    });
    const topRated = byRatingDesc[0];
    if (topRated) {
        const nameEl = document.getElementById('insight-top-rated-name');
        const valEl = document.getElementById('insight-top-rated-val');
        const cntEl = document.getElementById('insight-top-rated-cnt');
        if (nameEl) nameEl.textContent = topRated.name;
        if (valEl) valEl.textContent = `${topRated.avg_rating.toFixed(1)} ★`;
        if (cntEl) cntEl.textContent = `(${topRated.rating_count} reviews)`;
    }

    // Lowest / Under-Rated
    const byRatingAsc = [...foodAnalytics].sort((a, b) => {
        if (a.avg_rating !== b.avg_rating) return a.avg_rating - b.avg_rating;
        return b.rating_count - a.rating_count;
    });
    const lowRated = byRatingAsc[0];
    if (lowRated) {
        const nameEl = document.getElementById('insight-low-rated-name');
        const valEl = document.getElementById('insight-low-rated-val');
        const cntEl = document.getElementById('insight-low-rated-cnt');
        if (nameEl) nameEl.textContent = lowRated.name;
        if (valEl) valEl.textContent = `${lowRated.avg_rating.toFixed(1)} ★`;
        if (cntEl) cntEl.textContent = `(${lowRated.rating_count} reviews)`;
    }

    // Best Seller
    const bySalesDesc = [...foodAnalytics].sort((a, b) => {
        if (b.quantitySold !== a.quantitySold) return b.quantitySold - a.quantitySold;
        return b.revenue - a.revenue;
    });
    const topSeller = bySalesDesc[0];
    if (topSeller) {
        const nameEl = document.getElementById('insight-top-selling-name');
        const valEl = document.getElementById('insight-top-selling-val');
        const revEl = document.getElementById('insight-top-selling-rev');
        if (nameEl) nameEl.textContent = topSeller.name;
        if (valEl) valEl.textContent = `${topSeller.quantitySold.toLocaleString()} sold`;
        if (revEl) revEl.textContent = formatCurrency(topSeller.revenue);
    }

    // Low / Bad Selling
    const bySalesAsc = [...foodAnalytics].sort((a, b) => {
        if (a.quantitySold !== b.quantitySold) return a.quantitySold - b.quantitySold;
        return a.revenue - b.revenue;
    });
    const lowSeller = bySalesAsc[0];
    if (lowSeller) {
        const nameEl = document.getElementById('insight-low-selling-name');
        const valEl = document.getElementById('insight-low-selling-val');
        const revEl = document.getElementById('insight-low-selling-rev');
        if (nameEl) nameEl.textContent = lowSeller.name;
        if (valEl) valEl.textContent = `${lowSeller.quantitySold.toLocaleString()} sold`;
        if (revEl) revEl.textContent = formatCurrency(lowSeller.revenue);
    }

    // ── 2. Graph 1: Food Ratings Chart (Horizontal Bar) ─────────
    const ratingsCanvas = document.getElementById('sellerRatingsChart');
    if (ratingsCanvas) {
        const ctx = ratingsCanvas.getContext('2d');

        // Filter list based on selected pill
        let filteredRatings = [...byRatingDesc];
        if (_ratingsChartFilter === 'top') {
            filteredRatings = filteredRatings.filter(item => item.avg_rating >= 4.5);
            if (filteredRatings.length === 0) filteredRatings = byRatingDesc.slice(0, 5);
        } else if (_ratingsChartFilter === 'under') {
            filteredRatings = filteredRatings.filter(item => item.avg_rating < 4.5);
            if (filteredRatings.length === 0) filteredRatings = [...byRatingAsc].slice(0, 5);
        }

        // Adjust canvas height dynamically based on item count
        const calculatedHeight = Math.max(320, filteredRatings.length * 36 + 40);
        ratingsCanvas.parentElement.style.height = `${Math.min(calculatedHeight, 460)}px`;

        const ratingLabels = filteredRatings.map(item => item.name);
        const ratingValues = filteredRatings.map(item => item.avg_rating);

        const ratingBgColors = filteredRatings.map(item => {
            const grad = ctx.createLinearGradient(0, 0, 360, 0);
            if (item.avg_rating >= 4.5) {
                grad.addColorStop(0, '#059669'); // Emerald
                grad.addColorStop(1, '#34d399');
            } else if (item.avg_rating >= 4.0) {
                grad.addColorStop(0, '#d97706'); // Amber
                grad.addColorStop(1, '#fbbf24');
            } else {
                grad.addColorStop(0, '#dc2626'); // Rose
                grad.addColorStop(1, '#f87171');
            }
            return grad;
        });

        const ratingBorders = filteredRatings.map(item => {
            if (item.avg_rating >= 4.5) return '#047857';
            if (item.avg_rating >= 4.0) return '#b45309';
            return '#b91c1c';
        });

        if (_ratingsChartInstance) {
            _ratingsChartInstance.destroy();
        }

        _ratingsChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ratingLabels,
                datasets: [{
                    label: 'Rating (Stars)',
                    data: ratingValues,
                    backgroundColor: ratingBgColors,
                    borderColor: ratingBorders,
                    borderWidth: 1,
                    borderRadius: 20,
                    borderSkipped: false,
                    barThickness: 16,
                    maxBarThickness: 20
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 650,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.94)',
                        titleColor: '#ffffff',
                        titleFont: { family: 'Outfit, sans-serif', size: 13, weight: 'bold' },
                        bodyFont: { family: 'Outfit, sans-serif', size: 12 },
                        padding: 12,
                        cornerRadius: 10,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            title: (items) => {
                                const idx = items[0].dataIndex;
                                return filteredRatings[idx].name;
                            },
                            label: (context) => {
                                const idx = context.dataIndex;
                                const item = filteredRatings[idx];
                                const tier = item.avg_rating >= 4.5 ? '⭐ Top Rated Masterpiece' : (item.avg_rating >= 4.0 ? '👍 Good Customer Choice' : '⚠️ Under-Rated (Needs Attention)');
                                return [
                                    `★ Average Rating: ${item.avg_rating.toFixed(1)} / 5.0`,
                                    `💬 Total Reviews: ${item.rating_count} verified reviews`,
                                    `💰 Menu Price: ${formatCurrency(item.price)}`,
                                    `🏷️ Status: ${tier}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        min: 0,
                        max: 5,
                        grid: {
                            color: 'rgba(226, 232, 240, 0.6)',
                            borderDash: [4, 4]
                        },
                        ticks: {
                            stepSize: 1,
                            callback: (val) => val + ' ★',
                            font: { family: 'Outfit, sans-serif', size: 11, weight: '600' },
                            color: '#64748b'
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            font: { family: 'Outfit, sans-serif', size: 11.5, weight: '500' },
                            color: '#1e293b'
                        }
                    }
                }
            }
        });
    }

    // ── 3. Graph 2: Sales Volume Chart (Horizontal Bar) ──────────
    const salesCanvas = document.getElementById('sellerSalesChart');
    if (salesCanvas) {
        const ctx = salesCanvas.getContext('2d');

        // Filter list based on selected pill
        let filteredSales = [...bySalesDesc];
        if (_salesChartFilter === 'top') {
            filteredSales = bySalesDesc.slice(0, 10);
        } else if (_salesChartFilter === 'low') {
            filteredSales = bySalesAsc.slice(0, 10);
        }

        // Adjust canvas height dynamically based on item count
        const calculatedHeight = Math.max(320, filteredSales.length * 36 + 40);
        salesCanvas.parentElement.style.height = `${Math.min(calculatedHeight, 460)}px`;

        const salesLabels = filteredSales.map(item => item.name);
        const salesValues = filteredSales.map(item => item.quantitySold);
        const maxSold = Math.max(...bySalesDesc.map(i => i.quantitySold), 1);

        const salesBgColors = filteredSales.map(item => {
            const grad = ctx.createLinearGradient(0, 0, 360, 0);
            if (item.quantitySold >= maxSold * 0.6) {
                grad.addColorStop(0, '#ea580c'); // Vibrant Orange
                grad.addColorStop(1, '#fb923c');
            } else if (item.quantitySold >= maxSold * 0.25) {
                grad.addColorStop(0, '#2563eb'); // Royal Blue
                grad.addColorStop(1, '#60a5fa');
            } else {
                grad.addColorStop(0, '#475569'); // Slate Grey
                grad.addColorStop(1, '#94a3b8');
            }
            return grad;
        });

        const salesBorders = filteredSales.map(item => {
            if (item.quantitySold >= maxSold * 0.6) return '#c2410c';
            if (item.quantitySold >= maxSold * 0.25) return '#1d4ed8';
            return '#334155';
        });

        if (_salesChartInstance) {
            _salesChartInstance.destroy();
        }

        _salesChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: salesLabels,
                datasets: [{
                    label: 'Units Sold',
                    data: salesValues,
                    backgroundColor: salesBgColors,
                    borderColor: salesBorders,
                    borderWidth: 1,
                    borderRadius: 20,
                    borderSkipped: false,
                    barThickness: 16,
                    maxBarThickness: 20
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 650,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.94)',
                        titleColor: '#ffffff',
                        titleFont: { family: 'Outfit, sans-serif', size: 13, weight: 'bold' },
                        bodyFont: { family: 'Outfit, sans-serif', size: 12 },
                        padding: 12,
                        cornerRadius: 10,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            title: (items) => {
                                const idx = items[0].dataIndex;
                                return filteredSales[idx].name;
                            },
                            label: (context) => {
                                const idx = context.dataIndex;
                                const item = filteredSales[idx];
                                const share = shopTotalSales > 0 ? ((item.quantitySold / shopTotalSales) * 100).toFixed(1) : '0';
                                const tier = (item.quantitySold >= maxSold * 0.6) 
                                    ? '🔥 #1 Bestseller & Crowd Favorite' 
                                    : (item.quantitySold >= maxSold * 0.25 ? '📈 Solid Steady Demand' : '📉 Low Demand / Candidate for Promotion');
                                return [
                                    `📦 Units Sold: ${item.quantitySold.toLocaleString()} pcs (${share}% of shop total)`,
                                    `💵 Total Revenue: ${formatCurrency(item.revenue)}`,
                                    `🏷️ Status: ${tier}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        min: 0,
                        grid: {
                            color: 'rgba(226, 232, 240, 0.6)',
                            borderDash: [4, 4]
                        },
                        ticks: {
                            precision: 0,
                            callback: (val) => val + ' pcs',
                            font: { family: 'Outfit, sans-serif', size: 11, weight: '600' },
                            color: '#64748b'
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            font: { family: 'Outfit, sans-serif', size: 11.5, weight: '500' },
                            color: '#1e293b'
                        }
                    }
                }
            }
        });
    }
}
