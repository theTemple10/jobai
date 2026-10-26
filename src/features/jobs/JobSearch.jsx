import { useState, useEffect, useRef, useCallback } from "react";
import { normalizeProfile } from "./jobs.js";
import { requestAI } from "../../shared/lib/ai.js";
import JobExplorer from "./JobExplorer.jsx";
import { readStored, readActivity, readJobProfile } from "../../shared/lib/storage.js";
import { extractPdfText, extractDocxText } from "../resume/parseDocument.js";
import { isModuleLoadError, MODULE_LOAD_MESSAGE } from '../../shared/lib/moduleLoading.js';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
// All sensitive keys (Groq, JSearch) live server-side in /api/*.js
// EmailJS public key is intentionally client-side — that's how EmailJS works
const EJS_SERVICE  = import.meta.env.VITE_EMAILJS_SERVICE_ID  || "";
const EJS_TEMPLATE = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "";
const EJS_KEY      = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  || "";

// Proxy endpoints (Vercel serverless functions in /api/)
const EMPTY_PROFILE = {title: "", skills: [], name: ""};

const JOB_BOARDS = [
  { id: "linkedin", name: "LinkedIn", icon: "in", color: "#0077B5", url: "https://www.linkedin.com/jobs/search/?keywords=" },
  { id: "indeed", name: "Indeed", icon: "in", color: "#003A9B", url: "https://www.indeed.com/jobs?q=" },
  { id: "glassdoor", name: "Glassdoor", icon: "gd", color: "#0CAA41", url: "https://www.glassdoor.com/Job/jobs.htm?sc.keyword=" },
  { id: "remoteok", name: "RemoteOK", icon: "rk", color: "#00C853", url: "https://remoteok.com/remote-" },
  { id: "wellfound", name: "Wellfound", icon: "wf", color: "#FB4F14", url: "https://wellfound.com/jobs?q=" },
  { id: "weworkremotely", name: "We Work Remotely", icon: "wr", color: "#4A90D9", url: "https://weworkremotely.com/remote-jobs/search?term=" },
  // Fallback for any publisher JSearch returns that isn't one of the boards
  // above (ZipRecruiter, Trabajo.org, a company's own careers page, etc.)
  // — never silently mislabel these as Indeed.
  { id: "other", name: "Company Site", icon: "co", color: "#6366F1", url: "https://www.google.com/search?q=" },
];

const CV_PARSE_PROMPT = `Parse this CV/resume and return ONLY valid JSON (no markdown, no backticks):
{
  "name": "Full Name",
  "email": "email or null",
  "phone": "phone or null",
  "website": "portfolio or LinkedIn URL, or empty string",
  "projects": [{"name": "Project name", "link": "URL or empty string", "highlights": ["factual contribution"]}],
  "volunteering": [{"role": "Role", "company": "Organisation", "duration": "Dates", "highlights": ["factual contribution"]}],
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
  "industries": ["relevant industries"],
  "keyStrengths": ["strength1", "strength2", "strength3"],
  "salaryExpectation": null
}`;

const STEPS = ["Upload CV", "Analysis", "Profile", "Explore & prepare"];

// ─── UTILITIES ───────────────────────────────────────────────────────────────

// For image CVs: convert to base64 for vision model
const fileToBase64 = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });

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
    info: "border-indigo-500 bg-indigo-500/10 text-indigo-300",
    warning: "border-amber-500 bg-amber-500/10 text-amber-300",
  };

  return (
    <div role="status" aria-live="polite" className="toast-container fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
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

// ─── OPTIONAL EMAIL (EmailJS) ───────────────────────────────────
async function sendEmail({ toEmail, toName, jobTitle, company, board, date, message }) {
  if (!EJS_SERVICE || !EJS_TEMPLATE || !EJS_KEY) {
    console.warn("EmailJS not configured — skipping email.");
    return false;
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
  return true;
}
function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10 overflow-x-auto">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                i < current
                  ? "bg-indigo-500 text-white"
                  : i === current
                  ? "bg-indigo-400/20 border-2 border-indigo-400 text-indigo-400"
                  : "bg-ink/5 border border-ink/10 text-ink/30"
              }`}
            >
              {i < current ? "✓" : i + 1}
            </div>
            <span
              className={`text-xs whitespace-nowrap transition-colors duration-300 ${
                i === current ? "text-indigo-400" : i < current ? "text-indigo-600" : "text-ink/20"
              }`}
            >
              {s}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="h-px w-4 sm:w-10 mx-1 mt-[-10px] transition-colors duration-500"
              style={{ background: i < current ? "#818CF8" : "var(--border-soft)" }}
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
  const [consent, setConsent] = useState(false);
  const fileRef = useRef();

  const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const handleFile = (f) => {
    if (!f) return;
    const validType = ["application/pdf", DOCX_TYPE, "image/png", "image/jpeg", "image/webp"].includes(f.type);
    // Some browsers/OSes report an empty or generic MIME type for .docx —
    // fall back to the file extension so those uploads aren't rejected.
    const validExt = /\.(pdf|docx|png|jpe?g|webp)$/i.test(f.name);
    if (f.name.toLowerCase().endsWith(".doc")) {
      showToast("Legacy .doc isn't supported — please save as .docx or PDF", "error");
      return;
    }
    if (!validType && !validExt) { showToast("Please upload a PDF, Word (.docx), or image file", "error"); return; }
    if (f.size > 10 * 1024 * 1024) {showToast("Please use a file smaller than 10MB", "error"); return;}
    if ((f.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(f.name)) && f.size > 3 * 1024 * 1024) {showToast("Please use an image smaller than 3MB", "error"); return;}
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
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-400/10 border border-indigo-400/20 text-indigo-400 text-xs font-mono mb-4">
          STEP 01 / UPLOAD YOUR CV
        </div>
        <h2 className="text-4xl font-bold text-ink mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
          Start Your Job Search
        </h2>
        <p className="text-ink/50 text-sm leading-relaxed max-w-md mx-auto">
          Bring in your skills and experience, review what was extracted, then explore roles with a clearer starting point.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer mb-6 ${
          dragging ? "border-indigo-400 bg-indigo-400/5 scale-[1.01]" : file ? "border-indigo-500/50 bg-indigo-500/5" : "border-ink/10 hover:border-ink/25 bg-ink/3"
        }`}
        style={{ padding: "3rem 2rem" }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button" tabIndex={0} aria-label="Choose a CV file"
        onKeyDown={(e) => {if (["Enter", " "].includes(e.key)) {e.preventDefault(); fileRef.current?.click();}}}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".pdf,.docx,image/*" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        <div className="text-center">
          {file ? (
            <>
              <div className="text-5xl mb-3">📄</div>
              <div className="text-ink font-semibold text-lg">{file.name}</div>
              <div className="text-ink/40 text-sm mt-1">{(file.size / 1024).toFixed(0)} KB · Click to replace</div>
            </>
          ) : (
            <>
              <div className="text-5xl mb-4 opacity-40">⬆</div>
              <div className="text-ink/70 font-semibold text-lg mb-1">Drop your CV here</div>
              <div className="text-ink/30 text-sm">PDF / Word up to 10MB · PNG / JPG / WebP up to 3MB</div>
            </>
          )}
        </div>
      </div>

      {/* Optional Prompt */}
      <div className="mb-6">
        <label className="block text-ink/80 text-xs font-mono mb-2 uppercase tracking-widest">
          Additional Context (Optional)
        </label>
        <textarea
          aria-label="Additional context" rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. I'm looking for senior roles in fintech, prefer remote, open to relocation to London or Berlin..."
          className="w-full rounded-xl border border-ink/10 bg-ink/5 text-ink placeholder-ink/20 text-sm px-4 py-3 resize-none focus:outline-none focus:border-indigo-400/50 focus:bg-ink/8 transition-all"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        />
      </div>

      <label className="consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I agree to send this CV’s text or image to the AI provider for analysis. The extracted profile will be saved on this device.</label>
      <button
        disabled={!file || !consent}
        onClick={() => onNext({ file, prompt })}
        className="w-full py-4 rounded-xl font-bold text-white text-base transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          background: file ? "linear-gradient(135deg, #6366F1, #4F46E5)" : "var(--bg-disabled)",
          boxShadow: file ? "0 0 30px rgba(99,102,241,0.3)" : "none",
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
  useEffect(() => {
    let active = true;
    let resultTimer;
    const controller = new AbortController();

    (async () => {
      try {
        const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name);
        const isDocx = file.name.toLowerCase().endsWith(".docx") ||
          file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        let userContent;

        if (isImage) {
          // Image CV → use vision model with base64
          const base64 = await fileToBase64(file);
          userContent = [
            { type: "image_url", image_url: { url: `data:${file.type || (file.name.toLowerCase().endsWith(".png") ? "image/png" : file.name.toLowerCase().endsWith(".webp") ? "image/webp" : "image/jpeg")};base64,${base64}` } },
            { type: "text", text: `${CV_PARSE_PROMPT}
Additional context: ${prompt || "None provided"}` },
          ];
        } else {
          // PDF or DOCX → extract text client-side, send as plain text
          let cvText;
          if (isDocx) {
            setStatus("Extracting text from Word document…");
            cvText = await extractDocxText(file);
            if (!cvText || cvText.length < 50) throw new Error("Could not extract text from this Word document. Please try saving it as a PDF and uploading that instead.");
          } else {
            setStatus("Extracting text from PDF…");
            cvText = await extractPdfText(file);
            if (!cvText || cvText.length < 50) throw new Error("Could not extract text from PDF. Please try saving it as an image (PNG) and uploading that instead.");
          }
          userContent = `${CV_PARSE_PROMPT}

CV TEXT:
${cvText}

Additional context: ${prompt || "None provided"}`;
        }

        if (!active) return;
        setStatus("AI is organizing the extracted information…");
        const raw = await requestAI({
          operation: "parse",
          messages: [{role: "user", content: userContent}],
          useVision: isImage,
        }, controller.signal);

        if (!active) return;
        setProgress(100);
        setStatus("Complete!");

        let parsed;
        try {
          const clean = raw.replace(/```json|```/g, "").trim();
          parsed = normalizeProfile(JSON.parse(clean));
        } catch {
          throw new Error("Could not parse AI response. Please try again.");
        }

        resultTimer = setTimeout(() => {if (active) onDone(parsed);}, 600);
      } catch (err) {
        if (!active) return;
        showToast(isModuleLoadError(err) ? MODULE_LOAD_MESSAGE : err.message || "Analysis failed. Please try again.", "error");
        resultTimer = setTimeout(() => {if (active) onDone(null);}, 1000);
      }
    })();

    return () => {active = false; controller.abort(); clearTimeout(resultTimer);};
  }, [file, prompt, onDone]);

  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <div className="relative w-24 h-24 mx-auto mb-8">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="40" fill="none" style={{ stroke: "var(--border-soft)" }} strokeWidth="6" />
          <circle
            cx="48" cy="48" r="40" fill="none" stroke="#6366F1" strokeWidth="6"
            strokeDasharray={`${2 * Math.PI * 40}`}
            strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-indigo-400 font-bold font-mono text-lg">
          {progress === 100 ? "✓" : "✦"}
        </div>
      </div>
      <div className="text-ink font-semibold text-xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
        AI is Reading Your CV
      </div>
      <div className="text-ink/40 text-sm font-mono animate-pulse">{status}</div>
      <div className="mt-8 flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-2 h-2 rounded-full bg-indigo-400" style={{ animation: `cvBounce 1.2s ${i * 0.2}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ─── STEP 2: PROFILE ──────────────────────────────────────────────────────────
const Tag = ({ label, onRemove }) => (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-ink/8 border border-ink/10 text-ink/70 text-xs">
      {label}
      {onRemove && <button aria-label={`Remove ${label}`} onClick={onRemove} className="text-ink/30 hover:text-red-400 transition-colors ml-1">×</button>}
    </span>
  );


function ProfileStep({ profile, onNext }) {
  const [p, setP] = useState(profile);



  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-400/10 border border-indigo-400/20 text-indigo-400 text-xs font-mono mb-3">
          YOUR STARTING POINT
        </div>
        <h2 className="text-3xl font-bold text-ink" style={{ fontFamily: "'Playfair Display', serif" }}>
          A profile to build on.
        </h2>
        <p className="text-ink/40 text-sm mt-2">Review and edit before we find your matches</p>
      </div>

      {/* Header Card */}
      <div
        className="rounded-2xl p-6 mb-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(124,58,237,0.08))", border: "1px solid rgba(99,102,241,0.15)" }}
      >
        <div className="flex flex-wrap items-start gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6366F1, #7C3AED)" }}
          >
            {(p.name || "?").charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <input
              value={p.name || ""}
              onChange={(e) => setP({ ...p, name: e.target.value })}
              className="text-xl font-bold text-ink bg-transparent border-none outline-none w-full"
              aria-label="Your name" placeholder="Your Name"
              style={{ fontFamily: "'Playfair Display', serif" }}
            />
            <input
              value={p.title || ""}
              onChange={(e) => setP({ ...p, title: e.target.value, jobTitles: [e.target.value] })}
              className="text-indigo-400 text-sm bg-transparent border-none outline-none w-full"
              aria-label="Target job title" placeholder="Job Title"
            />
            <div className="flex flex-wrap gap-3 mt-2 text-ink/40 text-xs">
              {p.email && <span>✉ {p.email}</span>}
              {p.location && <span>📍 {p.location}</span>}
              {p.seniority && <span className="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300">{p.seniority}</span>}

            </div>
          </div>

        </div>
        {p.summary && (
          <div className="mt-4 pt-4 border-t border-ink/8">
            <p className="text-ink/60 text-sm leading-relaxed">{p.summary}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Skills */}
        <div className="rounded-2xl p-5 bg-ink/3 border border-ink/8">
          <div className="text-ink/50 text-xs font-mono uppercase tracking-widest mb-3">Skills</div>
          <div className="flex flex-wrap gap-2">
            {(p.skills || []).map((s, i) => (
              <Tag key={i} label={s} onRemove={() => setP({ ...p, skills: p.skills.filter((_, j) => j !== i) })} />
            ))}
          </div>
        </div>

        {/* Key Strengths */}
        <div className="rounded-2xl p-5 bg-ink/3 border border-ink/8">
          <div className="text-ink/50 text-xs font-mono uppercase tracking-widest mb-3">Key Strengths</div>
          <div className="flex flex-col gap-2">
            {(p.keyStrengths || []).map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-ink/70">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Experience */}
      {p.experience?.length > 0 && (
        <div className="rounded-2xl p-5 bg-ink/3 border border-ink/8 mb-4">
          <div className="text-ink/50 text-xs font-mono uppercase tracking-widest mb-4">Experience</div>
          <div className="space-y-4">
            {p.experience.map((exp, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-px bg-indigo-400/20 flex-shrink-0" />
                <div>
                  <div className="text-ink font-semibold text-sm">{exp.role}</div>
                  <div className="text-indigo-400/70 text-xs">{exp.company} · {exp.duration}</div>
                  {exp.highlights?.length > 0 && (
                    <div className="text-ink/40 text-xs mt-1">{exp.highlights[0]}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job Titles to Search */}
      <div className="rounded-2xl p-5 bg-indigo-400/5 border border-indigo-400/15 mb-6">
        <div className="text-indigo-400 text-xs font-mono uppercase tracking-widest mb-3">Will Search For</div>
        <div className="flex flex-wrap gap-2">
          {(p.jobTitles || []).map((t, i) => (
            <span key={i} className="px-3 py-1 rounded-full bg-indigo-400/15 border border-indigo-400/25 text-indigo-300 text-xs font-mono">
              {t}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={() => onNext(p)}
        className="w-full py-4 rounded-xl font-bold text-white text-base"
        style={{
          background: "linear-gradient(135deg, #6366F1, #4F46E5)",
          boxShadow: "0 0 30px rgba(99,102,241,0.3)",
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        Explore jobs for this profile →
      </button>
    </div>
  );
}

// ─── STEP 3: JOBS ─────────────────────────────────────────────────────────────
// ─── JOB DETAIL & APPLY ───────────────────────────────────────────────────────
function JobDetail({ job, profile, onBack, onApply, applied }) {
  const [tab, setTab] = useState("details");
  const [coverLetter, setCoverLetter] = useState(() => load(`jobai_letter_${job.id}`, ""));
  const [generating, setGenerating] = useState(false);
  const [letterError, setLetterError] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailCopy, setEmailCopy] = useState(false);
  const reviewing = Boolean(coverLetter.trim());

  useEffect(() => {save(`jobai_letter_${job.id}`, coverLetter);}, [job.id, coverLetter]);

  const board = JOB_BOARDS.find((b) => b.id === job.board) || JOB_BOARDS.find((b) => b.id === "other");
  const boardName = job.boardLabel || board.name;
  const searchQuery = encodeURIComponent(`${job.title} ${job.company}`);
  const applyUrl = job.applyUrl || `${board.url}${searchQuery}`;

  const generateCoverLetter = async () => {
    setLetterError('');
    if (!profile.name && !profile.experience?.length && !profile.projects?.length) {setLetterError('Add your experience in the CV builder before asking for a letter. We need your facts to write from.'); return;}
    setGenerating(true);
    setTab("coverletter");
    try {
      const letter = await requestAI({
        operation: "coverletter",
        messages: [{role: "user", content: `Write a compelling cover letter for this application:

Job: ${job.title} at ${job.company}
Location: ${job.location}
Job Description: ${job.description}
Requirements: ${(job.requirements || []).join(", ")}

Candidate:
Name: ${profile.name}
Title: ${profile.title}
Skills: ${(profile.skills || []).slice(0, 8).join(", ")}
Experience and evidence: ${JSON.stringify(profile.experience || [])}
Projects: ${JSON.stringify(profile.projects || [])}
Volunteering: ${JSON.stringify(profile.volunteering || [])}
Education: ${JSON.stringify(profile.education || [])}
Certifications: ${(profile.certifications || []).join(", ")}
Languages: ${(profile.languages || []).join(", ")}
Portfolio: ${profile.website || ""}
Key Strengths: ${(profile.keyStrengths || []).join(", ")}

Write a 3-paragraph cover letter. Professional, specific, compelling. Address to Hiring Manager.`}],
      });
      setCoverLetter(letter);
      showToast("Cover letter ready — review and edit before applying", "success");
    } catch (err) {
      setLetterError(err.message || 'The writing service is unavailable. Your draft is still here.');
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

    // Open during the user gesture, before asynchronous clipboard permission.
    window.open(applyUrl, "_blank", "noopener,noreferrer");
    // Copy the reviewed letter.
    try { await navigator.clipboard.writeText(coverLetter); } catch {showToast("Clipboard access failed. Copy the letter from the editable text box.", "warning");}


    // Record that the listing was opened
    onApply("assisted");

    // Send an optional copy of the prepared letter
    if (emailCopy && profile.email) {
      setSendingEmail(true);
      try {
        const delivered = await sendEmail({
          toEmail: profile.email,
          toName:  profile.name,
          jobTitle: job.title,
          company:  job.company,
          board:    boardName,
          date:     new Date().toLocaleDateString(),
          message:  `You prepared a letter for ${job.title} at ${job.company}. Submit it on the employer’s site when you are ready.\n\n${coverLetter}`,
        });
        showToast(`Job page opened. Review the clipboard before pasting. ${delivered ? `Letter emailed to ${profile.email}` : "Email notifications are not connected"}`, "success");
      } catch {
        showToast("Job page opened. Review the clipboard before pasting. (Your email copy could not be delivered.)", "warning");
      } finally {
        setSendingEmail(false);
      }
    } else {
      showToast("Job page opened — copy your letter, paste it, and submit on the employer’s site.", "success");
    }

  };

  // Open the listing and record activity, with an optional email copy.
  const manualApply = async () => {
    window.open(applyUrl, "_blank", "noopener,noreferrer");
    onApply("manual");
    if (emailCopy && profile.email) {
      try {
        await sendEmail({
          toEmail: profile.email,
          toName:  profile.name,
          jobTitle: job.title,
          company:  job.company,
          board:    boardName,
          date:     new Date().toLocaleDateString(),
          message:  `You opened the application for ${job.title} at ${job.company} on ${boardName}.`,
        });
      } catch { /* Storage or optional notifications may be unavailable. */ }
    }
    showToast(`Opened ${boardName} — good luck!`, "info");
  };

  return (
    <div className="job-detail max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-ink/40 hover:text-ink/80 text-sm mb-6 transition-colors">
        ← Back to jobs
      </button>

      {/* Job Header */}
      <div
        className="job-detail-card rounded-2xl p-6 mb-6"
        style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(124,58,237,0.06))", border: "1px solid rgba(99,102,241,0.12)" }}
      >
        <div className="job-detail-heading">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-bold text-white"
            style={{ background: "#0b1e3d" }}
          >
            {job.company?.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-ink mb-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>{job.title}</h2>
            <div className="text-indigo-400/80 text-sm">{job.company} · {job.location}</div>
            <div className="flex flex-wrap gap-2 mt-2">
              {job.remote && <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs">Remote · check eligibility</span>}
              <span className="px-2 py-0.5 rounded-full bg-ink/8 text-ink/60 text-xs">{job.type}</span>
              <span className="px-2 py-0.5 rounded-full bg-ink/8 text-ink/60 text-xs">{boardName}</span>
              {job.urgent && <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs">🔥 Urgent</span>}
            </div>
          </div>
          <div className="job-detail-coverage">
            <div className="text-2xl font-bold font-mono" style={{ color: job.match >= 90 ? "var(--match-hi)" : job.match >= 75 ? "var(--match-mid)" : "#F59E0B" }}>
              {job.match === null ? "—" : `${job.match}%`}
            </div>
            <div className="text-ink/30 text-xs">listed skill coverage</div>
            <div className="text-ink/60 text-sm font-mono mt-1">{job.salary}</div>
          </div>
        </div>

        {/* Apply actions */}
        {applied ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-sm">
            {applied === "submitted" ? "✓ You confirmed that you submitted this application." : "↗ You opened this listing. Submission happens on the employer’s site."}
          </div>
        ) : reviewing ? (
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
                className="px-5 py-2.5 rounded-xl bg-ink/8 border border-ink/12 text-ink/70 text-sm font-medium hover:bg-ink/12 transition-all"
              >
                ↗ Open Job Page Only
              </button>
              <button
                onClick={oneClickApply}
                disabled={sendingEmail}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all"
                style={{ background: "linear-gradient(135deg, #6366F1, #4F46E5)", boxShadow: "0 0 20px rgba(99,102,241,0.3)" }}
              >
                {sendingEmail ? "Sending email…" : "Open listing & copy letter"}
              </button>
            </div>
            <p className="text-ink/25 text-xs mt-3">
              Open listing & copy letter opens the employer’s page and copies your letter. Email is sent only if you choose it below. You paste and submit — nothing is submitted without you.
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
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ink/8 border border-ink/12 text-ink/70 text-sm font-medium hover:bg-ink/12 transition-all"
            >
              ↗ Apply on {boardName}
            </button>
          </div>
        )}
      </div>

      <p className="form-help">AI letter writing sends your profile and this posting to the writing provider. Drafts are kept on this device. Review the facts before using them.</p>
      {profile.email && <label className="consent"><input type="checkbox" checked={emailCopy} onChange={event => setEmailCopy(event.target.checked)} />Email a copy of my preparation to {profile.email} when I open the listing.</label>}

      {letterError && <div className="notice error" role="alert">{letterError}<div className="button-row"><a className="text-link" href="/builder">Open my CV →</a><a className="text-link" href="/account">My workspace →</a></div></div>}
      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-ink/3 rounded-xl p-1">
        {["details", "requirements", "coverletter"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              tab === t ? "bg-ink/10 text-ink" : "text-ink/40 hover:text-ink/70"
            }`}
          >
            {t === "coverletter" ? "Cover Letter" : t}
            {t === "coverletter" && coverLetter && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-ink/3 border border-ink/8 p-6">
        {tab === "details" && (
          <div>
            <h3 className="text-ink/50 text-xs font-mono uppercase tracking-widest mb-3">About the Role</h3>
            <p className="job-description text-ink/70 text-sm leading-relaxed mb-6">{job.description}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[["Industry", job.industry], ["Posted", job.postedDays === null ? "Not listed" : `${job.postedDays} days ago`], ["Location", job.location], ["Type", job.type]].map(([k, v]) => (
                <div key={k} className="bg-ink/3 rounded-xl p-3">
                  <div className="text-ink/30 text-xs mb-1">{k}</div>
                  <div className="text-ink/80">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "requirements" && (
          <div>
            <h3 className="text-ink/50 text-xs font-mono uppercase tracking-widest mb-3">Requirements</h3>
            <div className="space-y-2">
              {(job.requirements || []).map((r, i) => {
                const matches = profile.skills?.some((s) => s.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(s.toLowerCase()));
                return (
                  <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm ${matches ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" : "bg-ink/3 border border-ink/8 text-ink/60"}`}>
                    <span>{matches ? "✓" : "○"}</span>
                    {r}
                    {matches && <span className="text-emerald-400/60 text-xs ml-auto">You have this</span>}
                  </div>
                );
              })}
              {(job.requirements || []).length === 0 && <p className="text-ink/30 text-sm">No requirements listed — check the full posting.</p>}
            </div>
          </div>
        )}
        {tab === "coverletter" && (
          <div>
            <h3 className="text-ink/50 text-xs font-mono uppercase tracking-widest mb-3">
              AI Cover Letter {coverLetter && <span className="text-indigo-400 ml-1">— editable</span>}
            </h3>
            {coverLetter ? (
              <>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  aria-label="Editable cover letter" rows={14}
                  className="w-full bg-ink/3 border border-ink/8 rounded-xl text-ink/80 text-sm leading-relaxed p-4 resize-none focus:outline-none focus:border-indigo-400/30"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                />
                <div className="flex flex-wrap gap-3 mt-3"><button className="text-link" onClick={() => {if (window.confirm('Delete this letter draft from this device?')) {setCoverLetter(''); localStorage.removeItem(`jobai_letter_${job.id}`);}}}>Delete letter draft</button>
                  <button
                    onClick={async () => { try {await navigator.clipboard.writeText(coverLetter); showToast("Copied to clipboard!", "success");} catch {showToast("Clipboard access failed. Copy the text from the letter above.", "warning");} }}
                    className="px-4 py-2 rounded-xl bg-ink/8 text-ink/60 text-sm hover:bg-ink/12 transition-all"
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
                  {reviewing && (
                    <button
                      onClick={oneClickApply}
                      disabled={sendingEmail}
                      className="ml-auto px-4 py-2 rounded-xl text-white text-sm font-bold"
                      style={{ background: "linear-gradient(135deg, #6366F1, #4F46E5)" }}
                    >
                      {sendingEmail ? "Sending…" : "Open listing & copy letter"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-ink/30">
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
function TrackerPanel({ applications, onClose, onStatusChange, onDelete }) {
  const panelRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    panelRef.current?.focus();
    const keydown = event => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const controls = panelRef.current?.querySelectorAll("button, select");
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {event.preventDefault(); last.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {document.removeEventListener("keydown", keydown); previous?.focus();};
  }, [onClose]);
  const statuses = { manual: "Opened listing", assisted: "Opened with prepared letter" };
  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="tracker-title" tabIndex={-1}
        className="w-full max-w-sm h-full overflow-y-auto"
        style={{ background: "var(--bg-panel)", borderLeft: "1px solid var(--border-soft)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-ink font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif" }} id="tracker-title">Application activity</h3>
            <button aria-label="Close application activity" onClick={onClose} className="text-ink/40 hover:text-ink text-xl transition-colors">×</button>
          </div>
          {applications.length === 0 ? (
            <div className="text-center py-12 text-ink/30 text-sm">No applications yet</div>
          ) : (
            <div className="space-y-3">
              {applications.map((app, i) => (
                <div key={i} className="rounded-xl bg-ink/3 border border-ink/8 p-4">
                  <div className="text-ink font-semibold text-sm">{app.title}</div>
                  <div className="text-ink/50 text-xs">{app.company}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${app.method === "auto" ? "bg-indigo-500/20 text-indigo-300" : "bg-violet-500/20 text-violet-300"}`}>
                      {app.status === "submitted" ? "Submitted (confirmed by you)" : statuses[app.method] || "Opened listing"}
                    </span>
                    <span className="text-ink/25 text-xs">{app.date}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-3"><button className="text-link" onClick={() => onStatusChange(i, app.status === "submitted" ? "opened" : "submitted")}>{app.status === "submitted" ? "Mark as opened" : "I submitted this application"}</button><button className="text-link" aria-label={`Delete ${app.title} from activity`} onClick={() => onDelete(i)}>Delete</button></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── JOB WORKFLOW ─────────────────────────────────────────────────────────────
// Tiny localStorage helpers
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* Storage or optional notifications may be unavailable. */ } };
const load = (key, fallback) => readStored(key, fallback, value => typeof value === typeof fallback);

export default function JobSearch({ forceUpload = false, onProfileParsed, onImport, onBuildCV }) {
  const [step, setStep] = useState(() => forceUpload ? 0 : readStored("jobai_step", 3, value => [0, 2, 3].includes(value)));
  const [uploadData, setUploadData] = useState(null);
  const [profile, setProfile] = useState(() => readJobProfile(normalizeProfile));
  const [applications, setApplications] = useState(() => readActivity());
  const [showTracker, setShowTracker] = useState(false);
  const closeTracker = useCallback(() => setShowTracker(false), []);

  const handleUpload = (data) => {
    setUploadData(data);
    setStep(1);
    showToast("Uploading and analysing your CV…", "info");
  };

  const handleParsed = (parsedProfile) => {
    if (!parsedProfile) { setStep(0); return; }
    if (onProfileParsed) {onProfileParsed(parsedProfile); return;}
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
      id: job.id,
      title: job.title,
      company: job.company,
      method,
      status: "opened",
      date: new Date().toLocaleDateString(),
      board: job.board,
      applyUrl: job.applyUrl || "",
    };
    setApplications((prev) => {
      const updated = [app, ...prev.filter(previous => previous.id !== app.id)];
      save("jobai_applications", updated);

      return updated;
    });
  };

  // Application activity is independent of the current CV.
  const handleStatusChange = (index, status) => {setApplications(previous => {const updated = previous.map((app, i) => i === index ? {...app, status} : app); save("jobai_applications", updated); return updated;});};
  const handleDelete = index => {setApplications(previous => {const updated = previous.filter((_, i) => i !== index); save("jobai_applications", updated); return updated;});};

  const handleReset = () => {
    ["jobai_step", "jobai_profile"].forEach((k) => localStorage.removeItem(k));
    setStep(0);
    setProfile(null);
    setUploadData(null);
    showToast("Ready for another CV. Your application activity is still saved.", "info");
  };

  return (
    <>
      {/* Main Content */}
      <main id="main-content" tabIndex={-1} className="job-workflow container fade-in">
        <div className="flex flex-wrap justify-end gap-3 mb-6"><button className="button secondary" onClick={() => setShowTracker(true)}>Application activity ({applications.length})</button><button className="text-link" onClick={() => step === 0 ? setStep(3) : handleReset()}>{step === 0 ? "Explore jobs instead" : profile ? "Import a different CV" : "Import a CV"}</button></div>
        {step < 3 && (uploadData || step === 0) && <StepIndicator current={step} />}

        {step === 0 && <UploadStep onNext={handleUpload} />}
        {step === 1 && uploadData && (
          <ParsingStep file={uploadData.file} prompt={uploadData.prompt} onDone={handleParsed} />
        )}
        {/* If step=1 but uploadData is gone (page refresh during parse), fall back to upload */}
        {step === 1 && !uploadData && <UploadStep onNext={handleUpload} />}
        {step === 2 && profile && <ProfileStep profile={profile} onNext={handleProfileDone} />}
        {step === 3 && (
          <JobExplorer
            applications={applications}
            profile={profile || EMPTY_PROFILE}
            onImport={onImport || handleReset}
            onEditProfile={profile ? () => setStep(2) : onBuildCV}
            DetailComponent={JobDetail}
            onApply={handleApply}
          />
        )}
        {/* If step=2 or 3 but profile lost somehow, go back to upload */}
        {step === 2 && !profile && <UploadStep onNext={handleUpload} />}
      </main>

      {showTracker && <TrackerPanel applications={applications} onClose={closeTracker} onStatusChange={handleStatusChange} onDelete={handleDelete} />}
      <ToastContainer />
    </>
  );
}
