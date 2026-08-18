'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Copy, Check, ThumbsUp, ThumbsDown, RotateCcw, User, Edit2, Volume2, VolumeX, Download, ExternalLink } from 'lucide-react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface MessageItemProps {
  message: Message;
  onRegenerate?: () => void;
  onEditMessage?: (text: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, onRegenerate, onEditMessage }) => {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Text-to-Speech Voice Reader
  const handleToggleVoice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isPlayingVoice) {
      window.speechSynthesis.cancel();
      setIsPlayingVoice(false);
      return;
    }

    window.speechSynthesis.cancel();

    // Strip code blocks and markdown symbols for speech reading
    const cleanText = message.content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/[*_#`]/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Detect language: Tamil / English
    const containsTamil = /[\u0B80-\u0BFF]/.test(cleanText);
    const voices = window.speechSynthesis.getVoices();
    if (containsTamil) {
      const taVoice = voices.find((v) => v.lang.includes('ta') || v.name.toLowerCase().includes('tamil'));
      if (taVoice) utterance.voice = taVoice;
    }

    utterance.onend = () => setIsPlayingVoice(false);
    utterance.onerror = () => setIsPlayingVoice(false);

    setIsPlayingVoice(true);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const renderFormattedContent = (content: string) => {
    // 1. Detect markdown images ![alt](url)
    const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let match;

    const processTextAndCode = (textSnippet: string, keyOffset: number) => {
      const codeBlockRegex = /```([\s\S]*?)```/g;
      const subParts = [];
      let codeLastIdx = 0;
      let codeMatch;

      while ((codeMatch = codeBlockRegex.exec(textSnippet)) !== null) {
        if (codeMatch.index > codeLastIdx) {
          subParts.push({ type: 'text', text: textSnippet.slice(codeLastIdx, codeMatch.index) });
        }
        subParts.push({ type: 'code', text: codeMatch[1].trim() });
        codeLastIdx = codeMatch.index + codeMatch[0].length;
      }
      if (codeLastIdx < textSnippet.length) {
        subParts.push({ type: 'text', text: textSnippet.slice(codeLastIdx) });
      }

      return subParts.map((sub, sIdx) => {
        const uniqueKey = `sub-${keyOffset}-${sIdx}`;
        if (sub.type === 'code') {
          return (
            <div key={uniqueKey} className="my-3 rounded-xl overflow-hidden border border-[#27272a] bg-[#09090b] font-mono text-xs text-[#fafafa]">
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#18181b] border-b border-[#27272a] text-[11px] text-[#a1a1aa]">
                <span>Code Snippet</span>
                <button
                  onClick={() => navigator.clipboard.writeText(sub.text)}
                  className="hover:text-[#fafafa] transition-colors flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Code</span>
                </button>
              </div>
              <pre className="p-3.5 overflow-x-auto whitespace-pre-wrap leading-relaxed">{sub.text}</pre>
            </div>
          );
        }

        const formattedText = sub.text.split('\n').map((line, lIdx) => (
          <p key={`${uniqueKey}-line-${lIdx}`} className={lIdx > 0 ? 'mt-1.5' : ''}>
            {line}
          </p>
        ));

        return <div key={uniqueKey}>{formattedText}</div>;
      });
    };

    while ((match = imageRegex.exec(content)) !== null) {
      if (match.index > lastIdx) {
        parts.push(processTextAndCode(content.slice(lastIdx, match.index), lastIdx));
      }

      const altText = match[1] || 'AI Generated Artwork';
      const imgUrl = match[2];

      parts.push(
        <div key={`img-${match.index}`} className="my-4 rounded-2xl overflow-hidden border border-[#3f3f46] bg-[#09090b] max-w-md shadow-xl group relative">
          <div className="relative w-full h-72 sm:h-80 bg-zinc-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgUrl}
              alt={altText}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          </div>
          <div className="p-3 bg-[#18181b] border-t border-[#27272a] flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-200 truncate">{altText}</span>
            <div className="flex items-center gap-2">
              <a
                href={imgUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                title="Open original"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href={imgUrl}
                download={`machi-ai-artwork-${Date.now()}.png`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
            </div>
          </div>
        </div>
      );

      lastIdx = match.index + match[0].length;
    }

    if (lastIdx < content.length) {
      parts.push(processTextAndCode(content.slice(lastIdx), lastIdx));
    }

    return parts;
  };

  return (
    <div
      className={`flex gap-3 sm:gap-4 p-4 rounded-2xl transition-all ${
        isUser
          ? 'bg-[#27272a] border border-[#3f3f46] ml-auto max-w-[88%] sm:max-w-[80%]'
          : 'bg-[#18181b] border border-[#27272a] max-w-[95%] sm:max-w-[90%]'
      }`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {isUser ? (
          <div className="w-8 h-8 rounded-xl bg-[#fafafa] text-[#09090b] font-bold flex items-center justify-center shadow-sm">
            <User className="w-4 h-4 text-[#09090b]" />
          </div>
        ) : (
          <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-[#27272a] shadow-sm">
            <Image src="/logo.jpg" alt="Machi AI" fill className="object-cover" />
          </div>
        )}
      </div>

      {/* Message Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-bold text-[#fafafa] font-heading">
            {isUser ? 'You' : 'Machi AI'}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#71717a]">{message.timestamp}</span>
            {isUser && onEditMessage && (
              <button
                onClick={() => onEditMessage(message.content)}
                className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Edit message"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="text-sm text-[#fafafa] leading-relaxed font-normal break-words">
          {renderFormattedContent(message.content)}
        </div>

        {/* Action Toolbar for AI responses */}
        {!isUser && (
          <div className="flex items-center gap-3 mt-3 pt-2 border-t border-[#27272a] text-[#a1a1aa] text-xs flex-wrap">
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 rounded-md hover:text-[#fafafa] hover:bg-[#27272a] transition-colors"
              title="Copy message"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Voice Reader Button */}
            <button
              onClick={handleToggleVoice}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                isPlayingVoice ? 'text-amber-400 bg-amber-400/10 font-semibold' : 'hover:text-[#fafafa] hover:bg-[#27272a]'
              }`}
              title={isPlayingVoice ? 'Stop voice' : 'Listen voice'}
            >
              {isPlayingVoice ? <VolumeX className="w-3.5 h-3.5 animate-pulse text-amber-400" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{isPlayingVoice ? 'Speaking...' : 'Listen'}</span>
            </button>

            {/* Regenerate Button */}
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 px-2 py-1 rounded-md hover:text-[#fafafa] hover:bg-[#27272a] transition-colors"
                title="Regenerate response"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Regenerate</span>
              </button>
            )}

            {/* Thumbs Feedback */}
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
                className={`p-1 rounded-md transition-colors ${
                  feedback === 'up' ? 'text-[#fafafa] bg-[#27272a]' : 'hover:text-[#fafafa] hover:bg-[#27272a]'
                }`}
                title="Helpful"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
                className={`p-1 rounded-md transition-colors ${
                  feedback === 'down' ? 'text-rose-400 bg-rose-500/10' : 'hover:text-[#fafafa] hover:bg-[#27272a]'
                }`}
                title="Not helpful"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
