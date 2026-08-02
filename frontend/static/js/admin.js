const ADMIN_BASE = '';
let currentOrderFilter = '';
let refreshTimer = null;

// ─── Format helpers ──────────────────────────────────────────
function fmt$(amount) {
    return '৳' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function renderStars(n) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `<span class="${i <= n ? 'star-display' : 'star-empty'}">★</span>`;
    }
    return html;
}

function statusBadge(status) {
    return status === 'Pending'
        ? `<span class="badge-pending">${status}</span>`
        : `<span class="badge-delivered">${status}</span>`;
}

// ─── Sidebar nav ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    loadAll();

    // Auto-refresh every 30 seconds
    refreshTimer = setInterval(() => {
        loadAll();
    }, 30000);
});

function initSidebar() {
    // Toggle sidebar on mobile
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // Section nav
    document.querySelectorAll('[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSection = link.dataset.section;
            showSection(targetSection);
            sidebar.classList.remove('open');
        });
    });

    // Restore active section smoothly
    let initialSection = 'dashboard-section';
    if (window.location.hash) {
        const hashSection = window.location.hash.replace('#', '');
        if (document.getElementById(hashSection)) {
            initialSection = hashSection;
        }
    } else {
        const storedSection = localStorage.getItem('admin_active_section');
        if (storedSection && document.getElementById(storedSection)) {
            initialSection = storedSection;
        }
    }
    showSection(initialSection);
}

function showSection(id) {
    if (!id || !document.getElementById(id)) id = 'dashboard-section';

    // Remove temporary initial anti-flash style tag if present
    const flashStyle = document.getElementById('anti-flash-style');
    if (flashStyle) flashStyle.remove();

    document.querySelectorAll('.admin-section').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    document.querySelectorAll('[data-section]').forEach(l => l.classList.remove('active'));

    const sec = document.getElementById(id);
    if (sec) {
        sec.classList.add('active');
        sec.style.display = 'block';
    }

    const link = document.querySelector(`[data-section="${id}"]`);
    if (link) link.classList.add('active');

    try {
        localStorage.setItem('admin_active_section', id);
        if (window.location.hash !== '#' + id) {
            history.replaceState(null, '', '#' + id);
        }
    } catch (e) { }

    // Load section data on demand
    if (id === 'shops-section') { loadShops(); loadNotifications(); }
    if (id === 'delivery-boys-section') loadDeliveryBoys();
    if (id === 'foods-section') loadFoods();
    if (id === 'orders-section') loadOrders();
    if (id === 'ratings-section') loadRatings();
    if (id === 'complaints-section') loadComplaints();
    if (id === 'settings-section') loadSettings();
    if (id === 'activity-section') loadActivityLog();
}

// ─── Load All ────────────────────────────────────────────────
async function loadAll() {
    await Promise.all([loadStats(), loadRecentOrders(), loadRecentRatings(), loadCharts(), loadShops(), loadDeliveryBoys()]);
    document.getElementById('last-updated').textContent =
        'Updated ' + new Date().toLocaleTimeString();
}

// ─── Stats ───────────────────────────────────────────────────
async function loadStats() {
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/stats`);
        const d = await res.json();
        document.getElementById('stat-foods').textContent = d.total_foods;
        document.getElementById('stat-orders').textContent = d.total_orders;
        document.getElementById('stat-pending').textContent = d.pending_orders;
        document.getElementById('stat-delivered').textContent = d.delivered_orders;
        const boyStatEl = document.getElementById('stat-delivery-boys');
        if (boyStatEl) boyStatEl.textContent = d.total_delivery_boys || 0;
        document.getElementById('stat-revenue').textContent = fmt$(d.total_revenue);
        document.getElementById('stat-admin-revenue').textContent = fmt$(d.total_admin_revenue);
        document.getElementById('stat-delivery-earnings').textContent = fmt$(d.total_delivery_earnings);
        document.getElementById('stat-ratings').textContent = d.total_ratings;
        document.getElementById('stat-avg-rating').textContent =
            d.avg_platform_rating ? d.avg_platform_rating + ' ★' : 'N/A';
        document.getElementById('stat-top-food').textContent = d.top_food || 'N/A';
    } catch (e) {
        console.error('Stats error', e);
    }
}

// ─── Recent Orders (dashboard widget) ────────────────────────
async function loadRecentOrders() {
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/orders`);
        const orders = await res.json();
        const tbody = document.getElementById('recent-orders-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const recent = orders.slice(0, 8);
        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3 text-muted">No orders yet</td></tr>';
            return;
        }
        recent.forEach(o => {
            tbody.innerHTML += `
                <tr>
                    <td class="fw-bold">#${o.id}</td>
                    <td>${o.student_name}</td>
                    <td>${o.food_name}</td>
                    <td>${statusBadge(o.status)}</td>
                    <td>${fmt$(o.total_price)}</td>
                </tr>`;
        });
    } catch (e) { console.error('Recent orders error', e); }
}

// ─── Recent Ratings (dashboard widget) ───────────────────────
async function loadRecentRatings() {
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/ratings`);
        const ratings = await res.json();
        const tbody = document.getElementById('recent-ratings-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const recent = ratings.slice(0, 8);
        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-muted">No ratings yet</td></tr>';
            return;
        }
        recent.forEach(r => {
            tbody.innerHTML += `
                <tr>
                    <td>${r.food_name}</td>
                    <td>${r.student_id}</td>
                    <td>${renderStars(r.stars)}</td>
                    <td class="text-muted" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.comment || '—'}</td>
                </tr>`;
        });
    } catch (e) { console.error('Recent ratings error', e); }
}

// ─── Full Foods Table ─────────────────────────────────────────
async function loadFoods() {
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/foods`);
        const foods = await res.json();
        const tbody = document.getElementById('foods-tbody');
        tbody.innerHTML = '';
        if (foods.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">No foods found</td></tr>';
            return;
        }
        foods.forEach(f => {
            const stockBadge = f.quantity > 0
                ? `<span class="badge-delivered">${f.quantity}</span>`
                : `<span class="badge-pending">Out</span>`;
            tbody.innerHTML += `
                <tr>
                    <td>${f.id}</td>
                    <td><img src="${f.image_url}" class="food-thumb" onerror="this.src='https://via.placeholder.com/44'"></td>
                    <td class="fw-medium">${f.food_name}</td>
                    <td>${f.shop_name}</td>
                    <td>${fmt$(f.price)}</td>
                    <td>${stockBadge}</td>
                    <td>${f.avg_rating ? f.avg_rating + ' ★' : '—'}</td>
                    <td>${f.rating_count}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger rounded-pill" onclick="adminDeleteFood(${f.id}, this)">Delete</button>
                    </td>
                </tr>`;
        });
    } catch (e) { console.error('Foods error', e); }
}

async function adminDeleteFood(id, btn) {
    showConfirm(
        '🗑️ Delete Food Item',
        'This food will be permanently removed. Orders linked to it may show "Deleted". This cannot be undone.',
        async () => {
            btn.disabled = true;
            try {
                const res = await fetch(`${ADMIN_BASE}/admin/api/foods/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    btn.closest('tr').remove();
                    loadStats();
                } else {
                    showAlert('Failed to delete food item. Please try again.');
                    btn.disabled = false;
                }
            } catch (e) {
                showAlert('Network error. Please check your connection.');
                btn.disabled = false;
            }
        }
    );
}

// ─── Full Orders Table ────────────────────────────────────────
async function loadOrders(filter) {
    if (filter !== undefined) currentOrderFilter = filter;
    try {
        let url = `${ADMIN_BASE}/admin/api/orders`;
        if (currentOrderFilter) url += `?status=${currentOrderFilter}`;
        const res = await fetch(url);
        const orders = await res.json();
        const tbody = document.getElementById('orders-tbody');
        tbody.innerHTML = '';
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" class="text-center py-4 text-muted">No orders found</td></tr>';
            return;
        }
        orders.forEach(o => {
            const adminFee = o.admin_fee != null ? fmt$(o.admin_fee) : '—';
            const deliveryFee = o.delivery_fee != null ? fmt$(o.delivery_fee) : '—';
            const deliveryBoy = o.delivery_boy_id ? `<code>${o.delivery_boy_id}</code>` : '<span class="text-muted small">—</span>';
            tbody.innerHTML += `
                <tr>
                    <td>#${o.id}</td>
                    <td class="fw-medium">${o.student_name}</td>
                    <td><code>${o.student_id}</code></td>
                    <td>${o.food_name}</td>
                    <td>${o.shop_name}</td>
                    <td>${o.quantity}</td>
                    <td>${fmt$(o.total_price)}</td>
                    <td><span class="fee-badge fee-admin">${adminFee}</span></td>
                    <td><span class="fee-badge fee-delivery">${deliveryFee}</span></td>
                    <td>${deliveryBoy}</td>
                    <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.delivery_location}</td>
                    <td>${statusBadge(o.status)}</td>
                    <td style="white-space:nowrap">${fmtDate(o.created_at)}</td>
                </tr>`;
        });
    } catch (e) { console.error('Orders error', e); }
}

function setOrderFilter(btn, filter) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadOrders(filter);
}

// ─── Full Ratings Table ───────────────────────────────────────
async function loadRatings() {
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/ratings`);
        const ratings = await res.json();
        const tbody = document.getElementById('ratings-tbody');
        tbody.innerHTML = '';
        if (ratings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No ratings yet</td></tr>';
            return;
        }
        ratings.forEach(r => {
            tbody.innerHTML += `
                <tr>
                    <td>${r.id}</td>
                    <td class="fw-medium">${r.food_name}</td>
                    <td>${r.shop_name}</td>
                    <td><code>${r.student_id}</code></td>
                    <td>${renderStars(r.stars)}</td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.comment || '—'}</td>
                    <td style="white-space:nowrap">${fmtDate(r.created_at)}</td>
                </tr>`;
        });
    } catch (e) { console.error('Ratings error', e); }
}

// ─── Settings ────────────────────────────────────────────────
async function loadSettings() {
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/settings`);
        const s = await res.json();
        const adminPct = s.admin_fee_percent ?? 1.0;
        const deliveryPct = s.delivery_fee_percent ?? 1.0;

        document.getElementById('admin-fee-slider').value = adminPct;
        document.getElementById('admin-fee-input').value = adminPct;
        document.getElementById('admin-fee-display').textContent = adminPct + '%';

        document.getElementById('delivery-fee-slider').value = deliveryPct;
        document.getElementById('delivery-fee-input').value = deliveryPct;
        document.getElementById('delivery-fee-display').textContent = deliveryPct + '%';
    } catch (e) {
        console.error('Settings load error', e);
    }
}

async function saveSettings() {
    const adminPct = parseFloat(document.getElementById('admin-fee-input').value);
    const deliveryPct = parseFloat(document.getElementById('delivery-fee-input').value);
    const msgEl = document.getElementById('settings-msg');

    if (isNaN(adminPct) || isNaN(deliveryPct) || adminPct < 0 || deliveryPct < 0) {
        msgEl.innerHTML = '<span class="text-danger">Please enter valid percentages (0–100).</span>';
        return;
    }

    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_fee_percent: adminPct,
                delivery_fee_percent: deliveryPct
            })
        });

        if (res.ok) {
            msgEl.innerHTML = '<span class="text-success">Settings saved! New fees apply to all future orders.</span>';
            setTimeout(() => { msgEl.innerHTML = ''; }, 4000);
            loadStats(); // refresh revenue cards
        } else {
            const err = await res.json();
            msgEl.innerHTML = `<span class="text-danger">${err.detail || 'Save failed'}</span>`;
        }
    } catch (e) {
        msgEl.innerHTML = '<span class="text-danger">Network error.</span>';
    }
}

// ─── Shops Table ─────────────────────────────────────────────
async function loadShops() {
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/shops`);
        const shops = await res.json();
        const tbody = document.getElementById('shops-tbody');
        if (!tbody) return;
        if (!Array.isArray(shops) || shops.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No registered shops yet</td></tr>';
            return;
        }
        let rowsHtml = '';
        shops.forEach((shop, i) => {
            const unreadBadge = shop.unread_notifications > 0
                ? `<span class="badge bg-warning text-dark rounded-pill">${shop.unread_notifications} unread</span>`
                : `<span class="text-muted small">—</span>`;
            rowsHtml += `
                <tr>
                    <td>${i + 1}</td>
                    <td class="fw-bold">${shop.shop_name}</td>
                    <td><code>${shop.shop_id}</code></td>
                    <td>${shop.food_count}</td>
                    <td>${unreadBadge}</td>
                    <td style="white-space:nowrap">${fmtDate(shop.created_at)}</td>
                    <td>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-success rounded-pill"
                                    onclick="openNotifModal('${shop.shop_id}', '${shop.shop_name.replace(/'/g, "\\'")}')">Notify</button>
                            <button class="btn btn-sm btn-outline-danger rounded-pill"
                                    onclick="adminDeleteShop(${shop.id}, this)">Delete</button>
                        </div>
                    </td>
                </tr>`;
        });
        tbody.innerHTML = rowsHtml;
    } catch (e) { console.error('Shops error', e); }
}

// ─── Toast Notification ──────────────────────────────────────────
function showToast(message, type) {
    type = type || 'info';
    // Remove any existing toast
    const existing = document.getElementById('admin-toast-container');
    if (existing) existing.remove();

    const colorMap = {
        success: '#10b981',
        danger: '#ef4444',
        warning: '#f59e0b',
        info: '#6366f1'
    };
    const iconMap = {
        success: '✅',
        danger: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    const container = document.createElement('div');
    container.id = 'admin-toast-container';
    container.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; z-index: 99999;
        background: #1e293b; color: #f1f5f9;
        border-left: 4px solid ${colorMap[type] || colorMap.info};
        border-radius: 12px; padding: 14px 20px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.35);
        font-family: Outfit, sans-serif; font-size: 0.9rem;
        display: flex; align-items: center; gap: 10px;
        max-width: 340px; animation: fadeInUp 0.3s ease;
        transition: opacity 0.4s ease;
    `;

    // Add keyframe if not already there
    if (!document.getElementById('toast-keyframe-style')) {
        const style = document.createElement('style');
        style.id = 'toast-keyframe-style';
        style.textContent = '@keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}';
        document.head.appendChild(style);
    }

    container.innerHTML = `<span style="font-size:1.1rem">${iconMap[type] || iconMap.info}</span><span>${message}</span>`;
    document.body.appendChild(container);

    setTimeout(() => {
        container.style.opacity = '0';
        setTimeout(() => container.remove(), 400);
    }, 3500);
}

// ─── Delivery Boys Management ────────────────────────────────────
let allDeliveryBoysData = [];
let dbCurrentPage = 1;
const dbPageSize = 5;

async function loadDeliveryBoys() {
    const tbody = document.getElementById('delivery-boys-tbody');

    // Show loading spinner
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted"><div class="spinner-border text-primary spinner-border-sm me-2" role="status"></div> Loading delivery boys...</td></tr>';
    }

    const apiUrl = `${ADMIN_BASE}/admin/api/delivery-boys`;
    console.log('[DeliveryBoys] Fetching URL:', apiUrl);
    console.log('[DeliveryBoys] ADMIN_BASE is:', JSON.stringify(ADMIN_BASE));

    // ── Step 1: Fetch from API ───────────────────────────────────
    let rawData = null;
    try {
        const res = await fetch(apiUrl, { cache: 'no-store' });
        console.log('[DeliveryBoys] HTTP Status:', res.status, res.statusText);
        console.log('[DeliveryBoys] Content-Type:', res.headers.get('content-type'));

        const rawText = await res.text();
        console.log('[DeliveryBoys] Raw response (first 300 chars):', rawText.slice(0, 300));

        if (!res.ok) {
            throw new Error(`HTTP ${res.status} – ${rawText.slice(0, 150) || res.statusText}`);
        }

        try {
            rawData = JSON.parse(rawText);
        } catch (parseErr) {
            throw new Error(`JSON parse failed: ${parseErr.message} | body was: ${rawText.slice(0, 100)}`);
        }

    } catch (fetchErr) {
        console.error('[DeliveryBoys] ❌ Fetch/parse error:', fetchErr);
        const errMsg = fetchErr.message || String(fetchErr);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4">
                <div class="text-danger fw-semibold mb-2"><i class="bi bi-wifi-off me-2"></i>Network or Server Error</div>
                <small class="text-muted font-monospace">${errMsg}</small>
                <div class="mt-2"><button class="btn btn-sm btn-outline-primary rounded-pill" onclick="loadDeliveryBoys()">Try Again</button></div>
            </td></tr>`;
        }
        return;
    }

    // ── Step 2: Parse response data ──────────────────────────────
    const boys = Array.isArray(rawData) ? rawData : (rawData.deliveryBoys || rawData.data || []);
    allDeliveryBoysData = Array.isArray(boys) ? boys : [];
    console.log('[DeliveryBoys] ✅ Parsed', allDeliveryBoysData.length, 'delivery boys:', allDeliveryBoysData);

    const statEl = document.getElementById('stat-delivery-boys');
    if (statEl) statEl.textContent = allDeliveryBoysData.length;

    // ── Step 3: Render table (separate try so render bugs show clearly) ──
    try {
        renderDeliveryBoysTable();
        console.log('[DeliveryBoys] ✅ Table rendered successfully');
    } catch (renderErr) {
        console.error('[DeliveryBoys] ❌ Render error:', renderErr);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4">
                <div class="text-warning fw-semibold mb-2"><i class="bi bi-exclamation-triangle me-2"></i>Data loaded but display error occurred</div>
                <small class="text-muted font-monospace">${renderErr.message}</small>
                <div class="mt-2"><button class="btn btn-sm btn-outline-primary rounded-pill" onclick="renderDeliveryBoysTable()">Retry Render</button></div>
            </td></tr>`;
        }
    }
}

function renderDeliveryBoysTable() {
    const tbody = document.getElementById('delivery-boys-tbody');
    if (!tbody) {
        console.warn('[DeliveryBoys] renderDeliveryBoysTable: tbody not found in DOM');
        return;
    }

    const searchEl = document.getElementById('delivery-boy-search');
    const query = (searchEl ? searchEl.value : '').trim().toLowerCase();
    console.log('[DeliveryBoys] Rendering with query:', JSON.stringify(query), '| total records:', allDeliveryBoysData.length);

    // Filter by Delivery Boy ID or Name
    const filtered = allDeliveryBoysData.filter(boy => {
        const name = (boy.delivery_boy_name || boy.name || '').toLowerCase();
        const dbId = (boy.delivery_boy_id || '').toLowerCase();
        return name.includes(query) || dbId.includes(query);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted fw-medium"><i class="bi bi-person-x fs-4 d-block mb-2 text-secondary"></i>No delivery boys found.</td></tr>';
        const infoEl = document.getElementById('db-pagination-info');
        if (infoEl) infoEl.textContent = 'Showing 0 of 0 delivery boys';
        const prevBtn = document.getElementById('db-prev-btn');
        const nextBtn = document.getElementById('db-next-btn');
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        return;
    }

    const totalPages = Math.ceil(filtered.length / dbPageSize);
    if (dbCurrentPage > totalPages) dbCurrentPage = totalPages;
    if (dbCurrentPage < 1) dbCurrentPage = 1;

    const startIdx = (dbCurrentPage - 1) * dbPageSize;
    const endIdx = Math.min(startIdx + dbPageSize, filtered.length);
    const pageItems = filtered.slice(startIdx, endIdx);

    let rowsHtml = '';
    pageItems.forEach((boy, i) => {
        const rowNum = startIdx + i + 1;
        const isOnline = boy.status === 'Online';
        const statusBadge = isOnline
            ? `<span class="badge bg-success rounded-pill px-3 py-1">🟢 Online</span>`
            : `<span class="badge bg-secondary rounded-pill px-3 py-1">⚫ Offline</span>`;
        const nameStr = boy.delivery_boy_name || boy.name || 'Delivery Boy';
        const boyIdStr = boy.delivery_boy_id || '—';
        const doneCount = boy.deliveries_done || 0;

        const safeNameEsc = nameStr.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeIdEsc = boyIdStr.replace(/'/g, "\\'").replace(/"/g, '&quot;');

        rowsHtml += `
            <tr>
                <td class="text-muted fw-medium">${rowNum}</td>
                <td class="fw-bold text-dark">${nameStr}</td>
                <td><code class="px-2 py-1 bg-light rounded text-primary fw-semibold">${boyIdStr}</code></td>
                <td>${statusBadge}</td>
                <td class="fw-bold">${doneCount}</td>
                <td class="text-muted" style="white-space:nowrap">${fmtDate(boy.created_at)}</td>
                <td>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-primary rounded-pill px-3"
                                onclick="openEditDeliveryBoyModal(${boy.id}, '${safeNameEsc}', '${safeIdEsc}')">
                            <i class="bi bi-pencil me-1"></i>Edit
                        </button>
                        <button class="btn btn-sm btn-outline-danger rounded-pill px-3"
                                onclick="adminDeleteDeliveryBoy(${boy.id}, this)">
                            <i class="bi bi-trash me-1"></i>Delete
                        </button>
                    </div>
                </td>
            </tr>`;
    });

    tbody.innerHTML = rowsHtml;

    // Update Pagination controls
    const infoEl = document.getElementById('db-pagination-info');
    if (infoEl) {
        infoEl.textContent = `Showing ${startIdx + 1} to ${endIdx} of ${filtered.length} delivery boys (Page ${dbCurrentPage} of ${totalPages})`;
    }
    const prevBtn = document.getElementById('db-prev-btn');
    const nextBtn = document.getElementById('db-next-btn');
    if (prevBtn) prevBtn.disabled = dbCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = dbCurrentPage >= totalPages;
}

function onDeliveryBoySearch() {
    dbCurrentPage = 1;
    renderDeliveryBoysTable();
}

function changeDeliveryBoyPage(dir) {
    dbCurrentPage += dir;
    renderDeliveryBoysTable();
}

function openEditDeliveryBoyModal(id, name, dbId) {
    document.getElementById('edit_db_id_pk').value = id;
    document.getElementById('edit_db_name').value = name;
    document.getElementById('edit_db_id_code').value = dbId;

    const modalEl = document.getElementById('editDeliveryBoyModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

async function saveEditDeliveryBoy(event) {
    event.preventDefault();
    const id = document.getElementById('edit_db_id_pk').value;
    const name = document.getElementById('edit_db_name').value.trim();
    const delivery_boy_id = document.getElementById('edit_db_id_code').value.trim();
    const saveBtn = document.getElementById('edit-db-save-btn');

    if (!name || !delivery_boy_id) {
        showToast('Please fill in all fields', 'warning');
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/delivery-boys/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, delivery_boy_id })
        });
        const data = await res.json();

        if (res.ok && data.success !== false) {
            showToast(data.detail || 'Delivery boy updated successfully', 'success');
            const modalEl = document.getElementById('editDeliveryBoyModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            await loadDeliveryBoys();
        } else {
            showToast(data.detail || 'Failed to update delivery boy', 'danger');
        }
    } catch (e) {
        console.error('Update delivery boy error', e);
        showToast('Network error while updating delivery boy', 'danger');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Save Changes';
    }
}

async function adminDeleteDeliveryBoy(id, btn) {
    showConfirm(
        '🚴 Delete Delivery Boy',
        'Are you sure you want to delete this delivery boy from the database? This action cannot be undone.',
        async () => {
            if (btn) btn.disabled = true;
            try {
                const res = await fetch(`${ADMIN_BASE}/admin/api/delivery-boys/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (res.ok && data.success !== false) {
                    showToast(data.detail || 'Delivery boy deleted successfully', 'success');
                    await loadDeliveryBoys();
                    loadStats();
                } else {
                    showToast(data.detail || 'Failed to delete delivery boy', 'danger');
                    if (btn) btn.disabled = false;
                }
            } catch (e) {
                console.error('Delete error', e);
                showToast('Failed to delete delivery boy', 'danger');
                if (btn) btn.disabled = false;
            }
        }
    );
}

async function adminDeleteShop(id, btn) {
    showConfirm(
        '🏪 Delete Shop',
        'The shop and all its login credentials will be permanently removed. This cannot be undone.',
        async () => {
            btn.disabled = true;
            try {
                const res = await fetch(`${ADMIN_BASE}/admin/api/shops/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    btn.closest('tr').remove();
                    loadStats();
                } else {
                    const err = await res.json();
                    showAlert(err.detail || 'Failed to delete shop.');
                    btn.disabled = false;
                }
            } catch (e) {
                showAlert('Network error. Please check your connection.');
                btn.disabled = false;
            }
        }
    );
}

// ─── Notifications ────────────────────────────────────────────
function openNotifModal(shopId, shopName) {
    document.getElementById('notif-shop-id').value = shopId;
    document.getElementById('notif-shop-name').value = shopName;
    document.getElementById('notif-target-label').textContent = `${shopName} (${shopId})`;
    document.getElementById('notif-message').value = '';
    const modal = new bootstrap.Modal(document.getElementById('sendNotifModal'));
    modal.show();
}

async function submitNotification() {
    const shopId = document.getElementById('notif-shop-id').value;
    const shopName = document.getElementById('notif-shop-name').value;
    const message = document.getElementById('notif-message').value.trim();
    if (!message) {
        alert('Please enter a message before sending.');
        return;
    }
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop_id: shopId, shop_name: shopName, message })
        });
        if (res.ok) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('sendNotifModal'));
            modal.hide();
            loadShops();
            loadNotifications();
        } else {
            const err = await res.json();
            alert(err.detail || 'Failed to send notification');
        }
    } catch (e) {
        alert('Network error while sending notification');
    }
}

async function loadNotifications() {
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/notifications`);
        const notifs = await res.json();
        const tbody = document.getElementById('notifications-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (notifs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No notifications sent yet</td></tr>';
            return;
        }
        notifs.forEach((n, i) => {
            const readBadge = n.is_read
                ? '<span class="badge-delivered">Read ✓</span>'
                : '<span class="badge-pending">Unread</span>';
            tbody.innerHTML += `
                <tr>
                    <td>${i + 1}</td>
                    <td class="fw-medium">${n.shop_name || '—'}</td>
                    <td><code>${n.shop_id}</code></td>
                    <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${n.message}</td>
                    <td>${readBadge}</td>
                    <td style="white-space:nowrap">${fmtDate(n.created_at)}</td>
                </tr>`;
        });
    } catch (e) { console.error('Notifications error', e); }
}

// ─── Activity Log ─────────────────────────────────────────────

const ACT_META = {
    order: { color: '#5C5CFF', bg: '#eeeeff', icon: 'O', label: 'Order' },
    delivery: { color: '#059669', bg: '#d1fae5', icon: 'D', label: 'Delivery' },
    food: { color: '#d97706', bg: '#fef3c7', icon: 'F', label: 'Food' },
    shop: { color: '#7c3aed', bg: '#ede9fe', icon: 'S', label: 'Shop' },
    notification: { color: '#0ea5e9', bg: '#e0f2fe', icon: 'N', label: 'Notif' },
    settings: { color: '#64748b', bg: '#f1f5f9', icon: 'G', label: 'Settings' },
    admin: { color: '#3b82f6', bg: '#dbeafe', icon: 'A', label: 'Admin' },
};

let _allActivityLogs = [];
let _activityCat = '';

async function loadActivityLog() {
    const timeline = document.getElementById('activity-timeline');
    if (!timeline) return;
    timeline.innerHTML = '<div class="act-empty-state">Loading...</div>';
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/activity-log?limit=200`);
        _allActivityLogs = await res.json();
        renderActivityTimeline();
    } catch (e) {
        timeline.innerHTML = '<div class="act-empty-state">Failed to load activity log.</div>';
        console.error('Activity log error', e);
    }
}

function setActivityCat(btn, cat) {
    document.querySelectorAll('.act-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _activityCat = cat;
    renderActivityTimeline();
}

function filterActivityLog() {
    renderActivityTimeline();
}

function renderActivityTimeline() {
    const timeline = document.getElementById('activity-timeline');
    if (!timeline) return;
    const search = (document.getElementById('activity-search')?.value || '').toLowerCase();

    let logs = _allActivityLogs;
    if (_activityCat) logs = logs.filter(l => l.category === _activityCat);
    if (search) logs = logs.filter(l =>
        (l.summary || '').toLowerCase().includes(search) ||
        (l.detail || '').toLowerCase().includes(search) ||
        (l.action || '').toLowerCase().includes(search)
    );

    if (logs.length === 0) {
        timeline.innerHTML = '<div class="act-empty-state">No activity found.</div>';
        return;
    }

    timeline.innerHTML = logs.map(log => {
        const m = ACT_META[log.category] || { color: '#5C5CFF', bg: '#eeeeff', icon: '?', label: log.category };
        const ago = timeAgo(log.created_at);
        const detail = log.detail
            ? `<div class="act-detail">${escHtml(log.detail)}</div>`
            : '';
        return `
        <div class="act-item">
            <div class="act-dot" style="background:${m.color}; color:#fff;">${m.icon}</div>
            <div class="act-body">
                <div class="act-head">
                    <span class="act-badge" style="background:${m.bg}; color:${m.color};">${m.label}</span>
                    <span class="act-action">${escHtml(log.action || '')}</span>
                    <span class="act-time">${ago}</span>
                </div>
                <div class="act-summary">${escHtml(log.summary || '')}</div>
                ${detail}
            </div>
        </div>`;
    }).join('');
}

function timeAgo(iso) {
    if (!iso) return '—';
    const diff = Math.floor((Date.now() - new Date(iso + 'Z')) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Custom Confirm Modal ─────────────────────────────────────────
function showConfirm(title, message, onConfirm) {
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalMsg').textContent = message;

    const okBtn = document.getElementById('confirmModalOk');
    const cancelBtn = document.getElementById('confirmModalCancel');
    const modal = new bootstrap.Modal(document.getElementById('customConfirmModal'), { backdrop: 'static' });

    // Clone button to remove any old listeners
    const newOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);

    newOk.addEventListener('click', () => {
        modal.hide();
        if (typeof onConfirm === 'function') onConfirm();
    });

    // Re-bind hover effects on cloned button
    newOk.addEventListener('mouseover', () => { newOk.style.transform = 'translateY(-2px)'; newOk.style.boxShadow = '0 8px 20px rgba(92,92,255,0.4)'; });
    newOk.addEventListener('mouseout', () => { newOk.style.transform = 'translateY(0)'; newOk.style.boxShadow = 'none'; });

    modal.show();
}

// ─── Custom Alert Modal ───────────────────────────────────────────
function showAlert(message) {
    document.getElementById('alertModalMsg').textContent = message;
    const modal = new bootstrap.Modal(document.getElementById('customAlertModal'));
    modal.show();
}

// ─── Charts ──────────────────────────────────────────────────────
const _charts = {};

function makeChart(id, config) {
    if (_charts[id]) { _charts[id].destroy(); }
    const ctx = document.getElementById(id);
    if (!ctx) return;
    _charts[id] = new Chart(ctx, config);
}

const PALETTE = [
    '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899',
    '#14b8a6', '#8b5cf6', '#f43f5e', '#84cc16', '#0ea5e9'
];

async function loadCharts() {
    try {
        const res = await fetch('/admin/api/charts');
        if (!res.ok) return;
        const d = await res.json();

        const gridColor = 'rgba(255,255,255,0.08)';
        const textColor = '#94a3b8';
        const tooltipBg = '#1e293b';

        const baseFont = { family: 'Outfit, sans-serif', size: 11 };
        const baseTooltip = {
            backgroundColor: tooltipBg,
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
        };

        // ── 1. Revenue Trend (line) ──────────────────────────────
        makeChart('chart-revenue', {
            type: 'line',
            data: {
                labels: d.revenue_by_day.labels,
                datasets: [{
                    label: 'Revenue (৳)',
                    data: d.revenue_by_day.data,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99,102,241,0.15)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#6366f1',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderWidth: 2.5,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        ...baseTooltip, callbacks: {
                            label: ctx => ` ৳${ctx.raw.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: textColor, font: baseFont }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor, font: baseFont, callback: v => '৳' + v }, grid: { color: gridColor }, beginAtZero: true }
                }
            }
        });

        // ── 2. Orders by Status (doughnut) ─────────────────────
        const statusLabels = Object.keys(d.orders_by_status);
        const statusData = Object.values(d.orders_by_status);
        const statusColors = { Pending: '#f59e0b', Ready: '#3b82f6', 'Out for Delivery': '#8b5cf6', Delivered: '#10b981', Cancelled: '#f43f5e' };
        if (statusLabels.length > 0) {
            makeChart('chart-status', {
                type: 'doughnut',
                data: {
                    labels: statusLabels,
                    datasets: [{ data: statusData, backgroundColor: statusLabels.map(s => statusColors[s] || '#6366f1'), borderWidth: 0, hoverOffset: 8 }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: { position: 'bottom', labels: { color: textColor, font: baseFont, padding: 10, boxWidth: 12 } },
                        tooltip: { ...baseTooltip }
                    }
                }
            });
        } else {
            const c = document.getElementById('chart-status');
            if (c) { const ctx2 = c.getContext('2d'); ctx2.fillStyle = '#94a3b8'; ctx2.font = '14px Outfit,sans-serif'; ctx2.textAlign = 'center'; ctx2.fillText('No orders yet', c.width / 2, c.height / 2); }
        }

        // ── 3. Orders per Shop (horizontal bar) ─────────────────
        if (d.orders_per_shop.labels.length > 0) {
            makeChart('chart-shops', {
                type: 'bar',
                data: {
                    labels: d.orders_per_shop.labels,
                    datasets: [{
                        label: 'Orders',
                        data: d.orders_per_shop.data,
                        backgroundColor: PALETTE.slice(0, d.orders_per_shop.labels.length),
                        borderRadius: 6,
                        borderSkipped: false,
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { ...baseTooltip }
                    },
                    scales: {
                        x: { ticks: { color: textColor, font: baseFont, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true },
                        y: { ticks: { color: textColor, font: baseFont }, grid: { display: false } }
                    }
                }
            });
        } else {
            const c = document.getElementById('chart-shops');
            if (c) { const ctx2 = c.getContext('2d'); ctx2.fillStyle = '#94a3b8'; ctx2.font = '14px Outfit,sans-serif'; ctx2.textAlign = 'center'; ctx2.fillText('No data yet', c.width / 2, c.height / 2); }
        }

        // ── 4. Rating Distribution (bar) ────────────────────────
        makeChart('chart-ratings', {
            type: 'bar',
            data: {
                labels: ['1 ★', '2 ★', '3 ★', '4 ★', '5 ★'],
                datasets: [{
                    label: 'Reviews',
                    data: d.rating_distribution,
                    backgroundColor: ['#f43f5e', '#f59e0b', '#eab308', '#3b82f6', '#10b981'],
                    borderRadius: 6,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { ...baseTooltip } },
                scales: {
                    x: { ticks: { color: textColor, font: baseFont }, grid: { display: false } },
                    y: { ticks: { color: textColor, font: baseFont, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true }
                }
            }
        });

        // ── 5. Top Foods by Volume (polar area) ─────────────────
        if (d.top_foods_by_volume.labels.length > 0) {
            makeChart('chart-foods', {
                type: 'polarArea',
                data: {
                    labels: d.top_foods_by_volume.labels,
                    datasets: [{ data: d.top_foods_by_volume.data, backgroundColor: PALETTE.map(c => c + 'cc'), borderWidth: 0 }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: textColor, font: { ...baseFont, size: 10 }, padding: 6, boxWidth: 10 } },
                        tooltip: { ...baseTooltip, callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} sold` } }
                    },
                    scales: { r: { grid: { color: gridColor }, ticks: { display: false } } }
                }
            });
        } else {
            const c = document.getElementById('chart-foods');
            if (c) { const ctx2 = c.getContext('2d'); ctx2.fillStyle = '#94a3b8'; ctx2.font = '14px Outfit,sans-serif'; ctx2.textAlign = 'center'; ctx2.fillText('No data yet', c.width / 2, c.height / 2); }
        }

    } catch (e) { console.error('Charts error', e); }
}

// ─── Complaints ──────────────────────────────────────────────
function complaintRoleBadge(role) {
    const map = {
        buyer: '<span class="badge bg-danger rounded-pill">Buyer</span>',
        seller: '<span class="badge bg-warning text-dark rounded-pill">Seller</span>',
        delivery: '<span class="badge bg-primary rounded-pill">Delivery</span>',
    };
    return map[role] || `<span class="badge bg-secondary rounded-pill">${role || 'Unknown'}</span>`;
}

function complaintStatusBadge(status) {
    const map = {
        Open: 'badge-pending',
        Reviewed: 'badge bg-info text-dark rounded-pill px-2',
        Resolved: 'badge-delivered',
    };
    if (status === 'Reviewed') return `<span class="${map.Reviewed}">${status}</span>`;
    return status === 'Resolved'
        ? `<span class="badge-delivered">${status}</span>`
        : `<span class="badge-pending">${status}</span>`;
}

async function loadComplaints() {
    const tbody = document.getElementById('complaints-tbody');
    if (!tbody) return;

    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/complaints`);
        const complaints = await res.json();
        tbody.innerHTML = '';

        if (!complaints.length) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 text-muted">No complaints submitted yet.</td></tr>';
            return;
        }

        complaints.forEach(c => {
            const photoCell = c.image_url
                ? `<a href="${c.image_url}" target="_blank" rel="noopener"><img src="${c.image_url}" alt="Complaint photo" style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;"></a>`
                : '<span class="text-muted small">—</span>';
            const msg = (c.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const shopCell = c.shop_name
                ? `<span class="fw-medium text-capitalize">${c.shop_name}</span>`
                : '<span class="text-muted small">—</span>';
            tbody.innerHTML += `
                <tr>
                    <td class="fw-bold">#${c.id}</td>
                    <td>${complaintRoleBadge(c.role)}</td>
                    <td>${c.name || '—'}</td>
                    <td>${shopCell}</td>
                    <td>${c.contact || '—'}</td>
                    <td style="max-width:260px; white-space:normal;">${msg}</td>
                    <td>${photoCell}</td>
                    <td>${complaintStatusBadge(c.status)}</td>
                    <td class="small text-muted">${fmtDate(c.created_at)}</td>
                    <td>
                        <div class="d-flex flex-wrap gap-1">
                            <select class="form-select form-select-sm" style="width:110px;" onchange="updateComplaintStatus(${c.id}, this.value)">
                                <option value="Open" ${c.status === 'Open' ? 'selected' : ''}>Open</option>
                                <option value="Reviewed" ${c.status === 'Reviewed' ? 'selected' : ''}>Reviewed</option>
                                <option value="Resolved" ${c.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                            </select>
                            <button class="btn btn-sm btn-outline-danger rounded-pill" onclick="deleteComplaint(${c.id})">Delete</button>
                        </div>
                    </td>
                </tr>`;
        });
    } catch (e) {
        console.error('Complaints error', e);
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 text-danger">Failed to load complaints.</td></tr>';
    }
}

async function updateComplaintStatus(id, status) {
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/complaints/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            loadComplaints();
            loadActivityLog();
        } else {
            const err = await res.json();
            showAlert(err.detail || 'Could not update complaint');
        }
    } catch (e) {
        showAlert('Network error updating complaint');
    }
}

async function deleteComplaint(id) {
    showConfirm('Delete Complaint', 'Are you sure you want to delete this complaint?', async () => {
        try {
            const res = await fetch(`${ADMIN_BASE}/admin/api/complaints/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadComplaints();
                loadActivityLog();
            } else {
                showAlert('Could not delete complaint');
            }
        } catch (e) {
            showAlert('Network error deleting complaint');
        }
    });
}
