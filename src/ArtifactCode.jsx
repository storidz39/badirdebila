import React, { useState, useEffect, useRef, useCallback } from "react";
import { Phone, Mail, Lock, CheckCircle, Upload, CreditCard, Printer, User, Users, FileText, AlertCircle, Check, RotateCcw, ShieldCheck, ArrowRight, ArrowLeft, Sparkles, Search, MapPin, Plane, Ship, Truck } from "lucide-react";
import { Toaster, toast } from "sonner";

// Algerian border crossings data
const CROSSINGS = {
  "جوي": [
    "مطار هواري بومدين الدولي - الجزائر العاصمة",
    "مطار أحمد بن بلة - وهران",
    "مطار محمد بوضياف - قسنطينة",
    "مطار رابح بيطاط - عنابة",
    "مطار مصطفى بن بولعيد - باتنة",
    "مطار مسعود زقار - تلمسان",
    "مطار عين أمناس - إليزي",
    "مطار مولاي حسن - حاسي مسعود",
    "مطار نورالدين نصيرة - غرداية",
    "مطار أغار الحاج باي أخاموك - تمنراست",
    "مطار بشار - بشار",
    "مطار عين الابل - الجلفة",
    "مطار 8 ماي 1945 - سطيف",
    "مطار فرحات عباس - جيجل",
    "مطار شريف الإدريسي - البليدة",
    "مطار سعيدة - سعيدة",
  ],
  "بحري": [
    "ميناء الجزائر العاصمة",
    "ميناء وهران",
    "ميناء عنابة",
    "ميناء بجاية",
    "ميناء سكيكدة",
    "ميناء مستغانم",
    "ميناء جن جن - جيجل",
    "ميناء غزوات - تلمسان",
    "ميناء الشرشال - تيبازة",
    "ميناء دلس - بومرداس",
    "ميناء تنس - الشلف",
  ],
  "بري": [
    "معبر طالب العربي - الوادي (تونس)",
    "معبر العيون - تبسة (تونس)",
    "معبر بوشبكة - سوق أهراس (تونس)",
    "معبر حدود وادي الحجر - الطارف (تونس)",
    "معبر واد بن خليل - قالمة (تونس)",
    "معبر زوج بغال - تلمسان (المغرب)",
    "معبر عقيد لطفي - بشار (المغرب)",
    "معبر تين زاواتين - تمنراست (مالي)",
    "معبر أسامكا - تمنراست (النيجر)",
    "معبر الدبداب - إليزي (ليبيا)",
    "معبر جانت - إليزي (ليبيا)",
  ],
};

const CROSSING_ICON = { "جوي": Plane, "بحري": Ship, "بري": Truck };

// Initial passport form
const emptyPassport = () => ({ file: null, preview: null, verified: false, scanning: false, progress: 0, data: { passportNo: "", fullNameAr: "", fullNameFr: "", birthDate: "", expiryDate: "", issuedBy: "", gender: "M" } });

export default function ArtifactCode() {
  // Steps: 'home' | 'type' | 'auth' | 'passport' | 'crossing' | 'payment' | 'receipt'
  const [step, setStep] = useState("home");

  // Request type: 'individual' | 'family'
  const [requestType, setRequestType] = useState(null);

  // Auth
  const [authMethod, setAuthMethod] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Passports: for individual = [0], for family = [father, mother, child1, child2]
  const [passports, setPassports] = useState([emptyPassport()]);
  const fileRefs = useRef([]);

  // Crossing & destination
  const [crossingType, setCrossingType] = useState("");
  const [crossingPoint, setCrossingPoint] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");

  // Exchange rate
  const [eurRate, setEurRate] = useState(158.00);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateDate, setRateDate] = useState("");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState(""); // 'edahabia' | 'cib'
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [payingIdx, setPayingIdx] = useState(null); // which person's card form is open
  const [cardInfo, setCardInfo] = useState({ cardNumber: "", cardName: "", expiryDate: "", cvv: "" });

  // Receipt
  const [receiptRefs, setReceiptRefs] = useState({}); // { idx: refCode }
  const [receiptDate, setReceiptDate] = useState("");
  const [paymentDone, setPaymentDone] = useState([]);
  const [viewingReceipt, setViewingReceipt] = useState(0); // which person's receipt is displayed

  // Labels for family members
  const FAMILY_LABELS = ["الأب", "الأم", "الابن الأول", "الابن الثاني"];
  const INDIVIDUAL_LABELS = ["المسافر"];

  // Fetch EUR/DZD rate
  const fetchRate = useCallback(async () => {
    setRateLoading(true);
    try {
      const res = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
      const data = await res.json();
      if (data?.rates?.DZD) {
        setEurRate(parseFloat(data.rates.DZD.toFixed(2)));
        setRateDate(data.date || new Date().toISOString().slice(0, 10));
      }
    } catch {
      // fallback
      setEurRate(158.00);
      setRateDate(new Date().toISOString().slice(0, 10));
    }
    setRateLoading(false);
  }, []);

  useEffect(() => { fetchRate(); }, [fetchRate]);

  // Auto-calculate departure (3 business days from now) and return (departure + 7)
  useEffect(() => {
    const addBusinessDays = (date, days) => {
      const d = new Date(date);
      let added = 0;
      while (added < days) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
      return d;
    };
    const dep = addBusinessDays(new Date(), 3);
    const ret = new Date(dep);
    ret.setDate(ret.getDate() + 7);
    setDepartureDate(dep.toISOString().slice(0, 10));
    setReturnDate(ret.toISOString().slice(0, 10));
  }, []);

  // When request type changes, reset passports
  useEffect(() => {
    if (requestType === "individual") setPassports([emptyPassport()]);
    else if (requestType === "family") setPassports([emptyPassport(), emptyPassport(), emptyPassport(), emptyPassport()]);
  }, [requestType]);

  // Calculate grant for a person based on age
  const getAge = (birthDate) => {
    if (!birthDate) return 0;
    const today = new Date();
    const bd = new Date(birthDate);
    let age = today.getFullYear() - bd.getFullYear();
    const m = today.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
    return age;
  };

  const getGrantEUR = (birthDate) => getAge(birthDate) >= 19 ? 750 : 300;
  const getGrantDZD = (birthDate) => parseFloat((getGrantEUR(birthDate) * eurRate).toFixed(2));
  const COMMISSION = 1190.00;

  // Passport upload
  const handleFileUpload = (idx, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPassports(prev => { const n = [...prev]; n[idx] = { ...n[idx], file, preview: ev.target.result, verified: false }; return n; });
    };
    reader.readAsDataURL(file);
  };

  // Simulate OCR scan
  const startScan = (idx) => {
    setPassports(prev => { const n = [...prev]; n[idx] = { ...n[idx], scanning: true, progress: 0 }; return n; });
    const iv = setInterval(() => {
      setPassports(prev => {
        const n = [...prev];
        const p = n[idx].progress + 10;
        if (p >= 100) {
          clearInterval(iv);
          setTimeout(() => {
            setPassports(prev2 => {
              const n2 = [...prev2];
              const names = [
                { ar: "صدقون فوضة", fr: "SADOUN FOUDA" },
                { ar: "فاطمة بن علي", fr: "FATIMA BEN ALI" },
                { ar: "محمد صدقون", fr: "MOHAMED SADOUN" },
                { ar: "أمينة صدقون", fr: "AMINA SADOUN" },
              ];
              const nm = names[idx % names.length];
              n2[idx] = {
                ...n2[idx], scanning: false, verified: true,
                data: {
                  passportNo: "17230" + Math.floor(1000 + Math.random() * 9000),
                  fullNameAr: nm.ar, fullNameFr: nm.fr,
                  birthDate: idx >= 2 ? "2012-03-15" : "1994-01-09",
                  expiryDate: "2027-10-16",
                  issuedBy: "CEBLA",
                  gender: idx === 1 || idx === 3 ? "F" : "M",
                },
              };
              return n2;
            });
            toast.success("تم فحص الجواز واستخراج البيانات!");
          }, 400);
          return n;
        }
        n[idx] = { ...n[idx], progress: p };
        return n;
      });
    }, 180);
  };

  const updatePassportField = (idx, field, value) => {
    setPassports(prev => { const n = [...prev]; n[idx] = { ...n[idx], data: { ...n[idx].data, [field]: value } }; return n; });
  };

  // Auth handlers
  const sendOTP = (e) => {
    e.preventDefault();
    if (!phone || phone.length < 9) { toast.error("أدخل رقم هاتف صحيح"); return; }
    setOtpLoading(true);
    setTimeout(() => { setOtpLoading(false); setOtpSent(true); toast.success("رمز التحقق التجريبي: 1234"); }, 1200);
  };
  const verifyOTP = (e) => {
    e.preventDefault();
    if (otp === "1234") { setIsAuthLoading(true); setTimeout(() => { setIsAuthLoading(false); toast.success("تم التحقق!"); setStep("passport"); }, 800); }
    else toast.error("رمز خاطئ، استخدم: 1234");
  };
  const handleEmailReg = (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error("املأ جميع الحقول"); return; }
    if (password !== confirmPassword) { toast.error("كلمات المرور غير متطابقة"); return; }
    setIsAuthLoading(true);
    setTimeout(() => { setIsAuthLoading(false); toast.success("تم إنشاء الحساب!"); setStep("passport"); }, 1000);
  };

  // Card info handler
  const handleCardInfoChange = (e) => {
    let { name, value } = e.target;
    if (name === "cardNumber") { value = value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim(); if (value.length > 19) return; }
    else if (name === "expiryDate") { value = value.replace(/\D/g, ""); if (value.length > 2) value = value.slice(0,2) + "/" + value.slice(2,4); if (value.length > 5) return; }
    else if (name === "cvv") { value = value.replace(/\D/g, ""); if (value.length > 3) return; }
    setCardInfo(prev => ({ ...prev, [name]: value }));
  };

  // Open card payment form for a person
  const openPayForm = (idx) => {
    setPayingIdx(idx);
    setPaymentMethod("");
    setCardInfo({ cardNumber: "", cardName: "", expiryDate: "", cvv: "" });
  };

  // Submit payment for a person
  const submitPayment = (e) => {
    e.preventDefault();
    if (!paymentMethod) { toast.error("اختر وسيلة الدفع"); return; }
    if (!cardInfo.cardNumber || !cardInfo.cardName || !cardInfo.expiryDate || !cardInfo.cvv) { toast.error("أدخل جميع معلومات البطاقة"); return; }
    setPaymentLoading(true);
    setTimeout(() => {
      setPaymentLoading(false);
      const idx = payingIdx;
      setPaymentDone(prev => [...prev, idx]);
      // Generate individual receipt ref for this person
      const ref = "003 / 395 / 330405 / " + String(Math.floor(10000000 + Math.random() * 90000000)).padStart(8, "0") + " / 2025";
      setReceiptRefs(prev => ({ ...prev, [idx]: ref }));
      const now = new Date();
      setReceiptDate(now.toLocaleDateString("fr-DZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).toUpperCase());
      toast.success(`تم دفع منحة ${passports[idx]?.data.fullNameAr || "المسافر"}`);
      setPayingIdx(null);
      // If all paid, go to receipt
      const allPaid = [...paymentDone, idx];
      if (allPaid.length === passports.length) {
        setViewingReceipt(0);
        setTimeout(() => setStep("receipt"), 600);
      }
    }, 1800);
  };

  const allPassportsVerified = passports.every(p => p.verified);

  // Steps config
  const STEPS = [
    { id: "type", label: "نوع الطلب", n: "١" },
    { id: "auth", label: "الحساب", n: "٢" },
    { id: "passport", label: "الجوازات", n: "٣" },
    { id: "crossing", label: "العبور والوجهة", n: "٤" },
    { id: "payment", label: "سداد الرسوم", n: "٥" },
    { id: "receipt", label: "الوصل", n: "٦" },
  ];
  const stepIdx = STEPS.findIndex(s => s.id === step);

  // Total DZD
  const totalDZD = passports.reduce((s, p) => s + getGrantDZD(p.data.birthDate), 0);
  const totalEUR = passports.reduce((s, p) => s + getGrantEUR(p.data.birthDate), 0);
  const totalWithCommission = totalDZD + COMMISSION;

  const labels = requestType === "family" ? FAMILY_LABELS : INDIVIDUAL_LABELS;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 relative" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <Toaster position="top-center" richColors />
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          @page { margin: 0.5cm; }
          #printable-receipt { 
            zoom: 0.85; 
            margin: 0 auto !important; 
            border: none !important; 
            box-shadow: none !important;
            page-break-inside: avoid;
          }
        }
        @keyframes laser { 0%{top:0} 50%{top:96%} 100%{top:0} }
        .animate-laser { animation: laser 2s ease-in-out infinite; }
      `}} />

      <div className="bg-white border border-slate-200 shadow-2xl rounded-3xl overflow-hidden">
        
        {/* Landing Page */}
        {step === "home" && (
          <div className="relative w-full h-[650px] flex items-center justify-center bg-[#0a2315] overflow-hidden">
            {/* Background Image / Overlay */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-[url('/bg-passport.png')] bg-cover bg-center" />
              <div className="absolute inset-0 bg-[#0d3b20]/60 mix-blend-multiply" />
            </div>

            {/* Modal Box */}
            <div className="relative z-10 bg-black/40 backdrop-blur-md border border-white/20 p-10 rounded-3xl shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full mx-4 text-center mt-10">
              <Plane className="w-14 h-14 text-amber-400" />
              <div>
                <h1 className="text-3xl font-black text-white italic tracking-widest mb-1" style={{ fontFamily: "'Outfit',sans-serif" }}>X-CHANGE</h1>
                <p className="text-[10px] font-bold text-white tracking-widest">PREMIUM TRAVEL GRANT PORTAL</p>
              </div>
              <button onClick={() => setStep("type")} className="w-full mt-4 bg-amber-400 hover:bg-amber-500 text-slate-900 font-black text-lg py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-105 shadow-[0_0_20px_rgba(251,191,36,0.3)]">
                طلب منحة السفر
                <Plane className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        {step !== "home" && (
          <div className="relative bg-[#1e3a8a] text-white p-6 text-center no-print border-b-4 border-amber-400">
            <div className="relative z-10 flex items-center justify-center gap-3">
              <h1 className="text-4xl font-black italic tracking-wider" style={{ fontFamily: "'Outfit',sans-serif" }}>X-CHANGE</h1>
              <Plane className="w-10 h-10 text-amber-400" />
            </div>
          </div>
        )}

        {/* Stepper */}
        {step !== "home" && (
          <div className="bg-slate-50 border-b px-4 py-4 flex items-center justify-between overflow-x-auto gap-1 no-print">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${stepIdx > i ? "bg-blue-600 border-blue-600 text-white" : stepIdx === i ? "bg-blue-800 border-blue-800 text-white ring-2 ring-blue-200" : "bg-white border-slate-200 text-slate-400"}`}>
                    {stepIdx > i ? <Check className="w-3.5 h-3.5" /> : s.n}
                  </div>
                  <span className={`text-xs font-semibold ${stepIdx === i ? "text-slate-900" : stepIdx > i ? "text-blue-600" : "text-slate-400"}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`h-[2px] flex-grow mx-2 rounded ${stepIdx > i ? "bg-blue-600" : "bg-slate-200"}`} />}
              </React.Fragment>
            ))}
          </div>
        )}

        {step !== "home" && (
          <div className="p-6 md:p-8">
            {/* The rest of the steps ... */}
          {/* STEP: TYPE */}
          {step === "type" && (
            <div className="max-w-lg mx-auto space-y-6">
              <h2 className="text-xl font-bold text-center text-slate-800">اختيار نوع الطلب</h2>
              <div className="grid grid-cols-2 gap-6">
                {[{ type: "individual", label: "طلب فردي", desc: "مسافر واحد", icon: User, color: "blue" },
                  { type: "family", label: "طلب عائلي", desc: "أب + أم + ابن أول + ابن ثاني", icon: Users, color: "emerald" }
                ].map(o => (
                  <button key={o.type} onClick={() => { setRequestType(o.type); setStep("auth"); }}
                    className={`p-8 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all hover:shadow-lg hover:-translate-y-1 ${requestType === o.type ? `border-${o.color}-500 bg-${o.color}-50` : "border-slate-200 bg-white hover:border-slate-300"}`}>
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${o.color === "blue" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
                      <o.icon className="w-8 h-8" />
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-slate-800 text-lg">{o.label}</div>
                      <div className="text-xs text-slate-500 mt-1">{o.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP: AUTH */}
          {step === "auth" && (
            <div className="max-w-md mx-auto space-y-5">
              <div className="text-center"><h2 className="text-xl font-bold text-slate-800">إنشاء حساب أو تسجيل الدخول</h2><p className="text-slate-500 text-sm mt-1">أنشئ حسابك للبدء في تقديم طلب منحة السفر</p></div>
              <div className="flex p-1 bg-slate-100 rounded-xl">
                {[{ m: "phone", l: "رقم الهاتف", I: Phone }, { m: "email", l: "البريد الإلكتروني", I: Mail }].map(x => (
                  <button key={x.m} onClick={() => { setAuthMethod(x.m); setOtpSent(false); }} className={`flex-1 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${authMethod === x.m ? "bg-white text-blue-800 shadow-sm" : "text-slate-500"}`}><x.I className="w-4 h-4" />{x.l}</button>
                ))}
              </div>
              {authMethod === "phone" ? (
                !otpSent ? (
                  <form onSubmit={sendOTP} className="space-y-4">
                    <div><label className="text-sm font-bold text-slate-700 block mb-1">رقم الهاتف</label>
                      <input type="text" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="05XXXXXXXX" className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-left font-mono text-lg" required />
                    </div>
                    <button type="submit" disabled={otpLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-70">
                      {otpLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "إرسال رمز التحقق"}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={verifyOTP} className="space-y-4">
                    <div><label className="text-sm font-bold text-slate-700 block mb-1">رمز التحقق (OTP)</label>
                      <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" className="w-full px-4 py-3 border rounded-xl text-center tracking-[1em] font-mono text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                      <p className="text-amber-600 text-xs font-semibold bg-amber-50 p-2 rounded-lg text-center mt-2 border border-amber-100">الرمز التجريبي: <b>1234</b></p>
                    </div>
                    <button type="submit" disabled={isAuthLoading} className="w-full bg-blue-800 hover:bg-blue-900 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2">
                      {isAuthLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "التحقق والمتابعة"}
                    </button>
                  </form>
                )
              ) : (
                <form onSubmit={handleEmailReg} className="space-y-4">
                  <div><label className="text-sm font-bold text-slate-700 block mb-1">البريد الإلكتروني</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@mail.dz" className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" required /></div>
                  <div><label className="text-sm font-bold text-slate-700 block mb-1">كلمة السر</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" required /></div>
                  <div><label className="text-sm font-bold text-slate-700 block mb-1">تأكيد كلمة السر</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" required /></div>
                  <button type="submit" disabled={isAuthLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2">{isAuthLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "إنشاء حساب ومتابعة"}</button>
                </form>
              )}
              <div className="flex justify-start pt-2"><button onClick={() => setStep("type")} className="text-sm text-slate-500 flex items-center gap-1 hover:text-slate-800"><ArrowRight className="w-4 h-4" />السابق</button></div>
            </div>
          )}

          {/* STEP: PASSPORTS */}
          {step === "passport" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-r-4 border-blue-600 pr-4">
                <h2 className="text-xl font-bold text-slate-800">بيانات جوازات السفر</h2>
              </div>

              <div className="space-y-4">
                {passports.map((p, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><User className="w-5 h-5" /></div>
                        <div>
                          <h3 className="font-bold text-slate-800">{labels[idx]}</h3>
                          <p className="text-xs text-slate-400">ارفع صورة جواز السفر</p>
                        </div>
                      </div>
                      {p.verified && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" />تم التحقق</span>}
                    </div>

                    {!p.preview ? (
                      <button onClick={() => fileRefs.current[idx]?.click()} className="w-full border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 flex flex-col items-center gap-2 transition-all text-slate-500 hover:text-blue-600">
                        <Upload className="w-6 h-6" /><span className="text-sm font-bold">اختر صورة الجواز</span>
                      </button>
                    ) : (
                      <div className="relative mb-3 rounded-xl overflow-hidden border border-slate-200 h-32">
                        <img src={p.preview} className="w-full h-full object-cover" alt="" />
                        {p.scanning && <div className="absolute inset-x-0 h-1 bg-blue-500 shadow-[0_0_15px_#3b82f6] animate-laser z-20" />}
                      </div>
                    )}
                    <input type="file" ref={el => fileRefs.current[idx] = el} onChange={e => handleFileUpload(idx, e)} accept="image/*" className="hidden" />

                    <div className="flex gap-3 mt-3">
                      {p.preview && !p.verified && (
                        <button onClick={() => startScan(idx)} disabled={p.scanning} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                          {p.scanning ? `جاري الفحص (${p.progress}%)` : <><Search className="w-4 h-4" />فحص الجواز</>}
                        </button>
                      )}
                      {p.preview && <button onClick={() => fileRefs.current[idx]?.click()} className="p-2.5 border rounded-xl text-slate-500 hover:bg-slate-50"><RotateCcw className="w-4 h-4" /></button>}
                    </div>

                    {p.verified && (
                      <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                        <div><label className="text-xs font-bold text-slate-500 block mb-1">رقم الجواز</label><input value={p.data.passportNo} onChange={e => updatePassportField(idx, "passportNo", e.target.value)} className="w-full px-3 py-2 border rounded-lg font-mono text-sm" /></div>
                        <div><label className="text-xs font-bold text-slate-500 block mb-1">الاسم (بالعربية)</label><input value={p.data.fullNameAr} onChange={e => updatePassportField(idx, "fullNameAr", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                        <div><label className="text-xs font-bold text-slate-500 block mb-1">الاسم (باللاتينية)</label><input value={p.data.fullNameFr} onChange={e => updatePassportField(idx, "fullNameFr", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-left" /></div>
                        <div><label className="text-xs font-bold text-slate-500 block mb-1">تاريخ الميلاد</label><input type="date" value={p.data.birthDate} onChange={e => updatePassportField(idx, "birthDate", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                        <div><label className="text-xs font-bold text-slate-500 block mb-1">تاريخ الانتهاء</label><input type="date" value={p.data.expiryDate} onChange={e => updatePassportField(idx, "expiryDate", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                        <div><label className="text-xs font-bold text-slate-500 block mb-1">صادر عن</label><input value={p.data.issuedBy} onChange={e => updatePassportField(idx, "issuedBy", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-4 border-t">
                <button onClick={() => setStep("auth")} className="px-5 py-3 border rounded-xl text-slate-600 font-bold flex items-center gap-2 hover:bg-slate-50"><ArrowRight className="w-4 h-4" />السابق</button>
                <button onClick={() => { if (!allPassportsVerified) { toast.error("يرجى رفع وفحص جميع الجوازات أولاً"); return; } setStep("crossing"); }}
                  className="px-6 py-3 bg-blue-800 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-blue-900 shadow-md">التالي<ArrowLeft className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {/* STEP: CROSSING & DESTINATION */}
          {step === "crossing" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-r-4 border-blue-600 pr-4">
                <MapPin className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-800">مكان العبور والوجهة</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-2">نوع المعبر</label>
                  <select value={crossingType} onChange={e => { setCrossingType(e.target.value); setCrossingPoint(""); }} className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">نوع المعبر</option>
                    {Object.keys(CROSSINGS).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-2">المعبر المحدد</label>
                  <select value={crossingPoint} onChange={e => setCrossingPoint(e.target.value)} className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" disabled={!crossingType}>
                    <option value="">المعبر المحدد</option>
                    {crossingType && CROSSINGS[crossingType].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-2">الوجهة (بلد الوصول)</label>
                  <input type="text" value={destination} onChange={e => setDestination(e.target.value)} placeholder="مثال: تونس، تركيا، فرنسا..." className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-bold text-slate-700 block mb-2">تاريخ المغادرة <span className="text-xs text-blue-600">(تلقائي — 3 أيام عمل)</span></label><input type="date" value={departureDate} readOnly className="w-full px-4 py-3 border rounded-xl bg-slate-100 text-slate-700 cursor-not-allowed" /></div>
                  <div><label className="text-sm font-bold text-slate-700 block mb-2">تاريخ العودة <span className="text-xs text-blue-600">(تلقائي — بعد 7 أيام)</span></label><input type="date" value={returnDate} readOnly className="w-full px-4 py-3 border rounded-xl bg-slate-100 text-slate-700 cursor-not-allowed" /></div>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <button onClick={() => setStep("passport")} className="px-5 py-3 border rounded-xl text-slate-600 font-bold flex items-center gap-2 hover:bg-slate-50"><ArrowRight className="w-4 h-4" />السابق</button>
                <button onClick={() => {
                  if (!crossingType || !crossingPoint || !destination) { toast.error("يرجى ملء جميع حقول العبور والوجهة"); return; }
                  setStep("payment");
                }} className="px-6 py-3 bg-blue-800 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-blue-900 shadow-md">حفظ البيانات والانتقال<ArrowLeft className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {/* STEP: PAYMENT */}
          {step === "payment" && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold text-blue-800">جدول سداد الرسوم</h2>
                <p className="text-slate-500 text-sm">يجب الدفع لكل فرد بشكل مستقل لإصدار الوصل الخاص به</p>
              </div>

              {/* Exchange rate banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                <div className="text-sm"><span className="font-bold text-blue-800">سعر الصرف الحالي:</span> <span className="font-mono font-bold text-blue-900">1€ = {eurRate} DZD</span> <span className="text-xs text-blue-600 mr-2">({rateDate})</span></div>
                <button onClick={fetchRate} disabled={rateLoading} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"><RotateCcw className={`w-3 h-3 ${rateLoading ? "animate-spin" : ""}`} />تحديث</button>
              </div>

              <div className="space-y-4">
                {passports.map((p, idx) => {
                  const age = getAge(p.data.birthDate);
                  const grantEUR = getGrantEUR(p.data.birthDate);
                  const grantDZD = getGrantDZD(p.data.birthDate);
                  const paid = paymentDone.includes(idx);
                  const isFormOpen = payingIdx === idx;
                  return (
                    <div key={idx} className={`rounded-2xl border-2 p-5 transition-all ${paid ? "border-emerald-300 bg-emerald-50/30" : isFormOpen ? "border-blue-400 bg-blue-50/20" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-black text-lg text-slate-800">{labels[idx]} {p.data.fullNameAr && `— ${p.data.fullNameAr}`}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">PASS: {p.data.passportNo} | GRANT: <span className="text-blue-600 font-bold">{grantEUR}€</span> | العمر: {age} سنة {age < 19 ? "(أقل من 19)" : "(19 أو أكثر)"}</div>
                        </div>
                        {paid && <CheckCircle className="w-6 h-6 text-emerald-600" />}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-2xl font-black text-blue-900">
                          <span className="text-xs text-slate-500 font-normal mr-1">DZD</span>{grantDZD.toLocaleString("fr-DZ", { minimumFractionDigits: 2 })}
                        </div>
                        {!paid && !isFormOpen && (
                          <button onClick={() => openPayForm(idx)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 text-sm">
                            <CreditCard className="w-4 h-4" />دفع الآن
                          </button>
                        )}
                        {paid && <span className="text-emerald-700 font-bold text-sm">✓ تم الدفع</span>}
                      </div>

                      {/* Card Payment Form */}
                      {isFormOpen && (
                        <form onSubmit={submitPayment} className="mt-5 pt-5 border-t border-blue-200 space-y-4">
                          <h4 className="font-bold text-slate-800 text-sm">اختر وسيلة الدفع</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div onClick={() => setPaymentMethod("edahabia")} className={`border-2 rounded-xl p-3 cursor-pointer flex items-center gap-2 transition-all ${paymentMethod === "edahabia" ? "border-amber-500 bg-amber-50" : "border-slate-200 hover:border-slate-300"}`}>
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === "edahabia" ? "border-amber-500" : "border-slate-300"}`}>{paymentMethod === "edahabia" && <div className="w-2 h-2 rounded-full bg-amber-600" />}</div>
                              <span className="font-bold text-sm">البطاقة الذهبية</span>
                            </div>
                            <div onClick={() => setPaymentMethod("cib")} className={`border-2 rounded-xl p-3 cursor-pointer flex items-center gap-2 transition-all ${paymentMethod === "cib" ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}>
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === "cib" ? "border-blue-500" : "border-slate-300"}`}>{paymentMethod === "cib" && <div className="w-2 h-2 rounded-full bg-blue-600" />}</div>
                              <span className="font-bold text-sm">بطاقة CIB البنكية</span>
                            </div>
                          </div>

                          {paymentMethod && (
                            <div className="space-y-3">
                              <div><label className="text-xs font-bold text-slate-600 block mb-1">رقم البطاقة</label><input type="text" name="cardNumber" value={cardInfo.cardNumber} onChange={handleCardInfoChange} placeholder="•••• •••• •••• ••••" className="w-full px-4 py-3 border rounded-xl font-mono text-center text-lg tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500" required /></div>
                              <div><label className="text-xs font-bold text-slate-600 block mb-1">اسم صاحب البطاقة</label><input type="text" name="cardName" value={cardInfo.cardName} onChange={handleCardInfoChange} placeholder="الاسم كما يظهر على البطاقة" className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" required /></div>
                              <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-xs font-bold text-slate-600 block mb-1">تاريخ الانتهاء</label><input type="text" name="expiryDate" value={cardInfo.expiryDate} onChange={handleCardInfoChange} placeholder="MM/YY" className="w-full px-4 py-3 border rounded-xl font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500" required /></div>
                                <div><label className="text-xs font-bold text-slate-600 block mb-1">CVV2</label><input type="password" name="cvv" value={cardInfo.cvv} onChange={handleCardInfoChange} placeholder="•••" className="w-full px-4 py-3 border rounded-xl font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500" required /></div>
                              </div>
                              <div className="flex gap-3">
                                <button type="submit" disabled={paymentLoading} className="flex-1 bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
                                  {paymentLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><ShieldCheck className="w-4 h-4" />تأكيد الدفع — {grantDZD.toLocaleString("fr-DZ", { minimumFractionDigits: 2 })} DZD</>}
                                </button>
                                <button type="button" onClick={() => setPayingIdx(null)} className="px-4 py-3 border rounded-xl text-slate-600 font-bold hover:bg-slate-50">إلغاء</button>
                              </div>
                            </div>
                          )}
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="bg-slate-50 border rounded-xl p-4 text-sm space-y-2">
                <div className="flex justify-between"><span>إجمالي المنح ({passports.length} أفراد):</span><span className="font-bold">{totalEUR}€ = {totalDZD.toLocaleString("fr-DZ", { minimumFractionDigits: 2 })} DZD</span></div>
                <div className="flex justify-between"><span>رسوم العمولة والطابع:</span><span className="font-bold">{COMMISSION.toLocaleString("fr-DZ")} DZD</span></div>
                <div className="flex justify-between border-t pt-2 font-bold text-base"><span className="text-blue-800">المبلغ الإجمالي:</span><span className="text-blue-900">{totalWithCommission.toLocaleString("fr-DZ", { minimumFractionDigits: 2 })} DZD</span></div>
              </div>

              <div className="flex justify-start pt-2 border-t"><button onClick={() => setStep("crossing")} className="px-5 py-3 border rounded-xl text-slate-600 font-bold flex items-center gap-2 hover:bg-slate-50"><ArrowRight className="w-4 h-4" />السابق</button></div>
            </div>
          )}

          {/* STEP: RECEIPT — one per person */}
          {step === "receipt" && (() => {
            const rp = passports[viewingReceipt];
            const rpEUR = getGrantEUR(rp.data.birthDate);
            const rpDZD = getGrantDZD(rp.data.birthDate);
            const rpTotal = rpDZD + COMMISSION;
            const rpRef = receiptRefs[viewingReceipt] || "";
            return (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center max-w-xl mx-auto no-print">
                <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <h2 className="text-lg font-black text-emerald-950">تم إصدار الوصل بنجاح!</h2>
                <p className="text-emerald-800 text-sm">يمكنك طباعة الوصل أو حفظه كملف PDF — وصل لكل فرد على حدة</p>
              </div>

              {/* Person tabs (for family) */}
              {passports.length > 1 && (
                <div className="flex gap-2 justify-center flex-wrap no-print">
                  {passports.map((_, i) => (
                    <button key={i} onClick={() => setViewingReceipt(i)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewingReceipt === i ? "bg-blue-800 text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      وصل {labels[i]}
                    </button>
                  ))}
                </div>
              )}

              {/* BADR-style receipt — individual */}
              <div id="printable-receipt" className="bg-white border-2 border-slate-400 rounded-xl p-8 max-w-2xl mx-auto text-sm" style={{ fontFamily: "'Cairo', 'Courier New', monospace" }}>
                <div className="text-center border-b-2 border-slate-800 pb-4 mb-4 space-y-1">
                  <p className="text-xs font-bold tracking-wide">بنك الفلاحة والتنمية الريفية</p>
                  <p className="text-[10px] text-slate-600">Banque de l'agriculture et du développement rural</p>
                  <h1 className="text-base font-black mt-2 tracking-wide">REÇU DE VERSEMENT</h1>
                  <h2 className="text-sm font-bold text-blue-800">DROIT DE CHANGE POUR VOYAGE A L'ETRANGER</h2>
                </div>

                <div className="text-right text-xs mb-3"><span className="font-bold">N° :</span> <span className="font-mono">{rpRef}</span></div>

                <div className="space-y-1.5 text-xs border-b border-slate-300 pb-3 mb-3">
                  <p>Banque de l'agriculture et du Développement rural (BADR) RECONNAIT AVOIR REÇU CE JOUR DE :</p>
                  <div className="bg-slate-50 p-2 rounded border">
                    <p><b>- Mr/Mme/Mlle :</b> <span className="font-mono uppercase">{rp.data.fullNameFr}</span> — <b>né(e) le :</b> {rp.data.birthDate}</p>
                    <p><b>- Passeport N° :</b> <span className="font-mono">{rp.data.passportNo}</span> — <b>délivré par :</b> {rp.data.issuedBy} — <b>expire le :</b> {rp.data.expiryDate}</p>
                  </div>
                  <p><b>- Destination :</b> <span className="uppercase">{destination}</span></p>
                  <p><b>- Point de sortie :</b> {crossingPoint}</p>
                  <p><b>- Date de départ :</b> {departureDate} — <b>Date de retour :</b> {returnDate}</p>
                </div>

                <div className="border-2 border-slate-800 p-4 rounded mb-3 space-y-2 text-xs">
                  <p className="font-bold text-base text-center">LA SOMME DE : <span className="text-blue-800">{rpDZD.toLocaleString("fr-DZ", { minimumFractionDigits: 2 })} DA</span></p>
                  <div className="border-t pt-2 space-y-1">
                    <p>AFIN DE PERCEVOIR LA SOMME DE <b>{rpEUR.toLocaleString("fr-DZ")} €</b> — Devise : <b>EUR</b></p>
                    <p>Au cours de : <b>{eurRate}</b></p>
                    <p>Soit la contre-valeur DA : <b>{rpDZD.toLocaleString("fr-DZ", { minimumFractionDigits: 2 })}</b></p>
                    <p>Montant commission et taxe : <b>{COMMISSION.toLocaleString("fr-DZ", { minimumFractionDigits: 2 })}</b></p>
                    <p className="font-bold text-base border-t pt-1 mt-1">TOTAL : <span className="text-blue-800">{rpTotal.toLocaleString("fr-DZ", { minimumFractionDigits: 2 })} DA</span></p>
                  </div>
                </div>

                <div className="text-xs mb-4"><b>MODE DE PAIEMENT :</b> Carte</div>

                <div className="flex justify-between items-end border-t-2 border-slate-800 pt-4">
                  <div className="text-xs text-slate-600"><p>Fait à _____________ , le {receiptDate}</p></div>
                  <div className="text-center text-xs"><p className="border-b border-slate-400 pb-4 mb-1 px-8">Cachet et Signatures</p><p className="font-bold">Le Directeur d'Agence</p></div>
                </div>

                <div className="mt-4 border border-slate-300 rounded p-3 text-[10px] text-slate-600 space-y-1">
                  <p className="font-bold">Important :</p>
                  <p>• Le montant du droit de change sera octroyé au titulaire, au poste frontière de départ après (3) trois jours ouvrables de la date de versement de la contrevaleur des Dinars Algériens.</p>
                  <p>• L'original de ce reçu sera exigé au poste frontière au départ pour l'octroi du droit de change pour le voyage à l'étranger.</p>
                </div>

                <div className="flex justify-center mt-4">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=XCHANGE-REF:${encodeURIComponent(rpRef)}-NAME:${encodeURIComponent(rp.data.fullNameFr)}-PASS:${rp.data.passportNo}-EUR:${rpEUR}-DZD:${rpDZD}`} alt="QR" className="w-24 h-24 border" />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 justify-center pt-4 border-t no-print">
                <button onClick={() => window.print()} className="bg-blue-800 hover:bg-blue-900 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2"><Printer className="w-5 h-5" />طباعة الوصل</button>
                <button onClick={() => { setStep("type"); setRequestType(null); setPassports([emptyPassport()]); setPaymentDone([]); setReceiptRefs({}); setCrossingType(""); setCrossingPoint(""); setDestination(""); }} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 px-6 rounded-xl flex items-center gap-2"><RotateCcw className="w-5 h-5" />تقديم طلب جديد</button>
              </div>
            </div>
            );
          })()}

          </div>
        )}
      </div>
    </div>
  );
}
