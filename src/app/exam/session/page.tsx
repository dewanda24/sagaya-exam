'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  ShieldAlert,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Send,
  HelpCircle,
  Maximize,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  Flag,
  Trash2,
  AlertTriangle,
  FileText,
} from 'lucide-react';

export default function ExamSessionPage() {
  const router = useRouter();

  // State Data
  const [loading, setLoading] = useState(true);
  const [sessionState, setSessionState] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { value: any; isDoubtful?: boolean; version?: number }>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');
  const [tabViolations, setTabViolations] = useState(0);
  const [broadcastMessage, setBroadcastMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<any>(null);

  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const essayDebounceTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  // 1. Initial Load / Recovery
  const loadSessionData = useCallback(async (isRecoveryFlow = false) => {
    if (isRecoveryFlow) setIsRecovering(true);
    try {
      const endpoint = isRecoveryFlow ? '/api/exam/session/recover' : '/api/exam/session/current';
      const res = await fetch(endpoint, {
        method: isRecoveryFlow ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        router.push('/exam');
        return;
      }

      const { session, participant, exam, questions: qs, answers: ans } = json.data;

      // Jika ujian sudah submitted
      if (session.status === 'SUBMITTED') {
        setSubmittedResult({ status: 'SUBMITTED' });
        setLoading(false);
        setIsRecovering(false);
        return;
      }

      setSessionState({ session, participant, exam });
      setQuestions(qs || []);
      setAnswers(ans || {});
      setRemainingSeconds(session.remainingSeconds ?? 0);
      setTabViolations(session.tabViolationCount ?? 0);
      setIsExpired(session.isExpired || session.remainingSeconds <= 0);
    } catch (err) {
      console.error('Failed to load session:', err);
    } finally {
      setLoading(false);
      setIsRecovering(false);
    }
  }, [router]);

  useEffect(() => {
    loadSessionData(false);
  }, [loadSessionData]);

  // 2. Network Liveness Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      loadSessionData(true);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadSessionData]);

  // 3. Tab Violation Tracking
  const recordViolationEvent = useCallback(async (type: string) => {
    try {
      const res = await fetch('/api/exam/session/violation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          severity: 'WARNING',
          metadata: { timestamp: new Date().toISOString() },
        }),
      });
      const json = await res.json();
      if (json.success && typeof json.totalViolations === 'number') {
        setTabViolations(json.totalViolations);
      }
    } catch (e) {
      console.error('Failed to log violation event:', e);
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolationEvent('TAB_SWITCH');
      }
    };

    const handleWindowBlur = () => {
      recordViolationEvent('FOCUS_LOST');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [recordViolationEvent]);

  // 4. Server-Authoritative Timer Countdown
  useEffect(() => {
    if (remainingSeconds <= 0 || isExpired) return;

    countdownTimerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          clearInterval(countdownTimerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [remainingSeconds, isExpired]);

  // 5. Periodic Heartbeat (every 10 seconds)
  useEffect(() => {
    const sendHeartbeat = async () => {
      if (!isOnline || isExpired) return;

      try {
        const res = await fetch('/api/exam/session/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentQuestionIndex: currentIndex }),
        });

        const json = await res.json();
        if (json.success) {
          if (typeof json.remainingSeconds === 'number') {
            setRemainingSeconds(json.remainingSeconds);
          }
          if (json.isExpired || json.status === 'TIMEOUT') {
            setIsExpired(true);
          }
          if (json.broadcastMessage) {
            setBroadcastMessage(json.broadcastMessage);
          }
        }
      } catch (err) {
        console.error('Heartbeat sync failed:', err);
      }
    };

    heartbeatTimerRef.current = setInterval(sendHeartbeat, 10000);

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [isOnline, isExpired, currentIndex]);

  // 6. Autosave Answer Handler
  const handleSaveAnswer = async (
    questionId: string,
    answerValue: any,
    isDoubtful: boolean = false,
    clear: boolean = false
  ) => {
    if (isExpired || submittedResult) return;

    const currentAns = answers[questionId];
    const nextVersion = (currentAns?.version || 0) + 1;

    // Optimistic UI update
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        value: clear ? null : answerValue,
        isDoubtful,
        version: nextVersion,
      },
    }));

    setSavingStatus('saving');

    try {
      const res = await fetch('/api/exam/session/current/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          answer: answerValue,
          clientVersion: nextVersion,
          isDoubtful,
          clear,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSavingStatus('saved');
        if (json.data?.version) {
          setAnswers((prev) => ({
            ...prev,
            [questionId]: {
              ...prev[questionId],
              version: json.data.version,
            },
          }));
        }
      } else {
        setSavingStatus('error');
      }
    } catch (err) {
      setSavingStatus('error');
    }
  };

  // Toggle Mark for Review
  const handleToggleMark = async (questionId: string) => {
    const currentAns = answers[questionId];
    const newMark = !currentAns?.isDoubtful;
    await handleSaveAnswer(questionId, currentAns?.value ?? null, newMark, false);
  };

  // Clear Answer
  const handleClearAnswer = async (questionId: string) => {
    const currentAns = answers[questionId];
    await handleSaveAnswer(questionId, null, currentAns?.isDoubtful ?? false, true);
  };

  // 7. Submit Exam Handler
  const handleSubmitExam = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/exam/session/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSubmittedResult(json.data || { status: 'SUBMITTED' });
        setShowSubmitModal(false);
      } else {
        alert(json.error || 'Gagal mengirimkan ujian. Silakan coba lagi.');
      }
    } catch (err) {
      alert('Terjadi kendala jaringan saat mengirimkan ujian.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-submit on timeout
  useEffect(() => {
    if (isExpired && !submittedResult && !isSubmitting) {
      handleSubmitExam();
    }
  }, [isExpired, submittedResult, isSubmitting]);

  // Format Timer mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Navigation Logic with LINEAR_NAVIGATION Policy check
  const isLinear = sessionState?.exam?.navigationPolicy === 'LINEAR_NAVIGATION';

  const canNavigateToIndex = (targetIdx: number) => {
    if (!isLinear) return true;
    if (targetIdx <= currentIndex) return true;
    // Pada linear navigation, target index hanya boleh ke index tepat berikutnya jika soal saat ini sudah dijawab
    if (targetIdx === currentIndex + 1) {
      const currentQ = questions[currentIndex];
      const ans = currentQ ? answers[currentQ.id]?.value : null;
      return ans !== null && ans !== undefined && ans !== '';
    }
    return false;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-300 font-medium">Memuat Lembar Ujian...</p>
      </div>
    );
  }

  // Submission Completed Screen
  if (submittedResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/80 border border-white/10 rounded-2xl p-8 text-center shadow-2xl backdrop-blur-md">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4 text-emerald-400">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Ujian Berhasil Diserahkan</h2>
          <p className="text-sm text-slate-300 mb-6">
            Seluruh lembar jawaban Anda telah terkunci dan tersimpan secara permanen di server ujian. Terima kasih.
          </p>
          <div className="p-4 bg-slate-800/60 rounded-xl text-xs text-slate-400 mb-6 border border-white/5 space-y-1 text-left">
            <div className="flex justify-between">
              <span>Status Pengerjaan:</span>
              <span className="text-emerald-400 font-semibold">SUBMITTED (TERKUNCI)</span>
            </div>
            <div className="flex justify-between">
              <span>Waktu Selesai:</span>
              <span className="text-white">{new Date().toLocaleTimeString('id-ID')}</span>
            </div>
          </div>
          <button
            onClick={() => router.push('/exam')}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all"
          >
            Selesai & Keluar
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;

  // Total Statistics for Submit Review
  const totalQuestions = questions.length;
  const answeredCount = questions.filter((q) => {
    const v = answers[q.id]?.value;
    return v !== null && v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0);
  }).length;
  const markedCount = questions.filter((q) => answers[q.id]?.isDoubtful).length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none font-sans">
      {/* Recovery Overlay */}
      {isRecovering && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
          <h3 className="text-lg font-bold">Memulihkan Sesi Ujian...</h3>
          <p className="text-xs text-indigo-300">Menyinkronkan status jawaban dan waktu server.</p>
        </div>
      )}

      {/* Broadcast Announcement Bar */}
      {broadcastMessage && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 text-amber-200 px-4 py-2 text-xs flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Pemberitahuan Pengawas: {broadcastMessage}</span>
          </div>
          <button
            onClick={() => setBroadcastMessage(null)}
            className="text-amber-400 hover:text-white text-xs underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Header Bar */}
      <header className="h-16 bg-slate-900 border-b border-white/10 px-4 sm:px-6 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow">
            {currentIndex + 1}
          </div>
          <div>
            <h1 className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
              {sessionState?.exam?.title || 'Lembar Soal Ujian'}
            </h1>
            <p className="text-xs text-slate-400">
              {sessionState?.participant?.studentName} &bull; Paket {sessionState?.participant?.assignedPackage || 'A'}
              {isLinear && <span className="ml-2 text-amber-400 font-semibold">[Linear Navigation]</span>}
            </p>
          </div>
        </div>

        {/* Center: Server Countdown Timer & Autosave */}
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-mono font-bold text-sm sm:text-base shadow-sm ${
              remainingSeconds < 300
                ? 'bg-red-950/60 border-red-500/50 text-red-400 animate-pulse'
                : 'bg-slate-800/90 border-white/10 text-amber-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{formatTime(remainingSeconds)}</span>
          </div>

          {/* Autosave Status Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            {savingStatus === 'saving' && (
              <span className="text-amber-400 flex items-center gap-1">
                <RotateCw className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
              </span>
            )}
            {savingStatus === 'saved' && (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Tersimpan
              </span>
            )}
            {savingStatus === 'error' && (
              <span className="text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Belum tersimpan
              </span>
            )}
          </div>

          {/* Connection Indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            {isOnline ? (
              <span className="text-emerald-400 flex items-center gap-1" title="Online">
                <Wifi className="w-4 h-4" />
              </span>
            ) : (
              <span className="text-red-400 flex items-center gap-1 animate-pulse" title="Terputus">
                <WifiOff className="w-4 h-4" />
              </span>
            )}
          </div>

          {/* Violation Count Badge */}
          {tabViolations > 0 && (
            <div className="hidden md:flex items-center gap-1 px-2.5 py-1 bg-red-950/40 border border-red-500/30 rounded-lg text-red-400 text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{tabViolations} Peringatan</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Examination Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Question Content Column (3 Cols) */}
        <div className="lg:col-span-3 bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
          {currentQuestion ? (
            <div className="space-y-6">
              {/* Question Meta Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-indigo-300">
                    Soal No. {currentIndex + 1} dari {questions.length}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-800 rounded text-slate-300">
                    Tipe: {currentQuestion.type || 'PILIHAN_GANDA'}
                  </span>
                </div>
                <span className="px-2 py-0.5 bg-slate-800 rounded text-slate-300">
                  Bobot: {currentQuestion.points || currentQuestion.weight || 1}
                </span>
              </div>

              {/* Question Media Rendering */}
              {currentQuestion.mediaUrl && (
                <div className="my-3">
                  {currentQuestion.mediaType === 'IMAGE' || currentQuestion.mediaType?.includes('IMAGE') ? (
                    <img
                      src={currentQuestion.mediaUrl}
                      alt="Gambar Soal"
                      className="max-h-80 max-w-full rounded-xl border border-white/10 object-contain mx-auto shadow-md"
                    />
                  ) : currentQuestion.mediaType === 'AUDIO' || currentQuestion.mediaType?.includes('AUDIO') ? (
                    <audio controls className="w-full max-w-md mx-auto my-2">
                      <source src={currentQuestion.mediaUrl} />
                      Browser Anda tidak mendukung pemutar audio.
                    </audio>
                  ) : currentQuestion.mediaType === 'VIDEO' || currentQuestion.mediaType?.includes('VIDEO') ? (
                    <video controls className="max-h-80 max-w-full rounded-xl border border-white/10 mx-auto shadow-md">
                      <source src={currentQuestion.mediaUrl} />
                      Browser Anda tidak mendukung video.
                    </video>
                  ) : null}
                </div>
              )}

              {/* Question Text */}
              <div className="text-base sm:text-lg text-slate-100 font-medium leading-relaxed whitespace-pre-wrap">
                {currentQuestion.questionText || currentQuestion.question_text || 'Konten soal ujian'}
              </div>

              {/* RENDER QUESTION TYPES */}

              {/* 1. Multiple Choice (PILIHAN_GANDA) */}
              {(currentQuestion.type === 'PILIHAN_GANDA' || !currentQuestion.type) && (
                <div className="space-y-3 pt-2">
                  {(currentQuestion.options || currentQuestion.options_json || []).map((opt: any, optIdx: number) => {
                    const optId = opt.id || `opt_${optIdx + 1}`;
                    const optLabel = opt.label || String.fromCharCode(65 + optIdx);
                    const optText = typeof opt === 'string' ? opt : opt.text || opt.label;
                    const isSelected = currentAnswer?.value === optId;

                    return (
                      <button
                        key={optId}
                        onClick={() => handleSaveAnswer(currentQuestion.id, optId, currentAnswer?.isDoubtful)}
                        className={`w-full p-4 rounded-xl text-left border flex items-start gap-3 transition-all duration-150 ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-white font-semibold ring-1 ring-indigo-500'
                            : 'bg-slate-800/40 hover:bg-slate-800/80 border-white/5 text-slate-300'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 border ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-400'
                              : 'bg-slate-800 text-slate-400 border-white/10'
                          }`}
                        >
                          {optLabel}
                        </span>
                        <span className="text-sm leading-relaxed pt-0.5">{optText}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 2. Complex Multiple Choice (PG_KOMPLEKS) */}
              {currentQuestion.type === 'PG_KOMPLEKS' && (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-indigo-300 font-semibold mb-2">
                    * Pilih satu atau lebih jawaban yang benar.
                  </p>
                  {(currentQuestion.options || currentQuestion.options_json || []).map((opt: any, optIdx: number) => {
                    const optId = opt.id || `opt_${optIdx + 1}`;
                    const optLabel = opt.label || String.fromCharCode(65 + optIdx);
                    const optText = typeof opt === 'string' ? opt : opt.text || opt.label;
                    const selectedList: string[] = Array.isArray(currentAnswer?.value) ? currentAnswer.value : [];
                    const isSelected = selectedList.includes(optId);

                    const toggleComplexSelect = () => {
                      const updated = isSelected
                        ? selectedList.filter((id) => id !== optId)
                        : [...selectedList, optId];
                      handleSaveAnswer(currentQuestion.id, updated, currentAnswer?.isDoubtful);
                    };

                    return (
                      <button
                        key={optId}
                        onClick={toggleComplexSelect}
                        className={`w-full p-4 rounded-xl text-left border flex items-start gap-3 transition-all duration-150 ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-white font-semibold ring-1 ring-indigo-500'
                            : 'bg-slate-800/40 hover:bg-slate-800/80 border-white/5 text-slate-300'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0 mt-0.5 border ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-400'
                              : 'bg-slate-800 border-white/20'
                          }`}
                        >
                          {isSelected ? '✓' : ''}
                        </div>
                        <span className="text-xs font-bold text-slate-400 pt-0.5">{optLabel}.</span>
                        <span className="text-sm leading-relaxed pt-0.5">{optText}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 3. True / False (BENAR_SALAH) */}
              {currentQuestion.type === 'BENAR_SALAH' && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  {[
                    { id: 'opt_true', label: 'Benar', color: 'emerald' },
                    { id: 'opt_false', label: 'Salah', color: 'red' },
                  ].map((choice) => {
                    const isSelected = currentAnswer?.value === choice.id || (choice.id === 'opt_true' && currentAnswer?.value === true) || (choice.id === 'opt_false' && currentAnswer?.value === false);

                    return (
                      <button
                        key={choice.id}
                        onClick={() => handleSaveAnswer(currentQuestion.id, choice.id, currentAnswer?.isDoubtful)}
                        className={`p-6 rounded-2xl border text-center font-bold text-lg transition-all duration-150 flex flex-col items-center justify-center gap-2 ${
                          isSelected
                            ? choice.id === 'opt_true'
                              ? 'bg-emerald-600/30 border-emerald-500 text-white ring-2 ring-emerald-500'
                              : 'bg-red-600/30 border-red-500 text-white ring-2 ring-red-500'
                            : 'bg-slate-800/40 hover:bg-slate-800/80 border-white/10 text-slate-300'
                        }`}
                      >
                        <span>{choice.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 4. Matching (MENJODOHKAN) */}
              {currentQuestion.type === 'MENJODOHKAN' && (
                <div className="space-y-4 pt-2">
                  <p className="text-xs text-indigo-300 font-semibold mb-2">
                    * Pasangkan butir pernyataan di kolom kiri dengan pilihan yang sesuai di kolom kanan.
                  </p>
                  {(() => {
                    const matching = currentQuestion.matchingItems || { leftItems: [], rightItems: [] };
                    const currentPairs: Record<string, string> =
                      typeof currentAnswer?.value === 'object' && currentAnswer?.value !== null
                        ? currentAnswer.value
                        : {};

                    return (
                      <div className="space-y-3">
                        {matching.leftItems.map((leftItem: any) => {
                          const pairedRightId = currentPairs[leftItem.id] || '';

                          return (
                            <div
                              key={leftItem.id}
                              className="p-3 bg-slate-800/60 border border-white/5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                            >
                              <div className="text-sm font-medium text-slate-200 sm:w-1/2">
                                {leftItem.text}
                              </div>
                              <div className="w-full sm:w-1/2">
                                <select
                                  value={pairedRightId}
                                  onChange={(e) => {
                                    const updated = {
                                      ...currentPairs,
                                      [leftItem.id]: e.target.value,
                                    };
                                    handleSaveAnswer(currentQuestion.id, updated, currentAnswer?.isDoubtful);
                                  }}
                                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                  <option value="">-- Pilih Pasangan --</option>
                                  {matching.rightItems.map((rightItem: any) => (
                                    <option key={rightItem.id} value={rightItem.id}>
                                      {rightItem.text}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 5. Short Answer (ISIAN_SINGKAT) */}
              {currentQuestion.type === 'ISIAN_SINGKAT' && (
                <div className="space-y-3 pt-2">
                  <label className="text-xs text-slate-400 block font-medium">Tuliskan jawaban singkat Anda:</label>
                  <input
                    type="text"
                    maxLength={500}
                    defaultValue={currentAnswer?.value || ''}
                    key={currentQuestion.id}
                    onBlur={(e) => {
                      handleSaveAnswer(currentQuestion.id, e.target.value, currentAnswer?.isDoubtful);
                    }}
                    placeholder="Ketik jawaban di sini..."
                    className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-slate-500">Maksimum 500 karakter. Disimpan saat kursor berpindah.</p>
                </div>
              )}

              {/* 6. Essay (ESSAY) */}
              {currentQuestion.type === 'ESSAY' && (
                <div className="space-y-3 pt-2">
                  <label className="text-xs text-slate-400 block font-medium">Tuliskan uraian / jawaban essay Anda:</label>
                  <textarea
                    rows={8}
                    maxLength={10000}
                    defaultValue={currentAnswer?.value || ''}
                    key={currentQuestion.id}
                    onChange={(e) => {
                      const text = e.target.value;
                      // Debounce autosave essay agar tidak spam ke server setiap ketukan keyboard
                      if (essayDebounceTimerRef.current[currentQuestion.id]) {
                        clearTimeout(essayDebounceTimerRef.current[currentQuestion.id]);
                      }
                      essayDebounceTimerRef.current[currentQuestion.id] = setTimeout(() => {
                        handleSaveAnswer(currentQuestion.id, text, currentAnswer?.isDoubtful);
                      }, 1000);
                    }}
                    onBlur={(e) => {
                      handleSaveAnswer(currentQuestion.id, e.target.value, currentAnswer?.isDoubtful);
                    }}
                    placeholder="Ketik jawaban uraian lengkap di sini..."
                    className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Maksimum 10.000 karakter.</span>
                    <span>Tersimpan otomatis saat berhenti mengetik.</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">
              Belum ada butir soal pada paket ujian ini.
            </div>
          )}

          {/* Navigation & Controls Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <button
                disabled={currentIndex <= 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </button>

              {/* Mark for Review Button */}
              {currentQuestion && (
                <button
                  onClick={() => handleToggleMark(currentQuestion.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                    currentAnswer?.isDoubtful
                      ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-amber-300 border-amber-500/30'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{currentAnswer?.isDoubtful ? 'Ditandai Ragu' : 'Tandai Ragu-ragu'}</span>
                </button>
              )}

              {/* Clear Answer Button */}
              {currentQuestion && currentAnswer?.value !== null && currentAnswer?.value !== undefined && currentAnswer?.value !== '' && (
                <button
                  onClick={() => handleClearAnswer(currentQuestion.id)}
                  className="px-3 py-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-red-400 border border-white/5 rounded-xl text-xs flex items-center gap-1 transition-all"
                  title="Hapus jawaban untuk soal ini"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Hapus Jawaban</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {currentIndex < questions.length - 1 ? (
                <button
                  disabled={!canNavigateToIndex(currentIndex + 1)}
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitModal(true)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"
                >
                  <Send className="w-4 h-4" />
                  <span>Selesai & Kumpulkan</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Question Palette Sidebar (1 Col) */}
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Daftar Nomor Soal
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                {answeredCount}/{totalQuestions}
              </span>
            </div>

            {/* Color Legend */}
            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 mb-3 pb-3 border-b border-white/5">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-600 inline-block" />
                <span>Dijawab ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-600 inline-block" />
                <span>Ragu-ragu ({markedCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-800 border border-white/10 inline-block" />
                <span>Belum ({unansweredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded ring-2 ring-indigo-400 bg-slate-800 inline-block" />
                <span>Saat Ini</span>
              </div>
            </div>

            {/* Question Buttons Grid */}
            <div className="grid grid-cols-5 gap-2 max-h-[340px] overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const ans = answers[q.id];
                const isCurrent = idx === currentIndex;
                const hasValue = ans && ans.value !== undefined && ans.value !== null && ans.value !== '' && (!Array.isArray(ans.value) || ans.value.length > 0);
                const isDoubtful = ans?.isDoubtful;
                const isAllowed = canNavigateToIndex(idx);

                let btnClass = 'bg-slate-800 text-slate-300 border-white/5 hover:bg-slate-700';
                if (hasValue) {
                  btnClass = isDoubtful
                    ? 'bg-amber-600 text-white border-amber-400'
                    : 'bg-emerald-600 text-white border-emerald-400';
                } else if (isDoubtful) {
                  btnClass = 'bg-amber-900/60 text-amber-300 border-amber-500/50';
                }

                if (isCurrent) {
                  btnClass += ' ring-2 ring-indigo-400 font-extrabold';
                }

                if (!isAllowed) {
                  btnClass += ' opacity-30 cursor-not-allowed';
                }

                return (
                  <button
                    key={q.id || idx}
                    disabled={!isAllowed}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-lg font-mono text-xs font-semibold flex items-center justify-center border transition-all ${btnClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Final Submit Trigger */}
          <div className="pt-4 border-t border-white/10">
            <button
              onClick={() => setShowSubmitModal(true)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <Send className="w-4 h-4" />
              <span>Kumpulkan Jawaban</span>
            </button>
          </div>
        </div>
      </main>

      {/* Submit Review & Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Konfirmasi Pengumpulan Ujian</h3>
                <p className="text-xs text-slate-400">Periksa ringkasan pengerjaan lembar ujian Anda.</p>
              </div>
            </div>

            {/* Statistics Breakdown */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-800/60 rounded-xl border border-white/5">
                <span className="text-slate-400 block mb-1">Total Soal</span>
                <span className="text-lg font-bold text-white font-mono">{totalQuestions}</span>
              </div>
              <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/20">
                <span className="text-emerald-400 block mb-1">Sudah Dijawab</span>
                <span className="text-lg font-bold text-emerald-300 font-mono">{answeredCount}</span>
              </div>
              <div className="p-3 bg-red-950/40 rounded-xl border border-red-500/20">
                <span className="text-red-400 block mb-1">Belum Dijawab</span>
                <span className="text-lg font-bold text-red-300 font-mono">{unansweredCount}</span>
              </div>
              <div className="p-3 bg-amber-950/40 rounded-xl border border-amber-500/20">
                <span className="text-amber-400 block mb-1">Ditandai Ragu</span>
                <span className="text-lg font-bold text-amber-300 font-mono">{markedCount}</span>
              </div>
            </div>

            {/* Unanswered Warning */}
            {unansweredCount > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                <span>
                  Masih ada <strong>{unansweredCount}</strong> butir soal yang belum Anda jawab. Jawaban yang belum diisi akan dinilai kosong.
                </span>
              </div>
            )}

            <p className="text-xs text-slate-400">
              Setelah dikumpulkan, lembar ujian akan <strong>dikunci</strong> dan Anda tidak dapat mengubah jawaban lagi.
            </p>

            {/* Modal Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                disabled={isSubmitting}
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-all"
              >
                Kembali Mengerjakan
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleSubmitExam}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Mengirimkan...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Ya, Kumpulkan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
