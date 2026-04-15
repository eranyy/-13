import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { UserRole } from '../types';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Heart, MessageCircle, Share2, Trash2, Image as ImageIcon, Send, Trophy, Shield, Goal, CalendarDays, BarChart2, Plus, X, ChevronRight, ChevronLeft, MapPin, Tv, Clock, RefreshCw, Edit2, Users } from 'lucide-react';
import html2canvas from 'html2canvas';

interface SocialFeedProps { teams: any[]; currentRound: number; loggedInUser: any; onNavigate?: (tab: string) => void; }

const TEAM_NAMES: Record<string, string> = { tumali: 'תומאלי', tampa: 'טמפה', pichichi: "פיצ'יצ'י", hamsili: 'חמסילי', harale: 'חראלה', holonia: 'חולוניה' };

const translateTeam = (enName: string) => {
  if (!enName) return '';
  const name = enName.trim().toLowerCase();
  if (name.includes("tel aviv") && name.includes("maccabi")) return "מכבי ת״א";
  if (name.includes("tel-aviv") && name.includes("hapoel")) return "הפועל ת״א";
  if (name.includes("tel aviv") && name.includes("hapoel")) return "הפועל ת״א";
  if (name.includes("haifa") && name.includes("maccabi")) return "מכבי חיפה";
  if (name.includes("haifa") && name.includes("hapoel")) return "הפועל חיפה";
  if (name.includes("be'er sheva") || name.includes("beer sheva")) return "הפועל ב״ש";
  if (name.includes("beitar jerusalem")) return "בית״ר ירושלים";
  if (name.includes("hapoel jerusalem")) return "הפועל ירושלים";
  if (name.includes("netanya")) return "מכבי נתניה";
  if (name.includes("ashdod")) return "מ.ס אשדוד";
  if (name.includes("sakhnin")) return "בני סכנין";
  if (name.includes("tiberias")) return "עירוני טבריה";
  if (name.includes("bnei raina") || name.includes("reineh")) return "מכבי בני ריינה";
  if (name.includes("petah tikva") && name.includes("maccabi")) return "מכבי פ״ת";
  if (name.includes("petah tikva") && name.includes("hapoel")) return "הפועל פ״ת";
  if (name.includes("hadera")) return "הפועל חדרה";
  if (name.includes("kiryat shmona")) return "עירוני ק״ש";
  return enName;
};

const SocialFeed: React.FC<SocialFeedProps> = ({ teams, currentRound, loggedInUser, onNavigate }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [newPostText, setNewPostText] = useState('');
  const [mobileTab, setMobileTab] = useState<'feed' | 'widgets'>('feed');
  
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  const [fixtures, setFixtures] = useState<any[]>([]);
  const [realFixtures, setRealFixtures] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isFetchingApi, setIsFetchingApi] = useState(false);
  
  const [apiMessage, setApiMessage] = useState<{text: string, type: 'info'|'success'|'error'} | null>(null);

  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  const [realRound, setRealRound] = useState<number>(currentRound || 1);
  const [fantasyRound, setFantasyRound] = useState<number>(currentRound || 1);

  const [editFieldModal, setEditFieldModal] = useState<{matchId: string, field: 'tvChannel' | 'stadium', value: string} | null>(null);
  const [editScoreModalReal, setEditScoreModalReal] = useState<{matchId: string, hs: string, as: string, hName: string, aName: string} | null>(null);

  // New States for Edit, Delete, and Like Modals
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editedPostContent, setEditedPostContent] = useState('');
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
  const [likesModalData, setLikesModalData] = useState<{ isOpen: boolean, likers: string[] }>({ isOpen: false, likers: [] });

  const isAdmin = loggedInUser?.role === UserRole.ADMIN || loggedInUser?.email?.toLowerCase() === 'eranyy@gmail.com';

  useEffect(() => {
    if (currentRound) {
      setRealRound(currentRound);
      setFantasyRound(currentRound);
    }
  }, [currentRound]);

  useEffect(() => {
    const unsubFix = onSnapshot(doc(db, 'leagueData', 'fixtures'), snap => {
      if(snap.exists()) setFixtures(snap.data().rounds || []);
    });

    const unsubRealFix = onSnapshot(doc(db, 'leagueData', 'real_fixtures'), snap => {
      if(snap.exists() && snap.data().matches) {
        setRealFixtures(snap.data().matches);
      }
    });

    const q = query(collection(db, 'social_posts'), orderBy('timestamp', 'desc'));
    const unsubPosts = onSnapshot(q, snap => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { unsubFix(); unsubRealFix(); unsubPosts(); };
  }, []);

  const getUserName = (userId: string) => {
    const user = teams.find(t => t.id === userId);
    return user ? (user.manager || user.teamName) : 'אורח';
  };

  const openFieldModal = (e: React.MouseEvent, matchId: string, field: 'tvChannel' | 'stadium', currentValue: string) => {
    e.preventDefault();
    e.stopPropagation();
    setEditFieldModal({ matchId, field, value: currentValue || '' });
  };

  const saveFieldModal = async () => {
    if (!editFieldModal) return;
    const updatedMatches = realFixtures.map(m => 
      m.id === editFieldModal.matchId ? { ...m, [editFieldModal.field]: editFieldModal.value.trim() } : m
    );

    try {
      await updateDoc(doc(db, 'leagueData', 'real_fixtures'), { matches: updatedMatches });
      setApiMessage({ text: "עודכן בהצלחה!", type: 'success' });
      setTimeout(() => setApiMessage(null), 3000);
    } catch (err) {
      setApiMessage({ text: "שגיאה בעדכון", type: 'error' });
      setTimeout(() => setApiMessage(null), 3000);
    }
    setEditFieldModal(null);
  };

  const openScoreModal = (e: React.MouseEvent, m: any) => {
    e.preventDefault();
    e.stopPropagation();
    setEditScoreModalReal({
      matchId: m.id,
      hName: m.homeTeam,
      aName: m.awayTeam,
      hs: m.hs !== null && m.hs !== undefined ? String(m.hs) : '',
      as: m.as !== null && m.as !== undefined ? String(m.as) : ''
    });
  };

  const saveRealScore = async () => {
    if (!editScoreModalReal) return;
    
    let hs: number | null = null;
    let as: number | null = null;

    if (editScoreModalReal.hs.trim() !== '' && editScoreModalReal.as.trim() !== '') {
      hs = parseInt(editScoreModalReal.hs);
      as = parseInt(editScoreModalReal.as);
    }

    const updatedMatches = realFixtures.map(m => 
      m.id === editScoreModalReal.matchId ? { ...m, hs, as } : m
    );

    try {
      await updateDoc(doc(db, 'leagueData', 'real_fixtures'), { matches: updatedMatches });
      setApiMessage({ text: "תוצאה עודכנה בהצלחה!", type: 'success' });
      setTimeout(() => setApiMessage(null), 3000);
    } catch (err) {
      setApiMessage({ text: "שגיאה בעדכון התוצאה", type: 'error' });
      setTimeout(() => setApiMessage(null), 3000);
    }
    setEditScoreModalReal(null);
  };

  const fetchFromSportsDB = async () => {
    setIsFetchingApi(true);
    setApiMessage({ text: "מרענן נתונים...", type: 'info' });
    try {
      setTimeout(() => {
        setApiMessage({ text: "הנתונים מעודכנים! להוספת משחקים היכנס להגדרות.", type: 'success' });
        setTimeout(() => setApiMessage(null), 4000);
        setIsFetchingApi(false);
      }, 1000);
    } catch (error: any) {
      setApiMessage({ text: "שגיאה ברענון", type: 'error' });
      setIsFetchingApi(false);
    }
  };

  const handleAddPollOption = () => {
    if (pollOptions.length < 4) setPollOptions([...pollOptions, '']);
  };

  const handleRemovePollOption = (indexToRemove: number) => {
    setPollOptions(pollOptions.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUpdatePollOption = (text: string, idx: number) => {
    const newOptions = [...pollOptions];
    newOptions[idx] = text;
    setPollOptions(newOptions);
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim()) return;

    let postType = 'user';
    let finalPollOptions: any[] = [];

    if (isCreatingPoll) {
      const validOptions = pollOptions.filter(o => o.trim() !== '');
      if (validOptions.length < 2) return;
      
      postType = 'poll';
      finalPollOptions = validOptions.map((opt, idx) => ({
        id: idx.toString(),
        text: opt,
        votes: [] 
      }));
    }

    try {
      await addDoc(collection(db, 'social_posts'), {
        authorName: loggedInUser.name, 
        handle: `@${loggedInUser.teamName.replace(/\s+/g, '_').toLowerCase()}`, 
        teamId: loggedInUser.teamId, 
        isVerified: true, 
        type: postType, 
        content: newPostText, 
        pollOptions: finalPollOptions,
        likes: 0, 
        likedBy: [], 
        comments: [], 
        timestamp: new Date().toISOString()
      });
      
      setNewPostText('');
      setIsCreatingPoll(false);
      setPollOptions(['', '']);
    } catch(e) { console.error('שגיאה בשליחת הפוסט', e); }
  };

  // פונקציות לעריכה
  const handleEditPostStart = (post: any) => {
    setEditingPostId(post.id);
    setEditedPostContent(post.content);
  };

  const handleEditPostSave = async (postId: string) => {
    if (!editedPostContent.trim()) return;
    try {
        await updateDoc(doc(db, 'social_posts', postId), { content: editedPostContent });
        setEditingPostId(null);
    } catch(e) { console.error('שגיאה בעריכת הפוסט', e); }
  };

  // פונקציות למחיקה
  const handleDeletePostConfirm = async () => {
    if(!deleteConfirmPostId) return;
    try { 
        await deleteDoc(doc(db, 'social_posts', deleteConfirmPostId)); 
        setDeleteConfirmPostId(null);
    } catch (e) { console.error(e); }
  };

  const handleLike = async (postId: string, currentLikes: number, likedBy: string[] = []) => {
    const postRef = doc(db, 'social_posts', postId);
    const hasLiked = likedBy.includes(loggedInUser.id);
    try {
      if (hasLiked) await updateDoc(postRef, { likes: currentLikes - 1, likedBy: likedBy.filter(id => id !== loggedInUser.id) });
      else await updateDoc(postRef, { likes: currentLikes + 1, likedBy: [...likedBy, loggedInUser.id] });
    } catch (e) { console.error(e); }
  };

  const handleShowLikes = (likersIds: string[]) => {
      if(!likersIds || likersIds.length === 0) return;
      const likersNames = likersIds.map(id => getUserName(id));
      setLikesModalData({ isOpen: true, likers: likersNames });
  };

  const handleVote = async (postId: string, selectedOptionId: string, currentPollOptions: any[]) => {
    const userId = loggedInUser.id;
    const updatedOptions = currentPollOptions.map(opt => {
      let newVotes = (opt.votes || []).filter((id: string) => id !== userId);
      if (opt.id === selectedOptionId) {
        newVotes.push(userId);
      }
      return { ...opt, votes: newVotes };
    });

    try {
      await updateDoc(doc(db, 'social_posts', postId), { pollOptions: updatedOptions });
    } catch (e) { console.error('Error voting:', e); }
  };

  const handleAddComment = async (postId: string, existingComments: any[]) => {
    if (!commentText.trim()) return;
    const postRef = doc(db, 'social_posts', postId);
    try {
      await updateDoc(postRef, {
        comments: [...(existingComments || []), { id: Date.now().toString(), author: loggedInUser.name, text: commentText, timestamp: new Date().toISOString() }]
      });
      setCommentText('');
    } catch (e) { console.error('שגיאה בשליחת התגובה', e); }
  };

  const sharePostToWhatsApp = (post: any) => {
    let text = `*${post.authorName}* צייץ:\n"${post.content}"\n`;
    if (post.type === 'poll') text += `\n📊 כנסו לאפליקציה כדי להצביע בסקר!\n`;
    text += `\nבואו לראות! ⚡`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareElementAsImage = async (elementId: string, fileName: string, fallbackText: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;

    setApiMessage({ text: "מייצר תמונה מעוצבת... 📸", type: 'info' });

    try {
      const canvas = await html2canvas(el, { 
        backgroundColor: '#0f172a', 
        scale: 2, 
        useCORS: true,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('.backdrop-blur-md, .backdrop-blur-xl, .backdrop-blur-2xl').forEach(b => {
              b.classList.remove('backdrop-blur-md', 'backdrop-blur-xl', 'backdrop-blur-2xl');
              (b as HTMLElement).style.backgroundColor = '#0f172a';
          });
          clonedDoc.querySelectorAll('span, p, h2, h3, h4, div').forEach(node => {
              const n = node as HTMLElement;
              n.style.lineHeight = '1.5';
              n.style.paddingBottom = '4px';
          });
          clonedDoc.querySelectorAll('.truncate').forEach(node => {
              const n = node as HTMLElement;
              n.classList.remove('truncate');
              n.style.whiteSpace = 'normal';
              n.style.overflow = 'visible';
          });
          clonedDoc.querySelectorAll('[data-html2canvas-ignore="true"]').forEach(ig => (ig as HTMLElement).style.display = 'none');
        }
      });
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], fileName, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'פנטזי לוזון 13',
            text: fallbackText
          });
          setApiMessage(null);
        } else {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            setApiMessage({ text: "התמונה הועתקה! פתח ווצאפ והדבק (Ctrl+V) 📋", type: 'success' });
            setTimeout(() => setApiMessage(null), 5000);
          } catch (err) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            link.click();
            setApiMessage({ text: "התמונה ירדה למחשב! צרף לווצאפ 📥", type: 'success' });
            setTimeout(() => setApiMessage(null), 5000);
          }
        }
      }, 'image/png');
    } catch (err) {
      console.error(err);
      setApiMessage({ text: "שגיאה ביצירת תמונה", type: 'error' });
      setTimeout(() => setApiMessage(null), 3000);
    }
  };

  const shareFantasyFixturesToWhatsApp = () => {
    shareElementAsImage('fantasy-fixtures-capture', `Fantasy_Round_${fantasyRound}.png`, `🏆 לקראת מחזור ${fantasyRound} בפנטזי לוזון! 🔥`);
  };

  const shareRealFixturesToWhatsApp = () => {
    shareElementAsImage('real-fixtures-capture', `Real_Round_${realRound}.png`, `⚽ משחקי ליגת העל - מחזור ${realRound} ⚽`);
  };

  const timeAgo = (dateString: string) => {
    if(!dateString) return '';
    const diff = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 60000);
    if (diff < 1) return 'עכשיו'; if (diff < 60) return `${diff} דק'`; if (diff < 1440) return `${Math.floor(diff/60)} ש'`;
    return `${Math.floor(diff/1440)} ימים`;
  };

  const viewedRealMatches = realFixtures.filter(f => f.round === realRound).sort((a, b) => a.timestamp - b.timestamp);
  const viewedFantasyRoundObj = fixtures.find(r => r.round === fantasyRound);
  const viewedFantasyMatches = viewedFantasyRoundObj?.matches || [];

  const validTeams = [...teams].filter(t => t.id !== 'admin' && t.teamName?.toUpperCase() !== 'ADMIN');
  const sortedTeams = [...validTeams].sort((a, b) => {
      const aPts = a.points || 0; const bPts = b.points || 0;
      if (bPts !== aPts) return bPts - aPts;
      return ((b.gf || 0) - (b.ga || 0)) - ((a.gf || 0) - (a.ga || 0));
  });

  const top2 = sortedTeams.slice(0, 2);
  const bottom2 = sortedTeams.length > 4 ? sortedTeams.slice(-2) : [];

  const bestAttack = [...validTeams].sort((a, b) => (b.gf || 0) - (a.gf || 0))[0];
  const bestDefense = [...validTeams].sort((a, b) => (a.ga || 0) - (b.ga || 0))[0];
  const totalGoals = validTeams.reduce((sum, t) => sum + (t.gf || 0), 0);

  if (loading) return (
    <div className="flex justify-center items-center pt-32 h-full">
      <div className="w-10 h-10 border-[3px] border-green-500/20 border-t-green-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8 pb-32 font-sans" dir="rtl">
      
      <div className="lg:hidden mb-2 relative z-[60]">
        <div className="flex bg-zinc-900/60 backdrop-blur-xl p-1.5 rounded-3xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
          <button
            onClick={() => setMobileTab('feed')}
            className={`flex-1 py-3.5 rounded-2xl text-[13px] sm:text-sm font-black transition-all duration-300 flex justify-center items-center gap-2 ${mobileTab === 'feed' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/20 border border-blue-500/50' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
          >
            <MessageCircle className="w-4 h-4" /> פיד הליגה
          </button>
          <button
            onClick={() => setMobileTab('widgets')}
            className={`flex-1 py-3.5 rounded-2xl text-[13px] sm:text-sm font-black transition-all duration-300 flex justify-center items-center gap-2 ${mobileTab === 'widgets' ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white shadow-lg shadow-yellow-900/20 border border-yellow-500/50' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
          >
            <BarChart2 className="w-4 h-4" /> נתוני ליגה
          </button>
        </div>
      </div>

      <div className={`flex-1 lg:w-2/3 w-full space-y-6 ${mobileTab === 'feed' ? 'block animate-in fade-in duration-300' : 'hidden lg:block'}`}>
        <div className="bg-zinc-900/50 backdrop-blur-xl rounded-3xl border border-zinc-800/50 p-4 md:p-6 shadow-lg relative overflow-hidden transition-all focus-within:border-zinc-700/80 focus-within:shadow-[0_0_30px_rgba(255,255,255,0.02)] focus-within:bg-zinc-900/80">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center font-black text-xl text-black shadow-lg shrink-0 border border-green-400/30">
              {loggedInUser.name.charAt(0)}
            </div>
            <form onSubmit={handlePostSubmit} className="flex-1 flex flex-col pt-1">
              <textarea 
                value={newPostText} 
                onChange={e => setNewPostText(e.target.value)} 
                placeholder={isCreatingPoll ? "שאל את הליגה שאלה..." : "מה קורה בליגה, קואוץ'?"}
                className="w-full bg-transparent text-zinc-100 text-lg md:text-xl placeholder-zinc-600 outline-none resize-none min-h-[60px]" 
              />
              
              {isCreatingPoll && (
                <div className="mt-4 space-y-3 bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800 animate-in fade-in slide-in-from-top-2">
                  <div className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-blue-400" /> יצירת סקר
                  </div>
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2 relative">
                      <input 
                        type="text" 
                        value={opt}
                        onChange={(e) => handleUpdatePollOption(e.target.value, idx)}
                        placeholder={`אפשרות ${idx + 1}`}
                        className="flex-1 bg-zinc-900 border border-zinc-700 p-3 rounded-xl text-white font-bold outline-none focus:border-blue-500 transition-colors"
                      />
                      {idx >= 2 && (
                        <button type="button" onClick={() => handleRemovePollOption(idx)} className="absolute left-3 p-1 text-zinc-600 hover:text-red-400 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 4 && (
                    <button type="button" onClick={handleAddPollOption} className="text-blue-400 text-sm font-bold flex items-center gap-1 mt-2 hover:text-blue-300 transition-colors">
                      <Plus className="w-4 h-4" /> הוסף אפשרות
                    </button>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center border-t border-zinc-800/80 pt-3 mt-2">
                <div className="flex gap-1">
                  <button type="button" className="text-zinc-500 hover:text-green-400 transition-colors p-2 rounded-full hover:bg-white/5" title="הוסף תמונה (בקרוב)">
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsCreatingPoll(!isCreatingPoll)}
                    className={`transition-colors p-2 rounded-full hover:bg-white/5 ${isCreatingPoll ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-500 hover:text-blue-400'}`}
                    title="הוסף סקר"
                  >
                    <BarChart2 className="w-5 h-5" />
                  </button>
                </div>
                
                <button 
                  type="submit" 
                  disabled={!newPostText.trim() || (isCreatingPoll && pollOptions.filter(o => o.trim()).length < 2)} 
                  className="bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black px-6 py-2 rounded-full shadow-lg transition-all active:scale-95 flex items-center gap-2 text-sm"
                >
                  <Send className="w-4 h-4" />
                  צייץ
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-0.5">
          {posts.map(post => {
            const hasLiked = (post.likedBy || []).includes(loggedInUser.id);
            const isMyPost = post.teamId === loggedInUser.teamId || isAdmin;
            
            let totalPollVotes = 0;
            if (post.type === 'poll' && post.pollOptions) {
              totalPollVotes = post.pollOptions.reduce((acc: number, opt: any) => acc + (opt.votes?.length || 0), 0);
            }

            return (
              <div key={post.id} className="bg-black/40 backdrop-blur-sm border-y border-zinc-800/50 md:border md:rounded-[32px] p-5 transition-colors relative group">
                
                {isMyPost && editingPostId !== post.id && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {post.type !== 'poll' && (
                        <button onClick={() => handleEditPostStart(post)} className="text-zinc-600 hover:text-blue-400 transition-colors p-2 rounded-full bg-zinc-900/50 hover:bg-zinc-800">
                          <Edit2 className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={() => setDeleteConfirmPostId(post.id)} className="text-zinc-600 hover:text-red-500 transition-colors p-2 rounded-full bg-zinc-900/50 hover:bg-zinc-800">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                <div className="flex gap-3 md:gap-4">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-black text-lg md:text-xl text-white shadow-inner shrink-0 border border-white/5 ${post.type === 'article' ? 'bg-gradient-to-tr from-purple-600 to-red-600' : 'bg-zinc-800'}`}>
                    {post.type === 'article' ? '📰' : post.authorName.charAt(0)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="font-black text-zinc-100 text-sm md:text-base">{post.authorName}</span>
                      {post.isVerified && <span className="text-green-500 text-xs">✔️</span>}
                      <span className="text-zinc-500 text-xs md:text-sm" dir="ltr" style={{ whiteSpace: 'normal' }}>{post.handle}</span>
                      <span className="text-zinc-700 text-xs">·</span>
                      <span className="text-zinc-500 text-xs hover:underline cursor-pointer">{timeAgo(post.timestamp)}</span>
                    </div>
                    
                    {editingPostId === post.id ? (
                        <div className="mt-3 bg-zinc-900 border border-blue-500/50 p-3 rounded-xl">
                            <textarea 
                                value={editedPostContent}
                                onChange={(e) => setEditedPostContent(e.target.value)}
                                className="w-full bg-transparent text-white outline-none resize-none min-h-[80px]"
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={() => setEditingPostId(null)} className="px-4 py-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors">ביטול</button>
                                <button onClick={() => handleEditPostSave(post.id)} className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">שמור</button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-zinc-200 mt-1 md:mt-2 leading-snug whitespace-pre-wrap text-base md:text-lg break-words">
                          {post.content}
                        </div>
                    )}

                    {post.type === 'poll' && post.pollOptions && (
                      <div className="mt-5 space-y-3">
                        {post.pollOptions.map((opt: any) => {
                          const votesCount = opt.votes?.length || 0;
                          const percent = totalPollVotes > 0 ? Math.round((votesCount / totalPollVotes) * 100) : 0;
                          const hasVotedThis = (opt.votes || []).includes(loggedInUser.id);
                          const isWinner = totalPollVotes > 0 && votesCount === Math.max(...post.pollOptions.map((o:any) => o.votes?.length || 0));
                          const voterNames = (opt.votes || []).map((vId: any) => getUserName(vId));

                          return (
                            <div key={opt.id} className="relative">
                              <button 
                                onClick={() => handleVote(post.id, opt.id, post.pollOptions)}
                                className="w-full relative min-h-[48px] py-2.5 rounded-xl overflow-hidden border border-zinc-700/50 flex items-center transition-all group/poll focus:outline-none hover:border-zinc-500 bg-zinc-900/40"
                              >
                                <div 
                                  className={`absolute top-0 right-0 h-full transition-all duration-500 ease-out opacity-20 ${hasVotedThis || isWinner ? 'bg-blue-500' : 'bg-zinc-500'}`}
                                  style={{ width: `${percent}%` }}
                                ></div>
                                
                                <div className="relative z-10 w-full px-3 md:px-4 flex justify-between items-center pointer-events-none gap-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full border-[2px] flex items-center justify-center shrink-0 transition-colors ${hasVotedThis ? 'border-blue-400 bg-blue-500/10' : 'border-zinc-500 group-hover/poll:border-zinc-400'}`}>
                                      {hasVotedThis && <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-blue-400 rounded-full"></div>}
                                    </div>
                                    <span className={`font-black text-sm md:text-base text-right leading-tight ${hasVotedThis ? 'text-white' : 'text-zinc-300 group-hover/poll:text-white'}`}>
                                      {opt.text}
                                    </span>
                                  </div>
                                  <span className={`font-bold text-sm shrink-0 ${hasVotedThis ? 'text-blue-400' : 'text-zinc-500'}`}>
                                    {totalPollVotes > 0 ? `${percent}%` : ''}
                                  </span>
                                </div>
                              </button>
                              
                              {votesCount > 0 && (
                                <div className="text-[10px] text-zinc-500 pr-9 mt-1 leading-tight font-medium">
                                  הצביעו: <span className="text-zinc-400">{voterNames.join(', ')}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div className="text-xs text-zinc-500 mt-2 font-bold px-1">
                          סה"כ הצבעות: {totalPollVotes}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-6 md:gap-10 mt-4 md:mt-5 max-w-sm">
                      <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => handleLike(post.id, post.likes, post.likedBy)} 
                            className={`flex items-center gap-1.5 text-xs md:text-sm font-bold transition-all group/btn ${hasLiked ? 'text-red-500' : 'text-zinc-500 hover:text-red-400'}`}
                          >
                            <div className={`p-2 rounded-full group-hover/btn:bg-red-500/10 transition-colors ${hasLiked ? 'bg-red-500/10' : ''}`}>
                               <Heart className={`w-4 h-4 md:w-5 md:h-5 ${hasLiked ? 'fill-current' : ''}`} />
                            </div>
                          </button>
                          {post.likes > 0 && (
                              <button onClick={() => handleShowLikes(post.likedBy)} className="text-xs md:text-sm font-bold text-zinc-500 hover:text-zinc-300 hover:underline">
                                  {post.likes}
                              </button>
                          )}
                      </div>

                      <button 
                        onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)} 
                        className="flex items-center gap-1.5 text-xs md:text-sm font-bold text-zinc-500 hover:text-blue-400 transition-all group/btn"
                      >
                        <div className="p-2 rounded-full group-hover/btn:bg-blue-500/10 transition-colors">
                          <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <span>{(post.comments || []).length > 0 ? (post.comments || []).length : ''}</span>
                      </button>

                      <button 
                        onClick={() => sharePostToWhatsApp(post)} 
                        className="flex items-center gap-1.5 text-xs md:text-sm font-bold text-zinc-500 hover:text-green-500 transition-all group/btn"
                      >
                         <div className="p-2 rounded-full group-hover/btn:bg-green-500/10 transition-colors">
                           <Share2 className="w-4 h-4 md:w-5 md:h-5" />
                         </div>
                      </button>
                    </div>
                    
                    {activeCommentPostId === post.id && (
                      <div className="mt-4 pt-4 border-t border-zinc-800/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-3">
                          {(post.comments || []).map((c: any) => (
                            <div key={c.id} className="flex gap-3">
                              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-400 shrink-0">
                                {c.author.charAt(0)}
                              </div>
                              <div className="bg-zinc-900/80 px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm border border-zinc-800/50">
                                <span className="font-black text-zinc-200 block text-xs mb-0.5">{c.author}</span>
                                <span className="text-zinc-300">{c.text}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 items-center">
                           <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center font-bold text-xs text-black shrink-0">
                               {loggedInUser.name.charAt(0)}
                           </div>
                           <input 
                             type="text" 
                             value={commentText} 
                             onChange={e => setCommentText(e.target.value)} 
                             placeholder="צייץ את התגובה שלך..." 
                             className="flex-1 bg-zinc-900 border border-zinc-700 rounded-full px-4 py-2.5 text-zinc-100 text-sm outline-none focus:border-zinc-500 focus:bg-zinc-800 transition-colors" 
                             onKeyDown={(e) => { if(e.key === 'Enter') handleAddComment(post.id, post.comments || []) }}
                           />
                           <button 
                             onClick={() => handleAddComment(post.id, post.comments || [])} 
                             disabled={!commentText.trim()} 
                             className="text-green-500 hover:text-green-400 disabled:opacity-30 disabled:hover:text-green-500 p-2 transition-colors"
                           >
                             <Send className="w-5 h-5" />
                           </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- צד שמאל: ווידג'טים --- */}
      <div className={`lg:w-1/3 w-full space-y-6 animate-in slide-in-from-right-4 duration-300 ${mobileTab === 'widgets' ? 'block' : 'hidden lg:block'}`}>
        
        {/* 1. WIDGET: משחקי ליגת העל */}
        <div id="real-fixtures-capture" className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 backdrop-blur-xl rounded-[32px] border border-blue-500/20 p-5 shadow-[0_0_30px_rgba(59,130,246,0.05)] relative overflow-hidden pb-4">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] pointer-events-none rounded-full"></div>
          
          <div className="flex justify-between items-start mb-5 relative z-10">
            <div>
              <h3 className="font-black text-xl text-white mb-1.5 flex items-center gap-2">
                <span className="text-2xl drop-shadow-md">⚽</span> ליגת העל
              </h3>
              
              <div className="flex items-center justify-between gap-1 bg-zinc-950/80 p-1 rounded-xl border border-zinc-800 shadow-inner w-36" data-html2canvas-ignore="true">
                <button onClick={() => setRealRound(p => Math.max(1, p - 1))} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95"><ChevronRight className="w-4 h-4"/></button>
                <div className="flex flex-col items-center">
                   <span className="font-black text-white text-xs leading-none">מחזור {realRound}</span>
                </div>
                <button onClick={() => setRealRound(p => Math.min(36, p + 1))} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95"><ChevronLeft className="w-4 h-4"/></button>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2" data-html2canvas-ignore="true">
              <div className="flex items-center gap-2">
                {viewedRealMatches.length > 0 && (
                  <button 
                    onClick={shareRealFixturesToWhatsApp} 
                    className="text-white hover:text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-3 py-1.5 rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] font-bold text-xs flex items-center gap-1.5"
                    title="שתף תמונה לווצאפ"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    שתף
                  </button>
                )}
                {isAdmin && (
                  <button 
                    onClick={fetchFromSportsDB}
                    disabled={isFetchingApi}
                    className="bg-blue-600/20 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/30 font-bold px-3 py-1.5 rounded-lg transition-all shadow-xl disabled:opacity-50 text-xs flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isFetchingApi ? 'animate-spin' : ''}`} />
                    {isFetchingApi ? 'מרענן...' : 'רענן'}
                  </button>
                )}
              </div>
              {apiMessage && (
                <div className={`text-[10px] font-bold px-2 py-1 rounded w-full text-right ${apiMessage.type === 'error' ? 'bg-red-500/20 text-red-400' : apiMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {apiMessage.text}
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-4 relative z-10">
            {viewedRealMatches.length === 0 && (
              <div className="text-center text-zinc-500 text-sm py-8 bg-zinc-950/30 rounded-2xl border border-dashed border-zinc-800">
                <span className="text-3xl block mb-2 opacity-40">🗓️</span>
                אין משחקים במחזור זה או שטרם נשאבו נתונים.
              </div>
            )}

            {viewedRealMatches.map((m: any, i: number) => {
              let hTextClass = "text-zinc-100";
              let aTextClass = "text-zinc-100";
              
              if (m.hs !== undefined && m.hs !== null && m.as !== undefined && m.as !== null) {
                if (m.hs > m.as) { hTextClass = "text-white"; aTextClass = "text-zinc-500"; }
                else if (m.as > m.hs) { hTextClass = "text-zinc-500"; aTextClass = "text-white"; }
                else { hTextClass = "text-zinc-400"; aTextClass = "text-zinc-400"; }
              }

              return (
                <div key={i} className="bg-zinc-950/60 rounded-[24px] border border-white/5 hover:border-blue-500/30 transition-all group shadow-inner overflow-hidden flex flex-col">
                  
                  {/* העליון: קבוצות ותוצאה - הפוך למעלה */}
                  <div className="flex justify-between items-center p-4 md:p-5 border-b border-white/5">
                    <span className={`font-black text-sm md:text-[17px] w-[40%] text-right leading-tight ${hTextClass}`} dir="rtl" style={{ whiteSpace: 'normal' }}>{m.homeTeam}</span>
                    
                    <button 
                      className="w-[20%] flex justify-center hover:opacity-80 transition-opacity"
                      onClick={(e) => openScoreModal(e, m)}
                      title="לחץ לעדכון תוצאה"
                    >
                      {(m.hs !== null && m.hs !== undefined && m.as !== null && m.as !== undefined) ? (
                        <div className="bg-black px-3 py-1.5 rounded-[10px] border border-zinc-800 shadow-inner flex items-center gap-1.5">
                           <span className={`font-black text-sm md:text-base tabular-nums ${m.hs > m.as ? 'text-green-400' : 'text-zinc-300'}`}>{m.hs}</span>
                           <span className="text-zinc-600 font-black text-xs md:text-sm">:</span>
                           <span className={`font-black text-sm md:text-base tabular-nums ${m.as > m.hs ? 'text-green-400' : 'text-zinc-300'}`}>{m.as}</span>
                        </div>
                      ) : (
                        <span className="bg-slate-800 text-slate-400 text-[10px] md:text-xs font-black px-2.5 py-1 rounded-md border border-slate-700 shadow-sm">VS</span>
                      )}
                    </button>

                    <span className={`font-black text-sm md:text-[17px] w-[40%] text-left leading-tight ${aTextClass}`} dir="rtl" style={{ whiteSpace: 'normal' }}>{m.awayTeam}</span>
                  </div>

                  {/* התחתון: פרטי המשחק (תאריך, אצטדיון, וכו') */}
                  <div className="bg-zinc-900/40 px-3 py-2.5 flex justify-center items-center">
                     <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] md:text-xs font-bold text-zinc-400 w-full text-center">
                        <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 opacity-70"/> {m.date}</span>
                        <span className="flex items-center gap-1.5 text-white font-black"><Clock className="w-3.5 h-3.5 text-blue-400"/> {m.time}</span>
                        
                        {m.timeUS && (
                           <span className="flex items-center gap-1.5 text-zinc-300" dir="ltr">
                             <span className="bg-red-500/20 text-red-400 px-1 py-0.5 rounded text-[8px] uppercase tracking-widest border border-red-500/30">EST</span> 
                             {m.timeUS}
                           </span>
                        )}

                        <button 
                          onClick={(e) => openFieldModal(e, m.id, 'stadium', m.stadium)}
                          className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors"
                          title="לחץ לעריכת אצטדיון"
                        >
                           <MapPin className="w-3.5 h-3.5 opacity-70"/> {m.stadium || 'טרם נקבע'}
                           <span className="text-[8px] opacity-50" data-html2canvas-ignore="true">✏️</span>
                        </button>
                        
                        <button 
                          onClick={(e) => openFieldModal(e, m.id, 'tvChannel', m.tvChannel)}
                          className={`flex items-center gap-1.5 ${m.tvChannel ? 'text-zinc-200' : ''} hover:text-white transition-colors`}
                          title="לחץ לעריכת ערוץ שידור"
                        >
                           <Tv className={`w-3.5 h-3.5 ${m.tvChannel ? 'text-red-400' : 'opacity-70'}`}/> 
                           {m.tvChannel || 'שידור טרם נקבע'}
                           <span className="text-[8px] opacity-50" data-html2canvas-ignore="true">✏️</span>
                        </button>
                     </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Fixtures Widget (פנטזי) */}
        <div id="fantasy-fixtures-capture" className="bg-zinc-900/40 backdrop-blur-md rounded-3xl border border-zinc-800/80 p-5 shadow-xl relative pb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-black text-lg text-zinc-100 mb-1 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-zinc-400" />
                פנטזי
              </h3>
              <div className="flex items-center justify-between gap-1 bg-zinc-950/80 p-1 rounded-lg border border-zinc-800 shadow-inner w-32" data-html2canvas-ignore="true">
                <button onClick={() => setFantasyRound(p => Math.max(1, p - 1))} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-all active:scale-95"><ChevronRight className="w-3.5 h-3.5"/></button>
                <span className="font-black text-white text-[11px] leading-none">מחזור {fantasyRound}</span>
                <button onClick={() => setFantasyRound(p => Math.min(36, p + 1))} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-all active:scale-95"><ChevronLeft className="w-3.5 h-3.5"/></button>
              </div>
            </div>
            
            <div data-html2canvas-ignore="true">
              {viewedFantasyMatches.length > 0 && (
                <button 
                  onClick={shareFantasyFixturesToWhatsApp} 
                  className="text-green-500 hover:text-green-400 bg-green-500/10 hover:bg-green-500/20 px-3 py-1.5 rounded-xl transition-all shadow-[0_0_15px_rgba(34,197,94,0.1)] font-bold text-xs flex items-center gap-1.5"
                  title="שתף תמונה לווצאפ"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  שתף
                </button>
              )}
            </div>
          </div>
          
          <div className="space-y-1.5">
            {viewedFantasyMatches.length === 0 && (
              <div className="text-center text-zinc-600 text-sm py-6 bg-zinc-800/20 rounded-2xl border border-dashed border-zinc-700/50">
                טרם נקבעו משחקים למחזור זה בפנטזי
              </div>
            )}

            {viewedFantasyMatches.map((m: any, i: number) => {
              let hTextClass = "text-zinc-300 group-hover:text-white";
              let aTextClass = "text-zinc-300 group-hover:text-white";
              let isPlayed = m.hs !== undefined && m.as !== undefined;
              
              if (isPlayed) {
                if (m.hs > m.as) { hTextClass = "text-white"; aTextClass = "text-zinc-500"; }
                else if (m.as > m.hs) { hTextClass = "text-zinc-500"; aTextClass = "text-white"; }
                else { hTextClass = "text-zinc-400"; aTextClass = "text-zinc-400"; }
              }

              return (
                <div key={i} className="flex justify-between items-center bg-zinc-800/40 px-4 py-3 rounded-2xl border border-transparent hover:border-zinc-700 transition-colors group">
                  <span className={`font-black text-sm w-[40%] text-right transition-colors ${hTextClass}`} style={{ whiteSpace: 'normal' }}>{TEAM_NAMES[m.h] || m.h}</span>
                  
                  <div className="w-[20%] flex justify-center">
                    {isPlayed ? (
                       <div className="bg-black px-2 py-1 rounded-lg border border-zinc-700 shadow-inner flex items-center gap-1.5">
                         <span className={`font-black text-[11px] tabular-nums ${m.hs > m.as ? 'text-green-400' : 'text-zinc-400'}`}>{m.hs}</span>
                         <span className="text-zinc-600 font-black text-[10px]">:</span>
                         <span className={`font-black text-[11px] tabular-nums ${m.as > m.hs ? 'text-green-400' : 'text-zinc-400'}`}>{m.as}</span>
                       </div>
                    ) : (
                      <span className="bg-zinc-900 text-zinc-600 text-[9px] font-black px-2 py-1 rounded-md">VS</span>
                    )}
                  </div>

                  <span className={`font-black text-sm w-[40%] text-left transition-colors ${aTextClass}`} style={{ whiteSpace: 'normal' }}>{TEAM_NAMES[m.a] || m.a}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. League Table Widget */}
        <div 
          onClick={() => onNavigate && onNavigate('league')}
          className="bg-zinc-900/40 backdrop-blur-md rounded-3xl border border-zinc-800/80 p-5 shadow-xl cursor-pointer hover:bg-zinc-900/60 hover:border-yellow-500/30 transition-all group"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-lg text-zinc-100 flex items-center gap-2 group-hover:text-yellow-400 transition-colors">
              <Trophy className="w-5 h-5 text-yellow-500" />
              מצב הליגה
            </h3>
            <span className="text-[10px] text-zinc-500 group-hover:text-yellow-500/70">לטבלה המלאה 👈</span>
          </div>

          <div className="space-y-1.5">
            {top2.map((t, i) => {
              const gd = (t.gf || 0) - (t.ga || 0);
              return (
                <div key={t.id} className="flex justify-between items-center bg-zinc-800/30 group-hover:bg-zinc-800/50 transition-colors p-3 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <span className={`font-black text-base w-4 text-center ${i===0?'text-yellow-500':'text-zinc-400'}`}>{i+1}</span>
                    <div>
                      <div className="font-black text-zinc-100 text-sm leading-tight">{t.teamName}</div>
                      <div className="text-[10px] text-zinc-500 font-bold">{t.manager}</div>
                    </div>
                  </div>
                  <div className="text-left flex flex-col items-end">
                    <div className="font-black text-green-400">{t.points || 0} <span className="text-[10px] text-zinc-500">pt</span></div>
                    <div className="text-[10px] text-zinc-500 font-mono" dir="ltr">{gd > 0 ? `+${gd}` : gd} GD</div>
                  </div>
                </div>
              )
            })}

            {bottom2.length > 0 && (<div className="flex justify-center py-1"><span className="text-zinc-700 text-xl leading-none">⋮</span></div>)}

            {bottom2.map((t, i) => {
              const rank = sortedTeams.length - 1 + i;
              const gd = (t.gf || 0) - (t.ga || 0);
              return (
                <div key={t.id} className="flex justify-between items-center bg-red-950/10 group-hover:bg-red-950/20 transition-colors p-3 rounded-2xl border border-transparent group-hover:border-red-900/10">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-base w-4 text-center text-zinc-600">{rank}</span>
                    <div>
                      <div className="font-black text-zinc-300 text-sm leading-tight">{t.teamName}</div>
                      <div className="text-[10px] text-zinc-600 font-bold">{t.manager}</div>
                    </div>
                  </div>
                  <div className="text-left flex flex-col items-end">
                    <div className="font-black text-red-400/80">{t.points || 0} <span className="text-[10px] text-zinc-600">pt</span></div>
                    <div className="text-[10px] text-zinc-600 font-mono" dir="ltr">{gd > 0 ? `+${gd}` : gd} GD</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 4. System Stats Widget */}
        <div className="bg-zinc-900/40 backdrop-blur-md rounded-3xl border border-zinc-800/80 p-5 shadow-xl">
          <h3 className="font-black text-lg text-zinc-100 mb-4 flex items-center gap-2">
             <span className="text-xl">🤖</span>
             זווית המערכת
          </h3>
          <div className="space-y-2">
            <div className="bg-zinc-800/30 p-3 rounded-2xl flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                   <Goal className="w-4 h-4" />
                 </div>
                 <div>
                   <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">התקפה קטלנית</div>
                   <div className="font-black text-zinc-200 text-sm">{bestAttack?.teamName || '-'}</div>
                 </div>
               </div>
               <span className="text-green-400 font-black text-lg">{bestAttack?.gf || 0}</span>
            </div>

            <div className="bg-zinc-800/30 p-3 rounded-2xl flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                   <Shield className="w-4 h-4" />
                 </div>
                 <div>
                   <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">בונקר ברזל</div>
                   <div className="font-black text-zinc-200 text-sm">{bestDefense?.teamName || '-'}</div>
                 </div>
               </div>
               <span className="text-blue-400 font-black text-lg">{bestDefense?.ga || 0}</span>
            </div>
            
            <div className="bg-zinc-800/30 p-3 rounded-2xl flex items-center justify-between">
               <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">סך הכל שערים בליגה</div>
               <span className="text-white font-black text-xl">{totalGoals}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* ======================= MODALS ======================= */}
      {/* ======================================================== */}

      {/* Delete Confirmation Modal */}
      {deleteConfirmPostId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-red-500/30 p-6 rounded-3xl w-full max-w-sm flex flex-col shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-black text-white text-center mb-2">מחיקת פוסט</h3>
            <p className="text-sm text-slate-400 text-center mb-6">האם אתה בטוח שברצונך למחוק את הפוסט? לא ניתן יהיה לשחזר אותו.</p>
            <div className="flex gap-3">
              <button onClick={handleDeletePostConfirm} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-black py-3 rounded-xl transition-all">מחק פוסט</button>
              <button onClick={() => setDeleteConfirmPostId(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* Who Liked Modal */}
      {likesModalData.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setLikesModalData({ isOpen: false, likers: [] })}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-t-[32px] md:rounded-[32px] w-full max-w-xs shadow-2xl flex flex-col relative animate-in slide-in-from-bottom-10 md:zoom-in-95" onClick={e => e.stopPropagation()}>
             <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-lg font-black text-white flex items-center gap-2"><Heart className="w-5 h-5 text-red-500 fill-current" /> מי פירגן?</h3>
                <button onClick={() => setLikesModalData({ isOpen: false, likers: [] })} className="text-slate-500 hover:text-white transition-colors bg-slate-800 p-1.5 rounded-full"><X className="w-4 h-4"/></button>
             </div>
             <div className="p-2 max-h-[50vh] overflow-y-auto custom-scrollbar">
                {likesModalData.likers.map((name, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 hover:bg-slate-800/50 rounded-xl transition-colors border-b border-slate-800/50 last:border-0">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm text-slate-300">{name.charAt(0)}</div>
                        <span className="font-bold text-slate-200 text-sm">{name}</span>
                    </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* מודאלים פנימיים לעריכה חסינה במובייל וב-PC */}
      {editFieldModal && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95 duration-200">
          <div className="bg-slate-900 border border-blue-500/50 p-6 rounded-[32px] w-full max-w-sm flex flex-col shadow-[0_0_50px_rgba(59,130,246,0.15)] relative">
            <h3 className="text-xl font-black text-white text-center mb-6">
              עדכון {editFieldModal.field === 'tvChannel' ? 'ערוץ שידור 📺' : 'אצטדיון 🏟️'}
            </h3>
            <input 
              type="text" 
              value={editFieldModal.value} 
              onChange={e => setEditFieldModal({...editFieldModal, value: e.target.value})} 
              className="w-full bg-slate-950 rounded-2xl p-4 text-center text-lg font-bold text-white border border-slate-700 focus:border-blue-500 outline-none transition-colors mb-6"
              placeholder={`הזן את ה${editFieldModal.field === 'tvChannel' ? 'ערוץ' : 'אצטדיון'} כאן...`}
            />
            <div className="flex gap-3">
              <button onClick={saveFieldModal} className="flex-1 bg-blue-500 hover:bg-blue-400 text-white font-black py-3 rounded-xl shadow-lg transition-all active:scale-95">שמור</button>
              <button onClick={() => setEditFieldModal(null)} className="flex-1 bg-transparent hover:bg-zinc-800 text-zinc-400 font-bold py-3 rounded-xl border border-zinc-700 transition-all active:scale-95">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {editScoreModalReal && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95 duration-200">
          <div className="bg-slate-900 border border-green-500/50 p-6 rounded-[32px] w-full max-w-sm flex flex-col shadow-[0_0_50px_rgba(34,197,94,0.15)] relative">
            <h3 className="text-xl font-black text-white text-center mb-6">עריכת תוצאה ⚽</h3>
            
            <div className="flex items-center justify-center gap-4 mb-6 bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner">
              <div className="flex flex-col items-center gap-3">
                <div className="text-zinc-400 text-[10px] font-black uppercase tracking-widest text-center w-20">{editScoreModalReal.hName}</div>
                <input type="number" value={editScoreModalReal.hs} onChange={e => setEditScoreModalReal({...editScoreModalReal, hs: e.target.value})} className="w-16 h-20 bg-slate-900 rounded-2xl text-center text-3xl font-black text-white border border-slate-700 focus:border-green-500 outline-none transition-colors" placeholder="-" />
              </div>
              <span className="text-3xl text-zinc-700 font-black mt-6">:</span>
              <div className="flex flex-col items-center gap-3">
                <div className="text-zinc-400 text-[10px] font-black uppercase tracking-widest text-center w-20">{editScoreModalReal.aName}</div>
                <input type="number" value={editScoreModalReal.as} onChange={e => setEditScoreModalReal({...editScoreModalReal, as: e.target.value})} className="w-16 h-20 bg-slate-900 rounded-2xl text-center text-3xl font-black text-white border border-slate-700 focus:border-green-500 outline-none transition-colors" placeholder="-" />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button onClick={saveRealScore} className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-3.5 rounded-xl shadow-lg transition-all active:scale-95">שמור תוצאה</button>
              <div className="flex gap-3">
                 <button onClick={() => setEditScoreModalReal({...editScoreModalReal, hs: '', as: ''})} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-xl transition-all active:scale-95 text-xs">נקה תוצאה</button>
                 <button onClick={() => setEditScoreModalReal(null)} className="flex-1 bg-transparent hover:bg-red-500/10 text-red-400 border border-red-500/30 font-bold py-3 rounded-xl transition-all active:scale-95 text-xs">ביטול</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SocialFeed;