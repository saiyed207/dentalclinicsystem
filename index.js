import { MongoClient } from 'mongodb';

// --- DATABASE CONNECTION & INIT ---
let cachedClient = null;
let cachedDb = null;
let dbInitialized = false;

async function connectToDatabase() {
  if (cachedClient && cachedDb) return { client: cachedClient, db: cachedDb };
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI environment variable is missing.");
  
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || 'smilenest');
  
  if (!dbInitialized) {
    try {
      await db.collection('appointments').createIndex(
        { appointmentDate: 1, appointmentTime: 1 },
        { unique: true, partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } }
      );
      await db.collection('rateLimits').createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 });
      
      const svcCount = await db.collection('services').countDocuments();
      if (svcCount === 0) {
        await db.collection('services').insertMany([
          { name: "General Checkup", slug: "checkup", description: "Comprehensive examination.", price: 99, durationMinutes: 30, active: true, imageUrl: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=400&q=80" },
          { name: "Teeth Cleaning", slug: "cleaning", description: "Professional deep cleaning.", price: 129, durationMinutes: 45, active: true, imageUrl: "https://images.unsplash.com/photo-1598256989800-fea5ce5146f2?auto=format&fit=crop&w=400&q=80" },
          { name: "Teeth Whitening", slug: "whitening", description: "Brighten your smile naturally.", price: 199, durationMinutes: 60, active: true, imageUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=400&q=80" },
          { name: "Cosmetic Dentistry", slug: "cosmetic", description: "Veneers and aesthetic treatments.", price: 499, durationMinutes: 90, active: true, imageUrl: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=400&q=80" },
          { name: "Dental Fillings", slug: "fillings", description: "Tooth-colored composite fillings.", price: 150, durationMinutes: 45, active: true, imageUrl: "https://images.unsplash.com/photo-1572985012586-7e40a0cfaaa3?auto=format&fit=crop&w=400&q=80" },
          { name: "Emergency Visit", slug: "emergency", description: "Immediate pain relief and care.", price: 199, durationMinutes: 30, active: true, imageUrl: "https://images.unsplash.com/photo-1588776813677-77f311c1e878?auto=format&fit=crop&w=400&q=80" }
        ]);
      }
      dbInitialized = true;
    } catch (e) {
      console.error("DB Init Warning:", e);
    }
  }
  
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
const rateLimit = async (db, ip) => {
  const count = await db.collection('rateLimits').countDocuments({ ip, createdAt: { $gt: new Date(Date.now() - 300000) } });
  if (count >= 5) return false;
  await db.collection('rateLimits').insertOne({ ip, createdAt: new Date() });
  return true;
};
const escapeHtml = (unsafe) => (unsafe||'').toString().replace(/[&<"'>]/g, c => ({'&':'&amp;','<':'&lt;','"':'&quot;',"'":'&#39;','>':'&gt;'}[c]));

// --- FRONTEND HTML/CSS/JS TEMPLATE ---
const publicHTML = `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SmileNest Dental Studio</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  :root {
    --lavender: #B8A5FF; --mint: #B8F2D0; --peach: #FFC9AD; 
    --sky: #B8E2FF; --cream: #FFF9F0; --coral: #FF8F8F;
    --dark: #29263D; --muted: #77758B;
  }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: var(--cream); color: var(--dark); overflow-x: hidden; }
  .clay {
    background: #ffffff;
    border-radius: 2rem;
    box-shadow: 12px 12px 24px rgba(184, 165, 255, 0.15), -12px -12px 24px rgba(255, 255, 255, 0.8),
                inset 2px 2px 4px rgba(255, 255, 255, 0.5), inset -2px -2px 4px rgba(0, 0, 0, 0.03);
    transition: all 0.3s ease;
  }
  .clay:hover { transform: translateY(-4px); box-shadow: 16px 16px 32px rgba(184, 165, 255, 0.2), -16px -16px 32px rgba(255, 255, 255, 0.9); }
  .clay-btn {
    background: var(--lavender); color: white; border-radius: 9999px; font-weight: 600;
    box-shadow: 6px 6px 12px rgba(184, 165, 255, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.9),
                inset 2px 2px 4px rgba(255, 255, 255, 0.4), inset -2px -2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
  }
  .clay-btn:hover { background: #a792ff; transform: scale(1.02); }
  .clay-btn:active { box-shadow: inset 4px 4px 8px rgba(0,0,0,0.1), inset -4px -4px 8px rgba(255,255,255,0.4); transform: scale(0.98); }
  .clay-input {
    background: var(--cream); border-radius: 1rem; border: none; padding: 1rem; width: 100%;
    box-shadow: inset 4px 4px 8px rgba(184, 165, 255, 0.15), inset -4px -4px 8px rgba(255, 255, 255, 0.9);
    outline: none; transition: box-shadow 0.2s ease;
  }
  .clay-input:focus { box-shadow: inset 6px 6px 12px rgba(184, 165, 255, 0.25), inset -6px -6px 12px rgba(255, 255, 255, 1); }
  .blob { position: absolute; filter: blur(60px); z-index: -1; opacity: 0.6; animation: float 10s infinite alternate; }
  @keyframes float { 0% { transform: translateY(0px) scale(1); } 100% { transform: translateY(-20px) scale(1.05); } }
  .step-hidden { display: none; }
</style>
</head>
<body class="antialiased relative">
  <!-- Nav -->
  <nav class="fixed w-full z-50 top-0 transition-all duration-300 py-4 px-6" id="navbar">
    <div class="max-w-7xl mx-auto clay px-6 py-3 flex justify-between items-center rounded-full bg-white/80 backdrop-blur-md">
      <div class="flex items-center gap-2 font-bold text-xl text-indigo-900">
        <i data-lucide="smile" class="text-[var(--lavender)]"></i> SmileNest
      </div>
      <div class="hidden md:flex gap-6 items-center font-medium text-[var(--muted)]">
        <a href="#home" class="hover:text-indigo-600 transition">Home</a>
        <a href="#services" class="hover:text-indigo-600 transition">Services</a>
        <a href="#about" class="hover:text-indigo-600 transition">About</a>
        <a href="#testimonials" class="hover:text-indigo-600 transition">Reviews</a>
        <a href="#booking" class="clay-btn px-6 py-2">Book Appointment</a>
      </div>
    </div>
  </nav>

  <!-- Hero -->
  <section id="home" class="relative pt-32 pb-20 px-6 min-h-screen flex items-center overflow-hidden">
    <div class="blob bg-[var(--lavender)] w-96 h-96 rounded-full top-10 left-[-100px]"></div>
    <div class="blob bg-[var(--mint)] w-80 h-80 rounded-full bottom-10 right-[-50px]" style="animation-delay: -3s"></div>
    <div class="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center relative z-10">
      <div>
        <p class="text-[var(--lavender)] font-bold tracking-wider mb-2 text-sm uppercase">Your Friendly Neighborhood Dentist</p>
        <h1 class="text-5xl md:text-6xl font-extrabold leading-tight mb-6">A Healthier Smile,<br>A Happier You.</h1>
        <p class="text-lg text-[var(--muted)] mb-8">Gentle dental care, modern treatments, and a team that makes every visit feel a little brighter.</p>
        <div class="flex gap-4">
          <a href="#booking" class="clay-btn px-8 py-4 text-lg">Book Your Visit</a>
          <a href="#services" class="clay px-8 py-4 text-lg font-semibold hover:bg-gray-50 flex items-center gap-2"><i data-lucide="arrow-right"></i> Services</a>
        </div>
      </div>
      <div class="relative">
        <div class="clay p-2 rounded-[3rem] transform rotate-3 hover:rotate-0 transition duration-500">
          <img src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=800&q=80" alt="Happy Patient" class="rounded-[2.5rem] w-full h-[500px] object-cover">
        </div>
        <div class="clay absolute -left-10 top-20 p-4 flex items-center gap-3 animate-bounce" style="animation-duration: 3s;">
          <div class="bg-[var(--mint)] p-3 rounded-full text-green-800"><i data-lucide="shield-check"></i></div>
          <div><p class="font-bold">Gentle Care</p><p class="text-xs text-[var(--muted)]">Pain-free focus</p></div>
        </div>
      </div>
    </div>
  </section>

  <!-- Services -->
  <section id="services" class="py-20 px-6 relative">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16">
        <h2 class="text-4xl font-bold mb-4">Our Services</h2>
        <p class="text-[var(--muted)] max-w-2xl mx-auto">From routine cleanings to complete smile makeovers, we offer everything you need.</p>
      </div>
      <div id="services-grid" class="grid md:grid-cols-3 gap-8">
        <!-- Services injected here -->
      </div>
    </div>
  </section>

  <!-- Booking Wizard -->
  <section id="booking" class="py-20 px-6 bg-white/40 relative">
    <div class="blob bg-[var(--peach)] w-96 h-96 rounded-full top-0 right-0"></div>
    <div class="max-w-3xl mx-auto clay p-8 md:p-12 relative z-10">
      <h2 class="text-3xl font-bold mb-8 text-center">Book an Appointment</h2>
      
      <!-- Progress -->
      <div class="flex justify-between mb-8 relative">
        <div class="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10 -translate-y-1/2"></div>
        <div class="absolute top-1/2 left-0 h-1 bg-[var(--lavender)] -z-10 -translate-y-1/2 transition-all duration-300" id="progress-bar" style="width: 0%"></div>
        <div class="w-10 h-10 rounded-full bg-[var(--lavender)] text-white flex items-center justify-center font-bold step-indicator" id="ind-1">1</div>
        <div class="w-10 h-10 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold step-indicator" id="ind-2">2</div>
        <div class="w-10 h-10 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold step-indicator" id="ind-3">3</div>
        <div class="w-10 h-10 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold step-indicator" id="ind-4">4</div>
      </div>

      <div id="booking-errors" class="hidden bg-red-100 text-red-700 p-4 rounded-xl mb-6"></div>

      <!-- Step 1: Service -->
      <div id="step-1" class="step-container">
        <h3 class="text-xl font-semibold mb-4">1. Choose a Service</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" id="booking-services">Loading...</div>
      </div>

      <!-- Step 2: Date & Time -->
      <div id="step-2" class="step-container step-hidden">
        <h3 class="text-xl font-semibold mb-4">2. Select Date & Time</h3>
        <label class="block mb-2 font-medium">Appointment Date</label>
        <input type="date" id="book-date" class="clay-input mb-6" min="">
        <label class="block mb-2 font-medium">Available Times</label>
        <div id="time-slots" class="grid grid-cols-3 gap-3">Select a date first.</div>
      </div>

      <!-- Step 3: Details -->
      <div id="step-3" class="step-container step-hidden">
        <h3 class="text-xl font-semibold mb-4">3. Patient Details</h3>
        <div class="space-y-4">
          <input type="text" id="book-name" placeholder="Full Name *" class="clay-input" required>
          <input type="email" id="book-email" placeholder="Email Address *" class="clay-input" required>
          <input type="tel" id="book-phone" placeholder="Phone Number *" class="clay-input" required>
          <textarea id="book-msg" placeholder="Optional Message" class="clay-input" rows="3"></textarea>
          <label class="flex items-center gap-2 cursor-pointer mt-2">
            <input type="checkbox" id="book-consent" class="w-5 h-5 rounded text-indigo-600">
            <span class="text-sm text-[var(--muted)]">I consent to the processing of my details to book this request.</span>
          </label>
        </div>
      </div>

      <!-- Step 4: Success -->
      <div id="step-4" class="step-container step-hidden text-center py-8">
        <div class="w-20 h-20 bg-[var(--mint)] rounded-full flex items-center justify-center mx-auto mb-6 text-green-700">
          <i data-lucide="check-circle" class="w-10 h-10"></i>
        </div>
        <h3 class="text-3xl font-bold mb-2">Request Confirmed!</h3>
        <p class="text-[var(--muted)] mb-4">Your booking reference is <strong id="booking-ref" class="text-[var(--dark)]"></strong>.</p>
        <p class="text-sm text-gray-500">We will review and confirm your appointment shortly. See you soon!</p>
        <button onclick="location.reload()" class="clay-btn px-6 py-2 mt-8">Book Another</button>
      </div>

      <div class="mt-8 flex justify-between" id="booking-controls">
        <button id="btn-prev" class="clay px-6 py-2 hidden">Back</button>
        <button id="btn-next" class="clay-btn px-6 py-2 ml-auto">Next Step</button>
      </div>
    </div>
  </section>

  <!-- About & Meet Dentist -->
  <section id="about" class="py-20 px-6">
    <div class="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
      <div class="clay p-4">
        <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80" class="rounded-[1.5rem] w-full" alt="Clinic">
      </div>
      <div>
        <h2 class="text-4xl font-bold mb-4">Meet Dr. Olivia Bennett</h2>
        <p class="text-[var(--lavender)] font-semibold mb-4">DDS, Specialist in Family & Cosmetic Dentistry (Demo)</p>
        <p class="text-[var(--muted)] mb-6">"Our philosophy is simple: treat every patient like family. We've built an environment where modern technology meets genuine compassion. Your comfort and your smile are always our top priorities."</p>
        <ul class="space-y-3 mb-8">
          <li class="flex items-center gap-3"><i data-lucide="check" class="text-[var(--mint)]"></i> 10+ Years Experience (Demo)</li>
          <li class="flex items-center gap-3"><i data-lucide="check" class="text-[var(--mint)]"></i> Advanced Cosmetic Certifications</li>
          <li class="flex items-center gap-3"><i data-lucide="check" class="text-[var(--mint)]"></i> Gentle, anxiety-free approach</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- Footer / Contact -->
  <footer id="contact" class="bg-[var(--dark)] text-white pt-20 pb-10 px-6 rounded-t-[3rem] mt-20">
    <div class="max-w-7xl mx-auto grid md:grid-cols-3 gap-12 mb-12">
      <div>
        <h3 class="text-2xl font-bold mb-4 flex items-center gap-2"><i data-lucide="smile" class="text-[var(--lavender)]"></i> SmileNest</h3>
        <p class="text-gray-400 mb-6">125 Sunshine Avenue, Suite 204<br>Brookfield<br>hello@smilenest.example<br>+1 (555) 284-7316</p>
        <p class="text-gray-400">Mon-Fri: 9AM - 6PM<br>Sat: 9AM - 2PM</p>
      </div>
      <div>
        <h3 class="text-xl font-bold mb-4">Contact Us</h3>
        <form id="contact-form" class="space-y-3">
          <input type="text" id="c-name" placeholder="Name" class="w-full bg-white/10 rounded-xl p-3 text-white border-none outline-none focus:bg-white/20" required>
          <input type="email" id="c-email" placeholder="Email" class="w-full bg-white/10 rounded-xl p-3 text-white border-none outline-none focus:bg-white/20" required>
          <textarea id="c-msg" placeholder="Message" class="w-full bg-white/10 rounded-xl p-3 text-white border-none outline-none focus:bg-white/20" rows="3" required></textarea>
          <button type="submit" class="clay-btn w-full py-3 mt-2">Send Message</button>
          <div id="c-status" class="text-sm mt-2 hidden"></div>
        </form>
      </div>
      <div>
        <h3 class="text-xl font-bold mb-4">Quick Links</h3>
        <ul class="space-y-2 text-gray-400">
          <li><a href="#home" class="hover:text-white">Home</a></li>
          <li><a href="#services" class="hover:text-white">Services</a></li>
          <li><a href="#" class="hover:text-white">Privacy Policy</a></li>
          <li><a href="/admin" class="hover:text-white">Staff Login</a></li>
        </ul>
      </div>
    </div>
    <div class="text-center text-gray-500 text-sm">© <span id="year"></span> SmileNest Dental Studio (Demo). All rights reserved.</div>
  </footer>

<script>
  lucide.createIcons();
  document.getElementById('year').textContent = new Date().getFullYear();
  
  // State
  let services = [];
  let step = 1;
  const bookingData = { serviceId: '', date: '', time: '', name: '', email: '', phone: '', message: '' };

  // Setup Date Picker
  const dateInput = document.getElementById('book-date');
  const today = new Date();
  today.setDate(today.getDate() + 1); // Start tomorrow
  dateInput.min = today.toISOString().split('T')[0];
  
  // Fetch Services
  fetch('/api/services').then(r=>r.json()).then(data => {
    if(data.success) {
      services = data.data;
      const grid = document.getElementById('services-grid');
      const bGrid = document.getElementById('booking-services');
      grid.innerHTML = ''; bGrid.innerHTML = '';
      services.filter(s=>s.active).forEach(s => {
        // Public Display
        grid.innerHTML += \`
          <div class="clay p-6 flex flex-col h-full">
            <img src="\${s.imageUrl}" class="w-full h-48 object-cover rounded-2xl mb-4" alt="\${s.name}">
            <h3 class="text-xl font-bold mb-2">\${s.name}</h3>
            <p class="text-[var(--muted)] text-sm mb-4 flex-grow">\${s.description}</p>
            <div class="flex justify-between items-center mt-auto">
              <span class="font-bold text-lg">$\${s.price}*</span>
              <button onclick="selectService('\${s._id}')" class="clay-btn px-4 py-2 text-sm">Book</button>
            </div>
          </div>\`;
        // Booking Selection
        bGrid.innerHTML += \`
          <div class="clay p-4 cursor-pointer hover:border-[var(--lavender)] border-2 border-transparent transition" onclick="selectServiceStep('\${s._id}')" id="svc-\${s._id}">
            <h4 class="font-bold">\${s.name}</h4>
            <p class="text-sm text-gray-500">\${s.durationMinutes} mins</p>
          </div>\`;
      });
    }
  });

  window.selectService = (id) => {
    document.getElementById('booking').scrollIntoView({behavior:'smooth'});
    selectServiceStep(id);
  };

  window.selectServiceStep = (id) => {
    bookingData.serviceId = id;
    document.querySelectorAll('[id^="svc-"]').forEach(el => el.style.borderColor = 'transparent');
    document.getElementById('svc-'+id).style.borderColor = 'var(--lavender)';
  };

  // Booking Flow
  const updateSteps = () => {
    for(let i=1; i<=4; i++) {
      document.getElementById('step-'+i).classList.add('step-hidden');
      const ind = document.getElementById('ind-'+i);
      if(i < step) { ind.className = 'w-10 h-10 rounded-full bg-[var(--lavender)] text-white flex items-center justify-center font-bold step-indicator'; }
      else if(i === step) { ind.className = 'w-10 h-10 rounded-full bg-[var(--lavender)] text-white flex items-center justify-center font-bold shadow-[0_0_15px_var(--lavender)] step-indicator'; }
      else { ind.className = 'w-10 h-10 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold step-indicator'; }
    }
    document.getElementById('step-'+step).classList.remove('step-hidden');
    document.getElementById('progress-bar').style.width = ((step-1)/3)*100 + '%';
    
    document.getElementById('btn-prev').style.display = (step>1 && step<4) ? 'block' : 'none';
    document.getElementById('btn-next').style.display = step<4 ? 'block' : 'none';
    document.getElementById('btn-next').textContent = step === 3 ? 'Confirm Booking' : 'Next Step';
  };

  document.getElementById('btn-next').addEventListener('click', async () => {
    const err = document.getElementById('booking-errors');
    err.classList.add('hidden');
    
    if(step === 1 && !bookingData.serviceId) {
      err.textContent = "Please select a service."; err.classList.remove('hidden'); return;
    }
    if(step === 2 && (!bookingData.date || !bookingData.time)) {
      err.textContent = "Please select a date and time."; err.classList.remove('hidden'); return;
    }
    if(step === 3) {
      bookingData.name = document.getElementById('book-name').value.trim();
      bookingData.email = document.getElementById('book-email').value.trim();
      bookingData.phone = document.getElementById('book-phone').value.trim();
      bookingData.message = document.getElementById('book-msg').value.trim();
      if(!bookingData.name || !bookingData.email || !bookingData.phone) {
         err.textContent = "Please fill all required fields."; err.classList.remove('hidden'); return;
      }
      if(!document.getElementById('book-consent').checked) {
         err.textContent = "You must consent to proceed."; err.classList.remove('hidden'); return;
      }
      
      // Submit Booking
      const btn = document.getElementById('btn-next');
      btn.textContent = "Processing..."; btn.disabled = true;
      try {
        const res = await fetch('/api/appointments', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify(bookingData)
        });
        const data = await res.json();
        if(!data.success) throw new Error(data.error.message || "Booking failed");
        
        document.getElementById('booking-ref').textContent = data.data.bookingReference;
        step = 4;
        updateSteps();
        document.getElementById('booking-controls').style.display = 'none';
      } catch (e) {
        err.textContent = e.message; err.classList.remove('hidden');
      } finally {
        btn.textContent = "Confirm Booking"; btn.disabled = false;
      }
      return;
    }
    step++; updateSteps();
  });

  document.getElementById('btn-prev').addEventListener('click', () => { step--; updateSteps(); });

  // Availability Check
  dateInput.addEventListener('change', async (e) => {
    const date = e.target.value;
    bookingData.date = date;
    bookingData.time = '';
    const ts = document.getElementById('time-slots');
    ts.innerHTML = 'Loading...';
    try {
      const res = await fetch(\`/api/availability?date=\${date}\`);
      const data = await res.json();
      ts.innerHTML = '';
      if(!data.success || data.data.length === 0) {
        ts.innerHTML = '<p class="col-span-3 text-red-500">No slots available on this date.</p>';
        return;
      }
      data.data.forEach(time => {
        const div = document.createElement('div');
        div.className = 'clay p-3 text-center cursor-pointer text-sm font-medium hover:bg-gray-50';
        div.textContent = time;
        div.onclick = () => {
          bookingData.time = time;
          document.querySelectorAll('#time-slots div').forEach(el=>el.style.border = 'none');
          div.style.border = '2px solid var(--lavender)';
        };
        ts.appendChild(div);
      });
    } catch(e) { ts.innerHTML = 'Error loading slots.'; }
  });

  // Contact Form
  document.getElementById('contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const status = document.getElementById('c-status');
    btn.textContent = "Sending..."; btn.disabled = true; status.classList.add('hidden');
    
    try {
      const res = await fetch('/api/contact', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          name: document.getElementById('c-name').value,
          email: document.getElementById('c-email').value,
          message: document.getElementById('c-msg').value
        })
      });
      const data = await res.json();
      if(data.success) {
        status.textContent = "Message sent successfully!"; status.className = "text-sm mt-2 text-green-400";
        e.target.reset();
      } else throw new Error(data.error.message);
    } catch(err) {
      status.textContent = err.message || "Failed to send."; status.className = "text-sm mt-2 text-red-400";
    } finally {
      btn.textContent = "Send Message"; btn.disabled = false; status.classList.remove('hidden');
    }
  });

</script>
</body>
</html>`;

// --- MAIN HANDLER ---
export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  // --- API ROUTES ---
  if (path.startsWith('/api/')) {
    try {
      const { db } = await connectToDatabase();
      const method = req.method;

      if (path === '/api/health') return sendJson(res, 200, { success: true, status: 'ok' });

      if (path === '/api/services' && method === 'GET') {
        const services = await db.collection('services').find({ active: true }).toArray();
        return sendJson(res, 200, { success: true, data: services });
      }

      if (path === '/api/availability' && method === 'GET') {
        const date = url.searchParams.get('date');
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendJson(res, 400, { success: false, error: { message: "Invalid date" } });
        
        const dayOfWeek = new Date(date).getDay();
        if (dayOfWeek === 0) return sendJson(res, 200, { success: true, data: [] }); // Closed Sundays
        
        const allSlots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"];
        const slots = dayOfWeek === 6 ? allSlots.slice(0, 7) : allSlots; // Sat: 9-2

        const booked = await db.collection('appointments').find({
          appointmentDate: date,
          status: { $in: ['pending', 'confirmed'] }
        }).toArray();
        
        const bookedTimes = booked.map(b => b.appointmentTime);
        const available = slots.filter(t => !bookedTimes.includes(t));
        return sendJson(res, 200, { success: true, data: available });
      }

      if (path === '/api/appointments' && method === 'POST') {
        const body = await parseBody(req);
        const { serviceId, date, time, name, email, phone, message } = body;
        if (!serviceId || !date || !time || !name || !email || !phone) {
          return sendJson(res, 400, { success: false, error: { message: "Missing required fields." } });
        }
        
        // Rate limit
        const ip = req.headers['x-forwarded-for'] || 'unknown';
        if (!(await rateLimit(db, ip))) return sendJson(res, 429, { success: false, error: { message: "Too many requests." } });

        const { ObjectId } = await import('mongodb');
        const service = await db.collection('services').findOne({ _id: new ObjectId(serviceId) });
        if (!service) return sendJson(res, 404, { success: false, error: { message: "Service not found." } });

        const ref = 'SN-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        try {
          await db.collection('appointments').insertOne({
            bookingReference: ref, patientName: escapeHtml(name), patientEmail: escapeHtml(email), patientPhone: escapeHtml(phone),
            patientMessage: escapeHtml(message), serviceId: service._id, serviceSnapshot: { name: service.name, price: service.price, duration: service.durationMinutes },
            appointmentDate: date, appointmentTime: time, status: 'pending', createdAt: new Date()
          });
          return sendJson(res, 201, { success: true, data: { bookingReference: ref } });
        } catch (err) {
          if (err.code === 11000) return sendJson(res, 409, { success: false, error: { message: "This slot was just booked by someone else. Please choose another." } });
          throw err;
        }
      }

      if (path === '/api/contact' && method === 'POST') {
        const body = await parseBody(req);
        const ip = req.headers['x-forwarded-for'] || 'unknown';
        if (!(await rateLimit(db, ip))) return sendJson(res, 429, { success: false, error: { message: "Too many requests." } });
        
        if (!body.name || !body.email || !body.message) return sendJson(res, 400, { success: false, error: { message: "Missing fields" } });
        await db.collection('contactMessages').insertOne({
          name: escapeHtml(body.name), email: escapeHtml(body.email), message: escapeHtml(body.message), read: false, createdAt: new Date()
        });
        return sendJson(res, 201, { success: true, data: {} });
      }

      return sendJson(res, 404, { success: false, error: { message: "API route not found" } });
    } catch (err) {
      console.error(err);
      return sendJson(res, 500, { success: false, error: { message: "Internal server error" } });
    }
  }

  // --- PUBLIC UI ---
  res.setHeader('Content-Type', 'text/html');
  res.send(publicHTML);
}
