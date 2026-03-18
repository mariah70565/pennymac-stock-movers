import { IoTrophy } from "react-icons/io5";
import type { Mover } from "../types";

interface LeaderboardProps {
    movers: Mover[]
}

function Leaderboard({ movers }: LeaderboardProps) {
    //count all wins of each stock on the page
    const winCounts = movers.reduce<Record<string, number>>((wins, mover) => {
        wins[mover.ticker] = (wins[mover.ticker] || 0) + 1
        return wins
    }, {})

    //sort by win counts descending and trim to have only the top 3 movers
    const sorted = Object.entries(winCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)

    //medal emojis for top 3
    const medals = ['🥇', '🥈', '🥉']

    return (
        <div className="rounded-lg overflow-hidden border-4 border-violet-600 dark:border-violet-800 shadow-lg hover:shadow-xl shadow-violet-400 dark:shadow-violet-600 transition-shadow duration-300">
            {/* leaderboard header */}
            <div className="flex text-lg gap-2 justify-center items-center text-white bg-violet-600 dark:bg-violet-800 py-2 px-4">
                <h2 className="font-bold text-center whitespace-nowrap">Top Movers</h2>
                <IoTrophy/>
            </div>

            {/* holds top 3 movers with their ticker and win count */}
            <div className='divide-y divide-gray-200 dark:divide-slate-600'>
                {sorted.map(([ticker, wins], index) => (
                    <div
                        key={ticker}
                        className='flex justify-between items-center px-4 py-2 bg-white dark:bg-slate-800 text-black dark:text-white'
                    >
                        {/* ticker name with corresponding medal */}
                        <span className='font-bold text-lg'>
                            {medals[index]} {ticker}
                        </span>
                        {/* ticker win count */}
                        <span className='text-violet-600 dark:text-violet-300 font-semibold'>
                            {wins} {wins === 1 ? 'win' : 'wins'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default Leaderboard