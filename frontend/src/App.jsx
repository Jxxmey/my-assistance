import { useState, useEffect, useRef } from 'react';
import { auth, loginWithGoogle, logout, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'; // เปลี่ยนเป็นธีม Code แบบสว่าง

// --- Icons (สีเข้มขึ้นให้อ่านง่าย) ---
const Icons = {
  Home: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
  Chat: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>,
  Plus: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  LogOut: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
  Menu: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>,
  Send: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>,
  Image: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>,
  Bot: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>
};

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => { const u = onAuthStateChanged(auth, setUser); return () => u(); }, []);
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 60000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "chats"), orderBy("updatedAt", "desc"));
    return onSnapshot(q, (snap) => setChats(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user]);

  useEffect(() => {
    if (!user || !currentChatId) return;
    const q = query(collection(db, "users", user.uid, "chats", currentChatId, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user, currentChatId]);

  const messagesEndRef = useRef(null);
  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, streamText]);

  const handleNewChat = async () => {
    if (!user) return;
    const docRef = await addDoc(collection(db, "users", user.uid, "chats"), {
      title: "บทสนทนาใหม่", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    setCurrentChatId(docRef.id);
    setView('chat');
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!input.trim() && !file) || !user) return;
    
    let chatId = currentChatId;
    if (!chatId) {
        const docRef = await addDoc(collection(db, "users", user.uid, "chats"), {
            title: input.substring(0, 20) || "Image Chat", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        chatId = docRef.id;
        setCurrentChatId(chatId);
        setView('chat');
    }

    const userMsg = input;
    setInput(""); setLoading(true); setStreamText("");
    
    let fileData = null;
    if (file) {
        const formData = new FormData(); formData.append("file", file);
        const token = await user.getIdToken();
        const res = await fetch("http://127.0.0.1:8000/upload", {
            method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: formData
        });
        if (res.ok) fileData = await res.json();
    }
    setFile(null); setPreviewUrl(null);

    await addDoc(collection(db, "users", user.uid, "chats", chatId, "messages"), {
        text: userMsg, sender: "user", createdAt: serverTimestamp(),
        image: fileData ? { name: fileData.filename, mime: fileData.mime_type } : null
    });

    try {
        const token = await user.getIdToken();
        const res = await fetch("http://127.0.0.1:8000/ask", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ question: userMsg, file_uri: fileData?.gemini_uri || null, mime_type: fileData?.mime_type || null })
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;
            setStreamText(prev => prev + chunk);
        }

        await addDoc(collection(db, "users", user.uid, "chats", chatId, "messages"), {
            text: fullText, sender: "ai", createdAt: serverTimestamp()
        });
        setStreamText("");
        if (messages.length === 0) updateDoc(doc(db, "users", user.uid, "chats", chatId), { title: userMsg.substring(0, 30) });

    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setPreviewUrl(URL.createObjectURL(f)); }
  };

  const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-purple-600 shadow-lg shadow-purple-200 text-white' : 'hover:bg-purple-50 text-slate-500 hover:text-purple-600'}`}>
      <Icon /> <span className="font-medium">{label}</span>
    </button>
  );

  const StatCard = ({ title, value, sub, delay }) => (
    <div className={`glass-card p-6 flex flex-col justify-between h-32 fade-in bg-white/60 border-purple-100`} style={{ animationDelay: delay }}>
       <div className="text-slate-400 text-sm font-medium">{title}</div>
       <div className="text-3xl font-bold text-slate-800 mt-1">{value}</div>
       <div className="text-xs text-purple-500 mt-auto bg-purple-50 w-fit px-2 py-1 rounded-full">{sub}</div>
    </div>
  );

  if (!user) return (
    <div className="h-screen w-full flex items-center justify-center relative overflow-hidden">
       {/* พื้นหลัง Gradient อ่อนๆ */}
       <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-pink-50"></div>
       <div className="glass p-12 rounded-3xl text-center max-w-md w-full relative z-10 shadow-2xl shadow-purple-200 animate-float border-white">
          <div className="w-20 h-20 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl shadow-purple-200 text-white">
             <Icons.Bot />
          </div>
          <h1 className="text-4xl font-bold mb-2 text-slate-800 tracking-tight">AI Workspace</h1>
          <p className="text-slate-500 mb-8 font-light">พื้นที่ทำงานอัจฉริยะส่วนตัวของคุณ</p>
          <button onClick={loginWithGoogle} className="w-full bg-slate-900 text-white font-medium py-4 rounded-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-3 shadow-lg">
             <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5"/> เข้าสู่ระบบด้วย Google
          </button>
       </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full relative">
       {/* Mobile Backdrop */}
       {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-20 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>}

       {/* Sidebar (Light Theme) */}
       <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-white/70 backdrop-blur-xl border-r border-purple-100 flex flex-col p-4 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="flex items-center gap-3 px-2 mb-8 mt-2">
             <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-200"><Icons.Bot /></div>
             <div>
                <h1 className="font-bold text-lg leading-tight text-slate-800">Gemini Pro</h1>
                <p className="text-[10px] text-purple-500 font-bold tracking-wider">WORKSPACE</p>
             </div>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto pr-2">
             <SidebarItem icon={Icons.Home} label="ภาพรวม" active={view === 'dashboard'} onClick={() => { setView('dashboard'); setSidebarOpen(false); }} />
             <SidebarItem icon={Icons.Chat} label="แชท" active={view === 'chat'} onClick={() => { setView('chat'); setSidebarOpen(false); }} />
             
             <div className="pt-6 pb-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">ประวัติล่าสุด</div>
             <div className="space-y-1">
                {chats.slice(0, 5).map(chat => (
                   <button key={chat.id} onClick={() => { setCurrentChatId(chat.id); setView('chat'); setSidebarOpen(false); }} className={`w-full text-left px-4 py-2 rounded-lg text-sm truncate transition-colors ${currentChatId === chat.id && view === 'chat' ? 'bg-purple-100 text-purple-700 font-medium' : 'text-slate-500 hover:bg-white/50 hover:text-purple-600'}`}>
                      {chat.title}
                   </button>
                ))}
             </div>
          </div>

          <div className="mt-auto border-t border-purple-100 pt-4">
             <button onClick={logout} className="flex items-center gap-3 w-full px-4 py-3 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors text-sm font-medium">
                <Icons.LogOut /> ออกจากระบบ
             </button>
          </div>
       </aside>

       {/* Main Content */}
       <main className="flex-1 flex flex-col relative overflow-hidden">
          {/* Header Mobile */}
          <header className="h-16 flex items-center justify-between px-4 lg:hidden border-b border-purple-100 bg-white/60 backdrop-blur-md sticky top-0 z-10 text-slate-700">
             <button onClick={() => setSidebarOpen(true)} className="p-2"><Icons.Menu/></button>
             <span className="font-bold">{view === 'dashboard' ? 'Overview' : 'Chat'}</span>
             <img src={user.photoURL} className="w-8 h-8 rounded-full border border-purple-200" />
          </header>

          {/* Views */}
          {view === 'dashboard' ? (
             <div className="flex-1 overflow-y-auto p-6 lg:p-10 scroll-smooth">
                <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn">
                   {/* Greeting */}
                   <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                      <div>
                         <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
                            สวัสดีคุณ {user.displayName?.split(' ')[0]}
                         </h2>
                         <p className="text-slate-500 mt-2 font-light text-lg">วันนี้จะให้ AI ช่วยทำอะไรดีครับ?</p>
                      </div>
                      <div className="text-right hidden md:block text-slate-700">
                         <div className="text-3xl font-mono font-light tracking-tight">
                            {time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </div>
                         <div className="text-sm text-slate-400">
                            {time.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                         </div>
                      </div>
                   </div>

                   {/* Stats */}
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <StatCard title="แชททั้งหมด" value={chats.length} sub="เพิ่มขึ้น" delay="0.1s" />
                      <StatCard title="ไฟล์ที่ประมวลผล" value="12" sub="PDF, Excel" delay="0.2s" />
                      <div className="glass-card p-6 flex flex-col justify-center items-center text-center cursor-pointer bg-gradient-to-br from-purple-600 to-pink-500 text-white hover:shadow-purple-500/30 group h-32 border-none" onClick={handleNewChat} style={{ animationDelay: '0.3s' }}>
                         <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <Icons.Plus />
                         </div>
                         <div className="font-semibold">เริ่มแชทใหม่</div>
                      </div>
                   </div>

                   {/* Recent Activity */}
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 glass p-6 rounded-3xl flex flex-col bg-white/40">
                         <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-slate-700">การสนทนาล่าสุด</h3>
                            <button onClick={handleNewChat} className="text-xs bg-purple-100 hover:bg-purple-200 px-4 py-2 rounded-full text-purple-700 transition-colors font-medium">สร้างใหม่</button>
                         </div>
                         <div className="flex-1 space-y-3">
                            {chats.map(chat => (
                               <div key={chat.id} onClick={() => { setCurrentChatId(chat.id); setView('chat'); }} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white cursor-pointer group transition-all border border-transparent hover:border-purple-100 hover:shadow-sm">
                                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                     <Icons.Chat />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                     <div className="text-slate-700 font-semibold truncate group-hover:text-purple-600 transition-colors">{chat.title}</div>
                                     <div className="text-xs text-slate-400 mt-1">ใช้งานล่าสุด {chat.updatedAt?.toDate().toLocaleDateString()}</div>
                                  </div>
                                  <div className="text-slate-300 group-hover:text-purple-500 transition-transform group-hover:translate-x-1">→</div>
                               </div>
                            ))}
                         </div>
                      </div>

                      <div className="glass p-6 rounded-3xl flex flex-col gap-4 bg-white/40">
                         <h3 className="font-bold text-lg text-slate-700 mb-2">เครื่องมือด่วน</h3>
                         <div className="flex-1 grid grid-cols-1 gap-3">
                            {['สรุปเอกสาร PDF', 'แปลภาษา', 'เขียนโค้ด Python', 'ตรวจสอบคำผิด'].map((tool, i) => (
                               <button key={i} onClick={() => { setView('chat'); handleNewChat(); }} className="glass-card p-4 flex items-center gap-3 text-left bg-white/60 border border-white/50 hover:border-purple-200">
                                  <div className="w-2 h-2 rounded-full bg-pink-400 shadow-sm shadow-pink-300"></div>
                                  <span className="text-sm font-medium text-slate-600">{tool}</span>
                               </button>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          ) : (
             /* Chat View (Light Theme) */
             <div className="flex-1 flex flex-col h-full relative">
                <div className="h-16 border-b border-purple-100 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md absolute top-0 w-full z-10 shadow-sm">
                   <div className="flex items-center gap-3">
                      <div className="font-semibold text-slate-800 flex flex-col">
                         <span>{chats.find(c => c.id === currentChatId)?.title || "บทสนทนาใหม่"}</span>
                         <span className="text-[10px] text-green-600 font-mono flex items-center gap-1 font-bold">● ONLINE <span className="text-slate-400 font-normal">| Gemini 2.0 Flash</span></span>
                      </div>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto pt-20 pb-4 px-4 scroll-smooth">
                   <div className="max-w-3xl mx-auto space-y-6">
                      {messages.map(msg => (
                         <div key={msg.id} className={`flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${msg.sender === 'ai' ? 'bg-gradient-to-tr from-purple-500 to-pink-500 text-white' : 'bg-white border border-purple-100'}`}>
                               {msg.sender === 'ai' ? <Icons.Bot /> : <img src={user.photoURL} className="w-full h-full rounded-full" />}
                            </div>
                            <div className={`flex flex-col max-w-[80%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                               <div className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                  msg.sender === 'user' 
                                  ? 'bg-purple-600 text-white rounded-tr-sm shadow-purple-200' 
                                  : 'bg-white border border-purple-50 text-slate-700 rounded-tl-sm shadow-sm'
                               }`}>
                                  {msg.image && (
                                     <div className="mb-3 rounded-lg overflow-hidden border border-white/20">
                                        <div className="bg-slate-100 p-2 flex items-center gap-2 text-xs text-slate-600">
                                           <Icons.Image /> {msg.image.name}
                                        </div>
                                     </div>
                                  )}
                                  {msg.sender === 'ai' ? (
                                     <ReactMarkdown 
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                           code({node, inline, className, children, ...props}) {
                                              const match = /language-(\w+)/.exec(className || '')
                                              return !inline && match ? (
                                                 <div className="rounded-lg overflow-hidden my-3 border border-slate-200 shadow-sm">
                                                    <div className="bg-slate-50 px-3 py-1 text-[10px] text-slate-500 flex justify-between uppercase tracking-wider border-b border-slate-200">{match[1]}</div>
                                                    <SyntaxHighlighter style={oneLight} language={match[1]} PreTag="div" customStyle={{margin:0, borderRadius:0}} {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                                                 </div>
                                              ) : <code className="bg-slate-100 px-1 py-0.5 rounded text-pink-600 font-mono text-xs border border-slate-200" {...props}>{children}</code>
                                           }
                                        }}
                                     >{msg.text}</ReactMarkdown>
                                  ) : msg.text}
                               </div>
                               <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.createdAt?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                         </div>
                      ))}
                      
                      {streamText && (
                         <div className="flex gap-4">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 animate-pulse text-white"><Icons.Bot /></div>
                            <div className="bg-white border border-purple-50 px-5 py-3.5 rounded-2xl rounded-tl-sm text-slate-700 text-sm max-w-[80%] shadow-sm">
                               <ReactMarkdown components={{code:({children})=><code className="bg-slate-100 px-1 rounded text-pink-600 font-mono">{children}</code>}}>{streamText}</ReactMarkdown>
                               <span className="inline-block w-1.5 h-4 ml-1 bg-purple-500 animate-pulse align-middle rounded-full"></span>
                            </div>
                         </div>
                      )}
                      {loading && !streamText && <div className="text-center text-xs text-slate-400 animate-pulse mt-4">กำลังคิด...</div>}
                      <div ref={messagesEndRef} />
                   </div>
                </div>

                <div className="p-4 bg-white/80 backdrop-blur-md border-t border-purple-100">
                   <div className="max-w-3xl mx-auto">
                      {previewUrl && (
                         <div className="mb-3 inline-flex items-center gap-3 bg-white p-2 pr-4 rounded-xl border border-purple-100 shadow-lg animate-float">
                            <img src={previewUrl} className="w-10 h-10 rounded-lg object-cover" />
                            <div className="text-xs">
                               <div className="text-slate-800 font-medium truncate max-w-[150px]">{file.name}</div>
                               <div className="text-purple-500">พร้อมอัพโหลด</div>
                            </div>
                            <button onClick={() => { setFile(null); setPreviewUrl(null); }} className="text-slate-400 hover:text-red-500 bg-slate-50 rounded-full p-1"><Icons.Plus className="rotate-45"/></button>
                         </div>
                      )}
                      
                      <form onSubmit={handleSend} className="bg-white rounded-2xl p-2 flex items-end gap-2 shadow-xl shadow-purple-100 ring-1 ring-purple-100 focus-within:ring-purple-400 transition-all">
                         <div className="relative">
                            <input type="file" id="file-up" className="hidden" onChange={handleFileSelect} />
                            <label htmlFor="file-up" className="p-3 hover:bg-purple-50 rounded-xl cursor-pointer text-slate-400 hover:text-purple-600 transition-colors block">
                               <Icons.Plus />
                            </label>
                         </div>
                         
                         <textarea 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) handleSend(e); }}
                            placeholder="พิมพ์ข้อความที่นี่..."
                            className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 placeholder-slate-400 resize-none py-3 max-h-32 text-sm leading-relaxed"
                            rows="1"
                         />

                         <button type="submit" disabled={(!input.trim() && !file) || loading} className="p-3 bg-gradient-to-br from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white rounded-xl shadow-lg shadow-purple-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95">
                            <Icons.Send />
                         </button>
                      </form>
                   </div>
                </div>
             </div>
          )}
       </main>
    </div>
  );
}

export default App;