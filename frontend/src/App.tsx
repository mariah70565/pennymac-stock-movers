import { useEffect, useState } from 'react'
import axios from 'axios'
import { IoMoonOutline, IoSunnyOutline, IoArrowBackOutline, IoArrowForwardOutline } from 'react-icons/io5'
import type { Mover, ApiResponse } from './types'
import Leaderboard from './components/Leaderboard'
import Chart from './components/Chart'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL

function App() {
    const [movers, setMovers] = useState<Mover[]>([]) //holds the stock movers data fetched from the API
    const [nextPageToken, setNextPageToken] = useState<string | null>(null) //stores the token for fetching the next page of data, if available
    const [pageHistory, setPageHistory] = useState<(string | null)[]>([null]) //holds all pageTokens that have been explored to move around multiple sets of data
    const [currentPage, setCurrentPage] = useState(0) //holds currentPage to index into page history to retrieve page token
    const [loading, setLoading] = useState(true) //indicated when the app is in the process of fetching data from the API, used to show a loading state to the user
    const [error, setError] = useState<string | null>(null) //stores any error messages that occur during the data fetching process, used to display error information to the user

    // call getMovers API with token (if available) and return 7 movers
    const fetchMovers = async (token?: string | null) => {
        try {
            setLoading(true) //until movers are fetched
            const url = token ? `${API_URL}?nextPageToken=${token}` : API_URL //pertains to which group of movers to fetch
            const response = await axios.get<ApiResponse>(url)
            setMovers(response.data.movers)
            setNextPageToken(response.data.nextPageToken || null)

        } catch (error) {
            console.error('Error fetching movers:', error)
            setError('Failed to fetch movers')
        
        } finally {
            setLoading(false) //fetch attempt complete
        }
    }
    useEffect(() => {
        fetchMovers()
    }, [])

    // get sorted dates for x axis
    const dates = [...movers.map(mover => mover.date)].sort()

    // to grab older movers (next 7 in table)
    const goForward = () => {
        const newPage = currentPage + 1
        setPageHistory([...pageHistory, nextPageToken])
        setCurrentPage(newPage)
        fetchMovers(nextPageToken)
    }

    // to grab newer movers (back 7 in table)
    const goBack = () => {
        const newPage = currentPage - 1
        setCurrentPage(newPage)
        fetchMovers(pageHistory[newPage])
    }

    const [theme, setTheme] = useState<'light' | 'dark'>('light') //holds theme setting

    // allow users to manually toggle theme
    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light'
        setTheme(newTheme)
        document.documentElement.classList.toggle('dark', newTheme === 'dark')
        localStorage.setItem('theme', newTheme)
    }

    // prevent theme reset on refresh
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null //save the theme to retrive on refresh
        if (savedTheme) { //set theme if any
            setTheme(savedTheme as 'light' | 'dark')
            document.documentElement.classList.toggle('dark', savedTheme === 'dark')
        
        // default to user's OS theme settings (dark since light is automatic) if no theme is manually selected
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark')
            document.documentElement.classList.add('dark')
        }
    }, [])
    
    return (
        <div className='min-h-screen bg-white dark:bg-indigo-950 p-4'>
            {/* website title */}
            <h1 className='text-3xl font-bold text-center whitespace-nowrap text-black dark:text-white'>Stock Movers Dashboard</h1>

            {/* page content */}
            {/* getMovers fetch in progress */}
            {loading ? (
                <p className='flex justify-center text-2xl text-violet-600 dark:text-violet-400'>Loading...</p>
            
                // error fetching
            ) : error ? (
                <p className='flex justify-center text-2xl text-red-500'>{error}</p>
            
                // normal case
            ) : (
                <div className='max-w-5xl mx-auto flex flex-col gap-10'>
                    {/* page header */}
                    <div className='flex flex-col items-center gap-2'>
                        {/* current page title */}
                        <h2 className='text-2xl font-bold text-center whitespace-nowrap text-violet-600 dark:text-violet-400'> {dates[0]} to {dates[dates.length - 1]}</h2>

                        {/* theme toggler */}
                        <button
                            className='flex items-center gap-2 px-4 py-2 text-base rounded-3xl border-4 border-indigo-950 text-violet-300 bg-indigo-950 shadow-md hover:border-violet-400 transition-border duration-150 dark:text-violet-600 dark:bg-white'
                            onClick={toggleTheme}
                        >
                            {theme === 'light' ? 'Toggle Dark Mode' : 'Toggle Light Mode'}
                            {theme === 'light' ? <IoMoonOutline/> : <IoSunnyOutline/>}
                        </button>
                    </div>
                    {/* leaderboard of top movers according to current page */}
                    <Leaderboard movers={movers}/>

                    {/* line chart of current page's movers */}
                    <Chart movers={movers}/>

                    {/* table of winning stocks */}
                    <div className='rounded-lg overflow-hidden border-4 border-violet-600 dark:border-violet-800 shadow-lg hover:shadow-xl shadow-violet-400 dark:shadow-violet-600 transition-shadow duration-300'>
                        <table className='w-full'>
                            {/* table header */}
                            <thead className=''>
                                <tr className='bg-violet-600 dark:bg-violet-800 text-white font-bold text-lg'>
                                    <th className='py-2 px-4 text-left'>Stock</th>
                                    <th className='py-2 px-4 text-left'>Date</th>
                                    <th className='py-2 px-4 text-left'>Percent Change</th>
                                    <th className='py-2 px-4 text-left'>Close Price</th>
                                </tr>
                            </thead>
                            {/* table content */}
                            {/* percent change is green if positive or no change, red if negative change */}
                            <tbody className='divide-y divide-gray-200 dark:divide-slate-600'>
                                {movers.map((mover) => (
                                    <tr
                                        key={mover.date}
                                        className={`bg-white dark:bg-slate-800 text-black dark:text-white border-l-8 ${mover.percentChange >= 0 ? 'border-l-green-500 dark:border-l-green-400' : 'border-l-red-500'}`}
                                    >
                                        <td className='py-2 px-4 font-bold'>{mover.ticker}</td>
                                        <td className='py-2 px-4'>{mover.date}</td>
                                        <td className={`py-2 px-4 ${mover.percentChange >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500'}`}>{mover.percentChange > 0 ? '+' : ''}{mover.percentChange.toFixed(2)}%</td>
                                        <td className='py-2 px-4'>${mover.closePrice.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* table pagination */}
                    <div className='flex items-center justify-center gap-4'>
                        {/* prev button grabs up to 7 older movers, if any, from table */}
                        <button
                            className='flex items-center gap-2 px-4 py-2 text-base rounded-3xl bg-violet-500 dark:bg-violet-800 hover:bg-violet-800 dark:hover:bg-violet-600 text-white transition-colors duration-150 disabled:opacity-50 disabled:hover:bg-violet-600 dark:disabled:hover:bg-violet-800 disabled:hover:cursor-not-allowed'
                            onClick={goBack}
                            disabled={currentPage === 0} //disable going back if on newest 7
                        >
                            <IoArrowBackOutline />
                            Newer
                        </button>
                        {/* next button grabs up to 7 newer movers, if any, from table */}
                        <button
                            className='flex items-center gap-2 px-4 py-2 text-base rounded-3xl bg-violet-500 dark:bg-violet-800 hover:bg-violet-800 dark:hover:bg-violet-600 text-white transition-colors duration-150 disabled:opacity-50 disabled:hover:bg-violet-600 dark:disabled:hover:bg-violet-800 disabled:hover:cursor-not-allowed'
                            onClick={goForward}
                            disabled={!nextPageToken} //disable going next if no next token available (no older movers in stock)
                        >
                            Older
                            <IoArrowForwardOutline />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
