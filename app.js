// ============================================================
// VORNEX STORE - FULL FIREBASE SYNCED APP
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyDItBcWY7ww6jj73h1HEtaTm7YllIBLQ1c",
    authDomain: "vornex-b7a62.firebaseapp.com",
    databaseURL: "https://vornex-b7a62-default-rtdb.firebaseio.com",
    projectId: "vornex-b7a62",
    storageBucket: "vornex-b7a62.firebasestorage.app",
    messagingSenderId: "60746200967",
    appId: "1:60746200967:web:29bf4cb533b14db3080522",
    measurementId: "G-RBG15BDSG0"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();

let allProducts = [];
let cart = JSON.parse(localStorage.getItem("vornex_cart") || "[]");
let wishlist = JSON.parse(localStorage.getItem("vornex_wishlist") || "[]");

let currentCategory = "ALL";

let currentDetailProduct = null;
let currentDetailQty = 1;
let currentDetailSize = "";

let currentCoupon = null;
let availableCoupons = {};

let confirmationResult = null;

let heroMedia = [];
let heroIndex = 0;
let heroTimer = null;

const WHATSAPP_NUMBER = "918269444061";

// ============================================================
// UTILITIES
// ============================================================

function toast(message, type = "success") {

    if (typeof Toastify !== "function") {
        alert(message);
        return;
    }

    let color = "#111";

    if (type === "error") color = "#ef4444";
    if (type === "success") color = "#111";
    if (type === "info") color = "#2563eb";

    Toastify({
        text: message,
        duration: 1500,
        gravity: "bottom",
        position: "center",
        close: false,
        style: {
            background: color,
            color: "#fff",
            borderRadius: "14px",
            fontWeight: "800",
            fontFamily: "Montserrat"
        }
    }).showToast();
}

function money(value) {
    return "₹" + Math.max(0, Math.round(Number(value) || 0)).toLocaleString("en-IN");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function saveCart() {
    localStorage.setItem("vornex_cart", JSON.stringify(cart));
}

function saveWishlist() {
    localStorage.setItem("vornex_wishlist", JSON.stringify(wishlist));
}

function getStock(product, size = "") {

    const stocks = product.sizeStocks || {};

    if (size && stocks[size] !== undefined) {
        return Number(stocks[size]) || 0;
    }

    return Object.values(stocks)
        .reduce((a, b) => a + (Number(b) || 0), 0);
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    fetchProductsFromFirebase();

    loadCoupons();

    loadHeroMedia();

    recordDailyView();

    renderCart();

    renderWishlist();

    updateBadges();

    loadSavedTheme();

    observeAuth();

    setupSwipeEvents();

    window.addEventListener("popstate", handleBackNavigation);
});

// ============================================================
// ANALYTICS
// ============================================================

function recordDailyView() {

    const now = new Date();

    const date = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);

    db.ref(`analytics/daily_views/${date}`).transaction(
        current => (current || 0) + 1
    );
}

// ============================================================
// PRODUCTS
// ============================================================

function fetchProductsFromFirebase() {

    const grid = document.getElementById("productGrid");

    db.ref("products").on("value", snapshot => {

        const data = snapshot.val();

        allProducts = [];

        if (!data) {

            grid.innerHTML = `
                <div class="loading-spinner">
                    No products found.
                </div>
            `;

            return;
        }

        Object.keys(data).forEach(key => {

            allProducts.push({
                id: key,
                ...data[key]
            });
        });

        renderProducts(allProducts);

    }, error => {

        console.error(error);

        grid.innerHTML = `
            <div class="loading-spinner">
                Error loading products.
            </div>
        `;
    });
}

function renderProducts(productsList) {

    const grid = document.getElementById("productGrid");

    if (!grid) return;

    if (!productsList.length) {

        grid.innerHTML = `
            <div class="loading-spinner">
                No products matching your search.
            </div>
        `;

        return;
    }

    let html = "";

    productsList.forEach(product => {

        const liked = wishlist.includes(product.id);

        const image =
            product.image ||
            product.imgUrl ||
            "https://via.placeholder.com/500";

        const stock = getStock(product);

        html += `
        <div class="product-card">

            <div
                class="product-image-wrap"
                onclick="openProductDetail('${product.id}')"
            >

                <img
                    class="product-card-img"
                    src="${escapeHtml(image)}"
                    alt="${escapeHtml(product.name || "VORNEX Product")}"
                >

                <button
                    class="wishlist-card-btn ${liked ? "liked" : ""}"
                    onclick="event.stopPropagation();toggleWishlist('${product.id}',this)"
                >
                    <i class="${liked ? "fa-solid" : "fa-regular"} fa-heart"></i>
                </button>
            </div>

            <div class="p-info">

                ${
                    product.tag
                    ? `<span class="detail-tag" style="margin-bottom:7px;">${escapeHtml(product.tag)}</span>`
                    : ""
                }

                <div
                    class="p-title"
                    onclick="openProductDetail('${product.id}')"
                    style="cursor:pointer;"
                >
                    ${escapeHtml(product.name || product.title || "VORNEX PRODUCT")}
                </div>

                <div class="p-price">
                    <span class="current-price">${money(product.price)}</span>
                    ${Number(product.mrp||0)>Number(product.price||0)?`<span class="mrp-price">${money(product.mrp)}</span><span class="discount-off">${Math.round(((Number(product.mrp)-Number(product.price))/Number(product.mrp))*100)}% OFF</span>`:""}
                </div>

                <small style="color:#777;">
                    ${stock > 0 ? "IN STOCK" : "OUT OF STOCK"}
                </small>

                <button
                    class="add-btn"
                    id="addBtn-${product.id}"
                    onclick="addToCart('${product.id}')"
                    ${stock <= 0 ? "disabled" : ""}
                >
                    ${stock > 0 ? "ADD TO BAG" : "OUT OF STOCK"}
                </button>

            </div>
        </div>
        `;
    });

    grid.innerHTML = html;
}

// ============================================================
// FILTER / SEARCH
// ============================================================

function filterCategory(category, btn) {

    currentCategory = category;

    document.querySelectorAll(".cat-btn")
        .forEach(button => button.classList.remove("active"));

    if (btn) btn.classList.add("active");

    applyFilters();
}

function searchProducts() {
    applyFilters();
}

function applyFilters() {

    const input = document.getElementById("storeSearch");

    const query = input
        ? input.value.toLowerCase().trim()
        : "";

    const filtered = allProducts.filter(product => {

        const title =
            (product.name || product.title || "")
            .toLowerCase();

        const category =
            (product.category || "")
            .toLowerCase();

        const categoryMatch =
            currentCategory === "ALL" ||
            category === currentCategory.toLowerCase();

        return categoryMatch && title.includes(query);
    });

    renderProducts(filtered);
}

// ============================================================
// MENU
// ============================================================

function toggleMenuDrawer(open) {

    const drawer = document.getElementById("iosMenuDrawer");
    const overlay = document.getElementById("drawerOverlay");

    if (open) {

        drawer.classList.add("active");
        overlay.classList.add("active");

        document.body.classList.add("drawer-open");

    } else {

        drawer.classList.remove("active");
        overlay.classList.remove("active");

        document.body.classList.remove("drawer-open");
    }
}

function closeAllDrawers() {

    toggleMenuDrawer(false);

    closeCartDrawer();

    document.querySelectorAll(".custom-modal")
        .forEach(modal => modal.classList.remove("active"));

    document.body.classList.remove("modal-open");
}

function openCartFromMenu() {

    toggleMenuDrawer(false);

    document.getElementById("cartDrawer")
        .classList.add("active");

    document.getElementById("drawerOverlay")
        .classList.add("active");

    document.body.classList.add("drawer-open");

    renderCart();
}

function closeCartDrawer() {

    document.getElementById("cartDrawer")
        .classList.remove("active");

    document.getElementById("drawerOverlay")
        .classList.remove("active");

    document.body.classList.remove("drawer-open");
}

function openWishlistFromMenu() {

    toggleMenuDrawer(false);

    renderWishlist();

    openModal("wishlistModal");
}

function openCouponsFromMenu() {

    toggleMenuDrawer(false);

    renderCoupons();

    openModal("couponsModal");
}

function toggleAccordion(id) {

    const element = document.getElementById(id);

    if (!element) return;

    element.style.display =
        element.style.display === "block"
        ? "none"
        : "block";
}

// ============================================================
// MODALS
// ============================================================

function openModal(id) {

    const modal = document.getElementById(id);

    if (!modal) return;

    modal.classList.add("active");

    document.body.classList.add("modal-open");

    history.pushState({
        modal: id
    }, "");
}

function closeModalStepBack(id) {

    const modal = document.getElementById(id);

    if (modal) modal.classList.remove("active");

    document.body.classList.remove("modal-open");
}

function closeModalOnBg(event, id) {

    if (event.target.id === id) {
        closeModalStepBack(id);
    }
}

function handleBackNavigation() {

    document
        .querySelectorAll(".custom-modal.active")
        .forEach(modal => modal.classList.remove("active"));

    closeCartDrawer();

    toggleMenuDrawer(false);

    if (document.getElementById("productDetailModal").classList.contains("active")) {
        closeProductDetail(false);
    }

    document.body.classList.remove("modal-open");
}

// ============================================================
// THEMES
// ============================================================

function setTheme(themeName) {

    if (!["dark","light"].includes(themeName)) {
        themeName = "dark";
    }

    document.body.classList.remove(
        "theme-dark", "theme-light",
        "theme-neon", "theme-gold", "theme-emerald",
        "theme-violet", "theme-amber"
    );

    document.body.classList.add(`theme-${themeName}`);

    localStorage.setItem("vornex_theme", themeName);

    toast(`Theme: ${themeName.toUpperCase()}`, "success");
}

function loadSavedTheme() {

    const theme =
        localStorage.getItem("vornex_theme") || "light";

    setTheme(theme);
}

// ============================================================
// WISHLIST
// ============================================================

function toggleWishlist(id, button) {

    const index = wishlist.indexOf(id);

    if (index === -1) {

        wishlist.push(id);

        if (button) {
            button.classList.add("liked");

            const icon = button.querySelector("i");

            if (icon) {
                icon.className = "fa-solid fa-heart";
            }
        }

        toast("❤️ Added to Wishlist");

    } else {

        wishlist.splice(index, 1);

        if (button) {
            button.classList.remove("liked");

            const icon = button.querySelector("i");

            if (icon) {
                icon.className = "fa-regular fa-heart";
            }
        }

        toast("Removed from Wishlist", "info");
    }

    saveWishlist();

    updateBadges();

    renderWishlist();

    if (currentDetailProduct &&
        currentDetailProduct.id === id) {

        updateDetailWishlistIcon();
    }
}

function renderWishlist() {

    const list =
        document.getElementById("wishlistItemsList");

    if (!list) return;

    if (!wishlist.length) {

        list.innerHTML = `
            <p style="color:#777;text-align:center;padding:25px;">
                Your wishlist is empty.
            </p>
        `;

        return;
    }

    let html = "";

    wishlist.forEach(id => {

        const product =
            allProducts.find(p => p.id === id);

        if (!product) return;

        html += `
            <div class="cart-item">

                <img
                    src="${escapeHtml(product.image || "")}"
                    alt=""
                >

                <div class="cart-item-details">

                    <div class="cart-item-title">
                        ${escapeHtml(product.name)}
                    </div>

                    <div class="cart-item-price">
                        ${money(product.price)}
                    </div>

                    <button
                        onclick="openProductDetail('${product.id}')"
                        style="width:auto;padding:7px 12px;margin-top:7px;"
                    >
                        VIEW
                    </button>
                </div>

                <button
                    onclick="removeWishlist('${product.id}')"
                    style="background:none;border:0;color:#ff1744;"
                >
                    <i class="fa-solid fa-heart-crack"></i>
                </button>
            </div>
        `;
    });

    list.innerHTML = html;
}

function removeWishlist(id) {

    wishlist =
        wishlist.filter(item => item !== id);

    saveWishlist();

    renderWishlist();

    updateBadges();

    renderProducts(
        currentCategory === "ALL"
        ? allProducts
        : allProducts
    );
}

// ============================================================
// CART
// ============================================================

function addToCart(id, qty = 1, size = "") {

    const product =
        allProducts.find(p => p.id === id);

    if (!product) return;

    const stock = getStock(product, size);

    if (stock <= 0) {

        toast("This product is out of stock.", "error");

        return;
    }

    const existing =
        cart.find(item =>
            item.id === id &&
            (item.size || "") === (size || "")
        );

    if (existing) {

        if (existing.qty + qty > stock) {

            toast(
                `Only ${stock} item(s) available.`,
                "error"
            );

            return;
        }

        existing.qty += qty;

    } else {

        cart.push({
            ...product,
            qty: qty,
            size: size || ""
        });
    }

    saveCart();

    renderCart();

    updateBadges();

    animateAddButton(id);

    toast("🛍️ Added to Bag!");
}

function animateAddButton(id) {

    const button =
        document.getElementById(`addBtn-${id}`);

    if (!button) return;

    button.classList.add("added");

    const oldText = button.innerText;

    button.innerText = "✓ ADDED TO BAG";

    setTimeout(() => {

        button.classList.remove("added");

        button.innerText = oldText;

    }, 1200);
}

function renderCart() {

    const list =
        document.getElementById("cartItemsList");

    if (!list) return;

    if (!cart.length) {

        list.innerHTML = `
            <p style="color:#777;text-align:center;padding:35px 10px;">
                Your bag is empty.
            </p>
        `;

        updateCartTotals();

        return;
    }

    let html = "";

    cart.forEach((item, index) => {

        html += `
            <div class="cart-item">

                <img
                    src="${escapeHtml(item.image || "")}"
                    alt=""
                >

                <div class="cart-item-details">

                    <div class="cart-item-title">
                        ${escapeHtml(item.name || item.title)}
                    </div>

                    ${
                        item.size
                        ? `<small style="color:#777;">Size: ${escapeHtml(item.size)}</small>`
                        : ""
                    }

                    <div class="cart-item-price">
                        ${money(item.price)}
                    </div>

                    <div class="cart-qty-controls">

                        <button
                            class="cart-qty-btn"
                            onclick="changeCartQty(${index},-1)"
                        >
                            −
                        </button>

                        <strong>
                            ${item.qty || 1}
                        </strong>

                        <button
                            class="cart-qty-btn"
                            onclick="changeCartQty(${index},1)"
                        >
                            +
                        </button>
                    </div>
                </div>

                <button
                    onclick="removeFromCart(${index})"
                    style="background:none;border:0;color:#ff6b6b;"
                >
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    });

    list.innerHTML = html;

    updateCartTotals();
}

function changeCartQty(index, amount) {

    const item = cart[index];

    if (!item) return;

    const product =
        allProducts.find(p => p.id === item.id) || item;

    const stock =
        getStock(product, item.size || "");

    const next =
        (item.qty || 1) + amount;

    if (next < 1) {

        removeFromCart(index);

        return;
    }

    if (next > stock) {

        toast(
            `Only ${stock} item(s) available.`,
            "error"
        );

        return;
    }

    item.qty = next;

    saveCart();

    renderCart();

    updateBadges();
}

function removeFromCart(index) {

    cart.splice(index, 1);

    saveCart();

    renderCart();

    updateBadges();
}

function updateBadges() {

    const total =
        cart.reduce(
            (sum, item) =>
                sum + (Number(item.qty) || 1),
            0
        );

    const cartBadge =
        document.getElementById("menuCartCount");

    const bottomCount =
        document.getElementById("cartTotalItems");

    const wishBadge =
        document.getElementById("menuWishCount");

    if (cartBadge)
        cartBadge.innerText = total;

    if (bottomCount)
        bottomCount.innerText = total;

    if (wishBadge)
        wishBadge.innerText = wishlist.length;
}

// ============================================================
// CART TOTAL / COUPON
// ============================================================

function calculateCartSubtotal() {

    return cart.reduce(
        (sum, item) =>
            sum +
            Number(item.price || 0) *
            Number(item.qty || 1),
        0
    );
}

function calculateDiscount(subtotal) {

    if (!currentCoupon) return 0;

    if (currentCoupon.discountType === "flat") {

        return Math.min(
            subtotal,
            Number(
                currentCoupon.discountValue ||
                currentCoupon.discount ||
                0
            )
        );
    }

    const percent =
        Number(
            currentCoupon.discountPercent ||
            currentCoupon.discountValue ||
            currentCoupon.discount ||
            0
        );

    return Math.round(
        subtotal * percent / 100
    );
}

function calculateShipping(subtotalAfterDiscount) {

    return subtotalAfterDiscount >= 999
        ? 0
        : 99;
}

function updateCartTotals() {

    const subtotal =
        calculateCartSubtotal();

    const discount =
        calculateDiscount(subtotal);

    const afterDiscount =
        Math.max(0, subtotal - discount);

    const shipping =
        cart.length
        ? calculateShipping(afterDiscount)
        : 0;

    const total =
        afterDiscount + shipping;

    const subtotalEl =
        document.getElementById("cartSubtotal");

    const discountEl =
        document.getElementById("cartDiscount");

    const shippingEl =
        document.getElementById("cartShipping");

    const totalEl =
        document.getElementById("cartGrandTotal");

    if (subtotalEl)
        subtotalEl.innerText = money(subtotal);

    if (discountEl)
        discountEl.innerText = "-" + money(discount);

    if (shippingEl)
        shippingEl.innerText =
            shipping === 0
            ? "FREE"
            : money(shipping);

    if (totalEl)
        totalEl.innerText = money(total);
}

function applyCoupon(code) {

    code =
        String(code || "")
        .trim()
        .toUpperCase();

    if (!code) {

        toast("Enter coupon code.", "error");

        return false;
    }

    const coupon =
        availableCoupons[code];

    if (!coupon) {

        toast("Invalid coupon code.", "error");

        return false;
    }

    currentCoupon = {
        ...coupon,
        code: code
    };

    localStorage.setItem(
        "vornex_coupon",
        JSON.stringify(currentCoupon)
    );

    updateCartTotals();

    renderCheckoutSummary();

    toast(
        `Coupon ${code} applied successfully!`
    );

    return true;
}

function applyCouponFromCart() {

    const input =
        document.getElementById("cartCouponInput");

    if (!input) return;

    if (applyCoupon(input.value)) {

        document.getElementById(
            "cartAppliedCoupon"
        ).innerHTML = `
            <div class="applied-coupon">
                ✓ ${escapeHtml(input.value.toUpperCase())} applied
            </div>
        `;
    }
}

function applyCouponFromCheckout() {

    const input =
        document.getElementById("checkoutCoupon");

    if (!input) return;

    if (applyCoupon(input.value)) {

        document.getElementById(
            "checkoutCouponStatus"
        ).innerHTML = `
            <div class="applied-coupon">
                ✓ Coupon applied successfully
            </div>
        `;
    }
}

function restoreCoupon() {

    try {

        const saved =
            JSON.parse(
                localStorage.getItem("vornex_coupon")
            );

        if (saved && saved.code) {

            if (availableCoupons[saved.code]) {
                currentCoupon = saved;
            }
        }

    } catch (e) {
        currentCoupon = null;
    }
}

// ============================================================
// COUPONS FROM FIREBASE
// ============================================================

function loadCoupons() {

    db.ref("coupons").on("value", snapshot => {

        availableCoupons =
            snapshot.val() || {};

        restoreCoupon();

        renderCoupons();

        updateCartTotals();
    });
}

function renderCoupons() {

    const list =
        document.getElementById("couponsList");

    if (!list) return;

    const keys =
        Object.keys(availableCoupons);

    if (!keys.length) {

        list.innerHTML = `
            <p style="color:#777;text-align:center;padding:20px;">
                No active coupons available.
            </p>
        `;

        return;
    }

    let html = "";

    keys.forEach(code => {

        const coupon =
            availableCoupons[code];

        let text = "";

        if (
            coupon.discountType === "flat" ||
            coupon.type === "flat"
        ) {

            text =
                `₹${Number(
                    coupon.discountValue ||
                    coupon.discount ||
                    0
                )} OFF`;

        } else {

            text =
                `${Number(
                    coupon.discountPercent ||
                    coupon.discountValue ||
                    coupon.discount ||
                    0
                )}% OFF`;
        }

        html += `
            <div class="coupon-item" style="
                padding:15px;
                margin-top:10px;
                border:1px solid rgba(255,212,0,.2);
                border-radius:14px;
                background:rgba(255,255,255,.045);
            ">

                <strong style="color:#ffd400;">
                    ${escapeHtml(code)}
                </strong>

                <p style="
                    color:#aaa;
                    font-size:.72rem;
                    margin:6px 0;
                ">
                    ${text}
                </p>

                <button
                    onclick="useCoupon('${escapeHtml(code)}')"
                    style="
                        width:auto;
                        margin:0;
                        padding:7px 12px;
                        font-size:.68rem;
                    "
                >
                    USE COUPON
                </button>
            </div>
        `;
    });

    list.innerHTML = html;
}

function useCoupon(code) {

    if (applyCoupon(code)) {

        closeModalStepBack("couponsModal");

        openCartFromMenu();
    }
}

// ============================================================
// PRODUCT DETAIL
// ============================================================

function openProductDetail(id) {

    const product =
        allProducts.find(p => p.id === id);

    if (!product) return;

    currentDetailProduct = product;

    currentDetailQty = 1;

    currentDetailSize = "";

    const modal =
        document.getElementById("productDetailModal");

    renderProductDetail();

    modal.classList.add("active");

    document.body.classList.add("modal-open");

    history.pushState({
        product: id
    }, "");
}

function renderProductDetail() {

    const product =
        currentDetailProduct;

    if (!product) return;

    document.getElementById(
        "detailName"
    ).innerText =
        product.name || product.title || "VORNEX PRODUCT";

    document.getElementById(
        "detailPrice"
    ).innerText =
        money(product.price);

    document.getElementById(
        "detailCategory"
    ).innerText =
        product.category || "Streetwear";

    document.getElementById(
        "detailTag"
    ).innerText =
        product.tag || "NEW DROP";

    document.getElementById(
        "detailDescription"
    ).innerText =
        product.description ||
        product.details ||
        "Premium VORNEX streetwear designed for a bold oversized aesthetic.";

    const stock =
        getStock(product);

    document.getElementById(
        "detailAvailability"
    ).innerText =
        stock > 0
        ? `${stock} AVAILABLE`
        : "OUT OF STOCK";

    renderDetailSizes();

    renderDetailGallery();

    updateDetailQty();

    updateDetailWishlistIcon();
}

function renderDetailSizes() {

    const container =
        document.getElementById("detailSizes");

    if (!container) return;

    const stocks =
        currentDetailProduct.sizeStocks || {};

    const sizes =
        Object.keys(stocks).length
        ? Object.keys(stocks)
        : ["S","M","L","XL","XXL"];

    let html = "";

    sizes.forEach(size => {

        const stock =
            Number(stocks[size] || 0);

        html += `
            <button
                class="size-choice ${currentDetailSize === size ? "active" : ""}"
                onclick="selectDetailSize('${escapeHtml(size)}')"
                ${stock <= 0 ? "disabled" : ""}
                style="${stock <= 0 ? "opacity:.35;" : ""}"
            >
                ${escapeHtml(size)}
            </button>
        `;
    });

    container.innerHTML = html;

    if (!currentDetailSize) {

        const first =
            sizes.find(size =>
                Number(stocks[size] || 0) > 0
            );

        if (first) {
            currentDetailSize = first;

            renderDetailSizes();
        }
    }
}

function selectDetailSize(size) {

    currentDetailSize = size;

    currentDetailQty = 1;

    renderDetailSizes();

    updateDetailQty();
}

function changeDetailQty(amount) {

    if (!currentDetailProduct) return;

    const stock =
        getStock(
            currentDetailProduct,
            currentDetailSize
        );

    let next =
        currentDetailQty + amount;

    if (next < 1) next = 1;

    if (next > stock) {

        toast(
            `Only ${stock} available.`,
            "error"
        );

        return;
    }

    currentDetailQty = next;

    updateDetailQty();
}

function updateDetailQty() {

    const element =
        document.getElementById("detailQty");

    if (element)
        element.innerText =
            currentDetailQty;
}

function renderDetailGallery() {

    const product =
        currentDetailProduct;

    const images = [];

    if (product.image)
        images.push(product.image);

    if (product.imageBack)
        images.push(product.imageBack);

    if (!images.length) {

        images.push(
            "https://via.placeholder.com/800x1000"
        );
    }

    const track =
        document.getElementById("detailTrack");

    const dots =
        document.getElementById("detailDots");

    track.innerHTML =
        images.map(image => `
            <div class="detail-slide">
                <img src="${escapeHtml(image)}" alt="">
            </div>
        `).join("");

    dots.innerHTML =
        images.map((_, index) =>
            `<span class="${index === 0 ? "active" : ""}"></span>`
        ).join("");

    window.detailImages = images;

    window.detailImageIndex = 0;
}

function moveDetailImage(direction) {

    const images =
        window.detailImages || [];

    if (images.length <= 1) return;

    window.detailImageIndex += direction;

    if (window.detailImageIndex < 0)
        window.detailImageIndex = images.length - 1;

    if (window.detailImageIndex >= images.length)
        window.detailImageIndex = 0;

    const track =
        document.getElementById("detailTrack");

    track.style.transform =
        `translateX(-${window.detailImageIndex * 100}%)`;

    document
        .querySelectorAll("#detailDots span")
        .forEach((dot,index) => {

            dot.classList.toggle(
                "active",
                index === window.detailImageIndex
            );
        });
}

function setupSwipeEvents() {

    const gallery =
        document.getElementById("detailGallery");

    if (!gallery) return;

    let startX = 0;
    let startY = 0;

    gallery.addEventListener("touchstart", event => {

        const touch = event.changedTouches[0];

        startX = touch.clientX;
        startY = touch.clientY;
    }, {passive:true});

    gallery.addEventListener("touchend", event => {

        const touch = event.changedTouches[0];

        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        if (Math.abs(dx) > 45 &&
            Math.abs(dx) > Math.abs(dy)) {

            moveDetailImage(
                dx < 0 ? 1 : -1
            );
        }
    }, {passive:true});
}

function addDetailToCart() {

    if (!currentDetailProduct) return;

    const stock =
        getStock(
            currentDetailProduct,
            currentDetailSize
        );

    if (!stock) {

        toast("Out of stock.", "error");

        return;
    }

    addToCart(
        currentDetailProduct.id,
        currentDetailQty,
        currentDetailSize
    );

    const button =
        document.getElementById("detailCartBtn");

    button.classList.add("cart-active");

    setTimeout(() =>
        button.classList.remove("cart-active"),
        1000
    );
}

function buyDetailNow() {

    if (!currentDetailProduct) return;

    const stock =
        getStock(
            currentDetailProduct,
            currentDetailSize
        );

    if (!stock) {

        toast("Out of stock.", "error");

        return;
    }

    addToCart(
        currentDetailProduct.id,
        currentDetailQty,
        currentDetailSize
    );

    const button =
        document.getElementById("detailBuyBtn");

    button.classList.add("buy-active");

    setTimeout(() =>
        button.classList.remove("buy-active"),
        800
    );

    closeProductDetail();

    setTimeout(() => {
        openCheckoutModal();
    }, 200);
}

function toggleDetailWishlist() {

    if (!currentDetailProduct) return;

    toggleWishlist(
        currentDetailProduct.id
    );
}

function updateDetailWishlistIcon() {

    if (!currentDetailProduct) return;

    const icon =
        document.getElementById("detailWishIcon");

    if (!icon) return;

    const liked =
        wishlist.includes(
            currentDetailProduct.id
        );

    icon.className =
        liked
        ? "fa-solid fa-heart"
        : "fa-regular fa-heart";

    icon.style.color =
        liked ? "#ff1744" : "";
}

function closeProductDetail(goBack = true) {

    const modal =
        document.getElementById("productDetailModal");

    modal.classList.remove("active");

    document.body.classList.remove("modal-open");

    currentDetailProduct = null;

    if (goBack) {
        try {
            history.back();
        } catch (e) {}
    }
}

// ============================================================
// CHECKOUT
// ============================================================

function openCheckoutModal() {

    if (!cart.length) {

        toast("Your bag is empty.", "error");

        return;
    }

    closeCartDrawer();

    renderCheckoutSummary();

    openModal("checkoutModal");
}

function renderCheckoutSummary() {

    const list =
        document.getElementById("checkoutItems");

    if (!list) return;

    let html = "";

    cart.forEach(item => {

        html += `
            <div class="checkout-item-line">

                <span>
                    ${escapeHtml(item.name)}
                    × ${item.qty || 1}
                    ${item.size ? ` (${escapeHtml(item.size)})` : ""}
                </span>

                <strong>
                    ${money(
                        Number(item.price || 0) *
                        Number(item.qty || 1)
                    )}
                </strong>
            </div>
        `;
    });

    list.innerHTML = html;

    const subtotal =
        calculateCartSubtotal();

    const discount =
        calculateDiscount(subtotal);

    const after =
        subtotal - discount;

    const shipping =
        calculateShipping(after);

    const total =
        after + shipping;

    document.getElementById(
        "checkoutTotal"
    ).innerText = money(total);
}

// ============================================================
// PINCODE
// ============================================================

let pincodeTimer = null;

function lookupPincode(value) {

    clearTimeout(pincodeTimer);

    value = String(value).replace(/\D/g,"");

    if (value.length !== 6) return;

    pincodeTimer = setTimeout(async () => {

        try {

            const response =
                await fetch(
                    `https://api.postalpincode.in/pincode/${value}`
                );

            const result =
                await response.json();

            if (
                result &&
                result[0] &&
                result[0].Status === "Success"
            ) {

                const post =
                    result[0].PostOffice[0];

                document.getElementById(
                    "custCity"
                ).value =
                    post.District ||
                    post.Block ||
                    post.Name ||
                    "";

                document.getElementById(
                    "custState"
                ).value =
                    post.State || "";

                toast("Location found.");
            }

        } catch (error) {

            console.warn(
                "Pincode lookup failed",
                error
            );
        }

    }, 400);
}

// ============================================================
// ORDER
// ============================================================

async function submitOrder(event) {

    event.preventDefault();

    if (!cart.length) {

        toast("Your bag is empty.", "error");

        return;
    }

    const name =
        document.getElementById("custName").value.trim();

    const phone =
        document.getElementById("custPhone").value.trim();

    const pincode =
        document.getElementById("custPincode").value.trim();

    const city =
        document.getElementById("custCity").value.trim();

    const state =
        document.getElementById("custState").value.trim();

    const address =
        document.getElementById("custAddress").value.trim();

    if (!/^[0-9]{10}$/.test(phone)) {

        toast(
            "Enter valid 10 digit phone number.",
            "error"
        );

        return;
    }

    if (!/^[0-9]{6}$/.test(pincode)) {

        toast(
            "Enter valid 6 digit pincode.",
            "error"
        );

        return;
    }

    const subtotal =
        calculateCartSubtotal();

    const discount =
        calculateDiscount(subtotal);

    const afterDiscount =
        Math.max(0, subtotal - discount);

    const shipping =
        calculateShipping(afterDiscount);

    const total =
        afterDiscount + shipping;

    const orderId =
        "VNX" +
        Date.now().toString().slice(-8);

    const items =
        cart.map(item => ({
            productId: item.id,
            name: item.name || item.title,
            price: Number(item.price || 0),
            qty: Number(item.qty || 1),
            size: item.size || "",
            image: item.image || ""
        }));

    const orderData = {

        orderId: orderId,

        customer: {
            name: name,
            phone: phone,
            address: address,
            pincode: pincode,
            city: city,
            state: state
        },

        items: items,

        subtotal: subtotal,
        discount: discount,
        shipping: shipping,
        total: total,

        coupon: currentCoupon
            ? {
                code: currentCoupon.code,
                discountType:
                    currentCoupon.discountType ||
                    "percent"
            }
            : null,

        status: "PENDING",

        paymentStatus: "COD / WHATSAPP",

        createdAt:
            firebase.database.ServerValue.TIMESTAMP
    };

    try {

        await db
            .ref("orders")
            .child(orderId)
            .set(orderData);

    } catch (error) {

        console.error(error);

        toast(
            "Order save failed. Please try again.",
            "error"
        );

        return;
    }

    let itemsText = "";

    items.forEach(item => {

        itemsText +=
            `• ${item.name} | Qty: ${item.qty}` +
            `${item.size ? ` | Size: ${item.size}` : ""}` +
            ` | ${money(item.price * item.qty)}\n`;
    });

    const message =
`⚡ *NEW VORNEX ORDER* ⚡

*ORDER ID:* ${orderId}

*CUSTOMER DETAILS*
Name: ${name}
Phone: ${phone}

*DELIVERY ADDRESS*
${address}
City/Village: ${city}
State: ${state}
Pincode: ${pincode}

*ORDERED ITEMS*
${itemsText}
*SUBTOTAL:* ${money(subtotal)}
*DISCOUNT:* -${money(discount)}
*SHIPPING:* ${shipping === 0 ? "FREE" : money(shipping)}
*TOTAL:* ${money(total)}

${currentCoupon ? `Coupon: ${currentCoupon.code}\n` : ""}
Payment: COD / WhatsApp

Thank you for shopping with VORNEX.`;

    const waUrl =
        `https://wa.me/${WHATSAPP_NUMBER}?text=` +
        encodeURIComponent(message);

    localStorage.setItem(
        "vornex_last_order",
        JSON.stringify(orderData)
    );

    cart = [];

    saveCart();

    currentCoupon = null;

    localStorage.removeItem(
        "vornex_coupon"
    );

    renderCart();

    updateBadges();

    closeModalStepBack(
        "checkoutModal"
    );

    toast(
        `Order ${orderId} created successfully!`
    );

    setTimeout(() => {

        window.open(
            waUrl,
            "_blank"
        );

    }, 300);
}

// ============================================================
// ACCOUNT / AUTH
// ============================================================

function observeAuth() {

    auth.onAuthStateChanged(user => {

        updateAccountUI(user);

        if (user) {
            loadOrderHistory(user);
        }
    });
}

function openAccountPanel() {

    toggleMenuDrawer(false);

    updateAccountUI(auth.currentUser);

    openModal("accountModal");
}

function updateAccountUI(user) {

    const content =
        document.getElementById("accountContent");

    if (!content) return;

    if (!user) {

        content.innerHTML = `
            <div style="text-align:center;padding:15px;">
                <i class="fa-solid fa-user-circle"
                   style="font-size:55px;color:#555;"></i>

                <h3 style="margin-top:12px;">
                    Guest Customer
                </h3>

                <p style="color:#777;font-size:.75rem;margin:8px 0 18px;">
                    Login to save your account and orders.
                </p>

                <button
                    onclick="closeModalStepBack('accountModal');openLoginPanel();"
                >
                    LOGIN
                </button>
            </div>
        `;

        return;
    }

    content.innerHTML = `
        <div style="text-align:center;padding:15px;">

            ${
                user.photoURL
                ? `<img src="${escapeHtml(user.photoURL)}"
                        style="width:70px;height:70px;border-radius:50%;object-fit:cover;">`
                : `<i class="fa-solid fa-user-circle"
                     style="font-size:65px;color:#555;"></i>`
            }

            <h3 style="margin-top:12px;">
                ${escapeHtml(user.displayName || "VORNEX Customer")}
            </h3>

            <p style="color:#888;font-size:.72rem;">
                ${escapeHtml(user.phoneNumber || user.email || "")}
            </p>

            <button
                onclick="openOrderHistory()"
                style="margin-top:15px;"
            >
                YOUR ORDERS
            </button>

            <button
                onclick="logoutVornex()"
                style="
                    background:#ef4444;
                    color:#fff;
                    margin-top:8px;
                "
            >
                LOGOUT
            </button>
        </div>
    `;
}

function openLoginPanel() {

    toggleMenuDrawer(false);

    openModal("loginModal");
}

function showPhoneLogin() {

    document.getElementById(
        "phoneLoginBox"
    ).style.display = "block";

    setTimeout(() => {

        if (
            window.recaptchaVerifier === undefined
        ) {

            window.recaptchaVerifier =
                new firebase.auth.RecaptchaVerifier(
                    "recaptcha-container",
                    {
                        size: "invisible"
                    }
                );
        }

    }, 100);
}

async function sendPhoneOTP() {

    const phone =
        document.getElementById(
            "loginPhone"
        ).value.trim();

    if (!/^[0-9]{10}$/.test(phone)) {

        toast(
            "Enter valid 10 digit number.",
            "error"
        );

        return;
    }

    try {

        if (!window.recaptchaVerifier) {

            window.recaptchaVerifier =
                new firebase.auth.RecaptchaVerifier(
                    "recaptcha-container",
                    {
                        size: "invisible"
                    }
                );
        }

        confirmationResult =
            await auth.signInWithPhoneNumber(
                "+91" + phone,
                window.recaptchaVerifier
            );

        document.getElementById(
            "phoneOtpBox"
        ).style.display = "block";

        toast("OTP sent successfully.");

    } catch (error) {

        console.error(error);

        toast(
            error.message ||
            "Unable to send OTP.",
            "error"
        );

        if (window.recaptchaVerifier) {

            try {
                window.recaptchaVerifier.clear();
            } catch(e) {}

            window.recaptchaVerifier = null;
        }
    }
}

async function verifyPhoneOTP() {

    const otp =
        document.getElementById(
            "phoneOtp"
        ).value.trim();

    if (!/^[0-9]{6}$/.test(otp)) {

        toast(
            "Enter valid 6 digit OTP.",
            "error"
        );

        return;
    }

    if (!confirmationResult) {

        toast(
            "Please request OTP first.",
            "error"
        );

        return;
    }

    try {

        await confirmationResult.confirm(otp);

        toast(
            "Login successful!"
        );

        closeModalStepBack(
            "loginModal"
        );

    } catch (error) {

        console.error(error);

        toast(
            "Incorrect OTP.",
            "error"
        );
    }
}

async function loginViaGoogle() {

    try {

        const provider =
            new firebase.auth.GoogleAuthProvider();

        await auth.signInWithPopup(provider);

        toast(
            "Google login successful!"
        );

        closeModalStepBack(
            "loginModal"
        );

    } catch (error) {

        console.error(error);

        toast(
            error.message ||
            "Google login failed.",
            "error"
        );
    }
}

async function logoutVornex() {

    try {

        await auth.signOut();

        toast(
            "Logged out successfully.",
            "info"
        );

        closeModalStepBack(
            "accountModal"
        );

    } catch (error) {

        console.error(error);
    }
}

// ============================================================
// ORDER HISTORY
// ============================================================

function openOrderHistory() {

    toggleMenuDrawer(false);

    openModal("ordersModal");

    const user = auth.currentUser;

    if (!user) {

        document.getElementById(
            "orderHistoryList"
        ).innerHTML = `
            <p style="color:#777;text-align:center;padding:20px;">
                Please login first to view your orders.
            </p>
        `;

        return;
    }

    loadOrderHistory(user);
}

function loadOrderHistory(user) {

    const list =
        document.getElementById(
            "orderHistoryList"
        );

    if (!list) return;

    db.ref("orders")
        .orderByChild("customer/phone")
        .equalTo(
            user.phoneNumber
            ? user.phoneNumber.replace("+91","")
            : ""
        )
        .once("value")
        .then(snapshot => {

            const data =
                snapshot.val() || {};

            const keys =
                Object.keys(data);

            if (!keys.length) {

                list.innerHTML = `
                    <p style="color:#777;text-align:center;padding:20px;">
                        No orders found.
                    </p>
                `;

                return;
            }

            let html = "";

            keys.reverse().forEach(key => {

                const order =
                    data[key];

                html += `
                    <div style="
                        padding:14px;
                        margin-bottom:10px;
                        border-radius:14px;
                        background:rgba(255,255,255,.05);
                        border:1px solid rgba(255,255,255,.08);
                    ">

                        <strong>
                            ${escapeHtml(order.orderId || key)}
                        </strong>

                        <p style="font-size:.72rem;color:#888;margin:7px 0;">
                            ${escapeHtml(order.status || "PENDING")}
                        </p>

                        <strong style="color:#ffd400;">
                            ${money(order.total)}
                        </strong>
                    </div>
                `;
            });

            list.innerHTML = html;

        })
        .catch(error => {

            console.error(error);

            list.innerHTML = `
                <p style="color:#ef4444;">
                    Unable to load orders.
                </p>
            `;
        });
}

function openOrderTracking() {

    const last =
        JSON.parse(
            localStorage.getItem(
                "vornex_last_order"
            ) || "null"
        );

    if (last && last.orderId) {

        toast(
            `Last Order ID: ${last.orderId}`,
            "info"
        );

    } else {

        toast(
            "No recent order found.",
            "info"
        );
    }
}

// ============================================================
// HERO MEDIA
// ============================================================

function loadHeroMedia() {

    db.ref("media/heroConfig").on("value", snapshot => {
        const config = snapshot.val() || {};
        const tag = document.getElementById("heroTag");
        const title = document.getElementById("heroTitle");
        const subtitle = document.getElementById("heroSubtitle");
        const button = document.getElementById("heroButton");
        const layer = document.getElementById("heroMediaLayer");

        if (tag) tag.textContent = config.tag || "NEW DROP 2026";
        if (title) {
            const text = String(config.title || "OVERSIZED\nCOLLECTION");
            title.textContent = "";
            text.split(/\r?\n/).forEach((line,index)=>{
                if(index) title.appendChild(document.createElement("br"));
                title.appendChild(document.createTextNode(line));
            });
        }
        if (subtitle) subtitle.textContent = config.subtitle || "Premium Streetwear • 240 GSM French Terry Cotton";
        if (button) {
            button.textContent = config.buttonText || "EXPLORE NOW";
            button.href = config.buttonLink || "#storeGrid";
        }
        if (layer && config.backgroundImage) {
            layer.innerHTML = "";
            const img = document.createElement("img");
            img.src = config.backgroundImage;
            img.alt = "VORNEX Hero";
            layer.appendChild(img);
        }
    });

}

// ============================================================
// BACKWARD COMPATIBILITY
// ============================================================

function openQuickOrderModal() {
    openCartFromMenu();
}

// ============================================================
// END
// ============================================================

// V6 TOP TEXT: third text support
function bindVornexTopTextV6(){
    if(typeof db==='undefined'||!db) return;
    db.ref('media/topTextConfig').on('value',function(snap){
        const c=snap.val()||{};
        const bar=document.getElementById('announcementBar');
        const track=document.getElementById('announcementTrack');
        if(!bar||!track)return;
        const a=c.text||'⚡ FREE EXPRESS SHIPPING ON ORDERS ABOVE ₹999 | UPTO 20% OFF ON COUPONS ⚡';
        const b=c.secondaryText||'🔥 NEW DROP IS LIVE — SHOP NOW 🔥';
        const d=c.tertiaryText||'✨ FREE SHIPPING • PREMIUM STREETWEAR ✨';
        track.innerHTML=[a,b,d,a,b,d].map(function(t){return '<span class="announcement-item">'+escapeHtml(t)+'</span>';}).join('');
        bar.style.fontFamily=c.fontFamily||'Montserrat';
        bar.style.fontSize=c.fontSize||'10px';
        bar.style.setProperty('--announcement-speed',(Number(c.speed)||28)+'s');
    });
}
