const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
const CART_STORAGE_KEY = 'canteen_buyer_cart';
let allFoods = [];
let activeMealFilter = '';
let cart = [];

document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    loadMenu();

    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    if (searchInput) searchInput.addEventListener('input', filterAndSortMenu);
    if (sortSelect) sortSelect.addEventListener('change', filterAndSortMenu);

    document.getElementById('clear-cart-btn').addEventListener('click', clearCart);
    document.getElementById('checkout-btn').addEventListener('click', openCheckoutModal);

    document.getElementById('cart-checkout-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitCartCheckout();
    });

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

    document.getElementById('rating-form').addEventListener('submit', async (e) => {
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
                modal.hide();
                document.getElementById('rating-form').reset();
                resetStars();
                loadMenu();
            } else {
                const err = await response.json();
                showToast(err.detail || 'Could not submit rating', 'danger');
            }
        } catch (error) {
            showToast('Network error', 'danger');
        }
    });
});

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
}

function removeFromCart(foodId) {
    cart = cart.filter(item => item.food_id !== foodId);
    saveCart();
}

function clearCart() {
    if (!cart.length) return;
    cart = [];
    saveCart();
    showToast('Cart cleared', 'secondary');
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
                    <img src="${item.image_url}" alt="${escapeHtml(item.food_name)}" class="cart-item-img rounded">
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

    const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('cartOffcanvas'));
    if (offcanvas) offcanvas.hide();

    const modal = new bootstrap.Modal(document.getElementById('cartCheckoutModal'));
    modal.show();
}

async function submitCartCheckout() {
    if (!cart.length) return;

    const payload = {
        student_name: document.getElementById('cart_student_name').value.trim(),
        student_id: document.getElementById('cart_student_id').value.trim(),
        phone: document.getElementById('cart_phone').value.trim(),
        delivery_location: document.getElementById('cart_delivery_location').value.trim(),
        items: cart.map(item => ({
            food_id: item.food_id,
            quantity: item.quantity
        }))
    };

    const submitBtn = document.querySelector('#cart-checkout-form button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Placing orders...';

    try {
        const response = await fetch(`${API_BASE_URL}/orders/cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const result = await response.json();
            showToast(`${result.order_count} order(s) placed successfully!`, 'success');
            cart = [];
            saveCart();
            document.getElementById('cart-checkout-form').reset();
            bootstrap.Modal.getInstance(document.getElementById('cartCheckoutModal')).hide();
            loadMenu();
        } else {
            const err = await response.json();
            const detail = Array.isArray(err.detail)
                ? err.detail.map(e => e.msg || e).join(', ')
                : (err.detail || 'Failed to place order');
            showToast(detail, 'danger');
            loadMenu();
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Network error. Is backend running?', 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Place All Orders';
    }
}

function escapeHtml(text) {
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
    document.getElementById('rating_stars').value = 0;
    document.getElementById('rating-label').textContent = 'Click a star to rate';
    document.getElementById('submit-rating-btn').disabled = true;
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

async function loadMenu() {
    try {
        const response = await fetch(`${API_BASE_URL}/foods`);
        allFoods = await response.json();
        syncCartWithMenu();
        filterAndSortMenu();
    } catch (error) {
        console.error('Error loading menu:', error);
        document.getElementById('food-menu').innerHTML = '<div class="col-12 text-center text-danger">Error loading menu.</div>';
    }
}

function filterAndSortMenu() {
    const container = document.getElementById('food-menu');
    if (!container) return;

    if (allFoods.length === 0) return;

    const searchEl = document.getElementById('search-input');
    const sortEl = document.getElementById('sort-select');
    const query = searchEl ? searchEl.value.toLowerCase().trim() : '';
    const sortBy = sortEl ? sortEl.value : 'default';

    let filtered = allFoods.filter(food => {
        if (!activeMealFilter) return true;
        const mt = (food.meal_type || 'both').toLowerCase();
        return mt === activeMealFilter || mt === 'both';
    });

    filtered = filtered.filter(food =>
        food.food_name.toLowerCase().includes(query) ||
        food.shop_name.toLowerCase().includes(query)
    );

    if (sortBy === 'price-asc') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating-desc') {
        filtered.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
    } else if (sortBy === 'name-asc') {
        filtered.sort((a, b) => a.food_name.localeCompare(b.food_name));
    }

    container.innerHTML = '';
    if (filtered.length === 0) {
        container.innerHTML = '<div class="col-12 text-center py-5 text-muted"><h4>No food matches your search or selection.</h4></div>';
        return;
    }

    filtered.forEach(food => {
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
        const card = document.createElement('div');
        card.className = 'col-md-6 col-lg-4 mb-4';
        card.innerHTML = `
            <div class="card h-100 glass-card border-0 overflow-hidden">
                <div class="position-relative">
                    <img src="${food.image_url}" class="card-img-top food-img-top" alt="${escapeHtml(food.food_name)}">
                    <div class="position-absolute top-0 end-0 m-3">
                        <span class="badge ${isAvailable ? 'bg-success' : 'bg-danger'} rounded-pill shadow px-3 py-2 fs-6">
                            ${isAvailable ? food.quantity + ' Left' : 'Sold Out'}
                        </span>
                    </div>
                    <div class="position-absolute top-0 start-0 m-3">
                        <span class="badge rounded-pill px-3 py-2" style="background:${mealColor}; font-size:0.72rem; font-weight:700; letter-spacing:0.3px;">
                            ${mealLabel}
                        </span>
                    </div>
                    ${inCartQty > 0 ? `<div class="position-absolute bottom-0 end-0 m-3"><span class="badge bg-primary rounded-pill px-3 py-2">${inCartQty} in cart</span></div>` : ''}
                </div>
                <div class="card-body d-flex flex-column p-4">
                    <h5 class="card-title fw-bold fs-4 mb-1">${escapeHtml(food.food_name)}</h5>
                    <p class="text-primary fw-medium small mb-2">${escapeHtml(food.shop_name)}</p>
                    <div class="mb-3">${renderStars(food.avg_rating, food.rating_count)}</div>
                    <p class="card-text text-secondary flex-grow-1 opacity-75">${escapeHtml(food.description || 'A delicious meal freshly prepared for you.')}</p>
                    <div class="d-flex justify-content-between align-items-center mt-4 pt-3 border-top border-light">
                        <span class="fs-3 fw-bold text-dark">${formatCurrency(food.price)}</span>
                        <div class="d-flex gap-2">
                            <button class="btn btn-outline-warning rounded-pill px-3 hover-lift fw-medium"
                                    onclick="openRatingModal(${food.id}, '${food.food_name.replace(/'/g, "\\'")}', '${food.shop_name.replace(/'/g, "\\'")}', '${food.image_url}')"
                                    title="Rate this food">
                                Rate
                            </button>
                            <button class="btn btn-primary rounded-pill px-4 hover-lift fw-bold"
                                    ${!isAvailable ? 'disabled' : ''}
                                    onclick="addToCart(${food.id})">
                                ${isAvailable ? (inCartQty > 0 ? 'Add More' : 'Add to Cart') : 'Sold Out'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function setMealFilter(btn, meal) {
    document.querySelectorAll('.meal-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeMealFilter = meal;
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
