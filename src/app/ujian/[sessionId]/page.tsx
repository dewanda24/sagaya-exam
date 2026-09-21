'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Flag,
  Send,
  Wifi,
  WifiOff,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
  HardDrive,
  RefreshCw,
  Shield,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';
import { QuestionBankItem } from '@/lib/core/types';
import MathRenderer from '@/components/common/MathRenderer';

export default function ExamTakingPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const BUFFER_KEY = `sagaya_cbt_buffer_${sessionId}`;
  const PENDING_QUEUE_KEY = `sagaya_cbt_pending_${sessionId}`;

  // Session & Exam State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionData, setSessionData] = useState<any>(null);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Answers state: { [questionId]: { value: any, isDoubtful: boolean } }
  const [answers, setAnswers] = useState<{ [qId: string]: { value: any; isDoubtful: boolean } }>({});
  const [saveStatus, setSaveStatus] = useState<'SAVED' | 'SAVING' | 'OFFLINE_SAVED' | 'ERROR'>('SAVED');
  const [isOnline, setIsOnline] = useState(true);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Timer state (in seconds)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Tab violation tracking
  const [tabViolations, setTabViolations] = useState(0);
  const [showViolationModal, setShowViolationModal] = useState(false);

  // Submission confirmation modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmAgreement, setConfirmAgreement] = useState(false);

  // Mobile Question Palette Drawer
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [broadcastAlert, setBroadcastAlert] = useState<string | null>(null);
  const [timeExtensionToast, setTimeExtensionToast] = useState<string | null>(null);
  const [isForcedSubmitted, setIsForcedSubmitted] = useState(false);

  // Close mobile palette on Escape key
  useEffect(() => {
    if (!mobilePaletteOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobilePaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobilePaletteOpen]);

  // Auto-save debounce timer
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Flush pending offline answers to server
  const flushPendingQueue = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(PENDING_QUEUE_KEY);
      if (!raw) {
        setPendingQueueCount(0);
        return;
      }
      const queue: Array<{ questionId: string; value: any; isDoubtful: boolean; timestamp: number }> = JSON.parse(raw);
      if (!Array.isArray(queue) || queue.length === 0) {
        setPendingQueueCount(0);
        return;
      }

      setIsSyncing(true);
      const remaining: typeof queue = [];

      for (const item of queue) {
        try {
          const res = await fetch(`/api/student/session/${sessionId}/autosave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionId: item.questionId,
              answerValue: item.value,
              isDoubtful: item.isDoubtful,
            }),
          });
          const json = await res.json();
          if (!res.ok || !json.success) {
            remaining.push(item);
          }
        } catch {
          remaining.push(item);
        }
      }

      if (remaining.length === 0) {
        localStorage.removeItem(PENDING_QUEUE_KEY);
        setPendingQueueCount(0);
        setSaveStatus('SAVED');
        setIsOnline(true);
      } else {
        localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(remaining));
        setPendingQueueCount(remaining.length);
        setSaveStatus('OFFLINE_SAVED');
      }
    } catch {
      // Ignore storage errors
    } finally {
      setIsSyncing(false);
    }
  }, [sessionId, PENDING_QUEUE_KEY]);

  // 1. Initial Data Fetch & Offline Storage Hydration
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch(`/api/student/session/${sessionId}`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          setError(json.error || 'Gagal memuat sesi ujian.');
          setLoading(false);
          return;
        }

        const data = json.data;
        if (data.session.status === 'SUBMITTED') {
          router.replace(`/ujian/${sessionId}/selesai`);
          return;
        }

        setSessionData(data);
        setQuestions(data.questions || []);
        setCurrentIndex(data.session.currentQuestionIndex || 0);

        // Merge server answers with LocalStorage buffer if local has more recent entries
        const serverAnswers = data.answers || {};
        let mergedAnswers = { ...serverAnswers };

        try {
          const rawBuf = localStorage.getItem(BUFFER_KEY);
          if (rawBuf) {
            const localBuf = JSON.parse(rawBuf);
            mergedAnswers = { ...serverAnswers, ...localBuf };
          }
        } catch {}

        setAnswers(mergedAnswers);
        setRemainingSeconds(data.session.remainingSeconds || 0);
        setTabViolations(data.session.tabViolationCount || 0);

        // Check if there are pending offline items from prior disconnection
        try {
          const rawPending = localStorage.getItem(PENDING_QUEUE_KEY);
          if (rawPending) {
            const pArr = JSON.parse(rawPending);
            if (Array.isArray(pArr) && pArr.length > 0) {
              setPendingQueueCount(pArr.length);
              setSaveStatus('OFFLINE_SAVED');
              flushPendingQueue();
            }
          }
        } catch {}

        setLoading(false);
      } catch (err: any) {
        setError('Gagal menghubungkan ke server CBT.');
        setLoading(false);
      }
    }

    if (sessionId) {
      loadSession();
    }
  }, [sessionId, router, BUFFER_KEY, PENDING_QUEUE_KEY, flushPendingQueue]);

  // 2. Client Countdown Timer & Server Expiry
  useEffect(() => {
    if (loading || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmitTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, remainingSeconds]);

  // Format Timer HH:MM:SS
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // 3. Heartbeat (Every 7 seconds) & Auto-Sync Trigger
  useEffect(() => {
    if (loading || !sessionId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/student/session/${sessionId}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentQuestionIndex: currentIndex,
            tabViolations: 0,
          }),
        });
        const json = await res.json();

        if (json.success && json.data) {
          setIsOnline(true);

          // 1. Proctor Force Submit Detection
          if (json.data.status === 'SUBMITTED') {
            setIsForcedSubmitted(true);
            try {
              localStorage.removeItem(BUFFER_KEY);
              localStorage.removeItem(PENDING_QUEUE_KEY);
            } catch {}
            setTimeout(() => {
              router.replace(`/ujian/${sessionId}/selesai`);
            }, 3000);
            return;
          }

          // 2. Proctor Added Time Detection (diff >= 45s)
          if (json.data.remainingSeconds - remainingSeconds >= 45) {
            const addedMins = Math.round((json.data.remainingSeconds - remainingSeconds) / 60);
            setTimeExtensionToast(`Pengawas telah menambahkan waktu ujian Anda (+${addedMins} menit).`);
            setTimeout(() => setTimeExtensionToast(null), 8000);
          }

          // 3. Sync server remaining seconds if difference is > 3 seconds
          if (Math.abs(json.data.remainingSeconds - remainingSeconds) > 3) {
            setRemainingSeconds(json.data.remainingSeconds);
          }

          if (json.data.isExpired || json.data.status === 'EXPIRED') {
            handleAutoSubmitTimeExpired();
          }

          if (json.data.broadcastMessage) {
            setBroadcastAlert(json.data.broadcastMessage);
          }

          // If there are pending offline answers, trigger auto-sync
          if (pendingQueueCount > 0 && !isSyncing) {
            flushPendingQueue();
          }
        }
      } catch (err) {
        setIsOnline(false);
      }
    }, 7000);

    return () => clearInterval(interval);
  }, [loading, sessionId, currentIndex, remainingSeconds, pendingQueueCount, isSyncing, flushPendingQueue]);

  // 4. Online/Offline Network Listeners
  useEffect(() => {
    const handleOnlineEvent = () => {
      setIsOnline(true);
      flushPendingQueue();
    };

    const handleOfflineEvent = () => {
      setIsOnline(false);
      setSaveStatus('OFFLINE_SAVED');
    };

    window.addEventListener('online', handleOnlineEvent);
    window.addEventListener('offline', handleOfflineEvent);

    return () => {
      window.removeEventListener('online', handleOnlineEvent);
      window.removeEventListener('offline', handleOfflineEvent);
    };
  }, [flushPendingQueue]);

  // 5. Anti-Cheat: Visibility Change, Blur, ContextMenu, and Shortcut Locks
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setTabViolations((prev) => {
          const updated = prev + 1;
          setShowViolationModal(true);
          fetch(`/api/student/session/${sessionId}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentQuestionIndex: currentIndex, tabViolations: 1 }),
          }).catch(() => {});
          return updated;
        });
      }
    };

    const handleWindowBlur = () => {
      // Optional extra check when window loses focus
    };

    // Block right-click context menu
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Block dangerous shortcuts (DevTools, View Source, Print, SelectAll/Copy outside input)
    const preventShortcuts = (e: KeyboardEvent) => {
      // Block F12 (DevTools), F11
      if (e.key === 'F12' || e.keyCode === 123 || e.key === 'F11' || e.keyCode === 122) {
        e.preventDefault();
        return false;
      }
      // Block Ctrl+Shift+I / J / C (DevTools inspector)
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'i', 'j', 'c'].includes(e.key)) {
        e.preventDefault();
        return false;
      }
      // Block Ctrl+U (view source), Ctrl+S (save), Ctrl+P (print)
      if (e.ctrlKey && ['u', 'U', 's', 'S', 'p', 'P'].includes(e.key)) {
        e.preventDefault();
        return false;
      }
      // Prevent copy/cut questions text
      if (e.ctrlKey && ['c', 'C', 'x', 'X'].includes(e.key)) {
        const target = e.target as HTMLElement;
        if (target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          return false;
        }
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return 'Sesi ujian sedang berlangsung. Yakin ingin meninggalkan halaman ini?';
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('keydown', preventShortcuts);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventShortcuts);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionId, currentIndex]);

  // 6. Auto-Save Handler with LocalStorage Buffer & Network Fallback
  const triggerAutoSave = useCallback(
    async (qId: string, value: any, isDoubtful: boolean) => {
      // Step 1: Immediately persist to local device buffer
      try {
        const rawBuf = localStorage.getItem(BUFFER_KEY);
        const buf = rawBuf ? JSON.parse(rawBuf) : {};
        buf[qId] = { value, isDoubtful, timestamp: Date.now() };
        localStorage.setItem(BUFFER_KEY, JSON.stringify(buf));

        // Queue for server sync
        const rawPending = localStorage.getItem(PENDING_QUEUE_KEY);
        let pendingArr: any[] = rawPending ? JSON.parse(rawPending) : [];
        pendingArr = pendingArr.filter((item: any) => item.questionId !== qId);
        pendingArr.push({ questionId: qId, value, isDoubtful, timestamp: Date.now() });
        localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(pendingArr));
        setPendingQueueCount(pendingArr.length);
      } catch {}

      setSaveStatus('SAVING');

      // Step 2: Attempt network autosave to server
      try {
        const res = await fetch(`/api/student/session/${sessionId}/autosave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId: qId, answerValue: value, isDoubtful }),
        });
        const json = await res.json();

        if (res.ok && json.success) {
          // Successfully stored on server -> remove from pending sync queue
          try {
            const rawPending = localStorage.getItem(PENDING_QUEUE_KEY);
            let pendingArr: any[] = rawPending ? JSON.parse(rawPending) : [];
            pendingArr = pendingArr.filter((item: any) => item.questionId !== qId);
            if (pendingArr.length === 0) {
              localStorage.removeItem(PENDING_QUEUE_KEY);
            } else {
              localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(pendingArr));
            }
            setPendingQueueCount(pendingArr.length);
          } catch {}

          setSaveStatus('SAVED');
          setIsOnline(true);
        } else {
          setSaveStatus('OFFLINE_SAVED');
        }
      } catch (err) {
        setSaveStatus('OFFLINE_SAVED');
        setIsOnline(false);
      }
    },
    [sessionId, BUFFER_KEY, PENDING_QUEUE_KEY]
  );

  // Update Answer function
  const setAnswerForCurrent = (value: any) => {
    const q = questions[currentIndex];
    if (!q) return;

    const currentDoubtful = answers[q.id]?.isDoubtful || false;
    const newAnswers = {
      ...answers,
      [q.id]: { value, isDoubtful: currentDoubtful },
    };
    setAnswers(newAnswers);

    // Debounce auto-save
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      triggerAutoSave(q.id, value, currentDoubtful);
    }, 400);
  };

  // Toggle Doubtful flag
  const toggleDoubtfulForCurrent = () => {
    const q = questions[currentIndex];
    if (!q) return;

    const currentVal = answers[q.id]?.value;
    const newDoubtful = !answers[q.id]?.isDoubtful;

    setAnswers({
      ...answers,
      [q.id]: { value: currentVal, isDoubtful: newDoubtful },
    });

    triggerAutoSave(q.id, currentVal, newDoubtful);
  };

  // 7. Submit Exam Handlers
  const handleAutoSubmitTimeExpired = async () => {
    try {
      await flushPendingQueue();
      await fetch(`/api/student/session/${sessionId}/submit`, { method: 'POST' });
      router.replace(`/ujian/${sessionId}/selesai`);
    } catch {
      router.replace(`/ujian/${sessionId}/selesai`);
    }
  };

  const handleManualSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Flush pending offline answers before final submit
      await flushPendingQueue();

      const res = await fetch(`/api/student/session/${sessionId}/submit`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        // Clear local storage cache on successful submission
        try {
          localStorage.removeItem(BUFFER_KEY);
          localStorage.removeItem(PENDING_QUEUE_KEY);
        } catch {}
        router.replace(`/ujian/${sessionId}/selesai`);
      } else {
        alert(json.error || 'Gagal menyerahkan ujian.');
        setIsSubmitting(false);
      }
    } catch {
      alert('Gagal menghubungi server. Pastikan komputer terhubung ke jaringan lab sebelum mengumpulkan ujian.');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="pulse-indicator" style={{ width: '24px', height: '24px', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Memuat Ruang Ujian CBT...</h2>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Sinkronisasi waktu server dan snapshot soal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div className="card" style={{ padding: '2rem', maxWidth: '450px', textAlign: 'center' }}>
          <AlertCircle size={40} color="#dc2626" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Kendala Sesi Ujian</h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem' }}>{error}</p>
          <button type="button" onClick={() => router.push('/ujian')} className="btn btn-primary" style={{ width: '100%' }}>
            Kembali ke Ruang Masuk
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const currentAnswer = answers[currentQ?.id]?.value;
  const isCurrentDoubtful = !!answers[currentQ?.id]?.isDoubtful;

  // Question stats for palette & submit modal
  const answeredCount = Object.values(answers).filter(
    (a) => a.value !== undefined && a.value !== null && a.value !== ''
  ).length;
  const doubtfulCount = Object.values(answers).filter((a) => a.isDoubtful).length;
  const unansweredCount = questions.length - answeredCount;

  // Timer urgency class
  let timerClass = 'cbt-timer-badge';
  if (remainingSeconds < 300) {
    timerClass += ' cbt-timer-danger';
  } else if (remainingSeconds < 600) {
    timerClass += ' cbt-timer-warning';
  }

  return (
    <div className="cbt-container">
      {/* Sticky Topbar */}
      <header className="cbt-topbar">
        <div className="cbt-candidate-info">
          <div className="cbt-avatar-pill">
            {sessionData?.participant.studentName?.charAt(0) || 'S'}
          </div>
          <div className="cbt-candidate-text">
            <h3>{sessionData?.participant.studentName}</h3>
            <p>
              <span>{sessionData?.participant.nisn}</span> &bull;
              <span>{sessionData?.exam.subject}</span> &bull;
              <span>Paket {sessionData?.participant.assignedPackage}</span>
            </p>
          </div>
        </div>

        {/* Center: Server Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className={timerClass} title="Waktu tersisa berdasarkan jam server">
            <Clock size={20} />
            <span>{formatTime(remainingSeconds)}</span>
          </div>

          {/* Auto-save Status Pill */}
          <div className="cbt-autosave-pill">
            {saveStatus === 'SAVED' && (
              <>
                <CheckCircle2 size={15} color="#059669" />
                <span>Tersimpan di Server</span>
              </>
            )}
            {saveStatus === 'SAVING' && (
              <>
                <div className="pulse-indicator" style={{ width: '8px', height: '8px', background: '#3b82f6' }} />
                <span>Menyimpan...</span>
              </>
            )}
            {saveStatus === 'OFFLINE_SAVED' && (
              <>
                <HardDrive size={15} color="#d97706" />
                <span>Aman di Komputer ({pendingQueueCount})</span>
              </>
            )}
            {saveStatus === 'ERROR' && (
              <>
                <AlertCircle size={15} color="#dc2626" />
                <span>Offline (Buffer Aktif)</span>
              </>
            )}
          </div>
        </div>

        {/* Right: Network & Finish Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: isOnline ? '#059669' : '#dc2626' }}
            title={isOnline ? 'Terhubung ke server' : 'Koneksi offline (Buffer lokal aktif)'}
          >
            {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span className="hidden-mobile">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          <button
            type="button"
            onClick={() => setMobilePaletteOpen(true)}
            className="cbt-mobile-palette-toggle"
            aria-haspopup="dialog"
            aria-expanded={mobilePaletteOpen}
            aria-controls="cbt-palette-drawer"
            aria-label="Buka Lembar Butir Soal"
            title="Buka Lembar Butir Soal"
          >
            <span>📋 Soal {currentIndex + 1}/{questions.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="btn btn-danger"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8125rem' }}
          >
            <Send size={15} />
            <span className="hidden-mobile">Selesai Ujian</span>
            <span className="lg:hidden">Selesai</span>
          </button>
        </div>
      </header>

      {/* Offline Alert Banner */}
      {(!isOnline || pendingQueueCount > 0) && (
        <div
          style={{
            background: '#fff7ed',
            borderBottom: '2px solid #ea580c',
            padding: '0.65rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#9a3412',
            fontSize: '0.825rem',
            fontWeight: 600,
            animation: 'fadeIn 0.3s ease-in-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <HardDrive size={18} color="#ea580c" />
            <span>
              <strong>Koneksi Lab Terputus — Jawaban Anda Tetap AMAN:</strong>{' '}
              {pendingQueueCount > 0
                ? `${pendingQueueCount} jawaban tersimpan di memori komputer ini dan siap dikirim otomatis saat jaringan lab pulih kembali.`
                : 'Penyimpanan lokal aktif. Anda dapat terus mengerjakan soal dengan tenang.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => flushPendingQueue()}
            disabled={isSyncing}
            style={{
              background: '#ea580c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.25rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <RefreshCw size={12} className={isSyncing ? 'spin' : ''} />
            <span>{isSyncing ? 'Sinkronisasi...' : 'Kirim Ulang'}</span>
          </button>
        </div>
      )}

      {/* Broadcast Flash Announcement from Proctor */}
      {broadcastAlert && (
        <div
          style={{
            background: '#fffbeb',
            borderBottom: '2px solid #f59e0b',
            padding: '0.65rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#92400e',
            fontSize: '0.85rem',
            fontWeight: 700,
            animation: 'fadeIn 0.3s ease-in-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertTriangle size={18} color="#d97706" />
            <span>
              <strong>PENGUMUMAN PENGAWAS:</strong> {broadcastAlert}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setBroadcastAlert(null)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              color: '#b45309',
              fontSize: '1.2rem',
              lineHeight: 1,
            }}
            title="Tutup Pengumuman"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Grid: Workspace & Question Palette */}
      <main className="cbt-main-grid">
        {/* Left/Center: Question Workspace */}
        <div className="cbt-question-card">
          <div className="cbt-question-header">
            <div className="cbt-q-number">
              <span>Soal Nomor {currentIndex + 1}</span>
              <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                {currentQ?.type.replace('_', ' ')}
              </span>
              <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                Bobot: {currentQ?.weight} Poin
              </span>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Topik: <strong>{currentQ?.topic}</strong>
            </div>
          </div>

          {/* Shared Stimulus Wacana / Teks Cerita Rujukan (Standar ANBK) */}
          {(currentQ?.stimulusTitle || currentQ?.stimulusText) && (
            <div
              style={{
                marginBottom: '1.5rem',
                padding: '1.25rem',
                background: '#fefce8',
                border: '1.5px solid #fde047',
                borderRadius: '12px',
                color: '#713f12',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #fef08a',
                  paddingBottom: '0.5rem',
                  marginBottom: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.95rem' }}>
                  <BookOpen size={18} color="#ca8a04" />
                  <span>{currentQ.stimulusTitle || 'Wacana / Teks Cerita Rujukan'}</span>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#fef08a', padding: '0.2rem 0.6rem', borderRadius: '999px', color: '#854d0e' }}>
                  Wacana Soal
                </span>
              </div>

              {currentQ.stimulusText && (
                <div style={{ fontSize: '0.9rem', lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-line', background: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #fef9c3' }}>
                  <MathRenderer text={currentQ.stimulusText} />
                </div>
              )}

              {currentQ.stimulusMediaUrl && (
                <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                  <img
                    src={currentQ.stimulusMediaUrl}
                    alt="Infografis Wacana"
                    style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '8px', border: '1px solid #fef08a', objectFit: 'contain' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Question Text & Media */}
          <div className="cbt-question-body">
            <div style={{ fontSize: '1rem', lineHeight: 1.6, fontWeight: 500, color: '#0f172a' }}>
              <MathRenderer text={currentQ?.questionText || ''} />
            </div>
            {currentQ?.mediaUrl && (
              <div style={{ marginTop: '1rem' }}>
                <img
                  src={currentQ.mediaUrl}
                  alt="Ilustrasi Soal"
                  style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
              </div>
            )}
          </div>

          {/* Answer Input depending on Question Type */}
          <div style={{ marginBottom: '2rem' }}>
            {/* 1. PILIHAN GANDA (Single Choice) */}
            {currentQ?.type === 'PILIHAN_GANDA' && (
              <div
                role="radiogroup"
                aria-label="Pilihan Jawaban"
                className="cbt-options-list"
              >
                {currentQ.options?.map((opt) => {
                  const isSelected = currentAnswer === opt.id;
                  return (
                    <div
                      key={opt.id}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onClick={() => setAnswerForCurrent(opt.id)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          setAnswerForCurrent(opt.id);
                        }
                      }}
                      className={`cbt-option-item ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="cbt-option-letter">{opt.id}</div>
                      <div className="cbt-option-text">
                        <MathRenderer text={opt.text} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. PG KOMPLEKS (Multiple Choice Checkbox) */}
            {currentQ?.type === 'PG_KOMPLEKS' && (
              <div>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.75rem' }}>
                  * Pilih satu atau lebih jawaban yang menurut Anda benar.
                </p>
                <div
                  role="group"
                  aria-label="Pilihan Jawaban Majemuk"
                  className="cbt-options-list"
                >
                  {currentQ.options?.map((opt) => {
                    const currentArray: string[] = Array.isArray(currentAnswer) ? currentAnswer : [];
                    const isSelected = currentArray.includes(opt.id);

                    const toggleOption = () => {
                      let updated = isSelected
                        ? currentArray.filter((id) => id !== opt.id)
                        : [...currentArray, opt.id];
                      setAnswerForCurrent(updated);
                    };

                    return (
                      <div
                        key={opt.id}
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={toggleOption}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            toggleOption();
                          }
                        }}
                        className={`cbt-option-item ${isSelected ? 'selected' : ''}`}
                      >
                        <div className="cbt-option-letter">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            tabIndex={-1}
                            aria-hidden="true"
                            onChange={() => {}}
                            style={{ accentColor: '#2563eb', width: '18px', height: '18px' }}
                          />
                        </div>
                        <div className="cbt-option-text">
                          <strong>{opt.id}.</strong> {opt.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. BENAR / SALAH */}
            {(currentQ?.type === 'BENAR_SALAH' || currentQ?.type === 'TRUE_FALSE') && (
              <div style={{ display: 'flex', gap: '1.25rem', maxWidth: '400px' }}>
                <button
                  type="button"
                  onClick={() => setAnswerForCurrent('BENAR')}
                  className={`btn ${currentAnswer === 'BENAR' ? 'btn-success' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '1rem', fontSize: '1.1rem', fontWeight: 800 }}
                >
                  BENAR
                </button>
                <button
                  type="button"
                  onClick={() => setAnswerForCurrent('SALAH')}
                  className={`btn ${currentAnswer === 'SALAH' ? 'btn-danger' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '1rem', fontSize: '1.1rem', fontWeight: 800 }}
                >
                  SALAH
                </button>
              </div>
            )}

            {/* 4. MENJODOHKAN (Interactive Matching) */}
            {(currentQ?.type === 'MENJODOHKAN' || currentQ?.type === 'MATCHING') && (() => {
              const qMatching = (currentQ as any).matchingItems;
              let leftItems: Array<{ id: string; text: string }> = [];
              let rightItems: Array<{ id: string; text: string }> = [];

              if (qMatching?.leftItems && Array.isArray(qMatching.leftItems)) {
                leftItems = qMatching.leftItems;
                rightItems = qMatching.rightItems || [];
              } else if (Array.isArray(currentQ.options) && currentQ.options.length > 0) {
                leftItems = currentQ.options.map((o: any, idx: number) => ({
                  id: `left_${idx}`,
                  text: o.premise || o.text || String(o),
                }));
                rightItems = currentQ.options.map((o: any, idx: number) => ({
                  id: `right_${idx}`,
                  text: o.target || o.text || String(o),
                }));
              }

              return (
                <div className="cbt-matching-grid">
                  <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    * Pilih pasangan yang tepat pada kolom kanan untuk setiap premis di kolom kiri.
                  </p>
                  {leftItems.map((item, idx) => {
                    const currentPairValue =
                      typeof currentAnswer === 'object' && currentAnswer !== null
                        ? currentAnswer[item.text] || ''
                        : '';

                    const handleSelectTarget = (targetVal: string) => {
                      const updatedPairs = {
                        ...(typeof currentAnswer === 'object' ? currentAnswer : {}),
                        [item.text]: targetVal,
                      };
                      setAnswerForCurrent(updatedPairs);
                    };

                    return (
                      <div key={item.id || idx} className="cbt-matching-row">
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {idx + 1}. {item.text}
                        </div>
                        <div>
                          <select
                            value={currentPairValue}
                            onChange={(e) => handleSelectTarget(e.target.value)}
                            className="input-field"
                            style={{ fontSize: '0.9rem', padding: '0.6rem', width: '100%', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff' }}
                          >
                            <option value="">-- Pilih Pasangan --</option>
                            {rightItems.map((opt, optIdx) => (
                              <option key={opt.id || optIdx} value={opt.text}>
                                {opt.text}
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

            {/* 5. ISIAN SINGKAT */}
            {currentQ?.type === 'ISIAN_SINGKAT' && (
              <div style={{ maxWidth: '450px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  Tuliskan jawaban singkat Anda:
                </label>
                <input
                  type="text"
                  placeholder="Ketik jawaban di sini..."
                  value={currentAnswer || ''}
                  onChange={(e) => setAnswerForCurrent(e.target.value)}
                  className="input-field"
                  style={{ fontSize: '1.05rem', fontWeight: 600, width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid #cbd5e1' }}
                />
              </div>
            )}

            {/* 6. ESSAY */}
            {currentQ?.type === 'ESSAY' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  Tuliskan uraian / penjelasan lengkap jawaban Anda:
                </label>
                <textarea
                  rows={7}
                  placeholder="Ketik penjelasan dan langkah-langkah pengerjaan..."
                  value={currentAnswer || ''}
                  onChange={(e) => setAnswerForCurrent(e.target.value)}
                  className="input-field"
                  style={{ fontSize: '1rem', lineHeight: '1.6', resize: 'vertical', width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1.5px solid #cbd5e1' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                  <span>Karakter: {(currentAnswer || '').length} &bull; Kata: {(currentAnswer || '').trim().split(/\s+/).filter(Boolean).length}</span>
                  <span className="text-emerald-600 font-semibold">Autosave otomatis aktif</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar (Prev, Doubtful, Next) */}
          <div className="cbt-actions-bar">
            <button
              type="button"
              disabled={currentIndex === 0 || (sessionData?.exam?.navigationPolicy === 'STRICT_LINEAR')}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="btn btn-secondary"
            >
              <ChevronLeft size={18} />
              <span>Sebelumnya</span>
            </button>

            {/* Doubtful Button */}
            <button
              type="button"
              onClick={toggleDoubtfulForCurrent}
              className={`btn ${isCurrentDoubtful ? 'btn-warning' : 'btn-secondary'}`}
              style={{
                borderColor: isCurrentDoubtful ? '#f59e0b' : '#cbd5e1',
                color: isCurrentDoubtful ? '#ffffff' : '#d97706',
              }}
            >
              <Flag size={16} />
              <span>{isCurrentDoubtful ? 'Ragu-ragu (Ditandai)' : 'Tandai Ragu-ragu'}</span>
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="btn btn-primary"
              >
                <span>Berikutnya</span>
                <ChevronRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="btn btn-success"
              >
                <span>Selesai & Kumpulkan</span>
                <Send size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Right Sidebar: Question Palette (Daftar Nomor Soal) */}
        {mobilePaletteOpen && (
          <div
            className="cbt-palette-backdrop"
            onClick={() => setMobilePaletteOpen(false)}
          />
        )}
        <aside
          id="cbt-palette-drawer"
          role="region"
          aria-label="Lembar Butir Soal"
          className={`cbt-palette-card ${mobilePaletteOpen ? 'mobile-open' : ''}`}
        >
          <div className="cbt-palette-header">
            <div>
              <span>Daftar Nomor Soal</span>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                {answeredCount}/{questions.length} Terjawab
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobilePaletteOpen(false)}
              className="lg:hidden"
              aria-label="Tutup lembar butir soal"
              style={{
                background: '#f1f5f9',
                border: 'none',
                padding: '0.35rem 0.65rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Tutup ✕
            </button>
          </div>

          {/* Palette Grid */}
          <div className="cbt-palette-grid">
            {questions.map((q, idx) => {
              const ansObj = answers[q.id];
              const isAnswered = ansObj?.value !== undefined && ansObj?.value !== null && ansObj?.value !== '';
              const isDoubtful = !!ansObj?.isDoubtful;
              const isActive = idx === currentIndex;
              const isLinear = sessionData?.exam?.navigationPolicy === 'STRICT_LINEAR' || sessionData?.exam?.navigationPolicy === 'LINEAR_NAVIGATION';
              const isLocked = isLinear && idx > currentIndex;

              let btnClass = 'cbt-num-btn';
              if (isActive) btnClass += ' active';
              if (isDoubtful) {
                btnClass += ' doubtful';
              } else if (isAnswered) {
                btnClass += ' answered';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  disabled={isLocked}
                  aria-label={`Soal nomor ${idx + 1}: ${isDoubtful ? 'Ragu-ragu' : isAnswered ? 'Sudah dijawab' : 'Belum dijawab'}${isActive ? ', sedang dibuka' : ''}`}
                  onClick={() => {
                    if (!isLocked) {
                      setCurrentIndex(idx);
                      setMobilePaletteOpen(false);
                    }
                  }}
                  className={btnClass}
                  style={isLocked ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                  title={isLocked ? 'Navigasi linear aktif: selesaikan soal sebelumnya' : `Soal Nomor ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="cbt-legend">
            <div className="cbt-legend-item">
              <div className="cbt-legend-dot" style={{ background: '#10b981' }} />
              <span>Sudah Dijawab ({answeredCount})</span>
            </div>
            <div className="cbt-legend-item">
              <div className="cbt-legend-dot" style={{ background: '#f59e0b' }} />
              <span>Ragu-ragu ({doubtfulCount})</span>
            </div>
            <div className="cbt-legend-item">
              <div className="cbt-legend-dot" style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1' }} />
              <span>Belum Dijawab ({unansweredCount})</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="btn btn-danger"
            style={{ width: '100%', marginTop: 'auto', padding: '0.75rem' }}
          >
            <Send size={16} />
            <span>Kumpulkan Ujian</span>
          </button>
        </aside>
      </main>

      {/* Anti-Cheat Warning Modal (Visibility Change / Blur) */}
      {showViolationModal && (
        <div className="violation-modal-overlay">
          <div className="violation-modal-card" style={{ border: '2px solid #ef4444', maxWidth: '480px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', boxShadow: '0 0 0 8px #fef2f2' }}>
              <ShieldAlert size={34} />
            </div>
            <div style={{ display: 'inline-block', background: '#fef2f2', color: '#b91c1c', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.75rem', border: '1px solid #fecaca' }}>
              PERINGATAN INTEGRITAS CBT &bull; PELANGGARAN KE-{tabViolations}
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#991b1b', marginBottom: '0.5rem' }}>
              Terdeteksi Meninggalkan Ujian!
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              Anda terdeteksi berpindah tab browser, membuka aplikasi lain, atau meminimalkan jendela ujian.
              Peringatan ini <strong>secara otomatis dikirimkan ke layar monitoring Pengawas / Proktor</strong> di lab ruangan Anda.
            </p>
            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.5rem', textAlign: 'left', fontSize: '0.8rem', color: '#92400e' }}>
              <strong>Perhatian:</strong> Pelanggaran berulang dapat menyebabkan sesi ujian Anda dihentikan paksa (force submit) oleh proktor ruangan.
            </div>
            <button
              type="button"
              onClick={() => setShowViolationModal(false)}
              className="btn btn-danger"
              style={{ width: '100%', padding: '0.85rem', fontWeight: 700 }}
            >
              Saya Mengerti &amp; Kembali ke Ujian
            </button>
          </div>
        </div>
      )}

      {/* Submission Confirmation Modal */}
      {showSubmitModal && (
        <div className="violation-modal-overlay">
          <div className="card" style={{ maxWidth: '520px', width: '100%', padding: '2rem', borderRadius: '20px' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', textAlign: 'center' }}>
              Konfirmasi Pengumpulan Ujian
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#64748b', textAlign: 'center', marginBottom: '1.5rem' }}>
              Periksa kembali rekapitulasi jawaban Anda sebelum mengakhiri sesi:
            </p>

            <div
              style={{
                background: '#f8fafc',
                borderRadius: '12px',
                padding: '1.25rem',
                border: '1px solid #e2e8f0',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#10b981' }}>{answeredCount}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Terjawab</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f59e0b' }}>{doubtfulCount}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Ragu-ragu</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#dc2626' }}>{unansweredCount}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Belum Dijawab</div>
                </div>
              </div>
            </div>

            {unansweredCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.85rem',
                  background: '#fffbeb',
                  borderRadius: '8px',
                  border: '1px solid #fde68a',
                  color: '#b45309',
                  fontSize: '0.85rem',
                  marginBottom: '1.5rem',
                }}
              >
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>Peringatan: Masih terdapat {unansweredCount} soal yang belum Anda jawab.</span>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={confirmAgreement}
                onChange={(e) => setConfirmAgreement(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#dc2626' }}
              />
              <span>Saya menyatakan telah selesai memeriksa jawaban dan yakin mengumpulkan lembar ujian ini.</span>
            </label>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '0.85rem' }}
                disabled={isSubmitting}
              >
                Periksa Lagi
              </button>
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={isSubmitting || !confirmAgreement}
                className="btn btn-danger"
                style={{ flex: 1, padding: '0.85rem', fontWeight: 700, opacity: (!confirmAgreement || isSubmitting) ? 0.6 : 1 }}
              >
                {isSubmitting ? 'Mengirimkan...' : 'Ya, Kumpulkan Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Extension Notification Toast */}
      {timeExtensionToast && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: '#065f46',
            color: '#ffffff',
            padding: '0.85rem 1.5rem',
            borderRadius: '16px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontWeight: 700,
            fontSize: '0.9rem',
          }}
        >
          <Clock size={20} className="text-emerald-300 animate-pulse" />
          <span>{timeExtensionToast}</span>
        </div>
      )}

      {/* Proctor Force Submit Notification Modal */}
      {isForcedSubmitted && (
        <div className="violation-modal-overlay" style={{ zIndex: 10000 }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '2rem', borderRadius: '20px', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#ede9fe', color: '#6d28d9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <ShieldCheck size={32} />
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              Ujian Telah Diselesaikan
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              Sesi ujian Anda telah <strong>diakhiri secara resmi oleh Pengawas Ujian</strong>. Lembar jawaban Anda telah tersimpan aman di server CBT.
            </p>
            <div style={{ fontSize: '0.85rem', color: '#6d28d9', fontWeight: 700 }}>
              Mengalihkan ke halaman hasil dalam beberapa detik...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
