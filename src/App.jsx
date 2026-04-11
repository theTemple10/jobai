import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
// Using Groq — 100% free, no credit card, works in Nigeria
// Get your free key at: https://console.groq.com (sign up with email or Google)
const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";      // text tasks
const JSEARCH_API = "https://jsearch.p.rapidapi.com/search";
const JSEARCH_KEY = import.meta.env.VITE_JSEARCH_KEY || "";
const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"; // image CV parsing

// EmailJS — real email delivery, free, no backend needed
const EJS_SERVICE  = import.meta.env.VITE_EMAILJS_SERVICE_ID  || "";
const EJS_TEMPLATE = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "";
const EJS_KEY      = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  || "";

const JOB_BOARDS = [
  { id: "linkedin", name: "LinkedIn", icon: "in", color: "#0077B5", url: "https://www.linkedin.com/jobs/search/?keywords=" },
  { id: "indeed", name: "Indeed", icon: "in", color: "#003A9B", url: "https://www.indeed.com/jobs?q=" },
  { id: "glassdoor", name: "Glassdoor", icon: "gd", color: "#0CAA41", url: "https://www.glassdoor.com/Job/jobs.htm?sc.keyword=" },
  { id: "remoteok", name: "RemoteOK", icon: "rk", color: "#00C853", url: "https://remoteok.com/remote-" },
  { id: "wellfound", name: "Wellfound", icon: "wf", color: "#FB4F14", url: "https://wellfound.com/jobs?q=" },
  { id: "weworkremotely", name: "We Work Remotely", icon: "wr", color: "#4A90D9", url: "https://weworkremotely.com/remote-jobs/search?term=" },
];

const REMOTE_PROFESSIONS = [
  "software", "developer", "engineer", "programmer", "designer", "writer",
  "marketing", "analyst", "data", "product", "manager", "consultant",
  "accountant", "finance", "hr", "recruiter", "content", "seo", "ux", "ui",
  "devops", "cloud", "security", "backend", "frontend", "fullstack", "mobile",
  "qa", "tester", "architect", "scientist", "researcher", "teacher", "tutor",
  "translator", "editor", "photographer", "video", "copywriter", "support",
];

const STEPS = ["Upload CV", "AI Analysis", "Profile", "Job Match", "Apply"];

// ─── UTILITIES ───────────────────────────────────────────────────────────────

// Loads PDF.js from CDN and extracts all text from a PDF file
async function extractPdfText(file) {
  // Dynamically load PDF.js from CDN — no npm install needed
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((item) => item.str).join(" ") + "\n";
  }
  return fullText.trim();
}

// For image CVs: convert to base64 for vision model
const fileToBase64 = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });

const isRemoteEligible = (title = "", skills = []) => {
  const combined = (title + " " + skills.join(" ")).toLowerCase();
  return REMOTE_PROFESSIONS.some((p) => combined.includes(p));
};

const slug = (str) => str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

// ─── TOAST SYSTEM ────────────────────────────────────────────────────────────
let toastId = 0;
const toastListeners = new Set();
const showToast = (message, type = "info", duration = 4500) => {
  const id = ++toastId;
  const toast = { id, message, type, duration };
  toastListeners.forEach((fn) => fn({ action: "add", toast }));
  setTimeout(() => toastListeners.forEach((fn) => fn({ action: "remove", id })), duration);
};

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const handler = ({ action, toast, id }) => {
      if (action === "add") setToasts((p) => [...p, toast]);
      if (action === "remove") setToasts((p) => p.filter((t) => t.id !== id));
    };
    toastListeners.add(handler);
    return () => toastListeners.delete(handler);
  }, []);

  const icons = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" };
  const colors = {
    success: "border-emerald-500 bg-emerald-500/10 text-emerald-300",
    error: "border-red-500 bg-red-500/10 text-red-300",
    info: "border-cyan-500 bg-cyan-500/10 text-cyan-300",
    warning: "border-amber-500 bg-amber-500/10 text-amber-300",
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl ${colors[t.type]}`}
          style={{ animation: "slideInToast 0.3s ease forwards", fontFamily: "'Outfit', sans-serif" }}
        >
          <span className="mt-0.5 text-base font-bold">{icons[t.type]}</span>
          <span className="leading-snug">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── API CALL (Groq — free globally, no credit card ever) ────────────────────
const API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

async function callClaude({ system, userContent, maxTokens = 1000, useVision = false }) {
  if (!API_KEY) {
    throw new Error("Missing API key. Add VITE_GROQ_API_KEY to your .env.local and restart the dev server.");
  }

  // Build message content for Groq (OpenAI-compatible format)
  let messageContent;
  if (typeof userContent === "string") {
    messageContent = userContent;
  } else if (Array.isArray(userContent)) {
    if (useVision) {
      // Vision model — pass image + text as multipart
      messageContent = userContent.map((block) => {
        if (block.type === "text") return { type: "text", text: block.text };
        if (block.type === "image") {
          return {
            type: "image_url",
            image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
          };
        }
        return { type: "text", text: block.text || "" };
      });
    } else {
      // Text-only: flatten everything into one string
      messageContent = userContent.map((b) => b.text || b.cvText || "").join("\n\n");
    }
  }

  const model = useVision ? GROQ_VISION_MODEL : GROQ_MODEL;
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: messageContent });

  const res = await fetch(GROQ_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ─── EMAIL (EmailJS — real delivery, free) ───────────────────────────────────
async function sendEmail({ toEmail, toName, jobTitle, company, board, date, message }) {
  if (!EJS_SERVICE || !EJS_TEMPLATE || !EJS_KEY) {
    console.warn("EmailJS not configured — skipping email.");
    return;
  }
  // Load EmailJS SDK from CDN on first use
  if (!window.emailjs) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    window.emailjs.init({ publicKey: EJS_KEY });
  }
  await window.emailjs.send(EJS_SERVICE, EJS_TEMPLATE, {
    to_email: toEmail,
    to_name:  toName  || "there",
    job_title: jobTitle,
    company,
    board,
    date,
    message,
  });
}
function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                i < current
                  ? "bg-cyan-500 text-black"
                  : i === current
                  ? "bg-cyan-400/20 border-2 border-cyan-400 text-cyan-400"
                  : "bg-white/5 border border-white/10 text-white/30"
              }`}
            >
              {i < current ? "✓" : i + 1}
            </div>
            <span
              className={`text-xs whitespace-nowrap transition-colors duration-300 ${
                i === current ? "text-cyan-400" : i < current ? "text-cyan-600" : "text-white/20"
              }`}
            >
              {s}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="h-px w-10 mx-1 mt-[-10px] transition-colors duration-500"
              style={{ background: i < current ? "#22d3ee" : "rgba(255,255,255,0.08)" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── STEP 0: UPLOAD ───────────────────────────────────────────────────────────
function UploadStep({ onNext }) {
  const [file, setFile] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    const valid = ["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(f.type);
    if (!valid) { showToast("Please upload a PDF or image file", "error"); return; }
    setFile(f);
    showToast(`${f.name} ready for analysis`, "success");
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-xs font-mono mb-4">
          STEP 01 / UPLOAD YOUR CV
        </div>
        <h2 className="text-4xl font-bold text-white mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
          Start Your Job Search
        </h2>
        <p className="text-white/50 text-sm leading-relaxed max-w-md mx-auto">
          Upload your CV and our AI will extract your skills, experience, and suggest the best-matched jobs across top boards.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer mb-6 ${
          dragging ? "border-cyan-400 bg-cyan-400/5 scale-[1.01]" : file ? "border-cyan-500/50 bg-cyan-500/5" : "border-white/10 hover:border-white/25 bg-white/3"
        }`}
        style={{ padding: "3rem 2rem" }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        <div className="text-center">
          {file ? (
            <>
              <div className="text-5xl mb-3">📄</div>
              <div className="text-white font-semibold text-lg">{file.name}</div>
              <div className="text-white/40 text-sm mt-1">{(file.size / 1024).toFixed(0)} KB · Click to replace</div>
            </>
          ) : (
            <>
              <div className="text-5xl mb-4 opacity-40">⬆</div>
              <div className="text-white/70 font-semibold text-lg mb-1">Drop your CV here</div>
              <div className="text-white/30 text-sm">PDF, PNG, JPG supported · Max 10MB</div>
            </>
          )}
        </div>
      </div>

      {/* Optional Prompt */}
      <div className="mb-6">
        <label className="block text-white/60 text-xs font-mono mb-2 uppercase tracking-widest">
          Additional Context (Optional)
        </label>
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. I'm looking for senior roles in fintech, prefer remote, open to relocation to London or Berlin..."
          className="w-full rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/20 text-sm px-4 py-3 resize-none focus:outline-none focus:border-cyan-400/50 focus:bg-white/8 transition-all"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        />
      </div>

      <button
        disabled={!file}
        onClick={() => onNext({ file, prompt })}
        className="w-full py-4 rounded-xl font-bold text-black text-base transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          background: file ? "linear-gradient(135deg, #00D9FF, #0EA5E9)" : "#555",
          boxShadow: file ? "0 0 30px rgba(0,217,255,0.3)" : "none",
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        Analyse CV with AI →
      </button>
    </div>
  );
}

// ─── STEP 1: PARSING ──────────────────────────────────────────────────────────
function ParsingStep({ file, prompt, onDone }) {
  const [status, setStatus] = useState("Reading your CV…");
  const [progress, setProgress] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const stages = [
      { msg: "Reading your CV…", pct: 15 },
      { msg: "Extracting experience & skills…", pct: 40 },
      { msg: "Identifying key competencies…", pct: 65 },
      { msg: "Matching to job categories…", pct: 85 },
      { msg: "Finalising profile…", pct: 95 },
    ];

    let i = 0;
    const tick = setInterval(() => {
      if (i < stages.length) {
        setStatus(stages[i].msg);
        setProgress(stages[i].pct);
        i++;
      }
    }, 700);

    (async () => {
      try {
        const isImage = file.type.startsWith("image/");
        let userContent;

        if (isImage) {
          // Image CV → use vision model with base64
          const base64 = await fileToBase64(file);
          userContent = [
            { type: "image", source: { type: "base64", media_type: file.type, data: base64 } },
            { type: "text", text: `Parse this CV/resume image and return ONLY valid JSON (no markdown, no backticks):
{
  "name": "Full Name",
  "email": "email or null",
  "phone": "phone or null",
  "location": "City, Country or null",
  "title": "Current/Target Job Title",
  "summary": "2-sentence professional summary",
  "skills": ["skill1", "skill2"],
  "experience": [{ "role": "Title", "company": "Company", "duration": "2020-2023", "highlights": ["key achievement"] }],
  "education": [{ "degree": "BSc Computer Science", "institution": "University Name", "year": "2019" }],
  "languages": ["English"],
  "certifications": [],
  "jobTitles": ["5 relevant job titles to search for"],
  "seniority": "Junior|Mid|Senior|Lead|Director",
  "isRemoteEligible": true,
  "industries": ["relevant industries"],
  "keyStrengths": ["strength1", "strength2", "strength3"],
  "salaryExpectation": "estimated range e.g. $40k-$60k"
}
Additional context: ${prompt || "None provided"}` },
          ];
        } else {
          // PDF → extract text client-side with PDF.js, send as plain text
          setStatus("Extracting text from PDF…");
          const cvText = await extractPdfText(file);
          if (!cvText || cvText.length < 50) throw new Error("Could not extract text from PDF. Please try saving it as an image (PNG) and uploading that instead.");
          userContent = [
            {
              type: "text",
              text: `Here is the full text content of a CV/resume. Parse it and return ONLY valid JSON (no markdown, no backticks):
{
  "name": "Full Name",
  "email": "email or null",
  "phone": "phone or null",
  "location": "City, Country or null",
  "title": "Current/Target Job Title",
  "summary": "2-sentence professional summary",
  "skills": ["skill1", "skill2"],
  "experience": [{ "role": "Title", "company": "Company", "duration": "2020-2023", "highlights": ["key achievement"] }],
  "education": [{ "degree": "BSc Computer Science", "institution": "University Name", "year": "2019" }],
  "languages": ["English"],
  "certifications": [],
  "jobTitles": ["5 relevant job titles to search for"],
  "seniority": "Junior|Mid|Senior|Lead|Director",
  "isRemoteEligible": true,
  "industries": ["relevant industries"],
  "keyStrengths": ["strength1", "strength2", "strength3"],
  "salaryExpectation": "estimated range e.g. $40k-$60k"
}

CV TEXT:
${cvText}

Additional context: ${prompt || "None provided"}`,
            },
          ];
        }

        const raw = await callClaude({
          system: "You are an expert CV parser. Return only valid JSON, no markdown fences, no explanation.",
          userContent,
          maxTokens: 1500,
          useVision: isImage,
        });

        clearInterval(tick);
        setProgress(100);
        setStatus("Complete!");

        let parsed;
        try {
          const clean = raw.replace(/```json|```/g, "").trim();
          parsed = JSON.parse(clean);
        } catch {
          throw new Error("Could not parse AI response. Please try again.");
        }

        setTimeout(() => onDone(parsed), 600);
      } catch (err) {
        clearInterval(tick);
        showToast(err.message || "Analysis failed. Please try again.", "error");
        setTimeout(() => onDone(null), 1000);
      }
    })();

    return () => clearInterval(tick);
  }, []);

  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <div className="relative w-24 h-24 mx-auto mb-8">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
          <circle
            cx="48" cy="48" r="40" fill="none" stroke="#00D9FF" strokeWidth="6"
            strokeDasharray={`${2 * Math.PI * 40}`}
            strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-cyan-400 font-bold font-mono text-lg">
          {progress}%
        </div>
      </div>
      <div className="text-white font-semibold text-xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
        AI is Reading Your CV
      </div>
      <div className="text-white/40 text-sm font-mono animate-pulse">{status}</div>
      <div className="mt-8 flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-2 h-2 rounded-full bg-cyan-400" style={{ animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ─── STEP 2: PROFILE ──────────────────────────────────────────────────────────
function ProfileStep({ profile, onNext }) {
  const [p, setP] = useState(profile);
  const remote = isRemoteEligible(p.title, p.skills);

  const Tag = ({ label, onRemove }) => (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/8 border border-white/10 text-white/70 text-xs">
      {label}
      {onRemove && <button onClick={onRemove} className="text-white/30 hover:text-red-400 transition-colors ml-1">×</button>}
    </span>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-xs font-mono mb-3">
          STEP 03 / YOUR PROFILE
        </div>
        <h2 className="text-3xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
          AI-Extracted Profile
        </h2>
        <p className="text-white/40 text-sm mt-2">Review and edit before we find your matches</p>
      </div>

      {/* Header Card */}
      <div
        className="rounded-2xl p-6 mb-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(0,217,255,0.08), rgba(124,58,237,0.08))", border: "1px solid rgba(0,217,255,0.15)" }}
      >
        <div className="flex flex-wrap items-start gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-black flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #00D9FF, #7C3AED)" }}
          >
            {(p.name || "?").charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <input
              value={p.name || ""}
              onChange={(e) => setP({ ...p, name: e.target.value })}
              className="text-xl font-bold text-white bg-transparent border-none outline-none w-full"
              placeholder="Your Name"
              style={{ fontFamily: "'Playfair Display', serif" }}
            />
            <input
              value={p.title || ""}
              onChange={(e) => setP({ ...p, title: e.target.value })}
              className="text-cyan-400 text-sm bg-transparent border-none outline-none w-full"
              placeholder="Job Title"
            />
            <div className="flex flex-wrap gap-3 mt-2 text-white/40 text-xs">
              {p.email && <span>✉ {p.email}</span>}
              {p.location && <span>📍 {p.location}</span>}
              {p.seniority && <span className="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300">{p.seniority}</span>}
              {remote && <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">🌍 Remote Eligible</span>}
            </div>
          </div>
          {p.salaryExpectation && (
            <div className="text-right">
              <div className="text-white/30 text-xs">Est. Salary Range</div>
              <div className="text-cyan-400 font-mono font-bold">{p.salaryExpectation}</div>
            </div>
          )}
        </div>
        {p.summary && (
          <div className="mt-4 pt-4 border-t border-white/8">
            <p className="text-white/60 text-sm leading-relaxed">{p.summary}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Skills */}
        <div className="rounded-2xl p-5 bg-white/3 border border-white/8">
          <div className="text-white/50 text-xs font-mono uppercase tracking-widest mb-3">Skills</div>
          <div className="flex flex-wrap gap-2">
            {(p.skills || []).map((s, i) => (
              <Tag key={i} label={s} onRemove={() => setP({ ...p, skills: p.skills.filter((_, j) => j !== i) })} />
            ))}
          </div>
        </div>

        {/* Key Strengths */}
        <div className="rounded-2xl p-5 bg-white/3 border border-white/8">
          <div className="text-white/50 text-xs font-mono uppercase tracking-widest mb-3">Key Strengths</div>
          <div className="flex flex-col gap-2">
            {(p.keyStrengths || []).map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-white/70">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Experience */}
      {p.experience?.length > 0 && (
        <div className="rounded-2xl p-5 bg-white/3 border border-white/8 mb-4">
          <div className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">Experience</div>
          <div className="space-y-4">
            {p.experience.map((exp, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-px bg-cyan-400/20 flex-shrink-0" />
                <div>
                  <div className="text-white font-semibold text-sm">{exp.role}</div>
                  <div className="text-cyan-400/70 text-xs">{exp.company} · {exp.duration}</div>
                  {exp.highlights?.length > 0 && (
                    <div className="text-white/40 text-xs mt-1">{exp.highlights[0]}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job Titles to Search */}
      <div className="rounded-2xl p-5 bg-cyan-400/5 border border-cyan-400/15 mb-6">
        <div className="text-cyan-400 text-xs font-mono uppercase tracking-widest mb-3">Will Search For</div>
        <div className="flex flex-wrap gap-2">
          {(p.jobTitles || []).map((t, i) => (
            <span key={i} className="px-3 py-1 rounded-full bg-cyan-400/15 border border-cyan-400/25 text-cyan-300 text-xs font-mono">
              {t}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={() => onNext(p)}
        className="w-full py-4 rounded-xl font-bold text-black text-base"
        style={{
          background: "linear-gradient(135deg, #00D9FF, #0EA5E9)",
          boxShadow: "0 0 30px rgba(0,217,255,0.3)",
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        Find My Job Matches →
      </button>
    </div>
  );
}

// ─── STEP 3: JOBS ─────────────────────────────────────────────────────────────
function JobsStep({ profile, onApply }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [location, setLocation] = useState("all");
  const [applied, setApplied] = useState({});
  const [selected, setSelected] = useState(null);
  const done = useRef(false);

  const remote = isRemoteEligible(profile.title, profile.skills);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    generateJobs();
  }, []);

  // Normalise a raw JSearch result into our app's job shape
  const normaliseJob = (item, index) => {
    const boardMap = {
      linkedin: "linkedin", indeed: "indeed", glassdoor: "glassdoor",
      remoteok: "remoteok", wellfound: "wellfound", weworkremotely: "weworkremotely",
    };
    const sourceRaw = (item.job_publisher || "indeed").toLowerCase();
    const board = Object.keys(boardMap).find((k) => sourceRaw.includes(k)) || "indeed";
    const isRemote = item.job_is_remote || false;
    const postedTs = item.job_posted_at_timestamp;
    const postedDays = postedTs
      ? Math.max(1, Math.round((Date.now() / 1000 - postedTs) / 86400))
      : Math.floor(Math.random() * 14) + 1;

    // Calculate a rough match score based on skill overlap
    const jobText = `${item.job_title} ${item.job_description || ""} ${(item.job_highlights?.Qualifications || []).join(" ")}`.toLowerCase();
    const skillMatches = (profile.skills || []).filter((s) => jobText.includes(s.toLowerCase())).length;
    const match = Math.min(98, 65 + skillMatches * 4 + Math.floor(Math.random() * 8));

    return {
      id: item.job_id || `job_${index}`,
      title: item.job_title || "Role",
      company: item.employer_name || "Company",
      location: item.job_is_remote
        ? "Remote"
        : [item.job_city, item.job_country].filter(Boolean).join(", ") || "Location TBC",
      type: item.job_employment_type
        ? item.job_employment_type.replace("_", "-").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
        : "Full-time",
      remote: isRemote,
      salary: item.job_min_salary && item.job_max_salary
        ? `${item.job_salary_currency || "$"}${Math.round(item.job_min_salary / 1000)}k – ${Math.round(item.job_max_salary / 1000)}k`
        : item.job_salary_period ? `${item.job_salary_currency || ""}${item.job_min_salary || ""}${item.job_salary_period}` : "Salary not listed",
      match,
      board,
      applyUrl: item.job_apply_link || "",
      description: item.job_description
        ? item.job_description.slice(0, 180).trim() + "…"
        : "See full listing for details.",
      requirements: (item.job_highlights?.Qualifications || []).slice(0, 3),
      postedDays,
      industry: item.job_publisher || "General",
      urgent: postedDays <= 3,
      tags: [
        isRemote ? "Remote" : "On-site",
        item.job_employment_type === "FULLTIME" ? "Full-time" : item.job_employment_type || "Contract",
      ],
    };
  };

  const generateJobs = async () => {
    // Build search queries from profile job titles
    const queries = (profile.jobTitles || [profile.title]).slice(0, 3);
    const locationQuery = location !== "all" ? ` in ${location}` : "";

    // Add remote query if eligible
    const remoteEligible = isRemoteEligible(profile.title, profile.skills);
    if (remoteEligible) queries.push(`${profile.title} remote`);

    try {
      if (!JSEARCH_KEY) throw new Error("Missing VITE_JSEARCH_KEY in .env.local");

      // Fetch results for each query in parallel
      const results = await Promise.allSettled(
        queries.map((q) =>
          fetch(`${JSEARCH_API}?query=${encodeURIComponent(q + locationQuery)}&num_pages=1&date_posted=month`, {
            headers: {
              "X-RapidAPI-Key": JSEARCH_KEY,
              "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
            },
          }).then((r) => r.json())
        )
      );

      // Flatten, deduplicate by job_id, normalise
      const seen = new Set();
      const allJobs = [];
      results.forEach((r) => {
        if (r.status === "fulfilled" && Array.isArray(r.value?.data)) {
          r.value.data.forEach((item, i) => {
            if (!seen.has(item.job_id)) {
              seen.add(item.job_id);
              allJobs.push(normaliseJob(item, allJobs.length));
            }
          });
        }
      });

      if (allJobs.length === 0) throw new Error("No results returned from JSearch");

      // Sort by match score descending
      allJobs.sort((a, b) => b.match - a.match);
      setJobs(allJobs);
      showToast(`Found ${allJobs.length} real job listings!`, "success");
    } catch (err) {
      showToast(`Job search error: ${err.message?.slice(0, 80)}`, "error");
      console.error("generateJobs error:", err);
      setJobs(sampleJobs(profile));
    } finally {
      setLoading(false);
    }
  };

  const sampleJobs = (p) => [
    { id: "1", title: p.jobTitles?.[0] || "Software Engineer", company: "TechCorp", location: "San Francisco, US", type: "Full-time", remote: true, salary: "$120k–$160k", match: 95, board: "linkedin", applyUrl: "", description: "Build scalable systems.", requirements: ["Python", "AWS", "SQL"], postedDays: 2, industry: "SaaS", urgent: true, tags: ["Remote", "Full-time"] },
    { id: "2", title: p.jobTitles?.[1] || "Senior Developer", company: "GlobalBank", location: "London, UK", type: "Full-time", remote: false, salary: "£80k–£110k", match: 88, board: "indeed", applyUrl: "", description: "Lead development.", requirements: ["Java", "Spring", "CI/CD"], postedDays: 5, industry: "FinTech", urgent: false, tags: ["On-site", "Full-time"] },
    { id: "3", title: p.jobTitles?.[2] || "Backend Developer", company: "Startup Inc", location: "Remote", type: "Contract", remote: true, salary: "$80k–$100k", match: 82, board: "remoteok", applyUrl: "", description: "Work on exciting backend systems.", requirements: ["Node.js", "PostgreSQL", "REST APIs"], postedDays: 7, industry: "Tech", urgent: false, tags: ["Remote", "Contract"] },
  ];

  const boards = [...new Set(jobs.map((j) => j.board))];
  const filtered = jobs.filter((j) => {
    if (remoteOnly && !j.remote) return false;
    if (filter !== "all" && j.board !== filter) return false;
    return true;
  });

  const LOCATIONS = [
    { value: "all", label: "🌍 All Locations" },
    { value: "Nigeria", label: "🇳🇬 Nigeria" },
    { value: "United States", label: "🇺🇸 USA" },
    { value: "United Kingdom", label: "🇬🇧 UK" },
    { value: "Canada", label: "🇨🇦 Canada" },
    { value: "Australia", label: "🇦🇺 Australia" },
    { value: "Germany", label: "🇩🇪 Germany" },
    { value: "Netherlands", label: "🇳🇱 Netherlands" },
    { value: "UAE", label: "🇦🇪 UAE" },
    { value: "South Africa", label: "🇿🇦 South Africa" },
    { value: "Remote", label: "💻 Remote (Anywhere)" },
  ];

  const getBoardColor = (id) => JOB_BOARDS.find((b) => b.id === id)?.color || "#888";
  const getBoardName = (id) => JOB_BOARDS.find((b) => b.id === id)?.name || id;

  const markApplied = (jobId, method) => {
    const job = jobs.find((j) => j.id === jobId);
    setApplied((prev) => ({ ...prev, [jobId]: method }));
    if (job) onApply(job, method); // ← saves to localStorage tracker
    showToast(`Application ${method === "auto" ? "submitted" : "opened"} successfully!`, "success");
  };

  if (loading) {
    return (
      <div className="text-center py-24">
        <div className="text-5xl mb-4 animate-spin">🔍</div>
        <div className="text-white/60 font-mono text-sm">Scanning top job boards…</div>
        <div className="text-white/30 text-xs mt-2 animate-pulse">LinkedIn · Indeed · Glassdoor · RemoteOK</div>
      </div>
    );
  }

  if (selected) {
    return <JobDetail job={selected} profile={profile} onBack={() => setSelected(null)} onApply={(method) => { markApplied(selected.id, method); setApplied((p) => ({...p, [selected.id]: method})); setSelected(null); }} applied={applied[selected.id]} />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            {filtered.length} Job Matches
          </h2>
          <p className="text-white/40 text-sm">Based on your profile · Sorted by match score</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Location picker */}
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm focus:outline-none focus:border-cyan-400/40"
          >
            {LOCATIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>

          {/* Re-search with new location */}
          <button
            onClick={() => { setJobs([]); setLoading(true); done.current = false; generateJobs(); }}
            className="px-4 py-2 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-sm font-medium hover:bg-cyan-400/20 transition-all"
          >
            🔍 Search
          </button>

          {/* Remote toggle — shown for all professions */}
          <button
            onClick={() => setRemoteOnly((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              remoteOnly ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-white/5 border-white/10 text-white/50 hover:border-white/25"
            }`}
          >
            💻 Remote Only
          </button>

          {/* Board filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm focus:outline-none focus:border-cyan-400/40"
          >
            <option value="all">All Boards</option>
            {boards.map((b) => <option key={b} value={b}>{getBoardName(b)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4">
        {filtered.map((job) => (
          <div
            key={job.id}
            className={`rounded-2xl border transition-all duration-200 cursor-pointer group ${
              applied[job.id] ? "opacity-60 border-white/5" : "border-white/8 hover:border-cyan-400/20 hover:bg-white/3"
            }`}
            style={{ background: "rgba(22,27,39,0.8)", padding: "1.25rem 1.5rem" }}
            onClick={() => setSelected(job)}
          >
            <div className="flex flex-wrap gap-4 items-start">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${getBoardColor(job.board)}, ${getBoardColor(job.board)}99)` }}
              >
                {job.company?.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start gap-2 mb-1">
                  <span className="text-white font-semibold group-hover:text-cyan-300 transition-colors">{job.title}</span>
                  {job.urgent && <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs">🔥 Urgent</span>}
                  {applied[job.id] && <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs">✓ Applied</span>}
                </div>
                <div className="text-white/50 text-sm mb-2">{job.company} · {job.location} · {job.type}</div>
                <div className="flex flex-wrap gap-2">
                  {job.remote && <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs">🌍 Remote</span>}
                  {(job.tags || []).map((t) => <span key={t} className="px-2 py-0.5 rounded-full bg-white/5 text-white/40 text-xs">{t}</span>)}
                  <span className="px-2 py-0.5 rounded-full bg-white/5 text-white/40 text-xs">{getBoardName(job.board)}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div
                  className="text-lg font-bold font-mono"
                  style={{ color: job.match >= 90 ? "#00D9FF" : job.match >= 75 ? "#A78BFA" : "#F59E0B" }}
                >
                  {job.match}%
                </div>
                <div className="text-white/30 text-xs">match</div>
                <div className="text-white/50 text-xs mt-1">{job.salary}</div>
                <div className="text-white/25 text-xs">{job.postedDays}d ago</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-white/30">
          <div className="text-4xl mb-3">🔍</div>
          No jobs match your current filters
        </div>
      )}
    </div>
  );
}

// ─── JOB DETAIL & APPLY ───────────────────────────────────────────────────────
function JobDetail({ job, profile, onBack, onApply, applied }) {
  const [tab, setTab] = useState("details");
  const [coverLetter, setCoverLetter] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  // Three-stage apply flow: idle → reviewing → done
  const [applyStage, setApplyStage] = useState("idle");

  const board = JOB_BOARDS.find((b) => b.id === job.board) || JOB_BOARDS[0];
  const searchQuery = encodeURIComponent(`${job.title} ${job.company}`);
  const applyUrl = job.applyUrl || `${board.url}${searchQuery}`;

  const generateCoverLetter = async () => {
    setGenerating(true);
    setTab("coverletter");
    try {
      const letter = await callClaude({
        system: "You are an expert career coach. Write concise, impactful cover letters.",
        userContent: `Write a compelling cover letter for this application:

Job: ${job.title} at ${job.company}
Location: ${job.location}
Job Description: ${job.description}
Requirements: ${(job.requirements || []).join(", ")}

Candidate:
Name: ${profile.name}
Title: ${profile.title}
Skills: ${(profile.skills || []).slice(0, 8).join(", ")}
Experience: ${(profile.experience || []).map((e) => `${e.role} at ${e.company} (${e.duration})`).join("; ")}
Key Strengths: ${(profile.keyStrengths || []).join(", ")}

Write a 3-paragraph cover letter. Professional, specific, compelling. Address to Hiring Manager.`,
        maxTokens: 700,
      });
      setCoverLetter(letter);
      setApplyStage("reviewing");
      showToast("Cover letter ready — review and edit before applying", "success");
    } catch (err) {
      showToast(`Cover letter error: ${err.message?.slice(0, 80)}`, "error");
      console.error("Cover letter error:", err);
    } finally {
      setGenerating(false);
    }
  };

  // Honest one-click assist: opens the real job page + copies cover letter
  // User pastes and submits themselves — no spoofing
  const oneClickApply = async () => {
    if (!coverLetter) { showToast("Generate and review your cover letter first", "warning"); return; }

    // 1. Copy cover letter to clipboard
    try { await navigator.clipboard.writeText(coverLetter); } catch {}

    // 2. Open the real job posting
    window.open(applyUrl, "_blank");

    // 3. Mark as applied
    onApply("assisted");

    // 4. Send real confirmation email
    if (profile.email) {
      setSendingEmail(true);
      try {
        await sendEmail({
          toEmail: profile.email,
          toName:  profile.name,
          jobTitle: job.title,
          company:  job.company,
          board:    board.name,
          date:     new Date().toLocaleDateString(),
          message:  `You used JobAI's one-click assist to apply for ${job.title} at ${job.company}. Your cover letter was copied to your clipboard and the job page was opened for you to paste and submit.`,
        });
        showToast(`✓ Job page opened & cover letter copied! Confirmation sent to ${profile.email}`, "success");
      } catch {
        showToast("✓ Job page opened & cover letter copied! (Email delivery failed — check EmailJS config)", "warning");
      } finally {
        setSendingEmail(false);
      }
    } else {
      showToast("✓ Job page opened & cover letter copied to clipboard — paste it and submit!", "success");
    }

    setApplyStage("done");
  };

  // Plain manual apply — opens job page, marks applied, sends email
  const manualApply = async () => {
    window.open(applyUrl, "_blank");
    onApply("manual");
    if (profile.email) {
      try {
        await sendEmail({
          toEmail: profile.email,
          toName:  profile.name,
          jobTitle: job.title,
          company:  job.company,
          board:    board.name,
          date:     new Date().toLocaleDateString(),
          message:  `You opened the application for ${job.title} at ${job.company} on ${board.name}.`,
        });
      } catch {}
    }
    showToast(`Opened ${board.name} — good luck!`, "info");
  };

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-white/40 hover:text-white/80 text-sm mb-6 transition-colors">
        ← Back to jobs
      </button>

      {/* Job Header */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{ background: "linear-gradient(135deg, rgba(0,217,255,0.06), rgba(124,58,237,0.06))", border: "1px solid rgba(0,217,255,0.12)" }}
      >
        <div className="flex flex-wrap gap-4 items-start mb-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-bold text-black"
            style={{ background: `linear-gradient(135deg, ${board.color}, ${board.color}99)` }}
          >
            {job.company?.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white mb-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>{job.title}</h2>
            <div className="text-cyan-400/80 text-sm">{job.company} · {job.location}</div>
            <div className="flex flex-wrap gap-2 mt-2">
              {job.remote && <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs">🌍 Remote</span>}
              <span className="px-2 py-0.5 rounded-full bg-white/8 text-white/60 text-xs">{job.type}</span>
              <span className="px-2 py-0.5 rounded-full bg-white/8 text-white/60 text-xs">{board.name}</span>
              {job.urgent && <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs">🔥 Urgent</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold font-mono" style={{ color: job.match >= 90 ? "#00D9FF" : job.match >= 75 ? "#A78BFA" : "#F59E0B" }}>
              {job.match}%
            </div>
            <div className="text-white/30 text-xs">match score</div>
            <div className="text-white/60 text-sm font-mono mt-1">{job.salary}</div>
          </div>
        </div>

        {/* Apply actions */}
        {applied ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-sm">
            ✓ You already applied to this position
          </div>
        ) : applyStage === "done" ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-sm">
            ✓ Application assisted — job page opened, cover letter copied to clipboard
          </div>
        ) : applyStage === "reviewing" ? (
          // Stage 2: cover letter is ready, show final action buttons
          <div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm mb-3">
              ✦ Review your cover letter in the tab below, then apply
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={generateCoverLetter}
                disabled={generating}
                className="px-5 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-500/30 transition-all disabled:opacity-50"
              >
                {generating ? "Regenerating…" : "↺ Regenerate"}
              </button>
              <button
                onClick={manualApply}
                className="px-5 py-2.5 rounded-xl bg-white/8 border border-white/12 text-white/70 text-sm font-medium hover:bg-white/12 transition-all"
              >
                ↗ Open Job Page Only
              </button>
              <button
                onClick={oneClickApply}
                disabled={sendingEmail}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-black text-sm font-bold transition-all"
                style={{ background: "linear-gradient(135deg, #00D9FF, #0EA5E9)", boxShadow: "0 0 20px rgba(0,217,255,0.3)" }}
              >
                {sendingEmail ? "Sending email…" : "⚡ One-Click Assist"}
              </button>
            </div>
            <p className="text-white/25 text-xs mt-3">
              ⚡ One-Click Assist opens the real job page + copies your cover letter to clipboard + sends you a confirmation email. You paste and submit — nothing is submitted without you.
            </p>
          </div>
        ) : (
          // Stage 1: no cover letter yet
          <div className="flex flex-wrap gap-3">
            <button
              onClick={generateCoverLetter}
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-500/30 transition-all disabled:opacity-50"
            >
              {generating ? "✦ Generating cover letter…" : "✦ Generate AI Cover Letter"}
            </button>
            <button
              onClick={manualApply}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/8 border border-white/12 text-white/70 text-sm font-medium hover:bg-white/12 transition-all"
            >
              ↗ Apply on {board.name}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white/3 rounded-xl p-1">
        {["details", "requirements", "coverletter"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              tab === t ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            {t === "coverletter" ? "Cover Letter" : t}
            {t === "coverletter" && coverLetter && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-white/3 border border-white/8 p-6">
        {tab === "details" && (
          <div>
            <h3 className="text-white/50 text-xs font-mono uppercase tracking-widest mb-3">About the Role</h3>
            <p className="text-white/70 text-sm leading-relaxed mb-6">{job.description}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[["Industry", job.industry], ["Posted", `${job.postedDays} days ago`], ["Location", job.location], ["Type", job.type]].map(([k, v]) => (
                <div key={k} className="bg-white/3 rounded-xl p-3">
                  <div className="text-white/30 text-xs mb-1">{k}</div>
                  <div className="text-white/80">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "requirements" && (
          <div>
            <h3 className="text-white/50 text-xs font-mono uppercase tracking-widest mb-3">Requirements</h3>
            <div className="space-y-2">
              {(job.requirements || []).map((r, i) => {
                const matches = profile.skills?.some((s) => s.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(s.toLowerCase()));
                return (
                  <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm ${matches ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" : "bg-white/3 border border-white/8 text-white/60"}`}>
                    <span>{matches ? "✓" : "○"}</span>
                    {r}
                    {matches && <span className="text-emerald-400/60 text-xs ml-auto">You have this</span>}
                  </div>
                );
              })}
              {(job.requirements || []).length === 0 && <p className="text-white/30 text-sm">No requirements listed — check the full posting.</p>}
            </div>
          </div>
        )}
        {tab === "coverletter" && (
          <div>
            <h3 className="text-white/50 text-xs font-mono uppercase tracking-widest mb-3">
              AI Cover Letter {coverLetter && <span className="text-cyan-400 ml-1">— editable</span>}
            </h3>
            {coverLetter ? (
              <>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={14}
                  className="w-full bg-white/3 border border-white/8 rounded-xl text-white/80 text-sm leading-relaxed p-4 resize-none focus:outline-none focus:border-cyan-400/30"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                />
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={() => { navigator.clipboard.writeText(coverLetter); showToast("Copied to clipboard!", "success"); }}
                    className="px-4 py-2 rounded-xl bg-white/8 text-white/60 text-sm hover:bg-white/12 transition-all"
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={generateCoverLetter}
                    disabled={generating}
                    className="px-4 py-2 rounded-xl bg-violet-500/20 text-violet-300 text-sm hover:bg-violet-500/30 transition-all disabled:opacity-50"
                  >
                    {generating ? "Regenerating…" : "↺ Regenerate"}
                  </button>
                  {applyStage === "reviewing" && (
                    <button
                      onClick={oneClickApply}
                      disabled={sendingEmail}
                      className="ml-auto px-4 py-2 rounded-xl text-black text-sm font-bold"
                      style={{ background: "linear-gradient(135deg, #00D9FF, #0EA5E9)" }}
                    >
                      {sendingEmail ? "Sending…" : "⚡ Apply Now"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-white/30">
                <div className="text-3xl mb-3">✦</div>
                <p className="text-sm mb-4">Generate a cover letter to see it here — you can edit it before applying</p>
                <button
                  onClick={generateCoverLetter}
                  disabled={generating}
                  className="px-6 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm hover:bg-violet-500/30 transition-all"
                >
                  {generating ? "Generating…" : "Generate Now"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TRACKER PANEL ────────────────────────────────────────────────────────────
function TrackerPanel({ applications, onClose }) {
  const statuses = { manual: "Opened listing", assisted: "One-click assisted" };
  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm h-full overflow-y-auto"
        style={{ background: "#0D1117", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>Applications</h3>
            <button onClick={onClose} className="text-white/40 hover:text-white text-xl transition-colors">×</button>
          </div>
          {applications.length === 0 ? (
            <div className="text-center py-12 text-white/30 text-sm">No applications yet</div>
          ) : (
            <div className="space-y-3">
              {applications.map((app, i) => (
                <div key={i} className="rounded-xl bg-white/3 border border-white/8 p-4">
                  <div className="text-white font-semibold text-sm">{app.title}</div>
                  <div className="text-white/50 text-xs">{app.company}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${app.method === "auto" ? "bg-cyan-500/20 text-cyan-300" : "bg-violet-500/20 text-violet-300"}`}>
                      {statuses[app.method]}
                    </span>
                    <span className="text-white/25 text-xs">{app.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
// Tiny localStorage helpers
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
const load = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

export default function App() {
  const [step, setStep] = useState(() => load("jobai_step", 0));
  const [uploadData, setUploadData] = useState(null);
  const [profile, setProfile] = useState(() => load("jobai_profile", null));
  const [applications, setApplications] = useState(() => load("jobai_applications", []));
  const [showTracker, setShowTracker] = useState(false);

  const handleUpload = (data) => {
    setUploadData(data);
    setStep(1);
    showToast("Uploading and analysing your CV…", "info");
  };

  const handleParsed = (parsedProfile) => {
    if (!parsedProfile) { setStep(0); return; }
    setProfile(parsedProfile);
    save("jobai_profile", parsedProfile);
    setStep(2);
    save("jobai_step", 2);
    showToast(`Profile built for ${parsedProfile.name || "you"}!`, "success");
  };

  const handleProfileDone = (p) => {
    setProfile(p);
    save("jobai_profile", p);
    setStep(3);
    save("jobai_step", 3);
    showToast("Finding your best job matches…", "info");
  };

  const handleApply = (job, method) => {
    const app = {
      title: job.title,
      company: job.company,
      method,
      date: new Date().toLocaleDateString(),
      board: job.board,
      applyUrl: job.applyUrl || "",
    };
    setApplications((prev) => {
      const updated = [app, ...prev];
      save("jobai_applications", updated);
      if (updated.length === 1) showToast("Application tracker updated!", "info");
      return updated;
    });
  };

  // Let user start fresh — clears everything
  const handleReset = () => {
    ["jobai_step", "jobai_profile", "jobai_applications"].forEach((k) => localStorage.removeItem(k));
    setStep(0);
    setProfile(null);
    setApplications([]);
    setUploadData(null);
    showToast("Started fresh — upload a new CV anytime.", "info");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Outfit:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080A0F; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        @keyframes slideInToast { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        select option { background: #161B27; color: white; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,217,255,0.06) 0%, transparent 60%), #080A0F",
          fontFamily: "'Outfit', sans-serif",
          color: "white",
        }}
      >
        {/* Navbar */}
        <nav
          className="flex items-center justify-between px-6 py-4 sticky top-0 z-30"
          style={{ background: "rgba(8,10,15,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-black"
              style={{ background: "linear-gradient(135deg, #00D9FF, #7C3AED)" }}
            >
              J
            </div>
            <span className="font-bold text-white text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>JobAI</span>
            <span className="text-white/20 text-xs hidden sm:block">by AI</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex gap-2 text-xs text-white/30 items-center">
              {JOB_BOARDS.slice(0, 4).map((b) => (
                <span key={b.id} className="px-2 py-1 rounded-md bg-white/4 border border-white/6" style={{ color: b.color + "99" }}>
                  {b.name}
                </span>
              ))}
            </div>
            {step > 0 && (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all bg-white/4 border border-white/8 hover:border-red-400/30 text-white/30 hover:text-red-400"
              >
                ↺ Fresh Start
              </button>
            )}
            <button
              onClick={() => setShowTracker(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all bg-white/6 border border-white/10 hover:border-white/25 text-white/60 hover:text-white"
            >
              📋 {applications.length > 0 && <span className="text-cyan-400 font-bold">{applications.length}</span>} Applications
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="px-4 py-10 max-w-5xl mx-auto fade-in">
          <StepIndicator current={step} />

          {step === 0 && <UploadStep onNext={handleUpload} />}
          {step === 1 && uploadData && (
            <ParsingStep file={uploadData.file} prompt={uploadData.prompt} onDone={handleParsed} />
          )}
          {/* If step=1 but uploadData is gone (page refresh during parse), fall back to upload */}
          {step === 1 && !uploadData && <UploadStep onNext={handleUpload} />}
          {step === 2 && profile && <ProfileStep profile={profile} onNext={handleProfileDone} />}
          {step === 3 && profile && (
            <JobsStep
              profile={profile}
              onApply={(job, method) => handleApply(job, method)}
            />
          )}
          {/* If step=2 or 3 but profile lost somehow, go back to upload */}
          {(step === 2 || step === 3) && !profile && <UploadStep onNext={handleUpload} />}
        </main>

        {/* Footer */}
        <footer className="text-center py-8 text-white/15 text-xs border-t border-white/5 mt-8">
          JobAI · Powered by Groq AI (Free) · Searches LinkedIn, Indeed, Glassdoor, RemoteOK, Wellfound & more
        </footer>

        {showTracker && <TrackerPanel applications={applications} onClose={() => setShowTracker(false)} />}
        <ToastContainer />
      </div>
    </>
  );
}
