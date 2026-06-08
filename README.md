# RestaurantOS — Digital Menu & Ordering System

## Quick Start

### 1. Database Setup (MySQL)

```sql
CREATE DATABASE restaurant_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend

```bash
cd backend
cp .env.example .env        # fill in your DB credentials
npm install
npm run dev                 # runs on http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                 # runs on http://localhost:5173
```

### Default Admin Login

- Email: `admin@restaurant.com`
- Password: `admin123`

---

## Folder Structure

```
restaurant-system/
├── backend/
│   ├── src/
│   │   ├── config/db.js          # MySQL pool + auto-migration
│   │   ├── controllers/          # authController, menuController, orderController
│   │   ├── middleware/           # auth.js (JWT), upload.js (multer)
│   │   ├── routes/               # auth.js, menu.js, orders.js
│   │   ├── socket/index.js       # Socket.io handlers
│   │   └── server.js             # Express + Socket.io entry
│   └── uploads/                  # Uploaded images (auto-created)
└── frontend/
    └── src/
        ├── components/           # Layout, Navbar, FloatingPromo, MenuItemCard
        ├── context/              # Auth, Cart, Socket, Theme
        ├── pages/
        │   ├── admin/            # Dashboard, Menu, Orders, Users
        │   ├── staff/            # StaffDashboard
        │   └── ...               # Menu, Cart, Orders, Login, Register
        └── services/api.js       # Axios + all API calls
```

---

## API Reference

### Auth — `/api/auth`

| Method | Endpoint          | Auth  | Description        |
| ------ | ----------------- | ----- | ------------------ |
| POST   | `/register`       | —     | Register user      |
| POST   | `/login`          | —     | Login, returns JWT |
| GET    | `/me`             | ✅    | Get current user   |
| GET    | `/users`          | Admin | List all users     |
| PATCH  | `/users/:id/role` | Admin | Change user role   |
| DELETE | `/users/:id`      | Admin | Delete user        |

### Menu — `/api/menu`

| Method | Endpoint           | Auth  | Description                               |
| ------ | ------------------ | ----- | ----------------------------------------- |
| GET    | `/items`           | —     | List items (filter: `?category=&search=`) |
| GET    | `/items/:id`       | —     | Get single item                           |
| POST   | `/items`           | Admin | Create item (multipart)                   |
| PUT    | `/items/:id`       | Admin | Update item                               |
| DELETE | `/items/:id`       | Admin | Delete item                               |
| GET    | `/categories`      | —     | List categories                           |
| POST   | `/categories`      | Admin | Create category                           |
| GET    | `/promotions`      | —     | Featured/discounted items                 |
| GET    | `/recommendations` | —     | Most ordered items                        |

### Orders — `/api/orders`

| Method | Endpoint      | Auth        | Description                    |
| ------ | ------------- | ----------- | ------------------------------ |
| POST   | `/`           | ✅          | Place order                    |
| GET    | `/`           | ✅          | Get orders (customers see own) |
| GET    | `/:id`        | ✅          | Get order detail               |
| PATCH  | `/:id/status` | Admin/Staff | Update status                  |
| GET    | `/analytics`  | Admin       | Sales analytics                |

---

## Socket.io Events

| Event                  | Direction            | Description              |
| ---------------------- | -------------------- | ------------------------ |
| `new_order`            | Server → admin/staff | New order placed         |
| `order_updated`        | Server → admin/staff | Order status changed     |
| `order_status_changed` | Server → customer    | Customer's order updated |

---

## Roles

- `admin` — full access: menu CRUD, all orders, users, analytics
- `staff` — view & update order status, staff dashboard
- `cashier` — check and accept payment
- `customer` — browse menu, place orders, view own orders
