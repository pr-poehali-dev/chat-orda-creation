import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

const API_URL = "https://functions.poehali.dev/162ae2ac-2908-4c94-8947-ebec298643c9";

async function api(resource: string, method = "GET", body?: object, id?: number) {
  const url = new URL(API_URL);
  url.searchParams.set("resource", resource);
  if (id !== undefined) url.searchParams.set("id", String(id));
  const res = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

const BANNER_URL = "https://cdn.poehali.dev/projects/08541dfb-d453-4a1d-a11c-0dee9a66584d/files/667d9a4c-804e-447c-a43b-18d0fb5f7405.jpg";

const RANKS = ["Новобранец", "Воин", "Ветеран", "Капитан", "Военачальник", "Глава"];
const RANK_COLORS: Record<string, string> = {
  "Новобранец": "#888",
  "Воин": "#7cb9e8",
  "Ветеран": "#a8e6a3",
  "Капитан": "#f0c060",
  "Военачальник": "#e08040",
  "Глава": "#ff4444",
};

type Page = "home" | "chat" | "members" | "rules" | "history" | "events" | "join" | "admin";

interface Member {
  id: number;
  nick: string;
  rank: string;
  joinedAt: string;
  isOnline: boolean;
}

interface Message {
  id: number;
  author: string;
  rank: string;
  text: string;
  translated?: string;
  time: string;
  isSystem?: boolean;
}

interface Rule {
  id: number;
  text: string;
}

interface Event {
  id: number;
  title: string;
  date: string;
  desc: string;
}



const HISTORY_TEXT = `Альянс ОРДА основан в начале эпохи Puzzles Conquest. Когда тёмные силы угрожали разрушить мир, горстка отважных воинов объединилась под единым знаменем — чёрным черепом на кроваво-красном фоне.

Первые битвы были жестокими. Орда теряла бойцов, но никогда — духа. Каждое поражение закаляло нас, как сталь в огне. Мы росли, привлекая в свои ряды лучших воинов со всех краёв игрового мира.

Сегодня ОРДА — один из сильнейших альянсов, чьё имя заставляет врагов дрожать. Мы живём по кодексу чести: верность, сила, братство. Никто не остаётся позади. Орда — это семья.

Наши победы вписаны в хроники войн, наши имена — в легенды. И путь ещё не закончен...`;

const TRANSLATE_LANGS = [
  { code: "ru", name: "Русский" },
  { code: "en", name: "English" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "tr", name: "Türkçe" },
  { code: "ar", name: "العربية" },
  { code: "zh", name: "中文" },
  { code: "pt", name: "Português" },
];

function playWelcomeSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const notes = [261.6, 329.6, 392.0, 523.2, 659.3];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "triangle";
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.4);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.5);
    });
  } catch { /* ignore */ }
}

async function translateText(text: string, targetLang: string): Promise<string> {
  if (targetLang === "ru") return text;
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    );
    const data = await res.json();
    return data[0]?.map((item: string[]) => item[0]).join("") || text;
  } catch {
    return text;
  }
}

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [joinNick, setJoinNick] = useState("");
  const [joinError, setJoinError] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminNick, setAdminNick] = useState("ВеликийОрк");
  const [editingRule, setEditingRule] = useState<number | null>(null);
  const [newRuleText, setNewRuleText] = useState("");
  const [newEvent, setNewEvent] = useState({ title: "", date: "", desc: "" });
  const [showWelcome, setShowWelcome] = useState(false);
  const [translateLang, setTranslateLang] = useState("ru");
  const [translating, setTranslating] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTheme, setActiveTheme] = useState<"dark" | "fire" | "shadow">("dark");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const ADMIN_PASSWORD = "орда2024";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("join") === "1") setPage("join");
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [m, msg, r, e] = await Promise.all([
      api("members"), api("messages"), api("rules"), api("events"),
    ]);
    if (Array.isArray(m)) setMembers(m);
    if (Array.isArray(msg)) setMessages(msg);
    if (Array.isArray(r)) setRules(r);
    if (Array.isArray(e)) setEvents(e);
    setLoading(false);
  };

  const addNotification = (text: string) => {
    setNotifications(prev => [text, ...prev.slice(0, 9)]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n !== text)), 4000);
  };

  const handleJoin = async () => {
    if (!joinNick.trim()) { setJoinError("Введи свой ник!"); return; }
    if (joinNick.trim().length < 2) { setJoinError("Ник слишком короткий!"); return; }
    const result = await api("members", "POST", { nick: joinNick.trim() });
    if (result.error) { setJoinError(result.error); return; }
    setCurrentUser(result);
    setMembers(prev => [...prev, result]);
    const msgs = await api("messages");
    if (Array.isArray(msgs)) setMessages(msgs);
    addNotification(`${result.nick} вступил в Орду!`);
    playWelcomeSound();
    setShowWelcome(true);
    setTimeout(() => { setShowWelcome(false); setPage("home"); }, 4000);
    setJoinError("");
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !currentUser) return;
    const text = chatInput.trim();
    setChatInput("");
    const msg = await api("messages", "POST", { author: currentUser.nick, rank: currentUser.rank, text });
    if (!msg.error) setMessages(prev => [...prev, msg]);
  };

  const handleTranslate = async (msgId: number, text: string) => {
    if (translateLang === "ru") return;
    setTranslating(msgId);
    const translated = await translateText(text, translateLang);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, translated } : m));
    setTranslating(null);
  };

  const handleAdminLogin = () => {
    if (adminPass === ADMIN_PASSWORD) {
      setAdminUnlocked(true);
      const adminMember = members.find(m => m.rank === "Глава") || members[0];
      if (adminMember) setCurrentUser({ ...adminMember, nick: adminNick });
    } else {
      alert("Неверный пароль!");
    }
  };

  const handleDeleteMessage = async (id: number) => {
    setMessages(prev => prev.filter(m => m.id !== id));
    await api("messages", "DELETE", undefined, id);
  };

  const handleSetRank = async (memberId: number, rank: string) => {
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, rank } : m));
    await api("members", "PUT", { rank }, memberId);
    addNotification("Ранг изменён!");
  };

  const handleSaveRule = async (id: number, text: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, text } : r));
    await api("rules", "PUT", { text }, id);
    setEditingRule(null);
  };

  const handleAddRule = async () => {
    if (!newRuleText.trim()) return;
    const rule = await api("rules", "POST", { text: newRuleText.trim() });
    if (!rule.error) setRules(prev => [...prev, rule]);
    setNewRuleText("");
  };

  const handleDeleteRule = async (id: number) => {
    setRules(prev => prev.filter(r => r.id !== id));
    await api("rules", "DELETE", undefined, id);
  };

  const handleAddEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.date.trim()) return;
    const ev = await api("events", "POST", { title: newEvent.title.trim(), date: newEvent.date.trim(), desc: newEvent.desc.trim() });
    if (!ev.error) setEvents(prev => [...prev, ev]);
    setNewEvent({ title: "", date: "", desc: "" });
    addNotification("Событие добавлено!");
  };

  const handleDeleteEvent = async (id: number) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    await api("events", "DELETE", undefined, id);
    addNotification("Событие удалено");
  };

  const handleDeleteMember = async (id: number, nick: string) => {
    if (!confirm(`Исключить ${nick} из Орды?`)) return;
    setMembers(prev => prev.filter(m => m.id !== id));
    await api("members", "DELETE", undefined, id);
    addNotification(`${nick} исключён из Орды`);
  };

  const getJoinLink = () => {
    const base = window.location.origin + window.location.pathname;
    return `${base}?join=1`;
  };

  const filteredMembers = members.filter(m =>
    m.nick.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.rank.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const themes = {
    dark: "",
    fire: "hue-rotate-[-10deg]",
    shadow: "hue-rotate-[220deg]",
  };

  const navItems = [
    { id: "home", label: "Главная", icon: "Home" },
    { id: "chat", label: "Чат", icon: "MessageSquare" },
    { id: "members", label: "Члены", icon: "Users" },
    { id: "rules", label: "Правила", icon: "Scroll" },
    { id: "events", label: "События", icon: "Calendar" },
    { id: "history", label: "История", icon: "BookOpen" },
    { id: "admin", label: "Глава", icon: "Crown" },
  ];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(var(--background))" }}>
      <div className="text-center">
        <div className="text-6xl fire-glow mb-4">💀</div>
        <div className="horde-title text-3xl mb-2">ОРДА</div>
        <div className="text-sm text-muted-foreground font-raleway animate-pulse">Загрузка...</div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen text-foreground ${themes[activeTheme]}`}>
      {/* Floating embers */}
      {[...Array(8)].map((_, i) => (
        <div key={i} className="ember" style={{ left: `${8 + i * 11}%`, bottom: "0", animationDelay: `${i * 0.9}s`, animationDuration: `${5 + i * 0.6}s` }} />
      ))}

      {/* Welcome overlay */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.88)" }}>
          <div className="text-center animate-scale-in px-8">
            <div className="text-7xl mb-6 fire-glow">⚔️</div>
            <h1 className="horde-title text-4xl md:text-5xl mb-4">Добро пожаловать в ОРДУ!</h1>
            <p className="font-cinzel text-xl" style={{ color: "hsl(var(--horde-gold))" }}>
              Воин {joinNick} — ты среди своих!
            </p>
            <p className="text-muted-foreground mt-3 font-raleway text-sm">Слава Орде! Вместе мы непобедимы!</p>
          </div>
        </div>
      )}

      {/* Notifications */}
      <div className="fixed top-4 right-4 z-40 flex flex-col gap-2 pointer-events-none">
        {notifications.slice(0, 3).map((n, i) => (
          <div key={i} className="animate-fade-in px-4 py-2 rounded-lg text-sm font-raleway"
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--primary) / 0.4)", color: "hsl(var(--horde-gold))" }}>
            🔔 {n}
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--background) / 0.97)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <button onClick={() => setPage("home")} className="flex items-center gap-3 flex-shrink-0">
            <span className="text-2xl fire-glow">💀</span>
            <div>
              <div className="horde-title text-xl leading-none">ОРДА</div>
              <div className="text-xs font-raleway text-muted-foreground">Puzzles Conquest</div>
            </div>
          </button>

          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {navItems.map(item => (
              <button key={item.id} onClick={() => setPage(item.id as Page)}
                className={`nav-item flex items-center gap-1.5 ${page === item.id ? "active" : ""}`}>
                <Icon name={item.icon as "Home"} size={13} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden md:flex items-center gap-1">
              {([{ key: "dark", icon: "🌑" }, { key: "fire", icon: "🔥" }, { key: "shadow", icon: "🌌" }] as const).map(t => (
                <button key={t.key} onClick={() => setActiveTheme(t.key)}
                  className={`w-7 h-7 rounded text-sm flex items-center justify-center transition-all ${activeTheme === t.key ? "border border-primary bg-card" : "opacity-40 hover:opacity-100"}`}>
                  {t.icon}
                </button>
              ))}
            </div>

            {currentUser ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="font-cinzel text-xs" style={{ color: "hsl(var(--horde-gold))" }}>{currentUser.nick}</span>
              </div>
            ) : (
              <button onClick={() => setPage("join")} className="horde-btn px-4 py-2 rounded-lg text-xs">
                Вступить
              </button>
            )}

            <button className="lg:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Icon name={mobileMenuOpen ? "X" : "Menu"} size={20} />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t" style={{ borderColor: "hsl(var(--border))" }}>
            {navItems.map(item => (
              <button key={item.id} onClick={() => { setPage(item.id as Page); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${page === item.id ? "text-primary" : "text-muted-foreground"} hover:text-foreground`}>
                <Icon name={item.icon as "Home"} size={16} />
                <span className="font-cinzel text-sm">{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* ---- JOIN PAGE ---- */}
        {page === "join" && (
          <div className="page-enter min-h-[70vh] flex items-center justify-center">
            <div className="horde-card rounded-2xl p-10 max-w-md w-full text-center">
              <div className="text-6xl mb-4 fire-glow">⚔️</div>
              <h2 className="horde-heading text-2xl mb-2">Вступить в Орду</h2>
              <p className="text-sm text-muted-foreground font-raleway mb-8">
                Ты получил приглашение в один из сильнейших альянсов. Выбери свой путь, воин!
              </p>
              <input
                value={joinNick}
                onChange={e => setJoinNick(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleJoin()}
                placeholder="Твой ник в игре..."
                className="w-full px-4 py-3 rounded-lg text-sm font-raleway outline-none mb-2"
                style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}
              />
              {joinError && <p className="text-red-400 text-xs mb-3">{joinError}</p>}
              <div className="flex gap-3 mt-4">
                <button onClick={handleJoin} className="horde-btn flex-1 py-3 rounded-lg">
                  ⚔️ Вступить
                </button>
                <button onClick={() => setPage("home")}
                  className="flex-1 py-3 rounded-lg font-cinzel text-xs uppercase font-semibold transition-colors"
                  style={{ background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))" }}>
                  Отказаться
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---- HOME PAGE ---- */}
        {page === "home" && (
          <div className="page-enter space-y-8">
            <div className="relative rounded-2xl overflow-hidden h-64 md:h-96">
              <img src={BANNER_URL} alt="ОРДА" className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
                style={{ background: "linear-gradient(to top, hsl(var(--background)) 0%, transparent 50%, hsl(var(--background) / 0.4) 100%)" }}>
                <h1 className="horde-title text-5xl md:text-7xl mb-2">ОРДА</h1>
                <p className="font-cinzel text-xs md:text-sm tracking-widest mb-6 text-muted-foreground">
                  АЛЬЯНС · PUZZLES CONQUEST
                </p>
                <div className="flex gap-3 flex-wrap justify-center">
                  <button onClick={() => { navigator.clipboard.writeText(getJoinLink()); addNotification("Ссылка скопирована!"); }}
                    className="horde-btn px-5 py-2.5 rounded-lg text-xs flex items-center gap-2">
                    <Icon name="Link" size={13} /> Пригласить
                  </button>
                  <button onClick={() => setPage("chat")}
                    className="px-5 py-2.5 rounded-lg font-cinzel text-xs uppercase font-semibold flex items-center gap-2 transition-colors"
                    style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}>
                    <Icon name="MessageSquare" size={13} /> Чат
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: "Users", label: "Членов", value: members.length },
                { icon: "Wifi", label: "Онлайн", value: members.filter(m => m.isOnline).length },
                { icon: "MessageSquare", label: "Сообщений", value: messages.filter(m => !m.isSystem).length },
                { icon: "Trophy", label: "Рангов", value: RANKS.length },
              ].map(s => (
                <div key={s.label} className="horde-card rounded-xl p-4 text-center">
                  <Icon name={s.icon as "Users"} size={22} style={{ color: "hsl(var(--primary))", margin: "0 auto 8px" } as React.CSSProperties} />
                  <div className="font-cinzel text-2xl font-bold" style={{ color: "hsl(var(--horde-gold))" }}>{s.value}</div>
                  <div className="text-xs text-muted-foreground font-raleway mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            <div>
              <h2 className="horde-heading text-lg mb-4 flex items-center gap-2">
                <Icon name="Calendar" size={18} /> Ближайшие события
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                {events.map(e => (
                  <div key={e.id} className="horde-card rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-cinzel text-sm font-semibold" style={{ color: "hsl(var(--horde-gold))" }}>{e.title}</span>
                      <span className="text-xs text-muted-foreground font-raleway">{e.date}</span>
                    </div>
                    <p className="text-sm text-muted-foreground font-raleway">{e.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="horde-card rounded-xl p-6">
              <h2 className="horde-heading text-lg mb-4 flex items-center gap-2">
                <Icon name="Scroll" size={18} /> Кодекс Орды
              </h2>
              <ul className="space-y-2">
                {rules.slice(0, 3).map((r, i) => (
                  <li key={r.id} className="flex items-start gap-3 text-sm font-raleway text-muted-foreground">
                    <span className="font-cinzel text-primary font-bold">{i + 1}.</span>
                    {r.text}
                  </li>
                ))}
              </ul>
              <button onClick={() => setPage("rules")} className="mt-4 text-xs font-cinzel transition-colors hover:text-foreground" style={{ color: "hsl(var(--primary))" }}>
                Все правила →
              </button>
            </div>
          </div>
        )}

        {/* ---- CHAT PAGE ---- */}
        {page === "chat" && (
          <div className="page-enter space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="horde-heading text-xl flex items-center gap-2">
                <Icon name="MessageSquare" size={20} /> Чат Орды
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-raleway">Перевод:</span>
                <select value={translateLang} onChange={e => setTranslateLang(e.target.value)}
                  className="text-xs font-raleway px-2 py-1.5 rounded-lg outline-none cursor-pointer"
                  style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}>
                  {TRANSLATE_LANGS.map(l => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="horde-card rounded-xl flex flex-col" style={{ height: "60vh" }}>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={`chat-bubble ${msg.isSystem ? "text-center" : ""}`}>
                    {msg.isSystem ? (
                      <span className="inline-block px-4 py-1.5 rounded-full text-xs font-raleway"
                        style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary) / 0.25)" }}>
                        ⚡ {msg.text}
                      </span>
                    ) : (
                      <div className="flex items-start gap-3 group">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-cinzel text-sm font-bold"
                          style={{ background: `${RANK_COLORS[msg.rank] || "#888"}22`, color: RANK_COLORS[msg.rank] || "#888", border: `1px solid ${RANK_COLORS[msg.rank] || "#888"}44` }}>
                          {msg.author[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-cinzel text-xs font-semibold" style={{ color: RANK_COLORS[msg.rank] || "hsl(var(--foreground))" }}>
                              {msg.author}
                            </span>
                            <span className="rank-badge px-1.5 py-0.5 rounded" style={{ background: `${RANK_COLORS[msg.rank] || "#888"}22`, color: RANK_COLORS[msg.rank] || "#888" }}>
                              {msg.rank}
                            </span>
                            <span className="text-xs text-muted-foreground">{msg.time}</span>
                          </div>
                          <p className="text-sm font-raleway">{msg.text}</p>
                          {msg.translated && (
                            <p className="text-xs mt-1 italic font-raleway" style={{ color: "hsl(var(--primary))" }}>
                              🌐 {msg.translated}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleTranslate(msg.id, msg.text)}
                              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                              {translating === msg.id ? "⏳" : <><Icon name="Globe" size={11} /> Перевести</>}
                            </button>
                            {adminUnlocked && (
                              <button onClick={() => handleDeleteMessage(msg.id)}
                                className="text-xs text-destructive hover:text-red-400 transition-colors flex items-center gap-1">
                                <Icon name="Trash2" size={11} /> Удалить
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="border-t p-3 flex gap-2" style={{ borderColor: "hsl(var(--border))" }}>
                {currentUser ? (
                  <>
                    <input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSendMessage()}
                      placeholder={`Пишет ${currentUser.nick}...`}
                      className="flex-1 px-4 py-2 rounded-lg text-sm font-raleway outline-none"
                      style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}
                    />
                    <button onClick={handleSendMessage} className="horde-btn px-4 py-2 rounded-lg">
                      <Icon name="Send" size={16} />
                    </button>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center gap-3">
                    <span className="text-sm text-muted-foreground font-raleway">Чтобы писать — вступи в Орду</span>
                    <button onClick={() => setPage("join")} className="horde-btn px-4 py-2 rounded-lg text-xs">
                      Вступить
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---- MEMBERS PAGE ---- */}
        {page === "members" && (
          <div className="page-enter space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="horde-heading text-xl flex items-center gap-2">
                <Icon name="Users" size={20} /> Члены Орды ({members.length})
              </h2>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
                <Icon name="Search" size={14} className="text-muted-foreground" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Поиск..."
                  className="text-sm font-raleway outline-none bg-transparent" style={{ color: "hsl(var(--foreground))", width: "140px" }} />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {filteredMembers.map(member => (
                <div key={member.id} className="horde-card rounded-xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-cinzel text-lg font-bold flex-shrink-0"
                    style={{ background: `${RANK_COLORS[member.rank] || "#888"}22`, color: RANK_COLORS[member.rank] || "#888", border: `1px solid ${RANK_COLORS[member.rank] || "#888"}44` }}>
                    {member.nick[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-cinzel text-sm font-semibold truncate">{member.nick}</span>
                      {member.isOnline && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="rank-badge px-2 py-0.5 rounded" style={{ background: `${RANK_COLORS[member.rank] || "#888"}22`, color: RANK_COLORS[member.rank] || "#888" }}>
                        {member.rank}
                      </span>
                      <span className="text-xs text-muted-foreground font-raleway">с {member.joinedAt}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- RULES PAGE ---- */}
        {page === "rules" && (
          <div className="page-enter space-y-4">
            <h2 className="horde-heading text-xl flex items-center gap-2">
              <Icon name="Scroll" size={20} /> Кодекс Орды
            </h2>
            <div className="horde-card rounded-xl p-6 space-y-5">
              {rules.map((rule, i) => (
                <div key={rule.id} className="flex items-start gap-4 group">
                  <span className="font-cinzel text-2xl font-bold flex-shrink-0" style={{ color: "hsl(var(--primary))" }}>{i + 1}</span>
                  {editingRule === rule.id && adminUnlocked ? (
                    <input
                      defaultValue={rule.text}
                      onBlur={e => handleSaveRule(rule.id, e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSaveRule(rule.id, (e.target as HTMLInputElement).value)}
                      autoFocus
                      className="flex-1 px-3 py-1.5 rounded text-sm font-raleway outline-none"
                      style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--primary))", color: "hsl(var(--foreground))" }}
                    />
                  ) : (
                    <div className="flex-1 flex items-start justify-between gap-2">
                      <p className="text-sm font-raleway leading-relaxed">{rule.text}</p>
                      {adminUnlocked && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => setEditingRule(rule.id)} className="p-1 text-muted-foreground hover:text-primary transition-colors">
                            <Icon name="Pencil" size={14} />
                          </button>
                          <button onClick={() => handleDeleteRule(rule.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                            <Icon name="Trash2" size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {adminUnlocked && (
                <div className="flex gap-2 mt-4 pt-4 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                  <input value={newRuleText} onChange={e => setNewRuleText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddRule()}
                    placeholder="Новое правило..."
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-raleway outline-none"
                    style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                  <button onClick={handleAddRule} className="horde-btn px-4 py-2 rounded-lg">
                    <Icon name="Plus" size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- HISTORY PAGE ---- */}
        {page === "history" && (
          <div className="page-enter space-y-4">
            <h2 className="horde-heading text-xl flex items-center gap-2">
              <Icon name="BookOpen" size={20} /> Летопись Орды
            </h2>
            <div className="horde-card rounded-xl p-8">
              <div className="flex justify-center mb-8">
                <span className="text-6xl fire-glow">💀</span>
              </div>
              {HISTORY_TEXT.split("\n\n").map((para, i) => (
                <p key={i} className="font-raleway text-sm leading-relaxed text-muted-foreground mb-5 last:mb-0">
                  {i === 0 && <span className="font-cinzel text-base font-semibold mr-1" style={{ color: "hsl(var(--horde-gold))" }}>Д</span>}
                  {i === 0 ? para.slice(1) : para}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* ---- EVENTS PAGE ---- */}
        {page === "events" && (
          <div className="page-enter space-y-4">
            <h2 className="horde-heading text-xl flex items-center gap-2">
              <Icon name="Calendar" size={20} /> События Орды
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {events.map(e => (
                <div key={e.id} className="horde-card rounded-xl p-6">
                  <div className="text-3xl mb-3">⚔️</div>
                  <h3 className="font-cinzel text-sm font-bold mb-1" style={{ color: "hsl(var(--horde-gold))" }}>{e.title}</h3>
                  <p className="text-xs text-muted-foreground font-raleway mb-3">{e.desc}</p>
                  <div className="flex items-center gap-2 text-xs font-cinzel" style={{ color: "hsl(var(--primary))" }}>
                    <Icon name="Calendar" size={12} /> {e.date}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- ADMIN PAGE ---- */}
        {page === "admin" && (
          <div className="page-enter space-y-6">
            <h2 className="horde-heading text-xl flex items-center gap-2">
              <Icon name="Crown" size={20} /> Панель Главы
            </h2>

            {!adminUnlocked ? (
              <div className="max-w-sm mx-auto">
                <div className="horde-card rounded-xl p-8 text-center">
                  <div className="text-5xl mb-4 fire-glow">👑</div>
                  <h3 className="font-cinzel text-lg font-semibold mb-6" style={{ color: "hsl(var(--horde-gold))" }}>Вход для Главы</h3>
                  <input type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAdminLogin()}
                    placeholder="Пароль главы..."
                    className="w-full px-4 py-3 rounded-lg text-sm font-raleway outline-none mb-4"
                    style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                  <button onClick={handleAdminLogin} className="horde-btn w-full py-3 rounded-lg">Войти</button>
                  <p className="text-xs text-muted-foreground mt-3 font-raleway opacity-50">Пароль: орда2024</p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="horde-card rounded-xl p-6">
                  <h3 className="font-cinzel text-sm font-semibold mb-4" style={{ color: "hsl(var(--horde-gold))" }}>👑 Ник Главы</h3>
                  <div className="flex gap-2">
                    <input value={adminNick} onChange={e => setAdminNick(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-raleway outline-none"
                      style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                    <button onClick={async () => {
                      const chief = members.find(m => m.rank === "Глава");
                      if (chief) {
                        await api("members", "PUT", { nick: adminNick }, chief.id);
                        setMembers(prev => prev.map(m => m.rank === "Глава" ? { ...m, nick: adminNick } : m));
                      }
                      if (currentUser) setCurrentUser({ ...currentUser, nick: adminNick });
                      addNotification("Ник обновлён!");
                    }} className="horde-btn px-4 py-2 rounded-lg text-xs">Сохранить</button>
                  </div>
                </div>

                <div className="horde-card rounded-xl p-6">
                  <h3 className="font-cinzel text-sm font-semibold mb-4" style={{ color: "hsl(var(--horde-gold))" }}>⚔️ Участники и ранги</h3>
                  <div className="space-y-2">
                    {members.map(member => (
                      <div key={member.id} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 font-cinzel text-xs font-bold"
                          style={{ background: `${RANK_COLORS[member.rank] || "#888"}22`, color: RANK_COLORS[member.rank] || "#888" }}>
                          {member.nick[0]}
                        </div>
                        <span className="font-cinzel text-sm flex-1 truncate">{member.nick}</span>
                        <select value={member.rank} onChange={e => handleSetRank(member.id, e.target.value)}
                          className="text-xs font-raleway px-2 py-1.5 rounded-lg outline-none cursor-pointer"
                          style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))", color: RANK_COLORS[member.rank] || "hsl(var(--foreground))" }}>
                          {RANKS.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <button onClick={() => handleDeleteMember(member.id, member.nick)}
                          className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 p-1">
                          <Icon name="Trash2" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="horde-card rounded-xl p-6">
                  <h3 className="font-cinzel text-sm font-semibold mb-4" style={{ color: "hsl(var(--horde-gold))" }}>📅 Управление событиями</h3>
                  <div className="space-y-3 mb-4">
                    {events.map(e => (
                      <div key={e.id} className="flex items-center justify-between gap-3 p-2 rounded-lg" style={{ background: "hsl(var(--background))" }}>
                        <div className="flex-1 min-w-0">
                          <span className="font-cinzel text-xs font-semibold" style={{ color: "hsl(var(--horde-gold))" }}>{e.title}</span>
                          <span className="text-xs text-muted-foreground font-raleway ml-2">{e.date}</span>
                          <p className="text-xs text-muted-foreground font-raleway truncate mt-0.5">{e.desc}</p>
                        </div>
                        <button onClick={() => handleDeleteEvent(e.id)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 p-1">
                          <Icon name="Trash2" size={14} />
                        </button>
                      </div>
                    ))}
                    {events.length === 0 && <p className="text-xs text-muted-foreground font-raleway">Событий пока нет</p>}
                  </div>
                  <div className="space-y-2 border-t pt-3" style={{ borderColor: "hsl(var(--border))" }}>
                    <input value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
                      placeholder="Название события..."
                      className="w-full px-3 py-2 rounded-lg text-sm font-raleway outline-none"
                      style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                    <div className="flex gap-2">
                      <input value={newEvent.date} onChange={e => setNewEvent(p => ({ ...p, date: e.target.value }))}
                        placeholder="Дата (напр. 01.04.2026)..."
                        className="flex-1 px-3 py-2 rounded-lg text-sm font-raleway outline-none"
                        style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                    </div>
                    <div className="flex gap-2">
                      <input value={newEvent.desc} onChange={e => setNewEvent(p => ({ ...p, desc: e.target.value }))}
                        placeholder="Описание..."
                        className="flex-1 px-3 py-2 rounded-lg text-sm font-raleway outline-none"
                        style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                      <button onClick={handleAddEvent} className="horde-btn px-4 py-2 rounded-lg flex-shrink-0">
                        <Icon name="Plus" size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="horde-card rounded-xl p-6">
                  <h3 className="font-cinzel text-sm font-semibold mb-4" style={{ color: "hsl(var(--horde-gold))" }}>🗑️ Управление чатом</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {messages.filter(m => !m.isSystem).map(msg => (
                      <div key={msg.id} className="flex items-center justify-between gap-3 p-2 rounded-lg" style={{ background: "hsl(var(--background))" }}>
                        <div className="flex-1 min-w-0">
                          <span className="font-cinzel text-xs font-semibold" style={{ color: RANK_COLORS[msg.rank] || "hsl(var(--foreground))" }}>{msg.author}: </span>
                          <span className="text-xs text-muted-foreground font-raleway truncate">{msg.text}</span>
                        </div>
                        <button onClick={() => handleDeleteMessage(msg.id)} className="text-destructive hover:text-red-400 transition-colors flex-shrink-0">
                          <Icon name="Trash2" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      <footer className="mt-12 border-t py-6 text-center" style={{ borderColor: "hsl(var(--border))" }}>
        <div className="horde-title text-lg mb-1">ОРДА</div>
        <p className="text-xs text-muted-foreground font-raleway">Puzzles Conquest · Вместе непобедимы ⚔️</p>
      </footer>
    </div>
  );
}