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
  
  try { await db.collection('adminSessions').createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 }); } catch(e){}
  
  cachedClient = client; cachedDb = db;
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
<title>Admin - SmileNest</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
  :root { --lavender: #B8A5FF; --mint: #B8F2D0; --cream: #FFF9F0; --dark: #29263D; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: var(--cream); color: var(--dark); }
  .clay { background: #ffffff; border-radius: 1.5rem; box-shadow: 8px 8px 16px rgba(184, 165, 255, 0.15), -8px -8px 16px rgba(255, 255, 255, 0.8), inset 2px 2px 4px rgba(255, 255, 255, 0.5); }
  .clay-btn { background: var(--lavender); color: white; border-radius: 999px; padding: 0.5rem 1.5rem; font-weight: 600; box-shadow: 4px 4px 8px rgba(184, 165, 255, 0.4), -4px -4px 8px rgba(255, 255, 255, 0.9); transition: all 0.2s; }
  .clay-btn:hover { transform: scale(1.02); }
  .clay-input { background: var(--cream); border-radius: 1rem; padding: 0.75rem 1rem; width: 100%; outline: none; box-shadow: inset 4px 4px 8px rgba(184, 165, 255, 0.15), inset -4px -4px 8px rgba(255, 255, 255, 0.9); }
  .view { display: none; } .view.active { display: block; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #f0f0f0; }
  .badge { padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.8rem; font-weight: bold; }
  .badge.pending { background: #fff3cd; color: #856404; }
  .badge.confirmed { background: var(--mint); color: #155724; }
  .badge.completed { background: #d1ecf1; color: #0c5460; }
  .badge.cancelled { background: #f8d7da; color: #721c24; }
</style>
</head>
<body class="antialiased h-screen flex overflow-hidden">
  
  <!-- LOGIN VIEW -->
  <div id="login-view" class="view active w-full h-full flex items-center justify-center absolute z-50 bg-[var(--cream)]">
    <div class="clay p-10 max-w-sm w-full text-center">
      <div class="flex justify-center mb-4"><i data-lucide="shield-check" class="w-12 h-12 text-[var(--lavender)]"></i></div>
      <h2 class="text-2xl font-bold mb-6">Clinic Admin</h2>
      <form id="login-form" class="space-y-4">
        <input type="text" id="username" class="clay-input" placeholder="Username" required>
        <input type="password" id="password" class="clay-input" placeholder="Password" required>
        <button type="submit" class="clay-btn w-full py-3 mt-2">Login</button>
        <div id="login-err" class="text-red-500 text-sm hidden"></div>
      </form>
    </div>
  </div>

  <!-- DASHBOARD LAYOUT -->
  <div id="app-view" class="view w-full flex h-full hidden">
    <!-- Sidebar -->
    <aside class="w-64 clay m-4 flex flex-col p-6 hidden md:flex h-[calc(100vh-2rem)]">
      <h1 class="text-xl font-bold mb-8 flex items-center gap-2"><i data-lucide="smile" class="text-[var(--lavender)]"></i> SmileNest</h1>
      <nav class="space-y-2 flex-1">
        <button onclick="nav('dash')" class="w-full text-left px-4 py-3 rounded-xl hover:bg-[var(--cream)] font-medium flex gap-3"><i data-lucide="layout-dashboard"></i> Dashboard</button>
        <button onclick="nav('apts')" class="w-full text-left px-4 py-3 rounded-xl hover:bg-[var(--cream)] font-medium flex gap-3"><i data-lucide="calendar"></i> Appointments</button>
        <button onclick="nav('msgs')" class="w-full text-left px-4 py-3 rounded-xl hover:bg-[var(--cream)] font-medium flex gap-3"><i data-lucide="mail"></i> Messages</button>
      </nav>
      <button id="logout-btn" class="text-red-500 font-medium flex gap-3 px-4 py-2"><i data-lucide="log-out"></i> Logout</button>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 p-8 overflow-y-auto">
      <div id="v-dash" class="inner-view active">
        <h2 class="text-3xl font-bold mb-8">Overview</h2>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8" id="stats-grid">Loading...</div>
      </div>

      <div id="v-apts" class="inner-view hidden">
        <h2 class="text-3xl font-bold mb-8">Appointments</h2>
        <div class="clay p-6 overflow-x-auto">
          <table>
            <thead><tr><th>Date & Time</th><th>Patient</th><th>Service</th><th>Ref</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="apts-tbody"></tbody>
          </table>
        </div>
      </div>

      <div id="v-msgs" class="inner-view hidden">
        <h2 class="text-3xl font-bold mb-8">Contact Messages</h2>
        <div class="clay p-6 overflow-x-auto">
          <table>
            <thead><tr><th>Date</th><th>Name</th><th>Email</th><th>Message</th></tr></thead>
            <tbody id="msgs-tbody"></tbody>
          </table>
        </div>
      </div>
    </main>
  </div>

<script>
  lucide.createIcons();

  const apiFetch = async (url, options={}) => {
    const res = await fetch(url, options);
    if(res.status === 401) { showLogin(); throw new Error("Unauthorized"); }
    return res.json();
  };

  const showLogin = () => { document.getElementById('login-view').classList.add('active'); document.getElementById('app-view').classList.add('hidden'); };
  const showApp = () => { document.getElementById('login-view').classList.remove('active'); document.getElementById('app-view').classList.remove('hidden'); loadDash(); };

  // Check Session
  fetch('/api/admin/session').then(r=>r.json()).then(d => { if(d.success) showApp(); else showLogin(); }).catch(showLogin);

  document.getElementById('login-form').addEventListener('submit', async(e)=>{
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.textContent="Verifying...";
    const res = await fetch('/api/admin/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ u: document.getElementById('username').value, p: document.getElementById('password').value })
    });
    const data = await res.json();
    btn.textContent="Login";
    if(data.success) showApp();
    else { const err=document.getElementById('login-err'); err.textContent="Invalid credentials"; err.classList.remove('hidden'); }
  });

  document.getElementById('logout-btn').addEventListener('click', async()=>{
    await fetch('/api/admin/logout', {method:'POST'}); location.reload();
  });

  window.nav = (v) => {
    document.querySelectorAll('.inner-view').forEach(el=>el.classList.add('hidden'));
    document.getElementById('v-'+v).classList.remove('hidden');
    if(v==='dash') loadDash(); if(v==='apts') loadApts(); if(v==='msgs') loadMsgs();
  };

  const loadDash = async () => {
    const data = await apiFetch('/api/admin/dashboard');
    if(data.success) {
      document.getElementById('stats-grid').innerHTML = \`
        <div class="clay p-6"> <div class="text-gray-500 mb-2">Pending</div> <div class="text-3xl font-bold">\${data.data.pending}</div> </div>
        <div class="clay p-6"> <div class="text-gray-500 mb-2">Confirmed Today</div> <div class="text-3xl font-bold">\${data.data.today}</div> </div>
        <div class="clay p-6"> <div class="text-gray-500 mb-2">Total Completed</div> <div class="text-3xl font-bold">\${data.data.completed}</div> </div>
        <div class="clay p-6"> <div class="text-gray-500 mb-2">Unread Msgs</div> <div class="text-3xl font-bold">\${data.data.msgs}</div> </div>
      \`;
    }
  };

  const loadApts = async () => {
    const data = await apiFetch('/api/admin/appointments');
    const tb = document.getElementById('apts-tbody'); tb.innerHTML = '';
    data.data.forEach(a => {
      tb.innerHTML += \`<tr>
        <td>\${a.appointmentDate} <br> <span class="text-sm text-gray-500">\${a.appointmentTime}</span></td>
        <td>\${a.patientName} <br> <a href="mailto:\${a.patientEmail}" class="text-sm text-indigo-500">\${a.patientEmail}</a></td>
        <td>\${a.serviceSnapshot.name}</td>
        <td class="font-mono text-sm">\${a.bookingReference}</td>
        <td><span class="badge \${a.status}">\${a.status.toUpperCase()}</span></td>
        <td>
          <select onchange="updateStatus('\${a._id}', this.value)" class="clay-input py-1 text-sm">
            <option value="">Change...</option>
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
    const tb = document.getElementById('msgs-tbody'); tb.innerHTML = '';
    data.data.forEach(m => {
      tb.innerHTML += \`<tr>
        <td class="text-sm">\${new Date(m.createdAt).toLocaleDateString()}</td>
        <td class="font-bold">\${m.name}</td>
        <td><a href="mailto:\${m.email}" class="text-indigo-500">\${m.email}</a></td>
        <td class="max-w-xs truncate" title="\${m.message}">\${m.message}</td>
      </tr>\`;
    });
  };

  window.updateStatus = async (id, status) => {
    if(!status || !confirm('Update status to ' + status + '?')) return loadApts();
    await apiFetch('/api/admin/appointments/'+id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status}) });
    loadApts(); loadDash();
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
      
      // -- AUTHENTICATION & LOGIN --
      if (path === '/api/admin/login' && req.method === 'POST') {
        const body = await parseBody(req);
        const { u, p } = body;
        
        const validU = process.env.ADMIN_USERNAME;
        const validP = process.env.ADMIN_PASSWORD;
        if (!validU || !validP) return sendJson(res, 500, { success: false, error: { message: "Admin credentials not configured in environment" } });

        // Timing-safe-ish check avoiding buffer padding complexities by hashing both:
        const hashInput = crypto.createHash('sha256').update(u + ':' + p).digest('hex');
        const hashEnv = crypto.createHash('sha256').update(validU + ':' + validP).digest('hex');
        
        if (hashInput === hashEnv) {
          const token = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
          await db.collection('adminSessions').insertOne({ tokenHash, createdAt: new Date() });
          
          res.setHeader('Set-Cookie', `admin_session=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax; ${process.env.NODE_ENV === 'production' ? 'Secure' : ''}`);
          return sendJson(res, 200, { success: true, data: {} });
        }
        return sendJson(res, 401, { success: false, error: { message: "Invalid credentials" } });
      }

      if (path === '/api/admin/logout' && req.method === 'POST') {
        const session = await getSession(req, db);
        if (session) await db.collection('adminSessions').deleteOne({ _id: session._id });
        res.setHeader('Set-Cookie', `admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
        return sendJson(res, 200, { success: true, data: {} });
      }

      // -- PROTECTED ROUTES --
      const session = await getSession(req, db);
      if (!session) return sendJson(res, 401, { success: false, error: { message: "Unauthorized" } });

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
        if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(body.status)) return sendJson(res, 400, { success: false, error: { message: "Invalid status" } });
        
        await db.collection('appointments').updateOne({ _id: new ObjectId(id) }, { $set: { status: body.status, updatedAt: new Date() } });
        return sendJson(res, 200, { success: true, data: {} });
      }

      if (path === '/api/admin/messages' && req.method === 'GET') {
        const msgs = await db.collection('contactMessages').find().sort({ createdAt: -1 }).limit(50).toArray();
        return sendJson(res, 200, { success: true, data: msgs });
      }

      return sendJson(res, 404, { success: false, error: { message: "API route not found" } });
    } catch (err) {
      console.error(err);
      return sendJson(res, 500, { success: false, error: { message: "Internal server error" } });
    }
  }

  // --- ADMIN UI ---
  res.setHeader('Content-Type', 'text/html');
  res.send(adminHTML);
}
