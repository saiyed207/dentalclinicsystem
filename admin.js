import { MongoClient } from 'mongodb';
import crypto from 'crypto';

// --- DATABASE CONNECTION ---
let cachedClient = null;
let cachedDb = null;
async function connectToDatabase() {
  if (cachedClient && cachedDb) return { client: cachedClient, db: cachedDb };
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || 'smilenest');
  
  try { 
    await db.collection('adminSessions').createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 }); 
  } catch(e) {}
  
  cachedClient = client; 
  cachedDb = db;
  return { client, db };
}

// --- UTILS ---
const parseBody = (req) => new Promise((resolve) => {
  if (req.body) return resolve(typeof req.body === 'string' ? JSON.parse(req.body) : req.body);
  let body = '';
  req.on('data', chunk => body += chunk.toString());
  req.on('end', () => resolve(body ? JSON.parse(body) : {}));
});
const sendJson = (res, status, data) => res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(data));
const parseCookies = (req) => {
  const list = req.headers.cookie;
  if (!list) return {};
  return list.split(';').reduce((acc, cookie) => {
    const parts = cookie.split('=');
    acc[parts.shift().trim()] = decodeURI(parts.join('='));
    return acc;
  }, {});
};
const getSession = async (req, db) => {
  const token = parseCookies(req)['admin_session'];
  if (!token) return null;
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return await db.collection('adminSessions').findOne({ tokenHash: hash });
};

// --- ADMIN HTML/CSS/JS TEMPLATE ---
const adminHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SmileNest Admin - Clinic Operations</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  :root { 
    --bg-page: #F4F2FC;
    --lavender: #7C5CFC; 
    --lavender-soft: #EDE8FF; 
    --dark: #18142E; 
    --text-body: #3F3A59;
    --border-clay: rgba(124, 92, 252, 0.22);
  }
  body { 
    font-family: 'Plus Jakarta Sans', sans-serif; 
    background-color: var(--bg-page); 
    color: var(--dark); 
    min-height: 100vh;
    margin: 0;
  }
  .clay { 
    background: #FFFFFF; 
    border-radius: 1.75rem; 
    border: 2px solid var(--border-clay);
    box-shadow: 10px 14px 28px rgba(100, 70, 210, 0.12), -6px -6px 20px rgba(255, 255, 255, 0.95);
  }
  .clay-btn { 
    background: linear-gradient(135deg, #8B6BF6 0%, #6E46E5 100%);
    color: #FFFFFF; 
    border-radius: 9999px; 
    padding: 0.65rem 1.5rem; 
    font-weight: 700; 
    border: 2px solid rgba(255, 255, 255, 0.4);
    box-shadow: 6px 8px 16px rgba(110, 70, 229, 0.35);
    transition: all 0.2s; 
  }
  .clay-btn:hover { transform: scale(1.02); }
  .clay-input { 
    background: #FFFFFF; 
    border-radius: 1rem; 
    border: 2px solid rgba(124, 92, 252, 0.25); 
    padding: 0.85rem 1.25rem; 
    width: 100%; 
    outline: none; 
    color: var(--dark);
    font-weight: 600;
  }
  .clay-input:focus { border-color: var(--lavender); }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 1rem; text-align: left; font-size: 0.8rem; text-transform: uppercase; color: #64748B; border-bottom: 2px solid #E2E8F0; }
  td { padding: 1.1rem 1rem; text-align: left; border-bottom: 1px solid #F1F5F9; font-size: 0.9rem; }
  .badge { padding: 0.3rem 0.85rem; border-radius: 999px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; }
  .badge.pending { background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; }
  .badge.confirmed { background: #DCFCE7; color: #166534; border: 1px solid #86EFAC; }
  .badge.completed { background: #E0F2FE; color: #075985; border: 1px solid #7DD3FC; }
  .badge.cancelled { background: #FFE4E6; color: #9F1239; border: 1px solid #FDA4AF; }
</style>
</head>
<body class="antialiased">

  <!-- LOGIN VIEW: Perfectly centered horizontally & vertically -->
  <div id="login-view" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#F4F2FC]">
    <div class="clay p-8 md:p-10 max-w-md w-full bg-white text-center">
      <div class="w-16 h-16 bg-[var(--lavender-soft)] text-[var(--lavender)] border border-[var(--border-clay)] rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
        <i data-lucide="shield-check" class="w-8 h-8"></i>
      </div>
      <h2 class="text-3xl font-extrabold text-[var(--dark)] mb-2">Clinic Portal</h2>
      <p class="text-sm text-[var(--text-body)] mb-6 font-medium">Please sign in with administrator credentials.</p>
      
      <form id="login-form" class="space-y-4 text-left">
        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Username</label>
          <input type="text" id="username" class="clay-input" placeholder="e.g. clinicadmin" required>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Password</label>
          <input type="password" id="password" class="clay-input" placeholder="••••••••••••" required>
        </div>
        <button type="submit" class="clay-btn w-full py-3.5 mt-2 text-base">Authorize Access</button>
        <div id="login-err" class="text-rose-600 font-bold text-sm text-center hidden p-2 bg-rose-50 rounded-xl"></div>
      </form>
    </div>
  </div>

  <!-- DASHBOARD WORKSPACE -->
  <div id="app-view" class="w-full flex h-screen overflow-hidden hidden">
    <!-- Sidebar -->
    <aside class="w-64 clay m-4 flex flex-col p-6 hidden md:flex h-[calc(100vh-2rem)] bg-white">
      <div class="flex items-center gap-2.5 font-extrabold text-2xl text-[var(--dark)] mb-8">
        <div class="bg-[var(--lavender)] text-white p-2 rounded-xl flex items-center justify-center">
          <i data-lucide="smile" class="w-5 h-5"></i>
        </div>
        Smile<span class="text-[var(--lavender)]">Nest</span>
      </div>
      
      <nav class="space-y-2 flex-1 font-bold text-sm">
        <button onclick="nav('dash')" class="w-full text-left px-4 py-3 rounded-2xl hover:bg-[var(--lavender-soft)] flex gap-3 text-[var(--dark)] items-center transition">
          <i data-lucide="layout-dashboard" class="w-5 h-5 text-[var(--lavender)]"></i> Dashboard
        </button>
        <button onclick="nav('apts')" class="w-full text-left px-4 py-3 rounded-2xl hover:bg-[var(--lavender-soft)] flex gap-3 text-[var(--dark)] items-center transition">
          <i data-lucide="calendar" class="w-5 h-5 text-[var(--lavender)]"></i> Appointments
        </button>
        <button onclick="nav('msgs')" class="w-full text-left px-4 py-3 rounded-2xl hover:bg-[var(--lavender-soft)] flex gap-3 text-[var(--dark)] items-center transition">
          <i data-lucide="mail" class="w-5 h-5 text-[var(--lavender)]"></i> Messages
        </button>
      </nav>
      
      <button id="logout-btn" class="text-rose-600 font-bold flex gap-3 px-4 py-2 hover:bg-rose-50 rounded-xl transition items-center text-sm">
        <i data-lucide="log-out" class="w-5 h-5"></i> Log Out
      </button>
    </aside>

    <!-- Main Views -->
    <main class="flex-1 p-6 md:p-8 overflow-y-auto">
      <div id="v-dash" class="inner-view active">
        <h2 class="text-3xl font-extrabold text-[var(--dark)] mb-6">Clinic Overview</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" id="stats-grid">Loading metrics...</div>
      </div>

      <div id="v-apts" class="inner-view hidden">
        <h2 class="text-3xl font-extrabold text-[var(--dark)] mb-6">Patient Appointments</h2>
        <div class="clay p-6 bg-white overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Schedule</th>
                <th>Patient Details</th>
                <th>Service Booked</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="apts-tbody"></tbody>
          </table>
        </div>
      </div>

      <div id="v-msgs" class="inner-view hidden">
        <h2 class="text-3xl font-extrabold text-[var(--dark)] mb-6">Inquiries & Messages</h2>
        <div class="clay p-6 bg-white overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Received</th>
                <th>Patient Name</th>
                <th>Email Contact</th>
                <th>Message Content</th>
              </tr>
            </thead>
            <tbody id="msgs-tbody"></tbody>
          </table>
        </div>
      </div>
    </main>
  </div>

<script>
  lucide.createIcons();

  const apiFetch = async (url, options = {}) => {
    const res = await fetch(url, options);
    if (res.status === 401) { 
      showLogin(); 
      throw new Error("Unauthorized"); 
    }
    return res.json();
  };

  const showLogin = () => {
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('app-view').classList.add('hidden');
  };

  const showApp = () => {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('app-view').classList.remove('hidden');
    loadDash();
  };

  // Check Existing Session
  fetch('/api/admin/session').then(r => r.json()).then(d => {
    if (d.success) showApp(); 
    else showLogin();
  }).catch(showLogin);

  // Login handler
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const err = document.getElementById('login-err');
    btn.textContent = "Verifying..."; 
    btn.disabled = true;
    err.classList.add('hidden');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          u: document.getElementById('username').value, 
          p: document.getElementById('password').value 
        })
      });
      const data = await res.json();
      if (data.success) {
        showApp();
      } else {
        err.textContent = data.error?.message || "Invalid credentials";
        err.classList.remove('hidden');
      }
    } catch(e) {
      err.textContent = "Connection error.";
      err.classList.remove('hidden');
    } finally {
      btn.textContent = "Authorize Access"; 
      btn.disabled = false;
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' }); 
    location.reload();
  });

  window.nav = (v) => {
    document.querySelectorAll('.inner-view').forEach(el => el.classList.add('hidden'));
    document.getElementById('v-' + v).classList.remove('hidden');
    if (v === 'dash') loadDash(); 
    if (v === 'apts') loadApts(); 
    if (v === 'msgs') loadMsgs();
  };

  const loadDash = async () => {
    const data = await apiFetch('/api/admin/dashboard');
    if (data.success) {
      document.getElementById('stats-grid').innerHTML = \`
        <div class="clay p-6 bg-white">
          <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pending Requests</div>
          <div class="text-4xl font-extrabold text-[var(--lavender)]">\${data.data.pending}</div>
        </div>
        <div class="clay p-6 bg-white">
          <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Confirmed Today</div>
          <div class="text-4xl font-extrabold text-emerald-600">\${data.data.today}</div>
        </div>
        <div class="clay p-6 bg-white">
          <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Completed Visits</div>
          <div class="text-4xl font-extrabold text-sky-600">\${data.data.completed}</div>
        </div>
        <div class="clay p-6 bg-white">
          <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Unread Messages</div>
          <div class="text-4xl font-extrabold text-amber-600">\${data.data.msgs}</div>
        </div>
      \`;
    }
  };

  const loadApts = async () => {
    const data = await apiFetch('/api/admin/appointments');
    const tb = document.getElementById('apts-tbody'); 
    tb.innerHTML = '';
    if (!data.data || data.data.length === 0) {
      tb.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-500">No appointments recorded yet.</td></tr>';
      return;
    }
    data.data.forEach(a => {
      tb.innerHTML += \`<tr>
        <td class="font-bold text-[var(--dark)]">\${a.appointmentDate} <br> <span class="text-xs text-[var(--lavender)]">\${a.appointmentTime}</span></td>
        <td><strong class="text-[var(--dark)]">\${a.patientName}</strong> <br> <a href="mailto:\${a.patientEmail}" class="text-xs text-indigo-600 hover:underline">\${a.patientEmail}</a> • <span class="text-xs text-gray-500">\${a.patientPhone}</span></td>
        <td class="font-medium">\${a.serviceSnapshot?.name || 'General'}</td>
        <td class="font-mono text-xs font-bold text-gray-600">\${a.bookingReference}</td>
        <td><span class="badge \${a.status}">\${a.status}</span></td>
        <td>
          <select onchange="updateStatus('\${a._id}', this.value)" class="clay-input py-1.5 px-2 text-xs font-bold cursor-pointer">
            <option value="">Update...</option>
            <option value="confirmed">Confirm</option>
            <option value="completed">Complete</option>
            <option value="cancelled">Cancel</option>
          </select>
        </td>
      </tr>\`;
    });
  };

  const loadMsgs = async () => {
    const data = await apiFetch('/api/admin/messages');
    const tb = document.getElementById('msgs-tbody'); 
    tb.innerHTML = '';
    if (!data.data || data.data.length === 0) {
      tb.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-gray-500">No contact messages received.</td></tr>';
      return;
    }
    data.data.forEach(m => {
      tb.innerHTML += \`<tr>
        <td class="text-xs text-gray-500 whitespace-nowrap">\${new Date(m.createdAt).toLocaleDateString()}</td>
        <td class="font-bold text-[var(--dark)]">\${m.name}</td>
        <td><a href="mailto:\${m.email}" class="text-indigo-600 text-xs font-semibold hover:underline">\${m.email}</a></td>
        <td class="text-sm text-[var(--text-body)] max-w-sm font-normal">\${m.message}</td>
      </tr>\`;
    });
  };

  window.updateStatus = async (id, status) => {
    if (!status || !confirm('Update this appointment to ' + status + '?')) return loadApts();
    await apiFetch('/api/admin/appointments/' + id, { 
      method: 'PATCH', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ status }) 
    });
    loadApts(); 
    loadDash();
  };
</script>
</body>
</html>`;

// --- MAIN HANDLER ---
export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (path.startsWith('/api/admin/')) {
    try {
      const { db } = await connectToDatabase();
      
      // Admin Authentication Check
      if (path === '/api/admin/login' && req.method === 'POST') {
        const body = await parseBody(req);
        const { u, p } = body;
        
        const validU = process.env.ADMIN_USERNAME;
        const validP = process.env.ADMIN_PASSWORD;
        if (!validU || !validP) return sendJson(res, 500, { success: false, error: { message: "Admin credentials missing in Vercel environment variables." } });

        const hashInput = crypto.createHash('sha256').update(u + ':' + p).digest('hex');
        const hashEnv = crypto.createHash('sha256').update(validU + ':' + validP).digest('hex');
        
        if (hashInput === hashEnv) {
          const token = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
          await db.collection('adminSessions').insertOne({ tokenHash, createdAt: new Date() });
          
          res.setHeader('Set-Cookie', `admin_session=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax; ${process.env.NODE_ENV === 'production' ? 'Secure' : ''}`);
          return sendJson(res, 200, { success: true, data: {} });
        }
        return sendJson(res, 401, { success: false, error: { message: "Invalid username or password." } });
      }

      if (path === '/api/admin/logout' && req.method === 'POST') {
        const session = await getSession(req, db);
        if (session) await db.collection('adminSessions').deleteOne({ _id: session._id });
        res.setHeader('Set-Cookie', `admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
        return sendJson(res, 200, { success: true, data: {} });
      }

      // Session Verification
      const session = await getSession(req, db);
      if (!session) return sendJson(res, 401, { success: false, error: { message: "Unauthorized session." } });

      if (path === '/api/admin/session' && req.method === 'GET') {
        return sendJson(res, 200, { success: true, data: { authenticated: true } });
      }

      if (path === '/api/admin/dashboard' && req.method === 'GET') {
        const todayStr = new Date().toISOString().split('T')[0];
        const [pending, today, completed, msgs] = await Promise.all([
          db.collection('appointments').countDocuments({ status: 'pending' }),
          db.collection('appointments').countDocuments({ status: 'confirmed', appointmentDate: todayStr }),
          db.collection('appointments').countDocuments({ status: 'completed' }),
          db.collection('contactMessages').countDocuments({ read: false })
        ]);
        return sendJson(res, 200, { success: true, data: { pending, today, completed, msgs } });
      }

      if (path === '/api/admin/appointments' && req.method === 'GET') {
        const apts = await db.collection('appointments').find().sort({ appointmentDate: -1, appointmentTime: 1 }).limit(100).toArray();
        return sendJson(res, 200, { success: true, data: apts });
      }

      if (path.match(/^\/api\/admin\/appointments\/([a-f0-9]{24})$/) && req.method === 'PATCH') {
        const id = path.split('/').pop();
        const { ObjectId } = await import('mongodb');
        const body = await parseBody(req);
        if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(body.status)) {
          return sendJson(res, 400, { success: false, error: { message: "Invalid status value." } });
        }
        
        await db.collection('appointments').updateOne(
          { _id: new ObjectId(id) }, 
          { $set: { status: body.status, updatedAt: new Date() } }
        );
        return sendJson(res, 200, { success: true, data: {} });
      }

      if (path === '/api/admin/messages' && req.method === 'GET') {
        const msgs = await db.collection('contactMessages').find().sort({ createdAt: -1 }).limit(50).toArray();
        return sendJson(res, 200, { success: true, data: msgs });
      }

      return sendJson(res, 404, { success: false, error: { message: "API endpoint not found." } });
    } catch (err) {
      console.error(err);
      return sendJson(res, 500, { success: false, error: { message: "Internal server error." } });
    }
  }

  res.setHeader('Content-Type', 'text/html');
  res.send(adminHTML);
}
