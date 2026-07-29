const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
let allFoods = [];
let activeMealFilter = '';

document.addEventListener('DOMContentLoaded', () => {
    loadMenu();
    
    // Bind search and sort events
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    if (searchInput) searchInput.addEventListener('input', filterAndSortMenu);
    if (sortSelect) sortSelect.addEventListener('change', filterAndSortMenu);
    
    // Star rating interaction
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
    
    // Order Form Submit
    document.getElementById('order-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const orderData = {
            food_id: parseInt(document.getElementById('order_food_id').value),
            student_name: document.getElementById('student_name').value,
            student_id: document.getElementById('student_id').value,
            phone: document.getElementById('phone').value,
            delivery_location: document.getElementById('delivery_location').value,
            quantity: parseInt(document.getElementById('order_quantity').value)
        };
        try {
            const response = await fetch(`${API_BASE_URL}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
            if (response.ok) {
                showToast('Order placed successfully! 🛵 Food is on the way.');
                const modal = bootstrap.Modal.getInstance(document.getElementById('orderModal'));
                modal.hide();
                document.getElementById('order-form').reset();
                loadMenu();
            } else {
                const err = await response.json();
                showToast(err.detail || 'Failed to place order', 'danger');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Network error. Is backend running?', 'danger');
        }
    });

    // Rating Form Submit
    document.getElementById('rating-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const stars = parseInt(document.getElementById('rating_stars').value);
        if (!stars || stars < 1) {
            showToast('Please select a star rating', 'warning');
            return;
        }
        const ratingData = {
            food_id: parseInt(document.getElementById('rating_food_id').value),
            student_id: document.getElementById('rating_student_id').value,
            stars: stars,
            comment: document.getElementById('rating_comment').value || null
        };
        try {
            const response = await fetch(`${API_BASE_URL}/ratings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ratingData)
            });
            if (response.ok) {
                showToast('Thank you for your rating! ⭐', 'success');
                const modal = bootstrap.Modal.getInstance(document.getElementById('ratingModal'));
                modal.hide();
                document.getElementById('rating-form').reset();
                resetStars();
                loadMenu(); // Refresh to show updated rating
            } else {
                const err = await response.json();
                showToast(err.detail || 'Could not submit rating', 'danger');
            }
        } catch (error) {
            showToast('Network error', 'danger');
        }
    });
});

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
        filterAndSortMenu();
    } catch (error) {
        console.error('Error loading menu:', error);
        document.getElementById('food-menu').innerHTML = '<div class="col-12 text-center text-danger">Error loading menu.</div>';
    }
}

function filterAndSortMenu() {
    const container = document.getElementById('food-menu');
    if (!container) return;

    // Still loading — don't overwrite the spinner
    if (allFoods.length === 0) return;
    
    const searchEl = document.getElementById('search-input');
    const sortEl = document.getElementById('sort-select');
    const query = searchEl ? searchEl.value.toLowerCase().trim() : '';
    const sortBy = sortEl ? sortEl.value : 'default';

    // 1. Filter by meal type (breakfast / lunch / both)
    let filtered = allFoods.filter(food => {
        if (!activeMealFilter) return true;             // "All" tab
        const mt = (food.meal_type || 'both').toLowerCase();
        return mt === activeMealFilter || mt === 'both'; // 'both' always shows
    });

    // 2. Filter by search query
    filtered = filtered.filter(food =>
        food.food_name.toLowerCase().includes(query) ||
        food.shop_name.toLowerCase().includes(query)
    );

    // 2. Sort foods
    if (sortBy === 'price-asc') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating-desc') {
        filtered.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
    } else if (sortBy === 'name-asc') {
        filtered.sort((a, b) => a.food_name.localeCompare(b.food_name));
    }

    // 3. Render
    container.innerHTML = '';
    if (filtered.length === 0) {
        container.innerHTML = '<div class="col-12 text-center py-5 text-muted"><h4>No food matches your search or selection.</h4></div>';
        return;
    }

    filtered.forEach(food => {
        const isAvailable = food.quantity > 0;
        const mealType  = (food.meal_type || 'both').toLowerCase();
        const mealLabel = mealType === 'breakfast' ? 'Breakfast'
                        : mealType === 'lunch'     ? 'Lunch'
                        : 'All Day';
        const mealColor = mealType === 'breakfast' ? '#f59e0b'
                        : mealType === 'lunch'     ? '#5C5CFF'
                        : '#059669';
        const card = document.createElement('div');
        card.className = 'col-md-6 col-lg-4 mb-4';
        card.innerHTML = `
            <div class="card h-100 glass-card border-0 overflow-hidden">
                <div class="position-relative">
                    <img src="${food.image_url}" class="card-img-top food-img-top" alt="${food.food_name}">
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
                </div>
                <div class="card-body d-flex flex-column p-4">
                    <h5 class="card-title fw-bold fs-4 mb-1">${food.food_name}</h5>
                    <p class="text-primary fw-medium small mb-2">${food.shop_name}</p>
                    <div class="mb-3">${renderStars(food.avg_rating, food.rating_count)}</div>
                    <p class="card-text text-secondary flex-grow-1 opacity-75">${food.description || 'A delicious meal freshly prepared for you.'}</p>
                    <div class="d-flex justify-content-between align-items-center mt-4 pt-3 border-top border-light">
                        <span class="fs-3 fw-bold text-dark">${formatCurrency(food.price)}</span>
                        <div class="d-flex gap-2">
                            <button class="btn btn-outline-warning rounded-pill px-3 hover-lift fw-medium"
                                    onclick="openRatingModal(${food.id}, '${food.food_name.replace(/'/g, "\'")}', '${food.shop_name.replace(/'/g, "\'")}', '${food.image_url}')"
                                    title="Rate this food">
                                Rate
                            </button>
                            <button class="btn btn-primary rounded-pill px-4 hover-lift fw-bold" 
                                    ${!isAvailable ? 'disabled' : ''}
                                    onclick="openOrderModal(${food.id}, '${food.food_name.replace(/'/g, "\'")}', ${food.price}, '${food.image_url}')">
                                ${isAvailable ? 'Buy Now' : 'Sold Out'}
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

function openOrderModal(id, name, price, img) {
    document.getElementById('order_food_id').value = id;
    document.getElementById('order_food_name').innerText = name;
    document.getElementById('order_food_price').innerText = formatCurrency(price);
    document.getElementById('order_food_price_val').value = price;
    document.getElementById('order_food_img').src = img;
    document.getElementById('order_quantity').value = 1;
    updateTotal();
    const modal = new bootstrap.Modal(document.getElementById('orderModal'));
    modal.show();
}

function updateTotal() {
    const qty = parseInt(document.getElementById('order_quantity').value) || 0;
    const price = parseFloat(document.getElementById('order_food_price_val').value) || 0;
    document.getElementById('order_total').innerText = formatCurrency(qty * price);
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
