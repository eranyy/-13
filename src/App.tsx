import React, { useState } from 'react';
import { Trophy, Search, Users, Star, ChevronLeft, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

const initialTeams = [
  {
    id: 1,
    name: 'האלופים של חיפה',
    manager: 'יוסי בניון',
    score: 1450,
    rank: 1,
    change: 'up',
    lineup: [
      { name: 'ג\'וש כהן', position: 'GK', points: 6 },
      { name: 'שון גולדברג', position: 'DEF', points: 4 },
      { name: 'צ\'רון שרי', position: 'MID', points: 12 },
      { name: 'דין דוד', position: 'ATT', points: 8 },
    ]
  },
  {
    id: 2,
    name: 'מכבי תל אביב זהב',
    manager: 'ערן זהבי',
    score: 1420,
    rank: 2,
    change: 'down',
    lineup: [
      { name: 'דניאל פרץ', position: 'GK', points: 7 },
      { name: 'סבוריט', position: 'DEF', points: 5 },
      { name: 'דור פרץ', position: 'MID', points: 3 },
      { name: 'יובאנוביץ', position: 'ATT', points: 9 },
    ]
  },
  {
    id: 3,
    name: 'ביתר המנורה',
    manager: 'אלי אוחנה',
    score: 1380,
    rank: 3,
    change: 'same',
    lineup: [
      { name: 'סילבה', position: 'GK', points: 2 },
      { name: 'דגני', position: 'DEF', points: 4 },
      { name: 'שועה', position: 'MID', points: 15 },
      { name: 'אספרייה', position: 'ATT', points: 6 },
    ]
  },
];

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<any>(null);

  const filteredTeams = initialTeams.filter(team =>
    team.name.includes(searchTerm) || team.manager.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans" dir="rtl">
      {/* כותרת עליונה */}
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <h1 className="text-2xl font-bold">פנטזי לוזון - עונה 13</h1>
            </div>
            <div className="text-sm opacity-80">
              המחזור הנוכחי: 24
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* חיפוש */}
        <div className="mb-6 relative">
          <input
            type="text"
            placeholder="חפש קבוצה או מאמן..."
            className="w-full p-4 pr-12 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute top-1/2 right-4 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        </div>

        {/* טבלת ליגה */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">דירוג</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">קבוצה</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">מאמן</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">נקודות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredTeams.map((team) => (
                  <tr 
                    key={team.id} 
                    onClick={() => setSelectedTeam(team)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors duration-150"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                          team.rank === 1 ? 'bg-yellow-100 text-yellow-700' : 
                          team.rank === 2 ? 'bg-gray-100 text-gray-700' :
                          team.rank === 3 ? 'bg-orange-100 text-orange-700' : ''
                        }`}>
                          {team.rank}
                        </span>
                        {team.change === 'up' && <ArrowUpCircle className="w-4 h-4 text-green-500" />}
                        {team.change === 'down' && <ArrowDownCircle className="w-4 h-4 text-red-500" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-blue-900">{team.name}</td>
                    <td className="px-6 py-4 text-gray-600">{team.manager}</td>
                    <td className="px-6 py-4 text-left font-bold text-gray-900">{team.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* מודל הרכב קבוצה */}
      {selectedTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-blue-600 p-6 text-white flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold">{selectedTeam.name}</h2>
                <p className="opacity-80 mt-1">{selectedTeam.manager}</p>
              </div>
              <button 
                onClick={() => setSelectedTeam(null)}
                className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                הרכב המחזור
              </h3>
              
              <div className="space-y-3">
                {selectedTeam.lineup.map((player: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`text-xs font-bold px-2 py-1 rounded ${
                        player.position === 'GK' ? 'bg-yellow-100 text-yellow-800' :
                        player.position === 'DEF' ? 'bg-blue-100 text-blue-800' :
                        player.position === 'MID' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {player.position}
                      </div>
                      <span className="font-medium">{player.name}</span>
                    </div>
                    <div className="font-bold text-gray-900 flex items-center gap-1">
                      {player.points}
                      <Star className="w-3 h-3 text-yellow-500 fill-current" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between text-sm text-gray-500">
                <span>סה"כ נקודות מחזור:</span>
                <span className="font-bold text-gray-900 text-lg">
                  {selectedTeam.lineup.reduce((acc: number, curr: any) => acc + curr.points, 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
