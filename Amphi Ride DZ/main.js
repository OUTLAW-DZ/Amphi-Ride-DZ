let logins = document.getElementById('logins');
let logina = document.getElementById('logina');

function showStudentForm(){
    logins.style.display = 'flex';
    logina.style.display = 'none';
}
function showAdminForm(){
    logins.style.display = 'none';
    logina.style.display = 'flex';
}

// ============================================================
//  Toast Message System (لصفحة تسجيل الدخول)
// ============================================================
function showToast(msg, type = 'success') {
    var toast = document.getElementById('toast-msg');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-msg';
        toast.style.cssText = 'position:fixed;bottom:30px;right:30px;padding:15px 25px;border-radius:8px;fontWeight:600;zIndex:9999;boxShadow:0 4px 12px rgba(0,0,0,.2);transition:opacity .4s, transform .4s;transform:translateY(20px);opacity:0;font-size:1rem;max-width:400px;white-space:pre-wrap;';
        document.body.appendChild(toast);
    }

    if (type === 'success') {
        toast.style.background = '#22c55e'; 
        toast.style.color = '#ffffff';
    } else if (type === 'warning') {
        toast.style.background = '#f59e0b'; 
        toast.style.color = '#1e293b'; 
    } else if (type === 'error') {
        toast.style.background = '#ef4444'; 
        toast.style.color = '#ffffff';
    }

    toast.textContent = msg;
    
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);

    if (toast._timeout) clearTimeout(toast._timeout);

    toast._timeout = setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
    }, 3000);
}

// ============================================================
//  دمج Supabase في تسجيل الدخول
// ============================================================

// 1. تسجيل دخول الطالب
const studentForm = document.getElementById('student-login-form');
if (studentForm) {
    studentForm.addEventListener('submit', async function(e) {
        e.preventDefault(); 

        const bacMatricule = studentForm.elements['BACyearMatricule'].value;
        const password = studentForm.elements['password'].value;

        try {
            const { data, error } = await db
                .from('students')
                .select('*')
                .eq('student_id', bacMatricule) 
                .eq('password', password)       
                .single();                      

            if (error || !data) {
                showToast('Invalid Student ID or Password!', 'error');
            } else {
                // 🔴 يجب حفظ الجلسة BEFORE التحويل
                sessionStorage.setItem('currentStudentName', data.name);
                sessionStorage.setItem('currentStudentId', data.student_id);
                sessionStorage.setItem('isSubscribed', data.is_subscribed || false); 

                showToast('Welcome ' + data.name + '!', 'success');
                
                // تأخير بسيط ليتمكن المستخدم من رؤية رسالة الترحيب
                setTimeout(() => {
                    window.location.href = 'student/student.html';
                }, 1500); 
            }
        } catch (err) {
            showToast('An error occurred while connecting to the database.', 'error');
            console.error(err);
        }
    });
}

// 2. تسجيل دخول المشرف
const adminForm = document.getElementById('admin-login-form');
if (adminForm) {
    adminForm.addEventListener('submit', async function(e) {
        e.preventDefault(); 

        const email = adminForm.elements['name'].value; 
        const codeValidation = adminForm.elements['CodeValidation'].value;
        const password = adminForm.elements['password'].value;

        try {
            const { data, error } = await db
                .from('admins')
                .select('*')
                .eq('email', email)                  
                .eq('code_validation', codeValidation) 
                .eq('password', password)              
                .single();

            if (error || !data) {
                showToast('Invalid Admin credentials!', 'error');
            } else {
                showToast('Welcome Admin!', 'success');
                
                // تأخير بسيط ليتمكن المستخدم من رؤية رسالة الترحيب
                setTimeout(() => {
                    window.location.href = 'admin/admin.html';
                }, 1500);
            }
        } catch (err) {
            showToast('An error occurred while connecting to the database.', 'error');
            console.error(err);
        }
    });
}