// AUTH_STATE: เก็บสถานะการ Login และ profile ของผู้ใช้
const AUTH_STATE={mode:'user-login',profile:null,loading:false};
let currentUser=null;
let remoteStateLoaded=false;
let USER_PRODUCTS=[];
let USER_CART={};
let USER_ORDERS=[];
let ADMIN_WEB_ORDERS=[];

// S: state หลักของระบบ Admin เช่น สินค้า วัตถุดิบ คำสั่งซื้อ สูตร และค่าใช้จ่าย
const S={page:'dashboard',materials:[{id:1,name:'ปลาหมอคางดำบดแห้ง',category:'วัตถุดิบหลัก',stock:820,price:18},{id:2,name:'กากถั่วเหลือง',category:'โปรตีนเสริม',stock:430,price:22},{id:3,name:'กากรำข้าว',category:'วัตถุดิบเสริม',stock:350,price:11}],products:[{id:1,name:'FISHGROW White Snapper 40',sku:'FG-WS40',stock:680,price:40}],orders:[{id:'FG-2026-001',customer:'ฟาร์มปลากะพงสมชาย',date:'05/10/2569',amount:24000,status:'ชำระแล้ว'},{id:'FG-2026-002',customer:'กลุ่มเกษตรกรบ้านแพ้ว',date:'04/10/2569',amount:12000,status:'รอชำระ'}],customers:[{id:1,name:'ฟาร์มปลากะพงสมชาย',area:'สมุทรสาคร',orders:18},{id:2,name:'กลุ่มเกษตรกรบ้านแพ้ว',area:'สมุทรสาคร',orders:11}],expenses:[{date:'01/10/2569',type:'วัตถุดิบ',detail:'ปลาหมอคางดำบดแห้ง',amount:9000},{date:'02/10/2569',type:'ขนส่ง',detail:'ส่งสินค้า',amount:2400}],recipes:[{id:1,name:'FISHGROW White Snapper 40',yieldKg:100,items:[['ปลาหมอคางดำบดแห้ง',55,18],['กากถั่วเหลือง',25,22],['กากรำข้าว',18,11]]}]};

if(!Array.isArray(S.productionRuns))S.productionRuns=[];

// ORDER_STATUSES: รายการสถานะที่อนุญาตสำหรับคำสั่งซื้อออนไลน์
const ORDER_STATUSES=['รอรับคำสั่งซื้อ','กำลังจัดเตรียม','จัดส่งแล้ว','เสร็จสิ้น','ยกเลิก'];

// money: จัดรูปแบบตัวเลขสำหรับแสดงผลในหน้าเว็บ
const money=n=>new Intl.NumberFormat('th-TH').format(n||0);
const esc=s=>String(s||'').replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c});

// save: บันทึก state ลง localStorage และเรียกการซิงก์ข้อมูล
function save(){localStorage.setItem('fg',JSON.stringify(S));void syncAppState()}

// load: โหลด state เดิมจาก localStorage
function load(){try{if(remoteStateLoaded||(AUTH_STATE.profile&&AUTH_STATE.profile.role!=='admin'))return;Object.assign(S,JSON.parse(localStorage.getItem('fg'))||{})}catch(e){}}
const menus=[['dashboard','⌂','ภาพรวม'],['products','▣','สินค้า'],['materials','◈','วัตถุดิบ'],['recipes','⚗','สูตรอาหาร'],['production','⚙','การผลิต'],['stock','▤','สต็อก'],['customers','♙','ลูกค้า'],['orders','🛒','คำสั่งซื้อ'],['finance','฿','การเงิน'],['reports','▥','รายงาน'],['store-settings','⚙','ตั้งค่าร้านค้า'],['knowledge-admin','▤','จัดการบทความ'],['recommendation-admin','🎯','ระบบแนะนำ'],['product-metadata','▣','ข้อมูลสินค้า']];
// go: เปลี่ยนหน้าของ Admin แล้ว render หน้าจอใหม่
function go(p){if(!AUTH_STATE.profile||AUTH_STATE.profile.role!=='admin')return;S.page=p;render()}

// head: สร้างส่วนหัวของหน้า
function head(t,d,a){return '<div class="page-head"><div><h2>'+t+'</h2><p>'+d+'</p></div>'+ (a||'')+'</div>'}

// layout: สร้าง layout หลักของ Admin
function layout(c){if(!currentUser||!AUTH_STATE.profile)return renderAuth();if(AUTH_STATE.profile.role!=='admin')return userLayout(userPage());document.getElementById('app').innerHTML='<div class="app"><aside class="sidebar"><div class="brand"><div class="brand-mark"><img src="assets/logo.png" alt="FISHGROW"></div><div><h1>FISHGROW</h1><small>SMART FEED MANAGEMENT</small></div></div><div class="nav"><div style="font-size:11px;opacity:.5;padding:8px">เมนูหลัก</div>'+menus.map(function(m){return '<button class="'+(S.page===m[0]?'active':'')+'" data-page="'+m[0]+'" onclick="go(this.dataset.page)">'+m[1]+' &nbsp; '+m[2]+'</button>'}).join('')+'</div></aside><main class="main"><div class="topbar"><span>FISHGROW / ระบบจัดการธุรกิจ</span><div class="session-actions"><span class="session-chip">'+esc(AUTH_STATE.profile.full_name||currentUser.email)+'</span><button class="btn light" onclick="resetDemo()">↻ รีเซ็ตข้อมูล</button><button class="btn light" onclick="signOutUser()">ออกจากระบบ</button></div></div>'+c+'</main><div id="modal" class="modal-bg"></div><div id="toast" class="toast"></div></div>'}
// orderStatusClass: แปลงสถานะคำสั่งซื้อเป็น CSS class
function orderStatusClass(status){return status==='รอชำระ'||status==='รอรับคำสั่งซื้อ'||status==='pending'?'warn':status==='ยกเลิก'||status==='cancelled'?'muted':status==='กำลังจัดเตรียม'||status==='จัดส่งแล้ว'||status==='processing'||status==='shipped'?'info':''}
// ordersTable: สร้างตารางคำสั่งซื้อ และเปิดให้ Admin เปลี่ยนสถานะได้
function ordersTable(rows,canUpdate){
  if(!rows.length)return '<div class="empty-state">ยังไม่มีคำสั่งซื้อ</div>';
  return '<div class="table-wrap"><table><thead><tr><th>เลขที่</th><th>ลูกค้า</th><th>วันที่</th><th>ยอดรวม</th><th>ชำระเงิน</th><th>สถานะ</th><th>Tracking</th></tr></thead><tbody>'+
    rows.map(function(o){
      var status=esc(o.status||'รอรับคำสั่งซื้อ');
      var state=canUpdate&&o.storeOrderId?'<select class="status-select" aria-label="เปลี่ยนสถานะ '+esc(o.id)+'" onchange="updateStoreOrderStatus('+Number(o.storeOrderId)+',this.value)">'+(ORDER_STATUSES.indexOf(o.status)<0?'<option selected>'+status+'</option>':'')+ORDER_STATUSES.map(function(x){return '<option value="'+x+'" '+(o.status===x?'selected':'')+'>'+x+'</option>'}).join('')+'</select>':'<span class="badge '+orderStatusClass(o.status)+'">'+status+'</span>';
      var pay=canUpdate&&o.storeOrderId?'<select class="status-select" onchange="updateStorePaymentStatus('+Number(o.storeOrderId)+',this.value)"><option value="pending" '+(o.paymentStatus==='pending'?'selected':'')+'>รอตรวจสอบ</option><option value="submitted" '+(o.paymentStatus==='submitted'?'selected':'')+'>ส่งหลักฐานแล้ว</option><option value="verified" '+(o.paymentStatus==='verified'?'selected':'')+'>ยืนยันแล้ว</option><option value="rejected" '+(o.paymentStatus==='rejected'?'selected':'')+'>ไม่ผ่าน</option></select>'+(o.proof?'<button class="btn light" onclick="viewPaymentProof(\''+esc(o.proof).replace(/'/g,"\\'")+'\')">ดูหลักฐาน</button>':''):'<span class="badge">'+esc(o.paymentStatus||'pending')+'</span>';
      var tracking=canUpdate&&o.storeOrderId?'<button class="btn light" onclick="updateStoreTracking('+Number(o.storeOrderId)+')">'+esc(o.tracking||'เพิ่มเลข')</button>':'<span>'+esc(o.tracking||'—')+'</span>';
      return '<tr><td><b>'+esc(o.id)+'</b></td><td>'+esc(o.customer)+'</td><td>'+esc(o.date)+'</td><td>฿'+money(o.amount)+'</td><td>'+pay+'</td><td>'+state+'</td><td>'+tracking+'</td></tr>'
    }).join('')+'</tbody></table></div>';
}

// dashboard: สร้างหน้า Dashboard
function dashboard(){var sales=recognizedIncome(),pending=pendingOrderValue(),exp=S.expenses.reduce(function(a,o){return a+o.amount},0),stk=S.products.reduce(function(a,o){return a+o.stock},0);return head('ภาพรวมธุรกิจ','ติดตามยอดขาย ต้นทุน สต็อก และการผลิตของ FISHGROW')+'<div class="grid kpi-grid"><div class="card kpi"><span class="kpi-icon">฿</span><div class="label">รายรับที่ยืนยันแล้ว</div><div class="value">฿'+money(sales)+'</div><div class="sub">ยอดรอรับคำสั่งซื้อ ฿'+money(pending)+'</div></div><div class="card kpi"><span class="kpi-icon">📦</span><div class="label">สินค้าคงเหลือ</div><div class="value">'+money(stk)+' kg</div><div class="sub">ราคาเป้าหมาย ฿40/kg</div></div><div class="card kpi"><span class="kpi-icon">🧾</span><div class="label">ค่าใช้จ่าย</div><div class="value">฿'+money(exp)+'</div><div class="sub">รายการที่บันทึก</div></div><div class="card kpi"><span class="kpi-icon">📈</span><div class="label">กำไรเบื้องต้น</div><div class="value">฿'+money(sales-exp)+'</div><div class="sub">'+(sales?Math.round((sales-exp)/sales*100):0)+'%</div></div></div><div class="grid two" style="margin-top:16px"><div class="card"><div class="section-title"><h3>ยอดขาย 7 วันล่าสุด</h3><span class="muted">บาท</span></div><div class="mini-chart">'+[40,55,48,68,57,82,72].map(function(v,i){return '<span style="height:'+v+'%"><em>'+['29','30','1','2','3','4','5'][i]+'</em></span>'}).join('')+'</div></div><div class="card"><div class="section-title"><h3>สต็อกวัตถุดิบ</h3><span class="muted">kg</span></div><div class="bar-list">'+S.materials.map(function(m){return '<div class="bar-row"><span>'+esc(m.name)+'</span><div class="bar"><i style="width:'+Math.min(m.stock/900*100,100)+'%"></i></div><b>'+money(m.stock)+'</b></div>'}).join('')+'</div></div></div><div class="grid two" style="margin-top:16px"><div class="card"><div class="section-title"><h3>คำสั่งซื้อล่าสุด</h3><button class="btn light" onclick="go(\'orders\')">ดูทั้งหมด</button></div>'+ordersTable(businessOrders())+'</div><div class="card"><div class="section-title"><h3>แนวคิด FISHGROW</h3></div><p style="line-height:1.8;font-size:13px">นำปลาหมอคางดำที่จับได้ตามมาตรการที่ถูกต้องมาเพิ่มมูลค่าเป็นวัตถุดิบอาหารปลากะพงขาว พร้อมบริหารต้นทุน สต็อก และการขายในระบบเดียว</p><div style="background:#f1f4ed;padding:14px;border-radius:12px;color:#4D632A">♻️ เปลี่ยนวิกฤตเอเลียนสปีชีส์ให้เป็นโอกาส</div></div></div>'}
// products: สร้างหน้าจัดการสินค้า ราคา SKU และสต็อก
function products() {
  return head('สินค้า','จัดการสินค้า อัตราขาย และจำนวนคงเหลือ','<button class="btn green" onclick="productModal()">+ เพิ่มสินค้า</button>')+'<div class="card"><input class="search" placeholder="ค้นหาสินค้า..." oninput="filter(this)" style="margin-bottom:15px"><table><thead><tr><th>สินค้า</th><th>SKU</th><th>คงเหลือ</th><th>ราคา/kg</th><th>สถานะ</th><th></th></tr></thead><tbody id="rows">'+S.products.map(function(p) {
    return '<tr><td><b>'+esc(p.name)+'</b></td><td>'+p.sku+'</td><td>'+money(p.stock)+' kg</td><td>฿'+money(p.price)+'</td><td><span class="badge">พร้อมขาย</span></td><td><button class="btn light" onclick="productModal('+p.id+')">แก้ไข</button></td></tr>'
  }).join('')+'</tbody></table></div>'
}

// materials: สร้างหน้าจัดการวัตถุดิบ ราคา และมูลค่าสต็อก
function materials() {
  return head('วัตถุดิบ','ติดตามปริมาณ ราคา และมูลค่าวัตถุดิบ','<button class="btn green" onclick="materialModal()">+ เพิ่มวัตถุดิบ</button>')+'<div class="card"><table><thead><tr><th>วัตถุดิบ</th><th>ประเภท</th><th>คงเหลือ</th><th>ราคา/kg</th><th>มูลค่าสต็อก</th><th></th></tr></thead><tbody>'+S.materials.map(function(m) {
    return '<tr><td><b>'+esc(m.name)+'</b></td><td>'+m.category+'</td><td>'+money(m.stock)+' kg</td><td>฿'+money(m.price)+'</td><td>฿'+money(m.stock*m.price)+'</td><td><button class="btn light" onclick="materialModal('+m.id+')">แก้ไข</button></td></tr>'
  }).join('')+'</tbody></table></div>'
}

// recipeCost: คำนวณต้นทุนของสูตรจากปริมาณและราคาวัตถุดิบ
function recipeCost(recipe) {
  return (recipe&&Array.isArray(recipe.items)?recipe.items:[]).reduce(function(total,item) {
    var material=S.materials.find(function(m) {
      return m.name===item[0]
    }),price=material?Number(material.price)||0:Number(item[2])||0;return total+Number(item[1])*price
  },0)
}

// recipes: สร้างหน้าสูตรอาหารและแสดงต้นทุนต่อ Batch/kg
function recipes() {
  return head('สูตรอาหาร','คำนวณต้นทุนสูตรและต้นทุนต่อกิโลกรัม','<button class="btn green" onclick="recipeModal()">+ สร้างสูตร</button>')+(S.recipes.length?'<div class="grid two">'+S.recipes.map(function(r) {
    var items=Array.isArray(r.items)?r.items:[],yieldKg=Number(r.yieldKg)||0,c=recipeCost(r);return '<div class="card"><div class="section-title"><h3>'+esc(r.name)+'</h3><span class="badge">ใช้งาน</span></div><div class="muted">ผลผลิต '+money(yieldKg)+' kg/Batch · สินค้า: '+esc((S.products.find(function(p) {
      return String(p.id)===String(r.productId)
    })||{}).name||r.name)+'</div>'+(items.length?'<div class="bar-list" style="margin-top:15px">'+items.map(function(i) {
      return '<div class="bar-row"><span>'+esc(i[0])+'</span><div class="bar"><i style="width:'+Math.min(Number(i[1])/Math.max(yieldKg,1)*100,100)+'%"></i></div><b>'+money(i[1])+' kg</b></div>'
    }).join('')+'</div>':'<p class="muted">ยังไม่ได้ระบุวัตถุดิบในสูตร</p>')+'<p>ต้นทุน/Batch <b>฿'+money(c)+'</b> &nbsp; ต้นทุน/kg <b>฿'+money(yieldKg?c/yieldKg:0)+'</b></p></div>'
  }).join('')+'</div>':'<div class="card empty-state">ยังไม่มีสูตรอาหาร กด “สร้างสูตรอาหาร” เพื่อเริ่มต้น</div>')
}
function production() {
  var runs=S.productionRuns||[],r=S.recipes[0],items=r&&Array.isArray(r.items)?r.items:[],cost=recipeCost(r);return head('การผลิต','วางแผน Batch และบันทึกผลผลิต',S.recipes.length?'<button class="btn green" onclick="productionModal()">+ บันทึกการผลิต</button>':'')+(r?'<div class="grid three"><div class="card kpi"><div class="label">สูตรหลัก</div><div class="value" style="font-size:18px">'+esc(r.name)+'</div><div class="sub">ต้นทุน/Batch ฿'+money(cost)+'</div></div><div class="card kpi"><div class="label">กำลังผลิตต่อ Batch</div><div class="value">'+money(r.yieldKg)+' kg</div><div class="sub">'+items.length+' วัตถุดิบในสูตร</div></div><div class="card kpi"><div class="label">ต้นทุนต่อ kg</div><div class="value">฿'+money(r.yieldKg?cost/r.yieldKg:0)+'</div><div class="sub">ก่อนค่าแรง/ขนส่ง</div></div></div>':'<div class="card empty-state">ยังไม่มีสูตรอาหาร กรุณาสร้างสูตรก่อนบันทึกการผลิต</div>')+'<div class="card" style="margin-top:16px"><div class="section-title"><h3>ประวัติการผลิต</h3><span class="muted">'+runs.length+' รายการ</span></div>'+(runs.length?'<div class="table-wrap"><table><thead><tr><th>วันที่</th><th>Batch</th><th>สูตร</th><th>จำนวนผลิต</th><th>ต้นทุนวัตถุดิบ</th></tr></thead><tbody>'+runs.slice().reverse().map(function(x) {
    return '<tr><td>'+esc(x.date)+'</td><td>'+esc(x.batch||'-')+'</td><td>'+esc(x.recipeName)+'</td><td>'+money(x.quantity)+' kg</td><td>฿'+money(x.cost)+'</td></tr>'
  }).join('')+'</tbody></table></div>':'<div class="empty-state">ยังไม่มีประวัติการผลิต</div>')+'</div><div class="card" style="margin-top:16px"><div class="section-title"><h3>Workflow การผลิต</h3></div><div class="grid three">'+['คัดและทำความสะอาด','ต้ม/นึ่งและทำให้แห้ง','บด ผสม และอัดเม็ด','อบ/ลดความชื้น','ตรวจคุณภาพและบรรจุ','บันทึกเข้าสต็อก'].map(function(x,i) {
    return '<div style="padding:15px;background:#fafaf7;border-radius:12px"><b style="color:#4D632A">0'+(i+1)+'</b><div style="margin-top:7px;font-size:12px">'+x+'</div></div>'
  }).join('')+'</div></div>'
}
function stock() {
  var total=S.materials.reduce(function(a,m) {
    return a+m.stock*m.price
  },0)+S.products.reduce(function(a,p) {
    return a+p.stock*p.price
  },0);return head('สต็อก','ภาพรวมสินค้าสำเร็จรูปและวัตถุดิบ')+'<div class="grid three"><div class="card kpi"><div class="label">มูลค่าสต็อกรวม</div><div class="value">฿'+money(total)+'</div></div><div class="card kpi"><div class="label">วัตถุดิบ</div><div class="value">'+S.materials.length+' รายการ</div></div><div class="card kpi"><div class="label">สินค้า</div><div class="value">'+S.products.length+' รายการ</div></div></div><div class="grid two" style="margin-top:16px"><div class="card"><div class="section-title"><h3>วัตถุดิบ</h3></div><table><tbody>'+S.materials.map(function(m) {
    return '<tr><td>'+m.name+'</td><td>'+money(m.stock)+' kg</td><td>฿'+money(m.stock*m.price)+'</td></tr>'
  }).join('')+'</tbody></table></div><div class="card"><div class="section-title"><h3>สินค้าสำเร็จรูป</h3></div><table><tbody>'+S.products.map(function(p) {
    return '<tr><td>'+p.name+'</td><td>'+money(p.stock)+' kg</td><td>฿'+money(p.stock*p.price)+'</td></tr>'
  }).join('')+'</tbody></table></div></div>'
}

// customers: สร้างหน้ารายชื่อลูกค้าและจำนวนคำสั่งซื้อ
function customers() {
  return head('ลูกค้า','จัดการฐานลูกค้าและประวัติการสั่งซื้อ','<button class="btn green" onclick="customerModal()">+ เพิ่มลูกค้า</button>')+'<div class="card"><table><thead><tr><th>ลูกค้า</th><th>พื้นที่</th><th>จำนวนออเดอร์</th></tr></thead><tbody>'+S.customers.map(function(c) {
    return '<tr><td><b>'+esc(c.name)+'</b></td><td>'+c.area+'</td><td>'+c.orders+' ครั้ง</td></tr>'
  }).join('')+'</tbody></table></div>'
}

// orders: สร้างหน้ารวมคำสั่งซื้อออนไลน์และคำสั่งซื้อเดิม
function orders() {
  var webRows=ADMIN_WEB_ORDERS.map(function(o) {
    return {id:o.order_code,storeOrderId:o.id,customer:o.customer_name,date:new Date(o.created_at).toLocaleDateString('th-TH'),amount:Number(o.total_amount),status:o.status,paymentStatus:o.payment_status,paymentMethod:o.payment_method,proof:o.payment_proof_path,tracking:o.tracking_number}
  });
  return head('คำสั่งซื้อ','ติดตามออเดอร์จากหน้า User และรายการที่บันทึกในระบบ','<div class="session-actions"><button class="btn light" onclick="refreshAdminOrders()">↻ รีเฟรช</button><button class="btn green" onclick="orderModal()">+ สร้างคำสั่งซื้อ</button></div>')+
    '<div class="card"><h3>คำสั่งซื้อออนไลน์</h3>'+ordersTable(webRows,true)+'</div><div class="card" style="margin-top:16px"><h3>รายการเดิมในระบบ Admin</h3>'+ordersTable(S.orders,false)+'</div>'
}

// updateStoreOrderStatus: อัปเดตสถานะคำสั่งซื้อออนไลน์ใน Supabase
async function updateStoreOrderStatus(orderId,status) {
  if(ORDER_STATUSES.indexOf(status)<0) {
    toast('สถานะที่เลือกไม่ถูกต้อง');return
  }
  try {
    var result=await window.fishgrowSupabase.from('store_orders').update({status:status}).eq('id',Number(orderId)).select('id,status').maybeSingle();if(result.error||!result.data)throw result.error||new Error('ไม่พบคำสั่งซื้อ หรือไม่มีสิทธิ์เปลี่ยนสถานะ');await loadAdminWebOrders();render();toast('อัปเดตสถานะคำสั่งซื้อแล้ว')
  } catch(error) {
    await loadAdminWebOrders();render();toast('เปลี่ยนสถานะไม่สำเร็จ: '+(error.message||'กรุณาลองใหม่'))
  }
}
function knowledgeAdmin(){
  var rows=window.__FG_ARTICLES||[];
  return head('บทความความรู้','เพิ่ม แก้ไข และเผยแพร่บทความบนหน้าเว็บ','<button class="btn green" onclick="articlePrompt()">+ เพิ่มบทความ</button>')+
  '<div class="card"><table><thead><tr><th>หัวข้อ</th><th>หมวดหมู่</th><th>สถานะ</th><th>วันที่</th><th></th></tr></thead><tbody>'+
  (rows.length?rows.map(function(a){return '<tr><td><b>'+esc(a.title)+'</b><br><span class="muted">'+esc(a.slug)+'</span></td><td>'+esc(a.category)+'</td><td><span class="badge">'+(a.is_published?'เผยแพร่':'ฉบับร่าง')+'</span></td><td>'+esc(a.published_at||'—')+'</td><td><button class="btn light" onclick="articlePrompt('+a.id+')">แก้ไข</button> <button class="btn light" onclick="deleteArticle('+a.id+')">ลบ</button></td></tr>'}).join(''):'<tr><td colspan="5" class="empty-state">ยังไม่มีบทความ</td></tr>')+'</tbody></table></div>';
}
async function loadKnowledgeAdmin(){
  var r=await window.fishgrowSupabase.from('knowledge_articles').select('*').order('created_at',{ascending:false});
  window.__FG_ARTICLES=r.error?[]:(r.data||[]); return r;
}
async function articlePrompt(id){
  var a=(window.__FG_ARTICLES||[]).find(function(x){return Number(x.id)===Number(id)})||{};
  var title=prompt('ชื่อบทความ',a.title||''); if(title===null)return;
  var slug=prompt('Slug ภาษาอังกฤษ เช่น fish-feed-guide',a.slug||''); if(slug===null)return;
  var category=prompt('หมวดหมู่ เช่น การเลี้ยงปลา / อาหารปลา / ปลาหมอคางดำ',a.category||'การเลี้ยงปลา'); if(category===null)return;
  var excerpt=prompt('คำโปรย',a.excerpt||''); if(excerpt===null)return;
  var content=prompt('เนื้อหาบทความ',a.content||''); if(content===null)return;
  var published=confirm('ต้องการเผยแพร่บทความนี้ทันทีหรือไม่?');
  var payload={slug:slug.trim(),title:title.trim(),category:category.trim(),excerpt:excerpt.trim(),content:content,is_published:published,published_at:published?new Date().toISOString():null,updated_at:new Date().toISOString()};
  var q=id?window.fishgrowSupabase.from('knowledge_articles').update(payload).eq('id',id):window.fishgrowSupabase.from('knowledge_articles').insert(payload);
  var r=await q;
  if(r.error){toast('บันทึกบทความไม่สำเร็จ: '+r.error.message);return}
  await loadKnowledgeAdmin(); render(); toast('บันทึกบทความแล้ว');
}
async function deleteArticle(id){
  if(!confirm('ลบบทความนี้หรือไม่?'))return;
  var r=await window.fishgrowSupabase.from('knowledge_articles').delete().eq('id',id);
  if(r.error){toast('ลบไม่สำเร็จ: '+r.error.message);return}
  await loadKnowledgeAdmin(); render(); toast('ลบบทความแล้ว');
}
function recommendationAdmin(){
  var rows=window.__FG_RULES||[];
  return head('ระบบแนะนำอาหาร','กำหนดเงื่อนไขและสินค้าที่ระบบจะแนะนำ','<button class="btn green" onclick="recommendationPrompt()">+ เพิ่มกฎ</button>')+
  '<div class="card"><table><thead><tr><th>สินค้า</th><th>ชนิดปลา</th><th>ช่วงวัย</th><th>เป้าหมาย</th><th>ฟาร์ม</th><th>Priority</th><th></th></tr></thead><tbody>'+
  (rows.length?rows.map(function(x){return '<tr><td>'+esc(x.product_name||x.product_id)+'</td><td>'+esc(x.fish_type)+'</td><td>'+esc(x.stage)+'</td><td>'+esc(x.goal)+'</td><td>'+esc(x.farm_size)+'</td><td>'+x.priority+'</td><td><button class="btn light" onclick="recommendationPrompt('+x.id+')">แก้ไข</button> <button class="btn light" onclick="deleteRecommendation('+x.id+')">ลบ</button></td></tr>'}).join(''):'<tr><td colspan="7" class="empty-state">ยังไม่มีกฎแนะนำ</td></tr>')+'</tbody></table></div>';
}
async function loadRecommendationAdmin(){
  var r=await window.fishgrowSupabase.from('store_product_recommendation_rules').select('id,product_id,fish_type,stage,goal,farm_size,priority,reason,is_active,store_products(name)').order('priority',{ascending:false});
  window.__FG_RULES=(r.data||[]).map(function(x){x.product_name=x.store_products&&x.store_products.name;return x}); return r;
}
async function recommendationPrompt(id){
  var x=(window.__FG_RULES||[]).find(function(a){return Number(a.id)===Number(id)})||{};
  var pid=prompt('Product ID',x.product_id||''); if(pid===null)return;
  var fish=prompt('ชนิดปลา',x.fish_type||'ปลากะพงขาว'); if(fish===null)return;
  var stage=prompt('ช่วงวัย',x.stage||'ลูกปลา'); if(stage===null)return;
  var goal=prompt('เป้าหมาย เช่น growth / protein / cost / quality',x.goal||'growth'); if(goal===null)return;
  var farm=prompt('ขนาดฟาร์ม: small / medium / large',x.farm_size||'small'); if(farm===null)return;
  var priority=Number(prompt('Priority -100 ถึง 100',x.priority??10)); if(Number.isNaN(priority))return;
  var reason=prompt('เหตุผลที่แนะนำ',x.reason||'')||'';
  var payload={product_id:Number(pid),fish_type:fish.trim(),stage:stage.trim(),goal:goal.trim(),farm_size:farm.trim(),priority:priority,reason:reason,is_active:true,updated_at:new Date().toISOString()};
  var q=id?window.fishgrowSupabase.from('store_product_recommendation_rules').update(payload).eq('id',id):window.fishgrowSupabase.from('store_product_recommendation_rules').insert(payload);
  var r=await q;if(r.error){toast('บันทึกกฎไม่สำเร็จ: '+r.error.message);return}
  await loadRecommendationAdmin();render();toast('บันทึกกฎแนะนำแล้ว');
}
async function deleteRecommendation(id){
  if(!confirm('ลบกฎนี้หรือไม่?'))return;
  var r=await window.fishgrowSupabase.from('store_product_recommendation_rules').delete().eq('id',id);
  if(r.error){toast('ลบไม่สำเร็จ: '+r.error.message);return}
  await loadRecommendationAdmin();render();toast('ลบกฎแล้ว');
}
async function productMetadata(){
  var r=await window.fishgrowSupabase.from('store_products').select('product_id,name,sku,fish_types,stages,goals,pellet_size,protein_pct,description,ingredients,usage_note,storage_note').order('product_id');
  var rows=r.data||[];
  return head('ข้อมูลสินค้า','จัดการข้อมูลที่ใช้แสดงบนหน้ารายละเอียดและระบบแนะนำอาหาร')+'<div class="card"><table><thead><tr><th>สินค้า</th><th>ชนิดปลา</th><th>ช่วงวัย</th><th>เป้าหมาย</th><th>โปรตีน</th><th></th></tr></thead><tbody>'+rows.map(function(p){return '<tr><td><b>'+esc(p.name)+'</b><br><span class="muted">'+esc(p.sku)+'</span></td><td>'+esc((p.fish_types||[]).join(', '))+'</td><td>'+esc((p.stages||[]).join(', '))+'</td><td>'+esc((p.goals||[]).join(', '))+'</td><td>'+esc(p.protein_pct??'—')+'%</td><td><button class="btn light" onclick="productMetadataPrompt('+p.product_id+')">แก้ไข</button></td></tr>'}).join('')+'</tbody></table></div>';
}
async function productMetadataPrompt(id){
  var r=await window.fishgrowSupabase.from('store_products').select('*').eq('product_id',id).single(); if(r.error)return toast('โหลดสินค้าไม่สำเร็จ');
  var p=r.data;
  var fish=prompt('ชนิดปลา คั่นด้วย ,', (p.fish_types||[]).join(', ')); if(fish===null)return;
  var stages=prompt('ช่วงวัย คั่นด้วย ,', (p.stages||[]).join(', ')); if(stages===null)return;
  var goals=prompt('เป้าหมาย เช่น growth,protein,cost,quality คั่นด้วย ,', (p.goals||[]).join(', ')); if(goals===null)return;
  var pellet=prompt('ขนาดเม็ด',p.pellet_size||''); if(pellet===null)return;
  var protein=prompt('โปรตีน (%)',p.protein_pct??''); if(protein===null)return;
  var description=prompt('รายละเอียดสินค้า',p.description||''); if(description===null)return;
  var ingredients=prompt('ส่วนประกอบ',p.ingredients||''); if(ingredients===null)return;
  var usage=prompt('วิธีใช้',p.usage_note||''); if(usage===null)return;
  var storage=prompt('การเก็บรักษา',p.storage_note||''); if(storage===null)return;
  var payload={fish_types:fish.split(',').map(function(x){return x.trim()}).filter(Boolean),stages:stages.split(',').map(function(x){return x.trim()}).filter(Boolean),goals:goals.split(',').map(function(x){return x.trim()}).filter(Boolean),pellet_size:pellet.trim(),protein_pct:protein===''?null:Number(protein),description:description,ingredients:ingredients,usage_note:usage,storage_note:storage};
  var u=await window.fishgrowSupabase.from('store_products').update(payload).eq('product_id',id);
  if(u.error){toast('บันทึกข้อมูลสินค้าไม่สำเร็จ: '+u.error.message);return}render();toast('บันทึกข้อมูลสินค้าแล้ว');
}

async function storeSettings(){
  var r=await window.fishgrowSupabase.from('store_settings').select('*').eq('id',1).maybeSingle();
  var s=r.data||{};
  return head('ตั้งค่าร้านค้า','กำหนดข้อมูลการชำระเงิน ช่องทางติดต่อ และการจัดส่ง')+'<div class="card"><div class="form-grid">'+field('ชื่อร้านค้า','ss-name',s.store_name||'FISHGROW')+field('ชื่อผู้รับ PromptPay','ss-pp-name',s.promptpay_name||'')+field('หมายเลข PromptPay','ss-pp-number',s.promptpay_number||'')+field('ธนาคาร','ss-bank',s.bank_name||'')+field('ชื่อบัญชี','ss-bank-name',s.bank_account_name||'')+field('เลขบัญชี','ss-bank-number',s.bank_account_number||'')+field('เบอร์โทร','ss-phone',s.contact_phone||'')+field('LINE','ss-line',s.contact_line||'')+field('Email','ss-email',s.contact_email||'')+'<div class="field full"><label>หมายเหตุการจัดส่ง</label><textarea id="ss-shipping" rows="3">'+esc(s.shipping_note||'')+'</textarea></div><div class="field"><label><input id="ss-cod" type="checkbox" '+(s.cod_enabled?'checked':'')+'> เปิดเก็บเงินปลายทาง</label></div></div><button class="btn green" onclick="saveStoreSettings()">บันทึกการตั้งค่า</button></div>';
}
async function saveStoreSettings(){
  var payload={store_name:document.getElementById('ss-name').value.trim(),promptpay_name:document.getElementById('ss-pp-name').value.trim(),promptpay_number:document.getElementById('ss-pp-number').value.trim(),bank_name:document.getElementById('ss-bank').value.trim(),bank_account_name:document.getElementById('ss-bank-name').value.trim(),bank_account_number:document.getElementById('ss-bank-number').value.trim(),contact_phone:document.getElementById('ss-phone').value.trim(),contact_line:document.getElementById('ss-line').value.trim(),contact_email:document.getElementById('ss-email').value.trim(),shipping_note:document.getElementById('ss-shipping').value.trim(),cod_enabled:document.getElementById('ss-cod').checked,updated_at:new Date().toISOString()};
  var r=await window.fishgrowSupabase.from('store_settings').upsert(Object.assign({id:1},payload)).select('id').single();
  if(r.error){toast('บันทึกตั้งค่าร้านค้าไม่สำเร็จ: '+r.error.message);return} toast('บันทึกตั้งค่าร้านค้าแล้ว');
}
function finance() {
  var i=recognizedIncome(),pending=pendingOrderValue(),e=S.expenses.reduce(function(a,o) {
    return a+Number(o.amount||0)
  },0);return head('การเงิน','ติดตามรายรับ รายจ่าย และกำไร','<button class="btn green" onclick="expenseModal()">+ บันทึกค่าใช้จ่าย</button>')+'<div class="grid three"><div class="card kpi"><div class="label">รายรับที่ยืนยันแล้ว</div><div class="value">฿'+money(i)+'</div></div><div class="card kpi"><div class="label">ยอดคำสั่งซื้อรอดำเนินการ</div><div class="value">฿'+money(pending)+'</div><div class="sub">ยังไม่รวมเป็นรายรับ</div></div><div class="card kpi"><div class="label">รายจ่าย</div><div class="value">฿'+money(e)+'</div></div><div class="card kpi"><div class="label">กำไรเบื้องต้น</div><div class="value">฿'+money(i-e)+'</div></div></div><div class="card" style="margin-top:16px"><table><thead><tr><th>วันที่</th><th>ประเภท</th><th>รายละเอียด</th><th>จำนวนเงิน</th></tr></thead><tbody>'+S.expenses.map(function(x) {
    return '<tr><td>'+esc(x.date)+'</td><td>'+esc(x.type)+'</td><td>'+esc(x.detail)+'</td><td>฿'+money(x.amount)+'</td></tr>'
  }).join('')+'</tbody></table></div>'
}
function reports() {
  var s=recognizedIncome(),pending=pendingOrderValue(),e=S.expenses.reduce(function(a,o) {
    return a+Number(o.amount||0)
  },0);return head('รายงาน','สรุปผลการดำเนินงานเพื่อใช้วางแผนธุรกิจ')+'<div class="grid two"><div class="card"><h3>สรุปผลประกอบการ</h3><div class="bar-list"><div class="bar-row"><span>รายรับยืนยันแล้ว</span><div class="bar"><i style="width:100%"></i></div><b>฿'+money(s)+'</b></div><div class="bar-row"><span>คำสั่งซื้อรอดำเนินการ</span><div class="bar"><i style="width:'+(s?Math.min(pending/s*100,100):0)+'%"></i></div><b>฿'+money(pending)+'</b></div><div class="bar-row"><span>ค่าใช้จ่าย</span><div class="bar"><i style="width:'+(s?Math.min(e/s*100,100):0)+'%"></i></div><b>฿'+money(e)+'</b></div><div class="bar-row"><span>กำไร</span><div class="bar"><i style="width:'+(s?Math.max(0,Math.min((s-e)/s*100,100)):0)+'%"></i></div><b>฿'+money(s-e)+'</b></div></div></div><div class="card"><h3>ตัวชี้วัด FISHGROW</h3><table><tbody><tr><td>ราคาเป้าหมาย</td><td><b>฿40/kg</b></td></tr><tr><td>TAM</td><td><b>600,000 ราย</b></td></tr><tr><td>SAM</td><td><b>80,000 ตัน/ปี</b></td></tr><tr><td>SOM</td><td><b>25,000 ตัน/ปี</b></td></tr><tr><td>ตลาดเป้าหมาย</td><td><b>เกษตรกรรายเล็ก–กลาง</b></td></tr></tbody></table></div></div>'
}
function modal(title,body,fn) {
  var e=document.getElementById('modal');e.innerHTML='<div class="modal"><div class="modal-head"><h3>'+title+'</h3><button class="close" onclick="closeModal()">×</button></div>'+body+'<div class="modal-foot"><button class="btn light" onclick="closeModal()">ยกเลิก</button><button class="btn green" id="save">บันทึก</button></div></div>';e.className='modal-bg show';document.getElementById('save').onclick=function() {
    try {
      var result=fn();if(result===false)return;save();closeModal();render();toast('บันทึกข้อมูลเรียบร้อย')
    } catch(error) {
      toast(error.message||'กรุณาตรวจสอบข้อมูลแล้วลองใหม่')
    }
  }
}
function closeModal() {
  document.getElementById('modal').className='modal-bg'
}
function field(l,id,v) {
  return '<div class="field"><label>'+l+'</label><input id="'+id+'" value="'+esc(v||'')+'"></div>'
}
function safeImageUrl(value) {
  var raw=String(value||'').trim();if(!raw)return '';if(!/^https?:\/\/[^\s"'<>]+$/i.test(raw))return null;try{var url=new URL(raw),id='';if(/(^|\.)drive\.google\.com$/i.test(url.hostname)){var match=url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/);id=match?match[1]:url.searchParams.get('id')||'';if(id)return 'https://drive.google.com/uc?export=view&id='+encodeURIComponent(id)}return raw}catch(e){return null}}
// previewProductImage: ตรวจสอบและแสดงตัวอย่างรูปสินค้า
function previewProductImage(value){var img=document.getElementById('product-image-preview'),hint=document.getElementById('product-image-hint'),url=safeImageUrl(value);if(!img||!hint)return;if(!String(value||'').trim()){img.removeAttribute('src');img.style.display='none';hint.textContent='ใส่ลิงก์รูปโดยตรง หรือ Google Drive ที่แชร์ให้ทุกคนดูได้';return}if(!url){img.removeAttribute('src');img.style.display='none';hint.textContent='URL ต้องขึ้นต้นด้วย https:// หรือ http://';return}hint.textContent='กำลังตรวจสอบรูปภาพ…';img.onerror=function(){hint.textContent='เปิดรูปไม่ได้: ตรวจว่าลิงก์เป็นสาธารณะ (ทุกคนที่มีลิงก์ดูได้) และชี้ไปยังรูปภาพ';img.style.color='#b42318'};img.onload=function(){hint.textContent='ตัวอย่างรูปสินค้า';hint.style.color=''};img.src=url;img.style.display='block'}
// productModal: เปิดฟอร์มเพิ่มหรือแก้ไขสินค้า
function productModal(id){var p=S.products.find(function(x){return x.id===id})||{name:'',sku:'',stock:0,price:40,image_url:''},initialImage=safeImageUrl(p.image_url)||'';modal(id?'แก้ไขสินค้า':'เพิ่มสินค้า','<div class="form-grid">'+field('ชื่อสินค้า','pn',p.name)+field('SKU','ps',p.sku)+field('คงเหลือ kg','pk',p.stock)+field('ราคาขาย/kg','pp',p.price)+'<div class="field full"><label>URL รูปสินค้า</label><input id="pi" type="url" value="'+esc(initialImage)+'" placeholder="https://example.com/product.jpg" oninput="previewProductImage(this.value)"><small id="product-image-hint" class="muted">ใส่ลิงก์รูปภาพสาธารณะที่เปิดดูได้</small><img id="product-image-preview" src="'+esc(initialImage)+'" alt="ตัวอย่างรูปสินค้า" style="display:'+(initialImage?'block':'none')+';width:120px;height:90px;object-fit:cover;border-radius:10px"></div></div>',function(){var raw=document.getElementById('pi').value.trim(),image=safeImageUrl(raw);if(raw&&!image)throw new Error('URL รูปสินค้าต้องขึ้นต้นด้วย https:// หรือ http://');p.id=p.id||Date.now();p.name=document.getElementById('pn').value;p.sku=document.getElementById('ps').value;p.stock=+document.getElementById('pk').value;p.price=+document.getElementById('pp').value;p.image_url=image;if(!id)S.products.push(p)})}

// materialModal: เปิดฟอร์มวัตถุดิบ
function materialModal(id){var m=S.materials.find(function(x){return x.id===id})||{name:'',category:'วัตถุดิบหลัก',stock:0,price:0};modal(id?'แก้ไขวัตถุดิบ':'เพิ่มวัตถุดิบ','<div class="form-grid">'+field('ชื่อวัตถุดิบ','mn',m.name)+field('ประเภท','mc',m.category)+field('คงเหลือ kg','mk',m.stock)+field('ราคา/kg','mp',m.price)+'</div>',function(){m.id=m.id||Date.now();m.name=document.getElementById('mn').value;m.category=document.getElementById('mc').value;m.stock=+document.getElementById('mk').value;m.price=+document.getElementById('mp').value;if(!id)S.materials.push(m)})}

// customerModal: เปิดฟอร์มลูกค้า
function customerModal(){modal('เพิ่มลูกค้า','<div class="form-grid">'+field('ชื่อลูกค้า','cn','')+field('พื้นที่','ca','สมุทรสาคร')+field('จำนวนออเดอร์','co',0)+'</div>',function(){S.customers.push({id:Date.now(),name:document.getElementById('cn').value,area:document.getElementById('ca').value,orders:+document.getElementById('co').value})})}

// orderModal: เปิดฟอร์มคำสั่งซื้อ
function orderModal(){modal('สร้างคำสั่งซื้อ','<div class="form-grid">'+field('เลขที่','oi','FG-2026-'+String(S.orders.length+1).padStart(3,'0'))+field('ลูกค้า','oc',S.customers[0].name)+field('วันที่','od','05/10/2569')+field('ยอดรวม','oa',0)+'</div>',function(){S.orders.unshift({id:document.getElementById('oi').value,customer:document.getElementById('oc').value,date:document.getElementById('od').value,amount:+document.getElementById('oa').value,status:'รอชำระ'})})}

// expenseModal: เปิดฟอร์มค่าใช้จ่าย
function expenseModal(){modal('บันทึกค่าใช้จ่าย','<div class="form-grid">'+field('วันที่','ed','05/10/2569')+field('ประเภท','et','วัตถุดิบ')+field('รายละเอียด','ex','')+field('จำนวนเงิน','ea',0)+'</div>',function(){S.expenses.unshift({date:document.getElementById('ed').value,type:document.getElementById('et').value,detail:document.getElementById('ex').value,amount:+document.getElementById('ea').value})})}

// recipeModal: เปิดฟอร์มสูตรอาหาร
function recipeModal(){var products=S.products||[],materials=S.materials||[];if(!products.length||!materials.length){toast('กรุณาเพิ่มสินค้าและวัตถุดิบก่อนสร้างสูตร');return}var productOptions=products.map(function(p){return '<option value="'+Number(p.id)+'">'+esc(p.name)+'</option>'}).join(''),rows=materials.map(function(m,i){return '<label class="recipe-material"><span><input type="checkbox" id="rm'+i+'"> '+esc(m.name)+' <small>฿'+money(m.price)+'/kg</small></span><input type="number" id="rq'+i+'" min="0.01" step="0.01" value="1" aria-label="ปริมาณ '+esc(m.name)+' kg"><small>kg/Batch</small></label>'}).join('');modal('สร้างสูตรอาหาร','<div class="form-grid">'+field('ชื่อสูตร','rn','สูตรใหม่')+'<div class="field"><label>สินค้าสำเร็จรูป</label><select id="rp">'+productOptions+'</select></div>'+field('ผลผลิตต่อ Batch (kg)','ry',100)+'</div><div class="field" style="margin-top:14px"><label>เลือกวัตถุดิบและกำหนดปริมาณต่อ Batch</label><div class="recipe-materials">'+rows+'</div></div>',function(){var name=document.getElementById('rn').value.trim(),productId=Number(document.getElementById('rp').value),yieldKg=Number(document.getElementById('ry').value),items=[];if(!name)throw new Error('กรุณาระบุชื่อสูตร');if(!yieldKg||yieldKg<=0)throw new Error('ผลผลิตต่อ Batch ต้องมากกว่า 0');materials.forEach(function(m,i){var checked=document.getElementById('rm'+i).checked,quantity=Number(document.getElementById('rq'+i).value);if(checked){if(!quantity||quantity<=0)throw new Error('ปริมาณวัตถุดิบต้องมากกว่า 0');items.push([m.name,quantity,Number(m.price)||0])}});if(!items.length)throw new Error('เลือกวัตถุดิบอย่างน้อย 1 รายการ');S.recipes.push({id:Date.now(),name:name,yieldKg:yieldKg,productId:productId,items:items})})}

// productionModal: เปิดฟอร์มการผลิต
function productionModal(){if(!S.recipes.length){toast('กรุณาสร้างสูตรอาหารก่อน');return}var options=S.recipes.map(function(r){return '<option value="'+Number(r.id)+'">'+esc(r.name)+' ('+money(r.yieldKg)+' kg/Batch)</option>'}).join('');modal('บันทึกการผลิต','<div class="form-grid"><div class="field"><label>สูตรอาหาร</label><select id="pr">'+options+'</select></div>'+field('วันที่ผลิต','pd',new Date().toISOString().slice(0,10))+field('จำนวน Batch','pb',1)+'</div><p class="muted">ระบบจะหักวัตถุดิบตามสูตรและเพิ่มสินค้าสำเร็จรูปเข้าสต็อก</p>',function(){var recipe=S.recipes.find(function(x){return String(x.id)===document.getElementById('pr').value}),batches=Number(document.getElementById('pb').value);if(!recipe)throw new Error('ไม่พบสูตรที่เลือก');if(!Number.isInteger(batches)||batches<=0)throw new Error('จำนวน Batch ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป');var product=S.products.find(function(p){return String(p.id)===String(recipe.productId)})||S.products.find(function(p){return p.name===recipe.name});if(!product)throw new Error('สูตรนี้ยังไม่ได้เชื่อมกับสินค้าสำเร็จรูป กรุณาสร้างสูตรใหม่และเลือกสินค้า');var requirements=[];for(var i=0;i<(recipe.items||[]).length;i++){var item=recipe.items[i],material=S.materials.find(function(m){return m.name===item[0]});if(!material)throw new Error('ไม่พบวัตถุดิบ '+item[0]+' กรุณาตรวจสอบสูตร');var quantity=Number(item[1])*batches;if(Number(material.stock)<quantity)throw new Error('วัตถุดิบ '+material.name+' ไม่พอ (ต้องใช้ '+money(quantity)+' kg)');requirements.push({material:material,quantity:quantity})}if(!requirements.length)throw new Error('สูตรนี้ยังไม่มีวัตถุดิบ');requirements.forEach(function(x){x.material.stock=Number(x.material.stock)-x.quantity});var output=Number(recipe.yieldKg)*batches;product.stock=Number(product.stock||0)+output;var cost=recipeCost(recipe)*batches;S.productionRuns.push({id:Date.now(),date:document.getElementById('pd').value,recipeId:recipe.id,recipeName:recipe.name,batch:batches,quantity:output,cost:cost})})}

// filter: กรองข้อมูลในตาราง
function filter(e){var q=e.value.toLowerCase();document.querySelectorAll('#rows tr').forEach(function(r){r.style.display=r.textContent.toLowerCase().indexOf(q)>=0?'':'none'})}

// toast: แสดงข้อความแจ้งเตือน
function toast(t){var e=document.getElementById('toast');e.textContent=t;e.className='toast show';setTimeout(function(){e.className='toast'},1800)}

// resetDemo: รีเซ็ตข้อมูล Demo
function resetDemo(){localStorage.removeItem('fg');location.reload()}

// hydrateProfile: โหลด profile และ role ของผู้ใช้จาก Supabase
async function hydrateProfile(user) {
    var r=await window.fishgrowSupabase.from('profiles').select('id,full_name,email,phone,role').eq('id',user.id).maybeSingle();if(r.error)throw r.error;if(!r.data)throw new Error('ไม่พบข้อมูลโปรไฟล์ของบัญชีนี้');AUTH_STATE.profile=r.data;currentUser=user
  }

// loadRemoteState: โหลดข้อมูลธุรกิจ Admin จาก Supabase
async function loadRemoteState() {
    if(!currentUser||!AUTH_STATE.profile||AUTH_STATE.profile.role!=='admin')return;var r=await window.fishgrowSupabase.from('app_state').select('data').eq('id',1).maybeSingle();if(r.error) {
      console.warn('โหลด app_state ไม่สำเร็จ',r.error);return
    }
    if(r.data&&r.data.data)Object.assign(S,r.data.data);remoteStateLoaded=true
  }

// syncAppState: ซิงก์ state ของ Admin ไปยัง Supabase
async function syncAppState() {
    if(!currentUser||!AUTH_STATE.profile||AUTH_STATE.profile.role!=='admin'||!window.fishgrowSupabase)return;var r=await window.fishgrowSupabase.from('app_state').upsert({id:1,data:S,updated_at:new Date().toISOString()},{onConflict:'id'});if(r.error) {
      console.warn('บันทึก app_state ไม่สำเร็จ',r.error);return
    }
    var catalog=(S.products||[]).map(function(p) {
      return {product_id:Number(p.id),sku:String(p.sku||('FG-'+p.id)),name:String(p.name||''),stock:Number(p.stock)||0,price:Number(p.price)||0,image_url:safeImageUrl(p.image_url)||null,is_available:true,updated_at:new Date().toISOString()}
    });if(catalog.length) {
      var c=await window.fishgrowSupabase.from('store_products').upsert(catalog,{onConflict:'product_id'});if(c.error)console.warn('อัปเดตสินค้าในหน้าร้านไม่สำเร็จ',c.error)
    }
  }

// authMode: เปลี่ยนโหมด User Login, สมัครสมาชิก และ Admin Login
function authMode(mode) {
    AUTH_STATE.mode=mode;renderAuth()
  }

// renderAuth: สร้างหน้าล็อกอิน/สมัครสมาชิกและผูก form
function renderAuth(message,error) {
    var signup=AUTH_STATE.mode==='signup',admin=AUTH_STATE.mode==='admin-login';var title=signup?'สมัครสมาชิกผู้ใช้ทั่วไป':admin?'เข้าสู่ระบบ Admin':'เข้าสู่ระบบผู้ใช้';var submit=signup?'สมัครสมาชิก':'เข้าสู่ระบบ';var notice=error?'<div class="auth-message error">'+esc(error)+'</div>':message?'<div class="auth-message">'+esc(message)+'</div>':'';document.getElementById('app').innerHTML='<div class="auth-shell"><div class="auth-brand"><div class="brand-mark"><img src="assets/logo.png" alt="FISHGROW"></div><h1>FISHGROW</h1><p class="eyebrow">SMART FEED MANAGEMENT</p><p>ระบบจัดการธุรกิจอาหารปลากะพงขาวที่เชื่อมต่อข้อมูลอย่างปลอดภัย</p><div class="auth-points"><span>✓ บัญชีผู้ใช้แยกจากระบบ Admin</span><span>✓ ข้อมูลสิทธิ์จัดการจาก Supabase</span><span>✓ รักษาข้อมูลธุรกิจเดิมของ FISHGROW</span></div></div><div class="auth-card"><div class="auth-tabs"><button class="'+(AUTH_STATE.mode==='user-login'?'active':'')+'" onclick="authMode(\'user-login\')">User Login</button><button class="'+(signup?'active':'')+'" onclick="authMode(\'signup\')">สมัครสมาชิก</button><button class="'+(admin?'active':'')+'" onclick="authMode(\'admin-login\')">Admin Login</button></div><div class="auth-heading"><span class="badge">'+(admin?'ADMIN PORTAL':'FISHGROW ACCOUNT')+'</span><h2>'+title+'</h2><p>'+(signup?'สร้างบัญชีเพื่อใช้งานหน้า User':admin?'สำหรับบัญชีที่ได้รับ role admin เท่านั้น':'เข้าสู่ระบบเพื่อดูข้อมูลบัญชีของคุณ')+'</p></div>'+notice+'<form id="auth-form" class="auth-form">'+(signup?'<div class="field"><label>ชื่อ-นามสกุล</label><input name="full_name" autocomplete="name" required></div>':'')+'<div class="field"><label>อีเมล</label><input name="email" type="email" autocomplete="email" required></div>'+(signup?'<div class="field"><label>เบอร์โทรศัพท์</label><input name="phone" autocomplete="tel"></div>':'')+'<div class="field"><label>รหัสผ่าน</label><input name="password" type="password" minlength="6" autocomplete="'+(signup?'new-password':'current-password')+'" required></div><button class="btn green auth-submit" type="submit">'+submit+'</button></form><p class="auth-footnote">'+(admin?'ระบบจะตรวจ role จาก profiles ใน Supabase ก่อนเปิด Dashboard':signup?'สมัครแล้วอาจต้องยืนยันอีเมลก่อนเข้าสู่ระบบ':'หากยังไม่มีบัญชี ให้เลือก “สมัครสมาชิก”')+'</p></div></div>';document.getElementById('auth-form').onsubmit=handleAuthSubmit
  }

// handleAuthSubmit: จัดการสมัครสมาชิกและ Login พร้อมตรวจ role
async function handleAuthSubmit(event) {
    event.preventDefault();var form=event.currentTarget;var values=Object.fromEntries(new FormData(form).entries());var button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='กำลังตรวจสอบ...';try {
      if(AUTH_STATE.mode==='signup') {
        var signUp=await window.fishgrowSupabase.auth.signUp({email:values.email,password:values.password,options:{data:{full_name:values.full_name||'',phone:values.phone||''}}});if(signUp.error)throw signUp.error;if(!signUp.data.session) {
          renderAuth('สมัครสมาชิกสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');return
        }
        await bootstrapAuth();return
      }
      var signIn=await window.fishgrowSupabase.auth.signInWithPassword({email:values.email,password:values.password});if(signIn.error)throw signIn.error;await hydrateProfile(signIn.data.user);var isAdmin=AUTH_STATE.profile.role==='admin';if(AUTH_STATE.mode==='admin-login'&&!isAdmin) {
        await window.fishgrowSupabase.auth.signOut();currentUser=null;AUTH_STATE.profile=null;throw new Error('บัญชีนี้ไม่มีสิทธิ์ Admin')
      }
      if(AUTH_STATE.mode==='user-login'&&isAdmin) {
        await window.fishgrowSupabase.auth.signOut();currentUser=null;AUTH_STATE.profile=null;throw new Error('บัญชีนี้เป็น Admin กรุณาใช้ Admin Login')
      }
      await finishLogin()
    } catch(error) {
      renderAuth('',error.message||'ไม่สามารถเข้าสู่ระบบได้')
    }
  }

// finishLogin: เตรียมข้อมูลหลัง Login แยกตาม role
async function finishLogin() {
    remoteStateLoaded=false;USER_CART={};if(AUTH_STATE.profile.role==='admin') {
      await loadRemoteState();await loadAdminWebOrders();await loadAdminStoreStock();await syncAppState();S.page=S.page.indexOf('user-')===0?'dashboard':S.page
    } else {
      S.page='user';await loadStorefront()
    }
    render()
  }

// bootstrapAuth: ตรวจ session ปัจจุบันและเริ่มระบบ
async function bootstrapAuth() {
    if(!window.fishgrowSupabase) {
      renderAuth('','ไม่พบการเชื่อมต่อ Supabase');return
    }
    var result=await window.fishgrowSupabase.auth.getUser();if(result.error||!result.data.user) {
      currentUser=null;AUTH_STATE.profile=null;remoteStateLoaded=false;renderAuth();return
    }
    try {
      await hydrateProfile(result.data.user);await finishLogin()
    } catch(error) {
      await window.fishgrowSupabase.auth.signOut();currentUser=null;AUTH_STATE.profile=null;renderAuth('',error.message||'ไม่สามารถโหลดโปรไฟล์ได้')
    }
  }

// signOutUser: ออกจากระบบผ่าน Supabase Auth
async function signOutUser() {
    await window.fishgrowSupabase.auth.signOut()
  }

// updateProfile: บันทึกข้อมูล profile ของ User
async function updateProfile() {
    var fullName=document.getElementById('profile-name').value.trim(),phone=document.getElementById('profile-phone').value.trim();if(!fullName) {
      toast('กรุณาระบุชื่อ-นามสกุล');return
    }
    try {
      var result=await window.fishgrowSupabase.from('profiles').update({full_name:fullName,phone:phone}).eq('id',currentUser.id).select('id,full_name,email,phone,role').single();if(result.error)throw result.error;AUTH_STATE.profile=result.data;render();toast('อัปเดตโปรไฟล์แล้ว')
    } catch(error) {
      toast('บันทึกโปรไฟล์ไม่สำเร็จ: '+(error.message||'กรุณาลองใหม่'))
    }
  }
  async function loadStorefront() {
    var p=await window.fishgrowSupabase.from('store_products').select('product_id,sku,name,stock,price,image_url,is_available').eq('is_available',true).order('name');if(p.error)throw p.error;USER_PRODUCTS=p.data||[];var o=await window.fishgrowSupabase.from('store_orders').select('id,customer_name,phone,delivery_address,note,status,total_amount,items,created_at').eq('user_id',currentUser.id).order('created_at',{ascending:false});if(o.error)throw o.error;USER_ORDERS=o.data||[]
  }

// loadAdminWebOrders: โหลดคำสั่งซื้อออนไลน์สำหรับ Admin
async function loadAdminWebOrders() {
    var r=await window.fishgrowSupabase.from('store_orders').select('id,customer_name,status,total_amount,created_at,items,payment_status,payment_method,payment_proof_path,tracking_number').order('created_at',{ascending:false}).limit(100);if(r.error) {
      console.warn('โหลดคำสั่งซื้อออนไลน์ไม่สำเร็จ',r.error);ADMIN_WEB_ORDERS=[];return
    }
    ADMIN_WEB_ORDERS=(r.data||[]).map(function(o) {
      o.order_code='FGW-'+String(o.id).padStart(6,'0');return o
    })
  }

// updateStorePaymentStatus: Admin ตรวจสอบสถานะการชำระเงิน
async function updateStorePaymentStatus(orderId,status) {
  if(['pending','submitted','verified','rejected'].indexOf(status)<0)return;
  var r=await window.fishgrowSupabase.from('store_orders').update({payment_status:status}).eq('id',Number(orderId)).select('id,payment_status').maybeSingle();
  if(r.error||!r.data){toast('อัปเดตสถานะการชำระเงินไม่สำเร็จ');return}
  await loadAdminWebOrders();render();toast('อัปเดตสถานะการชำระเงินแล้ว')
}

// viewPaymentProof: สร้างลิงก์ชั่วคราวสำหรับ Admin ดูหลักฐาน
async function viewPaymentProof(path) {
  var r=await window.fishgrowSupabase.storage.from('payment-proofs').createSignedUrl(path,300);
  if(r.error||!r.data){toast('เปิดหลักฐานไม่สำเร็จ');return}
  window.open(r.data.signedUrl,'_blank','noopener,noreferrer')
}

// updateStoreTracking: Admin บันทึกเลขติดตามพัสดุ
async function updateStoreTracking(orderId) {
  var tracking=window.prompt('กรอกเลข Tracking ของคำสั่งซื้อ');
  if(tracking===null)return;
  tracking=tracking.trim();
  var r=await window.fishgrowSupabase.from('store_orders').update({tracking_number:tracking||null}).eq('id',Number(orderId)).select('id,tracking_number').maybeSingle();
  if(r.error||!r.data){toast('บันทึก Tracking ไม่สำเร็จ');return}
  await loadAdminWebOrders();render();toast('บันทึก Tracking แล้ว')
}
// refreshAdminOrders: รีเฟรชคำสั่งซื้อออนไลน์
async function refreshAdminOrders() {
    await loadAdminWebOrders();render()
  }

// loadAdminStoreStock: โหลดสต็อกจากหน้าร้านเข้า state Admin
async function loadAdminStoreStock() {
    var r=await window.fishgrowSupabase.from('store_products').select('product_id,stock');if(r.error) {
      console.warn('โหลดสต็อกหน้าร้านไม่สำเร็จ',r.error);return
    }
    var stockById={};(r.data||[]).forEach(function(p) {
      stockById[String(p.product_id)]=Number(p.stock)
    });(S.products||[]).forEach(function(p) {
      if(Object.prototype.hasOwnProperty.call(stockById,String(p.id)))p.stock=stockById[String(p.id)]
    })
  }

// businessOrders: รวมคำสั่งซื้อจาก state เดิมและหน้าร้านออนไลน์
function businessOrders() {
    return (S.orders||[]).concat(ADMIN_WEB_ORDERS.map(function(o) {
      return {id:o.order_code,storeOrderId:o.id,customer:o.customer_name,date:new Date(o.created_at).toLocaleDateString('th-TH'),amount:Number(o.total_amount),status:o.status}
    }))
  }

// isRecognizedOrder: ตรวจคำสั่งซื้อที่นับเป็นรายรับแล้ว
function isRecognizedOrder(o) {
    return o.status==='ชำระแล้ว'||o.status==='เสร็จสิ้น'||o.status==='completed'
  }

// isPendingOrder: ตรวจคำสั่งซื้อที่ยังรอดำเนินการ
function isPendingOrder(o) {
    return o.status!=='ยกเลิก'&&o.status!=='cancelled'&&!isRecognizedOrder(o)
  }

// recognizedIncome: รวมรายรับที่รับรู้แล้ว
function recognizedIncome() {
    return businessOrders().filter(isRecognizedOrder).reduce(function(a,o) {
      return a+Number(o.amount||0)
    },0)
  }

// pendingOrderValue: รวมมูลค่าออเดอร์ที่ยังรอ
function pendingOrderValue() {
    return businessOrders().filter(isPendingOrder).reduce(function(a,o) {
      return a+Number(o.amount||0)
    },0)
  }
  function cartCount() {
    return Object.keys(USER_CART).reduce(function(n,id) {
      return n+USER_CART[id]
    },0)
  }

// adjustCart: เพิ่ม/ลดสินค้าในตะกร้าโดยไม่เกินสต็อก
function adjustCart(id,delta) {
    var p=USER_PRODUCTS.find(function(x) {
      return String(x.product_id)===String(id)
    });if(!p)return;var next=(USER_CART[id]||0)+delta;if(next<=0)delete USER_CART[id];else if(next<=Number(p.stock))USER_CART[id]=next;render()
  }

// submitStoreOrder: ส่งคำสั่งซื้อของ User ไปยัง Supabase
async function submitStoreOrder(event) {
    event.preventDefault();var form=event.currentTarget,button=form.querySelector('button[type=submit]'),values=Object.fromEntries(new FormData(form).entries()),items=Object.keys(USER_CART).map(function(id) {
      return {product_id:Number(id),quantity:USER_CART[id]}
    });if(!items.length) {
      toast('กรุณาเลือกสินค้า');return
    }
    button.disabled=true;button.textContent='กำลังส่งคำสั่งซื้อ...';var result;try {
      result=await window.fishgrowSupabase.from('store_orders').insert({user_id:currentUser.id,customer_name:values.customer_name,phone:values.phone,delivery_address:values.delivery_address,note:values.note||'',items:items}).select('id').single()
    } catch(error) {
      result={error:error}
    }
    if(result.error) {
      toast('ส่งคำสั่งซื้อไม่สำเร็จ: '+(result.error.message||'กรุณาลองใหม่'));button.disabled=false;button.textContent='ยืนยันคำสั่งซื้อ';return
    }
    USER_CART={};S.page='user-orders';try {
      await loadStorefront();render();toast('ส่งคำสั่งซื้อเรียบร้อยแล้ว')
    } catch(error) {
      render();toast('รับคำสั่งซื้อแล้ว แต่โหลดประวัติไม่สำเร็จ: '+(error.message||'กรุณากดรีเฟรช'))
    }
  }
  function userShop() {
    var cartHtml=Object.keys(USER_CART).length?Object.keys(USER_CART).map(function(id) {
      var p=USER_PRODUCTS.find(function(x) {
        return String(x.product_id)===String(id)
      });return p?'<div class="cart-line"><span>'+esc(p.name)+' × '+USER_CART[id]+' kg</span><b>฿'+money(p.price*USER_CART[id])+'</b></div>':''
    }).join(''):'<p class="muted">ยังไม่มีสินค้าในตะกร้า</p>';var total=Object.keys(USER_CART).reduce(function(n,id) {
      var p=USER_PRODUCTS.find(function(x) {
        return String(x.product_id)===String(id)
      });return n+(p?p.price*USER_CART[id]:0)
    },0);return '<div class="page-head"><div><h2>เลือกซื้อสินค้า</h2><p>อาหารปลากะพงขาว FISHGROW สั่งซื้อได้จากบัญชีของคุณ</p></div><span class="badge">'+cartCount()+' รายการในตะกร้า</span></div><div class="store-grid">'+(USER_PRODUCTS.length?USER_PRODUCTS.map(function(p) {
      var qty=USER_CART[p.product_id]||0,inStock=Number(p.stock)>0;return '<article class="card product-card"><div class="product-mark">'+(safeImageUrl(p.image_url)?'<img src="'+esc(safeImageUrl(p.image_url))+'" alt="'+esc(p.name)+'" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\'"><span style="display:none">รูปภาพไม่พร้อม</span>':'🐟')+'</div><span class="badge '+(inStock?'':'warn')+'">'+(inStock?'พร้อมจำหน่าย':'สินค้าหมด')+'</span><h3>'+esc(p.name)+'</h3><p class="muted">รหัส '+esc(p.sku)+'</p><div class="product-price">฿'+money(p.price)+' <small>/ kg</small></div><div class="product-buy"><button class="btn light" onclick="adjustCart('+p.product_id+',-1)" '+(!qty?'disabled':'')+'>−</button><b>'+qty+'</b><button class="btn light" onclick="adjustCart('+p.product_id+',1)" '+(qty>=p.stock?'disabled':'')+'>+</button><button class="btn green" onclick="adjustCart('+p.product_id+',1)" '+(qty>=p.stock?'disabled':'')+'>ใส่ตะกร้า</button></div></article>'
    }).join(''):'<div class="card">ยังไม่มีสินค้าเปิดขาย กรุณาติดต่อผู้ดูแล</div>')+'</div><div class="card checkout-card"><div class="section-title"><h3>ตะกร้าสินค้า</h3><b>รวม ฿'+money(total)+'</b></div>'+cartHtml+(cartCount()?'<form class="checkout-form" onsubmit="submitStoreOrder(event)"><div class="form-grid"><div class="field"><label>ชื่อผู้รับ</label><input name="customer_name" value="'+esc(AUTH_STATE.profile.full_name)+'" required></div><div class="field"><label>เบอร์โทรศัพท์</label><input name="phone" value="'+esc(AUTH_STATE.profile.phone)+'" required></div><div class="field full"><label>ที่อยู่จัดส่ง</label><textarea name="delivery_address" rows="3" required></textarea></div><div class="field full"><label>หมายเหตุ</label><input name="note" placeholder="เช่น เวลาที่สะดวกให้จัดส่ง"></div></div><button class="btn green" type="submit">ยืนยันคำสั่งซื้อ</button></form>':'')+'</div>'
  }
  function userOrders() {
    var rows=USER_ORDERS.map(function(o) {
      return '<article class="card order-card"><div class="section-title"><h3>คำสั่งซื้อ FGW-'+String(o.id).padStart(6,'0')+'</h3><span class="badge '+orderStatusClass(o.status)+'">'+esc(o.status)+'</span></div><p class="muted">'+new Date(o.created_at).toLocaleString('th-TH')+'</p><div class="order-items">'+(o.items||[]).map(function(i) {
        return '<div class="cart-line"><span>'+esc(i.name)+' × '+i.quantity+' kg</span><b>฿'+money(i.line_total)+'</b></div>'
      }).join('')+'</div><p><b>รวม ฿'+money(o.total_amount)+'</b></p><p class="muted">จัดส่ง: '+esc(o.delivery_address)+'</p></article>'
    }).join('');return '<div class="page-head"><div><h2>คำสั่งซื้อของฉัน</h2><p>ติดตามรายการสั่งซื้อที่ส่งให้ FISHGROW</p></div><button class="btn light" onclick="navigateUser(\'orders\')">↻ รีเฟรช</button></div><div class="grid">'+(rows||'<div class="card muted">ยังไม่มีคำสั่งซื้อ</div>')+'</div>'
  }
  function userHome() {
    var p=AUTH_STATE.profile||{};return `<div class="page-head"><div><h2>ข้อมูลบัญชี</h2><p>แก้ไขข้อมูลบัญชี FISHGROW ของคุณ</p></div><span class="badge">USER</span></div><div class="grid two"><div class="card"><div class="section-title"><h3>ข้อมูลบัญชี</h3><span class="muted">${esc(p.email||currentUser.email)}</span></div><div class="form-grid"><div class="field"><label>ชื่อ-นามสกุล</label><input id="profile-name" value="${esc(p.full_name)}"></div><div class="field"><label>เบอร์โทรศัพท์</label><input id="profile-phone" value="${esc(p.phone)}"></div></div><button class="btn green" style="margin-top:16px" onclick="updateProfile()">บันทึกข้อมูล</button></div><div class="card user-welcome"><div class="product-mark">🐟</div><h3>ยินดีต้อนรับสู่ FISHGROW</h3><p>เลือกซื้ออาหารปลาได้จากร้านค้า และติดตามคำสั่งซื้อได้ทุกเมื่อ</p><button class="btn green" data-page="shop" onclick="navigateUser(this.dataset.page)">ไปที่ร้านค้า</button></div></div>`
  }

// navigateUser: เปลี่ยนหน้า User และโหลดข้อมูลใหม่
async function navigateUser(page) {
    S.page='user-'+page;try {
      await loadStorefront();render()
    } catch(error) {
      render();toast('โหลดข้อมูลร้านค้า/คำสั่งซื้อไม่สำเร็จ: '+(error.message||'กรุณาลองใหม่'))
    }
  }
  function userPage(page) {
    if(page)S.page='user-'+page;var selected=S.page==='user-orders'?'orders':S.page==='user-account'?'account':'shop';return selected==='orders'?userOrders():selected==='account'?userHome():userShop()
  }

// userLayout: สร้าง layout และเมนูของหน้า User
function userLayout(c) {
    var links=[['shop','▣','ร้านค้า'],['orders','🛒','คำสั่งซื้อของฉัน'],['account','♙','บัญชีของฉัน']];document.getElementById('app').innerHTML='<div class="app user-app"><aside class="sidebar"><div class="brand"><div class="brand-mark"><img src="assets/logo.png" alt="FISHGROW"></div><div><h1>FISHGROW</h1><small>SMART FEED STORE</small></div></div><div class="nav"><div style="font-size:11px;opacity:.5;padding:8px">เมนูผู้ใช้</div>'+links.map(function(m) {
      return '<button class="'+((S.page==='user-'+m[0]||(m[0]==='shop'&&S.page==='user'))?'active':'')+'" data-page="'+m[0]+'" onclick="navigateUser(this.dataset.page)">'+m[1]+' &nbsp; '+m[2]+(m[0]==='shop'&&cartCount()?' ('+cartCount()+')':'')+'</button>'
    }).join('')+'</div></aside><main class="main"><div class="topbar"><span>FISHGROW / ร้านค้า</span><div class="session-actions"><span class="session-chip">'+esc(AUTH_STATE.profile.full_name||currentUser.email)+'</span><button class="btn light" onclick="signOutUser()">ออกจากระบบ</button></div></div>'+c+'</main><div id="toast" class="toast"></div></div>'
  }

// showStartupError: แสดงหน้าข้อผิดพลาดเมื่อเริ่มระบบไม่ได้
function showStartupError(error) {

  var app=document.getElementById('app');
  if(!app)return;
  app.innerHTML='<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#F5F4ED;color:#26343b;font-family:Arial,sans-serif"><section style="max-width:560px;background:#fff;padding:28px;border-radius:16px;box-shadow:0 8px 28px #263b4a14"><h1 style="margin-top:0">FISHGROW</h1><h2>เปิดหน้าเว็บไม่สำเร็จ</h2><p>ระบบโหลดข้อมูลเริ่มต้นไม่ได้ กรุณารีเฟรชหน้าเว็บ หรือติดต่อผู้ดูแล</p><details><summary>รายละเอียดสำหรับตรวจสอบ</summary><pre style="white-space:pre-wrap">'+esc(error&&error.message||String(error||'ไม่ทราบสาเหตุ'))+'</pre></details></section></main>';
}

// initializeAuth: ตั้ง listener ของ Supabase Auth และเริ่มตรวจ session
function initializeAuth() {

  try {

    if(!window.fishgrowSupabase) {
        renderAuth('','ไม่พบไฟล์ Supabase client');return
      }

    window.fishgrowSupabase.auth.onAuthStateChange(function(event) {

      if(event==='SIGNED_OUT') {
          currentUser=null;AUTH_STATE.profile=null;remoteStateLoaded=false;S.page='dashboard';renderAuth()
        } 
      else if((event==='SIGNED_IN'||event==='TOKEN_REFRESHED')&&!currentUser) {
          setTimeout(bootstrapAuth,0)
        }

    });
    bootstrapAuth().catch(function(error) {
        showStartupError(error)
      });
  } catch(error) {
      showStartupError(error)
    }

}

window.addEventListener('error',function(event) {
    if(!document.getElementById('app')?.innerHTML.trim())showStartupError(event.error||event.message)
  });
window.addEventListener('unhandledrejection',function(event) {
    showStartupError(event.reason)
  });

// render: เลือกหน้าที่ต้องแสดงตาม role และ S.page
async function render() {
    if(AUTH_STATE.profile&&AUTH_STATE.profile.role==='admin')load();
    if(!currentUser||!AUTH_STATE.profile)return renderAuth();
    var p={dashboard:dashboard,products:products,materials:materials,recipes:recipes,production:production,stock:stock,customers:customers,orders:orders,finance:finance,reports:reports,'store-settings':storeSettings,'knowledge-admin':knowledgeAdmin,'recommendation-admin':recommendationAdmin,'product-metadata':productMetadata};
    if(AUTH_STATE.profile.role!=='admin')return layout(userPage());
    if(!p[S.page])S.page='dashboard';
    if(S.page==='knowledge-admin') await loadKnowledgeAdmin();
    if(S.page==='recommendation-admin') await loadRecommendationAdmin();
    layout(await p[S.page]());
  }

initializeAuth();
