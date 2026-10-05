import { useState } from 'react';
import { Mail, MessageSquare, Send, CheckCircle2, AlertCircle, ExternalLink, HelpCircle, PhoneCall, ShieldAlert, Sparkles } from 'lucide-react';
import { ViewType } from '../types/tournament';
import { tournamentService } from '../services/firebaseService';

interface ContactViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function ContactView({ onNavigate }: ContactViewProps) {
  const currentUser = tournamentService.getCurrentUser();
  const currentPbgAccount = tournamentService.getCurrentPBGAccount();

  const [formData, setFormData] = useState({
    name: currentUser?.displayName || '',
    email: currentUser?.email || '',
    pbgId: currentPbgAccount?.pbgId || '',
    reason: 'general',
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Please provide your name or gamer handle.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Please provide a valid email address so staff can reply.');
      return;
    }
    if (!formData.message.trim() || formData.message.length < 15) {
      setError('Please describe your inquiry with at least 15 characters.');
      return;
    }

    setIsSubmitting(true);
    // Simulate persistent dispatch with safe delay
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 600);
  };

  return (
    <div className="space-y-10 pb-12 max-w-5xl mx-auto">
      {/* Title */}
      <section className="bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-stone-500 uppercase">
          <span>PURPLE BEAN GAMING</span>
          <span aria-hidden="true">·</span>
          <span>GET IN TOUCH</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#7C3AED] font-black">SUPPORT &amp; PARTNERSHIPS</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black dark:text-white font-sans tracking-tight leading-none">
          CONTACT PBG HEADQUARTERS
        </h1>
        <p className="font-mono text-xs sm:text-sm text-stone-600 dark:text-stone-300 max-w-2xl leading-relaxed">
          Need referee dispute support, account verification help, brand partnership details, or tournament sponsorship inquiries? Reach our community staff directly.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Container */}
        <div className="lg:col-span-2 bg-white dark:bg-[#141222] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000]">
          {submitted ? (
            <div className="py-12 text-center space-y-4 font-mono">
              <div className="w-16 h-16 bg-[#70FFAF] border-[3px] border-black mx-auto flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
                <CheckCircle2 className="w-10 h-10 text-black" />
              </div>
              <h2 className="text-2xl font-black uppercase text-black dark:text-white font-sans">
                Message Dispatched to Staff!
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 max-w-md mx-auto leading-relaxed">
                Thank you, <strong>{formData.name}</strong>. A copy of your inquiry has been logged in the support dispatcher. Our referees or community managers will respond to <strong>{formData.email}</strong> within 24 hours.
              </p>
              <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({ ...formData, message: '' });
                  }}
                  className="px-4 py-2 bg-black text-white hover:bg-stone-800 text-xs font-black uppercase border border-black cursor-pointer shadow-[2px_2px_0px_0px_#000]"
                >
                  Send Another Message
                </button>
                <button
                  onClick={() => onNavigate('home')}
                  className="px-4 py-2 bg-[#FFE600] text-black hover:bg-[#FFDE59] text-xs font-black uppercase border border-black cursor-pointer shadow-[2px_2px_0px_0px_#000]"
                >
                  Return Home
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-[#FF70A6] border-2 border-black shadow-[2px_2px_0px_0px_#000] font-mono text-xs font-bold text-black flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 font-mono">
                  <label className="text-xs font-black uppercase text-black dark:text-stone-200">
                    Your Name or Gamer Tag <span className="text-[#FF5757]">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Robinhood / Rahul Verma"
                    className="w-full p-2.5 bg-stone-50 dark:bg-stone-900 border-2 border-black font-mono text-xs text-black dark:text-white placeholder:text-stone-400 focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_0px_#000]"
                    required
                  />
                </div>

                <div className="space-y-1.5 font-mono">
                  <label className="text-xs font-black uppercase text-black dark:text-stone-200">
                    Email Address <span className="text-[#FF5757]">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@example.com"
                    className="w-full p-2.5 bg-stone-50 dark:bg-stone-900 border-2 border-black font-mono text-xs text-black dark:text-white placeholder:text-stone-400 focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_0px_#000]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 font-mono">
                  <label className="text-xs font-black uppercase text-black dark:text-stone-200">
                    PBG Player ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.pbgId}
                    onChange={(e) => setFormData({ ...formData, pbgId: e.target.value })}
                    placeholder="e.g. PBG-000184"
                    className="w-full p-2.5 bg-stone-50 dark:bg-stone-900 border-2 border-black font-mono text-xs text-black dark:text-white placeholder:text-stone-400 focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_0px_#000]"
                  />
                </div>

                <div className="space-y-1.5 font-mono">
                  <label className="text-xs font-black uppercase text-black dark:text-stone-200">
                    Inquiry Reason <span className="text-[#FF5757]">*</span>
                  </label>
                  <select
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full p-2.5 bg-stone-50 dark:bg-stone-900 border-2 border-black font-mono text-xs text-black dark:text-white focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_0px_#000]"
                  >
                    <option value="general">General Community Question</option>
                    <option value="dispute">Tournament Dispute / Match Review</option>
                    <option value="verification">Steam / Discord Verification Help</option>
                    <option value="partnership">Brand / Collegiate Partnership</option>
                    <option value="technical">Technical Bug or Feature Request</option>
                    <option value="organiser">Host a Tournament on PBG</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 font-mono">
                <label className="text-xs font-black uppercase text-black dark:text-stone-200">
                  Your Message <span className="text-[#FF5757]">*</span>
                </label>
                <textarea
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Provide match IDs, tournament names, or details of your inquiry..."
                  className="w-full p-3 bg-stone-50 dark:bg-stone-900 border-2 border-black font-mono text-xs text-black dark:text-white placeholder:text-stone-400 focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_0px_#000]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-3 bg-[#FFE600] hover:bg-[#FFDE59] text-black font-mono text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center justify-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Transmitting...' : 'Dispatch Message'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Sidebar Info & Direct Channels */}
        <div className="space-y-6">
          {/* Discord Card */}
          <div className="bg-[#5865F2] text-white border-[3.5px] border-black p-6 shadow-[5px_5px_0px_0px_#000] space-y-3 font-mono">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <h3 className="font-sans font-black text-xl uppercase">Fastest Response</h3>
            </div>
            <p className="text-xs text-white/90 leading-relaxed">
              For real-time match disputes, referee calls, or captain coordination, join our official Discord server. Referees monitor ticket channels 24/7.
            </p>
            <a
              href="https://discord.gg/w8h6Jv8wsq"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-black hover:bg-stone-900 text-white font-mono text-xs font-black uppercase border-2 border-white shadow-[2px_2px_0px_0px_#fff] cursor-pointer"
            >
              <span>Join PBG Discord</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Direct Contacts */}
          <div className="bg-white dark:bg-[#141222] border-[3px] border-black p-6 shadow-[4px_4px_0px_0px_#000] space-y-4 font-mono text-xs">
            <h4 className="font-sans font-black text-base text-black dark:text-white uppercase">
              Official Channels
            </h4>
            <div className="space-y-2.5 text-stone-600 dark:text-stone-300">
              <div>
                <span className="font-black text-black dark:text-white block">Email Dispatch</span>
                <span>contact@purplebeangaming.com</span>
              </div>
              <div>
                <span className="font-black text-black dark:text-white block">Referee Desk</span>
                <span>referee@purplebeangaming.com</span>
              </div>
              <div>
                <span className="font-black text-black dark:text-white block">Tournament Partnerships</span>
                <span>partnerships@purplebeangaming.com</span>
              </div>
              <div>
                <span className="font-black text-black dark:text-white block">Headquarters</span>
                <span>Bengaluru &amp; Mumbai, India</span>
              </div>
            </div>
          </div>

          {/* Quick FAQ links */}
          <div className="bg-[#FFFDEB] border-[3px] border-black p-5 shadow-[4px_4px_0px_0px_#000] space-y-2 font-mono text-xs">
            <span className="font-black text-black uppercase block">Common Inquiries</span>
            <p className="text-stone-700">Looking for immediate answers to common tournament questions?</p>
            <button
              onClick={() => onNavigate('faq')}
              className="text-[#7C3AED] hover:underline font-black uppercase pt-1 block cursor-pointer"
            >
              Browse Frequently Asked Questions →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
