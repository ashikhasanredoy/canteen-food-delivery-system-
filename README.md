# University Canteen Food Delivery System

A complete full-stack web application designed to digitize the food ordering and delivery process within a university campus. It connects students, canteen shops, delivery personnel, and administrators in a single unified platform.

## 🛠️ Technology Stack & Languages

The application uses a modern, lightweight, and fast tech stack:

*   **Backend / Server:**
    *   **Python 3:** The core backend programming language.
    *   **FastAPI:** A modern, high-performance web framework for building APIs with Python.
    *   **SQLAlchemy:** The Python SQL toolkit and Object Relational Mapper (ORM) used to manage database tables and relationships.
    *   **SQLite:** A lightweight, disk-based database used to store all application data.
    *   **Uvicorn:** The ASGI web server used to run the FastAPI application.

*   **Frontend / UI:**
    *   **HTML5 & CSS3:** Used for the structure and custom styling of the user interfaces.
    *   **JavaScript (Vanilla JS):** Used for client-side logic, API communication (using `fetch`), dynamic DOM updates, and handling cart logic without heavy frontend frameworks.
    *   **Bootstrap 5:** CSS framework used for responsive grid layouts, buttons, modals, and rapid UI development.
    *   **Chart.js:** A JavaScript charting library used to render beautiful data visualizations on the Admin Dashboard.

---

## 👥 User Roles and Activities

The system is split into four distinct user types, each with their own dedicated portals and capabilities:

### 1. Buyer (Student)
*   **Menu Browsing:** Students can view all available foods across different canteen shops.
*   **Filtering:** Foods can be categorized and filtered by meal types such as **Breakfast** and **Lunch**.
*   **Cart System:** Students can add multiple items to their cart, adjust quantities, and see a real-time total price (calculated in Bangladeshi Taka — ৳).
*   **Checkout:** Students place orders by providing their Name, Student ID, Phone Number, and a specific Delivery Location on campus.
*   **Live Tracking:** After ordering, students receive a tracking link to monitor their order's status (`Pending` ➔ `Ready` ➔ `Out for Delivery` ➔ `Delivered`).
*   **Feedback:** Once an order is delivered, students can leave a star rating (1-5) and a written review for the food.

### 2. Seller (Canteen Shop)
*   **Shop Management:** Sellers log in using a unique Shop ID.
*   **Inventory Control:** Sellers can add new food items to the marketplace (providing name, price, quantity/stock, description, image URL, and meal type).
*   **Order Fulfillment:** Sellers receive incoming orders in real-time. Once they prepare the food, they click "Mark as Ready," which signals delivery personnel that the food is awaiting pickup.
*   **Notifications:** Sellers receive targeted alerts and notifications from the platform Administrators.

### 3. Delivery Boy
*   **Delivery Dashboard:** Delivery staff log in using a unique Delivery Boy ID.
*   **Order Claiming:** They can view a pool of all orders currently marked as `Ready` by the shops.
*   **Status Updates:** They can accept an order (moving it to `Out for Delivery`) and later mark it as `Delivered` once handed over to the student.
*   **Earnings Tracking:** Delivery boys earn a percentage of the delivery fee for each completed order. They can track their total historical earnings directly on their dashboard.

### 4. Administrator
*   **Admin Dashboard:** A secured portal (`/admin`) protected by admin credentials.
*   **Live Analytics:** The dashboard features live Chart.js graphs showing 14-day revenue trends, order status distributions, orders per shop, rating distributions, and top-selling foods.
*   **System Oversight:** Admins can view all orders, foods, shops, and user ratings across the entire platform.
*   **Moderation:** Admins have the power to forcefully delete inappropriate food items or entirely remove registered shops from the system.
*   **Financial Settings:** Admins can dynamically adjust the global platform settings, specifically the percentage cut the platform takes as an `Admin Fee` and the percentage given as `Delivery Earnings`.
*   **Communication:** Admins can send direct broadcast notifications to specific shops.
*   **Activity Logging:** A detailed audit trail logs every major action (logins, deletions, setting changes) for security and monitoring.

---

## 🚀 How to Run the Project Locally

1. **Create a virtual environment:**
   ```bash
   python3 -m venv venv
   ```
2. **Activate the virtual environment:**
   * On Mac/Linux: `source venv/bin/activate`
   * On Windows: `venv\Scripts\activate`
3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
4. **Run the main application (Buyer, Seller, Delivery portals):**
   ```bash
   python -m uvicorn backend.main:app --reload
   ```
   * *Access at: `http://127.0.0.1:8000`*
5. **Run the Admin Panel (in a new terminal window):**
   ```bash
   python -m backend.admin_app
   ```
   * *Access at: `http://127.0.0.1:5001/admin`*
