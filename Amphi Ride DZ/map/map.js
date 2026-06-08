// ============================================================
//  UniWay DZ — map.js (مدمج بالكامل مع Supabase)
//  يعمل في واجهة المشرف (Admin) وواجهة الطالب (Student)
// ============================================================

/* ── MAIN STATIONS MAP ────────────────────────────────────── */
let mainMap       = null;   // الخريطة الرئيسية
let stationMarkers = [];    // علامات المحطات على الخريطة

/* أيقونة الدبوس الملون */
function makeIcon(color) {
  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 24 30">
      <path fill="${color}" stroke="#fff" stroke-width="1"
        d="M12 0C7.6 0 4 3.6 4 8c0 6 8 16 8 16S20 14 20 8c0-4.4-3.6-8-8-8z"/>
      <circle fill="#fff" cx="12" cy="8" r="3.5"/>
    </svg>`,
    iconSize:   [32, 40],
    iconAnchor: [16, 40],
    popupAnchor:[0, -40],
  });
}

/* تهيئة الخريطة الرئيسية */
function initMainMap() {
  const mapDiv = document.getElementById('map');
  if (!mapDiv || mainMap) return; // منع تهيئة الخريطة مرتين

  /* إعطاء حجم للخريطة لتظهر */
  mapDiv.style.cssText = `
    width: 100%;
    height: 420px;
    border-radius: 12px;
    margin-top: 24px;
    z-index: 0;
  `;

  // إحداثيات وهران كنقطة بداية
  mainMap = L.map('map', { zoomControl: true }).setView([35.6871, -0.5900], 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(mainMap);

  renderMainMapMarkers();
}

/* جلب المحطات من Supabase ورسمها على الخريطة */
async function renderMainMapMarkers() {
  if (!mainMap) return;

  /* مسح العلامات القديمة */
  stationMarkers.forEach(m => m.remove());
  stationMarkers = [];

  // جلب البيانات مباشرة من Supabase بدلاً من localStorage
  const { data: stationsData } = await db.from('stations').select('*');
  const { data: vehiclesData } = await db.from('vehicles').select('*');

  if (!stationsData || stationsData.length === 0) return;

  stationsData.forEach(st => {
    const lat = parseFloat(st.lat);
    const lng = parseFloat(st.lng);
    if (!lat || !lng) return;

    // حساب عدد الدراجات المتاحة والمستأجرة في هذه المحطة
    const available = vehiclesData ? vehiclesData.filter(v => v.place === st.name && v.status === 'Available').length : 0;
    const rented    = vehiclesData ? vehiclesData.filter(v => v.place === st.name && v.status === 'Rented').length : 0;
    
    // لون الدبوس (أخضر إذا كانت هناك دراجات متاحة، أحمر إذا لم يكن)
    const color = available > 0 ? '#22c55e' : '#ef4444';

    const marker = L.marker([lat, lng], { icon: makeIcon(color) })
      .addTo(mainMap)
      .bindPopup(`
        <div style="min-width:160px;font-family:Inter,sans-serif;">
          <strong style="font-size:1rem;">${st.name}</strong><br>
          <span style="color:#666;font-size:.82rem;">${st.address || ''}</span>
          <hr style="margin:6px 0;border-color:#eee;">
          <span style="color:#22c55e;">&#11044; ${available} Available</span><br>
          <span style="color:#ef4444;">&#11044; ${rented} Rented</span>
        </div>
      `);

    stationMarkers.push(marker);
  });

  /* تقريب الخريطة لتشمل جميع العلامات */
  if (stationMarkers.length > 0) {
    const group = L.featureGroup(stationMarkers);
    mainMap.fitBounds(group.getBounds().pad(0.3));
  }
}

/* ── FORM MINI-MAP (داخل نافذة إضافة/تعديل المحطة في Admin) ─────────────── */
let formMap     = null;
let formMarker  = null;

function initFormMap(lat, lng) {
  let miniDiv = document.getElementById('form-map-preview');
  if (!miniDiv) {
    miniDiv = document.createElement('div');
    miniDiv.id = 'form-map-preview';
    miniDiv.style.cssText = `
      width: 100%;
      height: 200px;
      border-radius: 8px;
      margin: 10px 0;
      z-index: 1;
      border: 1px solid #e2e8f0;
    `;
    const formCard = document.getElementById('form-card-station');
    const btnGroup = formCard && formCard.querySelector('#form-crad-station-btn');
    if (btnGroup) formCard.insertBefore(miniDiv, btnGroup);
  }

  if (formMap) {
    formMap.setView([lat, lng], 14);
    formMap.invalidateSize();
    return;
  }

  formMap = L.map('form-map-preview').setView([lat, lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(formMap);

  /* إمكانية الضغط على الخريطة المصغرة لاختيار الإحداثيات يدوياً */
  formMap.on('click', e => {
    const inputs = document.querySelectorAll('#add-station-form input');
    inputs[2].value = e.latlng.lat.toFixed(6);
    inputs[3].value = e.latlng.lng.toFixed(6);
    placeFormMarker(e.latlng.lat, e.latlng.lng);
  });
}

function placeFormMarker(lat, lng) {
  if (!formMap) return;
  if (formMarker) { formMarker.remove(); formMarker = null; }
  formMarker = L.marker([lat, lng], { icon: makeIcon('#3b82f6') }).addTo(formMap);
  formMap.setView([lat, lng], 14);
}

/* مراقبة تغيير إحداثيات النموذج لتحديث الخريطة المصغرة تلقائياً */
function watchFormCoords() {
  const inputs = document.querySelectorAll('#add-station-form input');
  if (!inputs[2] || !inputs[3]) return;
  const lat = parseFloat(inputs[2].value);
  const lng = parseFloat(inputs[3].value);
  if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
    initFormMap(lat, lng);
    placeFormMarker(lat, lng);
  }
}

/* ── ربط الخريطة بدوال Admin و Student (Hooks) ────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. عندما يفتح المشرف صفحة المحطات
  const origShowStations = window.showStations;
  window.showStations = function() {
    if (origShowStations) origShowStations();
    setTimeout(() => {
      if (!mainMap) initMainMap();
      else { mainMap.invalidateSize(); renderMainMapMarkers(); }
    }, 100);
  };

  // 2. عندما يضغط المشرف على زر "إضافة محطة" (لفتح الخريطة المصغرة)
  const origShowFormCardStation = window.showFormCardStation;
  window.showFormCardStation = function() {
    if (origShowFormCardStation) origShowFormCardStation();
    setTimeout(() => {
      initFormMap(35.6992, 0.6317); // افتراضي: وهران
      clearInterval(window._coordWatcher);
      window._coordWatcher = setInterval(watchFormCoords, 600);
    }, 250);
  };

  // 3. عندما يغلق المشرف نافذة إضافة المحطة
  const origHideAddOverlayStation = window.hideAddOverlayStation;
  window.hideAddOverlayStation = function() {
    if (origHideAddOverlayStation) origHideAddOverlayStation();
    clearInterval(window._coordWatcher);
  };

  // 4. عندما يضغط المشرف على زر "تعديل" محطة
  const origEditStation = window.editStation;
  window.editStation = function(id) {
    if (origEditStation) origEditStation(id);
    // البحث عن المحطة باستخدام ID الخاص بـ Supabase بدلاً من Index
    const st = window.stations ? window.stations.find(s => s.id === id) : null;
    setTimeout(() => {
      const lat = st ? parseFloat(st.lat) : 35.6992;
      const lng = st ? parseFloat(st.lng) : 0.6317;
      if (lat && lng) {
        initFormMap(lat, lng);
        placeFormMarker(lat, lng);
      } else {
        initFormMap(35.6992, 0.6317);
      }
      clearInterval(window._coordWatcher);
      window._coordWatcher = setInterval(watchFormCoords, 600);
    }, 250);
  };

  // 5. بعد أن يحفظ المشرف المحطة، يتم تحديث العلامات على الخريطة الرئيسية
  const origRenderStations = window.renderStations;
  window.renderStations = function() {
    if (origRenderStations) origRenderStations();
    renderMainMapMarkers();
  };

  // 6. عندما يفتح الطالب صفحة الخريطة والاستئجار
  const origShowRentAndMap = window.showRentAndMap;
  window.showRentAndMap = function() {
    if (origShowRentAndMap) origShowRentAndMap();
    setTimeout(() => {
      if (!mainMap) initMainMap();
      else { mainMap.invalidateSize(); renderMainMapMarkers(); }
    }, 100);
  };

});