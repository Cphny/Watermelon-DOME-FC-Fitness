import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Flame, Plus, Dumbbell, Users, X, SmilePlus } from "lucide-react";
import { supabase, DEFAULT_GROUP_ID } from "./supabaseClient";

const REACTION_EMOJIS = ["🔥", "💪", "👑", "🍅", "💀", "😴"];
const MEMBER_COLORS = ["#CC5B3D", "#3C6B45", "#6B7A9A", "#8A5FA6", "#B8853A", "#4A8A8C"];

const ACCENT = "#CC5B3D";
const ACCENT_SOFT = "#E0836A";
const SUCCESS = "#3C6B45";
const INK = "#26241F";
const STONE = "#EFEBE0";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function daysAgoLabel(dateStr) {
  const diff = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff} days ago`;
}

const WEEKLY_TITLES = [
  "Minister of Leg Day",
  "Professional Snoozer",
  "Cardio Cryptid",
  "Ambassador of Almost",
  "Chief Sweat Officer",
  "Squat Whisperer",
  "The Warm-Up Warm-Upper",
  "Treadmill Philosopher",
  "Director of Vibes",
  "Secretly Very Strong",
  "Gym Bag Enthusiast",
  "Rest Day Historian",
  "Chronically Almost Ready",
  "Head of Deep Breathing",
  "Speedrunner (Showers Only)",
  "Certified Iron Enjoyer",
  "Snack Break Specialist",
  "Motivational Poster Come to Life",
];

function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

function weeklyTitleFor(profileId) {
  const seed = `${profileId}-${getWeekKey()}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return WEEKLY_TITLES[hash % WEEKLY_TITLES.length];
}

const CATEGORIES = ["Cardio", "Weights", "Yoga", "Sports", "Rest day", "Other"];

function computeStreak(profileId, logs) {
  const dates = new Set(logs.filter((l) => l.profile_id === profileId).map((l) => l.logged_date));
  let streak = 0;
  let cursor = new Date();
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (dates.has(iso)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (streak === 0 && iso === todayIso()) {
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authError, setAuthError] = useState("");

  const [profile, setProfile] = useState(null);
  const [nameDraft, setNameDraft] = useState("");

  const [members, setMembers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [callouts, setCallouts] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [exercise, setExercise] = useState("");
  const [detail, setDetail] = useState("");
  const [openPickerFor, setOpenPickerFor] = useState(null);
  const [actionError, setActionError] = useState("");

  // --- Auth ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function sendMagicLink(e) {
    e.preventDefault();
    setAuthError("");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    if (error) setAuthError(error.message);
    else setMagicLinkSent(true);
  }

  // --- Profile: load or create, then join the default group ---
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function loadProfile() {
      const { data: existing } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!cancelled) setProfile(existing || null);
    }
    loadProfile();
    return () => { cancelled = true; };
  }, [session]);

  async function createProfileAndJoin(name) {
    const trimmed = name.trim();
    if (!trimmed || !session) return;
    const color = MEMBER_COLORS[members.length % MEMBER_COLORS.length];
    const { data: newProfile, error: profileError } = await supabase
      .from("profiles")
      .insert({ id: session.user.id, display_name: trimmed, color })
      .select()
      .single();
    if (profileError) {
      setActionError(profileError.message);
      return;
    }
    await supabase.from("group_members").insert({ group_id: DEFAULT_GROUP_ID, profile_id: session.user.id });
    setProfile(newProfile);
  }

  // --- Load group data once we have a profile ---
  const loadData = useCallback(async () => {
    const [{ data: membersData }, { data: workoutsData }, { data: reactionsData }, { data: calloutsData }] =
      await Promise.all([
        supabase
          .from("group_members")
          .select("profile_id, profiles(id, display_name, color)")
          .eq("group_id", DEFAULT_GROUP_ID),
        supabase
          .from("workouts")
          .select("*")
          .eq("group_id", DEFAULT_GROUP_ID)
          .order("logged_date", { ascending: false }),
        supabase.from("reactions").select("*"),
        supabase
          .from("callouts")
          .select("*")
          .eq("group_id", DEFAULT_GROUP_ID)
          .order("created_at", { ascending: false }),
      ]);
    setMembers((membersData || []).map((m) => ({ id: m.profile_id, name: m.profiles?.display_name || "?", color: m.profiles?.color || "#888780" })));
    setLogs(workoutsData || []);
    setReactions(reactionsData || []);
    setCallouts(calloutsData || []);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (!profile) return;
    loadData();

    // Realtime: refetch whenever anyone changes the shared tables
    const channel = supabase
      .channel("workout-squad-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "workouts" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "callouts" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, loadData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile, loadData]);

  const streaks = useMemo(() => members.map((m) => ({ ...m, streak: computeStreak(m.id, logs) })), [members, logs]);
  const weekCount = logs.filter((l) => (new Date() - new Date(l.logged_date)) / (1000 * 60 * 60 * 24) < 7).length;
  const leader = streaks.length ? [...streaks].sort((a, b) => b.streak - a.streak)[0] : null;

  const feed = [
    ...logs.map((l) => ({ ...l, kind: "log" })),
    ...callouts.map((c) => ({ ...c, kind: "callout", logged_date: c.created_at?.slice(0, 10) })),
  ].sort((a, b) => new Date(b.logged_date || b.created_at) - new Date(a.logged_date || a.created_at));

  const memberById = (id) => members.find((m) => m.id === id) || { name: "Someone", color: "#888780" };

  async function quickLog(exerciseName, detailText = "") {
    if (!profile) return;
    setActionError("");
    const { error } = await supabase.from("workouts").insert({
      group_id: DEFAULT_GROUP_ID,
      profile_id: profile.id,
      exercise: exerciseName,
      detail: detailText,
      logged_date: todayIso(),
    });
    if (error) setActionError(error.message);
    setShowForm(false);
    setCustomMode(false);
  }

  function addLog(e) {
    e.preventDefault();
    if (!exercise.trim()) return;
    quickLog(exercise.trim(), detail.trim());
    setExercise("");
    setDetail("");
  }

  async function toggleReaction(workoutId, emoji) {
    if (!profile) return;
    const existing = reactions.find((r) => r.workout_id === workoutId && r.emoji === emoji && r.profile_id === profile.id);
    if (existing) {
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else {
      const { error } = await supabase.from("reactions").insert({ workout_id: workoutId, profile_id: profile.id, emoji });
      if (error) setActionError(error.message);
    }
    setOpenPickerFor(null);
  }

  async function throwTomato(targetProfileId) {
    if (!profile) return;
    const { error } = await supabase.from("callouts").insert({
      group_id: DEFAULT_GROUP_ID,
      from_profile_id: profile.id,
      target_profile_id: targetProfileId,
      emoji: "🍅",
    });
    if (error) setActionError(error.message);
  }

  const myLogs = profile ? logs.filter((l) => l.profile_id === profile.id) : [];
  const yesterdayLog = myLogs.find((l) => l.logged_date === isoDaysAgo(1));
  const frequentExercises = useMemo(() => {
    const counts = {};
    myLogs.forEach((l) => { counts[l.exercise] = (counts[l.exercise] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .filter((name) => name !== yesterdayLog?.exercise)
      .slice(0, 4);
  }, [myLogs, yesterdayLog]);

  // --- Screens ---
  if (authLoading) return <CenteredMessage>Loading...</CenteredMessage>;

  if (!session) {
    return (
      <CenteredCard title="Sign in to Workout Squad" subtitle="No password needed — we'll email you a magic link.">
        {magicLinkSent ? (
          <p style={{ fontFamily: "Inter", fontSize: 14 }}>Check your inbox for a sign-in link.</p>
        ) : (
          <form onSubmit={sendMagicLink}>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              style={{ fontFamily: "Inter" }}
              className="w-full border rounded-lg px-3 py-2 mb-3 text-sm"
            />
            {authError && <p style={{ fontFamily: "Inter", fontSize: 12, color: "#A32D2D" }} className="mb-3">{authError}</p>}
            <button type="submit" style={{ background: SUCCESS, fontFamily: "Inter" }} className="w-full text-white rounded-lg py-2.5 font-medium text-sm">
              Send magic link
            </button>
          </form>
        )}
      </CenteredCard>
    );
  }

  if (!profile) {
    return (
      <CenteredCard title="What's your name?" subtitle="This is how your friends will see you in the group.">
        <input
          autoFocus
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") createProfileAndJoin(nameDraft); }}
          placeholder="Your name"
          style={{ fontFamily: "Inter" }}
          className="w-full border rounded-lg px-3 py-2 mb-3 text-sm"
        />
        {actionError && <p style={{ fontFamily: "Inter", fontSize: 12, color: "#A32D2D" }} className="mb-3">{actionError}</p>}
        <button onClick={() => createProfileAndJoin(nameDraft)} style={{ background: SUCCESS, fontFamily: "Inter" }} className="w-full text-white rounded-lg py-2.5 font-medium text-sm">
          Join group
        </button>
      </CenteredCard>
    );
  }

  if (dataLoading) return <CenteredMessage>Loading group...</CenteredMessage>;

  return (
    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", background: STONE, minHeight: "100vh", color: INK }}>
      <div className="max-w-md mx-auto pb-24">
        <div style={{ background: INK }} className="px-5 pt-6 pb-5 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={18} style={{ color: "#F0997B" }} />
              <span style={{ fontFamily: "Inter", fontSize: 13, letterSpacing: 1 }} className="uppercase text-white/60">Watermelon Dome FC</span>
            </div>
            <span style={{ fontFamily: "Inter", fontSize: 11 }} className="text-white/40">{members.length} members · you're {profile.display_name}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ScoreboardStat label="This week" value={weekCount} suffix="sessions" />
            <ScoreboardStat label="Top streak" value={leader ? leader.streak : 0} suffix={leader ? leader.name : "—"} accent color={ACCENT_SOFT} />
            <ScoreboardStat label="Group total" value={logs.length} suffix="logged" />
          </div>
        </div>

        {actionError && <p style={{ fontFamily: "Inter", fontSize: 12, color: "#A32D2D", background: "#FCEBEB" }} className="px-5 py-2">{actionError}</p>}

        <div className="flex gap-3 px-5 py-4 overflow-x-auto">
          {streaks.map((m) => (
            <div key={m.id} className="flex flex-col items-center gap-1 shrink-0 relative">
              <div style={{ background: m.color, width: 44, height: 44 }} className="rounded-full flex items-center justify-center text-white font-semibold">
                <span style={{ fontFamily: "Inter" }}>{m.name[0]?.toUpperCase()}</span>
              </div>
              {m.id !== profile.id && m.streak === 0 && (
                <button
                  onClick={() => throwTomato(m.id)}
                  aria-label={`Call out ${m.name} for skipping`}
                  style={{ fontSize: 14, background: "white", border: "1px solid #D3D1C7" }}
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                >
                  🍅
                </button>
              )}
              <span style={{ fontFamily: "Inter", fontSize: 12 }}>{m.name}{m.id === profile.id ? " (you)" : ""}</span>
              <div className="flex items-center gap-1">
                <Flame size={12} style={{ color: m.streak > 0 ? ACCENT : "#B4B2A9" }} fill={m.streak > 0 ? ACCENT : "none"} />
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 700 }}>{m.streak}</span>
              </div>
              <span
                style={{ fontFamily: "Inter", fontSize: 10, background: "#FAEEDA", color: "#854F0B" }}
                className="rounded-full px-2 py-0.5 text-center max-w-[92px] leading-tight"
              >
                {weeklyTitleFor(m.id)}
              </span>
            </div>
          ))}
        </div>

        <div className="px-5 mt-2">
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell size={16} />
            <h2 style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 600 }}>Activity</h2>
          </div>
          <div className="flex flex-col gap-2">
            {feed.length === 0 && <p style={{ fontFamily: "Inter", fontSize: 13 }} className="text-gray-500">Nobody's logged anything yet. Be the first.</p>}
            {feed.map((item) => {
              if (item.kind === "callout") {
                const target = memberById(item.target_profile_id);
                const from = memberById(item.from_profile_id);
                return (
                  <div key={`c-${item.id}`} style={{ border: "1px dashed #D4826F", background: "#FAECE7" }} className="rounded-lg px-4 py-3 flex items-center gap-3">
                    <span style={{ fontSize: 20 }}>{item.emoji}</span>
                    <p style={{ fontFamily: "Inter", fontSize: 13 }} className="flex-1">
                      <span style={{ fontWeight: 500 }}>{from.name}</span> called out <span style={{ fontWeight: 500 }}>{target.name}</span> for skipping
                    </p>
                    <span style={{ fontFamily: "Inter", fontSize: 11 }} className="text-gray-400 shrink-0">{daysAgoLabel(item.logged_date)}</span>
                  </div>
                );
              }
              const log = item;
              const m = memberById(log.profile_id);
              const logReactions = reactions.filter((r) => r.workout_id === log.id);
              const counts = {};
              logReactions.forEach((r) => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
              const activeEmojis = Object.entries(counts);

              return (
                <div key={log.id} className="bg-white rounded-lg px-4 py-3" style={{ border: "1px solid #D3D1C7" }}>
                  <div className="flex items-center gap-3">
                    <div style={{ background: m.color, width: 32, height: 32 }} className="rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      <span style={{ fontFamily: "Inter" }}>{m.name[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 500 }} className="truncate">{m.name} · {log.exercise}</p>
                      {log.detail && <p style={{ fontFamily: "Inter", fontSize: 12 }} className="text-gray-500 truncate">{log.detail}</p>}
                    </div>
                    <span style={{ fontFamily: "Inter", fontSize: 11 }} className="text-gray-400 shrink-0">{daysAgoLabel(log.logged_date)}</span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-2 flex-wrap relative">
                    {activeEmojis.map(([emoji, count]) => {
                      const mine = reactions.some((r) => r.workout_id === log.id && r.emoji === emoji && r.profile_id === profile.id);
                      return (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(log.id, emoji)}
                          style={{ fontFamily: "Inter", fontSize: 12, background: mine ? "#FAEEDA" : "#F1EFE8", border: mine ? "1px solid #BA7517" : "1px solid transparent" }}
                          className="rounded-full px-2 py-0.5 flex items-center gap-1"
                        >
                          <span>{emoji}</span>
                          <span style={{ fontFamily: "JetBrains Mono" }}>{count}</span>
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setOpenPickerFor(openPickerFor === log.id ? null : log.id)}
                      aria-label="Add reaction"
                      style={{ background: "#F1EFE8" }}
                      className="rounded-full w-6 h-6 flex items-center justify-center"
                    >
                      <SmilePlus size={13} />
                    </button>
                    {openPickerFor === log.id && (
                      <div style={{ border: "1px solid #D3D1C7" }} className="absolute bottom-8 left-0 bg-white rounded-lg px-2 py-1.5 flex gap-1.5 shadow-lg z-10">
                        {REACTION_EMOJIS.map((emoji) => (
                          <button key={emoji} onClick={() => toggleReaction(log.id, emoji)} style={{ fontSize: 18 }} className="hover:scale-125 transition-transform">
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <button onClick={() => setShowForm(true)} style={{ background: ACCENT }} className="fixed bottom-6 right-6 w-14 h-14 rounded-full text-white flex items-center justify-center shadow-lg" aria-label="Log workout">
        <Plus size={26} />
      </button>

      {showForm && (
        <div className="fixed inset-0 flex items-end justify-center" style={{ background: "rgba(28,27,25,0.5)" }} onClick={() => { setShowForm(false); setCustomMode(false); setSelectedCategory(null); }}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-md rounded-t-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontFamily: "Inter", fontWeight: 600 }}>Log a workout</h3>
              <button type="button" onClick={() => { setShowForm(false); setCustomMode(false); setSelectedCategory(null); }} aria-label="Close"><X size={20} /></button>
            </div>
            {!customMode ? (
              <div className="flex flex-col gap-3">
                {yesterdayLog && (
                  <button onClick={() => quickLog(yesterdayLog.exercise, yesterdayLog.detail)} style={{ background: SUCCESS, fontFamily: "Inter" }} className="w-full text-white rounded-lg py-3 font-medium text-sm">
                    Same as yesterday · {yesterdayLog.exercise}
                  </button>
                )}
                {frequentExercises.length > 0 && (
                  <div>
                    <p style={{ fontFamily: "Inter", fontSize: 12 }} className="text-gray-500 mb-2">Or tap a recent one</p>
                    <div className="flex flex-wrap gap-2">
                      {frequentExercises.map((name) => (
                        <button key={name} onClick={() => quickLog(name)} style={{ fontFamily: "Inter", fontSize: 13, border: "1px solid #D3D1C7" }} className="rounded-full px-3 py-2">{name}</button>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => setCustomMode(true)} style={{ fontFamily: "Inter", fontSize: 13, color: "#5F5E5A" }} className="text-left underline underline-offset-2 mt-1">Something else</button>
              </div>
            ) : !selectedCategory ? (
              <div>
                <p style={{ fontFamily: "Inter", fontSize: 12 }} className="text-gray-500 mb-2">What kind of workout?</p>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      style={{ fontFamily: "Inter", fontSize: 14, border: "1px solid #D3D1C7" }}
                      className="rounded-lg py-3"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); const finalExercise = selectedCategory === "Other" ? exercise.trim() : selectedCategory; if (!finalExercise) return; quickLog(finalExercise, detail.trim()); setExercise(""); setDetail(""); setSelectedCategory(null); }}>
                <p style={{ fontFamily: "Inter", fontSize: 12 }} className="text-gray-500 mb-2">
                  {selectedCategory === "Other" ? "Name it" : selectedCategory}
                </p>
                {selectedCategory === "Other" && (
                  <input
                    autoFocus
                    value={exercise}
                    onChange={(e) => setExercise(e.target.value)}
                    placeholder="Exercise name"
                    style={{ fontFamily: "Inter" }}
                    className="w-full border rounded-lg px-3 py-2 mb-3 text-sm"
                  />
                )}
                <input
                  autoFocus={selectedCategory !== "Other"}
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="Details (optional)"
                  style={{ fontFamily: "Inter" }}
                  className="w-full border rounded-lg px-3 py-2 mb-3 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(null)}
                    style={{ fontFamily: "Inter", fontSize: 13, border: "1px solid #D3D1C7" }}
                    className="rounded-lg px-4 py-2.5"
                  >
                    Back
                  </button>
                  <button type="submit" style={{ background: SUCCESS, fontFamily: "Inter" }} className="flex-1 text-white rounded-lg py-2.5 font-medium text-sm">
                    Add to feed
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreboardStat({ label, value, suffix, accent, color }) {
  return (
    <div>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 26, fontWeight: 700, color: accent ? color : "white" }}>{value}</div>
      <div style={{ fontFamily: "Inter", fontSize: 10 }} className="text-white/50 uppercase tracking-wide">{label}</div>
      <div style={{ fontFamily: "Inter", fontSize: 11 }} className="text-white/70">{suffix}</div>
    </div>
  );
}

function CenteredMessage({ children }) {
  return (
    <div style={{ background: STONE, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ fontFamily: "Inter, sans-serif", color: INK }}>{children}</p>
    </div>
  );
}

function CenteredCard({ title, subtitle, children }) {
  return (
    <div style={{ background: STONE, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm" style={{ border: "1px solid #D3D1C7" }}>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: INK }} className="mb-2">{title}</h2>
        {subtitle && <p style={{ fontFamily: "Inter", fontSize: 13 }} className="text-gray-500 mb-4">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
