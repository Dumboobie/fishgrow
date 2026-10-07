/* FISHGROW public website
 * Public storefront + recommendation wizard + feed calculator.
 * Uses the existing Supabase browser client and existing store_products table.
 */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const app = $('#app');
  const supabase = window.fishgrowSupabase;
  const state = {
    page: 'home',
    products: [],
    settings: null,
    recommendationRules: [],
    articles: [],
    selectedProduct: null,
    user: null,
    cart: JSON.parse(localStorage.getItem('fg_public_cart') || '{}'),
    compare: JSON.parse(localStorage.getItem('fg_public_compare') || '[]'),
    recommendation: { fish: '', stage: '', goal: '', farm: '' },
    calculator: { count: '', weight: '', rate: '', price: '' },
    orderCode: ''
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const money = (value) => new Intl.NumberFormat('th-TH', {
    maximumFractionDigits: 2
  }).format(Number(value) || 0);

  const saveCart = () => localStorage.setItem('fg_public_cart', JSON.stringify(state.cart));
  const saveCompare = () => localStorage.setItem('fg_public_compare', JSON.stringify(state.compare));
  const cartCount = () => Object.values(state.cart).reduce((sum, n) => sum + Number(n || 0), 0);
  const cartTotal = () => state.products.reduce((sum, p) => sum + Number(p.price || 0) * Number(state.cart[p.product_id] || 0), 0);

  // FISHGROW process gallery uses the real repository assets below.
  // Keep these paths local so Vercel serves the exact files shipped with the site.
  const ABOUT_MEDIA = {
    heroImageUrl: 'pic6.jpg?v=1',
    storyImageUrl: '',
    videoPosterUrl: '',
    youtubeUrl: '',
    heroVideoUrl: 'assets/hero-bg.mp4',
    videoUrl: 'video2.mp4?v=1',
    gallery: [
      { label: 'คัดวัตถุดิบ', detail: 'ภาพกระบวนการคัดเลือกวัตถุดิบจริง', url: 'pic1.jpg?v=4' },
      { label: 'แปรรูป', detail: 'ภาพการเตรียมวัตถุดิบจริง', url: 'pic2.jpg?v=4' },
      { label: 'ผสมสูตร', detail: 'ภาพการผสมสูตรอาหารจริง', url: 'pic3.jpg?v=4' },
      { label: 'อัดเม็ด', detail: 'ภาพขั้นตอนการอัดเม็ดจริง', url: 'pic4.jpg?v=4' },
      { label: 'บรรจุ', detail: 'ภาพบรรจุภัณฑ์จริง', url: 'pic5.jpg?v=4' }
    ]
  };

  const aboutMediaPlaceholder = (title, detail) =>
    '<div class="fg-media-placeholder" role="img" aria-label="' + esc(title) + '"><span class="fg-media-placeholder-icon">◌</span><strong>' + esc(title) + '</strong><small>' + esc(detail) + '</small><em>MEDIA PLACEHOLDER · เพิ่ม asset จริงภายหลัง</em></div>';

  const aboutImage = (url, alt, className) => url
    ? '<img class="' + (className || '') + '" src="' + esc(url) + '" alt="' + esc(alt) + '" loading="lazy">'
    : aboutMediaPlaceholder('ยังไม่มีภาพจริง', alt);

  function aboutVideo() {
    if (ABOUT_MEDIA.youtubeUrl) {
      return '<div class="fg-video-frame"><iframe src="' + esc(ABOUT_MEDIA.youtubeUrl) + '" title="วิดีโอแนะนำ FISHGROW" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>';
    }
    if (ABOUT_MEDIA.videoUrl) {
      return '<div class="fg-video-frame"><video autoplay muted loop playsinline preload="auto"' + (ABOUT_MEDIA.videoPosterUrl ? ' poster="' + esc(ABOUT_MEDIA.videoPosterUrl) + '"' : '') + '><source src="' + esc(ABOUT_MEDIA.videoUrl) + '" type="video/mp4">เบราว์เซอร์นี้ไม่รองรับวิดีโอ MP4</video></div>';
    }
    return '<div class="fg-video-frame fg-video-placeholder" data-about-video>' + aboutMediaPlaceholder('วิดีโอแนะนำ FISHGROW', 'รองรับ YouTube หรือ MP4 เมื่อมีวิดีโอจริง') + '<button class="fg-media-play" type="button" data-media-play aria-label="เปิดวิดีโอแนะนำ FISHGROW">▶</button></div>';
  }

  function heroVideo() {
    if (!ABOUT_MEDIA.videoUrl) {
      return '<div class="fg-video-frame fg-video-placeholder">' +
        aboutMediaPlaceholder('วิดีโอแนะนำ FISHGROW', 'ยังไม่มีไฟล์วิดีโอ') +
        '</div>';
    }

    const videoUrl = esc(ABOUT_MEDIA.videoUrl);
    const poster = ABOUT_MEDIA.videoPosterUrl
      ? ' poster="' + esc(ABOUT_MEDIA.videoPosterUrl) + '"'
      : '';

    return '<div class="fg-video-frame fg-hero-video">' +
      '<video autoplay muted loop playsinline preload="auto" controls' + poster +
      ' aria-label="วิดีโอแนะนำ FISHGROW" data-hero-video>' +
      '<source src="' + videoUrl + '" type="video/mp4">' +
      'เบราว์เซอร์นี้ไม่รองรับวิดีโอ MP4' +
      '</video>' +
      '<div class="fg-video-error" data-hero-video-error hidden>' +
      '<strong>ไม่สามารถโหลดวิดีโอได้</strong>' +
      '<span>ตรวจสอบไฟล์ video1.mp4 หรือการ deploy บน Vercel</span>' +
      '</div>' +
      '</div>';
  }

  async function loadProducts() {
    if (!supabase) {
      console.error('FISHGROW: Supabase client is not available.');
      return;
    }

    try {
      const authResult = await supabase.auth.getUser();
      if (!authResult.error) state.user = authResult.data.user || null;
    } catch (error) {
      console.warn('FISHGROW: auth check failed, continuing as public visitor.', error);
    }

    // Load each public resource independently so a non-critical query
    // cannot prevent the product catalog from appearing on the Home page.
    const productResult = await supabase
      .from('store_products')
      .select('product_id,sku,name,stock,price,is_available,image_url,updated_at,fish_types,stages,goals,pellet_size,protein_pct,description,ingredients,usage_note,storage_note')
      .eq('is_available', true)
      .order('product_id');

    if (productResult.error) {
      console.error('FISHGROW: failed to load products:', productResult.error);
      // Retry with only the fields required to render product cards.
      const fallback = await supabase
        .from('store_products')
        .select('product_id,sku,name,stock,price,is_available,image_url')
        .eq('is_available', true)
        .order('product_id');

      if (!fallback.error) {
        state.products = fallback.data || [];
      } else {
        console.error('FISHGROW: product fallback also failed:', fallback.error);
        state.products = [];
      }
    } else {
      state.products = productResult.data || [];
    }

    const [settingsResult, articlesResult, rulesResult] = await Promise.allSettled([
      supabase.from('store_settings').select('store_name,promptpay_name,promptpay_number,bank_name,bank_account_name,bank_account_number,cod_enabled,shipping_note,contact_phone,contact_line,contact_email').eq('id', 1).maybeSingle(),
      supabase.from('knowledge_articles').select('id,slug,title,excerpt,content,category,cover_image_url,published_at').eq('is_published', true).order('published_at', { ascending: false }),
      supabase.from('store_product_recommendation_rules').select('product_id,fish_type,stage,goal,farm_size,priority,reason').eq('is_active', true).order('priority', { ascending: false })
    ]);

    if (settingsResult.status === 'fulfilled' && !settingsResult.value.error) {
      state.settings = settingsResult.value.data || null;
    }
    if (articlesResult.status === 'fulfilled' && !articlesResult.value.error) {
      state.articles = articlesResult.value.data || [];
    }
    if (rulesResult.status === 'fulfilled' && !rulesResult.value.error) {
      state.recommendationRules = rulesResult.value.data || [];
    }

    console.info('FISHGROW: loaded products:', state.products.length);
  }

  function setupHeroVideo() {
    const video = document.querySelector('[data-hero-video]');
    const errorBox = document.querySelector('[data-hero-video-error]');
    if (!video) return;

    video.addEventListener('error', () => {
      if (errorBox) errorBox.hidden = false;
    });

    video.addEventListener('loadeddata', () => {
      if (errorBox) errorBox.hidden = true;
    });

    // Force the browser to resolve the asset after the DOM has been rendered.
    video.load();
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Autoplay may be blocked; controls remain available.
      });
    }
  }

  function navItem(page, label) {
    return '<a class="' + (state.page === page ? 'active' : '') +
      '" href="#' + page + '" data-nav="' + page + '">' + label + '</a>';
  }

  function header() {
    const accountAction = state.user
      ? '<span class="fg-session-email">' + esc(state.user.email) + '</span><button class="fg-btn fg-btn-light fg-order-top" type="button" data-public-signout>ออกจากระบบ</button>'
      : '<a class="fg-btn fg-btn-green fg-order-top" href="?mode=account">เข้าสู่ระบบ / สั่งซื้อ</a>';
    return '<header class="fg-header"><div class="fg-container fg-nav">' +
      '<a class="fg-logo" href="#home"><img class="fg-logo-image" src="assets/logo.png" alt=""><span class="fg-wordmark">Fish<span>Grow</span></span></a>' +
      '<nav class="fg-main-nav">' +
      navItem('home', 'หน้าหลัก') +
      navItem('products', 'สินค้า') +
      navItem('recommend', 'เลือกอาหาร') +
      navItem('calculator', 'คำนวณอาหาร') +
      navItem('howto', 'วิธีใช้') +
      navItem('about', 'เกี่ยวกับเรา') +
      '</nav>' +
      '<div class="fg-nav-actions">' +
      '<a class="fg-cart-link" href="#cart">🛒 ตะกร้า <b>' + cartCount() + '</b></a>' +
      accountAction +
      '<button class="fg-menu-btn" type="button" aria-label="เปิดเมนู">☰</button>' +
      '</div></div></header>';
  }

  function footer() {
    return '<footer class="fg-footer"><div class="fg-container fg-footer-grid">' +
      '<div><a class="fg-logo" href="#home"><img class="fg-logo-image" src="assets/logo.png" alt=""><span class="fg-wordmark">Fish<span>Grow</span></span></a>' +
      '<p>เปลี่ยนปลาหมอคางดำให้เป็นคุณค่าใหม่<br>เพื่ออาหารปลาและการเกษตรที่ยั่งยืน</p>' +
      '<small>© 2026 FishGrow Thailand. Sustainable Aquaculture Solutions.</small></div>' +
      '<div><h4>เมนู</h4><a href="#home">หน้าหลัก</a><a href="#products">สินค้า</a><a href="#recommend">เลือกอาหาร</a><a href="#calculator">คำนวณอาหาร</a><a href="#howto">วิธีใช้</a><a href="#about">เกี่ยวกับเรา</a></div>' +
      '<div><h4>ความรู้และช่วยเหลือ</h4><a href="#knowledge">ความรู้</a><a href="#tracking">ติดตามคำสั่งซื้อ</a><a href="#faq">FAQ</a><a href="#contact">ติดต่อเรา</a></div>' +
      '<div><h4>นโยบาย</h4><a href="#privacy">นโยบายความเป็นส่วนตัว</a><a href="#terms">เงื่อนไขการสั่งซื้อ</a><a href="#returns">นโยบายการคืนสินค้า</a></div>' +
      '</div></footer>';
  }

  function productCard(p, compact) {
    const qty = Number(state.cart[p.product_id] || 0);
    const image = p.image_url
      ? '<img src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '" loading="lazy">'
      : '<div class="fg-product-placeholder">🐟</div>';

    return '<article class="fg-product-card">' +
      '<a class="fg-product-image" href="#product/' + p.product_id + '">' + image + '</a>' +
      '<div class="fg-product-body"><div class="fg-chip">' + (p.is_available ? 'พร้อมจำหน่าย' : 'ไม่พร้อมจำหน่าย') + '</div>' +
      '<h3><a href="#product/' + p.product_id + '">' + esc(p.name) + '</a></h3>' +
      '<p class="fg-muted">SKU ' + esc(p.sku) + '</p>' +
      '<div class="fg-product-meta"><span>คงเหลือ ' + money(p.stock) + ' kg</span><strong>฿' + money(p.price) + '<small>/kg</small></strong></div>' +
      (compact ? '' : '<div class="fg-product-actions"><a class="fg-btn fg-btn-light" href="#product/' + p.product_id + '">ดูรายละเอียด</a>' +
        '<button class="fg-btn fg-btn-light" data-compare="' + p.product_id + '">' + (state.compare.includes(Number(p.product_id)) ? '✓ เทียบแล้ว' : '＋ เปรียบเทียบ') + '</button>' +
        '<button class="fg-btn fg-btn-green" data-add="' + p.product_id + '" ' + (Number(p.stock) <= 0 ? 'disabled' : '') + '>🛒 เพิ่มลงตะกร้า</button></div>') +
      (compact ? '<button class="fg-btn fg-btn-green fg-full-btn" data-add="' + p.product_id + '">เพิ่มลงตะกร้า</button>' : '') +
      (qty ? '<div class="fg-qty-note">ในตะกร้า ' + qty + ' kg</div>' : '') +
      '</div></article>';
  }

  function hero() {
    const videoSrc = ABOUT_MEDIA.heroVideoUrl || 'assets/hero-bg.mp4';
    return '<section class="fg-hero fg-hero-video-banner">' +
      '<div class="fg-hero-video-wrap">' +
      '<video class="fg-hero-bg-video" autoplay loop muted playsinline preload="auto">' +
      '<source src="' + esc(videoSrc) + '" type="video/mp4">' +
      '</video>' +
      '</div>' +
      '<div class="fg-hero-overlay"></div>' +
      '<div class="fg-container fg-hero-inner">' +
      '<div class="fg-hero-content">' +
      '<span class="fg-eyebrow">♧ Sustainability First</span>' +
      '<h1>เปลี่ยนปลาหมอคางดำ<br><span>ให้เป็นคุณค่าใหม่</span></h1>' +
      '<p>อาหารปลาคุณภาพจากปลาหมอคางดำและวัตถุดิบท้องถิ่น เพื่อสนับสนุนเกษตรกรและการใช้ทรัพยากรอย่างยั่งยืน</p>' +
      '<div class="fg-hero-actions">' +
      '<a class="fg-btn fg-btn-green" href="#recommend">เลือกอาหารที่เหมาะกับฟาร์ม</a>' +
      '<a class="fg-btn fg-btn-white" href="#products">ดูสินค้า</a>' +
      '</div>' +
      '<div class="fg-hero-tags">' +
      '<span>♻️ Local Resource</span>' +
      '<span>🐟 Aquaculture Feed</span>' +
      '<span>🌱 Sustainability</span>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<button class="fg-hero-video-ctrl" type="button" data-hero-video-ctrl aria-label="หยุดหรือเล่นวิดีโอพื้นหลัง" title="หยุด / เล่นวิดีโอพื้นหลัง">' +
      '<span class="fg-pulse-dot"></span>' +
      '<span class="fg-ctrl-icon">⏸</span>' +
      '<span class="fg-ctrl-text">วิดีโอพื้นหลัง</span>' +
      '</button>' +
      '</section>';
  }

  function home() {
    const featured = state.products.slice(0, 3);
    return hero() +
      '<section class="fg-section"><div class="fg-container"><div class="fg-section-head"><span class="fg-kicker">FishGrow</span><h2>จากปัญหาสู่โอกาส</h2><p>FishGrow นำปลาหมอคางดำซึ่งเป็นทรัพยากรจากปัญหาการแพร่ระบาด มาใช้ประโยชน์ผ่านกระบวนการแปรรูปและผสมกับวัตถุดิบท้องถิ่น เพื่อพัฒนาเป็นอาหารปลาที่ตอบโจทย์เกษตรกร</p></div>' +
      '<div class="fg-value-grid"><div><b>สิ่งแวดล้อม</b><p>นำทรัพยากรจากปัญหามาใช้ประโยชน์อย่างเหมาะสม</p></div><div><b>เศรษฐกิจ</b><p>เพิ่มมูลค่าให้วัตถุดิบและสนับสนุนเศรษฐกิจท้องถิ่น</p></div><div><b>ชุมชน</b><p>เชื่อมโยงทรัพยากรท้องถิ่นกับเกษตรกร</p></div></div></div></section>' +
      '<section class="fg-section fg-soft"><div class="fg-container"><div class="fg-section-head"><span class="fg-kicker">Why FishGrow</span><h2>ทำไมต้อง FishGrow?</h2></div><div class="fg-feature-grid"><div class="fg-feature"><span></span><h3>เปลี่ยนปัญหาเป็นคุณค่า</h3><p>นำปลาหมอคางดำมาใช้ประโยชน์อย่างเหมาะสม</p></div><div class="fg-feature"><span></span><h3>แหล่งโปรตีนจากปลา</h3><p>ใช้วัตถุดิบจากปลาเป็นส่วนหนึ่งของสูตรอาหาร</p></div><div class="fg-feature"><span></span><h3>วัตถุดิบท้องถิ่น</h3><p>สนับสนุนการใช้ทรัพยากรที่มีอยู่ในพื้นที่</p></div><div class="fg-feature"><span></span><h3>ใส่ใจต้นทุน</h3><p>พัฒนาอาหารปลาให้ตอบโจทย์เกษตรกร</p></div><div class="fg-feature"><span></span><h3>สร้างความยั่งยืน</h3><p>เชื่อมโยงสิ่งแวดล้อม เศรษฐกิจ และชุมชน</p></div></div></div></section>' +
      '<section class="fg-section fg-home-story-video"><div class="fg-container"><div class="fg-home-story-video-frame"><video autoplay muted loop playsinline preload="auto" aria-label="วิดีโอแนะนำ FishGrow"><source src="video3.mp4?v=1" type="video/mp4">เบราว์เซอร์นี้ไม่รองรับวิดีโอ MP4</video></div></div></section>' +
      '<section class="fg-section"><div class="fg-container"><div class="fg-section-head fg-row-head"><div><span class="fg-kicker">Products</span><h2>อาหารปลาที่เหมาะกับฟาร์มของคุณ</h2></div><a href="#products" class="fg-text-link">ดูสินค้าทั้งหมด →</a></div><div class="fg-products-grid">' +
      (featured.length ? featured.map(p => productCard(p, false)).join('') : '<div class="fg-empty">ยังไม่มีสินค้าที่เปิดจำหน่าย</div>') +
      '</div></div></section>' +
      '<section class="fg-section fg-tool-band"><div class="fg-container"><div class="fg-section-head"><span class="fg-kicker">Farm Tools</span><h2>มากกว่าอาหารปลา เราช่วยคุณจัดการฟาร์ม</h2></div><div class="fg-tool-grid"><a href="#recommend" class="fg-tool-card"><span>🎯</span><div><h3>เลือกอาหารที่เหมาะกับฟาร์ม</h3><p>ตอบคำถามเกี่ยวกับชนิดปลา ช่วงวัย เป้าหมาย และขนาดฟาร์ม</p><b>เริ่มเลือกอาหาร →</b></div></a><a href="#calculator" class="fg-tool-card"><span>🧮</span><div><h3>คำนวณปริมาณอาหาร</h3><p>คำนวณจากจำนวนปลา น้ำหนักเฉลี่ย และอัตราการให้อาหาร</p><b>เริ่มคำนวณ →</b></div></a></div></div></section>' +


      '<section class="fg-cta"><div class="fg-container"><h2>ไม่แน่ใจว่าควรเลือกสูตรไหน?</h2><p>ตอบคำถามสั้น ๆ แล้วให้ FishGrow ช่วยแนะนำอาหารที่เหมาะกับฟาร์มของคุณ</p><a href="#recommend" class="fg-btn fg-btn-green">เริ่มค้นหาอาหาร</a></div></section>';
  }

  function products() {
    return '<section class="fg-page"><div class="fg-container"><div class="fg-page-head"><span class="fg-kicker">FISHGROW PRODUCTS</span><h1>สินค้าทั้งหมด</h1><p>อาหารปลาคุณภาพจากทรัพยากรท้องถิ่น เพื่อการเกษตรที่ยั่งยืน</p></div><div class="fg-products-toolbar"><div class="fg-filter-pills"><button class="active">ทั้งหมด</button><button>พร้อมจำหน่าย</button></div><span>' + state.products.length + ' รายการ</span></div><div class="fg-products-grid fg-products-wide">' +
      (state.products.length ? state.products.map(p => productCard(p, false)).join('') : '<div class="fg-empty">ไม่พบสินค้า</div>') +
      '</div><div class="fg-compare-bar"><span>เลือกไว้ ' + state.compare.length + ' รายการ</span><a class="fg-btn fg-btn-light" href="#compare">เปรียบเทียบสินค้า</a></div></div></section>';
  }

  function productDetail(id) {
    const p = state.products.find(x => String(x.product_id) === String(id));
    if (!p) return products();

    state.selectedProduct = p;

    const image = p.image_url
      ? '<img src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '">'
      : '<div class="fg-product-placeholder large">🐟</div>';

    const protein = p.protein_pct != null
      ? '<small>โปรตีน ' + money(p.protein_pct) + '%</small>'
      : '';

    const pellet = p.pellet_size
      ? '<small>ขนาดเม็ด ' + esc(p.pellet_size) + '</small>'
      : '';

    return '<section class="fg-page">' +
      '<div class="fg-container">' +
      '<div class="fg-breadcrumb"><a href="#products">สินค้า</a> / ' + esc(p.name) + '</div>' +
      '<div class="fg-detail-grid">' +
      '<div><div class="fg-detail-image">' + image + '</div></div>' +
      '<div class="fg-detail-info">' +
      '<span class="fg-kicker">AQUACULTURE FEED</span>' +
      '<h1>' + esc(p.name) + '</h1>' +
      '<p class="fg-lead">อาหารปลาคุณภาพสำหรับการเลี้ยงปลา โดยใช้ทรัพยากรและวัตถุดิบท้องถิ่นเป็นส่วนหนึ่งของแนวคิด FishGrow</p>' +
      '<div class="fg-price">฿' + money(p.price) + '<small>/ kg</small></div>' +
      '<div class="fg-detail-facts">' +
      '<div><small>SKU</small><b>' + esc(p.sku) + '</b></div>' +
      '<div><small>สต็อก</small><b>' + money(p.stock) + ' kg</b></div>' +
      '<div><small>สถานะ</small><b>' + (p.is_available ? 'พร้อมจำหน่าย' : 'ไม่พร้อมจำหน่าย') + '</b></div>' +
      '</div>' +
      '<div class="fg-detail-buy">' +
      '<button class="fg-btn fg-btn-green" data-add="' + p.product_id + '" ' + (Number(p.stock) <= 0 ? 'disabled' : '') + '>🛒 เพิ่มลงตะกร้า</button>' +
      '<a class="fg-btn fg-btn-light" href="#recommend">🎯 ให้ระบบช่วยเลือก</a>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="fg-info-grid">' +
      '<article><h3>รายละเอียดสินค้า</h3><p>' + esc(p.description || 'ยังไม่ได้ระบุรายละเอียดสินค้า') + '</p>' + protein + pellet + '</article>' +
      '<article><h3>ส่วนประกอบ</h3><p>' + esc(p.ingredients || 'ยังไม่ได้ระบุส่วนประกอบ') + '</p></article>' +
      '<article><h3>วิธีใช้และการเก็บรักษา</h3>' +
      '<p>' + esc(p.usage_note || 'ควรปรับตามชนิดปลา ช่วงวัย คุณภาพน้ำ และพฤติกรรมการกิน') + '</p>' +
      '<p>' + esc(p.storage_note || 'เก็บในที่แห้งและเย็น หลีกเลี่ยงแสงแดดและความชื้น') + '</p>' +
      '<a href="#howto">อ่านวิธีใช้ →</a>' +
      '</article>' +
      '</div>' +
      '</div>' +
      '</section>';
  }

  function compare() {
    const selected = state.compare.map(id => state.products.find(p => Number(p.product_id) === Number(id))).filter(Boolean);
    if (!selected.length) {
      return '<section class="fg-page"><div class="fg-container fg-narrow"><div class="fg-page-head"><span class="fg-kicker">COMPARE</span><h1>เปรียบเทียบสินค้า</h1><p>เลือกสินค้าอย่างน้อย 1 รายการจากหน้าสินค้า</p></div><a class="fg-btn fg-btn-green" href="#products">ไปเลือกสินค้า</a></div></section>';
    }
    return '<section class="fg-page"><div class="fg-container"><div class="fg-page-head"><span class="fg-kicker">COMPARE</span><h1>เปรียบเทียบสินค้า</h1><p>เปรียบเทียบราคา สต็อก และข้อมูลพื้นฐานของสินค้า</p></div><div class="fg-compare-table"><table><thead><tr><th>ข้อมูล</th>' +
      selected.map(p => '<th><b>' + esc(p.name) + '</b><small>' + esc(p.sku) + '</small></th>').join('') +
      '</tr></thead><tbody><tr><td>ราคา</td>' + selected.map(p => '<td>฿' + money(p.price) + '/kg</td>').join('') + '</tr><tr><td>สต็อก</td>' + selected.map(p => '<td>' + money(p.stock) + ' kg</td>').join('') + '</tr><tr><td>สถานะ</td>' + selected.map(p => '<td>' + (p.is_available ? 'พร้อมจำหน่าย' : 'ไม่พร้อมจำหน่าย') + '</td>').join('') + '</tr><tr><td>การสั่งซื้อ</td>' + selected.map(p => '<td><button class="fg-btn fg-btn-green" data-add="' + p.product_id + '">เพิ่มลงตะกร้า</button></td>').join('') + '</tr></tbody></table></div><button class="fg-btn fg-btn-light" data-clear-compare>ล้างรายการเปรียบเทียบ</button></div></section>';
  }

  function recommend() {
    const r = state.recommendation;
    const rules = state.recommendationRules || [];
    const values = key => [...new Set(rules.map(x => x[key]).filter(Boolean))];
    const labels = { growth: 'การเจริญเติบโต', cost: 'ควบคุมต้นทุน', protein: 'โปรตีน', quality: 'คุณภาพอาหาร', other: 'อื่น ๆ', small: 'ขนาดเล็ก', medium: 'ขนาดกลาง', large: 'ขนาดใหญ่' };
    const step = !r.fish ? 1 : !r.stage ? 2 : !r.goal ? 3 : !r.farm ? 4 : 5;
    if (step === 5) {
      const matches = rules.map(rule => ({ rule, score: Number(rule.priority || 0) + (rule.fish_type === r.fish ? 40 : 0) + (rule.stage === r.stage ? 30 : 0) + (rule.goal === r.goal ? 20 : 0) + (rule.farm_size === r.farm ? 10 : 0) })).filter(x => x.rule.fish_type === r.fish).sort((a, b) => b.score - a.score);
      const match = matches[0], p = match ? state.products.find(x => Number(x.product_id) === Number(match.rule.product_id)) : null;
      return '<section class="fg-page"><div class="fg-container fg-wizard"><div class="fg-page-head"><span class="fg-kicker">SMART RECOMMENDATION</span><h1>อาหารที่เราแนะนำ</h1><p>ผลลัพธ์จากข้อมูลสินค้าและเงื่อนไขที่ตั้งไว้ในระบบ</p></div><div class="fg-result-card"><div><span class="fg-result-icon">🎯</span><h2>' + (p ? esc(p.name) : 'ยังไม่มีสินค้าที่ตรงเงื่อนไข') + '</h2><p>เหมาะสำหรับ ' + esc(r.fish) + ' · ' + esc(r.stage) + '</p><div class="fg-result-tags"><span>เป้าหมาย: ' + esc(labels[r.goal] || r.goal) + '</span><span>ฟาร์ม: ' + esc(labels[r.farm] || r.farm) + '</span></div>' + (match && match.rule.reason ? '<p class="fg-muted">' + esc(match.rule.reason) + '</p>' : '') + '</div>' + (p ? '<div class="fg-result-price">฿' + money(p.price) + '<small>/kg</small><button class="fg-btn fg-btn-green" data-add="' + p.product_id + '">เพิ่มลงตะกร้า</button></div>' : '') + '</div><div class="fg-recommend-actions"><button class="fg-btn fg-btn-light" data-reset-recommend>เริ่มใหม่</button><a class="fg-btn fg-btn-light" href="#products">ดูสินค้าทั้งหมด</a></div></div></section>';
    }
    const key = step === 1 ? 'fish_type' : step === 2 ? 'stage' : step === 3 ? 'goal' : 'farm_size', current = values(key);
    const uiKey = key === 'fish_type' ? 'fish' : key === 'farm_size' ? 'farm' : key;
    const title = step === 1 ? 'คุณเลี้ยงปลาชนิดใด?' : step === 2 ? 'ปลาอยู่ในช่วงไหน?' : step === 3 ? 'คุณต้องการเน้นอะไร?' : 'ขนาดฟาร์ม';
    return '<section class="fg-page"><div class="fg-container fg-wizard"><div class="fg-page-head"><span class="fg-kicker">SMART RECOMMENDATION</span><h1>เลือกอาหารให้เหมาะกับฟาร์ม</h1><p>ตัวเลือกจะแสดงจากเงื่อนไขที่มีอยู่จริงในระบบ</p></div><div class="fg-progress"><span style="width:' + (step * 25) + '%"></span></div><div class="fg-step-label">ขั้นตอนที่ ' + step + ' จาก 4</div><div class="fg-wizard-card"><h2>' + title + '</h2><div class="fg-choice-grid">' + current.map(value => '<button class="fg-choice" data-choice-key="' + uiKey + '" data-choice-value="' + esc(value) + '">' + (key === 'fish_type' ? '🐟' : key === 'stage' ? '◉' : key === 'goal' ? '✦' : '▦') + '<strong>' + esc(labels[value] || value) + '</strong></button>').join('') + '</div></div></div></section>';
  }

  function feedingRateForWhiteSeabass(weight) {
    const w = Number(weight);
    if (!(w > 0)) return null;
    if (w <= 20) return { min: 2.0, max: 4.0, label: '2.0–4.0%', meals: '2–3 มื้อ/วัน' };
    if (w <= 100) return { min: 1.5, max: 2.0, label: '1.5–2.0%', meals: '2 มื้อ/วัน' };
    if (w <= 200) return { min: 1.2, max: 1.5, label: '1.2–1.5%', meals: '1–2 มื้อ/วัน' };
    if (w <= 300) return { min: 1.0, max: 1.2, label: '1.0–1.2%', meals: '1 มื้อ/วัน' };
    return { min: 0.8, max: 1.0, label: '0.8–1.0%', meals: '1 มื้อ/วัน' };
  }

  function calculator() {
    const c = state.calculator;
    const count = Number(c.count), weight = Number(c.weight), price = Number(c.price || 0);
    const source = feedingRateForWhiteSeabass(weight);
    const entered = Number(c.rate);
    const rate = entered > 0 ? entered : (source ? (source.min + source.max) / 2 : 0);
    const biomass = count > 0 && weight > 0 ? count * weight / 1000 : 0;
    const daily = biomass * rate / 100, monthly = daily * 30, cost = monthly * price;
    return '<section class="fg-page"><div class="fg-container fg-calc"><div class="fg-page-head"><span class="fg-kicker">FEED CALCULATOR</span><h1>คำนวณปริมาณอาหารปลากะพงขาว</h1><p>คำนวณจากจำนวนปลา น้ำหนักเฉลี่ย และอัตราการให้อาหารตามช่วงน้ำหนัก</p></div><div class="fg-calc-grid"><form class="fg-calc-form" id="calc-form">' +
      '<label>จำนวนปลา<input name="count" type="number" min="1" step="1" value="' + esc(c.count) + '" placeholder="เช่น 1000" required></label>' +
      '<label>น้ำหนักเฉลี่ย<input name="weight" type="number" min="0.1" step="0.1" value="' + esc(c.weight) + '" placeholder="กรัม/ตัว" required></label>' +
      '<label>อัตราการให้อาหาร (%)<input name="rate" type="number" min="0.1" max="10" step="0.1" value="' + esc(c.rate) + '" placeholder="' + (source ? source.label : 'ระบบจะแนะนำตามน้ำหนักปลา') + '"></label>' +
      '<label>ราคาอาหาร (บาท/kg)<input name="price" type="number" min="0" step="0.01" value="' + esc(c.price) + '" placeholder="ใส่เพื่อคำนวณค่าใช้จ่าย"></label>' +
      (source ? '<div class="fg-note">อัตราอ้างอิง: <b>' + source.label + '</b> · ความถี่ประมาณ <b>' + source.meals + '</b><br>หากไม่กรอกอัตรา ระบบใช้ค่ากลางของช่วงเพื่อประมาณการ</div>' : '') +
      '<button class="fg-btn fg-btn-green" type="submit">คำนวณ</button></form><div class="fg-calc-result"><h2>ผลการคำนวณ</h2>' +
      '<div><small>น้ำหนักปลารวม</small><b>' + money(biomass) + ' kg</b></div><div><small>อัตราที่ใช้คำนวณ</small><b>' + (rate ? money(rate) + '%' : '-') + '</b></div>' +
      '<div><small>ปริมาณอาหารต่อวัน</small><b>' + money(daily) + ' kg/วัน</b></div><div><small>ปริมาณอาหารต่อเดือน</small><b>' + money(monthly) + ' kg/เดือน</b></div>' +
      '<div><small>ค่าอาหารโดยประมาณ</small><b>' + (price > 0 ? '฿' + money(cost) + '/เดือน' : 'กรอกราคาอาหารเพื่อคำนวณ') + '</b></div></div></div>' +
      '<div class="fg-note">สูตร: น้ำหนักปลารวม = จำนวนปลา × น้ำหนักเฉลี่ย ÷ 1,000 และอาหารต่อวัน = น้ำหนักปลารวม × อัตราการให้อาหาร ÷ 100 โดยอ้างอิงตารางของกรมประมง ควรปรับตามสภาพปลา คุณภาพน้ำ และการกินจริง</div></div></section>';
  }

  function howto() {
    const rows = [['5–20 กรัม', '2.0–4.0%', '2–3 มื้อ/วัน'], ['20–100 กรัม', '1.5–2.0%', '2 มื้อ/วัน'], ['100–200 กรัม', '1.2–1.5%', '1–2 มื้อ/วัน'], ['200–300 กรัม', '1.0–1.2%', '1 มื้อ/วัน'], ['มากกว่า 300 กรัม', '0.8–1.0%', '1 มื้อ/วัน']];
    return '<section class="fg-page"><div class="fg-container"><div class="fg-page-head"><span class="fg-kicker">HOW TO USE</span><h1>วิธีใช้อาหารปลา FishGrow</h1><p>แนวทางการให้อาหารปลากะพงขาวตามน้ำหนักปลา</p></div><div class="fg-feature-grid fg-howto-cards"><div class="fg-feature"><span>⚖️</span><h3>คำนวณจากน้ำหนักรวม</h3><p>ใช้จำนวนปลา × น้ำหนักเฉลี่ย แล้วคูณด้วยอัตราการให้อาหาร</p></div><div class="fg-feature"><span>◷</span><h3>แบ่งตามความถี่</h3><p>แบ่งปริมาณอาหารต่อวันตามจำนวนมื้อที่เหมาะสม</p></div><div class="fg-feature"><span>💧</span><h3>สังเกตการกิน</h3><p>ปรับปริมาณตามการกินจริงและสภาพแวดล้อมของฟาร์ม</p></div></div><div class="fg-table-card"><h2>อัตราและความถี่การให้อาหารปลากะพงขาว</h2><table><thead><tr><th>ขนาดปลา</th><th>อัตราการกินอาหาร</th><th>ความถี่</th></tr></thead><tbody>' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('') + '</tbody></table><p class="fg-muted">อัตราเป็นช่วงสำหรับใช้เป็นแนวทาง ไม่ควรใช้แทนการสังเกตการกินจริง</p></div><div class="fg-steps"><h2>วิธีให้อาหาร</h2><div><b>01</b><p>ประเมินจำนวนปลาและน้ำหนักเฉลี่ย</p></div><div><b>02</b><p>คำนวณปริมาณอาหารต่อวัน</p></div><div><b>03</b><p>แบ่งอาหารตามจำนวนมื้อ</p></div><div><b>04</b><p>สังเกตการกินและอาหารเหลือ</p></div><div><b>05</b><p>ปรับปริมาณตามสภาพปลาและคุณภาพน้ำ</p></div></div><div class="fg-storage"><h2>วิธีเก็บรักษา</h2><span>❄️ เก็บในที่แห้งและเย็น</span><span>☀️ หลีกเลี่ยงแสงแดดและความชื้น</span><span>📦 ปิดปากถุงให้สนิท</span></div></div></section>';
  }

  function about() {
    const gallery = ABOUT_MEDIA.gallery.map((item, index) =>
      '<figure class="fg-about-gallery-card"><div class="fg-about-gallery-media">' + aboutImage(item.url, item.label + ' ของ FISHGROW') + '<span class="fg-gallery-index">0' + (index + 1) + '</span></div><figcaption><strong>' + esc(item.label) + '</strong><small>' + esc(item.detail) + '</small></figcaption></figure>'
    ).join('');

    return '<main class="fg-about-page">' +
      '<section class="fg-about-hero"><div class="fg-container fg-about-hero-grid"><div class="fg-about-hero-copy"><span class="fg-kicker">ABOUT FISHGROW</span><h1>จากปัญหาท้องถิ่น<br><span>สู่คุณค่าใหม่ที่ยั่งยืน</span></h1><p>FISHGROW มองหาแนวทางเพิ่มมูลค่าวัตถุดิบในพื้นที่ เพื่อพัฒนาอาหารปลากะพงขาวและสนับสนุนเกษตรกร</p></div><div class="fg-about-hero-media">' + aboutImage(ABOUT_MEDIA.heroImageUrl, 'ภาพแนะนำ FISHGROW จากพื้นที่จริง') + '</div></div></section>' +
      '<section class="fg-section fg-about-video-section"><div class="fg-container"><div class="fg-section-head"><span class="fg-kicker">WATCH OUR STORY</span><h2>FISHGROW</h2></div><div class="fg-about-video-card">' + aboutVideo() + '<div class="fg-video-caption"><div><span class="fg-chip">FISHGROW STORY</span><h3>เรื่องราวของ FISHGROW</h3></div></div></div></div></section>' +
      '<section class="fg-section fg-soft"><div class="fg-container fg-about-story-grid"><div class="fg-about-story-media">' + aboutImage('assets/pic8.jpg?v=1', 'ภาพเรื่องราว FISHGROW จากพื้นที่จริง') + '</div><div class="fg-story fg-about-story-copy"><span class="fg-kicker">เรื่องราวของเรา</span><h2>จุดเริ่มต้นจากวิกฤตสิ่งแวดล้อม</h2><p>แนวคิดของ FISHGROW เริ่มจากการมองเห็นโอกาสในการใช้ปลาหมอคางดำที่จับตามมาตรการที่ถูกต้อง ร่วมกับวัตถุดิบท้องถิ่น มาแปรรูปและพัฒนาเป็นอาหารปลากะพงขาว</p><div class="fg-story-flow"><span>วัตถุดิบในพื้นที่</span><i>→</i><span>แปรรูปอย่างเหมาะสม</span><i>→</i><span>อาหารปลากะพงขาว</span></div></div></div></section>' +
      '<section class="fg-section"><div class="fg-container"><div class="fg-section-head"><span class="fg-kicker">OUR JOURNEY</span><h2>จากปัญหาสู่การผลิตอาหารปลา</h2><p>ลำดับเรื่องราวที่สื่อสารได้ชัดเจน โดยไม่แทนที่หลักฐานจากกระบวนการจริง</p></div><div class="fg-about-timeline"><div><span>01</span><div><b>ปัญหาปลาหมอคางดำ</b><small>ทรัพยากรที่ต้องจัดการตามมาตรการและข้อมูลจากหน่วยงานที่เกี่ยวข้อง</small></div></div><div><span>02</span><div><b>คัดเลือกวัตถุดิบ</b><small>เตรียมวัตถุดิบที่เหมาะสมสำหรับการแปรรูปและตรวจสอบย้อนกลับ</small></div></div><div><span>03</span><div><b>แปรรูปและพัฒนาสูตร</b><small>ลดความชื้น บด ผสม และควบคุมคุณภาพตามกระบวนการที่กำหนด</small></div></div><div><span>04</span><div><b>ผลิตอาหารปลากะพงขาว</b><small>อัดเม็ด อบ และตรวจคุณภาพก่อนนำไปใช้งาน</small></div></div><div><span>05</span><div><b>สร้างคุณค่าอย่างยั่งยืน</b><small>สนับสนุนเกษตรกร ชุมชน และการใช้ทรัพยากรอย่างรับผิดชอบ</small></div></div></div></div></section>' +
      '<section class="fg-section fg-soft"><div class="fg-container"><div class="fg-section-head"><span class="fg-kicker">PROCESS GALLERY</span><h2>ภาพกระบวนการผลิต</h2><p>แกลเลอรี่นี้เตรียมช่องไว้สำหรับภาพจริงของ FISHGROW โดยไม่ใช้ภาพสต็อกหรือภาพที่ทำให้เข้าใจว่าเป็นภาพจากโรงงานจริง</p></div><div class="fg-about-gallery">' + gallery + '</div></div></section>' +
      '<section class="fg-section fg-about-process"><div class="fg-container"><div class="fg-section-head"><span class="fg-kicker">SUSTAINABILITY JOURNEY</span><h2>วงจรความยั่งยืน</h2></div><div class="fg-process fg-process-wide"><div><span>01</span><b>ทรัพยากรท้องถิ่น</b><small>ใช้ข้อมูลและวัตถุดิบที่ตรวจสอบได้</small></div><div><span>02</span><b>การแปรรูป</b><small>คัดเลือกและเตรียมวัตถุดิบ</small></div><div><span>03</span><b>อาหารปลา</b><small>พัฒนาเป็นผลิตภัณฑ์</small></div><div><span>04</span><b>สร้างคุณค่า</b><small>เพิ่มมูลค่าทรัพยากร</small></div><div><span>05</span><b>ชุมชนเติบโต</b><small>สร้างโอกาสทางเศรษฐกิจในพื้นที่</small></div></div></div></section>' +
      '</main>';
  }

  function knowledge() {
    const articles = state.articles || [];
    return '<section class="fg-page"><div class="fg-container"><div class="fg-page-head"><span class="fg-kicker">KNOWLEDGE</span><h1>ความรู้</h1><p>ความรู้สำหรับเกษตรกรและผู้สนใจการเลี้ยงปลา</p></div><div class="fg-article-grid">' + (articles.length ? articles.map((a, i) => '<article><span>0' + ((i % 9) + 1) + '</span><small class="fg-kicker">' + esc(a.category) + '</small><h3>' + esc(a.title) + '</h3><p>' + esc(a.excerpt) + '</p><a href="#knowledge/' + esc(a.slug) + '">อ่านเพิ่มเติม →</a></article>').join('') : '<div class="fg-empty">ยังไม่มีบทความที่เผยแพร่</div>') + '</div></div></section>';
  }

  function articleDetail(slug) {
    const a = (state.articles || []).find(x => x.slug === slug);
    if (!a) return knowledge();
    return '<section class="fg-page"><div class="fg-container fg-narrow"><div class="fg-breadcrumb"><a href="#knowledge">ความรู้</a> / ' + esc(a.title) + '</div><div class="fg-page-head"><span class="fg-kicker">' + esc(a.category) + '</span><h1>' + esc(a.title) + '</h1><p>' + esc(a.excerpt) + '</p></div><article class="fg-policy"><div style="white-space:pre-wrap;line-height:1.9">' + esc(a.content) + '</div></article></div></section>';
  }

  function faq() {
    const qs = ['FishGrow คืออะไร?', 'FishGrow เหมาะกับปลาอะไร?', 'ควรให้อาหารวันละกี่ครั้ง?', 'มีขนาดบรรจุเท่าไหร่?', 'มีขั้นต่ำในการสั่งซื้อหรือไม่?', 'มีบริการจัดส่งหรือไม่?', 'ซื้อจำนวนมากมีราคาส่งไหม?'];
    return '<section class="fg-page"><div class="fg-container fg-narrow"><div class="fg-page-head"><span class="fg-kicker">FAQ</span><h1>คำถามที่พบบ่อย</h1><p>คำตอบเบื้องต้นเกี่ยวกับสินค้าและบริการ FishGrow</p></div><div class="fg-faq">' + qs.map(q => '<details><summary>' + q + '</summary><p>' + (q === 'FishGrow คืออะไร?' ? 'อาหารปลาที่พัฒนาจากแนวคิดการเพิ่มมูลค่าปลาหมอคางดำและวัตถุดิบท้องถิ่น' : 'รายละเอียดขึ้นอยู่กับข้อมูลของสินค้าและเงื่อนไขการให้บริการที่ผู้ดูแลกำหนดในระบบ') + '</p></details>').join('') + '</div></div></section>';
  }

  function tracking() {
    return '<section class="fg-page"><div class="fg-container fg-narrow"><div class="fg-page-head"><span class="fg-kicker">ORDER TRACKING</span><h1>ติดตามคำสั่งซื้อ</h1><p>สำหรับผู้ที่มีบัญชี FishGrow สามารถดูสถานะคำสั่งซื้อได้จากบัญชีของคุณ</p></div><div class="fg-track-card"><label>หมายเลขคำสั่งซื้อ<input id="track-code" placeholder="เช่น FGW-000001"></label><button class="fg-btn fg-btn-green" data-track-submit>ตรวจสอบ</button><div id="track-result"></div><a href="#account" class="fg-text-link">เข้าสู่ระบบเพื่อดูคำสั่งซื้อของฉัน →</a></div></div></section>';
  }

  function contact() {
    return '<section class="fg-page"><div class="fg-container"><div class="fg-page-head"><span class="fg-kicker">CONTACT</span><h1>ติดต่อเรา</h1><p>สอบถามข้อมูลสินค้า การสั่งซื้อ หรือรายละเอียดสำหรับฟาร์มของคุณ</p></div><div class="fg-contact-grid"><div class="fg-contact-info"><h2>ติดต่อ FishGrow</h2><p>โทรศัพท์: 08X-XXX-XXXX</p><p>LINE: @FishGrow</p><p>Email: fishgrow@email.com</p><p>Facebook: FishGrow Thailand</p><p>ที่อยู่: สมุทรสาคร ประเทศไทย</p></div><form id="contact-form" class="fg-contact-form"><label>ชื่อ<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>เบอร์โทร<input name="phone"></label><label>หัวข้อ<input name="subject" required></label><label>ข้อความ<textarea name="message" rows="5" required></textarea></label><button class="fg-btn fg-btn-green">ส่งข้อความ</button><p id="contact-status" class="fg-muted"></p></form></div></div></section>';
  }

  function cart() {
    const lines = Object.keys(state.cart).map(id => {
      const p = state.products.find(x => String(x.product_id) === String(id));
      if (!p) return '';
      return '<div class="fg-cart-line"><div><b>' + esc(p.name) + '</b><small>฿' + money(p.price) + '/kg</small></div><div class="fg-cart-qty"><button data-cart-delta="' + id + ':-1">−</button><b>' + state.cart[id] + '</b><button data-cart-delta="' + id + ':1">+</button></div><strong>฿' + money(p.price * state.cart[id]) + '</strong><button class="fg-remove" data-cart-remove="' + id + '">×</button></div>';
    }).join('');
    return '<section class="fg-page"><div class="fg-container"><div class="fg-page-head"><span class="fg-kicker">SHOPPING CART</span><h1>ตะกร้าสินค้า</h1><p>ตรวจสอบสินค้าและจำนวนก่อนสั่งซื้อ</p></div>' +
      '<div class="fg-cart-layout"><div class="fg-cart-list">' + (lines || '<div class="fg-empty">ยังไม่มีสินค้าในตะกร้า <a href="#products">ไปเลือกสินค้า</a></div>') + '</div><aside class="fg-summary"><h2>สรุปคำสั่งซื้อ</h2><div><span>สินค้า</span><b>฿' + money(cartTotal()) + '</b></div><div><span>ค่าจัดส่ง</span><b>คำนวณตอนยืนยัน</b></div><hr><div class="total"><span>ยอดรวมสินค้า</span><b>฿' + money(cartTotal()) + '</b></div>' + (cartCount() ? '<a class="fg-btn fg-btn-green fg-full-btn" href="#checkout">ไปชำระเงิน / สั่งซื้อ</a>' : '<a class="fg-btn fg-btn-light fg-full-btn" href="#products">เลือกสินค้า</a>') + '</aside></div></div></section>';
  }

  async function checkout() {
    if (!cartCount()) {
      location.hash = 'cart';
      return '<section class="fg-page"><div class="fg-container fg-empty"><h1>ตะกร้ายังไม่มีสินค้า</h1><a class="fg-btn fg-btn-green" href="#products">ไปเลือกสินค้า</a></div></section>';
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return '<section class="fg-page"><div class="fg-container fg-narrow"><div class="fg-page-head"><span class="fg-kicker">CHECKOUT</span><h1>เข้าสู่ระบบก่อนสั่งซื้อ</h1><p>คำสั่งซื้อจะถูกผูกกับบัญชีของคุณ เพื่อให้ติดตามสถานะและประวัติได้อย่างปลอดภัย</p></div><div class="fg-account-card"><a class="fg-btn fg-btn-green fg-full-btn" href="?mode=account">เข้าสู่ระบบ / สมัครสมาชิก</a><a class="fg-btn fg-btn-light fg-full-btn" href="#cart">กลับไปตะกร้า</a></div></div></section>';
    }

    let profile = {};
    const profileResult = await supabase.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle();
    if (profileResult.data) profile = profileResult.data;

    const lines = Object.keys(state.cart).map(id => {
      const p = state.products.find(x => String(x.product_id) === String(id));
      return p ? '<div class="fg-checkout-line"><span>' + esc(p.name) + ' × ' + state.cart[id] + ' kg</span><b>฿' + money(p.price * state.cart[id]) + '</b></div>' : '';
    }).join('');

    return '<section class="fg-page"><div class="fg-container"><div class="fg-page-head"><span class="fg-kicker">CHECKOUT</span><h1>ยืนยันคำสั่งซื้อ</h1><p>กรอกข้อมูลจัดส่ง เลือกช่องทางชำระเงิน และส่งหลักฐานการชำระเงินถ้ามี</p></div>' +
      '<form id="checkout-form" class="fg-checkout-layout">' +
      '<div class="fg-checkout-main"><div class="fg-form-card"><h2>1. ข้อมูลจัดส่ง</h2><div class="fg-form-grid">' +
      '<label>ชื่อผู้รับ<input name="customer_name" value="' + esc(profile.full_name || '') + '" required></label>' +
      '<label>เบอร์โทรศัพท์<input name="phone" value="' + esc(profile.phone || '') + '" required></label>' +
      '<label class="full">ที่อยู่<textarea name="delivery_address" rows="3" required></textarea></label>' +
      '<label>จังหวัด<input name="province" required></label><label>อำเภอ/เขต<input name="district" required></label>' +
      '<label>ตำบล/แขวง<input name="subdistrict" required></label><label>รหัสไปรษณีย์<input name="postal_code" inputmode="numeric" pattern="[0-9]{5}" required></label>' +
      '<label class="full">หมายเหตุ<input name="note" placeholder="เช่น เวลาที่สะดวกให้จัดส่ง"></label>' +
      '</div></div>' +
      '<div class="fg-form-card"><h2>2. ช่องทางชำระเงิน</h2><div class="fg-payment-options">' +
      '<label><input type="radio" name="payment_method" value="promptpay" checked><span><b>QR PromptPay</b><small>ชำระผ่าน QR และแนบหลักฐานได้</small></span></label>' +
      '<label><input type="radio" name="payment_method" value="bank_transfer"><span><b>โอนเงินผ่านธนาคาร</b><small>แนบหลักฐานการโอนได้</small></span></label>' +
      (state.settings?.cod_enabled ? '<label><input type="radio" name="payment_method" value="cod"><span><b>เก็บเงินปลายทาง</b><small>ชำระเมื่อได้รับสินค้า</small></span></label>' : '') +
      '</div><div class="fg-payment-note"><b>ข้อมูลการชำระเงิน</b>' + (state.settings?.promptpay_number ? '<p><b>PromptPay:</b> ' + esc(state.settings.promptpay_name || '') + ' ' + esc(state.settings.promptpay_number) + '</p>' : '') + (state.settings?.bank_account_number ? '<p><b>' + esc(state.settings.bank_name || 'ธนาคาร') + '</b><br>ชื่อบัญชี: ' + esc(state.settings.bank_account_name) + '<br>เลขบัญชี: ' + esc(state.settings.bank_account_number) + '</p>' : '') + (!state.settings?.promptpay_number && !state.settings?.bank_account_number ? '<p>ร้านค้ายังไม่ได้ตั้งค่าข้อมูลรับชำระเงิน</p>' : '') + (state.settings?.shipping_note ? '<p>' + esc(state.settings.shipping_note) + '</p>' : '') + '</div>' +
      '<label>หลักฐานการชำระเงิน (ถ้ามี)<input id="payment-proof" name="payment_proof" type="file" accept="image/*,.pdf"></label><small class="fg-muted">รองรับ JPG, PNG หรือ PDF ขนาดไม่เกิน 6 MB</small></div>' +
      '<div class="fg-form-card"><h2>3. ตรวจสอบและยืนยัน</h2><p class="fg-muted">เมื่อยืนยัน ระบบจะตรวจสอบสต็อกและตัดสินค้าออกจากสต็อกแบบรายการเดียว</p><button class="fg-btn fg-btn-green fg-full-btn" type="submit">ยืนยันคำสั่งซื้อ ฿' + money(cartTotal()) + '</button><p id="checkout-status" class="fg-muted"></p></div></div>' +
      '<aside class="fg-summary"><h2>สรุปคำสั่งซื้อ</h2>' + lines + '<hr><div class="total"><span>ยอดสินค้า</span><b>฿' + money(cartTotal()) + '</b></div><small>ค่าจัดส่งจะแจ้งตามพื้นที่/เงื่อนไขของร้าน</small></aside>' +
      '</form></div></section>';
  }

  async function submitCheckout(form) {
    const status = $('#checkout-status');
    const proof = $('#payment-proof')?.files?.[0];
    const allowedProofTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (proof && proof.size > 6 * 1024 * 1024) {
      status.textContent = 'ไฟล์หลักฐานมีขนาดเกิน 6 MB';
      return;
    }
    if (proof && !allowedProofTypes.includes(proof.type)) {
      status.textContent = 'รองรับเฉพาะ JPG, PNG, WebP หรือ PDF';
      return;
    }

    status.textContent = 'กำลังตรวจสอบข้อมูลและสต็อก...';
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      status.textContent = 'กรุณาเข้าสู่ระบบใหม่';
      return;
    }

    let proofPath = null;
    if (proof) {
      const safeName = proof.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      proofPath = user.id + '/' + Date.now() + '-' + crypto.randomUUID() + '-' + safeName;
      const upload = await supabase.storage.from('payment-proofs').upload(proofPath, proof, {
        cacheControl: '3600',
        upsert: false,
        contentType: proof.type || 'application/octet-stream'
      });
      if (upload.error) {
        status.textContent = 'อัปโหลดหลักฐานไม่สำเร็จ: ' + upload.error.message;
        return;
      }
    }

    const values = Object.fromEntries(new FormData(form).entries());
    const items = Object.entries(state.cart).map(([id, quantity]) => ({
      product_id: Number(id),
      quantity: Number(quantity)
    }));

    const { data: orderId, error } = await supabase.rpc('place_store_order', {
      p_items: items,
      p_customer_name: values.customer_name,
      p_phone: values.phone,
      p_delivery_address: values.delivery_address,
      p_province: values.province,
      p_district: values.district,
      p_subdistrict: values.subdistrict,
      p_postal_code: values.postal_code,
      p_note: values.note || '',
      p_payment_method: values.payment_method,
      p_payment_proof_path: proofPath
    });

    if (error) {
      if (proofPath) await supabase.storage.from('payment-proofs').remove([proofPath]);
      status.textContent = 'สั่งซื้อไม่สำเร็จ: ' + (error.message || 'กรุณาลองใหม่');
      return;
    }

    state.cart = {};
    saveCart();
    location.hash = 'order-success/' + orderId;
  }

  function orderSuccess(id) {
    return '<section class="fg-page"><div class="fg-container fg-success"><div class="fg-success-icon">✓</div><span class="fg-kicker">ORDER CONFIRMED</span><h1>สั่งซื้อเรียบร้อยแล้ว</h1><p>หมายเลขคำสั่งซื้อของคุณคือ</p><strong class="fg-order-number">FGW-' + String(id).padStart(6, '0') + '</strong><p class="fg-muted">ระบบบันทึกคำสั่งซื้อและตัดสต็อกเรียบร้อยแล้ว</p><div class="fg-hero-actions"><a class="fg-btn fg-btn-green" href="#tracking">ติดตามคำสั่งซื้อ</a><a class="fg-btn fg-btn-light" href="#products">กลับไปเลือกสินค้า</a></div></div></section>';
  }

  function account() {
    return '<section class="fg-page"><div class="fg-container fg-account-prompt"><div class="fg-login-visual"><span>FISHGROW</span><h1>จัดการคำสั่งซื้อ<br>ของคุณในที่เดียว</h1><p>เข้าสู่ระบบเพื่อสั่งซื้อสินค้า ดูประวัติ และติดตามสถานะคำสั่งซื้อ</p></div><div class="fg-account-card"><h2>เข้าสู่ระบบ / สมัครสมาชิก</h2><p>ระบบจะพาไปยังหน้าบัญชีเดิมของ FishGrow ที่เชื่อมกับ Supabase Auth</p><a class="fg-btn fg-btn-green fg-full-btn" href="?mode=account">เข้าสู่ระบบ</a><a class="fg-btn fg-btn-light fg-full-btn" href="#products">กลับไปเลือกสินค้า</a></div></div></section>';
  }

  function privacy() {
    return '<section class="fg-page"><div class="fg-container fg-narrow"><div class="fg-page-head"><h1>นโยบายความเป็นส่วนตัว</h1><p>FishGrow เก็บและใช้ข้อมูลเท่าที่จำเป็นต่อการให้บริการและจัดการคำสั่งซื้อ</p></div><div class="fg-policy"><h3>ข้อมูลที่อาจใช้</h3><p>ข้อมูลบัญชี ข้อมูลติดต่อ ข้อมูลจัดส่ง และข้อมูลคำสั่งซื้อ</p><h3>การใช้งานข้อมูล</h3><p>ใช้เพื่อดำเนินการสั่งซื้อ ติดต่อผู้ใช้ และปรับปรุงบริการ</p></div></div></section>';
  }

  async function page() {
    const hash = location.hash.slice(1) || 'home';
    if (hash.startsWith('product/')) return productDetail(hash.split('/')[1]);
    if (hash === 'home') return home();
    if (hash === 'products') return products();
    if (hash === 'compare') return compare();
    if (hash === 'recommend') return recommend();
    if (hash === 'calculator') return calculator();
    if (hash === 'howto') return howto();
    if (hash === 'about') return about();
    if (hash === 'knowledge') return knowledge();
    if (hash.startsWith('knowledge/')) return articleDetail(hash.split('/')[1]);
    if (hash === 'faq') return faq();
    if (hash === 'tracking') return tracking();
    if (hash === 'contact') return contact();
    if (hash === 'cart') return cart();
    if (hash === 'checkout') return checkout();
    if (hash.startsWith('order-success/')) return orderSuccess(hash.split('/')[1]);
    if (hash === 'account') return account();
    if (hash === 'privacy') return privacy();
    if (hash === 'terms' || hash === 'returns') return privacy();
    return home();
  }

  async function trackOrder(code) {
    const result = $('#track-result');
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      result.innerHTML = '<p class="fg-error">กรุณาเข้าสู่ระบบก่อนติดตามคำสั่งซื้อ เพื่อปกป้องข้อมูลคำสั่งซื้อของคุณ</p>';
      return;
    }
    if (!code) {
      result.innerHTML = '<p class="fg-error">กรุณากรอกหมายเลขคำสั่งซื้อ</p>';
      return;
    }
    result.innerHTML = '<p class="fg-muted">กำลังตรวจสอบ...</p>';
    const { data, error } = await supabase
      .from('store_orders')
      .select('id,status,created_at,total_amount,payment_status,tracking_number')
      .eq('id', Number(String(code).replace(/\D/g, '')))
      .maybeSingle();
    if (error || !data) {
      result.innerHTML = '<p class="fg-error">ไม่พบคำสั่งซื้อ หรือระบบไม่อนุญาตให้ตรวจสอบรายการนี้ กรุณาเข้าสู่ระบบ</p>';
      return;
    }
    result.innerHTML = '<div class="fg-timeline"><div class="done">✓ รับคำสั่งซื้อ</div><div class="' + (data.payment_status === 'verified' || data.status !== 'รอรับคำสั่งซื้อ' ? 'done' : '') + '">02 ยืนยันการชำระเงิน</div><div class="' + (['กำลังจัดเตรียม', 'จัดส่งแล้ว', 'เสร็จสิ้น'].includes(data.status) ? 'done' : '') + '">03 กำลังเตรียมสินค้า</div><div class="' + (['จัดส่งแล้ว', 'เสร็จสิ้น'].includes(data.status) ? 'done' : '') + '">04 กำลังจัดส่ง</div><div class="' + (data.status === 'เสร็จสิ้น' ? 'done' : '') + '">05 จัดส่งสำเร็จ</div></div><p><b>สถานะปัจจุบัน:</b> ' + esc(data.status) + '</p>' + (data.tracking_number ? '<p><b>เลข Tracking:</b> ' + esc(data.tracking_number) + '</p>' : '') + '<p><b>การชำระเงิน:</b> ' + esc(data.payment_status || 'pending') + '</p>';
  }

  async function submitContact(form) {
    const status = $('#contact-status');
    const values = Object.fromEntries(new FormData(form).entries());
    status.textContent = 'กำลังส่งข้อความ...';
    const { error } = await supabase.from('contact_messages').insert(values);
    status.textContent = error ? 'ส่งข้อความไม่สำเร็จ กรุณาติดต่อผ่านช่องทางที่ระบุไว้' : 'ส่งข้อความเรียบร้อยแล้ว ขอบคุณที่ติดต่อ FishGrow';
  }

  async function handleClick(e) {
    const nav = e.target.closest('[data-nav]');
    if (nav) return;

    const signout = e.target.closest('[data-public-signout]');
    if (signout) {
      signout.disabled = true;
      const { error } = await supabase.auth.signOut();
      if (error) {
        signout.disabled = false;
        signout.textContent = 'ออกจากระบบไม่สำเร็จ';
        return;
      }
      state.user = null;
      render();
      return;
    }

    const compareButton = e.target.closest('[data-compare]');
    if (compareButton) {
      const id = Number(compareButton.dataset.compare);
      state.compare = state.compare.includes(id) ? state.compare.filter(x => x !== id) : (state.compare.length < 3 ? [...state.compare, id] : state.compare);
      saveCompare();
      render();
      return;
    }

    if (e.target.closest('[data-clear-compare]')) {
      state.compare = [];
      saveCompare();
      render();
      return;
    }

    const add = e.target.closest('[data-add]');
    if (add) {
      const id = add.dataset.add;
      const p = state.products.find(x => String(x.product_id) === id);
      if (p && Number(state.cart[id] || 0) < Number(p.stock)) {
        state.cart[id] = Number(state.cart[id] || 0) + 1;
        saveCart();
        render();
      }
      return;
    }

    const choice = e.target.closest('[data-choice-key]');
    if (choice) {
      state.recommendation[choice.dataset.choiceKey] = choice.dataset.choiceValue;
      render();
      return;
    }

    if (e.target.closest('[data-reset-recommend]')) {
      state.recommendation = { fish: '', stage: '', goal: '', farm: '' };
      render();
      return;
    }

    const delta = e.target.closest('[data-cart-delta]');
    if (delta) {
      const [id, d] = delta.dataset.cartDelta.split(':');
      const p = state.products.find(x => String(x.product_id) === id);
      const next = Number(state.cart[id] || 0) + Number(d);
      if (next <= 0) delete state.cart[id];
      else if (p && next <= Number(p.stock)) state.cart[id] = next;
      saveCart();
      render();
      return;
    }

    const remove = e.target.closest('[data-cart-remove]');
    if (remove) {
      delete state.cart[remove.dataset.cartRemove];
      saveCart();
      render();
      return;
    }

    const track = e.target.closest('[data-track-submit]');
    if (track) {
      trackOrder($('#track-code')?.value.trim());
      return;
    }

    const mediaPlay = e.target.closest('[data-media-play]');
    if (mediaPlay) {
      const media = document.querySelector('[data-about-video]');
      if (ABOUT_MEDIA.youtubeUrl) {
        media.innerHTML = '<iframe src="' + esc(ABOUT_MEDIA.youtubeUrl) + '" title="FISHGROW" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
      } else if (ABOUT_MEDIA.videoUrl) {
        media.innerHTML = '<video controls autoplay' + (ABOUT_MEDIA.videoPosterUrl ? ' poster="' + esc(ABOUT_MEDIA.videoPosterUrl) + '"' : '') + '><source src="' + esc(ABOUT_MEDIA.videoUrl) + '" type="video/mp4">เบราว์เซอร์นี้ไม่รองรับวิดีโอ MP4</video>';
      } else {
        mediaPlay.blur();
        mediaPlay.setAttribute('aria-label', 'ยังไม่มีวิดีโอจริง');
        const note = media.querySelector('.fg-media-placeholder em');
        if (note) note.textContent = 'ยังไม่มีวิดีโอจริง · เพิ่ม YouTube หรือ MP4 ภายหลัง';
      }
      return;
    }

    const heroVideoCtrl = e.target.closest('[data-hero-video-ctrl]');
    if (heroVideoCtrl) {
      const vid = document.querySelector('.fg-hero-bg-video');
      if (vid) {
        const icon = heroVideoCtrl.querySelector('.fg-ctrl-icon');
        if (vid.paused) {
          vid.play().catch(() => { });
          heroVideoCtrl.classList.remove('paused');
          if (icon) icon.textContent = '⏸';
        } else {
          vid.pause();
          heroVideoCtrl.classList.add('paused');
          if (icon) icon.textContent = '▶';
        }
      }
      return;
    }

    const menu = e.target.closest('.fg-menu-btn');
    if (menu) {
      document.querySelector('.fg-main-nav')?.classList.toggle('open');
      return;
    }
  }

  function handleSubmit(e) {
    if (e.target.id === 'calc-form') {
      e.preventDefault();
      state.calculator = Object.fromEntries(new FormData(e.target).entries());
      render();
    }
    if (e.target.id === 'contact-form') {
      e.preventDefault();
      submitContact(e.target);
    }
    if (e.target.id === 'checkout-form') {
      e.preventDefault();
      submitCheckout(e.target);
    }
  }

  async function render() {
    app.innerHTML = header() + await page() + footer();
    setupHeroVideo();
    window.scrollTo({ top: 0, behavior: 'instant' });
    const heroVideo = document.querySelector('.fg-hero-bg-video');
    if (heroVideo && heroVideo.paused) {
      heroVideo.play().catch(() => { });
    }
  }

  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);
  window.addEventListener('hashchange', render);

  (async function init() {
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'account' || params.get('mode') === 'admin') {
      const script = document.createElement('script');
      script.src = 'app.js';
      document.body.appendChild(script);
      return;
    }
    await loadProducts();
    render();
  })();
})();
