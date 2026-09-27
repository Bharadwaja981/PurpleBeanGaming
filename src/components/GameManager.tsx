import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, 
  Plus, 
  Edit3, 
  Power, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle, 
  AlertCircle,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react';
import { gameManagementEngine, ManagedGame } from '../domain/gameManagementEngine';
import { tournamentService } from '../services/firebaseService';
import { SelectDropdown, DropdownOption } from './ui/Dropdown';

export function GameManager() {
  const [games, setGames] = useState<ManagedGame[]>(() => gameManagementEngine.getGames(true));
  const [isEditing, setIsEditing] = useState(false);
  const [selectedGame, setSelectedGame] = useState<ManagedGame | null>(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formShortName, setFormShortName] = useState('');
  const [formLogo, setFormLogo] = useState('🎮');
  const [formActive, setFormActive] = useState(true);
  const [formTeamSize, setFormTeamSize] = useState(5);
  const [formSubLimit, setFormSubLimit] = useState(2);
  const [formRoles, setFormRoles] = useState('Carry, Mid, Offlane, Soft Support, Hard Support');
  const [formCompetitionType, setFormCompetitionType] = useState('MOBA_5v5');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const unsub = gameManagementEngine.subscribe(() => {
      setGames(gameManagementEngine.getGames(true));
    });
    return unsub;
  }, []);

  const currentUser = tournamentService.getCurrentUser();
  const callerContext = {
    userId: currentUser.id,
    email: currentUser.email,
    role: currentUser.role,
    isAdmin: currentUser.isAdmin
  };

  const openAddModal = () => {
    setSelectedGame(null);
    setFormName('');
    setFormSlug('');
    setFormShortName('');
    setFormLogo('🎮');
    setFormActive(false);
    setFormTeamSize(5);
    setFormSubLimit(2);
    setFormRoles('Carry, Mid, Offlane, Support, Hard Support');
    setFormCompetitionType('MOBA_5v5');
    setIsEditing(true);
    setMessage(null);
  };

  const openEditModal = (game: ManagedGame) => {
    setSelectedGame(game);
    setFormName(game.name);
    setFormSlug(game.slug);
    setFormShortName(game.shortName);
    setFormLogo(game.logo);
    setFormActive(game.active);
    setFormTeamSize(game.teamSize);
    setFormSubLimit(game.substituteLimit);
    setFormRoles(game.roles.join(', '));
    setFormCompetitionType(game.competitionType);
    setIsEditing(true);
    setMessage(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedRoles = formRoles.split(',').map((r) => r.trim()).filter(Boolean);
      if (selectedGame) {
        gameManagementEngine.updateGame(
          selectedGame.id,
          {
            name: formName,
            slug: formSlug,
            shortName: formShortName,
            logo: formLogo,
            active: formActive,
            teamSize: Number(formTeamSize),
            substituteLimit: Number(formSubLimit),
            roles: parsedRoles,
            competitionType: formCompetitionType
          },
          callerContext
        );
        setMessage({ text: `Updated game "${formName}" successfully.`, type: 'success' });
      } else {
        gameManagementEngine.addGame(
          {
            name: formName,
            slug: formSlug,
            shortName: formShortName,
            logo: formLogo,
            active: formActive,
            teamSize: Number(formTeamSize),
            substituteLimit: Number(formSubLimit),
            roles: parsedRoles,
            competitionType: formCompetitionType
          },
          callerContext
        );
        setMessage({ text: `Created game configuration "${formName}" successfully.`, type: 'success' });
      }
      setIsEditing(false);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleToggle = (id: string) => {
    try {
      const g = gameManagementEngine.toggleGameActive(id, callerContext);
      setMessage({
        text: `Game "${g.name}" is now ${g.active ? 'ACTIVE (Visible to users)' : 'INACTIVE (Hidden from users)'}.`,
        type: 'success'
      });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= games.length) return;

    const newOrder = [...games];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    const orderedIds = newOrder.map((g) => g.id);
    gameManagementEngine.reorderGames(orderedIds, callerContext);
    setMessage({ text: 'Game priority order updated.', type: 'success' });
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-[#7C3AED]" />
            <h2 className="text-xl font-black uppercase text-black font-sans">
              PLATFORM GAME MANAGEMENT
            </h2>
          </div>
          <p className="font-mono text-xs text-stone-600 mt-1">
            Server-backed game registry. Normal users only see <strong className="text-black uppercase">ACTIVE</strong> games. Currently, <strong className="text-[#7C3AED]">Dota 2</strong> is the sole active title.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 bg-[#FFE600] text-black border-2 border-black px-3.5 py-1.5 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Game</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-3 border-2 border-black font-mono text-xs flex items-center gap-2 ${
            message.type === 'success' ? 'bg-[#70FFAF] text-black' : 'bg-[#FF70A6] text-black'
          }`}
        >
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Games Registry Table */}
      <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] overflow-hidden">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-stone-100 border-b-2 border-black uppercase text-[10px] font-black text-black">
            <tr>
              <th className="p-3 text-center">Order</th>
              <th className="p-3">Title &amp; Slug</th>
              <th className="p-3">Team Size</th>
              <th className="p-3">Roles</th>
              <th className="p-3">Format Type</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Admin Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y border-stone-200">
            {games.map((game, idx) => (
              <tr key={game.id} className="hover:bg-stone-50 transition-colors">
                <td className="p-3 text-center font-black">
                  <div className="flex items-center justify-center gap-1">
                    <span>#{game.order}</span>
                    <div className="flex flex-col ml-1">
                      <button
                        onClick={() => handleMove(idx, 'up')}
                        disabled={idx === 0}
                        className="text-stone-400 hover:text-black disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMove(idx, 'down')}
                        disabled={idx === games.length - 1}
                        className="text-stone-400 hover:text-black disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{game.logo}</span>
                    <div>
                      <span className="font-black text-black block font-sans text-sm">{game.name}</span>
                      <span className="text-[10px] text-stone-500 font-mono">slug: {game.slug}</span>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <span className="font-bold text-black">{game.teamSize} Players</span>
                  <span className="text-stone-500 text-[10px] block">+{game.substituteLimit} subs</span>
                </td>
                <td className="p-3">
                  <span className="font-black text-stone-800">{game.roles.length} Roles</span>
                  <span className="text-[10px] text-stone-500 block truncate max-w-xs">
                    {game.roles.slice(0, 2).join(', ')}...
                  </span>
                </td>
                <td className="p-3">
                  <span className="bg-stone-100 border border-black px-1.5 py-0.5 text-[10px] uppercase font-bold">
                    {game.competitionType}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-black uppercase border border-black ${
                      game.active ? 'bg-[#70FFAF] text-black' : 'bg-stone-300 text-stone-700'
                    }`}
                  >
                    {game.active ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => handleToggle(game.id)}
                      className={`px-2 py-1 text-[10px] font-black uppercase border border-black cursor-pointer ${
                        game.active ? 'bg-stone-200 hover:bg-stone-300' : 'bg-[#70FFAF] hover:bg-emerald-300'
                      }`}
                      title={game.active ? 'Disable game from public view' : 'Activate game for users'}
                    >
                      <Power className="w-3 h-3 inline mr-1" />
                      {game.active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => openEditModal(game)}
                      className="px-2 py-1 bg-white hover:bg-stone-100 border border-black text-[10px] font-black uppercase cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3 inline mr-1" />
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Game Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <h3 className="font-sans font-black text-lg uppercase text-black">
                {selectedGame ? 'EDIT GAME CONFIGURATION' : 'ADD NEW ESPORTS TITLE'}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-stone-500 hover:text-black font-black font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-stone-700 mb-1">Game Name</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Dota 2"
                    className="w-full border-2 border-black p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-stone-700 mb-1">Slug</label>
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="e.g. dota2"
                    className="w-full border-2 border-black p-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-stone-700 mb-1">Short Name</label>
                  <input
                    type="text"
                    value={formShortName}
                    onChange={(e) => setFormShortName(e.target.value)}
                    placeholder="e.g. Dota 2"
                    className="w-full border-2 border-black p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-stone-700 mb-1">Icon / Logo Emoji</label>
                  <input
                    type="text"
                    value={formLogo}
                    onChange={(e) => setFormLogo(e.target.value)}
                    placeholder="e.g. 🛡️"
                    className="w-full border-2 border-black p-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-black uppercase text-stone-700 mb-1">Team Size</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formTeamSize}
                    onChange={(e) => setFormTeamSize(parseInt(e.target.value, 10))}
                    className="w-full border-2 border-black p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-stone-700 mb-1">Sub Limit</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={formSubLimit}
                    onChange={(e) => setFormSubLimit(parseInt(e.target.value, 10))}
                    className="w-full border-2 border-black p-2 text-xs"
                  />
                </div>
                <div>
                  <SelectDropdown
                    label="Competition"
                    value={formCompetitionType}
                    onChange={(val) => setFormCompetitionType(val)}
                    options={[
                      { value: 'MOBA_5v5', label: 'MOBA 5v5' },
                      { value: 'HEAD_TO_HEAD', label: 'Head to Head' },
                      { value: 'TACTICAL_FPS', label: 'Tactical FPS' },
                      { value: 'BATTLE_ROYALE', label: 'Battle Royale' }
                    ]}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black uppercase text-stone-700 mb-1">
                  Roles (Comma Separated)
                </label>
                <textarea
                  rows={2}
                  value={formRoles}
                  onChange={(e) => setFormRoles(e.target.value)}
                  className="w-full border-2 border-black p-2 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-4 h-4 accent-black"
                />
                <label htmlFor="activeCheck" className="font-bold text-black cursor-pointer">
                  Activate game immediately (makes visible to public tournament organizers &amp; players)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 border-2 border-black font-black uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#FFE600] hover:bg-yellow-400 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  {selectedGame ? 'Save Changes' : 'Create Game'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
