"use client";

import Image from "next/image";
import { Bell, Check, Dumbbell, Search, ShieldCheck, UserPlus, UsersRound, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { useRepMate } from "@/components/providers/app-provider";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { workoutStats } from "@/lib/workouts";

type Profile = { user_id: string; username: string; display_name: string; avatar_url: string | null; bio: string; notifications_seen_at: string | null };
type Friendship = { id: string; requester_id: string; addressee_id: string; status: "pending" | "accepted" };
type Post = { id: string; user_id: string; workout_id: string | null; workout_summary: { name?: string; duration?: number; volume?: number; sets?: number; units?: string }; caption: string; created_at: string };
type Reaction = { post_id: string; user_id: string; reaction: "strong" | "respect" | "pr"; created_at: string };
type Tab = "feed" | "people" | "requests";

const reactionLabels = { strong: "Strong", respect: "Respect", pr: "PR" } as const;

export default function CirclePage() {
  const { session } = useAuth();
  const state = useRepMate();
  const userId = session?.user.id ?? "";
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [tab, setTab] = useState<Tab>("feed");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const loadCircle = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setSetupRequired(false);
    const own = await supabase.from("social_profiles").select("user_id,display_name").eq("user_id", userId).maybeSingle();
    if (own.error) {
      setSetupRequired(true);
      setLoading(false);
      return;
    }
    const metadataName = session?.user.user_metadata.full_name || session?.user.user_metadata.name;
    const emailName = session?.user.email?.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    const googleName = metadataName || emailName || "RepMate Member";
    if (!own.data) {
      const raw = (session?.user.email?.split("@")[0] || "athlete").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 16);
      await supabase.from("social_profiles").insert({
        user_id: userId,
        username: `${raw.length >= 3 ? raw : "athlete"}_${userId.slice(0, 5)}`,
        display_name: googleName,
        avatar_url: session?.user.user_metadata.avatar_url || state.profile.avatarUrl || null,
      });
    } else if (own.data.display_name === "Athlete" || own.data.display_name === "RepMate Athlete") {
      await supabase.from("social_profiles").update({ display_name: googleName, updated_at: new Date().toISOString() }).eq("user_id", userId);
    }
    const [profileResult, friendshipResult, postResult, reactionResult] = await Promise.all([
      supabase.from("social_profiles").select("user_id,username,display_name,avatar_url,bio,notifications_seen_at").order("display_name"),
      supabase.from("friendships").select("id,requester_id,addressee_id,status"),
      supabase.from("social_posts").select("id,user_id,workout_id,workout_summary,caption,created_at").order("created_at", { ascending: false }).limit(40),
      supabase.from("post_reactions").select("post_id,user_id,reaction,created_at"),
    ]);
    if (profileResult.error) setSetupRequired(true);
    setProfiles((profileResult.data as Profile[]) ?? []);
    setFriendships((friendshipResult.data as Friendship[]) ?? []);
    setPosts((postResult.data as Post[]) ?? []);
    setReactions((reactionResult.data as Reaction[]) ?? []);
    setLoading(false);
  }, [session, state.profile.avatarUrl, userId]);

  useEffect(() => { const initialLoad = window.setTimeout(() => void loadCircle(), 0); return () => window.clearTimeout(initialLoad); }, [loadCircle]);

  const latestWorkout = useMemo(() => state.workouts.filter((workout) => workout.completedAt).sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!))[0], [state.workouts]);
  const incoming = friendships.filter((item) => item.addressee_id === userId && item.status === "pending");
  const profileById = (id: string) => profiles.find((profile) => profile.user_id === id);
  const ownProfile = profileById(userId);
  const ownPostIds = new Set(posts.filter((post) => post.user_id === userId).map((post) => post.id));
  const reactionActivity = reactions.filter((reaction) => reaction.user_id !== userId && ownPostIds.has(reaction.post_id)).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const unreadReactions = reactionActivity.filter((reaction) => !ownProfile?.notifications_seen_at || Date.parse(reaction.created_at) > Date.parse(ownProfile.notifications_seen_at));
  const notificationCount = incoming.length + unreadReactions.length;
  const relationship = (id: string) => friendships.find((item) => (item.requester_id === userId && item.addressee_id === id) || (item.addressee_id === userId && item.requester_id === id));
  const people = profiles.filter((profile) => profile.user_id !== userId && profile.display_name.toLowerCase().includes(query.trim().toLowerCase()));

  const sendRequest = async (addresseeId: string) => {
    const { error } = await supabase.from("friendships").insert({ requester_id: userId, addressee_id: addresseeId });
    if (error) return notify(error.code === "23505" ? "A request already exists." : "Could not send the request.");
    notify("Friend request sent.");
    await loadCircle();
  };
  const acceptRequest = async (friendship: Friendship) => {
    const { error } = await supabase.from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", friendship.id);
    if (error) return notify("Could not accept the request.");
    notify("You are now gym friends.");
    await loadCircle();
  };
  const removeRelationship = async (friendship: Friendship) => {
    const { error } = await supabase.from("friendships").delete().eq("id", friendship.id);
    if (error) return notify("Could not update this connection.");
    notify(friendship.status === "accepted" ? "Friend removed." : "Request removed.");
    await loadCircle();
  };
  const shareLatest = async () => {
    if (!latestWorkout) return notify("Complete a workout before sharing.");
    if (posts.some((post) => post.user_id === userId && post.workout_id === latestWorkout.id)) return notify("This workout is already in your feed.");
    setSharing(true);
    const stats = workoutStats(latestWorkout);
    const { error } = await supabase.from("social_posts").insert({
      user_id: userId,
      workout_id: latestWorkout.id,
      workout_summary: { name: latestWorkout.name, duration: latestWorkout.duration ?? 0, volume: Math.round(stats.volume), sets: stats.sets, units: state.profile.units },
      caption: "Session complete. Showing up counts.",
      visibility: "friends",
    });
    setSharing(false);
    if (error) return notify("Could not share this workout.");
    notify("Workout shared with your friends.");
    await loadCircle();
  };
  const react = async (postId: string, reaction: Reaction["reaction"]) => {
    const current = reactions.find((item) => item.post_id === postId && item.user_id === userId);
    const result = current?.reaction === reaction
      ? await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", userId)
      : await supabase.from("post_reactions").upsert({ post_id: postId, user_id: userId, reaction }, { onConflict: "post_id,user_id" });
    if (result.error) return notify("Could not save your reaction.");
    await loadCircle();
  };
  const changeNotifications = async (open: boolean) => {
    setNotificationsOpen(open);
    if (!open || !unreadReactions.length) return;
    const seenAt = new Date().toISOString();
    const { error } = await supabase.from("social_profiles").update({ notifications_seen_at: seenAt, updated_at: seenAt }).eq("user_id", userId);
    if (!error) {
      setProfiles((items) => items.map((profile) => profile.user_id === userId ? { ...profile, notifications_seen_at: seenAt } : profile));
      window.dispatchEvent(new Event("circle-notifications-changed"));
    }
  };

  if (setupRequired) return <div className="app-page"><PageHeader eyebrow="Train together" title="Gym Circle"/><section className="circle-empty"><ShieldCheck/><h2>Circle needs one quick setup</h2><p>Run <strong>supabase/social.sql</strong> in your Supabase SQL Editor to enable friends, activity, and reactions.</p></section></div>;

  return <div className="app-page circle-page">
    <PageHeader eyebrow="Train together" title="Gym Circle" action={<button className="circle-notification-button" onClick={() => changeNotifications(true)} aria-label={`Circle notifications${notificationCount ? `, ${notificationCount} unread` : ""}`} aria-expanded={notificationsOpen}><Bell/>{notificationCount > 0 && <span>{Math.min(notificationCount, 99)}</span>}</button>}/>
    <Dialog open={notificationsOpen} onOpenChange={changeNotifications}>
      <DialogContent className="circle-notifications-modal max-w-[360px] p-0">
        <header className="circle-notifications-modal__header"><span className="circle-notifications-modal__icon"><Bell/></span><div className="pr-10"><DialogTitle className="text-lg">Notifications</DialogTitle><DialogDescription className="mt-1">Friend requests and session reactions</DialogDescription></div></header>
        <div className="circle-notifications__list">
        {incoming.map((request) => { const person = profileById(request.requester_id); return <button key={`request-${request.id}`} onClick={() => { setNotificationsOpen(false); setTab("requests"); }}><Avatar profile={person}/><span><strong>{person?.display_name ?? "RepMate Member"}</strong><small>sent you a friend request</small></span><UserPlus/></button>; })}
        {reactionActivity.map((reaction) => { const person = profileById(reaction.user_id); const post = posts.find((item) => item.id === reaction.post_id); return <div key={`${reaction.post_id}-${reaction.user_id}`}><Avatar profile={person}/><span><strong>{person?.display_name ?? "RepMate Member"}</strong><small>gave {reactionLabels[reaction.reaction]} to your {post?.workout_summary.name ?? "workout"}</small></span><Zap/></div>; })}
        {!incoming.length && !reactionActivity.length && <p className="circle-notifications__empty">You are all caught up.</p>}
        </div>
      </DialogContent>
    </Dialog>
    <nav className="circle-tabs" aria-label="Circle sections">
      <button className={tab === "feed" ? "is-active" : ""} onClick={() => setTab("feed")}>Feed</button>
      <button className={tab === "people" ? "is-active" : ""} onClick={() => setTab("people")}>Find friends</button>
      <button className={tab === "requests" ? "is-active" : ""} onClick={() => setTab("requests")}>Requests{incoming.length > 0 && <span>{incoming.length}</span>}</button>
    </nav>

    {loading ? <CircleSkeleton/> : tab === "feed" ? <>
      <section className="circle-share-card">
        <div className="circle-share-card__icon"><Dumbbell/></div>
        <div><span>Latest session</span><h2>{latestWorkout?.name ?? "Your next workout"}</h2><p>{latestWorkout ? "Share your result with gym friends." : "Complete a workout to unlock sharing."}</p></div>
        <button onClick={shareLatest} disabled={!latestWorkout || sharing}>{sharing ? "Sharing…" : "Share"}</button>
      </section>
      <div className="circle-feed">
        {posts.length === 0 ? <section className="circle-empty"><UsersRound/><h2>Your circle starts here</h2><p>Find a gym friend, then share completed workouts and celebrate progress together.</p><button onClick={() => setTab("people")}><UserPlus/> Find friends</button></section> : posts.map((post) => {
          const author = profileById(post.user_id);
          const postReactions = reactions.filter((item) => item.post_id === post.id);
          return <article className="circle-post" key={post.id}>
            <header><Avatar profile={author}/><div><strong>{author?.display_name ?? "RepMate Member"}</strong><span>@{author?.username ?? "member"} · {relativeTime(post.created_at)}</span></div></header>
            <p className="circle-post__caption">{post.caption}</p>
            <div className="circle-workout"><small>Workout complete</small><h2>{post.workout_summary.name ?? "Workout"}</h2><div><span><b className="numeric">{post.workout_summary.sets ?? 0}</b> sets</span><span><b className="numeric">{post.workout_summary.volume ?? 0}</b> {post.workout_summary.units ?? "kg"}</span><span><b className="numeric">{Math.round((post.workout_summary.duration ?? 0) / 60)}</b> min</span></div></div>
            <footer>{(Object.keys(reactionLabels) as Reaction["reaction"][]).map((kind) => { const count = postReactions.filter((item) => item.reaction === kind).length; const active = postReactions.some((item) => item.user_id === userId && item.reaction === kind); return <button key={kind} className={active ? "is-active" : ""} onClick={() => react(post.id, kind)}><Zap/>{reactionLabels[kind]}{count > 0 && <span>{count}</span>}</button>; })}</footer>
          </article>;
        })}
      </div>
    </> : tab === "people" ? <>
      <label className="circle-search"><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by display name"/></label>
      <section className="circle-people">{people.length === 0 ? <div className="circle-list-empty">No athletes match your search.</div> : people.map((person) => {
        const connection = relationship(person.user_id);
        return <article key={person.user_id}><Avatar profile={person}/><div><strong>{person.display_name}</strong><span>@{person.username}</span></div>{!connection ? <button onClick={() => sendRequest(person.user_id)}><UserPlus/> Add</button> : connection.status === "accepted" ? <button className="is-friend" onClick={() => removeRelationship(connection)}><Check/> Friends</button> : connection.addressee_id === userId ? <button onClick={() => acceptRequest(connection)}><Check/> Accept</button> : <button className="is-muted" onClick={() => removeRelationship(connection)}>Pending</button>}</article>;
      })}</section>
    </> : <section className="circle-people">{incoming.length === 0 ? <div className="circle-empty"><UsersRound/><h2>No pending requests</h2><p>New friend requests will appear here.</p></div> : incoming.map((request) => { const person = profileById(request.requester_id); return <article key={request.id}><Avatar profile={person}/><div><strong>{person?.display_name ?? "RepMate Member"}</strong><span>@{person?.username ?? "member"}</span></div><div className="circle-request-actions"><button onClick={() => acceptRequest(request)}><Check/></button><button className="is-muted" onClick={() => removeRelationship(request)}><X/></button></div></article>; })}</section>}
    {notice && <div className="program-toast" role="status"><Check/>{notice}</div>}
  </div>;
}

function Avatar({ profile }: { profile?: Profile }) {
  return <div className="circle-avatar">{profile?.avatar_url ? <Image src={profile.avatar_url} alt="" width={44} height={44}/> : <span>{(profile?.display_name || "R").slice(0, 1).toUpperCase()}</span>}</div>;
}

function CircleSkeleton() {
  return <div className="circle-loading" aria-label="Loading your gym circle"><div/><div/><div/></div>;
}

function relativeTime(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
