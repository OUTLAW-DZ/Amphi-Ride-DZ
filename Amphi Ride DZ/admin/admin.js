
// المتغيرات العامة
let students = [];
let vehicles = [];
let stations = [];
let history = [];
let priceData = { perMin: '', monthly: '' };
let offers = [];
let payments =[];

let nextVehID = 1;

// متغيرات التعديل والحذف (سنخزن الـ ID الحقيقي من قاعدة البيانات)
let deleteStudentId = null;
let editStudentId = null;
let deleteVehicleId = null;
let editStationId = null;


//  جلب البيانات من Supabase عند تحميل الصفحة
async function fetchAllData() {
    // جلب الطلاب
    let { data: sData } = await db.from('students').select('*');
    students = sData || [];
    // جلب المركبات وحساب الـ ID التالي
    let { data: vData } = await db.from('vehicles').select('*');
    vehicles = vData || [];
    if (vehicles.length > 0) {
        // استخراج الرقم من آخر ID (مثال B00001 -> 1)
        const ids = vehicles.map(v => parseInt(v.id.substring(1)));
        nextVehID = Math.max(...ids) + 1;
    }
    // جلب المحطات
    let { data: stData } = await db.from('stations').select('*');
    stations = stData || [];
    // جلب السجل
    let { data: hData } = await db.from('history').select('*');
    history = hData || [];
    // جلب الأسعار
    let { data: pData } = await db.from('prices').select('*').eq('id', 1).single();
    if (pData) priceData = pData;
    // جلب العروض
    let { data: oData } = await db.from('offers').select('*');
    offers = oData || [];

    // جلب المدفوعات
    let { data: payData } = await db.from('payments').select('*');
    payments = payData || [];
}

//  البث المباشر (Realtime) - تحديث الواجهة تلقائياً بدون Refresh
function setupRealtimeUpdates() {
    db.channel('admin-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, async (payload) => {
        await fetchAllData();
        renderBikeScooter();
        updateDashboard();
        renderStations();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'history' }, async (payload) => {
        await fetchAllData();
        renderHistory();
        updateDashboard();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stations' }, async (payload) => {
        await fetchAllData();
        renderStations();
        updateDashboard();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, async (payload) => {
        await fetchAllData();
        renderStudent();
        updateDashboard();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, async (payload) => {
        await fetchAllData();
        renderOffers();
      })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, async (payload) => {
        await fetchAllData();
        updateDashboard(); // لتحديث الأرباح فوراً
      })
      .subscribe();
}


//  Sidebar & Navigation
function showSidebar() { document.getElementById("sidebar").style.display = "flex"; }
function hideSidebar() { document.getElementById("sidebar").style.display = "none"; }

var pages = ['dashbord', 'student', 'bike_scooter', 'stations', 'history', 'price'];
function showPage(pageID) {
    for (var i = 0; i < pages.length; i++) {
        var el = document.getElementById(pages[i]);
        if (el) el.style.display = pages[i] === pageID ? "block" : "none";
    }
    hideSidebar();
}

function showDashboard() { showPage("dashbord"); updateDashboard(); }
function showStudent() { showPage("student"); renderStudent(); }
function showBikeScooter() { showPage("bike_scooter"); renderBikeScooter(); }
function showStations() { showPage("stations"); renderStations(); }
function showHistory() { showPage("history"); renderHistory(); }
function showPrice() { showPage("price"); loadPrice(); renderOffers(); }


//  Dashboard
function updateDashboard() {
    var available = 0, rented = 0, maintenance = 0;
    for (var i = 0; i < vehicles.length; i++) {
        if (vehicles[i].status === "Available") available++;
        if (vehicles[i].status === "Rented") rented++;
        if (vehicles[i].status === "Maintenance") maintenance++;
    }

    var totalElement = document.querySelector(".card.orange .main-number");
    if (totalElement) totalElement.textContent = vehicles.length;
    
    var regesterdElement = document.querySelector(".card.green .main-number");
    if (regesterdElement) regesterdElement.textContent = students.length;
    
    var tripsElement = document.querySelector(".card.blue .main-number");
    if (tripsElement) tripsElement.textContent = rented;

    var revenue = 0;
    var monthlyRevenue = 0;
    var currentDate = new Date();
    var currentMonth = currentDate.getMonth(); 
    var currentYear = currentDate.getFullYear(); 

    for (i = 0; i < history.length; i++) {
        var n = parseFloat(history[i].cost);
        if (!isNaN(n)) {
            revenue += n; 
            if (history[i].date) {
                var rideDate = new Date(history[i].date);
                if (rideDate.getMonth() === currentMonth && rideDate.getFullYear() === currentYear) {
                    monthlyRevenue += n; 
                }
            }
        }
    }

    for (i = 0; i < payments.length; i++) {
        var pAmount = parseFloat(payments[i].amount);
        if (!isNaN(pAmount)) {
            revenue += pAmount; 
            if (payments[i].date) {
                var payDate = new Date(payments[i].date);
                if (payDate.getMonth() === currentMonth && payDate.getFullYear() === currentYear) {
                    monthlyRevenue += pAmount; 
                }
            }
        }
    }

    var revenueElement = document.querySelector(".card.red .main-number");
    if (revenueElement) revenueElement.textContent = revenue + " DA";

    var monthlyElement = document.querySelector(".card.red .card-footer span");
    if (monthlyElement) monthlyElement.textContent = "Ce mois: " + monthlyRevenue + " DA";

    var badgeAvailable = document.querySelector(".card.orange .status-badge.available");
    if (badgeAvailable) badgeAvailable.innerHTML = badgeAvailable.innerHTML.replace(/\d+\s*Available/, available + " Available");
    var badgeRented = document.querySelector(".card.orange .status-badge.rented");
    if (badgeRented) badgeRented.innerHTML = badgeRented.innerHTML.replace(/\d+\s*Rented/, rented + " Rented");

    var counters = document.querySelectorAll("#fleet_status .counter");
    if (counters[0]) counters[0].textContent = available;
    if (counters[1]) counters[1].textContent = rented;
    if (counters[2]) counters[2].textContent = maintenance;

    renderDashboardStations();
}

function renderDashboardStations() {
    var container = document.getElementById("available-station");
    if (!container) return;
    container.innerHTML = '<h2>Available station</h2>';
    for (var i = 0; i < stations.length; i++) {
        var station = stations[i];
        var div = document.createElement("div");
        div.className = "station-card";
        div.innerHTML = '<p><strong>' + station.name + '</strong></p>' +
            '<p><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style="vertical-align:middle;"><path d="M6 8.44c-.02 5.1 5.17 9.18 5.39 9.35.18.14.4.21.61.21s.43-.07.61-.21c.22-.17 5.41-4.25 5.39-9.35C18 4.89 15.31 2 12 2S6 4.89 6 8.44m10 0c.01 3.19-2.74 6.08-4 7.24-1.26-1.15-4.01-4.04-4-7.24C8 5.99 9.79 4 12 4s4 1.99 4 4.44"/><path d="M12 6a2 2 0 1 0 0 4 2 2 0 1 0 0-4m6.02 8.73c-.4.64-.84 1.23-1.27 1.76C18.88 16.97 20 17.68 20 18c0 .51-2.75 2-8 2s-8-1.49-8-2c0-.32 1.12-1.03 3.25-1.51-.43-.53-.86-1.12-1.27-1.76C3.66 15.37 2 16.44 2 18c0 2.75 5.18 4 10 4s10-1.25 10-4c0-1.56-1.67-2.63-3.98-3.27"/></svg> ' +
            (station.address || 'No address') + '</p>';
        container.appendChild(div);
    }
}


//  Student Management
function renderStudent() {
    var tbody = document.getElementById("tableBodyS");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">No students yet.</td></tr>';
        return;
    }
    for (var i = 0; i < students.length; i++) {
        var student = students[i];
        var tr = document.createElement("tr");
               tr.innerHTML = `
            <td data-label="Name">${student.name}</td>
            <td data-label="Student ID">${student.student_id}</td>
            <td data-label="BAC">${student.bac}</td>
            <td data-label="Password">••••••</td>
            <td data-label="Action">
                <div id="action">
                    <button class="btn-action btn-delete" onclick="askDeleteStudent(${student.id})">🗑️</button>
                    <button class="btn-action btn-edit" onclick="editStudent(${student.id})">✏️</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    }
}

function showFormS(){
    editStudentId = null;
    document.getElementById("add-form-overlayS").style.display = "flex";
    var form = document.getElementById("add-student-form");
    form.elements["name"].disabled = false;
    form.elements["student-id"].disabled = false;
    form.elements["bac"].disabled = false;

    document.getElementById("titel-form-cardS").textContent = "Add student";
    document.getElementById("btn-submitS").textContent = "Add student";
    form.reset();

    form.elements["student-id"].oninput = function() {
        var val = this.value.trim();
        if(val.length >= 4) {
            form.elements["bac"].value = val.substring(0, 4);
        } else {
            form.elements["bac"].value = "";
        }
    };
}

function hideFormS(){
    var form = document.getElementById("add-student-form");
    form.elements["name"].disabled = false;
    form.elements["student-id"].disabled = false;
    form.elements["bac"].disabled = false;
    document.getElementById("add-form-overlayS").style.display = "none";
    editStudentId = null;
    form.elements["student-id"].oninput = null; 
}

function editStudent(id){
    editStudentId = id;
    var student = students.find(s => s.id === id);
    if(!student) return;
    
    var form = document.getElementById("add-student-form");
    form.elements["name"].value = student.name;
    form.elements["student-id"].value = student.student_id;
    form.elements["bac"].value = student.bac;
    form.elements["password"].value = student.password;
    
    form.elements["name"].disabled = true;
    form.elements["student-id"].disabled = true;
    form.elements["bac"].disabled = false;

    document.getElementById("titel-form-cardS").textContent = "Edit student";
    document.getElementById("btn-submitS").textContent = "Save changes";
    document.getElementById("add-form-overlayS").style.display = "flex";
    
    form.elements["student-id"].oninput = null; 

    form.elements["bac"].oninput = function() {
        var bacVal = this.value.trim();
        var currentStudentId = form.elements["student-id"].value;
    
        if (bacVal.length === 4 && currentStudentId.length > 4) {
            form.elements["student-id"].value = bacVal + currentStudentId.substring(4);
        }
    };
}

function askDeleteStudent(id) {
    const student = students.find(s => s.id === id);
    if (!student) return;

    let reason = "";

    if (student.is_subscribed) {
        reason += "⚠️ This student has an active MONTHLY SUBSCRIPTION.\n";
    }
    if (student.rented_vehicle_id) {
        reason += "🛴 This student is currently RENTING a vehicle (ID: " + student.rented_vehicle_id + ").\n";
    }

    if (reason !== "") {
        showToast("❌ Cannot delete this student!\n\n" + reason + "\nPlease wait until it's resolved.", 'warning');
        return; 
    }

    deleteStudentId = id;
    document.getElementById("overlay-verify-delete-S").style.display = "flex";
}

function hideVerifyS() {
    deleteStudentId = null;
    document.getElementById("overlay-verify-delete-S").style.display = "none";
}

async function deleteStudent() {
    if (deleteStudentId === null) return;
    const { error } = await db.from('students').delete().eq('id', deleteStudentId);
    if (error) { showToast('Error deleting student', 'error'); return; }
    
    students = students.filter(s => s.id !== deleteStudentId);
    hideVerifyS();
    renderStudent();
    updateDashboard();
    showToast('Student deleted successfully!', 'success');
}


//  Bike / Scooter Management
function renderBikeScooter(){
    var tbody = document.getElementById("tableBodyBS");
    if(!tbody) return;
    tbody.innerHTML = "";
    if(vehicles.length === 0){
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888;">No vehicles yet.</td></tr>';
        return;
    }
    for(i = 0; i < vehicles.length; i++){
        var vehicle = vehicles[i];
        var tr = document.createElement("tr");
        
        var statusColor = "orange";
        if(vehicle.status === "Available") statusColor = "green";
        if(vehicle.status === "Rented") statusColor = "red";

        var statusHTML = '';
        if (vehicle.status === 'Rented') {
            statusHTML = '<span style="color:red; font-weight:bold; background:#fee2e2; padding:8px; border-radius:6px; display:inline-block;"> Rented (By Student)</span>';
        } else {
            statusHTML = '<select onchange="changeVehicleStatus(\'' + vehicle.id + '\', this.value)" style="border-color:' + statusColor + '; padding:8px; border-radius:6px; cursor:pointer;">' +
                '<option value="Available" ' + (vehicle.status === 'Available' ? 'selected' : '') + '>✅ Available</option>' +
                '<option value="Maintenance" ' + (vehicle.status === 'Maintenance' ? 'selected' : '') + '>🔧 Maintenance</option>' +
            '</select>';
        }

        tr.innerHTML = 
        `<td data-label="ID">${vehicle.id}</td>
        <td data-label="Place">${vehicle.place}</td>
        <td data-label="Status">${statusHTML}</td>
        <td data-label="Action">
            <button class="delete-btn" onclick="askDeleteBS('${vehicle.id}')" style="background:none; border:none; cursor:pointer; color:red; font-size:1.2rem;">🗑️</button>
        </td>`;
        tbody.appendChild(tr);
    }
}

async function changeVehicleStatus(id, status) {
    const { error } = await db.from('vehicles').update({ status: status }).eq('id', id);
    if (error) { showToast('Error updating status', 'error'); return; }
    
    var vehicle = vehicles.find(v => v.id === id);
    if(vehicle) vehicle.status = status;
    updateDashboard();
}

function showFormBS() {
    if (stations.length === 0) { showToast("You must add at least one station first.", 'warning'); return; }
    var select = document.getElementById("placeUNIV");
    if (select) {
        select.innerHTML = "";
        for (var i = 0; i < stations.length; i++) {
            var option = document.createElement("option");
            option.value = stations[i].name;
            option.textContent = stations[i].name;
            select.appendChild(option);
        }
    }
    document.getElementById("add-form-overlayBS").style.display = "flex";
}

function hideFormBS() { document.getElementById("add-form-overlayBS").style.display = "none"; }

function askDeleteBS(id) {
    const vehicle = vehicles.find(v => v.id === id);
    
    if (vehicle && vehicle.status === 'Rented') {
        showToast('❌ Cannot delete this vehicle!\n\nIt is currently RENTED by a student.', 'warning');
        return; 
    }

    deleteVehicleId = id;
    document.getElementById("overlay-verify-delete-BS").style.display = "flex";
}

function hideVerifyDeleteBS() {
    deleteVehicleId = null;
    document.getElementById("overlay-verify-delete-BS").style.display = "none";
}

async function confirmDeleteBS() {
    if (deleteVehicleId === null) return;
    
    const vehicle = vehicles.find(v => v.id === deleteVehicleId);
    if (vehicle && vehicle.status === 'Rented') {
        showToast('❌ Deletion canceled! This vehicle was just rented by a student.', 'warning');
        hideVerifyDeleteBS();
        return;
    }

    const { error } = await db.from('vehicles').delete().eq('id', deleteVehicleId);
    if (error) { showToast('Error deleting vehicle', 'error'); return; }
    
    vehicles = vehicles.filter(v => v.id !== deleteVehicleId);
    hideVerifyDeleteBS();
    renderBikeScooter();
    updateDashboard();
    showToast('Vehicle deleted successfully!', 'success');
}


//  Station Management
function renderStations() {
    var container = document.getElementById("card-container");
    if (!container) return;
    container.innerHTML = "";
    if (stations.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#888;">No stations yet.</p>';
        return;
    }
    for (var i = 0; i < stations.length; i++) {
        var station = stations[i];
        var avail = 0;
        for (var j = 0; j < vehicles.length; j++) {
            if (vehicles[j].place === station.name && vehicles[j].status === "Available") avail++;
        }
        var div = document.createElement("div");
        div.className = "card-M";
        div.innerHTML = '<div class="header-card-M"><span><strong>' + station.name + '</strong></span><span>' + avail + ' Available</span></div>' +
            '<p class="location-info"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style="vertical-align:middle;"><path d="M6 8.44c-.02 5.1 5.17 9.18 5.39 9.35.18.14.4.21.61.21s.43-.07.61-.21c.22-.17 5.41-4.25 5.39-9.35C18 4.89 15.31 2 12 2S6 4.89 6 8.44m10 0c.01 3.19-2.74 6.08-4 7.24-1.26-1.15-4.01-4.04-4-7.24C8 5.99 9.79 4 12 4s4 1.99 4 4.44"/><path d="M12 6a2 2 0 1 0 0 4 2 2 0 1 0 0-4m6.02 8.73c-.4.64-.84 1.23-1.27 1.76C18.88 16.97 20 17.68 20 18c0 .51-2.75 2-8 2s-8-1.49-8-2c0-.32 1.12-1.03 3.25-1.51-.43-.53-.86-1.12-1.27-1.76C3.66 15.37 2 16.44 2 18c0 2.75 5.18 4 10 4s10-1.25 10-4c0-1.56-1.67-2.63-3.98-3.27"/></svg> ' +
            (station.address || 'No address') + '</p>' +
            '<div class="btn-action-M">' +
                '<button class="edit-btn" onclick="editStation(' + station.id + ')">✏️ Modify</button>' +
                '<button class="delete-btn" onclick="askDeleteStation(' + station.id + ')">🗑️</button>' +
            '</div>';
        container.appendChild(div);
    }
}

function showFormCardStation() {
    editStationId = null;
    document.getElementById("titel-form-card-station").textContent = "Add station";
    document.getElementById("add-station-form").reset();
    document.getElementById("add-overlay-station").style.display = "flex";
}

function hideAddOverlayStation() { document.getElementById("add-overlay-station").style.display = "none"; }

function editStation(id) {
    editStationId = id;
    var station = stations.find(s => s.id === id);
    if(!station) return;
    
    var inputs = document.querySelectorAll("#add-station-form input");
    inputs[0].value = station.name || "";
    inputs[1].value = station.address || "";
    inputs[2].value = station.lat || "";
    inputs[3].value = station.lng || "";
    
    document.getElementById("titel-form-card-station").textContent = "Edit station";
    document.querySelector("#add-station-form .add-btn").textContent = "Save changes";
    document.getElementById("add-overlay-station").style.display = "flex";
}

async function askDeleteStation(id) {
    const station = stations.find(s => s.id === id);
    if (!station) return;

    const vehiclesInStation = vehicles.filter(v => v.place === station.name);
    const rentedVehicles = vehiclesInStation.filter(v => v.status === 'Rented');
    const otherVehicles = vehiclesInStation.filter(v => v.status !== 'Rented');

    if (rentedVehicles.length > 0) {
        showToast('❌ Cannot delete station "' + station.name + '".\n\nThere are ' + rentedVehicles.length + ' vehicle(s) currently RENTED by students.', 'warning');
        return; 
    }

    let confirmMessage = 'Are you sure you want to delete station "' + station.name + '"?';
    
    if (otherVehicles.length > 0) {
        confirmMessage = '⚠️ WARNING: There are ' + otherVehicles.length + ' vehicle(s) currently at "' + station.name + '" (Available/Maintenance).\n\nAll these vehicles will be PERMANENTLY DELETED if you delete the station.\n\nDo you still want to delete?';
    }

    var answer = confirm(confirmMessage);

    if (answer) {
        try {
            if (otherVehicles.length > 0) {
                const { error: vError } = await db.from('vehicles').delete().eq('place', station.name); 
                if (vError) {
                    showToast('Error deleting vehicles in this station: ' + vError.message, 'error');
                    return; 
                }
                vehicles = vehicles.filter(v => v.place !== station.name);
            }

            const { error: sError } = await db.from('stations').delete().eq('id', id);
            if (sError) {
                showToast('Error deleting station: ' + sError.message, 'error');
                return;
            }

            stations = stations.filter(s => s.id !== id);
            renderStations();
            renderBikeScooter(); 
            updateDashboard();   
            
            showToast('Station deleted successfully!', 'success');

        } catch (err) {
            showToast('An unexpected error occurred.', 'error');
            console.error(err);
        }
    }
}


//  OpenStreetMap Geocoding
function geocodeAddress(val) {
    const inputs = document.querySelectorAll('#add-station-form input');
    const latInput = inputs[2];
    const lngInput = inputs[3]; 
    const infoEl = document.getElementById('information');
    latInput.value = '';
    lngInput.value = '';
    if (val.trim().length < 3) {
        if (infoEl) { infoEl.textContent = 'Type an address to auto-fill coordinates.'; infoEl.style.color = '#888'; }
        const oldDrop = document.getElementById('geocode-suggestions');
        if (oldDrop) oldDrop.remove();
        return;
    }
    if (infoEl) { infoEl.textContent = 'Searching...'; infoEl.style.color = '#3b82f6'; }
    clearTimeout(geocodeAddress._timer);
    geocodeAddress._timer = setTimeout(async () => {
        try {
            const res = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(val) + '&format=json&limit=5&countrycodes=dz', { headers: { 'Accept-Language': 'en' } });
            const data = await res.json();
            const oldDrop = document.getElementById('geocode-suggestions');
            if (oldDrop) oldDrop.remove();
            if (!data.length) { if (infoEl) { infoEl.textContent = 'No location found.'; infoEl.style.color = '#ef4444'; } return; }
            const pick = function (item) {
                latInput.value = parseFloat(item.lat).toFixed(6);
                lngInput.value = parseFloat(item.lon).toFixed(6);
                inputs[1].value = item.display_name;
                if (infoEl) { infoEl.textContent = 'Found: ' + item.display_name; infoEl.style.color = '#22c55e'; }
                const drop = document.getElementById('geocode-suggestions');
                if (drop) drop.remove();
            };
            if (data.length === 1) { pick(data[0]); return; }
            const dropdown = document.createElement('ul');
            dropdown.id = 'geocode-suggestions';
            dropdown.style.cssText = 'list-style:none;margin:6px 0 0;padding:0;border:1px solid #e2e8f0;border-radius:8px;background:#fff;max-height:180px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.1);z-index:999;';
            data.forEach(function (item) {
                const li = document.createElement('li');
                li.textContent = item.display_name;
                li.style.cssText = 'padding:9px 12px;cursor:pointer;font-size:.85rem;border-bottom:1px solid #f1f5f9;';
                li.onclick = function () { pick(item); };
                dropdown.appendChild(li);
            });
            inputs[1].parentNode.insertBefore(dropdown, inputs[1].nextSibling);
        } catch (e) { if (infoEl) { infoEl.textContent = 'Network error.'; infoEl.style.color = '#f59e0b'; } }
    }, 1000);
}


//  History
function renderHistory() {
    var tbody = document.getElementById('tableBodyH');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;">No history yet.</td></tr>';
        return;
    }
    for (var i = 0; i < history.length; i++) {
        var h = history[i];
        var tr = document.createElement('tr');
            tr.innerHTML = `
            <td data-label="Student ID">${h.student_id || 'N/A'}</td> 
            <td data-label="Name">${h.student_name || 'N/A'}</td>
            <td data-label="Start">${h.start_time}</td>
            <td data-label="End">${h.end_time}</td>
            <td data-label="Duration">${h.duration}</td>
            <td data-label="Cost">${h.cost}</td>`;
        tbody.appendChild(tr);
    }
}


//  Price
function loadPrice() {
    document.getElementById('price-min').value = priceData.per_min || '';
    const displayEl = document.getElementById('current-price-display');
    if (displayEl) {
        displayEl.textContent = (priceData.per_min || '0') + ' DA';
    }
}

// ---------- Offers Management ----------
function renderOffers() {
    const container = document.getElementById('offers-container');
    if (!container) return;
    container.innerHTML = '';

    if (offers.length === 0) {
        container.innerHTML = '<p style="color:#888;">No offers added yet.</p>';
        return;
    }

    offers.forEach(offer => {
        const card = document.createElement('div');
        card.style.cssText = 'background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); position: relative;';
        
        card.innerHTML = `
            <h3 style="margin-top:0; color:#1e293b;">${offer.title}</h3>
            <p style="font-size: 2rem; font-weight: bold; color: #22c55e; margin: 15px 0;">${offer.price} DA <span style="font-size: 1rem; color: #64748b; font-weight: normal;">/ month</span></p>
            <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">${offer.description || 'No description'}</p>
            <button onclick="deleteOffer(${offer.id})" style="position:absolute; top:15px; right:15px; background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.2rem;" title="Delete Offer">🗑️</button>
        `;
        container.appendChild(card);
    });
}

function showAddOfferForm() {
    document.getElementById('add-offer-overlay').style.display = 'flex';
    document.getElementById('add-offer-form').reset();
}

function hideAddOfferForm() {
    document.getElementById('add-offer-overlay').style.display = 'none';
}

async function deleteOffer(id) {
    if (!confirm('Are you sure you want to delete this offer?')) return;
    
    const { error } = await db.from('offers').delete().eq('id', id);
    if (error) { showToast('Error deleting offer', 'error'); return; }
    
    offers = offers.filter(o => o.id !== id);
    renderOffers();
    showToast('Offer deleted successfully!', 'success');
}


// ============================================================
//  Toast Message System (الجديد)
// ============================================================
function showToast(msg, type = 'success') {
    var toast = document.getElementById('toast-msg');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-msg';
        toast.style.cssText = 'position:fixed;bottom:30px;right:30px;padding:15px 25px;border-radius:8px;fontWeight:600;z-index:2147483647;boxShadow:0 4px 12px rgba(0,0,0,.2);transition:opacity .4s, transform .4s;transform:translateY(20px);opacity:0;font-size:1rem;max-width:400px;white-space:pre-wrap;';
        document.body.appendChild(toast);
    }

    // Set colors based on type
    if (type === 'success') {
        toast.style.background = '#22c55e'; // Green
        toast.style.color = '#ffffff';
    } else if (type === 'warning') {
        toast.style.background = '#f59e0b'; // Yellow
        toast.style.color = '#1e293b'; // Dark text for yellow
    } else if (type === 'error') {
        toast.style.background = '#ef4444'; // Red
        toast.style.color = '#ffffff';
    }

    toast.textContent = msg;
    
    // Show animation
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);

    // Clear previous timeout if any
    if (toast._timeout) clearTimeout(toast._timeout);

    // Hide after 3 seconds
    toast._timeout = setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
    }, 3000);
}


//  عند تحميل الصفحة (DOMContentLoaded)
document.addEventListener('DOMContentLoaded', async function() {
    await fetchAllData();
    setupRealtimeUpdates();

    // 2. إعداد نموذج الطلاب
    var studentForm = document.getElementById('add-student-form');
    if (studentForm) {
        studentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var f = studentForm.elements;
            var name = f['name'].value.trim();
            var studentId = f['student-id'].value.trim();
            var bac = f['bac'].value.trim();
            var password = f['password'].value.trim();

            if (!name || !studentId || !bac || !password) {
                showToast('Please fill all fields.', 'warning');
                return;
            }
             
            var bacYear = parseInt(bac, 10); 
            var currentYear = new Date().getFullYear(); 
            
            if (isNaN(bacYear) || bacYear < 2000 || bacYear > currentYear) {
                showToast('Invalid BAC year! Please enter a year between 2000 and ' + currentYear + '.', 'warning');
                return; 
            }

            if (editStudentId !== null) {
                var oldStudent = students.find(s => s.id === editStudentId);
                name = oldStudent.name;
                //studentId = oldStudent.student_id;

                const { data, error } = await db.from('students').update({ bac: bac, password: password, student_id: studentId }).eq('id', editStudentId).select();
                if (error) { showToast('Error updating student: ' + error.message, 'error'); return; }
                if(data && data.length > 0) {
                    var index = students.findIndex(s => s.id === editStudentId);
                    students[index] = data[0];
                }
                showToast('Student updated successfully!', 'success');
            } else {
                const { data, error } = await db.from('students').insert([{ name: name, student_id: studentId, bac: bac, password: password }]).select();
                if (error) { 
                    if (error.code === '23505') {
                        showToast('⚠️ This student ID already exists. Please enter a different one', 'warning');
                        f['student-id'].value = '';
                        f['student-id'].focus();
                    } else {
                        showToast('Error adding student: ' + error.message, 'error');
                    }
                    return; 
                }
                if(data) students.push(data[0]);
                showToast('Student added successfully!', 'success');
            }

            hideFormS();
            renderStudent();
            updateDashboard();
        });
    }

    var confirmBtnS = document.getElementById('confirm-delete-S');
    if (confirmBtnS) confirmBtnS.onclick = deleteStudent;

    // 3. إعداد نموذج المركبات
    var bsForm = document.getElementById('add-bike-scooter-form');
    if (bsForm) {
        bsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var type = document.getElementById('typeBS').value;
            var place = document.getElementById('placeUNIV').value;
            var prefix = type === 'Bike' ? 'B' : 'S';
            var id = prefix + String(nextVehID).padStart(5, '0');

            const { data, error } = await db.from('vehicles').insert([{ id: id, type: type, place: place, status: 'Available' }]).select();
            if (error) { showToast('Error adding vehicle', 'error'); return; }
            
            if(data) vehicles.push(data[0]);
            nextVehID++;
            
            hideFormBS();
            renderBikeScooter();
            updateDashboard();
            showToast('Vehicle added successfully!', 'success');
        });
    }

    // 4. إعداد نموذج المحطات
    var stForm = document.getElementById('add-station-form');
    if (stForm) {
        stForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var inputs = stForm.querySelectorAll('input');
            var name = inputs[0].value.trim();
            var address = inputs[1].value.trim();
            var lat = parseFloat(inputs[2].value.trim()) || 0;
            var lng = parseFloat(inputs[3].value.trim()) || 0;
            
            if (!name) { showToast('Station name is required.', 'warning'); return; }

            if (editStationId !== null) {
                const { data, error } = await db.from('stations').update({ name: name, address: address, lat: lat, lng: lng }).eq('id', editStationId).select();
                if (error) { showToast('Error updating station', 'error'); return; }
                if(data && data.length > 0) {
                    var index = stations.findIndex(s => s.id === editStationId);
                    stations[index] = data[0];
                }
                editStationId = null;
                showToast('Station updated successfully!', 'success');
            } else {
                const { data, error } = await db.from('stations').insert([{ name: name, address: address, lat: lat, lng: lng }]).select();
                if (error) { showToast('Error adding station', 'error'); return; }
                if(data) stations.push(data[0]);
                showToast('Station added successfully!', 'success');
            }

            hideAddOverlayStation();
            renderStations();
            updateDashboard();
        });
    }

    // 5. إعداد نموذج الأسعار
    var priceForm = document.getElementById('form-card-price');
    if (priceForm) {
        priceForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var newPerMin = document.getElementById('price-min').value;
            
            const { data, error } = await db.from('prices').update({ per_min: newPerMin }).eq('id', 1).select();
            if (error) { showToast('Error saving price', 'error'); return; }
            
            if(data && data.length > 0) {
                priceData = data[0];
                const displayEl = document.getElementById('current-price-display');
                if(displayEl) displayEl.textContent = priceData.per_min + ' DA';
            }
            showToast('Price per minute saved successfully!', 'success');
        });
    }

    // نموذج إضافة عرض جديد
    var offerForm = document.getElementById('add-offer-form');
    if (offerForm) {
        offerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var f = offerForm.elements;
            var title = f['title'].value.trim();
            var price = f['price'].value.trim();
            var desc = f['description'].value.trim();

            if (!title || !price) { showToast('Title and Price are required.', 'warning'); return; }

            const { data, error } = await db.from('offers').insert([{ title: title, price: price, description: desc }]).select();
            if (error) { showToast('Error adding offer: ' + error.message, 'error'); return; }

            if(data) offers.push(data[0]);
            hideAddOfferForm();
            renderOffers();
            showToast('New offer added successfully!', 'success');
        });
    }

    // 6. عرض الداشبورد بعد تحميل كل شيء
    showDashboard();
    renderOffers();
    
    document.querySelectorAll('#sidebar li, ul li').forEach(li => {
        const a = li.querySelector('a');
        if (a && a.textContent.trim() === 'Logout') {
            li.onclick = function(e) {
                e.preventDefault();
                sessionStorage.clear();
                window.location.href = '../index.html';
            };
        }
    });
});
