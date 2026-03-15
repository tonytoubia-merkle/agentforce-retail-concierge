import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScene } from '@/contexts/SceneContext';
import { useConversation } from '@/contexts/ConversationContext';
import { getPerfectCorpClient } from '@/services/perfectcorp/client';
import { buildAnalysisSummary } from '@/types/skinanalysis';
import type { SkinAnalysisResult, SkinConcernScore } from '@/types/skinanalysis';

type ModalStep = 'capture' | 'preview' | 'analyzing' | 'results';

const SEVERITY_COLORS: Record<SkinConcernScore['severity'], string> = {
  none:     'bg-emerald-500',
  mild:     'bg-amber-400',
  moderate: 'bg-orange-500',
  severe:   'bg-red-500',
};

const SEVERITY_LABELS: Record<SkinConcernScore['severity'], string> = {
  none:     'Good',
  mild:     'Mild',
  moderate: 'Moderate',
  severe:   'Concern',
};

export const SkinAnalysisModal: React.FC = () => {
  const { closeSkinAnalysis } = useScene();
  const { sendMessage } = useConversation();

  const [step, setStep] = useState<ModalStep>('capture');
  const [captureMode, setCaptureMode] = useState<'camera' | 'upload'>('camera');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [result, setResult] = useState<SkinAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Assign stream to video element after React renders the <video> node
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {/* autoplay policy — user gesture already occurred */});
    }
  }, [cameraStream]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Camera ───────────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    setCaptureMode('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { min: 640, ideal: 1920 }, height: { min: 480, ideal: 1080 } },
      });
      setCameraStream(stream);
    } catch {
      setError('Camera access denied. Please use the upload option instead.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    cameraStream?.getTracks().forEach((t) => t.stop());
    setCameraStream(null);
  }, [cameraStream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    console.log('[camera] captured dimensions:', video.videoWidth, 'x', video.videoHeight);
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) console.log('[camera] blob size:', blob.size, 'bytes');
      if (!blob) return;
      const file = new File([blob], 'skin-capture.jpg', { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      setCapturedFile(file);
      setPreviewUrl(url);
      stopCamera();
      setStep('preview');
    }, 'image/jpeg', 0.92);
  }, [stopCamera]);

  // ─── Upload ───────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCapturedFile(file);
    setPreviewUrl(url);
    setStep('preview');
  }, []);

  // ─── Analysis ─────────────────────────────────────────────────────────────

  const runAnalysis = useCallback(async () => {
    if (!capturedFile) return;
    setStep('analyzing');
    setError(null);
    try {
      const client = getPerfectCorpClient();
      const analysisResult = await client.analyzeSkin(capturedFile);
      setResult(analysisResult);
      setStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
      setStep('preview');
    }
  }, [capturedFile]);

  const handleDiscussResults = useCallback(() => {
    if (!result) return;
    closeSkinAnalysis();
    sendMessage(buildAnalysisSummary(result));
  }, [result, closeSkinAnalysis, sendMessage]);

  const handleRetake = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCapturedFile(null);
    setResult(null);
    setError(null);
    setStep('capture');
  }, [previewUrl]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md"
      onClick={step !== 'analyzing' ? closeSkinAnalysis : undefined}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI Skin Analysis</h2>
            <p className="text-xs text-gray-500 mt-0.5">Powered by BEAUTÉ in partnership with Perfect Corp</p>
          </div>
          {step !== 'analyzing' && (
            <button
              onClick={closeSkinAnalysis}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {/* ── Step: Capture ── */}
            {step === 'capture' && (
              <motion.div
                key="capture"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="p-5 flex flex-col gap-4"
              >
                {error && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
                )}

                {captureMode === 'camera' && !cameraStream && (
                  <div className="text-center py-4">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-violet-50 flex items-center justify-center">
                      <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">For best results, use good lighting</p>
                    <p className="text-xs text-gray-400 mb-5">Look directly at the camera, remove glasses</p>
                    <button
                      onClick={startCamera}
                      className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl transition-colors"
                    >
                      Open Camera
                    </button>
                  </div>
                )}

                {captureMode === 'camera' && cameraStream && (
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full rounded-2xl bg-black aspect-[4/3] object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-64 border-2 border-white/50 rounded-full" />
                    </div>
                    <button
                      onClick={capturePhoto}
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 w-14 h-14 bg-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
                    >
                      <div className="w-11 h-11 rounded-full bg-violet-600" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">or</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 border-2 border-dashed border-gray-300 hover:border-violet-400 text-gray-600 hover:text-violet-600 font-medium rounded-xl transition-colors text-sm"
                >
                  Upload a Photo
                </button>

                <p className="text-center text-xs text-gray-400">
                  Your photo is analyzed securely and not stored after processing.
                </p>
              </motion.div>
            )}

            {/* ── Step: Preview ── */}
            {step === 'preview' && previewUrl && (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="p-5 flex flex-col gap-4"
              >
                {error && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
                )}
                <div className="relative">
                  <img src={previewUrl} alt="Skin photo" className="w-full rounded-2xl object-cover aspect-[4/3]" />
                </div>
                <p className="text-sm text-center text-gray-500">
                  Make sure your face is clearly visible with even lighting.
                </p>
                <button
                  onClick={runAnalysis}
                  className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl transition-colors"
                >
                  Analyze My Skin
                </button>
                <button
                  onClick={handleRetake}
                  className="w-full py-2.5 text-gray-500 hover:text-gray-700 text-sm transition-colors"
                >
                  Retake / Use Different Photo
                </button>
              </motion.div>
            )}

            {/* ── Step: Analyzing ── */}
            {step === 'analyzing' && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="p-8 flex flex-col items-center gap-5"
              >
                <div className="relative w-20 h-20">
                  <svg className="animate-spin w-20 h-20 text-violet-200" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path className="text-violet-600" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-8 h-8 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-1" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-800">Analyzing your skin...</p>
                  <p className="text-sm text-gray-400 mt-1">AI is assessing 15 skin concerns</p>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <motion.div
                    className="h-full bg-violet-500 rounded-full"
                    initial={{ width: '5%' }}
                    animate={{ width: '90%' }}
                    transition={{ duration: 2.5, ease: 'easeInOut' }}
                  />
                </div>
              </motion.div>
            )}

            {/* ── Step: Results ── */}
            {step === 'results' && result && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="p-5 flex flex-col gap-4"
              >
                {/* Score summary */}
                <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl">
                  <div className="w-16 h-16 rounded-full bg-white shadow flex items-center justify-center flex-shrink-0">
                    <div className="text-center">
                      <span className="text-xl font-bold text-violet-700">{result.overallScore}</span>
                      <span className="text-[10px] text-gray-400 block -mt-0.5">/ 100</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {result.skinType.charAt(0).toUpperCase() + result.skinType.slice(1)} skin
                    </p>
                    <p className="text-sm text-gray-500">Estimated skin age: {result.skinAge}</p>
                    <p className="text-xs text-violet-600 mt-0.5">Top concern: {result.primaryConcern}</p>
                  </div>
                </div>

                {/* Concern grid */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Skin Assessment</p>
                  <div className="grid grid-cols-2 gap-2">
                    {result.concerns
                      .filter((c) => c.severity !== 'none')
                      .sort((a, b) => b.score - a.score)
                      .map((concern) => (
                        <div key={concern.concern} className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-xl">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${SEVERITY_COLORS[concern.severity]}`} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">{concern.label}</p>
                            <p className="text-[10px] text-gray-400">{SEVERITY_LABELS[concern.severity]}</p>
                          </div>
                          <span className="ml-auto text-xs font-semibold text-gray-600">{concern.score}</span>
                        </div>
                      ))}
                    {result.concerns.filter((c) => c.severity !== 'none').length === 0 && (
                      <div className="col-span-2 text-center py-3 text-sm text-emerald-600 font-medium">
                        No significant concerns detected
                      </div>
                    )}
                  </div>
                </div>

                {/* Good news row */}
                {result.concerns.filter((c) => c.severity === 'none').length > 0 && (
                  <div className="p-3 bg-emerald-50 rounded-xl">
                    <p className="text-xs font-medium text-emerald-700 mb-1">Looking good</p>
                    <p className="text-xs text-emerald-600">
                      {result.concerns
                        .filter((c) => c.severity === 'none')
                        .map((c) => c.label)
                        .join(', ')}
                    </p>
                  </div>
                )}

                <p className="text-[11px] text-gray-400 text-center">
                  This is a cosmetic assessment, not medical advice.
                </p>

                <button
                  onClick={handleDiscussResults}
                  className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl transition-colors"
                >
                  Discuss Results with My Advisor
                </button>
                <button
                  onClick={handleRetake}
                  className="w-full py-2 text-gray-400 hover:text-gray-600 text-sm transition-colors"
                >
                  Retake Analysis
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};
