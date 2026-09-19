const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
const CART_STORAGE_KEY = 'canteen_buyer_cart';
let allFoods = [];
let activeMealFilter = '';
let activeShopFilter = '';
let cart = [];
let currentPage = 1;
let itemsPerPage = 12;
let currentFilteredFoods = [];

document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    loadMenu();

    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const shopFilterSelect = document.getElementById('shop-filter-select');
    const perPageSelect = document.getElementById('per-page-select');

    if (perPageSelect) {
        itemsPerPage = parseInt(perPageSelect.value, 10) || 12;
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentPage = 1;
            filterAndSortMenu();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            currentPage = 1;
            filterAndSortMenu();
        });
    }

    if (shopFilterSelect) {
        shopFilterSelect.addEventListener('change', (e) => {
            activeShopFilter = e.target.value;
            currentPage = 1;
            filterAndSortMenu();
        });
    }

    const clearCartBtn = document.getElementById('clear-cart-btn');
    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);

    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', openCheckoutModal);

    const checkoutForm = document.getElementById('cart-checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitCartCheckout();
        });
    }

    const stars = document.querySelectorAll('#star-rating-input .star');
    stars.forEach(star => {
        star.addEventListener('mouseover', () => highlightStars(star.dataset.value));
        star.addEventListener('mouseout', () => highlightStars(document.getElementById('rating_stars').value));
        star.addEventListener('click', () => {
            const val = star.dataset.value;
            document.getElementById('rating_stars').value = val;
            document.getElementById('rating-label').textContent = ratingLabels[val];
            document.getElementById('submit-rating-btn').disabled = false;
            highlightStars(val);
        });
    });

    const ratingForm = document.getElementById('rating-form');
    if (ratingForm) {
        ratingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const starsVal = parseInt(document.getElementById('rating_stars').value);
            if (!starsVal || starsVal < 1) {
                showToast('Please select a star rating', 'warning');
                return;
            }
            const ratingData = {
                food_id: parseInt(document.getElementById('rating_food_id').value),
                student_id: document.getElementById('rating_student_id').value,
                stars: starsVal,
                comment: document.getElementById('rating_comment').value || null
            };
            try {
                const response = await fetch(`${API_BASE_URL}/ratings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ratingData)
                });
                if (response.ok) {
                    showToast('Thank you for your rating!', 'success');
                    const modal = bootstrap.Modal.getInstance(document.getElementById('ratingModal'));
                    if (modal) modal.hide();
                    document.getElementById('rating-form').reset();
                    resetStars();
                    await loadMenu();
                } else {
                    const err = await response.json();
                    showToast(err.detail || 'Could not submit rating', 'danger');
                }
            } catch (error) {
                showToast('Network error', 'danger');
            }
        });
    }

    // Safety backdrop cleanup when all modals close
    document.addEventListener('hidden.bs.modal', () => {
        if (!document.querySelector('.modal.show')) {
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('padding-right');
        }
    });
});

// ── Cart Management ───────────────────────────────────────────────
function loadCart() {
    try {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        cart = saved ? JSON.parse(saved) : [];
    } catch (error) {
        cart = [];
    }
    renderCart();
}

function saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    renderCart();
}

function syncCartWithMenu() {
    if (!allFoods.length) return;

    cart = cart.filter(item => {
        const food = allFoods.find(f => f.id === item.food_id);
        if (!food || food.quantity <= 0) return false;
        item.max_quantity = food.quantity;
        item.price = food.price;
        item.food_name = food.food_name;
        item.shop_name = food.shop_name;
        item.image_url = food.image_url;
        if (item.quantity > food.quantity) item.quantity = food.quantity;
        return true;
    });
    saveCart();
}

function getCartItemCount() {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function getCartTotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function addToCart(foodId) {
    const food = allFoods.find(f => f.id === foodId);
    if (!food) return;

    if (food.quantity <= 0) {
        showToast('This item is sold out', 'warning');
        return;
    }

    const existing = cart.find(item => item.food_id === foodId);
    if (existing) {
        if (existing.quantity >= food.quantity) {
            showToast(`Only ${food.quantity} available for ${food.food_name}`, 'warning');
            return;
        }
        existing.quantity += 1;
        existing.max_quantity = food.quantity;
    } else {
        cart.push({
            food_id: food.id,
            food_name: food.food_name,
            shop_name: food.shop_name,
            price: food.price,
            quantity: 1,
            max_quantity: food.quantity,
            image_url: food.image_url
        });
    }

    saveCart();
    showToast(`${food.food_name} added to cart`, 'success');
    renderFoodGridAndPagination();
}

function updateCartQuantity(foodId, delta) {
    const item = cart.find(i => i.food_id === foodId);
    if (!item) return;

    const food = allFoods.find(f => f.id === foodId);
    const maxQty = food ? food.quantity : item.max_quantity;

    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.food_id !== foodId);
    } else if (item.quantity > maxQty) {
        item.quantity = maxQty;
        showToast(`Only ${maxQty} available`, 'warning');
    }

    saveCart();
    renderFoodGridAndPagination();
}

function removeFromCart(foodId) {
    cart = cart.filter(item => item.food_id !== foodId);
    saveCart();
    renderFoodGridAndPagination();
}

function clearCart() {
    if (!cart.length) return;
    cart = [];
    saveCart();
    showToast('Cart cleared', 'secondary');
    renderFoodGridAndPagination();
}

function renderCart() {
    const badge = document.getElementById('cart-badge');
    const itemsContainer = document.getElementById('cart-items');
    const emptyState = document.getElementById('cart-empty-state');
    const grandTotalEl = document.getElementById('cart-grand-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    const clearBtn = document.getElementById('clear-cart-btn');

    if (!itemsContainer) return;

    const itemCount = getCartItemCount();
    if (badge) {
        badge.textContent = itemCount;
        badge.style.display = itemCount > 0 ? 'inline-flex' : 'none';
    }

    if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
    if (clearBtn) clearBtn.disabled = cart.length === 0;
    if (grandTotalEl) grandTotalEl.textContent = formatCurrency(getCartTotal());

    if (cart.length === 0) {
        itemsContainer.innerHTML = `
            <div class="text-center text-muted py-5" id="cart-empty-state">
                <i class="bi bi-basket fs-1 d-block mb-3 opacity-50"></i>
                <p class="mb-0">Your cart is empty.<br>Add items from different shops!</p>
            </div>`;
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    const grouped = {};
    cart.forEach(item => {
        if (!grouped[item.shop_name]) grouped[item.shop_name] = [];
        grouped[item.shop_name].push(item);
    });

    let html = '';
    Object.keys(grouped).sort().forEach(shopName => {
        html += `<div class="cart-shop-group mb-4">
            <div class="cart-shop-label mb-2"><i class="bi bi-shop me-1"></i>${escapeHtml(shopName)}</div>`;

        grouped[shopName].forEach(item => {
            html += `
                <div class="cart-item d-flex gap-3 mb-3 p-2 rounded-3">
                    <img src="${item.image_url}" alt="${escapeHtml(item.food_name)}" class="cart-item-img rounded" onerror="this.src='/static/images/foods/default.jpg'">
                    <div class="flex-grow-1 min-w-0">
                        <div class="fw-semibold text-truncate">${escapeHtml(item.food_name)}</div>
                        <div class="text-primary fw-bold small">${formatCurrency(item.price)}</div>
                        <div class="d-flex align-items-center gap-2 mt-2">
                            <button type="button" class="btn btn-sm btn-outline-secondary rounded-circle cart-qty-btn" onclick="updateCartQuantity(${item.food_id}, -1)">−</button>
                            <span class="fw-bold px-1">${item.quantity}</span>
                            <button type="button" class="btn btn-sm btn-outline-secondary rounded-circle cart-qty-btn" onclick="updateCartQuantity(${item.food_id}, 1)">+</button>
                            <button type="button" class="btn btn-sm btn-link text-danger ms-auto p-0" onclick="removeFromCart(${item.food_id})">Remove</button>
                        </div>
                    </div>
                    <div class="fw-bold text-end">${formatCurrency(item.price * item.quantity)}</div>
                </div>`;
        });

        html += '</div>';
    });

    itemsContainer.innerHTML = html;
}

function openCheckoutModal() {
    if (!cart.length) return;

    const summary = document.getElementById('checkout-summary');
    const checkoutTotal = document.getElementById('checkout_total');

    let summaryHtml = '<div class="small text-muted mb-2">Order summary</div>';
    cart.forEach(item => {
        summaryHtml += `
            <div class="d-flex justify-content-between align-items-center py-2 border-bottom border-light-subtle">
                <div>
                    <div class="fw-semibold">${escapeHtml(item.food_name)}</div>
                    <small class="text-muted">${escapeHtml(item.shop_name)} × ${item.quantity}</small>
                </div>
                <span class="fw-bold">${formatCurrency(item.price * item.quantity)}</span>
            </div>`;
    });
    summary.innerHTML = summaryHtml;
    checkoutTotal.textContent = formatCurrency(getCartTotal());

    const cartModalEl = document.getElementById('cartModal') || document.getElementById('cartOffcanvas');
    if (cartModalEl) {
        const cartModalInstance = bootstrap.Modal.getInstance(cartModalEl) || (bootstrap.Offcanvas ? bootstrap.Offcanvas.getInstance(cartModalEl) : null);
        if (cartModalInstance) cartModalInstance.hide();
    }

    const modal = new bootstrap.Modal(document.getElementById('cartCheckoutModal'));
    modal.show();
}

async function submitCartCheckout() {
    if (!cart.length) return;

    const email = document.getElementById('cart_email').value.trim();
    const studentName = document.getElementById('cart_student_name').value.trim();
    const studentId = document.getElementById('cart_student_id').value.trim();
    const phone = document.getElementById('cart_phone').value.trim();
    const deliveryLocation = document.getElementById('cart_delivery_location').value.trim();

    if (!studentName) {
        showToast('Please enter your Student Name', 'warning');
        document.getElementById('cart_student_name').focus();
        return;
    }

    if (!studentId || !/^\d{9,11}$/.test(studentId)) {
        showToast('Student ID must be 9 to 11 digits', 'warning');
        document.getElementById('cart_student_id').focus();
        return;
    }

    if (!email || !email.includes('@') || !email.includes('.')) {
        showToast('Please enter a valid Student Email address', 'warning');
        document.getElementById('cart_email').focus();
        return;
    }

    if (!phone) {
        showToast('Please enter your contact Phone Number', 'warning');
        document.getElementById('cart_phone').focus();
        return;
    }

    if (!deliveryLocation) {
        showToast('Please enter your Delivery Location', 'warning');
        document.getElementById('cart_delivery_location').focus();
        return;
    }

    const payload = {
        student_name: studentName,
        student_id: studentId,
        email: email,
        phone: phone,
        delivery_location: deliveryLocation,
        items: cart.map(item => ({
            food_id: item.food_id,
            quantity: item.quantity
        }))
    };

    const submitBtn = document.querySelector('#cart-checkout-form button[type="submit"]');
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Confirming Order...';

    try {
        const response = await fetch(`${API_BASE_URL}/orders/cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            const orderCount = result.order_count || cart.length;
            showToast(`🎉 Order Confirmed! Delivery OTP sent to ${email}`, 'success');
            
            cart = [];
            saveCart();
            document.getElementById('cart-checkout-form').reset();
            
            const checkoutModalEl = document.getElementById('cartCheckoutModal');
            const checkoutModal = bootstrap.Modal.getInstance(checkoutModalEl);
            if (checkoutModal) {
                checkoutModal.hide();
            }
            
            // Cleanly wait for checkout modal to finish closing before opening success modal
            setTimeout(() => {
                showOrderSuccessModal(result, email, orderCount);
            }, 250);
            
            loadMenu();
            if (typeof loadOrders === 'function') loadOrders();
        } else {
            showToast(result.detail || 'Failed to place order. Please try again.', 'danger');
        }
    } catch (err) {
        console.error('Checkout Error:', err);
        showToast('Network error while placing order', 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
    }
}

function showOrderSuccessModal(result, email, itemCount) {
    const emailEl = document.getElementById('success-modal-email');
    const emailDisplayEl = document.getElementById('success-modal-email-display');
    const itemsEl = document.getElementById('success-modal-items');
    const totalEl = document.getElementById('success-modal-total');

    if (emailEl) emailEl.textContent = email;
    if (emailDisplayEl) emailDisplayEl.textContent = email;
    if (itemsEl) itemsEl.textContent = `${result.order_count || itemCount} item(s)`;
    if (totalEl) totalEl.textContent = formatCurrency(result.total_amount || 0);

    const modalEl = document.getElementById('orderSuccessModal');
    if (modalEl) {
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) {
            modal = new bootstrap.Modal(modalEl);
        }
        modal.show();
    }
}

// ── Helpers & Star Ratings ────────────────────────────────────────
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function highlightStars(value) {
    const stars = document.querySelectorAll('#star-rating-input .star');
    stars.forEach(star => {
        star.classList.toggle('active', parseInt(star.dataset.value) <= parseInt(value));
    });
}

function resetStars() {
    const ratingStars = document.getElementById('rating_stars');
    const ratingLabel = document.getElementById('rating-label');
    const submitBtn = document.getElementById('submit-rating-btn');
    if (ratingStars) ratingStars.value = 0;
    if (ratingLabel) ratingLabel.textContent = 'Click a star to rate';
    if (submitBtn) submitBtn.disabled = true;
    highlightStars(0);
}

function renderStars(avg, count) {
    if (!avg || count === 0) return '<span class="text-muted small">No ratings yet</span>';
    const full = Math.round(avg);
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `<span class="static-star ${i <= full ? 'active' : ''}">★</span>`;
    }
    return `<div class="d-flex align-items-center gap-1">${html}<span class="text-muted small ms-1">${avg} (${count})</span></div>`;
}

// ── Menu Loading, Filtering & Pagination ─────────────────────────
async function loadMenu() {
    try {
        const response = await fetch(`${API_BASE_URL}/foods?limit=1000`);
        allFoods = await response.json();
        populateShopFilterOptions();
        syncCartWithMenu();
        filterAndSortMenu();
    } catch (error) {
        console.error('Error loading menu:', error);
        const container = document.getElementById('food-menu');
        if (container) {
            container.innerHTML = '<div class="col-12 text-center py-5 text-danger"><h4>Error loading menu. Please check your connection.</h4></div>';
        }
    }
}

function populateShopFilterOptions() {
    const select = document.getElementById('shop-filter-select');
    if (!select) return;

    const currentVal = activeShopFilter || select.value;
    const shops = [...new Set(allFoods.map(f => f.shop_name).filter(Boolean))].sort();

    select.innerHTML = `<option value="">All Canteen Outlets (${shops.length})</option>` +
        shops.map(shop => `<option value="${escapeHtml(shop)}"${shop === currentVal ? ' selected' : ''}>${escapeHtml(shop)}</option>`).join('');
}

function filterAndSortMenu() {
    const searchEl = document.getElementById('search-input');
    const sortEl = document.getElementById('sort-select');
    const query = searchEl ? searchEl.value.toLowerCase().trim() : '';
    const sortBy = sortEl ? sortEl.value : 'default';

    let filtered = allFoods.filter(food => {
        if (activeMealFilter) {
            const mt = (food.meal_type || 'both').toLowerCase();
            if (mt !== activeMealFilter && mt !== 'both') return false;
        }
        if (activeShopFilter) {
            if ((food.shop_name || '') !== activeShopFilter) return false;
        }
        if (query) {
            const nameMatch = (food.food_name || '').toLowerCase().includes(query);
            const shopMatch = (food.shop_name || '').toLowerCase().includes(query);
            const descMatch = (food.description || '').toLowerCase().includes(query);
            if (!nameMatch && !shopMatch && !descMatch) return false;
        }
        return true;
    });

    if (sortBy === 'price-asc') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating-desc') {
        filtered.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
    } else if (sortBy === 'name-asc') {
        filtered.sort((a, b) => (a.food_name || '').localeCompare(b.food_name || ''));
    }

    currentFilteredFoods = filtered;
    renderFoodGridAndPagination();
}

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

function renderFoodGridAndPagination() {
    const container = document.getElementById('food-menu');
    const paginationContainer = document.getElementById('pagination-container');
    const paginationList = document.getElementById('pagination-list');
    const paginationInfo = document.getElementById('pagination-info');
    const paginationSummary = document.getElementById('pagination-summary');
    const currentPageNum = document.getElementById('current-page-num');
    const totalPagesNum = document.getElementById('total-pages-num');
    const totalItemsCount = document.getElementById('total-items-count');

    if (!container) return;

    if (!allFoods || allFoods.length === 0) {
        container.innerHTML = '<div class="col-12 text-center py-5 text-muted"><h4>No food items available at this time.</h4></div>';
        if (paginationContainer) paginationContainer.style.display = 'none';
        if (paginationInfo) paginationInfo.textContent = 'Showing 0 foods';
        return;
    }

    const totalItems = currentFilteredFoods.length;

    if (totalItems === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="p-4 rounded-4 bg-light d-inline-block text-muted shadow-sm">
                    <i class="bi bi-search fs-1 d-block mb-3 opacity-50 text-warning"></i>
                    <h5 class="fw-bold text-dark mb-1">No matching foods found</h5>
                    <p class="small text-muted mb-3">Try adjusting your search terms, meal filter, or canteen shop.</p>
                    <button class="btn btn-sm btn-primary rounded-pill px-4" onclick="resetFilters()">
                        <i class="bi bi-arrow-counterclockwise me-1"></i>Reset All Filters
                    </button>
                </div>
            </div>`;
        if (paginationContainer) paginationContainer.style.display = 'none';
        if (paginationInfo) paginationInfo.textContent = 'Showing 0 of 0 foods';
        return;
    }

    const effectivePageSize = itemsPerPage > 0 ? itemsPerPage : 12;
    const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * effectivePageSize;
    const endIdx = Math.min(startIdx + effectivePageSize, totalItems);
    const pageFoods = currentFilteredFoods.slice(startIdx, endIdx);

    // Update Top & Bottom Pagination Info
    if (paginationInfo) {
        paginationInfo.textContent = `Showing ${startIdx + 1}–${endIdx} of ${totalItems} foods`;
    }
    if (paginationSummary) {
        paginationSummary.innerHTML = `Showing page <b class="text-dark">${currentPage}</b> of <b class="text-dark">${totalPages}</b> (<span class="fw-semibold text-dark">${totalItems}</span> foods)`;
    }
    if (currentPageNum) currentPageNum.textContent = currentPage;
    if (totalPagesNum) totalPagesNum.textContent = totalPages;
    if (totalItemsCount) totalItemsCount.textContent = totalItems;

    // Render Food Cards
    let html = '';
    pageFoods.forEach(food => {
        const isAvailable = food.quantity > 0;
        const cartItem = cart.find(item => item.food_id === food.id);
        const inCartQty = cartItem ? cartItem.quantity : 0;
        const mealType = (food.meal_type || 'both').toLowerCase();
        const mealLabel = mealType === 'breakfast' ? 'Breakfast'
            : mealType === 'lunch' ? 'Lunch'
            : 'All Day';
        const mealColor = mealType === 'breakfast' ? '#f59e0b'
            : mealType === 'lunch' ? '#5C5CFF'
            : '#059669';

        const safeName = escapeHtml(food.food_name || '');
        const safeShop = escapeHtml(food.shop_name || '');
        const safeDesc = escapeHtml(food.description || 'A delicious meal freshly prepared for you.');
        const safeNameArg = (food.food_name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const safeShopArg = (food.shop_name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const safeImgArg = (food.image_url || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        html += `
            <div class="col-6 col-md-6 col-lg-4 mb-2 mb-md-4">
                <div class="card h-100 glass-card food-card-item border-0 overflow-hidden shadow-sm hover-lift transition-all">
                    <div class="position-relative food-img-container">
                        <img src="${food.image_url}" class="card-img-top food-img-top" alt="${safeName}" onerror="this.src='/static/images/foods/default.jpg'">
                        <div class="position-absolute top-0 end-0 m-1.5 m-sm-2 m-md-3">
                            <span class="badge ${isAvailable ? 'bg-success' : 'bg-danger'} rounded-pill shadow-sm px-2 py-1 px-md-3 py-md-2 food-badge-stock">
                                ${isAvailable ? food.quantity + ' Left' : 'Sold Out'}
                            </span>
                        </div>
                        <div class="position-absolute top-0 start-0 m-1.5 m-sm-2 m-md-3">
                            <span class="badge rounded-pill px-2 py-1 px-md-3 py-md-2 shadow-sm text-white food-badge-meal" style="background:${mealColor};">
                                ${mealLabel}
                            </span>
                        </div>
                        ${inCartQty > 0 ? `<div class="position-absolute bottom-0 end-0 m-1.5 m-sm-2 m-md-3"><span class="badge bg-primary rounded-pill px-2 py-1 px-md-3 py-md-2 shadow-sm food-badge-cart">${inCartQty} in cart</span></div>` : ''}
                    </div>
                    <div class="card-body d-flex flex-column p-2.5 p-sm-3 p-md-4">
                        <h5 class="card-title fw-bold food-card-title mb-1" title="${safeName}">${safeName}</h5>
                        <p class="text-primary fw-semibold shop-name-label mb-1 mb-md-2" title="${safeShop}"><i class="bi bi-shop me-1"></i>${safeShop}</p>
                        <div class="food-rating-wrap mb-1 mb-md-3">${renderStars(food.avg_rating, food.rating_count)}</div>
                        <p class="card-text text-secondary flex-grow-1 opacity-75 small d-none d-md-block mb-2">${safeDesc}</p>
                        <div class="food-actions-row d-flex justify-content-between align-items-center mt-auto pt-2 pt-md-3 border-top border-light">
                            <span class="food-price-text fw-bold text-dark">${formatCurrency(food.price)}</span>
                            <div class="d-flex align-items-center gap-1 gap-md-2 food-btn-group">
                                <button type="button" class="btn btn-outline-warning rounded-pill food-rate-btn hover-lift fw-medium"
                                        onclick="openRatingModal(${food.id}, '${safeNameArg}', '${safeShopArg}', '${safeImgArg}')"
                                        title="Rate this food">
                                    <i class="bi bi-star"></i><span class="d-none d-lg-inline ms-1">Rate</span>
                                </button>
                                <button type="button" class="btn btn-primary rounded-pill food-add-btn hover-lift fw-bold"
                                        ${!isAvailable ? 'disabled' : ''}
                                        onclick="addToCart(${food.id})">
                                    <i class="bi bi-cart-plus me-1"></i><span>${isAvailable ? (inCartQty > 0 ? 'More' : 'Add') : 'Sold'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Render Pagination Bar
    if (!paginationContainer || !paginationList) return;

    if (totalPages <= 1) {
        paginationContainer.style.display = totalItems > 0 ? 'flex' : 'none';
        paginationList.innerHTML = `
            <li class="page-item active">
                <button type="button" class="page-link">1</button>
            </li>`;
        return;
    }

    paginationContainer.style.display = 'flex';

    let paginationHtml = '';

    // First page jump (when totalPages > 5)
    if (totalPages > 5) {
        paginationHtml += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <button type="button" class="page-link" onclick="goToPage(1)" title="First Page" aria-label="First">
                    <i class="bi bi-chevron-double-left"></i>
                </button>
            </li>`;
    }

    // Previous page button
    paginationHtml += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <button type="button" class="page-link" onclick="goToPage(${currentPage - 1})" title="Previous Page" aria-label="Previous">
                <i class="bi bi-chevron-left"></i>
            </button>
        </li>`;

    // Numeric page buttons
    const pages = getPaginationArray(currentPage, totalPages);
    pages.forEach(item => {
        if (item === '...') {
            paginationHtml += `
                <li class="page-item disabled">
                    <span class="page-link border-0 bg-transparent text-muted">…</span>
                </li>`;
        } else {
            const isCurr = item === currentPage;
            paginationHtml += `
                <li class="page-item ${isCurr ? 'active' : ''}">
                    <button type="button" class="page-link" onclick="goToPage(${item})">${item}</button>
                </li>`;
        }
    });

    // Next page button
    paginationHtml += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <button type="button" class="page-link" onclick="goToPage(${currentPage + 1})" title="Next Page" aria-label="Next">
                <i class="bi bi-chevron-right"></i>
            </button>
        </li>`;

    // Last page jump (when totalPages > 5)
    if (totalPages > 5) {
        paginationHtml += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <button type="button" class="page-link" onclick="goToPage(${totalPages})" title="Last Page" aria-label="Last">
                    <i class="bi bi-chevron-double-right"></i>
                </button>
            </li>`;
    }

    paginationList.innerHTML = paginationHtml;
}

function goToPage(pageNum, scrollToGrid = true) {
    const totalItems = currentFilteredFoods.length;
    const effectivePageSize = itemsPerPage > 0 ? itemsPerPage : 12;
    const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));

    if (pageNum < 1) pageNum = 1;
    if (pageNum > totalPages) pageNum = totalPages;

    currentPage = pageNum;
    renderFoodGridAndPagination();

    if (scrollToGrid) {
        const menuEl = document.getElementById('food-menu');
        if (menuEl) {
            const yOffset = -100;
            const y = menuEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }
}

function changePerPage(val) {
    const parsed = parseInt(val, 10);
    itemsPerPage = isNaN(parsed) || parsed <= 0 ? 12 : parsed;
    currentPage = 1;
    renderFoodGridAndPagination();
}

function setMealFilter(btn, meal) {
    document.querySelectorAll('.meal-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    activeMealFilter = meal;
    currentPage = 1;
    filterAndSortMenu();
}

function resetFilters() {
    const searchEl = document.getElementById('search-input');
    const sortEl = document.getElementById('sort-select');
    const shopEl = document.getElementById('shop-filter-select');
    if (searchEl) searchEl.value = '';
    if (sortEl) sortEl.value = 'default';
    if (shopEl) {
        shopEl.value = '';
        activeShopFilter = '';
    }
    activeMealFilter = '';
    document.querySelectorAll('.meal-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.meal === '');
    });
    currentPage = 1;
    filterAndSortMenu();
}

function openRatingModal(id, name, shop, img) {
    document.getElementById('rating_food_id').value = id;
    document.getElementById('rating_food_name').innerText = name;
    document.getElementById('rating_food_shop').innerText = 'Shop: ' + shop;
    document.getElementById('rating_food_img').src = img;
    document.getElementById('rating_student_id').value = '';
    document.getElementById('rating_comment').value = '';
    resetStars();
    const modal = new bootstrap.Modal(document.getElementById('ratingModal'));
    modal.show();
}

// Expose globally for inline onclick/onchange handlers
window.goToPage = goToPage;
window.changePerPage = changePerPage;
window.setMealFilter = setMealFilter;
window.resetFilters = resetFilters;
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.openRatingModal = openRatingModal;
window.openCheckoutModal = openCheckoutModal;
window.copyDeliveryOtp = copyDeliveryOtp;
window.showOrderSuccessModal = showOrderSuccessModal;
