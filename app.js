AUTH_STATE.mode = mode === 'signup' ? 'signup' : 'user-login'; renderAuth()
}

// renderAuth: สร้างหน้าล็อกอิน/สมัครสมาชิกและผูก form
function renderAuth(message, error) {
  var signup = AUTH_STATE.mode === 'signup', title = signup ? 'สมัครสมาชิกผู้ใช้ทั่วไป' : 'เข้าสู่ระบบ FishGrow', submit = signup ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ', notice = error ? '<div class="auth-message error">' + esc(error) + '</div>' : message ? '<div class="auth-message">' + esc(message) + '</div>' : '';
  document.getElementById('app').innerHTML = '<div class="auth-shell"><div class="auth-brand"><div class="brand-mark"><img src="assets/logo.png" alt="FISHGROW"></div><h1>FISHGROW</h1><p class="eyebrow">SMART FEED MANAGEMENT</p><div class="auth-points"></div></div><div class="auth-card"><div class="auth-tabs"><button class="' + (AUTH_STATE.mode === 'user-login' ? 'active' : '') + '" onclick="authMode(\'user-login\')">เข้าสู่ระบบ</button><button class="' + (signup ? 'active' : '') + '" onclick="authMode(\'signup\')">สมัครสมาชิก</button></div><div class="auth-heading"><span class="badge">FISHGROW ACCOUNT</span><h2>' + title + '</h2><p>' + (signup ? 'สร้างบัญชีเพื่อใช้งานหน้าเว็บใหม่' : 'เข้าสู่ระบบเพื่อสั่งซื้อและติดตามคำสั่งซื้อ') + '</p></div>' + notice + '<form id="auth-form" class="auth-form">' + (signup ? '<div class="field"><label>ชื่อ-นามสกุล</label><input name="full_name" autocomplete="name" required></div>' : '') + '<div class="field"><label>อีเมล</label><input name="email" type="email" autocomplete="email" required></div>' + (signup ? '<div class="field"><label>เบอร์โทรศัพท์</label><input name="phone" autocomplete="tel"></div>' : '') + '<div class="field"><label>รหัสผ่าน</label><input name="password" type="password" minlength="6" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" required></div><button class="btn green auth-submit" type="submit">' + submit + '</button></form><p class="auth-footnote">' + (signup ? 'สมัครแล้วอาจต้องยืนยันอีเมลก่อนเข้าสู่ระบบ' : 'ระบบจะตรวจสิทธิ์ User/Admin จากข้อมูลบัญชีอัตโนมัติ') + '</p></div></div>';
  document.getElementById('auth-form').onsubmit = handleAuthSubmit
}

// handleAuthSubmit: จัดการสมัครสมาชิกและ Login พร้อมตรวจ role
async function handleAuthSubmit(event) {
  event.preventDefault(); var form = event.currentTarget, values = Object.fromEntries(new FormData(form).entries()), button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'กำลังตรวจสอบ...'; try {
    if (AUTH_STATE.mode === 'signup') {
      var signUp = await window.fishgrowSupabase.auth.signUp({ email: values.email, password: values.password, options: { data: { full_name: values.full_name || '', phone: values.phone || '' } } }); if (signUp.error) throw signUp.error; if (!signUp.data.session) { renderAuth('สมัครสมาชิกสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'); return } await bootstrapAuth(); return
    }
    var signIn = await window.fishgrowSupabase.auth.signInWithPassword({ email: values.email, password: values.password }); if (signIn.error) throw signIn.error; await hydrateProfile(signIn.data.user); await finishLogin()
  } catch (error) { renderAuth('', error.message || 'ไม่สามารถเข้าสู่ระบบได้') }
}

// finishLogin: เตรียมข้อมูลหลัง Login แยกตาม role
async function finishLogin() {
  USER_CART = {};
  if (AUTH_STATE.profile.role === 'admin') { await loadAdminStoreProducts(); await loadAdminBusinessData(); await loadAdminWebOrders(); await loadAdminStoreStock(); S.page = S.page.indexOf('user-') === 0 ? 'dashboard' : S.page }
  else { window.location.replace('/#home'); return }
  render()
}

// bootstrapAuth: ตรวจ session ปัจจุบันและเริ่มระบบ
async function bootstrapAuth() {
  if (!window.fishgrowSupabase) { renderAuth('', 'ไม่พบการเชื่อมต่อ Supabase'); return }
  var result = await window.fishgrowSupabase.auth.getUser(); if (result.error || !result.data.user) { currentUser = null; AUTH_STATE.profile = null; renderAuth(); return }
  try { await hydrateProfile(result.data.user); await finishLogin() } catch (error) { await window.fishgrowSupabase.auth.signOut(); currentUser = null; AUTH_STATE.profile = null; renderAuth('', error.message || 'ไม่สามารถโหลดโปรไฟล์ได้') }
}

// signOutUser: ออกจากระบบผ่าน Supabase Auth
async function signOutUser() {
  await window.fishgrowSupabase.auth.signOut()
}

// updateProfile: บันทึกข้อมูล profile ของ User
async function updateProfile() {
  var fullName = document.getElementById('profile-name').value.trim(), phone = document.getElementById('profile-phone').value.trim(); if (!fullName) { toast('กรุณาระบุชื่อ-นามสกุล'); return }
  try { var result = await window.fishgrowSupabase.from('profiles').update({ full_name: fullName, phone: phone }).eq('id', currentUser.id).select('id,full_name,email,phone,role').single(); if (result.error) throw result.error; AUTH_STATE.profile = result.data; render(); toast('อัปเดตโปรไฟล์แล้ว') } catch (error) { toast('บันทึกโปรไฟล์ไม่สำเร็จ: ' + (error.message || 'กรุณาลองใหม่')) }
}

async function loadStorefront() {
  var p = await window.fishgrowSupabase.from('store_products').select('product_id,sku,name,stock,price,image_url,is_available').eq('is_available', true).order('name'); if (p.error) throw p.error; USER_PRODUCTS = p.data || []; var o = await window.fishgrowSupabase.from('store_orders').select('id,customer_name,phone,delivery_address,note,status,total_amount,items,created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }); if (o.error) throw o.error; USER_ORDERS = o.data || []
}

// loadAdminWebOrders: โหลดคำสั่งซื้อออนไลน์สำหรับ Admin
async function loadAdminWebOrders() {
  var r = await window.fishgrowSupabase.from('store_orders').select('id,customer_name,status,total_amount,created_at,items,payment_status,payment_method,payment_proof_path,tracking_number').order('created_at', { ascending: false }).limit(100); if (r.error) {
    console.warn('โหลดคำสั่งซื้อออนไลน์ไม่สำเร็จ', r.error); ADMIN_WEB_ORDERS = []; return
  }
  ADMIN_WEB_ORDERS = (r.data || []).map(function (o) {
    o.order_code = 'FGW-' + String(o.id).padStart(6, '0'); return o
  })
}

// updateStorePaymentStatus: Admin ตรวจสอบสถานะการชำระเงิน
async function updateStorePaymentStatus(orderId, status) {
  if (['pending', 'submitted', 'verified', 'rejected'].indexOf(status) < 0) return;
  var r = await window.fishgrowSupabase.from('store_orders').update({ payment_status: status }).eq('id', Number(orderId)).select('id,payment_status').maybeSingle();
  if (r.error || !r.data) { toast('อัปเดตสถานะการชำระเงินไม่สำเร็จ'); return }
  await loadAdminWebOrders(); render(); toast('อัปเดตสถานะการชำระเงินแล้ว')
}

// viewPaymentProof: สร้างลิงก์ชั่วคราวสำหรับ Admin ดูหลักฐาน
async function viewPaymentProof(path) {
  var r = await window.fishgrowSupabase.storage.from('payment-proofs').createSignedUrl(path, 300);
  if (r.error || !r.data) { toast('เปิดหลักฐานไม่สำเร็จ'); return }
  window.open(r.data.signedUrl, '_blank', 'noopener,noreferrer')
}

// updateStoreTracking: Admin บันทึกเลขติดตามพัสดุ
async function updateStoreTracking(orderId) {
  var tracking = window.prompt('กรอกเลข Tracking ของคำสั่งซื้อ');
  if (tracking === null) return;
  tracking = tracking.trim();
  var r = await window.fishgrowSupabase.from('store_orders').update({ tracking_number: tracking || null }).eq('id', Number(orderId)).select('id,tracking_number').maybeSingle();
  if (r.error || !r.data) { toast('บันทึก Tracking ไม่สำเร็จ'); return }
  await loadAdminWebOrders(); render(); toast('บันทึก Tracking แล้ว')
}
// refreshAdminOrders: รีเฟรชคำสั่งซื้อออนไลน์
async function refreshAdminOrders() {
  await loadAdminWebOrders(); render()
}

// loadAdminStoreStock: โหลดสต็อกจากหน้าร้านเข้า state Admin
async function loadAdminStoreStock() {
  var r = await window.fishgrowSupabase.from('store_products').select('product_id,stock'); if (r.error) {
    console.warn('โหลดสต็อกหน้าร้านไม่สำเร็จ', r.error); return
  }
  var stockById = {}; (r.data || []).forEach(function (p) {
    stockById[String(p.product_id)] = Number(p.stock)
  }); (S.products || []).forEach(function (p) {
    if (Object.prototype.hasOwnProperty.call(stockById, String(p.id))) p.stock = stockById[String(p.id)]
  })
}

// businessOrders: รวมคำสั่งซื้อจาก state เดิมและหน้าร้านออนไลน์
function businessOrders() {
  return (S.orders || []).concat(ADMIN_WEB_ORDERS.map(function (o) {
    return { id: o.order_code, storeOrderId: o.id, customer: o.customer_name, date: new Date(o.created_at).toLocaleDateString('th-TH'), created_at: o.created_at, amount: Number(o.total_amount), status: o.status, paymentStatus: o.payment_status, items: Array.isArray(o.items) ? o.items : [] }
  }))
}

// isRecognizedOrder: ตรวจคำสั่งซื้อที่นับเป็นรายรับแล้ว
function isRecognizedOrder(o) {
  return o.status !== 'ยกเลิก' && o.status !== 'cancelled' && (o.paymentStatus === 'verified' || o.status === 'ชำระแล้ว' || o.status === 'เสร็จสิ้น' || o.status === 'completed')
}

// isPendingOrder: ตรวจคำสั่งซื้อที่ยังรอดำเนินการ
function isPendingOrder(o) {
  return o.status !== 'ยกเลิก' && o.status !== 'cancelled' && !isRecognizedOrder(o)
}

// recognizedIncome: รวมรายรับที่รับรู้แล้ว
function recognizedIncome() {
  return businessOrders().filter(isRecognizedOrder).reduce(function (a, o) {
    return a + Number(o.amount || 0)
  }, 0)
}

// pendingOrderValue: รวมมูลค่าออเดอร์ที่ยังรอ
function pendingOrderValue() {
  return businessOrders().filter(isPendingOrder).reduce(function (a, o) {
    return a + Number(o.amount || 0)
  }, 0)
}
function cartCount() {
  return Object.keys(USER_CART).reduce(function (n, id) {
    return n + USER_CART[id]
  }, 0)
}

// adjustCart: เพิ่ม/ลดสินค้าในตะกร้าโดยไม่เกินสต็อก
function adjustCart(id, delta) {
  var p = USER_PRODUCTS.find(function (x) {
    return String(x.product_id) === String(id)
  }); if (!p) return; var next = (USER_CART[id] || 0) + delta; if (next <= 0) delete USER_CART[id]; else if (next <= Number(p.stock)) USER_CART[id] = next; render()
}

// submitStoreOrder: ส่งคำสั่งซื้อของ User ไปยัง Supabase
async function submitStoreOrder(event) {
  event.preventDefault(); var form = event.currentTarget, button = form.querySelector('button[type=submit]'), values = Object.fromEntries(new FormData(form).entries()), items = Object.keys(USER_CART).map(function (id) {
    return { product_id: Number(id), quantity: USER_CART[id] }
  }); if (!items.length) {
    toast('กรุณาเลือกสินค้า'); return
  }
  button.disabled = true; button.textContent = 'กำลังส่งคำสั่งซื้อ...'; var result; try {
    result = await window.fishgrowSupabase.from('store_orders').insert({ user_id: currentUser.id, customer_name: values.customer_name, phone: values.phone, delivery_address: values.delivery_address, note: values.note || '', items: items }).select('id').single()
  } catch (error) {
    result = { error: error }
  }
  if (result.error) {
    toast('ส่งคำสั่งซื้อไม่สำเร็จ: ' + (result.error.message || 'กรุณาลองใหม่')); button.disabled = false; button.textContent = 'ยืนยันคำสั่งซื้อ'; return
  }
  USER_CART = {}; S.page = 'user-orders'; try {
    await loadStorefront(); render(); toast('ส่งคำสั่งซื้อเรียบร้อยแล้ว')
  } catch (error) {
    render(); toast('รับคำสั่งซื้อแล้ว แต่โหลดประวัติไม่สำเร็จ: ' + (error.message || 'กรุณากดรีเฟรช'))
  }
}
function userShop() {
  var cartHtml = Object.keys(USER_CART).length ? Object.keys(USER_CART).map(function (id) {
    var p = USER_PRODUCTS.find(function (x) {
      return String(x.product_id) === String(id)
    }); return p ? '<div class="cart-line"><span>' + esc(p.name) + ' × ' + USER_CART[id] + ' kg</span><b>฿' + money(p.price * USER_CART[id]) + '</b></div>' : ''
  }).join('') : '<p class="muted">ยังไม่มีสินค้าในตะกร้า</p>'; var total = Object.keys(USER_CART).reduce(function (n, id) {
    var p = USER_PRODUCTS.find(function (x) {
      return String(x.product_id) === String(id)
    }); return n + (p ? p.price * USER_CART[id] : 0)
  }, 0); return '<div class="page-head"><div><h2>เลือกซื้อสินค้า</h2><p>อาหารปลากะพงขาว FISHGROW สั่งซื้อได้จากบัญชีของคุณ</p></div><span class="badge">' + cartCount() + ' รายการในตะกร้า</span></div><div class="store-grid">' + (USER_PRODUCTS.length ? USER_PRODUCTS.map(function (p) {
    var qty = USER_CART[p.product_id] || 0, inStock = Number(p.stock) > 0; return '<article class="card product-card"><div class="product-mark">' + (safeImageUrl(p.image_url) ? '<img src="' + esc(safeImageUrl(p.image_url)) + '" alt="' + esc(p.name) + '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\'"><span style="display:none">รูปภาพไม่พร้อม</span>' : '🐟') + '</div><span class="badge ' + (inStock ? '' : 'warn') + '">' + (inStock ? 'พร้อมจำหน่าย' : 'สินค้าหมด') + '</span><h3>' + esc(p.name) + '</h3><p class="muted">รหัส ' + esc(p.sku) + '</p><div class="product-price">฿' + money(p.price) + ' <small>/ kg</small></div><div class="product-buy"><button class="btn light" onclick="adjustCart(' + p.product_id + ',-1)" ' + (!qty ? 'disabled' : '') + '>−</button><b>' + qty + '</b><button class="btn light" onclick="adjustCart(' + p.product_id + ',1)" ' + (qty >= p.stock ? 'disabled' : '') + '>+</button><button class="btn green" onclick="adjustCart(' + p.product_id + ',1)" ' + (qty >= p.stock ? 'disabled' : '') + '>ใส่ตะกร้า</button></div></article>'
  }).join('') : '<div class="card">ยังไม่มีสินค้าเปิดขาย กรุณาติดต่อผู้ดูแล</div>') + '</div><div class="card checkout-card"><div class="section-title"><h3>ตะกร้าสินค้า</h3><b>รวม ฿' + money(total) + '</b></div>' + cartHtml + (cartCount() ? '<form class="checkout-form" onsubmit="submitStoreOrder(event)"><div class="form-grid"><div class="field"><label>ชื่อผู้รับ</label><input name="customer_name" value="' + esc(AUTH_STATE.profile.full_name) + '" required></div><div class="field"><label>เบอร์โทรศัพท์</label><input name="phone" value="' + esc(AUTH_STATE.profile.phone) + '" required></div><div class="field full"><label>ที่อยู่จัดส่ง</label><textarea name="delivery_address" rows="3" required></textarea></div><div class="field full"><label>หมายเหตุ</label><input name="note" placeholder="เช่น เวลาที่สะดวกให้จัดส่ง"></div></div><button class="btn green" type="submit">ยืนยันคำสั่งซื้อ</button></form>' : '') + '</div>'
}
function userOrders() {
  var rows = USER_ORDERS.map(function (o) {
    return '<article class="card order-card"><div class="section-title"><h3>คำสั่งซื้อ FGW-' + String(o.id).padStart(6, '0') + '</h3><span class="badge ' + orderStatusClass(o.status) + '">' + esc(o.status) + '</span></div><p class="muted">' + new Date(o.created_at).toLocaleString('th-TH') + '</p><div class="order-items">' + (o.items || []).map(function (i) {
      return '<div class="cart-line"><span>' + esc(i.name) + ' × ' + i.quantity + ' kg</span><b>฿' + money(i.line_total) + '</b></div>'
    }).join('') + '</div><p><b>รวม ฿' + money(o.total_amount) + '</b></p><p class="muted">จัดส่ง: ' + esc(o.delivery_address) + '</p></article>'
  }).join(''); return '<div class="page-head"><div><h2>คำสั่งซื้อของฉัน</h2><p>ติดตามรายการสั่งซื้อที่ส่งให้ FISHGROW</p></div><button class="btn light" onclick="navigateUser(\'orders\')">↻ รีเฟรช</button></div><div class="grid">' + (rows || '<div class="card muted">ยังไม่มีคำสั่งซื้อ</div>') + '</div>'
}
function userHome() {
  var p = AUTH_STATE.profile || {}; return `<div class="page-head"><div><h2>ข้อมูลบัญชี</h2><p>แก้ไขข้อมูลบัญชี FISHGROW ของคุณ</p></div><span class="badge">USER</span></div><div class="grid two"><div class="card"><div class="section-title"><h3>ข้อมูลบัญชี</h3><span class="muted">${esc(p.email || currentUser.email)}</span></div><div class="form-grid"><div class="field"><label>ชื่อ-นามสกุล</label><input id="profile-name" value="${esc(p.full_name)}"></div><div class="field"><label>เบอร์โทรศัพท์</label><input id="profile-phone" value="${esc(p.phone)}"></div></div><button class="btn green" style="margin-top:16px" onclick="updateProfile()">บันทึกข้อมูล</button></div><div class="card user-welcome"><div class="product-mark">🐟</div><h3>ยินดีต้อนรับสู่ FISHGROW</h3><p>เลือกซื้ออาหารปลาได้จากร้านค้า และติดตามคำสั่งซื้อได้ทุกเมื่อ</p><button class="btn green" data-page="shop" onclick="navigateUser(this.dataset.page)">ไปที่ร้านค้า</button></div></div>`
}

// navigateUser: เปลี่ยนหน้า User และโหลดข้อมูลใหม่
async function navigateUser(page) {
  S.page = 'user-' + page; try {
    await loadStorefront(); render()
  } catch (error) {
    render(); toast('โหลดข้อมูลร้านค้า/คำสั่งซื้อไม่สำเร็จ: ' + (error.message || 'กรุณาลองใหม่'))
  }
}
function userPage(page) {
  if (page) S.page = 'user-' + page; var selected = S.page === 'user-orders' ? 'orders' : S.page === 'user-account' ? 'account' : 'shop'; return selected === 'orders' ? userOrders() : selected === 'account' ? userHome() : userShop()
}

// userLayout: สร้าง layout และเมนูของหน้า User
function userLayout(c) {
  var links = [['shop', 'ร้านค้า'], ['orders', 'คำสั่งซื้อของฉัน'], ['account', 'บัญชีของฉัน']]; document.getElementById('app').innerHTML = '<div class="fg-user-shell"><header class="fg-header fg-user-header"><div class="fg-container fg-user-nav"><a class="fg-logo fg-user-brand" href="#" onclick="navigateUser(\'shop\');return false"><img class="fg-logo-image" src="assets/logo.png" alt=""><span class="fg-wordmark">Fish<span>Grow</span></span></a><nav class="fg-user-links">' + links.map(function (m) {
    return '<button class="fg-user-link ' + ((S.page === 'user-' + m[0] || (m[0] === 'shop' && S.page === 'user')) ? 'active' : '') + '" data-page="' + m[0] + '" onclick="navigateUser(this.dataset.page)">' + m[1] + (m[0] === 'shop' && cartCount() ? ' <b>' + cartCount() + '</b>' : '') + '</button>'
  }).join('') + '</nav><div class="fg-user-actions"><span class="fg-user-name">' + esc(AUTH_STATE.profile.full_name || currentUser.email) + '</span><button class="fg-btn fg-btn-green" onclick="signOutUser()">ออกจากระบบ</button></div></div></header><main class="fg-user-main"><div class="fg-container">' + c + '</div></main><div id="toast" class="toast"></div></div>'
}

// showStartupError: แสดงหน้าข้อผิดพลาดเมื่อเริ่มระบบไม่ได้
function showStartupError(error) {

  var app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = '<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#F5F4ED;color:#26343b;font-family:Arial,sans-serif"><section style="max-width:560px;background:#fff;padding:28px;border-radius:16px;box-shadow:0 8px 28px #263b4a14"><h1 style="margin-top:0">FISHGROW</h1><h2>เปิดหน้าเว็บไม่สำเร็จ</h2><p>ระบบโหลดข้อมูลเริ่มต้นไม่ได้ กรุณารีเฟรชหน้าเว็บ หรือติดต่อผู้ดูแล</p><details><summary>รายละเอียดสำหรับตรวจสอบ</summary><pre style="white-space:pre-wrap">' + esc(error && error.message || String(error || 'ไม่ทราบสาเหตุ')) + '</pre></details></section></main>';
}

// initializeAuth: ตั้ง listener ของ Supabase Auth และเริ่มตรวจ session
function initializeAuth() {

  try {

    if (!window.fishgrowSupabase) {
      renderAuth('', 'ไม่พบไฟล์ Supabase client'); return
    }

    window.fishgrowSupabase.auth.onAuthStateChange(function (event) {

      if (event === 'SIGNED_OUT') {
        currentUser = null; AUTH_STATE.profile = null; S.page = 'dashboard'; renderAuth()
      }
      else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && !currentUser) {
        setTimeout(bootstrapAuth, 0)
      }

    });
    bootstrapAuth().catch(function (error) {
      showStartupError(error)
    });
  } catch (error) {
    showStartupError(error)
  }

}

window.addEventListener('error', function (event) {
  if (!document.getElementById('app')?.innerHTML.trim()) showStartupError(event.error || event.message)
});
window.addEventListener('unhandledrejection', function (event) {
  showStartupError(event.reason)
});

// render: เลือกหน้าที่ต้องแสดงตาม role และ S.page
async function render() {
  if (!currentUser || !AUTH_STATE.profile) return renderAuth();
  var p = { dashboard: dashboard, products: products, materials: materials, recipes: recipes, stock: stock, orders: orders, finance: finance, reports: reports, 'store-settings': storeSettings, 'knowledge-admin': knowledgeAdmin, 'recommendation-admin': recommendationAdmin, 'product-metadata': productMetadata };
  if (AUTH_STATE.profile.role !== 'admin') return layout(userPage());
  if (!p[S.page]) S.page = 'dashboard';
  if (S.page === 'knowledge-admin') await loadKnowledgeAdmin();
  if (S.page === 'recommendation-admin') await loadRecommendationAdmin();
  layout(await p[S.page]());
}

initializeAuth();
