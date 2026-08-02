let currentAuthMode = 'login';
let _orderHistoryCache = [];

function switchAuthTab(mode) {
    currentAuthMode = mode;
    
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const authHelpText = document.getElementById('auth-help-text');
    const authSubmitBtn = document.getElementById('auth-submit-btn');

    if (mode === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        authTitle.textContent = 'Shop Login';
        authSubtitle.textContent = 'Enter Shop Name and Shop ID to access dashboard';
        authHelpText.textContent = 'Enter your registered shop credentials.';
        authSubmitBtn.innerHTML = '<span>Enter Portal</span> <i class="bi bi-arrow-right"></i>';
    } else {
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        authTitle.textContent = 'Register New Shop';
        authSubtitle.textContent = 'Create a permanent shop name and shop ID combination';
        authHelpText.textContent = 'This ID and name combination will be locked for this shop.';
        authSubmitBtn.innerHTML = '<span>Register &amp; Enter Shop</span> <i class="bi bi-arrow-right"></i>';
    }
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
        orderHistorySearch.addEventListener('input', filterOrderHistory);
    }

    // Seller Login/Register Form Submit
    const loginForm = document.getElementById('seller-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const shopName = document.getElementById('login_shop_name').value.trim();
            const shopId = document.getElementById('login_shop_id').value.trim();

            const endpoint = currentAuthMode === 'login' ? 'login' : 'register';

            try {
                const response = await fetch(`${API_BASE_URL}/shops/${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ shop_name: shopName, shop_id: shopId })
                });

                if (response.ok) {
                    const data = await response.json();
                    sessionStorage.setItem('shop_name', data.shop_name);
                    sessionStorage.setItem('shop_id', data.shop_id);
                    showToast(data.message || `Access granted! Welcome, ${data.shop_name}`, 'success');
                    checkSession();
                } else {
                    const err = await response.json();
                    showToast(err.detail || 'Access Denied', 'danger');
                }
            } catch (error) {
                console.error('Error logging in:', error);
                showToast('Network error, check backend server', 'danger');
            }
        });
    }

    // Add Food Form Submit
    document.getElementById('add-food-form').addEventListener('submit', async (e) => {
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
        
        const foodData = {
            shop_name: sessionStorage.getItem('shop_name'), // enforce logged in shop name
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
                modal.hide();
                document.getElementById('add-food-form').reset();
                // Re-prefill shop name
                document.getElementById('shop_name').value = sessionStorage.getItem('shop_name');
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
});

// Polyfill strip if not exists
if (!String.prototype.strip) {
    String.prototype.strip = function () {
        return this.replace(/^\s+|\s+$/g, '');
    };
}

function checkSession() {
    const shopName = sessionStorage.getItem('shop_name');
    const shopId = sessionStorage.getItem('shop_id');

    const loginView = document.getElementById('seller-login-view');
    const dashboardView = document.getElementById('seller-dashboard-view');

    if (shopName && shopId) {
        // Authenticated: show dashboard, hide login
        if (loginView) loginView.classList.add('d-none');
        if (dashboardView) {
            dashboardView.classList.remove('d-none');
            document.getElementById('dashboard-shop-title').textContent = shopName;
        }

        // Auto pre-fill shop name in forms
        const shopNameInput = document.getElementById('shop_name');
        if (shopNameInput) shopNameInput.value = shopName;

        loadInventory();
        pollNotifications();
        loadOrderHistory();
    } else {
        // Unauthenticated: show login
        if (loginView) loginView.classList.remove('d-none');
        if (dashboardView) dashboardView.classList.add('d-none');
    }
}

let _notifPollInterval = null;
let _unreadNotifications = [];

async function pollNotifications() {
    const shopId = sessionStorage.getItem('shop_id');
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
            <div class="d-flex align-items-start gap-3 px-4 py-3" id="notif-item-${n.id}"
                 style="${i < _unreadNotifications.length - 1 ? 'border-bottom: 1px solid #f0fdf4;' : ''}
                        background: white; transition: background 0.2s;"
                 onmouseover="this.style.background='#f9fef9'"
                 onmouseout="this.style.background='white'">
                <div style="flex:1; min-width:0;">
                    <div style="font-size:0.9rem; color:#111827; font-weight:500; line-height:1.5;">
                        ${escapeHtml(n.message)}
                    </div>
                    <div style="font-size:0.73rem; color:#9ca3af; margin-top:4px;">
                        ${formatNotifDate(n.created_at)}
                    </div>
                </div>
                <button onclick="dismissNotification(${n.id})"
                        style="flex-shrink:0; background:none; border:none; color:#d1d5db;
                               font-size:1rem; cursor:pointer; padding:2px 6px; border-radius:6px;
                               transition:color 0.2s; line-height:1;"
                        title="Dismiss"
                        onmouseover="this.style.color='#ef4444'"
                        onmouseout="this.style.color='#d1d5db'">✕</button>
            </div>`).join('');
    }
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

function logoutSeller() {
    sessionStorage.removeItem('shop_name');
    sessionStorage.removeItem('shop_id');
    showToast('Logged out successfully', 'info');
    checkSession();
}

async function loadInventory() {
    const shopName = sessionStorage.getItem('shop_name');
    if (!shopName) return;

    try {
        // Get filtered inventory
        const response = await fetch(`${API_BASE_URL}/foods?shop_name=${encodeURIComponent(shopName)}`);
        const foods = await response.json();
        
        const tbody = document.getElementById('inventory-list');
        tbody.innerHTML = '';
        
        if (foods.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">No foods found. Add some delicious meals!</td></tr>';
            return;
        }
        
        foods.forEach(food => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <img src="${food.image_url}" alt="${food.food_name}" class="rounded shadow-sm" style="width: 50px; height: 50px; object-fit: cover;">
                </td>
                <td class="fw-medium">${food.food_name}</td>
                <td class="text-muted">${food.shop_name}</td>
                <td class="fw-bold text-primary">${formatCurrency(food.price)}</td>
                <td>
                    <span class="badge ${food.quantity > 0 ? 'bg-success' : 'bg-danger'} rounded-pill px-3 py-2">
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
    } catch (error) {
        console.error('Error loading inventory:', error);
        document.getElementById('inventory-list').innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Error loading data.</td></tr>';
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

async function loadOrderHistory() {
    const shopName = sessionStorage.getItem('shop_name');
    if (!shopName) return;

    try {
        const response = await fetch(`${API_BASE_URL}/orders/shop/${encodeURIComponent(shopName)}/history`);
        if (!response.ok) throw new Error('Failed to load history');

        const data = await response.json();
        const summary = data.summary || {};
        _orderHistoryCache = data.orders || [];

        document.getElementById('stats-items-sold').textContent = summary.total_items_sold || 0;
        document.getElementById('stats-gross-revenue').textContent = formatCurrency(summary.gross_revenue || 0);
        const totalFees = (summary.admin_fee_cut || 0) + (summary.delivery_fee_cut || 0);
        document.getElementById('stats-total-fees').textContent = formatCurrency(totalFees);
        document.getElementById('stats-net-revenue').textContent = formatCurrency(summary.net_seller_revenue || 0);

        filterOrderHistory();
    } catch (error) {
        console.error('Error loading order history:', error);
        _orderHistoryCache = [];
        const tbody = document.getElementById('order-history-list');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger py-4">Error loading order history.</td></tr>';
        }
    }
}

function filterOrderHistory() {
    const searchEl = document.getElementById('order-history-search');
    const query = searchEl ? searchEl.value.toLowerCase().trim() : '';

    let filtered = _orderHistoryCache;
    if (query) {
        filtered = _orderHistoryCache.filter(order => getOrderSearchText(order).includes(query));
    }

    renderOrderHistory(filtered, query);
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

function renderOrderHistory(orders, query = '') {
    const tbody = document.getElementById('order-history-list');
    if (!tbody) return;

    if (_orderHistoryCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">No orders yet. Sales will appear here once students order your food.</td></tr>';
        return;
    }

    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No orders match "${escapeHtml(query)}".</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    orders.forEach(order => {
        const fees = (order.admin_fee || 0) + (order.delivery_fee || 0);
        const statusClass = order.status === 'Delivered' ? 'bg-success'
            : order.status === 'Pending' ? 'bg-warning text-dark'
            : 'bg-secondary';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold">#${order.id}</td>
            <td class="text-muted small">${formatOrderDate(order.created_at)}</td>
            <td class="fw-medium">${escapeHtml(order.food_name || 'Unknown')}</td>
            <td class="fw-bold">${order.quantity}</td>
            <td>
                <div class="fw-medium">${escapeHtml(order.student_name)}</div>
                <small class="text-muted">${escapeHtml(order.delivery_location || '')}</small>
            </td>
            <td>${formatCurrency(order.total_price || 0)}</td>
            <td class="text-danger">${formatCurrency(fees)}</td>
            <td class="fw-bold text-success">${formatCurrency(order.net_seller_revenue || 0)}</td>
            <td><span class="badge ${statusClass} rounded-pill px-3">${escapeHtml(order.status)}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function formatOrderDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
