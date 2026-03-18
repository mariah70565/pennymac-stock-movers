import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { Mover } from '../types'; 

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface ChartProps {
    movers: Mover[]
}

function Chart({ movers }: ChartProps) {
    const tickerColors: Record<string, string> = {
        AAPL: '#8F00FF',   // purple
        MSFT: '#FFBF00',   // amber
        GOOGL: '#0000FF',  // blue
        AMZN: '#FF6E00',   // orange
        TSLA: '#Fa003F',   // red
        NVDA: '#03C04A',   // green
    }

    // list of all stocks in list
    const watchList = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA']

    // get sorted dates for x axis
    const dates = [...movers.map(mover => mover.date)].sort()

    // creating each line/stock in the chart
    const datasets = watchList.map(ticker => {
        const data = dates.map(date => {
            const mover = movers.find(mover => mover.ticker === ticker && mover.date === date)
            return mover ? mover.percentChange : null //get percent change of mover on this date. if none, mover didnt win this day
        })

        return {
            label: ticker, //legend name
            data: data, //array of percent changes (or null) for each date
            borderColor: tickerColors[ticker], //line/stock color
            backgroundColor: tickerColors[ticker] + '75', //fill legend color codes with lighter background (opacity)
            tension: 0.4, //curve smoothing
            spanGaps: true //draw line across null values and avoid breaking
        }
    })
    .filter(dataset => dataset.data.some(d => d !== null)) //only show tickers with data
    
    const options = {
        responsive: true, //resize ability within its container
        plugins: {
            legend: { //put legent above chart
                position: 'top' as const,
                display: true
            },
            title: { //display title
                display: true,
                text: `Percent Change from ${dates[0]} to ${dates[dates.length - 1]}`
            },
        },
        scales: {
            x: { //x axis label
                title: {
                    display: true,
                    text: 'Date'
                }
            },
            y: { //y axis label
                title: {
                    display: true,
                    text: '% Change'
                }
            }
        }
    };

    return (
        <div className="flex justify-center rounded-lg overflow-hidden border-4 border-violet-600 dark:border-violet-800 shadow-lg hover:shadow-xl shadow-violet-400 dark:shadow-violet-600 transition-shadow duration-300">
            <Line data={{ labels: dates, datasets}} options={options}/>
        </div>
    )
}

export default Chart