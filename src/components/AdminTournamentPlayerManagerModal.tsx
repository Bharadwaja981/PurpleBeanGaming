import React, { useState, useRef } from 'react';
import { 
  X, 
  UserPlus, 
  Upload, 
  Bot, 
  FileSpreadsheet, 
  FileCode, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ShieldCheck, 
  Users, 
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { DotaRolePosition } from '../domain/dotaPlayerEngine';
import { SelectDropdown } from './ui/Dropdown';

interface AdminTournamentPlayerManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  tournamentName: string;
  initialTab?: 'manual' | 'upload' | 'dummy';
  onPlayersUpdated?: () => void;
}

const DOTA_ROLE_OPTIONS: DotaRolePosition[] = [
  'Position 1 — Carry',
  'Position 2 — Mid',
  'Position 3 — Offlane',
  'Position 4 — Soft Support',
  'Position 5 — Hard Support'
];

const REGION_OPTIONS = [
  'Pan India',
  'North India',
  'South India',
  'West India',
  'East India',
  'Central India'
];

interface ParsedPlayerRow {
  ign: string;
  displayName?: string;
  primaryRole: DotaRolePosition;
  secondaryRole?: DotaRolePosition;
  declaredMmr: number;
  city?: string;
  region?: string;
  isCaptain?: boolean;
  isValid: boolean;
  validationError?: string;
}

export function AdminTournamentPlayerManagerModal({
  isOpen,
  onClose,
  tournamentId,
  tournamentName,
  initialTab = 'manual',
  onPlayersUpdated
}: AdminTournamentPlayerManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'upload' | 'dummy'>(initialTab);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Manual Player State ---
  const [manualIgn, setManualIgn] = useState('');
  const [manualDisplayName, setManualDisplayName] = useState('');
  const [manualPrimaryRole, setManualPrimaryRole] = useState<DotaRolePosition>('Position 1 — Carry');
  const [manualSecondaryRole, setManualSecondaryRole] = useState<string>('None');
  const [manualMmr, setManualMmr] = useState<number>(6000);
  const [manualCity, setManualCity] = useState('Mumbai');
  const [manualRegion, setManualRegion] = useState('Pan India');
  const [manualIsCaptain, setManualIsCaptain] = useState(false);
  const [manualAutoVerify, setManualAutoVerify] = useState(true);

  // --- File Upload State ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedPlayerRow[]>([]);
  const [uploadAutoVerify, setUploadAutoVerify] = useState(true);

  // --- Dummy Generator State ---
  const [dummyCount, setDummyCount] = useState<number>(1);
  const [dummyMinMmr, setDummyMinMmr] = useState<number>(5500);
  const [dummyMaxMmr, setDummyMaxMmr] = useState<number>(8500);
  const [dummyDistribution, setDummyDistribution] = useState<'BALANCED' | 'RANDOM'>('BALANCED');
  const [dummyRole, setDummyRole] = useState<string>('ANY');
  const [dummyCaptainCount, setDummyCaptainCount] = useState<number>(0);
  const [dummyAutoVerify, setDummyAutoVerify] = useState<boolean>(true);

  if (!isOpen) return null;

  const showNotification = (message: string, type: 'success' | 'error') => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 5000);
  };

  // Helper to map flexible role strings to DotaRolePosition
  const normalizeRoleInput = (input: any): DotaRolePosition => {
    if (!input) return 'Position 1 — Carry';
    const s = String(input).toLowerCase().trim();
    if (s.includes('1') || s.includes('carry') || s.includes('safe')) return 'Position 1 — Carry';
    if (s.includes('2') || s.includes('mid')) return 'Position 2 — Mid';
    if (s.includes('3') || s.includes('off')) return 'Position 3 — Offlane';
    if (s.includes('4') || s.includes('soft') || s.includes('semi')) return 'Position 4 — Soft Support';
    if (s.includes('5') || s.includes('hard')) return 'Position 5 — Hard Support';
    if (s.includes('support')) return 'Position 4 — Soft Support';
    return 'Position 1 — Carry';
  };

  // -------------------------------------------------------------
  // 1. Manual Submit Handler
  // -------------------------------------------------------------
  const handleManualSubmit = async (e: React.FormEvent, addAnother = false) => {
    e.preventDefault();
    if (!manualIgn.trim()) {
      showNotification('Player In-Game Name (IGN) is required.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await tournamentService.bulkRegisterTournamentPlayers(tournamentId, [
        {
          ign: manualIgn.trim(),
          displayName: manualDisplayName.trim() || manualIgn.trim(),
          primaryRole: manualPrimaryRole,
          secondaryRole: manualSecondaryRole !== 'None' ? (manualSecondaryRole as DotaRolePosition) : undefined,
          declaredMmr: manualMmr,
          city: manualCity.trim() || 'Mumbai',
          region: manualRegion,
          isCaptain: manualIsCaptain,
          autoVerify: manualAutoVerify
        }
      ]);

      if (res.success) {
        showNotification(`Player "${manualIgn.trim()}" successfully added to ${tournamentName}!`, 'success');
        if (onPlayersUpdated) onPlayersUpdated();
        if (addAnother) {
          setManualIgn('');
          setManualDisplayName('');
        } else {
          onClose();
        }
      } else {
        showNotification(res.errors[0] || 'Failed to add player.', 'error');
      }
    } catch (err: any) {
      showNotification(err?.message || 'Error saving player.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // -------------------------------------------------------------
  // 2. File Upload & Parsing Handler (JSON / Excel / CSV)
  // -------------------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setFeedback(null);
    const fileNameLower = file.name.toLowerCase();

    if (fileNameLower.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);
          const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.players) ? parsed.players : []);
          if (!list || list.length === 0) {
            showNotification('JSON file does not contain a list of players. Expected array [ { "ign": "..." } ]', 'error');
            setParsedRows([]);
            return;
          }
          parseRawObjectsList(list);
        } catch (err: any) {
          showNotification(`Invalid JSON file format: ${err.message}`, 'error');
          setParsedRows([]);
        }
      };
      reader.readAsText(file);
    } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls') || fileNameLower.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const XLSX = await import('xlsx');
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonRows = XLSX.utils.sheet_to_json(worksheet);
          if (!jsonRows || jsonRows.length === 0) {
            showNotification('Excel sheet is empty or contains no valid rows.', 'error');
            setParsedRows([]);
            return;
          }
          parseRawObjectsList(jsonRows);
        } catch (err: any) {
          showNotification(`Error parsing Excel/CSV file: ${err.message}`, 'error');
          setParsedRows([]);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      showNotification('Unsupported file type. Please upload a .xlsx, .xls, .csv, or .json file.', 'error');
      setParsedRows([]);
    }
  };

  const parseRawObjectsList = (list: any[]) => {
    const rows: ParsedPlayerRow[] = list.map((item, idx) => {
      // Flexible field mapping
      const ign = String(
        item.ign || item.IGN || item.player || item.Player || item.username || item.Username || item.name || item.Name || ''
      ).trim();

      const roleRaw = item.role || item.Role || item.primaryRole || item.primary_role || item.position || item.Position || item.pos || '';
      const primaryRole = normalizeRoleInput(roleRaw);

      const secRoleRaw = item.secondaryRole || item.secondary_role || item.secRole || '';
      const secondaryRole = secRoleRaw ? normalizeRoleInput(secRoleRaw) : undefined;

      const rawMmr = item.mmr || item.MMR || item.rank || item.Rank || item.tournamentMmr || item.rating || 5000;
      const declaredMmr = Math.min(15000, Math.max(100, Number(rawMmr) || 5000));

      const city = String(item.city || item.City || item.location || 'Mumbai').trim();
      const region = String(item.region || item.Region || 'Pan India').trim();

      const captainRaw = item.captain || item.Captain || item.isCaptain || item.is_captain;
      const isCaptain = Boolean(
        captainRaw === true || 
        captainRaw === 1 || 
        String(captainRaw).toLowerCase() === 'true' || 
        String(captainRaw).toLowerCase() === 'yes'
      );

      const isValid = Boolean(ign.length > 0);
      const validationError = !isValid ? 'Missing IGN / Name' : undefined;

      return {
        ign,
        displayName: item.displayName || item.realName || ign,
        primaryRole,
        secondaryRole,
        declaredMmr,
        city,
        region,
        isCaptain,
        isValid,
        validationError
      };
    });

    setParsedRows(rows);
    const validCount = rows.filter(r => r.isValid).length;
    showNotification(`Successfully parsed ${rows.length} rows (${validCount} valid players ready for import).`, 'success');
  };

  const handleImportParsedRows = async () => {
    const validPlayers = parsedRows.filter(r => r.isValid);
    if (validPlayers.length === 0) {
      showNotification('No valid players to import.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await tournamentService.bulkRegisterTournamentPlayers(
        tournamentId,
        validPlayers.map(p => ({
          ...p,
          autoVerify: uploadAutoVerify
        }))
      );

      if (res.success) {
        showNotification(`Successfully imported ${res.registeredCount} players into ${tournamentName}!`, 'success');
        if (onPlayersUpdated) onPlayersUpdated();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        showNotification(res.errors[0] || 'Import failed.', 'error');
      }
    } catch (err: any) {
      showNotification(err?.message || 'Error importing players.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // -------------------------------------------------------------
  // Template Download Handlers
  // -------------------------------------------------------------
  const downloadSampleExcel = async () => {
    const XLSX = await import('xlsx');
    const sampleData = [
      {
        ign: 'AetherStorm',
        role: 'Position 1 — Carry',
        mmr: 7850,
        city: 'Mumbai',
        region: 'West India',
        isCaptain: 'Yes'
      },
      {
        ign: 'ShadowViper',
        role: 'Position 2 — Mid',
        mmr: 8100,
        city: 'Bengaluru',
        region: 'South India',
        isCaptain: 'No'
      },
      {
        ign: 'IronTitan',
        role: 'Position 3 — Offlane',
        mmr: 7200,
        city: 'Delhi NCR',
        region: 'North India',
        isCaptain: 'No'
      },
      {
        ign: 'NeonZenith',
        role: 'Position 4 — Soft Support',
        mmr: 7600,
        city: 'Hyderabad',
        region: 'South India',
        isCaptain: 'No'
      },
      {
        ign: 'FrostOracle',
        role: 'Position 5 — Hard Support',
        mmr: 6900,
        city: 'Pune',
        region: 'West India',
        isCaptain: 'No'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TournamentPlayers');
    XLSX.writeFile(workbook, `purple_bean_${tournamentId}_players_template.xlsx`);
  };

  const downloadSampleJson = () => {
    const sampleData = [
      {
        ign: 'AetherStorm',
        primaryRole: 'Position 1 — Carry',
        declaredMmr: 7850,
        city: 'Mumbai',
        region: 'West India',
        isCaptain: true
      },
      {
        ign: 'ShadowViper',
        primaryRole: 'Position 2 — Mid',
        declaredMmr: 8100,
        city: 'Bengaluru',
        region: 'South India',
        isCaptain: false
      },
      {
        ign: 'IronTitan',
        primaryRole: 'Position 3 — Offlane',
        declaredMmr: 7200,
        city: 'Delhi NCR',
        region: 'North India',
        isCaptain: false
      }
    ];

    const blob = new Blob([JSON.stringify(sampleData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purple_bean_${tournamentId}_players_template.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------
  // 3. Dummy Generator Handler
  // -------------------------------------------------------------
  const handleGenerateDummies = async () => {
    if (dummyCount < 1 || dummyCount > 100) {
      showNotification('Please enter a player count between 1 and 100.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await tournamentService.generateDummyTournamentPlayers(tournamentId, {
        count: dummyCount,
        minMmr: dummyMinMmr,
        maxMmr: dummyMaxMmr,
        roleDistribution: dummyDistribution,
        specificRole: dummyCount === 1 && dummyRole !== 'ANY' ? (dummyRole as DotaRolePosition) : undefined,
        captainCount: dummyCaptainCount,
        autoVerify: dummyAutoVerify
      });

      if (res.success) {
        showNotification(
          dummyCount === 1 
            ? `Generated and registered 1 test contender into ${tournamentName}!` 
            : `Generated and registered ${res.generatedCount} test contenders into ${tournamentName}!`,
          'success'
        );
        if (onPlayersUpdated) onPlayersUpdated();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        showNotification(res.errors[0] || 'Failed to generate dummy players.', 'error');
      }
    } catch (err: any) {
      showNotification(err?.message || 'Error generating test players.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white border-[4px] border-black shadow-[12px_12px_0px_0px_#000] my-8 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#7C3AED] text-white p-5 border-b-[3.5px] border-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFE600] text-black border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
              <Users className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-sans font-black text-xl uppercase tracking-tight">
                  ROSTER &amp; CONTENDER STUDIO
                </h2>
                <span className="px-2 py-0.5 bg-black text-[#FFE600] border border-black text-[10px] font-mono font-black uppercase">
                  Admin / Organiser
                </span>
              </div>
              <p className="font-mono text-xs text-[#F3E8FF] font-medium">
                {tournamentName} · Direct Contender Provisioning
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-white text-black hover:bg-black hover:text-white border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div className={`p-3 border-b-2 border-black font-mono text-xs font-bold flex items-center gap-2 ${
            feedback.type === 'success' ? 'bg-[#70FFAF] text-black' : 'bg-[#FF70A6] text-black'
          }`}>
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 stroke-[2.5] text-black shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 stroke-[2.5] text-black shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="flex border-b-4 border-black bg-stone-100 p-2 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2.5 font-mono text-xs font-black uppercase border-2 border-black flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000]'
                : 'bg-white text-stone-700 hover:bg-stone-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            1. Enter Player Manually
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2.5 font-mono text-xs font-black uppercase border-2 border-black flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000]'
                : 'bg-white text-stone-700 hover:bg-stone-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload JSON or Excel File
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dummy')}
            className={`px-4 py-2.5 font-mono text-xs font-black uppercase border-2 border-black flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'dummy'
                ? 'bg-[#70FFAF] text-black shadow-[3px_3px_0px_0px_#000]'
                : 'bg-white text-stone-700 hover:bg-stone-200'
            }`}
          >
            <Bot className="w-4 h-4" />
            2. Add Dummy Players
          </button>
        </div>

        {/* Tab 1: Manual Entry Form */}
        {activeTab === 'manual' && (
          <form onSubmit={(e) => handleManualSubmit(e, false)} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            <div className="bg-stone-50 border-2 border-black p-3 font-mono text-xs text-stone-700">
              💡 Register a single contender directly into <span className="font-black text-black">{tournamentName}</span>. Auto-verified players immediately appear in the live tournament roster and live auction drafting pool.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs font-black uppercase mb-1">
                  In-Game Name (IGN) / Handle <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Miracle, Aether, Storm"
                  value={manualIgn}
                  onChange={(e) => setManualIgn(e.target.value)}
                  className="w-full p-2.5 border-2 border-black font-mono text-xs font-bold bg-white focus:bg-[#FFFDE8] outline-hidden shadow-[2px_2px_0px_0px_#000]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs font-black uppercase mb-1">
                  Real Name / Display Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amer Al-Barkawi"
                  value={manualDisplayName}
                  onChange={(e) => setManualDisplayName(e.target.value)}
                  className="w-full p-2.5 border-2 border-black font-mono text-xs font-bold bg-white focus:bg-[#FFFDE8] outline-hidden shadow-[2px_2px_0px_0px_#000]"
                />
              </div>

              <div>
                <SelectDropdown
                  label="Primary Position / Role *"
                  value={manualPrimaryRole}
                  onChange={(val) => setManualPrimaryRole(val as DotaRolePosition)}
                  options={DOTA_ROLE_OPTIONS.map((role) => ({ value: role, label: role }))}
                  className="w-full"
                  mobileTitle="Select Primary Position / Role"
                />
              </div>

              <div>
                <SelectDropdown
                  label="Secondary Role (Optional)"
                  value={manualSecondaryRole}
                  onChange={(val) => setManualSecondaryRole(val)}
                  options={[
                    { value: 'None', label: 'None / Flex' },
                    ...DOTA_ROLE_OPTIONS.map((role) => ({ value: role, label: role }))
                  ]}
                  className="w-full"
                  mobileTitle="Select Secondary Role"
                />
              </div>

              <div>
                <label className="block font-mono text-xs font-black uppercase mb-1">
                  Declared / Official MMR <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={100}
                  max={15000}
                  step={50}
                  value={manualMmr}
                  onChange={(e) => setManualMmr(Number(e.target.value))}
                  className="w-full p-2.5 border-2 border-black font-mono text-xs font-bold bg-white outline-hidden shadow-[2px_2px_0px_0px_#000]"
                />
                <span className="text-[10px] font-mono text-stone-500 mt-1 block">
                  Immortal: 6,000+ · Divine: 5,000+ · Ancient: 4,000+
                </span>
              </div>

              <div>
                <label className="block font-mono text-xs font-black uppercase mb-1">
                  City / State
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai, Bengaluru, Delhi"
                  value={manualCity}
                  onChange={(e) => setManualCity(e.target.value)}
                  className="w-full p-2.5 border-2 border-black font-mono text-xs font-bold bg-white outline-hidden shadow-[2px_2px_0px_0px_#000]"
                />
              </div>

              <div>
                <SelectDropdown
                  label="Esports Region"
                  value={manualRegion}
                  onChange={(val) => setManualRegion(val)}
                  options={REGION_OPTIONS.map((reg) => ({ value: reg, label: reg }))}
                  className="w-full"
                  mobileTitle="Select Esports Region"
                />
              </div>

              <div className="flex flex-col justify-end">
                <div className="p-3 bg-stone-100 border-2 border-black space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-mono text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={manualIsCaptain}
                      onChange={(e) => setManualIsCaptain(e.target.checked)}
                      className="w-4 h-4 accent-black"
                    />
                    <span>Captain Candidate / Applicant</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-mono text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={manualAutoVerify}
                      onChange={(e) => setManualAutoVerify(e.target.checked)}
                      className="w-4 h-4 accent-black"
                    />
                    <span>Auto-Verify (Verified Contender)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t-2 border-stone-200 pt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-black border-2 border-black font-mono text-xs font-black uppercase cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={(e) => handleManualSubmit(e, true)}
                  className="px-4 py-2 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Add &amp; Enter Another
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-6 py-2 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer font-bold"
                >
                  <UserPlus className="w-4 h-4" />
                  {isProcessing ? 'Adding...' : 'Save Player'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: File Upload (JSON or Excel / CSV) */}
        {activeTab === 'upload' && (
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            <div className="bg-stone-50 border-2 border-black p-4 font-mono text-xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-black text-black uppercase flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Supported File Formats: .xlsx, .xls, .csv, .json</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={downloadSampleExcel}
                    className="bg-white hover:bg-stone-100 border border-black px-2.5 py-1 text-[11px] font-black uppercase flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                  >
                    <Download className="w-3 h-3" /> Sample Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={downloadSampleJson}
                    className="bg-white hover:bg-stone-100 border border-black px-2.5 py-1 text-[11px] font-black uppercase flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                  >
                    <FileCode className="w-3 h-3" /> Sample JSON
                  </button>
                </div>
              </div>
              <p className="text-stone-600 text-[11px]">
                Recognized columns: <span className="font-bold text-black">ign</span> (or name/username), <span className="font-bold text-black">role</span> (or position/pos), <span className="font-bold text-black">mmr</span> (or rank), <span className="font-bold text-black">city</span>, <span className="font-bold text-black">region</span>, <span className="font-bold text-black">isCaptain</span> (yes/no).
              </p>
            </div>

            {/* Upload Zone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-[3px] border-dashed border-black bg-stone-50 hover:bg-[#FFFDE8] p-8 text-center cursor-pointer transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-2 font-mono">
                <div className="w-12 h-12 bg-[#FFE600] border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-sm font-black uppercase text-black mt-2">
                  {uploadedFileName ? `Selected: ${uploadedFileName}` : 'Click or Drag & Drop File to Upload'}
                </div>
                <div className="text-xs text-stone-500">
                  Select Excel (.xlsx, .xls), CSV, or JSON player roster file
                </div>
              </div>
            </div>

            {/* Verification Option */}
            <div className="bg-stone-100 border-2 border-black p-3 font-mono text-xs flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-black">
                <input
                  type="checkbox"
                  checked={uploadAutoVerify}
                  onChange={(e) => setUploadAutoVerify(e.target.checked)}
                  className="w-4 h-4 accent-black"
                />
                <span>Automatically mark all imported players as VERIFIED (Draft &amp; Auction Ready)</span>
              </label>
              <span className="text-[10px] text-stone-500 font-bold uppercase">
                {parsedRows.length} Rows Parsed
              </span>
            </div>

            {/* Parsed Preview Table */}
            {parsedRows.length > 0 && (
              <div className="border-2 border-black bg-white overflow-hidden shadow-[3px_3px_0px_0px_#000]">
                <div className="bg-[#FFE600] p-2.5 border-b-2 border-black font-mono text-xs font-black uppercase flex items-center justify-between">
                  <span>Roster Preview ({parsedRows.filter(r => r.isValid).length} Valid / {parsedRows.length} Total)</span>
                  <span className="text-[10px] text-stone-700">Showing first 10 rows</span>
                </div>
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-stone-100 border-b border-black text-[10px] uppercase font-black">
                      <tr>
                        <th className="p-2">#</th>
                        <th className="p-2">IGN</th>
                        <th className="p-2">Role</th>
                        <th className="p-2 text-right">MMR</th>
                        <th className="p-2">City / Region</th>
                        <th className="p-2 text-center">Captain</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-stone-200">
                      {parsedRows.slice(0, 10).map((row, idx) => (
                        <tr key={idx} className={row.isValid ? 'hover:bg-stone-50' : 'bg-red-50'}>
                          <td className="p-2 font-bold">{idx + 1}</td>
                          <td className="p-2 font-black">{row.ign || '<Missing>'}</td>
                          <td className="p-2 font-bold text-stone-700">{row.primaryRole}</td>
                          <td className="p-2 text-right font-black">{row.declaredMmr.toLocaleString()}</td>
                          <td className="p-2 text-stone-600">{row.city} ({row.region})</td>
                          <td className="p-2 text-center">
                            {row.isCaptain ? (
                              <span className="bg-[#FFE600] border border-black px-1 text-[9px] font-black">YES</span>
                            ) : (
                              <span className="text-stone-400 text-[10px]">No</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {row.isValid ? (
                              <span className="text-emerald-700 font-black text-[10px] flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </span>
                            ) : (
                              <span className="text-red-600 font-bold text-[10px] flex items-center justify-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {row.validationError}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="border-t-2 border-stone-200 pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-black border-2 border-black font-mono text-xs font-black uppercase cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isProcessing || parsedRows.filter(r => r.isValid).length === 0}
                onClick={handleImportParsedRows}
                className="px-6 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:bg-stone-300 text-white border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                {isProcessing ? 'Importing...' : `Import ${parsedRows.filter(r => r.isValid).length} Players`}
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Add Dummy Players Generator */}
        {activeTab === 'dummy' && (
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            <div className="bg-[#FFFDE8] border-2 border-black p-4 font-mono text-xs space-y-2">
              <div className="flex items-center gap-2 text-black font-black uppercase">
                <Sparkles className="w-4 h-4 text-purple-700" />
                <span>Deterministic Esports Contender Generator</span>
              </div>
              <p className="text-stone-700 text-xs">
                Quickly populate <span className="font-black text-black">{tournamentName}</span> with realistic Indian competitive players. Ideal for testing live captain auctions, filling brackets, and verifying tournament mechanics.
              </p>
            </div>

            {/* Quick Count Presets */}
            <div>
              <label className="block font-mono text-xs font-black uppercase mb-2">
                Select Number of Dummy Players:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 font-mono text-xs">
                {[
                  { label: '1 Player (Single)', count: 1 },
                  { label: '2 Players (Duo)', count: 2 },
                  { label: '5 Players (1 Team)', count: 5 },
                  { label: '10 Players (2 Teams)', count: 10 },
                  { label: '15 Players (3 Teams)', count: 15 },
                  { label: '20 Players (4 Teams)', count: 20 }
                ].map((preset) => (
                  <button
                    key={preset.count}
                    type="button"
                    onClick={() => {
                      setDummyCount(preset.count);
                      setDummyCaptainCount(preset.count === 1 ? 0 : Math.max(1, Math.floor(preset.count / 5)));
                    }}
                    className={`p-2.5 border-2 border-black font-black uppercase text-center transition-all cursor-pointer ${
                      dummyCount === preset.count
                        ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000]'
                        : 'bg-white hover:bg-stone-100 text-stone-700'
                    }`}
                  >
                    {preset.count === 1 ? '1 Player' : `+${preset.count}`}
                    <span className="block text-[10px] font-normal text-stone-600 mt-0.5">
                      {preset.label.split('(')[1].replace(')', '')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Count & Role Input */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div>
                <label className="block font-black uppercase mb-1">
                  Number of Dummy Players (1 – 100)
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.max(1, dummyCount - 1);
                      setDummyCount(next);
                      setDummyCaptainCount(Math.min(next, dummyCaptainCount));
                    }}
                    className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-black border-2 border-r-0 border-black font-black text-sm cursor-pointer select-none active:bg-stone-300"
                  >
                    –
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={dummyCount}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const c = raw === '' ? 1 : Math.max(1, Math.min(100, Number(raw)));
                      setDummyCount(c);
                      setDummyCaptainCount(Math.min(c, dummyCaptainCount));
                    }}
                    className="w-full p-2.5 border-2 border-black font-black text-center text-sm bg-white outline-hidden shadow-[2px_2px_0px_0px_#000]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.min(100, dummyCount + 1);
                      setDummyCount(next);
                    }}
                    className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-black border-2 border-l-0 border-black font-black text-sm cursor-pointer select-none active:bg-stone-300"
                  >
                    +
                  </button>
                </div>
                <span className="text-[10px] text-stone-500 mt-1 block">
                  Click "1 Player" preset or enter 1 directly
                </span>
              </div>

              <div>
                <label className="block font-black uppercase mb-1">
                  {dummyCount === 1 ? 'Player Position / Role' : 'Role Distribution'}
                </label>
                {dummyCount === 1 ? (
                  <SelectDropdown
                    value={dummyRole}
                    onChange={(val) => setDummyRole(val)}
                    options={[
                      { value: 'ANY', label: 'Any / Random Position' },
                      ...DOTA_ROLE_OPTIONS.map((role) => ({ value: role, label: role }))
                    ]}
                    className="w-full"
                    mobileTitle="Select Position / Role"
                  />
                ) : (
                  <SelectDropdown
                    value={dummyDistribution}
                    onChange={(val) => setDummyDistribution(val as 'BALANCED' | 'RANDOM')}
                    options={[
                      { value: 'BALANCED', label: 'Balanced (Pos 1 to 5 Evenly)' },
                      { value: 'RANDOM', label: 'Randomized Positions' }
                    ]}
                    className="w-full"
                    mobileTitle="Select Role Distribution"
                  />
                )}
                <span className="text-[10px] text-stone-500 mt-0.5 block">
                  {dummyCount === 1 ? 'Pick exact position or keep random' : 'Distribute across roster roles'}
                </span>
              </div>

              <div>
                <label className="block font-black uppercase mb-1">
                  Captain Applicants
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setDummyCaptainCount(Math.max(0, dummyCaptainCount - 1))}
                    className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-black border-2 border-r-0 border-black font-black text-sm cursor-pointer select-none active:bg-stone-300"
                  >
                    –
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={dummyCount}
                    value={dummyCaptainCount}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const val = raw === '' ? 0 : Math.max(0, Math.min(dummyCount, Number(raw)));
                      setDummyCaptainCount(val);
                    }}
                    className="w-full p-2.5 border-2 border-black font-black text-center text-sm bg-white outline-hidden shadow-[2px_2px_0px_0px_#000]"
                  />
                  <button
                    type="button"
                    onClick={() => setDummyCaptainCount(Math.min(dummyCount, dummyCaptainCount + 1))}
                    className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-black border-2 border-l-0 border-black font-black text-sm cursor-pointer select-none active:bg-stone-300"
                  >
                    +
                  </button>
                </div>
                <span className="text-[10px] text-stone-500 mt-0.5 block">
                  {dummyCount === 1 ? 'Mark this player as a captain candidate' : 'Eligible for franchise captaincy'}
                </span>
              </div>
            </div>

            {/* MMR Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              <div>
                <label className="block font-black uppercase mb-1">
                  Min MMR Threshold
                </label>
                <input
                  type="number"
                  min={1000}
                  max={10000}
                  step={100}
                  value={dummyMinMmr}
                  onChange={(e) => setDummyMinMmr(Number(e.target.value))}
                  className="w-full p-2.5 border-2 border-black font-bold bg-white outline-hidden shadow-[2px_2px_0px_0px_#000]"
                />
              </div>

              <div>
                <label className="block font-black uppercase mb-1">
                  Max MMR Threshold
                </label>
                <input
                  type="number"
                  min={1000}
                  max={12000}
                  step={100}
                  value={dummyMaxMmr}
                  onChange={(e) => setDummyMaxMmr(Number(e.target.value))}
                  className="w-full p-2.5 border-2 border-black font-bold bg-white outline-hidden shadow-[2px_2px_0px_0px_#000]"
                />
              </div>
            </div>

            {/* Auto Verify Toggle */}
            <div className="p-3 bg-stone-100 border-2 border-black font-mono text-xs flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-black">
                <input
                  type="checkbox"
                  checked={dummyAutoVerify}
                  onChange={(e) => setDummyAutoVerify(e.target.checked)}
                  className="w-4 h-4 accent-black"
                />
                <span>Automatically mark generated dummy players as VERIFIED (Draft Eligible)</span>
              </label>
              <span className="text-[10px] font-black uppercase bg-[#70FFAF] text-black px-2 py-0.5 border border-black">
                Instant Ready
              </span>
            </div>

            {/* Summary preview */}
            <div className="p-3 bg-white border-2 border-black font-mono text-xs space-y-1">
              <div className="font-bold text-black">
                Generation Preview:
              </div>
              <p className="text-stone-600 text-[11px]">
                {dummyCount === 1 ? (
                  <>Will create <span className="font-black text-black">1 contender</span> with <span className="font-black text-black">{dummyRole === 'ANY' ? 'random position' : dummyRole}</span> and MMR between <span className="font-black text-black">{dummyMinMmr.toLocaleString()} – {dummyMaxMmr.toLocaleString()}</span>{dummyCaptainCount > 0 ? ' (flagged as Captain)' : ''}.</>
                ) : (
                  <>Will create <span className="font-black text-black">{dummyCount} contenders</span> with MMR between <span className="font-black text-black">{dummyMinMmr.toLocaleString()} – {dummyMaxMmr.toLocaleString()}</span>, with <span className="font-black text-black">{dummyCaptainCount} designated captains</span> across Indian metropolitan nodes.</>
                )}
              </p>
            </div>

            <div className="border-t-2 border-stone-200 pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-black border-2 border-black font-mono text-xs font-black uppercase cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={handleGenerateDummies}
                className="px-6 py-2.5 bg-[#70FFAF] hover:bg-[#52e896] text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer font-bold"
              >
                <Sparkles className="w-4 h-4" />
                {isProcessing ? 'Generating...' : (dummyCount === 1 ? 'Generate 1 Dummy Player' : `Generate ${dummyCount} Dummy Players`)}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
