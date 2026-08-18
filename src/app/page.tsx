'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { Sidebar } from '@/components/Sidebar';
import { MessageItem, Message } from '@/components/MessageItem';
import { AuthModal } from '@/components/AuthModal';
import { ExportVaultModal } from '@/components/ExportVaultModal';
import { QuickSplash } from '@/components/QuickSplash';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { RenameModal } from '@/components/RenameModal';
import {
  getSavedThreads,
  saveThreads,
  getUserMemory,
  saveUserMemory,
  generateSmartThreadTitle,
  generateUUID,
  ChatThread
} from '@/lib/memoryEngine';
import {
  getThreadsFromSupabase,
  upsertThread,
  upsertAllThreads,
  deleteThreadFromSupabase,
  upsertUser
} from '@/lib/supabaseDb';
import { send7DayInactivityAlert } from '@/lib/notificationEngine';
import {
  Send,
  Loader2,
  RefreshCw,
  Sparkles,
  Heart,
  Code,
  Globe,
  Menu,
  LogIn,
  LogOut,
  Download,
  Languages,
  Paperclip,
  FileText,
  X,
  ImageIcon
} from 'lucide-react';

interface AttachedFile {
  name: string;
  size: number;
  text: string;
  type: string;
}

/* ──────────────────────────────────────────────
   INLINE HEADER
────────────────────────────────────────────── */
interface AppHeaderProps {
  language: string;
  setLanguage: (l: string) => void;
  onOpenAuth: () => void;
  onToggleSidebar: () => void;
  onOpenExport: () => void;
}

function AppHeader({ language, setLanguage, onOpenAuth, onToggleSidebar, onOpenExport }: AppHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="h-14 flex-shrink-0 bg-[#09090b] border-b border-zinc-800 px-3 sm:px-6 flex items-center justify-between z-20 gap-3">
      {/* Left: Hamburger + Logo */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 hover:bg-zinc-800 transition-all active:scale-95"
        >
          <Menu className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="relative w-7 h-7 rounded-xl overflow-hidden border border-zinc-800 flex-shrink-0">
            <Image src="/logo.jpg" alt="Machi AI" fill className="object-cover" />
          </div>
          <span className="text-sm font-bold text-zinc-100 tracking-tight hidden sm:inline">Machi AI</span>
        </div>
      </div>

      {/* Middle: Language Selector */}
      <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5 text-[11px] font-semibold overflow-hidden">
        <Languages className="w-3 h-3 text-zinc-400 ml-1 mr-0.5 hidden sm:inline flex-shrink-0" />
        {(['auto', 'en', 'tanglish', 'ta'] as const).map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`px-2 py-1 rounded-lg transition-all whitespace-nowrap ${
              language === lang
                ? 'bg-white text-zinc-950 font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {lang === 'auto' ? 'Auto' : lang === 'en' ? 'English' : lang === 'tanglish' ? 'Tanglish' : 'தமிழ்'}
          </button>
        ))}
      </div>

      {/* Right: Export + Auth */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onOpenExport}
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 transition-all active:scale-95"
          title="Export vault"
        >
          <Download className="w-4 h-4" />
        </button>

        {user?.isLoggedIn ? (
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1">
            <div className="w-5 h-5 rounded-full bg-white text-zinc-950 font-bold flex items-center justify-center text-[10px]">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-semibold text-zinc-100 max-w-[72px] truncate hidden md:inline">{user.name}</span>
            <button onClick={logout} className="text-zinc-500 hover:text-rose-400 transition-colors ml-0.5">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-zinc-950 font-bold text-xs transition-all hover:bg-zinc-100 active:scale-95"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────
   MAIN APP
────────────────────────────────────────────── */
function MachiApp() {
  const { user, supabaseUserId } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showDesktopSidebar, setShowDesktopSidebar] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [deletingThread, setDeletingThread] = useState<ChatThread | null>(null);
  const [renamingThread, setRenamingThread] = useState<ChatThread | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>('');
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Thread Hydration ── */
  useEffect(() => {
    const loadThreads = async () => {
      setThreadsLoading(true);

      if (user?.isLoggedIn && user?.email) {
        let currentSupabaseId = supabaseUserId;
        if (!currentSupabaseId) {
          currentSupabaseId = await upsertUser(user.email, user.name);
        }

        if (currentSupabaseId) {
          const remoteThreads = await getThreadsFromSupabase(currentSupabaseId);

          const localThreads = getSavedThreads(user.email);
          const localOnly = localThreads.filter(
            (lt) => !remoteThreads.some((rt) => rt.id === lt.id)
          );

          if (localOnly.length > 0) {
            await upsertAllThreads(currentSupabaseId, localOnly);
          }

          const merged = [...remoteThreads, ...localOnly].sort(
            (a, b) => b.updatedAt - a.updatedAt
          );

          if (merged.length > 0) {
            setThreads(merged);
            setActiveThreadId(merged[0].id);

            // 7-day inactivity check
            const sevenDaysMs = 7 * 86400 * 1000;
            const now = Date.now();
            const inactiveThread = merged.find((t) => t.messages.length > 0 && now - t.updatedAt >= sevenDaysMs);
            if (inactiveThread && user.email) {
              const daysOld = Math.floor((now - inactiveThread.updatedAt) / (86400 * 1000));
              send7DayInactivityAlert(user.email, user.name, inactiveThread.title || 'Conversation', daysOld);
            }
          } else {
            const newId = generateUUID();
            const fresh: ChatThread = {
              id: newId,
              title: 'New Conversation',
              messages: [],
              updatedAt: Date.now()
            };
            await upsertThread(currentSupabaseId, fresh);
            saveThreads([fresh], user.email);
            setThreads([fresh]);
            setActiveThreadId(newId);
          }
        }
      } else {
        const guestId = generateUUID();
        const freshGuest: ChatThread = {
          id: guestId,
          title: 'New Conversation',
          messages: [],
          updatedAt: Date.now()
        };
        setThreads([freshGuest]);
        setActiveThreadId(guestId);
      }

      setThreadsLoading(false);
    };

    loadThreads();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseUserId, user?.isLoggedIn, user?.email]);

  useEffect(() => {
    if (user?.name) {
      const mem = getUserMemory(user.name);
      mem.userName = user.name;
      saveUserMemory(mem);
    }
  }, [user]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || threads[0],
    [threads, activeThreadId]
  );
  const messages = useMemo(() => activeThread?.messages ?? [], [activeThread]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const adjustTextarea = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Document & File Upload Reader
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let extractedText = '';
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        extractedText = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        extractedText = await file.text();
        // Limit document snippet size to prevent overflow
        if (extractedText.length > 15000) {
          extractedText = extractedText.slice(0, 15000) + '\n...[Document truncated for length]';
        }
      }

      setAttachedFile({
        name: file.name,
        size: file.size,
        text: extractedText,
        type: file.type
      });
    } catch {
      alert('Could not read file content. Please upload plain text, code, PDF, image, or document files.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleNewChat = async () => {
    const newId = generateUUID();
    const newThread: ChatThread = {
      id: newId,
      title: 'New Chat',
      messages: [],
      updatedAt: Date.now()
    };

    setThreads((prev) => {
      const updated = [newThread, ...prev];
      if (user?.isLoggedIn && user?.email) {
        saveThreads(updated, user.email);
      }
      return updated;
    });
    setActiveThreadId(newId);

    if (user?.isLoggedIn && supabaseUserId) {
      await upsertThread(supabaseUserId, newThread);
    }
  };

  const handleConfirmDeleteThread = async () => {
    if (!deletingThread) return;
    const targetId = deletingThread.id;

    if (user?.isLoggedIn && supabaseUserId) {
      await deleteThreadFromSupabase(targetId);
    }

    setThreads((prev) => {
      const remaining = prev.filter((t) => t.id !== targetId);
      if (user?.isLoggedIn && user?.email) {
        saveThreads(remaining, user.email);
      }

      if (remaining.length === 0) {
        const newId = generateUUID();
        const fresh: ChatThread = {
          id: newId,
          title: 'New Conversation',
          messages: [],
          updatedAt: Date.now()
        };
        if (user?.isLoggedIn && supabaseUserId) {
          upsertThread(supabaseUserId, fresh);
        }
        if (user?.isLoggedIn && user?.email) {
          saveThreads([fresh], user.email);
        }
        setActiveThreadId(newId);
        return [fresh];
      } else {
        if (activeThreadId === targetId) {
          setActiveThreadId(remaining[0].id);
        }
        return remaining;
      }
    });

    setDeletingThread(null);
  };

  const handleSaveRenameThread = async (newTitle: string) => {
    if (!renamingThread) return;
    const targetId = renamingThread.id;
    const cleanTitle = newTitle.trim() || 'New Conversation';

    setThreads((prev) => {
      const updated = prev.map((t) => {
        if (t.id === targetId) {
          return { ...t, title: cleanTitle, updatedAt: Date.now() };
        }
        return t;
      });

      if (user?.isLoggedIn && user?.email) {
        saveThreads(updated, user.email);
      }

      if (user?.isLoggedIn && supabaseUserId) {
        const renamed = updated.find((t) => t.id === targetId);
        if (renamed) upsertThread(supabaseUserId, renamed);
      }

      return updated;
    });

    setRenamingThread(null);
  };

  const handleSendMessage = async (customText?: string) => {
    const rawText = customText || input;
    if (!rawText.trim() && !attachedFile) return;
    if (isLoading || !activeThreadId) return;

    // Attach file context or base64 image data URL
    let promptContent = rawText.trim();
    if (attachedFile) {
      if (attachedFile.type.startsWith('image/')) {
        promptContent = `${promptContent || 'Please analyze and describe what is shown in this uploaded image.'}\n\n[IMAGE_DATA_URL:${attachedFile.text}]`;
      } else {
        promptContent = `[ATTACHED FILE: ${attachedFile.name}]\n\n--- FILE CONTENT ---\n${attachedFile.text}\n--- END FILE ---\n\n${promptContent || 'Please summarize and explain this uploaded document.'}`;
      }
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: promptContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (!customText) {
      setInput('');
      setAttachedFile(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }

    const updatedMessages = [...messages, userMsg];
    setIsLoading(true);

    setThreads((prevThreads) => {
      const updated = prevThreads.map((t) => {
        if (t.id !== activeThreadId) return t;
        const newTitle = generateSmartThreadTitle(updatedMessages, prevThreads, activeThreadId);
        return { ...t, messages: updatedMessages, title: newTitle, updatedAt: Date.now() };
      });

      if (user?.isLoggedIn && user?.email) {
        saveThreads(updated, user.email);
      }

      if (user?.isLoggedIn && supabaseUserId) {
        const activeUpdated = updated.find((t) => t.id === activeThreadId);
        if (activeUpdated) upsertThread(supabaseUserId, activeUpdated);
      }

      return updated;
    });

    try {
      const memory = getUserMemory(user?.name || '');
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          persona: 'chill',
          language,
          userName: memory.userName || user?.name || ''
        })
      });
      const data = await res.json();

      const botContent = data.reply || 'Machi AI connection slow ah iruku. Retry in 2 seconds! 🚀';
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: botContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setThreads((prevThreads) => {
        const updated = prevThreads.map((t) => {
          if (t.id !== activeThreadId) return t;
          const currentTarget = prevThreads.find((pt) => pt.id === activeThreadId);
          const baseMsgs = currentTarget ? currentTarget.messages : updatedMessages;
          const finalMsgs = [...baseMsgs, botMsg];
          return { ...t, messages: finalMsgs, updatedAt: Date.now() };
        });

        if (user?.isLoggedIn && user?.email) {
          saveThreads(updated, user.email);
        }

        if (user?.isLoggedIn && supabaseUserId) {
          const completedThread = updated.find((t) => t.id === activeThreadId);
          if (completedThread) upsertThread(supabaseUserId, completedThread);
        }

        return updated;
      });

    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Machi AI connection slow ah iruku. Retry in 2 seconds! 🚀',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setThreads((prevThreads) => {
        const updated = prevThreads.map((t) => {
          if (t.id !== activeThreadId) return t;
          const currentTarget = prevThreads.find((pt) => pt.id === activeThreadId);
          const baseMsgs = currentTarget ? currentTarget.messages : updatedMessages;
          const finalMsgs = [...baseMsgs, errMsg];
          return { ...t, messages: finalMsgs, updatedAt: Date.now() };
        });

        if (user?.isLoggedIn && user?.email) {
          saveThreads(updated, user.email);
        }

        if (user?.isLoggedIn && supabaseUserId) {
          const errThread = updated.find((t) => t.id === activeThreadId);
          if (errThread) upsertThread(supabaseUserId, errThread);
        }

        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setShowMobileSidebar((p) => !p);
    } else {
      setShowDesktopSidebar((p) => !p);
    }
  };

  const prompts = [
    { icon: ImageIcon, lang: 'AI Image', text: 'Generate image of a futuristic Cyberpunk city in Tamil Nadu' },
    { icon: Globe, lang: 'English', text: 'Help me draft a professional email response for a client meeting.' },
    { icon: Heart, lang: 'Tanglish', text: 'Machi, life la focus & motivation vara oru simple Tanglish advice thaa da!' },
    { icon: Code, lang: 'Coding', text: 'Explain React custom hooks with a code example.' }
  ];

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#09090b] text-white flex flex-col overflow-hidden">
      {showSplash && <QuickSplash onFinish={() => setShowSplash(false)} />}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <DeleteConfirmModal isOpen={!!deletingThread} threadTitle={deletingThread?.title || ''} onConfirm={handleConfirmDeleteThread} onCancel={() => setDeletingThread(null)} />
      <RenameModal isOpen={!!renamingThread} currentTitle={renamingThread?.title || ''} onSave={handleSaveRenameThread} onCancel={() => setRenamingThread(null)} />
      <ExportVaultModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} messages={messages} userName={user?.name || ''} />

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.csv,.json,.js,.py,.html,.css,.md,.png,.jpg,.jpeg"
        className="hidden"
      />

      {/* ── BODY ROW ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── SIDEBAR ── */}
        <Sidebar
          isOpenMobile={showMobileSidebar}
          isDesktopOpen={showDesktopSidebar}
          onCloseMobile={() => setShowMobileSidebar(false)}
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={(id) => setActiveThreadId(id)}
          onNewChat={handleNewChat}
          onRequestRenameThread={(t) => setRenamingThread(t)}
          onRequestDeleteThread={(t) => setDeletingThread(t)}
          onOpenAuth={() => setShowAuthModal(true)}
        />

        {/* ── MAIN COLUMN ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          <AppHeader
            language={language}
            setLanguage={setLanguage}
            onOpenAuth={() => setShowAuthModal(true)}
            onToggleSidebar={handleToggleSidebar}
            onOpenExport={() => setShowExportModal(true)}
          />

          {/* Scrollable Messages Area */}
          <main className="flex-1 overflow-y-auto min-h-0 px-4 py-6 space-y-4 max-w-3xl mx-auto w-full">
            {threadsLoading && (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-zinc-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing your conversations...</span>
              </div>
            )}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-10 gap-5">
                <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-zinc-800 shadow-lg">
                  <Image src="/logo.jpg" alt="Machi AI" fill className="object-cover" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">How can Machi AI help?</h2>
                  <p className="text-xs text-zinc-400">
                    {user?.name ? `Welcome back, ${user.name}. ` : ''}Trilingual AI • Image Generator • Document Intelligence
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl text-left">
                  {prompts.map((p, idx) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(p.text)}
                        className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all text-xs font-medium text-zinc-100 group flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded-md">{p.lang}</span>
                          <Icon className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
                        </div>
                        <p className="line-clamp-2 leading-relaxed text-zinc-400 group-hover:text-zinc-200 transition-colors">{p.text}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                onEditMessage={(text) => {
                  setInput(text);
                  textareaRef.current?.focus();
                }}
                onRegenerate={() => {
                  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                  if (lastUser) handleSendMessage(lastUser.content);
                }}
              />
            ))}

            {isLoading && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 max-w-[90%] animate-pulse">
                <div className="w-7 h-7 rounded-xl bg-zinc-800 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
                </div>
                <div className="text-xs text-zinc-300 font-medium flex items-center gap-2">
                  <span>Machi AI is generating response...</span>
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-400" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </main>

          {/* ── FIXED BOTTOM INPUT BAR ── */}
          <div className="flex-shrink-0 w-full bg-[#09090b] border-t border-zinc-800 p-3 z-20"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <div className="max-w-3xl mx-auto flex flex-col gap-2">

              {/* Attached File Pill Badge */}
              {attachedFile && (
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 animate-fadeIn">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span className="truncate font-semibold">{attachedFile.name}</span>
                    <span className="text-[10px] text-zinc-400">({(attachedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    onClick={() => setAttachedFile(null)}
                    className="p-1 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Text Input & Action Buttons */}
              <div className="flex items-end gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-2 focus-within:border-zinc-600 transition-colors">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex-shrink-0"
                  title="Upload PDF, PPT, TXT, Code, or Image"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); adjustTextarea(); }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder={attachedFile ? `Ask questions about ${attachedFile.name}...` : "Ask Machi AI or type 'generate image of...'"}
                  disabled={isLoading}
                  className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none resize-none max-h-40 min-h-[24px] leading-relaxed py-1"
                />

                <button
                  onClick={() => handleSendMessage()}
                  disabled={(!input.trim() && !attachedFile) || isLoading}
                  className={`p-2 rounded-xl flex-shrink-0 transition-all ${
                    (input.trim() || attachedFile) && !isLoading
                      ? 'text-white bg-white/10 hover:bg-white/20 active:scale-95'
                      : 'text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   ROOT EXPORT
────────────────────────────────────────────── */
export default function Home() {
  const googleClientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    '560458778439-b96elns70cmk03r33spt91c2qkjlsc9c.apps.googleusercontent.com';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <MachiApp />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
