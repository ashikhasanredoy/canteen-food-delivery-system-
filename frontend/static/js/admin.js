const ADMIN_BASE = '';
let refreshTimer = null;

// ─── Format helpers ──────────────────────────────────────────
function fmt$(amount) {
    return '৳' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
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

function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Universal Pagination Array Helper ───────────────────────
function getPaginationArray(current, total) {
    if (total <= 7) {
        const pages = [];
        for (let i = 1; i <= total; i++) pages.push(i);
        return pages;
    }
    if (current <= 4) {
        return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
        return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
}

function renderPaginationBar(containerId, state, pageChangeFuncName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalItems = state.filtered.length;
    const effectivePageSize = state.pageSize > 0 ? state.pageSize : 25;
    const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));

    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;

    const startIdx = totalItems === 0 ? 0 : (state.currentPage - 1) * effectivePageSize + 1;
    const endIdx = Math.min(state.currentPage * effectivePageSize, totalItems);

    let html = `
        <div class="admin-pagination-bar">
            <span class="small text-muted fw-medium">
                ${totalItems === 0 ? 'Showing 0 items' : `Showing <b class="text-dark">${startIdx}–${endIdx}</b> of <b class="text-dark">${totalItems}</b> (Page ${state.currentPage} of ${totalPages})`}
            </span>
            <nav aria-label="Table pagination">
                <ul class="pagination pagination-sm mb-0 gap-1">`;

    if (totalPages > 1) {
        if (totalPages > 5) {
            html += `
                <li class="page-item ${state.currentPage === 1 ? 'disabled' : ''}">
                    <button type="button" class="page-link" onclick="${pageChangeFuncName}(1)" title="First Page" aria-label="First">«</button>
                </li>`;
        }

        html += `
            <li class="page-item ${state.currentPage === 1 ? 'disabled' : ''}">
                <button type="button" class="page-link" onclick="${pageChangeFuncName}(${state.currentPage - 1})" title="Previous Page" aria-label="Previous">‹</button>
            </li>`;

        const pageList = getPaginationArray(state.currentPage, totalPages);
        pageList.forEach(item => {
            if (item === '...') {
                html += `<li class="page-item disabled"><span class="page-link border-0 bg-transparent text-muted">…</span></li>`;
            } else {
                html += `
                    <li class="page-item ${item === state.currentPage ? 'active' : ''}">
                        <button type="button" class="page-link" onclick="${pageChangeFuncName}(${item})">${item}</button>
                    </li>`;
            }
        });

        html += `
            <li class="page-item ${state.currentPage === totalPages ? 'disabled' : ''}">
                <button type="button" class="page-link" onclick="${pageChangeFuncName}(${state.currentPage + 1})" title="Next Page" aria-label="Next">›</button>
            </li>`;

        if (totalPages > 5) {
            html += `
                <li class="page-item ${state.currentPage === totalPages ? 'disabled' : ''}">
                    <button type="button" class="page-link" onclick="${pageChangeFuncName}(${totalPages})" title="Last Page" aria-label="Last">»</button>
                </li>`;
        }
    }

    html += `
                </ul>
            </nav>
        </div>`;

    container.innerHTML = html;
}

// ─── States ──────────────────────────────────────────────────
const shopsState = { data: [], filtered: [], currentPage: 1, pageSize: 10, search: '' };
const notifsState = { data: [], filtered: [], currentPage: 1, pageSize: 10, search: '' };
const deliveryBoysState = { data: [], filtered: [], currentPage: 1, pageSize: 10, search: '' };
const foodsState = { data: [], filtered: [], currentPage: 1, pageSize: 15, search: '', shop: '' };
const ordersState = { data: [], filtered: [], currentPage: 1, pageSize: 25, search: '', status: '' };
const ratingsState = { data: [], filtered: [], currentPage: 1, pageSize: 15, search: '', stars: '' };
const complaintsState = { data: [], filtered: [], currentPage: 1, pageSize: 10, search: '', status: '' };
const activityState = { data: [], filtered: [], currentPage: 1, pageSize: 20, search: '', cat: '' };

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
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    document.querySelectorAll('[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSection = link.dataset.section;
            showSection(targetSection);
            sidebar.classList.remove('open');
        });
    });

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
    await Promise.all([loadStats(), loadCharts(), loadShops(), loadDeliveryBoys()]);
    const updatedEl = document.getElementById('last-updated');
    if (updatedEl) {
        updatedEl.textContent = 'Updated ' + new Date().toLocaleTimeString();
    }
}

// ─── Stats ───────────────────────────────────────────────────
async function loadStats() {
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/stats`);
        const d = await res.json();
        
        const setEl = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        if (d.total_shops != null) {
            setEl('stat-shops', d.total_shops);
        } else {
            fetch(`${ADMIN_BASE}/admin/api/shops`)
                .then(r => r.json())
                .then(shops => setEl('stat-shops', shops.length))
                .catch(() => setEl('stat-shops', 8));
        }

        setEl('stat-foods', d.total_foods);
        setEl('stat-orders', d.total_orders);
        setEl('stat-pending', d.pending_orders);
        setEl('stat-delivered', d.delivered_orders);
        setEl('stat-delivery-boys', d.total_delivery_boys || 0);
        setEl('stat-revenue', fmt$(d.total_revenue));
        setEl('stat-admin-revenue', fmt$(d.total_admin_revenue));
        setEl('stat-delivery-earnings', fmt$(d.total_delivery_earnings));
        setEl('stat-ratings', d.total_ratings);
        setEl('stat-avg-rating', d.avg_platform_rating ? d.avg_platform_rating + ' ★' : 'N/A');
        setEl('stat-top-food', d.top_food || 'N/A');
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
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3 text-muted">No orders found</td></tr>';
            return;
        }
        orders.slice(0, 6).forEach(o => {
            tbody.innerHTML += `
                <tr>
                    <td>
                        <span class="fw-bold">#${o.id}</span>
                        ${o.otp_code ? `<br><span class="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle px-1.5 py-0.5 rounded font-monospace fw-bold" style="font-size:0.72rem;"><i class="bi bi-key-fill me-0.5"></i>OTP: ${o.otp_code}</span>` : ''}
                    </td>
                    <td>
                        <div class="fw-medium">${escHtml(o.student_name)}</div>
                        ${o.email ? `<small class="text-muted d-block" style="font-size:0.7rem;"><i class="bi bi-envelope me-0.5"></i>${escHtml(o.email)}</small>` : ''}
                    </td>
                    <td>${escHtml(o.food_name)}</td>
                    <td>${statusBadge(o.status)}</td>
                    <td>${fmt$(o.total_price)}</td>
                </tr>`;
        });
    } catch (e) {
        console.error('Recent orders error', e);
    }
}

// ─── Recent Ratings (dashboard widget) ───────────────────────
async function loadRecentRatings() {
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/ratings`);
        const ratings = await res.json();
        const tbody = document.getElementById('recent-ratings-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (ratings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-muted">No ratings found</td></tr>';
            return;
        }
        ratings.slice(0, 6).forEach(r => {
            tbody.innerHTML += `
                <tr>
                    <td class="fw-medium">${escHtml(r.food_name)}</td>
                    <td><code>${escHtml(r.student_id)}</code></td>
                    <td>${renderStars(r.stars)}</td>
                    <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(r.comment || '—')}</td>
                </tr>`;
        });
    } catch (e) {
        console.error('Recent ratings error', e);
    }
}

// ─── 1. Foods Management & Pagination ─────────────────────────
async function loadFoods() {
    const tbody = document.getElementById('foods-tbody');
    if (!tbody) return;
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/foods`);
        foodsState.data = await res.json();
        populateFoodsShopDropdown();
        filterAndRenderFoods();
    } catch (e) {
        console.error('Foods error', e);
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-danger">Failed to load foods.</td></tr>';
    }
}

function populateFoodsShopDropdown() {
    const select = document.getElementById('foods-shop-filter');
    if (!select) return;
    const curr = select.value;
    const shops = [...new Set(foodsState.data.map(f => f.shop_name).filter(Boolean))].sort();
    select.innerHTML = '<option value="">All Shops</option>' +
        shops.map(s => `<option value="${escHtml(s)}"${s === curr ? ' selected' : ''}>${escHtml(s)}</option>`).join('');
}

function filterAndRenderFoods() {
    const tbody = document.getElementById('foods-tbody');
    if (!tbody) return;

    const query = foodsState.search.toLowerCase().trim();
    foodsState.filtered = foodsState.data.filter(f => {
        if (foodsState.shop && f.shop_name !== foodsState.shop) return false;
        if (query) {
            const nameMatch = (f.food_name || '').toLowerCase().includes(query);
            const shopMatch = (f.shop_name || '').toLowerCase().includes(query);
            const idMatch = String(f.id).includes(query);
            if (!nameMatch && !shopMatch && !idMatch) return false;
        }
        return true;
    });

    const totalItems = foodsState.filtered.length;
    if (totalItems === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">No foods match your search or filter.</td></tr>';
        renderPaginationBar('foods-pagination', foodsState, 'goToFoodsPage');
        return;
    }

    const pageSize = foodsState.pageSize > 0 ? foodsState.pageSize : 15;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (foodsState.currentPage > totalPages) foodsState.currentPage = totalPages;
    if (foodsState.currentPage < 1) foodsState.currentPage = 1;

    const startIdx = (foodsState.currentPage - 1) * pageSize;
    const pageItems = foodsState.filtered.slice(startIdx, startIdx + pageSize);

    let rowsHtml = '';
    pageItems.forEach((f, idx) => {
        const rowNum = startIdx + idx + 1;
        const stockBadge = f.quantity > 0
            ? `<span class="badge-delivered">${f.quantity}</span>`
            : `<span class="badge-pending">Out</span>`;
        rowsHtml += `
            <tr>
                <td class="text-muted small">${rowNum}</td>
                <td><img src="${f.image_url}" class="food-thumb" onerror="this.src='/static/images/foods/default.jpg'"></td>
                <td class="fw-bold text-dark">${escHtml(f.food_name)}</td>
                <td><span class="badge bg-light text-dark border px-2 py-1">${escHtml(f.shop_name)}</span></td>
                <td class="fw-bold">${fmt$(f.price)}</td>
                <td>${stockBadge}</td>
                <td><span class="text-warning fw-bold">${f.avg_rating ? f.avg_rating + ' ★' : '—'}</span></td>
                <td>${f.rating_count || 0}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="adminDeleteFood(${f.id}, this)">
                        <i class="bi bi-trash me-1"></i>Delete
                    </button>
                </td>
            </tr>`;
    });

    tbody.innerHTML = rowsHtml;
    renderPaginationBar('foods-pagination', foodsState, 'goToFoodsPage');
}

function onFoodsSearch() {
    foodsState.search = document.getElementById('foods-search')?.value || '';
    foodsState.currentPage = 1;
    filterAndRenderFoods();
}

function onFoodsShopFilter(val) {
    foodsState.shop = val;
    foodsState.currentPage = 1;
    filterAndRenderFoods();
}

function changeFoodsPageSize(val) {
    foodsState.pageSize = parseInt(val, 10) || 15;
    foodsState.currentPage = 1;
    filterAndRenderFoods();
}

function goToFoodsPage(page) {
    foodsState.currentPage = page;
    filterAndRenderFoods();
}

async function adminDeleteFood(id, btn) {
    showConfirm(
        '🗑️ Delete Food Item',
        'This food will be permanently removed. Orders linked to it will preserve historical data. This cannot be undone.',
        async () => {
            btn.disabled = true;
            try {
                const res = await fetch(`${ADMIN_BASE}/admin/api/foods/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    await loadFoods();
                    await loadStats();
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

// ─── 2. Orders Management & Pagination ────────────────────────
async function loadOrders(filter) {
    if (filter !== undefined) ordersState.status = filter;
    const tbody = document.getElementById('orders-tbody');
    if (!tbody) return;

    try {
        let url = `${ADMIN_BASE}/admin/api/orders`;
        if (ordersState.status) url += `?status=${ordersState.status}`;
        const res = await fetch(url);
        ordersState.data = await res.json();
        filterAndRenderOrders();
    } catch (e) {
        console.error('Orders error', e);
        tbody.innerHTML = '<tr><td colspan="13" class="text-center py-4 text-danger">Failed to load orders.</td></tr>';
    }
}

function filterAndRenderOrders() {
    const tbody = document.getElementById('orders-tbody');
    if (!tbody) return;

    const query = ordersState.search.toLowerCase().trim();
    ordersState.filtered = ordersState.data.filter(o => {
        if (query) {
            const studentMatch = (o.student_name || '').toLowerCase().includes(query);
            const studentIdMatch = (o.student_id || '').toLowerCase().includes(query);
            const foodMatch = (o.food_name || '').toLowerCase().includes(query);
            const shopMatch = (o.shop_name || '').toLowerCase().includes(query);
            const locMatch = (o.delivery_location || '').toLowerCase().includes(query);
            const boyMatch = (o.delivery_boy_id || '').toLowerCase().includes(query);
            const idMatch = String(o.id).includes(query);
            if (!studentMatch && !studentIdMatch && !foodMatch && !shopMatch && !locMatch && !boyMatch && !idMatch) return false;
        }
        return true;
    });

    const totalItems = ordersState.filtered.length;
    if (totalItems === 0) {
        tbody.innerHTML = '<tr><td colspan="13" class="text-center py-4 text-muted">No orders match your search or filter.</td></tr>';
        renderPaginationBar('orders-pagination', ordersState, 'goToOrdersPage');
        return;
    }

    const pageSize = ordersState.pageSize > 0 ? ordersState.pageSize : 25;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (ordersState.currentPage > totalPages) ordersState.currentPage = totalPages;
    if (ordersState.currentPage < 1) ordersState.currentPage = 1;

    const startIdx = (ordersState.currentPage - 1) * pageSize;
    const pageItems = ordersState.filtered.slice(startIdx, startIdx + pageSize);

    let rowsHtml = '';
    pageItems.forEach((o, idx) => {
        const rowNum = startIdx + idx + 1;
        const adminFee = o.admin_fee != null ? fmt$(o.admin_fee) : '—';
        const deliveryFee = o.delivery_fee != null ? fmt$(o.delivery_fee) : '—';
        const deliveryBoy = o.delivery_boy_id ? `<code>${escHtml(o.delivery_boy_id)}</code>` : '<span class="text-muted small">—</span>';
        const otpBadge = o.otp_code ? `<br><span class="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle px-1.5 py-0.5 rounded font-monospace fw-bold mt-1 d-inline-block" style="font-size:0.72rem;"><i class="bi bi-key-fill me-0.5"></i>OTP: ${escHtml(o.otp_code)}</span>` : '';
        const emailLine = o.email ? `<small class="text-muted d-block text-truncate" style="font-size:0.72rem; max-width: 140px;" title="${escHtml(o.email)}"><i class="bi bi-envelope me-0.5"></i>${escHtml(o.email)}</small>` : '';
        rowsHtml += `
            <tr>
                <td>
                    <span class="fw-bold fs-6">#${o.id || rowNum}</span>
                    ${otpBadge}
                </td>
                <td>
                    <div class="fw-bold text-dark">${escHtml(o.student_name)}</div>
                    ${emailLine}
                </td>
                <td><code>${escHtml(o.student_id)}</code></td>
                <td class="fw-medium">${escHtml(o.food_name)}</td>
                <td><span class="badge bg-light text-dark border px-2 py-1">${escHtml(o.shop_name)}</span></td>
                <td class="fw-bold">${o.quantity}</td>
                <td class="fw-bold text-dark">${fmt$(o.total_price)}</td>
                <td><span class="fee-badge fee-admin">${adminFee}</span></td>
                <td><span class="fee-badge fee-delivery">${deliveryFee}</span></td>
                <td>${deliveryBoy}</td>
                <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(o.delivery_location)}">${escHtml(o.delivery_location)}</td>
                <td>${statusBadge(o.status)}</td>
                <td class="small text-muted" style="white-space:nowrap">${fmtDate(o.created_at)}</td>
            </tr>`;
    });

    tbody.innerHTML = rowsHtml;
    renderPaginationBar('orders-pagination', ordersState, 'goToOrdersPage');
}

function onOrdersSearch() {
    ordersState.search = document.getElementById('orders-search')?.value || '';
    ordersState.currentPage = 1;
    filterAndRenderOrders();
}

function setOrderFilter(btn, filter) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ordersState.currentPage = 1;
    loadOrders(filter);
}

function changeOrdersPageSize(val) {
    ordersState.pageSize = parseInt(val, 10) || 25;
    ordersState.currentPage = 1;
    filterAndRenderOrders();
}

function goToOrdersPage(page) {
    ordersState.currentPage = page;
    filterAndRenderOrders();
}

// ─── 3. Ratings Management & Pagination ───────────────────────
async function loadRatings() {
    const tbody = document.getElementById('ratings-tbody');
    if (!tbody) return;
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/ratings`);
        ratingsState.data = await res.json();
        filterAndRenderRatings();
    } catch (e) {
        console.error('Ratings error', e);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Failed to load ratings.</td></tr>';
    }
}

function filterAndRenderRatings() {
    const tbody = document.getElementById('ratings-tbody');
    if (!tbody) return;

    const query = ratingsState.search.toLowerCase().trim();
    ratingsState.filtered = ratingsState.data.filter(r => {
        if (ratingsState.stars && String(r.stars) !== String(ratingsState.stars)) return false;
        if (query) {
            const foodMatch = (r.food_name || '').toLowerCase().includes(query);
            const shopMatch = (r.shop_name || '').toLowerCase().includes(query);
            const studentMatch = (r.student_id || '').toLowerCase().includes(query);
            const commentMatch = (r.comment || '').toLowerCase().includes(query);
            if (!foodMatch && !shopMatch && !studentMatch && !commentMatch) return false;
        }
        return true;
    });

    const totalItems = ratingsState.filtered.length;
    if (totalItems === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No ratings match your search or star filter.</td></tr>';
        renderPaginationBar('ratings-pagination', ratingsState, 'goToRatingsPage');
        return;
    }

    const pageSize = ratingsState.pageSize > 0 ? ratingsState.pageSize : 15;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (ratingsState.currentPage > totalPages) ratingsState.currentPage = totalPages;
    if (ratingsState.currentPage < 1) ratingsState.currentPage = 1;

    const startIdx = (ratingsState.currentPage - 1) * pageSize;
    const pageItems = ratingsState.filtered.slice(startIdx, startIdx + pageSize);

    let rowsHtml = '';
    pageItems.forEach((r, idx) => {
        const rowNum = startIdx + idx + 1;
        rowsHtml += `
            <tr>
                <td class="text-muted small">${rowNum}</td>
                <td class="fw-bold text-dark">${escHtml(r.food_name)}</td>
                <td><span class="badge bg-light text-dark border px-2 py-1">${escHtml(r.shop_name)}</span></td>
                <td><code>${escHtml(r.student_id)}</code></td>
                <td>${renderStars(r.stars)}</td>
                <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.comment || '')}">${escHtml(r.comment || '—')}</td>
                <td class="small text-muted" style="white-space:nowrap">${fmtDate(r.created_at)}</td>
            </tr>`;
    });

    tbody.innerHTML = rowsHtml;
    renderPaginationBar('ratings-pagination', ratingsState, 'goToRatingsPage');
}

function onRatingsSearch() {
    ratingsState.search = document.getElementById('ratings-search')?.value || '';
    ratingsState.currentPage = 1;
    filterAndRenderRatings();
}

function onRatingsStarFilter(val) {
    ratingsState.stars = val;
    ratingsState.currentPage = 1;
    filterAndRenderRatings();
}

function changeRatingsPageSize(val) {
    ratingsState.pageSize = parseInt(val, 10) || 15;
    ratingsState.currentPage = 1;
    filterAndRenderRatings();
}

function goToRatingsPage(page) {
    ratingsState.currentPage = page;
    filterAndRenderRatings();
}

// ─── 4. Delivery Boys Management & Pagination ─────────────────
async function loadDeliveryBoys() {
    const tbody = document.getElementById('delivery-boys-tbody');
    if (!tbody) return;
    try {
        const res = await fetch('/admin/api/delivery-boys');
        const d = await res.json();
        deliveryBoysState.data = (d && d.deliveryBoys) ? d.deliveryBoys : (Array.isArray(d) ? d : []);
        filterAndRenderDeliveryBoys();
    } catch (e) {
        console.error('Delivery boys error', e);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Failed to load delivery boys.</td></tr>';
    }
}

function filterAndRenderDeliveryBoys() {
    const tbody = document.getElementById('delivery-boys-tbody');
    if (!tbody) return;

    const query = deliveryBoysState.search.toLowerCase().trim();
    deliveryBoysState.filtered = deliveryBoysState.data.filter(b => {
        if (query) {
            const nameMatch = (b.delivery_boy_name || b.name || '').toLowerCase().includes(query);
            const idMatch = (b.delivery_boy_id || '').toLowerCase().includes(query);
            if (!nameMatch && !idMatch) return false;
        }
        return true;
    });

    const totalItems = deliveryBoysState.filtered.length;
    if (totalItems === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No delivery boys match your search.</td></tr>';
        renderPaginationBar('delivery-boys-pagination', deliveryBoysState, 'goToDeliveryBoyPage');
        return;
    }

    const pageSize = deliveryBoysState.pageSize > 0 ? deliveryBoysState.pageSize : 10;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (deliveryBoysState.currentPage > totalPages) deliveryBoysState.currentPage = totalPages;
    if (deliveryBoysState.currentPage < 1) deliveryBoysState.currentPage = 1;

    const startIdx = (deliveryBoysState.currentPage - 1) * pageSize;
    const pageItems = deliveryBoysState.filtered.slice(startIdx, startIdx + pageSize);

    let rowsHtml = '';
    pageItems.forEach((boy, i) => {
        const rowNum = startIdx + i + 1;
        const isOnline = boy.status === 'Online';
        const statusBadgeEl = isOnline
            ? `<span class="badge bg-success rounded-pill px-3 py-1">🟢 Online</span>`
            : `<span class="badge bg-secondary rounded-pill px-3 py-1">⚫ Offline</span>`;
        const nameStr = boy.delivery_boy_name || boy.name || 'Delivery Boy';
        const boyIdStr = boy.delivery_boy_id || '—';
        const doneCount = boy.deliveries_done || 0;

        const safeNameEsc = nameStr.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeIdEsc = boyIdStr.replace(/'/g, "\\'").replace(/"/g, '&quot;');

        rowsHtml += `
            <tr>
                <td class="text-muted small">${rowNum}</td>
                <td class="fw-bold text-dark">${escHtml(nameStr)}</td>
                <td><code class="px-2 py-1 bg-light rounded text-primary fw-semibold">${escHtml(boyIdStr)}</code></td>
                <td>${statusBadgeEl}</td>
                <td class="fw-bold">${doneCount}</td>
                <td class="text-muted small" style="white-space:nowrap">${fmtDate(boy.created_at)}</td>
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
    renderPaginationBar('delivery-boys-pagination', deliveryBoysState, 'goToDeliveryBoyPage');
}

function onDeliveryBoySearch() {
    deliveryBoysState.search = document.getElementById('delivery-boy-search')?.value || '';
    deliveryBoysState.currentPage = 1;
    filterAndRenderDeliveryBoys();
}

function changeDeliveryBoyPageSize(val) {
    deliveryBoysState.pageSize = parseInt(val, 10) || 10;
    deliveryBoysState.currentPage = 1;
    filterAndRenderDeliveryBoys();
}

function goToDeliveryBoyPage(page) {
    deliveryBoysState.currentPage = page;
    filterAndRenderDeliveryBoys();
}

function openEditDeliveryBoyModal(id, name, dbId) {
    document.getElementById('edit_db_id_pk').value = id;
    document.getElementById('edit_db_name').value = name;
    document.getElementById('edit_db_id_code').value = dbId;
    const modal = new bootstrap.Modal(document.getElementById('editDeliveryBoyModal'));
    modal.show();
}

async function saveEditDeliveryBoy(event) {
    event.preventDefault();
    const id = document.getElementById('edit_db_id_pk').value;
    const name = document.getElementById('edit_db_name').value.trim();
    const code = document.getElementById('edit_db_id_code').value.trim();
    const saveBtn = document.getElementById('edit-db-save-btn');

    if (!/^\d{9,11}$/.test(code)) {
        showAlert('Delivery Boy ID must be 9 to 11 digits');
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const res = await fetch(`/admin/api/delivery-boys/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, delivery_boy_id: code })
        });
        const d = await res.json();
        if (res.ok && d.success) {
            bootstrap.Modal.getInstance(document.getElementById('editDeliveryBoyModal')).hide();
            await loadDeliveryBoys();
            await loadStats();
        } else {
            showAlert(d.detail || d.error || 'Failed to update delivery boy');
        }
    } catch (e) {
        showAlert('Network error updating delivery boy');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
    }
}

async function adminDeleteDeliveryBoy(id, btn) {
    showConfirm('Delete Delivery Boy', 'Are you sure you want to remove this delivery boy?', async () => {
        btn.disabled = true;
        try {
            const res = await fetch(`/admin/api/delivery-boys/${id}`, { method: 'DELETE' });
            if (res.ok) {
                await loadDeliveryBoys();
                await loadStats();
            } else {
                showAlert('Failed to delete delivery boy');
                btn.disabled = false;
            }
        } catch (e) {
            showAlert('Network error deleting delivery boy');
            btn.disabled = false;
        }
    });
}

// ─── 5. Shops Management & Pagination ─────────────────────────
async function loadShops() {
    const tbody = document.getElementById('shops-tbody');
    if (!tbody) return;
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/shops`);
        shopsState.data = await res.json();
        const statShopsEl = document.getElementById('stat-shops');
        if (statShopsEl && (statShopsEl.textContent === '—' || statShopsEl.textContent === '0' || !statShopsEl.textContent)) {
            statShopsEl.textContent = shopsState.data.length;
        }
        filterAndRenderShops();
    } catch (e) {
        console.error('Shops error', e);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Failed to load shops.</td></tr>';
    }
}

function filterAndRenderShops() {
    const tbody = document.getElementById('shops-tbody');
    if (!tbody) return;

    const query = shopsState.search.toLowerCase().trim();
    shopsState.filtered = shopsState.data.filter(s => {
        if (query) {
            const nameMatch = (s.shop_name || '').toLowerCase().includes(query);
            const idMatch = (s.shop_id || '').toLowerCase().includes(query);
            if (!nameMatch && !idMatch) return false;
        }
        return true;
    });

    const totalItems = shopsState.filtered.length;
    if (totalItems === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No shops match your search.</td></tr>';
        renderPaginationBar('shops-pagination', shopsState, 'goToShopsPage');
        return;
    }

    const pageSize = shopsState.pageSize > 0 ? shopsState.pageSize : 10;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (shopsState.currentPage > totalPages) shopsState.currentPage = totalPages;
    if (shopsState.currentPage < 1) shopsState.currentPage = 1;

    const startIdx = (shopsState.currentPage - 1) * pageSize;
    const pageItems = shopsState.filtered.slice(startIdx, startIdx + pageSize);

    let rowsHtml = '';
    pageItems.forEach((s, idx) => {
        const rowNum = startIdx + idx + 1;
        const unreadBadge = s.unread_notifications > 0
            ? `<span class="badge bg-danger rounded-pill px-2.5 py-1">${s.unread_notifications} unread</span>`
            : '<span class="text-muted small">0</span>';
        const safeNameEsc = (s.shop_name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeIdEsc = (s.shop_id || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

        rowsHtml += `
            <tr>
                <td class="text-muted small">${rowNum}</td>
                <td class="fw-bold text-dark">${escHtml(s.shop_name)}</td>
                <td><code class="px-2 py-1 bg-light rounded text-primary fw-semibold">${escHtml(s.shop_id)}</code></td>
                <td><span class="badge bg-primary rounded-pill px-3 py-1">${s.food_count} items</span></td>
                <td>${unreadBadge}</td>
                <td class="text-muted small" style="white-space:nowrap">${fmtDate(s.created_at)}</td>
                <td>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-primary rounded-pill px-3"
                                onclick="openSendNotifModal('${safeIdEsc}', '${safeNameEsc}')">
                            <i class="bi bi-bell me-1"></i>Notify
                        </button>
                        <button class="btn btn-sm btn-outline-danger rounded-pill px-3"
                                onclick="adminDeleteShop(${s.id}, '${safeNameEsc}', this)">
                            <i class="bi bi-trash me-1"></i>Delete
                        </button>
                    </div>
                </td>
            </tr>`;
    });

    tbody.innerHTML = rowsHtml;
    renderPaginationBar('shops-pagination', shopsState, 'goToShopsPage');
}

function onShopsSearch() {
    shopsState.search = document.getElementById('shops-search')?.value || '';
    shopsState.currentPage = 1;
    filterAndRenderShops();
}

function changeShopsPageSize(val) {
    shopsState.pageSize = parseInt(val, 10) || 10;
    shopsState.currentPage = 1;
    filterAndRenderShops();
}

function goToShopsPage(page) {
    shopsState.currentPage = page;
    filterAndRenderShops();
}

function openSendNotifModal(shopId, shopName) {
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
        showAlert('Please enter a message.');
        return;
    }

    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop_id: shopId, shop_name: shopName, message })
        });
        if (res.ok) {
            bootstrap.Modal.getInstance(document.getElementById('sendNotifModal')).hide();
            showAlert('Notification sent successfully!');
            await loadShops();
            await loadNotifications();
            await loadActivityLog();
        } else {
            showAlert('Failed to send notification.');
        }
    } catch (e) {
        showAlert('Network error. Please try again.');
    }
}

async function adminDeleteShop(id, name, btn) {
    showConfirm(
        '🗑️ Delete Shop',
        `Are you sure you want to remove shop "${name}"? Its foods will also be deleted.`,
        async () => {
            btn.disabled = true;
            try {
                const res = await fetch(`${ADMIN_BASE}/admin/api/shops/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    await loadShops();
                    await loadFoods();
                    await loadStats();
                } else {
                    showAlert('Failed to delete shop.');
                    btn.disabled = false;
                }
            } catch (e) {
                showAlert('Network error. Please try again.');
                btn.disabled = false;
            }
        }
    );
}

// ─── 6. Notifications History & Pagination ────────────────────
async function loadNotifications() {
    const tbody = document.getElementById('notifications-tbody');
    if (!tbody) return;
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/notifications`);
        notifsState.data = await res.json();
        filterAndRenderNotifs();
    } catch (e) {
        console.error('Notifications error', e);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">Failed to load notifications.</td></tr>';
    }
}

function filterAndRenderNotifs() {
    const tbody = document.getElementById('notifications-tbody');
    if (!tbody) return;

    const query = notifsState.search.toLowerCase().trim();
    notifsState.filtered = notifsState.data.filter(n => {
        if (query) {
            const nameMatch = (n.shop_name || '').toLowerCase().includes(query);
            const idMatch = (n.shop_id || '').toLowerCase().includes(query);
            const msgMatch = (n.message || '').toLowerCase().includes(query);
            if (!nameMatch && !idMatch && !msgMatch) return false;
        }
        return true;
    });

    const totalItems = notifsState.filtered.length;
    if (totalItems === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No notifications sent yet.</td></tr>';
        renderPaginationBar('notifs-pagination', notifsState, 'goToNotifsPage');
        return;
    }

    const pageSize = notifsState.pageSize > 0 ? notifsState.pageSize : 10;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (notifsState.currentPage > totalPages) notifsState.currentPage = totalPages;
    if (notifsState.currentPage < 1) notifsState.currentPage = 1;

    const startIdx = (notifsState.currentPage - 1) * pageSize;
    const pageItems = notifsState.filtered.slice(startIdx, startIdx + pageSize);

    let rowsHtml = '';
    pageItems.forEach((n, idx) => {
        const rowNum = startIdx + idx + 1;
        const readBadge = n.is_read
            ? `<span class="badge bg-success rounded-pill px-2.5 py-1">Read</span>`
            : `<span class="badge bg-warning text-dark rounded-pill px-2.5 py-1">Unread</span>`;

        rowsHtml += `
            <tr>
                <td class="text-muted small">${rowNum}</td>
                <td class="fw-bold text-dark">${escHtml(n.shop_name || '—')}</td>
                <td><code class="px-2 py-1 bg-light rounded text-primary fw-semibold">${escHtml(n.shop_id)}</code></td>
                <td style="max-width:320px; white-space:normal;">${escHtml(n.message)}</td>
                <td>${readBadge}</td>
                <td class="text-muted small" style="white-space:nowrap">${fmtDate(n.created_at)}</td>
            </tr>`;
    });

    tbody.innerHTML = rowsHtml;
    renderPaginationBar('notifs-pagination', notifsState, 'goToNotifsPage');
}

function onNotifsSearch() {
    notifsState.search = document.getElementById('notifs-search')?.value || '';
    notifsState.currentPage = 1;
    filterAndRenderNotifs();
}

function changeNotifsPageSize(val) {
    notifsState.pageSize = parseInt(val, 10) || 10;
    notifsState.currentPage = 1;
    filterAndRenderNotifs();
}

function goToNotifsPage(page) {
    notifsState.currentPage = page;
    filterAndRenderNotifs();
}

// ─── 7. Activity Log & Pagination ─────────────────────────────
const ACT_META = {
    order: { color: '#5C5CFF', bg: '#eeeeff', icon: 'O', label: 'Order' },
    delivery: { color: '#059669', bg: '#d1fae5', icon: 'D', label: 'Delivery' },
    food: { color: '#d97706', bg: '#fef3c7', icon: 'F', label: 'Food' },
    shop: { color: '#7c3aed', bg: '#ede9fe', icon: 'S', label: 'Shop' },
    notification: { color: '#0ea5e9', bg: '#e0f2fe', icon: 'N', label: 'Notif' },
    settings: { color: '#64748b', bg: '#f1f5f9', icon: 'G', label: 'Settings' },
    admin: { color: '#3b82f6', bg: '#dbeafe', icon: 'A', label: 'Admin' },
    complaint: { color: '#dc2626', bg: '#fee2e2', icon: 'C', label: 'Complaint' },
};

async function loadActivityLog() {
    const timeline = document.getElementById('activity-timeline');
    if (!timeline) return;
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/activity-log?limit=1000`);
        activityState.data = await res.json();
        filterAndRenderActivity();
    } catch (e) {
        timeline.innerHTML = '<div class="act-empty-state text-danger">Failed to load activity log.</div>';
        console.error('Activity log error', e);
    }
}

function setActivityCat(btn, cat) {
    document.querySelectorAll('.act-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activityState.cat = cat;
    activityState.currentPage = 1;
    filterAndRenderActivity();
}

function filterActivityLog() {
    activityState.search = document.getElementById('activity-search')?.value || '';
    activityState.currentPage = 1;
    filterAndRenderActivity();
}

function changeActivityPageSize(val) {
    activityState.pageSize = parseInt(val, 10) || 20;
    activityState.currentPage = 1;
    filterAndRenderActivity();
}

function goToActivityPage(page) {
    activityState.currentPage = page;
    filterAndRenderActivity();
}

function filterAndRenderActivity() {
    const timeline = document.getElementById('activity-timeline');
    if (!timeline) return;

    const query = activityState.search.toLowerCase().trim();
    activityState.filtered = activityState.data.filter(l => {
        if (activityState.cat && l.category !== activityState.cat) return false;
        if (query) {
            const summaryMatch = (l.summary || '').toLowerCase().includes(query);
            const detailMatch = (l.detail || '').toLowerCase().includes(query);
            const actionMatch = (l.action || '').toLowerCase().includes(query);
            if (!summaryMatch && !detailMatch && !actionMatch) return false;
        }
        return true;
    });

    const totalItems = activityState.filtered.length;
    if (totalItems === 0) {
        timeline.innerHTML = '<div class="act-empty-state">No activity records found.</div>';
        renderPaginationBar('activity-pagination', activityState, 'goToActivityPage');
        return;
    }

    const pageSize = activityState.pageSize > 0 ? activityState.pageSize : 20;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (activityState.currentPage > totalPages) activityState.currentPage = totalPages;
    if (activityState.currentPage < 1) activityState.currentPage = 1;

    const startIdx = (activityState.currentPage - 1) * pageSize;
    const pageItems = activityState.filtered.slice(startIdx, startIdx + pageSize);

    timeline.innerHTML = pageItems.map(log => {
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

    renderPaginationBar('activity-pagination', activityState, 'goToActivityPage');
}

function timeAgo(iso) {
    if (!iso) return '—';
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60) return `${Math.max(1, diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

// ─── 8. Complaints & Pagination ───────────────────────────────
function complaintRoleBadge(role) {
    const map = {
        buyer: '<span class="badge bg-danger rounded-pill">Buyer</span>',
        seller: '<span class="badge bg-warning text-dark rounded-pill">Seller</span>',
        delivery: '<span class="badge bg-primary rounded-pill">Delivery</span>',
    };
    return map[role] || `<span class="badge bg-secondary rounded-pill">${role || 'Unknown'}</span>`;
}

function complaintStatusBadge(status) {
    if (status === 'Reviewed') return `<span class="badge bg-info text-dark rounded-pill px-2.5">${status}</span>`;
    return status === 'Resolved'
        ? `<span class="badge-delivered">${status}</span>`
        : `<span class="badge-pending">${status}</span>`;
}

async function loadComplaints() {
    const tbody = document.getElementById('complaints-tbody');
    if (!tbody) return;
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/complaints`);
        complaintsState.data = await res.json();
        filterAndRenderComplaints();
    } catch (e) {
        console.error('Complaints error', e);
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 text-danger">Failed to load complaints.</td></tr>';
    }
}

function filterAndRenderComplaints() {
    const tbody = document.getElementById('complaints-tbody');
    if (!tbody) return;

    const query = complaintsState.search.toLowerCase().trim();
    complaintsState.filtered = complaintsState.data.filter(c => {
        if (complaintsState.status && c.status !== complaintsState.status) return false;
        if (query) {
            const nameMatch = (c.name || '').toLowerCase().includes(query);
            const shopMatch = (c.shop_name || '').toLowerCase().includes(query);
            const contactMatch = (c.contact || '').toLowerCase().includes(query);
            const messageMatch = (c.message || '').toLowerCase().includes(query);
            const roleMatch = (c.role || '').toLowerCase().includes(query);
            if (!nameMatch && !shopMatch && !contactMatch && !messageMatch && !roleMatch) return false;
        }
        return true;
    });

    const totalItems = complaintsState.filtered.length;
    if (totalItems === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 text-muted">No complaints match your search or filter.</td></tr>';
        renderPaginationBar('complaints-pagination', complaintsState, 'goToComplaintsPage');
        return;
    }

    const pageSize = complaintsState.pageSize > 0 ? complaintsState.pageSize : 10;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (complaintsState.currentPage > totalPages) complaintsState.currentPage = totalPages;
    if (complaintsState.currentPage < 1) complaintsState.currentPage = 1;

    const startIdx = (complaintsState.currentPage - 1) * pageSize;
    const pageItems = complaintsState.filtered.slice(startIdx, startIdx + pageSize);

    let rowsHtml = '';
    pageItems.forEach((c, idx) => {
        const rowNum = startIdx + idx + 1;
        const photoCell = c.image_url
            ? `<a href="${c.image_url}" target="_blank" rel="noopener"><img src="${c.image_url}" alt="Complaint photo" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;"></a>`
            : '<span class="text-muted small">—</span>';
        const msg = escHtml(c.message || '');
        const shopCell = c.shop_name
            ? `<span class="fw-medium text-capitalize">${escHtml(c.shop_name)}</span>`
            : '<span class="text-muted small">—</span>';

        rowsHtml += `
            <tr>
                <td class="text-muted small">${rowNum}</td>
                <td>${complaintRoleBadge(c.role)}</td>
                <td class="fw-bold text-dark">${escHtml(c.name || '—')}</td>
                <td>${shopCell}</td>
                <td><code class="px-2 py-1 bg-light rounded text-secondary">${escHtml(c.contact || '—')}</code></td>
                <td style="max-width:240px; white-space:normal;">${msg}</td>
                <td>${photoCell}</td>
                <td>${complaintStatusBadge(c.status)}</td>
                <td class="small text-muted" style="white-space:nowrap">${fmtDate(c.created_at)}</td>
                <td>
                    <div class="d-flex flex-wrap gap-1">
                        <select class="form-select form-select-sm table-toolbar-select" style="width:105px;" onchange="updateComplaintStatus(${c.id}, this.value)">
                            <option value="Open" ${c.status === 'Open' ? 'selected' : ''}>Open</option>
                            <option value="Reviewed" ${c.status === 'Reviewed' ? 'selected' : ''}>Reviewed</option>
                            <option value="Resolved" ${c.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                        </select>
                        <button class="btn btn-sm btn-outline-danger rounded-pill px-2.5" onclick="deleteComplaint(${c.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    });

    tbody.innerHTML = rowsHtml;
    renderPaginationBar('complaints-pagination', complaintsState, 'goToComplaintsPage');
}

function onComplaintsSearch() {
    complaintsState.search = document.getElementById('complaints-search')?.value || '';
    complaintsState.currentPage = 1;
    filterAndRenderComplaints();
}

function onComplaintsStatusFilter(val) {
    complaintsState.status = val;
    complaintsState.currentPage = 1;
    filterAndRenderComplaints();
}

function changeComplaintsPageSize(val) {
    complaintsState.pageSize = parseInt(val, 10) || 10;
    complaintsState.currentPage = 1;
    filterAndRenderComplaints();
}

function goToComplaintsPage(page) {
    complaintsState.currentPage = page;
    filterAndRenderComplaints();
}

async function updateComplaintStatus(id, status) {
    try {
        const res = await fetch(`${ADMIN_BASE}/admin/api/complaints/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            await loadComplaints();
            await loadActivityLog();
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
                await loadComplaints();
                await loadActivityLog();
            } else {
                showAlert('Could not delete complaint');
            }
        } catch (e) {
            showAlert('Network error deleting complaint');
        }
    });
}

// ─── 9. Fee Settings ──────────────────────────────────────────
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
            msgEl.innerHTML = '<span class="text-success fw-bold">✓ Settings saved! New fees apply to all future orders.</span>';
            setTimeout(() => { msgEl.innerHTML = ''; }, 4000);
            loadStats();
        } else {
            const err = await res.json();
            msgEl.innerHTML = `<span class="text-danger">${err.detail || 'Failed to save settings.'}</span>`;
        }
    } catch (e) {
        msgEl.innerHTML = '<span class="text-danger">Network error saving settings.</span>';
    }
}

// ─── Custom Confirm & Alert Modals ────────────────────────────
function showConfirm(title, message, onConfirm) {
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalMsg').textContent = message;

    const okBtn = document.getElementById('confirmModalOk');
    const modal = new bootstrap.Modal(document.getElementById('customConfirmModal'), { backdrop: 'static' });

    const newOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);

    newOk.addEventListener('click', () => {
        modal.hide();
        if (typeof onConfirm === 'function') onConfirm();
    });

    modal.show();
}

function showAlert(message) {
    document.getElementById('alertModalMsg').textContent = message;
    const modal = new bootstrap.Modal(document.getElementById('customAlertModal'));
    modal.show();
}

// ─── Charts ──────────────────────────────────────────────────
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
        }

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
        }

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
        }
    } catch (e) {
        console.error('Charts error', e);
    }
}

// ─── Expose global functions for HTML onclick / oninput / onchange ───
window.showSection = showSection;
window.loadStats = loadStats;
window.loadCharts = loadCharts;
window.loadShops = loadShops;
window.loadNotifications = loadNotifications;
window.loadDeliveryBoys = loadDeliveryBoys;
window.loadFoods = loadFoods;
window.loadOrders = loadOrders;
window.loadRatings = loadRatings;
window.loadComplaints = loadComplaints;
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.loadActivityLog = loadActivityLog;

window.onShopsSearch = onShopsSearch;
window.changeShopsPageSize = changeShopsPageSize;
window.goToShopsPage = goToShopsPage;
window.openSendNotifModal = openSendNotifModal;
window.submitNotification = submitNotification;
window.adminDeleteShop = adminDeleteShop;

window.onNotifsSearch = onNotifsSearch;
window.changeNotifsPageSize = changeNotifsPageSize;
window.goToNotifsPage = goToNotifsPage;

window.onDeliveryBoySearch = onDeliveryBoySearch;
window.changeDeliveryBoyPageSize = changeDeliveryBoyPageSize;
window.goToDeliveryBoyPage = goToDeliveryBoyPage;
window.openEditDeliveryBoyModal = openEditDeliveryBoyModal;
window.saveEditDeliveryBoy = saveEditDeliveryBoy;
window.adminDeleteDeliveryBoy = adminDeleteDeliveryBoy;

window.onFoodsSearch = onFoodsSearch;
window.onFoodsShopFilter = onFoodsShopFilter;
window.changeFoodsPageSize = changeFoodsPageSize;
window.goToFoodsPage = goToFoodsPage;
window.adminDeleteFood = adminDeleteFood;

window.onOrdersSearch = onOrdersSearch;
window.setOrderFilter = setOrderFilter;
window.changeOrdersPageSize = changeOrdersPageSize;
window.goToOrdersPage = goToOrdersPage;

window.onRatingsSearch = onRatingsSearch;
window.onRatingsStarFilter = onRatingsStarFilter;
window.changeRatingsPageSize = changeRatingsPageSize;
window.goToRatingsPage = goToRatingsPage;

window.onComplaintsSearch = onComplaintsSearch;
window.onComplaintsStatusFilter = onComplaintsStatusFilter;
window.changeComplaintsPageSize = changeComplaintsPageSize;
window.goToComplaintsPage = goToComplaintsPage;
window.updateComplaintStatus = updateComplaintStatus;
window.deleteComplaint = deleteComplaint;

window.filterActivityLog = filterActivityLog;
window.setActivityCat = setActivityCat;
window.changeActivityPageSize = changeActivityPageSize;
window.goToActivityPage = goToActivityPage;
