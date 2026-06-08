// متغيرات المستخدم والبيانات
let currentUser = sessionStorage.getItem('currentStudentName') || 'Guest';
let isSubscribed = sessionStorage.getItem('isSubscribed') === 'true';
let stations = [];
let vehicles = [];
let offers = [];
let currentRatePerMinute = 5;


//  البث المباشر (Realtime) للطالب - تحديث الواجهة والخريطة تلقائياً
function setupStudentRealtimeUpdates() {
    db.channel('student-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stations' }, async (payload) => {
        let { data: stData } = await db.from('stations').select('*');
        stations = stData || [];
        renderStudentStations(); 
        if (typeof renderMainMapMarkers === 'function') renderMainMapMarkers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, async (payload) => {
        let { data: vData } = await db.from('vehicles').select('*');
        vehicles = vData || [];
        renderStudentStations(); 
        if (typeof renderMainMapMarkers === 'function') renderMainMapMarkers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, async (payload) => {
        let { data: oData } = await db.from('offers').select('*');
        offers = oData || [];
        if(typeof renderStudentOffers === 'function') renderStudentOffers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prices' }, async (payload) => {
        const { data: pData } = await db.from('prices').select('*').eq('id', 1).single();
        if (pData) {
            currentRatePerMinute = parseFloat(pData.per_min); 
            
            const daMinEl = document.getElementById("DA-min");
            if (daMinEl) daMinEl.textContent = pData.per_min + " DA";

            const timerRateEl = document.getElementById("timer-rate-text");
            if (timerRateEl && !isSubscribed) {
                timerRateEl.innerHTML = `
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style="vertical-align: middle;">
                        <path d="M11 11h2v6h-2zm0-4h2v2h-2z"></path><path d="M12 22c5.51 0 10-4.49 10-10S17.51 2 12 2 2 6.49 2 12s4.49 10 10 10m0-18c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8"></path>
                   </svg>
                    ${pData.per_min} DA / min
                `;
            }
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'students' }, (payload) => {
        const currentStudentId = sessionStorage.getItem('currentStudentId');
        if (payload.old && payload.old.student_id === currentStudentId) {
            showToast('⚠️ Your account has been deleted by the administrator.\nYou will be logged out shortly.', 'warning');
            sessionStorage.clear(); 
            setTimeout(() => { window.location.href = '../index.html'; }, 3000); 
        }
      })
      .subscribe();
}

//Section visibility 
function hideAllSections() {
    document.getElementById("Rent_Map").style.display = "none";
    document.getElementById("history").style.display = "none";
    document.getElementById("payment").style.display = "none";
}

function showRentAndMap() {
    hideAllSections();
    document.getElementById("Rent_Map").style.display = "flex";
    hideSidebar();
    setTimeout(() => {
        if (window.mainMap) { window.mainMap.invalidateSize(); window.renderMainMapMarkers(); }
    }, 100);
}

function showHistory() {
    hideAllSections();
    document.getElementById("history").style.display = "block";
    hideSidebar();
}

function showPayment() {
    hideAllSections();
    document.getElementById("payment").style.display = "block";
    hideSidebar();
}

//Sidebar
function showSidebar() { document.getElementById("sidebar").style.display = "flex"; }
function hideSidebar() { document.getElementById("sidebar").style.display = "none"; }

//Timer
let timerInterval = null;
let totalSeconds = 0;
let rideStartTime = null;

function showTimer() {
    document.getElementById("container-timer").style.display = "flex";
    document.getElementById("station").style.display = "none";
    totalSeconds = 0;
    rideStartTime = new Date();
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        totalSeconds++;
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    const days    = Math.floor(totalSeconds / 86400);
    const hours   = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs    = totalSeconds % 60;
    document.getElementById("timer").textContent =
        pad(days) + ":" + pad(hours) + ":" + pad(minutes) + ":" + pad(secs);
}

function pad(n) { return String(n).padStart(2, "0"); }

function selectStation() {
    clearInterval(timerInterval);
    timerInterval = null;
    document.getElementById("overlay").style.display = "flex";
}

//التحقق من الدفع بروتوتايب البطاقة الذهبية
function verifyPaymentIfNeeded(callback) {
    if (sessionStorage.getItem('paymentVerified') === 'true') {
        callback();
        return;
    }
    const overlay = document.getElementById('payment-card-overlay');
    if(!overlay) return callback();
    
    overlay.style.display = 'flex';
    const form = document.getElementById('gold-card-form');
    
    form.onsubmit = function(e) {
        e.preventDefault();
        showToast('✅ Payment Verified Successfully! (Prototype)', 'success');
        sessionStorage.setItem('paymentVerified', 'true');
        overlay.style.display = 'none';
        form.reset();
        callback();
    };
}

//بدء الرحلة واستئجار مركبة 
async function startRide(stationName, vehicleType) {
    verifyPaymentIfNeeded(async () => {
        const { data: availableVehicles, error } = await db
            .from('vehicles')
            .select('*')
            .eq('place', stationName)
            .eq('type', vehicleType)
            .eq('status', 'Available')
            .limit(1);

        if (error || !availableVehicles || availableVehicles.length === 0) {
            showToast(`No ${vehicleType}s available at ${stationName} right now.`, 'warning');
            return;
        }

        const rentedVehicle = availableVehicles[0];

        const { error: updateError } = await db
            .from('vehicles')
            .update({ status: 'Rented' })
            .eq('id', rentedVehicle.id);

        if (updateError) {
            showToast('Error renting vehicle. Please try again.', 'error');
            return;
        }

        sessionStorage.setItem('currentRentedVehicleId', rentedVehicle.id);
        
        const currentStudentId = sessionStorage.getItem('currentStudentId');
        await db.from('students').update({ rented_vehicle_id: rentedVehicle.id }).eq('student_id', currentStudentId);

        let { data: vData } = await db.from('vehicles').select('*');
        vehicles = vData || [];
        renderStudentStations();

        showTimer();
    });
}

//إنهاء الرحلة وإرجاع المركبة 
async function stationSelected() {
    const selected = document.querySelector('#select input[type="radio"]:checked');
    if (!selected) {
        showToast("Please select a station first.", 'warning');
        return;
    }

    const rideEnd = new Date();
    const minutesRidden = Math.ceil(totalSeconds / 60);
    const stationName = selected.value;

    const { data: latestPrice } = await db.from('prices').select('per_min').eq('id', 1).single();
    let finalRate = currentRatePerMinute;
    if (latestPrice) {
        finalRate = parseFloat(latestPrice.per_min);
        currentRatePerMinute = finalRate;
    }

    let costValue = 0;
    let costString = "";
    if (isSubscribed) {
        costString = "Monthly Subscription";
    } else {
        costValue = minutesRidden * finalRate;
        costString = costValue + " DA";
    }

    document.getElementById("overlay").style.display = "none";
    document.getElementById("container-timer").style.display = "none";
    document.getElementById("station").style.display = "block";

    const rideData = {
        student_name: currentUser,
        student_id: sessionStorage.getItem('currentStudentId') || 'N/A', 
        start_time: rideStartTime.toLocaleTimeString("fr-DZ"),
        end_time: rideEnd.toLocaleTimeString("fr-DZ"),
        duration: minutesRidden + " min",
        station: stationName,
        cost: costString,
        date: new Date().toISOString().split('T')[0]
    };

    await saveRide(rideData);

    const rentedVehicleId = sessionStorage.getItem('currentRentedVehicleId');
    if (rentedVehicleId) {
        await db.from('vehicles').update({
            status: 'Available',       
            place: stationName         
        }).eq('id', rentedVehicleId);

        const currentStudentId = sessionStorage.getItem('currentStudentId');
        await db.from('students').update({ rented_vehicle_id: null }).eq('student_id', currentStudentId);
        sessionStorage.removeItem('currentRentedVehicleId');
        
        let { data: vData } = await db.from('vehicles').select('*');
        vehicles = vData || [];
        renderStudentStations();
    }
    //  عرض رسالة منتصف الشاشة لانتهاء الرحلة
    showCenterMessage(
        "🛑 Ride Ended!", 
        `<div style="margin-top: 15px; font-size: 1.2rem; color: #334155; text-align: left; padding: 0 10px;">
            <p style="margin: 8px 0;"><strong>⏱️ Duration:</strong> ${minutesRidden} min</p>
            <p style="margin: 8px 0;"><strong>💰 Cost:</strong> ${costString}</p>
            <p style="margin: 8px 0;"><strong>📍 Station:</strong> ${stationName}</p>
        </div>`,
        'success'
    );
    totalSeconds = 0;
    updateTimerDisplay();
}

// History 
async function saveRide(ride) {
    const { data, error } = await db.from('history').insert([ride]).select();
    if (error) {
        console.error("Error saving ride:", error);
        showToast("Error saving ride to database!", 'error');
        return;
    }
    await renderHistory();
}

async function renderHistory() {
    const tbody = document.getElementById("tableBodyS");
    if (!tbody) return;
    tbody.innerHTML = "";

    const { data: rides, error } = await db
        .from('history')
        .select('*')
        .eq('student_name', currentUser)
        .order('id', { ascending: false });

    if (error || !rides || rides.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">No rides yet.</td></tr>';
        return;
    }

            rides.forEach(ride => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td data-label="Start Time">${ride.start_time}</td>
                <td data-label="End Time">${ride.end_time}</td>
                <td data-label="Duration">${ride.duration}</td>
                <td data-label="Station">${ride.station}</td>
                <td data-label="Cost">${ride.cost}</td>
            `;
            tbody.appendChild(tr);
        });
}

//  عرض المحطات والمركبات ديناميكياً 
function renderStudentStations() {
    const selectDiv = document.getElementById('select');
    if (selectDiv) {
        selectDiv.innerHTML = ''; 
        if (stations.length === 0) {
            selectDiv.innerHTML = '<p style="color:#888;">No stations available.</p>';
        } else {
            stations.forEach(station => {
                const div = document.createElement('div');
                const radioId = 'station_' + station.id;
                div.innerHTML = `
                    <input id="${radioId}" type="radio" name="selectedStation" value="${station.name}" style="vertical-align: middle;">
                    <label for="${radioId}">${station.name}</label>
                `;
                selectDiv.appendChild(div);
            });
        }
    }

    const univContainer = document.getElementById('univ');
    if (univContainer) {
        univContainer.innerHTML = ''; 
        if (stations.length === 0) {
            univContainer.innerHTML = '<p style="color:#888;">No stations available at the moment.</p>';
        } else {
            stations.forEach(station => {
                let availBikes = 0;
                let availScooters = 0;
                vehicles.forEach(v => {
                    if (v.place === station.name && v.status === 'Available') {
                        if(v.type === 'Bike') availBikes++;
                        if(v.type === 'Scooter') availScooters++;
                    }
                });

                const stationDiv = document.createElement('div');
                stationDiv.style.marginBottom = '15px';
                stationDiv.style.padding = '10px';
                stationDiv.style.borderBottom = '1px solid #eee';

                stationDiv.innerHTML = `
                    <span style="font-weight:bold; display:block; margin-bottom:5px;">${station.name}</span>
                    <span style="color:#22c55e; font-size:0.9em;">🚲 Bikes: ${availBikes} | 🛴 Scooters: ${availScooters}</span>
                    <p style="font-size:0.85em; color:#555; margin-top:5px;">
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style="vertical-align: middle;">
                           <path d="M6 8.44c-.02 5.1 5.17 9.18 5.39 9.35.18.14.4.21.61.21s.43-.07.61-.21c.22-.17 5.41-4.25 5.39-9.35C18 4.89 15.31 2 12 2S6 4.89 6 8.44m10 0c.01 3.19-2.74 6.08-4 7.24-1.26-1.15-4.01-4.04-4-7.24C8 5.99 9.79 4 12 4s4 1.99 4 4.44"></path><path d="M12 6a2 2 0 1 0 0 4 2 2 0 1 0 0-4m6.02 8.73c-.4.64-.84 1.23-1.27 1.76C18.88 16.97 20 17.68 20 18c0 .51-2.75 2-8 2s-8-1.49-8-2c0-.32 1.12-1.03 3.25-1.51-.43-.53-.86-1.12-1.27-1.76C3.66 15.37 2 16.44 2 18c0 2.75 5.18 4 10 4s10-1.25 10-4c0-1.56-1.67-2.63-3.98-3.27"></path>
                       </svg> : ${station.address || 'No address'}
                    </p>
                    <div style="display:flex; gap:10px; margin-top:10px;">
                        <button onclick="startRide('${station.name}', 'Bike')" style="cursor:pointer; padding:5px 10px; background:#22c55e; color:white; border:none; border-radius:5px;">🚲 Rent Bike</button>
                        <button onclick="startRide('${station.name}', 'Scooter')" style="cursor:pointer; padding:5px 10px; background:#3b82f6; color:white; border:none; border-radius:5px;">🛴 Rent Scooter</button>
                    </div>
                `;
                univContainer.appendChild(stationDiv);
            });
        }
    }
}

// عرض العروض الديناميكية
function renderStudentOffers() {
    const container = document.getElementById('offers-container-student');
    if (!container) return;
    container.innerHTML = '';

    if (offers.length === 0) {
        container.innerHTML = '<p style="color:#888; width:100%; text-align:center;">No monthly offers available right now.</p>';
        return;
    }

    offers.forEach(offer => {
        const card = document.createElement('div');
        card.style.cssText = 'min-width: 280px; flex: 1; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.05); position: relative; text-align: center;';
        
        let buttonHTML = '';
        if (isSubscribed) {
            buttonHTML = `<button disabled style="width: 100%; padding: 10px; background: #22c55e; color: white; border: none; border-radius: 5px; font-weight: bold; cursor: not-allowed;">✅ Active Subscription</button>`;
        } else {
            buttonHTML = `<button onclick="subscribeToOffer(${offer.id}, ${offer.price})" style="width: 100%; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 5px; font-weight: bold; cursor: pointer;">Subscribe</button>`;
        }

        card.innerHTML = `
            <span style="position: absolute; top: -10px; right: 10px; background: #f59e0b; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">OFFER</span>
            <h3 style="color:#1e293b; margin-top:10px;">${offer.title}</h3>
            <p style="font-size: 2.2rem; font-weight: bold; color: #22c55e; margin: 15px 0;">${offer.price} DA <span style="font-size: 1rem; color: #64748b; font-weight: normal;">/ month</span></p>
            <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px; min-height: 40px;">${offer.description || 'Unlimited rides'}</p>
            ${buttonHTML}
        `;
        container.appendChild(card);
    });
}

// الاشتراك في عرض محدد 
async function subscribeToOffer(offerId, offerPrice) {
    verifyPaymentIfNeeded(async () => {
        const confirmed = confirm("Subscribe to the monthly plan for " + offerPrice + " DA?");
        if (confirmed) {
            const studentId = sessionStorage.getItem('currentStudentId');
            await db.from('students').update({ is_subscribed: true }).eq('student_id', studentId);
            
            const today = new Date().toISOString().split('T')[0]; 
            await db.from('payments').insert([{ student_id: studentId, amount: offerPrice, date: today }]);
            
            isSubscribed = true;
            sessionStorage.setItem('isSubscribed', 'true');
            
            showToast("✅ Subscription activated! Enjoy unlimited rides.", 'success');
            
            const btnParMin = document.getElementById("btn-par-min");
            if(btnParMin) {
                btnParMin.textContent = "Switch to Pay/min";
                btnParMin.disabled = false;
                btnParMin.onclick = function() {
                    showToast("⚠️ Your monthly subscription is currently active!\n\nYou cannot switch to pay-per-minute until it expires.", 'warning');
                };
            }

            const timerRateEl = document.getElementById("timer-rate-text");
            if (timerRateEl) {
                timerRateEl.innerHTML = `♾️ Monthly Subscription Active`;
                timerRateEl.style.color = "#22c55e";
            }

            renderStudentOffers(); 
        }
    });
}


//  Toast Message System 
function showToast(msg, type = 'success') {
    var toast = document.getElementById('toast-msg');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-msg';
        toast.style.cssText = 'position:fixed;bottom:30px;right:30px;padding:15px 25px;border-radius:8px;fontWeight:600;zIndex:9999;boxShadow:0 4px 12px rgba(0,0,0,.2);transition:opacity .4s, transform .4s;transform:translateY(20px);opacity:0;font-size:1rem;max-width:400px;white-space:pre-wrap;';
        document.body.appendChild(toast);
    }

    if (type === 'success') { toast.style.background = '#22c55e'; toast.style.color = '#ffffff'; }
    else if (type === 'warning') { toast.style.background = '#f59e0b'; toast.style.color = '#1e293b'; }
    else if (type === 'error') { toast.style.background = '#ef4444'; toast.style.color = '#ffffff'; }

    toast.textContent = msg;
    setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; }, 10);
    if (toast._timeout) clearTimeout(toast._timeout);
    toast._timeout = setTimeout(function() { toast.style.opacity = '0'; toast.style.transform = 'translateY(20px)'; }, 3000);
}


//رسائل منتصف الشاشة - للرحلات
function showCenterMessage(title, bodyHtml, type = 'success') {
    let modal = document.getElementById('center-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'center-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:center;opacity:0;transition:opacity 0.3s ease;';
        document.body.appendChild(modal);
    }

    let box = document.getElementById('center-modal-box');
    if (!box) {
        box = document.createElement('div');
        box.id = 'center-modal-box';
        box.style.cssText = 'background:white;padding:30px 40px;border-radius:15px;box-shadow:0 10px 25px rgba(0,0,0,0.3);text-align:center;transform:scale(0.8);transition:transform 0.3s ease;font-family:Inter,sans-serif;max-width:400px;width:90%;';
        modal.appendChild(box);
    }

    // تحديد لون الحد العلوي بناءً على نوع الرسالة
    if (type === 'success') box.style.borderTop = '6px solid #22c55e';
    else if (type === 'warning') box.style.borderTop = '6px solid #f59e0b';
    else if (type === 'error') box.style.borderTop = '6px solid #ef4444';

    box.innerHTML = `
        <h2 style="margin:0; color:#1e293b; font-size:1.6rem;">${title}</h2>
        ${bodyHtml}
    `;

    // إظهار النافذة
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.opacity = '1';
        box.style.transform = 'scale(1)';
    }, 10);

    // إخفاء تلقائي بعد 4 ثواني
    if (modal._timeout) clearTimeout(modal._timeout);
    modal._timeout = setTimeout(() => {
        modal.style.opacity = '0';
        box.style.transform = 'scale(0.8)';
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }, 4000);
}


//عند تحميل الصفحة بالكامل 
document.addEventListener("DOMContentLoaded", async () => {
    showRentAndMap();

    const thead = document.querySelector("#student-table thead tr");
    if (thead) {
        thead.innerHTML = `
            <th>Start Time</th>
            <th>End Time</th>
            <th>Duration</th>
            <th>Station</th>
            <th>Cost</th>
        `;
    }

    const { data: priceData } = await db.from('prices').select('*').eq('id', 1).single();
    if (priceData) {
        currentRatePerMinute = parseFloat(priceData.per_min);
        
        const daMinEl = document.getElementById("DA-min");
        if (daMinEl) daMinEl.textContent = priceData.per_min + " DA";
        
        const daMonthEl = document.getElementById("DA-month");
        if (daMonthEl) daMonthEl.textContent = priceData.monthly + " DA";

        const timerRateEl = document.getElementById("timer-rate-text");
        if (timerRateEl) {
            if (isSubscribed) {
                timerRateEl.innerHTML = `♾️ Monthly Subscription Active`;
                timerRateEl.style.color = "#22c55e";
            } else {
                timerRateEl.innerHTML = `
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style="vertical-align: middle;">
                        <path d="M11 11h2v6h-2zm0-4h2v2h-2z"></path><path d="M12 22c5.51 0 10-4.49 10-10S17.51 2 12 2 2 6.49 2 12s4.49 10 10 10m0-18c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8"></path>
                   </svg>
                    ${priceData.per_min} DA / min
                `;
                timerRateEl.style.color = "";
            }
        }
    }

    let { data: stData } = await db.from('stations').select('*');
    stations = stData || [];
    
    let { data: vData } = await db.from('vehicles').select('*');
    vehicles = vData || [];

    let { data: oData } = await db.from('offers').select('*');
    offers = oData || [];

    setupStudentRealtimeUpdates();
    renderStudentStations();
    renderStudentOffers();
    await renderHistory();

    const btnParMin = document.getElementById("btn-par-min");
    if (btnParMin) {
        if (isSubscribed) {
            btnParMin.textContent = "Switch to Pay/min";
            btnParMin.disabled = false;
            btnParMin.style.cursor = "pointer";
            btnParMin.onclick = function() {
                showToast("⚠️ Your monthly subscription is currently active!\n\nYou cannot switch to pay-per-minute until it expires.", 'warning');
            };
        } else {
            btnParMin.textContent = "Currently active";
            btnParMin.disabled = true;
        }
    }

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
