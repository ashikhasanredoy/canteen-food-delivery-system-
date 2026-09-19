# 🍔 University Canteen Food Delivery System

A production-ready full-stack food ordering and delivery ecosystem engineered for university campuses. The platform seamlessly bridges **Students (Buyers)**, **Canteen Outlets (Sellers)**, **Campus Couriers (Delivery Partners)**, and **University Administration** in one synchronized system.

---

## 📑 Table of Contents

- [Overview & Architecture](#-overview--architecture)
- [Key Features by Role](#-key-features-by-role)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Quick Start Guide](#-quick-start-guide)
- [Access Portals & Default Credentials](#-access-portals--default-credentials)
- [Included PDF References](#-included-pdf-references)
- [Commission & Fee Distribution Model](#-commission--fee-distribution-model)
- [REST API Reference](#-rest-api-reference)
- [Database Schema](#-database-schema)
- [Troubleshooting & Maintenance](#-troubleshooting--maintenance)

---

## 🏛 Overview & Architecture

```
                               ┌────────────────────────────────┐
                               │   University Student / Buyer   │
                               │  - Browse Menu & Cart (৳ BDT)  │
                               │  - Place Order & Track Status  │
                               │  - OTP Verification & Rating   │
                               └──────────────┬─────────────────┘
                                              │ Places Order
                                              ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│  Seller (Canteen Outlet)     │        │   FastAPI Core Application   │
│  - Manage Stock & Menu Items │◄───────┤  - RESTful Endpoints & Auth  │
│  - Live Order Acceptance     │ Orders │  - OTP Handshake Service     │
│  - Mark Food "Ready"         │        │  - SQLite Database Engine    │
└──────────────┬───────────────┘        └──────────────┬───────────────┘
               │ Order Ready                           │
               ▼                                       │ Real-time Data
┌──────────────────────────────┐                       │
│  Delivery Partner (Rider)    │                       ▼
│  - Claim "Ready" Orders      │        ┌──────────────────────────────┐
│  - Out-for-Delivery Flow     │        │   Admin Control Center       │
│  - OTP Confirmation          │        │  - Live KPI Counters & Trend │
│  - Payout & Balance Tracker  │        │  - Fee Policy Simulator      │
└──────────────────────────────┘        │  - Shop & Rider Oversight    │
                                        │  - Notification & Audit Logs │
                                        └──────────────────────────────┘
```

---

## 👥 Key Features by Role

### 1. 🛒 Buyer Portal (`/buyer`)
- **Responsive 2-Column Mobile Grid**: Designed for mobile food browsing with compact action buttons and clear price tags.
- **Smart Category Filtering**: Instant filtering across **Breakfast**, **Lunch**, **Snacks**, **Beverages**, and specific shop outlets.
- **Real-Time Cart & Checkout**: Calculate item subtotals in Bangladeshi Taka (`৳`) with campus delivery location selection.
- **Live Order Status Tracking**: Real-time progress updates through four stages:
  $$\text{Pending} \longrightarrow \text{Ready} \longrightarrow \text{Out for Delivery} \longrightarrow \text{Delivered}$$
- **Secure OTP Delivery Confirmation**: Buyer verifies handover with the rider using a secure one-time passcode.
- **Ratings & Reviews**: 5-star ratings and written feedback directly associated with purchased food items.

### 2. 🏪 Seller Portal (`/seller`)
- **Shop Session Persistence**: Seamless login with unique Shop ID and persistent session recovery.
- **Menu & Inventory Control**: Add, edit, or toggle availability of food items with image links, prices, and descriptions.
- **Order Pipeline Management**: Live order feed with single-click status updates (`Accept` $\rightarrow$ `Mark as Ready for Pickup`).
- **Revenue Dashboard**: Track shop gross sales, commission deductions, and net payouts.
- **Broadcast Notifications**: Receive real-time announcements and alerts from University Administration.

### 3. 🚴 Delivery Partner Portal (`/delivery`)
- **Rider Authentication**: Login via unique Delivery Boy ID (e.g., `DB001` – `DB154`).
- **Open Order Claim Pool**: View all canteen orders flagged as `Ready` for pickup across campus.
- **Pickup & Delivery Workflow**: Mark orders as `Out for Delivery` and complete delivery upon entering the student's OTP.
- **Earnings & Commission Ledger**: Live tracking of rider payouts per order based on configured platform fee shares.

### 4. 🛡️ Central Admin Dashboard (`/admin`)
- **Live Statistical Overview**: Real-time counter badges across all 10 management modules:
  - 🏪 **Shops** (14 active outlets)
  - 🍱 **Foods** (180+ menu items)
  - 📦 **Orders** (6,000+ historical & active orders)
  - 🚴 **Delivery Riders** (154 registered student couriers)
  - ⭐ **Ratings & Reviews** (2,400+ verified buyer reviews)
  - 📢 **Complaints & Tickets** (650+ student feedback items)
  - 📜 **Activity Logs** (Chronological system audit trail)
  - 🔔 **Notifications Hub** (Dedicated alert dispatcher with pagination & status filters)
  - ⚙️ **Commission & Fee Policy** (Interactive live split simulator with instant preset chips)
- **Interactive Analytics**: Visual Chart.js charts for revenue trends, shop order volumes, rating distributions, and top-selling foods.
- **Anti-Flash Section Navigation**: Fast client-side section switching with zero reload delay.

---

## 🛠️ Technology Stack

| Layer | Technologies | Purpose |
|---|---|---|
| **Backend Framework** | [FastAPI](https://fastapi.tiangolo.com/) (Python 3.9+) | High-speed asynchronous REST API engine |
| **Server Engine** | [Uvicorn](https://www.uvicorn.org/) | Lightning-fast ASGI web server |
| **Database & ORM** | [SQLAlchemy](https://www.sqlalchemy.org/) + [SQLite](https://www.sqlite.org/) | Relational database mapping with disk persistence |
| **Templating** | [Jinja2](https://palletsprojects.com/p/jinja/) | Server-side template rendering for all portals |
| **Frontend Styling** | Vanilla CSS3 + [Bootstrap 5.3](https://getbootstrap.com/) | Custom glassmorphic styles, responsive grid, animations |
| **Icons & Typography** | Bootstrap Icons + Google Fonts (Outfit) | Modern UI iconography and clean sans-serif typography |
| **Client-side Logic** | Modern Vanilla JavaScript (ES6+) | Real-time fetch requests, DOM reactivity, local storage state |
| **Data Visualization**| [Chart.js 4.4](https://www.chartjs.org/) | Responsive charts for admin analytics |

---

## 📁 Project Structure

```
canteen-food-delivery-system/
├── backend/
│   ├── database/
│   │   └── canteen.db               # SQLite database file
│   ├── routers/
│   │   ├── complaints.py            # Complaints and dispute endpoints
│   │   ├── delivery.py              # Delivery partner operations & OTP flow
│   │   ├── foods.py                 # Menu item catalogue & inventory endpoints
│   │   ├── orders.py                # Order placement, tracking & status pipeline
│   │   ├── pages.py                 # Frontend HTML view routes
│   │   ├── ratings.py               # 5-star ratings & reviews API
│   │   └── shops.py                 # Shop registration & inventory management
│   ├── services/
│   │   ├── delivery_service.py      # Rider assignment & payout business logic
│   │   ├── order_service.py         # Order state machine & calculations
│   │   └── otp_service.py           # Secure 4-digit OTP generation & verification
│   ├── admin_app.py                 # Dedicated Admin router, stats & policy APIs
│   ├── config.py                    # Environment & database path configuration
│   ├── crud.py                      # Database access layer & queries
│   ├── database.py                  # SQLAlchemy engine & session factory
│   ├── models.py                    # Relational DB models (Shops, Foods, Orders, etc.)
│   ├── schemas.py                   # Pydantic models for request/response validation
│   └── main.py                      # Core FastAPI app initialization & middleware
├── frontend/
│   ├── static/
│   │   ├── css/
│   │   │   ├── admin.css            # Custom admin styling & glassmorphism components
│   │   │   └── style.css            # Buyer, seller, and delivery portal stylesheet
│   │   ├── images/
│   │   │   ├── complaints/          # Evidence attachments for customer tickets
│   │   │   ├── foods/               # High-resolution food item photography
│   │   │   └── shops/               # Storefront banners and logos
│   │   ├── js/
│   │   │   ├── admin.js             # Admin dynamic UI, charts & fee simulator
│   │   │   ├── buyer.js             # Buyer cart, filter & live order tracker
│   │   │   ├── delivery.js          # Delivery boy dashboard & OTP verification
│   │   │   ├── main.js              # Shared toast notifications & calendar widget
│   │   │   └── seller.js            # Seller inventory management & order dispatch
│   │   ├── Shop_List_and_Credentials.pdf
│   │   └── delivery_boys_credentials.pdf
│   └── templates/
│       ├── admin/
│       │   ├── base_admin.html      # Admin master layout with sidebar & live pills
│       │   ├── dashboard.html       # Full admin section views & analytics
│       │   └── login.html           # Secure admin authentication page
│       ├── base.html                # Public layout with glassmorphic navbar & footer
│       ├── buyer.html               # Student food discovery & ordering page
│       ├── delivery.html            # Courier fulfillment dashboard
│       ├── index.html               # Welcome landing page
│       └── seller.html              # Merchant management dashboard
├── backups/                         # Database snapshots created via backup.py
├── backup.py                        # Automated database backup utility script
├── run.py                           # Single-command launcher for all services
├── requirements.txt                 # Python project dependencies
├── README.md                        # Documentation
├── Shop_List_Directory.pdf          # PDF directory of all 14 shops & credentials
├── shop_credentials_and_food_menu.pdf
└── delivery_boys_credentials.pdf   # PDF directory of all 154 delivery partners
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.8+** (Python 3.9+ recommended)
- **pip** package manager

### 1. Clone & Set Up Environment
```bash
# Navigate to the project directory
cd canteen-food-delivery-system

# Create a virtual environment
python3 -m venv venv

# Activate the virtual environment
# On macOS / Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install required dependencies
pip install -r requirements.txt
```

### 2. Launch the Application
Start all backend services, customer portals, and the administration panel with a single command:
```bash
python3 run.py
```

The system will start locally on:
$$\text{http://127.0.0.1:8000}$$

---

## 🔑 Access Portals & Default Credentials

| Portal | URL Path | Role | Default Credentials |
|---|---|---|---|
| **Landing Page** | [`/`](http://127.0.0.1:8000/) | General Public | Open access |
| **Buy Food** | [`/buyer`](http://127.0.0.1:8000/buyer) | Student / Buyer | Enter Student ID at Checkout |
| **Sell Food** | [`/seller`](http://127.0.0.1:8000/seller) | Canteen Shop | `shop_1` / `password` *(See PDF for full list)* |
| **Delivery Partner** | [`/delivery`](http://127.0.0.1:8000/delivery) | Delivery Rider | `DB001` / `password` *(See PDF for full list)* |
| **Admin Control** | [`/admin`](http://127.0.0.1:8000/admin) | Platform Admin | **User:** `admin`<br>**Password:** `canteen@2024` or `admin123` |

---

## 📄 Included PDF References

The root directory and static folders include official printable PDF directories for deployment and credential verification:

1. **`Shop_List_Directory.pdf`**: Complete list of all 14 registered campus food outlets, shop IDs, passcodes, and contact details.
2. **`shop_credentials_and_food_menu.pdf`**: Itemized food catalogues, pricing in BDT (`৳`), and menu breakdown per shop.
3. **`delivery_boys_credentials.pdf`**: Directory of 154 registered student delivery partners with IDs (`DB001`–`DB154`).

---

## 💰 Commission & Fee Distribution Model

The platform dynamically calculates revenue distribution on every transaction:

$$\text{Order Total} = \text{Shop Net Payout} + \text{Platform Admin Fee} + \text{Delivery Rider Share}$$

```
Sample Order: ৳500.00
├── Shop Net Payout (93.0%):        ৳465.00
├── Platform Admin Fee (4.0%):       ৳20.00
└── Delivery Boy Earnings (3.0%):    ৳15.00
```

- **Configurable via Admin UI**: Rates can be customized in real-time under the **Fee Settings** section with interactive sliders and quick preset chips (`1.0%`, `1.5%`, `2.0%`, `3.0%`, `4.0%`, `5.0%`, `10.0%`).
- **Live Split Simulator**: Allows administrators to preview how any order value from `৳50` to `৳2,500` is divided.

---

## 📡 REST API Reference

### Public & Buyer Endpoints
- `GET /api/shops` — Retrieve list of all registered canteen shops.
- `GET /api/foods` — Retrieve food menu items with optional category filters.
- `POST /api/orders` — Place a new food order with buyer details and item list.
- `GET /api/orders/{order_id}` — Check live tracking status of an order.
- `POST /api/ratings` — Submit a 5-star rating and review for a completed order.

### Seller Endpoints
- `POST /api/seller/login` — Authenticate canteen outlet credentials.
- `GET /api/seller/foods` — Retrieve items belonging to the authenticated shop.
- `POST /api/seller/foods` — Add a new food item to the menu.
- `PUT /api/seller/foods/{food_id}` — Update item details, pricing, or stock.
- `PUT /api/orders/{order_id}/ready` — Update order status to `Ready`.

### Delivery Partner Endpoints
- `POST /api/delivery/login` — Courier login using Delivery Boy ID.
- `GET /api/delivery/available-orders` — List all orders ready for pickup.
- `PUT /api/delivery/orders/{order_id}/claim` — Assign order to the active rider (`Out for Delivery`).
- `POST /api/delivery/orders/{order_id}/verify-otp` — Verify customer OTP and mark order `Delivered`.
- `GET /api/delivery/earnings` — Retrieve total payout balance and delivery history.

### Admin Endpoints
- `GET /admin/api/stats` — Retrieve platform KPI counts and trend metrics.
- `GET /admin/api/settings` — Get current commission fee percentages.
- `PUT /admin/api/settings` — Update commission rates for admin and delivery share.
- `GET /admin/api/notifications` — Fetch paginated list of broadcast notifications.
- `POST /admin/api/notifications` — Send announcement alerts to shop outlets.

---

## 🗄️ Database Schema

All transactional records are stored in `backend/database/canteen.db` across the following core models:

- **`Shop`**: `id`, `name`, `password`, `contact`, `image_url`, `created_at`
- **`Food`**: `id`, `shop_id`, `name`, `price`, `stock`, `description`, `image_url`, `meal_type`
- **`Order`**: `id`, `buyer_name`, `student_id`, `phone`, `location`, `total_amount`, `status`, `otp`, `delivery_boy_id`, `created_at`
- **`OrderItem`**: `id`, `order_id`, `food_id`, `quantity`, `price`
- **`DeliveryBoy`**: `id`, `boy_id`, `name`, `phone`, `password`, `is_active`, `total_earnings`
- **`Rating`**: `id`, `order_id`, `food_id`, `stars`, `comment`, `created_at`
- **`Complaint`**: `id`, `order_id`, `buyer_name`, `subject`, `description`, `image_path`, `status`, `created_at`
- **`Notification`**: `id`, `shop_id`, `message`, `is_read`, `created_at`
- **`ActivityLog`**: `id`, `action`, `details`, `timestamp`
- **`FeeSetting`**: `id`, `admin_fee_percent`, `delivery_fee_percent`

---

## 🛡️ Troubleshooting & Maintenance

### Automated Backups
To create a timestamped snapshot of the database:
```bash
python3 backup.py
```
Snapshots are automatically placed in the `backups/` folder.

### Database Integrity
If you need to verify or inspect the active SQLite database directly:
```bash
sqlite3 backend/database/canteen.db ".tables"
```

---

## 📄 License
This project is developed for educational and campus operations purposes. Distributed under the MIT License.
