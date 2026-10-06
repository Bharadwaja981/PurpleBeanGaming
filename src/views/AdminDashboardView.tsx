/**
 * Purple Bean Gaming — Administrative Role-Based Access Control (RBAC) Dashboard
 * 
 * Provides production-grade authority to organize, grant, update, and revoke
 * system roles (Admin, Organiser, Moderator). Enforces security invariants:
 * - Immutable Primary Lead Admin (11106cm009@gmail.com)
 * - Self-demotion safeguards
 * - Cryptographic and Firestore-persisted audit trail
 * - Granular permission matrix
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  Users,
  UserPlus,
  UserMinus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Edit3,
  ArrowLeft,
  RefreshCw,
  FileText,
  Check,
  X,
  Lock,
  ExternalLink,
  HelpCircle,
  Clock,
  Sparkles,
  Gavel,
  Trophy,
  Gamepad2,
  Trash2,
  Flag,
  Copy,
  MessageSquare
} from 'lucide-react';
import { 
  tournamentService, 
  PRIMARY_PROJECT_ADMIN_EMAIL, 
  RoleAssignment, 
  RoleAuditLog, 
  SystemRole, 
  RolePermission,
  ROLE_PERMISSIONS 
} from '../services/firebaseService';
import { pbgAccountRegistry } from '../domain/pbgAccountRegistry';
import { PBGPlayerAccount } from '../types/pbgAccount';
import { ViewType, ReportItem } from '../types/tournament';
import { PromptModal } from '../components/ui/PromptModal';

interface AdminDashboardViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function AdminDashboardView({ onNavigate }: AdminDashboardViewProps) {
  const [currentUser, setCurrentUser] = useState(() => tournamentService.getCurrentUser());
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>(() => tournamentService.getRoleAssignments());
  const [auditLogs, setAuditLogs] = useState<RoleAuditLog[]>(() => tournamentService.getRoleAuditLogs());
  const [reports, setReports] = useState<ReportItem[]>(() => tournamentService.getReports());

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'tickets' | 'roles' | 'audit'>('tickets');

  // Tickets Search & Filter States
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'under_review' | 'resolved' | 'dismissed'>('all');
  const [ticketTypeFilter, setTicketTypeFilter] = useState<'all' | 'player' | 'team'>('all');
  const [resolvingTicketId, setResolvingTicketId] = useState<string | null>(null);
  const [dismissingTicketId, setDismissingTicketId] = useState<string | null>(null);
  const [copiedTicketId, setCopiedTicketId] = useState<string | null>(null);

  // Search & Filters for Roles
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | 'admin' | 'organizer' | 'moderator'>('all');

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [targetAssignment, setTargetAssignment] = useState<RoleAssignment | null>(null);

  // Form states for Assign/Edit Modal
  const [formEmail, setFormEmail] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'organizer' | 'moderator'>('organizer');
  const [formNotes, setFormNotes] = useState('');
  const [formPbgId, setFormPbgId] = useState('');
  const [revokeReason, setRevokeReason] = useState('');

  // Status banners & loading
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keep synced with tournamentService
  useEffect(() => {
    const unsub = tournamentService.subscribe(() => {
      setCurrentUser(tournamentService.getCurrentUser());
      setRoleAssignments(tournamentService.getRoleAssignments());
      setAuditLogs(tournamentService.getRoleAuditLogs());
      setReports(tournamentService.getReports());
    });
    return unsub;
  }, []);

  const isPrimaryAdmin = useMemo(() => {
    return (
      Boolean(currentUser.isPrimaryAdmin) ||
      currentUser.email?.toLowerCase().trim() === PRIMARY_PROJECT_ADMIN_EMAIL.toLowerCase()
    );
  }, [currentUser]);

  const isSystemAdmin = useMemo(() => {
    return isPrimaryAdmin || Boolean(currentUser.isAdmin);
  }, [isPrimaryAdmin, currentUser]);

  // All known PBG accounts for quick selection in modal
  const pbgAccounts = useMemo(() => {
    return pbgAccountRegistry.getAllAccounts();
  }, []);

  // Filtered role assignments
  const filteredAssignments = useMemo(() => {
    return roleAssignments.filter((assignment) => {
      const matchesSearch = 
        assignment.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (assignment.displayName && assignment.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (assignment.pbgId && assignment.pbgId.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesRole = 
        selectedRoleFilter === 'all' ? true : assignment.role === selectedRoleFilter;

      return matchesSearch && matchesRole;
    });
  }, [roleAssignments, searchQuery, selectedRoleFilter]);

  // Statistics
  const stats = useMemo(() => {
    const admins = roleAssignments.filter((r) => r.role === 'admin').length;
    const organizers = roleAssignments.filter((r) => r.role === 'organizer').length;
    const moderators = roleAssignments.filter((r) => r.role === 'moderator').length;
    return { admins, organizers, moderators, total: roleAssignments.length };
  }, [roleAssignments]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return reports.filter((ticket) => {
      const q = ticketSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        ticket.id.toLowerCase().includes(q) ||
        ticket.reportedEntity.toLowerCase().includes(q) ||
        ticket.reporter.toLowerCase().includes(q) ||
        ticket.reason.toLowerCase().includes(q) ||
        ticket.evidenceText.toLowerCase().includes(q) ||
        (ticket.matchId && ticket.matchId.toLowerCase().includes(q))
      );

      const statusNorm = (ticket.status || '').toLowerCase();
      let matchesStatus = true;
      if (ticketStatusFilter === 'under_review') {
        matchesStatus = statusNorm === 'pending' || statusNorm === 'reviewing' || statusNorm === 'under_review';
      } else if (ticketStatusFilter === 'resolved') {
        matchesStatus = statusNorm === 'resolved';
      } else if (ticketStatusFilter === 'dismissed') {
        matchesStatus = statusNorm === 'dismissed';
      }

      const matchesType = ticketTypeFilter === 'all' || ticket.entityType === ticketTypeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [reports, ticketSearchQuery, ticketStatusFilter, ticketTypeFilter]);

  const ticketStats = useMemo(() => {
    const total = reports.length;
    const underReview = reports.filter(r => {
      const s = (r.status || '').toLowerCase();
      return s === 'pending' || s === 'reviewing' || s === 'under_review';
    }).length;
    const resolved = reports.filter(r => (r.status || '').toLowerCase() === 'resolved').length;
    const dismissed = reports.filter(r => (r.status || '').toLowerCase() === 'dismissed').length;
    return { total, underReview, resolved, dismissed };
  }, [reports]);

  const handleResolveTicket = async (note: string) => {
    if (!resolvingTicketId) return;
    setIsSubmitting(true);
    const res = await tournamentService.updateReportStatus(resolvingTicketId, 'Resolved', note);
    setIsSubmitting(false);
    setResolvingTicketId(null);
    if (res.success) {
      setFeedback({ type: 'success', message: `Ticket ${resolvingTicketId} has been resolved successfully.` });
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to update ticket.' });
    }
  };

  const handleDismissTicket = async (reason: string) => {
    if (!dismissingTicketId) return;
    setIsSubmitting(true);
    const res = await tournamentService.updateReportStatus(dismissingTicketId, 'Dismissed', reason);
    setIsSubmitting(false);
    setDismissingTicketId(null);
    if (res.success) {
      setFeedback({ type: 'success', message: `Ticket ${dismissingTicketId} has been dismissed.` });
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to update ticket.' });
    }
  };

  const handleReopenTicket = async (ticketId: string) => {
    setIsSubmitting(true);
    const res = await tournamentService.updateReportStatus(ticketId, 'Reviewing', 'Ticket reopened by administrator');
    setIsSubmitting(false);
    if (res.success) {
      setFeedback({ type: 'success', message: `Ticket ${ticketId} status set to Reviewing.` });
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to update ticket.' });
    }
  };

  const handleCopyTicket = (id: string) => {
    navigator.clipboard?.writeText(id);
    setCopiedTicketId(id);
    setTimeout(() => setCopiedTicketId(null), 2000);
  };

  const handleOpenAssignModal = () => {
    setFormEmail('');
    setFormDisplayName('');
    setFormRole('organizer');
    setFormNotes('');
    setFormPbgId('');
    setIsAssignModalOpen(true);
  };

  const handleSelectAccountForAssign = (acc: any) => {
    setFormEmail(acc.email);
    setFormDisplayName(acc.displayName);
    setFormPbgId(acc.pbgId);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail.trim() || !formEmail.includes('@')) {
      setFeedback({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const res = await tournamentService.assignUserRole(formEmail, formRole, {
      displayName: formDisplayName.trim() || undefined,
      notes: formNotes.trim() || undefined,
      pbgId: formPbgId.trim() || undefined
    });

    setIsSubmitting(false);

    if (res.success) {
      setFeedback({ type: 'success', message: res.message });
      setIsAssignModalOpen(false);
      setIsEditModalOpen(false);
    } else {
      setFeedback({ type: 'error', message: res.message });
    }
  };

  const handleOpenEdit = (assignment: RoleAssignment) => {
    setTargetAssignment(assignment);
    setFormEmail(assignment.email);
    setFormDisplayName(assignment.displayName || '');
    setFormRole(assignment.role === 'captain' ? 'organizer' : assignment.role);
    setFormNotes(assignment.notes || '');
    setFormPbgId(assignment.pbgId || '');
    setIsEditModalOpen(true);
  };

  const handleOpenRevoke = (assignment: RoleAssignment) => {
    setTargetAssignment(assignment);
    setRevokeReason('');
    setIsRevokeModalOpen(true);
  };

  const handleConfirmRevoke = async () => {
    if (!targetAssignment) return;
    setIsSubmitting(true);
    setFeedback(null);

    const res = await tournamentService.revokeUserRole(targetAssignment.email, revokeReason);
    setIsSubmitting(false);
    setIsRevokeModalOpen(false);

    if (res.success) {
      setFeedback({ type: 'success', message: res.message });
    } else {
      setFeedback({ type: 'error', message: res.message });
    }
  };

  // Access Denied guard
  if (!isSystemAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 font-mono text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 border-[3.5px] border-black text-red-600 flex items-center justify-center mx-auto text-3xl shadow-[4px_4px_0px_0px_#000]">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-black uppercase text-red-700 tracking-widest block">
            403 · RESTRICTED ACCESS
          </span>
          <h2 className="text-2xl sm:text-3xl font-black uppercase text-black font-sans">
            Administrative Console Required
          </h2>
          <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
            Role delegation and security configuration requires authenticated Administrator permissions.
            Please sign in with authorized administrator credentials or contact the Primary Project Administrator (<strong className="text-black">{PRIMARY_PROJECT_ADMIN_EMAIL}</strong>).
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={() => onNavigate('home')}
            className="px-6 py-3 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
          >
            ← Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-mono">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-[3.5px] border-black pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('home')}
              className="text-stone-500 hover:text-black flex items-center gap-1 text-xs font-bold cursor-pointer uppercase"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <span className="text-stone-300">/</span>
            <span className="bg-[#FFE600] text-black text-[10px] font-black uppercase px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_#000]">
              GOVERNANCE · RBAC
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black uppercase text-black font-sans tracking-tight">
            Role & Access Control Console
          </h1>
          <p className="text-xs text-stone-600 max-w-2xl leading-relaxed">
            Authoritative administrative engine to organize, delegate, and audit platform roles (Admin, Organiser, Moderator) with cryptographically logged governance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleOpenAssignModal}
            className="px-5 py-2.5 bg-[#70FFAF] hover:bg-[#5CE1E6] text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[4px_4px_0px_0px_#000] flex items-center gap-2 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Grant New Role</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('organiser_dashboard')}
            className="px-4 py-2.5 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-[#7C3AED]" />
            <span>Organiser Hub</span>
          </button>
        </div>
      </div>

      {/* Operator Session Alert & Status Notice */}
      {feedback && (
        <div className={`p-4 border-[3px] border-black flex items-center justify-between shadow-[4px_4px_0px_0px_#000] animate-in slide-in-from-top-2 duration-150 ${
          feedback.type === 'success' ? 'bg-[#70FFAF] text-black' : 'bg-red-100 text-red-950'
        }`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4 text-red-700" />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-black uppercase hover:underline cursor-pointer"
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* Primary Dashboard Navigation Tabs */}
      <div className="flex border-b-[3.5px] border-black gap-2 overflow-x-auto pt-2">
        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          className={`px-5 py-3 font-mono text-xs font-black uppercase border-t-[3.5px] border-x-[3.5px] border-black cursor-pointer flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'tickets'
              ? 'bg-[#FFE600] text-black shadow-[3px_-3px_0px_0px_#000] -mb-[3.5px] z-10'
              : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
          }`}
        >
          <Flag className="w-4 h-4 text-black" />
          <span>Incident Reports &amp; Tickets</span>
          {ticketStats.underReview > 0 && (
            <span className="bg-[#FF5757] text-white text-[10px] px-2 py-0.5 font-black border border-black animate-pulse">
              {ticketStats.underReview} Open
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('roles')}
          className={`px-5 py-3 font-mono text-xs font-black uppercase border-t-[3.5px] border-x-[3.5px] border-black cursor-pointer flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'roles'
              ? 'bg-[#FFE600] text-black shadow-[3px_-3px_0px_0px_#000] -mb-[3.5px] z-10'
              : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
          }`}
        >
          <Users className="w-4 h-4 text-black" />
          <span>Personnel Roles (RBAC)</span>
          <span className="bg-black text-[#FFE600] text-[10px] px-1.5 py-0.5 font-black">
            {stats.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`px-5 py-3 font-mono text-xs font-black uppercase border-t-[3.5px] border-x-[3.5px] border-black cursor-pointer flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'audit'
              ? 'bg-[#FFE600] text-black shadow-[3px_-3px_0px_0px_#000] -mb-[3.5px] z-10'
              : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
          }`}
        >
          <Clock className="w-4 h-4 text-black" />
          <span>Security Audit Trail</span>
          <span className="bg-stone-200 text-stone-700 text-[10px] px-1.5 py-0.5 font-bold">
            {auditLogs.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: INCIDENT REPORTS & DISPUTE TICKETS                                 */}
      {/* ========================================================================= */}
      {activeTab === 'tickets' && (
        <div className="space-y-6">
          {/* Ticket Stats Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-1">
              <span className="text-[10px] font-black uppercase text-stone-500 block">TOTAL TICKETS FILED</span>
              <div className="text-3xl font-black font-sans text-black">{ticketStats.total}</div>
              <span className="text-[11px] text-stone-600 block">Player, team &amp; match reports</span>
            </div>

            <div className="bg-[#FFF9E6] border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-1">
              <span className="text-[10px] font-black uppercase text-amber-900 block">UNDER INVESTIGATION</span>
              <div className="text-3xl font-black font-sans text-amber-950 flex items-center gap-2">
                <span>{ticketStats.underReview}</span>
                {ticketStats.underReview > 0 && (
                  <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping inline-block" />
                )}
              </div>
              <span className="text-[11px] text-amber-800 block">Awaiting referee audit</span>
            </div>

            <div className="bg-[#E8FFF3] border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-1">
              <span className="text-[10px] font-black uppercase text-emerald-900 block">RESOLVED TICKETS</span>
              <div className="text-3xl font-black font-sans text-emerald-950">{ticketStats.resolved}</div>
              <span className="text-[11px] text-emerald-800 block">Sanctions or corrections applied</span>
            </div>

            <div className="bg-stone-50 border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-1">
              <span className="text-[10px] font-black uppercase text-stone-500 block">DISMISSED</span>
              <div className="text-3xl font-black font-sans text-stone-700">{ticketStats.dismissed}</div>
              <span className="text-[11px] text-stone-500 block">Inconclusive / non-violations</span>
            </div>
          </div>

          {/* Ticket Search & Filter Controls */}
          <div className="bg-white border-[3.5px] border-black p-4 sm:p-5 shadow-[6px_6px_0px_0px_#000] space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={ticketSearchQuery}
                  onChange={(e) => setTicketSearchQuery(e.target.value)}
                  placeholder="Search by Ticket ID (e.g. PBG-REP-), player handle, team, match ID, or keyword..."
                  className="w-full pl-9 pr-4 py-2 bg-stone-50 border-2 border-black text-xs font-mono placeholder:text-stone-400 text-black focus:outline-none focus:bg-white"
                />
              </div>

              {/* Status Filter */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-black uppercase">
                <span className="text-stone-500 mr-1 text-[11px]">Status:</span>
                {(['all', 'under_review', 'resolved', 'dismissed'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setTicketStatusFilter(status)}
                    className={`px-3 py-1.5 border-2 border-black cursor-pointer transition-all ${
                      ticketStatusFilter === status
                        ? 'bg-black text-[#FFE600] shadow-[2px_2px_0px_0px_#FFE600]'
                        : 'bg-white hover:bg-stone-100 text-black'
                    }`}
                  >
                    {status === 'all' && `All (${ticketStats.total})`}
                    {status === 'under_review' && `Open (${ticketStats.underReview})`}
                    {status === 'resolved' && `Resolved (${ticketStats.resolved})`}
                    {status === 'dismissed' && `Dismissed (${ticketStats.dismissed})`}
                  </button>
                ))}
              </div>

              {/* Target Filter */}
              <div className="flex items-center gap-1.5 text-xs font-black uppercase">
                <span className="text-stone-500 mr-1 text-[11px]">Type:</span>
                {(['all', 'player', 'team'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTicketTypeFilter(type)}
                    className={`px-2.5 py-1.5 border-2 border-black cursor-pointer transition-all ${
                      ticketTypeFilter === type
                        ? 'bg-[#7C3AED] text-white shadow-[2px_2px_0px_0px_#000]'
                        : 'bg-white hover:bg-stone-100 text-black'
                    }`}
                  >
                    {type === 'all' ? 'All' : type === 'player' ? 'Players' : 'Teams'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ticket Cards Stream */}
          <div className="space-y-4">
            {filteredTickets.length === 0 ? (
              <div className="bg-white border-[3.5px] border-black p-10 text-center shadow-[6px_6px_0px_0px_#000] space-y-3 font-mono">
                <div className="w-12 h-12 bg-stone-100 border-2 border-black mx-auto flex items-center justify-center text-xl">
                  📋
                </div>
                <h4 className="font-sans font-black text-lg uppercase text-black">
                  No Incident Tickets Found
                </h4>
                <p className="text-xs text-stone-600 max-w-md mx-auto">
                  {reports.length === 0 
                    ? "No incident reports or disputes have been submitted on the platform yet. When users or guest whistleblowers submit reports via the Support Desk, they will stream directly into this queue."
                    : "No tickets match your active filter or search query. Try clearing filters to see all incident logs."}
                </p>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const statusNorm = (ticket.status || '').toLowerCase();
                const isUnderReview = statusNorm === 'pending' || statusNorm === 'reviewing' || statusNorm === 'under_review';
                const isResolved = statusNorm === 'resolved';
                const isDismissed = statusNorm === 'dismissed';

                return (
                  <div
                    key={ticket.id}
                    className="bg-white border-[3.5px] border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-4 font-mono transition-transform hover:-translate-y-0.5"
                  >
                    {/* Header: Ticket Code, Target, Status */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-2 border-black pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Copyable Ticket ID */}
                        <div className="flex items-center gap-1.5 bg-[#FFFBEB] border-2 border-black px-2.5 py-1 text-xs font-black shadow-[2px_2px_0px_0px_#000]">
                          <span className="text-stone-500 font-bold">CODE:</span>
                          <span className="text-[#7C3AED] select-all">{ticket.id}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyTicket(ticket.id)}
                            title="Copy Ticket Reference Code"
                            className="p-1 hover:bg-stone-200 border border-black cursor-pointer text-[10px]"
                          >
                            {copiedTicketId === ticket.id ? (
                              <span className="text-emerald-700 font-black">✓ Copied</span>
                            ) : (
                              <Copy className="w-3 h-3 text-black" />
                            )}
                          </button>
                        </div>

                        {/* Entity Type Badge */}
                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase border border-black ${
                          ticket.entityType === 'player' ? 'bg-[#5CE1E6] text-black' : 'bg-[#F3E8FF] text-[#7C3AED]'
                        }`}>
                          {ticket.entityType === 'player' ? 'Individual Player' : 'Team Stack'}
                        </span>

                        {/* Violation Tag */}
                        <span className="bg-stone-100 text-stone-800 border border-black px-2 py-0.5 text-[10px] font-black uppercase">
                          {ticket.reason}
                        </span>

                        {ticket.matchId && (
                          <span className="bg-[#FFE600] text-black border border-black px-2 py-0.5 text-[10px] font-black uppercase">
                            Valve Match ID: {ticket.matchId}
                          </span>
                        )}
                      </div>

                      {/* Status Badge */}
                      <div>
                        {isUnderReview && (
                          <span className="bg-[#FFDE59] text-black border-2 border-black px-3 py-1 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping inline-block" />
                            <span>Under Investigation</span>
                          </span>
                        )}
                        {isResolved && (
                          <span className="bg-[#70FFAF] text-black border-2 border-black px-3 py-1 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" />
                            <span>Resolved &amp; Closed</span>
                          </span>
                        )}
                        {isDismissed && (
                          <span className="bg-stone-200 text-stone-700 border-2 border-black px-3 py-1 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5">
                            <X className="w-3.5 h-3.5" />
                            <span>Dismissed</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-stone-50 border-2 border-black p-3.5">
                      <div>
                        <span className="text-[10px] font-black uppercase text-stone-500 block">REPORTED TARGET</span>
                        <strong className="font-sans text-sm font-black uppercase text-black">
                          {ticket.reportedEntity}
                        </strong>
                      </div>

                      <div>
                        <span className="text-[10px] font-black uppercase text-stone-500 block">WHISTLEBLOWER IDENTITY</span>
                        <div className="flex items-center gap-1.5 text-stone-800 font-bold">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{ticket.reporter}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-black uppercase text-stone-500 block">LOGGED TIMESTAMP</span>
                        <div className="text-stone-700 font-bold">
                          {ticket.submittedTime}
                        </div>
                      </div>
                    </div>

                    {/* Evidence & Description Quote Box */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase text-stone-700">
                        <FileText className="w-3.5 h-3.5 text-[#7C3AED]" />
                        <span>Evidence &amp; Replay Description</span>
                      </div>
                      <div className="bg-white border-2 border-black p-3.5 text-xs text-stone-800 leading-relaxed font-mono whitespace-pre-wrap shadow-[2px_2px_0px_0px_#000]">
                        {ticket.evidenceText || 'No description provided.'}
                      </div>
                    </div>

                    {/* Admin Adjudication Action Toolbar */}
                    <div className="pt-2 border-t-2 border-black flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {isUnderReview && (
                          <>
                            <button
                              type="button"
                              onClick={() => setResolvingTicketId(ticket.id)}
                              className="px-4 py-2 bg-[#70FFAF] hover:bg-emerald-300 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Resolve &amp; Record Ruling</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDismissingTicketId(ticket.id)}
                              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center gap-1.5"
                            >
                              <XCircle className="w-3.5 h-3.5 text-stone-600" />
                              <span>Dismiss Report</span>
                            </button>
                          </>
                        )}

                        {(isResolved || isDismissed) && (
                          <button
                            type="button"
                            onClick={() => handleReopenTicket(ticket.id)}
                            className="px-4 py-2 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Reopen Investigation</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (ticket.entityType === 'player') {
                              onNavigate('player_profile', ticket.reportedEntity);
                            } else {
                              onNavigate('teams');
                            }
                          }}
                          className="px-3.5 py-2 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-[#7C3AED]" />
                          <span>Inspect Profile</span>
                        </button>
                      </div>

                      <div className="text-[11px] text-stone-500 font-bold">
                        Authority: Administrator / Referee Adjudication Desk
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PERSONNEL ROLES (RBAC)                                             */}
      {/* ========================================================================= */}
      {activeTab === 'roles' && (
        <div className="space-y-8">
      {/* Operator Security Status Card */}
      <div className="bg-[#FFF9E6] border-[3.5px] border-black p-5 shadow-[6px_6px_0px_0px_#000] space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-black/15 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black text-[#FFE600] border-2 border-black flex items-center justify-center font-black">
              <Key className="w-5 h-5 text-[#FFE600]" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-stone-500 block">ACTIVE OPERATOR</span>
              <strong className="text-sm font-sans uppercase text-black">
                {currentUser.displayName || currentUser.email}
              </strong>
              <span className="text-[10px] text-stone-600 block">{currentUser.email}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isPrimaryAdmin ? (
              <span className="bg-[#FFE600] text-black px-3 py-1 border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-black" />
                <span>Primary Project Authority (Root)</span>
              </span>
            ) : (
              <span className="bg-[#70FFAF] text-black px-3 py-1 border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-950" />
                <span>System Administrator</span>
              </span>
            )}
            <span className="bg-white text-stone-700 px-2.5 py-1 border border-black text-[11px] font-mono font-bold">
              ID: {currentUser.pbgId || currentUser.id.slice(0, 10)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div className="flex items-center gap-2 text-stone-700">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Root Lead Owner anchored to <strong>{PRIMARY_PROJECT_ADMIN_EMAIL}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-stone-700">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Zero-Trust Firestore ABAC rules active & enforced</span>
          </div>
          <div className="flex items-center gap-2 text-stone-700">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Self-demotion lock & full audit logging enabled</span>
          </div>
        </div>
      </div>

      {/* Role Distribution Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Personnel */}
        <div className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-1">
          <span className="text-[10px] font-black uppercase text-stone-500 block">TOTAL DELEGATED PERSONNEL</span>
          <div className="text-3xl font-black font-sans text-black">{stats.total}</div>
          <span className="text-[11px] text-stone-600 block">Active platform operators</span>
        </div>

        {/* Admins */}
        <div className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-stone-500">ADMINISTRATORS</span>
            <span className="w-2.5 h-2.5 bg-[#FFE600] border border-black rounded-full" />
          </div>
          <div className="text-3xl font-black font-sans text-black">{stats.admins}</div>
          <span className="text-[11px] text-stone-600 block">Full system governance</span>
        </div>

        {/* Organizers */}
        <div className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-stone-500">ORGANISERS</span>
            <span className="w-2.5 h-2.5 bg-[#70FFAF] border border-black rounded-full" />
          </div>
          <div className="text-3xl font-black font-sans text-black">{stats.organizers}</div>
          <span className="text-[11px] text-stone-600 block">Tournament & auction leaders</span>
        </div>

        {/* Moderators */}
        <div className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-stone-500">MODERATORS / REFEREES</span>
            <span className="w-2.5 h-2.5 bg-[#5CE1E6] border border-black rounded-full" />
          </div>
          <div className="text-3xl font-black font-sans text-black">{stats.moderators}</div>
          <span className="text-[11px] text-stone-600 block">Competition & dispute arbiters</span>
        </div>
      </div>

      {/* Main Role Personnel Directory Section */}
      <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b-2 border-black pb-4">
          <div>
            <span className="text-[10px] font-black uppercase text-stone-500 block">PERSONNEL DIRECTORY</span>
            <h3 className="text-xl font-black uppercase text-black font-sans">
              Assigned Privileges & Operators
            </h3>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search email, name, PBG ID..."
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border-2 border-black text-xs font-mono font-bold focus:bg-white focus:outline-none shadow-[2px_2px_0px_0px_#000]"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center border-2 border-black bg-stone-100 p-0.5 text-xs font-bold shadow-[2px_2px_0px_0px_#000]">
              {(['all', 'admin', 'organizer', 'moderator'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRoleFilter(r)}
                  className={`px-3 py-1 cursor-pointer uppercase ${
                    selectedRoleFilter === r
                      ? 'bg-black text-[#FFE600] font-black'
                      : 'text-stone-700 hover:text-black'
                  }`}
                >
                  {r === 'all' ? 'All' : r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto border-2 border-black shadow-[2px_2px_0px_0px_#000]">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-black text-white uppercase text-[11px] tracking-wider border-b-2 border-black">
                <th className="py-3 px-4">Operator / Account</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Operational Scope & Capabilities</th>
                <th className="py-3 px-4">Granted At & By</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black/10">
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-stone-500 font-bold bg-stone-50">
                    No operator roles found matching your search.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((assignment) => {
                  const isPrimary = assignment.email.toLowerCase() === PRIMARY_PROJECT_ADMIN_EMAIL.toLowerCase();
                  const isCurrentLoggedUser = currentUser.email?.toLowerCase() === assignment.email.toLowerCase();

                  return (
                    <tr key={assignment.email} className="hover:bg-stone-50 transition-colors">
                      {/* Operator Identity */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <strong className="font-sans text-sm font-black uppercase text-black">
                              {assignment.displayName || assignment.email.split('@')[0]}
                            </strong>
                            {isPrimary && (
                              <span className="bg-[#FFE600] text-black text-[9px] font-black uppercase px-1.5 py-0.2 border border-black shadow-[1px_1px_0px_0px_#000]">
                                Root Owner
                              </span>
                            )}
                          </div>
                          <div className="text-stone-600 font-mono text-[11px]">
                            {assignment.email}
                          </div>
                          {assignment.pbgId && (
                            <span className="inline-block bg-stone-100 text-stone-800 text-[10px] px-1.5 border border-stone-300">
                              {assignment.pbgId}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Assigned Role */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] ${
                          assignment.role === 'admin' ? 'bg-[#FFE600] text-black' :
                          assignment.role === 'organizer' ? 'bg-[#70FFAF] text-black' :
                          assignment.role === 'moderator' ? 'bg-[#5CE1E6] text-black' :
                          'bg-stone-200 text-stone-700'
                        }`}>
                          {assignment.role === 'admin' && <Key className="w-3.5 h-3.5" />}
                          {assignment.role === 'organizer' && <Trophy className="w-3.5 h-3.5" />}
                          {assignment.role === 'moderator' && <Gavel className="w-3.5 h-3.5" />}
                          <span>{assignment.role.toUpperCase()}</span>
                        </span>
                      </td>

                      {/* Capabilities */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {assignment.role === 'admin' && (
                              <>
                                <span className="bg-amber-100 text-amber-900 border border-amber-400 text-[9px] font-bold px-1.5">Manage Roles</span>
                                <span className="bg-amber-100 text-amber-900 border border-amber-400 text-[9px] font-bold px-1.5">Global Rules</span>
                                <span className="bg-amber-100 text-amber-900 border border-amber-400 text-[9px] font-bold px-1.5">Full Tournament Override</span>
                              </>
                            )}
                            {assignment.role === 'organizer' && (
                              <>
                                <span className="bg-emerald-100 text-emerald-900 border border-emerald-400 text-[9px] font-bold px-1.5">Create Tourneys</span>
                                <span className="bg-emerald-100 text-emerald-900 border border-emerald-400 text-[9px] font-bold px-1.5">Live Auctions</span>
                                <span className="bg-emerald-100 text-emerald-900 border border-emerald-400 text-[9px] font-bold px-1.5">Bracket Routing</span>
                              </>
                            )}
                            {assignment.role === 'moderator' && (
                              <>
                                <span className="bg-cyan-100 text-cyan-900 border border-cyan-400 text-[9px] font-bold px-1.5">Referee Disputes</span>
                                <span className="bg-cyan-100 text-cyan-900 border border-cyan-400 text-[9px] font-bold px-1.5">Match Lobbies</span>
                                <span className="bg-cyan-100 text-cyan-900 border border-cyan-400 text-[9px] font-bold px-1.5">Player Penalties</span>
                              </>
                            )}
                          </div>
                          {assignment.notes && (
                            <p className="text-[10px] text-stone-500 italic truncate" title={assignment.notes}>
                              "{assignment.notes}"
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Granted At & By */}
                      <td className="py-3.5 px-4 text-[11px] text-stone-600">
                        <div>
                          <span>By: </span>
                          <strong className="text-black">{assignment.assignedBy.split('@')[0]}</strong>
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {new Date(assignment.assignedAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isPrimary ? (
                          <span className="text-[10px] font-black uppercase text-stone-500 bg-stone-100 px-2 py-1 border border-stone-300">
                            Immutable Root
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(assignment)}
                              className="px-2.5 py-1 bg-white hover:bg-stone-100 text-black border border-black font-black uppercase text-[10px] shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                              title="Edit Role & Permissions"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenRevoke(assignment)}
                              disabled={isCurrentLoggedUser}
                              className={`px-2.5 py-1 bg-red-50 hover:bg-red-600 hover:text-white text-red-700 border border-red-600 font-black uppercase text-[10px] shadow-[1px_1px_0px_0px_#000] cursor-pointer ${
                                isCurrentLoggedUser ? 'opacity-40 cursor-not-allowed' : ''
                              }`}
                              title={isCurrentLoggedUser ? 'Cannot revoke your own active session' : 'Revoke role'}
                            >
                              Revoke
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Capabilities Matrix (Specification Reference) */}
      <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-5">
        <div className="border-b-2 border-black pb-3">
          <span className="text-[10px] font-black uppercase text-stone-500 block">SPECIFICATION & ACCESS TIERS</span>
          <h3 className="text-xl font-black uppercase text-black font-sans">
            Role Permission Matrix
          </h3>
          <p className="text-xs text-stone-600">
            Each role holds mathematically strictly verified permissions across tournament execution and referee integrity.
          </p>
        </div>

        <div className="overflow-x-auto border-2 border-black shadow-[2px_2px_0px_0px_#000]">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-stone-100 text-black uppercase text-[11px] border-b-2 border-black">
                <th className="py-3 px-4">System Capability</th>
                <th className="py-3 px-4 text-center bg-[#FFE600]/30 border-l border-black">Admin</th>
                <th className="py-3 px-4 text-center bg-[#70FFAF]/30 border-l border-black">Organiser</th>
                <th className="py-3 px-4 text-center bg-[#5CE1E6]/30 border-l border-black">Moderator</th>
                <th className="py-3 px-4 text-center border-l border-black">Captain</th>
                <th className="py-3 px-4 text-center border-l border-black">Player</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {[
                { capability: 'Manage Roles & Delegate Privileges', admin: true, org: false, mod: false, cap: false, player: false },
                { capability: 'View Immutable Role Audit Logs', admin: true, org: false, mod: true, cap: false, player: false },
                { capability: 'Create & Publish New Tournaments', admin: true, org: true, mod: false, cap: false, player: false },
                { capability: 'Configure Tournament Dates, Rules & Format', admin: true, org: true, mod: false, cap: false, player: false },
                { capability: 'Control Live Captain Purse Auctions', admin: true, org: true, mod: false, cap: false, player: false },
                { capability: 'Assign Franchises & Manage Captain Roster', admin: true, org: true, mod: false, cap: false, player: false },
                { capability: 'Adjudicate Contested Match Disputes', admin: true, org: true, mod: true, cap: false, player: false },
                { capability: 'Issue Warnings & Disqualifications', admin: true, org: true, mod: true, cap: false, player: false },
                { capability: 'Manage Match Lobbies & Check-in Desk', admin: true, org: true, mod: true, cap: false, player: false },
                { capability: 'Live Bidding & Drafting on Floor', admin: false, org: false, mod: false, cap: true, player: false },
                { capability: 'Submit Match Results & Report Scores', admin: true, org: true, mod: true, cap: true, player: true },
                { capability: 'Register for Competitive Tournaments', admin: true, org: true, mod: true, cap: true, player: true },
              ].map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                  <td className="py-2.5 px-4 font-bold text-black">{row.capability}</td>
                  <td className="py-2.5 px-4 text-center border-l border-black/20 font-black">
                    {row.admin ? <span className="text-emerald-700">✓ YES</span> : <span className="text-stone-300">✕</span>}
                  </td>
                  <td className="py-2.5 px-4 text-center border-l border-black/20 font-black">
                    {row.org ? <span className="text-emerald-700">✓ YES</span> : <span className="text-stone-300">✕</span>}
                  </td>
                  <td className="py-2.5 px-4 text-center border-l border-black/20 font-black">
                    {row.mod ? <span className="text-emerald-700">✓ YES</span> : <span className="text-stone-300">✕</span>}
                  </td>
                  <td className="py-2.5 px-4 text-center border-l border-black/20 font-black">
                    {row.cap ? <span className="text-emerald-700">✓ YES</span> : <span className="text-stone-300">✕</span>}
                  </td>
                  <td className="py-2.5 px-4 text-center border-l border-black/20 font-black">
                    {row.player ? <span className="text-emerald-700">✓ YES</span> : <span className="text-stone-300">✕</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SECURITY AUDIT TRAIL                                              */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
      {/* Security Audit Trail Log Stream */}
      <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div>
            <span className="text-[10px] font-black uppercase text-stone-500 block">SECURITY LEDGER</span>
            <h3 className="text-xl font-black uppercase text-black font-sans">
              Role Mutation Audit Trail
            </h3>
          </div>
          <span className="bg-stone-100 text-stone-700 text-xs font-mono font-bold px-2 py-0.5 border border-black">
            {auditLogs.length} Events Logged
          </span>
        </div>

        <div className="space-y-2.5 max-h-72 overflow-y-auto font-mono text-xs pr-1">
          {auditLogs.length === 0 ? (
            <div className="p-6 text-center text-stone-500 border border-stone-200">
              No role mutations recorded in this session.
            </div>
          ) : (
            auditLogs.map((log) => (
              <div 
                key={log.id} 
                className="p-3 bg-stone-50 border-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-[2px_2px_0px_0px_#000]"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.2 text-[9px] font-black uppercase border border-black ${
                      log.action === 'ROLE_ASSIGNED' ? 'bg-[#70FFAF] text-black' :
                      log.action === 'ROLE_UPDATED' ? 'bg-[#FFE600] text-black' :
                      'bg-red-200 text-red-900'
                    }`}>
                      {log.action}
                    </span>
                    <strong className="text-black font-mono">{log.targetEmail}</strong>
                    <span className="text-stone-500">→</span>
                    <span className="font-black uppercase text-purple-700">{log.targetRole}</span>
                  </div>
                  {log.notes && (
                    <div className="text-[11px] text-stone-600 pl-1">
                      Reason: "{log.notes}"
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-stone-500 sm:text-right shrink-0">
                  <div>By: {log.performedByEmail.split('@')[0]}</div>
                  <div>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN / GRANT ROLE                                                */}
      {/* ========================================================================= */}
      {(isAssignModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-mono animate-in fade-in duration-150">
          <div 
            className="w-full max-w-lg bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-5 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b-2 border-black pb-3">
              <div>
                <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block">
                  AUTHORITATIVE DELEGATION
                </span>
                <h3 className="font-sans text-xl font-black uppercase text-black">
                  {isEditModalOpen ? 'Modify Operator Role' : 'Grant System Role'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="p-1 hover:bg-stone-100 border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                <X className="w-4 h-4 text-black" />
              </button>
            </div>

            {/* Quick Pick From Registered Contenders */}
            {!isEditModalOpen && pbgAccounts.length > 0 && (
              <div className="p-3 bg-stone-50 border-2 border-black space-y-2">
                <span className="text-[10px] font-black uppercase text-stone-600 block">
                  Quick Select from Registered PBG Players:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {pbgAccounts.slice(0, 10).map((acc) => (
                    <button
                      key={acc.googleUid}
                      type="button"
                      onClick={() => handleSelectAccountForAssign(acc)}
                      className="px-2 py-1 bg-white hover:bg-[#FFE600] border border-black text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      {acc.displayName} ({acc.pbgId})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveRole} className="space-y-4 text-xs">
              {/* Target Email */}
              <div className="space-y-1">
                <label className="font-black uppercase text-black block">
                  Operator Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  disabled={isEditModalOpen}
                  placeholder="operator@example.com"
                  className="w-full p-2.5 bg-stone-50 border-2 border-black text-xs font-mono font-bold focus:bg-white focus:outline-none shadow-[2px_2px_0px_0px_#000] disabled:opacity-60"
                />
              </div>

              {/* Display Name & PBG ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-black uppercase text-black block">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                    placeholder="e.g. Lead Referee Alex"
                    className="w-full p-2.5 bg-stone-50 border-2 border-black text-xs font-mono font-bold focus:bg-white focus:outline-none shadow-[2px_2px_0px_0px_#000]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-black uppercase text-black block">
                    PBG ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={formPbgId}
                    onChange={(e) => setFormPbgId(e.target.value)}
                    placeholder="e.g. PBG-000185"
                    className="w-full p-2.5 bg-stone-50 border-2 border-black text-xs font-mono font-bold focus:bg-white focus:outline-none shadow-[2px_2px_0px_0px_#000]"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-2">
                <label className="font-black uppercase text-black block">
                  Select Role & Privileges <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {/* Admin Option */}
                  <label className={`p-3 border-2 border-black flex items-start gap-3 cursor-pointer shadow-[2px_2px_0px_0px_#000] ${
                    formRole === 'admin' ? 'bg-[#FFE600]/40 border-black' : 'bg-white hover:bg-stone-50'
                  }`}>
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={formRole === 'admin'}
                      onChange={() => setFormRole('admin')}
                      disabled={!isPrimaryAdmin}
                      className="mt-1"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="font-black uppercase text-black">Administrator</strong>
                        <span className="bg-[#FFE600] text-black text-[9px] font-black px-1.5 border border-black">Full Access</span>
                      </div>
                      <p className="text-[11px] text-stone-600">
                        Global system governance, tournament management, and personnel delegation.
                        {!isPrimaryAdmin && ' (Requires Primary Owner authorization)'}
                      </p>
                    </div>
                  </label>

                  {/* Organiser Option */}
                  <label className={`p-3 border-2 border-black flex items-start gap-3 cursor-pointer shadow-[2px_2px_0px_0px_#000] ${
                    formRole === 'organizer' ? 'bg-[#70FFAF]/40 border-black' : 'bg-white hover:bg-stone-50'
                  }`}>
                    <input
                      type="radio"
                      name="role"
                      value="organizer"
                      checked={formRole === 'organizer'}
                      onChange={() => setFormRole('organizer')}
                      className="mt-1"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="font-black uppercase text-black">Organiser</strong>
                        <span className="bg-[#70FFAF] text-black text-[9px] font-black px-1.5 border border-black">Tournament Lead</span>
                      </div>
                      <p className="text-[11px] text-stone-600">
                        Create tournaments, edit brackets, manage teams, and execute live captain auctions.
                      </p>
                    </div>
                  </label>

                  {/* Moderator Option */}
                  <label className={`p-3 border-2 border-black flex items-start gap-3 cursor-pointer shadow-[2px_2px_0px_0px_#000] ${
                    formRole === 'moderator' ? 'bg-[#5CE1E6]/40 border-black' : 'bg-white hover:bg-stone-50'
                  }`}>
                    <input
                      type="radio"
                      name="role"
                      value="moderator"
                      checked={formRole === 'moderator'}
                      onChange={() => setFormRole('moderator')}
                      className="mt-1"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="font-black uppercase text-black">Moderator / Referee</strong>
                        <span className="bg-[#5CE1E6] text-black text-[9px] font-black px-1.5 border border-black">Anti-Cheat & Dispute</span>
                      </div>
                      <p className="text-[11px] text-stone-600">
                        Arbitrate contested matches, manage check-in desks, referee lobbies, and issue warnings.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Assignment Notes */}
              <div className="space-y-1">
                <label className="font-black uppercase text-black block">
                  Operational Notes & Justification
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Appointed as Bangalore Cup Tournament Director"
                  className="w-full p-2.5 bg-stone-50 border-2 border-black text-xs font-mono font-bold focus:bg-white focus:outline-none shadow-[2px_2px_0px_0px_#000]"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => {
                    setIsAssignModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-black border-2 border-black font-bold uppercase text-xs shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-black hover:bg-stone-800 text-white border-2 border-black font-black uppercase text-xs shadow-[4px_4px_0px_0px_#FFE600] flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-[#FFE600]" />
                      <span>{isEditModalOpen ? 'Update Role' : 'Confirm & Grant Role'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REVOKE ROLE CONFIRMATION                                           */}
      {/* ========================================================================= */}
      {isRevokeModalOpen && targetAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-mono animate-in fade-in duration-150">
          <div 
            className="w-full max-w-md bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b-2 border-black pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                <h3 className="font-sans text-xl font-black uppercase text-black">
                  Revoke Role Access
                </h3>
              </div>
              <button
                onClick={() => setIsRevokeModalOpen(false)}
                className="p-1 hover:bg-stone-100 border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                <X className="w-4 h-4 text-black" />
              </button>
            </div>

            <div className="p-4 bg-red-50 border-2 border-red-600 text-xs space-y-2">
              <p className="font-bold text-red-950">
                Are you sure you want to revoke {targetAssignment.role.toUpperCase()} privileges for:
              </p>
              <div className="bg-white p-2 border border-red-300 font-mono font-black text-black">
                {targetAssignment.email}
              </div>
              <p className="text-[11px] text-red-800">
                This operator will immediately lose their elevated dashboard, arbitration, and management capabilities. An immutable security audit log entry will be recorded.
              </p>
            </div>

            <div className="space-y-1">
              <label className="font-black uppercase text-xs text-black block">
                Revocation Reason (Optional):
              </label>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g. End of tournament tenure"
                className="w-full p-2.5 bg-stone-50 border-2 border-black text-xs font-mono font-bold focus:bg-white focus:outline-none shadow-[2px_2px_0px_0px_#000]"
              />
            </div>

            <div className="pt-2 flex items-center justify-between gap-3 border-t-2 border-black">
              <button
                type="button"
                onClick={() => setIsRevokeModalOpen(false)}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-black border-2 border-black font-bold uppercase text-xs shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white border-2 border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Revoking...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 text-white" />
                    <span>Confirm Revocation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESOLVE TICKET */}
      {resolvingTicketId && (
        <PromptModal
          isOpen={Boolean(resolvingTicketId)}
          onClose={() => setResolvingTicketId(null)}
          onSubmit={handleResolveTicket}
          title="Resolve Incident Ticket"
          subtitle={`Ticket Code: ${resolvingTicketId}`}
          message="Enter referee audit findings and any corrective actions enforced (e.g. 'Calibrated MMR adjusted to 7,400 in anti-smurf ledger; formal warning issued'):"
          placeholder="Referee audit findings and actions..."
          submitLabel="CONFIRM RESOLUTION"
          cancelLabel="CANCEL"
        />
      )}

      {/* MODAL: DISMISS TICKET */}
      {dismissingTicketId && (
        <PromptModal
          isOpen={Boolean(dismissingTicketId)}
          onClose={() => setDismissingTicketId(null)}
          onSubmit={handleDismissTicket}
          title="Dismiss Incident Ticket"
          subtitle={`Ticket Code: ${dismissingTicketId}`}
          message="Enter justification for dismissal (e.g. 'Match replay telemetry verified; combat logs showed no anomalous APM or pause violations'):"
          placeholder="Dismissal justification..."
          submitLabel="DISMISS TICKET"
          cancelLabel="CANCEL"
        />
      )}
    </div>
  );
}
