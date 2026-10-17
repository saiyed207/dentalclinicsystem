import { MongoClient } from 'mongodb';

// Verified, high-availability dental imagery with fallback
const VERIFIED_SERVICES = [
  { name: "General Checkup", slug: "checkup", description: "Comprehensive examination of teeth, gums, and oral health.", price: 99, durationMinutes: 30, active: true, imageUrl: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=600&q=80" },
  { name: "Teeth Cleaning", slug: "cleaning", description: "Professional ultrasonic scaling and polishing for healthy gums.", price: 129, durationMinutes: 45, active: true, imageUrl: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=600&q=80" },
  { name: "Teeth Whitening", slug: "whitening", description: "Safe, clinical-grade enamel whitening for a radiant smile.", price: 199, durationMinutes: 60, active: true, imageUrl: "https://images.unsplash.com/photo-1598256989800-fea5ce5146f2?auto=format&fit=crop&w=600&q=80" },
  { name: "Cosmetic Dentistry", slug: "cosmetic", description: "Custom porcelain veneers and smile contouring.", price: 499, durationMinutes: 90, active: true, imageUrl: "https://images.unsplash.com/photo-1572985012586-7e40a0cfaaa3?auto=format&fit=crop&w=600&q=80" },
  { name: "Dental Fillings", slug: "fillings", description: "Natural, durable tooth-colored composite restorations.", price: 150, durationMinutes: 45, active: true, imageUrl: "https://images.unsplash.com/photo-1657470179447-0f5aa16daa91?auto=format&fit=crop&w=600&q=80" },
  { name: "Emergency Care", slug: "emergency", description: "Prompt toothache relief, repairs, and urgent interventions.", price: 199, durationMinutes: 30, active: true, imageUrl: "https://images.unsplash.com/photo-1588776813677-77f311c1e878?auto=format&fit=crop&w=600&q=80" }
];

// --- DATABASE CONNECTION & SEEDING ---
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
      
      // Seed or update services with verified image URLs
      for (const svc of VERIFIED_SERVICES) {
        await db.collection('services').updateOne(
          { slug: svc.slug },
          { $set: svc },
          { upsert: true }
        );
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
const escapeHtml = (unsafe) => (unsafe || '').toString().replace(/[&<"'>]/g, c => ({ '&': '&amp;', '<': '&lt;', '"': '&quot;', "'": '&#39;', '>': '&gt;' }[c]));

// --- FRONTEND TEMPLATE ---
const publicHTML = `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SmileNest Dental Studio - Modern Dental Care</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  :root {
    --bg-page: #F4F2FC;
    --lavender: #7C5CFC;
    --lavender-soft: #EDE8FF;
    --mint: #10B981;
    --peach: #FB923C;
    --sky: #38BDF8;
    --coral: #F43F5E;
    --dark: #18142E;
    --text-body: #3F3A59;
    --border-clay: rgba(124, 92, 252, 0.22);
  }
  body { 
    font-family: 'Plus Jakarta Sans', sans-serif; 
    background-color: var(--bg-page); 
    color: var(--dark); 
    overflow-x: hidden; 
  }
  /* High-Contrast Claymorphism Cards */
  .clay {
    background: #FFFFFF;
    border-radius: 2rem;
    border: 2px solid var(--border-clay);
    box-shadow: 10px 14px 28px rgba(100, 70, 210, 0.12), -6px -6px 20px rgba(255, 255, 255, 0.95),
                inset 2px 2px 4px rgba(255, 255, 255, 0.8), inset -2px -2px 4px rgba(124, 92, 252, 0.05);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .clay:hover { 
    transform: translateY(-5px); 
    border-color: rgba(124, 92, 252, 0.45);
    box-shadow: 14px 18px 36px rgba(100, 70, 210, 0.18), -8px -8px 24px rgba(255, 255, 255, 1); 
  }
  /* High-Contrast Action Buttons */
  .clay-btn {
    background: linear-gradient(135deg, #8B6BF6 0%, #6E46E5 100%);
    color: #FFFFFF; 
    border-radius: 9999px; 
    font-weight: 700;
    border: 2px solid rgba(255, 255, 255, 0.4);
    box-shadow: 6px 8px 18px rgba(110, 70, 229, 0.35), -4px -4px 10px rgba(255, 255, 255, 0.8),
                inset 1px 1px 3px rgba(255, 255, 255, 0.5);
    transition: all 0.2s ease;
  }
  .clay-btn:hover { 
    transform: scale(1.03); 
    box-shadow: 8px 12px 22px rgba(110, 70, 229, 0.45), -4px -4px 12px rgba(255, 255, 255, 0.9);
  }
  .clay-btn:active { 
    transform: scale(0.97); 
    box-shadow: inset 3px 3px 6px rgba(0, 0, 0, 0.25); 
  }
  /* Crisp Inputs with Inset Clay */
  .clay-input {
    background: #FFFFFF; 
    border-radius: 1.25rem; 
    border: 2px solid rgba(124, 92, 252, 0.25); 
    padding: 1rem 1.25rem; 
    width: 100%;
    color: var(--dark);
    font-weight: 500;
    box-shadow: inset 3px 3px 6px rgba(124, 92, 252, 0.1), inset -3px -3px 6px rgba(255, 255, 255, 0.8);
    outline: none; 
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .clay-input:focus { 
    border-color: var(--lavender); 
    box-shadow: inset 4px 4px 8px rgba(124, 92, 252, 0.18), 0 0 0 3px rgba(124, 92, 252, 0.15); 
  }
  .blob { 
    position: absolute; 
    filter: blur(70px); 
    z-index: -1; 
    opacity: 0.55; 
    animation: float 9s infinite alternate ease-in-out; 
  }
  @keyframes float { 
    0% { transform: translate(0, 0) scale(1); } 
    100% { transform: translate(25px, -30px) scale(1.1); } 
  }
  .step-hidden { display: none; }
</style>
</head>
<body class="antialiased relative">
  <script>
    // Global fallback for any failed remote image
    window.handleImgError = (img, label) => {
      img.onerror = null;
      img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" fill="%23EDE8FF"><rect width="600" height="400" fill="%23EDE8FF"/><circle cx="300" cy="180" r="70" fill="%237C5CFC" opacity="0.15"/><path d="M280 180 C280 150, 320 150, 320 180 C320 205, 305 220, 300 230 C295 220, 280 205, 280 180 Z" fill="%237C5CFC"/><text x="300" y="275" font-family="sans-serif" font-size="20" font-weight="bold" fill="%2318142E" text-anchor="middle">' + encodeURIComponent(label || 'SmileNest Dental') + '</text></svg>';
    };
  </script>

  <!-- Navbar -->
  <nav class="fixed w-full z-50 top-0 py-4 px-6">
    <div class="max-w-7xl mx-auto clay px-6 py-3 flex justify-between items-center bg-white/95 backdrop-blur-md">
      <div class="flex items-center gap-2 font-extrabold text-2xl text-[var(--dark)]">
        <div class="bg-[var(--lavender)] text-white p-2 rounded-2xl flex items-center justify-center">
          <i data-lucide="smile" class="w-6 h-6"></i>
        </div>
        Smile<span class="text-[var(--lavender)]">Nest</span>
      </div>
      <div class="hidden md:flex gap-8 items-center font-semibold text-[var(--text-body)]">
        <a href="#home" class="hover:text-[var(--lavender)] transition">Home</a>
        <a href="#services" class="hover:text-[var(--lavender)] transition">Services</a>
        <a href="#about" class="hover:text-[var(--lavender)] transition">About Doctor</a>
        <a href="#contact" class="hover:text-[var(--lavender)] transition">Contact</a>
        <a href="#booking" class="clay-btn px-6 py-2.5">Book Appointment</a>
      </div>
    </div>
  </nav>

  <!-- Hero Section -->
  <section id="home" class="relative pt-36 pb-20 px-6 min-h-screen flex items-center overflow-hidden">
    <div class="blob bg-[#D6C7FF] w-[450px] h-[450px] rounded-full -top-12 -left-20"></div>
    <div class="blob bg-[#B8F2D0] w-[400px] h-[400px] rounded-full bottom-0 -right-20" style="animation-delay: -3s"></div>
    
    <div class="max-w-7xl mx-auto grid md:grid-cols-2 gap-14 items-center relative z-10">
      <div>
        <div class="inline-flex items-center gap-2 bg-[var(--lavender-soft)] border border-[var(--border-clay)] px-4 py-2 rounded-full mb-4">
          <i data-lucide="sparkles" class="w-4 h-4 text-[var(--lavender)]"></i>
          <span class="text-[var(--lavender)] font-bold text-xs uppercase tracking-wider">Your Friendly Neighborhood Dentist</span>
        </div>
        <h1 class="text-5xl md:text-6xl font-extrabold leading-[1.15] mb-6 text-[var(--dark)]">
          A Healthier Smile,<br><span class="text-[var(--lavender)]">A Happier You.</span>
        </h1>
        <p class="text-lg text-[var(--text-body)] mb-8 leading-relaxed font-normal">
          Gentle dental care, modern treatments, and a clinic environment designed to make every single appointment feel relaxing and comfortable.
        </p>
        <div class="flex flex-wrap gap-4">
          <a href="#booking" class="clay-btn px-8 py-4 text-lg">Book Your Visit</a>
          <a href="#services" class="clay px-8 py-4 text-lg font-bold text-[var(--dark)] flex items-center gap-2 hover:bg-gray-50">
            Explore Services <i data-lucide="arrow-down-right" class="w-5 h-5 text-[var(--lavender)]"></i>
          </a>
        </div>
      </div>
      
      <div class="relative">
        <div class="clay p-3.5 rounded-[3rem] transform rotate-2 hover:rotate-0 transition duration-500 bg-white">
          <img src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=900&q=80" 
               alt="SmileNest Dental Clinic Room" 
               class="rounded-[2.5rem] w-full h-[460px] object-cover"
               onerror="handleImgError(this, 'SmileNest Dental Studio')">
        </div>
        <!-- Floating badge 1 -->
        <div class="clay absolute -left-8 top-12 p-4 flex items-center gap-3.5 bg-white">
          <div class="bg-[var(--mint)] text-white p-3 rounded-2xl shadow-sm"><i data-lucide="shield-check" class="w-6 h-6"></i></div>
          <div><p class="font-bold text-sm text-[var(--dark)]">Gentle Care</p><p class="text-xs text-[var(--text-body)]">Pain-free modern dentistry</p></div>
        </div>
        <!-- Floating badge 2 -->
        <div class="clay absolute -right-6 bottom-8 p-4 flex items-center gap-3.5 bg-white">
          <div class="bg-[var(--peach)] text-white p-3 rounded-2xl shadow-sm"><i data-lucide="star" class="w-6 h-6"></i></div>
          <div><p class="font-bold text-sm text-[var(--dark)]">5-Star Quality</p><p class="text-xs text-[var(--text-body)]">Demo client satisfaction</p></div>
        </div>
      </div>
    </div>
  </section>

  <!-- Benefits Section -->
  <section class="py-12 px-6">
    <div class="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="clay p-6 bg-white">
        <div class="w-12 h-12 rounded-2xl bg-[var(--lavender-soft)] text-[var(--lavender)] flex items-center justify-center mb-4"><i data-lucide="heart-pulse"></i></div>
        <h4 class="font-bold text-lg mb-1">Patient-Focused</h4>
        <p class="text-sm text-[var(--text-body)]">Individualized care tailored to keep you calm and informed.</p>
      </div>
      <div class="clay p-6 bg-white">
        <div class="w-12 h-12 rounded-2xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center mb-4"><i data-lucide="cpu"></i></div>
        <h4 class="font-bold text-lg mb-1">Modern Equipment</h4>
        <p class="text-sm text-[var(--text-body)]">Digital diagnostics and low-radiation dental imaging.</p>
      </div>
      <div class="clay p-6 bg-white">
        <div class="w-12 h-12 rounded-2xl bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center mb-4"><i data-lucide="calendar-check"></i></div>
        <h4 class="font-bold text-lg mb-1">Easy Scheduling</h4>
        <p class="text-sm text-[var(--text-body)]">Instant booking wizard with zero double-booking conflicts.</p>
      </div>
      <div class="clay p-6 bg-white">
        <div class="w-12 h-12 rounded-2xl bg-[#FFEDD5] text-[#EA580C] flex items-center justify-center mb-4"><i data-lucide="badge-percent"></i></div>
        <h4 class="font-bold text-lg mb-1">Transparent Fees</h4>
        <p class="text-sm text-[var(--text-body)]">Clear starting treatment costs with no hidden fees.</p>
      </div>
    </div>
  </section>

  <!-- Services Grid -->
  <section id="services" class="py-20 px-6 relative">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16">
        <div class="inline-block bg-[var(--lavender-soft)] text-[var(--lavender)] font-bold text-xs px-3.5 py-1.5 rounded-full mb-3 uppercase tracking-wider">Expert Treatments</div>
        <h2 class="text-4xl font-extrabold text-[var(--dark)] mb-4">Our Dental Services</h2>
        <p class="text-[var(--text-body)] max-w-2xl mx-auto font-medium">Clear pricing, comfortable treatment sessions, and lasting dental health.</p>
      </div>
      <div id="services-grid" class="grid md:grid-cols-3 gap-8">
        <!-- Dynamically populated -->
      </div>
    </div>
  </section>

  <!-- Interactive Multi-Step Booking -->
  <section id="booking" class="py-20 px-6 bg-white/50 relative">
    <div class="blob bg-[#FED7AA] w-[400px] h-[400px] rounded-full top-10 right-0"></div>
    <div class="max-w-3xl mx-auto clay p-8 md:p-12 relative z-10 bg-white">
      <div class="text-center mb-8">
        <div class="inline-block bg-[var(--lavender-soft)] text-[var(--lavender)] font-bold text-xs px-3.5 py-1.5 rounded-full mb-2 uppercase tracking-wider">Online Booking</div>
        <h2 class="text-3xl font-extrabold text-[var(--dark)]">Reserve Your Appointment</h2>
      </div>

      <!-- Step Progress -->
      <div class="flex justify-between mb-8 relative max-w-md mx-auto">
        <div class="absolute top-1/2 left-0 w-full h-1.5 bg-gray-200 -z-10 -translate-y-1/2 rounded-full"></div>
        <div class="absolute top-1/2 left-0 h-1.5 bg-[var(--lavender)] -z-10 -translate-y-1/2 transition-all duration-300 rounded-full" id="progress-bar" style="width: 0%"></div>
        <div class="w-11 h-11 rounded-full bg-[var(--lavender)] text-white flex items-center justify-center font-bold text-base shadow-md" id="ind-1">1</div>
        <div class="w-11 h-11 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-base shadow-sm" id="ind-2">2</div>
        <div class="w-11 h-11 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-base shadow-sm" id="ind-3">3</div>
        <div class="w-11 h-11 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-base shadow-sm" id="ind-4">4</div>
      </div>

      <div id="booking-errors" class="hidden bg-rose-50 border-2 border-rose-300 text-rose-800 p-4 rounded-2xl mb-6 font-semibold"></div>

      <!-- Step 1: Select Service -->
      <div id="step-1" class="step-container">
        <h3 class="text-lg font-bold mb-4 text-[var(--dark)]">1. Select a Dental Service</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" id="booking-services">Loading available services...</div>
      </div>

      <!-- Step 2: Date & Time -->
      <div id="step-2" class="step-container step-hidden">
        <h3 class="text-lg font-bold mb-4 text-[var(--dark)]">2. Select Date & Convenient Time</h3>
        <label class="block mb-2 font-bold text-sm text-[var(--dark)]">Appointment Date (Mon–Sat)</label>
        <input type="date" id="book-date" class="clay-input mb-6 font-semibold">
        <label class="block mb-2 font-bold text-sm text-[var(--dark)]">Available Time Slots</label>
        <div id="time-slots" class="grid grid-cols-3 sm:grid-cols-4 gap-3 text-sm">Please select a valid date first.</div>
      </div>

      <!-- Step 3: Patient Info -->
      <div id="step-3" class="step-container step-hidden">
        <h3 class="text-lg font-bold mb-4 text-[var(--dark)]">3. Patient Contact Information</h3>
        <div class="space-y-4">
          <input type="text" id="book-name" placeholder="Full Legal Name *" class="clay-input" required>
          <input type="email" id="book-email" placeholder="Email Address *" class="clay-input" required>
          <input type="tel" id="book-phone" placeholder="Phone Number (e.g. +1 555-0192) *" class="clay-input" required>
          <textarea id="book-msg" placeholder="Any symptoms or notes for the dentist (Optional)" class="clay-input" rows="3"></textarea>
          <label class="flex items-start gap-3 cursor-pointer mt-3 p-3 bg-[var(--bg-page)] rounded-xl border border-[var(--border-clay)]">
            <input type="checkbox" id="book-consent" class="w-5 h-5 rounded text-[var(--lavender)] mt-0.5">
            <span class="text-xs text-[var(--text-body)] font-medium leading-relaxed">
              I consent to SmileNest storing this booking information and contacting me regarding my scheduled appointment.
            </span>
          </label>
        </div>
      </div>

      <!-- Step 4: Booking Confirmation -->
      <div id="step-4" class="step-container step-hidden text-center py-6">
        <div class="w-20 h-20 bg-[#DCFCE7] border-2 border-[#86EFAC] rounded-full flex items-center justify-center mx-auto mb-6 text-[#16A34A] shadow-md">
          <i data-lucide="check" class="w-10 h-10"></i>
        </div>
        <h3 class="text-3xl font-extrabold text-[var(--dark)] mb-2">Booking Confirmed!</h3>
        <p class="text-[var(--text-body)] mb-4">Your appointment reference is: <strong id="booking-ref" class="text-[var(--lavender)] font-mono text-xl"></strong></p>
        <p class="text-sm text-gray-500 max-w-md mx-auto">We look forward to seeing you at SmileNest Dental Studio. A member of our clinical team will review your slot shortly.</p>
        <button onclick="location.reload()" class="clay-btn px-8 py-3 mt-8">Schedule Another</button>
      </div>

      <!-- Buttons -->
      <div class="mt-8 flex justify-between" id="booking-controls">
        <button id="btn-prev" class="clay px-6 py-2.5 font-bold text-sm hidden bg-white">Back</button>
        <button id="btn-next" class="clay-btn px-8 py-3 text-sm ml-auto">Next Step</button>
      </div>
    </div>
  </section>

  <!-- Doctor Bio -->
  <section id="about" class="py-20 px-6">
    <div class="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
      <div class="clay p-4 bg-white">
        <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=80" 
             class="rounded-[1.75rem] w-full h-[450px] object-cover object-top" 
             alt="Dr. Olivia Bennett"
             onerror="handleImgError(this, 'Dr. Olivia Bennett, DDS')">
      </div>
      <div>
        <div class="inline-block bg-[var(--lavender-soft)] text-[var(--lavender)] font-bold text-xs px-3.5 py-1.5 rounded-full mb-3 uppercase tracking-wider">Lead Dentist</div>
        <h2 class="text-4xl font-extrabold text-[var(--dark)] mb-2">Dr. Olivia Bennett, DDS</h2>
        <p class="text-[var(--lavender)] font-bold text-lg mb-4">Family, Cosmetic & Restorative Dentistry (Demo)</p>
        <p class="text-[var(--text-body)] mb-6 leading-relaxed">
          "Dental visits do not have to be stressful. At SmileNest, we listen first, treat gently, and design comprehensive care plans that fit your lifestyle and comfort level."
        </p>
        <div class="grid grid-cols-2 gap-4 mb-8">
          <div class="clay p-4 bg-white"><p class="font-extrabold text-2xl text-[var(--lavender)]">10+ Yrs</p><p class="text-xs text-[var(--text-body)]">Clinical Experience (Demo)</p></div>
          <div class="clay p-4 bg-white"><p class="font-extrabold text-2xl text-[var(--lavender)]">100%</p><p class="text-xs text-[var(--text-body)]">Digital Pain-Free Focus</p></div>
        </div>
        <a href="#booking" class="clay-btn px-6 py-3 text-sm inline-block">Consult Dr. Bennett</a>
      </div>
    </div>
  </section>

  <!-- Footer & Contact Form -->
  <footer id="contact" class="bg-[var(--dark)] text-white pt-20 pb-10 px-6 rounded-t-[3.5rem] mt-20">
    <div class="max-w-7xl mx-auto grid md:grid-cols-3 gap-12 mb-12">
      <div>
        <h3 class="text-2xl font-extrabold mb-4 flex items-center gap-2"><i data-lucide="smile" class="text-[var(--lavender)]"></i> SmileNest</h3>
        <p class="text-gray-300 mb-6 leading-relaxed">125 Sunshine Avenue, Suite 204<br>Brookfield<br>hello@smilenest.example<br>+1 (555) 284-7316</p>
        <div class="clay p-4 bg-white/10 border-white/10 text-xs text-gray-200">
          <p class="font-bold mb-1 text-white">Clinic Hours:</p>
          <p>Mon–Fri: 9:00 AM – 6:00 PM</p>
          <p>Saturday: 9:00 AM – 2:00 PM</p>
          <p>Sunday: Closed</p>
        </div>
      </div>
      <div>
        <h3 class="text-xl font-bold mb-4">Send a Message</h3>
        <form id="contact-form" class="space-y-3">
          <input type="text" id="c-name" placeholder="Your Name" class="w-full bg-white/10 rounded-xl p-3 text-white border border-white/20 outline-none focus:border-[var(--lavender)] font-medium" required>
          <input type="email" id="c-email" placeholder="Your Email" class="w-full bg-white/10 rounded-xl p-3 text-white border border-white/20 outline-none focus:border-[var(--lavender)] font-medium" required>
          <textarea id="c-msg" placeholder="How can we help?" class="w-full bg-white/10 rounded-xl p-3 text-white border border-white/20 outline-none focus:border-[var(--lavender)] font-medium" rows="3" required></textarea>
          <button type="submit" class="clay-btn w-full py-3">Send Inquiry</button>
          <div id="c-status" class="text-sm mt-2 hidden font-semibold"></div>
        </form>
      </div>
      <div>
        <h3 class="text-xl font-bold mb-4">Quick Navigation</h3>
        <ul class="space-y-2.5 text-gray-300 font-medium">
          <li><a href="#home" class="hover:text-white transition">Home</a></li>
          <li><a href="#services" class="hover:text-white transition">Services & Pricing</a></li>
          <li><a href="#about" class="hover:text-white transition">Meet Dr. Bennett</a></li>
          <li><a href="#booking" class="hover:text-white transition">Book Visit</a></li>
          <li><a href="/admin" class="hover:text-[var(--lavender)] transition font-bold text-white mt-4 inline-block">Staff Admin Portal →</a></li>
        </ul>
      </div>
    </div>
    <div class="text-center text-gray-400 text-sm border-t border-white/10 pt-8">
      © <span id="year"></span> SmileNest Dental Studio (Demonstration Prototype). All rights reserved.
    </div>
  </footer>

<script>
  lucide.createIcons();
  document.getElementById('year').textContent = new Date().getFullYear();

  let services = [];
  let step = 1;
  const bookingData = { serviceId: '', date: '', time: '', name: '', email: '', phone: '', message: '' };

  const dateInput = document.getElementById('book-date');
  const today = new Date();
  today.setDate(today.getDate() + 1);
  dateInput.min = today.toISOString().split('T')[0];

  // Fetch Services & Render
  fetch('/api/services').then(r => r.json()).then(data => {
    if (data.success) {
      services = data.data;
      const grid = document.getElementById('services-grid');
      const bGrid = document.getElementById('booking-services');
      grid.innerHTML = ''; 
      bGrid.innerHTML = '';

      services.filter(s => s.active).forEach(s => {
        grid.innerHTML += \`
          <div class="clay p-6 flex flex-col h-full bg-white">
            <div class="overflow-hidden rounded-2xl mb-4 h-48 bg-[var(--lavender-soft)]">
              <img src="\${s.imageUrl}" class="w-full h-full object-cover transition duration-300 hover:scale-105" alt="\${s.name}" onerror="handleImgError(this, '\${s.name}')">
            </div>
            <h3 class="text-xl font-bold mb-2 text-[var(--dark)]">\${s.name}</h3>
            <p class="text-[var(--text-body)] text-sm mb-4 flex-grow font-normal leading-relaxed">\${s.description}</p>
            <div class="flex justify-between items-center mt-auto pt-4 border-t border-gray-100">
              <div>
                <span class="text-xs text-gray-500 block">Starting from</span>
                <span class="font-extrabold text-xl text-[var(--dark)]">$\${s.price}</span>
              </div>
              <button onclick="selectService('\${s._id}')" class="clay-btn px-5 py-2 text-sm">Select</button>
            </div>
          </div>\`;

        bGrid.innerHTML += \`
          <div class="clay p-4 cursor-pointer border-2 border-transparent hover:border-[var(--lavender)] transition bg-white" onclick="selectServiceStep('\${s._id}')" id="svc-\${s._id}">
            <div class="flex justify-between items-center">
              <h4 class="font-bold text-[var(--dark)]">\${s.name}</h4>
              <span class="font-extrabold text-sm text-[var(--lavender)]">$\${s.price}</span>
            </div>
            <p class="text-xs text-gray-500 mt-1">\${s.durationMinutes} mins • Gentle care</p>
          </div>\`;
      });
    }
  });

  window.selectService = (id) => {
    document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
    selectServiceStep(id);
  };

  window.selectServiceStep = (id) => {
    bookingData.serviceId = id;
    document.querySelectorAll('[id^="svc-"]').forEach(el => {
      el.style.borderColor = 'transparent';
      el.style.backgroundColor = '#FFFFFF';
    });
    const selected = document.getElementById('svc-' + id);
    if (selected) {
      selected.style.borderColor = 'var(--lavender)';
      selected.style.backgroundColor = 'var(--lavender-soft)';
    }
  };

  const updateSteps = () => {
    for (let i = 1; i <= 4; i++) {
      document.getElementById('step-' + i).classList.add('step-hidden');
      const ind = document.getElementById('ind-' + i);
      if (i < step) {
        ind.className = 'w-11 h-11 rounded-full bg-[var(--lavender)] text-white flex items-center justify-center font-bold text-base shadow-sm';
      } else if (i === step) {
        ind.className = 'w-11 h-11 rounded-full bg-[var(--lavender)] text-white flex items-center justify-center font-bold text-base ring-4 ring-purple-200 shadow-md';
      } else {
        ind.className = 'w-11 h-11 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-base shadow-sm';
      }
    }
    document.getElementById('step-' + step).classList.remove('step-hidden');
    document.getElementById('progress-bar').style.width = ((step - 1) / 3) * 100 + '%';
    
    document.getElementById('btn-prev').style.display = (step > 1 && step < 4) ? 'block' : 'none';
    document.getElementById('btn-next').style.display = step < 4 ? 'block' : 'none';
    document.getElementById('btn-next').textContent = step === 3 ? 'Confirm & Book' : 'Next Step';
  };

  document.getElementById('btn-next').addEventListener('click', async () => {
    const err = document.getElementById('booking-errors');
    err.classList.add('hidden');
    
    if (step === 1 && !bookingData.serviceId) {
      err.textContent = "Please select a dental service to continue."; 
      err.classList.remove('hidden'); 
      return;
    }
    if (step === 2 && (!bookingData.date || !bookingData.time)) {
      err.textContent = "Please select both an appointment date and an available time slot."; 
      err.classList.remove('hidden'); 
      return;
    }
    if (step === 3) {
      bookingData.name = document.getElementById('book-name').value.trim();
      bookingData.email = document.getElementById('book-email').value.trim();
      bookingData.phone = document.getElementById('book-phone').value.trim();
      bookingData.message = document.getElementById('book-msg').value.trim();
      if (!bookingData.name || !bookingData.email || !bookingData.phone) {
        err.textContent = "Please fill in all required contact details."; 
        err.classList.remove('hidden'); 
        return;
      }
      if (!document.getElementById('book-consent').checked) {
        err.textContent = "Please agree to the privacy and booking consent."; 
        err.classList.remove('hidden'); 
        return;
      }
      
      const btn = document.getElementById('btn-next');
      btn.textContent = "Securing Slot..."; 
      btn.disabled = true;
      try {
        const res = await fetch('/api/appointments', {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingData)
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error.message || "Booking reservation failed.");
        
        document.getElementById('booking-ref').textContent = data.data.bookingReference;
        step = 4;
        updateSteps();
        document.getElementById('booking-controls').style.display = 'none';
      } catch (e) {
        err.textContent = e.message; 
        err.classList.remove('hidden');
      } finally {
        btn.textContent = "Confirm & Book"; 
        btn.disabled = false;
      }
      return;
    }
    step++; 
    updateSteps();
  });

  document.getElementById('btn-prev').addEventListener('click', () => { 
    step--; 
    updateSteps(); 
  });

  // Fetch Real Backend Availability
  dateInput.addEventListener('change', async (e) => {
    const date = e.target.value;
    bookingData.date = date;
    bookingData.time = '';
    const ts = document.getElementById('time-slots');
    ts.innerHTML = '<span class="text-gray-500 font-medium">Checking available slots...</span>';
    try {
      const res = await fetch(\`/api/availability?date=\${date}\`);
      const data = await res.json();
      ts.innerHTML = '';
      if (!data.success || data.data.length === 0) {
        ts.innerHTML = '<p class="col-span-full text-rose-600 font-bold p-3 bg-rose-50 rounded-xl">No slots available on this date or the clinic is closed. Please pick another day.</p>';
        return;
      }
      data.data.forEach(time => {
        const div = document.createElement('div');
        div.className = 'clay p-3 text-center cursor-pointer font-bold text-[var(--dark)] hover:border-[var(--lavender)] border-2 border-transparent bg-white';
        div.textContent = time;
        div.onclick = () => {
          bookingData.time = time;
          document.querySelectorAll('#time-slots div').forEach(el => {
            el.style.borderColor = 'transparent';
            el.style.backgroundColor = '#FFFFFF';
          });
          div.style.borderColor = 'var(--lavender)';
          div.style.backgroundColor = 'var(--lavender-soft)';
        };
        ts.appendChild(div);
      });
    } catch(e) { 
      ts.innerHTML = '<span class="text-rose-500">Error loading availability.</span>'; 
    }
  });

  // Contact Form Submission
  document.getElementById('contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const status = document.getElementById('c-status');
    btn.textContent = "Sending..."; 
    btn.disabled = true; 
    status.classList.add('hidden');
    
    try {
      const res = await fetch('/api/contact', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('c-name').value,
          email: document.getElementById('c-email').value,
          message: document.getElementById('c-msg').value
        })
      });
      const data = await res.json();
      if (data.success) {
        status.textContent = "Your message was sent to Dr. Bennett's team!"; 
        status.className = "text-sm mt-2 text-emerald-400 font-bold";
        e.target.reset();
      } else throw new Error(data.error.message);
    } catch(err) {
      status.textContent = err.message || "Failed to submit message."; 
      status.className = "text-sm mt-2 text-rose-400 font-bold";
    } finally {
      btn.textContent = "Send Inquiry"; 
      btn.disabled = false; 
      status.classList.remove('hidden');
    }
  });
</script>
</body>
</html>`;

// --- MAIN HANDLER ---
export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

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
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendJson(res, 400, { success: false, error: { message: "Invalid date format." } });
        
        const dayOfWeek = new Date(date).getDay();
        if (dayOfWeek === 0) return sendJson(res, 200, { success: true, data: [] }); // Closed on Sundays
        
        const allSlots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"];
        const slots = dayOfWeek === 6 ? allSlots.slice(0, 7) : allSlots; // Sat: 9 AM–2 PM

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
          return sendJson(res, 400, { success: false, error: { message: "Missing required booking details." } });
        }
        
        const ip = req.headers['x-forwarded-for'] || 'unknown';
        if (!(await rateLimit(db, ip))) return sendJson(res, 429, { success: false, error: { message: "Rate limit reached. Please wait a few minutes." } });

        const { ObjectId } = await import('mongodb');
        const service = await db.collection('services').findOne({ _id: new ObjectId(serviceId) });
        if (!service) return sendJson(res, 404, { success: false, error: { message: "Selected service does not exist." } });

        const ref = 'SN-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        try {
          await db.collection('appointments').insertOne({
            bookingReference: ref, 
            patientName: escapeHtml(name), 
            patientEmail: escapeHtml(email), 
            patientPhone: escapeHtml(phone),
            patientMessage: escapeHtml(message), 
            serviceId: service._id, 
            serviceSnapshot: { name: service.name, price: service.price, duration: service.durationMinutes },
            appointmentDate: date, 
            appointmentTime: time, 
            status: 'pending', 
            createdAt: new Date()
          });
          return sendJson(res, 201, { success: true, data: { bookingReference: ref } });
        } catch (err) {
          if (err.code === 11000) return sendJson(res, 409, { success: false, error: { message: "This appointment slot was just taken by another patient. Please pick an alternative time." } });
          throw err;
        }
      }

      if (path === '/api/contact' && method === 'POST') {
        const body = await parseBody(req);
        const ip = req.headers['x-forwarded-for'] || 'unknown';
        if (!(await rateLimit(db, ip))) return sendJson(res, 429, { success: false, error: { message: "Rate limit reached." } });
        
        if (!body.name || !body.email || !body.message) return sendJson(res, 400, { success: false, error: { message: "All contact fields are required." } });
        await db.collection('contactMessages').insertOne({
          name: escapeHtml(body.name), 
          email: escapeHtml(body.email), 
          message: escapeHtml(body.message), 
          read: false, 
          createdAt: new Date()
        });
        return sendJson(res, 201, { success: true, data: {} });
      }

      return sendJson(res, 404, { success: false, error: { message: "Route not found" } });
    } catch (err) {
      console.error(err);
      return sendJson(res, 500, { success: false, error: { message: "Internal server error" } });
    }
  }

  res.setHeader('Content-Type', 'text/html');
  res.send(publicHTML);
}
